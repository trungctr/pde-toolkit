# Hướng dẫn triển khai tổng thể

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-DEP-000 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.10 Transition · 6.4.12 Operation |
| Hệ thống con | {{Danh sách HTC}} (HTC có hạ tầng riêng: xem [DEP-HTC](DEP-HTC_Ha_tang_Ten_he_thong_con.md)) |
| Nguồn | `{{cấu hình tiến trình, CI, README}}` |
| Tài liệu liên quan | ↑ [SAD-00 §6](../03_Kien_truc/SAD-00_Kien_truc_tong_the.md) · [STP-00 §7–§8](../07_Kiem_thu/STP-00_Ke_hoach_kiem_thu.md) · [DBD-00](../05_Thiet_ke_du_lieu/DBD-00_Tong_quan_du_lieu.md) · ↓ [DEP-HTC](DEP-HTC_Ha_tang_Ten_he_thong_con.md) · [OPS-00](OPS-00_So_tay_van_hanh.md) |

> Biến môi trường chỉ được nhắc bằng tên; giá trị nằm trong kho bí mật, không nằm ở đây.

> [!TIP]
> Sơ đồ triển khai không vẽ lại ở đây – dùng [SAD-00 §6](../03_Kien_truc/SAD-00_Kien_truc_tong_the.md). Nếu quy trình phát hành được mô hình hoá thành quy trình nghiệp vụ (`BP-8x`), liên kết tới tài liệu BPMN tương ứng ở §6.

---

## 1. Môi trường

| Môi trường | HTC – {{Tên}} | {{HTC2}} |
|---|---|---|
| Local | {{Cách chạy, file env}} | {{…}} |
| Staging | {{…}} | {{…}} |
| Production | {{…}} | {{…}} |

## 2. Bố trí trên máy chủ / cụm

```text
{{/duong/dan/goc}}
├── {{repo-1}}/
└── {{repo-2}}/
```

## 3. Các tiến trình chạy

| Tiến trình | Thư mục | Cổng | Lệnh chạy | Số bản | Giới hạn bộ nhớ / CPU | Ghi chú |
|---|---|---|---|---|---|---|
| `{{htc-api}}` | `{{…}}` | {{port}} | `{{…}}` | {{1}} | {{500 MB}} | HTC |

## 4. Đường dẫn nào đi tới đâu

| Đường dẫn | Tới | Môi trường | Ghi chú |
|---|---|---|---|
| `/{{prefix}}` | HTC :{{port}} | {{local / production}} | [ICD-00 §2](../06_Giao_dien_tich_hop/ICD-00_Tong_quan_tich_hop.md) |

## 5. Biến môi trường (chỉ tên)

| Nhóm | Biến | Dùng ở |
|---|---|---|
| Xác thực | `{{JWT_SECRET}}` | {{HTC}} |
| CSDL | `{{DB_HOST}}`, `{{DB_NAME}}` | {{HTC}} |
| Tích hợp | `{{THIRD_PARTY_API_KEY}}` | {{I-02}} |

## 6. Quy trình phát hành

