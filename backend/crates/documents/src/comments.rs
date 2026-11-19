//! Nhận xét theo phiên bản (desc §4.2 quyền `comment`, §8 `comments`).

use crate::model::*;
use crate::policy::{self, Viewer};
use crate::service::{dt, not_found, DocumentService};
use bson::doc;
use chillcat_kernel::events::kinds;
use chillcat_kernel::*;
use chillcat_platform::mongo::{now_bson, with_txn};
use futures::TryStreamExt;
use serde_json::json;

fn clean_body(s: &str) -> AppResult<String> {
    let s = s.trim();
    if s.is_empty() || s.chars().count() > 10_000 {
        return Err(AppError::unprocessable("comment.invalid", "Nhận xét không được trống, tối đa 10 000 ký tự"));
    }
    Ok(s.to_owned())
}

impl DocumentService {
    async fn comment_ctx(
        &self,
        p: &Principal,
        vid: &VersionId,
    ) -> AppResult<(DocumentDoc, VersionDoc, chillcat_kernel::contracts::WorkspaceAccess)> {
        let v = self.ver(vid).await?;
        let d = self.doc(&v.document_id).await?;
        let a = self.access_for(&p.user_id, &d.workspace_id).await?;
        if !policy::can_view(&Viewer::new(&p.user_id, &a), &d, &v) {
            return Err(not_found());
        }
        Ok((d, v, a))
    }

    fn can_resolve(p: &Principal, d: &DocumentDoc, v: &VersionDoc, c: &CommentDoc, group_owner: bool) -> bool {
        c.author_id == p.user_id || v.editor_id.as_ref() == Some(&p.user_id) || d.owner_id == p.user_id || group_owner
    }

    pub async fn comments(&self, p: &Principal, vid: &VersionId) -> AppResult<Vec<CommentDto>> {
        let (d, v, a) = self.comment_ctx(p, vid).await?;
        let list: Vec<CommentDoc> =
            self.c.comments.find(doc! { "version_id": vid, "deleted": false }).sort(doc! { "_id": 1 }).await?.try_collect().await?;
        let users = self.identity.users(&list.iter().map(|c| c.author_id.clone()).collect::<Vec<_>>()).await?;
        let go = a.is_group_owner(&d.group_id);
        Ok(list
            .iter()
            .map(|c| CommentDto {
                id: c.id.clone(),
                version_id: c.version_id.clone(),
                parent_id: c.parent_id.clone(),
                author_id: c.author_id.clone(),
                author: users.get(&c.author_id).cloned(),
                anchor: c.anchor.clone(),
                body: c.body.clone(),
                created_at: dt(c.created_at),
                edited_at: c.edited_at.map(dt),
                resolved_at: c.resolved_at.map(dt),
                resolved_by: c.resolved_by.clone(),
                can_edit: c.author_id == p.user_id || go,
                can_resolve: c.parent_id.is_none() && Self::can_resolve(p, &d, &v, c, go),
            })
            .collect())
    }

    pub async fn add_comment(&self, p: &Principal, vid: &VersionId, input: CreateComment) -> AppResult<Vec<CommentDto>> {
        let (d, v, a) = self.comment_ctx(p, vid).await?;
        if !policy::can_comment(&Viewer::new(&p.user_id, &a), &d, &v) {
            return Err(AppError::forbidden("comment.forbidden", "Bạn không có quyền nhận xét tài liệu này"));
        }
        let mut notify = vec![d.owner_id.clone()];
        notify.extend(v.editor_id.clone());
        if let Some(pid) = &input.parent_id {
            let parent = self
                .c
                .comments
                .find_one(doc! { "_id": pid, "version_id": vid, "deleted": false })
                .await?
                .ok_or_else(|| AppError::unprocessable("comment.invalid_parent", "Nhận xét được trả lời không thuộc bản này"))?;
            if parent.parent_id.is_some() {
                return Err(AppError::unprocessable("comment.nested", "Chỉ trả lời nhận xét gốc"));
            }
            notify.push(parent.author_id);
        }
        let c = CommentDoc {
            id: CommentId::new(),
            workspace_id: d.workspace_id.clone(),
            document_id: d.id.clone(),
            version_id: v.id.clone(),
            parent_id: input.parent_id.clone(),
            author_id: p.user_id.clone(),
            anchor: input.anchor.as_deref().map(|a| a.trim().chars().take(300).collect::<String>()).filter(|a| !a.is_empty()),
            body: clean_body(&input.body)?,
            created_at: now_bson(),
            edited_at: None,
            resolved_at: None,
            resolved_by: None,
            deleted: false,
        };
        self.c.comments.insert_one(&c).await?;
        self.c
            .bus
            .publish(
                DomainEvent::new(kinds::COMMENT_CREATED, "version", v.id.as_str())
                    .workspace(&d.workspace_id)
                    .actor(&p.user_id)
                    .data(json!({
                        "document_id": d.id, "version_id": v.id, "code": d.code, "title": d.title, "version": v.version,
                        "comment_id": c.id, "anchor": c.anchor, "excerpt": c.body.chars().take(140).collect::<String>(),
                    }))
                    .notify(notify),
            )
            .await?;
        self.comments(p, vid).await
    }

