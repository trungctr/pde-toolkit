# Báo cáo đánh giá tuân thủ ISO/IEC/IEEE 15289 – CCS ChillCat Studio

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | CCS-CMP-000 |
| Phiên bản | 0.1 |
| Ngày | 2026-11-18 |
| Trạng thái | Dự thảo – viết từ hệ thống đang chạy |
| Quy trình ISO/IEC/IEEE 12207 | 6.3.8 Quality Assurance · 6.3.6 Information Management · 6.3.5 Configuration Management |
| Chuẩn tham chiếu | ISO/IEC/IEEE 15289:2019 · ISO/IEC/IEEE 12207:2017 (quy trình 6.3.6) · ISO/IEC/IEEE 42010:2022 (riêng mẫu SAD) |
| Nguồn đã khảo sát | `desc.txt` §5–§7, `backend/docs/DECISIONS.md`, `backend/crates/documents/src/{lifecycle.rs, template.rs, service.rs, policy.rs, integration.rs, catalog.rs, model.rs, comments.rs, lib.rs}`, `backend/crates/documents/tests/lifecycle.rs`, `backend/crates/audit/src/lib.rs`, `backend/crates/notifications/src/lib.rs`, `backend/crates/traceability/src/{service.rs, parser.rs}`, `backend/crates/kernel/src/{model.rs, codes.rs}`, `backend/crates/platform/src/{config.rs, outbox.rs}`, `backend/crates/tickets/src/model.rs`, `js/hub-docs.js`, `js/docs.js`, `templates/` (24 mẫu + README), `docs/` (các tệp có lúc đánh giá), `.gitignore`, `README.md` mục Triển khai |
| Đơn vị ban hành | Nhóm phát triển ChillCat Studio |
| Tài liệu liên quan | ↑ [LCP-00 §5](../00_Quan_ly_tai_lieu/LCP-00_Ke_hoach_vong_doi_phan_mem.md) · [CONV §8](../00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md) · ↓ [ASM-00](ASM-00_Danh_gia_hien_trang.md) · ⇄ [DOC-REG](../00_Quan_ly_tai_lieu/DOC-REG_So_dang_ky_tai_lieu.md) · [LOG](../00_Quan_ly_tai_lieu/LOG_Nhat_ky_xay_dung_tai_lieu.md) |

---

## 1. Mục đích và phạm vi

### 1.1 Câu hỏi đánh giá

**Hệ thống CCS và bộ mẫu đã đảm bảo vòng đời tài liệu theo ISO/IEC/IEEE 15289:2019 và quy trình 6.3.6 Information
Management của ISO/IEC/IEEE 12207:2017 chưa?** Báo cáo trả lời riêng cho từng đối tượng, dựa vào mã nguồn và nội dung
mẫu, kèm khuyến nghị sửa cụ thể.

### 1.2 Đối tượng đánh giá

| Đối tượng | Gồm | Tình trạng lúc đánh giá (2026-11-18) |
|---|---|---|
| (1) Hệ thống HUB | Cách quản lý vòng đời tài liệu: module `documents`, `traceability`, `audit`, `notifications` của máy chủ; tab Dự án (`js/hub-docs.js`) | Chạy được; kiểm thử 2026-11-17/18 đạt (49 bài Rust, smoke 26/26, giao diện 25/25 và 40/40) |
| (2) Bộ mẫu | 24 mẫu trong `templates/` – nội dung của hạng mục thông tin | Bản trong git (commit `a683c94` và sau) |
| (3) Bộ tài liệu dự án | `docs/` – đang soạn song song | Có 7 tệp: [CONV](../00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md), [GLOSSARY](../00_Quan_ly_tai_lieu/GLOSSARY_Thuat_ngu.md), [LCP-00](../00_Quan_ly_tai_lieu/LCP-00_Ke_hoach_vong_doi_phan_mem.md), [BMA-00](../01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md), [StRS-00](../02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md), [SyRS-00](../02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md) và chính CMP-00; 21 tài liệu còn lại trong sổ chưa có tệp. BMA-00, StRS-00, SyRS-00 xuất hiện trong lúc đánh giá – chỉ xét cấu trúc (bảng thuộc tính, các mục, liên kết, sơ đồ), chưa xét nội dung. Kết quả cho đối tượng này là **tạm tính** |

### 1.3 Ngoài phạm vi

- Tab Tài liệu của EDT: chỉ soạn và lưu tệp ở máy người dùng, không quản lý vòng đời; chỉ xét khi HUB dùng nó để soạn /
  xuất một phiên bản.
- Module ticket: chỉ xét như hạng mục loại *request* (tiêu chí B5).
- Đây là **đánh giá nội bộ**, không phải đánh giá chứng nhận.

## 2. Tài liệu tham chiếu

| Tài liệu | Dùng để |
|---|---|
| ISO/IEC/IEEE 15289:2019 | Nội dung chung của hạng mục thông tin; các loại chung (description, plan, policy, procedure, report, request, specification) |
| ISO/IEC/IEEE 12207:2017 | Cấu trúc quy trình 6.3.6 (xác định, định dạng, quyền hạn, thu thập, duy trì, công bố, lưu giữ, huỷ); 6.3.5 cho quản lý cấu hình |
| ISO/IEC/IEEE 42010:2022 | Phần tử của mô tả kiến trúc – chỉ để xét mẫu SAD |
| [LCP-00](../00_Quan_ly_tai_lieu/LCP-00_Ke_hoach_vong_doi_phan_mem.md) | Kế hoạch quản lý cấu hình và thông tin mà dự án cam kết |
| [CONV](../00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md) | Quy ước của dự án (§4 đầu tài liệu, §8 mục bắt buộc, §9 vòng đời) |
| [GLOSSARY](../00_Quan_ly_tai_lieu/GLOSSARY_Thuat_ngu.md) | Thuật ngữ (workspace, group owner, phiên bản, Cần rà soát…) |
| `desc.txt` §5–§7, `backend/docs/DECISIONS.md` | Yêu cầu đã chốt và các quyết định cho điểm còn ngỏ |

## 3. Phương pháp và thang đánh giá

### 3.1 Cách làm

1. Đọc mã máy chủ ở các tệp liệt kê trong *Nguồn đã khảo sát*; mỗi kết luận ghi `tệp#hàm` làm bằng chứng. Điều rút ra
   từ đọc mã mà chưa chạy thử gắn nhãn (suy luận).
2. Đọc 24 mẫu (bỏ các dòng sơ đồ nhúng), đếm phần tử nội dung chung theo từng mẫu (§5.6).
3. Đọc các tệp có trong `docs/` lúc đánh giá.
4. Kiểm chứng từng nghi vấn nêu trước khi đánh giá – đúng thì ghi, sai thì bác (§5.5).
5. Không chạy lại kiểm thử; dùng kết quả đợt 2026-11-17/18.

Tiêu chí lấy theo **hiểu biết của nhóm về cấu trúc chuẩn**, không trích số điều khoản. Khi đánh giá chính thức cần đối
chiếu bản chuẩn gốc.

### 3.2 Thang đánh giá

| Mức | Nghĩa | Điểm |
|---|---|---|
| **Đạt** | Có cơ chế / nội dung, dùng được cho mục đích của tiêu chí, có bằng chứng | 1 |
| **Một phần** (Đạt một phần) | Có nhưng thiếu yếu tố quan trọng, hoặc chỉ dựa vào quy ước không được kiểm | 0,5 |
| **Chưa đạt** | Không có, hoặc có nhưng không dùng được cho mục đích | 0 |
| **KAD** (Không áp dụng) | Tiêu chí không thuộc trách nhiệm của đối tượng (ví dụ khoá lạc quan với bộ mẫu) | không tính |

- **Tỉ lệ đạt** = tổng điểm / số tiêu chí áp dụng. **Đạt hoàn toàn** = số tiêu chí *Đạt* / số tiêu chí áp dụng.
- Cột **Mức** ở §5 = mức thấp nhất trong các đối tượng có đánh giá – mức của cả hệ thống CCS cho tiêu chí đó.
- Mã tiêu chí `A1`…`D7` chỉ dùng trong báo cáo này, không phải mã truy vết.

### 3.3 Nhóm tiêu chí

| Nhóm | Nội dung | Số tiêu chí |
|---|---|---|
| A | Nội dung chung của mỗi hạng mục thông tin theo 15289: ngày phát hành và trạng thái, phạm vi, tổ chức phát hành, tài liệu tham chiếu, ngữ cảnh, ký hiệu, thân, tóm tắt, thuật ngữ, lịch sử thay đổi; kèm nhận diện duy nhất, phiên bản, tác giả / người phê duyệt | 14 |
| B | Loại hạng mục thông tin chung của 15289 và ánh xạ hạng mục ↔ quy trình 12207 | 5 |
| C | Vòng đời quản lý thông tin theo 6.3.6 | 12 |
| D | Quản lý cấu hình hạng mục thông tin | 7 |

