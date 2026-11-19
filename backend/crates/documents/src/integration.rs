//! Phần nối với các module khác: [`DocumentsApi`], handler sự kiện, tác vụ dọn dữ liệu, trang công khai.

use crate::model::*;
use crate::policy::{self, Viewer};
use crate::service::{dt, not_found, DocumentService};
use bson::{doc, Bson};
use chillcat_kernel::contracts::*;
use chillcat_kernel::events::kinds;
use chillcat_kernel::*;
use chillcat_platform::mongo::{now_bson, with_txn};
use futures::TryStreamExt;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;

fn brief(d: &DocumentDoc) -> DocumentBrief {
    DocumentBrief {
        id: d.id.clone(),
        workspace_id: d.workspace_id.clone(),
        group_id: d.group_id.clone(),
        type_code: d.type_code.clone(),
        code: d.code.clone(),
        title: d.title.clone(),
        security: d.security,
        owner_id: d.owner_id.clone(),
        published_version_id: d.published_version_id.clone(),
        published_version: d.published_version.clone(),
        archived: d.archived_at.is_some(),
    }
}

impl DocumentService {
    async fn docs_with_working(&self, ws: &WorkspaceId) -> AppResult<(Vec<DocumentDoc>, HashMap<VersionId, VersionDoc>)> {
        let docs: Vec<DocumentDoc> = self.c.documents.find(doc! { "workspace_id": ws }).await?.try_collect().await?;
        let ids: Vec<VersionId> = docs.iter().filter_map(|d| d.working_version_id.clone()).collect();
        let working = self
            .c
            .versions
            .find(doc! { "_id": { "$in": ids } })
            .projection(doc! { "content": 0 })
            .await?
            .try_collect::<Vec<_>>()
            .await?
            .into_iter()
            .map(|v| (v.id.clone(), v))
            .collect();
        Ok((docs, working))
    }

    /// Trang công khai: bản đang phát hành của tài liệu mức Công khai – không cần đăng nhập (desc §6).
    pub async fn public_document(&self, id: &DocumentId) -> AppResult<PublicDocumentDto> {
        let d = self.doc(id).await?;
        let ws = self.access.workspace(&d.workspace_id).await?;
        // Khách chỉ thấy mức Công khai, và chỉ khi workspace cho phép (cùng một chính sách với mọi đường đọc khác).
        if !policy::can_view_released(&Viewer::guest(ws.as_ref()), &d) {
            return Err(not_found());
        }
        let vid = d.published_version_id.clone().ok_or_else(not_found)?;
        let v = self.ver(&vid).await?;
        Ok(PublicDocumentDto { code: d.code, title: d.title, version: v.version, published_at: v.published_at.map(dt), content: v.content })
    }

