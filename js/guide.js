/* =========================================================================
 * Tab "Hướng dẫn": hướng dẫn sử dụng bộ công cụ (Tài liệu + Diagram + Thiết kế trang + Chat AI).
 * Nội dung viết bằng Markdown (DE.GUIDE_MD), render bằng js/markdown.js.
 *  - Mục lục bên trái (tự sinh từ tiêu đề), tìm kiếm lọc theo mục.
 *  - Dòng "💬 Tài liệu: …" / "💬 Diagram: …" / "💬 Trang: …" có nút "Thử" – gửi ví dụ vào khung chat AI.
 *  - Link [chữ](#go-doc) / (#go-diagram) / (#go-design) chuyển sang tab tương ứng;
 *    (#go-settings-ai) / (#go-settings-voice) / (#go-settings-look) / (#go-settings-app) mở tab Cài đặt đúng nhóm.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const { esc } = DE;
  const $ = (q, el = document) => el.querySelector(q);

  DE.GUIDE_MD = `
# Hướng dẫn sử dụng

**Diagram Editor** là bộ công cụ soạn **tài liệu thiết kế phần mềm**: viết tài liệu như soạn văn bản, vẽ diagram
(Flowchart, BPMN, UML, ERD) trên whiteboard rồi nhúng vào tài liệu, **thiết kế trang web bằng kéo thả**, và nhờ **AI**
viết giúp cả tài liệu, diagram lẫn trang web. Mọi thứ chạy ngay trên trình duyệt, không cần tài khoản, dữ liệu nằm trên máy bạn.

## Bắt đầu nhanh

1. Mở tab **[Tài liệu](#go-doc)** và gõ nội dung như trong Word.
2. Đặt con trỏ ở chỗ cần hình minh hoạ, bấm **◆ Diagram mới** → vẽ ở tab Diagram → bấm **✓ Chèn vào tài liệu**.
3. Bấm **Lưu** (\`Ctrl+S\`) để ghi ra file \`.md\` – mở được trong VS Code, Typora, Obsidian… với diagram hiển thị sẵn.
4. Muốn nhanh hơn? Gõ yêu cầu vào **khung chat AI** ở góc dưới bên phải, ví dụ:

- 💬 Tài liệu: Viết đặc tả chức năng đặt hàng online, có use case diagram và sequence diagram
- 💬 Diagram: Vẽ quy trình duyệt đơn nghỉ phép bằng BPMN có 2 lane: Nhân viên và Quản lý
- 💬 Trang: Dựng trang giới thiệu cho tiệm bánh ngọt: thanh điều hướng, ảnh bìa, 3 món nổi bật và form đặt bánh

> [!TIP]
> Khung chat AI có ở mọi tab. Lần đầu dùng, mở **[⚙ Cài đặt → Trợ lý AI](#go-settings-ai)** để chọn nhà cung cấp AI
> (có nhiều lựa chọn miễn phí – xem mục [Chat AI](#chat-ai)).

## Giao diện

Năm tab ở trên cùng:

| Tab | Phím tắt | Dùng để |
| --- | --- | --- |
| 📄 **Tài liệu** | \`Alt+1\` | Soạn và xem tài liệu \`.md\`, nhúng diagram |
| ◆ **Diagram** | \`Alt+2\` | Whiteboard vẽ diagram |
| ▤ **Thiết kế trang** | \`Alt+3\` | Dựng trang web bằng kéo thả, xuất file HTML |
| ❓ **Hướng dẫn** | \`Alt+4\` | Trang bạn đang đọc |
| ⚙ **Cài đặt** | \`Alt+5\` | Sáng / tối, trợ lý AI, giọng nói, cài như ứng dụng (tab ở góc phải) |

Thanh công cụ chia thành **các nhóm**; khi cửa sổ hẹp, các nhóm tự **xuống hàng** để mọi nút vẫn luôn hiện đủ.

### Cài đặt

Mọi cài đặt chung nằm ở tab **⚙ Cài đặt** (\`Alt+5\`), chia 4 nhóm ở cột trái. Đổi là lưu ngay (riêng phần nhà cung cấp AI
bấm **Lưu cài đặt AI**). Nút **← Quay lại** ở góc dưới trái đưa bạn về tab đang làm.

| Nhóm | Có gì |
| --- | --- |
| [Giao diện](#go-settings-look) | Chế độ **sáng**, **tối** hoặc **theo hệ thống** (tự đổi theo máy) |
| [Trợ lý AI](#go-settings-ai) | Nhà cung cấp, API key, mô hình; **effort** (mức suy luận) và **thinking** (bật / tắt suy luận) |
| [Giọng nói](#go-settings-voice) | Bộ nhận dạng (có bản offline), micro, ngôn ngữ, lệnh giọng nói, giọng đọc |
| [Ứng dụng & dữ liệu](#go-settings-app) | Cài như ứng dụng, trạng thái chạy offline, dung lượng đã lưu trong trình duyệt, phím tắt chung |

## Soạn tài liệu

### Gõ và định dạng

Gõ trực tiếp vào trang. Thanh công cụ (từ trái sang): **Mới · Mở · Lưu · tên file** – **H1 H2 H3** (tiêu đề) –
**B** đậm · *I* nghiêng · ~~S~~ gạch · \`</>\` code – liên kết · ảnh – danh sách · danh sách số · việc cần làm –
trích dẫn · khối code · bảng · đường kẻ – **∑** công thức · **[1]** chú thích · mục lục.

- Bôi đen chữ rồi bấm nút để định dạng; bấm lại để bỏ.
- \`Ctrl+B\` đậm · \`Ctrl+I\` nghiêng · \`Ctrl+K\` liên kết · \`Ctrl+E\` code · \`Tab\` / \`Shift+Tab\` thụt lề danh sách.
- **Liên kết**: bấm vào liên kết để sửa chữ; \`Ctrl\` + bấm để mở.
- **Ảnh**: nhập địa chỉ ảnh, chọn ảnh từ máy, dán ảnh (\`Ctrl+V\`) hoặc kéo thả ảnh vào trang – ảnh từ máy được nhúng thẳng vào file.
- **Việc cần làm**: bấm vào ô vuông để đánh dấu xong.
- **Dán từ Word / trang web**: giữ tiêu đề, danh sách, bảng, chữ đậm…; bỏ màu sắc và font lạ.

### Chèn và sửa diagram

| Muốn | Làm |
| --- | --- |
| Vẽ diagram mới | Đặt con trỏ → **◆ Diagram mới** → vẽ → **✓ Chèn vào tài liệu** |
| Sửa diagram đã chèn | Rê chuột lên diagram → **✎ Sửa** (hoặc nhấn đúp) → sửa → **✓ Cập nhật vào tài liệu** |
| Bỏ dở | Bấm **Huỷ** trên thanh thông báo ở tab Diagram |
| Đưa diagram đang vẽ vào tài liệu | Nút **Vào tài liệu** trên thanh công cụ Diagram |
| Dùng file diagram \`.json\` có sẵn | Kéo thả file vào tab Tài liệu |
| Tải riêng ảnh một diagram | Rê chuột lên diagram → **SVG** |
| Xoá diagram | Rê chuột lên diagram → **Xoá** (\`Ctrl+Z\` để lấy lại) |

> [!NOTE]
> Khi bạn vẽ / sửa diagram cho tài liệu, diagram đang vẽ dở ở tab Diagram được cất lại và trả về nguyên vẹn khi xong.

### Công thức, Mermaid, chú thích, mục lục

Tài liệu hiển thị được những gì GitHub, VS Code, Obsidian, Typora hiển thị. Không cần nhớ cú pháp: dùng các nút
**∑** (công thức), **[1]** (chú thích) và nút **mục lục** trên thanh công cụ. **Nhấn đúp** vào công thức, chú thích hay
bảng thông tin đầu tài liệu để sửa – hộp thoại có **xem trước** ngay.

**Sơ đồ Mermaid** có sẵn trong file (mở file, dán vào, hoặc AI viết) được vẽ ra như trên GitHub. Muốn sửa: **nhấn đúp**
(hoặc **◆ Sửa trên whiteboard**) – sơ đồ được **chuyển thành diagram của ứng dụng** để sửa kéo thả. Chuyển được: lưu đồ
(flowchart / graph), tuần tự, class, state, ER. Loại không có dạng tương ứng trên whiteboard (Gantt, biểu đồ tròn, sơ đồ tư
duy, dòng thời gian…) thì sửa bằng mã.

| Muốn có | Viết trong Markdown (chế độ developer) |
| --- | --- |
| Công thức trong dòng | \`$E=mc^2$\` (hoặc \`$\`…\`$\` kiểu GitHub) |
| Công thức riêng một khối | dòng \`$$\`, công thức, dòng \`$$\` – hoặc khối \`\` \`\`\`math \`\` |
| Sơ đồ Mermaid có sẵn (lưu đồ, Gantt, biểu đồ tròn, sơ đồ tư duy…) | khối \`\` \`\`\`mermaid \`\` |
| Chú thích cuối trang | \`[^1]\` trong câu, và một dòng \`[^1]: nội dung\` |
| Mục lục tự động | một dòng \`[TOC]\` |
| Emoji | \`:rocket:\` \`:tada:\` \`:white_check_mark:\` (tên giống GitHub) |
| Tô sáng chữ | \`==chữ==\` |
| Hộp ghi chú màu | \`> [!NOTE]\` · \`> [!TIP]\` · \`> [!WARNING]\`… và kiểu Obsidian \`> [!tip] Tiêu đề riêng\` |
| Thông tin đầu tài liệu (front matter) | khối \`---\` … \`---\` ở đầu file, mỗi dòng \`khoá: giá trị\` |

- **Khối code** có tên ngôn ngữ (\`\`\`js, \`\`\`python, \`\`\`sql…) được **tô màu cú pháp**.
- Vẽ lưu đồ, BPMN, UML, ERD mới: dùng **◆ Diagram mới**.
- Thư viện vẽ (Mermaid, KaTeX, highlight.js) được tải từ internet **ở lần dùng đầu tiên**, sau đó chạy cả khi offline.
  Khi chưa tải được, tài liệu vẫn hiện mã gốc và không mất gì.
- File \`.md\` lưu đúng cú pháp chuẩn ở trên, nên mở trên GitHub, VS Code, Obsidian vẫn hiển thị. File **HTML** xuất ra chứa sẵn
  hình sơ đồ và công thức, không cần mạng.

### Sơ đồ PlantUML

Có sẵn mã PlantUML (\`@startuml\` … \`@enduml\`)? Ứng dụng **tự dịch** nó thành diagram của whiteboard và vẽ ngay trên máy –
**không gửi mã lên máy chủ nào**.

| Muốn | Làm |
| --- | --- |
| Đưa vào tài liệu | **Dán** mã PlantUML vào trang (tự bọc thành khối \`\` \`\`\`plantuml \`\`), hoặc kéo thả file \`.puml\` vào tab Tài liệu |
| Sửa | **Nhấn đúp** vào sơ đồ (hoặc **◆ Sửa trên whiteboard**): khối PlantUML được chuyển thành diagram của ứng dụng, mở ở tab Diagram để sửa kéo thả |
| Mở thành diagram | Nút **Mở** ở tab Diagram chọn file \`.puml\`, kéo thả file vào tab Diagram, hoặc dán mã vào ô **JSON** rồi **Áp dụng** |

- Hỗ trợ: **sequence** (tuần tự), **use case**, **class**, **activity** (cả cú pháp mới và cũ, có làn bơi), **state**,
  **component / deployment**, **ER** (cơ sở dữ liệu, chân chim).
- Màu sắc, \`skinparam\`, \`!include\` và vài lệnh hiếm được **bỏ qua** – ở tab Tài liệu có dòng ⚠ liệt kê những gì đã bỏ qua.
- Loại khác (mindmap, gantt, wireframe…) hiện thông báo rõ ràng kèm mã gốc – nút **✎ Sửa mã** để sửa.
- File \`.md\` vẫn giữ nguyên mã PlantUML cho tới khi bạn sửa sơ đồ – sau đó khối đó là diagram của ứng dụng (không còn mã PlantUML).

### Mở, lưu và kéo thả

- **Mở**: nút Mở (\`Ctrl+O\`) hoặc **kéo thả file \`.md\` từ máy vào bất kỳ đâu trong cửa sổ**.
- **Lưu**: nút Lưu (\`Ctrl+S\`). Trên Chrome / Edge, lần sau \`Ctrl+S\` ghi thẳng vào file đang mở; trình duyệt khác sẽ tải file xuống.
  \`Ctrl+Shift+S\`: lưu thành file khác.
- **Tải xuống**: \`.md\` (tài liệu) hoặc **HTML** (trang web độc lập – mở bằng trình duyệt rồi in ra PDF).
- Tài liệu **tự lưu vào trình duyệt** – đóng tab mở lại vẫn còn. Dấu ● cạnh tên file nghĩa là chưa lưu ra file.

### Diagram nằm trong file .md như thế nào?

Mỗi diagram được lưu thành 3 dòng: một chú thích ẩn chứa dữ liệu (để mở lại sửa tiếp), **ảnh SVG** của diagram,
và chú thích kết thúc. Nhờ vậy file \`.md\` hiển thị diagram trong mọi trình xem Markdown cho phép HTML
(VS Code, Typora, Obsidian, MkDocs, trình duyệt…).

> [!WARNING]
> GitHub chặn ảnh SVG nhúng trong file Markdown. Để đăng lên GitHub, hãy tải ảnh SVG của diagram (nút **SVG** khi rê chuột)
> và chèn bằng đường dẫn ảnh.

### Chế độ developer

Bấm **</> Developer** để thấy và sửa trực tiếp mã Markdown: **Mã** · **Chia đôi** (mã và trang soạn song song, cuộn đồng bộ)
· **Trực quan**. Nút **Xem file thật** hiện đúng nội dung file sẽ được lưu.

## Vẽ diagram

### Chế độ và ký hiệu

Chọn **Flowchart**, **BPMN** hoặc **UML** (gồm cả ERD) ở đầu thanh công cụ. Thư viện bên trái chỉ hiện ký hiệu của chế độ đó;
tab **Trợ giúp** ở bảng bên phải giải thích ý nghĩa từng ký hiệu và mũi tên. Ô **Mẫu diagram…** có sẵn nhiều mẫu để bắt đầu.

### Thao tác

| Thao tác | Cách làm |
| --- | --- |
| Thêm hình | Kéo hình từ thư viện bên trái vào whiteboard (hoặc bấm vào hình) |
| Nối hai hình | Rê chuột lên hình, kéo từ chấm xanh sang hình kia; thả ra chỗ trống để tạo nhanh hình mới đã nối |
| Dời đoạn giữa của mũi tên vuông góc | Chọn mũi tên, kéo tay nắm ở giữa (hoặc chính đoạn giữa); nhấn đúp tay nắm để về tự động |
| Sửa chữ | Nhấn đúp vào hình hoặc đường nối · \`Ctrl+Enter\` lưu · \`Esc\` huỷ |
| Thêm chữ tự do | Nhấn đúp vào chỗ trống |
| Chọn nhiều | Kéo vùng chọn, hoặc giữ \`Shift\` khi bấm |
| Di chuyển whiteboard | Giữ \`Space\` rồi kéo, hoặc công cụ bàn tay (\`H\`) |
| Zoom | \`Ctrl\` + cuộn chuột · \`Shift+1\` vừa màn hình |
| Đổi màu, nét, kiểu mũi tên | Chọn hình / đường nối → bảng **Thuộc tính** bên phải |
| Container (Pool, Lane, Package…) | Kéo container sẽ kéo theo các hình bên trong |

### Lưu và xuất diagram

- **JSON**: định dạng gốc, mở lại để sửa tiếp. **SVG / PNG**: ảnh.
- **Nhúng SVG**: mã dán thẳng vào file Markdown bất kỳ.
- Tab **JSON** ở bảng bên phải: xem / sửa toàn bộ dữ liệu diagram, bấm **Áp dụng**.

## Thiết kế trang

Tab **[Thiết kế trang](#go-design)** dựng trang web bằng **kéo thả** – giống Figma nhưng đơn giản hơn nhiều: bạn không vẽ
từng hình mà xếp các **thành phần dựng sẵn** (hàng, cột, nút bấm, menu, bảng…) vào trang. Trang tự co giãn cho
máy tính, máy tính bảng và điện thoại. Lần đầu mở tab có sẵn một **dự án mẫu 3 trang** để bạn xem và sửa thử.

### Bố cục màn hình

- **Bên trái – Thành phần**: thư viện thành phần. **Kéo** một thành phần thả vào trang (vạch xanh lá cho biết chỗ sẽ thả),
  hoặc **bấm** để thêm vào ngay sau thành phần đang chọn. Tab **Lớp** hiện cây các thành phần của trang: bấm để chọn,
  kéo để đổi chỗ / đổi khung chứa, nhấn đúp để đặt tên.
- **Giữa – trang**: bấm để chọn, **nhấn đúp vào chữ / nút / ô bảng để sửa ngay trên trang**. Các trang của dự án là
  các tab phía trên (**＋ Trang** để thêm – trang mới chép sẵn phần đầu và chân trang của trang chủ).
- **Bên phải – Thuộc tính**: chỉnh thành phần đang chọn, chia nhóm (bấm tên nhóm để mở / đóng). Không chọn gì thì bảng
  này là thiết lập của **trang** và **cả dự án** (font chữ chung, màu chủ đạo…). Tab **JSON** cho người rành kỹ thuật.

Nhãn xanh trên thành phần đang chọn có các nút: ⤴ chọn khung chứa bên ngoài · ✥ giữ để kéo di chuyển · ↑ ↓ đổi thứ tự ·
nhân bản · xoá.

### Thành phần có sẵn

| Nhóm | Thành phần | Ghi chú |
| --- | --- | --- |
| Bố cục | Khối trang · Hàng · Cột · Thẻ | **Khối trang** là dải ngang cả trang (phần đầu, nội dung, chân trang); **Hàng** xếp con theo hàng ngang; **Cột** xếp con theo chiều dọc – đặt nhiều cột trong một hàng để chia cột |
| Nội dung | Tiêu đề · Đoạn văn · Nút bấm · Ảnh · Danh sách | Ảnh: dán địa chỉ, tải từ máy hoặc kéo thả file ảnh vào trang |
| Điều hướng | Menu bảng nhỏ · Menu toàn trang · Nút mở menu ☰ | Menu chỉ hiện khi bấm nút có loại “Mở menu” |
| Biểu mẫu | Biểu mẫu · Ô nhập · Ô nhiều dòng · Hộp chọn · Ô đánh dấu · Nút gửi | Đặt các ô và nút gửi **bên trong** một Biểu mẫu |
| Dữ liệu | Bảng | Sửa ô ngay trên trang (\`Tab\` sang ô kế), hoặc dán từ Excel |
| Ngăn cách | Thanh ngang · Thanh dọc · Khoảng trống | Thanh dọc dùng trong một Hàng |
| Mẫu dựng sẵn | Thanh điều hướng · Ảnh bìa · 3 tính năng · Bảng giá · Biểu mẫu liên hệ · Chân trang | Kéo vào là có cả cụm đã căn chỉnh đẹp |

### Nút bấm

- **Định dạng**: kiểu nhanh (nền đặc, viền, nền nhạt, chỉ chữ), kích thước, màu nền, màu chữ, viền, font, cỡ chữ,
  đậm / nghiêng / gạch chân / IN HOA, giãn cách chữ, độ rộng (vừa chữ, giãn hết, cố định), đệm trong, bo góc, đổ bóng.
- **Loại nút – khi bấm** (chọn một): **Chuyển trang** (tới một trang trong dự án hoặc một địa chỉ web) ·
  **Mở menu** (chọn menu, hoặc tạo menu mới ngay tại đó) · **Gửi / chạy chức năng** (gửi biểu mẫu chứa nút,
  hiện một thông báo, hoặc gọi hàm JavaScript viết trong “Mã JavaScript của dự án”).
- **Hiệu ứng khi di chuột qua / khi bấm**: tích các thay đổi muốn có – đổi màu nền / chữ / viền, phóng to, nhấc lên,
  đổ bóng, độ rõ – và chọn tốc độ. Bấm **Khi di chuột qua** / **Khi bấm** ở dòng “Xem trước” để thấy ngay trên trang.

Thẻ, ảnh, hàng, cột… cũng có nhóm hiệu ứng này (ví dụ thẻ nhấc lên khi di chuột qua).

### Menu

- Hai loại: **bảng nhỏ** (hiện ngay cạnh nút – dưới nút căn trái / phải, hoặc trên nút) và **toàn trang** (phủ kín màn hình,
  hợp cho điện thoại, có nút đóng ×).
- Thuộc tính: nền (màu, ảnh nền, làm tối ảnh), bo góc, viền, bóng, cách xếp các mục, hiệu ứng mở, đóng khi bấm ra ngoài /
  khi chọn một mục.
- Trên trang soạn, menu thu thành một **dải tím mỏng** để bố cục giống trang thật; bấm vào dải (hoặc chọn trong tab Lớp)
  để mở ra và sửa các mục. Các mục menu thường là **Nút bấm** kiểu “chỉ chữ”.

### Màn hình nhỏ (responsive)

- Đổi **Máy tính / Máy tính bảng / Điện thoại** trên thanh công cụ để xem trang ở từng cỡ màn hình.
- **Hàng** tự xếp chồng thành cột trên điện thoại (tắt bằng “Trên điện thoại: xếp chồng thành cột dọc”).
- Nhóm **Hiển thị** của mọi thành phần có **Ẩn trên điện thoại** / **Ẩn trên máy tính** – ví dụ thanh nút chỉ hiện trên máy tính,
  còn nút ☰ mở menu toàn trang chỉ hiện trên điện thoại (thanh điều hướng mẫu đã làm sẵn như vậy).

### Xem thử và xuất file

- **▶ Xem thử**: chạy trang như thật – bấm nút, mở menu, chuyển trang, gửi biểu mẫu – ở cỡ máy tính, máy tính bảng hoặc điện thoại.
- **Tải xuống HTML**: một file \`.html\` chứa **mọi trang** (chuyển trang bằng địa chỉ \`#/duong-dan\`), mở bằng trình duyệt
  hoặc đưa lên hosting tĩnh (GitHub Pages, Netlify…).
- **Tải xuống JSON** (\`Ctrl+S\`): file dự án để mở lại và sửa tiếp (nút Mở, \`Ctrl+O\`, hoặc kéo thả file vào cửa sổ).
- Dự án **tự lưu vào trình duyệt**. Ảnh tải lên được nhúng thẳng vào dự án (ảnh lớn tự thu nhỏ còn cạnh dài 1600px).

## Chat AI

### Cài đặt lần đầu

1. Mở **[⚙ Cài đặt → Trợ lý AI](#go-settings-ai)** (hoặc nút cài đặt ở góc khung chat – chấm cam nghĩa là chưa có key).
2. Chọn nhà cung cấp – có gói **miễn phí**: **Google Gemini**, **OpenRouter** (mô hình 🆓), **Groq**, **Cerebras**, **Mistral**;
   hoặc chạy trên máy với **Ollama** / **LM Studio**. Bấm “Lấy API key ↗” để tạo key.
3. Dán key, chọn mô hình, bấm **Lưu cài đặt AI**. Ngay bên dưới có **Effort** và **Thinking** để AI trả lời kỹ hơn hay nhanh hơn.

Đổi mô hình nhanh: dropdown mô hình ngay trên khung chat.

> [!IMPORTANT]
> API key chỉ lưu trong trình duyệt này và chỉ gửi thẳng tới nhà cung cấp bạn chọn. Không nên lưu key trên máy dùng chung.

### Nhờ AI làm việc

AI biết bạn đang ở tab nào:

- **Tab Tài liệu** – AI viết mới hoặc sửa **toàn bộ tài liệu**, có thể **tự vẽ diagram** và chèn vào đúng chỗ.
  Không ưng: bấm **↶ Hoàn tác thay đổi của AI** trong khung chat.
- **Tab Diagram** – AI vẽ / sửa diagram đang mở. Không ưng: \`Ctrl+Z\`.
- **Tab Thiết kế trang** – AI dựng mới hoặc sửa **cả dự án trang web** (thêm trang, đổi màu, thêm menu, biểu mẫu…).
  Không ưng: **↶ Hoàn tác thay đổi của AI** hoặc \`Ctrl+Z\`.
- **Tab Hướng dẫn** – hỏi AI cách dùng công cụ.

Gửi bằng nút **Gửi** hoặc \`Ctrl+Enter\`. Các lượt hỏi – đáp hiện trong khung tin nhắn và AI nhớ chúng.

| Nút | Ở đâu | Việc |
| --- | --- | --- |
| 🗑 **Xoá hội thoại** | góc trên trái khung chat | Xoá lịch sử, bắt đầu cuộc trò chuyện mới |
| ⇕ Thu gọn khung tin nhắn | góc trên phải | Ẩn lịch sử, chỉ giữ ô nhập (gửi tin mới thì tự mở lại) |
| ⤡ Thu nhỏ khung chat | góc trên phải | Thu khung chat thành nút **Chat AI** |
| ↶ **Hoàn tác thay đổi của AI** | trong câu trả lời | Trả tài liệu / trang về như trước lần AI sửa gần nhất |

### Ví dụ yêu cầu (bấm “Thử” để gửi vào khung chat)

- 💬 Tài liệu: Viết tài liệu thiết kế hệ thống quản lý thư viện: tổng quan, ERD, các API chính dạng bảng
- 💬 Tài liệu: Thêm mục "Yêu cầu phi chức năng" vào cuối tài liệu
- 💬 Tài liệu: Sửa lại phần giới thiệu cho ngắn gọn, giữ nguyên các diagram
- 💬 Tài liệu: Trong diagram quy trình, thêm bước gửi email xác nhận
- 💬 Diagram: Vẽ sequence diagram cho chức năng đăng nhập bằng OTP
- 💬 Diagram: Vẽ ERD cho hệ thống bán hàng gồm khách hàng, đơn hàng, sản phẩm
- 💬 Diagram: Đổi tất cả các hình xử lý sang màu xanh nhạt
- 💬 Trang: Thêm trang Bảng giá có 3 gói và nút Đăng ký mở form liên hệ
- 💬 Trang: Đổi màu chủ đạo của cả trang sang xanh lá và dùng font Be Vietnam Pro

### Dùng với AI bên ngoài (không cần API key)

Bấm **Copy context** trong khung chat → chọn **Tài liệu Markdown**, **Thiết kế trang** (hoặc một chế độ diagram) → **Sao chép skill** → dán vào
ChatGPT, Gemini, Claude… kèm yêu cầu. Sau đó:

- Tài liệu: sao chép toàn bộ câu trả lời của AI, **dán thẳng vào tab Tài liệu** – diagram trong câu trả lời tự thành diagram sửa được.
- Diagram: dán khối JSON vào tab **JSON** (bảng bên phải tab Diagram) → **Áp dụng**.
- Thiết kế trang: dán khối JSON vào tab **JSON** (bảng bên phải tab Thiết kế trang) → **Áp dụng**, hoặc lưu thành file \`.json\` rồi kéo thả vào cửa sổ.

## Giọng nói

- Bấm 🎤 trong khung chat hoặc \`Ctrl+M\` rồi nói – nói xong app tự gửi cho AI.
- \`Ctrl+Shift+M\` (🎧): **rảnh tay** – nghe, gửi, đọc kết quả, rồi nghe tiếp.
- Ở tab Diagram, câu ngắn như “hoàn tác”, “vừa màn hình”, “xoá” chạy ngay như lệnh. Câu “hướng dẫn” mở trang này.
- Chọn micro, bộ nhận dạng (có bản offline) và giọng đọc ở **[⚙ Cài đặt → Giọng nói](#go-settings-voice)** (hoặc chuột phải vào 🎤).

## Phím tắt

| Ở đâu | Phím | Việc |
| --- | --- | --- |
| Mọi nơi | \`Alt+1\` … \`Alt+5\` | Tab Tài liệu / Diagram / Thiết kế trang / Hướng dẫn / Cài đặt |
| Mọi nơi | \`Ctrl+Enter\` (trong ô chat) | Gửi cho AI |
| Mọi nơi | \`Ctrl+M\` · \`Ctrl+Shift+M\` | Nói với AI · rảnh tay |
| Tài liệu | \`Ctrl+S\` · \`Ctrl+Shift+S\` · \`Ctrl+O\` | Lưu · lưu thành · mở |
| Tài liệu | \`Ctrl+B\` · \`Ctrl+I\` · \`Ctrl+K\` · \`Ctrl+E\` | Đậm · nghiêng · liên kết · code |
| Tài liệu | \`Ctrl+Z\` / \`Ctrl+Y\` | Hoàn tác / làm lại |
| Diagram | \`V\` · \`H\` · \`C\` | Chọn · bàn tay · vẽ đường nối |
| Diagram | \`Ctrl+Z\` / \`Ctrl+Y\` | Hoàn tác / làm lại |
| Diagram | \`Ctrl+C\` · \`Ctrl+V\` · \`Ctrl+D\` · \`Delete\` | Sao chép · dán · nhân bản · xoá |
| Diagram | \`Ctrl\` + cuộn · \`Shift+1\` | Zoom · vừa màn hình |
| Diagram | \`Ctrl+S\` · \`Ctrl+O\` | Tải JSON · mở JSON |
| Diagram | \`Ctrl+B\` · \`Ctrl+Alt+B\` | Thu gọn thư viện · bảng thuộc tính |
| Thiết kế trang | nhấn đúp · \`Enter\` | Sửa chữ của thành phần đang chọn (\`Esc\` huỷ) |
| Thiết kế trang | \`Esc\` · \`↑\` \`↓\` | Chọn khung chứa bên ngoài · chọn thành phần trước / sau |
| Thiết kế trang | \`Alt+↑\` / \`Alt+↓\` | Đưa thành phần lên trước / xuống sau |
| Thiết kế trang | \`Ctrl+C\` · \`Ctrl+X\` · \`Ctrl+V\` · \`Ctrl+D\` · \`Delete\` | Sao chép · cắt · dán · nhân bản · xoá |
| Thiết kế trang | \`Ctrl+Z\` / \`Ctrl+Y\` · \`Ctrl+S\` · \`Ctrl+O\` | Hoàn tác / làm lại · tải JSON · mở JSON |

## Câu hỏi thường gặp

**Dữ liệu của tôi lưu ở đâu?**
Trong trình duyệt của bạn (tự lưu) và trong file bạn lưu ra. Không có máy chủ nào nhận tài liệu của bạn – trừ nội dung bạn
gửi cho nhà cung cấp AI khi chat.

**Dùng không có mạng được không?**
Được. Vào **[⚙ Cài đặt → Ứng dụng & dữ liệu](#go-settings-app)** → **⬇ Cài đặt ứng dụng** (hoặc biểu tượng cài trên thanh địa chỉ) để dùng như một ứng dụng, kể cả offline.
Chat AI cần mạng (trừ khi dùng Ollama / LM Studio trên máy).

**Mở file .md trong VS Code không thấy diagram?**
Mở khung xem trước Markdown (\`Ctrl+Shift+V\`). Trình xem chặn HTML (như GitHub) sẽ không hiện diagram – xem mục
[Diagram nằm trong file .md như thế nào?](#diagram-nằm-trong-file-md-như-thế-nào).

**Lỡ tay xoá / AI sửa sai?**
Trong tài liệu: \`Ctrl+Z\`, hoặc nút **↶ Hoàn tác thay đổi của AI** trong khung chat. Trong diagram và thiết kế trang: \`Ctrl+Z\` hoặc nút ↶.

**Trang web thiết kế xong đưa lên mạng thế nào?**
Bấm **Tải xuống HTML** ở tab Thiết kế trang. File đó chạy độc lập: đổi tên thành \`index.html\` rồi tải lên bất kỳ dịch vụ
hosting tĩnh nào (GitHub Pages, Netlify, Cloudflare Pages…). Nếu nút gọi hàm JavaScript, hãy viết hàm trong
“Mã JavaScript của dự án” (bỏ chọn mọi thành phần để thấy ô này).
`;

  const G = (DE.guide = {});
  let done = false;
  const plain = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd');

  /** Render nội dung (một lần, khi mở tab lần đầu) */
  G.render = function () {
    if (done) return;
    done = true;
    const body = $('#guide-body'), nav = $('#guide-nav'), main = $('#guide-main');
    body.replaceChildren(DE.md.sanitizeFragment(DE.md.render(DE.GUIDE_MD)));

    // gom mỗi tiêu đề cấp 2 + nội dung phía sau thành một mục (để lọc khi tìm kiếm)
    const intro = document.createElement('section');
    intro.className = 'guide-sec';
    const secs = [intro];
    [...body.childNodes].forEach((n) => {
      if (n.nodeType === 1 && n.tagName === 'H2') {
        const s = document.createElement('section');
        s.className = 'guide-sec';
        secs.push(s);
      }
      secs[secs.length - 1].appendChild(n);
    });
    body.innerHTML = '';
    secs.forEach((s) => s.childNodes.length && body.appendChild(s));

    // mục lục
    const heads = [...body.querySelectorAll('h2, h3')];
    nav.innerHTML = heads
      .map((h) => `<a href="#${esc(h.id)}" class="gt-${h.tagName.toLowerCase()}" data-target="${esc(h.id)}">${esc(h.textContent)}</a>`)
      .join('');
    nav.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-target]');
      if (!a) return;
      e.preventDefault();
      const t = document.getElementById(a.dataset.target);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // ví dụ prompt: nút "Thử"
    body.querySelectorAll('li').forEach((li) => {
      const m = li.textContent.trim().match(/^💬\s*(Tài liệu|Diagram|Trang):\s*([\s\S]+)$/);
      if (!m) return;
      li.classList.add('guide-try');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn guide-try-btn';
      b.textContent = 'Thử ↗';
      b.title = `Mở tab ${m[1] === 'Trang' ? 'Thiết kế trang' : m[1]} và đưa câu này vào khung chat AI`;
      b.dataset.ws = { 'Tài liệu': 'doc', Diagram: 'diagram', Trang: 'design' }[m[1]];
      b.dataset.prompt = m[2].trim();
      li.appendChild(b);
    });

    body.addEventListener('click', (e) => {
      const b = e.target.closest('.guide-try-btn');
      if (b) return tryPrompt(b.dataset.ws, b.dataset.prompt);
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      e.preventDefault();
      const id = decodeURIComponent(a.getAttribute('href').slice(1));
      const go = id.match(/^(?:md-)?go-(doc|diagram|design|guide)$/);
      if (go) return DE.docs.show(go[1]);
      const set = id.match(/^(?:md-)?go-settings(?:-(look|ai|voice|app))?$/);
      if (set && DE.settings) return DE.settings.open(set[1]);
      const t = document.getElementById(id) || document.getElementById(id.replace(/^md-/, ''));
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // tìm kiếm: chỉ hiện các mục có chứa từ khoá (không phân biệt dấu)
    const search = $('#guide-search');
    search.addEventListener('input', () => {
      const q = plain(search.value.trim());
      let shown = 0;
      body.querySelectorAll('.guide-sec').forEach((s) => {
        const hit = !q || plain(s.textContent).includes(q);
        s.hidden = !hit;
        if (hit) shown++;
      });
      $('#guide-empty').hidden = shown > 0;
      nav.querySelectorAll('a').forEach((a) => {
        const t = document.getElementById(a.dataset.target);
        a.hidden = !!t && !!t.closest('.guide-sec[hidden]');
      });
    });

    // làm nổi mục đang đọc trong mục lục
    const links = new Map([...nav.querySelectorAll('a')].map((a) => [a.dataset.target, a]));
    main.addEventListener(
      'scroll',
      () => {
        const top = main.getBoundingClientRect().top + 80;
        let cur = null;
        for (const h of heads) {
          if (h.closest('[hidden]')) continue;
          if (h.getBoundingClientRect().top <= top) cur = h;
          else break;
        }
        links.forEach((a) => a.classList.remove('active'));
        if (cur && links.get(cur.id)) links.get(cur.id).classList.add('active');
      },
      { passive: true }
    );
  };

  function tryPrompt(ws, text) {
    DE.docs.show(ws);
    const pill = $('#ai-chat-pill');
    if (pill && !pill.hidden) pill.click();
    const ta = $('#ai-prompt');
    ta.value = text;
    ta.dispatchEvent(new Event('input'));
    ta.focus();
    ta.setSelectionRange(text.length, text.length);
    DE.ui.toast(DE.ai && DE.ai.active() ? 'Đã đưa ví dụ vào khung chat – bấm Gửi (Ctrl+Enter)' : 'Đã đưa ví dụ vào khung chat – thêm API key (tab ⚙ Cài đặt → Trợ lý AI) rồi bấm Gửi', 'info');
  }
})(window.DE);
