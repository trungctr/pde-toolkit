//! Workspace, group, hệ thống con.

use crate::model::*;
use bson::doc;
use chillcat_kernel::codes;
use chillcat_kernel::contracts::{DocumentsApi, GroupAccess, IdentityApi, Late, ScopeGrant, UserSummary, WorkspaceAccess};
use chillcat_kernel::events::kinds;
use chillcat_kernel::*;
use chillcat_platform::config::WorkspaceCreation;
use chillcat_platform::mongo::{ensure_indexes, index, is_duplicate_key_app, now_bson, with_txn};
use chillcat_platform::{EventBus, Mongo};
use futures::TryStreamExt;
use mongodb::{Collection, Database};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

#[derive(Clone, Debug)]
pub struct WorkspaceSettings {
    pub creation: WorkspaceCreation,
    pub invitation_ttl: Duration,
}

/// Các collection của module – rẻ để clone (dùng trong closure của transaction).
#[derive(Clone)]
pub(crate) struct Colls {
    pub workspaces: Collection<WorkspaceDoc>,
    pub groups: Collection<GroupDoc>,
    pub subsystems: Collection<SubsystemDoc>,
    pub memberships: Collection<MembershipDoc>,
    pub invitations: Collection<InvitationDoc>,
    pub bus: EventBus,
}

pub struct WorkspaceService {
    pub(crate) mongo: Mongo,
    pub(crate) c: Colls,
    pub(crate) identity: Arc<dyn IdentityApi>,
    pub(crate) documents: Late<dyn DocumentsApi>,
    pub(crate) settings: WorkspaceSettings,
}

pub(crate) fn not_found() -> AppError {
    AppError::not_found("workspace.not_found", "Không tìm thấy workspace, hoặc bạn không phải thành viên")
}

pub(crate) fn clean_text(v: &str, field: &str, max: usize) -> AppResult<String> {
    let v = v.split_whitespace().collect::<Vec<_>>().join(" ");
    if v.is_empty() || v.chars().count() > max {
        return Err(AppError::unprocessable("input.invalid", format!("{field} không được để trống và tối đa {max} ký tự")));
    }
    Ok(v)
}

pub(crate) fn clean_desc(v: &str) -> AppResult<String> {
    let v = v.trim();
    if v.chars().count() > 2000 {
        return Err(AppError::unprocessable("input.invalid", "Mô tả tối đa 2000 ký tự"));
    }
    Ok(v.to_owned())
}

pub(crate) fn owner_membership(ws: &WorkspaceId, user: &UserId, scope: ScopeType, scope_id: &str) -> MembershipDoc {
    let (user_perms, doc_perms) = match scope {
        ScopeType::Workspace => (UserPerms::WORKSPACE_OWNER, DocPerms::WORKSPACE_OWNER),
        ScopeType::Group => (UserPerms::GROUP_OWNER, DocPerms::ALL),
    };
    MembershipDoc {
        id: MembershipId::new(),
        workspace_id: ws.clone(),
        user_id: user.clone(),
        scope_type: scope,
        scope_id: scope_id.to_owned(),
        is_owner: true,
        user_perms,
        doc_perms,
        invited_by: None,
        joined_at: now_bson(),
    }
}

impl WorkspaceService {
    pub fn new(
        mongo: Mongo,
        db: &Database,
        bus: EventBus,
        identity: Arc<dyn IdentityApi>,
        documents: Late<dyn DocumentsApi>,
        settings: WorkspaceSettings,
    ) -> Self {
        WorkspaceService {
            mongo,
            c: Colls {
                workspaces: db.collection("workspaces"),
                groups: db.collection("groups"),
                subsystems: db.collection("subsystems"),
                memberships: db.collection("memberships"),
                invitations: db.collection("invitations"),
                bus,
            },
            identity,
            documents,
            settings,
        }
    }