    async fn own_comment(&self, p: &Principal, id: &CommentId) -> AppResult<(CommentDoc, DocumentDoc, VersionDoc, bool)> {
        let c = self
            .c
            .comments
            .find_one(doc! { "_id": id, "deleted": false })
            .await?
            .ok_or_else(|| AppError::not_found("comment.not_found", "Không tìm thấy nhận xét"))?;
        let (d, v, a) = self.comment_ctx(p, &c.version_id).await?;
        let go = a.is_group_owner(&d.group_id);
        Ok((c, d, v, go))
    }

    pub async fn edit_comment(&self, p: &Principal, id: &CommentId, input: EditComment) -> AppResult<Vec<CommentDto>> {
        let (c, ..) = self.own_comment(p, id).await?;
        if c.author_id != p.user_id {
            return Err(AppError::forbidden("comment.not_author", "Chỉ người viết được sửa nhận xét"));
        }
        self.c
            .comments
            .update_one(doc! { "_id": id }, doc! { "$set": { "body": clean_body(&input.body)?, "edited_at": now_bson() } })
            .await?;
        self.comments(p, &c.version_id).await
    }

    /// Xoá (ẩn) nhận xét cùng các trả lời của nó; việc xoá được ghi nhật ký trong cùng transaction.
    pub async fn delete_comment(&self, p: &Principal, id: &CommentId) -> AppResult<Vec<CommentDto>> {
        let (c, d, v, go) = self.own_comment(p, id).await?;
        if c.author_id != p.user_id && !go {
            return Err(AppError::forbidden("comment.not_author", "Chỉ người viết hoặc group owner được xoá nhận xét"));
        }
        let event = DomainEvent::new(kinds::COMMENT_DELETED, "version", v.id.as_str())
            .workspace(&d.workspace_id)
            .actor(&p.user_id)
            .data(json!({
                "document_id": d.id, "version_id": v.id, "code": d.code, "title": d.title, "version": v.version,
                "comment_id": id, "author_id": c.author_id,
            }))
            .audit();
        let (cs, bus, cid) = (self.c.comments.clone(), self.c.bus.clone(), id.clone());
        with_txn(self.mongo.client(), move |s| {
            let (cs, bus, cid, mut event) = (cs.clone(), bus.clone(), cid.clone(), event.clone());
            Box::pin(async move {
                let root = cs.update_one(doc! { "_id": &cid, "deleted": false }, doc! { "$set": { "deleted": true } }).session(&mut *s).await?;
                if root.modified_count == 0 {
                    return Ok(()); // vừa bị xoá
                }
                let replies = cs
                    .update_many(doc! { "parent_id": &cid, "deleted": false }, doc! { "$set": { "deleted": true } })
                    .session(&mut *s)
                    .await?;
                event.data["replies"] = json!(replies.modified_count);
                bus.publish_in(s, event).await
            })
        })
        .await?;
        self.comments(p, &c.version_id).await
    }

    pub async fn resolve_comment(&self, p: &Principal, id: &CommentId, resolved: bool) -> AppResult<Vec<CommentDto>> {
        let (c, d, v, go) = self.own_comment(p, id).await?;
        if c.parent_id.is_some() || !Self::can_resolve(p, &d, &v, &c, go) {
            return Err(AppError::forbidden("comment.resolve_forbidden", "Bạn không đánh dấu đã xử lý được nhận xét này"));
        }
        let set = if resolved {
            doc! { "resolved_at": now_bson(), "resolved_by": &p.user_id }
        } else {
            doc! { "resolved_at": bson::Bson::Null, "resolved_by": bson::Bson::Null }
        };
        self.c.comments.update_one(doc! { "_id": id }, doc! { "$set": set }).await?;
        if resolved {
            self.c
                .bus
                .publish(
                    DomainEvent::new(kinds::COMMENT_RESOLVED, "version", v.id.as_str())
                        .workspace(&d.workspace_id)
                        .actor(&p.user_id)
                        .data(json!({ "document_id": d.id, "code": d.code, "title": d.title, "comment_id": id }))
                        .notify([c.author_id.clone()]),
                )
                .await?;
        }
        self.comments(p, &c.version_id).await
    }
}
