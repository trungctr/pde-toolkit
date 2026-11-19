# Bảng thuật ngữ và từ viết tắt

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | CCS-GLOSSARY-001 |
| Phiên bản | 0.1 |
| Ngày | 2026-11-18 |
| Trạng thái | Dự thảo – viết từ hệ thống đang chạy |
| Nguồn đã khảo sát | `desc.txt`, `README.md`, `backend/README.md`, `backend/docs/DECISIONS.md`, `templates/README.md`, `backend/crates/kernel/src/perms.rs`, `backend/crates/kernel/src/model.rs`, `backend/crates/kernel/src/events.rs`, `backend/crates/tickets/src/model.rs`, `backend/crates/identity/src/service.rs`, `backend/crates/platform/src/outbox.rs`, `backend/crates/platform/src/mongo.rs`, `js/hub-tickets.js`, `js/api.js`, `sw.js` |
| Đơn vị ban hành | Nhóm phát triển ChillCat Studio |
| Tài liệu liên quan | ⇄ [CONV](CONV_Quy_uoc_tai_lieu_va_ky_hieu.md) · [BMA-00](../01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md) · [SRS-EDT §1.3](../02_Yeu_cau/SRS-EDT_Bo_soan_tren_trinh_duyet.md) · [SRS-HUB §1.3](../02_Yeu_cau/SRS-HUB_Lam_viec_nhom.md) |

Thuật ngữ dùng ở nhiều tài liệu đặt ở đây. Thuật ngữ chỉ có nghĩa trong một hệ thống con đặt ở mục "Định nghĩa" (§1.3) của SRS-EDT hoặc SRS-HUB. Tên trong mã (giá trị enum, tên trường, tên hàm) viết trong dấu `code` và giữ nguyên.

## 1. Thuật ngữ nghiệp vụ

### 1.1 Sản phẩm và bộ tài liệu

| Thuật ngữ | Giải thích | Dùng ở |
|---|---|---|
| **ChillCat Studio (CCS)** | Bộ công cụ soạn tài liệu thiết kế phần mềm, gồm hai hệ thống con EDT và HUB. Mã dự án trong bộ tài liệu này là `CCS` | Mọi tài liệu |
| **Bộ soạn trên trình duyệt (EDT)** | Phần chạy hoàn toàn trên trình duyệt: các tab Tài liệu, Diagram, Thiết kế trang, Hướng dẫn, Cài đặt, khung Chat AI, giọng nói. Không cần máy chủ, chạy được offline | CONV §3.1, BMA-00, SRS-EDT, SDD-EDT |
| **Làm việc nhóm (HUB)** | Tab **Dự án** cùng máy chủ trong `backend/`: tài khoản, workspace, phân quyền, vòng đời tài liệu, truy vết mã, ticket, thông báo, nhật ký | CONV §3.1, BMA-00, SRS-HUB, SDD-HUB |
| **Tab Dự án** | Giao diện của HUB trong ứng dụng (`Alt+4`), nối tới máy chủ qua `/api/v1` | SRS-HUB |
| **Bộ mẫu tài liệu** | 24 mẫu Markdown trong `templates/`, sắp theo các quy trình ISO/IEC/IEEE 12207, nối với nhau bằng mã truy vết | BMA-00, StRS-00, SRS-EDT, SRS-HUB |
| **Loại tài liệu (loại mẫu)** | Một trong 24 loại của bộ mẫu (SRS, SDD…), mỗi loại có thư mục, mẫu, quy trình 12207 và **số bản** (`cardinality`): một bản cho cả workspace (`workspace`), một bản cho mỗi hệ thống con (`subsystem`), một bản cho mỗi quy trình (`process`) | CONV §3.3, SRS-HUB, ERD-HUB |
| **Hệ thống con** | Phần của sản phẩm có bộ SRS / SDD riêng; mã 2–5 chữ in hoa (`EDT`, `HUB`). Trong HUB, mỗi workspace khai báo danh sách hệ thống con của dự án (`subsystems`) | CONV §3.1, SyRS-00 |
| **Module** | Nhóm chức năng trong một hệ thống con; mã xuất hiện trong mã yêu cầu chức năng (`FR-HUB-DOC-001`) | CONV §3.1, SRS-EDT, SRS-HUB |
| **Bảng thuộc tính** | Bảng ngay sau tiêu đề H1 của mỗi tài liệu (mã, phiên bản, ngày, trạng thái…). HUB kiểm tra bảng này trước khi gửi duyệt | CONV §4, SRS-HUB |
| **Lịch sử thay đổi** | Mục cuối mỗi tài liệu; HUB tự thêm một dòng mỗi lần chuyển trạng thái | CONV §9, SRS-HUB |
| **Tài liệu liên quan / quan hệ ↑ ⇄ ↓** | ↑ tầng trên (nơi định nghĩa mã mà tài liệu dùng), ⇄ ngang hàng, ↓ tầng dưới (suy ra từ ↑ của tài liệu khác). HUB gắn sẵn quan hệ ↑ ⇄ mặc định khi tạo tài liệu | CONV §4, SRS-HUB |
| **Cắt giảm (tailoring)** | Quyết định không lập một tài liệu hoặc không áp dụng một quy trình của chuẩn, có ghi lý do | LCP-00, DOC-REG, BMA-00 §5 |
| **Viết lại từ hệ thống đang chạy** | Cách lập tài liệu: mỗi điều dựa vào vị trí trong mã nguồn; điều tự rút ra gắn nhãn **(suy luận)** | CONV §5, mọi tài liệu |

