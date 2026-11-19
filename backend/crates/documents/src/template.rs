//! Xử lý nội dung Markdown theo quy ước của bộ mẫu (thuần tuý, không I/O):
//! - [`instantiate`]: điền mã dự án / hệ thống con / quy trình vào mẫu (giống `js/doc-library.js`).
//! - [`check_header`]: kiểm tra "bảng thuộc tính đầu tài liệu đủ" trước khi gửi duyệt (desc §5.2).
//! - [`set_header_rows`], [`append_history`]: hệ thống tự cập nhật bảng thuộc tính và bảng *Lịch sử thay đổi*
//!   mỗi lần chuyển trạng thái (desc §5.3).

use crate::catalog::DocType;
use chillcat_kernel::Cardinality;
use serde::Serialize;

#[derive(Clone, Debug, Default)]
pub struct FillValues {
    pub prj: String,
    pub prj_name: String,
    pub htc: Option<String>,
    pub htc_name: Option<String>,
    pub module: Option<String>,
    pub process_no: Option<u8>,
    pub process_name: Option<String>,
}

fn is_tok_neighbor(c: Option<char>, open: bool) -> bool {
    match c {
        None => false,
        Some(c) => c.is_ascii_alphanumeric() || (open && c == '<') || (!open && c == '>'),
    }
}

/// Thay `tok` đứng riêng (không dính chữ / số, không nằm trong `<…>`) bằng `val`.
pub fn replace_token(s: &str, tok: &str, val: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut i = 0;
    while let Some(pos) = s[i..].find(tok) {
        let start = i + pos;
        let end = start + tok.len();
        let before = s[..start].chars().next_back();
        let after = s[end..].chars().next();
        out.push_str(&s[i..start]);
        if is_tok_neighbor(before, true) || is_tok_neighbor(after, false) {
            out.push_str(tok);
        } else {
            out.push_str(val);
        }
        i = end;
    }
    out.push_str(&s[i..]);
    out
}

pub fn contains_token(s: &str, tok: &str) -> bool {
    replace_token(s, tok, "\u{0}") != s
}

/// Bỏ dấu tiếng Việt, nối bằng `_` (tên file như frontend).
pub fn slug(s: &str) -> String {
    const MAP: &[(&str, char)] = &[
        ("àáạảãâầấậẩẫăằắặẳẵ", 'a'),
        ("ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴ", 'A'),
        ("èéẹẻẽêềếệểễ", 'e'),
        ("ÈÉẸẺẼÊỀẾỆỂỄ", 'E'),
        ("ìíịỉĩ", 'i'),
        ("ÌÍỊỈĨ", 'I'),
        ("òóọỏõôồốộổỗơờớợởỡ", 'o'),
        ("ÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠ", 'O'),
        ("ùúụủũưừứựửữ", 'u'),
        ("ÙÚỤỦŨƯỪỨỰỬỮ", 'U'),
        ("ỳýỵỷỹ", 'y'),
        ("ỲÝỴỶỸ", 'Y'),
        ("đ", 'd'),
        ("Đ", 'D'),
    ];
    let plain: String = s
        .chars()
        .map(|c| MAP.iter().find(|(set, _)| set.contains(c)).map(|(_, b)| *b).unwrap_or(c))
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();
    plain.split('_').filter(|p| !p.is_empty()).collect::<Vec<_>>().join("_")
}

fn json_safe(v: &str) -> String {
    let s = serde_json::to_string(v).unwrap_or_default();
    s[1..s.len() - 1].replace('<', "\\u003c").replace('>', "\\u003e")
}

/// Một luật thay thế: (nội dung dòng, giá trị) → dòng mới.
type Rule = Box<dyn Fn(&str, &str) -> String>;