## 4. Kết luận tóm tắt

**Chưa.** CCS đảm bảo tốt **phần lõi** của vòng đời tài liệu – nhận diện, đánh số phiên bản, trạng thái theo phiên bản,
quyền hạn tạo / duyệt / phát hành, khoá nội dung sau gửi duyệt, khoá lạc quan, lịch sử thay đổi tự ghi, truy vết giữa tài
liệu – và phần này có kiểm thử tự động. Nhưng CCS **chưa đảm bảo đủ** vòng đời theo ISO/IEC/IEEE 15289 và 6.3.6 ở ba chỗ:
(1) **cuối vòng đời** – lưu hồ sơ cho kiểm toán, huỷ có hồ sơ, tạm giữ, xuất ra ngoài hệ thống; (2) **cấu hình ở mức bộ tài
liệu** – không có baseline gắn với bản phát hành phần mềm; (3) **độ phủ loại hạng mục** – danh mục 24 loại biên dịch sẵn,
mỗi loại một bản, không tạo được kế hoạch / báo cáo của quy trình quản lý (chính LCP-00 và CMP-00 không tạo được trong
HUB). Bộ mẫu thiếu phần tử nhận dạng (đơn vị ban hành, người duyệt, mức bảo mật) và còn lệch mô hình trạng thái của chính
HUB. Tỉ lệ đạt chung **60,0%** (60 / 100 điểm áp dụng), đạt hoàn toàn 37%.

| Nhóm tiêu chí | Hệ thống HUB | Bộ mẫu | Tài liệu dự án (tạm tính) |
|---|---|---|---|
| A – Nội dung chung (14) | **66,7%** (5 Đạt · 2 Một phần · 2 Chưa đạt · 5 KAD) | **64,3%** (6 · 6 · 2 · 0) | **75,0%** (8 · 5 · 1 · 0) |
| B – Loại hạng mục và ánh xạ quy trình (5) | **30,0%** (0 · 3 · 2 · 0) | **40,0%** (0 · 4 · 1 · 0) | **75,0%** (2 · 2 · 0 · 1) |
| C – Vòng đời quản lý thông tin 6.3.6 (12) | **66,7%** (5 · 6 · 1 · 0) | **45,0%** (2 · 5 · 3 · 2) | **59,1%** (3 · 7 · 1 · 1) |
| D – Quản lý cấu hình hạng mục (7) | **71,4%** (4 · 2 · 1 · 0) | **50,0%** (1 · 3 · 1 · 2) | **37,5%** (1 · 1 · 2 · 3) |
| **Tổng (38 tiêu chí)** | **62,1%** – 20,5 / 33; đạt hoàn toàn 42,4% | **52,9%** – 18 / 34; đạt hoàn toàn 26,5% | **65,2%** – 21,5 / 33; đạt hoàn toàn 42,4% |

Theo cột *Mức* ở §5 (mức của cả hệ thống CCS): 9 tiêu chí Đạt, 16 Một phần, 13 Chưa đạt.

### 4.1 Kết luận cho từng đối tượng

**(1) Hệ thống HUB – chưa đảm bảo đủ (62,1%).** Đạt chắc ở nhận diện (mã sinh tự động, duy nhất), phiên bản, trạng thái,
quyền hạn, bất biến sau gửi duyệt, khoá lạc quan, lịch sử tự ghi, truy vết và Cần rà soát. Chưa đạt: không ghi tổ chức
phát hành; không kiểm mục bắt buộc theo loại; không xếp loại hạng mục theo 15289; danh mục loại đóng và một bản mỗi loại;
không có baseline; không xuất được hồ sơ. Một phần: xoá theo hạn chạy tự động nhưng **không để lại nhật ký** và **không có tạm giữ**; nhật ký không phủ đổi tên,
quan hệ, nhận xét; phát hành chỉ báo người tạo / phụ trách / soạn, không có danh sách phân phối hay xác nhận đã đọc; người
duyệt có trong lịch sử nhưng không ở bảng thuộc tính.

**(2) Bộ mẫu – chưa đảm bảo đủ (52,9%).** 24/24 mẫu có mã, phiên bản, ngày, trạng thái, tài liệu liên quan, lịch sử thay
đổi; quy ước mã và ký hiệu (CONV §3.4, §7) tốt. Chưa có: đơn vị ban hành, người duyệt, mức bảo mật (0/24); phạm vi tường
minh 6/24, tóm tắt 5/24, ngữ cảnh 4/24; không có quy định lưu giữ, phân phối, huỷ. CONV §9 ("Đang rà soát / Đã phê duyệt")
và DOC-REG / LOG ("Đang cập nhật") **lệch** vòng đời của chính HUB. Bộ mẫu chỉ có loại cho quy trình kỹ thuật và một phần
quy trình quản lý. Mẫu SAD ghi ISO/IEC/IEEE 42010 nhưng chưa định nghĩa góc nhìn và tương ứng giữa các view.

**(3) Bộ tài liệu dự án – tạm tính 65,2%, chỉ trên 7 tệp.** CONV của dự án đã sửa các lệch lớn của mẫu: thêm *Đơn vị ban
hành* (§4, có ở 7/7 tệp), theo đúng vòng đời HUB (§9), khai báo LCP và CMP (§3.3, §8). Các tài liệu viết đúng theo mẫu
(BMA-00, StRS-00, SyRS-00) thừa hưởng khoảng trống của mẫu: thiếu mục phạm vi / tóm tắt, ít liên kết thuật ngữ. Khoảng
trống chính: `docs/` chưa vào git, chưa tài liệu nào qua duyệt, chưa có baseline, chưa chỉ định người. Người soạn CMP-00
cũng soạn LCP-00 nên điểm của đối tượng này cần người khác rà lại.

### 4.2 Việc nên làm trước (khuyến nghị mức Cao)

1. CR-23 – đưa `docs/`, `backend/`, `desc.txt` vào quản lý cấu hình mà không công khai qua GitHub Pages.
2. CR-04, CR-05 – xoá theo hạn có nhật ký và có tạm giữ.
3. CR-01 – thêm loại LCP, CMP (và loại hạng mục 15289) vào danh mục HUB.
4. CR-03 – baseline bộ tài liệu cho mỗi bản phát hành.
5. CR-14, CR-15, CR-16 – đồng bộ CONV §9, DOC-REG, LOG với vòng đời HUB; thêm dòng nhận dạng vào 24 mẫu.

Công sức ước lượng (suy luận): HUB 21,5–32 ngày công; bộ mẫu 9–11,5 ngày; tài liệu dự án 2,5–4 ngày.

## 5. Bảng đối chiếu chi tiết

### 5.1 Nhóm A – Nội dung chung của hạng mục thông tin

