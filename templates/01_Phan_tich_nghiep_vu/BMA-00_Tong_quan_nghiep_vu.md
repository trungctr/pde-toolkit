# Phân tích nghiệp vụ tổng quan – PRJ {{Tên dự án}}

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-BMA-000 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.1 Business or Mission Analysis |
| Nguồn đã khảo sát | {{Tài liệu nghiệp vụ, phỏng vấn, mã nguồn}} |
| Tài liệu liên quan | ↓ [BPMN-00](BPMN-00_Tong_the_he_thong.md) · [BPMN-NN](BPMN-NN_Ten_quy_trinh.md) · [StRS-00](../02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md) · ⇄ [RTM-00](../00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md) · [GLOSSARY](../00_Quan_ly_tai_lieu/GLOSSARY_Thuat_ngu.md) |

> [!TIP]
> Đọc tài liệu này đầu tiên trong nhóm nghiệp vụ. §5 là **danh sách quy trình duy nhất** của dự án: mỗi `BP-nn` phải có dòng ở đây trước khi có tài liệu BPMN riêng.

---

## 1. Mục tiêu

Giúp người mới hiểu nhanh hệ thống PRJ phục vụ ai, làm được những gì và gồm những quy trình nào. Quy trình được vẽ ở hai cấp:

- **Cấp 0:** [BPMN-00 Tổng thể hệ thống](BPMN-00_Tong_the_he_thong.md).
- **Cấp 1:** mỗi quy trình một tài liệu `BPMN-nn_…`, liệt kê ở §5.

## 2. Bối cảnh

{{Hệ thống phục vụ ai, giải quyết vấn đề gì, mô hình kinh doanh.}}

| Sản phẩm | Mang lại gì | Dành cho | Mã nguồn | Chạy trên |
|---|---|---|---|---|
| **{{SP}}** – {{Tên sản phẩm}} | {{Giá trị}} | {{Phân khúc}} | `{{repo}}` | {{Hạ tầng}} |

**Cách thu tiền:** {{gói, giá, kênh bán}}.

## 3. Những ai liên quan

Mã bên liên quan (`SH-…`) được định nghĩa ở [StRS-00 §2](../02_Yeu_cau/StRS-00_Yeu_cau_cac_ben_lien_quan.md).

| Mã | Ai | Làm gì | Quan tâm nhất tới | Dùng sản phẩm |
|---|---|---|---|---|
| SH-USR | {{Người dùng cuối}} | {{Vai trò}} | {{Mối quan tâm}} | {{SP}} |
| SH-ADM | {{Quản trị}} | {{Vai trò}} | {{Mối quan tâm}} | {{SP}} |
| SH-OPS | {{Vận hành}} | {{Vai trò}} | {{Mối quan tâm}} | NỘI BỘ |

## 4. Hệ thống làm được gì

Nhãn sau tên năng lực cho biết phạm vi sản phẩm theo [CONV §3.2](../00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md): `CHUNG` / `{{SP}}` / `TRÙNG LẶP` / `NỘI BỘ`.

