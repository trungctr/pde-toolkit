# Thiết kế dữ liệu – {{Tên hệ thống con}}

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-ERD-HTC-001 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.5 Design Definition (dữ liệu) |
| Hệ thống con | HTC – {{Tên hệ thống con}} |
| Nguồn đã khảo sát | `{{thư mục migration, entity / model}}` |
| Tài liệu liên quan | ↑ [SRS-HTC §5](../02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md) · [SDD-HTC §4, §6](../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md) · [DBD-00](DBD-00_Tong_quan_du_lieu.md) · ↓ [API-HTC](../06_Giao_dien_tich_hop/API-HTC_Ten_he_thong_con.md) · [DEP-00 §7](../08_Trien_khai_van_hanh/DEP-00_Trien_khai_tong_the.md) · ⇄ [RTM-00](../00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md) |

> [!TIP]
> **Nhân bản** cho mỗi hệ thống con (hoặc mỗi CSDL dùng chung, khi đó đặt `HTC` = `CHUNG`). Mỗi bảng ở §3 có dòng **Dùng bởi** ghi FR, máy trạng thái và endpoint đọc / ghi bảng đó – đây là chiều truy vết ngược lên SRS / SDD.

---

## 1. Giới thiệu

### 1.1 Lưu ở đâu

| Hạng mục | Giá trị | Nguồn |
|---|---|---|
| Hệ quản trị CSDL | {{PostgreSQL / MySQL / …}} | `{{cấu hình}}` |
| CSDL / schema | `{{db_htc}}` | `{{…}}` |
| Thư viện truy cập | {{…}} | `{{…}}` |
| Đổi cấu trúc bằng | {{Công cụ, thư mục script}} | `{{…}}` |
| Ai được đổi cấu trúc | HTC | [DBD-00 §3](DBD-00_Tong_quan_du_lieu.md) |

### 1.2 Ai kết nối tới

| Dịch vụ | Ghi vào | Biến môi trường (chỉ tên) | Chỉ đọc từ |
|---|---|---|---|
| HTC | `{{db_htc}}` | `{{DB_HOST}}`, `{{DB_NAME}}` | {{…}} |

### 1.3 Số lượng bảng

| CSDL | Số bảng | Có lớp tương ứng trong mã | Chỉ có trong script tạo bảng | Ghi chú |
|---|---|---|---|---|
| `{{db_htc}}` | {{n}} | {{n}} | {{n}} | {{…}} |

## 2. ERD theo miền

### 2.1 Miền `MOD`

<!-- de-diagram:dg-5f302f {"version":1,"meta":{"name":"ERD – miền {{MOD}} ({{db_htc}})","mode":"uml"},"nodes":[{"id":"t1","type":"erd.table","x":40,"y":40,"w":250,"h":165,"text":"ten_bang\n--\nPK id : uuid\nFK danh_muc_id : uuid\nUK ma : varchar\ntrang_thai : varchar\ntenant_id : uuid\ncreated_at : timestamptz","style":{}},{"id":"t2","type":"erd.table","x":440,"y":40,"w":260,"h":128,"text":"ten_bang_chi_tiet\n--\nPK id : uuid\nFK ten_bang_id : uuid\nnoi_dung : text\ncreated_at : timestamptz","style":{}},{"id":"t3","type":"erd.table","x":40,"y":290,"w":250,"h":110,"text":"danh_muc\n--\nPK id : uuid\nUK ma : varchar\nten : varchar","style":{}}],"edges":[{"id":"r1","type":"erd.oneToMany","source":"t1","target":"t2","label":"có","style":{"startArrow":"erOnlyOne","endArrow":"erZeroMany"},"sourcePort":"right","targetPort":"left"},{"id":"r2","type":"erd.oneToMany","source":"t3","target":"t1","label":"phân loại","style":{"startArrow":"erOnlyOne","endArrow":"erZeroMany"},"sourcePort":"top","targetPort":"bottom"}]} -->
<div align="center"><svg role="img" aria-label="ERD – miền {{MOD}} ({{db_htc}})" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" width="708" height="408" viewBox="16 16 708 408"><title>ERD – miền {{MOD}} ({{db_htc}})</title><defs><filter id="deev24gn-shadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="1.5" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.18"/></filter></defs><rect x="16" y="16" width="708" height="408" fill="#ffffff"/><g class="node" transform="translate(40,40)"><rect x="0" y="0" width="250" height="165" fill="#ffffff" stroke="#0f766e" stroke-width="1.5"/><rect x="0" y="0" width="250" height="28.2" fill="#0f766e" fill-opacity="0.12" stroke="none"/><line x1="0" y1="28.2" x2="250" y2="28.2" stroke="#0f766e" stroke-width="1.2" stroke-linecap="round"/><text x="125" y="19" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve" font-weight="bold">ten_bang</text><text x="8" y="47.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve">PK id : uuid</text><text x="8" y="65.4" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve">FK danh_muc_id : uuid</text><text x="8" y="83.6" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve">UK ma : varchar</text><text x="8" y="101.8" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve">trang_thai : varchar</text><text x="8" y="120" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve">tenant_id : uuid</text><text x="8" y="138.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve">created_at : timestamptz</text></g><g class="node" transform="translate(440,40)"><rect x="0" y="0" width="260" height="128" fill="#ffffff" stroke="#0f766e" stroke-width="1.5"/><rect x="0" y="0" width="260" height="28.2" fill="#0f766e" fill-opacity="0.12" stroke="none"/><line x1="0" y1="28.2" x2="260" y2="28.2" stroke="#0f766e" stroke-width="1.2" stroke-linecap="round"/><text x="130" y="19" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve" font-weight="bold">ten_bang_chi_tiet</text><text x="8" y="47.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve">PK id : uuid</text><text x="8" y="65.4" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve">FK ten_bang_id : uuid</text><text x="8" y="83.6" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve">noi_dung : text</text><text x="8" y="101.8" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve">created_at : timestamptz</text></g><g class="node" transform="translate(40,290)"><rect x="0" y="0" width="250" height="110" fill="#ffffff" stroke="#0f766e" stroke-width="1.5"/><rect x="0" y="0" width="250" height="28.2" fill="#0f766e" fill-opacity="0.12" stroke="none"/><line x1="0" y1="28.2" x2="250" y2="28.2" stroke="#0f766e" stroke-width="1.2" stroke-linecap="round"/><text x="125" y="19" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve" font-weight="bold">danh_muc</text><text x="8" y="47.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve">PK id : uuid</text><text x="8" y="65.4" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve">UK ma : varchar</text><text x="8" y="83.6" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve">ten : varchar</text></g><g class="edge"><path d="M290,122.5 L359,122.5 Q365,122.5 365,116.5 L365,110 Q365,104 371,104 L440,104" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><line x1="297.98" y1="115.66" x2="297.98" y2="129.34" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><line x1="303.68" y1="115.66" x2="303.68" y2="129.34" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><line x1="426.32" y1="104" x2="440" y2="111.41" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><line x1="426.32" y1="104" x2="440" y2="96.59" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="420.85" cy="104" r="4.33" fill="#ffffff" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="353.71" y="103.75" width="22.57" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="365" y="117.45" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">có</text></g><g class="edge"><path d="M165,290 L165,205" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><line x1="158.16" y1="282.02" x2="171.84" y2="282.02" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><line x1="158.16" y1="276.32" x2="171.84" y2="276.32" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><line x1="165" y1="218.68" x2="172.41" y2="205" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><line x1="165" y1="218.68" x2="157.59" y2="205" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="165" cy="224.15" r="4.33" fill="#ffffff" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="135.51" y="238" width="58.98" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="165" y="251.7" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">phân loại</text></g></svg></div>
<!-- /de-diagram:dg-5f302f -->

