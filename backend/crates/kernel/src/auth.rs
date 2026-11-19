//! Danh tính người gọi sau khi xác thực (lấy từ access token).

use crate::id::{SessionId, UserId};
use serde::{Deserialize, Serialize};

/// Vai trò trong toàn hệ thống (cột `system_role` ở desc §8). Vai trò trong workspace / group nằm ở `memberships`.
///
/// `Admin` quản trị tài khoản (khoá / mở, đổi vai trò). Admin **không** mặc nhiên xem được tài liệu hay
/// ticket của workspace nào – quyền đó vẫn đi theo membership (đặc quyền tối thiểu).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SystemRole {
    Admin,
    User,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Principal {
    pub user_id: UserId,
    pub system_role: SystemRole,
    /// Phiên đăng nhập (refresh token) đã sinh ra access token này.
    pub session_id: SessionId,
}

impl Principal {
    pub fn is_admin(&self) -> bool {
        self.system_role == SystemRole::Admin
    }
}
