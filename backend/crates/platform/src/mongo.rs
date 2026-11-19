//! MongoDB: kết nối (hướng tới Atlas), transaction có thử lại, tạo chỉ mục, nhận biết lỗi.
//!
//! Quy ước lưu trữ cho mọi module:
//! - `_id` là chuỗi UUID v7 (xem `chillcat_kernel::id`).
//! - Thời điểm lưu bằng `bson::DateTime` (kiểu Date của BSON – cần cho chỉ mục TTL và truy vấn theo khoảng).
//!   Struct lưu CSDL và struct trả về API (DTO, dùng `chrono::DateTime<Utc>`) là hai kiểu riêng.
//! - Mỗi module chỉ đọc / ghi collection của chính nó, trong CSDL lấy từ [`Mongo::database`].
//! - Bất biến trải trên nhiều document thì ghi trong [`with_txn`]; ràng buộc duy nhất thì dùng chỉ mục unique
//!   (kể cả chỉ mục từng phần) – không kiểm tra-rồi-ghi.

use crate::config::{MongoSettings, Settings};
use bson::doc;
use chillcat_kernel::{AppError, AppResult};
use chrono::{DateTime, Utc};
use futures::future::BoxFuture;
use mongodb::error::{ErrorKind, WriteFailure, TRANSIENT_TRANSACTION_ERROR, UNKNOWN_TRANSACTION_COMMIT_RESULT};
use mongodb::options::{ClientOptions, ReadConcern, ServerApi, ServerApiVersion, TransactionOptions, WriteConcern};
use mongodb::{Client, ClientSession, Collection, Database, IndexModel};
use std::time::Duration;

/// Kết nối MongoDB dùng chung của tiến trình.
#[derive(Clone)]
pub struct Mongo {
    client: Client,
    settings: MongoSettings,
}

impl Mongo {
    pub async fn connect(settings: &Settings) -> AppResult<Self> {
        let m = &settings.mongo;
        let mut opts = ClientOptions::parse(&m.uri).await.map_err(|e| AppError::internal(format!("MONGODB_URI không hợp lệ: {e}")))?;
        opts.app_name = Some("chillcat-studio".into());
        // Stable API v1: hành vi lệnh không đổi khi Atlas nâng phiên bản máy chủ.
        opts.server_api = Some(ServerApi::builder().version(ServerApiVersion::V1).build());
        opts.max_pool_size = Some(m.max_pool_size);
        opts.server_selection_timeout = Some(m.server_selection_timeout);
        opts.connect_timeout = Some(Duration::from_secs(10));
        // Ghi được xác nhận bởi đa số node: không mất dữ liệu khi Atlas chuyển primary.
        if opts.write_concern.is_none() {
            opts.write_concern = Some(WriteConcern::majority());
        }
        opts.retry_writes = Some(true);
        opts.retry_reads = Some(true);
        let client = Client::with_options(opts)?;
        let mongo = Mongo { client, settings: m.clone() };
        mongo.check_topology().await?;
        Ok(mongo)
    }

    /// Dùng lại một `Client` đã có (kiểm thử).
    pub fn from_client(client: Client, settings: MongoSettings) -> Self {
        Mongo { client, settings }
    }

    pub fn client(&self) -> &Client {
        &self.client
    }

    /// CSDL của một module (`MONGODB_DB_<MODULE>` nếu có, không thì CSDL chung).
    pub fn database(&self, module: &str) -> Database {
        let name = self.settings.module_databases.get(module).map(String::as_str).unwrap_or(&self.settings.database);
        self.client.database(name)
    }

    pub async fn ping(&self) -> AppResult<()> {
        self.client.database("admin").run_command(doc! { "ping": 1 }).await?;
        Ok(())
    }

