//! Danh mục 24 loại tài liệu (desc §7.1, theo bộ mẫu `templates/`), nhúng sẵn nội dung mẫu vào binary.
//!
//! Quan hệ ↑ / ⇄ mặc định lấy từ dòng "Tài liệu liên quan" của từng mẫu (desc §7.3), với một chỉnh sửa:
//! mẫu STP ghi ↑ ASM nhưng ASM ↑ OPS ↑ DEP-00 ↑ STP tạo vòng – với quy tắc "chặn phát hành khi tài liệu ↑ chưa
//! phát hành" thì cả bốn tài liệu không bao giờ phát hành được. Ở đây STP ⇄ ASM (ngang hàng). Xem docs/DECISIONS.md.

use chillcat_kernel::Cardinality;
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct DocType {
    /// Mã máy (khoá chính): `SRS`, `BPMNNN`, `ADR00`…
    pub code: &'static str,
    /// Nhãn trong mã tài liệu: `SRS`, `StRS`, `BPMN`… (giữ hoa thường).
    pub label: &'static str,
    /// Cách viết trong liên kết giữa tài liệu: `SRS-HTC`, `RTM-00`, `DOC-REG`.
    pub family: &'static str,
    pub name: &'static str,
    pub folder: &'static str,
    pub folder_label: &'static str,
    pub cardinality: Cardinality,
    /// Chỉ tạo khi cần (DEP-HTC: hệ thống con có hạ tầng riêng).
    pub optional: bool,
    pub template_path: &'static str,
    pub iso_process: &'static str,
    pub standard: Option<&'static str>,
    pub sort: u16,
    /// Bước gợi ý trong trình tự lập tài liệu (README §4).
    pub step: u8,
    pub up: &'static [&'static str],
    pub peer: &'static [&'static str],
    /// Hậu tố mã tài liệu cho loại một bản cho cả workspace (`000`, riêng CONV / GLOSSARY / LOG là `001` như mẫu).
    pub common_suffix: &'static str,
    #[serde(skip)]
    pub template: &'static str,
}

impl DocType {
    /// Mã tài liệu (desc §7.2): `PRJ-<LOẠI>-<HTC>-001` (hệ thống con), `PRJ-BPMN-0NN` (quy trình), `PRJ-<LOẠI>-000`.
    pub fn document_code(&self, prj: &str, htc: Option<&str>, process_no: Option<u8>) -> String {
        match self.cardinality {
            Cardinality::Subsystem => format!("{prj}-{}-{}-001", self.label, htc.unwrap_or("HTC")),
            Cardinality::Process => format!("{prj}-{}-{:03}", self.label, process_no.unwrap_or(0)),
            Cardinality::Workspace => format!("{prj}-{}-{}", self.label, self.common_suffix),
        }
    }
}

macro_rules! tpl {
    ($p:literal) => {
        include_str!(concat!("../../../../templates/", $p))
    };
}

#[allow(clippy::too_many_arguments)] // dựng bảng hằng: mỗi tham số là một cột của danh mục
const fn t(
    code: &'static str,
    label: &'static str,
    family: &'static str,
    name: &'static str,
    folder: &'static str,
    folder_label: &'static str,
    cardinality: Cardinality,
    template_path: &'static str,
    template: &'static str,
    iso_process: &'static str,
    standard: Option<&'static str>,
    sort: u16,
    step: u8,
    up: &'static [&'static str],
    peer: &'static [&'static str],
) -> DocType {
    DocType {
        code,
        label,
        family,
        name,
        folder,
        folder_label,
        cardinality,
        optional: false,
        template_path,
        iso_process,
        standard,
        sort,
        step,
        up,
        peer,
        common_suffix: "000",
        template,
    }
}

use Cardinality::{Process as P, Subsystem as H, Workspace as W};

