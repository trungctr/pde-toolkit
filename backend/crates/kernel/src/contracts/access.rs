use crate::error::AppResult;
use crate::id::{GroupId, SubsystemId, UserId, WorkspaceId};
use crate::perms::{DocPerm, DocPerms, UserPerms};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub id: WorkspaceId,
    /// Mã dự án `PRJ` – tiền tố của mọi mã tài liệu.
    pub code: String,
    pub name: String,
    pub owner_id: UserId,
    /// Workspace có cho phép mức bảo mật Công khai hay không (§6).
    pub allow_public: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct GroupInfo {
    pub id: GroupId,
    pub workspace_id: WorkspaceId,
    pub name: String,
    /// Mỗi group có đúng một owner (§3).
    pub owner_id: UserId,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SubsystemInfo {
    pub id: SubsystemId,
    pub workspace_id: WorkspaceId,
    /// Mã hệ thống con `HTC` (2–5 chữ in hoa), ví dụ `ORD`.
    pub code: String,
    pub name: String,
}

/// Quyền của một người trong một phạm vi (một dòng `memberships`), đã lấy bao đóng.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScopeGrant {
    pub is_owner: bool,
    pub doc_perms: DocPerms,
    pub user_perms: UserPerms,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct GroupAccess {
    pub group_id: GroupId,
    pub grant: ScopeGrant,
}

/// Toàn bộ quyền của một người trong một workspace – đầu vào cho mọi phép kiểm tra quyền (§9).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkspaceAccess {
    pub workspace: WorkspaceInfo,
    pub user_id: UserId,
    /// Membership ở phạm vi workspace (`None` nếu chỉ là thành viên của group, hoặc không là thành viên).
    pub workspace_grant: Option<ScopeGrant>,
    /// Membership ở từng group mà người này thuộc về.
    pub groups: Vec<GroupAccess>,
}

impl WorkspaceAccess {
    pub fn is_workspace_owner(&self) -> bool {
        self.workspace.owner_id == self.user_id
    }

    /// Là thành viên của workspace theo nghĩa rộng: có membership ở workspace hoặc ở ít nhất một group.
    pub fn is_member(&self) -> bool {
        self.is_workspace_owner() || self.workspace_grant.is_some() || !self.groups.is_empty()
    }

    pub fn group(&self, group_id: &GroupId) -> Option<&ScopeGrant> {
        self.groups.iter().find(|g| &g.group_id == group_id).map(|g| &g.grant)
    }

    pub fn is_group_member(&self, group_id: &GroupId) -> bool {
        self.group(group_id).is_some()
    }

    pub fn is_group_owner(&self, group_id: &GroupId) -> bool {
        self.group(group_id).is_some_and(|g| g.is_owner)
    }

    pub fn group_ids(&self) -> Vec<GroupId> {
        self.groups.iter().map(|g| g.group_id.clone()).collect()
    }

    /// Quyền tài liệu hiệu lực đối với tài liệu thuộc `group_id` (§9.1–9.2):
    /// hợp của quyền ở phạm vi workspace và ở group đó, lấy bao đóng;
    /// group owner có mọi quyền trong group; workspace owner luôn có ít nhất xem + nhận xét.
    pub fn doc_perms_in(&self, group_id: &GroupId) -> DocPerms {
        if self.is_group_owner(group_id) {
            return DocPerms::ALL;
        }
        let mut p = DocPerms::NONE;
        if let Some(g) = &self.workspace_grant {
            p = p.union(g.doc_perms);
        }
        if let Some(g) = self.group(group_id) {
            p = p.union(g.doc_perms);
        }
        if self.is_workspace_owner() {
            p = p.union(DocPerms::WORKSPACE_OWNER);
        }
        p.closure()
    }

    /// Có quyền `perm` ở bất kỳ phạm vi nào trong workspace (dùng cho bản phát hành mức Workspace, §6).
    pub fn has_doc_perm_anywhere(&self, perm: DocPerm) -> bool {
        if self.is_workspace_owner() && DocPerms::WORKSPACE_OWNER.has(perm) {
            return true;
        }
        self.workspace_grant.is_some_and(|g| g.doc_perms.closure().has(perm))
            || self.groups.iter().any(|g| g.grant.is_owner || g.grant.doc_perms.closure().has(perm))
    }

    /// Quyền người dùng ở phạm vi workspace (workspace owner: tất cả).
    pub fn user_perms_in_workspace(&self) -> UserPerms {
        if self.is_workspace_owner() {
            return UserPerms::WORKSPACE_OWNER;
        }
        self.workspace_grant.map(|g| g.user_perms).unwrap_or(UserPerms::NONE)
    }

    /// Quyền người dùng trong một group: hợp của quyền ở workspace và ở group (group owner: mời, loại, phân quyền).
    pub fn user_perms_in_group(&self, group_id: &GroupId) -> UserPerms {
        let mut p = self.user_perms_in_workspace();
        if let Some(g) = self.group(group_id) {
            p = p.union(g.user_perms);
            if g.is_owner {
                p = p.union(UserPerms::GROUP_OWNER);
            }
        }
        p
    }
}

