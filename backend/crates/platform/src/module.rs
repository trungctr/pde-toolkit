//! Giao diện chung của một module nghiệp vụ.
//!
//! `apps/server` chỉ biết các module qua trait này: khởi tạo (chỉ mục, dữ liệu gốc), router HTTP, handler
//! sự kiện và tác vụ định kỳ. Nhờ vậy một module có thể chuyển sang tiến trình riêng với đúng những thứ đó.

use axum::Router;
use chillcat_kernel::{AppResult, EventHandler};
use futures::future::BoxFuture;
use std::sync::Arc;
use std::time::Duration;

/// Tác vụ nền chạy định kỳ (ví dụ xoá phiên bản hết hạn lưu).
#[derive(Clone)]
pub struct Job {
    pub name: &'static str,
    pub every: Duration,
    pub run: Arc<dyn Fn() -> BoxFuture<'static, AppResult<()>> + Send + Sync>,
}

impl Job {
    pub fn new<F, Fut>(name: &'static str, every: Duration, f: F) -> Self
    where
        F: Fn() -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = AppResult<()>> + Send + 'static,
    {
        Job { name, every, run: Arc::new(move || Box::pin(f())) }
    }
}

#[async_trait::async_trait]
pub trait Module: Send + Sync {
    /// Tên ngắn, cũng là khoá cấu hình `MONGODB_DB_<NAME>`: `identity`, `workspaces`, `documents`…
    fn name(&self) -> &'static str;

    /// Tạo chỉ mục, nạp dữ liệu gốc. Idempotent – chạy mỗi lần khởi động.
    async fn init(&self) -> AppResult<()>;

    /// Các route của module, đường dẫn tính từ `/api/v1`.
    fn router(&self) -> Router;

    /// Handler sự kiện miền của module (mặc định không có).
    fn event_handlers(&self) -> Vec<Arc<dyn EventHandler>> {
        Vec::new()
    }

    /// Tác vụ định kỳ của module (mặc định không có).
    fn jobs(&self) -> Vec<Job> {
        Vec::new()
    }
}