    pub async fn ensure_indexes(&self) -> AppResult<()> {
        ensure_indexes(&self.c.workspaces, vec![index::unique("workspaces_code", doc! { "code": 1 })]).await?;
        ensure_indexes(&self.c.groups, vec![index::unique("groups_ws_name", doc! { "workspace_id": 1, "name_key": 1 })]).await?;
        ensure_indexes(&self.c.subsystems, vec![index::unique("subsystems_ws_code", doc! { "workspace_id": 1, "code": 1 })]).await?;
        ensure_indexes(
            &self.c.memberships,
            vec![
                index::unique("memberships_user_scope", doc! { "user_id": 1, "scope_type": 1, "scope_id": 1 }),
                index::plain("memberships_ws_user", doc! { "workspace_id": 1, "user_id": 1 }),
                index::plain("memberships_scope", doc! { "scope_type": 1, "scope_id": 1 }),
                // Mỗi group có đúng một owner (desc §3).
                index::unique_partial(
                    "memberships_one_group_owner",
                    doc! { "scope_id": 1 },
                    doc! { "scope_type": "group", "is_owner": true },
                ),
            ],
        )
        .await?;
        ensure_indexes(
            &self.c.invitations,
            vec![
                index::plain("invitations_ws", doc! { "workspace_id": 1, "status": 1 }),
                index::plain("invitations_email", doc! { "email": 1, "status": 1 }),
                index::unique_partial(
                    "invitations_one_pending",
                    doc! { "email": 1, "scope_type": 1, "scope_id": 1 },
                    doc! { "status": "pending" },
                ),
            ],
        )
        .await
    }

    // ------------------------------------------------------------ tính quyền

    pub(crate) async fn workspace_doc(&self, id: &WorkspaceId) -> AppResult<Option<WorkspaceDoc>> {
        Ok(self.c.workspaces.find_one(doc! { "_id": id }).await?)
    }

    pub(crate) fn build_access(ws: &WorkspaceDoc, user: &UserId, ms: &[MembershipDoc]) -> WorkspaceAccess {
        let grant = |m: &MembershipDoc| ScopeGrant { is_owner: m.is_owner, doc_perms: m.doc_perms.closure(), user_perms: m.user_perms };
        WorkspaceAccess {
            workspace: ws.info(),
            user_id: user.clone(),
            workspace_grant: ms.iter().find(|m| m.scope_type == ScopeType::Workspace).map(grant),
            groups: ms
                .iter()
                .filter(|m| m.scope_type == ScopeType::Group)
                .map(|m| GroupAccess { group_id: GroupId::from(m.scope_id.clone()), grant: grant(m) })
                .collect(),
        }
    }

    pub async fn access_of(&self, user: &UserId, ws: &WorkspaceId) -> AppResult<Option<WorkspaceAccess>> {
        let Some(w) = self.workspace_doc(ws).await? else { return Ok(None) };
        let ms: Vec<MembershipDoc> = self.c.memberships.find(doc! { "workspace_id": ws, "user_id": user }).await?.try_collect().await?;
        Ok(Some(Self::build_access(&w, user, &ms)))
    }

    /// Workspace và quyền của người gọi; 404 nếu không tồn tại hoặc người gọi không phải thành viên.
    pub(crate) async fn member_access(&self, p: &Principal, ws: &WorkspaceId) -> AppResult<(WorkspaceDoc, WorkspaceAccess)> {
        let w = self.workspace_doc(ws).await?.ok_or_else(not_found)?;
        let ms: Vec<MembershipDoc> =
            self.c.memberships.find(doc! { "workspace_id": ws, "user_id": &p.user_id }).await?.try_collect().await?;
        let a = Self::build_access(&w, &p.user_id, &ms);
        if !a.is_member() {
            return Err(not_found());
        }
        Ok((w, a))
    }

    pub(crate) fn require_ws_owner(a: &WorkspaceAccess) -> AppResult<()> {
        if a.is_workspace_owner() {
            Ok(())
        } else {
            Err(AppError::forbidden("workspace.owner_only", "Chỉ workspace owner được làm việc này"))
        }
    }

    pub(crate) async fn group_doc(&self, id: &GroupId) -> AppResult<GroupDoc> {
        self.c.groups.find_one(doc! { "_id": id }).await?.ok_or_else(|| AppError::not_found("group.not_found", "Không tìm thấy group"))
    }

    pub(crate) async fn summaries(&self, ids: impl IntoIterator<Item = UserId>) -> AppResult<HashMap<UserId, UserSummary>> {
        let mut v: Vec<UserId> = ids.into_iter().collect();
        v.sort();
        v.dedup();
        self.identity.users(&v).await
    }

