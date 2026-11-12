# Sổ đăng ký tài liệu (Document Register)

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-DOCREG-000 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Đang cập nhật |
| Quy trình ISO/IEC/IEEE 12207 | 6.3.6 Information Management |
| Chuẩn tham chiếu | ISO/IEC/IEEE 15289 |
| Tài liệu liên quan | ↑ [CONV §3.3](CONV_Quy_uoc_tai_lieu_va_ky_hieu.md) (mã tài liệu) · ⇄ [RTM-00](RTM-00_Ma_tran_truy_vet.md) · [LOG](LOG_Nhat_ky_xay_dung_tai_lieu.md) |

> [!TIP]
> Mỗi tài liệu có đúng một dòng. Khi nhân bản tài liệu cho một hệ thống con hoặc một quy trình mới, thêm dòng ngay. Cột "Phiên bản" phải khớp bảng *Lịch sử thay đổi* trong tài liệu đó ([CONV §9](CONV_Quy_uoc_tai_lieu_va_ky_hieu.md)).

Cách lập tài liệu: **{{Viết lại từ hệ thống đang chạy / Thiết kế mới}}** (xem [CONV §5](CONV_Quy_uoc_tai_lieu_va_ky_hieu.md)). Một tài liệu lên 1.0 khi người phụ trách phần đó đã đọc và đồng ý.

## 1. Quản lý tài liệu (`00_Quan_ly_tai_lieu`)

| Mã | Tài liệu | Loại hạng mục thông tin | Phiên bản | Trạng thái |
|---|---|---|---|---|
| PRJ-CONV-001 | [Quy ước tài liệu và ký hiệu](CONV_Quy_uoc_tai_lieu_va_ky_hieu.md) | Information management plan | 0.1 | Dự thảo |
| PRJ-GLOSSARY-001 | [Bảng thuật ngữ](GLOSSARY_Thuat_ngu.md) | Glossary | 0.1 | Dự thảo |
| PRJ-DOCREG-000 | Sổ đăng ký tài liệu (tài liệu này) | Configuration / document register | 0.1 | Đang cập nhật |
| PRJ-RTM-000 | [Ma trận truy vết](RTM-00_Ma_tran_truy_vet.md) | Traceability matrix | 0.1 | Dự thảo |
| PRJ-LOG-001 | [Nhật ký xây dựng tài liệu](LOG_Nhat_ky_xay_dung_tai_lieu.md) | Project log | 0.1 | Dự thảo |

## 2. Phân tích nghiệp vụ (`01_Phan_tich_nghiep_vu`)

| Mã | Tài liệu | Nhóm | Phiên bản | Trạng thái |
|---|---|---|---|---|
| PRJ-BMA-000 | [Phân tích nghiệp vụ tổng quan](../01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md) | – | 0.1 | Dự thảo |
| PRJ-BPMN-000 | [BP-00 Tổng thể hệ thống (cấp 0)](../01_Phan_tich_nghiep_vu/BPMN-00_Tong_the_he_thong.md) | – | 0.1 | Dự thảo |
| PRJ-BPMN-0NN | [BP-NN {{Tên quy trình}}](../01_Phan_tich_nghiep_vu/BPMN-NN_Ten_quy_trinh.md) | {{Nhóm}} | 0.1 | Dự thảo |

## 3. Yêu cầu (`02_Yeu_cau`)

| Mã | Tài liệu | Hệ thống con | Phiên bản | Trạng thái |
|---|---|---|---|---|
| PRJ-StRS-000 | [Yêu cầu các bên liên quan](../02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md) | Toàn hệ | 0.1 | Dự thảo |
| PRJ-SyRS-000 | [Yêu cầu hệ thống + chỉ mục SRS](../02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md) | Toàn hệ | 0.1 | Dự thảo |
| PRJ-SRS-HTC-001 | [SRS {{Tên hệ thống con}}](../02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md) | HTC | 0.1 | Dự thảo |

