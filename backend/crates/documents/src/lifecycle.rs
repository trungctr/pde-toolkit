//! Vòng đời phiên bản (desc §5.2) và kiểm tra khi chuyển trạng thái (desc §7.4).
//!
//! | Từ | Hành động | Sang | Ai |
//! | --- | --- | --- | --- |
//! | Dự thảo | Gửi duyệt | Chờ duyệt | có `submit` và là người sửa (hoặc group owner) |
//! | Chờ duyệt | Rút lại | Dự thảo | người gửi duyệt |
//! | Chờ duyệt | Trả lại (bắt buộc lý do) | Dự thảo | có `approve` hoặc group owner |
//! | Chờ duyệt | Duyệt | Đã duyệt | group owner của tài liệu |
//! | Đã duyệt | Mở lại để sửa (bắt buộc lý do) | Dự thảo | có `approve` hoặc `publish` |
//! | Đã duyệt | Phát hành | Đã phát hành (bản trước → Thay thế) | có `publish` |
//! | Đã phát hành | Tạo phiên bản mới | Dự thảo mới | có `edit` |

use crate::model::*;
use crate::policy::{self, Viewer};
use crate::service::{dt, not_found, today, DocumentService};
use crate::template::{self, HeaderCtx};
use bson::{doc, Bson};
use chillcat_kernel::contracts::WorkspaceAccess;
use chillcat_kernel::events::kinds;
use chillcat_kernel::*;
use chillcat_platform::mongo::{now_bson, with_txn};
use futures::TryStreamExt;
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Submit,
    Withdraw,
    Reject,
    Approve,
    Reopen,
    Publish,
}

impl Action {
    /// Trạng thái bản phải đang ở để làm được thao tác này.
    fn required_status(self) -> VersionStatus {
        match self {
            Action::Submit => VersionStatus::Draft,
            Action::Withdraw | Action::Reject | Action::Approve => VersionStatus::Pending,
            Action::Reopen | Action::Publish => VersionStatus::Approved,
        }
    }
    fn review(self) -> ReviewAction {
        match self {
            Action::Submit => ReviewAction::Submit,
            Action::Withdraw => ReviewAction::Withdraw,
            Action::Reject => ReviewAction::Reject,
            Action::Approve => ReviewAction::Approve,
            Action::Reopen => ReviewAction::Reopen,
            Action::Publish => ReviewAction::Publish,
        }
    }
    fn event(self) -> &'static str {
        match self {
            Action::Submit => kinds::VERSION_SUBMITTED,
            Action::Withdraw => kinds::VERSION_WITHDRAWN,
            Action::Reject => kinds::VERSION_REJECTED,
            Action::Approve => kinds::VERSION_APPROVED,
            Action::Reopen => kinds::VERSION_REOPENED,
            Action::Publish => kinds::VERSION_PUBLISHED,
        }
    }
}

fn parse_version(v: &str) -> (u32, u32) {
    let mut it = v.split('.').map(|p| p.parse::<u32>().unwrap_or(0));
    (it.next().unwrap_or(0), it.next().unwrap_or(0))
}

/// 0.1 → 0.2 (bản chưa phát hành lần nào, mỗi vòng sửa lại một số).
pub fn bump_minor(v: &str) -> String {
    let (m, n) = parse_version(v);
    format!("{m}.{}", n + 1)
}

/// Số của bản phát hành: lần đầu 1.0; sau đó tăng phần lẻ, hoặc lên số chính nếu chọn "thay đổi lớn" (desc §5.3).
pub fn next_published(prev: Option<&str>, major: bool) -> String {
    match prev {
        None => "1.0".into(),
        Some(p) => {
            let (m, n) = parse_version(p);
            if major {
                format!("{}.0", m + 1)
            } else {
                format!("{m}.{}", n + 1)
            }
        }
    }
}

fn issue(level: IssueLevel, code: &str, message: String, target: Option<String>) -> CheckIssue {
    CheckIssue { level, code: code.to_owned(), message, target }
}

