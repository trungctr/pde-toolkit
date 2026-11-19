# Quyết định thiết kế cho các điểm đặc tả còn để ngỏ

`desc.txt` ghi rõ phần đã chốt, phần **(đề xuất)** và vài điểm chưa chốt. Bảng dưới là cách máy chủ đang làm ở những chỗ đó,
theo nguyên tắc **đặc quyền tối thiểu, không mất dữ liệu âm thầm**. Mỗi dòng ghi nơi trong mã để đổi khi nhóm quyết định khác.

> **Đặc quyền tối thiểu là chủ đích an ninh, không phải hạn chế.** Vai trò cao nhất (workspace owner, quản trị hệ thống) không
> mặc nhiên có quyền làm việc trên dữ liệu: workspace owner chỉ xem + nhận xét tài liệu, **không có quyền xem / xử lý ticket**
> cho tới khi tự cấp ở trang *Quyền ticket*; quản trị hệ thống không xem tài liệu / ticket. Nếu mật khẩu hoặc token của người cấp
> cao bị lộ, kẻ tấn công chỉ có những quyền đang thực dùng, không leo thang được sang toàn bộ dự án; mỗi lần tự cấp quyền đều để
> lại dấu vết trong nhật ký. Không nới các mặc định này cho tiện.

## Quyền và phạm vi

| # | Điểm | Cách làm | Ở đâu |
| --- | --- | --- | --- |
| 1 | Quyền ở cấp workspace và cấp group cộng lại thế nào | **Hợp** (OR) quyền ở workspace với quyền ở group của tài liệu, rồi lấy bao đóng "kéo theo" (§4.2) | `kernel/contracts/access.rs` `doc_perms_in` |
| 2 | Workspace owner có quyền tài liệu gì | Chỉ **xem + nhận xét** mọi nơi (§4.3, §9.1); cấp workspace mặc định cũng chỉ vậy, nên workspace owner **không cấp được** quyền tạo / sửa ở cấp workspace (không cấp quá quyền mình có) – quyền đó do group owner cấp trong group | `workspaces/members.rs` `grantable` |
| 3 | Workspace mới chưa có group nào | Tự tạo group mặc định ("Chung", đổi tên được), người tạo làm group owner – vì mỗi tài liệu phải thuộc đúng một group | `workspaces/service.rs` `create` |
| 4 | "Phạm vi rộng hơn" khi loại / chỉnh quyền | Thứ hạng: workspace owner > người có quyền quản lý người dùng ở cấp workspace > group owner (trong group đó) > thành viên. Chỉ thao tác được trên người **hạng thấp hơn**; workspace owner thao tác được trên mọi người (trừ chính mình) | `workspaces/members.rs` `rank` |
| 5 | Điều chỉnh quyền của người đã có quyền do người khác cấp | Chỉ những quyền **bị thay đổi** phải nằm trong quyền của người làm (giữ nguyên quyền mình không có thì được) | `members.rs` `check_change` |
| 6 | Tự sửa quyền mình | Không cho | `update_membership` |
| 7 | Nhiều workspace owner | Một owner chính (`owner_id`); chuyển quyền thì owner cũ ở lại với xem + nhận xét. Owner không rời đi được (đáp ứng "luôn có ít nhất một owner") | `transfer`, `remove_membership` |
| 8 | Bỏ group owner (`remove_owner`) | Thực hiện bằng **chỉ định owner khác** (mỗi group luôn có đúng một owner); owner cũ ở lại với quyền thành viên mặc định | `assign_group_owner` |
| 9 | Loại khỏi workspace | = loại khỏi mọi group của workspace. Người đang là group owner phải được thay trước | `remove_membership` |
| 10 | Chuyển quyền phụ trách khi rời đi (§3) | Tài liệu họ phụ trách → **group owner của group chứa tài liệu** (nếu không phải chính họ), không thì workspace owner; bản dự thảo họ đang soạn → group owner | `documents/integration.rs` `on_member_removed` |
| 11 | Quản trị hệ thống | Quản lý tài khoản (khoá, vai trò, nhật ký hệ thống); **không** mặc nhiên xem tài liệu / ticket | `kernel/auth.rs` |
| 12 | Người dùng ngoài workspace tìm dự án để gửi ticket | `GET /workspaces/directory` cho mọi người đã đăng nhập: chỉ mã + tên dự án | `workspaces/service.rs` `directory` |

