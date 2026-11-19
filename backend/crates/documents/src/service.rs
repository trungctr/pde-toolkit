//! Tài liệu: tạo từ mẫu, sổ đăng ký, xem, lưu nội dung, liên kết, thông tin chung.

use crate::catalog::{self, DocType};
use crate::model::*;
use crate::policy::{self, Viewer};
use crate::template::{self, FillValues, HeaderCtx};
use bson::{doc, Bson};
use chillcat_kernel::contracts::*;
use chillcat_kernel::events::kinds;
use chillcat_kernel::*;
use chillcat_platform::mongo::{ensure_indexes, index, is_duplicate_key_app, now_bson, with_txn};
use chillcat_platform::{EventBus, Mongo};
use futures::TryStreamExt;
use mongodb::{Collection, Database};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

pub(crate) const MAX_CONTENT_BYTES: usize = 8 * 1024 * 1024;

#[derive(Clone)]
pub(crate) struct Colls {
    pub documents: Collection<DocumentDoc>,
    pub versions: Collection<VersionDoc>,
    pub reviews: Collection<ReviewDoc>,
    pub comments: Collection<CommentDoc>,
    pub links: Collection<LinkDoc>,
    pub bus: EventBus,
}

#[derive(Clone, Debug)]
pub struct DocumentSettings {
    /// Phiên bản bị thay thế được giữ bao nhiêu năm (desc §5.3: 10 năm).
    pub superseded_retention_years: u32,
}

pub struct DocumentService {
    pub(crate) mongo: Mongo,
    pub(crate) c: Colls,
    pub(crate) access: Arc<dyn AccessApi>,
    pub(crate) identity: Arc<dyn IdentityApi>,
    pub(crate) trace: Arc<dyn TraceApi>,
    pub(crate) settings: DocumentSettings,
}

pub(crate) fn not_found() -> AppError {
    AppError::not_found("document.not_found", "Không tìm thấy tài liệu, hoặc bạn không được xem")
}

pub(crate) fn today() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

pub(crate) fn dt(t: bson::DateTime) -> chrono::DateTime<chrono::Utc> {
    t.to_chrono()
}

impl DocumentService {
    pub fn new(
        mongo: Mongo,
        db: &Database,
        bus: EventBus,
        access: Arc<dyn AccessApi>,
        identity: Arc<dyn IdentityApi>,
        trace: Arc<dyn TraceApi>,
        settings: DocumentSettings,
    ) -> Self {
        DocumentService {
            mongo,
            c: Colls {
                documents: db.collection("documents"),
                versions: db.collection("document_versions"),
                reviews: db.collection("document_reviews"),
                comments: db.collection("comments"),
                links: db.collection("document_links"),
                bus,
            },
            access,
            identity,
            trace,
            settings,
        }
    }

    pub async fn ensure_indexes(&self) -> AppResult<()> {
        ensure_indexes(
            &self.c.documents,
            vec![
                index::unique("documents_ws_code", doc! { "workspace_id": 1, "code": 1 }),
                // Số bản theo loại (desc §7.1): một bản cho workspace / mỗi hệ thống con / mỗi quy trình.
                index::unique("documents_cardinality", doc! { "workspace_id": 1, "type_code": 1, "subsystem_id": 1, "process_no": 1 }),
                index::plain("documents_group", doc! { "group_id": 1 }),
                index::plain("documents_subsystem", doc! { "subsystem_id": 1 }),
            ],
        )
        .await?;
        ensure_indexes(
            &self.c.versions,
            vec![
                index::unique("versions_doc_version", doc! { "document_id": 1, "version": 1 }),
                index::unique_partial("versions_one_working", doc! { "document_id": 1 }, doc! { "working": true }),
                index::plain("versions_ws_status", doc! { "workspace_id": 1, "status": 1 }),
                index::plain("versions_superseded", doc! { "superseded_at": 1 }),
            ],
        )
        .await?;
        ensure_indexes(&self.c.reviews, vec![index::plain("reviews_doc", doc! { "document_id": 1, "_id": -1 })]).await?;
        ensure_indexes(&self.c.comments, vec![index::plain("comments_version", doc! { "version_id": 1, "_id": 1 })]).await?;
        ensure_indexes(
            &self.c.links,
            vec![
                index::unique("links_unique", doc! { "from_document_id": 1, "to_document_id": 1, "kind": 1 }),
                index::plain("links_to", doc! { "to_document_id": 1 }),
            ],
        )
        .await
    }

    // ------------------------------------------------------------- nạp dữ liệu

    pub(crate) async fn doc(&self, id: &DocumentId) -> AppResult<DocumentDoc> {
        self.c.documents.find_one(doc! { "_id": id }).await?.ok_or_else(not_found)
    }

    pub(crate) async fn ver(&self, id: &VersionId) -> AppResult<VersionDoc> {
        self.c.versions.find_one(doc! { "_id": id }).await?.ok_or_else(not_found)
    }

    pub(crate) async fn working_of(&self, d: &DocumentDoc) -> AppResult<Option<VersionDoc>> {
        match &d.working_version_id {
            Some(id) => Ok(self.c.versions.find_one(doc! { "_id": id }).await?),
            None => Ok(None),
        }
    }

    pub(crate) async fn access_for(&self, user: &UserId, ws: &WorkspaceId) -> AppResult<WorkspaceAccess> {
        self.access.workspace_access(user, ws).await?.ok_or_else(not_found)
    }

    pub(crate) async fn display_name(&self, user: &UserId) -> AppResult<String> {
        Ok(self.identity.user(user).await?.map(|u| u.display_name).unwrap_or_else(|| user.to_string()))
    }

