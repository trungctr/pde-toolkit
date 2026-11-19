//! Chạy AI cho ticket (desc §5.4 bước 2–6). Mọi lần chạy gắn với một người (uỷ quyền tự động hoặc kích hoạt thủ
//! công) phải có **cả** quyền xem và xử lý ticket; dữ liệu AI thấy = dữ liệu người đó được xem **tại lúc chạy**.
//! Kết quả chỉ là gợi ý: AI không tự đóng, gộp ticket, không sửa hay phát hành tài liệu.

use crate::ai::keyword;
use crate::model::*;
use crate::service::{TicketAccess, TicketService};
use bson::{doc, Bson};
use chillcat_kernel::contracts::DocumentBrief;
use chillcat_kernel::events::kinds;
use chillcat_kernel::*;
use chillcat_platform::mongo::{now_bson, with_txn};
use futures::TryStreamExt;
use serde_json::{json, Value};
use std::sync::Arc;

const MAX_CANDIDATE_POOL: i64 = 200;
const MAX_DOCS: usize = 5;
const EXCERPT_CHARS: usize = 6000;

fn clip(s: &str, n: usize) -> String {
    if s.chars().count() <= n {
        s.to_owned()
    } else {
        format!("{}…", s.chars().take(n).collect::<String>())
    }
}

fn ticket_text(t: &TicketDoc) -> String {
    let mut s =
        format!("Loại: {}\nTiêu đề: {}\nMô tả: {}", if t.kind == TicketKind::Bug { "Báo lỗi" } else { "Góp ý tính năng" }, t.title, t.body);
    for (k, v) in [
        ("Bước tái hiện", &t.reproduction_steps),
        ("Kết quả thực tế", &t.actual_result),
        ("Kết quả mong đợi", &t.expected_result),
        ("Môi trường", &t.environment),
        ("Phiên bản phần mềm", &t.software_version),
    ] {
        if let Some(v) = v {
            s.push_str(&format!("\n{k}: {v}"));
        }
    }
    s
}

/// Các mục (theo tiêu đề) của tài liệu chứa mã truy vết / từ khoá – trích để gửi AI. Mã nặng gấp 5 lần từ khoá.
fn excerpt(content: &str, codes: &[String], words: &[String], max: usize) -> Vec<(String, String)> {
    let mut sections: Vec<(String, String)> = Vec::new();
    let mut cur = (String::new(), String::new());
    for line in content.lines() {
        if line.starts_with("<!-- de-diagram:") || line.starts_with("<div align=\"center\"><svg") {
            continue;
        }
        if line.starts_with('#') {
            if !cur.1.trim().is_empty() || !cur.0.is_empty() {
                sections.push(std::mem::take(&mut cur));
            }
            cur.0 = line.trim_start_matches('#').trim().to_owned();
        } else {
            cur.1.push_str(line);
            cur.1.push('\n');
        }
    }
    sections.push(cur);
    let folded: Vec<String> = words.iter().map(|n| keyword::fold(n)).collect();
    let mut scored: Vec<(usize, (String, String))> = sections
        .into_iter()
        .map(|(h, b)| {
            let raw = format!("{h}\n{b}");
            let text = keyword::fold(&raw);
            let score =
                5 * codes.iter().filter(|c| raw.contains(c.as_str())).count() + folded.iter().filter(|n| text.contains(n.as_str())).count();
            (score, (h, b))
        })
        .filter(|(s, _)| *s > 0)
        .collect();
    scored.sort_by_key(|(s, _)| std::cmp::Reverse(*s));
    let mut out = Vec::new();
    let mut used = 0;
    for (_, (h, b)) in scored {
        if used >= max {
            break;
        }
        let b = clip(b.trim(), (max - used).max(200));
        used += b.len() + h.len();
        out.push((h, b));
    }
    out
}

