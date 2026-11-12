# Đặc tả yêu cầu phần mềm – {{Tên hệ thống con}}

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-SRS-HTC-001 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.3 System/Software Requirements Definition |
| Chuẩn tham chiếu | ISO/IEC/IEEE 29148 §9.5 |
| Hệ thống con | HTC – {{Tên hệ thống con}} |
| Nguồn đã khảo sát | `{{repo/duong-dan}}` |
| Tài liệu liên quan | ↑ [StRS-00](StRS-00_Yeu_cau_cac_ben_lien_quan.md) · [SyRS-00](SyRS-00_Yeu_cau_he_thong.md) · [BPMN-NN](../01_Phan_tich_nghiep_vu/BPMN-NN_Ten_quy_trinh.md) · ↓ [SDD-HTC](../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md) · [ERD-HTC](../05_Thiet_ke_du_lieu/ERD-HTC_CSDL_Ten_he_thong_con.md) · [API-HTC](../06_Giao_dien_tich_hop/API-HTC_Ten_he_thong_con.md) · [STP-00](../07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md) · ⇄ [RTM-00](../00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md) |

> [!TIP]
> **Nhân bản** cho mỗi hệ thống con: đổi `HTC` trong tên file và nội dung, đổi `MOD` thành mã module thật. Đây là nơi định nghĩa `A-`, `UC-HTC-`, `FR-HTC-`, `NFR-HTC-`, `BR-HTC-`. Mỗi use case trỏ lên một quy trình (`BP-nn`); mỗi FR trỏ lên một use case và một chức năng hệ thống (`SYS-F`).

---

## 1. Giới thiệu

### 1.1 Mục đích

Liệt kê những gì hệ thống con HTC – {{Tên hệ thống con}} phải làm, đủ chi tiết để thiết kế và kiểm thử. {{Nếu viết từ hệ thống đang chạy: mỗi yêu cầu kèm vị trí trong mã.}}

### 1.2 Phạm vi

| Mã module | Thành phần | Cổng | Chức năng chính | Chức năng hệ thống |
|---|---|---|---|---|
| `MOD` | {{Dịch vụ / module}} | {{port}} | {{…}} | SYS-F01 |

Không thuộc tài liệu này: {{…}} – chỉ nhắc tới ở chỗ HTC gọi sang.

### 1.3 Định nghĩa

| Thuật ngữ | Nghĩa |
|---|---|
| {{Thuật ngữ riêng của HTC}} | {{…}} |

Thuật ngữ dùng chung: [GLOSSARY](../00_Quan_ly_tai_lieu/GLOSSARY_Thuat_ngu.md).

### 1.4 Tài liệu tham chiếu

[CONV](../00_Quan_ly_tai_lieu/CONV_Quy_uoc_tai_lieu_va_ky_hieu.md), [SDD-HTC](../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md) (thiết kế), [ERD-HTC](../05_Thiet_ke_du_lieu/ERD-HTC_CSDL_Ten_he_thong_con.md) (dữ liệu), [API-HTC](../06_Giao_dien_tich_hop/API-HTC_Ten_he_thong_con.md) (giao diện).

---

## 2. Mô tả tổng quan

### 2.1 Bối cảnh sản phẩm