## 4. Kiến trúc (`03_Kien_truc`)

| Mã | Tài liệu | Phiên bản | Trạng thái |
|---|---|---|---|
| PRJ-SAD-000 | [Mô tả kiến trúc tổng thể](../03_Kien_truc/SAD-00_Kien_truc_tong_the.md) | 0.1 | Dự thảo |
| PRJ-ADR-000 | [Quyết định kiến trúc cấp nền tảng](../03_Kien_truc/ADR/ADR-00_So_dang_ky_quyet_dinh_nen_tang.md) | 0.1 | Dự thảo |
| PRJ-ADR-HTC-001 | [Quyết định kiến trúc {{Tên hệ thống con}}](../03_Kien_truc/ADR/ADR-HTC_So_dang_ky_quyet_dinh_kien_truc.md) | 0.1 | Dự thảo |

## 5. Thiết kế chi tiết (`04_Thiet_ke_chi_tiet`)

| Mã | Tài liệu | Phiên bản | Trạng thái |
|---|---|---|---|
| PRJ-SDD-HTC-001 | [SDD {{Tên hệ thống con}}](../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md) | 0.1 | Dự thảo |

## 6. Thiết kế dữ liệu (`05_Thiet_ke_du_lieu`)

| Mã | Tài liệu | Phiên bản | Trạng thái |
|---|---|---|---|
| PRJ-DBD-000 | [Tổng quan dữ liệu](../05_Thiet_ke_du_lieu/DBD-00_Tong_quan_du_lieu.md) | 0.1 | Dự thảo |
| PRJ-ERD-HTC-001 | [ERD {{Tên hệ thống con}}](../05_Thiet_ke_du_lieu/ERD-HTC_CSDL_Ten_he_thong_con.md) | 0.1 | Dự thảo |

## 7. Giao diện và tích hợp (`06_Giao_dien_tich_hop`)

| Mã | Tài liệu | Phiên bản | Trạng thái |
|---|---|---|---|
| PRJ-ICD-000 | [Tổng quan tích hợp](../06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md) | 0.1 | Dự thảo |
| PRJ-API-HTC-001 | [API {{Tên hệ thống con}}](../06_Giao_dien_tich_hop/API-HTC_Ten_he_thong_con.md) | 0.1 | Dự thảo |

## 8. Kiểm thử, triển khai, đánh giá

| Mã | Tài liệu | Thư mục | Phiên bản | Trạng thái |
|---|---|---|---|---|
| PRJ-STP-000 | [Kế hoạch kiểm thử](../07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md) | 07 | 0.1 | Dự thảo |
| PRJ-DEP-000 | [Triển khai tổng thể](../08_Trien_khai_van_hanh/DEP-00_Trien_khai_tong_the.md) | 08 | 0.1 | Dự thảo |
| PRJ-DEP-HTC-001 | [Hạ tầng {{Tên hệ thống con}}](../08_Trien_khai_van_hanh/DEP-HTC_Ha_tang_Ten_he_thong_con.md) | 08 | 0.1 | Dự thảo |
| PRJ-OPS-000 | [Sổ tay vận hành](../08_Trien_khai_van_hanh/OPS-00_So_tay_van_hanh.md) | 08 | 0.1 | Dự thảo |
| PRJ-ASM-000 | [Rủi ro và nợ kỹ thuật](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md) | 09 | 0.1 | Dự thảo |

## 9. Lưu trữ

| Thư mục | Nội dung | Lý do lưu trữ |
|---|---|---|
| `_luu_tru/YYYY-MM-DD_{{mo_ta}}/` | {{Tài liệu đã thay thế}} | {{Bị thay bởi tài liệu nào}} |

## 10. Vấn đề còn mở

- {{Tài liệu còn thiếu hoặc chưa có người phụ trách}}

## 11. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo sổ đăng ký từ bộ mẫu | {{Họ tên}} |