impl TicketService {
    /// Kích hoạt thủ công (người gọi phải có quyền xem + xử lý).
    pub async fn trigger(self: &Arc<Self>, p: &Principal, id: &TicketId, purpose: CheckPurpose) -> AppResult<TicketDetailDto> {
        let (t, _) = self.processable(p, id).await?;
        let pending =
            self.c.checks.count_documents(doc! { "ticket_id": id, "purpose": bson::to_bson(&purpose)?, "status": "pending" }).await?;
        if pending > 0 {
            return Err(AppError::conflict("ticket.check_running", "AI đang chạy cho ticket này – đợi kết quả"));
        }
        let check = self.new_check(&t, &p.user_id, purpose, "manual").await?;
        self.spawn(check);
        self.detail(p, id).await
    }

    pub(crate) async fn new_check(&self, t: &TicketDoc, acting: &UserId, purpose: CheckPurpose, mode: &str) -> AppResult<CheckDoc> {
        let c = CheckDoc {
            id: AiCheckId::new(),
            ticket_id: t.id.clone(),
            workspace_id: t.workspace_id.clone(),
            purpose,
            acting_user_id: acting.clone(),
            trigger_mode: mode.to_owned(),
            engine: if self.ai.is_some() { "ai" } else { "keyword" }.into(),
            status: CheckStatus::Pending,
            result: None,
            checked_scope: String::new(),
            note: None,
            previous_status: Some(t.status),
            created_at: now_bson(),
            completed_at: None,
        };
        self.c.checks.insert_one(&c).await?;
        if purpose == CheckPurpose::Duplicates && matches!(t.status, TicketStatus::New | TicketStatus::Reviewing) {
            self.c.tickets.update_one(doc! { "_id": &t.id }, doc! { "$set": { "status": "checking" } }).await?;
        }
        Ok(c)
    }

    /// Chạy nền (AI có thể mất vài phút). Lần chạy treo được tác vụ định kỳ đánh dấu thất bại.
    pub(crate) fn spawn(self: &Arc<Self>, check: CheckDoc) {
        let svc = self.clone();
        tokio::spawn(async move {
            if let Err(e) = svc.run(&check).await {
                tracing::error!(check = %check.id, error = %e, "Chạy AI cho ticket thất bại");
                let _ = svc.finish(&check, CheckStatus::Failed, None, String::new(), Some(e.message.clone())).await;
            }
        });
    }

    pub async fn run(&self, check: &CheckDoc) -> AppResult<()> {
        let t = self.ticket(&check.ticket_id).await?;
        let a = self.ticket_access(&check.acting_user_id, &t.workspace_id).await?;
        if !a.can_process(&t) {
            return self
                .finish(
                    check,
                    CheckStatus::InsufficientAccess,
                    None,
                    String::new(),
                    Some("Người mà AI thay mặt không còn đủ quyền xem và xử lý ticket".into()),
                )
                .await;
        }
        match check.purpose {
            CheckPurpose::Duplicates => self.run_duplicates(check, &t, &a).await,
            CheckPurpose::Proposals => self.run_proposals(check, &t, &a).await,
        }
    }

