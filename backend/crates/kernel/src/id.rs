//! Mã định danh có kiểu.
//!
//! Mọi `_id` là UUID v7 dạng chuỗi: sắp được theo thời gian tạo, không lộ số lượng bản ghi, và di chuyển
//! giữa các dịch vụ / cơ sở dữ liệu mà không phụ thuộc `ObjectId` của một cụm MongoDB cụ thể.
//! Mỗi loại thực thể có một kiểu riêng để trình biên dịch chặn việc truyền nhầm mã.

use serde::{Deserialize, Serialize};
use std::fmt;

macro_rules! define_id {
    ($(#[$meta:meta])* $name:ident) => {
        $(#[$meta])*
        #[derive(Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(String);

        impl $name {
            /// Sinh mã mới (UUID v7).
            #[allow(clippy::new_without_default)]
            pub fn new() -> Self {
                Self(uuid::Uuid::now_v7().to_string())
            }
            pub fn as_str(&self) -> &str {
                &self.0
            }
            pub fn into_string(self) -> String {
                self.0
            }
        }
        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str(&self.0)
            }
        }
        impl fmt::Debug for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}({})", stringify!($name), self.0)
            }
        }
        impl From<String> for $name {
            fn from(s: String) -> Self {
                Self(s)
            }
        }
        impl From<&str> for $name {
            fn from(s: &str) -> Self {
                Self(s.to_owned())
            }
        }
        impl From<$name> for String {
            fn from(id: $name) -> String {
                id.0
            }
        }
        impl AsRef<str> for $name {
            fn as_ref(&self) -> &str {
                &self.0
            }
        }
        // Dùng trực tiếp trong `doc! { "_id": &id }` (bson tự suy ra `From<&T>` từ `From<T>`).
        impl From<$name> for bson::Bson {
            fn from(id: $name) -> bson::Bson {
                bson::Bson::String(id.0)
            }
        }
    };
}

define_id!(UserId);
define_id!(SessionId);
define_id!(WorkspaceId);
define_id!(GroupId);
define_id!(SubsystemId);
define_id!(MembershipId);
define_id!(InvitationId);
define_id!(DocumentId);
define_id!(VersionId);
define_id!(ReviewId);
define_id!(CommentId);
define_id!(LinkId);
define_id!(TraceElementId);
define_id!(TraceRefId);
define_id!(ReviewFlagId);
define_id!(TicketId);
define_id!(TicketGrantId);
define_id!(TicketDelegationId);
define_id!(AiDelegationId);
define_id!(AiCheckId);
define_id!(DuplicateCandidateId);
define_id!(ProposalId);
define_id!(NotificationId);
define_id!(AuditLogId);
define_id!(EventId);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_time_ordered_and_roundtrip_as_plain_strings() {
        let a = UserId::new();
        std::thread::sleep(std::time::Duration::from_millis(2));
        let b = UserId::new();
        assert!(a < b, "UUID v7 phải tăng theo thời gian");
        let json = serde_json::to_string(&a).unwrap();
        assert_eq!(json, format!("\"{}\"", a.as_str()));
        let back: UserId = serde_json::from_str(&json).unwrap();
        assert_eq!(a, back);
        assert_eq!(bson::Bson::from(&a), bson::Bson::String(a.as_str().to_owned()));
    }
}
