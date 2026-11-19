//! Thành viên và lời mời (desc §3, §4.1).
//!
//! Quy tắc chung:
//! - Không ai cấp được quyền lớn hơn quyền mình đang có: mỗi quyền **bị thay đổi** phải nằm trong quyền của người làm.
//! - Không ai thao tác được trên người có phạm vi rộng hơn mình (xem [`rank`]).
//! - Không ai tự sửa quyền của chính mình.

use crate::model::*;
use crate::service::{not_found, owner_membership, Colls, WorkspaceService};
use bson::doc;
use chillcat_kernel::contracts::WorkspaceAccess;
use chillcat_kernel::events::kinds;
use chillcat_kernel::*;
use chillcat_platform::mongo::{is_duplicate_key_app, now_bson, with_txn};
use futures::TryStreamExt;
use serde_json::json;
use std::collections::BTreeMap;

/// Độ "rộng" của một người trong một phạm vi: 3 = workspace owner; 2 = có quyền quản lý người dùng ở cấp
/// workspace; 1 = owner của group đang xét; 0 = còn lại.
pub(crate) fn rank(a: &WorkspaceAccess, scope: ScopeType, scope_id: &str) -> u8 {
    if a.is_workspace_owner() {
        3
    } else if !a.user_perms_in_workspace().is_empty() {
        2
    } else if scope == ScopeType::Group && a.is_group_owner(&GroupId::from(scope_id)) {
        1
    } else {
        0
    }
}

/// Quyền người làm được phép cấp trong một phạm vi.
pub(crate) fn grantable(a: &WorkspaceAccess, scope: ScopeType, scope_id: &str) -> (DocPerms, UserPerms) {
    match scope {
        ScopeType::Workspace => {
            let mut d = a.workspace_grant.map(|g| g.doc_perms).unwrap_or(DocPerms::NONE);
            if a.is_workspace_owner() {
                d = d.union(DocPerms::WORKSPACE_OWNER);
            }
            (d.closure(), a.user_perms_in_workspace())
        }
        ScopeType::Group => {
            let g = GroupId::from(scope_id);
            let mut u = a.user_perms_in_group(&g);
            // Chỉ định / bỏ owner là quyền của cấp workspace.
            u.assign_owner = false;
            u.remove_owner = false;
            (a.doc_perms_in(&g), u)
        }
    }
}

fn changed_doc(old: DocPerms, new: DocPerms) -> DocPerms {
    let mut d = DocPerms::NONE;
    for p in DocPerm::ALL {
        if old.has(p) != new.has(p) {
            d.set(p, true);
        }
    }
    d
}

fn changed_user(old: UserPerms, new: UserPerms) -> UserPerms {
    UserPerms {
        assign_owner: old.assign_owner != new.assign_owner,
        remove_owner: old.remove_owner != new.remove_owner,
        invite: old.invite != new.invite,
        kick: old.kick != new.kick,
        manage_perms: old.manage_perms != new.manage_perms,
    }
}

fn exceed_error(missing: Vec<DocPerm>, user_missing: bool) -> AppError {
    AppError::forbidden("membership.exceeds_own_perms", "Không thể cấp hoặc thu hồi quyền mà chính bạn không có")
        .with_details(json!({ "doc_perms": missing, "user_perms": user_missing }))
}

/// Kiểm tra `new` so với `old` theo quyền người làm.
pub(crate) fn check_change(
    grant_doc: DocPerms,
    grant_user: UserPerms,
    old_doc: DocPerms,
    new_doc: DocPerms,
    old_user: UserPerms,
    new_user: UserPerms,
) -> AppResult<()> {
    let d = changed_doc(old_doc.closure(), new_doc.closure());
    let missing = d.missing_from(grant_doc);
    let u_ok = changed_user(old_user, new_user).is_subset_of(grant_user);
    if !missing.is_empty() || !u_ok {
        return Err(exceed_error(missing, !u_ok));
    }
    Ok(())
}

