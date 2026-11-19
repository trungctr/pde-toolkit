//! Hạ tầng dùng chung cho mọi module.
//!
//! - [`config`]: đọc cấu hình từ biến môi trường.
//! - [`mongo`]: kết nối MongoDB / Atlas, transaction có thử lại, tạo chỉ mục, nhận biết lỗi trùng khoá.
//! - [`outbox`]: ghi sự kiện miền cùng transaction và phát cho handler (ít nhất một lần).
//! - [`http`]: lỗi API dạng JSON, extractor (`Auth`, `ApiJson`, `ApiQuery`, `ApiPath`).
//! - [`jwt`]: ký và kiểm tra access token.
//! - [`module`]: giao diện chung mà `apps/server` dùng để ghép các module.

pub mod config;
pub mod http;
pub mod jwt;
pub mod module;
pub mod mongo;
pub mod outbox;
#[cfg(feature = "testing")]
pub mod testing;

pub use config::Settings;
pub use http::{ApiError, ApiJson, ApiPath, ApiQuery, ApiResult, Auth, MaybeAuth};
pub use jwt::{JwtSigner, JwtVerifier};
pub use module::{Job, Module};
pub use mongo::{ensure_indexes, is_duplicate_key, with_txn, Mongo};
pub use outbox::{EventBus, OutboxRelay};