## 3. Từ điển dữ liệu

> Ghi kiểu dữ liệu đúng như lệnh tạo bảng. Nếu lớp trong mã khai báo khác, thêm một dòng **Khác với mã:** ngay dưới bảng đó.

### `ten_bang`

{{Mô tả bảng.}} Entity: `{{duong/dan/ten.entity.ts}}`.

**Dùng bởi:** FR-HTC-MOD-001, FR-HTC-MOD-002 · STM-01 (cột `trang_thai`) · `POST /ten-tai-nguyen`, `PATCH /ten-tai-nguyen/:id/trang-thai`.

| Cột | Kiểu | Null | Khoá | Mặc định | Mô tả |
|---|---|---|---|---|---|
| id | uuid | N | PK | `gen_random_uuid()` | |
| danh_muc_id | uuid | N | FK → `danh_muc.id` | | |
| ma | varchar | N | UK | | {{Mã nghiệp vụ}} |
| trang_thai | varchar | N | | `'moi_tao'` | Giá trị theo STM-01: `moi_tao`, `dang_xu_ly`, `hoan_tat`, `huy` |
| tenant_id | uuid | N | | | Trỏ sang CSDL khác – [DBD-00 §5](DBD-00_Tong_quan_du_lieu.md) |
| created_at | timestamptz | N | | `now()` | |

Chỉ mục: `{{ix_ten_bang_tenant_id (tenant_id)}}`. Ràng buộc: `{{uq_ten_bang_ma (ma)}}`.

### `ten_bang_chi_tiet`

{{Mô tả bảng.}}

**Dùng bởi:** FR-HTC-MOD-001.

| Cột | Kiểu | Null | Khoá | Mặc định | Mô tả |
|---|---|---|---|---|---|
| id | uuid | N | PK | `gen_random_uuid()` | |
| ten_bang_id | uuid | N | FK → `ten_bang.id` | | Xoá theo cha: {{cascade / restrict}} |
| noi_dung | text | Y | | | |
| created_at | timestamptz | N | | `now()` | |

### `danh_muc`

{{Mô tả bảng.}}

**Dùng bởi:** FR-HTC-MOD-003.

| Cột | Kiểu | Null | Khoá | Mặc định | Mô tả |
|---|---|---|---|---|---|
| id | uuid | N | PK | `gen_random_uuid()` | |
| ma | varchar | N | UK | | |
| ten | varchar | N | | | |

## 4. Enum, chỉ mục và ràng buộc

| Đối tượng | Loại | Giá trị / định nghĩa | Ghi chú |
|---|---|---|---|
| `ten_bang.trang_thai` | {{enum CSDL / varchar}} | `moi_tao`, `dang_xu_ly`, `hoan_tat`, `huy` | Vòng đời: SDD-HTC STM-01 |

## 5. Liên kết sang CSDL khác

| Bảng | Cột | Trỏ tới | Ai đọc | Ai ghi | Hiểu khác nhau |
|---|---|---|---|---|---|
| `ten_bang` | `tenant_id` | `{{db_dung_chung}}.{{tenants}}.id` | HTC | HTC | – |

Nếu nhiều hệ thống con cùng ghi hoặc cùng đổi cấu trúc một bảng, ghi lại chỗ chúng hiểu khác nhau:

| Mã | Hiểu khác nhau ở đâu | Bảng | Ảnh hưởng | Liên quan |
|---|---|---|---|---|
| C-01 | {{Ví dụ: hai bên dùng hai kiểu dữ liệu khác nhau cho cùng một cột}} | `{{bang}}` | {{…}} | DG-01 |

## 6. Vấn đề còn mở

- {{…}}

## 7. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