impl DocumentService {
    /// Các kiểm tra trước khi chuyển trạng thái (desc §5.2 điều kiện, §7.4).
    pub(crate) async fn checks(&self, d: &DocumentDoc, v: &VersionDoc, action: Action, a: &WorkspaceAccess) -> AppResult<Vec<CheckIssue>> {
        let mut out = Vec::new();
        if !matches!(action, Action::Submit | Action::Publish) {
            return Ok(out);
        }
        let ups: Vec<LinkDoc> = self.c.links.find(doc! { "from_document_id": &d.id }).await?.try_collect().await?;
        let target_ids: Vec<DocumentId> = ups.iter().map(|l| l.to_document_id.clone()).collect();
        let targets: HashMap<DocumentId, DocumentDoc> = self
            .c
            .documents
            .find(doc! { "_id": { "$in": &target_ids } })
            .await?
            .try_collect::<Vec<_>>()
            .await?
            .into_iter()
            .map(|t| (t.id.clone(), t))
            .collect();
        let report = self.trace.lint(&Self::version_content(d, v, &v.content)).await?;

        match action {
            Action::Submit => {
                let t = Self::doc_type(&d.type_code)?;
                let content = template::set_header_rows(
                    &v.content,
                    &[("Phiên bản", &v.version), ("Ngày", &today()), ("Trạng thái", VersionStatus::Pending.label_vi())],
                );
                for h in template::check_header(
                    &content,
                    &HeaderCtx {
                        doc_type: t,
                        code: &d.code,
                        subsystem_code: d.subsystem_code.as_deref(),
                        process_no: d.process_no.map(|n| n as u8),
                    },
                ) {
                    out.push(issue(
                        IssueLevel::Error,
                        "header.incomplete",
                        format!("Bảng thuộc tính – {}: {}", h.row, h.reason),
                        Some(h.row),
                    ));
                }
                for l in ups.iter().filter(|l| l.kind == LinkKind::Up) {
                    if let Some(t) = targets.get(&l.to_document_id) {
                        if t.published_version_id.is_none() && t.working_status == Some(VersionStatus::Draft) {
                            out.push(issue(
                                IssueLevel::Warning,
                                "link.upstream_draft",
                                format!("Tài liệu tầng trên {} còn ở Dự thảo", t.code),
                                Some(t.code.clone()),
                            ));
                        }
                    }
                }
                for i in report.issues.iter().filter(|i| i.level >= IssueLevel::Warning) {
                    let msg = if i.level == IssueLevel::Error {
                        format!("{} (sẽ chặn khi phát hành)", i.message)
                    } else {
                        i.message.clone()
                    };
                    out.push(issue(IssueLevel::Warning, &i.code, msg, i.trace_code.clone()));
                }
            }
            Action::Publish => {
                for l in ups.iter().filter(|l| l.kind == LinkKind::Up) {
                    if let Some(t) = targets.get(&l.to_document_id) {
                        if t.published_version_id.is_none() {
                            out.push(issue(
                                IssueLevel::Error,
                                "link.upstream_unpublished",
                                format!("Tài liệu tầng trên {} chưa phát hành – phát hành tài liệu tầng trên trước", t.code),
                                Some(t.code.clone()),
                            ));
                        }
                    }
                }
                for l in &ups {
                    if let Some(t) = targets.get(&l.to_document_id) {
                        if t.security < d.security {
                            out.push(issue(
                                IssueLevel::Warning,
                                "link.narrower_security",
                                format!(
                                    "Tài liệu trỏ tới {} có mức bảo mật hẹp hơn ({} < {}) – người đọc có thể không mở được",
                                    t.code,
                                    t.security.label_vi(),
                                    d.security.label_vi()
                                ),
                                Some(t.code.clone()),
                            ));
                        }
                    }
                }
                if d.security == Security::Public && !a.workspace.allow_public {
                    out.push(issue(
                        IssueLevel::Error,
                        "document.public_disabled",
                        "Workspace đã tắt mức Công khai – đổi mức bảo mật trước".into(),
                        None,
                    ));
                }
                for i in report.issues.iter().filter(|i| i.level >= IssueLevel::Warning) {
                    out.push(issue(i.level, &i.code, i.message.clone(), i.trace_code.clone()));
                }
                for m in template::leftovers(&v.content) {
                    out.push(issue(IssueLevel::Warning, "content.leftover", m, None));
                }
            }
            _ => {}
        }
        Ok(out)
    }

