/* =========================================================================
 * Service worker – cho phép Diagram Editor chạy offline.
 * Chiến lược network-first cho mọi file cùng origin: có mạng thì luôn dùng bản
 * mới nhất (HTML, JS, CSS luôn cùng phiên bản), mất mạng thì dùng bản đã cache.
 * Thư viện tải từ CDN (Mermaid, KaTeX, highlight.js, emoji) có số phiên bản trong URL nên
 * không bao giờ đổi: cache-first trong một cache riêng, giữ qua các lần nâng cấp app.
 * Khi phát hành phiên bản mới có đổi danh sách file, tăng VERSION.
 * ========================================================================= */
const VERSION = 'v11';
const CACHE = `diagram-editor-${VERSION}`;
const CDN_CACHE = 'diagram-editor-cdn-v1';
const CDN_ORIGIN = 'https://cdn.jsdelivr.net';
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/util.js',
  'js/shapes.js',
  'js/render.js',
  'js/store.js',
  'js/templates.js',
  'js/help.js',
  'js/skill.js',
  'js/ai.js',
  'js/voice.js',
  'js/export.js',
  'js/editor.js',
  'js/ui.js',
  'js/markdown.js',
  'js/md-rich.js',
  'js/plantuml.js',
  'js/docs.js',
  'js/guide.js',
  'js/page-kit.js',
  'js/page-editor.js',
  'js/settings.js',
  'js/main.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('diagram-editor-') && k !== CACHE && k !== CDN_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === CDN_ORIGIN && /^\/npm\/(@[^/]+\/)?[^/@]+@\d/.test(url.pathname)) {
    // thư viện có phiên bản cố định: cache-first (lần đầu cần mạng, sau đó chạy offline)
    event.respondWith(
      caches.open(CDN_CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      })
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  const isNav = req.mode === 'navigate';
  event.respondWith(
    // không lấy bản cũ trong cache HTTP: luôn hỏi lại server (ETag → 304 rất nhẹ) để HTML / JS / CSS cùng phiên bản
    fetch(isNav ? req : new Request(req, { cache: 'no-cache' }))
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(isNav ? 'index.html' : req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE);
        if (isNav) return (await cache.match('index.html')) || (await cache.match('./'));
        const hit = await cache.match(req, { ignoreSearch: true });
        return hit || new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});
