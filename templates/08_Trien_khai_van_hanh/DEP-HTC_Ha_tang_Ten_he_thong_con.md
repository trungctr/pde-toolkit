# Hạ tầng riêng – {{Tên hệ thống con}}

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-DEP-HTC-001 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.10 Transition · 6.4.12 Operation · 6.4.13 Maintenance |
| Hệ thống con | HTC – {{Tên hệ thống con}} |
| Nguồn | `{{mã hạ tầng, cấu hình CI, file chạy cục bộ}}` |
| Tài liệu liên quan | ↑ [DEP-00](DEP-00_Trien_khai_tong_the.md) · [SAD-00 §6](../03_Kien_truc/SAD-00_Kien_truc_tong_the.md) · [ADR-HTC](../03_Kien_truc/ADR/ADR-HTC_So_dang_ky_quyet_dinh_kien_truc.md) · ↓ [OPS-00](OPS-00_So_tay_van_hanh.md) · [ASM-00 §9](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md) |

> [!TIP]
> Chỉ cần tài liệu này khi hệ thống con có hạ tầng tách riêng (tài khoản cloud, cụm máy, đường phát hành riêng). Nếu chạy chung hạ tầng, một dòng ở DEP-00 là đủ. Bí mật chỉ ghi tên.

---

## 1. Phạm vi

{{Hạ tầng này phục vụ những thành phần nào, ở những môi trường nào.}}

| Thành phần | Đóng gói thành | Chạy trên | Số bản (ít nhất – nhiều nhất) | Ghi chú |
|---|---|---|---|---|
| {{htc-api}} | `{{kho-image/ten:phien-ban}}` | {{container / máy ảo / serverless}} | {{1 – 4}} | {{…}} |

## 2. Hạ tầng

### 2.1 Mạng và điểm vào

{{Tên miền, chứng chỉ, CDN, cân bằng tải; vùng mạng công khai và riêng.}}

### 2.2 Máy chạy ứng dụng

{{Cụm hoặc máy ảo, tự co giãn theo chỉ số nào, giới hạn bộ nhớ / CPU.}}

### 2.3 Lưu trữ dữ liệu

{{CSDL}} `{{db_htc}}` ([ERD-HTC](../05_Thiet_ke_du_lieu/ERD-HTC_CSDL_Ten_he_thong_con.md)), {{bộ nhớ đệm, kho tệp, nơi lưu bản sao lưu}}.

### 2.4 Quyền truy cập, bí mật và theo dõi

{{Bí mật lưu ở đâu, mỗi dịch vụ được quyền gì, log và chỉ số gửi tới đâu.}}

## 3. Sơ đồ triển khai