    pub(crate) fn my_access_dto(a: &WorkspaceAccess) -> MyAccessDto {
        MyAccessDto {
            is_workspace_owner: a.is_workspace_owner(),
            is_member: a.is_member(),
            workspace_user_perms: a.user_perms_in_workspace(),
            workspace_doc_perms: a
                .workspace_grant
                .map(|g| g.doc_perms)
                .unwrap_or(DocPerms::NONE)
                .union(if a.is_workspace_owner() { DocPerms::WORKSPACE_OWNER } else { DocPerms::NONE })
                .closure(),
            groups: a
                .groups
                .iter()
                .map(|g| MyGroupAccessDto {
                    group_id: g.group_id.clone(),
                    is_owner: g.grant.is_owner,
                    doc_perms: a.doc_perms_in(&g.group_id),
                    user_perms: a.user_perms_in_group(&g.group_id),
                })
                .collect(),
        }
    }

    fn ws_dto(w: &WorkspaceDoc, owner: Option<UserSummary>, me: Option<MyAccessDto>) -> WorkspaceDto {
        WorkspaceDto {
            id: w.id.clone(),
            code: w.code.clone(),
            name: w.name.clone(),
            description: w.description.clone(),
            owner_id: w.owner_id.clone(),
            owner,
            allow_public: w.allow_public,
            created_at: w.created_at.to_chrono(),
            me,
        }
    }

    // ------------------------------------------------------------ workspace

    pub async fn list_mine(&self, p: &Principal) -> AppResult<Vec<WorkspaceDto>> {
        let ms: Vec<MembershipDoc> = self.c.memberships.find(doc! { "user_id": &p.user_id }).await?.try_collect().await?;
        let mut ids: Vec<WorkspaceId> = ms.iter().map(|m| m.workspace_id.clone()).collect();
        ids.sort();
        ids.dedup();
        let list: Vec<WorkspaceDoc> = self
            .c
            .workspaces
            .find(doc! { "$or": [ { "_id": { "$in": &ids } }, { "owner_id": &p.user_id } ] })
            .sort(doc! { "name": 1 })
            .await?
            .try_collect()
            .await?;
        let owners = self.summaries(list.iter().map(|w| w.owner_id.clone())).await?;
        Ok(list
            .iter()
            .map(|w| {
                let mine: Vec<MembershipDoc> = ms.iter().filter(|m| m.workspace_id == w.id).cloned().collect();
                let a = Self::build_access(w, &p.user_id, &mine);
                Self::ws_dto(w, owners.get(&w.owner_id).cloned(), Some(Self::my_access_dto(&a)))
            })
            .collect())
    }

    /// Danh bạ workspace: mọi người dùng đã đăng nhập đều mở được ticket cho dự án (desc §4.4),
    /// nên cần biết có những dự án nào. Chỉ trả mã và tên.
    pub async fn directory(&self, _p: &Principal) -> AppResult<Vec<DirectoryEntryDto>> {
        let list: Vec<WorkspaceDoc> = self.c.workspaces.find(doc! {}).sort(doc! { "code": 1 }).await?.try_collect().await?;
        Ok(list.into_iter().map(|w| DirectoryEntryDto { id: w.id, code: w.code, name: w.name }).collect())
    }