fn scope_label(scope: ScopeType) -> &'static str {
    match scope {
        ScopeType::Workspace => "workspace",
        ScopeType::Group => "group",
    }
}

impl WorkspaceService {
    async fn membership_doc(&self, id: &MembershipId) -> AppResult<MembershipDoc> {
        self.c
            .memberships
            .find_one(doc! { "_id": id })
            .await?
            .ok_or_else(|| AppError::not_found("membership.not_found", "Không tìm thấy thành viên"))
    }

    pub async fn members(&self, p: &Principal, ws: &WorkspaceId) -> AppResult<Vec<MemberDto>> {
        let (w, _) = self.member_access(p, ws).await?;
        let ms: Vec<MembershipDoc> = self.c.memberships.find(doc! { "workspace_id": ws }).await?.try_collect().await?;
        let users = self.summaries(ms.iter().map(|m| m.user_id.clone()).chain([w.owner_id.clone()])).await?;
        let mut by_user: BTreeMap<String, Vec<&MembershipDoc>> = BTreeMap::new();
        for m in &ms {
            by_user.entry(m.user_id.to_string()).or_default().push(m);
        }
        let mut out: Vec<MemberDto> = by_user
            .into_iter()
            .filter_map(|(uid, list)| {
                let uid = UserId::from(uid);
                let user = users.get(&uid)?.clone();
                Some(MemberDto {
                    is_workspace_owner: uid == w.owner_id,
                    user,
                    memberships: list.into_iter().map(MembershipDto::from).collect(),
                })
            })
            .collect();
        out.sort_by(|a, b| b.is_workspace_owner.cmp(&a.is_workspace_owner).then(a.user.display_name.cmp(&b.user.display_name)));
        Ok(out)
    }

    /// Sửa quyền của một membership (cần `manage_perms` trong phạm vi đó).
    pub async fn update_membership(&self, p: &Principal, id: &MembershipId, input: UpdateMembership) -> AppResult<MembershipDto> {
        let m = self.membership_doc(id).await?;
        let (_, actor) = self.member_access(p, &m.workspace_id).await?;
        if m.user_id == p.user_id {
            return Err(AppError::forbidden("membership.self", "Không thể tự sửa quyền của chính mình"));
        }
        if m.is_owner {
            return Err(AppError::forbidden("membership.owner_fixed", "Quyền của owner cố định – muốn đổi thì chỉ định owner khác"));
        }
        let can_manage = match m.scope_type {
            ScopeType::Workspace => actor.user_perms_in_workspace().manage_perms,
            ScopeType::Group => actor.user_perms_in_group(&GroupId::from(m.scope_id.clone())).manage_perms,
        };
        if !can_manage {
            return Err(AppError::forbidden("membership.manage_forbidden", "Bạn không có quyền điều chỉnh quyền trong phạm vi này"));
        }
        let target = self.access_of(&m.user_id, &m.workspace_id).await?.ok_or_else(not_found)?;
        if rank(&target, m.scope_type, &m.scope_id) >= rank(&actor, m.scope_type, &m.scope_id) && !actor.is_workspace_owner() {
            return Err(AppError::forbidden("membership.wider_scope", "Không thể thao tác trên người có phạm vi rộng hơn hoặc ngang bạn"));
        }
        let new_doc = input.doc_perms.unwrap_or(m.doc_perms).closure();
        let mut new_user = input.user_perms.unwrap_or(m.user_perms);
        if m.scope_type == ScopeType::Group {
            new_user.assign_owner = false;
            new_user.remove_owner = false;
        }
        let (gd, gu) = grantable(&actor, m.scope_type, &m.scope_id);
        check_change(gd, gu, m.doc_perms, new_doc, m.user_perms, new_user)?;
        if new_doc == m.doc_perms && new_user == m.user_perms {
            return Ok(MembershipDto::from(&m)); // không có gì đổi – không ghi, không sinh sự kiện
        }
        let event = DomainEvent::new(kinds::MEMBERSHIP_PERMS_CHANGED, "membership", id.as_str())
            .workspace(&m.workspace_id)
            .actor(&p.user_id)
            .data(json!({
                "user_id": m.user_id, "scope_type": m.scope_type, "scope_id": m.scope_id,
                "from": { "doc_perms": m.doc_perms, "user_perms": m.user_perms },
                "to": { "doc_perms": new_doc, "user_perms": new_user },
            }))
            .notify([m.user_id.clone()])
            .audit();
        // Đổi quyền và dòng nhật ký commit cùng nhau.
        let set = doc! { "$set": { "doc_perms": bson::to_bson(&new_doc)?, "user_perms": bson::to_bson(&new_user)? } };
        let (c, mid) = (self.c.clone(), id.clone());
        with_txn(self.mongo.client(), move |s| {
            let (c, mid, set, event) = (c.clone(), mid.clone(), set.clone(), event.clone());
            Box::pin(async move {
                let r = c.memberships.update_one(doc! { "_id": &mid }, set).session(&mut *s).await?;
                if r.matched_count == 0 {
                    return Err(AppError::not_found("membership.not_found", "Không tìm thấy thành viên"));
                }
                c.bus.publish_in(s, event).await
            })
        })
        .await?;
        Ok(MembershipDto::from(&self.membership_doc(id).await?))
    }