    pub(crate) async fn finish(
        &self,
        check: &CheckDoc,
        status: CheckStatus,
        result: Option<CheckResult>,
        scope: String,
        note: Option<String>,
    ) -> AppResult<()> {
        if check.purpose == CheckPurpose::Duplicates {
            // Thành công ⇒ ticket sang Đang xem xét; thất bại ⇒ trả trạng thái cũ (thất bại không phải "không trùng").
            // Cập nhật ticket trước: ai thấy lần chạy đã xong thì cũng thấy trạng thái ticket mới.
            let back =
                if status == CheckStatus::Completed { TicketStatus::Reviewing } else { check.previous_status.unwrap_or(TicketStatus::New) };
            self.c
                .tickets
                .update_one(doc! { "_id": &check.ticket_id, "status": "checking" }, doc! { "$set": { "status": bson::to_bson(&back)? } })
                .await?;
        }
        let r = self
            .c
            .checks
            .update_one(
                doc! { "_id": &check.id, "status": "pending" },
                doc! { "$set": {
                    "status": bson::to_bson(&status)?, "result": bson::to_bson(&result)?, "checked_scope": &scope,
                    "note": note.clone(), "completed_at": now_bson(),
                } },
            )
            .await?;
        if r.modified_count == 0 {
            return Ok(()); // đã kết thúc trước đó (ví dụ bị đánh dấu quá giờ)
        }
        let what = if check.purpose == CheckPurpose::Duplicates { "Kiểm tra trùng" } else { "Đề xuất sửa tài liệu" };
        let text = match (status, result) {
            (CheckStatus::Completed, Some(CheckResult::CandidatesFound)) => format!("{what}: có kết quả cần xem xét"),
            (CheckStatus::Completed, _) => format!("{what}: không tìm thấy trong phạm vi đã kiểm tra"),
            (CheckStatus::InsufficientAccess, _) => format!("{what}: không đủ quyền để chạy"),
            _ => format!("{what}: thất bại – {}", note.clone().unwrap_or_default()),
        };
        self.log(&check.ticket_id, None, "ai", text).await?;
        let t = self.ticket(&check.ticket_id).await?;
        self.bus
            .publish(
                DomainEvent::new(kinds::TICKET_AI_CHECK_COMPLETED, "ticket", check.ticket_id.as_str())
                    .workspace(&check.workspace_id)
                    .data(json!({ "ticket_id": t.id, "number": t.number, "title": t.title, "purpose": check.purpose, "status": status, "result": result }))
                    .notify([check.acting_user_id.clone()]),
            )
            .await
    }

