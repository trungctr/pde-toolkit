//! Module **notifications**: thông báo trong ứng dụng.
//!
//! Nghe mọi sự kiện miền có danh sách `notify` (module nguồn đã chọn người nhận theo quyền tại thời điểm phát –
//! desc §8 `notifications`: nội dung hiển thị phải theo quyền của người nhận). Nội dung chỉ gồm mã / tên đối tượng
//! mà người nhận đã được phép biết; chi tiết vẫn kiểm tra quyền khi mở.
//!
//! Collection: `notifications` (tự xoá sau 180 ngày).

use axum::extract::State;
use axum::response::Response;
use axum::routing::{get, post};
use axum::{Json, Router};
use bson::{doc, Bson};
use chillcat_kernel::contracts::IdentityApi;
use chillcat_kernel::events::kinds as k;
use chillcat_kernel::*;
use chillcat_platform::http::no_content;
use chillcat_platform::mongo::{ensure_indexes, index, is_duplicate_key, now_bson};
use chillcat_platform::{ApiPath, ApiQuery, ApiResult, Auth, Module, Mongo};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::Collection;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;

#[derive(Clone, Debug, Serialize, Deserialize)]
struct NotificationDoc {
    #[serde(rename = "_id")]
    id: NotificationId,
    user_id: UserId,
    workspace_id: Option<WorkspaceId>,
    event_id: EventId,
    kind: String,
    target_type: String,
    target_id: String,
    title: String,
    /// Đường dẫn trong ứng dụng (hash route của giao diện).
    link: Option<String>,
    actor_id: Option<UserId>,
    read_at: Option<bson::DateTime>,
    created_at: bson::DateTime,
}

#[derive(Clone, Debug, Serialize)]
pub struct NotificationDto {
    pub id: NotificationId,
    pub workspace_id: Option<WorkspaceId>,
    pub kind: String,
    pub target_type: String,
    pub target_id: String,
    pub title: String,
    pub link: Option<String>,
    pub read: bool,
    pub created_at: DateTime<Utc>,
}

pub struct NotificationService {
    coll: Collection<NotificationDoc>,
    identity: Arc<dyn IdentityApi>,
}

fn s<'a>(d: &'a Value, key: &str) -> &'a str {
    d.get(key).and_then(Value::as_str).unwrap_or("")
}

