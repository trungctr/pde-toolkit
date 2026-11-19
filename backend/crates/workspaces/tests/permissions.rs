//! Kiểm thử tích hợp quy tắc phân quyền (desc §3, §4.1, §9) trên MongoDB thật.
//! Cần replica set cục bộ: `backend/scripts/dev-mongo.ps1` (hoặc đặt MONGODB_URI).

use bson::{doc, Document};
use chillcat_kernel::contracts::*;
use chillcat_kernel::*;
use chillcat_platform::config::WorkspaceCreation;
use chillcat_platform::testing::{principal, TestDb};
use chillcat_workspaces::model::*;
use chillcat_workspaces::{WorkspaceService, WorkspaceSettings};
use futures::TryStreamExt;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[derive(Default)]
struct FakeIdentity(Mutex<HashMap<UserId, UserSummary>>);

impl FakeIdentity {
    fn add(&self, name: &str) -> UserId {
        let id = UserId::new();
        self.0.lock().unwrap().insert(
            id.clone(),
            UserSummary {
                id: id.clone(),
                email: format!("{}@example.com", name.to_lowercase()),
                employee_code: String::new(),
                first_name: name.into(),
                last_name: "Test".into(),
                display_name: format!("Test {name}"),
                avatar_url: None,
                system_role: SystemRole::User,
                disabled: false,
            },
        );
        id
    }
}

#[async_trait::async_trait]
impl IdentityApi for FakeIdentity {
    async fn user(&self, id: &UserId) -> AppResult<Option<UserSummary>> {
        Ok(self.0.lock().unwrap().get(id).cloned())
    }
    async fn users(&self, ids: &[UserId]) -> AppResult<HashMap<UserId, UserSummary>> {
        let m = self.0.lock().unwrap();
        Ok(ids.iter().filter_map(|i| m.get(i).map(|u| (i.clone(), u.clone()))).collect())
    }
    async fn user_by_email(&self, email: &str) -> AppResult<Option<UserSummary>> {
        Ok(self.0.lock().unwrap().values().find(|u| u.email == email).cloned())
    }
}

struct NoDocs;
#[async_trait::async_trait]
impl DocumentsApi for NoDocs {
    async fn document(&self, _: &DocumentId) -> AppResult<Option<DocumentBrief>> {
        Ok(None)
    }
    async fn version(&self, _: &VersionId) -> AppResult<Option<VersionBrief>> {
        Ok(None)
    }
    async fn doc_perms(&self, _: &UserId, _: &DocumentId) -> AppResult<Option<DocPerms>> {
        Ok(None)
    }
    async fn viewable_published(&self, _: &UserId, _: &WorkspaceId) -> AppResult<Vec<DocumentBrief>> {
        Ok(vec![])
    }
    async fn published_content(&self, _: &UserId, _: &DocumentId) -> AppResult<Option<PublishedContent>> {
        Ok(None)
    }
    async fn visible_version_ids(&self, _: &UserId, _: &WorkspaceId) -> AppResult<Vec<VersionId>> {
        Ok(vec![])
    }
    async fn count_in_group(&self, _: &GroupId) -> AppResult<u64> {
        Ok(0)
    }
    async fn count_with_subsystem(&self, _: &SubsystemId) -> AppResult<u64> {
        Ok(0)
    }
}

async fn setup() -> (TestDb, WorkspaceService, Arc<FakeIdentity>) {
    let tdb = TestDb::new().await;
    let identity = Arc::new(FakeIdentity::default());
    let late: Late<dyn DocumentsApi> = Late::new();
    late.set(Arc::new(NoDocs));
    let svc = WorkspaceService::new(
        tdb.mongo.clone(),
        &tdb.db(),
        tdb.bus().await,
        identity.clone(),
        late,
        WorkspaceSettings { creation: WorkspaceCreation::All, invitation_ttl: Duration::from_secs(3600) },
    );
    svc.ensure_indexes().await.unwrap();
    (tdb, svc, identity)
}

#[allow(clippy::too_many_arguments)]
async fn join(
    svc: &WorkspaceService,
    inviter: &UserId,
    who: &UserId,
    ws: &WorkspaceId,
    email: &str,
    scope: ScopeType,
    scope_id: Option<String>,
    doc_perms: Option<DocPerms>,
) {
    let inv = svc
        .create_invitation(
            &principal(inviter),
            ws,
            CreateInvitation { email: email.into(), scope_type: scope, scope_id, doc_perms, user_perms: None },
        )
        .await
        .unwrap();
    svc.accept_invitation(&principal(who), &inv.id).await.unwrap();
}

