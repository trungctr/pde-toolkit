//! Shared kernel của ChillCat Studio backend.
//!
//! Crate này là **hợp đồng** giữa các module nghiệp vụ. Nó không có I/O và không biết MongoDB hay HTTP:
//!
//! - [`id`]: mã định danh có kiểu (UUID v7 dạng chuỗi).
//! - [`error`]: [`AppError`] – lỗi nghiệp vụ dùng chung, ánh xạ sang HTTP ở `chillcat-platform`.
//! - [`perms`]: quyền tài liệu và quyền người dùng (desc §4).
//! - [`model`]: các enum dùng ở nhiều module (phạm vi, mức bảo mật, trạng thái phiên bản…).
//! - [`auth`]: danh tính người gọi sau khi xác thực.
//! - [`contracts`]: trait mà module này gọi sang module khác. Trong monolith, trait được cài đặt trong
//!   cùng tiến trình; khi tách microservice, thay bằng client HTTP/gRPC mà không sửa module gọi.
//! - [`events`]: sự kiện miền đi qua outbox – kênh duy nhất để module báo cho module khác biết việc đã xảy ra.

pub mod auth;
pub mod codes;
pub mod contracts;
pub mod error;
pub mod events;
pub mod id;
pub mod model;
pub mod page;
pub mod perms;

pub use auth::{Principal, SystemRole};
pub use error::{AppError, AppResult, ErrorKind};
pub use events::{DomainEvent, EventHandler};
pub use id::*;
pub use model::*;
pub use page::{Page, PageQuery};
pub use perms::{DocPerm, DocPerms, UserPerm, UserPerms};

/// Thời điểm hiện tại (UTC). Gom về một chỗ để dễ thay khi cần đồng hồ giả trong kiểm thử.
pub fn now() -> chrono::DateTime<chrono::Utc> {
    chrono::Utc::now()
}
