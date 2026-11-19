//! Outbox: ghi sự kiện miền vào CSDL (cùng transaction với thay đổi dữ liệu) rồi phát cho handler.
//!
//! - [`EventBus`]: module dùng để ghi sự kiện. `publish_in` ghi trong transaction đang mở ⇒ sự kiện tồn tại
//!   khi và chỉ khi thay đổi dữ liệu được commit.
//! - [`OutboxRelay`]: vòng lặp nền nhận từng sự kiện chưa phát (có khoá thuê để nhiều tiến trình không phát
//!   trùng), gọi các handler, đánh dấu đã phát. Lỗi ⇒ thử lại với thời gian chờ tăng dần; quá số lần thì
//!   đánh dấu hỏng và giữ lại để kiểm tra.
//!
//! Phát ít nhất một lần: handler phải idempotent. Relay ghi lại handler nào đã xong để lần thử lại không
//! gọi lại handler đó.

use crate::mongo::{ensure_indexes, index, now_bson};
use bson::{doc, Bson};
use chillcat_kernel::{AppResult, DomainEvent, EventHandler, EventId, UserId, WorkspaceId};
use mongodb::options::ReturnDocument;
use mongodb::{ClientSession, Collection, Database};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Notify;

const COLLECTION: &str = "outbox";
const MAX_ATTEMPTS: i32 = 8;
const LEASE: Duration = Duration::from_secs(60);
const IDLE_POLL: Duration = Duration::from_millis(400);
/// Sự kiện đã phát được giữ 7 ngày để tra cứu rồi tự xoá.
const DISPATCHED_TTL: Duration = Duration::from_secs(7 * 86_400);

#[derive(Clone, Debug, Serialize, Deserialize)]
struct OutboxDoc {
    #[serde(rename = "_id")]
    id: String,
    kind: String,
    occurred_at: bson::DateTime,
    workspace_id: Option<String>,
    actor_id: Option<String>,
    target_type: String,
    target_id: String,
    data: Bson,
    notify: Vec<String>,
    audit: bool,
    attempts: i32,
    /// Các handler đã xử lý xong sự kiện này.
    #[serde(default)]
    done: Vec<String>,
    /// Thời điểm sớm nhất được nhận xử lý (khoá thuê / chờ thử lại).
    available_at: bson::DateTime,
    dispatched_at: Option<bson::DateTime>,
    failed_at: Option<bson::DateTime>,
    last_error: Option<String>,
}

impl OutboxDoc {
    fn from_event(e: DomainEvent) -> AppResult<Self> {
        Ok(OutboxDoc {
            id: e.id.into_string(),
            kind: e.kind,
            occurred_at: bson::DateTime::from_chrono(e.occurred_at),
            workspace_id: e.workspace_id.map(Into::into),
            actor_id: e.actor_id.map(Into::into),
            target_type: e.target_type,
            target_id: e.target_id,
            data: bson::to_bson(&e.data)?,
            notify: e.notify.into_iter().map(Into::into).collect(),
            audit: e.audit,
            attempts: 0,
            done: Vec::new(),
            available_at: now_bson(),
            dispatched_at: None,
            failed_at: None,
            last_error: None,
        })
    }

    fn to_event(&self) -> AppResult<DomainEvent> {
        Ok(DomainEvent {
            id: EventId::from(self.id.clone()),
            kind: self.kind.clone(),
            occurred_at: self.occurred_at.to_chrono(),
            workspace_id: self.workspace_id.clone().map(WorkspaceId::from),
            actor_id: self.actor_id.clone().map(UserId::from),
            target_type: self.target_type.clone(),
            target_id: self.target_id.clone(),
            data: bson::from_bson::<serde_json::Value>(self.data.clone())?,
            notify: self.notify.iter().cloned().map(UserId::from).collect(),
            audit: self.audit,
        })
    }
}

/// Nơi module ghi sự kiện miền.
#[derive(Clone)]
pub struct EventBus {
    coll: Collection<OutboxDoc>,
    wake: Arc<Notify>,
}

impl EventBus {
    pub fn new(db: &Database) -> Self {
        EventBus { coll: db.collection(COLLECTION), wake: Arc::new(Notify::new()) }
    }

    pub async fn ensure_indexes(&self) -> AppResult<()> {
        ensure_indexes(
            &self.coll,
            vec![
                index::plain("outbox_pending", doc! { "dispatched_at": 1, "failed_at": 1, "available_at": 1, "_id": 1 }),
                index::ttl("outbox_dispatched_ttl", "dispatched_at", DISPATCHED_TTL),
            ],
        )
        .await
    }

    /// Ghi sự kiện ngoài transaction (dùng khi thao tác chỉ ghi một document, hoặc trong handler).
    pub async fn publish(&self, event: DomainEvent) -> AppResult<()> {
        self.coll.insert_one(OutboxDoc::from_event(event)?).await?;
        self.wake.notify_one();
        Ok(())
    }