<!-- de-diagram:dg-e5afcc {"version":1,"meta":{"name":"Quy trình phát hành","mode":"flowchart"},"nodes":[{"id":"s","type":"flow.terminator","x":40,"y":61,"w":220,"h":58,"text":"Merge vào nhánh phát hành","style":{}},{"id":"p1","type":"flow.process","x":320,"y":55,"w":200,"h":70,"text":"CI đạt (STP-00 §8)","style":{}},{"id":"p2","type":"flow.process","x":580,"y":55,"w":200,"h":70,"text":"Đóng gói, gắn phiên bản","style":{}},{"id":"p3","type":"flow.process","x":840,"y":55,"w":200,"h":70,"text":"Thay đổi CSDL (§7)","style":{}},{"id":"p4","type":"flow.process","x":1100,"y":55,"w":200,"h":70,"text":"Triển khai","style":{}},{"id":"p5","type":"flow.process","x":1090,"y":230,"w":220,"h":70,"text":"Kiểm tra sức khoẻ (OPS-00 §6)","style":{}},{"id":"d","type":"flow.decision","x":820,"y":223,"w":180,"h":84,"text":"Ổn định?","style":{}},{"id":"k","type":"flow.terminator","x":540,"y":236,"w":200,"h":58,"text":"Ghi nhận phát hành","style":{}},{"id":"rb","type":"flow.process","x":820,"y":380,"w":180,"h":70,"text":"Rollback (OPS-00 §3)","style":{}}],"edges":[{"id":"e1","type":"flow.arrow","source":"s","target":"p1","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"e2","type":"flow.arrow","source":"p1","target":"p2","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"e3","type":"flow.arrow","source":"p2","target":"p3","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"e4","type":"flow.arrow","source":"p3","target":"p4","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"e5","type":"flow.arrow","source":"p4","target":"p5","label":"","style":{"endArrow":"arrow"},"sourcePort":"bottom","targetPort":"top"},{"id":"e6","type":"flow.arrow","source":"p5","target":"d","label":"","style":{"endArrow":"arrow"},"sourcePort":"left","targetPort":"right"},{"id":"e7","type":"flow.arrow","source":"d","target":"k","label":"Có","style":{"endArrow":"arrow"},"sourcePort":"left","targetPort":"right"},{"id":"e8","type":"flow.arrow","source":"d","target":"rb","label":"Không","style":{"endArrow":"arrow"},"sourcePort":"bottom","targetPort":"top"}]} -->
<div align="center"><svg role="img" aria-label="Quy trình phát hành" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" width="1318" height="443" viewBox="16 31 1318 443"><title>Quy trình phát hành</title><defs><filter id="dek9o8ti-shadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="1.5" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.18"/></filter></defs><rect x="16" y="31" width="1318" height="443" fill="#ffffff"/><g class="node" transform="translate(40,61)"><rect x="0" y="0" width="220" height="58" rx="29" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="33.9">Merge vào nhánh phát hành</tspan></text></g><g class="node" transform="translate(320,55)"><rect x="0" y="0" width="200" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="100" y="39.9">CI đạt (STP-00 §8)</tspan></text></g><g class="node" transform="translate(580,55)"><rect x="0" y="0" width="200" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="100" y="39.9">Đóng gói, gắn phiên bản</tspan></text></g><g class="node" transform="translate(840,55)"><rect x="0" y="0" width="200" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="100" y="39.9">Thay đổi CSDL (§7)</tspan></text></g><g class="node" transform="translate(1100,55)"><rect x="0" y="0" width="200" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="100" y="39.9">Triển khai</tspan></text></g><g class="node" transform="translate(1090,230)"><rect x="0" y="0" width="220" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="39.9">Kiểm tra sức khoẻ (OPS-00 §6)</tspan></text></g><g class="node" transform="translate(820,223)"><polygon points="90,0 180,42 90,84 0,42" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="90" y="46.9">Ổn định?</tspan></text></g><g class="node" transform="translate(540,236)"><rect x="0" y="0" width="200" height="58" rx="29" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="100" y="33.9">Ghi nhận phát hành</tspan></text></g><g class="node" transform="translate(820,380)"><rect x="0" y="0" width="180" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="90" y="39.9">Rollback (OPS-00 §3)</tspan></text></g><g class="edge"><path d="M260,90 L310.31,90" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="320,90 308.6,94.79 308.6,85.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M520,90 L570.31,90" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="580,90 568.6,94.79 568.6,85.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M780,90 L830.31,90" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="840,90 828.6,94.79 828.6,85.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M1040,90 L1090.31,90" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="1100,90 1088.6,94.79 1088.6,85.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M1200,125 L1200,220.31" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="1200,230 1195.21,218.6 1204.79,218.6" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M1090,265 L1009.69,265" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="1000,265 1011.4,260.21 1011.4,269.79" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M820,265 L749.69,265" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="740,265 751.4,260.21 751.4,269.79" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="767.77" y="255.5" width="24.46" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="780" y="269.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">Có</text></g><g class="edge"><path d="M910,307 L910,370.31" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="910,380 905.21,368.6 914.79,368.6" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="887.68" y="334" width="44.64" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="910" y="347.7" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">Không</text></g></svg></div>
<!-- /de-diagram:dg-e5afcc -->

### 6.1 HTC – {{Tên}}

{{Luồng phát hành tự động, nhánh nào, đưa lên đâu, ai duyệt.}}

| Lưu ý | Chi tiết |
|---|---|
| {{…}} | {{…}} |

## 7. Đổi cấu trúc CSDL khi phát hành

| Hệ thống | Cách làm | Ai chạy, khi nào | Quay lại thế nào |
|---|---|---|---|
| HTC (`{{db_htc}}`) | {{Migration tự động / SQL thủ công}} | {{…}} | {{…}} |

Danh sách CSDL và ai được đổi cấu trúc: [DBD-00 §3](../05_Thiet_ke_du_lieu/DBD-00_Tong_quan_du_lieu.md).

## 8. Vấn đề còn mở

- {{…}}

## 9. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
