//! Module **documents**: 24 loại tài liệu theo bộ mẫu, tài liệu, phiên bản và vòng đời
//! Dự thảo → Chờ duyệt → Đã duyệt → Đã phát hành → Thay thế, mức bảo mật, quan hệ ↑ / ⇄, nhận xét (desc §5–§7).
//!
//! Collection: `documents`, `document_versions`, `document_reviews`, `comments`, `document_links`.
//! Cung cấp [`chillcat_kernel::contracts::DocumentsApi`]; dùng `AccessApi`, `IdentityApi`, `TraceApi`.

pub mod catalog;
mod comments;
mod http;
mod integration;
pub mod lifecycle;
pub mod model;
pub mod policy;
mod service;
pub mod template;

pub use service::{DocumentService, DocumentSettings};

use axum::Router;
use chillcat_kernel::contracts::{AccessApi, DocumentsApi, IdentityApi, TraceApi};
use chillcat_kernel::{AppResult, EventHandler};
use chillcat_platform::{EventBus, Job, Module, Mongo};
use integration::DocumentEvents;
use std::sync::Arc;
use std::time::Duration;

pub struct DocumentsModule {
    svc: Arc<DocumentService>,
}

impl DocumentsModule {
    pub fn new(
        mongo: &Mongo,
        bus: EventBus,
        access: Arc<dyn AccessApi>,
        identity: Arc<dyn IdentityApi>,
        trace: Arc<dyn TraceApi>,
        settings: DocumentSettings,
    ) -> Self {
        let db = mongo.database("documents");
        DocumentsModule { svc: Arc::new(DocumentService::new(mongo.clone(), &db, bus, access, identity, trace, settings)) }
    }

    pub fn api(&self) -> Arc<dyn DocumentsApi> {
        self.svc.clone()
    }

    pub fn service(&self) -> Arc<DocumentService> {
        self.svc.clone()
    }
}

#[async_trait::async_trait]
impl Module for DocumentsModule {
    fn name(&self) -> &'static str {
        "documents"
    }

    async fn init(&self) -> AppResult<()> {
        self.svc.ensure_indexes().await
    }

    fn router(&self) -> Router {
        http::router(self.svc.clone())
    }

    fn event_handlers(&self) -> Vec<Arc<dyn EventHandler>> {
        vec![Arc::new(DocumentEvents(self.svc.clone()))]
    }

    fn jobs(&self) -> Vec<Job> {
        let svc = self.svc.clone();
        vec![Job::new("documents.purge_expired_versions", Duration::from_secs(24 * 3600), move || {
            let svc = svc.clone();
            async move { svc.purge_expired_versions().await.map(|_| ()) }
        })]
    }
}
