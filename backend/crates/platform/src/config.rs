//! Cấu hình đọc từ biến môi trường (xem `.env.example`). Không có giá trị bí mật mặc định cho môi trường thật.

use chillcat_kernel::{AppError, AppResult};
use std::collections::HashMap;
use std::time::Duration;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AppEnv {
    Dev,
    Prod,
}

#[derive(Clone, Debug)]
pub struct Settings {
    pub env: AppEnv,
    pub http: HttpSettings,
    pub mongo: MongoSettings,
    pub auth: AuthSettings,
    pub ai: AiSettings,
    pub retention: RetentionSettings,
    pub workspaces: WorkspaceSettings,
}

#[derive(Clone, Debug)]
pub struct HttpSettings {
    /// Địa chỉ lắng nghe, ví dụ `0.0.0.0:8080`.
    pub addr: String,
    /// Địa chỉ người dùng mở ứng dụng (để dựng link lời mời, link công khai).
    pub public_base_url: String,
    /// Thư mục chứa giao diện tĩnh (index.html, js/, css/…). `None` = chỉ phục vụ API.
    pub static_dir: Option<String>,
    /// Các origin được gọi API từ trình duyệt (khi giao diện nằm ở tên miền khác). Rỗng = chỉ cùng origin.
    pub cors_allowed_origins: Vec<String>,
    pub request_body_limit_bytes: usize,
}

#[derive(Clone, Debug)]
pub struct MongoSettings {
    /// `mongodb+srv://…` (Atlas) hoặc `mongodb://…?replicaSet=rs0`. Bắt buộc là replica set (cần transaction).
    pub uri: String,
    /// Tên cơ sở dữ liệu mặc định cho mọi module.
    pub database: String,
    /// Ghi đè tên CSDL cho từng module (`MONGODB_DB_<MODULE>`): bước đầu để tách dữ liệu khi tách dịch vụ.
    pub module_databases: HashMap<String, String>,
    pub max_pool_size: u32,
    pub server_selection_timeout: Duration,
    /// Chỉ dùng trên máy phát triển: tự chạy `replSetInitiate` nếu mongod chưa khởi tạo replica set.
    pub auto_init_replica_set: bool,
}

#[derive(Clone, Debug)]
pub struct AuthSettings {
    pub jwt_secret: String,
    pub access_token_ttl: Duration,
    pub refresh_token_ttl: Duration,
    /// Cho phép tự đăng ký tài khoản (ứng dụng nội bộ: mặc định bật).
    pub allow_registration: bool,
    pub bootstrap_admin_email: Option<String>,
    pub bootstrap_admin_password: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AiProvider {
    /// Không dùng AI: kiểm tra trùng và đề xuất tài liệu bằng so khớp từ khoá / mã truy vết.
    None,
    /// Claude qua Messages API (`https://api.anthropic.com/v1/messages`).
    Anthropic,
}

#[derive(Clone, Debug)]
pub struct AiSettings {
    pub provider: AiProvider,
    pub api_key: Option<String>,
    pub model: String,
    /// Địa chỉ gốc của API (mặc định `https://api.anthropic.com`; đổi khi đi qua proxy nội bộ).
    pub base_url: String,
    pub timeout: Duration,
    /// Bật chạy lại phía máy chủ trên model dự phòng khi yêu cầu bị bộ lọc an toàn từ chối
    /// (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`).
    pub fallbacks: bool,
}

#[derive(Clone, Debug)]
pub struct RetentionSettings {
    /// Nhật ký giữ 2 năm (§5.3). Mốc bắt đầu chưa chốt trong đặc tả – ở đây tính từ lúc ghi.
    pub audit_days: u32,
    /// Phiên bản cũ giữ 10 năm kể từ lúc bị thay thế (§5.3).
    pub superseded_version_years: u32,
    pub invitation_days: u32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum WorkspaceCreation {
    /// Mọi người dùng đã đăng nhập đều tạo được workspace.
    All,
    /// Chỉ quản trị hệ thống.
    Admin,
}

#[derive(Clone, Debug)]
pub struct WorkspaceSettings {
    pub creation: WorkspaceCreation,
}

fn var(name: &str) -> Option<String> {
    std::env::var(name).ok().map(|v| v.trim().to_owned()).filter(|v| !v.is_empty())
}

fn bad(name: &str, why: &str) -> AppError {
    AppError::internal(format!("Cấu hình không hợp lệ: {name} {why}"))
}

fn parse<T: std::str::FromStr>(name: &str, default: T) -> AppResult<T> {
    match var(name) {
        None => Ok(default),
        Some(v) => v.parse::<T>().map_err(|_| bad(name, &format!("= \"{v}\" không đọc được"))),
    }
}

fn flag(name: &str, default: bool) -> AppResult<bool> {
    match var(name).map(|v| v.to_ascii_lowercase()) {
        None => Ok(default),
        Some(v) if ["1", "true", "yes", "on"].contains(&v.as_str()) => Ok(true),
        Some(v) if ["0", "false", "no", "off"].contains(&v.as_str()) => Ok(false),
        Some(v) => Err(bad(name, &format!("= \"{v}\" phải là true / false"))),
    }
}

impl Settings {
    /// Đọc cấu hình từ môi trường. Gọi `dotenvy::dotenv()` trước nếu muốn dùng file `.env`.
    pub fn from_env() -> AppResult<Self> {
        let env = match var("APP_ENV").unwrap_or_else(|| "dev".into()).to_ascii_lowercase().as_str() {
            "dev" | "development" => AppEnv::Dev,
            "prod" | "production" => AppEnv::Prod,
            other => return Err(bad("APP_ENV", &format!("= \"{other}\" phải là dev / prod"))),
        };

        let jwt_secret = match (var("JWT_SECRET"), &env) {
            (Some(s), _) if s.len() >= 32 => s,
            (Some(_), _) => return Err(bad("JWT_SECRET", "phải dài ít nhất 32 ký tự")),
            (None, AppEnv::Prod) => return Err(bad("JWT_SECRET", "bắt buộc ở môi trường prod")),
            (None, AppEnv::Dev) => {
                tracing::warn!("Chưa đặt JWT_SECRET – dùng khoá tạm: access token cũ mất hiệu lực mỗi lần khởi động lại");
                format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple())
            }
        };

