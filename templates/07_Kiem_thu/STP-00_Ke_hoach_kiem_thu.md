# Kế hoạch kiểm thử tổng thể (Software Test Plan)

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | PRJ-STP-000 |
| Phiên bản | 0.1 |
| Ngày | YYYY-MM-DD |
| Trạng thái | Dự thảo |
| Quy trình ISO/IEC/IEEE 12207 | 6.4.9 Verification · 6.4.11 Validation |
| Chuẩn tham chiếu | ISO/IEC/IEEE 29119-3 |
| Tài liệu liên quan | ↑ [SRS-HTC](../02_Yeu_cau/SRS-HTC_Ten_he_thong_con.md) · [BPMN-NN](../01_Phan_tich_nghiep_vu/BPMN-NN_Ten_quy_trinh.md) · [API-HTC](../06_Giao_dien_tich_hop/API-HTC_Ten_he_thong_con.md) · [ASM-00 §3](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md) · ↓ [DEP-00 §6](../08_Trien_khai_van_hanh/DEP-00_Trien_khai_tong_the.md) · ⇄ [RTM-00](../00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md) |

> [!TIP]
> Nơi định nghĩa `TS-nn`. Mỗi bộ kiểm thử ghi rõ nó **chứng minh** mã nào (FR, NFR, BR, BP, SEC). Mỗi quy trình cần hai kịch bản: đi hết đường thuận lợi, và đi vào nhánh lỗi quan trọng nhất (§5).

---

## 1. Mục tiêu

Cho biết hệ thống PRJ được kiểm thử ở đâu, bằng gì, theo thứ tự ưu tiên nào, và mỗi bộ kiểm thử chứng minh yêu cầu hay rủi ro nào ([RTM-00](../00_Quan_ly_tai_lieu/RTM-00_Ma_tran_truy_vet.md)).

## 2. Đang có gì

| Hệ thống | Công cụ | Số lượng | Loại | Đã có test cho | Còn thiếu |
|---|---|---|---|---|---|
| HTC – {{Tên}} | {{Jest / PHPUnit / pytest}} | {{n file, n test}} | {{Unit / integration / E2E}} | {{…}} | {{…}} |

## 3. Chiến lược kiểm thử

### 3.1 Nguyên tắc

1. **Test chỗ dễ hỏng và đắt nhất trước**: rủi ro mức cao ở [ASM-00 §3](../09_Danh_gia_hien_trang/ASM-00_Danh_gia_hien_trang.md), luồng liên quan tới tiền hoặc dữ liệu cá nhân.
2. **Mỗi FR có ít nhất một test**; mỗi BR có một test đi vào nhánh bị từ chối.
3. {{Trước khi sửa mã cũ, viết test ghi lại hành vi hiện tại}}

### 3.2 Cấp độ và loại kiểm thử

| Cấp độ | Kiểm tra gì | Công cụ | Ai viết |
|---|---|---|---|
| Unit | {{Logic service, máy trạng thái STM, thuật toán ACT}} | {{…}} | {{Đội HTC}} |
| Integration | {{Repository, migration, giao dịch}} | {{Testcontainers…}} | {{…}} |
| Contract / API | {{Endpoint theo API-HTC, tích hợp I-nn}} | {{…}} | {{…}} |
| E2E | {{Quy trình BP-nn}} | {{Playwright…}} | {{QA}} |
| Bảo mật | {{Phân quyền, tách dữ liệu giữa các tổ chức, quét bí mật}} | {{…}} | {{…}} |

## 4. Bộ kiểm thử

| Mã | Bộ kiểm thử | Ưu tiên | Chứng minh | Kiểm tra những gì | Trạng thái |
|---|---|---|---|---|---|
| TS-01 | {{Quyền truy cập}} | P0 | SEC-01, NFR-HTC-001, SYS-N01, BP-NN | {{Gọi từng endpoint khi chưa đăng nhập, bằng tài khoản của tổ chức khác và bằng vai trò thấp – phải bị từ chối}} | {{Chưa có}} |
| TS-02 | {{Chức năng `MOD` của HTC}} | P1 | FR-HTC-MOD-001, FR-HTC-MOD-002, BR-HTC-001, BR-HTC-002, UC-HTC-01 | {{Tạo hợp lệ; vi phạm BR-HTC-001 → 422; chuyển trạng thái theo STM-01}} | {{…}} |

