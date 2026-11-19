use chillcat_kernel::contracts::UserSummary;
use chillcat_kernel::{SessionId, SystemRole, UserId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UserDoc {
    #[serde(rename = "_id")]
    pub id: UserId,
    /// Luôn ở dạng chữ thường (khoá duy nhất).
    pub email: String,
    /// Mã nhân viên – duy nhất khi có.
    pub employee_code: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub avatar_url: Option<String>,
    pub system_role: SystemRole,
    pub password_hash: String,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default)]
    pub failed_logins: i32,
    pub locked_until: Option<bson::DateTime>,
    pub created_at: bson::DateTime,
    pub updated_at: bson::DateTime,
}

impl UserDoc {
    pub fn display_name(&self) -> String {
        display_name(&self.last_name, &self.first_name)
    }

    pub fn summary(&self) -> UserSummary {
        UserSummary {
            id: self.id.clone(),
            email: self.email.clone(),
            employee_code: self.employee_code.clone().unwrap_or_default(),
            first_name: self.first_name.clone(),
            last_name: self.last_name.clone(),
            display_name: self.display_name(),
            avatar_url: self.avatar_url.clone(),
            system_role: self.system_role,
            disabled: self.disabled,
        }
    }
}

/// Họ trước, tên sau (cách gọi tên của người Việt).
pub fn display_name(last: &str, first: &str) -> String {
    format!("{} {}", last.trim(), first.trim()).trim().to_owned()
}

/// Một phiên đăng nhập = một refresh token. Token có dạng `<session_id>.<secret>`; chỉ lưu SHA-256 của `secret`.
/// Mỗi lần làm mới, `secret` được thay (xoay vòng); dùng lại secret cũ ⇒ phiên bị thu hồi (nghi bị lộ token).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionDoc {
    #[serde(rename = "_id")]
    pub id: SessionId,
    pub user_id: UserId,
    pub secret_hash: String,
    pub user_agent: Option<String>,
    pub created_at: bson::DateTime,
    pub last_used_at: bson::DateTime,
    pub expires_at: bson::DateTime,
    pub revoked_at: Option<bson::DateTime>,
}

#[derive(Clone, Debug, Serialize)]
pub struct UserDto {
    pub id: UserId,
    pub email: String,
    pub employee_code: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub system_role: SystemRole,
    pub disabled: bool,
    pub created_at: DateTime<Utc>,
}

impl From<&UserDoc> for UserDto {
    fn from(u: &UserDoc) -> Self {
        UserDto {
            id: u.id.clone(),
            email: u.email.clone(),
            employee_code: u.employee_code.clone(),
            first_name: u.first_name.clone(),
            last_name: u.last_name.clone(),
            display_name: u.display_name(),
            avatar_url: u.avatar_url.clone(),
            system_role: u.system_role,
            disabled: u.disabled,
            created_at: u.created_at.to_chrono(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub token_type: &'static str,
    /// Số giây access token còn hiệu lực.
    pub expires_in: u64,
    /// Refresh token. Trình duyệt cùng origin dùng cookie HttpOnly `cc_refresh` thay vì giữ giá trị này.
    pub refresh_token: String,
    pub refresh_expires_in: u64,
    pub user: UserDto,
}

#[derive(Clone, Debug, Deserialize)]
pub struct RegisterInput {
    pub email: String,
    pub password: String,
    pub first_name: String,
    pub last_name: String,
    #[serde(default)]
    pub employee_code: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub struct RefreshInput {
    #[serde(default)]
    pub refresh_token: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ProfileInput {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    /// `""` để xoá.
    pub avatar_url: Option<String>,
    /// `""` để xoá.
    pub employee_code: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct PasswordInput {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Clone, Debug, Deserialize)]
pub struct AdminUserInput {
    pub system_role: Option<SystemRole>,
    pub disabled: Option<bool>,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub struct UserListQuery {
    /// Tìm theo e-mail, tên, mã nhân viên (không phân biệt hoa thường).
    pub q: Option<String>,
    pub limit: Option<u32>,
    pub after: Option<String>,
}
