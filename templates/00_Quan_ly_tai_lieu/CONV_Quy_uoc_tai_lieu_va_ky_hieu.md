# Quy ước tài liệu và mã truy vết

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-CONV-001 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.3.6 Information Management |
| Chuẩn tham chiếu | ISO/IEC/IEEE 15289 |
| Áp dụng cho | Mọi tài liệu của dự án PRJ – {{Tên dự án}} |
| Tài liệu liên quan | ⇄ [DOC-REG](DOC-REG_So_dang_ky_tai_lieu.md) · [RTM-00](RTM-00_Ma_tran_truy_vet.md) · [GLOSSARY](GLOSSARY_Thuat_ngu.md) |

> [!TIP]
> Điền tài liệu này trước tiên: mã dự án, các hệ thống con (§3.1), sản phẩm nếu có nhiều (§3.2) và cách lập tài liệu (§5). Các tài liệu khác đều dùng những mã khai báo ở đây. Phần còn lại (§3.4, §6–§9) là quy tắc chung, thường để nguyên.

---

## 1. Mục đích

Bộ tài liệu chỉ thật sự hữu ích khi người đọc lần được từ một yêu cầu tới chỗ nó được thiết kế, lập trình và kiểm thử – và lần ngược lại. Tài liệu này đặt ra các quy tắc chung để làm được điều đó: thư mục nào chứa gì, mã đặt ra sao, liên kết thế nào, vẽ sơ đồ bằng ký hiệu nào.

## 2. Thư mục và câu hỏi mỗi thư mục trả lời

| Thư mục | Trả lời câu hỏi | Tài liệu | Quy trình ISO/IEC/IEEE 12207 | Chuẩn nội dung |
|---|---|---|---|---|
| `00_Quan_ly_tai_lieu` | Bộ tài liệu gồm những gì, viết theo quy ước nào, các phần nối nhau ra sao? | CONV, DOC-REG, GLOSSARY, RTM-00, LOG | 6.3.6 | ISO/IEC/IEEE 15289 |
| `01_Phan_tich_nghiep_vu` | Tổ chức làm việc thế nào, hệ thống hỗ trợ những quy trình nào? | BMA-00, BPMN-00, BPMN-NN | 6.4.1 | BPMN 2.0 (ISO/IEC 19510) |
| `02_Yeu_cau` | Ai cần gì, hệ thống phải làm gì? | StRS-00, SyRS-00, SRS-HTC | 6.4.2, 6.4.3 | ISO/IEC/IEEE 29148 |
| `03_Kien_truc` | Hệ thống chia thành những khối nào, vì sao chọn như vậy? | SAD-00, ADR-00, ADR-HTC | 6.4.4 | ISO/IEC/IEEE 42010, C4 |
| `04_Thiet_ke_chi_tiet` | Bên trong từng khối hoạt động ra sao? | SDD-HTC | 6.4.5 | IEEE 1016 |
| `05_Thiet_ke_du_lieu` | Dữ liệu nằm ở đâu, cấu trúc thế nào? | DBD-00, ERD-HTC | 6.4.5 | Ký hiệu chân chim |
| `06_Giao_dien_tich_hop` | Các khối gọi nhau ở đâu, bằng cách nào? | ICD-00, API-HTC | 6.4.4, 6.4.8 | OpenAPI (tham khảo) |
| `07_Kiem_thu` | Làm sao chứng minh hệ thống đúng yêu cầu? | STP-00 | 6.4.9, 6.4.11 | ISO/IEC/IEEE 29119 |
| `08_Trien_khai_van_hanh` | Đưa lên môi trường và giữ cho chạy ổn định thế nào? | DEP-00, DEP-HTC, OPS-00 | 6.4.10, 6.4.12, 6.4.13 | ISO/IEC/IEEE 15289 |
| `09_Danh_gia_hien_trang` | Đang có rủi ro gì, xử lý theo thứ tự nào? | ASM-00 | 6.3.4, 6.3.7 | ISO 31000 (tham khảo) |