<!-- de-diagram:dg-76c1c0 {"version":1,"meta":{"name":"Bản đồ năng lực nghiệp vụ","mode":"flowchart"},"nodes":[{"id":"g0","type":"basic.frame","x":40,"y":40,"w":330,"h":230,"text":"1. {{Nhóm năng lực khách hàng}}","style":{}},{"id":"c00","type":"flow.process","x":65,"y":95,"w":280,"h":60,"text":"{{Năng lực 1.1}} · CHUNG","style":{}},{"id":"c01","type":"flow.process","x":65,"y":180,"w":280,"h":60,"text":"{{Năng lực 1.2}} · {{SP}}","style":{}},{"id":"g1","type":"basic.frame","x":400,"y":40,"w":330,"h":230,"text":"2. {{Nhóm năng lực nghiệp vụ chính}}","style":{}},{"id":"c10","type":"flow.process","x":425,"y":95,"w":280,"h":60,"text":"{{Năng lực 2.1}} · {{SP}}","style":{}},{"id":"c11","type":"flow.process","x":425,"y":180,"w":280,"h":60,"text":"{{Năng lực 2.2}} · TRÙNG LẶP","style":{}},{"id":"g2","type":"basic.frame","x":760,"y":40,"w":330,"h":230,"text":"3. {{Nhóm năng lực nền tảng, vận hành}}","style":{}},{"id":"c20","type":"flow.process","x":785,"y":95,"w":280,"h":60,"text":"{{Năng lực 3.1}} · CHUNG","style":{}},{"id":"c21","type":"flow.process","x":785,"y":180,"w":280,"h":60,"text":"{{Năng lực 3.2}} · NỘI BỘ","style":{}}],"edges":[]} -->
<div align="center"><svg role="img" aria-label="Bản đồ năng lực nghiệp vụ" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" width="1098" height="278" viewBox="16 16 1098 278"><title>Bản đồ năng lực nghiệp vụ</title><defs><filter id="denqxk64-shadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="1.5" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.18"/></filter></defs><rect x="16" y="16" width="1098" height="278" fill="#ffffff"/><g class="node" transform="translate(40,40)"><rect x="0" y="0" width="330" height="230" rx="6" fill="none" stroke="#64748b" stroke-width="1.5"/><path d="M0,6 Q0,0 6,0 H241.92 V22 Q241.92,28 235.92,28 H0 Z" fill="#64748b" fill-opacity="0.12" stroke="none"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve" font-weight="bold"><tspan x="12" y="18.9">1. {{Nhóm năng lực khách hàng}}</tspan></text></g><g class="node" transform="translate(65,95)"><rect x="0" y="0" width="280" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="140" y="34.9">{{Năng lực 1.1}} · CHUNG</tspan></text></g><g class="node" transform="translate(65,180)"><rect x="0" y="0" width="280" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="140" y="34.9">{{Năng lực 1.2}} · {{SP}}</tspan></text></g><g class="node" transform="translate(400,40)"><rect x="0" y="0" width="330" height="230" rx="6" fill="none" stroke="#64748b" stroke-width="1.5"/><path d="M0,6 Q0,0 6,0 H271.63 V22 Q271.63,28 265.63,28 H0 Z" fill="#64748b" fill-opacity="0.12" stroke="none"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve" font-weight="bold"><tspan x="12" y="18.9">2. {{Nhóm năng lực nghiệp vụ chính}}</tspan></text></g><g class="node" transform="translate(425,95)"><rect x="0" y="0" width="280" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="140" y="34.9">{{Năng lực 2.1}} · {{SP}}</tspan></text></g><g class="node" transform="translate(425,180)"><rect x="0" y="0" width="280" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="140" y="34.9">{{Năng lực 2.2}} · TRÙNG LẶP</tspan></text></g><g class="node" transform="translate(760,40)"><rect x="0" y="0" width="330" height="230" rx="6" fill="none" stroke="#64748b" stroke-width="1.5"/><path d="M0,6 Q0,0 6,0 H292.49 V22 Q292.49,28 286.49,28 H0 Z" fill="#64748b" fill-opacity="0.12" stroke="none"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve" font-weight="bold"><tspan x="12" y="18.9">3. {{Nhóm năng lực nền tảng, vận hành}}</tspan></text></g><g class="node" transform="translate(785,95)"><rect x="0" y="0" width="280" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="140" y="34.9">{{Năng lực 3.1}} · CHUNG</tspan></text></g><g class="node" transform="translate(785,180)"><rect x="0" y="0" width="280" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="140" y="34.9">{{Năng lực 3.2}} · NỘI BỘ</tspan></text></g></svg></div>
<!-- /de-diagram:dg-76c1c0 -->

## 5. Danh sách quy trình

Cột **Trạng thái**: **Chạy** (đang dùng thật) · **Một phần** · **Chưa dùng** (đã làm nhưng chưa ai dùng) · **Kế hoạch** (chưa làm).

Nhóm và dải mã: {{10–19 Nhóm 1}} · {{20–29 Nhóm 2}} · {{80–89 Vận hành}} ([CONV §3.5](../00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md)).

| Mã | Quy trình | Nhóm | Người chịu trách nhiệm | Sản phẩm | Hệ thống con | Nhu cầu | Trạng thái | Tài liệu |
|---|---|---|---|---|---|---|---|---|
| BP-00 | Tổng thể hệ thống (cấp 0) | – | {{Người phụ trách sản phẩm}} | CHUNG | Tất cả | – | – | [BPMN-00](BPMN-00_Tong_the_he_thong.md) |
| BP-NN | {{Tên quy trình}} | {{Nhóm}} | {{Vai trò}} | {{SP}} | HTC | StR-01 | {{Chạy}} | [BPMN-NN](BPMN-NN_Ten_quy_trinh.md) |