| Tiêu chí | Hệ thống HUB | Bộ mẫu | Tài liệu dự án | Bằng chứng | Mức |
|---|---|---|---|---|---|
| A1 Nhận diện duy nhất (mã tài liệu) | **Đạt** – mã sinh theo loại (chung / theo hệ thống con / theo quy trình), duy nhất trong workspace; gửi duyệt chặn khi dòng *Mã tài liệu* sai | **Đạt** – 24/24 mẫu có dòng *Mã tài liệu*, khớp quy tắc của HUB | **Đạt** – mã `CCS-…` theo CONV §3.3 | `backend/crates/documents/src/catalog.rs#document_code`; `service.rs#ensure_indexes` (chỉ mục `documents_ws_code`); `template.rs#check_header`; kiểm thử `document_codes_follow_the_templates` | Đạt |
| A2 Phiên bản | **Đạt** – số bản do hệ thống đặt, duy nhất trong tài liệu, ghi vào bảng thuộc tính | **Đạt** – dòng *Phiên bản* 24/24 | **Đạt** – 0.1 | `lifecycle.rs#bump_minor`, `#next_published`, `#transition`; chỉ mục `versions_doc_version` | Đạt |
| A3 Ngày phát hành và trạng thái | **Đạt** – mỗi lần chuyển trạng thái ghi *Ngày* (giờ máy chủ, `TZ`) và *Trạng thái*; khi phát hành, *Ngày* là ngày phát hành | **Đạt** – có dòng *Ngày*, *Trạng thái* (nhãn lệch – xét ở C8) | **Đạt** | `template.rs#set_header_rows`; `lifecycle.rs#transition`; `service.rs#today` | Đạt |
| A4 Phạm vi | **KAD** – thân tài liệu do mẫu quyết định, hệ thống không kiểm (xem A14) | **Một phần** – phạm vi tường minh 6/24; 14/24 có mục Mục tiêu / Mục đích; DOC-REG, GLOSSARY, ERD, API, DEP-00, OPS-00, SDD, ADR theo hệ thống con không có câu phạm vi (§5.6) | **Một phần** – có ở CONV (dòng *Áp dụng cho*), LCP §1.2, CMP §1, SyRS-00 §2, câu mở đầu GLOSSARY; BMA-00, StRS-00 chỉ có mục Mục tiêu (theo mẫu) | `templates/*`; §5.6 | Một phần |
| A5 Tổ chức phát hành | **Chưa đạt** – không có thuộc tính tổ chức phát hành; `set_header_rows` chỉ ghi *Phiên bản*, *Ngày*, *Trạng thái*; workspace chỉ có mã và tên | **Chưa đạt** – 0/24 mẫu; CONV §4 mẫu không nêu | **Đạt** – CONV §4 dự án bắt buộc dòng *Đơn vị ban hành*; 7/7 tệp có | `template.rs#set_header_rows`; `templates/00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md` §4 | Chưa đạt |
| A6 Tác giả / người phụ trách | **Một phần** – lưu `created_by`, `owner_id` (người phụ trách, tự chuyển khi rời phạm vi), `editor_id`; trang tài liệu hiện "phụ trách"; cột *Người thực hiện* của lịch sử ghi tên người chuyển trạng thái. Không ghi vào bảng thuộc tính nên bản tải về không mang thông tin này | **Một phần** – chỉ cột *Người thực hiện* ở *Lịch sử thay đổi* | **Một phần** – chỉ "Nhóm phát triển ChillCat Studio"; CONV §10 ghi chưa chỉ định cá nhân | `model.rs#DocumentDoc`; `integration.rs#on_member_removed`; `js/hub-docs.js` (trang chi tiết); `template.rs#append_history` | Một phần |
| A7 Người phê duyệt | **Một phần** – `approved_by` / `approved_at` ở `VersionDoc`, lượt duyệt ở `document_reviews`, dòng lịch sử "Duyệt" kèm tên; không có dòng *Người duyệt* ở bảng thuộc tính, và dòng lịch sử sửa được (D4) | **Chưa đạt** – không mẫu nào có chỗ ghi người duyệt; CONV §9 mẫu chỉ nói "người phụ trách đã đọc và đồng ý" | **Chưa đạt** – chưa tài liệu nào qua duyệt; chưa có chỗ ghi | `lifecycle.rs#transition` (nhánh `Action::Approve`); `model.rs#ReviewDoc`, `#VersionDoc` | Chưa đạt |
| A8 Tài liệu tham chiếu | **Đạt** – kiểm dòng *Tài liệu liên quan* có ↑ ↓ ⇄; lưu quan hệ ↑ ⇄ mặc định theo mẫu; chặn vòng ↑ | **Đạt** – *Tài liệu liên quan* 24/24; *Chuẩn tham chiếu* 11/24; mục tham chiếu riêng ở SRS §1.4, BPMN §8 | **Đạt** – *Tài liệu liên quan*, *Chuẩn tham chiếu*; bảng tham chiếu ở LCP §1.3, CMP §2 | `template.rs#check_header`; `service.rs#default_links`, `#reaches_up` | Đạt |
| A9 Ngữ cảnh | **KAD** | **Một phần** – mục ngữ cảnh tường minh 4/24 (BMA §2, SRS §2.1, SAD §3, SDD §2); các mẫu khác dựa vào *Tài liệu liên quan* | **Một phần** – LCP §1.2, CONV §1, BMA-00 §2; StRS-00, SyRS-00, GLOSSARY không có | §5.6 | Một phần |
| A10 Ký hiệu mô tả | **KAD** – hệ thống hiển thị sơ đồ nhúng, không quy định ký hiệu | **Đạt** – CONV §7 (công cụ, quy tắc vẽ, ký hiệu BPMN), §3.4 (mã); SAD §1.3 trỏ CONV §7 | **Đạt** – CONV §7 dự án | CONV §3.4, §7 | Đạt |
| A11 Tóm tắt | **KAD** | **Một phần** – mục tóm tắt / tổng quan 5/24 (BPMN-00 §2, BPMN cấp 1 §2, SRS §2, SAD §2, ASM §1) | **Một phần** – LCP §1.4, CMP §4; CONV, GLOSSARY, BMA-00, StRS-00, SyRS-00 không có (theo mẫu) | §5.6 | Một phần |
| A12 Thuật ngữ | **KAD** | **Một phần** – có GLOSSARY riêng nhưng chỉ 5/23 mẫu khác trỏ tới GLOSSARY hoặc có mục định nghĩa (CONV, DOC-REG, RTM, BMA, SRS §1.3) | **Một phần** – GLOSSARY dự án đã có; CONV, BMA-00, LCP, CMP trỏ tới; StRS-00, SyRS-00 không trỏ | §5.6 | Một phần |
| A13 Lịch sử thay đổi | **Đạt** – mỗi lần chuyển trạng thái tự thêm một dòng cuối bảng (tạo mục nếu thiếu, không thêm trùng dòng cuối); tạo phiên bản mới thêm dòng "Tạo phiên bản mới từ bản …". Đổi người soạn, đổi mức bảo mật, lưu trữ không thêm dòng (có ở nhật ký) | **Đạt** – 24/24 mẫu | **Đạt** | `template.rs#append_history`; `lifecycle.rs#transition`, `#new_version`; kiểm thử `history_rows_are_appended_once_at_the_end_of_the_table`, `catalog_is_complete_and_consistent` | Đạt |
| A14 Thân tài liệu theo loại (mục bắt buộc) | **Chưa đạt** – chỉ kiểm bảng thuộc tính, mã truy vết và phần sót của mẫu; không kiểm mục bắt buộc theo loại – tài liệu chỉ có H1 và bảng thuộc tính vẫn gửi duyệt, phát hành được (suy luận) | **Một phần** – mỗi mẫu có cấu trúc thân; CONV §8 mẫu chỉ quy định mục bắt buộc cho 5/24 loại | **Đạt** – CONV §8 dự án thêm LCP, CMP; 7/7 tệp giữ đủ mục của mẫu hoặc của CONV §8 | `template.rs#check_header`, `#leftovers`; `lifecycle.rs#checks`; CONV §8 | Chưa đạt |

### 5.2 Nhóm B – Loại hạng mục thông tin và ánh xạ quy trình

