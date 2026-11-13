/* =========================================================================
 * Thiết kế trang – NHẬP TRANG HTML
 *  1. Hỏi người dùng: thêm trang / thay dự án, file còn thiếu (ảnh, CSS, font),
 *     có chạy JavaScript của trang không, chuyển tự động hay nhờ AI.
 *  2. Dựng trang trong iframe cách ly: sandbox="allow-scripts" KHÔNG kèm
 *     allow-same-origin -> trang (và script của nó nếu được phép) không đọc được
 *     dữ liệu của app. Một đoạn mã đo đạc chèn vào iframe đọc lại cây phần tử với
 *     style thật (getComputedStyle), ::before/::after, luật :hover/:active,
 *     @keyframes, @font-face, Google Fonts – ở bề rộng máy tính, rồi đo lại ở bề
 *     rộng điện thoại để biết phần nào ẩn / xếp dọc. Kết quả gửi về bằng postMessage.
 *  3. Chuyển cây đó thành thành phần của tab Thiết kế trang. Mọi giá trị đi qua
 *     PK.normalize nên dữ liệu từ trang lạ không chèn được mã.
 *  4. AI (tuỳ chọn): gửi trọn mã HTML + CSS (+ bản chuyển tự động), đếm token,
 *     cảnh báo khi vượt độ dài ngữ cảnh của mô hình.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const PK = DE.pagekit;
  const esc = DE.esc;
  const IMP = (DE.pageImport = {});
  const toast = (m, t) => DE.ui && DE.ui.toast(m, t);
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];

  const DESK_W = 1280, DESK_H = 900, MOB_W = 390, MOB_H = 844;

  // =============================================================== FILE
  const lower = (s) => String(s).toLowerCase();
  const decodeSafe = (s) => {
    try {
      return decodeURIComponent(s);
    } catch (_) {
      return s;
    }
  };
  const cleanRef = (p) => decodeSafe(String(p || '').trim().split(/[?#]/)[0]).replace(/\\/g, '/');
  const baseName = (p) => lower(cleanRef(p).split('/').pop());
  const isHtmlName = (n) => /\.(html?|xhtml)$/i.test(n);
  const isRemote = (u) => /^(https?:)?\/\//i.test(String(u).trim());
  const isSkip = (u) => !u || /^(data:|blob:|#|mailto:|tel:|javascript:|about:)/i.test(String(u).trim());
  const absUrl = (u) => (/^\/\//.test(u) ? 'https:' + u : u);
  const MIME = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', css: 'text/css', js: 'text/javascript',
  };
  const extOf = (n) => (lower(n).match(/\.([a-z0-9]+)$/) || [])[1] || '';
  const kindOf = (ref) => (/\.(woff2?|ttf|otf|eot)$/i.test(cleanRef(ref)) ? 'font' : /\.css$/i.test(cleanRef(ref)) ? 'css' : /\.m?js$/i.test(cleanRef(ref)) ? 'js' : 'img');

  /** Túi file: tra theo đường dẫn tương đối và theo tên file */
  function makeBag(entries) {
    const bag = { files: [], byPath: new Map(), byName: new Map(), cache: new Map() };
    addToBag(bag, entries);
    return bag;
  }
  function addToBag(bag, entries) {
    for (const e of entries) {
      const file = e.file || e;
      const path = lower(String(e.path || file.webkitRelativePath || file.name).replace(/\\/g, '/').replace(/^\/+/, ''));
      if (bag.byPath.has(path)) continue;
      const it = { file, path, name: baseName(path) };
      bag.files.push(it);
      bag.byPath.set(path, it);
      if (!bag.byName.has(it.name)) bag.byName.set(it.name, it);
    }
  }
  function resolveRel(basePath, ref) {
    const parts = basePath.split('/');
    parts.pop();
    for (const seg of ref.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return lower(parts.join('/'));
  }
  function findLocal(bag, basePath, ref) {
    const raw = cleanRef(ref);
    if (!raw || isSkip(raw) || isRemote(raw)) return null;
    const p = raw.startsWith('/') ? lower(raw.slice(1)) : resolveRel(basePath, raw);
    return bag.byPath.get(p) || bag.byName.get(baseName(raw)) || null;
  }
  const readAsDataURL = (blob) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error || new Error('Không đọc được file'));
      r.readAsDataURL(blob);
    });
  /** Ảnh lớn thu nhỏ (cạnh dài ≤ 1600px) để file dự án gọn – như khi tải ảnh lên */
  async function downscale(blob, type) {
    const url = await readAsDataURL(blob);
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error('Không đọc được ảnh'));
      img.src = url;
    });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL(type === 'image/png' ? 'image/png' : 'image/jpeg', 0.86);
    return out.length < url.length ? out : url;
  }
  /** File trong túi -> data URL (có bộ nhớ đệm) */
  function fileData(bag, it, kind) {
    const key = it.path + '|' + kind;
    if (!bag.cache.has(key))
      bag.cache.set(
        key,
        (async () => {
          const type = it.file.type || MIME[extOf(it.name)] || 'application/octet-stream';
          const blob = it.file.type === type ? it.file : it.file.slice(0, it.file.size, type);
          if (kind === 'img' && /^image\/(png|jpeg|webp|bmp)$/.test(type) && it.file.size > 350e3) return downscale(blob, type).catch(() => readAsDataURL(blob));
          return readAsDataURL(blob);
        })()
      );
    return bag.cache.get(key);
  }

  /** Kéo thả: lấy cả thư mục (phải gọi ngay trong sự kiện drop) */
  IMP.entriesFromDrop = function (dt) {
    const files = [...(dt.files || [])];
    const roots = [...(dt.items || [])].filter((i) => i.kind === 'file').map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
    if (!roots.some((r) => r && r.isDirectory)) return Promise.resolve(files.map((f) => ({ file: f, path: f.name })));
    return (async () => {
      const out = [];
      for (let k = 0; k < roots.length; k++) {
        if (roots[k]) await walkEntry(roots[k], out, 0);
        else if (files[k]) out.push({ file: files[k], path: files[k].name });
      }
      return out;
    })();
  };
  async function walkEntry(entry, out, depth) {
    if (out.length > 4000 || depth > 14) return;
    if (entry.isFile) {
      const f = await new Promise((res, rej) => entry.file(res, rej)).catch(() => null);
      if (f) out.push({ file: f, path: entry.fullPath.replace(/^\/+/, '') });
      return;
    }
    if (!entry.isDirectory || /^(node_modules|\.git|\.svn|__macosx)$/i.test(entry.name)) return;
    const reader = entry.createReader();
    for (;;) {
      const batch = await new Promise((res, rej) => reader.readEntries(res, rej)).catch(() => []);
      if (!batch.length) break;
      for (const e of batch) await walkEntry(e, out, depth + 1);
    }
  }
  /** Có trang HTML (hoặc thư mục) trong gói kéo thả không */
  IMP.dropHasHtml = (dt) =>
    [...(dt.files || [])].some((f) => isHtmlName(f.name)) ||
    [...(dt.items || [])].some((i) => {
      const e = i.kind === 'file' && i.webkitGetAsEntry ? i.webkitGetAsEntry() : null;
      return !!(e && e.isDirectory);
    });

  // =============================================================== QUÉT TRƯỚC
  const URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")\s]+))\s*\)/gi;
  const IMPORT_RE = /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?([^;]*);/gi;
  // CDN trả header CORS -> đọc được luật CSS (hover, keyframes, @font-face) khi gắn crossorigin
  const CORS_CDN = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|use\.fontawesome\.com|ka-f\.fontawesome\.com|stackpath\.bootstrapcdn\.com|maxcdn\.bootstrapcdn\.com|cdn\.tailwindcss\.com|code\.jquery\.com|fonts\.bunny\.net|rsms\.me|unicons\.iconscout\.com|cdn\.materialdesignicons\.com)\//i;

  async function prescan(it, bag) {
    const text = await it.file.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const info = { it, text, title: (doc.title || '').trim(), missing: new Map(), remoteCss: [], scripts: 0, scriptKB: 0, cssKB: 0, imgs: 0, jsApp: false, tailwind: false };
    const miss = (ref, kind) => {
      const k = baseName(ref);
      if (k) info.missing.set(k, { ref: cleanRef(ref), kind });
    };
    const check = (ref, kind, from) => {
      if (isSkip(ref) || isRemote(ref) || !cleanRef(ref)) return;
      if (!findLocal(bag, from, ref)) miss(ref, kind);
    };
    const scanCss = async (css, from, depth) => {
      for (const m of css.matchAll(IMPORT_RE)) {
        const ref = m[1];
        if (isRemote(ref)) {
          info.remoteCss.push(absUrl(ref));
          continue;
        }
        const f = findLocal(bag, from, ref);
        if (!f) miss(ref, 'css');
        else if (depth < 4) {
          const t = await f.file.text();
          info.cssKB += t.length / 1024;
          await scanCss(t, f.path, depth + 1);
        }
      }
      for (const m of css.matchAll(URL_RE)) check(m[1] ?? m[2] ?? m[3], kindOf(m[1] ?? m[2] ?? m[3]), from);
    };
    for (const l of doc.querySelectorAll('link[rel~="stylesheet" i][href]')) {
      const href = l.getAttribute('href');
      if (isRemote(href)) {
        info.remoteCss.push(absUrl(href));
        continue;
      }
      const f = findLocal(bag, it.path, href);
      if (!f) {
        miss(href, 'css');
        continue;
      }
      const css = await f.file.text();
      info.cssKB += css.length / 1024;
      await scanCss(css, f.path, 0);
    }
    for (const s of doc.querySelectorAll('style')) await scanCss(s.textContent, it.path, 0);
    for (const el of doc.querySelectorAll('[style]')) await scanCss(el.getAttribute('style'), it.path, 0);
    for (const el of doc.querySelectorAll('img, source, video[poster], input[type="image" i]')) {
      const s = el.getAttribute('data-src') || el.getAttribute('src') || el.getAttribute('poster') || (el.getAttribute('srcset') || '').split(',')[0].trim().split(/\s+/)[0];
      if (!s) continue;
      info.imgs++;
      check(s, 'img', it.path);
    }
    for (const sc of doc.querySelectorAll('script')) {
      const ty = lower(sc.getAttribute('type') || '');
      if (ty && !/(javascript|module|babel|jsx|ecmascript)/.test(ty)) continue;
      info.scripts++;
      const src = sc.getAttribute('src');
      if (src) {
        if (/tailwindcss|@tailwindcss\/browser|unocss|twind/i.test(src)) info.tailwind = true;
        if (!isRemote(src)) {
          const f = findLocal(bag, it.path, src);
          if (f) info.scriptKB += f.file.size / 1024;
          else miss(src, 'js');
        }
      } else info.scriptKB += sc.textContent.length / 1024;
    }
    const bodyText = (doc.body ? doc.body.textContent : '').replace(/\s+/g, ' ').trim();
    const root = doc.querySelector('#root, #app, #__next, #__nuxt, [data-reactroot], app-root, #svelte');
    info.jsApp = info.scripts > 0 && (bodyText.length < 120 || !!(root && root.textContent.trim().length < 20) || info.tailwind);
    info.remoteCss = [...new Set(info.remoteCss)];
    return info;
  }

  // =============================================================== CHUẨN BỊ srcdoc
  async function prepare(pre, bag, opts, nonce) {
    const it = pre.it;
    const doc = new DOMParser().parseFromString(pre.text, 'text/html');
    const base = it.path;
    const dataOf = async (ref, kind, from) => {
      if (isSkip(ref)) return ref;
      if (isRemote(ref)) return absUrl(ref);
      const f = findLocal(bag, from, ref);
      return f ? fileData(bag, f, kind).catch(() => null) : null;
    };
    const cssRewrite = async (css, from, depth) => {
      // @import CSS trên máy -> chèn thẳng nội dung
      let out = css;
      for (const m of [...css.matchAll(IMPORT_RE)]) {
        const ref = m[1];
        if (isRemote(ref)) continue;
        const f = findLocal(bag, from, ref);
        const inner = f && depth < 4 ? await cssRewrite(await f.file.text(), f.path, depth + 1) : '';
        out = out.replace(m[0], m[2] && m[2].trim() ? `@media ${m[2].trim()}{${inner}}` : inner);
      }
      const map = new Map();
      for (const m of out.matchAll(URL_RE)) {
        const ref = (m[1] ?? m[2] ?? m[3] ?? '').trim();
        if (map.has(ref) || isSkip(ref)) continue;
        map.set(ref, isRemote(ref) ? absUrl(ref) : await dataOf(ref, kindOf(ref), from));
      }
      return out.replace(URL_RE, (all, a, b, c) => {
        const ref = (a ?? b ?? c ?? '').trim();
        if (!map.has(ref)) return all;
        const v = map.get(ref);
        return v ? PK.cssUrl(v) : 'url("data:,")';
      });
    };
    for (const l of [...doc.querySelectorAll('link[rel~="stylesheet" i][href]')]) {
      const href = l.getAttribute('href');
      if (isRemote(href)) {
        const u = absUrl(href);
        l.setAttribute('href', u);
        if (CORS_CDN.test(u)) l.setAttribute('crossorigin', 'anonymous');
        continue;
      }
      const f = findLocal(bag, base, href);
      if (!f) {
        l.remove();
        continue;
      }
      const st = doc.createElement('style');
      st.setAttribute('data-cc-src', f.name);
      const media = l.getAttribute('media');
      const css = await cssRewrite(await f.file.text(), f.path, 0);
      st.textContent = media && media !== 'all' ? `@media ${media}{${css}}` : css;
      l.replaceWith(st);
    }
    for (const st of doc.querySelectorAll('style:not([data-cc-src])')) st.textContent = await cssRewrite(st.textContent, base, 0);
    for (const el of doc.querySelectorAll('[style]')) el.setAttribute('style', await cssRewrite(el.getAttribute('style'), base, 0));
    // ảnh: data-src (ảnh tải chậm), srcset trên máy -> một src
    for (const img of doc.querySelectorAll('img')) {
      let src = img.getAttribute('src');
      const lazy = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original');
      if (lazy && (!src || /^data:image\/(gif|svg)/i.test(src) || /placeholder|blank|lazy|spacer/i.test(src))) src = lazy;
      const set = img.getAttribute('srcset') || img.getAttribute('data-srcset');
      if (set && !src) src = set.split(',')[0].trim().split(/\s+/)[0];
      if (set && !set.split(',').every((c) => isRemote(c.trim().split(/\s+/)[0]))) img.removeAttribute('srcset');
      img.removeAttribute('loading');
      if (!src) continue;
      const v = await dataOf(src, 'img', base);
      if (v) img.setAttribute('src', v);
      else {
        img.setAttribute('src', '');
        img.setAttribute('data-ccm', cleanRef(src));
      }
    }
    for (const s of [...doc.querySelectorAll('picture source[srcset]')]) {
      const first = s.getAttribute('srcset').split(',')[0].trim().split(/\s+/)[0];
      if (!isRemote(first)) s.remove();
    }
    for (const v of doc.querySelectorAll('video[poster]')) {
      const p = await dataOf(v.getAttribute('poster'), 'img', base);
      if (p) v.setAttribute('poster', p);
      else v.removeAttribute('poster');
    }
    for (const el of doc.querySelectorAll('input[type="image" i][src]')) {
      const p = await dataOf(el.getAttribute('src'), 'img', base);
      el.setAttribute('src', p || '');
    }
    for (const el of doc.querySelectorAll('image[href], image[xlink\\:href]')) {
      const h = el.getAttribute('href') || el.getAttribute('xlink:href');
      const p = await dataOf(h, 'img', base);
      if (p) el.setAttribute('href', p);
    }
    for (const m of [...doc.querySelectorAll('meta[http-equiv]')]) if (/content-security-policy|refresh/i.test(m.getAttribute('http-equiv'))) m.remove();
    // bản cho AI: CSS + ảnh đã nhúng, chưa động tới script
    const aiDoc = doc.cloneNode(true);
    if (!opts.runJs) {
      for (const s of [...doc.querySelectorAll('script')]) s.remove();
      for (const el of doc.querySelectorAll('*'))
        for (const a of [...el.attributes]) {
          if (/^on/i.test(a.name)) el.removeAttribute(a.name);
          else if (/^(href|src|action|formaction)$/i.test(a.name) && /^\s*javascript:/i.test(a.value)) el.setAttribute(a.name, '#');
        }
    } else {
      for (const s of [...doc.querySelectorAll('script[src]')]) {
        const src = s.getAttribute('src');
        if (isRemote(src)) {
          s.setAttribute('src', absUrl(src));
          continue;
        }
        const f = findLocal(bag, base, src);
        if (!f) {
          s.remove();
          continue;
        }
        const ns = doc.createElement('script');
        for (const a of s.attributes) if (a.name !== 'src') ns.setAttribute(a.name, a.value);
        ns.textContent = (await f.file.text()).replace(/<\/script/gi, '<\\/script');
        s.replaceWith(ns);
      }
    }
    const sc = doc.createElement('script');
    sc.textContent = `(${EXTRACTOR.toString()})(${JSON.stringify(nonce)},${!!opts.runJs},${JSON.stringify(PROPS)},${JSON.stringify(D0)},${JSON.stringify(ATTRS)});`;
    (doc.head || doc.documentElement).prepend(sc);
    return { srcdoc: '<!doctype html>\n' + doc.documentElement.outerHTML, aiDoc };
  }

  // =============================================================== ĐO ĐẠC TRONG IFRAME
  const PROPS = [
    'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'float',
    'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self', 'flex-grow', 'flex-shrink', 'flex-basis', 'row-gap', 'column-gap', 'grid-template-columns',
    'width', 'height', 'min-height', 'max-width',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'background-color', 'background-image', 'background-size', 'background-repeat', 'background-clip', '-webkit-background-clip', '-webkit-text-fill-color',
    'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-decoration-line', 'white-space', 'list-style-type',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
    'box-shadow', 'opacity', 'transform', 'translate', 'rotate', 'scale', 'visibility', 'overflow-x',
    'animation-name', 'animation-duration', 'animation-delay', 'animation-timing-function', 'animation-iteration-count', 'animation-direction', 'transition-duration', 'object-fit', 'content',
  ];
  /** Giá trị mặc định – không gửi về để gói dữ liệu nhỏ */
  const D0 = {
    top: 'auto', right: 'auto', bottom: 'auto', left: 'auto', 'z-index': 'auto', float: 'none',
    'flex-direction': 'row', 'flex-wrap': 'nowrap', 'justify-content': 'normal', 'align-items': 'normal', 'align-self': 'auto', 'flex-grow': '0', 'flex-shrink': '1', 'flex-basis': 'auto',
    'row-gap': 'normal', 'column-gap': 'normal', 'grid-template-columns': 'none', 'min-height': 'auto', 'max-width': 'none',
    'margin-top': '0px', 'margin-right': '0px', 'margin-bottom': '0px', 'margin-left': '0px', 'padding-top': '0px', 'padding-right': '0px', 'padding-bottom': '0px', 'padding-left': '0px',
    'background-color': 'rgba(0, 0, 0, 0)', 'background-image': 'none', 'background-size': 'auto', 'background-repeat': 'repeat', 'background-clip': 'border-box', '-webkit-background-clip': 'border-box',
    'text-decoration-line': 'none', 'list-style-type': 'disc',
    'border-top-width': '0px', 'border-right-width': '0px', 'border-bottom-width': '0px', 'border-left-width': '0px',
    'border-top-style': 'none', 'border-right-style': 'none', 'border-bottom-style': 'none', 'border-left-style': 'none',
    'border-top-left-radius': '0px', 'border-top-right-radius': '0px', 'border-bottom-right-radius': '0px', 'border-bottom-left-radius': '0px',
    'box-shadow': 'none', opacity: '1', transform: 'none', translate: 'none', rotate: 'none', scale: 'none', visibility: 'visible', 'overflow-x': 'visible',
    'animation-name': 'none', 'animation-duration': '0s', 'animation-delay': '0s', 'animation-timing-function': 'ease', 'animation-iteration-count': '1', 'animation-direction': 'normal',
    'transition-duration': '0s', 'object-fit': 'fill', content: 'normal',
  };
  const ATTRS = [
    'id', 'class', 'href', 'target', 'src', 'alt', 'title', 'type', 'name', 'placeholder', 'value', 'required', 'rows', 'for', 'action', 'method', 'colspan', 'role',
    'aria-label', 'aria-controls', 'aria-expanded', 'aria-haspopup', 'aria-hidden', 'data-target', 'data-bs-target', 'data-toggle', 'data-bs-toggle', 'data-collapse-toggle', 'data-drawer-target',
    'data-aos', 'data-aos-delay', 'data-aos-duration', 'data-ccm', 'poster', 'data-icon', 'data-lucide', 'data-feather', 'icon', 'name',
  ];

  /* Chạy BÊN TRONG iframe (được chuyển thành chuỗi) – không dùng biến bên ngoài hàm */
  function EXTRACTOR(NONCE, RUNJS, PROPS, D0, ATTRS) {
    var W = window, D = document, ELS = [], MAX = 9000;
    var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, LINK: 1, META: 1, TITLE: 1, BASE: 1, HEAD: 1, PARAM: 1, SOURCE: 1, TRACK: 1, MAP: 1, AREA: 1, DATALIST: 1, OPTION: 1, OPTGROUP: 1 };
    var post = function (m) {
      m.nonce = NONCE;
      try {
        parent.postMessage(m, '*');
      } catch (e) {
        /* bỏ qua */
      }
    };
    var SIDES = ['top', 'right', 'bottom', 'left'];
    function styleOf(cs) {
      var o = {};
      for (var i = 0; i < PROPS.length; i++) {
        var k = PROPS[i], v = cs.getPropertyValue(k);
        if (v === '' || v === D0[k]) continue;
        o[k] = v;
      }
      for (var j = 0; j < 4; j++) if (!o['border-' + SIDES[j] + '-width']) delete o['border-' + SIDES[j] + '-color'];
      if (o['min-height'] === '0px') delete o['min-height'];
      return o;
    }
    function attrsOf(el) {
      var o = null;
      for (var i = 0; i < ATTRS.length; i++) {
        var v = el.getAttribute(ATTRS[i]);
        if (v == null) continue;
        if (ATTRS[i] !== 'src' && v.length > 1500) v = v.slice(0, 1500);
        (o || (o = {}))[ATTRS[i]] = v;
      }
      return o;
    }
    function pseudo(el, p) {
      var cs = W.getComputedStyle(el, p), c = cs.content;
      if (!c || c === 'none' || c === 'normal' || cs.display === 'none') return null;
      return { c: c, s: styleOf(cs) };
    }
    function svgOf(el) {
      try {
        var cl = el.cloneNode(true), src = el.querySelectorAll('*'), dst = cl.querySelectorAll('*');
        var cs0 = W.getComputedStyle(el);
        var setp = function (to, cs) {
          ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'stop-color', 'stroke-linecap', 'stroke-linejoin'].forEach(function (p) {
            var v = cs.getPropertyValue(p);
            if (v && !to.getAttribute(p)) to.setAttribute(p, v);
          });
        };
        setp(cl, cs0);
        for (var i = 0; i < src.length && i < 500; i++) setp(dst[i], W.getComputedStyle(src[i]));
        // <use href="#bieu-tuong"> trỏ ra ngoài: chép phần được trỏ tới vào <defs>
        var uses = cl.querySelectorAll('use');
        for (var u = 0; u < uses.length; u++) {
          var h = uses[u].getAttribute('href') || uses[u].getAttribute('xlink:href') || '';
          if (h.charAt(0) !== '#' || cl.querySelector(h)) continue;
          var ref = D.getElementById(h.slice(1));
          if (!ref) continue;
          var defs = cl.querySelector('defs') || cl.insertBefore(D.createElementNS('http://www.w3.org/2000/svg', 'defs'), cl.firstChild);
          defs.appendChild(ref.cloneNode(true));
        }
        var r = el.getBoundingClientRect();
        cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        if (!cl.getAttribute('viewBox') && r.width) cl.setAttribute('viewBox', '0 0 ' + Math.round(r.width) + ' ' + Math.round(r.height));
        cl.setAttribute('width', Math.max(1, Math.round(r.width)));
        cl.setAttribute('height', Math.max(1, Math.round(r.height)));
        cl.removeAttribute('class');
        cl.removeAttribute('style');
        var s = new XMLSerializer().serializeToString(cl).replace(/currentColor/g, cs0.color);
        return s.length < 150000 ? s : '';
      } catch (e) {
        return '';
      }
    }
    function rec(el) {
      if (ELS.length >= MAX || SKIP[el.tagName]) return null;
      var tag = el.tagName.toLowerCase();
      var cs = W.getComputedStyle(el), r = el.getBoundingClientRect();
      var n = { i: ELS.length, t: tag, s: styleOf(cs), r: [Math.round(r.left + W.scrollX), Math.round(r.top + W.scrollY), Math.round(r.width), Math.round(r.height)] };
      el.__ci = n.i;
      ELS.push(el);
      var a = attrsOf(el);
      if (a) n.a = a;
      n.v = (cs.display !== 'none' && cs.visibility !== 'hidden' && (r.width > 0 || r.height > 0)) || cs.display === 'contents' ? 1 : 0;
      var b = pseudo(el, '::before'), af = pseudo(el, '::after');
      if (b) n.b = b;
      if (af) n.af = af;
      if (tag === 'svg') {
        n.svg = n.v ? svgOf(el) : '';
        return n;
      }
      if (tag === 'img') {
        n.src = el.currentSrc || el.getAttribute('src') || '';
        n.nw = el.naturalWidth;
        n.nh = el.naturalHeight;
        n.ok = el.complete ? (el.naturalWidth > 0 ? 1 : 0) : 2;
      }
      if (tag === 'input' || tag === 'textarea') {
        n.val = el.value;
        if (el.type === 'checkbox' || el.type === 'radio') n.chk = el.checked ? 1 : 0;
      }
      if (tag === 'select') {
        n.opts = [];
        for (var j = 0; j < el.options.length && j < 300; j++) n.opts.push(el.options[j].text);
      }
      if (/^(iframe|video|canvas|object|embed|audio)$/.test(tag)) {
        n.src = el.currentSrc || el.src || el.getAttribute('data') || '';
        if (tag === 'canvas' && n.v)
          try {
            n.png = el.toDataURL('image/png');
            if (n.png.length > 4e6) n.png = '';
          } catch (e) {
            /* canvas bị "nhiễm" ảnh khác nguồn */
          }
        return n;
      }
      var kids = [], root = el.shadowRoot && el.shadowRoot.mode === 'open' ? el.shadowRoot : el;
      for (var c = root.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) {
          var t = c.nodeValue;
          if (t) kids.push({ x: /^\s+$/.test(t) ? ' ' : t });
        } else if (c.nodeType === 1) {
          var k = rec(c);
          if (k) kids.push(k);
        }
      }
      if (kids.length) n.k = kids;
      return n;
    }
    // ---- luật CSS: :hover / :active, @keyframes, @font-face, Google Fonts
    function splitSel(s) {
      var out = [], d = 0, cur = '';
      for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        if (ch === '(' || ch === '[') d++;
        else if (ch === ')' || ch === ']') d--;
        if (ch === ',' && !d) {
          out.push(cur);
          cur = '';
        } else cur += ch;
      }
      out.push(cur);
      return out;
    }
    function absU(u, base) {
      try {
        return new URL(u, base || D.baseURI).href;
      } catch (e) {
        return u;
      }
    }
    function collectRules() {
      var hover = {}, active = {}, frames = {}, faces = [], gfonts = [], blocked = [];
      var MAP = { bg: 'background-color', c: 'color', bc: 'border-top-color', tf: 'transform', sh: 'box-shadow', op: 'opacity', tr: 'translate', sc: 'scale' };
      function norm(host, prop, v) {
        if (!host || /^(IMG|INPUT|BR|HR|SELECT|TEXTAREA|svg|SVG)$/.test(host.tagName)) host = (host && host.parentElement) || D.body;
        var pr = D.createElement('i');
        pr.style.cssText = 'position:absolute;display:block;visibility:hidden';
        pr.style.setProperty(prop, v.replace(/!\s*important/, ''));
        host.appendChild(pr);
        var out = W.getComputedStyle(pr).getPropertyValue(prop);
        host.removeChild(pr);
        return out || v;
      }
      function vals(st, host) {
        var o = null;
        for (var k in MAP) {
          var v = st.getPropertyValue(MAP[k]);
          if (!v && k === 'bg') {
            var bgv = st.getPropertyValue('background');
            if (bgv && !/url\(|gradient/.test(bgv)) v = bgv;
          }
          if (!v && k === 'bc') v = st.getPropertyValue('border-color');
          if (v) (o || (o = {}))[k] = norm(host, MAP[k] === 'border-top-color' ? 'border-top-color' : MAP[k], v);
        }
        return o;
      }
      function styleRule(r) {
        var sel = r.selectorText;
        if (!sel || !/:(hover|active)/.test(sel)) return;
        var parts = splitSel(sel);
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i].trim(), m = /:(hover|active)/.exec(p);
          if (!m) continue;
          // trạng thái phải thuộc phần cuối của bộ chọn (áp lên chính phần tử)
          var tail = p.slice(m.index).replace(/\([^)]*\)/g, '');
          if (/[\s>+~]/.test(tail)) continue;
          var base = p.replace(/:(hover|active|focus-visible|focus-within|focus)/g, '').trim() || '*';
          var els;
          try {
            els = D.querySelectorAll(base);
          } catch (e) {
            continue;
          }
          if (!els.length) continue;
          var v = vals(r.style, els[0]);
          if (!v) continue;
          var bag = m[1] === 'hover' ? hover : active;
          for (var j = 0; j < els.length && j < 4000; j++) {
            var id = els[j].__ci;
            if (id == null) continue;
            var cur = bag[id] || (bag[id] = {});
            for (var key in v) cur[key] = v[key];
          }
        }
      }
      function kf(r) {
        var out = [];
        for (var j = 0; j < r.cssRules.length; j++) {
          var k = r.cssRules[j], st = k.style;
          var v = { o: st.getPropertyValue('opacity'), tf: st.getPropertyValue('transform'), tr: st.getPropertyValue('translate'), sc: st.getPropertyValue('scale'), ro: st.getPropertyValue('rotate'), c: st.getPropertyValue('color'), bg: st.getPropertyValue('background-color') };
          k.keyText.split(',').forEach(function (t) {
            t = t.trim();
            out.push({ at: t === 'from' ? 0 : t === 'to' ? 100 : parseFloat(t), v: v });
          });
        }
        frames[r.name] = out;
      }
      function walk(rules, depth, base) {
        if (!rules || depth > 8) return;
        for (var i = 0; i < rules.length; i++) {
          var r = rules[i];
          try {
            if (r.type === 1) {
              styleRule(r);
              if (r.cssRules && r.cssRules.length) walk(r.cssRules, depth + 1, base);
            } else if (r.type === 4) {
              if (W.matchMedia(r.conditionText || r.media.mediaText).matches) walk(r.cssRules, depth + 1, base);
            } else if (r.type === 7) kf(r);
            else if (r.type === 5) {
              var src = r.style.getPropertyValue('src').replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, function (all, q, u) {
                return /^data:/i.test(u) ? all : 'url("' + absU(u, base) + '")';
              });
              faces.push({ family: r.style.getPropertyValue('font-family'), src: src, weight: r.style.getPropertyValue('font-weight'), style: r.style.getPropertyValue('font-style') });
            } else if (r.type === 3) {
              if (/fonts\.googleapis\.com/.test(r.href)) gfonts.push(absU(r.href, base));
              try {
                walk(r.styleSheet && r.styleSheet.cssRules, depth + 1, r.styleSheet && r.styleSheet.href);
              } catch (e) {
                blocked.push(absU(r.href, base));
              }
            } else if (r.cssRules) walk(r.cssRules, depth + 1, base);
          } catch (e) {
            /* luật lạ – bỏ qua */
          }
        }
      }
      for (var s = 0; s < D.styleSheets.length; s++) {
        var sh = D.styleSheets[s];
        if (sh.href && /fonts\.googleapis\.com/.test(sh.href)) gfonts.push(sh.href);
        try {
          walk(sh.cssRules, 0, sh.href || D.baseURI);
        } catch (e) {
          if (sh.href) blocked.push(sh.href);
        }
      }
      var links = D.querySelectorAll('link[href*="fonts.googleapis.com"]');
      for (var l = 0; l < links.length; l++) gfonts.push(links[l].href);
      return { hover: hover, active: active, frames: frames, faces: faces, gfonts: gfonts, blocked: blocked };
    }
    function finishAnims() {
      try {
        (D.getAnimations ? D.getAnimations() : []).forEach(function (a) {
          try {
            var t = a.effect && a.effect.getComputedTiming();
            if (t && t.iterations === Infinity) a.cancel();
            else a.finish();
          } catch (e) {
            try {
              a.cancel();
            } catch (e2) {
              /* bỏ qua */
            }
          }
        });
      } catch (e) {
        /* bỏ qua */
      }
    }
    /** Phần tử bị giấu chờ "hiện dần khi cuộn tới" (AOS, WOW, reveal…): cho hiện để đo được */
    function unhide() {
      var all = D.querySelectorAll('[data-aos], .wow, .aos-init, .reveal, .animate__animated, [class*="fade-in"], [class*="reveal"], [class*="js-anim"]');
      for (var i = 0; i < all.length && i < 4000; i++) {
        var s = all[i].style;
        s.setProperty('opacity', '1', 'important');
        s.setProperty('visibility', 'visible', 'important');
        s.setProperty('transform', 'none', 'important');
        s.setProperty('transition', 'none', 'important');
        s.setProperty('animation', 'none', 'important');
      }
    }
    function snap() {
      try {
        W.scrollTo(0, 0);
        unhide();
        finishAnims();
        var hcs = W.getComputedStyle(D.documentElement);
        var body = rec(D.body || D.documentElement);
        post({
          type: 'snap', title: D.title || '', lang: D.documentElement.lang || '', vw: D.documentElement.clientWidth || W.innerWidth, vh: D.documentElement.clientHeight || W.innerHeight,
          html: { bg: hcs.backgroundColor, bgi: hcs.backgroundImage, font: hcs.fontFamily, color: hcs.color, size: hcs.fontSize },
          body: body, rules: collectRules(), count: ELS.length, cut: ELS.length >= MAX,
        });
      } catch (e) {
        post({ type: 'error', message: String((e && e.message) || e) });
      }
    }
    function mobile() {
      var vis = [], row = [];
      for (var i = 0; i < ELS.length; i++) {
        var el = ELS[i];
        if (!el.isConnected) {
          vis.push(0);
          row.push(-1);
          continue;
        }
        var cs = W.getComputedStyle(el), r = el.getBoundingClientRect();
        var v = (cs.display !== 'none' && cs.visibility !== 'hidden' && (r.width > 0 || r.height > 0)) || cs.display === 'contents' ? 1 : 0;
        vis.push(v);
        var side = -1;
        if (v && el.children.length > 1) {
          var a = null, b = null;
          for (var c = el.firstElementChild; c; c = c.nextElementSibling) {
            var cr = c.getBoundingClientRect();
            if (!cr.width || !cr.height) continue;
            var pos = W.getComputedStyle(c).position;
            if (pos === 'absolute' || pos === 'fixed') continue;
            if (!a) a = cr;
            else {
              b = cr;
              break;
            }
          }
          if (a && b) side = Math.abs(a.top - b.top) < 4 && b.left >= a.right - 2 ? 1 : 0;
        }
        row.push(side);
      }
      return { type: 'mobile', vis: vis, row: row };
    }
    W.addEventListener('message', function (e) {
      var m = e.data;
      if (!m || m.nonce !== NONCE || e.source !== parent) return;
      if (m.cmd === 'snap') snap();
      else if (m.cmd === 'mobile') {
        finishAnims();
        post(mobile());
      }
    });
    function ready() {
      var go = function () {
        post({ type: 'ready' });
      };
      var fr = D.fonts && D.fonts.ready ? D.fonts.ready : Promise.resolve();
      Promise.race([fr, new Promise(function (r) { setTimeout(r, 3000); })]).then(function () {
        if (!RUNJS) return setTimeout(go, 60);
        // trang dựng bằng JavaScript: chờ tới khi cây phần tử thôi thay đổi
        var t = 0, fired = 0, mo = null;
        var fin = function () {
          if (fired) return;
          fired = 1;
          try {
            mo.disconnect();
          } catch (e) {
            /* bỏ qua */
          }
          go();
        };
        mo = new MutationObserver(function () {
          clearTimeout(t);
          t = setTimeout(fin, 700);
        });
        mo.observe(D.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
        t = setTimeout(fin, 900);
        setTimeout(fin, 9000);
      });
    }
    if (D.readyState === 'complete') ready();
    else W.addEventListener('load', ready);
  }

  /** Dựng srcdoc trong iframe ẩn, đo ở bề rộng máy tính rồi điện thoại */
  function snapshot(srcdoc, nonce, opts, signal) {
    return new Promise((resolve, reject) => {
      const ifr = document.createElement('iframe');
      ifr.setAttribute('sandbox', 'allow-scripts');
      ifr.setAttribute('aria-hidden', 'true');
      ifr.setAttribute('title', 'Dựng trang HTML để chuyển đổi');
      ifr.tabIndex = -1;
      // nằm trong màn hình (trình duyệt không "ngủ" khung) nhưng gần như trong suốt, không nhận chuột
      Object.assign(ifr.style, { position: 'fixed', left: '0', top: '0', width: DESK_W + 'px', height: DESK_H + 'px', opacity: '0.01', pointerEvents: 'none', zIndex: '-1', border: '0', background: '#fff' });
      let stage = 0, snap = null, t1 = 0, t2 = 0, over = false;
      const done = (err, val) => {
        if (over) return;
        over = true;
        clearTimeout(t1);
        clearTimeout(t2);
        window.removeEventListener('message', onMsg);
        if (signal) signal.removeEventListener('abort', onAbort);
        ifr.remove();
        if (err) reject(err);
        else resolve(val);
      };
      const onAbort = () => done(Object.assign(new Error('Đã huỷ'), { name: 'AbortError' }));
      const send = (cmd) => {
        try {
          ifr.contentWindow.postMessage({ cmd, nonce }, '*');
        } catch (_) {
          /* khung đã đóng */
        }
      };
      const askSnap = () => {
        if (stage !== 0) return;
        stage = 1;
        send('snap');
        t2 = setTimeout(() => done(new Error('Trang không phản hồi khi đo đạc (có thể do JavaScript của trang treo) – thử lại và tắt “Chạy JavaScript”')), 20000);
      };
      const onMsg = (e) => {
        if (e.source !== ifr.contentWindow || !e.data || e.data.nonce !== nonce) return;
        const m = e.data;
        if (m.type === 'ready') askSnap();
        else if (m.type === 'snap' && stage === 1) {
          snap = m;
          stage = 2;
          ifr.style.width = MOB_W + 'px';
          ifr.style.height = MOB_H + 'px';
          setTimeout(() => send('mobile'), 300);
        } else if (m.type === 'mobile' && stage === 2) done(null, { snap, mob: m });
        else if (m.type === 'error') done(new Error('Lỗi khi đo trang: ' + m.message));
      };
      window.addEventListener('message', onMsg);
      if (signal) signal.addEventListener('abort', onAbort);
      // trang tải chậm (ảnh, font từ mạng): quá thời gian thì đo luôn
      t1 = setTimeout(askSnap, opts.runJs ? 15000 : 9000);
      ifr.srcdoc = srcdoc;
      document.body.appendChild(ifr);
    });
  }

  // =============================================================== CHUYỂN ĐỔI
  const px = (v) => parseFloat(v) || 0;
  const r1 = (v) => Math.round(v);
  const mk = (type, props, children) => {
    const n = { id: DE.uid('c'), type, props: props || {} };
    if (PK.TYPES[type].container) n.children = children || [];
    return n;
  };
  // ---- màu: rgb()/hex trực tiếp; oklch(), color(), tên màu… qua canvas
  const colorCache = new Map();
  let cctx = null;
  function toColor(v) {
    if (v == null) return null;
    v = String(v).trim();
    if (!v || /^(transparent|none|currentcolor|inherit|initial)$/i.test(v)) return null;
    if (colorCache.has(v)) return colorCache.get(v);
    let out = PK.rgbHex(v);
    if (!out) {
      try {
        if (!cctx) {
          const c = document.createElement('canvas');
          c.width = c.height = 1;
          cctx = c.getContext('2d', { willReadFrequently: true });
        }
        cctx.fillStyle = '#010203';
        cctx.fillStyle = v;
        if (cctx.fillStyle === '#010203' && !/^#010203$/i.test(v)) out = null;
        else {
          cctx.clearRect(0, 0, 1, 1);
          cctx.fillRect(0, 0, 1, 1);
          const d = cctx.getImageData(0, 0, 1, 1).data;
          out = PK.rgbHex(`rgba(${d[0]}, ${d[1]}, ${d[2]}, ${d[3] / 255})`);
        }
      } catch (_) {
        out = null;
      }
    }
    if (out === 'transparent') out = null;
    colorCache.set(v, out);
    return out;
  }
  /** Tách theo dấu phẩy ở mức ngoài cùng (không cắt trong ngoặc) */
  function splitTop(s) {
    const out = [];
    let d = 0, cur = '';
    for (const ch of String(s)) {
      if (ch === '(') d++;
      else if (ch === ')') d--;
      if (ch === ',' && !d) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  const DIRS = { 'to top': 0, 'to top right': 45, 'to right top': 45, 'to right': 90, 'to bottom right': 135, 'to right bottom': 135, 'to bottom': 180, 'to bottom left': 225, 'to left bottom': 225, 'to left': 270, 'to top left': 315, 'to left top': 315 };
  function angleOf(s) {
    s = s.trim().toLowerCase();
    if (DIRS[s] != null) return DIRS[s];
    const m = s.match(/^(-?[\d.]+)(deg|turn|rad|grad)$/);
    if (!m) return 180;
    const v = +m[1];
    return Math.round(m[2] === 'turn' ? v * 360 : m[2] === 'rad' ? (v * 180) / Math.PI : m[2] === 'grad' ? v * 0.9 : v);
  }
  function atOf(s) {
    const m = String(s).match(/at\s+(.+)$/);
    if (!m) return 'center';
    const p = m[1].trim().split(/\s+/);
    const pos = (v, axis) => {
      if (/^(left|top)$/.test(v)) return 0;
      if (/^(right|bottom)$/.test(v)) return 100;
      if (v === 'center') return 50;
      const n = parseFloat(v);
      return /%$/.test(v) ? n : axis === 'x' ? (n / DESK_W) * 100 : (n / 600) * 100;
    };
    let x = 50, y = 50;
    if (p.length === 1) {
      if (/^(top|bottom)$/.test(p[0])) y = pos(p[0], 'y');
      else x = pos(p[0], 'x');
    } else {
      x = pos(p[0], 'x');
      y = pos(p[1], 'y');
    }
    const h = x < 34 ? 'left' : x > 66 ? 'right' : '', v = y < 34 ? 'top' : y > 66 ? 'bottom' : '';
    return [v, h].filter(Boolean).join(' ') || 'center';
  }
  /** "linear-gradient(…)" -> { kind, angle, stops } của tab Thiết kế trang */
  function parseGradient(layer) {
    const m = String(layer).match(/^(?:repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)$/i);
    if (!m) return null;
    const kind = m[1].toLowerCase();
    const args = splitTop(m[2]);
    if (!args.length) return null;
    const g = { kind, stops: [] };
    if (!toColor(args[0].replace(/\s+-?[\d.]+(%|px)(\s+-?[\d.]+(%|px))?$/, ''))) {
      const first = args.shift();
      if (kind === 'linear') g.angle = angleOf(first);
      else if (kind === 'radial') {
        g.shape = /circle/.test(first) ? 'circle' : 'ellipse';
        g.at = atOf(first);
      } else {
        g.angle = angleOf((first.match(/from\s+(\S+)/) || [])[1] || '0deg');
        g.at = atOf(first);
      }
    } else if (kind === 'linear') g.angle = 180;
    for (const a of args) {
      const mm = a.match(/^(.*?)(?:\s+(-?[\d.]+)(%|px))?(?:\s+-?[\d.]+(?:%|px))?$/);
      if (!mm) continue;
      // điểm màu trong suốt hẳn (transparent, rgba(…,0)) vẫn là một điểm của dải màu
      const raw = mm[1].trim(), rh = PK.rgbHex(raw);
      const c = rh === 'transparent' || /^transparent$/i.test(raw) ? 'rgba(0,0,0,0)' : toColor(raw);
      if (!c) continue;
      g.stops.push({ c, p: mm[2] != null && mm[3] === '%' ? +mm[2] : null });
    }
    return g.stops.length >= 2 ? g : null;
  }
  const famList = (ff) =>
    String(ff || '')
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  const BUILTIN = {
    inter: 'inter', roboto: 'roboto', montserrat: 'montserrat', nunito: 'nunito', lora: 'lora', 'playfair display': 'playfair', 'be vietnam pro': 'be-vietnam-pro',
    arial: 'arial', helvetica: 'arial', 'helvetica neue': 'arial', 'liberation sans': 'arial', verdana: 'verdana', tahoma: 'tahoma', 'trebuchet ms': 'trebuchet', georgia: 'georgia',
    'times new roman': 'times', times: 'times', consolas: 'mono', 'courier new': 'mono', courier: 'mono', menlo: 'mono', monaco: 'mono', 'sf mono': 'mono', monospace: 'mono', 'ui-monospace': 'mono',
    serif: 'georgia', 'ui-serif': 'georgia', 'system-ui': 'system', '-apple-system': 'system', blinkmacsystemfont: 'system', 'segoe ui': 'system', 'sans-serif': 'system', 'ui-sans-serif': 'system',
  };
  const EMOJI_FONT = /emoji|symbol/i;
  const ICON_FONT = /icon|awesome|material|symbols|glyph|feather|bootstrap-icons|remixicon|tabler|ionicons|boxicons|lucide|phosphor|lineicons|themify|linearicons|unicons|bxs?$/i;
  // Họ font phổ biến trên Google Fonts – font không có nguồn mà trùng tên thì mặc định đề nghị lấy từ Google
  const GOOGLE_POPULAR = new Set(
    ('poppins,open sans,lato,montserrat,raleway,oswald,source sans 3,source sans pro,pt sans,merriweather,noto sans,noto serif,ubuntu,rubik,work sans,nunito sans,quicksand,mulish,manrope,dm sans,dm serif display,' +
      'plus jakarta sans,outfit,space grotesk,josefin sans,barlow,fira sans,karla,heebo,ibm plex sans,ibm plex mono,archivo,kanit,inter tight,sora,urbanist,lexend,figtree,libre baskerville,cormorant garamond,' +
      'eb garamond,crimson text,bebas neue,anton,pacifico,dancing script,caveat,lobster,roboto slab,roboto mono,roboto condensed,jetbrains mono,fira code,space mono,source code pro,archivo black,abril fatface,' +
      'comfortaa,prompt,mukta,hind,cabin,arimo,titillium web,bitter,libre franklin,assistant,varela round,exo 2,signika,teko,righteous,lilita one,saira,chakra petch,material icons,material symbols outlined,' +
      'material symbols rounded,noto sans jp,noto sans kr,red hat display,albert sans,onest,geologica,epilogue,syne,unbounded,instrument sans,instrument serif,bricolage grotesque,young serif,fraunces,newsreader')
      .split(',')
  );

  // ---- biểu tượng -> ký tự (khi không giữ được font biểu tượng)
  const ICONS = [
    [/^(menu|bars|hamburger|navicon|burger|list|menu-2|align-justify)$/, '☰'], [/^(close|times|xmark|x|x-lg|cross|cancel)$/, '×'],
    [/^(arrow-right|arrow_forward|arrow-forward|chevron-right|angle-right|caret-right|long-arrow-right|arrow-right-long|right|east|navigate_next|arrow-narrow-right)$/, '→'],
    [/^(arrow-left|arrow_back|arrow-back|chevron-left|angle-left|caret-left|west|navigate_before)$/, '←'], [/^(arrow-up|arrow_upward|north)$/, '↑'], [/^(arrow-down|arrow_downward|south)$/, '↓'],
    [/^(chevron-down|angle-down|caret-down|expand_more|expand-more|keyboard_arrow_down)$/, '▾'], [/^(chevron-up|angle-up|caret-up|expand_less|keyboard_arrow_up)$/, '▴'],
    [/^(search|magnifying-glass|magnifier|loupe)$/, '🔍'], [/^(check|done|tick|check-circle|check_circle|circle-check|checkmark)$/, '✓'], [/^(star|star-fill|grade)$/, '★'], [/^(heart|favorite|like)$/, '♥'],
    [/^(cart|shopping-cart|shopping_cart|cart-shopping|shopping-bag|bag|basket)$/, '🛒'], [/^(user|person|account|account_circle|user-circle|profile)$/, '👤'], [/^(phone|call|telephone|phone-alt|smartphone)$/, '📞'],
    [/^(mail|envelope|email|inbox)$/, '✉'], [/^(home|house)$/, '⌂'], [/^(play|play_arrow|play-circle|play-fill)$/, '▶'], [/^(download|file-download)$/, '⬇'], [/^(upload|file-upload)$/, '⬆'],
    [/^(plus|add|add_circle)$/, '+'], [/^(minus|remove|dash)$/, '−'], [/^(info|info-circle|circle-info)$/, 'ℹ'], [/^(warning|exclamation|triangle-exclamation|alert)$/, '⚠'],
    [/^(calendar|event|calendar-days|date)$/, '📅'], [/^(clock|schedule|time|alarm)$/, '🕒'], [/^(location|map-marker|map-marker-alt|place|pin|map-pin|location-dot|location_on)$/, '📍'],
    [/^(globe|language|world|public)$/, '🌐'], [/^(lock|lock-closed)$/, '🔒'], [/^(gear|cog|settings)$/, '⚙'], [/^(share|share-alt)$/, '↗'], [/^(external-link|open_in_new|arrow-up-right|launch)$/, '↗'],
    [/^(facebook|facebook-f)$/, 'f'], [/^(twitter|x-twitter)$/, '𝕏'], [/^(linkedin|linkedin-in)$/, 'in'], [/^(youtube)$/, '▶'], [/^(instagram)$/, '◎'], [/^(github)$/, '⌥'], [/^(tiktok)$/, '♪'],
    [/^(quote|quote-left|format_quote)$/, '“'], [/^(bolt|flash|zap|lightning)$/, '⚡'], [/^(rocket|rocket_launch)$/, '🚀'], [/^(shield|shield-check|security)$/, '🛡'], [/^(sun|light_mode)$/, '☀'],
    [/^(moon|dark_mode)$/, '☾'], [/^(bell|notification|notifications)$/, '🔔'], [/^(trash|delete|bin)$/, '🗑'], [/^(edit|pen|pencil|create)$/, '✎'], [/^(copy|content_copy|clone)$/, '⧉'], [/^(link|link-2)$/, '🔗'],
    [/^(image|photo|picture)$/, '🖼'], [/^(camera|photo_camera)$/, '📷'], [/^(video|film|movie)$/, '🎬'], [/^(music|music-note)$/, '♪'], [/^(chat|comment|comments|message|forum|chat_bubble)$/, '💬'],
    [/^(send|paper-plane)$/, '➤'], [/^(gift|card_giftcard)$/, '🎁'], [/^(tag|label|local_offer)$/, '🏷'], [/^(fire|flame|whatshot)$/, '🔥'], [/^(thumbs-up|thumb_up)$/, '👍'],
    [/^(sparkles|magic|auto_awesome|wand-magic-sparkles)$/, '✨'], [/^(chart|analytics|bar-chart|chart-bar|chart-line|insights|trending_up)$/, '📊'], [/^(code|terminal)$/, '⌘'], [/^(cloud)$/, '☁'],
    [/^(leaf|eco)$/, '🍃'], [/^(coffee|mug-hot|local_cafe)$/, '☕'], [/^(book|menu_book|book-open)$/, '📖'], [/^(briefcase|work)$/, '💼'], [/^(graduation-cap|school)$/, '🎓'],
    [/^(credit-card|payments|payment|money|dollar|wallet)$/, '💳'], [/^(circle|dot)$/, '•'], [/^(users|group|people|team)$/, '👥'], [/^(lightbulb|idea|tips_and_updates)$/, '💡'], [/^(trophy|award|emoji_events)$/, '🏆'],
  ];
  const ICON_PREFIX = /^(fa[srlbdt]?|fa-solid|fa-regular|fa-brands|fa-light|fa-duotone|bi|bx|bxs|bxl|ti|ri|icon|icons|lucide|feather|ion|ionicons|las|lab|la|mdi|gg|uil|ph|lni|glyphicon|fe|tabler|material-icons|material-symbols-outlined|material-symbols-rounded|material-symbols-sharp|symbol)-?/;
  function iconChar(names) {
    for (let raw of names) {
      raw = lower(raw).trim();
      if (!raw) continue;
      const cands = [raw, raw.replace(ICON_PREFIX, ''), raw.replace(ICON_PREFIX, '').replace(/[-_](fill|line|outline|outlined|solid|regular|o|alt|round|rounded|sharp|2|circle)$/, '')];
      for (const c of cands) for (const [re, ch] of ICONS) if (re.test(c)) return ch;
    }
    return '';
  }

  /** Trạng thái chuyển đổi một trang */
  function makeX(snap, mob, G, page) {
    return {
      snap, G, page,
      mv: mob ? mob.vis : null,
      mr: mob ? mob.row : null,
      vw: snap.vw || DESK_W,
      vh: snap.vh || DESK_H,
      hover: snap.rules.hover || {},
      active: snap.rules.active || {},
      frames: snap.rules.frames || {},
      menus: [],
      fixed: [],
      toggles: [],
      elById: new Map(),
      labelFor: new Map(),
      consumed: new Set(),
      menuOf: new Map(), // id phần tử -> menu đã tạo từ khối ẩn
      anchorNodes: new Map(),
    };
  }
  const sv = (n, k) => (n && n.s && n.s[k] != null ? n.s[k] : D0[k] != null ? D0[k] : '');
  const isEl = (n) => n && n.x == null;
  const cls = (n) => lower((n.a && n.a.class) || '');
  const attr = (n, k) => (n.a && n.a[k] != null ? n.a[k] : null);
  const isAbs = (n) => /^(absolute|fixed)$/.test(sv(n, 'position'));
  // phần tử bị script "giấu" để hiện dần khi cuộn tới (AOS, WOW, reveal…): coi như đang hiện
  const isReveal = (n) => !!attr(n, 'data-aos') || /\b(wow|aos-init|reveal|fade-?in|appear|animate__animated|scroll-anim|in-?view|js-anim)\b/.test(cls(n));
  function dvis(X, n) {
    if (!isEl(n)) return true;
    if (n.v) return true;
    return false;
  }
  function mvis(X, n) {
    if (!isEl(n)) return true;
    return X.mv ? !!X.mv[n.i] : !!n.v;
  }
  const anyVis = (X, n) => dvis(X, n) || mvis(X, n);
  /** Con trực tiếp (bỏ display:contents) */
  function kidsOf(n) {
    const out = [];
    for (const k of n.k || []) {
      if (isEl(k) && sv(k, 'display') === 'contents' && !/^(button|a)$/.test(k.t)) out.push(...kidsOf(k));
      else out.push(k);
    }
    return out;
  }
  const hasText = (s) => /\S/.test(s || '');
  /** Chữ (đã gộp khoảng trắng) của một nhánh, chỉ phần đang hiện */
  function textOf(X, n) {
    if (!isEl(n)) return n.x;
    if (!anyVis(X, n) || n.t === 'svg' || /^(script|style)$/.test(n.t)) return '';
    if (n.t === 'br') return '\n';
    if (n.t === 'img') return attr(n, 'alt') || '';
    return (n.k || []).map((k) => textOf(X, k)).join('');
  }
  const collapse = (s) => s.replace(/[ \t\r\n\f]+/g, ' ');
  const INLINE_TAGS = new Set(['a', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'code', 'kbd', 'samp', 'mark', 'small', 'big', 'sup', 'sub', 'abbr', 'time', 'q', 'cite', 'label', 'br', 'font', 'var', 'dfn', 'bdi', 'bdo', 'data', 'wbr', 'tt', 'strike']);
  const ICON_CLASS = /(^|\s)(fa|fas|far|fab|fal|fad|fa-[a-z0-9-]+|bi|bi-[a-z0-9-]+|bx|bxs|bxl|bx-[a-z0-9-]+|ti|ti-[a-z0-9-]+|ri-[a-z0-9-]+|icon|icon-[a-z0-9-]+|material-icons[a-z-]*|material-symbols-[a-z]+|lucide|lucide-[a-z0-9-]+|feather|ion-[a-z0-9-]+|mdi|mdi-[a-z0-9-]+|las|lab|la-[a-z0-9-]+|ph|ph-[a-z0-9-]+|uil|uil-[a-z0-9-]+)(\s|$)/;
  /** Biểu tượng: SVG / ảnh nhỏ, hoặc <i>/<span> dùng font biểu tượng (Font Awesome, Material Icons…) */
  function isIconEl(n) {
    if (!isEl(n)) return false;
    if (n.t === 'svg') return n.r[2] <= 48 && n.r[3] <= 48;
    if (n.t === 'img') return n.r[2] <= 32 && n.r[3] <= 32;
    if (!/^(i|span|em)$/.test(n.t)) return false;
    if (!ICON_FONT.test(famList(sv(n, 'font-family'))[0] || '') && !ICON_CLASS.test(cls(n))) return false;
    const t = (n.k || []).map((k) => (isEl(k) ? '' : k.x)).join('').trim();
    return t.length <= 40 && !(n.k || []).some((k) => isEl(k) && k.t !== 'svg');
  }
  /** Tên gợi ý của một biểu tượng (class, aria-label, chữ ligature) */
  function iconNames(n) {
    const out = [];
    for (const c of cls(n).split(/\s+/)) out.push(c);
    for (const k of ['data-icon', 'data-lucide', 'data-feather', 'icon', 'name', 'aria-label', 'title']) if (attr(n, k)) out.push(...String(attr(n, k)).split(/[\s:]+/));
    const t = (n.k || []).filter((k) => !isEl(k)).map((k) => k.x).join('').trim();
    if (t && t.length < 40 && /^[a-z_]+$/.test(t)) out.push(t); // Material Icons: chữ là tên biểu tượng
    return out;
  }
  function isInline(X, n) {
    if (!isEl(n)) return true;
    if (!anyVis(X, n)) return true;
    if (n.t === 'br' || n.t === 'wbr') return true;
    if (isAbs(n)) return false;
    const d = sv(n, 'display');
    if (isIconEl(n) && /^inline/.test(d)) return true;
    if (n.t === 'img' || n.t === 'svg' || /^(input|select|textarea|button|iframe|video|canvas|table|ul|ol)$/.test(n.t)) return false;
    if (d === 'inline') return (n.k || []).every((k) => isInline(X, k));
    if (/^inline-(block|flex)$/.test(d)) return INLINE_TAGS.has(n.t) && !looksButton(n) && !boxed(n) && (n.k || []).every((k) => isInline(X, k));
    return false;
  }
  const bgColor = (n) => toColor(sv(n, 'background-color'));
  const borderW = (n) => Math.max(px(sv(n, 'border-top-width')), px(sv(n, 'border-bottom-width')), px(sv(n, 'border-left-width')), px(sv(n, 'border-right-width')));
  const hasBgImage = (n) => sv(n, 'background-image') !== 'none' && !/^(text)$/.test(sv(n, '-webkit-background-clip')) && !/^(text)$/.test(sv(n, 'background-clip'));
  const boxed = (n) => !!(bgColor(n) || hasBgImage(n) || borderW(n) > 0 || sv(n, 'box-shadow') !== 'none');
  function looksButton(n) {
    if (n.t === 'button' || attr(n, 'role') === 'button' || (n.t === 'input' && /^(submit|button|reset)$/i.test(attr(n, 'type') || ''))) return true;
    if (n.t !== 'a') return false;
    if (/\b(btn|button)\b/.test(cls(n))) return true;
    const pad = px(sv(n, 'padding-left')) + px(sv(n, 'padding-right'));
    return (!!bgColor(n) || borderW(n) > 0) && pad >= 12;
  }
  /** Phần tử chỉ chứa chữ / định dạng chữ (đoạn văn, tiêu đề, nhãn…) */
  function isTextual(X, n) {
    const kids = kidsOf(n);
    let any = false;
    for (const k of kids) {
      if (!isEl(k)) {
        if (hasText(k.x)) any = true;
        continue;
      }
      if (!anyVis(X, k)) continue;
      if (!isInline(X, k)) return false;
      if (hasText(textOf(X, k)) || isIconEl(k)) any = true;
    }
    return any;
  }
  const weight = (n) => {
    const w = sv(n, 'font-weight');
    return w === 'bold' ? 700 : w === 'normal' ? 400 : px(w) || 400;
  };

  // ---- định dạng chữ giữa câu
  function inlineOf(X, n, base) {
    let out = '';
    const pre = /^(pre|pre-wrap|pre-line|break-spaces)$/.test(sv(base, 'white-space'));
    const upper = sv(n, 'text-transform') === 'uppercase' && sv(base, 'text-transform') !== 'uppercase';
    for (const k of kidsOf(n)) {
      if (!isEl(k)) {
        let t = pre ? k.x : collapse(k.x);
        if (upper) t = t.toUpperCase();
        out += PK.escInline(t);
        continue;
      }
      if (!dvis(X, k)) continue;
      if (k.t === 'br') {
        out += '\n';
        continue;
      }
      if (isIconEl(k)) {
        const g = glyphOf(X, k);
        if (g && g.font) {
          const s = `[${PK.escInline(g.ch)}]{f:${g.font}}`;
          out += weight(k) >= 600 ? '**' + s + '**' : s;
        } else if (g) out += PK.escInline(g.ch);
        else X.G.count('inlineIcon');
        continue;
      }
      if (k.t === 'img') {
        out += PK.escInline(attr(k, 'alt') || '');
        continue;
      }
      if (/^(code|kbd|samp|tt)$/.test(k.t)) {
        const t = collapse(textOf(X, k)).replace(/`/g, "'");
        if (t.trim()) out += '`' + t + '`';
        continue;
      }
      let s = pseudoInline(X, k, 'b') + inlineOf(X, k, k) + pseudoInline(X, k, 'af');
      if (!s.trim()) {
        out += s;
        continue;
      }
      const isA = k.t === 'a' && attr(k, 'href') != null;
      if (weight(k) >= 600 && weight(n) < 600) s = PK.wrapInl(s, '**', '**');
      if (sv(k, 'font-style') === 'italic' && sv(n, 'font-style') !== 'italic') s = PK.wrapInl(s, '_', '_');
      const deco = sv(k, 'text-decoration-line'), pdeco = sv(n, 'text-decoration-line');
      if (!isA && /underline/.test(deco) && !/underline/.test(pdeco)) s = PK.wrapInl(s, '++', '++');
      if (/line-through/.test(deco) && !/line-through/.test(pdeco)) s = PK.wrapInl(s, '~~', '~~');
      if (k.t === 'mark') s = PK.wrapInl(s, '==', '==');
      const col = toColor(sv(k, 'color')), pcol = toColor(sv(n, 'color'));
      const bg = k.t === 'mark' ? null : bgColor(k);
      const fk = X.G.fontKey(sv(k, 'font-family'), weight(k));
      const fpar = X.G.fontKey(sv(n, 'font-family'), weight(n));
      const attrs = [];
      if (isA) {
        if (col && col !== X.G.primary) attrs.push(col);
        if (!/underline/.test(deco)) attrs.push('nu');
      } else if (col && col !== pcol) attrs.push(col);
      if (bg) attrs.push('bg:' + bg);
      if (fk && fk !== fpar && /^cf-/.test(fk)) attrs.push('f:' + fk);
      if (isA) {
        const href = X.G.linkHref(X, k);
        s = href ? `[${s}](${href.replace(/\)/g, '%29').replace(/\s/g, '%20')})${attrs.length ? `{${attrs.join(' ')}}` : ''}` : attrs.length ? `[${s}]{${attrs.join(' ')}}` : s;
        if (href) X.G.linkColor(col);
      } else if (attrs.length) s = `[${s}]{${attrs.join(' ')}}`;
      out += s;
    }
    return out;
  }
  const tidy = (s) =>
    s
      .replace(/ *\n */g, '\n')
      .replace(/ {2,}/g, ' ')
      .replace(/^\s+|\s+$/g, '');
  /** Chữ của ::before / ::after nằm trong dòng (dấu ngoặc kép, mũi tên, biểu tượng font…) */
  function pseudoInline(X, n, which) {
    const p = n[which];
    if (!p || /^(absolute|fixed)$/.test(p.s.position || '') || /^(block|flex|grid)$/.test(p.s.display || '')) return '';
    const c = parseContent(p.c, n);
    if (!c.text) return '';
    if (isPUA(c.text)) {
      const fam = famList(p.s['font-family'] || sv(n, 'font-family'))[0] || '';
      const fk = X.G.fontKey(p.s['font-family'] || sv(n, 'font-family'), px(p.s['font-weight']) || 400);
      if (fk && /^cf-/.test(fk) && X.G.hasSource(fam)) {
        const s = `[${PK.escInline(c.text)}]{f:${fk}}`;
        return px(p.s['font-weight']) >= 600 || weight(n) >= 600 ? '**' + s + '** ' : s + ' ';
      }
      const ch = iconChar(iconNames(n));
      return ch ? PK.escInline(ch) + ' ' : '';
    }
    return PK.escInline(c.text);
  }
  const isPUA = (s) => /[\uE000-\uF8FF]|[\u{F0000}-\u{FFFFD}]/u.test(s);
  /** Giá trị "content" của ::before / ::after -> { text, url } */
  function parseContent(c, n) {
    let text = '', url = '';
    const re = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|url\(\s*"?([^")]*)"?\s*\)|attr\(\s*([\w-]+)\s*\)|(open-quote|close-quote|counter\([^)]*\)|counters\([^)]*\))/g;
    let m;
    while ((m = re.exec(c))) {
      if (m[1] != null || m[2] != null)
        text += (m[1] != null ? m[1] : m[2]).replace(/\\([0-9a-f]{1,6})\s?/gi, (all, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\(.)/g, '$1');
      else if (m[3] != null) url = m[3];
      else if (m[4]) text += attr(n, m[4]) || '';
      else if (m[5] === 'open-quote') text += '“';
      else if (m[5] === 'close-quote') text += '”';
    }
    return { text, url };
  }
  /** Biểu tượng -> { ch, font? }: giữ font biểu tượng nếu có nguồn, không thì đổi sang ký tự gần nghĩa */
  function glyphOf(X, n) {
    if (n.t === 'svg' || n.t === 'img') {
      const ch = iconChar(iconNames(n));
      return ch ? { ch } : null;
    }
    const fam = famList(sv(n, 'font-family'))[0] || '';
    const txt = (n.k || []).filter((k) => !isEl(k)).map((k) => k.x).join('').trim();
    // Material Icons / Symbols: chữ ligature + font
    if (txt && X.G.hasSource(fam)) return { ch: txt, font: X.G.fontKey(sv(n, 'font-family'), weight(n)) };
    const p = n.b || n.af;
    if (p) {
      const c = parseContent(p.c, n).text;
      const pf = famList(p.s['font-family'] || '')[0] || fam;
      if (c && isPUA(c) && X.G.hasSource(pf)) return { ch: c, font: X.G.fontKey(p.s['font-family'] || sv(n, 'font-family'), px(p.s['font-weight']) || weight(n)) };
      if (c && !isPUA(c)) return { ch: c };
    }
    const ch = iconChar(iconNames(n));
    return ch ? { ch } : txt && !isPUA(txt) && txt.length <= 3 ? { ch: txt } : null;
  }

  // ---- thuộc tính dùng chung
  function radiusOf(n) {
    const v = sv(n, 'border-top-left-radius');
    if (/%$/.test(v)) return px(v) >= 50 ? 9999 : r1((px(v) / 100) * Math.min(n.r[2], n.r[3]));
    return r1(px(v));
  }
  function shadowOf(v) {
    if (!v || v === 'none') return null;
    let blur = 0;
    for (const layer of splitTop(v)) {
      if (/inset/.test(layer)) continue;
      const nums = layer.replace(/rgba?\([^)]*\)|#[0-9a-f]+|[a-z]+\([^)]*\)/gi, '').match(/-?[\d.]+px/g) || [];
      const b = px(nums[2] || 0) + Math.max(0, px(nums[3] || 0));
      blur = Math.max(blur, b + Math.abs(px(nums[1] || 0)));
    }
    if (!blur) return null;
    return blur < 6 ? 'sm' : blur < 26 ? 'md' : 'lg';
  }
  /** matrix(a,b,c,d,e,f) -> { rot, tx, ty, sc } */
  function parseMatrix(v) {
    const m = String(v || '').match(/^matrix\(([^)]+)\)$/);
    if (!m) return null;
    const [a, b, , , e, f] = m[1].split(',').map(Number);
    return { rot: Math.round((Math.atan2(b, a) * 180) / Math.PI), tx: Math.round(e), ty: Math.round(f), sc: Math.round(Math.hypot(a, b) * 100) };
  }
  /** Nền: màu, chuyển sắc, ảnh */
  function bgProps(X, n, P, K) {
    const c = bgColor(n);
    if (c && K.has('bg')) P.bg = c;
    const bi = sv(n, 'background-image');
    const clipText = /text/.test(sv(n, '-webkit-background-clip') + sv(n, 'background-clip'));
    if (bi !== 'none' && !clipText) {
      const layers = splitTop(bi);
      const sizes = splitTop(sv(n, 'background-size'));
      const reps = splitTop(sv(n, 'background-repeat'));
      layers.forEach((L, i) => {
        if (/^url\(/i.test(L)) {
          if (P.bgImage || !K.has('bgImage')) return;
          const u = (L.match(/^url\(\s*"?([^")]*)"?\s*\)/) || [])[1] || '';
          if (!u || u === 'data:,') return X.G.count('missingBg');
          if (!PK.safeImage(u)) return X.G.count('missingBg');
          P.bgImage = u;
          const sz = (sizes[i] || sizes[0] || 'auto').trim(), rp = (reps[i] || reps[0] || 'repeat').trim();
          P.bgSize = /contain/.test(sz) ? 'contain' : /repeat/.test(rp) && !/cover|100%/.test(sz) && !/no-repeat/.test(rp) ? 'repeat' : 'cover';
        } else if (/gradient\(/i.test(L) && !P.bgGrad && K.has('bgGrad')) {
          const g = parseGradient(L);
          if (g) P.bgGrad = g;
          X.G.count('gradient');
        }
      });
    }
  }
  function boxProps(n, P, K, opts = {}) {
    const bw = [px(sv(n, 'border-top-width')), px(sv(n, 'border-right-width')), px(sv(n, 'border-bottom-width')), px(sv(n, 'border-left-width'))];
    const max = Math.max(...bw);
    if (max > 0 && K.has('borderW')) {
      const same = bw.filter((w) => Math.abs(w - max) < 0.5).length;
      if (same >= 3) {
        P.borderW = r1(max);
        P.borderColor = toColor(sv(n, 'border-top-color')) || toColor(sv(n, 'border-bottom-color')) || '#e2e8f0';
        const st = sv(n, 'border-top-style');
        P.borderStyle = /dashed|dotted/.test(st) ? st : 'solid';
      } else opts.X && opts.X.G.count('borderSide');
    }
    const rad = radiusOf(n);
    if (rad && K.has('radius')) P.radius = Math.min(200, rad);
    const sh = shadowOf(sv(n, 'box-shadow'));
    if (sh && K.has('shadow')) P.shadow = sh;
    const op = px(sv(n, 'opacity') || 1);
    if (op < 0.99 && K.has('opacity') && !isReveal(n)) P.opacity = Math.round(op * 100);
  }
  /** Chữ: font, cỡ, màu, kiểu – chỉ ghi khi khác chữ kế thừa từ khung chứa */
  function textProps(X, n, P, K, inh, def) {
    const fk = X.G.fontKey(sv(n, 'font-family'), weight(n));
    if (K.has('font') && fk && fk !== inh.font) P.font = fk;
    const fs = px(sv(n, 'font-size'));
    if (K.has('fontSize') && fs && (def.fontSize != null || Math.abs(fs - inh.size) > 0.5)) P.fontSize = Math.round(fs);
    const col = toColor(sv(n, 'color'));
    const tfill = toColor(sv(n, '-webkit-text-fill-color'));
    if (K.has('color') && col && col !== inh.color) P.color = col;
    if (tfill && tfill !== col && K.has('color')) P.color = tfill;
    // chữ màu chuyển sắc: background-clip:text + gradient
    if (K.has('textGrad') && /text/.test(sv(n, '-webkit-background-clip') + sv(n, 'background-clip')) && /gradient/.test(sv(n, 'background-image'))) {
      const g = parseGradient(splitTop(sv(n, 'background-image')).find((l) => /gradient/.test(l)));
      if (g) {
        P.textGrad = g;
        delete P.color;
        X.G.count('gradient');
      }
    }
    if (K.has('bold')) {
      const b = weight(n) >= 600;
      if (b !== !!def.bold) P.bold = b;
    }
    if (K.has('italic') && sv(n, 'font-style') === 'italic') P.italic = true;
    if (K.has('underline') && /underline/.test(sv(n, 'text-decoration-line')) && n.t !== 'a') P.underline = true;
    if (K.has('upper') && sv(n, 'text-transform') === 'uppercase') P.upper = true;
    const ls = px(sv(n, 'letter-spacing'));
    if (K.has('letterSpacing') && Math.abs(ls) >= 0.3) P.letterSpacing = Math.round(ls * 2) / 2;
    const lh = sv(n, 'line-height');
    if (K.has('lineHeight') && fs) {
      const ratio = lh === 'normal' || !lh ? 1.2 : Math.round((px(lh) / fs) * 20) / 20;
      if (ratio >= 0.8 && ratio <= 3 && Math.abs(ratio - (def.lineHeight || 1.5)) > 0.04) P.lineHeight = ratio;
    }
    const al = alignOf(n);
    if (K.has('align') && al !== inh.align) P.align = al;
  }
  const alignOf = (n) => ({ start: 'left', left: 'left', center: 'center', right: 'right', end: 'right', justify: 'justify', '-webkit-center': 'center' })[sv(n, 'text-align')] || 'left';
  /** Hiệu ứng :hover / :active từ luật CSS */
  function fxProps(X, n, P, K) {
    if (!K.has('hoverBg')) return;
    const one = (rule, pre) => {
      if (!rule) return 0;
      let any = 0;
      const base = bgColor(n);
      const bg = toColor(rule.bg);
      if (bg && bg !== base) (P[pre + 'Bg'] = bg), any++;
      const c = toColor(rule.c);
      if (c && c !== toColor(sv(n, 'color'))) (P[pre + 'Color'] = c), any++;
      const bc = toColor(rule.bc);
      if (bc && borderW(n) > 0 && bc !== toColor(sv(n, 'border-top-color'))) (P[pre + 'Border'] = bc), any++;
      const mt = parseMatrix(rule.tf);
      let ty = mt ? mt.ty : 0, sc = mt ? mt.sc : 100;
      if (rule.tr && rule.tr !== 'none') ty = px((rule.tr.split(/\s+/)[1] || '0'));
      if (rule.sc && rule.sc !== 'none') sc = Math.round(px(rule.sc.split(/\s+/)[0]) * 100);
      if (ty) (P[pre + 'Lift'] = -ty), any++;
      if (sc && sc !== 100) (P[pre + 'Scale'] = sc), any++;
      const sh = shadowOf(rule.sh);
      if (sh && sh !== shadowOf(sv(n, 'box-shadow'))) (P[pre + 'Shadow'] = sh), any++;
      const op = rule.op !== undefined && rule.op !== '' ? px(rule.op) : null;
      if (op != null && op < 0.99) (P[pre + 'Opacity'] = Math.round(op * 100)), any++;
      return any;
    };
    const h = one(X.hover[n.i], 'hover'), a = one(X.active[n.i], 'press');
    if (h || a) {
      X.G.count('hover');
      const d = px(sv(n, 'transition-duration').split(',')[0]) * (/ms/.test(sv(n, 'transition-duration')) ? 0.001 : 1);
      if (d) P.speed = d < 0.16 ? 'fast' : d > 0.32 ? 'slow' : 'normal';
    }
    // nút: không có hiệu ứng trong CSS gốc -> tắt hiệu ứng tự động mặc định
    if (!h && K.has('action')) P.hoverBg = null;
    if (!a && K.has('action')) P.pressScale = null;
  }
  // ---- chuyển động
  const AOS = { fade: 'fade', 'fade-up': 'up', 'fade-down': 'down', 'fade-left': 'left', 'fade-right': 'right', 'slide-up': 'up', 'slide-down': 'down', 'slide-left': 'left', 'slide-right': 'right', 'flip-up': 'flip', 'flip-down': 'flip', 'flip-left': 'flip', 'flip-right': 'flip' };
  function presetByName(name) {
    const s = lower(name).replace(/^animate__/, '');
    if (/zoom-?out|zoomout/.test(s)) return 'zoom-out';
    if (/zoom|scale-?in|pop/.test(s)) return 'zoom';
    if (/flip/.test(s)) return 'flip';
    if (/bounce/.test(s) && !/in/.test(s)) return 'bounce';
    if (/pulse|heartbeat|beat/.test(s)) return 'pulse';
    if (/shake|wobble|tada|headshake|jello/.test(s)) return 'shake';
    if (/spin|rotate/.test(s)) return 'spin';
    if (/float|hover|bob|levitate/.test(s)) return 'float';
    if (/(up|bottom)/.test(s) && /(fade|slide|in|reveal|enter|show)/.test(s)) return 'up';
    if (/(down|top)/.test(s) && /(fade|slide|in|reveal|enter|show)/.test(s)) return 'down';
    if (/inleft|fromleft|left/.test(s) && /(fade|slide|in)/.test(s)) return 'right';
    if (/inright|fromright|right/.test(s) && /(fade|slide|in)/.test(s)) return 'left';
    if (/fade|appear|reveal|show/.test(s)) return 'fade';
    return null;
  }
  const EASES = { linear: 'linear', ease: 'ease', 'ease-in': 'ease-in', 'ease-out': 'ease-out', 'ease-in-out': 'ease-in-out' };
  const secs = (v) => {
    const s = String(v || '0s').split(',')[0].trim();
    return /ms$/.test(s) ? px(s) : px(s) * 1000;
  };
  /** Khung hình @keyframes -> animFrames */
  function framesFrom(list) {
    if (!list || list.length < 2) return null;
    const out = [];
    for (const f of list) {
      const v = f.v, o = { at: Math.round(f.at) };
      if (v.o !== '' && v.o != null) o.opacity = Math.round(px(v.o) * 100);
      const tf = String(v.tf || '');
      const tm = (re) => (tf.match(re) || [])[1];
      let x = 0, y = 0, sc = null, rot = null;
      const t3 = tm(/translate(?:3d)?\(([^)]+)\)/);
      if (t3) {
        const p = t3.split(',').map((s) => s.trim());
        x = /%$/.test(p[0]) ? 0 : px(p[0]);
        y = /%$/.test(p[1] || '') ? 0 : px(p[1] || 0);
      }
      if (tm(/translateX\(([^)]+)\)/)) x = px(tm(/translateX\(([^)]+)\)/));
      if (tm(/translateY\(([^)]+)\)/)) y = px(tm(/translateY\(([^)]+)\)/));
      if (tm(/scale(?:3d)?\(([^),]+)/)) sc = Math.round(px(tm(/scale(?:3d)?\(([^),]+)/)) * 100);
      if (tm(/rotate(?:Z)?\(([^)]+)\)/)) rot = angleOf(tm(/rotate(?:Z)?\(([^)]+)\)/));
      if (v.tr && v.tr !== 'none') {
        const p = v.tr.split(/\s+/);
        x = px(p[0]);
        y = px(p[1] || 0);
      }
      if (v.sc && v.sc !== 'none') sc = Math.round(px(v.sc) * 100);
      if (v.ro && v.ro !== 'none') rot = angleOf(v.ro);
      const mt = parseMatrix(tf);
      if (mt) {
        x = mt.tx;
        y = mt.ty;
        sc = mt.sc;
        rot = mt.rot;
      }
      if (x) o.x = x;
      if (y) o.y = y;
      if (sc != null) o.scale = sc;
      if (rot) o.rotate = rot;
      const c = toColor(v.c);
      if (c) o.color = c;
      const bg = toColor(v.bg);
      if (bg) o.bg = bg;
      out.push(o);
    }
    return out.length >= 2 ? out : null;
  }
  function animProps(X, n, P, K) {
    if (!K.has('anim')) return;
    const aos = attr(n, 'data-aos');
    if (aos) {
      const k = AOS[aos] || presetByName(aos) || 'fade';
      Object.assign(P, { anim: k, animOn: 'scroll', animDur: px(attr(n, 'data-aos-duration')) || 700, animDelay: px(attr(n, 'data-aos-delay')) || 0, animEase: 'ease-out' });
      return X.G.count('anim');
    }
    const c = cls(n);
    const ac = c.match(/\banimate__([a-z]+)\b/i) || (/\banimated\b/.test(c) ? c.match(/\b(fadeIn\w*|slideIn\w*|zoomIn\w*|bounce\w*|pulse|flipIn\w*|shake\w*|tada|swing|heartBeat|rubberBand)\b/i) : null);
    if (ac) {
      const k = presetByName(ac[1]);
      if (k) {
        Object.assign(P, { anim: k, animOn: /\bwow\b/.test(c) ? 'scroll' : 'load', animLoop: /\b(animate__)?infinite\b/.test(c) });
        return X.G.count('anim');
      }
    }
    const name = sv(n, 'animation-name').split(',')[0].trim();
    if (name && name !== 'none') {
      const fr = framesFrom(X.frames[name]);
      const pre = presetByName(name);
      const it = sv(n, 'animation-iteration-count').split(',')[0].trim();
      Object.assign(P, {
        anim: fr && !(pre && ['bounce', 'pulse', 'shake', 'spin', 'float'].includes(pre)) ? 'custom' : pre || (fr ? 'custom' : 'fade'),
        animDur: Math.max(50, Math.round(secs(sv(n, 'animation-duration')) || 700)),
        animDelay: Math.max(0, Math.round(secs(sv(n, 'animation-delay')))),
        animEase: EASES[sv(n, 'animation-timing-function').split(',')[0].trim()] || (/cubic-bezier\([^)]*1\.[0-9]/.test(sv(n, 'animation-timing-function')) ? 'spring' : 'ease'),
        animLoop: it === 'infinite',
        animAlt: /alternate/.test(sv(n, 'animation-direction')),
      });
      if (P.anim === 'custom') P.animFrames = fr;
      return X.G.count('anim');
    }
    if (isReveal(n) && px(sv(n, 'opacity')) < 0.05) {
      Object.assign(P, { anim: 'up', animOn: 'scroll' });
      X.G.count('anim');
    }
  }
  /** Dịch / xoay của phần tử nằm theo bố cục */
  function transformProps(n, P, K) {
    if (!K.has('rotate')) return;
    const mt = parseMatrix(sv(n, 'transform'));
    let rot = mt ? mt.rot : 0;
    if (sv(n, 'rotate') !== 'none') rot = angleOf(sv(n, 'rotate').split(/\s+/).pop());
    if (rot && !isReveal(n)) P.rotate = rot;
    if (mt && (mt.tx || mt.ty) && !isReveal(n) && !isAbs(n)) {
      if (mt.tx) P.shiftX = mt.tx;
      if (mt.ty) P.shiftY = mt.ty;
    }
  }
  /** Mã neo: phần tử có id được liên kết tới (#id) */
  function anchorProp(X, n, node) {
    const id = attr(n, 'id');
    if (!id || !X.G.anchorRefs.has(id) || !PK.TYPES[node.type].keys.has('anchorId')) return;
    const slug = PK.slug(id, 60);
    if (slug && !X.anchorNodes.has(slug)) {
      node.props.anchorId = slug;
      X.anchorNodes.set(slug, node.id);
    }
  }

  /** Vị trí tự do theo khung chứa (rect của khung trong model) */
  function absProps(X, n, P, box, rectOverride) {
    const fixed = sv(n, 'position') === 'fixed';
    const r = rectOverride || n.r;
    const bx = fixed ? [0, 0, X.vw, X.vh] : box;
    // kích thước chưa xoay (rect đã tính cả transform)
    const w = px(sv(n, 'width')) || r[2], h = px(sv(n, 'height')) || r[3];
    const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
    const L = cx - w / 2 - bx[0], T = cy - h / 2 - bx[1], R = bx[0] + bx[2] - (cx + w / 2), B = bx[1] + bx[3] - (cy + h / 2);
    P.pos = fixed ? 'fixed' : 'absolute';
    if (Math.abs(cx - (bx[0] + bx[2] / 2)) < 2 && w < bx[2] - 4) {
      P.posLeft = '50%';
      P.shiftX = '-50%';
    } else if (Math.abs(L) < 1.5 && Math.abs(R) < 1.5) {
      P.posLeft = 0;
      P.posRight = 0;
    } else if (R < L) P.posRight = r1(R);
    else P.posLeft = r1(L);
    if (Math.abs(T) < 1.5 && Math.abs(B) < 1.5 && !fixed) {
      P.posTop = 0;
      P.posBottom = 0;
    } else if (B < T && (fixed || bx[3] > 0)) P.posBottom = r1(B);
    else P.posTop = r1(T);
    const z = sv(n, 'z-index');
    if (z !== 'auto' && z !== '') P.zIndex = Math.max(-100, Math.min(9999, parseInt(z, 10) || 0));
    X.G.count('abs');
  }

  // ---- các loại thành phần
  function headingOrText(X, n, C, extra = {}) {
    const isH = /^h[1-6]$/.test(n.t);
    const type = isH ? 'heading' : 'text';
    const K = PK.TYPES[type].keys;
    let text = tidy(pseudoInline(X, n, 'b') + inlineOf(X, n, n) + pseudoInline(X, n, 'af'));
    if (!text) return null;
    const P = Object.assign({ text }, extra);
    if (isH) P.level = n.t.slice(1);
    const def = isH ? { bold: true, lineHeight: 1.25, fontSize: 1 } : { bold: false, lineHeight: 1.6 };
    textProps(X, n, P, K, C.inh, def);
    // nền & khoảng đệm của chính đoạn chữ
    const bg = bgColor(n);
    if (bg) P.bg = bg;
    bgProps(X, n, P, new Set(['bgGrad']));
    const pt = px(sv(n, 'padding-top')), pb = px(sv(n, 'padding-bottom')), pl = px(sv(n, 'padding-left')), pr = px(sv(n, 'padding-right'));
    if (bg || P.bgGrad || pt + pb + pl + pr > 0) {
      if (pt + pb) P.padY = r1((pt + pb) / 2);
      if (pl + pr) P.padX = r1((pl + pr) / 2);
      const rad = radiusOf(n);
      if (rad) P.radius = Math.min(200, rad);
    }
    // chữ hẹp hơn khung (max-width)
    const mw = sv(n, 'max-width');
    if (mw !== 'none' && px(mw) && px(mw) < C.cw - 4) P.maxW = r1(px(mw));
    return mk(type, P);
  }
  function shapeFrom(X, n, C, opts = {}) {
    const K = PK.TYPES.shape.keys;
    const P = { text: opts.text || '', w: null, h: null, bg: 'transparent', radius: 0 };
    bgProps(X, n, P, K);
    boxProps(n, P, K, { X });
    const w = px(sv(n, 'width')) || n.r[2], h = px(sv(n, 'height')) || n.r[3];
    if (opts.autoSize) {
      P.w = null;
      P.h = null;
    } else {
      P.w = C && Math.abs(w - C.cw) < 2 && !opts.abs ? '100%' : r1(w);
      P.h = r1(h);
    }
    if (P.radius >= Math.min(w, h) / 2 - 1 && P.radius > 0) {
      P.round = true;
      delete P.radius;
    }
    const pt = px(sv(n, 'padding-top')), pb = px(sv(n, 'padding-bottom')), pl = px(sv(n, 'padding-left')), pr = px(sv(n, 'padding-right'));
    if (pt + pb) P.padY = r1((pt + pb) / 2);
    if (pl + pr) P.padX = r1((pl + pr) / 2);
    if (opts.text) textProps(X, n, P, K, C ? C.inh : X.G.inh0, { bold: false, lineHeight: 1.3 });
    return mk('shape', P);
  }
  function linkTarget(X, n) {
    const href = attr(n, 'href');
    if (href == null) return null;
    return X.G.resolveLink(X, href);
  }
  function buttonFrom(X, n, C) {
    const K = PK.TYPES.button.keys;
    let icon = '', iconPos = 'after';
    const parts = kidsOf(n).filter((k) => !isEl(k) || anyVis(X, k));
    const firstEl = parts.find((k) => !isEl(k) ? hasText(k.x) : true);
    const lastEl = [...parts].reverse().find((k) => !isEl(k) ? hasText(k.x) : true);
    let text = '';
    for (const k of parts) {
      if (isEl(k) && (isIconEl(k) || (k.t === 'img' && k.r[2] <= 40))) {
        // trong nút chỉ nhận ký tự thường: font biểu tượng / ligature -> ký tự gần nghĩa
        const g = glyphOf(X, k);
        const ch = g && !g.font && !isPUA(g.ch) && [...g.ch].length <= 4 ? g.ch : iconChar(iconNames(k));
        if (ch && !icon) {
          icon = ch;
          iconPos = k === firstEl && k !== lastEl ? 'before' : 'after';
        } else if (!ch) X.G.count('inlineIcon');
        continue;
      }
      text += isEl(k) ? textOf(X, k) : k.x;
    }
    // ::before / ::after có chữ (mũi tên…) -> biểu tượng
    for (const [w, pos] of [['b', 'before'], ['af', 'after']]) {
      if (icon || !n[w]) continue;
      const c = parseContent(n[w].c, n).text.trim();
      if (c && [...c].length <= 3 && !isPUA(c)) {
        icon = c;
        iconPos = pos;
      } else if (c && isPUA(c)) {
        const ch = iconChar(iconNames(n));
        if (ch) {
          icon = ch;
          iconPos = pos;
        }
      }
    }
    text = collapse(n.t === 'input' ? attr(n, 'value') || n.val || 'Gửi' : text).trim();
    if (sv(n, 'text-transform') === 'uppercase') text = text.toUpperCase();
    const bg = bgColor(n), bw = borderW(n);
    const P = { text: text.slice(0, 300), variant: bg ? 'solid' : bw ? 'outline' : 'ghost', bg: bg || 'transparent' };
    if (icon) Object.assign(P, { icon, iconPos });
    bgProps(X, n, P, new Set(['bgGrad']));
    boxProps(n, P, K, { X });
    if (!bw) P.borderW = 0;
    textProps(X, n, P, K, { font: C.inh.font, size: -1, color: null, align: 'center' }, { bold: true, fontSize: 1 });
    if (!P.color) P.color = toColor(sv(n, 'color')) || '#0f172a';
    P.padY = r1((px(sv(n, 'padding-top')) + px(sv(n, 'padding-bottom'))) / 2);
    P.padX = r1((px(sv(n, 'padding-left')) + px(sv(n, 'padding-right'))) / 2);
    if (!P.radius) P.radius = 0;
    if (P.align === 'center') delete P.align;
    // độ rộng
    if (C.kind !== 'row' && n.r[2] >= C.cw - 3 && C.cw > 0) P.widthMode = 'full';
    else placeProp(n, P, C);
    // hành động
    const href = attr(n, 'href');
    const target = toggleTarget(n);
    const inForm = C.inForm;
    if (n.t === 'a' && href != null && !/^\s*javascript:/i.test(href) && !target) {
      const lk = linkTarget(X, n);
      Object.assign(P, { action: 'link' }, lk || { linkKind: 'url', url: '' });
      if (attr(n, 'target') === '_blank') P.newTab = true;
    } else if ((n.t === 'button' || n.t === 'input') && inForm && !/^(button|reset)$/i.test(attr(n, 'type') || '') && !target) {
      Object.assign(P, { action: 'submit', submitKind: 'form' });
    } else {
      Object.assign(P, { action: 'link', linkKind: 'url', url: '' });
      if (!target) X.G.count('jsButton');
    }
    fxProps(X, n, P, K);
    const node = mk('button', P);
    if (target || isBurger(X, n)) X.toggles.push({ node, target, n });
    X.G.count('button');
    if (P.bg && P.bg !== 'transparent') X.G.btnColor(P.bg);
    return node;
  }
  function toggleTarget(n) {
    const t = attr(n, 'aria-controls') || attr(n, 'data-target') || attr(n, 'data-bs-target') || attr(n, 'data-collapse-toggle') || attr(n, 'data-drawer-target');
    return t ? t.replace(/^#/, '').split(/\s+/)[0] : null;
  }
  const isBurger = (X, n) => /\b(burger|hamburger|nav-?toggle|menu-?toggle|menu-?btn|navbar-toggler|mobile-menu-button|toggle-menu|menu-icon)\b/.test(cls(n)) || /menu|điều hướng|navigation/i.test(attr(n, 'aria-label') || '') || iconChar(iconNames(n)) === '☰';

  function imageFrom(X, n, C) {
    let k = n;
    if (n.t === 'picture') k = (n.k || []).find((x) => isEl(x) && x.t === 'img') || n;
    let src = k.src || attr(k, 'src') || '';
    const missing = attr(k, 'data-ccm');
    if (!PK.safeImage(src) || /^about:/.test(src)) src = '';
    const broken = !src || k.ok === 0;
    const P = { src: broken && !isRemote(src) ? '' : src, alt: attr(k, 'alt') || attr(k, 'title') || '' };
    if (broken) X.G.badImage(missing || src || attr(k, 'alt') || 'ảnh', X.page);
    const w = n.r[2], h = n.r[3];
    if (C.kind !== 'row' && Math.abs(w - C.cw) < 3) P.widthMode = 'full';
    else Object.assign(P, { widthMode: 'fixed', width: Math.max(1, r1(w)) });
    const fit = sv(k, 'object-fit');
    const natH = k.nw ? (w * k.nh) / k.nw : h;
    if (/cover|contain/.test(fit) || (k.nw && Math.abs(natH - h) > 3)) Object.assign(P, { height: r1(h), fit: fit === 'contain' ? 'contain' : 'cover' });
    else P.height = 0;
    boxProps(k, P, PK.TYPES.image.keys, { X });
    if (!P.radius) P.radius = 0;
    placeProp(n, P, C);
    const node = mk('image', P);
    if (broken) X.G.track(node, missing || src);
    return node;
  }
  /** Vị trí ngang của thành phần hẹp trong khung dọc */
  function placeProp(n, P, C) {
    if (C.kind === 'row' || !C.box || P.widthMode === 'full') return;
    const left = n.r[0] - C.cx0, right = C.cx0 + C.cw - (n.r[0] + n.r[2]);
    const want = Math.abs(left - right) < 3 ? 'center' : right < left ? 'end' : 'start';
    const inherited = C.inh.align === 'center' ? 'center' : C.inh.align === 'right' ? 'end' : 'start';
    if (want !== inherited) P.place = want;
  }
  function svgFrom(X, n, C) {
    if (!n.svg) return null;
    let b64;
    try {
      b64 = btoa(unescape(encodeURIComponent(n.svg)));
    } catch (_) {
      return null;
    }
    const P = { src: 'data:image/svg+xml;base64,' + b64, alt: attr(n, 'aria-label') || attr(n, 'title') || '', widthMode: 'fixed', width: Math.max(1, r1(n.r[2])), height: 0, radius: 0 };
    placeProp(n, P, C);
    X.G.count('svg');
    return mk('image', P);
  }
  function mediaFrom(X, n, C) {
    let src = '', alt = n.t === 'video' ? 'Video' : n.t === 'audio' ? 'Âm thanh' : 'Nội dung nhúng';
    if (n.t === 'canvas' && n.png) src = n.png;
    else if (n.t === 'video' && attr(n, 'poster')) src = attr(n, 'poster');
    else if (n.t === 'iframe') {
      const yt = String(n.src || attr(n, 'src') || '').match(/(?:youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\/)([\w-]{6,})/);
      if (yt) {
        src = `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;
        alt = 'Video YouTube';
      } else alt = 'Khung nhúng: ' + String(n.src || '').slice(0, 80);
    }
    if (n.t !== 'canvas') X.G.count('media');
    const P = { src: PK.safeImage(src) ? src : '', alt, widthMode: Math.abs(n.r[2] - C.cw) < 3 ? 'full' : 'fixed', width: Math.max(1, r1(n.r[2])), height: r1(n.r[3]), fit: 'cover' };
    boxProps(n, P, PK.TYPES.image.keys, { X });
    return mk('image', P);
  }
  function dividerFrom(X, n, C) {
    const bt = px(sv(n, 'border-top-width')), bb = px(sv(n, 'border-bottom-width'));
    const th = bt || bb || n.r[3] || 1;
    const col = toColor(sv(n, bt ? 'border-top-color' : 'border-bottom-color')) || bgColor(n) || '#e2e8f0';
    const st = sv(n, bt ? 'border-top-style' : 'border-bottom-style');
    return mk('divider', { kind: 'hr', thickness: Math.max(1, Math.min(20, r1(th))), lineColor: col, lineStyle: /dashed|dotted/.test(st) ? st : 'solid', length: C.cw ? Math.max(5, Math.min(100, Math.round((n.r[2] / C.cw) * 100))) : 100, marginY: 0 });
  }
  function tableFrom(X, n, C) {
    const rows = [];
    let header = false, firstTh = null, td = null;
    const walk = (x, inHead) => {
      for (const k of kidsOf(x)) {
        if (!isEl(k) || !anyVis(X, k)) continue;
        if (/^(thead|tbody|tfoot)$/.test(k.t)) walk(k, k.t === 'thead');
        else if (k.t === 'tr') {
          const cells = [];
          let allTh = true;
          for (const c of kidsOf(k)) {
            if (!isEl(c) || !/^(td|th)$/.test(c.t)) continue;
            if (c.t !== 'th') allTh = false;
            if (c.t === 'th' && !firstTh) firstTh = c;
            if (c.t === 'td' && !td) td = c;
            cells.push(tidy(inlineOf(X, c, c)));
            for (let s = 1; s < Math.min(30, +(attr(c, 'colspan') || 1)); s++) cells.push('');
          }
          if (!rows.length && (inHead || allTh)) header = true;
          if (cells.length) rows.push(cells);
        }
      }
    };
    walk(n, false);
    if (!rows.length) return null;
    const P = { rows, header, full: n.r[2] >= C.cw - 4 };
    const cell = td || firstTh;
    if (cell) {
      const bb = px(sv(cell, 'border-bottom-width')), br = px(sv(cell, 'border-right-width')) || px(sv(cell, 'border-left-width'));
      P.lines = bb && br ? 'all' : bb || px(sv(cell, 'border-top-width')) ? 'rows' : 'none';
      P.borderColor = toColor(sv(cell, bb ? 'border-bottom-color' : 'border-top-color')) || '#e2e8f0';
      const pad = (px(sv(cell, 'padding-top')) + px(sv(cell, 'padding-left'))) / 2;
      P.cellPad = pad < 8 ? 'sm' : pad < 13 ? 'md' : 'lg';
      P.align = alignOf(cell);
    }
    if (firstTh) {
      P.headBg = bgColor(firstTh) || 'transparent';
      P.headColor = toColor(sv(firstTh, 'color')) || '#0f172a';
    }
    P.hoverRow = false;
    textProps(X, n, P, PK.TYPES.table.keys, C.inh, { bold: false });
    delete P.bold;
    boxProps(n, P, PK.TYPES.table.keys, { X });
    return mk('table', P);
  }
  function listFrom(X, n, C) {
    const lis = kidsOf(n).filter((k) => isEl(k) && k.t === 'li' && anyVis(X, k));
    const items = [];
    let marker = { decimal: 'number', 'decimal-leading-zero': 'number', 'lower-alpha': 'number', 'upper-alpha': 'number', 'lower-roman': 'number', 'upper-roman': 'number', none: 'none' }[sv(lis[0] || n, 'list-style-type')] || 'disc';
    let prefix = '';
    const b = lis[0] && lis[0].b;
    if (marker === 'none' && b) {
      const c = parseContent(b.c, lis[0]).text.trim();
      if (/^[✓✔✅☑]$/.test(c)) marker = 'check';
      else if (c && !isPUA(c) && [...c].length <= 3) prefix = c + ' ';
      else if (c && isPUA(c)) {
        marker = 'check';
        X.G.count('pseudo');
      }
    }
    for (const li of lis) items.push(PK.escInline(prefix) + tidy(inlineOf(X, li, li) + pseudoInline(X, li, 'af')));
    const P = { items, marker };
    const g = gapOf(lis, 'y');
    P.gap = g == null ? 6 : Math.min(300, g);
    textProps(X, lis[0] || n, P, PK.TYPES.list.keys, C.inh, { bold: false, lineHeight: 1.6 });
    if (marker === 'none' || marker === 'check') P.padX = 0;
    return mk('list', P);
  }
  /** Ô nhập / hộp chọn / ô đánh dấu */
  function fieldFrom(X, n, C, labelText) {
    const ty = lower(attr(n, 'type') || (n.t === 'textarea' ? 'textarea' : 'text'));
    if (n.t === 'input' && /^(hidden)$/.test(ty)) return null;
    if (n.t === 'input' && /^(submit|button|reset|image)$/.test(ty)) return buttonFrom(X, n, C);
    let label = labelText != null ? labelText : '';
    if (!label && attr(n, 'id') && X.labelFor.has(attr(n, 'id'))) {
      const l = X.labelFor.get(attr(n, 'id'));
      label = collapse(textOf(X, l)).trim();
      X.consumed.add(l.i);
    }
    if (!label) label = attr(n, 'aria-label') || attr(n, 'title') || '';
    const name = (attr(n, 'name') || '').replace(/[^A-Za-z0-9_.[\]-]/g, '').slice(0, 60);
    const common = { required: attr(n, 'required') != null, fieldName: name };
    if (n.t === 'input' && /^(checkbox|radio)$/.test(ty)) {
      if (ty === 'radio') X.G.count('radio');
      return mk('checkbox', Object.assign({ label: label || 'Lựa chọn', checked: !!n.chk }, common));
    }
    const P = Object.assign({ label: label || '', placeholder: attr(n, 'placeholder') || '' }, common);
    let type = 'input';
    if (n.t === 'select') {
      type = 'select';
      P.options = (n.opts || []).slice(0, 300);
      delete P.placeholder;
    } else if (n.t === 'textarea') Object.assign(P, { inputType: 'textarea', lineCount: Math.max(2, Math.min(20, +(attr(n, 'rows') || 4))) });
    else P.inputType = { email: 'email', tel: 'tel', number: 'number', password: 'password', date: 'date' }[ty] || 'text';
    if (!/^(text|email|tel|number|password|date|search|url|textarea)$/.test(ty) && n.t === 'input') X.G.count('fieldType');
    const fb = bgColor(n);
    if (fb) P.fieldBg = fb;
    const fbc = toColor(sv(n, 'border-top-color'));
    if (fbc && borderW(n)) P.fieldBorder = fbc;
    P.fieldRadius = Math.min(40, radiusOf(n));
    const col = toColor(sv(n, 'color'));
    if (col && col !== C.inh.color) P.color = col;
    const mw = n.r[2];
    if (mw && mw < C.cw - 8) P.maxW = r1(mw);
    return mk(type, P);
  }
  /** Biểu mẫu nằm trong nhãn: <label>Họ tên <input></label> */
  function labelWrap(X, n, C) {
    const ctl = (function find(x) {
      for (const k of kidsOf(x)) {
        if (!isEl(k)) continue;
        if (/^(input|select|textarea)$/.test(k.t)) return k;
        const f = find(k);
        if (f) return f;
      }
      return null;
    })(n);
    if (!ctl) return null;
    const txt = collapse(
      (n.k || [])
        .map(function t(k) {
          return !isEl(k) ? k.x : k === ctl || /^(input|select|textarea)$/.test(k.t) ? '' : (k.k || []).map(t).join('');
        })
        .join('')
    ).trim();
    return fieldFrom(X, ctl, C, txt);
  }

  // ---- khoảng cách & bố cục
  function gapOf(list, axis) {
    const rs = list.filter((k) => isEl(k) && k.v && (k.r[2] || k.r[3]) && !isAbs(k)).map((k) => k.r);
    if (rs.length < 2) return null;
    const g = [];
    if (axis === 'y') {
      rs.sort((a, b) => a[1] - b[1]);
      for (let i = 1; i < rs.length; i++) g.push(rs[i][1] - (rs[i - 1][1] + rs[i - 1][3]));
    } else {
      rs.sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < rs.length; i++) if (Math.abs(rs[i][1] - rs[i - 1][1]) < Math.max(rs[i - 1][3], 4)) g.push(rs[i][0] - (rs[i - 1][0] + rs[i - 1][2]));
    }
    const ok = g.filter((x) => x > -2).sort((a, b) => a - b);
    return ok.length ? Math.max(0, Math.round(ok[Math.floor(ok.length / 2)])) : null;
  }
  /** Nhóm các phần tử theo dòng hiển thị */
  function groupLines(els) {
    const vis = els.filter((k) => isEl(k) && k.v && k.r[2] + k.r[3] > 0).sort((a, b) => a.r[1] - b.r[1] || a.r[0] - b.r[0]);
    const lines = [];
    for (const k of vis) {
      const line = lines.find((L) => {
        const top = Math.min(...L.map((x) => x.r[1])), bot = Math.max(...L.map((x) => x.r[1] + x.r[3]));
        return k.r[1] < bot - 2 && k.r[1] + k.r[3] > top + 2;
      });
      if (line) line.push(k);
      else lines.push([k]);
    }
    for (const L of lines) L.sort((a, b) => a.r[0] - b.r[0]);
    return lines;
  }
  function trackCount(v) {
    if (!v || v === 'none') return 1;
    return String(v).replace(/\[[^\]]*\]/g, '').trim().split(/\s+/).filter((t) => /px$/.test(t)).length || 1;
  }
  const contentW = (n) => Math.max(0, n.r[2] - px(sv(n, 'padding-left')) - px(sv(n, 'padding-right')) - px(sv(n, 'border-left-width')) - px(sv(n, 'border-right-width')));
  const VA = { 'flex-start': 'top', start: 'top', 'self-start': 'top', center: 'center', 'flex-end': 'bottom', end: 'bottom', 'self-end': 'bottom', stretch: 'stretch', normal: 'stretch', baseline: 'center' };
  const JU = { 'flex-start': 'start', start: 'start', normal: 'start', left: 'start', center: 'center', 'flex-end': 'end', end: 'end', right: 'end', 'space-between': 'between', 'space-around': 'around', 'space-evenly': 'around' };

  /** Ngữ cảnh khung chứa cho con */
  function ctxFor(X, n, kind, inh, extra = {}) {
    const cw = contentW(n);
    return Object.assign({ kind, inh, cw, cx0: n.r[0] + px(sv(n, 'padding-left')) + px(sv(n, 'border-left-width')), box: n.r, dV: dvis(X, n), mV: mvis(X, n), inForm: false, node: n }, extra);
  }
  /** Chữ kế thừa cho con của section / col (khung có nhóm "Chữ bên trong") */
  function innerText(X, n, P, K, inh) {
    const out = Object.assign({}, inh);
    if (!K.has('color')) return out;
    const col = toColor(sv(n, 'color'));
    if (col && col !== inh.color) (P.color = col), (out.color = col);
    const fk = X.G.fontKey(sv(n, 'font-family'), weight(n));
    if (fk && fk !== inh.font) (P.font = fk), (out.font = fk);
    const fs = Math.round(px(sv(n, 'font-size')));
    if (fs && Math.abs(fs - inh.size) > 0.5) (P.fontSize = fs), (out.size = fs);
    const al = alignOf(n);
    if (al !== inh.align && K.has('align')) (P.align = al), (out.align = al);
    return out;
  }
  /** Khoảng đệm trên/dưới đo từ vị trí con thật (gồm cả margin của con) */
  function padYMeasured(n, flow, stretched) {
    const els = flow.filter((k) => isEl(k) && k.v && !isAbs(k) && k.r[3] > 0);
    if (!els.length) return r1((px(sv(n, 'padding-top')) + px(sv(n, 'padding-bottom'))) / 2);
    const top = Math.min(...els.map((k) => k.r[1])), bot = Math.max(...els.map((k) => k.r[1] + k.r[3]));
    const bt = px(sv(n, 'border-top-width')), bb = px(sv(n, 'border-bottom-width'));
    const a = Math.max(0, top - n.r[1] - bt), b = Math.max(0, n.r[1] + n.r[3] - bb - bot);
    // thẻ bị kéo cao bằng nhau trong hàng: phần dư phía dưới không phải khoảng đệm
    return r1(stretched ? Math.min(a, b) : (a + b) / 2);
  }

  /** Chuyển danh sách con của một khung (theo thứ tự) */
  function convKids(X, list, C) {
    const out = [];
    let run = []; // các mẩu chữ / phần tử trong dòng nằm lẫn giữa các khối
    const flushRun = () => {
      if (!run.length) return;
      const host = C.node || { s: {} };
      const text = tidy(inlineOf(X, { k: run, s: host.s }, host));
      run = [];
      if (!text) return;
      const P = { text };
      // khung không truyền kiểu chữ cho con (hàng) -> đoạn chữ tự mang kiểu
      if (C.node) textProps(X, C.node, P, PK.TYPES.text.keys, C.inh, { bold: false, lineHeight: 1.6 });
      out.push(mk('text', P));
    };
    for (const k of list) {
      if (!isEl(k)) {
        if (hasText(k.x)) run.push(k);
        continue;
      }
      const svgIcon = isIconEl(k) && (k.t === 'svg' || k.t === 'img');
      if (!svgIcon && anyVis(X, k) && isInline(X, k) && !isAbs(k) && !/^(button)$/.test(k.t) && !(k.t === 'a' && looksButton(k))) {
        if (hasText(textOf(X, k)) || isIconEl(k)) run.push(k);
        continue;
      }
      flushRun();
      // các phần tử inline-block nằm cùng một dòng (nút, nhãn, ảnh nhỏ…) -> một hàng
      const i = list.indexOf(k);
      if (C.kind !== 'row' && inlineLevel(X, k) && !used.has(k)) {
        const grp = [k];
        for (let j = i + 1; j < list.length; j++) {
          const x = list[j];
          if (!isEl(x)) {
            if (hasText(x.x)) break;
            continue;
          }
          if (!anyVis(X, x)) continue;
          if (!inlineLevel(X, x) || !sameLine(k, x)) break;
          grp.push(x);
        }
        if (grp.length > 1) {
          grp.forEach((x) => used.add(x));
          const host = C.node || { s: {} };
          const al = alignOf(host);
          const row = mk('row', { gap: Math.min(300, gapOf(grp, 'x') ?? 8), vAlign: 'center', justify: al === 'center' ? 'center' : al === 'right' ? 'end' : 'start', wrap: true, stack: false });
          const CR = Object.assign({}, C, { kind: 'row' });
          for (const x of grp) row.children.push(...conv(X, x, CR));
          out.push(row);
          continue;
        }
      }
      if (used.has(k)) continue;
      out.push(...conv(X, k, C));
    }
    flushRun();
    return out;
  }
  const used = new WeakSet();
  /** Phần tử ở mức dòng nhưng là một khối riêng (inline-block, ảnh, nút, phần tử trôi) */
  function inlineLevel(X, k) {
    if (!isEl(k) || isAbs(k)) return false;
    const d = sv(k, 'display');
    return /^inline/.test(d) || sv(k, 'float') !== 'none';
  }
  const sameLine = (a, b) => b.r[1] < a.r[1] + a.r[3] - 2 && b.r[1] + b.r[3] > a.r[1] + 2;

  /** Một phần tử -> 0..n thành phần */
  function conv(X, n, C) {
    if (!isEl(n)) return hasText(n.x) ? [mk('text', { text: tidy(PK.escInline(collapse(n.x))) })] : [];
    if (X.consumed.has(n.i)) return [];
    const dV = dvis(X, n), mV = mvis(X, n);
    if (!dV && !mV) {
      hiddenMenu(X, n);
      return [];
    }
    let out;
    try {
      out = convEl(X, n, C) || [];
    } catch (e) {
      console.warn('[Nhập HTML] lỗi ở <' + n.t + '>', e);
      X.G.count('error');
      out = [];
    }
    out = out.filter(Boolean);
    if (!out.length) return out;
    // ẩn / hiện theo thiết bị (chỉ ghi ở phần tử ngoài cùng có khác biệt)
    for (const node of out) {
      const K = PK.TYPES[node.type].keys;
      if (dV && !mV && C.mV && K.has('hideMobile')) node.props.hideMobile = true;
      if (!dV && mV && C.dV && K.has('hideDesktop')) node.props.hideDesktop = true;
    }
    const main = out[0];
    const K = PK.TYPES[main.type].keys;
    // vị trí tự do
    if (isAbs(n) && K.has('pos')) {
      absProps(X, n, main.props, C.box || [0, 0, X.vw, X.vh]);
      if (sv(n, 'position') === 'fixed') {
        X.fixed.push(...out);
        return [];
      }
    } else if (K.has('zIndex') && sv(n, 'z-index') !== 'auto' && /relative|sticky/.test(sv(n, 'position'))) main.props.zIndex = Math.max(-100, Math.min(9999, parseInt(sv(n, 'z-index'), 10) || 0));
    transformProps(n, main.props, K);
    animProps(X, n, main.props, K);
    anchorProp(X, n, main);
    return withPseudo(X, n, out, C);
  }

  function convEl(X, n, C) {
    const t = n.t;
    if (/^h[1-6]$/.test(t) && isTextual(X, n)) return [headingOrText(X, n, C)];
    if (t === 'img' || t === 'picture') return [imageFrom(X, n, C)];
    if (t === 'svg') return [svgFrom(X, n, C)];
    if (isIconEl(n)) {
      // biểu tượng đứng riêng (thẻ tính năng…): giữ font biểu tượng nếu có nguồn, không thì ký tự gần nghĩa
      const g = glyphOf(X, n);
      if (!g) {
        X.G.count('inlineIcon');
        return [];
      }
      const P = { text: PK.escInline(g.ch) };
      textProps(X, n, P, PK.TYPES.text.keys, C.inh, { bold: false, lineHeight: 1.6 });
      if (g.font) P.font = g.font;
      else delete P.font;
      P.lineHeight = 1;
      placeProp(n, P, C);
      delete P.place;
      return [mk('text', P)];
    }
    if (/^(video|iframe|canvas|object|embed|audio)$/.test(t)) return [mediaFrom(X, n, C)];
    if (t === 'hr') return [dividerFrom(X, n, C)];
    if (t === 'table') return [tableFrom(X, n, C)];
    if (t === 'form') return [formFrom(X, n, C)];
    if (/^(input|select|textarea)$/.test(t)) return [fieldFrom(X, n, C)];
    if (t === 'label') {
      const f = labelWrap(X, n, C);
      if (f) return [f];
    }
    if (t === 'button' || (t === 'input' && /^(submit|button|reset)$/i.test(attr(n, 'type') || ''))) return [buttonFrom(X, n, C)];
    if (t === 'a' && isTextual(X, n)) return [buttonFrom(X, n, C)];
    if (t === 'a' && kidsOf(n).filter((k) => isEl(k) && anyVis(X, k)).length === 1 && kidsOf(n).every((k) => isEl(k) || !hasText(k.x))) {
      // liên kết bọc một ảnh / một khối -> giữ phần bên trong
      X.G.count('blockLink');
    } else if (t === 'a') X.G.count('blockLink');
    if (t === 'ul' || t === 'ol' || t === 'menu') {
      const lis = kidsOf(n).filter((k) => isEl(k) && k.t === 'li' && anyVis(X, k));
      const nav = lis.length && lis.every((li) => navItem(X, li));
      if (nav) return navList(X, n, C, lis);
      if (lis.length && lis.every((li) => isTextual(X, li))) return [listFrom(X, n, C)];
    }
    if (isTextual(X, n)) {
      // chữ có khung (viền / bóng / nền bo góc) ngắn -> Hình trang trí có chữ (nhãn, huy hiệu)
      const txt = collapse(textOf(X, n)).trim();
      if (boxed(n) && (borderW(n) > 0 || radiusOf(n) > 0 || sv(n, 'box-shadow') !== 'none') && txt.length <= 60 && !/^h[1-6]$/.test(t)) {
        const sh = shapeFrom(X, n, C, { text: tidy(inlineOf(X, n, n)), autoSize: true });
        if (/^inline/.test(sv(n, 'display')) || n.r[2] < C.cw - 4) sh.props.w = r1(n.r[2]) + 1;
        placeProp(n, sh.props, C);
        fxProps(X, n, sh.props, PK.TYPES.shape.keys);
        return [sh];
      }
      if (boxed(n) && (borderW(n) > 0 || sv(n, 'box-shadow') !== 'none')) {
        // đoạn chữ dài có viền -> cột có viền chứa đoạn chữ
        const col = mk('col', { gap: 0, hAlign: 'stretch' });
        visualProps(X, n, col.props, PK.TYPES.col.keys, C);
        col.props.padY = r1((px(sv(n, 'padding-top')) + px(sv(n, 'padding-bottom'))) / 2);
        const inner = Object.assign({}, n, { s: Object.assign({}, n.s, { 'background-color': D0['background-color'], 'border-top-width': '0px', 'border-bottom-width': '0px', 'border-left-width': '0px', 'border-right-width': '0px', 'box-shadow': 'none', 'padding-top': '0px', 'padding-bottom': '0px', 'padding-left': '0px', 'padding-right': '0px', 'background-image': 'none' }) });
        const tx = headingOrText(X, inner, ctxFor(X, n, 'col', C.inh));
        if (tx) col.children.push(tx);
        return [col];
      }
      const node = headingOrText(X, n, C);
      if (node) fxProps(X, n, node.props, PK.TYPES[node.type].keys);
      return [node];
    }
    const kids = kidsOf(n).filter((k) => !isEl(k) ? hasText(k.x) : true);
    if (!kids.some((k) => !isEl(k) || anyVis(X, k) || k.b || k.af)) {
      // khối rỗng: có trang trí -> Hình trang trí; không -> khoảng trống
      if (boxed(n) || n.b || n.af) {
        const sh = shapeFrom(X, n, C, { abs: isAbs(n) });
        fxProps(X, n, sh.props, PK.TYPES.shape.keys);
        return [sh];
      }
      if (n.r[3] >= 8 && C.kind !== 'row') return [mk('divider', { kind: 'space', space: r1(n.r[3]), marginY: 0 })];
      return [];
    }
    return containerFrom(X, n, C);
  }
  function navItem(X, li) {
    const kids = kidsOf(li).filter((k) => (isEl(k) ? anyVis(X, k) || /^(ul|ol|div)$/.test(k.t) : hasText(k.x)));
    const links = kids.filter((k) => isEl(k) && (k.t === 'a' || k.t === 'button'));
    return links.length === 1 && kids.every((k) => links.includes(k) || (isEl(k) && /^(ul|ol|div)$/.test(k.t) && !dvis(X, k)));
  }
  /** Danh sách liên kết (menu điều hướng) -> hàng / cột các nút; menu con ẩn -> menu bảng nhỏ */
  function navList(X, n, C, lis) {
    const lines = groupLines(lis);
    const horiz = lines.length === 1 && lis.filter((l) => l.v).length > 1;
    const type = horiz ? 'row' : 'col';
    const P = horiz ? { gap: gapOf(lis, 'x') ?? 8, vAlign: 'center', justify: JU[sv(n, 'justify-content')] || 'start', wrap: sv(n, 'flex-wrap') === 'wrap', stack: X.mr && X.mr[n.i] === 1 ? false : true } : { gap: gapOf(lis, 'y') ?? 4, hAlign: 'stretch' };
    const node = mk(type, P);
    visualProps(X, n, node.props, PK.TYPES[type].keys, C);
    const CC = ctxFor(X, n, type, C.inh);
    for (const li of lis) {
      const a = kidsOf(li).find((k) => isEl(k) && (k.t === 'a' || k.t === 'button'));
      if (!a) continue;
      const btn = buttonFrom(X, a, CC);
      // li có màu nền / khoảng đệm riêng
      if (!px(btn.props.padY) && px(sv(li, 'padding-top'))) btn.props.padY = r1(px(sv(li, 'padding-top')));
      const sub = kidsOf(li).find((k) => isEl(k) && /^(ul|ol|div)$/.test(k.t) && !dvis(X, k));
      if (sub) {
        const links = collectLinks(X, sub);
        if (links.length) {
          const menu = mk('menu', { menuName: 'Menu ' + (btn.props.text || '').slice(0, 30), mode: 'panel', anchor: 'below-left', bg: bgColor(sub) || '#ffffff', shadow: shadowOf(sv(sub, 'box-shadow')) || 'lg', radius: Math.min(200, radiusOf(sub) || 8) }, links.map((l) => menuItem(X, l)));
          X.menus.push(menu);
          Object.assign(btn.props, { action: 'show', menu: menu.id, icon: btn.props.icon || '▾', iconPos: 'after' });
          X.G.count('menu');
        }
      }
      const out = conv2(X, li, btn, CC);
      node.children.push(out);
    }
    return [node];
  }
  /** Áp ẩn/hiện theo thiết bị của <li> lên nút */
  function conv2(X, li, btn, C) {
    const dV = dvis(X, li), mV = mvis(X, li);
    if (dV && !mV && C.mV) btn.props.hideMobile = true;
    if (!dV && mV && C.dV) btn.props.hideDesktop = true;
    return btn;
  }
  function collectLinks(X, n, out = []) {
    for (const k of kidsOf(n)) {
      if (!isEl(k)) continue;
      if ((k.t === 'a' || k.t === 'button') && hasText(textOf({ mv: null }, Object.assign({}, k, { v: 1 })))) out.push(k);
      else collectLinks(X, k, out);
    }
    return out;
  }
  function menuItem(X, l) {
    const txt = collapse(textOf({ mv: null }, Object.assign({}, l, { v: 1, k: (l.k || []).map((k) => (isEl(k) ? Object.assign({}, k, { v: 1 }) : k)) }))).trim();
    const P = { text: txt.slice(0, 300) || 'Mục', variant: 'ghost', widthMode: 'full', align: 'left', size: 'sm', bg: 'transparent', color: toColor(sv(l, 'color')) || '#0f172a', borderW: 0 };
    const lk = l.t === 'a' ? linkTarget(X, l) : null;
    Object.assign(P, { action: 'link' }, lk || { linkKind: 'url', url: '' });
    return mk('button', P);
  }
  /** Khối bị ẩn trên mọi thiết bị nhưng chứa nhiều liên kết (menu điện thoại, ngăn kéo…) -> menu */
  function hiddenMenu(X, n) {
    if (!/^(nav|div|ul|aside|section|header)$/.test(n.t)) return;
    const links = collectLinks(X, n);
    if (links.length < 2) return;
    const w = px(sv(n, 'width'));
    const full = sv(n, 'position') === 'fixed' || w >= X.vw * 0.7 || /\b(fullscreen|overlay|offcanvas|drawer)\b/.test(cls(n));
    const P = { menuName: attr(n, 'aria-label') || 'Menu điện thoại', mode: full ? 'full' : 'panel', anchor: 'below-right', effect: full ? 'slide-right' : 'fade' };
    const bg = bgColor(n);
    if (bg) P.bg = bg;
    const menu = mk('menu', P, links.map((l) => menuItem(X, l)));
    if (full && bg && PK.readable(bg) === '#ffffff') menu.children.forEach((b) => (b.props.color = b.props.color === '#0f172a' ? '#ffffff' : b.props.color));
    X.menus.push(menu);
    if (attr(n, 'id')) X.menuOf.set(attr(n, 'id'), menu);
    X.G.count('menu');
  }

  /** Nền, viền, bóng, khoảng đệm, độ rộng tối đa… của một khung */
  function visualProps(X, n, P, K, C) {
    bgProps(X, n, P, K);
    boxProps(n, P, K, { X });
    if (K.has('padX')) {
      const pl = px(sv(n, 'padding-left')), pr = px(sv(n, 'padding-right'));
      if (pl + pr) P.padX = r1((pl + pr) / 2);
    }
    const mh = px(sv(n, 'min-height'));
    if (K.has('minH') && mh > 0) P.minH = r1(mh);
    fxProps(X, n, P, K);
    void C;
  }
  /** Khối bố cục (div, section, header…) */
  function containerFrom(X, n, C) {
    const all = kidsOf(n);
    const flow = all.filter((k) => !isEl(k) || !isAbs(k));
    const abs = all.filter((k) => isEl(k) && isAbs(k));
    const d = sv(n, 'display');
    const els = flow.filter((k) => isEl(k) && anyVis(X, k));
    let kind = 'col', cols = 1;
    if (/grid/.test(d)) {
      cols = trackCount(sv(n, 'grid-template-columns'));
      kind = cols > 1 ? 'grid' : 'col';
    } else if (/flex/.test(d)) kind = /^row/.test(sv(n, 'flex-direction')) ? 'row' : 'col';
    // khối thường (block): xếp dọc; các phần tử inline-block cùng dòng được convKids gom thành hàng
    const top = C.kind === 'page';
    let node;
    if (kind === 'col') {
      const type = top ? 'section' : 'col';
      const K = PK.TYPES[type].keys;
      const P = {};
      visualProps(X, n, P, K, C);
      const inh = innerText(X, n, P, K, C.inh);
      const CC = ctxFor(X, n, 'col', inh, { inForm: C.inForm });
      const g = gapOf(els, 'y');
      P.gap = g == null ? 0 : Math.min(300, g);
      P.padY = P.minH ? r1((px(sv(n, 'padding-top')) + px(sv(n, 'padding-bottom'))) / 2) : padYMeasured(n, flow, C.kind === 'row');
      if (!P.padX) P.padX = 0;
      // căn ngang các con
      const fl = /flex/.test(d);
      const ai = sv(n, 'align-items');
      if (fl) {
        P.hAlign = { center: 'center', 'flex-start': 'start', start: 'start', 'flex-end': 'end', end: 'end' }[ai] || 'stretch';
        P.vAlign = { center: 'center', 'flex-end': 'bottom', end: 'bottom', 'space-between': 'between' }[sv(n, 'justify-content')] || 'top';
      } else P.hAlign = 'stretch';
      if (type === 'section') {
        Object.assign(P, { tag: /^(header|nav|main|section|article|aside|footer)$/.test(n.t) ? n.t : 'div', contentW: 0 });
        if (/sticky/.test(sv(n, 'position')) && px(sv(n, 'top')) <= 1) P.sticky = true;
        delete P.hAlign;
        if (P.vAlign === 'top') delete P.vAlign;
      } else {
        // khối hẹp, căn giữa -> giãn tới độ rộng tối đa, đặt giữa
        if (C.kind !== 'row' && C.cw && n.r[2] < C.cw - 4) {
          const left = n.r[0] - C.cx0, right = C.cx0 + C.cw - (n.r[0] + n.r[2]);
          Object.assign(P, { widthMode: 'percent', width: 100, maxW: r1(n.r[2]), place: Math.abs(left - right) < 3 ? 'center' : right < left ? 'end' : 'start' });
        }
      }
      node = mk(type, P);
      node.children = convKids(X, flow, CC);
      // khung bọc không có gì riêng, chỉ một con -> bỏ khung, giữ con
      const plain = Object.keys(P).every((k) => ['gap', 'hAlign', 'vAlign'].includes(k) || ((k === 'padY' || k === 'padX') && !P[k]));
      if (type === 'col' && plain && node.children.length === 1 && !abs.length && !n.b && !n.af) return [node.children[0]];
    } else {
      // hàng / lưới: nhóm theo dòng hiển thị
      const lines = groupLines(els);
      const multi = lines.length > 1;
      // dàn đều / căn giữa: khoảng cách nhìn thấy gồm cả chỗ trống -> chỉ lấy column-gap của CSS
      const spread = /space|center|end|right/.test(sv(n, 'justify-content'));
      const colGap = px(sv(n, 'column-gap')) || (spread ? 0 : gapOf(els, 'x')) || 0;
      const rowGap = lines.length > 1 ? Math.max(0, Math.round(lines[1][0].r[1] - Math.max(...lines[0].map((k) => k.r[1] + k.r[3])))) : 0;
      const stack = X.mr && X.mr[n.i] === 1 ? false : true;
      const rowProps = () => ({ gap: Math.min(300, r1(colGap)), vAlign: VA[sv(n, 'align-items')] || (kind === 'grid' ? 'stretch' : 'center'), justify: JU[sv(n, 'justify-content')] || 'start', wrap: false, stack, minH: 0 });
      const cw = contentW(n);
      const CC = ctxFor(X, n, 'row', C.inh, { inForm: C.inForm });
      const item = (k, line) => {
        const nodes = conv(X, k, CC);
        return nodes.map((m) => {
          if (multi || PK.TYPES[m.type].container) return asCol(X, m, k, line, cw, multi);
          return m;
        });
      };
      const hiddenDesk = els.filter((k) => !k.v);
      // khối ẩn trên mọi thiết bị (menu điện thoại, ngăn kéo) -> menu
      for (const k of flow) if (isEl(k) && !anyVis(X, k)) hiddenMenu(X, k);
      if (!multi) {
        const type = top ? 'section' : 'row';
        if (type === 'section') {
          const sec = mk('section', { tag: /^(header|nav|main|section|article|aside|footer)$/.test(n.t) ? n.t : 'div', contentW: 0, gap: 0 });
          visualProps(X, n, sec.props, PK.TYPES.section.keys, C);
          sec.props.padY = r1((px(sv(n, 'padding-top')) + px(sv(n, 'padding-bottom'))) / 2);
          if (!sec.props.padX) sec.props.padX = 0;
          if (/sticky/.test(sv(n, 'position')) && px(sv(n, 'top')) <= 1) sec.props.sticky = true;
          const inh = innerText(X, n, sec.props, PK.TYPES.section.keys, C.inh);
          CC.inh = inh;
          const row = mk('row', rowProps());
          const line = lines[0] || [];
          for (const k of sortVisual(flow, line, hiddenDesk)) row.children.push(...(isEl(k) ? item(k, line) : convKids(X, [k], CC)));
          sec.children.push(row);
          node = sec;
        } else {
          const row = mk('row', rowProps());
          visualProps(X, n, row.props, PK.TYPES.row.keys, C);
          row.props.padY = r1((px(sv(n, 'padding-top')) + px(sv(n, 'padding-bottom'))) / 2);
          const line = lines[0] || [];
          for (const k of sortVisual(flow, line, hiddenDesk)) row.children.push(...(isEl(k) ? item(k, line) : convKids(X, [k], CC)));
          node = row;
        }
      } else {
        const type = top ? 'section' : 'col';
        const K = PK.TYPES[type].keys;
        const P = { gap: Math.min(300, rowGap) };
        visualProps(X, n, P, K, C);
        P.padY = r1((px(sv(n, 'padding-top')) + px(sv(n, 'padding-bottom'))) / 2);
        if (!P.padX) P.padX = 0;
        if (type === 'section') Object.assign(P, { tag: /^(header|nav|main|section|article|aside|footer)$/.test(n.t) ? n.t : 'div', contentW: 0 });
        else P.hAlign = 'stretch';
        const inh = innerText(X, n, P, K, C.inh);
        CC.inh = inh;
        node = mk(type, P);
        lines.forEach((line, li) => {
          const row = mk('row', rowProps());
          for (const k of line) row.children.push(...item(k, line));
          if (li === lines.length - 1) for (const k of hiddenDesk) row.children.push(...item(k, line));
          node.children.push(row);
        });
        X.G.count(kind === 'grid' ? 'grid' : 'wrapRow');
      }
    }
    // con đặt tự do (absolute) -> theo khung này
    const CA = ctxFor(X, n, node.type === 'row' ? 'row' : 'col', C.inh);
    for (const k of abs) {
      const nodes = conv(X, k, Object.assign({}, CA, { box: n.r }));
      node.children.push(...nodes);
    }
    layerBehind(node);
    return [node];
  }
  /** Thứ tự hiển thị trong một dòng (row-reverse, order…) + phần tử chỉ hiện trên điện thoại */
  function sortVisual(flow, line, hiddenDesk) {
    const inLine = new Set(line);
    const rest = flow.filter((k) => !inLine.has(k) && (!isEl(k) || hiddenDesk.includes(k)));
    return [...line, ...rest];
  }
  /** Con của hàng / lưới -> cột có độ rộng */
  function asCol(X, m, k, line, cw, multi) {
    const fg = px(sv(k, 'flex-grow'));
    const pct = cw ? (k.r[2] / cw) * 100 : 0;
    const widths = line.map((x) => x.r[2]);
    const equal = Math.max(...widths) - Math.min(...widths) < 3;
    const sum = widths.reduce((a, b) => a + b, 0);
    // tỉ lệ "tròn" (1/4, 1/3, 1/2, 2/3…) -> có lẽ đặt độ rộng theo %; còn lại theo nội dung như flex mặc định
    const roundPct = [20, 25, 33.33, 40, 50, 60, 66.67, 75, 80].some((x) => Math.abs(pct - x) < 1.5);
    let wp;
    if (!multi && (fg > 0 || (equal && sum >= cw * 0.9 && line.length > 1))) wp = { widthMode: 'auto' };
    else if (pct >= 98 && !multi) wp = { widthMode: 'auto' };
    else if (!multi && (!roundPct || contentSized(k))) {
      if (m.type !== 'col' && !PK.TYPES[m.type].container) return m;
      wp = { widthMode: 'fit' };
    } else wp = { widthMode: 'percent', width: Math.max(1, Math.min(100, Math.round(pct))) };
    if (m.type === 'col') {
      Object.assign(m.props, wp);
      delete m.props.place;
      if (m.props.maxW && Math.abs(m.props.maxW - k.r[2]) < 3) delete m.props.maxW;
      return m;
    }
    return mk('col', Object.assign({ gap: 0, hAlign: 'stretch' }, wp), [m]);
  }
  /** Phần tử rộng đúng bằng nội dung của nó (hàng flex mà tổng con + khoảng cách + đệm = bề rộng) */
  function contentSized(k) {
    let x = k;
    // khung bọc một con: xét con bên trong
    for (let d = 0; d < 4; d++) {
      const kids = kidsOf(x).filter((c) => isEl(c) && c.v && !isAbs(c));
      if (kids.length === 1 && Math.abs(kids[0].r[2] - contentW(x)) < 2) x = kids[0];
      else break;
    }
    const kids = kidsOf(x).filter((c) => isEl(c) && c.v && !isAbs(c));
    if (!/flex/.test(sv(x, 'display')) || !/^row/.test(sv(x, 'flex-direction')) || !kids.length) return false;
    const gap = px(sv(x, 'column-gap'));
    const sum = kids.reduce((a, c) => a + c.r[2] + px(sv(c, 'margin-left')) + px(sv(c, 'margin-right')), 0) + gap * (kids.length - 1);
    return Math.abs(sum - contentW(x)) < 3;
  }
  /** Hình trang trí phủ gần kín khung (lớp phủ) -> nằm dưới nội dung */
  function layerBehind(node) {
    const kids = node.children || [];
    if (!kids.some((c) => c.props.pos !== 'absolute')) return;
    for (const c of kids) {
      if (c.type !== 'shape' || c.props.pos !== 'absolute' || c.props.zIndex != null || c.props.text) continue;
      const full = (c.props.posLeft === 0 && c.props.posRight === 0) || c.props.w === '100%' || (c.props.posTop === 0 && c.props.posBottom === 0);
      if (full || c.props._behind) c.props.zIndex = -1;
    }
  }
  /** ::before / ::after có hình (khối trang trí, lớp phủ, gạch chân tiêu đề…) -> Hình trang trí */
  function withPseudo(X, n, out, C) {
    const main = out[0];
    for (const w of ['b', 'af']) {
      const p = n[w];
      if (!p) continue;
      const s = p.s;
      const absP = /^(absolute|fixed)$/.test(s.position || '');
      const c = parseContent(p.c, n);
      const blockish = absP || /^(block|flex|grid|inline-block)$/.test(s.display || '');
      const deco = !!(toColor(s['background-color']) || (s['background-image'] && s['background-image'] !== 'none') || px(s['border-top-width']) || px(s['border-bottom-width']) || px(s['border-left-width']));
      if (!blockish && !c.url) continue; // chữ trong dòng: đã gộp vào nội dung
      if (main.type === 'list' && w === 'b') continue;
      if (!deco && !c.text && !c.url) continue;
      const fake = { t: 'div', s, a: n.a, r: [0, 0, px(s.width) || 0, px(s.height) || 0], v: 1, i: -1 };
      let node;
      if (c.url && !deco) {
        node = mk('image', { src: PK.safeImage(c.url) ? c.url : '', alt: '', widthMode: 'fixed', width: Math.max(1, r1(px(s.width) || 24)), height: 0 });
      } else {
        node = shapeFrom(X, fake, C, { text: c.text && !isPUA(c.text) ? PK.escInline(c.text) : '', abs: absP });
        if (c.text && isPUA(c.text)) {
          const fk = X.G.fontKey(s['font-family'] || sv(n, 'font-family'), px(s['font-weight']) || 400);
          if (fk && /^cf-/.test(fk)) Object.assign(node.props, { text: PK.escInline(c.text), font: fk });
        }
      }
      if (absP) {
        // ::before/::after không có toạ độ riêng: tính theo top/left… so với chính phần tử
        const bx = n.r;
        const L = s.left && s.left !== 'auto' ? px(s.left) : null, R = s.right && s.right !== 'auto' ? px(s.right) : null;
        const T = s.top && s.top !== 'auto' ? px(s.top) : null, B = s.bottom && s.bottom !== 'auto' ? px(s.bottom) : null;
        const P = node.props;
        P.pos = s.position === 'fixed' ? 'fixed' : 'absolute';
        const pw = px(s.width), ph = px(s.height);
        if (L != null && R != null && Math.abs(L) < 1 && Math.abs(R) < 1) Object.assign(P, { posLeft: 0, w: '100%' });
        else if (R != null && (L == null || R < L)) P.posRight = r1(R);
        else P.posLeft = r1(L || 0);
        if (T != null && B != null && Math.abs(T) < 1 && Math.abs(B) < 1) Object.assign(P, { posTop: 0, h: '100%' });
        else if (B != null && (T == null || B < T)) P.posBottom = r1(B);
        else P.posTop = r1(T || 0);
        if (bx[2] && pw && Math.abs(pw - bx[2]) < 2) P.w = '100%';
        if (bx[3] && ph && Math.abs(ph - bx[3]) < 2) P.h = '100%';
        const z = s['z-index'];
        if (z && z !== 'auto') P.zIndex = Math.max(-100, Math.min(9999, parseInt(z, 10) || 0));
        else if (!c.text && (P.w === '100%' || P.h === '100%')) P._behind = true;
        const mt = parseMatrix(s.transform);
        if (mt && mt.rot) P.rotate = mt.rot;
        if (mt && (mt.tx || mt.ty) && !(P.posLeft === '50%')) {
          if (mt.tx) P.shiftX = mt.tx;
          if (mt.ty) P.shiftY = mt.ty;
        }
      } else {
        if (node.props.w === r1(C.cw)) node.props.w = '100%';
        // gạch trang trí căn giữa bằng margin auto, cách chữ bằng margin
        const ml = px(s['margin-left']), mr = px(s['margin-right']);
        if (ml > 0 && Math.abs(ml - mr) < 1) node.props.place = 'center';
        const my = (px(s['margin-top']) + px(s['margin-bottom'])) / 2;
        if (my) node.props.marginY = r1(my);
      }
      X.G.count('pseudo');
      if (PK.TYPES[main.type].container) {
        if (w === 'b') main.children.unshift(node);
        else main.children.push(node);
        layerBehind(main);
      } else if (absP) {
        // thành phần lá: bọc trong một cột để hình trang trí bám theo
        const wrap = mk('col', { gap: 0, hAlign: 'stretch', widthMode: C.kind === 'row' ? 'fit' : 'auto' }, w === 'b' ? [node, main] : [main, node]);
        for (const k of ['hideMobile', 'hideDesktop', 'anim', 'animOn', 'animDur', 'animDelay', 'animEase', 'animLoop', 'animAlt', 'animFrames']) if (main.props[k] != null) (wrap.props[k] = main.props[k]), delete main.props[k];
        out[0] = wrap;
        layerBehind(wrap);
        return out;
      } else if (w === 'b') out.unshift(node);
      else out.push(node);
    }
    for (const node of out) if (node.props && node.props._behind !== undefined) delete node.props._behind;
    return out;
  }
  function formFrom(X, n, C) {
    const K = PK.TYPES.form.keys;
    const action = attr(n, 'action');
    const P = action && /^https?:/i.test(action) ? { submitKind: 'url', url: action, method: lower(attr(n, 'method') || 'post') === 'get' ? 'get' : 'post' } : { submitKind: 'alert' };
    visualProps(X, n, P, K, C);
    const els = kidsOf(n).filter((k) => isEl(k) && anyVis(X, k));
    const g = gapOf(els, 'y');
    P.gap = g == null ? 14 : Math.min(300, g);
    P.padY = padYMeasured(n, kidsOf(n));
    if (!P.padX) P.padX = 0;
    const node = mk('form', P);
    const d = sv(n, 'display');
    const CC = ctxFor(X, n, 'col', C.inh, { inForm: true });
    if (/flex/.test(d) && /^row/.test(sv(n, 'flex-direction'))) {
      const row = mk('row', { gap: r1(px(sv(n, 'column-gap')) || gapOf(els, 'x') || 8), vAlign: VA[sv(n, 'align-items')] || 'center', wrap: false, stack: true });
      row.children = convKids(X, kidsOf(n), Object.assign({}, CC, { kind: 'row' }));
      node.children.push(row);
    } else node.children = convKids(X, kidsOf(n), CC);
    X.G.count('form');
    return node;
  }

  /** Các khối cấp trên cùng -> khối trang (section) */
  function topLevel(X, body) {
    const W = X.vw;
    const out = [];
    const inh = X.G.inh0;
    const C = { kind: 'page', inh, cw: W, cx0: 0, box: [0, 0, W, Math.max(X.vh, body.r[3])], dV: true, mV: true, inForm: false };
    const fullW = (k) => k.r[2] >= W - 4 || px(sv(k, 'width')) >= W - 4;
    /** khung bọc không trang trí, toàn bề rộng -> mở ra (div#root, main, .wrapper…) */
    const spaced = (k) => ['padding-top', 'padding-bottom', 'margin-top', 'margin-bottom'].some((p) => px(sv(k, p)) > 0);
    const unwrap = (k) => {
      if (!isEl(k) || isAbs(k) || boxed(k) || k.b || k.af || /^(header|footer|nav|form|ul|ol|table)$/.test(k.t)) return false;
      if (/flex|grid/.test(sv(k, 'display')) && /^row/.test(sv(k, 'flex-direction')) && !/grid/.test(sv(k, 'display'))) return false;
      if (attr(k, 'id') && X.G.anchorRefs.has(attr(k, 'id'))) return false;
      const kids = kidsOf(k).filter((x) => isEl(x) && anyVis(X, x) && !isAbs(x));
      if (!kids.length || !fullW(k)) return false;
      // khung bọc chỉ mở khi các con của nó cũng trải hết bề ngang (vd main > section, section…)
      if (kids.length === 1) return fullW(kids[0]) && !isTextual(X, kids[0]) && !spaced(k);
      return kids.filter(fullW).length >= Math.max(2, kids.length * 0.6) && !spaced(k);
    };
    const expand = (list, depth) => {
      const res = [];
      for (const k of list) {
        if (depth < 8 && unwrap(k)) res.push(...expand(kidsOf(k), depth + 1));
        else res.push(k);
      }
      return res;
    };
    const items = expand(kidsOf(body), 0);
    let group = [];
    const flush = () => {
      if (!group.length) return;
      const nodes = convKids(X, group, Object.assign({}, C, { kind: 'col', cw: Math.min(W, 1100) }));
      group = [];
      if (nodes.length) out.push(mk('section', { padY: 24, padX: 24, gap: 16, contentW: 1100 }, nodes));
    };
    for (const k of items) {
      if (!isEl(k)) {
        if (hasText(k.x)) group.push(k);
        continue;
      }
      if (X.consumed.has(k.i)) continue;
      if (!anyVis(X, k)) {
        hiddenMenu(X, k);
        continue;
      }
      if (isAbs(k)) {
        flush();
        const nodes = conv(X, k, C);
        out.push(...nodes);
        continue;
      }
      if (!isTextual(X, k) && !inlineLevel(X, k)) {
        flush();
        out.push(...sectionFrom(X, k, C));
      } else group.push(k);
    }
    flush();
    return out;
  }
  /** Khối trang: nhận ra khung giữa (container có max-width, căn giữa) -> contentW */
  function sectionFrom(X, n, C) {
    const flow = kidsOf(n).filter((k) => isEl(k) && anyVis(X, k) && !isAbs(k));
    const W = X.vw;
    let inner = null;
    if (flow.length === 1 && !boxed(flow[0]) && !isTextual(X, flow[0]) && !/^(form|table|ul|ol)$/.test(flow[0].t)) {
      const w = flow[0];
      const left = w.r[0] - n.r[0], right = n.r[0] + n.r[2] - (w.r[0] + w.r[2]);
      if (w.r[2] < n.r[2] - 8 && Math.abs(left - right) < 4) inner = w;
    }
    if (!inner) {
      const nodes = conv(X, n, C);
      for (const s of nodes)
        if (s.type === 'section') {
          narrowSection(X, n, s);
          // khoảng cách giữa các khối trang (margin) -> khoảng đệm của khối
          const my = (px(sv(n, 'margin-top')) + px(sv(n, 'margin-bottom'))) / 2;
          if (my > 0) s.props.padY = r1((s.props.padY || 0) + my);
        }
      return nodes;
    }
    // khung giữa: lấy bố cục của khung bên trong, nền / viền của khối ngoài
    const merged = Object.assign({}, inner, {
      s: Object.assign({}, inner.s),
      r: n.r,
      i: inner.i,
      // các con khác của khối ngoài (đặt tự do, hoặc đang ẩn như menu điện thoại) đi cùng
      k: (inner.k || []).concat(kidsOf(n).filter((k) => isEl(k) && k !== inner)),
    });
    for (const k of ['background-color', 'background-image', 'background-size', 'background-repeat', 'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width', 'border-top-color', 'border-bottom-color', 'border-top-style', 'box-shadow', 'min-height', 'position', 'top', 'z-index', 'color', 'font-family', 'font-size', 'text-align'])
      if (n.s[k] != null) merged.s[k] = n.s[k];
    const pY = (px(sv(n, 'padding-top')) + px(sv(n, 'padding-bottom'))) / 2;
    merged.s['padding-top'] = merged.s['padding-bottom'] = pY + (px(sv(inner, 'padding-top')) + px(sv(inner, 'padding-bottom'))) / 2 + 'px';
    const padX = Math.max(px(sv(inner, 'padding-left')), 16);
    merged.s['padding-left'] = merged.s['padding-right'] = (W - (inner.r[2] - 2 * padX)) / 2 + 'px';
    merged.t = /^(header|nav|main|section|article|aside|footer)$/.test(n.t) ? n.t : inner.t;
    merged.b = n.b;
    merged.af = n.af;
    const nodes = conv(X, merged, C);
    for (const s of nodes)
      if (s.type === 'section') {
        s.props.contentW = r1(inner.r[2] - 2 * padX);
        s.props.padX = r1(padX);
        if (n.a && n.a.id) anchorProp(X, n, s);
      }
    return nodes;
  }
  /** Khối không có khung giữa nhưng nội dung hẹp hơn trang (padding hai bên lớn) */
  function narrowSection(X, n, s) {
    const pl = px(sv(n, 'padding-left')), pr = px(sv(n, 'padding-right'));
    const left = n.r[0], right = X.vw - (n.r[0] + n.r[2]);
    if (n.r[2] < X.vw - 8 && Math.abs(left - right) < 4 && n.r[2] > 200) {
      // khối hẹp đặt giữa trang (main { max-width; margin: auto })
      s.props.contentW = r1(contentW(n));
      s.props.padX = Math.max(16, r1((pl + pr) / 2));
      return;
    }
    const inner = X.vw - pl - pr;
    if (pl > 60 && Math.abs(pl - pr) < 4 && inner > 200) {
      s.props.contentW = r1(inner);
      s.props.padX = 24;
    }
  }

  // ---- toàn cục cho cả lần nhập (nhiều trang)
  function makeG(snaps, files, report) {
    const G = {
      report,
      counts: {},
      count(k, n = 1) {
        G.counts[k] = (G.counts[k] || 0) + n;
      },
      pageIdByFile: new Map(),
      anchorRefs: new Set(),
      fonts: new Map(), // id -> mục font riêng
      faces: new Map(), // họ font (chữ thường) -> { family, faces }
      gfam: new Map(), // họ font Google (chữ thường) -> { family, weights, italic }
      pending: new Map(), // họ font không có nguồn -> { family, id, fallback, count }
      weightsUsed: new Map(),
      linkColors: new Map(),
      btnColors: new Map(),
      primary: '#2563eb',
      bad: [], // ảnh không tải được: { node, ref }
      badSet: new Set(),
      inh0: null,
    };
    G.track = (node, ref) => G.bad.push({ node, ref: String(ref || '') });
    G.badImage = (ref, page) => G.badSet.add((page ? page + ': ' : '') + String(ref).split('/').pop().slice(0, 80));
    G.linkColor = (c) => c && G.linkColors.set(c, (G.linkColors.get(c) || 0) + 1);
    G.btnColor = (c) => c && G.btnColors.set(c, (G.btnColors.get(c) || 0) + 1);
    G.hasSource = (fam) => {
      const low = lower(fam);
      return G.faces.has(low) || G.gfam.has(low);
    };
    /** Họ font -> khoá font của app (có sẵn / font riêng / chờ người dùng quyết) */
    G.fontKey = (ff, w) => {
      const list = famList(ff);
      for (let i = 0; i < list.length; i++) {
        const fam = list[i], low = lower(fam);
        if (EMOJI_FONT.test(low)) continue;
        if (G.gfam.has(low) || G.faces.has(low)) {
          const id = PK.fontId(fam);
          if (!G.fonts.has(id)) {
            const gf = G.gfam.get(low), fc = G.faces.get(low);
            const f = { id, name: fam, family: fam };
            if (gf) f.google = { weights: gf.weights, italic: gf.italic };
            else f.faces = fc.faces;
            G.fonts.set(id, f);
          }
          if (w) G.weightsUsed.set(id, (G.weightsUsed.get(id) || new Set()).add(Math.round(w / 100) * 100));
          return id;
        }
        if (BUILTIN[low]) return BUILTIN[low];
        if (!/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,59}$/.test(fam) || ICON_FONT.test(fam)) continue;
        // không có nguồn: hỏi người dùng (Google Fonts?) – tạm dùng id, quyết định ở bước xem lại
        const id = PK.fontId(fam);
        if (!G.pending.has(low)) {
          const nxt = list.slice(i + 1).find((f2) => BUILTIN[lower(f2)]);
          G.pending.set(low, { family: fam, id, fallback: nxt ? BUILTIN[lower(nxt)] : 'system', count: 0, google: GOOGLE_POPULAR.has(low) });
        }
        G.pending.get(low).count++;
        return id;
      }
      return null;
    };
    G.linkHref = (X, n) => {
      const lk = G.resolveLink(X, attr(n, 'href'));
      if (!lk) return '';
      if (lk.linkKind === 'page') {
        const pg = X.G.pages.find((p) => p.id === lk.page);
        return pg ? '#/' + pg.path : '';
      }
      return lk.url;
    };
    /** href -> { linkKind:'page', page } | { linkKind:'url', url } */
    G.resolveLink = (X, href) => {
      href = String(href || '').trim();
      if (!href || href === '#' || /^javascript:/i.test(href)) return { linkKind: 'url', url: '' };
      if (/^#\/?/.test(href)) {
        const id = decodeSafe(href.replace(/^#\/?/, ''));
        const slug = PK.slug(id, 60);
        return { linkKind: 'url', url: slug ? '#' + slug : '' };
      }
      if (/^(mailto:|tel:)/i.test(href)) return { linkKind: 'url', url: href };
      if (!isRemote(href)) {
        const [path, hash] = href.split('#');
        const key = baseName(path || '');
        if (key && G.pageIdByFile.has(key)) {
          const id = G.pageIdByFile.get(key);
          return { linkKind: 'page', page: id, hash };
        }
        if (!path && hash) return { linkKind: 'url', url: '#' + PK.slug(hash, 60) };
        G.count('relLink');
        return { linkKind: 'url', url: href };
      }
      return { linkKind: 'url', url: absUrl(href) };
    };
    // ---- font: Google Fonts + @font-face từ mọi trang
    for (const { snap } of snaps) {
      for (const href of snap.rules.gfonts || []) {
        let u;
        try {
          u = new URL(href);
        } catch (_) {
          continue;
        }
        const fams = u.pathname.includes('css2') ? u.searchParams.getAll('family') : (u.searchParams.get('family') || '').split('|');
        for (const spec of fams) {
          if (!spec) continue;
          const [name, axes = ''] = spec.split(':');
          const family = name.replace(/\+/g, ' ').trim();
          if (!/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,59}$/.test(family)) continue;
          const weights = new Set();
          let italic = /ital|italic|\di\b/.test(axes);
          if (axes.includes('@')) {
            const [keys, vals] = axes.split('@');
            const ks = keys.split(',');
            for (const tuple of vals.split(';')) {
              const vs = tuple.split(',');
              const w = vs[ks.indexOf('wght')];
              if (w && /^\d+$/.test(w)) weights.add(+w);
              if (ks.includes('ital') && vs[ks.indexOf('ital')] === '1') italic = true;
            }
          } else for (const w of axes.split(',')) if (/^\d+/.test(w)) weights.add(parseInt(w, 10));
          const low = lower(family);
          const cur = G.gfam.get(low) || { family, weights: [], italic: false };
          cur.weights = [...new Set([...cur.weights, ...weights])].filter((w) => w >= 100 && w <= 900 && w % 100 === 0).sort((a, b) => a - b);
          cur.italic = cur.italic || italic;
          G.gfam.set(low, cur);
        }
      }
      for (const f of snap.rules.faces || []) {
        const family = famList(f.family)[0];
        if (!family) continue;
        const low = lower(family);
        if (G.gfam.has(low)) continue;
        const srcs = [...String(f.src).matchAll(/url\(\s*"?([^")]+)"?\s*\)\s*(?:format\(\s*["']?([\w-]+)["']?\s*\))?/g)].map((m) => ({ u: m[1], f: lower(m[2] || extOf(m[1].split(/[?#]/)[0])) }));
        const pick = srcs.find((s) => /woff2/.test(s.f)) || srcs.find((s) => /woff/.test(s.f)) || srcs.find((s) => /truetype|opentype|ttf|otf/.test(s.f)) || srcs[0];
        if (!pick || !PK.safeFont(pick.u) || /^\./.test(pick.u)) continue;
        const wv = String(f.weight || '400').trim();
        const weight = wv === 'bold' ? '700' : wv === 'normal' || !wv ? '400' : wv.replace(/\s+/g, ' ');
        const cur = G.faces.get(low) || { family, faces: [] };
        if (cur.faces.length < 18) cur.faces.push({ src: pick.u, weight, style: /italic|oblique/.test(f.style || '') ? 'italic' : 'normal' });
        G.faces.set(low, cur);
      }
    }
    // ---- liên kết neo (#id) dùng ở mọi trang
    const walkAll = (n, fn) => {
      if (!n || !isEl(n)) return;
      fn(n);
      for (const k of n.k || []) walkAll(k, fn);
    };
    const linkCount = new Map(), btnCount = new Map();
    for (const { snap } of snaps)
      walkAll(snap.body, (n) => {
        const href = attr(n, 'href');
        if (href && /^#[^/]/.test(href)) G.anchorRefs.add(decodeSafe(href.slice(1)));
        if (href && /#[^/]/.test(href) && !isRemote(href)) G.anchorRefs.add(decodeSafe(href.split('#')[1]));
        if (n.t === 'a' && n.v && /^inline$/.test(sv(n, 'display'))) {
          const c = toColor(sv(n, 'color'));
          if (c) linkCount.set(c, (linkCount.get(c) || 0) + 1);
        }
        if (n.v && looksButton(n)) {
          const c = bgColor(n);
          if (c) btnCount.set(c, (btnCount.get(c) || 0) + 1);
        }
      });
    const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    const neutral = (c) => /^#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3$/.test(c) || /^#(fff|ffffff|000|000000|f8fafc|f1f5f9|0f172a)$/.test(c);
    const lc = top(new Map([...linkCount].filter(([c]) => !neutral(c))));
    const bc = top(new Map([...btnCount].filter(([c]) => !neutral(c) && !/^rgba/.test(c))));
    // màu chủ đạo: màu nền nút hay gặp nhất (màu thương hiệu), không có thì màu liên kết
    G.primary = (bc ? bc[0] : lc ? lc[0] : '#2563eb').replace(/^rgba.*/, '#2563eb');
    void files;
    return G;
  }

  /** Chuyển các trang đã đo -> { pages, theme, fonts, counts, pending, bad } */
  function convertAll(items) {
    const report = [];
    const G = makeG(items, items.map((x) => x.pre.it), report);
    // id + đường dẫn trang trước (để liên kết giữa các file chuyển được thành liên kết trang)
    const used = new Set();
    G.pages = items.map((x, i) => {
      const nm = x.pre.it.name.replace(/\.(html?|xhtml)$/i, '');
      let path = i === 0 && /^(index|default|home|trang-chu)$/i.test(nm) ? 'index' : PK.slug(nm) || 'trang';
      if (i === 0 && items.length === 1) path = PK.slug(nm) || 'index';
      while (used.has(path)) path += '-2';
      used.add(path);
      const id = DE.uid('p');
      G.pageIdByFile.set(x.pre.it.name, id);
      return { id, path, name: (x.snap.title || x.pre.title || nm).slice(0, 80) };
    });
    // giao diện chung theo trang đầu
    const s0 = items[0].snap;
    const body0 = s0.body;
    const fs0 = Math.round(px(sv(body0, 'font-size')) || 16);
    G.inh0 = { font: G.fontKey(sv(body0, 'font-family'), weight(body0)) || 'system', size: fs0, color: toColor(sv(body0, 'color')) || '#0f172a', align: 'left' };
    const theme = { font: G.inh0.font, fontSize: Math.max(10, Math.min(28, fs0)), color: G.inh0.color, primary: G.primary };
    const pages = items.map((x, i) => {
      const meta = G.pages[i];
      const X = makeX(x.snap, x.mob, G, meta.name);
      const body = x.snap.body;
      // nhãn <label for>, phần tử theo id
      (function walk(n) {
        if (!isEl(n)) return;
        if (attr(n, 'id')) X.elById.set(attr(n, 'id'), n);
        if (n.t === 'label' && attr(n, 'for')) X.labelFor.set(attr(n, 'for'), n);
        for (const k of n.k || []) walk(k);
      })(body);
      // <label for="…"> trỏ tới ô nhập: chữ nhãn đi vào ô nhập, không thành đoạn chữ riêng
      for (const [id, l] of X.labelFor) {
        const ctl = X.elById.get(id);
        if (ctl && /^(input|select|textarea)$/.test(ctl.t)) X.consumed.add(l.i);
      }
      // chữ kế thừa của trang này (trang sau có thể khác trang đầu)
      const inhSave = G.inh0;
      G.inh0 = Object.assign({}, inhSave, { font: G.fontKey(sv(body, 'font-family'), weight(body)) || inhSave.font, color: toColor(sv(body, 'color')) || inhSave.color });
      const children = topLevel(X, body);
      G.inh0 = inhSave;
      linkToggles(X);
      const props = {};
      const pbg = bgColor(body) || toColor(x.snap.html.bg);
      if (pbg) props.bg = pbg;
      const bimg = (sv(body, 'background-image').match(/url\(\s*"?([^")]*)"?\s*\)/) || [])[1];
      if (bimg && PK.safeImage(bimg) && bimg !== 'data:,') props.bgImage = bimg;
      if (x.snap.title) props.title = x.snap.title.slice(0, 120);
      return { id: meta.id, name: meta.name, path: meta.path, props, children: [...children, ...X.menus, ...X.fixed] };
    });
    // xoá giá trị trùng mặc định cho JSON gọn
    for (const pg of pages) PK.walk(pg.children, (n) => prune(n, theme));
    return { pages, theme, G };
  }
  /** Nút mở menu: aria-controls / data-target / nút ☰ */
  function linkToggles(X) {
    for (const t of X.toggles) {
      let menu = t.target ? X.menuOf.get(t.target) : null;
      if (!menu && t.target && X.elById.has(t.target)) {
        // khối đích đang hiện (thường là thanh điều hướng ẩn trên điện thoại) -> dựng menu từ các liên kết của nó
        const el = X.elById.get(t.target);
        const links = collectLinks(X, el);
        if (links.length >= 2) {
          menu = mk('menu', { menuName: 'Menu điện thoại', mode: 'full', effect: 'slide-right' }, links.map((l) => menuItem(X, l)));
          menu.children.forEach((b) => (b.props.color = '#ffffff'));
          X.menus.push(menu);
          X.menuOf.set(t.target, menu);
        }
      }
      if (!menu && !t.target && isBurger(X, t.n)) menu = X.menus.find((m) => !m._used) || null;
      if (!menu) continue;
      menu._used = true;
      Object.assign(t.node.props, { action: 'show', menu: menu.id });
      delete t.node.props.url;
      delete t.node.props.linkKind;
    }
    for (const m of X.menus) delete m._used;
  }
  function prune(n, theme) {
    const P = n.props;
    for (const k of Object.keys(P)) {
      if (P[k] === undefined) {
        delete P[k];
        continue;
      }
      if (P[k] === null && !(PK.FIELDS[k] && PK.FIELDS[k].opt)) {
        delete P[k];
        continue;
      }
      if (!PK.TYPES[n.type].keys.has(k)) {
        delete P[k];
        continue;
      }
      const def = PK.defaultOf(n, k, theme);
      if (def !== undefined && JSON.stringify(def) === JSON.stringify(P[k])) delete P[k];
    }
  }

  // =============================================================== AI
  const AI_RULES = [
    '',
    '## Nhiệm vụ: chuyển trang HTML có sẵn thành dự án của tab Thiết kế trang',
    '- Trả về đúng MỘT khối ```json là TOÀN BỘ dự án (gốc có "pages"), mỗi file HTML là một trang theo đúng thứ tự, dùng đúng id / path trang được cho bên dưới.',
    '- Giữ NGUYÊN VĂN mọi nội dung chữ (không tóm tắt, không dịch, không bỏ mục nào), giữ thứ tự các phần.',
    '- Bố cục: section (dải ngang; khung giữa có max-width → contentW) → row (flex ngang / lưới, nhiều dòng → nhiều row trong một col) → col (độ rộng widthMode/width) → nội dung.',
    '- Màu, cỡ chữ, khoảng đệm, bo góc, bóng: lấy giá trị thật. Gradient → bgGrad / textGrad. Phần tử position:absolute/fixed → pos + posTop/posRight/posBottom/posLeft (+ zIndex âm cho lớp phủ, hình trang trí nằm dưới nội dung).',
    '- ::before / ::after có hình → thành phần shape (Hình trang trí); có chữ → gộp vào nội dung. :hover/:active → hover*/press*. Animation, AOS, animate.css → anim*, animOn:"scroll" khi hiện lúc cuộn tới.',
    '- Font: họ font từ Google Fonts / @font-face → mục trong "fonts" + font:"cf-…". Chữ đậm / nghiêng / liên kết / màu giữa câu → cú pháp chữ định dạng. Liên kết giữa các file → nút action:"link", linkKind:"page"; liên kết #id → anchorId ở thành phần đích và url "#id".',
    '- Biểu tượng SVG trong nút → ký tự / emoji gần nghĩa ở "icon". Menu ẩn trên điện thoại (nút ☰) → thành phần menu mode:"full" + nút action:"show". Phần chỉ hiện trên máy tính / điện thoại → hideMobile / hideDesktop.',
    '- Chuỗi dạng "@data:N" là file đã nhúng (ảnh, font) – giữ nguyên đúng chuỗi đó ở src / bgImage / faces[].src.',
    '- Nếu có "Bản chuyển tự động" (đo từ trình duyệt thật): dùng nó để lấy kích thước, màu, vị trí chính xác; sửa những chỗ nó dựng sai cấu trúc hoặc thiếu ý nghĩa (menu, thẻ, lưới, biểu mẫu…).',
  ].join('\n');
  /** Thay data: dài bằng mã ngắn (khôi phục sau khi AI trả lời) */
  function tokenizeData(text, map) {
    return text.replace(/data:[a-z0-9.+/-]+;base64,[A-Za-z0-9+/=]{200,}/gi, (m) => {
      const tok = '@data:' + (map.size + 1);
      map.set(tok, m);
      return tok;
    });
  }
  function restoreData(o, map) {
    if (Array.isArray(o)) return o.map((x) => restoreData(x, map));
    if (o && typeof o === 'object') {
      for (const k of Object.keys(o)) o[k] = restoreData(o[k], map);
      return o;
    }
    if (typeof o === 'string' && o.includes('@data:')) return map.get(o.trim()) || o.replace(/@data:\d+/g, (t) => map.get(t) || t);
    return o;
  }
  async function fetchCss(urls, signal) {
    const out = [];
    for (const u of urls.slice(0, 20)) {
      try {
        const res = await fetch(u, { signal, mode: 'cors', credentials: 'omit' });
        if (res.ok) out.push({ url: u, text: await res.text() });
        else out.push({ url: u, fail: true });
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        out.push({ url: u, fail: true });
      }
    }
    return out;
  }
  /** Gói yêu cầu gửi AI. Trả { system, messages, map, failedCss } */
  async function buildAiRequest(items, draft, opts, signal) {
    const map = new Map();
    const system = DE.buildPageSkill({ noFooter: true }) + '\n' + AI_RULES;
    let user = `Chuyển ${items.length > 1 ? items.length + ' trang HTML' : 'trang HTML'} dưới đây thành một dự án Thiết kế trang (${opts.target === 'replace' ? 'dự án mới' : 'các trang sẽ được thêm vào dự án hiện có'}).\n`;
    user += 'Trang cần tạo (giữ id và path):\n' + draft.pages.map((p, i) => `- ${items[i].pre.it.name} → id "${p.id}", path "${p.path}", name "${p.name}"`).join('\n') + '\n';
    let failedCss = [];
    if (opts.aiCdnCss) {
      const urls = [...new Set(items.flatMap((x) => x.pre.remoteCss))];
      const got = await fetchCss(urls, signal);
      failedCss = got.filter((g) => g.fail).map((g) => g.url);
      const ok = got.filter((g) => !g.fail);
      if (ok.length) user += '\n## CSS tải từ CDN mà trang dùng\n' + ok.map((g) => `### ${g.url}\n\`\`\`css\n${tokenizeData(g.text, map)}\n\`\`\``).join('\n') + '\n';
    }
    for (const x of items) {
      const d = x.aiDoc.cloneNode(true);
      if (!opts.aiJs) for (const s of [...d.querySelectorAll('script')]) if (!s.getAttribute('type') || /javascript|module/i.test(s.getAttribute('type'))) s.textContent = s.textContent ? '/* (đã lược mã JavaScript) */' : '';
      const html = '<!doctype html>\n' + d.documentElement.outerHTML;
      user += `\n## File ${x.pre.it.name}\n\`\`\`html\n${tokenizeData(html, map)}\n\`\`\`\n`;
    }
    if (opts.aiDraft) {
      const json = JSON.stringify({ kind: 'de-page', version: 1, name: draft.name, theme: draft.theme, fonts: draft.fonts, pages: draft.pages });
      user += `\n## Bản chuyển tự động (đo từ trình duyệt thật – để tham khảo kích thước, màu, vị trí)\n\`\`\`json\n${tokenizeData(json, map)}\n\`\`\`\n`;
    }
    return { system, messages: [{ role: 'user', content: user }], map, failedCss };
  }
  function extractProject(text) {
    const cands = [];
    const re = /```[^\n]*\n([\s\S]*?)```/g;
    let m;
    while ((m = re.exec(text))) cands.push(m[1]);
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a >= 0 && b > a) cands.push(text.slice(a, b + 1));
    for (const c of cands.sort((x, y) => y.length - x.length)) {
      try {
        const o = JSON.parse(c.trim());
        if (o && typeof o === 'object' && Array.isArray(o.pages)) return o;
      } catch (_) {
        /* thử ứng viên khác */
      }
    }
    return null;
  }
  const fmt = (n) => Math.round(n).toLocaleString('vi-VN');

  // =============================================================== HỘP THOẠI
  function modal(html, cls = '') {
    const back = document.createElement('div');
    back.className = 'modal-backdrop imp-backdrop';
    back.innerHTML = `<div class="modal imp-modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
    const onKey = (e) => e.stopPropagation();
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(back);
    back._close = () => {
      window.removeEventListener('keydown', onKey, true);
      back.remove();
    };
    return back;
  }
  const pickFiles = (accept, multiple = true, dir = false) =>
    new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.multiple = multiple;
      if (accept) inp.accept = accept;
      if (dir) inp.webkitdirectory = true;
      inp.hidden = true;
      inp.addEventListener('change', () => {
        resolve([...inp.files]);
        inp.remove();
      });
      inp.addEventListener('cancel', () => {
        resolve([]);
        inp.remove();
      });
      document.body.appendChild(inp);
      inp.click();
    });

  /** Hỏi trước khi chuyển. Trả opts hoặc null (huỷ) */
  async function askOptions(pres, bag) {
    const ai = DE.ai && DE.ai.active();
    const info = ai ? await DE.ai.modelInfo(ai.provider, ai.model).catch(() => ({ ctx: 0, out: 0 })) : null;
    const curPages = DE.pages ? DE.pages.project().pages.length : 0;
    return new Promise((resolve) => {
      const st = { target: 'add', runJs: pres.some((p) => p.jsApp), method: 'auto', aiDraft: true, aiCdnCss: true, aiJs: false };
      const back = modal('', 'imp-ask');
      const box = back.firstElementChild;
      const missingAll = () => {
        const m = new Map();
        for (const p of pres) for (const [k, v] of p.missing) if (!findLocal(bag, p.it.path, v.ref)) m.set(k, v);
        return m;
      };
      const estimate = () => {
        const html = pres.reduce((a, p) => a + p.text.length, 0);
        const css = pres.reduce((a, p) => a + p.cssKB * 1024, 0);
        const js = pres.reduce((a, p) => a + p.scriptKB * 1024, 0);
        const skill = DE.buildPageSkill({ noFooter: true }).length + AI_RULES.length;
        let t = (skill + html + css) / 3.3 + (st.aiJs ? js / 3.3 : 0);
        if (st.aiCdnCss) t += pres.reduce((a, p) => a + p.remoteCss.length, 0) * 12000;
        if (st.aiDraft) t += (html / 3.3) * 0.7;
        return Math.round(t);
      };
      const render = () => {
        const miss = missingAll();
        const scripts = pres.reduce((a, p) => a + p.scripts, 0);
        const jsApp = pres.some((p) => p.jsApp);
        const names = pres.map((p) => p.it.name);
        const imgs = pres.reduce((a, p) => a + p.imgs, 0);
        const remoteCss = [...new Set(pres.flatMap((p) => p.remoteCss))];
        const tok = estimate();
        const over = info && info.ctx && tok > info.ctx;
        const near = info && info.ctx && tok > info.ctx * 0.8;
        const radio = (name, v, label, sub, dis) =>
          `<label class="imp-opt${dis ? ' dis' : ''}"><input type="radio" name="${name}" value="${v}"${st[name] === v ? ' checked' : ''}${dis ? ' disabled' : ''}><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span></label>`;
        const check = (name, label, sub) => `<label class="imp-opt"><input type="checkbox" name="${name}"${st[name] ? ' checked' : ''}><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span></label>`;
        box.innerHTML =
          `<h3>Nhập trang HTML</h3>` +
          `<p class="modal-msg">Tìm thấy <b>${names.length} trang</b>: ${esc(names.slice(0, 6).join(', '))}${names.length > 6 ? '…' : ''}${imgs ? ` · ${imgs} ảnh` : ''}${remoteCss.length ? ` · ${remoteCss.length} file CSS từ web` : ''}</p>` +
          '<div class="imp-body">' +
          `<section><h4>Đưa vào đâu</h4>${radio('target', 'add', 'Thêm thành trang mới vào dự án hiện tại', curPages ? `Dự án đang có ${curPages} trang` : '')}${radio('target', 'replace', 'Thay cả dự án bằng trang nhập vào', 'Vẫn hoàn tác được bằng Ctrl+Z')}${names.length === 1 ? radio('target', 'insert', 'Chèn vào cuối trang đang mở', '') : ''}</section>` +
          (miss.size
            ? `<section class="imp-warn"><h4>⚠ Thiếu ${miss.size} file trang dùng tới</h4><p class="imp-files">${[...miss.values()].slice(0, 12).map((v) => `<code>${esc(v.ref)}</code>`).join(' ')}${miss.size > 12 ? ` … và ${miss.size - 12} file khác` : ''}</p>` +
              '<div class="btn-row"><button type="button" class="btn" data-a="pick">Chọn các file này từ máy…</button><button type="button" class="btn" data-a="pick-dir">Chọn cả thư mục trang web…</button></div>' +
              '<p class="hint">Hoặc kéo thả cả thư mục trang web vào cửa sổ. Bỏ qua thì ảnh thiếu thành khung ảnh trống (thay ảnh được ở bước sau), CSS / font thiếu thì mất định dạng tương ứng.</p></section>'
            : '') +
          (scripts
            ? `<section><h4>JavaScript của trang (${scripts} đoạn)</h4>${check('runJs', 'Chạy JavaScript của trang trong khung cách ly', jsApp ? 'Trang này có vẻ dựng giao diện bằng JavaScript (React / Vue / Tailwind CDN…) – nên bật để lấy được nội dung.' : 'Thường không cần: chỉ bật khi nội dung / định dạng do script tạo ra.')}` +
              '<p class="hint">Script chạy trong khung tách biệt, không đọc được dữ liệu của ChillCat Studio, nhưng có thể tải dữ liệu từ mạng.</p></section>'
            : '') +
          `<section><h4>Cách chuyển</h4>${radio('method', 'auto', 'Tự động', 'Nhanh, không cần mạng – đo trang ngay trên máy để lấy màu, cỡ chữ, vị trí, hiệu ứng')}` +
          radio('method', 'ai', 'Nhờ AI chuyển' + (ai ? ` – ${esc(ai.providerName)} · ${esc(ai.model)}` : ''), ai ? 'Gửi trọn mã trang cho AI để dựng lại có cấu trúc hợp lý hơn (tốn token)' : 'Chưa cài đặt AI – vào tab Cài đặt để thêm nhà cung cấp và mô hình', !ai) +
          (st.method === 'ai' && ai
            ? '<div class="imp-sub">' +
              check('aiDraft', 'Gửi kèm bản chuyển tự động', 'AI dựa vào số đo thật nên chính xác hơn; tốn thêm khoảng 70% token') +
              (remoteCss.length ? check('aiCdnCss', `Gửi kèm ${remoteCss.length} file CSS từ web`, 'Tải về rồi gửi kèm (file không cho tải sẽ được báo)') : '') +
              (scripts ? check('aiJs', 'Gửi kèm mã JavaScript của trang', 'Chỉ cần khi giao diện do script dựng mà không chạy script') : '') +
              `<p class="imp-tok${over ? ' over' : near ? ' near' : ''}">≈ ${fmt(tok)} token gửi đi` +
              (info && info.ctx ? ` · ngữ cảnh của mô hình: ${fmt(info.ctx)} token${info.exact ? '' : ' (ước tính theo tên mô hình)'}` : ' · không rõ độ dài ngữ cảnh của mô hình') +
              (over ? '<br><b>Vượt độ dài ngữ cảnh – mô hình sẽ từ chối.</b> Bỏ bớt phần gửi kèm, chọn mô hình ngữ cảnh dài hơn, hoặc dùng cách Tự động.' : near ? '<br>Gần chạm giới hạn ngữ cảnh – câu trả lời có thể bị cắt.' : '') +
              ' Số chính xác được đếm lại trước khi gửi.</p></div>'
            : '') +
          '</section></div>' +
          '<div class="modal-actions"><button type="button" class="btn" data-a="cancel">Huỷ</button><button type="button" class="btn primary" data-a="ok">Chuyển đổi</button></div>';
      };
      render();
      box.addEventListener('change', (e) => {
        const t = e.target;
        if (!t.name) return;
        st[t.name] = t.type === 'checkbox' ? t.checked : t.value;
        render();
      });
      box.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-a]');
        if (!b) return;
        const a = b.dataset.a;
        if (a === 'cancel') {
          back._close();
          return resolve(null);
        }
        if (a === 'ok') {
          back._close();
          return resolve(st);
        }
        if (a === 'pick' || a === 'pick-dir') {
          const files = await pickFiles('', true, a === 'pick-dir');
          if (!files.length) return;
          addToBag(bag, files.map((f) => ({ file: f, path: f.webkitRelativePath || f.name })));
          // thư mục: đường dẫn có thêm tên thư mục gốc -> vẫn tra theo tên file
          render();
          toast(`Đã thêm ${files.length} file`, 'ok');
        }
      });
      back.addEventListener('click', (e) => {
        if (e.target === back) {
          back._close();
          resolve(null);
        }
      });
      box.querySelector('[data-a="ok"]').focus();
    });
  }

  /** Hộp tiến trình có nút Huỷ */
  function progress(title) {
    const ctl = new AbortController();
    const back = modal(`<h3>${esc(title)}</h3><p class="imp-step">Đang chuẩn bị…</p><div class="imp-bar"><i></i></div><p class="hint imp-extra"></p><div class="modal-actions"><button type="button" class="btn" data-a="stop">Huỷ</button></div>`, 'imp-progress');
    back.querySelector('[data-a="stop"]').addEventListener('click', () => ctl.abort());
    return {
      signal: ctl.signal,
      step: (s) => (back.querySelector('.imp-step').textContent = s),
      extra: (s) => (back.querySelector('.imp-extra').textContent = s || ''),
      close: () => back._close(),
    };
  }

  /** Xem lại kết quả + câu hỏi còn lại (font không có nguồn, ảnh không tải được). Trả true = áp dụng */
  function review(res, opts) {
    const G = res.G;
    const C = G.counts;
    let nodes = 0;
    for (const pg of res.pages) PK.walk(pg.children, () => void nodes++);
    const kept = [
      [C.hover, 'hiệu ứng khi di chuột qua / khi bấm'], [C.anim, 'chuyển động'], [C.pseudo, 'hình trang trí từ ::before / ::after'], [C.abs, 'thành phần đặt vị trí tự do'],
      [C.gradient, 'màu chuyển sắc'], [res.fonts.length, 'font riêng'], [C.svg, 'hình SVG (giữ nguyên dạng ảnh)'], [C.menu, 'menu'], [C.form, 'biểu mẫu'], [C.grid, 'lưới nhiều cột'],
    ].filter(([n]) => n);
    const lost = [
      [C.inlineIcon, 'biểu tượng nằm trong chữ / nút không đổi được thành ký tự → bỏ'], [C.media, 'video / khung nhúng → khung ảnh (ảnh bìa nếu có)'], [C.jsButton, 'nút chạy JavaScript → nút không làm gì (gắn lại liên kết sau)'],
      [C.blockLink, 'liên kết bọc cả khối / ảnh → giữ nội dung, mất liên kết'], [C.borderSide, 'viền chỉ một cạnh → bỏ'], [C.radio, 'nút chọn (radio) → ô đánh dấu'], [C.fieldType, 'ô nhập kiểu đặc biệt (file, màu, thanh trượt) → ô chữ'],
      [C.relLink, 'liên kết tương đối tới trang không được nhập → giữ nguyên địa chỉ'], [C.missingBg, 'ảnh nền không tìm thấy'], [C.error, 'phần tử lỗi khi chuyển → bỏ'],
    ].filter(([n]) => n);
    if (res.blocked && res.blocked.length) lost.push([res.blocked.length, 'file CSS từ web không đọc được luật (hover / keyframes / font) do chặn CORS – màu sắc, bố cục vẫn giữ']);
    if (res.cut) lost.push([1, 'trang quá lớn – chỉ chuyển 9000 phần tử đầu']);
    return new Promise((resolve) => {
      const pend = [...G.pending.values()];
      const back = modal('', 'imp-review');
      const box = back.firstElementChild;
      const render = () => {
        const bad = G.bad.filter((b) => !b.node.props.src);
        // kết quả của AI: các con số đo đạc thuộc bản chuyển tự động -> không liệt kê để khỏi hiểu nhầm
        const ai = !!res.ai;
        box.innerHTML =
          `<h3>Kết quả chuyển đổi</h3><p class="modal-msg"><b>${res.pages.length} trang · ${nodes} thành phần</b>${ai ? ' · do AI dựng' : opts.method === 'ai' ? ' · dùng kết quả chuyển tự động' : ''}</p><div class="imp-body">` +
          (ai
            ? '<section><p class="hint">AI đã dựng lại trang từ mã HTML. Xem lại các trang sau khi thêm – mọi thay đổi hoàn tác được bằng Ctrl+Z.' +
              (C.cssFetch ? ` ${C.cssFetch} file CSS từ web không tải được để gửi kèm (máy chủ chặn) – AI chỉ thấy tên class.` : '') +
              '</p></section>'
            : '') +
          (!ai && kept.length ? `<section><h4>Đã giữ được</h4><ul class="imp-list ok">${kept.map(([n, s]) => `<li><b>${n}</b> ${esc(s)}</li>`).join('')}</ul></section>` : '') +
          (!ai && lost.length ? `<section><h4>Gần đúng / bỏ qua</h4><ul class="imp-list">${lost.map(([n, s]) => `<li><b>${n}</b> ${esc(s)}</li>`).join('')}</ul></section>` : '') +
          (pend.length
            ? `<section><h4>Font không tìm thấy nguồn (${pend.length})</h4><p class="hint">Trang dùng các font này nhưng không kèm file font. Lấy từ Google Fonts nếu có, không thì dùng font gần nhất.</p>` +
              pend.map((p, i) => `<label class="imp-opt"><input type="checkbox" data-font="${i}"${p.google ? ' checked' : ''}><span><b>${esc(p.family)}</b><small>Lấy từ Google Fonts · bỏ chọn = dùng ${esc((PK.FONTS[p.fallback] || PK.FONTS.system).name)}</small></span></label>`).join('') +
              '</section>'
            : '') +
          (!ai && bad.length
            ? `<section class="imp-warn"><h4>Ảnh không tải được (${bad.length})</h4><p class="imp-files">${[...new Set(bad.map((b) => b.ref.split('/').pop()))].slice(0, 14).map((s) => `<code>${esc(s || 'ảnh')}</code>`).join(' ')}</p>` +
              '<div class="btn-row"><button type="button" class="btn" data-a="imgs">Chọn ảnh từ máy (khớp theo tên file)…</button></div><p class="hint">Bỏ qua thì các ảnh này hiện khung ảnh trống – thay sau bằng “Tải ảnh từ máy…”.</p></section>'
            : '') +
          '</div><div class="modal-actions"><button type="button" class="btn" data-a="cancel">Huỷ</button><button type="button" class="btn primary" data-a="ok">' +
          (opts.target === 'replace' ? 'Thay dự án' : opts.target === 'insert' ? 'Chèn vào trang' : `Thêm ${res.pages.length} trang`) +
          '</button></div>';
        pend.forEach((p, i) => {
          const cb = box.querySelector(`[data-font="${i}"]`);
          if (cb) cb.checked = p.google;
        });
      };
      render();
      box.addEventListener('change', (e) => {
        const i = e.target.dataset.font;
        if (i != null) pend[+i].google = e.target.checked;
      });
      box.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-a]');
        if (!b) return;
        if (b.dataset.a === 'cancel') {
          back._close();
          return resolve(false);
        }
        if (b.dataset.a === 'ok') {
          back._close();
          return resolve(true);
        }
        if (b.dataset.a === 'imgs') {
          const files = await pickFiles('image/*', true);
          let n = 0;
          for (const f of files) {
            const key = lower(f.name);
            const hits = G.bad.filter((x) => !x.node.props.src && baseName(x.ref) === key);
            if (!hits.length) continue;
            const it = { file: f, path: f.name, name: key };
            const url = await fileData({ cache: new Map() }, it, 'img').catch(() => null);
            if (!url) continue;
            for (const h of hits) h.node.props.src = url;
            n += hits.length;
          }
          toast(n ? `Đã gắn ${n} ảnh` : 'Không có file nào trùng tên ảnh bị thiếu', n ? 'ok' : 'warn');
          render();
        }
      });
    });
  }

  // =============================================================== LUỒNG CHÍNH
  let busy = false;
  /** Mở luồng nhập: entries = [{ file, path }] (file HTML + ảnh / CSS / font đi kèm) */
  IMP.open = async function (entries) {
    if (busy) return toast('Đang nhập một trang HTML khác…', 'info');
    if (!DE.pages) return;
    const bag = makeBag(entries || []);
    const htmls = bag.files.filter((f) => isHtmlName(f.name)).slice(0, 30);
    if (!htmls.length) return toast('Không có file .html nào', 'warn');
    // index.html lên đầu
    htmls.sort((a, b) => (/^(index|default|home)\.html?$/.test(b.name) ? 1 : 0) - (/^(index|default|home)\.html?$/.test(a.name) ? 1 : 0) || a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path));
    busy = true;
    let pg = null;
    try {
      const pres = [];
      for (const h of htmls) pres.push(await prescan(h, bag));
      const opts = await askOptions(pres, bag);
      if (!opts) return;
      pg = progress('Đang chuyển trang HTML…');
      const items = [];
      for (let i = 0; i < pres.length; i++) {
        const p = pres[i];
        pg.step(`Dựng và đo trang ${i + 1}/${pres.length}: ${p.it.name}`);
        const nonce = DE.uid('n');
        const prep = await prepare(p, bag, opts, nonce);
        const { snap, mob } = await snapshot(prep.srcdoc, nonce, opts, pg.signal);
        items.push({ pre: p, snap, mob, aiDoc: prep.aiDoc });
      }
      pg.step('Chuyển thành thành phần…');
      await new Promise((r) => setTimeout(r, 20));
      const conv = convertAll(items);
      const G = conv.G;
      let res = {
        name: (items[0].snap.title || items[0].pre.title || items[0].pre.it.name.replace(/\.(html?|xhtml)$/i, '')).slice(0, 120),
        pages: conv.pages, theme: conv.theme, G, fonts: [],
        blocked: [...new Set(items.flatMap((x) => x.snap.rules.blocked || []))], cut: items.some((x) => x.snap.cut),
      };
      res.fonts = [...G.fonts.values()];
      if (opts.method === 'ai') {
        const out = await runAI(items, res, opts, pg);
        if (!out) return;
        res = out;
      }
      pg.close();
      pg = null;
      if (!(await review(res, opts))) return;
      apply(res, opts, htmls);
    } catch (e) {
      if (e && e.name === 'AbortError') toast('Đã huỷ nhập trang', 'info');
      else {
        console.error(e);
        toast('Không nhập được trang: ' + ((e && e.message) || e), 'error');
      }
    } finally {
      if (pg) pg.close();
      busy = false;
    }
  };
  /** Dán mã HTML (không có file) */
  IMP.openText = function (html, name = 'trang-dan.html') {
    const file = new File([html], name, { type: 'text/html' });
    return IMP.open([{ file, path: name }]);
  };
  /** Nút "Nhập HTML" trên thanh công cụ: chọn file / thư mục / dán mã */
  IMP.start = function () {
    const back = modal(
      '<h3>Nhập trang HTML</h3><p class="modal-msg">Chuyển một trang web có sẵn thành các thành phần kéo thả được: giữ màu sắc, font, bố cục, hiệu ứng di chuột, chuyển động, ::before / ::after, chữ đậm và liên kết giữa câu.</p>' +
        '<div class="btn-row imp-start"><button type="button" class="btn primary" data-a="files">Chọn file HTML (kèm ảnh, CSS, font)…</button><button type="button" class="btn" data-a="dir">Chọn cả thư mục trang web…</button></div>' +
        '<p class="hint">Có thể kéo thả file .html hoặc cả thư mục vào cửa sổ khi đang ở tab Thiết kế trang.</p>' +
        '<label class="imp-paste"><span>Hoặc dán mã HTML</span><textarea class="code" rows="8" spellcheck="false" placeholder="<!doctype html>…"></textarea></label>' +
        '<div class="modal-actions"><button type="button" class="btn" data-a="cancel">Huỷ</button><button type="button" class="btn primary" data-a="paste">Chuyển mã đã dán</button></div>',
      'imp-startbox'
    );
    const box = back.firstElementChild;
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'cancel') return back._close();
      if (a === 'paste') {
        const v = box.querySelector('textarea').value;
        if (!/<[a-z!]/i.test(v)) return toast('Chưa dán mã HTML', 'warn');
        back._close();
        return IMP.openText(v);
      }
      const files = await pickFiles(a === 'files' ? '.html,.htm,.xhtml,.css,.js,image/*,.svg,.woff,.woff2,.ttf,.otf' : '', true, a === 'dir');
      if (!files.length) return;
      back._close();
      IMP.open(files.map((f) => ({ file: f, path: f.webkitRelativePath || f.name })));
    });
    back.addEventListener('click', (e) => e.target === back && back._close());
    box.querySelector('[data-a="files"]').focus();
  };

  async function runAI(items, res, opts, pg) {
    const a = DE.ai.active();
    if (!a) {
      toast('Chưa cài đặt AI – dùng kết quả chuyển tự động', 'warn');
      return res;
    }
    pg.step('Chuẩn bị nội dung gửi AI…');
    const draft = { name: items[0].snap.title || items[0].pre.it.name, theme: res.theme, fonts: res.fonts, pages: res.pages };
    const req = await buildAiRequest(items, draft, opts, pg.signal);
    const info = await DE.ai.modelInfo(a.provider, a.model);
    pg.step('Đếm token…');
    const exact = await DE.ai.countTokens({ system: req.system, messages: req.messages, signal: pg.signal });
    const tok = exact != null ? exact : DE.ai.estimateTokens(req.system) + DE.ai.estimateTokens(req.messages[0].content);
    // cảnh báo khi gần / vượt độ dài ngữ cảnh
    if ((info.ctx && tok > info.ctx * 0.8) || (!info.ctx && tok > 100000)) {
      const over = info.ctx && tok > info.ctx;
      const r = await DE.ui.confirm({
        title: over ? 'Vượt độ dài ngữ cảnh của mô hình' : 'Nội dung gửi AI rất dài',
        message:
          `Nội dung ${exact != null ? '' : '≈ '}${fmt(tok)} token${info.ctx ? ` – giới hạn ngữ cảnh của ${a.model} là ${fmt(info.ctx)} token${info.exact ? '' : ' (ước tính)'}` : ` – không rõ giới hạn ngữ cảnh của ${a.model}`}.\n` +
          (over ? 'Mô hình sẽ từ chối yêu cầu này. ' : 'Câu trả lời có thể bị cắt hoặc tốn nhiều chi phí. ') +
          'Dùng kết quả chuyển tự động, hay vẫn gửi?',
        ok: 'Vẫn gửi cho AI',
        alt: 'Dùng kết quả tự động',
        cancel: 'Huỷ',
        danger: !!over,
      });
      if (r === 'alt') return res;
      if (!r) return null;
    }
    const t0 = Date.now();
    pg.step(`Đang chờ ${a.providerName} trả lời…`);
    const tick = setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      pg.extra(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · đã gửi ${exact != null ? '' : '≈ '}${fmt(tok)} token${gotChars ? ` · đã nhận ${fmt(gotChars)} ký tự` : ''}`);
    }, 1000);
    let gotChars = 0;
    let out;
    try {
      out = await DE.ai.chat({
        system: req.system,
        messages: req.messages,
        signal: pg.signal,
        maxTokens: Math.min(info.out || 32000, 128000),
        numCtx: info.ctx || 0,
        onProgress: (n) => (gotChars = n),
      });
    } finally {
      clearInterval(tick);
    }
    if (out.truncated) {
      const r = await DE.ui.confirm({ title: 'Câu trả lời của AI bị cắt', message: 'Mô hình dừng giữa chừng (vượt giới hạn độ dài câu trả lời) nên không có dự án hoàn chỉnh.\nDùng kết quả chuyển tự động thay thế?', ok: 'Dùng kết quả tự động', cancel: 'Huỷ' });
      return r ? res : null;
    }
    const o = extractProject(out.text || '');
    if (!o) {
      const r = await DE.ui.confirm({ title: 'AI không trả về dự án', message: 'Câu trả lời không có khối JSON dự án hợp lệ.\nDùng kết quả chuyển tự động thay thế?', ok: 'Dùng kết quả tự động', cancel: 'Huỷ' });
      return r ? res : null;
    }
    restoreData(o, req.map);
    const pages = (o.pages || []).filter((p) => p && typeof p === 'object');
    if (!pages.length) return res;
    // giữ id trang để liên kết giữa các trang đúng
    const G = res.G;
    G.counts = Object.assign({}, G.counts);
    if (req.failedCss.length) G.counts.cssFetch = req.failedCss.length;
    return {
      name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 120) : res.name,
      pages,
      theme: Object.assign({}, res.theme, o.theme || {}),
      fonts: Array.isArray(o.fonts) ? o.fonts : res.fonts,
      G,
      blocked: res.blocked,
      cut: res.cut,
      ai: true,
    };
  }

  /** Đưa kết quả vào dự án (hoàn tác được) */
  function apply(res, opts, htmls) {
    const G = res.G;
    // font chờ quyết định
    const fonts = (res.fonts || []).slice();
    const swap = new Map();
    for (const p of G.pending.values()) {
      // không biết font có những độ đậm nào trên Google Fonts -> chỉ xin bản thường (xin độ đậm không có sẽ làm hỏng cả liên kết)
      if (p.google) {
        if (!fonts.some((f) => f.id === p.id)) fonts.push({ id: p.id, name: p.family, family: p.family, google: { weights: [], italic: false } });
      } else swap.set(p.id, p.fallback);
    }
    const fix = (P) => {
      if (P && P.font && swap.has(P.font)) P.font = swap.get(P.font);
    };
    const theme = Object.assign({}, res.theme);
    if (swap.has(theme.font)) theme.font = swap.get(theme.font);
    for (const pg of res.pages)
      PK.walk(pg.children || [], (n) => {
        fix(n.props);
        if (n.props && typeof n.props.text === 'string' && /\{f:cf-/.test(n.props.text)) n.props.text = n.props.text.replace(/\{f:(cf-[a-z0-9-]+)\}/g, (m, id) => (swap.has(id) ? `{f:${swap.get(id)}}` : m));
      });
    const usedFonts = new Set([theme.font]);
    for (const pg of res.pages)
      PK.walk(pg.children || [], (n) => {
        if (n.props && n.props.font) usedFonts.add(n.props.font);
        if (n.props && typeof n.props.text === 'string') for (const m of n.props.text.matchAll(/\{[^}]*f:(cf-[a-z0-9-]+)/g)) usedFonts.add(m[1]);
        for (const it of (n.props && n.props.items) || []) for (const m of String(it).matchAll(/\{[^}]*f:(cf-[a-z0-9-]+)/g)) usedFonts.add(m[1]);
      });
    const keepFonts = fonts.filter((f) => usedFonts.has(f.id));
    const cur = DE.pages.project();
    let proj, page = null;
    const name = res.name || (htmls[0] && htmls[0].name.replace(/\.html?$/i, '')) || 'Trang nhập';
    const mergeFonts = (a, b) => {
      const out = (a || []).slice();
      for (const f of b) if (!out.some((x) => x.id === f.id)) out.push(f);
      return out;
    };
    if (opts.target === 'replace') {
      proj = { kind: 'de-page', version: 1, name: String(name).slice(0, 120), theme, fonts: keepFonts, pages: res.pages, script: '' };
    } else if (opts.target === 'insert') {
      proj = cur;
      const pgCur = DE.pages.currentPageId ? proj.pages.find((p) => p.id === DE.pages.currentPageId()) || proj.pages[0] : proj.pages[0];
      pgCur.children.push(...(res.pages[0].children || []));
      proj.fonts = mergeFonts(proj.fonts, keepFonts);
      page = pgCur.id;
    } else {
      proj = cur;
      // trang nhập không được trùng đường dẫn với trang có sẵn
      const used = new Set(proj.pages.map((p) => p.path));
      for (const p of res.pages) {
        if (p.path === 'index' || used.has(p.path)) {
          let k = 2;
          const b = p.path === 'index' ? PK.slug(p.name) || 'trang-nhap' : p.path;
          let path = b;
          while (used.has(path)) path = `${b}-${k++}`;
          p.path = path;
        }
        used.add(p.path);
      }
      proj.pages.push(...res.pages);
      proj.fonts = mergeFonts(proj.fonts, keepFonts);
      page = res.pages[0].id;
    }
    const r = DE.pages.applyImport(proj, page);
    const n = r.fixed.length + r.removed.length;
    if (n) console.info('[Nhập HTML] App tự điều chỉnh:\n' + r.removed.concat(r.fixed).join('\n'));
    toast(`Đã nhập ${res.pages.length} trang${res.ai ? ' (AI dựng)' : ''}${n ? ` – app tự sửa ${n} giá trị không hợp lệ` : ''} · Ctrl+Z để hoàn tác`, 'ok');
  }

  /** Cho kiểm thử */
  IMP._ = { prescan, prepare, snapshot, convertAll, makeBag, parseGradient, toColor, buildAiRequest, extractProject, restoreData, tokenizeData };
})(window.DE);