    pub(crate) fn doc_type(code: &str) -> AppResult<&'static DocType> {
        catalog::find(code).ok_or_else(|| AppError::unprocessable("document.unknown_type", format!("Không có loại tài liệu “{code}”")))
    }

    pub(crate) fn version_content(d: &DocumentDoc, v: &VersionDoc, content: &str) -> VersionContent {
        VersionContent {
            workspace_id: d.workspace_id.clone(),
            group_id: d.group_id.clone(),
            document_id: d.id.clone(),
            document_code: d.code.clone(),
            document_title: d.title.clone(),
            type_code: d.type_code.clone(),
            subsystem_code: d.subsystem_code.clone(),
            version_id: v.id.clone(),
            version: v.version.clone(),
            content: content.to_owned(),
        }
    }

    pub(crate) fn summary_dto(v: &VersionDoc, users: &HashMap<UserId, UserSummary>, viewable: bool) -> VersionSummaryDto {
        VersionSummaryDto {
            id: v.id.clone(),
            version: v.version.clone(),
            status: v.status,
            status_label: v.status.label_vi(),
            editor_id: v.editor_id.clone(),
            editor: v.editor_id.as_ref().and_then(|e| users.get(e).cloned()),
            review_round: v.review_round,
            change_note: v.change_note.clone(),
            created_at: dt(v.created_at),
            updated_at: dt(v.updated_at),
            submitted_at: v.submitted_at.map(dt),
            approved_at: v.approved_at.map(dt),
            published_at: v.published_at.map(dt),
            superseded_at: v.superseded_at.map(dt),
            viewable,
        }
    }

    pub(crate) fn document_dto(
        d: &DocumentDoc,
        groups: &HashMap<GroupId, String>,
        users: &HashMap<UserId, UserSummary>,
        working_visible: bool,
    ) -> DocumentDto {
        let t = catalog::find(&d.type_code);
        DocumentDto {
            id: d.id.clone(),
            workspace_id: d.workspace_id.clone(),
            group_id: d.group_id.clone(),
            group_name: groups.get(&d.group_id).cloned(),
            type_code: d.type_code.clone(),
            type_name: t.map(|t| t.name.to_owned()),
            type_family: t.map(|t| t.family.to_owned()),
            subsystem_id: d.subsystem_id.clone(),
            subsystem_code: d.subsystem_code.clone(),
            process_no: d.process_no,
            code: d.code.clone(),
            title: d.title.clone(),
            security: d.security,
            security_label: d.security.label_vi(),
            owner_id: d.owner_id.clone(),
            owner: users.get(&d.owner_id).cloned(),
            created_by: d.created_by.clone(),
            created_at: dt(d.created_at),
            updated_at: dt(d.updated_at),
            published_version_id: d.published_version_id.clone(),
            published_version: d.published_version.clone(),
            published_at: d.published_at.map(dt),
            working_version_id: if working_visible { d.working_version_id.clone() } else { None },
            working_version: if working_visible { d.working_version.clone() } else { None },
            working_status: if working_visible { d.working_status } else { None },
            working_status_label: if working_visible { d.working_status.map(VersionStatus::label_vi) } else { None },
            working_editor_id: if working_visible { d.working_editor_id.clone() } else { None },
            archived: d.archived_at.is_some(),
            ever_published: d.ever_published,
            working_visible,
        }
    }

    pub(crate) async fn group_names(&self, ws: &WorkspaceId) -> AppResult<HashMap<GroupId, String>> {
        Ok(self.access.groups(ws).await?.into_iter().map(|g| (g.id, g.name)).collect())
    }

    // ------------------------------------------------------------------ tạo

    pub async fn create(&self, p: &Principal, ws: &WorkspaceId, input: CreateDocument) -> AppResult<DocumentDetailDto> {
        let a = self.access_for(&p.user_id, ws).await?;
        if !a.is_member() {
            return Err(not_found());
        }
        let group = self
            .access
            .group(&input.group_id)
            .await?
            .filter(|g| &g.workspace_id == ws)
            .ok_or_else(|| AppError::unprocessable("document.invalid_group", "Group không thuộc workspace này"))?;
        if !a.doc_perms_in(&group.id).create {
            return Err(AppError::forbidden(
                "document.create_forbidden",
                format!("Bạn không có quyền tạo tài liệu trong group “{}”", group.name),
            ));
        }
        let t = Self::doc_type(&input.type_code)?;
        let (subsystem, process_no) = match t.cardinality {
            Cardinality::Subsystem => {
                let sid = input
                    .subsystem_id
                    .clone()
                    .ok_or_else(|| AppError::unprocessable("document.subsystem_required", "Loại tài liệu này cần chọn hệ thống con"))?;
                let s = self
                    .access
                    .subsystem(&sid)
                    .await?
                    .filter(|s| &s.workspace_id == ws)
                    .ok_or_else(|| AppError::unprocessable("document.invalid_subsystem", "Hệ thống con không thuộc workspace này"))?;
                (Some(s), None)
            }
            Cardinality::Process => match input.process_no {
                Some(n @ 1..=99) => (None, Some(n)),
                _ => return Err(AppError::unprocessable("document.process_required", "Nhập số quy trình cấp 1 (01–99; 00 là BPMN-00)")),
            },
            Cardinality::Workspace => (None, None),
        };
        let security = input.security.unwrap_or(Security::Group);
        if security == Security::Public {
            return Err(AppError::unprocessable("document.public_on_create", "Chỉ đặt mức Công khai sau khi tài liệu đã phát hành"));
        }
        let editor = input.editor_id.clone().unwrap_or_else(|| p.user_id.clone());
        if editor != p.user_id {
            let ea = self.access_for(&editor, ws).await?;
            if !ea.doc_perms_in(&group.id).edit {
                return Err(AppError::unprocessable(
                    "document.editor_no_edit",
                    "Người được chỉ định sửa phải có quyền sửa tài liệu trong group",
                ));
            }
        }
        let module = input.module_code.as_deref().map(|m| m.trim().to_ascii_uppercase()).filter(|m| !m.is_empty());
        if let Some(m) = &module {
            chillcat_kernel::codes::subsystem_code(m).map_err(|_| {
                AppError::unprocessable("document.invalid_module", "Mã module gồm 2–5 chữ in hoa / số, bắt đầu bằng chữ – ví dụ CART")
            })?;
        }

        let code = t.document_code(&a.workspace.code, subsystem.as_ref().map(|s| s.code.as_str()), process_no);
        let author = self.display_name(&p.user_id).await?;
        let content = match input.content {
            Some(c) if !c.trim().is_empty() => c.replace("\r\n", "\n"),
            _ => template::instantiate(
                t,
                &FillValues {
                    prj: a.workspace.code.clone(),
                    prj_name: a.workspace.name.clone(),
                    htc: subsystem.as_ref().map(|s| s.code.clone()),
                    htc_name: subsystem.as_ref().map(|s| s.name.clone()),
                    module,
                    process_no,
                    process_name: input.process_name.clone().filter(|n| !n.trim().is_empty()),
                },
                &today(),
                &author,
            ),
        };
        if content.len() > MAX_CONTENT_BYTES {
            return Err(AppError::unprocessable("document.too_large", "Nội dung quá lớn (tối đa 8 MB)"));
        }
        let title = input
            .title
            .map(|t| t.split_whitespace().collect::<Vec<_>>().join(" "))
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| content.lines().next().unwrap_or("").trim_start_matches('#').trim().to_owned());
        let title = if title.is_empty() { t.name.to_owned() } else { title.chars().take(200).collect() };

        let now = now_bson();
        let d = DocumentDoc {
            id: DocumentId::new(),
            workspace_id: ws.clone(),
            group_id: group.id.clone(),
            type_code: t.code.to_owned(),
            subsystem_id: subsystem.as_ref().map(|s| s.id.clone()),
            subsystem_code: subsystem.as_ref().map(|s| s.code.clone()),
            process_no: process_no.map(i32::from),
            code: code.clone(),
            title,
            security,
            owner_id: p.user_id.clone(),
            created_by: p.user_id.clone(),
            created_at: now,
            updated_at: now,
            published_version_id: None,
            published_version: None,
            published_at: None,
            working_version_id: None,
            working_version: Some("0.1".into()),
            working_status: Some(VersionStatus::Draft),
            working_editor_id: Some(editor.clone()),
            ever_published: false,
            archived_at: None,
        };
        let v = VersionDoc {
            id: VersionId::new(),
            document_id: d.id.clone(),
            workspace_id: ws.clone(),
            version: "0.1".into(),
            status: VersionStatus::Draft,
            working: true,
            content,
            revision: 1,
            change_note: None,
            created_by: p.user_id.clone(),
            created_at: now,
            editor_id: Some(editor.clone()),
            updated_by: Some(p.user_id.clone()),
            updated_at: now,
            review_round: 0,
            submitted_by: None,
            submitted_at: None,
            approved_by: None,
            approved_at: None,
            published_by: None,
            published_at: None,
            superseded_at: None,
            based_on_version_id: None,
        };
        let d = DocumentDoc { working_version_id: Some(v.id.clone()), ..d };
        let links = self.default_links(&d, t).await?;
        let review = ReviewDoc {
            id: ReviewId::new(),
            document_id: d.id.clone(),
            version_id: v.id.clone(),
            version: v.version.clone(),
            review_round: 0,
            action: ReviewAction::Create,
            actor_id: p.user_id.clone(),
            comment: None,
            created_at: now,
        };
        let event = DomainEvent::new(kinds::DOCUMENT_CREATED, "document", d.id.as_str())
            .workspace(ws)
            .actor(&p.user_id)
            .data(json!({ "code": d.code, "title": d.title, "type_code": d.type_code, "group_id": d.group_id, "version_id": v.id }))
            .notify(if editor != p.user_id { vec![editor.clone()] } else { vec![] })
            .audit();
        let (c, d2, v2) = (self.c.clone(), d.clone(), v.clone());
        with_txn(self.mongo.client(), move |s| {
            let (c, d, v, links, review, event) = (c.clone(), d2.clone(), v2.clone(), links.clone(), review.clone(), event.clone());
            Box::pin(async move {
                c.documents.insert_one(&d).session(&mut *s).await?;
                c.versions.insert_one(&v).session(&mut *s).await?;
                c.reviews.insert_one(&review).session(&mut *s).await?;
                if !links.is_empty() {
                    c.links.insert_many(&links).session(&mut *s).await?;
                }
                c.bus.publish_in(s, event).await
            })
        })
        .await
        .map_err(|e| {
            if is_duplicate_key_app(&e) {
                AppError::conflict(
                    "document.duplicate",
                    format!("Workspace đã có tài liệu {code} – mỗi loại chỉ có một bản cho workspace / hệ thống con / quy trình"),
                )
            } else {
                e
            }
        })?;
        self.trace.index_version(&Self::version_content(&d, &v, &v.content)).await?;
        self.detail(p, &d.id).await
    }

    /// Quan hệ ↑ / ⇄ mặc định theo bộ mẫu (desc §7.3), cả hai chiều: tài liệu mới trỏ lên các tài liệu đã có, và
    /// các tài liệu đã có trỏ lên tài liệu mới. Tài liệu theo hệ thống con chỉ nối với tài liệu cùng hệ thống con.
    async fn default_links(&self, d: &DocumentDoc, t: &DocType) -> AppResult<Vec<LinkDoc>> {
        let existing: Vec<DocumentDoc> = self.c.documents.find(doc! { "workspace_id": &d.workspace_id }).await?.try_collect().await?;
        let matches = |src: &DocumentDoc, src_t: &DocType, dst: &DocumentDoc, dst_type: &str| -> bool {
            let Some(dst_t) = catalog::find(&dst.type_code) else { return false };
            if dst.type_code != dst_type {
                return false;
            }
            match (src_t.cardinality, dst_t.cardinality) {
                (_, Cardinality::Workspace) => true,
                (Cardinality::Subsystem, Cardinality::Subsystem) => src.subsystem_id == dst.subsystem_id,
                (Cardinality::Workspace, _) => true,
                _ => false,
            }
        };
        let mut out = Vec::new();
        let mut push = |from: &DocumentDoc, to: &DocumentDoc, kind: LinkKind| {
            out.push(LinkDoc {
                id: LinkId::new(),
                workspace_id: d.workspace_id.clone(),
                from_document_id: from.id.clone(),
                to_document_id: to.id.clone(),
                kind,
                is_default: true,
                created_by: None,
                created_at: now_bson(),
            });
        };
        for other in &existing {
            let Some(ot) = catalog::find(&other.type_code) else { continue };
            for (kind, list) in [(LinkKind::Up, t.up), (LinkKind::Peer, t.peer)] {
                if list.iter().any(|ty| matches(d, t, other, ty)) {
                    push(d, other, kind);
                }
            }
            for (kind, list) in [(LinkKind::Up, ot.up), (LinkKind::Peer, ot.peer)] {
                if list.iter().any(|ty| matches(other, ot, d, ty)) {
                    push(other, d, kind);
                }
            }
        }
        Ok(out)
    }

    // ------------------------------------------------------------- sổ đăng ký

    /// Sổ đăng ký tài liệu của workspace (desc §7.5 DOCREG tự sinh): những tài liệu người gọi thấy được.
    pub async fn list(&self, p: &Principal, ws: &WorkspaceId, q: DocumentQuery) -> AppResult<Vec<DocumentDto>> {
        let a = self.access_for(&p.user_id, ws).await?;
        if !a.is_member() {
            return Err(AppError::not_found("workspace.not_found", "Không tìm thấy workspace, hoặc bạn không phải thành viên"));
        }
        let mut filter =
            doc! { "workspace_id": ws, "archived_at": if q.archived { doc! { "$ne": Bson::Null } } else { doc! { "$eq": Bson::Null } } };
        if let Some(t) = q.type_code.as_deref().filter(|s| !s.is_empty()) {
            filter.insert("type_code", t.to_ascii_uppercase());
        }
        if let Some(g) = q.group_id.as_deref().filter(|s| !s.is_empty()) {
            filter.insert("group_id", g);
        }
        if let Some(s) = q.subsystem_id.as_deref().filter(|s| !s.is_empty()) {
            filter.insert("subsystem_id", s);
        }
        if let Some(text) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            let re = Bson::RegularExpression(bson::Regex { pattern: regex::escape(text), options: "i".into() });
            filter.insert("$or", vec![doc! { "code": re.clone() }, doc! { "title": re }]);
        }
        let docs: Vec<DocumentDoc> = self.c.documents.find(filter).await?.try_collect().await?;
        let working_ids: Vec<&VersionId> = docs.iter().filter_map(|d| d.working_version_id.as_ref()).collect();
        let working: HashMap<VersionId, VersionDoc> = self
            .c
            .versions
            .find(doc! { "_id": { "$in": working_ids } })
            .projection(doc! { "content": 0 })
            .await?
            .try_collect::<Vec<_>>()
            .await?
            .into_iter()
            .map(|v| (v.id.clone(), v))
            .collect();
        let viewer = Viewer::new(&p.user_id, &a);
        let groups = self.group_names(ws).await?;
        let users = self.identity.users(&docs.iter().map(|d| d.owner_id.clone()).collect::<Vec<_>>()).await?;
        let mut out: Vec<DocumentDto> = docs
            .iter()
            .filter_map(|d| {
                let w = d.working_version_id.as_ref().and_then(|id| working.get(id));
                if !policy::can_see_document(&viewer, d, w) {
                    return None;
                }
                let wv = w.is_some_and(|w| policy::can_view(&viewer, d, w));
                let dto = Self::document_dto(d, &groups, &users, wv);
                let keep = match q.status.as_deref() {
                    None | Some("") => true,
                    Some("published") => d.published_version_id.is_some(),
                    Some(s) => dto.working_status.map(VersionStatus::as_str) == Some(s),
                };
                keep.then_some(dto)
            })
            .collect();
        out.sort_by(|a, b| {
            let sa = catalog::find(&a.type_code).map(|t| t.sort).unwrap_or(999);
            let sb = catalog::find(&b.type_code).map(|t| t.sort).unwrap_or(999);
            sa.cmp(&sb).then(a.code.cmp(&b.code))
        });
        Ok(out)
    }

    // ---------------------------------------------------------------- chi tiết

    pub async fn detail(&self, p: &Principal, id: &DocumentId) -> AppResult<DocumentDetailDto> {
        let d = self.doc(id).await?;
        let a = self.access_for(&p.user_id, &d.workspace_id).await?;
        let viewer = Viewer::new(&p.user_id, &a);
        let working = self.working_of(&d).await?;
        if !policy::can_see_document(&viewer, &d, working.as_ref()) {
            return Err(not_found());
        }
        let versions: Vec<VersionDoc> = self
            .c
            .versions
            .find(doc! { "document_id": id })
            .projection(doc! { "content": 0 })
            .sort(doc! { "_id": -1 })
            .await?
            .try_collect()
            .await?;
        let visible: Vec<&VersionDoc> = versions.iter().filter(|v| policy::can_view(&viewer, &d, v)).collect();
        let mut uids: Vec<UserId> = visible.iter().filter_map(|v| v.editor_id.clone()).collect();
        uids.push(d.owner_id.clone());
        let users = self.identity.users(&uids).await?;
        let groups = self.group_names(&d.workspace_id).await?;
        let wv = working.as_ref().is_some_and(|w| policy::can_view(&viewer, &d, w));
        Ok(DocumentDetailDto {
            document: Self::document_dto(&d, &groups, &users, wv),
            versions: visible.iter().map(|v| Self::summary_dto(v, &users, true)).collect(),
            links: self.links_of(&viewer, &d).await?,
            capabilities: policy::capabilities(&viewer, &d, working.as_ref()),
        })
    }

    async fn links_of(&self, viewer: &Viewer<'_>, d: &DocumentDoc) -> AppResult<Vec<LinkDto>> {
        let links: Vec<LinkDoc> =
            self.c.links.find(doc! { "$or": [ { "from_document_id": &d.id }, { "to_document_id": &d.id } ] }).await?.try_collect().await?;
        let other_ids: Vec<DocumentId> =
            links.iter().map(|l| if l.from_document_id == d.id { l.to_document_id.clone() } else { l.from_document_id.clone() }).collect();
        let others: HashMap<DocumentId, DocumentDoc> = self
            .c
            .documents
            .find(doc! { "_id": { "$in": &other_ids } })
            .await?
            .try_collect::<Vec<_>>()
            .await?
            .into_iter()
            .map(|o| (o.id.clone(), o))
            .collect();
        let workings: HashMap<VersionId, VersionDoc> = self
            .c
            .versions
            .find(doc! { "_id": { "$in": others.values().filter_map(|o| o.working_version_id.clone()).collect::<Vec<_>>() } })
            .projection(doc! { "content": 0 })
            .await?
            .try_collect::<Vec<_>>()
            .await?
            .into_iter()
            .map(|v| (v.id.clone(), v))
            .collect();
        let mut out = Vec::new();
        for l in &links {
            let outgoing = l.from_document_id == d.id;
            let other_id = if outgoing { &l.to_document_id } else { &l.from_document_id };
            let Some(o) = others.get(other_id) else { continue };
            let w = o.working_version_id.as_ref().and_then(|id| workings.get(id));
            if !policy::can_see_document(viewer, o, w) {
                continue;
            }
            let direction = match (l.kind, outgoing) {
                (LinkKind::Up, true) => "up",
                (LinkKind::Up, false) => "down",
                (LinkKind::Peer, _) => "peer",
            };
            if l.kind == LinkKind::Peer
                && !outgoing
                && links.iter().any(|x| x.kind == LinkKind::Peer && x.from_document_id == d.id && x.to_document_id == o.id)
            {
                continue; // ⇄ hai chiều chỉ hiện một lần
            }
            out.push(LinkDto {
                id: l.id.clone(),
                kind: l.kind,
                direction,
                is_default: l.is_default,
                document_id: o.id.clone(),
                code: o.code.clone(),
                title: o.title.clone(),
                type_code: o.type_code.clone(),
                security: o.security,
                published_version: o.published_version.clone(),
                working_status: w.filter(|w| policy::can_view(viewer, o, w)).map(|w| w.status),
            });
        }
        out.sort_by(|a, b| a.direction.cmp(b.direction).then(a.code.cmp(&b.code)));
        Ok(out)
    }

    /// Một phiên bản kèm nội dung. `p = None`: khách (chỉ bản phát hành Công khai).
    pub async fn version(&self, p: Option<&Principal>, id: &VersionId) -> AppResult<VersionDto> {
        let v = self.ver(id).await?;
        let d = self.doc(&v.document_id).await?;
        let (a, guest_ws) = match p {
            Some(p) => (Some(self.access_for(&p.user_id, &d.workspace_id).await?), None),
            None => (None, self.access.workspace(&d.workspace_id).await?),
        };
        let viewer = match (p, a.as_ref()) {
            (Some(p), Some(a)) => Viewer::new(&p.user_id, a),
            _ => Viewer::guest(guest_ws.as_ref()),
        };
        if !policy::can_view(&viewer, &d, &v) {
            return Err(not_found());
        }
        let users = match &v.editor_id {
            Some(e) => self.identity.users(std::slice::from_ref(e)).await?,
            None => HashMap::new(),
        };
        let caps = if d.working_version_id.as_ref() == Some(&v.id) {
            policy::capabilities(&viewer, &d, Some(&v))
        } else {
            Capabilities { view: true, comment: policy::can_comment(&viewer, &d, &v), ..Default::default() }
        };
        Ok(VersionDto {
            summary: Self::summary_dto(&v, &users, true),
            document_id: d.id.clone(),
            content: v.content.clone(),
            revision: v.revision,
            based_on_version_id: v.based_on_version_id.clone(),
            capabilities: caps,
        })
    }

    // --------------------------------------------------------------- lưu nội dung

    pub(crate) fn lint_dto(report: TraceReport, extra: Vec<CheckIssue>) -> LintDto {
        let mut issues = extra;
        issues.extend(report.issues.into_iter().map(|i| CheckIssue {
            level: i.level,
            code: i.code,
            message: i.message,
            target: i.trace_code.or(i.section),
        }));
        LintDto { issues, defined: report.defined, referenced: report.referenced }
    }

    /// Lưu nội dung bản dự thảo – chỉ người được chỉ định sửa (desc §5.1).
    pub async fn save_content(&self, p: &Principal, id: &VersionId, input: SaveContent) -> AppResult<SaveResultDto> {
        let v = self.ver(id).await?;
        let d = self.doc(&v.document_id).await?;
        let a = self.access_for(&p.user_id, &d.workspace_id).await?;
        let viewer = Viewer::new(&p.user_id, &a);
        if !policy::can_view(&viewer, &d, &v) {
            return Err(not_found());
        }
        if v.status != VersionStatus::Draft {
            return Err(AppError::conflict("document.not_draft", "Bản này không còn là dự thảo – nội dung đã khoá"));
        }
        if !policy::capabilities(&viewer, &d, Some(&v)).edit_content {
            return Err(AppError::forbidden("document.not_editor", "Chỉ người được chỉ định sửa bản dự thảo này mới sửa được nội dung"));
        }
        let content = input.content.replace("\r\n", "\n");
        if content.len() > MAX_CONTENT_BYTES {
            return Err(AppError::unprocessable("document.too_large", "Nội dung quá lớn (tối đa 8 MB)"));
        }
        let now = now_bson();
        let r = self
            .c
            .versions
            .update_one(
                doc! { "_id": id, "status": "draft", "revision": input.revision },
                doc! { "$set": { "content": &content, "updated_at": now, "updated_by": &p.user_id }, "$inc": { "revision": 1 } },
            )
            .await?;
        if r.modified_count == 0 {
            let cur = self.ver(id).await?;
            if cur.status != VersionStatus::Draft {
                return Err(AppError::conflict("document.not_draft", "Bản này vừa được gửi duyệt – nội dung đã khoá"));
            }
            return Err(AppError::conflict(
                "document.stale_revision",
                "Nội dung trên máy chủ đã thay đổi kể từ lần bạn mở – tải lại bản mới nhất trước khi lưu",
            )
            .with_details(json!({ "revision": cur.revision })));
        }
        self.c.documents.update_one(doc! { "_id": &d.id }, doc! { "$set": { "updated_at": now } }).await?;
        let report = self.trace.index_version(&Self::version_content(&d, &v, &content)).await?;
        Ok(SaveResultDto { revision: input.revision + 1, updated_at: dt(now), lint: Self::lint_dto(report, vec![]) })
    }

    /// Kiểm tra nội dung đang soạn (không lưu): mã truy vết, bảng thuộc tính, phần còn sót của mẫu.
    pub async fn lint(&self, p: &Principal, id: &VersionId, input: LintInput) -> AppResult<LintDto> {
        let v = self.ver(id).await?;
        let d = self.doc(&v.document_id).await?;
        let a = self.access_for(&p.user_id, &d.workspace_id).await?;
        if !policy::can_view(&Viewer::new(&p.user_id, &a), &d, &v) {
            return Err(not_found());
        }
        let t = Self::doc_type(&d.type_code)?;
        let content = template::set_header_rows(
            &input.content,
            &[("Phiên bản", &v.version), ("Ngày", &today()), ("Trạng thái", v.status.label_vi())],
        );
        let mut extra: Vec<CheckIssue> = template::check_header(
            &content,
            &HeaderCtx {
                doc_type: t,
                code: &d.code,
                subsystem_code: d.subsystem_code.as_deref(),
                process_no: d.process_no.map(|n| n as u8),
            },
        )
        .into_iter()
        .map(|h| CheckIssue {
            level: IssueLevel::Warning,
            code: "header.incomplete".into(),
            message: format!("{}: {}", h.row, h.reason),
            target: Some(h.row),
        })
        .collect();
        extra.extend(template::leftovers(&input.content).into_iter().map(|m| CheckIssue {
            level: IssueLevel::Info,
            code: "content.leftover".into(),
            message: m,
            target: None,
        }));
        let report = self.trace.lint(&Self::version_content(&d, &v, &input.content)).await?;
        Ok(Self::lint_dto(report, extra))
    }

    // -------------------------------------------------------- thông tin chung

    /// Đổi tên / mức bảo mật. Thay đổi và sự kiện nhật ký ghi trong **một** transaction; trường không đổi thì bỏ qua
    /// (gọi lại cùng giá trị không sinh sự kiện mới).
    pub async fn update(&self, p: &Principal, id: &DocumentId, input: UpdateDocument) -> AppResult<DocumentDetailDto> {
        let d = self.doc(id).await?;
        let a = self.access_for(&p.user_id, &d.workspace_id).await?;
        let viewer = Viewer::new(&p.user_id, &a);
        let working = self.working_of(&d).await?;
        if !policy::can_see_document(&viewer, &d, working.as_ref()) {
            return Err(not_found());
        }
        let caps = policy::capabilities(&viewer, &d, working.as_ref());
        // `expect`: giá trị hiện tại của các trường sắp đổi – người khác vừa đổi trước thì không ghi đè (và nhật ký
        // không ghi sai giá trị cũ).
        let mut expect = doc! { "_id": id };
        let mut set = doc! {};
        let mut events = Vec::new();
        if let Some(t) = input.title {
            if !caps.edit_meta {
                return Err(AppError::forbidden("document.edit_forbidden", "Bạn không có quyền sửa thông tin tài liệu"));
            }
            let t = t.split_whitespace().collect::<Vec<_>>().join(" ");
            if t.is_empty() || t.chars().count() > 200 {
                return Err(AppError::unprocessable("document.invalid_title", "Tên tài liệu không được trống, tối đa 200 ký tự"));
            }
            if t != d.title {
                expect.insert("title", &d.title);
                set.insert("title", &t);
                events.push(
                    DomainEvent::new(kinds::DOCUMENT_UPDATED, "document", id.as_str())
                        .workspace(&d.workspace_id)
                        .actor(&p.user_id)
                        .data(json!({ "code": d.code, "title": t, "from": d.title, "to": t }))
                        .audit(),
                );
            }
        }
        if let Some(sec) = input.security.filter(|s| *s != d.security) {
            if !caps.change_security {
                return Err(AppError::forbidden("document.security_forbidden", "Cần quyền phát hành để đổi mức bảo mật"));
            }
            if sec == Security::Public {
                if !a.workspace.allow_public {
                    return Err(AppError::forbidden("document.public_disabled", "Workspace đã tắt mức Công khai"));
                }
                // DECISIONS #27: chỉ đặt Công khai khi tài liệu đã có bản phát hành (trang công khai luôn trỏ tới bản đó).
                if d.published_version_id.is_none() {
                    return Err(AppError::unprocessable(
                        "document.public_requires_published",
                        "Chỉ đặt mức Công khai sau khi tài liệu đã có bản phát hành",
                    ));
                }
                if !input.confirm_public {
                    return Err(AppError::conflict(
                        "document.confirm_public",
                        "Mức Công khai cho mọi người có đường link xem bản phát hành, không cần đăng nhập – xác nhận để tiếp tục",
                    ));
                }
            }
            expect.insert("security", bson::to_bson(&d.security)?);
            set.insert("security", bson::to_bson(&sec)?);
            events.push(
                DomainEvent::new(kinds::DOCUMENT_SECURITY_CHANGED, "document", id.as_str())
                    .workspace(&d.workspace_id)
                    .actor(&p.user_id)
                    .data(json!({ "code": d.code, "title": d.title, "from": d.security, "to": sec }))
                    .audit(),
            );
        }
        if !events.is_empty() {
            set.insert("updated_at", now_bson());
            let c = self.c.clone();
            with_txn(self.mongo.client(), move |s| {
                let (c, expect, set, events) = (c.clone(), expect.clone(), set.clone(), events.clone());
                Box::pin(async move {
                    let r = c.documents.update_one(expect, doc! { "$set": set }).session(&mut *s).await?;
                    if r.matched_count == 0 {
                        return Err(AppError::conflict(
                            "document.concurrent_change",
                            "Thông tin tài liệu vừa được người khác thay đổi – tải lại rồi thử lại",
                        ));
                    }
                    c.bus.publish_all_in(s, events).await
                })
            })
            .await?;
        }
        self.detail(p, id).await
    }

    /// Lưu trữ / bỏ lưu trữ. Chỉ ghi (và chỉ sinh sự kiện) khi trạng thái thực sự đổi – gọi lại là vô hại.
    pub async fn set_archived(&self, p: &Principal, id: &DocumentId, archived: bool) -> AppResult<DocumentDetailDto> {
        let d = self.doc(id).await?;
        let a = self.access_for(&p.user_id, &d.workspace_id).await?;
        let viewer = Viewer::new(&p.user_id, &a);
        let working = self.working_of(&d).await?;
        if !policy::can_see_document(&viewer, &d, working.as_ref()) {
            return Err(not_found());
        }
        if !policy::capabilities(&viewer, &d, working.as_ref()).archive {
            return Err(AppError::forbidden(
                "document.archive_forbidden",
                "Chỉ group owner hoặc người có quyền phát hành được lưu trữ tài liệu",
            ));
        }
        let now = now_bson();
        let (filter, value) = if archived {
            (doc! { "_id": id, "archived_at": Bson::Null }, Bson::DateTime(now))
        } else {
            (doc! { "_id": id, "archived_at": { "$ne": Bson::Null } }, Bson::Null)
        };
        let kind = if archived { kinds::DOCUMENT_ARCHIVED } else { kinds::DOCUMENT_UNARCHIVED };
        let event = DomainEvent::new(kind, "document", id.as_str())
            .workspace(&d.workspace_id)
            .actor(&p.user_id)
            .data(json!({ "code": d.code, "title": d.title }))
            .audit();
        let c = self.c.clone();
        with_txn(self.mongo.client(), move |s| {
            let (c, filter, value, event) = (c.clone(), filter.clone(), value.clone(), event.clone());
            Box::pin(async move {
                let r = c
                    .documents
                    .update_one(filter, doc! { "$set": { "archived_at": value, "updated_at": now } })
                    .session(&mut *s)
                    .await?;
                if r.modified_count == 0 {
                    return Ok(()); // đã ở trạng thái này
                }
                c.bus.publish_in(s, event).await
            })
        })
        .await?;
        self.detail(p, id).await
    }

    /// Xoá hẳn – chỉ khi chưa từng phát hành và không tài liệu nào trỏ tới (desc §7.4); còn lại chỉ lưu trữ.
    pub async fn delete(&self, p: &Principal, id: &DocumentId) -> AppResult<()> {
        let d = self.doc(id).await?;
        let a = self.access_for(&p.user_id, &d.workspace_id).await?;
        let viewer = Viewer::new(&p.user_id, &a);
        let working = self.working_of(&d).await?;
        if !policy::can_see_document(&viewer, &d, working.as_ref()) {
            return Err(not_found());
        }
        if d.ever_published {
            return Err(AppError::conflict("document.published_cannot_delete", "Tài liệu đã từng phát hành – chỉ lưu trữ được, không xoá"));
        }
        if !policy::capabilities(&viewer, &d, working.as_ref()).delete {
            return Err(AppError::forbidden("document.delete_forbidden", "Chỉ người tạo hoặc group owner được xoá tài liệu"));
        }
        let manual_in = self.c.links.count_documents(doc! { "to_document_id": id, "is_default": false }).await?;
        if manual_in > 0 {
            return Err(AppError::conflict("document.referenced", "Có tài liệu khác đang trỏ tới tài liệu này – chỉ lưu trữ được"));
        }
        let (c, id2) = (self.c.clone(), id.clone());
        let event = DomainEvent::new(kinds::DOCUMENT_DELETED, "document", id.as_str())
            .workspace(&d.workspace_id)
            .actor(&p.user_id)
            .data(json!({ "code": d.code, "title": d.title }))
            .audit();
        with_txn(self.mongo.client(), move |s| {
            let (c, id, event) = (c.clone(), id2.clone(), event.clone());
            Box::pin(async move {
                c.documents.delete_one(doc! { "_id": &id }).session(&mut *s).await?;
                c.versions.delete_many(doc! { "document_id": &id }).session(&mut *s).await?;
                c.reviews.delete_many(doc! { "document_id": &id }).session(&mut *s).await?;
                c.comments.delete_many(doc! { "document_id": &id }).session(&mut *s).await?;
                c.links.delete_many(doc! { "$or": [ { "from_document_id": &id }, { "to_document_id": &id } ] }).session(&mut *s).await?;
                c.bus.publish_in(s, event).await
            })
        })
        .await?;
        self.trace.forget_document(id).await
    }

    // ---------------------------------------------------------------- liên kết

    pub async fn add_link(&self, p: &Principal, id: &DocumentId, input: CreateLink) -> AppResult<DocumentDetailDto> {
        let d = self.doc(id).await?;
        let a = self.access_for(&p.user_id, &d.workspace_id).await?;
        let viewer = Viewer::new(&p.user_id, &a);
        let working = self.working_of(&d).await?;
        if !policy::capabilities(&viewer, &d, working.as_ref()).manage_links {
            return Err(AppError::forbidden("document.links_forbidden", "Bạn không có quyền sửa quan hệ của tài liệu này"));
        }
        let target = self.doc(&input.to_document_id).await?;
        let tw = self.working_of(&target).await?;
        if target.workspace_id != d.workspace_id || target.id == d.id || !policy::can_see_document(&viewer, &target, tw.as_ref()) {
            return Err(AppError::unprocessable(
                "document.invalid_link",
                "Chỉ nối được tới tài liệu khác trong cùng workspace mà bạn thấy được",
            ));
        }
        if input.kind == LinkKind::Up && self.reaches_up(&target.id, &d.id).await? {
            return Err(AppError::unprocessable(
                "document.link_cycle",
                format!("{} đã (gián tiếp) nằm dưới tài liệu này – không tạo vòng ↑", target.code),
            ));
        }
        let link = LinkDoc {
            id: LinkId::new(),
            workspace_id: d.workspace_id.clone(),
            from_document_id: d.id.clone(),
            to_document_id: target.id.clone(),
            kind: input.kind,
            is_default: false,
            created_by: Some(p.user_id.clone()),
            created_at: now_bson(),
        };
        let event = DomainEvent::new(kinds::DOCUMENT_LINK_ADDED, "document", id.as_str())
            .workspace(&d.workspace_id)
            .actor(&p.user_id)
            .data(json!({ "code": d.code, "to": target.code, "to_document_id": target.id, "kind": input.kind, "link_id": link.id }))
            .audit();
        let c = self.c.clone();
        with_txn(self.mongo.client(), move |s| {
            let (c, link, event) = (c.clone(), link.clone(), event.clone());
            Box::pin(async move {
                c.links.insert_one(&link).session(&mut *s).await?;
                c.bus.publish_in(s, event).await
            })
        })
        .await
        .map_err(|e| if is_duplicate_key_app(&e) { AppError::conflict("document.link_exists", "Quan hệ này đã có") } else { e })?;
        self.detail(p, id).await
    }

    /// `from` (gián tiếp) trỏ lên `to` theo quan hệ ↑?
    async fn reaches_up(&self, from: &DocumentId, to: &DocumentId) -> AppResult<bool> {
        let mut seen: HashSet<DocumentId> = HashSet::new();
        let mut frontier = vec![from.clone()];
        while let Some(cur) = frontier.pop() {
            if &cur == to {
                return Ok(true);
            }
            if !seen.insert(cur.clone()) || seen.len() > 500 {
                continue;
            }
            let ups: Vec<LinkDoc> = self.c.links.find(doc! { "from_document_id": &cur, "kind": "up" }).await?.try_collect().await?;
            frontier.extend(ups.into_iter().map(|l| l.to_document_id));
        }
        Ok(false)
    }

    pub async fn remove_link(&self, p: &Principal, link_id: &LinkId) -> AppResult<()> {
        let l = self
            .c
            .links
            .find_one(doc! { "_id": link_id })
            .await?
            .ok_or_else(|| AppError::not_found("document.link_not_found", "Không tìm thấy quan hệ"))?;
        let d = self.doc(&l.from_document_id).await?;
        let a = self.access_for(&p.user_id, &d.workspace_id).await?;
        let viewer = Viewer::new(&p.user_id, &a);
        let working = self.working_of(&d).await?;
        if !policy::capabilities(&viewer, &d, working.as_ref()).manage_links {
            return Err(AppError::forbidden("document.links_forbidden", "Bạn không có quyền sửa quan hệ của tài liệu này"));
        }
        let to_code = self.c.documents.find_one(doc! { "_id": &l.to_document_id }).await?.map(|t| t.code).unwrap_or_default();
        let event = DomainEvent::new(kinds::DOCUMENT_LINK_REMOVED, "document", d.id.as_str())
            .workspace(&d.workspace_id)
            .actor(&p.user_id)
            .data(json!({
                "code": d.code, "to": to_code, "to_document_id": l.to_document_id, "kind": l.kind,
                "link_id": l.id, "is_default": l.is_default,
            }))
            .audit();
        let (c, lid) = (self.c.clone(), link_id.clone());
        with_txn(self.mongo.client(), move |s| {
            let (c, lid, event) = (c.clone(), lid.clone(), event.clone());
            Box::pin(async move {
                let r = c.links.delete_one(doc! { "_id": &lid }).session(&mut *s).await?;
                if r.deleted_count == 0 {
                    return Ok(()); // vừa bị người khác xoá
                }
                c.bus.publish_in(s, event).await
            })
        })
        .await
    }

    pub fn types(&self) -> Vec<&'static DocType> {
        catalog::TYPES.iter().collect()
    }
}