    pub async fn create(&self, p: &Principal, input: CreateWorkspace) -> AppResult<WorkspaceDto> {
        if self.settings.creation == WorkspaceCreation::Admin && !p.is_admin() {
            return Err(AppError::forbidden("workspace.create_admin_only", "Chỉ quản trị hệ thống được tạo workspace"));
        }
        let now = now_bson();
        let ws = WorkspaceDoc {
            id: WorkspaceId::new(),
            code: codes::workspace_code(&input.code)?,
            name: clean_text(&input.name, "Tên workspace", 120)?,
            description: clean_desc(&input.description)?,
            owner_id: p.user_id.clone(),
            allow_public: true,
            created_at: now,
            updated_at: now,
        };
        let gname = clean_text(input.default_group_name.as_deref().unwrap_or("Chung"), "Tên group", 80)?;
        let group = GroupDoc {
            id: GroupId::new(),
            workspace_id: ws.id.clone(),
            name_key: gname.to_lowercase(),
            name: gname,
            description: String::new(),
            owner_id: p.user_id.clone(),
            created_at: now,
        };
        let m_ws = owner_membership(&ws.id, &p.user_id, ScopeType::Workspace, ws.id.as_str());
        let m_group = owner_membership(&ws.id, &p.user_id, ScopeType::Group, group.id.as_str());
        let event = DomainEvent::new(kinds::WORKSPACE_CREATED, "workspace", ws.id.as_str())
            .workspace(&ws.id)
            .actor(&p.user_id)
            .data(json!({ "code": ws.code, "name": ws.name, "default_group": group.name }))
            .audit();
        let c = self.c.clone();
        let (w2, g2) = (ws.clone(), group.clone());
        with_txn(self.mongo.client(), move |s| {
            let (c, ws, group, m_ws, m_group, event) = (c.clone(), w2.clone(), g2.clone(), m_ws.clone(), m_group.clone(), event.clone());
            Box::pin(async move {
                c.workspaces.insert_one(&ws).session(&mut *s).await?;
                c.groups.insert_one(&group).session(&mut *s).await?;
                c.memberships.insert_many([&m_ws, &m_group]).session(&mut *s).await?;
                c.bus.publish_in(s, event).await
            })
        })
        .await
        .map_err(|e| {
            if is_duplicate_key_app(&e) {
                AppError::conflict("workspace.code_taken", format!("Mã dự án “{}” đã được dùng", ws.code))
            } else {
                e
            }
        })?;
        self.get(p, &ws.id).await
    }

    pub async fn get(&self, p: &Principal, ws: &WorkspaceId) -> AppResult<WorkspaceDto> {
        let (w, a) = self.member_access(p, ws).await?;
        let owner = self.identity.user(&w.owner_id).await?;
        Ok(Self::ws_dto(&w, owner, Some(Self::my_access_dto(&a))))
    }

    pub async fn update(&self, p: &Principal, ws: &WorkspaceId, input: UpdateWorkspace) -> AppResult<WorkspaceDto> {
        let (_, a) = self.member_access(p, ws).await?;
        Self::require_ws_owner(&a)?;
        let mut set = doc! { "updated_at": now_bson() };
        if let Some(v) = &input.name {
            set.insert("name", clean_text(v, "Tên workspace", 120)?);
        }
        if let Some(v) = &input.description {
            set.insert("description", clean_desc(v)?);
        }
        if let Some(v) = input.allow_public {
            set.insert("allow_public", v);
        }
        self.c.workspaces.update_one(doc! { "_id": ws }, doc! { "$set": set.clone() }).await?;
        set.remove("updated_at");
        self.c
            .bus
            .publish(
                DomainEvent::new(kinds::WORKSPACE_UPDATED, "workspace", ws.as_str())
                    .workspace(ws)
                    .actor(&p.user_id)
                    .data(serde_json::to_value(&set).unwrap_or_default())
                    .audit(),
            )
            .await?;
        self.get(p, ws).await
    }

