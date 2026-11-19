//! Ghép các module thành một ứng dụng (dùng chung cho `main` và kiểm thử đầu-cuối).
//!
//! Đây là **nơi duy nhất** biết mọi module. Mỗi module chỉ thấy các hợp đồng trong `chillcat_kernel::contracts`;
//! khi tách một module ra dịch vụ riêng, thay phần cài đặt trong cùng tiến trình bằng client gọi qua mạng ở đây.

use axum::extract::State;
use axum::http::{header, HeaderValue, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Extension, Json, Router};
use chillcat_audit::AuditModule;
use chillcat_documents::{DocumentSettings, DocumentsModule};
use chillcat_identity::{IdentityModule, IdentitySettings};
use chillcat_kernel::contracts::{DocumentsApi, Late};
use chillcat_kernel::{AppError, AppResult, EventHandler};
use chillcat_notifications::NotificationsModule;
use chillcat_platform::config::{AiProvider, Settings};
use chillcat_platform::{ApiError, EventBus, Job, JwtSigner, JwtVerifier, Module, Mongo, OutboxRelay};
use chillcat_tickets::{ai::ClaudeClient, TicketsModule};
use chillcat_traceability::TraceabilityModule;
use chillcat_workspaces::{WorkspaceSettings, WorkspacesModule};
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::trace::TraceLayer;

pub struct App {
    pub router: Router,
    pub relay: OutboxRelay,
    pub jobs: Vec<Job>,
}

#[derive(Clone)]
struct Meta {
    mongo: Mongo,
    info: Arc<serde_json::Value>,
}