<!-- de-diagram:dg-234214 {"version":1,"meta":{"name":"Bối cảnh hệ thống con HTC","mode":"flowchart"},"nodes":[{"id":"sys","type":"flow.process","x":400,"y":190,"w":260,"h":80,"text":"HTC – {{Tên hệ thống con}}","style":{"fill":"#eff6ff","stroke":"#2563eb"}},{"id":"u","type":"flow.process","x":40,"y":60,"w":220,"h":60,"text":"A-USR {{Người dùng}}","style":{}},{"id":"ad","type":"flow.process","x":40,"y":320,"w":220,"h":60,"text":"A-ADM {{Quản trị}}","style":{}},{"id":"o","type":"flow.predefined","x":800,"y":60,"w":220,"h":60,"text":"Hệ thống con khác: {{tên}}","style":{}},{"id":"x","type":"flow.predefined","x":800,"y":320,"w":220,"h":60,"text":"Hệ thống ngoài: {{tên}}","style":{}},{"id":"db","type":"flow.database","x":430,"y":380,"w":200,"h":80,"text":"CSDL {{db_htc}}","style":{}}],"edges":[{"id":"e1","type":"flow.arrow","source":"u","target":"sys","label":"Giao diện / REST","style":{"endArrow":"arrow"}},{"id":"e2","type":"flow.arrow","source":"ad","target":"sys","label":"Giao diện quản trị","style":{"endArrow":"arrow"}},{"id":"e3","type":"flow.arrow","source":"sys","target":"o","label":"I-01","style":{"endArrow":"arrow"}},{"id":"e4","type":"flow.arrow","source":"sys","target":"x","label":"I-02","style":{"endArrow":"arrow"}},{"id":"e5","type":"flow.arrow","source":"sys","target":"db","label":"SQL","style":{"endArrow":"arrow"},"sourcePort":"bottom","targetPort":"top"}]} -->
<div align="center"><svg role="img" aria-label="Bối cảnh hệ thống con HTC" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" width="1028" height="448" viewBox="16 36 1028 448"><title>Bối cảnh hệ thống con HTC</title><defs><filter id="dedpf8wq-shadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="1.5" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.18"/></filter></defs><rect x="16" y="36" width="1028" height="448" fill="#ffffff"/><g class="node" transform="translate(400,190)"><rect x="0" y="0" width="260" height="80" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="130" y="44.9">HTC – {{Tên hệ thống con}}</tspan></text></g><g class="node" transform="translate(40,60)"><rect x="0" y="0" width="220" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="34.9">A-USR {{Người dùng}}</tspan></text></g><g class="node" transform="translate(40,320)"><rect x="0" y="0" width="220" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="34.9">A-ADM {{Quản trị}}</tspan></text></g><g class="node" transform="translate(800,60)"><rect x="0" y="0" width="220" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><line x1="12" y1="0" x2="12" y2="60" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><line x1="208" y1="0" x2="208" y2="60" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="34.9">Hệ thống con khác: {{tên}}</tspan></text></g><g class="node" transform="translate(800,320)"><rect x="0" y="0" width="220" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><line x1="12" y1="0" x2="12" y2="60" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><line x1="208" y1="0" x2="208" y2="60" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="34.9">Hệ thống ngoài: {{tên}}</tspan></text></g><g class="node" transform="translate(430,380)"><path d="M0,12 A100,12 0 0 1 200,12 V68 A100,12 0 0 1 0,68 Z" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><path d="M0,12 A100,12 0 0 0 200,12" fill="none" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="100" y="50.9">CSDL {{db_htc}}</tspan></text></g><g class="edge"><path d="M150,120 L150,149 Q150,155 156,155 L524,155 Q530,155 530,161 L530,180.31" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="530,190 525.21,178.6 534.79,178.6" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="291.12" y="145.5" width="97.76" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="340" y="159.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">Giao diện / REST</text></g><g class="edge"><path d="M150,320 L150,301 Q150,295 156,295 L524,295 Q530,295 530,289 L530,279.69" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="530,270 534.79,281.4 525.21,281.4" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="287.46" y="285.5" width="105.07" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="340" y="299.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">Giao diện quản trị</text></g><g class="edge"><path d="M530,190 L530,161 Q530,155 536,155 L904,155 Q910,155 910,149 L910,129.69" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="910,120 914.79,131.4 905.21,131.4" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="704.54" y="145.5" width="30.93" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="720" y="159.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">I-01</text></g><g class="edge"><path d="M530,270 L530,289 Q530,295 536,295 L904,295 Q910,295 910,301 L910,310.31" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="910,320 905.21,308.6 914.79,308.6" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="704.54" y="285.5" width="30.93" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="720" y="299.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">I-02</text></g><g class="edge"><path d="M530,270 L530,370.31" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="530,380 525.21,368.6 534.79,368.6" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="514.46" y="315.5" width="31.07" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="530" y="329.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">SQL</text></g></svg></div>
<!-- /de-diagram:dg-234214 -->

| Thành phần | Dùng cho | Dùng chung hay riêng | Căn cứ |
|---|---|---|---|
| {{Thành phần}} | {{SP / CHUNG / TRÙNG LẶP}} | {{Một bản dùng chung / có bản riêng ở …}} | `{{nguồn}}` |

### 2.2 Tác nhân

| Mã | Tác nhân | Mô tả |
|---|---|---|
| A-USR | {{Người dùng}} | {{Điều kiện: đã đăng nhập, vai trò…}} |
| A-ADM | {{Quản trị}} | {{…}} |

### 2.3 Ràng buộc

- {{Ngôn ngữ, framework, CSDL, giới hạn triển khai}}

### 2.4 Giả định và phụ thuộc

- {{Phụ thuộc vào hệ thống con khác qua I-01, …}}

