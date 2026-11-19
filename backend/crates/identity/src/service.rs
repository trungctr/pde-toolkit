use crate::model::*;
use crate::password;
use bson::{doc, Bson};
use chillcat_kernel::contracts::{IdentityApi, UserSummary};
use chillcat_kernel::events::kinds;
use chillcat_kernel::{AppError, AppResult, DomainEvent, Page, PageQuery, Principal, SessionId, SystemRole, UserId};
use chillcat_platform::mongo::{ensure_indexes, index, is_duplicate_key, now_bson};
use chillcat_platform::{EventBus, JwtSigner};
use futures::TryStreamExt;
use mongodb::options::ReturnDocument;
use mongodb::{Collection, Database};
use std::collections::HashMap;
use std::time::Duration;

const MAX_FAILED_LOGINS: i32 = 5;
const LOCKOUT: Duration = Duration::from_secs(5 * 60);

#[derive(Clone, Debug)]
pub struct IdentitySettings {
    pub allow_registration: bool,
    pub refresh_ttl: Duration,
    pub bootstrap_admin_email: Option<String>,
    pub bootstrap_admin_password: Option<String>,
    /// Đặt cờ `Secure` cho cookie refresh (bật khi ứng dụng chạy qua https).
    pub cookie_secure: bool,
}

pub struct IdentityService {
    users: Collection<UserDoc>,
    sessions: Collection<SessionDoc>,
    bus: EventBus,
    signer: JwtSigner,
    settings: IdentitySettings,
}

pub(crate) fn normalize_email(e: &str) -> AppResult<String> {
    let e = e.trim().to_lowercase();
    let ok = e.len() <= 254
        && !e.chars().any(char::is_whitespace)
        && e.split_once('@').is_some_and(|(l, d)| !l.is_empty() && d.contains('.') && !d.starts_with('.') && !d.ends_with('.'));
    if ok {
        Ok(e)
    } else {
        Err(AppError::unprocessable("user.invalid_email", "E-mail không hợp lệ"))
    }
}

fn clean_name(v: &str, field: &str) -> AppResult<String> {
    let v = v.split_whitespace().collect::<Vec<_>>().join(" ");
    if v.is_empty() || v.chars().count() > 100 {
        return Err(AppError::unprocessable("user.invalid_name", format!("{field} không được để trống và tối đa 100 ký tự")));
    }
    Ok(v)
}

fn check_password(p: &str) -> AppResult<()> {
    let n = p.chars().count();
    if !(8..=128).contains(&n) {
        return Err(AppError::unprocessable("user.weak_password", "Mật khẩu phải dài từ 8 đến 128 ký tự"));
    }
    Ok(())
}

fn clean_employee_code(v: Option<&str>) -> AppResult<Option<String>> {
    match v.map(str::trim) {
        None | Some("") => Ok(None),
        Some(c) if c.len() <= 32 && c.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_') => Ok(Some(c.to_uppercase())),
        Some(_) => Err(AppError::unprocessable("user.invalid_employee_code", "Mã nhân viên chỉ gồm chữ, số, '-' và '_' (tối đa 32 ký tự)")),
    }
}

fn clean_avatar(v: &str) -> AppResult<Option<String>> {
    let v = v.trim();
    if v.is_empty() {
        return Ok(None);
    }
    if v.len() > 2048 || !(v.starts_with("https://") || v.starts_with("http://")) {
        return Err(AppError::unprocessable("user.invalid_avatar", "Ảnh đại diện phải là địa chỉ http(s)"));
    }
    Ok(Some(v.to_owned()))
}

fn dup_to_conflict(e: mongodb::error::Error) -> AppError {
    if is_duplicate_key(&e) {
        let msg = e.to_string();
        if msg.contains("employee_code") {
            AppError::conflict("user.employee_code_taken", "Mã nhân viên đã được dùng cho tài khoản khác")
        } else {
            AppError::conflict("user.email_taken", "E-mail đã được dùng cho tài khoản khác")
        }
    } else {
        e.into()
    }
}

impl IdentityService {
    pub fn new(db: &Database, bus: EventBus, signer: JwtSigner, settings: IdentitySettings) -> Self {
        IdentityService { users: db.collection("users"), sessions: db.collection("sessions"), bus, signer, settings }
    }

    pub fn allow_registration(&self) -> bool {
        self.settings.allow_registration
    }

    pub fn cookie_secure(&self) -> bool {
        self.settings.cookie_secure
    }

