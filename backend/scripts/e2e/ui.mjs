// Kiểm thử giao diện tab Dự án trên Chrome thật (headless) với máy chủ đang chạy.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const URL = process.argv[2] || 'http://localhost:8080/';
const SHOTS = process.argv[3] || '.';
const ORIGIN = new globalThis.URL(URL).origin;
// Đường dẫn Chrome / Edge: biến CHROME_PATH (mặc định Chrome trên Windows)
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let fails = 0;
const ok = (c, m, x) => {
  console.log(`${c ? 'OK  ' : 'FAIL'} ${m}${x !== undefined ? ' → ' + JSON.stringify(x) : ''}`);
  if (!c) fails++;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--window-size=1440,900'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const src = (m.location() && m.location().url) || '';
  // tài nguyên bên ngoài (vd. responsivevoice.org trả 401) – không thuộc app
  if (src && !src.startsWith(ORIGIN)) { console.log('     (bỏ qua lỗi ngoài: ' + src + ')'); return; }
  errors.push('console: ' + m.text() + (src ? ' @ ' + src : ''));
});
// "origin-gate failed": Chrome headless thiếu gói nhận dạng giọng nói trên máy (SpeechRecognition.available) – không phải lỗi app
page.on('pageerror', (e) => !/origin-gate/.test(e.message) && errors.push('pageerror: ' + e.message));
page.on('response', (r) => {
  if ((r.status() >= 500 || r.status() === 401) && r.url().startsWith(ORIGIN)) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`);
});
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
const text = (sel) => page.$eval(sel, (e) => e.innerText).catch(() => '');
const waitText = async (sel, needle, ms = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if ((await text(sel)).includes(needle)) return true;
    await sleep(100);
  }
  return false;
};
const click = async (sel) => {
  await page.waitForSelector(sel, { visible: true, timeout: 8000 });
  await page.click(sel);
};
const fill = async (sel, v) => {
  await page.waitForSelector(sel, { visible: true, timeout: 8000 });
  await page.$eval(sel, (e) => (e.value = ''));
  await page.type(sel, v);
};
const dialogOk = async () => {
  await click('.modal [data-r="ok"]');
  await page.waitForFunction(() => !document.querySelector('.modal-backdrop'), { timeout: 10000 }).catch(() => {});
};

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(1500);
await page.evaluate(() => localStorage.clear());
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(1500);

// --- tab Dự án: chưa đăng nhập
await click('#ws-tabs [data-ws="hub"]');
ok(await waitText('#hub-body', 'Đăng nhập'), 'tab Dự án hiện màn hình đăng nhập');
await shot('01-login');
await click('[data-hub="to-register"]');
const uniq = Date.now().toString(36);
await fill('#hub-body [name="last_name"]', 'Nguyễn Văn');
await fill('#hub-body [name="first_name"]', 'An');
await fill('#hub-body [name="email"]', `an.${uniq}@example.com`);
await fill('#hub-body [name="password"]', 'matkhau123');
await click('#hub-body [type="submit"]');
ok(await waitText('#hub-side', 'Nguyễn Văn An', 10000), 'đăng ký xong, hiện tên ở cột trái');

// --- tạo workspace (người đầu tiên có thể đã có workspace từ lần chạy trước – luôn tạo mới)
await click('[data-hub="new-ws"]');
const code = ('T' + uniq.replace(/[^a-z0-9]/g, '').slice(-5)).toUpperCase();
await fill('.modal [name="code"]', code);
await fill('.modal [name="name"]', 'Cửa hàng trực tuyến');
await dialogOk();
ok(await waitText('#hub-body', 'Cửa hàng trực tuyến'), 'tạo workspace → trang Tổng quan', code);
await shot('02-overview');

// --- hệ thống con
await click('[data-hub-nav="members"]');
ok(await waitText('#hub-body', 'Hệ thống con'), 'trang Thành viên');
await click('[data-hub="new-subsystem"]');
await fill('.modal [name="code"]', 'ORD');
await fill('.modal [name="name"]', 'Đặt hàng');
await dialogOk();
ok(await waitText('#hub-body', 'Đặt hàng'), 'thêm hệ thống con ORD');
await shot('03-members');

// --- tài liệu
await click('[data-hub-nav="docs"]');
ok(await waitText('#hub-body', 'Chưa có'), 'gợi ý loại tài liệu còn thiếu');
await click('[data-hub="new-doc"]');
await page.waitForSelector('.modal [data-type-select]');
await page.select('.modal [data-type-select]', 'STRS');
await dialogOk();
ok(await waitText('#hub-body', `${code}-StRS-000`), 'tạo StRS → trang chi tiết');
await shot('04-doc-detail');

// --- soạn trong tab Tài liệu
await click('[data-hub="doc-open"]');
await page.waitForSelector('#doc-srv:not([hidden])', { timeout: 8000 }).catch(() => {});
ok(await waitText('#doc-srv', `${code}-StRS-000`), 'tab Tài liệu có thanh máy chủ');
ok((await page.$eval('#md-preview', (e) => e.innerText)).includes('Đặc tả yêu cầu của các bên liên quan'), 'nội dung mẫu hiện trong trình soạn');
await page.click('#md-preview');
await page.keyboard.press('End');
await page.keyboard.type(' ');
await sleep(500);
ok(await page.$eval('#doc-srv', (e) => e.classList.contains('dirty')), 'gõ ⇒ "Chưa lưu lên máy chủ"');
await shot('05-editor-bound');
await page.keyboard.down('Control');
await page.keyboard.press('KeyS');
await page.keyboard.up('Control');
await sleep(1500);
ok(!(await page.$eval('#doc-srv', (e) => e.classList.contains('dirty'))), 'Ctrl+S lưu lên máy chủ', await text('#toast'));

// --- gửi duyệt → duyệt → phát hành
await click('#doc-srv [data-srv="open"]');
ok(await waitText('#hub-body', 'Vòng đời'), 'mở lại trong Dự án');
await click('[data-act="submit"]');
await page.waitForSelector('.modal');
await shot('06-submit-dialog');
await dialogOk();
ok(await waitText('#hub-body', 'Chờ duyệt'), 'gửi duyệt');
await click('[data-act="approve"]');
await dialogOk();
ok(await waitText('#hub-body', 'Đã duyệt'), 'group owner duyệt');
await click('[data-act="publish"]');
await page.waitForSelector('.modal');
await dialogOk();
ok(await waitText('#hub-body', 'đang phát hành', 10000), 'phát hành 1.0');
await shot('07-published');

// --- truy vết
await sleep(1200);
await click('[data-hub-nav="trace"]');
ok(await waitText('#hub-body', 'StR-01'), 'trang Truy vết có StR-01');
await shot('08-trace');

// --- ticket
await click('[data-hub-nav="tickets"]');
await click('[data-hub="new-ticket"]');
await fill('.modal [name="title"]', 'Không lưu được nhu cầu StR-01');
await fill('.modal [name="body"]', 'Bấm Lưu thì báo lỗi');
await dialogOk();
ok(await waitText('#hub-body', '#1 Không lưu được'), 'gửi ticket #1');
await shot('09-ticket');

// --- quyền ticket, nhật ký, thông báo, tài khoản, Cài đặt
for (const [nav, needle] of [
  ['ticket-access', 'Quyền đã cấp'],
  ['audit', 'document.version.published'],
  ['notifications', 'Thông báo'],
  ['account', 'Đổi mật khẩu'],
  ['ws-settings', 'Cho phép mức Công khai'],
]) {
  await click(`[data-hub-nav="${nav}"]`);
  ok(await waitText('#hub-body', needle), `trang ${nav}`);
}
await shot('10-audit-or-last');

// --- chế độ tối
await page.evaluate(() => DE.ui.setThemePref('dark'));
await click('[data-hub-nav="docs"]');
await waitText('#hub-body', `${code}-StRS-000`);
await shot('11-docs-dark');
await click(`[data-hub-doc]`);
await waitText('#hub-body', 'Vòng đời');
await shot('12-doc-dark');
await page.evaluate(() => DE.ui.setThemePref('light'));

// --- phím tắt tab
await page.keyboard.down('Alt');
await page.keyboard.press('Digit5');
await page.keyboard.up('Alt');
ok(await page.$eval('#guideview', (e) => !e.hidden), 'Alt+5 = Hướng dẫn');
await page.keyboard.down('Alt');
await page.keyboard.press('Digit4');
await page.keyboard.up('Alt');
ok(await page.$eval('#hubview', (e) => !e.hidden), 'Alt+4 = Dự án');

ok(errors.length === 0, 'không có lỗi console / trang / HTTP 5xx', errors.slice(0, 8));
fs.writeFileSync(`${SHOTS}/errors.json`, JSON.stringify(errors, null, 2));
await browser.close();
console.log(fails ? `\n${fails} kiểm tra thất bại` : '\nTất cả kiểm tra giao diện đều đạt');
process.exit(fails ? 1 : 0);
