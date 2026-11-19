//! Ticket, quyền xem / xử lý, uỷ quyền (desc §4.4, §5.4, §9.6).

use crate::ai::ClaudeClient;
use crate::model::*;
use bson::{doc, Bson, Document};
use chillcat_kernel::contracts::*;
use chillcat_kernel::events::kinds;
use chillcat_kernel::*;
use chillcat_platform::mongo::{ensure_indexes, index, now_bson, with_txn};
use chillcat_platform::{EventBus, Mongo};
use futures::TryStreamExt;
use mongodb::options::ReturnDocument;
use mongodb::{Collection, Database};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

#[derive(Clone)]
pub(crate) struct Colls {
    pub tickets: Collection<TicketDoc>,
    pub counters: Collection<Document>,
    pub grants: Collection<GrantDoc>,
    pub delegations: Collection<DelegationDoc>,
    pub ai_delegations: Collection<AiDelegationDoc>,
    pub checks: Collection<CheckDoc>,
    pub candidates: Collection<CandidateDoc>,
    pub proposals: Collection<ProposalDoc>,
    pub activity: Collection<ActivityDoc>,
}

pub struct TicketService {
    pub(crate) mongo: Mongo,
    pub(crate) c: Colls,
    pub(crate) bus: EventBus,
    pub(crate) access: Arc<dyn AccessApi>,
    pub(crate) identity: Arc<dyn IdentityApi>,
    pub(crate) documents: Arc<dyn DocumentsApi>,
    pub(crate) trace: Arc<dyn TraceApi>,
    pub(crate) ai: Option<ClaudeClient>,
}

pub(crate) fn not_found() -> AppError {
    AppError::not_found("ticket.not_found", "Không tìm thấy ticket, hoặc bạn không được xem")
}

fn opt_text(v: Option<String>, max: usize) -> AppResult<Option<String>> {
    match v.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty()) {
        Some(s) if s.chars().count() > max => Err(AppError::unprocessable("ticket.too_long", format!("Mỗi mục tối đa {max} ký tự"))),
        other => Ok(other),
    }
}

/// Quyền ticket của một người trong một workspace, tính từ các quyền đã cấp (desc §9.6).
pub struct TicketAccess {
    pub user: UserId,
    pub ws: WorkspaceAccess,
    pub grants: Vec<GrantDoc>,
    pub delegation: Option<DelegationDoc>,
}

impl TicketAccess {
    fn subject_matches(&self, g: &GrantDoc) -> bool {
        match g.subject_type {
            SubjectType::User => g.subject_id == self.user.as_str(),
            SubjectType::Group => self.ws.is_group_member(&GroupId::from(g.subject_id.clone())),
        }
    }

    /// Có quyền `kind` với ticket gắn `group` (ticket không gắn group chỉ xét quyền cấp workspace).
    pub fn has(&self, kind: GrantKind, group: Option<&GroupId>) -> bool {
        self.grants.iter().any(|g| {
            g.kind == kind
                && self.subject_matches(g)
                && match g.scope_type {
                    ScopeType::Workspace => true,
                    ScopeType::Group => group.is_some_and(|gr| gr.as_str() == g.scope_id),
                }
        })
    }

    pub fn can_view(&self, t: &TicketDoc) -> bool {
        t.author_id == self.user || self.has(GrantKind::View, t.group_id.as_ref())
    }

    /// Xử lý cần cả quyền xem và quyền xử lý.
    pub fn can_process(&self, t: &TicketDoc) -> bool {
        self.has(GrantKind::View, t.group_id.as_ref()) && self.has(GrantKind::Process, t.group_id.as_ref())
    }

    /// Bộ lọc MongoDB cho những ticket người này được xem trong workspace.
    pub fn view_filter(&self) -> Document {
        let ws_wide =
            self.grants.iter().any(|g| g.kind == GrantKind::View && g.scope_type == ScopeType::Workspace && self.subject_matches(g));
        if ws_wide {
            return doc! { "workspace_id": &self.ws.workspace.id };
        }
        let groups: Vec<String> = self
            .grants
            .iter()
            .filter(|g| g.kind == GrantKind::View && g.scope_type == ScopeType::Group && self.subject_matches(g))
            .map(|g| g.scope_id.clone())
            .collect();
        doc! { "workspace_id": &self.ws.workspace.id, "$or": [ { "author_id": &self.user }, { "group_id": { "$in": groups } } ] }
    }

    pub fn can_decide(&self, kind: GrantKind) -> bool {
        self.ws.is_workspace_owner()
            || self.delegation.as_ref().is_some_and(|d| match kind {
                GrantKind::View => d.can_decide_view,
                GrantKind::Process => d.can_decide_process,
            })
    }

    pub fn has_any(&self, kind: GrantKind) -> bool {
        self.grants.iter().any(|g| g.kind == kind && self.subject_matches(g))
    }
}