## 6. Chuỗi giá trị

<!-- de-diagram:dg-85f2af {"version":1,"meta":{"name":"Chuỗi giá trị","mode":"flowchart"},"nodes":[{"id":"v0","type":"flow.process","x":40,"y":40,"w":240,"h":70,"text":"{{Thu hút khách hàng}}\nBP-NN","style":{}},{"id":"v1","type":"flow.process","x":340,"y":40,"w":240,"h":70,"text":"{{Đăng ký, mua gói}}\nBP-NN","style":{}},{"id":"v2","type":"flow.process","x":640,"y":40,"w":240,"h":70,"text":"{{Sử dụng nghiệp vụ chính}}\nBP-NN","style":{}},{"id":"v3","type":"flow.process","x":940,"y":40,"w":240,"h":70,"text":"{{Gia hạn, hỗ trợ}}\nBP-NN","style":{}},{"id":"sup","type":"flow.process","x":40,"y":180,"w":1140,"h":60,"text":"Hoạt động hỗ trợ: {{vận hành, bảo mật, dữ liệu, nội dung}} – BP-NN","style":{"fill":"#f8fafc","stroke":"#64748b"}}],"edges":[{"id":"a0","type":"flow.arrow","source":"v0","target":"v1","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"a1","type":"flow.arrow","source":"v1","target":"v2","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"a2","type":"flow.arrow","source":"v2","target":"v3","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"}]} -->
<div align="center"><svg role="img" aria-label="Chuỗi giá trị" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" width="1188" height="248" viewBox="16 16 1188 248"><title>Chuỗi giá trị</title><defs><filter id="dein1ts0-shadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="1.5" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.18"/></filter></defs><rect x="16" y="16" width="1188" height="248" fill="#ffffff"/><g class="node" transform="translate(40,40)"><rect x="0" y="0" width="240" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="120" y="31.15">{{Thu hút khách hàng}}</tspan><tspan x="120" y="48.65">BP-NN</tspan></text></g><g class="node" transform="translate(340,40)"><rect x="0" y="0" width="240" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="120" y="31.15">{{Đăng ký, mua gói}}</tspan><tspan x="120" y="48.65">BP-NN</tspan></text></g><g class="node" transform="translate(640,40)"><rect x="0" y="0" width="240" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="120" y="31.15">{{Sử dụng nghiệp vụ chính}}</tspan><tspan x="120" y="48.65">BP-NN</tspan></text></g><g class="node" transform="translate(940,40)"><rect x="0" y="0" width="240" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="120" y="31.15">{{Gia hạn, hỗ trợ}}</tspan><tspan x="120" y="48.65">BP-NN</tspan></text></g><g class="node" transform="translate(40,180)"><rect x="0" y="0" width="1140" height="60" fill="#f8fafc" stroke="#64748b" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="570" y="34.9">Hoạt động hỗ trợ: {{vận hành, bảo mật, dữ liệu, nội dung}} – BP-NN</tspan></text></g><g class="edge"><path d="M280,75 L330.31,75" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="340,75 328.6,79.79 328.6,70.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M580,75 L630.31,75" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="640,75 628.6,79.79 628.6,70.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M880,75 L930.31,75" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="940,75 928.6,79.79 928.6,70.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g></svg></div>
<!-- /de-diagram:dg-85f2af -->

## 7. Năng lực có nhiều bản cài đặt (khi có nhiều sản phẩm)

| Năng lực | Bản của {{SP1}} | Bản của {{SP2}} | Dùng chung hay riêng | Ảnh hưởng |
|---|---|---|---|---|
| {{Năng lực}} | {{HTC / module}} | {{HTC / module}} | {{CHUNG / TRÙNG LẶP}} | {{Hệ quả}} |

Đề xuất hợp nhất ghi ở [ASM-00 §5](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md).

## 8. Điểm nghẽn nghiệp vụ

1. **{{Vấn đề}}:** {{mô tả, quy trình liên quan BP-NN, rủi ro liên quan}}.

## 9. Vấn đề còn mở

- {{Ví dụ: ai chịu trách nhiệm chính thức cho từng quy trình}}

## 10. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
