/* =========================================================================
 * Thiết kế trang – lõi dữ liệu (không phụ thuộc giao diện)
 *  - Danh mục thành phần, thuộc tính đặt tên theo cách nói thông thường
 *    ("khi di chuột qua" thay vì hover…)
 *  - Chuẩn hoá / kiểm tra JSON: mọi giá trị đi vào CSS/HTML đều được lọc
 *    theo kiểu (màu, số, danh sách cố định, URL an toàn) -> không chèn mã được
 *  - Sinh HTML + CSS dùng chung cho khung soạn, xem thử và file HTML xuất ra
 *  - Skill cho AI
 *
 * Dự án: { kind:'de-page', version:1, name, theme:{font,fontSize,color,primary},
 *          pages:[{ id, name, path, props:{title,bg,bgImage,bgSize}, children:[…] }],
 *          script }  – script: mã JS của dự án, chỉ chạy khi Xem thử / trong file xuất
 * Thành phần: { id, type, name?, props:{…chỉ các giá trị khác mặc định}, children? }
 * ========================================================================= */
(function (DE) {
  'use strict';
  const esc = DE.esc;
  const PK = (DE.pagekit = {});
  const MOBILE = 640; // <= 640px: điện thoại
  PK.MOBILE = MOBILE;

  // ============================================================ FONT · BÓNG · MÀU
  const SYS = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const FONTS = {
    system: { name: 'Mặc định của máy', css: SYS },
    arial: { name: 'Arial', css: 'Arial, Helvetica, sans-serif' },
    verdana: { name: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
    tahoma: { name: 'Tahoma', css: 'Tahoma, Verdana, sans-serif' },
    trebuchet: { name: 'Trebuchet', css: '"Trebuchet MS", Verdana, sans-serif' },
    georgia: { name: 'Georgia (có chân)', css: 'Georgia, "Times New Roman", serif' },
    times: { name: 'Times New Roman (có chân)', css: '"Times New Roman", Times, serif' },
    mono: { name: 'Đơn cách (Consolas)', css: 'Consolas, "Courier New", monospace' },
    'be-vietnam-pro': { name: 'Be Vietnam Pro (web)', css: '"Be Vietnam Pro", ' + SYS, google: 'Be+Vietnam+Pro:wght@400;500;600;700' },
    inter: { name: 'Inter (web)', css: 'Inter, ' + SYS, google: 'Inter:wght@400;500;600;700' },
    roboto: { name: 'Roboto (web)', css: 'Roboto, ' + SYS, google: 'Roboto:wght@400;500;700' },
    montserrat: { name: 'Montserrat (web)', css: 'Montserrat, ' + SYS, google: 'Montserrat:wght@400;600;700' },
    nunito: { name: 'Nunito (web)', css: 'Nunito, ' + SYS, google: 'Nunito:wght@400;600;700' },
    lora: { name: 'Lora (web, có chân)', css: 'Lora, Georgia, serif', google: 'Lora:wght@400;600;700' },
    playfair: { name: 'Playfair Display (web, có chân)', css: '"Playfair Display", Georgia, serif', google: 'Playfair+Display:wght@400;600;700' },
  };
  PK.FONTS = FONTS;
  const SHADOWS = {
    none: 'none',
    sm: '0 1px 3px rgba(15,23,42,.16)',
    md: '0 6px 18px rgba(15,23,42,.14)',
    lg: '0 18px 44px rgba(15,23,42,.22)',
  };
  const SPEED = { fast: '.12s', normal: '.2s', slow: '.4s' };

  const COLOR_RE = /^(#[0-9a-f]{3,8}|transparent|rgba?\(\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*(,\s*(0|1|0?\.\d+|\d{1,3}%)\s*)?\))$/i;
  const isColor = (v) => typeof v === 'string' && COLOR_RE.test(v.trim()) && (v.trim()[0] !== '#' || [4, 5, 7, 9].includes(v.trim().length));
  PK.isColor = isColor;
  function hexRgb(h) {
    if (typeof h !== 'string') return null;
    let s = h.trim();
    if (/^#[0-9a-f]{3}$/i.test(s)) s = '#' + s.slice(1).split('').map((c) => c + c).join('');
    if (!/^#[0-9a-f]{6}$/i.test(s)) return null;
    return [0, 2, 4].map((i) => parseInt(s.slice(1 + i, 3 + i), 16));
  }
  const toHex = (rgb) => '#' + rgb.map((v) => Math.round(DE.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  /** Trộn màu a với b theo tỉ lệ t (0..1). Màu không phải hex -> giữ a */
  function mix(a, b, t) {
    const x = hexRgb(a), y = hexRgb(b);
    if (!x || !y) return a;
    return toHex(x.map((v, i) => v + (y[i] - v) * t));
  }
  const lum = (h) => {
    const c = hexRgb(h);
    if (!c) return 1;
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const readable = (bg) => (lum(bg) > 0.45 ? '#0f172a' : '#ffffff');
  function rgba(h, a) {
    const c = hexRgb(h);
    return c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : 'rgba(37,99,235,' + a + ')';
  }
  /** Màu "tự động" khi di chuột qua: đậm hơn màu nền, hoặc phủ nhẹ màu chủ đạo nếu nền trong suốt */
  function autoTint(bg, theme, strong) {
    if (hexRgb(bg)) return lum(bg) < 0.06 ? mix(bg, '#ffffff', strong ? 0.22 : 0.14) : mix(bg, '#000000', strong ? 0.18 : 0.1);
    return rgba(theme.primary, strong ? 0.16 : 0.09);
  }
  PK.mix = mix;
  PK.readable = readable;

  /** Bỏ dấu tiếng Việt, chuyển thành chuỗi-gach-noi */
  PK.slug = (s, max = 60) =>
    String(s == null ? '' : s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max)
      .replace(/-+$/, '');

  /** URL cho liên kết: http(s), mailto, tel, #… hoặc đường dẫn tương đối. Trả null nếu nguy hiểm */
  PK.safeUrl = function (u) {
    if (typeof u !== 'string') return null;
    // eslint-disable-next-line no-control-regex
    u = u.replace(/[\u0000-\u001F\u007F]/g, '').trim();
    if (!u) return '';
    if (u.length > 2000) return null;
    const m = u.match(/^([a-z][a-z0-9+.-]*):/i);
    if (m && !/^(https?|mailto|tel)$/i.test(m[1])) return null; // javascript:, data:, vbscript:…
    return u;
  };
  /** URL ảnh: http(s), đường dẫn tương đối, hoặc data:image/…;base64 */
  PK.safeImage = function (u) {
    if (typeof u !== 'string') return null;
    u = u.trim();
    if (!u) return '';
    if (/^data:/i.test(u)) {
      const s = u.replace(/\s+/g, '');
      return /^data:image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml);base64,[a-z0-9+/]+=*$/i.test(s) && s.length < 8e6 ? s : null;
    }
    const s = PK.safeUrl(u);
    return s == null || /^(mailto|tel):/i.test(s) ? null : s;
  };
  /** Chuỗi an toàn bên trong url("…") của CSS (kể cả khi CSS nằm trong thẻ <style>) */
  const cssUrl = (u) => 'url("' + String(u).replace(/["\\\n\r<>]/g, (c) => encodeURIComponent(c)) + '")';

  // ============================================================ THUỘC TÍNH
  const C = (label, x) => Object.assign({ type: 'color', label }, x);
  const N = (label, min, max, x) => Object.assign({ type: 'num', label, min, max, step: 1 }, x);
  const E = (label, options, x) => Object.assign({ type: 'enum', label, options }, x);
  const B = (label, x) => Object.assign({ type: 'bool', label }, x);
  const T = (label, x) => Object.assign({ type: 'text', label, max: 300 }, x);
  const SHADOW_OPTS = [['none', 'Không'], ['sm', 'Nhẹ'], ['md', 'Vừa'], ['lg', 'Đậm']];
  const LINE_OPTS = [['solid', 'Liền'], ['dashed', 'Gạch'], ['dotted', 'Chấm']];
  const isSubmit = (P, t) => t !== 'button' || P.action === 'submit';

  function fxFields(pre) {
    const press = pre === 'press';
    return {
      [pre + 'Bg']: C('Đổi màu nền', { opt: true, auto: true }),
      [pre + 'Color']: C('Đổi màu chữ', { opt: true }),
      [pre + 'Border']: C('Đổi màu viền', { opt: true }),
      [pre + 'Scale']: N('Phóng to / thu nhỏ', 50, 200, { unit: '%', opt: true, def: press ? 96 : 105 }),
      [pre + 'Lift']: N(press ? 'Lún xuống / nhấc lên' : 'Nhấc lên', -20, 40, { unit: 'px', opt: true, def: press ? -1 : 3, hint: 'Số âm: lún xuống' }),
      [pre + 'Shadow']: E('Đổ bóng', SHADOW_OPTS, { opt: true, def: press ? 'sm' : 'md' }),
      [pre + 'Opacity']: N('Độ rõ', 0, 100, { unit: '%', opt: true, def: 85 }),
    };
  }

  const F = {
    // ---- nền
    bg: C('Màu nền', { none: true }),
    bgImage: { type: 'image', label: 'Ảnh nền' },
    bgSize: E('Cách phủ ảnh nền', [['cover', 'Phủ kín'], ['contain', 'Vừa khung'], ['repeat', 'Lặp lại']], { ui: 'seg', show: (P) => !!P.bgImage }),
    bgOverlay: N('Làm tối ảnh nền', 0, 90, { unit: '%', ui: 'range', show: (P) => !!P.bgImage, hint: 'Giúp chữ trên ảnh dễ đọc hơn' }),
    // ---- chữ
    color: C('Màu chữ'),
    font: E('Font chữ', null, { optionsFn: () => [['', 'Theo trang']].concat(Object.entries(FONTS).map(([k, f]) => [k, f.name])) }),
    fontSize: N('Cỡ chữ', 8, 160, { unit: 'px' }),
    bold: B('Đậm'),
    italic: B('Nghiêng'),
    underline: B('Gạch chân'),
    upper: B('IN HOA'),
    align: E('Căn chữ', [['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải'], ['justify', 'Đều 2 bên']], { ui: 'seg' }),
    lineHeight: N('Khoảng cách dòng', 0.8, 3, { step: 0.05, unit: '×' }),
    letterSpacing: N('Giãn cách chữ', -5, 30, { step: 0.5, unit: 'px' }),
    // ---- khoảng cách
    padY: N('Đệm trong: trên & dưới', 0, 400, { unit: 'px' }),
    padX: N('Đệm trong: trái & phải', 0, 400, { unit: 'px' }),
    marginY: N('Cách thành phần khác (trên & dưới)', 0, 400, { unit: 'px' }),
    maxW: N('Độ rộng tối đa', 0, 4000, { unit: 'px', hint: '0 = không giới hạn' }),
    // ---- viền, góc, bóng
    borderW: N('Độ dày viền', 0, 20, { unit: 'px' }),
    borderColor: C('Màu viền'),
    borderStyle: E('Kiểu viền', LINE_OPTS, { ui: 'seg', show: (P) => P.borderW > 0 }),
    radius: N('Bo góc', 0, 200, { unit: 'px', ui: 'range' }),
    shadow: E('Đổ bóng', SHADOW_OPTS, { ui: 'seg' }),
    opacity: N('Độ rõ', 0, 100, { unit: '%', ui: 'range', hint: '100% = rõ hẳn, càng nhỏ càng trong suốt' }),
    // ---- hiệu ứng tương tác
    ...fxFields('hover'),
    ...fxFields('press'),
    speed: E('Tốc độ chuyển đổi', [['fast', 'Nhanh'], ['normal', 'Vừa'], ['slow', 'Chậm']], { ui: 'seg' }),
    // ---- hiển thị
    hideMobile: B('Ẩn trên điện thoại'),
    hideDesktop: B('Ẩn trên máy tính & máy tính bảng'),
    // ---- bố cục
    tag: E('Vai trò của khối', [['header', 'Phần đầu trang'], ['nav', 'Thanh điều hướng'], ['main', 'Nội dung chính'], ['section', 'Mục nội dung'], ['article', 'Bài viết'], ['aside', 'Thông tin bên lề'], ['footer', 'Chân trang'], ['div', 'Khối chung']], { hint: 'Giúp công cụ tìm kiếm & trình đọc màn hình hiểu trang' }),
    contentW: N('Bề rộng phần nội dung', 0, 3000, { unit: 'px', hint: 'Nội dung nằm giữa và không rộng quá giá trị này · 0 = tràn hết' }),
    minH: N('Chiều cao tối thiểu', 0, 3000, { unit: 'px' }),
    gap: N('Khoảng cách giữa các thành phần', 0, 300, { unit: 'px' }),
    vAlign: E('Căn theo chiều dọc', [['top', 'Trên'], ['center', 'Giữa'], ['bottom', 'Dưới'], ['between', 'Dàn đều']], {
      ui: 'seg',
      byType: { row: [['top', 'Trên'], ['center', 'Giữa'], ['bottom', 'Dưới'], ['stretch', 'Cao bằng nhau']] },
    }),
    hAlign: E('Căn theo chiều ngang', [['stretch', 'Giãn hết'], ['start', 'Trái'], ['center', 'Giữa'], ['end', 'Phải']], { ui: 'seg' }),
    justify: E('Phân bố theo chiều ngang', [['start', 'Trái'], ['center', 'Giữa'], ['end', 'Phải'], ['between', 'Dạt 2 bên'], ['around', 'Cách đều']], { ui: 'seg' }),
    wrap: B('Tự xuống dòng khi không đủ chỗ'),
    stack: B('Trên điện thoại: xếp chồng thành cột dọc'),
    sticky: B('Dính ở đầu màn hình khi cuộn trang'),
    widthMode: E('Độ rộng', [['auto', 'Chia đều'], ['fit', 'Vừa nội dung'], ['percent', 'Theo %'], ['fixed', 'Cố định']], {
      ui: 'seg',
      byType: {
        button: [['fit', 'Vừa chữ'], ['full', 'Giãn hết'], ['fixed', 'Cố định']],
        image: [['full', 'Đầy khung'], ['percent', 'Theo %'], ['fixed', 'Cố định']],
      },
    }),
    width: N('Giá trị độ rộng', 1, 4000, { unitFn: (P) => (P.widthMode === 'percent' ? '%' : 'px'), show: (P) => P.widthMode === 'percent' || P.widthMode === 'fixed' }),
    place: E('Vị trí trong khung chứa', [['auto', 'Theo khung'], ['start', 'Trái'], ['center', 'Giữa'], ['end', 'Phải']], { ui: 'seg', show: (P, t, c) => !(c && c.inRow) && P.widthMode !== 'full' }),
    // ---- nội dung chữ
    text: { type: 'area', label: 'Nội dung', max: 20000, rows: 3, uiFor: { button: 'text' } },
    level: E('Cỡ tiêu đề', [['1', 'H1 · Rất lớn'], ['2', 'H2 · Lớn'], ['3', 'H3 · Vừa'], ['4', 'H4 · Nhỏ'], ['5', 'H5 · Rất nhỏ'], ['6', 'H6 · Nhỏ nhất']], { hint: 'Mỗi trang nên có đúng một H1' }),
    // ---- nút bấm
    icon: T('Biểu tượng (emoji hoặc ký tự)', { max: 8, placeholder: 'vd: → ☰ ✓ 🚀' }),
    iconPos: E('Vị trí biểu tượng', [['before', 'Trước chữ'], ['after', 'Sau chữ']], { ui: 'seg', show: (P) => !!P.icon }),
    variant: E('Kiểu nút', [['solid', 'Nền đặc'], ['outline', 'Viền'], ['soft', 'Nền nhạt'], ['ghost', 'Chỉ chữ']], { ui: 'seg', hint: 'Chọn kiểu nhanh – màu chi tiết chỉnh ngay bên dưới' }),
    size: E('Kích thước', [['sm', 'Nhỏ'], ['md', 'Vừa'], ['lg', 'Lớn']], { ui: 'seg' }),
    action: E('Khi bấm nút sẽ', [['link', 'Chuyển trang'], ['show', 'Mở menu'], ['submit', 'Gửi / chạy chức năng']], { ui: 'seg' }),
    linkKind: E('Đi tới', [['page', 'Trang trong dự án'], ['url', 'Địa chỉ web']], { ui: 'seg', show: (P) => P.action === 'link' }),
    page: { type: 'page', label: 'Trang đích', show: (P) => P.action === 'link' && P.linkKind === 'page' },
    url: { type: 'url', label: 'Địa chỉ web', placeholder: 'https://…', show: (P, t) => (t === 'button' ? P.action === 'link' && P.linkKind === 'url' : P.submitKind === 'url') },
    newTab: B('Mở trong tab mới', { show: (P) => P.action === 'link' }),
    menu: { type: 'menu', label: 'Menu sẽ mở', show: (P) => P.action === 'show' },
    submitKind: E('Chức năng', [['form', 'Gửi biểu mẫu chứa nút'], ['func', 'Gọi hàm JavaScript'], ['alert', 'Hiện thông báo']], {
      show: isSubmit,
      byType: { form: [['alert', 'Hiện lời cảm ơn'], ['url', 'Gửi dữ liệu tới địa chỉ web'], ['func', 'Gọi hàm JavaScript']] },
    }),
    func: { type: 'ident', label: 'Tên hàm JavaScript', placeholder: 'vd: guiDonHang', hint: 'Viết hàm trong “Mã JavaScript của dự án” (bỏ chọn mọi thành phần để thấy)', show: (P, t) => isSubmit(P, t) && P.submitKind === 'func' },
    message: T('Nội dung thông báo', { max: 500, show: (P, t) => isSubmit(P, t) && P.submitKind === 'alert' }),
    method: E('Cách gửi', [['post', 'POST'], ['get', 'GET']], { ui: 'seg', show: (P) => P.submitKind === 'url' }),
    // ---- ảnh
    src: { type: 'image', label: 'Ảnh' },
    alt: T('Mô tả ảnh', { hint: 'Cho người khiếm thị và công cụ tìm kiếm' }),
    height: N('Chiều cao', 0, 3000, { unit: 'px', hint: '0 = tự động theo tỉ lệ ảnh' }),
    fit: E('Khi ảnh khác tỉ lệ khung', [['cover', 'Phủ kín (cắt bớt)'], ['contain', 'Hiện trọn (không cắt)']], { ui: 'seg', show: (P) => P.height > 0 }),
    // ---- danh sách
    items: { type: 'lines', label: 'Các mục (mỗi dòng một mục)', rows: 5 },
    marker: E('Ký hiệu đầu dòng', [['disc', '● Chấm'], ['number', '1. Số'], ['check', '✓ Tích'], ['none', 'Không']], { ui: 'seg' }),
    // ---- bảng
    rows: { type: 'table', label: 'Dữ liệu' },
    header: B('Dòng đầu là tiêu đề'),
    firstColBold: B('In đậm cột đầu tiên'),
    lines: E('Kẻ bảng', [['all', 'Kẻ ô'], ['rows', 'Kẻ ngang'], ['none', 'Không kẻ']], { ui: 'seg' }),
    striped: B('Tô màu xen kẽ các hàng'),
    stripeColor: C('Màu hàng xen kẽ', { show: (P) => P.striped }),
    hoverRow: B('Tô sáng hàng khi di chuột qua'),
    hoverRowColor: C('Màu hàng khi di chuột qua', { show: (P) => P.hoverRow }),
    headBg: C('Màu nền dòng tiêu đề', { none: true, show: (P) => P.header }),
    headColor: C('Màu chữ dòng tiêu đề', { show: (P) => P.header }),
    cellPad: E('Độ thoáng của ô', [['sm', 'Gọn'], ['md', 'Vừa'], ['lg', 'Thoáng']], { ui: 'seg' }),
    full: B('Giãn hết chiều ngang'),
    // ---- ngăn cách
    kind: E('Loại', [['hr', 'Thanh ngang'], ['vr', 'Thanh dọc'], ['space', 'Khoảng trống']], { ui: 'seg' }),
    thickness: N('Độ dày', 1, 20, { unit: 'px', show: (P) => P.kind !== 'space' }),
    length: N('Độ dài', 5, 100, { unit: '%', ui: 'range', show: (P) => P.kind === 'hr' }),
    lineStyle: E('Kiểu nét', LINE_OPTS, { ui: 'seg', show: (P) => P.kind !== 'space' }),
    lineColor: C('Màu thanh', { show: (P) => P.kind !== 'space' }),
    space: N('Kích thước khoảng trống', 0, 600, { unit: 'px', show: (P) => P.kind === 'space' }),
    // ---- menu
    menuName: T('Tên menu', { max: 60, hint: 'Để chọn đúng menu cho nút “Mở menu”' }),
    mode: E('Loại menu', [['panel', 'Bảng nhỏ'], ['full', 'Toàn trang']], { ui: 'seg' }),
    anchor: E('Bảng hiện ở', [['below-left', 'Dưới nút · căn trái'], ['below-right', 'Dưới nút · căn phải'], ['above-left', 'Trên nút']], { show: (P) => P.mode === 'panel' }),
    panelW: N('Độ rộng bảng', 120, 900, { unit: 'px', show: (P) => P.mode === 'panel' }),
    dir: E('Xếp các mục', [['column', 'Dọc'], ['row', 'Ngang']], { ui: 'seg' }),
    effect: E('Hiệu ứng khi mở', [['fade', 'Hiện dần'], ['slide-down', 'Trượt xuống'], ['slide-right', 'Trượt từ phải']], { ui: 'seg' }),
    contentAlign: E('Vị trí các mục', [['center', 'Giữa màn hình'], ['top', 'Phía trên']], { ui: 'seg', show: (P) => P.mode === 'full' }),
    closeBtn: B('Có nút đóng ×', { show: (P) => P.mode === 'full' }),
    closeOutside: B('Đóng khi bấm ra ngoài menu'),
    closeOnItem: B('Đóng khi chọn một mục'),
    // ---- biểu mẫu
    label: T('Nhãn'),
    placeholder: T('Chữ gợi ý trong ô'),
    inputType: E('Loại dữ liệu', [['text', 'Chữ'], ['email', 'Email'], ['tel', 'Số điện thoại'], ['number', 'Số'], ['password', 'Mật khẩu'], ['date', 'Ngày'], ['textarea', 'Đoạn văn nhiều dòng']]),
    lineCount: N('Số dòng hiển thị', 2, 20, { show: (P) => P.inputType === 'textarea' }),
    required: B('Bắt buộc'),
    fieldName: { type: 'name', label: 'Tên trường khi gửi dữ liệu', placeholder: 'tự đặt theo nhãn', hint: 'Dành cho lập trình viên – để trống cũng được' },
    options: { type: 'lines', label: 'Các lựa chọn (mỗi dòng một lựa chọn)', rows: 4 },
    checked: B('Đánh dấu sẵn'),
    fieldBg: C('Màu nền ô'),
    fieldBorder: C('Màu viền ô'),
    fieldRadius: N('Bo góc ô', 0, 40, { unit: 'px' }),
  };
  PK.FIELDS = F;

  PK.PAGE_FIELDS = {
    name: T('Tên trang', { max: 80 }),
    path: { type: 'slug', label: 'Đường dẫn', hint: 'Địa chỉ của trang trong file xuất: …/#/duong-dan' },
    title: T('Tiêu đề trên tab trình duyệt', { max: 120, placeholder: 'mặc định: tên trang · tên dự án' }),
    bg: C('Màu nền trang'),
    bgImage: F.bgImage,
    bgSize: F.bgSize,
  };
  PK.THEME_FIELDS = {
    font: E('Font chữ chung', Object.entries(FONTS).map(([k, f]) => [k, f.name])),
    fontSize: N('Cỡ chữ cơ bản', 10, 28, { unit: 'px' }),
    color: C('Màu chữ chung'),
    primary: C('Màu chủ đạo', { hint: 'Màu mặc định của nút, dấu tích, viền ô đang nhập…' }),
  };
  const THEME_DEF = { font: 'system', fontSize: 16, color: '#0f172a', primary: '#2563eb' };
  const PAGE_DEF = { title: '', bg: '#ffffff', bgImage: '', bgSize: 'cover' };
  PK.THEME_DEF = THEME_DEF;
  PK.PAGE_DEF = PAGE_DEF;

  PK.optionsOf = function (f, type) {
    if (!f) return [];
    if (f.optionsFn) return f.optionsFn();
    return (f.byType && f.byType[type]) || f.options || [];
  };

  // ============================================================ THÀNH PHẦN
  const G = (id, title, keys, open) => ({ id, title, keys, open: !!open });
  const BG = G('bg', 'Nền', ['bg', 'bgImage', 'bgSize', 'bgOverlay']);
  const BOX = G('box', 'Viền, bo góc & bóng', ['borderW', 'borderColor', 'borderStyle', 'radius', 'shadow']);
  const SPACE = G('space', 'Khoảng cách', ['padY', 'padX', 'marginY', 'maxW']);
  const INNER = G('inner', 'Chữ bên trong', ['font', 'fontSize', 'color', 'align']);
  const TEXT = G('text', 'Chữ', ['font', 'fontSize', 'color', 'STYLE', 'align', 'lineHeight', 'letterSpacing'], true);
  const TBOX = G('tbox', 'Nền & khoảng cách', ['bg', 'radius', 'padY', 'padX', 'marginY', 'maxW']);
  const FX = G('fx', 'Hiệu ứng khi di chuột qua / khi bấm', ['FX']);
  const VIS = G('vis', 'Hiển thị', ['opacity', 'hideMobile', 'hideDesktop']);
  const MARGIN = G('space', 'Khoảng cách', ['marginY']);
  const FIELD_FMT = G('ffmt', 'Định dạng ô', ['fieldBg', 'fieldBorder', 'fieldRadius', 'color', 'fontSize']);

  const HSIZE = { 1: 40, 2: 32, 3: 26, 4: 21, 5: 18, 6: 16 };
  const FIELD_DEF = { fieldBg: '#ffffff', fieldBorder: '#cbd5e1', fieldRadius: 8 };

  function buttonDef(p, th) {
    const pr = th.primary || THEME_DEF.primary;
    const V = {
      solid: { bg: pr, color: readable(pr), borderW: 0, borderColor: pr },
      outline: { bg: 'transparent', color: pr, borderW: 2, borderColor: pr },
      soft: { bg: mix(pr, '#ffffff', 0.86), color: pr, borderW: 0, borderColor: pr },
      ghost: { bg: 'transparent', color: pr, borderW: 0, borderColor: pr },
    };
    const Z = { sm: { padY: 6, padX: 12, fontSize: 13 }, md: { padY: 10, padX: 20, fontSize: 15 }, lg: { padY: 14, padX: 28, fontSize: 17 } };
    return Object.assign(
      { text: 'Nút bấm', icon: '', iconPos: 'after', variant: 'solid', size: 'md', bold: true, radius: 8, align: 'center', widthMode: 'fit', width: 200, place: 'auto' },
      { action: 'link', linkKind: 'page', page: '', url: '', newTab: false, menu: '', submitKind: 'form', func: '', message: 'Đã gửi thành công!', hoverBg: 'auto', pressScale: 97 },
      V[p.variant] || V.solid,
      Z[p.size] || Z.md
    );
  }

  const TYPES = {
    section: {
      name: 'Khối trang', cat: 'layout', container: true,
      desc: 'Dải nội dung trải ngang trang: phần đầu, ảnh bìa, các mục nội dung, chân trang…',
      groups: [G('layout', 'Bố cục', ['tag', 'contentW', 'minH', 'gap', 'vAlign', 'sticky'], true), BG, INNER, SPACE, BOX, FX, VIS],
      def: () => ({ tag: 'section', contentW: 1100, minH: 0, gap: 16, vAlign: 'top', sticky: false, padY: 56, padX: 24 }),
    },
    row: {
      name: 'Hàng', cat: 'layout', container: true,
      desc: 'Xếp các thành phần bên trong thành hàng ngang, từ trái sang phải',
      groups: [G('layout', 'Bố cục', ['gap', 'vAlign', 'justify', 'wrap', 'stack', 'minH'], true), BG, SPACE, BOX, FX, VIS],
      def: () => ({ gap: 16, vAlign: 'center', justify: 'start', wrap: true, stack: true, minH: 0 }),
    },
    col: {
      name: 'Cột', cat: 'layout', container: true,
      desc: 'Xếp các thành phần bên trong theo chiều dọc. Đặt nhiều cột trong một Hàng để chia cột',
      groups: [G('layout', 'Bố cục', ['widthMode', 'width', 'gap', 'hAlign', 'vAlign', 'minH'], true), BG, INNER, SPACE, BOX, FX, VIS],
      def: () => ({ widthMode: 'auto', width: 50, gap: 12, hAlign: 'stretch', vAlign: 'top', minH: 0 }),
    },
    heading: {
      name: 'Tiêu đề', cat: 'content', textual: true,
      desc: 'Tiêu đề lớn / nhỏ (H1–H6)',
      groups: [G('content', 'Nội dung', ['text', 'level'], true), TEXT, TBOX, FX, VIS],
      def: (p) => ({ text: 'Tiêu đề', level: '2', bold: true, lineHeight: 1.25, fontSize: HSIZE[p.level] || 32 }),
    },
    text: {
      name: 'Đoạn văn', cat: 'content', textual: true,
      desc: 'Đoạn chữ thường, xuống dòng được',
      groups: [G('content', 'Nội dung', ['text'], true), TEXT, TBOX, FX, VIS],
      def: () => ({ text: 'Viết nội dung đoạn văn ở đây. Nhấn đúp để sửa trực tiếp trên trang.', lineHeight: 1.6 }),
    },
    button: {
      name: 'Nút bấm', cat: 'content', textual: true,
      desc: 'Nút để chuyển trang, mở menu hoặc gửi biểu mẫu / chạy chức năng',
      groups: [
        G('content', 'Nội dung', ['text', 'icon', 'iconPos'], true),
        G('format', 'Định dạng', ['variant', 'size', 'bg', 'color', 'borderW', 'borderColor', 'borderStyle', 'font', 'fontSize', 'STYLE', 'letterSpacing', 'align', 'widthMode', 'width', 'place', 'padY', 'padX', 'radius', 'shadow'], true),
        G('action', 'Loại nút – khi bấm', ['action', 'linkKind', 'page', 'url', 'newTab', 'menu', 'submitKind', 'func', 'message'], true),
        G('fx', 'Hiệu ứng khi di chuột qua / khi bấm', ['FX']),
        MARGIN,
        VIS,
      ],
      def: buttonDef,
    },
    image: {
      name: 'Ảnh', cat: 'content',
      desc: 'Ảnh từ địa chỉ web hoặc tải lên từ máy',
      groups: [G('img', 'Ảnh', ['src', 'alt'], true), G('size', 'Kích thước', ['widthMode', 'width', 'height', 'fit', 'place'], true), BOX, MARGIN, FX, VIS],
      def: () => ({ src: '', alt: '', widthMode: 'full', width: 100, height: 0, fit: 'cover', place: 'center', radius: 8 }),
    },
    list: {
      name: 'Danh sách', cat: 'content', textual: true,
      desc: 'Danh sách gạch đầu dòng, đánh số hoặc dấu tích',
      groups: [G('content', 'Nội dung', ['items', 'marker', 'gap'], true), TEXT, TBOX, VIS],
      def: () => ({ items: ['Mục thứ nhất', 'Mục thứ hai', 'Mục thứ ba'], marker: 'disc', gap: 6, lineHeight: 1.6 }),
    },
    table: {
      name: 'Bảng', cat: 'data',
      desc: 'Bảng dữ liệu nhiều hàng, nhiều cột',
      groups: [
        G('data', 'Dữ liệu', ['rows', 'header', 'firstColBold'], true),
        G('tfmt', 'Định dạng bảng', ['lines', 'borderColor', 'striped', 'stripeColor', 'hoverRow', 'hoverRowColor', 'headBg', 'headColor', 'cellPad', 'full'], true),
        G('text', 'Chữ', ['font', 'fontSize', 'color', 'align']),
        G('box', 'Bo góc & khoảng cách', ['radius', 'shadow', 'marginY']),
        VIS,
      ],
      def: () => ({
        rows: [['Họ tên', 'Vai trò', 'Trạng thái'], ['Nguyễn An', 'Quản trị', 'Hoạt động'], ['Trần Bình', 'Biên tập', 'Tạm nghỉ']],
        header: true, firstColBold: false, lines: 'rows', borderColor: '#e2e8f0', striped: false, stripeColor: '#f8fafc',
        hoverRow: true, hoverRowColor: '#eff6ff', headBg: '#f1f5f9', headColor: '#0f172a', cellPad: 'md', full: true, radius: 8, align: 'left',
      }),
    },
    divider: {
      name: 'Ngăn cách', cat: 'divider',
      desc: 'Thanh ngang, thanh dọc hoặc khoảng trống',
      groups: [G('div', 'Ngăn cách', ['kind', 'thickness', 'length', 'lineStyle', 'lineColor', 'space'], true), MARGIN, VIS],
      def: () => ({ kind: 'hr', thickness: 1, length: 100, lineStyle: 'solid', lineColor: '#e2e8f0', space: 32, marginY: 8 }),
    },
    menu: {
      name: 'Menu', cat: 'nav', container: true,
      desc: 'Bảng nhỏ hoặc menu phủ toàn trang, chỉ hiện khi bấm một nút có loại “Mở menu”',
      groups: [
        G('menu', 'Menu', ['menuName', 'mode', 'anchor', 'panelW', 'dir', 'gap', 'effect', 'contentAlign', 'closeBtn', 'closeOutside', 'closeOnItem'], true),
        BG,
        G('box', 'Bo góc, viền & bóng', ['radius', 'borderW', 'borderColor', 'borderStyle', 'shadow']),
        INNER,
        G('space', 'Khoảng đệm', ['padY', 'padX']),
      ],
      def: (p) =>
        Object.assign(
          { menuName: 'Menu', mode: 'panel', anchor: 'below-left', panelW: 240, dir: 'column', gap: 4, effect: 'fade', contentAlign: 'center', closeBtn: true, closeOutside: true, closeOnItem: true },
          p.mode === 'full'
            ? { bg: '#0f172a', color: '#ffffff', radius: 0, shadow: 'none', padY: 72, padX: 24, borderW: 0, fontSize: 20, gap: 12 }
            : { bg: '#ffffff', radius: 12, shadow: 'lg', padY: 8, padX: 8, borderW: 1, borderColor: '#e2e8f0' }
        ),
    },
    form: {
      name: 'Biểu mẫu', cat: 'form', container: true,
      desc: 'Khung chứa các ô nhập và nút gửi',
      groups: [G('submit', 'Khi gửi biểu mẫu', ['submitKind', 'message', 'url', 'method', 'func'], true), G('layout', 'Bố cục', ['gap'], true), BG, SPACE, BOX, VIS],
      def: () => ({ submitKind: 'alert', message: 'Cảm ơn bạn! Thông tin đã được gửi.', url: '', method: 'post', func: '', gap: 14 }),
    },
    input: {
      name: 'Ô nhập', cat: 'form',
      desc: 'Ô nhập chữ, email, số điện thoại, ngày… có nhãn',
      groups: [G('field', 'Ô nhập', ['label', 'placeholder', 'inputType', 'lineCount', 'required', 'fieldName'], true), FIELD_FMT, G('space', 'Khoảng cách', ['marginY', 'maxW']), VIS],
      def: () => Object.assign({ label: 'Họ và tên', placeholder: '', inputType: 'text', lineCount: 4, required: false, fieldName: '' }, FIELD_DEF),
    },
    select: {
      name: 'Hộp chọn', cat: 'form',
      desc: 'Danh sách thả xuống để chọn một giá trị',
      groups: [G('field', 'Hộp chọn', ['label', 'options', 'required', 'fieldName'], true), FIELD_FMT, G('space', 'Khoảng cách', ['marginY', 'maxW']), VIS],
      def: () => Object.assign({ label: 'Lựa chọn', options: ['Lựa chọn 1', 'Lựa chọn 2', 'Lựa chọn 3'], required: false, fieldName: '' }, FIELD_DEF),
    },
    checkbox: {
      name: 'Ô đánh dấu', cat: 'form',
      desc: 'Ô tích chọn có nhãn (đồng ý điều khoản, nhận tin…)',
      groups: [G('field', 'Ô đánh dấu', ['label', 'checked', 'required', 'fieldName'], true), G('ffmt', 'Chữ', ['color', 'fontSize']), MARGIN, VIS],
      def: () => ({ label: 'Tôi đồng ý với điều khoản sử dụng', checked: false, required: false, fieldName: '' }),
    },
  };
  const STYLE_KEYS = ['bold', 'italic', 'underline', 'upper'];
  const FX_KEYS = Object.keys(fxFields('hover')).concat(Object.keys(fxFields('press')), ['speed']);
  PK.STYLE_KEYS = STYLE_KEYS;
  PK.FX_KEYS = FX_KEYS;
  for (const t of Object.values(TYPES)) {
    t.keys = new Set();
    for (const g of t.groups)
      for (const k of g.keys) {
        if (k === 'STYLE') STYLE_KEYS.forEach((x) => t.keys.add(x));
        else if (k === 'FX') FX_KEYS.forEach((x) => t.keys.add(x));
        else t.keys.add(k);
      }
  }
  PK.TYPES = TYPES;
  PK.isContainer = (type) => type === 'page' || !!(TYPES[type] && TYPES[type].container);

  const COMMON_DEF = {
    opacity: 100, borderW: 0, borderStyle: 'solid', radius: 0, shadow: 'none', padY: 0, padX: 0, marginY: 0, maxW: 0,
    bgSize: 'cover', bgOverlay: 0, speed: 'normal', hideMobile: false, hideDesktop: false,
    bold: false, italic: false, underline: false, upper: false, letterSpacing: 0,
  };
  /** Thuộc tính đầy đủ (mặc định + giá trị người dùng). null = người dùng tắt hẳn */
  PK.resolve = function (n, theme) {
    const t = TYPES[n.type];
    const props = n.props || {};
    return Object.assign({}, COMMON_DEF, t ? t.def(props, theme || THEME_DEF) : {}, props);
  };
  /** Giá trị mặc định của một thuộc tính (để hiện "mặc định" và nút ↺) */
  PK.defaultOf = function (n, key, theme) {
    const t = TYPES[n.type];
    const base = Object.assign({}, COMMON_DEF, t ? t.def(n.props || {}, theme || THEME_DEF) : {});
    return base[key];
  };
  PK.resolvePage = (pg) => Object.assign({}, PAGE_DEF, pg.props || {});
  PK.resolveTheme = (th) => Object.assign({}, THEME_DEF, th || {});

  // ============================================================ LỌC GIÁ TRỊ
  const BAD = { ok: false };
  const ok = (v) => ({ ok: true, v });
  // eslint-disable-next-line no-control-regex
  const cleanStr = (s, max) => String(s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
  /** Kiểm tra & chuẩn hoá giá trị của một thuộc tính. field: định nghĩa trường (mặc định lấy theo key) */
  PK.cleanValue = function (key, v, type, field) {
    const f = field || F[key];
    if (!f) return BAD;
    if (v === null) return f.opt ? ok(null) : BAD;
    switch (f.type) {
      case 'num': {
        const x = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
        if (!isFinite(x)) return BAD;
        let y = DE.clamp(x, f.min, f.max);
        y = f.step < 1 ? Math.round(y / f.step) * f.step : Math.round(y);
        return ok(Math.round(y * 100) / 100);
      }
      case 'color':
        if (v === 'auto' && f.auto) return ok('auto');
        return isColor(v) ? ok(v.trim().toLowerCase()) : BAD;
      case 'enum': {
        const s = String(v);
        return PK.optionsOf(f, type).some((o) => o[0] === s) ? ok(s) : BAD;
      }
      case 'bool':
        if (typeof v === 'boolean') return ok(v);
        if (v === 'true' || v === 1) return ok(true);
        if (v === 'false' || v === 0) return ok(false);
        return BAD;
      case 'text':
      case 'area':
        if (typeof v === 'number') v = String(v);
        return typeof v === 'string' ? ok(cleanStr(v, f.max || 2000)) : BAD;
      case 'url': {
        const u = PK.safeUrl(v);
        return u == null ? BAD : ok(u);
      }
      case 'image': {
        const u = PK.safeImage(v);
        return u == null ? BAD : ok(u);
      }
      case 'ident':
        if (v === '') return ok('');
        return typeof v === 'string' && v.length <= 80 && /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*){0,4}$/.test(v) ? ok(v) : BAD;
      case 'name':
        if (v === '') return ok('');
        return typeof v === 'string' && /^[A-Za-z0-9_.[\]-]{1,60}$/.test(v) ? ok(v) : BAD;
      case 'slug': {
        const s = PK.slug(v);
        return s ? ok(s) : BAD;
      }
      case 'page':
      case 'menu':
        return typeof v === 'string' && v.length <= 80 ? ok(v.trim()) : BAD;
      case 'lines': {
        let a = v;
        if (typeof a === 'string') a = a.split('\n');
        if (!Array.isArray(a)) return BAD;
        return ok(a.slice(0, 300).map((x) => cleanStr(x == null ? '' : typeof x === 'object' ? JSON.stringify(x) : x, 500)));
      }
      case 'table': {
        if (!Array.isArray(v)) return BAD;
        const rows = v.slice(0, 300).map((r) => (Array.isArray(r) ? r : [r]).slice(0, 30).map((c) => cleanStr(c == null ? '' : typeof c === 'object' ? JSON.stringify(c) : c, 1000)));
        const w = Math.max(1, ...rows.map((r) => r.length));
        rows.forEach((r) => {
          while (r.length < w) r.push('');
        });
        return ok(rows.length ? rows : [['']]);
      }
    }
    return BAD;
  };

  // ============================================================ CHUẨN HOÁ DỰ ÁN
  const show = (v) => {
    const s = typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) || String(v);
    return s.length > 60 ? s.slice(0, 57) + '…' : s;
  };
  const RESERVED_ID = /^(pg-|m-|fx-|is-)|^open$/i;

  /**
   * Chuẩn hoá dữ liệu bất kỳ thành dự án hợp lệ.
   * Nhận: dự án đầy đủ { pages:[…] } · một trang { children:[…] } · mảng thành phần.
   * Trả: { proj, fixed:[…], removed:[…] }. Ném lỗi nếu không nhận ra được.
   */
  PK.normalize = function (raw) {
    const fixed = [], removed = [];
    let src = raw;
    if (typeof src === 'string') src = JSON.parse(src);
    if (Array.isArray(src)) src = { pages: [{ name: 'Trang chủ', children: src }] };
    else if (src && typeof src === 'object' && !Array.isArray(src.pages) && Array.isArray(src.children)) src = { name: src.projectName, pages: [src] };
    if (!src || typeof src !== 'object' || !Array.isArray(src.pages)) throw new Error('Không phải dữ liệu thiết kế trang (cần trường "pages")');
    const proj = {
      kind: 'de-page',
      version: 1,
      name: typeof src.name === 'string' && src.name.trim() ? cleanStr(src.name.trim(), 120) : 'Trang web của tôi',
      theme: {},
      pages: [],
      script: typeof src.script === 'string' ? src.script.slice(0, 100000) : '',
    };
    const th = src.theme && typeof src.theme === 'object' ? src.theme : {};
    for (const [k, f] of Object.entries(PK.THEME_FIELDS)) {
      if (th[k] === undefined) continue;
      const r = PK.cleanValue(k, th[k], 'theme', f);
      if (r.ok) proj.theme[k] = r.v;
      else fixed.push(`Giao diện chung: "${k}" = ${show(th[k])} không hợp lệ → bỏ`);
    }
    proj.theme = Object.assign({}, THEME_DEF, proj.theme);

    const ids = new Set();
    let count = 0;
    const newId = (p) => {
      let id;
      do id = DE.uid(p);
      while (ids.has(id));
      ids.add(id);
      return id;
    };
    const takeId = (id, p) => {
      if (typeof id === 'string' && /^[A-Za-z][\w-]{0,47}$/.test(id) && !RESERVED_ID.test(id) && !ids.has(id)) {
        ids.add(id);
        return id;
      }
      return newId(p);
    };

    function cleanNode(n, where, depth, inForm, inMenu) {
      if (!n || typeof n !== 'object' || Array.isArray(n)) {
        removed.push(`${where}: không phải thành phần`);
        return null;
      }
      let type = n.type;
      const T0 = TYPES[type];
      if (!T0) {
        removed.push(`${where}: loại "${String(type).slice(0, 30)}" không có – bỏ`);
        return null;
      }
      if (++count > 5000) {
        if (count === 5001) removed.push('Quá 5000 thành phần – bỏ phần còn lại');
        return null;
      }
      // biểu mẫu lồng biểu mẫu / menu lồng menu -> đổi thành cột
      if ((type === 'form' && inForm) || (type === 'menu' && inMenu)) {
        fixed.push(`${where}: ${T0.name} không được lồng trong ${T0.name.toLowerCase()} khác → đổi thành Cột`);
        type = 'col';
      }
      const T = TYPES[type];
      const out = { id: takeId(n.id, 'c'), type };
      if (n.id != null && n.id !== out.id) fixed.push(`${where}: id ${show(n.id)} trùng hoặc không hợp lệ → "${out.id}"`);
      if (typeof n.name === 'string' && n.name.trim()) out.name = cleanStr(n.name.trim(), 80);
      const rawProps = Object.assign({}, n.props && typeof n.props === 'object' && !Array.isArray(n.props) ? n.props : {});
      // AI hay ghi thuộc tính ngay trên thành phần (vd "text": "…") -> gom vào props
      for (const k of Object.keys(n)) if (!['id', 'type', 'name', 'props', 'children'].includes(k) && T.keys.has(k) && !(k in rawProps)) rawProps[k] = n[k];
      const props = {};
      for (const [k, v] of Object.entries(rawProps)) {
        if (v === undefined) continue;
        if (!T.keys.has(k)) {
          fixed.push(`${where}: bỏ thuộc tính "${k}" (${T.name} không dùng)`);
          continue;
        }
        const r = PK.cleanValue(k, v, type);
        if (r.ok) props[k] = r.v;
        else fixed.push(`${where}: "${k}" = ${show(v)} không hợp lệ → bỏ`);
      }
      out.props = props;
      if (T.container) {
        out.children = [];
        const kids = Array.isArray(n.children) ? n.children : [];
        if (depth >= 40 && kids.length) removed.push(`${where}: lồng quá sâu – bỏ ${kids.length} thành phần con`);
        else
          kids.forEach((c, i) => {
            const cn = cleanNode(c, `${where} › ${(TYPES[c && c.type] || { name: '?' }).name} ${i + 1}`, depth + 1, inForm || type === 'form', inMenu || type === 'menu');
            if (cn) out.children.push(cn);
          });
      } else if (Array.isArray(n.children) && n.children.length) fixed.push(`${where}: ${T.name} không chứa được thành phần con → bỏ ${n.children.length} con`);
      return out;
    }

    const paths = new Set();
    src.pages.slice(0, 60).forEach((pg, i) => {
      if (!pg || typeof pg !== 'object') return removed.push(`Trang ${i + 1}: không hợp lệ`);
      const name = typeof pg.name === 'string' && pg.name.trim() ? cleanStr(pg.name.trim(), 80) : `Trang ${i + 1}`;
      const page = { id: takeId(pg.id, 'p'), name, path: '', props: {}, children: [] };
      let path = PK.slug(pg.path || (i === 0 ? 'index' : name)) || 'trang';
      if (paths.has(path)) {
        let k = 2;
        while (paths.has(`${path}-${k}`)) k++;
        fixed.push(`Trang "${name}": đường dẫn "${path}" bị trùng → "${path}-${k}"`);
        path = `${path}-${k}`;
      }
      paths.add(path);
      page.path = path;
      const pp = Object.assign({}, pg.props && typeof pg.props === 'object' ? pg.props : {});
      for (const k of ['title', 'bg', 'bgImage', 'bgSize']) if (pp[k] === undefined && pg[k] !== undefined) pp[k] = pg[k];
      for (const [k, v] of Object.entries(pp)) {
        const f = PK.PAGE_FIELDS[k];
        if (!f || k === 'name' || k === 'path') continue;
        const r = PK.cleanValue(k, v, 'page', f);
        if (r.ok) page.props[k] = r.v;
        else fixed.push(`Trang "${name}": "${k}" = ${show(v)} không hợp lệ → bỏ`);
      }
      (Array.isArray(pg.children) ? pg.children : []).forEach((c, j) => {
        const cn = cleanNode(c, `Trang "${name}" › ${(TYPES[c && c.type] || { name: '?' }).name} ${j + 1}`, 1, false, false);
        if (cn) page.children.push(cn);
      });
      proj.pages.push(page);
    });
    if (!proj.pages.length) proj.pages.push({ id: newId('p'), name: 'Trang chủ', path: 'index', props: {}, children: [] });
    fixRefs(proj, fixed);
    return { proj, fixed, removed };
  };

  /** Tham chiếu trang / menu: chấp nhận id, đường dẫn hoặc tên (AI hay dùng) -> đổi về id; không tìm thấy -> bỏ */
  function fixRefs(proj, fixed) {
    const menus = PK.menus(proj);
    PK.walkProject(proj, (n, parent, page) => {
      const p = n.props;
      if (n.type !== 'button') return;
      if (p.page) {
        const pg = proj.pages.find((x) => x.id === p.page) || proj.pages.find((x) => x.path === PK.slug(p.page) || x.name === p.page);
        if (pg) p.page = pg.id;
        else {
          fixed.push(`Trang "${page.name}" › nút "${(p.text || '').slice(0, 30)}": không có trang ${show(p.page)} → bỏ`);
          delete p.page;
        }
      }
      if (p.menu) {
        const m = menus.find((x) => x.id === p.menu) || menus.find((x) => x.name.toLowerCase() === String(p.menu).toLowerCase());
        if (m) p.menu = m.id;
        else {
          fixed.push(`Trang "${page.name}" › nút "${(p.text || '').slice(0, 30)}": không có menu ${show(p.menu)} → bỏ`);
          delete p.menu;
        }
      }
    });
  }

  // ============================================================ DUYỆT CÂY
  PK.walk = function walk(list, fn, parent = null, depth = 0) {
    for (const n of list || []) {
      if (fn(n, parent, depth) === false) return false;
      if (n.children && walk(n.children, fn, n, depth + 1) === false) return false;
    }
    return true;
  };
  PK.walkProject = (proj, fn) => proj.pages.forEach((pg) => PK.walk(pg.children, (n, parent, depth) => fn(n, parent, pg, depth)));
  /** Tìm thành phần trong dự án: { node, parent (null = gốc trang), list, index, page } */
  PK.find = function (proj, id) {
    let hit = null;
    for (const page of proj.pages) {
      const look = (list, parent) => {
        for (let i = 0; i < list.length; i++) {
          const n = list[i];
          if (n.id === id) {
            hit = { node: n, parent, list, index: i, page };
            return true;
          }
          if (n.children && look(n.children, n)) return true;
        }
        return false;
      };
      if (look(page.children, null)) break;
    }
    return hit;
  };
  /** Danh sách menu: [{ id, name, page }] */
  PK.menus = function (proj) {
    const out = [];
    PK.walkProject(proj, (n, parent, page) => {
      if (n.type === 'menu') out.push({ id: n.id, name: (n.props && n.props.menuName) || 'Menu', page });
    });
    return out;
  };
  /** Sao chép thành phần với id mới; tham chiếu menu bên trong bản sao trỏ sang menu mới */
  PK.cloneFresh = function (nodes) {
    const map = {};
    const copy = (n) => {
      const c = { id: DE.uid('c'), type: n.type, props: DE.clone(n.props || {}) };
      if (n.name) c.name = n.name;
      map[n.id] = c.id;
      if (n.children) c.children = n.children.map(copy);
      return c;
    };
    const out = nodes.map(copy);
    PK.walk(out, (n) => {
      if (n.props.menu && map[n.props.menu]) n.props.menu = map[n.props.menu];
    });
    return out;
  };
  /** Tạo thành phần mới (props = giá trị khác mặc định) */
  const mk = (type, props = {}, children) => {
    const n = { id: DE.uid('c'), type, props };
    if (TYPES[type].container) n.children = children || [];
    return n;
  };
  PK.mk = mk;
  PK.pageTitle = (proj, pg) => (pg.props && pg.props.title) || (proj.pages[0] === pg ? proj.name : `${pg.name} · ${proj.name}`);

  // ============================================================ SINH CSS
  const px = (v) => DE.f(v) + 'px';
  const decl = (o) =>
    Object.entries(o)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}:${v}`)
      .join(';');
  const VA = { top: 'flex-start', center: 'center', bottom: 'flex-end', between: 'space-between', stretch: 'stretch' };
  const HA = { stretch: 'stretch', start: 'flex-start', center: 'center', end: 'flex-end' };
  const JU = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between', around: 'space-around' };
  const PLACE = { start: 'flex-start', center: 'center', end: 'flex-end' };
  const TXT = { left: 'flex-start', center: 'center', right: 'flex-end', justify: 'center' };
  const CELL_PAD = { sm: '6px 10px', md: '10px 14px', lg: '14px 20px' };

  function bgImage(P) {
    const o = P.bgOverlay > 0 ? P.bgOverlay / 100 : 0;
    return (o ? `linear-gradient(rgba(0,0,0,${o}),rgba(0,0,0,${o})),` : '') + cssUrl(P.bgImage);
  }

  /** Vị trí theo chiều ngang của nút / ảnh trong khung chứa dọc */
  function selfAlign(P, c) {
    if (c.inRow) return null;
    if (P.place && P.place !== 'auto') return PLACE[P.place];
    if (c.parentType === 'menu') return null; // theo cách xếp của menu (toàn trang: căn giữa · bảng nhỏ: giãn hết)
    if (c.parentType === 'col' && c.parentP.hAlign && c.parentP.hAlign !== 'stretch') return null; // theo cột
    const a = c.parentP && c.parentP.align;
    return a === 'center' ? 'center' : a === 'right' ? 'flex-end' : 'flex-start';
  }

  function fxDecl(P, pre, baseBg, theme) {
    const d = {};
    const bg = P[pre + 'Bg'];
    if (bg) d['background-color'] = bg === 'auto' ? autoTint(baseBg, theme, pre === 'press') : bg;
    if (P[pre + 'Color']) d.color = P[pre + 'Color'];
    if (P[pre + 'Border']) d['border-color'] = P[pre + 'Border'];
    const tr = [];
    const lift = P[pre + 'Lift'], scale = P[pre + 'Scale'];
    if (lift != null && lift !== 0) tr.push(`translateY(${-lift}px)`);
    if (scale != null && scale !== 100) tr.push(`scale(${scale / 100})`);
    if (tr.length) d.transform = tr.join(' ');
    if (P[pre + 'Shadow']) d['box-shadow'] = SHADOWS[P[pre + 'Shadow']];
    if (P[pre + 'Opacity'] != null) d.opacity = P[pre + 'Opacity'] / 100;
    return d;
  }

  function nodeCSS(n, P, ctx, c) {
    const t = n.type, K = TYPES[t].keys, sel = '.' + n.id;
    const d = {};
    const rules = [];
    // ---- nền
    if (K.has('bg') && P.bg && P.bg !== 'transparent') d['background-color'] = P.bg;
    if (K.has('bgImage') && P.bgImage) {
      d['background-image'] = bgImage(P);
      if (P.bgSize === 'repeat') d['background-repeat'] = 'repeat';
      else Object.assign(d, { 'background-size': P.bgSize, 'background-position': 'center', 'background-repeat': 'no-repeat' });
    }
    // ---- chữ
    if (K.has('color') && P.color) d.color = P.color;
    if (K.has('font') && P.font && FONTS[P.font]) d['font-family'] = FONTS[P.font].css;
    if (K.has('fontSize') && P.fontSize) d['font-size'] = px(P.fontSize);
    if (K.has('bold')) d['font-weight'] = P.bold ? 700 : 400;
    if (K.has('italic') && P.italic) d['font-style'] = 'italic';
    if (K.has('underline') && P.underline) d['text-decoration'] = 'underline';
    if (K.has('upper') && P.upper) d['text-transform'] = 'uppercase';
    if (K.has('letterSpacing') && P.letterSpacing) d['letter-spacing'] = px(P.letterSpacing);
    if (K.has('lineHeight') && P.lineHeight) d['line-height'] = P.lineHeight;
    if (K.has('align') && P.align) d['text-align'] = P.align;
    // ---- khoảng cách
    if ((K.has('padY') || K.has('padX')) && (P.padY || P.padX)) d.padding = `${px(P.padY || 0)} ${px(P.padX || 0)}`;
    if (K.has('marginY') && P.marginY) d['margin-top'] = d['margin-bottom'] = px(P.marginY);
    if (K.has('maxW') && P.maxW > 0) {
      d['max-width'] = px(P.maxW);
      if (P.align === 'center') d['margin-left'] = d['margin-right'] = 'auto';
    }
    // ---- viền, góc, bóng, độ rõ
    if (K.has('borderW') && P.borderW > 0) d.border = `${px(P.borderW)} ${P.borderStyle || 'solid'} ${P.borderColor || 'currentColor'}`;
    if (K.has('radius') && P.radius > 0) d['border-radius'] = px(P.radius);
    if (K.has('shadow') && P.shadow && P.shadow !== 'none') d['box-shadow'] = SHADOWS[P.shadow];
    if (K.has('opacity') && P.opacity < 100) d.opacity = P.opacity / 100;

    // ---- theo loại
    switch (t) {
      case 'section': {
        d['justify-content'] = VA[P.vAlign] || 'flex-start';
        d.gap = px(P.gap);
        if (P.minH > 0) d['min-height'] = px(P.minH);
        const py = px(P.padY || 0), pxx = px(P.padX || 0);
        d.padding = P.contentW > 0 ? `${py} max(${pxx}, calc((100% - ${px(P.contentW)}) / 2))` : `${py} ${pxx}`;
        if (P.sticky) Object.assign(d, { position: 'sticky', top: 0, 'z-index': 50 });
        break;
      }
      case 'row':
        Object.assign(d, { 'flex-wrap': P.wrap ? 'wrap' : 'nowrap', gap: px(P.gap), 'align-items': VA[P.vAlign] || 'center', 'justify-content': JU[P.justify] || 'flex-start' });
        if (P.minH > 0) d['min-height'] = px(P.minH);
        if (P.stack)
          rules.push(
            `@media (max-width:${MOBILE}px){${sel}{flex-direction:column;align-items:stretch;flex-wrap:nowrap}` +
              `${sel}>*{flex:0 0 auto!important;max-width:100%}${sel}>.pg-col{width:100%!important}${sel}>.pg-vr{display:none}}`
          );
        break;
      case 'col': {
        Object.assign(d, { gap: px(P.gap), 'align-items': HA[P.hAlign] || 'stretch', 'justify-content': VA[P.vAlign] || 'flex-start' });
        if (P.minH > 0) d['min-height'] = px(P.minH);
        const w = Math.min(P.width, P.widthMode === 'percent' ? 100 : 4000);
        if (c.inRow) {
          if (P.widthMode === 'fit') d.flex = '0 0 auto';
          else if (P.widthMode === 'percent') Object.assign(d, { flex: `0 1 ${w}%`, 'min-width': 0 });
          else if (P.widthMode === 'fixed') Object.assign(d, { flex: `0 0 ${px(w)}`, 'max-width': '100%' });
          else Object.assign(d, { flex: '1 1 0', 'min-width': 0 });
        } else if (P.widthMode === 'fit') d['align-self'] = 'flex-start';
        else if (P.widthMode === 'percent') d.width = w + '%';
        else if (P.widthMode === 'fixed') Object.assign(d, { width: px(w), 'max-width': '100%' });
        break;
      }
      case 'button': {
        d['background-color'] = P.bg && P.bg !== 'transparent' ? P.bg : 'transparent';
        d.border = P.borderW > 0 ? `${px(P.borderW)} ${P.borderStyle || 'solid'} ${P.borderColor || 'currentColor'}` : '0';
        d['justify-content'] = TXT[P.align] || 'center';
        if (P.widthMode === 'full') {
          if (c.inRow) d.flex = '1 1 auto';
          else d['align-self'] = 'stretch';
        } else {
          if (P.widthMode === 'fixed') Object.assign(d, { width: px(P.width), 'max-width': '100%' });
          const a = selfAlign(P, c);
          if (a) d['align-self'] = a;
        }
        break;
      }
      case 'image': {
        if (P.widthMode === 'percent') d.width = Math.min(100, P.width) + '%';
        else if (P.widthMode === 'fixed') d.width = px(P.width);
        else d.width = '100%';
        if (P.height > 0) Object.assign(d, { height: px(P.height), 'object-fit': P.fit, 'aspect-ratio': 'auto' });
        else if (n.props && n.props.src) d.height = 'auto';
        if (P.widthMode !== 'full') {
          const a = selfAlign(P, c);
          if (a) d['align-self'] = a;
        }
        break;
      }
      case 'list':
        d.gap = px(P.gap);
        break;
      case 'table': {
        const bc = P.borderColor || '#e2e8f0';
        if (P.lines === 'all') d.border = `1px solid ${bc}`;
        rules.push(`${sel} table{width:${P.full ? '100%' : 'auto'}}`);
        rules.push(`${sel} th,${sel} td{padding:${CELL_PAD[P.cellPad] || CELL_PAD.md};text-align:${P.align || 'left'};vertical-align:top}`);
        if (P.lines === 'all') rules.push(`${sel} th,${sel} td{border-right:1px solid ${bc};border-bottom:1px solid ${bc}}${sel} tr>:last-child{border-right:0}${sel} tbody tr:last-child>*{border-bottom:0}`);
        else if (P.lines === 'rows') rules.push(`${sel} th,${sel} td{border-bottom:1px solid ${bc}}${sel} tbody tr:last-child>*{border-bottom:0}`);
        if (P.header) rules.push(`${sel} th{background:${P.headBg && P.headBg !== 'transparent' ? P.headBg : 'transparent'};color:${P.headColor || 'inherit'};font-weight:600}`);
        if (P.striped) rules.push(`${sel} tbody tr:nth-child(even)>*{background:${P.stripeColor}}`);
        if (P.hoverRow) rules.push(`${sel} tbody tr:hover>*{background:${P.hoverRowColor}}`);
        if (P.firstColBold) rules.push(`${sel} td:first-child{font-weight:600}`);
        break;
      }
      case 'divider': {
        const line = `${px(P.thickness)} ${P.lineStyle} ${P.lineColor}`;
        if (P.kind === 'hr') Object.assign(d, { 'border-top': line, width: P.length + '%' });
        else if (P.kind === 'vr') {
          d['border-left'] = line;
          if (c.inRow) {
            delete d['margin-top'];
            delete d['margin-bottom'];
            if (P.marginY) d['margin-left'] = d['margin-right'] = px(P.marginY);
          } else Object.assign(d, { 'min-height': '2em', 'align-self': 'center' });
        } else {
          delete d['margin-top'];
          delete d['margin-bottom'];
          if (c.inRow) d.width = px(P.space);
          else d.height = px(P.space);
        }
        break;
      }
      case 'menu': {
        Object.assign(d, { 'flex-direction': P.dir, gap: px(P.gap) });
        if (P.dir === 'row') Object.assign(d, { 'align-items': 'center', 'flex-wrap': 'wrap' });
        else d['align-items'] = P.mode === 'full' ? 'center' : 'stretch';
        if (P.mode === 'panel') Object.assign(d, { width: px(P.panelW), 'max-width': ctx.edit ? '100%' : 'calc(100vw - 16px)' });
        else d['justify-content'] = P.dir === 'column' ? (P.contentAlign === 'top' ? 'flex-start' : 'center') : 'center';
        break;
      }
      case 'form':
        d.gap = px(P.gap);
        break;
      case 'input':
      case 'select':
        rules.push(`${sel} input,${sel} textarea,${sel} select{background:${P.fieldBg};border-color:${P.fieldBorder};border-radius:${px(P.fieldRadius)}}`);
        break;
    }

    // ---- hiệu ứng khi di chuột qua / khi bấm
    if (K.has('hoverBg')) {
      const baseBg = d['background-color'] || 'transparent';
      const h = fxDecl(P, 'hover', baseBg, ctx.theme), pr = fxDecl(P, 'press', baseBg, ctx.theme);
      if (Object.keys(h).length || Object.keys(pr).length) {
        const s = SPEED[P.speed] || SPEED.normal;
        d.transition = ['background-color', 'color', 'border-color', 'transform', 'box-shadow', 'opacity'].map((p) => `${p} ${s}`).join(',');
      }
      if (Object.keys(h).length) rules.push(`${sel}:hover,${sel}.is-hover{${decl(h)}}`);
      if (Object.keys(pr).length) rules.push(`${sel}:active,${sel}.is-press{${decl(pr)}}`);
    }
    // ---- hiển thị theo thiết bị
    if (P.hideMobile) rules.push(`@media (max-width:${MOBILE}px){${sel}{display:none!important}}`);
    if (P.hideDesktop) rules.push(`@media (min-width:${MOBILE + 1}px){${sel}{display:none!important}}`);
    rules.unshift(`${sel}{${decl(d)}}`);
    return rules;
  }

  function themeCSS(theme) {
    const th = PK.resolveTheme(theme);
    return `:root{--pg-font:${(FONTS[th.font] || FONTS.system).css};--pg-size:${px(th.fontSize)};--pg-color:${th.color};--pg-primary:${th.primary}}`;
  }
  function pageCSS(pg) {
    const P = PK.resolvePage(pg);
    const d = { 'background-color': P.bg };
    if (P.bgImage) {
      d['background-image'] = cssUrl(P.bgImage);
      if (P.bgSize === 'repeat') d['background-repeat'] = 'repeat';
      else Object.assign(d, { 'background-size': P.bgSize, 'background-position': 'center top', 'background-repeat': 'no-repeat' });
    }
    return `.${pg.id}{${decl(d)}}`;
  }

  // ============================================================ SINH HTML
  const txt = (s) => esc(s).replace(/\n/g, '<br>');
  const autoName = (label) => PK.slug(label, 40).replace(/-/g, '_') || 'truong';
  const IMG_ICON = '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6M15 9h.01"/></svg>';
  const EMPTY_HINT = {
    section: 'Khối trống – kéo thành phần vào đây',
    row: 'Hàng trống – kéo thành phần vào để xếp ngang',
    col: 'Cột trống – kéo thành phần vào đây',
    menu: 'Menu trống – kéo nút / chữ vào làm mục menu',
    form: 'Biểu mẫu trống – kéo ô nhập và nút gửi vào đây',
  };

  function renderList(list, ctx, parent) {
    return (list || []).map((n) => renderNode(n, ctx, parent)).join('');
  }

  function renderNode(n, ctx, parent) {
    const T = TYPES[n.type];
    if (!T) return '';
    const P = PK.resolve(n, ctx.theme);
    const c = { parentType: parent.type, parentP: parent.P || {}, inRow: parent.type === 'row' || (parent.type === 'menu' && parent.P.dir === 'row') };
    for (const r of nodeCSS(n, P, ctx, c)) ctx.rules.push(r);
    if (P.font && FONTS[P.font] && FONTS[P.font].google) ctx.fonts.add(P.font);
    const ed = ctx.edit ? ` data-pid="${n.id}"` : '';
    const cls = (base) => `class="${base} ${n.id}"`;
    const kids = () => renderList(n.children, ctx, { type: n.type, P }) || (ctx.edit ? `<div class="pg-ed-empty">${EMPTY_HINT[n.type] || 'Kéo thành phần vào đây'}</div>` : '');
    switch (n.type) {
      case 'section':
        return `<${P.tag} ${cls('pg-section')}${ed}>${kids()}</${P.tag}>`;
      case 'row':
        return `<div ${cls('pg-row')}${ed}>${kids()}</div>`;
      case 'col':
        return `<div ${cls('pg-col')}${ed}>${kids()}</div>`;
      case 'heading': {
        const l = /^[1-6]$/.test(P.level) ? P.level : '2';
        return `<h${l} ${cls('pg-heading')}${ed}>${txt(P.text)}</h${l}>`;
      }
      case 'text':
        return `<p ${cls('pg-text')}${ed}>${txt(P.text)}</p>`;
      case 'button': {
        const ic = P.icon ? `<span class="pg-btn-icon" aria-hidden="true">${esc(P.icon)}</span>` : '';
        const inner = (P.iconPos === 'before' ? ic : '') + `<span class="pg-btn-text">${esc(P.text)}</span>` + (P.iconPos !== 'before' ? ic : '');
        if (P.action === 'link') {
          if (ctx.edit) return `<a ${cls('pg-btn')} role="link"${ed}>${inner}</a>`;
          const pg = ctx.proj.pages.find((x) => x.id === P.page);
          const href = P.linkKind === 'url' ? P.url || '#' : '#/' + (pg ? pg.path : '');
          return `<a ${cls('pg-btn')} href="${esc(href)}"${P.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''}>${inner}</a>`;
        }
        if (P.action === 'show') {
          const m = P.menu ? `m-${esc(P.menu)}` : '';
          return `<button type="button" ${cls('pg-btn')}${m ? ` data-open-menu="${m}" aria-controls="${m}" aria-haspopup="true" aria-expanded="false"` : ''}${ed}>${inner}</button>`;
        }
        const k = P.submitKind;
        const a = k === 'form' ? ' type="submit"' : k === 'func' ? ' type="button"' + (P.func ? ` data-call="${esc(P.func)}"` : '') : ` type="button" data-alert="${esc(P.message)}"`;
        return `<button${a} ${cls('pg-btn')}${ed}>${inner}</button>`;
      }
      case 'image':
        if (!P.src) return `<div ${cls('pg-img pg-img-empty')} role="img" aria-label="${esc(P.alt || 'Ảnh')}"${ed}>${IMG_ICON}</div>`;
        return `<img ${cls('pg-img')} src="${esc(P.src)}" alt="${esc(P.alt)}"${ctx.edit ? '' : ' loading="lazy"'}${ed}>`;
      case 'list': {
        const tag = P.marker === 'number' ? 'ol' : 'ul';
        const items = (P.items || []).map((s, i) => `<li${ctx.edit ? ` data-li="${i}"` : ''}>${esc(s)}</li>`).join('');
        return `<${tag} class="pg-list m-${P.marker} ${n.id}"${ed}>${items || (ctx.edit ? '<li data-li="0"></li>' : '')}</${tag}>`;
      }
      case 'table': {
        const rows = P.rows && P.rows.length ? P.rows : [['']];
        const cell = (tag, v, r, ci) => `<${tag}${tag === 'th' ? ' scope="col"' : ''}${ctx.edit ? ` data-cell="${r},${ci}"` : ''}>${esc(v)}</${tag}>`;
        let h = '';
        let start = 0;
        if (P.header) {
          h += '<thead><tr>' + rows[0].map((v, ci) => cell('th', v, 0, ci)).join('') + '</tr></thead>';
          start = 1;
        }
        h += '<tbody>' + rows.slice(start).map((r, i) => '<tr>' + r.map((v, ci) => cell('td', v, i + start, ci)).join('') + '</tr>').join('') + '</tbody>';
        return `<div ${cls('pg-table')}${ed}><table>${h}</table></div>`;
      }
      case 'divider':
        if (P.kind === 'space') return `<div ${cls('pg-space')} aria-hidden="true"${ed}></div>`;
        if (P.kind === 'vr') return `<div ${cls('pg-vr')} role="separator" aria-orientation="vertical"${ed}></div>`;
        return `<div ${cls('pg-hr')} role="separator"${ed}></div>`;
      case 'menu': {
        const full = P.mode === 'full';
        const close = full && P.closeBtn ? '<button type="button" class="pg-menu-close" data-close-menu aria-label="Đóng menu">×</button>' : '';
        // khung soạn: menu đang không chọn thu thành một dải mỏng để bố cục trang giống thật
        if (ctx.edit && ctx.openMenus && !ctx.openMenus.has(n.id))
          return (
            `<nav class="pg-menu pg-menu-folded ${n.id}"${ed}><span class="pg-ed-fold">☰ ${esc(P.menuName || 'Menu')}` +
            `<small>${full ? 'menu toàn trang' : 'menu bảng nhỏ'} · ${(n.children || []).length} mục · chỉ hiện khi bấm nút mở – bấm vào đây để sửa</small></span></nav>`
          );
        if (ctx.edit)
          return (
            `<nav class="pg-menu pg-menu-${P.mode} ${n.id}"${ed}>` +
            `<span class="pg-ed-tag">☰ ${esc(P.menuName || 'Menu')} · ${full ? 'menu toàn trang' : 'menu bảng nhỏ'} – chỉ hiện khi bấm nút mở</span>${close}${kids()}</nav>`
          );
        return (
          `<nav class="pg-menu pg-menu-${P.mode} fx-${P.effect} ${n.id}" id="m-${n.id}" aria-label="${esc(P.menuName || 'Menu')}" data-anchor="${P.anchor}"` +
          `${P.closeOutside ? ' data-close-outside' : ''}${P.closeOnItem ? ' data-close-item' : ''} hidden>${close}${kids()}</nav>`
        );
      }
      case 'form': {
        const k = P.submitKind;
        let a = ` data-submit="${k}"`;
        if (k === 'url') a += ` action="${esc(P.url || '#')}" method="${P.method}"`;
        else if (k === 'func') a += P.func ? ` data-call="${esc(P.func)}"` : '';
        else a += ` data-message="${esc(P.message)}"`;
        return `<form ${cls('pg-form')}${a}${ed}>${kids()}</form>`;
      }
      case 'input':
      case 'select': {
        const name = esc(P.fieldName || autoName(P.label));
        const req = P.required ? ' required' : '';
        const ti = ctx.edit ? ' tabindex="-1"' : '';
        const lab = `<span class="pg-label"><span class="pg-label-text">${esc(P.label)}</span>${P.required ? '<span class="pg-req" aria-hidden="true">*</span>' : ''}</span>`;
        let ctl;
        if (n.type === 'select') ctl = `<select name="${name}"${req}${ti}>` + (P.options || []).map((o) => `<option>${esc(o)}</option>`).join('') + '</select>';
        else if (P.inputType === 'textarea') ctl = `<textarea name="${name}" rows="${P.lineCount}" placeholder="${esc(P.placeholder)}"${req}${ti}></textarea>`;
        else ctl = `<input type="${P.inputType}" name="${name}" placeholder="${esc(P.placeholder)}"${req}${ti}>`;
        return `<label ${cls('pg-field')}${ed}>${lab}${ctl}</label>`;
      }
      case 'checkbox': {
        const name = esc(P.fieldName || autoName(P.label));
        return (
          `<label ${cls('pg-check')}${ed}><input type="checkbox" name="${name}"${P.checked ? ' checked' : ''}${P.required ? ' required' : ''}${ctx.edit ? ' tabindex="-1"' : ''}>` +
          `<span class="pg-label-text">${esc(P.label)}</span></label>`
        );
      }
    }
    return '';
  }

  /** Sinh HTML + CSS của một trang. opts.edit: thêm data-pid và gợi ý cho khung soạn */
  PK.renderPage = function (proj, page, opts = {}) {
    const ctx = { edit: !!opts.edit, openMenus: opts.openMenus || null, theme: PK.resolveTheme(proj.theme), proj, page, rules: [], fonts: new Set() };
    const html = renderList(page.children, ctx, { type: 'page', P: PK.resolvePage(page) });
    const th = ctx.theme;
    if (FONTS[th.font] && FONTS[th.font].google) ctx.fonts.add(th.font);
    return { html, css: pageCSS(page) + '\n' + ctx.rules.join('\n'), fonts: [...ctx.fonts] };
  };
  PK.themeCSS = themeCSS;
  PK.fontsURL = (keys) => {
    const fam = keys.map((k) => FONTS[k] && FONTS[k].google).filter(Boolean);
    return fam.length ? 'https://fonts.googleapis.com/css2?family=' + fam.join('&family=') + '&display=swap' : '';
  };

  PK.BASE_CSS = `*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:var(--pg-font);font-size:var(--pg-size);color:var(--pg-color);line-height:1.5;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
[hidden]{display:none!important}
img{max-width:100%}
h1,h2,h3,h4,h5,h6,p,ul,ol{margin:0}
.pg-page{display:flex;flex-direction:column;min-height:100vh}
.pg-section,.pg-col,.pg-form,.pg-field{display:flex;flex-direction:column;min-width:0}
.pg-section{width:100%}
.pg-row{display:flex;flex-direction:row;min-width:0}
.pg-heading{line-height:1.25;overflow-wrap:break-word}
.pg-text{overflow-wrap:break-word}
.pg-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5em;cursor:pointer;text-decoration:none;font-family:inherit;line-height:1.2;-webkit-appearance:none;appearance:none;max-width:100%;text-align:center;user-select:none;-webkit-user-select:none}
.pg-btn:focus-visible{outline:2px solid var(--pg-primary);outline-offset:2px}
.pg-img{display:block;max-width:100%}
.pg-img-empty{background:#e2e8f0;color:#94a3b8;display:flex;align-items:center;justify-content:center;aspect-ratio:16/9;min-height:80px}
.pg-list{display:flex;flex-direction:column;padding-left:1.4em}
.pg-list.m-check,.pg-list.m-none{list-style:none;padding-left:0}
.pg-list.m-check li::before{content:"✓";color:var(--pg-primary);font-weight:700;margin-right:.6em}
.pg-table{overflow-x:auto;max-width:100%}
.pg-table table{border-collapse:separate;border-spacing:0}
.pg-hr{align-self:center;height:0}
.pg-vr{align-self:stretch;width:0;min-height:1em}
.pg-space{flex:0 0 auto}
.pg-label{font-size:.9em;font-weight:600}
.pg-req{color:#dc2626;margin-left:.2em}
.pg-field{gap:6px}
.pg-field input,.pg-field textarea,.pg-field select{font:inherit;color:inherit;width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;outline:none}
.pg-field input:focus,.pg-field textarea:focus,.pg-field select:focus{border-color:var(--pg-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--pg-primary) 22%,transparent)}
.pg-field textarea{resize:vertical}
.pg-check{display:inline-flex;align-items:center;gap:8px;cursor:pointer}
.pg-check input{width:18px;height:18px;accent-color:var(--pg-primary);margin:0;flex-shrink:0}
.pg-menu{display:flex}
.pg-menu-panel{position:absolute;z-index:1000;opacity:0;transform:translateY(-6px);transition:opacity .18s,transform .18s}
.pg-menu-full{position:fixed;inset:0;z-index:1000;overflow:auto;opacity:0;transition:opacity .25s,transform .3s}
.pg-menu.fx-slide-down{transform:translateY(-24px)}
.pg-menu.fx-slide-right{transform:translateX(40px)}
.pg-menu-full.fx-slide-right{transform:translateX(100%)}
.pg-menu.open{opacity:1;transform:none}
.pg-menu-close{position:absolute;top:14px;right:16px;width:42px;height:42px;border:0;border-radius:50%;background:rgba(127,127,127,.2);color:inherit;font:28px/1 sans-serif;cursor:pointer}
@media (prefers-reduced-motion:reduce){.pg-menu,.pg-btn{transition:none!important}}`;

  /** CSS riêng của khung soạn (không có trong file xuất) */
  PK.EDIT_CSS = `html,body{background:#fff;overflow:hidden}
body.pg-edit{user-select:none;-webkit-user-select:none}
.pg-edit .pg-page{min-height:var(--pg-vh,720px)}
.pg-ed-empty{display:flex;align-items:center;justify-content:center;min-height:72px;padding:12px;border:1.5px dashed #94a3b8;border-radius:8px;color:#64748b;font:500 12.5px/1.35 -apple-system,"Segoe UI",Roboto,sans-serif;background:rgba(148,163,184,.08);text-align:center;letter-spacing:0;text-transform:none;font-style:normal}
.pg-row>.pg-ed-empty{flex:1 1 auto;min-width:140px}
.pg-page>.pg-ed-empty{margin:28px;min-height:260px;font-size:14px}
.pg-edit .pg-space{background:repeating-linear-gradient(45deg,rgba(100,116,139,.16) 0 6px,transparent 6px 12px);min-height:4px;min-width:4px}
.pg-edit .pg-heading:empty::before,.pg-edit .pg-text:empty::before,.pg-edit .pg-btn-text:empty::before,.pg-edit li:empty::before{content:"(trống)";color:#94a3b8;font-weight:400}
.pg-edit .pg-menu{position:relative;inset:auto;opacity:1;transform:none;margin-top:30px;outline:2px dashed #a855f7;outline-offset:2px;overflow:visible}
.pg-edit .pg-menu-full{min-height:340px}
.pg-edit .pg-menu.pg-menu-folded{display:block;width:auto!important;min-height:0!important;max-width:none!important;margin:4px 0!important;padding:0!important;background:none!important;border:0!important;border-radius:6px!important;box-shadow:none!important;outline:1.5px dashed #a855f7;outline-offset:-1px;color:#7e22ce!important;opacity:1!important}
.pg-ed-fold{display:flex;align-items:baseline;gap:8px;padding:6px 10px;font:600 12px/1.3 -apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:0;text-transform:none;font-style:normal;text-align:left;background:rgba(168,85,247,.08);border-radius:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pg-ed-fold small{font-weight:400;font-size:11px;color:#9333ea;overflow:hidden;text-overflow:ellipsis}
.pg-ed-tag{position:absolute;left:-4px;top:-30px;font:600 11px/1 -apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;background:#a855f7;padding:6px 9px;border-radius:6px 6px 0 0;white-space:nowrap;pointer-events:none;letter-spacing:0;text-transform:none;font-style:normal;max-width:calc(100% + 8px);overflow:hidden;text-overflow:ellipsis}
.pg-outline [data-pid]{outline:1px dashed rgba(37,99,235,.45);outline-offset:-1px}
.pg-outline .pg-menu{outline:2px dashed #a855f7}
.pg-edit [contenteditable]{outline:2px solid #2563eb!important;outline-offset:2px;cursor:text;user-select:text;-webkit-user-select:text;min-width:1em}
.pg-edit [contenteditable]:empty::before{content:""}`;

  // ============================================================ FILE HTML XUẤT
  // Chạy trong trang xuất ra: chuyển trang theo #/duong-dan, mở / đóng menu, gửi biểu mẫu.
  const RUNTIME = `(function(){
var d=document,pages=[].slice.call(d.querySelectorAll('[data-page]'));
function q(s){return [].slice.call(d.querySelectorAll(s))}
function show(slug){var t=null;pages.forEach(function(p){if(p.getAttribute('data-page')===slug)t=p});if(!t)t=pages[0];if(!t)return;closeAll();pages.forEach(function(p){p.hidden=p!==t});d.title=t.getAttribute('data-title')||d.title;window.scrollTo(0,0)}
function route(){var m=location.hash.match(/^#\\/([\\w-]*)/);show(m?decodeURIComponent(m[1]):(window.PG_START||''))}
window.addEventListener('hashchange',route);route();
function place(m,b){var r=b.getBoundingClientRect(),w=m.offsetWidth,h=m.offsetHeight,a=m.getAttribute('data-anchor')||'below-left';var x=a==='below-right'?r.right-w:r.left,y=a==='above-left'?r.top-h-6:r.bottom+6;if(y<8)y=r.bottom+6;x=Math.max(8,Math.min(x,d.documentElement.clientWidth-w-8));m.style.left=(x+window.pageXOffset)+'px';m.style.top=(y+window.pageYOffset)+'px'}
function open(m,b){if(!m._home){m._home=d.createComment('menu');m.parentNode.insertBefore(m._home,m)}d.body.appendChild(m);m.hidden=false;m._btn=b||null;if(b){b.setAttribute('aria-expanded','true');if(m.classList.contains('pg-menu-panel'))place(m,b)}void m.offsetWidth;m.classList.add('open');if(m.classList.contains('pg-menu-full')){var f=m.querySelector('a[href],button,input,select,textarea');if(f)try{f.focus({preventScroll:true})}catch(e){}}}
function close(m){if(!m||!m.classList.contains('open'))return;m.classList.remove('open');if(m._btn)m._btn.setAttribute('aria-expanded','false');setTimeout(function(){if(m.classList.contains('open'))return;m.hidden=true;if(m._home&&m._home.parentNode){m._home.parentNode.insertBefore(m,m._home);m._home.parentNode.removeChild(m._home);m._home=null}},320)}
function closeAll(x){q('.pg-menu.open').forEach(function(m){if(m!==x)close(m)})}
function call(name,el,ev,data){var fn=String(name||'').split('.').reduce(function(o,k){return o&&o[k]},window);if(typeof fn==='function'){try{fn.call(el,ev,data)}catch(e){console.error(e)}}else console.warn('[Trang] Chưa có hàm "'+name+'" – viết hàm này trong Mã JavaScript của dự án')}
d.addEventListener('click',function(e){var t=e.target&&e.target.closest?e.target:e.target.parentElement;if(!t)return;
var ob=t.closest('[data-open-menu]');if(ob){e.preventDefault();var m=d.getElementById(ob.getAttribute('data-open-menu'));if(!m)return;if(m.classList.contains('open'))close(m);else{closeAll(m);open(m,ob)}return}
var cb=t.closest('[data-close-menu]');if(cb){close(cb.closest('.pg-menu'));return}
var lk=t.closest('a[href^="#/"]');if(lk&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.button){e.preventDefault();var h=lk.getAttribute('href');if(location.hash===h)route();else location.hash=h}
var inM=t.closest('.pg-menu');q('.pg-menu.open').forEach(function(m){if(m!==inM&&m.hasAttribute('data-close-outside'))close(m)});
var al=t.closest('[data-alert]');if(al)alert(al.getAttribute('data-alert'));
var fc=t.closest('[data-call]');if(fc&&fc.tagName!=='FORM')call(fc.getAttribute('data-call'),fc,e);
if(inM&&inM.hasAttribute('data-close-item')&&t.closest('a[href],button'))close(inM)});
d.addEventListener('keydown',function(e){if(e.key==='Escape')closeAll()});
window.addEventListener('resize',function(){q('.pg-menu-panel.open').forEach(function(m){if(m._btn)place(m,m._btn)})});
d.addEventListener('submit',function(e){var f=e.target,k=f.getAttribute('data-submit');if(k==='alert'){e.preventDefault();alert(f.getAttribute('data-message')||'Đã gửi');f.reset()}else if(k==='func'){e.preventDefault();var data={};new FormData(f).forEach(function(v,key){data[key]=v});call(f.getAttribute('data-call'),f,e,data)}});
})();`;
  PK.RUNTIME = RUNTIME;
  const safeScript = (s) => String(s).replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

  /** File HTML độc lập chứa mọi trang. opts.start: đường dẫn trang mở đầu (Xem thử) */
  PK.exportHTML = function (proj, opts = {}) {
    const css = [PK.BASE_CSS, themeCSS(proj.theme)];
    const fonts = new Set();
    const pages = proj.pages.map((pg, i) => {
      const r = PK.renderPage(proj, pg, {});
      css.push(r.css);
      r.fonts.forEach((f) => fonts.add(f));
      return `<div class="pg-page ${pg.id}" data-page="${esc(pg.path)}" data-title="${esc(PK.pageTitle(proj, pg))}"${i ? ' hidden' : ''}>\n${r.html}\n</div>`;
    });
    const url = PK.fontsURL([...fonts]);
    const fontLink = url
      ? `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${esc(url)}">\n`
      : '';
    const start = opts.start ? `<script>window.PG_START=${JSON.stringify(String(opts.start)).replace(/</g, '\\u003c')};</script>\n` : '';
    const user = proj.script && proj.script.trim() ? `<script>\n${safeScript(proj.script)}\n</script>\n` : '';
    return (
      `<!doctype html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
      `<title>${esc(PK.pageTitle(proj, proj.pages[0]))}</title>\n<meta name="generator" content="Diagram Editor – Thiết kế trang">\n${fontLink}` +
      `<style>\n${css.join('\n')}\n</style>\n</head>\n<body>\n${pages.join('\n')}\n${start}<script>\n${RUNTIME}\n</script>\n${user}</body>\n</html>\n`
    );
  };

  // ============================================================ THƯ VIỆN THÀNH PHẦN
  const ICON = {
    section: 'M3 5h18v14H3zM3 9h18',
    row: 'M3 7h18v10H3zM9 7v10M15 7v10',
    row2: 'M3 6h18v12H3zM12 6v12',
    row3: 'M3 6h18v12H3zM9 6v12M15 6v12',
    col: 'M8 3h8v18H8zM8 9h8M8 15h8',
    card: 'M4 4h16v16H4zM4 10h16M7 14h7M7 17h4',
    heading: 'M6 4v16M18 4v16M6 12h12',
    text: 'M4 6h16M4 10h16M4 14h16M4 18h10',
    button: 'M5 8h14a3 3 0 010 8H5a3 3 0 010-8zM9 12h6',
    image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9h.01',
    list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    table: 'M3 4h18v16H3zM3 10h18M3 15h18M9 4v16M15 4v16',
    menuPanel: 'M4 3h8v4H4zM4 9h16v12H4zM7 12h10M7 15h10M7 18h6',
    menuFull: 'M3 3h18v18H3zM8 9h8M8 12h8M8 15h8',
    burger: 'M4 7h16M4 12h16M4 17h16',
    form: 'M4 3h16v18H4zM7 7h10M7 11h10M7 15h5',
    input: 'M3 8h18v8H3zM7 10v4',
    textarea: 'M3 5h18v14H3zM6 9h12M6 13h8',
    select: 'M3 8h18v8H3zM15 11l2 2 2-2',
    checkbox: 'M4 6h6v6H4zM5.5 9l1.5 1.5L9 8M13 9h7',
    submit: 'M5 8h14a3 3 0 010 8H5a3 3 0 010-8zM9 12l2 2 4-4',
    hr: 'M3 12h18',
    vr: 'M12 3v18',
    space: 'M4 8V5h16v3M4 16v3h16v-3M12 9v6M10 11l2-2 2 2M10 13l2 2 2-2',
    nav: 'M3 4h18v5H3zM5 6.5h4M13 6.5h2M17 6.5h2',
    hero: 'M3 4h18v12H3zM8 9h8M10 12h4',
    features: 'M3 6h5v12H3zM9.5 6h5v12h-5zM16 6h5v12h-5z',
    contact: 'M4 4h16v16H4zM7 8h10M7 12h10M7 16h4',
    footer: 'M3 15h18v5H3zM5 17.5h5M14 17.5h5',
    pricing: 'M3 5h5v14H3zM9.5 3h5v18h-5zM16 5h5v14h-5z',
  };
  PK.icon = (name, size = 22) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[name] || ICON.section}"/></svg>`;
  PK.typeIcon = (n) =>
    n.type === 'divider' ? ({ hr: 'hr', vr: 'vr', space: 'space' }[(n.props || {}).kind] || 'hr') : n.type === 'menu' ? ((n.props || {}).mode === 'full' ? 'menuFull' : 'menuPanel') : n.type === 'input' && (n.props || {}).inputType === 'textarea' ? 'textarea' : n.type;

  const card = (title, body) =>
    mk('col', { bg: '#ffffff', radius: 12, padY: 24, padX: 24, borderW: 1, borderColor: '#e2e8f0', shadow: 'sm', hoverLift: 4, hoverShadow: 'md' }, [mk('heading', { text: title, level: '4' }), mk('text', { text: body, color: '#475569' })]);

  /** Thanh điều hướng (+ menu toàn trang cho điện thoại). links: [[chữ, id trang]] */
  function navPreset(brand, links) {
    const menu = mk('menu', { menuName: 'Menu điện thoại', mode: 'full', effect: 'slide-right' }, links.map(([t, pg]) => mk('button', { text: t, variant: 'ghost', size: 'lg', color: '#ffffff', page: pg || '', hoverBg: 'rgba(255,255,255,.12)' })));
    const nav = mk('section', { tag: 'header', sticky: true, padY: 14, bg: '#ffffff', shadow: 'sm', gap: 0 }, [
      mk('row', { justify: 'between', stack: false, wrap: false }, [
        mk('heading', { text: brand, level: '4', color: '#2563eb' }),
        mk('row', { gap: 4, stack: false, wrap: false, hideMobile: true }, links.map(([t, pg], i) => mk('button', i === links.length - 1 ? { text: t, size: 'sm', page: pg || '' } : { text: t, variant: 'ghost', size: 'sm', page: pg || '' }))),
        mk('button', { text: '', icon: '☰', variant: 'ghost', action: 'show', menu: menu.id, fontSize: 22, padX: 10, padY: 4, hideDesktop: true }),
      ]),
    ]);
    nav.name = 'Thanh điều hướng';
    return [nav, menu];
  }

  const PRESET_FIELDS = (submitText) => [
    mk('input', { label: 'Họ và tên', placeholder: 'Nguyễn Văn A', required: true }),
    mk('input', { label: 'Email', inputType: 'email', placeholder: 'ban@example.com', required: true }),
    mk('input', { label: 'Lời nhắn', inputType: 'textarea', placeholder: 'Bạn cần chúng tôi hỗ trợ gì?' }),
    mk('checkbox', { label: 'Tôi muốn nhận tin tức qua email' }),
    mk('button', { text: submitText, action: 'submit', submitKind: 'form', place: 'start' }),
  ];

  PK.PALETTE = [
    {
      id: 'layout', name: 'Bố cục', items: [
        { key: 'section', icon: 'section', name: 'Khối trang', build: () => [mk('section')] },
        { key: 'row', icon: 'row', name: 'Hàng', build: () => [mk('row')] },
        { key: 'row2', icon: 'row2', name: 'Hàng 2 cột', build: () => [mk('row', { vAlign: 'top', gap: 24 }, [mk('col'), mk('col')])] },
        { key: 'row3', icon: 'row3', name: 'Hàng 3 cột', build: () => [mk('row', { vAlign: 'top', gap: 24 }, [mk('col'), mk('col'), mk('col')])] },
        { key: 'col', icon: 'col', name: 'Cột', build: () => [mk('col')] },
        { key: 'card', icon: 'card', name: 'Thẻ', desc: 'Cột có nền trắng, bo góc, đổ bóng – nhấc lên khi di chuột qua', build: () => [card('Tiêu đề thẻ', 'Mô tả ngắn cho thẻ này.')] },
      ],
    },
    {
      id: 'content', name: 'Nội dung', items: [
        { key: 'heading', icon: 'heading', name: 'Tiêu đề', build: () => [mk('heading')] },
        { key: 'text', icon: 'text', name: 'Đoạn văn', build: () => [mk('text')] },
        { key: 'button', icon: 'button', name: 'Nút bấm', build: () => [mk('button')] },
        { key: 'button-outline', icon: 'button', name: 'Nút viền', build: () => [mk('button', { variant: 'outline', text: 'Xem thêm' })] },
        { key: 'image', icon: 'image', name: 'Ảnh', build: () => [mk('image')] },
        { key: 'list', icon: 'list', name: 'Danh sách', build: () => [mk('list')] },
      ],
    },
    {
      id: 'nav', name: 'Điều hướng', items: [
        { key: 'menu-panel', icon: 'menuPanel', name: 'Menu bảng nhỏ', desc: 'Bảng nhỏ hiện cạnh nút bấm', build: () => [mk('menu', {}, ['Hồ sơ', 'Cài đặt', 'Đăng xuất'].map((t) => mk('button', { text: t, variant: 'ghost', widthMode: 'full', align: 'left', size: 'sm', color: '#0f172a' })))] },
        { key: 'menu-full', icon: 'menuFull', name: 'Menu toàn trang', desc: 'Phủ kín màn hình, hợp cho điện thoại', build: () => [mk('menu', { mode: 'full', menuName: 'Menu toàn trang' }, ['Trang chủ', 'Giới thiệu', 'Liên hệ'].map((t) => mk('button', { text: t, variant: 'ghost', size: 'lg', color: '#ffffff', hoverBg: 'rgba(255,255,255,.12)' })))] },
        {
          key: 'menu-button', icon: 'burger', name: 'Nút mở menu ☰', desc: 'Nút ☰ kèm một menu bảng nhỏ', build: () => {
            const m = mk('menu', { menuName: 'Menu', anchor: 'below-right' }, ['Mục 1', 'Mục 2', 'Mục 3'].map((t) => mk('button', { text: t, variant: 'ghost', widthMode: 'full', align: 'left', size: 'sm', color: '#0f172a' })));
            return [mk('button', { text: 'Menu', icon: '☰', iconPos: 'before', variant: 'soft', action: 'show', menu: m.id }), m];
          },
        },
      ],
    },
    {
      id: 'form', name: 'Biểu mẫu', items: [
        { key: 'form', icon: 'form', name: 'Biểu mẫu', build: () => [mk('form', {}, [mk('input', { label: 'Email', inputType: 'email', placeholder: 'ban@example.com', required: true }), mk('button', { text: 'Gửi', action: 'submit', place: 'start' })])] },
        { key: 'input', icon: 'input', name: 'Ô nhập', build: () => [mk('input')] },
        { key: 'textarea', icon: 'textarea', name: 'Ô nhiều dòng', build: () => [mk('input', { label: 'Lời nhắn', inputType: 'textarea' })] },
        { key: 'select', icon: 'select', name: 'Hộp chọn', build: () => [mk('select')] },
        { key: 'checkbox', icon: 'checkbox', name: 'Ô đánh dấu', build: () => [mk('checkbox')] },
        { key: 'submit', icon: 'submit', name: 'Nút gửi', build: () => [mk('button', { text: 'Gửi', action: 'submit', place: 'start' })] },
      ],
    },
    { id: 'data', name: 'Dữ liệu', items: [{ key: 'table', icon: 'table', name: 'Bảng', build: () => [mk('table')] }] },
    {
      id: 'divider', name: 'Ngăn cách', items: [
        { key: 'hr', icon: 'hr', name: 'Thanh ngang', build: () => [mk('divider', { kind: 'hr' })] },
        { key: 'vr', icon: 'vr', name: 'Thanh dọc', desc: 'Đặt trong một Hàng để ngăn các thành phần', build: () => [mk('divider', { kind: 'vr' })] },
        { key: 'space', icon: 'space', name: 'Khoảng trống', build: () => [mk('divider', { kind: 'space' })] },
      ],
    },
    {
      id: 'blocks', name: 'Mẫu dựng sẵn', items: [
        { key: 'b-nav', icon: 'nav', name: 'Thanh điều hướng', desc: 'Logo + các nút chuyển trang; trên điện thoại thành nút ☰ mở menu toàn trang', build: () => navPreset('Thương hiệu', [['Trang chủ'], ['Giới thiệu'], ['Liên hệ']]) },
        {
          key: 'b-hero', icon: 'hero', name: 'Ảnh bìa (hero)', build: () => [
            mk('section', { bg: '#eff6ff', padY: 96, align: 'center', gap: 20 }, [
              mk('heading', { text: 'Tiêu đề thật ấn tượng cho trang của bạn', level: '1', align: 'center', maxW: 760 }),
              mk('text', { text: 'Một câu mô tả ngắn gọn giá trị bạn mang lại cho khách hàng.', align: 'center', fontSize: 18, color: '#475569', maxW: 620 }),
              mk('row', { justify: 'center', gap: 12, stack: false }, [mk('button', { text: 'Bắt đầu ngay', size: 'lg', icon: '→' }), mk('button', { text: 'Tìm hiểu thêm', size: 'lg', variant: 'outline' })]),
            ]),
          ],
        },
        {
          key: 'b-features', icon: 'features', name: '3 tính năng', build: () => [
            mk('section', { gap: 32 }, [
              mk('heading', { text: 'Vì sao chọn chúng tôi', align: 'center' }),
              mk('row', { gap: 24, vAlign: 'stretch' }, [card('Nhanh chóng', 'Dựng trang trong vài phút bằng kéo thả.'), card('Dễ dùng', 'Không cần biết code, chỉnh mọi thứ bằng bảng thuộc tính.'), card('Đẹp mọi màn hình', 'Tự xếp lại gọn gàng trên điện thoại.')]),
            ]),
          ],
        },
        {
          key: 'b-pricing', icon: 'pricing', name: 'Bảng giá', build: () => {
            const plan = (name, price, feats, hot) => {
              const white = hot ? { color: '#ffffff' } : {};
              return mk('col', Object.assign({ bg: hot ? '#2563eb' : '#ffffff', radius: 14, padY: 28, padX: 24, borderW: hot ? 0 : 1, borderColor: '#e2e8f0', shadow: hot ? 'lg' : 'sm', gap: 14, hoverLift: 4 }, white), [
                mk('heading', Object.assign({ text: name, level: '4' }, white)),
                mk('heading', Object.assign({ text: price, level: '2' }, white)),
                mk('list', { items: feats, marker: 'check' }),
                mk('button', hot ? { text: 'Chọn gói này', widthMode: 'full', bg: '#ffffff', color: '#2563eb' } : { text: 'Chọn gói này', widthMode: 'full', variant: 'outline' }),
              ]);
            };
            return [mk('section', { gap: 32, bg: '#f8fafc' }, [mk('heading', { text: 'Bảng giá', align: 'center' }), mk('row', { gap: 24, vAlign: 'stretch' }, [plan('Cơ bản', '0đ', ['1 dự án', 'Hỗ trợ qua email']), plan('Chuyên nghiệp', '199.000đ', ['10 dự án', 'Tên miền riêng', 'Hỗ trợ ưu tiên'], true), plan('Doanh nghiệp', 'Liên hệ', ['Không giới hạn', 'Quản trị nhóm'])])])];
          },
        },
        { key: 'b-contact', icon: 'contact', name: 'Biểu mẫu liên hệ', build: () => [mk('section', { gap: 20, contentW: 640 }, [mk('heading', { text: 'Liên hệ với chúng tôi' }), mk('text', { text: 'Để lại thông tin, chúng tôi sẽ phản hồi trong 24 giờ.', color: '#475569' }), mk('form', {}, PRESET_FIELDS('Gửi liên hệ'))])] },
        {
          key: 'b-footer', icon: 'footer', name: 'Chân trang', build: () => [
            mk('section', { tag: 'footer', bg: '#0f172a', color: '#cbd5e1', padY: 32 }, [
              mk('row', { justify: 'between' }, [mk('text', { text: '© 2026 Thương hiệu. Bảo lưu mọi quyền.', fontSize: 14 }), mk('row', { gap: 4, stack: false }, ['Điều khoản', 'Bảo mật', 'Liên hệ'].map((t) => mk('button', { text: t, variant: 'ghost', size: 'sm', color: '#e2e8f0', hoverBg: 'rgba(255,255,255,.1)' })))]),
            ]),
          ],
        },
      ],
    },
  ];
  PK.paletteItem = (key) => {
    for (const c of PK.PALETTE) for (const it of c.items) if (it.key === key) return it;
    return null;
  };

  // ============================================================ DỰ ÁN MẪU
  PK.blank = () => ({ kind: 'de-page', version: 1, name: 'Trang web của tôi', theme: Object.assign({}, THEME_DEF), pages: [{ id: DE.uid('p'), name: 'Trang chủ', path: 'index', props: {}, children: [] }], script: '' });

  PK.sample = function () {
    const home = { id: DE.uid('p'), name: 'Trang chủ', path: 'index', props: {}, children: [] };
    const about = { id: DE.uid('p'), name: 'Giới thiệu', path: 'gioi-thieu', props: {}, children: [] };
    const contact = { id: DE.uid('p'), name: 'Liên hệ', path: 'lien-he', props: { bg: '#f8fafc' }, children: [] };
    const links = [['Trang chủ', home.id], ['Giới thiệu', about.id], ['Liên hệ', contact.id]];
    const footer = () => PK.paletteItem('b-footer').build();
    home.children = [
      ...navPreset('Studio Xanh', links),
      mk('section', { bg: '#eff6ff', padY: 96, align: 'center', gap: 20 }, [
        mk('heading', { text: 'Thiết kế trang web bằng kéo thả', level: '1', align: 'center', maxW: 760 }),
        mk('text', { text: 'Không cần biết code: kéo thành phần từ bên trái, chỉnh màu sắc, chữ, hiệu ứng ở bảng bên phải rồi bấm “Xem thử”.', align: 'center', fontSize: 18, color: '#475569', maxW: 640 }),
        mk('row', { justify: 'center', gap: 12, stack: false }, [mk('button', { text: 'Liên hệ ngay', size: 'lg', icon: '→', page: contact.id, hoverLift: 2, hoverShadow: 'md' }), mk('button', { text: 'Về chúng tôi', size: 'lg', variant: 'outline', page: about.id })]),
      ]),
      ...PK.paletteItem('b-features').build(),
      ...footer(),
    ];
    about.children = [
      ...navPreset('Studio Xanh', links),
      mk('section', { gap: 20, contentW: 900 }, [
        mk('heading', { text: 'Về chúng tôi', level: '1' }),
        mk('text', { text: 'Chúng tôi là một nhóm nhỏ yêu thích thiết kế đơn giản, dễ dùng. Dưới đây là đội ngũ của chúng tôi.', color: '#475569', fontSize: 17 }),
        mk('table', { rows: [['Thành viên', 'Vai trò', 'Liên hệ'], ['Nguyễn An', 'Thiết kế', 'an@example.com'], ['Trần Bình', 'Phát triển', 'binh@example.com'], ['Lê Chi', 'Nội dung', 'chi@example.com']], striped: true }),
        mk('divider', { kind: 'hr', marginY: 16 }),
        mk('list', { items: ['Thiết kế lấy người dùng làm trung tâm', 'Giao hàng nhanh, minh bạch', 'Hỗ trợ tận tâm sau bàn giao'], marker: 'check' }),
      ]),
      ...footer(),
    ];
    contact.children = [...navPreset('Studio Xanh', links), ...PK.paletteItem('b-contact').build(), ...footer()];
    return { kind: 'de-page', version: 1, name: 'Studio Xanh', theme: Object.assign({}, THEME_DEF), pages: [home, about, contact], script: '' };
  };

  // ============================================================ SKILL CHO AI
  const COMMON_KEYS = new Set(['bg', 'bgImage', 'bgSize', 'bgOverlay', 'color', 'font', 'fontSize', 'bold', 'italic', 'underline', 'upper', 'align', 'lineHeight', 'letterSpacing', 'padY', 'padX', 'marginY', 'maxW', 'borderW', 'borderColor', 'borderStyle', 'radius', 'shadow', 'opacity', 'hideMobile', 'hideDesktop', ...FX_KEYS]);
  function fieldDoc(k, t) {
    const f = F[k];
    switch (f.type) {
      case 'enum':
        return `${k}: ${PK.optionsOf(f, t).map((o) => (o[0] === '' ? '""' : o[0])).join('|')}`;
      case 'num':
        return `${k} (số ${f.min}–${f.max})`;
      case 'bool':
        return `${k} (true/false)`;
      case 'color':
        return `${k} (màu${f.auto ? ' hoặc "auto"' : ''})`;
      case 'lines':
        return `${k} (mảng chuỗi)`;
      case 'table':
        return `${k} (mảng các hàng, mỗi hàng là mảng chuỗi)`;
      case 'page':
        return `${k} (id trang)`;
      case 'menu':
        return `${k} (id thành phần menu)`;
      case 'image':
        return `${k} (URL ảnh)`;
      case 'ident':
        return `${k} (tên hàm JS)`;
      default:
        return `${k} (chuỗi)`;
    }
  }

  PK.SKILL_EXAMPLE = {
    kind: 'de-page',
    version: 1,
    name: 'Quán cà phê Mộc',
    theme: { font: 'be-vietnam-pro', primary: '#92400e' },
    pages: [
      {
        id: 'p_home', name: 'Trang chủ', path: 'index',
        children: [
          {
            id: 'hdr', type: 'section', props: { tag: 'header', sticky: true, padY: 14, bg: '#ffffff', shadow: 'sm' },
            children: [
              {
                id: 'hdr_row', type: 'row', props: { justify: 'between', stack: false, wrap: false },
                children: [
                  { id: 'logo', type: 'heading', props: { text: 'Mộc Coffee', level: '4' } },
                  { id: 'btn_menu', type: 'button', props: { text: 'Menu', icon: '☰', iconPos: 'before', variant: 'soft', action: 'show', menu: 'm_main' } },
                ],
              },
            ],
          },
          { id: 'm_main', type: 'menu', props: { menuName: 'Menu chính', anchor: 'below-right' }, children: [{ id: 'mi_about', type: 'button', props: { text: 'Giới thiệu', variant: 'ghost', widthMode: 'full', align: 'left', page: 'p_about' } }] },
          {
            id: 'hero', type: 'section', props: { bg: '#fef3c7', padY: 96, align: 'center' },
            children: [
              { id: 'hero_h', type: 'heading', props: { text: 'Cà phê rang mộc mỗi sáng', level: '1', align: 'center' } },
              { id: 'hero_btn', type: 'button', props: { text: 'Xem thực đơn', size: 'lg', page: 'p_about', hoverLift: 2 } },
            ],
          },
        ],
      },
      { id: 'p_about', name: 'Giới thiệu', path: 'gioi-thieu', children: [{ id: 'ab', type: 'section', children: [{ id: 'ab_h', type: 'heading', props: { text: 'Câu chuyện của Mộc', level: '1' } }] }] },
    ],
  };

  /** Skill dạy AI định dạng JSON của tab Thiết kế trang. opts.proj: kèm dự án hiện tại */
  DE.buildPageSkill = function (opts = {}) {
    const L = [];
    L.push('# SKILL: Thiết kế trang web (tab "Thiết kế trang" của Diagram Editor)');
    L.push('');
    L.push('Tab **Thiết kế trang** dựng trang web bằng kéo thả cho người không biết code. Dữ liệu là một dự án JSON gồm nhiều trang; mỗi trang là cây thành phần (khối, hàng, cột, chữ, nút, ảnh, menu, bảng, biểu mẫu…). App tự sinh HTML/CSS, có Xem thử và xuất file HTML.');
    L.push('');
    L.push('## Cách trả lời');
    L.push('1. Khi tạo / sửa trang: trả về **TOÀN BỘ** dự án trong đúng **một** khối ```json (gốc có `"pages"`). Giữ nguyên `id` của các thành phần không đổi. App thay dự án bằng khối này – người dùng có nút Hoàn tác.');
    L.push('2. Ngoài khối JSON chỉ giải thích ngắn (tối đa 3 câu), bằng ngôn ngữ người dùng đang dùng.');
    L.push('3. Người dùng chỉ hỏi / nhờ góp ý → trả lời bằng chữ, KHÔNG trả JSON.');
    L.push('4. Khi sửa: giữ nguyên phần người dùng không yêu cầu đổi. Giá trị dạng `"@img:…"` là ảnh người dùng đã tải lên – giữ nguyên chuỗi đó.');
    L.push('');
    L.push('## Cấu trúc');
    L.push('- Dự án: `{ "kind":"de-page", "version":1, "name", "theme":{ "font", "fontSize", "color", "primary" }, "pages":[…], "script":"" }`');
    L.push(`- theme.font: ${Object.keys(FONTS).join('|')} · theme.primary: màu chủ đạo (nút mặc định dùng màu này).`);
    L.push('- Trang: `{ "id", "name", "path" (chữ-thường-gạch-nối, trang đầu là "index"), "props":{ "title", "bg", "bgImage", "bgSize" }, "children":[…] }`');
    L.push('- Thành phần: `{ "id" (duy nhất, bắt đầu bằng chữ cái), "type", "name"? (tên hiện trong bảng Lớp), "props":{…}, "children":[…] (chỉ loại chứa được con) }`');
    L.push('- Chỉ ghi props KHÁC mặc định. Màu dạng "#rrggbb" (hoặc "transparent", "rgba(…)"). Số đo là px trừ khi ghi khác (%, ×).');
    L.push('');
    L.push('## Các loại thành phần');
    for (const [type, T] of Object.entries(TYPES)) {
      const own = [...T.keys].filter((k) => !COMMON_KEYS.has(k)).map((k) => fieldDoc(k, type));
      const common = [...T.keys].filter((k) => COMMON_KEYS.has(k) && !FX_KEYS.includes(k));
      L.push(`- **${type}** – ${T.name}${T.container ? ' (chứa thành phần con)' : ''}: ${T.desc}.`);
      if (own.length) L.push(`  - props riêng: ${own.join(' · ')}`);
      if (common.length) L.push(`  - props chung dùng được: ${common.join(', ')}${T.keys.has('hoverBg') ? ', hiệu ứng hover*/press*' : ''}`);
    }
    L.push('');
    L.push('## Props chung');
    L.push(['bg', 'bgImage', 'bgSize', 'bgOverlay', 'color', 'font', 'fontSize', 'bold', 'italic', 'underline', 'upper', 'align', 'lineHeight', 'letterSpacing', 'padY', 'padX', 'marginY', 'maxW', 'borderW', 'borderColor', 'borderStyle', 'radius', 'shadow', 'opacity', 'hideMobile', 'hideDesktop'].map((k) => fieldDoc(k)).join(' · '));
    L.push('- Hiệu ứng: `hoverBg|hoverColor|hoverBorder` (màu; hoverBg/pressBg nhận "auto"), `hoverScale` (%), `hoverLift` (px nhấc lên), `hoverShadow` (none|sm|md|lg), `hoverOpacity` (%); tương tự với tiền tố `press` (khi bấm); `speed`: fast|normal|slow.');
    L.push('');
    L.push('## Quy tắc dựng trang');
    L.push('- Bố cục: `section` (dải ngang cả trang, nội dung căn giữa theo `contentW`) → `row` (xếp ngang) → `col` (xếp dọc; nhiều cột trong một hàng = chia cột) → nội dung. Trang thường có: header (thanh điều hướng) · hero · các section nội dung · footer.');
    L.push('- Nút chuyển trang: `action:"link"`, `linkKind:"page"`, `page`: id trang · ra ngoài: `linkKind:"url"`, `url`. Nút mở menu: `action:"show"`, `menu`: id thành phần `menu` (đặt menu ở gốc trang). Nút gửi: `action:"submit"` + `submitKind` (form: gửi biểu mẫu chứa nút · alert: hiện `message` · func: gọi hàm `func` viết trong "script").');
    L.push('- Menu: `mode:"panel"` (bảng nhỏ cạnh nút) hoặc `"full"` (phủ toàn trang, hợp điện thoại). Mục menu thường là `button` kiểu `variant:"ghost"`.');
    L.push('- Biểu mẫu: `form` chứa `input` / `select` / `checkbox` và một `button` gửi.');
    L.push('- Điện thoại: hàng tự xếp dọc (`row.stack` mặc định true; đặt false cho hàng logo + nút). Dùng `hideMobile` / `hideDesktop` để có nút ☰ riêng cho điện thoại.');
    L.push('- Ảnh: URL ảnh thật hoặc để trống `src` (app hiện khung ảnh mẫu). Văn bản viết bằng ngôn ngữ người dùng, nội dung thực tế, không lorem ipsum.');
    L.push('');
    L.push('## Ví dụ trả lời');
    L.push('Đã dựng trang chủ quán cà phê có thanh điều hướng, menu và ảnh bìa.');
    L.push('```json');
    L.push(JSON.stringify(PK.SKILL_EXAMPLE));
    L.push('```');
    if (opts.proj) {
      L.push('');
      L.push('## Dự án hiện tại của người dùng');
      L.push('Nếu người dùng yêu cầu sửa / bổ sung, dựa trên dự án này và trả lại toàn bộ dự án đã sửa.');
      L.push('```json');
      L.push(JSON.stringify(opts.proj));
      L.push('```');
    }
    if (!opts.noFooter) {
      L.push('');
      L.push('---');
      L.push('Hết skill. Yêu cầu của người dùng (nếu có) nằm ngay sau đây.');
    }
    return L.join('\n');
  };
})(window.DE);