### 1.2 Phạm vi, vai trò và quyền

| Thuật ngữ | Giải thích | Dùng ở |
|---|---|---|
| **Workspace** | Không gian làm việc chung, ứng với **một dự án**; có mã dự án dùng trong mã tài liệu | BMA-00, StRS-00, SRS-HUB |
| **Group** | Phạm vi an ninh bên trong workspace. Độc lập với hệ thống con: một group có thể quản lý tài liệu của nhiều hệ thống con. Mỗi tài liệu thuộc đúng một group | BMA-00, SRS-HUB |
| **Group "Chung"** | Group mặc định HUB tự tạo cùng workspace mới, người tạo làm group owner; đổi tên được (quyết định #3) | SRS-HUB |
| **Phạm vi** | Nơi một quyền có hiệu lực: `workspace` hoặc `group` (`ScopeType`) | SRS-HUB, ERD-HUB |
| **Workspace owner** | Người tạo workspace hoặc được chuyển quyền owner. Chỉ định group owner, có mọi quyền người dùng trong workspace, nhưng về tài liệu chỉ có **xem + nhận xét** ở mọi nơi và **không có quyền ticket** cho tới khi tự cấp – theo nguyên tắc đặc quyền tối thiểu | StRS-00 (SH-OWN), SRS-HUB |
| **Group owner** | Người được workspace owner chỉ định quản lý một group; có mọi quyền tài liệu trong group và là người **duyệt** tài liệu của group. Mỗi group có đúng một owner | StRS-00 (SH-GOW), BPMN-22, SRS-HUB |
| **Thành viên** | Người được owner mời vào một phạm vi; quyền do owner phạm vi đó điều chỉnh. Thành viên mới mặc định có `view`, `comment`, `create`, `edit`, `submit` | StRS-00 (SH-MEM), SRS-HUB |
| **Quản trị hệ thống** | Tài khoản có `system_role = admin`: khoá / mở tài khoản, đổi vai trò, xem nhật ký hệ thống; **không** mặc nhiên xem tài liệu hay ticket | StRS-00 (SH-ADM), SRS-HUB |
| **Người ngoài workspace** | Người dùng đã đăng nhập nhưng không là thành viên; gửi được ticket cho dự án và xem ticket do mình gửi | StRS-00 (SH-EXT), BPMN-31 |
| **Lời mời** | Đề nghị vào một phạm vi, gửi theo e-mail kèm quyền dự kiến; trạng thái `pending` / `accepted` / `expired` / `revoked`; hết hạn sau `INVITATION_TTL_DAYS` ngày | SRS-HUB, ERD-HUB |
| **Chuyển quyền owner** | Workspace owner trao vai trò owner chính cho người khác; owner cũ ở lại với quyền xem + nhận xét (quyết định #7) | SRS-HUB |
| **Quyền người dùng** | Quyền quản lý thành viên: `assign_owner` (chỉ định owner), `remove_owner` (bỏ owner), `invite` (mời), `kick` (loại), `manage_perms` (điều chỉnh quyền) | SRS-HUB |
| **Quyền tài liệu** | Bảy quyền: `view`, `comment`, `create`, `edit`, `submit`, `approve`, `publish` (`backend/crates/kernel/src/perms.rs#DocPerm`) | SRS-HUB, BPMN-22 |
| **`view` – Xem** | Đọc tài liệu theo trạng thái phiên bản và mức bảo mật | SRS-HUB |
| **`comment` – Nhận xét** | Ghi và trả lời nhận xét; kéo theo `view` | SRS-HUB |
| **`create` – Tạo** | Tạo tài liệu mới từ một loại mẫu; kéo theo `view` | SRS-HUB |
| **`edit` – Sửa** | Sửa nội dung bản **Dự thảo** khi là người được chỉ định sửa bản đó; kéo theo `view` | SRS-HUB |
| **`submit` – Gửi duyệt** | Chuyển bản dự thảo sang **Chờ duyệt**; kéo theo `edit` | SRS-HUB, BPMN-22 |
| **`approve` – Xem xét duyệt** | Xem bản chờ duyệt / đã duyệt, **trả lại**, **mở lại để sửa**. Nút **Duyệt** chỉ có ở group owner (quyết định #16); kéo theo `view`, `comment` | SRS-HUB, BPMN-22 |
| **`publish` – Phát hành** | Phát hành bản đã duyệt; đổi mức bảo mật của bản đã phát hành; kéo theo `view` | SRS-HUB, BPMN-22 |
| **Kéo theo** | Có một quyền thì tự có các quyền nó cần (`submit` ⇒ `edit` ⇒ `view`). HUB tính bằng bao đóng (`DocPerms::closure`) | SRS-HUB |
| **Quyền hiệu lực** | Quyền tài liệu thật của một người với một tài liệu: hợp (OR) quyền ở cấp workspace và cấp group của tài liệu, rồi lấy bao đóng kéo theo (quyết định #1) | SRS-HUB, SDD-HUB |
| **Đặc quyền tối thiểu** | Nguyên tắc an ninh đã chốt: không ai có quyền mặc định theo vai trò ngoài mức tối thiểu; muốn thêm quyền phải tự cấp và việc đó vào nhật ký. Lộ mật khẩu / token của người cấp cao thì thiệt hại chỉ giới hạn ở quyền đang thực dùng | StRS-00, SyRS-00, SAD-00 |
| **Không cấp quá quyền mình có** | Không ai cấp được quyền người dùng hoặc quyền tài liệu lớn hơn quyền mình đang có, và không thao tác được trên người có phạm vi rộng hơn mình | SRS-HUB |
| **Quyền ticket** | Hai quyền tách khỏi quyền tài liệu: **xem** (`view`) và **xử lý** (`process`) ticket; cấp cho cá nhân hoặc group, ở phạm vi workspace hoặc group. Xử lý cần có cả quyền xem (quyết định #40) | BPMN-31, SRS-HUB |
| **Uỷ quyền quyết định quyền ticket** | Workspace owner giao cho người khác việc cấp quyền xem / xử lý ticket; người được uỷ quyền không tự có các quyền đó | BPMN-31, SRS-HUB |
| **Uỷ quyền AI** | Người có cả quyền xem và xử lý ticket cho phép AI tự chạy thay mặt mình khi có ticket mới; AI dùng quyền **hiện hành** của người đó | BPMN-31, SRS-HUB |
| **Danh bạ dự án** | Danh sách mã + tên các workspace, mọi người đã đăng nhập xem được, để người ngoài chọn dự án gửi ticket (`GET /workspaces/directory`) | SRS-HUB |

### 1.3 Tài liệu, phiên bản và vòng đời

| Thuật ngữ | Giải thích | Dùng ở |
|---|---|---|
| **Tài liệu** | Một tài liệu thuộc một loại mẫu, thuộc workspace và đúng một group; có mã tài liệu, người phụ trách, mức bảo mật và các phiên bản | SRS-HUB, ERD-HUB |
| **Mã tài liệu** | Mã duy nhất trong workspace do hệ thống sinh: `CCS-<LOẠI>-<HTC>-<nnn>` cho tài liệu của hệ thống con, `CCS-<LOẠI>-000` cho tài liệu chung | CONV §3.3 |
| **Người phụ trách tài liệu** | Người chịu trách nhiệm tài liệu (`owner_id`). Khi người đó rời phạm vi, quyền phụ trách chuyển cho group owner của group chứa tài liệu, không thì cho workspace owner (quyết định #10) | SRS-HUB |
| **Người được chỉ định sửa** | Người duy nhất được sửa một bản dự thảo (`editor_id`). Người khác có quyền truy cập chỉ được nhận xét | BPMN-22, SRS-HUB |
| **Phiên bản** | Một lần phát hành hoặc một bản đang soạn của tài liệu (0.1, 1.0, 1.1, 2.0…); trạng thái gắn với từng phiên bản | CONV §9, BPMN-22 |
| **Bản đang soạn** | Phiên bản chưa phát hành (Dự thảo / Chờ duyệt / Đã duyệt). Mỗi tài liệu có tối đa một bản đang soạn (quyết định #20) | SRS-HUB |
| **Dự thảo** (`draft`) | Đang soạn; chỉ người được chỉ định sửa được sửa | CONV §9, BPMN-22 |
| **Chờ duyệt** (`pending`) | Đã gửi duyệt; nội dung khoá, chỉ nhận xét | CONV §9, BPMN-22 |
| **Đã duyệt** (`approved`) | Group owner đã duyệt; chờ phát hành | CONV §9, BPMN-22 |
| **Đã phát hành** (`published`) | Bản người đọc thấy, theo mức bảo mật; muốn sửa thì tạo phiên bản mới | CONV §9, BPMN-22 |
| **Thay thế** (`superseded`) | Bản phát hành cũ khi bản mới được phát hành; giữ 10 năm kể từ lúc bị thay thế | CONV §9, BP-24 ở BMA-00 |
| **Gửi duyệt / Rút lại / Trả lại / Duyệt / Mở lại để sửa / Phát hành** | Các hành động chuyển trạng thái (`submit`, `withdraw`, `reject`, `approve`, `reopen`, `publish`). Trả lại và mở lại bắt buộc ghi lý do | BPMN-22, SRS-HUB |
| **Lượt duyệt** | Bản ghi một hành động trong vòng gửi duyệt (`document_reviews`): ai làm, lúc nào, nhận xét gì | ERD-HUB |
| **Thay đổi lớn** | Lựa chọn khi phát hành để đánh số phiên bản lên (M+1).0 thay vì tăng phần lẻ | CONV §9, SRS-HUB |
| **Kiểm tra khi chuyển trạng thái** | Các kiểm tra lúc gửi duyệt và phát hành; kết quả là **chặn** (không cho làm) hoặc **cảnh báo** (phải xác nhận mới làm tiếp) (quyết định #28) | BPMN-22, SRS-HUB |
| **Lưu trữ** | Ẩn tài liệu khỏi danh sách đang dùng mà vẫn giữ dữ liệu; tài liệu đã từng phát hành hoặc đang được trỏ tới chỉ được lưu trữ, không được xoá | SRS-HUB |
| **Mức bảo mật** | Phạm vi xem **bản đã phát hành**: **Riêng tư** (người tạo, người phụ trách, workspace owner), **Group** (người cùng group), **Workspace** (thành viên có quyền xem), **Công khai** (mọi người có đường link, không cần đăng nhập) | StRS-00, SRS-HUB |
| **Nhận xét** | Ghi chú gắn với một phiên bản và một đoạn / mục; trả lời được, đánh dấu đã giải quyết được | BPMN-22, SRS-HUB |

### 1.4 Truy vết

| Thuật ngữ | Giải thích | Dùng ở |
|---|---|---|
| **Mã truy vết** | Mã của một phần tử (`StR-01`, `BP-22`, `UC-HUB-01`, `FR-HUB-DOC-001`, `TS-01`…), định nghĩa ở đúng một tài liệu, nơi khác nhắc bằng mã | CONV §3.4, RTM-00 |
| **Định nghĩa / tham chiếu** | Một lần xuất hiện của mã là **định nghĩa** khi nằm ở ô đầu dòng bảng (hoặc đầu tiêu đề với UC / SEQ / STM / ACT / ADR hệ thống con) trong tài liệu thuộc loại định nghĩa mã đó; mọi lần xuất hiện khác là **tham chiếu** | CONV §3.5, SRS-HUB |
| **Sổ mã** | Danh sách mã truy vết của workspace HUB cập nhật mỗi khi một phiên bản được phát hành (quyết định #36) | SRS-HUB, ERD-HUB |
| **Mã đã bỏ** | Mã không còn dùng; dòng định nghĩa ghi "(đã bỏ – ngày)" hoặc mã biến mất khỏi bản phát hành mới. Mã đã cấp không dùng lại | CONV §3.5 |
| **Cần rà soát** | Cờ HUB đặt cho tài liệu tầng dưới khi tài liệu tầng trên phát hành bản mới làm **đổi** (nội dung định nghĩa khác) hoặc **bỏ** một mã mà tài liệu tầng dưới đang dùng; người có quyền sửa tài liệu đó gỡ cờ | BMA-00 (BP-23), SRS-HUB |

### 1.5 Ticket và AI

| Thuật ngữ | Giải thích | Dùng ở |
|---|---|---|
| **Ticket** | Case theo dõi một **góp ý tính năng** (`feature_feedback`) hoặc **báo lỗi phần mềm** (`bug`) của dự án; thuộc workspace, có thể gắn group. Không phải nhận xét cho một tài liệu | BPMN-31, SRS-HUB |
| **Trạng thái ticket** | **Mới**, **Đang kiểm tra trùng** (hệ thống đặt), **Đang xem xét**, **Chấp nhận**, **Đang xử lý**, **Đã xử lý**, **Tạm hoãn**, **Từ chối**, **Trùng** (chỉ đặt qua xác nhận trùng). Tạm hoãn / Từ chối / Trùng / Đã xử lý có thể đưa lại về Đang xem xét | BPMN-31, SRS-HUB |
| **Ticket gốc** | Ticket mà một ticket trùng trỏ tới; việc xử lý tiếp tục ở ticket gốc. Phải cùng workspace, không tự trỏ và không tạo vòng | BPMN-31, SRS-HUB |
| **Kiểm tra trùng** | Một lần AI so ticket với các ticket khác trong workspace mà **người được AI thay mặt** được xem. Trạng thái lần chạy: `pending`, `completed`, `failed`, `insufficient_access`; kết quả `candidates_found` / `none_found`. Thất bại hay thiếu quyền **không** được coi là không trùng | BMA-00 (BP-32), SRS-HUB |
| **Ứng viên trùng** | Ticket AI cho là có thể trùng, kèm lý do; người xử lý **xác nhận** hoặc **bác bỏ** | BMA-00 (BP-32), SRS-HUB |
| **Phạm vi đã kiểm tra** | Tập ticket AI thực sự được so; ghi cùng kết quả. "Không tìm thấy trùng" chỉ đúng trong phạm vi này | SRS-HUB |
| **Đề xuất sửa tài liệu** | Gợi ý của AI cho một tài liệu: phiên bản làm căn cứ, mục liên quan, nội dung đổi, lý do. Trạng thái **Đề xuất**, **Chấp nhận**, **Đã đưa vào dự thảo** (`implemented`), **Đã áp dụng** (`applied` – chỉ khi bản dự thảo liên kết được phát hành), **Từ chối** | BMA-00 (BP-32), SRS-HUB |
| **Người được AI thay mặt** | Người uỷ quyền hoặc người bấm kích hoạt; AI không được xem dữ liệu vượt quá quyền hiện hành của người này | SRS-HUB, SAD-00 |
| **So khớp từ khoá** | Cách HUB kiểm tra trùng và đề xuất khi không cấu hình AI (`AI_PROVIDER=none`): độ giống theo từ (bỏ dấu, bỏ từ dừng), đề xuất trỏ tới mục chứa mã / từ khoá trùng; không gửi dữ liệu ra ngoài | SRS-HUB, ICD-00 |

### 1.6 Thông báo, nhật ký và lưu trữ

| Thuật ngữ | Giải thích | Dùng ở |
|---|---|---|
| **Thông báo** | Tin trong ứng dụng gửi tới một người (tài liệu chờ duyệt, bị trả lại, cần rà soát, ticket đổi trạng thái…); nội dung theo quyền người nhận tại lúc phát; tự xoá sau 180 ngày | SRS-HUB |
| **Nhật ký (audit log)** | Dòng ghi thay đổi quyền, thành viên, trạng thái, mức bảo mật, xử lý ticket: ai, lúc nào, làm gì, trên đối tượng nào. Xem theo workspace hoặc toàn hệ thống (quản trị) | SRS-HUB |
| **Thời hạn lưu** | Phiên bản Thay thế giữ **10 năm** kể từ lúc bị thay thế; nhật ký giữ **2 năm** tính từ lúc ghi từng dòng (mốc chưa chốt ở `desc.txt`, máy chủ chọn theo quyết định #30); sau hạn hệ thống tự xoá | StRS-00, BMA-00 (BP-24) |

### 1.7 Bộ soạn trên trình duyệt

| Thuật ngữ | Giải thích | Dùng ở |
|---|---|---|
| **Soạn trực quan / chế độ developer** | Soạn trực quan: gõ thẳng như trình soạn văn bản, không cần biết Markdown. Developer: hiện mã Markdown, chia đôi mã + trực quan | SRS-EDT |
| **Sơ đồ nhúng (diagram nhúng)** | Khối ba dòng trong file `.md`: chú thích HTML chứa JSON sơ đồ, ảnh SVG, chú thích đóng. Xem được ở trình xem Markdown cho phép HTML, sửa lại được trong app | CONV §7, SRS-EDT |
| **Thanh máy chủ** | Thanh xanh phía trên trình soạn ở tab Tài liệu khi tài liệu mở từ tab Dự án: `Ctrl+S` lưu lên máy chủ, bản đang duyệt / đã phát hành chỉ đọc | SRS-EDT, SRS-HUB |
| **Skill (AI)** | Hướng dẫn hệ thống gửi cho mô hình AI một lần mỗi cuộc trò chuyện: cách viết tài liệu, vẽ diagram, dựng trang | SRS-EDT |
| **Copy context** | Nút sinh skill prompt để dán vào AI bên ngoài (không cần API key) | SRS-EDT |
| **Effort / thinking** | Mức công sức suy luận và công tắc bật / tắt suy luận trước khi trả lời của mô hình AI; app đổi sang tham số riêng của từng nhà cung cấp | SRS-EDT |
| **Lệnh giọng nói / rảnh tay** | Câu ngắn khớp nguyên câu thì chạy ngay, không gọi AI. Rảnh tay: nghe → gửi → đọc kết quả → nghe tiếp | SRS-EDT |

## 2. Thuật ngữ kỹ thuật

| Thuật ngữ | Giải thích | Dùng ở |
|---|---|---|
| **Monolith chia module (modular monolith)** | Một tiến trình, một lần triển khai, nhưng mỗi module là một crate Rust độc lập, chỉ phụ thuộc `kernel` và `platform`, giao tiếp qua hợp đồng và sự kiện – tách thành dịch vụ riêng mà không phải viết lại | SAD-00, ADR-HUB, SDD-HUB |
| **Microservice** | Dịch vụ chạy và triển khai riêng. HUB **sẵn sàng** tách nhưng hiện chạy một tiến trình | SAD-00, SyRS-00 |
| **Crate** | Đơn vị biên dịch / thư viện của Rust. HUB gồm `kernel`, `platform`, `identity`, `workspaces`, `documents`, `traceability`, `tickets`, `notifications`, `audit` và ứng dụng `apps/server` | SAD-00, SDD-HUB |
| **Hợp đồng giữa module** | Trait trong `kernel::contracts` (`IdentityApi`, `AccessApi`, `DocumentsApi`, `TraceApi`); `apps/server` là nơi duy nhất nối trait với phần cài đặt | SDD-HUB, ICD-00 |
| **Sự kiện miền** | Bản ghi "việc đã xảy ra" (`DomainEvent`, ví dụ `document.version.published`), là kênh duy nhất để module này phản ứng với việc ở module khác | SDD-HUB, API-HUB |
| **Outbox** | Collection ghi sự kiện miền **trong cùng transaction** với thay đổi dữ liệu, rồi một tiến trình nền (**relay**) phát cho các handler. Phát **ít nhất một lần** nên handler phải idempotent. Khi tách dịch vụ, relay đẩy sự kiện ra message broker | SAD-00, SDD-HUB |
| **Handler idempotent** | Xử lý cùng một sự kiện nhiều lần cho cùng kết quả (dùng `event.id` làm khoá chống trùng) | SDD-HUB |
| **MongoDB Atlas** | Dịch vụ MongoDB trên đám mây; luôn là replica set. HUB hướng tới Atlas, dùng Stable API v1, ghi `w=majority` | DEP-00, DBD-00, SyRS-00 |
| **Replica set** | Nhóm máy MongoDB giữ cùng dữ liệu; cần cho transaction. Trên máy phát triển và Docker dùng replica set một node `rs0` | DEP-00, OPS-00 |
| **Transaction** | Nhóm thao tác ghi cùng thành công hoặc cùng huỷ; HUB dùng read concern `snapshot`, write concern `majority`, tự thử lại khi lỗi tạm thời (`backend/crates/platform/src/mongo.rs#with_txn`) | SDD-HUB, SyRS-00 |
| **Khoá lạc quan** | Lưu nội dung kèm số `revision` đã đọc; nếu bản trên máy chủ đã đổi thì từ chối (`409`) thay vì ghi đè | SDD-HUB, API-HUB |
| **Chỉ mục TTL** | Chỉ mục MongoDB tự xoá bản ghi quá hạn (nhật ký, thông báo, phiên) | ERD-HUB, DBD-00 |
| **Chỉ mục duy nhất từng phần** | Chỉ mục duy nhất chỉ áp cho bản ghi thoả điều kiện, dùng để chặn tạo trùng tài liệu theo số bản và chặn hai bản đang soạn | ERD-HUB |
| **UUID v7** | Mã định danh dạng chuỗi, sắp được theo thời gian; mọi `_id` của HUB dùng loại này | ERD-HUB |
| **JWT / access token** | Chuỗi ký số chứng minh người gọi đã đăng nhập; HUB cấp access token sống **15 phút**, kiểm tra tại chỗ ở mọi module (xác thực không trạng thái) | ICD-00, API-HUB, SyRS-00 |
| **Refresh token xoay vòng** | Chuỗi dùng để lấy access token mới; mỗi lần dùng được đổi chuỗi mới. Dùng lại chuỗi cũ ⇒ thu hồi cả phiên. Ở cùng origin nằm trong cookie HttpOnly `cc_refresh` | ICD-00, API-HUB, SyRS-00 |
| **Phiên đăng nhập** | Bản ghi phía máy chủ gắn với một refresh token; hết hạn sau `REFRESH_TOKEN_TTL_DAYS` ngày (mặc định 30) | SRS-HUB, ERD-HUB |
| **Argon2id** | Thuật toán băm mật khẩu HUB dùng | SDD-HUB |
| **Khoá đăng nhập tạm** | Sau 5 lần sai mật khẩu liên tiếp, tài khoản bị chặn đăng nhập 5 phút | SRS-HUB |
| **CORS** | Cơ chế trình duyệt cho phép trang ở origin này gọi API ở origin khác; HUB bật khi đặt `CORS_ALLOWED_ORIGINS` | ICD-00, DEP-00 |
| **Kiểm tra sống / sẵn sàng** | `GET /healthz` (tiến trình còn chạy) và `GET /readyz` (MongoDB trả lời ping) | DEP-00, OPS-00 |
| **Tác vụ định kỳ** | Vòng lặp nền của máy chủ: xoá bản Thay thế quá hạn (24 giờ một lần), dọn phiên đã thu hồi (6 giờ), đánh dấu lần AI chạy treo quá 15 phút là thất bại (5 phút) | SDD-HUB, OPS-00 |
| **Docker / docker compose / volume** | Đóng gói máy chủ + giao diện thành ảnh chạy được; compose dựng MongoDB + máy chủ trên một máy; dữ liệu MongoDB nằm trong volume `chillcat_mongo-data` | DEP-00, OPS-00 |
| **PWA** | Ứng dụng web cài được như ứng dụng, chạy offline | SRS-EDT, SDD-EDT |
| **Service worker** | Script nền của trình duyệt (`sw.js`) giữ bản sao file để chạy offline: **network-first** cho file cùng origin, **cache-first** cho thư viện CDN có số phiên bản; không bao giờ cache `/api/` | SDD-EDT, DBD-00 |
| **localStorage / Cache Storage** | Kho dữ liệu của trình duyệt. EDT lưu tài liệu, diagram, dự án trang, cài đặt, khoá API AI trong `localStorage` (khoá `diagram-editor:…`); service worker giữ file trong Cache Storage | DBD-00, SDD-EDT |
| **SRI** | Subresource Integrity – mã kiểm tra toàn vẹn của file tải từ CDN; file bị sửa thì trình duyệt từ chối | SDD-EDT, SyRS-00 |
| **iframe sandbox** | Khung trang bị giới hạn quyền; EDT dùng để xem thử / nhập trang HTML mà script của trang không đọc được dữ liệu của app | SDD-EDT |
| **Mermaid / PlantUML** | Ngôn ngữ mô tả sơ đồ bằng chữ. EDT vẽ Mermaid để xem và **dịch** Mermaid / PlantUML sang sơ đồ của app khi sửa (`js/plantuml.js`) | CONV §7, SRS-EDT |
| **Web Speech API / Moonshine** | Hai bộ nhận dạng giọng nói của EDT: bộ của trình duyệt (thường cần mạng) và bộ offline Moonshine chạy bằng transformers.js trong Web Worker | SRS-EDT, ICD-00 |
| **Claude Messages API** | API của Anthropic HUB gọi khi `AI_PROVIDER=anthropic`, yêu cầu trả JSON theo schema, thử lại khi 429 / 5xx / 529 | ICD-00, SDD-HUB |
| **Lint** | Kiểm tra nội dung một phiên bản (mã truy vết, ô mẫu chưa điền) không đổi trạng thái (`POST /versions/{id}/lint`) | SRS-HUB |
| **Smoke test / E2E** | Kiểm thử đầu-cuối qua HTTP (`backend/scripts/smoke.mjs`) và qua giao diện bằng Chrome headless (`backend/scripts/e2e/`) | STP-00 |

## 3. Từ viết tắt tài liệu

| Viết tắt | Đầy đủ |
|---|---|
| AD | Architecture Description – mô tả kiến trúc (ISO/IEC/IEEE 42010) |
| ADR | Architecture Decision Record |
| AIC / DGM / DSG / GDE / SET / VOI / PWA | Module của EDT: Chat AI / Diagram / Thiết kế trang / Hướng dẫn / Cài đặt / Giọng nói / Ứng dụng web offline |
| API | Application Programming Interface |
| ASM | Assessment – đánh giá rủi ro và nợ kỹ thuật |
| BMA | Business or Mission Analysis |
| BP | Business Process – quy trình nghiệp vụ |
| BPMN | Business Process Model and Notation |
| BR | Business Rule – quy tắc nghiệp vụ |
| CCS | ChillCat Studio – mã dự án |
| CDN | Content Delivery Network – mạng phân phối nội dung (jsDelivr) |
| CMP | Compliance Assessment – báo cáo đánh giá tuân thủ (loại tài liệu mới của dự án) |
| CONV / DOC-REG / LOG | Quy ước tài liệu / Sổ đăng ký tài liệu / Nhật ký xây dựng tài liệu |
| CSDL | Cơ sở dữ liệu |
| DBD / ERD | Database Design / Entity Relationship Diagram |
| DEP / OPS | Deployment / Operations |
| E2E | End-to-end – kiểm thử đầu-cuối |
| EDT | Bộ soạn trên trình duyệt – hệ thống con |
| FR / NFR | Functional / Non-Functional Requirement |
| HTC | Hệ thống con (trong dự án: `EDT`, `HUB`) |
| HUB | Làm việc nhóm – hệ thống con |
| ICD | Interface Control Document |
| IDN / WSP / DOC / TRC / TKT / NTF / AUD / PLT | Module của HUB: Tài khoản / Workspace và quyền / Tài liệu / Truy vết / Ticket / Thông báo / Nhật ký / Nền tảng (EDT cũng có module `DOC` – tab Tài liệu) |
| ISO/IEC/IEEE | Bộ chuẩn chung của ISO, IEC và IEEE. Dùng: 12207:2017 (quy trình vòng đời phần mềm), 15289:2019 (nội dung hạng mục thông tin), 29148:2018 (kỹ thuật yêu cầu), 42010:2022 (mô tả kiến trúc), 29119 (kiểm thử); kèm IEEE 1016 (mô tả thiết kế), ISO/IEC 19510 (BPMN), ISO 31000 (quản lý rủi ro) |
| JWT | JSON Web Token |
| LCP | Software Life Cycle Plan – kế hoạch vòng đời phần mềm (loại tài liệu mới của dự án) |
| MOD | Mã module trong mã yêu cầu chức năng |
| PWA | Progressive Web App |
| RTM | Requirements Traceability Matrix |
| SAD / SDD | Software Architecture / Design Description |
| SEC | Rủi ro bảo mật (mã `SEC-nn`) |
| SEQ / STM / ACT | Luồng tương tác / Máy trạng thái / Thuật toán (mã trong SDD) |
| SH / StR / StC | Bên liên quan / Nhu cầu / Ràng buộc của bên liên quan (mã trong StRS) |
| SRI | Subresource Integrity |
| SRS / StRS / SyRS | Software / Stakeholder / System Requirements Specification |
| STP / TS | Software Test Plan / Test Suite |
| SYS-F / SYS-N / SYS-I | Chức năng hệ thống / Yêu cầu chất lượng chung / Kết nối ra bên ngoài (mã trong SyRS) |
| TTL | Time To Live – thời gian sống của bản ghi |
| UC | Use Case |
| UUID | Universally Unique Identifier |

## 4. Vấn đề còn mở

- **"Group"** vừa là tên phạm vi an ninh vừa là tên một mức bảo mật (**Group**); hai nghĩa liên quan nhưng khác nhau. Giao diện và mã (`Security::Group`, `ScopeType::Group`) đều dùng chữ "Group" – chưa chốt có cần tên tiếng Việt riêng để tránh nhầm.
- **"Duyệt"** vừa chỉ hành động của group owner (Chờ duyệt → Đã duyệt), vừa nằm trong tên quyền `approve` ("Xem xét duyệt") – người có `approve` nhưng không là group owner không bấm được Duyệt (quyết định #16). Dễ hiểu nhầm khi đọc tên quyền.
- **"Owner"** có ba nghĩa: workspace owner, group owner và người phụ trách tài liệu (`owner_id`). Tài liệu nên ghi rõ loại owner.
- Mốc tính thời hạn lưu nhật ký 2 năm chưa được chốt ở `desc.txt` §5.3; thuật ngữ "thời hạn lưu" ở §1.6 ghi theo cách máy chủ đang làm.

## 5. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | 2026-11-18 | Khởi tạo từ bộ mẫu, viết lại từ hệ thống đang chạy | Nhóm phát triển ChillCat Studio |
