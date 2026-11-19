//! Route của module workspaces (tính từ `/api/v1`).

use crate::model::*;
use crate::service::WorkspaceService;
use axum::extract::State;
use axum::response::Response;
use axum::routing::{get, post, put};
use axum::{Json, Router};
use chillcat_kernel::*;
use chillcat_platform::http::{created, no_content};
use chillcat_platform::{ApiJson, ApiPath, ApiResult, Auth};
use std::sync::Arc;

type S = Arc<WorkspaceService>;

pub fn router(svc: S) -> Router {
    Router::new()
        .route("/workspaces", get(list_mine).post(create))
        .route("/workspaces/directory", get(directory))
        .route("/workspaces/{ws}", get(get_ws).patch(update))
        .route("/workspaces/{ws}/transfer", post(transfer))
        .route("/workspaces/{ws}/groups", get(groups).post(create_group))
        .route("/workspaces/{ws}/subsystems", get(subsystems).post(create_subsystem))
        .route("/workspaces/{ws}/members", get(members))
        .route("/workspaces/{ws}/invitations", get(invitations).post(create_invitation))
        .route("/groups/{id}", axum::routing::patch(update_group).delete(delete_group))
        .route("/groups/{id}/owner", put(assign_group_owner))
        .route("/subsystems/{id}", axum::routing::patch(update_subsystem).delete(delete_subsystem))
        .route("/memberships/{id}", axum::routing::patch(update_membership).delete(remove_membership))
        .route("/invitations/{id}", axum::routing::delete(revoke_invitation))
        .route("/invitations/{id}/accept", post(accept_invitation))
        .route("/invitations/{id}/decline", post(decline_invitation))
        .route("/me/invitations", get(my_invitations))
        .with_state(svc)
}

async fn list_mine(State(s): State<S>, Auth(p): Auth) -> ApiResult<Json<Vec<WorkspaceDto>>> {
    Ok(Json(s.list_mine(&p).await?))
}
async fn directory(State(s): State<S>, Auth(p): Auth) -> ApiResult<Json<Vec<DirectoryEntryDto>>> {
    Ok(Json(s.directory(&p).await?))
}
async fn create(State(s): State<S>, Auth(p): Auth, ApiJson(i): ApiJson<CreateWorkspace>) -> ApiResult<Response> {
    Ok(created(s.create(&p, i).await?))
}
async fn get_ws(State(s): State<S>, Auth(p): Auth, ApiPath(ws): ApiPath<String>) -> ApiResult<Json<WorkspaceDto>> {
    Ok(Json(s.get(&p, &WorkspaceId::from(ws)).await?))
}
async fn update(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(ws): ApiPath<String>,
    ApiJson(i): ApiJson<UpdateWorkspace>,
) -> ApiResult<Json<WorkspaceDto>> {
    Ok(Json(s.update(&p, &WorkspaceId::from(ws), i).await?))
}
async fn transfer(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(ws): ApiPath<String>,
    ApiJson(i): ApiJson<TransferOwnership>,
) -> ApiResult<Json<WorkspaceDto>> {
    Ok(Json(s.transfer(&p, &WorkspaceId::from(ws), i).await?))
}
async fn groups(State(s): State<S>, Auth(p): Auth, ApiPath(ws): ApiPath<String>) -> ApiResult<Json<Vec<GroupDto>>> {
    Ok(Json(s.groups(&p, &WorkspaceId::from(ws)).await?))
}
async fn create_group(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(ws): ApiPath<String>,
    ApiJson(i): ApiJson<CreateGroup>,
) -> ApiResult<Response> {
    Ok(created(s.create_group(&p, &WorkspaceId::from(ws), i).await?))
}
async fn update_group(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<UpdateGroup>,
) -> ApiResult<Json<GroupDto>> {
    Ok(Json(s.update_group(&p, &GroupId::from(id), i).await?))
}
async fn delete_group(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Response> {
    s.delete_group(&p, &GroupId::from(id)).await?;
    Ok(no_content())
}
async fn assign_group_owner(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<AssignGroupOwner>,
) -> ApiResult<Json<GroupDto>> {
    Ok(Json(s.assign_group_owner(&p, &GroupId::from(id), i).await?))
}
async fn subsystems(State(s): State<S>, Auth(p): Auth, ApiPath(ws): ApiPath<String>) -> ApiResult<Json<Vec<SubsystemDto>>> {
    Ok(Json(s.subsystems(&p, &WorkspaceId::from(ws)).await?))
}
async fn create_subsystem(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(ws): ApiPath<String>,
    ApiJson(i): ApiJson<CreateSubsystem>,
) -> ApiResult<Response> {
    Ok(created(s.create_subsystem(&p, &WorkspaceId::from(ws), i).await?))
}
async fn update_subsystem(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<UpdateSubsystem>,
) -> ApiResult<Json<SubsystemDto>> {
    Ok(Json(s.update_subsystem(&p, &SubsystemId::from(id), i).await?))
}
async fn delete_subsystem(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Response> {
    s.delete_subsystem(&p, &SubsystemId::from(id)).await?;
    Ok(no_content())
}
async fn members(State(s): State<S>, Auth(p): Auth, ApiPath(ws): ApiPath<String>) -> ApiResult<Json<Vec<MemberDto>>> {
    Ok(Json(s.members(&p, &WorkspaceId::from(ws)).await?))
}
async fn update_membership(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<UpdateMembership>,
) -> ApiResult<Json<MembershipDto>> {
    Ok(Json(s.update_membership(&p, &MembershipId::from(id), i).await?))
}
async fn remove_membership(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Response> {
    s.remove_membership(&p, &MembershipId::from(id)).await?;
    Ok(no_content())
}
async fn invitations(State(s): State<S>, Auth(p): Auth, ApiPath(ws): ApiPath<String>) -> ApiResult<Json<Vec<InvitationDto>>> {
    Ok(Json(s.invitations(&p, &WorkspaceId::from(ws)).await?))
}
async fn create_invitation(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(ws): ApiPath<String>,
    ApiJson(i): ApiJson<CreateInvitation>,
) -> ApiResult<Response> {
    Ok(created(s.create_invitation(&p, &WorkspaceId::from(ws), i).await?))
}
async fn revoke_invitation(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Response> {
    s.revoke_invitation(&p, &InvitationId::from(id)).await?;
    Ok(no_content())
}
async fn my_invitations(State(s): State<S>, Auth(p): Auth) -> ApiResult<Json<Vec<InvitationDto>>> {
    Ok(Json(s.my_invitations(&p).await?))
}
async fn accept_invitation(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Json<WorkspaceDto>> {
    Ok(Json(s.accept_invitation(&p, &InvitationId::from(id)).await?))
}
async fn decline_invitation(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Response> {
    s.decline_invitation(&p, &InvitationId::from(id)).await?;
    Ok(no_content())
}