## 3. Mã định danh

### 3.1 Mã dự án và hệ thống con

Mã dự án: **`PRJ`** – {{Tên dự án}}.

| Mã hệ thống con | Tên | Phụ trách việc gì | Mã nguồn | Module (`MOD`) | Người phụ trách |
|---|---|---|---|---|---|
| `HTC` | {{Tên hệ thống con}} | {{…}} | `{{repo/duong-dan}}` | `MOD`, `{{MOD2}}` | {{…}} |

> [!TIP]
> Mỗi hệ thống con có một bộ SRS / SDD / ERD / API / ADR riêng (thêm DEP nếu có hạ tầng riêng). Mã hệ thống con viết in hoa, 2–5 ký tự; mã module xuất hiện trong mã yêu cầu `FR-…`.

### 3.2 Nhiều sản phẩm trên cùng nền tảng (tuỳ chọn)

Khi vài sản phẩm cùng dựa trên một phần nền tảng chung, thêm cột **Sản phẩm** vào các bảng chức năng, API và bảng dữ liệu để biết mỗi thành phần phục vụ ai. Dự án chỉ có một sản phẩm thì bỏ cột này.

| Giá trị | Khi nào dùng |
|---|---|
| `{{SP}}` | Thành phần chỉ phục vụ một sản phẩm. Khai báo mã sản phẩm: `{{SP1}}` – {{Tên}}, `{{SP2}}` – {{Tên}} |
| `CHUNG` | Một bản cài đặt, nhiều sản phẩm cùng gọi tới |
| `TRÙNG LẶP` | Mỗi sản phẩm tự làm một bản riêng cho cùng một nhu cầu – ghi kèm bản kia nằm ở đâu |
| `NỘI BỘ` | Chỉ đội vận hành hoặc quản trị dùng |

Hai bản cài đặt cho cùng một nhu cầu dễ làm dữ liệu lệch nhau và tốn công bảo trì gấp đôi; liệt kê chúng ở [ASM-00 §5](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md).

### 3.3 Mã tài liệu

Tài liệu riêng của một hệ thống con mang mã `PRJ-<LOẠI>-<HTC>-<nnn>`; tài liệu chung của cả dự án mang mã `PRJ-<LOẠI>-000`. Tên file viết không dấu, nối bằng gạch dưới, ví dụ `SRS-HTC_Ten_he_thong_con.md`, `RTM-00_Ma_tran_truy_vet.md`.

| Loại | Tên đầy đủ | Thư mục | Mẫu tên file | Số bản |
|---|---|---|---|---|
| `CONV`, `DOCREG`, `GLOSSARY`, `RTM`, `LOG` | Quản lý tài liệu | 00 | `CONV_…`, `RTM-00_…` | 1 |
| `BMA` | Business / Mission Analysis | 01 | `BMA-00_…` | 1 |
| `BPMN` | Mô hình quy trình nghiệp vụ | 01 | `BPMN-00_…` (cấp 0), `BPMN-NN_…` (cấp 1) | 1 + mỗi quy trình |
| `StRS` | Stakeholder Requirements Specification | 02 | `StRS-00_…` | 1 |
| `SyRS` | System Requirements Specification | 02 | `SyRS-00_…` | 1 |
| `SRS` | Software Requirements Specification | 02 | `SRS-HTC_…` | mỗi hệ thống con |
| `SAD` | Software Architecture Description | 03 | `SAD-00_…` | 1 |
| `ADR` | Architecture Decision Record | 03/ADR | `ADR-00_…`, `ADR-HTC_…` | 1 + mỗi hệ thống con |
| `SDD` | Software Design Description | 04 | `SDD-HTC_…` | mỗi hệ thống con |
| `DBD` / `ERD` | Database Design / Entity Relationship | 05 | `DBD-00_…`, `ERD-HTC_…` | 1 + mỗi hệ thống con |
| `ICD` / `API` | Interface Control / API Specification | 06 | `ICD-00_…`, `API-HTC_…` | 1 + mỗi hệ thống con |
| `STP` | Software Test Plan | 07 | `STP-00_…` | 1 |
| `DEP` / `OPS` | Deployment / Operations | 08 | `DEP-00_…`, `DEP-HTC_…`, `OPS-00_…` | 1 + hệ thống con có hạ tầng riêng |
| `ASM` | Assessment – rủi ro và nợ kỹ thuật | 09 | `ASM-00_…` | 1 |