    /// Người rời phạm vi: quyền phụ trách tài liệu chuyển cho owner của phạm vi; bản dự thảo họ đang sửa
    /// giao cho group owner của tài liệu (người chắc chắn có quyền sửa). Desc §3.
    pub async fn on_member_removed(&self, ev: &DomainEvent) -> AppResult<()> {
        let s = |k: &str| ev.data.get(k).and_then(|v| v.as_str()).map(str::to_owned);
        let (Some(user), Some(scope_type), Some(scope_id), Some(successor), Some(ws)) =
            (s("user_id"), s("scope_type"), s("scope_id"), s("successor_id"), ev.workspace_id.clone())
        else {
            return Ok(());
        };
        let mut scope = doc! { "workspace_id": &ws };
        if scope_type == "group" {
            scope.insert("group_id", &scope_id);
        }
        let mut owned = scope.clone();
        owned.insert("owner_id", &user);
        let moved: Vec<DocumentDoc> = self.c.documents.find(owned).await?.try_collect().await?;
        for d in &moved {
            // Ưu tiên group owner của chính tài liệu (kết quả không phụ thuộc thứ tự xử lý các sự kiện
            // workspace / group khi một người bị loại khỏi cả workspace).
            let group_owner = self.access.group(&d.group_id).await?.map(|g| g.owner_id).filter(|o| o.as_str() != user);
            let to = group_owner.unwrap_or_else(|| UserId::from(successor.clone()));
            self.c
                .documents
                .update_one(doc! { "_id": &d.id, "owner_id": &user }, doc! { "$set": { "owner_id": &to, "updated_at": now_bson() } })
                .await?;
            self.c
                .bus
                .publish(
                    DomainEvent::new(kinds::DOCUMENT_OWNER_CHANGED, "document", d.id.as_str())
                        .workspace(&ws)
                        .data(json!({ "code": d.code, "title": d.title, "from_user_id": user, "to_user_id": to, "reason": "membership_removed" }))
                        .notify([to.clone()])
                        .audit(),
                )
                .await?;
        }
        let mut editing = scope;
        editing.insert("working_editor_id", &user);
        editing.insert("working_status", "draft");
        let drafts: Vec<DocumentDoc> = self.c.documents.find(editing).await?.try_collect().await?;
        for d in drafts {
            let Some(g) = self.access.group(&d.group_id).await? else { continue };
            let Some(vid) = &d.working_version_id else { continue };
            self.c.versions.update_one(doc! { "_id": vid, "status": "draft" }, doc! { "$set": { "editor_id": &g.owner_id } }).await?;
            self.c.documents.update_one(doc! { "_id": &d.id }, doc! { "$set": { "working_editor_id": &g.owner_id } }).await?;
            self.c
                .bus
                .publish(
                    DomainEvent::new(kinds::VERSION_EDITOR_CHANGED, "version", vid.as_str())
                        .workspace(&ws)
                        .data(json!({ "document_id": d.id, "code": d.code, "title": d.title, "from_user_id": user, "to_user_id": g.owner_id, "reason": "membership_removed" }))
                        .notify([g.owner_id.clone()])
                        .audit(),
                )
                .await?;
        }
        Ok(())
    }

    /// Module traceability đánh dấu Cần rà soát ⇒ báo người phụ trách và người đang sửa (desc §7.4).
    pub async fn on_review_flags(&self, ev: &DomainEvent) -> AppResult<()> {
        let Some(list) = ev.data.get("documents").and_then(|v| v.as_array()) else { return Ok(()) };
        let cause = ev.data.get("caused_by_code").and_then(|v| v.as_str()).unwrap_or("");
        let cause_version = ev.data.get("caused_by_version").and_then(|v| v.as_str()).unwrap_or("");
        for item in list {
            let Some(id) = item.get("document_id").and_then(|v| v.as_str()) else { continue };
            let Some(d) = self.c.documents.find_one(doc! { "_id": id }).await? else { continue };
            let mut notify = vec![d.owner_id.clone()];
            notify.extend(d.working_editor_id.clone());
            self.c
                .bus
                .publish(
                    DomainEvent::new(kinds::DOCUMENT_REVIEW_NEEDED, "document", d.id.as_str())
                        .workspace(&d.workspace_id)
                        .data(json!({
                            "document_id": d.id, "code": d.code, "title": d.title,
                            "caused_by_code": cause, "caused_by_version": cause_version, "items": item.get("items"),
                        }))
                        .notify(notify),
                )
                .await?;
        }
        Ok(())
    }

