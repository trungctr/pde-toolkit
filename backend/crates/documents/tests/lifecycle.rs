//! Kiểm thử tích hợp vòng đời tài liệu (desc §5, §6, §7) với module workspaces + traceability thật.

use bson::{doc, Document};
use chillcat_documents::lifecycle::Action;
use chillcat_documents::model::*;
use chillcat_documents::template::set_header_rows;
use chillcat_documents::{DocumentService, DocumentSettings};
use chillcat_kernel::contracts::*;
use chillcat_kernel::*;
use chillcat_platform::config::WorkspaceCreation;
use chillcat_platform::testing::{principal, TestDb};
use chillcat_platform::OutboxRelay;
use chillcat_traceability::TraceService;
use chillcat_workspaces::model::*;
use chillcat_workspaces::{WorkspaceService, WorkspaceSettings};
use futures::TryStreamExt;
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
                last_name: "Lê".into(),
                display_name: format!("Lê {name}"),
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

struct World {
    tdb: TestDb,
    ws: Arc<WorkspaceService>,
    docs: Arc<DocumentService>,
    relay: OutboxRelay,
    ids: Arc<Ids>,
}

async fn world() -> World {
    let tdb = TestDb::new().await;
    let bus = tdb.bus().await;
    let ids = Arc::new(Ids::default());
    let late_docs: Late<dyn DocumentsApi> = Late::new();
    let ws = Arc::new(WorkspaceService::new(
        tdb.mongo.clone(),
        &tdb.db(),
        bus.clone(),
        ids.clone(),
        late_docs.clone(),
        WorkspaceSettings { creation: WorkspaceCreation::All, invitation_ttl: Duration::from_secs(3600) },
    ));
    ws.ensure_indexes().await.unwrap();
    let trace = Arc::new(TraceService::new(&tdb.db(), bus.clone(), ws.clone(), late_docs.clone()));
    trace.ensure_indexes().await.unwrap();
    let docs = Arc::new(DocumentService::new(
        tdb.mongo.clone(),
        &tdb.db(),
        bus.clone(),
        ws.clone(),
        ids.clone(),
        trace.clone(),
        DocumentSettings { superseded_retention_years: 10 },
    ));
    docs.ensure_indexes().await.unwrap();
    late_docs.set(docs.clone());
    let handlers: Vec<Arc<dyn EventHandler>> = vec![Arc::new(chillcat_documents_handlers(docs.clone())), trace_handler(trace.clone())];
    let relay = bus.relay(handlers);
    World { tdb, ws, docs, relay, ids }
}

// Handler công khai qua Module::event_handlers; ở đây dựng trực tiếp qua module.
fn chillcat_documents_handlers(_d: Arc<DocumentService>) -> NoopHandler {
    NoopHandler
}
struct NoopHandler;
#[async_trait::async_trait]
impl EventHandler for NoopHandler {
    fn name(&self) -> &'static str {
        "noop"
    }
    async fn handle(&self, _e: &DomainEvent) -> AppResult<()> {
        Ok(())
    }
}
fn trace_handler(t: Arc<TraceService>) -> Arc<dyn EventHandler> {
    struct H(Arc<TraceService>);
    #[async_trait::async_trait]
    impl EventHandler for H {
        fn name(&self) -> &'static str {
            "trace"
        }
        fn interested_in(&self, k: &str) -> bool {
            k == events::kinds::VERSION_PUBLISHED
        }
        async fn handle(&self, e: &DomainEvent) -> AppResult<()> {
            self.0.on_published(e).await
        }
    }
    Arc::new(H(t))
}

fn ack() -> TransitionInput {
    TransitionInput { acknowledge_warnings: true, ..Default::default() }
}

async fn content_of(w: &World, p: &Principal, d: &DocumentDetailDto) -> (VersionId, String, i64) {
    let vid = d.document.working_version_id.clone().unwrap();
    let v = w.docs.version(Some(p), &vid).await.unwrap();
    (vid, v.content, v.revision)
}