        let mut module_databases = HashMap::new();
        for (k, v) in std::env::vars() {
            if let Some(module) = k.strip_prefix("MONGODB_DB_") {
                if !v.trim().is_empty() {
                    module_databases.insert(module.to_ascii_lowercase(), v.trim().to_owned());
                }
            }
        }

        let provider = match var("AI_PROVIDER").unwrap_or_else(|| "none".into()).to_ascii_lowercase().as_str() {
            "none" | "off" => AiProvider::None,
            "anthropic" | "claude" => AiProvider::Anthropic,
            other => return Err(bad("AI_PROVIDER", &format!("= \"{other}\" phải là none / anthropic"))),
        };
        if provider == AiProvider::Anthropic && var("AI_API_KEY").is_none() {
            return Err(bad("AI_API_KEY", "bắt buộc khi AI_PROVIDER=anthropic"));
        }

        let creation = match var("WORKSPACE_CREATION").unwrap_or_else(|| "all".into()).to_ascii_lowercase().as_str() {
            "all" => WorkspaceCreation::All,
            "admin" => WorkspaceCreation::Admin,
            other => return Err(bad("WORKSPACE_CREATION", &format!("= \"{other}\" phải là all / admin"))),
        };

        let addr = var("HTTP_ADDR").unwrap_or_else(|| "127.0.0.1:8080".into());
        Ok(Settings {
            http: HttpSettings {
                public_base_url: var("PUBLIC_BASE_URL")
                    .unwrap_or_else(|| format!("http://{}", addr.replace("0.0.0.0", "localhost")))
                    .trim_end_matches('/')
                    .to_owned(),
                addr,
                static_dir: var("STATIC_DIR"),
                cors_allowed_origins: var("CORS_ALLOWED_ORIGINS")
                    .map(|v| v.split(',').map(|s| s.trim().trim_end_matches('/').to_owned()).filter(|s| !s.is_empty()).collect())
                    .unwrap_or_default(),
                request_body_limit_bytes: parse("REQUEST_BODY_LIMIT_MB", 16usize)? * 1024 * 1024,
            },
            mongo: MongoSettings {
                uri: var("MONGODB_URI").ok_or_else(|| bad("MONGODB_URI", "bắt buộc"))?,
                database: var("MONGODB_DB").unwrap_or_else(|| "chillcat".into()),
                module_databases,
                max_pool_size: parse("MONGODB_MAX_POOL", 20u32)?,
                server_selection_timeout: Duration::from_secs(parse("MONGODB_SERVER_SELECTION_TIMEOUT_SECS", 10u64)?),
                auto_init_replica_set: flag("MONGODB_AUTO_INIT_REPLICA_SET", false)?,
            },
            auth: AuthSettings {
                jwt_secret,
                access_token_ttl: Duration::from_secs(parse("ACCESS_TOKEN_TTL_SECS", 900u64)?),
                refresh_token_ttl: Duration::from_secs(parse("REFRESH_TOKEN_TTL_DAYS", 30u64)? * 86_400),
                allow_registration: flag("AUTH_ALLOW_REGISTRATION", true)?,
                bootstrap_admin_email: var("BOOTSTRAP_ADMIN_EMAIL"),
                bootstrap_admin_password: var("BOOTSTRAP_ADMIN_PASSWORD"),
            },
            ai: AiSettings {
                api_key: var("AI_API_KEY"),
                model: var("AI_MODEL").unwrap_or_else(|| "claude-opus-5-5".into()),
                base_url: var("AI_BASE_URL").unwrap_or_else(|| "https://api.anthropic.com".into()).trim_end_matches('/').to_owned(),
                timeout: Duration::from_secs(parse("AI_TIMEOUT_SECS", 300u64)?),
                fallbacks: flag("AI_FALLBACKS", true)?,
                provider,
            },
            retention: RetentionSettings {
                audit_days: parse("AUDIT_RETENTION_DAYS", 730u32)?,
                superseded_version_years: parse("VERSION_RETENTION_YEARS", 10u32)?,
                invitation_days: parse("INVITATION_TTL_DAYS", 14u32)?,
            },
            workspaces: WorkspaceSettings { creation },
            env,
        })
    }

    /// Tên CSDL của một module (mặc định dùng chung một CSDL).
    pub fn database_for(&self, module: &str) -> &str {
        self.mongo.module_databases.get(module).map(String::as_str).unwrap_or(&self.mongo.database)
    }
}