## Tài liệu

| # | Điểm | Cách làm | Ở đâu |
| --- | --- | --- | --- |
| 13 | Ai xem / nhận xét được bản **dự thảo** ("những người được phép xem / nhận xét") | Người được chỉ định sửa, người có quyền `view` ở phạm vi của tài liệu, group owner, workspace owner | `documents/policy.rs` `can_view` |
| 14 | Bản **đã phát hành – Riêng tư** | Người tạo, **người phụ trách hiện tại** (để quyền phụ trách chuyển được), workspace owner. Group owner **không** mặc nhiên xem | `can_view_released` |
| 15 | Mức **Workspace** | Thành viên workspace có quyền `view` ở ít nhất một phạm vi | như trên |
| 16 | `approve` làm được gì khi chỉ group owner duyệt | Xem bản chờ duyệt / đã duyệt, **trả lại**, **mở lại để sửa**; nút **Duyệt** chỉ có ở group owner | `policy.rs` `capabilities` |
| 17 | Ai gửi duyệt | Có `submit` **và** là người được chỉ định sửa (hoặc group owner) | như trên |
| 18 | Đổi người được chỉ định sửa (đề xuất) | Người đang sửa hoặc group owner; người nhận phải có quyền `edit` trong group | `lifecycle.rs` `change_editor` |
| 19 | Số dự thảo 0.1, 0.2… | Bản chưa từng phát hành: mỗi lần **trả lại / rút lại / mở lại** tăng phần lẻ (0.1 → 0.2). Đã phát hành M.m: bản dự thảo mới mang số **M.(m+1)**; chọn "thay đổi lớn" khi phát hành thì đánh lại thành **(M+1).0** | `lifecycle.rs` `bump_minor`, `next_published` |
| 20 | Mỗi tài liệu mấy bản đang soạn | **Một** (chỉ mục duy nhất từng phần trên `working`) | `documents/service.rs` |
| 21 | Bảng thuộc tính "đủ" trước gửi duyệt | Máy chủ tự ghi Phiên bản / Ngày / Trạng thái; kiểm tra Mã tài liệu đúng mã sinh, Tài liệu liên quan có ↑ ↓ ⇄, Quy trình ISO, Hệ thống con, Mã quy trình; dòng tuỳ chọn (Nguồn, Chuẩn tham chiếu…) nếu còn thì phải điền | `documents/template.rs` `check_header` |
| 22 | Lịch sử thay đổi | Mỗi lần chuyển trạng thái thêm một dòng **cuối** bảng *Lịch sử thay đổi* (thiếu bảng thì tạo); ngày theo giờ máy chủ (đặt `TZ`) | `template.rs` `append_history` |
| 23 | Mã tài liệu chung `-000` hay `-001` | Theo đúng mẫu: CONV, GLOSSARY, LOG dùng `-001`, còn lại `-000`; BPMN-NN là `PRJ-BPMN-0NN` | `documents/catalog.rs` |
| 24 | Vòng ↑ trong bảng quan hệ mặc định | Mẫu STP ↑ ASM, ASM ↑ OPS ↑ DEP-00 ↑ STP tạo vòng, khiến 4 tài liệu không bao giờ phát hành được. Seed **STP ⇄ ASM** (ngang hàng); thêm quan hệ ↑ bằng tay cũng bị chặn nếu tạo vòng | `catalog.rs`, `service.rs` `reaches_up` |
| 25 | SRS ↑ BPMN-NN mặc định | Không tự nối (mẫu không cho biết quy trình nào thuộc hệ thống con nào); người dùng thêm tay | `catalog.rs` |
| 26 | Xoá tài liệu | Chỉ khi **chưa từng phát hành** và không có quan hệ thêm tay trỏ tới; còn lại chỉ lưu trữ. Người tạo hoặc group owner | `service.rs` `delete` |
| 27 | Đặt mức Công khai | Chỉ sau khi đã phát hành; cần quyền `publish`, xác nhận, và workspace cho phép | `service.rs` `update` |
| 28 | Kiểm tra khi **gửi duyệt** vs **phát hành** | Gửi duyệt: bảng thuộc tính thiếu = **chặn**; tài liệu ↑ còn dự thảo, mã chưa có / đã bỏ = **cảnh báo**. Phát hành: tài liệu ↑ chưa phát hành, mã định nghĩa trùng / dùng lại mã đã bỏ = **chặn**; trỏ tới tài liệu bảo mật hẹp hơn, ô mẫu chưa điền = **cảnh báo**. Cảnh báo cần xác nhận | `lifecycle.rs` `checks` |
| 29 | Lưu phiên bản cũ 10 năm | Tác vụ hằng ngày xoá bản **Thay thế** quá hạn cùng nhận xét, lượt duyệt, chỉ mục truy vết của bản đó. Đề xuất ticket trỏ tới bản đã xoá vẫn giữ mã số bản | `integration.rs` `purge_expired_versions` |
| 30 | Mốc lưu nhật ký 2 năm (chưa chốt) | Tính **từ lúc ghi** từng dòng (`AUDIT_RETENTION_DAYS=730`) | `audit/lib.rs` |