    /// Loại thành viên (cần `kick`) hoặc tự rời phạm vi. Loại khỏi phạm vi workspace = loại khỏi cả workspace.
    /// Tài liệu họ tạo vẫn còn; quyền phụ trách chuyển cho owner của phạm vi (module documents xử lý sự kiện).
    pub async fn remove_membership(&self, p: &Principal, id: &MembershipId) -> AppResult<()> {
        let m = self.membership_doc(id).await?;
        let (w, actor) = self.member_access(p, &m.workspace_id).await?;
        let leaving = m.user_id == p.user_id;
        let target = self.access_of(&m.user_id, &m.workspace_id).await?.ok_or_else(not_found)?;

        if m.scope_type == ScopeType::Workspace && m.user_id == w.owner_id {
            return Err(AppError::forbidden(
                "membership.owner_cannot_leave",
                "Workspace owner không thể rời đi hay bị loại – chuyển quyền owner cho người khác trước",
            ));
        }
        let owned_groups: Vec<GroupId> = target.groups.iter().filter(|g| g.grant.is_owner).map(|g| g.group_id.clone()).collect();
        let removes_owned_group = match m.scope_type {
            ScopeType::Workspace => !owned_groups.is_empty(),
            ScopeType::Group => m.is_owner,
        };
        if removes_owned_group {
            return Err(AppError::forbidden(
                "membership.group_owner",
                "Người này đang là group owner – workspace owner cần chỉ định group owner khác trước",
            ));
        }
        if !leaving {
            let can_kick = match m.scope_type {
                ScopeType::Workspace => actor.user_perms_in_workspace().kick,
                ScopeType::Group => actor.user_perms_in_group(&GroupId::from(m.scope_id.clone())).kick,
            };
            if !can_kick {
                return Err(AppError::forbidden("membership.kick_forbidden", "Bạn không có quyền loại thành viên trong phạm vi này"));
            }
            if rank(&target, m.scope_type, &m.scope_id) >= rank(&actor, m.scope_type, &m.scope_id) && !actor.is_workspace_owner() {
                return Err(AppError::forbidden(
                    "membership.wider_scope",
                    "Không thể thao tác trên người có phạm vi rộng hơn hoặc ngang bạn",
                ));
            }
        }

        let removed: Vec<MembershipDoc> = match m.scope_type {
            ScopeType::Workspace => {
                self.c.memberships.find(doc! { "workspace_id": &m.workspace_id, "user_id": &m.user_id }).await?.try_collect().await?
            }
            ScopeType::Group => vec![m.clone()],
        };
        let reason = if leaving { "left" } else { "kicked" };
        // Người nhận quyền phụ trách tài liệu: owner của đúng phạm vi bị rời.
        let mut successors = Vec::with_capacity(removed.len());
        for r in &removed {
            successors.push(match r.scope_type {
                ScopeType::Workspace => w.owner_id.clone(),
                ScopeType::Group => self.group_doc(&GroupId::from(r.scope_id.clone())).await?.owner_id,
            });
        }
        let events: Vec<DomainEvent> = removed
            .iter()
            .zip(successors)
            .map(|(r, succ)| {
                DomainEvent::new(kinds::MEMBERSHIP_REMOVED, "membership", r.id.as_str())
                    .workspace(&r.workspace_id)
                    .actor(&p.user_id)
                    .data(json!({
                        "user_id": r.user_id, "scope_type": r.scope_type, "scope_id": r.scope_id,
                        "successor_id": succ, "reason": reason,
                    }))
                    .notify(if leaving { vec![] } else { vec![r.user_id.clone()] })
                    .audit()
            })
            .collect();
        let ids: Vec<MembershipId> = removed.iter().map(|r| r.id.clone()).collect();
        let c: Colls = self.c.clone();
        with_txn(self.mongo.client(), move |s| {
            let (c, ids, events) = (c.clone(), ids.clone(), events.clone());
            Box::pin(async move {
                c.memberships.delete_many(doc! { "_id": { "$in": &ids } }).session(&mut *s).await?;
                c.bus.publish_all_in(s, events).await
            })
        })
        .await
    }

