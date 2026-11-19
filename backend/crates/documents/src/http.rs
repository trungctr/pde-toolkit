//! Route của module documents (tính từ `/api/v1`).

use crate::lifecycle::Action;
use crate::model::*;
use crate::service::DocumentService;
use axum::extract::State;
use axum::response::Response;
use axum::routing::{get, post, put};
use axum::{Json, Router};
use chillcat_kernel::*;
use chillcat_platform::http::{created, no_content};
use chillcat_platform::{ApiJson, ApiPath, ApiQuery, ApiResult, Auth};
use serde::Deserialize;
use std::sync::Arc;

type S = Arc<DocumentService>;

pub fn router(svc: S) -> Router {
    Router::new()
        .route("/document-types", get(types))
        .route("/workspaces/{ws}/documents", get(list).post(create))
        .route("/documents/{id}", get(detail).patch(update).delete(delete))
        .route("/documents/{id}/archive", post(archive))
        .route("/documents/{id}/unarchive", post(unarchive))
        .route("/documents/{id}/versions", post(new_version))
        .route("/documents/{id}/reviews", get(reviews))
        .route("/documents/{id}/links", post(add_link))
        .route("/links/{id}", axum::routing::delete(remove_link))
        .route("/versions/{id}", get(version))
        .route("/versions/{id}/content", put(save_content))
        .route("/versions/{id}/lint", post(lint))
        .route("/versions/{id}/check/{action}", get(check))
        .route("/versions/{id}/{action}", post(transition))
        .route("/versions/{id}/editor", put(change_editor))
        .route("/versions/{id}/comments", get(comments).post(add_comment))
        .route("/comments/{id}", axum::routing::patch(edit_comment).delete(delete_comment))
        .route("/comments/{id}/resolve", post(resolve_comment))
        .route("/comments/{id}/reopen", post(reopen_comment))
        .route("/public/documents/{id}", get(public_document))
        .with_state(svc)
}

async fn types(State(s): State<S>, Auth(_): Auth) -> Json<serde_json::Value> {
    Json(serde_json::to_value(s.types()).unwrap_or_default())
}
async fn list(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(ws): ApiPath<String>,
    ApiQuery(q): ApiQuery<DocumentQuery>,
) -> ApiResult<Json<Vec<DocumentDto>>> {
    Ok(Json(s.list(&p, &WorkspaceId::from(ws), q).await?))
}
async fn create(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(ws): ApiPath<String>,
    ApiJson(i): ApiJson<CreateDocument>,
) -> ApiResult<Response> {
    Ok(created(s.create(&p, &WorkspaceId::from(ws), i).await?))
}
async fn detail(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Json<DocumentDetailDto>> {
    Ok(Json(s.detail(&p, &DocumentId::from(id)).await?))
}
async fn update(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<UpdateDocument>,
) -> ApiResult<Json<DocumentDetailDto>> {
    Ok(Json(s.update(&p, &DocumentId::from(id), i).await?))
}
async fn delete(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Response> {
    s.delete(&p, &DocumentId::from(id)).await?;
    Ok(no_content())
}
async fn archive(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Json<DocumentDetailDto>> {
    Ok(Json(s.set_archived(&p, &DocumentId::from(id), true).await?))
}
async fn unarchive(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Json<DocumentDetailDto>> {
    Ok(Json(s.set_archived(&p, &DocumentId::from(id), false).await?))
}
async fn new_version(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    body: Option<axum::Json<NewVersionInput>>,
) -> ApiResult<Response> {
    let input = body.map(|axum::Json(b)| b).unwrap_or_default();
    Ok(created(s.new_version(&p, &DocumentId::from(id), input).await?))
}
async fn reviews(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Json<Vec<ReviewDto>>> {
    Ok(Json(s.reviews(&p, &DocumentId::from(id)).await?))
}
async fn add_link(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<CreateLink>,
) -> ApiResult<Json<DocumentDetailDto>> {
    Ok(Json(s.add_link(&p, &DocumentId::from(id), i).await?))
}
async fn remove_link(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Response> {
    s.remove_link(&p, &LinkId::from(id)).await?;
    Ok(no_content())
}
async fn version(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Json<VersionDto>> {
    Ok(Json(s.version(Some(&p), &VersionId::from(id)).await?))
}
async fn save_content(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<SaveContent>,
) -> ApiResult<Json<SaveResultDto>> {
    Ok(Json(s.save_content(&p, &VersionId::from(id), i).await?))
}
async fn lint(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>, ApiJson(i): ApiJson<LintInput>) -> ApiResult<Json<LintDto>> {
    Ok(Json(s.lint(&p, &VersionId::from(id), i).await?))
}

fn parse_action(a: &str) -> Result<Action, AppError> {
    serde_json::from_value(serde_json::Value::String(a.to_owned()))
        .map_err(|_| AppError::not_found("route.not_found", format!("Không có thao tác “{a}”")))
}

async fn check(State(s): State<S>, Auth(p): Auth, ApiPath((id, action)): ApiPath<(String, String)>) -> ApiResult<Json<Vec<CheckIssue>>> {
    Ok(Json(s.preview_checks(&p, &VersionId::from(id), parse_action(&action)?).await?))
}
async fn transition(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath((id, action)): ApiPath<(String, String)>,
    body: Option<axum::Json<TransitionInput>>,
) -> ApiResult<Json<DocumentDetailDto>> {
    let input = body.map(|axum::Json(b)| b).unwrap_or_default();
    Ok(Json(s.transition(&p, &VersionId::from(id), parse_action(&action)?, input).await?))
}
async fn change_editor(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<ChangeEditor>,
) -> ApiResult<Json<DocumentDetailDto>> {
    Ok(Json(s.change_editor(&p, &VersionId::from(id), i).await?))
}
async fn comments(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Json<Vec<CommentDto>>> {
    Ok(Json(s.comments(&p, &VersionId::from(id)).await?))
}
async fn add_comment(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<CreateComment>,
) -> ApiResult<Json<Vec<CommentDto>>> {
    Ok(Json(s.add_comment(&p, &VersionId::from(id), i).await?))
}
async fn edit_comment(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<EditComment>,
) -> ApiResult<Json<Vec<CommentDto>>> {
    Ok(Json(s.edit_comment(&p, &CommentId::from(id), i).await?))
}
async fn delete_comment(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Json<Vec<CommentDto>>> {
    Ok(Json(s.delete_comment(&p, &CommentId::from(id)).await?))
}
async fn resolve_comment(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Json<Vec<CommentDto>>> {
    Ok(Json(s.resolve_comment(&p, &CommentId::from(id), true).await?))
}
async fn reopen_comment(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Json<Vec<CommentDto>>> {
    Ok(Json(s.resolve_comment(&p, &CommentId::from(id), false).await?))
}

#[derive(Deserialize)]
struct NoQuery {}

async fn public_document(State(s): State<S>, ApiPath(id): ApiPath<String>, _q: ApiQuery<NoQuery>) -> ApiResult<Json<PublicDocumentDto>> {
    Ok(Json(s.public_document(&DocumentId::from(id)).await?))
}
