use crate::auth::SystemRole;
use crate::error::AppResult;
use crate::id::UserId;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Thông tin công khai của một người dùng – đủ để hiện tên, ảnh đại diện trong mọi danh sách.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct UserSummary {
    pub id: UserId,
    pub email: String,
    pub employee_code: String,
    pub first_name: String,
    pub last_name: String,
    /// Tên hiển thị kiểu Việt Nam: họ trước, tên sau (`last_name first_name`).
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub system_role: SystemRole,
    /// Tài khoản đã bị khoá (không đăng nhập được; vẫn hiện tên ở dữ liệu cũ).
    pub disabled: bool,
}

#[async_trait::async_trait]
pub trait IdentityApi: Send + Sync {
    async fn user(&self, id: &UserId) -> AppResult<Option<UserSummary>>;
    /// Tra nhiều người một lần; mã không tồn tại thì không có trong kết quả.
    async fn users(&self, ids: &[UserId]) -> AppResult<HashMap<UserId, UserSummary>>;
    /// Tìm theo e-mail (không phân biệt hoa thường).
    async fn user_by_email(&self, email: &str) -> AppResult<Option<UserSummary>>;
}
