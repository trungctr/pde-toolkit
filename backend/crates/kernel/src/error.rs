//! Lỗi dùng chung.
//!
//! [`AppError`] mang: loại (ánh xạ sang mã HTTP), `code` ổn định cho máy đọc (`"document.not_draft"`),
//! `message` tiếng Việt để hiện cho người dùng, `details` tuỳ chọn (ví dụ danh sách cảnh báo).
//!
//! Mọi lỗi hạ tầng (`mongodb::error::Error`, `std::io::Error`…) tự chuyển thành `Internal` qua toán tử `?`
//! – lỗi gốc được giữ lại để ghi log nhưng không lộ ra cho người gọi API. Vì có phép chuyển tổng quát đó,
//! `AppError` cố ý **không** cài `std::error::Error` (cùng cách làm với `anyhow::Error`).

use serde_json::Value;
use std::fmt;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorKind {
    /// 400 – dữ liệu gửi lên sai định dạng / thiếu trường.
    BadRequest,
    /// 401 – chưa đăng nhập hoặc phiên hết hạn.
    Unauthenticated,
    /// 403 – đã đăng nhập, thấy được đối tượng, nhưng không có quyền làm việc này.
    Forbidden,
    /// 404 – không tồn tại, hoặc tồn tại nhưng người gọi không được biết (tránh lộ thông tin).
    NotFound,
    /// 409 – xung đột trạng thái (trùng mã, đã có bản dự thảo, phiên bản đã đổi…).
    Conflict,
    /// 422 – dữ liệu hợp lệ về định dạng nhưng vi phạm quy tắc nghiệp vụ.
    Unprocessable,
    /// 429
    TooManyRequests,
    /// 500
    Internal,
    /// 503 – dịch vụ phụ thuộc (CSDL, AI) tạm không dùng được.
    Unavailable,
}

impl ErrorKind {
    pub fn http_status(self) -> u16 {
        match self {
            ErrorKind::BadRequest => 400,
            ErrorKind::Unauthenticated => 401,
            ErrorKind::Forbidden => 403,
            ErrorKind::NotFound => 404,
            ErrorKind::Conflict => 409,
            ErrorKind::Unprocessable => 422,
            ErrorKind::TooManyRequests => 429,
            ErrorKind::Internal => 500,
            ErrorKind::Unavailable => 503,
        }
    }
}

pub struct AppError {
    pub kind: ErrorKind,
    pub code: String,
    pub message: String,
    pub details: Option<Value>,
    /// Lỗi gốc (chỉ để ghi log và để tầng hạ tầng nhận biết lỗi tạm thời của transaction).
    pub source: Option<Box<dyn std::error::Error + Send + Sync + 'static>>,
}

impl AppError {
    pub fn new(kind: ErrorKind, code: impl Into<String>, message: impl Into<String>) -> Self {
        Self { kind, code: code.into(), message: message.into(), details: None, source: None }
    }
    pub fn bad_request(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(ErrorKind::BadRequest, code, message)
    }
    pub fn unauthenticated(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Unauthenticated, "auth.unauthenticated", message)
    }
    pub fn forbidden(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Forbidden, code, message)
    }
    pub fn not_found(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(ErrorKind::NotFound, code, message)
    }
    pub fn conflict(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Conflict, code, message)
    }
    pub fn unprocessable(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Unprocessable, code, message)
    }
    pub fn unavailable(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Unavailable, code, message)
    }
    /// Lỗi nội bộ có thông điệp riêng (không có lỗi gốc).
    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Internal, "internal", message)
    }
    /// Đổi mã lỗi máy đọc (giữ loại và thông điệp).
    pub fn with_code(mut self, code: impl Into<String>) -> Self {
        self.code = code.into();
        self
    }
    pub fn with_details(mut self, details: Value) -> Self {
        self.details = Some(details);
        self
    }
    pub fn with_source(mut self, source: impl std::error::Error + Send + Sync + 'static) -> Self {
        self.source = Some(Box::new(source));
        self
    }
    pub fn is(&self, kind: ErrorKind) -> bool {
        self.kind == kind
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)?;
        if let Some(src) = &self.source {
            write!(f, " (nguyên nhân: {src})")?;
        }
        Ok(())
    }
}

impl fmt::Debug for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AppError")
            .field("kind", &self.kind)
            .field("code", &self.code)
            .field("message", &self.message)
            .field("details", &self.details)
            .field("source", &self.source.as_ref().map(|e| e.to_string()))
            .finish()
    }
}

/// Mọi lỗi "thật" của thư viện đi qua `?` trở thành lỗi nội bộ 500, giữ nguyên nguyên nhân để ghi log.
impl<E> From<E> for AppError
where
    E: std::error::Error + Send + Sync + 'static,
{
    fn from(e: E) -> Self {
        AppError {
            kind: ErrorKind::Internal,
            code: "internal".into(),
            message: "Lỗi hệ thống – vui lòng thử lại sau".into(),
            details: None,
            source: Some(Box::new(e)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn io_fail() -> AppResult<()> {
        Err(std::io::Error::other("đĩa đầy"))?;
        Ok(())
    }

    #[test]
    fn library_errors_become_internal_and_keep_their_source() {
        let e = io_fail().unwrap_err();
        assert_eq!(e.kind, ErrorKind::Internal);
        assert_eq!(e.kind.http_status(), 500);
        assert!(e.source.is_some());
        assert!(!e.message.contains("đĩa đầy"), "không lộ lỗi gốc cho người gọi");
        assert!(e.to_string().contains("đĩa đầy"), "nhưng log thì có");
    }

    #[test]
    fn domain_errors_carry_code_and_status() {
        let e = AppError::conflict("document.code_taken", "Mã tài liệu đã tồn tại")
            .with_details(serde_json::json!({ "code": "SHOP-SRS-ORD-001" }));
        assert_eq!(e.kind.http_status(), 409);
        assert_eq!(e.code, "document.code_taken");
        assert!(e.details.is_some());
    }
}
