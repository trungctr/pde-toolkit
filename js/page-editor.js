/* =========================================================================
 * Thiết kế trang – giao diện soạn (tab "Thiết kế trang")
 *  - Khung trang là iframe (sandbox, không chạy script) để CSS của trang không
 *    lẫn với app và responsive đúng theo bề rộng thiết bị đang xem.
 *  - Một lớp phủ trong suốt nằm trên iframe nhận mọi thao tác chuột:
 *    chọn, rê chuột, kéo thả, nhấn đúp để sửa chữ.
 *  - Bên trái: thư viện thành phần + cây lớp. Bên phải: thuộc tính theo nhóm.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const PK = DE.pagekit;
  const esc = DE.esc;
  const TYPES = PK.TYPES;
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];
  const toast = (m, t) => DE.ui && DE.ui.toast(m, t);
  const PG = (DE.pages = {});
  const KEY = 'diagram-editor:page:v1';
  const UI_KEY = 'diagram-editor:page-ui';
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

  const DEVICES = {
    desktop: { name: 'Máy tính', w: 0, h: 0 },
    tablet: { name: 'Máy tính bảng', w: 768, h: 1024 },
    phone: { name: 'Điện thoại', w: 390, h: 844 },
  };

  // =============================================================== TRẠNG THÁI
  const S = { proj: null, undo: [], redo: [], mergeKey: null, mergeT: 0, dirty: false };
  const st = { page: null, sel: null, hover: null, device: 'desktop', outline: false, fx: '', ptab: 'parts', itab: 'props', editing: null, drag: null, collapsed: new Set(), groups: {} };
  let ready = false;
  let clip = null; // thành phần đã sao chép (Ctrl+C)
  let aiBackup = null, aiImgs = {};
  let frame, fdoc, froot, canvas, stage, overlay;
  let view = { W: 1024, H: 720, s: 1 };

  const active = () => !!(DE.docs && DE.docs.current() === 'design');
  const curPage = () => S.proj.pages.find((p) => p.id === st.page) || S.proj.pages[0];
  const pageIn = (proj) => proj.pages.find((p) => p.id === st.page) || proj.pages[0];
  const find = (id) => (id ? PK.find(S.proj, id) : null);
  const nodeOf = (id) => {
    const f = find(id);
    return f ? f.node : null;
  };
  const theme = () => PK.resolveTheme(S.proj.theme);
  const elOf = (id) => (id && froot ? froot.querySelector(`[data-pid="${CSS.escape(id)}"]`) : null);
  const childrenOf = (parentId, proj = S.proj) => (parentId ? PK.find(proj, parentId).node.children : pageIn(proj).children);
  /** Các thành phần từ gốc trang tới id (gồm cả id) */
  function pathTo(id) {
    const out = [];
    const look = (list) => {
      for (const n of list) {
        out.push(n);
        if (n.id === id) return true;
        if (n.children && look(n.children)) return true;
        out.pop();
      }
      return false;
    };
    look(curPage().children);
    return out;
  }
  const countNodes = (list) => {
    let c = 0;
    PK.walk(list, () => {
      c++;
    });
    return c;
  };
  function shortName(n) {
    if (!n) return '';
    const T = TYPES[n.type];
    if (n.name) return n.name;
    const P = n.props || {};
    let s = n.type === 'menu' ? P.menuName || 'Menu' : PK.plain(P.text) || P.label || (n.type === 'image' ? P.alt : '') || '';
    if (n.type === 'divider') return { hr: 'Thanh ngang', vr: 'Thanh dọc', space: 'Khoảng trống' }[P.kind || 'hr'];
    if (n.type === 'button' && !s && P.icon) s = P.icon;
    s = String(s).replace(/\s+/g, ' ').trim();
    return s ? `${T.name}: ${s.length > 26 ? s.slice(0, 25) + '…' : s}` : T.name;
  }

  // =============================================================== LỊCH SỬ
  // Giới hạn lịch sử theo số bước và theo dung lượng (dự án có ảnh tải lên có thể nặng vài MB mỗi bản)
  const UNDO_MAX = 150, UNDO_CHARS = 40e6;
  function pushUndo(snap) {
    S.undo.push(snap);
    if (S.undo.length > UNDO_MAX) S.undo.shift();
    let total = 0;
    for (let i = S.undo.length - 1; i >= 0; i--) {
      total += S.undo[i].length;
      if (total > UNDO_CHARS && i < S.undo.length - 5) {
        S.undo.splice(0, i + 1);
        break;
      }
    }
  }
  function commit(fn, merge) {
    const before = JSON.stringify(S.proj);
    fn(S.proj);
    const after = JSON.stringify(S.proj);
    if (before === after) return false;
    const now = Date.now();
    if (!(merge && S.mergeKey === merge && now - S.mergeT < 1500)) pushUndo(before);
    S.mergeKey = merge || null;
    S.mergeT = now;
    S.redo = [];
    S.dirty = true;
    changed();
    return true;
  }
  function changed(full) {
    fixState();
    render();
    persist();
    updateTitles();
    if (full) renderInspector();
  }
  function undo() {
    finishEdit(true);
    if (!S.undo.length) return toast('Không còn gì để hoàn tác', 'info');
    S.redo.push(JSON.stringify(S.proj));
    S.proj = JSON.parse(S.undo.pop());
    S.mergeKey = null;
    S.dirty = true;
    changed(true);
  }
  function redo() {
    finishEdit(true);
    if (!S.redo.length) return toast('Không còn gì để làm lại', 'info');
    pushUndo(JSON.stringify(S.proj));
    S.proj = JSON.parse(S.redo.pop());
    S.mergeKey = null;
    S.dirty = true;
    changed(true);
  }
  /** Thay cả dự án (mở file, AI, dự án mới) – hoàn tác được */
  function load(proj, { history = true, page = null, dirty = true } = {}) {
    finishEdit(false);
    if (history && S.proj) {
      pushUndo(JSON.stringify(S.proj));
      S.redo = [];
    }
    S.proj = proj;
    S.mergeKey = null;
    S.dirty = dirty;
    st.page = page && proj.pages.some((p) => p.id === page) ? page : proj.pages[0].id;
    st.sel = st.hover = null;
    st.fx = '';
    if (canvas) canvas.scrollTop = 0;
    changed(true);
  }
  function fixState() {
    if (!S.proj.pages.some((p) => p.id === st.page)) st.page = S.proj.pages[0].id;
    const ok = (id) => {
      const f = find(id);
      return f && f.page.id === st.page;
    };
    if (st.sel && !ok(st.sel)) st.sel = null;
    if (st.hover && !ok(st.hover)) st.hover = null;
  }

  let quotaWarned = false;
  const persist = DE.debounce(() => {
    const saved = lsSet(KEY, JSON.stringify({ proj: S.proj, page: st.page, dirty: S.dirty }));
    if (!saved && !quotaWarned) {
      quotaWarned = true;
      toast('Dự án quá lớn để tự lưu vào trình duyệt (thường do ảnh tải lên) – hãy bấm Tải xuống JSON để giữ bản sao', 'warn');
    }
  }, 500);
  const saveUI = () => lsSet(UI_KEY, JSON.stringify({ device: st.device, outline: st.outline, ptab: st.ptab, groups: st.groups }));

  // =============================================================== KHUNG TRANG
  function initFrame() {
    frame = $('#pg-frame');
    fdoc = frame.contentDocument;
    fdoc.open();
    fdoc.write(
      '<!doctype html><html lang="vi"><head><meta charset="utf-8">' +
        `<style id="pg-fonts"></style><style>${PK.BASE_CSS}\n${PK.EDIT_CSS}</style><style id="pg-theme"></style><style id="pg-css"></style>` +
        '</head><body class="pg-edit"><div id="pg-root" class="pg-page"></div></body></html>'
    );
    fdoc.close();
    froot = fdoc.getElementById('pg-root');
    new ResizeObserver(scheduleSync).observe(froot);
    // ảnh tải xong làm trang cao lên
    fdoc.addEventListener('load', () => syncSize(), true);
    // khung trang không bao giờ tự cuộn (iframe cao bằng nội dung) – nếu có (focus, scrollIntoView…) thì kéo về để lớp phủ luôn khớp
    fdoc.addEventListener('scroll', () => {
      const se = fdoc.scrollingElement;
      if (se && (se.scrollTop || se.scrollLeft)) {
        se.scrollTop = 0;
        se.scrollLeft = 0;
        drawOverlay();
      }
    });
  }

  /** Các menu cần mở trong khung soạn: menu đang chọn hoặc chứa thành phần đang chọn */
  const openMenusFor = (id) => pathTo(id).filter((n) => n.type === 'menu').map((n) => n.id);
  let openKey = '';
  function render() {
    if (!ready || st.editing) return;
    const page = curPage();
    const open = st.sel ? openMenusFor(st.sel) : [];
    openKey = open.join();
    const out = PK.renderPage(S.proj, page, { edit: true, openMenus: new Set(open) });
    fdoc.getElementById('pg-theme').textContent = PK.themeCSS(S.proj.theme, S.proj);
    fdoc.getElementById('pg-css').textContent = out.css;
    // font: Google Fonts (@import) + font riêng tải lên (@font-face); chỉ ghi lại khi đổi để không tải lại
    const fa = PK.fontAssets(S.proj, out.fonts);
    const fcss = fa.links.map((u) => `@import url(${JSON.stringify(u)});`).join('\n') + '\n' + fa.css;
    const fst = fdoc.getElementById('pg-fonts');
    if (fst.textContent !== fcss) fst.textContent = fcss;
    froot.className = 'pg-page ' + page.id;
    froot.innerHTML = out.html || '<div class="pg-ed-empty">Trang trống – kéo thành phần từ thư viện bên trái vào đây,<br>hoặc bấm vào một thành phần để thêm vào trang.</div>';
    fdoc.body.classList.toggle('pg-outline', st.outline);
    applyFx();
    syncSize();
    drawOverlay();
    renderLayers();
    renderPages();
    updateStatus();
  }

  // ResizeObserver: đo lại ở khung hình kế tiếp (đổi kích thước ngay trong callback gây lỗi "ResizeObserver loop")
  let syncRaf = 0;
  function scheduleSync() {
    if (syncRaf) return;
    syncRaf = requestAnimationFrame(() => {
      syncRaf = 0;
      syncSize();
      drawOverlay();
    });
  }
  function syncSize() {
    if (!ready) return;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw) return; // tab đang ẩn
    const pad = cw < 600 ? 12 : 28;
    const avail = Math.max(200, cw - pad * 2);
    const dev = DEVICES[st.device];
    const W = dev.w || Math.max(1024, avail);
    const s = Math.min(1, avail / W);
    const minH = dev.h || Math.max(480, Math.round((ch - pad * 2) / s));
    froot.style.setProperty('--pg-vh', minH + 'px');
    if (frame.style.width !== W + 'px') frame.style.width = W + 'px';
    const H = Math.max(minH, Math.ceil(froot.getBoundingClientRect().height));
    frame.style.height = H + 'px';
    frame.style.transform = s === 1 ? '' : `scale(${s})`;
    stage.style.width = Math.round(W * s) + 'px';
    stage.style.height = Math.round(H * s) + 'px';
    stage.style.margin = `${pad}px auto`;
    const changedScale = view.s !== s || view.W !== W;
    view = { W, H, s };
    if (changedScale) updateStatus();
  }

  function applyFx() {
    $$('.is-hover,.is-press', froot).forEach((el) => el.classList.remove('is-hover', 'is-press'));
    if (st.sel && st.fx) {
      const el = elOf(st.sel);
      if (el) el.classList.add(st.fx === 'press' ? 'is-press' : 'is-hover');
    }
  }
  function setFx(v) {
    st.fx = v || '';
    applyFx();
    requestAnimationFrame(drawOverlay);
    $$('#pg-props [data-fx]').forEach((b) => b.classList.toggle('on', b.dataset.fx === st.fx));
  }

  // =============================================================== LỚP PHỦ
  const ICO = {
    parent: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 016 6v5"/></svg>',
    move: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>',
    up: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    dup: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8h12v12H8zM16 8V4H4v12h4"/></svg>',
    del: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  };
  function initOverlay() {
    overlay.innerHTML =
      '<div class="pgo-box pgo-hover" hidden><span class="pgo-tag"></span></div>' +
      '<div class="pgo-box pgo-sel" hidden></div>' +
      '<div class="pgo-dropbox" hidden><span class="pgo-tag"></span></div><div class="pgo-line" hidden></div>' +
      `<div class="pgo-chip" hidden><span class="pgo-name"></span>` +
      `<button type="button" data-o="parent" title="Chọn khung chứa (Esc)">${ICO.parent}</button>` +
      `<button type="button" data-o="move" class="pgo-move" title="Giữ và kéo để di chuyển">${ICO.move}</button>` +
      `<button type="button" data-o="up" title="Lên trước (Alt+↑)">${ICO.up}</button>` +
      `<button type="button" data-o="down" title="Xuống sau (Alt+↓)">${ICO.down}</button>` +
      `<button type="button" data-o="dup" title="Nhân bản (Ctrl+D)">${ICO.dup}</button>` +
      `<button type="button" data-o="del" class="pgo-del" title="Xoá (Delete)">${ICO.del}</button></div>`;

    overlay.addEventListener('pointermove', (e) => {
      if (st.drag || st.editing || e.target.closest('.pgo-chip')) return;
      const p = toFrame(e.clientX, e.clientY);
      setHover(hit(p.x, p.y));
    });
    overlay.addEventListener('pointerleave', () => !st.drag && setHover(null));
    overlay.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || st.editing) return;
      const ob = e.target.closest('[data-o]');
      if (ob) {
        e.preventDefault();
        if (ob.dataset.o === 'move' && st.sel) beginDrag({ kind: 'move', id: st.sel, x0: e.clientX, y0: e.clientY });
        return;
      }
      if (e.target.closest('.pgo-chip')) return;
      e.preventDefault();
      if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
      const p = toFrame(e.clientX, e.clientY);
      const id = hit(p.x, p.y);
      select(id);
      const n = id ? nodeOf(id) : null;
      // thành phần đặt tự do: kéo để đổi vị trí (đổi chỗ trong cây bằng nút ✥ trên nhãn)
      if (n && TYPES[n.type].keys.has('pos') && /^(absolute|fixed)$/.test(PK.resolve(n, theme()).pos)) return beginNudge(e, id);
      if (id) beginDrag({ kind: 'move', id, x0: e.clientX, y0: e.clientY });
    });
    overlay.addEventListener('click', (e) => {
      const ob = e.target.closest('[data-o]');
      if (!ob) return;
      ({ parent: selectParent, up: () => moveBy(-1), down: () => moveBy(1), dup: duplicate, del: remove })[ob.dataset.o]?.();
    });
    overlay.addEventListener('dblclick', (e) => {
      if (e.target.closest('.pgo-chip')) return;
      const p = toFrame(e.clientX, e.clientY);
      const id = hit(p.x, p.y);
      if (!id) return;
      select(id);
      if (!startEdit(id, p)) {
        const n = nodeOf(id);
        if (n && TYPES[n.type].container) return; // khung chứa: không có chữ để sửa
        focusFirstField();
      }
    });
    overlay.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Kéo thành phần đặt tự do: cập nhật khoảng cách tới mép (giữ mép đang dùng: trái/phải, trên/dưới) */
  function beginNudge(e, id) {
    const el = elOf(id), n = nodeOf(id);
    if (!el || !n) return;
    const P = PK.resolve(n, theme());
    const cs = fdoc.defaultView.getComputedStyle(el);
    const useR = P.posRight != null && P.posRight !== '' && (P.posLeft == null || P.posLeft === '');
    const useB = P.posBottom != null && P.posBottom !== '' && (P.posTop == null || P.posTop === '');
    const sx = parseFloat(useR ? cs.right : cs.left) || 0, sy = parseFloat(useB ? cs.bottom : cs.top) || 0;
    const x0 = e.clientX, y0 = e.clientY;
    let last = null;
    const move = (ev) => {
      const dx = (ev.clientX - x0) / view.s, dy = (ev.clientY - y0) / view.s;
      if (!last && Math.hypot(dx, dy) < 3) return;
      ev.preventDefault();
      last = [Math.round(useR ? sx - dx : sx + dx), Math.round(useB ? sy - dy : sy + dy)];
      el.style[useR ? 'right' : 'left'] = last[0] + 'px';
      el.style[useB ? 'bottom' : 'top'] = last[1] + 'px';
      drawOverlay();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!last) return;
      commit((proj) => {
        const x = PK.find(proj, id);
        if (!x) return;
        const p = x.node.props;
        p[useR ? 'posRight' : 'posLeft'] = last[0];
        p[useB ? 'posBottom' : 'posTop'] = last[1];
      });
      renderInspector();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
  function toFrame(cx, cy) {
    const r = stage.getBoundingClientRect();
    return { x: (cx - r.left) / view.s, y: (cy - r.top) / view.s };
  }
  /** Thành phần dưới điểm (toạ độ trong khung). Thanh ngang/dọc mảnh: nới vùng bấm 6px */
  function hit(x, y) {
    const el = fdoc.elementFromPoint(x, y);
    if (!el) return null;
    let t = el.closest('[data-pid]');
    for (const c of (t || froot).querySelectorAll('.pg-hr,.pg-vr')) {
      const r = c.getBoundingClientRect();
      if (r.width + r.height && x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6) {
        t = c;
        break;
      }
    }
    return t ? t.dataset.pid : null;
  }
  const rectIn = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left * view.s, y: r.top * view.s, w: r.width * view.s, h: r.height * view.s };
  };
  function placeBox(box, el) {
    const r = el ? rectIn(el) : null;
    if (!r || (!r.w && !r.h)) {
      box.hidden = true;
      return null;
    }
    box.hidden = false;
    Object.assign(box.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    return r;
  }
  function drawOverlay() {
    if (!ready || !overlay) return;
    const hb = $('.pgo-hover', overlay);
    const hv = st.hover && st.hover !== st.sel && !st.drag ? elOf(st.hover) : null;
    if (placeBox(hb, hv)) $('.pgo-tag', hb).textContent = shortName(nodeOf(st.hover));
    const r = placeBox($('.pgo-sel', overlay), st.sel ? elOf(st.sel) : null);
    const chip = $('.pgo-chip', overlay);
    if (st.editing) placeFmtBar();
    if (!r || st.editing || st.drag) {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    $('.pgo-name', chip).textContent = shortName(nodeOf(st.sel));
    const ch = chip.offsetHeight || 26;
    let top = r.y - ch - 3;
    if (top < 0) top = r.y + r.h + 3 + ch < overlay.clientHeight ? r.y + r.h + 3 : r.y + 3;
    chip.style.top = top + 'px';
    chip.style.left = Math.max(0, Math.min(r.x, overlay.clientWidth - chip.offsetWidth)) + 'px';
  }
  function setHover(id) {
    if (id === st.hover) return;
    st.hover = id;
    drawOverlay();
    $$('#pg-layers .pgl-row.hov').forEach((r) => r.classList.remove('hov'));
    if (id) {
      const row = $(`#pg-layers .pgl-row[data-id="${CSS.escape(id)}"]`);
      if (row) row.classList.add('hov');
    }
  }

  // =============================================================== CHỌN
  function select(id, opts = {}) {
    if (st.editing) finishEdit(true);
    id = id || null;
    if (id === st.sel) {
      if (opts.scroll) scrollToSel();
      return;
    }
    st.sel = id;
    if (st.fx) {
      st.fx = '';
      applyFx();
    }
    if ((id ? openMenusFor(id).join() : '') !== openKey) render(); // mở / thu gọn menu trong khung soạn
    else drawOverlay();
    renderInspector();
    highlightLayers();
    updateStatus();
    if (opts.scroll) scrollToSel();
  }
  function selectParent() {
    const f = find(st.sel);
    select(f && f.parent ? f.parent.id : null);
  }
  function scrollToSel() {
    const el = elOf(st.sel);
    if (!el) return;
    const r = rectIn(el);
    const top = stage.offsetTop + r.y, bottom = top + r.h;
    if (top < canvas.scrollTop + 20 || bottom > canvas.scrollTop + canvas.clientHeight - 20) canvas.scrollTo({ top: Math.max(0, top - 80), behavior: 'smooth' });
  }

  // =============================================================== KÉO THẢ
  let ghost = null, scrollTimer = 0, lastPt = null;
  function beginDrag(d) {
    d.started = false;
    st.drag = d;
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('keydown', onDragKey, true);
  }
  function endDrag() {
    st.drag = null;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
    window.removeEventListener('pointercancel', endDrag);
    window.removeEventListener('keydown', onDragKey, true);
    if (ghost) ghost.remove();
    ghost = null;
    clearInterval(scrollTimer);
    scrollTimer = 0;
    drawDrop(null);
    document.body.classList.remove('pg-dragging');
    drawOverlay();
  }
  function onDragKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      endDrag();
    }
  }
  function onDragMove(e) {
    const d = st.drag;
    if (!d) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 5) return;
      d.started = true;
      document.body.classList.add('pg-dragging');
      const n = d.kind === 'move' ? nodeOf(d.id) : d.nodes[0];
      ghost = document.createElement('div');
      ghost.className = 'pg-ghost';
      ghost.innerHTML = PK.icon(d.kind === 'move' ? PK.typeIcon(n) : d.icon, 16) + `<span>${esc(d.kind === 'move' ? shortName(n) : d.name)}</span>`;
      document.body.appendChild(ghost);
      setHover(null);
      drawOverlay();
    }
    e.preventDefault();
    lastPt = { x: e.clientX, y: e.clientY };
    ghost.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 12}px)`;
    updateDrop();
    // tự cuộn khi kéo sát mép trên / dưới khung
    const cr = canvas.getBoundingClientRect();
    const dir = e.clientY < cr.top + 40 ? -1 : e.clientY > cr.bottom - 40 ? 1 : 0;
    clearInterval(scrollTimer);
    scrollTimer = 0;
    if (dir && e.clientX > cr.left && e.clientX < cr.right)
      scrollTimer = setInterval(() => {
        canvas.scrollTop += dir * 14;
        updateDrop();
      }, 30);
  }
  function updateDrop() {
    const d = st.drag;
    if (!d || !lastPt) return;
    const cr = canvas.getBoundingClientRect();
    const inside = lastPt.x >= cr.left && lastPt.x <= cr.right && lastPt.y >= cr.top && lastPt.y <= cr.bottom;
    d.drop = inside ? computeDrop(toFrame(lastPt.x, lastPt.y), d) : null;
    drawDrop(d.drop);
  }
  function onDragUp() {
    const d = st.drag;
    endDrag();
    if (!d) return;
    if (!d.started) {
      if (d.kind === 'new') insertNodes(d.nodes, null);
      return;
    }
    if (!d.drop) return;
    if (d.kind === 'new') insertNodes(d.nodes, d.drop);
    else moveNode(d.id, d.drop);
  }

  const axisOfEl = (el) => ((fdoc.defaultView.getComputedStyle(el).flexDirection || '').indexOf('row') === 0 ? 'x' : 'y');
  const subtreeTypes = (n) => {
    const t = [];
    PK.walk([n], (x) => {
      t.push(x.type);
    });
    return t;
  };
  /** Khung parentId (null = gốc trang) có nhận thành phần đang kéo không */
  function canHold(parentId, d) {
    let chain = [];
    if (parentId) {
      const f = find(parentId);
      if (!f || !TYPES[f.node.type].container) return false;
      chain = pathTo(parentId);
    }
    const types = d.kind === 'move' ? subtreeTypes(nodeOf(d.id)) : d.nodes.flatMap(subtreeTypes);
    if (chain.some((n) => n.type === 'form') && types.includes('form')) return false;
    if (chain.some((n) => n.type === 'menu') && types.includes('menu')) return false;
    if (d.kind === 'move' && chain.some((n) => n.id === d.id)) return false;
    return true;
  }
  function computeDrop(p, d) {
    const el = fdoc.elementFromPoint(p.x, p.y);
    if (!el) return null;
    let tEl = el.closest('[data-pid]');
    let selfHit = false;
    if (d.kind === 'move' && tEl) {
      const self = elOf(d.id);
      if (self && self.contains(tEl)) {
        tEl = self;
        selfHit = true;
      }
    }
    if (!tEl) return canHold(null, d) ? insideDrop(null, p) : null;
    const f = find(tEl.dataset.pid);
    if (!f) return null;
    const r = tEl.getBoundingClientRect();
    const pEl = f.parent ? elOf(f.parent.id) : froot;
    const pAx = pEl ? axisOfEl(pEl) : 'y';
    if (TYPES[f.node.type].container && !selfHit) {
      const size = pAx === 'x' ? r.width : r.height;
      const pos = pAx === 'x' ? p.x - r.left : p.y - r.top;
      const edge = Math.min(14, size / 4);
      if ((pos < edge || pos > size - edge) && canHold(f.parent ? f.parent.id : null, d)) return mkDrop(f.parent ? f.parent.id : null, f.index + (pos < edge ? 0 : 1));
      if (canHold(f.node.id, d)) return insideDrop(f.node.id, p);
    }
    // thành phần lá (hoặc khung không nhận): thả trước / sau nó, đi dần lên trên nếu cần
    let cur = f;
    while (cur) {
      const pid = cur.parent ? cur.parent.id : null;
      if (canHold(pid, d)) {
        const ce = elOf(cur.node.id);
        const rr = ce.getBoundingClientRect();
        const ax = axisOfEl(pid ? elOf(pid) : froot);
        const before = ax === 'x' ? p.x < rr.left + rr.width / 2 : p.y < rr.top + rr.height / 2;
        return mkDrop(pid, cur.index + (before ? 0 : 1));
      }
      cur = cur.parent ? find(cur.parent.id) : null;
    }
    return null;
  }
  function insideDrop(containerId, p) {
    const cont = containerId ? elOf(containerId) : froot;
    const list = childrenOf(containerId);
    const ax = axisOfEl(cont);
    let index = list.length;
    for (let i = 0; i < list.length; i++) {
      const el = elOf(list[i].id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const before = ax === 'y' ? p.y < r.top + r.height / 2 : p.y < r.top || (p.y <= r.bottom && p.x < r.left + r.width / 2);
      if (before) {
        index = i;
        break;
      }
    }
    return mkDrop(containerId, index);
  }
  function mkDrop(parentId, index) {
    const cont = parentId ? elOf(parentId) : froot;
    const list = childrenOf(parentId);
    const vis = (n) => {
      const el = n && elOf(n.id);
      const r = el && el.getBoundingClientRect();
      return r && (r.width || r.height) ? r : null;
    };
    const at = vis(list[index]), prev = vis(list[index - 1]);
    const ax = axisOfEl(cont);
    let line = null;
    if (at || prev) {
      if (ax === 'y') {
        const ref = at || prev;
        const y = at && prev ? (prev.bottom + at.top) / 2 : at ? at.top - 2 : prev.bottom + 2;
        line = { x: ref.left, y, w: ref.width, h: 0 };
      } else {
        const ref = at || prev;
        const x = at && prev && Math.abs(at.top - prev.top) < 6 ? (prev.right + at.left) / 2 : at ? at.left - 2 : prev.right + 2;
        line = { x, y: ref.top, w: 0, h: ref.height };
      }
    }
    const n = parentId ? nodeOf(parentId) : null;
    return { parent: parentId, index, line, box: cont.getBoundingClientRect(), label: n ? shortName(n) : 'Trang “' + curPage().name + '”' };
  }
  function drawDrop(drop) {
    const box = $('.pgo-dropbox', overlay), ln = $('.pgo-line', overlay);
    if (!drop) {
      box.hidden = ln.hidden = true;
      return;
    }
    const s = view.s, b = drop.box;
    box.hidden = false;
    Object.assign(box.style, { left: b.left * s + 'px', top: b.top * s + 'px', width: b.width * s + 'px', height: b.height * s + 'px' });
    $('.pgo-tag', box).textContent = 'Thả vào: ' + drop.label;
    box.classList.toggle('empty', !drop.line);
    if (drop.line) {
      ln.hidden = false;
      const L = drop.line;
      ln.classList.toggle('v', !L.w);
      Object.assign(ln.style, L.w ? { left: L.x * s + 'px', top: L.y * s - 1.5 + 'px', width: L.w * s + 'px', height: '3px' } : { left: L.x * s - 1.5 + 'px', top: L.y * s + 'px', width: '3px', height: L.h * s + 'px' });
    } else ln.hidden = true;
  }

  // =============================================================== THAO TÁC
  /** Chỗ thêm khi bấm (không kéo): vào khung đang chọn, hoặc ngay sau thành phần đang chọn */
  function smartDrop(nodes) {
    const d = { kind: 'new', nodes };
    const rootOnly = nodes.some((n) => n.type === 'section');
    const f = find(st.sel);
    if (f) {
      if (!rootOnly && TYPES[f.node.type].container && canHold(f.node.id, d)) return { parent: f.node.id, index: f.node.children.length };
      let cur = f;
      while (cur) {
        const pid = cur.parent ? cur.parent.id : null;
        if ((!rootOnly || !pid) && canHold(pid, d)) return { parent: pid, index: cur.index + 1 };
        cur = cur.parent ? find(cur.parent.id) : null;
      }
    }
    return { parent: null, index: curPage().children.length };
  }
  function insertNodes(nodes, drop) {
    if (!nodes || !nodes.length) return;
    const clicked = !drop;
    drop = drop || smartDrop(nodes);
    // menu thêm bằng cách bấm (hoặc đi kèm nút) -> đặt ở gốc trang cho gọn
    let main = nodes, menus = [];
    if (drop.parent && (clicked || nodes.length > 1)) {
      menus = nodes.filter((n) => n.type === 'menu');
      main = nodes.filter((n) => n.type !== 'menu');
    }
    commit((proj) => {
      if (main.length) childrenOf(drop.parent, proj).splice(drop.index, 0, ...main);
      if (menus.length) pageIn(proj).children.push(...menus);
    });
    select((main[0] || menus[0]).id, { scroll: true });
  }
  function moveNode(id, drop) {
    commit((proj) => {
      const f = PK.find(proj, id);
      if (!f) return;
      let index = drop.index;
      const same = (f.parent ? f.parent.id : null) === drop.parent;
      if (same && f.index < index) index--;
      if (same && f.index === index) return;
      f.list.splice(f.index, 1);
      childrenOf(drop.parent, proj).splice(index, 0, f.node);
    });
    select(id);
    drawOverlay();
  }
  function duplicate() {
    const f = find(st.sel);
    if (!f) return;
    const copy = PK.cloneFresh([f.node]);
    commit((proj) => {
      const g = PK.find(proj, f.node.id);
      g.list.splice(g.index + 1, 0, ...copy);
    });
    select(copy[0].id, { scroll: true });
  }
  function remove() {
    const f = find(st.sel);
    if (!f) return;
    const next = f.list[f.index + 1] || f.list[f.index - 1] || f.parent;
    const used = f.node.type === 'menu' ? countMenuUse(f.node.id) : 0;
    commit((proj) => {
      const g = PK.find(proj, f.node.id);
      g.list.splice(g.index, 1);
    });
    st.sel = null;
    select(next ? next.id : null);
    toast(`Đã xoá ${shortName(f.node)}${used ? ` – ${used} nút đang mở menu này sẽ không mở gì nữa` : ''} (Ctrl+Z để hoàn tác)`, used ? 'warn' : 'info');
  }
  function moveBy(delta) {
    const f = find(st.sel);
    if (!f) return;
    const j = f.index + delta;
    if (j < 0 || j >= f.list.length) return toast(delta < 0 ? 'Đã ở đầu khung chứa' : 'Đã ở cuối khung chứa', 'info');
    commit((proj) => {
      const g = PK.find(proj, f.node.id);
      const [n] = g.list.splice(g.index, 1);
      g.list.splice(j, 0, n);
    });
    drawOverlay();
  }
  function copySel(cut) {
    const f = find(st.sel);
    if (!f) return;
    clip = DE.clone(f.node);
    if (cut) remove();
    else toast(`Đã sao chép ${shortName(f.node)} – Ctrl+V để dán`, 'ok');
  }
  function paste() {
    if (!clip) return toast('Chưa sao chép thành phần nào', 'info');
    insertNodes(PK.cloneFresh([clip]), null);
  }
  const countMenuUse = (menuId) => {
    let c = 0;
    PK.walkProject(S.proj, (n) => {
      if (n.type === 'button' && n.props.action === 'show' && n.props.menu === menuId) c++;
    });
    return c;
  };

  // =============================================================== SỬA CHỮ TRỰC TIẾP
  function startEdit(id, p, opt = {}) {
    const n = nodeOf(id);
    const host = elOf(id);
    if (!n || !host) return false;
    const at = (sel) => {
      const e = p ? fdoc.elementFromPoint(p.x, p.y) : null;
      return (e && e.closest(sel)) || null;
    };
    let el = null, extra = null;
    if (n.type === 'heading' || n.type === 'text' || n.type === 'shape') el = host;
    else if (n.type === 'button') el = host.querySelector('.pg-btn-text');
    else if (n.type === 'list') {
      el = opt.li != null ? host.querySelector(`li[data-li="${opt.li}"]`) : at('li[data-li]') || host.querySelector('li[data-li]');
      if (el) extra = +el.dataset.li;
    } else if (n.type === 'table') {
      el = opt.cell ? host.querySelector(`[data-cell="${opt.cell.join(',')}"]`) : at('[data-cell]') || host.querySelector('[data-cell]');
      if (el) extra = el.dataset.cell.split(',').map(Number);
    } else if (['input', 'select', 'checkbox'].includes(n.type)) el = host.querySelector('.pg-label-text');
    if (!el) return false;
    // chữ có định dạng (đậm, nghiêng, liên kết…): sửa kiểu "rich", lưu lại thành cú pháp chữ định dạng
    const rich = RICH_KINDS.has(n.type);
    const P = PK.resolve(n, theme());
    let orig = el.innerText;
    if (rich) orig = n.type === 'list' ? (P.items || [])[extra] : n.type === 'table' ? ((P.rows || [])[extra[0]] || [])[extra[1]] : P.text;
    st.editing = { id, el, kind: n.type, extra, orig: orig == null ? '' : String(orig), rich, hold: false };
    overlay.classList.add('editing');
    drawOverlay();
    if (rich) el.setAttribute('contenteditable', 'true');
    else {
      el.setAttribute('contenteditable', 'plaintext-only');
      if (!el.isContentEditable) el.setAttribute('contenteditable', 'true');
    }
    el.focus({ preventScroll: true });
    try {
      const r = fdoc.createRange();
      r.selectNodeContents(el);
      const s = fdoc.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    } catch (_) {
      /* ignore */
    }
    el.addEventListener('keydown', onEditKey);
    el.addEventListener('blur', onEditBlur);
    if (rich) {
      el.addEventListener('paste', onEditPaste);
      try {
        fdoc.execCommand('styleWithCSS', false, true);
      } catch (_) {
        /* trình duyệt cũ */
      }
      showFmtBar();
    }
    return true;
  }
  const RICH_KINDS = new Set(['heading', 'text', 'list', 'table', 'shape']);
  function onEditBlur() {
    if (st.editing && st.editing.hold) return; // đang nhập địa chỉ liên kết / chọn màu trên thanh định dạng
    finishEdit(true);
  }
  /** Dán: giữ đậm / nghiêng / liên kết / màu từ trang khác, bỏ mọi thứ còn lại */
  function onEditPaste(e) {
    const ed = st.editing;
    if (!ed || !ed.rich || !e.clipboardData) return;
    e.preventDefault();
    const html = e.clipboardData.getData('text/html'), txt = e.clipboardData.getData('text/plain');
    let md = html ? PK.domToInline(new DOMParser().parseFromString(html, 'text/html').body) : PK.escInline(txt);
    if (ed.kind === 'list') md = md.replace(/\n+/g, ' ');
    fdoc.execCommand('insertHTML', false, PK.inline(md, { edit: true, proj: S.proj }));
  }
  // ---- thanh định dạng nổi khi sửa chữ trên trang
  let fmtBar = null, fmtRange = null;
  const FMT = [
    ['bold', '<b>B</b>', 'Đậm (Ctrl+B)'],
    ['italic', '<i>I</i>', 'Nghiêng (Ctrl+I)'],
    ['underline', '<u>U</u>', 'Gạch chân (Ctrl+U)'],
    ['strikeThrough', '<s>S</s>', 'Gạch ngang'],
    ['link', '🔗', 'Liên kết (Ctrl+K)'],
    ['color', '<span class="pgo-fmt-a">A</span>', 'Màu chữ'],
    ['removeFormat', '⌫', 'Bỏ định dạng'],
  ];
  function showFmtBar() {
    const ed = st.editing;
    if (!ed) return;
    if (!fmtBar) {
      fmtBar = document.createElement('div');
      fmtBar.className = 'pgo-fmt';
      fmtBar.innerHTML =
        FMT.map(([c, ic, t]) => `<button type="button" data-fmt="${c}" title="${t}">${ic}</button>`).join('') +
        '<input type="color" class="pgo-fmt-color" tabindex="-1" aria-label="Màu chữ"><span class="pgo-fmt-link" hidden><input type="url" placeholder="https://… hoặc #ma-neo" spellcheck="false"><button type="button" data-fmt="link-ok">OK</button></span>';
      // giữ con trỏ trong khung trang khi bấm nút (không làm mất vùng chọn)
      fmtBar.addEventListener('mousedown', (e) => {
        if (!e.target.closest('input')) e.preventDefault();
      });
      fmtBar.addEventListener('click', onFmtClick);
      const color = fmtBar.querySelector('.pgo-fmt-color');
      color.addEventListener('input', () => {
        restoreRange();
        fdoc.execCommand('foreColor', false, color.value);
      });
      color.addEventListener('change', () => endHold());
      const li = fmtBar.querySelector('.pgo-fmt-link input');
      li.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          applyLink(li.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          endHold();
        }
      });
      overlay.appendChild(fmtBar);
    }
    fmtBar.querySelector('.pgo-fmt-link').hidden = true;
    fmtBar.hidden = false;
    placeFmtBar();
  }
  function placeFmtBar() {
    const ed = st.editing;
    if (!fmtBar || !ed) return;
    const r = rectIn(ed.el);
    const h = fmtBar.offsetHeight || 30;
    fmtBar.style.left = Math.max(0, Math.min(r.x, overlay.clientWidth - fmtBar.offsetWidth)) + 'px';
    fmtBar.style.top = (r.y - h - 8 >= 0 ? r.y - h - 8 : r.y + r.h + 8) + 'px';
  }
  function hideFmtBar() {
    if (fmtBar) fmtBar.hidden = true;
  }
  function saveRange() {
    try {
      const s = fdoc.getSelection();
      fmtRange = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
    } catch (_) {
      fmtRange = null;
    }
  }
  function restoreRange() {
    const ed = st.editing;
    if (!ed) return;
    ed.el.focus({ preventScroll: true });
    if (!fmtRange) return;
    const s = fdoc.getSelection();
    s.removeAllRanges();
    s.addRange(fmtRange);
  }
  function endHold() {
    const ed = st.editing;
    if (!ed) return;
    restoreRange();
    ed.hold = false;
    if (fmtBar) fmtBar.querySelector('.pgo-fmt-link').hidden = true;
  }
  function applyLink(url) {
    restoreRange();
    const u = PK.safeUrl((url || '').trim());
    if (u) fdoc.execCommand('createLink', false, u);
    else if (url && url.trim()) toast('Địa chỉ không hợp lệ hoặc không an toàn', 'warn');
    endHold();
  }
  function askLink() {
    const ed = st.editing;
    if (!ed || !fmtBar) return;
    saveRange();
    ed.hold = true;
    const box = fmtBar.querySelector('.pgo-fmt-link');
    box.hidden = false;
    const inp = box.querySelector('input');
    const a = fmtRange && fmtRange.startContainer && (fmtRange.startContainer.nodeType === 1 ? fmtRange.startContainer : fmtRange.startContainer.parentElement);
    const cur = a && a.closest ? a.closest('a') : null;
    inp.value = cur ? cur.getAttribute('data-href') || cur.getAttribute('href') || '' : '';
    placeFmtBar();
    inp.focus();
    inp.select();
  }
  function onFmtClick(e) {
    const b = e.target.closest('[data-fmt]');
    const ed = st.editing;
    if (!b || !ed) return;
    const c = b.dataset.fmt;
    if (c === 'link') return askLink();
    if (c === 'link-ok') return applyLink(fmtBar.querySelector('.pgo-fmt-link input').value);
    if (c === 'color') {
      saveRange();
      ed.hold = true;
      fmtBar.querySelector('.pgo-fmt-color').click();
      // hộp chọn màu đóng mà không đổi màu: trả lại trạng thái sửa sau một lúc
      setTimeout(() => window.addEventListener('focus', () => ed.hold && endHold(), { once: true }), 0);
      return;
    }
    fdoc.execCommand(c);
  }
  function onEditKey(e) {
    const ed = st.editing;
    if (!ed) return;
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      finishEdit(false);
      return;
    }
    if (ed.rich && (e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      const cmd = { b: 'bold', i: 'italic', u: 'underline' }[k];
      if (cmd) {
        e.preventDefault();
        fdoc.execCommand(cmd);
        return;
      }
      if (k === 'k') {
        e.preventDefault();
        askLink();
        return;
      }
    }
    if (e.key === 'Enter') {
      // xuống dòng trong chữ: thẻ <br> (không tạo khối <div>)
      const br = (ed.kind === 'text' || ed.kind === 'shape') && !(e.ctrlKey || e.metaKey);
      if (br || (ed.kind === 'heading' && e.shiftKey)) {
        if (ed.rich) {
          e.preventDefault();
          fdoc.execCommand('insertLineBreak');
        }
        return;
      }
      e.preventDefault();
      const { id, kind, extra } = ed;
      finishEdit(true);
      if (kind === 'list' && !e.ctrlKey && !e.metaKey) {
        // Enter trong danh sách: thêm mục mới ngay sau
        commit((proj) => {
          const n = PK.find(proj, id).node;
          const items = (n.props.items || PK.resolve(n, theme()).items).slice();
          items.splice(extra + 1, 0, '');
          n.props.items = items;
        });
        startEdit(id, null, { li: extra + 1 });
      }
      return;
    }
    if (e.key === 'Tab' && ed.kind === 'table') {
      e.preventDefault();
      const { id, extra } = ed;
      finishEdit(true);
      const rows = PK.resolve(nodeOf(id), theme()).rows;
      let [r, c] = extra;
      c += e.shiftKey ? -1 : 1;
      if (c >= rows[0].length) {
        c = 0;
        r++;
      } else if (c < 0) {
        c = rows[0].length - 1;
        r--;
      }
      if (r >= 0 && r < rows.length) startEdit(id, null, { cell: [r, c] });
    }
  }
  function finishEdit(save) {
    const ed = st.editing;
    if (!ed) return;
    st.editing = null;
    ed.el.removeEventListener('keydown', onEditKey);
    ed.el.removeEventListener('blur', onEditBlur);
    ed.el.removeEventListener('paste', onEditPaste);
    hideFmtBar();
    const plainV = ed.el.innerText.replace(/ /g, ' ').replace(/\n$/, '');
    const v = ed.rich ? PK.domToInline(ed.el) : plainV;
    ed.el.removeAttribute('contenteditable');
    overlay.classList.remove('editing');
    try {
      fdoc.getSelection().removeAllRanges();
    } catch (_) {
      /* ignore */
    }
    if (save && v !== ed.orig) {
      const one = v.replace(/\n+/g, ' ');
      commit((proj) => {
        const f = PK.find(proj, ed.id);
        if (!f) return;
        const n = f.node, P = n.props;
        const full = PK.resolve(n, theme());
        if (ed.kind === 'heading' || ed.kind === 'text' || ed.kind === 'shape') P.text = v.slice(0, 20000);
        else if (ed.kind === 'button') P.text = one.slice(0, 300);
        else if (ed.kind === 'list') {
          const items = full.items.slice();
          items[ed.extra] = one.slice(0, 500);
          P.items = items;
        } else if (ed.kind === 'table') {
          const rows = DE.clone(full.rows);
          if (rows[ed.extra[0]]) rows[ed.extra[0]][ed.extra[1]] = v.slice(0, 1000);
          P.rows = rows;
        } else P.label = one.slice(0, 300);
      });
      renderInspector();
    } else render();
  }

  // =============================================================== BẢNG THUỘC TÍNH
  const PROJ_FIELDS = { name: { type: 'text', label: 'Tên dự án', max: 120 }, script: { type: 'area', label: 'Mã JavaScript', max: 100000 } };
  const splitKey = (fk) => (fk.indexOf(':') > 0 ? fk.split(':') : ['node', fk]);
  const fieldOf = (scope, k) => (scope === 'page' ? PK.PAGE_FIELDS[k] : scope === 'theme' ? PK.THEME_FIELDS[k] : scope === 'proj' ? PROJ_FIELDS[k] : PK.FIELDS[k]);

  function uniquePath(proj, path, pageId) {
    let p = path || 'trang', k = 2;
    const used = (x) => proj.pages.some((pg) => pg.id !== pageId && pg.path === x);
    while (used(p)) p = `${path}-${k++}`;
    return p;
  }
  /** Ghi một giá trị (đã lọc). fk: "bg" (thành phần đang chọn) | "page:bg" | "theme:primary" | "proj:name" */
  function setValue(fk, raw, merge) {
    const [scope, k] = splitKey(fk);
    const f = fieldOf(scope, k);
    if (!f) return false;
    const n = scope === 'node' ? nodeOf(st.sel) : null;
    if (scope === 'node' && !n) return false;
    const r = PK.cleanValue(k, raw, n ? n.type : scope, f);
    if (!r.ok) return false;
    commit((proj) => {
      if (scope === 'node') {
        const x = PK.find(proj, st.sel);
        if (x) x.node.props[k] = r.v;
      } else if (scope === 'page') {
        const pg = pageIn(proj);
        if (k === 'name') pg.name = r.v.trim() || pg.name;
        else if (k === 'path') pg.path = uniquePath(proj, r.v, pg.id);
        else pg.props[k] = r.v;
      } else if (scope === 'theme') proj.theme[k] = r.v;
      else if (scope === 'proj') proj[k] = k === 'name' ? r.v.trim() || proj.name : r.v;
    }, merge ? fk + '@' + (st.sel || st.page) : null);
    return true;
  }
  function resetValue(fk) {
    const [scope, k] = splitKey(fk);
    commit((proj) => {
      if (scope === 'node') {
        const x = PK.find(proj, st.sel);
        if (x) delete x.node.props[k];
      } else if (scope === 'page') delete pageIn(proj).props[k];
      else if (scope === 'theme') proj.theme[k] = PK.THEME_DEF[k];
    });
  }

  function renderInspector() {
    if (!ready) return;
    const body = $('#pg-props'), head = $('#pg-insp-head');
    if (st.itab === 'json') return renderJsonTab();
    const key = st.sel || 'page:' + st.page;
    const keep = body.dataset.key === key ? body.scrollTop : 0;
    const f = find(st.sel);
    if (!f) {
      head.innerHTML = pageHead();
      body.innerHTML = pageForm();
    } else {
      head.innerHTML = nodeHead(f);
      body.innerHTML = nodeForm(f);
    }
    body.dataset.key = key;
    body.scrollTop = keep;
  }

  const hexOf = (c) => {
    if (typeof c !== 'string') return '#ffffff';
    if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).split('').map((x) => x + x).join('').toLowerCase();
    if (/^#[0-9a-f]{8}$/i.test(c)) return c.slice(0, 7).toLowerCase();
    const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (m) return '#' + m.slice(1, 4).map((x) => (+x).toString(16).padStart(2, '0')).join('');
    return '#ffffff';
  };
  /** Màu đang hiển thị thật trên trang (khi người dùng chưa đặt) */
  function computedColor(n, k) {
    const el = elOf(n.id);
    if (!el) return '#0f172a';
    const cs = fdoc.defaultView.getComputedStyle(el);
    const v = k === 'color' ? cs.color : k === 'borderColor' ? cs.borderTopColor : cs.backgroundColor;
    return /rgba\([^)]*,\s*0\)/.test(v) || v === 'transparent' ? '#ffffff' : hexOf(v);
  }

  // ---- chữ định dạng: thanh nút bọc vùng chữ đang chọn bằng ký hiệu
  const RICH_HINT = '<small class="pg-hint">Chọn chữ rồi bấm nút, hoặc gõ: <code>**đậm**</code> <code>_nghiêng_</code> <code>[chữ](https://…)</code> <code>[chữ]{#e11d48}</code> · nhấn đúp trên trang để sửa trực tiếp</small>';
  const RT = [
    ['**', '**', '<b>B</b>', 'Đậm'],
    ['_', '_', '<i>I</i>', 'Nghiêng'],
    ['++', '++', '<u>U</u>', 'Gạch chân'],
    ['~~', '~~', '<s>S</s>', 'Gạch ngang'],
    ['==', '==', '<mark>M</mark>', 'Tô sáng'],
    ['[', '](https://)', '🔗', 'Liên kết'],
  ];
  const richBar = (fk) =>
    `<div class="pg-rt" data-rt="${fk}">` +
    RT.map(([l, r, ic, t], i) => `<button type="button" data-rtw="${i}" title="${t}">${ic}</button>`).join('') +
    `<label class="pg-rt-color" title="Màu chữ cho đoạn đang chọn"><span>A</span><input type="color" data-rtc="${fk}" value="#e11d48"></label></div>`;
  /** Bọc vùng chọn trong ô nhập bằng ký hiệu, rồi lưu */
  function wrapSel(ta, l, r, selectInner) {
    const a = ta.selectionStart, b = ta.selectionEnd;
    const v = ta.value;
    let s = v.slice(a, b);
    const lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0];
    s = s.trim() || 'chữ';
    ta.value = v.slice(0, a) + lead + l + s + r + tail + v.slice(b);
    ta.focus();
    if (selectInner === 'url') {
      const p = a + lead.length + l.length + s.length + 2;
      ta.setSelectionRange(p, p + 8);
    } else ta.setSelectionRange(a + lead.length + l.length, a + lead.length + l.length + s.length);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // ---- màu chuyển sắc
  const GRAD_DEF = { kind: 'linear', angle: 135, stops: [{ c: '#6366f1', p: 0 }, { c: '#ec4899', p: 100 }] };
  const AT_NAMES = { center: 'Giữa', top: 'Trên', bottom: 'Dưới', left: 'Trái', right: 'Phải', 'top left': 'Trên trái', 'top right': 'Trên phải', 'bottom left': 'Dưới trái', 'bottom right': 'Dưới phải' };
  function gradEditor(fk, f, g, lab, hint) {
    if (!g) return `<div class="f pg-f">${lab}<div class="btn-row"><button type="button" class="btn" data-gradon="${fk}">＋ Thêm màu chuyển sắc</button></div>${hint}</div>`;
    const seg = (key, opts, cur) => `<div class="pg-seg">${opts.map(([v, l]) => `<button type="button" class="${cur === v ? 'on' : ''}" data-gset="${fk}" data-gkey="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
    let h = `<div class="f pg-f">${lab}<div class="pg-grad"><div class="pg-grad-prev" style="background-image:${esc(PK.gradCss(g))}"></div>`;
    h += seg('kind', [['linear', 'Thẳng'], ['radial', 'Toả tròn'], ['conic', 'Xoay vòng']], g.kind);
    if (g.kind !== 'radial') h += `<div class="pg-range"><span class="pg-unit">Góc</span><input type="range" min="0" max="360" step="1" value="${g.angle || 0}" data-grada="${fk}"><input type="number" min="-360" max="720" value="${g.angle || 0}" data-grada="${fk}"><span class="pg-unit">°</span></div>`;
    if (g.kind === 'radial') h += seg('shape', [['ellipse', 'Bầu dục'], ['circle', 'Tròn']], g.shape || 'ellipse');
    if (g.kind !== 'linear') h += `<label class="pg-grad-at"><span class="pg-unit">Tâm</span><select data-gradat="${fk}">${PK.GRAD_AT.map((a) => `<option value="${a}"${(g.at || 'center') === a ? ' selected' : ''}>${AT_NAMES[a]}</option>`).join('')}</select></label>`;
    h += '<div class="pg-grad-stops">';
    g.stops.forEach((s, i) => {
      h +=
        `<div class="pg-grad-stop"><input type="color" value="${hexOf(s.c)}" data-gradc="${fk}" data-i="${i}" title="Màu">` +
        `<input type="text" class="pg-hex" value="${esc(s.c)}" data-gradh="${fk}" data-i="${i}" spellcheck="false" aria-label="Mã màu (có thể dùng rgba để trong suốt)">` +
        `<input type="number" min="0" max="100" value="${s.p == null ? '' : s.p}" placeholder="tự" data-gradp="${fk}" data-i="${i}" title="Vị trí (%)"><span class="pg-unit">%</span>` +
        (g.stops.length > 2 ? `<button type="button" class="pg-mini" data-gradx="${fk}" data-i="${i}" title="Bỏ điểm màu này">×</button>` : '') +
        '</div>';
    });
    h += `</div><div class="btn-row"><button type="button" class="btn" data-gradadd="${fk}">＋ Điểm màu</button><button type="button" class="btn" data-gradoff="${fk}">Bỏ chuyển sắc</button></div></div>${hint}</div>`;
    return h;
  }
  /** Đọc gradient hiện tại của trường fk (đã gộp mặc định) */
  function gradOf(fk) {
    const [scope, k] = splitKey(fk);
    if (scope !== 'node') return null;
    const n = nodeOf(st.sel);
    return n ? DE.clone(PK.resolve(n, theme())[k] || null) : null;
  }
  function setGrad(fk, fn, merge) {
    const g = gradOf(fk) || DE.clone(GRAD_DEF);
    fn(g);
    if (!setValue(fk, g, merge)) toast('Màu không hợp lệ – dùng dạng #6366f1 hoặc rgba(99,102,241,.5)', 'warn');
  }
  // ---- khung hình chuyển động tuỳ chỉnh
  const FR_COLS = [['at', 'Mốc %', 0, 100], ['opacity', 'Rõ %', 0, 100], ['x', 'Ngang px', -2000, 2000], ['y', 'Dọc px', -2000, 2000], ['scale', 'Cỡ %', 0, 500], ['rotate', 'Xoay °', -720, 720]];
  function framesEditor(fk, v) {
    const fr = Array.isArray(v) && v.length ? v : [{ at: 0, opacity: 0, y: 30 }, { at: 100, opacity: 100, y: 0 }];
    let h = '<div class="f pg-f"><span class="pg-lab">Khung hình (mỗi dòng là một thời điểm)</span><div class="pg-tbl-wrap"><table class="pg-tbl pg-frames"><tr>' + FR_COLS.map((c) => `<th>${c[1]}</th>`).join('') + '<th></th></tr>';
    fr.forEach((f, i) => {
      h += '<tr>' + FR_COLS.map(([k, , a, b]) => `<td><input type="number" min="${a}" max="${b}" value="${f[k] == null ? '' : f[k]}" data-frame="${fk}" data-i="${i}" data-fk="${k}"></td>`).join('') + `<td class="pg-tbl-x">${fr.length > 2 ? `<button type="button" data-framex="${fk}" data-i="${i}" title="Bỏ khung này">×</button>` : ''}</td></tr>`;
    });
    return h + `</table></div><div class="btn-row"><button type="button" class="btn" data-frameadd="${fk}">＋ Khung hình</button></div><small class="pg-hint">Ô để trống = giữ như bình thường. Ví dụ hiện dần từ dưới lên: 0% rõ 0, dọc 30 → 100% rõ 100, dọc 0.</small></div>`;
  }
  function setFrames(fk, fn, merge) {
    const n = nodeOf(st.sel);
    if (!n) return;
    const cur = PK.resolve(n, theme()).animFrames;
    const fr = DE.clone(Array.isArray(cur) && cur.length ? cur : [{ at: 0, opacity: 0, y: 30 }, { at: 100, opacity: 100, y: 0 }]);
    fn(fr);
    setValue(fk, fr, merge);
  }

  /** Một trường. ctx: { type, P, own(k), c (vị trí), color(k) } */
  function fieldHTML(fk, f, v, ctx) {
    const k = splitKey(fk)[1];
    if (f.show && !f.show(ctx.P, ctx.type, ctx.c)) return '';
    const own = ctx.own(k);
    const reset = own && !f.opt ? `<button type="button" class="pg-reset" data-reset="${fk}" title="Về giá trị mặc định">↺</button>` : '';
    const lab = `<span class="pg-lab">${esc(f.label)}${reset}</span>`;
    const hint = f.hint ? `<small class="pg-hint">${esc(f.hint)}</small>` : '';
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '';
    switch (f.type) {
      case 'num': {
        const unit = f.unitFn ? f.unitFn(ctx.P) : f.unit || '';
        const max = k === 'width' && ctx.P.widthMode === 'percent' ? 100 : f.max;
        const num = `<input type="number" data-k="${fk}" value="${v == null ? '' : v}" min="${f.min}" max="${max}" step="${f.step}">`;
        if (f.ui === 'range') {
          const rmax = k === 'radius' ? 80 : max;
          return `<div class="f pg-f">${lab}<div class="pg-range"><input type="range" data-k="${fk}" value="${Math.min(v, rmax)}" min="${f.min}" max="${rmax}" step="${f.step}">${num}<span class="pg-unit">${esc(unit)}</span></div>${hint}</div>`;
        }
        return `<label class="f pg-f">${lab}<div class="pg-num">${num}<span class="pg-unit">${esc(unit)}</span></div>${hint}</label>`;
      }
      case 'color': {
        const unset = v == null || v === '';
        const none = v === 'transparent';
        const sw = unset || none ? ctx.color(k) : hexOf(v);
        const place = unset ? (f.none ? 'Không có' : 'Mặc định') : none ? 'Trong suốt' : '';
        return (
          `<div class="f pg-f">${lab}<div class="pg-color${unset || none ? ' is-unset' : ''}"><input type="color" data-k="${fk}" value="${sw}" title="Chọn màu">` +
          `<input type="text" class="pg-hex" data-hex="${fk}" value="${unset || none ? '' : esc(v)}" placeholder="${esc(place)}" spellcheck="false" aria-label="Mã màu">` +
          (f.none ? `<button type="button" class="pg-mini${none ? ' on' : ''}" data-set="${fk}" data-v="transparent" title="Không có màu (trong suốt)">∅</button>` : '') +
          `</div>${hint}</div>`
        );
      }
      case 'enum': {
        const opts = PK.optionsOf(f, ctx.type);
        const cur = String(v == null ? '' : v);
        if (f.ui === 'seg')
          return (
            `<div class="f pg-f">${lab}<div class="pg-seg" role="radiogroup" aria-label="${esc(f.label)}">` +
            opts.map(([val, l]) => `<button type="button" role="radio" aria-checked="${cur === val}" class="${cur === val ? 'on' : ''}" data-seg="${fk}" data-v="${esc(val)}">${esc(l)}</button>`).join('') +
            `</div>${hint}</div>`
          );
        return `<label class="f pg-f">${lab}<select data-k="${fk}">${opts.map(([val, l]) => `<option value="${esc(val)}"${cur === val ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${hint}</label>`;
      }
      case 'bool':
        return `<div class="pg-bool-row"><label class="pg-bool"><input type="checkbox" data-k="${fk}"${v ? ' checked' : ''}><span>${esc(f.label)}</span></label>${reset}</div>${hint}`;
      case 'area':
        if (f.uiFor && f.uiFor[ctx.type] === 'text') return `<label class="f pg-f">${lab}<input type="text" data-k="${fk}" value="${esc(v)}" maxlength="300">${hint}</label>`;
        return `<div class="f pg-f">${lab}${f.rich ? richBar(fk) : ''}<textarea data-k="${fk}" rows="${Math.min(12, Math.max(f.rows || 3, String(v || '').split('\n').length + 1))}"${k === 'script' ? ' class="code" spellcheck="false"' : ''}${ph}>${esc(v)}</textarea>${f.rich ? RICH_HINT : ''}${hint}</div>`;
      case 'lines':
        return `<div class="f pg-f">${lab}${f.rich ? richBar(fk) : ''}<textarea data-k="${fk}" data-lines rows="${Math.min(12, Math.max(f.rows || 3, (v || []).length + 1))}">${esc((v || []).join('\n'))}</textarea>${f.rich ? RICH_HINT : ''}${hint}</div>`;
      case 'len': {
        const s = v == null || v === '' ? '' : String(v);
        const m = s.match(/^(-?[\d.]+)(px|%|vw|vh|em|rem)?$/);
        const num = m ? m[1] : '', unit = m && m[2] ? m[2] : 'px';
        const clear = s !== '' ? `<button type="button" class="pg-mini" data-lenclear="${fk}" title="Bỏ giá trị (tự động)">Tự động</button>` : '';
        return (
          `<div class="f pg-f">${lab}<div class="pg-len"><input type="number" data-len="${fk}" value="${esc(num)}" step="1" placeholder="tự động">` +
          `<select data-lenu="${fk}" aria-label="Đơn vị">${['px', '%', 'vw', 'vh', 'em'].map((u) => `<option${u === unit ? ' selected' : ''}>${u}</option>`).join('')}</select>${clear}</div>${hint}</div>`
        );
      }
      case 'gradient':
        return gradEditor(fk, f, v, lab, hint);
      case 'frames':
        return framesEditor(fk, v);
      case 'font': {
        const opts = PK.fontOptions(S.proj, !f.noInherit);
        const cur = v == null ? '' : String(v);
        const missing = cur && !opts.some((o) => o[0] === cur) ? `<option value="${esc(cur)}" selected>(font đã bị xoá)</option>` : '';
        return (
          `<label class="f pg-f">${lab}<select data-k="${fk}">${missing}${opts.map(([val, l]) => `<option value="${esc(val)}"${cur === val ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${hint}</label>` +
          `<div class="btn-row pg-under"><button type="button" class="btn" data-act="fonts">Font riêng (Google Fonts, tải file)…</button></div>`
        );
      }
      case 'image': {
        const isData = /^data:/.test(v || '');
        const kb = isData ? Math.round((v.length * 3) / 4 / 1024) : 0;
        return (
          `<div class="f pg-f">${lab}<div class="pg-img-field">${v ? `<img src="${esc(v)}" alt="">` : '<span class="pg-img-none">Chưa có ảnh</span>'}` +
          `<div class="pg-img-btns"><button type="button" class="btn" data-upload="${fk}">Tải ảnh từ máy…</button>${v ? `<button type="button" class="btn" data-set="${fk}" data-v="">Bỏ ảnh</button>` : ''}</div></div>` +
          `<input type="text" data-k="${fk}" value="${isData ? '' : esc(v || '')}" placeholder="${isData ? `Ảnh đã tải lên (${kb} KB) – hoặc dán địa chỉ ảnh khác` : 'hoặc dán địa chỉ ảnh: https://…'}" spellcheck="false">${hint}</div>`
        );
      }
      case 'page': {
        const opts = S.proj.pages.map((p) => `<option value="${p.id}"${p.id === v ? ' selected' : ''}>${esc(p.name)} (#/${esc(p.path)})</option>`).join('');
        return `<label class="f pg-f">${lab}<select data-k="${fk}"><option value="">— Trang chủ (mặc định) —</option>${opts}</select>${hint}</label><div class="btn-row pg-under"><button type="button" class="btn" data-act="new-page-link">＋ Tạo trang mới cho nút này</button></div>`;
      }
      case 'menu': {
        const menus = PK.menus(S.proj);
        const cur = curPage();
        const missing = v && !menus.some((m) => m.id === v) ? `<option value="${esc(v)}" selected>(menu đã bị xoá)</option>` : '';
        const opts = menus.map((m) => `<option value="${m.id}"${m.id === v ? ' selected' : ''}>${esc(m.name)}${m.page.id !== cur.id ? ' · trang ' + esc(m.page.name) : ''}</option>`).join('');
        return (
          `<label class="f pg-f">${lab}<select data-k="${fk}"><option value="">— Chọn menu —</option>${missing}${opts}</select>${hint}</label>` +
          `<div class="btn-row pg-under"><button type="button" class="btn" data-act="new-menu" data-v="panel">＋ Menu bảng nhỏ</button><button type="button" class="btn" data-act="new-menu" data-v="full">＋ Menu toàn trang</button>` +
          (v && menus.some((m) => m.id === v) ? '<button type="button" class="btn" data-act="goto-menu">Sửa menu này →</button>' : '') +
          '</div>'
        );
      }
      case 'table':
        return tableEditor(v);
      default:
        return `<label class="f pg-f">${lab}<input type="text" data-k="${fk}" value="${esc(v == null ? '' : v)}"${ph} spellcheck="${f.type === 'text'}"${f.max ? ` maxlength="${f.max}"` : ''}>${hint}</label>`;
    }
  }

  function tableEditor(rows) {
    let h = `<div class="f pg-f"><span class="pg-lab">Dữ liệu – sửa ở đây hoặc nhấn đúp vào ô trên trang</span><div class="pg-tbl-wrap"><table class="pg-tbl">`;
    rows.forEach((r, i) => {
      h += `<tr>${r.map((c, j) => `<td><input type="text" data-cell="${i},${j}" value="${esc(c)}" aria-label="Hàng ${i + 1}, cột ${j + 1}"></td>`).join('')}<td class="pg-tbl-x"><button type="button" data-act="row-del" data-v="${i}" title="Xoá hàng ${i + 1}">×</button></td></tr>`;
    });
    h += `<tr class="pg-tbl-colx">${rows[0].map((_, j) => `<td><button type="button" data-act="col-del" data-v="${j}" title="Xoá cột ${j + 1}">×</button></td>`).join('')}<td></td></tr>`;
    return h + `</table></div><div class="btn-row"><button type="button" class="btn" data-act="row-add">＋ Hàng</button><button type="button" class="btn" data-act="col-add">＋ Cột</button><button type="button" class="btn" data-act="table-paste">Dán từ Excel…</button></div></div>`;
  }

  function fxEditor(n, P) {
    let h =
      `<div class="f pg-f"><span class="pg-lab">Xem trước trên trang</span><div class="pg-seg">` +
      [['', 'Bình thường'], ['hover', 'Khi di chuột qua'], ['press', 'Khi bấm']].map(([v, l]) => `<button type="button" data-fx="${v}" class="${st.fx === v ? 'on' : ''}">${l}</button>`).join('') +
      '</div></div>';
    for (const [pre, title] of [['hover', 'Khi di chuột qua'], ['press', 'Khi bấm (nhấn giữ)']]) {
      h += `<div class="pg-fx"><div class="pg-fx-title">${title}</div>`;
      for (const suf of ['Bg', 'Color', 'Border', 'Scale', 'Lift', 'Shadow', 'Opacity']) {
        const k = pre + suf, f = PK.FIELDS[k], v = P[k], on = v != null;
        let ctl = '';
        if (on) {
          if (f.type === 'color')
            ctl =
              `<input type="color" data-k="${k}" value="${v === 'auto' ? computedColor(n, 'bg') : hexOf(v)}" title="Chọn màu">` +
              (f.auto ? `<button type="button" class="pg-mini${v === 'auto' ? ' on' : ''}" data-set="${k}" data-v="auto" title="Tự động đậm / nhạt hơn màu nền">Tự động</button>` : '');
          else if (f.type === 'num') ctl = `<input type="number" data-k="${k}" value="${v}" min="${f.min}" max="${f.max}" step="1"><span class="pg-unit">${f.unit}</span>`;
          else ctl = `<select data-k="${k}">${f.options.map(([a, b]) => `<option value="${a}"${a === v ? ' selected' : ''}>${b}</option>`).join('')}</select>`;
        }
        h += `<div class="pg-fx-row"><label class="pg-bool"><input type="checkbox" data-opt="${k}"${on ? ' checked' : ''}><span>${esc(f.label)}</span></label><div class="pg-fx-ctl">${ctl}</div></div>`;
      }
      h += '</div>';
    }
    return h;
  }

  const autoLabel = (n) => shortName(Object.assign({}, n, { name: '' }));
  function nodeHead(f) {
    const n = f.node, T = TYPES[n.type];
    const path = pathTo(n.id);
    const crumbs = [`<button type="button" data-sel="">${esc(curPage().name)}</button>`].concat(path.slice(0, -1).map((x) => `<button type="button" data-sel="${x.id}" title="${esc(shortName(x))}">${esc(TYPES[x.type].name)}</button>`));
    return (
      `<div class="pg-crumbs" aria-label="Vị trí">${crumbs.join('<span aria-hidden="true">›</span>')}</div>` +
      `<div class="pg-ihead"><span class="pg-iico">${PK.icon(PK.typeIcon(n), 20)}</span><div><b>${esc(T.name)}</b><small>${esc(T.desc)}</small></div></div>` +
      `<label class="pg-lname"><span>Tên trong bảng Lớp</span><input type="text" data-name value="${esc(n.name || '')}" placeholder="${esc(autoLabel(n))}" maxlength="80"></label>`
    );
  }
  function warnings(n, P, c) {
    const w = [];
    if (n.type === 'button') {
      if (P.action === 'show' && !P.menu) w.push('Nút “Mở menu” chưa chọn menu nào – chọn ở nhóm Loại nút.');
      if (P.action === 'show' && P.menu && !PK.menus(S.proj).some((m) => m.id === P.menu)) w.push('Menu của nút này đã bị xoá.');
      if (P.action === 'submit' && P.submitKind === 'form' && !c.inForm) w.push('Nút gửi biểu mẫu nhưng không nằm trong Biểu mẫu nào – kéo nút vào một Biểu mẫu, hoặc đổi chức năng.');
      if (P.action === 'submit' && P.submitKind === 'func' && !P.func) w.push('Chưa nhập tên hàm JavaScript.');
    }
    if (n.type === 'menu' && !countMenuUse(n.id)) w.push('Chưa có nút nào mở menu này: chọn một nút → Loại nút “Mở menu” → chọn menu này.');
    if (n.type === 'form' && P.submitKind === 'url' && !P.url) w.push('Chưa nhập địa chỉ web nhận dữ liệu.');
    if (n.type === 'image' && !P.src) w.push('Chưa có ảnh: bấm “Tải ảnh từ máy…” hoặc dán địa chỉ ảnh.');
    return w.map((s) => `<div class="pg-warn">⚠ ${esc(s)}</div>`).join('');
  }
  function group(gid, title, inner, openDef) {
    if (!inner) return '';
    const open = st.groups[gid] !== undefined ? st.groups[gid] : openDef;
    return `<details class="pg-grp" data-g="${esc(gid)}"${open ? ' open' : ''}><summary>${esc(title)}</summary><div class="pg-grp-body">${inner}</div></details>`;
  }
  function nodeForm(f) {
    const n = f.node, T = TYPES[n.type];
    const P = PK.resolve(n, theme());
    const inRow = !!f.parent && (f.parent.type === 'row' || (f.parent.type === 'menu' && PK.resolve(f.parent, theme()).dir === 'row'));
    const c = { inRow, parent: f.parent, inForm: pathTo(n.id).some((x) => x.type === 'form') };
    const ctx = { type: n.type, P, c, own: (k) => Object.prototype.hasOwnProperty.call(n.props, k), color: (k) => computedColor(n, k) };
    let h = warnings(n, P, c);
    for (const g of T.groups) {
      const inner = g.keys
        .map((k) => {
          if (k === 'STYLE')
            return (
              `<div class="f pg-f"><span class="pg-lab">Kiểu chữ</span><div class="pg-seg pg-tgls">` +
              [['bold', '<b>B</b>', 'Đậm'], ['italic', '<i>I</i>', 'Nghiêng'], ['underline', '<u>U</u>', 'Gạch chân'], ['upper', 'AA', 'IN HOA']]
                .map(([x, ic, t]) => `<button type="button" data-tgl="${x}" class="${P[x] ? 'on' : ''}" aria-pressed="${!!P[x]}" title="${t}">${ic}</button>`)
                .join('') +
              '</div></div>'
            );
          if (k === 'FX') return fxEditor(n, P) + fieldHTML('speed', PK.FIELDS.speed, P.speed, ctx);
          if (k === 'ANIM')
            return (
              PK.ANIM_KEYS.map((x) => fieldHTML(x, PK.FIELDS[x], P[x], ctx)).join('') +
              (P.anim && P.anim !== 'none' ? '<div class="btn-row"><button type="button" class="btn" data-act="anim-play">▶ Xem chuyển động trên trang</button></div><small class="pg-hint">Trong khung soạn, chuyển động chỉ chạy khi bấm nút trên; bấm “Xem thử” để xem như trang thật.</small>' : '')
            );
          return fieldHTML(k, PK.FIELDS[k], P[k], ctx);
        })
        .join('');
      h += group(n.type + ':' + g.id, g.title, inner, g.open);
    }
    h +=
      '<div class="btn-row pg-acts"><button type="button" class="btn" data-act="dup">Nhân bản</button><button type="button" class="btn" data-act="copy">Sao chép</button>' +
      '<button type="button" class="btn" data-act="reset-all">Đặt lại định dạng</button><button type="button" class="btn pg-danger" data-act="del">Xoá</button></div>';
    return h;
  }

  function pageHead() {
    const pg = curPage();
    return `<div class="pg-ihead"><span class="pg-iico">${PK.icon('section', 20)}</span><div><b>Trang “${esc(pg.name)}”</b><small>Chưa chọn thành phần nào – bấm vào một phần trên trang để chỉnh. Dưới đây là thiết lập của trang và cả dự án.</small></div></div>`;
  }
  function pageForm() {
    const pg = curPage(), i = S.proj.pages.indexOf(pg);
    const PP = PK.resolvePage(pg);
    const pctx = { type: 'page', P: PP, c: {}, own: (k) => Object.prototype.hasOwnProperty.call(pg.props, k), color: () => '#ffffff' };
    const th = theme();
    const tctx = { type: 'theme', P: th, c: {}, own: (k) => S.proj.theme[k] !== PK.THEME_DEF[k], color: () => '#0f172a' };
    let h = '';
    h += group(
      'page:page',
      'Trang này',
      fieldHTML('page:name', PK.PAGE_FIELDS.name, pg.name, pctx) +
        fieldHTML('page:path', PK.PAGE_FIELDS.path, pg.path, pctx) +
        fieldHTML('page:title', PK.PAGE_FIELDS.title, PP.title, pctx) +
        fieldHTML('page:bg', PK.PAGE_FIELDS.bg, PP.bg, pctx) +
        fieldHTML('page:bgImage', PK.PAGE_FIELDS.bgImage, PP.bgImage, pctx) +
        fieldHTML('page:bgSize', PK.PAGE_FIELDS.bgSize, PP.bgSize, pctx) +
        `<div class="btn-row"><button type="button" class="btn" data-act="page-dup">Nhân bản trang</button>` +
        `<button type="button" class="btn" data-act="page-move" data-v="-1"${i === 0 ? ' disabled' : ''}>← Lên trước</button>` +
        `<button type="button" class="btn" data-act="page-move" data-v="1"${i === S.proj.pages.length - 1 ? ' disabled' : ''}>Xuống sau →</button>` +
        (i ? '<button type="button" class="btn" data-act="page-home">Đặt làm trang chủ</button>' : '') +
        `<button type="button" class="btn pg-danger" data-act="page-del"${S.proj.pages.length < 2 ? ' disabled title="Dự án cần ít nhất một trang"' : ''}>Xoá trang</button></div>`,
      true
    );
    h += group('page:theme', 'Giao diện chung (áp dụng mọi trang)', Object.entries(PK.THEME_FIELDS).map(([k, f]) => fieldHTML('theme:' + k, f, th[k], tctx)).join(''), true);
    h += group('page:fonts', `Font riêng của dự án${(S.proj.fonts || []).length ? ` (${S.proj.fonts.length})` : ''}`, fontsForm(), false);
    const all = S.proj.pages.reduce((a, p) => a + countNodes(p.children), 0);
    h += group(
      'page:proj',
      'Dự án',
      fieldHTML('proj:name', PROJ_FIELDS.name, S.proj.name, { type: 'proj', P: {}, c: {}, own: () => false }) +
        `<p class="pg-hint">${S.proj.pages.length} trang · ${all} thành phần · ${PK.menus(S.proj).length} menu. Tự lưu vào trình duyệt; bấm <b>Tải xuống JSON</b> để giữ file dự án, <b>HTML</b> để có trang web hoàn chỉnh.</p>`,
      true
    );
    h += group(
      'page:script',
      'Mã JavaScript của dự án (cho lập trình viên)',
      '<p class="pg-hint">Hàm viết ở đây được gọi từ nút hoặc biểu mẫu có chức năng “Gọi hàm JavaScript”: <code>function tenHam(event, data) { … }</code> – <code>data</code> là dữ liệu biểu mẫu. Mã chỉ chạy khi Xem thử và trong file HTML xuất ra, không chạy trong khung soạn.</p>' +
        fieldHTML('proj:script', Object.assign({}, PROJ_FIELDS.script, { label: 'Mã', rows: 8, placeholder: "function guiDonHang(event, data) {\n  alert('Cảm ơn ' + (data.ho_va_ten || 'bạn'));\n}" }), S.proj.script || '', { type: 'proj', P: {}, c: {}, own: () => false }),
      false
    );
    h +=
      '<div class="pg-tips"><b>Mẹo nhanh</b><ul>' +
      '<li>Kéo thành phần từ bên trái thả vào trang; vạch xanh cho biết chỗ sẽ thả.</li>' +
      '<li>Nhấn đúp vào chữ / nút / ô bảng để sửa ngay trên trang.</li>' +
      '<li>Bấm ↑ trên nhãn xanh (hoặc Esc) để chọn khung chứa bên ngoài.</li>' +
      '<li>Đổi Máy tính / Máy tính bảng / Điện thoại ở thanh công cụ để xem trang trên từng màn hình.</li>' +
      '<li>“▶ Xem thử” để bấm nút, mở menu, chuyển trang như trang thật.</li></ul></div>';
    return h;
  }

  function renderJsonTab() {
    const head = $('#pg-insp-head'), body = $('#pg-props');
    head.innerHTML = '<div class="pg-ihead"><span class="pg-iico">{ }</span><div><b>Dữ liệu dự án (JSON)</b><small>Toàn bộ dự án. Sửa trực tiếp rồi bấm Áp dụng (hoàn tác được).</small></div></div>';
    body.dataset.key = 'json';
    body.innerHTML =
      `<div class="btn-row pg-json-acts"><button type="button" class="btn primary" data-act="json-apply">Áp dụng</button><button type="button" class="btn" data-act="json-reload">Tải lại</button><button type="button" class="btn" data-act="json-copy">Sao chép</button></div>` +
      `<textarea id="pg-json" class="code pg-json" spellcheck="false" aria-label="JSON dự án">${esc(JSON.stringify(S.proj, null, 2))}</textarea>`;
  }

  // ---- sự kiện của bảng thuộc tính
  /** Giá trị độ dài từ ô số + đơn vị */
  function lenValue(fk) {
    const box = $(`#pg-props [data-len="${CSS.escape(fk)}"]`);
    const u = $(`#pg-props [data-lenu="${CSS.escape(fk)}"]`);
    if (!box || box.value === '') return null;
    const unit = u ? u.value : 'px';
    return unit === 'px' ? Number(box.value) : box.value + unit;
  }
  function onPropInput(e) {
    const t = e.target;
    if (t.dataset.cell) return setCell(t.dataset.cell, t.value);
    if (t.dataset.len) {
      const v = lenValue(t.dataset.len);
      if (v != null) setValue(t.dataset.len, v, true);
      return;
    }
    if (t.dataset.grada) {
      const a = Number(t.value);
      if (!isFinite(a)) return;
      t.parentElement.querySelectorAll('[data-grada]').forEach((x) => x !== t && (x.value = a));
      setGrad(t.dataset.grada, (g) => (g.angle = a), true);
      return refreshGradPreview(t.dataset.grada);
    }
    if (t.dataset.gradc) {
      setGrad(t.dataset.gradc, (g) => (g.stops[+t.dataset.i].c = t.value), true);
      const hx = t.parentElement.querySelector('[data-gradh]');
      if (hx) hx.value = t.value;
      return refreshGradPreview(t.dataset.gradc);
    }
    if (t.dataset.gradp) {
      if (t.value === '' || !isFinite(+t.value)) return;
      setGrad(t.dataset.gradp, (g) => (g.stops[+t.dataset.i].p = +t.value), true);
      return refreshGradPreview(t.dataset.gradp);
    }
    if (t.dataset.frame) {
      const v = t.value === '' ? undefined : Number(t.value);
      return setFrames(t.dataset.frame, (fr) => {
        if (v === undefined && t.dataset.fk !== 'at') delete fr[+t.dataset.i][t.dataset.fk];
        else if (v !== undefined) fr[+t.dataset.i][t.dataset.fk] = v;
      }, 'frames');
    }
    if (t.dataset.gradh != null || t.dataset.rtc || t.dataset.gfam != null || t.dataset.font != null) return;
    if (t.dataset.hex != null || t.dataset.opt || t.dataset.name != null || t.id === 'pg-json') return;
    const fk = t.dataset.k;
    if (!fk || t.type === 'checkbox' || t.tagName === 'SELECT') return;
    let v = t.value;
    if (t.type === 'number' || t.type === 'range') {
      if (v === '') return;
      v = Number(v);
      const twin = t.parentElement.querySelector(`input[data-k="${CSS.escape(fk)}"]:not([type="${t.type}"])`);
      if (twin) twin.value = v;
    }
    if (t.dataset.lines != null) v = v.split('\n');
    const [scope, k] = splitKey(fk);
    if (scope === 'node' && PK.FX_KEYS.includes(k) && k !== 'speed') setFx(k.indexOf('press') === 0 ? 'press' : 'hover');
    setValue(fk, v, true);
  }
  function refreshGradPreview(fk) {
    const g = gradOf(fk);
    const box = $(`#pg-props [data-gradoff="${CSS.escape(fk)}"]`);
    const prev = box && box.closest('.pg-grad') && box.closest('.pg-grad').querySelector('.pg-grad-prev');
    if (prev && g) prev.style.backgroundImage = PK.gradCss(g);
  }
  function onPropChange(e) {
    const t = e.target;
    if (t.dataset.cell || t.id === 'pg-json' || t.dataset.len || t.dataset.grada || t.dataset.gradc || t.dataset.gradp || t.dataset.frame) {
      if (t.dataset.len || t.dataset.grada || t.dataset.gradp || t.dataset.frame) renderInspector();
      return;
    }
    if (t.dataset.lenu) {
      const v = lenValue(t.dataset.lenu);
      if (v != null) setValue(t.dataset.lenu, v);
      return renderInspector();
    }
    if (t.dataset.gradat) {
      setGrad(t.dataset.gradat, (g) => (g.at = t.value));
      return renderInspector();
    }
    if (t.dataset.gradh) {
      const v = t.value.trim();
      setGrad(t.dataset.gradh, (g) => (g.stops[+t.dataset.i].c = v || '#000000'));
      return renderInspector();
    }
    if (t.dataset.rtc) {
      const ta = $(`#pg-props textarea[data-k="${CSS.escape(t.dataset.rtc)}"]`);
      if (ta) wrapSel(ta, '[', `]{${t.value}}`);
      return;
    }
    if (t.dataset.font != null || t.dataset.gfam != null) return;
    if (t.dataset.hex) {
      const v = t.value.trim();
      if (!v) resetValue(t.dataset.hex);
      else if (!setValue(t.dataset.hex, v)) toast('Mã màu không hợp lệ – dùng dạng #2563eb', 'warn');
      return renderInspector();
    }
    if (t.dataset.opt) return toggleOpt(t.dataset.opt, t.checked);
    const fk = t.dataset.k;
    if (!fk) return;
    if (t.type === 'checkbox') setValue(fk, t.checked);
    else if (t.tagName === 'SELECT') setValue(fk, t.value);
    else if (t.type === 'text' || t.tagName === 'TEXTAREA') {
      const v = t.dataset.lines != null ? t.value.split('\n') : t.value;
      const f = fieldOf(...splitKey(fk));
      if (!setValue(fk, v) && f && ['url', 'image', 'ident', 'name'].includes(f.type) && t.value.trim())
        toast(
          f.type === 'ident' ? 'Tên hàm chỉ gồm chữ cái không dấu, số, _ (vd: guiDonHang)' : f.type === 'name' ? 'Tên trường chỉ gồm chữ cái không dấu, số, _ - .' : 'Địa chỉ không hợp lệ hoặc không an toàn (chỉ nhận http/https, mailto, tel, #…)',
          'warn'
        );
    }
    renderInspector();
  }
  function onPropClick(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.rtw != null) {
      const ta = b.closest('.f').querySelector('textarea[data-k]');
      const [l, r] = RT[+d.rtw];
      if (ta) wrapSel(ta, l, r, r.startsWith('](') ? 'url' : null);
      return;
    }
    if (d.lenclear) {
      const [scope, k] = splitKey(d.lenclear);
      const f = fieldOf(scope, k);
      if (f && f.opt) setValue(d.lenclear, null);
      else resetValue(d.lenclear);
      return renderInspector();
    }
    if (d.gradon) {
      setValue(d.gradon, DE.clone(GRAD_DEF));
      return renderInspector();
    }
    if (d.gradoff) {
      resetValue(d.gradoff);
      return renderInspector();
    }
    if (d.gset) {
      setGrad(d.gset, (g) => {
        g[d.gkey] = d.v;
        if (d.gkey === 'kind' && d.v === 'radial') g.shape = g.shape || 'ellipse';
      });
      return renderInspector();
    }
    if (d.gradadd) {
      setGrad(d.gradadd, (g) => {
        const last = g.stops[g.stops.length - 1];
        g.stops.push({ c: last ? last.c : '#ffffff', p: 100 });
      });
      return renderInspector();
    }
    if (d.gradx) {
      setGrad(d.gradx, (g) => g.stops.splice(+d.i, 1));
      return renderInspector();
    }
    if (d.frameadd) {
      setFrames(d.frameadd, (fr) => {
        const last = fr[fr.length - 1];
        fr.push(Object.assign({}, last, { at: 100 }));
        if (last && last.at === 100) last.at = 50;
      });
      return renderInspector();
    }
    if (d.framex) {
      setFrames(d.framex, (fr) => fr.splice(+d.i, 1));
      return renderInspector();
    }
    if (d.fontdel) return deleteFont(d.fontdel);
    if (d.fontuse) {
      setValue('theme:font', d.fontuse);
      return renderInspector();
    }
    if (b.dataset.seg) {
      setValue(b.dataset.seg, b.dataset.v);
      return renderInspector();
    }
    if (b.dataset.set != null) {
      setValue(b.dataset.set, b.dataset.v);
      return renderInspector();
    }
    if (b.dataset.reset) {
      resetValue(b.dataset.reset);
      return renderInspector();
    }
    if (b.dataset.tgl) {
      const n = nodeOf(st.sel);
      if (n) setValue(b.dataset.tgl, !PK.resolve(n, theme())[b.dataset.tgl]);
      return renderInspector();
    }
    if (b.dataset.fx != null) return setFx(b.dataset.fx);
    if (b.dataset.upload) return uploadImage(b.dataset.upload);
    if (b.dataset.act) return act(b.dataset.act, b.dataset.v);
  }
  function toggleOpt(k, on) {
    const n = nodeOf(st.sel);
    if (!n) return;
    const f = PK.FIELDS[k];
    if (on) {
      const v = f.type === 'color' ? (f.auto ? 'auto' : theme().primary) : f.def;
      setValue(k, v);
      setFx(k.indexOf('press') === 0 ? 'press' : 'hover');
    } else if (PK.defaultOf(n, k, theme()) != null) setValue(k, null);
    else resetValue(k);
    renderInspector();
  }
  function setCell(pos, value) {
    const [r, c] = pos.split(',').map(Number);
    const n = nodeOf(st.sel);
    if (!n) return;
    const rows = DE.clone(PK.resolve(n, theme()).rows);
    if (!rows[r]) return;
    rows[r][c] = value;
    setValue('rows', rows, true);
  }
  function tableOp(fn) {
    const n = nodeOf(st.sel);
    if (!n) return;
    const rows = DE.clone(PK.resolve(n, theme()).rows);
    fn(rows);
    if (!rows.length) rows.push(['']);
    if (!rows[0].length) rows.forEach((r) => r.push(''));
    setValue('rows', rows);
    renderInspector();
  }

  function act(a, v) {
    const n = nodeOf(st.sel);
    switch (a) {
      case 'dup':
        return duplicate();
      case 'del':
        return remove();
      case 'copy':
        return copySel();
      case 'reset-all': {
        if (!n) return;
        const KEEP = ['text', 'level', 'items', 'rows', 'header', 'src', 'alt', 'label', 'placeholder', 'inputType', 'options', 'required', 'fieldName', 'checked', 'action', 'linkKind', 'page', 'url', 'newTab', 'menu', 'submitKind', 'func', 'message', 'menuName', 'mode', 'kind', 'tag', 'icon', 'iconPos', 'variant', 'size', 'method', 'anchorId'];
        commit((proj) => {
          const x = PK.find(proj, n.id).node;
          for (const k of Object.keys(x.props)) if (!KEEP.includes(k)) delete x.props[k];
        });
        toast('Đã đặt lại định dạng về mặc định (giữ nội dung)', 'ok');
        return renderInspector();
      }
      case 'new-menu': {
        if (!n) return;
        const m = PK.paletteItem(v === 'full' ? 'menu-full' : 'menu-panel').build()[0];
        commit((proj) => {
          pageIn(proj).children.push(m);
          PK.find(proj, n.id).node.props.menu = m.id;
        });
        toast('Đã tạo menu mới ở cuối trang và gắn vào nút – chọn menu trên trang để sửa các mục', 'ok');
        return renderInspector();
      }
      case 'goto-menu':
        if (n && n.props.menu) {
          const f = find(n.props.menu);
          if (f && f.page.id !== st.page) switchPage(f.page.id);
          select(n.props.menu, { scroll: true });
        }
        return;
      case 'new-page-link': {
        if (!n) return;
        const id = addPage(n.props.text && n.props.text.length < 40 ? n.props.text : null, true, true);
        commit((proj) => {
          const x = PK.find(proj, n.id);
          if (x) Object.assign(x.node.props, { action: 'link', linkKind: 'page', page: id });
        });
        const pg = S.proj.pages.find((p) => p.id === id);
        toast(`Đã tạo trang “${pg.name}” (#/${pg.path}) và gắn vào nút – bấm tab trang phía trên để soạn nội dung`, 'ok');
        return renderInspector();
      }
      case 'row-add':
        return tableOp((rows) => rows.push(rows[0].map(() => '')));
      case 'col-add':
        return tableOp((rows) => rows.forEach((r, i) => r.push(i === 0 ? 'Cột ' + (r.length + 1) : '')));
      case 'row-del':
        return tableOp((rows) => rows.splice(+v, 1));
      case 'col-del':
        return tableOp((rows) => rows.forEach((r) => r.splice(+v, 1)));
      case 'table-paste':
        return pasteTableDialog();
      case 'anim-play':
        return playAnim(st.sel);
      case 'fonts':
        // quản lý font nằm ở bảng của trang (bỏ chọn thành phần)
        st.groups['page:fonts'] = true;
        select(null);
        requestAnimationFrame(() => {
          const g = $('#pg-props details[data-g="page:fonts"]');
          if (g) g.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
        return;
      case 'font-google':
        return addGoogleFont();
      case 'font-upload':
        return uploadFonts();
      case 'font-url':
        return addUrlFont();
      case 'page-dup':
        return duplicatePage();
      case 'page-move':
        return movePage(+v);
      case 'page-home':
        return movePage(-S.proj.pages.indexOf(curPage()));
      case 'page-del':
        return deletePage();
      case 'json-apply':
        return applyJsonTab();
      case 'json-reload':
        return renderJsonTab();
      case 'json-copy': {
        const ta = $('#pg-json');
        (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject())
          .then(() => toast('Đã sao chép JSON dự án', 'ok'))
          .catch(() => {
            ta.select();
            toast('Hãy nhấn Ctrl+C để sao chép', 'info');
          });
        return;
      }
    }
  }

  // ---- chuyển động: chạy thử một lần trong khung soạn
  function playAnim(id) {
    const el = elOf(id), n = nodeOf(id);
    if (!el || !n) return;
    const P = PK.resolve(n, theme());
    el.classList.remove('pg-ed-play');
    void el.offsetWidth;
    el.classList.add('pg-ed-play');
    clearTimeout(el._playT);
    el._playT = setTimeout(() => {
      el.classList.remove('pg-ed-play');
      drawOverlay();
    }, P.animLoop ? 4000 : (P.animDur || 700) + (P.animDelay || 0) + 300);
  }

  // ---- font riêng của dự án
  const FAMILY_OK = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,59}$/;
  function addFonts(list) {
    if (!list.length) return;
    commit((proj) => {
      proj.fonts = proj.fonts || [];
      for (const f of list) {
        const i = proj.fonts.findIndex((x) => x.id === f.id);
        if (i >= 0) {
          // cùng họ font: gộp thêm file / độ đậm
          const cur = proj.fonts[i];
          if (f.faces) cur.faces = (cur.faces || []).concat(f.faces).slice(0, 18);
          if (f.google) cur.google = f.google;
        } else proj.fonts.push(f);
      }
    });
    renderInspector();
  }
  function addGoogleFont() {
    const fam = ($('#pg-props [data-gfam]') || {}).value || '';
    const family = fam.trim().replace(/\s+/g, ' ');
    if (!FAMILY_OK.test(family)) return toast('Nhập đúng tên font trên Google Fonts, vd Poppins hoặc Open Sans', 'warn');
    const ws = (($('#pg-props [data-gw]') || {}).value || '')
      .split(/[\s,;]+/)
      .map(Number)
      .filter((w) => w >= 100 && w <= 900 && w % 100 === 0);
    addFonts([{ id: PK.fontId(family), name: family, family, google: { weights: [...new Set(ws)].sort((a, b) => a - b), italic: false } }]);
    toast(`Đã thêm font “${family}” – chọn nó ở “Font chữ” của thành phần hoặc của cả trang`, 'ok');
  }
  const FONT_MIME = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };
  const WEIGHT_WORDS = [[/thin|hairline/, '100'], [/extra-?light|ultra-?light/, '200'], [/light/, '300'], [/medium/, '500'], [/semi-?bold|demi-?bold/, '600'], [/extra-?bold|ultra-?bold/, '800'], [/black|heavy/, '900'], [/bold/, '700']];
  async function uploadFonts() {
    const files = await new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.multiple = true;
      inp.accept = '.woff2,.woff,.ttf,.otf';
      inp.hidden = true;
      inp.addEventListener('change', () => {
        resolve([...inp.files]);
        inp.remove();
      });
      document.body.appendChild(inp);
      inp.click();
    });
    if (!files.length) return;
    const typed = (($('#pg-props [data-ffam]') || {}).value || '').trim();
    const byFam = new Map();
    for (const f of files) {
      const ext = (f.name.match(/\.([a-z0-9]+)$/i) || [])[1] || '';
      const mime = FONT_MIME[ext.toLowerCase()];
      if (!mime) {
        toast(`“${f.name}” không phải file font (.woff2, .woff, .ttf, .otf)`, 'warn');
        continue;
      }
      if (f.size > 4e6) {
        toast(`“${f.name}” quá lớn (trên 4 MB)`, 'warn');
        continue;
      }
      const base = f.name.replace(/\.[^.]+$/, '');
      const low = base.toLowerCase();
      // "Poppins-SemiBoldItalic" -> họ "Poppins", độ đậm 600, nghiêng
      const family = typed || base.replace(/[-_ ]?(thin|hairline|extra-?light|ultra-?light|light|regular|normal|book|medium|semi-?bold|demi-?bold|extra-?bold|ultra-?bold|bold|black|heavy)?[-_ ]?(italic|oblique)?$/i, '').replace(/[-_]+/g, ' ').trim() || base;
      if (!FAMILY_OK.test(family)) {
        toast(`Tên font “${family}” có ký tự không dùng được – nhập tên font vào ô bên trên rồi tải lại`, 'warn');
        continue;
      }
      const weight = (WEIGHT_WORDS.find(([re]) => re.test(low)) || [null, '400'])[1];
      const style = /italic|oblique/.test(low) ? 'italic' : 'normal';
      const src = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).replace(/^data:[^;]*;/, `data:${mime};`));
        r.onerror = () => rej(r.error);
        r.readAsDataURL(f);
      });
      if (!byFam.has(family)) byFam.set(family, []);
      byFam.get(family).push({ src, weight, style });
    }
    addFonts([...byFam].map(([family, faces]) => ({ id: PK.fontId(family), name: family, family, faces })));
    if (byFam.size) toast(`Đã thêm ${byFam.size} font – file font nằm trong dự án nên file JSON / HTML sẽ nặng hơn`, 'ok');
  }
  function addUrlFont() {
    const url = (($('#pg-props [data-furl]') || {}).value || '').trim();
    const family = (($('#pg-props [data-ffam]') || {}).value || '').trim();
    const src = PK.safeFont(url);
    if (!src || !/^https?:/i.test(src)) return toast('Địa chỉ file font phải bắt đầu bằng https://', 'warn');
    if (!FAMILY_OK.test(family)) return toast('Nhập tên font (chữ cái, số, khoảng trắng)', 'warn');
    addFonts([{ id: PK.fontId(family), name: family, family, faces: [{ src, weight: '400', style: 'normal' }] }]);
    toast(`Đã thêm font “${family}”`, 'ok');
  }
  function deleteFont(id) {
    let used = 0;
    PK.walkProject(S.proj, (n) => {
      if (n.props.font === id) used++;
    });
    commit((proj) => {
      proj.fonts = (proj.fonts || []).filter((f) => f.id !== id);
      if (!proj.fonts.length) delete proj.fonts;
      if (proj.theme.font === id) proj.theme.font = PK.THEME_DEF.font;
      PK.walkProject(proj, (n) => {
        if (n.props.font === id) delete n.props.font;
      });
    });
    renderInspector();
    toast(`Đã xoá font${used ? ` – ${used} thành phần đang dùng nó về font của trang` : ''} (Ctrl+Z để hoàn tác)`, 'info');
  }
  function fontsForm() {
    const list = S.proj.fonts || [];
    const th = theme();
    let h = list.length
      ? '<ul class="pg-fonts">' +
        list
          .map((f) => {
            const src = f.google ? 'Google Fonts' + (f.google.weights.length ? ' · ' + f.google.weights.join(', ') : '') : `${(f.faces || []).length} file`;
            return `<li><span style="font-family:${esc(PK.fontFamily(f.id, S.proj))}">${esc(f.name)}</span><small>${esc(src)}${th.font === f.id ? ' · đang dùng cho cả trang' : ''}</small>` +
              (th.font !== f.id ? `<button type="button" class="pg-mini" data-fontuse="${f.id}" title="Dùng làm font chung của dự án">Dùng chung</button>` : '') +
              `<button type="button" class="pg-mini" data-fontdel="${f.id}" title="Xoá font này">×</button></li>`;
          })
          .join('') +
        '</ul>'
      : '<p class="pg-hint">Chưa có font riêng. Thêm từ Google Fonts, tải file font, hoặc nhập trang HTML có font.</p>';
    h +=
      '<div class="pg-fontadd"><span class="pg-lab">Google Fonts</span><div class="pg-fontrow"><input type="text" data-gfam placeholder="Tên font, vd Poppins" spellcheck="false"><input type="text" data-gw placeholder="Độ đậm: 400 700" spellcheck="false"><button type="button" class="btn" data-act="font-google">Thêm</button></div>' +
      '<small class="pg-hint">Độ đậm phải có trong font (xem trên fonts.google.com) – để trống = chỉ bản thường.</small></div>' +
      '<div class="pg-fontadd"><span class="pg-lab">File font của bạn</span><div class="pg-fontrow"><input type="text" data-ffam placeholder="Tên font (tự đoán theo tên file nếu trống)" spellcheck="false"></div>' +
      '<div class="pg-fontrow"><button type="button" class="btn" data-act="font-upload">Tải file .woff2 / .ttf…</button></div>' +
      '<div class="pg-fontrow"><input type="url" data-furl placeholder="hoặc địa chỉ https://…/font.woff2" spellcheck="false"><button type="button" class="btn" data-act="font-url">Thêm</button></div></div>';
    return h;
  }

  function applyJsonTab() {
    let res;
    try {
      res = PK.normalize(JSON.parse($('#pg-json').value));
    } catch (e) {
      return toast('JSON không hợp lệ: ' + e.message, 'error');
    }
    load(res.proj, { page: st.page });
    reportFixes(res, 'JSON');
    st.itab = 'json';
    renderJsonTab();
  }
  function reportFixes(res, what) {
    const n = res.fixed.length + res.removed.length;
    if (!n) return toast(`Đã áp dụng ${what}`, 'ok');
    console.info('[Thiết kế trang] Điều chỉnh khi đọc ' + what + ':\n' + res.removed.concat(res.fixed).join('\n'));
    toast(`Đã áp dụng ${what} – app tự ${res.removed.length ? `bỏ ${res.removed.length} phần không hợp lệ, ` : ''}${res.fixed.length ? `sửa ${res.fixed.length} giá trị` : ''}`.replace(/, $/, ''), 'warn');
  }

  function pasteTableDialog() {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML =
      '<div class="modal doc-form-modal" role="dialog" aria-modal="true" aria-labelledby="pg-tp-title"><h3 id="pg-tp-title">Dán dữ liệu bảng</h3>' +
      '<p class="hint">Sao chép vùng ô trong Excel / Google Sheets rồi dán vào đây. Mỗi dòng là một hàng; các cột ngăn bằng Tab, dấu | hoặc dấu phẩy.</p>' +
      '<textarea class="code pg-tp" rows="10" spellcheck="false" placeholder="Họ tên\tVai trò\nAn\tQuản trị"></textarea>' +
      '<div class="modal-actions"><button type="button" class="btn" data-r="cancel">Huỷ</button><button type="button" class="btn primary" data-r="ok">Thay dữ liệu bảng</button></div></div>';
    const ta = back.querySelector('textarea');
    const close = () => {
      window.removeEventListener('keydown', onKey, true);
      back.remove();
    };
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') close();
    };
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (e.target === back || (b && b.dataset.r === 'cancel')) return close();
      if (!b) return;
      const lines = ta.value.replace(/\r/g, '').split('\n').filter((l) => l.trim());
      if (!lines.length) return close();
      const sep = lines[0].includes('\t') ? '\t' : lines[0].includes('|') ? '|' : ',';
      const rows = lines.map((l) => {
        let cells = l.split(sep).map((c) => c.trim());
        if (sep === '|') cells = cells.filter((c, i, a) => !((i === 0 || i === a.length - 1) && c === ''));
        return cells;
      }).filter((r) => !(sep === '|' && r.every((c) => /^:?-{2,}:?$/.test(c))));
      setValue('rows', rows);
      renderInspector();
      close();
      toast(`Đã nhập ${rows.length} hàng`, 'ok');
    });
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(back);
    ta.focus();
  }

  // ---- ảnh
  function pickImage() {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.hidden = true;
      inp.addEventListener('change', () => {
        resolve(inp.files[0] || null);
        inp.remove();
      });
      document.body.appendChild(inp);
      inp.click();
    });
  }
  const readURL = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error('Không đọc được file ảnh'));
      r.readAsDataURL(file);
    });
  /** Ảnh -> data URI; ảnh lớn được thu nhỏ (cạnh dài ≤ 1600px) để file dự án gọn */
  async function imageToData(file) {
    if (!/^image\//.test(file.type)) throw new Error(`"${file.name}" không phải ảnh`);
    if (file.size > 20e6) throw new Error('Ảnh quá lớn (trên 20 MB)');
    const url = await readURL(file);
    if (/svg|gif/.test(file.type) || file.size < 350e3) return url;
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error('Không đọc được ảnh'));
      img.src = url;
    });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.86);
    return out.length < url.length ? out : url;
  }
  async function uploadImage(fk) {
    const file = await pickImage();
    if (!file) return;
    try {
      const url = await imageToData(file);
      if (!setValue(fk, url)) return toast('Không dùng được ảnh này', 'warn');
      const [scope, k] = splitKey(fk);
      if (scope === 'node' && k === 'src') {
        const n = nodeOf(st.sel);
        if (n && !n.props.alt) setValue('alt', file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
      }
      renderInspector();
      if (url.length > 1.5e6) toast('Ảnh khá nặng – file dự án sẽ lớn. Nên dùng ảnh dưới 500 KB.', 'warn');
    } catch (e) {
      toast(e.message, 'error');
    }
  }
  /** Thả file ảnh vào tab: thêm thành phần Ảnh tại chỗ thả */
  PG.insertImageFiles = async function (files, ev) {
    for (const file of files) {
      try {
        const src = await imageToData(file);
        const nodes = [PK.mk('image', { src, alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') })];
        let drop = null;
        if (ev) {
          const cr = canvas.getBoundingClientRect();
          if (ev.clientX >= cr.left && ev.clientX <= cr.right && ev.clientY >= cr.top && ev.clientY <= cr.bottom) drop = computeDrop(toFrame(ev.clientX, ev.clientY), { kind: 'new', nodes });
        }
        insertNodes(nodes, drop);
      } catch (e) {
        toast(e.message, 'error');
      }
    }
  };

  // =============================================================== CÂY LỚP
  let layerDrag = null;
  function layerBadges(n) {
    const P = n.props || {};
    const b = [];
    if (P.hideMobile) b.push('<i title="Ẩn trên điện thoại">ẩn ĐT</i>');
    if (P.hideDesktop) b.push('<i title="Ẩn trên máy tính & máy tính bảng">ẩn MT</i>');
    if (n.type === 'button' && P.action === 'show') b.push('<i title="Nút mở menu">☰</i>');
    return b.join('');
  }
  function renderLayers() {
    if (!ready || st.ptab !== 'layers') return;
    const box = $('#pg-layers');
    const page = curPage();
    let h = `<div class="pgl-row pgl-page${!st.sel ? ' sel' : ''}" data-id=""><span class="pgl-ico">${PK.icon('section', 15)}</span><span class="pgl-name">${esc(page.name)}</span><small>${countNodes(page.children)}</small></div>`;
    const rec = (list, depth) => {
      for (const n of list) {
        const has = !!(n.children && n.children.length);
        const col = st.collapsed.has(n.id);
        const el = elOf(n.id);
        const hidden = el && !el.getClientRects().length;
        h +=
          `<div class="pgl-row${n.id === st.sel ? ' sel' : ''}${hidden ? ' dim' : ''}${n.type === 'menu' ? ' pgl-menu' : ''}" data-id="${n.id}" draggable="true" style="--d:${depth}">` +
          `<button type="button" class="pgl-caret" data-caret tabindex="-1"${has ? ` aria-label="${col ? 'Mở' : 'Thu gọn'}"` : ' disabled'}>${has ? (col ? '▸' : '▾') : ''}</button>` +
          `<span class="pgl-ico">${PK.icon(PK.typeIcon(n), 15)}</span><span class="pgl-name">${esc(shortName(n))}</span>${layerBadges(n)}</div>`;
        if (has && !col) rec(n.children, depth + 1);
      }
    };
    rec(page.children, 1);
    box.innerHTML = h;
  }
  function highlightLayers() {
    if (st.ptab !== 'layers') return;
    const box = $('#pg-layers');
    // mở các nhánh chứa thành phần đang chọn
    let reopen = false;
    for (const n of pathTo(st.sel).slice(0, -1))
      if (st.collapsed.has(n.id)) {
        st.collapsed.delete(n.id);
        reopen = true;
      }
    if (reopen) renderLayers();
    $$('.pgl-row', box).forEach((r) => r.classList.toggle('sel', (r.dataset.id || null) === st.sel));
    const row = $('.pgl-row.sel', box);
    if (row) row.scrollIntoView({ block: 'nearest' });
  }
  function initLayers() {
    const box = $('#pg-layers');
    box.addEventListener('click', (e) => {
      const row = e.target.closest('.pgl-row');
      if (!row) return;
      if (e.target.closest('[data-caret]') && row.dataset.id) {
        const id = row.dataset.id;
        if (st.collapsed.has(id)) st.collapsed.delete(id);
        else st.collapsed.add(id);
        return renderLayers();
      }
      select(row.dataset.id || null, { scroll: true });
    });
    box.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.pgl-row[data-id]');
      if (!row || !row.dataset.id) return;
      select(row.dataset.id);
      const inp = $('#pg-insp-head [data-name]');
      if (inp) {
        inp.focus();
        inp.select();
      }
    });
    box.addEventListener('mouseover', (e) => {
      const row = e.target.closest('.pgl-row');
      setHover(row && row.dataset.id ? row.dataset.id : null);
    });
    box.addEventListener('mouseleave', () => setHover(null));
    const clear = () => $$('.drop-before,.drop-after,.drop-inside', box).forEach((r) => r.classList.remove('drop-before', 'drop-after', 'drop-inside'));
    const zone = (row, e) => {
      const id = row.dataset.id || null;
      const d = { kind: 'move', id: layerDrag };
      if (!id) return canHold(null, d) ? { parent: null, index: curPage().children.length, cls: 'drop-inside' } : null;
      if (id === layerDrag) return null;
      const f = find(id);
      const r = row.getBoundingClientRect();
      const y = (e.clientY - r.top) / r.height;
      const pid = f.parent ? f.parent.id : null;
      if (TYPES[f.node.type].container && y > 0.28 && y < 0.72 && canHold(id, d)) return { parent: id, index: f.node.children.length, cls: 'drop-inside' };
      if (!canHold(pid, d)) return null;
      return y < 0.5 ? { parent: pid, index: f.index, cls: 'drop-before' } : { parent: pid, index: f.index + 1, cls: 'drop-after' };
    };
    box.addEventListener('dragstart', (e) => {
      const row = e.target.closest('.pgl-row');
      if (!row || !row.dataset.id) return e.preventDefault();
      layerDrag = row.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', shortName(nodeOf(layerDrag)));
      row.classList.add('dragging');
    });
    box.addEventListener('dragover', (e) => {
      if (!layerDrag) return;
      const row = e.target.closest('.pgl-row');
      clear();
      if (!row) return;
      const z = zone(row, e);
      if (!z) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.classList.add(z.cls);
    });
    box.addEventListener('drop', (e) => {
      if (!layerDrag) return;
      e.preventDefault();
      e.stopPropagation();
      const row = e.target.closest('.pgl-row');
      const z = row && zone(row, e);
      const id = layerDrag;
      layerDrag = null;
      clear();
      if (z) moveNode(id, z);
    });
    box.addEventListener('dragend', () => {
      layerDrag = null;
      clear();
      $$('.dragging', box).forEach((r) => r.classList.remove('dragging'));
    });
  }

  // =============================================================== TRANG
  function renderPages() {
    const box = $('#pg-pages');
    box.innerHTML =
      S.proj.pages
        .map(
          (p, i) =>
            `<button type="button" role="tab" class="pg-ptab${p.id === st.page ? ' active' : ''}" data-page="${p.id}" aria-selected="${p.id === st.page}" title="#/${esc(p.path)}${i === 0 ? ' · trang chủ' : ''} – nhấn đúp để đổi tên">` +
            `${i === 0 ? '<span aria-hidden="true">⌂</span> ' : ''}${esc(p.name)}</button>`
        )
        .join('') + '<button type="button" class="pg-ptab-add" data-act="add-page" title="Thêm trang mới (chép sẵn phần đầu & chân trang của trang chủ)">＋ Trang</button>';
  }
  function switchPage(id) {
    if (id === st.page) return;
    finishEdit(true);
    st.page = id;
    st.sel = st.hover = null;
    st.fx = '';
    canvas.scrollTop = 0;
    render();
    renderInspector();
    persist();
  }
  /** Thêm trang: chép phần đầu (header / nav), menu và chân trang của trang chủ cho thống nhất */
  function addPage(name, silent, stay) {
    const first = S.proj.pages[0];
    const n = S.proj.pages.length + 1;
    name = name || `Trang ${n}`;
    const keep = first.children.filter((x) => x.type === 'menu' || (x.type === 'section' && ['header', 'nav', 'footer'].includes((x.props || {}).tag)));
    const copies = PK.cloneFresh(keep);
    const head = copies.filter((x) => x.type !== 'section' || x.props.tag !== 'footer');
    const foot = copies.filter((x) => x.type === 'section' && x.props.tag === 'footer');
    const page = {
      id: DE.uid('p'),
      name,
      path: '',
      props: {},
      children: [...head, PK.mk('section', { gap: 20 }, [PK.mk('heading', { text: name, level: '1' }), PK.mk('text', { text: 'Nội dung của trang ' + name + '.' })]), ...foot],
    };
    commit((proj) => {
      page.path = uniquePath(proj, PK.slug(name) || 'trang', page.id);
      proj.pages.push(page);
    });
    if (!stay) switchPage(page.id);
    if (!silent) toast(keep.length ? 'Đã thêm trang – chép sẵn phần đầu & chân trang từ trang chủ' : 'Đã thêm trang mới', 'ok');
    return page.id;
  }
  function duplicatePage() {
    const pg = curPage();
    const copy = { id: DE.uid('p'), name: pg.name + ' (bản sao)', path: '', props: DE.clone(pg.props), children: PK.cloneFresh(pg.children) };
    commit((proj) => {
      copy.path = uniquePath(proj, pg.path + '-ban-sao', copy.id);
      proj.pages.splice(proj.pages.indexOf(pageIn(proj)) + 1, 0, copy);
    });
    switchPage(copy.id);
  }
  function movePage(delta) {
    const i = S.proj.pages.indexOf(curPage()), j = i + delta;
    if (!delta || j < 0 || j >= S.proj.pages.length) return;
    commit((proj) => {
      const [p] = proj.pages.splice(i, 1);
      proj.pages.splice(j, 0, p);
    });
    renderInspector();
    if (j === 0) toast(`“${curPage().name}” giờ là trang chủ (mở đầu tiên trong file HTML)`, 'ok');
  }
  async function deletePage() {
    if (S.proj.pages.length < 2) return;
    const pg = curPage();
    const ok = await DE.ui.confirm({ title: `Xoá trang “${pg.name}”?`, message: `Trang có ${countNodes(pg.children)} thành phần. Nút đang chuyển tới trang này sẽ về trang chủ.\nCó thể hoàn tác bằng Ctrl+Z.`, ok: 'Xoá trang', danger: true });
    if (!ok) return;
    const i = S.proj.pages.indexOf(pg);
    commit((proj) => {
      proj.pages.splice(i, 1);
      PK.walkProject(proj, (n) => {
        if (n.props.page === pg.id) delete n.props.page;
      });
    });
    switchPage(S.proj.pages[Math.max(0, i - 1)].id);
    renderInspector();
  }

  // =============================================================== THƯ VIỆN BÊN TRÁI
  const fold = (s) => PK.slug(s).replace(/-/g, ' ');
  function initPalette() {
    const list = $('#pg-parts-list');
    list.innerHTML = PK.PALETTE.map(
      (c) =>
        `<section class="pal-sec pgp-sec" data-cat="${c.id}"><h3>${esc(c.name)}</h3><div class="pgp-grid">` +
        c.items
          .map((it) => {
            const t = it.build()[0].type;
            const desc = it.desc || TYPES[t].desc;
            it.search = fold(it.name + ' ' + desc + ' ' + TYPES[t].name);
            return `<button type="button" class="pgp-item" data-key="${it.key}" title="${esc(it.name + ': ' + desc + ' – kéo vào trang, hoặc bấm để thêm')}">${PK.icon(it.icon)}<span>${esc(it.name)}</span></button>`;
          })
          .join('') +
        '</div></section>'
    ).join('');
    list.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.pgp-item');
      if (!b || e.button !== 0) return;
      e.preventDefault();
      const it = PK.paletteItem(b.dataset.key);
      beginDrag({ kind: 'new', nodes: it.build(), name: it.name, icon: it.icon, x0: e.clientX, y0: e.clientY });
    });
    list.addEventListener('keydown', (e) => {
      const b = e.target.closest('.pgp-item');
      if (b && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        insertNodes(PK.paletteItem(b.dataset.key).build(), null);
      }
    });
    list.addEventListener('click', (e) => {
      const h = e.target.closest('.pgp-sec h3');
      if (h) h.parentElement.classList.toggle('collapsed');
    });
    $('#pg-parts-search').addEventListener('input', (e) => {
      const q = fold(e.target.value).trim();
      $$('.pgp-sec', list).forEach((sec) => {
        let any = false;
        $$('.pgp-item', sec).forEach((b) => {
          const it = PK.paletteItem(b.dataset.key);
          const on = !q || it.search.includes(q);
          b.hidden = !on;
          any = any || on;
        });
        sec.hidden = !any;
        sec.classList.toggle('searching', !!q);
      });
    });
  }
  function setPtab(v, save = true) {
    st.ptab = v === 'layers' ? 'layers' : 'parts';
    $$('.pg-left [data-ptab]').forEach((b) => {
      const on = b.dataset.ptab === st.ptab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    $('#pg-parts').hidden = st.ptab !== 'parts';
    $('#pg-layers').hidden = st.ptab !== 'layers';
    renderLayers();
    highlightLayers();
    if (save) saveUI();
  }
  function setItab(v) {
    finishEdit(true);
    st.itab = v === 'json' ? 'json' : 'props';
    $$('.pg-right [data-itab]').forEach((b) => {
      const on = b.dataset.itab === st.itab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    $('#pg-props').dataset.key = '';
    renderInspector();
  }

  // =============================================================== THANH CÔNG CỤ
  function setDevice(d, save = true) {
    st.device = DEVICES[d] ? d : 'desktop';
    $$('.pg-devices [data-device]').forEach((b) => {
      const on = b.dataset.device === st.device;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    syncSize();
    drawOverlay();
    renderLayers();
    updateStatus();
    if (save) saveUI();
  }
  function toggleOutline() {
    st.outline = !st.outline;
    if (fdoc) fdoc.body.classList.toggle('pg-outline', st.outline);
    $('.pg-toolbar [data-pg="outline"]').classList.toggle('active', st.outline);
    saveUI();
  }
  function updateStatus() {
    if (!ready) return;
    const pg = curPage();
    $('#pg-st-page').textContent = `Trang “${pg.name}” · ${countNodes(pg.children)} thành phần`;
    const dev = DEVICES[st.device];
    $('#pg-st-dev').textContent = `${dev.name} · ${view.W}px${view.s < 1 ? ` · thu nhỏ ${Math.round(view.s * 100)}%` : ''}`;
    $('#pg-st-sel').textContent = st.sel ? 'Đang chọn: ' + shortName(nodeOf(st.sel)) : '';
    const tb = $('.pg-toolbar');
    tb.querySelector('[data-pg="undo"]').disabled = !S.undo.length;
    tb.querySelector('[data-pg="redo"]').disabled = !S.redo.length;
    ['parent', 'up', 'down', 'duplicate', 'delete'].forEach((a) => (tb.querySelector(`[data-pg="${a}"]`).disabled = !st.sel));
  }
  function updateTitles() {
    const t = $('#ws-pg-title');
    if (t) t.textContent = S.proj.name;
    const dot = $('#ws-pg-dot');
    if (dot) dot.hidden = !S.dirty;
    const nm = $('#pg-name');
    if (nm && document.activeElement !== nm) nm.value = S.proj.name;
    if (active()) document.title = (S.dirty ? '● ' : '') + PG.title();
  }
  PG.title = () => `${S.proj.name} – Thiết kế trang – ChillCat Studio`;

  const fileName = (ext) => (PK.slug(S.proj.name) || 'trang-web') + ext;
  function saveJSON() {
    finishEdit(true);
    const name = fileName('.json');
    DE.download(name, new Blob([JSON.stringify(S.proj, null, 2)], { type: 'application/json' }));
    S.dirty = false;
    persist();
    updateTitles();
    toast(`Đã tải “${name}” – mở lại bằng nút Mở hoặc kéo thả file vào cửa sổ`, 'ok');
  }
  function exportHTML() {
    finishEdit(true);
    const name = fileName('.html');
    DE.download(name, new Blob([PK.exportHTML(S.proj)], { type: 'text/html' }));
    toast(`Đã xuất “${name}” – ${S.proj.pages.length} trang trong một file, mở bằng trình duyệt hoặc đưa lên hosting`, 'ok');
  }
  async function newProject() {
    finishEdit(true);
    const r = await DE.ui.confirm({
      title: 'Tạo dự án mới',
      message: 'Dự án hiện tại sẽ được thay (vẫn hoàn tác được bằng Ctrl+Z).\nBắt đầu từ trang trống, hay từ dự án mẫu 3 trang (trang chủ, giới thiệu, liên hệ)?',
      ok: 'Dự án mẫu',
      alt: 'Trang trống',
      cancel: 'Huỷ',
    });
    if (!r) return;
    load(PK.normalize(r === 'alt' ? PK.blank() : PK.sample()).proj, { dirty: false });
    toast(r === 'alt' ? 'Đã tạo dự án trống – kéo thành phần từ bên trái vào trang' : 'Đã tạo dự án mẫu', 'ok');
  }
  function openFile() {
    finishEdit(true);
    const inp = $('#pg-file-input');
    inp.value = '';
    inp.click();
  }
  /** Mở file .json dự án thiết kế trang (nút Mở, kéo thả) */
  PG.openFile = async function (file) {
    let raw;
    try {
      raw = JSON.parse(await file.text());
    } catch (e) {
      return toast(`“${file.name}” không phải JSON hợp lệ: ${e.message}`, 'error');
    }
    if (raw && Array.isArray(raw.nodes) && !raw.pages) {
      const r = await DE.ui.confirm({ title: 'Đây là file diagram', message: `“${file.name}” là một diagram, không phải dự án thiết kế trang. Mở nó ở tab Diagram?`, ok: 'Mở ở tab Diagram' });
      if (r) {
        DE.docs.show('diagram');
        DE.ui.openDiagramFile(file);
      }
      return;
    }
    let res;
    try {
      res = PK.normalize(raw);
    } catch (e) {
      return toast(`Không mở được “${file.name}”: ${e.message}`, 'error');
    }
    if (S.dirty && countNodes(S.proj.pages.flatMap((p) => p.children))) {
      const r = await DE.ui.confirm({ title: 'Mở dự án khác?', message: `Dự án “${S.proj.name}” có thay đổi chưa tải xuống. Mở “${file.name}” sẽ thay nó (vẫn hoàn tác được bằng Ctrl+Z).`, ok: 'Mở', alt: 'Tải JSON rồi mở', danger: true });
      if (!r) return;
      if (r === 'alt') saveJSON();
    }
    if (!active()) DE.docs.show('design');
    load(res.proj, { dirty: false });
    reportFixes(res, `“${file.name}”`);
  };

  // =============================================================== XEM THỬ
  function openPreview() {
    finishEdit(true);
    const back = document.createElement('div');
    back.className = 'modal-backdrop pg-pv';
    let dev = st.device;
    back.innerHTML =
      '<div class="pg-pv-box" role="dialog" aria-modal="true" aria-label="Xem thử trang web">' +
      '<div class="pg-pv-bar"><b>▶ Xem thử</b>' +
      `<div class="mode-switch pg-pv-dev" role="group" aria-label="Thiết bị">${Object.entries(DEVICES).map(([k, d]) => `<button type="button" data-dev="${k}" class="${k === dev ? 'active' : ''}">${d.name}</button>`).join('')}</div>` +
      '<span class="pg-pv-hint">Bấm nút, mở menu, chuyển trang, gửi biểu mẫu như trang thật</span><span class="pg-pv-sp"></span>' +
      '<button type="button" class="btn" data-pv="reload" title="Chạy lại từ đầu">↻ Tải lại</button><button type="button" class="btn" data-pv="export">Tải HTML</button><button type="button" class="btn primary" data-pv="close">Đóng (Esc)</button></div>' +
      '<div class="pg-pv-stage"><iframe title="Xem thử trang" sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"></iframe></div></div>';
    const ifr = back.querySelector('iframe');
    const size = () => {
      const d = DEVICES[dev];
      ifr.style.width = d.w ? d.w + 'px' : '100%';
      ifr.classList.toggle('framed', !!d.w);
      $$('[data-dev]', back).forEach((b) => b.classList.toggle('active', b.dataset.dev === dev));
    };
    const load1 = () => (ifr.srcdoc = PK.exportHTML(S.proj, { start: curPage().path }));
    const close = () => {
      window.removeEventListener('keydown', onKey, true);
      back.remove();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    back.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.dev) {
        dev = b.dataset.dev;
        size();
      } else if (b.dataset.pv === 'close') close();
      else if (b.dataset.pv === 'reload') load1();
      else if (b.dataset.pv === 'export') exportHTML();
    });
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(back);
    size();
    load1();
    back.querySelector('[data-pv="close"]').focus();
  }

  // =============================================================== PHÍM TẮT
  function onKey(e) {
    if (!active() || !ready || st.drag || st.editing || document.querySelector('.modal-backdrop')) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (mod && !e.altKey) {
      const map = {
        z: () => (e.shiftKey ? redo() : undo()),
        y: redo,
        d: () => st.sel && duplicate(),
        c: () => st.sel && !String(getSelection()) && copySel(),
        x: () => st.sel && copySel(true),
        v: paste,
        s: saveJSON,
        o: openFile,
      };
      const fn = map[k.toLowerCase()];
      if (!fn) return;
      if (k.toLowerCase() === 'c' && (!st.sel || String(getSelection()))) return;
      e.preventDefault();
      return fn();
    }
    if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown')) {
      e.preventDefault();
      return moveBy(k === 'ArrowUp' ? -1 : 1);
    }
    if (mod || e.altKey) return;
    if (k === 'Delete' || k === 'Backspace') {
      if (st.sel) {
        e.preventDefault();
        remove();
      }
    } else if (k === 'Escape') {
      if (st.sel) {
        e.preventDefault();
        selectParent();
      }
    } else if (k === 'Enter' || k === 'F2') {
      if (st.sel && startEdit(st.sel)) e.preventDefault();
    } else if (k === 'ArrowUp' || k === 'ArrowDown') {
      const f = find(st.sel);
      const list = f ? f.list : curPage().children;
      if (!list.length) return;
      e.preventDefault();
      const i = f ? f.index + (k === 'ArrowUp' ? -1 : 1) : 0;
      if (i >= 0 && i < list.length) select(list[i].id, { scroll: true });
    }
  }
  function focusFirstField() {
    const el = $('#pg-props textarea[data-k], #pg-props input[type="text"][data-k]');
    if (el) {
      el.focus();
      if (el.select) el.select();
    }
  }

  // =============================================================== AI
  /** Ngữ cảnh gửi kèm tin nhắn khi chat ở tab Thiết kế trang (ảnh tải lên được thay bằng mã ngắn) */
  PG.contextForAI = function () {
    finishEdit(true);
    const pg = curPage();
    aiImgs = {};
    let seq = 0;
    const proj = JSON.parse(
      JSON.stringify(S.proj, (key, val) => {
        if (typeof val === 'string' && val.length > 200 && /^data:/.test(val)) {
          const tok = `@img:${++seq}`;
          aiImgs[tok] = val;
          return tok;
        }
        return val;
      })
    );
    const sel = nodeOf(st.sel);
    return (
      `[Tab hiện tại: Thiết kế trang – dự án "${S.proj.name}", đang xem trang "${pg.name}" (id "${pg.id}", path "${pg.path}")` +
      (sel ? `, người dùng đang chọn thành phần id "${sel.id}" (${TYPES[sel.type].name})` : '') +
      ']\nDự án đang mở (nếu yêu cầu là tạo / sửa trang thì trả lại TOÀN BỘ dự án đã sửa trong một khối ```json, giữ id cũ):\n```json\n' +
      JSON.stringify(proj) +
      '\n```'
    );
  };
  function extractJSON(text) {
    const cands = [];
    const re = /```[^\n]*\n([\s\S]*?)```/g;
    let m;
    while ((m = re.exec(text))) cands.push(m[1]);
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a >= 0 && b > a) cands.push(text.slice(a, b + 1));
    for (const c of cands.sort((x, y) => y.length - x.length)) {
      try {
        const o = JSON.parse(c.trim());
        if (o && typeof o === 'object' && !Array.isArray(o.nodes) && (Array.isArray(o.pages) || Array.isArray(o.children))) return o;
      } catch (_) {
        /* thử ứng viên khác */
      }
    }
    return null;
  }
  const restoreImgs = (o) => {
    if (Array.isArray(o)) return o.map(restoreImgs);
    if (o && typeof o === 'object') {
      for (const k of Object.keys(o)) o[k] = restoreImgs(o[k]);
      return o;
    }
    return typeof o === 'string' && aiImgs[o] ? aiImgs[o] : o;
  };
  /**
   * Áp dụng câu trả lời của AI (khối ```json có "pages", hoặc một trang có "children").
   * Trả null nếu không có dữ liệu trang; { ok, pages, count, fixed, removed } hoặc { ok:false, error }.
   */
  PG.applyAIText = function (text) {
    const o = extractJSON(text || '');
    if (!o) return null;
    restoreImgs(o);
    let src;
    if (Array.isArray(o.pages)) {
      src = Object.assign({}, o, { theme: Object.assign({}, S.proj.theme, o.theme || {}) });
      if (o.script == null) src.script = S.proj.script;
      if (!o.name) src.name = S.proj.name;
    } else {
      const cur = curPage();
      src = Object.assign({}, DE.clone(S.proj), { pages: S.proj.pages.map((p) => (p.id === cur.id ? Object.assign({ id: p.id, name: p.name, path: p.path, props: p.props }, o) : p)) });
    }
    let res;
    try {
      res = PK.normalize(src);
    } catch (e) {
      return { ok: false, error: e.message };
    }
    aiBackup = { proj: JSON.stringify(S.proj), page: st.page };
    load(res.proj, { page: st.page });
    if (!active()) DE.docs.show('design');
    return { ok: true, pages: res.proj.pages.length, count: res.proj.pages.reduce((a, p) => a + countNodes(p.children), 0), fixed: res.fixed, removed: res.removed };
  };
  PG.undoAI = function () {
    if (!aiBackup) return false;
    const b = aiBackup;
    aiBackup = null;
    load(JSON.parse(b.proj), { page: b.page });
    return true;
  };
  PG.project = () => DE.clone(S.proj);
  PG.load = (obj) => {
    const r = PK.normalize(obj);
    load(r.proj);
    return r;
  };
  PG.html = () => PK.exportHTML(S.proj);
  PG.currentPageId = () => (S.proj ? curPage().id : null);
  /** Nhập trang HTML: thay dự án bằng obj (đã gộp sẵn), chuyển tới trang page – hoàn tác được */
  PG.applyImport = (obj, page) => {
    const r = PK.normalize(obj);
    if (!active()) DE.docs.show('design');
    load(r.proj, { page });
    return r;
  };
  /** API cho kiểm thử / DevTools */
  PG._ = { st, S, select, insertNodes, moveNode, computeDrop, toFrame, elOf, hit, startEdit, finishEdit, setValue, render, renderInspector, setDevice, switchPage, addPage, undo, redo, frame: () => frame };

  // =============================================================== KHỞI ĐỘNG
  PG.init = function () {
    if (!$('#designview')) return;
    canvas = $('#pg-canvas');
    stage = $('#pg-stage');
    overlay = $('#pg-overlay');
    let saved = null;
    try {
      saved = JSON.parse(lsGet(KEY) || 'null');
    } catch (_) {
      saved = null;
    }
    let proj = null;
    if (saved && saved.proj) {
      try {
        proj = PK.normalize(saved.proj).proj;
      } catch (_) {
        proj = null;
      }
    }
    S.proj = proj || PK.normalize(PK.sample()).proj;
    S.dirty = !!(proj && saved.dirty);
    st.page = saved && saved.page && S.proj.pages.some((p) => p.id === saved.page) ? saved.page : S.proj.pages[0].id;
    try {
      const u = JSON.parse(lsGet(UI_KEY) || 'null');
      if (u) {
        if (DEVICES[u.device]) st.device = u.device;
        st.outline = !!u.outline;
        st.ptab = u.ptab === 'layers' ? 'layers' : 'parts';
        if (u.groups && typeof u.groups === 'object') st.groups = u.groups;
      }
    } catch (_) {
      /* mặc định */
    }
    initFrame();
    initOverlay();
    initPalette();
    initLayers();

    const props = $('#pg-props');
    props.addEventListener('input', onPropInput);
    props.addEventListener('change', onPropChange);
    props.addEventListener('click', onPropClick);
    props.addEventListener(
      'toggle',
      (e) => {
        const d = e.target;
        if (d && d.matches && d.matches('details[data-g]')) {
          st.groups[d.dataset.g] = d.open;
          saveUI();
        }
      },
      true
    );
    const head = $('#pg-insp-head');
    head.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sel]');
      if (b) select(b.dataset.sel || null, { scroll: true });
    });
    head.addEventListener('input', (e) => {
      if (e.target.dataset.name == null || !st.sel) return;
      const v = e.target.value.trim().slice(0, 80);
      commit((proj) => {
        const x = PK.find(proj, st.sel);
        if (!x) return;
        if (v) x.node.name = v;
        else delete x.node.name;
      }, 'name@' + st.sel);
    });

    $('.pg-toolbar').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.device) return setDevice(b.dataset.device);
      const A = {
        new: newProject, open: openFile, save: saveJSON, 'export-html': exportHTML, undo, redo,
        'import-html': () => DE.pageImport && DE.pageImport.start(),
        duplicate, delete: remove, up: () => moveBy(-1), down: () => moveBy(1), parent: selectParent,
        outline: toggleOutline, preview: openPreview,
      };
      if (A[b.dataset.pg]) A[b.dataset.pg]();
    });
    $('#pg-name').addEventListener('change', (e) => {
      setValue('proj:name', e.target.value);
      updateTitles();
    });
    $('#pg-name').addEventListener('keydown', (e) => e.key === 'Enter' && e.target.blur());
    $('#pg-file-input').addEventListener('change', (e) => e.target.files[0] && PG.openFile(e.target.files[0]));
    $('#pg-pages').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.page) switchPage(b.dataset.page);
      else if (b.dataset.act === 'add-page') addPage();
    });
    $('#pg-pages').addEventListener('dblclick', (e) => {
      const b = e.target.closest('[data-page]');
      if (!b) return;
      select(null);
      if (st.itab !== 'props') setItab('props');
      const inp = $('#pg-props [data-k="page:name"]');
      if (inp) {
        inp.focus();
        inp.select();
      }
    });
    $$('.pg-left [data-ptab]').forEach((b) => b.addEventListener('click', () => setPtab(b.dataset.ptab)));
    $$('.pg-right [data-itab]').forEach((b) => b.addEventListener('click', () => setItab(b.dataset.itab)));
    window.addEventListener('keydown', onKey);
    // đang nhập địa chỉ liên kết / chọn màu trên thanh định dạng mà bấm ra chỗ khác: lưu chữ đang sửa
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (st.editing && st.editing.hold && fmtBar && !fmtBar.contains(e.target)) {
          st.editing.hold = false;
          finishEdit(true);
        }
      },
      true
    );
    new ResizeObserver(scheduleSync).observe(canvas);

    ready = true;
    setPtab(st.ptab, false);
    setDevice(st.device, false);
    $('.pg-toolbar [data-pg="outline"]').classList.toggle('active', st.outline);
    render();
    renderInspector();
    updateTitles();
  };
  /** Gọi khi chuyển sang tab Thiết kế trang */
  PG.onShow = function () {
    if (!ready) return;
    syncSize();
    render();
    renderInspector();
    updateTitles();
  };
  /** Rời tab: kết thúc sửa chữ đang dở */
  PG.onHide = function () {
    if (!ready) return;
    finishEdit(true);
    setHover(null);
  };
})(window.DE);
