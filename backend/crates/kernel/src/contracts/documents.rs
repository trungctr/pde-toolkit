use crate::error::AppResult;
use crate::id::{DocumentId, GroupId, UserId, VersionId, WorkspaceId};
use crate::model::{Security, VersionStatus};
use crate::perms::DocPerms;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DocumentBrief {
    pub id: DocumentId,
    pub workspace_id: WorkspaceId,
    pub group_id: GroupId,
    /// Mã loại tài liệu (`SRS`, `SDD`…).
    pub type_code: String,
    /// Mã tài liệu, ví dụ `SHOP-SRS-ORD-001`.
    pub code: String,
    pub title: String,
    pub security: Security,
    /// Người phụ trách.
    pub owner_id: UserId,
    pub published_version_id: Option<VersionId>,
    /// Nhãn phiên bản đang phát hành (`1.0`).
    pub published_version: Option<String>,
    pub archived: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct VersionBrief {
    pub id: VersionId,
    pub document_id: DocumentId,
    pub version: String,
    pub status: VersionStatus,
    pub editor_id: Option<UserId>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PublishedContent {
    pub document: DocumentBrief,
    pub version_id: VersionId,
    pub version: String,
    /// Nội dung Markdown của bản đang phát hành.
    pub content: String,
}

/// Những gì module khác (tickets) cần ở module documents. Các hàm nhận `viewer` đều **tự kiểm tra quyền**
/// của người đó theo §5.1, §6, §9 – người gọi không phải (và không được) tự suy diễn quyền tài liệu.
#[async_trait::async_trait]
pub trait DocumentsApi: Send + Sync {
    /// Tra cứu không kiểm tra quyền – chỉ dùng để xác thực liên kết (tài liệu / phiên bản có tồn tại, thuộc đâu).
    async fn document(&self, id: &DocumentId) -> AppResult<Option<DocumentBrief>>;
    async fn version(&self, id: &VersionId) -> AppResult<Option<VersionBrief>>;
    /// Quyền tài liệu hiệu lực của `user` đối với tài liệu (`None` nếu tài liệu không tồn tại).
    async fn doc_perms(&self, user: &UserId, document: &DocumentId) -> AppResult<Option<DocPerms>>;
    /// Các tài liệu trong workspace có bản đang phát hành mà `viewer` được xem.
    async fn viewable_published(&self, viewer: &UserId, workspace: &WorkspaceId) -> AppResult<Vec<DocumentBrief>>;
    /// Nội dung bản đang phát hành, hoặc `None` nếu không có / `viewer` không được xem.
    async fn published_content(&self, viewer: &UserId, document: &DocumentId) -> AppResult<Option<PublishedContent>>;
    /// Mọi phiên bản (đang soạn hoặc đã phát hành) trong workspace mà `viewer` được xem – để lọc dữ liệu truy vết.
    async fn visible_version_ids(&self, viewer: &UserId, workspace: &WorkspaceId) -> AppResult<Vec<VersionId>>;
    /// Số tài liệu (kể cả đã lưu trữ) thuộc group – chặn xoá group còn tài liệu.
    async fn count_in_group(&self, group: &GroupId) -> AppResult<u64>;
    /// Số tài liệu gắn với hệ thống con – chặn xoá hệ thống con đang dùng.
    async fn count_with_subsystem(&self, subsystem: &crate::id::SubsystemId) -> AppResult<u64>;
}