---

## 3. Sơ đồ Use Case

### 3.1 Nhóm `MOD`

<!-- de-diagram:dg-0e341b {"version":1,"meta":{"name":"Use case – HTC nhóm MOD","mode":"uml"},"nodes":[{"id":"a1","type":"uml.actor","x":80,"y":110,"w":40,"h":80,"text":"A-USR {{Người dùng}}","style":{}},{"id":"a2","type":"uml.actor","x":80,"y":330,"w":40,"h":80,"text":"A-ADM {{Quản trị}}","style":{}},{"id":"b","type":"uml.systemBoundary","x":240,"y":40,"w":620,"h":420,"text":"HTC – {{Nhóm chức năng MOD}}","style":{}},{"id":"u1","type":"uml.useCase","x":270,"y":90,"w":260,"h":66,"text":"UC-HTC-01 {{Tên use case}}","style":{}},{"id":"u2","type":"uml.useCase","x":270,"y":220,"w":260,"h":66,"text":"UC-HTC-02 {{Tên use case}}","style":{}},{"id":"u3","type":"uml.useCase","x":270,"y":350,"w":260,"h":66,"text":"UC-HTC-03 {{Use case quản trị}}","style":{}},{"id":"u4","type":"uml.useCase","x":580,"y":155,"w":250,"h":66,"text":"UC-HTC-04 {{Use case dùng chung}}","style":{}}],"edges":[{"id":"e1","type":"uml.association","source":"a1","target":"u1","label":"","style":{},"routing":"straight"},{"id":"e2","type":"uml.association","source":"a1","target":"u2","label":"","style":{},"routing":"straight"},{"id":"e3","type":"uml.association","source":"a2","target":"u3","label":"","style":{},"routing":"straight"},{"id":"e4","type":"uml.include","source":"u1","target":"u4","label":"«include»","style":{},"routing":"straight"},{"id":"e5","type":"uml.include","source":"u2","target":"u4","label":"«include»","style":{},"routing":"straight"}]} -->
<div align="center"><svg role="img" aria-label="Use case – HTC nhóm MOD" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" width="878" height="468" viewBox="6.17 16 878 468"><title>Use case – HTC nhóm MOD</title><defs><filter id="defsqhg4-shadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="1.5" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.18"/></filter></defs><rect x="6.17" y="16" width="878" height="468" fill="#ffffff"/><g class="node" transform="translate(80,110)"><ellipse cx="20" cy="9.8" rx="8.8" ry="8.8" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><line x1="20" y1="18.6" x2="20" y2="49.6" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><line x1="2" y1="28.8" x2="38" y2="28.8" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><line x1="20" y1="49.6" x2="4.8" y2="80" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><line x1="20" y1="49.6" x2="35.2" y2="80" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="20" y="97.65">A-USR {{Người dùng}}</tspan></text></g><g class="node" transform="translate(80,330)"><ellipse cx="20" cy="9.8" rx="8.8" ry="8.8" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><line x1="20" y1="18.6" x2="20" y2="49.6" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><line x1="2" y1="28.8" x2="38" y2="28.8" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><line x1="20" y1="49.6" x2="4.8" y2="80" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><line x1="20" y1="49.6" x2="35.2" y2="80" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="20" y="97.65">A-ADM {{Quản trị}}</tspan></text></g><g class="node" transform="translate(240,40)"><rect x="0" y="0" width="620" height="420" fill="none" stroke="#475569" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve" font-weight="bold"><tspan x="310" y="21.65">HTC – {{Nhóm chức năng MOD}}</tspan></text></g><g class="node" transform="translate(270,90)"><ellipse cx="130" cy="33" rx="130" ry="33" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="130" y="37.9">UC-HTC-01 {{Tên use case}}</tspan></text></g><g class="node" transform="translate(270,220)"><ellipse cx="130" cy="33" rx="130" ry="33" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="130" y="37.9">UC-HTC-02 {{Tên use case}}</tspan></text></g><g class="node" transform="translate(270,350)"><ellipse cx="130" cy="33" rx="130" ry="33" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="130" y="37.9">UC-HTC-03 {{Use case quản trị}}</tspan></text></g><g class="node" transform="translate(580,155)"><ellipse cx="125" cy="33" rx="125" ry="33" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="125" y="29.15">UC-HTC-04 {{Use case dùng</tspan><tspan x="125" y="46.65">chung}}</tspan></text></g><g class="edge"><path d="M120,150 L270,123" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/></g><g class="edge"><path d="M120,150 L400,220" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/></g><g class="edge"><path d="M120,370 L270,383" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/></g><g class="edge"><path d="M530,123 L580,188" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-dasharray="8 5"/><polyline points="568.53,182.44 580,188 577.57,175.49" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="524.79" y="146" width="60.42" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="555" y="159.7" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">«include»</text></g><g class="edge"><path d="M530,253 L580,188" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-dasharray="8 5"/><polyline points="577.57,200.51 580,188 568.53,193.56" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="524.79" y="211" width="60.42" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="555" y="224.7" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">«include»</text></g></svg></div>
<!-- /de-diagram:dg-0e341b -->

