//! Quy tắc cho các mã do người dùng đặt: mã dự án (`PRJ`), mã hệ thống con (`HTC`).
//!
//! Mã tài liệu và mã truy vết được dựng từ các mã này (`SHOP-SRS-ORD-001`, `FR-ORD-CART-001`), nên phải chặn:
//! - ký hiệu giữ chỗ của bộ mẫu (`PRJ`, `HTC`, `MOD`, `NN`) – nếu không, mã thật bị coi là ô chưa điền;
//! - tiền tố mã truy vết (`FR`, `UC`, `SEC`…) – nếu không, mã tài liệu bị đọc nhầm thành mã truy vết;
//! - nhãn loại tài liệu (`SRS`, `API`…).

use crate::error::{AppError, AppResult};

/// Ký hiệu giữ chỗ trong bộ mẫu.
pub const PLACEHOLDERS: &[&str] = &["PRJ", "HTC", "MOD", "NN"];

/// Tiền tố mã truy vết (CONV §3.4).
pub const TRACE_PREFIXES: &[&str] = &[
    "SH", "STR", "STC", "BP", "SYS", "A", "UC", "FR", "NFR", "BR", "ADR", "SEQ", "STM", "ACT", "AUTH", "I", "GAP", "DG", "C", "TS", "SEC",
    "RISK", "TD", "OP", "S",
];

/// Nhãn loại tài liệu dùng trong mã tài liệu.
pub const DOC_LABELS: &[&str] = &[
    "CONV", "DOCREG", "GLOSSARY", "RTM", "LOG", "BMA", "BPMN", "STRS", "SYRS", "SRS", "SAD", "SDD", "DBD", "ERD", "ICD", "API", "STP",
    "DEP", "OPS", "ASM",
];

pub fn is_reserved(code: &str) -> bool {
    let up = code.to_ascii_uppercase();
    PLACEHOLDERS.contains(&up.as_str()) || TRACE_PREFIXES.contains(&up.as_str()) || DOC_LABELS.contains(&up.as_str())
}

fn shape(code: &str, max: usize) -> bool {
    let b = code.as_bytes();
    (2..=max).contains(&b.len()) && b[0].is_ascii_uppercase() && b.iter().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
}

/// Mã dự án: chữ in hoa đầu, sau đó chữ in hoa / số, 2–10 ký tự (ví dụ `SHOP`). Tự đổi sang chữ hoa.
pub fn workspace_code(raw: &str) -> AppResult<String> {
    let code = raw.trim().to_ascii_uppercase();
    if !shape(&code, 10) {
        return Err(AppError::unprocessable(
            "workspace.invalid_code",
            "Mã dự án gồm 2–10 ký tự: chữ in hoa (A–Z) đứng đầu, sau đó chữ in hoa hoặc số – ví dụ SHOP",
        ));
    }
    if is_reserved(&code) {
        return Err(AppError::unprocessable(
            "workspace.reserved_code",
            format!("“{code}” trùng ký hiệu của bộ mẫu hoặc tiền tố mã truy vết – chọn mã khác"),
        ));
    }
    Ok(code)
}

/// Mã hệ thống con: 2–5 ký tự in hoa / số, bắt đầu bằng chữ (CONV §3.1, ví dụ `ORD`).
pub fn subsystem_code(raw: &str) -> AppResult<String> {
    let code = raw.trim().to_ascii_uppercase();
    if !shape(&code, 5) {
        return Err(AppError::unprocessable(
            "subsystem.invalid_code",
            "Mã hệ thống con gồm 2–5 ký tự: chữ in hoa (A–Z) đứng đầu, sau đó chữ in hoa hoặc số – ví dụ ORD",
        ));
    }
    if is_reserved(&code) {
        return Err(AppError::unprocessable(
            "subsystem.reserved_code",
            format!("“{code}” trùng ký hiệu của bộ mẫu hoặc tiền tố mã truy vết – chọn mã khác"),
        ));
    }
    Ok(code)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_normalised_and_reserved_words_rejected() {
        assert_eq!(workspace_code(" shop ").unwrap(), "SHOP");
        assert_eq!(subsystem_code("ord").unwrap(), "ORD");
        assert_eq!(subsystem_code("CHUNG").unwrap(), "CHUNG");
        for bad in ["S", "1AB", "AB-C", "ABCDEFGHIJK", "ĐƠN"] {
            assert!(workspace_code(bad).is_err(), "{bad}");
        }
        assert!(subsystem_code("ORDERS").is_err(), "quá 5 ký tự");
        for reserved in ["PRJ", "HTC", "MOD", "NN", "FR", "UC", "SEC", "SRS", "API", "StR"] {
            assert!(workspace_code(reserved).is_err(), "{reserved}");
        }
    }
}
