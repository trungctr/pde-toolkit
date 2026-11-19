//! Ai được xem và làm gì (desc §5.1, §5.2, §6, §9) – hàm thuần trên dữ liệu đã nạp.
//!
//! Những chỗ đặc tả để ngỏ được hiểu theo hướng **đặc quyền tối thiểu** (xem docs/DECISIONS.md):
//! - Bản dự thảo: người được chỉ định sửa, người có quyền `view` ở phạm vi của tài liệu, workspace owner.
//! - Bản đã phát hành mức Riêng tư: người tạo, người phụ trách hiện tại, workspace owner.
//! - Quản trị hệ thống không mặc nhiên xem được tài liệu.
//! - Workspace tắt mức Công khai (`allow_public = false`): tài liệu đang để Công khai được đối xử như mức Workspace
//!   ở **mọi** đường đọc (không chỉ trang công khai) – khách không xem được, người đăng nhập cần là thành viên có `view`.

use crate::model::{Capabilities, DocumentDoc, VersionDoc};
use chillcat_kernel::contracts::{WorkspaceAccess, WorkspaceInfo};
use chillcat_kernel::{DocPerm, DocPerms, Security, UserId, VersionStatus};

/// Người xem: `user = None` = khách chưa đăng nhập (chỉ thấy bản Công khai, khi workspace cho phép).
pub struct Viewer<'a> {
    pub user: Option<&'a UserId>,
    pub access: Option<&'a WorkspaceAccess>,
    /// Workspace của tài liệu có cho phép mức Công khai không (§6). Người đăng nhập: lấy từ `access`;
    /// khách: từ thông tin workspace đã nạp – không rõ thì coi như **không** (đặc quyền tối thiểu).
    allow_public: bool,
}

impl<'a> Viewer<'a> {
    /// Người đã đăng nhập, với quyền của họ trong workspace của tài liệu (kể cả người ngoài: quyền rỗng).
    pub fn new(user: &'a UserId, access: &'a WorkspaceAccess) -> Self {
        Viewer { user: Some(user), access: Some(access), allow_public: access.workspace.allow_public }
    }

    /// Khách chưa đăng nhập. `workspace` = workspace của tài liệu (`None` nếu không nạp được ⇒ không thấy gì).
    pub fn guest(workspace: Option<&WorkspaceInfo>) -> Self {
        Viewer { user: None, access: None, allow_public: workspace.is_some_and(|w| w.allow_public) }
    }

    fn is(&self, u: &UserId) -> bool {
        self.user == Some(u)
    }
    fn is_ws_owner(&self) -> bool {
        self.access.is_some_and(|a| a.is_workspace_owner())
    }
    fn perms(&self, d: &DocumentDoc) -> DocPerms {
        self.access.map(|a| a.doc_perms_in(&d.group_id)).unwrap_or(DocPerms::NONE)
    }
    fn is_group_owner(&self, d: &DocumentDoc) -> bool {
        self.access.is_some_and(|a| a.is_group_owner(&d.group_id))
    }
}

/// Mức bảo mật **hiệu lực** của tài liệu với người xem: Công khai khi workspace đã tắt mức Công khai ⇒ Workspace.
pub fn effective_security(v: &Viewer, d: &DocumentDoc) -> Security {
    if d.security == Security::Public && !v.allow_public {
        Security::Workspace
    } else {
        d.security
    }
}

/// Xem được bản đã phát hành (hoặc đã bị thay thế) theo mức bảo mật (§6).
pub fn can_view_released(v: &Viewer, d: &DocumentDoc) -> bool {
    let level = effective_security(v, d);
    if level == Security::Public {
        return true;
    }
    if v.is_ws_owner() {
        return true;
    }
    let Some(a) = v.access else { return false };
    match level {
        Security::Private => v.is(&d.created_by) || v.is(&d.owner_id),
        Security::Group => a.is_group_member(&d.group_id) && v.perms(d).view,
        Security::Workspace => a.is_member() && a.has_doc_perm_anywhere(DocPerm::View),
        Security::Public => true,
    }
}

