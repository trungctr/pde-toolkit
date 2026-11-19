/* =========================================================================
 * Client gọi máy chủ ChillCat Studio (backend/ – Rust + MongoDB), dùng cho tab Dự án.
 *  - Địa chỉ máy chủ: mặc định cùng origin (`/api/v1`) khi mở app qua http(s); đổi được trong tab Dự án.
 *  - Phiên đăng nhập: access token chỉ giữ trong bộ nhớ (15 phút); refresh token nằm trong cookie HttpOnly
 *    khi app và API cùng origin, hoặc trong localStorage khi API ở origin khác (không gửi được cookie).
 *  - Hết hạn access token ⇒ tự làm mới một lần rồi gửi lại.
 *  - Lỗi: ném DE.api.Error { status, code, message, details } – message luôn là tiếng Việt đọc được.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const API = (DE.api = {});
  const SERVER_KEY = 'diagram-editor:server';
  // refresh token khi API khác origin; cùng origin chỉ ghi 'cookie' (token nằm trong cookie HttpOnly) để biết
  // trình duyệt này đã từng đăng nhập – lần đầu mở app không gọi /auth/refresh vô ích
  const SESSION_KEY = 'diagram-editor:session';
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

  class ApiError extends Error {
    constructor(status, code, message, details) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }
  API.Error = ApiError;

  let access = null; // { token, exp }
  let user = null;
  const listeners = [];
  const emit = () => listeners.forEach((f) => f(user));
  /** Đăng ký nghe đổi trạng thái đăng nhập: f(user | null) */
  API.onAuth = (f) => listeners.push(f);
  API.user = () => user;

  // ------------------------------------------------------------- máy chủ
  const httpApp = /^https?:$/.test(location.protocol);
  /** Địa chỉ gốc của API (không có `/` cuối) – '' nếu chưa cấu hình */
  API.base = function () {
    const saved = (lsGet(SERVER_KEY) || '').trim().replace(/\/+$/, '');
    if (saved) return saved;
    return httpApp ? location.origin + '/api/v1' : '';
  };
  API.savedBase = () => (lsGet(SERVER_KEY) || '').trim();
  /** Đặt địa chỉ máy chủ ('' = mặc định cùng origin). Đăng xuất phiên cũ. */
  API.setBase = function (url) {
    let v = String(url || '').trim().replace(/\/+$/, '');
    if (v && !/^https?:\/\//i.test(v)) v = 'https://' + v;
    if (v && !/\/api\/v\d+$/.test(v)) v += '/api/v1';
    lsSet(SERVER_KEY, v || null);
    lsSet(SESSION_KEY, null);
    access = null;
    user = null;
    emit();
    return API.base();
  };
  const sameOrigin = () => {
    try {
      return new URL(API.base()).origin === location.origin;
    } catch (_) {
      return false;
    }
  };

  // --------------------------------------------------------------- gọi API
  async function raw(method, path, body, token) {
    const base = API.base();
    if (!base) throw new ApiError(0, 'client.no_server', 'Chưa cấu hình máy chủ');
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    let res;
    try {
      res = await fetch(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        credentials: sameOrigin() ? 'same-origin' : 'omit',
      });
    } catch (e) {
      throw new ApiError(0, 'client.offline', 'Không kết nối được máy chủ – kiểm tra mạng hoặc địa chỉ máy chủ');
    }
    if (res.status === 204) return null;
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      if (!res.ok) throw new ApiError(res.status, 'client.bad_response', `Máy chủ trả lỗi ${res.status}`);
      throw new ApiError(res.status, 'client.bad_response', 'Máy chủ trả về dữ liệu không phải JSON – địa chỉ máy chủ có đúng không?');
    }
    if (!res.ok) {
      const e = (data && data.error) || {};
      throw new ApiError(res.status, e.code || 'http_' + res.status, e.message || `Máy chủ trả lỗi ${res.status}`, e.details);
    }
    return data;
  }

  function adopt(auth) {
    access = { token: auth.access_token, exp: Date.now() + (auth.expires_in - 30) * 1000 };
    lsSet(SESSION_KEY, sameOrigin() ? 'cookie' : auth.refresh_token);
    const changed = !user || user.id !== auth.user.id;
    user = auth.user;
    if (changed) emit();
    return user;
  }

  let refreshing = null;
  /** Đổi refresh token lấy access token mới. Trả về user hoặc null (hết phiên). */
  API.refresh = function () {
    if (refreshing) return refreshing;
    const stored = lsGet(SESSION_KEY);
    if (!stored || (!sameOrigin() && stored === 'cookie')) return Promise.resolve(null);
    refreshing = raw('POST', '/auth/refresh', sameOrigin() ? {} : { refresh_token: stored })
      .then(adopt)
      .catch((e) => {
        if (e.status === 401 || e.status === 403) {
          lsSet(SESSION_KEY, null);
          access = null;
          if (user) {
            user = null;
            emit();
          }
          return null;
        }
        throw e;
      })
      .finally(() => (refreshing = null));
    return refreshing;
  };

  /** Gọi API cần đăng nhập; tự làm mới phiên khi access token hết hạn. */
  API.call = async function (method, path, body) {
    if (!access || access.exp < Date.now()) await API.refresh();
    try {
      return await raw(method, path, body, access && access.token);
    } catch (e) {
      if (e.status === 401 && access) {
        access = null;
        if (await API.refresh()) return raw(method, path, body, access && access.token);
      }
      if (e.status === 401 && user) {
        user = null;
        emit();
      }
      throw e;
    }
  };
  API.get = (p) => API.call('GET', p);
  API.post = (p, b = {}) => API.call('POST', p, b);
  API.put = (p, b) => API.call('PUT', p, b);
  API.patch = (p, b) => API.call('PATCH', p, b);
  API.del = (p) => API.call('DELETE', p);
  /** Gọi không cần đăng nhập (meta, trang công khai) */
  API.public = (p) => raw('GET', p);

  // -------------------------------------------------------------- đăng nhập
  API.login = async (email, password) => adopt(await raw('POST', '/auth/login', { email, password }));
  API.register = async (input) => adopt(await raw('POST', '/auth/register', input));
  API.logout = async function () {
    try {
      const stored = lsGet(SESSION_KEY);
      await raw('POST', '/auth/logout', sameOrigin() || stored === 'cookie' ? {} : { refresh_token: stored || '' });
    } catch (_) {
      /* vẫn đăng xuất phía trình duyệt */
    }
    lsSet(SESSION_KEY, null);
    access = null;
    user = null;
    emit();
  };
  /** Khôi phục phiên khi mở app (cookie / token đã lưu). */
  API.restore = async function () {
    if (!API.base()) return null;
    try {
      return await API.refresh();
    } catch (_) {
      return null;
    }
  };
  /** Thông tin máy chủ (không cần đăng nhập) – dùng để kiểm tra kết nối */
  API.meta = () => raw('GET', '/meta');
  /** Cập nhật hồ sơ người đang đăng nhập (không phát sự kiện đổi người dùng nếu vẫn là người đó) */
  API.setUser = (u) => {
    const changed = !user || !u || user.id !== u.id;
    user = u;
    if (changed) emit();
  };
})(window.DE);