| Tiêu chí | Hệ thống HUB | Bộ mẫu | Tài liệu dự án | Bằng chứng | Mức |
|---|---|---|---|---|---|
| B1 Mỗi loại được xếp vào loại chung của 15289 | **Chưa đạt** – `DocType` không có trường loại hạng mục; trường `standard` chỉ ghi chuẩn nội dung ở một số loại | **Một phần** – DOC-REG §1 có cột "Loại hạng mục thông tin" cho 5 loại nhóm 00; §2–§8 không có | **Đạt** – LCP-00 §5.1 xếp loại mọi nhóm hạng mục | `catalog.rs#DocType`; mẫu DOC-REG §1 | Chưa đạt |
| B2 Phủ quy trình kỹ thuật 6.4 | **Một phần** – có loại cho 6.4.1–6.4.5, 6.4.8–6.4.13; không có cho 6.4.6, 6.4.7, 6.4.14; với 6.4.9 / 6.4.11 chỉ có kế hoạch (STP), không có đặc tả hay báo cáo kiểm thử; 6.4.10 không có hồ sơ phát hành | **Một phần** – như HUB (cùng 24 mẫu; `templates/README.md` nói bộ mẫu "sắp theo các quy trình kỹ thuật") | **Một phần** – sổ tài liệu có đủ loại như mẫu; chưa có báo cáo kiểm thử; phần lớn chưa viết | `catalog.rs#TYPES` (cột `iso_process`); `templates/README.md` | Một phần |
| B3 Phủ quy trình quản lý kỹ thuật 6.3 và tổ chức 6.2 | **Một phần** – chỉ 6.3.4 (ASM), 6.3.6 (CONV, DOC-REG, GLOSSARY, RTM, LOG), 6.3.7 (ASM). Không có kế hoạch dự án (6.3.1), báo cáo trạng thái (6.3.2), kế hoạch / hồ sơ quản lý cấu hình (6.3.5), kế hoạch / hồ sơ đảm bảo chất lượng (6.3.8), chính sách vòng đời (6.2.1). Bằng chứng trực tiếp: LCP-00, CMP-00 không tạo được trong HUB | **Một phần** – như HUB | **Một phần** – LCP-00 gom kế hoạch cho 6.2.1, 6.3.1, 6.3.2, 6.3.5–6.3.8; CMP-00 cho 6.3.8; chưa có báo cáo trạng thái định kỳ, hồ sơ kiểm toán cấu hình | `catalog.rs#TYPES`; `backend/crates/kernel/src/codes.rs#DOC_LABELS` | Một phần |
| B4 Mở rộng danh mục loại; nhiều bản cùng loại | **Chưa đạt** – danh mục là mảng hằng `[DocType; 24]` biên dịch sẵn; nhãn loại cố định ở `DOC_LABELS`; loại mã truy vết cố định ở `KINDS`; chỉ mục duy nhất `documents_cardinality` cho mỗi (loại, hệ thống con, quy trình) ⇒ không có báo cáo theo đợt / theo bản phát hành (ví dụ hai lần đánh giá CMP) | **Một phần** – thêm tệp mẫu được, nhưng CONV §3.3 và `templates/README.md` không có thủ tục thêm loại; *Số bản* cố định | **Đạt** – thêm LCP, CMP và khai báo ở CONV §3.3, §8 dự án | `catalog.rs#TYPES`; `service.rs#ensure_indexes`; `kernel/src/codes.rs`; `traceability/src/parser.rs#KINDS` | Chưa đạt |
| B5 Hạng mục loại request (yêu cầu thay đổi, báo lỗi) | **Một phần** – ticket (Góp ý tính năng / Báo lỗi) có trạng thái, người xử lý, phiên bản phần mềm, đề xuất sửa tài liệu ghim theo phiên bản căn cứ, nhật ký; nhưng ticket không phải hạng mục thông tin có phiên bản / mẫu, không xuất được | **Chưa đạt** – không có mẫu yêu cầu thay đổi / báo lỗi | **KAD** – dự án dùng ticket của HUB (LCP-00 §4.3) | `backend/crates/tickets/src/model.rs` (`software_version`, `based_on_version_id`) | Chưa đạt |

### 5.3 Nhóm C – Vòng đời quản lý thông tin (6.3.6)

| Tiêu chí | Hệ thống HUB | Bộ mẫu | Tài liệu dự án | Bằng chứng | Mức |
|---|---|---|---|---|---|
| C1 Xác định hạng mục thông tin cần quản lý | **Đạt** – danh mục 24 loại (`GET /document-types`); sổ đăng ký tự sinh theo quyền xem; gợi ý loại còn thiếu | **Đạt** – `templates/README.md` §2, DOC-REG | **Đạt** – CONV §3.3, LCP-00 §5.1 (tệp DOC-REG chưa có) | `catalog.rs`; `service.rs#list`; `js/hub-docs.js` (trang Tài liệu, dòng "Chưa có:") | Đạt |
| C2 Định dạng và biểu diễn | **Đạt** – Markdown, sơ đồ nhúng SVG + JSON, điền mẫu tự động, tối đa 8 MB | **Đạt** – CONV §4, §7 | **Một phần** – sơ đồ Mermaid tạm thời (CONV §7.2 cho phép khi phác) | `template.rs#instantiate`; `service.rs` (`MAX_CONTENT_BYTES`) | Một phần |
| C3 Quyền hạn tạo, sửa, duyệt, phát hành | **Đạt** – quyền `create` / `edit` / `submit` / `approve` / `publish` theo group; một người sửa mỗi bản dự thảo; chỉ group owner duyệt; bắt buộc lý do khi trả lại / mở lại; lượt duyệt cũ không áp dụng cho lần gửi sau | **Một phần** – CONV §9 mẫu chỉ nói "người phụ trách đã đọc và đồng ý"; không nêu ai duyệt, ai phát hành | **Một phần** – vai trò ghi ở LCP-00 §5.2, CONV §9; chưa chỉ định người | `policy.rs#capabilities`; `lifecycle.rs#transition`; kiểm thử `only_the_group_owner_approves_and_only_the_editor_edits` | Một phần |
| C4 Lưu và truy xuất (kể cả bản cũ, bản lưu trữ) | **Đạt** – mọi phiên bản lưu ở `document_versions`; bản Thay thế xem được theo mức bảo mật; tài liệu đã phát hành chỉ lưu trữ, không xoá; lọc "Đã lưu trữ" | **Một phần** – DOC-REG §9 lưu trữ bằng thư mục `_luu_tru/` (mô hình tệp), lệch trạng thái Thay thế / Lưu trữ của HUB | **Chưa đạt** – `docs/` chưa có trong git, chưa nạp HUB: chưa có nơi lưu có kiểm soát | `policy.rs#can_view_released`; `service.rs#version`, `#set_archived`, `#delete`; `git status` | Chưa đạt |
| C5 Công bố, phân phối, cấp quyền truy cập | **Một phần** – 4 mức bảo mật cho bản phát hành; link công khai không cần đăng nhập (có xác nhận, workspace tắt được); không có danh sách phân phối, không ghi nhận đã đọc | **Chưa đạt** – không có mục / dòng phân phối hay mức bảo mật | **Một phần** – LCP-00 §5.4 chọn mức Workspace; rủi ro bị công khai qua GitHub Pages nếu đẩy `docs/` lên `main` | `policy.rs#can_view_released`; `integration.rs#public_document`; `service.rs#update` | Chưa đạt |
| C6 Thông báo khi gửi duyệt / duyệt / phát hành | **Một phần** – gửi duyệt → người có `approve`; duyệt → người có `publish` và người gửi; trả lại / mở lại → người soạn và người gửi; phát hành → người tạo, người phụ trách, người soạn; tài liệu tầng dưới bị đổi mã → người phụ trách nhận "Cần rà soát". Người đọc / người dùng tài liệu không được báo khi có bản mới | **KAD** | **KAD** – chưa nạp HUB | `lifecycle.rs#transition` (biến `notify`); `integration.rs#on_review_flags`; `backend/crates/notifications/src/lib.rs#render` | Một phần |
| C7 Quyền và nghĩa vụ: bảo mật, riêng tư, khả dụng | **Một phần** – đặc quyền tối thiểu (nguyên tắc thiết kế: workspace owner chỉ xem + nhận xét tài liệu); không cho biết tài liệu tồn tại khi không có quyền (404); khả dụng: `/healthz`, `/readyz`. Thiếu: mức bảo mật không ghi vào nội dung ⇒ bản tải về / bản sao không mang nhãn. Việc gửi mọi loại dữ liệu tới AI ngoài không cần phê duyệt là điều đã chốt ở `desc.txt` §5.4 – ghi nhận, không tính là thiếu | **Một phần** – CONV §5 "không ghi bí mật"; không có dòng mức bảo mật | **Một phần** – không ghi bí mật (chỉ tên biến); chưa ghi mức bảo mật trên tài liệu | `policy.rs`; `backend/docs/DECISIONS.md` (đoạn đầu); `template.rs#set_header_rows` | Một phần |
| C8 Duy trì và ghi trạng thái (mô hình trạng thái thống nhất) | **Đạt** – 5 trạng thái gắn với phiên bản; mỗi tài liệu tối đa một bản đang soạn; trạng thái ghi vào bảng thuộc tính và `document_reviews`; Cần rà soát khi tầng trên đổi mã | **Một phần** – CONV §9 mẫu dùng "Dự thảo → Đang rà soát → Đã phê duyệt"; DOC-REG, LOG ghi "Đang cập nhật"; CONV §5 mẫu yêu cầu "Dự thảo – viết từ hệ thống đang chạy / Dự thảo – thiết kế mới". Các nhãn này không có trong HUB và bị ghi đè ở lần chuyển trạng thái đầu | **Một phần** – CONV §9 dự án đã theo HUB; nhưng DOC-REG, LOG vẫn "Đang cập nhật", nhãn "Dự thảo – viết từ hệ thống đang chạy" sẽ bị ghi đè | `backend/crates/kernel/src/model.rs#VersionStatus`; chỉ mục `versions_one_working`; `template.rs#set_header_rows`; mẫu CONV §5, §9, DOC-REG, LOG | Một phần |
| C9 Hồ sơ phục vụ tuân thủ / kiểm toán | **Một phần** – nhật ký ghi sự kiện có cờ `audit` (chuyển trạng thái, tạo / xoá tài liệu, đổi mức bảo mật, lưu trữ, đổi người soạn, quyền, ticket), khoá chính là mã sự kiện; `document_reviews` giữ lượt duyệt theo phiên bản. Thiếu: không ghi đổi tên tài liệu, thêm / bỏ quan hệ, xoá nhận xét, đặt cờ Cần rà soát, xoá theo hạn; chỉ workspace owner đọc; không có bảo vệ toàn vẹn (chuỗi băm); sự kiện đổi mức bảo mật và lưu trữ ghi ngoài transaction | **Một phần** – LOG ("chỉ thêm dòng mới, không xoá dòng cũ"), *Lịch sử thay đổi* | **Một phần** – *Lịch sử thay đổi*; tệp LOG dự án chưa có | `audit/lib.rs#record`, `#workspace_log`; `service.rs#update`, `#add_link`, `#remove_link`, `#set_archived`; `comments.rs#delete_comment`; `traceability/src/service.rs#on_published` | Một phần |
| C10 Lưu giữ theo chính sách | **Một phần** – bản Thay thế giữ 10 năm (`VERSION_RETENTION_YEARS`), nhật ký 2 năm (`AUDIT_RETENTION_DAYS`, tính từ lúc ghi – mốc chưa chốt), thông báo 180 ngày (cứng trong mã); một chính sách chung cho mọi loại; bản dự thảo trung gian bị ghi đè (mỗi số phiên bản chỉ giữ nội dung cuối) | **Chưa đạt** – không có mục thời hạn lưu | **Đạt** – LCP-00 §5.5 | `backend/crates/platform/src/config.rs#RetentionSettings`; `audit/lib.rs` (chỉ mục `audit_ttl`); `notifications/src/lib.rs`; `service.rs#save_content` | Chưa đạt |
| C11 Huỷ theo chính sách (hồ sơ huỷ, tạm giữ) | **Một phần** – tác vụ hằng ngày xoá bản Thay thế quá hạn cùng nhận xét, lượt duyệt, chỉ mục truy vết (tối đa 500 bản mỗi lần); nhật ký, thông báo xoá bằng TTL. Thiếu: **không ghi nhật ký việc xoá** (chỉ một dòng `tracing::info!`), **không có tạm giữ**, không trong transaction, chưa có kiểm thử; lượt duyệt của bản bị xoá mất theo | **Chưa đạt** – không có hướng dẫn huỷ | **Một phần** – LCP-00 §5.5 dựa vào cơ chế HUB; chưa có tạm giữ | `integration.rs#purge_expired_versions`; `backend/crates/documents/src/lib.rs` (Job `documents.purge_expired_versions`, 24 giờ); chỉ mục `audit_ttl`, `notifications_ttl` | Chưa đạt |
| C12 Xuất / lưu trữ ngoài hệ thống | **Chưa đạt** – không có chức năng xuất gói lưu trữ (nội dung + siêu dữ liệu + lượt duyệt + nhật ký). Chỉ lưu tay **từng phiên bản**: mở ở tab Tài liệu rồi lưu tệp `.md` (Ctrl+Shift+S) – không kèm trạng thái, người duyệt, mức bảo mật. Nhật ký chỉ đọc qua API phân trang | **KAD** – mẫu là tệp Markdown, vốn dùng ngoài hệ thống | **Đạt** – tài liệu là tệp Markdown trong repo | `js/hub-docs.js#openInEditor`; `js/docs.js#saveDoc`, `#download`; `audit/lib.rs#query` | Chưa đạt |

