/* =========================================================================
 * Thư viện mẫu tài liệu (thư mục templates/): bộ 24 mẫu tài liệu thiết kế phần mềm theo
 * ISO/IEC/IEEE 12207, liên kết với nhau bằng mã truy vết (StR → BP → UC/FR → SEQ → bảng →
 * endpoint → TS → SEC).
 *  - Hộp chọn mẫu (nút "Mẫu" và "Tài liệu mới" ở tab Tài liệu): tìm kiếm, gợi ý bước tiếp theo.
 *  - Điền mã khi mở: thay PRJ / HTC / MOD / NN, tên dự án / hệ thống con / quy trình và ngày.
 *    Bộ mã được nhớ (localStorage) nên các tài liệu mở lần lượt dùng chung một bộ mã.
 *  - Ctrl + bấm liên kết .md trong tài liệu mở từ mẫu → mở mẫu tương ứng.
 *  - DE.docLib.skillText(): danh mục rút gọn cho AI (js/skill.js).
 * Mẫu được tải bằng fetch (cùng origin khi chạy qua http/https; mở bằng file:// thì tải từ
 * bản online). Service worker cache lại để dùng offline.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const { esc } = DE;
  const LIB = (DE.docLib = {});

  const BASE = 'templates/';
  const ONLINE = 'https://design.trungctr.com/templates/';
  const PROFILE_KEY = 'diagram-editor:doc-lib:v1';

  // kind: guide (không điền mã) · project (PRJ) · htc (PRJ, HTC, MOD) · bp (PRJ, NN, HTC, MOD)
  // step: thứ tự nên lập (README §4) · defines: mã được định nghĩa trong tài liệu
  const G = {
    0: '00 Quản lý tài liệu',
    1: '01 Phân tích nghiệp vụ',
    2: '02 Yêu cầu',
    3: '03 Kiến trúc',
    4: '04 Thiết kế chi tiết',
    5: '05 Thiết kế dữ liệu',
    6: '06 Giao diện và tích hợp',
    7: '07 Kiểm thử',
    8: '08 Triển khai, vận hành',
    9: '09 Đánh giá rủi ro',
  };
  const CATALOG = [
    { path: 'README.md', code: 'Hướng dẫn', title: 'Hướng dẫn dùng bộ mẫu', group: 'Bắt đầu', kind: 'guide', step: 0,
      desc: 'Sơ đồ quan hệ giữa các tài liệu, thứ tự lập, sợi truy vết mẫu, danh sách kiểm tra trước khi phát hành',
      keys: 'readme huong dan bo mau truy vet', sections: 'Quan hệ tài liệu · Cấu trúc thư mục · Ký hiệu thay thế · Lập bộ tài liệu · Sợi truy vết mẫu · Kiểm tra' },

    { path: '00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md', code: 'CONV', title: 'Quy ước tài liệu và mã truy vết', group: G[0], kind: 'project', step: 1,
      desc: 'Mã dự án, danh sách hệ thống con, mọi loại mã truy vết (nơi định nghĩa, nơi tham chiếu), ký hiệu sơ đồ',
      defines: 'HTC, loại mã', keys: 'quy uoc ma ky hieu convention',
      sections: 'Thư mục và câu hỏi mỗi thư mục trả lời · Mã hệ thống con · Nhiều sản phẩm · Mã tài liệu · Mã phần tử truy vết · Đầu và cuối tài liệu · Hai cách lập tài liệu · Liên kết · Sơ đồ · Mục bắt buộc · Phiên bản' },
    { path: '00_Quan_ly_tai_lieu/DOC-REG_So_dang_ky_tai_lieu.md', code: 'DOC-REG', title: 'Sổ đăng ký tài liệu', group: G[0], kind: 'project', step: 1,
      desc: 'Mỗi tài liệu một dòng: mã, liên kết, phiên bản, trạng thái', defines: 'mã tài liệu', keys: 'so dang ky register danh sach tai lieu',
      sections: 'Một bảng cho mỗi thư mục 00–09 · Lưu trữ' },
    { path: '00_Quan_ly_tai_lieu/GLOSSARY_Thuat_ngu.md', code: 'GLOSSARY', title: 'Bảng thuật ngữ', group: G[0], kind: 'project', step: 1,
      desc: 'Thuật ngữ nghiệp vụ, kỹ thuật và từ viết tắt dùng chung', keys: 'thuat ngu glossary tu viet tat',
      sections: 'Thuật ngữ nghiệp vụ · Thuật ngữ kỹ thuật · Từ viết tắt' },
    { path: '00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md', code: 'RTM-00', title: 'Ma trận truy vết', group: G[0], kind: 'project', step: 1,
      desc: 'Nối quy trình → use case → thiết kế → dữ liệu → API → kiểm thử → rủi ro; bảng "sửa chỗ này thì xem lại chỗ nào"', keys: 'ma tran truy vet traceability rtm tac dong thay doi',
      sections: 'Theo quy trình (BP) · Theo yêu cầu (FR) · Nhu cầu đáp ứng tới đâu · Sửa chỗ này thì xem lại chỗ nào' },
    { path: '00_Quan_ly_tai_lieu/LOG_Nhat_ky_xay_dung_tai_lieu.md', code: 'LOG', title: 'Nhật ký lập tài liệu', group: G[0], kind: 'project', step: 1,
      desc: 'Cách làm, các đợt cập nhật, trục trặc và việc còn dở khi lập bộ tài liệu', defines: 'S-nn', keys: 'nhat ky log su co ton dong',
      sections: 'Cách làm · Các đợt cập nhật · Trục trặc (S) · Việc còn dở · Phát hiện bên lề' },

    { path: '01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md', code: 'BMA-00', title: 'Phân tích nghiệp vụ tổng quan', group: G[1], kind: 'project', step: 3,
      desc: 'Bối cảnh, những ai liên quan, hệ thống làm được gì, danh sách quy trình duy nhất của dự án', defines: 'danh mục BP-nn',
      keys: 'nghiep vu tong quan business analysis nang luc chuoi gia tri danh muc quy trinh',
      sections: 'Bối cảnh · Những ai liên quan · Hệ thống làm được gì (sơ đồ) · Danh sách quy trình BP-nn · Chuỗi giá trị · Năng lực có nhiều bản cài đặt · Điểm nghẽn' },
    { path: '01_Phan_tich_nghiep_vu/BPMN-00_Tong_the_he_thong.md', code: 'BPMN-00', title: 'Bức tranh tổng thể các quy trình (cấp 0)', group: G[1], kind: 'project', step: 3,
      desc: 'Sơ đồ BPMN cấp 0, mỗi call activity trỏ tới một quy trình cấp 1', defines: 'BP-00', keys: 'bpmn tong the cap 0 quy trinh',
      sections: 'Tóm tắt · Sơ đồ BPMN cấp 0 · Các bước · Rẽ nhánh' },
    { path: '01_Phan_tich_nghiep_vu/BPMN-NN_Ten_quy_trinh.md', code: 'BPMN-NN', title: 'Một quy trình nghiệp vụ (cấp 1)', group: G[1], kind: 'bp', step: 3, copy: 'mỗi quy trình',
      desc: 'Pool / lane, các bước có id khớp sơ đồ, cột liên quan chỉ xuống UC / FR / BR', defines: 'BP-NN, id bước',
      keys: 'bpmn quy trinh nghiep vu process lane pool buoc cong xor',
      sections: 'Mục tiêu và giới hạn · Tóm tắt (nhu cầu StR, người chịu trách nhiệm, bắt đầu khi, kết quả) · Sơ đồ BPMN · Các bước (id, loại, lane, liên quan UC/FR/BR) · Rẽ nhánh · Quy tắc áp dụng · Lưu ý · Tham khảo' },

    { path: '02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md', code: 'StRS-00', title: 'Yêu cầu các bên liên quan', group: G[2], kind: 'project', step: 2,
      desc: 'Mỗi bên liên quan cần gì, vì sao, ưu tiên ra sao, thế nào là đạt, quy trình nào đáp ứng', defines: 'SH-, StR-, StC-',
      keys: 'stakeholder nhu cau ben lien quan strs yeu cau',
      sections: 'Bên liên quan (SH) · Nhu cầu (StR: ai cần, cần gì, vì sao, ưu tiên, quy trình, thế nào là đạt) · Ràng buộc (StC)' },
    { path: '02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md', code: 'SyRS-00', title: 'Yêu cầu hệ thống', group: G[2], kind: 'project', step: 4,
      desc: 'Việc lớn của hệ thống giao cho từng hệ thống con, yêu cầu chất lượng chung, kết nối ra ngoài, danh sách SRS', defines: 'SYS-F, SYS-N, SYS-I',
      keys: 'syrs yeu cau he thong phan bo phi chuc nang',
      sections: 'Phạm vi · Danh sách SRS · Việc lớn và hệ thống con đảm nhận (SYS-F) · Yêu cầu chất lượng chung (SYS-N) · Kết nối ra bên ngoài (SYS-I)' },
    { path: '02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md', code: 'SRS-HTC', title: 'Đặc tả yêu cầu phần mềm', group: G[2], kind: 'htc', step: 4, copy: 'mỗi hệ thống con',
      desc: 'Tác nhân, use case (sơ đồ + đặc tả), FR, NFR, quy tắc nghiệp vụ – mỗi mục trỏ lên BP và SYS', defines: 'A-, UC-, FR-, NFR-, BR-',
      keys: 'srs dac ta yeu cau phan mem use case chuc nang fr nfr quy tac nghiep vu',
      sections: 'Giới thiệu (mục đích, phạm vi module, định nghĩa) · Bối cảnh (sơ đồ) · Tác nhân · Sơ đồ use case · Đặc tả use case (tác nhân, quy trình BP, tiền điều kiện, luồng chính / thay thế, ngoại lệ, hậu điều kiện, FR, SEQ, nguồn) · FR (UC, SYS, ưu tiên) · NFR · BR' },

    { path: '03_Kien_truc/SAD-00_Kien_truc_tong_the.md', code: 'SAD-00', title: 'Kiến trúc tổng thể', group: G[3], kind: 'project', step: 5,
      desc: 'Ngữ cảnh và container (C4), triển khai, ai giữ dữ liệu nào, tích hợp, bảo mật, chất lượng', keys: 'sad kien truc architecture c4 deployment bao mat chat luong',
      sections: 'Ai đọc · Tổng quan · Ngữ cảnh C4 cấp 1 · Container C4 cấp 2 · Ai làm gì, giữ dữ liệu nào · Triển khai · Tích hợp · Bảo mật · Chất lượng · Điểm yếu · Quyết định' },
    { path: '03_Kien_truc/ADR/ADR-00_So_dang_ky_quyet_dinh_nen_tang.md', code: 'ADR-00', title: 'Quyết định kiến trúc cấp nền tảng', group: G[3], kind: 'project', step: 5,
      desc: 'Quyết định ảnh hưởng nhiều hệ thống con: vì sao, phương án đã cân nhắc, hệ quả', defines: 'ADR-00-nn', keys: 'adr quyet dinh kien truc nen tang decision',
      sections: 'Danh sách quyết định (vì sao, phương án, hệ quả, ảnh hưởng) · Nên làm gì tiếp' },
    { path: '03_Kien_truc/ADR/ADR-HTC_So_dang_ky_quyet_dinh_kien_truc.md', code: 'ADR-HTC', title: 'Quyết định kiến trúc của hệ thống con', group: G[3], kind: 'htc', step: 5, copy: 'mỗi hệ thống con',
      desc: 'Danh sách và chi tiết quyết định, ghi chỗ mã làm đúng hay khác', defines: 'ADR-HTC-nnn', keys: 'adr quyet dinh kien truc he thong con decision',
      sections: 'Danh sách · Quyết định quan trọng (bối cảnh, quyết định, phương án, hệ quả, trong mã)' },

    { path: '04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md', code: 'SDD-HTC', title: 'Thiết kế chi tiết (IEEE 1016)', group: G[4], kind: 'htc', step: 5, copy: 'mỗi hệ thống con',
      desc: 'Thành phần, class, sequence, state machine, thuật toán – mỗi sơ đồ ghi UC / FR / BR mà nó hiện thực', defines: 'SEQ-, STM-, ACT-, RISK-, TD-',
      keys: 'sdd thiet ke chi tiet design sequence class state machine thanh phan component',
      sections: 'Context · Composition (sơ đồ thành phần, bảng trách nhiệm + FR) · Logical (class) · Interaction (SEQ-nn) · State dynamics (STM-nn) · Algorithm (ACT-nn) · Interface · Khía cạnh dùng chung · Nợ kỹ thuật (RISK / TD)' },

    { path: '05_Thiet_ke_du_lieu/DBD-00_Tong_quan_du_lieu.md', code: 'DBD-00', title: 'Tổng quan dữ liệu', group: G[5], kind: 'project', step: 6,
      desc: 'Các CSDL, ai được ghi và đổi cấu trúc, cách tách dữ liệu theo khách hàng, liên kết giữa các CSDL', defines: 'DG-nn', keys: 'dbd du lieu tong quan csdl database tenant',
      sections: 'Sơ đồ các CSDL · Danh sách CSDL · Tách dữ liệu theo khách hàng · Liên kết giữa các CSDL · Vấn đề về dữ liệu (DG)' },
    { path: '05_Thiet_ke_du_lieu/ERD-HTC_CSDL_Ten_he_thong_con.md', code: 'ERD-HTC', title: 'ERD và từ điển dữ liệu', group: G[5], kind: 'htc', step: 6, copy: 'mỗi hệ thống con',
      desc: 'ERD theo miền, từ điển dữ liệu; mỗi bảng ghi FR / STM / endpoint dùng nó', defines: 'tên bảng, C-nn',
      keys: 'erd du lieu bang cot tu dien du lieu database schema',
      sections: 'Lưu ở đâu · Ai kết nối tới · ERD theo miền · Từ điển dữ liệu (mỗi bảng: Dùng bởi, cột, kiểu, khoá) · Enum / chỉ mục · Liên kết sang CSDL khác, chỗ hiểu khác nhau (C)' },

    { path: '06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md', code: 'ICD-00', title: 'Tổng quan tích hợp', group: G[6], kind: 'project', step: 6,
      desc: 'Dịch vụ, cổng, cách xác thực, ai gọi ai, sự kiện, chỗ gọi nhưng không khớp', defines: 'AUTH-, I-, GAP-',
      keys: 'icd tich hop integration xac thuc cong dich vu',
      sections: 'Dịch vụ đang chạy · Cách xác thực (AUTH) · Ai gọi ai (I) · Sự kiện · Gọi nhưng không khớp (GAP)' },
    { path: '06_Giao_dien_tich_hop/API-HTC_Ten_he_thong_con.md', code: 'API-HTC', title: 'Đặc tả API', group: G[6], kind: 'htc', step: 6, copy: 'mỗi hệ thống con',
      desc: 'Endpoint có cột FR và SEQ, dữ liệu gửi, mã lỗi, sự kiện, lời gọi sang hệ thống khác', defines: 'endpoint, sự kiện',
      keys: 'api endpoint rest websocket payload ma loi su kien',
      sections: 'Địa chỉ và cổng · Xác thực · Mã lỗi (BR) · Endpoint (method, path, ai được gọi, FR, SEQ, nguồn) · Dữ liệu gửi · Sự kiện phát ra · Gọi sang hệ thống khác (I)' },

    { path: '07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md', code: 'STP-00', title: 'Kế hoạch kiểm thử', group: G[7], kind: 'project', step: 7,
      desc: 'Ưu tiên theo rủi ro, bộ kiểm thử chứng minh FR / BR / SEC, kịch bản đầu-cuối cho từng quy trình', defines: 'TS-nn',
      keys: 'stp kiem thu test plan e2e ci chat luong',
      sections: 'Đang có gì · Nguyên tắc · Cấp độ · Bộ kiểm thử (TS: chứng minh FR/NFR/BR/BP/SEC) · Kịch bản đầu-cuối theo quy trình · Môi trường · Khi nào bắt đầu / được phát hành · CI' },

    { path: '08_Trien_khai_van_hanh/DEP-00_Trien_khai_tong_the.md', code: 'DEP-00', title: 'Triển khai tổng thể', group: G[8], kind: 'project', step: 8,
      desc: 'Môi trường, tiến trình, đường dẫn, biến môi trường (chỉ tên), phát hành, đổi cấu trúc CSDL', keys: 'dep trien khai deploy phat hanh moi truong',
      sections: 'Môi trường · Tiến trình · Đường dẫn · Biến môi trường · Phát hành · Đổi cấu trúc CSDL' },
    { path: '08_Trien_khai_van_hanh/DEP-HTC_Ha_tang_Ten_he_thong_con.md', code: 'DEP-HTC', title: 'Hạ tầng riêng của hệ thống con', group: G[8], kind: 'htc', step: 8, copy: 'hệ thống con có hạ tầng riêng',
      desc: 'Mạng, máy chạy, lưu trữ, đường phát hành, cổng, bí mật, sao lưu cho hệ thống con có hạ tầng riêng', keys: 'ha tang infrastructure cloud terraform ci cd',
      sections: 'Phạm vi · Hạ tầng (mạng, máy chạy, lưu trữ, quyền và theo dõi) · Sơ đồ triển khai · Môi trường · Đường phát hành · Cổng và biến môi trường · Vận hành · Rủi ro' },
    { path: '08_Trien_khai_van_hanh/OPS-00_So_tay_van_hanh.md', code: 'OPS-00', title: 'Sổ tay vận hành', group: G[8], kind: 'project', step: 8,
      desc: 'Lệnh hằng ngày, việc chạy theo lịch, xử lý sự cố, sao lưu, theo dõi, ai trực', defines: 'OP-nn', keys: 'ops van hanh runbook su co giam sat sao luu',
      sections: 'Lệnh hằng ngày · Việc theo lịch · Khi có sự cố (OP) · Sao lưu · Đổi bí mật · Theo dõi · Giới hạn · Ai trực' },

    { path: '09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md', code: 'ASM-00', title: 'Rủi ro và nợ kỹ thuật', group: G[9], kind: 'project', step: 9,
      desc: 'Rủi ro bảo mật (mỗi rủi ro ghi bộ kiểm thử chứng minh đã sửa), rủi ro dữ liệu / tích hợp, thứ tự xử lý', defines: 'SEC-nn',
      keys: 'asm danh gia rui ro bao mat no ky thuat lo trinh',
      sections: 'Tóm tắt cho người quyết định · Cách xếp mức · Rủi ro bảo mật (SEC) · Dữ liệu và tích hợp · Năng lực làm hai lần · Thành phần dở dang · Tài liệu cũ không còn đúng · Kiểm thử và CI · Vận hành · Nợ kỹ thuật theo hệ thống con · Thứ tự xử lý' },
  ];
  LIB.CATALOG = CATALOG;

  // ------------------------------------------------------------------ hồ sơ mã
  const lsGet = (k) => {
    try {
      return localStorage.getItem(k);
    } catch (_) {
      return null;
    }
  };
  const lsSet = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch (_) {
      /* chế độ riêng tư / hết dung lượng */
    }
  };
  function profile() {
    let p = {};
    try {
      p = JSON.parse(lsGet(PROFILE_KEY) || '{}') || {};
    } catch (_) {
      p = {};
    }
    return Object.assign({ prj: '', prjName: '', htc: '', htcName: '', mod: '', nn: '', bpName: '', fill: true, opened: [] }, p);
  }
  const saveProfile = (p) => lsSet(PROFILE_KEY, JSON.stringify(p));
  LIB.profile = profile;

  // bỏ dấu tiếng Việt: dùng cho tìm kiếm và tên file
  const plain = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  const slug = (s) =>
    plain(s)
      .trim()
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // ------------------------------------------------------------------ điền mã
  const tok = (t) => new RegExp(`(?<![A-Za-z0-9<])${t}(?![A-Za-z0-9>])`, 'g');

  /** Các cặp [regex, giá trị] áp dụng cho một mẫu theo loại của nó */
  function rules(entry, v) {
    const r = [];
    const add = (re, val) => val && r.push([re, val]);
    add(/\{\{Tên dự án\}\}/g, v.prjName);
    add(tok('PRJ'), v.prj);
    if (entry.kind === 'htc' || entry.kind === 'bp') {
      add(/\{\{Tên hệ thống con\}\}/g, v.htcName);
      add(/\{\{HTC\}\}/g, v.htc);
      add(tok('HTC'), v.htc);
      add(/\{\{MOD\}\}/g, v.mod);
      add(tok('MOD'), v.mod);
      if (v.htcName) add(/Ten_he_thong_con/g, slug(v.htcName));
    }
    if (entry.kind === 'bp') {
      add(/\{\{Tên quy trình\}\}/g, v.bpName);
      add(/-0NN(?![A-Za-z0-9])/g, v.nn && '-0' + v.nn);
      add(tok('NN'), v.nn);
      if (v.bpName) add(/Ten_quy_trinh/g, slug(v.bpName));
    }
    return r;
  }

  /** Điền mã vào nội dung mẫu. Bỏ qua khối [!TIP] (hướng dẫn nói về chính các ký hiệu) và dòng SVG */
  function fill(raw, entry, v) {
    const R = rules(entry, v);
    const jsonSafe = (s) => JSON.stringify(String(s)).slice(1, -1).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    let inTip = false;
    const out = raw.split('\n').map((line) => {
      if (/^> \[!TIP\]/.test(line)) {
        inTip = true;
        return line;
      }
      if (inTip) {
        if (line.startsWith('>')) return line;
        inTip = false;
      }
      if (line.startsWith('<div align="center"><svg')) return line; // ảnh: app vẽ lại từ JSON khi lưu
      const json = line.startsWith('<!-- de-diagram:');
      let s = line;
      for (const [re, val] of R) s = s.replace(re, json ? jsonSafe(val) : val);
      return s;
    });
    let text = out.join('\n');
    const d = today();
    text = text.replace(/^\| Ngày \| YYYY-MM-DD \|/m, `| Ngày | ${d} |`).replace(/^\| 0\.1 \| YYYY-MM-DD \|/m, `| 0.1 | ${d} |`);
    return text;
  }

  function fileName(entry, v) {
    let n = entry.path.split('/').pop();
    for (const [re, val] of rules(entry, v)) n = n.replace(re, val);
    return n;
  }

  // ------------------------------------------------------------------ tải mẫu
  async function fetchTemplate(path) {
    const urls = [];
    if (/^https?:$/.test(location.protocol)) urls.push(new URL(BASE + path, location.href).href);
    urls.push(ONLINE + path);
    let lastErr = null;
    for (const u of urls) {
      try {
        const res = await fetch(u, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const t = await res.text();
        if (/^\s*</.test(t)) throw new Error('máy chủ trả về HTML thay vì Markdown'); // GitHub Pages chưa có .nojekyll
        return t.replace(/\r\n?/g, '\n');
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('không tải được');
  }

  // tải trước toàn bộ mẫu (service worker cache lại) để dùng được khi offline
  let warmed = false;
  function warmCache() {
    if (warmed || !/^https?:$/.test(location.protocol) || !navigator.onLine) return;
    warmed = true;
    const run = () => CATALOG.forEach((e) => fetch(BASE + e.path).catch(() => {}));
    if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 4000 });
    else setTimeout(run, 1500);
  }

  // ------------------------------------------------------------------ mở mẫu
  const byPath = (p) => CATALOG.find((e) => e.path === p);

  /** Mở một mẫu: hỏi / dùng bộ mã rồi đưa vào tab Tài liệu */
  LIB.open = async function (path, { ask = true, values = null } = {}) {
    const entry = byPath(path);
    if (!entry) return DE.ui.toast(`Không có mẫu "${path}"`, 'error');
    const p = profile();
    let v = values;
    if (!v && entry.kind !== 'guide') {
      if (ask) {
        v = await fillDialog(entry, p);
        if (v === null) return; // huỷ
      } else if (p.fill) v = p;
    }
    let raw;
    try {
      DE.ui.toast(`Đang tải mẫu ${entry.code}…`, 'info');
      raw = await fetchTemplate(path);
    } catch (e) {
      return DE.ui.toast(
        `Không tải được mẫu ${entry.code} (${e.message}). Cần kết nối mạng, hoặc mở app qua http(s) – ví dụ https://design.trungctr.com/`,
        'error'
      );
    }
    const filled = v && v !== false;
    const text = filled ? fill(raw, entry, v) : raw;
    const name = filled ? fileName(entry, v) : entry.path.split('/').pop();
    const ok = await DE.docs.openLibraryDoc(text, { name, libPath: path, confirmTitle: `Mở mẫu ${entry.code}?` });
    if (!ok) return;
    const q = profile();
    if (!q.opened.includes(path)) q.opened.push(path);
    saveProfile(q);
  };

  /**
   * Liên kết tương đối trong tài liệu mở từ mẫu → mẫu đích. Trả về entry hoặc null.
   * Tên file có thể đã được điền mã (SRS-ORD_Dat_hang.md) nên so theo thư mục + tiền tố loại.
   */
  LIB.resolve = function (href, fromPath) {
    if (!fromPath || !href || /^[a-z]+:/i.test(href) || href.startsWith('#')) return null;
    const clean = decodeURIComponent(href.split('#')[0]);
    if (!/\.md$/i.test(clean)) return null;
    const parts = fromPath.split('/').slice(0, -1);
    for (const seg of clean.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg && seg !== '.') parts.push(seg);
    }
    const target = parts.join('/');
    const exact = byPath(target);
    if (exact) return exact;
    const dir = parts.slice(0, -1).join('/');
    const file = parts[parts.length - 1];
    return (
      CATALOG.find((e) => {
        const ed = e.path.split('/').slice(0, -1).join('/');
        const ef = e.path.split('/').pop();
        const m = ef.match(/^([A-Za-z]+)-(HTC|NN)_/);
        if (ed !== dir || !m) return false;
        return file.startsWith(m[1] + '-') && !/^[A-Za-z]+-00_/.test(file);
      }) || null
    );
  };

  /** Ctrl + bấm liên kết .md: mở mẫu tương ứng (dùng bộ mã đã nhớ). true nếu đã xử lý */
  LIB.follow = function (href, fromPath) {
    const e = LIB.resolve(href, fromPath);
    if (!e) return false;
    LIB.open(e.path, { ask: false });
    return true;
  };

  // ------------------------------------------------------------------ hộp thoại
  function modal(html, cls) {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(back);
    return back;
  }
  function trapKeys(back, close) {
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        close(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }

  const FIELDS = {
    prj: { label: 'Mã dự án (thay PRJ)', ph: 'VD: SHOP', code: true },
    prjName: { label: 'Tên dự án', ph: 'VD: Cửa hàng trực tuyến' },
    htc: { label: 'Mã hệ thống con (thay HTC)', ph: 'VD: ORD', code: true },
    htcName: { label: 'Tên hệ thống con', ph: 'VD: Đặt hàng' },
    mod: { label: 'Mã module (thay MOD)', ph: 'VD: CART', code: true },
    nn: { label: 'Số quy trình (thay NN, 2 chữ số)', ph: 'VD: 11', nn: true },
    bpName: { label: 'Tên quy trình', ph: 'VD: Mua hàng và thanh toán' },
  };
  const KIND_FIELDS = { project: ['prj', 'prjName'], htc: ['prj', 'prjName', 'htc', 'htcName', 'mod'], bp: ['prj', 'prjName', 'nn', 'bpName', 'htc', 'mod'] };

  /** Hỏi bộ mã. Trả về object giá trị, false (mở nguyên mẫu) hoặc null (huỷ) */
  function fillDialog(entry, p) {
    return new Promise((resolve) => {
      const keys = KIND_FIELDS[entry.kind] || ['prj', 'prjName'];
      const html =
        `<form class="dl-fill"><h3>Mở mẫu ${esc(entry.code)} – ${esc(entry.title)}</h3>` +
        `<p class="modal-msg">Điền mã để app thay các ký hiệu trong mẫu và đặt tên file. Bộ mã được nhớ cho các mẫu mở sau, ` +
        `nên mọi tài liệu dùng chung một bộ mã. Ô để trống thì giữ nguyên ký hiệu.</p><div class="dl-fill-grid">` +
        keys
          .map((k) => {
            const f = FIELDS[k];
            return `<label class="f"><span>${esc(f.label)}</span><input name="${k}" value="${esc(p[k] || '')}" placeholder="${esc(f.ph)}" autocomplete="off" spellcheck="false"${f.code ? ' class="dl-code-in"' : ''}${f.nn ? ' inputmode="numeric" maxlength="2"' : ''}></label>`;
          })
          .join('') +
        `</div><p class="dl-err" hidden></p><div class="modal-actions">` +
        `<button type="button" class="btn" data-r="cancel">Huỷ</button>` +
        `<button type="button" class="btn" data-r="raw" title="Giữ nguyên các ký hiệu PRJ, HTC, MOD, NN">Mở nguyên mẫu</button>` +
        `<button type="submit" class="btn primary">Mở và điền mã</button></div></form>`;
      const back = modal(html, 'dl-fill-modal');
      const form = back.querySelector('form');
      let untrap = () => {};
      const close = (val) => {
        untrap();
        back.remove();
        resolve(val);
      };
      untrap = trapKeys(back, close);
      form.querySelectorAll('.dl-code-in').forEach((i) => i.addEventListener('input', () => (i.value = i.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = {};
        keys.forEach((k) => (v[k] = form.elements[k].value.trim()));
        const err = form.querySelector('.dl-err');
        if (v.nn && !/^\d{2}$/.test(v.nn)) {
          err.textContent = 'Số quy trình gồm đúng 2 chữ số, ví dụ 11 (nhóm 10–19), 20 (nhóm 20–29).';
          err.hidden = false;
          return form.elements.nn.focus();
        }
        const q = Object.assign(profile(), v, { fill: true });
        saveProfile(q);
        close(q);
      });
      back.addEventListener('click', (e) => {
        if (e.target === back) return close(null);
        const b = e.target.closest('[data-r]');
        if (!b) return;
        if (b.dataset.r === 'cancel') close(null);
        else if (b.dataset.r === 'raw') {
          saveProfile(Object.assign(profile(), { fill: false }));
          close(false);
        }
      });
      const first = [...form.querySelectorAll('input')].find((i) => !i.value) || form.querySelector('input');
      first.focus();
      first.select();
    });
  }

  /** Gợi ý tiếp theo: các mẫu chưa mở, theo thứ tự nên lập */
  function suggestions(p) {
    const order = CATALOG.filter((e) => e.step > 0).sort((a, b) => a.step - b.step);
    const fresh = order.filter((e) => !p.opened.includes(e.path));
    if (!p.opened.length) return ['00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md', '02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md', '01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md'].map(byPath);
    return fresh.filter((e) => e.kind !== 'project' || e.step > 1).slice(0, 3);
  }

  function card(e, extra = '') {
    const meta = [e.defines ? `Định nghĩa: ${esc(e.defines)}` : '', e.copy ? `⧉ Nhân bản cho ${esc(e.copy)}` : ''].filter(Boolean).join(' · ');
    return (
      `<button type="button" class="dl-card${extra}" data-path="${esc(e.path)}" title="${esc(e.path)}">` +
      `<span class="dl-top"><span class="dl-code">${esc(e.code)}</span>${e.step ? `<span class="dl-step" title="Thứ tự nên lập">Bước ${e.step}</span>` : ''}</span>` +
      `<b>${esc(e.title)}</b><span class="dl-desc">${esc(e.desc)}</span>${meta ? `<span class="dl-meta">${meta}</span>` : ''}</button>`
    );
  }

  /**
   * Hộp chọn mẫu. opts.blank: hiện thẻ "Tài liệu trống" (khi bấm Tài liệu mới) – trả về 'blank'.
   * Trả về Promise: 'blank' | path đã mở | null
   */
  LIB.gallery = function ({ blank = false } = {}) {
    warmCache();
    return new Promise((resolve) => {
      const p = profile();
      const sug = suggestions(p).filter(Boolean);
      const groups = [];
      for (const e of CATALOG) {
        if (e.kind === 'guide') continue;
        let g = groups.find((x) => x.name === e.group);
        if (!g) groups.push((g = { name: e.group, items: [] }));
        g.items.push(e);
      }
      const codes = [p.prj, p.htc, p.mod, p.nn && 'BP-' + p.nn].filter(Boolean).join(' · ');
      const html =
        `<div class="dl-head"><h3>Mẫu tài liệu thiết kế phần mềm</h3>` +
        `<input type="search" class="dl-search" placeholder="Tìm: SRS, ERD, API, quy trình, kiểm thử, rủi ro…" aria-label="Tìm mẫu"></div>` +
        `<p class="modal-msg">24 mẫu theo ISO/IEC/IEEE 12207, nối với nhau bằng mã truy vết: nhu cầu (StR) → quy trình (BP) → use case, yêu cầu (UC, FR) → thiết kế (SEQ) → bảng dữ liệu → API → kiểm thử (TS) → rủi ro (SEC). ` +
        `Mỗi mẫu có hướng dẫn điền và sơ đồ khung sửa được trên whiteboard.</p>` +
        `<div class="dl-body">` +
        `<section class="dl-sec dl-start"><h4>${p.opened.length ? 'Gợi ý tiếp theo' : 'Gợi ý bắt đầu'}</h4><div class="dl-grid">` +
        (blank ? `<button type="button" class="dl-card dl-blank" data-blank="1"><span class="dl-top"><span class="dl-code">Trống</span></span><b>Tài liệu trống</b><span class="dl-desc">Bắt đầu từ trang trắng</span></button>` : '') +
        sug.map((e) => card(e, ' dl-sug')).join('') +
        card(byPath('README.md'), ' dl-guide') +
        `</div></section>` +
        groups.map((g) => `<section class="dl-sec"><h4>${esc(g.name)}</h4><div class="dl-grid">${g.items.map((e) => card(e)).join('')}</div></section>`).join('') +
        `<p class="dl-empty" hidden>Không có mẫu nào khớp.</p></div>` +
        `<div class="dl-foot"><span class="dl-codes" title="Bộ mã đang nhớ – sửa khi mở mẫu">${codes ? 'Bộ mã: ' + esc(codes) : 'Chưa có bộ mã – sẽ hỏi khi mở mẫu đầu tiên'}</span>` +
        `<button type="button" class="btn" data-r="cancel">Đóng</button></div>`;
      const back = modal(html, 'dl-modal');
      let untrap = () => {};
      const close = (val) => {
        untrap();
        back.remove();
        resolve(val);
      };
      untrap = trapKeys(back, close);
      const search = back.querySelector('.dl-search');
      const index = [...back.querySelectorAll('.dl-card[data-path]')].map((el) => {
        const e = byPath(el.dataset.path);
        return { el, text: plain([e.code, e.title, e.desc, e.defines, e.keys, e.group].join(' ')).toLowerCase() };
      });
      search.addEventListener('input', () => {
        const q = plain(search.value.trim()).toLowerCase();
        const words = q.split(/\s+/).filter(Boolean);
        let shown = 0;
        index.forEach(({ el, text }) => {
          const hit = words.every((w) => text.includes(w));
          el.hidden = !hit;
          if (hit && !el.closest('.dl-start')) shown++;
        });
        back.querySelectorAll('.dl-sec').forEach((s) => (s.hidden = ![...s.querySelectorAll('.dl-card')].some((c) => !c.hidden)));
        back.querySelector('.dl-empty').hidden = shown > 0 || !q;
      });
      back.addEventListener('click', (e) => {
        if (e.target === back || e.target.closest('[data-r="cancel"]')) return close(null);
        const c = e.target.closest('.dl-card');
        if (!c) return;
        if (c.dataset.blank) return close('blank');
        close(c.dataset.path);
        LIB.open(c.dataset.path);
      });
      search.focus();
    });
  };

  // ------------------------------------------------------------------ cho AI
  /** Danh mục rút gọn để AI viết đúng cấu trúc và hệ thống mã của bộ mẫu */
  LIB.skillText = function () {
    const L = [];
    L.push('## Bộ mẫu tài liệu thiết kế phần mềm (ISO/IEC/IEEE 12207)');
    L.push('App có sẵn 24 mẫu (tab Tài liệu → nút **Mẫu**, hoặc **Tài liệu mới**). Các mẫu nối với nhau bằng mã truy vết: mỗi mã được định nghĩa ở ĐÚNG MỘT tài liệu, tài liệu khác chỉ tham chiếu mã:');
    L.push('StR (nhu cầu) → BP-nn (quy trình) → UC-<HTC>-nn, FR-<HTC>-<MOD>-nnn, NFR, BR (yêu cầu) → SEQ / STM / ACT (thiết kế) → tên bảng (ERD) → endpoint (API), I-nn (tích hợp) → TS-nn (kiểm thử) → SEC-nn, TD, RISK (rủi ro). Ma trận RTM-00 ghi mọi mối nối.');
    L.push('Ký hiệu trong mẫu: PRJ = mã dự án, HTC = mã hệ thống con, MOD = mã module, NN = số quy trình, {{…}} = chỗ cần điền, khối > [!TIP] = hướng dẫn (xoá khi xong).');
    L.push('');
    L.push('| Mẫu | Dùng để | Định nghĩa mã | Các mục chính |');
    L.push('| --- | --- | --- | --- |');
    for (const e of CATALOG) {
      if (e.kind === 'guide') continue;
      L.push(`| ${e.code}${e.copy ? ` (${e.copy})` : ''} | ${e.title}: ${e.desc} | ${e.defines || '–'} | ${e.sections} |`);
    }
    L.push('');
    L.push('Khi người dùng muốn viết một loại tài liệu có trong bảng (đặc tả yêu cầu, thiết kế, ERD, API, quy trình BPMN, kế hoạch kiểm thử, triển khai, đánh giá rủi ro…):');
    L.push('- Nếu tài liệu đang trống hoặc người dùng chưa có cấu trúc: viết theo đúng các mục chính của mẫu tương ứng, dùng đúng hệ thống mã ở trên (mỗi bảng có cột truy vết lên tầng trên), rồi trong phần giải thích nhắc ngắn rằng có thể mở mẫu đầy đủ ở nút **Mẫu** (tab Tài liệu) – mẫu có sẵn sơ đồ khung và hướng dẫn điền.');
    L.push('- Nếu người dùng hỏi nên bắt đầu từ đâu hoặc cần những tài liệu gì: gợi ý thứ tự CONV → StRS-00 → BMA-00 / BPMN → SyRS-00 / SRS → SAD-00 / ADR / SDD → DBD-00 / ERD, ICD-00 / API → STP-00 → DEP / OPS → ASM-00, cập nhật RTM-00 sau mỗi tầng.');
    L.push('- Nếu tài liệu đang mở được tạo từ mẫu (ghi trong ngữ cảnh): giữ nguyên cấu trúc mục, khối thông tin đầu, dòng "Tài liệu liên quan" và các mã đã có; thêm phần tử mới thì cấp mã tiếp theo, không dùng lại mã.');
    return L.join('\n');
  };

  LIB.entry = byPath;

  // ------------------------------------------------- nút "Mẫu" nổi bật: nhãn "Mới" + nhấp nháy
  // tới khi người dùng bấm lần đầu (mỗi tab một nút, nhớ trong localStorage)
  const SEEN_KEY = 'diagram-editor:tpl-seen:v1';
  function initTplButtons() {
    let seen = {};
    try {
      seen = JSON.parse(lsGet(SEEN_KEY) || '{}') || {};
    } catch (_) {
      seen = {};
    }
    document.querySelectorAll('[data-tpl-btn]').forEach((b) => {
      const k = b.dataset.tplBtn;
      if (!seen[k]) b.classList.add('is-new');
      b.addEventListener('click', () => {
        if (!b.classList.contains('is-new')) return;
        b.classList.remove('is-new');
        seen[k] = true;
        lsSet(SEEN_KEY, JSON.stringify(seen));
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTplButtons);
  else initTplButtons();
})(window.DE);
