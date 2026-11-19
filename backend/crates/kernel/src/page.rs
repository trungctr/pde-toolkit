//! Phân trang kiểu con trỏ: `?limit=50&after=<con trỏ của trang trước>`.
//!
//! Danh sách sắp theo `_id` giảm dần (UUID v7 ⇒ mới nhất trước); con trỏ là `_id` của phần tử cuối trang.

use serde::{Deserialize, Serialize};

pub const DEFAULT_LIMIT: u32 = 50;
pub const MAX_LIMIT: u32 = 200;

#[derive(Clone, Debug, Default, Deserialize)]
pub struct PageQuery {
    pub limit: Option<u32>,
    pub after: Option<String>,
}

impl PageQuery {
    /// Số phần tử của một trang, đã chặn trong khoảng 1..=MAX_LIMIT.
    pub fn limit(&self) -> u32 {
        self.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT)
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct Page<T> {
    pub items: Vec<T>,
    /// `null` khi đã hết.
    pub next_cursor: Option<String>,
}

impl<T> Page<T> {
    pub fn all(items: Vec<T>) -> Self {
        Self { items, next_cursor: None }
    }

    /// Dựng trang từ kết quả đã lấy dư một phần tử (`limit + 1`): nếu dư thì còn trang sau.
    pub fn from_overfetch(mut items: Vec<T>, limit: u32, cursor_of: impl Fn(&T) -> String) -> Self {
        let limit = limit as usize;
        let more = items.len() > limit;
        items.truncate(limit);
        let next_cursor = if more { items.last().map(cursor_of) } else { None };
        Self { items, next_cursor }
    }

    pub fn map<U>(self, f: impl FnMut(T) -> U) -> Page<U> {
        Page { items: self.items.into_iter().map(f).collect(), next_cursor: self.next_cursor }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn overfetch_decides_whether_there_is_a_next_page() {
        let p = Page::from_overfetch(vec![5, 4, 3], 2, |n| n.to_string());
        assert_eq!(p.items, vec![5, 4]);
        assert_eq!(p.next_cursor.as_deref(), Some("4"));
        let p = Page::from_overfetch(vec![5, 4], 2, |n| n.to_string());
        assert_eq!(p.next_cursor, None);
        assert_eq!(PageQuery { limit: Some(100_000), after: None }.limit(), MAX_LIMIT);
        assert_eq!(PageQuery::default().limit(), DEFAULT_LIMIT);
    }
}