    // -------------------------------------------------------------- lời mời

    async fn invitation_dtos(&self, list: Vec<InvitationDoc>) -> AppResult<Vec<InvitationDto>> {
        let users = self.summaries(list.iter().map(|i| i.invited_by.clone())).await?;
        let mut out = Vec::with_capacity(list.len());
        for i in list {
            let w = self.workspace_doc(&i.workspace_id).await?;
            let scope_name = match i.scope_type {
                ScopeType::Workspace => w.as_ref().map(|w| w.name.clone()),
                ScopeType::Group => self.c.groups.find_one(doc! { "_id": &i.scope_id }).await?.map(|g| g.name),
            };
            let expired = i.status == InvitationStatus::Pending && i.expires_at < now_bson();
            out.push(InvitationDto {
                id: i.id.clone(),
                workspace_id: i.workspace_id.clone(),
                workspace_code: w.as_ref().map(|w| w.code.clone()),
                workspace_name: w.as_ref().map(|w| w.name.clone()),
                scope_type: i.scope_type,
                scope_id: i.scope_id.clone(),
                scope_name,
                email: i.email.clone(),
                user_perms: i.user_perms,
                doc_perms: i.doc_perms,
                inviter: users.get(&i.invited_by).cloned(),
                invited_by: i.invited_by,
                status: if expired { InvitationStatus::Expired } else { i.status },
                expires_at: i.expires_at.to_chrono(),
                created_at: i.created_at.to_chrono(),
            });
        }
        Ok(out)
    }

    /// Lời mời đang chờ trong workspace mà người gọi được quản lý (có quyền mời ở phạm vi đó).
    pub async fn invitations(&self, p: &Principal, ws: &WorkspaceId) -> AppResult<Vec<InvitationDto>> {
        let (_, a) = self.member_access(p, ws).await?;
        let list: Vec<InvitationDoc> =
            self.c.invitations.find(doc! { "workspace_id": ws, "status": "pending" }).sort(doc! { "_id": -1 }).await?.try_collect().await?;
        let visible = list
            .into_iter()
            .filter(|i| match i.scope_type {
                ScopeType::Workspace => a.user_perms_in_workspace().invite,
                ScopeType::Group => a.user_perms_in_group(&GroupId::from(i.scope_id.clone())).invite,
            })
            .collect();
        self.invitation_dtos(visible).await
    }