    pub async fn ensure_indexes(&self) -> AppResult<()> {
        ensure_indexes(
            &self.users,
            vec![
                index::unique("users_email", doc! { "email": 1 }),
                index::unique_partial("users_employee_code", doc! { "employee_code": 1 }, doc! { "employee_code": { "$type": "string" } }),
            ],
        )
        .await?;
        ensure_indexes(
            &self.sessions,
            vec![
                index::plain("sessions_user", doc! { "user_id": 1 }),
                // Phiên tự biến mất khi hết hạn.
                index::ttl("sessions_expire", "expires_at", Duration::ZERO),
            ],
        )
        .await
    }

    /// Tạo quản trị viên đầu tiên từ `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` nếu chưa có quản trị viên nào.
    pub async fn bootstrap_admin(&self) -> AppResult<()> {
        let (Some(email), Some(pw)) = (&self.settings.bootstrap_admin_email, &self.settings.bootstrap_admin_password) else {
            return Ok(());
        };
        if self.users.count_documents(doc! { "system_role": "admin" }).limit(1).await? > 0 {
            return Ok(());
        }
        let email = normalize_email(email)?;
        if let Some(u) = self.users.find_one(doc! { "email": &email }).await? {
            self.users.update_one(doc! { "_id": &u.id }, doc! { "$set": { "system_role": "admin" } }).await?;
            tracing::info!(%email, "Đã nâng tài khoản có sẵn thành quản trị viên");
            return Ok(());
        }
        let user = self.new_user(&email, pw, "Quản trị", "Hệ thống", None, SystemRole::Admin).await?;
        self.users.insert_one(&user).await.map_err(dup_to_conflict)?;
        tracing::info!(%email, "Đã tạo tài khoản quản trị viên đầu tiên");
        Ok(())
    }

