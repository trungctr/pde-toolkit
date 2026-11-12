/* =========================================================================
 * Khởi động ứng dụng + tự lưu vào localStorage
 * ========================================================================= */
(function (DE) {
  'use strict';
  const KEY = 'diagram-editor:doc:v1';

  function loadSaved() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return DE.normalizeDoc(JSON.parse(raw)).doc;
    } catch (_) {
      return null;
    }
  }

  const autosave = DE.debounce(() => {
    // đang vẽ / sửa diagram cho tài liệu Markdown: docs.js tự lưu phiên, không ghi đè diagram chính
    if (DE.docs && DE.docs.onDiagramChange()) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(DE.store.doc));
    } catch (_) {
      /* hết quota / chế độ riêng tư */
    }
  }, 400);

  function start() {
    const initial = loadSaved() || DE.normalizeDoc(DE.templates.flowchart.build()).doc;
    DE.store.load(initial, { history: false });
    DE.editor.init(document.getElementById('stage'));
    DE.ui.init();
    initPWA(); // trước docs.init: tab Cài đặt (có thể mở lại ngay khi tải) đọc trạng thái cài ứng dụng
    if (DE.pages) DE.pages.init(); // trước docs.init: docs có thể mở lại tab Thiết kế trang ngay khi tải
    DE.docs.init();
    DE.store.onChange(autosave);
    requestAnimationFrame(() => DE.editor.fit());
    // API nhỏ để thao tác qua DevTools console
    window.diagram = {
      get json() {
        return DE.clone(DE.store.doc);
      },
      load: (obj) => DE.store.load(DE.normalizeDoc(obj).doc),
      add: (type, x, y, extra) => {
        const n = DE.createNode(type, x, y, extra);
        DE.store.mutate((doc) => doc.nodes.push(n));
        return n.id;
      },
      connect: (type, source, target, extra) => {
        const e = DE.createEdge(type, source, target, extra);
        DE.store.mutate((doc) => doc.edges.push(e));
        return e.id;
      },
      shapes: () => Object.keys(DE.shapes),
      /** tài liệu Markdown: diagram.markdown() trả về nội dung file .md hiện tại */
      markdown: () => DE.docs.serialize(),
      /** thiết kế trang: diagram.pages() – dự án JSON; diagram.pageHTML() – file HTML xuất ra */
      pages: () => DE.pages.project(),
      pageHTML: () => DE.pages.html(),
      connectors: () => Object.keys(DE.connectors),
    };
  }

  // ================================================================== PWA
  function initPWA() {
    // Service worker (chỉ chạy trên http/https, không chạy khi mở bằng file://)
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[ChillCat Studio] Không đăng ký được service worker:', e));
    }

    // Mở file .json từ hệ điều hành (file_handlers trong manifest – app đã cài)
    if ('launchQueue' in window) {
      window.launchQueue.setConsumer(async (params) => {
        if (!params.files || !params.files.length) return;
        const file = await params.files[0].getFile();
        if (/\.(md|markdown|mdx)$/i.test(file.name)) DE.docs.openFile(file, params.files[0]);
        else DE.ui.openDiagramFile(file);
      });
    }

    // Cài như ứng dụng: tab Cài đặt hiện nút khi trình duyệt cho phép cài
    let deferred = null;
    const listeners = [];
    const changed = () => listeners.forEach((f) => f());
    const standalone = () => !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    DE.pwa = {
      /** 'installed' (đang chạy như ứng dụng) | 'ready' (cài được ngay) | 'unavailable' */
      state: () => (standalone() ? 'installed' : deferred ? 'ready' : 'unavailable'),
      offline: () => /^https?:$/.test(location.protocol) && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller,
      install: async () => {
        if (!deferred) return false;
        const d = deferred;
        deferred = null; // mỗi sự kiện chỉ hỏi được một lần; từ chối thì trình duyệt sẽ báo lại sau
        d.prompt();
        const choice = await d.userChoice.catch(() => null);
        changed();
        return !!(choice && choice.outcome === 'accepted');
      },
      onChange: (f) => listeners.push(f),
    };
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      changed();
    });
    window.addEventListener('appinstalled', () => {
      deferred = null;
      changed();
      DE.ui.toast('Đã cài đặt ChillCat Studio – có thể mở từ màn hình chính / menu ứng dụng', 'ok');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.DE);