/// Xem được một phiên bản (§5.1 cho bản chưa phát hành, §6 cho bản đã phát hành).
pub fn can_view(v: &Viewer, d: &DocumentDoc, ver: &VersionDoc) -> bool {
    if ver.status.is_released() {
        return can_view_released(v, d);
    }
    if v.user.is_none() {
        return false;
    }
    if v.is_ws_owner() || v.is_group_owner(d) {
        return true;
    }
    let p = v.perms(d);
    match ver.status {
        VersionStatus::Draft => ver.editor_id.as_ref().is_some_and(|e| v.is(e)) || p.view,
        VersionStatus::Pending => {
            v.is(&d.created_by)
                || ver.editor_id.as_ref().is_some_and(|e| v.is(e))
                || ver.submitted_by.as_ref().is_some_and(|s| v.is(s))
                || p.approve
        }
        VersionStatus::Approved => v.is(&d.created_by) || p.approve || p.publish,
        VersionStatus::Published | VersionStatus::Superseded => unreachable!(),
    }
}

/// Nhận xét: xem được bản đó và có quyền `comment` (workspace owner luôn được).
pub fn can_comment(v: &Viewer, d: &DocumentDoc, ver: &VersionDoc) -> bool {
    v.user.is_some() && can_view(v, d, ver) && (v.is_ws_owner() || v.perms(d).comment)
}

/// Thấy tài liệu trong sổ đăng ký: xem được ít nhất một phiên bản hiện hành.
pub fn can_see_document(v: &Viewer, d: &DocumentDoc, working: Option<&VersionDoc>) -> bool {
    (d.published_version_id.is_some() && can_view_released(v, d)) || working.is_some_and(|w| can_view(v, d, w))
}

/// Các thao tác được phép trên tài liệu `d` với bản đang soạn `working` (nếu có).
pub fn capabilities(v: &Viewer, d: &DocumentDoc, working: Option<&VersionDoc>) -> Capabilities {
    let Some(user) = v.user else {
        return Capabilities { view: can_see_document(v, d, working), ..Default::default() };
    };
    let p = v.perms(d);
    let go = v.is_group_owner(d);
    let archived = d.archived_at.is_some();
    let mut c = Capabilities { view: can_see_document(v, d, working), ..Default::default() };
    c.edit_meta = !archived && (p.edit || go);
    c.manage_links = c.edit_meta;
    c.change_security = !archived && p.publish;
    c.archive = go || p.publish;
    c.delete = !d.ever_published && (go || &d.created_by == user);
    c.new_version = !archived && working.is_none() && d.published_version_id.is_some() && p.edit;
    if let Some(w) = working {
        let editor = w.editor_id.as_ref() == Some(user);
        c.comment = can_comment(v, d, w);
        match w.status {
            VersionStatus::Draft => {
                c.edit_content = !archived && editor && p.edit;
                c.submit = !archived && p.submit && (editor || go);
                c.change_editor = !archived && (editor || go);
            }
            VersionStatus::Pending => {
                c.withdraw = w.submitted_by.as_ref() == Some(user);
                c.reject = p.approve || go;
                // Việc duyệt do group owner của tài liệu thực hiện (§4.2, §5.2).
                c.approve = go;
            }
            VersionStatus::Approved => {
                c.reopen = p.approve || p.publish;
                c.publish = !archived && p.publish;
            }
            _ => {}
        }
    } else if d.published_version_id.is_some() {
        c.comment = v.user.is_some() && can_view_released(v, d) && (v.is_ws_owner() || p.comment);
    }
    c
}

#[cfg(test)]
mod tests {
    use super::*;
    use chillcat_kernel::contracts::{GroupAccess, ScopeGrant, WorkspaceInfo};
    use chillcat_kernel::*;

    struct World {
        ws_owner: UserId,
        group: GroupId,
        other_group: GroupId,
        creator: UserId,
        editor: UserId,
        viewer: UserId,
        approver: UserId,
        publisher: UserId,
        group_owner: UserId,
        other_member: UserId,
        outsider: UserId,
    }

    fn world() -> World {
        World {
            ws_owner: UserId::new(),
            group: GroupId::new(),
            other_group: GroupId::new(),
            creator: UserId::new(),
            editor: UserId::new(),
            viewer: UserId::new(),
            approver: UserId::new(),
            publisher: UserId::new(),
            group_owner: UserId::new(),
            other_member: UserId::new(),
            outsider: UserId::new(),
        }
    }

    fn access(w: &World, user: &UserId) -> WorkspaceAccess {
        access_with(w, user, true)
    }

