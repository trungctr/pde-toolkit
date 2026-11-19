//! Module **audit**: nhật ký (desc §8 `audit_logs`).
//!
//! Ghi mọi sự kiện miền được đánh dấu `audit` – thay đổi quyền, thành viên, trạng thái tài liệu, mức bảo mật, xử lý
//! ticket. Khoá chính = mã sự kiện nên phát lại không tạo bản ghi trùng. Tự xoá sau `AUDIT_RETENTION_DAYS`
//! (mặc định 730 ngày = 2 năm, desc §5.3), **tính từ lúc ghi** – đặc tả chưa chốt mốc bắt đầu.
//!
//! Xem: workspace owner xem nhật ký workspace; quản trị hệ thống xem nhật ký không thuộc workspace (tài khoản).

use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use bson::doc;
use chillcat_kernel::contracts::{AccessApi, IdentityApi, UserSummary};
use chillcat_kernel::*;
use chillcat_platform::mongo::{ensure_indexes, index, is_duplicate_key};
use chillcat_platform::{ApiPath, ApiQuery, ApiResult, Auth, Module, Mongo};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::Collection;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;

#[derive(Clone, Debug, Serialize, Deserialize)]
struct AuditDoc {
    /// = mã sự kiện.
    #[serde(rename = "_id")]
    id: String,
    workspace_id: Option<WorkspaceId>,
    actor_id: Option<UserId>,
    action: String,
    target_type: String,
    target_id: String,
    data: bson::Bson,
    created_at: bson::DateTime,
}

#[derive(Clone, Debug, Serialize)]
pub struct AuditDto {
    pub id: String,
    pub actor_id: Option<UserId>,
    pub actor: Option<UserSummary>,
    pub action: String,
    pub target_type: String,
    pub target_id: String,
    pub data: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

pub struct AuditService {
    coll: Collection<AuditDoc>,
    access: Arc<dyn AccessApi>,
    identity: Arc<dyn IdentityApi>,
    retention: Duration,
}

#[derive(Deserialize)]
struct Query {
    /// Lọc theo tiền tố hành động: `document.`, `membership.`, `ticket.`…
    action: Option<String>,
    target_id: Option<String>,
    limit: Option<u32>,
    after: Option<String>,
}

impl AuditService {
    async fn record(&self, ev: &DomainEvent) -> AppResult<()> {
        let d = AuditDoc {
            id: ev.id.to_string(),
            workspace_id: ev.workspace_id.clone(),
            actor_id: ev.actor_id.clone(),
            action: ev.kind.clone(),
            target_type: ev.target_type.clone(),
            target_id: ev.target_id.clone(),
            data: bson::to_bson(&ev.data)?,
            created_at: bson::DateTime::from_chrono(ev.occurred_at),
        };
        match self.coll.insert_one(&d).await {
            Ok(_) => Ok(()),
            Err(e) if is_duplicate_key(&e) => Ok(()),
            Err(e) => Err(e.into()),
        }
    }

    async fn query(&self, mut filter: bson::Document, q: Query) -> AppResult<Page<AuditDto>> {
        let page = PageQuery { limit: q.limit, after: q.after };
        if let Some(a) = q.action.as_deref().filter(|a| !a.is_empty()) {
            let pattern = format!("^{}", a.replace('.', "\\."));
            filter.insert("action", bson::Regex { pattern, options: String::new() });
        }
        if let Some(t) = q.target_id.as_deref().filter(|a| !a.is_empty()) {
            filter.insert("target_id", t);
        }
        if let Some(a) = &page.after {
            filter.insert("_id", doc! { "$lt": a });
        }
        let list: Vec<AuditDoc> =
            self.coll.find(filter).sort(doc! { "_id": -1 }).limit(page.limit() as i64 + 1).await?.try_collect().await?;
        let users = self.identity.users(&list.iter().filter_map(|x| x.actor_id.clone()).collect::<Vec<_>>()).await?;
        Ok(Page::from_overfetch(list, page.limit(), |x| x.id.clone()).map(|x| AuditDto {
            actor: x.actor_id.as_ref().and_then(|a| users.get(a).cloned()),
            id: x.id,
            actor_id: x.actor_id,
            action: x.action,
            target_type: x.target_type,
            target_id: x.target_id,
            data: bson::from_bson(x.data).unwrap_or_default(),
            created_at: x.created_at.to_chrono(),
        }))
    }
}

type S = Arc<AuditService>;

async fn workspace_log(
    State(s): State<S>,
    Auth(p): Auth,
    ApiPath(ws): ApiPath<String>,
    ApiQuery(q): ApiQuery<Query>,
) -> ApiResult<Json<Page<AuditDto>>> {
    let ws = WorkspaceId::from(ws);
    let a = s.access.workspace_access(&p.user_id, &ws).await?;
    match a {
        Some(a) if a.is_workspace_owner() => {}
        Some(a) if a.is_member() => return Err(AppError::forbidden("audit.owner_only", "Chỉ workspace owner xem được nhật ký").into()),
        _ => return Err(AppError::not_found("workspace.not_found", "Không tìm thấy workspace").into()),
    }
    Ok(Json(s.query(doc! { "workspace_id": &ws }, q).await?))
}

async fn system_log(State(s): State<S>, Auth(p): Auth, ApiQuery(q): ApiQuery<Query>) -> ApiResult<Json<Page<AuditDto>>> {
    if !p.is_admin() {
        return Err(AppError::forbidden("auth.admin_only", "Chỉ quản trị viên hệ thống được xem").into());
    }
    Ok(Json(s.query(doc! { "workspace_id": bson::Bson::Null }, q).await?))
}

struct Handler(Arc<AuditService>);

#[async_trait::async_trait]
impl EventHandler for Handler {
    fn name(&self) -> &'static str {
        "audit.record"
    }
    async fn handle(&self, ev: &DomainEvent) -> AppResult<()> {
        if ev.audit {
            self.0.record(ev).await
        } else {
            Ok(())
        }
    }
}

pub struct AuditModule {
    svc: Arc<AuditService>,
}

impl AuditModule {
    pub fn new(mongo: &Mongo, access: Arc<dyn AccessApi>, identity: Arc<dyn IdentityApi>, retention_days: u32) -> Self {
        let db = mongo.database("audit");
        AuditModule {
            svc: Arc::new(AuditService {
                coll: db.collection("audit_logs"),
                access,
                identity,
                retention: Duration::from_secs(retention_days as u64 * 86_400),
            }),
        }
    }
}

#[async_trait::async_trait]
impl Module for AuditModule {
    fn name(&self) -> &'static str {
        "audit"
    }
    async fn init(&self) -> AppResult<()> {
        ensure_indexes(
            &self.svc.coll,
            vec![
                index::plain("audit_ws", doc! { "workspace_id": 1, "_id": -1 }),
                index::ttl("audit_ttl", "created_at", self.svc.retention),
            ],
        )
        .await
    }
    fn router(&self) -> Router {
        Router::new()
            .route("/workspaces/{ws}/audit", get(workspace_log))
            .route("/admin/audit", get(system_log))
            .with_state(self.svc.clone())
    }
    fn event_handlers(&self) -> Vec<Arc<dyn EventHandler>> {
        vec![Arc::new(Handler(self.svc.clone()))]
    }
}