### 5.4 Nhóm D – Quản lý cấu hình hạng mục thông tin

| Tiêu chí | Hệ thống HUB | Bộ mẫu | Tài liệu dự án | Bằng chứng | Mức |
|---|---|---|---|---|---|
| D1 Phiên bản bất biến sau gửi duyệt | **Đạt** – chỉ lưu nội dung khi bản ở Dự thảo (câu cập nhật lọc `status: draft`); sau đó chỉ hệ thống ghi các dòng thuộc tính và lịch sử; muốn sửa bản phát hành phải tạo phiên bản mới. Không lưu băm nội dung để chứng minh bản phát hành trùng bản đã duyệt | **KAD** | **KAD** – chưa gửi duyệt | `service.rs#save_content`; `lifecycle.rs#transition`, `#new_version`; kiểm thử `full_document_lifecycle` | Đạt |
| D2 Khoá lạc quan, chống ghi đè đồng thời | **Đạt** – `revision` tăng mỗi lần ghi; lưu với `revision` cũ ⇒ 409 `document.stale_revision`; chuyển trạng thái lọc theo `status` + `revision` ⇒ `document.concurrent_change`; chỉ mục duy nhất một bản đang soạn mỗi tài liệu | **KAD** | **KAD** | `service.rs#save_content`; `lifecycle.rs#transition`; chỉ mục `versions_one_working`; kiểm thử `full_document_lifecycle` | Đạt |
| D3 Quy tắc đánh số phiên bản | **Đạt** – 0.1 → 0.2 khi trả lại / rút lại / mở lại; 1.0 khi phát hành lần đầu; 1.1 hoặc 2.0 sau đó | **Một phần** – CONV §9 mẫu: "lên 1.0 khi người phụ trách đã đọc và đồng ý"; không nói 0.2, 1.1, 2.0 | **Đạt** – CONV §9 dự án theo đúng HUB | `lifecycle.rs#bump_minor`, `#next_published`; kiểm thử `version_numbers_follow_desc_5_3` | Một phần |
| D4 Toàn vẹn lịch sử thay đổi | **Một phần** – hệ thống chỉ thêm dòng; nhưng bảng nằm trong nội dung nên người soạn bản dự thảo sửa / xoá được dòng cũ (kể cả dòng "Duyệt" của bản trước được chép sang); `save_content` và kiểm tra gửi duyệt không phát hiện. Nguồn tin cậy là `document_reviews` – mất khi bản bị xoá theo hạn | **Một phần** – LOG "chỉ thêm dòng mới, không xoá dòng cũ", CONV §9 – chỉ là quy ước | **KAD** – mới có dòng 0.1 | `template.rs#append_history`; `service.rs#save_content`; `lifecycle.rs#checks` | Một phần |
| D5 Baseline nhiều tài liệu cho một bản phát hành phần mềm | **Chưa đạt** – không có thực thể / API baseline; quan hệ giữa tài liệu ở mức tài liệu, không ghim phiên bản; chỉ mục truy vết bỏ bản phát hành cũ khi có bản mới; không nối tới phiên bản phần mềm. Chỉ dựng lại được "bộ tài liệu tại thời điểm X" bằng cách lần `published_at` / `superseded_at` từng bản (suy luận), và không còn sau khi bản bị xoá theo hạn | **Chưa đạt** – DOC-REG không có cột / mục baseline | **Chưa đạt** – chưa lập baseline; LCP-00 §4.4 mới là kế hoạch; `git tag` rỗng | `model.rs#LinkDoc`; `traceability/src/service.rs#on_published` (xoá chỉ mục bản cũ) | Chưa đạt |
| D6 Truy vết giữa các hạng mục | **Đạt** – đọc mã định nghĩa / tham chiếu khi lưu; sổ mã (không dùng lại, ghi đã bỏ); chặn định nghĩa trùng khi phát hành; Cần rà soát khi tầng trên đổi / bỏ mã; chặn phát hành khi tầng trên chưa phát hành; đề xuất của ticket ghim phiên bản căn cứ | **Đạt** – CONV §3.4 (mã, nơi định nghĩa), §6; RTM-00; bộ đọc mã chạy được trên 16 mẫu thật | **Một phần** – CONV §3.4 dự án đã có; phần lớn tài liệu chưa viết | `traceability/src/parser.rs`; `traceability/src/service.rs#on_published`; `lifecycle.rs#checks`; `backend/crates/traceability/tests/templates.rs` | Một phần |
| D7 Hạng mục thông tin dưới quản lý cấu hình (sổ đăng ký khớp, kiểm toán cấu hình) | **Một phần** – sổ đăng ký tự sinh luôn khớp dữ liệu (`desc.txt` §7.5); nhưng không có báo cáo kiểm toán cấu hình, không lấy được sổ tại một thời điểm | **Một phần** – DOC-REG soạn tay; `templates/README.md` §6 có danh sách kiểm tra trước phát hành (lịch sử khớp DOC-REG) | **Chưa đạt** – `docs/` chưa commit; `desc.txt` bị `.gitignore` loại (mẫu `*.txt`); `backend/` (nguồn của mọi bằng chứng) chưa commit | `service.rs#list`; `.gitignore`; `git status` | Chưa đạt |

### 5.5 Kiểm chứng các nghi vấn trước đánh giá

