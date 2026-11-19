//! Route của module identity (tính từ `/api/v1`).
//!
//! | Method | Path | Ai gọi |
//! | --- | --- | --- |
//! | POST | /auth/register · /auth/login · /auth/refresh · /auth/logout | khách |
//! | GET, PATCH | /me | đã đăng nhập |
//! | POST | /me/password | đã đăng nhập |
//! | GET | /users/lookup?email= | đã đăng nhập (tra đúng một e-mail, không liệt kê) |
//! | GET | /admin/users · PATCH /admin/users/{id} | quản trị hệ thống |

use crate::model::*;
use crate::service::IdentityService;
use axum::extract::State;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use chillcat_kernel::{AppError, UserId};
use chillcat_platform::http::no_content;
use chillcat_platform::{ApiJson, ApiPath, ApiQuery, ApiResult, Auth};
use http::{header, HeaderMap, HeaderValue, StatusCode};
use serde::Deserialize;
use std::sync::Arc;

type S = Arc<IdentityService>;

const COOKIE: &str = "cc_refresh";
const COOKIE_PATH: &str = "/api/v1/auth";

pub fn router(svc: S) -> Router {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/refresh", post(refresh))
        .route("/auth/logout", post(logout))
        .route("/me", get(me).patch(update_me))
        .route("/me/password", post(change_password))
        .route("/users/lookup", get(lookup))
        .route("/admin/users", get(admin_list))
        .route("/admin/users/{id}", patch(admin_update))
        .with_state(svc)
}

fn user_agent(h: &HeaderMap) -> Option<String> {
    h.get(header::USER_AGENT).and_then(|v| v.to_str().ok()).map(str::to_owned)
}

fn cookie_value<'a>(h: &'a HeaderMap, name: &str) -> Option<&'a str> {
    h.get_all(header::COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .filter_map(|kv| kv.trim().split_once('='))
        .find(|(k, _)| *k == name)
        .map(|(_, v)| v)
}

fn set_cookie(value: &str, max_age: u64, secure: bool) -> HeaderValue {
    let s = format!(
        "{COOKIE}={value}; Path={COOKIE_PATH}; Max-Age={max_age}; HttpOnly; SameSite=Strict{}",
        if secure { "; Secure" } else { "" }
    );
    HeaderValue::from_str(&s).unwrap_or_else(|_| HeaderValue::from_static(""))
}

fn with_session(svc: &IdentityService, status: StatusCode, auth: AuthResponse) -> Response {
    let cookie = set_cookie(&auth.refresh_token, auth.refresh_expires_in, svc.cookie_secure());
    let mut res = (status, Json(auth)).into_response();
    res.headers_mut().append(header::SET_COOKIE, cookie);
    res.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    res
}

async fn register(State(svc): State<S>, headers: HeaderMap, ApiJson(input): ApiJson<RegisterInput>) -> ApiResult<Response> {
    let auth = svc.register(input, user_agent(&headers)).await?;
    Ok(with_session(&svc, StatusCode::CREATED, auth))
}

async fn login(State(svc): State<S>, headers: HeaderMap, ApiJson(input): ApiJson<LoginInput>) -> ApiResult<Response> {
    let auth = svc.login(input, user_agent(&headers)).await?;
    Ok(with_session(&svc, StatusCode::OK, auth))
}

/// Refresh token lấy từ thân yêu cầu (ứng dụng khác origin, công cụ dòng lệnh) hoặc từ cookie HttpOnly.
fn refresh_token(headers: &HeaderMap, body: &Option<Json<RefreshInput>>) -> Option<String> {
    body.as_ref()
        .and_then(|Json(b)| b.refresh_token.clone())
        .filter(|t| !t.trim().is_empty())
        .or_else(|| cookie_value(headers, COOKIE).map(str::to_owned))
}

async fn refresh(State(svc): State<S>, headers: HeaderMap, body: Option<Json<RefreshInput>>) -> ApiResult<Response> {
    let token =
        refresh_token(&headers, &body).ok_or_else(|| AppError::unauthenticated("Chưa đăng nhập").with_code("auth.refresh_missing"))?;
    match svc.refresh(&token).await {
        Ok(auth) => Ok(with_session(&svc, StatusCode::OK, auth)),
        Err(e) => {
            // Xoá cookie hỏng để trình duyệt không gửi lại mãi.
            let mut res = chillcat_platform::ApiError(e).into_response();
            res.headers_mut().append(header::SET_COOKIE, set_cookie("", 0, svc.cookie_secure()));
            Ok(res)
        }
    }
}

async fn logout(State(svc): State<S>, headers: HeaderMap, body: Option<Json<RefreshInput>>) -> ApiResult<Response> {
    if let Some(token) = refresh_token(&headers, &body) {
        svc.logout_token(&token).await?;
    }
    let mut res = no_content();
    res.headers_mut().append(header::SET_COOKIE, set_cookie("", 0, svc.cookie_secure()));
    Ok(res)
}

async fn me(State(svc): State<S>, Auth(p): Auth) -> ApiResult<Json<UserDto>> {
    Ok(Json(svc.me(&p).await?))
}

async fn update_me(State(svc): State<S>, Auth(p): Auth, ApiJson(input): ApiJson<ProfileInput>) -> ApiResult<Json<UserDto>> {
    Ok(Json(svc.update_profile(&p, input).await?))
}

async fn change_password(State(svc): State<S>, Auth(p): Auth, ApiJson(input): ApiJson<PasswordInput>) -> ApiResult<Response> {
    svc.change_password(&p, input).await?;
    Ok(no_content())
}

#[derive(Deserialize)]
struct LookupQuery {
    email: String,
}

async fn lookup(
    State(svc): State<S>,
    Auth(_): Auth,
    ApiQuery(q): ApiQuery<LookupQuery>,
) -> ApiResult<Json<chillcat_kernel::contracts::UserSummary>> {
    Ok(Json(svc.lookup_email(&q.email).await?))
}

async fn admin_list(
    State(svc): State<S>,
    Auth(p): Auth,
    ApiQuery(q): ApiQuery<UserListQuery>,
) -> ApiResult<Json<chillcat_kernel::Page<UserDto>>> {
    Ok(Json(svc.admin_list(&p, q).await?))
}

async fn admin_update(
    State(svc): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(input): ApiJson<AdminUserInput>,
) -> ApiResult<Json<UserDto>> {
    Ok(Json(svc.admin_update(&p, &UserId::from(id), input).await?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_refresh_cookie_among_others() {
        let mut h = HeaderMap::new();
        h.append(header::COOKIE, HeaderValue::from_static("a=1; cc_refresh=sid.secret; b=2"));
        assert_eq!(cookie_value(&h, COOKIE), Some("sid.secret"));
        assert_eq!(cookie_value(&h, "x"), None);
        let c = set_cookie("v", 10, true);
        let s = c.to_str().unwrap();
        assert!(s.contains("HttpOnly") && s.contains("SameSite=Strict") && s.contains("Secure") && s.contains("Path=/api/v1/auth"));
    }
}