    async fn new_user(
        &self,
        email: &str,
        pw: &str,
        first: &str,
        last: &str,
        employee_code: Option<String>,
        role: SystemRole,
    ) -> AppResult<UserDoc> {
        check_password(pw)?;
        let now = now_bson();
        Ok(UserDoc {
            id: UserId::new(),
            email: email.to_owned(),
            employee_code,
            first_name: clean_name(first, "Tên")?,
            last_name: clean_name(last, "Họ")?,
            avatar_url: None,
            system_role: role,
            password_hash: password::hash(pw).await?,
            disabled: false,
            failed_logins: 0,
            locked_until: None,
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn register(&self, input: RegisterInput, user_agent: Option<String>) -> AppResult<AuthResponse> {
        if !self.settings.allow_registration {
            return Err(AppError::forbidden("auth.registration_disabled", "Máy chủ không cho tự đăng ký – liên hệ quản trị viên"));
        }
        let email = normalize_email(&input.email)?;
        let code = clean_employee_code(input.employee_code.as_deref())?;
        // Người đầu tiên đăng ký trên một hệ thống trống trở thành quản trị viên.
        let role = if self.users.estimated_document_count().await? == 0 { SystemRole::Admin } else { SystemRole::User };
        let user = self.new_user(&email, &input.password, &input.first_name, &input.last_name, code, role).await?;
        self.users.insert_one(&user).await.map_err(dup_to_conflict)?;
        self.bus
            .publish(
                DomainEvent::new(kinds::USER_REGISTERED, "user", user.id.as_str())
                    .actor(&user.id)
                    .data(serde_json::json!({ "email": user.email, "display_name": user.display_name() })),
            )
            .await?;
        self.start_session(&user, user_agent).await
    }

    pub async fn login(&self, input: LoginInput, user_agent: Option<String>) -> AppResult<AuthResponse> {
        let bad = || AppError::unauthenticated("E-mail hoặc mật khẩu không đúng").with_code("auth.invalid_credentials");
        let Ok(email) = normalize_email(&input.email) else {
            password::dummy_verify(&input.password).await;
            return Err(bad());
        };
        let Some(user) = self.users.find_one(doc! { "email": &email }).await? else {
            password::dummy_verify(&input.password).await;
            return Err(bad());
        };
        if let Some(until) = user.locked_until {
            if until > now_bson() {
                return Err(AppError::new(
                    chillcat_kernel::ErrorKind::TooManyRequests,
                    "auth.locked",
                    "Đăng nhập sai quá nhiều lần – thử lại sau ít phút",
                ));
            }
        }
        if !password::verify(&input.password, &user.password_hash).await? {
            let failed = user.failed_logins + 1;
            let mut set = doc! { "failed_logins": failed };
            if failed >= MAX_FAILED_LOGINS {
                set.insert("failed_logins", 0);
                set.insert("locked_until", bson::DateTime::from_millis(now_bson().timestamp_millis() + LOCKOUT.as_millis() as i64));
            }
            self.users.update_one(doc! { "_id": &user.id }, doc! { "$set": set }).await?;
            return Err(bad());
        }
        if user.disabled {
            return Err(AppError::forbidden("auth.disabled", "Tài khoản đã bị khoá – liên hệ quản trị viên"));
        }
        self.users.update_one(doc! { "_id": &user.id }, doc! { "$set": { "failed_logins": 0, "locked_until": Bson::Null } }).await?;
        self.start_session(&user, user_agent).await
    }

    async fn start_session(&self, user: &UserDoc, user_agent: Option<String>) -> AppResult<AuthResponse> {
        let secret = password::random_secret();
        let now = now_bson();
        let session = SessionDoc {
            id: SessionId::new(),
            user_id: user.id.clone(),
            secret_hash: password::sha256_hex(&secret),
            user_agent: user_agent.map(|s| s.chars().take(300).collect()),
            created_at: now,
            last_used_at: now,
            expires_at: bson::DateTime::from_millis(now.timestamp_millis() + self.settings.refresh_ttl.as_millis() as i64),
            revoked_at: None,
        };
        self.sessions.insert_one(&session).await?;
        self.issue(user, &session.id, &secret)
    }

    fn issue(&self, user: &UserDoc, session: &SessionId, secret: &str) -> AppResult<AuthResponse> {
        let principal = Principal { user_id: user.id.clone(), system_role: user.system_role, session_id: session.clone() };
        let (access_token, expires_in) = self.signer.sign(&principal)?;
        Ok(AuthResponse {
            access_token,
            token_type: "Bearer",
            expires_in,
            refresh_token: format!("{session}.{secret}"),
            refresh_expires_in: self.settings.refresh_ttl.as_secs(),
            user: UserDto::from(user),
        })
    }

    fn parse_refresh(token: &str) -> AppResult<(SessionId, &str)> {
        let invalid = || AppError::unauthenticated("Phiên đăng nhập không hợp lệ").with_code("auth.refresh_invalid");
        let (sid, secret) = token.trim().split_once('.').ok_or_else(invalid)?;
        if sid.is_empty() || secret.len() != 64 {
            return Err(invalid());
        }
        Ok((SessionId::from(sid), secret))
    }

    /// Đổi refresh token lấy access token mới; refresh token được xoay vòng.
    pub async fn refresh(&self, token: &str) -> AppResult<AuthResponse> {
        let invalid = || AppError::unauthenticated("Phiên đăng nhập đã hết hạn – vui lòng đăng nhập lại").with_code("auth.refresh_invalid");
        let (sid, secret) = Self::parse_refresh(token)?;
        let now = now_bson();
        let new_secret = password::random_secret();
        // Xoay vòng nguyên tử: chỉ một yêu cầu với đúng secret hiện tại thắng.
        let updated = self
            .sessions
            .find_one_and_update(
                doc! {
                    "_id": &sid, "secret_hash": password::sha256_hex(secret),
                    "revoked_at": Bson::Null, "expires_at": { "$gt": now },
                },
                doc! { "$set": { "secret_hash": password::sha256_hex(&new_secret), "last_used_at": now } },
            )
            .return_document(ReturnDocument::After)
            .await?;
        let Some(session) = updated else {
            // Secret sai cho một phiên còn sống ⇒ có thể token cũ bị đánh cắp: thu hồi cả phiên.
            let r =
                self.sessions.update_one(doc! { "_id": &sid, "revoked_at": Bson::Null }, doc! { "$set": { "revoked_at": now } }).await?;
            if r.modified_count > 0 {
                tracing::warn!(session = %sid, "Refresh token cũ bị dùng lại – đã thu hồi phiên");
            }
            return Err(invalid());
        };
        let user = self.users.find_one(doc! { "_id": &session.user_id }).await?.ok_or_else(invalid)?;
        if user.disabled {
            self.revoke_session(&sid).await?;
            return Err(AppError::forbidden("auth.disabled", "Tài khoản đã bị khoá – liên hệ quản trị viên"));
        }
        self.issue(&user, &session.id, &new_secret)
    }

    pub async fn logout_token(&self, token: &str) -> AppResult<()> {
        if let Ok((sid, secret)) = Self::parse_refresh(token) {
            self.sessions
                .update_one(
                    doc! { "_id": &sid, "secret_hash": password::sha256_hex(secret) },
                    doc! { "$set": { "revoked_at": now_bson() } },
                )
                .await?;
        }
        Ok(())
    }

    pub async fn revoke_session(&self, sid: &SessionId) -> AppResult<()> {
        self.sessions.update_one(doc! { "_id": sid }, doc! { "$set": { "revoked_at": now_bson() } }).await?;
        Ok(())
    }

    async fn revoke_all(&self, user: &UserId, except: Option<&SessionId>) -> AppResult<()> {
        let mut filter = doc! { "user_id": user, "revoked_at": Bson::Null };
        if let Some(s) = except {
            filter.insert("_id", doc! { "$ne": s });
        }
        self.sessions.update_many(filter, doc! { "$set": { "revoked_at": now_bson() } }).await?;
        Ok(())
    }

    pub async fn purge_revoked_sessions(&self) -> AppResult<()> {
        let cutoff = bson::DateTime::from_millis(now_bson().timestamp_millis() - 7 * 86_400_000);
        self.sessions.delete_many(doc! { "revoked_at": { "$lt": cutoff } }).await?;
        Ok(())
    }

    async fn get(&self, id: &UserId) -> AppResult<UserDoc> {
        self.users.find_one(doc! { "_id": id }).await?.ok_or_else(|| AppError::not_found("user.not_found", "Không tìm thấy người dùng"))
    }

    pub async fn me(&self, p: &Principal) -> AppResult<UserDto> {
        Ok(UserDto::from(&self.get(&p.user_id).await?))
    }

    pub async fn update_profile(&self, p: &Principal, input: ProfileInput) -> AppResult<UserDto> {
        let mut set = doc! { "updated_at": now_bson() };
        if let Some(v) = input.first_name {
            set.insert("first_name", clean_name(&v, "Tên")?);
        }
        if let Some(v) = input.last_name {
            set.insert("last_name", clean_name(&v, "Họ")?);
        }
        if let Some(v) = input.avatar_url {
            set.insert("avatar_url", clean_avatar(&v)?);
        }
        if let Some(v) = input.employee_code {
            set.insert("employee_code", clean_employee_code(Some(&v))?);
        }
        let user = self
            .users
            .find_one_and_update(doc! { "_id": &p.user_id }, doc! { "$set": set })
            .return_document(ReturnDocument::After)
            .await
            .map_err(dup_to_conflict)?
            .ok_or_else(|| AppError::not_found("user.not_found", "Không tìm thấy người dùng"))?;
        Ok(UserDto::from(&user))
    }

    /// Đổi mật khẩu; các phiên khác bị đăng xuất.
    pub async fn change_password(&self, p: &Principal, input: PasswordInput) -> AppResult<()> {
        let user = self.get(&p.user_id).await?;
        if !password::verify(&input.current_password, &user.password_hash).await? {
            return Err(AppError::unprocessable("user.wrong_password", "Mật khẩu hiện tại không đúng"));
        }
        check_password(&input.new_password)?;
        let h = password::hash(&input.new_password).await?;
        self.users.update_one(doc! { "_id": &p.user_id }, doc! { "$set": { "password_hash": h, "updated_at": now_bson() } }).await?;
        self.revoke_all(&p.user_id, Some(&p.session_id)).await
    }

    fn require_admin(p: &Principal) -> AppResult<()> {
        if p.is_admin() {
            Ok(())
        } else {
            Err(AppError::forbidden("auth.admin_only", "Chỉ quản trị viên hệ thống được làm việc này"))
        }
    }

    pub async fn admin_list(&self, p: &Principal, q: UserListQuery) -> AppResult<Page<UserDto>> {
        Self::require_admin(p)?;
        let page = PageQuery { limit: q.limit, after: q.after };
        let mut filter = doc! {};
        if let Some(text) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            let re = bson::Regex { pattern: regex_escape(text), options: "i".into() };
            filter.insert(
                "$or",
                vec![
                    doc! { "email": Bson::RegularExpression(re.clone()) },
                    doc! { "first_name": Bson::RegularExpression(re.clone()) },
                    doc! { "last_name": Bson::RegularExpression(re.clone()) },
                    doc! { "employee_code": Bson::RegularExpression(re) },
                ],
            );
        }
        if let Some(after) = &page.after {
            filter.insert("_id", doc! { "$lt": after });
        }
        let users: Vec<UserDoc> =
            self.users.find(filter).sort(doc! { "_id": -1 }).limit(page.limit() as i64 + 1).await?.try_collect().await?;
        Ok(Page::from_overfetch(users.iter().map(UserDto::from).collect(), page.limit(), |u| u.id.to_string()))
    }

    pub async fn admin_update(&self, p: &Principal, id: &UserId, input: AdminUserInput) -> AppResult<UserDto> {
        Self::require_admin(p)?;
        if id == &p.user_id && (input.disabled == Some(true) || input.system_role == Some(SystemRole::User)) {
            return Err(AppError::unprocessable("user.self_demote", "Không thể tự khoá hoặc tự bỏ quyền quản trị của mình"));
        }
        let before = self.get(id).await?;
        let mut set = doc! { "updated_at": now_bson() };
        if let Some(role) = input.system_role {
            set.insert("system_role", bson::to_bson(&role)?);
        }
        if let Some(d) = input.disabled {
            set.insert("disabled", d);
        }
        let user = self
            .users
            .find_one_and_update(doc! { "_id": id }, doc! { "$set": set })
            .return_document(ReturnDocument::After)
            .await?
            .ok_or_else(|| AppError::not_found("user.not_found", "Không tìm thấy người dùng"))?;
        if user.disabled && !before.disabled {
            self.revoke_all(id, None).await?;
            self.bus.publish(DomainEvent::new(kinds::USER_DISABLED, "user", id.as_str()).actor(&p.user_id).audit()).await?;
        }
        if !user.disabled && before.disabled {
            self.bus.publish(DomainEvent::new(kinds::USER_ENABLED, "user", id.as_str()).actor(&p.user_id).audit()).await?;
        }
        if user.system_role != before.system_role {
            self.bus
                .publish(
                    DomainEvent::new(kinds::USER_ROLE_CHANGED, "user", id.as_str())
                        .actor(&p.user_id)
                        .data(serde_json::json!({ "system_role": user.system_role }))
                        .audit(),
                )
                .await?;
        }
        Ok(UserDto::from(&user))
    }

    pub async fn lookup_email(&self, email: &str) -> AppResult<UserSummary> {
        let email = normalize_email(email)?;
        self.user_by_email(&email).await?.ok_or_else(|| AppError::not_found("user.not_found", "Chưa có tài khoản nào dùng e-mail này"))
    }
}

pub(crate) fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars().take(100) {
        if "\\.+*?()|[]{}^$#&-~".contains(c) {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

#[async_trait::async_trait]
impl IdentityApi for IdentityService {
    async fn user(&self, id: &UserId) -> AppResult<Option<UserSummary>> {
        Ok(self.users.find_one(doc! { "_id": id }).await?.map(|u| u.summary()))
    }

    async fn users(&self, ids: &[UserId]) -> AppResult<HashMap<UserId, UserSummary>> {
        if ids.is_empty() {
            return Ok(HashMap::new());
        }
        let list: Vec<UserDoc> = self.users.find(doc! { "_id": { "$in": ids } }).await?.try_collect().await?;
        Ok(list.into_iter().map(|u| (u.id.clone(), u.summary())).collect())
    }

    async fn user_by_email(&self, email: &str) -> AppResult<Option<UserSummary>> {
        let Ok(email) = normalize_email(email) else { return Ok(None) };
        Ok(self.users.find_one(doc! { "email": email }).await?.map(|u| u.summary()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn email_and_name_validation() {
        assert_eq!(normalize_email("  An.Nguyen@Example.COM ").unwrap(), "an.nguyen@example.com");
        for bad in ["", "a", "a@b", "a @b.vn", "@b.vn", "a@.vn", "a@vn."] {
            assert!(normalize_email(bad).is_err(), "{bad}");
        }
        assert_eq!(clean_name("  Nguyễn   Văn ", "Họ").unwrap(), "Nguyễn Văn");
        assert!(clean_name("   ", "Tên").is_err());
        assert_eq!(clean_employee_code(Some(" nv-001 ")).unwrap().as_deref(), Some("NV-001"));
        assert_eq!(clean_employee_code(Some("")).unwrap(), None);
        assert!(clean_employee_code(Some("có dấu")).is_err());
        assert!(check_password("1234567").is_err() && check_password("12345678").is_ok());
        assert_eq!(regex_escape("a.b*(c)"), "a\\.b\\*\\(c\\)");
    }
}
