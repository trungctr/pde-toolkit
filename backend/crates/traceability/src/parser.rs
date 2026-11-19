//! Đọc mã truy vết trong nội dung Markdown của một phiên bản (desc §7.2, CONV §3.4).
//!
//! Thuần tuý (không I/O). Quy tắc:
//! 1. **Chuẩn bị văn bản**: bỏ dòng diagram nhúng, khối code, khối `> [!TIP]`, bảng thuộc tính đầu tài liệu,
//!    mục *Lịch sử thay đổi*; xoá ô chưa điền `{{…}}` và đích liên kết `](…)`. Tài liệu CONV, GLOSSARY, DOCREG
//!    không được đọc (CONV liệt kê ví dụ của mọi loại mã).
//! 2. **Tìm mã** bằng một biểu thức chính quy, rồi lọc: bỏ mã có đoạn giữ chỗ (`UC-HTC-01`, `FR-HTC-MOD-001`),
//!    bỏ mã đứng sau `-` (nằm trong mã tài liệu `SHOP-ADR-ORD-001`) hoặc nối tiếp bằng `-chữ`.
//! 3. **Định nghĩa hay tham chiếu**: là định nghĩa khi tài liệu thuộc loại định nghĩa loại mã đó, đoạn hệ thống
//!    con (nếu có) khớp hệ thống con của tài liệu, và mã nằm ở **ô đầu của một dòng bảng** (hoặc **đầu tiêu đề**
//!    với UC, SEQ, STM, ACT, ADR hệ thống con) – lần xuất hiện đầu tiên. Còn lại là tham chiếu.

use regex::Regex;
use sha2::{Digest, Sha256};
use std::collections::{BTreeSet, HashMap};
use std::sync::OnceLock;

/// Thông tin một loại mã.
#[derive(Clone, Copy, Debug)]
pub struct KindInfo {
    /// Khoá loại mã như viết trong tài liệu: `StR`, `FR`, `SYS-F`…
    pub key: &'static str,
    pub name_vi: &'static str,
    /// Mã loại tài liệu định nghĩa loại mã này.
    pub defined_in: &'static str,
    /// Có đoạn mã hệ thống con (`UC-<HTC>-nn`).
    pub has_subsystem: bool,
    /// Duy nhất trong từng hệ thống con chứ không trong cả workspace (`SDD-ORD SEQ-01`).
    pub scoped: bool,
    /// Tiền tố một chữ cái – dễ trùng chữ thường; không cảnh báo "mã chưa có".
    pub weak: bool,
    /// Định nghĩa bằng tiêu đề (`### UC-ORD-01 …`) thay vì ô đầu dòng bảng.
    pub heading_def: bool,
}

const fn k(key: &'static str, name_vi: &'static str, defined_in: &'static str) -> KindInfo {
    KindInfo { key, name_vi, defined_in, has_subsystem: false, scoped: false, weak: false, heading_def: false }
}

