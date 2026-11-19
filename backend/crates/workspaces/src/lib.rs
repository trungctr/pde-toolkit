//! Module **workspaces**: workspace (dự án), group (phạm vi an ninh), hệ thống con, thành viên, lời mời,
//! và phép tính quyền dùng chung cho mọi module ([`chillcat_kernel::contracts::AccessApi`]).
//!
//! Collection: `workspaces`, `groups`, `subsystems`, `memberships`, `invitations`.

mod access_impl;
mod http;
mod members;
pub mod model;
mod service;

pub use service::{WorkspaceService, WorkspaceSettings};

use axum::Router;
use chillcat_kernel::contracts::{AccessApi, DocumentsApi, IdentityApi, Late};
use chillcat_kernel::AppResult;
use chillcat_platform::{EventBus, Module, Mongo};
use std::sync::Arc;

pub struct WorkspacesModule {
    svc: Arc<WorkspaceService>,
}

impl WorkspacesModule {
    pub fn new(
        mongo: &Mongo,
        bus: EventBus,
        identity: Arc<dyn IdentityApi>,
        documents: Late<dyn DocumentsApi>,
        settings: WorkspaceSettings,
    ) -> Self {
        let db = mongo.database("workspaces");
        WorkspacesModule { svc: Arc::new(WorkspaceService::new(mongo.clone(), &db, bus, identity, documents, settings)) }
    }

    pub fn api(&self) -> Arc<dyn AccessApi> {
        self.svc.clone()
    }

    pub fn service(&self) -> Arc<WorkspaceService> {
        self.svc.clone()
    }
}

#[async_trait::async_trait]
impl Module for WorkspacesModule {
    fn name(&self) -> &'static str {
        "workspaces"
    }

    async fn init(&self) -> AppResult<()> {
        self.svc.ensure_indexes().await
    }

    fn router(&self) -> Router {
        http::router(self.svc.clone())
    }
}
