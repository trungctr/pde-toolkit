# Quy ước tài liệu và mã truy vết

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | CCS-CONV-001 |
| Phiên bản | 0.1 |
| Ngày | 2026-11-18 |
| Trạng thái | Dự thảo – viết từ hệ thống đang chạy |
| Quy trình ISO/IEC/IEEE 12207 | 6.3.6 Information Management |
| Chuẩn tham chiếu | ISO/IEC/IEEE 15289 |
| Áp dụng cho | Mọi tài liệu của dự án CCS – ChillCat Studio (thư mục `docs/`) |
| Nguồn đã khảo sát | `templates/00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md`, `templates/README.md`, `README.md`, `desc.txt`, `backend/README.md`, `backend/docs/DECISIONS.md`, `backend/crates/documents/src/catalog.rs`, `backend/crates/documents/src/template.rs`, `backend/crates/traceability/src/parser.rs`, `backend/crates/kernel/src/codes.rs`, `backend/crates/kernel/src/model.rs`, `js/plantuml.js` |
| Đơn vị ban hành | Nhóm phát triển ChillCat Studio |
| Tài liệu liên quan | ⇄ [DOC-REG](DOC-REG_So_dang_ky_tai_lieu.md) · [RTM-00](RTM-00_Ma_tran_truy_vet.md) · [GLOSSARY](GLOSSARY_Thuat_ngu.md) · [LCP-00](LCP-00_Ke_hoach_vong_doi_phan_mem.md) · [LOG](LOG_Nhat_ky_xay_dung_tai_lieu.md) |

---

## 1. Mục đích

Bộ tài liệu chỉ thật sự hữu ích khi người đọc lần được từ một yêu cầu tới chỗ nó được thiết kế, lập trình và kiểm thử – và lần ngược lại. Tài liệu này đặt ra các quy tắc chung để làm được điều đó cho dự án CCS: thư mục nào chứa gì, mã đặt ra sao, liên kết thế nào, vẽ sơ đồ bằng ký hiệu nào.

Tài liệu này là bản của dự án, lập từ mẫu CONV của bộ mẫu (`templates/`). Phần riêng của dự án nằm ở §2, §3.1–§3.3, §5, §7.1, §8 (hai loại mới), §9. Các quy tắc chung còn lại giữ như mẫu.

## 2. Thư mục và câu hỏi mỗi thư mục trả lời

Đường dẫn tính từ thư mục `docs/` của repo.

| Thư mục | Trả lời câu hỏi | Tài liệu | Quy trình ISO/IEC/IEEE 12207 | Chuẩn nội dung |
|---|---|---|---|---|
| `00_Quan_ly_tai_lieu` | Bộ tài liệu gồm những gì, viết theo quy ước nào, các phần nối nhau ra sao, vòng đời dự án quản lý thế nào? | CONV, DOC-REG, GLOSSARY, RTM-00, LOG, LCP-00 | 6.3.6; LCP-00 thêm 6.2.1, 6.3.1, 6.3.2, 6.3.5, 6.3.7, 6.3.8 | ISO/IEC/IEEE 15289 |
| `01_Phan_tich_nghiep_vu` | Tổ chức làm việc thế nào, hệ thống hỗ trợ những quy trình nào? | BMA-00, BPMN-00, BPMN-22, BPMN-31 | 6.4.1 | BPMN 2.0 (ISO/IEC 19510) |
| `02_Yeu_cau` | Ai cần gì, hệ thống phải làm gì? | StRS-00, SyRS-00, SRS-EDT, SRS-HUB | 6.4.2, 6.4.3 | ISO/IEC/IEEE 29148 |
| `03_Kien_truc` | Hệ thống chia thành những khối nào, vì sao chọn như vậy? | SAD-00, ADR-00, ADR-HUB | 6.4.4 | ISO/IEC/IEEE 42010, C4 |
| `04_Thiet_ke_chi_tiet` | Bên trong từng khối hoạt động ra sao? | SDD-EDT, SDD-HUB | 6.4.5 | IEEE 1016 |
| `05_Thiet_ke_du_lieu` | Dữ liệu nằm ở đâu, cấu trúc thế nào? | DBD-00, ERD-HUB | 6.4.5 | Ký hiệu chân chim |
| `06_Giao_dien_tich_hop` | Các khối gọi nhau ở đâu, bằng cách nào? | ICD-00, API-HUB | 6.4.4, 6.4.8 | OpenAPI (tham khảo) |
| `07_Kiem_thu` | Làm sao chứng minh hệ thống đúng yêu cầu? | STP-00 | 6.4.9, 6.4.11 | ISO/IEC/IEEE 29119 |
| `08_Trien_khai_van_hanh` | Đưa lên môi trường và giữ cho chạy ổn định thế nào? | DEP-00, OPS-00 | 6.4.10, 6.4.12, 6.4.13 | ISO/IEC/IEEE 15289 |
| `09_Danh_gia_hien_trang` | Đang có rủi ro gì, xử lý theo thứ tự nào? Bộ tài liệu và hệ thống đáp ứng chuẩn tới đâu? | ASM-00, CMP-00 | 6.3.4, 6.3.7; CMP-00: 6.3.8 | ISO 31000 (tham khảo); CMP-00: ISO/IEC/IEEE 15289 |

Danh sách đầy đủ tài liệu, mã và phiên bản: [DOC-REG](DOC-REG_So_dang_ky_tai_lieu.md). Tài liệu không lập (cắt giảm) và lý do: [DOC-REG](DOC-REG_So_dang_ky_tai_lieu.md), [LCP-00](LCP-00_Ke_hoach_vong_doi_phan_mem.md).

## 3. Mã định danh

### 3.1 Mã dự án và hệ thống con

Mã dự án: **`CCS`** – ChillCat Studio, bộ công cụ soạn tài liệu thiết kế phần mềm.