#[async_trait::async_trait]
pub trait AccessApi: Send + Sync {
    async fn workspace(&self, id: &WorkspaceId) -> AppResult<Option<WorkspaceInfo>>;
    /// Quyền của `user` trong workspace. `None` nếu workspace không tồn tại. Người không phải thành viên
    /// vẫn nhận được một [`WorkspaceAccess`] rỗng (để mở ticket – §4.4).
    async fn workspace_access(&self, user: &UserId, workspace: &WorkspaceId) -> AppResult<Option<WorkspaceAccess>>;
    async fn group(&self, id: &GroupId) -> AppResult<Option<GroupInfo>>;
    async fn groups(&self, workspace: &WorkspaceId) -> AppResult<Vec<GroupInfo>>;
    async fn subsystem(&self, id: &SubsystemId) -> AppResult<Option<SubsystemInfo>>;
    async fn subsystems(&self, workspace: &WorkspaceId) -> AppResult<Vec<SubsystemInfo>>;
    /// Mọi thành viên của group (kể cả owner).
    async fn group_member_ids(&self, group: &GroupId) -> AppResult<Vec<UserId>>;
    /// Những người có quyền tài liệu `perm` đối với tài liệu của `group` (tính như [`WorkspaceAccess::doc_perms_in`]).
    /// Dùng để chọn người nhận thông báo (ví dụ ai được xem xét bản chờ duyệt).
    async fn users_with_doc_perm(&self, workspace: &WorkspaceId, group: &GroupId, perm: DocPerm) -> AppResult<Vec<UserId>>;
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ws(owner: &UserId) -> WorkspaceInfo {
        WorkspaceInfo { id: WorkspaceId::new(), code: "SHOP".into(), name: "Shop".into(), owner_id: owner.clone(), allow_public: true }
    }

    #[test]
    fn workspace_owner_only_views_and_comments_by_default() {
        let owner = UserId::new();
        let g = GroupId::new();
        let a = WorkspaceAccess {
            workspace: ws(&owner),
            user_id: owner.clone(),
            workspace_grant: Some(ScopeGrant {
                is_owner: true,
                doc_perms: DocPerms::WORKSPACE_OWNER,
                user_perms: UserPerms::WORKSPACE_OWNER,
            }),
            groups: vec![],
        };
        let p = a.doc_perms_in(&g);
        assert!(p.view && p.comment);
        assert!(!p.edit && !p.approve && !p.publish && !p.create);
        assert!(a.user_perms_in_group(&g).assign_owner);
        assert!(a.is_member());
    }

    #[test]
    fn group_owner_has_everything_in_own_group_only() {
        let owner = UserId::new();
        let me = UserId::new();
        let (mine, other) = (GroupId::new(), GroupId::new());
        let a = WorkspaceAccess {
            workspace: ws(&owner),
            user_id: me,
            workspace_grant: None,
            groups: vec![GroupAccess {
                group_id: mine.clone(),
                grant: ScopeGrant { is_owner: true, doc_perms: DocPerms::ALL, user_perms: UserPerms::GROUP_OWNER },
            }],
        };
        assert_eq!(a.doc_perms_in(&mine), DocPerms::ALL);
        assert_eq!(a.doc_perms_in(&other), DocPerms::NONE);
        assert!(a.user_perms_in_group(&mine).kick && !a.user_perms_in_group(&mine).assign_owner);
        assert!(a.user_perms_in_group(&other).is_empty());
        assert!(a.has_doc_perm_anywhere(DocPerm::View));
    }

    #[test]
    fn workspace_and_group_grants_are_unioned_then_closed() {
        let owner = UserId::new();
        let g = GroupId::new();
        let a = WorkspaceAccess {
            workspace: ws(&owner),
            user_id: UserId::new(),
            workspace_grant: Some(ScopeGrant {
                is_owner: false,
                doc_perms: DocPerms { view: true, ..DocPerms::NONE },
                user_perms: UserPerms::NONE,
            }),
            groups: vec![GroupAccess {
                group_id: g.clone(),
                grant: ScopeGrant {
                    is_owner: false,
                    doc_perms: DocPerms { submit: true, ..DocPerms::NONE },
                    user_perms: UserPerms { invite: true, ..UserPerms::NONE },
                },
            }],
        };
        let p = a.doc_perms_in(&g);
        assert!(p.view && p.edit && p.submit && !p.comment);
        // ở group khác chỉ còn quyền cấp workspace
        let p = a.doc_perms_in(&GroupId::new());
        assert!(p.view && !p.edit);
        assert!(a.user_perms_in_group(&g).invite);
        assert!(!a.is_workspace_owner());
    }

    #[test]
    fn outsider_has_nothing() {
        let a = WorkspaceAccess { workspace: ws(&UserId::new()), user_id: UserId::new(), workspace_grant: None, groups: vec![] };
        assert!(!a.is_member());
        assert_eq!(a.doc_perms_in(&GroupId::new()), DocPerms::NONE);
        assert!(!a.has_doc_perm_anywhere(DocPerm::View));
    }
}