#[tokio::test]
async fn full_document_lifecycle() {
    let w = world().await;
    let (owner, editor, publisher, outsider) = (w.ids.add("Owner"), w.ids.add("Editor"), w.ids.add("Pub"), w.ids.add("Out"));
    let (po, pe, pp) = (principal(&owner), principal(&editor), principal(&publisher));

    // --- workspace SHOP, group mặc định do Owner làm chủ; mời Editor (mặc định) và Pub (thêm publish)
    let ws = w
        .ws
        .create(&po, CreateWorkspace { code: "SHOP".into(), name: "Cửa hàng".into(), description: String::new(), default_group_name: None })
        .await
        .unwrap();
    let group = ws.me.unwrap().groups[0].group_id.clone();
    for (who, email, perms) in [
        (&editor, "editor@x.vn", DocPerms::DEFAULT_MEMBER),
        (&publisher, "pub@x.vn", DocPerms { publish: true, ..DocPerms::DEFAULT_MEMBER }),
    ] {
        let inv =
            w.ws.create_invitation(
                &po,
                &ws.id,
                CreateInvitation {
                    email: email.into(),
                    scope_type: ScopeType::Group,
                    scope_id: Some(group.to_string()),
                    doc_perms: Some(perms),
                    user_perms: None,
                },
            )
            .await
            .unwrap();
        w.ws.accept_invitation(&principal(who), &inv.id).await.unwrap();
    }
    let ord =
        w.ws.create_subsystem(&po, &ws.id, CreateSubsystem { code: "ORD".into(), name: "Đặt hàng".into(), description: String::new() })
            .await
            .unwrap();

    // --- tạo StRS rồi SRS-ORD từ mẫu: mã sinh tự động, quan hệ ↑ mặc định
    let mk = |t: &str, sub: Option<SubsystemId>| CreateDocument {
        type_code: t.into(),
        group_id: group.clone(),
        subsystem_id: sub,
        process_no: None,
        process_name: None,
        module_code: Some("CART".into()),
        title: None,
        security: Some(Security::Workspace),
        content: None,
        editor_id: None,
    };
    let strs = w.docs.create(&pe, &ws.id, mk("STRS", None)).await.unwrap();
    assert_eq!(strs.document.code, "SHOP-StRS-000");
    let srs = w.docs.create(&pe, &ws.id, mk("SRS", Some(ord.id.clone()))).await.unwrap();
    assert_eq!(srs.document.code, "SHOP-SRS-ORD-001");
    assert!(srs.links.iter().any(|l| l.direction == "up" && l.code == "SHOP-StRS-000"), "SRS ↑ StRS mặc định");
    let dup = w.docs.create(&pe, &ws.id, mk("SRS", Some(ord.id.clone()))).await.unwrap_err();
    assert_eq!(dup.code, "document.duplicate", "một SRS cho mỗi hệ thống con");
    assert!(w.docs.create(&principal(&outsider), &ws.id, mk("SAD", None)).await.is_err());

    // người ngoài không thấy bản dự thảo
    assert_eq!(w.docs.detail(&principal(&outsider), &srs.document.id).await.unwrap_err().kind, ErrorKind::NotFound);

    // --- chỉ người được chỉ định sửa mới lưu được; khoá lạc quan theo revision
    let (srs_v, content, rev) = content_of(&w, &pe, &srs).await;
    // tham chiếu StR-01 đặt trước mục Lịch sử thay đổi (mục đó không được đọc mã)
    let filled = set_header_rows(&content, &[("Nguồn đã khảo sát", "`repo/ord`")]).replacen(
        "## 9. Lịch sử thay đổi",
        "Đáp ứng nhu cầu StR-01.\n\n## 9. Lịch sử thay đổi",
        1,
    );
    assert!(filled.contains("Đáp ứng nhu cầu StR-01."));
    assert_eq!(
        w.docs.save_content(&po, &srs_v, SaveContent { content: filled.clone(), revision: rev }).await.unwrap_err().code,
        "document.not_editor"
    );
    let saved = w.docs.save_content(&pe, &srs_v, SaveContent { content: filled.clone(), revision: rev }).await.unwrap();
    assert!(saved.lint.defined.contains(&"FR-ORD-CART-001".to_owned()));
    assert_eq!(
        w.docs.save_content(&pe, &srs_v, SaveContent { content: filled, revision: rev }).await.unwrap_err().code,
        "document.stale_revision"
    );

    // --- gửi duyệt SRS: cảnh báo (StRS ↑ còn dự thảo, StR-01 chưa định nghĩa) cần xác nhận
    let warn = w.docs.transition(&pe, &srs_v, Action::Submit, TransitionInput::default()).await.unwrap_err();
    assert_eq!(warn.code, "document.check_warnings");
    let codes: Vec<String> =
        warn.details.unwrap()["issues"].as_array().unwrap().iter().map(|i| i["code"].as_str().unwrap().to_owned()).collect();
    assert!(codes.contains(&"link.upstream_draft".to_owned()) && codes.contains(&"trace.unknown_reference".to_owned()), "{codes:?}");
    let d = w.docs.transition(&pe, &srs_v, Action::Submit, ack()).await.unwrap();
    assert_eq!(d.document.working_status, Some(VersionStatus::Pending));
    // nội dung bị khoá, bảng lịch sử có dòng gửi duyệt
    assert_eq!(
        w.docs.save_content(&pe, &srs_v, SaveContent { content: "x".into(), revision: 99 }).await.unwrap_err().code,
        "document.not_draft"
    );
    let v = w.docs.version(Some(&pe), &srs_v).await.unwrap();
    assert!(v.content.contains("| 0.1 | ") && v.content.contains(" | Gửi duyệt | Lê Editor |"));
    assert!(v.content.contains("| Trạng thái | Chờ duyệt |"));

    // --- chỉ group owner duyệt; Pub (không có approve) không thấy bản chờ duyệt
    assert_eq!(w.docs.transition(&pp, &srs_v, Action::Approve, ack()).await.unwrap_err().kind, ErrorKind::NotFound);
    let d = w.docs.transition(&po, &srs_v, Action::Approve, ack()).await.unwrap();
    assert_eq!(d.document.working_status, Some(VersionStatus::Approved));

    // --- phát hành bị chặn khi tài liệu ↑ (StRS) chưa phát hành
    let blocked = w.docs.transition(&pp, &srs_v, Action::Publish, ack()).await.unwrap_err();
    assert_eq!(blocked.code, "document.check_failed");

    // --- đưa StRS qua đủ vòng: trả lại (bắt buộc lý do) → 0.2 → gửi lại → duyệt → phát hành 1.0
    let (strs_v, _, _) = content_of(&w, &pe, &strs).await;
    w.docs.transition(&pe, &strs_v, Action::Submit, ack()).await.unwrap();
    assert_eq!(
        w.docs.transition(&po, &strs_v, Action::Reject, TransitionInput::default()).await.unwrap_err().code,
        "document.reason_required"
    );
    let d =
        w.docs.transition(&po, &strs_v, Action::Reject, TransitionInput { comment: Some("Bổ sung SH-OPS".into()), ..ack() }).await.unwrap();
    assert_eq!(d.document.working_version.as_deref(), Some("0.2"), "trả lại ⇒ số dự thảo tăng");
    w.docs.transition(&pe, &strs_v, Action::Submit, ack()).await.unwrap();
    w.docs.transition(&po, &strs_v, Action::Approve, ack()).await.unwrap();
    let d = w.docs.transition(&pp, &strs_v, Action::Publish, ack()).await.unwrap();
    assert_eq!(d.document.published_version.as_deref(), Some("1.0"));
    assert!(d.document.working_version_id.is_none());
    w.relay.drain().await.unwrap();

    // --- giờ SRS phát hành được
    let d = w.docs.transition(&pp, &srs_v, Action::Publish, ack()).await.unwrap();
    assert_eq!(d.document.published_version.as_deref(), Some("1.0"));
    w.relay.drain().await.unwrap();
    let elements: Vec<Document> =
        w.tdb.db().collection::<Document>("trace_elements").find(doc! {}).await.unwrap().try_collect().await.unwrap();
    let codes: Vec<&str> = elements.iter().map(|e| e.get_str("code").unwrap()).collect();
    assert!(codes.contains(&"StR-01") && codes.contains(&"FR-ORD-CART-001"), "{codes:?}");

    // --- StRS 1.1 đổi nội dung StR-01 ⇒ SRS bị đánh dấu Cần rà soát; 1.0 thành Thay thế
    let d = w.docs.new_version(&pe, &strs.document.id, NewVersionInput::default()).await.unwrap();
    assert_eq!(d.document.working_version.as_deref(), Some("1.1"));
    assert!(w.docs.new_version(&pe, &strs.document.id, NewVersionInput::default()).await.is_err(), "mỗi lúc một bản dự thảo");
    let (v11, c11, r11) = content_of(&w, &pe, &d).await;
    let line = c11.lines().find(|l| l.starts_with("| StR-01 |")).unwrap().to_owned();
    let changed = c11.replace(&line, &line.replacen("| StR-01 | SH-USR |", "| StR-01 | SH-ADM |", 1));
    assert_ne!(changed, c11);
    w.docs.save_content(&pe, &v11, SaveContent { content: changed, revision: r11 }).await.unwrap();
    w.docs.transition(&pe, &v11, Action::Submit, ack()).await.unwrap();
    w.docs.transition(&po, &v11, Action::Approve, ack()).await.unwrap();
    let d = w.docs.transition(&pp, &v11, Action::Publish, TransitionInput { major: true, ..ack() }).await.unwrap();
    assert_eq!(d.document.published_version.as_deref(), Some("2.0"), "thay đổi lớn ⇒ 2.0");
    assert!(d.versions.iter().any(|v| v.version == "1.0" && v.status == VersionStatus::Superseded));
    w.relay.drain().await.unwrap();
    let flags: Vec<Document> = w.tdb.db().collection::<Document>("review_flags").find(doc! {}).await.unwrap().try_collect().await.unwrap();
    assert_eq!(flags.len(), 1, "{flags:?}");
    assert_eq!(flags[0].get_str("document_code").unwrap(), "SHOP-SRS-ORD-001");
    assert_eq!(flags[0].get_str("element_code").unwrap(), "StR-01");

    // --- tài liệu đã phát hành không xoá được; lịch sử duyệt đầy đủ
    assert_eq!(w.docs.delete(&po, &strs.document.id).await.unwrap_err().code, "document.published_cannot_delete");
    let reviews = w.docs.reviews(&po, &strs.document.id).await.unwrap();
    assert!(reviews.iter().any(|r| r.action == ReviewAction::Reject && r.comment.as_deref() == Some("Bổ sung SH-OPS")));

    // --- mức Công khai cần xác nhận; sau đó khách xem được bản phát hành
    let err = w
        .docs
        .update(&pp, &srs.document.id, UpdateDocument { title: None, security: Some(Security::Public), confirm_public: false })
        .await
        .unwrap_err();
    assert_eq!(err.code, "document.confirm_public");
    w.docs
        .update(&pp, &srs.document.id, UpdateDocument { title: None, security: Some(Security::Public), confirm_public: true })
        .await
        .unwrap();
    let public = w.docs.public_document(&srs.document.id).await.unwrap();
    assert_eq!(public.version, "1.0");
    assert!(w.docs.public_document(&strs.document.id).await.is_err());

    // --- nhận xét: workspace owner nhận xét được ở mọi nơi; người ngoài thì không
    let pub_v = d.document.published_version_id.clone().unwrap();
    let cs = w
        .docs
        .add_comment(&po, &pub_v, CreateComment { body: "Rõ ràng".into(), anchor: Some("3. Nhu cầu".into()), parent_id: None })
        .await
        .unwrap();
    assert_eq!(cs.len(), 1);
    assert!(w
        .docs
        .add_comment(&principal(&outsider), &pub_v, CreateComment { body: "x".into(), anchor: None, parent_id: None })
        .await
        .is_err());
}