    async fn load_for_action(&self, p: &Principal, vid: &VersionId) -> AppResult<(DocumentDoc, VersionDoc, WorkspaceAccess)> {
        let v = self.ver(vid).await?;
        let d = self.doc(&v.document_id).await?;
        let a = self.access_for(&p.user_id, &d.workspace_id).await?;
        if !policy::can_view(&Viewer::new(&p.user_id, &a), &d, &v) {
            return Err(not_found());
        }
        Ok((d, v, a))
    }

    /// Xem trước kết quả kiểm tra (giao diện hiện cảnh báo để người dùng xác nhận).
    pub async fn preview_checks(&self, p: &Principal, vid: &VersionId, action: Action) -> AppResult<Vec<CheckIssue>> {
        let (d, v, a) = self.load_for_action(p, vid).await?;
        self.checks(&d, &v, action, &a).await
    }

    pub async fn transition(&self, p: &Principal, vid: &VersionId, action: Action, input: TransitionInput) -> AppResult<DocumentDetailDto> {
        let (d, v, a) = self.load_for_action(p, vid).await?;
        if d.working_version_id.as_ref() != Some(&v.id) {
            return Err(AppError::conflict("document.not_working", "Đây không phải bản đang soạn / duyệt của tài liệu"));
        }
        if v.status != action.required_status() {
            return Err(AppError::conflict(
                "document.wrong_status",
                format!("Bản {} đang ở trạng thái {} – không thực hiện được thao tác này", v.version, v.status.label_vi()),
            ));
        }
        let viewer = Viewer::new(&p.user_id, &a);
        let caps = policy::capabilities(&viewer, &d, Some(&v));
        let (allowed, denied) = match action {
            Action::Submit => (caps.submit, "Cần quyền gửi duyệt và là người được chỉ định sửa bản này"),
            Action::Withdraw => (caps.withdraw, "Chỉ người đã gửi duyệt được rút lại"),
            Action::Reject => (caps.reject, "Cần quyền xem xét duyệt (approve) hoặc là group owner"),
            Action::Approve => (caps.approve, "Việc duyệt do group owner của tài liệu thực hiện"),
            Action::Reopen => (caps.reopen, "Cần quyền xem xét duyệt hoặc phát hành"),
            Action::Publish => (caps.publish, "Cần quyền phát hành"),
        };
        if !allowed {
            return Err(AppError::forbidden("document.action_forbidden", denied));
        }
        let comment = input.comment.as_deref().map(str::trim).filter(|c| !c.is_empty()).map(str::to_owned);
        if matches!(action, Action::Reject | Action::Reopen) && comment.is_none() {
            return Err(AppError::unprocessable("document.reason_required", "Ghi lý do để người soạn biết cần sửa gì"));
        }
        let issues = self.checks(&d, &v, action, &a).await?;
        if issues.iter().any(|i| i.level == IssueLevel::Error) {
            return Err(AppError::unprocessable("document.check_failed", "Chưa đủ điều kiện – xem danh sách vấn đề")
                .with_details(json!({ "issues": issues })));
        }
        if !input.acknowledge_warnings && issues.iter().any(|i| i.level == IssueLevel::Warning) {
            return Err(AppError::conflict("document.check_warnings", "Có cảnh báo cần xác nhận trước khi tiếp tục")
                .with_details(json!({ "issues": issues })));
        }

        let now = now_bson();
        let date = today();
        let actor = self.display_name(&p.user_id).await?;
        let (new_status, label) = match action {
            Action::Submit => (VersionStatus::Pending, v.version.clone()),
            Action::Approve => (VersionStatus::Approved, v.version.clone()),
            Action::Withdraw | Action::Reject | Action::Reopen => {
                (VersionStatus::Draft, if d.ever_published { v.version.clone() } else { bump_minor(&v.version) })
            }
            Action::Publish => (VersionStatus::Published, next_published(d.published_version.as_deref(), input.major)),
        };
        let mut desc = match action {
            Action::Reject => format!("Trả lại: {}", comment.clone().unwrap_or_default()),
            Action::Reopen => format!("Mở lại để sửa: {}", comment.clone().unwrap_or_default()),
            Action::Publish if input.major => "Phát hành (thay đổi lớn)".into(),
            _ => action.review().label_vi().into(),
        };
        if let (Some(c), Action::Submit | Action::Approve | Action::Publish | Action::Withdraw) = (&comment, action) {
            desc.push_str(" – ");
            desc.push_str(c);
        }
        let content =
            template::set_header_rows(&v.content, &[("Phiên bản", &label), ("Ngày", &date), ("Trạng thái", new_status.label_vi())]);
        let content = template::append_history(&content, &label, &date, &desc, &actor);

        let mut vset = doc! {
            "status": bson::to_bson(&new_status)?, "working": new_status.is_working(), "version": &label,
            "content": &content, "updated_at": now, "updated_by": &p.user_id,
        };
        let mut dset = doc! { "updated_at": now };
        let round = if action == Action::Submit { v.review_round + 1 } else { v.review_round };
        match action {
            Action::Submit => {
                vset.insert("submitted_by", &p.user_id);
                vset.insert("submitted_at", now);
                vset.insert("review_round", round);
            }
            Action::Withdraw | Action::Reject | Action::Reopen => {
                // Lượt duyệt trước không áp dụng cho lần gửi duyệt sau (desc §5.2).
                vset.insert("submitted_by", Bson::Null);
                vset.insert("approved_by", Bson::Null);
                vset.insert("approved_at", Bson::Null);
            }
            Action::Approve => {
                vset.insert("approved_by", &p.user_id);
                vset.insert("approved_at", now);
            }
            Action::Publish => {
                vset.insert("published_by", &p.user_id);
                vset.insert("published_at", now);
                if let Some(c) = &comment {
                    vset.insert("change_note", c);
                }
                dset.insert("published_version_id", &v.id);
                dset.insert("published_version", &label);
                dset.insert("published_at", now);
                dset.insert("ever_published", true);
            }
        }
        if new_status.is_working() {
            dset.insert("working_status", bson::to_bson(&new_status)?);
            dset.insert("working_version", &label);
        } else {
            dset.insert("working_version_id", Bson::Null);
            dset.insert("working_version", Bson::Null);
            dset.insert("working_status", Bson::Null);
            dset.insert("working_editor_id", Bson::Null);
        }

        // Người nhận thông báo – chọn theo quyền xem bản ở trạng thái mới.
        let mut notify: Vec<UserId> = Vec::new();
        match action {
            Action::Submit => {
                notify.extend(self.access.users_with_doc_perm(&d.workspace_id, &d.group_id, DocPerm::Approve).await?);
            }
            Action::Reject | Action::Reopen => {
                notify.extend(v.editor_id.clone());
                notify.extend(v.submitted_by.clone());
            }
            Action::Approve => {
                notify.extend(self.access.users_with_doc_perm(&d.workspace_id, &d.group_id, DocPerm::Publish).await?);
                notify.extend(v.submitted_by.clone());
            }
            Action::Publish => {
                notify.push(d.created_by.clone());
                notify.push(d.owner_id.clone());
                notify.extend(v.editor_id.clone());
            }
            Action::Withdraw => {}
        }
        let review = ReviewDoc {
            id: ReviewId::new(),
            document_id: d.id.clone(),
            version_id: v.id.clone(),
            version: label.clone(),
            review_round: round,
            action: action.review(),
            actor_id: p.user_id.clone(),
            comment: comment.clone(),
            created_at: now,
        };
        let event = DomainEvent::new(action.event(), "version", v.id.as_str())
            .workspace(&d.workspace_id)
            .actor(&p.user_id)
            .data(json!({
                "document_id": d.id, "version_id": v.id, "code": d.code, "title": d.title, "version": label,
                "comment": comment, "group_id": d.group_id, "previous_version_id": d.published_version_id,
                "security": d.security, "major": input.major,
            }))
            .notify(notify)
            .audit();
        let prev_published = if action == Action::Publish { d.published_version_id.clone() } else { None };
        let (c, vid2, did, old_status, rev) = (self.c.clone(), v.id.clone(), d.id.clone(), v.status, v.revision);
        with_txn(self.mongo.client(), move |s| {
            let (c, vid, did, vset, dset, review, event, prev) =
                (c.clone(), vid2.clone(), did.clone(), vset.clone(), dset.clone(), review.clone(), event.clone(), prev_published.clone());
            Box::pin(async move {
                let r = c
                    .versions
                    .update_one(
                        doc! { "_id": &vid, "status": bson::to_bson(&old_status)?, "revision": rev },
                        doc! { "$set": vset, "$inc": { "revision": 1 } },
                    )
                    .session(&mut *s)
                    .await?;
                if r.modified_count == 0 {
                    return Err(AppError::conflict(
                        "document.concurrent_change",
                        "Phiên bản vừa được người khác thay đổi – tải lại rồi thử lại",
                    ));
                }
                if let Some(prev) = prev {
                    c.versions
                        .update_one(
                            doc! { "_id": &prev, "status": "published" },
                            doc! { "$set": { "status": "superseded", "working": false, "superseded_at": now_bson() } },
                        )
                        .session(&mut *s)
                        .await?;
                }
                c.documents.update_one(doc! { "_id": &did }, doc! { "$set": dset }).session(&mut *s).await?;
                c.reviews.insert_one(&review).session(&mut *s).await?;
                c.bus.publish_in(s, event).await
            })
        })
        .await?;
        if new_status == VersionStatus::Draft && label != v.version {
            let nv = self.ver(&v.id).await?;
            self.trace.index_version(&Self::version_content(&d, &nv, &nv.content)).await?;
        }
        self.detail(p, &d.id).await
    }

