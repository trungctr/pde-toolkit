/* =========================================================================
 * Nội dung "giàu" trong tài liệu Markdown – giống các trình xem khác (GitHub,
 * VS Code, Obsidian, Typora):
 *   - Sơ đồ ```mermaid      -> mermaid.js
 *   - Công thức $…$, $$…$$  -> KaTeX
 *   - Tô màu cú pháp code   -> highlight.js
 *   - Emoji :rocket:        -> bảng shortcode của GitHub (emojibase)
 * Thư viện chỉ được tải từ CDN khi tài liệu thật sự cần, có kiểm tra toàn vẹn (SRI):
 * file bị sửa trên CDN sẽ bị trình duyệt từ chối, không chạy được trong trang (nơi giữ API key).
 * Sơ đồ Mermaid được chèn dưới dạng <img src="data:image/svg+xml…"> – SVG trong thẻ img không
 * chạy script, không tải tài nguyên ngoài, và file HTML xuất ra tự chứa hình.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const esc = DE.esc;
  const R = (DE.mdRich = {});
  const CDN = 'https://cdn.jsdelivr.net/npm/';
  const LIB = {
    mermaid: { name: 'Mermaid', global: 'mermaid', url: CDN + 'mermaid@11.4.1/dist/mermaid.min.js', sri: 'sha384-rbtjAdnIQE/aQJGEgXrVUlMibdfTSa4PQju4HDhN3sR2PmaKFzhEafuePsl9H/9I' },
    katex: { name: 'KaTeX', global: 'katex', url: CDN + 'katex@0.16.11/dist/katex.min.js', sri: 'sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg' },
    katexCss: { url: CDN + 'katex@0.16.11/dist/katex.min.css', sri: 'sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+' },
    hljs: { name: 'highlight.js', global: 'hljs', url: CDN + '@highlightjs/cdn-assets@11.10.0/highlight.min.js', sri: 'sha384-GdEWAbCjn+ghjX0gLx7/N1hyTVmPAjdC2OvoAA0RyNcAOhqwtT8qnbCxWle2+uJX' },
    emoji: { name: 'bảng emoji', url: CDN + 'emojibase-data@15.3.2/en/shortcodes/github.json', sri: 'sha384-jXwc84PiykE3926+raHxCsZXbbMl1jwjCXAJi9+Uv/mUz9Hti/559Z3pSDPAINWL' },
  };
  R.LIB = LIB;

  // ================================================================ TẢI THƯ VIỆN
  const pending = {};
  function loadScript(lib) {
    if (window[lib.global]) return Promise.resolve(window[lib.global]);
    if (pending[lib.url]) return pending[lib.url];
    return (pending[lib.url] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = lib.url;
      s.integrity = lib.sri;
      s.crossOrigin = 'anonymous';
      s.async = true;
      s.onload = () => (window[lib.global] ? resolve(window[lib.global]) : reject(new Error(`${lib.name} tải xong nhưng không dùng được`)));
      s.onerror = () => {
        delete pending[lib.url];
        s.remove();
        reject(new Error(`Không tải được ${lib.name} – cần kết nối mạng ở lần dùng đầu tiên`));
      };
      document.head.appendChild(s);
    }));
  }
  function loadCss(lib) {
    if (document.querySelector(`link[data-lib="${lib.url}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = lib.url;
    l.integrity = lib.sri;
    l.crossOrigin = 'anonymous';
    l.dataset.lib = lib.url;
    document.head.appendChild(l);
  }

  // ================================================================ TÔ MÀU CODE
  async function highlight(root, opts) {
    const codes = [...root.querySelectorAll('pre > code[class*="language-"]')].filter((c) => !c.dataset.hl);
    if (!codes.length) return;
    let hljs;
    try {
      hljs = await loadScript(LIB.hljs);
    } catch (_) {
      return; // không có mạng: code vẫn hiện bình thường, chỉ không có màu
    }
    const sel = opts.editor ? getSelection() : null;
    for (const code of codes) {
      if (opts.isCurrent && !opts.isCurrent()) return;
      const lang = (code.className.match(/language-([\w+#.-]+)/) || [])[1];
      if (!lang || !hljs.getLanguage(lang)) continue;
      if (sel && sel.rangeCount && code.contains(sel.anchorNode)) continue; // đang gõ trong khối này
      const r = hljs.highlight(code.textContent, { language: lang, ignoreIllegals: true });
      code.innerHTML = r.value; // highlight.js đã thoát HTML của mã nguồn
      code.dataset.hl = '1';
      code.classList.add('hljs');
    }
  }

  // ================================================================ CÔNG THỨC
  const KATEX_OPT = { throwOnError: false, trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 40 };
  async function loadKatex() {
    loadCss(LIB.katexCss);
    return loadScript(LIB.katex);
  }
  function renderTex(katex, tex, el, display, mathml) {
    try {
      katex.render(tex, el, Object.assign({}, KATEX_OPT, { displayMode: display, output: mathml ? 'mathml' : 'htmlAndMathml' }));
      el.classList.remove('md-math-error');
      return true;
    } catch (e) {
      el.textContent = tex;
      el.classList.add('md-math-error');
      el.title = e.message;
      return false;
    }
  }
  async function math(root, opts) {
    const els = [...root.querySelectorAll('.md-math')];
    if (!els.length) return;
    let katex;
    try {
      katex = await loadKatex();
    } catch (e) {
      els.forEach((el) => (el.title = e.message));
      return;
    }
    for (const el of els) {
      if (opts.isCurrent && !opts.isCurrent()) return;
      renderTex(katex, el.getAttribute('data-tex') || '', el, !!el.getAttribute('data-display'), opts.mathml);
    }
  }

  // ================================================================ EMOJI
  let emojiMap = null, emojiP = null;
  function loadEmoji() {
    if (emojiMap) return Promise.resolve(emojiMap);
    if (!emojiP)
      emojiP = fetch(LIB.emoji.url, { integrity: LIB.emoji.sri, mode: 'cors', credentials: 'omit' })
        .then((r) => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then((data) => {
          const m = new Map();
          for (const [hex, names] of Object.entries(data)) {
            const cps = hex.split('-').map((h) => parseInt(h, 16));
            // emojibase bỏ ký tự chọn kiểu FE0F: thêm lại để hiện dạng emoji màu
            if (cps.includes(0x20e3)) cps.splice(cps.indexOf(0x20e3), 0, 0xfe0f);
            else if (cps.length === 1 && cps[0] >= 0x2000 && cps[0] <= 0x33ff) cps.push(0xfe0f);
            const ch = String.fromCodePoint(...cps);
            for (const n of [].concat(names)) if (!m.has(n)) m.set(n, ch);
          }
          return (emojiMap = m);
        })
        .catch((e) => {
          emojiP = null;
          throw e;
        });
    return emojiP;
  }
  async function emoji(root) {
    const els = [...root.querySelectorAll('.md-emoji')];
    if (!els.length) return;
    let map;
    try {
      map = await loadEmoji();
    } catch (_) {
      return; // giữ nguyên :shortcode:
    }
    for (const el of els) {
      const sc = el.getAttribute('data-sc');
      const ch = map.get(sc);
      if (!ch) continue;
      el.textContent = ch;
      el.title = `:${sc}:`;
      el.classList.add('is-emoji');
    }
  }
  R.emojiOf = (sc) => (emojiMap ? emojiMap.get(sc) || null : null);

  // ================================================================ MERMAID
  let mmReady = null, mmQueue = Promise.resolve(), mmSeq = 0;
  const mmCache = new Map(); // mã nguồn -> { url, w, h, svg } | { error }
  function loadMermaid() {
    if (!mmReady)
      mmReady = loadScript(LIB.mermaid)
        .then((m) => {
          const mm = m && m.initialize ? m : m.default;
          mm.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'default',
            fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            htmlLabels: false,
            flowchart: { htmlLabels: false },
            suppressErrorRendering: true,
          });
          return mm;
        })
        .catch((e) => {
          mmReady = null;
          throw e;
        });
    return mmReady;
  }
  function b64(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  /** Vẽ một sơ đồ Mermaid -> { url (data:image/svg+xml), w, h, svg } hoặc { error } */
  async function renderMermaid(src) {
    src = String(src || '').trim();
    if (!src) return { error: 'Sơ đồ trống' };
    if (mmCache.has(src)) return mmCache.get(src);
    const mm = await loadMermaid(); // lỗi mạng: ném ra để bên gọi báo "chưa tải được"
    const job = mmQueue.then(async () => {
      const id = 'de-mmd-' + ++mmSeq;
      try {
        const { svg } = await mm.render(id, src);
        const vb = svg.match(/viewBox="\s*[-\d.e]+[\s,]+[-\d.e]+[\s,]+([\d.e]+)[\s,]+([\d.e]+)\s*"/);
        const w = vb ? Math.max(1, Math.ceil(+vb[1])) : 600, h = vb ? Math.max(1, Math.ceil(+vb[2])) : 400;
        return { url: 'data:image/svg+xml;base64,' + b64(svg), w, h, svg };
      } catch (e) {
        return { error: String((e && (e.message || e.str)) || e).replace(/\s+$/, '') };
      } finally {
        for (const x of [id, 'd' + id, 'i' + id]) {
          const n = document.getElementById(x);
          if (n) n.remove();
        }
      }
    });
    mmQueue = job.catch(() => {});
    const r = await job;
    mmCache.set(src, r);
    if (mmCache.size > 60) mmCache.delete(mmCache.keys().next().value);
    return r;
  }
  R.renderMermaid = renderMermaid;

  function paintMermaid(el, r, src, opts) {
    const acts = opts.editor
      ? `<div class="dg-actions"><span class="dg-name">◇ Mermaid</span><button type="button" data-mma="edit" title="Sửa mã sơ đồ (hoặc nhấn đúp)">✎ Sửa</button>` +
        (r.url ? '<button type="button" data-mma="svg" title="Tải ảnh SVG của sơ đồ">SVG</button>' : '') +
        '</div>'
      : '';
    el.classList.toggle('has-error', !r.url);
    if (r.url) el.innerHTML = acts + `<img class="md-mermaid-img" src="${r.url}" width="${r.w}" height="${r.h}" alt="Sơ đồ Mermaid">`;
    else
      el.innerHTML =
        acts +
        `<div class="md-mermaid-err"><b>${r.offline ? 'Chưa vẽ được sơ đồ Mermaid' : 'Mã Mermaid có lỗi'}</b><span>${esc(r.error)}</span></div>` +
        `<pre class="md-mermaid-src">${esc(src)}</pre>`;
  }
  async function mermaidAll(root, opts) {
    const els = [...root.querySelectorAll('.md-mermaid')];
    for (const el of els) {
      if (opts.isCurrent && !opts.isCurrent()) return;
      const src = el.getAttribute('data-src') || '';
      let r;
      try {
        r = await renderMermaid(src);
      } catch (e) {
        r = { error: e.message, offline: true };
      }
      if (opts.isCurrent && !opts.isCurrent()) return;
      paintMermaid(el, r, src, opts);
    }
  }
  // ================================================================ PLANTUML
  // Không cần máy chủ: js/plantuml.js dịch sang diagram JSON của app rồi vẽ bằng chính bộ vẽ của app
  // (mọi chữ đều được thoát) – nên SVG chèn thẳng vào trang như diagram nhúng.
  const pumlCache = new Map();
  function plantumlDoc(src) {
    src = String(src || '');
    if (pumlCache.has(src)) return pumlCache.get(src);
    const r = DE.plantuml ? DE.plantuml.convert(src) : { ok: false, error: 'Thiếu bộ dịch PlantUML' };
    if (r.ok) r.svg = DE.inlineSVG(r.doc);
    pumlCache.set(src, r);
    if (pumlCache.size > 60) pumlCache.delete(pumlCache.keys().next().value);
    return r;
  }
  R.plantumlDoc = plantumlDoc;
  const pumlWarnHTML = (r) =>
    r.warnings && r.warnings.length
      ? `<details class="md-puml-warn"><summary>⚠ ${r.warnings.length} chi tiết PlantUML chưa hỗ trợ – đã bỏ qua</summary><ul>${r.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></details>`
      : '';
  async function plantumlAll(root, opts) {
    for (const el of root.querySelectorAll('.md-plantuml')) {
      if (opts.isCurrent && !opts.isCurrent()) return;
      const src = el.getAttribute('data-src') || '';
      const r = plantumlDoc(src);
      const kindName = (DE.plantuml && DE.plantuml.KIND_NAME[r.kind]) || 'PlantUML';
      const acts = opts.editor
        ? `<div class="dg-actions"><span class="dg-name">◆ PlantUML · ${esc(kindName)}</span>` +
          (r.ok ? '<button type="button" data-pua="whiteboard" title="Chuyển thành diagram kéo thả, sửa trên whiteboard">◆ Sửa trên whiteboard</button>' : '') +
          '<button type="button" data-pua="edit" title="Sửa mã PlantUML (hoặc nhấn đúp)">✎ Mã</button>' +
          (r.ok ? '<button type="button" data-pua="svg" title="Tải ảnh SVG">SVG</button>' : '') +
          '</div>'
        : '';
      el.classList.toggle('has-error', !r.ok);
      if (r.ok) el.innerHTML = acts + `<div class="md-puml-svg">${r.svg}</div>` + (opts.editor ? pumlWarnHTML(r) : '');
      else el.innerHTML = acts + `<div class="md-mermaid-err"><b>Chưa vẽ được sơ đồ PlantUML</b><span>${esc(r.error)}</span></div><pre class="md-mermaid-src">${esc(src)}</pre>`;
    }
  }

  /** SVG đã vẽ của một mã Mermaid (để tải xuống) */
  R.mermaidSVG = (src) => {
    const r = mmCache.get(String(src || '').trim());
    return r && r.svg ? r.svg : null;
  };

  /**
   * Vẽ mọi nội dung giàu trong root. opts.editor: khung soạn (thêm nút Sửa, không đụng khối đang gõ);
   * opts.mathml: công thức dạng MathML thuần (file HTML xuất ra không cần CSS / font của KaTeX);
   * opts.isCurrent(): false khi khung đã được vẽ lại – dừng giữa chừng.
   */
  R.enhance = async function (root, opts = {}) {
    await Promise.resolve();
    if (!root) return;
    await Promise.all([highlight(root, opts), math(root, opts), emoji(root, opts), plantumlAll(root, opts), mermaidAll(root, opts)].map((p) => p.catch(() => {})));
  };

  // ================================================================ HỘP THOẠI SỬA
  const MERMAID_TPL = [
    ['flowchart', 'Lưu đồ', 'flowchart TD\n  A[Bắt đầu] --> B{Hợp lệ?}\n  B -- Có --> C[Xử lý]\n  B -- Không --> D[Báo lỗi]\n  C --> E[Kết thúc]\n  D --> E'],
    ['sequence', 'Tuần tự', 'sequenceDiagram\n  actor U as Người dùng\n  participant W as Web\n  participant S as Máy chủ\n  U->>W: Đăng nhập\n  W->>S: POST /login\n  S-->>W: Token\n  W-->>U: Vào trang chủ'],
    ['gantt', 'Gantt (tiến độ)', 'gantt\n  title Kế hoạch dự án\n  dateFormat YYYY-MM-DD\n  section Phân tích\n    Thu thập yêu cầu :a1, 2026-01-05, 7d\n    Viết đặc tả      :after a1, 5d\n  section Phát triển\n    Lập trình        :b1, 2026-01-19, 14d\n    Kiểm thử         :after b1, 7d'],
    ['pie', 'Biểu đồ tròn', 'pie title Nguồn truy cập\n  "Tìm kiếm" : 45\n  "Mạng xã hội" : 30\n  "Trực tiếp" : 25'],
    ['mindmap', 'Sơ đồ tư duy', 'mindmap\n  root((Dự án))\n    Mục tiêu\n      Doanh thu\n      Người dùng\n    Nhóm\n      Thiết kế\n      Lập trình\n    Rủi ro'],
    ['class', 'Lớp (class)', 'classDiagram\n  class User {\n    +String name\n    +login()\n  }\n  class Order {\n    +Date date\n    +total() float\n  }\n  User "1" --> "*" Order'],
    ['state', 'Trạng thái', 'stateDiagram-v2\n  [*] --> Nhap\n  Nhap --> ChoDuyet : Gửi\n  ChoDuyet --> DaDuyet : Duyệt\n  ChoDuyet --> Nhap : Trả lại\n  DaDuyet --> [*]'],
    ['er', 'Thực thể – quan hệ', 'erDiagram\n  CUSTOMER ||--o{ ORDER : "đặt"\n  ORDER ||--|{ ORDER_ITEM : "gồm"\n  PRODUCT ||--o{ ORDER_ITEM : "thuộc"'],
    ['journey', 'Hành trình người dùng', 'journey\n  title Mua hàng online\n  section Tìm kiếm\n    Tìm sản phẩm: 4: Khách\n    So sánh giá: 3: Khách\n  section Thanh toán\n    Nhập địa chỉ: 2: Khách\n    Thanh toán: 4: Khách'],
    ['timeline', 'Dòng thời gian', 'timeline\n  title Lịch sử sản phẩm\n  2024 : Ý tưởng\n  2025 : Bản thử nghiệm : 1.000 người dùng\n  2026 : Phát hành chính thức'],
    ['git', 'Nhánh Git', 'gitGraph\n  commit\n  branch feature\n  checkout feature\n  commit\n  commit\n  checkout main\n  merge feature\n  commit'],
    ['quadrant', 'Ma trận 4 ô', 'quadrantChart\n  title Ưu tiên công việc\n  x-axis Ít công sức --> Nhiều công sức\n  y-axis Ít giá trị --> Nhiều giá trị\n  quadrant-1 Lên kế hoạch\n  quadrant-2 Làm ngay\n  quadrant-3 Bỏ qua\n  quadrant-4 Giao việc\n  Tính năng A: [0.3, 0.8]\n  Tính năng B: [0.7, 0.6]'],
  ];
  R.MERMAID_TPL = MERMAID_TPL;

  /**
   * Hộp thoại sửa mã có xem trước.
   * o.kind: 'mermaid' | 'math' | 'raw'; o.value; o.title; o.hint; o.ok;
   * o.templates (mermaid: chọn mẫu); o.modes (math: chọn trong dòng / khối riêng); o.display (math: mặc định khối riêng).
   * Trả Promise<{ value, display } | null>
   */
  R.editDialog = function (o) {
    return new Promise((resolve) => {
      const kind = o.kind || 'raw';
      const back = document.createElement('div');
      back.className = 'modal-backdrop';
      const tpl =
        kind === 'mermaid' && o.templates
          ? `<label class="f rich-tpl"><span>Bắt đầu từ mẫu</span><select data-rt="tpl"><option value="">— Chọn loại sơ đồ —</option>${MERMAID_TPL.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></label>`
          : '';
      const modes =
        kind === 'math' && o.modes
          ? `<div class="rich-modes" role="radiogroup"><label class="chk"><input type="radio" name="rt-mode" value="block"${o.display !== false ? ' checked' : ''}> Khối riêng (căn giữa)</label>` +
            `<label class="chk"><input type="radio" name="rt-mode" value="inline"${o.display === false ? ' checked' : ''}> Trong dòng chữ</label></div>`
          : '';
      const hint =
        o.hint ||
        (kind === 'plantuml'
          ? 'Cú pháp PlantUML: sequence, use case, class, activity, state, component / deployment, ER – vẽ ngay trong trình duyệt, không gửi lên máy chủ. Ctrl+Enter để áp dụng.'
          : kind === 'mermaid'
          ? 'Cú pháp Mermaid: lưu đồ, tuần tự, Gantt, biểu đồ tròn, sơ đồ tư duy… – xem mermaid.js.org. Ctrl+Enter để áp dụng.'
          : kind === 'math'
            ? 'Cú pháp LaTeX, ví dụ: \\frac{a}{b}, x^2, \\sqrt{x}, \\sum_{i=1}^{n} i, \\int_0^1 f(x)\\,dx. Ctrl+Enter để áp dụng.'
            : 'Ctrl+Enter để áp dụng.');
      back.innerHTML =
        `<div class="modal rich-modal${kind === 'raw' ? ' rich-raw' : ''}" role="dialog" aria-modal="true" aria-labelledby="rt-title">` +
        `<h3 id="rt-title">${esc(o.title || 'Sửa')}</h3>${tpl}${modes}` +
        `<div class="rich-edit"><textarea class="code" spellcheck="false" aria-label="Mã nguồn">${esc(o.value || '')}</textarea>` +
        (kind === 'raw' ? '' : '<div class="rich-preview" aria-live="polite"></div>') +
        `</div><p class="hint">${esc(hint)}</p>` +
        `<div class="modal-actions"><button type="button" class="btn" data-r="cancel">Huỷ</button><button type="button" class="btn primary" data-r="ok">${esc(o.ok || 'Áp dụng')}</button></div></div>`;
      const ta = back.querySelector('textarea');
      const pv = back.querySelector('.rich-preview');
      let seq = 0, t = 0;
      const display = () => {
        const r = back.querySelector('input[name="rt-mode"]:checked');
        return r ? r.value === 'block' : o.display !== false;
      };
      const preview = async () => {
        if (!pv) return;
        const my = ++seq;
        const v = ta.value.trim();
        if (!v) {
          pv.innerHTML = '<span class="rich-empty">Xem trước sẽ hiện ở đây</span>';
          return;
        }
        if (kind === 'plantuml') {
          const r = plantumlDoc(v);
          pv.innerHTML = r.ok
            ? `<div class="rich-puml">${r.svg}${r.warnings.length ? `<p class="rich-warn">⚠ Bỏ qua ${r.warnings.length} chi tiết chưa hỗ trợ: ${esc(r.warnings.slice(0, 4).join(' · '))}${r.warnings.length > 4 ? '…' : ''}</p>` : ''}</div>`
            : `<div class="md-mermaid-err"><b>Chưa vẽ được</b><span>${esc(r.error)}</span></div>`;
        } else if (kind === 'mermaid') {
          pv.innerHTML = '<span class="rich-empty">Đang vẽ…</span>';
          let r;
          try {
            r = await renderMermaid(v);
          } catch (e) {
            r = { error: e.message };
          }
          if (my !== seq) return;
          pv.innerHTML = r.url ? `<img src="${r.url}" alt="Xem trước sơ đồ" width="${r.w}" height="${r.h}">` : `<div class="md-mermaid-err"><b>Chưa vẽ được</b><span>${esc(r.error)}</span></div>`;
        } else {
          try {
            const katex = await loadKatex();
            if (my !== seq) return;
            const box = document.createElement('div');
            box.className = 'rich-math';
            renderTex(katex, v, box, display());
            pv.replaceChildren(box);
          } catch (e) {
            pv.innerHTML = `<div class="md-mermaid-err"><b>Chưa xem trước được</b><span>${esc(e.message)}</span></div>`;
          }
        }
      };
      const schedule = () => {
        clearTimeout(t);
        t = setTimeout(preview, 250);
      };
      const close = (val) => {
        clearTimeout(t);
        window.removeEventListener('keydown', onKey, true);
        back.remove();
        resolve(val);
      };
      const ok = () => close({ value: ta.value, display: display() });
      const onKey = (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          close(null);
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          ok();
        }
      };
      ta.addEventListener('input', schedule);
      back.addEventListener('change', (e) => {
        if (e.target.dataset.rt === 'tpl') {
          const tp = MERMAID_TPL.find((x) => x[0] === e.target.value);
          if (tp) {
            ta.value = tp[2];
            preview();
          }
        } else if (e.target.name === 'rt-mode') preview();
      });
      back.addEventListener('click', (e) => {
        const b = e.target.closest('[data-r]');
        if (b) return b.dataset.r === 'ok' ? ok() : close(null);
        if (e.target === back) close(null);
      });
      window.addEventListener('keydown', onKey, true);
      document.body.appendChild(back);
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      preview();
    });
  };
})(window.DE);