#[tokio::test]
async fn workspace_lifecycle_and_permission_rules() {
    let (tdb, svc, ids) = setup().await;
    let owner = ids.add("Owner");
    let lead = ids.add("Lead");
    let dev = ids.add("Dev");
    let po = principal(&owner);

    // --- tạo workspace: owner + group mặc định do owner làm chủ
    let ws = svc
        .create(&po, CreateWorkspace { code: "shop".into(), name: "Cửa hàng".into(), description: String::new(), default_group_name: None })
        .await
        .unwrap();
    assert_eq!(ws.code, "SHOP");
    let me = ws.me.clone().unwrap();
    assert!(me.is_workspace_owner);
    assert_eq!(me.workspace_doc_perms, DocPerms::WORKSPACE_OWNER, "workspace owner chỉ xem + nhận xét");
    assert_eq!(me.groups.len(), 1);
    assert_eq!(me.groups[0].doc_perms, DocPerms::ALL, "owner của group mặc định có mọi quyền tài liệu trong group");

    let dup = svc
        .create(
            &principal(&lead),
            CreateWorkspace { code: "SHOP".into(), name: "x".into(), description: String::new(), default_group_name: None },
        )
        .await
        .unwrap_err();
    assert_eq!(dup.code, "workspace.code_taken");
    let reserved = svc
        .create(&po, CreateWorkspace { code: "HTC".into(), name: "x".into(), description: String::new(), default_group_name: None })
        .await
        .unwrap_err();
    assert_eq!(reserved.code, "workspace.reserved_code");

    // --- workspace owner không cấp được quyền tài liệu vượt quá xem + nhận xét
    let err = svc
        .create_invitation(
            &po,
            &ws.id,
            CreateInvitation {
                email: "lead@example.com".into(),
                scope_type: ScopeType::Workspace,
                scope_id: None,
                doc_perms: Some(DocPerms::DEFAULT_MEMBER),
                user_perms: None,
            },
        )
        .await
        .unwrap_err();
    assert_eq!(err.code, "membership.exceeds_own_perms");

    // mời không ghi quyền ⇒ mặc định = quyền thành viên mới ∩ quyền của người mời
    join(&svc, &owner, &lead, &ws.id, "lead@example.com", ScopeType::Workspace, None, None).await;
    let lead_access = svc.access_of(&lead, &ws.id).await.unwrap().unwrap();
    assert_eq!(lead_access.workspace_grant.unwrap().doc_perms, DocPerms::WORKSPACE_OWNER.closure());

    // --- group "Dev" do Lead làm owner; Lead mời Dev vào group
    let g = svc
        .create_group(&po, &ws.id, CreateGroup { name: "Dev".into(), description: String::new(), owner_id: Some(lead.clone()) })
        .await
        .unwrap();
    assert!(
        svc.create_group(&principal(&lead), &ws.id, CreateGroup { name: "X".into(), description: String::new(), owner_id: None })
            .await
            .is_err(),
        "chỉ workspace owner tạo group"
    );
    join(&svc, &lead, &dev, &ws.id, "dev@example.com", ScopeType::Group, Some(g.id.to_string()), None).await;
    let dev_access = svc.access_of(&dev, &ws.id).await.unwrap().unwrap();
    assert_eq!(dev_access.doc_perms_in(&g.id), DocPerms::DEFAULT_MEMBER.closure());
    assert!(dev_access.user_perms_in_group(&g.id).is_empty());

    // Dev không có quyền mời
    let err = svc
        .create_invitation(
            &principal(&dev),
            &ws.id,
            CreateInvitation {
                email: "x@example.com".into(),
                scope_type: ScopeType::Group,
                scope_id: Some(g.id.to_string()),
                doc_perms: None,
                user_perms: None,
            },
        )
        .await
        .unwrap_err();
    assert_eq!(err.code, "invitation.forbidden");

    // --- Lead (group owner) chỉnh quyền Dev: được cấp approve, không được cấp assign_owner
    let members = svc.members(&po, &ws.id).await.unwrap();
    let dev_m = members.iter().find(|m| m.user.id == dev).unwrap().memberships[0].id.clone();
    let lead_ws_m = members
        .iter()
        .find(|m| m.user.id == lead)
        .unwrap()
        .memberships
        .iter()
        .find(|m| m.scope_type == ScopeType::Workspace)
        .unwrap()
        .id
        .clone();
    let owner_ws_m = members
        .iter()
        .find(|m| m.user.id == owner)
        .unwrap()
        .memberships
        .iter()
        .find(|m| m.scope_type == ScopeType::Workspace)
        .unwrap()
        .id
        .clone();
    let upd = svc
        .update_membership(
            &principal(&lead),
            &dev_m,
            UpdateMembership {
                doc_perms: Some(DocPerms { approve: true, ..DocPerms::DEFAULT_MEMBER }),
                user_perms: Some(UserPerms { invite: true, assign_owner: true, ..UserPerms::NONE }),
            },
        )
        .await
        .unwrap();
    assert!(upd.doc_perms.approve && upd.user_perms.invite);
    assert!(!upd.user_perms.assign_owner, "quyền chỉ định owner bị bỏ ở phạm vi group");

    // không tự sửa quyền mình; group owner không đụng được tới workspace owner
    assert_eq!(
        svc.update_membership(&principal(&dev), &dev_m, UpdateMembership { doc_perms: Some(DocPerms::ALL), user_perms: None })
            .await
            .unwrap_err()
            .code,
        "membership.self"
    );
    assert!(svc.remove_membership(&principal(&lead), &owner_ws_m).await.is_err());
    // workspace owner không rời đi được
    assert_eq!(svc.remove_membership(&po, &owner_ws_m).await.unwrap_err().code, "membership.owner_cannot_leave");
    // group owner không bị loại khỏi workspace khi còn làm chủ group
    assert_eq!(svc.remove_membership(&po, &lead_ws_m).await.unwrap_err().code, "membership.group_owner");

    // --- danh sách người có quyền duyệt tài liệu của group Dev: Lead (owner) và Dev (được cấp approve)
    let mut approvers = svc.users_with_doc_perm(&ws.id, &g.id, DocPerm::Approve).await.unwrap();
    approvers.sort();
    let mut expect = vec![lead.clone(), dev.clone()];
    expect.sort();
    assert_eq!(approvers, expect);
    let commenters = svc.users_with_doc_perm(&ws.id, &g.id, DocPerm::Comment).await.unwrap();
    assert!(commenters.contains(&owner), "workspace owner luôn nhận xét được");

    // --- chuyển group owner sang Dev; Lead thành thành viên thường; rồi loại Lead khỏi workspace
    svc.assign_group_owner(&po, &g.id, AssignGroupOwner { user_id: dev.clone() }).await.unwrap();
    let dev_access = svc.access_of(&dev, &ws.id).await.unwrap().unwrap();
    assert!(dev_access.is_group_owner(&g.id));
    let lead_access = svc.access_of(&lead, &ws.id).await.unwrap().unwrap();
    assert!(!lead_access.is_group_owner(&g.id));
    svc.remove_membership(&po, &lead_ws_m).await.unwrap();
    let lead_access = svc.access_of(&lead, &ws.id).await.unwrap().unwrap();
    assert!(!lead_access.is_member(), "loại khỏi workspace = loại khỏi mọi group");

    // sự kiện loại thành viên ghi người nhận quyền phụ trách tài liệu
    let events: Vec<Document> =
        tdb.db().collection::<Document>("outbox").find(doc! { "kind": "membership.removed" }).await.unwrap().try_collect().await.unwrap();
    assert_eq!(events.len(), 2, "một sự kiện cho mỗi phạm vi bị loại");
    for e in &events {
        let data = e.get_document("data").unwrap();
        let succ = data.get_str("successor_id").unwrap();
        match data.get_str("scope_type").unwrap() {
            "workspace" => assert_eq!(succ, owner.as_str()),
            _ => assert_eq!(succ, dev.as_str(), "phụ trách tài liệu của group chuyển cho group owner"),
        }
    }

    // --- chuyển workspace owner
    let w = svc.transfer(&po, &ws.id, TransferOwnership { user_id: dev.clone() }).await.unwrap();
    assert_eq!(w.owner_id, dev);
    let old = svc.access_of(&owner, &ws.id).await.unwrap().unwrap();
    assert!(!old.is_workspace_owner() && old.is_member());
    assert!(svc.update(&po, &ws.id, UpdateWorkspace { name: Some("x".into()), description: None, allow_public: None }).await.is_err());
}

#[tokio::test]
async fn non_members_cannot_see_a_workspace_but_can_find_it_in_the_directory() {
    let (_tdb, svc, ids) = setup().await;
    let owner = ids.add("Owner");
    let outsider = ids.add("Out");
    let ws = svc
        .create(
            &principal(&owner),
            CreateWorkspace { code: "ERP".into(), name: "ERP".into(), description: String::new(), default_group_name: Some("Lõi".into()) },
        )
        .await
        .unwrap();
    let err = svc.get(&principal(&outsider), &ws.id).await.unwrap_err();
    assert_eq!(err.kind, ErrorKind::NotFound, "không lộ workspace cho người ngoài");
    assert!(svc.members(&principal(&outsider), &ws.id).await.is_err());
    let dir = svc.directory(&principal(&outsider)).await.unwrap();
    assert!(dir.iter().any(|d| d.code == "ERP"));
    let access = svc.access_of(&outsider, &ws.id).await.unwrap().unwrap();
    assert!(!access.is_member());
}