Ví dụ: `PRJ-SRS-HTC-001` là SRS của hệ thống con `HTC`; `PRJ-BPMN-0NN` là tài liệu của quy trình `BP-NN`.

### 3.4 Mã phần tử truy vết

Mỗi mã chỉ có **một nơi định nghĩa** (cột "Định nghĩa tại"). Nơi khác chỉ nhắc tới bằng mã, không viết lại nội dung. Muốn sửa nội dung một mã thì sửa ở nơi định nghĩa, rồi xem lại các nơi tham chiếu theo [RTM-00 §5](RTM-00_Ma_tran_truy_vet.md).

| Phần tử | Mẫu mã | Ví dụ | Định nghĩa tại | Được tham chiếu tại |
|---|---|---|---|---|
| Bên liên quan | `SH-<MÃ>` | `SH-USR` | [StRS-00 §2](../02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md) | BMA-00 §3, StRS-00 §3, SAD-00 §1.2 |
| Nhu cầu bên liên quan | `StR-<nn>` | `StR-01` | [StRS-00 §3](../02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md) | BPMN-NN §2, SyRS-00 §4, RTM-00 §2 |
| Ràng buộc bên liên quan | `StC-<nn>` | `StC-01` | [StRS-00 §4](../02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md) | SyRS-00 §5, SAD-00 §2 |
| Quy trình nghiệp vụ | `BP-<nn>` | `BP-NN` | [BMA-00 §5](../01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md) (danh sách) và `BPMN-<nn>` (chi tiết) | StRS-00 §3, SRS-HTC §4, STP-00 §5, RTM-00 §2 |
| Bước trong quy trình | `<id>` trong BPMN-nn (`s`, `t1`, `g1`, `e`…) | `BP-NN/t3` | [BPMN-NN §4](../01_Phan_tich_nghiep_vu/BPMN-NN_Ten_quy_trinh.md) | SRS-HTC §4 (dòng "Quy trình") |
| Chức năng hệ thống | `SYS-F<nn>` | `SYS-F01` | [SyRS-00 §4](../02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md) | SRS-HTC §1.2, §5 |
| Yêu cầu chất lượng chung | `SYS-N<nn>` | `SYS-N01` | [SyRS-00 §5](../02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md) | SRS-HTC §6, STP-00 §4 |
| Kết nối ra bên ngoài | `SYS-I<nn>` | `SYS-I01` | [SyRS-00 §6](../02_Yeu_cau/SyRS-00_Yeu_cau_he_thong.md) | ICD-00 §4, SAD-00 §3 |
| Tác nhân | `A-<MÃ>` | `A-USR` | [SRS-HTC §2.2](../02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md) | SRS-HTC §3, §4 |
| Use case | `UC-<HTC>-<nn>` | `UC-HTC-01` | [SRS-HTC §4](../02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md) | BPMN-NN §4, SDD-HTC §5, STP-00, RTM-00 |
| Yêu cầu chức năng | `FR-<HTC>-<MOD>-<nnn>` | `FR-HTC-MOD-001` | [SRS-HTC §5](../02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md) | SDD-HTC §3.2, ERD-HTC §3, API-HTC §2, STP-00 §4, RTM-00 §3 |
| Yêu cầu phi chức năng | `NFR-<HTC>-<nnn>` | `NFR-HTC-001` | [SRS-HTC §6](../02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md) | SDD-HTC §9, STP-00 §4 |
| Quy tắc nghiệp vụ | `BR-<HTC>-<nnn>` | `BR-HTC-001` | [SRS-HTC §7](../02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md) | BPMN-NN §6, SDD-HTC §7, API-HTC §1.3 |
| Quyết định kiến trúc | `ADR-00-<nn>`, `ADR-<HTC>-<nnn>` | `ADR-HTC-001` | [ADR-00](../03_Kien_truc/ADR/ADR-00_So_dang_ky_quyet_dinh_nen_tang.md), [ADR-HTC](../03_Kien_truc/ADR/ADR-HTC_So_dang_ky_quyet_dinh_kien_truc.md) | SAD-00 §11, SDD-HTC |
| Luồng tương tác | `SEQ-<nn>` (ghi kèm tài liệu: `SDD-HTC SEQ-01`) | `SEQ-01` | [SDD-HTC §5](../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md) | RTM-00 §2–§3, API-HTC §2 |
| Máy trạng thái | `STM-<nn>` | `STM-01` | [SDD-HTC §6](../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md) | ERD-HTC §3 (cột trạng thái), RTM-00 |
| Thuật toán | `ACT-<nn>` | `ACT-01` | [SDD-HTC §7](../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md) | RTM-00 §3 |
| Bảng dữ liệu | tên bảng trong mã | `ten_bang` | [ERD-HTC §3](../05_Thiet_ke_du_lieu/ERD-HTC_CSDL_Ten_he_thong_con.md) | DBD-00 §3, SDD-HTC, API-HTC, RTM-00 |
| Endpoint | `METHOD /path` | `POST /ten-tai-nguyen` | [API-HTC §2](../06_Giao_dien_tich_hop/API-HTC_Ten_he_thong_con.md) | SDD-HTC §5, §8, ICD-00, RTM-00 |
| Sự kiện | `ten.su_kien` | `ten_tai_nguyen.created` | [API-HTC §3](../06_Giao_dien_tich_hop/API-HTC_Ten_he_thong_con.md) | ICD-00 §5 |
| Cách xác thực | `AUTH-<n>` | `AUTH-1` | [ICD-00 §3](../06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md) | API-HTC §1.2, SAD-00 §8 |
| Điểm tích hợp | `I-<nn>` | `I-01` | [ICD-00 §4](../06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md) | SyRS-00 §6, API-HTC §4, RTM-00 |
| Gọi nhưng không khớp | `GAP-<nn>` | `GAP-01` | [ICD-00 §6](../06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md) | ASM-00 §4, RTM-00 |
| Vấn đề về dữ liệu | `DG-<nn>` | `DG-01` | [DBD-00 §6](../05_Thiet_ke_du_lieu/DBD-00_Tong_quan_du_lieu.md) | ASM-00 §4, RTM-00 |
| Bảng dùng chung bị hiểu khác nhau | `C-<nn>` | `C-01` | [ERD-HTC §5](../05_Thiet_ke_du_lieu/ERD-HTC_CSDL_Ten_he_thong_con.md) | DBD-00 §6, ASM-00 §4 |
| Bộ kiểm thử | `TS-<nn>` | `TS-01` | [STP-00 §4](../07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md) | RTM-00 §2–§3, ASM-00 §3 |
| Rủi ro bảo mật | `SEC-<nn>` | `SEC-01` | [ASM-00 §3](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md) | SDD-HTC §10, STP-00 §4, RTM-00 |
| Rủi ro / nợ kỹ thuật của hệ thống con | `RISK-<HTC>-<nn>`, `TD-<HTC>-<nn>` | `TD-HTC-01` | [SDD-HTC §10](../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md) | ASM-00 §11 |
| Sự cố vận hành | `OP-<nn>` | `OP-01` | [OPS-00 §3](../08_Trien_khai_van_hanh/OPS-00_So_tay_van_hanh.md) | ASM-00 §9 |
| Trục trặc khi lập tài liệu | `S-<nn>` | `S-01` | [LOG §4](LOG_Nhat_ky_xay_dung_tai_lieu.md) | – |

