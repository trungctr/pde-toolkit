use chillcat_kernel::contracts::{GroupInfo, SubsystemInfo, UserSummary, WorkspaceInfo};
use chillcat_kernel::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------- lưu trữ

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkspaceDoc {
    #[serde(rename = "_id")]
    pub id: WorkspaceId,
    pub code: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub owner_id: UserId,
    pub allow_public: bool,
    pub created_at: bson::DateTime,
    pub updated_at: bson::DateTime,
}

impl WorkspaceDoc {
    pub fn info(&self) -> WorkspaceInfo {
        WorkspaceInfo {
            id: self.id.clone(),
            code: self.code.clone(),
            name: self.name.clone(),
            owner_id: self.owner_id.clone(),
            allow_public: self.allow_public,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GroupDoc {
    #[serde(rename = "_id")]
    pub id: GroupId,
    pub workspace_id: WorkspaceId,
    pub name: String,
    /// Tên viết thường – khoá duy nhất trong workspace.
    pub name_key: String,
    #[serde(default)]
    pub description: String,
    pub owner_id: UserId,
    pub created_at: bson::DateTime,
}

impl GroupDoc {
    pub fn info(&self) -> GroupInfo {
        GroupInfo { id: self.id.clone(), workspace_id: self.workspace_id.clone(), name: self.name.clone(), owner_id: self.owner_id.clone() }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SubsystemDoc {
    #[serde(rename = "_id")]
    pub id: SubsystemId,
    pub workspace_id: WorkspaceId,
    pub code: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub created_at: bson::DateTime,
}

impl SubsystemDoc {
    pub fn info(&self) -> SubsystemInfo {
        SubsystemInfo { id: self.id.clone(), workspace_id: self.workspace_id.clone(), code: self.code.clone(), name: self.name.clone() }
    }
}

/// Quyền của một người trong một phạm vi (thay cho `user_previlage` + `doc_previlage` cũ – desc §8).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MembershipDoc {
    #[serde(rename = "_id")]
    pub id: MembershipId,
    pub workspace_id: WorkspaceId,
    pub user_id: UserId,
    pub scope_type: ScopeType,
    /// `workspace_id` khi `scope_type = workspace`, `group_id` khi `scope_type = group`.
    pub scope_id: String,
    pub is_owner: bool,
    pub user_perms: UserPerms,
    pub doc_perms: DocPerms,
    pub invited_by: Option<UserId>,
    pub joined_at: bson::DateTime,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InvitationStatus {
    Pending,
    Accepted,
    Declined,
    Expired,
    Revoked,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InvitationDoc {
    #[serde(rename = "_id")]
    pub id: InvitationId,
    pub workspace_id: WorkspaceId,
    pub scope_type: ScopeType,
    pub scope_id: String,
    pub email: String,
    pub user_perms: UserPerms,
    pub doc_perms: DocPerms,
    pub invited_by: UserId,
    pub status: InvitationStatus,
    pub expires_at: bson::DateTime,
    pub created_at: bson::DateTime,
    pub decided_at: Option<bson::DateTime>,
    pub accepted_by: Option<UserId>,
}

// ------------------------------------------------------------------- API

#[derive(Clone, Debug, Serialize)]
pub struct WorkspaceDto {
    pub id: WorkspaceId,
    pub code: String,
    pub name: String,
    pub description: String,
    pub owner_id: UserId,
    pub owner: Option<UserSummary>,
    pub allow_public: bool,
    pub created_at: DateTime<Utc>,
    /// Quyền của người gọi trong workspace này.
    pub me: Option<MyAccessDto>,
}

/// Tóm tắt quyền của người gọi – giao diện dùng để ẩn / hiện nút.
#[derive(Clone, Debug, Serialize)]
pub struct MyAccessDto {
    pub is_workspace_owner: bool,
    pub is_member: bool,
    /// Quyền người dùng ở phạm vi workspace.
    pub workspace_user_perms: UserPerms,
    /// Quyền tài liệu ở phạm vi workspace (chưa tính group).
    pub workspace_doc_perms: DocPerms,
    pub groups: Vec<MyGroupAccessDto>,
}

#[derive(Clone, Debug, Serialize)]
pub struct MyGroupAccessDto {
    pub group_id: GroupId,
    pub is_owner: bool,
    /// Quyền tài liệu hiệu lực với tài liệu của group (đã gộp workspace + group, lấy bao đóng).
    pub doc_perms: DocPerms,
    pub user_perms: UserPerms,
}

#[derive(Clone, Debug, Serialize)]
pub struct DirectoryEntryDto {
    pub id: WorkspaceId,
    pub code: String,
    pub name: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct GroupDto {
    pub id: GroupId,
    pub workspace_id: WorkspaceId,
    pub name: String,
    pub description: String,
    pub owner_id: UserId,
    pub owner: Option<UserSummary>,
    pub member_count: u64,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize)]
pub struct SubsystemDto {
    pub id: SubsystemId,
    pub workspace_id: WorkspaceId,
    pub code: String,
    pub name: String,
    pub description: String,
    pub created_at: DateTime<Utc>,
}

impl From<&SubsystemDoc> for SubsystemDto {
    fn from(s: &SubsystemDoc) -> Self {
        SubsystemDto {
            id: s.id.clone(),
            workspace_id: s.workspace_id.clone(),
            code: s.code.clone(),
            name: s.name.clone(),
            description: s.description.clone(),
            created_at: s.created_at.to_chrono(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct MembershipDto {
    pub id: MembershipId,
    pub scope_type: ScopeType,
    pub scope_id: String,
    pub is_owner: bool,
    pub user_perms: UserPerms,
    pub doc_perms: DocPerms,
    pub invited_by: Option<UserId>,
    pub joined_at: DateTime<Utc>,
}

impl From<&MembershipDoc> for MembershipDto {
    fn from(m: &MembershipDoc) -> Self {
        MembershipDto {
            id: m.id.clone(),
            scope_type: m.scope_type,
            scope_id: m.scope_id.clone(),
            is_owner: m.is_owner,
            user_perms: m.user_perms,
            doc_perms: m.doc_perms,
            invited_by: m.invited_by.clone(),
            joined_at: m.joined_at.to_chrono(),
        }
    }
}

/// Một người trong workspace và mọi membership của họ.
#[derive(Clone, Debug, Serialize)]
pub struct MemberDto {
    pub user: UserSummary,
    pub is_workspace_owner: bool,
    pub memberships: Vec<MembershipDto>,
}

#[derive(Clone, Debug, Serialize)]
pub struct InvitationDto {
    pub id: InvitationId,
    pub workspace_id: WorkspaceId,
    pub workspace_code: Option<String>,
    pub workspace_name: Option<String>,
    pub scope_type: ScopeType,
    pub scope_id: String,
    pub scope_name: Option<String>,
    pub email: String,
    pub user_perms: UserPerms,
    pub doc_perms: DocPerms,
    pub invited_by: UserId,
    pub inviter: Option<UserSummary>,
    pub status: InvitationStatus,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

// ----------------------------------------------------------------- đầu vào

#[derive(Clone, Debug, Deserialize)]
pub struct CreateWorkspace {
    pub code: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    /// Tên group mặc định (người tạo làm group owner). Mặc định "Chung".
    #[serde(default)]
    pub default_group_name: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct UpdateWorkspace {
    pub name: Option<String>,
    pub description: Option<String>,
    pub allow_public: Option<bool>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct TransferOwnership {
    pub user_id: UserId,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CreateGroup {
    pub name: String,
    #[serde(default)]
    pub description: String,
    /// Group owner; mặc định là người tạo.
    pub owner_id: Option<UserId>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct UpdateGroup {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct AssignGroupOwner {
    pub user_id: UserId,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CreateSubsystem {
    pub code: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Clone, Debug, Deserialize)]
pub struct UpdateSubsystem {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct UpdateMembership {
    pub doc_perms: Option<DocPerms>,
    pub user_perms: Option<UserPerms>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CreateInvitation {
    pub email: String,
    pub scope_type: ScopeType,
    /// Bỏ trống khi mời vào workspace.
    pub scope_id: Option<String>,
    #[serde(default)]
    pub doc_perms: Option<DocPerms>,
    #[serde(default)]
    pub user_perms: Option<UserPerms>,
}
