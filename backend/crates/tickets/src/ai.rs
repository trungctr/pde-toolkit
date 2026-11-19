//! AI cho ticket: kiểm tra trùng và đề xuất sửa tài liệu.
//!
//! - [`ClaudeClient`]: gọi Messages API của Claude trực tiếp qua HTTP (Rust chưa có SDK chính thức). Kết quả ép về
//!   JSON theo schema (`output_config.format`), xử lý `stop_reason` `refusal` / `max_tokens`, thử lại khi 429 / 5xx / 529.
//!   Mặc định bật `fallbacks: "default"`: yêu cầu bị bộ lọc an toàn từ chối được chạy lại trên model dự phòng.
//! - [`keyword`]: so khớp từ khoá khi chưa cấu hình AI (`AI_PROVIDER=none`).
//!
//! Dữ liệu gửi đi chỉ gồm những gì người mà AI thay mặt được xem (desc §5.4, §9.7) – nơi gọi chịu trách nhiệm lọc.

use chillcat_kernel::{AppError, AppResult};
use chillcat_platform::config::{AiProvider, AiSettings};
use serde_json::{json, Value};
use std::time::Duration;

const API_VERSION: &str = "2026-10-21";
const FALLBACK_BETA: &str = "server-side-fallback-2026-07-01";
const MAX_ATTEMPTS: u32 = 4;

#[derive(Clone)]
pub struct ClaudeClient {
    http: reqwest::Client,
    settings: AiSettings,
}

impl ClaudeClient {
    /// `None` khi chưa cấu hình AI.
    pub fn from_settings(settings: &AiSettings) -> AppResult<Option<Self>> {
        if settings.provider == AiProvider::None {
            return Ok(None);
        }
        // reqwest được build với `rustls-no-provider`: dùng ring như driver MongoDB.
        let _ = rustls::crypto::ring::default_provider().install_default();
        let http = reqwest::Client::builder()
            .timeout(settings.timeout)
            .connect_timeout(Duration::from_secs(15))
            .user_agent("chillcat-studio-backend")
            .build()
            .map_err(|e| AppError::internal(format!("Không khởi tạo được HTTP client cho AI: {e}")))?;
        Ok(Some(ClaudeClient { http, settings: settings.clone() }))
    }

    pub fn model(&self) -> &str {
        &self.settings.model
    }

    /// Một lượt hỏi – trả về đối tượng JSON khớp `schema`.
    pub async fn json(&self, system: &str, prompt: &str, schema: Value, effort: &str) -> AppResult<Value> {
        let mut body = json!({
            "model": self.settings.model,
            "max_tokens": 16000,
            "system": system,
            "messages": [{ "role": "user", "content": prompt }],
            "output_config": { "effort": effort, "format": { "type": "json_schema", "schema": schema } },
        });
        if self.settings.fallbacks {
            body["fallbacks"] = json!("default");
        }
        let url = format!("{}/v1/messages", self.settings.base_url);
        let mut attempt = 0;
        loop {
            attempt += 1;
            let mut req = self
                .http
                .post(&url)
                .header("x-api-key", self.settings.api_key.as_deref().unwrap_or_default())
                .header("anthropic-version", API_VERSION)
                .json(&body);
            if self.settings.fallbacks {
                req = req.header("anthropic-beta", FALLBACK_BETA);
            }
            let res = match req.send().await {
                Ok(r) => r,
                Err(e) if attempt < MAX_ATTEMPTS && (e.is_timeout() || e.is_connect() || e.is_request()) => {
                    tokio::time::sleep(backoff(attempt, None)).await;
                    continue;
                }
                Err(e) => return Err(AppError::unavailable("ai.unreachable", "Không gọi được dịch vụ AI").with_source(e)),
            };
            let status = res.status().as_u16();
            let retry_after = res.headers().get("retry-after").and_then(|v| v.to_str().ok()).and_then(|v| v.parse::<u64>().ok());
            let text = res.text().await.unwrap_or_default();
            if matches!(status, 429 | 500 | 502 | 503 | 504 | 529) && attempt < MAX_ATTEMPTS {
                tracing::warn!(status, attempt, "Dịch vụ AI bận / lỗi tạm thời – thử lại");
                tokio::time::sleep(backoff(attempt, retry_after)).await;
                continue;
            }
            if !(200..300).contains(&status) {
                let detail = serde_json::from_str::<Value>(&text)
                    .ok()
                    .and_then(|v| v["error"]["message"].as_str().map(str::to_owned))
                    .unwrap_or_else(|| text.chars().take(300).collect());
                return Err(AppError::unavailable("ai.error", format!("Dịch vụ AI trả lỗi {status}: {detail}")));
            }
            let msg: Value = serde_json::from_str(&text)
                .map_err(|e| AppError::unavailable("ai.bad_response", "Phản hồi AI không đọc được").with_source(e))?;
            return parse_message(&msg);
        }
    }
}

fn backoff(attempt: u32, retry_after: Option<u64>) -> Duration {
    match retry_after {
        Some(s) => Duration::from_secs(s.min(60)),
        None => Duration::from_millis(1000 * 2u64.pow(attempt.min(5))),
    }
}

