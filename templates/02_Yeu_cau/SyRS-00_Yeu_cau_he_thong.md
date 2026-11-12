# Đặc tả yêu cầu hệ thống (SyRS) và chỉ mục SRS

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-SyRS-000 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.3 System/Software Requirements Definition |
| Chuẩn tham chiếu | ISO/IEC/IEEE 29148 §9.4 |
| Tài liệu liên quan | ↑ [StRS-00](StRS-00_Yeu_cau_cac_ben_lien_quan.md) · ↓ [SRS-HTC](SRS-HTC_Ten_he_thong_con.md) · [SAD-00](../03_Kien_truc/SAD-00_Kien_truc_tong_the.md) · [ICD-00](../06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md) · ⇄ [RTM-00 §4](../00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md) |

> [!TIP]
> Nơi định nghĩa `SYS-F`, `SYS-N`, `SYS-I` và nơi **giao việc lớn** cho từng hệ thống con. Mỗi HTC thêm một cột ở §4 và một dòng ở §3. Yêu cầu chi tiết (UC / FR / NFR / BR) không ghi ở đây mà ở SRS của từng HTC.

---

## 1. Mục tiêu

Nhìn hệ thống PRJ như một khối: nó phải làm những việc lớn nào, hệ thống con nào nhận việc nào, chất lượng chung phải đạt mức nào và nó nối ra bên ngoài ở đâu. Chi tiết từng việc nằm trong SRS của hệ thống con nhận việc đó (§3).

## 2. Phạm vi hệ thống

{{Hệ thống gồm những gì; ngoài phạm vi là gì.}}

## 3. Danh sách SRS

| Hệ thống con | Tài liệu | Use case | FR | NFR | BR | Sản phẩm |
|---|---|---|---|---|---|---|
| HTC – {{Tên}} | [SRS-HTC](SRS-HTC_Ten_he_thong_con.md) | {{n}} (UC-HTC-01…{{nn}}) | {{n}} | {{n}} | {{n}} | {{SP}} |

## 4. Việc lớn của hệ thống và hệ thống con đảm nhận

● chịu trách nhiệm chính · ○ có tham gia.

| Mã | Việc lớn | HTC | {{HTC2}} | Nhu cầu | Hiện thực bởi |
|---|---|---|---|---|---|
| SYS-F01 | {{Chức năng}} | ● | ○ | StR-01 | FR-HTC-MOD-001, FR-HTC-MOD-002 |

## 5. Yêu cầu chất lượng chung

| Mã | Loại | Yêu cầu | Đo bằng | Nhu cầu / ràng buộc | Hiện thực bởi | Hiện nay |
|---|---|---|---|---|---|---|
| SYS-N01 | Bảo mật | {{Người dùng chỉ xem và sửa được dữ liệu của tổ chức mình}} | {{Không endpoint nào trả dữ liệu của tổ chức khác}} | StR-02 | NFR-HTC-001 | {{Đủ / Chưa – xem SEC-01}} |

## 6. Kết nối ra bên ngoài

| Mã | Kết nối với | Hệ thống con | Chi tiết |
|---|---|---|---|
| SYS-I01 | {{Cổng thanh toán / định danh ngoài / email}} | HTC | [ICD-00 §4](../06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md) I-02 |

## 7. Vấn đề còn mở

- {{Ví dụ: chưa có con số cụ thể cho thời gian phản hồi và số người dùng cùng lúc}}

## 8. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