impl TicketService {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        mongo: Mongo,
        db: &Database,
        bus: EventBus,
        access: Arc<dyn AccessApi>,
        identity: Arc<dyn IdentityApi>,
        documents: Arc<dyn DocumentsApi>,
        trace: Arc<dyn TraceApi>,
        ai: Option<ClaudeClient>,
    ) -> Self {
        TicketService {
            mongo,
            c: Colls {
                tickets: db.collection("tickets"),
                counters: db.collection("ticket_counters"),
                grants: db.collection("ticket_grants"),
                delegations: db.collection("ticket_access_delegations"),
                ai_delegations: db.collection("ticket_ai_delegations"),
                checks: db.collection("ticket_ai_checks"),
                candidates: db.collection("ticket_duplicate_candidates"),
                proposals: db.collection("ticket_document_proposals"),
                activity: db.collection("ticket_activity"),
            },
            bus,
            access,
            identity,
            documents,
            trace,
            ai,
        }
    }

    pub async fn ensure_indexes(&self) -> AppResult<()> {
        ensure_indexes(
            &self.c.tickets,
            vec![
                index::unique("tickets_ws_number", doc! { "workspace_id": 1, "number": 1 }),
                index::plain("tickets_author", doc! { "author_id": 1 }),
                index::plain("tickets_ws_group", doc! { "workspace_id": 1, "group_id": 1 }),
                index::text("tickets_text", &["title", "body"]),
            ],
        )
        .await?;
        ensure_indexes(&self.c.grants, vec![index::plain("grants_ws", doc! { "workspace_id": 1, "revoked_at": 1 })]).await?;
        ensure_indexes(
            &self.c.delegations,
            vec![index::unique_partial(
                "delegations_active",
                doc! { "workspace_id": 1, "delegate_user_id": 1 },
                doc! { "revoked_at": { "$type": "null" } },
            )],
        )
        .await?;
        ensure_indexes(
            &self.c.ai_delegations,
            vec![index::unique_partial(
                "ai_delegations_active",
                doc! { "workspace_id": 1, "user_id": 1 },
                doc! { "revoked_at": { "$type": "null" } },
            )],
        )
        .await?;
        ensure_indexes(&self.c.checks, vec![index::plain("checks_ticket", doc! { "ticket_id": 1, "_id": -1 })]).await?;
        ensure_indexes(&self.c.candidates, vec![index::plain("candidates_ticket", doc! { "ticket_id": 1 })]).await?;
        ensure_indexes(
            &self.c.proposals,
            vec![
                index::plain("proposals_ticket", doc! { "ticket_id": 1 }),
                index::plain("proposals_draft", doc! { "draft_version_id": 1 }),
            ],
        )
        .await?;
        ensure_indexes(&self.c.activity, vec![index::plain("activity_ticket", doc! { "ticket_id": 1, "_id": 1 })]).await
    }

    // ------------------------------------------------------------- quyền

    pub(crate) async fn ticket_access(&self, user: &UserId, ws: &WorkspaceId) -> AppResult<TicketAccess> {
        let wsa = self
            .access
            .workspace_access(user, ws)
            .await?
            .ok_or_else(|| AppError::not_found("workspace.not_found", "Không tìm thấy workspace"))?;
        let grants: Vec<GrantDoc> = self.c.grants.find(doc! { "workspace_id": ws, "revoked_at": Bson::Null }).await?.try_collect().await?;
        let delegation =
            self.c.delegations.find_one(doc! { "workspace_id": ws, "delegate_user_id": user, "revoked_at": Bson::Null }).await?;
        Ok(TicketAccess { user: user.clone(), ws: wsa, grants, delegation })
    }

    pub(crate) async fn ticket(&self, id: &TicketId) -> AppResult<TicketDoc> {
        self.c.tickets.find_one(doc! { "_id": id }).await?.ok_or_else(not_found)
    }

    /// Ticket và quyền của người gọi; 404 nếu không được xem.
    pub(crate) async fn viewable(&self, p: &Principal, id: &TicketId) -> AppResult<(TicketDoc, TicketAccess)> {
        let t = self.ticket(id).await?;
        let a = self.ticket_access(&p.user_id, &t.workspace_id).await?;
        if !a.can_view(&t) {
            return Err(not_found());
        }
        Ok((t, a))
    }

    pub(crate) async fn processable(&self, p: &Principal, id: &TicketId) -> AppResult<(TicketDoc, TicketAccess)> {
        let (t, a) = self.viewable(p, id).await?;
        if !a.can_process(&t) {
            return Err(AppError::forbidden("ticket.process_forbidden", "Bạn không có quyền xử lý ticket này"));
        }
        Ok((t, a))
    }

    /// Những người hiện có quyền xem + xử lý ticket (người nhận thông báo).
    pub(crate) async fn processors_of(&self, t: &TicketDoc) -> AppResult<Vec<UserId>> {
        let grants: Vec<GrantDoc> =
            self.c.grants.find(doc! { "workspace_id": &t.workspace_id, "revoked_at": Bson::Null }).await?.try_collect().await?;
        let mut candidates: HashSet<UserId> = HashSet::new();
        for g in grants.iter().filter(|g| g.kind == GrantKind::Process) {
            match g.subject_type {
                SubjectType::User => {
                    candidates.insert(UserId::from(g.subject_id.clone()));
                }
                SubjectType::Group => candidates.extend(self.access.group_member_ids(&GroupId::from(g.subject_id.clone())).await?),
            }
        }
        let mut out = Vec::new();
        for u in candidates {
            if self.ticket_access(&u, &t.workspace_id).await?.can_process(t) {
                out.push(u);
            }
        }
        Ok(out)
    }

    /// Một dòng dòng thời gian của ticket (ghi bằng [`Self::log`], hoặc chèn trong transaction cùng thay đổi).
    pub(crate) fn activity(ticket: &TicketId, actor: Option<&UserId>, action: &str, text: String) -> ActivityDoc {
        ActivityDoc {
            id: EventId::new(),
            ticket_id: ticket.clone(),
            actor_id: actor.cloned(),
            action: action.to_owned(),
            text,
            created_at: now_bson(),
        }
    }

    pub(crate) async fn log(&self, ticket: &TicketId, actor: Option<&UserId>, action: &str, text: String) -> AppResult<()> {
        self.c.activity.insert_one(Self::activity(ticket, actor, action, text)).await?;
        Ok(())
    }

    fn ref_dto(t: &TicketDoc) -> TicketRefDto {
        TicketRefDto { id: t.id.clone(), number: t.number, title: t.title.clone(), status: t.status }
    }

    pub(crate) async fn dto(&self, t: &TicketDoc, a: &TicketAccess) -> AppResult<TicketDto> {
        let users =
            self.identity.users(&[Some(t.author_id.clone()), t.assignee_id.clone()].into_iter().flatten().collect::<Vec<_>>()).await?;
        let (dup, hidden) = match &t.duplicate_of_ticket_id {
            Some(o) => match self.c.tickets.find_one(doc! { "_id": o }).await? {
                Some(orig) if a.can_view(&orig) => (Some(Self::ref_dto(&orig)), false),
                _ => (None, true),
            },
            None => (None, false),
        };
        let process = a.can_process(t);
        Ok(TicketDto {
            id: t.id.clone(),
            workspace_id: t.workspace_id.clone(),
            workspace_code: Some(a.ws.workspace.code.clone()),
            number: t.number,
            group_id: t.group_id.clone(),
            author: users.get(&t.author_id).cloned(),
            author_id: t.author_id.clone(),
            assignee: t.assignee_id.as_ref().and_then(|u| users.get(u).cloned()),
            assignee_id: t.assignee_id.clone(),
            kind: t.kind,
            title: t.title.clone(),
            body: t.body.clone(),
            reproduction_steps: t.reproduction_steps.clone(),
            actual_result: t.actual_result.clone(),
            expected_result: t.expected_result.clone(),
            environment: t.environment.clone(),
            software_version: t.software_version.clone(),
            status: t.status,
            status_label: t.status.label_vi(),
            duplicate_of: dup,
            duplicate_of_hidden: hidden,
            created_at: t.created_at.to_chrono(),
            updated_at: t.updated_at.to_chrono(),
            capabilities: TicketCaps {
                view: true,
                process,
                edit: process || (t.author_id == a.user && t.status == TicketStatus::New),
                run_ai: process,
            },
        })
    }

    // ------------------------------------------------------------- ticket

    /// Mở ticket: mọi người dùng đã đăng nhập, kể cả chưa là thành viên workspace (desc §4.4).
    pub async fn create(&self, p: &Principal, ws: &WorkspaceId, input: CreateTicket) -> AppResult<TicketDetailDto> {
        let workspace =
            self.access.workspace(ws).await?.ok_or_else(|| AppError::not_found("workspace.not_found", "Không tìm thấy workspace"))?;
        let title = input.title.split_whitespace().collect::<Vec<_>>().join(" ");
        if title.is_empty() || title.chars().count() > 200 {
            return Err(AppError::unprocessable("ticket.invalid_title", "Tiêu đề không được trống, tối đa 200 ký tự"));
        }
        let body = input.body.trim().to_owned();
        if body.is_empty() || body.chars().count() > 20_000 {
            return Err(AppError::unprocessable("ticket.invalid_body", "Mô tả không được trống, tối đa 20 000 ký tự"));
        }
        if let Some(g) = &input.group_id {
            if !self.access.group(g).await?.is_some_and(|gr| gr.workspace_id == *ws) {
                return Err(AppError::unprocessable("ticket.invalid_group", "Group không thuộc workspace này"));
            }
        }
        let counter = self
            .c
            .counters
            .find_one_and_update(doc! { "_id": ws }, doc! { "$inc": { "seq": 1i64 } })
            .upsert(true)
            .return_document(ReturnDocument::After)
            .await?
            .ok_or_else(|| AppError::internal("Không cấp được số ticket"))?;
        let number = counter.get_i64("seq").or_else(|_| counter.get_i32("seq").map(i64::from)).unwrap_or(1);
        let now = now_bson();
        let is_bug = input.kind == TicketKind::Bug;
        let t = TicketDoc {
            id: TicketId::new(),
            workspace_id: ws.clone(),
            number,
            group_id: input.group_id,
            author_id: p.user_id.clone(),
            assignee_id: None,
            kind: input.kind,
            title,
            body,
            reproduction_steps: if is_bug { opt_text(input.reproduction_steps, 10_000)? } else { None },
            actual_result: if is_bug { opt_text(input.actual_result, 5_000)? } else { None },
            expected_result: if is_bug { opt_text(input.expected_result, 5_000)? } else { None },
            environment: opt_text(input.environment, 1_000)?,
            software_version: opt_text(input.software_version, 200)?,
            status: TicketStatus::New,
            duplicate_of_ticket_id: None,
            created_at: now,
            updated_at: now,
        };
        self.c.tickets.insert_one(&t).await?;
        self.log(&t.id, Some(&p.user_id), "created", format!("Mở ticket #{number}")).await?;
        let notify = self.processors_of(&t).await?;
        self.bus
            .publish(
                DomainEvent::new(kinds::TICKET_CREATED, "ticket", t.id.as_str())
                    .workspace(ws)
                    .actor(&p.user_id)
                    .data(json!({ "ticket_id": t.id, "number": number, "title": t.title, "kind": t.kind, "group_id": t.group_id, "workspace_code": workspace.code }))
                    .notify(notify)
                    .audit(),
            )
            .await?;
        self.detail(p, &t.id).await
    }

    pub async fn list(&self, p: &Principal, ws: &WorkspaceId, q: TicketQuery) -> AppResult<Vec<TicketDto>> {
        let a = self.ticket_access(&p.user_id, ws).await?;
        let mut filter = if q.mine {
            doc! { "workspace_id": ws, "author_id": &p.user_id }
        } else {
            a.view_filter()
        };
        if let Some(s) = q.status {
            filter.insert("status", bson::to_bson(&s)?);
        }
        if let Some(k) = q.kind {
            filter.insert("kind", bson::to_bson(&k)?);
        }
        if let Some(text) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            if let Ok(n) = text.trim_start_matches('#').parse::<i64>() {
                filter.insert("number", n);
            } else {
                filter.insert("$text", doc! { "$search": text });
            }
        }
        let list: Vec<TicketDoc> = self.c.tickets.find(filter).sort(doc! { "number": -1 }).limit(500).await?.try_collect().await?;
        let mut out = Vec::with_capacity(list.len());
        for t in list.iter().filter(|t| a.can_view(t)) {
            out.push(self.dto(t, &a).await?);
        }
        Ok(out)
    }

    /// Ticket do chính mình gửi, ở mọi workspace (người ngoài workspace theo dõi ticket của mình).
    pub async fn mine(&self, p: &Principal) -> AppResult<Vec<TicketDto>> {
        let list: Vec<TicketDoc> =
            self.c.tickets.find(doc! { "author_id": &p.user_id }).sort(doc! { "_id": -1 }).limit(200).await?.try_collect().await?;
        let mut cache: HashMap<WorkspaceId, TicketAccess> = HashMap::new();
        let mut out = Vec::new();
        for t in &list {
            if !cache.contains_key(&t.workspace_id) {
                cache.insert(t.workspace_id.clone(), self.ticket_access(&p.user_id, &t.workspace_id).await?);
            }
            out.push(self.dto(t, &cache[&t.workspace_id]).await?);
        }
        Ok(out)
    }

    pub async fn update(&self, p: &Principal, id: &TicketId, input: UpdateTicket) -> AppResult<TicketDetailDto> {
        let (t, a) = self.viewable(p, id).await?;
        let process = a.can_process(&t);
        if !process && !(t.author_id == p.user_id && t.status == TicketStatus::New) {
            return Err(AppError::forbidden("ticket.edit_forbidden", "Chỉ người gửi (khi ticket còn Mới) hoặc người xử lý được sửa"));
        }
        // Chỉ ghi những trường thực sự đổi; không đổi gì thì không ghi và không sinh sự kiện (gọi lại vô hại).
        let mut set = doc! {};
        let mut fields: Vec<&str> = Vec::new();
        if let Some(v) = input.title {
            let v = v.split_whitespace().collect::<Vec<_>>().join(" ");
            if v.is_empty() || v.chars().count() > 200 {
                return Err(AppError::unprocessable("ticket.invalid_title", "Tiêu đề không được trống, tối đa 200 ký tự"));
            }
            if v != t.title {
                set.insert("title", v);
                fields.push("title");
            }
        }
        if let Some(v) = input.body {
            let v = v.trim().to_owned();
            if v.is_empty() || v.chars().count() > 20_000 {
                return Err(AppError::unprocessable("ticket.invalid_body", "Mô tả không được trống, tối đa 20 000 ký tự"));
            }
            if v != t.body {
                set.insert("body", v);
                fields.push("body");
            }
        }
        for (k, v, max, cur) in [
            ("reproduction_steps", input.reproduction_steps, 10_000, &t.reproduction_steps),
            ("actual_result", input.actual_result, 5_000, &t.actual_result),
            ("expected_result", input.expected_result, 5_000, &t.expected_result),
            ("environment", input.environment, 1_000, &t.environment),
            ("software_version", input.software_version, 200, &t.software_version),
        ] {
            if v.is_some() {
                let v = opt_text(v, max)?;
                if &v != cur {
                    set.insert(k, v);
                    fields.push(k);
                }
            }
        }
        if let Some(g) = input.group_id {
            if !process {
                return Err(AppError::forbidden("ticket.edit_forbidden", "Chỉ người xử lý được đổi group của ticket"));
            }
            let gid = if g.is_empty() {
                None
            } else {
                let gid = GroupId::from(g);
                if !self.access.group(&gid).await?.is_some_and(|gr| gr.workspace_id == t.workspace_id) {
                    return Err(AppError::unprocessable("ticket.invalid_group", "Group không thuộc workspace này"));
                }
                Some(gid)
            };
            if gid != t.group_id {
                set.insert("group_id", gid.map(Bson::from).unwrap_or(Bson::Null));
                fields.push("group_id");
            }
        }
        if fields.is_empty() {
            return self.detail(p, id).await;
        }
        set.insert("updated_at", now_bson());
        let title = set.get_str("title").map(str::to_owned).unwrap_or_else(|_| t.title.clone());
        let event = DomainEvent::new(kinds::TICKET_UPDATED, "ticket", id.as_str())
            .workspace(&t.workspace_id)
            .actor(&p.user_id)
            .data(json!({ "ticket_id": id, "number": t.number, "title": title, "fields": fields }))
            .audit();
        let act = Self::activity(id, Some(&p.user_id), "updated", "Sửa nội dung ticket".into());
        let (c, bus, tid) = (self.c.clone(), self.bus.clone(), id.clone());
        with_txn(self.mongo.client(), move |s| {
            let (c, bus, tid, set, act, event) = (c.clone(), bus.clone(), tid.clone(), set.clone(), act.clone(), event.clone());
            Box::pin(async move {
                c.tickets.update_one(doc! { "_id": &tid }, doc! { "$set": set }).session(&mut *s).await?;
                c.activity.insert_one(&act).session(&mut *s).await?;
                bus.publish_in(s, event).await
            })
        })
        .await?;
        self.detail(p, id).await
    }

    pub async fn change_status(&self, p: &Principal, id: &TicketId, input: ChangeStatus) -> AppResult<TicketDetailDto> {
        let (t, _) = self.processable(p, id).await?;
        if !t.status.can_move_to(input.status) {
            return Err(AppError::conflict(
                "ticket.invalid_transition",
                format!("Không chuyển được từ “{}” sang “{}”", t.status.label_vi(), input.status.label_vi()),
            ));
        }
        let mut set = doc! { "status": bson::to_bson(&input.status)?, "updated_at": now_bson() };
        if t.status == TicketStatus::Duplicate {
            set.insert("duplicate_of_ticket_id", Bson::Null);
        }
        let r = self.c.tickets.update_one(doc! { "_id": id, "status": bson::to_bson(&t.status)? }, doc! { "$set": set }).await?;
        if r.modified_count == 0 {
            return Err(AppError::conflict("ticket.concurrent_change", "Ticket vừa được người khác cập nhật – tải lại"));
        }
        let note = input.note.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(str::to_owned);
        let text = match &note {
            Some(n) => format!("{} → {}: {n}", t.status.label_vi(), input.status.label_vi()),
            None => format!("{} → {}", t.status.label_vi(), input.status.label_vi()),
        };
        self.log(id, Some(&p.user_id), "status", text).await?;
        let notify: Vec<UserId> = [Some(t.author_id.clone()), t.assignee_id.clone()].into_iter().flatten().collect();
        self.bus
            .publish(
                DomainEvent::new(kinds::TICKET_STATUS_CHANGED, "ticket", id.as_str())
                    .workspace(&t.workspace_id)
                    .actor(&p.user_id)
                    .data(json!({ "ticket_id": id, "number": t.number, "title": t.title, "from": t.status, "to": input.status, "note": note }))
                    .notify(notify)
                    .audit(),
            )
            .await?;
        self.detail(p, id).await
    }

    pub async fn assign(&self, p: &Principal, id: &TicketId, input: Assign) -> AppResult<TicketDetailDto> {
        let (t, _) = self.processable(p, id).await?;
        if let Some(u) = &input.user_id {
            if !self.ticket_access(u, &t.workspace_id).await?.can_process(&t) {
                return Err(AppError::unprocessable("ticket.assignee_no_access", "Người được giao phải có quyền xem và xử lý ticket này"));
            }
        }
        let value = input.user_id.clone().map(Bson::from).unwrap_or(Bson::Null);
        self.c.tickets.update_one(doc! { "_id": id }, doc! { "$set": { "assignee_id": value, "updated_at": now_bson() } }).await?;
        let name = match &input.user_id {
            Some(u) => self.identity.user(u).await?.map(|s| s.display_name).unwrap_or_default(),
            None => "không ai".into(),
        };
        self.log(id, Some(&p.user_id), "assigned", format!("Giao cho {name}")).await?;
        self.bus
            .publish(
                DomainEvent::new(kinds::TICKET_ASSIGNED, "ticket", id.as_str())
                    .workspace(&t.workspace_id)
                    .actor(&p.user_id)
                    .data(json!({ "ticket_id": id, "number": t.number, "title": t.title, "assignee_id": input.user_id }))
                    .notify(input.user_id.clone())
                    .audit(),
            )
            .await?;
        self.detail(p, id).await
    }

    /// Đánh dấu trùng: cùng workspace, không trỏ chính nó, không tạo vòng; người xử lý phải xem được ticket gốc.
    pub(crate) async fn set_duplicate(&self, p: &Principal, t: &TicketDoc, a: &TicketAccess, original: &TicketId) -> AppResult<()> {
        if original == &t.id {
            return Err(AppError::unprocessable("ticket.self_duplicate", "Ticket không thể trùng với chính nó"));
        }
        let orig = self.ticket(original).await?;
        if orig.workspace_id != t.workspace_id || !a.can_view(&orig) {
            return Err(AppError::unprocessable("ticket.invalid_original", "Ticket gốc phải cùng workspace và bạn phải xem được"));
        }
        let mut cur = orig.duplicate_of_ticket_id.clone();
        for _ in 0..100 {
            let Some(c) = cur else { break };
            if c == t.id {
                return Err(AppError::unprocessable("ticket.duplicate_cycle", "Liên kết trùng này tạo vòng"));
            }
            cur = self.c.tickets.find_one(doc! { "_id": &c }).await?.and_then(|x| x.duplicate_of_ticket_id);
        }
        self.c
            .tickets
            .update_one(
                doc! { "_id": &t.id },
                doc! { "$set": { "status": "duplicate", "duplicate_of_ticket_id": original, "updated_at": now_bson() } },
            )
            .await?;
        self.log(&t.id, Some(&p.user_id), "duplicate", format!("Đánh dấu trùng với #{}", orig.number)).await?;
        self.bus
            .publish(
                DomainEvent::new(kinds::TICKET_STATUS_CHANGED, "ticket", t.id.as_str())
                    .workspace(&t.workspace_id)
                    .actor(&p.user_id)
                    .data(json!({ "ticket_id": t.id, "number": t.number, "title": t.title, "from": t.status, "to": "duplicate" }))
                    .notify([t.author_id.clone()])
                    .audit(),
            )
            .await
    }

    pub async fn mark_duplicate(&self, p: &Principal, id: &TicketId, input: MarkDuplicate) -> AppResult<TicketDetailDto> {
        let (t, a) = self.processable(p, id).await?;
        self.set_duplicate(p, &t, &a, &input.original_ticket_id).await?;
        self.detail(p, id).await
    }

    /// Xác nhận / bác bỏ một ứng viên trùng do AI đề xuất. AI không tự đóng hay gộp ticket.
    pub async fn decide_candidate(&self, p: &Principal, id: &DuplicateCandidateId, input: Decide) -> AppResult<TicketDetailDto> {
        let c = self
            .c
            .candidates
            .find_one(doc! { "_id": id })
            .await?
            .ok_or_else(|| AppError::not_found("ticket.candidate_not_found", "Không tìm thấy ứng viên"))?;
        let (t, a) = self.processable(p, &c.ticket_id).await?;
        let decision = match input.decision.as_str() {
            "confirmed" => CandidateDecision::Confirmed,
            "rejected" => CandidateDecision::Rejected,
            _ => return Err(AppError::bad_request("ticket.invalid_decision", "decision phải là confirmed hoặc rejected")),
        };
        if decision == CandidateDecision::Confirmed {
            self.set_duplicate(p, &t, &a, &c.candidate_ticket_id).await?;
        } else {
            self.log(&t.id, Some(&p.user_id), "candidate_rejected", "Bác bỏ một kết quả nghi trùng".into()).await?;
        }
        self.c
            .candidates
            .update_one(
                doc! { "_id": id },
                doc! { "$set": { "decision": bson::to_bson(&decision)?, "decided_by": &p.user_id, "decided_at": now_bson() } },
            )
            .await?;
        self.bus
            .publish(
                DomainEvent::new(kinds::TICKET_DUPLICATE_DECIDED, "ticket", t.id.as_str())
                    .workspace(&t.workspace_id)
                    .actor(&p.user_id)
                    .data(json!({ "ticket_id": t.id, "candidate_ticket_id": c.candidate_ticket_id, "decision": decision }))
                    .audit(),
            )
            .await?;
        self.detail(p, &t.id).await
    }

    pub async fn detail(&self, p: &Principal, id: &TicketId) -> AppResult<TicketDetailDto> {
        let (t, a) = self.viewable(p, id).await?;
        let ticket = self.dto(&t, &a).await?;
        let process = a.can_process(&t);
        // Kết quả AI chỉ cho người xử lý (người gửi không mặc nhiên thấy ticket khác hay tài liệu).
        let (checks, (proposals, hidden_proposals)) =
            if process { (self.checks_for(&t, &a).await?, self.proposals_for(p, &t).await?) } else { (vec![], (vec![], 0)) };
        let acts: Vec<ActivityDoc> = self.c.activity.find(doc! { "ticket_id": id }).sort(doc! { "_id": 1 }).await?.try_collect().await?;
        let users = self.identity.users(&acts.iter().filter_map(|x| x.actor_id.clone()).collect::<Vec<_>>()).await?;
        Ok(TicketDetailDto {
            ticket,
            checks,
            proposals,
            hidden_proposals,
            activity: acts
                .into_iter()
                .map(|x| ActivityDto {
                    actor: x.actor_id.as_ref().and_then(|u| users.get(u).cloned()),
                    action: x.action,
                    text: x.text,
                    created_at: x.created_at.to_chrono(),
                })
                .collect(),
        })
    }

    async fn checks_for(&self, t: &TicketDoc, a: &TicketAccess) -> AppResult<Vec<CheckDto>> {
        let checks: Vec<CheckDoc> =
            self.c.checks.find(doc! { "ticket_id": &t.id }).sort(doc! { "_id": -1 }).limit(20).await?.try_collect().await?;
        let users = self.identity.users(&checks.iter().map(|c| c.acting_user_id.clone()).collect::<Vec<_>>()).await?;
        let mut out = Vec::new();
        for c in checks {
            let cands: Vec<CandidateDoc> =
                self.c.candidates.find(doc! { "check_id": &c.id }).sort(doc! { "score": -1 }).await?.try_collect().await?;
            let mut list = Vec::new();
            let mut hidden = 0;
            for cd in cands {
                match self.c.tickets.find_one(doc! { "_id": &cd.candidate_ticket_id }).await? {
                    Some(ct) if a.can_view(&ct) => list.push(CandidateDto {
                        id: cd.id,
                        ticket: Self::ref_dto(&ct),
                        reason: cd.reason,
                        score: cd.score,
                        decision: cd.decision,
                        decided_at: cd.decided_at.map(|d| d.to_chrono()),
                    }),
                    _ => hidden += 1,
                }
            }
            out.push(CheckDto {
                id: c.id,
                purpose: c.purpose,
                acting_user: users.get(&c.acting_user_id).cloned(),
                trigger_mode: c.trigger_mode,
                engine: c.engine,
                status: c.status,
                result: c.result,
                checked_scope: c.checked_scope,
                note: c.note,
                created_at: c.created_at.to_chrono(),
                completed_at: c.completed_at.map(|d| d.to_chrono()),
                candidates: list,
                hidden,
            });
        }
        Ok(out)
    }

    /// Đề xuất sửa tài liệu người xem được thấy, và số đề xuất bị ẩn vì tài liệu nằm ngoài quyền xem của họ
    /// (DECISIONS #41: ẩn nhưng ghi số lượng).
    async fn proposals_for(&self, p: &Principal, t: &TicketDoc) -> AppResult<(Vec<ProposalDto>, u32)> {
        let list: Vec<ProposalDoc> =
            self.c.proposals.find(doc! { "ticket_id": &t.id }).sort(doc! { "_id": 1 }).await?.try_collect().await?;
        let mut out = Vec::new();
        let mut hidden = 0u32;
        for pr in list {
            let perms = self.documents.doc_perms(&p.user_id, &pr.document_id).await?;
            let Some(perms) = perms.filter(|x| x.view) else {
                hidden += 1;
                continue;
            };
            let doc = self.documents.document(&pr.document_id).await?;
            let stale = doc.as_ref().is_some_and(|d| d.published_version_id.as_ref() != Some(&pr.based_on_version_id));
            out.push(ProposalDto {
                id: pr.id,
                document_id: pr.document_id,
                document_code: pr.document_code,
                based_on_version: pr.based_on_version,
                section: pr.section,
                proposed_change: pr.proposed_change,
                reason: pr.reason,
                status: pr.status,
                draft_version_id: pr.draft_version_id,
                stale,
                can_decide: perms.edit,
                created_at: pr.created_at.to_chrono(),
            });
        }
        Ok((out, hidden))
    }

    // ------------------------------------------------------- quyền ticket

    pub async fn access_overview(&self, p: &Principal, ws: &WorkspaceId) -> AppResult<TicketAccessDto> {
        let a = self.ticket_access(&p.user_id, ws).await?;
        if !a.ws.is_member() {
            return Err(AppError::not_found("workspace.not_found", "Không tìm thấy workspace, hoặc bạn không phải thành viên"));
        }
        let groups: HashMap<String, String> = self.access.groups(ws).await?.into_iter().map(|g| (g.id.to_string(), g.name)).collect();
        let delegations: Vec<DelegationDoc> =
            self.c.delegations.find(doc! { "workspace_id": ws, "revoked_at": Bson::Null }).await?.try_collect().await?;
        let mut uids: Vec<UserId> =
            a.grants.iter().filter(|g| g.subject_type == SubjectType::User).map(|g| UserId::from(g.subject_id.clone())).collect();
        uids.extend(delegations.iter().map(|d| d.delegate_user_id.clone()));
        let users = self.identity.users(&uids).await?;
        let my_ai =
            self.c.ai_delegations.count_documents(doc! { "workspace_id": ws, "user_id": &p.user_id, "revoked_at": Bson::Null }).await? > 0;
        Ok(TicketAccessDto {
            grants: a
                .grants
                .iter()
                .map(|g| GrantDto {
                    id: g.id.clone(),
                    kind: g.kind,
                    subject_type: g.subject_type,
                    subject_id: g.subject_id.clone(),
                    subject_name: match g.subject_type {
                        SubjectType::User => users.get(&UserId::from(g.subject_id.clone())).map(|u| u.display_name.clone()),
                        SubjectType::Group => groups.get(&g.subject_id).cloned(),
                    },
                    scope_type: g.scope_type,
                    scope_id: g.scope_id.clone(),
                    scope_name: match g.scope_type {
                        ScopeType::Workspace => Some(a.ws.workspace.name.clone()),
                        ScopeType::Group => groups.get(&g.scope_id).cloned(),
                    },
                    granted_by: g.granted_by.clone(),
                    created_at: g.created_at.to_chrono(),
                })
                .collect(),
            delegations: delegations
                .iter()
                .map(|d| DelegationDto {
                    id: d.id.clone(),
                    delegate: users.get(&d.delegate_user_id).cloned(),
                    delegate_user_id: d.delegate_user_id.clone(),
                    can_decide_view: d.can_decide_view,
                    can_decide_process: d.can_decide_process,
                    created_at: d.created_at.to_chrono(),
                })
                .collect(),
            can_decide_view: a.can_decide(GrantKind::View),
            can_decide_process: a.can_decide(GrantKind::Process),
            can_manage_delegations: a.ws.is_workspace_owner(),
            my_ai_delegation: my_ai,
            ai_engine: if self.ai.is_some() { "ai" } else { "keyword" },
        })
    }

    /// Cấp quyền xem / xử lý ticket cho cá nhân hoặc group (workspace owner hoặc người được uỷ quyền quyết định).
    pub async fn create_grant(&self, p: &Principal, ws: &WorkspaceId, input: CreateGrant) -> AppResult<TicketAccessDto> {
        let a = self.ticket_access(&p.user_id, ws).await?;
        if !a.can_decide(input.kind) {
            return Err(AppError::forbidden("ticket.grant_forbidden", "Bạn không được quyết định cấp quyền này"));
        }
        match input.subject_type {
            SubjectType::User => {
                if self.identity.user(&UserId::from(input.subject_id.clone())).await?.is_none() {
                    return Err(AppError::unprocessable("ticket.invalid_subject", "Không tìm thấy người dùng"));
                }
            }
            SubjectType::Group => {
                if !self.access.group(&GroupId::from(input.subject_id.clone())).await?.is_some_and(|g| g.workspace_id == *ws) {
                    return Err(AppError::unprocessable("ticket.invalid_subject", "Group được cấp phải thuộc workspace"));
                }
            }
        }
        let scope_id = match input.scope_type {
            ScopeType::Workspace => ws.to_string(),
            ScopeType::Group => {
                let s = input.scope_id.clone().unwrap_or_default();
                if !self.access.group(&GroupId::from(s.clone())).await?.is_some_and(|g| g.workspace_id == *ws) {
                    return Err(AppError::unprocessable("ticket.invalid_scope", "Group làm phạm vi phải thuộc workspace"));
                }
                s
            }
        };
        let exists = self
            .c
            .grants
            .count_documents(doc! {
                "workspace_id": ws, "kind": bson::to_bson(&input.kind)?, "subject_type": bson::to_bson(&input.subject_type)?,
                "subject_id": &input.subject_id, "scope_type": input.scope_type.as_str(), "scope_id": &scope_id, "revoked_at": Bson::Null,
            })
            .await?;
        if exists == 0 {
            let g = GrantDoc {
                id: TicketGrantId::new(),
                workspace_id: ws.clone(),
                kind: input.kind,
                subject_type: input.subject_type,
                subject_id: input.subject_id.clone(),
                scope_type: input.scope_type,
                scope_id,
                granted_by: p.user_id.clone(),
                created_at: now_bson(),
                revoked_at: None,
            };
            let notify = if g.subject_type == SubjectType::User { vec![UserId::from(g.subject_id.clone())] } else { vec![] };
            let event = DomainEvent::new(kinds::TICKET_GRANT_CREATED, "ticket_grant", g.id.as_str())
                .workspace(ws)
                .actor(&p.user_id)
                .data(json!({ "kind": g.kind, "subject_type": g.subject_type, "subject_id": g.subject_id, "scope_type": g.scope_type, "scope_id": g.scope_id }))
                .notify(notify)
                .audit();
            // Quyền và dòng nhật ký (tự cấp quyền phải để lại dấu vết) commit cùng nhau.
            let (c, bus) = (self.c.clone(), self.bus.clone());
            with_txn(self.mongo.client(), move |s| {
                let (c, bus, g, event) = (c.clone(), bus.clone(), g.clone(), event.clone());
                Box::pin(async move {
                    c.grants.insert_one(&g).session(&mut *s).await?;
                    bus.publish_in(s, event).await
                })
            })
            .await?;
        }
        self.access_overview(p, ws).await
    }

    pub async fn revoke_grant(&self, p: &Principal, id: &TicketGrantId) -> AppResult<()> {
        let g = self
            .c
            .grants
            .find_one(doc! { "_id": id, "revoked_at": Bson::Null })
            .await?
            .ok_or_else(|| AppError::not_found("ticket.grant_not_found", "Không tìm thấy quyền đã cấp"))?;
        let a = self.ticket_access(&p.user_id, &g.workspace_id).await?;
        if !a.can_decide(g.kind) {
            return Err(AppError::forbidden("ticket.grant_forbidden", "Bạn không được quyết định thu hồi quyền này"));
        }
        self.c.grants.update_one(doc! { "_id": id }, doc! { "$set": { "revoked_at": now_bson() } }).await?;
        self.bus
            .publish(
                DomainEvent::new(kinds::TICKET_GRANT_REVOKED, "ticket_grant", id.as_str())
                    .workspace(&g.workspace_id)
                    .actor(&p.user_id)
                    .data(json!({ "kind": g.kind, "subject_type": g.subject_type, "subject_id": g.subject_id }))
                    .audit(),
            )
            .await
    }

    /// Uỷ quyền quyết định cấp quyền ticket – chỉ workspace owner.
    pub async fn create_delegation(&self, p: &Principal, ws: &WorkspaceId, input: CreateDelegation) -> AppResult<TicketAccessDto> {
        let a = self.ticket_access(&p.user_id, ws).await?;
        if !a.ws.is_workspace_owner() {
            return Err(AppError::forbidden("ticket.delegation_forbidden", "Chỉ workspace owner được uỷ quyền"));
        }
        if !input.can_decide_view && !input.can_decide_process {
            return Err(AppError::unprocessable("ticket.empty_delegation", "Chọn ít nhất một quyền được quyết định"));
        }
        if !self.access.workspace_access(&input.user_id, ws).await?.is_some_and(|x| x.is_member()) {
            return Err(AppError::unprocessable("ticket.delegate_not_member", "Người được uỷ quyền phải là thành viên workspace"));
        }
        self.c
            .delegations
            .update_many(
                doc! { "workspace_id": ws, "delegate_user_id": &input.user_id, "revoked_at": Bson::Null },
                doc! { "$set": { "revoked_at": now_bson() } },
            )
            .await?;
        let d = DelegationDoc {
            id: TicketDelegationId::new(),
            workspace_id: ws.clone(),
            delegate_user_id: input.user_id.clone(),
            can_decide_view: input.can_decide_view,
            can_decide_process: input.can_decide_process,
            granted_by: p.user_id.clone(),
            created_at: now_bson(),
            revoked_at: None,
        };
        self.c.delegations.insert_one(&d).await?;
        self.bus
            .publish(
                DomainEvent::new(kinds::TICKET_DELEGATION_CREATED, "ticket_delegation", d.id.as_str())
                    .workspace(ws)
                    .actor(&p.user_id)
                    .data(json!({ "user_id": d.delegate_user_id, "can_decide_view": d.can_decide_view, "can_decide_process": d.can_decide_process }))
                    .notify([d.delegate_user_id.clone()])
                    .audit(),
            )
            .await?;
        self.access_overview(p, ws).await
    }

    pub async fn revoke_delegation(&self, p: &Principal, id: &TicketDelegationId) -> AppResult<()> {
        let d = self
            .c
            .delegations
            .find_one(doc! { "_id": id, "revoked_at": Bson::Null })
            .await?
            .ok_or_else(|| AppError::not_found("ticket.delegation_not_found", "Không tìm thấy uỷ quyền"))?;
        let a = self.ticket_access(&p.user_id, &d.workspace_id).await?;
        if !a.ws.is_workspace_owner() {
            return Err(AppError::forbidden("ticket.delegation_forbidden", "Chỉ workspace owner được thu hồi uỷ quyền"));
        }
        self.c.delegations.update_one(doc! { "_id": id }, doc! { "$set": { "revoked_at": now_bson() } }).await?;
        self.bus
            .publish(
                DomainEvent::new(kinds::TICKET_DELEGATION_REVOKED, "ticket_delegation", id.as_str())
                    .workspace(&d.workspace_id)
                    .actor(&p.user_id)
                    .data(json!({ "user_id": d.delegate_user_id }))
                    .audit(),
            )
            .await
    }

    /// Bật / tắt cho AI tự động kiểm tra ticket mới thay mặt mình. Cần đang có cả quyền xem và xử lý ticket.
    pub async fn set_ai_delegation(&self, p: &Principal, ws: &WorkspaceId, input: SetAiDelegation) -> AppResult<TicketAccessDto> {
        let a = self.ticket_access(&p.user_id, ws).await?;
        self.c
            .ai_delegations
            .update_many(
                doc! { "workspace_id": ws, "user_id": &p.user_id, "revoked_at": Bson::Null },
                doc! { "$set": { "revoked_at": now_bson() } },
            )
            .await?;
        if input.enabled {
            if !(a.has_any(GrantKind::View) && a.has_any(GrantKind::Process)) {
                return Err(AppError::forbidden("ticket.ai_delegation_forbidden", "Cần có quyền xem và xử lý ticket mới uỷ quyền cho AI"));
            }
            self.c
                .ai_delegations
                .insert_one(AiDelegationDoc {
                    id: AiDelegationId::new(),
                    workspace_id: ws.clone(),
                    user_id: p.user_id.clone(),
                    created_at: now_bson(),
                    revoked_at: None,
                })
                .await?;
        }
        self.bus
            .publish(
                DomainEvent::new(
                    if input.enabled { kinds::TICKET_AI_DELEGATION_SET } else { kinds::TICKET_AI_DELEGATION_REVOKED },
                    "ticket_ai_delegation",
                    p.user_id.as_str(),
                )
                .workspace(ws)
                .actor(&p.user_id)
                .audit(),
            )
            .await?;
        self.access_overview(p, ws).await
    }

    /// Group bị xoá: bỏ gắn group khỏi ticket, thu hồi quyền cấp cho / trong group đó.
    pub async fn on_group_deleted(&self, ev: &DomainEvent) -> AppResult<()> {
        let gid = ev.target_id.clone();
        self.c.tickets.update_many(doc! { "group_id": &gid }, doc! { "$set": { "group_id": Bson::Null } }).await?;
        self.c
            .grants
            .update_many(
                doc! { "revoked_at": Bson::Null, "$or": [
                    { "subject_type": "group", "subject_id": &gid }, { "scope_type": "group", "scope_id": &gid },
                ] },
                doc! { "$set": { "revoked_at": now_bson() } },
            )
            .await?;
        Ok(())
    }

    /// Bản dự thảo được phát hành ⇒ đề xuất đã đưa vào bản đó thành "Đã áp dụng" (desc §5.4 bước 7).
    pub async fn on_version_published(&self, ev: &DomainEvent) -> AppResult<()> {
        let Some(vid) = ev.data.get("version_id").and_then(|v| v.as_str()) else { return Ok(()) };
        let list: Vec<ProposalDoc> =
            self.c.proposals.find(doc! { "draft_version_id": vid, "status": "implemented" }).await?.try_collect().await?;
        for pr in list {
            self.c.proposals.update_one(doc! { "_id": &pr.id }, doc! { "$set": { "status": "applied", "updated_at": now_bson() } }).await?;
            let version = ev.data.get("version").and_then(|v| v.as_str()).unwrap_or("");
            self.log(
                &pr.ticket_id,
                None,
                "proposal_applied",
                format!("Đề xuất cho {} đã có trong bản phát hành {version}", pr.document_code),
            )
            .await?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_transitions_follow_the_proposed_flow() {
        use TicketStatus::*;
        assert!(New.can_move_to(Reviewing) && Reviewing.can_move_to(Accepted) && Accepted.can_move_to(InProgress));
        assert!(InProgress.can_move_to(Resolved) && Resolved.can_move_to(Reviewing));
        assert!(Deferred.can_move_to(Reviewing) && Rejected.can_move_to(Reviewing));
        assert!(!New.can_move_to(Duplicate), "trùng chỉ đặt qua xác nhận trùng");
        assert!(!New.can_move_to(Checking), "đang kiểm tra trùng do hệ thống đặt");
        assert!(!Resolved.can_move_to(InProgress));
    }
}