| Nghi vấn | Kết quả | Bằng chứng |
|---|---|---|
| Bảng thuộc tính tự ghi Phiên bản / Ngày / Trạng thái nhưng không ghi người phê duyệt, đơn vị ban hành, người phụ trách | **Đúng.** Người duyệt chỉ có ở dòng lịch sử "Duyệt" và trường `approved_by`, không ở bảng thuộc tính | `template.rs#set_header_rows`; `lifecycle.rs#transition` |
| Lịch sử thay đổi tự thêm dòng | **Đúng.** Mỗi lần chuyển trạng thái và khi tạo phiên bản mới; không thêm khi đổi người soạn / mức bảo mật / lưu trữ; không chặn sửa dòng cũ | `template.rs#append_history` |
| CONV §9 của mẫu dùng "Đang rà soát / Đã phê duyệt", lệch trạng thái hệ thống | **Đúng.** Thêm: CONV §9 mẫu cho lên 1.0 "khi người phụ trách đồng ý" (HUB: khi phát hành); nhãn "Dự thảo – viết từ hệ thống đang chạy" của CONV §5 mẫu cũng bị ghi đè | `kernel/src/model.rs#VersionStatus`; mẫu CONV §5, §9 |
| DOC-REG / LOG "Đang cập nhật" không khớp vòng đời hệ thống | **Đúng.** Gửi duyệt ghi đè thành "Chờ duyệt"; tài liệu sống phải tạo phiên bản mới và đi lại vòng duyệt cho mỗi lần cập nhật | `lifecycle.rs#transition`; mẫu DOC-REG, LOG |
| Không có khái niệm baseline | **Đúng** | Không có thực thể / API baseline trong `backend/crates/` |
| Không có tạm giữ pháp lý chặn xoá theo hạn | **Đúng.** Truy vấn xoá chỉ lọc `status: superseded` và `superseded_at` | `integration.rs#purge_expired_versions` |
| Việc xoá theo hạn có ghi nhật ký không | **Không ghi.** Chỉ `tracing::info!` (log tiến trình), không phát sự kiện có cờ `audit`; nhật ký và thông báo bị TTL của MongoDB xoá không để lại dấu | `integration.rs#purge_expired_versions`; `audit/lib.rs` |
| Không xuất / lưu trữ ngoài hệ thống | **Đúng phần lớn.** Có lưu tay từng phiên bản qua tab Tài liệu; không có xuất hàng loạt kèm siêu dữ liệu | `js/docs.js#saveDoc` |
| Mẫu thiếu Tóm tắt / Phạm vi ở một số loại | **Đúng.** Phạm vi 6/24, tóm tắt 5/24 | §5.6 |
| SAD mẫu ghi 42010 nhưng thiếu bảng bên liên quan × mối quan tâm, định nghĩa viewpoint, correspondence, rationale | **Đúng một phần.** §1.2 "Ai đọc – Muốn biết – Đọc mục" là bảng bên liên quan × mối quan tâm rút gọn (không nối mối quan tâm với góc nhìn); §1.3 chỉ là đoạn văn, không định nghĩa góc nhìn; không có tương ứng giữa các view; lý do kiến trúc có ở ADR (cột Vì sao, Phương án đã cân nhắc, Hệ quả) nhưng SAD §11 chỉ trỏ sang | `templates/03_Kien_truc/SAD-00_Kien_truc_tong_the.md`; `templates/03_Kien_truc/ADR/ADR-00_So_dang_ky_quyet_dinh_nen_tang.md` §2 |
| Không có danh sách phân phối / xác nhận đã đọc | **Đúng.** `read_at` của thông báo chỉ là đã xem thông báo, không phải đã đọc tài liệu | `notifications/src/lib.rs` |
| Không có thông báo khi phát hành | **Sai một phần.** Có thông báo, nhưng chỉ tới người tạo, người phụ trách, người soạn (và người phụ trách tài liệu tầng dưới khi mã đổi) | `lifecycle.rs#transition`; `integration.rs#on_review_flags` |

### 5.6 Kết quả theo từng loại hạng mục thông tin của bộ mẫu

Chung cho cả 24 mẫu: **có** *Mã tài liệu*, *Phiên bản*, *Ngày*, *Trạng thái*, *Tài liệu liên quan*, *Lịch sử thay đổi*,
*Vấn đề còn mở*; 22/24 có dòng *Quy trình ISO/IEC/IEEE 12207* (GLOSSARY, LOG không có – HUB miễn kiểm); **không có**
*Đơn vị ban hành*, *Người phụ trách*, *Người duyệt*, *Mức bảo mật*. Cột "Loại 15289" là cách xếp của nhóm (LCP-00 §5.1).

| Mẫu | Loại 15289 | Phạm vi | Tóm tắt | Ngữ cảnh | Chuẩn tham chiếu | Thuật ngữ | Ghi chú |
|---|---|---|---|---|---|---|---|
| CONV | policy · procedure | Có (dòng *Áp dụng cho*) | Thiếu | Thiếu | Có | Có | §9 lệch vòng đời HUB |
| DOC-REG | report | Thiếu | Thiếu | Thiếu | Có | Có | "Đang cập nhật"; loại 15289 chỉ ở §1; §9 lưu trữ bằng thư mục |
| GLOSSARY | description | Thiếu | Thiếu | Thiếu | Thiếu | (chính nó) | Không có dòng Quy trình ISO |
| RTM-00 | report | Thiếu | Thiếu | Thiếu | Có | Có | – |
| LOG | report | Thiếu | Thiếu | Thiếu | Thiếu | Thiếu | "Đang cập nhật"; không có dòng Quy trình ISO |
| BMA-00 | description | Thiếu | Thiếu | Có (§2) | Thiếu | Có | – |
| BPMN-00 | description | Có (§1) | Có (§2) | Thiếu | Thiếu (có §8 Tham khảo) | Thiếu | – |
| BPMN cấp 1 | description | Có (§1) | Có (§2) | Thiếu | Thiếu (có §8 Tham khảo) | Thiếu | – |
| StRS-00 | specification | Thiếu | Thiếu | Thiếu | Có | Thiếu | – |
| SyRS-00 | specification | Có (§2) | Thiếu | Thiếu | Có | Thiếu | – |
| SRS | specification | Có (§1.2) | Có (§2) | Có (§2.1) | Có (+ §1.4) | Có (§1.3) | Đủ nhất |
| SAD-00 | description | Thiếu | Có (§2) | Có (§3) | Có | Thiếu | Thiếu phần tử 42010 (§5.5) |
| ADR-00 | description | Thiếu | Thiếu | Thiếu | Thiếu | Thiếu | Có lý do, phương án, hệ quả |
| ADR theo hệ thống con | description | Thiếu | Thiếu | Thiếu | Thiếu | Thiếu | – |
| SDD | description | Thiếu | Thiếu | Có (§2) | Có | Thiếu | – |
| DBD-00 | description | Thiếu | Thiếu | Thiếu | Thiếu | Thiếu | – |
| ERD | description | Thiếu | Thiếu | Thiếu | Thiếu | Thiếu | – |
| ICD-00 | description | Thiếu | Thiếu | Thiếu | Thiếu | Thiếu | – |
| API | specification | Thiếu | Thiếu | Thiếu | Có | Thiếu | – |
| STP-00 | plan | Thiếu | Thiếu | Thiếu | Có | Thiếu | Không có lịch; không nêu hạng mục không kiểm thử |
| DEP-00 | procedure | Thiếu | Thiếu | Thiếu | Thiếu | Thiếu | – |
| DEP theo hệ thống con | procedure | Có (§1) | Thiếu | Thiếu | Thiếu | Thiếu | – |
| OPS-00 | procedure | Thiếu | Thiếu | Thiếu | Thiếu | Thiếu | – |
| ASM-00 | report | Thiếu | Có (§1) | Thiếu | Có | Thiếu | – |
| **Có / 24** | – | **6** | **5** | **4** | **11** | **5 / 23** | – |

## 6. Khuyến nghị

Mã `CR-nn` (Compliance Recommendation – khuyến nghị tuân thủ) là mã mới của dự án, định nghĩa ở ô đầu dòng bảng dưới.
Công sức tính bằng ngày công của một người (suy luận).