---

## 4. Đặc tả Use Case chính

### UC-HTC-01 {{Tên use case}}

| Mục | Nội dung |
|---|---|
| Tác nhân | A-USR. Phụ: {{hệ thống khác}} |
| Quy trình | [BP-NN](../01_Phan_tich_nghiep_vu/BPMN-NN_Ten_quy_trinh.md) bước `t1`–`t4` |
| Tiền điều kiện | {{…}} |
| Luồng chính | 1. {{…}} 2. {{…}} 3. Kiểm tra BR-HTC-001. 4. {{Ghi `ten_bang`}} |
| Luồng thay thế | {{…}} |
| Ngoại lệ | {{Vi phạm BR-HTC-001 → 422}} |
| Hậu điều kiện | {{Bản ghi `ten_bang` ở trạng thái `moi_tao`}} |
| Yêu cầu | FR-HTC-MOD-001 |
| Thiết kế | [SDD-HTC](../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md) SEQ-01 |
| Nguồn | `{{duong/dan/controller#ham}}` |

### UC-HTC-02 {{Tên use case}}

| Mục | Nội dung |
|---|---|
| Tác nhân | A-USR |
| Quy trình | – ({{không có quy trình riêng, lý do}}) |
| Luồng chính | {{…}} |
| Hậu điều kiện | {{…}} |
| Yêu cầu | FR-HTC-MOD-002 |
| Thiết kế | SDD-HTC STM-01 |
| Nguồn | `{{…}}` |

> [!TIP]
> Đặc tả đầy đủ cho use case chính; use case đơn giản (UC-HTC-03, UC-HTC-04 trong sơ đồ) chỉ cần xuất hiện trong bảng FR §5. Mỗi use case trên sơ đồ phải có ít nhất một FR.

---

## 5. Yêu cầu chức năng

### 5.1 `MOD`

| ID | Mô tả | UC | SYS | Ưu tiên | Nguồn |
|---|---|---|---|---|---|
| FR-HTC-MOD-001 | {{Hệ thống cho phép … ; kiểm tra BR-HTC-001}} | UC-HTC-01 | SYS-F01 | {{Cao}} | `{{file#ham}}` |
| FR-HTC-MOD-002 | {{Chuyển trạng thái theo STM-01; huỷ theo BR-HTC-002}} | UC-HTC-02 | SYS-F01 | {{Trung bình}} | `{{…}}` |
| FR-HTC-MOD-003 | {{Quản trị …}} | UC-HTC-03 | SYS-F01 | {{…}} | `{{…}}` |
| FR-HTC-MOD-004 | {{Chức năng dùng chung, ví dụ kiểm tra quyền, gửi thông báo}} | UC-HTC-04 | SYS-F01 | {{…}} | `{{…}}` |

Truy vết xuống thiết kế, dữ liệu, giao diện và kiểm thử: [RTM-00 §3](../00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md).

---

## 6. Yêu cầu phi chức năng

| ID | Yêu cầu | Chỉ tiêu | SYS | Nguồn |
|---|---|---|---|---|
| NFR-HTC-001 | {{Mọi endpoint chỉ trả dữ liệu thuộc tổ chức của người gọi}} | {{…}} | SYS-N01 | `{{guard / middleware}}` |

---

## 7. Quy tắc nghiệp vụ

| ID | Quy tắc | Áp dụng tại | Nguồn |
|---|---|---|---|
| BR-HTC-001 | {{Điều kiện để tạo / chấp nhận yêu cầu}} | BP-NN `t3`; FR-HTC-MOD-001 | `{{file#ham}}` |
| BR-HTC-002 | {{Điều kiện được huỷ}} | FR-HTC-MOD-002; STM-01 | `{{…}}` |

---

## 8. Vấn đề còn mở

1. {{Hành vi chưa rõ là cố ý hay sơ suất – cần hỏi người phụ trách}}

## 9. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