## 5. Kịch bản đầu-cuối theo quy trình

| Quy trình | Đường thuận lợi | Nhánh lỗi quan trọng nhất | Bộ TS |
|---|---|---|---|
| [BP-NN](../01_Phan_tich_nghiep_vu/BPMN-NN_Ten_quy_trinh.md) | {{`s` → `t1` → … → `e`: kết quả mong đợi}} | {{`g1` = Không → `e1`: báo lỗi, không ghi dữ liệu}} | TS-02 |

## 6. Môi trường và dữ liệu kiểm thử

| Môi trường | Hiện nay | Nên có |
|---|---|---|
| Local | {{…}} | {{…}} |
| Staging | {{…}} | {{CSDL riêng, dữ liệu mẫu tự sinh}} |

## 7. Tiêu chí vào / ra

| Loại | Tiêu chí |
|---|---|
| Bắt đầu kiểm thử khi | {{Build xanh; script CSDL đã chạy thử trên bản sao; quét bí mật sạch}} |
| Được phát hành khi | {{Mọi bộ P0 đạt; không còn lỗi mức Cao trở lên; kịch bản đầu-cuối của các quy trình chính chạy qua}} |

## 8. Chạy tự động (CI)

<!-- de-diagram:dg-e7e9b0 {"version":1,"meta":{"name":"Chạy kiểm thử tự động","mode":"flowchart"},"nodes":[{"id":"s","type":"flow.terminator","x":40,"y":61,"w":200,"h":58,"text":"Push / pull request","style":{}},{"id":"p1","type":"flow.process","x":300,"y":55,"w":200,"h":70,"text":"Build + lint","style":{}},{"id":"p2","type":"flow.process","x":560,"y":55,"w":220,"h":70,"text":"Unit + integration (TS-…)","style":{}},{"id":"p3","type":"flow.process","x":840,"y":55,"w":220,"h":70,"text":"Quét bí mật, phụ thuộc","style":{}},{"id":"d","type":"flow.decision","x":1120,"y":48,"w":160,"h":84,"text":"Đạt?","style":{}},{"id":"p4","type":"flow.process","x":1100,"y":230,"w":200,"h":70,"text":"Triển khai staging","style":{}},{"id":"p5","type":"flow.process","x":820,"y":230,"w":200,"h":70,"text":"E2E theo BP (§5)","style":{}},{"id":"k","type":"flow.terminator","x":540,"y":236,"w":240,"h":58,"text":"Sẵn sàng phát hành (DEP-00 §6)","style":{}},{"id":"x","type":"flow.process","x":1360,"y":55,"w":200,"h":70,"text":"Chặn merge, báo lỗi","style":{}}],"edges":[{"id":"e1","type":"flow.arrow","source":"s","target":"p1","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"e2","type":"flow.arrow","source":"p1","target":"p2","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"e3","type":"flow.arrow","source":"p2","target":"p3","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"e4","type":"flow.arrow","source":"p3","target":"d","label":"","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"e5","type":"flow.arrow","source":"d","target":"x","label":"Không","style":{"endArrow":"arrow"},"sourcePort":"right","targetPort":"left"},{"id":"e6","type":"flow.arrow","source":"d","target":"p4","label":"Có","style":{"endArrow":"arrow"},"sourcePort":"bottom","targetPort":"top"},{"id":"e7","type":"flow.arrow","source":"p4","target":"p5","label":"","style":{"endArrow":"arrow"},"sourcePort":"left","targetPort":"right"},{"id":"e8","type":"flow.arrow","source":"p5","target":"k","label":"","style":{"endArrow":"arrow"},"sourcePort":"left","targetPort":"right"}]} -->
<div align="center"><svg role="img" aria-label="Chạy kiểm thử tự động" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" width="1568" height="300" viewBox="16 24 1568 300"><title>Chạy kiểm thử tự động</title><defs><filter id="devitt8a-shadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="1.5" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.18"/></filter></defs><rect x="16" y="24" width="1568" height="300" fill="#ffffff"/><g class="node" transform="translate(40,61)"><rect x="0" y="0" width="200" height="58" rx="29" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="100" y="33.9">Push / pull request</tspan></text></g><g class="node" transform="translate(300,55)"><rect x="0" y="0" width="200" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="100" y="39.9">Build + lint</tspan></text></g><g class="node" transform="translate(560,55)"><rect x="0" y="0" width="220" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="39.9">Unit + integration (TS-…)</tspan></text></g><g class="node" transform="translate(840,55)"><rect x="0" y="0" width="220" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="110" y="39.9">Quét bí mật, phụ thuộc</tspan></text></g><g class="node" transform="translate(1120,48)"><polygon points="80,0 160,42 80,84 0,42" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="80" y="46.9">Đạt?</tspan></text></g><g class="node" transform="translate(1100,230)"><rect x="0" y="0" width="200" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="100" y="39.9">Triển khai staging</tspan></text></g><g class="node" transform="translate(820,230)"><rect x="0" y="0" width="200" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="100" y="39.9">E2E theo BP (§5)</tspan></text></g><g class="node" transform="translate(540,236)"><rect x="0" y="0" width="240" height="58" rx="29" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="120" y="33.9">Sẵn sàng phát hành (DEP-00 §6)</tspan></text></g><g class="node" transform="translate(1360,55)"><rect x="0" y="0" width="200" height="70" fill="#ffffff" stroke="#334155" stroke-width="1.5"/><text font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#0f172a" text-anchor="middle" xml:space="preserve"><tspan x="100" y="39.9">Chặn merge, báo lỗi</tspan></text></g><g class="edge"><path d="M240,90 L290.31,90" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="300,90 288.6,94.79 288.6,85.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M500,90 L550.31,90" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="560,90 548.6,94.79 548.6,85.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M780,90 L830.31,90" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="840,90 828.6,94.79 828.6,85.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M1060,90 L1110.31,90" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="1120,90 1108.6,94.79 1108.6,85.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M1280,90 L1350.31,90" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="1360,90 1348.6,94.79 1348.6,85.21" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="1297.68" y="80.5" width="44.64" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="1320" y="94.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">Không</text></g><g class="edge"><path d="M1200,132 L1200,220.31" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="1200,230 1195.21,218.6 1204.79,218.6" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><rect x="1187.77" y="171.5" width="24.46" height="19" rx="3" fill="#ffffff" fill-opacity="0.9"/><text x="1200" y="185.2" font-family="Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="middle" xml:space="preserve">Có</text></g><g class="edge"><path d="M1100,265 L1029.69,265" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="1020,265 1031.4,260.21 1031.4,269.79" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g><g class="edge"><path d="M820,265 L789.69,265" fill="none" stroke="#475569" stroke-width="1.5" stroke-linejoin="round"/><polygon points="780,265 791.4,260.21 791.4,269.79" fill="#475569" stroke="#475569" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></g></svg></div>
<!-- /de-diagram:dg-e7e9b0 -->

## 9. Vai trò

| Vai trò | Trách nhiệm |
|---|---|
| {{Phụ trách chất lượng}} | {{Giữ kế hoạch này cập nhật, viết kịch bản đầu-cuối, báo cáo kết quả mỗi đợt phát hành}} |
| {{Đội HTC}} | {{Unit / integration cho FR của HTC}} |

## 10. Điều có thể làm kết quả kiểm thử sai lệch

- {{Ví dụ: các nhóm dùng chung một bộ dữ liệu test}}

## 11. Vấn đề còn mở

- {{…}}

## 12. Lịch sử thay đổi

| Phiên bản | Ngày | Mô tả | Người thực hiện |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | Khởi tạo từ bộ mẫu | {{Họ tên}} |