const F00: (&str, &str) = ("00_Quan_ly_tai_lieu", "00 Quản lý tài liệu");
const F01: (&str, &str) = ("01_Phan_tich_nghiep_vu", "01 Phân tích nghiệp vụ");
const F02: (&str, &str) = ("02_Yeu_cau", "02 Yêu cầu");
const F03: (&str, &str) = ("03_Kien_truc", "03 Kiến trúc");
const F04: (&str, &str) = ("04_Thiet_ke_chi_tiet", "04 Thiết kế chi tiết");
const F05: (&str, &str) = ("05_Thiet_ke_du_lieu", "05 Thiết kế dữ liệu");
const F06: (&str, &str) = ("06_Giao_dien_tich_hop", "06 Giao diện và tích hợp");
const F07: (&str, &str) = ("07_Kiem_thu", "07 Kiểm thử");
const F08: (&str, &str) = ("08_Trien_khai_van_hanh", "08 Triển khai, vận hành");
const F09: (&str, &str) = ("09_Danh_gia_hien_trang", "09 Đánh giá rủi ro");

pub static TYPES: [DocType; 24] = [
    DocType {
        common_suffix: "001",
        ..t(
            "CONV",
            "CONV",
            "CONV",
            "Quy ước tài liệu và mã truy vết",
            F00.0,
            F00.1,
            W,
            "00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md",
            tpl!("00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md"),
            "6.3.6 Information Management",
            Some("ISO/IEC/IEEE 15289"),
            10,
            1,
            &[],
            &["DOCREG", "RTM", "GLOSSARY"],
        )
    },
    t(
        "DOCREG",
        "DOCREG",
        "DOC-REG",
        "Sổ đăng ký tài liệu (Document Register)",
        F00.0,
        F00.1,
        W,
        "00_Quan_ly_tai_lieu/DOC-REG_So_dang_ky_tai_lieu.md",
        tpl!("00_Quan_ly_tai_lieu/DOC-REG_So_dang_ky_tai_lieu.md"),
        "6.3.6 Information Management",
        Some("ISO/IEC/IEEE 15289"),
        20,
        1,
        &["CONV"],
        &["RTM", "LOG"],
    ),
    DocType {
        common_suffix: "001",
        ..t(
            "GLOSSARY",
            "GLOSSARY",
            "GLOSSARY",
            "Bảng thuật ngữ và từ viết tắt",
            F00.0,
            F00.1,
            W,
            "00_Quan_ly_tai_lieu/GLOSSARY_Thuat_ngu.md",
            tpl!("00_Quan_ly_tai_lieu/GLOSSARY_Thuat_ngu.md"),
            "6.3.6 Information Management",
            None,
            30,
            1,
            &[],
            &["CONV", "BMA", "SRS"],
        )
    },
    t(
        "RTM",
        "RTM",
        "RTM-00",
        "Ma trận truy vết yêu cầu (RTM)",
        F00.0,
        F00.1,
        W,
        "00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md",
        tpl!("00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md"),
        "6.3.6 Information Management · 6.4.3 Requirements Definition · 6.4.9 Verification",
        Some("ISO/IEC/IEEE 29148 §5.2.8 (truy vết)"),
        40,
        1,
        &["CONV"],
        &["DOCREG"],
    ),
    DocType {
        common_suffix: "001",
        ..t(
            "LOG",
            "LOG",
            "LOG",
            "Nhật ký lập tài liệu",
            F00.0,
            F00.1,
            W,
            "00_Quan_ly_tai_lieu/LOG_Nhat_ky_xay_dung_tai_lieu.md",
            tpl!("00_Quan_ly_tai_lieu/LOG_Nhat_ky_xay_dung_tai_lieu.md"),
            "6.3.6 Information Management",
            None,
            50,
            1,
            &[],
            &["DOCREG", "RTM"],
        )
    },
    t(
        "BMA",
        "BMA",
        "BMA-00",
        "Phân tích nghiệp vụ tổng quan",
        F01.0,
        F01.1,
        W,
        "01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md",
        tpl!("01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md"),
        "6.4.1 Business or Mission Analysis",
        None,
        60,
        3,
        &[],
        &["RTM", "GLOSSARY"],
    ),
    t(
        "BPMN00",
        "BPMN",
        "BPMN-00",
        "Bức tranh tổng thể các quy trình (cấp 0)",
        F01.0,
        F01.1,
        W,
        "01_Phan_tich_nghiep_vu/BPMN-00_Tong_the_he_thong.md",
        tpl!("01_Phan_tich_nghiep_vu/BPMN-00_Tong_the_he_thong.md"),
        "6.4.1 Business or Mission Analysis",
        None,
        70,
        3,
        &["BMA"],
        &["RTM"],
    ),
    t(
        "BPMNNN",
        "BPMN",
        "BPMN-NN",
        "Một quy trình nghiệp vụ (cấp 1)",
        F01.0,
        F01.1,
        P,
        "01_Phan_tich_nghiep_vu/BPMN-NN_Ten_quy_trinh.md",
        tpl!("01_Phan_tich_nghiep_vu/BPMN-NN_Ten_quy_trinh.md"),
        "6.4.1 Business or Mission Analysis",
        None,
        80,
        3,
        &["BMA", "BPMN00", "STRS"],
        &["RTM"],
    ),
    t(
        "STRS",
        "StRS",
        "StRS-00",
        "Đặc tả yêu cầu của các bên liên quan (StRS)",
        F02.0,
        F02.1,
        W,
        "02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md",
        tpl!("02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md"),
        "6.4.2 Stakeholder Needs and Requirements Definition",
        Some("ISO/IEC/IEEE 29148 §9.3"),
        90,
        2,
        &["BMA"],
        &["RTM"],
    ),
    t(
        "SYRS",
        "SyRS",
        "SyRS-00",
        "Đặc tả yêu cầu hệ thống (SyRS) và chỉ mục SRS",
        F02.0,
        F02.1,
        W,
        "02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md",
        tpl!("02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md"),
        "6.4.3 System/Software Requirements Definition",
        Some("ISO/IEC/IEEE 29148 §9.4"),
        100,
        4,
        &["STRS"],
        &["RTM"],
    ),
    t(
        "SRS",
        "SRS",
        "SRS-HTC",
        "Đặc tả yêu cầu phần mềm",
        F02.0,
        F02.1,
        H,
        "02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md",
        tpl!("02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md"),
        "6.4.3 System/Software Requirements Definition",
        Some("ISO/IEC/IEEE 29148 §9.5"),
        110,
        4,
        &["STRS", "SYRS"],
        &["RTM"],
    ),
    t(
        "SAD",
        "SAD",
        "SAD-00",
        "Mô tả kiến trúc tổng thể (SAD)",
        F03.0,
        F03.1,
        W,
        "03_Kien_truc/SAD-00_Kien_truc_tong_the.md",
        tpl!("03_Kien_truc/SAD-00_Kien_truc_tong_the.md"),
        "6.4.4 Architecture Definition",
        Some("ISO/IEC/IEEE 42010, C4 model"),
        120,
        5,
        &["SYRS", "STRS"],
        &[],
    ),
    t(
        "ADR00",
        "ADR",
        "ADR-00",
        "Sổ đăng ký quyết định kiến trúc cấp nền tảng (ADR)",
        "03_Kien_truc/ADR",
        F03.1,
        W,
        "03_Kien_truc/ADR/ADR-00_So_dang_ky_quyet_dinh_nen_tang.md",
        tpl!("03_Kien_truc/ADR/ADR-00_So_dang_ky_quyet_dinh_nen_tang.md"),
        "6.4.4 Architecture Definition",
        None,
        130,
        5,
        &["SAD"],
        &[],
    ),
    t(
        "ADRHTC",
        "ADR",
        "ADR-HTC",
        "Sổ đăng ký quyết định kiến trúc (ADR)",
        "03_Kien_truc/ADR",
        F03.1,
        H,
        "03_Kien_truc/ADR/ADR-HTC_So_dang_ky_quyet_dinh_kien_truc.md",
        tpl!("03_Kien_truc/ADR/ADR-HTC_So_dang_ky_quyet_dinh_kien_truc.md"),
        "6.4.4 Architecture Definition",
        None,
        140,
        5,
        &["ADR00", "SAD"],
        &[],
    ),
    t(
        "SDD",
        "SDD",
        "SDD-HTC",
        "Mô tả thiết kế phần mềm",
        F04.0,
        F04.1,
        H,
        "04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md",
        tpl!("04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md"),
        "6.4.5 Design Definition",
        Some("IEEE 1016 (viewpoint)"),
        150,
        5,
        &["SRS", "SAD", "ADRHTC"],
        &["RTM"],
    ),
    t(
        "DBD",
        "DBD",
        "DBD-00",
        "Tổng quan dữ liệu",
        F05.0,
        F05.1,
        W,
        "05_Thiet_ke_du_lieu/DBD-00_Tong_quan_du_lieu.md",
        tpl!("05_Thiet_ke_du_lieu/DBD-00_Tong_quan_du_lieu.md"),
        "6.4.5 Design Definition (dữ liệu)",
        None,
        160,
        6,
        &["SAD", "ADR00"],
        &[],
    ),
    t(
        "ERD",
        "ERD",
        "ERD-HTC",
        "Thiết kế dữ liệu",
        F05.0,
        F05.1,
        H,
        "05_Thiet_ke_du_lieu/ERD-HTC_CSDL_Ten_he_thong_con.md",
        tpl!("05_Thiet_ke_du_lieu/ERD-HTC_CSDL_Ten_he_thong_con.md"),
        "6.4.5 Design Definition (dữ liệu)",
        None,
        170,
        6,
        &["SRS", "SDD", "DBD"],
        &["RTM"],
    ),
    t(
        "ICD",
        "ICD",
        "ICD-00",
        "Tổng quan tích hợp (ICD)",
        F06.0,
        F06.1,
        W,
        "06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md",
        tpl!("06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md"),
        "6.4.4 Architecture Definition · 6.4.8 Integration",
        None,
        180,
        6,
        &["SYRS", "SAD"],
        &["RTM", "ASM"],
    ),
    t(
        "API",
        "API",
        "API-HTC",
        "Đặc tả giao diện API",
        F06.0,
        F06.1,
        H,
        "06_Giao_dien_tich_hop/API-HTC_Ten_he_thong_con.md",
        tpl!("06_Giao_dien_tich_hop/API-HTC_Ten_he_thong_con.md"),
        "6.4.4 Architecture Definition · 6.4.8 Integration",
        Some("OpenAPI 3 (tham chiếu)"),
        190,
        6,
        &["SRS", "SDD", "ICD", "ERD"],
        &["RTM"],
    ),
    t(
        "STP",
        "STP",
        "STP-00",
        "Kế hoạch kiểm thử tổng thể (Software Test Plan)",
        F07.0,
        F07.1,
        W,
        "07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md",
        tpl!("07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md"),
        "6.4.9 Verification · 6.4.11 Validation",
        Some("ISO/IEC/IEEE 29119-3"),
        200,
        7,
        &["SRS", "BPMNNN", "API"],
        &["RTM", "ASM"],
    ),
    t(
        "DEP00",
        "DEP",
        "DEP-00",
        "Hướng dẫn triển khai tổng thể",
        F08.0,
        F08.1,
        W,
        "08_Trien_khai_van_hanh/DEP-00_Trien_khai_tong_the.md",
        tpl!("08_Trien_khai_van_hanh/DEP-00_Trien_khai_tong_the.md"),
        "6.4.10 Transition · 6.4.12 Operation",
        None,
        210,
        8,
        &["SAD", "STP", "DBD"],
        &[],
    ),
    DocType {
        optional: true,
        ..t(
            "DEPHTC",
            "DEP",
            "DEP-HTC",
            "Hạ tầng riêng",
            F08.0,
            F08.1,
            H,
            "08_Trien_khai_van_hanh/DEP-HTC_Ha_tang_Ten_he_thong_con.md",
            tpl!("08_Trien_khai_van_hanh/DEP-HTC_Ha_tang_Ten_he_thong_con.md"),
            "6.4.10 Transition · 6.4.12 Operation · 6.4.13 Maintenance",
            None,
            220,
            8,
            &["DEP00", "SAD", "ADRHTC"],
            &[],
        )
    },
    t(
        "OPS",
        "OPS",
        "OPS-00",
        "Sổ tay vận hành",
        F08.0,
        F08.1,
        W,
        "08_Trien_khai_van_hanh/OPS-00_So_tay_van_hanh.md",
        tpl!("08_Trien_khai_van_hanh/OPS-00_So_tay_van_hanh.md"),
        "6.4.12 Operation · 6.4.13 Maintenance",
        None,
        230,
        8,
        &["DEP00", "DEPHTC"],
        &[],
    ),
    t(
        "ASM",
        "ASM",
        "ASM-00",
        "Rủi ro và nợ kỹ thuật",
        F09.0,
        F09.1,
        W,
        "09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md",
        tpl!("09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md"),
        "6.3.4 Risk Management · 6.3.7 Measurement",
        Some("ISO 31000 (tham khảo)"),
        240,
        9,
        &["SDD", "DBD", "ICD", "OPS"],
        &["RTM"],
    ),
];