    /// Xoá phiên bản bị thay thế đã quá hạn lưu (desc §5.3: 10 năm kể từ lúc bị thay thế), cùng nhận xét,
    /// lượt duyệt và chỉ mục truy vết của chúng. Tài liệu và các phiên bản còn hạn không bị ảnh hưởng.
    ///
    /// Huỷ hồ sơ phải để lại dấu vết (ISO/IEC/IEEE 12207 – quản lý thông tin): mỗi bản bị xoá sinh một sự kiện
    /// [`kinds::VERSION_PURGED`] có ghi nhật ký, ghi vào outbox **trong cùng transaction** với việc xoá – không có
    /// chuyện xoá mà không có dòng nhật ký, hay có dòng nhật ký mà bản vẫn còn. Chỉ mục truy vết (module khác) được
    /// xoá trước, idempotent: transaction lỗi thì lần chạy sau làm lại. Trả về số bản đã xoá.
    pub async fn purge_expired_versions(&self) -> AppResult<u64> {
        let years = self.settings.superseded_retention_years as i64;
        let cutoff = bson::DateTime::from_chrono(chrono::Utc::now() - chrono::Duration::days(365 * years + years / 4));
        let expired: Vec<VersionDoc> = self
            .c
            .versions
            .find(doc! { "status": "superseded", "superseded_at": { "$lt": cutoff } })
            .projection(doc! { "content": 0 })
            .limit(500)
            .await?
            .try_collect()
            .await?;
        let doc_ids: Vec<&DocumentId> = expired.iter().map(|v| &v.document_id).collect();
        let docs: HashMap<DocumentId, DocumentDoc> = self
            .c
            .documents
            .find(doc! { "_id": { "$in": doc_ids } })
            .await?
            .try_collect::<Vec<_>>()
            .await?
            .into_iter()
            .map(|d| (d.id.clone(), d))
            .collect();
        let mut purged = 0u64;
        for v in &expired {
            self.trace.forget_version(&v.id).await?;
            let d = docs.get(&v.document_id);
            let event = DomainEvent::new(kinds::VERSION_PURGED, "version", v.id.as_str())
                .workspace(&v.workspace_id)
                .data(json!({
                    "document_id": v.document_id, "version_id": v.id,
                    "code": d.map(|d| d.code.as_str()), "title": d.map(|d| d.title.as_str()), "version": v.version,
                    "published_at": v.published_at.map(dt), "superseded_at": v.superseded_at.map(dt),
                    "retention_years": years,
                }))
                .audit();
            let (c, vid) = (self.c.clone(), v.id.clone());
            let deleted = with_txn(self.mongo.client(), move |s| {
                let (c, vid, mut event) = (c.clone(), vid.clone(), event.clone());
                Box::pin(async move {
                    let r = c.versions.delete_one(doc! { "_id": &vid, "status": "superseded" }).session(&mut *s).await?;
                    if r.deleted_count == 0 {
                        return Ok(false); // tiến trình khác vừa xoá
                    }
                    let comments = c.comments.delete_many(doc! { "version_id": &vid }).session(&mut *s).await?;
                    let reviews = c.reviews.delete_many(doc! { "version_id": &vid }).session(&mut *s).await?;
                    event.data["comments"] = json!(comments.deleted_count);
                    event.data["reviews"] = json!(reviews.deleted_count);
                    c.bus.publish_in(s, event).await?;
                    Ok(true)
                })
            })
            .await?;
            if deleted {
                purged += 1;
                tracing::info!(version_id = %v.id, document_id = %v.document_id, version = %v.version, "Đã xoá phiên bản quá hạn lưu");
            }
        }
        Ok(purged)
    }
}

#[async_trait::async_trait]
impl DocumentsApi for DocumentService {
    async fn document(&self, id: &DocumentId) -> AppResult<Option<DocumentBrief>> {
        Ok(self.c.documents.find_one(doc! { "_id": id }).await?.as_ref().map(brief))
    }

    async fn version(&self, id: &VersionId) -> AppResult<Option<VersionBrief>> {
        Ok(self.c.versions.find_one(doc! { "_id": id }).projection(doc! { "content": 0 }).await?.map(|v| VersionBrief {
            id: v.id,
            document_id: v.document_id,
            version: v.version,
            status: v.status,
            editor_id: v.editor_id,
        }))
    }