    /// Chuyển quyền workspace owner (desc §3). Người nhận phải là thành viên; owner cũ trở thành thành viên
    /// thường ở phạm vi workspace (vẫn xem + nhận xét).
    pub async fn transfer(&self, p: &Principal, ws: &WorkspaceId, input: TransferOwnership) -> AppResult<WorkspaceDto> {
        let (w, a) = self.member_access(p, ws).await?;
        Self::require_ws_owner(&a)?;
        if input.user_id == w.owner_id {
            return Err(AppError::unprocessable("workspace.same_owner", "Người này đã là workspace owner"));
        }
        let target = self.access_of(&input.user_id, ws).await?.ok_or_else(not_found)?;
        if !target.is_member() {
            return Err(AppError::unprocessable("workspace.transfer_not_member", "Chỉ chuyển được cho người đang là thành viên workspace"));
        }
        let (c, old, new, wsid) = (self.c.clone(), w.owner_id.clone(), input.user_id.clone(), ws.clone());
        let event = DomainEvent::new(kinds::WORKSPACE_OWNERSHIP_TRANSFERRED, "workspace", ws.as_str())
            .workspace(ws)
            .actor(&p.user_id)
            .data(json!({ "from_user_id": old, "to_user_id": new, "workspace_name": w.name }))
            .notify([new.clone()])
            .audit();
        with_txn(self.mongo.client(), move |s| {
            let (c, old, new, wsid, event) = (c.clone(), old.clone(), new.clone(), wsid.clone(), event.clone());
            Box::pin(async move {
                c.workspaces
                    .update_one(doc! { "_id": &wsid }, doc! { "$set": { "owner_id": &new, "updated_at": now_bson() } })
                    .session(&mut *s)
                    .await?;
                c.memberships
                    .update_one(
                        doc! { "user_id": &old, "scope_type": "workspace", "scope_id": wsid.as_str() },
                        doc! { "$set": { "is_owner": false, "user_perms": bson::to_bson(&UserPerms::NONE)? } },
                    )
                    .session(&mut *s)
                    .await?;
                let existing = c
                    .memberships
                    .find_one(doc! { "user_id": &new, "scope_type": "workspace", "scope_id": wsid.as_str() })
                    .session(&mut *s)
                    .await?;
                match existing {
                    Some(m) => {
                        c.memberships
                            .update_one(
                                doc! { "_id": &m.id },
                                doc! { "$set": {
                                    "is_owner": true,
                                    "user_perms": bson::to_bson(&UserPerms::WORKSPACE_OWNER)?,
                                    "doc_perms": bson::to_bson(&m.doc_perms.union(DocPerms::WORKSPACE_OWNER))?,
                                } },
                            )
                            .session(&mut *s)
                            .await?;
                    }
                    None => {
                        let m = owner_membership(&wsid, &new, ScopeType::Workspace, wsid.as_str());
                        c.memberships.insert_one(&m).session(&mut *s).await?;
                    }
                }
                c.bus.publish_in(s, event).await
            })
        })
        .await?;
        self.get(p, ws).await
    }

    // ---------------------------------------------------------------- group

    pub async fn groups(&self, p: &Principal, ws: &WorkspaceId) -> AppResult<Vec<GroupDto>> {
        self.member_access(p, ws).await?;
        let list: Vec<GroupDoc> = self.c.groups.find(doc! { "workspace_id": ws }).sort(doc! { "name_key": 1 }).await?.try_collect().await?;
        let owners = self.summaries(list.iter().map(|g| g.owner_id.clone())).await?;
        let mut out = Vec::with_capacity(list.len());
        for g in &list {
            let n = self.c.memberships.count_documents(doc! { "scope_type": "group", "scope_id": g.id.as_str() }).await?;
            out.push(self.group_dto(g, owners.get(&g.owner_id).cloned(), n));
        }
        Ok(out)
    }

    fn group_dto(&self, g: &GroupDoc, owner: Option<UserSummary>, member_count: u64) -> GroupDto {
        GroupDto {
            id: g.id.clone(),
            workspace_id: g.workspace_id.clone(),
            name: g.name.clone(),
            description: g.description.clone(),
            owner_id: g.owner_id.clone(),
            owner,
            member_count,
            created_at: g.created_at.to_chrono(),
        }
    }

    /// Tạo group – chỉ workspace owner (người duy nhất có `assign_owner`, desc §4.1).
    pub async fn create_group(&self, p: &Principal, ws: &WorkspaceId, input: CreateGroup) -> AppResult<GroupDto> {
        let (_, a) = self.member_access(p, ws).await?;
        if !a.user_perms_in_workspace().assign_owner {
            return Err(AppError::forbidden("group.create_forbidden", "Chỉ workspace owner được tạo group và chỉ định group owner"));
        }
        let owner = input.owner_id.clone().unwrap_or_else(|| p.user_id.clone());
        let owner_access = self.access_of(&owner, ws).await?.ok_or_else(not_found)?;
        if owner != p.user_id && !owner_access.is_member() {
            return Err(AppError::unprocessable(
                "group.owner_not_member",
                "Group owner phải là thành viên của workspace – mời người này trước",
            ));
        }
        let name = clean_text(&input.name, "Tên group", 80)?;
        let g = GroupDoc {
            id: GroupId::new(),
            workspace_id: ws.clone(),
            name_key: name.to_lowercase(),
            name,
            description: clean_desc(&input.description)?,
            owner_id: owner.clone(),
            created_at: now_bson(),
        };
        let m = owner_membership(ws, &owner, ScopeType::Group, g.id.as_str());
        let event = DomainEvent::new(kinds::GROUP_CREATED, "group", g.id.as_str())
            .workspace(ws)
            .actor(&p.user_id)
            .data(json!({ "name": g.name, "owner_id": owner }))
            .notify([owner.clone()])
            .audit();
        let (c, g2) = (self.c.clone(), g.clone());
        with_txn(self.mongo.client(), move |s| {
            let (c, g, m, event) = (c.clone(), g2.clone(), m.clone(), event.clone());
            Box::pin(async move {
                c.groups.insert_one(&g).session(&mut *s).await?;
                c.memberships.insert_one(&m).session(&mut *s).await?;
                c.bus.publish_in(s, event).await
            })
        })
        .await
        .map_err(|e| {
            if is_duplicate_key_app(&e) {
                AppError::conflict("group.name_taken", "Workspace đã có group cùng tên")
            } else {
                e
            }
        })?;
        let owner_summary = self.identity.user(&owner).await?;
        Ok(self.group_dto(&g, owner_summary, 1))
    }