/// Điền mẫu cho một tài liệu mới. `today` dạng `YYYY-MM-DD`; `author` thay `{{Họ tên}}` ở dòng lịch sử đầu.
pub fn instantiate(t: &DocType, v: &FillValues, today: &str, author: &str) -> String {
    let htc_kind = matches!(t.cardinality, Cardinality::Subsystem | Cardinality::Process);
    let bp_kind = t.cardinality == Cardinality::Process;
    let nn = v.process_no.map(|n| format!("{n:02}"));
    let mut rules: Vec<(Rule, String)> = Vec::new();
    let lit = |pat: &'static str| -> Rule { Box::new(move |s: &str, val: &str| s.replace(pat, val)) };
    let tok = |pat: &'static str| -> Rule { Box::new(move |s: &str, val: &str| replace_token(s, pat, val)) };
    let mut add = |f: Rule, val: Option<&str>| {
        if let Some(v) = val.filter(|v| !v.is_empty()) {
            rules.push((f, v.to_owned()));
        }
    };
    add(lit("{{Tên dự án}}"), Some(&v.prj_name));
    add(tok("PRJ"), Some(&v.prj));
    if htc_kind {
        add(lit("{{Tên hệ thống con}}"), v.htc_name.as_deref());
        add(lit("{{HTC}}"), v.htc.as_deref());
        add(tok("HTC"), v.htc.as_deref());
        add(lit("{{MOD}}"), v.module.as_deref());
        add(tok("MOD"), v.module.as_deref());
        add(lit("Ten_he_thong_con"), v.htc_name.as_deref().map(slug).as_deref());
    }
    if bp_kind {
        add(lit("{{Tên quy trình}}"), v.process_name.as_deref());
        // `-0NN` trước `NN` (0NN dính chữ số nên luật token không bắt được)
        add(Box::new(|s: &str, val: &str| replace_token(&s.replace("-0NN", &format!("-0{val}")), "NN", val)), nn.as_deref());
        add(lit("Ten_quy_trinh"), v.process_name.as_deref().map(slug).as_deref());
    }
    let mut in_tip = false;
    let lines: Vec<String> = t
        .template
        .replace("\r\n", "\n")
        .split('\n')
        .map(|line| {
            if line.starts_with("> [!TIP]") {
                in_tip = true;
                return line.to_owned();
            }
            if in_tip {
                if line.starts_with('>') {
                    return line.to_owned();
                }
                in_tip = false;
            }
            if line.starts_with("<div align=\"center\"><svg") {
                return line.to_owned();
            }
            let json = line.starts_with("<!-- de-diagram:");
            let mut s = line.to_owned();
            for (f, val) in &rules {
                s = f(&s, &if json { json_safe(val) } else { val.clone() });
            }
            s
        })
        .collect();
    let mut text = lines.join("\n");
    text = replace_first_line(&text, "| Ngày | YYYY-MM-DD |", &format!("| Ngày | {today} |"));
    let first_hist = "| 0.1 | YYYY-MM-DD |";
    if let Some(pos) = text.find(first_hist) {
        let line_end = text[pos..].find('\n').map(|e| pos + e).unwrap_or(text.len());
        let row = text[pos..line_end].replace("YYYY-MM-DD", today).replace("{{Họ tên}}", &escape_cell(author));
        text.replace_range(pos..line_end, &row);
    }
    text
}

fn replace_first_line(text: &str, prefix: &str, with: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut done = false;
    for (i, line) in text.split('\n').enumerate() {
        if i > 0 {
            out.push('\n');
        }
        if !done && line.starts_with(prefix) {
            out.push_str(&line.replacen(prefix, with, 1));
            done = true;
        } else {
            out.push_str(line);
        }
    }
    out
}

/// Ô bảng an toàn: `|` → `\|`, gộp khoảng trắng / xuống dòng.
pub fn escape_cell(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ").replace('|', "\\|")
}

fn split_cells(line: &str) -> Vec<String> {
    let body = line.trim();
    let body = body.strip_prefix('|').unwrap_or(body);
    let body = body.strip_suffix('|').unwrap_or(body);
    let mut cells = vec![String::new()];
    let mut prev = '\0';
    for ch in body.chars() {
        if ch == '|' && prev != '\\' {
            cells.push(String::new());
        } else {
            cells.last_mut().expect("cell").push(ch);
        }
        prev = ch;
    }
    cells.iter().map(|c| c.trim().replace("\\|", "|")).collect()
}