    /// Transaction cần replica set (Atlas luôn là replica set). Báo lỗi rõ ràng ngay khi khởi động nếu
    /// đang nối vào một mongod đơn lẻ.
    async fn check_topology(&self) -> AppResult<()> {
        let admin = self.client.database("admin");
        let hello = match admin.run_command(doc! { "hello": 1 }).await {
            Ok(h) => h,
            Err(e) if self.settings.auto_init_replica_set => {
                tracing::warn!(error = %e, "Chưa có primary – thử khởi tạo replica set (chỉ dành cho máy phát triển)");
                self.init_replica_set().await?;
                admin.run_command(doc! { "hello": 1 }).await?
            }
            Err(e) => {
                return Err(AppError::unavailable(
                    "mongo.unreachable",
                    "Không kết nối được MongoDB – kiểm tra MONGODB_URI và mạng (Atlas: danh sách IP được phép)",
                )
                .with_source(e))
            }
        };
        let is_replica_set = hello.get_str("setName").is_ok() || hello.get_str("msg").is_ok_and(|m| m == "isdbgrid");
        if !is_replica_set {
            return Err(AppError::internal(
                "MongoDB phải chạy dạng replica set (cần transaction). Dùng Atlas, hoặc chạy `mongod --replSet rs0` \
                 rồi `rs.initiate()` – xem backend/scripts/dev-mongo.ps1",
            ));
        }
        Ok(())
    }

    async fn init_replica_set(&self) -> AppResult<()> {
        // Phải nối thẳng vào node (chưa có replica set để dò).
        let mut opts = ClientOptions::parse(&self.settings.uri).await?;
        opts.direct_connection = Some(true);
        opts.repl_set_name = None;
        opts.server_selection_timeout = Some(Duration::from_secs(5));
        let direct = Client::with_options(opts)?;
        match direct.database("admin").run_command(doc! { "replSetInitiate": {} }).await {
            Ok(_) => {}
            // 23 = AlreadyInitialized
            Err(e) if matches!(*e.kind, ErrorKind::Command(ref c) if c.code == 23) => {}
            Err(e) => return Err(e.into()),
        }
        for _ in 0..40 {
            if let Ok(h) = direct.database("admin").run_command(doc! { "hello": 1 }).await {
                if h.get_bool("isWritablePrimary").unwrap_or(false) {
                    return Ok(());
                }
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
        Err(AppError::unavailable("mongo.no_primary", "Replica set chưa bầu được primary"))
    }
}

/// Chạy `f` trong một transaction; tự thử lại khi gặp lỗi tạm thời (chuyển primary, xung đột ghi) theo
/// đúng quy tắc của driver. `f` có thể được gọi nhiều lần nên không được có tác dụng phụ ngoài CSDL.
///
/// ```ignore
/// let saved = with_txn(mongo.client(), |s| {
///     let (repo, bus, doc, event) = (self.repo.clone(), self.bus.clone(), doc.clone(), event.clone());
///     Box::pin(async move {
///         repo.insert(s, &doc).await?;
///         bus.publish_in(s, event).await?;
///         Ok(doc)
///     })
/// })
/// .await?;
/// ```
///
/// Lỗi nghiệp vụ (`AppError` không phải lỗi tạm thời của MongoDB) làm transaction bị huỷ và được trả về nguyên vẹn.
pub async fn with_txn<T, F>(client: &Client, mut f: F) -> AppResult<T>
where
    T: Send,
    F: for<'a> FnMut(&'a mut ClientSession) -> BoxFuture<'a, AppResult<T>> + Send,
{
    const MAX_ATTEMPTS: u32 = 5;
    let mut session = client.start_session().await?;
    let txn_opts = || TransactionOptions::builder().read_concern(ReadConcern::snapshot()).write_concern(WriteConcern::majority()).build();
    let mut attempt = 0;
    loop {
        attempt += 1;
        session.start_transaction().with_options(txn_opts()).await?;
        let value = match f(&mut session).await {
            Ok(v) => v,
            Err(e) => {
                let _ = session.abort_transaction().await;
                if attempt < MAX_ATTEMPTS && has_label(&e, TRANSIENT_TRANSACTION_ERROR) {
                    tokio::time::sleep(backoff(attempt)).await;
                    continue;
                }
                return Err(e);
            }
        };
        // Commit: thử lại commit khi kết quả chưa rõ; chạy lại cả transaction khi lỗi tạm thời.
        let mut commit_attempt = 0;
        loop {
            commit_attempt += 1;
            match session.commit_transaction().await {
                Ok(()) => return Ok(value),
                Err(e) if commit_attempt < MAX_ATTEMPTS && e.contains_label(UNKNOWN_TRANSACTION_COMMIT_RESULT) => {
                    tokio::time::sleep(backoff(commit_attempt)).await;
                }
                Err(e) if attempt < MAX_ATTEMPTS && e.contains_label(TRANSIENT_TRANSACTION_ERROR) => {
                    tokio::time::sleep(backoff(attempt)).await;
                    break;
                }
                Err(e) => return Err(e.into()),
            }
        }
    }
}

fn backoff(attempt: u32) -> Duration {
    Duration::from_millis(15 * 2u64.pow(attempt.min(6)))
}

fn mongo_source(e: &AppError) -> Option<&mongodb::error::Error> {
    e.source.as_ref().and_then(|s| s.downcast_ref::<mongodb::error::Error>())
}

fn has_label(e: &AppError, label: &str) -> bool {
    mongo_source(e).is_some_and(|m| m.contains_label(label))
}

/// Lỗi vi phạm chỉ mục unique (E11000) – dùng để đổi thành `AppError::conflict(...)` có ý nghĩa.
pub fn is_duplicate_key(e: &mongodb::error::Error) -> bool {
    match &*e.kind {
        ErrorKind::Write(WriteFailure::WriteError(w)) => w.code == 11000,
        ErrorKind::Command(c) => c.code == 11000 || c.code == 11001,
        ErrorKind::InsertMany(m) => m.write_errors.as_ref().is_some_and(|ws| ws.iter().any(|w| w.code == 11000)),
        _ => false,
    }
}

/// Như [`is_duplicate_key`] nhưng cho lỗi đã đi qua `?` thành `AppError`.
pub fn is_duplicate_key_app(e: &AppError) -> bool {
    mongo_source(e).is_some_and(is_duplicate_key)
}

/// Tạo chỉ mục (idempotent – gọi mỗi lần khởi động). Đặt tên chỉ mục rõ ràng để dễ đối chiếu trên Atlas.
pub async fn ensure_indexes<T: Send + Sync>(coll: &Collection<T>, indexes: Vec<IndexModel>) -> AppResult<()> {
    if indexes.is_empty() {
        return Ok(());
    }
    coll.create_indexes(indexes)
        .await
        .map_err(|e| AppError::internal(format!("Không tạo được chỉ mục cho collection `{}`: {e}", coll.name())).with_source(e))?;
    Ok(())
}

/// Tiện ích dựng [`IndexModel`].
pub mod index {
    use bson::Document;
    use mongodb::options::IndexOptions;
    use mongodb::IndexModel;
    use std::time::Duration;

