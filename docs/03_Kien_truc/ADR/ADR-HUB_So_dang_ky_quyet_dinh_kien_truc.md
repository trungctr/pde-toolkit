# Sổ đăng ký quyết định kiến trúc (ADR) – Làm việc nhóm

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | CCS-ADR-HUB-001 |
| Phiên bản | 0.1 |
| Ngày | 2026-11-18 |
| Trạng thái | Dự thảo – viết từ hệ thống đang chạy |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.4 Architecture Definition |
| Hệ thống con | HUB – Làm việc nhóm |
| Nguồn đã khảo sát | `backend/docs/DECISIONS.md`, `backend/README.md`, `backend/apps/server/src/app.rs`, `backend/crates/kernel/src/contracts/`, `backend/crates/kernel/src/perms.rs`, `backend/crates/kernel/src/events.rs`, `backend/crates/kernel/src/id.rs`, `backend/crates/platform/src/mongo.rs`, `backend/crates/platform/src/module.rs`, `backend/crates/platform/src/outbox.rs`, `backend/crates/platform/src/http.rs`, `backend/crates/workspaces/src/members.rs`, `backend/crates/workspaces/src/service.rs`, `backend/crates/documents/src/policy.rs`, `backend/crates/documents/src/lifecycle.rs`, `backend/crates/documents/src/service.rs`, `backend/crates/documents/src/template.rs`, `backend/crates/documents/src/catalog.rs`, `backend/crates/documents/src/integration.rs`, `backend/crates/traceability/src/parser.rs`, `backend/crates/traceability/src/service.rs`, `backend/crates/tickets/src/service.rs`, `backend/crates/tickets/src/runs.rs`, `backend/crates/tickets/src/ai.rs`, `backend/crates/notifications/src/lib.rs`, `backend/crates/audit/src/lib.rs`, `backend/crates/identity/src/service.rs` |
| Đơn vị ban hành | Nhóm phát triển ChillCat Studio |
| Tài liệu liên quan | ↑ [ADR-00](ADR-00_So_dang_ky_quyet_dinh_nen_tang.md) · [SAD-00 §11, §14](../SAD-00_Kien_truc_tong_the.md) · [SyRS-00 §5](../../02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md) · ↓ [SDD-HUB](../../04_Thiet_ke_chi_tiet/SDD-HUB_Lam_viec_nhom.md) · [ERD-HUB](../../05_Thiet_ke_du_lieu/ERD-HUB_CSDL_Lam_viec_nhom.md) · [API-HUB](../../06_Giao_dien_tich_hop/API-HUB_Lam_viec_nhom.md) · [DEP-00](../../08_Trien_khai_van_hanh/DEP-00_Trien_khai_tong_the.md) · ⇄ [SRS-HUB](../../02_Yeu_cau/SRS-HUB_Lam_viec_nhom.md) · [RTM-00](../../00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md) |

Trạng thái dùng cùng danh sách với [ADR-00 §1](ADR-00_So_dang_ky_quyet_dinh_nen_tang.md).

Sổ này ghi các quyết định **mang tính kiến trúc / thiết kế** của HUB: những lựa chọn định hình cấu trúc module, dữ liệu, phép tính quyền, vòng đời, truy vết, ticket và cách module phản ứng với nhau. Quyết định nền tảng (Rust, MongoDB, monolith chia module, outbox, xác thực, đặc quyền tối thiểu, Docker) ở [ADR-00 §2.3](ADR-00_So_dang_ky_quyet_dinh_nen_tang.md).