### 3.5 Quy tắc đánh số

1. **Mã đã cấp thì không dùng lại.** Phần tử bị bỏ vẫn giữ mã, ghi thêm "(đã bỏ – YYYY-MM-DD)" và lý do.
2. **Quy trình đánh số theo chục:** `BP-00` là cấp 0; mỗi nhóm nghiệp vụ dùng một dải, ví dụ số 10–19 cho nhóm 1, 20–29 cho nhóm 2. Nhóm và dải ghi ở [BMA-00 §5](../01_Phan_tich_nghiep_vu/BMA-00_Tong_quan_nghiep_vu.md).
3. **Use case** đánh số liên tục trong mỗi hệ thống con; **yêu cầu chức năng** đánh số liên tục trong mỗi module.
4. Mã dùng trong sơ đồ (id bước BPMN, tên use case trên sơ đồ) phải trùng mã trong bảng của cùng tài liệu.

## 4. Đầu và cuối mỗi tài liệu

Dòng đầu là tiêu đề H1, ngay sau là bảng thuộc tính:

```markdown
| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-SRS-HTC-001 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.3 System/Software Requirements Definition |
| Hệ thống con | HTC – {{Tên hệ thống con}} |
| Nguồn đã khảo sát | `{{repo/duong-dan}}` |
| Tài liệu liên quan | ↑ tầng trên · ↓ tầng dưới · ⇄ RTM-00 |
```