/// Đọc kết quả: kiểm tra `stop_reason` trước khi đọc nội dung; lấy khối `text` (bỏ khối `thinking`, `fallback`).
pub fn parse_message(msg: &Value) -> AppResult<Value> {
    match msg["stop_reason"].as_str() {
        Some("refusal") => {
            return Err(AppError::unprocessable("ai.refused", "AI từ chối xử lý yêu cầu này (bộ lọc an toàn) – xử lý thủ công"))
        }
        Some("max_tokens") => return Err(AppError::unavailable("ai.truncated", "Phản hồi AI bị cắt ngang – thử lại")),
        _ => {}
    }
    let text: String = msg["content"]
        .as_array()
        .map(|blocks| blocks.iter().filter(|b| b["type"] == "text").filter_map(|b| b["text"].as_str()).collect())
        .unwrap_or_default();
    serde_json::from_str(text.trim()).map_err(|e| AppError::unavailable("ai.bad_json", "AI trả về JSON không hợp lệ").with_source(e))
}

/// So khớp từ khoá (không dùng AI).
pub mod keyword {
    use std::collections::HashSet;

    const STOP: &[&str] = &[
        "va", "cua", "cho", "khi", "khong", "duoc", "cac", "mot", "nhung", "trong", "voi", "la", "co", "de", "thi", "nay", "da", "bi", "o",
        "ra", "vao", "lai", "nguoi", "dung", "the", "and", "of", "to", "in", "is", "a", "an", "the", "for", "on", "it", "toi", "ban",
        "can", "muon", "nen", "se", "van", "phai", "hay", "neu", "cung", "theo", "tu", "den", "ve",
    ];

    /// Bỏ dấu tiếng Việt, chữ thường.
    pub fn fold(s: &str) -> String {
        const MAP: &[(&str, char)] = &[
            ("àáạảãâầấậẩẫăằắặẳẵ", 'a'),
            ("èéẹẻẽêềếệểễ", 'e'),
            ("ìíịỉĩ", 'i'),
            ("òóọỏõôồốộổỗơờớợởỡ", 'o'),
            ("ùúụủũưừứựửữ", 'u'),
            ("ỳýỵỷỹ", 'y'),
            ("đ", 'd'),
        ];
        s.to_lowercase().chars().map(|c| MAP.iter().find(|(set, _)| set.contains(c)).map(|(_, b)| *b).unwrap_or(c)).collect()
    }

    pub fn tokens(s: &str) -> HashSet<String> {
        fold(s).split(|c: char| !c.is_ascii_alphanumeric()).filter(|t| t.len() >= 2 && !STOP.contains(t)).map(str::to_owned).collect()
    }

    fn jaccard(a: &HashSet<String>, b: &HashSet<String>) -> f64 {
        if a.is_empty() || b.is_empty() {
            return 0.0;
        }
        a.intersection(b).count() as f64 / a.union(b).count() as f64
    }

    /// Độ giống nhau 0..1 giữa hai ticket (tiêu đề nặng hơn nội dung).
    pub fn similarity(a_title: &str, a_body: &str, b_title: &str, b_body: &str) -> f64 {
        let (at, bt) = (tokens(a_title), tokens(b_title));
        let all_a: HashSet<String> = at.union(&tokens(a_body)).cloned().collect();
        let all_b: HashSet<String> = bt.union(&tokens(b_body)).cloned().collect();
        0.6 * jaccard(&at, &bt) + 0.4 * jaccard(&all_a, &all_b)
    }

    /// Các từ chung (để ghi lý do).
    pub fn shared_words(a: &str, b: &str, n: usize) -> Vec<String> {
        let mut v: Vec<String> = tokens(a).intersection(&tokens(b)).cloned().collect();
        v.sort_by_key(|w| std::cmp::Reverse(w.len()));
        v.truncate(n);
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refusal_and_truncation_are_errors_and_text_is_parsed_as_json() {
        let ok = json!({ "stop_reason": "end_turn", "content": [
            { "type": "thinking", "thinking": "" },
            { "type": "text", "text": "{\"duplicates\": []}" }
        ]});
        assert_eq!(parse_message(&ok).unwrap(), json!({ "duplicates": [] }));
        let refused = json!({ "stop_reason": "refusal", "content": [] });
        assert_eq!(parse_message(&refused).unwrap_err().code, "ai.refused");
        let cut = json!({ "stop_reason": "max_tokens", "content": [{ "type": "text", "text": "{\"dup" }] });
        assert_eq!(parse_message(&cut).unwrap_err().code, "ai.truncated");
    }

    #[test]
    fn keyword_similarity_ignores_accents_and_stop_words() {
        let s = keyword::similarity(
            "Không xuất được hoá đơn PDF",
            "Bấm nút xuất hoá đơn thì báo lỗi",
            "Lỗi khi xuất hóa đơn ra PDF",
            "Nút xuất hoá đơn không chạy",
        );
        let unrelated = keyword::similarity("Đổi màu nút đăng nhập", "", "Lỗi khi xuất hóa đơn ra PDF", "");
        assert!(s > 0.3, "{s}");
        assert!(unrelated < 0.1, "{unrelated}");
        assert_eq!(keyword::fold("Hoá Đơn"), "hoa don");
        assert!(keyword::shared_words("xuất hoá đơn PDF", "hoá đơn PDF lỗi", 3).contains(&"pdf".to_owned()));
    }
}
