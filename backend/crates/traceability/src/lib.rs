//! Module **traceability**: mã truy vết (desc §7.2–§7.4).
//!
//! - [`parser`]: đọc mã trong nội dung Markdown (thuần tuý, kiểm thử trên bộ mẫu thật).
//! - Cài đặt [`chillcat_kernel::contracts::TraceApi`] cho module documents (chỉ mục khi lưu, kiểm tra khi gửi duyệt /
//!   phát hành) và module tickets (tìm mã trong nội dung ticket).
//! - Nghe `document.version.published` để cập nhật sổ mã và đánh dấu tài liệu **Cần rà soát**.
//!
//! Collection: `trace_occurrences`, `trace_elements`, `review_flags`.

pub mod parser;
mod service;

pub use service::{ElementDetailDto, ElementDto, FlagDto, FlagStatus, TraceService};

use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use chillcat_kernel::contracts::{AccessApi, DocumentsApi, Late, TraceApi};
use chillcat_kernel::{AppResult, EventHandler, ReviewFlagId, WorkspaceId};
use chillcat_platform::{ApiPath, ApiQuery, ApiResult, Auth, EventBus, Module, Mongo};
use serde::Deserialize;
use service::{ElementQuery, PublishedHandler};
use std::sync::Arc;

pub struct TraceabilityModule {
    svc: Arc<TraceService>,
}

impl TraceabilityModule {
    pub fn new(mongo: &Mongo, bus: EventBus, access: Arc<dyn AccessApi>, documents: Late<dyn DocumentsApi>) -> Self {
        let db = mongo.database("traceability");
        TraceabilityModule { svc: Arc::new(TraceService::new(&db, bus, access, documents)) }
    }

    pub fn api(&self) -> Arc<dyn TraceApi> {
        self.svc.clone()
    }

    pub fn service(&self) -> Arc<TraceService> {
        self.svc.clone()
    }
}

type S = Arc<TraceService>;

#[derive(Deserialize)]
struct DetailQuery {
    scope: Option<String>,
}

#[derive(Deserialize)]
struct FlagQuery {
    status: Option<FlagStatus>,
}

async fn elements(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(ws): ApiPath<String>,
    ApiQuery(q): ApiQuery<ElementQuery>,
) -> ApiResult<Json<Vec<ElementDto>>> {
    Ok(Json(s.list_elements(&p, &WorkspaceId::from(ws), q).await?))
}

async fn element(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath((ws, code)): ApiPath<(String, String)>,
    ApiQuery(q): ApiQuery<DetailQuery>,
) -> ApiResult<Json<ElementDetailDto>> {
    Ok(Json(s.element_detail(&p, &WorkspaceId::from(ws), &code, q.scope.as_deref()).await?))
}

async fn flags(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(ws): ApiPath<String>,
    ApiQuery(q): ApiQuery<FlagQuery>,
) -> ApiResult<Json<Vec<FlagDto>>> {
    Ok(Json(s.list_flags(&p, &WorkspaceId::from(ws), q.status).await?))
}

async fn resolve(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Json<FlagDto>> {
    Ok(Json(s.resolve_flag(&p, &ReviewFlagId::from(id)).await?))
}

#[async_trait::async_trait]
impl Module for TraceabilityModule {
    fn name(&self) -> &'static str {
        "traceability"
    }

    async fn init(&self) -> AppResult<()> {
        self.svc.ensure_indexes().await
    }

    fn router(&self) -> Router {
        Router::new()
            .route("/workspaces/{ws}/trace/elements", get(elements))
            .route("/workspaces/{ws}/trace/elements/{code}", get(element))
            .route("/workspaces/{ws}/trace/flags", get(flags))
            .route("/trace/flags/{id}/resolve", post(resolve))
            .with_state(self.svc.clone())
    }

    fn event_handlers(&self) -> Vec<Arc<dyn EventHandler>> {
        vec![Arc::new(PublishedHandler(self.svc.clone()))]
    }
}