    pub async fn create_invitation(&self, p: &Principal, ws: &WorkspaceId, input: CreateInvitation) -> AppResult<InvitationDto> {
        let (w, a) = self.member_access(p, ws).await?;
        let scope_id = match input.scope_type {
            ScopeType::Workspace => ws.to_string(),
            ScopeType::Group => {
                let gid =
                    input.scope_id.clone().ok_or_else(|| AppError::bad_request("invitation.scope_required", "Chọn group để mời vào"))?;
                let g = self.group_doc(&GroupId::from(gid)).await?;
                if g.workspace_id != *ws {
                    return Err(AppError::not_found("group.not_found", "Không tìm thấy group"));
                }
                g.id.to_string()
            }
        };
        let can_invite = match input.scope_type {
            ScopeType::Workspace => a.user_perms_in_workspace().invite,
            ScopeType::Group => a.user_perms_in_group(&GroupId::from(scope_id.clone())).invite,
        };
        if !can_invite {
            return Err(AppError::forbidden("invitation.forbidden", "Bạn không có quyền mời người vào phạm vi này"));
        }
        let email = input.email.trim().to_lowercase();
        if !email.contains('@') || email.len() > 254 || email.contains(char::is_whitespace) {
            return Err(AppError::unprocessable("user.invalid_email", "E-mail không hợp lệ"));
        }
        let (gd, gu) = grantable(&a, input.scope_type, &scope_id);
        let doc_perms = input.doc_perms.unwrap_or_else(|| DocPerms::DEFAULT_MEMBER.intersect(gd)).closure();
        let mut user_perms = input.user_perms.unwrap_or(UserPerms::NONE);
        if input.scope_type == ScopeType::Group {
            user_perms.assign_owner = false;
            user_perms.remove_owner = false;
        }
        check_change(gd, gu, DocPerms::NONE, doc_perms, UserPerms::NONE, user_perms)?;

        let invitee = self.identity.user_by_email(&email).await?;
        if let Some(u) = &invitee {
            let exists = self
                .c
                .memberships
                .count_documents(doc! { "user_id": &u.id, "scope_type": scope_label(input.scope_type), "scope_id": &scope_id })
                .await?;
            if exists > 0 {
                return Err(AppError::conflict("invitation.already_member", "Người này đã là thành viên của phạm vi này"));
            }
        }
        let now = now_bson();
        let inv = InvitationDoc {
            id: InvitationId::new(),
            workspace_id: ws.clone(),
            scope_type: input.scope_type,
            scope_id,
            email: email.clone(),
            user_perms,
            doc_perms,
            invited_by: p.user_id.clone(),
            status: InvitationStatus::Pending,
            expires_at: bson::DateTime::from_millis(now.timestamp_millis() + self.settings.invitation_ttl.as_millis() as i64),
            created_at: now,
            decided_at: None,
            accepted_by: None,
        };
        // Lời mời cũ đã hết hạn của cùng người / phạm vi không được chặn lời mời mới.
        self.c
            .invitations
            .update_many(
                doc! { "email": &email, "scope_type": scope_label(inv.scope_type), "scope_id": &inv.scope_id,
                "status": "pending", "expires_at": { "$lt": now } },
                doc! { "$set": { "status": "expired", "decided_at": now } },
            )
            .await?;
        self.c.invitations.insert_one(&inv).await.map_err(|e| {
            if chillcat_platform::is_duplicate_key(&e) {
                AppError::conflict("invitation.pending_exists", "Đã có lời mời đang chờ cho e-mail này")
            } else {
                e.into()
            }
        })?;
        let mut ev = DomainEvent::new(kinds::INVITATION_CREATED, "invitation", inv.id.as_str())
            .workspace(ws)
            .actor(&p.user_id)
            .data(json!({
                "email": email, "scope_type": inv.scope_type, "scope_id": inv.scope_id,
                "workspace_name": w.name, "doc_perms": doc_perms, "user_perms": user_perms,
            }))
            .audit();
        if let Some(u) = invitee {
            ev = ev.notify([u.id]);
        }
        self.c.bus.publish(ev).await?;
        Ok(self.invitation_dtos(vec![inv]).await?.remove(0))
    }

