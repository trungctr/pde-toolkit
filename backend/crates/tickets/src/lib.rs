//! Module **tickets**: góp ý tính năng / báo lỗi phần mềm của dự án, quyền xem / xử lý cấp cho cá nhân hoặc group,
//! AI kiểm tra trùng và đề xuất sửa tài liệu liên quan (desc §4.4, §5.4, §9.6–§9.7).
//!
//! Collection: `tickets`, `ticket_counters`, `ticket_grants`, `ticket_access_delegations`, `ticket_ai_delegations`,
//! `ticket_ai_checks`, `ticket_duplicate_candidates`, `ticket_document_proposals`, `ticket_activity`.

pub mod ai;
pub mod model;
mod runs;
mod service;

pub use service::{TicketAccess, TicketService};

use axum::extract::State;
use axum::response::Response;
use axum::routing::{get, post, put};
use axum::{Json, Router};
use chillcat_kernel::contracts::{AccessApi, DocumentsApi, IdentityApi, TraceApi};
use chillcat_kernel::events::kinds;
use chillcat_kernel::*;
use chillcat_platform::http::{created, no_content};
use chillcat_platform::{ApiJson, ApiPath, ApiQuery, ApiResult, Auth, EventBus, Job, Module, Mongo};
use model::*;
use std::sync::Arc;
use std::time::Duration;

pub struct TicketsModule {
    svc: Arc<TicketService>,
}

impl TicketsModule {
    pub fn new(
        mongo: &Mongo,
        bus: EventBus,
        access: Arc<dyn AccessApi>,
        identity: Arc<dyn IdentityApi>,
        documents: Arc<dyn DocumentsApi>,
        trace: Arc<dyn TraceApi>,
        ai: Option<ai::ClaudeClient>,
    ) -> Self {
        let db = mongo.database("tickets");
        TicketsModule { svc: Arc::new(TicketService::new(mongo.clone(), &db, bus, access, identity, documents, trace, ai)) }
    }

    pub fn service(&self) -> Arc<TicketService> {
        self.svc.clone()
    }
}

type S = Arc<TicketService>;