Dòng **Tài liệu liên quan** dẫn tới tầng trên (↑ – nơi định nghĩa các mã mà tài liệu này nhắc tới), tầng dưới (↓ – nơi dùng các mã mà tài liệu này định nghĩa) và tài liệu ngang hàng (⇄).

Hai mục cuối luôn là **Vấn đề còn mở** (câu hỏi chưa có lời đáp) và **Lịch sử thay đổi**.

## 5. Hai cách lập tài liệu

Dự án đang dùng: **{{Viết lại từ hệ thống đang chạy / Thiết kế cho hệ thống sắp làm}}**.

| | Viết lại từ hệ thống đang chạy | Thiết kế cho hệ thống sắp làm |
|---|---|---|
| Mỗi điều ghi trong tài liệu dựa vào | Vị trí trong mã nguồn (đường dẫn tính từ `{{thư mục gốc}}`) | Mã nhu cầu, quyết định (`StR-`, `ADR-`) hoặc biên bản đã chốt |
| Cột "Nguồn" ghi | `duong/dan/file.ts#tenHam` | `StR-01`, `ADR-HTC-001`, `{{biên bản ngày …}}` |
| Điều chưa chắc | Tự rút ra thì thêm nhãn **(suy luận)**; chưa kiểm được thì đưa vào *Vấn đề còn mở* | Chưa chốt thì thêm nhãn **(đề xuất)** |
| Ý tưởng cải tiến | Gom về [ASM-00](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md), để tài liệu mô tả chỉ chứa điều đang có | Ghi thẳng vào tài liệu; rủi ro ghi ở ASM-00 |
| Dòng "Trạng thái" ở đầu tài liệu | Dự thảo – viết từ hệ thống đang chạy | Dự thảo – thiết kế mới |

Luôn áp dụng:

1. **Không ghi bí mật.** Khoá, mật khẩu, token, chuỗi kết nối chỉ được nhắc bằng tên biến môi trường chứa chúng.
2. **Lời văn tiếng Việt, tên trong mã giữ nguyên.** Bảng, cột, lớp, endpoint, biến viết đúng như trong mã.