## Truy vết

| # | Điểm | Cách làm |
| --- | --- | --- |
| 31 | Định nghĩa hay tham chiếu | Định nghĩa khi tài liệu thuộc loại định nghĩa loại mã đó, đoạn hệ thống con khớp, mã ở **ô đầu dòng bảng** (hoặc đầu **tiêu đề** với UC / SEQ / STM / ACT / ADR hệ thống con), lần đầu xuất hiện. Không đọc: khối code, `[!TIP]`, diagram nhúng, bảng thuộc tính, mục Lịch sử thay đổi, ô `{{…}}`; không đọc CONV, GLOSSARY, DOC-REG |
| 32 | Nơi định nghĩa `BP-nn` | BMA-00 §5 (danh mục quy trình duy nhất); tài liệu BPMN chỉ tham chiếu |
| 33 | `A`, `SEQ`, `STM`, `ACT`, `C` | Duy nhất **theo hệ thống con** (ghi kèm tài liệu: `SDD-ORD SEQ-01`), không theo workspace |
| 34 | Use case đơn giản không có tiêu đề riêng | Lần xuất hiện đầu trong SRS của đúng hệ thống con là định nghĩa |
| 35 | Mã bị bỏ | Dòng định nghĩa ghi `(đã bỏ – YYYY-MM-DD)`, hoặc mã biến mất khỏi bản phát hành mới ⇒ "đã bỏ"; mã đã cấp không dùng lại |
| 36 | Sổ mã cập nhật khi nào | Khi **phát hành** (bản nháp chỉ cảnh báo trùng với bản nháp khác) |
| 37 | "Đổi" một mã | Nội dung dòng / mục định nghĩa đổi (so SHA-256) ⇒ tài liệu tham chiếu mã đó được đánh dấu **Cần rà soát** |
| 38 | Bỏ đánh dấu Cần rà soát | Người có quyền sửa tài liệu bị đánh dấu |

## Ticket và AI

| # | Điểm | Cách làm |
| --- | --- | --- |
| 39 | Hai bảng quyền ticket (xem / xử lý) | Gộp một collection `ticket_grants` có trường `kind` |
| 40 | Xử lý cần quyền xem | Có: xử lý = có cả quyền xem và quyền xử lý |
| 41 | Ai thấy kết quả AI | Người xử lý ticket; ứng viên trùng / đề xuất tài liệu ngoài quyền xem của **người đang xem** bị ẩn (ghi số lượng ẩn) |
| 42 | Uỷ quyền AI tự chạy | Theo workspace; khi có ticket mới, AI chạy thay mặt **người uỷ quyền đầu tiên còn đủ quyền** với ticket đó |
| 43 | Trạng thái ticket (đề xuất) | Mới → (Đang kiểm tra trùng) → Đang xem xét → Chấp nhận → Đang xử lý → Đã xử lý; Tạm hoãn / Từ chối / Trùng có thể xem xét lại. "Trùng" chỉ đặt qua xác nhận trùng; "Đang kiểm tra trùng" do hệ thống đặt |
| 44 | Kiểm tra AI thất bại | Không coi là "không trùng": ghi trạng thái thất bại / thiếu quyền, trả ticket về trạng thái trước; lần chạy treo quá 15 phút bị đánh dấu thất bại |
| 45 | Đề xuất "Đã áp dụng" | Chỉ khi bản dự thảo được liên kết với đề xuất được **phát hành** |
| 46 | Không cấu hình AI | Kiểm tra trùng bằng so khớp từ khoá; đề xuất tài liệu chỉ trỏ tới mục chứa mã truy vết / từ khoá trùng ("rà soát mục …") |
