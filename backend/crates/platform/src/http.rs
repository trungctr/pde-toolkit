//! Lớp HTTP dùng chung: lỗi API dạng JSON và các extractor.
//!
//! Quy ước API (mọi module):
//! - JSON, tên trường `snake_case`, thời điểm dạng RFC 3339 UTC.
//! - Lỗi: `{ "error": { "code": "document.not_draft", "message": "…tiếng Việt…", "details": … } }`.
//! - 401 = chưa đăng nhập / token hết hạn; 404 = không tồn tại **hoặc không được biết là tồn tại**;
//!   403 = thấy được đối tượng nhưng không được làm việc này; 409 = xung đột trạng thái; 422 = vi phạm quy tắc.
//! - Handler nhận người gọi qua [`Auth`]; không tự đọc header.

use crate::jwt::JwtVerifier;
use axum::extract::{FromRequest, FromRequestParts, Path, Query, Request};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chillcat_kernel::{AppError, ErrorKind, Principal};
use http::request::Parts;
use http::{header, StatusCode};
use serde::de::DeserializeOwned;
use serde_json::json;
use std::sync::Arc;

/// Lỗi trả về từ handler. Mọi `AppError` và mọi lỗi thư viện đều chuyển thành kiểu này qua `?`.
#[derive(Debug)]
pub struct ApiError(pub AppError);

pub type ApiResult<T> = Result<T, ApiError>;

impl<E: Into<AppError>> From<E> for ApiError {
    fn from(e: E) -> Self {
        ApiError(e.into())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let e = self.0;
        let status = StatusCode::from_u16(e.kind.http_status()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        if matches!(e.kind, ErrorKind::Internal | ErrorKind::Unavailable) {
            // Lỗi gốc chỉ nằm trong log, không trả cho người gọi.
            tracing::error!(code = %e.code, error = %e, "Lỗi khi xử lý yêu cầu");
        }
        let mut body = json!({ "error": { "code": e.code, "message": e.message } });
        if let Some(d) = e.details {
            body["error"]["details"] = d;
        }
        let mut res = (status, Json(body)).into_response();
        if status == StatusCode::UNAUTHORIZED {
            res.headers_mut().insert(header::WWW_AUTHENTICATE, header::HeaderValue::from_static("Bearer"));
        }
        res
    }
}

fn bearer_token(parts: &Parts) -> Option<&str> {
    let v = parts.headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    let (scheme, token) = v.split_once(' ')?;
    scheme.eq_ignore_ascii_case("bearer").then(|| token.trim()).filter(|t| !t.is_empty())
}

fn verifier(parts: &Parts) -> Result<&Arc<JwtVerifier>, ApiError> {
    parts.extensions.get::<Arc<JwtVerifier>>().ok_or_else(|| ApiError(AppError::internal("Thiếu JwtVerifier trong router (Extension)")))
}

/// Người gọi đã đăng nhập. Thiếu hoặc sai token ⇒ 401.
///
/// ```ignore
/// async fn me(Auth(me): Auth) -> ApiResult<Json<UserDto>> { … }
/// ```
#[derive(Clone, Debug)]
pub struct Auth(pub Principal);

impl<S: Send + Sync> FromRequestParts<S> for Auth {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let token = bearer_token(parts).ok_or_else(|| ApiError(AppError::unauthenticated("Bạn chưa đăng nhập")))?;
        Ok(Auth(verifier(parts)?.verify(token)?))
    }
}

/// Người gọi có thể chưa đăng nhập (trang công khai). Có token nhưng token sai / hết hạn ⇒ vẫn 401,
/// để giao diện biết mà làm mới phiên thay vì âm thầm coi như khách.
#[derive(Clone, Debug)]
pub struct MaybeAuth(pub Option<Principal>);

impl<S: Send + Sync> FromRequestParts<S> for MaybeAuth {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        match bearer_token(parts) {
            None => Ok(MaybeAuth(None)),
            Some(token) => Ok(MaybeAuth(Some(verifier(parts)?.verify(token)?))),
        }
    }
}

/// `Json<T>` với lỗi theo định dạng chung (thay cho thông báo mặc định dạng văn bản của axum).
#[derive(Clone, Debug)]
pub struct ApiJson<T>(pub T);

impl<S, T> FromRequest<S> for ApiJson<T>
where
    S: Send + Sync,
    T: DeserializeOwned,
{
    type Rejection = ApiError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        match Json::<T>::from_request(req, state).await {
            Ok(Json(v)) => Ok(ApiJson(v)),
            Err(rej) => {
                Err(ApiError(AppError::bad_request("request.invalid_body", format!("Dữ liệu gửi lên không hợp lệ: {}", rej.body_text()))))
            }
        }
    }
}

/// `Query<T>` với lỗi theo định dạng chung.
#[derive(Clone, Debug)]
pub struct ApiQuery<T>(pub T);

impl<S, T> FromRequestParts<S> for ApiQuery<T>
where
    S: Send + Sync,
    T: DeserializeOwned,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        match Query::<T>::from_request_parts(parts, state).await {
            Ok(Query(v)) => Ok(ApiQuery(v)),
            Err(rej) => {
                Err(ApiError(AppError::bad_request("request.invalid_query", format!("Tham số truy vấn không hợp lệ: {}", rej.body_text()))))
            }
        }
    }
}

/// `Path<T>` với lỗi theo định dạng chung.
#[derive(Clone, Debug)]
pub struct ApiPath<T>(pub T);

impl<S, T> FromRequestParts<S> for ApiPath<T>
where
    S: Send + Sync,
    T: DeserializeOwned + Send,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        match Path::<T>::from_request_parts(parts, state).await {
            Ok(Path(v)) => Ok(ApiPath(v)),
            Err(rej) => {
                Err(ApiError(AppError::bad_request("request.invalid_path", format!("Đường dẫn không hợp lệ: {}", rej.body_text()))))
            }
        }
    }
}

/// 204 No Content – cho các thao tác không trả dữ liệu.
pub fn no_content() -> Response {
    StatusCode::NO_CONTENT.into_response()
}

/// 201 Created kèm JSON.
pub fn created<T: serde::Serialize>(value: T) -> Response {
    (StatusCode::CREATED, Json(value)).into_response()
}
