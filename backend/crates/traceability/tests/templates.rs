//! Chạy bộ đọc mã trên các mẫu thật của repo (đã điền PRJ=SHOP, HTC=ORD, MOD=CART, NN=11).
use chillcat_traceability::parser::{parse, Role};

fn fill(s: &str, htc: bool, nn: bool) -> String {
    let mut out = s.replace("PRJ", "SHOP");
    if htc {
        out = out.replace("HTC", "ORD").replace("MOD", "CART");
    }
    if nn {
        out = out.replace("-0NN", "-011").replace("NN", "11");
    }
    out
}

#[test]
fn every_template_parses_and_defines_its_own_kinds() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../templates");
    let cases: &[(&str, &str, bool, bool)] = &[
        ("02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md", "STRS", false, false),
        ("02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md", "SYRS", false, false),
        ("02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md", "SRS", true, false),
        ("01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md", "BMA", false, false),
        ("01_Phan_tich_nghiep_vu/BPMN-NN_Ten_quy_trinh.md", "BPMNNN", true, true),
        ("04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md", "SDD", true, false),
        ("05_Thiet_ke_du_lieu/DBD-00_Tong_quan_du_lieu.md", "DBD", false, false),
        ("05_Thiet_ke_du_lieu/ERD-HTC_CSDL_Ten_he_thong_con.md", "ERD", true, false),
        ("06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md", "ICD", false, false),
        ("07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md", "STP", false, false),
        ("08_Trien_khai_van_hanh/OPS-00_So_tay_van_hanh.md", "OPS", false, false),
        ("09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md", "ASM", false, false),
        ("03_Kien_truc/ADR/ADR-00_So_dang_ky_quyet_dinh_nen_tang.md", "ADR00", false, false),
        ("03_Kien_truc/ADR/ADR-HTC_So_dang_ky_quyet_dinh_kien_truc.md", "ADRHTC", true, false),
        ("00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md", "RTM", false, false),
        ("00_Quan_ly_tai_lieu/LOG_Nhat_ky_xay_dung_tai_lieu.md", "LOG", false, false),
    ];
    for (path, ty, htc, nn) in cases {
        let raw = std::fs::read_to_string(root.join(path)).expect(path);
        let r = parse(&fill(&raw, *htc, *nn), ty, htc.then_some("ORD"));
        let d: Vec<_> = r.occurrences.iter().filter(|o| o.role == Role::Definition).map(|o| o.code.clone()).collect();
        let f: Vec<_> = r.occurrences.iter().filter(|o| o.role == Role::Reference).map(|o| o.code.clone()).collect();
        println!("{ty:7} defs={d:?}\n        refs={f:?}");
        if !matches!(*ty, "RTM" | "BPMNNN") {
            assert!(!d.is_empty(), "{ty} phải định nghĩa ít nhất một mã");
        } else {
            assert!(d.is_empty(), "{ty} không định nghĩa mã");
        }
    }
}
