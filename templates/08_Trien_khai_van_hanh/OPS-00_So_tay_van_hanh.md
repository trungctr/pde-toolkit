# Sổ tay vận hành

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-OPS-000 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.12 Operation · 6.4.13 Maintenance |
| Tài liệu liên quan | ↑ [DEP-00](DEP-00_Trien_khai_tong_the.md) · [DEP-HTC](DEP-HTC_Ha_tang_Ten_he_thong_con.md) · ↓ [ASM-00 §9](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md) |

> [!TIP]
> Viết cho người đang trực: lệnh chạy được ngay, dấu hiệu → nguyên nhân → cách xử lý. Nơi định nghĩa `OP-nn`. Sự cố lặp lại nhiều lần thì đưa sang ASM-00 thành rủi ro hoặc nợ kỹ thuật.

---

## 1. Lệnh hằng ngày

| Muốn | Chạy |
|---|---|
| Xem các dịch vụ còn chạy không | `{{lệnh}}` |
| Khởi động lại một dịch vụ | `{{lệnh}}` |
| Xem log gần nhất | `{{lệnh}}` |

## 2. Việc chạy theo lịch

| Việc | Lúc nào | Ở đâu | Nếu không chạy thì |
|---|---|---|---|
| {{Tên việc}} | {{Lịch}} | HTC | {{…}} |

## 3. Khi có sự cố

| Mã | Dấu hiệu | Có thể do | Làm gì | Liên quan |
|---|---|---|---|---|
| OP-01 | {{…}} | {{…}} | {{…}} | {{TD-HTC-01}} |

## 4. Sao lưu và khôi phục

| Dữ liệu | Cách sao lưu | Bao lâu một lần | Lần thử khôi phục gần nhất | Còn thiếu |
|---|---|---|---|---|
| `{{db_htc}}` | {{…}} | {{…}} | {{Ngày}} | {{…}} |

## 5. Đổi bí mật định kỳ

1. **Biết mình đang có những gì:** danh sách tên biến ở [DEP-00 §5](DEP-00_Trien_khai_tong_the.md).
2. **Đổi:** {{bao lâu một lần, đổi theo thứ tự nào, ai làm}}.

## 6. Theo dõi sức khoẻ

| Theo dõi | Hiện có | Báo động khi | Nên thêm |
|---|---|---|---|
| Dịch vụ còn trả lời | {{`/health`}} | {{…}} | {{…}} |
| Tài nguyên máy | {{…}} | {{…}} | {{…}} |

## 7. Giới hạn hiện tại

- {{Số bản chạy tối đa, bộ nhớ, số kết nối CSDL}}

## 8. Ai trực, gọi ai

| Vai trò | Người | Liên lạc qua |
|---|---|---|
| Trực vận hành | {{…}} | {{…}} |
| Phụ trách hệ thống con | {{…}} | {{…}} |

## 9. Vấn đề còn mở

- {{…}}

## 10. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