    /// Ghi sự kiện trong transaction đang mở: chỉ tồn tại nếu transaction được commit.
    pub async fn publish_in(&self, session: &mut ClientSession, event: DomainEvent) -> AppResult<()> {
        self.coll.insert_one(OutboxDoc::from_event(event)?).session(session).await?;
        // Relay có thể thức dậy trước khi commit; khi đó nó chưa thấy sự kiện và sẽ dò lại sau IDLE_POLL.
        self.wake.notify_one();
        Ok(())
    }

    pub async fn publish_all_in(&self, session: &mut ClientSession, events: Vec<DomainEvent>) -> AppResult<()> {
        for e in events {
            self.publish_in(session, e).await?;
        }
        Ok(())
    }

    /// Tạo relay phát sự kiện của outbox này cho `handlers`.
    pub fn relay(&self, handlers: Vec<Arc<dyn EventHandler>>) -> OutboxRelay {
        OutboxRelay { coll: self.coll.clone(), wake: self.wake.clone(), handlers }
    }
}

pub struct OutboxRelay {
    coll: Collection<OutboxDoc>,
    wake: Arc<Notify>,
    handlers: Vec<Arc<dyn EventHandler>>,
}

impl OutboxRelay {
    /// Vòng lặp nền; dừng khi `shutdown` chuyển sang `true`.
    pub async fn run(self, mut shutdown: tokio::sync::watch::Receiver<bool>) {
        tracing::info!(handlers = self.handlers.len(), "Outbox relay bắt đầu");
        loop {
            if *shutdown.borrow() {
                break;
            }
            match self.dispatch_next().await {
                Ok(true) => continue, // còn việc: làm tiếp ngay
                Ok(false) => {}
                Err(e) => tracing::error!(error = %e, "Outbox relay gặp lỗi khi đọc sự kiện"),
            }
            tokio::select! {
                _ = self.wake.notified() => {}
                _ = tokio::time::sleep(IDLE_POLL) => {}
                _ = shutdown.changed() => {}
            }
        }
        tracing::info!("Outbox relay đã dừng");
    }

    /// Phát hết các sự kiện đang chờ (dùng trong kiểm thử và khi tắt tiến trình). Trả về số sự kiện đã nhận xử lý.
    pub async fn drain(&self) -> AppResult<usize> {
        let mut n = 0;
        while self.dispatch_next().await? {
            n += 1;
        }
        Ok(n)
    }

    /// Nhận và xử lý một sự kiện. `Ok(false)` = không còn sự kiện nào đến hạn.
    async fn dispatch_next(&self) -> AppResult<bool> {
        let now = now_bson();
        let lease_until = bson::DateTime::from_millis(now.timestamp_millis() + LEASE.as_millis() as i64);
        let claimed = self
            .coll
            .find_one_and_update(
                doc! { "dispatched_at": Bson::Null, "failed_at": Bson::Null, "available_at": { "$lte": now } },
                doc! { "$set": { "available_at": lease_until }, "$inc": { "attempts": 1 } },
            )
            .sort(doc! { "_id": 1 })
            .return_document(ReturnDocument::After)
            .await?;
        let Some(rec) = claimed else { return Ok(false) };

        let event = match rec.to_event() {
            Ok(e) => e,
            Err(e) => {
                self.mark_failed(&rec.id, &format!("không đọc được sự kiện: {e}")).await?;
                return Ok(true);
            }
        };

        let mut first_error: Option<String> = None;
        for h in &self.handlers {
            if rec.done.iter().any(|d| d == h.name()) || !h.interested_in(&event.kind) {
                continue;
            }
            match h.handle(&event).await {
                Ok(()) => {
                    self.coll.update_one(doc! { "_id": &rec.id }, doc! { "$addToSet": { "done": h.name() } }).await?;
                }
                Err(e) => {
                    tracing::warn!(handler = h.name(), kind = %event.kind, event_id = %event.id, attempt = rec.attempts, error = %e, "Handler xử lý sự kiện thất bại");
                    first_error.get_or_insert_with(|| format!("{}: {e}", h.name()));
                }
            }
        }

        match first_error {
            None => {
                self.coll
                    .update_one(doc! { "_id": &rec.id }, doc! { "$set": { "dispatched_at": now_bson(), "last_error": Bson::Null } })
                    .await?;
            }
            Some(err) if rec.attempts >= MAX_ATTEMPTS => {
                tracing::error!(kind = %event.kind, event_id = %event.id, error = %err, "Sự kiện hỏng sau nhiều lần thử – giữ lại trong outbox để kiểm tra");
                self.mark_failed(&rec.id, &err).await?;
            }
            Some(err) => {
                let wait_ms = 500i64 * 2i64.pow(rec.attempts.clamp(1, 9) as u32);
                let retry_at = bson::DateTime::from_millis(now_bson().timestamp_millis() + wait_ms.min(300_000));
                self.coll.update_one(doc! { "_id": &rec.id }, doc! { "$set": { "available_at": retry_at, "last_error": err } }).await?;
            }
        }
        Ok(true)
    }

    async fn mark_failed(&self, id: &str, err: &str) -> AppResult<()> {
        self.coll.update_one(doc! { "_id": id }, doc! { "$set": { "failed_at": now_bson(), "last_error": err } }).await?;
        Ok(())
    }
}