    pub async fn update_group(&self, p: &Principal, gid: &GroupId, input: UpdateGroup) -> AppResult<GroupDto> {
        let g = self.group_doc(gid).await?;
        let (_, a) = self.member_access(p, &g.workspace_id).await?;
        if !a.is_workspace_owner() && !a.is_group_owner(gid) {
            return Err(AppError::forbidden("group.update_forbidden", "Chỉ workspace owner hoặc group owner được sửa group"));
        }
        let mut set = doc! {};
        if let Some(n) = &input.name {
            let n = clean_text(n, "Tên group", 80)?;
            set.insert("name_key", n.to_lowercase());
            set.insert("name", n);
        }
        if let Some(d) = &input.description {
            set.insert("description", clean_desc(d)?);
        }
        if !set.is_empty() {
            self.c.groups.update_one(doc! { "_id": gid }, doc! { "$set": set.clone() }).await.map_err(|e| {
                if chillcat_platform::is_duplicate_key(&e) {
                    AppError::conflict("group.name_taken", "Workspace đã có group cùng tên")
                } else {
                    e.into()
                }
            })?;
            self.c
                .bus
                .publish(
                    DomainEvent::new(kinds::GROUP_UPDATED, "group", gid.as_str())
                        .workspace(&g.workspace_id)
                        .actor(&p.user_id)
                        .data(serde_json::to_value(&set).unwrap_or_default())
                        .audit(),
                )
                .await?;
        }
        let g = self.group_doc(gid).await?;
        let n = self.c.memberships.count_documents(doc! { "scope_type": "group", "scope_id": gid.as_str() }).await?;
        Ok(self.group_dto(&g, self.identity.user(&g.owner_id).await?, n))
    }

    /// Xoá group: chỉ workspace owner, chỉ khi group không còn tài liệu (tài liệu phải thuộc đúng một group).
    pub async fn delete_group(&self, p: &Principal, gid: &GroupId) -> AppResult<()> {
        let g = self.group_doc(gid).await?;
        let (_, a) = self.member_access(p, &g.workspace_id).await?;
        Self::require_ws_owner(&a)?;
        let docs = self.documents.get()?.count_in_group(gid).await?;
        if docs > 0 {
            return Err(AppError::conflict(
                "group.has_documents",
                format!("Group còn {docs} tài liệu – chuyển hoặc xoá tài liệu trước khi xoá group"),
            ));
        }
        if self.c.groups.count_documents(doc! { "workspace_id": &g.workspace_id }).await? <= 1 {
            return Err(AppError::conflict("group.last_group", "Workspace phải còn ít nhất một group"));
        }
        let (c, gid2, ws) = (self.c.clone(), gid.clone(), g.workspace_id.clone());
        let event = DomainEvent::new(kinds::GROUP_DELETED, "group", gid.as_str())
            .workspace(&ws)
            .actor(&p.user_id)
            .data(json!({ "name": g.name }))
            .audit();
        with_txn(self.mongo.client(), move |s| {
            let (c, gid, event) = (c.clone(), gid2.clone(), event.clone());
            Box::pin(async move {
                c.groups.delete_one(doc! { "_id": &gid }).session(&mut *s).await?;
                c.memberships.delete_many(doc! { "scope_type": "group", "scope_id": gid.as_str() }).session(&mut *s).await?;
                c.invitations
                    .update_many(
                        doc! { "scope_type": "group", "scope_id": gid.as_str(), "status": "pending" },
                        doc! { "$set": { "status": "revoked", "decided_at": now_bson() } },
                    )
                    .session(&mut *s)
                    .await?;
                c.bus.publish_in(s, event).await
            })
        })
        .await
    }

