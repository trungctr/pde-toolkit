//! Kiểm thử tích hợp quyền ticket (desc §4.4, §9.6) và kiểm tra trùng (bộ so từ khoá, không cần AI).

use chillcat_kernel::contracts::*;
use chillcat_kernel::*;
use chillcat_platform::config::WorkspaceCreation;
use chillcat_platform::testing::{principal, TestDb};
use chillcat_tickets::model::*;
use chillcat_tickets::TicketService;
use chillcat_workspaces::model::*;
use chillcat_workspaces::{WorkspaceService, WorkspaceSettings};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[derive(Default)]
struct Ids(Mutex<HashMap<UserId, UserSummary>>);
impl Ids {
    fn add(&self, name: &str) -> UserId {
        let id = UserId::new();
        self.0.lock().unwrap().insert(
            id.clone(),
            UserSummary {
                id: id.clone(),
                email: format!("{}@x.vn", name.to_lowercase()),
                employee_code: String::new(),
                first_name: name.into(),
                last_name: "Trần".into(),
                display_name: format!("Trần {name}"),
                avatar_url: None,
                system_role: SystemRole::User,
                disabled: false,
            },
        );
        id
    }
}
#[async_trait::async_trait]
impl IdentityApi for Ids {
    async fn user(&self, id: &UserId) -> AppResult<Option<UserSummary>> {
        Ok(self.0.lock().unwrap().get(id).cloned())
    }
    async fn users(&self, ids: &[UserId]) -> AppResult<HashMap<UserId, UserSummary>> {
        let m = self.0.lock().unwrap();
        Ok(ids.iter().filter_map(|i| m.get(i).map(|u| (i.clone(), u.clone()))).collect())
    }
    async fn user_by_email(&self, e: &str) -> AppResult<Option<UserSummary>> {
        Ok(self.0.lock().unwrap().values().find(|u| u.email == e).cloned())
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
struct NoTrace;
#[async_trait::async_trait]
impl TraceApi for NoTrace {
    async fn index_version(&self, _: &VersionContent) -> AppResult<TraceReport> {
        Ok(TraceReport::default())
    }
    async fn lint(&self, _: &VersionContent) -> AppResult<TraceReport> {
        Ok(TraceReport::default())
    }
    async fn forget_version(&self, _: &VersionId) -> AppResult<()> {
        Ok(())
    }
    async fn forget_document(&self, _: &DocumentId) -> AppResult<()> {
        Ok(())
    }
    async fn elements_in_text(&self, _: &WorkspaceId, _: &str) -> AppResult<Vec<TraceElementBrief>> {
        Ok(vec![])
    }
    async fn documents_using(&self, _: &WorkspaceId, _: &[String]) -> AppResult<Vec<DocumentId>> {
        Ok(vec![])
    }
}

fn ticket(title: &str, body: &str) -> CreateTicket {
    CreateTicket {
        kind: TicketKind::Bug,
        title: title.into(),
        body: body.into(),
        group_id: None,
        reproduction_steps: Some("Bấm Xuất".into()),
        actual_result: None,
        expected_result: None,
        environment: None,
        software_version: None,
    }
}

#[tokio::test]
async fn ticket_permissions_and_duplicate_flow() {
    let tdb = TestDb::new().await;
    let bus = tdb.bus().await;
    let ids = Arc::new(Ids::default());
    let late: Late<dyn DocumentsApi> = Late::new();
    late.set(Arc::new(NoDocs));
    let ws_svc = Arc::new(WorkspaceService::new(
        tdb.mongo.clone(),
        &tdb.db(),
        bus.clone(),
        ids.clone(),
        late,
        WorkspaceSettings { creation: WorkspaceCreation::All, invitation_ttl: Duration::from_secs(3600) },
    ));
    ws_svc.ensure_indexes().await.unwrap();
    let svc =
        Arc::new(TicketService::new(tdb.mongo.clone(), &tdb.db(), bus, ws_svc.clone(), ids.clone(), Arc::new(NoDocs), Arc::new(NoTrace), None));
    svc.ensure_indexes().await.unwrap();

    let (owner, support, delegate, outsider, other) =
        (ids.add("Owner"), ids.add("Support"), ids.add("Deleg"), ids.add("Out"), ids.add("Other"));
    let po = principal(&owner);
    let ws = ws_svc
        .create(&po, CreateWorkspace { code: "SHOP".into(), name: "Shop".into(), description: String::new(), default_group_name: None })
        .await
        .unwrap();
    let group = ws.me.unwrap().groups[0].group_id.clone();
    for (who, email, scope) in [(&support, "support@x.vn", ScopeType::Group), (&delegate, "deleg@x.vn", ScopeType::Workspace)] {
        let inv = ws_svc
            .create_invitation(
                &po,
                &ws.id,
                CreateInvitation {
                    email: email.into(),
                    scope_type: scope,
                    scope_id: (scope == ScopeType::Group).then(|| group.to_string()),
                    doc_perms: None,
                    user_perms: None,
                },
            )
            .await
            .unwrap();
        ws_svc.accept_invitation(&principal(who), &inv.id).await.unwrap();
    }

    // --- người ngoài workspace mở ticket và xem được ticket của mình
    let t1 = svc
        .create(&principal(&outsider), &ws.id, ticket("Không xuất được hoá đơn PDF", "Bấm nút xuất hoá đơn thì báo lỗi 500"))
        .await
        .unwrap();
    assert_eq!(t1.ticket.number, 1);
    assert!(!t1.ticket.capabilities.process);
    // không có quyền mặc định theo vai trò – kể cả workspace owner
    assert_eq!(svc.detail(&po, &t1.ticket.id).await.unwrap_err().kind, ErrorKind::NotFound);
    assert_eq!(svc.detail(&principal(&support), &t1.ticket.id).await.unwrap_err().kind, ErrorKind::NotFound);
    assert!(svc.list(&po, &ws.id, TicketQuery::default()).await.unwrap().is_empty());

    // --- workspace owner cấp xem + xử lý cho group "Chung" ở phạm vi workspace
    for kind in [GrantKind::View, GrantKind::Process] {
        svc.create_grant(
            &po,
            &ws.id,
            CreateGrant {
                kind,
                subject_type: SubjectType::Group,
                subject_id: group.to_string(),
                scope_type: ScopeType::Workspace,
                scope_id: None,
            },
        )
        .await
        .unwrap();
    }
    let d = svc.detail(&principal(&support), &t1.ticket.id).await.unwrap();
    assert!(d.ticket.capabilities.process, "thành viên group được cấp xem + xử lý");
    // owner cũng là thành viên group "Chung" nên giờ cũng xem được
    assert!(svc.detail(&po, &t1.ticket.id).await.is_ok());
    // người ngoài vẫn chỉ thấy ticket của mình
    let t_other = svc.create(&principal(&other), &ws.id, ticket("Đổi màu nút đăng nhập", "Nút xanh quá")).await.unwrap();
    assert!(svc.detail(&principal(&outsider), &t_other.ticket.id).await.is_err());
    assert_eq!(svc.mine(&principal(&outsider)).await.unwrap().len(), 1);

    // --- uỷ quyền quyết định: chỉ workspace owner; người được uỷ quyền không tự có quyền xem
    assert!(svc
        .create_delegation(
            &principal(&support),
            &ws.id,
            CreateDelegation { user_id: delegate.clone(), can_decide_view: true, can_decide_process: false }
        )
        .await
        .is_err());
    svc.create_delegation(&po, &ws.id, CreateDelegation { user_id: delegate.clone(), can_decide_view: true, can_decide_process: false })
        .await
        .unwrap();
    assert!(svc.detail(&principal(&delegate), &t1.ticket.id).await.is_err(), "quyền quyết định không kèm quyền xem");
    let grant_process = CreateGrant {
        kind: GrantKind::Process,
        subject_type: SubjectType::User,
        subject_id: delegate.to_string(),
        scope_type: ScopeType::Workspace,
        scope_id: None,
    };
    assert_eq!(svc.create_grant(&principal(&delegate), &ws.id, grant_process).await.unwrap_err().code, "ticket.grant_forbidden");
    svc.create_grant(
        &principal(&delegate),
        &ws.id,
        CreateGrant {
            kind: GrantKind::View,
            subject_type: SubjectType::User,
            subject_id: delegate.to_string(),
            scope_type: ScopeType::Workspace,
            scope_id: None,
        },
    )
    .await
    .unwrap();
    let d = svc.detail(&principal(&delegate), &t1.ticket.id).await.unwrap();
    assert!(!d.ticket.capabilities.process, "xem nhưng không xử lý");
    assert!(d.checks.is_empty(), "kết quả AI chỉ cho người xử lý");

    // --- ticket trùng: kiểm tra bằng từ khoá do người xử lý kích hoạt
    let t3 = svc
        .create(&principal(&other), &ws.id, ticket("Lỗi khi xuất hóa đơn ra PDF", "Nút xuất hoá đơn không chạy, báo lỗi"))
        .await
        .unwrap();
    let ps = principal(&support);
    assert!(svc.trigger(&principal(&delegate), &t3.ticket.id, CheckPurpose::Duplicates).await.is_err(), "kích hoạt AI cần cả xem và xử lý");
    svc.trigger(&ps, &t3.ticket.id, CheckPurpose::Duplicates).await.unwrap();
    let mut detail = None;
    for _ in 0..100 {
        let d = svc.detail(&ps, &t3.ticket.id).await.unwrap();
        // tác vụ nền ghi ticket rồi mới ghi lần chạy; detail() đọc hai thứ lần lượt ⇒ chờ cả hai
        if d.checks.first().is_some_and(|c| c.status != CheckStatus::Pending) && d.ticket.status != TicketStatus::Checking {
            detail = Some(d);
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    let d = detail.expect("kiểm tra trùng xong");
    let check = &d.checks[0];
    assert_eq!(check.status, CheckStatus::Completed);
    assert_eq!(check.result, Some(CheckResult::CandidatesFound));
    assert!(check.checked_scope.contains("so khớp từ khoá"));
    assert_eq!(d.ticket.status, TicketStatus::Reviewing);
    let cand = check.candidates.iter().find(|c| c.ticket.id == t1.ticket.id).expect("tìm thấy ticket #1");
    assert!(!check.candidates.iter().any(|c| c.ticket.id == t_other.ticket.id));

    // xác nhận trùng; người gửi #3 không xem được ticket gốc ⇒ chỉ thấy cờ "trùng (ẩn)"
    let d = svc.decide_candidate(&ps, &cand.id, Decide { decision: "confirmed".into() }).await.unwrap();
    assert_eq!(d.ticket.status, TicketStatus::Duplicate);
    assert_eq!(d.ticket.duplicate_of.as_ref().unwrap().number, 1);
    let author_view = svc.detail(&principal(&other), &t3.ticket.id).await.unwrap();
    assert!(author_view.ticket.duplicate_of.is_none() && author_view.ticket.duplicate_of_hidden);

    // không tạo vòng trùng, không trỏ chính nó
    assert_eq!(
        svc.mark_duplicate(&ps, &t1.ticket.id, MarkDuplicate { original_ticket_id: t3.ticket.id.clone() }).await.unwrap_err().code,
        "ticket.duplicate_cycle"
    );
    assert_eq!(
        svc.mark_duplicate(&ps, &t1.ticket.id, MarkDuplicate { original_ticket_id: t1.ticket.id.clone() }).await.unwrap_err().code,
        "ticket.self_duplicate"
    );

    // --- chuyển trạng thái theo luồng
    assert_eq!(
        svc.change_status(&ps, &t1.ticket.id, ChangeStatus { status: TicketStatus::Resolved, note: None }).await.unwrap_err().code,
        "ticket.invalid_transition"
    );
    svc.change_status(&ps, &t1.ticket.id, ChangeStatus { status: TicketStatus::Accepted, note: Some("Sẽ sửa".into()) }).await.unwrap();
    let d = svc.change_status(&ps, &t1.ticket.id, ChangeStatus { status: TicketStatus::InProgress, note: None }).await.unwrap();
    assert!(d.activity.iter().any(|a| a.text.contains("Sẽ sửa")));
    assert!(svc
        .change_status(&principal(&outsider), &t1.ticket.id, ChangeStatus { status: TicketStatus::Resolved, note: None })
        .await
        .is_err());
}