    /// Tạo phiên bản mới (dự thảo) chép từ bản đang phát hành (desc §5.2).
    pub async fn new_version(&self, p: &Principal, did: &DocumentId, input: NewVersionInput) -> AppResult<DocumentDetailDto> {
        let d = self.doc(did).await?;
        let a = self.access_for(&p.user_id, &d.workspace_id).await?;
        let viewer = Viewer::new(&p.user_id, &a);
        let working = self.working_of(&d).await?;
        if !policy::can_see_document(&viewer, &d, working.as_ref()) {
            return Err(not_found());
        }
        if working.is_some() {
            return Err(AppError::conflict(
                "document.working_exists",
                "Tài liệu đang có một bản dự thảo / chờ duyệt – mỗi lúc chỉ một bản",
            ));
        }
        if !policy::capabilities(&viewer, &d, None).new_version {
            return Err(AppError::forbidden("document.new_version_forbidden", "Cần quyền sửa tài liệu để tạo phiên bản mới"));
        }
        let editor = input.editor_id.clone().unwrap_or_else(|| p.user_id.clone());
        self.require_editor_perm(&editor, &d).await?;
        let published = self.ver(d.published_version_id.as_ref().ok_or_else(not_found)?).await?;
        let label = next_published(Some(&published.version), false);
        let (now, date) = (now_bson(), today());
        let actor = self.display_name(&p.user_id).await?;
        let content = template::set_header_rows(
            &published.content,
            &[("Phiên bản", &label), ("Ngày", &date), ("Trạng thái", VersionStatus::Draft.label_vi())],
        );
        let content = template::append_history(&content, &label, &date, &format!("Tạo phiên bản mới từ bản {}", published.version), &actor);
        let v = VersionDoc {
            id: VersionId::new(),
            document_id: d.id.clone(),
            workspace_id: d.workspace_id.clone(),
            version: label.clone(),
            status: VersionStatus::Draft,
            working: true,
            content,
            revision: 1,
            change_note: input.change_note.clone().filter(|s| !s.trim().is_empty()),
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
            based_on_version_id: Some(published.id.clone()),
        };
        let review = ReviewDoc {
            id: ReviewId::new(),
            document_id: d.id.clone(),
            version_id: v.id.clone(),
            version: label.clone(),
            review_round: 0,
            action: ReviewAction::Create,
            actor_id: p.user_id.clone(),
            comment: v.change_note.clone(),
            created_at: now,
        };
        let event = DomainEvent::new(kinds::VERSION_CREATED, "version", v.id.as_str())
            .workspace(&d.workspace_id)
            .actor(&p.user_id)
            .data(json!({ "document_id": d.id, "version_id": v.id, "code": d.code, "title": d.title, "version": label, "based_on": published.version }))
            .notify([editor.clone()])
            .audit();
        let dset = doc! {
            "working_version_id": &v.id, "working_version": &label, "working_status": "draft",
            "working_editor_id": &editor, "updated_at": now,
        };
        let (c, v2, did2) = (self.c.clone(), v.clone(), d.id.clone());
        with_txn(self.mongo.client(), move |s| {
            let (c, v, did, dset, review, event) = (c.clone(), v2.clone(), did2.clone(), dset.clone(), review.clone(), event.clone());
            Box::pin(async move {
                c.versions.insert_one(&v).session(&mut *s).await?;
                let r = c
                    .documents
                    .update_one(doc! { "_id": &did, "working_version_id": Bson::Null }, doc! { "$set": dset })
                    .session(&mut *s)
                    .await?;
                if r.modified_count == 0 {
                    return Err(AppError::conflict("document.working_exists", "Tài liệu vừa có bản dự thảo khác"));
                }
                c.reviews.insert_one(&review).session(&mut *s).await?;
                c.bus.publish_in(s, event).await
            })
        })
        .await
        .map_err(|e| {
            if chillcat_platform::mongo::is_duplicate_key_app(&e) {
                AppError::conflict("document.working_exists", "Tài liệu đang có một bản dự thảo / chờ duyệt – mỗi lúc chỉ một bản")
            } else {
                e
            }
        })?;
        self.trace.index_version(&Self::version_content(&d, &v, &v.content)).await?;
        self.detail(p, did).await
    }