fn is_delimiter(line: &str) -> bool {
    let t = line.trim();
    t.starts_with('|') && t.len() > 2 && t.chars().all(|c| matches!(c, '|' | '-' | ':' | ' ' | '\t'))
}

/// Vị trí (chỉ số dòng) của bảng thuộc tính: (dòng tiêu đề bảng, các dòng dữ liệu).
fn header_table(lines: &[&str]) -> Option<(usize, Vec<usize>)> {
    let h1 = lines.iter().position(|l| l.starts_with("# "))?;
    let start = (h1 + 1..lines.len()).find(|&i| lines[i].trim_start().starts_with('|'))?;
    // chỉ chấp nhận khi giữa H1 và bảng không có tiêu đề khác
    if lines[h1 + 1..start].iter().any(|l| l.starts_with('#')) {
        return None;
    }
    let head = split_cells(lines[start]);
    if head.first().map(String::as_str) != Some("Thuộc tính") || !lines.get(start + 1).is_some_and(|l| is_delimiter(l)) {
        return None;
    }
    let rows = (start + 2..lines.len()).take_while(|&i| lines[i].trim_start().starts_with('|')).collect();
    Some((start, rows))
}

/// Các dòng của bảng thuộc tính: (tên, giá trị).
pub fn header_rows(content: &str) -> Option<Vec<(String, String)>> {
    let lines: Vec<&str> = content.lines().collect();
    let (_, rows) = header_table(&lines)?;
    Some(
        rows.iter()
            .map(|&i| {
                let c = split_cells(lines[i]);
                (c.first().cloned().unwrap_or_default(), c.get(1..).map(|r| r.join(" | ")).unwrap_or_default())
            })
            .collect(),
    )
}

/// Ghi đè giá trị các dòng thuộc tính đã có (không thêm dòng mới).
pub fn set_header_rows(content: &str, values: &[(&str, &str)]) -> String {
    let lines: Vec<&str> = content.split('\n').collect();
    let Some((_, rows)) = header_table(&lines) else { return content.to_owned() };
    let mut out: Vec<String> = lines.iter().map(|l| (*l).to_owned()).collect();
    for i in rows {
        let key = split_cells(lines[i]).first().cloned().unwrap_or_default();
        if let Some((_, v)) = values.iter().find(|(k, _)| *k == key) {
            out[i] = format!("| {key} | {} |", escape_cell(v));
        }
    }
    out.join("\n")
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct HeaderIssue {
    pub row: String,
    pub reason: String,
}

pub struct HeaderCtx<'a> {
    pub doc_type: &'a DocType,
    pub code: &'a str,
    pub subsystem_code: Option<&'a str>,
    pub process_no: Option<u8>,
}

