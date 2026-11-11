/* =========================================================================
 * Tab Cài đặt: gom các cài đặt chung của app vào một chỗ (thay cho các nút
 * rải rác trên toolbar / khung chat)
 *  - Giao diện: sáng / tối / theo hệ thống
 *  - Trợ lý AI: nhà cung cấp, API key, mô hình (form của ui.js) + effort, thinking
 *  - Giọng nói: form của voice.js (đổi là lưu)
 *  - Ứng dụng & dữ liệu: cài như ứng dụng, chạy offline, dữ liệu trong trình duyệt, phím tắt
 * ========================================================================= */
(function (DE) {
  'use strict';
  const { esc } = DE;
  const $ = (q, el = document) => el.querySelector(q);
  const ST = (DE.settings = {});
  const SEC_KEY = 'diagram-editor:settings-sec';
  const lsGet = (k) => {
    try {
      return localStorage.getItem(k);
    } catch (_) {
      return null;
    }
  };
  const lsSet = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch (_) {
      /* ignore */
    }
  };
  const svg = (d) =>
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

  const SECTIONS = [
    { id: 'look', name: 'Giao diện', sub: 'Sáng / tối', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 3v18M12 7.5h7M12 12h9M12 16.5h7' },
    { id: 'ai', name: 'Trợ lý AI', sub: 'API key, mô hình, effort', icon: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4zM19 15l.8 1.9L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-1.1z' },
    { id: 'voice', name: 'Giọng nói', sub: 'Micro, lệnh, giọng đọc', icon: 'M9 3h6v11H9zM5 11a7 7 0 0014 0M12 18v3' },
    { id: 'app', name: 'Ứng dụng & dữ liệu', sub: 'Cài đặt, offline, bộ nhớ', icon: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3' },
  ];
  const WS_NAME = { doc: 'Tài liệu', diagram: 'Diagram', design: 'Thiết kế trang', guide: 'Hướng dẫn' };

  let sec = SECTIONS.some((s) => s.id === lsGet(SEC_KEY)) ? lsGet(SEC_KEY) : 'look';
  let prev = null; // tab đang mở trước khi vào Cài đặt
  let visible = false;
  let mounted = []; // form con cần dispose khi rời trang (dừng thử micro, bỏ tải danh sách mô hình…)

  const disposeAll = () => {
    mounted.forEach((m) => m && m.dispose && m.dispose());
    mounted = [];
  };

  // ================================================================ KHUNG
  function renderNav() {
    const nav = $('#set-nav');
    nav.innerHTML = SECTIONS.map(
      (s) =>
        `<button type="button" role="tab" data-sec="${s.id}" id="set-tab-${s.id}" aria-controls="set-body" aria-selected="${s.id === sec}" tabindex="${s.id === sec ? 0 : -1}" class="${s.id === sec ? 'active' : ''}">` +
        `${svg(s.icon)}<span><b>${esc(s.name)}</b><small>${esc(s.sub)}</small></span></button>`
    ).join('');
    const back = $('#set-back');
    back.hidden = !prev || !WS_NAME[prev];
    if (!back.hidden) back.textContent = `← Quay lại ${WS_NAME[prev]}`;
  }

  function render() {
    disposeAll();
    renderNav();
    const body = $('#set-body');
    body.setAttribute('aria-labelledby', 'set-tab-' + sec);
    body.innerHTML = '';
    // mỗi lần vẽ một khung mới: sự kiện gắn vào khung này, vẽ lại thì bỏ cả khung (không chồng sự kiện)
    const pane = document.createElement('div');
    pane.className = 'set-pane set-pane-' + sec;
    body.appendChild(pane);
    RENDER[sec](pane);
    $('.set-main').scrollTop = 0;
  }

  // ============================================================ GIAO DIỆN
  const pv = (cls) =>
    `<span class="set-pv ${cls}" aria-hidden="true"><i class="pv-top"></i><i class="pv-side"></i><i class="pv-main"><i class="pv-box"></i><i class="pv-box b2"></i><i class="pv-line"></i></i></span>`;
  const systemDark = () => !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  function renderLook(body) {
    const pref = DE.ui.themePref();
    const opt = (v, name, note, preview) =>
      `<label class="set-theme"><input type="radio" name="set-theme" value="${v}"${pref === v ? ' checked' : ''}>` +
      `${preview}<span class="set-theme-name">${name}</span><span class="set-theme-note"${v === 'system' ? ' id="set-sys-note"' : ''}>${note}</span></label>`;
    body.innerHTML =
      `<header class="set-head"><h2>Giao diện</h2><p>Chọn màu giao diện cho mọi tab. Lựa chọn được nhớ trong trình duyệt này.</p></header>` +
      `<section class="set-card"><h3>Chế độ màu</h3>` +
      `<p class="set-desc">Ở chế độ tối, whiteboard chỉ dịu bớt độ trắng (không đen) để màu các hình giữ đúng; file xuất ra (SVG, PNG, HTML) luôn nền trắng.</p>` +
      `<div class="set-themes" role="radiogroup" aria-label="Chế độ màu">` +
      opt('light', '☀ Sáng', 'Nền trắng, dễ đọc ban ngày', pv('light')) +
      opt('dark', '🌙 Tối', 'Dịu mắt khi làm việc ban đêm', pv('dark')) +
      opt('system', '🖥 Theo hệ thống', sysNote(), `<span class="set-pv-sys">${pv('light')}${pv('dark')}</span>`) +
      `</div></section>`;
    body.querySelector('.set-themes').addEventListener('change', (e) => {
      if (e.target.name !== 'set-theme') return;
      DE.ui.setThemePref(e.target.value);
    });
  }
  const sysNote = () => `Tự đổi theo máy – hiện đang ${systemDark() ? 'tối' : 'sáng'}`;
  function syncLook() {
    if (!visible || sec !== 'look') return;
    const pref = DE.ui.themePref();
    document.querySelectorAll('#set-body input[name="set-theme"]').forEach((r) => (r.checked = r.value === pref));
    const n = $('#set-sys-note');
    if (n) n.textContent = sysNote();
  }

  // ============================================================ TRỢ LÝ AI
  const EFFORT_OPTS = [
    ['', 'Mặc định của mô hình'],
    ['low', 'Thấp – nhanh, ít token'],
    ['medium', 'Trung bình'],
    ['high', 'Cao'],
    ['xhigh', 'Rất cao'],
    ['max', 'Tối đa – kỹ nhất, chậm nhất'],
  ];
  function renderAI(body) {
    body.innerHTML =
      `<header class="set-head"><h2>Trợ lý AI</h2><p>Khung chat AI có ở mọi tab: viết tài liệu, vẽ diagram, dựng trang web. ` +
      `Chọn nhà cung cấp (có loại miễn phí, hoặc chạy ngay trên máy với Ollama / LM Studio) và thêm API key.</p></header>` +
      `<div class="set-status" id="set-ai-status"></div>` +
      `<section class="set-card"><h3>Nhà cung cấp & API key</h3><div id="set-ai-form"></div></section>` +
      `<section class="set-card"><h3>Cách AI trả lời</h3><p class="set-desc">Áp dụng cho mọi câu hỏi, lưu ngay khi đổi.</p>` +
      `<div class="set-row"><label class="set-row-text" for="set-effort"><b>Effort</b><span>Mức độ suy luận / công sức của mô hình – cao hơn thì kỹ hơn nhưng chậm và tốn token hơn.</span></label>` +
      `<select id="set-effort" class="set-select">${EFFORT_OPTS.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join('')}</select></div>` +
      `<div class="set-row"><label class="set-row-text" for="set-think"><b>Thinking</b><span id="set-think-note"></span></label>` +
      `<span class="set-switch"><input type="checkbox" id="set-think" role="switch"><span></span></span></div>` +
      `</section>`;
    mounted.push(DE.ui.aiForm($('#set-ai-form')));
    $('#set-effort').addEventListener('change', (e) => {
      const c = DE.ai.load();
      c.effort = e.target.value;
      DE.ai.save(c);
      DE.ui.refreshAI();
    });
    $('#set-think').addEventListener('change', (e) => {
      const c = DE.ai.load();
      c.thinking = e.target.checked;
      DE.ai.save(c);
      DE.ui.refreshAI();
    });
    syncAI();
  }
  function syncAI() {
    if (!visible || sec !== 'ai') return;
    const st = $('#set-ai-status');
    if (!st) return;
    const a = DE.ai.active();
    st.className = 'set-status' + (a ? ' ok' : '');
    st.innerHTML = a
      ? `<span class="ai-dot ok"></span><span>Đang dùng <b>${esc(a.providerName)}</b> · ${esc(a.model)}${a.key ? ` · key <code>${esc(DE.ai.mask(a.key))}</code>` : ''}</span>`
      : `<span class="ai-dot"></span><span>Chưa cài đặt – chọn nhà cung cấp, dán API key rồi bấm <b>Lưu cài đặt AI</b>.</span>`;
    const c = DE.ai.load(), cur = c.models[c.provider];
    $('#set-effort').value = c.effort || '';
    const caps = DE.ai.thinkingCaps(c.provider, cur);
    const on = c.thinking || !caps.canDisable;
    const t = $('#set-think');
    t.checked = on;
    t.disabled = !caps.canDisable;
    $('#set-think-note').textContent = !caps.canDisable
      ? caps.note
      : on
        ? 'Đang bật: mô hình suy luận trước khi trả lời (kỹ hơn, chậm hơn).'
        : 'Đang tắt: trả lời nhanh, ít token hơn.';
  }

  // ============================================================ GIỌNG NÓI
  function renderVoice(body) {
    body.innerHTML =
      `<header class="set-head"><h2>Giọng nói</h2><p>Nói thay vì gõ: bấm 🎤 trong khung chat (hoặc <b>Ctrl+M</b>). ` +
      `Câu ngắn như “hoàn tác”, “vừa màn hình” chạy ngay như lệnh; câu dài được gửi cho AI. Đổi gì lưu nấy.</p></header>` +
      `<section class="set-card" id="set-voice-form"></section>`;
    const host = $('#set-voice-form');
    if (DE.voice && DE.voice.settingsForm) mounted.push(DE.voice.settingsForm(host));
    else host.innerHTML = '<p class="set-desc">Trình duyệt này không hỗ trợ nhập bằng giọng nói.</p>';
  }

  // =================================================== ỨNG DỤNG & DỮ LIỆU
  const STORE_LABEL = {
    'diagram-editor:md:v1': 'Tài liệu đang soạn (kể cả ảnh nhúng)',
    'diagram-editor:md-session:v1': 'Diagram đang vẽ cho tài liệu',
    'diagram-editor:doc:v1': 'Diagram trên whiteboard',
    'diagram-editor:page:v1': 'Dự án thiết kế trang',
    'diagram-editor:ai': 'Cài đặt AI (gồm API key)',
    'diagram-editor:voice': 'Cài đặt giọng nói',
  };
  const kb = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
  function storageRows() {
    const rows = {};
    let other = 0, total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('diagram-editor:')) continue;
        const n = (k.length + (localStorage.getItem(k) || '').length) * 2; // UTF-16
        total += n;
        if (STORE_LABEL[k]) rows[k] = n;
        else other += n;
      }
    } catch (_) {
      return null;
    }
    const list = Object.keys(STORE_LABEL).filter((k) => rows[k]).map((k) => [STORE_LABEL[k], rows[k]]);
    if (other) list.push(['Tuỳ chọn khác (tab đang mở, panel, chế độ xem…)', other]);
    return { list, total };
  }

  function renderApp(body) {
    const pwa = DE.pwa ? DE.pwa.state() : 'unavailable';
    const http = /^https?:$/.test(location.protocol);
    const installRow =
      pwa === 'installed'
        ? `<span class="set-badge ok">✓ Đang chạy như ứng dụng</span>`
        : pwa === 'ready'
          ? `<button type="button" class="btn primary" data-set="install">⬇ Cài đặt ứng dụng</button>`
          : `<span class="set-badge">Chưa cài được từ đây</span>`;
    const installNote =
      pwa === 'installed'
        ? 'Mở từ màn hình chính / menu ứng dụng như một phần mềm bình thường, chạy cả khi offline.'
        : pwa === 'ready'
          ? 'Mở từ màn hình chính / menu ứng dụng như một phần mềm, có cửa sổ riêng, chạy cả khi offline.'
          : http
            ? 'Trình duyệt chưa cho cài (đã cài rồi, hoặc trình duyệt không hỗ trợ). Trên Chrome / Edge: biểu tượng cài trên thanh địa chỉ, hoặc menu ⋮ → “Cài đặt ứng dụng”.'
            : 'Đang mở trực tiếp từ file trên máy – mở qua địa chỉ web (https://…) để cài như ứng dụng.';
    const off = DE.pwa && DE.pwa.offline();
    const st = storageRows();
    const QUOTA = 5 * 1048576; // localStorage của hầu hết trình duyệt: ~5 MB
    const keys = [
      ['Alt+1', 'Tài liệu'],
      ['Alt+2', 'Diagram'],
      ['Alt+3', 'Thiết kế trang'],
      ['Alt+4', 'Hướng dẫn'],
      ['Alt+5', 'Cài đặt'],
      ['Ctrl+M', 'Nói với AI · Ctrl+Shift+M: rảnh tay'],
      ['Ctrl+Enter', 'Gửi tin nhắn cho AI'],
    ];
    body.innerHTML =
      `<header class="set-head"><h2>Ứng dụng & dữ liệu</h2><p>Mọi thứ chạy ngay trong trình duyệt – không cần tài khoản, không gửi tài liệu lên máy chủ nào.</p></header>` +
      `<section class="set-card"><h3>Cài như ứng dụng</h3>` +
      `<div class="set-row"><div class="set-row-text"><span>${esc(installNote)}</span></div>${installRow}</div>` +
      `<div class="set-row"><div class="set-row-text"><b>Chạy offline</b><span>${
        off
          ? 'Đã lưu sẵn để mở được cả khi mất mạng. Thư viện vẽ (Mermaid, công thức…) tải ở lần dùng đầu rồi cũng chạy offline.'
          : http
            ? 'Đang chuẩn bị – tải lại trang một lần để lưu bản chạy offline.'
            : 'Chỉ có khi mở qua địa chỉ web (https://…).'
      }</span></div><span class="set-badge${off ? ' ok' : ''}">${off ? '✓ Sẵn sàng' : '○ Chưa'}</span></div>` +
      `</section>` +
      `<section class="set-card"><h3>Dữ liệu lưu trong trình duyệt</h3>` +
      `<p class="set-desc">Tài liệu, diagram, thiết kế trang và cài đặt tự lưu vào trình duyệt này – đóng tab mở lại vẫn còn. ` +
      `Dữ liệu không đồng bộ sang máy khác: hãy lưu ra file (.md, .json) để giữ lâu dài hoặc chuyển máy.</p>` +
      (st
        ? `<div class="set-meter" title="${kb(st.total)} / ~${kb(QUOTA)}"><span style="width:${Math.min(100, (st.total / QUOTA) * 100).toFixed(1)}%"></span></div>` +
          `<p class="set-meter-label">Đã dùng <b>${kb(st.total)}</b> trong khoảng ${kb(QUOTA)} trình duyệt cho phép</p>` +
          `<table class="set-store">${st.list.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${kb(v)}</td></tr>`).join('') || '<tr><td>Chưa có gì</td><td></td></tr>'}</table>`
        : `<p class="set-desc">Trình duyệt đang chặn bộ nhớ (chế độ riêng tư?) – dữ liệu sẽ mất khi đóng tab.</p>`) +
      `</section>` +
      `<section class="set-card"><h3>Phím tắt chung</h3><table class="set-store set-keys">` +
      keys.map(([k, n]) => `<tr><td>${esc(n)}</td><td><kbd>${esc(k)}</kbd></td></tr>`).join('') +
      `</table><p class="set-desc set-more">Phím tắt của từng tab: xem tab <a href="#" data-set="guide">Hướng dẫn</a> → Phím tắt.</p></section>`;
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-set]');
      if (!b) return;
      e.preventDefault();
      if (b.dataset.set === 'install' && DE.pwa) {
        b.disabled = true;
        await DE.pwa.install();
        if (visible && sec === 'app') render();
      } else if (b.dataset.set === 'guide') DE.docs.show('guide');
    });
  }

  const RENDER = { look: renderLook, ai: renderAI, voice: renderVoice, app: renderApp };

  // ================================================================ API
  /** Mở tab Cài đặt tại một nhóm: 'look' | 'ai' | 'voice' | 'app' */
  ST.open = function (id) {
    if (SECTIONS.some((s) => s.id === id)) {
      sec = id;
      lsSet(SEC_KEY, id);
    }
    if (DE.docs && DE.docs.current() !== 'settings') DE.docs.show('settings');
    else render();
  };
  ST.current = () => (visible ? sec : null);
  /** docs.js gọi khi chuyển sang / rời tab Cài đặt */
  let pwaHooked = false;
  ST.onShow = function (from) {
    visible = true;
    if (DE.pwa && !pwaHooked) {
      pwaHooked = true; // main.js tạo DE.pwa sau khi file này chạy
      DE.pwa.onChange(() => visible && sec === 'app' && render());
    }
    if (from && from !== 'settings') prev = from;
    render();
  };
  ST.onHide = function () {
    visible = false;
    disposeAll();
    $('#set-body').innerHTML = ''; // form được vẽ lại (theo cấu hình mới nhất) mỗi lần mở
  };

  function init() {
    const nav = $('#set-nav');
    nav.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sec]');
      if (b && b.dataset.sec !== sec) ST.open(b.dataset.sec);
    });
    nav.addEventListener('keydown', (e) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (!keys[e.key]) return;
      e.preventDefault();
      e.stopPropagation();
      const i = SECTIONS.findIndex((s) => s.id === sec);
      ST.open(SECTIONS[(i + keys[e.key] + SECTIONS.length) % SECTIONS.length].id);
      $('#set-tab-' + sec).focus();
    });
    $('#set-back').addEventListener('click', () => prev && DE.docs.show(prev));
    DE.ui.onTheme(syncLook);
    DE.ui.onAiChange(syncAI);
    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (mq && mq.addEventListener) mq.addEventListener('change', syncLook);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.DE);