    pub(crate) async fn require_editor_perm(&self, user: &UserId, d: &DocumentDoc) -> AppResult<()> {
        let a = self.access_for(user, &d.workspace_id).await?;
        if a.doc_perms_in(&d.group_id).edit {
            Ok(())
        } else {
            Err(AppError::unprocessable("document.editor_no_edit", "Người được chỉ định sửa phải có quyền sửa tài liệu trong group"))
        }
    }

    /// Chuyển người được chỉ định sửa bản dự thảo – người sửa hiện tại hoặc group owner (desc §5.1, đề xuất).
    pub async fn change_editor(&self, p: &Principal, vid: &VersionId, input: ChangeEditor) -> AppResult<DocumentDetailDto> {
        let (d, v, a) = self.load_for_action(p, vid).await?;
        if v.status != VersionStatus::Draft || d.working_version_id.as_ref() != Some(&v.id) {
            return Err(AppError::conflict("document.not_draft", "Chỉ đổi người sửa khi bản đang là dự thảo"));
        }
        if !policy::capabilities(&Viewer::new(&p.user_id, &a), &d, Some(&v)).change_editor {
            return Err(AppError::forbidden(
                "document.change_editor_forbidden",
                "Chỉ người đang sửa hoặc group owner được giao bản dự thảo cho người khác",
            ));
        }
        self.require_editor_perm(&input.user_id, &d).await?;
        let now = now_bson();
        let review = ReviewDoc {
            id: ReviewId::new(),
            document_id: d.id.clone(),
            version_id: v.id.clone(),
            version: v.version.clone(),
            review_round: v.review_round,
            action: ReviewAction::EditorChanged,
            actor_id: p.user_id.clone(),
            comment: Some(self.display_name(&input.user_id).await?),
            created_at: now,
        };
        let event = DomainEvent::new(kinds::VERSION_EDITOR_CHANGED, "version", v.id.as_str())
            .workspace(&d.workspace_id)
            .actor(&p.user_id)
            .data(json!({ "document_id": d.id, "code": d.code, "title": d.title, "version": v.version, "from_user_id": v.editor_id, "to_user_id": input.user_id }))
            .notify([input.user_id.clone()])
            .audit();
        let (c, vid2, did, to) = (self.c.clone(), v.id.clone(), d.id.clone(), input.user_id.clone());
        with_txn(self.mongo.client(), move |s| {
            let (c, vid, did, to, review, event) = (c.clone(), vid2.clone(), did.clone(), to.clone(), review.clone(), event.clone());
            Box::pin(async move {
                c.versions
                    .update_one(doc! { "_id": &vid, "status": "draft" }, doc! { "$set": { "editor_id": &to, "updated_at": now } })
                    .session(&mut *s)
                    .await?;
                c.documents
                    .update_one(doc! { "_id": &did }, doc! { "$set": { "working_editor_id": &to, "updated_at": now } })
                    .session(&mut *s)
                    .await?;
                c.reviews.insert_one(&review).session(&mut *s).await?;
                c.bus.publish_in(s, event).await
            })
        })
        .await?;
        self.detail(p, &d.id).await
    }