<!-- de-diagram:dg-c1d50c {"version":1,"meta":{"name":"Sơ đồ triển khai HTC (UML Deployment)","mode":"flowchart"},"nodes":[{"id":"env","type":"basic.frame","x":40,"y":40,"w":1080,"h":440,"text":"{{Nhà cung cấp hạ tầng}} – môi trường production","style":{}},{"id":"cdn","type":"flow.predefined","x":80,"y":110,"w":220,"h":60,"text":"{{DNS / CDN / WAF}}","style":{}},{"id":"lb","type":"flow.predefined","x":80,"y":300,"w":220,"h":60,"text":"{{Load balancer}}","style":{}},{"id":"app","type":"basic.frame","x":360,"y":90,"w":360,"h":360,"text":"Vùng ứng dụng","style":{}},{"id":"s1","type":"flow.process","x":400,"y":140,"w":280,"h":60,"text":"HTC {{A}} × {{n}}","style":{}},{"id":"s2","type":"flow.process","x":400,"y":250,"w":280,"h":60,"text":"HTC {{B}} × {{n}}","style":{}},{"id":"wk","type":"flow.process","x":400,"y":360,"w":280,"h":60,"text":"Worker / cron × {{n}}","style":{}},{"id":"data","type":"basic.frame","x":760,"y":90,"w":320,"h":360,"text":"Vùng dữ liệu","style":{}},{"id":"pg","type":"flow.database","x":800,"y":130,"w":240,"h":80,"text":"{{PostgreSQL}}","style":{}},{"id":"cache","type":"flow.process","x":800,"y":260,"w":240,"h":60,"text":"{{Cache / hàng đợi}}","style":{}},{"id":"obj","type":"flow.process","x":800,"y":360,"w":240,"h":60,"text":"{{Lưu trữ tệp}}","style":{}}],"edges":[{"id":"e1","type":"flow.arrow","source":"cdn","target":"lb","label":"","style":{"endArrow":"arrow"},"sourcePort":"bottom","targetPort":"top"},{"id":"e2","type":"flow.arrow","source":"lb","target":"s1","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"e3","type":"flow.arrow","source":"lb","target":"s2","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"e4","type":"flow.arrow","source":"s1","target":"pg","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"e5","type":"flow.arrow","source":"s2","target":"cache","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"e6","type":"flow.arrow","source":"wk","target":"obj","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"}]} -->
<div align="center"><svg role="img" aria-label="Sơ đồ triển khai HTC (UML Deployment)" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" width="1128" height="488" viewBox="16 16 1128 488"><title>Sơ đồ triển khai HTC (UML Deployment)</title><defs><filter id="dezg535i-shadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="1.5" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.18"/></filter></defs><rect x="16" y="16" width="1128" height="488" fill="#ffffff"/><g class="node" transform="translate(40,40)"><rect x="0" y="0" width="1080" height="440" rx="6" fill="none" stroke="#64748b" stroke-width="1.5"/><path d="M0,6 Q0,0 6,0 H355.69 V22 Q355.69,28 349.69,28 H0 Z" fill="#64748b" fill-opacity="0.12" stroke="none"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve" font-weight="bold"><tspan x="12" y="18.9">{{Nhà cung cấp hạ tầng}} – môi trường production</tspan></text></g><g class="node" transform="translate(80,110)"><rect x="0" y="0" width="220" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><line x1="12" y1="0" x2="12" y2="60" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><line x1="208" y1="0" x2="208" y2="60" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="34.9">{{DNS / CDN / WAF}}</tspan></text></g><g class="node" transform="translate(80,300)"><rect x="0" y="0" width="220" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><line x1="12" y1="0" x2="12" y2="60" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><line x1="208" y1="0" x2="208" y2="60" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="34.9">{{Load balancer}}</tspan></text></g><g class="node" transform="translate(360,90)"><rect x="0" y="0" width="360" height="360" rx="6" fill="none" stroke="#64748b" stroke-width="1.5"/><path d="M0,6 Q0,0 6,0 H127.06 V22 Q127.06,28 121.06,28 H0 Z" fill="#64748b" fill-opacity="0.12" stroke="none"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve" font-weight="bold"><tspan x="12" y="18.9">Vùng ứng dụng</tspan></text></g><g class="node" transform="translate(400,140)"><rect x="0" y="0" width="280" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="140" y="34.9">HTC {{A}} × {{n}}</tspan></text></g><g class="node" transform="translate(400,250)"><rect x="0" y="0" width="280" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="140" y="34.9">HTC {{B}} × {{n}}</tspan></text></g><g class="node" transform="translate(400,360)"><rect x="0" y="0" width="280" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="140" y="34.9">Worker / cron × {{n}}</tspan></text></g><g class="node" transform="translate(760,90)"><rect x="0" y="0" width="320" height="360" rx="6" fill="none" stroke="#64748b" stroke-width="1.5"/><path d="M0,6 Q0,0 6,0 H108.31 V22 Q108.31,28 102.31,28 H0 Z" fill="#64748b" fill-opacity="0.12" stroke="none"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="start" xml:space="preserve" font-weight="bold"><tspan x="12" y="18.9">Vùng dữ liệu</tspan></text></g><g class="node" transform="translate(800,130)"><path d="M0,12 A120,12 0 0 1 240,12 V68 A120,12 0 0 1 0,68 Z" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><path d="M0,12 A120,12 0 0 0 240,12" fill="none" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="120" y="50.9">{{PostgreSQL}}</tspan></text></g><g class="node" transform="translate(800,260)"><rect x="0" y="0" width="240" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="120" y="34.9">{{Cache / hàng đợi}}</tspan></text></g><g class="node" transform="translate(800,360)"><rect x="0" y="0" width="240" height="60" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="120" y="34.9">{{Lưu trữ tệp}}</tspan></text></g><g class="edge"><path d="M190,170 L190,290.31" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="190,300 185.21,288.6 194.79,288.6" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M300,330 L344,330 Q350,330 350,324 L350,176 Q350,170 356,170 L390.31,170" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="400,170 388.6,174.79 388.6,165.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M300,330 L344,330 Q350,330 350,324 L350,286 Q350,280 356,280 L390.31,280" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="400,280 388.6,284.79 388.6,275.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M680,170 L790.31,170" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="800,170 788.6,174.79 788.6,165.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M680,280 L735,280 Q740,280 740,285 L740,285 Q740,290 745,290 L790.31,290" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="800,290 788.6,294.79 788.6,285.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M680,390 L790.31,390" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="800,390 788.6,394.79 788.6,385.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g></svg></div>
<!-- /de-diagram:dg-c1d50c -->

## 4. Môi trường

| Môi trường | Tài khoản / cụm | Tên miền | Ghi chú |
|---|---|---|---|
| {{Máy lập trình viên}} | {{Cách chạy}} | {{localhost}} | {{Dữ liệu mẫu}} |
| {{Thử nghiệm}} | {{…}} | {{…}} | {{…}} |
| {{Chính thức}} | {{…}} | {{…}} | {{…}} |

## 5. Đường phát hành

| Luồng | Chạy khi | Các bước | Đưa lên |
|---|---|---|---|
| `{{deploy.yml}}` | {{Gộp vào nhánh chính}} | {{build → kiểm thử ([STP-00 §8](../07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md)) → đóng gói → triển khai}} | {{…}} |

## 6. Cổng và biến môi trường (chỉ tên)

| Thành phần | Cổng | Mở ra ngoài | Biến môi trường | Lấy từ |
|---|---|---|---|---|
| {{htc-api}} | {{port}} | {{Qua cân bằng tải}} | `{{DB_PASSWORD}}` | {{Kho bí mật}} |

## 7. Vận hành

- **Đổi cấu trúc CSDL:** {{theo [DEP-00 §7](DEP-00_Trien_khai_tong_the.md)}}
- **Co giãn:** {{…}}
- **Sao lưu và khôi phục:** {{bao lâu một lần, giữ bao lâu, lần thử khôi phục gần nhất}}
- **Theo dõi và sự cố:** {{cảnh báo nào gửi tới ai; cách xử lý sự cố thường gặp ở [OPS-00 §3](OPS-00_So_tay_van_hanh.md)}}

## 8. Rủi ro vận hành

| ID | Mô tả | Mức | Liên quan |
|---|---|---|---|
| TD-HTC-01 | {{…}} | {{…}} | [SDD-HTC §10](../04_Thiet_ke_chi_tiet/SDD-HTC_Ten_he_thong_con.md) |

## 9. Vấn đề còn mở

- {{…}}

## 10. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