| Mã | Mô tả | Đối tượng | Ưu tiên | Đề xuất sửa (tệp / hàm) | Công sức | Tiêu chí |
|---|---|---|---|---|---|---|
| CR-01 | Danh mục loại đóng (24 loại biên dịch sẵn), không có loại cho quy trình quản lý – LCP-00, CMP-00 không tạo được trong HUB | Hệ thống | Cao | Thêm loại `LCP` (plan, thư mục 00) và `CMP` (report, thư mục 09) vào `backend/crates/documents/src/catalog.rs#TYPES` kèm mẫu mới; thêm trường `info_item_kind` vào `DocType` và trả ở `GET /document-types`; thêm nhãn vào `backend/crates/kernel/src/codes.rs#DOC_LABELS`; thêm loại mã `CR` vào `backend/crates/traceability/src/parser.rs#KINDS` (nơi định nghĩa: CMP); sửa kiểm thử `catalog_is_complete_and_consistent`. Về lâu dài nạp danh mục từ cấu hình thay mảng hằng | 2–3 | B1, B3, B4 |
| CR-02 | Mỗi loại chỉ một bản cho workspace / hệ thống con / quy trình – không có báo cáo theo đợt, theo bản phát hành | Hệ thống | Trung bình | Thêm kiểu số bản "chuỗi" (đánh số `CCS-<LOẠI>-<nnn>` tăng dần) ở `backend/crates/kernel` (`Cardinality`) và `catalog.rs#document_code`; đưa số thứ tự vào khoá của chỉ mục `documents_cardinality` (`service.rs#ensure_indexes`); hộp tạo tài liệu ở `js/hub-docs.js` | 2–3 | B4 |
| CR-03 | Không có baseline: không chụp được bộ tài liệu đang phát hành cho một bản phát hành phần mềm | Hệ thống | Cao | Tệp mới `backend/crates/documents/src/baseline.rs`: collection `document_baselines` (tên, phiên bản phần mềm / commit / thẻ ảnh, danh sách `document_id` – `version_id` – `version` – băm SHA-256), bất biến sau khi tạo; `POST /workspaces/{ws}/baselines`, `GET /baselines/{id}`; `integration.rs#purge_expired_versions` không xoá bản thuộc baseline còn hiệu lực; cảnh báo khi còn cờ Cần rà soát mở; trang baseline ở `js/hub-docs.js` | 4–6 | D5, D7 |
| CR-04 | Xoá theo hạn không để lại hồ sơ (chỉ một dòng log), không trong transaction, chưa kiểm thử | Hệ thống | Cao | Trong `integration.rs#purge_expired_versions`: mỗi bản xoá phát sự kiện mới `document.version.purged` có `.audit()` (mã tài liệu, số bản, `superseded_at`, số nhận xét / lượt duyệt đã xoá) bằng `publish_in` cùng transaction với các lệnh xoá; thêm hằng sự kiện ở `backend/crates/kernel/src/events.rs`; thêm kiểm thử tích hợp (hạn lưu 0 năm) ở `backend/crates/documents/tests/lifecycle.rs` | 1 | C9, C11 |
| CR-05 | Không có tạm giữ (legal hold) để chặn xoá theo hạn khi cần giữ cho kiểm toán / tranh chấp | Hệ thống | Cao | Trường `hold` (lý do, người đặt, thời điểm) ở `model.rs#DocumentDoc` và ở workspace; API đặt / gỡ (workspace owner, có `.audit()`); `purge_expired_versions` bỏ qua tài liệu đang tạm giữ; thay chỉ mục TTL `audit_ttl` (`backend/crates/audit/src/lib.rs`, `Module::init`) bằng tác vụ dọn có tôn trọng tạm giữ | 2–3 | C10, C11 |
| CR-06 | Không xuất được hồ sơ ra ngoài hệ thống (nội dung + trạng thái + lượt duyệt + nhật ký) | Hệ thống | Trung bình | `GET /documents/{id}/export`, `GET /workspaces/{ws}/export` (workspace owner): gói zip gồm mọi phiên bản còn giữ (`.md`), `metadata.json` (trạng thái, người duyệt / phát hành, thời điểm, mức bảo mật), `reviews.json`, nhật ký liên quan, manifest có SHA-256 từng tệp; route ở `backend/crates/documents/src/http.rs#router`, hàm mới ở `service.rs`; ghi `.audit()` mỗi lần xuất | 3–4 | C12, C9 |
| CR-07 | Bảng thuộc tính không mang người phụ trách, người duyệt, đơn vị ban hành, mức bảo mật – bản tải về mất các thông tin này | Hệ thống | Trung bình | Mở rộng danh sách dòng hệ thống tự ghi ở `lifecycle.rs#transition`, `#new_version` và `service.rs#update`: *Người phụ trách* (`owner_id`), *Người duyệt* (tên + ngày, khi Duyệt), *Mức bảo mật*, *Đơn vị ban hành* (thuộc tính mới của workspace ở `backend/crates/workspaces/src/model.rs`); cho `template.rs#set_header_rows` thêm dòng nếu thiếu (hiện chỉ ghi đè dòng đã có) | 1–2 | A5, A6, A7, C7 |
| CR-08 | Bảng *Lịch sử thay đổi* sửa / xoá được trong bản dự thảo, không bị phát hiện khi gửi duyệt | Hệ thống | Trung bình | Trong `lifecycle.rs#checks` (Gửi duyệt): so các dòng lịch sử của bản gốc (`based_on_version_id`) và các dòng hệ thống đã ghi trong bản này với nội dung hiện tại – thiếu / khác ⇒ lỗi `history.tampered`; hàm đọc bảng lịch sử mới trong `template.rs`; hoặc dựng lại bảng từ `document_reviews` khi phát hành | 1–2 | D4, A7 |
| CR-09 | Không lưu băm nội dung – không chứng minh được bản phát hành trùng bản đã duyệt | Hệ thống | Thấp | Thêm `submitted_sha256`, `approved_sha256`, `published_sha256` vào `model.rs#VersionDoc` (băm phần thân, bỏ các dòng hệ thống ghi), tính ở `lifecycle.rs#transition`; hiện ở lịch sử duyệt | 0,5–1 | D1 |
| CR-10 | Nhật ký thiếu một số thay đổi; có sự kiện ghi ngoài transaction | Hệ thống | Trung bình | Thêm `.audit()` cho `DOCUMENT_LINK_ADDED` / `DOCUMENT_LINK_REMOVED` (`service.rs#add_link`, `#remove_link`) và `TRACE_REVIEW_FLAGS_RAISED` (`traceability/src/service.rs#on_published`); phát sự kiện mới cho đổi tên (`service.rs#update` – hiện không phát) và xoá nhận xét (`comments.rs#delete_comment` – hiện không phát); chuyển `bus.publish` sang `publish_in` cùng transaction ở `service.rs#update` (sự kiện đổi mức bảo mật hiện ghi **trước** lệnh cập nhật) và `#set_archived` | 1 | C9 |
| CR-11 | Không có danh sách phân phối, không ghi nhận đã đọc; phát hành chỉ báo người tạo / phụ trách / soạn | Hệ thống | Trung bình | Collection `document_subscriptions` (người / group theo dõi) và `document_reads` (người, phiên bản, thời điểm xác nhận); mở rộng `notify` của nhánh `Action::Publish` trong `lifecycle.rs#transition`; nút "Xác nhận đã đọc" và danh sách đã đọc ở `js/hub-docs.js`; câu thông báo ở `notifications/src/lib.rs#render` | 2–3 | C5, C6 |
| CR-12 | Thời hạn lưu là một chính sách chung, một giá trị cứng trong mã, mốc nhật ký chưa chốt | Hệ thống | Thấp | `DocType.retention_years` (mặc định = `VERSION_RETENTION_YEARS`) dùng ở `integration.rs#purge_expired_versions`; đưa 180 ngày của thông báo thành biến môi trường ở `platform/src/config.rs#RetentionSettings`; chốt mốc nhật ký (`desc.txt` §5.3) và ghi vào `backend/docs/DECISIONS.md` | 1 | C10 |
| CR-13 | Không kiểm mục bắt buộc theo loại khi gửi duyệt | Hệ thống | Thấp | `DocType.required_sections` (lấy từ CONV §8; tối thiểu: mục đích / phạm vi, *Vấn đề còn mở*, *Lịch sử thay đổi*); cảnh báo ở `lifecycle.rs#checks` và `service.rs#lint` | 1–2 | A14 |
| CR-14 | CONV §9 của bộ mẫu lệch vòng đời HUB | Mẫu | Cao | Sửa `templates/00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md` §9 theo 5 trạng thái của HUB, 0.2 khi trả lại / rút lại / mở lại, 1.0 khi phát hành lần đầu, 1.1 / 2.0 sau đó, hệ thống tự thêm dòng lịch sử – lấy §9 của CONV dự án làm bản gốc | 0,5 | C3, C8, D3 |
| CR-15 | DOC-REG, LOG ghi "Đang cập nhật" – trạng thái không có trong HUB; DOC-REG §9 lưu trữ bằng thư mục | Mẫu | Cao | Đổi dòng *Trạng thái* của `templates/00_Quan_ly_tai_lieu/DOC-REG_So_dang_ky_tai_lieu.md`, `LOG_Nhat_ky_xay_dung_tai_lieu.md` về "Dự thảo", ghi "tài liệu sống, phát hành theo đợt"; thay DOC-REG §9 bằng trạng thái Thay thế / Lưu trữ của HUB; về lâu dài để HUB sinh DOC-REG từ sổ đăng ký (`desc.txt` §7.5, cùng CR-03) | 0,5 | C4, C8 |
| CR-16 | 24 mẫu thiếu dòng đơn vị ban hành, người phụ trách, người duyệt, mức bảo mật | Mẫu | Cao | Thêm 4 dòng vào bảng thuộc tính của 24 mẫu và CONV §4 (như CONV dự án đã làm với *Đơn vị ban hành*); `template.rs#check_header` coi là dòng tuỳ chọn phải điền (như *Nguồn đã khảo sát*); sửa kiểm thử `header_check_reports_missing_and_unfilled_rows` | 1 | A5, A6, A7, C7 |
| CR-17 | Thiếu mục phạm vi (18/24), tóm tắt (19/24), liên kết thuật ngữ (18/23); CONV §8 chỉ quy định 5/24 loại | Mẫu | Trung bình | Thêm "Mục đích và phạm vi" cho các mẫu thiếu, "Tóm tắt" cho các mẫu dài (SDD, STP-00, DEP-00, OPS-00, ICD-00, DBD-00…), câu trỏ GLOSSARY ở mục đầu; mở rộng CONV §8 đủ 24 loại (đầu vào cho CR-13) | 1–2 | A4, A9, A11, A12, A14 |
| CR-18 | Mẫu SAD ghi ISO/IEC/IEEE 42010 nhưng thiếu phần tử của mô tả kiến trúc | Mẫu | Trung bình | Trong `templates/03_Kien_truc/SAD-00_Kien_truc_tong_the.md`: đổi §1.2 thành bảng bên liên quan × mối quan tâm (nối tới góc nhìn); §1.3 định nghĩa từng góc nhìn (mối quan tâm trả lời, loại mô hình, quy ước – trỏ CONV §7); thêm mục tương ứng giữa các view (container ↔ triển khai ↔ dữ liệu); §11 tóm tắt lý do của các quyết định chính | 1 | A14 |
| CR-19 | Loại hạng mục 15289 chỉ ghi cho 5/24 loại; không có mẫu cho quy trình quản lý | Mẫu | Trung bình | Thêm cột "Loại hạng mục thông tin" vào mọi bảng DOC-REG §2–§8 và CONV §3.3 (theo LCP-00 §5.1); thêm mẫu LCP, CMP vào `templates/` (dựng từ LCP-00, CMP-00 của dự án), cùng CR-01 | 1 (+2 cho mẫu mới) | B1, B3 |
| CR-20 | DOC-REG gọi CONV là "Information management plan" nhưng CONV không có nội dung kế hoạch quản lý thông tin | Mẫu | Thấp | Thêm vào CONV mẫu mục "Quản lý thông tin": quyền hạn tạo / duyệt / phát hành, phân phối, mức bảo mật, thời hạn lưu, huỷ, tạm giữ – hoặc trỏ sang mẫu LCP (CR-19) | 0,5–1 | C3, C5, C10, C11 |
| CR-21 | STP-00 là kế hoạch nhưng thiếu lịch và hạng mục không kiểm thử; không có mẫu báo cáo kiểm thử | Mẫu | Thấp | Thêm vào `templates/07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md` mục lịch / mốc và "không kiểm thử"; thêm mẫu báo cáo hoàn thành kiểm thử theo ISO/IEC/IEEE 29119-3 (nhiều bản – cần CR-02) | 1–2 | B2 |
| CR-22 | Nhãn cách lập ("Dự thảo – viết từ hệ thống đang chạy") nằm trong dòng *Trạng thái*, bị HUB ghi đè ở lần chuyển trạng thái đầu | Mẫu | Thấp | Thêm dòng *Cách lập* vào bảng thuộc tính (CONV §4, §5 mẫu) để dòng *Trạng thái* chỉ chứa nhãn vòng đời; `template.rs#check_header` coi *Cách lập* là dòng tuỳ chọn | 0,5 | C8 |
| CR-23 | Bộ tài liệu, mã HUB và đặc tả gốc không nằm dưới quản lý cấu hình | Tài liệu dự án | Cao | Commit `docs/`, `backend/` (gồm `Cargo.lock`), `js/api.js`, `js/hub*.js`; bỏ `desc.txt` khỏi mẫu `*.txt` của `.gitignore` (hoặc đổi tên `desc.md`); vì GitHub Pages phục vụ cả `main` ở thư mục gốc (`README.md` mục Triển khai), chuyển trang web sang phát hành từ nhánh / thư mục chỉ chứa tệp tĩnh (ví dụ nhánh `publish` sẵn có) để `docs/`, `backend/`, `desc.txt` không bị công khai | 0,5–1 | C4, C5, D7 |
| CR-24 | LCP-00, CMP-00 và các tài liệu khác chưa đi qua vòng đời duyệt – phát hành; chưa chỉ định người | Tài liệu dự án | Trung bình | Chỉ định người phụ trách và group owner duyệt cho từng tài liệu (CONV §10); nạp `docs/` vào workspace `CCS` trên HUB (LCP, CMP sau CR-01); tới lúc đó ghi dòng lịch sử "Duyệt" bằng tay và để người khác người soạn rà CMP-00 | 1 | A6, A7, C3 |
| CR-25 | Bộ tài liệu chưa có baseline, sơ đồ còn Mermaid, mức bảo mật chưa ghi | Tài liệu dự án | Thấp | Khi tài liệu yêu cầu / thiết kế lên 1.0: lập baseline theo LCP-00 §4.4 (tag git); đổi sơ đồ Mermaid sang sơ đồ nhúng; ghi mức bảo mật (Workspace) trên từng tài liệu sau CR-16 | 1–2 | C2, C7, D5 |

