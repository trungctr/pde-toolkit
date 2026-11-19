//! Quyền tài liệu và quyền người dùng (desc §4).
//!
//! Quyền được lưu theo từng `membership` (một người trong một phạm vi). Các hàm ở đây là thuần tuý:
//! tính bao đóng "kéo theo" (§4.2), hợp, giao và kiểm tra "không cấp quyền lớn hơn quyền mình có" (§3).

use serde::{Deserialize, Serialize};

/// Một quyền tài liệu (§4.2).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DocPerm {
    View,
    Comment,
    Create,
    Edit,
    Submit,
    Approve,
    Publish,
}

impl DocPerm {
    pub const ALL: [DocPerm; 7] =
        [DocPerm::View, DocPerm::Comment, DocPerm::Create, DocPerm::Edit, DocPerm::Submit, DocPerm::Approve, DocPerm::Publish];
}

/// Tập quyền tài liệu của một người trong một phạm vi.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct DocPerms {
    pub view: bool,
    pub comment: bool,
    pub create: bool,
    pub edit: bool,
    pub submit: bool,
    pub approve: bool,
    pub publish: bool,
}

impl DocPerms {
    pub const NONE: DocPerms =
        DocPerms { view: false, comment: false, create: false, edit: false, submit: false, approve: false, publish: false };
    pub const ALL: DocPerms = DocPerms { view: true, comment: true, create: true, edit: true, submit: true, approve: true, publish: true };

    /// Quyền mặc định của thành viên mới (§4.3, đề xuất): xem, nhận xét, tạo, sửa, gửi duyệt.
    pub const DEFAULT_MEMBER: DocPerms =
        DocPerms { view: true, comment: true, create: true, edit: true, submit: true, approve: false, publish: false };

    /// Quyền tài liệu mặc nhiên của workspace owner: xem và nhận xét ở mọi nơi (§4.3, §9.1).
    pub const WORKSPACE_OWNER: DocPerms =
        DocPerms { view: true, comment: true, create: false, edit: false, submit: false, approve: false, publish: false };

    pub fn has(&self, p: DocPerm) -> bool {
        match p {
            DocPerm::View => self.view,
            DocPerm::Comment => self.comment,
            DocPerm::Create => self.create,
            DocPerm::Edit => self.edit,
            DocPerm::Submit => self.submit,
            DocPerm::Approve => self.approve,
            DocPerm::Publish => self.publish,
        }
    }

    pub fn set(&mut self, p: DocPerm, on: bool) {
        match p {
            DocPerm::View => self.view = on,
            DocPerm::Comment => self.comment = on,
            DocPerm::Create => self.create = on,
            DocPerm::Edit => self.edit = on,
            DocPerm::Submit => self.submit = on,
            DocPerm::Approve => self.approve = on,
            DocPerm::Publish => self.publish = on,
        }
    }

    /// Bao đóng theo cột "Kéo theo" của §4.2:
    /// comment ⇒ view · create ⇒ view · edit ⇒ view · submit ⇒ edit · approve ⇒ view + comment · publish ⇒ view.
    pub fn closure(mut self) -> Self {
        if self.submit {
            self.edit = true;
        }
        if self.approve {
            self.comment = true;
        }
        if self.comment || self.create || self.edit || self.approve || self.publish {
            self.view = true;
        }
        self
    }

    pub fn union(self, o: DocPerms) -> Self {
        DocPerms {
            view: self.view || o.view,
            comment: self.comment || o.comment,
            create: self.create || o.create,
            edit: self.edit || o.edit,
            submit: self.submit || o.submit,
            approve: self.approve || o.approve,
            publish: self.publish || o.publish,
        }
    }

    pub fn intersect(self, o: DocPerms) -> Self {
        DocPerms {
            view: self.view && o.view,
            comment: self.comment && o.comment,
            create: self.create && o.create,
            edit: self.edit && o.edit,
            submit: self.submit && o.submit,
            approve: self.approve && o.approve,
            publish: self.publish && o.publish,
        }
    }

    /// `self` không vượt quá `o` (sau khi lấy bao đóng cả hai) – dùng cho quy tắc
    /// "không ai cấp được quyền lớn hơn quyền mình đang có".
    pub fn is_subset_of(self, o: DocPerms) -> bool {
        let (a, b) = (self.closure(), o.closure());
        DocPerm::ALL.iter().all(|p| !a.has(*p) || b.has(*p))
    }

    pub fn is_empty(self) -> bool {
        self == DocPerms::NONE
    }

