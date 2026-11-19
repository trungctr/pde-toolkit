//! Sự kiện miền.
//!
//! Module ghi sự kiện vào **outbox** (cùng transaction với thay đổi dữ liệu); một tiến trình nền phát sự kiện
//! cho các [`EventHandler`] đã đăng ký. Đây là kênh duy nhất để một module phản ứng với việc xảy ra ở module
//! khác (thông báo, nhật ký, đánh dấu "Cần rà soát", chuyển người phụ trách…). Khi tách microservice, tiến
//! trình nền chuyển sự kiện ra message broker thay vì gọi handler trong cùng tiến trình – module không đổi.
//!
//! Phát **ít nhất một lần**: handler phải idempotent (dùng `event.id` làm khoá chống trùng).

use crate::error::AppResult;
use crate::id::{EventId, UserId, WorkspaceId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DomainEvent {
    pub id: EventId,
    /// Loại sự kiện – một hằng trong [`kinds`], ví dụ `document.version.submitted`.
    pub kind: String,
    pub occurred_at: DateTime<Utc>,
    pub workspace_id: Option<WorkspaceId>,
    /// Người gây ra sự kiện (`None` = hệ thống / tác vụ nền).
    pub actor_id: Option<UserId>,
    /// Đối tượng chính: `document`, `version`, `ticket`, `membership`…
    pub target_type: String,
    pub target_id: String,
    /// Dữ liệu kèm theo (đủ để hiện thông báo / ghi nhật ký mà không phải gọi lại module nguồn).
    pub data: Value,
    /// Người nhận thông báo trong ứng dụng. Module nguồn chọn người nhận theo quyền **tại thời điểm phát**.
    #[serde(default)]
    pub notify: Vec<UserId>,
    /// Có ghi vào nhật ký (audit log) hay không.
    #[serde(default)]
    pub audit: bool,
}

impl DomainEvent {
    pub fn new(kind: &str, target_type: &str, target_id: impl Into<String>) -> Self {
        Self {
            id: EventId::new(),
            kind: kind.to_owned(),
            occurred_at: Utc::now(),
            workspace_id: None,
            actor_id: None,
            target_type: target_type.to_owned(),
            target_id: target_id.into(),
            data: Value::Null,
            notify: Vec::new(),
            audit: false,
        }
    }
    pub fn workspace(mut self, id: &WorkspaceId) -> Self {
        self.workspace_id = Some(id.clone());
        self
    }
    pub fn actor(mut self, id: &UserId) -> Self {
        self.actor_id = Some(id.clone());
        self
    }
    pub fn data(mut self, data: Value) -> Self {
        self.data = data;
        self
    }
    /// Thêm người nhận thông báo; bỏ trùng và bỏ chính người gây ra sự kiện (không tự báo cho mình).
    pub fn notify(mut self, users: impl IntoIterator<Item = UserId>) -> Self {
        for u in users {
            if Some(&u) != self.actor_id.as_ref() && !self.notify.contains(&u) {
                self.notify.push(u);
            }
        }
        self
    }
    pub fn audit(mut self) -> Self {
        self.audit = true;
        self
    }
}

#[async_trait::async_trait]
pub trait EventHandler: Send + Sync {
    /// Tên duy nhất của handler (ghi log, theo dõi lỗi).
    fn name(&self) -> &'static str;
    /// Lọc nhanh theo loại sự kiện; mặc định nhận tất cả.
    fn interested_in(&self, _kind: &str) -> bool {
        true
    }
    /// Xử lý sự kiện. Trả lỗi ⇒ sự kiện được phát lại sau (có giới hạn số lần).
    async fn handle(&self, event: &DomainEvent) -> AppResult<()>;
}

/// Danh mục loại sự kiện. Thêm loại mới ở đây để mọi module (và giao diện) dùng chung một tên.
pub mod kinds {
    // ---- identity
    pub const USER_REGISTERED: &str = "user.registered";
    pub const USER_ROLE_CHANGED: &str = "user.role_changed";
    pub const USER_DISABLED: &str = "user.disabled";
    pub const USER_ENABLED: &str = "user.enabled";

    // ---- workspaces
    pub const WORKSPACE_CREATED: &str = "workspace.created";
    pub const WORKSPACE_UPDATED: &str = "workspace.updated";
    /// data: `{ from_user_id, to_user_id }` · thông báo cho owner mới.
    pub const WORKSPACE_OWNERSHIP_TRANSFERRED: &str = "workspace.ownership_transferred";
    pub const GROUP_CREATED: &str = "group.created";
    pub const GROUP_UPDATED: &str = "group.updated";
    pub const GROUP_DELETED: &str = "group.deleted";
    /// data: `{ group_id, group_name, from_user_id, to_user_id }` · thông báo cho owner mới và owner cũ.
    pub const GROUP_OWNER_ASSIGNED: &str = "group.owner_assigned";
    pub const SUBSYSTEM_CREATED: &str = "subsystem.created";
    pub const SUBSYSTEM_UPDATED: &str = "subsystem.updated";
    pub const SUBSYSTEM_DELETED: &str = "subsystem.deleted";
    /// data: `{ scope_type, scope_id, scope_name, email }` · thông báo cho người được mời nếu đã có tài khoản.
    pub const INVITATION_CREATED: &str = "invitation.created";
    pub const INVITATION_ACCEPTED: &str = "invitation.accepted";
    /// Người được mời từ chối. data: `{ email, scope_type, scope_id }` · thông báo cho người mời.
    pub const INVITATION_DECLINED: &str = "invitation.declined";
    pub const INVITATION_REVOKED: &str = "invitation.revoked";
    pub const MEMBERSHIP_ADDED: &str = "membership.added";
    pub const MEMBERSHIP_PERMS_CHANGED: &str = "membership.perms_changed";
    /// data: `{ user_id, scope_type, scope_id, successor_id, reason: "kicked" | "left" }`.
    /// Module documents nghe sự kiện này để chuyển quyền phụ trách tài liệu cho `successor_id` (§3).
    pub const MEMBERSHIP_REMOVED: &str = "membership.removed";

    // ---- documents
    pub const DOCUMENT_CREATED: &str = "document.created";
    /// Đổi thông tin chung (tên tài liệu). data: `{ code, title, from, to }` (`from` / `to` = tên cũ / mới).
    pub const DOCUMENT_UPDATED: &str = "document.updated";
    pub const DOCUMENT_ARCHIVED: &str = "document.archived";
    pub const DOCUMENT_UNARCHIVED: &str = "document.unarchived";
    pub const DOCUMENT_DELETED: &str = "document.deleted";
    /// data: `{ code, from, to }`.
    pub const DOCUMENT_SECURITY_CHANGED: &str = "document.security_changed";
    pub const DOCUMENT_OWNER_CHANGED: &str = "document.owner_changed";
    /// data: `{ code, to, to_document_id, kind, link_id }` (`to` = mã tài liệu được trỏ tới).
    pub const DOCUMENT_LINK_ADDED: &str = "document.link.added";
    /// data: như [`DOCUMENT_LINK_ADDED`] (thêm `is_default`).
    pub const DOCUMENT_LINK_REMOVED: &str = "document.link.removed";
    /// Bản dự thảo mới được tạo từ bản đang phát hành.
    pub const VERSION_CREATED: &str = "document.version.created";
    /// data: `{ document_id, code, version, from_user_id, to_user_id }` · thông báo cho người sửa mới.
    pub const VERSION_EDITOR_CHANGED: &str = "document.version.editor_changed";
    /// Các sự kiện chuyển trạng thái: data luôn có `{ document_id, code, title, version, comment? }`.
    pub const VERSION_SUBMITTED: &str = "document.version.submitted";
    pub const VERSION_WITHDRAWN: &str = "document.version.withdrawn";
    pub const VERSION_REJECTED: &str = "document.version.rejected";
    pub const VERSION_APPROVED: &str = "document.version.approved";
    pub const VERSION_REOPENED: &str = "document.version.reopened";
    /// data thêm `{ group_id, previous_version_id, security }`. Module traceability và tickets nghe sự kiện này.
    pub const VERSION_PUBLISHED: &str = "document.version.published";
    /// Bản **Thay thế** quá hạn lưu bị xoá hẳn (huỷ hồ sơ – ISO/IEC/IEEE 12207 quản lý thông tin), cùng nhận xét,
    /// lượt duyệt, chỉ mục truy vết của bản đó. Do tác vụ nền phát (`actor_id = None`), luôn ghi nhật ký.
    /// data: `{ document_id, version_id, code, title, version, published_at, superseded_at, retention_years,
    /// comments, reviews }` (`comments` / `reviews` = số dòng bị xoá kèm).
    pub const VERSION_PURGED: &str = "document.version.purged";
    /// Tài liệu cần rà soát vì tài liệu tầng trên đổi / bỏ mã đang được tham chiếu (§7.4).
    /// data: `{ document_id, code, title, trace_code, change, caused_by_document_id, caused_by_code }`.
    pub const DOCUMENT_REVIEW_NEEDED: &str = "document.review_needed";
    pub const COMMENT_CREATED: &str = "comment.created";
    pub const COMMENT_RESOLVED: &str = "comment.resolved";
    /// Nhận xét (và các trả lời của nó) bị xoá. data: `{ document_id, version_id, code, title, version, comment_id,
    /// author_id, replies }`.
    pub const COMMENT_DELETED: &str = "comment.deleted";

    // ---- traceability
    /// data: `{ caused_by_document_id, caused_by_version_id, trace_code, change: "retired" | "changed",
    /// document_ids: [..] }`. Module documents nghe để báo người phụ trách các tài liệu bị ảnh hưởng.
    pub const TRACE_REVIEW_FLAGS_RAISED: &str = "trace.review_flags.raised";
    pub const TRACE_REVIEW_FLAG_DONE: &str = "trace.review_flag.done";
    pub const TRACE_ELEMENT_RETIRED: &str = "trace.element.retired";

    // ---- tickets
    /// data: `{ number, title, kind, group_id? }`. Module tickets tự nghe để chạy AI kiểm tra trùng tự động.
    pub const TICKET_CREATED: &str = "ticket.created";
    /// data: `{ number, title, from, to, note? }` · thông báo cho người gửi và người được giao.
    pub const TICKET_STATUS_CHANGED: &str = "ticket.status_changed";
    pub const TICKET_ASSIGNED: &str = "ticket.assigned";
    /// Sửa nội dung / group của ticket. data: `{ ticket_id, number, title, fields: [..] }` (tên các trường đã đổi).
    pub const TICKET_UPDATED: &str = "ticket.updated";
    pub const TICKET_GRANT_CREATED: &str = "ticket.grant.created";
    pub const TICKET_GRANT_REVOKED: &str = "ticket.grant.revoked";
    pub const TICKET_DELEGATION_CREATED: &str = "ticket.delegation.created";
    pub const TICKET_DELEGATION_REVOKED: &str = "ticket.delegation.revoked";
    pub const TICKET_AI_DELEGATION_SET: &str = "ticket.ai_delegation.set";
    pub const TICKET_AI_DELEGATION_REVOKED: &str = "ticket.ai_delegation.revoked";
    /// data: `{ ticket_id, number, status, result? }` · thông báo cho người mà AI thay mặt.
    pub const TICKET_AI_CHECK_COMPLETED: &str = "ticket.ai_check.completed";
    pub const TICKET_DUPLICATE_DECIDED: &str = "ticket.duplicate.decided";
    pub const TICKET_PROPOSALS_GENERATED: &str = "ticket.proposals.generated";
    /// Chấp nhận / từ chối / mở lại đề xuất, hoặc đưa đề xuất vào bản dự thảo (`status: "implemented"`).
    /// data: `{ ticket_id, number, proposal_id, document_id, code, status, draft_version_id?, draft_version? }`.
    pub const TICKET_PROPOSAL_STATUS_CHANGED: &str = "ticket.proposal.status_changed";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notify_skips_the_actor_and_duplicates() {
        let actor = UserId::new();
        let other = UserId::new();
        let e = DomainEvent::new(kinds::VERSION_SUBMITTED, "version", "v1")
            .actor(&actor)
            .notify([actor.clone(), other.clone(), other.clone()])
            .audit();
        assert_eq!(e.notify, vec![other]);
        assert!(e.audit);
        assert_eq!(e.kind, "document.version.submitted");
    }
}
