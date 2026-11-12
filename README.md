# ChillCat Studio – Soạn tài liệu thiết kế phần mềm

Bộ công cụ soạn **tài liệu thiết kế phần mềm** chạy hoàn toàn trên trình duyệt: **24 mẫu tài liệu** theo
ISO/IEC/IEEE 12207 nối với nhau bằng mã truy vết, trình vẽ diagram dạng whiteboard (**Flowchart, BPMN 2.0, UML 2.5
và ERD**) nhúng thẳng vào tài liệu **Markdown**, tab **thiết kế trang web bằng kéo thả** (xuất file HTML) và
**Chat AI** – gõ hoặc **nói** – để AI viết tài liệu, vẽ diagram, dựng trang. HTML + CSS + JavaScript thuần, không cần
build, không phụ thuộc thư viện ngoài; mọi đối tượng được quản lý bằng **JSON**.

**Dùng ngay:** <https://design.trungctr.com/> (cài được như ứng dụng, chạy cả khi offline).

## Mục lục

- [Chạy trên máy](#chạy-trên-máy)
- [Tính năng](#tính-năng)
- [Mẫu tài liệu](#mẫu-tài-liệu)
- [Tài liệu Markdown](#tài-liệu-markdown)
- [Thiết kế trang](#thiết-kế-trang)
- [Chat AI](#chat-ai)
- [Giọng nói](#giọng-nói)
- [Phím tắt](#phím-tắt)
- [Cấu trúc JSON](#cấu-trúc-json)
- [Cấu trúc mã nguồn](#cấu-trúc-mã-nguồn)
- [Triển khai](#triển-khai)

## Chạy trên máy

Mở trực tiếp `index.html` bằng Chrome / Edge / Firefox (hỗ trợ cả `file://`). Hoặc chạy qua web server tĩnh
bất kỳ, ví dụ `npx serve .` hay `python -m http.server`. Cần chạy qua `http(s)://` thì PWA (cài đặt, offline)
mới hoạt động. Khi mở bằng `file://`, trình duyệt không cho đọc file cục bộ nên mẫu tài liệu được tải từ bản
online (cần mạng).

## Tính năng

### Diagram

- **3 chế độ**: Flowchart, BPMN, UML – chọn ở thanh công cụ. Mỗi chế độ chỉ hiện ký hiệu, đường nối và mẫu
  của mình; nhóm “Chung” (sticky, text, tiêu đề, frame, cloud) có ở mọi chế độ. ERD nằm trong chế độ UML.
  Chế độ lưu trong `meta.mode` của tài liệu (hoặc tự suy ra khi mở file cũ). Chuyển chế độ = bắt đầu tài liệu
  mới (có hỏi xác nhận).
- **99 ký hiệu chuẩn** và **27 kiểu đường nối** (Sequence / Message Flow, Generalization, Realization,
  Dependency, Aggregation, Composition, Include / Extend, các loại message, crow's foot…). Định tuyến vuông góc,
  thẳng hoặc cong; kéo đầu mút để nối lại sang hình khác.
- **Mẫu diagram** (nút **Mẫu** màu cam trên thanh công cụ – hộp chọn có ảnh xem trước, tìm kiếm, mẫu của cả ba chế độ,
  chọn mẫu chế độ khác thì tự chuyển chế độ): Flowchart, BPMN, và 13 mẫu UML nhóm theo các quá trình kỹ thuật của ISO/IEC/IEEE 12207
  (Activity nghiệp vụ, Use Case, Domain model, Package, Component, Class, Sequence, Communication, State
  Machine, ERD, Deployment, Activity kiểm thử CI, State Machine yêu cầu thay đổi). Tiêu chuẩn không bắt buộc
  loại diagram – cách ánh xạ là thông lệ phổ biến.
- **Tab Trợ giúp**: quy ước của chế độ hiện tại, ý nghĩa từng ký hiệu và mũi tên, danh sách mẫu, phím tắt, có
  tìm kiếm. Chọn một hình / đường nối thì bảng Thuộc tính cũng hiện ý nghĩa của nó.

### Whiteboard

- Canvas vô hạn, zoom / pan, lưới và bắt dính lưới, chọn nhiều bằng vùng chọn, căn chỉnh và dàn đều, nhân bản,
  copy / paste (dữ liệu JSON, dùng được giữa các tab), undo / redo.
- **Nối nhanh**: rê chuột lên hình, kéo từ chấm xanh; thả ra vùng trống để tạo nhanh một hình đã nối sẵn.
- **Dời đoạn giữa**: chọn đường nối vuông góc dạng chữ Z / U, kéo tay nắm ở giữa (hoặc chính đoạn giữa) để dời đoạn
  giữa sang trái / phải hoặc lên / xuống; nhấn đúp tay nắm (hay bấm “↺ Về tự động” ở bảng Thuộc tính) để về vị trí tự động.
- **Sequence diagram**: message gắn tự do theo trục dọc lifeline / activation, tự bắt thẳng hàng ngang.
- **Container** (Pool, Lane, Package, Frame, Group…): kéo container sẽ kéo theo các hình bên trong.
- **Thu gọn panel**: nút ‹ › ở mép canvas hoặc `Ctrl+B` / `Ctrl+Alt+B`; diagram đứng yên khi panel co giãn.
- **Sáng / tối / theo hệ thống** (tab ⚙ Cài đặt → Giao diện): chế độ tối chỉ làm tối giao diện, whiteboard chỉ dịu bớt
  độ trắng (không đen), hình giữ nguyên màu.

### JSON, mở và lưu

- **Tab JSON**: xem / sửa toàn bộ tài liệu. Khi bấm **Áp dụng**: giá trị không hợp lệ được đưa về fallback,
  node / edge không hiểu được bị xoá – kèm bảng liệt kê để xác nhận hoặc huỷ trước khi thực thi. Nhận cả câu
  trả lời dán nguyên từ AI (có lời dẫn và khối ```` ```json ````).
- **Mở file**: chỉ nhận `.json` đúng định dạng; file sai bị từ chối kèm danh sách lỗi cụ thể.
- **Tải xuống**: `JSON` (định dạng gốc, mở lại để sửa tiếp) · `SVG` · `PNG`. Diagram cũng tự lưu vào trình duyệt.
- **Xác nhận trước khi thay diagram** (Tài liệu mới, chuyển chế độ, mở mẫu) – có nút “Tải JSON rồi tiếp tục”;
  vẫn hoàn tác được bằng `Ctrl+Z`.

### Nhúng vào Markdown

Nút **Nhúng SVG** tạo đoạn mã dán thẳng vào file `.md`, không cần file ảnh ngoài:

- **SVG inline** (khuyên dùng): `<div><svg …>…</svg></div>` trên một dòng (CommonMark coi là khối HTML), id duy
  nhất để nhúng nhiều diagram trong một trang, tự co theo bề rộng. Cần trình xem cho phép HTML (VS Code
  preview, Typora, Obsidian, MkDocs, Docusaurus…).
- **Ảnh PNG nhúng**: `![tên](data:image/png;base64,…)` – Markdown thuần (markdown-it chặn data URI SVG nên dùng PNG).
- Có thể chỉ nhúng các hình đang chọn. GitHub lọc bỏ cả hai dạng – ở GitHub hãy dùng file `.svg` tải xuống.

### PWA

Cài như ứng dụng (tab ⚙ Cài đặt → Ứng dụng & dữ liệu → **Cài đặt ứng dụng**, hoặc biểu tượng cài trên thanh địa chỉ),
chạy offline nhờ service worker (network-first), mở file `.json` trực tiếp từ hệ điều hành khi đã cài.

### Tab Cài đặt

Mọi cài đặt chung gom vào tab **⚙ Cài đặt** (góc phải thanh tab, `Alt+5`) thay vì rải trên toolbar và khung chat.
Cột trái có 4 nhóm; nhóm vừa xem được nhớ lại, nút **← Quay lại** đưa về tab đang làm. Khung chat AI ẩn ở tab này.

| Nhóm | Nội dung | Lưu |
| --- | --- | --- |
| Giao diện | Sáng · Tối · Theo hệ thống (theo `prefers-color-scheme`, tự đổi khi máy đổi) – thẻ chọn có hình xem trước | Ngay khi chọn |
| Trợ lý AI | Trạng thái đang dùng; nhà cung cấp, API key, mô hình (cùng form với hộp thoại cũ, nay nằm trong trang); effort, thinking | Nút **Lưu cài đặt AI** (có báo “chưa lưu” + **Bỏ thay đổi**); effort / thinking lưu ngay |
| Giọng nói | Bộ nhận dạng, micro (thử micro), ngôn ngữ, lệnh giọng nói, phản hồi bằng giọng nói, xưng hô, giọng đọc | Ngay khi đổi |
| Ứng dụng & dữ liệu | Cài như ứng dụng, trạng thái chạy offline, dung lượng `localStorage` theo từng loại dữ liệu, phím tắt chung | – |

Lối tắt vẫn còn: nút cài đặt ở góc khung chat (chấm xanh = đã có key, cam = chưa) và mục “⚙ Cài đặt AI…” trong dropdown mô
hình mở thẳng nhóm Trợ lý AI; chuột phải vào 🎤 hoặc lệnh giọng nói “cài đặt giọng nói” mở nhóm Giọng nói. Gửi chat khi chưa có
key thì hộp thoại cài đặt AI mở ngay tại chỗ để gửi tiếp được luôn. Mã nguồn: `js/settings.js` (khung trang, giao diện,
ứng dụng); form AI là `DE.ui.aiForm(host)` trong `js/ui.js`, form giọng nói là `DE.voice.settingsForm(host)` trong `js/voice.js`.

## Mẫu tài liệu

Thư mục [`templates/`](templates/README.md) chứa **24 mẫu tài liệu thiết kế phần mềm** theo ISO/IEC/IEEE 12207,
mỗi mẫu có khối thông tin đầu, hướng dẫn điền (`> [!TIP]`), bảng ví dụ và sơ đồ khung là diagram nhúng của app:

| Thư mục | Mẫu |
| --- | --- |
| `00_Quan_ly_tai_lieu` | Quy ước và mã (CONV), sổ đăng ký (DOC-REG), thuật ngữ, ma trận truy vết (RTM-00), nhật ký |
| `01_Phan_tich_nghiep_vu` | Phân tích nghiệp vụ (BMA-00), BPMN cấp 0, BPMN cấp 1 (`BPMN-NN`, nhân bản cho mỗi quy trình) |
| `02_Yeu_cau` | StRS-00, SyRS-00, SRS (`SRS-HTC`, nhân bản cho mỗi hệ thống con) |
| `03_Kien_truc` … `06_Giao_dien_tich_hop` | SAD-00, ADR, SDD, DBD-00, ERD, ICD-00, API |
| `07_Kiem_thu` … `09_Danh_gia_hien_trang` | Kế hoạch kiểm thử, triển khai, hạ tầng, sổ tay vận hành, đánh giá rủi ro |

**Liên kết giữa các mẫu:** mỗi phần tử có một mã (`StR-01`, `BP-11`, `UC-ORD-01`, `FR-ORD-CART-001`, `SEQ-01`,
`TS-01`, `SEC-01`…), được định nghĩa ở đúng một tài liệu và được tài liệu khác tham chiếu bằng mã. RTM-00 ghi mọi mối
nối và bảng "sửa gì thì cập nhật gì"; mỗi mẫu có dòng *Tài liệu liên quan* (↑ tầng trên · ↓ tầng dưới).

**Trong app** (`js/doc-library.js`):

- Tab Tài liệu → nút **Mẫu**, hoặc **Tài liệu mới** → hộp chọn mẫu có tìm kiếm và mục **Gợi ý bắt đầu / tiếp theo**
  (mẫu chưa mở, theo thứ tự lập tài liệu).
- Mở mẫu: app hỏi mã dự án (`PRJ`), hệ thống con (`HTC`), module (`MOD`), số quy trình (`NN`) tuỳ loại mẫu, thay vào
  nội dung, tên file, liên kết và ngày; khối `[!TIP]` giữ nguyên. Bộ mã được nhớ trong `localStorage`
  (`diagram-editor:doc-lib:v1`) nên các tài liệu mở sau khớp mã với nhau. **Mở nguyên mẫu** giữ các ký hiệu.
- `Ctrl` + bấm liên kết `.md` trong tài liệu mở từ mẫu → mở mẫu đích (nhận cả tên file đã điền mã).
- Chat AI nhận danh mục mẫu (mục, mã định nghĩa) nên viết đúng cấu trúc và gợi ý mẫu phù hợp.
- Mẫu tải bằng `fetch` từ `templates/` (cùng origin) và được service worker cache để dùng offline; mở bằng
  `file://` thì tải từ `https://design.trungctr.com/templates/`.

## Tài liệu Markdown

App có năm tab ở trên cùng: **Tài liệu** (soạn / xem file `.md`, `Alt+1`), **Diagram** (whiteboard, `Alt+2`),
**Thiết kế trang** (dựng trang web bằng kéo thả, `Alt+3`), **Hướng dẫn** (hướng dẫn sử dụng có mục lục, tìm kiếm và
ví dụ gửi thẳng vào chat AI, `Alt+4`) và **⚙ Cài đặt** (góc phải, `Alt+5`). Diagram luôn được
vẽ ở tab Diagram rồi nhúng vào tài liệu; muốn sửa thì mở lại diagram đó ở tab Diagram.

Thanh công cụ chia theo nhóm; khi màn hình hẹp, các nhóm tự xuống hàng – không nút nào bị ẩn.

```text
[ 📄 Tài liệu · thiet-ke.md ● ] [ ◆ Diagram  mới ] …          Alt+1 … Alt+5 chuyển tab  [ ⚙ Cài đặt ]
┌─────────────────────────────────┬──────────────────────────────────────────┐
│ # Thiết kế                      │ Thiết kế                                 │
│                                 │ ─────────                                │
│ [[diagram:dg-ab12cd|Đặt hàng]]  │ ┌──────────────── ✎ Sửa  Mã  SVG  Xoá ┐ │
│                                 │ │        (diagram dạng SVG)            │ │
└─────────────────────────────────┴──────────────────────────────────────────┘
```

### Soạn và xem

- **Soạn trực quan (mặc định)**: gõ thẳng vào trang như Word – người dùng không cần biết Markdown. Thanh công cụ:
  tiêu đề, đậm / nghiêng / gạch, code, liên kết, ảnh (URL hoặc chọn từ máy – nhúng thẳng vào file), danh sách, việc
  cần làm (tick được), trích dẫn, khối code, bảng, đường kẻ. Dán từ Word / trang web giữ cấu trúc, bỏ style.
  `Ctrl+B` / `Ctrl+I` / `Ctrl+K` / `Ctrl+E`; `Tab` / `Shift+Tab` thụt lề danh sách; `Ctrl` + bấm để mở liên kết.
- **Chế độ developer** (nút **</> Developer**): hiện mã Markdown, chọn **Mã** · **Chia đôi** (mã + trực quan, cuộn
  đồng bộ, sửa bên nào bên kia cập nhật) · **Trực quan**. Nút **Xem file thật** hiện đúng nội dung file sẽ được lưu.
- Hỗ trợ CommonMark + GFM: tiêu đề, đậm / nghiêng / gạch, code, khối code, trích dẫn, GitHub alert (`> [!NOTE]`),
  danh sách lồng nhau, task list, bảng, link, ảnh, link tham chiếu. Khối HTML có sẵn trong file được giữ nguyên
  (hiển thị nhưng không sửa được ở chế độ trực quan).
- **Kéo thả file vào bất kỳ đâu trong cửa sổ**: `.md` → mở ở tab Tài liệu; `.json` → nhúng diagram (tab Tài liệu)
  hoặc mở diagram (tab Diagram); ảnh → chèn vào tài liệu tại chỗ thả.
- **Mở / lưu**: `Ctrl+O`, `Ctrl+S` (`Ctrl+Shift+S`: lưu thành file khác). Trên
  Chrome / Edge, `Ctrl+S` ghi thẳng vào file đang mở; trình duyệt khác thì tải file xuống. Tài liệu cũng tự lưu vào
  trình duyệt. Giữ nguyên kiểu xuống dòng (CRLF / LF) của file gốc.
- **Xuất HTML**: trang HTML độc lập (diagram dạng SVG), mở bằng trình duyệt rồi in ra PDF được.
- HTML trong file `.md` được làm sạch trước khi hiển thị (bỏ `<script>`, thuộc tính `on…`, link `javascript:`…), vì
  trang giữ API key trong `localStorage`.

### Nhúng diagram

| Muốn | Làm |
| --- | --- |
| Vẽ diagram mới cho tài liệu | Đặt con trỏ ở khung soạn → **◆ Diagram mới** → vẽ ở tab Diagram → **✓ Chèn vào tài liệu** |
| Sửa diagram đã nhúng | Rê chuột lên diagram ở khung xem → **✎ Sửa** (hoặc nhấn đúp) → sửa → **✓ Cập nhật vào tài liệu** |
| Đưa diagram đang vẽ ở tab Diagram vào tài liệu | Nút **Vào tài liệu** trên thanh công cụ Diagram (chèn một bản sao tại con trỏ) |
| Nhúng file diagram `.json` có sẵn | Kéo thả file `.json` vào tab Tài liệu |

Khi vẽ / sửa diagram cho tài liệu, diagram bạn đang vẽ dở ở tab Diagram được **cất lại kèm lịch sử undo** và trả
về nguyên vẹn khi bấm ✓ hoặc **Huỷ**. Đang vẽ dở mà tải lại trang thì phiên vẽ vẫn được khôi phục.

### Công thức, Mermaid, chú thích và các cú pháp mở rộng

Tab Tài liệu hiển thị các phần mở rộng phổ biến của GitHub / VS Code / Obsidian / Typora. Phần dựng nằm trong
`js/markdown.js`; phần vẽ nằm trong `js/md-rich.js`, chỉ **tải thư viện từ CDN khi tài liệu cần**:

| Cú pháp | Hiển thị | Thư viện (jsDelivr, có SRI) |
| --- | --- | --- |
| ```` ```mermaid ```` | Sơ đồ Mermaid (lưu đồ, tuần tự, Gantt, pie, mindmap, class, state, ER, journey, timeline, gitGraph, quadrant…) | `mermaid@11.4.1` |
| `$…$`, `` $`…`$ ``, `$$ … $$`, ```` ```math ```` | Công thức LaTeX | `katex@0.16.11` |
| ```` ```js ````, ```` ```python ````… | Tô màu cú pháp (~40 ngôn ngữ phổ biến) | `@highlightjs/cdn-assets@11.10.0` |
| `:rocket:` | Emoji theo bảng shortcode của GitHub | `emojibase-data@15.3.2` |
| `[^1]` + `[^1]: …` | Chú thích cuối trang có liên kết qua lại | – |
| `[TOC]` (cả `[[toc]]`, `[[_TOC_]]`, `${toc}`) | Mục lục tự động | – |
| `---` … `---` ở đầu file | Bảng front matter (YAML) | – |
| `> [!NOTE]` … `> [!CAUTION]`, `> [!tip]- Tiêu đề` | Hộp ghi chú GitHub + callout Obsidian (27 loại, tiêu đề riêng) | – |
| `==chữ==` | Tô sáng | – |

- **An toàn**: mỗi file từ CDN có mã kiểm tra toàn vẹn (`integrity`), bị sửa là trình duyệt từ chối. Mermaid chạy với
  `securityLevel: 'strict'`; sơ đồ được chèn bằng `<img src="data:image/svg+xml;base64,…">` nên SVG không thể chạy
  script. KaTeX chạy với `trust: false` (không có `\href`, `\html…`).
- **Offline**: service worker lưu các file CDN (URL có số phiên bản) vào cache riêng `diagram-editor-cdn-v1`. Chưa tải
  được thì tài liệu vẫn hiện mã gốc.
- **Trình soạn trực quan**: các khối này không sửa trực tiếp (giữ mã gốc trong `data-raw`). Nhấn đúp hoặc dùng nút trên
  thanh công cụ (**∑**, **[1]**, mục lục) để mở hộp thoại sửa có xem trước. Chuyển ngược sang Markdown không mất gì.
- **Mermaid chỉ để hiển thị**: không có nút chèn Mermaid – sơ đồ mới vẽ bằng **◆ Diagram mới**. Sơ đồ Mermaid có sẵn (file
  mở vào, dán, AI viết) được vẽ nguyên bản; khi **sửa** (nhấn đúp / **◆ Sửa trên whiteboard**) nó được **dịch sang diagram
  của app** (`DE.mermaidConv.convert` trong `js/plantuml.js`, dùng chung bộ dàn trang với PlantUML): flowchart / graph →
  hình chế độ Flowchart (process, decision, terminator, data, database, subroutine, subgraph → khung…, `classDef` / `style`
  giữ màu), sequenceDiagram, classDiagram, stateDiagram, erDiagram → UML / ERD. Loại không có hình tương ứng (Gantt, pie,
  mindmap, timeline, gitGraph…) vẫn sửa bằng mã.
- **Xuất HTML**: sơ đồ Mermaid nhúng dạng ảnh SVG, công thức dạng **MathML** (không cần CSS / font của KaTeX), code đã
  tô màu – file chạy độc lập, không cần mạng.

### PlantUML – dịch sang diagram, không cần máy chủ

Trình xem khác thường gửi mã PlantUML lên máy chủ (plantuml.com / Kroki) để lấy ảnh. Ở đây `js/plantuml.js` **dịch**
mã PlantUML thành JSON diagram của whiteboard rồi vẽ bằng chính bộ vẽ SVG của app – không gửi gì ra ngoài, chạy offline.

| Loại | Cú pháp nhận được | Thành |
| --- | --- | --- |
| Sequence | `participant` / `actor` / `database`…, `->` `-->` `->>`, `activate`, `alt` / `else` / `loop` / `opt`…, `note`, `autonumber`, `return`, `== … ==` | lifeline, activation, message (neo đúng hàng), fragment |
| Use case | `actor`, `usecase` / `(…)`, `rectangle` (biên hệ thống), `<<include>>` / `<<extend>>`, `<\|--`, `left to right direction` | actor, use case, biên hệ thống, include / extend / generalization |
| Class | `class` / `interface` / `enum` / `abstract`, thành viên `{ … }`, `<\|--` `<\|..` `*--` `o--` `-->` `..>`, bội số `"1" -- "*"`, `package` | lớp 3 ngăn, đủ 6 loại quan hệ |
| Activity | cú pháp mới (`:bước;`, `if` / `elseif` / `else`, `while`, `repeat`, `fork`, `\|Làn\|`) và cú pháp cũ (`(*) -->`, `if "" then`) | start / end, action, decision, fork / join, làn bơi, vòng lặp đi vòng bên trái |
| State | `[*]`, `state X { … }` (trạng thái lồng), `X : entry / …`, `<<choice>>` / `<<fork>>` | state, composite, initial / final, choice |
| Component / Deployment | `component` / `[X]`, `interface` / `()`, `node`, `database`, `cloud`, `package`, `folder`… | component, interface, node lồng nhau |
| ER | `entity X { * id : int <<PK>> … }`, `\|\|--o{` `}\|..\|{`… | bảng ERD, đầu chân chim đúng ký hiệu |

- **Dàn trang**: sequence xếp theo hàng; activity dựng theo khối lồng nhau (nhánh, vòng lặp, làn); các loại còn lại dùng
  dàn trang phân tầng (phá chu trình, xếp tầng, giảm cắt chéo bằng barycenter, khung chứa lồng nhau, cạnh ngược đi cổng bên).
- **Bỏ qua có báo**: `skinparam`, màu, `!include`… được bỏ qua và liệt kê thành cảnh báo. Loại chưa hỗ trợ (mindmap,
  gantt, wireframe…) trả về thông báo rõ ràng, tài liệu hiện mã gốc.
- **An toàn**: kết quả đi qua `DE.normalizeDoc` như mọi JSON khác; chữ luôn được thoát nên SVG chèn thẳng vào trang.
- **Dùng ở đâu**: khối ```` ```plantuml ```` / ```` ```puml ```` trong tài liệu (dán mã `@startuml` thô cũng tự bọc), file
  `.puml` / `.plantuml` / `.pu` / `.iuml` / `.wsd` (nút Mở, kéo thả), hoặc dán mã vào tab JSON. Sửa (nhấn đúp hoặc
  **◆ Sửa trên whiteboard**) = chuyển khối thành diagram nhúng để sửa kéo thả; khối dịch không được thì **✎ Sửa mã**.
- **Đường nối không xuyên qua hình**: trước khi chọn cổng nối, app ước lượng đường vuông góc; nếu đi xuyên qua hình khác thì
  vòng ra cạnh bên (phải / trái, hoặc trên / dưới với bố cục ngang). Nhánh của hình thoi trong lưu đồ ra từ đỉnh trái / phải.

### Định dạng trong file `.md`

Trong **file `.md` tải xuống / lưu ra**, mỗi diagram là một khối tự chứa gồm 3 dòng (dòng giữa là ảnh SVG thật):

```html
<!-- de-diagram:dg-ab12cd {"version":1,"meta":{"name":"Đặt hàng","mode":"flowchart"},"nodes":[…],"edges":[…]} -->
<div align="center"><svg role="img" aria-label="Đặt hàng" …>…</svg></div>
<!-- /de-diagram:dg-ab12cd -->
```

- Các trình xem Markdown cho phép HTML (VS Code preview, Typora, Obsidian, MkDocs…) hiển thị diagram; comment chứa
  JSON thì ẩn đi.
- Mở lại file trong app, diagram sửa tiếp được (nhờ JSON trong comment).
- Riêng trong khung mã của chế độ developer, khối này được thu gọn thành một dòng `[[diagram:<id>|<tên>]]` cho dễ đọc;
  khi lưu nó luôn được thay lại bằng khối SVG + JSON ở trên.
- JSON được escape `<` `>` thành `\u003c` `\u003e` nên không bao giờ làm vỡ comment HTML.
- GitHub lọc bỏ SVG inline (giống tính năng Nhúng SVG).

## Thiết kế trang

Tab **Thiết kế trang** dựng trang web bằng **kéo thả** cho người không biết code – ý tưởng gần với Figma nhưng thao tác
đơn giản hơn: thay vì vẽ từng hình, người dùng xếp các **thành phần dựng sẵn** vào trang, trang tự co giãn theo màn hình.

```text
[ Mới Mở Lưu  Tên dự án ] [ ↶ ↷ ] [ ⤴ ↑ ↓ ⧉ 🗑 ] [ Máy tính | Máy tính bảng | Điện thoại ] [ ▦ ]   [ ▶ Xem thử ] [ HTML JSON ]
┌ Thành phần | Lớp ┐ [ ⌂ Trang chủ ] [ Giới thiệu ] [ ＋ Trang ]  ┌ Thuộc tính | JSON ──────────┐
│ BỐ CỤC           │ ┌──────────────────────────────────────┐   │ Trang chủ › Khối trang › Hàng │
│ Khối  Hàng  Cột  │ │ Studio TrungCTR    Trang chủ  Liên hệ │   │ ▸ NỘI DUNG                    │
│ NỘI DUNG         │ │   ╭ Nút bấm: Liên hệ ⤴ ✥ ↑ ↓ ⧉ 🗑 ╮   │   │ ▾ ĐỊNH DẠNG                   │
│ Tiêu đề  Nút …   │ │   [ Liên hệ ngay → ] [ Về chúng tôi ] │   │ ▾ LOẠI NÚT – KHI BẤM          │
│ ĐIỀU HƯỚNG …     │ └──────────────────────────────────────┘   │ ▸ HIỆU ỨNG KHI DI CHUỘT QUA … │
└──────────────────┘                                            └───────────────────────────────┘
```

- **Bên trái**: thư viện thành phần (kéo vào trang hoặc bấm để thêm cạnh thành phần đang chọn) và tab **Lớp** (cây thành
  phần – chọn, kéo đổi chỗ / đổi khung chứa, đặt tên).
- **Giữa**: trang nằm trong một `iframe` có `sandbox` (không chạy script) để CSS của trang không lẫn với app và media query
  chạy đúng theo bề rộng thiết bị (máy tính · 768px · 390px). Một lớp phủ trong suốt nhận thao tác: chọn, rê, kéo thả
  (vạch xanh lá cho biết vị trí thả), **nhấn đúp để sửa chữ ngay trên trang** (tiêu đề, đoạn văn, nút, mục danh sách,
  ô bảng – `Tab` sang ô kế). Nhiều trang trong một dự án (tab phía trên; trang mới chép sẵn phần đầu và chân trang).
- **Bên phải**: thuộc tính chia nhóm, **đặt tên theo cách nói thông thường** thay vì tên CSS – “Khi di chuột qua” thay cho
  `:hover`, “Đệm trong” thay cho `padding`, “Bo góc”, “Đổ bóng”, “Độ rõ”…; mỗi giá trị đã đổi có nút ↺ về mặc định.
  Không chọn gì: thiết lập trang (tên, đường dẫn, nền) và dự án (font chung, cỡ chữ, màu chữ, màu chủ đạo, mã JavaScript).

### Thành phần

| Nhóm | Thành phần | Ghi chú |
| --- | --- | --- |
| Bố cục | Khối trang (`section`), Hàng (`row`), Cột (`col`), Thẻ | Khối trang render ra thẻ ngữ nghĩa (`header`, `nav`, `main`, `section`, `article`, `aside`, `footer`) và căn giữa nội dung theo “bề rộng phần nội dung”; Hàng = flex row (tự xuống dòng, **xếp chồng trên điện thoại**); Cột = flex column, độ rộng chia đều / vừa nội dung / % / px |
| Nội dung | Tiêu đề (H1–H6), Đoạn văn, Nút bấm, Ảnh, Danh sách | Ảnh: URL, tải từ máy (tự thu nhỏ ≤ 1600px) hoặc kéo thả file vào trang |
| Điều hướng | Menu bảng nhỏ, Menu toàn trang, Nút mở menu ☰ | Menu chỉ hiện khi bấm nút loại “Mở menu”; trong khung soạn menu thu thành một dải mỏng, mở ra khi được chọn |
| Biểu mẫu | Biểu mẫu, Ô nhập (chữ, email, số điện thoại, số, mật khẩu, ngày, nhiều dòng), Hộp chọn, Ô đánh dấu, Nút gửi | Khi gửi: hiện lời cảm ơn, gửi tới URL (POST/GET) hoặc gọi hàm JavaScript |
| Dữ liệu | Bảng | Dòng tiêu đề, kẻ ô / kẻ ngang, tô xen kẽ, tô sáng hàng khi di chuột qua, dán từ Excel |
| Ngăn cách | Thanh ngang, Thanh dọc, Khoảng trống | |
| Mẫu dựng sẵn | Thanh điều hướng (kèm menu ☰ cho điện thoại), Ảnh bìa, 3 tính năng, Bảng giá, Biểu mẫu liên hệ, Chân trang | |

**Nút bấm** có ba nhóm thuộc tính chính:

- **Định dạng**: kiểu nhanh (nền đặc / viền / nền nhạt / chỉ chữ), kích thước, màu nền, màu chữ, viền, font, cỡ chữ,
  đậm / nghiêng / gạch chân / IN HOA, giãn cách chữ, căn chữ, độ rộng (vừa chữ / giãn hết / cố định), vị trí trong khung,
  đệm trong, bo góc, đổ bóng.
- **Loại nút – khi bấm** (chọn một): **Chuyển trang** (trang trong dự án hoặc địa chỉ web, mở tab mới) · **Mở menu**
  (chọn hoặc tạo menu) · **Gửi / chạy chức năng** (gửi biểu mẫu chứa nút, hiện thông báo, gọi hàm JavaScript).
- **Hiệu ứng khi di chuột qua / khi bấm**: tích từng thay đổi – màu nền (có “Tự động” đậm hơn nền), màu chữ, màu viền,
  phóng to / thu nhỏ, nhấc lên / lún xuống, đổ bóng, độ rõ – và tốc độ chuyển. Dòng “Xem trước” bật trạng thái đó ngay
  trên khung soạn. Các khung (hàng, cột, thẻ…), ảnh và chữ cũng có nhóm hiệu ứng này.

**Menu**: loại bảng nhỏ (dưới nút căn trái / phải, hoặc trên nút; độ rộng) hoặc toàn trang (nút đóng ×, vị trí các mục,
hiệu ứng hiện dần / trượt xuống / trượt từ phải); nền (màu, ảnh nền, làm tối ảnh), bo góc, viền, bóng, xếp mục dọc / ngang,
đóng khi bấm ra ngoài / khi chọn một mục.

Mọi thành phần có nhóm **Hiển thị**: độ rõ, **ẩn trên điện thoại**, **ẩn trên máy tính & máy tính bảng** (điểm ngắt 640px).

### Xem thử, xuất file, dữ liệu

- **▶ Xem thử**: chạy trang trong `iframe sandbox="allow-scripts …"` **không** có `allow-same-origin` – mã của trang
  (kể cả “Mã JavaScript của dự án”) chạy ở origin riêng, không đọc được API key hay dữ liệu của app.
- **Tải xuống HTML**: một file `.html` độc lập chứa mọi trang (`<div data-page="duong-dan">`), CSS sinh từ thuộc tính và
  một đoạn JS nhỏ: chuyển trang theo `#/duong-dan`, mở / đóng menu (đặt menu bảng nhỏ cạnh nút, `aria-expanded`,
  `Esc` để đóng), gửi biểu mẫu. Font web (Be Vietnam Pro, Inter, Roboto…) chỉ được nạp khi được chọn.
- **Tải xuống JSON** / mở lại / kéo thả file `.json` vào cửa sổ. Dự án tự lưu vào `localStorage`.
- Dữ liệu dự án:

```json
{
  "kind": "de-page", "version": 1, "name": "Studio TrungCTR",
  "theme": { "font": "system", "fontSize": 16, "color": "#0f172a", "primary": "#2563eb" },
  "pages": [
    { "id": "p_home", "name": "Trang chủ", "path": "index", "props": { "bg": "#ffffff" },
      "children": [
        { "id": "hero", "type": "section", "props": { "bg": "#eff6ff", "padY": 96, "align": "center" },
          "children": [
            { "id": "t1", "type": "heading", "props": { "text": "Xin chào", "level": "1" } },
            { "id": "b1", "type": "button", "props": { "text": "Liên hệ", "action": "link", "page": "p_contact", "hoverLift": 2 } }
          ] }
      ] }
  ],
  "script": ""
}
```

`props` chỉ chứa giá trị khác mặc định. Khi mở file / áp dụng JSON / nhận từ AI, `DE.pagekit.normalize` kiểm tra từng
thuộc tính theo kiểu (màu, số có giới hạn, danh sách cố định, URL chỉ `http(s)` / `mailto` / `tel` / tương đối, ảnh thêm
`data:image/…;base64`) và bỏ phần không hợp lệ – nên dữ liệu lạ không chèn được mã vào HTML / CSS sinh ra. Tham chiếu
trang / menu nhận cả id, đường dẫn hoặc tên rồi đổi về id.

## Chat AI

Khung chat nổi ở góc dưới phải, **có ở mọi tab** (thu nhỏ được thành nút “Chat AI”). AI biết bạn đang ở tab nào:

| Tab | AI làm gì | Hoàn tác |
| --- | --- | --- |
| Tài liệu | Viết / sửa **toàn bộ tài liệu** (khối ````` ````markdown `````), tự vẽ diagram và chèn vào đúng chỗ (khối ```` ```diagram ````), sửa diagram đã nhúng (`"embedId"`) | Nút **↶ Hoàn tác thay đổi của AI** trong khung chat |
| Diagram | Vẽ / sửa diagram (JSON) – như trước; yêu cầu viết tài liệu thì chuyển sang tab Tài liệu | `Ctrl+Z` |
| Thiết kế trang | Dựng / sửa cả dự án trang web (khối ```` ```json ```` có `"pages"`); ảnh đã tải lên được thay bằng mã ngắn `@img:n` khi gửi và khôi phục khi nhận | Nút **↶ Hoàn tác thay đổi của AI**, hoặc `Ctrl+Z` |
| Hướng dẫn | Trả lời câu hỏi về cách dùng app | – |

System prompt gồm **skill tài liệu** (`DE.buildDocSkill` trong `js/skill.js`) + skill diagram của cả 3 chế độ; khi chat
từ tab Thiết kế trang, **skill thiết kế trang** (`DE.buildPageSkill` trong `js/page-kit.js`, sinh tự động từ danh mục thành
phần) được thêm vào mà không xoá lịch sử. Mỗi tin nhắn gửi kèm ngữ cảnh tab: tài liệu hiện tại (diagram dạng dòng
`[[diagram:…]]` + JSON của chúng), diagram đang mở, hoặc dự án trang đang mở.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ 🗑 Xoá hội thoại  2 lượt                                    ⇕ thu gọn tin nhắn  ⤡ thu nhỏ │
│                                                     ┌──────────────────────────────────┐ │
│                                                     │ Viết đặc tả đăng nhập            │ │
│ ┌ XONG · TÀI LIỆU ─────────────────────────────┐    └──────────────────────────────────┘ │
│ │ Đã viết đặc tả đăng nhập…                     │                                        │
│ │ [ ↶ Hoàn tác thay đổi của AI ]                │      (lịch sử hỏi – đáp, cuộn được)    │
│ └───────────────────────────────────────────────┘                                        │
│ [ mô hình ▾ ] [ Copy context ]                                                       ⚙●  │
│ Hỏi AI về diagram này…                                            🎤  🎧  [ Gửi Ctrl ↵ ] │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Hàng trên cùng**: **Xoá hội thoại** (xoá lịch sử trên màn hình và trí nhớ của AI) kèm số lượt; bên phải là **thu gọn
  khung tin nhắn** (chỉ giữ hàng trên cùng và ô nhập – gửi tin mới thì tự mở lại) và **thu nhỏ khung chat** thành nút
  “Chat AI”. Chưa có tin nào thì hàng trên chỉ hiện “✦ Trợ lý AI”.
- **Khung tin nhắn** giữ toàn bộ các lượt hỏi – đáp (tối đa 80 tin trên màn hình), tự cuộn tới tin mới, hiện “đang làm…”
  ngay trong khung. Mỗi lần AI sửa tài liệu / trang có nút **↶ Hoàn tác** riêng; chỉ lần gần nhất còn hoàn tác được.
  Bấm **Dừng** thì tin vừa gửi được bỏ khỏi khung (nội dung vẫn ở ô nhập); gửi lỗi thì tin được đánh dấu chưa gửi.
- **Hàng công cụ** ngay trên ô nhập: mô hình, Copy context, nút cài đặt AI (chấm xanh = đã có key, cam = chưa).

### Cài đặt

Mở tab **⚙ Cài đặt → Trợ lý AI** (nút ⚙ ở góc khung chat, hoặc “⚙ Cài đặt AI…” trong dropdown mô hình):

1. Chọn nhà cung cấp (bảng dưới; có link “Lấy API key ↗” / “Tải … ↗”).
2. Dán API key – luôn hiển thị dạng che bớt, ví dụ `AIza••••••WXYZ`; key đã lưu có nút Đổi / Xoá. Nhà cung cấp
   chạy trên máy / tuỳ chỉnh thì key không bắt buộc, thay vào đó nhập **địa chỉ máy chủ**.
3. Chọn mô hình – danh sách **tải trực tiếp từ tài khoản / máy chủ** (đúng quyền của tài khoản), có gợi ý
   dự phòng và “Khác…” để tự nhập tên.
4. **Lưu cài đặt AI**.

| Nhóm | Nhà cung cấp | Ghi chú |
| --- | --- | --- |
| Có gói miễn phí | **Google Gemini** | Gói miễn phí của Google AI Studio (giới hạn lượt). |
| | **OpenRouter** | Mô hình 🆓 (đuôi `:free`) xếp đầu danh sách; `openrouter/free` tự chọn một mô hình miễn phí. Key miễn phí, giới hạn lượt / ngày. Danh sách tải được cả khi chưa có key. |
| | **Groq** · **Cerebras** | Gói miễn phí có giới hạn lượt / token, trả lời rất nhanh. |
| | **Mistral AI** | Gói “Experiment” miễn phí (xác minh số điện thoại). |
| | **Hugging Face** | Một ít credit miễn phí mỗi tháng cho Inference Providers. |
| Chạy trên máy – miễn phí | **Ollama** | Mặc định `http://localhost:11434`. Dùng API gốc `/api/chat` và tự đặt `num_ctx` đủ dài cho skill (~10k token) – mặc định của Ollama quá ngắn sẽ cắt mất skill. |
| | **LM Studio** | Mặc định `http://localhost:1234/v1`; bật “Enable CORS”, đặt Context Length ≥ 16384 khi nạp mô hình. |
| Trả phí | **OpenAI** · **Anthropic Claude** | |
| Khác | **Tuỳ chỉnh** | Máy chủ bất kỳ có API kiểu OpenAI (`/v1/chat/completions`, `/v1/models`): vLLM, llama.cpp server, Jan, LocalAI, LiteLLM, DeepSeek, Together… |

Mọi nhà cung cấp đều được gọi **thẳng từ trình duyệt**, nên máy chủ phải cho phép CORS (các dịch vụ trong bảng đã
kiểm tra; GitHub Models, NVIDIA NIM, SambaNova hiện không cho phép nên không có trong danh sách). Mô hình mở chèn
phần suy luận `<think>…</think>` vào câu trả lời thì app tự bỏ trước khi đọc JSON.

**Ollama trên trang web**: Ollama chỉ cho phép `localhost` gọi tới. Đặt biến môi trường rồi thoát hẳn và mở lại
Ollama (form Cài đặt AI hiện sẵn lệnh với đúng địa chỉ trang):

```text
Windows:  setx OLLAMA_ORIGINS "https://design.trungctr.com"
macOS:    launchctl setenv OLLAMA_ORIGINS "https://design.trungctr.com"
Linux:    systemctl edit ollama  →  [Service] Environment="OLLAMA_ORIGINS=https://design.trungctr.com"
```

Chrome / Edge có thể hỏi quyền truy cập thiết bị trong mạng cục bộ – chọn Cho phép. Safari chặn trang `https`
gọi tới `http://localhost`, nên dùng Chrome / Edge / Firefox.

> **Cline** không phải nhà cung cấp mô hình mà là tiện ích lập trình cho VS Code; các mô hình miễn phí trong
> Cline đến từ OpenRouter và các nhà cung cấp ở trên – chọn **OpenRouter** để dùng cùng các mô hình đó.

> 🔒 Key chỉ lưu trong `localStorage` của trình duyệt này (riêng cho từng nhà cung cấp) và chỉ được gửi thẳng
> tới nhà cung cấp đã chọn – không qua máy chủ trung gian. Không nên lưu key trên máy dùng chung.

### Mô hình, effort, thinking

- **Mô hình**: đổi nhanh bằng dropdown trên khung chat (danh sách đã tải từ tài khoản).
- **Effort** (tab Cài đặt → Trợ lý AI → Cách AI trả lời): mặc định · thấp · trung bình · cao · rất cao · tối đa – cao hơn
  thì kỹ hơn nhưng chậm và tốn token hơn.
- **Thinking** (cùng chỗ): công tắc bật / tắt suy luận trước khi trả lời. Mô hình không tắt được thì công tắc bị khoá ở “bật”.

Mỗi nhà cung cấp nhận tham số khác nhau; app chuyển đổi như sau:

| Nhà cung cấp | Effort | Tắt thinking |
| --- | --- | --- |
| Anthropic Claude | `output_config.effort` (`low` … `max`); thinking bật = `{ type: "adaptive" }` | Opus 5.5 / Fable / Mythos: **không tắt được** (nút khoá). Sonnet 5.5: `{ type: "between_tools" }`. Opus 5 / Haiku 5.5: `{ type: "disabled" }`. Ba mô hình này khi tắt thinking chỉ nhận effort tối đa `high` – app tự hạ và báo. |
| OpenAI | `reasoning_effort` (`low` / `medium` / `high`; rất cao / tối đa → `xhigh`, lùi về `high` nếu không hỗ trợ) | `reasoning_effort: "none"`, lùi về `"minimal"` |
| Google Gemini | `thinkingConfig.thinkingLevel` (Gemini 3.x), lùi về `thinkingBudget` (Gemini 2.5) | `thinkingLevel: "minimal"`, lùi về `thinkingBudget: 0` |
| API kiểu OpenAI (OpenRouter, Groq, Cerebras, Mistral, Hugging Face, LM Studio, tuỳ chỉnh) | `reasoning_effort` như OpenAI, lùi về mặc định nếu máy chủ không nhận | `reasoning_effort: "none"`, lùi về mặc định |
| Ollama | `think: "low" / "medium" / "high"`, lùi về `true` rồi mặc định | `think: false`, lùi về mặc định (mô hình không hỗ trợ thinking) |

Nếu mô hình trả lỗi 400 vì không hiểu tham số, app tự thử phương án kế tiếp (cuối cùng là mặc định của mô hình)
và **ghi chú rõ** trong khung chat cấu hình nào đã thực sự được dùng.

### Gửi prompt

1. Gõ yêu cầu, bấm **Gửi** hoặc `Ctrl+Enter` (vd: *“Vẽ quy trình đăng ký tài khoản bằng BPMN có 2 lane”*).
2. Trong lúc chờ: trạng thái vui (“Vibing…”, “Hooking…”, “Cooking…”, “Nối mũi tên…”) xoay liên tục, đếm giây;
   nút Gửi thành **Dừng** để huỷ.
3. JSON trả về được đưa vào tab JSON và **áp dụng ngay** (vẫn qua bước kiểm tra hợp lệ).
4. App báo xong và nhắc **hoàn tác bằng nút ↶ (nhấp nháy) hoặc `Ctrl+Z`**. Câu trả lời dạng chữ (khi hỏi về
   diagram) và lỗi (key sai, hết hạn mức, mô hình không tồn tại…) hiện ngay trong khung chat.

### Skill chỉ đặt một lần

- API của các nhà cung cấp không lưu hội thoại giữa các lần gọi, nên mỗi request vẫn phải có hướng dẫn. App đặt
  **skill ở system instruction một lần cho cả cuộc trò chuyện** – không chép vào từng tin nhắn – và bật cache
  prompt (Claude: `cache_control`; OpenAI / Gemini tự cache phần đầu giống nhau) để không bị tính phí lại đầy đủ.
- Skill gồm cả 3 chế độ, nên đổi loại diagram giữa chừng vẫn giữ nguyên cuộc trò chuyện.
- Lịch sử chỉ giữ lời người dùng + phần giải thích của AI (bỏ khối JSON); **diagram hiện tại gửi kèm lượt mới
  nhất** nên AI luôn sửa đúng bản đang mở, kể cả khi bạn vừa chỉnh tay. Nút **Xoá hội thoại** để bắt đầu cuộc trò chuyện mới.

### Copy context (dùng với AI bên ngoài)

Nút **Copy context** sinh một **skill prompt** để dán vào Gemini, ChatGPT, Claude… (không cần API key). Chọn
**Tài liệu Markdown** để AI viết tài liệu có nhúng diagram – sao chép nguyên câu trả lời rồi dán vào tab Tài liệu, các
khối ```` ```diagram ```` tự thành diagram sửa được. Với diagram:
danh sách type kèm kích thước và ý nghĩa, quy tắc hợp lệ, quy tắc bố cục từng chế độ, ví dụ mẫu; tuỳ chọn chỉ
chế độ hiện tại hoặc cả 3, kèm diagram hiện tại để AI sửa tiếp. Sao chép hoặc tải `.md`. Dán skill + yêu cầu
vào AI, rồi dán câu trả lời vào tab JSON → **Áp dụng**. Nội dung sinh từ thư viện hình nên luôn khớp phiên bản app.

## Giọng nói

Bấm 🎤 trong khung chat hoặc nhấn **`Ctrl+M`** rồi nói – **nói xong app tự gửi**, không cần bấm thêm. Muốn sửa
câu chữ trước khi gửi thì cứ gõ phím như bình thường.

```text
 🎤 / Ctrl+M ──► Đang nghe (chữ hiện dần trong ô chat) ──► im lặng 1,2 giây
                                                              │
         ┌────────────────────────────────────────────────────┴───────────────┐
   câu khớp một LỆNH NGẮN                                         câu còn lại = PROMPT
   (“hoàn tác”, “vừa màn hình”…)                                           │
         │                                                 🔊 “Em nghe rồi, anh chờ em tí nhé.”
   chạy ngay, không gọi AI                                  gửi AI → áp dụng JSON
   🔊 “Đã hoàn tác.”                                        🔊 “Xong rồi, anh xem thử nhé.”
```

- **Phản hồi bằng giọng nói ngay khi gửi**: “Em nghe rồi, anh chờ em tí nhé”, “Rõ rồi, em làm ngay đây”… (đổi
  câu ngẫu nhiên); xong thì báo “Xong rồi, anh xem thử nhé” (lần đầu nhắc thêm “Không ưng thì nói hoàn tác nhé”).
  AI trả lời bằng chữ ngắn thì đọc luôn câu trả lời. Xưng hô chọn được: em – anh, em – chị, tôi – bạn, mình – bạn.
- **Lệnh giọng nói**: câu ngắn khớp *nguyên câu* chạy ngay, không gọi AI – hoàn tác, làm lại, vừa màn hình,
  phóng to / thu nhỏ, chọn tất cả, xoá, nhân bản, bật / tắt lưới, chế độ tối / sáng, tải JSON / PNG / SVG, nhúng
  SVG, tài liệu mới, chuyển sang Flowchart / BPMN / UML, trợ giúp, cuộc trò chuyện mới, dừng… Bỏ qua từ đệm
  (“hoàn tác **đi**”, “**giúp em** vừa màn hình **nhé**”). Câu dài hơn (“xoá node đăng nhập”) được gửi cho AI.
  Danh sách đầy đủ ở tab Trợ giúp và trong Cài đặt giọng nói.
- **Xác nhận bằng giọng nói**: khi app hỏi lại (tài liệu mới, chuyển chế độ, JSON cần sửa…) thì đọc câu hỏi và
  nghe “**đồng ý**” / “**huỷ**”.
- **Rảnh tay** (🎧 hoặc `Ctrl+Shift+M`): nghe → gửi → đọc kết quả → nghe tiếp. Nói “tắt rảnh tay”, nhấn `Esc`,
  hoặc im lặng 90 giây thì tự tắt.
- `Esc` khi đang nghe: huỷ, trả lại nội dung đang gõ dở trong ô chat.

### Bộ nhận dạng

Tab **⚙ Cài đặt → Giọng nói** (hoặc chuột phải vào 🎤) để chọn – đổi là lưu ngay:

| Bộ nhận dạng | Tải về | Đặc điểm |
| --- | --- | --- |
| **Web Speech API** (mặc định khi trình duyệt có) | 0 MB | Chữ hiện ngay trong lúc nói. Chrome / Edge gửi âm thanh tới máy chủ nhận dạng của hãng (cần mạng); Chrome 139+ có gói nhận dạng ngay trên máy thì app tự dùng. Firefox không có. |
| **Offline – Moonshine** | ~45 MB, một lần | [`moonshine-tiny-vi`](https://huggingface.co/bh4/moonshine-tiny-vi-ONNX) (tiếng Việt) / `moonshine-tiny` (English) + Silero VAD chạy bằng [transformers.js](https://huggingface.co/docs/transformers.js) trong Web Worker (giao diện không bị đơ). Âm thanh không rời máy; chữ hiện sau khi nói xong (~1–2 giây). Tải từ Hugging Face / jsDelivr khi dùng lần đầu, sau đó nằm trong cache của trình duyệt. |

“Tự động” chọn Web Speech nếu có, không thì hỏi tải bộ offline.

### Chọn micro

Trong Cài đặt giọng nói, mục **Micro** liệt kê các micro trên máy (mặc định: micro mặc định của hệ thống). Nút
**Thử micro** hiện thanh âm lượng: nói vài câu, thanh xanh nhảy theo giọng là đúng micro. Bộ offline luôn dùng micro
đã chọn; Web Speech dùng micro đã chọn trên Chrome / Edge bản mới (`start(audioTrack)`), bản cũ luôn dùng micro
mặc định của trình duyệt.

Khi nghe xong mà không có chữ nào, app tự chẩn đoán:

- Micro **có tiếng** nhưng trình duyệt không trả chữ → dịch vụ nhận dạng của trình duyệt không hoạt động (hay gặp
  ở Cốc Cốc, Brave, Opera, hoặc mạng chặn) → app đề nghị **chuyển sang bộ Offline**.
- Micro **im lặng hoàn toàn** → báo micro đó không thu được âm thanh, chọn micro khác.

### Giọng đọc

Mặc định dùng **[ResponsiveVoice](https://responsivevoice.org)** (giọng “Vietnamese Female”): máy có giọng tiếng
Việt thì đọc bằng giọng đó, không có thì đọc qua máy chủ ResponsiveVoice – nên đọc được cả trên máy chưa cài giọng.
SDK chỉ được nạp khi cần (không chặn app, không ảnh hưởng chạy offline). API key nằm trong `js/voice.js`
(`RV_KEY`) và **chỉ chạy trên tên miền đã khai báo trong dashboard ResponsiveVoice**.

ResponsiveVoice không tải được / bị chặn tên miền / mất mạng → tự chuyển sang `speechSynthesis` của trình duyệt →
không có giọng nào thì hiện thành chữ. Trong Cài đặt giọng nói có thể chọn hẳn một giọng ResponsiveVoice hoặc giọng
của máy, và bấm “Nghe thử” để biết đã đọc bằng nguồn nào. Cài thêm giọng tiếng Việt cho máy: Windows → Cài đặt →
Thời gian & ngôn ngữ → Giọng nói → Thêm giọng → Tiếng Việt (Microsoft Edge có sẵn giọng HoaiMy / NamMinh).

> Giọng đọc online: [ResponsiveVoice-NonCommercial](https://responsivevoice.org) licensed under
> [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/).

## Phím tắt

| Thao tác | Phím |
| --- | --- |
| Chọn / Kéo canvas / Vẽ đường nối | `V` / `H` (hoặc giữ `Space`) / `C` |
| Sửa chữ | Nhấn đúp, `Enter`, `F2` – lưu bằng `Ctrl+Enter`, huỷ bằng `Esc` |
| Thêm text tự do | Nhấn đúp vào vùng trống |
| Hoàn tác / Làm lại | `Ctrl+Z` / `Ctrl+Y` (hoặc `Ctrl+Shift+Z`) |
| Copy / Cắt / Dán / Nhân bản | `Ctrl+C` / `Ctrl+X` / `Ctrl+V` / `Ctrl+D` (hoặc `Alt` + kéo) |
| Xoá | `Delete` / `Backspace` |
| Zoom | `Ctrl` + cuộn chuột, `Ctrl +` / `Ctrl −`, `Ctrl+0`; vừa màn hình: `Shift+1` |
| Dịch chuyển | Phím mũi tên (`Shift`: theo bước lưới) |
| Thứ tự lớp | `Ctrl+]` lên trên cùng, `Ctrl+[` xuống dưới cùng |
| Lưu / Mở | `Ctrl+S` / `Ctrl+O` |
| Thu gọn / mở panel | `Ctrl+B` (thư viện) / `Ctrl+Alt+B` (thuộc tính) |
| Gửi prompt cho AI | `Ctrl+Enter` trong ô chat |
| Nói với AI | `Ctrl+M` (nói xong tự gửi) · `Ctrl+Shift+M` rảnh tay · `Esc` huỷ khi đang nghe |
| Chuyển tab Tài liệu / Diagram / Thiết kế trang / Hướng dẫn / Cài đặt | `Alt+1` … `Alt+5` |
| Tab Tài liệu | `Ctrl+S` lưu · `Ctrl+Shift+S` lưu thành · `Ctrl+O` mở · `Ctrl+B` / `Ctrl+I` / `Ctrl+K` / `Ctrl+E` đậm / nghiêng / link / code |
| Tab Thiết kế trang | Nhấn đúp / `Enter` / `F2` sửa chữ · `Esc` chọn khung chứa · `↑` `↓` thành phần trước / sau · `Alt+↑` / `Alt+↓` đổi thứ tự · `Ctrl+C` / `Ctrl+X` / `Ctrl+V` / `Ctrl+D` · `Delete` · `Ctrl+Z` / `Ctrl+Y` · `Ctrl+S` tải JSON · `Ctrl+O` mở |

## Cấu trúc JSON

```json
{
  "version": 1,
  "meta": { "name": "Quy trình xử lý đơn hàng", "mode": "flowchart" },
  "nodes": [
    { "id": "start", "type": "flow.terminator", "x": 330, "y": 40, "w": 140, "h": 50,
      "text": "Bắt đầu", "style": {} },
    { "id": "check", "type": "flow.decision", "x": 330, "y": 230, "w": 140, "h": 90,
      "text": "Còn hàng?", "style": { "fill": "#fef3c7", "stroke": "#d97706" } }
  ],
  "edges": [
    { "id": "e1", "type": "flow.arrow", "source": "start", "target": "check", "label": "" }
  ]
}
```

### Node

| Trường | Ý nghĩa |
| --- | --- |
| `id` | Định danh duy nhất (chuỗi, không trùng với node / edge khác) |
| `type` | Loại hình, ví dụ `flow.process`, `bpmn.userTask`, `uml.class` (xem danh sách bên dưới) |
| `x`, `y`, `w`, `h` | Vị trí góc trên trái và kích thước (số, `w`/`h` > 0) |
| `text` | Nội dung. Với `uml.class`, `uml.state`, `erd.table`…, dùng một dòng `--` để chia ngăn |
| `style` | Ghi đè style: `fill`, `stroke`, `strokeWidth`, `dash` (`solid`/`dashed`/`dotted`/`dashdot`), `textColor`, `fontSize`, `fontWeight`, `fontStyle`, `align` |

Có thể thêm trường tuỳ ý (ví dụ `"data": {...}`); editor giữ nguyên các trường này.

### Edge

| Trường | Ý nghĩa |
| --- | --- |
| `id`, `type` | Định danh và kiểu đường nối, ví dụ `bpmn.messageFlow`, `uml.composition` |
| `source`, `target` | `id` của node nguồn / đích |
| `sourcePort`, `targetPort` | `top` / `right` / `bottom` / `left`; bỏ trống để tự chọn |
| `sourceAnchor`, `targetAnchor` | 0..1 – vị trí dọc trên lifeline / activation (sequence diagram) |
| `routing` | `orthogonal` / `straight` / `curved` (mặc định theo kiểu đường nối) |
| `label`, `labelPos` | Nhãn và vị trí nhãn dọc theo đường (0..1) |
| `midX`, `midY` | Vị trí đoạn giữa của đường vuông góc do người dùng kéo (toạ độ x khi đoạn giữa nằm dọc, y khi nằm ngang); bỏ trống = tự động |
| `style` | `stroke`, `strokeWidth`, `dash`, `startArrow`, `endArrow`, `fontSize`, `textColor` |

Các kiểu mũi tên: `none`, `arrow`, `open`, `triangle`, `diamond`, `diamondFilled`, `circle`, `circleFilled`,
`slash`, `erOne`, `erOnlyOne`, `erMany`, `erOneMany`, `erZeroOne`, `erZeroMany`.

### Danh sách type

Gõ trong DevTools console: `diagram.shapes()` và `diagram.connectors()`. Tên đầy đủ có tiền tố nhóm, ví dụ
`bpmn.userTask`, `uml.class`.

- **basic**: `sticky`, `text`, `heading`, `rect`, `roundrect`, `ellipse`, `triangle`, `cloud`, `frame`
- **flow**: `terminator`, `process`, `decision`, `data`, `predefined`, `document`, `multiDocument`, `manualInput`,
  `manualOperation`, `preparation`, `database`, `delay`, `display`, `connector`, `offPage`, `comment`
- **bpmn**: `startEvent`, `startMessage`, `startTimer`, `intermediateEvent`, `intermediateMessage`,
  `intermediateThrowMessage`, `intermediateTimer`, `endEvent`, `endMessage`, `endError`, `endTerminate`,
  `task`, `userTask`, `serviceTask`, `scriptTask`, `businessRuleTask`, `manualTask`, `sendTask`, `receiveTask`,
  `subProcess`, `expandedSubProcess`, `callActivity`, `exclusiveGateway`, `parallelGateway`, `inclusiveGateway`,
  `eventGateway`, `complexGateway`, `dataObject`, `dataStore`, `message`, `pool`, `lane`, `annotation`, `group`
- **uml**: `class`, `abstractClass`, `interface`, `enum`, `object`, `package`, `component`, `providedInterface`,
  `requiredInterface`, `port`, `node`, `artifact`, `note`, `actor`, `useCase`, `systemBoundary`, `initial`,
  `final`, `flowFinal`, `action`, `state`, `decision`, `forkH`, `forkV`, `signalSend`, `signalReceive`,
  `timeEvent`, `partition`, `objectNode`, `history`, `lifeline`, `actorLifeline`, `activation`, `fragment`
- **erd**: `table`, `entity`, `weakEntity`, `relationship`, `attribute`, `keyAttribute`

### API trong console

```js
diagram.json                                  // bản sao JSON hiện tại
diagram.load({ nodes: [...], edges: [...] })  // nạp tài liệu
const a = diagram.add('uml.class', 100, 100, { text: 'User\n--\n- id: int' })
const b = diagram.add('uml.class', 400, 100, { text: 'Admin' })
diagram.connect('uml.generalization', b, a)
diagram.markdown()                            // nội dung file .md của tab Tài liệu (diagram đã nhúng)
diagram.pages()                               // dự án tab Thiết kế trang (JSON)
diagram.pageHTML()                            // file HTML xuất ra từ dự án trang
```

## Cấu trúc mã nguồn

```text
index.html             giao diện chính (+ meta SEO, JSON-LD, manifest)
css/styles.css         giao diện, chế độ sáng / tối
js/util.js             tiện ích, đo & ngắt dòng chữ
js/shapes.js           thư viện hình + kiểu đường nối + DE.MODES   ← thêm hình mới ở đây
js/render.js           vẽ SVG, định tuyến đường nối, mũi tên
js/store.js            mô hình JSON, chuẩn hoá / kiểm tra hợp lệ, undo / redo
js/templates.js        diagram mẫu (UML nhóm theo quá trình ISO/IEC/IEEE 12207)
js/help.js             nội dung trợ giúp: ý nghĩa ký hiệu, đường nối, quy ước từng chế độ
js/skill.js            sinh skill prompt cho AI (từ thư viện hình)
js/ai.js               cấu hình AI, tải danh sách mô hình, gọi chat (Gemini / OpenAI / Claude)
js/voice.js            giọng nói: Web Speech / Moonshine offline, lệnh giọng nói, đọc phản hồi, rảnh tay
js/export.js           xuất SVG / PNG, nhúng Markdown
js/markdown.js         render Markdown → HTML (CommonMark + GFM + công thức, Mermaid, chú thích, emoji, [TOC], front matter) + làm sạch HTML
js/md-rich.js          vẽ Mermaid / KaTeX / tô màu code / emoji (tải thư viện từ CDN khi cần, có SRI), hộp thoại sửa có xem trước
js/plantuml.js         dịch PlantUML và Mermaid → JSON diagram (lưu đồ, sequence, use case, class, activity, state, component, ER) + tự dàn trang, chạy offline
js/doc-library.js      thư viện mẫu tài liệu: danh mục, hộp chọn mẫu, điền mã dự án, mở mẫu liên quan, danh mục cho AI
js/docs.js             tab Tài liệu: soạn / xem .md, mở / lưu file, nhúng & sửa diagram (phiên nhúng), áp dụng tài liệu từ AI
js/guide.js            tab Hướng dẫn: nội dung hướng dẫn sử dụng (Markdown), mục lục, tìm kiếm, nút “Thử” ví dụ prompt
js/page-kit.js         thiết kế trang – lõi: danh mục thành phần & thuộc tính, chuẩn hoá / lọc JSON, sinh HTML + CSS, file HTML xuất ra, skill AI
js/page-editor.js      thiết kế trang – giao diện: khung iframe, kéo thả, sửa chữ trực tiếp, bảng thuộc tính, lớp, trang, xem thử
js/settings.js         tab Cài đặt: giao diện sáng / tối, trợ lý AI (form + effort / thinking), giọng nói, ứng dụng & dữ liệu
js/editor.js           tương tác canvas (chọn, kéo, resize, nối, phím tắt)
js/ui.js               toolbar, thư viện, bảng thuộc tính, tab JSON, trợ giúp, khung chat AI
js/main.js             khởi động, tự lưu, PWA
sw.js                  service worker (offline)
manifest.webmanifest   cấu hình PWA
icons/                 icon SVG gốc + PNG (192 / 512, maskable, apple-touch-icon)
templates/             24 mẫu tài liệu thiết kế phần mềm (Markdown + diagram nhúng), README hướng dẫn bộ mẫu
llms.txt, robots.txt, sitemap.xml, og-image.png   SEO / AI SEO
.nojekyll              tắt Jekyll trên GitHub Pages để file .md trong templates/ được phục vụ nguyên bản
```

### Thêm một hình mới

Trong `js/shapes.js`:

```js
def('flow.myShape', {
  cat: 'flow', name: 'My Shape', w: 140, h: 70, text: 'Nội dung',
  style: { fill: '#ecfeff', stroke: '#0891b2' },
  render: (n, s, a) => rect(n.w, n.h, a(), 8),   // SVG trong toạ độ cục bộ 0..w, 0..h
});
```

Nhóm `cat` quyết định hình thuộc chế độ nào (xem `DE.MODES` cuối `shapes.js`). Thêm mô tả vào `DE.HELP.shapes`
trong `js/help.js` để hình xuất hiện trong tab Trợ giúp – skill prompt cho AI sẽ tự có hình mới.

## Triển khai

Trang chạy trên **GitHub Pages** (Deploy from a branch: `main`, thư mục `/`) với domain riêng
`design.trungctr.com`:

- File `CNAME` trong repo lưu custom domain của GitHub Pages – **không xoá**.
- File `.nojekyll` (rỗng) – **không xoá**: thiếu nó, GitHub Pages chạy Jekyll, đổi các file `.md` thành `.html` và
  app không tải được mẫu tài liệu.
- DNS (Cloudflare): bản ghi `CNAME design → trungctr.github.io`, chế độ **DNS only**; bật **Enforce HTTPS**
  trong Settings → Pages.
- Khi phát hành bản mới có thêm / bớt file: cập nhật `PRECACHE` và tăng `VERSION` trong `sw.js`; cập nhật
  `<lastmod>` trong `sitemap.xml` khi nội dung trang thay đổi.