    async fn doc_perms(&self, user: &UserId, document: &DocumentId) -> AppResult<Option<DocPerms>> {
        let Some(d) = self.c.documents.find_one(doc! { "_id": document }).await? else { return Ok(None) };
        let Some(a) = self.access.workspace_access(user, &d.workspace_id).await? else { return Ok(None) };
        let working = self.working_of(&d).await?;
        let viewer = Viewer::new(user, &a);
        let mut p = a.doc_perms_in(&d.group_id);
        // `view` ở đây nghĩa là thấy được tài liệu (một phiên bản hiện hành) – không chỉ có quyền trong phạm vi.
        p.view = policy::can_see_document(&viewer, &d, working.as_ref());
        Ok(Some(p))
    }

    async fn viewable_published(&self, viewer: &UserId, workspace: &WorkspaceId) -> AppResult<Vec<DocumentBrief>> {
        let Some(a) = self.access.workspace_access(viewer, workspace).await? else { return Ok(vec![]) };
        let v = Viewer::new(viewer, &a);
        let docs: Vec<DocumentDoc> = self
            .c
            .documents
            .find(doc! { "workspace_id": workspace, "published_version_id": { "$ne": Bson::Null } })
            .await?
            .try_collect()
            .await?;
        Ok(docs.iter().filter(|d| policy::can_view_released(&v, d)).map(brief).collect())
    }

    async fn published_content(&self, viewer: &UserId, document: &DocumentId) -> AppResult<Option<PublishedContent>> {
        let Some(d) = self.c.documents.find_one(doc! { "_id": document }).await? else { return Ok(None) };
        let Some(vid) = d.published_version_id.clone() else { return Ok(None) };
        let Some(a) = self.access.workspace_access(viewer, &d.workspace_id).await? else { return Ok(None) };
        if !policy::can_view_released(&Viewer::new(viewer, &a), &d) {
            return Ok(None);
        }
        let v = self.ver(&vid).await?;
        Ok(Some(PublishedContent { document: brief(&d), version_id: v.id, version: v.version, content: v.content }))
    }

    async fn visible_version_ids(&self, viewer: &UserId, workspace: &WorkspaceId) -> AppResult<Vec<VersionId>> {
        let Some(a) = self.access.workspace_access(viewer, workspace).await? else { return Ok(vec![]) };
        let v = Viewer::new(viewer, &a);
        let (docs, working) = self.docs_with_working(workspace).await?;
        let mut out = Vec::new();
        for d in &docs {
            if let Some(pv) = &d.published_version_id {
                if policy::can_view_released(&v, d) {
                    out.push(pv.clone());
                }
            }
            if let Some(w) = d.working_version_id.as_ref().and_then(|id| working.get(id)) {
                if policy::can_view(&v, d, w) {
                    out.push(w.id.clone());
                }
            }
        }
        Ok(out)
    }

    async fn count_in_group(&self, group: &GroupId) -> AppResult<u64> {
        Ok(self.c.documents.count_documents(doc! { "group_id": group }).await?)
    }

    async fn count_with_subsystem(&self, subsystem: &SubsystemId) -> AppResult<u64> {
        Ok(self.c.documents.count_documents(doc! { "subsystem_id": subsystem }).await?)
    }
}

pub struct DocumentEvents(pub Arc<DocumentService>);

#[async_trait::async_trait]
impl EventHandler for DocumentEvents {
    fn name(&self) -> &'static str {
        "documents.reactions"
    }
    fn interested_in(&self, kind: &str) -> bool {
        kind == kinds::MEMBERSHIP_REMOVED || kind == kinds::TRACE_REVIEW_FLAGS_RAISED
    }
    async fn handle(&self, ev: &DomainEvent) -> AppResult<()> {
        match ev.kind.as_str() {
            kinds::MEMBERSHIP_REMOVED => self.0.on_member_removed(ev).await,
            kinds::TRACE_REVIEW_FLAGS_RAISED => self.0.on_review_flags(ev).await,
            _ => Ok(()),
        }
    }
}