    fn access_with(w: &World, user: &UserId, allow_public: bool) -> WorkspaceAccess {
        let g = |group: &GroupId, is_owner: bool, perms: DocPerms| GroupAccess {
            group_id: group.clone(),
            grant: ScopeGrant { is_owner, doc_perms: perms.closure(), user_perms: UserPerms::NONE },
        };
        let groups = if user == &w.creator || user == &w.editor {
            vec![g(&w.group, false, DocPerms::DEFAULT_MEMBER)]
        } else if user == &w.viewer {
            vec![g(&w.group, false, DocPerms { view: true, ..DocPerms::NONE })]
        } else if user == &w.approver {
            vec![g(&w.group, false, DocPerms { approve: true, ..DocPerms::NONE })]
        } else if user == &w.publisher {
            vec![g(&w.group, false, DocPerms { publish: true, ..DocPerms::NONE })]
        } else if user == &w.group_owner {
            vec![g(&w.group, true, DocPerms::ALL)]
        } else if user == &w.other_member {
            vec![g(&w.other_group, false, DocPerms::DEFAULT_MEMBER)]
        } else {
            vec![]
        };
        WorkspaceAccess {
            workspace: WorkspaceInfo {
                id: WorkspaceId::from("w"),
                code: "SHOP".into(),
                name: "S".into(),
                owner_id: w.ws_owner.clone(),
                allow_public,
            },
            user_id: user.clone(),
            workspace_grant: None,
            groups,
        }
    }

    fn doc(w: &World, security: Security) -> DocumentDoc {
        let now = bson::DateTime::now();
        DocumentDoc {
            id: DocumentId::new(),
            workspace_id: WorkspaceId::from("w"),
            group_id: w.group.clone(),
            type_code: "SRS".into(),
            subsystem_id: None,
            subsystem_code: Some("ORD".into()),
            process_no: None,
            code: "SHOP-SRS-ORD-001".into(),
            title: "SRS".into(),
            security,
            owner_id: w.creator.clone(),
            created_by: w.creator.clone(),
            created_at: now,
            updated_at: now,
            published_version_id: None,
            published_version: None,
            published_at: None,
            working_version_id: None,
            working_version: None,
            working_status: None,
            working_editor_id: None,
            ever_published: false,
            archived_at: None,
        }
    }

    fn ver(w: &World, status: VersionStatus) -> VersionDoc {
        let now = bson::DateTime::now();
        VersionDoc {
            id: VersionId::new(),
            document_id: DocumentId::new(),
            workspace_id: WorkspaceId::from("w"),
            version: "0.1".into(),
            status,
            working: status.is_working(),
            content: String::new(),
            revision: 1,
            change_note: None,
            created_by: w.creator.clone(),
            created_at: now,
            editor_id: Some(w.editor.clone()),
            updated_by: None,
            updated_at: now,
            review_round: 1,
            submitted_by: (status != VersionStatus::Draft).then(|| w.editor.clone()),
            submitted_at: None,
            approved_by: None,
            approved_at: None,
            published_by: None,
            published_at: None,
            superseded_at: None,
            based_on_version_id: None,
        }
    }

    fn sees(w: &World, user: &UserId, d: &DocumentDoc, v: &VersionDoc) -> bool {
        let a = access(w, user);
        can_view(&Viewer::new(user, &a), d, v)
    }

    #[test]
    fn visibility_matrix_for_unreleased_versions() {
        let w = world();
        let d = doc(&w, Security::Workspace);
        let all = [&w.ws_owner, &w.creator, &w.editor, &w.viewer, &w.approver, &w.publisher, &w.group_owner, &w.other_member, &w.outsider];
        let expect = |status: VersionStatus, allowed: &[&UserId]| {
            let v = ver(&w, status);
            for u in all {
                assert_eq!(sees(&w, u, &d, &v), allowed.contains(&u), "{status:?}");
            }
        };
        // Dự thảo: người sửa, người có quyền xem trong phạm vi (creator, editor, viewer có view; approver/publisher có view kéo theo), group owner, workspace owner
        expect(VersionStatus::Draft, &[&w.ws_owner, &w.creator, &w.editor, &w.viewer, &w.approver, &w.publisher, &w.group_owner]);
        // Chờ duyệt: người tạo, người sửa, người có approve, group owner, workspace owner
        expect(VersionStatus::Pending, &[&w.ws_owner, &w.creator, &w.editor, &w.approver, &w.group_owner]);
        // Đã duyệt: người tạo, approve / publish, group owner, workspace owner
        expect(VersionStatus::Approved, &[&w.ws_owner, &w.creator, &w.approver, &w.publisher, &w.group_owner]);
    }

