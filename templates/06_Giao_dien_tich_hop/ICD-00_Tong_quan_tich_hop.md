# Tổng quan tích hợp (ICD)

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-ICD-000 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.4 Architecture Definition · 6.4.8 Integration |
| Tài liệu liên quan | ↑ [SyRS-00 §6](../02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md) · [SAD-00 §7](../03_Kien_truc/SAD-00_Kien_truc_tong_the.md) · ↓ [API-HTC](API-HTC_Ten_he_thong_con.md) · ⇄ [RTM-00](../00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md) · [ASM-00](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md) |

> [!TIP]
> Nơi định nghĩa `AUTH-n`, `I-nn`, `GAP-nn`. Mỗi điểm tích hợp `I-nn` phải có mặt ở §4 của API **bên gọi** (gọi sang hệ thống khác) và trong danh sách endpoint của API **bên được gọi**. Không chép danh sách endpoint vào đây.

---

## 1. Mục tiêu

Một chỗ để thấy mọi đường nối của hệ thống PRJ: dịch vụ nào chạy ở đâu, xác thực bằng gì, ai gọi ai, sự kiện nào được phát ra và chỗ nào hai bên không khớp nhau. Danh sách endpoint chi tiết nằm ở API của từng hệ thống con.

## 2. Dịch vụ đang chạy

| Dịch vụ | Giao thức, cổng | Đường dẫn gốc | Có OpenAPI | Sản phẩm | Số endpoint | Tài liệu |
|---|---|---|---|---|---|---|
| HTC – {{Tên}} | {{REST / WebSocket / gRPC}}, {{port}} | `/{{prefix}}` | {{Có / Không}} | {{SP}} | {{n}} | [API-HTC](API-HTC_Ten_he_thong_con.md) |

## 3. Cách xác thực

| Mã | Cách xác thực | Áp dụng cho | Ghi chú | Rủi ro |
|---|---|---|---|---|
| AUTH-1 | {{JWT / phiên đăng nhập / API key / mTLS}} | {{Người dùng → HTC}} | {{Ký bằng gì, hết hạn sau bao lâu, lưu ở đâu}} | {{SEC-nn}} |
| AUTH-2 | {{Token dùng giữa các dịch vụ}} | {{HTC → hệ thống con khác}} | {{…}} | {{…}} |

## 4. Ai gọi ai

Cột **Kiểu**: **Chờ** – gọi rồi chờ kết quả; **Gửi đi** – gửi xong là thôi, không chờ.

| Mã | Ai gọi → gọi ai | Kênh | Để làm gì | Xác thực | Kiểu | Nếu bên nhận lỗi | Sản phẩm | SYS |
|---|---|---|---|---|---|---|---|---|
| I-01 | HTC → {{hệ thống con khác}} | REST | {{…}} | AUTH-2 | Chờ | {{Thử lại / bỏ qua / báo lỗi cho người dùng}} | {{SP}} | – |
| I-02 | HTC → {{hệ thống ngoài}} | {{HTTPS}} | {{…}} | {{…}} | {{Gửi đi}} | {{…}} | {{SP}} | SYS-I01 |

## 5. Sự kiện

| Kênh | Sự kiện | Phát bởi | Nhận bởi | Tài liệu |
|---|---|---|---|---|
| {{`/ws` / topic / hàng đợi}} | `ten_tai_nguyen.created` | HTC | {{…}} | [API-HTC §3](API-HTC_Ten_he_thong_con.md) |

## 6. Gọi nhưng không khớp

Bên gọi và bên nhận hiểu khác nhau về một lời gọi (đường dẫn không tồn tại, dữ liệu sai dạng…).

| Mã | Bên gọi | Gọi tới | Thực tế | Nguồn |
|---|---|---|---|---|
| GAP-01 | {{Giao diện / hệ thống con}} | `{{METHOD /path}}` | {{Không tồn tại / sai dạng dữ liệu}} | `{{…}}` |

## 7. Vấn đề còn mở

- {{Ví dụ: các dịch vụ chưa thống nhất một định dạng lỗi}}

## 8. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