/// Dựng toàn bộ ứng dụng: module, chỉ mục, router, relay sự kiện, tác vụ nền.
pub async fn build(settings: &Settings, mongo: Mongo) -> AppResult<App> {
    let bus = EventBus::new(&mongo.database("outbox"));
    bus.ensure_indexes().await?;
    let signer = JwtSigner::new(&settings.auth.jwt_secret, settings.auth.access_token_ttl)?;
    let verifier = Arc::new(JwtVerifier::new(&settings.auth.jwt_secret)?);

    let identity = IdentityModule::new(
        &mongo,
        bus.clone(),
        signer,
        IdentitySettings {
            allow_registration: settings.auth.allow_registration,
            refresh_ttl: settings.auth.refresh_token_ttl,
            bootstrap_admin_email: settings.auth.bootstrap_admin_email.clone(),
            bootstrap_admin_password: settings.auth.bootstrap_admin_password.clone(),
            cookie_secure: settings.http.public_base_url.starts_with("https://"),
        },
    );
    // documents ↔ (workspaces, traceability) gọi lẫn nhau: gắn muộn.
    let documents_late: Late<dyn DocumentsApi> = Late::new();
    let workspaces = WorkspacesModule::new(
        &mongo,
        bus.clone(),
        identity.api(),
        documents_late.clone(),
        WorkspaceSettings {
            creation: settings.workspaces.creation.clone(),
            invitation_ttl: Duration::from_secs(settings.retention.invitation_days as u64 * 86_400),
        },
    );
    let trace = TraceabilityModule::new(&mongo, bus.clone(), workspaces.api(), documents_late.clone());
    let documents = DocumentsModule::new(
        &mongo,
        bus.clone(),
        workspaces.api(),
        identity.api(),
        trace.api(),
        DocumentSettings { superseded_retention_years: settings.retention.superseded_version_years },
    );
    documents_late.set(documents.api());
    let ai = ClaudeClient::from_settings(&settings.ai)?;
    let tickets = TicketsModule::new(&mongo, bus.clone(), workspaces.api(), identity.api(), documents.api(), trace.api(), ai);
    let notifications = NotificationsModule::new(&mongo, identity.api());
    let audit = AuditModule::new(&mongo, workspaces.api(), identity.api(), settings.retention.audit_days);

    let modules: Vec<Box<dyn Module>> = vec![
        Box::new(identity),
        Box::new(workspaces),
        Box::new(documents),
        Box::new(trace),
        Box::new(tickets),
        Box::new(notifications),
        Box::new(audit),
    ];
    let mut api = Router::new();
    let mut handlers: Vec<Arc<dyn EventHandler>> = Vec::new();
    let mut jobs = Vec::new();
    for m in &modules {
        m.init().await.map_err(|e| AppError::internal(format!("Khởi tạo module {} thất bại: {}", m.name(), e.message)))?;
        api = api.merge(m.router());
        handlers.extend(m.event_handlers());
        jobs.extend(m.jobs());
        tracing::info!(module = m.name(), "Đã nạp module");
    }

    let meta = Meta {
        mongo: mongo.clone(),
        info: Arc::new(json!({
            "name": "ChillCat Studio",
            "version": env!("CARGO_PKG_VERSION"),
            "api": "v1",
            "registration": settings.auth.allow_registration,
            "workspace_creation": format!("{:?}", settings.workspaces.creation).to_lowercase(),
            "ai": if settings.ai.provider == AiProvider::Anthropic { "claude" } else { "keyword" },
            "ai_model": (settings.ai.provider == AiProvider::Anthropic).then(|| settings.ai.model.clone()),
            "public_base_url": settings.http.public_base_url,
        })),
    };
    let api = api
        .merge(Router::new().route("/meta", get(meta_info)).with_state(meta.clone()))
        .fallback(api_not_found)
        .layer(SetResponseHeaderLayer::overriding(header::CACHE_CONTROL, HeaderValue::from_static("no-store")))
        .layer(tower_http::limit::RequestBodyLimitLayer::new(settings.http.request_body_limit_bytes));
    let health = Router::new().route("/healthz", get(|| async { "ok" })).route("/readyz", get(readyz)).with_state(meta);

    let mut router = Router::new().nest("/api/v1", api).merge(health).layer(Extension(verifier));
    if let Some(dir) = &settings.http.static_dir {
        tracing::info!(%dir, "Phục vụ giao diện tĩnh");
        router = router.fallback_service(ServeDir::new(dir).append_index_html_on_directories(true));
    }
    let mut router = router
        .layer(SetResponseHeaderLayer::if_not_present(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff")))
        .layer(SetResponseHeaderLayer::if_not_present(header::REFERRER_POLICY, HeaderValue::from_static("same-origin")))
        .layer(SetResponseHeaderLayer::if_not_present(header::X_FRAME_OPTIONS, HeaderValue::from_static("SAMEORIGIN")))
        // gzip cho JS / CSS / JSON khi trình duyệt chấp nhận (ảnh và phản hồi rất nhỏ được bỏ qua)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http());
    if !settings.http.cors_allowed_origins.is_empty() {
        let origins: Vec<HeaderValue> = settings.http.cors_allowed_origins.iter().filter_map(|o| HeaderValue::from_str(o).ok()).collect();
        router = router.layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::list(origins))
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE])
                .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE])
                .max_age(Duration::from_secs(3600)),
        );
    }
    Ok(App { router, relay: bus.relay(handlers), jobs })
}

async fn meta_info(State(m): State<Meta>) -> Json<serde_json::Value> {
    Json((*m.info).clone())
}

async fn readyz(State(m): State<Meta>) -> Response {
    match m.mongo.ping().await {
        Ok(()) => (StatusCode::OK, "ready").into_response(),
        Err(e) => {
            tracing::warn!(error = %e, "MongoDB chưa sẵn sàng");
            (StatusCode::SERVICE_UNAVAILABLE, "mongo unavailable").into_response()
        }
    }
}

async fn api_not_found() -> ApiError {
    ApiError(AppError::not_found("route.not_found", "Không có API này"))
}

/// Chạy các tác vụ định kỳ; mỗi tác vụ một vòng lặp riêng, lỗi chỉ ghi log.
pub fn spawn_jobs(jobs: Vec<Job>, shutdown: tokio::sync::watch::Receiver<bool>) {
    for job in jobs {
        let mut stop = shutdown.clone();
        tokio::spawn(async move {
            // lệch giờ khởi chạy một chút để các tác vụ không dồn vào cùng lúc khởi động
            tokio::time::sleep(Duration::from_secs(20)).await;
            loop {
                if *stop.borrow() {
                    break;
                }
                if let Err(e) = (job.run)().await {
                    tracing::error!(job = job.name, error = %e, "Tác vụ định kỳ lỗi");
                }
                tokio::select! {
                    _ = tokio::time::sleep(job.every) => {}
                    _ = stop.changed() => {}
                }
            }
        });
    }
}