    async fn run_duplicates(&self, check: &CheckDoc, t: &TicketDoc, a: &TicketAccess) -> AppResult<()> {
        let mut filter = a.view_filter();
        filter.insert("_id", doc! { "$ne": &t.id });
        let pool: Vec<TicketDoc> =
            self.c.tickets.find(filter).sort(doc! { "number": -1 }).limit(MAX_CANDIDATE_POOL).await?.try_collect().await?;
        let pool: Vec<TicketDoc> = pool.into_iter().filter(|x| a.can_view(x)).collect();
        let who = self.identity.user(&check.acting_user_id).await?.map(|u| u.display_name).unwrap_or_default();
        let scope = format!(
            "So với {} ticket trong workspace (mới nhất, tối đa {MAX_CANDIDATE_POOL}, kể cả ticket đã xử lý) mà {who} được xem; bộ so: {}",
            pool.len(),
            if self.ai.is_some() { "AI" } else { "so khớp từ khoá" }
        );
        let found: Vec<(TicketId, String, f64)> = match &self.ai {
            Some(ai) if !pool.is_empty() => {
                let keys: Vec<String> = (1..=pool.len()).map(|i| format!("T{i}")).collect();
                let list = pool
                    .iter()
                    .zip(&keys)
                    .map(|(c, k)| format!("[{k}] #{} ({}) {}\n{}", c.number, c.status.label_vi(), c.title, clip(&c.body, 600)))
                    .collect::<Vec<_>>()
                    .join("\n\n");
                let prompt = format!("Ticket mới:\n{}\n\nCác ticket có sẵn:\n\n{list}", clip(&ticket_text(t), 4000));
                let schema = json!({
                    "type": "object", "additionalProperties": false, "required": ["duplicates"],
                    "properties": { "duplicates": { "type": "array", "items": {
                        "type": "object", "additionalProperties": false, "required": ["candidate", "confidence", "reason"],
                        "properties": {
                            "candidate": { "type": "string", "enum": keys },
                            "confidence": { "type": "string", "enum": ["high", "medium", "low"] },
                            "reason": { "type": "string" },
                        },
                    } } },
                });
                let system = "Bạn hỗ trợ đội phát triển phần mềm phân loại ticket góp ý tính năng và báo lỗi. \
                    So sánh ticket mới với danh sách ticket có sẵn và chỉ ra những ticket mô tả cùng một nhu cầu hoặc cùng một lỗi. \
                    Chỉ liệt kê khi có căn cứ rõ ràng; ticket chỉ cùng chủ đề chung chung thì không tính là trùng. \
                    Lý do viết bằng tiếng Việt, một hai câu, nêu điểm giống nhau cụ thể.";
                let v = ai.json(system, &prompt, schema, "medium").await?;
                let score = |c: &str| match c {
                    "high" => 0.9,
                    "medium" => 0.6,
                    _ => 0.3,
                };
                v["duplicates"]
                    .as_array()
                    .cloned()
                    .unwrap_or_default()
                    .iter()
                    .filter_map(|d| {
                        let idx = keys.iter().position(|k| Some(k.as_str()) == d["candidate"].as_str())?;
                        Some((
                            pool[idx].id.clone(),
                            d["reason"].as_str().unwrap_or("").to_owned(),
                            score(d["confidence"].as_str().unwrap_or("low")),
                        ))
                    })
                    .collect()
            }
            _ => {
                let mut scored: Vec<(TicketId, String, f64)> = pool
                    .iter()
                    .map(|c| {
                        let s = keyword::similarity(&t.title, &t.body, &c.title, &c.body) + if c.kind == t.kind { 0.03 } else { 0.0 };
                        let words = keyword::shared_words(&format!("{} {}", t.title, t.body), &format!("{} {}", c.title, c.body), 5);
                        (c.id.clone(), format!("Trùng nhiều từ khoá: {}", words.join(", ")), (s * 100.0).round() / 100.0)
                    })
                    .filter(|(_, _, s)| *s >= 0.3)
                    .collect();
                scored.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));
                scored.truncate(5);
                scored
            }
        };
        for (cid, reason, score) in &found {
            self.c
                .candidates
                .insert_one(CandidateDoc {
                    id: DuplicateCandidateId::new(),
                    check_id: check.id.clone(),
                    ticket_id: t.id.clone(),
                    candidate_ticket_id: cid.clone(),
                    reason: reason.clone(),
                    score: *score,
                    decision: CandidateDecision::Suggested,
                    decided_by: None,
                    decided_at: None,
                })
                .await?;
        }
        let result = if found.is_empty() { CheckResult::NoneFound } else { CheckResult::CandidatesFound };
        self.finish(check, CheckStatus::Completed, Some(result), scope, None).await
    }

    async fn run_proposals(&self, check: &CheckDoc, t: &TicketDoc, _a: &TicketAccess) -> AppResult<()> {
        let acting = &check.acting_user_id;
        let viewable: Vec<DocumentBrief> = self.documents.viewable_published(acting, &t.workspace_id).await?;
        let text = ticket_text(t);
        let elements = self.trace.elements_in_text(&t.workspace_id, &text).await?;
        let codes: Vec<String> = elements.iter().map(|e| e.code.clone()).collect();
        let using = self.trace.documents_using(&t.workspace_id, &codes).await?;
        let tokens = keyword::tokens(&format!("{} {}", t.title, t.body));
        // Xếp hạng tài liệu: nhắc tới mã trong ticket > trùng từ khoá với tên tài liệu.
        let mut ranked: Vec<(f64, &DocumentBrief)> = viewable
            .iter()
            .filter(|d| !d.archived)
            .map(|d| {
                let by_code = if using.contains(&d.id) { 1.0 } else { 0.0 };
                let words = keyword::tokens(&d.title).intersection(&tokens).count() as f64 * 0.2;
                (by_code + words, d)
            })
            .filter(|(s, _)| *s > 0.0)
            .collect();
        ranked.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        ranked.truncate(MAX_DOCS);
        let who = self.identity.user(acting).await?.map(|u| u.display_name).unwrap_or_default();
        let scope = format!(
            "Tìm trong {} tài liệu đã phát hành mà {who} được xem (theo mã truy vết {} và từ khoá); xét {} tài liệu liên quan nhất",
            viewable.len(),
            if codes.is_empty() { "–".into() } else { codes.join(", ") },
            ranked.len()
        );
        if ranked.is_empty() {
            return self
                .finish(
                    check,
                    CheckStatus::Completed,
                    Some(CheckResult::NoneFound),
                    scope,
                    Some("Không xác định được tài liệu liên quan – người xử lý xem xét thủ công".into()),
                )
                .await;
        }
        let words: Vec<String> = tokens.iter().filter(|w| w.len() >= 4).cloned().collect();
        // (tài liệu, mã bản phát hành, số bản, các mục trích)
        type Related = (DocumentBrief, String, String, Vec<(String, String)>);
        let mut docs: Vec<Related> = Vec::new();
        for (_, d) in &ranked {
            if let Some(pc) = self.documents.published_content(acting, &d.id).await? {
                let ex = excerpt(&pc.content, &codes, &words, EXCERPT_CHARS);
                docs.push(((*d).clone(), pc.version_id.to_string(), pc.version, ex));
            }
        }
        let proposals: Vec<(usize, String, String, String)> = match &self.ai {
            Some(ai) => {
                let doc_codes: Vec<String> = docs.iter().map(|(d, ..)| d.code.clone()).collect();
                let blocks = docs
                    .iter()
                    .map(|(d, _, v, ex)| {
                        let parts = ex.iter().map(|(h, b)| format!("### {h}\n{b}")).collect::<Vec<_>>().join("\n\n");
                        format!("=== {} – {} (bản {v}) ===\n{parts}", d.code, d.title)
                    })
                    .collect::<Vec<_>>()
                    .join("\n\n");
                let prompt = format!("Ticket #{}:\n{}\n\nTrích các tài liệu liên quan:\n\n{blocks}", t.number, clip(&text, 4000));
                let schema = json!({
                    "type": "object", "additionalProperties": false, "required": ["proposals", "note"],
                    "properties": {
                        "proposals": { "type": "array", "items": {
                            "type": "object", "additionalProperties": false,
                            "required": ["document_code", "section", "proposed_change", "reason"],
                            "properties": {
                                "document_code": { "type": "string", "enum": doc_codes },
                                "section": { "type": "string" },
                                "proposed_change": { "type": "string" },
                                "reason": { "type": "string" },
                            },
                        } },
                        "note": { "type": "string" },
                    },
                });
                let system = "Bạn hỗ trợ đội phát triển phần mềm giữ bộ tài liệu thiết kế (yêu cầu, thiết kế, dữ liệu, API, kiểm thử) \
                    khớp với góp ý và báo lỗi. Với ticket được cho, đề xuất những thay đổi cụ thể cần làm trong các tài liệu được trích: \
                    mục nào (ghi tiêu đề mục), sửa thành gì, vì sao. Giữ nguyên các mã truy vết đã có; mã mới theo đúng mẫu mã của tài liệu. \
                    Với báo lỗi: nếu tài liệu đã mô tả đúng hành vi mong đợi thì không đề xuất sửa yêu cầu để hợp thức hoá lỗi – \
                    khi đó chỉ đề xuất bổ sung kiểm thử hoặc ghi chú nếu thật sự cần. Không có thay đổi cần thiết thì trả danh sách rỗng \
                    và giải thích trong note. Viết bằng tiếng Việt.";
                let v = ai.json(system, &prompt, schema, "high").await?;
                v["proposals"]
                    .as_array()
                    .cloned()
                    .unwrap_or_default()
                    .iter()
                    .filter_map(|p: &Value| {
                        let idx = docs.iter().position(|(d, ..)| Some(d.code.as_str()) == p["document_code"].as_str())?;
                        Some((
                            idx,
                            p["section"].as_str().unwrap_or("").to_owned(),
                            p["proposed_change"].as_str().unwrap_or("").to_owned(),
                            p["reason"].as_str().unwrap_or("").to_owned(),
                        ))
                    })
                    .filter(|(_, _, c, _)| !c.trim().is_empty())
                    .collect()
            }
            None => docs
                .iter()
                .enumerate()
                .filter_map(|(i, (d, _, _, ex))| {
                    let (h, _) = ex.first()?;
                    let hit: Vec<&String> =
                        codes.iter().filter(|c| ex.iter().any(|(hh, b)| hh.contains(c.as_str()) || b.contains(c.as_str()))).collect();
                    let reason = if hit.is_empty() {
                        format!("Tên và nội dung {} có nhiều từ khoá trùng với ticket", d.code)
                    } else {
                        format!(
                            "Ticket nhắc tới {} – mã này nằm trong mục này",
                            hit.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(", ")
                        )
                    };
                    Some((i, h.clone(), format!("Rà soát mục “{h}” theo ticket #{}: {}", t.number, t.title), reason))
                })
                .collect(),
        };
        let now = now_bson();
        for (idx, section, change, reason) in &proposals {
            let (d, vid, v, _) = &docs[*idx];
            self.c
                .proposals
                .insert_one(ProposalDoc {
                    id: ProposalId::new(),
                    ticket_id: t.id.clone(),
                    workspace_id: t.workspace_id.clone(),
                    check_id: check.id.clone(),
                    document_id: d.id.clone(),
                    document_code: d.code.clone(),
                    based_on_version_id: VersionId::from(vid.clone()),
                    based_on_version: v.clone(),
                    section: clip(section, 300),
                    proposed_change: clip(change, 8000),
                    reason: clip(reason, 2000),
                    status: ProposalStatus::Proposed,
                    draft_version_id: None,
                    reviewed_by: None,
                    created_at: now,
                    updated_at: now,
                })
                .await?;
        }
        let result = if proposals.is_empty() { CheckResult::NoneFound } else { CheckResult::CandidatesFound };
        self.bus
            .publish(
                DomainEvent::new(kinds::TICKET_PROPOSALS_GENERATED, "ticket", t.id.as_str())
                    .workspace(&t.workspace_id)
                    .actor(acting)
                    .data(json!({ "ticket_id": t.id, "count": proposals.len() })),
            )
            .await?;
        self.finish(check, CheckStatus::Completed, Some(result), scope, None).await
    }

    async fn proposal_ctx(&self, p: &Principal, id: &ProposalId) -> AppResult<(ProposalDoc, TicketDoc)> {
        let pr = self
            .c
            .proposals
            .find_one(doc! { "_id": id })
            .await?
            .ok_or_else(|| AppError::not_found("ticket.proposal_not_found", "Không tìm thấy đề xuất"))?;
        let (t, _) = self.viewable(p, &pr.ticket_id).await?;
        let perms = self.documents.doc_perms(&p.user_id, &pr.document_id).await?;
        match perms {
            Some(d) if d.view && d.edit => Ok((pr, t)),
            Some(d) if d.view => Err(AppError::forbidden("ticket.proposal_forbidden", "Cần quyền xem và sửa tài liệu để xem xét đề xuất")),
            _ => Err(AppError::not_found("ticket.proposal_not_found", "Không tìm thấy đề xuất")),
        }
    }

    /// Chấp nhận / từ chối một đề xuất sửa tài liệu (người có quyền xem và sửa tài liệu đó).
    pub async fn decide_proposal(&self, p: &Principal, id: &ProposalId, input: Decide) -> AppResult<TicketDetailDto> {
        let (pr, t) = self.proposal_ctx(p, id).await?;
        let status = match input.decision.as_str() {
            "accepted" => ProposalStatus::Accepted,
            "rejected" => ProposalStatus::Rejected,
            "proposed" => ProposalStatus::Proposed,
            _ => return Err(AppError::bad_request("ticket.invalid_decision", "decision phải là accepted, rejected hoặc proposed")),
        };
        if matches!(pr.status, ProposalStatus::Implemented | ProposalStatus::Applied) {
            return Err(AppError::conflict("ticket.proposal_locked", "Đề xuất đã được đưa vào bản dự thảo"));
        }
        let label = match status {
            ProposalStatus::Accepted => "Chấp nhận",
            ProposalStatus::Rejected => "Từ chối",
            _ => "Mở lại",
        };
        let act = Self::activity(&pr.ticket_id, Some(&p.user_id), "proposal", format!("{label} đề xuất sửa {} – {}", pr.document_code, pr.section));
        let event = DomainEvent::new(kinds::TICKET_PROPOSAL_STATUS_CHANGED, "ticket", pr.ticket_id.as_str())
            .workspace(&pr.workspace_id)
            .actor(&p.user_id)
            .data(json!({
                "ticket_id": pr.ticket_id, "number": t.number, "proposal_id": id, "document_id": pr.document_id,
                "code": pr.document_code, "status": status,
            }))
            .audit();
        let set = doc! { "$set": { "status": bson::to_bson(&status)?, "reviewed_by": &p.user_id, "updated_at": now_bson() } };
        let (c, bus, pid, from) = (self.c.clone(), self.bus.clone(), id.clone(), bson::to_bson(&pr.status)?);
        with_txn(self.mongo.client(), move |s| {
            let (c, bus, pid, from, set, act, event) = (c.clone(), bus.clone(), pid.clone(), from.clone(), set.clone(), act.clone(), event.clone());
            Box::pin(async move {
                let r = c.proposals.update_one(doc! { "_id": &pid, "status": from }, set).session(&mut *s).await?;
                if r.matched_count == 0 {
                    return Err(AppError::conflict("ticket.proposal_concurrent_change", "Đề xuất vừa được người khác xem xét – tải lại"));
                }
                c.activity.insert_one(&act).session(&mut *s).await?;
                bus.publish_in(s, event).await
            })
        })
        .await?;
        self.detail(p, &pr.ticket_id).await
    }

    /// Đánh dấu đề xuất đã được đưa vào một bản dự thảo của tài liệu. Hệ thống chỉ liên kết, không ghi đè dự thảo.
    pub async fn link_draft(&self, p: &Principal, id: &ProposalId, input: LinkDraft) -> AppResult<TicketDetailDto> {
        let (pr, t) = self.proposal_ctx(p, id).await?;
        if pr.status != ProposalStatus::Accepted {
            return Err(AppError::conflict("ticket.proposal_not_accepted", "Chấp nhận đề xuất trước khi liên kết với bản dự thảo"));
        }
        let vid = match input.version_id {
            Some(v) => v,
            None => {
                return Err(AppError::bad_request("ticket.version_required", "Chọn bản dự thảo của tài liệu"));
            }
        };
        let v = self
            .documents
            .version(&vid)
            .await?
            .filter(|v| v.document_id == pr.document_id)
            .ok_or_else(|| AppError::unprocessable("ticket.invalid_draft", "Bản dự thảo phải thuộc tài liệu được đề xuất"))?;
        if !v.status.is_working() {
            return Err(AppError::unprocessable("ticket.invalid_draft", "Chỉ liên kết với bản đang soạn / chờ duyệt"));
        }
        let act = Self::activity(
            &pr.ticket_id,
            Some(&p.user_id),
            "proposal",
            format!("Đưa đề xuất vào bản dự thảo {} của {}", v.version, pr.document_code),
        );
        let event = DomainEvent::new(kinds::TICKET_PROPOSAL_STATUS_CHANGED, "ticket", pr.ticket_id.as_str())
            .workspace(&pr.workspace_id)
            .actor(&p.user_id)
            .data(json!({
                "ticket_id": pr.ticket_id, "number": t.number, "proposal_id": id, "document_id": pr.document_id,
                "code": pr.document_code, "status": ProposalStatus::Implemented, "draft_version_id": vid, "draft_version": v.version,
            }))
            .audit();
        let set = doc! { "$set": { "status": "implemented", "draft_version_id": &vid, "reviewed_by": &p.user_id, "updated_at": now_bson() } };
        let (c, bus, pid) = (self.c.clone(), self.bus.clone(), id.clone());
        with_txn(self.mongo.client(), move |s| {
            let (c, bus, pid, set, act, event) = (c.clone(), bus.clone(), pid.clone(), set.clone(), act.clone(), event.clone());
            Box::pin(async move {
                // Chỉ đề xuất còn ở "Chấp nhận" (không liên kết hai lần, không đè quyết định đồng thời).
                let r = c.proposals.update_one(doc! { "_id": &pid, "status": "accepted" }, set).session(&mut *s).await?;
                if r.matched_count == 0 {
                    return Err(AppError::conflict("ticket.proposal_not_accepted", "Chấp nhận đề xuất trước khi liên kết với bản dự thảo"));
                }
                c.activity.insert_one(&act).session(&mut *s).await?;
                bus.publish_in(s, event).await
            })
        })
        .await?;
        self.detail(p, &pr.ticket_id).await
    }

    /// Ticket mới ⇒ AI tự kiểm tra trùng thay mặt người đã uỷ quyền (người đầu tiên còn đủ quyền với ticket này).
    pub async fn on_ticket_created(self: &Arc<Self>, ev: &DomainEvent) -> AppResult<()> {
        let id = TicketId::from(ev.target_id.clone());
        let Some(t) = self.c.tickets.find_one(doc! { "_id": &id }).await? else { return Ok(()) };
        if self.c.checks.count_documents(doc! { "ticket_id": &id, "trigger_mode": "automatic" }).await? > 0 {
            return Ok(()); // sự kiện phát lại
        }
        let dels: Vec<AiDelegationDoc> = self
            .c
            .ai_delegations
            .find(doc! { "workspace_id": &t.workspace_id, "revoked_at": Bson::Null })
            .sort(doc! { "_id": 1 })
            .await?
            .try_collect()
            .await?;
        for d in dels {
            if self.ticket_access(&d.user_id, &t.workspace_id).await?.can_process(&t) {
                let check = self.new_check(&t, &d.user_id, CheckPurpose::Duplicates, "automatic").await?;
                self.spawn(check);
                break;
            }
        }
        Ok(())
    }

    /// Lần chạy treo quá 15 phút (tiến trình khởi động lại giữa chừng…) ⇒ thất bại, cho phép chạy lại.
    pub async fn fail_stuck_checks(&self) -> AppResult<()> {
        let cutoff = bson::DateTime::from_millis(now_bson().timestamp_millis() - 15 * 60 * 1000);
        let stuck: Vec<CheckDoc> =
            self.c.checks.find(doc! { "status": "pending", "created_at": { "$lt": cutoff } }).await?.try_collect().await?;
        for c in stuck {
            self.finish(&c, CheckStatus::Failed, None, String::new(), Some("Hết thời gian chờ – chạy lại".into())).await?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn excerpt_picks_sections_that_mention_the_needles() {
        let content = "# SRS về hoá đơn\n\n## 1. Giới thiệu\n\nTổng quan hoá đơn.\n\n## 5. Yêu cầu chức năng\n\n| FR-ORD-CART-001 | Xuất PDF |\n\n## 6. Khác\n\nKhông liên quan.\n";
        let ex = excerpt(content, &["FR-ORD-CART-001".into()], &["hoa".into()], 1000);
        assert_eq!(ex[0].0, "5. Yêu cầu chức năng", "mục chứa mã đứng đầu");
        assert_eq!(ex.len(), 3, "các mục chỉ trùng từ khoá xếp sau");
    }
}
