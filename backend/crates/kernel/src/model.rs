//! Các kiểu liệt kê dùng ở nhiều module. Giá trị chuỗi khớp cột ERD ở desc §8.

use serde::{Deserialize, Serialize};

/// Phạm vi của một membership / lời mời / quyền ticket.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScopeType {
    Workspace,
    Group,
}

impl ScopeType {
    pub fn as_str(self) -> &'static str {
        match self {
            ScopeType::Workspace => "workspace",
            ScopeType::Group => "group",
        }
    }
}

/// Mức bảo mật của tài liệu (§6). Thứ tự khai báo = từ hẹp đến rộng, nên so sánh `<` nghĩa là "hẹp hơn".
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Security {
    Private,
    Group,
    Workspace,
    Public,
}

impl Security {
    pub fn as_str(self) -> &'static str {
        match self {
            Security::Private => "private",
            Security::Group => "group",
            Security::Workspace => "workspace",
            Security::Public => "public",
        }
    }
    pub fn label_vi(self) -> &'static str {
        match self {
            Security::Private => "Riêng tư",
            Security::Group => "Group",
            Security::Workspace => "Workspace",
            Security::Public => "Công khai",
        }
    }
}

/// Trạng thái của một phiên bản tài liệu (§5.1).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VersionStatus {
    Draft,
    Pending,
    Approved,
    Published,
    Superseded,
}

impl VersionStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            VersionStatus::Draft => "draft",
            VersionStatus::Pending => "pending",
            VersionStatus::Approved => "approved",
            VersionStatus::Published => "published",
            VersionStatus::Superseded => "superseded",
        }
    }
    pub fn label_vi(self) -> &'static str {
        match self {
            VersionStatus::Draft => "Dự thảo",
            VersionStatus::Pending => "Chờ duyệt",
            VersionStatus::Approved => "Đã duyệt",
            VersionStatus::Published => "Đã phát hành",
            VersionStatus::Superseded => "Thay thế",
        }
    }
    /// Bản đang trong vòng soạn – duyệt (mỗi tài liệu có nhiều nhất một bản như vậy).
    pub fn is_working(self) -> bool {
        matches!(self, VersionStatus::Draft | VersionStatus::Pending | VersionStatus::Approved)
    }
    /// Bản đã phát hành (đang hiệu lực hoặc đã bị thay thế) – xem theo mức bảo mật (§6).
    pub fn is_released(self) -> bool {
        matches!(self, VersionStatus::Published | VersionStatus::Superseded)
    }
}

/// Số bản của một loại tài liệu trong một workspace (§7.1).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Cardinality {
    /// Một bản cho cả workspace.
    Workspace,
    /// Một bản cho mỗi hệ thống con (`HTC`).
    Subsystem,
    /// Một bản cho mỗi quy trình cấp 1 (`NN`).
    Process,
}

/// Mức của một kết quả kiểm tra (§7.4).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IssueLevel {
    Info,
    /// Cảnh báo: phải xác nhận mới đi tiếp.
    Warning,
    /// Chặn: không cho thực hiện.
    Error,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn security_orders_from_narrow_to_wide() {
        assert!(Security::Private < Security::Group);
        assert!(Security::Group < Security::Workspace);
        assert!(Security::Workspace < Security::Public);
    }

    #[test]
    fn enums_use_the_erd_spelling() {
        assert_eq!(serde_json::to_string(&VersionStatus::Superseded).unwrap(), "\"superseded\"");
        assert_eq!(serde_json::to_string(&ScopeType::Group).unwrap(), "\"group\"");
        assert_eq!(serde_json::to_string(&Security::Public).unwrap(), "\"public\"");
        assert!(VersionStatus::Approved.is_working() && !VersionStatus::Published.is_working());
        assert!(VersionStatus::Superseded.is_released());
    }
}
