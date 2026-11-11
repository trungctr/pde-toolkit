/* =========================================================================
 * Tài liệu Markdown: soạn / xem file .md, nhúng diagram.
 *
 *  - Hai tab làm việc: "Tài liệu" (soạn .md) và "Diagram" (whiteboard sẵn có).
 *  - Diagram được VẼ Ở TAB DIAGRAM rồi nhúng vào tài liệu. Trong trình soạn thảo, mỗi diagram
 *    chỉ là một dòng gọn:            [[diagram:dg-ab12cd|Quy trình đặt hàng]]
 *    Khi lưu ra file .md, dòng đó được thay bằng khối tự chứa (xem được ở mọi trình xem
 *    Markdown cho phép HTML, và mở lại được để sửa tiếp):
 *        <!-- de-diagram:dg-ab12cd {…JSON của diagram…} -->
 *        <div align="center"><svg …>…</svg></div>
 *        <!-- /de-diagram:dg-ab12cd -->
 *  - "Phiên nhúng": bấm Sửa trên một diagram (hoặc "Diagram mới") → tab Diagram nạp diagram đó,
 *    diagram đang vẽ dở ở tab Diagram được cất lại (kèm lịch sử undo) và trả về khi xong.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const { esc } = DE;
  const store = DE.store, E = DE.editor, MD = DE.md;
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];
  const DOCS = (DE.docs = {});

  const DOC_KEY = 'diagram-editor:md:v1';
  const SESSION_KEY = 'diagram-editor:md-session:v1';
  const VIEW_KEY = 'diagram-editor:md-view';
  const DEV_KEY = 'diagram-editor:md-dev';
  const WS_KEY = 'diagram-editor:workspace';
  const DEFAULT_NAME = 'tai-lieu.md';

  const lsGet = (k) => {
    try {
      return localStorage.getItem(k);
    } catch (_) {
      return null;
    }
  };
  const lsSet = (k, v) => {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
      return true;
    } catch (_) {
      return false;
    }
  };
  const toast = (m, t) => DE.ui.toast(m, t);

  // ================================================================== STATE
  const state = {
    name: DEFAULT_NAME,
    diagrams: {}, // id -> tài liệu diagram (JSON)
    dirty: false, // có thay đổi chưa ghi ra file
    handle: null, // FileSystemFileHandle (khi trình duyệt hỗ trợ) – Ctrl+S ghi thẳng vào file
    crlf: false, // file gốc dùng CRLF -> giữ nguyên khi lưu
    caret: 0,
    savedAt: null, // lần cuối ghi ra file
  };
  let ws = 'diagram'; // tab đang mở: 'doc' | 'diagram'
  // Mặc định chỉ có trình soạn TRỰC QUAN (như Word). Bật "chế độ developer" mới thấy mã Markdown:
  // 'code' (chỉ mã) | 'split' (mã + trực quan) | 'visual' (chỉ trực quan)
  let view = 'visual';
  let dev = false;
  let lastFocus = 'visual'; // khung người dùng thao tác gần nhất: 'visual' | 'ta'
  let lastRange = null; // vị trí con trỏ cuối cùng trong trình soạn trực quan
  let visualStale = true; // khung trực quan cần render lại từ Markdown
  let session = null; // { kind: 'insert' | 'edit', id, pos, original, stash }
  let ta, pv, pvWrap, body, docview;

  // ============================================================ DIAGRAM ↔ MD
  const PH_RE = /^\[\[diagram:([\w-]+)(?:\|[^\]\n]*)?\]\][ \t]*$/gm;
  const BLOCK_RE = /<!-- de-diagram:([\w-]+) ([^\n]*?) -->[ \t]*\r?\n[\s\S]*?<!-- \/de-diagram:\1 -->/g;
  const newId = () => {
    let id;
    do id = 'dg-' + Math.random().toString(36).slice(2, 8);
    while (state.diagrams[id]);
    return id;
  };
  const cleanName = (s) => String(s || 'diagram').replace(/[\]|\r\n]+/g, ' ').trim().slice(0, 80) || 'diagram';
  const placeholder = (id, doc) => `[[diagram:${id}|${cleanName(doc && doc.meta && doc.meta.name)}]]`;

  /** JSON an toàn để nằm trong comment HTML: không có '<' '>' (nên không thể có "-->") */
  const commentJSON = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  /** Văn bản trong trình soạn thảo -> nội dung file .md (dòng [[diagram:…]] -> khối SVG + JSON) */
  function expand(text, diagrams) {
    let out = text.replace(PH_RE, (m, id) => {
      const d = diagrams[id];
      if (!d) return m;
      return `<!-- de-diagram:${id} ${commentJSON(d)} -->\n<div align="center">${DE.inlineSVG(d)}</div>\n<!-- /de-diagram:${id} -->`;
    });
    // khối HTML trong CommonMark kéo dài tới dòng trống -> luôn có dòng trống bao quanh
    out = out.replace(/([^\n])\n(<!-- de-diagram:)/g, '$1\n\n$2').replace(/(<!-- \/de-diagram:[\w-]+ -->)\n(?=[^\n])/g, '$1\n\n');
    return out;
  }

  /** Nội dung file .md -> văn bản soạn thảo + bảng diagram */
  function collapse(text, diagrams = {}) {
    let count = 0;
    const out = text.replace(BLOCK_RE, (m, id, json) => {
      let doc;
      try {
        doc = DE.normalizeDoc(JSON.parse(json)).doc;
      } catch (e) {
        console.warn('[Diagram Editor] Không đọc được diagram nhúng', id, e);
        return m;
      }
      if (diagrams[id] && JSON.stringify(diagrams[id]) !== JSON.stringify(doc)) {
        // trùng id (khối bị sao chép rồi sửa ở nơi khác) -> cấp id mới
        do id = 'dg-' + Math.random().toString(36).slice(2, 8);
        while (diagrams[id]);
      }
      diagrams[id] = doc;
      count++;
      return placeholder(id, doc);
    });
    return { text: out, diagrams, count };
  }

  /** nội dung file để ghi ra đĩa (cũng dùng qua console: diagram.markdown()) */
  const serialize = () => {
    flushVisual();
    const s = expand(ta.value, state.diagrams);
    return state.crlf ? s.replace(/\n/g, '\r\n') : s;
  };
  DOCS.serialize = () => serialize();

  // ================================================================ STORAGE
  const saveLocal = DE.debounce(() => saveLocalNow(), 400);
  function saveLocalNow() {
    const ok = lsSet(
      DOC_KEY,
      JSON.stringify({ name: state.name, text: ta.value, diagrams: usedDiagrams(), dirty: state.dirty, crlf: state.crlf, savedAt: state.savedAt })
    );
    if (!ok) setStatus('⚠ Không lưu được vào trình duyệt (hết dung lượng?) – hãy lưu ra file', 'warn');
  }

  /** chỉ giữ các diagram còn được tham chiếu (cộng diagram của phiên nhúng đang mở) */
  function usedDiagrams() {
    const used = {};
    for (const m of ta.value.matchAll(PH_RE)) if (state.diagrams[m[1]]) used[m[1]] = state.diagrams[m[1]];
    if (session && session.id && state.diagrams[session.id]) used[session.id] = state.diagrams[session.id];
    return used;
  }

  function loadLocal() {
    try {
      const o = JSON.parse(lsGet(DOC_KEY) || 'null');
      if (!o || typeof o.text !== 'string') return false;
      state.name = typeof o.name === 'string' && o.name ? o.name : DEFAULT_NAME;
      state.diagrams = {};
      for (const [id, d] of Object.entries(o.diagrams || {})) {
        try {
          state.diagrams[id] = DE.normalizeDoc(d).doc;
        } catch (_) {
          /* bỏ diagram hỏng */
        }
      }
      state.dirty = !!o.dirty;
      state.crlf = !!o.crlf;
      state.savedAt = o.savedAt || null;
      ta.value = o.text;
      return true;
    } catch (_) {
      return false;
    }
  }

  // Tài liệu đầu tiên: hướng dẫn ngắn + một diagram mẫu
  function welcome() {
    const id = 'dg-welcome';
    let doc;
    try {
      doc = DE.normalizeDoc(DE.templates.flowchart.build()).doc;
      doc.meta.mode = 'flowchart';
    } catch (_) {
      doc = null;
    }
    if (doc) state.diagrams[id] = doc;
    return [
      '# Tài liệu thiết kế',
      '',
      'Gõ trực tiếp vào trang này như soạn văn bản bình thường. Dùng thanh công cụ phía trên để định dạng:',
      'tiêu đề, **chữ đậm**, *nghiêng*, danh sách, bảng, liên kết, ảnh…',
      '',
      '## Nhúng diagram',
      '',
      '1. Đặt con trỏ ở chỗ muốn chèn rồi bấm **◆ Diagram mới** – tab **Diagram** mở ra với một whiteboard trống.',
      '2. Vẽ xong, bấm **✓ Chèn vào tài liệu** – diagram xuất hiện tại vị trí con trỏ.',
      '3. Muốn sửa: rê chuột lên diagram rồi bấm **✎ Sửa** (hoặc nhấn đúp vào diagram).',
      '',
      doc ? placeholder(id, doc) : '',
      '',
      '## Mở và lưu file',
      '',
      '- **Kéo thả** file `.md` từ máy vào cửa sổ này để mở và sửa, hoặc bấm nút Mở (`Ctrl+O`).',
      '- Bấm Lưu (`Ctrl+S`) để ghi file `.md`. Diagram nằm trong file dưới dạng **hình SVG** – xem được trong',
      '  VS Code, Typora, Obsidian, trình duyệt… – kèm dữ liệu để mở lại đây và sửa tiếp.',
      '',
      '> [!TIP]',
      '> Muốn sửa trực tiếp mã Markdown? Bật nút **</> Developer** ở góc phải thanh công cụ.',
      '',
    ].join('\n');
  }

  // ================================================================ PREVIEW
  const svgCache = new Map();
  function diagramSVG(doc) {
    const k = JSON.stringify(doc);
    let s = svgCache.get(k);
    if (!s) {
      s = DE.inlineSVG(doc);
      svgCache.set(k, s);
      if (svgCache.size > 80) svgCache.delete(svgCache.keys().next().value);
    }
    return s;
  }

  let renderT = 0;
  const scheduleRender = () => {
    clearTimeout(renderT);
    renderT = setTimeout(renderPreview, 140);
  };

  function renderPreview() {
    clearTimeout(renderT);
    if (!pv) return;
    clearTimeout(visualT);
    visualDirty = false;
    const html = MD.render(ta.value, {
      keepRaw: true,
      diagram: (id, line) => `<figure class="md-diagram" contenteditable="false" data-dg="${esc(id)}" data-line="${line}"></figure>`,
    });
    pv.replaceChildren(MD.sanitizeFragment(html)); // chèn node đã kiểm tra, không phân tích lại chuỗi
    visualStale = false;
    lastRange = null;
    // SVG do chính app tạo (từ JSON, mọi chữ đã được escape) -> chèn sau bước làm sạch
    $$('figure.md-diagram', pv).forEach((fig) => {
      const id = fig.dataset.dg, d = state.diagrams[id];
      if (!d) {
        fig.classList.add('missing');
        fig.innerHTML = `<div class="dg-missing">⚠ Không tìm thấy diagram <code>${esc(id)}</code> – dòng này sẽ được giữ nguyên khi lưu.</div>`;
        return;
      }
      if (session && session.id === id) fig.classList.add('editing');
      fig.title = 'Nhấn đúp để sửa trong tab Diagram';
      fig.innerHTML =
        `<div class="dg-actions"><span class="dg-name">◆ ${esc(d.meta?.name || 'diagram')}</span>` +
        `<button type="button" data-dga="edit" title="Sửa diagram trong tab Diagram">✎ Sửa</button>` +
        `<button type="button" data-dga="source" title="Tới dòng [[diagram:…]] trong khung soạn">Mã</button>` +
        `<button type="button" data-dga="svg" title="Tải ảnh SVG của diagram này">SVG</button>` +
        `<button type="button" data-dga="remove" title="Xoá diagram khỏi tài liệu">Xoá</button></div>` +
        `<div class="dg-svg">${diagramSVG(d)}</div>`;
    });
    anchorsDirty = true;
    linesDirty = true;
    updateStatus();
    // Mermaid, công thức, tô màu code, emoji: tải thư viện khi cần rồi vẽ (không chặn việc soạn)
    if (DE.mdRich) {
      const g = ++richGen;
      DE.mdRich.enhance(pv, { editor: true, isCurrent: () => g === richGen }).then(() => {
        if (g === richGen) anchorsDirty = true;
      });
    }
  }
  let richGen = 0;

  // ------------------------------------------------ sửa Mermaid / công thức / khối mã gốc
  const inCode = () => view === 'code' || (view === 'split' && lastFocus === 'ta');
  /** Ghi lại tài liệu sau khi sửa trực tiếp DOM của khung soạn (data-raw / data-tex) rồi vẽ lại */
  function commitVisualDom() {
    visualDirty = true;
    flushVisual();
    renderPreview();
  }
  /** el: phần tử cần sửa. code = true: luôn sửa bằng mã (Mermaid / PlantUML không chuyển được thành diagram) */
  async function editRich(el, code = false) {
    const R = DE.mdRich;
    if (!R) return;
    flushVisual();
    // công thức trong dòng
    if (el.classList.contains('md-math') && !el.closest('.md-math-block')) {
      const r = await R.editDialog({ kind: 'math', title: 'Sửa công thức', value: el.getAttribute('data-tex') || '', display: !!el.getAttribute('data-display') });
      if (!r) return;
      if (!r.value.trim()) el.remove();
      else el.setAttribute('data-tex', r.value.trim());
      return commitVisualDom();
    }
    const blk = el.closest('.md-raw');
    if (!blk || !pv.contains(blk)) return;
    const raw = blk.getAttribute('data-raw') || '';
    const fence = (raw.match(/^\s*(`{3,}|~{3,})/) || [])[1];
    let o = { kind: 'raw', title: 'Sửa mã HTML', value: raw }, wrap = (v) => v;
    if (blk.classList.contains('md-toc')) return toast('Mục lục tự cập nhật theo các tiêu đề trong tài liệu', 'info');
    // Mermaid / PlantUML: sửa = chuyển thành diagram của app (kéo thả trên whiteboard); loại không chuyển được thì sửa mã
    if (!code && (blk.classList.contains('md-mermaid') || blk.classList.contains('md-plantuml')) && richConvert(blk).ok) return richToDiagram(blk);
    if (blk.classList.contains('md-mermaid')) {
      o = { kind: 'mermaid', title: 'Sửa mã sơ đồ Mermaid', value: blk.getAttribute('data-src') || '' };
      wrap = (v) => `${fence || '```'}mermaid\n${v}\n${fence || '```'}`;
    } else if (blk.classList.contains('md-plantuml')) {
      const lang = (raw.match(/^\s*(?:`{3,}|~{3,})\s*([\w-]+)/) || [])[1] || 'plantuml';
      o = { kind: 'plantuml', title: 'Sửa sơ đồ PlantUML', value: blk.getAttribute('data-src') || '' };
      wrap = (v) => `${fence || '```'}${lang}\n${v}\n${fence || '```'}`;
    } else if (blk.classList.contains('md-math-block')) {
      o = { kind: 'math', title: 'Sửa công thức', value: (blk.querySelector('.md-math') || blk).getAttribute('data-tex') || '' };
      wrap = (v) => (fence ? `${fence}math\n${v}\n${fence}` : `$$\n${v}\n$$`);
    } else if (blk.classList.contains('md-frontmatter')) {
      o = { kind: 'raw', title: 'Sửa thông tin đầu tài liệu (front matter)', value: raw.replace(/^---[ \t]*\n?/, '').replace(/\n?(---|\.\.\.)[ \t]*$/, ''), hint: 'Mỗi dòng một mục dạng  khoá: giá trị  (YAML). Ctrl+Enter để áp dụng.' };
      wrap = (v) => `---\n${v}\n---`;
    } else if (blk.classList.contains('md-footnotes')) {
      o = { kind: 'raw', title: 'Sửa chú thích cuối trang', value: raw, hint: 'Mỗi chú thích một dòng:  [^1]: nội dung  – số trong ngoặc khớp với chỗ tham chiếu [^1] trong bài. Ctrl+Enter để áp dụng.' };
    }
    const r = await R.editDialog(o);
    if (!r) return;
    const v = r.value.replace(/\s+$/, '');
    if (!v.trim()) blk.remove();
    else blk.setAttribute('data-raw', wrap(v));
    commitVisualDom();
  }

  /** Dịch khối Mermaid / PlantUML sang diagram JSON của app */
  function richConvert(blk) {
    const src = blk.getAttribute('data-src') || '';
    if (blk.classList.contains('md-mermaid')) return DE.mermaidConv ? DE.mermaidConv.convert(src) : { ok: false, error: 'Thiếu bộ dịch Mermaid' };
    return (DE.mdRich && DE.mdRich.plantumlDoc(src)) || { ok: false, error: 'Thiếu bộ dịch PlantUML' };
  }
  /** Khối Mermaid / PlantUML -> diagram của app (sửa kéo thả trên whiteboard) */
  async function richToDiagram(blk) {
    const mm = blk.classList.contains('md-mermaid');
    const lang = mm ? 'Mermaid' : 'PlantUML';
    const r = richConvert(blk);
    if (!r.ok) return toast(`Chưa chuyển được sơ đồ ${lang} này: ${r.error}`, 'warn');
    const ok = await DE.ui.confirm({
      title: `Sửa sơ đồ ${lang} trên whiteboard?`,
      message:
        `Sơ đồ được chuyển thành diagram của ứng dụng để sửa kéo thả: di chuyển, đổi màu, nối thêm hình… như mọi diagram khác. ` +
        `Mã ${lang} gốc sẽ được thay bằng diagram này (Ctrl+Z để hoàn tác).` +
        (r.warnings.length ? `\n\nLưu ý: ${r.warnings.length} chi tiết chưa chuyển được đã bị bỏ qua (màu, kiểu riêng…).` : ''),
      ok: 'Chuyển và mở whiteboard',
    });
    if (!ok) return;
    const doc = DE.clone(r.doc);
    const id = newId();
    state.diagrams[id] = doc;
    blk.setAttribute('data-raw', placeholder(id, doc));
    commitVisualDom();
    startSession({ kind: 'edit', id, doc });
  }
  /** Lưu vị trí con trỏ của khung trực quan trước khi mở hộp thoại (hộp thoại lấy mất focus) */
  function keepCaret() {
    if (inCode()) return null;
    ensureVisualFocus();
    return saveSel();
  }
  function backToCaret(range) {
    if (!range) return;
    restoreSel(range);
    lastRange = range.cloneRange(); // selectionchange chạy trễ – cập nhật ngay cho caretPos()
  }
  /**
   * Chèn một phần tử "nguyên khối" (công thức, chú thích) đúng tại con trỏ. Không dùng
   * execCommand('insertHTML'): Chrome đẩy phần tử contenteditable=false ở cuối đoạn thành đoạn mới.
   */
  function insertAtom(html) {
    ensureVisualFocus();
    const s = getSelection();
    if (!s.rangeCount || !inVisual(s.anchorNode)) return false;
    const r = s.getRangeAt(0);
    const host = r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer;
    const lock = host && host.closest('[contenteditable="false"]');
    if (lock && pv.contains(lock)) r.setStartAfter(lock);
    r.deleteContents();
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const node = tpl.content.firstElementChild;
    const zw = document.createTextNode('​');
    r.insertNode(zw);
    r.insertNode(node);
    const nr = document.createRange();
    nr.setStartAfter(zw);
    nr.collapse(true);
    s.removeAllRanges();
    s.addRange(nr);
    return true;
  }
  async function insertMath() {
    const code = inCode();
    const range = keepCaret();
    const s0 = ta.selectionStart, s1 = ta.selectionEnd;
    const r = await DE.mdRich.editDialog({ kind: 'math', title: 'Chèn công thức', value: '', modes: true, ok: 'Chèn vào tài liệu' });
    backToCaret(range);
    if (!r || !r.value.trim()) return;
    const tex = r.value.trim();
    if (r.display) {
      insertBlock('$$\n' + tex + '\n$$', code ? s0 : caretPos());
      return renderPreview();
    }
    if (code) return replaceRange(s0, s1, '$' + tex + '$', s0 + tex.length + 2);
    insertAtom(`<span class="md-math" contenteditable="false" data-tex="${esc(tex)}">${esc('$' + tex + '$')}</span>`);
    commitVisualDom();
  }
  async function insertFootnote() {
    const code = inCode();
    flushVisual();
    const range = keepCaret();
    const s0 = ta.selectionStart, s1 = ta.selectionEnd;
    const r = await formDialog({ title: 'Chèn chú thích cuối trang', fields: [{ name: 'text', label: 'Nội dung chú thích', placeholder: 'vd: Nguồn: Báo cáo thường niên 2025' }], ok: 'Chèn' });
    backToCaret(range);
    if (!r || !r.text || !r.text.trim()) return;
    const nums = [...ta.value.matchAll(/\[\^(\d+)\]/g)].map((m) => +m[1]);
    const n = nums.length ? Math.max(...nums) + 1 : 1;
    if (code) replaceRange(s0, s1, `[^${n}]`);
    else {
      insertAtom(`<sup class="md-fn-ref" contenteditable="false" data-fn="${n}">${n}</sup>`);
      visualDirty = true;
      flushVisual();
    }
    const v = ta.value.replace(/\s+$/, '');
    ta.setRangeText(`\n\n[^${n}]: ${r.text.trim().replace(/\s*\n\s*/g, ' ')}\n`, v.length, ta.value.length, 'preserve');
    onInput();
    renderPreview();
    toast(`Đã thêm chú thích [${n}] – nội dung nằm ở khu “Chú thích” cuối tài liệu`, 'ok');
  }
  function insertToc() {
    if (/^ {0,3}(?:\[toc\]|\[\[_?toc_?\]\]|\$\{toc\})[ \t]*$/im.test(ta.value)) return toast('Tài liệu đã có mục lục', 'info');
    insertBlock('[TOC]', caretPos());
    renderPreview();
  }

  // ======================================================= TRÌNH SOẠN TRỰC QUAN
  // Khung xem chính là trình soạn (contenteditable). Mỗi lần người dùng sửa, DOM được chuyển
  // ngược thành Markdown (MD.fromHTML) – văn bản Markdown luôn là dữ liệu gốc để lưu file.
  let visualT = 0, visualDirty = false;
  const figMd = (fig) => {
    const id = fig.dataset.dg;
    return `[[diagram:${id}|${cleanName((state.diagrams[id] && state.diagrams[id].meta && state.diagrams[id].meta.name) || id)}]]`;
  };
  const visualToMd = () => MD.fromHTML(pv, { diagram: figMd });

  function onVisualInput() {
    visualDirty = true;
    clearTimeout(visualT);
    visualT = setTimeout(flushVisual, 250);
  }

  /** ghi các thay đổi đang chờ của khung trực quan vào văn bản Markdown */
  function flushVisual() {
    clearTimeout(visualT);
    if (!visualDirty) return;
    visualDirty = false;
    const md = visualToMd();
    if (md === ta.value) return;
    const st = ta.scrollTop;
    ta.value = md;
    ta.scrollTop = st;
    state.dirty = true;
    linesDirty = anchorsDirty = true;
    saveLocal();
    updateTitles();
    updateStatus();
  }
  DOCS.flush = flushVisual;

  const inVisual = (n) => !!n && pv.contains(n.nodeType === 3 ? n.parentNode : n);
  const selInVisual = () => {
    const s = getSelection();
    return s.rangeCount > 0 && inVisual(s.anchorNode);
  };

  /** Vị trí (offset trong văn bản Markdown) của con trỏ – nơi sẽ chèn diagram */
  function caretPos() {
    if (view === 'code' || (view === 'split' && lastFocus === 'ta')) return ta.selectionStart;
    flushVisual();
    if (!lastRange || !inVisual(lastRange.startContainer)) return view === 'visual' || lastFocus === 'visual' ? ta.value.length : state.caret;
    const r = lastRange.cloneRange();
    r.collapse(true);
    const host = r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer;
    const lock = host && host.closest('[contenteditable="false"]');
    if (lock && pv.contains(lock)) {
      r.setStartAfter(lock);
      r.collapse(true);
    }
    const mark = document.createTextNode('');
    r.insertNode(mark);
    const md = visualToMd();
    const parent = mark.parentNode;
    mark.remove();
    if (parent) parent.normalize();
    const i = md.indexOf('');
    if (i < 0) return ta.value.length;
    const prefix = md.slice(0, i).replace(/\s+$/, '');
    return ta.value.startsWith(prefix) ? prefix.length : Math.min(i, ta.value.length);
  }

  function ensureVisualFocus() {
    if (selInVisual()) return;
    pv.focus({ preventScroll: true });
    const s = getSelection();
    s.removeAllRanges();
    if (lastRange && inVisual(lastRange.startContainer)) s.addRange(lastRange);
    else {
      const r = document.createRange();
      r.selectNodeContents(pv);
      r.collapse(false);
      s.addRange(r);
    }
  }
  const exec = (cmd, val = null) => {
    ensureVisualFocus();
    document.execCommand(cmd, false, val);
  };
  const anchorEl = () => {
    const n = getSelection().anchorNode;
    return n ? (n.nodeType === 3 ? n.parentElement : n) : null;
  };
  const currentBlock = () => {
    const a = anchorEl();
    return a && pv.contains(a) ? a.closest('h1,h2,h3,h4,h5,h6,p,pre,li,div') : null;
  };
  function toggleHeading(tag) {
    ensureVisualFocus();
    const b = currentBlock();
    exec('formatBlock', b && b.tagName === tag.toUpperCase() ? '<p>' : `<${tag}>`);
  }
  function selectedLis() {
    const s = getSelection();
    if (!s.rangeCount) return [];
    const r = s.getRangeAt(0);
    const lis = [...pv.querySelectorAll('li')].filter((l) => r.intersectsNode(l));
    // chỉ giữ mục trong cùng (bỏ mục cha chứa mục con được chọn)
    return lis.filter((l) => !lis.some((o) => o !== l && l.contains(o)));
  }
  const closestLi = () => {
    const a = anchorEl();
    return a && pv.contains(a) ? a.closest('li') : null;
  };

  const VFORMATS = {
    h1: () => toggleHeading('h1'),
    h2: () => toggleHeading('h2'),
    h3: () => toggleHeading('h3'),
    bold: () => exec('bold'),
    italic: () => exec('italic'),
    strike: () => exec('strikeThrough'),
    code: () => {
      ensureVisualFocus();
      const a = anchorEl();
      const c = a && a.closest('code');
      if (c && pv.contains(c) && !c.closest('pre')) {
        c.replaceWith(document.createTextNode(c.textContent));
        return onVisualInput();
      }
      const t = getSelection().toString() || 'code';
      exec('insertHTML', `<code>${esc(t)}</code>&#8203;`);
    },
    ul: () => {
      ensureVisualFocus();
      const li = closestLi();
      // đang là task list -> bỏ ô tick, giữ danh sách
      if (li && li.querySelector(':scope > input.md-task')) {
        selectedLis().forEach((l) => {
          l.querySelector(':scope > input.md-task')?.remove();
          l.classList.remove('md-task-item');
        });
        return onVisualInput();
      }
      exec('insertUnorderedList');
    },
    ol: () => exec('insertOrderedList'),
    task: () => {
      ensureVisualFocus();
      let li = closestLi();
      if (!li || li.parentElement.tagName !== 'UL') {
        exec('insertUnorderedList');
        li = closestLi();
      }
      const lis = selectedLis().length ? selectedLis() : li ? [li] : [];
      if (!lis.length) return;
      const all = lis.every((l) => l.querySelector(':scope > input.md-task'));
      lis.forEach((l) => {
        const cb = l.querySelector(':scope > input.md-task');
        if (all) {
          cb.remove();
          l.classList.remove('md-task-item');
        } else if (!cb) {
          const i = document.createElement('input');
          i.type = 'checkbox';
          i.className = 'md-task';
          l.prepend(i);
          l.classList.add('md-task-item');
        }
      });
      onVisualInput();
    },
    quote: () => {
      ensureVisualFocus();
      const a = anchorEl();
      if (a && a.closest('blockquote') && pv.contains(a.closest('blockquote'))) exec('outdent');
      else exec('formatBlock', '<blockquote>');
    },
    codeblock: () => {
      ensureVisualFocus();
      const b = currentBlock();
      exec('formatBlock', b && b.tagName === 'PRE' ? '<p>' : '<pre>');
    },
    link: () => linkDialog(),
    image: () => imageDialog(),
    table: () =>
      exec(
        'insertHTML',
        '<div class="md-table"><table><thead><tr><th>Cột 1</th><th>Cột 2</th><th>Cột 3</th></tr></thead>' +
          '<tbody><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table></div><p><br></p>'
      ),
    hr: () => exec('insertHorizontalRule'),
  };

  /** Hộp thoại nhập liệu nhỏ. fields: [{ name, label, value, placeholder }] -> Promise<object | null> */
  function formDialog({ title, fields, ok = 'Áp dụng', extra = '', onExtra }) {
    return new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'modal-backdrop';
      back.innerHTML =
        `<form class="modal doc-form-modal" role="dialog" aria-modal="true" aria-labelledby="df-title"><h3 id="df-title">${esc(title)}</h3>` +
        fields
          .map((f) => `<label class="f"><span>${esc(f.label)}</span><input type="text" name="${f.name}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" autocomplete="off" spellcheck="false"></label>`)
          .join('') +
        extra +
        `<div class="modal-actions"><button type="button" class="btn" data-r="cancel">Huỷ</button><button type="submit" class="btn primary">${esc(ok)}</button></div></form>`;
      const form = back.querySelector('form');
      const close = (val) => {
        window.removeEventListener('keydown', onKey, true);
        back.remove();
        resolve(val);
      };
      const onKey = (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          close(null);
        }
      };
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const o = {};
        fields.forEach((f) => (o[f.name] = form.elements[f.name].value.trim()));
        close(o);
      });
      back.addEventListener('click', (e) => {
        if (e.target === back || (e.target.closest('[data-r="cancel"]'))) close(null);
        const x = e.target.closest('[data-x]');
        if (x && onExtra) onExtra(x.dataset.x, close, form);
      });
      window.addEventListener('keydown', onKey, true);
      document.body.appendChild(back);
      const first = form.querySelector('input[value=""]') || form.querySelector('input');
      first.focus();
      first.select();
    });
  }

  const saveSel = () => {
    const s = getSelection();
    return s.rangeCount && inVisual(s.anchorNode) ? s.getRangeAt(0).cloneRange() : lastRange;
  };
  const restoreSel = (r) => {
    pv.focus({ preventScroll: true });
    if (!r || !inVisual(r.startContainer)) return ensureVisualFocus();
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  };

  async function linkDialog() {
    ensureVisualFocus();
    const range = saveSel();
    const a = anchorEl() && anchorEl().closest('a');
    const text = a ? a.textContent : getSelection().toString();
    const href = a ? (a.getAttribute('href') || '').replace(new RegExp('^#' + MD.ID_PREFIX), '#') : '';
    const r = await formDialog({
      title: a ? 'Sửa liên kết' : 'Chèn liên kết',
      fields: [
        { name: 'text', label: 'Chữ hiển thị', value: text, placeholder: 'ví dụ: Tài liệu tham khảo' },
        { name: 'url', label: 'Địa chỉ (URL)', value: href, placeholder: 'https://…' },
      ],
      extra: a ? '<p class="hint">Để trống địa chỉ để bỏ liên kết.</p>' : '',
    });
    if (!r) return restoreSel(range);
    restoreSel(range);
    if (a) {
      if (!r.url) a.replaceWith(document.createTextNode(r.text || a.textContent));
      else {
        a.setAttribute('href', MD.safeUrl(r.url));
        if (r.text && r.text !== a.textContent) a.textContent = r.text;
      }
      return onVisualInput();
    }
    if (!r.url) return;
    let url = r.url;
    if (!/^([a-z][\w+.-]*:|#|\/|\.)/i.test(url) && /\./.test(url)) url = 'https://' + url;
    exec('insertHTML', `<a href="${esc(MD.safeUrl(url))}">${esc(r.text || url)}</a>`);
  }

  async function imageDialog() {
    ensureVisualFocus();
    const range = saveSel();
    const r = await formDialog({
      title: 'Chèn ảnh',
      fields: [
        { name: 'url', label: 'Địa chỉ ảnh (URL hoặc đường dẫn tương đối, vd: images/so-do.png)', value: '', placeholder: 'https://… hoặc images/anh.png' },
        { name: 'alt', label: 'Mô tả ảnh', value: '', placeholder: 'mô tả ngắn' },
      ],
      ok: 'Chèn',
      extra: '<p class="hint">Hoặc <button type="button" class="btn" data-x="file">Chọn ảnh từ máy…</button> (ảnh được nhúng thẳng vào file .md)</p>',
      onExtra: (x, close) => {
        if (x !== 'file') return;
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.onchange = () => {
          const f = inp.files[0];
          close(null);
          if (f) {
            restoreSel(range);
            insertImageFile(f);
          }
        };
        inp.click();
      },
    });
    if (!r || !r.url) return restoreSel(range);
    restoreSel(range);
    exec('insertHTML', `<img src="${esc(MD.safeUrl(r.url))}" alt="${esc(r.alt)}">`);
  }

  function insertImageFile(file) {
    if (!/^image\/(png|jpe?g|gif|webp|avif)$/.test(file.type)) return toast(`"${file.name}": chỉ nhúng được ảnh PNG, JPG, GIF, WebP`, 'warn');
    if (file.size > 2 * 1024 * 1024) toast(`Ảnh "${file.name}" khá lớn (${(file.size / 1048576).toFixed(1)} MB) – file .md sẽ nặng theo`, 'warn');
    const rd = new FileReader();
    rd.onload = () => exec('insertHTML', `<img src="${rd.result}" alt="${esc(file.name.replace(/\.\w+$/, ''))}">`);
    rd.readAsDataURL(file);
  }

  /** HTML dán từ Word / trang web -> chỉ giữ cấu trúc, bỏ style */
  function cleanPaste(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = MD.sanitize(html.replace(/<!--[\s\S]*?-->/g, ''));
    const KEEP = { A: ['href', 'title'], IMG: ['src', 'alt', 'title'], TH: ['colspan'], TD: ['colspan'], OL: ['start'] };
    tpl.content.querySelectorAll('*').forEach((el) => {
      const keep = KEEP[el.tagName] || [];
      [...el.attributes].forEach((a) => !keep.includes(a.name) && el.removeAttribute(a.name));
      if (/^(SPAN|FONT|O:P|SECTION|ARTICLE|HEADER|FOOTER|MAIN|CENTER)$/i.test(el.tagName)) el.replaceWith(...el.childNodes);
    });
    tpl.content.querySelectorAll('svg, math, video, audio, picture source').forEach((el) => el.remove());
    return tpl.innerHTML;
  }

  function onVisualPaste(e) {
    const dt = e.clipboardData;
    if (!dt) return;
    const img = [...dt.files].find((f) => /^image\//.test(f.type));
    e.preventDefault();
    if (img) return insertImageFile(img);
    const html = dt.getData('text/html');
    const text = dt.getData('text/plain');
    const a = anchorEl();
    if (a && a.closest('pre, code')) return exec('insertText', text);
    // câu trả lời của AI bên ngoài (dùng skill tài liệu): có khối ````markdown / ```diagram / ```mermaid,
    // công thức $$ hay chú thích [^1]: … -> đi qua Markdown để giữ đúng các khối đặc biệt
    // mã PlantUML dán trần (@startuml … @enduml) -> bọc thành khối ```plantuml
    if (/^\s*@start(uml|\w+)\b[\s\S]*^\s*@end\1\b/im.test(text) && !/^ {0,3}(`{3,}|~{3,})/m.test(text)) {
      insertBlock('```plantuml\n' + text.trim() + '\n```', caretPos());
      renderPreview();
      return toast('Đã chèn sơ đồ PlantUML – nhấn đúp để sửa mã, hoặc “◆ Sửa trên whiteboard” để kéo thả', 'ok');
    }
    if (/^ {0,3}(`{3,}|~{3,})[ \t]*(diagram|markdown|md|mermaid|math|plantuml|puml|uml)[ \t]*$|^ {0,3}\$\$|^ {0,3}\[\^[^\]\s]+\]:/im.test(text)) {
      const r = importDiagramFences(DOCS.extractMarkdown(text) || text);
      const pos = caretPos();
      insertBlock(r.text.trim(), pos);
      renderPreview();
      return toast(`Đã dán nội dung${r.count ? ` kèm ${r.count} diagram` : ''}` + (r.errors.length ? ` · ⚠ ${r.errors[0]}` : ''), r.errors.length ? 'warn' : 'ok');
    }
    if (html) return exec('insertHTML', cleanPaste(html));
    // văn bản thuần trông giống Markdown (danh sách, tiêu đề…) -> định dạng luôn
    if (/^(#{1,6} |[-*+] |\d+[.)] |> |```|\|.*\|)/m.test(text)) return exec('insertHTML', cleanPaste(MD.render(text)));
    exec('insertText', text);
  }

  function onVisualKey(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && !e.shiftKey) {
      const k = e.key.toLowerCase();
      if (k === 'k') {
        e.preventDefault();
        return linkDialog();
      }
      if (k === 'e') {
        e.preventDefault();
        return VFORMATS.code();
      }
    }
    if (e.key === 'Tab' && !mod && !e.altKey) {
      const a = anchorEl();
      if (a && a.closest('li')) {
        e.preventDefault();
        exec(e.shiftKey ? 'outdent' : 'indent');
      } else if (a && a.closest('pre')) {
        e.preventDefault();
        exec('insertText', '  ');
      }
    }
  }

  // ======================================================= ĐỒNG BỘ CUỘN
  // Khung soạn ngắt dòng mềm, nên dùng một "gương" (div cùng font, cùng bề rộng) để biết
  // toạ độ từng dòng nguồn; khung xem dùng data-line trên các khối.
  let mirror = null, lineTops = [], linesDirty = true, anchors = [], anchorsDirty = true, scrollLock = null, lockT = 0;

  function measureLines() {
    if (!linesDirty) return;
    linesDirty = false;
    if (!mirror) {
      mirror = document.createElement('div');
      mirror.className = 'md-mirror';
      mirror.setAttribute('aria-hidden', 'true');
      body.appendChild(mirror);
    }
    const cs = getComputedStyle(ta);
    Object.assign(mirror.style, {
      width: ta.clientWidth + 'px',
      font: cs.font,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      tabSize: cs.tabSize,
      paddingTop: cs.paddingTop,
      paddingLeft: cs.paddingLeft,
      paddingRight: cs.paddingRight,
    });
    mirror.innerHTML = ta.value
      .split('\n')
      .map((l) => `<div>${esc(l) || '&#8203;'}</div>`)
      .join('');
    lineTops = Array.from(mirror.children, (d) => d.offsetTop);
  }

  function measureAnchors() {
    if (!anchorsDirty) return;
    anchorsDirty = false;
    const base = pvWrap.scrollTop - pvWrap.getBoundingClientRect().top - 12;
    const seen = new Set();
    anchors = [];
    for (const el of pv.querySelectorAll('[data-line]')) {
      const line = +el.dataset.line;
      if (seen.has(line) || !el.offsetParent) continue;
      seen.add(line);
      anchors.push({ line, top: Math.max(0, el.getBoundingClientRect().top + base) });
    }
    anchors.sort((a, b) => a.line - b.line || a.top - b.top);
    // toạ độ phải tăng dần, bỏ các điểm ngược
    anchors = anchors.filter((a, k, arr) => k === 0 || a.top >= arr[k - 1].top);
    anchors.unshift({ line: 0, top: 0 });
  }

  const lock = (who) => {
    scrollLock = who;
    clearTimeout(lockT);
    lockT = setTimeout(() => (scrollLock = null), 120);
  };

  function syncFromEditor() {
    if (view !== 'split' || scrollLock === 'pv') return;
    lock('ta');
    if (ta.scrollTop + ta.clientHeight >= ta.scrollHeight - 2) return void (pvWrap.scrollTop = pvWrap.scrollHeight);
    measureLines();
    measureAnchors();
    const top = ta.scrollTop;
    let lo = 0, hi = lineTops.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineTops[mid] <= top) lo = mid;
      else hi = mid - 1;
    }
    const next = lineTops[lo + 1] ?? lineTops[lo] + 20;
    const pos = lo + Math.max(0, Math.min(1, (top - lineTops[lo]) / Math.max(1, next - lineTops[lo])));
    pvWrap.scrollTop = lineToY(pos);
  }

  function lineToY(pos) {
    let a = anchors[0], b = null;
    for (const x of anchors) {
      if (x.line <= pos) a = x;
      else {
        b = x;
        break;
      }
    }
    return b ? a.top + ((b.top - a.top) * (pos - a.line)) / Math.max(1e-6, b.line - a.line) : a.top + (pos - a.line) * 20;
  }

  function syncFromPreview() {
    if (view !== 'split' || scrollLock === 'ta') return;
    lock('pv');
    if (pvWrap.scrollTop + pvWrap.clientHeight >= pvWrap.scrollHeight - 2) return void (ta.scrollTop = ta.scrollHeight);
    measureLines();
    measureAnchors();
    const y = pvWrap.scrollTop;
    let a = anchors[0], b = null;
    for (const x of anchors) {
      if (x.top <= y) a = x;
      else {
        b = x;
        break;
      }
    }
    const pos = b ? a.line + ((b.line - a.line) * (y - a.top)) / Math.max(1, b.top - a.top) : a.line;
    const ln = Math.floor(pos), frac = pos - ln;
    const t0 = lineTops[Math.min(ln, lineTops.length - 1)] || 0;
    const t1 = lineTops[ln + 1] ?? t0 + 20;
    ta.scrollTop = t0 + (t1 - t0) * frac;
  }

  /** con trỏ đổi dòng -> đưa khối tương ứng ở khung xem vào tầm nhìn */
  function revealCaretInPreview() {
    if (view !== 'split') return;
    const line = ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
    let best = null;
    for (const el of pv.querySelectorAll('[data-line]')) {
      if (+el.dataset.line <= line) best = el;
      else break;
    }
    if (!best) return;
    const r = best.getBoundingClientRect(), w = pvWrap.getBoundingClientRect();
    if (r.bottom < w.top + 10 || r.top > w.bottom - 10) {
      lock('ta');
      pvWrap.scrollTop += r.top - w.top - w.height / 3;
    }
  }

  // ================================================================ EDITING
  const visible = () => !!ta.offsetParent;

  /** Thay đoạn [start, end) – giữ được Ctrl+Z của trình duyệt khi có thể */
  function replaceRange(start, end, text, selStart, selEnd) {
    let ok = false;
    if (visible()) {
      ta.focus();
      ta.setSelectionRange(start, end);
      try {
        ok = document.execCommand('insertText', false, text);
      } catch (_) {
        ok = false;
      }
      if (ok && ta.value.slice(start, start + text.length) !== text) ok = false;
    }
    if (!ok) {
      ta.setRangeText(text, start, end, 'end');
      onInput();
    }
    if (selStart != null) ta.setSelectionRange(selStart, selEnd ?? selStart);
    state.caret = ta.selectionStart;
  }

  function wrapSel(before, after = before, ph = 'văn bản') {
    const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    if (v.slice(s - before.length, s) === before && v.slice(e, e + after.length) === after) {
      // đã bọc -> bỏ bọc
      const inner = v.slice(s, e);
      return replaceRange(s - before.length, e + after.length, inner, s - before.length, s - before.length + inner.length);
    }
    const sel = v.slice(s, e) || ph;
    replaceRange(s, e, before + sel + after, s + before.length, s + before.length + sel.length);
  }

  /** áp dụng tiền tố cho các dòng đang chọn (toggle) */
  function prefixLines(make, strip) {
    const v = ta.value;
    let s = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    let endPos = ta.selectionEnd;
    if (endPos > ta.selectionStart && v[endPos - 1] === '\n') endPos--;
    let e = v.indexOf('\n', endPos);
    if (e < 0) e = v.length;
    const lines = v.slice(s, e).split('\n');
    const target = lines.map((l, k) => make(k));
    const all = lines.every((l, k) => !l.trim() || l.startsWith(target[k]));
    let k2 = 0;
    const out = lines.map((l) => {
      if (!l.trim() && lines.length > 1) return l;
      const bare = l.replace(strip, '');
      return all ? bare : make(k2++) + bare;
    });
    const text = out.join('\n');
    replaceRange(s, e, text, s, s + text.length);
  }

  /** chèn một khối trên các dòng riêng, có dòng trống bao quanh */
  function insertBlock(block, pos, selectInner) {
    const v = ta.value;
    pos = Math.max(0, Math.min(pos ?? ta.selectionStart, v.length));
    const ls = v.lastIndexOf('\n', pos - 1) + 1;
    let le = v.indexOf('\n', pos);
    if (le < 0) le = v.length;
    const at = v.slice(ls, le).trim() === '' ? ls : le;
    const lineEnd = at === ls ? le : at; // dòng trống: thay luôn dòng đó
    const before = v.slice(0, at), after = v.slice(lineEnd);
    const pre = !before ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const post = !after ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
    const text = pre + block + post;
    const start = at + pre.length;
    const sel = selectInner ? [start + selectInner[0], start + selectInner[1]] : [start + block.length, start + block.length];
    replaceRange(at, lineEnd, text, sel[0], sel[1]);
    return start;
  }

  const FORMATS = {
    h1: () => prefixLines(() => '# ', /^#{1,6}[ \t]+/),
    h2: () => prefixLines(() => '## ', /^#{1,6}[ \t]+/),
    h3: () => prefixLines(() => '### ', /^#{1,6}[ \t]+/),
    bold: () => wrapSel('**'),
    italic: () => wrapSel('*'),
    strike: () => wrapSel('~~'),
    code: () => wrapSel('`', '`', 'code'),
    ul: () => prefixLines(() => '- ', /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/),
    ol: () => prefixLines((k) => `${k + 1}. `, /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/),
    task: () => prefixLines(() => '- [ ] ', /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/),
    quote: () => prefixLines(() => '> ', /^[ \t]*>[ \t]?/),
    codeblock: () => {
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd) || 'code';
      if (ta.selectionStart !== ta.selectionEnd) return replaceRange(ta.selectionStart, ta.selectionEnd, '```\n' + sel + '\n```', ta.selectionStart + 4 + sel.length + 4);
      insertBlock('```\n' + sel + '\n```', null, [4, 4 + sel.length]);
    },
    link: () => {
      const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
      const sel = v.slice(s, e);
      if (/^https?:\/\/\S+$/.test(sel)) return replaceRange(s, e, `[liên kết](${sel})`, s + 1, s + 10);
      const txt = sel || 'liên kết';
      replaceRange(s, e, `[${txt}](https://)`, s + txt.length + 3, s + txt.length + 11);
    },
    image: () => {
      const s = ta.selectionStart, e = ta.selectionEnd;
      const alt = ta.value.slice(s, e) || 'mô tả ảnh';
      replaceRange(s, e, `![${alt}](duong-dan-anh.png)`, s + alt.length + 4, s + alt.length + 22);
    },
    table: () => insertBlock('| Cột 1 | Cột 2 | Cột 3 |\n| --- | --- | --- |\n| A | B | C |\n| D | E | F |', null, [2, 7]),
    hr: () => insertBlock('---'),
  };

  // Enter trong danh sách: tự thêm gạch đầu dòng; Tab / Shift+Tab: thụt lề
  function onEditorKey(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey) {
      const k = e.key.toLowerCase();
      const fmt = { b: 'bold', i: 'italic', k: 'link', e: 'code' }[k];
      if (fmt && !e.shiftKey) {
        e.preventDefault();
        return FORMATS[fmt]();
      }
    }
    if (e.key === 'Tab' && !mod && !e.altKey) {
      e.preventDefault();
      const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const multi = v.slice(s, en).includes('\n');
      const lineText = v.slice(ls, (v.indexOf('\n', s) + 1 || v.length + 1) - 1);
      const inList = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]/.test(lineText);
      if (!multi && !e.shiftKey && !inList) return replaceRange(s, en, '  ', s + 2);
      let le = v.indexOf('\n', en > s && v[en - 1] === '\n' ? en - 1 : en);
      if (le < 0) le = v.length;
      const lines = v.slice(ls, le).split('\n');
      const out = lines.map((l) => (e.shiftKey ? l.replace(/^( {1,2}|\t)/, '') : '  ' + l)).join('\n');
      const delta = out.length - (le - ls);
      return replaceRange(ls, le, out, multi ? ls : Math.max(ls, s + (e.shiftKey ? Math.min(0, delta) : 2)), multi ? ls + out.length : Math.max(ls, en + delta));
    }
    if (e.key === 'Enter' && !mod && !e.shiftKey && !e.altKey && ta.selectionStart === ta.selectionEnd) {
      const v = ta.value, s = ta.selectionStart;
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const line = v.slice(ls, s);
      const m = line.match(/^([ \t]*)(?:([-*+])|(\d+)([.)]))([ \t]+)(\[[ xX]\][ \t]+)?/) || line.match(/^([ \t]*)(>[ \t]?)/);
      if (!m) return;
      e.preventDefault();
      if (line.trim() === m[0].trim()) {
        // mục rỗng -> kết thúc danh sách
        return replaceRange(ls, s, '', ls);
      }
      let next;
      if (/^[ \t]*>/.test(line)) next = line.match(/^[ \t]*>[ \t]?/)[0]; // trích dẫn
      else if (m[3] !== undefined) next = m[1] + (parseInt(m[3], 10) + 1) + m[4] + m[5] + (m[6] ? '[ ] ' : '');
      else next = m[1] + m[2] + m[5] + (m[6] ? '[ ] ' : '');
      replaceRange(s, s, '\n' + next, s + 1 + next.length);
    }
  }

  function onInput() {
    visualStale = true;
    state.dirty = true;
    state.caret = ta.selectionStart;
    linesDirty = true;
    saveLocal();
    scheduleRender();
    updateTitles();
  }

  // ============================================================ FILE I/O
  const MD_TYPES = [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown', '.mdx', '.txt'] } }];

  async function confirmDiscard(title) {
    if (!state.dirty || !ta.value.trim()) return true;
    const r = await DE.ui.confirm({
      title,
      message: `Tài liệu "${state.name}" có thay đổi chưa lưu ra file.`,
      ok: 'Bỏ thay đổi',
      alt: 'Lưu rồi tiếp tục',
      cancel: 'Huỷ',
      danger: true,
    });
    if (r === 'alt') return saveDoc();
    return !!r;
  }

  function setDoc(text, { name, diagrams = {}, handle = null, crlf = false, dirty = false } = {}) {
    state.name = name || DEFAULT_NAME;
    state.diagrams = diagrams;
    state.handle = handle;
    state.crlf = crlf;
    state.dirty = dirty;
    state.savedAt = null;
    ta.value = text;
    ta.setSelectionRange(0, 0);
    state.caret = 0;
    ta.scrollTop = 0;
    pvWrap.scrollTop = 0;
    linesDirty = true;
    $('#doc-name').value = state.name;
    renderPreview();
    updateTitles();
    saveLocal();
  }

  /** Mở một File .md (nút Mở, kéo thả, mở từ hệ điều hành) */
  DOCS.openFile = async function (file, handle = null, { confirm = true } = {}) {
    if (!/\.(md|markdown|mdx|txt)$/i.test(file.name) && !/^text\//.test(file.type)) {
      return toast(`Không mở được "${file.name}": chỉ nhận file Markdown (.md, .markdown, .txt)`, 'error');
    }
    show('doc');
    if (confirm && !(await confirmDiscard(`Mở "${file.name}"?`))) return;
    let raw;
    try {
      raw = await file.text();
    } catch (e) {
      return toast(`Không đọc được "${file.name}": ${e.message}`, 'error');
    }
    const crlf = /\r\n/.test(raw);
    const { text, diagrams, count } = collapse(raw.replace(/\r\n?/g, '\n'));
    setDoc(text, { name: file.name, diagrams, handle, crlf });
    toast(`Đã mở "${file.name}"` + (count ? ` – ${count} diagram có thể sửa` : ''), 'ok');
  };

  async function openDoc() {
    if (!(await confirmDiscard('Mở file Markdown khác?'))) return;
    if (window.showOpenFilePicker) {
      try {
        const [h] = await window.showOpenFilePicker({ types: MD_TYPES, multiple: false });
        return DOCS.openFile(await h.getFile(), h, { confirm: false });
      } catch (e) {
        if (e.name === 'AbortError') return;
        /* không dùng được File System Access (file://, iframe…) -> dùng input */
      }
    }
    const inp = $('#md-file-input');
    inp.dataset.noconfirm = '1';
    inp.click();
  }

  async function writeHandle(h, content) {
    if (h.queryPermission && (await h.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Không được cấp quyền ghi file');
    }
    const w = await h.createWritable();
    await w.write(content);
    await w.close();
  }

  function markSaved(how) {
    state.dirty = false;
    state.savedAt = Date.now();
    saveLocal();
    updateTitles();
    updateStatus();
    toast(how, 'ok');
  }

  /** Lưu: ghi thẳng vào file đang mở nếu được, không thì hỏi nơi lưu / tải xuống. Trả về true nếu đã lưu */
  async function saveDoc(as = false) {
    flushName();
    const content = serialize();
    if (!as && state.handle) {
      try {
        await writeHandle(state.handle, content);
        markSaved(`Đã lưu "${state.handle.name}"`);
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false;
        toast(`Không ghi được vào file: ${e.message} – chọn nơi lưu khác`, 'warn');
      }
    }
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: state.name, types: MD_TYPES });
        await writeHandle(h, content);
        state.handle = h;
        state.name = h.name;
        $('#doc-name').value = state.name;
        markSaved(`Đã lưu "${h.name}"`);
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false;
        /* không hỗ trợ trong ngữ cảnh này -> tải xuống */
      }
    }
    download();
    markSaved(`Đã tải xuống "${state.name}"`);
    return true;
  }

  function download() {
    flushName();
    DE.download(state.name, new Blob([serialize()], { type: 'text/markdown;charset=utf-8' }));
  }

  function flushName() {
    let n = ($('#doc-name').value || '').trim().replace(/[\\/:*?"<>|]+/g, '_');
    if (!n) n = DEFAULT_NAME;
    if (!/\.(md|markdown|mdx|txt)$/i.test(n)) n += '.md';
    if (n !== state.name) {
      state.name = n;
      saveLocal();
    }
    $('#doc-name').value = n;
    updateTitles();
  }

  async function newDoc() {
    if (!(await confirmDiscard('Tạo tài liệu mới?'))) return;
    setDoc('# Tiêu đề\n\n', { name: DEFAULT_NAME });
    if (visible()) {
      ta.focus();
      ta.setSelectionRange(2, 9);
    }
  }

  async function exportHTML() {
    flushName();
    flushVisual();
    renderPreview();
    const clone = pv.cloneNode(true);
    clone.removeAttribute('contenteditable');
    clone.querySelectorAll('.dg-actions').forEach((n) => n.remove());
    // vẽ Mermaid (ảnh SVG nhúng), công thức (MathML – không cần CSS / font ngoài), tô màu code, emoji
    if (DE.mdRich && clone.querySelector('.md-mermaid, .md-plantuml, .md-math, .md-emoji, pre > code[class*="language-"]')) {
      toast('Đang chuẩn bị file HTML (vẽ sơ đồ, công thức)…', 'info');
      await DE.mdRich.enhance(clone, { mathml: true });
    }
    clone.querySelectorAll('[data-src],[data-tex],[data-sc],[data-fn],[data-type],[data-title],[data-fold]').forEach((n) => {
      ['data-src', 'data-tex', 'data-sc', 'data-fn', 'data-type', 'data-title', 'data-fold'].forEach((a) => n.removeAttribute(a));
    });
    clone.querySelectorAll('[contenteditable],[data-raw]').forEach((n) => {
      n.removeAttribute('contenteditable');
      n.removeAttribute('data-raw');
    });
    clone.querySelectorAll('[data-line],[data-dg],[data-task-line],[title]').forEach((n) => {
      n.removeAttribute('data-line');
      n.removeAttribute('data-dg');
      n.removeAttribute('data-task-line');
      if (n.matches('figure')) n.removeAttribute('title');
    });
    clone.querySelectorAll('input[type=checkbox]').forEach((n) => n.setAttribute('disabled', ''));
    clone.querySelectorAll('.editing').forEach((n) => n.classList.remove('editing'));
    const h1 = pv.querySelector('h1');
    const title = (h1 && h1.textContent.trim()) || state.name.replace(/\.\w+$/, '');
    const html =
      `<!doctype html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
      `<title>${esc(title)}</title>\n<style>\nbody{margin:0;background:#fff}\n.md-preview{max-width:900px;margin:0 auto;padding:32px 24px 64px}\n${MD_CSS}\n</style>\n</head>\n<body>\n<article class="md-preview">\n${clone.innerHTML}\n</article>\n</body>\n</html>\n`;
    DE.download(state.name.replace(/\.\w+$/, '') + '.html', new Blob([html], { type: 'text/html;charset=utf-8' }));
    toast('Đã xuất HTML (mở bằng trình duyệt, in ra PDF được)', 'ok');
  }

  // ================================================================ PHIÊN NHÚNG
  const docIsEmpty = (d) => !d.nodes.length && !d.edges.length;

  function persistSession() {
    if (!session) return lsSet(SESSION_KEY, null);
    lsSet(SESSION_KEY, JSON.stringify({ kind: session.kind, id: session.id, pos: session.pos, original: session.original, doc: store.doc }));
  }

  /** gọi từ main.js mỗi khi diagram đổi. true = đang trong phiên nhúng (đừng ghi đè diagram chính) */
  DOCS.onDiagramChange = function () {
    if (!session) return false;
    persistSession();
    return true;
  };
  DOCS.inSession = () => !!session;

  /** Mở diagram trong tab Diagram để vẽ / sửa cho tài liệu */
  async function startSession(target) {
    flushVisual();
    if (session) {
      const ok = await DOCS.commitDiagram({ quiet: true, stay: true });
      if (!ok) return;
    }
    E.commitText && E.commitText();
    const doc = target.doc ? DE.normalizeDoc(DE.clone(target.doc)).doc : DE.emptyDoc(DE.ui.getMode());
    session = {
      kind: target.kind,
      id: target.id || null,
      pos: target.pos ?? null,
      original: JSON.stringify(doc),
      stash: { doc: store.doc, undo: store.undoStack.slice(), redo: store.redoStack.slice() },
    };
    store.load(doc, { history: false });
    E.setSelection([]);
    persistSession();
    show('diagram');
    updateSessionUI();
    renderPreview();
    requestAnimationFrame(() => E.fit());
    toast(
      target.kind === 'edit'
        ? `Đang sửa "${doc.meta.name}" – xong bấm ✓ Cập nhật vào tài liệu`
        : 'Vẽ diagram mới (có thể chọn chế độ / mẫu trên thanh công cụ) – xong bấm ✓ Chèn vào tài liệu',
      'info'
    );
  }

  /** Kết thúc phiên: trả diagram đang vẽ dở ở tab Diagram về như cũ */
  function endSession() {
    const s = session;
    session = null;
    lsSet(SESSION_KEY, null);
    if (s && s.stash) {
      store.load(s.stash.doc, { history: false });
      store.undoStack.push(...s.stash.undo);
      store.redoStack.push(...s.stash.redo);
      store.touch();
      E.setSelection([]);
      requestAnimationFrame(() => E.fit());
    }
    updateSessionUI();
  }

  function findPlaceholder(id) {
    const re = new RegExp(`^\\[\\[diagram:${id}(?:\\|[^\\]\\n]*)?\\]\\][ \\t]*$`, 'm');
    const m = re.exec(ta.value);
    return m ? { start: m.index, end: m.index + m[0].length } : null;
  }

  /**
   * Đưa diagram đang mở ở tab Diagram vào tài liệu:
   *  - phiên "sửa": cập nhật diagram đó;  - phiên "mới" / không có phiên: chèn tại con trỏ.
   */
  DOCS.commitDiagram = async function ({ quiet = false, stay = false } = {}) {
    E.commitText && E.commitText();
    const doc = DE.clone(store.doc);
    if (docIsEmpty(doc)) {
      toast('Diagram đang trống – vẽ gì đó trước khi chèn vào tài liệu', 'warn');
      return false;
    }
    const wasSession = session;
    const pos = wasSession && wasSession.kind === 'insert' ? wasSession.pos : caretPos();
    if (!stay) show('doc');
    let id, msg;
    if (wasSession && wasSession.kind === 'edit' && wasSession.id) {
      id = wasSession.id;
      state.diagrams[id] = doc;
      const ph = findPlaceholder(id);
      if (ph) replaceRange(ph.start, ph.end, placeholder(id, doc), ph.end);
      else insertBlock(placeholder(id, doc), pos);
      msg = `Đã cập nhật "${doc.meta.name}" trong tài liệu`;
    } else {
      id = newId();
      state.diagrams[id] = doc;
      insertBlock(placeholder(id, doc), pos);
      msg = `Đã chèn "${doc.meta.name}" vào tài liệu`;
    }
    if (wasSession) endSession();
    state.dirty = true;
    saveLocal();
    updateTitles();
    renderPreview();
    if (!stay) flashFigure(id);
    if (!quiet) toast(msg + (wasSession ? '' : ' (bản sao – diagram ở tab Diagram vẫn giữ nguyên)'), 'ok');
    return true;
  };

  async function cancelSession() {
    if (!session) return;
    const changed = JSON.stringify(store.doc) !== session.original;
    if (changed) {
      const ok = await DE.ui.confirm({
        title: 'Bỏ các thay đổi trên diagram này?',
        message: session.kind === 'edit' ? 'Diagram trong tài liệu sẽ giữ nguyên như trước khi sửa.' : 'Diagram mới sẽ không được chèn vào tài liệu.',
        ok: 'Bỏ thay đổi',
        cancel: 'Tiếp tục vẽ',
        danger: true,
      });
      if (!ok) return;
    }
    endSession();
    renderPreview();
    show('doc');
  }

  function flashFigure(id) {
    requestAnimationFrame(() => {
      const fig = pv.querySelector(`figure[data-dg="${CSS.escape(id)}"]`);
      if (!fig) return;
      if (view !== 'edit') fig.scrollIntoView({ block: 'center', behavior: 'smooth' });
      fig.classList.add('flash');
      setTimeout(() => fig.classList.remove('flash'), 1600);
    });
  }

  function jumpToLine(line, selectLine = true) {
    if (!dev) return;
    flushVisual();
    if (view === 'visual') setView('split');
    const lines = ta.value.split('\n');
    line = Math.max(0, Math.min(line, lines.length - 1));
    let a = 0;
    for (let k = 0; k < line; k++) a += lines[k].length + 1;
    const b = a + lines[line].length;
    ta.focus();
    measureLines();
    ta.scrollTop = Math.max(0, (lineTops[line] || 0) - ta.clientHeight / 3);
    ta.setSelectionRange(a, selectLine ? b : a);
    state.caret = a;
  }

  function removeDiagram(id) {
    const fig = view !== 'code' && pv.querySelector(`figure[data-dg="${CSS.escape(id)}"]`);
    if (fig) {
      // xoá ngay trong trình soạn trực quan để Ctrl+Z khôi phục được
      pv.focus({ preventScroll: true });
      const r = document.createRange();
      r.selectNode(fig);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      document.execCommand('delete');
      if (pv.contains(fig)) fig.remove();
      onVisualInput();
      return toast('Đã xoá diagram khỏi tài liệu (Ctrl+Z để hoàn tác)', 'info');
    }
    const ph = findPlaceholder(id);
    if (!ph) return;
    const v = ta.value;
    let s = ph.start, e = ph.end;
    if (v[e] === '\n') e++;
    if (v[e] === '\n' && (s === 0 || v[s - 1] === '\n')) e++; // bỏ luôn một dòng trống thừa
    replaceRange(s, e, '', s);
    toast('Đã xoá diagram khỏi tài liệu (Ctrl+Z trong khung soạn để hoàn tác)', 'info');
  }

  // ================================================================ GIAO DIỆN
  const CHAT_PLACEHOLDER = {
    doc: 'Nhờ AI viết / sửa tài liệu này…',
    diagram: 'Hỏi AI về diagram này…',
    design: 'Nhờ AI dựng / sửa trang web này…',
    guide: 'Hỏi AI cách sử dụng công cụ…',
    settings: 'Hỏi AI…',
  };

  const WS_ORDER = ['doc', 'diagram', 'design', 'guide', 'settings'];
  /** Chuyển tab: 'doc' (Tài liệu) | 'diagram' | 'design' (Thiết kế trang) | 'guide' (Hướng dẫn) | 'settings' (Cài đặt) */
  function show(name) {
    if (!WS_ORDER.includes(name)) return;
    const was = ws;
    ws = name;
    const doc = name === 'doc';
    const other = name !== 'diagram'; // whiteboard bị che
    if (other) E.commitText && E.commitText();
    if (!doc) flushVisual();
    if (was === 'design' && name !== 'design' && DE.pages) DE.pages.onHide();
    if (was === 'settings' && name !== 'settings' && DE.settings) DE.settings.onHide();
    document.body.classList.toggle('ws-doc', doc);
    document.body.classList.toggle('ws-guide', name === 'guide');
    document.body.classList.toggle('ws-settings', name === 'settings');
    document.body.classList.toggle('ws-design', name === 'design');
    document.body.classList.toggle('ws-nodiagram', other);
    docview.hidden = !doc;
    $('#guideview').hidden = name !== 'guide';
    const dv = $('#designview');
    if (dv) dv.hidden = name !== 'design';
    const sv = $('#settingsview');
    if (sv) sv.hidden = name !== 'settings';
    if (name === 'guide' && DE.guide) DE.guide.render();
    if (name === 'design' && DE.pages) DE.pages.onShow();
    if (name === 'settings' && was !== 'settings' && DE.settings) DE.settings.onShow(was);
    ['#toolbar', '#stage', '#statusbar'].forEach((q) => ($(q).inert = other));
    ['#palette', '#inspector'].forEach((q) => {
      const el = $(q);
      el.inert = other || el.getAttribute('aria-hidden') === 'true';
    });
    const prompt = $('#ai-prompt');
    if (prompt) prompt.placeholder = CHAT_PLACEHOLDER[name];
    $$('#ws-tabs [data-ws]').forEach((b) => {
      const on = b.dataset.ws === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    lsSet(WS_KEY, name);
    if (doc && was !== 'doc') {
      if (visualStale) renderPreview();
      if (view === 'code' || (view === 'split' && lastFocus === 'ta')) {
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(state.caret, state.caret);
      } else {
        pv.focus({ preventScroll: true });
        if (lastRange && inVisual(lastRange.startContainer)) {
          const s = getSelection();
          s.removeAllRanges();
          s.addRange(lastRange);
        }
      }
    }
    updateTitles();
  }
  DOCS.show = show;
  DOCS.current = () => ws;

  /** v: 'code' | 'split' | 'visual'. Khi tắt chế độ developer luôn là 'visual'. */
  function setView(v, persist = true) {
    v = { edit: 'code', preview: 'visual' }[v] || v; // tên cũ
    if (!['code', 'split', 'visual'].includes(v)) v = 'split';
    if (!dev) v = 'visual';
    flushVisual();
    view = v;
    body.className = 'doc-body view-' + v;
    $$('.doc-view-switch [data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    if (persist && dev) lsSet(VIEW_KEY, v);
    linesDirty = anchorsDirty = true;
    if (v !== 'code' && visualStale) renderPreview();
    updateStatus();
  }

  function setDev(on, { announce = false } = {}) {
    dev = !!on;
    docview.classList.toggle('dev', dev);
    const b = $('.doc-toolbar [data-doc="dev"]');
    b.classList.toggle('active', dev);
    b.setAttribute('aria-pressed', String(dev));
    lsSet(DEV_KEY, dev ? '1' : null);
    setView(dev ? lsGet(VIEW_KEY) || (window.innerWidth < 800 ? 'code' : 'split') : 'visual', false);
    if (announce) toast(dev ? 'Đã bật chế độ developer: sửa trực tiếp mã Markdown ở khung bên trái' : 'Đã tắt chế độ developer', 'info');
  }

  /** Xem đúng nội dung file .md sẽ được lưu (diagram dạng SVG + JSON) */
  function showFileSource() {
    const content = serialize();
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    const kb = new Blob([content]).size / 1024;
    back.innerHTML =
      `<div class="modal doc-src-modal" role="dialog" aria-modal="true" aria-labelledby="dsm-title"><h3 id="dsm-title">Nội dung file "${esc(state.name)}"</h3>` +
      `<p class="modal-msg">Đây chính xác là nội dung được ghi khi bấm Lưu / Tải .md (${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB). ` +
      `Mỗi diagram gồm 3 dòng: comment chứa dữ liệu JSON (ẩn khi xem, dùng để mở lại sửa tiếp), <code>&lt;div&gt;&lt;svg…&gt;</code> là hình vẽ ` +
      `hiển thị trong mọi trình xem Markdown cho phép HTML, và comment kết thúc.</p>` +
      `<textarea class="code" readonly spellcheck="false"></textarea>` +
      `<div class="modal-actions"><button class="btn" data-r="copy">Sao chép</button><button class="btn primary" data-r="close">Đóng</button></div></div>`;
    const t = back.querySelector('textarea');
    t.value = content;
    const close = () => {
      window.removeEventListener('keydown', onKey, true);
      back.remove();
    };
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') close();
    };
    back.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-r]');
      if (b && b.dataset.r === 'copy') {
        try {
          await navigator.clipboard.writeText(content);
          toast('Đã sao chép nội dung file', 'ok');
        } catch (_) {
          t.select();
        }
      } else if ((b && b.dataset.r === 'close') || e.target === back) close();
    });
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(back);
    back.querySelector('[data-r="close"]').focus();
  }

  function updateTitles() {
    const name = state.name;
    $('#ws-doc-title').textContent = name;
    $('#ws-doc-dot').hidden = !state.dirty;
    $('#doc-dirty').hidden = !state.dirty;
    if (ws === 'doc') document.title = (state.dirty ? '● ' : '') + name + ' – Diagram Editor';
    else if (ws === 'guide') document.title = 'Hướng dẫn sử dụng – Diagram Editor';
    else if (ws === 'settings') document.title = 'Cài đặt – Diagram Editor';
    else if (ws === 'design') document.title = DE.pages ? DE.pages.title() : 'Thiết kế trang – Diagram Editor';
    else document.title = (store.doc.meta?.name ? store.doc.meta.name + ' – ' : '') + 'Diagram Editor (BPMN, UML, Flowchart)';
  }

  function updateSessionUI() {
    const banner = $('#embed-banner');
    const btn = $('#toolbar [data-action="to-doc"]');
    $('#app').classList.toggle('has-embed', !!session);
    banner.hidden = !session;
    $('#ws-dg-badge').hidden = !session;
    if (session) {
      const edit = session.kind === 'edit';
      $('#embed-banner-text').innerHTML = edit
        ? `Đang sửa diagram nhúng trong <b>${esc(state.name)}</b>`
        : `Đang vẽ diagram mới cho <b>${esc(state.name)}</b>`;
      $('#embed-banner [data-embed="commit"]').textContent = edit ? '✓ Cập nhật vào tài liệu' : '✓ Chèn vào tài liệu';
      $('#ws-dg-badge').textContent = edit ? 'đang sửa' : 'mới';
    }
    if (btn) {
      btn.querySelector('.lbl').textContent = session ? (session.kind === 'edit' ? 'Cập nhật tài liệu' : 'Chèn vào tài liệu') : 'Vào tài liệu';
      btn.title = session
        ? 'Đưa diagram này vào tài liệu Markdown và quay lại tab Tài liệu'
        : 'Chèn một bản sao diagram này vào tài liệu Markdown (tại vị trí con trỏ trong tab Tài liệu)';
    }
  }

  let statusMsg = null;
  function setStatus(msg, kind) {
    statusMsg = msg ? { msg, kind } : null;
    updateStatus();
  }
  function updateStatus() {
    if (!ta) return;
    const v = ta.value;
    const before = v.slice(0, ta.selectionStart);
    const ln = before.split('\n').length, col = ta.selectionStart - before.lastIndexOf('\n');
    $('#doc-st-pos').textContent = `Dòng ${ln}, cột ${col}`;
    const prose = v.replace(PH_RE, '').replace(/```[\s\S]*?```/g, ' ');
    const words = (prose.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) || []).length;
    const dg = [...v.matchAll(PH_RE)].length;
    $('#doc-st-count').textContent = `${words.toLocaleString('vi-VN')} từ · ${v.split('\n').length} dòng · ${dg} diagram`;
    const st = $('#doc-st-save');
    if (statusMsg) {
      st.textContent = statusMsg.msg;
      st.className = 'doc-st-' + (statusMsg.kind || 'info');
    } else {
      const t = state.savedAt ? new Date(state.savedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
      st.textContent = state.dirty ? 'Đã tự lưu vào trình duyệt · chưa lưu ra file' : t ? `Đã lưu ra file lúc ${t}` : 'Đã tự lưu vào trình duyệt';
      st.className = state.dirty ? 'doc-st-warn' : 'doc-st-ok';
    }
  }

  // ===================================================================== INIT
  DOCS.init = function () {
    docview = $('#docview');
    ta = $('#md-src');
    pv = $('#md-preview');
    pvWrap = $('#md-preview-wrap');
    body = $('#doc-body');

    const style = document.createElement('style');
    style.id = 'md-style';
    style.textContent = MD_CSS;
    document.head.appendChild(style);

    if (!loadLocal()) {
      ta.value = welcome();
      state.dirty = false;
    }
    $('#doc-name').value = state.name;
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p'); // Enter tạo <p> thay vì <div>
    } catch (_) {
      /* ignore */
    }
    setDev(lsGet(DEV_KEY) === '1');

    // ---------------------------------------------------------- tab làm việc
    $('#ws-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ws]');
      if (b) show(b.dataset.ws);
    });
    $('#ws-tabs').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const n = WS_ORDER.length;
        show(WS_ORDER[(WS_ORDER.indexOf(ws) + (e.key === 'ArrowRight' ? 1 : n - 1)) % n]);
        $('#ws-tabs .ws-tab.active').focus();
      }
    });

    // ------------------------------------------------------------- toolbar
    $('.doc-toolbar').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.fmt) {
        const visual = view === 'visual' || (view === 'split' && lastFocus !== 'ta');
        const fn = (visual ? VFORMATS : FORMATS)[b.dataset.fmt];
        if (fn) fn();
      } else if (b.dataset.view) setView(b.dataset.view);
      else if (b.dataset.doc) DOC_ACTIONS[b.dataset.doc] && DOC_ACTIONS[b.dataset.doc]();
    });
    // bấm nút định dạng không được lấy mất con trỏ / vùng chọn trong trình soạn
    $('.doc-toolbar').addEventListener('mousedown', (e) => {
      if (e.target.closest('button[data-fmt]')) e.preventDefault();
    });
    $('#md-src-note').addEventListener('click', (e) => e.target.closest('[data-doc="file-source"]') && showFileSource());
    $('#doc-name').addEventListener('change', flushName);
    $('#doc-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        flushName();
        ta.focus();
      }
    });

    // ------------------------------------------------------------- editor
    ta.addEventListener('input', onInput);
    ta.addEventListener('keydown', onEditorKey);
    const caretMoved = DE.debounce(() => {
      revealCaretInPreview();
      updateStatus();
    }, 120);
    ['keyup', 'click', 'select'].forEach((ev) =>
      ta.addEventListener(ev, () => {
        state.caret = ta.selectionStart;
        caretMoved();
      })
    );
    ta.addEventListener('blur', () => (state.caret = ta.selectionStart));
    ta.addEventListener('focus', () => (lastFocus = 'ta'));

    // ---------------------------------------------------- trình soạn trực quan
    pv.addEventListener('input', onVisualInput);
    pv.addEventListener('keydown', onVisualKey);
    pv.addEventListener('paste', onVisualPaste);
    pv.addEventListener('focus', () => (lastFocus = 'visual'));
    document.addEventListener('selectionchange', () => {
      const s = getSelection();
      if (s.rangeCount && inVisual(s.anchorNode)) {
        lastRange = s.getRangeAt(0).cloneRange();
        lastFocus = 'visual';
      }
    });
    // ô tick của task list: tự đảo trạng thái (checkbox trong contenteditable không ổn định giữa các trình duyệt)
    pv.addEventListener('mousedown', (e) => {
      const cb = e.target.closest('input.md-task');
      if (!cb) return;
      e.preventDefault();
      cb.checked = !cb.checked;
      cb.toggleAttribute('checked', cb.checked);
      onVisualInput();
    });
    pv.addEventListener('click', (e) => {
      if (e.target.closest('input.md-task')) e.preventDefault();
    });
    // trang đóng / ẩn: ghi ngay, không chờ debounce
    const flushAll = () => {
      flushVisual();
      saveLocalNow();
    };
    window.addEventListener('pagehide', flushAll);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushAll());
    ta.addEventListener('scroll', () => requestAnimationFrame(syncFromEditor), { passive: true });
    pvWrap.addEventListener('scroll', () => requestAnimationFrame(syncFromPreview), { passive: true });
    new ResizeObserver(() => (linesDirty = anchorsDirty = true)).observe(body);
    pv.addEventListener('load', () => (anchorsDirty = true), true); // ảnh tải xong đổi chiều cao

    // ------------------------------------------------------------- preview
    pv.addEventListener('click', (e) => {
      const pb = e.target.closest('[data-pua]');
      if (pb) {
        const blk = pb.closest('.md-plantuml');
        if (pb.dataset.pua === 'edit') return editRich(blk, true);
        if (pb.dataset.pua === 'whiteboard') return richToDiagram(blk);
        const r = DE.mdRich && DE.mdRich.plantumlDoc(blk.getAttribute('data-src'));
        if (r && r.ok) DE.download((r.doc.meta.name || 'plantuml').replace(/[\\/:*?"<>|]+/g, '_') + '.svg', new Blob([DE.exportSVG(r.doc)], { type: 'image/svg+xml' }));
        return;
      }
      const mb = e.target.closest('[data-mma]');
      if (mb) {
        const blk = mb.closest('.md-mermaid');
        if (mb.dataset.mma === 'edit') return editRich(blk, true);
        if (mb.dataset.mma === 'whiteboard') return richToDiagram(blk);
        const svg = DE.mdRich && DE.mdRich.mermaidSVG(blk.getAttribute('data-src'));
        if (svg) DE.download('so-do-mermaid.svg', new Blob([svg], { type: 'image/svg+xml' }));
        return;
      }
      const btn = e.target.closest('[data-dga]');
      if (btn) {
        const id = btn.closest('figure').dataset.dg;
        const act = btn.dataset.dga;
        if (act === 'edit') startSession({ kind: 'edit', id, doc: state.diagrams[id] });
        else if (act === 'source') {
          const ph = findPlaceholder(id);
          if (ph) jumpToLine(ta.value.slice(0, ph.start).split('\n').length - 1);
        } else if (act === 'svg') {
          const d = state.diagrams[id];
          const fn = (d.meta?.name || 'diagram').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'diagram';
          DE.download(fn + '.svg', new Blob([DE.exportSVG(d)], { type: 'image/svg+xml' }));
        } else if (act === 'remove') {
          DE.ui
            .confirm({ title: 'Xoá diagram khỏi tài liệu?', message: `"${state.diagrams[id]?.meta?.name || id}" sẽ bị xoá khỏi tài liệu.`, ok: 'Xoá', danger: true })
            .then((ok) => ok && removeDiagram(id));
        }
        return;
      }
      // đang soạn thảo: bấm link để sửa chữ; Ctrl + bấm để mở
      const a = e.target.closest('a[href]');
      if (a && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const href = a.getAttribute('href');
        if (href.startsWith('#')) {
          const t = pv.querySelector('#' + CSS.escape(decodeURIComponent(href.slice(1))));
          if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (/^(https?:|mailto:)/i.test(href)) window.open(href, '_blank', 'noopener');
      } else if (a) a.title = 'Ctrl + bấm để mở liên kết · Ctrl+K để sửa';
    });
    pv.addEventListener('dblclick', (e) => {
      const fig = e.target.closest('figure.md-diagram');
      if (fig && !fig.classList.contains('missing')) {
        e.preventDefault();
        return startSession({ kind: 'edit', id: fig.dataset.dg, doc: state.diagrams[fig.dataset.dg] });
      }
      // Mermaid / PlantUML: chuyển thành diagram để sửa; công thức, front matter, chú thích, khối HTML: hộp thoại sửa mã
      const rich = e.target.closest('.md-math, .md-raw');
      if (rich && pv.contains(rich)) {
        e.preventDefault();
        editRich(rich);
      }
    });

    // --------------------------------------------------------- phiên nhúng
    $('#embed-banner').addEventListener('click', (e) => {
      const b = e.target.closest('[data-embed]');
      if (!b) return;
      if (b.dataset.embed === 'commit') DOCS.commitDiagram();
      else cancelSession();
    });

    // --------------------------------------------------------------- file
    $('#md-file-input').addEventListener('change', (e) => {
      const f = e.target.files[0];
      const noConfirm = e.target.dataset.noconfirm === '1';
      delete e.target.dataset.noconfirm;
      e.target.value = '';
      if (f) DOCS.openFile(f, null, { confirm: !noConfirm });
    });
    initDrop();

    // ------------------------------------------------------------ phím tắt
    window.addEventListener('keydown', onGlobalKey);

    // ---------------------------------------- khôi phục phiên nhúng dở dang
    let resumed = false;
    try {
      const s = JSON.parse(lsGet(SESSION_KEY) || 'null');
      if (s && s.doc) {
        session = {
          kind: s.kind === 'edit' ? 'edit' : 'insert',
          id: s.id || null,
          pos: s.pos ?? null,
          original: s.original || '',
          stash: { doc: store.doc, undo: store.undoStack.slice(), redo: store.redoStack.slice() },
        };
        store.load(DE.normalizeDoc(s.doc).doc, { history: false });
        resumed = true;
      }
    } catch (_) {
      session = null;
      lsSet(SESSION_KEY, null);
    }
    updateSessionUI();
    renderPreview();
    const savedWs = lsGet(WS_KEY);
    show(resumed ? 'diagram' : ['doc', 'design', 'guide', 'settings'].includes(savedWs) ? savedWs : 'diagram');
    if (resumed) setTimeout(() => toast('Tiếp tục phiên vẽ diagram cho tài liệu – bấm ✓ để đưa vào tài liệu, hoặc Huỷ', 'info'), 400);
    store.onChange(() => ws === 'diagram' && updateTitles());
  };

  async function insertDiagramFile(file) {
    let raw;
    try {
      raw = JSON.parse(await file.text());
    } catch (e) {
      return toast(`"${file.name}" không phải JSON hợp lệ`, 'error');
    }
    const errors = DE.validateDocStrict(raw);
    if (errors.length) return toast(`"${file.name}" không đúng định dạng diagram:\n• ` + errors.slice(0, 5).join('\n• '), 'error');
    const doc = DE.normalizeDoc(raw).doc;
    if (!raw.meta || !raw.meta.name) doc.meta.name = file.name.replace(/\.json$/i, '');
    const id = newId();
    state.diagrams[id] = doc;
    insertBlock(placeholder(id, doc), caretPos());
    renderPreview();
    flashFigure(id);
    toast(`Đã nhúng diagram "${doc.meta.name}"`, 'ok');
  }

  // ===================================================== AI ↔ TÀI LIỆU
  /**
   * Lấy khối ````markdown … ```` (hoặc ```markdown / ~~~markdown) trong câu trả lời của AI.
   * Khối ngoài 3 backtick có thể chứa khối ```diagram bên trong -> lấy tới dòng ``` CUỐI CÙNG.
   */
  DOCS.extractMarkdown = function (text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const start = lines.findIndex((l) => /^\s{0,3}(`{3,}|~{3,})\s*(markdown|md)\s*$/i.test(l));
    if (start < 0) return null;
    const fence = lines[start].trim().match(/^(`+|~+)/)[1];
    let end = -1;
    if (fence.length > 3 || fence[0] === '~') {
      const re = new RegExp(`^\\s{0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`);
      for (let i = start + 1; i < lines.length; i++) if (re.test(lines[i])) {
        end = i;
        break;
      }
    } else {
      for (let i = lines.length - 1; i > start; i--) if (/^\s{0,3}`{3,}\s*$/.test(lines[i])) {
        end = i;
        break;
      }
    }
    if (end < 0) end = lines.length; // AI quên đóng khối
    return lines.slice(start + 1, end).join('\n').replace(/\s+$/, '') + '\n';
  };

  /** Khối ```diagram {JSON} trong Markdown -> dòng [[diagram:id|tên]] + thêm vào bảng diagram */
  function importDiagramFences(md, diagrams = state.diagrams) {
    let count = 0;
    const errors = [];
    const text = String(md).replace(/^ {0,3}(`{3,}|~{3,})[ \t]*diagram(?:-json)?[ \t]*\n([\s\S]*?)\n {0,3}\1[ \t]*$/gim, (m, f, json) => {
      let raw;
      try {
        raw = JSON.parse(json.trim().replace(/,\s*([}\]])/g, '$1'));
      } catch (e) {
        errors.push('Khối diagram không phải JSON hợp lệ: ' + e.message);
        return m;
      }
      let doc;
      try {
        doc = DE.normalizeDoc(raw).doc;
      } catch (e) {
        errors.push('Khối diagram sai cấu trúc: ' + e.message);
        return m;
      }
      if (!doc.nodes.length) {
        errors.push('Bỏ qua một khối diagram không có hình nào');
        return '';
      }
      let id = typeof raw.embedId === 'string' && /^[\w-]+$/.test(raw.embedId) ? raw.embedId : null;
      if (!id) {
        do id = 'dg-' + Math.random().toString(36).slice(2, 8);
        while (diagrams[id]);
      }
      diagrams[id] = doc;
      count++;
      return placeholder(id, doc);
    });
    return { text, count, errors };
  }
  DOCS.importDiagramFences = (md) => importDiagramFences(md, {});

  let aiBackup = null;
  /** Thay nội dung tài liệu bằng Markdown do AI viết (có thể hoàn tác). Trả về { count, errors } */
  DOCS.applyAIMarkdown = function (md) {
    flushVisual();
    aiBackup = { text: ta.value, diagrams: DE.clone(state.diagrams) };
    const r = importDiagramFences(md);
    ta.value = r.text.replace(/\n{3,}/g, '\n\n');
    state.dirty = true;
    state.caret = 0;
    linesDirty = anchorsDirty = true;
    visualStale = true;
    show('doc');
    renderPreview();
    pvWrap.scrollTop = 0;
    saveLocal();
    updateTitles();
    return r;
  };
  DOCS.canUndoAI = () => !!aiBackup;
  /** văn bản Markdown hiện tại (diagram dạng dòng [[diagram:…]]) */
  DOCS.text = () => {
    if (!ta) return '';
    flushVisual();
    return ta.value;
  };
  DOCS.undoAI = function () {
    if (!aiBackup) return false;
    const b = aiBackup;
    aiBackup = null;
    ta.value = b.text;
    state.diagrams = b.diagrams;
    state.dirty = true;
    linesDirty = anchorsDirty = true;
    show('doc');
    renderPreview();
    saveLocal();
    updateTitles();
    return true;
  };

  /** AI trả về một diagram (```json) khi đang ở tab Tài liệu -> nhúng vào vị trí con trỏ */
  DOCS.insertDiagramDoc = function (raw) {
    const doc = DE.normalizeDoc(raw).doc;
    const id = newId();
    state.diagrams[id] = doc;
    const pos = caretPos();
    show('doc');
    insertBlock(placeholder(id, doc), pos);
    renderPreview();
    flashFigure(id);
    return doc;
  };

  /** Ngữ cảnh gửi kèm mỗi tin nhắn cho AI, theo tab đang mở */
  DOCS.contextForAI = function () {
    flushVisual();
    if (ws === 'guide') return '[Tab hiện tại: Hướng dẫn sử dụng]';
    if (ws === 'settings') return '[Tab hiện tại: Cài đặt]';
    if (ws !== 'doc') return null; // tab Diagram / Thiết kế trang: ui.js tự gửi kèm dữ liệu của tab
    const text = ta.value;
    let s = `[Tab hiện tại: Tài liệu – file "${state.name}"]\n`;
    if (!text.trim()) return s + 'Tài liệu đang trống. Nếu người dùng yêu cầu viết tài liệu, trả về khối ````markdown đầy đủ.';
    s += 'Tài liệu đang mở (nếu yêu cầu là sửa / bổ sung thì trả lại TOÀN BỘ tài liệu đã sửa trong khối ````markdown, giữ nguyên các dòng [[diagram:…]] không cần sửa):\n````markdown\n' + text.replace(/\n+$/, '') + '\n````';
    const used = usedDiagrams();
    const ids = Object.keys(used);
    if (ids.length) {
      const json = JSON.stringify(used);
      s +=
        json.length < 40000
          ? '\n\nJSON của các diagram đang nhúng (chỉ dùng khi cần sửa diagram – khi đó thay dòng [[diagram:<id>|…]] bằng khối ```diagram có thêm "embedId"):\n```json\n' + json + '\n```'
          : `\n\n(Tài liệu có ${ids.length} diagram – JSON quá dài nên không gửi kèm; giữ nguyên các dòng [[diagram:…]].)`;
    }
    return s;
  };

  // ===================================================== KÉO THẢ FILE
  // Thả file ở bất kỳ đâu trong cửa sổ:
  //   .md / .markdown / .txt  -> mở ở tab Tài liệu
  //   .json (diagram)         -> tab Tài liệu: nhúng vào tài liệu · tab Diagram: mở diagram
  //   .json (dự án trang)     -> tab Thiết kế trang: mở dự án
  //   ảnh                     -> tab Tài liệu: chèn ảnh tại chỗ thả · tab Thiết kế trang: thêm thành phần Ảnh
  const isMdFile = (f) => /\.(md|markdown|mdx|txt)$/i.test(f.name);
  const isJsonFile = (f) => /\.json$/i.test(f.name);
  const isImgFile = (f) => /^image\//.test(f.type);

  function initDrop() {
    const ov = $('#drop-overlay');
    const msg = $('#drop-overlay-msg');
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const hide = () => {
      depth = 0;
      ov.hidden = true;
    };
    window.addEventListener('dragenter', (e) => {
      if (!hasFiles(e) || document.querySelector('.modal-backdrop')) return;
      depth++;
      msg.innerHTML =
        ws === 'doc'
          ? '<b>Thả file vào đây</b><span>.md – mở để chỉnh sửa · .json – nhúng diagram · ảnh – chèn vào tài liệu</span>'
          : ws === 'design'
            ? '<b>Thả file vào đây</b><span>.json – mở dự án thiết kế trang · ảnh – thêm vào trang tại chỗ thả · .md – mở ở tab Tài liệu</span>'
            : '<b>Thả file vào đây</b><span>.md – mở ở tab Tài liệu · .json – mở diagram</span>';
      ov.hidden = false;
    });
    window.addEventListener('dragleave', (e) => {
      if (!hasFiles(e)) return;
      if (--depth <= 0) hide();
    });
    window.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // không để trình duyệt mở file thay cho app
      e.dataTransfer.dropEffect = document.querySelector('.modal-backdrop') ? 'none' : 'copy';
    });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      hide();
      if (document.querySelector('.modal-backdrop')) return;
      const files = [...e.dataTransfer.files];
      const md = files.find(isMdFile);
      if (md) {
        if (files.length > 1) toast('Mỗi lần mở được một file .md – đã mở "' + md.name + '"', 'info');
        return DOCS.openFile(md);
      }
      // PlantUML: tab Tài liệu -> chèn khối ```plantuml · tab khác -> mở thành diagram trên whiteboard
      const puml = files.find((f) => /\.(puml|plantuml|pu|iuml|wsd)$/i.test(f.name));
      if (puml) {
        if (ws === 'doc')
          return puml.text().then((t) => {
            insertBlock('```plantuml\n' + t.trim() + '\n```', caretPos());
            renderPreview();
            toast(`Đã chèn sơ đồ PlantUML từ "${puml.name}"`, 'ok');
          });
        show('diagram');
        return DE.ui.openDiagramFile(puml);
      }
      const json = files.find(isJsonFile);
      if (json) {
        if (ws === 'design' && DE.pages) return DE.pages.openFile(json);
        if (ws === 'doc') return insertDiagramFile(json);
        return DE.ui.openDiagramFile(json);
      }
      const imgs = files.filter(isImgFile);
      if (imgs.length && ws === 'design' && DE.pages) return DE.pages.insertImageFiles(imgs, e);
      if (imgs.length && ws === 'doc') {
        if (view === 'code') setView('split');
        // đặt con trỏ tại điểm thả
        const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
        if (r && inVisual(r.startContainer)) {
          pv.focus({ preventScroll: true });
          const s = getSelection();
          s.removeAllRanges();
          s.addRange(r);
        }
        return imgs.forEach(insertImageFile);
      }
      toast(`Không mở được "${files[0] ? files[0].name : 'file'}": chỉ nhận file .md, .json` + (ws === 'doc' || ws === 'design' ? ' hoặc ảnh' : ''), 'warn');
    });
  }

  const DOC_ACTIONS = {
    dev: () => setDev(!dev, { announce: true }),
    'file-source': () => showFileSource(),
    new: newDoc,
    open: openDoc,
    save: () => saveDoc(false),
    'save-as': () => saveDoc(true),
    download: () => {
      download();
      toast(`Đã tải xuống "${state.name}"`, 'ok');
    },
    'export-html': exportHTML,
    math: () => insertMath(),
    footnote: () => insertFootnote(),
    toc: () => insertToc(),
    'new-diagram': () => startSession({ kind: 'insert', pos: caretPos() }),
    'insert-current': () => {
      if (session) return show('diagram');
      if (docIsEmpty(store.doc)) return toast('Diagram ở tab Diagram đang trống', 'warn');
      DOCS.commitDiagram();
    },
  };

  function onGlobalKey(e) {
    if (document.querySelector('.modal-backdrop')) return;
    if (e.altKey && !e.ctrlKey && !e.metaKey && ['1', '2', '3', '4', '5'].includes(e.key)) {
      e.preventDefault();
      return show(WS_ORDER[+e.key - 1]);
    }
    if (ws === 'diagram' || ws === 'design') return; // tab Hướng dẫn / Cài đặt: Ctrl+S / Ctrl+O vẫn thao tác trên tài liệu
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 's') {
      e.preventDefault();
      saveDoc(e.shiftKey);
    } else if (k === 'o') {
      e.preventDefault();
      openDoc();
    }
  }

  // ===================================================== CSS khung xem / HTML xuất
  // Dùng chung cho khung xem trong app và file HTML xuất ra (biến --md-* có giá trị mặc định sáng).
  const MD_CSS = `
.md-preview{color:var(--md-text,#1f2328);font:15px/1.65 -apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;word-wrap:break-word}
.md-preview>*:first-child{margin-top:0}
.md-preview h1,.md-preview h2,.md-preview h3,.md-preview h4,.md-preview h5,.md-preview h6{margin:1.4em 0 .6em;font-weight:650;line-height:1.25}
.md-preview h1{font-size:2em;padding-bottom:.3em;border-bottom:1px solid var(--md-border,#d1d9e0)}
.md-preview h2{font-size:1.5em;padding-bottom:.3em;border-bottom:1px solid var(--md-border,#d1d9e0)}
.md-preview h3{font-size:1.25em}.md-preview h4{font-size:1em}.md-preview h5{font-size:.875em}.md-preview h6{font-size:.85em;color:var(--md-muted,#59636e)}
.md-preview p,.md-preview ul,.md-preview ol,.md-preview blockquote,.md-preview pre,.md-preview .md-table,.md-preview .md-alert,.md-preview figure,.md-preview details{margin:0 0 1em}
.md-preview a{color:var(--md-link,#0969da);text-decoration:none}.md-preview a:hover{text-decoration:underline}
.md-preview ul,.md-preview ol{padding-left:2em}.md-preview li+li{margin-top:.25em}.md-preview li>ul,.md-preview li>ol{margin:.25em 0 0}
.md-preview li.md-task-item{list-style:none;margin-left:-1.4em}.md-preview .md-task{margin:0 .4em 0 0;vertical-align:-1px}
.md-preview code{font:.875em/1.5 Consolas,"Cascadia Code","JetBrains Mono",Menlo,monospace;background:var(--md-code-bg,rgba(129,139,152,.15));padding:.15em .4em;border-radius:5px}
.md-preview pre{background:var(--md-pre-bg,#f6f8fa);padding:14px 16px;border-radius:8px;overflow:auto;line-height:1.45}
.md-preview pre code{background:none;padding:0;font-size:.85em;white-space:pre}
.md-preview blockquote{padding:0 1em;color:var(--md-muted,#59636e);border-left:.25em solid var(--md-border,#d1d9e0)}
.md-preview hr{height:.25em;padding:0;margin:1.5em 0;background:var(--md-border,#d1d9e0);border:0}
.md-preview .md-table{overflow:auto}.md-preview table{border-collapse:collapse;width:max-content;max-width:100%}
.md-preview th,.md-preview td{padding:6px 13px;border:1px solid var(--md-border,#d1d9e0)}.md-preview th{font-weight:600;background:var(--md-pre-bg,#f6f8fa)}
.md-preview img{max-width:100%;height:auto}.md-preview mark{background:#fff8c5;color:inherit;padding:0 .1em}
.md-preview .md-alert{padding:.5em 1em;border-left:.25em solid #0969da;border-radius:0 6px 6px 0;background:var(--md-alert-bg,transparent)}
.md-preview .md-alert>:last-child{margin-bottom:0}.md-preview .md-alert-title{font-weight:600;margin:0 0 .3em}
.md-preview .md-alert-note{border-color:#0969da}.md-preview .md-alert-note .md-alert-title{color:#0969da}
.md-preview .md-alert-tip{border-color:#1a7f37}.md-preview .md-alert-tip .md-alert-title{color:#1a7f37}
.md-preview .md-alert-important{border-color:#8250df}.md-preview .md-alert-important .md-alert-title{color:#8250df}
.md-preview .md-alert-warning{border-color:#9a6700}.md-preview .md-alert-warning .md-alert-title{color:#9a6700}
.md-preview .md-alert-caution{border-color:#d1242f}.md-preview .md-alert-caution .md-alert-title{color:#d1242f}
.md-preview figure.md-diagram{position:relative;margin:0 0 1em;text-align:center}
.md-preview figure.md-diagram svg{max-width:100%;height:auto;border-radius:6px}
.md-preview .md-mermaid{position:relative;margin:0 0 1em;padding:14px;text-align:center;background:#fff;border:1px solid var(--md-border,#d1d9e0);border-radius:8px;overflow-x:auto}
.md-preview .md-mermaid-img{display:inline-block;max-width:100%;height:auto;vertical-align:top}
.md-preview .md-plantuml{position:relative;margin:0 0 1em;padding:10px;text-align:center;background:#fff;border:1px solid var(--md-border,#d1d9e0);border-radius:8px;overflow-x:auto}
.md-preview .md-puml-svg svg{max-width:100%;height:auto;vertical-align:top}
.md-preview .md-puml-warn{margin:6px 0 0;text-align:left;font-size:.8em;color:#7d4e00}
.md-preview .md-puml-warn summary{cursor:pointer}.md-preview .md-puml-warn ul{margin:.3em 0 0;padding-left:1.4em}
.md-preview .md-mermaid-src{margin:0;text-align:left;background:none;color:var(--md-muted,#59636e);font-size:.85em;white-space:pre-wrap}
.md-preview .md-mermaid-err{display:flex;flex-direction:column;gap:4px;margin:0 0 8px;padding:8px 12px;text-align:left;border-radius:6px;background:#fff8c5;color:#7d4e00;font-size:.85em}
.md-preview .md-mermaid-err span{white-space:pre-wrap;font-family:Consolas,Menlo,monospace;font-size:.95em}
.md-preview .md-math-block{margin:0 0 1em;padding:.2em 0;overflow-x:auto;overflow-y:hidden;text-align:center}
.md-preview .md-math-block .katex-display{margin:0}
.md-preview .md-math-block math[display=block]{margin:0}
.md-preview .md-math-error{color:#d1242f;font-family:Consolas,Menlo,monospace;font-size:.9em}
.md-preview .md-math-inline-display{display:inline-block;max-width:100%;overflow-x:auto;vertical-align:middle}
.md-preview .md-emoji{font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;font-style:normal}
.md-preview .md-fn-ref{font-size:.75em;line-height:0}
.md-preview .md-fn-ref a{text-decoration:none}.md-preview .md-fn-ref a::before{content:"["}.md-preview .md-fn-ref a::after{content:"]"}
.md-preview .md-footnotes{margin:2em 0 1em;padding-top:.8em;border-top:1px solid var(--md-border,#d1d9e0);font-size:.875em;color:var(--md-muted,#59636e)}
.md-preview .md-fn-title{margin:0 0 .5em;font-weight:600;color:var(--md-text,#1f2328)}
.md-preview .md-footnotes ol{margin:0;padding-left:1.8em}.md-preview .md-footnotes li+li{margin-top:.3em}
.md-preview .md-fn-back{margin-left:.3em;text-decoration:none}
.md-preview .md-toc{margin:0 0 1em;padding:12px 18px;background:var(--md-pre-bg,#f6f8fa);border:1px solid var(--md-border,#d1d9e0);border-radius:8px}
.md-preview .md-toc-title{margin:0 0 .4em;font-weight:600}
.md-preview .md-toc-list{margin:0;padding:0;list-style:none}.md-preview .md-toc-list li{margin:.2em 0}
.md-preview .md-toc-l2{padding-left:1.2em}.md-preview .md-toc-l3{padding-left:2.4em}.md-preview .md-toc-l4{padding-left:3.6em}.md-preview .md-toc-l5,.md-preview .md-toc-l6{padding-left:4.8em}
.md-preview .md-toc-empty{margin:0;color:var(--md-muted,#59636e);font-style:italic}
.md-preview .md-frontmatter{margin:0 0 1.2em;overflow:auto}
.md-preview .md-frontmatter table{width:auto;font-size:.85em}
.md-preview .md-frontmatter th{text-align:left;white-space:nowrap;color:var(--md-muted,#59636e)}
.md-preview pre[data-lang]{position:relative}
.md-preview pre[data-lang]::after{content:attr(data-lang);position:absolute;top:6px;right:10px;font:600 10.5px/1 -apple-system,"Segoe UI",sans-serif;color:var(--md-muted,#59636e);opacity:.75;pointer-events:none}
.md-preview .hljs-comment,.md-preview .hljs-quote{color:var(--hl-comment,#6e7781);font-style:italic}
.md-preview .hljs-keyword,.md-preview .hljs-selector-tag,.md-preview .hljs-doctag,.md-preview .hljs-section,.md-preview .hljs-meta .hljs-keyword{color:var(--hl-keyword,#cf222e)}
.md-preview .hljs-string,.md-preview .hljs-regexp,.md-preview .hljs-meta .hljs-string{color:var(--hl-string,#0a3069)}
.md-preview .hljs-number,.md-preview .hljs-literal,.md-preview .hljs-symbol,.md-preview .hljs-bullet,.md-preview .hljs-attr,.md-preview .hljs-attribute,.md-preview .hljs-property,.md-preview .hljs-selector-attr,.md-preview .hljs-selector-class,.md-preview .hljs-selector-id{color:var(--hl-number,#0550ae)}
.md-preview .hljs-title,.md-preview .hljs-title.function_,.md-preview .hljs-title.class_,.md-preview .hljs-meta{color:var(--hl-title,#8250df)}
.md-preview .hljs-built_in,.md-preview .hljs-type,.md-preview .hljs-variable,.md-preview .hljs-template-variable,.md-preview .hljs-params{color:var(--hl-builtin,#953800)}
.md-preview .hljs-name,.md-preview .hljs-tag,.md-preview .hljs-selector-pseudo{color:var(--hl-tag,#116329)}
.md-preview .hljs-addition{color:var(--hl-tag,#116329);background:var(--hl-add-bg,#dafbe1)}
.md-preview .hljs-deletion{color:var(--hl-keyword,#82071e);background:var(--hl-del-bg,#ffebe9)}
.md-preview .hljs-emphasis{font-style:italic}.md-preview .hljs-strong{font-weight:700}.md-preview .hljs-link{text-decoration:underline}
`;
})(window.DE);