    #[test]
    fn visibility_of_released_versions_follows_security_level() {
        let w = world();
        let v = ver(&w, VersionStatus::Published);
        let check = |sec: Security, allowed: &[&UserId], anon: bool| {
            let d = doc(&w, sec);
            for u in [&w.ws_owner, &w.creator, &w.viewer, &w.group_owner, &w.other_member, &w.outsider] {
                assert_eq!(sees(&w, u, &d, &v), allowed.contains(&u), "{sec:?}");
            }
            assert_eq!(can_view(&Viewer::guest(Some(&access(&w, &w.outsider).workspace)), &d, &v), anon);
            assert!(!can_view(&Viewer::guest(None), &d, &v), "không nạp được workspace ⇒ khách không thấy gì");
        };
        check(Security::Private, &[&w.ws_owner, &w.creator], false);
        check(Security::Group, &[&w.ws_owner, &w.creator, &w.viewer, &w.group_owner], false);
        check(Security::Workspace, &[&w.ws_owner, &w.creator, &w.viewer, &w.group_owner, &w.other_member], false);
        check(Security::Public, &[&w.ws_owner, &w.creator, &w.viewer, &w.group_owner, &w.other_member, &w.outsider], true);
    }

    #[test]
    fn public_falls_back_to_workspace_level_when_the_workspace_disallows_public() {
        let w = world();
        let v = ver(&w, VersionStatus::Published);
        let d = doc(&w, Security::Public);
        let sees_off = |u: &UserId| {
            let a = access_with(&w, u, false);
            can_view(&Viewer::new(u, &a), &d, &v)
        };
        // giống hệt mức Workspace: thành viên có `view` ở đâu đó + workspace owner; người ngoài không thấy
        for (u, expected) in [
            (&w.ws_owner, true),
            (&w.creator, true),
            (&w.viewer, true),
            (&w.group_owner, true),
            (&w.other_member, true),
            (&w.outsider, false),
        ] {
            assert_eq!(sees_off(u), expected);
        }
        let off = access_with(&w, &w.outsider, false).workspace;
        assert!(!can_view(&Viewer::guest(Some(&off)), &d, &v), "khách không xem được khi workspace tắt Công khai");
        assert!(!can_view_released(&Viewer::guest(Some(&off)), &d));
        let a = access_with(&w, &w.outsider, false);
        assert_eq!(effective_security(&Viewer::new(&w.outsider, &a), &d), Security::Workspace);
        assert!(!can_see_document(&Viewer::new(&w.outsider, &a), &DocumentDoc { published_version_id: Some(v.id.clone()), ..d.clone() }, None));
    }

    #[test]
    fn only_the_group_owner_approves_and_only_the_editor_edits() {
        let w = world();
        let d = doc(&w, Security::Group);
        let caps = |u: &UserId, status| {
            let a = access(&w, u);
            capabilities(&Viewer::new(u, &a), &d, Some(&ver(&w, status)))
        };
        assert!(caps(&w.editor, VersionStatus::Draft).edit_content);
        assert!(!caps(&w.creator, VersionStatus::Draft).edit_content, "chỉ một người được chỉ định sửa");
        assert!(caps(&w.editor, VersionStatus::Draft).submit);
        assert!(!caps(&w.ws_owner, VersionStatus::Draft).submit, "workspace owner không mặc nhiên có quyền tài liệu");
        assert!(caps(&w.ws_owner, VersionStatus::Draft).comment);
        assert!(!caps(&w.approver, VersionStatus::Pending).approve && caps(&w.approver, VersionStatus::Pending).reject);
        assert!(caps(&w.group_owner, VersionStatus::Pending).approve);
        assert!(caps(&w.editor, VersionStatus::Pending).withdraw, "người gửi duyệt rút lại được");
        assert!(caps(&w.publisher, VersionStatus::Approved).publish && caps(&w.publisher, VersionStatus::Approved).reopen);
        assert!(!caps(&w.approver, VersionStatus::Approved).publish);
    }
}