async fn create(State(s): State<S>, Auth(p): Auth, ApiPath(ws): ApiPath<String>, ApiJson(i): ApiJson<CreateTicket>) -> ApiResult<Response> {
    Ok(created(s.create(&p, &WorkspaceId::from(ws), i).await?))
}
async fn list(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(ws): ApiPath<String>,
    ApiQuery(q): ApiQuery<TicketQuery>,
) -> ApiResult<Json<Vec<TicketDto>>> {
    Ok(Json(s.list(&p, &WorkspaceId::from(ws), q).await?))
}
async fn mine(State(s): State<S>, Auth(p): Auth) -> ApiResult<Json<Vec<TicketDto>>> {
    Ok(Json(s.mine(&p).await?))
}
async fn detail(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Json<TicketDetailDto>> {
    Ok(Json(s.detail(&p, &TicketId::from(id)).await?))
}
async fn update(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<UpdateTicket>,
) -> ApiResult<Json<TicketDetailDto>> {
    Ok(Json(s.update(&p, &TicketId::from(id), i).await?))
}
async fn status(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<ChangeStatus>,
) -> ApiResult<Json<TicketDetailDto>> {
    Ok(Json(s.change_status(&p, &TicketId::from(id), i).await?))
}
async fn assign(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<Assign>,
) -> ApiResult<Json<TicketDetailDto>> {
    Ok(Json(s.assign(&p, &TicketId::from(id), i).await?))
}
async fn duplicate(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<MarkDuplicate>,
) -> ApiResult<Json<TicketDetailDto>> {
    Ok(Json(s.mark_duplicate(&p, &TicketId::from(id), i).await?))
}
async fn check_duplicates(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Json<TicketDetailDto>> {
    Ok(Json(s.trigger(&p, &TicketId::from(id), CheckPurpose::Duplicates).await?))
}
async fn propose(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Json<TicketDetailDto>> {
    Ok(Json(s.trigger(&p, &TicketId::from(id), CheckPurpose::Proposals).await?))
}
async fn decide_candidate(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<Decide>,
) -> ApiResult<Json<TicketDetailDto>> {
    Ok(Json(s.decide_candidate(&p, &DuplicateCandidateId::from(id), i).await?))
}
async fn decide_proposal(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<Decide>,
) -> ApiResult<Json<TicketDetailDto>> {
    Ok(Json(s.decide_proposal(&p, &ProposalId::from(id), i).await?))
}
async fn link_draft(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(id): ApiPath<String>,
    ApiJson(i): ApiJson<LinkDraft>,
) -> ApiResult<Json<TicketDetailDto>> {
    Ok(Json(s.link_draft(&p, &ProposalId::from(id), i).await?))
}
async fn access(State(s): State<S>, Auth(p): Auth, ApiPath(ws): ApiPath<String>) -> ApiResult<Json<TicketAccessDto>> {
    Ok(Json(s.access_overview(&p, &WorkspaceId::from(ws)).await?))
}
async fn create_grant(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(ws): ApiPath<String>,
    ApiJson(i): ApiJson<CreateGrant>,
) -> ApiResult<Json<TicketAccessDto>> {
    Ok(Json(s.create_grant(&p, &WorkspaceId::from(ws), i).await?))
}
async fn revoke_grant(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Response> {
    s.revoke_grant(&p, &TicketGrantId::from(id)).await?;
    Ok(no_content())
}
async fn create_delegation(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(ws): ApiPath<String>,
    ApiJson(i): ApiJson<CreateDelegation>,
) -> ApiResult<Json<TicketAccessDto>> {
    Ok(Json(s.create_delegation(&p, &WorkspaceId::from(ws), i).await?))
}
async fn revoke_delegation(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Response> {
    s.revoke_delegation(&p, &TicketDelegationId::from(id)).await?;
    Ok(no_content())
}
async fn ai_delegation(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(ws): ApiPath<String>,
    ApiJson(i): ApiJson<SetAiDelegation>,
) -> ApiResult<Json<TicketAccessDto>> {
    Ok(Json(s.set_ai_delegation(&p, &WorkspaceId::from(ws), i).await?))
}

struct Reactions(Arc<TicketService>);

#[async_trait::async_trait]
impl EventHandler for Reactions {
    fn name(&self) -> &'static str {
        "tickets.reactions"
    }
    fn interested_in(&self, kind: &str) -> bool {
        matches!(kind, kinds::TICKET_CREATED | kinds::GROUP_DELETED | kinds::VERSION_PUBLISHED)
    }
    async fn handle(&self, ev: &DomainEvent) -> AppResult<()> {
        match ev.kind.as_str() {
            kinds::TICKET_CREATED => self.0.on_ticket_created(ev).await,
            kinds::GROUP_DELETED => self.0.on_group_deleted(ev).await,
            kinds::VERSION_PUBLISHED => self.0.on_version_published(ev).await,
            _ => Ok(()),
        }
    }
}

#[async_trait::async_trait]
impl Module for TicketsModule {
    fn name(&self) -> &'static str {
        "tickets"
    }

    async fn init(&self) -> AppResult<()> {
        self.svc.ensure_indexes().await
    }

    fn router(&self) -> Router {
        Router::new()
            .route("/workspaces/{ws}/tickets", get(list).post(create))
            .route("/workspaces/{ws}/ticket-access", get(access))
            .route("/workspaces/{ws}/ticket-grants", post(create_grant))
            .route("/workspaces/{ws}/ticket-delegations", post(create_delegation))
            .route("/workspaces/{ws}/ticket-ai-delegation", put(ai_delegation))
            .route("/me/tickets", get(mine))
            .route("/tickets/{id}", get(detail).patch(update))
            .route("/tickets/{id}/status", post(status))
            .route("/tickets/{id}/assign", post(assign))
            .route("/tickets/{id}/duplicate", post(duplicate))
            .route("/tickets/{id}/ai/duplicates", post(check_duplicates))
            .route("/tickets/{id}/ai/proposals", post(propose))
            .route("/ticket-candidates/{id}/decision", post(decide_candidate))
            .route("/ticket-proposals/{id}/decision", post(decide_proposal))
            .route("/ticket-proposals/{id}/draft", post(link_draft))
            .route("/ticket-grants/{id}", axum::routing::delete(revoke_grant))
            .route("/ticket-delegations/{id}", axum::routing::delete(revoke_delegation))
            .with_state(self.svc.clone())
    }

    fn event_handlers(&self) -> Vec<Arc<dyn EventHandler>> {
        vec![Arc::new(Reactions(self.svc.clone()))]
    }

    fn jobs(&self) -> Vec<Job> {
        let svc = self.svc.clone();
        vec![Job::new("tickets.fail_stuck_checks", Duration::from_secs(300), move || {
            let svc = svc.clone();
            async move { svc.fail_stuck_checks().await }
        })]
    }
}