    /// Chỉ định group owner (desc §3: workspace owner chỉ định; mỗi group đúng một owner).
    /// Owner cũ ở lại group với quyền mặc định của thành viên.
    pub async fn assign_group_owner(&self, p: &Principal, gid: &GroupId, input: AssignGroupOwner) -> AppResult<GroupDto> {
        let g = self.group_doc(gid).await?;
        let (_, a) = self.member_access(p, &g.workspace_id).await?;
        if !a.user_perms_in_workspace().assign_owner {
            return Err(AppError::forbidden("group.assign_owner_forbidden", "Chỉ workspace owner được chỉ định group owner"));
        }
        if input.user_id == g.owner_id {
            return self.update_group(p, gid, UpdateGroup { name: None, description: None }).await;
        }
        let target = self.access_of(&input.user_id, &g.workspace_id).await?.ok_or_else(not_found)?;
        if !target.is_member() && input.user_id != p.user_id {
            return Err(AppError::unprocessable(
                "group.owner_not_member",
                "Group owner phải là thành viên của workspace – mời người này trước",
            ));
        }
        let (c, gid2, ws, old, new) = (self.c.clone(), gid.clone(), g.workspace_id.clone(), g.owner_id.clone(), input.user_id.clone());
        let event = DomainEvent::new(kinds::GROUP_OWNER_ASSIGNED, "group", gid.as_str())
            .workspace(&ws)
            .actor(&p.user_id)
            .data(json!({ "group_id": gid, "group_name": g.name, "from_user_id": old, "to_user_id": new }))
            .notify([new.clone(), old.clone()])
            .audit();
        with_txn(self.mongo.client(), move |s| {
            let (c, gid, ws, old, new, event) = (c.clone(), gid2.clone(), ws.clone(), old.clone(), new.clone(), event.clone());
            Box::pin(async move {
                // Bỏ owner cũ trước để không vi phạm chỉ mục "một owner mỗi group".
                c.memberships
                    .update_one(
                        doc! { "user_id": &old, "scope_type": "group", "scope_id": gid.as_str() },
                        doc! { "$set": {
                            "is_owner": false,
                            "user_perms": bson::to_bson(&UserPerms::NONE)?,
                            "doc_perms": bson::to_bson(&DocPerms::DEFAULT_MEMBER)?,
                        } },
                    )
                    .session(&mut *s)
                    .await?;
                let existing = c
                    .memberships
                    .find_one(doc! { "user_id": &new, "scope_type": "group", "scope_id": gid.as_str() })
                    .session(&mut *s)
                    .await?;
                match existing {
                    Some(m) => {
                        c.memberships
                            .update_one(
                                doc! { "_id": &m.id },
                                doc! { "$set": {
                                    "is_owner": true,
                                    "user_perms": bson::to_bson(&UserPerms::GROUP_OWNER)?,
                                    "doc_perms": bson::to_bson(&DocPerms::ALL)?,
                                } },
                            )
                            .session(&mut *s)
                            .await?;
                    }
                    None => {
                        let m = owner_membership(&ws, &new, ScopeType::Group, gid.as_str());
                        c.memberships.insert_one(&m).session(&mut *s).await?;
                    }
                }
                c.groups.update_one(doc! { "_id": &gid }, doc! { "$set": { "owner_id": &new } }).session(&mut *s).await?;
                c.bus.publish_in(s, event).await
            })
        })
        .await?;
        self.update_group(p, gid, UpdateGroup { name: None, description: None }).await
    }

    // ---------------------------------------------------------- hệ thống con

    pub async fn subsystems(&self, p: &Principal, ws: &WorkspaceId) -> AppResult<Vec<SubsystemDto>> {
        self.member_access(p, ws).await?;
        let list: Vec<SubsystemDoc> =
            self.c.subsystems.find(doc! { "workspace_id": ws }).sort(doc! { "code": 1 }).await?.try_collect().await?;
        Ok(list.iter().map(SubsystemDto::from).collect())
    }

