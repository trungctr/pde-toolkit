# Đặc tả yêu cầu của các bên liên quan (StRS)

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-StRS-000 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.2 Stakeholder Needs and Requirements Definition |
| Chuẩn tham chiếu | ISO/IEC/IEEE 29148 §9.3 |
| Tài liệu liên quan | ↑ [BMA-00 §3](../01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md) · ↓ [BPMN-NN](../01_Phan_tich_nghiep_vu/BPMN-NN_Ten_quy_trinh.md) · [SyRS-00](SyRS-00_Yeu_cau_he_thong.md) · ⇄ [RTM-00 §4](../00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md) |

> [!TIP]
> Nơi định nghĩa `SH-`, `StR-`, `StC-`. Mỗi nhu cầu phải trỏ tới ít nhất một quy trình (cột "Quy trình") hoặc ghi "–" kèm lý do (ví dụ nhu cầu phi chức năng). Khi viết từ hệ thống đang chạy, cột "Đáp ứng" cho biết hệ thống hiện làm được tới đâu – dùng nó khi hỏi lại bên liên quan.

---

## 1. Mục tiêu

Ghi lại, bằng lời của chính các bên liên quan, họ cần hệ thống PRJ giúp được gì. Mỗi nhu cầu sau đó được nối xuống quy trình ([BMA-00](../01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md)) và yêu cầu hệ thống ([SyRS-00](SyRS-00_Yeu_cau_he_thong.md)).

Cột **Đáp ứng**: Đủ · Một phần · Chưa có · Có nhưng chưa dùng.

## 2. Các bên liên quan

Mô tả chi tiết vai trò và mối quan tâm ở [BMA-00 §3](../01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md). Mã nhóm dùng trong bộ tài liệu:

| Mã | Nhóm | Đại diện | Cách thu thập nhu cầu |
|---|---|---|---|
| SH-USR | {{Người dùng cuối}} | {{Tên / vai trò}} | {{Phỏng vấn, khảo sát}} |
| SH-ADM | {{Quản trị}} | {{…}} | {{…}} |
| SH-OPS | {{Vận hành}} | {{…}} | {{…}} |

## 3. Nhu cầu

| Mã | Ai cần | Cần gì | Vì sao | Ưu tiên | Quy trình | Sản phẩm | Đáp ứng | Thế nào là đạt |
|---|---|---|---|---|---|---|---|---|
| StR-01 | SH-USR | {{Người dùng có thể …}} | {{Vì sao cần}} | {{Cao}} | [BP-NN](../01_Phan_tich_nghiep_vu/BPMN-NN_Ten_quy_trinh.md) | {{SP}} | {{Đủ}} | {{Đo được, kiểm chứng được}} |
| StR-02 | SH-ADM | {{Dữ liệu của tổ chức này không lộ sang tổ chức khác…}} | {{…}} | {{Cao}} | – (phi chức năng) | CHUNG | {{…}} | {{…}} |

## 4. Ràng buộc

| Mã | Ràng buộc | Nguồn |
|---|---|---|
| StC-01 | {{Ngôn ngữ giao diện, quy định pháp lý, ngân sách, thời hạn…}} | {{…}} |

## 5. Vấn đề còn mở

- {{Ví dụ: chưa ai chốt thứ tự ưu tiên giữa các nhu cầu}}

## 6. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
