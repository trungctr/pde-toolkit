# Đặc tả giao diện API – {{Tên hệ thống con}}

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-API-HTC-001 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.4 Architecture Definition · 6.4.8 Integration |
| Chuẩn tham chiếu | OpenAPI 3 (tham chiếu) |
| Hệ thống con | HTC – {{Tên hệ thống con}} |
| Nguồn đã khảo sát | `{{controller / route / OpenAPI}}` |
| Tài liệu liên quan | ↑ [SRS-HTC §5](../02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md) · [SDD-HTC §5](../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md) · [ICD-00](ICD-00_Tong_quan_tich_hop.md) · [ERD-HTC](../05_Thiet_ke_du_lieu/ERD-HTC_CSDL_Ten_he_thong_con.md) · ↓ [STP-00 §4](../07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md) · ⇄ [RTM-00 §3](../00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md) |

> [!TIP]
> **Nhân bản** cho mỗi hệ thống con. Mỗi endpoint có cột **FR** (yêu cầu nó hiện thực) và **SEQ** (luồng thiết kế dùng nó). Endpoint không ứng với FR nào là dấu hiệu SRS còn thiếu hoặc endpoint thừa – ghi vào *Vấn đề còn mở*.

---

## 1. Giới thiệu

### 1.1 Địa chỉ và cổng

| Dịch vụ | Cổng | Đường dẫn gốc | Kênh sự kiện | OpenAPI | Sản phẩm |
|---|---|---|---|---|---|
| HTC – {{Tên}} | {{port}} | `/{{prefix}}` | {{`/ws` / topic / không có}} | `{{http://<host>:<port>/docs}}` | {{SP}} |

### 1.2 Xác thực

| Cơ chế | Áp dụng | Chi tiết | Nguồn |
|---|---|---|---|
| AUTH-1 ([ICD-00 §3](ICD-00_Tong_quan_tich_hop.md)) | {{Mọi endpoint trừ /health}} | {{Header / cookie, cách kiểm tra}} | `{{guard}}` |

Ngoài xác thực, mỗi endpoint còn kiểm tra quyền theo NFR-HTC-001 và các quy tắc ở [SRS-HTC §7](../02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md).

### 1.3 Định dạng lỗi

| HTTP | Mã lỗi | Khi nào | Quy tắc |
|---|---|---|---|
| 401 | `{{unauthorized}}` | Thiếu hoặc sai token | AUTH-1 |
| 403 | `{{forbidden}}` | Khác tổ chức / không đủ quyền | NFR-HTC-001 |
| 422 | `{{ma_loi}}` | Vi phạm quy tắc nghiệp vụ | BR-HTC-001 |

Định dạng thân lỗi: `{{ {"code": "...", "message": "..."} }}`.

### 1.4 Quy ước dữ liệu

- {{snake_case / camelCase; phân trang; định dạng ngày giờ; idempotency key}}

---

## 2. Endpoint

Cột **Ai được gọi** ghi điều kiện kiểm tra sau khi đã xác thực; cột **Nguồn** tính từ thư mục `{{repo/}}`.

### 2.1 `MOD` – `/ten-tai-nguyen`

| Method | Path | Làm gì | Ai được gọi | FR | SEQ | Nguồn |
|---|---|---|---|---|---|---|
| POST | `/ten-tai-nguyen` | {{Tạo mới; kiểm BR-HTC-001; ghi `ten_bang`; phát `ten_tai_nguyen.created`}} | {{A-USR cùng tổ chức}} | FR-HTC-MOD-001 | SEQ-01 | `{{controller#create}}` |
| GET | `/ten-tai-nguyen/:id` | {{Xem chi tiết}} | {{…}} | FR-HTC-MOD-001 | – | `{{…}}` |
| PATCH | `/ten-tai-nguyen/:id/trang-thai` | {{Đổi trạng thái theo STM-01; huỷ theo BR-HTC-002}} | {{…}} | FR-HTC-MOD-002 | – | `{{…}}` |

**Payload `POST /ten-tai-nguyen`:**

| Trường | Kiểu | Bắt buộc | Ràng buộc | Cột lưu |
|---|---|---|---|---|
| `ma` | string | Có | {{Duy nhất}} | `ten_bang.ma` |
| `danh_muc_id` | uuid | Có | {{Tồn tại}} | `ten_bang.danh_muc_id` |

### 2.2 Được gọi nhưng không có

| Đường dẫn được gọi | Bên gọi | Kết quả | Mã |
|---|---|---|---|
| `{{METHOD /path}}` | {{…}} | {{404}} | GAP-01 |

---

## 3. Sự kiện phát ra

| Sự kiện | Payload | Người nhận | Kích hoạt bởi | Nguồn |
|---|---|---|---|---|
| `ten_tai_nguyen.created` | `{{ {id, ma, tenant_id} }}` | {{Thành viên cùng tổ chức}} | `POST /ten-tai-nguyen` | `{{…}}` |

## 4. Gọi sang hệ thống khác

| Mã ICD | Gọi tới | Endpoint / kênh | Xác thực | Chờ tối đa | Nếu lỗi | Nguồn |
|---|---|---|---|---|---|---|
| I-01 | {{Hệ thống con khác}} | `{{METHOD /path}}` | AUTH-2 | {{5 s}} | {{…}} | `{{client}}` |
| I-02 | {{Hệ thống ngoài}} | `{{…}}` | {{…}} | {{…}} | {{…}} | `{{…}}` |

Tác vụ định kỳ gọi ra ngoài: {{cron, lịch, đích}}.

## 5. Vấn đề còn mở

- {{Endpoint chưa ứng với FR nào; payload chưa thống nhất}}

## 6. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