pub const KINDS: &[(&str, KindInfo)] = &[
    ("sysf", k("SYS-F", "Chức năng hệ thống", "SYRS")),
    ("sysn", k("SYS-N", "Yêu cầu chất lượng chung", "SYRS")),
    ("sysi", k("SYS-I", "Kết nối ra bên ngoài", "SYRS")),
    ("str", k("StR", "Nhu cầu bên liên quan", "STRS")),
    ("stc", k("StC", "Ràng buộc bên liên quan", "STRS")),
    ("sh", k("SH", "Bên liên quan", "STRS")),
    ("bp", k("BP", "Quy trình nghiệp vụ", "BMA")),
    ("uc", KindInfo { has_subsystem: true, heading_def: true, ..k("UC", "Use case", "SRS") }),
    ("nfr", KindInfo { has_subsystem: true, ..k("NFR", "Yêu cầu phi chức năng", "SRS") }),
    ("fr", KindInfo { has_subsystem: true, ..k("FR", "Yêu cầu chức năng", "SRS") }),
    ("br", KindInfo { has_subsystem: true, ..k("BR", "Quy tắc nghiệp vụ", "SRS") }),
    ("adr0", k("ADR", "Quyết định kiến trúc nền tảng", "ADR00")),
    ("adrh", KindInfo { has_subsystem: true, heading_def: true, ..k("ADR", "Quyết định kiến trúc", "ADRHTC") }),
    ("seq", KindInfo { scoped: true, heading_def: true, ..k("SEQ", "Luồng tương tác", "SDD") }),
    ("stm", KindInfo { scoped: true, heading_def: true, ..k("STM", "Máy trạng thái", "SDD") }),
    ("act", KindInfo { scoped: true, heading_def: true, ..k("ACT", "Thuật toán", "SDD") }),
    ("auth", k("AUTH", "Cách xác thực", "ICD")),
    ("gap", k("GAP", "Gọi nhưng không khớp", "ICD")),
    ("dg", k("DG", "Vấn đề về dữ liệu", "DBD")),
    ("ts", k("TS", "Bộ kiểm thử", "STP")),
    ("sec", k("SEC", "Rủi ro bảo mật", "ASM")),
    ("risk", KindInfo { has_subsystem: true, ..k("RISK", "Rủi ro của hệ thống con", "SDD") }),
    ("td", KindInfo { has_subsystem: true, ..k("TD", "Nợ kỹ thuật của hệ thống con", "SDD") }),
    ("op", k("OP", "Sự cố vận hành", "OPS")),
    ("a", KindInfo { scoped: true, weak: true, ..k("A", "Tác nhân", "SRS") }),
    ("i", KindInfo { weak: true, ..k("I", "Điểm tích hợp", "ICD") }),
    ("c", KindInfo { scoped: true, weak: true, ..k("C", "Bảng dùng chung bị hiểu khác nhau", "ERD") }),
    ("s", KindInfo { weak: true, ..k("S", "Trục trặc khi lập tài liệu", "LOG") }),
];

/// Tên nhóm chứa đoạn hệ thống con / module của từng loại mã có đoạn đó.
const SUB_GROUPS: &[&str] = &["uc_sub", "nfr_sub", "fr_sub", "br_sub", "adr_sub", "risk_sub", "td_sub"];
const PLACEHOLDER_SEGMENTS: &[&str] = &["HTC", "MOD", "PRJ", "NN"];
/// Loại tài liệu không đọc mã (ví dụ minh hoạ mọi loại mã).
pub const SKIPPED_TYPES: &[&str] = &["CONV", "GLOSSARY", "DOCREG"];

pub fn kind_info(group: &str) -> Option<&'static KindInfo> {
    KINDS.iter().find(|(g, _)| *g == group).map(|(_, i)| i)
}

/// Tra theo khoá hiển thị (`FR`, `SYS-F`); `ADR` trả về dạng nền tảng.
pub fn kind_by_key(key: &str) -> Option<&'static KindInfo> {
    KINDS.iter().map(|(_, i)| i).find(|i| i.key == key)
}