    pub fn plain(name: &str, keys: Document) -> IndexModel {
        IndexModel::builder().keys(keys).options(IndexOptions::builder().name(name.to_owned()).build()).build()
    }

    pub fn unique(name: &str, keys: Document) -> IndexModel {
        IndexModel::builder().keys(keys).options(IndexOptions::builder().name(name.to_owned()).unique(true).build()).build()
    }

    /// Chỉ mục unique từng phần: chỉ áp dụng cho document khớp `filter` (ví dụ "mỗi tài liệu một bản đang soạn").
    pub fn unique_partial(name: &str, keys: Document, filter: Document) -> IndexModel {
        IndexModel::builder()
            .keys(keys)
            .options(IndexOptions::builder().name(name.to_owned()).unique(true).partial_filter_expression(filter).build())
            .build()
    }

    /// Chỉ mục TTL: MongoDB tự xoá document khi trường ngày `field` đã qua `after`.
    pub fn ttl(name: &str, field: &str, after: Duration) -> IndexModel {
        IndexModel::builder()
            .keys(bson::doc! { field: 1 })
            .options(IndexOptions::builder().name(name.to_owned()).expire_after(after).build())
            .build()
    }

    /// Chỉ mục văn bản (tìm theo từ khoá). Trên Atlas có thể thay bằng Atlas Search.
    pub fn text(name: &str, fields: &[&str]) -> IndexModel {
        let mut keys = Document::new();
        for f in fields {
            keys.insert(*f, "text");
        }
        IndexModel::builder()
            .keys(keys)
            .options(IndexOptions::builder().name(name.to_owned()).default_language("none".to_owned()).build())
            .build()
    }
}

/// `chrono` → BSON Date.
pub fn to_bson_dt(t: DateTime<Utc>) -> bson::DateTime {
    bson::DateTime::from_chrono(t)
}

/// BSON Date → `chrono`.
pub fn from_bson_dt(t: bson::DateTime) -> DateTime<Utc> {
    t.to_chrono()
}

/// Thời điểm hiện tại dạng BSON Date.
pub fn now_bson() -> bson::DateTime {
    bson::DateTime::now()
}
