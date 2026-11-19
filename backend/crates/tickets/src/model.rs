use chillcat_kernel::contracts::UserSummary;
use chillcat_kernel::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TicketKind {
    FeatureFeedback,
    Bug,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TicketStatus {
    New,
    Checking,
    Reviewing,
    Accepted,
    InProgress,
    Resolved,
    Deferred,
    Rejected,
    Duplicate,
}

impl TicketStatus {
    pub fn label_vi(self) -> &'static str {
        match self {
            TicketStatus::New => "Mới",
            TicketStatus::Checking => "Đang kiểm tra trùng",
            TicketStatus::Reviewing => "Đang xem xét",
            TicketStatus::Accepted => "Chấp nhận",
            TicketStatus::InProgress => "Đang xử lý",
            TicketStatus::Resolved => "Đã xử lý",
            TicketStatus::Deferred => "Tạm hoãn",
            TicketStatus::Rejected => "Từ chối",
            TicketStatus::Duplicate => "Trùng",
        }
    }

    /// Chuyển trạng thái do người xử lý chọn (desc §5.4, đề xuất). `Trùng` chỉ đặt qua xác nhận trùng;
    /// `Đang kiểm tra trùng` chỉ do hệ thống đặt khi AI chạy.
    pub fn can_move_to(self, to: TicketStatus) -> bool {
        use TicketStatus::*;
        matches!(
            (self, to),
            (New | Checking, Reviewing | Accepted | Deferred | Rejected)
                | (Reviewing, Accepted | Deferred | Rejected)
                | (Accepted, InProgress | Resolved | Deferred | Rejected)
                | (InProgress, Resolved | Accepted | Deferred)
                | (Resolved | Deferred | Rejected | Duplicate, Reviewing)
        )
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TicketDoc {
    #[serde(rename = "_id")]
    pub id: TicketId,
    pub workspace_id: WorkspaceId,
    /// Số thứ tự trong workspace (#12).
    pub number: i64,
    pub group_id: Option<GroupId>,
    pub author_id: UserId,
    pub assignee_id: Option<UserId>,
    pub kind: TicketKind,
    pub title: String,
    pub body: String,
    pub reproduction_steps: Option<String>,
    pub actual_result: Option<String>,
    pub expected_result: Option<String>,
    pub environment: Option<String>,
    pub software_version: Option<String>,
    pub status: TicketStatus,
    pub duplicate_of_ticket_id: Option<TicketId>,
    pub created_at: bson::DateTime,
    pub updated_at: bson::DateTime,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GrantKind {
    View,
    Process,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubjectType {
    User,
    Group,
}

/// Quyền xem / xử lý ticket cấp cho cá nhân hoặc group, ở phạm vi workspace hoặc một group (desc §4.4).
/// Gộp hai bảng `ticket_view_grants` / `ticket_process_grants` của ERD thành một, phân biệt bằng `kind`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GrantDoc {
    #[serde(rename = "_id")]
    pub id: TicketGrantId,
    pub workspace_id: WorkspaceId,
    pub kind: GrantKind,
    pub subject_type: SubjectType,
    pub subject_id: String,
    pub scope_type: ScopeType,
    pub scope_id: String,
    pub granted_by: UserId,
    pub created_at: bson::DateTime,
    pub revoked_at: Option<bson::DateTime>,
}

/// Người được workspace owner uỷ quyền **quyết định** cấp quyền xem / xử lý (không tự có các quyền đó).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DelegationDoc {
    #[serde(rename = "_id")]
    pub id: TicketDelegationId,
    pub workspace_id: WorkspaceId,
    pub delegate_user_id: UserId,
    pub can_decide_view: bool,
    pub can_decide_process: bool,
    pub granted_by: UserId,
    pub created_at: bson::DateTime,
    pub revoked_at: Option<bson::DateTime>,
}

/// Người dùng cho phép AI tự động kiểm tra ticket mới thay mặt mình.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AiDelegationDoc {
    #[serde(rename = "_id")]
    pub id: AiDelegationId,
    pub workspace_id: WorkspaceId,
    pub user_id: UserId,
    pub created_at: bson::DateTime,
    pub revoked_at: Option<bson::DateTime>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckPurpose {
    Duplicates,
    Proposals,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckStatus {
    Pending,
    Completed,
    Failed,
    InsufficientAccess,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckResult {
    CandidatesFound,
    NoneFound,
}

/// Một lần AI chạy cho ticket (desc §8 `ticket_ai_checks`; dùng chung cho kiểm tra trùng và đề xuất tài liệu).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CheckDoc {
    #[serde(rename = "_id")]
    pub id: AiCheckId,
    pub ticket_id: TicketId,
    pub workspace_id: WorkspaceId,
    pub purpose: CheckPurpose,
    /// Người mà AI thay mặt – quyền của người này giới hạn dữ liệu AI được thấy.
    pub acting_user_id: UserId,
    /// `automatic` | `manual`
    pub trigger_mode: String,
    /// `ai` (Claude) | `keyword` (so khớp từ khoá, khi chưa cấu hình AI)
    pub engine: String,
    pub status: CheckStatus,
    pub result: Option<CheckResult>,
    /// Phạm vi đã kiểm tra, ghi cùng kết quả (desc §5.4).
    pub checked_scope: String,
    pub note: Option<String>,
    /// Trạng thái ticket trước khi chuyển sang `checking` – trả lại khi kiểm tra thất bại.
    pub previous_status: Option<TicketStatus>,
    pub created_at: bson::DateTime,
    pub completed_at: Option<bson::DateTime>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CandidateDecision {
    Suggested,
    Confirmed,
    Rejected,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CandidateDoc {
    #[serde(rename = "_id")]
    pub id: DuplicateCandidateId,
    pub check_id: AiCheckId,
    pub ticket_id: TicketId,
    pub candidate_ticket_id: TicketId,
    pub reason: String,
    pub score: f64,
    pub decision: CandidateDecision,
    pub decided_by: Option<UserId>,
    pub decided_at: Option<bson::DateTime>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProposalStatus {
    Proposed,
    Accepted,
    /// Đã đưa vào một bản dự thảo.
    Implemented,
    /// Thay đổi đã có trong bản được phát hành.
    Applied,
    Rejected,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProposalDoc {
    #[serde(rename = "_id")]
    pub id: ProposalId,
    pub ticket_id: TicketId,
    pub workspace_id: WorkspaceId,
    pub check_id: AiCheckId,
    pub document_id: DocumentId,
    pub document_code: String,
    pub based_on_version_id: VersionId,
    pub based_on_version: String,
    pub section: String,
    pub proposed_change: String,
    pub reason: String,
    pub status: ProposalStatus,
    pub draft_version_id: Option<VersionId>,
    pub reviewed_by: Option<UserId>,
    pub created_at: bson::DateTime,
    pub updated_at: bson::DateTime,
}

/// Dòng thời gian của ticket (người xem ticket đều thấy).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ActivityDoc {
    #[serde(rename = "_id")]
    pub id: EventId,
    pub ticket_id: TicketId,
    pub actor_id: Option<UserId>,
    pub action: String,
    pub text: String,
    pub created_at: bson::DateTime,
}

// ------------------------------------------------------------------- API

#[derive(Clone, Debug, Default, Serialize)]
pub struct TicketCaps {
    pub view: bool,
    pub process: bool,
    pub edit: bool,
    pub run_ai: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct TicketDto {
    pub id: TicketId,
    pub workspace_id: WorkspaceId,
    pub workspace_code: Option<String>,
    pub number: i64,
    pub group_id: Option<GroupId>,
    pub author_id: UserId,
    pub author: Option<UserSummary>,
    pub assignee_id: Option<UserId>,
    pub assignee: Option<UserSummary>,
    pub kind: TicketKind,
    pub title: String,
    pub body: String,
    pub reproduction_steps: Option<String>,
    pub actual_result: Option<String>,
    pub expected_result: Option<String>,
    pub environment: Option<String>,
    pub software_version: Option<String>,
    pub status: TicketStatus,
    pub status_label: &'static str,
    /// Ticket gốc khi trùng – chỉ có khi người xem được xem ticket gốc.
    pub duplicate_of: Option<TicketRefDto>,
    /// Đã đánh dấu trùng nhưng người xem không được xem ticket gốc.
    pub duplicate_of_hidden: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub capabilities: TicketCaps,
}

#[derive(Clone, Debug, Serialize)]
pub struct TicketRefDto {
    pub id: TicketId,
    pub number: i64,
    pub title: String,
    pub status: TicketStatus,
}

#[derive(Clone, Debug, Serialize)]
pub struct CandidateDto {
    pub id: DuplicateCandidateId,
    pub ticket: TicketRefDto,
    pub reason: String,
    pub score: f64,
    pub decision: CandidateDecision,
    pub decided_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, Serialize)]
pub struct CheckDto {
    pub id: AiCheckId,
    pub purpose: CheckPurpose,
    pub acting_user: Option<UserSummary>,
    pub trigger_mode: String,
    pub engine: String,
    pub status: CheckStatus,
    pub result: Option<CheckResult>,
    pub checked_scope: String,
    pub note: Option<String>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub candidates: Vec<CandidateDto>,
    /// Số ứng viên trùng người xem không được thấy (ticket ngoài quyền xem). Đề xuất tài liệu bị ẩn được đếm ở
    /// [`TicketDetailDto::hidden_proposals`].
    pub hidden: u32,
}

#[derive(Clone, Debug, Serialize)]
pub struct ProposalDto {
    pub id: ProposalId,
    pub document_id: DocumentId,
    pub document_code: String,
    pub based_on_version: String,
    pub section: String,
    pub proposed_change: String,
    pub reason: String,
    pub status: ProposalStatus,
    pub draft_version_id: Option<VersionId>,
    /// Tài liệu đã có bản phát hành mới hơn bản làm căn cứ – rà soát lại trước khi dùng (desc §5.4).
    pub stale: bool,
    pub can_decide: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize)]
pub struct ActivityDto {
    pub actor: Option<UserSummary>,
    pub action: String,
    pub text: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize)]
pub struct TicketDetailDto {
    pub ticket: TicketDto,
    pub checks: Vec<CheckDto>,
    pub proposals: Vec<ProposalDto>,
    /// Số đề xuất sửa tài liệu bị ẩn vì người xem không xem được tài liệu đó (DECISIONS #41).
    pub hidden_proposals: u32,
    pub activity: Vec<ActivityDto>,
}

#[derive(Clone, Debug, Serialize)]
pub struct GrantDto {
    pub id: TicketGrantId,
    pub kind: GrantKind,
    pub subject_type: SubjectType,
    pub subject_id: String,
    pub subject_name: Option<String>,
    pub scope_type: ScopeType,
    pub scope_id: String,
    pub scope_name: Option<String>,
    pub granted_by: UserId,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize)]
pub struct DelegationDto {
    pub id: TicketDelegationId,
    pub delegate: Option<UserSummary>,
    pub delegate_user_id: UserId,
    pub can_decide_view: bool,
    pub can_decide_process: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize)]
pub struct TicketAccessDto {
    pub grants: Vec<GrantDto>,
    pub delegations: Vec<DelegationDto>,
    pub can_decide_view: bool,
    pub can_decide_process: bool,
    pub can_manage_delegations: bool,
    /// Người gọi đang cho AI tự động kiểm tra ticket mới.
    pub my_ai_delegation: bool,
    pub ai_engine: &'static str,
}

// ----------------------------------------------------------------- đầu vào

#[derive(Clone, Debug, Deserialize)]
pub struct CreateTicket {
    pub kind: TicketKind,
    pub title: String,
    pub body: String,
    pub group_id: Option<GroupId>,
    pub reproduction_steps: Option<String>,
    pub actual_result: Option<String>,
    pub expected_result: Option<String>,
    pub environment: Option<String>,
    pub software_version: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct UpdateTicket {
    pub title: Option<String>,
    pub body: Option<String>,
    pub reproduction_steps: Option<String>,
    pub actual_result: Option<String>,
    pub expected_result: Option<String>,
    pub environment: Option<String>,
    pub software_version: Option<String>,
    /// `""` để bỏ gắn group (chỉ người xử lý).
    pub group_id: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub struct TicketQuery {
    pub status: Option<TicketStatus>,
    pub kind: Option<TicketKind>,
    pub q: Option<String>,
    /// Chỉ ticket mình gửi.
    #[serde(default)]
    pub mine: bool,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ChangeStatus {
    pub status: TicketStatus,
    pub note: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct Assign {
    pub user_id: Option<UserId>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct MarkDuplicate {
    pub original_ticket_id: TicketId,
}

#[derive(Clone, Debug, Deserialize)]
pub struct Decide {
    /// `confirmed` | `rejected` (ứng viên trùng) · `accepted` | `rejected` (đề xuất)
    pub decision: String,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CreateGrant {
    pub kind: GrantKind,
    pub subject_type: SubjectType,
    pub subject_id: String,
    pub scope_type: ScopeType,
    /// Bỏ trống khi phạm vi là workspace.
    pub scope_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CreateDelegation {
    pub user_id: UserId,
    #[serde(default)]
    pub can_decide_view: bool,
    #[serde(default)]
    pub can_decide_process: bool,
}

#[derive(Clone, Debug, Deserialize)]
pub struct SetAiDelegation {
    pub enabled: bool,
}

#[derive(Clone, Debug, Deserialize)]
pub struct LinkDraft {
    /// Bản dự thảo của tài liệu; bỏ trống = bản đang soạn hiện tại.
    pub version_id: Option<VersionId>,
}