| Mã hệ thống con | Tên | Phụ trách việc gì | Mã nguồn | Mã module | Người phụ trách |
|---|---|---|---|---|---|
| `EDT` | Bộ soạn trên trình duyệt | Soạn tài liệu Markdown theo bộ mẫu, vẽ diagram, thiết kế trang, Chat AI, giọng nói, hướng dẫn, cài đặt; chạy offline, dữ liệu ở trình duyệt, không cần máy chủ | `index.html`, `css/`, `js/*.js` (trừ `js/api.js`, `js/hub*.js`), `sw.js`, `manifest.webmanifest`, `templates/` | `DOC`, `DGM`, `DSG`, `AIC`, `GDE`, `SET`, `VOI`, `PWA` | Nhóm phát triển ChillCat Studio |
| `HUB` | Làm việc nhóm | Tab **Dự án** và máy chủ: tài khoản, workspace, group, phân quyền, vòng đời tài liệu, truy vết mã, ticket và AI, thông báo, nhật ký | `js/api.js`, `js/hub.js`, `js/hub-docs.js`, `js/hub-tickets.js`, phần tích hợp trong `js/docs.js`; `backend/` | `IDN`, `WSP`, `DOC`, `TRC`, `TKT`, `NTF`, `AUD`, `PLT` | Nhóm phát triển ChillCat Studio |

Module và mã nguồn chính (đường dẫn tính từ gốc repo):

| Hệ thống con | Module | Nội dung | Mã nguồn |
|---|---|---|---|
| EDT | `DOC` | Tab Tài liệu: soạn / xem Markdown, mẫu tài liệu, nhúng diagram, xuất HTML | `js/docs.js`, `js/markdown.js`, `js/md-rich.js`, `js/doc-library.js`, `templates/` |
| EDT | `DGM` | Tab Diagram: whiteboard Flowchart / BPMN / UML / ERD, mẫu diagram, trợ giúp, dịch Mermaid / PlantUML | `js/editor.js`, `js/shapes.js`, `js/render.js`, `js/store.js`, `js/templates.js`, `js/help.js`, `js/export.js`, `js/plantuml.js`, `js/ui.js` |
| EDT | `DSG` | Tab Thiết kế trang: kéo thả, nhập HTML, xuất HTML | `js/page-kit.js`, `js/page-editor.js`, `js/page-import.js` |
| EDT | `AIC` | Chat AI: nhà cung cấp, skill, khung chat, copy context | `js/ai.js`, `js/skill.js`, khung chat trong `js/ui.js` |
| EDT | `GDE` | Tab Hướng dẫn | `js/guide.js` |
| EDT | `SET` | Tab Cài đặt | `js/settings.js` |
| EDT | `VOI` | Giọng nói: nhận dạng, lệnh, đọc phản hồi | `js/voice.js` |
| EDT | `PWA` | Khởi động, tự lưu, offline, cài như ứng dụng, lưu trong trình duyệt | `index.html`, `js/main.js`, `js/util.js`, `sw.js`, `manifest.webmanifest`, `css/styles.css`, `icons/` |
| HUB | `IDN` | Tài khoản, đăng nhập, phiên, quản trị tài khoản | `backend/crates/identity/`, `js/api.js`, `js/hub.js` |
| HUB | `WSP` | Workspace, group, hệ thống con, thành viên, lời mời, phép tính quyền | `backend/crates/workspaces/`, `backend/crates/kernel/src/perms.rs`, `backend/crates/kernel/src/contracts/access.rs`, `js/hub.js` |
| HUB | `DOC` | 24 loại tài liệu, tài liệu, phiên bản, vòng đời, mức bảo mật, quan hệ, nhận xét | `backend/crates/documents/`, `js/hub-docs.js`, thanh máy chủ trong `js/docs.js` |
| HUB | `TRC` | Đọc mã truy vết, sổ mã, cờ Cần rà soát | `backend/crates/traceability/`, `js/hub-docs.js` |
| HUB | `TKT` | Ticket, quyền ticket, AI kiểm tra trùng, đề xuất sửa tài liệu | `backend/crates/tickets/`, `js/hub-tickets.js` |
| HUB | `NTF` | Thông báo trong ứng dụng | `backend/crates/notifications/`, `js/hub.js` |
| HUB | `AUD` | Nhật ký thao tác | `backend/crates/audit/`, `js/hub.js` |
| HUB | `PLT` | Nền tảng: cấu hình, MongoDB, outbox, HTTP, JWT, ghép module, tác vụ định kỳ, sức khoẻ, đóng gói Docker | `backend/crates/kernel/`, `backend/crates/platform/`, `backend/apps/server/`, `backend/Dockerfile`, `backend/deploy/` |

Thư mục `templates/` là nguồn chung: EDT tải mẫu bằng `fetch` (`js/doc-library.js#fetchTemplate`), HUB nhúng mẫu vào file chạy lúc build (`backend/crates/documents/src/catalog.rs`, `include_str!`).

Mỗi hệ thống con theo mẫu có một bộ SRS / SDD / ERD / API / ADR riêng. Dự án cắt giảm như sau (lý do ở [LCP-00](LCP-00_Ke_hoach_vong_doi_phan_mem.md) và [DOC-REG](DOC-REG_So_dang_ky_tai_lieu.md)): EDT chỉ có SRS-EDT và SDD-EDT – quyết định của EDT nằm ở ADR-00, EDT không có CSDL máy chủ (kho trình duyệt mô tả ở DBD-00) và không mở API (lời gọi ra ngoài mô tả ở ICD-00). Cả hai hệ thống con triển khai theo DEP-00, không lập DEP riêng.

### 3.2 Nhiều sản phẩm trên cùng nền tảng (tuỳ chọn)

Không áp dụng. Dự án chỉ có **một sản phẩm** – ChillCat Studio – nên các bảng chức năng, API và dữ liệu **bỏ cột Sản phẩm**. Hai hệ thống con EDT và HUB là hai phần của cùng sản phẩm, phân biệt bằng cột "Hệ thống con" (BMA-00 §5, SyRS-00 §4).

Năng lực được hai hệ thống con cài đặt hai lần liệt kê ở [BMA-00 §7](../01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md); đề xuất hợp nhất (nếu có) ở [ASM-00 §5](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md).

### 3.3 Mã tài liệu