Phần lớn quyết định lấy từ `backend/docs/DECISIONS.md` – 46 cách làm đã chọn cho những điểm đặc tả `desc.txt` còn để ngỏ, mỗi dòng ghi nơi trong mã. Sổ này **không chép lại cả 46**: chỉ đưa vào những quyết định ảnh hưởng cấu trúc, và thêm vài quyết định chỉ thấy trong mã. Các quyết định còn lại (#7, #8, #12, #13, #14, #15, #18, #26, #27, #45) là chi tiết hành vi, giữ ở `backend/docs/DECISIONS.md` và được [SRS-HUB](../../02_Yeu_cau/SRS-HUB_Lam_viec_nhom.md) / [SDD-HUB](../../04_Thiet_ke_chi_tiet/SDD-HUB_Lam_viec_nhom.md) dẫn tới; #2 và #11 thuộc ADR-00-21. Muốn đổi một quyết định: sửa `backend/docs/DECISIONS.md` (ghi vị trí mã cần đổi) và dòng tương ứng ở đây ([LCP-00](../../00_Quan_ly_tai_lieu/LCP-00_Ke_hoach_vong_doi_phan_mem.md)).

## 1. Danh sách

| ID | Tiêu đề | Trạng thái | Liên quan | Nguồn | Mã có làm đúng không |
|---|---|---|---|---|---|
| ADR-HUB-001 | Ghép module ở một nơi; vòng gọi `documents` ↔ `workspaces` / `traceability` được **gắn muộn** bằng `Late<dyn DocumentsApi>` | Chưa ghi thành văn bản | ADR-00-16; SYS-N08 | `backend/apps/server/src/app.rs#build`; `backend/crates/kernel/src/contracts/late.rs` | Đúng: `app.rs#build`. Khác ở chú thích: bảng trong `backend/crates/kernel/src/contracts/mod.rs` ghi `DocumentsApi` chỉ do `tickets` gọi và `IdentityApi` do `workspaces`, `documents`, `tickets` gọi; thực tế `workspaces`, `traceability` cũng gọi `DocumentsApi`, `notifications`, `audit` cũng gọi `IdentityApi` |
| ADR-HUB-002 | Mỗi module lộ ra đúng một giao diện `Module`: `name` (cũng là khoá `MONGODB_DB_<MODULE>`), `init` (chỉ mục, idempotent), `router`, `event_handlers`, `jobs` | Đang áp dụng | ADR-00-16, ADR-00-18 | `backend/crates/platform/src/module.rs`; `backend/README.md` §Kiến trúc (quy tắc 5) | Đúng: bảy module cài `Module`; `app.rs#build` chỉ dùng trait này |
| ADR-HUB-003 | Bất biến trải nhiều document ghi trong `with_txn` (read concern `snapshot`, write concern `majority`, tự thử lại); ràng buộc duy nhất dùng **chỉ mục unique** (kể cả từng phần), không "kiểm tra rồi ghi" | Chưa ghi thành văn bản | ADR-00-15, ADR-00-17; SYS-N05 | `backend/crates/platform/src/mongo.rs` (chú thích đầu file, `with_txn`) | Đúng: ví dụ `versions_one_working` (`backend/crates/documents/src/service.rs`), `users_email` (`backend/crates/identity/src/service.rs`) |
| ADR-HUB-004 | Mọi `_id` là chuỗi UUID v7; thời điểm lưu bằng BSON Date; struct lưu CSDL tách khỏi DTO trả về API | Chưa ghi thành văn bản | ADR-00-15 | `backend/crates/kernel/src/id.rs`; `backend/crates/platform/src/mongo.rs` (chú thích đầu file) | Đúng (rà các module: `…Doc` và `…Dto` riêng) |
| ADR-HUB-005 | Không được xem ⇒ `404` (không lộ là có); `403` chỉ khi thấy được đối tượng nhưng không được làm việc đó | Đang áp dụng | ADR-00-03; StR-30, SYS-N03 | `backend/crates/platform/src/http.rs` (chú thích đầu file); `backend/README.md` §Quy ước API | Đúng: `backend/crates/documents/src/policy.rs#can_view`; kiểm thử ma trận quyền trong `policy.rs` |
| ADR-HUB-006 | Quyền tài liệu hiệu lực = **hợp** quyền ở cấp workspace với quyền ở group của tài liệu, rồi lấy **bao đóng "kéo theo"** (comment / create / edit / approve / publish ⇒ view; submit ⇒ edit; approve ⇒ comment) | Đang áp dụng | ADR-00-21; StR-10, SYS-N01 | Quyết định #1; `backend/crates/kernel/src/contracts/access.rs#doc_perms_in`; `backend/crates/kernel/src/perms.rs#closure` | Đúng |
| ADR-HUB-007 | Thao tác trên người khác theo **thứ hạng phạm vi** (workspace owner > người quản lý người dùng cấp workspace > group owner trong group > thành viên); chỉ thao tác trên người hạng thấp hơn; khi chỉnh quyền chỉ **các quyền bị thay đổi** phải nằm trong quyền của người làm; không tự sửa quyền mình | Đang áp dụng | ADR-00-21; StR-10, SYS-N01 | Quyết định #4, #5, #6; `backend/crates/workspaces/src/members.rs#rank`, `#check_change`, `#update_membership` | Đúng; kiểm thử `backend/crates/workspaces/tests/permissions.rs` |
| ADR-HUB-008 | Mỗi tài liệu thuộc đúng một group; workspace mới tự có group mặc định "Chung", người tạo là group owner | Đang áp dụng | StR-09 | Quyết định #3; `backend/crates/workspaces/src/service.rs#create` | Đúng |
| ADR-HUB-009 | Chỉ **group owner** của tài liệu bấm Duyệt; quyền `approve` cho phép xem bản chờ duyệt, Trả lại, Mở lại để sửa; Gửi duyệt cần `submit` **và** là người được chỉ định sửa (hoặc group owner) | Đang áp dụng | StR-11 | Quyết định #16, #17; `backend/crates/documents/src/policy.rs#capabilities` | Đúng |
| ADR-HUB-010 | Mỗi tài liệu có **tối đa một bản đang soạn** (chỉ mục duy nhất từng phần `versions_one_working` trên `working`) | Đang áp dụng | ADR-HUB-003; StR-11 | Quyết định #20; `backend/crates/documents/src/service.rs` | Đúng |
| ADR-HUB-011 | Lưu nội dung có **khoá lạc quan**: kèm `revision` đã đọc, lệch ⇒ `409 document.stale_revision`; chuyển trạng thái lọc theo `status` + `revision` ⇒ `document.concurrent_change` | Đang áp dụng | SYS-N05; StR-18 | `backend/crates/documents/src/service.rs#save_content`; `backend/crates/documents/src/lifecycle.rs#transition`; `backend/README.md` §Kiểm thử | Đúng; kiểm thử `backend/crates/documents/tests/lifecycle.rs` |
| ADR-HUB-012 | Máy chủ **tự ghi** dòng Phiên bản / Ngày / Trạng thái của bảng thuộc tính và **thêm dòng** *Lịch sử thay đổi* mỗi lần chuyển trạng thái; đánh số 0.1 → 0.2 khi trả lại / rút lại / mở lại, 1.0 khi phát hành lần đầu, M.(m+1) sau đó, (M+1).0 khi chọn "thay đổi lớn" | Đang áp dụng | StR-12 | Quyết định #19, #21, #22; `backend/crates/documents/src/template.rs#check_header`, `#append_history`; `backend/crates/documents/src/lifecycle.rs#bump_minor`, `#next_published` | Đúng; dòng lịch sử nằm trong nội dung nên người soạn sửa được dòng cũ – đánh giá ở CMP-00 (D4) |
| ADR-HUB-013 | Kiểm tra khi chuyển trạng thái chia hai mức: **chặn** và **cảnh báo cần xác nhận**. Gửi duyệt: bảng thuộc tính thiếu = chặn; tài liệu ↑ còn dự thảo, mã chưa có / đã bỏ = cảnh báo. Phát hành: tài liệu ↑ chưa phát hành, định nghĩa trùng, dùng lại mã đã bỏ = chặn; trỏ tới tài liệu bảo mật hẹp hơn, ô mẫu chưa điền = cảnh báo | Đang áp dụng | ADR-HUB-016, ADR-HUB-017; StR-16 | Quyết định #28; `backend/crates/documents/src/lifecycle.rs#checks` | Đúng; kiểm thử `lifecycle.rs` (cảnh báo phải xác nhận, chặn phát hành khi ↑ chưa phát hành) |
| ADR-HUB-014 | **Chặn vòng quan hệ ↑**: thêm quan hệ ↑ tạo vòng thì bị từ chối; bảng quan hệ mặc định nối STP ⇄ ASM (ngang hàng) thay cho chuỗi ↑ tạo vòng của bộ mẫu | Đang áp dụng | ADR-HUB-013; StR-16 | Quyết định #24; `backend/crates/documents/src/catalog.rs`; `backend/crates/documents/src/service.rs#reaches_up` | Đúng |
| ADR-HUB-015 | Danh mục 24 loại tài liệu và mẫu được **nhúng vào file chạy** (`include_str!`); mã tài liệu sinh theo đúng mẫu (`-000` / `-001`; tài liệu quy trình cấp 1 mang `CCS-BPMN-0nn`); không tự nối SRS ↑ BPMN | Đang áp dụng | ADR-00-02; StR-01 | Quyết định #23, #25; `backend/crates/documents/src/catalog.rs#document_code` | Đúng; hai loại `LCP`, `CMP` của dự án chưa có trong danh mục (CMP-00) |
| ADR-HUB-016 | **Định nghĩa hay tham chiếu**: một mã là định nghĩa khi nằm trong tài liệu thuộc loại định nghĩa mã đó, đoạn hệ thống con khớp, ở **ô đầu dòng bảng** (hoặc đầu **tiêu đề** với UC / SEQ / STM / ACT / ADR hệ thống con), lần xuất hiện đầu; không đọc khối code, khối hướng dẫn điền mẫu (TIP), diagram nhúng, bảng thuộc tính, *Lịch sử thay đổi*, ô mẫu chưa điền; không đọc CONV, GLOSSARY, DOC-REG | Đang áp dụng | ADR-00-10; StR-16, SYS-F18 | Quyết định #31, #32, #34; `backend/crates/traceability/src/parser.rs#parse`, `KINDS` | Đúng; kiểm thử trên 16 mẫu thật `backend/crates/traceability/tests/templates.rs` |
| ADR-HUB-017 | **Sổ mã cập nhật khi phát hành** (bản nháp chỉ cảnh báo); mã đã cấp không dùng lại, mã biến mất khỏi bản phát hành mới hoặc ghi "(đã bỏ – ngày)" là đã bỏ; nội dung dòng / mục định nghĩa đổi (so SHA-256) ⇒ tài liệu tham chiếu được đánh dấu **Cần rà soát**; người có quyền sửa tài liệu đó bỏ đánh dấu | Đang áp dụng | ADR-00-17; StR-16, StR-17 | Quyết định #35, #36, #37, #38; `backend/crates/traceability/src/service.rs#on_published` | Đúng; kiểm thử `lifecycle.rs` (cờ Cần rà soát) |
| ADR-HUB-018 | Mã `A`, `SEQ`, `STM`, `ACT`, `C` duy nhất **theo hệ thống con** (ghi kèm tài liệu, ví dụ `SDD-HUB SEQ-nn`); các loại mã khác duy nhất trong cả workspace | Đang áp dụng | ADR-HUB-016 | Quyết định #33; `backend/crates/traceability/src/parser.rs` (`KindInfo.scoped`) | Đúng |
| ADR-HUB-019 | Hai bảng quyền ticket (xem / xử lý) **gộp một collection `ticket_grants`** có trường `kind`; xử lý cần cả quyền xem; không ai có quyền ticket mặc định; chỉ workspace owner hoặc người được uỷ quyền quyết định mới cấp được | Đang áp dụng | ADR-00-21; StR-20 | Quyết định #39, #40; `backend/crates/tickets/src/service.rs#create_grant`, `TicketAccess::can_decide`; `backend/crates/tickets/src/model.rs#GrantKind` | Đúng; kiểm thử `backend/crates/tickets/tests/tickets.rs` |
| ADR-HUB-020 | **AI chạy thay mặt một người**: kích hoạt tay = người bấm; tự chạy khi có ticket mới = **người uỷ quyền đầu tiên còn đủ quyền** với ticket đó; quyền được kiểm lại lúc chạy; ứng viên trùng / đề xuất ngoài quyền xem của **người đang xem** bị ẩn, chỉ ghi số lượng ẩn | Đang áp dụng | ADR-00-04; StC-07, StR-21, SYS-N03 | Quyết định #41, #42; `backend/crates/tickets/src/runs.rs#run`, `#on_ticket_created` | Đúng |
| ADR-HUB-021 | Lần chạy AI là **tác vụ nền trong tiến trình** (`tokio::spawn`), ghi một bản `ticket_ai_checks`; **trạng thái ticket được cập nhật trước** khi đóng lần chạy (ai thấy lần chạy đã xong cũng thấy trạng thái mới); thất bại / thiếu quyền **không** coi là "không trùng" và trả ticket về trạng thái trước; lần chạy treo quá 15 phút bị đánh dấu thất bại | Đang áp dụng (phần chạy trong tiến trình chưa ghi thành văn bản) | ADR-00-22; StR-21 | Quyết định #43, #44; `backend/crates/tickets/src/runs.rs#new_check`, `#spawn`, `#finish`, `#fail_stuck_checks` | Đúng |
| ADR-HUB-022 | Bộ máy AI thay được: không cấu hình AI (`AI_PROVIDER=none`) thì kiểm tra trùng bằng so khớp từ khoá, đề xuất tài liệu trỏ tới mục chứa mã truy vết / từ khoá trùng | Đang áp dụng | ADR-00-04, ADR-00-22 | Quyết định #46; `backend/crates/tickets/src/ai.rs` (mô-đun `keyword`) | Đúng |
| ADR-HUB-023 | **Xoá theo hạn** bằng hai cơ chế: tác vụ hằng ngày xoá bản Thay thế quá `VERSION_RETENTION_YEARS` cùng nhận xét, lượt duyệt, chỉ mục truy vết; **chỉ mục TTL** cho nhật ký (`AUDIT_RETENTION_DAYS`, tính từ lúc ghi), thông báo (180 ngày), phiên (`expires_at`), sự kiện outbox đã phát (7 ngày) | Đang áp dụng | StC-08, StR-24, SYS-N10 | Quyết định #29, #30; `backend/crates/documents/src/integration.rs#purge_expired_versions`; `backend/crates/audit/src/lib.rs` (`audit_ttl`); `backend/crates/notifications/src/lib.rs` (`notifications_ttl`); `backend/crates/identity/src/service.rs` (`sessions_expire`); `backend/crates/platform/src/outbox.rs` (`outbox_dispatched_ttl`) | Đúng; việc xoá không để lại dòng nhật ký và không chạy trong transaction – đánh giá ở CMP-00 (C11) |
| ADR-HUB-024 | **Handler sự kiện idempotent**: thông báo có chỉ mục duy nhất `(event_id, user_id)`; nhật ký dùng `event.id` làm `_id` và bỏ qua lỗi trùng khoá; relay ghi danh sách handler đã xong | Đang áp dụng | ADR-00-17; SYS-N05, SYS-N11 | `backend/crates/notifications/src/lib.rs` (`notifications_event_user`); `backend/crates/audit/src/lib.rs#record`; `backend/crates/platform/src/outbox.rs` (`done`); `backend/README.md` §Kiến trúc (quy tắc 3) | Đúng |
| ADR-HUB-025 | **Chuyển quyền phụ trách khi rời đi qua sự kiện**: `workspaces` phát `membership.removed` kèm người kế nhiệm; `documents` nghe và chuyển tài liệu cho group owner của group chứa tài liệu (không thì workspace owner), bản dự thảo cho group owner | Đang áp dụng | ADR-00-17 | Quyết định #9, #10; `backend/crates/documents/src/integration.rs#on_member_removed`; `backend/crates/kernel/src/events.rs` (`MEMBERSHIP_REMOVED`) | Đúng |
| ADR-HUB-026 | **Người nhận thông báo do module nguồn chọn** theo quyền tại thời điểm phát sự kiện (`DomainEvent::notify`, bỏ chính người gây ra); module `notifications` chỉ phát, không tính quyền | Chưa ghi thành văn bản | ADR-00-17, ADR-HUB-005 | `backend/crates/kernel/src/events.rs#notify`; `backend/crates/notifications/src/lib.rs#on_event` | Đúng |

## 2. Quyết định quan trọng

### ADR-HUB-001 – Ghép module ở một nơi, gắn muộn vòng gọi

- **Bối cảnh:** module nghiệp vụ không được phụ thuộc nhau (ADR-00-16), nhưng `documents` cần `AccessApi` của `workspaces` và `TraceApi` của `traceability`, trong khi `workspaces` cần đếm tài liệu trong group / hệ thống con trước khi xoá và `traceability` cần biết phiên bản nào người xem được – tức là cần `DocumentsApi`.
- **Quyết định:** `apps/server/src/app.rs#build` là nơi duy nhất tạo module và nối trait. Vòng gọi được cắt bằng `Late<dyn DocumentsApi>`: tạo `workspaces`, `traceability` với một tham chiếu rỗng, tạo `documents`, rồi `Late::set`.
- **Phương án đã cân nhắc:** gộp `documents` với `traceability` thành một crate – loại vì truy vết là một bounded context riêng có CSDL riêng **(suy luận)**; dùng sự kiện thay cho lời gọi – không đủ, vì `workspaces` cần câu trả lời đồng bộ để chặn xoá group còn tài liệu.
- **Hệ quả:** gọi một hợp đồng chưa gắn trả lỗi nội bộ có thông điệp rõ (`Late::get`); khi tách `documents` ra dịch vụ riêng, `Late` được thay bằng client mạng ở cùng chỗ. Chú thích bảng hợp đồng ở `contracts/mod.rs` cần cập nhật ([SAD-00 §15](../SAD-00_Kien_truc_tong_the.md)).
- **Trong mã:** `backend/apps/server/src/app.rs#build`; `backend/crates/kernel/src/contracts/late.rs`; `backend/crates/workspaces/src/service.rs` (`count_in_group`, `count_with_subsystem`); `backend/crates/traceability/src/service.rs` (`visible_version_ids`, `doc_perms`).

### ADR-HUB-003 – Transaction cho bất biến nhiều document, chỉ mục cho ràng buộc duy nhất

- **Bối cảnh:** MongoDB không có khoá ngoại; nhiều thao tác (chuyển trạng thái + ghi lượt duyệt + ghi sự kiện) phải cùng thành công (SYS-N05); kiểm tra-rồi-ghi bị thua khi hai yêu cầu chạy đồng thời.
- **Quyết định:** mọi bất biến trải nhiều document ghi trong `with_txn` (tự thử lại theo nhãn lỗi tạm thời của driver; hàm truyền vào không được có tác dụng phụ ngoài CSDL); mọi ràng buộc duy nhất là chỉ mục unique, kể cả chỉ mục từng phần.
- **Phương án đã cân nhắc:** kiểm tra-rồi-ghi trong mã – loại vì có khe hở đồng thời; khoá ứng dụng – loại vì không đúng khi chạy nhiều tiến trình **(suy luận)**.
- **Hệ quả:** cần replica set (ADR-00-15); lỗi trùng khoá được đổi thành lỗi nghiệp vụ `409`; tác vụ xoá theo hạn hiện không dùng transaction (ADR-HUB-023).
- **Trong mã:** `backend/crates/platform/src/mongo.rs#with_txn`; `backend/crates/documents/src/service.rs` (`versions_one_working`).

### ADR-HUB-005 – `404` cho cả "không có" và "không được biết là có"

- **Bối cảnh:** không được lộ cả việc một tài liệu / ticket tồn tại cho người ngoài phạm vi (StR-30).
- **Quyết định:** người không được xem nhận `404`; `403` chỉ khi người đó thấy được đối tượng nhưng không được làm thao tác; danh sách, kết quả AI, thông báo chỉ chứa dữ liệu người xem được phép thấy.
- **Phương án đã cân nhắc:** `403` cho mọi trường hợp bị chặn – loại vì lộ sự tồn tại.
- **Hệ quả:** giao diện không phân biệt được "đã bị xoá" với "không có quyền"; kiểm thử phải xét cả hai nhánh.
- **Trong mã:** `backend/crates/platform/src/http.rs`; `backend/crates/documents/src/policy.rs#can_view`, `#can_view_released`.

### ADR-HUB-006 – Hợp quyền workspace ∪ group, rồi bao đóng kéo theo

- **Bối cảnh:** quyền được cấp theo từng `membership` (một người trong một phạm vi – workspace hoặc group); đặc tả cho bảng "kéo theo" nhưng không nói hai cấp cộng lại thế nào.
- **Quyết định:** quyền hiệu lực trên một tài liệu = hợp quyền ở cấp workspace với quyền ở group của tài liệu, rồi lấy bao đóng kéo theo. Hàm tính quyền là hàm thuần trong `kernel` (không I/O), dùng chung cho mọi module.
- **Phương án đã cân nhắc:** quyền group ghi đè quyền workspace – loại vì cấp workspace sẽ vô nghĩa với người có membership group **(suy luận)**; giao hai cấp – loại vì cấp ở workspace không mở rộng được quyền.
- **Hệ quả:** thêm quyền ở cấp workspace mở rộng quyền ở mọi group; vì workspace owner chỉ có xem + nhận xét (ADR-00-21) nên không cấp được quyền tạo / sửa ở cấp workspace – quyền đó do group owner cấp trong group (quyết định #2).
- **Trong mã:** `backend/crates/kernel/src/contracts/access.rs#doc_perms_in`; `backend/crates/kernel/src/perms.rs#closure`, `#union`.

### ADR-HUB-007 – Thứ hạng phạm vi, không cấp quá quyền mình có

- **Bối cảnh:** "không ai cấp quá quyền mình có, không ai thao tác được trên người có phạm vi rộng hơn" (StR-10) – cần một thứ tự cụ thể.
- **Quyết định:** thứ hạng workspace owner > người có quyền quản lý người dùng ở cấp workspace > group owner (trong group đó) > thành viên; chỉ thao tác trên người hạng thấp hơn (workspace owner thao tác được trên mọi người trừ chính mình); khi chỉnh quyền của người khác, chỉ những quyền **bị thay đổi** phải nằm trong quyền của người làm; không ai tự sửa quyền mình.
- **Phương án đã cân nhắc:** mọi quyền của người được chỉnh phải nằm trong quyền người làm – loại vì group owner không chỉnh được người đã có quyền do workspace owner cấp.
- **Hệ quả:** leo thang qua chuỗi uỷ quyền bị chặn; mọi thay đổi quyền phát sự kiện có cờ nhật ký.
- **Trong mã:** `backend/crates/workspaces/src/members.rs#rank`, `#check_change`, `#grantable`.

### ADR-HUB-011 – Khoá lạc quan khi lưu và khi chuyển trạng thái

- **Bối cảnh:** tài liệu được sửa trong tab Tài liệu và lưu lên máy chủ (StR-18); hai tab hoặc hai người có thể lưu chồng nhau; chuyển trạng thái có thể chạy đồng thời với lưu.
- **Quyết định:** mỗi phiên bản có `revision` tăng mỗi lần ghi; lưu gửi kèm `revision` đã đọc, lệch ⇒ `409 document.stale_revision`; chuyển trạng thái cập nhật có điều kiện `status` + `revision` ⇒ lệch thì `document.concurrent_change`.
- **Phương án đã cân nhắc:** khoá bi quan (giữ khoá khi mở sửa) – loại vì khoá treo khi người dùng đóng trình duyệt **(suy luận)**; ghi đè lần cuối thắng – loại vì mất dữ liệu âm thầm.
- **Hệ quả:** giao diện phải báo và cho tải lại khi gặp `409` (`js/hub-docs.js#HUB.saveServerDoc`).
- **Trong mã:** `backend/crates/documents/src/service.rs#save_content`; `backend/crates/documents/src/lifecycle.rs#transition`.

### ADR-HUB-013 – Kiểm tra khi gửi duyệt / phát hành: chặn và cảnh báo

- **Bối cảnh:** chặn mọi lỗi ngay khi gửi duyệt làm tài liệu kẹt khi tài liệu tầng trên chưa xong; không chặn gì khi phát hành thì bộ tài liệu mất nhất quán.
- **Quyết định:** hai mức – **chặn** (`422`) và **cảnh báo** phải xác nhận (`409` cho tới khi người dùng gửi lại với xác nhận); gửi duyệt chặt về hình thức, lỏng về truy vết; phát hành chặt về truy vết và thứ tự tầng.
- **Phương án đã cân nhắc:** một mức chặn duy nhất – loại vì làm kẹt quy trình; chỉ cảnh báo – loại vì cho phép định nghĩa trùng lên bản phát hành.
- **Hệ quả:** có endpoint xem trước kết quả kiểm tra (`GET /versions/{id}/check/{submit|publish}`) và lint không đổi trạng thái (`POST /versions/{id}/lint`).
- **Trong mã:** `backend/crates/documents/src/lifecycle.rs#checks`.

### ADR-HUB-017 – Sổ mã cập nhật khi phát hành, Cần rà soát qua sự kiện

- **Bối cảnh:** tài liệu tầng dưới tham chiếu mã của tầng trên; bản nháp thay đổi liên tục nên không thể dùng làm căn cứ.
- **Quyết định:** chỉ bản **phát hành** cập nhật sổ mã. `traceability` nghe `document.version.published`, so dòng định nghĩa (SHA-256) với bản trước; mã đổi / bỏ ⇒ phát `trace.review_flags.raised`; `documents` nghe sự kiện này và báo người phụ trách các tài liệu bị ảnh hưởng.
- **Phương án đã cân nhắc:** cập nhật sổ mã khi lưu bản nháp – loại vì cờ rà soát nhảy theo từng lần lưu.
- **Hệ quả:** chuỗi phản ứng nhiều bước đi qua outbox (ít nhất một lần) – xem view tương tác ở [SAD-00 §7](../SAD-00_Kien_truc_tong_the.md); sửa câu chữ trên dòng định nghĩa cũng sinh cờ Cần rà soát.
- **Trong mã:** `backend/crates/traceability/src/service.rs#on_published`; `backend/crates/documents/src/integration.rs#on_review_flags`.

### ADR-HUB-019 – Một collection cho quyền ticket

- **Bối cảnh:** đặc tả có hai bảng quyền ticket (xem, xử lý), cấp cho cá nhân hoặc group, ở cấp workspace hoặc group; quyền ticket tách hẳn khỏi quyền tài liệu (StR-20).
- **Quyết định:** một collection `ticket_grants` có `kind` (`view` / `process`), `subject_type` (người / group), `scope_type` (workspace / group); xử lý cần có cả quyền xem; người quyết định cấp: workspace owner hoặc người được uỷ quyền quyết định (`ticket_access_delegations`).
- **Phương án đã cân nhắc:** hai collection như đặc tả – loại vì mọi truy vấn quyền phải đọc hai nơi.
- **Hệ quả:** workspace owner không có quyền ticket cho tới khi tự cấp (ADR-00-21); mỗi lần cấp / thu hồi phát sự kiện có cờ nhật ký.
- **Trong mã:** `backend/crates/tickets/src/service.rs#create_grant`, `#access_overview`; `backend/crates/tickets/src/model.rs#GrantKind`.

### ADR-HUB-020 – AI chạy theo quyền của người được thay mặt

- **Bối cảnh:** được gửi dữ liệu ra AI ngoài, nhưng AI không được xem quá quyền của người uỷ quyền / kích hoạt (StC-07); quyền có thể bị thu hồi sau khi uỷ quyền.
- **Quyết định:** mỗi lần chạy ghi `acting_user_id`; kích hoạt tay là người bấm; tự chạy khi có ticket mới thì duyệt các uỷ quyền AI của workspace theo thứ tự tạo và chọn **người đầu tiên còn đủ quyền xem + xử lý** ticket đó; lúc chạy kiểm lại quyền, thiếu quyền ⇒ kết thúc với trạng thái thiếu quyền; dữ liệu gửi đi chỉ gồm tài liệu người đó xem được; khi hiển thị, ứng viên / đề xuất ngoài quyền của người đang xem bị ẩn và chỉ ghi số lượng.
- **Phương án đã cân nhắc:** chạy bằng một tài khoản hệ thống – loại vì vượt quyền; chạy theo người gửi ticket – loại vì người gửi có thể là người ngoài workspace.
- **Hệ quả:** hai người xem cùng một kết quả có thể thấy khác nhau; kết quả ghi phạm vi đã kiểm tra.
- **Trong mã:** `backend/crates/tickets/src/runs.rs#run`, `#on_ticket_created`, `#run_duplicates`, `#run_proposals`.

### ADR-HUB-021 – Lần chạy AI trong tiến trình, trạng thái ticket cập nhật trước

- **Bối cảnh:** một lần gọi AI có thể mất vài phút (`AI_TIMEOUT_SECS` 300 giây); không muốn giữ yêu cầu HTTP; "thất bại" không được hiểu nhầm là "không trùng".
- **Quyết định:** tạo bản `ticket_ai_checks` trạng thái `pending`, đặt ticket sang **Đang kiểm tra trùng**, chạy nền bằng `tokio::spawn`; khi xong cập nhật ticket **trước** (Đang xem xét nếu thành công, trạng thái cũ nếu thất bại / thiếu quyền), rồi mới đóng lần chạy có điều kiện `status: pending`; tác vụ 5 phút đánh dấu thất bại các lần chạy treo quá 15 phút.
- **Phương án đã cân nhắc:** hàng đợi bền (outbox / broker) cho lần chạy AI – không làm; lần chạy dở dang khi tiến trình dừng được tác vụ định kỳ dọn **(suy luận)**.
- **Hệ quả:** khởi động lại máy chủ giữa lần chạy ⇒ lần chạy thành thất bại sau tối đa khoảng 20 phút, người dùng chạy lại; ai thấy lần chạy đã xong thì cũng thấy trạng thái ticket mới.
- **Trong mã:** `backend/crates/tickets/src/runs.rs#new_check`, `#spawn`, `#finish`, `#fail_stuck_checks`; `backend/crates/tickets/src/lib.rs` (tác vụ `tickets.fail_stuck_checks`).

### ADR-HUB-023 – Xoá theo hạn bằng tác vụ định kỳ và chỉ mục TTL

- **Bối cảnh:** bản Thay thế giữ 10 năm kể từ lúc bị thay thế, nhật ký 2 năm, rồi tự xoá (StC-08); bản Thay thế kéo theo nhận xét, lượt duyệt, chỉ mục truy vết ở module khác.
- **Quyết định:** bản Thay thế xoá bằng tác vụ `documents.purge_expired_versions` (24 giờ, tối đa 500 bản mỗi lần), gọi `TraceApi::forget_version` cho chỉ mục truy vết; dữ liệu chỉ cần xoá theo một mốc thời gian (nhật ký, thông báo, phiên, outbox) dùng chỉ mục TTL của MongoDB.
- **Phương án đã cân nhắc:** TTL cho cả bản Thay thế – loại vì phải xoá kèm dữ liệu liên quan ở nhiều collection / module.
- **Hệ quả:** việc xoá không ghi nhật ký và không có tạm giữ (CMP-00 C11); thời hạn đổi được bằng biến môi trường, trừ thông báo (180 ngày, cố định trong mã).
- **Trong mã:** `backend/crates/documents/src/integration.rs#purge_expired_versions`; `backend/crates/documents/src/lib.rs`; chỉ mục `audit_ttl`, `notifications_ttl`, `sessions_expire`, `outbox_dispatched_ttl`.

### ADR-HUB-024 – Handler sự kiện idempotent

- **Bối cảnh:** relay phát ít nhất một lần (ADR-00-17), nên một sự kiện có thể tới handler hai lần.
- **Quyết định:** mỗi handler tự chống trùng bằng khoá dữ liệu: thông báo duy nhất theo `(event_id, user_id)`; nhật ký lấy `event.id` làm `_id`; relay ghi tên handler đã xong vào `done` để lần thử lại bỏ qua handler đó.
- **Phương án đã cân nhắc:** phát đúng một lần – loại vì cần giao dịch phân tán giữa outbox và handler.
- **Hệ quả:** thêm handler mới phải chọn khoá chống trùng; handler trả lỗi được thử lại tới 8 lần.
- **Trong mã:** `backend/crates/notifications/src/lib.rs` (`notifications_event_user`); `backend/crates/audit/src/lib.rs#record`; `backend/crates/platform/src/outbox.rs`.

## 3. Vấn đề còn mở

1. **Chú thích hợp đồng lệch với mã** (ADR-HUB-001): bảng trong `backend/crates/kernel/src/contracts/mod.rs` liệt kê thiếu bên gọi `DocumentsApi` (`workspaces`, `traceability`) và `IdentityApi` (`notifications`, `audit`). Ghi ở [SAD-00 §15](../SAD-00_Kien_truc_tong_the.md).
2. **ADR-HUB-001, ADR-HUB-003, ADR-HUB-004, ADR-HUB-026** chỉ thấy trong mã (kể cả chú thích); chưa có biên bản chốt.
3. **ADR-HUB-021**: lần chạy AI không bền qua lần khởi động lại; chưa kiểm thời gian thực tế từ lúc khởi động lại tới khi lần chạy được đánh dấu thất bại.
4. **ADR-HUB-023**: thời hạn thông báo 180 ngày cố định trong mã; mốc tính nhật ký 2 năm chưa được chốt ở đặc tả (quyết định #30).
5. **Phương án đã cân nhắc** ở §2 phần lớn là suy luận; `backend/docs/DECISIONS.md` ghi cách làm và nơi trong mã, không ghi phương án bị loại.
6. **Mã máy chủ chưa nằm trong lịch sử git**, nên các quyết định không dẫn được tới commit (CMP-00, CR-23).

## 4. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | 2026-11-18 | Khởi tạo từ bộ mẫu, viết lại từ hệ thống đang chạy | Nhóm phát triển ChillCat Studio |