Tổng: 25 khuyến nghị – 8 Cao (CR-01, 03, 04, 05, 14, 15, 16, 23), 10 Trung bình, 7 Thấp. Theo đối tượng: hệ thống 13 (21,5–32
ngày công), bộ mẫu 9 (9–11,5 ngày), tài liệu dự án 3 (2,5–4 ngày).

## 7. Vấn đề còn mở

- **Mã mới `CR-nn`** (Compliance Recommendation – khuyến nghị tuân thủ): định nghĩa ở CMP-00 §6, tham chiếu ở LCP-00 §3.2,
  §4.4, §5.5. Cần bổ sung vào bảng mã phần tử truy vết của [CONV §3.4](../00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md)
  (mẫu `CR-<nn>`, định nghĩa tại CMP-00 §6, được tham chiếu tại LCP-00, ASM-00). Bộ đọc mã của HUB chưa biết loại này
  (`backend/crates/traceability/src/parser.rs#KINDS`) – nằm trong CR-01.
- Loại tài liệu `CMP` chưa có trong danh mục 24 loại của HUB (`backend/crates/documents/src/catalog.rs`) và chưa có mẫu trong
  `templates/` (CR-01, CR-19).
- Tiêu chí và cách xếp loại chung theo ISO/IEC/IEEE 15289 dựa vào hiểu biết của nhóm về cấu trúc chuẩn; chưa đối chiếu bản
  chuẩn gốc. Khi đánh giá chính thức cần kiểm lại danh sách phần tử nội dung chung và các loại hạng mục.
- Đối tượng (3) mới đánh giá trên 7 tệp có lúc 2026-11-18 (BMA-00, StRS-00, SyRS-00 chỉ xét cấu trúc); cần đánh giá lại
  khi đủ 28 tài liệu trong sổ. Người soạn CMP-00 cũng soạn LCP-00 – cần người khác rà phần đánh giá đối tượng (3).
- Các kết luận về hành vi chưa chạy thử (gửi duyệt tài liệu chỉ có bảng thuộc tính; dựng lại bộ tài liệu theo
  `published_at` / `superseded_at`; luồng lưu tệp từ bản chỉ đọc ở tab Tài liệu) là (suy luận) từ đọc mã.
- Công sức ở §6 là ước lượng thô của một người, chưa tính kiểm thử giao diện.

## 8. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | 2026-11-18 | Khởi tạo từ bộ mẫu, viết lại từ hệ thống đang chạy | Nhóm phát triển ChillCat Studio |
