//! Access token (JWT, HS256).
//!
//! Token sống ngắn (mặc định 15 phút) và tự chứa: mọi module kiểm tra tại chỗ bằng [`JwtVerifier`], không
//! phải gọi module identity. Module identity giữ [`JwtSigner`] và cấp lại token bằng refresh token.
//! Khi tách dịch vụ có thể đổi sang khoá bất đối xứng (identity ký, dịch vụ khác chỉ giữ khoá công khai)
//! mà không đổi giao diện của hai kiểu này.

use chillcat_kernel::{AppError, AppResult, Principal, SessionId, SystemRole, UserId};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::time::Duration;

const ISSUER: &str = "chillcat-studio";

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    role: SystemRole,
    sid: String,
    iss: String,
    iat: i64,
    exp: i64,
}

#[derive(Clone)]
pub struct JwtSigner {
    key: EncodingKey,
    ttl: Duration,
}

impl JwtSigner {
    pub fn new(secret: &str, ttl: Duration) -> AppResult<Self> {
        let key = EncodingKey::from_secret(secret.as_bytes()).map_err(|e| AppError::internal(format!("Khoá ký JWT không hợp lệ: {e}")))?;
        Ok(JwtSigner { key, ttl })
    }

    pub fn ttl(&self) -> Duration {
        self.ttl
    }

    /// Ký access token cho `principal`. Trả về token và số giây còn hiệu lực.
    pub fn sign(&self, principal: &Principal) -> AppResult<(String, u64)> {
        let now = chrono::Utc::now().timestamp();
        let claims = Claims {
            sub: principal.user_id.to_string(),
            role: principal.system_role,
            sid: principal.session_id.to_string(),
            iss: ISSUER.into(),
            iat: now,
            exp: now + self.ttl.as_secs() as i64,
        };
        let token = encode(&Header::new(Algorithm::HS256), &claims, &self.key)
            .map_err(|e| AppError::internal(format!("Không ký được access token: {e}")))?;
        Ok((token, self.ttl.as_secs()))
    }
}

#[derive(Clone)]
pub struct JwtVerifier {
    key: DecodingKey,
    validation: Validation,
}

impl JwtVerifier {
    pub fn new(secret: &str) -> AppResult<Self> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_issuer(&[ISSUER]);
        validation.set_required_spec_claims(&["exp", "iss", "sub"]);
        validation.leeway = 15;
        let key =
            DecodingKey::from_secret(secret.as_bytes()).map_err(|e| AppError::internal(format!("Khoá kiểm tra JWT không hợp lệ: {e}")))?;
        Ok(JwtVerifier { key, validation })
    }

    pub fn verify(&self, token: &str) -> AppResult<Principal> {
        let data = decode::<Claims>(token, &self.key, &self.validation).map_err(|e| {
            use jsonwebtoken::errors::ErrorKind as K;
            match e.kind() {
                K::ExpiredSignature => {
                    AppError::new(chillcat_kernel::ErrorKind::Unauthenticated, "auth.token_expired", "Phiên đăng nhập đã hết hạn")
                }
                _ => AppError::new(chillcat_kernel::ErrorKind::Unauthenticated, "auth.token_invalid", "Phiên đăng nhập không hợp lệ"),
            }
        })?;
        Ok(Principal {
            user_id: UserId::from(data.claims.sub),
            system_role: data.claims.role,
            session_id: SessionId::from(data.claims.sid),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "0123456789abcdef0123456789abcdef";

    fn principal() -> Principal {
        Principal { user_id: UserId::new(), system_role: SystemRole::User, session_id: SessionId::new() }
    }

    #[test]
    fn signed_token_verifies_back_to_the_same_principal() {
        let p = principal();
        let (token, ttl) = JwtSigner::new(SECRET, Duration::from_secs(900)).unwrap().sign(&p).unwrap();
        assert_eq!(ttl, 900);
        assert_eq!(JwtVerifier::new(SECRET).unwrap().verify(&token).unwrap(), p);
        assert!(JwtVerifier::new("").is_err());
    }

    #[test]
    fn wrong_secret_tampering_and_expiry_are_rejected() {
        let p = principal();
        let (token, _) = JwtSigner::new(SECRET, Duration::from_secs(900)).unwrap().sign(&p).unwrap();
        let other = JwtVerifier::new("ffffffffffffffffffffffffffffffff").unwrap();
        assert_eq!(other.verify(&token).unwrap_err().code, "auth.token_invalid");

        let verifier = JwtVerifier::new(SECRET).unwrap();
        let mut parts: Vec<String> = token.split('.').map(str::to_owned).collect();
        parts[1] = parts[1].replace(|c: char| c.is_ascii_lowercase(), "A");
        assert!(verifier.verify(&parts.join(".")).is_err());

        // hết hạn từ lâu (quá cả khoảng dung sai)
        let now = chrono::Utc::now().timestamp();
        let claims = Claims {
            sub: p.user_id.to_string(),
            role: p.system_role,
            sid: p.session_id.to_string(),
            iss: ISSUER.into(),
            iat: now - 7200,
            exp: now - 3600,
        };
        let expired = encode(&Header::new(Algorithm::HS256), &claims, &EncodingKey::from_secret(SECRET.as_bytes()).unwrap()).unwrap();
        let err = verifier.verify(&expired).unwrap_err();
        assert_eq!(err.code, "auth.token_expired");
        assert_eq!(err.kind.http_status(), 401);
    }
}
