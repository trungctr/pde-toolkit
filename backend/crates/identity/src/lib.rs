//! Module **identity**: tài khoản người dùng, đăng nhập, phiên, quản trị tài khoản.
//!
//! Collection (CSDL `MONGODB_DB_IDENTITY` hoặc CSDL chung): `users`, `sessions`.
//! Cung cấp [`chillcat_kernel::contracts::IdentityApi`] cho các module khác.

mod http;
mod model;
mod password;
mod service;

pub use model::{AuthResponse, UserDto};
pub use service::{IdentityService, IdentitySettings};

use axum::Router;
use chillcat_kernel::contracts::IdentityApi;
use chillcat_kernel::AppResult;
use chillcat_platform::{EventBus, Job, JwtSigner, Module, Mongo};
use std::sync::Arc;
use std::time::Duration;

pub struct IdentityModule {
    svc: Arc<IdentityService>,
}

impl IdentityModule {
    pub fn new(mongo: &Mongo, bus: EventBus, signer: JwtSigner, settings: IdentitySettings) -> Self {
        let db = mongo.database("identity");
        IdentityModule { svc: Arc::new(IdentityService::new(&db, bus, signer, settings)) }
    }

    pub fn api(&self) -> Arc<dyn IdentityApi> {
        self.svc.clone()
    }

    pub fn service(&self) -> Arc<IdentityService> {
        self.svc.clone()
    }
}

#[async_trait::async_trait]
impl Module for IdentityModule {
    fn name(&self) -> &'static str {
        "identity"
    }

    async fn init(&self) -> AppResult<()> {
        self.svc.ensure_indexes().await?;
        self.svc.bootstrap_admin().await
    }

    fn router(&self) -> Router {
        http::router(self.svc.clone())
    }

    fn jobs(&self) -> Vec<Job> {
        let svc = self.svc.clone();
        vec![Job::new("identity.purge_sessions", Duration::from_secs(6 * 3600), move || {
            let svc = svc.clone();
            async move { svc.purge_revoked_sessions().await }
        })]
    }
}