    /// Các quyền có trong `self` mà `o` không có (để báo lỗi rõ ràng).
    pub fn missing_from(self, o: DocPerms) -> Vec<DocPerm> {
        let (a, b) = (self.closure(), o.closure());
        DocPerm::ALL.iter().copied().filter(|p| a.has(*p) && !b.has(*p)).collect()
    }
}

/// Một quyền người dùng – quản lý thành viên (§4.1).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UserPerm {
    AssignOwner,
    RemoveOwner,
    Invite,
    Kick,
    ManagePerms,
}

impl UserPerm {
    pub const ALL: [UserPerm; 5] = [UserPerm::AssignOwner, UserPerm::RemoveOwner, UserPerm::Invite, UserPerm::Kick, UserPerm::ManagePerms];
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct UserPerms {
    pub assign_owner: bool,
    pub remove_owner: bool,
    pub invite: bool,
    pub kick: bool,
    pub manage_perms: bool,
}

impl UserPerms {
    pub const NONE: UserPerms = UserPerms { assign_owner: false, remove_owner: false, invite: false, kick: false, manage_perms: false };
    /// Workspace owner: tất cả, trong cả workspace (§4.3).
    pub const WORKSPACE_OWNER: UserPerms =
        UserPerms { assign_owner: true, remove_owner: true, invite: true, kick: true, manage_perms: true };
    /// Group owner: mời, loại, điều chỉnh quyền trong group (§4.3).
    pub const GROUP_OWNER: UserPerms = UserPerms { assign_owner: false, remove_owner: false, invite: true, kick: true, manage_perms: true };

    pub fn has(&self, p: UserPerm) -> bool {
        match p {
            UserPerm::AssignOwner => self.assign_owner,
            UserPerm::RemoveOwner => self.remove_owner,
            UserPerm::Invite => self.invite,
            UserPerm::Kick => self.kick,
            UserPerm::ManagePerms => self.manage_perms,
        }
    }

    pub fn union(self, o: UserPerms) -> Self {
        UserPerms {
            assign_owner: self.assign_owner || o.assign_owner,
            remove_owner: self.remove_owner || o.remove_owner,
            invite: self.invite || o.invite,
            kick: self.kick || o.kick,
            manage_perms: self.manage_perms || o.manage_perms,
        }
    }

    pub fn is_subset_of(self, o: UserPerms) -> bool {
        UserPerm::ALL.iter().all(|p| !self.has(*p) || o.has(*p))
    }

    pub fn is_empty(self) -> bool {
        self == UserPerms::NONE
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn closure_follows_the_implication_column() {
        let p = DocPerms { submit: true, ..DocPerms::NONE }.closure();
        assert!(p.edit && p.view, "submit ⇒ edit ⇒ view");
        assert!(!p.comment && !p.approve && !p.publish && !p.create);

        let p = DocPerms { approve: true, ..DocPerms::NONE }.closure();
        assert!(p.view && p.comment, "approve ⇒ view + comment");
        assert!(!p.edit);

        let p = DocPerms { publish: true, ..DocPerms::NONE }.closure();
        assert!(p.view && !p.comment, "publish ⇒ view, không kéo theo comment");

        assert_eq!(DocPerms::NONE.closure(), DocPerms::NONE);
        assert_eq!(DocPerms::ALL.closure(), DocPerms::ALL);
    }

    #[test]
    fn nobody_grants_more_than_they_hold() {
        let ws_owner = DocPerms::WORKSPACE_OWNER;
        assert!(!DocPerms::DEFAULT_MEMBER.is_subset_of(ws_owner), "workspace owner chỉ có xem + nhận xét");
        assert_eq!(DocPerms::DEFAULT_MEMBER.missing_from(ws_owner), vec![DocPerm::Create, DocPerm::Edit, DocPerm::Submit]);
        assert!(DocPerms::DEFAULT_MEMBER.is_subset_of(DocPerms::ALL));
        // so sánh trên bao đóng: {submit} ⊆ {edit, submit}
        let a = DocPerms { submit: true, ..DocPerms::NONE };
        let b = DocPerms { submit: true, edit: true, view: true, ..DocPerms::NONE };
        assert!(a.is_subset_of(b));
    }

    #[test]
    fn perms_deserialize_with_missing_fields_as_false() {
        let p: DocPerms = serde_json::from_str(r#"{"view":true}"#).unwrap();
        assert!(p.view && !p.edit);
        let u: UserPerms = serde_json::from_str("{}").unwrap();
        assert!(u.is_empty());
        assert!(UserPerms::GROUP_OWNER.is_subset_of(UserPerms::WORKSPACE_OWNER));
        assert!(!UserPerms::WORKSPACE_OWNER.is_subset_of(UserPerms::GROUP_OWNER));
    }
}
