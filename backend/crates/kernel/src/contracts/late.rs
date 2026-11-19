use crate::error::{AppError, AppResult};
use std::sync::{Arc, OnceLock};

/// Tham chiếu tới một hợp đồng được gắn **sau** khi tạo module – dùng khi hai module cần gọi nhau
/// (ví dụ documents ↔ traceability). `apps/server` tạo cả hai, rồi gọi [`Late::set`].
pub struct Late<T: ?Sized>(Arc<OnceLock<Arc<T>>>);

impl<T: ?Sized> Clone for Late<T> {
    fn clone(&self) -> Self {
        Late(self.0.clone())
    }
}

impl<T: ?Sized> Default for Late<T> {
    fn default() -> Self {
        Late(Arc::new(OnceLock::new()))
    }
}

impl<T: ?Sized> Late<T> {
    pub fn new() -> Self {
        Self::default()
    }

    /// Gắn phần cài đặt (chỉ lần đầu có tác dụng).
    pub fn set(&self, value: Arc<T>) {
        let _ = self.0.set(value);
    }

    pub fn get(&self) -> AppResult<&Arc<T>> {
        self.0.get().ok_or_else(|| AppError::internal(format!("Hợp đồng {} chưa được gắn khi khởi động", std::any::type_name::<T>())))
    }
}
