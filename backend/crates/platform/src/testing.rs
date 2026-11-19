//! Tiện ích cho kiểm thử tích hợp (bật bằng feature `testing`).
//!
//! Kiểm thử tích hợp chạy trên MongoDB thật (replica set) lấy từ biến môi trường `MONGODB_URI`
//! (mặc định `mongodb://127.0.0.1:27117/?replicaSet=rs0&directConnection=true` – xem scripts/dev-mongo.ps1).
//! Mỗi [`TestDb`] dùng một CSDL riêng tên ngẫu nhiên và tự xoá khi ra khỏi phạm vi, nên các bài kiểm thử
//! chạy song song không đụng nhau.

use crate::config::MongoSettings;
use crate::jwt::{JwtSigner, JwtVerifier};
use crate::mongo::Mongo;
use crate::outbox::EventBus;
use chillcat_kernel::{Principal, SessionId, SystemRole, UserId};
use mongodb::{Client, Database};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

pub const TEST_JWT_SECRET: &str = "test-secret-test-secret-test-secret-0123";
const DEFAULT_URI: &str = "mongodb://127.0.0.1:27117/?replicaSet=rs0&directConnection=true";

pub fn test_uri() -> String {
    std::env::var("MONGODB_URI").ok().filter(|v| !v.trim().is_empty()).unwrap_or_else(|| DEFAULT_URI.to_owned())
}

/// CSDL tạm cho một bài kiểm thử.
pub struct TestDb {
    pub mongo: Mongo,
    pub name: String,
    uri: String,
}

impl TestDb {
    pub async fn new() -> Self {
        let uri = test_uri();
        let name = format!("cc_test_{}", uuid::Uuid::new_v4().simple());
        let client = Client::with_uri_str(&uri).await.expect("MONGODB_URI của kiểm thử không hợp lệ");
        client
            .database("admin")
            .run_command(bson::doc! { "ping": 1 })
            .await
            .expect("Không nối được MongoDB cho kiểm thử – chạy backend/scripts/dev-mongo.ps1 trước");
        let settings = MongoSettings {
            uri: uri.clone(),
            database: name.clone(),
            module_databases: HashMap::new(),
            max_pool_size: 10,
            server_selection_timeout: Duration::from_secs(10),
            auto_init_replica_set: false,
        };
        TestDb { mongo: Mongo::from_client(client, settings), name, uri }
    }

    /// CSDL của bài kiểm thử (mọi module dùng chung một CSDL tạm).
    pub fn db(&self) -> Database {
        self.mongo.client().database(&self.name)
    }

    /// Outbox của CSDL tạm, đã có chỉ mục.
    pub async fn bus(&self) -> EventBus {
        let bus = EventBus::new(&self.db());
        bus.ensure_indexes().await.expect("tạo chỉ mục outbox");
        bus
    }
}

impl Drop for TestDb {
    fn drop(&mut self) {
        // Drop không async: xoá CSDL tạm trên một luồng riêng với runtime riêng, và chờ cho xong
        // để tiến trình kiểm thử không thoát trước khi dọn.
        let (uri, name) = (self.uri.clone(), self.name.clone());
        let handle = std::thread::spawn(move || {
            if let Ok(rt) = tokio::runtime::Builder::new_current_thread().enable_all().build() {
                rt.block_on(async move {
                    if let Ok(client) = Client::with_uri_str(&uri).await {
                        let _ = client.database(&name).drop().await;
                    }
                });
            }
        });
        let _ = handle.join();
    }
}

/// Bộ ký / kiểm tra token dùng chung cho kiểm thử.
pub fn test_jwt() -> (JwtSigner, Arc<JwtVerifier>) {
    (
        JwtSigner::new(TEST_JWT_SECRET, Duration::from_secs(900)).expect("khoá thử"),
        Arc::new(JwtVerifier::new(TEST_JWT_SECRET).expect("khoá thử")),
    )
}

pub fn principal(user_id: &UserId) -> Principal {
    Principal { user_id: user_id.clone(), system_role: SystemRole::User, session_id: SessionId::new() }
}

pub fn admin_principal(user_id: &UserId) -> Principal {
    Principal { user_id: user_id.clone(), system_role: SystemRole::Admin, session_id: SessionId::new() }
}

/// Header `Authorization` hợp lệ cho `user_id` (dùng khi gọi router bằng `tower::ServiceExt::oneshot`).
pub fn bearer(user_id: &UserId) -> String {
    let (signer, _) = test_jwt();
    format!("Bearer {}", signer.sign(&principal(user_id)).expect("ký token thử").0)
}