    /// Lịch sử gửi duyệt / duyệt / phát hành của các phiên bản người gọi xem được.
    pub async fn reviews(&self, p: &Principal, did: &DocumentId) -> AppResult<Vec<ReviewDto>> {
        let d = self.doc(did).await?;
        let a = self.access_for(&p.user_id, &d.workspace_id).await?;
        let viewer = Viewer::new(&p.user_id, &a);
        let versions: Vec<VersionDoc> =
            self.c.versions.find(doc! { "document_id": did }).projection(doc! { "content": 0 }).await?.try_collect().await?;
        let visible: Vec<VersionId> = versions.iter().filter(|v| policy::can_view(&viewer, &d, v)).map(|v| v.id.clone()).collect();
        if visible.is_empty() {
            return Err(not_found());
        }
        let list: Vec<ReviewDoc> = self
            .c
            .reviews
            .find(doc! { "document_id": did, "version_id": { "$in": &visible } })
            .sort(doc! { "_id": -1 })
            .await?
            .try_collect()
            .await?;
        let users = self.identity.users(&list.iter().map(|r| r.actor_id.clone()).collect::<Vec<_>>()).await?;
        Ok(list
            .into_iter()
            .map(|r| ReviewDto {
                actor: users.get(&r.actor_id).cloned(),
                action_label: r.action.label_vi(),
                id: r.id,
                version_id: r.version_id,
                version: r.version,
                review_round: r.review_round,
                action: r.action,
                actor_id: r.actor_id,
                comment: r.comment,
                created_at: dt(r.created_at),
            })
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_numbers_follow_desc_5_3() {
        assert_eq!(bump_minor("0.1"), "0.2");
        assert_eq!(bump_minor("0.9"), "0.10");
        assert_eq!(next_published(None, false), "1.0");
        assert_eq!(next_published(None, true), "1.0");
        assert_eq!(next_published(Some("1.0"), false), "1.1");
        assert_eq!(next_published(Some("1.4"), true), "2.0");
    }
}