fn code_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r"(?x)
            \b(?:
                (?P<sysf>SYS-F[0-9]{2})
              | (?P<sysn>SYS-N[0-9]{2})
              | (?P<sysi>SYS-I[0-9]{2})
              | (?P<str>StR-[0-9]{2})
              | (?P<stc>StC-[0-9]{2})
              | (?P<sh>SH-[A-Z][A-Z0-9]{1,7})
              | (?P<bp>BP-[0-9]{2})
              | (?P<uc>UC-(?P<uc_sub>[A-Z][A-Z0-9]{1,4})-[0-9]{2})
              | (?P<nfr>NFR-(?P<nfr_sub>[A-Z][A-Z0-9]{1,4})-[0-9]{3})
              | (?P<fr>FR-(?P<fr_sub>[A-Z][A-Z0-9]{1,4})-(?P<fr_mod>[A-Z][A-Z0-9]{1,9})-[0-9]{3})
              | (?P<br>BR-(?P<br_sub>[A-Z][A-Z0-9]{1,4})-[0-9]{3})
              | (?P<adr0>ADR-00-[0-9]{2})
              | (?P<adrh>ADR-(?P<adr_sub>[A-Z][A-Z0-9]{1,4})-[0-9]{3})
              | (?P<seq>SEQ-[0-9]{2})
              | (?P<stm>STM-[0-9]{2})
              | (?P<act>ACT-[0-9]{2})
              | (?P<auth>AUTH-[0-9]{1,2})
              | (?P<gap>GAP-[0-9]{2})
              | (?P<dg>DG-[0-9]{2})
              | (?P<ts>TS-[0-9]{2})
              | (?P<sec>SEC-[0-9]{2})
              | (?P<risk>RISK-(?P<risk_sub>[A-Z][A-Z0-9]{1,4})-[0-9]{2})
              | (?P<td>TD-(?P<td_sub>[A-Z][A-Z0-9]{1,4})-[0-9]{2})
              | (?P<op>OP-[0-9]{2})
              | (?P<a>A-[A-Z][A-Z0-9]{1,7})
              | (?P<i>I-[0-9]{2})
              | (?P<c>C-[0-9]{2})
              | (?P<s>S-[0-9]{2})
            )\b",
        )
        .expect("regex mã truy vết")
    })
}

fn re(pat: &'static str, cell: &'static OnceLock<Regex>) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pat).expect(pat))
}

fn heading_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(r"^(#{1,6})[ \t]+(.*?)[ \t#]*$", &R)
}
fn section_no_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(r"^([0-9]+(?:\.[0-9]+)*)\.?(?:[ \t]|$)", &R)
}
fn placeholder_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(r"\{\{.*?\}\}", &R)
}
fn link_target_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(r"\]\([^)\s]*\)", &R)
}
fn delimiter_row_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(r"^\|(?:\s*:?-+:?\s*\|)+\s*$", &R)
}
fn retired_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(r"\(đã bỏ\s*[–-]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\)", &R)
}
fn qualifier_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    re(r"\b(?:SDD|ERD|SRS)-([A-Z][A-Z0-9]{1,4})\b", &R)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Definition,
    Reference,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Occurrence {
    pub code: String,
    /// Khoá loại mã (`FR`, `SYS-F`…).
    pub kind: &'static str,
    /// Mã hệ thống con với loại mã duy nhất theo hệ thống con (`A`, `SEQ`, `STM`, `ACT`, `C`); `""` nếu không
    /// áp dụng hoặc chưa xác định được.
    pub scope: String,
    pub role: Role,
    /// Tiêu đề gần nhất phía trên.
    pub section: String,
    /// Số mục gần nhất có đánh số (`4`, `5.1`).
    pub section_no: Option<String>,
    /// Mã được định nghĩa trên cùng dòng / dưới cùng tiêu đề (cạnh nối cho ma trận truy vết).
    pub context_code: Option<String>,
    /// Ngày bỏ (dòng định nghĩa có `(đã bỏ – YYYY-MM-DD)`).
    pub retired_on: Option<String>,
    /// Use case đơn giản không có tiêu đề riêng: coi lần xuất hiện đầu là định nghĩa.
    pub implicit: bool,
    /// Dòng / mục định nghĩa còn ô chưa điền `{{…}}` (dòng ví dụ của mẫu).
    pub provisional: bool,
    /// SHA-256 nội dung định nghĩa – đổi giá trị nghĩa là nội dung mã đã đổi.
    pub def_hash: Option<String>,
    /// Số dòng (từ 1) trong nội dung gốc.
    pub line: usize,
}