Tài liệu riêng của một hệ thống con mang mã `CCS-<LOẠI>-<HTC>-<nnn>`; tài liệu chung của cả dự án mang mã `CCS-<LOẠI>-000`. Theo đúng bộ mẫu, ba tài liệu CONV, GLOSSARY, LOG mang đuôi `-001`; tài liệu quy trình cấp 1 mang mã `CCS-BPMN-0<nn>` (cách HUB sinh mã: `backend/crates/documents/src/catalog.rs#document_code`, quyết định #23 ở `backend/docs/DECISIONS.md`). Tên file viết không dấu, nối bằng gạch dưới, ví dụ `SRS-HUB_Lam_viec_nhom.md`, `RTM-00_Ma_tran_truy_vet.md`.

| Loại | Tên đầy đủ | Thư mục | Mẫu tên file | Số bản |
|---|---|---|---|---|
| `CONV`, `DOCREG`, `GLOSSARY`, `RTM`, `LOG` | Quản lý tài liệu | 00 | `CONV_…`, `RTM-00_…` | 1 |
| `LCP` | Software Life Cycle Plan – Kế hoạch vòng đời phần mềm (**loại mới của dự án**) | 00 | `LCP-00_…` | 1 |
| `BMA` | Business / Mission Analysis | 01 | `BMA-00_…` | 1 |
| `BPMN` | Mô hình quy trình nghiệp vụ | 01 | `BPMN-00_…` (cấp 0), `BPMN-22_…`, `BPMN-31_…` (cấp 1) | 1 + mỗi quy trình có sơ đồ riêng |
| `StRS` | Stakeholder Requirements Specification | 02 | `StRS-00_…` | 1 |
| `SyRS` | System Requirements Specification | 02 | `SyRS-00_…` | 1 |
| `SRS` | Software Requirements Specification | 02 | `SRS-EDT_…`, `SRS-HUB_…` | mỗi hệ thống con (2) |
| `SAD` | Software Architecture Description | 03 | `SAD-00_…` | 1 |
| `ADR` | Architecture Decision Record | 03/ADR | `ADR-00_…`, `ADR-HUB_…` | 1 + HUB (EDT dùng ADR-00) |
| `SDD` | Software Design Description | 04 | `SDD-EDT_…`, `SDD-HUB_…` | mỗi hệ thống con (2) |
| `DBD` / `ERD` | Database Design / Entity Relationship | 05 | `DBD-00_…`, `ERD-HUB_…` | 1 + HUB |
| `ICD` / `API` | Interface Control / API Specification | 06 | `ICD-00_…`, `API-HUB_…` | 1 + HUB |
| `STP` | Software Test Plan | 07 | `STP-00_…` | 1 |
| `DEP` / `OPS` | Deployment / Operations | 08 | `DEP-00_…`, `OPS-00_…` | 1 + 1 (không có hạ tầng riêng theo hệ thống con) |
| `ASM` | Assessment – rủi ro và nợ kỹ thuật | 09 | `ASM-00_…` | 1 |
| `CMP` | Compliance Assessment – Báo cáo đánh giá tuân thủ (**loại mới của dự án**) | 09 | `CMP-00_…` | 1 |

Ví dụ: `CCS-SRS-HUB-001` là SRS của hệ thống con `HUB`; `CCS-BPMN-022` là tài liệu của quy trình `BP-22`; `CCS-LCP-000` là kế hoạch vòng đời của cả dự án.

**Hai loại tài liệu mới và lý do.** ISO/IEC/IEEE 12207:2017 có 30 quy trình; bộ 24 mẫu phủ phần lớn các quy trình kỹ thuật (6.4.x) cùng 6.3.4, 6.3.6 và một phần 6.3.7 (§2), nhưng chưa có hạng mục thông tin cho các quy trình quản lý mà một dự án vẫn phải làm: lập kế hoạch, kiểm soát, quản lý cấu hình, đảm bảo chất lượng, quản lý mô hình vòng đời. Dự án thêm:

- `LCP` – **Kế hoạch vòng đời phần mềm**: mô hình vòng đời, bảng cắt giảm (tailoring) 30 quy trình 12207, quản lý cấu hình, quản lý thông tin theo ISO/IEC/IEEE 15289, đảm bảo chất lượng, đo lường. Phục vụ 6.2.1 Life Cycle Model Management, 6.3.1 Project Planning, 6.3.2 Project Assessment and Control, 6.3.5 Configuration Management, 6.3.6 Information Management, 6.3.7 Measurement, 6.3.8 Quality Assurance. Gom các kế hoạch quản lý mà ISO/IEC/IEEE 15289 liệt kê thành một tài liệu, vì dự án nhỏ, một nhóm phát triển.
- `CMP` – **Báo cáo đánh giá tuân thủ**: đánh giá hệ thống và bộ mẫu theo ISO/IEC/IEEE 15289 (hạng mục thông tin nào có, thiếu, nội dung bắt buộc nào chưa đủ). Phục vụ 6.3.8 Quality Assurance. Tách khỏi ASM-00 vì ASM-00 đánh giá rủi ro kỹ thuật, còn CMP-00 đánh giá sự phù hợp với chuẩn.

Hai loại này **chưa có** trong danh mục 24 loại của HUB (`backend/crates/documents/src/catalog.rs`) và chưa có trong danh sách nhãn loại tài liệu (`backend/crates/kernel/src/codes.rs#DOC_LABELS`) – xem §10.

### 3.4 Mã phần tử truy vết

Mỗi mã chỉ có **một nơi định nghĩa** (cột "Định nghĩa tại"). Nơi khác chỉ nhắc tới bằng mã, không viết lại nội dung. Muốn sửa nội dung một mã thì sửa ở nơi định nghĩa, rồi xem lại các nơi tham chiếu theo [RTM-00 §5](RTM-00_Ma_tran_truy_vet.md).

Ở EDT và HUB, "SRS / SDD của hệ thống con" nghĩa là bản của đúng hệ thống con đó: mã `UC-HUB-…` chỉ định nghĩa ở SRS-HUB, `UC-EDT-…` chỉ ở SRS-EDT.

| Phần tử | Mẫu mã | Ví dụ | Định nghĩa tại | Được tham chiếu tại |
|---|---|---|---|---|
| Bên liên quan | `SH-<MÃ>` | `SH-OWN` | [StRS-00 §2](../02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md) | BMA-00 §3, StRS-00 §3, SAD-00 §1.2 |
| Nhu cầu bên liên quan | `StR-<nn>` | `StR-01` | [StRS-00 §3](../02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md) | BPMN-22 / BPMN-31 §2, SyRS-00 §4, RTM-00 §2 |
| Ràng buộc bên liên quan | `StC-<nn>` | `StC-01` | [StRS-00 §4](../02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md) | SyRS-00 §5, SAD-00 §2 |
| Quy trình nghiệp vụ | `BP-<nn>` | `BP-22` | [BMA-00 §5](../01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md) (danh sách); chi tiết ở [BPMN-22](../01_Phan_tich_nghiep_vu/BPMN-22_Soan_duyet_phat_hanh_tai_lieu.md), [BPMN-31](../01_Phan_tich_nghiep_vu/BPMN-31_Xu_ly_ticket.md) hoặc BMA-00 §5.1 | StRS-00 §3, SRS-EDT / SRS-HUB §4, STP-00 §5, RTM-00 §2 |
| Bước trong quy trình | `<id>` trong BPMN (`s`, `t1`, `g1`, `e`…) | `BP-22/t3` | [BPMN-22 §4](../01_Phan_tich_nghiep_vu/BPMN-22_Soan_duyet_phat_hanh_tai_lieu.md), [BPMN-31 §4](../01_Phan_tich_nghiep_vu/BPMN-31_Xu_ly_ticket.md) | SRS-HUB §4 (dòng "Quy trình") |
| Chức năng hệ thống | `SYS-F<nn>` | `SYS-F01` | [SyRS-00 §4](../02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md) | SRS-EDT / SRS-HUB §1.2, §5 |
| Yêu cầu chất lượng chung | `SYS-N<nn>` | `SYS-N01` | [SyRS-00 §5](../02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md) | SRS-EDT / SRS-HUB §6, STP-00 §4 |
| Kết nối ra bên ngoài | `SYS-I<nn>` | `SYS-I01` | [SyRS-00 §6](../02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md) | ICD-00 §4, SAD-00 §3 |
| Tác nhân | `A-<MÃ>` | `A-MEM` | [SRS-EDT §2.2](../02_Yeu_cau/SRS-EDT_Bo_soan_tren_trinh_duyet.md), [SRS-HUB §2.2](../02_Yeu_cau/SRS-HUB_Lam_viec_nhom.md) | SRS cùng hệ thống con §3, §4 |
| Use case | `UC-<HTC>-<nn>` | `UC-HUB-01` | [SRS-EDT §4](../02_Yeu_cau/SRS-EDT_Bo_soan_tren_trinh_duyet.md), [SRS-HUB §4](../02_Yeu_cau/SRS-HUB_Lam_viec_nhom.md) | BPMN-22 / BPMN-31 §4, SDD cùng hệ thống con §5, STP-00, RTM-00 |
| Yêu cầu chức năng | `FR-<HTC>-<MOD>-<nnn>` | `FR-HUB-DOC-001` | [SRS-EDT §5](../02_Yeu_cau/SRS-EDT_Bo_soan_tren_trinh_duyet.md), [SRS-HUB §5](../02_Yeu_cau/SRS-HUB_Lam_viec_nhom.md) | SDD §3.2, ERD-HUB §3, API-HUB §2, STP-00 §4, RTM-00 §3 |
| Yêu cầu phi chức năng | `NFR-<HTC>-<nnn>` | `NFR-HUB-001` | [SRS-EDT §6](../02_Yeu_cau/SRS-EDT_Bo_soan_tren_trinh_duyet.md), [SRS-HUB §6](../02_Yeu_cau/SRS-HUB_Lam_viec_nhom.md) | SDD §9, STP-00 §4 |
| Quy tắc nghiệp vụ | `BR-<HTC>-<nnn>` | `BR-HUB-001` | [SRS-EDT §7](../02_Yeu_cau/SRS-EDT_Bo_soan_tren_trinh_duyet.md), [SRS-HUB §7](../02_Yeu_cau/SRS-HUB_Lam_viec_nhom.md) | BPMN-22 / BPMN-31 §6, SDD §7, API-HUB §1.3 |
| Quyết định kiến trúc | `ADR-00-<nn>`, `ADR-HUB-<nnn>` | `ADR-HUB-001` | [ADR-00](../03_Kien_truc/ADR/ADR-00_So_dang_ky_quyet_dinh_nen_tang.md) (gồm quyết định của EDT), [ADR-HUB](../03_Kien_truc/ADR/ADR-HUB_So_dang_ky_quyet_dinh_kien_truc.md) | SAD-00 §11, SDD-EDT, SDD-HUB |
| Luồng tương tác | `SEQ-<nn>` (ghi kèm tài liệu: `SDD-HUB SEQ-01`) | `SEQ-01` | [SDD-EDT §5](../04_Thiet_ke_chi_tiet/SDD-EDT_Bo_soan_tren_trinh_duyet.md), [SDD-HUB §5](../04_Thiet_ke_chi_tiet/SDD-HUB_Lam_viec_nhom.md) | RTM-00 §2–§3, API-HUB §2 |
| Máy trạng thái | `STM-<nn>` | `STM-01` | [SDD-EDT §6](../04_Thiet_ke_chi_tiet/SDD-EDT_Bo_soan_tren_trinh_duyet.md), [SDD-HUB §6](../04_Thiet_ke_chi_tiet/SDD-HUB_Lam_viec_nhom.md) | ERD-HUB §3 (cột trạng thái), RTM-00 |
| Thuật toán | `ACT-<nn>` | `ACT-01` | [SDD-EDT §7](../04_Thiet_ke_chi_tiet/SDD-EDT_Bo_soan_tren_trinh_duyet.md), [SDD-HUB §7](../04_Thiet_ke_chi_tiet/SDD-HUB_Lam_viec_nhom.md) | RTM-00 §3 |
| Bảng dữ liệu (collection MongoDB) | tên collection trong mã | `document_versions` | [ERD-HUB §3](../05_Thiet_ke_du_lieu/ERD-HUB_CSDL_Lam_viec_nhom.md) | DBD-00 §3, SDD-HUB, API-HUB, RTM-00 |
| Endpoint | `METHOD /path` | `POST /versions/{id}/submit` | [API-HUB §2](../06_Giao_dien_tich_hop/API-HUB_Lam_viec_nhom.md) | SDD-HUB §5, §8, ICD-00, RTM-00 |
| Sự kiện | `ten.su_kien` | `document.version.published` | [API-HUB §3](../06_Giao_dien_tich_hop/API-HUB_Lam_viec_nhom.md) | ICD-00 §5 |
| Cách xác thực | `AUTH-<n>` | `AUTH-1` | [ICD-00 §3](../06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md) | API-HUB §1.2, SAD-00 §8 |
| Điểm tích hợp | `I-<nn>` | `I-01` | [ICD-00 §4](../06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md) | SyRS-00 §6, API-HUB §4, RTM-00 |
| Gọi nhưng không khớp | `GAP-<nn>` | `GAP-01` | [ICD-00 §6](../06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md) | ASM-00 §4, RTM-00 |
| Vấn đề về dữ liệu | `DG-<nn>` | `DG-01` | [DBD-00 §6](../05_Thiet_ke_du_lieu/DBD-00_Tong_quan_du_lieu.md) | ASM-00 §4, RTM-00 |
| Bảng dùng chung bị hiểu khác nhau | `C-<nn>` | `C-01` | [ERD-HUB §5](../05_Thiet_ke_du_lieu/ERD-HUB_CSDL_Lam_viec_nhom.md) | DBD-00 §6, ASM-00 §4 |
| Bộ kiểm thử | `TS-<nn>` | `TS-01` | [STP-00 §4](../07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md) | RTM-00 §2–§3, ASM-00 §3 |
| Rủi ro bảo mật | `SEC-<nn>` | `SEC-01` | [ASM-00 §3](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md) | SDD §10, STP-00 §4, RTM-00 |
| Rủi ro / nợ kỹ thuật của hệ thống con | `RISK-<HTC>-<nn>`, `TD-<HTC>-<nn>` | `TD-EDT-01` | [SDD-EDT §10](../04_Thiet_ke_chi_tiet/SDD-EDT_Bo_soan_tren_trinh_duyet.md), [SDD-HUB §10](../04_Thiet_ke_chi_tiet/SDD-HUB_Lam_viec_nhom.md) | ASM-00 §11 |
| Sự cố vận hành | `OP-<nn>` | `OP-01` | [OPS-00 §3](../08_Trien_khai_van_hanh/OPS-00_So_tay_van_hanh.md) | ASM-00 §9 |
| Trục trặc khi lập tài liệu | `S-<nn>` | `S-01` | [LOG §4](LOG_Nhat_ky_xay_dung_tai_lieu.md) | – |

Cột "Ví dụ" chỉ minh hoạ dạng mã. Mã thật được cấp ở nơi định nghĩa. EDT không có CSDL máy chủ: các khoá lưu trữ trình duyệt (`localStorage`, dạng `diagram-editor:…`) được mô tả ở [DBD-00 §3](../05_Thiet_ke_du_lieu/DBD-00_Tong_quan_du_lieu.md) và SDD-EDT, không phải mã truy vết.

### 3.5 Quy tắc đánh số

1. **Mã đã cấp thì không dùng lại.** Phần tử bị bỏ vẫn giữ mã, ghi thêm "(đã bỏ – <ngày theo dạng năm-tháng-ngày>)" và lý do, ví dụ `(đã bỏ – 2027-01-15)`. HUB nhận dạng đúng mẫu này (`backend/crates/traceability/src/parser.rs#retired_re`).
2. **Quy trình đánh số theo chục:** `BP-00` là cấp 0; mỗi nhóm nghiệp vụ dùng một dải: 10–19 Soạn tài liệu cá nhân, 20–29 Quản lý tài liệu nhóm, 30–39 Phản hồi, 40–49 Quản trị và vận hành. Nhóm và dải ghi ở [BMA-00 §5](../01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md).
3. **Use case** đánh số liên tục trong mỗi hệ thống con; **yêu cầu chức năng** đánh số liên tục trong mỗi module (`FR-HUB-DOC-001`, `FR-HUB-DOC-002`…).
4. Mã dùng trong sơ đồ (id bước BPMN, tên use case trên sơ đồ) phải trùng mã trong bảng của cùng tài liệu.
5. **Vị trí định nghĩa** (để HUB đọc đúng, quyết định #31 ở `backend/docs/DECISIONS.md`): mã được định nghĩa ở **ô đầu của một dòng bảng** trong tài liệu thuộc loại định nghĩa mã đó; riêng `UC`, `SEQ`, `STM`, `ACT` và `ADR-HUB-…` được định nghĩa bằng **từ đầu của một tiêu đề** (`### UC-HUB-01 …`). Nhắc tới mã ở nơi khác (kể cả ở ô khác của bảng) là tham chiếu. HUB không đọc khối code, khối hướng dẫn điền mẫu (TIP), sơ đồ nhúng, bảng thuộc tính, mục *Lịch sử thay đổi*, và không đọc CONV, GLOSSARY, DOC-REG.
6. **Phạm vi duy nhất:** `A`, `SEQ`, `STM`, `ACT`, `C` là duy nhất trong một hệ thống con (ghi kèm tài liệu: `SDD-HUB SEQ-01`); các mã còn lại duy nhất trong cả dự án (quyết định #33).
7. **Mã bên liên quan và tác nhân** viết in hoa, 2–8 ký tự sau gạch nối (`SH-OWN`, `SH-SOLO`); `StR`, `StC`, `BP`, `SYS-F/N/I`, `SEQ`, `STM`, `ACT`, `TS`, `SEC`, `OP` dùng hai chữ số.

## 4. Đầu và cuối mỗi tài liệu

Dòng đầu là tiêu đề H1, ngay sau là bảng thuộc tính:

```markdown
| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | CCS-SRS-HUB-001 |
| Phiên bản | 0.1 |
| Ngày | 2026-11-18 |
| Trạng thái | Dự thảo – viết từ hệ thống đang chạy |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.3 System/Software Requirements Definition |
| Hệ thống con | HUB – Làm việc nhóm |
| Nguồn đã khảo sát | `backend/crates/documents/`, `js/hub-docs.js` |
| Đơn vị ban hành | Nhóm phát triển ChillCat Studio |
| Tài liệu liên quan | ↑ tầng trên · ↓ tầng dưới · ⇄ RTM-00 |
```

Dòng **Tài liệu liên quan** dẫn tới tầng trên (↑ – nơi định nghĩa các mã mà tài liệu này nhắc tới), tầng dưới (↓ – nơi dùng các mã mà tài liệu này định nghĩa) và tài liệu ngang hàng (⇄).

Dòng **Đơn vị ban hành** ghi tổ chức phát hành hạng mục thông tin, như ISO/IEC/IEEE 15289 yêu cầu cho phần nhận dạng tài liệu. Dự án ghi `Nhóm phát triển ChillCat Studio`. Dòng **Nguồn đã khảo sát** liệt kê đường dẫn thật tính từ gốc repo.

Hai mục cuối luôn là **Vấn đề còn mở** (câu hỏi chưa có lời đáp) và **Lịch sử thay đổi**.

## 5. Hai cách lập tài liệu

Dự án đang dùng: **Viết lại từ hệ thống đang chạy**. Thư mục gốc để ghi đường dẫn là **gốc repo** (thư mục chứa `index.html`, `desc.txt`, `backend/`, `templates/`, `docs/`).

| | Viết lại từ hệ thống đang chạy | Thiết kế cho hệ thống sắp làm |
|---|---|---|
| Mỗi điều ghi trong tài liệu dựa vào | Vị trí trong mã nguồn (đường dẫn tính từ gốc repo) | Mã nhu cầu, quyết định (`StR-`, `ADR-`) hoặc biên bản đã chốt |
| Cột "Nguồn" ghi | `duong/dan/file#tenHam`, ví dụ `backend/crates/documents/src/lifecycle.rs#transition`, `js/hub.js#render` | `StR-01`, `ADR-HUB-001`, biên bản đã chốt (ghi ngày) |
| Điều chưa chắc | Tự rút ra thì thêm nhãn **(suy luận)**; chưa kiểm được thì đưa vào *Vấn đề còn mở* | Chưa chốt thì thêm nhãn **(đề xuất)** |
| Ý tưởng cải tiến | Gom về [ASM-00](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md) (rủi ro, nợ kỹ thuật) và [CMP-00](../09_Danh_gia_hien_trang/CMP-00_Danh_gia_tuan_thu_15289.md) (độ phù hợp với chuẩn), để tài liệu mô tả chỉ chứa điều đang có | Ghi thẳng vào tài liệu; rủi ro ghi ở ASM-00 |
| Dòng "Trạng thái" ở đầu tài liệu | Dự thảo – viết từ hệ thống đang chạy | Dự thảo – thiết kế mới |

Nguồn dùng riêng cho dự án này:

| Nguồn | Vai trò | Cách nhắc tới |
|---|---|---|
| Mã nguồn (`js/`, `sw.js`, `index.html`, `backend/`) | Căn cứ chính: điều gì có trong mã thì mới ghi là "đang có" | `đường/dẫn#tênHàm` |
| `desc.txt` | Đặc tả gốc của HUB. Phần không nhãn là đã chốt; phần **(đề xuất)** là gợi ý | `desc.txt` §n |
| `backend/docs/DECISIONS.md` | 46 quyết định máy chủ đã chọn cho các điểm đặc tả còn ngỏ, mỗi dòng ghi chỗ trong mã | "quyết định #n" |
| `README.md`, `backend/README.md`, `templates/README.md` | Mô tả tính năng, cách chạy, cấu hình, bộ mẫu | tên file + mục |
| Kết quả kiểm thử 2026-11-17/18 (`cargo test`, `backend/scripts/smoke.mjs`, `backend/scripts/e2e/`) | Bằng chứng hệ thống chạy đúng | dẫn tới [STP-00](../07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md) |

Luôn áp dụng:

1. **Không ghi bí mật.** Khoá, mật khẩu, token, chuỗi kết nối chỉ được nhắc bằng tên biến môi trường chứa chúng (`JWT_SECRET`, `MONGODB_URI`, `AI_API_KEY`…). Không đọc và không chép nội dung các file `.env`.
2. **Lời văn tiếng Việt, tên trong mã giữ nguyên.** Collection, trường, struct, hàm, endpoint, biến viết đúng như trong mã.
3. **Đặc quyền tối thiểu là nguyên tắc thiết kế.** Việc workspace owner chỉ có quyền xem và nhận xét tài liệu, chưa có quyền ticket cho tới khi tự cấp, và quản trị hệ thống không mặc nhiên xem tài liệu / ticket là chủ đích an ninh (`backend/docs/DECISIONS.md`, đoạn đầu). Ghi đúng như vậy, không mô tả là hạn chế hay việc cần sửa.

## 6. Liên kết giữa các tài liệu

1. **Liên kết tương đối** tới file `.md`, ghi mục bằng ký hiệu `§`: `[SRS-HUB §4](../02_Yeu_cau/SRS-HUB_Lam_viec_nhom.md)`. Không dùng anchor `#…` vì mỗi trình xem tạo anchor tiếng Việt một kiểu. Liên kết dùng đúng tên file trong [DOC-REG](DOC-REG_So_dang_ky_tai_lieu.md), kể cả khi tài liệu đích chưa lập.
2. **Nhắc bằng mã, không chép nội dung.** Tài liệu tầng dưới ghi `FR-HUB-DOC-001`, không viết lại mô tả của yêu cầu đó.
3. **Cột truy vết bắt buộc** ở các bảng sau, để mỗi tài liệu tự chỉ ngược lên tầng trên:

   | Tài liệu | Bảng | Cột truy vết |
   |---|---|---|
   | BPMN-22, BPMN-31 | §4 Các bước | Liên quan (UC, FR, BR) |
   | StRS-00 | §3 Nhu cầu | Quy trình (BP) |
   | SyRS-00 | §4 Việc lớn của hệ thống | StR, hệ thống con đảm nhận |
   | SRS-EDT, SRS-HUB | §4 Use case, §5 FR | Quy trình (BP / bước), SYS, UC |
   | SDD-EDT, SDD-HUB | §3.2 Trách nhiệm, dòng "Hiện thực" ở §5–§7 | FR, UC, BR |
   | ERD-HUB | §3 mỗi bảng | Dùng bởi (FR, STM, endpoint) |
   | API-HUB | §2 Endpoint | FR, SEQ |
   | STP-00 | §4 Bộ kiểm thử | BP, UC, FR, SEC |
   | ASM-00 | §3 Rủi ro | Phát hiện ở, kiểm chứng bằng (TS) |

4. **Ma trận truy vết** [RTM-00](RTM-00_Ma_tran_truy_vet.md) gom các mối nối theo chiều xuôi. Bảng ở RTM-00 §5 là nơi duy nhất trả lời câu hỏi "sửa chỗ này thì phải xem lại chỗ nào".

## 7. Sơ đồ

### 7.1 Công cụ

Sơ đồ được vẽ bằng ChillCat Studio và nằm ngay trong file `.md`: dữ liệu sơ đồ (JSON) ở trong một chú thích HTML để mở lại chỉnh sửa, hình (SVG) ở ngay sau để mọi trình xem Markdown cho phép HTML đều hiển thị được. Để sửa: mở file trong tab **Tài liệu** của ChillCat Studio rồi nhấn đúp vào sơ đồ.

> [!NOTE]
> Trang xem file của GitHub lọc bỏ hình SVG nhúng, nên ở đó sơ đồ không hiện. Hãy xem bằng ChillCat Studio, VS Code hoặc một trình xem Markdown khác.

**Hiện trạng của bộ tài liệu này:** các bản 0.x vẽ sơ đồ **tạm bằng Mermaid** (khối ```` ```mermaid ````), như §7.2 cho phép khi phác. Trước khi phát hành 1.0, mở từng tài liệu ở tab Tài liệu, nhấn đúp từng sơ đồ Mermaid: app dịch sang sơ đồ nhúng (`DE.mermaidConv.convert` trong `js/plantuml.js`), rồi lưu file. Mỗi tài liệu còn sơ đồ Mermaid ghi việc này ở mục *Vấn đề còn mở*.

| Sơ đồ | Vẽ ở chế độ | Khi phác bằng Mermaid | Dùng trong |
|---|---|---|---|
| Quy trình BPMN 2.0 | BPMN | `flowchart` (xem §7.3) | BPMN-00, BPMN-22, BPMN-31 |
| Use case | UML | `flowchart` (tác nhân và use case là hình, biên hệ thống là `subgraph`) | SRS-EDT, SRS-HUB §3 |
| Ngữ cảnh, container (C4), thành phần | Flowchart – khung làm ranh giới, nhãn đường nối ghi giao thức | `flowchart` + `subgraph` | SAD-00 §3–§4, SDD-EDT, SDD-HUB §3 |
| Triển khai | Flowchart – khung cho từng vùng mạng, hình trụ cho CSDL | `flowchart` + `subgraph`, CSDL là `[( )]` | SAD-00 §6, DEP-00 |
| Class | UML | `classDiagram` | SDD-EDT, SDD-HUB §4 |
| Sequence | UML – lifeline, message đánh số, khung alt / loop | `sequenceDiagram` (`autonumber`, `alt`, `loop`) | SDD-EDT, SDD-HUB §5 |
| Máy trạng thái | UML | `stateDiagram-v2` | SDD-EDT, SDD-HUB §6 |
| Thuật toán, luồng xử lý | Flowchart | `flowchart` | SDD-EDT, SDD-HUB §7, STP-00 §8, DEP-00 §6 |
| ERD | UML (ERD) – bảng có PK / FK / UK, đầu chân chim | `erDiagram` | ERD-HUB §2 |

### 7.2 Quy tắc vẽ

- Một sơ đồ nên xem trọn trên một màn hình; nhiều hơn khoảng 40 hình thì tách theo miền.
- Tên sơ đồ mở đầu bằng mã phần tử nếu có (`BP-22 …`, `SEQ-01 …`, `STM-01 …`) để tìm được bằng mã. Với Mermaid, đặt tên ở phần đầu khối: `---` / `title: BP-22 Soạn – duyệt – phát hành` / `---` (bộ dịch của app đọc dòng `title:`).
- Nhãn hình viết tiếng Việt; tên lấy từ mã (collection, struct, endpoint) giữ nguyên.
- ERD: HUB dùng MongoDB, nên "bảng" là **collection**. Kiểu dữ liệu ghi ngắn theo BSON: `uuid` (chuỗi UUID v7, `backend/crates/kernel/src/id.rs`), `string`, `int`, `bool`, `date`, `array`, `object`; đánh dấu khoá bằng `PK` (`_id`), `FK` (trường trỏ tới `_id` collection khác, không có ràng buộc ở CSDL), `UK` (chỉ mục duy nhất); nhãn quan hệ là một động từ ngắn.
- Mermaid và PlantUML chỉ dùng để phác nhanh. Khi chỉnh sửa, ChillCat Studio đổi chúng thành sơ đồ nhúng – bản phát hành chỉ giữ sơ đồ nhúng.

### 7.3 Ký hiệu BPMN dùng trong bộ tài liệu

| Ký hiệu | Đọc là |
|---|---|
| Pool / lane | Một tổ chức / một vai trò hoặc hệ thống tham gia quy trình |
| Vòng tròn viền mảnh / viền đậm | Điểm bắt đầu / điểm kết thúc; có tia sét bên trong là kết thúc vì lỗi |
| Vòng tròn có đồng hồ / phong bì | Chờ tới một thời điểm (lịch chạy, hết hạn) / chờ một thông điệp |
| Bước có hình người | Một người thao tác trên phần mềm |
| Bước có bánh răng | Hệ thống tự làm |
| Bước có hình bảng | Kiểm tra một quy tắc `BR-…` |
| Bước có phong bì | Gửi thông báo, email hoặc sự kiện |
| Bước viền dày | Chạy một quy trình khác (`BP-nn`) |
| Hình thoi ✕ / ＋ / ◯ | Chọn đúng một nhánh / chạy mọi nhánh song song / chạy một hoặc nhiều nhánh |

Khi phác BPMN bằng Mermaid `flowchart` (tạm, trước khi đổi sang sơ đồ nhúng):

| BPMN | Viết trong Mermaid | Ví dụ |
|---|---|---|
| Lane | `subgraph` mang tên vai trò hoặc hệ thống | `subgraph L1["Group owner"]` |
| Sự kiện bắt đầu / kết thúc | Hình tròn `(( ))`, id `s` / `e`, `e1`… | `s((Bắt đầu))` |
| Bước | Hình chữ nhật `[ ]`, id `t1`, `t2`…; ghi loại bước ở đầu nhãn: 👤 người làm, ⚙ hệ thống, ✉ gửi thông báo | `t1["👤 Gửi duyệt"]` |
| Gọi quy trình khác | Hình `[[ ]]`, nhãn ghi `BP-nn` | `t5[["BP-23 Rà soát"]]` |
| Cổng rẽ nhánh | Hình thoi `{ }`, id `g1`, `g2`…; ghi ✕ / ＋ / ◯ ở đầu nhãn | `g1{"✕ Duyệt?"}` |

Id trong sơ đồ là id bước trong bảng §4 của tài liệu BPMN (`BP-22/t3`).

## 8. Mục bắt buộc của từng loại

| Loại | Phải có |
|---|---|
| BPMN-nn (BPMN-22, BPMN-31) | Tóm tắt quy trình, sơ đồ, bảng các bước (id trùng sơ đồ), rẽ nhánh, quy tắc áp dụng |
| SRS (ISO/IEC/IEEE 29148) | Phạm vi, tác nhân, sơ đồ use case, đặc tả use case, FR, NFR, BR |
| SDD (IEEE 1016) | Các viewpoint context, composition, logical, interaction, state dynamics, algorithm, interface; khía cạnh dùng chung; nợ kỹ thuật |
| ERD | Hệ quản trị CSDL và cách đổi cấu trúc; sơ đồ theo miền; từ điển dữ liệu; enum, chỉ mục, ràng buộc; liên kết sang CSDL khác |
| API | Địa chỉ, xác thực, mã lỗi; danh sách endpoint; sự kiện phát ra; các lời gọi sang hệ thống khác |
| LCP (loại mới) | Mô hình vòng đời; bảng cắt giảm 30 quy trình ISO/IEC/IEEE 12207 (áp dụng / áp dụng một phần / không áp dụng, lý do, tài liệu chứng minh); quản lý cấu hình; quản lý thông tin (danh mục hạng mục thông tin theo ISO/IEC/IEEE 15289, nơi lưu, vòng đời); đảm bảo chất lượng; đo lường |
| CMP (loại mới) | Phạm vi và đối tượng đánh giá; tiêu chí lấy từ ISO/IEC/IEEE 15289; kết quả theo từng hạng mục thông tin và từng mục nội dung bắt buộc (đạt / một phần / thiếu, bằng chứng); phát hiện; hướng xử lý |

## 9. Phiên bản và khi nào coi là xong

Dự án dùng **đúng vòng đời tài liệu của HUB** (`backend/crates/kernel/src/model.rs#VersionStatus`, `backend/crates/documents/src/lifecycle.rs#transition`), để bộ tài liệu này đưa lên tab Dự án được mà không phải đổi trạng thái.

| Trạng thái | Nghĩa | Sang trạng thái kế tiếp bằng |
|---|---|---|
| **Dự thảo** | Đang soạn; mỗi bản có đúng một người được chỉ định sửa | **Gửi duyệt** (cần quyền `submit`) |
| **Chờ duyệt** | Khoá nội dung, chỉ nhận xét | **Duyệt** (group owner của tài liệu); hoặc về Dự thảo bằng **Rút lại** (người gửi) / **Trả lại** (có `approve`, bắt buộc ghi lý do) |
| **Đã duyệt** | Đã qua lượt duyệt của group owner | **Phát hành** (cần `publish`); hoặc về Dự thảo bằng **Mở lại để sửa** (ghi lý do) |
| **Đã phát hành** | Bản người đọc thấy, theo mức bảo mật | Muốn sửa thì **Tạo phiên bản mới** (bản dự thảo chép từ bản đang phát hành) |
| **Thay thế** | Bản phát hành cũ, đã có bản mới phát hành | – (giữ 10 năm kể từ lúc bị thay thế) |

- Ở dạng file trong repo, bản dự thảo ghi trạng thái **Dự thảo – viết từ hệ thống đang chạy** (§5).
- **DOC-REG** và **LOG** là **tài liệu sống**: cập nhật liên tục theo mọi tài liệu khác, ghi trạng thái **Đang cập nhật** thay cho vòng đời trên.
- **Đánh số** theo HUB (`backend/crates/documents/src/lifecycle.rs#bump_minor`, `#next_published`; quyết định #19): bản chưa từng phát hành đánh 0.1, mỗi lần Trả lại / Rút lại / Mở lại tăng phần lẻ (0.1 → 0.2); lần phát hành đầu lên **1.0**; bản dự thảo sau bản phát hành M.m mang số M.(m+1); chọn "thay đổi lớn" khi phát hành thì đánh lại thành (M+1).0.
- Dưới 1.0 là bản nháp; lên 1.0 khi group owner của phần đó đã duyệt và tài liệu được phát hành.
- Mỗi lần sửa: thêm một dòng vào *Lịch sử thay đổi* và cập nhật số phiên bản ở [DOC-REG](DOC-REG_So_dang_ky_tai_lieu.md). Khi tài liệu nằm trên HUB, máy chủ tự thêm dòng lịch sử mỗi lần chuyển trạng thái (`backend/crates/documents/src/template.rs#append_history`).
- Một thay đổi mã nguồn chỉ coi là xong khi các tài liệu bị ảnh hưởng (tra ở [RTM-00 §5](RTM-00_Ma_tran_truy_vet.md)) đã được cập nhật cùng lúc – đặc biệt ERD-HUB khi đổi cấu trúc dữ liệu, API-HUB khi đổi endpoint.

## 10. Vấn đề còn mở

- **CONV của bộ mẫu lệch với vòng đời của hệ thống.** Mẫu `templates/00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md` §9 còn dùng chuỗi "Dự thảo → Đang rà soát → Đã phê duyệt", trong khi HUB dùng Dự thảo → Chờ duyệt → Đã duyệt → Đã phát hành → Thay thế (`backend/crates/kernel/src/model.rs#VersionStatus`). Bản dự án (§9) theo HUB. Đánh giá và hướng xử lý cho bộ mẫu: [CMP-00](../09_Danh_gia_hien_trang/CMP-00_Danh_gia_tuan_thu_15289.md).
- **Trạng thái "Đang cập nhật"** của DOC-REG / LOG không có trong vòng đời của HUB. Chưa chốt cách quản lý hai tài liệu sống này khi đưa bộ tài liệu lên tab Dự án.
- **Hai loại `LCP`, `CMP` chưa có trong HUB** (`backend/crates/documents/src/catalog.rs`, `backend/crates/kernel/src/codes.rs#DOC_LABELS`): chưa tạo được hai tài liệu này trên tab Dự án; phát hiện ghi ở CMP-00.
- **Nhãn trạng thái ở bảng thuộc tính:** khi tài liệu lên HUB, máy chủ tự ghi dòng Trạng thái theo vòng đời (quyết định #21), nên nhãn "Dự thảo – viết từ hệ thống đang chạy" có thể bị thay bằng "Dự thảo" **(suy luận)** – chưa kiểm trên máy chủ chạy thật.
- **Đuôi mã tài liệu:** CONV, GLOSSARY, LOG mang `-001` trong khi quy tắc chung ghi tài liệu chung mang `-000`. Dự án theo bộ mẫu và HUB (quyết định #23); chưa rõ lý do gốc của bộ mẫu.
- **Người phụ trách** từng hệ thống con và từng tài liệu mới ghi ở mức "Nhóm phát triển ChillCat Studio", chưa chỉ định cá nhân.
- **Sơ đồ đang ở dạng Mermaid** trong các bản 0.x của bộ tài liệu – đổi sang sơ đồ nhúng bằng ChillCat Studio trước khi phát hành 1.0 (§7.1).

## 11. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | 2026-11-18 | Khởi tạo từ bộ mẫu, viết lại từ hệ thống đang chạy | Nhóm phát triển ChillCat Studio |
