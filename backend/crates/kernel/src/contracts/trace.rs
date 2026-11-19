use crate::error::AppResult;
use crate::id::{DocumentId, GroupId, VersionId, WorkspaceId};
use crate::model::IssueLevel;
use serde::{Deserialize, Serialize};

/// Nội dung một phiên bản gửi sang module traceability để đọc mã truy vết (§7.2). Kèm đủ thông tin mô tả
/// tài liệu để chỉ mục truy vết tự đứng được (không phải gọi ngược lại module documents).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VersionContent {
    pub workspace_id: WorkspaceId,
    pub group_id: GroupId,
    pub document_id: DocumentId,
    pub document_code: String,
    pub document_title: String,
    /// Mã loại tài liệu – quyết định tài liệu này được **định nghĩa** những loại mã nào.
    pub type_code: String,
    /// Mã hệ thống con của tài liệu (tài liệu loại "mỗi hệ thống con"), ví dụ `ORD`.
    pub subsystem_code: Option<String>,
    pub version_id: VersionId,
    pub version: String,
    pub content: String,
}

/// Một kết quả kiểm tra về mã truy vết.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TraceIssue {
    pub level: IssueLevel,
    /// Mã máy đọc: `trace.duplicate_definition`, `trace.unknown_reference`, `trace.retired_reference`…
    pub code: String,
    /// Thông điệp tiếng Việt.
    pub message: String,
    pub trace_code: Option<String>,
    /// Mục (tiêu đề gần nhất phía trên) nơi mã xuất hiện.
    pub section: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct TraceReport {
    /// Các mã mà nội dung này định nghĩa.
    pub defined: Vec<String>,
    /// Các mã mà nội dung này tham chiếu (không tính mã tự định nghĩa).
    pub referenced: Vec<String>,
    pub issues: Vec<TraceIssue>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TraceElementBrief {
    pub code: String,
    /// Loại mã: `StR`, `BP`, `UC`, `FR`…
    pub kind: String,
    pub document_id: DocumentId,
    pub document_code: String,
    /// `draft` (mới có trong bản chưa phát hành) · `active` · `retired`.
    pub status: String,
}

#[async_trait::async_trait]
pub trait TraceApi: Send + Sync {
    /// Đọc lại mã truy vết của một bản đang soạn và **lưu** chỉ mục (gọi mỗi lần lưu nội dung). Idempotent.
    async fn index_version(&self, input: &VersionContent) -> AppResult<TraceReport>;
    /// Như [`TraceApi::index_version`] nhưng **không lưu** – dùng để cảnh báo khi soạn, và kiểm tra khi gửi duyệt /
    /// phát hành (§7.4) theo sổ mã hiện hành.
    async fn lint(&self, input: &VersionContent) -> AppResult<TraceReport>;
    /// Xoá chỉ mục của một phiên bản (bản dự thảo bị huỷ, phiên bản cũ hết hạn lưu).
    async fn forget_version(&self, version: &VersionId) -> AppResult<()>;
    /// Xoá chỉ mục của cả tài liệu (tài liệu chưa từng phát hành bị xoá).
    async fn forget_document(&self, document: &DocumentId) -> AppResult<()>;
    /// Các mã truy vết đã biết xuất hiện trong một đoạn văn bản (ví dụ nội dung ticket).
    async fn elements_in_text(&self, workspace: &WorkspaceId, text: &str) -> AppResult<Vec<TraceElementBrief>>;
    /// Các tài liệu định nghĩa hoặc tham chiếu ít nhất một trong các mã.
    async fn documents_using(&self, workspace: &WorkspaceId, codes: &[String]) -> AppResult<Vec<DocumentId>>;
}