pub fn find(code: &str) -> Option<&'static DocType> {
    TYPES.iter().find(|t| t.code.eq_ignore_ascii_case(code))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::{HashMap, HashSet};

    #[test]
    fn catalog_is_complete_and_consistent() {
        assert_eq!(TYPES.len(), 24);
        let codes: HashSet<_> = TYPES.iter().map(|t| t.code).collect();
        assert_eq!(codes.len(), 24);
        for t in &TYPES {
            assert!(t.template.starts_with("# "), "{} phải bắt đầu bằng tiêu đề H1", t.code);
            assert!(t.template.contains("Lịch sử thay đổi"), "{}", t.code);
            for r in t.up.iter().chain(t.peer) {
                assert!(codes.contains(r), "{} trỏ tới loại không tồn tại {r}", t.code);
            }
        }
        assert_eq!(TYPES.iter().filter(|t| t.cardinality == W).count(), 17);
        assert_eq!(TYPES.iter().filter(|t| t.cardinality == H).count(), 6);
    }

    #[test]
    fn up_relations_have_no_cycle() {
        let graph: HashMap<&str, &[&str]> = TYPES.iter().map(|t| (t.code, t.up)).collect();
        fn visit<'a>(n: &'a str, g: &HashMap<&'a str, &'a [&'a str]>, stack: &mut Vec<&'a str>, done: &mut HashSet<&'a str>) {
            if done.contains(n) {
                return;
            }
            assert!(!stack.contains(&n), "vòng ↑: {stack:?} → {n}");
            stack.push(n);
            for m in g[n].iter() {
                visit(m, g, stack, done);
            }
            stack.pop();
            done.insert(n);
        }
        let mut done = HashSet::new();
        for t in &TYPES {
            visit(t.code, &graph, &mut vec![], &mut done);
        }
    }

    #[test]
    fn document_codes_follow_the_templates() {
        assert_eq!(find("srs").unwrap().document_code("SHOP", Some("ORD"), None), "SHOP-SRS-ORD-001");
        assert_eq!(find("BPMNNN").unwrap().document_code("SHOP", None, Some(11)), "SHOP-BPMN-011");
        assert_eq!(find("BPMN00").unwrap().document_code("SHOP", None, None), "SHOP-BPMN-000");
        assert_eq!(find("STRS").unwrap().document_code("SHOP", None, None), "SHOP-StRS-000");
        assert_eq!(find("CONV").unwrap().document_code("SHOP", None, None), "SHOP-CONV-001");
        assert_eq!(find("ADRHTC").unwrap().document_code("SHOP", Some("PAY"), None), "SHOP-ADR-PAY-001");
        for t in &TYPES {
            let tpl_code = t.document_code("PRJ", Some("HTC"), Some(0));
            let expected = if t.code == "BPMNNN" { "PRJ-BPMN-0NN".to_owned() } else { tpl_code.clone() };
            assert!(t.template.contains(&format!("| Mã tài liệu | {expected} |")), "{}: {expected}", t.code);
        }
    }
}