    pub async fn revoke_invitation(&self, p: &Principal, id: &InvitationId) -> AppResult<()> {
        let inv = self
            .c
            .invitations
            .find_one(doc! { "_id": id })
            .await?
            .ok_or_else(|| AppError::not_found("invitation.not_found", "Không tìm thấy lời mời"))?;
        let (_, a) = self.member_access(p, &inv.workspace_id).await?;
        let can = inv.invited_by == p.user_id
            || match inv.scope_type {
                ScopeType::Workspace => a.user_perms_in_workspace().invite,
                ScopeType::Group => a.user_perms_in_group(&GroupId::from(inv.scope_id.clone())).invite,
            };
        if !can {
            return Err(AppError::forbidden("invitation.forbidden", "Bạn không có quyền thu hồi lời mời này"));
        }
        let r = self
            .c
            .invitations
            .update_one(doc! { "_id": id, "status": "pending" }, doc! { "$set": { "status": "revoked", "decided_at": now_bson() } })
            .await?;
        if r.modified_count == 0 {
            return Err(AppError::conflict("invitation.not_pending", "Lời mời không còn ở trạng thái chờ"));
        }
        self.c
            .bus
            .publish(
                DomainEvent::new(kinds::INVITATION_REVOKED, "invitation", id.as_str())
                    .workspace(&inv.workspace_id)
                    .actor(&p.user_id)
                    .data(json!({ "email": inv.email }))
                    .audit(),
            )
            .await
    }

    async fn my_email(&self, p: &Principal) -> AppResult<String> {
        Ok(self.identity.user(&p.user_id).await?.ok_or_else(|| AppError::unauthenticated("Tài khoản không còn tồn tại"))?.email)
    }

    pub async fn my_invitations(&self, p: &Principal) -> AppResult<Vec<InvitationDto>> {
        let email = self.my_email(p).await?;
        let list: Vec<InvitationDoc> = self
            .c
            .invitations
            .find(doc! { "email": email, "status": "pending", "expires_at": { "$gt": now_bson() } })
            .sort(doc! { "_id": -1 })
            .await?
            .try_collect()
            .await?;
        self.invitation_dtos(list).await
    }

    async fn my_pending(&self, p: &Principal, id: &InvitationId) -> AppResult<InvitationDoc> {
        let email = self.my_email(p).await?;
        let inv = self
            .c
            .invitations
            .find_one(doc! { "_id": id, "email": &email })
            .await?
            .ok_or_else(|| AppError::not_found("invitation.not_found", "Không tìm thấy lời mời dành cho bạn"))?;
        if inv.status != InvitationStatus::Pending || inv.expires_at < now_bson() {
            return Err(AppError::conflict("invitation.not_pending", "Lời mời đã hết hạn hoặc đã được xử lý"));
        }
        Ok(inv)
    }

