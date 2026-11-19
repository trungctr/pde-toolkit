// Luồng làm việc nhóm trên giao diện: hai người dùng, hai phiên trình duyệt tách biệt.
//   node ui-team.mjs <url> <thư mục ảnh> [<thư mục docker compose để thử khởi động lại container>]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const BASE = process.argv[2] || 'http://localhost:8080/';
const SHOTS = process.argv[3] || '.';
const DEPLOY = process.argv[4] || '';
const ORIGIN = new URL(BASE).origin;
// Đường dẫn Chrome / Edge: biến CHROME_PATH (mặc định Chrome trên Windows)
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let fails = 0;
let restarting = false;
const ok = (c, m, x) => {
  console.log(`${c ? 'OK  ' : 'FAIL'} ${m}${x !== undefined ? ' → ' + JSON.stringify(x) : ''}`);
  if (!c) fails++;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--window-size=1440,900'], defaultViewport: { width: 1440, height: 900 } });

async function user(who) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error' || restarting) return;
    const src = (m.location() && m.location().url) || '';
    if (src && !src.startsWith(ORIGIN)) return; // tài nguyên ngoài (responsivevoice.org…)
    errors.push(`[${who}] console: ${m.text()}${src ? ' @ ' + src : ''}`);
  });
  page.on('pageerror', (e) => !/origin-gate/.test(e.message) && errors.push(`[${who}] pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (restarting || !r.url().startsWith(ORIGIN)) return;
    if (r.status() >= 500 || r.status() === 401) errors.push(`[${who}] HTTP ${r.status()} ${r.request().method()} ${r.url()}`);
  });
  const text = (sel) => page.$eval(sel, (e) => e.innerText).catch(() => '');
  const u = {
    page,
    text,
    shot: (name) => page.screenshot({ path: `${SHOTS}/team-${name}.png` }),
    waitText: async (sel, needle, ms = 10000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if ((await text(sel)).includes(needle)) return true;
        await sleep(100);
      }
      return false;
    },
    click: async (sel) => {
      await page.waitForSelector(sel, { visible: true, timeout: 10000 });
      await page.click(sel);
    },
    fill: async (sel, v) => {
      await page.waitForSelector(sel, { visible: true, timeout: 10000 });
      await page.$eval(sel, (e) => (e.value = ''));
      await page.type(sel, v);
    },
    // bấm phần tử đầu tiên khớp selector có chứa đoạn chữ
    clickText: async (sel, needle) => {
      await page.waitForFunction((s, n) => [...document.querySelectorAll(s)].some((e) => e.innerText.includes(n)), { timeout: 10000 }, sel, needle);
      const hs = await page.$$(sel);
      for (const h of hs) if ((await h.evaluate((e) => e.innerText)).includes(needle)) return h.click();
    },
    selectByText: async (sel, needle) => {
      await page.waitForSelector(sel, { timeout: 10000 });
      const v = await page.$eval(sel, (s, n) => ([...s.options].find((o) => o.text.includes(n)) || {}).value, needle);
      if (v === undefined) throw new Error(`không có lựa chọn "${needle}" trong ${sel}`);
      await page.select(sel, v);
    },
    dialogOk: async () => {
      await u.click('.modal [data-r="ok"]');
      await page.waitForFunction(() => !document.querySelector('.modal-backdrop'), { timeout: 15000 }).catch(() => {});
    },
    open: async () => {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(1200);
      await u.click('#ws-tabs [data-ws="hub"]');
    },
    nav: async (id) => u.click(`[data-hub-nav="${id}"]`),
    register: async (last, first, email, pass) => {
      await u.waitText('#hub-body', 'Đăng nhập');
      await u.click('[data-hub="to-register"]');
      await u.fill('#hub-body [name="last_name"]', last);
      await u.fill('#hub-body [name="first_name"]', first);
      await u.fill('#hub-body [name="email"]', email);
      await u.fill('#hub-body [name="password"]', pass);
      await u.click('#hub-body [type="submit"]');
      return u.waitText('#hub-side', `${last} ${first}`, 15000);
    },
    saveCtrlS: async () => {
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyS');
      await page.keyboard.up('Control');
    },
  };
  return u;
}

const uniq = Date.now().toString(36).slice(-6);
const code = ('TM' + uniq.replace(/[^a-z0-9]/g, '').slice(-4)).toUpperCase();
const PASS = 'matkhau-nhom-123';
const A = { last: 'Trần Thị', first: 'Hoa', email: `hoa.${uniq}@example.com` };
const B = { last: 'Lê Văn', first: 'Bình', email: `binh.${uniq}@example.com` };
const a = await user('Hoa');
const b = await user('Bình');

// ---------------------------------------------------------------- 1. Hoa lập dự án, mời Bình vào group
await a.open();
ok(await a.register(A.last, A.first, A.email, PASS), 'Hoa đăng ký');
await a.click('[data-hub="new-ws"]');
await a.fill('.modal [name="code"]', code);
await a.fill('.modal [name="name"]', 'Quản lý kho');
await a.dialogOk();
ok(await a.waitText('#hub-body', 'Quản lý kho'), 'Hoa tạo workspace', code);
await a.nav('members');
await a.click('[data-hub="invite"]');
await a.fill('.modal [name="email"]', B.email);
await a.selectByText('.modal [data-hub-scope]', 'Group');
await sleep(300);
const boxes = await a.page.$$eval('.modal .hub-perm-box input[type="checkbox"]:checked', (xs) => xs.map((x) => x.name + (x.value ? ':' + x.value : '')));
ok(boxes.length >= 5, 'hộp quyền mặc định khi mời vào group', boxes);
await a.shot('01-invite');
await a.dialogOk();
ok(await a.waitText('#hub-body', B.email), 'lời mời hiện trong "Lời mời đang chờ"');

// ---------------------------------------------------------------- 2. Bình đăng ký, nhận lời mời
await b.open();
ok(await b.register(B.last, B.first, B.email, PASS), 'Bình đăng ký');
ok(await b.waitText('#hub-body', 'Lời mời đang chờ'), 'Bình thấy lời mời ở trang chào mừng');
await b.shot('02-welcome-invite');
await b.click('[data-hub-inv-accept]');
ok(await b.waitText('#hub-body', 'Quản lý kho'), 'nhận lời → vào Tổng quan của workspace');
ok(await b.waitText('#hub-body', 'Thành viên'), 'vai trò hiển thị "Thành viên"');
ok(!(await b.page.$('[data-hub-nav="audit"]')), 'thành viên không thấy mục Nhật ký (chỉ workspace owner)');

// ---------------------------------------------------------------- 3. Bình soạn StRS rồi gửi duyệt
await b.nav('docs');
await b.click('[data-hub="new-doc"]');
await b.page.waitForSelector('.modal [data-type-select]');
await b.page.select('.modal [data-type-select]', 'STRS');
await b.dialogOk();
ok(await b.waitText('#hub-body', `${code}-StRS-000`), 'Bình tạo StRS');
ok(await b.waitText('#hub-body', 'phụ trách: Lê Văn Bình'), 'Bình là người phụ trách');
await b.click('[data-hub="doc-open"]');
await b.page.waitForSelector('#doc-srv:not([hidden])', { timeout: 10000 }).catch(() => {});
await b.page.click('#md-preview');
await b.page.keyboard.press('End');
await b.page.keyboard.type(' Kho trung tâm.');
await sleep(400);
await b.saveCtrlS();
await sleep(1500);
ok(!(await b.page.$eval('#doc-srv', (e) => e.classList.contains('dirty'))), 'Bình lưu bản dự thảo lên máy chủ (Ctrl+S)');
await b.click('#doc-srv [data-srv="open"]');
await b.waitText('#hub-body', 'Vòng đời');
ok(!(await b.page.$('[data-act="publish"]')) && !(await b.page.$('[data-act="approve"]')), 'Bình không có nút Duyệt / Phát hành');
await b.click('[data-act="submit"]');
await b.dialogOk();
ok(await b.waitText('#hub-body', 'Chờ duyệt'), 'Bình gửi duyệt');
await b.shot('03-submitted');

// ---------------------------------------------------------------- 4. Hoa nhận thông báo, duyệt, phát hành, nhận xét
await a.page.reload({ waitUntil: 'domcontentloaded' });
await sleep(1500);
await a.click('#ws-tabs [data-ws="hub"]').catch(() => {});
await a.page.waitForFunction(() => { const x = document.querySelector('#ws-hub-badge'); return x && !x.hidden; }, { timeout: 15000 }).catch(() => {});
ok(await a.page.$eval('#ws-hub-badge', (e) => !e.hidden && Number(e.textContent) >= 1).catch(() => false), 'Hoa: huy hiệu thông báo trên tab Dự án', await a.text('#ws-hub-badge'));
await a.nav('notifications');
ok(await a.waitText('#hub-body', 'gửi duyệt'), 'Hoa: thông báo "… gửi duyệt …"');
await a.shot('04-notifications');
await a.clickText('[data-hub-note]', 'gửi duyệt');
ok(await a.waitText('#hub-body', 'Vòng đời'), 'bấm thông báo → mở đúng tài liệu');
await a.click('[data-act="approve"]');
await a.dialogOk();
ok(await a.waitText('#hub-body', 'Đã duyệt'), 'Hoa duyệt');
await a.click('[data-act="publish"]');
await a.dialogOk();
ok(await a.waitText('#hub-body', 'đang phát hành', 15000), 'Hoa phát hành 1.0');
await a.fill('.hub-cmt-form [name="body"]', 'Cần bổ sung nhu cầu kiểm kê định kỳ');
await a.click('.hub-cmt-form [type="submit"]');
ok(await a.waitText('#hub-body', 'kiểm kê định kỳ'), 'Hoa nhận xét bản 1.0');
await a.shot('05-published-comment');

// ---------------------------------------------------------------- 5. Bình thấy kết quả, trả lời nhận xét, gửi ticket
await b.nav('notifications');
ok(await b.waitText('#hub-body', 'đã phát hành bản 1.0'), 'Bình: thông báo đã phát hành');
ok(await b.waitText('#hub-body', 'nhận xét'), 'Bình: thông báo có nhận xét mới');
await b.clickText('[data-hub-note]', 'nhận xét');
ok(await b.waitText('#hub-body', 'kiểm kê định kỳ'), 'Bình đọc nhận xét của Hoa');
await b.click('[data-hub="cmt-reply"]');
await b.fill('.hub-cmt-form [name="body"]', 'Đã ghi nhận, sẽ thêm ở bản sau');
await b.click('.hub-cmt-form [type="submit"]');
ok(await b.waitText('#hub-body', 'sẽ thêm ở bản sau'), 'Bình trả lời nhận xét');
await b.nav('tickets');
await b.click('[data-hub="new-ticket"]');
await b.fill('.modal [name="title"]', 'Thiếu báo cáo tồn kho');
await b.fill('.modal [name="body"]', 'Cần báo cáo tồn kho theo ngày');
await b.dialogOk();
ok(await b.waitText('#hub-body', '#1 Thiếu báo cáo tồn kho'), 'Bình gửi ticket #1');
ok(!(await b.page.$('[data-hub="tk-status"]')), 'Bình (không có quyền xử lý) không đổi được trạng thái');
await b.shot('06-ticket-member');

// ---------------------------------------------------------------- 6. Hoa xử lý ticket
// §4.4: không ai có quyền ticket mặc định, kể cả workspace owner – owner tự cấp quyền xem + xử lý cho mình trước
await a.nav('tickets');
ok(!(await a.waitText('#hub-body', 'Thiếu báo cáo tồn kho', 2500)), 'chưa cấp quyền: workspace owner cũng không thấy ticket của người khác');
await a.nav('ticket-access');
for (const kind of ['view', 'process']) {
  await a.click('[data-hub="grant-add"]');
  await a.page.waitForSelector('.modal [name="kind"]');
  await a.page.select('.modal [name="kind"]', kind);
  await a.page.select('.modal [data-subj]', 'user');
  await a.selectByText('.modal [data-subj-list]', 'Trần Thị Hoa');
  await a.dialogOk();
}
ok(await a.waitText("#hub-body", "Xử lý"), 'cấp quyền xem + xử lý ticket cho Hoa');
ok((await a.page.$$('#hub-body .hub-table tbody tr')).length === 2, 'bảng "Quyền đã cấp" có 2 dòng');
await a.shot('07a-ticket-access');
await a.nav('tickets');
await a.clickText('[data-hub-ticket]', 'Thiếu báo cáo tồn kho');
ok(await a.waitText('#hub-body', 'Cần báo cáo tồn kho theo ngày'), 'Hoa mở ticket #1');
await a.click('[data-hub="tk-assign"]');
await a.selectByText('.modal [name="user_id"]', 'Trần Thị Hoa');
await a.dialogOk();
await a.click('[data-hub="tk-status"]');
const to = await a.page.$eval('.modal [name="status"]', (s) => s.options[s.selectedIndex].text);
await a.fill('.modal [name="note"]', 'Đã nhận, đang xem xét');
await a.dialogOk();
ok(await a.waitText('#hub-body', to), `Hoa chuyển ticket sang "${to}"`);
await a.shot("07-ticket-owner");
await b.nav('notifications');
ok(await b.waitText('#hub-body', 'Ticket #1 chuyển sang'), 'Bình: thông báo ticket đổi trạng thái');

// ---------------------------------------------------------------- 7. Đăng xuất / đăng nhập lại
await b.nav('account');
await b.click('[data-hub="logout"]');
ok(await b.waitText('#hub-body', 'Đăng nhập'), 'Bình đăng xuất');
await b.fill('#hub-body [name="email"]', B.email);
await b.fill('#hub-body [name="password"]', 'sai-mat-khau-1');
await b.click('#hub-body [type="submit"]');
ok(await b.waitText('#hub-body .msg.err', 'không đúng'), 'sai mật khẩu → báo lỗi trong form', await b.text('#hub-body .msg.err'));
// lỗi 401 của lần đăng nhập sai là chủ đích – bỏ khỏi danh sách lỗi
for (let i = errors.length - 1; i >= 0; i--) if (/\[Bình\].*(401|auth\/login)/.test(errors[i])) errors.splice(i, 1);
await b.fill('#hub-body [name="password"]', PASS);
await b.click('#hub-body [type="submit"]');
ok(await b.waitText('#hub-side', 'Lê Văn Bình', 15000), 'Bình đăng nhập lại');
ok(await b.waitText('#hub-body', 'Quản lý kho'), 'đăng nhập lại → về workspace đang làm');

// ---------------------------------------------------------------- 8. Khởi động lại container: phiên và dữ liệu còn nguyên
if (DEPLOY) {
  restarting = true;
  const t0 = Date.now();
  execSync('docker compose restart app', { cwd: DEPLOY, stdio: 'ignore' });
  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) {
    ready = await fetch(ORIGIN + '/readyz').then((r) => r.ok).catch(() => false);
    if (!ready) await sleep(500);
  }
  ok(ready, 'container app khởi động lại và sẵn sàng', `${Math.round((Date.now() - t0) / 1000)}s`);
  restarting = false;
  await a.page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await a.click('#ws-tabs [data-ws="hub"]').catch(() => {});
  ok(await a.waitText('#hub-side', 'Trần Thị Hoa', 15000), 'Hoa vẫn đăng nhập sau khi container khởi động lại (cookie làm mới)');
  await a.nav('docs');
  ok(await a.waitText('#hub-body', `${code}-StRS-000`), 'dữ liệu còn nguyên sau khởi động lại');
  await a.shot('08-after-restart');
}

ok(errors.length === 0, 'không có lỗi console / trang / HTTP 5xx / 401 ngoài ý muốn', errors.slice(0, 8));
fs.writeFileSync(`${SHOTS}/team-errors.json`, JSON.stringify(errors, null, 2));
fs.writeFileSync(`${SHOTS}/team-accounts.json`, JSON.stringify({ code, A: A.email, B: B.email, PASS }, null, 2));
await browser.close();
console.log(fails ? `\n${fails} kiểm tra thất bại` : '\nTất cả kiểm tra luồng nhóm đều đạt');
process.exit(fails ? 1 : 0);
