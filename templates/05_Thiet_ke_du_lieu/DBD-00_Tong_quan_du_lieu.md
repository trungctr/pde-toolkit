# Tổng quan dữ liệu

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-DBD-000 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.5 Design Definition (dữ liệu) |
| Tài liệu liên quan | ↑ [SAD-00 §5](../03_Kien_truc/SAD-00_Kien_truc_tong_the.md) · [ADR-00](../03_Kien_truc/ADR/ADR-00_So_dang_ky_quyet_dinh_nen_tang.md) · ↓ [ERD-HTC](ERD-HTC_CSDL_Ten_he_thong_con.md) · [DEP-00 §7](../08_Trien_khai_van_hanh/DEP-00_Trien_khai_tong_the.md) · [ASM-00 §4](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md) |

> [!TIP]
> Mỗi CSDL một dòng ở §3, dẫn tới ERD của hệ thống con giữ nó. Đây là nơi định nghĩa `DG-nn`. Chi tiết từng bảng nằm ở ERD, không chép vào đây.

---

## 1. Mục tiêu

Một trang để biết hệ thống PRJ có những CSDL nào, đặt ở đâu, ai được ghi, ai chỉ đọc và chúng trỏ sang nhau thế nào. Chi tiết từng bảng nằm trong ERD của hệ thống con.

## 2. Sơ đồ các CSDL

{{Hệ quản trị CSDL, nơi đặt, có mã hoá đường truyền không.}}

<!-- de-diagram:dg-73f425 {"version":1,"meta":{"name":"Bản đồ CSDL","mode":"flowchart"},"nodes":[{"id":"a","type":"flow.process","x":40,"y":60,"w":220,"h":60,"text":"HTC {{A}}","style":{}},{"id":"b","type":"flow.process","x":40,"y":260,"w":220,"h":60,"text":"HTC {{B}}","style":{}},{"id":"da","type":"flow.database","x":460,"y":50,"w":220,"h":80,"text":"{{db_htc_a}}","style":{}},{"id":"dbb","type":"flow.database","x":460,"y":250,"w":220,"h":80,"text":"{{db_htc_b}}","style":{}},{"id":"ds","type":"flow.database","x":860,"y":150,"w":220,"h":80,"text":"{{db_dung_chung}}","style":{}}],"edges":[{"id":"e1","type":"flow.arrow","source":"a","target":"da","label":"ghi","style":{"endArrow":"arrow"}},{"id":"e2","type":"flow.arrow","source":"b","target":"dbb","label":"ghi","style":{"endArrow":"arrow"}},{"id":"e3","type":"flow.arrow","source":"a","target":"ds","label":"ghi (được đổi cấu trúc)","style":{"endArrow":"arrow"}},{"id":"e4","type":"flow.arrow","source":"b","target":"ds","label":"chỉ đọc","style":{"endArrow":"arrow"}}]} -->
<div align="center"><svg role="img" aria-label="Bản đồ CSDL" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" width="1088" height="328" viewBox="16 26 1088 328"><title>Bản đồ CSDL</title><defs><filter id="de1bpoef-shadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="1.5" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.18"/></filter></defs><rect x="16" y="26" width="1088" height="328" fill="#ffffff"/><g class="node" transform="translate(40,60)"><rect x="0" y="0" width="220" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="34.9">HTC {{A}}</tspan></text></g><g class="node" transform="translate(40,260)"><rect x="0" y="0" width="220" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="34.9">HTC {{B}}</tspan></text></g><g class="node" transform="translate(460,50)"><path d="M0,12 A110,12 0 0 1 220,12 V68 A110,12 0 0 1 0,68 Z" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><path d="M0,12 A110,12 0 0 0 220,12" fill="none" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="50.9">{{db_htc_a}}</tspan></text></g><g class="node" transform="translate(460,250)"><path d="M0,12 A110,12 0 0 1 220,12 V68 A110,12 0 0 1 0,68 Z" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><path d="M0,12 A110,12 0 0 0 220,12" fill="none" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="50.9">{{db_htc_b}}</tspan></text></g><g class="node" transform="translate(860,150)"><path d="M0,12 A110,12 0 0 1 220,12 V68 A110,12 0 0 1 0,68 Z" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><path d="M0,12 A110,12 0 0 0 220,12" fill="none" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="50.9">{{db_dung_chung}}</tspan></text></g><g class="edge"><path d="M260,90 L450.31,90" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="460,90 448.6,94.79 448.6,85.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="346.62" y="80.5" width="26.76" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="360" y="94.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">ghi</text></g><g class="edge"><path d="M260,290 L450.31,290" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="460,290 448.6,294.79 448.6,285.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="346.62" y="280.5" width="26.76" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="360" y="294.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">ghi</text></g><g class="edge"><path d="M260,90 L554,90 Q560,90 560,96 L560,184 Q560,190 566,190 L850.31,190" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="860,190 848.6,194.79 848.6,185.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="495" y="130.5" width="130" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="560" y="144.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">ghi (được đổi cấu trúc)</text></g><g class="edge"><path d="M260,290 L554,290 Q560,290 560,284 L560,196 Q560,190 566,190 L850.31,190" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="860,190 848.6,194.79 848.6,185.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="535.92" y="230.5" width="48.17" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="560" y="244.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">chỉ đọc</text></g></svg></div>
<!-- /de-diagram:dg-73f425 -->

## 3. Danh sách CSDL

| CSDL | Máy chủ | Vai trò | Ai ghi (được đổi cấu trúc) | Ai chỉ đọc | Truy cập bằng | Đổi cấu trúc bằng | Số bảng | Sản phẩm | ERD |
|---|---|---|---|---|---|---|---|---|---|
| `{{db_htc}}` | {{…}} | {{Nghiệp vụ / dùng chung / nhật ký}} | HTC | {{hệ thống con khác}} | {{thư viện truy cập}} | {{công cụ, thư mục script}} | {{n}} | {{SP}} | [ERD-HTC](ERD-HTC_CSDL_Ten_he_thong_con.md) |

## 4. Tách dữ liệu theo khách hàng

| Sản phẩm / hệ thống con | Cách tách | Ghi chú |
|---|---|---|
| HTC | {{Cột `tenant_id` trong bảng chung / mỗi khách hàng một CSDL / chia theo nhóm khách hàng}} | {{…}} |

## 5. Liên kết giữa các CSDL

Khi một bảng trỏ sang bảng ở CSDL khác, CSDL không tự kiểm tra được liên kết đó – ứng dụng phải tự kiểm tra. Ghi rõ từng liên kết và nơi kiểm tra.

| Bảng (CSDL) | Cột | Trỏ tới (CSDL.bảng) | Kiểm tra ở đâu | Ghi chú |
|---|---|---|---|---|
| `ten_bang` (`{{db_htc}}`) | `tenant_id` | `{{db_dung_chung}}.{{tenants}}` | {{Trong service / chưa có}} | {{DG-01}} |

## 6. Vấn đề về dữ liệu

| Mã | Vấn đề | Ảnh hưởng | Liên quan |
|---|---|---|---|
| DG-01 | {{Ví dụ: chưa rõ ai được đổi cấu trúc của CSDL dùng chung}} | {{…}} | ERD-HTC C-01 |

## 7. Quy ước nên áp dụng

1. {{Mỗi CSDL chỉ một nơi được đổi cấu trúc, có lưu lịch sử thay đổi}}
2. {{Cách đặt tên bảng, cột, chỉ mục}}

## 8. Vấn đề còn mở

- {{…}}

## 9. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
