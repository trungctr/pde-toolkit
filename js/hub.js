/* =========================================================================
 * Tab "Dự án": làm việc nhóm qua máy chủ (backend/) – workspace, tài liệu theo quy trình duyệt, truy vết,
 * ticket, thành viên và quyền, thông báo, nhật ký.
 *  - Khung giống tab Cài đặt: cột trái là danh sách mục (.set-nav), bên phải là trang (.set-card…).
 *  - Trang tài liệu ở js/hub-docs.js, ticket ở js/hub-tickets.js – đăng ký vào HUB.pages.
 *  - Không có máy chủ / chưa đăng nhập: các tab khác vẫn chạy bình thường, tab này hiện màn hình kết nối.
 *  - Liên kết trong app: #/hub/doc/<id> · #/hub/ticket/<id> · #/hub/ws/<id> · #/hub/invitations · #/hub/public/<id>
 * ========================================================================= */
(function (DE) {
  'use strict';
  const { esc } = DE;
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];
  const API = DE.api;
  const HUB = (DE.hub = {});
  const NAV_KEY = 'diagram-editor:hub';
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
    } catch (_) {
      /* ignore */
    }
  };
  const toast = (m, t) => DE.ui.toast(m, t);

  // ================================================================== TRẠNG THÁI
  const S = {
    visible: false,
    ready: false, // đã thử khôi phục phiên
    meta: null,
    metaError: null,
    workspaces: [],
    ws: null, // WorkspaceDto đang chọn
    page: 'overview',
    sub: null, // id chi tiết (tài liệu / ticket)
    unread: 0,
    cache: {}, // theo workspace: groups, subsystems, members
    types: null, // 24 loại tài liệu
  };
  let seq = 0; // chống ghi đè bởi lần tải cũ
  HUB.S = S;
  HUB.pages = {};

  // ================================================================== TIỆN ÍCH
  const svg = (d, s = 18) =>
    `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const ICON = {
    home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
    docs: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7',
    trace: 'M5 6h4v4H5zM15 14h4v4h-4zM9 8h3a2 2 0 012 2v4a2 2 0 002 2h-1',
    ticket: 'M4 7a2 2 0 012-2h12a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3a2 2 0 000-4zM14 5v14',
    people: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M16 3.5a4 4 0 010 7.5M22 21v-1a6 6 0 00-4-5.6',
    key: 'M15 7a4 4 0 11-3.9 5H8v3H5v3H2v-4l6.1-6.1A4 4 0 0115 7zM16 7h.01',
    log: 'M4 5h16M4 10h16M4 15h10M4 20h7',
    gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.8 1.2V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.8-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.8H3a2 2 0 110-4h.1a1.7 1.7 0 001.2-2.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 002.8-1.2V3a2 2 0 114 0v.1a1.7 1.7 0 002.8 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.8H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
    bell: 'M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 004 0',
    mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21v-1a7 7 0 0114 0v1',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    plus: 'M12 5v14M5 12h14',
    back: 'M15 6l-6 6 6 6',
    server: 'M4 5h16v6H4zM4 13h16v6H4zM8 8h.01M8 16h.01',
  };
  const fmtDate = (s) => {
    if (!s) return '';
    const d = new Date(s);
    return isNaN(d) ? '' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const fmtTime = (s) => {
    if (!s) return '';
    const d = new Date(s);
    return isNaN(d) ? '' : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const fmtRel = (s) => {
    const d = new Date(s);
    if (isNaN(d)) return '';
    const m = Math.round((Date.now() - d) / 60000);
    if (m < 1) return 'vừa xong';
    if (m < 60) return `${m} phút trước`;
    if (m < 1440) return `${Math.round(m / 60)} giờ trước`;
    if (m < 1440 * 7) return `${Math.round(m / 1440)} ngày trước`;
    return fmtDate(s);
  };
  const initials = (u) => {
    const n = ((u && (u.first_name || u.display_name)) || '?').trim();
    return esc(n.split(/\s+/).pop().slice(0, 1).toUpperCase() + ((u && u.last_name) || '').trim().slice(0, 1).toUpperCase());
  };
  const ava = (u, cls = '') => `<span class="hub-ava ${cls}" title="${esc((u && u.display_name) || '')}" aria-hidden="true">${initials(u)}</span>`;
  const who = (u) => (u ? `${ava(u)}<span class="hub-who-name">${esc(u.display_name)}</span>` : '<span class="hub-muted">–</span>');
  const pill = (cls, text) => `<span class="hub-pill ${cls}">${esc(text)}</span>`;
  const STATUS_VI = { draft: 'Dự thảo', pending: 'Chờ duyệt', approved: 'Đã duyệt', published: 'Đã phát hành', superseded: 'Thay thế' };
  const statusPill = (s) => (s ? pill('st-' + s, STATUS_VI[s] || s) : '');
  const SEC_VI = { private: 'Riêng tư', group: 'Group', workspace: 'Workspace', public: 'Công khai' };
  const secPill = (s) => pill('sec-' + s, SEC_VI[s] || s);
  const DOC_PERMS = [
    ['view', 'Xem'],
    ['comment', 'Nhận xét'],
    ['create', 'Tạo'],
    ['edit', 'Sửa'],
    ['submit', 'Gửi duyệt'],
    ['approve', 'Xem xét duyệt'],
    ['publish', 'Phát hành'],
  ];
  const USER_PERMS = [
    ['invite', 'Mời người dùng'],
    ['kick', 'Loại người dùng'],
    ['manage_perms', 'Điều chỉnh quyền'],
    ['assign_owner', 'Chỉ định owner'],
    ['remove_owner', 'Bỏ owner'],
  ];
  const permText = (p, list) => list.filter(([k]) => p && p[k]).map(([, v]) => v).join(', ') || 'không có quyền';
  const fail = (e) => toast((e && e.message) || String(e), 'error');
  const empty = (text, action = '') => `<div class="hub-empty"><p>${text}</p>${action}</div>`;
  const loading = () => `<div class="hub-loading"><span class="ai-spinner" aria-hidden="true"></span> Đang tải…</div>`;
  const me = () => API.user();
  const myGroupAccess = (gid) => S.ws && S.ws.me && S.ws.me.groups.find((g) => g.group_id === gid);
  /** Có quyền tài liệu `perm` ở ít nhất một group */
  const canDocAnywhere = (perm) => !!(S.ws && S.ws.me && S.ws.me.groups.some((g) => g.doc_perms[perm]));

  HUB.h = { svg, ICON, fmtDate, fmtTime, fmtRel, ava, who, pill, statusPill, secPill, STATUS_VI, SEC_VI, DOC_PERMS, USER_PERMS, permText, fail, empty, loading, me, myGroupAccess, canDocAnywhere, esc, $, $$ };

  // ================================================================== HỘP THOẠI
  /**
   * Hộp thoại có form. `body` là HTML (đã escape). `onOk(form)` chạy khi bấm nút chính: ném lỗi ⇒ hiện trong hộp thoại,
   * trả `false` ⇒ giữ hộp thoại mở. Trả về Promise: giá trị của onOk (hoặc true) / null khi huỷ.
   */
  function dialog({ title, body = '', ok = 'Lưu', cancel = 'Huỷ', danger = false, wide = false, onOk = null, onOpen = null }) {
    return new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'modal-backdrop';
      back.innerHTML =
        `<form class="modal hub-modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="hub-dlg-title" novalidate>` +
        `<h3 id="hub-dlg-title">${esc(title)}</h3><div class="hub-dlg-body">${body}</div>` +
        `<p class="msg err hub-dlg-err" role="alert" hidden></p>` +
        `<div class="modal-actions">${cancel ? `<button type="button" class="btn" data-r="cancel">${esc(cancel)}</button>` : ''}` +
        `${ok ? `<button type="submit" class="btn ${danger ? 'danger' : 'primary'}" data-r="ok">${esc(ok)}</button>` : ''}</div></form>`;
      const form = $('form', back);
      const err = $('.hub-dlg-err', back);
      const prev = document.activeElement;
      const close = (v) => {
        window.removeEventListener('keydown', onKey, true);
        back.remove();
        try {
          if (prev && prev.focus && prev !== document.body) prev.focus();
        } catch (_) {
          /* ignore */
        }
        resolve(v);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          close(null);
        }
      };
      back.addEventListener('click', (e) => {
        if (e.target.closest('[data-r="cancel"]')) close(null);
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!onOk) return close(true);
        const btn = $('[data-r="ok"]', form);
        if (btn) btn.disabled = true;
        err.hidden = true;
        try {
          const r = await onOk(form);
          if (r !== false) close(r === undefined ? true : r);
        } catch (ex) {
          err.textContent = (ex && ex.message) || String(ex);
          err.hidden = false;
        } finally {
          if (btn) btn.disabled = false;
        }
      });
      window.addEventListener('keydown', onKey, true);
      document.body.appendChild(back);
      if (onOpen) onOpen(form, close);
      const f = $('[autofocus]', form) || $('input:not([type=checkbox]):not([type=radio]), select, textarea', form) || $('[data-r="ok"]', form);
      if (f) f.focus();
    });
  }
  const confirmDlg = (title, message, ok = 'Đồng ý', danger = false) => DE.ui.confirm({ title, message, ok, danger });
  /** Đọc giá trị form theo name (checkbox → boolean, có data-group → gom thành object) */
  function formData(form) {
    const out = {};
    $$('[name]', form).forEach((el) => {
      const group = el.dataset.group;
      const v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'radio' && !el.checked) return;
      if (group) (out[group] = out[group] || {})[el.name] = v;
      else out[el.name] = typeof v === 'string' ? v.trim() : v;
    });
    return out;
  }
  const permBoxes = (group, list, value = {}, limit = null) =>
    `<div class="hub-perms">${list
      .map(([k, label]) => {
        const off = limit && !limit[k];
        return `<label class="chk${off ? ' off' : ''}"><input type="checkbox" name="${k}" data-group="${group}"${value[k] ? ' checked' : ''}${off ? ' disabled' : ''}> ${esc(label)}</label>`;
      })
      .join('')}</div>`;
  HUB.dialog = dialog;
  HUB.confirm = confirmDlg;
  HUB.formData = formData;
  HUB.permBoxes = permBoxes;

  // ================================================================== DỮ LIỆU CHUNG
  async function cached(key, loader) {
    const ws = S.ws && S.ws.id;
    const c = (S.cache[ws] = S.cache[ws] || {});
    if (!c[key]) c[key] = loader().catch((e) => ((c[key] = null), Promise.reject(e)));
    return c[key];
  }
  HUB.groups = () => cached('groups', () => API.get(`/workspaces/${S.ws.id}/groups`));
  HUB.subsystems = () => cached('subsystems', () => API.get(`/workspaces/${S.ws.id}/subsystems`));
  HUB.members = () => cached('members', () => API.get(`/workspaces/${S.ws.id}/members`));
  HUB.types = async () => (S.types = S.types || (await API.get('/document-types')));
  HUB.invalidate = (...keys) => {
    const c = S.cache[S.ws && S.ws.id];
    if (c) keys.forEach((k) => delete c[k]);
  };

  async function loadWorkspaces() {
    S.workspaces = await API.get('/workspaces');
    const saved = (() => {
      try {
        return JSON.parse(lsGet(NAV_KEY) || '{}');
      } catch (_) {
        return {};
      }
    })();
    const keep = S.ws && S.workspaces.find((w) => w.id === S.ws.id);
    S.ws = keep || S.workspaces.find((w) => w.id === saved.ws) || S.workspaces[0] || null;
  }
  /** Chọn workspace (nạp lại quyền của mình) */
  async function selectWs(id, page = 'overview') {
    const w = await API.get(`/workspaces/${id}`);
    const i = S.workspaces.findIndex((x) => x.id === id);
    if (i >= 0) S.workspaces[i] = w;
    else S.workspaces.push(w);
    S.ws = w;
    delete S.cache[id];
    go(page);
  }
  HUB.selectWs = selectWs;
  HUB.reloadWs = async () => {
    if (!S.ws) return;
    S.ws = await API.get(`/workspaces/${S.ws.id}`);
    const i = S.workspaces.findIndex((x) => x.id === S.ws.id);
    if (i >= 0) S.workspaces[i] = S.ws;
  };

  // ================================================================== ĐIỀU HƯỚNG
  const NAV = [
    { id: 'overview', name: 'Tổng quan', sub: 'Việc của tôi', icon: 'home' },
    { id: 'docs', name: 'Tài liệu', sub: 'Sổ đăng ký, vòng đời', icon: 'docs' },
    { id: 'trace', name: 'Truy vết', sub: 'Mã, cần rà soát', icon: 'trace' },
    { id: 'tickets', name: 'Ticket', sub: 'Góp ý, báo lỗi', icon: 'ticket' },
    { id: 'members', name: 'Thành viên', sub: 'Group, hệ thống con', icon: 'people' },
    { id: 'ticket-access', name: 'Quyền ticket', sub: 'Xem, xử lý, AI', icon: 'key' },
    { id: 'audit', name: 'Nhật ký', sub: 'Chỉ workspace owner', icon: 'log', ownerOnly: true },
    { id: 'ws-settings', name: 'Cài đặt workspace', sub: 'Tên, công khai, owner', icon: 'gear' },
  ];
  const PERSONAL = [
    { id: 'notifications', name: 'Thông báo', icon: 'bell' },
    { id: 'invitations', name: 'Lời mời', icon: 'mail' },
    { id: 'my-tickets', name: 'Ticket tôi gửi', icon: 'ticket' },
    { id: 'account', name: 'Tài khoản', icon: 'user' },
  ];
  const PARENT = { doc: 'docs', ticket: 'tickets' };

  function go(page, sub = null) {
    S.page = page;
    S.sub = sub;
    if (S.ws) lsSet(NAV_KEY, JSON.stringify({ ws: S.ws.id, page: PARENT[page] || page }));
    render();
  }
  HUB.go = go;
  HUB.title = () => {
    const n = [...NAV, ...PERSONAL].find((x) => x.id === (PARENT[S.page] || S.page));
    return (n ? n.name : 'Dự án') + (S.ws ? ' · ' + S.ws.code : '');
  };

  /** Liên kết dạng #/hub/... (thông báo, chia sẻ) */
  async function route(hash) {
    const m = hash.match(/^#\/hub\/(doc|ticket|ws|invitations|notifications|public)(?:\/([\w-]+))?/);
    if (!m) return false;
    history.replaceState(null, '', location.pathname + location.search);
    if (DE.docs.current() !== 'hub') DE.docs.show('hub');
    const [, kind, id] = m;
    if (kind === 'public') return HUB.showPublic && HUB.showPublic(id);
    if (!API.user()) {
      S.pendingRoute = hash;
      return render();
    }
    try {
      if (kind === 'ws' && id) return selectWs(id);
      if (kind === 'invitations' || kind === 'notifications') return go(kind);
      if (kind === 'doc') {
        const d = await API.get(`/documents/${id}`);
        if (!S.ws || S.ws.id !== d.document.workspace_id) await selectWs(d.document.workspace_id, 'docs');
        return go('doc', id);
      }
      if (kind === 'ticket') {
        const t = await API.get(`/tickets/${id}`);
        const member = S.workspaces.some((w) => w.id === t.ticket.workspace_id);
        if (member && (!S.ws || S.ws.id !== t.ticket.workspace_id)) await selectWs(t.ticket.workspace_id, 'tickets');
        return go('ticket', id);
      }
    } catch (e) {
      fail(e);
    }
    return true;
  }
  HUB.route = route;

  // ================================================================== KHUNG
  function renderNav() {
    const side = $('#hub-side');
    const u = me();
    if (!u) {
      side.innerHTML = `<div class="set-side-head">Dự án</div><p class="hub-side-note">Đăng nhập máy chủ của nhóm để cùng soạn, duyệt, phát hành tài liệu và xử lý ticket.</p>`;
      return;
    }
    const wsOpts = S.workspaces.map((w) => `<option value="${esc(w.id)}"${S.ws && w.id === S.ws.id ? ' selected' : ''}>${esc(w.code)} – ${esc(w.name)}</option>`).join('');
    const cur = PARENT[S.page] || S.page;
    const navBtn = (n) =>
      `<button type="button" role="tab" data-hub-nav="${n.id}" aria-selected="${cur === n.id}" class="${cur === n.id ? 'active' : ''}">${svg(ICON[n.icon])}` +
      `<span><b>${esc(n.name)}</b>${n.sub ? `<small>${esc(n.sub)}</small>` : ''}</span>` +
      (n.id === 'notifications' ? `<em class="hub-count"${S.unread ? '' : ' hidden'}>${S.unread > 99 ? '99+' : S.unread}</em>` : '') +
      `</button>`;
    const isOwner = S.ws && S.ws.me && S.ws.me.is_workspace_owner;
    side.innerHTML =
      `<div class="hub-ws">` +
      (S.workspaces.length
        ? `<select id="hub-ws-select" class="hub-ws-select" aria-label="Workspace đang làm việc">${wsOpts}</select>`
        : `<span class="hub-muted">Chưa có workspace</span>`) +
      `<button type="button" class="btn hub-ws-new" data-hub="new-ws" title="Tạo workspace mới">${svg(ICON.plus, 16)}</button></div>` +
      (S.ws
        ? `<nav class="guide-nav set-nav hub-nav" role="tablist" aria-label="Mục của workspace" aria-orientation="vertical">${NAV.filter((n) => !n.ownerOnly || isOwner)
            .map(navBtn)
            .join('')}</nav>`
        : '') +
      `<div class="hub-side-sep"></div><nav class="set-nav hub-nav hub-nav-me" aria-label="Cá nhân">${PERSONAL.map(navBtn).join('')}` +
      (u.system_role === 'admin' ? navBtn({ id: 'admin', name: 'Quản trị hệ thống', icon: 'shield' }) : '') +
      `</nav><div class="hub-me">${ava(u, 'lg')}<span><b>${esc(u.display_name)}</b><small>${esc(u.email)}</small></span></div>`;
  }

  /** Cập nhật số thông báo chưa đọc tại chỗ (trên tab và trong cột trái) – không vẽ lại cột trái */
  function updateBadge() {
    const n = S.unread > 99 ? '99+' : String(S.unread);
    [$('#ws-hub-badge'), $('#hub-side [data-hub-nav="notifications"] .hub-count')].forEach((b) => {
      if (!b) return;
      b.hidden = !S.unread;
      b.textContent = n;
    });
  }

  async function render() {
    if (!S.visible) return;
    const body = $('#hub-body');
    const tok = ++seq;
    renderNav();
    if (!API.base()) return renderConnect(body);
    if (!S.ready) {
      body.innerHTML = loading();
      return;
    }
    if (!me()) return renderAuth(body);
    if (S.pendingRoute) {
      const r = S.pendingRoute;
      S.pendingRoute = null;
      return route(r);
    }
    const page = S.ws || ['notifications', 'invitations', 'my-tickets', 'ticket', 'account', 'admin', 'new-ws'].includes(S.page) ? S.page : 'welcome';
    const fn = HUB.pages[page] || PAGES[page] || PAGES.overview;
    body.innerHTML = '';
    const pane = document.createElement('div');
    pane.className = 'hub-pane hub-pane-' + page;
    pane.innerHTML = loading();
    body.appendChild(pane);
    $('#hub-main').scrollTop = 0;
    try {
      await fn(pane, { isCurrent: () => tok === seq, sub: S.sub });
    } catch (e) {
      if (tok !== seq) return;
      if (e.status === 404 && S.sub) {
        pane.innerHTML = empty(esc(e.message), `<button type="button" class="btn" data-hub-nav="${PARENT[page] || 'overview'}">← Quay lại</button>`);
      } else pane.innerHTML = empty(`Không tải được: ${esc(e.message)}`, `<button type="button" class="btn" data-hub="retry">Thử lại</button>`);
    }
    if (DE.docs && DE.docs.current() === 'hub') document.title = HUB.title() + ' – ChillCat Studio';
  }
  HUB.render = render;

  /** Đầu trang: tiêu đề + mô tả + nút bên phải */
  HUB.head = (title, desc = '', actions = '', back = '') =>
    `<header class="hub-head">${back}<div class="set-head"><h2>${title}</h2>${desc ? `<p>${desc}</p>` : ''}</div>${actions ? `<div class="hub-actions">${actions}</div>` : ''}</header>`;
  HUB.backLink = (page, text) => `<button type="button" class="hub-back" data-hub-nav="${page}">${svg(ICON.back, 14)} ${esc(text)}</button>`;

  // ------------------------------------------------------------ kết nối / đăng nhập
  function renderConnect(body, note = '') {
    body.innerHTML =
      `<div class="hub-narrow">${HUB.head('Kết nối máy chủ', 'Tab Dự án làm việc qua máy chủ ChillCat Studio của nhóm (thư mục <code>backend/</code>). Các tab khác vẫn chạy ngay trong trình duyệt, không cần máy chủ.')}` +
      `<section class="set-card"><h3>Địa chỉ máy chủ</h3><p class="set-desc">${
        /^https?:$/.test(location.protocol)
          ? 'Để trống nếu máy chủ cũng là nơi mở trang này.'
          : 'Đang mở trực tiếp từ file trên máy – nhập địa chỉ máy chủ, ví dụ <code>http://localhost:8080</code>.'
      }</p>` +
      `<form class="hub-inline" data-hub-form="connect"><input class="hub-input" name="url" type="url" placeholder="https://tai-lieu.cong-ty.vn" value="${esc(API.savedBase())}" aria-label="Địa chỉ máy chủ">` +
      `<button type="submit" class="btn primary">Kết nối</button></form>${note ? `<p class="msg err">${esc(note)}</p>` : ''}</section></div>`;
  }

  async function checkServer() {
    try {
      S.meta = await API.meta();
      S.metaError = null;
    } catch (e) {
      S.meta = null;
      S.metaError = e.message;
    }
    return S.meta;
  }

  function renderAuth(body, mode = 'login') {
    if (!S.meta && S.metaError) return renderConnect(body, S.metaError);
    const reg = !S.meta || S.meta.registration;
    const field = (name, label, type = 'text', extra = '') =>
      `<label class="f"><span>${label}</span><input name="${name}" type="${type}" ${extra}></label>`;
    body.innerHTML =
      `<div class="hub-narrow">${HUB.head(mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản', `Máy chủ: <code>${esc(API.base())}</code> · <a href="#" data-hub="server">đổi máy chủ</a>`)}` +
      `<section class="set-card"><form class="hub-auth" data-hub-form="${mode}">` +
      (mode === 'register'
        ? `<div class="hub-grid2">${field('last_name', 'Họ và tên đệm', 'text', 'required autocomplete="family-name"')}${field('first_name', 'Tên', 'text', 'required autocomplete="given-name"')}</div>` +
          field('employee_code', 'Mã nhân viên (không bắt buộc)', 'text', 'autocomplete="off"')
        : '') +
      field('email', 'E-mail', 'email', 'required autocomplete="email" autofocus') +
      field('password', 'Mật khẩu', 'password', `required minlength="8" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"`) +
      `<p class="msg err" hidden></p><div class="set-actions">` +
      (mode === 'login'
        ? `${reg ? `<button type="button" class="btn" data-hub="to-register">Tạo tài khoản</button>` : ''}<button type="submit" class="btn primary">Đăng nhập</button>`
        : `<button type="button" class="btn" data-hub="to-login">Đã có tài khoản</button><button type="submit" class="btn primary">Tạo tài khoản</button>`) +
      `</div></form></section>` +
      (mode === 'register' && S.meta ? '' : '') +
      `</div>`;
    const f = $('[autofocus]', body);
    if (f) f.focus();
  }

  // ================================================================== CÁC TRANG CHUNG
  const PAGES = {};

  PAGES.welcome = async (el) => {
    const inv = await API.get('/me/invitations');
    el.innerHTML =
      HUB.head('Chào mừng', 'Bạn chưa tham gia workspace nào. Tạo workspace cho dự án của nhóm, hoặc nhận lời mời của người khác.') +
      (inv.length ? `<section class="set-card"><h3>Lời mời đang chờ</h3>${invitationList(inv)}</section>` : '') +
      `<section class="set-card"><h3>Bắt đầu</h3><div class="set-row"><div class="set-row-text"><b>Tạo workspace</b><span>Mỗi workspace ứng với một dự án, có mã dự án (ví dụ SHOP) dùng trong mã mọi tài liệu.</span></div>` +
      `<button type="button" class="btn primary" data-hub="new-ws">${svg(ICON.plus, 14)} Tạo workspace</button></div>` +
      `<div class="set-row"><div class="set-row-text"><b>Gửi góp ý / báo lỗi cho một dự án</b><span>Không cần là thành viên – bạn theo dõi được ticket mình gửi.</span></div>` +
      `<button type="button" class="btn" data-hub="new-ticket-any">Gửi ticket</button></div></section>`;
  };

  PAGES['new-ws'] = async (el) => {
    el.innerHTML = '';
    await newWorkspace();
    if (S.page === 'new-ws') go(S.ws ? 'overview' : 'welcome');
  };

  async function newWorkspace() {
    const ws = await dialog({
      title: 'Tạo workspace',
      body:
        `<p class="modal-msg">Bạn trở thành workspace owner. Một group mặc định được tạo, bạn làm group owner – mỗi tài liệu thuộc đúng một group.</p>` +
        `<div class="hub-grid2"><label class="f"><span>Mã dự án</span><input name="code" required maxlength="10" placeholder="SHOP" class="hub-upper" autofocus></label>` +
        `<label class="f"><span>Tên group mặc định</span><input name="default_group_name" value="Chung" maxlength="80"></label></div>` +
        `<label class="f"><span>Tên dự án</span><input name="name" required maxlength="120" placeholder="Cửa hàng trực tuyến"></label>` +
        `<label class="f"><span>Mô tả (không bắt buộc)</span><textarea name="description" rows="2" maxlength="2000"></textarea></label>` +
        `<p class="hint">Mã dự án là tiền tố của mọi mã tài liệu (SHOP-SRS-ORD-001), không đổi được sau khi tạo.</p>`,
      ok: 'Tạo workspace',
      onOk: (f) => API.post('/workspaces', formData(f)),
    });
    if (!ws) return;
    S.workspaces.push(ws);
    S.ws = ws;
    toast(`Đã tạo workspace ${ws.code}`, 'ok');
    go('overview');
  }
  HUB.newWorkspace = newWorkspace;

  PAGES.overview = async (el, { isCurrent }) => {
    const ws = S.ws;
    const u = me();
    const [docs, tickets, flags, inv] = await Promise.all([
      API.get(`/workspaces/${ws.id}/documents`),
      API.get(`/workspaces/${ws.id}/tickets`).catch(() => []),
      API.get(`/workspaces/${ws.id}/trace/flags`).catch(() => []),
      API.get('/me/invitations').catch(() => []),
    ]);
    if (!isCurrent()) return;
    const mine = docs.filter((d) => d.working_editor_id === u.id && d.working_status === 'draft');
    const owned = new Set(ws.me.groups.filter((g) => g.is_owner).map((g) => g.group_id));
    const toApprove = docs.filter((d) => d.working_status === 'pending' && owned.has(d.group_id));
    const toPublish = docs.filter((d) => d.working_status === 'approved' && (myGroupAccess(d.group_id) || {}).doc_perms?.publish);
    const myTickets = tickets.filter((t) => t.assignee_id === u.id && !['resolved', 'rejected', 'duplicate'].includes(t.status));
    const myFlags = flags.filter((f) => docs.some((d) => d.id === f.document_id && (d.owner_id === u.id || d.working_editor_id === u.id)));
    const counts = {
      published: docs.filter((d) => d.published_version).length,
      draft: docs.filter((d) => d.working_status === 'draft').length,
      pending: docs.filter((d) => d.working_status === 'pending' || d.working_status === 'approved').length,
      tickets: tickets.filter((t) => !['resolved', 'rejected', 'duplicate'].includes(t.status)).length,
    };
    const docRow = (d, note) =>
      `<li><button type="button" class="hub-link" data-hub-doc="${esc(d.id)}"><code>${esc(d.code)}</code> ${esc(d.title)}</button><span class="hub-muted">${note}</span></li>`;
    const list = (title, items, renderItem, emptyText) =>
      `<section class="set-card"><h3>${title} <span class="hub-count-soft">${items.length}</span></h3>${
        items.length ? `<ul class="hub-list">${items.slice(0, 8).map(renderItem).join('')}</ul>` : `<p class="set-desc">${emptyText}</p>`
      }</section>`;
    const role = ws.me.is_workspace_owner ? 'Workspace owner' : ws.me.groups.some((g) => g.is_owner) ? 'Group owner' : 'Thành viên';
    el.innerHTML =
      HUB.head(
        `${esc(ws.name)} <span class="hub-code">${esc(ws.code)}</span>`,
        `${esc(role)} · owner: ${esc((ws.owner && ws.owner.display_name) || '')}${ws.description ? ' · ' + esc(ws.description) : ''}`,
        (canDocAnywhere('create') ? `<button type="button" class="btn primary" data-hub="new-doc">${svg(ICON.plus, 14)} Tài liệu</button>` : '') +
          `<button type="button" class="btn" data-hub="new-ticket">${svg(ICON.plus, 14)} Ticket</button>`
      ) +
      `<div class="hub-stats">` +
      [
        ['Đã phát hành', counts.published, 'docs'],
        ['Đang dự thảo', counts.draft, 'docs'],
        ['Đang duyệt', counts.pending, 'docs'],
        ['Ticket đang mở', counts.tickets, 'tickets'],
      ]
        .map(([l, n, p]) => `<button type="button" class="hub-stat" data-hub-nav="${p}"><b>${n}</b><span>${l}</span></button>`)
        .join('') +
      `</div>` +
      (inv.length ? `<section class="set-card"><h3>Lời mời đang chờ</h3>${invitationList(inv)}</section>` : '') +
      `<div class="hub-cols2">` +
      list('Tôi đang soạn', mine, (d) => docRow(d, `bản ${esc(d.working_version)}`), 'Không có bản dự thảo nào giao cho bạn.') +
      list('Chờ tôi duyệt', toApprove, (d) => docRow(d, `bản ${esc(d.working_version)}`), 'Không có bản nào chờ bạn duyệt.') +
      list('Chờ phát hành', toPublish, (d) => docRow(d, `bản ${esc(d.working_version)}`), 'Không có bản đã duyệt nào chờ bạn phát hành.') +
      list('Cần rà soát', myFlags, (f) => `<li><button type="button" class="hub-link" data-hub-doc="${esc(f.document_id)}"><code>${esc(f.document_code)}</code></button><span class="hub-muted">${esc(f.element_code)} ${f.change === 'retired' ? 'đã bỏ' : 'đã đổi'} ở ${esc(f.caused_by_document_code)} ${esc(f.caused_by_version)}</span></li>`, 'Không có tài liệu nào của bạn cần rà soát.') +
      list('Ticket giao cho tôi', myTickets, (t) => `<li><button type="button" class="hub-link" data-hub-ticket="${esc(t.id)}">#${t.number} ${esc(t.title)}</button><span class="hub-muted">${esc(t.status_label)}</span></li>`, 'Không có ticket nào giao cho bạn.') +
      `</div>`;
  };

  function invitationList(list) {
    return `<ul class="hub-list">${list
      .map(
        (i) =>
          `<li><span><b>${esc(i.workspace_code || '')}</b> ${esc(i.workspace_name || '')} · ${i.scope_type === 'group' ? 'group ' + esc(i.scope_name || '') : 'cả workspace'}` +
          `<small class="hub-muted"> – ${esc((i.inviter && i.inviter.display_name) || '')} mời, quyền: ${esc(permText(i.doc_perms, DOC_PERMS))}</small></span>` +
          `<span class="hub-row-actions"><button type="button" class="btn" data-hub-inv-decline="${esc(i.id)}">Từ chối</button><button type="button" class="btn primary" data-hub-inv-accept="${esc(i.id)}">Nhận lời</button></span></li>`
      )
      .join('')}</ul>`;
  }

  PAGES.invitations = async (el) => {
    const inv = await API.get('/me/invitations');
    el.innerHTML = HUB.head('Lời mời', 'Lời mời vào workspace / group gửi tới e-mail của bạn.') + `<section class="set-card">${inv.length ? invitationList(inv) : empty('Không có lời mời nào đang chờ.')}</section>`;
  };

  PAGES.notifications = async (el) => {
    const page = await API.get('/me/notifications?limit=100');
    const items = page.items;
    el.innerHTML =
      HUB.head('Thông báo', 'Tài liệu chờ duyệt, bị trả lại, cần rà soát, ticket… Thông báo tự xoá sau 180 ngày.', items.some((n) => !n.read) ? `<button type="button" class="btn" data-hub="read-all">Đánh dấu đã đọc hết</button>` : '') +
      `<section class="set-card hub-flush">${
        items.length
          ? `<ul class="hub-notes">${items
              .map(
                (n) =>
                  `<li class="${n.read ? '' : 'unread'}"><button type="button" data-hub-note="${esc(n.id)}" data-link="${esc(n.link || '')}">` +
                  `<span class="hub-note-dot" aria-hidden="true"></span><span class="hub-note-text">${esc(n.title)}</span><time datetime="${esc(n.created_at)}">${fmtRel(n.created_at)}</time></button></li>`
              )
              .join('')}</ul>`
          : empty('Chưa có thông báo nào.')
      }</section>`;
  };

  PAGES.account = async (el) => {
    const u = await API.get('/me');
    API.setUser(u);
    el.innerHTML =
      HUB.head('Tài khoản', `Đăng nhập tại <code>${esc(API.base())}</code>`, `<button type="button" class="btn" data-hub="logout">Đăng xuất</button>`) +
      `<section class="set-card"><h3>Thông tin</h3><form data-hub-form="profile"><div class="hub-grid2">` +
      `<label class="f"><span>Họ và tên đệm</span><input name="last_name" value="${esc(u.last_name)}" required></label>` +
      `<label class="f"><span>Tên</span><input name="first_name" value="${esc(u.first_name)}" required></label></div>` +
      `<div class="hub-grid2"><label class="f"><span>E-mail</span><input value="${esc(u.email)}" disabled></label>` +
      `<label class="f"><span>Mã nhân viên</span><input name="employee_code" value="${esc(u.employee_code || '')}"></label></div>` +
      `<label class="f"><span>Ảnh đại diện (địa chỉ https://)</span><input name="avatar_url" value="${esc(u.avatar_url || '')}" type="url"></label>` +
      `<div class="set-actions"><button type="submit" class="btn primary">Lưu thông tin</button></div></form></section>` +
      `<section class="set-card"><h3>Đổi mật khẩu</h3><p class="set-desc">Các phiên đăng nhập khác sẽ bị đăng xuất.</p><form data-hub-form="password"><div class="hub-grid2">` +
      `<label class="f"><span>Mật khẩu hiện tại</span><input name="current_password" type="password" required autocomplete="current-password"></label>` +
      `<label class="f"><span>Mật khẩu mới (từ 8 ký tự)</span><input name="new_password" type="password" required minlength="8" autocomplete="new-password"></label></div>` +
      `<div class="set-actions"><button type="submit" class="btn primary">Đổi mật khẩu</button></div></form></section>`;
  };

  PAGES.admin = async (el, { isCurrent }) => {
    const q = (S.adminQ || '').trim();
    const page = await API.get('/admin/users?limit=200' + (q ? '&q=' + encodeURIComponent(q) : ''));
    if (!isCurrent()) return;
    el.innerHTML =
      HUB.head('Quản trị hệ thống', 'Tài khoản người dùng: vai trò hệ thống, khoá / mở. Quản trị viên không mặc nhiên xem được tài liệu của workspace.') +
      `<div class="hub-filters"><input class="hub-input" type="search" data-hub-filter="admin" placeholder="Tìm e-mail, tên, mã nhân viên…" value="${esc(q)}"></div>` +
      `<section class="set-card hub-flush"><table class="hub-table"><thead><tr><th>Người dùng</th><th>Mã NV</th><th>Vai trò</th><th>Trạng thái</th><th>Tạo lúc</th><th></th></tr></thead><tbody>` +
      page.items
        .map(
          (u) =>
            `<tr><td>${who(u)}<div class="hub-sub">${esc(u.email)}</div></td><td>${esc(u.employee_code || '')}</td>` +
            `<td><select class="hub-select sm" data-hub-admin-role="${esc(u.id)}"${u.id === me().id ? ' disabled' : ''}><option value="user"${u.system_role === 'user' ? ' selected' : ''}>Người dùng</option><option value="admin"${u.system_role === 'admin' ? ' selected' : ''}>Quản trị</option></select></td>` +
            `<td>${u.disabled ? pill('err', 'Đã khoá') : pill('ok', 'Hoạt động')}</td><td>${fmtDate(u.created_at)}</td>` +
            `<td class="hub-right">${u.id === me().id ? '' : `<button type="button" class="btn" data-hub-admin-toggle="${esc(u.id)}" data-disabled="${u.disabled}">${u.disabled ? 'Mở khoá' : 'Khoá'}</button>`}</td></tr>`
        )
        .join('') +
      `</tbody></table></section>`;
  };

  PAGES.audit = async (el, { isCurrent }) => {
    const f = S.auditFilter || '';
    const page = await API.get(`/workspaces/${S.ws.id}/audit?limit=200${f ? '&action=' + encodeURIComponent(f) : ''}`);
    if (!isCurrent()) return;
    const opts = [
      ['', 'Mọi thao tác'],
      ['document.', 'Tài liệu'],
      ['membership.', 'Thành viên, quyền'],
      ['invitation.', 'Lời mời'],
      ['comment.', 'Nhận xét'],
      ['group.', 'Group'],
      ['ticket.', 'Ticket'],
      ['workspace.', 'Workspace'],
    ];
    el.innerHTML =
      HUB.head('Nhật ký', 'Thay đổi quyền, thành viên, trạng thái tài liệu, mức bảo mật, xử lý ticket. Lưu 2 năm rồi tự xoá.') +
      `<div class="hub-filters"><select class="hub-select" data-hub-filter="audit">${opts.map(([v, l]) => `<option value="${v}"${v === f ? ' selected' : ''}>${l}</option>`).join('')}</select></div>` +
      `<section class="set-card hub-flush">${
        page.items.length
          ? `<table class="hub-table"><thead><tr><th>Lúc</th><th>Người làm</th><th>Thao tác</th><th>Chi tiết</th></tr></thead><tbody>${page.items
              .map(
                (a) =>
                  `<tr><td class="hub-nowrap">${fmtTime(a.created_at)}</td><td>${a.actor_id ? who(a.actor) : '<span class="hub-muted">Hệ thống</span>'}</td><td><code>${esc(a.action)}</code></td>` +
                  `<td class="hub-sub">${esc(auditText(a))}</td></tr>`
              )
              .join('')}</tbody></table>`
          : empty('Chưa có mục nào.')
      }</section>`;
  };
  function auditText(a) {
    const d = a.data || {};
    const parts = [
      d.number && '#' + d.number,
      d.code,
      d.title,
      d.version && 'bản ' + d.version,
      d.draft_version && 'bản dự thảo ' + d.draft_version,
      d.comment,
      d.email,
      d.name,
      typeof d.from === 'string' && typeof d.to === 'string' && `${d.from} → ${d.to}`,
      !d.from && typeof d.to === 'string' && d.to && '→ ' + d.to,
    ].filter((x) => typeof x === 'string' && x);
    return parts.join(' · ') || a.target_type + ' ' + a.target_id;
  }

  PAGES['ws-settings'] = async (el) => {
    await HUB.reloadWs();
    const ws = S.ws;
    const owner = ws.me.is_workspace_owner;
    const members = owner ? await HUB.members() : [];
    el.innerHTML =
      HUB.head('Cài đặt workspace', owner ? 'Chỉ workspace owner thay đổi được các mục dưới đây.' : 'Chỉ workspace owner thay đổi được – bạn đang xem.') +
      `<section class="set-card"><h3>Thông tin</h3><form data-hub-form="ws">` +
      `<div class="hub-grid2"><label class="f"><span>Mã dự án</span><input value="${esc(ws.code)}" disabled></label>` +
      `<label class="f"><span>Tên</span><input name="name" value="${esc(ws.name)}" ${owner ? 'required' : 'disabled'}></label></div>` +
      `<label class="f"><span>Mô tả</span><textarea name="description" rows="2" ${owner ? '' : 'disabled'}>${esc(ws.description || '')}</textarea></label>` +
      `<div class="set-row"><div class="set-row-text"><b>Cho phép mức Công khai</b><span>Tài liệu mức Công khai: mọi người có đường link xem được bản phát hành, không cần đăng nhập. Tắt để chặn hẳn trong workspace.</span></div>` +
      `<span class="set-switch"><input type="checkbox" name="allow_public" role="switch"${ws.allow_public ? ' checked' : ''}${owner ? '' : ' disabled'}><span></span></span></div>` +
      (owner ? `<div class="set-actions"><button type="submit" class="btn primary">Lưu</button></div>` : '') +
      `</form></section>` +
      (owner
        ? `<section class="set-card"><h3>Chuyển quyền workspace owner</h3><p class="set-desc">Người nhận phải là thành viên. Bạn ở lại workspace với quyền xem và nhận xét.</p>` +
          `<form class="hub-inline" data-hub-form="transfer"><select class="hub-select" name="user_id" required><option value="">Chọn thành viên…</option>${members
            .filter((m) => !m.is_workspace_owner)
            .map((m) => `<option value="${esc(m.user.id)}">${esc(m.user.display_name)} – ${esc(m.user.email)}</option>`)
            .join('')}</select><button type="submit" class="btn danger">Chuyển quyền</button></form></section>`
        : '');
  };

  // ------------------------------------------------------------- thành viên
  PAGES.members = async (el, { isCurrent }) => {
    const ws = S.ws;
    const [members, groups, subsystems, invitations] = await Promise.all([
      HUB.members(),
      HUB.groups(),
      HUB.subsystems(),
      API.get(`/workspaces/${ws.id}/invitations`).catch(() => []),
    ]);
    if (!isCurrent()) return;
    const gname = (id) => (groups.find((g) => g.id === id) || {}).name || 'group đã xoá';
    const canInvite = ws.me.workspace_user_perms.invite || ws.me.groups.some((g) => g.user_perms.invite);
    const isOwner = ws.me.is_workspace_owner;
    const anyGroupOwner = ws.me.groups.some((g) => g.is_owner);
    const scopeChip = (m) =>
      `<span class="hub-scope${m.is_owner ? ' owner' : ''}">${m.scope_type === 'workspace' ? 'Workspace' : 'Group ' + esc(gname(m.scope_id))}${m.is_owner ? ' · owner' : ''}</span>`;
    el.innerHTML =
      HUB.head('Thành viên', `${members.length} người · ${groups.length} group · ${subsystems.length} hệ thống con`, canInvite ? `<button type="button" class="btn primary" data-hub="invite">${svg(ICON.plus, 14)} Mời</button>` : '') +
      `<section class="set-card hub-flush"><table class="hub-table"><thead><tr><th>Người</th><th>Phạm vi và quyền</th><th></th></tr></thead><tbody>` +
      members
        .map(
          (m) =>
            `<tr><td>${who(m.user)}<div class="hub-sub">${esc(m.user.email)}${m.is_workspace_owner ? ' · <b>workspace owner</b>' : ''}</div></td><td>` +
            m.memberships
              .map(
                (ms) =>
                  `<div class="hub-ms">${scopeChip(ms)}<span class="hub-sub">${esc(permText(ms.doc_perms, DOC_PERMS))}${ms.user_perms && Object.values(ms.user_perms).some(Boolean) ? ' · ' + esc(permText(ms.user_perms, USER_PERMS)) : ''}</span>` +
                  (ms.is_owner || m.user.id === me().id
                    ? m.user.id === me().id && !ms.is_owner && !(ms.scope_type === 'workspace' && m.is_workspace_owner)
                      ? `<button type="button" class="btn sm" data-hub-ms-leave="${esc(ms.id)}">Rời</button>`
                      : ''
                    : `<span class="hub-row-actions"><button type="button" class="btn sm" data-hub-ms-edit="${esc(ms.id)}">Quyền</button><button type="button" class="btn sm" data-hub-ms-kick="${esc(ms.id)}">Loại</button></span>`) +
                  `</div>`
              )
              .join('') +
            `</td><td></td></tr>`
        )
        .join('') +
      `</tbody></table></section>` +
      (invitations.length
        ? `<section class="set-card"><h3>Lời mời đang chờ</h3><ul class="hub-list">${invitations
            .map(
              (i) =>
                `<li><span>${esc(i.email)} <small class="hub-muted">→ ${i.scope_type === 'group' ? 'group ' + esc(i.scope_name || '') : 'workspace'} · hết hạn ${fmtDate(i.expires_at)}</small></span>` +
                `<button type="button" class="btn sm" data-hub-inv-revoke="${esc(i.id)}">Thu hồi</button></li>`
            )
            .join('')}</ul></section>`
        : '') +
      `<section class="set-card"><h3>Group</h3><p class="set-desc">Group là phạm vi an ninh: mỗi tài liệu thuộc đúng một group, group owner có mọi quyền tài liệu trong group và là người duyệt.</p>` +
      `<table class="hub-table"><thead><tr><th>Group</th><th>Group owner</th><th>Thành viên</th><th></th></tr></thead><tbody>${groups
        .map(
          (g) =>
            `<tr><td><b>${esc(g.name)}</b>${g.description ? `<div class="hub-sub">${esc(g.description)}</div>` : ''}</td><td>${who(g.owner)}</td><td>${g.member_count}</td>` +
            `<td class="hub-right">${
              isOwner
                ? `<button type="button" class="btn sm" data-hub-group-owner="${esc(g.id)}">Đổi owner</button><button type="button" class="btn sm" data-hub-group-edit="${esc(g.id)}">Sửa</button><button type="button" class="btn sm" data-hub-group-del="${esc(g.id)}">Xoá</button>`
                : g.owner_id === me().id
                  ? `<button type="button" class="btn sm" data-hub-group-edit="${esc(g.id)}">Sửa</button>`
                  : ''
            }</td></tr>`
        )
        .join('')}</tbody></table>${isOwner ? `<div class="set-actions"><button type="button" class="btn" data-hub="new-group">${svg(ICON.plus, 14)} Group</button></div>` : ''}</section>` +
      `<section class="set-card"><h3>Hệ thống con</h3><p class="set-desc">Mã hệ thống con (CONV §3.1) dùng trong mã tài liệu và mã truy vết: SHOP-SRS-<b>ORD</b>-001, FR-<b>ORD</b>-CART-001. Không đổi được sau khi tạo.</p>` +
      (subsystems.length
        ? `<table class="hub-table"><thead><tr><th>Mã</th><th>Tên</th><th>Mô tả</th><th></th></tr></thead><tbody>${subsystems
            .map(
              (s) =>
                `<tr><td><code>${esc(s.code)}</code></td><td>${esc(s.name)}</td><td class="hub-sub">${esc(s.description || '')}</td>` +
                `<td class="hub-right">${isOwner || anyGroupOwner ? `<button type="button" class="btn sm" data-hub-sub-edit="${esc(s.id)}">Sửa</button>` : ''}${isOwner ? `<button type="button" class="btn sm" data-hub-sub-del="${esc(s.id)}">Xoá</button>` : ''}</td></tr>`
            )
            .join('')}</tbody></table>`
        : `<p class="set-desc">Chưa có hệ thống con nào – cần có trước khi tạo SRS, SDD, ERD, API.</p>`) +
      (isOwner || anyGroupOwner ? `<div class="set-actions"><button type="button" class="btn" data-hub="new-subsystem">${svg(ICON.plus, 14)} Hệ thống con</button></div>` : '') +
      `</section>`;
  };

  /** Quyền người gọi được cấp trong một phạm vi (giống máy chủ – chỉ để tắt ô không cấp được) */
  function grantable(scopeType, scopeId) {
    const m = S.ws.me;
    if (scopeType === 'workspace') {
      const d = Object.assign({}, m.workspace_doc_perms);
      return { doc: d, user: m.workspace_user_perms };
    }
    const g = m.groups.find((x) => x.group_id === scopeId);
    const u = Object.assign({}, (g && g.user_perms) || {}, { assign_owner: false, remove_owner: false });
    if (m.is_workspace_owner) Object.keys(m.workspace_user_perms).forEach((k) => k !== 'assign_owner' && k !== 'remove_owner' && (u[k] = u[k] || m.workspace_user_perms[k]));
    const d = Object.assign({}, (g && g.doc_perms) || {});
    Object.keys(m.workspace_doc_perms).forEach((k) => (d[k] = d[k] || m.workspace_doc_perms[k]));
    return { doc: d, user: u };
  }

  async function invite() {
    const groups = await HUB.groups();
    const m = S.ws.me;
    const scopes = [];
    if (m.workspace_user_perms.invite) scopes.push(['workspace', '', 'Cả workspace']);
    groups.forEach((g) => {
      const ga = m.groups.find((x) => x.group_id === g.id);
      if ((ga && ga.user_perms.invite) || m.workspace_user_perms.invite) scopes.push(['group', g.id, 'Group ' + g.name]);
    });
    if (!scopes.length) return toast('Bạn không có quyền mời người vào phạm vi nào', 'warn');
    const DEFAULT = { view: true, comment: true, create: true, edit: true, submit: true };
    const boxes = (st, sid) => {
      const lim = grantable(st, sid);
      const dv = {};
      Object.keys(DEFAULT).forEach((k) => (dv[k] = lim.doc[k]));
      return `<h4 class="hub-sec">Quyền tài liệu</h4>${permBoxes('doc_perms', DOC_PERMS, dv, lim.doc)}<h4 class="hub-sec">Quyền người dùng</h4>${permBoxes(
        'user_perms',
        st === 'workspace' ? USER_PERMS : USER_PERMS.slice(0, 3),
        {},
        lim.user
      )}`;
    };
    const r = await dialog({
      title: 'Mời thành viên',
      body:
        `<label class="f"><span>E-mail</span><input name="email" type="email" required autofocus></label>` +
        `<label class="f"><span>Mời vào</span><select name="scope" data-hub-scope>${scopes.map(([t, id, l]) => `<option value="${t}:${esc(id)}">${esc(l)}</option>`).join('')}</select></label>` +
        `<div class="hub-perm-box">${boxes(scopes[0][0], scopes[0][1])}</div>` +
        `<p class="hint">Không cấp được quyền lớn hơn quyền bạn đang có – ô mờ là quyền bạn không có. Người được mời nhận lời ở mục <b>Lời mời</b> sau khi đăng nhập bằng đúng e-mail này.</p>`,
      ok: 'Gửi lời mời',
      onOpen: (f) =>
        $('[data-hub-scope]', f).addEventListener('change', (e) => {
          const [t, id] = e.target.value.split(':');
          $('.hub-perm-box', f).innerHTML = boxes(t, id);
        }),
      onOk: (f) => {
        const d = formData(f);
        const [scope_type, scope_id] = d.scope.split(':');
        return API.post(`/workspaces/${S.ws.id}/invitations`, { email: d.email, scope_type, scope_id: scope_id || null, doc_perms: d.doc_perms, user_perms: d.user_perms });
      },
    });
    if (r) {
      toast(`Đã gửi lời mời tới ${r.email}`, 'ok');
      render();
    }
  }

  async function editMembership(id) {
    const members = await HUB.members();
    let ms = null,
      user = null;
    members.forEach((m) => m.memberships.forEach((x) => x.id === id && ((ms = x), (user = m.user))));
    if (!ms) return;
    const lim = grantable(ms.scope_type, ms.scope_id);
    const r = await dialog({
      title: `Quyền của ${user.display_name}`,
      body:
        `<p class="modal-msg">${ms.scope_type === 'workspace' ? 'Phạm vi cả workspace' : 'Phạm vi group'} – chỉ đổi được những quyền chính bạn có.</p>` +
        `<h4 class="hub-sec">Quyền tài liệu</h4>${permBoxes('doc_perms', DOC_PERMS, ms.doc_perms, lim.doc)}` +
        `<h4 class="hub-sec">Quyền người dùng</h4>${permBoxes('user_perms', ms.scope_type === 'workspace' ? USER_PERMS : USER_PERMS.slice(0, 3), ms.user_perms, lim.user)}`,
      onOk: (f) => {
        const d = formData(f);
        return API.patch(`/memberships/${id}`, { doc_perms: Object.assign({}, ms.doc_perms, d.doc_perms), user_perms: Object.assign({}, ms.user_perms, d.user_perms) });
      },
    });
    if (r) {
      HUB.invalidate('members');
      toast('Đã cập nhật quyền', 'ok');
      render();
    }
  }

  async function groupDialog(g) {
    const r = await dialog({
      title: g ? 'Sửa group' : 'Tạo group',
      body:
        `<label class="f"><span>Tên group</span><input name="name" required maxlength="80" value="${esc((g && g.name) || '')}" autofocus></label>` +
        `<label class="f"><span>Mô tả</span><textarea name="description" rows="2">${esc((g && g.description) || '')}</textarea></label>` +
        (g ? '' : `<p class="hint">Bạn làm group owner; đổi owner sau ở danh sách group.</p>`),
      onOk: (f) => (g ? API.patch(`/groups/${g.id}`, formData(f)) : API.post(`/workspaces/${S.ws.id}/groups`, formData(f))),
    });
    if (r) {
      HUB.invalidate('groups', 'members');
      await HUB.reloadWs();
      render();
    }
  }

  async function groupOwnerDialog(g) {
    const members = await HUB.members();
    const r = await dialog({
      title: `Group owner của “${g.name}”`,
      body:
        `<p class="modal-msg">Group owner có mọi quyền tài liệu trong group và là người duyệt tài liệu. Owner cũ ở lại group với quyền thành viên.</p>` +
        `<label class="f"><span>Group owner mới</span><select name="user_id" required>${members
          .map((m) => `<option value="${esc(m.user.id)}"${m.user.id === g.owner_id ? ' selected' : ''}>${esc(m.user.display_name)} – ${esc(m.user.email)}</option>`)
          .join('')}</select></label>`,
      onOk: (f) => API.put(`/groups/${g.id}/owner`, formData(f)),
    });
    if (r) {
      HUB.invalidate('groups', 'members');
      await HUB.reloadWs();
      render();
    }
  }

  async function subsystemDialog(s) {
    const r = await dialog({
      title: s ? `Sửa hệ thống con ${s.code}` : 'Thêm hệ thống con',
      body:
        (s ? '' : `<label class="f"><span>Mã (2–5 chữ in hoa / số)</span><input name="code" required maxlength="5" class="hub-upper" placeholder="ORD" autofocus></label>`) +
        `<label class="f"><span>Tên</span><input name="name" required maxlength="120" value="${esc((s && s.name) || '')}" placeholder="Đặt hàng"></label>` +
        `<label class="f"><span>Mô tả</span><textarea name="description" rows="2">${esc((s && s.description) || '')}</textarea></label>`,
      onOk: (f) => (s ? API.patch(`/subsystems/${s.id}`, formData(f)) : API.post(`/workspaces/${S.ws.id}/subsystems`, formData(f))),
    });
    if (r) {
      HUB.invalidate('subsystems');
      render();
    }
  }

  // ================================================================== SỰ KIỆN
  async function onClick(e) {
    const t = e.target.closest('[data-hub-nav],[data-hub],[data-hub-doc],[data-hub-ticket],[data-hub-note],[data-hub-inv-accept],[data-hub-inv-decline],[data-hub-inv-revoke],[data-hub-ms-edit],[data-hub-ms-kick],[data-hub-ms-leave],[data-hub-group-edit],[data-hub-group-del],[data-hub-group-owner],[data-hub-sub-edit],[data-hub-sub-del],[data-hub-admin-toggle]');
    if (!t) return;
    const d = t.dataset;
    if (t.tagName === 'A') e.preventDefault();
    try {
      if (d.hubNav) return go(d.hubNav);
      if (d.hubDoc) return go('doc', d.hubDoc);
      if (d.hubTicket) return go('ticket', d.hubTicket);
      if (d.hubNote) {
        API.post(`/me/notifications/${d.hubNote}/read`).catch(() => {});
        S.unread = Math.max(0, S.unread - (t.closest('li.unread') ? 1 : 0));
        updateBadge();
        if (d.link) return route(d.link);
        return render();
      }
      if (d.hubInvAccept) {
        const ws = await API.post(`/invitations/${d.hubInvAccept}/accept`);
        toast(`Đã tham gia ${ws.code} – ${ws.name}`, 'ok');
        await loadWorkspaces();
        return selectWs(ws.id);
      }
      if (d.hubInvDecline) {
        await API.post(`/invitations/${d.hubInvDecline}/decline`);
        return render();
      }
      if (d.hubInvRevoke) {
        if (!(await confirmDlg('Thu hồi lời mời?', 'Người được mời sẽ không nhận lời được nữa.', 'Thu hồi', true))) return;
        await API.del(`/invitations/${d.hubInvRevoke}`);
        return render();
      }
      if (d.hubMsEdit) return editMembership(d.hubMsEdit);
      if (d.hubMsKick || d.hubMsLeave) {
        const leave = !!d.hubMsLeave;
        const ok = await confirmDlg(
          leave ? 'Rời phạm vi này?' : 'Loại thành viên?',
          (leave ? 'Bạn sẽ mất quyền trong phạm vi này.' : 'Người này mất quyền trong phạm vi này (loại khỏi workspace = khỏi mọi group).') +
            ' Tài liệu họ phụ trách chuyển cho owner của phạm vi.',
          leave ? 'Rời' : 'Loại',
          true
        );
        if (!ok) return;
        await API.del(`/memberships/${d.hubMsKick || d.hubMsLeave}`);
        HUB.invalidate('members', 'groups');
        if (leave) {
          await loadWorkspaces();
          return go(S.ws ? 'overview' : 'welcome');
        }
        return render();
      }
      if (d.hubGroupEdit) return groupDialog((await HUB.groups()).find((g) => g.id === d.hubGroupEdit));
      if (d.hubGroupOwner) return groupOwnerDialog((await HUB.groups()).find((g) => g.id === d.hubGroupOwner));
      if (d.hubGroupDel) {
        if (!(await confirmDlg('Xoá group?', 'Chỉ xoá được khi group không còn tài liệu. Thành viên của group bị bỏ khỏi group.', 'Xoá', true))) return;
        await API.del(`/groups/${d.hubGroupDel}`);
        HUB.invalidate('groups', 'members');
        await HUB.reloadWs();
        return render();
      }
      if (d.hubSubEdit) return subsystemDialog((await HUB.subsystems()).find((s) => s.id === d.hubSubEdit));
      if (d.hubSubDel) {
        if (!(await confirmDlg('Xoá hệ thống con?', 'Chỉ xoá được khi chưa có tài liệu nào dùng.', 'Xoá', true))) return;
        await API.del(`/subsystems/${d.hubSubDel}`);
        HUB.invalidate('subsystems');
        return render();
      }
      if (d.hubAdminToggle) {
        await API.patch(`/admin/users/${d.hubAdminToggle}`, { disabled: d.disabled !== 'true' });
        return render();
      }
      switch (d.hub) {
        case 'retry':
          return render();
        case 'server':
          lsSet('diagram-editor:server', null);
          return renderConnect($('#hub-body'));
        case 'to-register':
          return renderAuth($('#hub-body'), 'register');
        case 'to-login':
          return renderAuth($('#hub-body'), 'login');
        case 'new-ws':
          return newWorkspace();
        case 'invite':
          return invite();
        case 'new-group':
          return groupDialog(null);
        case 'new-subsystem':
          return subsystemDialog(null);
        case 'read-all':
          await API.post('/me/notifications/read-all');
          S.unread = 0;
          updateBadge();
          return render();
        case 'logout':
          // đăng nhập lại (có thể là người khác) bắt đầu từ Tổng quan, không quay về trang Tài khoản
          S.page = 'overview';
          S.sub = null;
          await API.logout();
          return;
        default:
          if (HUB.actions && HUB.actions[d.hub]) return HUB.actions[d.hub](t);
      }
    } catch (ex) {
      fail(ex);
    }
  }
  HUB.actions = {};

  async function onSubmit(e) {
    const form = e.target.closest('[data-hub-form]');
    if (!form) return;
    e.preventDefault();
    const kind = form.dataset.hubForm;
    const btn = $('[type=submit]', form);
    const msg = $('.msg.err', form);
    if (btn) btn.disabled = true;
    if (msg) msg.hidden = true;
    try {
      const d = formData(form);
      if (kind === 'connect') {
        API.setBase(d.url);
        S.ready = false;
        if (!(await checkServer())) return renderConnect($('#hub-body'), S.metaError);
        await API.restore();
        S.ready = true;
        return afterAuth();
      }
      if (kind === 'login') {
        await API.login(d.email, d.password);
        return; // onAuth sẽ vẽ lại
      }
      if (kind === 'register') {
        await API.register({ email: d.email, password: d.password, first_name: d.first_name, last_name: d.last_name, employee_code: d.employee_code || null });
        return;
      }
      if (kind === 'profile') {
        API.setUser(await API.patch('/me', d));
        renderNav();
        return toast('Đã lưu thông tin', 'ok');
      }
      if (kind === 'password') {
        await API.post('/me/password', d);
        form.reset();
        return toast('Đã đổi mật khẩu – các phiên khác đã đăng xuất', 'ok');
      }
      if (kind === 'ws') {
        S.ws = await API.patch(`/workspaces/${S.ws.id}`, { name: d.name, description: d.description, allow_public: d.allow_public });
        await loadWorkspaces();
        toast('Đã lưu', 'ok');
        return render();
      }
      if (kind === 'transfer') {
        if (!(await confirmDlg('Chuyển quyền workspace owner?', 'Bạn sẽ không còn quyền quản trị workspace này.', 'Chuyển quyền', true))) return;
        await API.post(`/workspaces/${S.ws.id}/transfer`, d);
        await loadWorkspaces();
        toast('Đã chuyển quyền workspace owner', 'ok');
        return go('overview');
      }
      if (HUB.forms && HUB.forms[kind]) return HUB.forms[kind](form, d);
    } catch (ex) {
      if (msg) {
        msg.textContent = ex.message;
        msg.hidden = false;
      } else fail(ex);
    } finally {
      if (btn) btn.disabled = false;
    }
  }
  HUB.forms = {};

  const filterLater = DE.debounce((kind, value) => {
    if (kind === 'admin') S.adminQ = value;
    else if (HUB.filters && HUB.filters[kind]) return HUB.filters[kind](value);
    render();
  }, 300);
  HUB.filters = {};

  function onChange(e) {
    const t = e.target;
    if (t.id === 'hub-ws-select') return selectWs(t.value).catch(fail);
    if (t.dataset.hubFilter === 'audit') {
      S.auditFilter = t.value;
      return render();
    }
    if (t.dataset.hubAdminRole) {
      return API.patch(`/admin/users/${t.dataset.hubAdminRole}`, { system_role: t.value })
        .then(() => toast('Đã đổi vai trò', 'ok'))
        .catch((ex) => (fail(ex), render()));
    }
    if (t.dataset.hubFilter && t.tagName === 'SELECT') return filterLater(t.dataset.hubFilter, t.value);
    if (t.dataset.hubChange && HUB.changes && HUB.changes[t.dataset.hubChange]) return HUB.changes[t.dataset.hubChange](t);
  }
  HUB.changes = {};

  // ================================================================== THÔNG BÁO
  let pollT = 0;
  async function poll() {
    clearTimeout(pollT);
    if (!me()) return;
    try {
      const r = await API.get('/me/notifications/unread-count');
      S.unread = r.unread;
      updateBadge();
    } catch (_) {
      /* mất mạng: thử lại sau */
    }
    pollT = setTimeout(poll, document.hidden ? 180000 : 60000);
  }

  async function afterAuth() {
    S.cache = {};
    if (me()) {
      try {
        await loadWorkspaces();
      } catch (e) {
        fail(e);
      }
      poll();
    } else {
      S.workspaces = [];
      S.ws = null;
      S.unread = 0;
      updateBadge();
    }
    render();
  }

  // ================================================================== API CHO TAB KHÁC
  /** docs.js gọi khi chuyển sang / rời tab */
  HUB.onShow = function () {
    S.visible = true;
    try {
      render();
      if (me()) poll();
    } catch (e) {
      console.warn('[ChillCat Studio] Tab Dự án:', e);
    }
  };
  HUB.onHide = function () {
    S.visible = false;
  };

  async function boot() {
    if (API.base()) {
      await checkServer();
      if (S.meta) await API.restore();
    }
    S.ready = true;
    await afterAuth();
    if (location.hash.startsWith('#/hub/')) route(location.hash);
  }

  function init() {
    const view = $('#hubview');
    if (!view) return;
    view.addEventListener('click', onClick);
    view.addEventListener('submit', onSubmit);
    view.addEventListener('change', onChange);
    view.addEventListener('input', (e) => {
      const t = e.target;
      if (t.classList.contains('hub-upper')) t.value = t.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (t.dataset.hubFilter && t.tagName === 'INPUT') filterLater(t.dataset.hubFilter, t.value);
    });
    $('#hub-side').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const btns = $$('#hub-side [data-hub-nav]');
      const i = btns.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      btns[(i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length].focus();
    });
    // liên kết tới tài liệu / ticket bên trong hộp thoại (gắn ngoài #hubview): đóng hộp thoại rồi chuyển trang
    document.addEventListener('click', (e) => {
      const b = !e.target.closest('#hubview') && e.target.closest('.modal [data-hub-doc], .modal [data-hub-ticket]');
      if (!b) return;
      const cancel = b.closest('.modal-backdrop') && $('[data-r="cancel"]', b.closest('.modal-backdrop'));
      if (cancel) cancel.click();
      if (b.dataset.hubDoc) go('doc', b.dataset.hubDoc);
      else go('ticket', b.dataset.hubTicket);
    });
    window.addEventListener('hashchange', () => {
      if (location.hash.startsWith('#/hub/')) route(location.hash);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && me()) poll();
    });
    API.onAuth(() => {
      if (S.ready) afterAuth();
    });
    boot();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.DE);
