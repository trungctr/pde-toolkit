/* =========================================================================
 * Tab "Hướng dẫn": hướng dẫn sử dụng bộ công cụ (Tài liệu + Diagram + Chat AI).
 * Nội dung viết bằng Markdown (DE.GUIDE_MD), render bằng js/markdown.js.
 *  - Mục lục bên trái (tự sinh từ tiêu đề), tìm kiếm lọc theo mục.
 *  - Dòng "💬 Tài liệu: …" / "💬 Diagram: …" có nút "Thử" – gửi ví dụ vào khung chat AI.
 *  - Link [chữ](#go-doc) / (#go-diagram) chuyển sang tab tương ứng.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const { esc } = DE;
  const $ = (q, el = document) => el.querySelector(q);

  DE.GUIDE_MD = `
# Hướng dẫn sử dụng

**Diagram Editor** là bộ công cụ soạn **tài liệu thiết kế phần mềm**: viết tài liệu như soạn văn bản, vẽ diagram
(Flowchart, BPMN, UML, ERD) trên whiteboard rồi nhúng vào tài liệu, và nhờ **AI** viết giúp cả tài liệu lẫn diagram.
Mọi thứ chạy ngay trên trình duyệt, không cần tài khoản, dữ liệu nằm trên máy bạn.

## Bắt đầu nhanh

1. Mở tab **[Tài liệu](#go-doc)** và gõ nội dung như trong Word.
2. Đặt con trỏ ở chỗ cần hình minh hoạ, bấm **◆ Diagram mới** → vẽ ở tab Diagram → bấm **✓ Chèn vào tài liệu**.
3. Bấm **Lưu** (\`Ctrl+S\`) để ghi ra file \`.md\` – mở được trong VS Code, Typora, Obsidian… với diagram hiển thị sẵn.
4. Muốn nhanh hơn? Gõ yêu cầu vào **khung chat AI** ở góc dưới bên phải, ví dụ:

- 💬 Tài liệu: Viết đặc tả chức năng đặt hàng online, có use case diagram và sequence diagram
- 💬 Diagram: Vẽ quy trình duyệt đơn nghỉ phép bằng BPMN có 2 lane: Nhân viên và Quản lý

> [!TIP]
> Khung chat AI có ở cả ba tab. Lần đầu dùng, bấm chip **API key** trong khung chat để chọn nhà cung cấp AI
> (có nhiều lựa chọn miễn phí – xem mục [Chat AI](#chat-ai)).

## Giao diện

Ba tab ở trên cùng:

| Tab | Phím tắt | Dùng để |
| --- | --- | --- |
| 📄 **Tài liệu** | \`Alt+1\` | Soạn và xem tài liệu \`.md\`, nhúng diagram |
| ◆ **Diagram** | \`Alt+2\` | Whiteboard vẽ diagram |
| ❓ **Hướng dẫn** | \`Alt+3\` | Trang bạn đang đọc |

Thanh công cụ chia thành **các nhóm**; khi cửa sổ hẹp, các nhóm tự **xuống hàng** để mọi nút vẫn luôn hiện đủ.

## Soạn tài liệu

### Gõ và định dạng

Gõ trực tiếp vào trang. Thanh công cụ (từ trái sang): **Mới · Mở · Lưu · tên file** – **H1 H2 H3** (tiêu đề) –
**B** đậm · *I* nghiêng · ~~S~~ gạch · \`</>\` code – liên kết · ảnh – danh sách · danh sách số · việc cần làm –
trích dẫn · khối code · bảng · đường kẻ.

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

## Chat AI

### Cài đặt lần đầu

1. Bấm chip **API key** trong khung chat.
2. Chọn nhà cung cấp – có gói **miễn phí**: **Google Gemini**, **OpenRouter** (mô hình 🆓), **Groq**, **Cerebras**, **Mistral**;
   hoặc chạy trên máy với **Ollama** / **LM Studio**. Bấm “Lấy API key ↗” để tạo key.
3. Dán key, chọn mô hình, bấm **Áp dụng**.

> [!IMPORTANT]
> API key chỉ lưu trong trình duyệt này và chỉ gửi thẳng tới nhà cung cấp bạn chọn. Không nên lưu key trên máy dùng chung.

### Nhờ AI làm việc

AI biết bạn đang ở tab nào:

- **Tab Tài liệu** – AI viết mới hoặc sửa **toàn bộ tài liệu**, có thể **tự vẽ diagram** và chèn vào đúng chỗ.
  Không ưng: bấm **↶ Hoàn tác thay đổi của AI** trong khung chat.
- **Tab Diagram** – AI vẽ / sửa diagram đang mở. Không ưng: \`Ctrl+Z\`.
- **Tab Hướng dẫn** – hỏi AI cách dùng công cụ.

Gửi bằng nút **Gửi** hoặc \`Ctrl+Enter\`. AI nhớ các lượt trước trong cuộc trò chuyện; nút ↻ để bắt đầu cuộc trò chuyện mới.

### Ví dụ yêu cầu (bấm “Thử” để gửi vào khung chat)

- 💬 Tài liệu: Viết tài liệu thiết kế hệ thống quản lý thư viện: tổng quan, ERD, các API chính dạng bảng
- 💬 Tài liệu: Thêm mục "Yêu cầu phi chức năng" vào cuối tài liệu
- 💬 Tài liệu: Sửa lại phần giới thiệu cho ngắn gọn, giữ nguyên các diagram
- 💬 Tài liệu: Trong diagram quy trình, thêm bước gửi email xác nhận
- 💬 Diagram: Vẽ sequence diagram cho chức năng đăng nhập bằng OTP
- 💬 Diagram: Vẽ ERD cho hệ thống bán hàng gồm khách hàng, đơn hàng, sản phẩm
- 💬 Diagram: Đổi tất cả các hình xử lý sang màu xanh nhạt

### Dùng với AI bên ngoài (không cần API key)

Bấm **Copy context** trong khung chat → chọn **Tài liệu Markdown** (hoặc một chế độ diagram) → **Sao chép skill** → dán vào
ChatGPT, Gemini, Claude… kèm yêu cầu. Sau đó:

- Tài liệu: sao chép toàn bộ câu trả lời của AI, **dán thẳng vào tab Tài liệu** – diagram trong câu trả lời tự thành diagram sửa được.
- Diagram: dán khối JSON vào tab **JSON** (bảng bên phải tab Diagram) → **Áp dụng**.

## Giọng nói

- Bấm 🎤 trong khung chat hoặc \`Ctrl+M\` rồi nói – nói xong app tự gửi cho AI.
- \`Ctrl+Shift+M\` (🎧): **rảnh tay** – nghe, gửi, đọc kết quả, rồi nghe tiếp.
- Ở tab Diagram, câu ngắn như “hoàn tác”, “vừa màn hình”, “xoá” chạy ngay như lệnh. Câu “hướng dẫn” mở trang này.
- Chuột phải vào 🎤 để chọn micro, bộ nhận dạng (có bản offline) và giọng đọc.

## Phím tắt

| Ở đâu | Phím | Việc |
| --- | --- | --- |
| Mọi nơi | \`Alt+1\` / \`Alt+2\` / \`Alt+3\` | Tab Tài liệu / Diagram / Hướng dẫn |
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

## Câu hỏi thường gặp

**Dữ liệu của tôi lưu ở đâu?**
Trong trình duyệt của bạn (tự lưu) và trong file bạn lưu ra. Không có máy chủ nào nhận tài liệu của bạn – trừ nội dung bạn
gửi cho nhà cung cấp AI khi chat.

**Dùng không có mạng được không?**
Được. Bấm **⬇ Cài đặt ứng dụng** ở thanh trạng thái (hoặc biểu tượng cài trên thanh địa chỉ) để dùng như một ứng dụng, kể cả offline.
Chat AI cần mạng (trừ khi dùng Ollama / LM Studio trên máy).

**Mở file .md trong VS Code không thấy diagram?**
Mở khung xem trước Markdown (\`Ctrl+Shift+V\`). Trình xem chặn HTML (như GitHub) sẽ không hiện diagram – xem mục
[Diagram nằm trong file .md như thế nào?](#diagram-nằm-trong-file-md-như-thế-nào).

**Lỡ tay xoá / AI sửa sai?**
Trong tài liệu: \`Ctrl+Z\`, hoặc nút **↶ Hoàn tác thay đổi của AI** trong khung chat. Trong diagram: \`Ctrl+Z\` hoặc nút ↶.
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
      const m = li.textContent.trim().match(/^💬\s*(Tài liệu|Diagram):\s*([\s\S]+)$/);
      if (!m) return;
      li.classList.add('guide-try');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn guide-try-btn';
      b.textContent = 'Thử ↗';
      b.title = `Mở tab ${m[1]} và đưa câu này vào khung chat AI`;
      b.dataset.ws = m[1] === 'Tài liệu' ? 'doc' : 'diagram';
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
      const go = id.match(/^(?:md-)?go-(doc|diagram|guide)$/);
      if (go) return DE.docs.show(go[1]);
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
    DE.ui.toast(DE.ai && DE.ai.active() ? 'Đã đưa ví dụ vào khung chat – bấm Gửi (Ctrl+Enter)' : 'Đã đưa ví dụ vào khung chat – thêm API key (chip “API key”) rồi bấm Gửi', 'info');
  }
})(window.DE);
