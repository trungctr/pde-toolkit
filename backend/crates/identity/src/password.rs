//! Băm mật khẩu bằng Argon2id (tham số mặc định của crate: m=19 MiB, t=2, p=1 – theo khuyến nghị OWASP).
//! Việc băm tốn CPU nên chạy trên luồng blocking để không chặn runtime.

use argon2::password_hash::phc::PasswordHash;
use argon2::password_hash::{PasswordHasher, PasswordVerifier};
use argon2::Argon2;
use chillcat_kernel::{AppError, AppResult};
use sha2::{Digest, Sha256};

pub async fn hash(password: &str) -> AppResult<String> {
    let pw = password.to_owned();
    tokio::task::spawn_blocking(move || {
        Argon2::default()
            .hash_password(pw.as_bytes())
            .map(|h| h.to_string())
            .map_err(|e| AppError::internal(format!("Không băm được mật khẩu: {e}")))
    })
    .await?
}

pub async fn verify(password: &str, phc: &str) -> AppResult<bool> {
    let (pw, phc) = (password.to_owned(), phc.to_owned());
    tokio::task::spawn_blocking(move || {
        let Ok(parsed) = PasswordHash::new(&phc) else { return Ok(false) };
        Ok(Argon2::default().verify_password(pw.as_bytes(), &parsed).is_ok())
    })
    .await?
}

/// So với một giá trị băm thật khi e-mail không tồn tại – thời gian phản hồi như nhau, không lộ tài khoản nào có thật.
pub async fn dummy_verify(password: &str) {
    static DUMMY: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    let phc = match DUMMY.get() {
        Some(h) => h.clone(),
        None => match hash(&random_secret()).await {
            Ok(h) => DUMMY.get_or_init(|| h).clone(),
            Err(_) => return,
        },
    };
    let _ = verify(password, &phc).await;
}

/// Bí mật ngẫu nhiên 256 bit (2 UUID v4, dạng hex).
pub fn random_secret() -> String {
    format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple())
}

pub fn sha256_hex(s: &str) -> String {
    Sha256::digest(s.as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn hash_and_verify_roundtrip() {
        let h = hash("mật-khẩu-đủ-dài").await.unwrap();
        assert!(h.starts_with("$argon2id$"));
        assert!(verify("mật-khẩu-đủ-dài", &h).await.unwrap());
        assert!(!verify("sai", &h).await.unwrap());
        assert!(!verify("x", "không-phải-phc").await.unwrap());
    }

    #[test]
    fn secrets_are_random_and_hashes_stable() {
        assert_ne!(random_secret(), random_secret());
        assert_eq!(random_secret().len(), 64);
        assert_eq!(sha256_hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }
}