    /// Danh mục hệ thống con (CONV §3.1) – workspace owner hoặc group owner được thêm.
    pub async fn create_subsystem(&self, p: &Principal, ws: &WorkspaceId, input: CreateSubsystem) -> AppResult<SubsystemDto> {
        let (_, a) = self.member_access(p, ws).await?;
        if !a.is_workspace_owner() && !a.groups.iter().any(|g| g.grant.is_owner) {
            return Err(AppError::forbidden("subsystem.forbidden", "Chỉ workspace owner hoặc group owner được thêm hệ thống con"));
        }
        let s = SubsystemDoc {
            id: SubsystemId::new(),
            workspace_id: ws.clone(),
            code: codes::subsystem_code(&input.code)?,
            name: clean_text(&input.name, "Tên hệ thống con", 120)?,
            description: clean_desc(&input.description)?,
            created_at: now_bson(),
        };
        self.c.subsystems.insert_one(&s).await.map_err(|e| {
            if chillcat_platform::is_duplicate_key(&e) {
                AppError::conflict("subsystem.code_taken", format!("Mã hệ thống con “{}” đã có trong workspace", s.code))
            } else {
                e.into()
            }
        })?;
        self.c
            .bus
            .publish(
                DomainEvent::new(kinds::SUBSYSTEM_CREATED, "subsystem", s.id.as_str())
                    .workspace(ws)
                    .actor(&p.user_id)
                    .data(json!({ "code": s.code, "name": s.name }))
                    .audit(),
            )
            .await?;
        Ok(SubsystemDto::from(&s))
    }

    async fn subsystem_doc(&self, id: &SubsystemId) -> AppResult<SubsystemDoc> {
        self.c
            .subsystems
            .find_one(doc! { "_id": id })
            .await?
            .ok_or_else(|| AppError::not_found("subsystem.not_found", "Không tìm thấy hệ thống con"))
    }

    /// Mã hệ thống con không đổi được (đã nằm trong mã tài liệu, mã truy vết); chỉ sửa tên, mô tả.
    pub async fn update_subsystem(&self, p: &Principal, id: &SubsystemId, input: UpdateSubsystem) -> AppResult<SubsystemDto> {
        let s = self.subsystem_doc(id).await?;
        let (_, a) = self.member_access(p, &s.workspace_id).await?;
        if !a.is_workspace_owner() && !a.groups.iter().any(|g| g.grant.is_owner) {
            return Err(AppError::forbidden("subsystem.forbidden", "Chỉ workspace owner hoặc group owner được sửa hệ thống con"));
        }
        let mut set = doc! {};
        if let Some(n) = &input.name {
            set.insert("name", clean_text(n, "Tên hệ thống con", 120)?);
        }
        if let Some(d) = &input.description {
            set.insert("description", clean_desc(d)?);
        }
        if !set.is_empty() {
            self.c.subsystems.update_one(doc! { "_id": id }, doc! { "$set": set.clone() }).await?;
            self.c
                .bus
                .publish(
                    DomainEvent::new(kinds::SUBSYSTEM_UPDATED, "subsystem", id.as_str())
                        .workspace(&s.workspace_id)
                        .actor(&p.user_id)
                        .data(serde_json::to_value(&set).unwrap_or_default())
                        .audit(),
                )
                .await?;
        }
        Ok(SubsystemDto::from(&self.subsystem_doc(id).await?))
    }

    pub async fn delete_subsystem(&self, p: &Principal, id: &SubsystemId) -> AppResult<()> {
        let s = self.subsystem_doc(id).await?;
        let (_, a) = self.member_access(p, &s.workspace_id).await?;
        Self::require_ws_owner(&a)?;
        let n = self.documents.get()?.count_with_subsystem(id).await?;
        if n > 0 {
            return Err(AppError::conflict("subsystem.in_use", format!("Hệ thống con đang có {n} tài liệu – không xoá được")));
        }
        self.c.subsystems.delete_one(doc! { "_id": id }).await?;
        self.c
            .bus
            .publish(
                DomainEvent::new(kinds::SUBSYSTEM_DELETED, "subsystem", id.as_str())
                    .workspace(&s.workspace_id)
                    .actor(&p.user_id)
                    .data(json!({ "code": s.code, "name": s.name }))
                    .audit(),
            )
            .await
    }
}