/// Câu thông báo tiếng Việt cho một sự kiện. `actor` = tên người gây ra sự kiện.
pub fn render(ev: &DomainEvent, actor: &str) -> (String, Option<String>) {
    let d = &ev.data;
    let code = s(d, "code");
    let ver = s(d, "version");
    let doc_link = d
        .get("document_id")
        .and_then(Value::as_str)
        .map(|id| format!("#/hub/doc/{id}"))
        .or_else(|| (ev.target_type == "document").then(|| format!("#/hub/doc/{}", ev.target_id)));
    let ticket_link = d
        .get("ticket_id")
        .and_then(Value::as_str)
        .map(|id| format!("#/hub/ticket/{id}"))
        .or_else(|| (ev.target_type == "ticket").then(|| format!("#/hub/ticket/{}", ev.target_id)));
    let ws_link = ev.workspace_id.as_ref().map(|w| format!("#/hub/ws/{w}"));
    let n = d.get("number").and_then(Value::as_i64).unwrap_or(0);
    let ticket_status = |v: &str| {
        match v {
            "new" => "Mới",
            "reviewing" => "Đang xem xét",
            "accepted" => "Chấp nhận",
            "in_progress" => "Đang xử lý",
            "resolved" => "Đã xử lý",
            "deferred" => "Tạm hoãn",
            "rejected" => "Từ chối",
            "duplicate" => "Trùng",
            other => other,
        }
        .to_owned()
    };
    match ev.kind.as_str() {
        k::VERSION_SUBMITTED => (format!("{actor} gửi duyệt {code} bản {ver}"), doc_link),
        k::VERSION_REJECTED => (format!("{code} bản {ver} bị trả lại: {}", s(d, "comment")), doc_link),
        k::VERSION_APPROVED => (format!("{code} bản {ver} đã được duyệt – chờ phát hành"), doc_link),
        k::VERSION_REOPENED => (format!("{code} bản {ver} được mở lại để sửa: {}", s(d, "comment")), doc_link),
        k::VERSION_PUBLISHED => (format!("{code} đã phát hành bản {ver}"), doc_link),
        // Tác vụ nền không chọn người nhận cho sự kiện này (chỉ ghi nhật ký); câu chữ có sẵn nếu sau này cần báo.
        k::VERSION_PURGED => (format!("{code} bản {ver} (Thay thế) đã hết hạn lưu và được xoá"), doc_link),
        k::VERSION_CREATED => (format!("Bạn được giao soạn {code} bản {ver}"), doc_link),
        k::VERSION_EDITOR_CHANGED => (format!("Bạn được giao sửa bản dự thảo {code} {ver}"), doc_link),
        k::DOCUMENT_CREATED => (format!("Bạn được chỉ định soạn {code}"), doc_link),
        k::DOCUMENT_OWNER_CHANGED => (format!("Bạn trở thành người phụ trách {code}"), doc_link),
        k::DOCUMENT_REVIEW_NEEDED => (
            format!("{code} cần rà soát: {} bản {} đổi / bỏ mã đang được tham chiếu", s(d, "caused_by_code"), s(d, "caused_by_version")),
            doc_link,
        ),
        k::COMMENT_CREATED => (format!("{actor} nhận xét {code}: {}", s(d, "excerpt")), doc_link),
        k::COMMENT_RESOLVED => (format!("{actor} đã xử lý nhận xét của bạn ở {code}"), doc_link),
        k::COMMENT_DELETED => (format!("{actor} đã xoá một nhận xét ở {code} bản {ver}"), doc_link),
        k::TICKET_CREATED => (format!("Ticket mới #{n}: {}", s(d, "title")), ticket_link),
        k::TICKET_STATUS_CHANGED => (format!("Ticket #{n} chuyển sang “{}”", ticket_status(s(d, "to"))), ticket_link),
        k::TICKET_ASSIGNED => (format!("Bạn được giao ticket #{n}: {}", s(d, "title")), ticket_link),
        k::TICKET_UPDATED => (format!("{actor} đã sửa nội dung ticket #{n}"), ticket_link),
        k::TICKET_AI_CHECK_COMPLETED => (format!("AI đã chạy xong cho ticket #{n} – xem kết quả"), ticket_link),
        k::TICKET_GRANT_CREATED => ("Bạn được cấp quyền với ticket của dự án".into(), ws_link),
        k::TICKET_DELEGATION_CREATED => ("Bạn được uỷ quyền quyết định cấp quyền ticket".into(), ws_link),
        k::WORKSPACE_OWNERSHIP_TRANSFERRED => (format!("Bạn là workspace owner mới của {}", s(d, "workspace_name")), ws_link),
        k::GROUP_CREATED => (format!("Bạn là group owner của group mới “{}”", s(d, "name")), ws_link),
        k::GROUP_OWNER_ASSIGNED => (format!("Thay đổi group owner của group “{}”", s(d, "group_name")), ws_link),
        k::INVITATION_CREATED => (format!("{actor} mời bạn vào {}", s(d, "workspace_name")), Some("#/hub/invitations".into())),
        k::INVITATION_ACCEPTED => (format!("{actor} đã nhận lời mời"), ws_link),
        k::INVITATION_DECLINED => (format!("{actor} đã từ chối lời mời"), ws_link),
        k::MEMBERSHIP_PERMS_CHANGED => ("Quyền của bạn trong dự án đã thay đổi".into(), ws_link),
        k::MEMBERSHIP_REMOVED => ("Bạn đã bị loại khỏi một phạm vi của dự án".into(), None),
        other => (other.to_owned(), ws_link),
    }
}

impl NotificationService {
    async fn ensure_indexes(&self) -> AppResult<()> {
        ensure_indexes(
            &self.coll,
            vec![
                index::unique("notifications_event_user", doc! { "event_id": 1, "user_id": 1 }),
                index::plain("notifications_user", doc! { "user_id": 1, "_id": -1 }),
                index::ttl("notifications_ttl", "created_at", Duration::from_secs(180 * 86_400)),
            ],
        )
        .await
    }

    async fn on_event(&self, ev: &DomainEvent) -> AppResult<()> {
        if ev.notify.is_empty() {
            return Ok(());
        }
        let actor = match &ev.actor_id {
            Some(a) => self.identity.user(a).await?.map(|u| u.display_name).unwrap_or_default(),
            None => "Hệ thống".into(),
        };
        let (title, link) = render(ev, &actor);
        for u in &ev.notify {
            let n = NotificationDoc {
                id: NotificationId::new(),
                user_id: u.clone(),
                workspace_id: ev.workspace_id.clone(),
                event_id: ev.id.clone(),
                kind: ev.kind.clone(),
                target_type: ev.target_type.clone(),
                target_id: ev.target_id.clone(),
                title: title.chars().take(300).collect(),
                link: link.clone(),
                actor_id: ev.actor_id.clone(),
                read_at: None,
                created_at: bson::DateTime::from_chrono(ev.occurred_at),
            };
            match self.coll.insert_one(&n).await {
                Ok(_) => {}
                Err(e) if is_duplicate_key(&e) => {} // sự kiện được phát lại
                Err(e) => return Err(e.into()),
            }
        }
        Ok(())
    }

    fn dto(n: NotificationDoc) -> NotificationDto {
        NotificationDto {
            id: n.id,
            workspace_id: n.workspace_id,
            kind: n.kind,
            target_type: n.target_type,
            target_id: n.target_id,
            title: n.title,
            link: n.link,
            read: n.read_at.is_some(),
            created_at: n.created_at.to_chrono(),
        }
    }
}

#[derive(Deserialize)]
struct ListQuery {
    #[serde(default)]
    unread: bool,
    limit: Option<u32>,
    after: Option<String>,
}

#[derive(Serialize)]
struct Count {
    unread: u64,
}

