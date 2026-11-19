//! Hợp đồng giữa các module.
//!
//! Một module chỉ được gọi module khác qua các trait ở đây (nhận dưới dạng `Arc<dyn …>` khi khởi tạo).
//! Không module nào đọc collection của module khác. Trong monolith, `apps/server` nối trait với phần cài
//! đặt trong cùng tiến trình; khi tách dịch vụ, thay bằng client gọi qua mạng.
//!
//! | Trait | Module cài đặt | Module gọi |
//! | --- | --- | --- |
//! | [`IdentityApi`] | identity | workspaces, documents, tickets |
//! | [`AccessApi`] | workspaces | documents, traceability, tickets, audit |
//! | [`DocumentsApi`] | documents | tickets |
//! | [`TraceApi`] | traceability | documents, tickets |

mod access;
mod documents;
mod identity;
mod late;
mod trace;

pub use access::*;
pub use documents::*;
pub use identity::*;
pub use late::Late;
pub use trace::*;