#[derive(Clone, Debug, Default)]
pub struct ParseResult {
    pub occurrences: Vec<Occurrence>,
    /// Mã có đoạn hệ thống con khác hệ thống con của tài liệu ở vị trí định nghĩa.
    pub foreign_definitions: Vec<(String, usize)>,
}

struct Line<'a> {
    no: usize,
    raw: &'a str,
    /// Nội dung đã xoá ô chưa điền và đích liên kết.
    text: String,
    heading: Option<(usize, String)>,
    table_header: bool,
}

/// Bước 1: các dòng cần đọc.
fn prepare(content: &str) -> Vec<Line<'_>> {
    let mut out = Vec::new();
    let (mut fence, mut tip, mut seen_h1) = (None::<&str>, false, false);
    let (mut in_header_table, mut header_done, mut in_history) = (false, false, false);
    let mut prev_table = false;
    for (i, raw) in content.lines().enumerate() {
        let t = raw.trim_start();
        if let Some(f) = fence {
            if t.starts_with(f) {
                fence = None;
            }
            continue;
        }
        if t.starts_with("```") || t.starts_with("~~~") {
            fence = Some(&t[..3]);
            continue;
        }
        if raw.starts_with("<!-- de-diagram:") || raw.starts_with("<!-- /de-diagram:") || raw.starts_with("<div align=\"center\"><svg") {
            continue;
        }
        if t.starts_with("> [!TIP]") {
            tip = true;
            continue;
        }
        if tip {
            if t.starts_with('>') {
                continue;
            }
            tip = false;
        }
        let heading = heading_re().captures(raw).map(|c| (c[1].len(), c[2].trim().to_owned()));
        if let Some((_, h)) = &heading {
            if !seen_h1 {
                seen_h1 = true;
            }
            in_history = h.contains("Lịch sử thay đổi");
        }
        if in_history {
            continue;
        }
        let is_table = t.starts_with('|');
        // Bảng thuộc tính: bảng đầu tiên sau tiêu đề H1 có ô đầu "Thuộc tính".
        if !header_done && seen_h1 && is_table && !prev_table {
            let first = t.trim_matches('|').split('|').next().unwrap_or("").trim();
            in_header_table = first == "Thuộc tính";
            header_done = true;
        }
        if in_header_table {
            if is_table {
                prev_table = true;
                continue;
            }
            in_header_table = false;
        }
        if !is_table && !t.is_empty() && heading.is_none() && !header_done && seen_h1 {
            header_done = true;
        }
        let table_header = is_table && !prev_table;
        prev_table = is_table;
        if is_table && delimiter_row_re().is_match(t) {
            continue;
        }
        let text = link_target_re().replace_all(&placeholder_re().replace_all(raw, " "), "]").into_owned();
        out.push(Line { no: i + 1, raw, text, heading, table_header });
    }
    out
}

/// Ô đầu của một dòng bảng, đã bỏ định dạng.
fn first_cell(line: &str) -> String {
    let body = line.trim().trim_start_matches('|');
    let mut cell = String::new();
    let mut prev = '\0';
    for ch in body.chars() {
        if ch == '|' && prev != '\\' {
            break;
        }
        cell.push(ch);
        prev = ch;
    }
    cell.replace("**", "").replace('`', "").replace(['[', ']'], "").trim().to_owned()
}

fn starts_with_code(s: &str, code: &str) -> bool {
    s.strip_prefix(code).is_some_and(|rest| rest.is_empty() || rest.starts_with([' ', '(', '\t']))
}

/// Tiêu đề mà mã là từ đầu tiên (sau số mục).
fn heading_starts_with(h: &str, code: &str) -> bool {
    let rest = match section_no_re().find(h) {
        Some(m) => h[m.end()..].trim_start(),
        None => h,
    };
    let rest = rest.trim_start_matches('`');
    rest.strip_prefix(code).is_some_and(|r| r.is_empty() || r.starts_with([' ', '`', '\t']) || r.starts_with('–') || r.starts_with('-'))
}

