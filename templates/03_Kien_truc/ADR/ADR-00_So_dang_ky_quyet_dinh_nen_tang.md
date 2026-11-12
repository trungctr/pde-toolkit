# Sổ đăng ký quyết định kiến trúc cấp nền tảng (ADR)

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-ADR-000 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.4 Architecture Definition |
| Tài liệu liên quan | ↑ [SAD-00 §2, §11](../SAD-00_Kien_truc_tong_the.md) · ↓ [ADR-HTC](ADR-HTC_So_dang_ky_quyet_dinh_kien_truc.md) · [SDD-HTC](../../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md) |

> [!TIP]
> Chỉ ghi quyết định ảnh hưởng **nhiều hệ thống con** (phân tầng dữ liệu, cơ chế xác thực chung, nền tảng triển khai). Quyết định nội bộ một HTC ghi ở ADR-HTC. Quyết định chỉ thấy trong mã mà chưa ai ghi lại thì để trạng thái **Chưa ghi thành văn bản**.

## 1. Mục tiêu

Giữ lại lý do của những lựa chọn lớn trong hệ thống PRJ, để người đến sau không phải đoán và biết khi nào nên xem lại.

Trạng thái: **Đang áp dụng** · **Áp dụng nhưng mã làm khác** · **Chưa ghi thành văn bản** (chỉ thấy trong mã) · **Đề xuất** · **Đã thay** (ghi ADR mới) · **Bỏ**.

## 2. Danh sách quyết định

| ID | Quyết định | Trạng thái | Vì sao | Phương án đã cân nhắc | Hệ quả | Ảnh hưởng tới | Nguồn |
|---|---|---|---|---|---|---|---|
| ADR-00-01 | {{Ví dụ: mỗi hệ thống con có CSDL riêng}} | {{Đang áp dụng}} | {{…}} | {{…}} | {{…}} | HTC; [DBD-00](../../05_Thiet_ke_du_lieu/DBD-00_Tong_quan_du_lieu.md) | {{biên bản / `nguồn`}} |

## 3. Nên làm gì tiếp

| ID | Đề xuất | Liên quan |
|---|---|---|
| ADR-00-01 | {{Giữ / đổi sang …}} | {{DG-01}} |

## 4. Vấn đề còn mở

- {{…}}

## 5. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