type S = Arc<NotificationService>;

async fn list(State(s): State<S>, Auth(p): Auth, ApiQuery(q): ApiQuery<ListQuery>) -> ApiResult<Json<Page<NotificationDto>>> {
    let page = PageQuery { limit: q.limit, after: q.after };
    let mut filter = doc! { "user_id": &p.user_id };
    if q.unread {
        filter.insert("read_at", Bson::Null);
    }
    if let Some(a) = &page.after {
        filter.insert("_id", doc! { "$lt": a });
    }
    let list: Vec<NotificationDoc> =
        s.coll.find(filter).sort(doc! { "_id": -1 }).limit(page.limit() as i64 + 1).await?.try_collect().await?;
    Ok(Json(Page::from_overfetch(list, page.limit(), |n| n.id.to_string()).map(NotificationService::dto)))
}

async fn unread(State(s): State<S>, Auth(p): Auth) -> ApiResult<Json<Count>> {
    Ok(Json(Count { unread: s.coll.count_documents(doc! { "user_id": &p.user_id, "read_at": Bson::Null }).await? }))
}

async fn read_one(State(s): State<S>, Auth(p): Auth, ApiPath(id): ApiPath<String>) -> ApiResult<Response> {
    s.coll.update_one(doc! { "_id": id, "user_id": &p.user_id, "read_at": Bson::Null }, doc! { "$set": { "read_at": now_bson() } }).await?;
    Ok(no_content())
}

async fn read_all(State(s): State<S>, Auth(p): Auth) -> ApiResult<Response> {
    s.coll.update_many(doc! { "user_id": &p.user_id, "read_at": Bson::Null }, doc! { "$set": { "read_at": now_bson() } }).await?;
    Ok(no_content())
}

struct Handler(Arc<NotificationService>);

#[async_trait::async_trait]
impl EventHandler for Handler {
    fn name(&self) -> &'static str {
        "notifications.deliver"
    }
    async fn handle(&self, ev: &DomainEvent) -> AppResult<()> {
        self.0.on_event(ev).await
    }
}

pub struct NotificationsModule {
    svc: Arc<NotificationService>,
}

impl NotificationsModule {
    pub fn new(mongo: &Mongo, identity: Arc<dyn IdentityApi>) -> Self {
        let db = mongo.database("notifications");
        NotificationsModule { svc: Arc::new(NotificationService { coll: db.collection("notifications"), identity }) }
    }
}

#[async_trait::async_trait]
impl Module for NotificationsModule {
    fn name(&self) -> &'static str {
        "notifications"
    }
    async fn init(&self) -> AppResult<()> {
        self.svc.ensure_indexes().await
    }
    fn router(&self) -> Router {
        Router::new()
            .route("/me/notifications", get(list))
            .route("/me/notifications/unread-count", get(unread))
            .route("/me/notifications/read-all", post(read_all))
            .route("/me/notifications/{id}/read", post(read_one))
            .with_state(self.svc.clone())
    }
    fn event_handlers(&self) -> Vec<Arc<dyn EventHandler>> {
        vec![Arc::new(Handler(self.svc.clone()))]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn renders_vietnamese_messages_with_links() {
        let ev = DomainEvent::new(k::VERSION_SUBMITTED, "version", "v1")
            .data(json!({ "document_id": "d1", "code": "SHOP-SRS-ORD-001", "version": "0.2" }));
        let (t, link) = render(&ev, "Lê An");
        assert_eq!(t, "Lê An gửi duyệt SHOP-SRS-ORD-001 bản 0.2");
        assert_eq!(link.as_deref(), Some("#/hub/doc/d1"));
        let ev = DomainEvent::new(k::TICKET_STATUS_CHANGED, "ticket", "t1").data(json!({ "number": 7, "to": "in_progress" }));
        assert_eq!(render(&ev, "x").0, "Ticket #7 chuyển sang “Đang xử lý”");
        assert_eq!(render(&ev, "x").1.as_deref(), Some("#/hub/ticket/t1"));
    }

    #[test]
    fn purge_events_are_rendered_but_never_delivered() {
        let ev = DomainEvent::new(k::VERSION_PURGED, "version", "v1")
            .data(json!({ "document_id": "d1", "code": "SHOP-SRS-ORD-001", "version": "1.0" }))
            .audit();
        let (t, link) = render(&ev, "Hệ thống");
        assert_eq!(t, "SHOP-SRS-ORD-001 bản 1.0 (Thay thế) đã hết hạn lưu và được xoá");
        assert_eq!(link.as_deref(), Some("#/hub/doc/d1"));
        // Không có người nhận ⇒ `on_event` bỏ qua (chỉ module audit ghi lại).
        assert!(ev.notify.is_empty());
        let ev = DomainEvent::new(k::INVITATION_DECLINED, "invitation", "i1").workspace(&WorkspaceId::from("w1"));
        assert_eq!(render(&ev, "Lê An"), ("Lê An đã từ chối lời mời".to_owned(), Some("#/hub/ws/w1".to_owned())));
    }
}
