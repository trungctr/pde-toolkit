# Rủi ro và nợ kỹ thuật

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-ASM-000 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.3.4 Risk Management · 6.3.7 Measurement |
| Chuẩn tham chiếu | ISO 31000 (tham khảo) |
| Tài liệu liên quan | ↑ các tài liệu chi tiết: [SDD-HTC §10](../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md) · [DBD-00 §6](../05_Thiet_ke_du_lieu/DBD-00_Tong_quan_du_lieu.md) · [ICD-00 §6](../06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md) · [OPS-00 §3](../08_Trien_khai_van_hanh/OPS-00_So_tay_van_hanh.md) · ↓ [STP-00 §4](../07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md) · ⇄ [RTM-00](../00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md) |

> Tài liệu gom các rủi ro đã được phát hiện ở những tài liệu khác và đề xuất thứ tự xử lý. Không ghi bất kỳ giá trị bí mật nào – chỉ ghi chỗ bị lộ.

> [!TIP]
> Đây là nơi tổng hợp, không phải nơi phát hiện: rủi ro gốc nằm ở SDD (`RISK-HTC`, `TD-HTC`), DBD (`DG`), ERD (`C`), ICD (`GAP`), OPS (`OP`). Chỉ rủi ro bảo mật được đánh mã `SEC-nn` tại đây. Mỗi rủi ro ghi bộ kiểm thử `TS-nn` dùng để xác nhận đã khắc phục.

---

## 1. Tóm tắt cho người quyết định

1. **{{Rủi ro quan trọng nhất}}** – {{một câu: hậu quả nếu không xử lý}} (SEC-01).

### 1.1 Mức sẵn sàng của từng hệ thống con (1 = yếu, 5 = tốt)

| Hệ thống con | Tài liệu | Kiểm thử | Bảo mật | Vận hành | Ghi chú |
|---|---|---|---|---|---|
| HTC – {{Tên}} | {{n}} | {{n}} | {{n}} | {{n}} | {{…}} |

## 2. Cách xếp mức

| Mức | Khi nào |
|---|---|
| **Nghiêm trọng** | Người ngoài lợi dụng được ngay, hậu quả lớn: lộ dữ liệu của nhiều khách hàng, mất quyền kiểm soát hoặc thiệt hại tiền |
| **Cao** | Cần một điều kiện dễ có (ví dụ một tài khoản thường) để lợi dụng, hoặc khi xảy ra thì cả hệ thống bị ảnh hưởng |
| **Trung bình** | Chỉ ảnh hưởng một phần người dùng, hoặc khó lợi dụng |
| **Thấp** | Chưa gây hại trực tiếp; ảnh hưởng tới chất lượng hoặc công bảo trì |

## 3. Rủi ro bảo mật

| Mã | Mức | Hệ thống | Mô tả | Bằng chứng | Phát hiện ở | Đề xuất | Kiểm chứng bằng | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| SEC-01 | {{Cao}} | HTC | {{…}} | `{{file#ham}}` | RISK-HTC-01 ([SDD-HTC §10](../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md)) | {{…}} | TS-01 | {{Mở}} |

## 4. Rủi ro về dữ liệu và tích hợp

- **Dữ liệu:** DG-01 … ([DBD-00 §6](../05_Thiet_ke_du_lieu/DBD-00_Tong_quan_du_lieu.md)). Bảng dùng chung bị hiểu khác nhau: C-01 … ([ERD-HTC §5](../05_Thiet_ke_du_lieu/ERD-HTC_CSDL_Ten_he_thong_con.md)).
- **Tích hợp:** GAP-01 … ([ICD-00 §6](../06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md)).

## 5. Năng lực bị làm hai lần (khi có nhiều sản phẩm)

| Năng lực | Bản của {{SP1}} | Bản của {{SP2}} | Đề xuất |
|---|---|---|---|
| {{…}} | {{…}} | {{…}} | {{…}} |

## 6. Thành phần dở dang hoặc không dùng

| Tình trạng | Thành phần | Nguồn |
|---|---|---|
| {{Có khai báo nhưng không có mã / có mã nhưng không ai gọi / chỉ là bản giả lập}} | {{…}} | {{…}} |

## 7. Tài liệu cũ không còn đúng

| Tài liệu | Ghi gì | Thực tế |
|---|---|---|
| {{README / tài liệu cũ}} | {{…}} | {{…}} |

## 8. Kiểm thử và CI

| Hệ thống | Đang có | Còn thiếu | CI |
|---|---|---|---|
| HTC | {{…}} | {{FR chưa có TS – xem RTM-00 §3}} | {{…}} |

Kế hoạch bổ sung: [STP-00](../07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md).

## 9. Vận hành

- {{Điểm yếu vận hành chính; sự cố lặp lại OP-01}}

Chi tiết: [DEP-00](../08_Trien_khai_van_hanh/DEP-00_Trien_khai_tong_the.md), [DEP-HTC](../08_Trien_khai_van_hanh/DEP-HTC_Ha_tang_Ten_he_thong_con.md), [OPS-00](../08_Trien_khai_van_hanh/OPS-00_So_tay_van_hanh.md).

## 10. Đối chiếu với danh sách lỗi đã có (nếu có)

| Mã cũ | Nội dung | Kết quả kiểm tra | Mã mới |
|---|---|---|---|
| {{BUG-01}} | {{…}} | {{Đúng / Không tái hiện được}} | {{SEC-01 / DG-01}} |

## 11. Nợ kỹ thuật theo hệ thống con

| Hệ thống | Mã | Tài liệu |
|---|---|---|
| HTC – {{Tên}} | RISK-HTC-01…, TD-HTC-01… | [SDD-HTC §10](../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md) |

## 12. Thứ tự xử lý đề xuất

| Đợt | Hạn | Việc | Liên quan | Kiểm chứng |
|---|---|---|---|---|
| **Ngay** | {{Trong tuần}} | {{…}} | SEC-01 | TS-01 |
| **Sớm** | {{Trong tháng}} | {{…}} | {{DG-01, GAP-01}} | {{…}} |
| **Theo kế hoạch** | {{Trong quý}} | {{…}} | {{TD-HTC-01}} | {{…}} |

## 13. Vấn đề còn mở

- {{…}}

## 14. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