## 6. Liên kết giữa các tài liệu

1. **Liên kết tương đối** tới file `.md`, ghi mục bằng ký hiệu `§`: `[SRS-HTC §4](../02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md)`. Không dùng anchor `#…` vì mỗi trình xem tạo anchor tiếng Việt một kiểu.
2. **Nhắc bằng mã, không chép nội dung.** Tài liệu tầng dưới ghi `FR-HTC-MOD-001`, không viết lại mô tả của yêu cầu đó.
3. **Cột truy vết bắt buộc** ở các bảng sau, để mỗi tài liệu tự chỉ ngược lên tầng trên:

   | Tài liệu | Bảng | Cột truy vết |
   |---|---|---|
   | BPMN-NN | §4 Các bước | Liên quan (UC, FR, BR) |
   | StRS-00 | §3 Nhu cầu | Quy trình (BP) |
   | SyRS-00 | §4 Việc lớn của hệ thống | StR, hệ thống con đảm nhận |
   | SRS-HTC | §4 Use case, §5 FR | Quy trình (BP / bước), SYS, UC |
   | SDD-HTC | §3.2 Trách nhiệm, dòng "Hiện thực" ở §5–§7 | FR, UC, BR |
   | ERD-HTC | §3 mỗi bảng | Dùng bởi (FR, STM, endpoint) |
   | API-HTC | §2 Endpoint | FR, SEQ |
   | STP-00 | §4 Bộ kiểm thử | BP, UC, FR, SEC |
   | ASM-00 | §3 Rủi ro | Phát hiện ở, kiểm chứng bằng (TS) |

4. **Ma trận truy vết** [RTM-00](RTM-00_Ma_tran_truy_vet.md) gom các mối nối theo chiều xuôi. Bảng ở RTM-00 §5 là nơi duy nhất trả lời câu hỏi "sửa chỗ này thì phải xem lại chỗ nào".

## 7. Sơ đồ

### 7.1 Công cụ

Sơ đồ được vẽ bằng ChillCat Studio và nằm ngay trong file `.md`: dữ liệu sơ đồ (JSON) ở trong một chú thích HTML để mở lại chỉnh sửa, hình (SVG) ở ngay sau để mọi trình xem Markdown cho phép HTML đều hiển thị được. Để sửa: mở file trong tab **Tài liệu** của ChillCat Studio rồi nhấn đúp vào sơ đồ.

> [!NOTE]
> Trang xem file của GitHub lọc bỏ hình SVG nhúng, nên ở đó sơ đồ không hiện. Hãy xem bằng ChillCat Studio, VS Code hoặc một trình xem Markdown khác.

| Sơ đồ | Vẽ ở chế độ | Dùng trong |
|---|---|---|
| Quy trình BPMN 2.0 | BPMN | BPMN-00, BPMN-NN |
| Use case | UML | SRS-HTC §3 |
| Ngữ cảnh, container (C4), thành phần | Flowchart – khung làm ranh giới, nhãn đường nối ghi giao thức | SAD-00 §3–§4, SDD-HTC §3 |
| Triển khai | Flowchart – khung cho từng vùng mạng, hình trụ cho CSDL | SAD-00 §6, DEP-HTC §3 |
| Class | UML | SDD-HTC §4 |
| Sequence | UML – lifeline, message đánh số, khung alt / loop | SDD-HTC §5 |
| Máy trạng thái | UML | SDD-HTC §6 |
| Thuật toán, luồng xử lý | Flowchart | SDD-HTC §7, STP-00 §8, DEP-00 §6 |
| ERD | UML (ERD) – bảng có PK / FK / UK, đầu chân chim | ERD-HTC §2 |

### 7.2 Quy tắc vẽ