fn sha(s: &str) -> String {
    Sha256::digest(s.split_whitespace().collect::<Vec<_>>().join(" ").as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

struct Hit {
    code: String,
    group: &'static str,
    info: &'static KindInfo,
    sub: Option<String>,
}

/// Bước 2: các mã hợp lệ trong một dòng.
fn scan(text: &str) -> Vec<Hit> {
    let mut hits = Vec::new();
    for caps in code_regex().captures_iter(text) {
        let m = caps.get(0).expect("match");
        let Some((group, info)) = KINDS.iter().find(|(g, _)| caps.name(g).is_some()) else { continue };
        let sub = SUB_GROUPS.iter().find_map(|g| caps.name(g)).map(|s| s.as_str().to_owned());
        let mod_seg = caps.name("fr_mod").map(|s| s.as_str());
        if sub.as_deref().is_some_and(|s| PLACEHOLDER_SEGMENTS.contains(&s)) || mod_seg.is_some_and(|s| PLACEHOLDER_SEGMENTS.contains(&s)) {
            continue;
        }
        let before = text[..m.start()].chars().next_back();
        if before == Some('-') {
            continue;
        }
        let mut after = text[m.end()..].chars();
        if after.next() == Some('-') && after.next().is_some_and(|c| c.is_alphanumeric()) {
            continue;
        }
        hits.push(Hit { code: m.as_str().to_owned(), group, info, sub });
    }
    hits
}

/// Đọc mã truy vết trong `content` của một tài liệu loại `type_code` thuộc hệ thống con `subsystem`.
pub fn parse(content: &str, type_code: &str, subsystem: Option<&str>) -> ParseResult {
    let mut res = ParseResult::default();
    if SKIPPED_TYPES.contains(&type_code) {
        return res;
    }
    let content = content.replace("\r\n", "\n");
    let lines = prepare(&content);
    let mut section = String::new();
    let mut section_no: Option<String> = None;
    let mut defined: BTreeSet<String> = BTreeSet::new();
    let mut seen_refs: BTreeSet<(String, String)> = BTreeSet::new();
    // Định nghĩa bằng tiêu đề đang mở: (mã, cấp tiêu đề, chỉ số occurrence để cộng dồn nội dung băm).
    let mut heading_ctx: Option<(String, usize, usize, String)> = None;
    let mut uc_heading_defs: BTreeSet<String> = BTreeSet::new();

    // Lượt trước: use case nào có tiêu đề riêng (để quyết định định nghĩa ngầm).
    if type_code == "SRS" {
        for l in &lines {
            if let Some((lvl, h)) = &l.heading {
                if *lvl >= 2 {
                    for hit in scan(&l.text) {
                        if hit.group == "uc" && heading_starts_with(h, &hit.code) {
                            uc_heading_defs.insert(hit.code);
                        }
                    }
                }
            }
        }
    }

    for l in &lines {
        if let Some((lvl, h)) = &l.heading {
            // đóng định nghĩa bằng tiêu đề khi gặp tiêu đề cùng cấp hoặc cao hơn
            if let Some((_, open_lvl, idx, body)) = &heading_ctx {
                if *lvl <= *open_lvl {
                    res.occurrences[*idx].def_hash = Some(sha(body));
                    heading_ctx = None;
                }
            }
            section = h.clone();
            if let Some(c) = section_no_re().captures(h) {
                section_no = Some(c[1].to_owned());
            }
        } else if let Some((_, _, _, body)) = heading_ctx.as_mut() {
            body.push('\n');
            body.push_str(l.raw);
        }

        let hits = scan(&l.text);
        if hits.is_empty() {
            continue;
        }
        let is_row = l.raw.trim_start().starts_with('|') && !l.table_header;
        let cell = if is_row { first_cell(&l.text) } else { String::new() };
        let qualifier =
            qualifier_re().captures_iter(&l.text).map(|c| c[1].to_owned()).find(|s| !PLACEHOLDER_SEGMENTS.contains(&s.as_str()));
        let mut row_def: Option<String> = None;

        for hit in &hits {
            let info = hit.info;
            let own_type = info.defined_in == type_code;
            let sub_ok = !info.has_subsystem || hit.sub.as_deref() == subsystem;
            let shape = if info.heading_def {
                l.heading.as_ref().is_some_and(|(lvl, h)| *lvl >= 2 && heading_starts_with(h, &hit.code))
                    || (hit.group == "adrh" && is_row && starts_with_code(&cell, &hit.code))
            } else {
                is_row && starts_with_code(&cell, &hit.code)
            };
            let implicit = own_type && hit.group == "uc" && sub_ok && !uc_heading_defs.contains(&hit.code);
            let first_def = !defined.contains(&hit.code);
            if own_type && shape && !sub_ok && first_def {
                res.foreign_definitions.push((hit.code.clone(), l.no));
            }
            let is_def = own_type && sub_ok && first_def && (shape || implicit);
            let scope = if info.scoped {
                if is_def {
                    subsystem.unwrap_or("").to_owned()
                } else {
                    qualifier.clone().or_else(|| subsystem.map(str::to_owned)).unwrap_or_default()
                }
            } else {
                String::new()
            };
            if is_def {
                defined.insert(hit.code.clone());
                let in_heading = l.heading.is_some();
                let occ = Occurrence {
                    code: hit.code.clone(),
                    kind: info.key,
                    scope,
                    role: Role::Definition,
                    section: section.clone(),
                    section_no: section_no.clone(),
                    context_code: None,
                    retired_on: retired_re().captures(l.raw).map(|c| c[1].to_owned()),
                    implicit: implicit && !shape,
                    provisional: l.raw.contains("{{"),
                    def_hash: if in_heading { None } else { Some(sha(l.raw)) },
                    line: l.no,
                };
                res.occurrences.push(occ);
                if in_heading {
                    let lvl = l.heading.as_ref().map(|(lv, _)| *lv).unwrap_or(2);
                    if let Some((_, _, idx, body)) = heading_ctx.take() {
                        res.occurrences[idx].def_hash = Some(sha(&body));
                    }
                    heading_ctx = Some((hit.code.clone(), lvl, res.occurrences.len() - 1, l.raw.to_owned()));
                } else if row_def.is_none() {
                    row_def = Some(hit.code.clone());
                }
                continue;
            }
            // tham chiếu (bỏ mã tự định nghĩa trong cùng tài liệu và lần lặp trong cùng mục)
            let key = (hit.code.clone(), section.clone());
            if seen_refs.contains(&key) {
                continue;
            }
            seen_refs.insert(key);
            res.occurrences.push(Occurrence {
                code: hit.code.clone(),
                kind: info.key,
                scope,
                role: Role::Reference,
                section: section.clone(),
                section_no: section_no.clone(),
                context_code: row_def.clone().or_else(|| heading_ctx.as_ref().map(|(c, ..)| c.clone())),
                retired_on: None,
                implicit: false,
                provisional: false,
                def_hash: None,
                line: l.no,
            });
        }
    }
    if let Some((_, _, idx, body)) = heading_ctx {
        res.occurrences[idx].def_hash = Some(sha(&body));
    }
    // Mã đã được tài liệu tự định nghĩa thì các lần nhắc lại không còn là tham chiếu ra ngoài.
    let defs: HashMap<String, ()> = res.occurrences.iter().filter(|o| o.role == Role::Definition).map(|o| (o.code.clone(), ())).collect();
    res.occurrences.retain(|o| o.role == Role::Definition || !defs.contains_key(&o.code));
    res
}

/// Mọi mã (đã lọc) trong một đoạn văn bản tự do – ví dụ nội dung ticket.
pub fn codes_in_text(text: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for line in text.lines() {
        for h in scan(line) {
            if !out.contains(&h.code) {
                out.push(h.code);
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn defs(r: &ParseResult) -> Vec<&str> {
        r.occurrences.iter().filter(|o| o.role == Role::Definition).map(|o| o.code.as_str()).collect()
    }
    fn refs(r: &ParseResult) -> Vec<&str> {
        r.occurrences.iter().filter(|o| o.role == Role::Reference).map(|o| o.code.as_str()).collect()
    }

    const SRS: &str = "# Đặc tả yêu cầu phần mềm – Đặt hàng

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | SHOP-SRS-ORD-001 |
| Phiên bản | 0.1 |
| Tài liệu liên quan | ↑ [StRS-00](StRS-00_Yeu_cau.md) · [BPMN-11](../BPMN-11_Mua.md) |

> [!TIP]
> Ví dụ: FR-ORD-CART-999 trong khối hướng dẫn không được tính.

## 2. Tác nhân

| Mã | Tác nhân | Mô tả |
|---|---|---|
| A-USR | Người dùng | đã đăng nhập |

## 4. Đặc tả Use Case chính

### UC-ORD-01 Đặt hàng

| Mục | Nội dung |
|---|---|
| Tác nhân | A-USR. Quy trình BP-11 bước `t1`, đáp ứng StR-01 |
| Thiết kế | [SDD-ORD](../SDD-ORD.md) SEQ-01 |

## 5. Yêu cầu chức năng

| ID | Mô tả | UC | SYS |
|---|---|---|---|
| FR-ORD-CART-001 | Thêm vào giỏ; kiểm tra BR-ORD-001 | UC-ORD-01 | SYS-F01 |
| FR-ORD-CART-002 | Xoá khỏi giỏ (đã bỏ – 2026-11-12) do gộp vào FR-ORD-CART-001 | UC-ORD-03 | SYS-F01 |
| FR-HTC-MOD-003 | {{dòng mẫu chưa điền}} | UC-HTC-01 | SYS-F01 |
| FR-PAY-CARD-001 | sai hệ thống con | | |

## 7. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-ORD-001 | Giỏ không rỗng |

```text
FR-ORD-CART-777 trong khối code
```

## 9. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | 2026-11-17 | Khởi tạo, nhắc FR-ORD-CART-555 | An |
";

    #[test]
    fn srs_definitions_and_references() {
        let r = parse(SRS, "SRS", Some("ORD"));
        let mut d = defs(&r);
        d.sort();
        assert_eq!(d, vec!["A-USR", "BR-ORD-001", "FR-ORD-CART-001", "FR-ORD-CART-002", "UC-ORD-01", "UC-ORD-03"]);
        let mut rf = refs(&r);
        rf.sort();
        assert_eq!(rf, vec!["BP-11", "FR-PAY-CARD-001", "SEQ-01", "SYS-F01", "StR-01"]);
        // không đọc: khối TIP, khối code, lịch sử, bảng thuộc tính (mã tài liệu), dòng mẫu chưa điền
        for skipped in ["FR-ORD-CART-999", "FR-ORD-CART-777", "FR-ORD-CART-555", "ADR-ORD-001"] {
            assert!(!r.occurrences.iter().any(|o| o.code == skipped), "{skipped}");
        }
        assert_eq!(r.foreign_definitions.iter().map(|(c, _)| c.as_str()).collect::<Vec<_>>(), vec!["FR-PAY-CARD-001"]);

        let uc1 = r.occurrences.iter().find(|o| o.code == "UC-ORD-01").unwrap();
        assert!(!uc1.implicit && uc1.def_hash.is_some(), "định nghĩa bằng tiêu đề");
        assert_eq!(uc1.section_no.as_deref(), Some("4"));
        let uc3 = r.occurrences.iter().find(|o| o.code == "UC-ORD-03").unwrap();
        assert!(uc3.implicit, "use case đơn giản không có tiêu đề");

        let retired = r.occurrences.iter().find(|o| o.code == "FR-ORD-CART-002").unwrap();
        assert_eq!(retired.retired_on.as_deref(), Some("2026-11-12"));

        let seq = r.occurrences.iter().find(|o| o.code == "SEQ-01").unwrap();
        assert_eq!(seq.scope, "ORD", "mã theo hệ thống con lấy phạm vi từ tiền tố SDD-ORD");
        assert_eq!(seq.context_code.as_deref(), Some("UC-ORD-01"), "tham chiếu dưới tiêu đề use case");
        let sysf = r.occurrences.iter().find(|o| o.code == "SYS-F01").unwrap();
        assert_eq!(sysf.context_code.as_deref(), Some("FR-ORD-CART-001"), "tham chiếu cùng dòng bảng");
        let a = r.occurrences.iter().find(|o| o.code == "A-USR").unwrap();
        assert_eq!(a.scope, "ORD");
    }

    #[test]
    fn same_codes_in_another_document_type_are_references() {
        let content = "# RTM\n\n| Thuộc tính | Giá trị |\n|---|---|\n| Mã tài liệu | SHOP-RTM-000 |\n\n## 3. Truy vết\n\n| FR | UC |\n|---|---|\n| FR-ORD-CART-001 | UC-ORD-01 |\n";
        let r = parse(content, "RTM", None);
        assert!(defs(&r).is_empty());
        assert_eq!(refs(&r), vec!["FR-ORD-CART-001", "UC-ORD-01"]);
    }

    #[test]
    fn hashes_change_only_when_the_definition_changes() {
        let a = parse(SRS, "SRS", Some("ORD"));
        let b = parse(&SRS.replace("Giỏ không rỗng", "Giỏ phải có ít nhất 1 sản phẩm"), "SRS", Some("ORD"));
        let h = |r: &ParseResult, c: &str| r.occurrences.iter().find(|o| o.code == c).unwrap().def_hash.clone();
        assert_ne!(h(&a, "BR-ORD-001"), h(&b, "BR-ORD-001"));
        assert_eq!(h(&a, "FR-ORD-CART-001"), h(&b, "FR-ORD-CART-001"));
        assert_eq!(h(&a, "UC-ORD-01"), h(&b, "UC-ORD-01"));
    }

    #[test]
    fn filters_document_codes_placeholders_and_word_boundaries() {
        let codes =
            codes_in_text("SHOP-ADR-ORD-001 OPS-00 StRS-00 TS-01 API-01 SEC-01-fix BP-NN UC-HTC-01 StR-01, `FR-ORD-CART-001` và (AUTH-1)");
        assert_eq!(codes, vec!["TS-01", "StR-01", "FR-ORD-CART-001", "AUTH-1"]);
        assert!(codes_in_text("STR-01 str-01").is_empty(), "phân biệt hoa thường");
    }

    #[test]
    fn conv_is_not_scanned_and_heading_definitions_in_sdd() {
        assert!(parse("# CONV\n\n| StR-01 | x |\n", "CONV", None).occurrences.is_empty());
        let sdd = "# SDD\n\n## 5. Luồng\n\n### 5.1 SEQ-01 – Đặt hàng\n\nGọi `POST /orders`, đáp ứng FR-ORD-CART-001.\n\n### 5.2 SEQ-02 – Huỷ\n\nxx\n\n## 6. Trạng thái\n\n### 6.1 STM-01 – `don_hang.trang_thai`\n";
        let r = parse(sdd, "SDD", Some("ORD"));
        assert_eq!(defs(&r), vec!["SEQ-01", "SEQ-02", "STM-01"]);
        let fr = r.occurrences.iter().find(|o| o.code == "FR-ORD-CART-001").unwrap();
        assert_eq!(fr.context_code.as_deref(), Some("SEQ-01"));
        assert!(r.occurrences.iter().filter(|o| o.role == Role::Definition).all(|o| o.scope == "ORD" && o.def_hash.is_some()));
    }
}
