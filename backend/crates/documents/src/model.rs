use chillcat_kernel::contracts::UserSummary;
use chillcat_kernel::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------- lưu trữ

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DocumentDoc {
    #[serde(rename = "_id")]
    pub id: DocumentId,
    pub workspace_id: WorkspaceId,
    pub group_id: GroupId,
    pub type_code: String,
    pub subsystem_id: Option<SubsystemId>,
    pub subsystem_code: Option<String>,
    pub process_no: Option<i32>,
    pub code: String,
    pub title: String,
    pub security: Security,
    /// Người phụ trách (ban đầu là người tạo; chuyển cho owner phạm vi khi người đó rời đi – desc §3).
    pub owner_id: UserId,
    pub created_by: UserId,
    pub created_at: bson::DateTime,
    pub updated_at: bson::DateTime,
    pub published_version_id: Option<VersionId>,
    pub published_version: Option<String>,
    pub published_at: Option<bson::DateTime>,
    /// Bản đang soạn / chờ duyệt / đã duyệt (nhiều nhất một).
    pub working_version_id: Option<VersionId>,
    pub working_version: Option<String>,
    pub working_status: Option<VersionStatus>,
    pub working_editor_id: Option<UserId>,
    /// Đã từng phát hành – không xoá được, chỉ lưu trữ (desc §7.4).
    pub ever_published: bool,
    pub archived_at: Option<bson::DateTime>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VersionDoc {
    #[serde(rename = "_id")]
    pub id: VersionId,
    pub document_id: DocumentId,
    pub workspace_id: WorkspaceId,
    pub version: String,
    pub status: VersionStatus,
    /// `true` khi status ∈ {draft, pending, approved} – dùng cho chỉ mục duy nhất "mỗi tài liệu một bản đang soạn".
    pub working: bool,
    /// Có thể vắng khi đọc danh sách (projection bỏ nội dung).
    #[serde(default)]
    pub content: String,
    /// Tăng mỗi lần ghi nội dung (khoá lạc quan khi lưu từ trình soạn).
    pub revision: i64,
    pub change_note: Option<String>,
    pub created_by: UserId,
    pub created_at: bson::DateTime,
    /// Người duy nhất được sửa bản dự thảo (desc §5.1).
    pub editor_id: Option<UserId>,
    pub updated_by: Option<UserId>,
    pub updated_at: bson::DateTime,
    pub review_round: i32,
    pub submitted_by: Option<UserId>,
    pub submitted_at: Option<bson::DateTime>,
    pub approved_by: Option<UserId>,
    pub approved_at: Option<bson::DateTime>,
    pub published_by: Option<UserId>,
    pub published_at: Option<bson::DateTime>,
    /// Lúc bị bản mới thay thế – mốc tính hạn lưu 10 năm (desc §5.3).
    pub superseded_at: Option<bson::DateTime>,
    pub based_on_version_id: Option<VersionId>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReviewAction {
    Create,
    Submit,
    Withdraw,
    Reject,
    Approve,
    Reopen,
    Publish,
    EditorChanged,
}

impl ReviewAction {
    pub fn label_vi(self) -> &'static str {
        match self {
            ReviewAction::Create => "Tạo phiên bản",
            ReviewAction::Submit => "Gửi duyệt",
            ReviewAction::Withdraw => "Rút lại",
            ReviewAction::Reject => "Trả lại",
            ReviewAction::Approve => "Duyệt",
            ReviewAction::Reopen => "Mở lại để sửa",
            ReviewAction::Publish => "Phát hành",
            ReviewAction::EditorChanged => "Đổi người sửa",
        }
    }
}

/// Mỗi lượt gửi duyệt / duyệt / trả lại… – nguồn của bảng Lịch sử thay đổi (desc §8 `document_reviews`).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReviewDoc {
    #[serde(rename = "_id")]
    pub id: ReviewId,
    pub document_id: DocumentId,
    pub version_id: VersionId,
    pub version: String,
    pub review_round: i32,
    pub action: ReviewAction,
    pub actor_id: UserId,
    pub comment: Option<String>,
    pub created_at: bson::DateTime,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CommentDoc {
    #[serde(rename = "_id")]
    pub id: CommentId,
    pub workspace_id: WorkspaceId,
    pub document_id: DocumentId,
    pub version_id: VersionId,
    pub parent_id: Option<CommentId>,
    pub author_id: UserId,
    /// Mục / đoạn được nhận xét (tiêu đề gần nhất hoặc đoạn trích).
    pub anchor: Option<String>,
    pub body: String,
    pub created_at: bson::DateTime,
    pub edited_at: Option<bson::DateTime>,
    pub resolved_at: Option<bson::DateTime>,
    pub resolved_by: Option<UserId>,
    #[serde(default)]
    pub deleted: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LinkKind {
    /// ↑ tầng trên: nơi định nghĩa các mã tài liệu này dùng.
    Up,
    /// ⇄ ngang hàng.
    Peer,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LinkDoc {
    #[serde(rename = "_id")]
    pub id: LinkId,
    pub workspace_id: WorkspaceId,
    pub from_document_id: DocumentId,
    pub to_document_id: DocumentId,
    pub kind: LinkKind,
    pub is_default: bool,
    pub created_by: Option<UserId>,
    pub created_at: bson::DateTime,
}

// ------------------------------------------------------------------- API

/// Những gì người gọi được làm với tài liệu / bản đang soạn – giao diện dùng để hiện nút.
#[derive(Clone, Debug, Default, Serialize)]
pub struct Capabilities {
    pub view: bool,
    pub comment: bool,
    pub edit_content: bool,
    pub submit: bool,
    pub withdraw: bool,
    pub reject: bool,
    pub approve: bool,
    pub reopen: bool,
    pub publish: bool,
    pub new_version: bool,
    pub change_editor: bool,
    pub change_security: bool,
    pub edit_meta: bool,
    pub manage_links: bool,
    pub archive: bool,
    pub delete: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct VersionSummaryDto {
    pub id: VersionId,
    pub version: String,
    pub status: VersionStatus,
    pub status_label: &'static str,
    pub editor_id: Option<UserId>,
    pub editor: Option<UserSummary>,
    pub review_round: i32,
    pub change_note: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub approved_at: Option<DateTime<Utc>>,
    pub published_at: Option<DateTime<Utc>>,
    pub superseded_at: Option<DateTime<Utc>>,
    /// Người gọi xem được nội dung bản này.
    pub viewable: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct VersionDto {
    #[serde(flatten)]
    pub summary: VersionSummaryDto,
    pub document_id: DocumentId,
    pub content: String,
    pub revision: i64,
    pub based_on_version_id: Option<VersionId>,
    pub capabilities: Capabilities,
}

#[derive(Clone, Debug, Serialize)]
pub struct DocumentDto {
    pub id: DocumentId,
    pub workspace_id: WorkspaceId,
    pub group_id: GroupId,
    pub group_name: Option<String>,
    pub type_code: String,
    pub type_name: Option<String>,
    pub type_family: Option<String>,
    pub subsystem_id: Option<SubsystemId>,
    pub subsystem_code: Option<String>,
    pub process_no: Option<i32>,
    pub code: String,
    pub title: String,
    pub security: Security,
    pub security_label: &'static str,
    pub owner_id: UserId,
    pub owner: Option<UserSummary>,
    pub created_by: UserId,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub published_version_id: Option<VersionId>,
    pub published_version: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub working_version_id: Option<VersionId>,
    pub working_version: Option<String>,
    pub working_status: Option<VersionStatus>,
    pub working_status_label: Option<&'static str>,
    pub working_editor_id: Option<UserId>,
    pub archived: bool,
    pub ever_published: bool,
    /// Người gọi xem được bản đang soạn (không chỉ bản phát hành).
    pub working_visible: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct LinkDto {
    pub id: LinkId,
    pub kind: LinkKind,
    /// `up` · `down` · `peer` – nhìn từ tài liệu đang xem.
    pub direction: &'static str,
    pub is_default: bool,
    pub document_id: DocumentId,
    pub code: String,
    pub title: String,
    pub type_code: String,
    pub security: Security,
    pub published_version: Option<String>,
    pub working_status: Option<VersionStatus>,
}

#[derive(Clone, Debug, Serialize)]
pub struct DocumentDetailDto {
    pub document: DocumentDto,
    pub versions: Vec<VersionSummaryDto>,
    pub links: Vec<LinkDto>,
    pub capabilities: Capabilities,
}

#[derive(Clone, Debug, Serialize)]
pub struct ReviewDto {
    pub id: ReviewId,
    pub version_id: VersionId,
    pub version: String,
    pub review_round: i32,
    pub action: ReviewAction,
    pub action_label: &'static str,
    pub actor_id: UserId,
    pub actor: Option<UserSummary>,
    pub comment: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize)]
pub struct CommentDto {
    pub id: CommentId,
    pub version_id: VersionId,
    pub parent_id: Option<CommentId>,
    pub author_id: UserId,
    pub author: Option<UserSummary>,
    pub anchor: Option<String>,
    pub body: String,
    pub created_at: DateTime<Utc>,
    pub edited_at: Option<DateTime<Utc>>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<UserId>,
    pub can_edit: bool,
    pub can_resolve: bool,
}

/// Một vấn đề khi kiểm tra trước gửi duyệt / phát hành / khi soạn.
#[derive(Clone, Debug, Serialize)]
pub struct CheckIssue {
    pub level: IssueLevel,
    pub code: String,
    pub message: String,
    pub target: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct LintDto {
    pub issues: Vec<CheckIssue>,
    pub defined: Vec<String>,
    pub referenced: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct SaveResultDto {
    pub revision: i64,
    pub updated_at: DateTime<Utc>,
    pub lint: LintDto,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicDocumentDto {
    pub code: String,
    pub title: String,
    pub version: String,
    pub published_at: Option<DateTime<Utc>>,
    pub content: String,
}

// ----------------------------------------------------------------- đầu vào

#[derive(Clone, Debug, Deserialize)]
pub struct CreateDocument {
    pub type_code: String,
    pub group_id: GroupId,
    pub subsystem_id: Option<SubsystemId>,
    pub process_no: Option<u8>,
    pub process_name: Option<String>,
    /// Mã module điền vào chỗ `MOD` của mẫu (ví dụ `CART`).
    pub module_code: Option<String>,
    pub title: Option<String>,
    pub security: Option<Security>,
    /// Nội dung riêng thay cho mẫu (ví dụ nhập từ file .md có sẵn).
    pub content: Option<String>,
    /// Người được chỉ định sửa bản đầu tiên (mặc định: người tạo).
    pub editor_id: Option<UserId>,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub struct DocumentQuery {
    pub type_code: Option<String>,
    pub group_id: Option<String>,
    pub subsystem_id: Option<String>,
    /// `draft` · `pending` · `approved` · `published` · `review` (Cần rà soát)
    pub status: Option<String>,
    pub q: Option<String>,
    #[serde(default)]
    pub archived: bool,
}

#[derive(Clone, Debug, Deserialize)]
pub struct SaveContent {
    pub content: String,
    /// Số `revision` mà trình soạn đang giữ; khác bản trên máy chủ ⇒ 409 (có người khác vừa lưu).
    pub revision: i64,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub struct TransitionInput {
    pub comment: Option<String>,
    /// Xác nhận đã đọc các cảnh báo (desc §7.4 mức "Cảnh báo").
    #[serde(default)]
    pub acknowledge_warnings: bool,
    /// Phát hành: chọn "thay đổi lớn" ⇒ lên số chính (2.0).
    #[serde(default)]
    pub major: bool,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub struct NewVersionInput {
    pub editor_id: Option<UserId>,
    pub change_note: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ChangeEditor {
    pub user_id: UserId,
}

#[derive(Clone, Debug, Deserialize)]
pub struct UpdateDocument {
    pub title: Option<String>,
    pub security: Option<Security>,
    /// Bắt buộc `true` khi chuyển sang mức Công khai (desc §6).
    #[serde(default)]
    pub confirm_public: bool,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CreateLink {
    pub to_document_id: DocumentId,
    pub kind: LinkKind,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CreateComment {
    pub body: String,
    pub anchor: Option<String>,
    pub parent_id: Option<CommentId>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct EditComment {
    pub body: String,
}

#[derive(Clone, Debug, Deserialize)]
pub struct LintInput {
    pub content: String,
}