- Một sơ đồ nên xem trọn trên một màn hình; nhiều hơn khoảng 40 hình thì tách theo miền.
- Tên sơ đồ mở đầu bằng mã phần tử nếu có (`BP-NN …`, `SEQ-01 …`, `STM-01 …`) để tìm được bằng mã.
- Nhãn hình viết tiếng Việt; tên lấy từ mã (bảng, lớp, endpoint) giữ nguyên.
- ERD: kiểu dữ liệu ghi ngắn (`uuid`, `varchar`, `int`, `timestamptz`, `jsonb`…); đánh dấu khoá bằng `PK`, `FK`, `UK`; nhãn quan hệ là một động từ ngắn.
- Mermaid và PlantUML chỉ dùng để phác nhanh. Khi chỉnh sửa, ChillCat Studio đổi chúng thành sơ đồ nhúng – bản phát hành chỉ giữ sơ đồ nhúng.

### 7.3 Ký hiệu BPMN dùng trong bộ tài liệu

| Ký hiệu | Đọc là |
|---|---|
| Pool / lane | Một tổ chức / một vai trò hoặc hệ thống tham gia quy trình |
| Vòng tròn viền mảnh / viền đậm | Điểm bắt đầu / điểm kết thúc; có tia sét bên trong là kết thúc vì lỗi |
| Vòng tròn có đồng hồ / phong bì | Chờ tới một thời điểm (lịch chạy, hết hạn) / chờ một thông điệp |
| Bước có hình người | Một người thao tác trên phần mềm |
| Bước có bánh răng | Hệ thống tự làm |
| Bước có hình bảng | Kiểm tra một quy tắc `BR-…` |
| Bước có phong bì | Gửi thông báo, email hoặc sự kiện |
| Bước viền dày | Chạy một quy trình khác (`BP-nn`) |
| Hình thoi ✕ / ＋ / ◯ | Chọn đúng một nhánh / chạy mọi nhánh song song / chạy một hoặc nhiều nhánh |

## 8. Mục bắt buộc của từng loại

| Loại | Phải có |
|---|---|
| BPMN-NN | Tóm tắt quy trình, sơ đồ, bảng các bước (id trùng sơ đồ), rẽ nhánh, quy tắc áp dụng |
| SRS (ISO/IEC/IEEE 29148) | Phạm vi, tác nhân, sơ đồ use case, đặc tả use case, FR, NFR, BR |
| SDD (IEEE 1016) | Các viewpoint context, composition, logical, interaction, state dynamics, algorithm, interface; khía cạnh dùng chung; nợ kỹ thuật |
| ERD | Hệ quản trị CSDL và cách đổi cấu trúc; sơ đồ theo miền; từ điển dữ liệu; enum, chỉ mục, ràng buộc; liên kết sang CSDL khác |
| API | Địa chỉ, xác thực, mã lỗi; danh sách endpoint; sự kiện phát ra; các lời gọi sang hệ thống khác |

## 9. Phiên bản và khi nào coi là xong

- Dưới 1.0 là bản nháp; lên 1.0 khi người phụ trách phần đó đã đọc và đồng ý.
- Trạng thái đi theo thứ tự **Dự thảo** → **Đang rà soát** → **Đã phê duyệt**; tài liệu bị thay thì ghi **Thay thế** kèm tên tài liệu mới.
- Mỗi lần sửa: thêm một dòng vào *Lịch sử thay đổi* và cập nhật số phiên bản ở [DOC-REG](DOC-REG_So_dang_ky_tai_lieu.md).
- Một thay đổi mã nguồn chỉ coi là xong khi các tài liệu bị ảnh hưởng (tra ở [RTM-00 §5](RTM-00_Ma_tran_truy_vet.md)) đã được cập nhật cùng lúc – đặc biệt ERD khi đổi cấu trúc dữ liệu, API khi đổi endpoint.

## 10. Vấn đề còn mở

- {{Điều chưa thống nhất về quy ước, ví dụ: dùng công cụ nào quản lý test case, lưu biên bản ở đâu}}

## 11. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