fn strip_links(s: &str) -> String {
    let mut out = String::new();
    let mut rest = s;
    while let Some(open) = rest.find('[') {
        out.push_str(&rest[..open]);
        let after = &rest[open..];
        match (after.find("]("), after.find(')')) {
            (Some(m), Some(close)) if m < close => rest = &after[close + 1..],
            _ => {
                out.push('[');
                rest = &after[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

/// Giá trị còn là chỗ giữ chỗ của mẫu.
pub fn unfilled(value: &str, card: Cardinality) -> bool {
    let v = value.trim();
    if v.is_empty() || v == "–" || v == "-" || v.contains("{{") || v.contains("}}") || v.contains("YYYY") {
        return true;
    }
    if contains_token(v, "PRJ") {
        return true;
    }
    let plain = strip_links(v);
    if matches!(card, Cardinality::Subsystem | Cardinality::Process) && (contains_token(&plain, "HTC") || contains_token(&plain, "MOD")) {
        return true;
    }
    card == Cardinality::Process && (contains_token(&plain, "NN") || plain.contains("0NN"))
}

/// "Bảng thuộc tính đầu tài liệu đủ" (desc §5.2). Gọi **sau** khi hệ thống đã ghi các dòng Mã tài liệu, Phiên bản,
/// Ngày, Trạng thái.
pub fn check_header(content: &str, ctx: &HeaderCtx) -> Vec<HeaderIssue> {
    let issue = |row: &str, reason: &str| HeaderIssue { row: row.to_owned(), reason: reason.to_owned() };
    let Some(rows) = header_rows(content) else {
        return vec![issue("(bảng thuộc tính)", "Không thấy bảng “| Thuộc tính | Giá trị |” ngay dưới tiêu đề H1")];
    };
    let get = |k: &str| rows.iter().find(|(n, _)| n == k).map(|(_, v)| v.as_str());
    let card = ctx.doc_type.cardinality;
    let mut out = Vec::new();
    match get("Mã tài liệu") {
        Some(v) if v.trim() == ctx.code => {}
        Some(_) => out.push(issue("Mã tài liệu", &format!("Phải là {}", ctx.code))),
        None => out.push(issue("Mã tài liệu", "Thiếu dòng")),
    }
    for k in ["Phiên bản", "Ngày", "Trạng thái"] {
        if get(k).is_none_or(|v| unfilled(v, card)) {
            out.push(issue(k, "Thiếu hoặc chưa điền"));
        }
    }
    match get("Tài liệu liên quan") {
        None => out.push(issue("Tài liệu liên quan", "Thiếu dòng")),
        Some(v) if v.contains("{{") || v.contains("tầng trên · ↓ tầng dưới") || !v.contains(['↑', '↓', '⇄']) => {
            out.push(issue("Tài liệu liên quan", "Ghi các tài liệu ↑ tầng trên, ↓ tầng dưới, ⇄ ngang hàng"))
        }
        _ => {}
    }
    if !matches!(ctx.doc_type.code, "GLOSSARY" | "LOG") && get("Quy trình ISO/IEC/IEEE 12207").is_none_or(|v| unfilled(v, card)) {
        out.push(issue("Quy trình ISO/IEC/IEEE 12207", "Thiếu hoặc chưa điền"));
    }
    if card == Cardinality::Subsystem {
        let htc = ctx.subsystem_code.unwrap_or("");
        match get("Hệ thống con") {
            Some(v) if v.trim_start().starts_with(htc) && !unfilled(v, card) => {}
            Some(_) => out.push(issue("Hệ thống con", &format!("Bắt đầu bằng mã {htc} và điền tên hệ thống con"))),
            None => out.push(issue("Hệ thống con", "Thiếu dòng")),
        }
    }
    if matches!(ctx.doc_type.code, "BPMN00" | "BPMNNN") {
        let want = format!("BP-{:02}", ctx.process_no.unwrap_or(0));
        match get("Mã quy trình") {
            Some(v) if v.trim_start().starts_with(&want) && !unfilled(v, card) => {}
            _ => out.push(issue("Mã quy trình", &format!("Bắt đầu bằng {want} và điền đủ thông tin"))),
        }
    }
    for k in ["Chuẩn tham chiếu", "Nguồn đã khảo sát", "Nguồn", "Áp dụng cho"] {
        if get(k).is_some_and(|v| unfilled(v, card)) {
            out.push(issue(k, "Chưa điền – điền hoặc xoá dòng"));
        }
    }
    if ctx.doc_type.code == "BPMNNN" {
        if let Some(v) = get("Hệ thống con") {
            if unfilled(v, card) {
                out.push(issue("Hệ thống con", "Chưa điền"));
            }
        }
    }
    out
}

/// Thêm một dòng vào bảng *Lịch sử thay đổi* (cuối bảng); tạo mục nếu chưa có. Không thêm nếu dòng cuối đã giống.
pub fn append_history(content: &str, version: &str, date: &str, description: &str, actor: &str) -> String {
    let row = format!("| {} | {} | {} | {} |", escape_cell(version), escape_cell(date), escape_cell(description), escape_cell(actor));
    let text = content.replace("\r\n", "\n");
    let lines: Vec<&str> = text.split('\n').collect();
    let heading = lines.iter().rposition(|l| {
        let t = l.trim_start();
        t.starts_with('#')
            && t.trim_start_matches('#').trim().trim_start_matches(|c: char| c.is_ascii_digit() || c == '.').trim() == "Lịch sử thay đổi"
    });
    let mut out: Vec<String> = lines.iter().map(|l| (*l).to_owned()).collect();
    match heading {
        Some(h) => {
            let end = (h + 1..lines.len()).find(|&i| lines[i].starts_with('#')).unwrap_or(lines.len());
            let table = (h + 1..end).find(|&i| {
                let c = split_cells(lines[i]);
                lines[i].trim_start().starts_with('|') && c.first().map(String::as_str) == Some("Phiên bản")
            });
            match table {
                Some(t) => {
                    let last = (t + 1..end).take_while(|&i| lines[i].trim_start().starts_with('|')).last().unwrap_or(t);
                    if lines[last].trim() != row {
                        out.insert(last + 1, row);
                    }
                }
                None => {
                    out.insert(h + 1, String::new());
                    out.insert(h + 2, "| Phiên bản | Ngày | Mô tả | Người thực hiện |".into());
                    out.insert(h + 3, "|---|---|---|---|".into());
                    out.insert(h + 4, row);
                }
            }
        }
        None => {
            while out.last().is_some_and(|l| l.trim().is_empty()) {
                out.pop();
            }
            let n = lines
                .iter()
                .filter_map(|l| l.strip_prefix("## ").and_then(|r| r.split('.').next()).and_then(|n| n.trim().parse::<u32>().ok()))
                .max();
            out.push(String::new());
            out.push(match n {
                Some(n) => format!("## {}. Lịch sử thay đổi", n + 1),
                None => "## Lịch sử thay đổi".into(),
            });
            out.push(String::new());
            out.push("| Phiên bản | Ngày | Mô tả | Người thực hiện |".into());
            out.push("|---|---|---|---|".into());
            out.push(row);
        }
    }
    let mut s = out.join("\n");
    if !s.ends_with('\n') {
        s.push('\n');
    }
    s
}

/// Phần còn sót của mẫu trong toàn bộ nội dung (cảnh báo khi phát hành, README §6).
pub fn leftovers(content: &str) -> Vec<String> {
    let body: Vec<&str> =
        content.lines().filter(|l| !l.starts_with("<!-- de-diagram:") && !l.starts_with("<div align=\"center\"><svg")).collect();
    let count = |pat: &str| body.iter().map(|l| l.matches(pat).count()).sum::<usize>();
    let mut out = Vec::new();
    let n = count("{{");
    if n > 0 {
        out.push(format!("Còn {n} ô chưa điền dạng {{{{…}}}}"));
    }
    let n = count("YYYY-MM-DD");
    if n > 0 {
        out.push(format!("Còn {n} chỗ ngày YYYY-MM-DD"));
    }
    let n = count("> [!TIP]");
    if n > 0 {
        out.push(format!("Còn {n} khối hướng dẫn [!TIP] của mẫu"));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::find;

    fn srs() -> String {
        let v = FillValues {
            prj: "SHOP".into(),
            prj_name: "Cửa hàng".into(),
            htc: Some("ORD".into()),
            htc_name: Some("Đặt hàng".into()),
            module: Some("CART".into()),
            ..Default::default()
        };
        instantiate(find("SRS").unwrap(), &v, "2026-11-17", "Nguyễn An")
    }

    #[test]
    fn tokens_are_replaced_only_when_standing_alone() {
        assert_eq!(replace_token("PRJ-SRS-HTC-001 HTC2 <HTC> db_htc HTC_x", "HTC", "ORD"), "PRJ-SRS-ORD-001 HTC2 <HTC> db_htc ORD_x");
        assert!(contains_token("FR-HTC-MOD-001", "HTC") && !contains_token("HTC2", "HTC"));
        assert_eq!(slug("Đặt hàng & thanh toán"), "Dat_hang_thanh_toan");
    }

    #[test]
    fn instantiated_srs_has_concrete_codes_and_a_dated_history_row() {
        let s = srs();
        assert!(s.starts_with("# Đặc tả yêu cầu phần mềm – Đặt hàng"));
        assert!(s.contains("| Mã tài liệu | SHOP-SRS-ORD-001 |"));
        assert!(s.contains("| Ngày | 2026-11-17 |"));
        assert!(s.contains("| 0.1 | 2026-11-17 | Khởi tạo từ bộ mẫu | Nguyễn An |"));
        assert!(s.contains("FR-ORD-CART-001"));
        assert!(s.contains("SDD-ORD_Dat_hang.md"), "đích liên kết dùng tên file mới");
        // khối hướng dẫn giữ nguyên ký hiệu
        assert!(
            s.lines().filter(|l| l.starts_with("> ")).any(|l| l.contains("HTC") || l.contains("PRJ") || l.contains("MOD"))
                || !s.contains("> [!TIP]")
        );
    }

    #[test]
    fn bpmn_process_code_uses_the_process_number() {
        let v = FillValues {
            prj: "SHOP".into(),
            prj_name: "Shop".into(),
            process_no: Some(11),
            process_name: Some("Mua hàng".into()),
            ..Default::default()
        };
        let s = instantiate(find("BPMNNN").unwrap(), &v, "2026-11-17", "An");
        assert!(s.contains("| Mã tài liệu | SHOP-BPMN-011 |"));
        assert!(s.starts_with("# BP-11 Mua hàng"));
    }

    #[test]
    fn header_check_reports_missing_and_unfilled_rows() {
        let t = find("SRS").unwrap();
        let ctx = HeaderCtx { doc_type: t, code: "SHOP-SRS-ORD-001", subsystem_code: Some("ORD"), process_no: None };
        let s = srs();
        let issues = check_header(&s, &ctx);
        let rows: Vec<&str> = issues.iter().map(|i| i.row.as_str()).collect();
        // "Hệ thống con" đã được điền khi tạo từ mẫu; chỉ còn dòng nguồn khảo sát
        assert_eq!(rows, vec!["Nguồn đã khảo sát"]);
        let blank = set_header_rows(&s, &[("Hệ thống con", "HTC – {{Tên hệ thống con}}")]);
        assert!(check_header(&blank, &ctx).iter().any(|i| i.row == "Hệ thống con"));

        let fixed = set_header_rows(&s, &[("Nguồn đã khảo sát", "`repo/ord`")]);
        assert!(check_header(&fixed, &ctx).is_empty(), "{:?}", check_header(&fixed, &ctx));

        let wrong = set_header_rows(&fixed, &[("Mã tài liệu", "SHOP-SRS-PAY-001")]);
        assert_eq!(check_header(&wrong, &ctx)[0].row, "Mã tài liệu");
        assert_eq!(check_header("# X\n\nkhông có bảng\n", &ctx)[0].row, "(bảng thuộc tính)");
    }

    #[test]
    fn history_rows_are_appended_once_at_the_end_of_the_table() {
        let s = srs();
        let a = append_history(&s, "0.1", "2026-11-18", "Gửi duyệt", "Nguyễn | An");
        assert!(a.contains("| 0.1 | 2026-11-17 | Khởi tạo từ bộ mẫu | Nguyễn An |\n| 0.1 | 2026-11-18 | Gửi duyệt | Nguyễn \\| An |\n"));
        assert_eq!(append_history(&a, "0.1", "2026-11-18", "Gửi duyệt", "Nguyễn | An"), a, "không thêm trùng");
        let none = append_history("# T\n\n## 1. A\n\nx\n", "1.0", "2026-11-18", "Phát hành", "An");
        assert!(none.ends_with("## 2. Lịch sử thay đổi\n\n| Phiên bản | Ngày | Mô tả | Người thực hiện |\n|---|---|---|---|\n| 1.0 | 2026-11-18 | Phát hành | An |\n"));
        let set = set_header_rows(&s, &[("Phiên bản", "1.0"), ("Trạng thái", "Đã phát hành")]);
        assert!(set.contains("| Phiên bản | 1.0 |") && set.contains("| Trạng thái | Đã phát hành |"));
        assert!(!leftovers(&s).is_empty());
    }
}
