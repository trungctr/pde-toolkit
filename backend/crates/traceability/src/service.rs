//! Lưu trữ và quy tắc của module traceability.
//!
//! - `trace_occurrences`: mỗi lần xuất hiện của một mã trong một phiên bản (bản đang soạn hoặc bản đang phát hành
//!   của mỗi tài liệu). Thay toàn bộ mỗi lần lưu nội dung.
//! - `trace_elements`: **sổ mã** – mã đã định nghĩa trong một bản đã phát hành. Mã đã cấp không dùng lại; mã bị bỏ
//!   vẫn giữ với trạng thái `retired` (desc §7.2).
//! - `review_flags`: tài liệu **Cần rà soát** vì tài liệu tầng trên phát hành bản mới làm đổi / bỏ một mã mà nó
//!   tham chiếu (desc §7.4).

use crate::parser::{self, kind_by_key, Occurrence, Role};
use bson::{doc, Bson};
use chillcat_kernel::contracts::*;
use chillcat_kernel::events::kinds;
use chillcat_kernel::*;
use chillcat_platform::mongo::{ensure_indexes, index, now_bson};
use chillcat_platform::EventBus;
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::{Collection, Database};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::sync::Arc;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OccurrenceDoc {
    #[serde(rename = "_id")]
    pub id: TraceRefId,
    pub workspace_id: WorkspaceId,
    pub document_id: DocumentId,
    pub document_code: String,
    pub document_title: String,
    pub type_code: String,
    pub version_id: VersionId,
    pub version: String,
    /// Phiên bản này là bản đang phát hành của tài liệu (còn lại là bản đang soạn).
    pub published: bool,
    pub code: String,
    pub kind: String,
    pub scope: String,
    pub role: Role,
    pub section: String,
    pub section_no: Option<String>,
    pub context_code: Option<String>,
    pub retired_on: Option<String>,
    pub implicit: bool,
    pub provisional: bool,
    pub def_hash: Option<String>,
    pub line: i64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ElementStatus {
    Active,
    Retired,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ElementDoc {
    #[serde(rename = "_id")]
    pub id: TraceElementId,
    pub workspace_id: WorkspaceId,
    pub scope: String,
    pub code: String,
    pub kind: String,
    pub document_id: DocumentId,
    pub document_code: String,
    pub defined_in_version_id: VersionId,
    pub version: String,
    pub section: String,
    pub status: ElementStatus,
    pub def_hash: Option<String>,
    pub retired_note: Option<String>,
    pub retired_at: Option<bson::DateTime>,
    pub first_published_at: bson::DateTime,
    pub updated_at: bson::DateTime,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FlagStatus {
    Open,
    Done,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FlagDoc {
    #[serde(rename = "_id")]
    pub id: ReviewFlagId,
    pub workspace_id: WorkspaceId,
    pub document_id: DocumentId,
    pub document_code: String,
    pub caused_by_document_id: DocumentId,
    pub caused_by_document_code: String,
    pub caused_by_version_id: VersionId,
    pub caused_by_version: String,
    pub element_code: String,
    pub scope: String,
    /// `changed` | `retired`
    pub change: String,
    pub status: FlagStatus,
    pub created_at: bson::DateTime,
    pub done_by: Option<UserId>,
    pub done_at: Option<bson::DateTime>,
}

#[derive(Clone)]
pub struct TraceService {
    pub(crate) occ: Collection<OccurrenceDoc>,
    pub(crate) elements: Collection<ElementDoc>,
    pub(crate) flags: Collection<FlagDoc>,
    pub(crate) bus: EventBus,
    pub(crate) access: Arc<dyn AccessApi>,
    pub(crate) documents: Late<dyn DocumentsApi>,
}

fn issue(level: IssueLevel, code: &str, message: String, trace_code: &str, section: &str) -> TraceIssue {
    TraceIssue {
        level,
        code: code.to_owned(),
        message,
        trace_code: Some(trace_code.to_owned()),
        section: (!section.is_empty()).then(|| section.to_owned()),
    }
}

impl TraceService {
    pub fn new(db: &Database, bus: EventBus, access: Arc<dyn AccessApi>, documents: Late<dyn DocumentsApi>) -> Self {
        TraceService {
            occ: db.collection("trace_occurrences"),
            elements: db.collection("trace_elements"),
            flags: db.collection("review_flags"),
            bus,
            access,
            documents,
        }
    }

    pub async fn ensure_indexes(&self) -> AppResult<()> {
        ensure_indexes(
            &self.occ,
            vec![
                index::plain("occ_ws_code", doc! { "workspace_id": 1, "code": 1 }),
                index::plain("occ_version", doc! { "version_id": 1 }),
                index::plain("occ_document", doc! { "document_id": 1, "published": 1 }),
            ],
        )
        .await?;
        ensure_indexes(
            &self.elements,
            vec![
                index::unique("elements_ws_scope_code", doc! { "workspace_id": 1, "scope": 1, "code": 1 }),
                index::plain("elements_document", doc! { "document_id": 1 }),
            ],
        )
        .await?;
        ensure_indexes(
            &self.flags,
            vec![
                index::plain("flags_ws_status", doc! { "workspace_id": 1, "status": 1 }),
                index::plain("flags_document", doc! { "document_id": 1, "status": 1 }),
            ],
        )
        .await
    }

    fn to_docs(input: &VersionContent, occs: &[Occurrence]) -> Vec<OccurrenceDoc> {
        occs.iter()
            .map(|o| OccurrenceDoc {
                id: TraceRefId::new(),
                workspace_id: input.workspace_id.clone(),
                document_id: input.document_id.clone(),
                document_code: input.document_code.clone(),
                document_title: input.document_title.clone(),
                type_code: input.type_code.clone(),
                version_id: input.version_id.clone(),
                version: input.version.clone(),
                published: false,
                code: o.code.clone(),
                kind: o.kind.to_owned(),
                scope: o.scope.clone(),
                role: o.role,
                section: o.section.clone(),
                section_no: o.section_no.clone(),
                context_code: o.context_code.clone(),
                retired_on: o.retired_on.clone(),
                implicit: o.implicit,
                provisional: o.provisional,
                def_hash: o.def_hash.clone(),
                line: o.line as i64,
            })
            .collect()
    }

    /// Kiểm tra mã của một phiên bản theo sổ mã và bản đang soạn của các tài liệu khác.
    pub(crate) async fn report(&self, input: &VersionContent, parsed: &parser::ParseResult) -> AppResult<TraceReport> {
        let occs = &parsed.occurrences;
        let codes: Vec<&str> = occs.iter().map(|o| o.code.as_str()).collect::<BTreeSet<_>>().into_iter().collect();
        let mut report = TraceReport::default();
        for (code, _) in &parsed.foreign_definitions {
            report.issues.push(issue(
                IssueLevel::Warning,
                "trace.foreign_subsystem",
                format!("{code} mang mã hệ thống con khác với tài liệu này – mã được định nghĩa ở SRS / SDD của hệ thống con đó"),
                code,
                "",
            ));
        }
        if codes.is_empty() {
            return Ok(report);
        }
        let registry: Vec<ElementDoc> =
            self.elements.find(doc! { "workspace_id": &input.workspace_id, "code": { "$in": &codes } }).await?.try_collect().await?;
        let others: Vec<OccurrenceDoc> = self
            .occ
            .find(doc! {
                "workspace_id": &input.workspace_id, "code": { "$in": &codes }, "role": "definition",
                "document_id": { "$ne": &input.document_id },
            })
            .await?
            .try_collect()
            .await?;
        let find_el = |o: &Occurrence| -> Option<&ElementDoc> {
            registry.iter().find(|e| e.code == o.code && (o.scope.is_empty() || e.scope == o.scope || e.scope.is_empty()))
        };
        for o in occs {
            let info = kind_by_key(o.kind);
            match o.role {
                Role::Definition => {
                    report.defined.push(o.code.clone());
                    if let Some(e) = find_el(o) {
                        if e.document_id != input.document_id {
                            report.issues.push(issue(
                                IssueLevel::Error,
                                "trace.duplicate_definition",
                                format!("{} đã được định nghĩa ở {} – mỗi mã chỉ định nghĩa ở một tài liệu", o.code, e.document_code),
                                &o.code,
                                &o.section,
                            ));
                        } else if e.status == ElementStatus::Retired && o.retired_on.is_none() {
                            report.issues.push(issue(
                                IssueLevel::Error,
                                "trace.reused_retired",
                                format!(
                                    "{} đã bỏ ({}) – mã đã cấp không được dùng lại, hãy cấp mã mới",
                                    o.code,
                                    e.retired_note.clone().unwrap_or_default()
                                ),
                                &o.code,
                                &o.section,
                            ));
                        }
                    } else if let Some(other) = others.iter().find(|x| x.code == o.code && x.scope == o.scope) {
                        report.issues.push(issue(
                            IssueLevel::Warning,
                            "trace.duplicate_definition_draft",
                            format!("{} cũng đang được định nghĩa trong bản dự thảo của {}", o.code, other.document_code),
                            &o.code,
                            &o.section,
                        ));
                    }
                }
                Role::Reference => {
                    report.referenced.push(o.code.clone());
                    match find_el(o) {
                        Some(e) if e.status == ElementStatus::Retired => report.issues.push(issue(
                            IssueLevel::Warning,
                            "trace.retired_reference",
                            format!("{} đã bỏ ở {} – cập nhật lại tham chiếu", o.code, e.document_code),
                            &o.code,
                            &o.section,
                        )),
                        Some(_) => {}
                        None => {
                            let draft = others.iter().find(|x| x.code == o.code && (o.scope.is_empty() || x.scope == o.scope));
                            if let Some(d) = draft {
                                report.issues.push(issue(
                                    IssueLevel::Info,
                                    "trace.unpublished_reference",
                                    format!("{} mới có trong bản dự thảo của {} – chưa phát hành", o.code, d.document_code),
                                    &o.code,
                                    &o.section,
                                ));
                            } else if !info.is_some_and(|i| i.weak) {
                                report.issues.push(issue(
                                    IssueLevel::Warning,
                                    "trace.unknown_reference",
                                    format!("{} chưa được định nghĩa ở tài liệu nào trong workspace", o.code),
                                    &o.code,
                                    &o.section,
                                ));
                            }
                        }
                    }
                }
            }
        }
        report.defined.dedup();
        report.referenced.sort();
        report.referenced.dedup();
        Ok(report)
    }

    /// Bản mới được phát hành: cập nhật sổ mã, đánh dấu Cần rà soát các tài liệu tham chiếu mã bị đổi / bỏ.
    pub async fn on_published(&self, ev: &DomainEvent) -> AppResult<()> {
        let d = &ev.data;
        let s = |k: &str| d.get(k).and_then(|v| v.as_str()).map(str::to_owned);
        let (Some(doc_id), Some(version_id), Some(ws)) = (s("document_id"), s("version_id"), ev.workspace_id.clone()) else {
            return Ok(());
        };
        let (doc_id, version_id) = (DocumentId::from(doc_id), VersionId::from(version_id));
        let doc_code = s("code").unwrap_or_default();
        let version = s("version").unwrap_or_default();

        // 1. Chỉ mục: bản mới thành bản phát hành; bỏ chỉ mục của bản phát hành trước.
        self.occ.delete_many(doc! { "document_id": &doc_id, "published": true, "version_id": { "$ne": &version_id } }).await?;
        self.occ.update_many(doc! { "version_id": &version_id }, doc! { "$set": { "published": true } }).await?;

        // 2. So sánh định nghĩa mới với sổ mã.
        let defs: Vec<OccurrenceDoc> = self.occ.find(doc! { "version_id": &version_id, "role": "definition" }).await?.try_collect().await?;
        let mine: Vec<ElementDoc> = self.elements.find(doc! { "document_id": &doc_id }).await?.try_collect().await?;
        let now = now_bson();
        let mut changes: Vec<(String, String, &'static str)> = Vec::new(); // (scope, code, change)
        let mut upserts: Vec<ElementDoc> = Vec::new();
        for o in &defs {
            let existing = self.elements.find_one(doc! { "workspace_id": &ws, "scope": &o.scope, "code": &o.code }).await?;
            let retired = o.retired_on.is_some();
            match existing {
                Some(e) if e.document_id != doc_id => {
                    tracing::warn!(code = %o.code, owner = %e.document_code, by = %doc_code, "Bỏ qua định nghĩa trùng khi phát hành");
                }
                Some(mut e) => {
                    let was_active = e.status == ElementStatus::Active;
                    if retired && was_active {
                        changes.push((o.scope.clone(), o.code.clone(), "retired"));
                    } else if was_active && e.def_hash.is_some() && e.def_hash != o.def_hash {
                        changes.push((o.scope.clone(), o.code.clone(), "changed"));
                    }
                    e.defined_in_version_id = version_id.clone();
                    e.version = version.clone();
                    e.section = o.section.clone();
                    e.def_hash = o.def_hash.clone();
                    e.document_code = doc_code.clone();
                    if retired && was_active {
                        e.status = ElementStatus::Retired;
                        e.retired_at = Some(now);
                        e.retired_note = Some(format!("Bỏ từ {} – {}", o.retired_on.clone().unwrap_or_default(), doc_code));
                    }
                    e.updated_at = now;
                    upserts.push(e);
                }
                None => upserts.push(ElementDoc {
                    id: TraceElementId::new(),
                    workspace_id: ws.clone(),
                    scope: o.scope.clone(),
                    code: o.code.clone(),
                    kind: o.kind.clone(),
                    document_id: doc_id.clone(),
                    document_code: doc_code.clone(),
                    defined_in_version_id: version_id.clone(),
                    version: version.clone(),
                    section: o.section.clone(),
                    status: if retired { ElementStatus::Retired } else { ElementStatus::Active },
                    def_hash: o.def_hash.clone(),
                    retired_note: retired.then(|| format!("Bỏ từ {} – {}", o.retired_on.clone().unwrap_or_default(), doc_code)),
                    retired_at: retired.then_some(now),
                    first_published_at: now,
                    updated_at: now,
                }),
            }
        }
        // Mã của tài liệu không còn trong bản mới ⇒ đã bỏ.
        let new_codes: HashSet<(String, String)> = defs.iter().map(|o| (o.scope.clone(), o.code.clone())).collect();
        for mut e in mine {
            if e.status == ElementStatus::Active && !new_codes.contains(&(e.scope.clone(), e.code.clone())) {
                changes.push((e.scope.clone(), e.code.clone(), "retired"));
                e.status = ElementStatus::Retired;
                e.retired_at = Some(now);
                e.retired_note = Some(format!("Không còn trong {doc_code} bản {version}"));
                e.updated_at = now;
                upserts.push(e);
            }
        }

        // 3. Cờ Cần rà soát (ghi trước khi cập nhật sổ mã để lần chạy lại không làm mất cờ).
        let mut flagged: BTreeMap<DocumentId, (String, Vec<String>)> = BTreeMap::new();
        for (scope, code, change) in &changes {
            let mut filter = doc! {
                "workspace_id": &ws, "code": code, "role": "reference", "document_id": { "$ne": &doc_id },
            };
            if !scope.is_empty() {
                filter.insert("scope", doc! { "$in": [scope, ""] });
            }
            let refs: Vec<OccurrenceDoc> = self.occ.find(filter).await?.try_collect().await?;
            let docs: BTreeMap<DocumentId, String> = refs.into_iter().map(|r| (r.document_id, r.document_code)).collect();
            for (target, target_code) in docs {
                let open = self.flags.count_documents(doc! { "document_id": &target, "element_code": code, "status": "open" }).await?;
                if open == 0 {
                    self.flags
                        .insert_one(FlagDoc {
                            id: ReviewFlagId::new(),
                            workspace_id: ws.clone(),
                            document_id: target.clone(),
                            document_code: target_code.clone(),
                            caused_by_document_id: doc_id.clone(),
                            caused_by_document_code: doc_code.clone(),
                            caused_by_version_id: version_id.clone(),
                            caused_by_version: version.clone(),
                            element_code: code.clone(),
                            scope: scope.clone(),
                            change: (*change).to_owned(),
                            status: FlagStatus::Open,
                            created_at: now,
                            done_by: None,
                            done_at: None,
                        })
                        .await?;
                }
                flagged.entry(target).or_insert_with(|| (target_code, Vec::new())).1.push(format!("{code} ({change})"));
            }
        }
        for e in upserts {
            self.elements
                .replace_one(doc! { "workspace_id": &e.workspace_id, "scope": &e.scope, "code": &e.code }, &e)
                .upsert(true)
                .await?;
        }
        if !flagged.is_empty() {
            self.bus
                .publish(
                    DomainEvent::new(kinds::TRACE_REVIEW_FLAGS_RAISED, "document", doc_id.as_str())
                        .workspace(&ws)
                        .data(json!({
                            "caused_by_document_id": doc_id, "caused_by_code": doc_code, "caused_by_version": version,
                            "documents": flagged.iter().map(|(id, (code, items))| json!({ "document_id": id, "code": code, "items": items })).collect::<Vec<_>>(),
                        })),
                )
                .await?;
        }
        Ok(())
    }

    // ------------------------------------------------------------ truy vấn

    pub(crate) async fn require_member(&self, p: &Principal, ws: &WorkspaceId) -> AppResult<()> {
        let a = self.access.workspace_access(&p.user_id, ws).await?;
        if a.is_some_and(|a| a.is_member()) {
            Ok(())
        } else {
            Err(AppError::not_found("workspace.not_found", "Không tìm thấy workspace, hoặc bạn không phải thành viên"))
        }
    }

    async fn visible(&self, p: &Principal, ws: &WorkspaceId) -> AppResult<HashSet<VersionId>> {
        Ok(self.documents.get()?.visible_version_ids(&p.user_id, ws).await?.into_iter().collect())
    }

    /// Mọi mã trong workspace mà người gọi được thấy (từ những phiên bản họ được xem).
    pub async fn list_elements(&self, p: &Principal, ws: &WorkspaceId, q: ElementQuery) -> AppResult<Vec<ElementDto>> {
        self.require_member(p, ws).await?;
        let visible = self.visible(p, ws).await?;
        let mut filter = doc! { "workspace_id": ws };
        if let Some(k) = q.kind.as_deref().filter(|k| !k.is_empty()) {
            filter.insert("kind", k);
        }
        if let Some(t) = q.q.as_deref().map(str::trim).filter(|t| !t.is_empty()) {
            filter.insert("code", Bson::RegularExpression(bson::Regex { pattern: regex::escape(t), options: "i".into() }));
        }
        let occs: Vec<OccurrenceDoc> = self.occ.find(filter.clone()).await?.try_collect().await?;
        let occs: Vec<OccurrenceDoc> = occs.into_iter().filter(|o| visible.contains(&o.version_id)).collect();
        let registry: Vec<ElementDoc> = self.elements.find(filter).await?.try_collect().await?;

        let mut out: BTreeMap<(String, String), ElementDto> = BTreeMap::new();
        for e in registry.iter().filter(|e| visible.contains(&e.defined_in_version_id)) {
            out.insert((e.scope.clone(), e.code.clone()), ElementDto::from_registry(e));
        }
        for o in occs.iter().filter(|o| o.role == Role::Definition) {
            out.entry((o.scope.clone(), o.code.clone())).or_insert_with(|| ElementDto::from_draft(o));
        }
        for o in occs.iter().filter(|o| o.role == Role::Reference) {
            let key = out.keys().find(|(s, c)| *c == o.code && (o.scope.is_empty() || *s == o.scope || s.is_empty())).cloned();
            let key = key.unwrap_or_else(|| (o.scope.clone(), o.code.clone()));
            let e = out.entry(key).or_insert_with(|| ElementDto::undefined(o));
            if !e.referenced_by.contains(&o.document_code) {
                e.referenced_by.push(o.document_code.clone());
            }
            e.ref_count += 1;
        }
        Ok(out.into_values().collect())
    }

    /// Nơi định nghĩa và mọi nơi tham chiếu một mã.
    pub async fn element_detail(&self, p: &Principal, ws: &WorkspaceId, code: &str, scope: Option<&str>) -> AppResult<ElementDetailDto> {
        self.require_member(p, ws).await?;
        let visible = self.visible(p, ws).await?;
        let occs: Vec<OccurrenceDoc> = self.occ.find(doc! { "workspace_id": ws, "code": code }).await?.try_collect().await?;
        let occs: Vec<OccurrenceDoc> = occs
            .into_iter()
            .filter(|o| visible.contains(&o.version_id) && scope.is_none_or(|s| o.scope == s || o.scope.is_empty()))
            .collect();
        let element = self
            .elements
            .find_one(doc! { "workspace_id": ws, "code": code })
            .await?
            .filter(|e| visible.contains(&e.defined_in_version_id) && scope.is_none_or(|s| e.scope == s));
        if occs.is_empty() && element.is_none() {
            return Err(AppError::not_found("trace.not_found", format!("Không thấy mã {code}")));
        }
        let info = kind_by_key(occs.first().map(|o| o.kind.as_str()).or(element.as_ref().map(|e| e.kind.as_str())).unwrap_or(""));
        Ok(ElementDetailDto {
            code: code.to_owned(),
            kind_name: info.map(|i| i.name_vi.to_owned()),
            element: element.as_ref().map(ElementDto::from_registry),
            occurrences: occs.iter().map(OccurrenceDto::from).collect(),
        })
    }

    pub async fn list_flags(&self, p: &Principal, ws: &WorkspaceId, status: Option<FlagStatus>) -> AppResult<Vec<FlagDto>> {
        self.require_member(p, ws).await?;
        let mut filter = doc! { "workspace_id": ws };
        filter.insert("status", bson::to_bson(&status.unwrap_or(FlagStatus::Open))?);
        let flags: Vec<FlagDoc> = self.flags.find(filter).sort(doc! { "_id": -1 }).limit(500).await?.try_collect().await?;
        let docs = self.documents.get()?;
        let mut out = Vec::new();
        for f in flags {
            if docs.doc_perms(&p.user_id, &f.document_id).await?.is_some_and(|d| d.view) {
                out.push(FlagDto::from(&f));
            }
        }
        Ok(out)
    }

    /// Đánh dấu đã rà soát – người có quyền sửa tài liệu bị đánh dấu.
    pub async fn resolve_flag(&self, p: &Principal, id: &ReviewFlagId) -> AppResult<FlagDto> {
        let f = self
            .flags
            .find_one(doc! { "_id": id })
            .await?
            .ok_or_else(|| AppError::not_found("trace.flag_not_found", "Không tìm thấy đánh dấu"))?;
        let perms = self.documents.get()?.doc_perms(&p.user_id, &f.document_id).await?;
        match perms {
            None => return Err(AppError::not_found("trace.flag_not_found", "Không tìm thấy đánh dấu")),
            Some(d) if !d.view => return Err(AppError::not_found("trace.flag_not_found", "Không tìm thấy đánh dấu")),
            Some(d) if !d.edit => return Err(AppError::forbidden("trace.flag_forbidden", "Cần quyền sửa tài liệu để xác nhận đã rà soát")),
            _ => {}
        }
        self.flags
            .update_one(doc! { "_id": id }, doc! { "$set": { "status": "done", "done_by": &p.user_id, "done_at": now_bson() } })
            .await?;
        self.bus
            .publish(
                DomainEvent::new(kinds::TRACE_REVIEW_FLAG_DONE, "document", f.document_id.as_str())
                    .workspace(&f.workspace_id)
                    .actor(&p.user_id)
                    .data(json!({ "flag_id": id, "code": f.document_code, "element_code": f.element_code }))
                    .audit(),
            )
            .await?;
        let f = self.flags.find_one(doc! { "_id": id }).await?.ok_or_else(|| AppError::internal("flag biến mất"))?;
        Ok(FlagDto::from(&f))
    }
}

// --------------------------------------------------------------------- DTO

#[derive(Clone, Debug, Default, Deserialize)]
pub struct ElementQuery {
    pub q: Option<String>,
    pub kind: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct ElementDto {
    pub code: String,
    pub kind: String,
    pub kind_name: Option<String>,
    pub scope: String,
    /// `active` (đã phát hành) · `retired` (đã bỏ) · `draft` (mới có trong bản đang soạn) · `undefined` (chỉ được tham chiếu).
    pub status: String,
    pub document_id: Option<DocumentId>,
    pub document_code: Option<String>,
    pub version: Option<String>,
    pub section: Option<String>,
    pub retired_note: Option<String>,
    pub provisional: bool,
    pub ref_count: u32,
    pub referenced_by: Vec<String>,
}

impl ElementDto {
    fn from_registry(e: &ElementDoc) -> Self {
        ElementDto {
            code: e.code.clone(),
            kind: e.kind.clone(),
            kind_name: kind_by_key(&e.kind).map(|i| i.name_vi.to_owned()),
            scope: e.scope.clone(),
            status: match e.status {
                ElementStatus::Active => "active",
                ElementStatus::Retired => "retired",
            }
            .into(),
            document_id: Some(e.document_id.clone()),
            document_code: Some(e.document_code.clone()),
            version: Some(e.version.clone()),
            section: Some(e.section.clone()),
            retired_note: e.retired_note.clone(),
            provisional: false,
            ref_count: 0,
            referenced_by: vec![],
        }
    }
    fn from_draft(o: &OccurrenceDoc) -> Self {
        ElementDto {
            code: o.code.clone(),
            kind: o.kind.clone(),
            kind_name: kind_by_key(&o.kind).map(|i| i.name_vi.to_owned()),
            scope: o.scope.clone(),
            status: "draft".into(),
            document_id: Some(o.document_id.clone()),
            document_code: Some(o.document_code.clone()),
            version: Some(o.version.clone()),
            section: Some(o.section.clone()),
            retired_note: None,
            provisional: o.provisional,
            ref_count: 0,
            referenced_by: vec![],
        }
    }
    fn undefined(o: &OccurrenceDoc) -> Self {
        ElementDto {
            code: o.code.clone(),
            kind: o.kind.clone(),
            kind_name: kind_by_key(&o.kind).map(|i| i.name_vi.to_owned()),
            scope: o.scope.clone(),
            status: "undefined".into(),
            document_id: None,
            document_code: None,
            version: None,
            section: None,
            retired_note: None,
            provisional: false,
            ref_count: 0,
            referenced_by: vec![],
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct OccurrenceDto {
    pub document_id: DocumentId,
    pub document_code: String,
    pub document_title: String,
    pub version: String,
    pub published: bool,
    pub role: Role,
    pub scope: String,
    pub section: String,
    pub section_no: Option<String>,
    pub context_code: Option<String>,
    pub retired_on: Option<String>,
    pub implicit: bool,
    pub line: i64,
}

impl From<&OccurrenceDoc> for OccurrenceDto {
    fn from(o: &OccurrenceDoc) -> Self {
        OccurrenceDto {
            document_id: o.document_id.clone(),
            document_code: o.document_code.clone(),
            document_title: o.document_title.clone(),
            version: o.version.clone(),
            published: o.published,
            role: o.role,
            scope: o.scope.clone(),
            section: o.section.clone(),
            section_no: o.section_no.clone(),
            context_code: o.context_code.clone(),
            retired_on: o.retired_on.clone(),
            implicit: o.implicit,
            line: o.line,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct ElementDetailDto {
    pub code: String,
    pub kind_name: Option<String>,
    pub element: Option<ElementDto>,
    pub occurrences: Vec<OccurrenceDto>,
}

#[derive(Clone, Debug, Serialize)]
pub struct FlagDto {
    pub id: ReviewFlagId,
    pub document_id: DocumentId,
    pub document_code: String,
    pub caused_by_document_id: DocumentId,
    pub caused_by_document_code: String,
    pub caused_by_version: String,
    pub element_code: String,
    pub change: String,
    pub status: FlagStatus,
    pub created_at: DateTime<Utc>,
    pub done_by: Option<UserId>,
    pub done_at: Option<DateTime<Utc>>,
}

impl From<&FlagDoc> for FlagDto {
    fn from(f: &FlagDoc) -> Self {
        FlagDto {
            id: f.id.clone(),
            document_id: f.document_id.clone(),
            document_code: f.document_code.clone(),
            caused_by_document_id: f.caused_by_document_id.clone(),
            caused_by_document_code: f.caused_by_document_code.clone(),
            caused_by_version: f.caused_by_version.clone(),
            element_code: f.element_code.clone(),
            change: f.change.clone(),
            status: f.status,
            created_at: f.created_at.to_chrono(),
            done_by: f.done_by.clone(),
            done_at: f.done_at.map(|d| d.to_chrono()),
        }
    }
}

// ------------------------------------------------------------ hợp đồng

#[async_trait::async_trait]
impl TraceApi for TraceService {
    async fn index_version(&self, input: &VersionContent) -> AppResult<TraceReport> {
        let parsed = parser::parse(&input.content, &input.type_code, input.subsystem_code.as_deref());
        self.occ.delete_many(doc! { "version_id": &input.version_id }).await?;
        let docs = Self::to_docs(input, &parsed.occurrences);
        if !docs.is_empty() {
            self.occ.insert_many(docs).await?;
        }
        self.report(input, &parsed).await
    }

    async fn lint(&self, input: &VersionContent) -> AppResult<TraceReport> {
        let parsed = parser::parse(&input.content, &input.type_code, input.subsystem_code.as_deref());
        self.report(input, &parsed).await
    }

    async fn forget_version(&self, version: &VersionId) -> AppResult<()> {
        self.occ.delete_many(doc! { "version_id": version }).await?;
        Ok(())
    }

    async fn forget_document(&self, document: &DocumentId) -> AppResult<()> {
        self.occ.delete_many(doc! { "document_id": document }).await?;
        self.flags.delete_many(doc! { "document_id": document }).await?;
        Ok(())
    }

    async fn elements_in_text(&self, workspace: &WorkspaceId, text: &str) -> AppResult<Vec<TraceElementBrief>> {
        let codes = parser::codes_in_text(text);
        if codes.is_empty() {
            return Ok(vec![]);
        }
        let reg: Vec<ElementDoc> =
            self.elements.find(doc! { "workspace_id": workspace, "code": { "$in": &codes } }).await?.try_collect().await?;
        let mut out: Vec<TraceElementBrief> = reg
            .iter()
            .map(|e| TraceElementBrief {
                code: e.code.clone(),
                kind: e.kind.clone(),
                document_id: e.document_id.clone(),
                document_code: e.document_code.clone(),
                status: if e.status == ElementStatus::Active { "active" } else { "retired" }.into(),
            })
            .collect();
        let drafts: Vec<OccurrenceDoc> = self
            .occ
            .find(doc! { "workspace_id": workspace, "code": { "$in": &codes }, "role": "definition", "published": false })
            .await?
            .try_collect()
            .await?;
        for o in drafts {
            if !out.iter().any(|e| e.code == o.code) {
                out.push(TraceElementBrief {
                    code: o.code,
                    kind: o.kind,
                    document_id: o.document_id,
                    document_code: o.document_code,
                    status: "draft".into(),
                });
            }
        }
        Ok(out)
    }

    async fn documents_using(&self, workspace: &WorkspaceId, codes: &[String]) -> AppResult<Vec<DocumentId>> {
        if codes.is_empty() {
            return Ok(vec![]);
        }
        let ids = self.occ.distinct("document_id", doc! { "workspace_id": workspace, "code": { "$in": codes } }).await?;
        Ok(ids.into_iter().filter_map(|b| b.as_str().map(DocumentId::from)).collect())
    }
}

/// Nghe sự kiện phát hành của module documents.
pub struct PublishedHandler(pub Arc<TraceService>);

#[async_trait::async_trait]
impl EventHandler for PublishedHandler {
    fn name(&self) -> &'static str {
        "traceability.on_published"
    }
    fn interested_in(&self, kind: &str) -> bool {
        kind == kinds::VERSION_PUBLISHED
    }
    async fn handle(&self, event: &DomainEvent) -> AppResult<()> {
        self.0.on_published(event).await
    }
}
