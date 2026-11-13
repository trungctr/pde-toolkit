/* =========================================================================
 * Markdown → HTML (CommonMark + GFM rút gọn, không thư viện ngoài) + làm sạch HTML.
 *
 * Hỗ trợ: tiêu đề ATX / setext (có id để làm mục lục), đoạn văn, xuống dòng cứng,
 * **đậm**, *nghiêng*, ~~gạch~~, ==tô sáng==, `code`, khối code ``` / ~~~, trích dẫn (GitHub
 * alert > [!NOTE] và callout kiểu Obsidian > [!tip] Tiêu đề), danh sách lồng nhau, task list,
 * bảng GFM, đường kẻ, link, ảnh, link tham chiếu, autolink, HTML nhúng (đã làm sạch),
 * công thức $…$ / $$…$$ / ```math / $`…`$, sơ đồ ```mermaid, chú thích [^1],
 * emoji :rocket:, mục lục [TOC], front matter YAML (--- … --- ở đầu file).
 * Mermaid / công thức / tô màu code / emoji được vẽ sau bởi js/md-rich.js (tải thư viện từ CDN).
 *
 * Diagram nhúng: một dòng riêng dạng  [[diagram:<id>|Tên]]  được render thành
 * <figure class="md-diagram" data-dg="<id>"> rỗng – docs.js tự vẽ SVG vào đó.
 *
 * Mỗi khối có data-line="<số dòng nguồn, từ 0>" để đồng bộ vị trí với trình soạn thảo.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const esc = DE.esc;
  const MD = (DE.md = {});

  MD.DIAGRAM_LINE = /^\[\[diagram:([\w-]+)(?:\|([^\]\n]*))?\]\][ \t]*$/;

  // ----------------------------------------------------------------- tiện ích
  const BLANK = /^[ \t]*$/;
  const indentOf = (l) => {
    let n = 0;
    for (const c of l) {
      if (c === ' ') n++;
      else if (c === '\t') n += 4 - (n % 4);
      else break;
    }
    return n;
  };
  /** bỏ `n` cột thụt đầu dòng (tab tính 4 cột) */
  const dedent = (l, n) => {
    let col = 0, i = 0;
    while (i < l.length && col < n && (l[i] === ' ' || l[i] === '\t')) {
      col += l[i] === '\t' ? 4 - (col % 4) : 1;
      i++;
    }
    return (col > n ? ' '.repeat(col - n) : '') + l.slice(i);
  };

  /** URL an toàn: chặn javascript:, vbscript:, data: (trừ ảnh bitmap) */
  const safeUrl = (u) => {
    const s = String(u || '').trim();
    const scheme = s.replace(/[\u0000- ]/g, '').toLowerCase();
    if (/^(javascript|vbscript|file):/.test(scheme)) return '#';
    if (/^data:/.test(scheme) && !/^data:image\/(png|jpe?g|gif|webp|avif);/.test(scheme)) return '#';
    return s;
  };
  MD.safeUrl = safeUrl;

  /** slug kiểu GitHub: giữ chữ có dấu, bỏ dấu câu, khoảng trắng → '-' */
  const slug = (text, used) => {
    const base =
      text
        .toLowerCase()
        .replace(/<[^>]*>/g, '')
        .replace(/&[a-z#0-9]+;/g, '')
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .trim()
        .replace(/\s/g, '-') || 'muc';
    let id = base, i = 1;
    while (used.has(id)) id = `${base}-${i++}`;
    used.add(id);
    return id;
  };

  // ------------------------------------------------------------------- inline
  const INLINE_AS_TEXT = /^(script|style|textarea|title|xmp|plaintext|noscript|noembed|noframes|iframe|template|object|embed|applet|svg|math|select|option|button|form|input|base|meta|link|frame|frameset)$/i;

  /** Công thức trong dòng: chữ TeX gốc hiện tạm cho tới khi md-rich.js vẽ bằng KaTeX */
  const mathSpan = (tex, display) =>
    `<span class="md-math${display ? ' md-math-inline-display' : ''}" contenteditable="false" data-tex="${esc(tex)}"${display ? ' data-display="1"' : ''}>${esc((display ? '$$' : '$') + tex + (display ? '$$' : '$'))}</span>`;

  /**
   * Quét trái → phải, tách code span và công thức ra trước mọi bước khác (TeX có rất nhiều
   * \{ \_ \\ … – bước "ký tự thoát" chạy trước sẽ làm hỏng công thức). Quy tắc giống GitHub:
   * $…$ không mở bằng / đóng bằng khoảng trắng, dấu đóng không dính chữ số; \$ là dấu $ thường.
   */
  function protectCodeMath(s, keep) {
    let out = '', i = 0;
    const n = s.length;
    while (i < n) {
      const c = s[i];
      if (c === '\\' && i + 1 < n) {
        out += s.slice(i, i + 2); // để bước "ký tự thoát" xử lý
        i += 2;
        continue;
      }
      // $`…`$ (cú pháp GitHub)
      if (c === '$' && s[i + 1] === '`') {
        const j = s.indexOf('`$', i + 2);
        if (j > i + 2 && !s.slice(i + 2, j).includes('`')) {
          out += keep(mathSpan(s.slice(i + 2, j), false));
          i = j + 2;
          continue;
        }
      }
      // code span: chuỗi backtick mở phải gặp chuỗi đóng đúng độ dài
      if (c === '`') {
        let k = i;
        while (s[k] === '`') k++;
        const run = s.slice(i, k);
        let j = k, found = -1;
        while ((j = s.indexOf(run, j)) !== -1) {
          if (s[j + run.length] !== '`') {
            found = j;
            break;
          }
          while (s[j] === '`') j++;
        }
        if (found >= 0) {
          let code = s.slice(k, found).replace(/\n/g, ' ');
          if (/^ .*[^ ].* $/.test(code)) code = code.slice(1, -1);
          out += keep('<code>' + esc(code) + '</code>');
          i = found + run.length;
          continue;
        }
        out += run;
        i = k;
        continue;
      }
      if (c === '$') {
        const disp = s[i + 1] === '$';
        const o = disp ? 2 : 1;
        const prev = i > 0 ? s[i - 1] : '';
        if ((!disp && /[\p{L}\p{N}_$]/u.test(prev)) || /\s/.test(s[i + o] || ' ') || s[i + o] === '$') {
          out += s.slice(i, i + o);
          i += o;
          continue;
        }
        let j = i + o, found = -1;
        while (j < n) {
          const ch = s[j];
          if (ch === '\\') {
            j += 2;
            continue;
          }
          if (ch === '$') {
            if (disp) {
              if (s[j + 1] === '$' && !/\s/.test(s[j - 1])) found = j;
            } else if (!/\s/.test(s[j - 1]) && !/[\p{N}]/u.test(s[j + 1] || '')) found = j;
            break; // trong công thức trong dòng không có dấu $ chưa thoát
          }
          j++;
        }
        if (found > i + o) {
          out += keep(mathSpan(s.slice(i + o, found), disp));
          i = found + o;
          continue;
        }
        out += s.slice(i, i + o);
        i += o;
        continue;
      }
      out += c;
      i++;
    }
    return out;
  }

  function inline(src, ctx) {
    const slots = [];
    const keep = (html) => '\u0000' + (slots.push(html) - 1) + '\u0000';
    let s = String(src).replace(/\u0000/g, '');

    // code span + công thức
    s = protectCodeMath(s, keep);
    // xuống dòng cứng bằng "\" cuối dòng
    s = s.replace(/\\\n/g, () => keep('<br>') + '\n');
    // ký tự thoát
    s = s.replace(/\\([\\`*_{}[\]()#+\-.!|~<>"'=$:^])/g, (_, c) => keep(esc(c)));
    // autolink <https://…> / <a@b.c>
    s = s.replace(/<((?:https?|ftp|mailto):[^\s<>]+)>/gi, (_, u) => keep(`<a href="${esc(safeUrl(u))}">${esc(u)}</a>`));
    s = s.replace(/<([^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+)>/g, (_, u) => keep(`<a href="mailto:${esc(u)}">${esc(u)}</a>`));
    // HTML nhúng (sẽ được làm sạch sau). Thẻ nguy hiểm / "nuốt văn bản" giữa đoạn văn (vd. viết về
    // <textarea>, <script>, <svg>) được hiển thị nguyên dạng chữ – đó gần như luôn là ý người viết.
    let rawUsed = false;
    s = s.replace(/<!--[\s\S]*?-->|<\/?([A-Za-z][\w:-]*)(?:\s+[^<>]*?)?\/?>/g, (m, tag) => {
      if (tag && INLINE_AS_TEXT.test(tag)) return keep(esc(m));
      rawUsed = true;
      return keep(m);
    });

    // chú thích [^id] (chỉ khi có định nghĩa [^id]: …)
    if (ctx.fn && ctx.fn.defs.size)
      s = s.replace(/\[\^([^\]\s]+)\]/g, (m, id) => {
        const key = id.toLowerCase();
        const d = ctx.fn.defs.get(key);
        if (!d) return m;
        if (!d.num) {
          ctx.fn.order.push(key);
          d.num = ctx.fn.order.length;
        }
        d.refs = (d.refs || 0) + 1;
        const rid = 'fnref-' + d.fid + (d.refs > 1 ? '-' + d.refs : '');
        return keep(`<sup class="md-fn-ref" contenteditable="false" data-fn="${esc(id)}"><a href="#fn-${d.fid}" id="${rid}">${d.num}</a></sup>`);
      });

    const linkTail = String.raw`\(\s*(<[^>\n]*>|[^\s()]*(?:\([^\s()]*\)[^\s()]*)*)(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)`;
    const unAngle = (u) => (u && u[0] === '<' ? u.slice(1, -1) : u || '');
    const titleAttr = (t) => (t ? ` title="${esc(t)}"` : '');
    // ảnh ![alt](src "title")
    s = s.replace(new RegExp(String.raw`!\[([^\]]*)\]` + linkTail, 'g'), (_, alt, u, t1, t2) =>
      keep(`<img src="${esc(safeUrl(unAngle(u)))}" alt="${esc(restorePlain(alt, slots))}"${titleAttr(t1 || t2)} loading="lazy">`)
    );
    // ảnh tham chiếu ![alt][ref]
    s = s.replace(/!\[([^\]]*)\]\[([^\]]*)\]/g, (m, alt, ref) => {
      const d = ctx.refs.get((ref || alt).trim().toLowerCase());
      return d ? keep(`<img src="${esc(safeUrl(d.url))}" alt="${esc(restorePlain(alt, slots))}"${titleAttr(d.title)} loading="lazy">`) : m;
    });
    // link [text](url "title")
    s = s.replace(new RegExp(String.raw`\[((?:[^[\]]|\[[^\]]*\])*)\]` + linkTail, 'g'), (_, txt, u, t1, t2) =>
      keep(`<a href="${esc(safeUrl(unAngle(u)))}"${titleAttr(t1 || t2)}>`) + txt + keep('</a>')
    );
    // link tham chiếu [text][ref] / [ref][] / [ref]
    s = s.replace(/\[((?:[^[\]]|\[[^\]]*\])*)\](?:\[([^\]]*)\])?/g, (m, txt, ref) => {
      const key = (ref || txt).trim().toLowerCase();
      const d = key && ctx.refs.get(key);
      if (!d) return m;
      return keep(`<a href="${esc(safeUrl(d.url))}"${titleAttr(d.title)}>`) + txt + keep('</a>');
    });
    // URL trần (GFM autolink literal)
    s = s.replace(/(^|[\s(*_~])((?:https?:\/\/|www\.)[^\s<\u0000]*[^\s<.,:;"')\]*_~!?\u0000])/g, (_, pre, u) =>
      pre + keep(`<a href="${esc(/^www\./i.test(u) ? 'https://' + u : u)}">${esc(u)}</a>`)
    );
    // emoji :rocket: (md-rich.js đổi thành ký tự emoji theo bảng của GitHub; không có thì giữ chữ)
    s = s.replace(/(^|[^\p{L}\p{N}_:/])(:([a-z0-9_+-]{1,40}):)(?![\p{L}\p{N}_:])/giu, (m, pre, all, sc) =>
      pre + keep(`<span class="md-emoji" contenteditable="false" data-sc="${esc(sc.toLowerCase())}">${esc(all)}</span>`)
    );

    s = esc(s);
    // nhấn mạnh
    s = s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<strong>$2</strong>');
    s = s.replace(/(^|[^*\\])\*(?=[^\s*])([^*]*?[^\s*])\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^\p{L}\p{N}_])_(?=[^\s_])([^_]*?[^\s_])_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>');
    s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
    s = s.replace(/==(?=\S)([^=]*?\S)==/g, '<mark>$1</mark>');
    // xuống dòng cứng bằng 2 dấu cách cuối dòng
    s = s.replace(/ {2,}\n/g, '<br>\n');
    s = restore(s, slots);
    // có thẻ HTML thô: cô lập để thẻ không đóng (<b>, <div>…) không lan sang các khối sau
    return rawUsed ? isolate(s) : s;
  }
  function restore(s, slots) {
    for (let k = 0; k < 8 && s.indexOf('\u0000') >= 0; k++) s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[+i]);
    return s;
  }
  /** chữ thuần (cho alt ảnh): bỏ thẻ HTML sau khi khôi phục */
  function restorePlain(s, slots) {
    return restore(s, slots).replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  }

  // -------------------------------------------------------------------- block
  const RE = {
    fence: /^( {0,3})(`{3,}|~{3,})[ \t]*([^`\s]*)[^`]*$/,
    heading: /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/,
    hr: /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/,
    quote: /^ {0,3}>/,
    list: /^([ \t]*)([-*+]|\d{1,9}[.)])([ \t]+|$)/,
    htmlStart: /^ {0,3}(?:<!--|<\/?(?:address|article|aside|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|nav|ol|p|param|pre|script|section|source|style|summary|svg|table|tbody|td|tfoot|th|thead|title|tr|ul|video|audio|picture)(?:[\s/>]|$))/i,
    // HTML kiểu 7 của CommonMark: cả dòng chỉ là một thẻ – chỉ mở khối mới, không ngắt đoạn văn
    html7: /^ {0,3}<\/?[A-Za-z][\w-]*(?:\s[^<>]*)?\/?>[ \t]*$/,
    setext: /^ {0,3}(=+|-+)[ \t]*$/,
    tableDelim: /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/,
    refDef: /^ {0,3}\[([^\]]+)\]:[ \t]*<?(\S+?)>?(?:[ \t]+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?[ \t]*$/,
    fnDef: /^ {0,3}\[\^([^\]\s]+)\]:[ \t]?(.*)$/,
    toc: /^ {0,3}(?:\[toc\]|\[\[_?toc_?\]\]|\$\{toc\})[ \t]*$/i,
    mathOpen: /^ {0,3}\$\$(.*)$/,
  };

  // callout: 5 loại của GitHub + các loại của Obsidian (quy về 5 kiểu hiển thị)
  const ALERT = {
    note: 'note', tip: 'tip', important: 'important', warning: 'warning', caution: 'caution',
    info: 'note', abstract: 'note', summary: 'note', tldr: 'note', todo: 'note', quote: 'note', cite: 'note',
    hint: 'tip', success: 'tip', check: 'tip', done: 'tip',
    question: 'important', help: 'important', faq: 'important', example: 'important',
    attention: 'warning', failure: 'caution', fail: 'caution', missing: 'caution', danger: 'caution', error: 'caution', bug: 'caution',
  };
  const ALERT_TITLE = {
    note: 'Ghi chú', tip: 'Mẹo', important: 'Quan trọng', warning: 'Cảnh báo', caution: 'Thận trọng', info: 'Thông tin',
    abstract: 'Tóm tắt', summary: 'Tóm tắt', tldr: 'Tóm tắt', todo: 'Việc cần làm', quote: 'Trích dẫn', cite: 'Trích dẫn',
    hint: 'Gợi ý', success: 'Thành công', check: 'Đã kiểm tra', done: 'Đã xong', question: 'Câu hỏi', help: 'Trợ giúp',
    faq: 'Hỏi đáp', example: 'Ví dụ', attention: 'Chú ý', failure: 'Thất bại', fail: 'Thất bại', missing: 'Còn thiếu',
    danger: 'Nguy hiểm', error: 'Lỗi', bug: 'Lỗi phần mềm',
  };

  /** Khối Mermaid / công thức: trình soạn trực quan giữ nguyên mã gốc (data-raw) để chuyển ngược không mất gì */
  function richBlock(kind, src, raw, L, ctx) {
    const keepAttr = ctx.keepRaw ? ` contenteditable="false" data-raw="${esc(raw)}"` : '';
    const cls = ctx.keepRaw ? 'md-raw ' : '';
    if (kind === 'mermaid' || kind === 'plantuml')
      return `<div class="${cls}md-${kind}" data-line="${L}" data-src="${esc(src)}"${keepAttr}><pre class="md-mermaid-src">${esc(src)}</pre></div>`;
    return `<div class="${cls}md-math-block" data-line="${L}"${keepAttr}><span class="md-math" data-display="1" data-tex="${esc(src)}">${esc(src)}</span></div>`;
  }

  const startsBlock = (l, next) =>
    RE.fence.test(l) ||
    RE.toc.test(l) ||
    /^ {0,3}\$\$/.test(l) ||
    RE.heading.test(l) ||
    RE.hr.test(l) ||
    RE.quote.test(l) ||
    RE.htmlStart.test(l) ||
    MD.DIAGRAM_LINE.test(l) ||
    (/^[ \t]*(?:[-*+]|1[.)])[ \t]+\S/.test(l)) ||
    (l.includes('|') && next != null && RE.tableDelim.test(next) && next.includes('-'));

  function splitRow(line) {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
    const cells = [];
    let cur = '', code = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\' && s[i + 1] === '|') {
        cur += '|';
        i++;
      } else if (c === '`') {
        code ^= 1;
        cur += c;
      } else if (c === '|' && !code) {
        cells.push(cur.trim());
        cur = '';
      } else cur += c;
    }
    cells.push(cur.trim());
    return cells;
  }

  /**
   * lines: mảng dòng; ln0: số dòng nguồn của lines[0]; tight: đoạn văn không bọc <p> (list gọn)
   */
  function blocks(lines, ln0, ctx, tight = false) {
    const out = [];
    const n = lines.length;
    let i = 0;
    while (i < n) {
      const line = lines[i];
      if (BLANK.test(line)) {
        i++;
        continue;
      }
      const L = ln0 + i;
      const at = ` data-line="${L}"`;
      let m;

      // diagram nhúng
      if ((m = line.match(MD.DIAGRAM_LINE))) {
        out.push(ctx.diagram ? ctx.diagram(m[1], L, (m[2] || '').trim()) : '');
        i++;
        continue;
      }

      // mục lục tự động [TOC] (điền ở cuối MD.render khi đã biết mọi tiêu đề)
      if (RE.toc.test(line)) {
        ctx.hasToc = true;
        out.push(`<nav class="${ctx.keepRaw ? 'md-raw ' : ''}md-toc" data-line="${L}"${ctx.keepRaw ? ` contenteditable="false" data-raw="${esc(line.trim())}"` : ''}>\u0001TOC\u0001</nav>`);
        i++;
        continue;
      }

      // công thức riêng một khối: $$ … $$ (một hoặc nhiều dòng)
      if ((m = line.match(RE.mathOpen))) {
        const rest = m[1];
        let end = -1, tex = '';
        const one = rest.match(/^(.*?)\$\$[ \t]*$/);
        if (one) {
          if (one[1].trim()) {
            end = i;
            tex = one[1].trim();
          }
        } else if (!rest.includes('$$')) {
          for (let j = i + 1; j < n && j < i + 400; j++) {
            const cm = lines[j].match(/^(.*?)\$\$[ \t]*$/);
            if (cm) {
              end = j;
              tex = [rest, ...lines.slice(i + 1, j), cm[1]].join('\n').trim();
              break;
            }
          }
        }
        if (end >= 0 && tex) {
          out.push(richBlock('math', tex, lines.slice(i, end + 1).join('\n'), L, ctx));
          i = end + 1;
          continue;
        }
      }

      // khối code có rào
      if ((m = line.match(RE.fence))) {
        const ind = m[1].length, fence = m[2], lang = m[3] || '';
        const start = i;
        const body = [];
        i++;
        const close = new RegExp(`^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`);
        while (i < n && !close.test(lines[i])) body.push(dedent(lines[i++], ind));
        i++; // bỏ dòng đóng
        const lg = lang.toLowerCase();
        if (lg === 'mermaid' || lg === 'math' || lg === 'plantuml' || lg === 'puml' || lg === 'uml') {
          const kind = lg === 'mermaid' || lg === 'math' ? lg : 'plantuml';
          out.push(richBlock(kind, body.join('\n'), lines.slice(start, Math.min(i, n)).join('\n'), L, ctx));
          continue;
        }
        const cls = lang ? ` class="language-${esc(lang)}"` : '';
        out.push(`<pre${at}${lang ? ` data-lang="${esc(lang)}"` : ''}><code${cls}>${esc(body.join('\n'))}${body.length ? '\n' : ''}</code></pre>`);
        continue;
      }

      // tiêu đề ATX
      if ((m = line.match(RE.heading))) {
        const lv = m[1].length, html = inline(m[2] || '', ctx);
        out.push(`<h${lv}${at} id="${esc(slug(html, ctx.ids))}">${html}</h${lv}>`);
        i++;
        continue;
      }

      // đường kẻ ngang
      if (RE.hr.test(line)) {
        out.push(`<hr${at}>`);
        i++;
        continue;
      }

      // trích dẫn
      if (RE.quote.test(line)) {
        const body = [];
        while (i < n && !BLANK.test(lines[i]) && (RE.quote.test(lines[i]) || (body.length && !startsBlock(lines[i], lines[i + 1])))) {
          body.push(lines[i].replace(/^ {0,3}> ?/, ''));
          i++;
        }
        // > [!NOTE] (GitHub) · > [!tip]- Tiêu đề riêng (Obsidian: dấu - / + là thu gọn / mở sẵn)
        const am = body[0] && body[0].match(/^\[!([A-Za-z]+)\]([-+]?)(?:[ \t]+(.*?))?[ \t]*$/);
        if (am && ALERT[am[1].toLowerCase()]) {
          const t = am[1].toLowerCase(), kind = ALERT[t];
          const title = am[3] ? inline(am[3], ctx) : esc(ALERT_TITLE[t]);
          const attrs = ` data-type="${esc(am[1])}"${am[2] ? ` data-fold="${am[2]}"` : ''}${am[3] ? ` data-title="${esc(am[3])}"` : ''}`;
          out.push(
            `<div${at} class="md-alert md-alert-${kind}"${attrs}><p class="md-alert-title"${ctx.keepRaw ? ' contenteditable="false"' : ''}>${title}</p>${blocks(body.slice(1), L + 1, ctx)}</div>`
          );
        } else out.push(`<blockquote${at}>${blocks(body, L, ctx)}</blockquote>`);
        continue;
      }

      // danh sách
      if ((m = line.match(RE.list)) && !RE.hr.test(line)) {
        const r = parseList(lines, i, ln0, ctx);
        out.push(r.html);
        i = r.next;
        continue;
      }

      // bảng
      if (line.includes('|') && i + 1 < n && RE.tableDelim.test(lines[i + 1]) && lines[i + 1].includes('-')) {
        const head = splitRow(line);
        const align = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : /^:-/.test(c) ? 'left' : ''));
        const st = (k) => (align[k] ? ` style="text-align:${align[k]}"` : '');
        let html = `<div class="md-table"${at}><table><thead><tr>${head.map((c, k) => `<th${st(k)}>${inline(c, ctx)}</th>`).join('')}</tr></thead><tbody>`;
        i += 2;
        while (i < n && !BLANK.test(lines[i]) && lines[i].includes('|') && !startsBlock(lines[i])) {
          const cells = splitRow(lines[i]);
          html += `<tr data-line="${ln0 + i}">${head.map((_, k) => `<td${st(k)}>${inline(cells[k] ?? '', ctx)}</td>`).join('')}</tr>`;
          i++;
        }
        out.push(html + '</tbody></table></div>');
        continue;
      }

      // khối HTML
      if (RE.htmlStart.test(line) || RE.html7.test(line)) {
        const body = [];
        if (/^ {0,3}<!--/.test(line)) {
          while (i < n) {
            body.push(lines[i]);
            if (lines[i++].includes('-->')) break;
          }
        } else {
          while (i < n && !BLANK.test(lines[i])) body.push(lines[i++]);
        }
        // trình soạn trực quan: giữ nguyên mã gốc để chuyển ngược không làm mất gì
        // làm sạch riêng từng khối: thẻ không đóng (<style>, <svg>…) không nuốt được phần sau của tài liệu
        const safe = isolate(body.join('\n'));
        if (ctx.keepRaw) out.push(`<div class="md-raw" contenteditable="false" data-line="${L}" data-raw="${esc(body.join('\n'))}">${safe}</div>`);
        else out.push(safe);
        continue;
      }

      // định nghĩa link tham chiếu (đã thu thập ở bước trước) – bỏ qua khi hiển thị
      if (RE.refDef.test(line)) {
        i++;
        continue;
      }

      // đoạn văn (+ tiêu đề setext)
      const para = [line];
      i++;
      let setext = 0;
      while (i < n && !BLANK.test(lines[i])) {
        const sm = lines[i].match(RE.setext);
        if (sm && !(sm[1][0] === '-' && para.length === 0)) {
          setext = sm[1][0] === '=' ? 1 : 2;
          i++;
          break;
        }
        if (startsBlock(lines[i], lines[i + 1])) break;
        para.push(lines[i]);
        i++;
      }
      const html = inline(para.map((l) => l.replace(/^[ \t]+/, '')).join('\n').replace(/[ \t]+$/, ''), ctx);
      if (setext) out.push(`<h${setext}${at} id="${esc(slug(html, ctx.ids))}">${html}</h${setext}>`);
      else if (tight) out.push(html);
      else out.push(`<p${at}>${html}</p>`);
    }
    return out.join('\n');
  }

  function parseList(lines, i, ln0, ctx) {
    const n = lines.length;
    const first = lines[i].match(RE.list);
    const baseIndent = indentOf(first[1]);
    const ordered = /\d/.test(first[2]);
    const start = ordered ? parseInt(first[2], 10) : 1;
    const items = [];
    let loose = false;
    while (i < n) {
      const m = lines[i].match(RE.list);
      if (!m || RE.hr.test(lines[i])) break;
      const ind = indentOf(m[1]);
      if (ind < baseIndent || ind > baseIndent + 3) break;
      if (/\d/.test(m[2]) !== ordered) break;
      const spaces = m[3].length;
      const contentIndent = ind + m[2].length + (spaces === 0 || spaces > 4 ? 1 : spaces);
      const firstText = lines[i].replace(RE.list, '');
      const body = [spaces > 4 ? ' '.repeat(spaces - 1) + firstText : firstText];
      const L = ln0 + i;
      i++;
      let sawBlank = false;
      while (i < n) {
        const l = lines[i];
        if (BLANK.test(l)) {
          let j = i;
          while (j < n && BLANK.test(lines[j])) j++;
          if (j < n && indentOf(lines[j]) >= contentIndent) {
            for (; i < j; i++) body.push('');
            sawBlank = true;
            continue;
          }
          break;
        }
        if (indentOf(l) >= contentIndent) {
          body.push(dedent(l, contentIndent));
          i++;
          continue;
        }
        if (RE.list.test(l) || startsBlock(l, lines[i + 1])) break;
        body.push(l.trim()); // dòng nối lười của đoạn văn
        i++;
      }
      // dòng trống giữa các mục -> list "lỏng"
      let j = i;
      while (j < n && BLANK.test(lines[j])) j++;
      const nm = j < n && j > i ? lines[j].match(RE.list) : null;
      if (nm && indentOf(nm[1]) >= baseIndent && indentOf(nm[1]) <= baseIndent + 3 && /\d/.test(nm[2]) === ordered) {
        loose = true;
        i = j;
      }
      if (sawBlank) loose = true;
      items.push({ body, L });
    }
    const lis = items.map(({ body, L }) => {
      let task = '';
      const tm = body[0].match(/^\[([ xX])\][ \t]+/);
      if (tm) {
        body[0] = body[0].slice(tm[0].length);
        task = `<input type="checkbox" class="md-task" data-task-line="${L}"${tm[1] !== ' ' ? ' checked' : ''}> `;
      }
      return `<li data-line="${L}"${task ? ' class="md-task-item"' : ''}>${task}${blocks(body, L, ctx, !loose)}</li>`;
    });
    const tag = ordered ? 'ol' : 'ul';
    const st = ordered && start !== 1 ? ` start="${start}"` : '';
    return { html: `<${tag} data-line="${ln0 + (items[0] ? items[0].L - ln0 : 0)}"${st}>${lis.join('\n')}</${tag}>`, next: i };
  }

  /**
   * Render Markdown. opt.diagram(id, line, name) -> HTML cho dòng [[diagram:…]].
   * Trả về HTML CHƯA làm sạch – gọi MD.sanitize trước khi gán innerHTML.
   */
  /** Front matter YAML: hiện thành bảng khoá – giá trị (như GitHub), giữ nguyên mã gốc */
  function frontMatterHTML(body, raw, keepRaw) {
    const rows = [];
    for (const l of body) {
      const m = l.match(/^([A-Za-z_][\w .-]*?)[ \t]*:(?:[ \t]+(.*))?$/);
      if (m) rows.push([m[1], (m[2] || '').trim()]);
      else if (rows.length && l.trim()) {
        const v = l.trim().replace(/^-[ \t]+/, '');
        const last = rows[rows.length - 1];
        last[1] += (last[1] ? ', ' : '') + v;
      }
    }
    const unq = (v) => v.replace(/^(["'])([\s\S]*)\1$/, '$2');
    const cells = rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(unq(v))}</td></tr>`).join('');
    return (
      `<div class="${keepRaw ? 'md-raw ' : ''}md-frontmatter" data-line="0"${keepRaw ? ` contenteditable="false" data-raw="${esc(raw)}"` : ''}>` +
      `<table><tbody>${cells || `<tr><td>${esc(body.join('\n'))}</td></tr>`}</tbody></table></div>`
    );
  }

  MD.render = function (src, opt = {}) {
    const lines = String(src || '').replace(/\r\n?/g, '\n').replace(/\u0001/g, '').split('\n');

    // front matter --- … --- ở đầu file
    let fmHtml = '';
    if (/^---[ \t]*$/.test(lines[0] || '')) {
      for (let j = 1; j < Math.min(lines.length, 300); j++) {
        if (!/^(---|\.\.\.)[ \t]*$/.test(lines[j])) continue;
        const body = lines.slice(1, j);
        if (body.some((l) => /^[A-Za-z_][\w .-]*:(\s|$)/.test(l))) {
          fmHtml = frontMatterHTML(body, lines.slice(0, j + 1).join('\n'), !!opt.keepRaw);
          for (let k = 0; k <= j; k++) lines[k] = '';
        }
        break;
      }
    }

    // định nghĩa chú thích [^id]: … (+ các dòng thụt vào phía sau) -> gom về cuối tài liệu
    const fn = { defs: new Map(), order: [], raw: [], last: 0 };
    let inFence = null;
    for (let k = 0; k < lines.length; k++) {
      const l = lines[k];
      const f = l.match(RE.fence);
      if (f && (!inFence || f[2][0] === inFence[0])) {
        inFence = inFence ? null : f[2];
        continue;
      }
      if (inFence) continue;
      const m = l.match(RE.fnDef);
      if (!m) continue;
      const body = [m[2]], raw = [l];
      let j = k + 1;
      while (j < lines.length) {
        if (/^( {2,}|\t)\S/.test(lines[j])) {
          body.push(dedent(lines[j], Math.min(4, indentOf(lines[j]))));
          raw.push(lines[j++]);
        } else if (BLANK.test(lines[j]) && /^( {4}|\t)\S/.test(lines[j + 1] || '')) {
          body.push('');
          raw.push(lines[j++]);
        } else break;
      }
      const key = m[1].toLowerCase();
      if (!fn.defs.has(key)) fn.defs.set(key, { id: m[1], fid: m[1].replace(/[^\p{L}\p{N}_-]/gu, '_'), body, line: k, num: 0 });
      fn.raw.push(raw.join('\n'));
      fn.last = j - 1;
      for (let q = k; q < j; q++) lines[q] = '';
      k = j - 1;
    }

    const refs = new Map();
    inFence = null;
    for (const l of lines) {
      const f = l.match(RE.fence);
      if (f && (!inFence || f[2][0] === inFence[0])) inFence = inFence ? null : f[2];
      if (inFence) continue;
      const m = l.match(RE.refDef);
      if (m) {
        const k = m[1].trim().toLowerCase();
        if (!refs.has(k)) refs.set(k, { url: m[2], title: m[3] || m[4] || m[5] || '' });
      }
    }
    const ctx = { refs, ids: new Set(), diagram: opt.diagram, keepRaw: !!opt.keepRaw, fn, hasToc: false };
    let html = fmHtml + blocks(lines, 0, ctx);

    // khu chú thích ở cuối (đánh số theo thứ tự xuất hiện lần đầu)
    if (fn.defs.size) {
      const used = fn.order.map((k) => fn.defs.get(k));
      const rest = [...fn.defs.values()].filter((d) => !d.num);
      const items = used
        .concat(rest)
        .map((d) => {
          const back = d.num ? ` <a href="#fnref-${d.fid}" class="md-fn-back" aria-label="Quay lại chỗ tham chiếu">↩</a>` : '';
          return `<li id="fn-${d.fid}" data-line="${d.line}">${blocks(d.body, d.line, ctx, true)}${back}</li>`;
        })
        .join('');
      const keep = ctx.keepRaw ? ` contenteditable="false" data-raw="${esc(fn.raw.join('\n'))}"` : '';
      html += `\n<section class="${ctx.keepRaw ? 'md-raw ' : ''}md-footnotes" data-line="${fn.last}"${keep}><p class="md-fn-title">Chú thích</p><ol>${items}</ol></section>`;
    }

    // mục lục [TOC]
    if (ctx.hasToc) {
      const heads = [];
      html.replace(/<h([1-6])[^>]*?\sid="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/g, (_, lv, id, inner) => {
        heads.push({ lv: +lv, id, text: inner.replace(/<[^>]*>/g, '').trim() });
        return '';
      });
      const min = heads.length ? Math.min(...heads.map((h) => h.lv)) : 1;
      const list = heads.length
        ? '<ul class="md-toc-list">' + heads.map((h) => `<li class="md-toc-l${h.lv - min + 1}"><a href="#${h.id}">${h.text}</a></li>`).join('') + '</ul>'
        : '<p class="md-toc-empty">Chưa có tiêu đề nào trong tài liệu.</p>';
      html = html.replace(/\u0001TOC\u0001/g, '<p class="md-toc-title">Mục lục</p>' + list);
    }
    return html;
  };

  /** Danh sách tiêu đề (cho mục lục): [{ level, text, line }] */
  MD.headings = function (src) {
    const out = [];
    let fence = null;
    const all = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    // bỏ qua front matter (dòng "# …" trong YAML là chú thích, không phải tiêu đề)
    let skip = 0;
    if (/^---[ \t]*$/.test(all[0] || '')) {
      const j = all.findIndex((l, k) => k > 0 && k < 300 && /^(---|\.\.\.)[ \t]*$/.test(l));
      if (j > 0 && all.slice(1, j).some((l) => /^[A-Za-z_][\w .-]*:(\s|$)/.test(l))) skip = j + 1;
    }
    all.forEach((l, i) => {
        if (i < skip) return;
        const f = l.match(RE.fence);
        if (f && (!fence || f[2][0] === fence[0])) fence = fence ? null : f[2];
        if (fence || f) return;
        const m = l.match(RE.heading);
        if (m && m[2]) out.push({ level: m[1].length, text: m[2].replace(/[*_`~]/g, ''), line: i });
      });
    return out;
  };

  // ============================================================== LÀM SẠCH
  const BAD_TAGS = new Set([
    'SCRIPT', 'STYLE', 'IFRAME', 'FRAME', 'FRAMESET', 'OBJECT', 'EMBED', 'APPLET', 'LINK', 'META', 'BASE',
    'FORM', 'TEXTAREA', 'SELECT', 'BUTTON', 'TEMPLATE', 'NOSCRIPT', 'PORTAL', 'FOREIGNOBJECT', 'DIALOG',
    // SVG animation có thể gán href = javascript:
    'SET', 'ANIMATE', 'ANIMATEMOTION', 'ANIMATETRANSFORM', 'ANIMATECOLOR', 'HANDLER', 'LISTENER',
    // thẻ "nuốt" toàn bộ văn bản phía sau khi không đóng (raw text / RCDATA)
    'XMP', 'PLAINTEXT', 'NOEMBED', 'NOFRAMES', 'TITLE',
  ]);
  const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'background', 'poster', 'cite', 'srcset', 'data', 'ping']);
  const ID_PREFIX = 'md-';

  /**
   * Làm sạch cây DOM tại chỗ (file .md có thể đến từ bất kỳ đâu, còn trang lại giữ API key trong
   * localStorage): bỏ thẻ nguy hiểm, thuộc tính on*, URL javascript:. prefix = true: thêm tiền tố
   * cho id để không đè lên id của giao diện (link #… và url(#…) được sửa theo).
   */
  function cleanTree(root, prefix) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
    const drop = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === 8) {
        drop.push(node);
        continue;
      }
      const tag = node.tagName.toUpperCase();
      if (BAD_TAGS.has(tag) || tag.includes(':')) {
        drop.push(node);
        continue;
      }
      if (tag === 'INPUT' && node.getAttribute('type') !== 'checkbox') {
        drop.push(node);
        continue;
      }
      for (const a of [...node.attributes]) {
        const name = a.name.toLowerCase();
        let v = a.value;
        if (name === 'data-raw') continue; // mã gốc của khối HTML (chỉ là chuỗi, không bao giờ được render)
        if (name.startsWith('on') || name === 'formaction' || name === 'autofocus') {
          node.removeAttribute(a.name);
          continue;
        }
        if (URL_ATTRS.has(name)) {
          if (name === 'srcset') {
            if (/javascript:|data:(?!image\/(png|jpe?g|gif|webp|avif))/i.test(v.replace(/\s/g, ''))) node.removeAttribute(a.name);
            continue;
          }
          if (v.trim().startsWith('#') && v.trim().length > 1) {
            if (prefix) node.setAttribute(a.name, '#' + ID_PREFIX + v.trim().slice(1));
            continue;
          }
          const safe = safeUrl(v);
          if (safe !== v.trim()) node.setAttribute(a.name, safe);
          // <use href="file.svg#x"> có thể nạp tài liệu ngoài
          if (tag === 'USE' && !safe.startsWith('#')) node.removeAttribute(a.name);
          continue;
        }
        if (name === 'id' || name === 'name') {
          if (prefix) node.setAttribute(a.name, ID_PREFIX + v);
          continue;
        }
        if (name === 'style') {
          if (/expression\s*\(|javascript:|behavior\s*:|-moz-binding|position\s*:\s*(fixed|sticky)/i.test(v)) node.removeAttribute(a.name);
          else if (prefix && /url\(\s*['"]?#/i.test(v)) node.setAttribute(a.name, v.replace(/url\(\s*(['"]?)#/gi, `url($1#${ID_PREFIX}`));
          continue;
        }
        if (prefix && /url\(\s*['"]?#/i.test(v)) node.setAttribute(a.name, v.replace(/url\(\s*(['"]?)#/gi, `url($1#${ID_PREFIX}`));
      }
      if (tag === 'A' && /^https?:/i.test(node.getAttribute('href') || '')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
    drop.forEach((d) => d.remove());
  }

  /**
   * Làm sạch rồi trả về DocumentFragment – chèn thẳng các node này vào trang (replaceChildren)
   * thay vì gán innerHTML, để trình duyệt không phải phân tích lại chuỗi (chặn kiểu tấn công mXSS:
   * chuỗi "sạch" nhưng khi phân tích lại thì biến thành mã độc).
   */
  MD.sanitizeFragment = function (html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    cleanTree(tpl.content, true);
    return tpl.content;
  };

  /** Làm sạch, trả về chuỗi HTML */
  MD.sanitize = function (html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    cleanTree(tpl.content, true);
    return tpl.innerHTML;
  };

  /**
   * Cô lập một đoạn HTML thô (khối HTML / dòng có thẻ HTML): làm sạch riêng để thẻ không đóng
   * (<svg>, <b>, <style>…) không lan sang / nuốt mất phần còn lại của tài liệu. Chưa thêm tiền tố id
   * (MD.sanitize toàn tài liệu sẽ làm một lần).
   */
  function isolate(html) {
    if (typeof document === 'undefined') return html;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    cleanTree(tpl.content, false);
    return tpl.innerHTML;
  }
  MD.ID_PREFIX = ID_PREFIX;

  // ===================================================== HTML → MARKDOWN
  // Dùng cho trình soạn trực quan (contenteditable): đọc DOM người dùng đã sửa, sinh lại Markdown.
  const BLOCK_TAGS = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE', 'HR', 'FIGURE',
    'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'MAIN', 'NAV', 'DL', 'DETAILS', 'ADDRESS',
  ]);
  const KEEP_INLINE = new Set(['KBD', 'SUB', 'SUP', 'U', 'INS', 'SMALL', 'ABBR', 'Q', 'VAR', 'SAMP']);
  const ZW = /[\u200b\u200c\u200d\ufeff]/g;

  const escText = (t) => {
    let s = t
      .replace(ZW, '')
      .replace(/ /g, ' ')
      .replace(/([\\`*_[\]~])/g, '\\$1')
      .replace(/<(?=[A-Za-z/!?])/g, '\\<')
      .replace(/==/g, '=\\=');
    // hai dấu $ trở lên trong cùng đoạn chữ có thể bị hiểu thành công thức -> thoát
    if ((s.match(/\$/g) || []).length > 1) s = s.replace(/\$/g, '\\$');
    return s;
  };

  /** bọc dấu nhấn mạnh, đẩy khoảng trắng đầu/cuối ra ngoài (** a ** không hợp lệ) */
  const wrapMark = (mark, inner) => {
    const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return m[2] ? m[1] + mark + m[2] + mark + m[3] : inner;
  };

  function inlineMd(node, o) {
    let out = '';
    const kids = [...node.childNodes];
    kids.forEach((c, k) => {
      if (c.nodeType === 3) {
        out += escText(c.nodeValue.replace(/\n[ \t]*/g, o.inTable ? ' ' : '\n'));
        return;
      }
      if (c.nodeType !== 1) return;
      const tag = c.tagName.toUpperCase();
      if (c.classList.contains('dg-actions')) return;
      // công thức / emoji / chú thích: đọc lại mã gốc từ thuộc tính (nội dung đã được vẽ lại)
      if (c.classList.contains('md-math')) {
        const t = c.getAttribute('data-tex') || '';
        if (c.getAttribute('data-display')) out += '$$' + t + '$$';
        else out += t.includes('$') && !t.includes('`') ? '$`' + t + '`$' : '$' + t + '$';
        return;
      }
      if (c.classList.contains('md-emoji')) {
        out += ':' + (c.getAttribute('data-sc') || '') + ':';
        return;
      }
      if (c.classList.contains('md-fn-ref')) {
        out += '[^' + (c.getAttribute('data-fn') || '') + ']';
        return;
      }
      if (BLOCK_TAGS.has(tag)) {
        // khối lạc trong dòng (dán từ nơi khác) -> xuống dòng
        const t = inlineMd(c, o).trim();
        if (t) out += (out && !out.endsWith('\n') ? '\n' : '') + t + '\n';
        return;
      }
      switch (tag) {
        case 'BR':
          if (k === kids.length - 1 || o.inTable) return; // <br> cuối khối do trình duyệt thêm
          out += '\\\n';
          return;
        case 'STRONG':
        case 'B':
          out += wrapMark('**', inlineMd(c, o));
          return;
        case 'EM':
        case 'I':
          out += wrapMark('*', inlineMd(c, o));
          return;
        case 'DEL':
        case 'S':
        case 'STRIKE':
          out += wrapMark('~~', inlineMd(c, o));
          return;
        case 'MARK':
          out += wrapMark('==', inlineMd(c, o));
          return;
        case 'CODE': {
          const t = c.textContent.replace(ZW, '').replace(/ /g, ' ');
          if (!t) return;
          const runs = t.match(/`+/g) || [];
          const fence = '`'.repeat(Math.max(0, ...runs.map((r) => r.length)) + 1);
          const pad = /^`|`$/.test(t) ? ' ' : '';
          out += fence + pad + t + pad + fence;
          return;
        }
        case 'A': {
          let href = c.getAttribute('href') || '';
          if (href.startsWith('#' + ID_PREFIX)) href = '#' + href.slice(1 + ID_PREFIX.length);
          const text = inlineMd(c, o);
          const plain = c.textContent.trim();
          if (!href) return void (out += text);
          if (plain === href && /^(https?:\/\/|mailto:)/i.test(href)) return void (out += href);
          if (/^www\./i.test(plain) && href === 'https://' + plain) return void (out += plain);
          const title = c.getAttribute('title');
          out += `[${text || href}](${/[\s()]/.test(href) ? '<' + href + '>' : href}${title ? ` "${title.replace(/"/g, '\\"')}"` : ''})`;
          return;
        }
        case 'IMG': {
          const src = c.getAttribute('src') || '';
          if (!src) return;
          const alt = (c.getAttribute('alt') || '').replace(/[[\]\\]/g, '\\$&');
          const title = c.getAttribute('title');
          out += `![${alt}](${/[\s()]/.test(src) ? '<' + src + '>' : src}${title ? ` "${title.replace(/"/g, '\\"')}"` : ''})`;
          return;
        }
        case 'INPUT':
          return; // checkbox của task list – xử lý ở <li>
        default:
          if (KEEP_INLINE.has(tag)) {
            const t = tag.toLowerCase();
            out += `<${t}>${inlineMd(c, o)}</${t}>`;
          } else if (tag === 'SPAN' || tag === 'FONT') {
            // chữ màu / tô nền: giữ dạng <span style="color:…"> (Markdown không có cú pháp màu riêng)
            const st = colorStyle(c, tag);
            const inner = inlineMd(c, o);
            out += st && inner.trim() ? `<span style="${st}">${inner}</span>` : inner;
          } else out += inlineMd(c, o); // thẻ khác do dán vào: chỉ giữ chữ
      }
    });
    return out;
  }

  /** "rgb(…)" / "#abc" / tên màu -> giá trị gọn để ghi vào file; '' nếu không có màu */
  function cssColor(v) {
    v = String(v || '').trim().toLowerCase();
    if (!v || /^(inherit|initial|unset|currentcolor|transparent)$/.test(v)) return '';
    const m = v.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)$/);
    if (m) {
      const a = m[4] == null ? 1 : /%$/.test(m[4]) ? parseFloat(m[4]) / 100 : +m[4];
      if (a <= 0.01) return '';
      if (a < 0.995) return `rgba(${+m[1]},${+m[2]},${+m[3]},${Math.round(a * 100) / 100})`;
      return '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('');
    }
    return /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/.test(v) ? v : '';
  }
  /**
   * Kiểu màu của <span style> / <font color>. Chỉ nhận thẻ CHỈ mang màu chữ / màu nền: trình duyệt hay tự
   * chèn <span style="font-size…; color…"> khi gộp đoạn – những thẻ đó bị bỏ, chỉ giữ chữ.
   */
  function colorStyle(el, tag) {
    const st = el.style;
    for (let i = 0; i < st.length; i++) if (!/^(color|background-color)$/.test(st[i])) return '';
    let color = cssColor(st.color || (tag === 'FONT' ? el.getAttribute('color') : ''));
    const bg = cssColor(st.backgroundColor);
    // màu trùng màu chữ của khung ngoài (thẻ thừa) -> bỏ
    if (color && el.isConnected && el.parentElement && getComputedStyle(el.parentElement).color === getComputedStyle(el).color && !st.color) color = '';
    return [color && 'color:' + color, bg && 'background-color:' + bg].filter(Boolean).join(';');
  }

  /** chống việc dòng văn bản thường bị hiểu nhầm thành cú pháp khối */
  const escLineStarts = (s) =>
    s
      .split('\n')
      .map((l) => {
        const m = l.match(/^(\s*)(.*)$/);
        let t = m[2];
        if (/^(#{1,6}(\s|$)|>|[-+*]\s|=+\s*$|-+\s*$|\||```|~~~)/.test(t)) t = '\\' + t;
        else t = t.replace(/^(\d{1,9})([.)])(\s|$)/, '$1\\$2$3');
        return t; // bỏ thụt đầu dòng (4 dấu cách sẽ thành khối code)
      })
      .join('\n')
      .replace(/[ \t]+$/gm, '');

  const prefixLines = (s, p, pEmpty = p.trimEnd()) =>
    s
      .split('\n')
      .map((l) => (l ? p + l : pEmpty))
      .join('\n');

  function blocksMd(container, o) {
    const out = [];
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const wrap = document.createElement('span');
      run.forEach((n) => wrap.appendChild(n.cloneNode(true)));
      const t = escLineStarts(inlineMd(wrap, o).replace(/^\s+|\s+$/g, ''));
      if (t) out.push(t);
      run = [];
    };
    for (const c of [...container.childNodes]) {
      if (c.nodeType === 1 && (BLOCK_TAGS.has(c.tagName.toUpperCase()) || c.classList.contains('md-raw'))) {
        flush();
        const md = blockMd(c, o);
        if (md != null && md !== '') out.push(md);
      } else if (c.nodeType === 3 || (c.nodeType === 1 && c.tagName !== 'INPUT')) run.push(c);
    }
    flush();
    return out;
  }

  function blockMd(el, o) {
    const tag = el.tagName.toUpperCase();
    if (el.classList.contains('md-raw')) return el.getAttribute('data-raw') || '';
    if (tag === 'FIGURE' && el.classList.contains('md-diagram')) return o.diagram ? o.diagram(el) : '';
    if (/^H[1-6]$/.test(tag)) {
      const t = inlineMd(el, o).replace(/\\\n|\n/g, ' ').trim();
      return t ? '#'.repeat(+tag[1]) + ' ' + t : '';
    }
    switch (tag) {
      case 'HR':
        return '---';
      case 'PRE': {
        const code = el.querySelector('code');
        const lang = el.getAttribute('data-lang') || ((code && code.className.match(/language-(\S+)/)) || [])[1] || '';
        const text = el.innerText !== undefined && el.isConnected ? el.innerText : el.textContent;
        const t = text.replace(ZW, '').replace(/ /g, ' ').replace(/\n$/, '');
        const runs = t.match(/^`{3,}/gm) || [];
        const fence = '`'.repeat(Math.max(3, ...runs.map((r) => r.length + 1)));
        return fence + lang + '\n' + t + '\n' + fence;
      }
      case 'BLOCKQUOTE': {
        const inner = blocksMd(el, o).join('\n\n');
        return inner ? prefixLines(inner, '> ') : '';
      }
      case 'UL':
      case 'OL':
        return listMd(el, o);
      case 'TABLE':
        return tableMd(el, o);
      case 'DIV': {
        if (el.classList.contains('md-alert')) {
          const kind = (el.className.match(/md-alert-(note|tip|important|warning|caution)/) || [])[1] || 'note';
          const kids = document.createElement('div');
          [...el.childNodes].filter((n) => !(n.nodeType === 1 && n.classList.contains('md-alert-title'))).forEach((n) => kids.appendChild(n.cloneNode(true)));
          const inner = blocksMd(kids, o).join('\n\n');
          const type = el.getAttribute('data-type') || kind.toUpperCase();
          const title = el.getAttribute('data-title');
          return `> [!${type}]${el.getAttribute('data-fold') || ''}${title ? ' ' + title : ''}` + (inner ? '\n' + prefixLines(inner, '> ') : '');
        }
        if (el.classList.contains('md-table')) return blocksMd(el, o).join('\n\n');
        return blocksMd(el, o).join('\n\n');
      }
      case 'LI':
        return blocksMd(el, o).join('\n');
      default:
        return blocksMd(el, o).join('\n\n');
    }
  }

  function listMd(list, o) {
    const ordered = list.tagName.toUpperCase() === 'OL';
    let n = parseInt(list.getAttribute('start') || '1', 10) || 1;
    const items = [...list.children].filter((c) => c.tagName.toUpperCase() === 'LI' || /^(UL|OL)$/i.test(c.tagName));
    const loose = items.some((li) => [...li.children].some((c) => c.tagName === 'P') && li.querySelectorAll(':scope > p').length > 1);
    const out = [];
    for (const li of items) {
      if (/^(UL|OL)$/i.test(li.tagName)) {
        // danh sách lồng không nằm trong <li> (execCommand('indent') của Chrome tạo ra) -> gắn vào mục trước
        const sub = listMd(li, o);
        if (sub && out.length) out[out.length - 1] += '\n' + prefixLines(sub, '  ', '');
        else if (sub) out.push(sub);
        continue;
      }
      const marker = ordered ? `${n++}. ` : '- ';
      const cb = li.querySelector(':scope > input[type=checkbox]');
      const task = cb ? (cb.checked ? '[x] ' : '[ ] ') : '';
      const body = blocksMd(li, o).join(loose ? '\n\n' : '\n');
      out.push(marker + task + prefixLines(body, ' '.repeat(marker.length), '').replace(/^ +/, ''));
    }
    return out.join(loose ? '\n\n' : '\n');
  }

  function tableMd(table, o) {
    const rows = [...table.querySelectorAll('tr')].filter((tr) => tr.closest('table') === table);
    if (!rows.length) return '';
    const cell = (td) => inlineMd(td, { ...o, inTable: true }).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
    const grid = rows.map((tr) => [...tr.children].filter((c) => /^T[HD]$/i.test(c.tagName)));
    const cols = Math.max(...grid.map((r) => r.length), 1);
    const align = grid[0].map((c) => (c.style.textAlign === 'center' ? ':-:' : c.style.textAlign === 'right' ? '--:' : c.style.textAlign === 'left' ? ':--' : '---'));
    while (align.length < cols) align.push('---');
    const line = (r) => '| ' + Array.from({ length: cols }, (_, k) => (r[k] ? cell(r[k]) : '')).join(' | ') + ' |';
    return [line(grid[0]), '| ' + align.join(' | ') + ' |', ...grid.slice(1).map(line)].join('\n');
  }

  /**
   * DOM (trình soạn trực quan) -> Markdown.
   * opt.diagram(figureEl) -> dòng [[diagram:…]] cho diagram nhúng.
   */
  MD.fromHTML = function (root, opt = {}) {
    const md = blocksMd(root, opt).join('\n\n');
    return md.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '') + (md ? '\n' : '');
  };
})(window.DE);