    pub async fn accept_invitation(&self, p: &Principal, id: &InvitationId) -> AppResult<WorkspaceDto> {
        let inv = self.my_pending(p, id).await?;
        let mut m = owner_membership(&inv.workspace_id, &p.user_id, inv.scope_type, &inv.scope_id);
        m.is_owner = false;
        m.doc_perms = inv.doc_perms.closure();
        m.user_perms = inv.user_perms;
        m.invited_by = Some(inv.invited_by.clone());
        let event = DomainEvent::new(kinds::INVITATION_ACCEPTED, "invitation", inv.id.as_str())
            .workspace(&inv.workspace_id)
            .actor(&p.user_id)
            .data(json!({ "scope_type": inv.scope_type, "scope_id": inv.scope_id }))
            .notify([inv.invited_by.clone()])
            .audit();
        let added = DomainEvent::new(kinds::MEMBERSHIP_ADDED, "membership", m.id.as_str())
            .workspace(&inv.workspace_id)
            .actor(&p.user_id)
            .data(json!({ "user_id": p.user_id, "scope_type": m.scope_type, "scope_id": m.scope_id }))
            .audit();
        let (c, inv_id, uid) = (self.c.clone(), inv.id.clone(), p.user_id.clone());
        with_txn(self.mongo.client(), move |s| {
            let (c, m, inv_id, uid, event, added) = (c.clone(), m.clone(), inv_id.clone(), uid.clone(), event.clone(), added.clone());
            Box::pin(async move {
                let r = c
                    .invitations
                    .update_one(
                        doc! { "_id": &inv_id, "status": "pending" },
                        doc! { "$set": { "status": "accepted", "decided_at": now_bson(), "accepted_by": &uid } },
                    )
                    .session(&mut *s)
                    .await?;
                if r.modified_count == 0 {
                    return Err(AppError::conflict("invitation.not_pending", "Lời mời đã được xử lý"));
                }
                c.memberships.insert_one(&m).session(&mut *s).await?;
                c.bus.publish_all_in(s, vec![event, added]).await
            })
        })
        .await
        .map_err(|e| {
            if is_duplicate_key_app(&e) {
                AppError::conflict("invitation.already_member", "Bạn đã là thành viên của phạm vi này")
            } else {
                e
            }
        })?;
        self.get(p, &inv.workspace_id).await
    }

    /// Từ chối lời mời: đổi trạng thái và ghi nhật ký (báo cho người mời) trong cùng transaction.
    pub async fn decline_invitation(&self, p: &Principal, id: &InvitationId) -> AppResult<()> {
        let inv = self.my_pending(p, id).await?;
        let event = DomainEvent::new(kinds::INVITATION_DECLINED, "invitation", inv.id.as_str())
            .workspace(&inv.workspace_id)
            .actor(&p.user_id)
            .data(json!({ "email": inv.email, "scope_type": inv.scope_type, "scope_id": inv.scope_id }))
            .notify([inv.invited_by.clone()])
            .audit();
        let (c, inv_id) = (self.c.clone(), inv.id.clone());
        with_txn(self.mongo.client(), move |s| {
            let (c, inv_id, event) = (c.clone(), inv_id.clone(), event.clone());
            Box::pin(async move {
                let r = c
                    .invitations
                    .update_one(
                        doc! { "_id": &inv_id, "status": "pending" },
                        doc! { "$set": { "status": "declined", "decided_at": now_bson() } },
                    )
                    .session(&mut *s)
                    .await?;
                if r.modified_count == 0 {
                    return Err(AppError::conflict("invitation.not_pending", "Lời mời đã được xử lý"));
                }
                c.bus.publish_in(s, event).await
            })
        })
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_changed_bits_must_be_within_the_actors_perms() {
        let actor_doc = DocPerms::DEFAULT_MEMBER; // không có approve / publish
        let target_old = DocPerms { approve: true, ..DocPerms::DEFAULT_MEMBER }.closure();
        // giữ nguyên approve (do người khác cấp) và bỏ create: hợp lệ
        let new = DocPerms { create: false, ..target_old };
        assert!(check_change(actor_doc, UserPerms::NONE, target_old, new, UserPerms::NONE, UserPerms::NONE).is_ok());
        // bỏ approve: không được (người làm không có approve)
        let new = DocPerms { approve: false, ..target_old };
        assert!(check_change(actor_doc, UserPerms::NONE, target_old, new, UserPerms::NONE, UserPerms::NONE).is_err());
        // cấp quyền người dùng mà mình không có
        let err = check_change(
            actor_doc,
            UserPerms { invite: true, ..UserPerms::NONE },
            DocPerms::NONE,
            DocPerms::NONE,
            UserPerms::NONE,
            UserPerms { kick: true, ..UserPerms::NONE },
        )
        .unwrap_err();
        assert_eq!(err.code, "membership.exceeds_own_perms");
    }
}
