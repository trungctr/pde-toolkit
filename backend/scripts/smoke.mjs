// Thử đầu-cuối qua HTTP với máy chủ đang chạy: node backend/scripts/smoke.mjs http://localhost:8080/api/v1  (Node 18+, không cần cài gì).
// Tạo hai tài khoản, một workspace, tài liệu, ticket thử trên máy chủ đó – chỉ chạy với máy chủ phát triển / thử nghiệm.
const B = process.argv[2] || 'http://127.0.0.1:18080/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg, extra) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}${extra !== undefined ? ' → ' + JSON.stringify(extra) : ''}`);
  if (!cond) fails++;
};
async function call(method, path, token, body) {
  const res = await fetch(B + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json, headers: res.headers };
}
const uniq = Date.now().toString(36);

const reg = await call('POST', '/auth/register', null, { email: `an.${uniq}@example.com`, password: 'matkhau123', first_name: 'An', last_name: 'Nguyễn Văn' });
ok(reg.status === 201, 'đăng ký', reg.json?.user?.display_name);
ok(/cc_refresh=.*HttpOnly/.test(reg.headers.get('set-cookie') || ''), 'cookie refresh HttpOnly');
const T = reg.json.access_token;
const reg2 = await call('POST', '/auth/register', null, { email: `binh.${uniq}@example.com`, password: 'matkhau123', first_name: 'Bình', last_name: 'Trần' });
const T2 = reg2.json.access_token;

const ws = await call('POST', '/workspaces', T, { code: 'S' + uniq.slice(-5).toUpperCase().replace(/[^A-Z0-9]/g, 'X'), name: 'Cửa hàng trực tuyến' });
ok(ws.status === 201, 'tạo workspace', ws.json?.code ?? ws.json);
const WS = ws.json.id, G = ws.json.me.groups[0].group_id;
ok((await call('GET', `/workspaces/${WS}`, T2)).status === 404, 'người ngoài không thấy workspace');
const sub = await call('POST', `/workspaces/${WS}/subsystems`, T, { code: 'ord', name: 'Đặt hàng' });
ok(sub.json?.code === 'ORD', 'hệ thống con ORD');

const strs = await call('POST', `/workspaces/${WS}/documents`, T, { type_code: 'STRS', group_id: G, security: 'workspace' });
ok(strs.status === 201, 'tạo StRS từ mẫu', strs.json?.document?.code ?? strs.json);
const srs = await call('POST', `/workspaces/${WS}/documents`, T, { type_code: 'SRS', group_id: G, subsystem_id: sub.json.id, module_code: 'CART' });
ok(srs.json?.links?.some((l) => l.direction === 'up' && l.type_code === 'STRS'), 'SRS ↑ StRS mặc định', srs.json?.document?.code);
const VID = strs.json.document.working_version_id;
const v = await call('GET', `/versions/${VID}`, T);
ok(v.json.content.startsWith('# Đặc tả yêu cầu của các bên liên quan'), 'nội dung mẫu đã điền', v.json.content.split('\n')[4]);
const save = await call('PUT', `/versions/${VID}/content`, T, { content: v.json.content, revision: v.json.revision });
ok(save.json?.lint?.defined?.includes('StR-01'), 'lưu + đọc mã truy vết', save.json?.lint?.defined);
const stale = await call('PUT', `/versions/${VID}/content`, T, { content: 'x', revision: v.json.revision });
ok(stale.status === 409 && stale.json.error.code === 'document.stale_revision', 'khoá lạc quan');
const warn = await call('POST', `/versions/${VID}/submit`, T, {});
ok(warn.status === 409 || warn.status === 200, 'gửi duyệt (có thể cần xác nhận cảnh báo)', warn.json?.error?.code ?? 'ok');
if (warn.status === 409) await call('POST', `/versions/${VID}/submit`, T, { acknowledge_warnings: true });
const appr = await call('POST', `/versions/${VID}/approve`, T, {});
ok(appr.json?.document?.working_status === 'approved', 'group owner duyệt');
const pubchk = await call('GET', `/versions/${VID}/check/publish`, T);
ok(Array.isArray(pubchk.json), 'xem trước kiểm tra phát hành', pubchk.json.map((i) => i.code));
const pub = await call('POST', `/versions/${VID}/publish`, T, { acknowledge_warnings: true });
ok(pub.json?.document?.published_version === '1.0', 'phát hành 1.0', pub.json?.error ?? pub.json?.document?.published_version);
const hist = await call('GET', `/versions/${VID}`, T);
ok(/\| 1\.0 \| \d{4}-\d\d-\d\d \| Phát hành \| Nguyễn Văn An \|/.test(hist.json.content), 'bảng Lịch sử thay đổi tự ghi');

await sleep(1500); // outbox relay
const els = await call('GET', `/workspaces/${WS}/trace/elements`, T);
ok(els.json.some((e) => e.code === 'StR-01' && e.status === 'active'), 'sổ mã có StR-01 (đã phát hành)');
const cnt = await call('GET', '/me/notifications/unread-count', T);
ok(typeof cnt.json?.unread === 'number', 'đếm thông báo chưa đọc', cnt.json);
const audit = await call('GET', `/workspaces/${WS}/audit?limit=100`, T);
ok(audit.json?.items?.some((i) => i.action === 'document.version.published'), 'nhật ký có phát hành', audit.json?.items?.length);
ok((await call('GET', `/workspaces/${WS}/audit`, T2)).status === 404, 'người ngoài không xem nhật ký');

const tk = await call('POST', `/workspaces/${WS}/tickets`, T2, { kind: 'bug', title: 'Nhu cầu StR-01 không hiện', body: 'Mở trang thì không thấy StR-01' });
ok(tk.status === 201 && tk.json.ticket.number === 1, 'người ngoài mở ticket #1');
ok((await call('GET', `/tickets/${tk.json.ticket.id}`, T)).status === 404, 'workspace owner chưa được cấp quyền thì không thấy ticket');
await call('POST', `/workspaces/${WS}/ticket-grants`, T, { kind: 'view', subject_type: 'group', subject_id: G, scope_type: 'workspace' });
await call('POST', `/workspaces/${WS}/ticket-grants`, T, { kind: 'process', subject_type: 'group', subject_id: G, scope_type: 'workspace' });
const prop = await call('POST', `/tickets/${tk.json.ticket.id}/ai/proposals`, T);
ok(prop.status === 200, 'kích hoạt đề xuất sửa tài liệu');
let det;
for (let i = 0; i < 40; i++) {
  det = await call('GET', `/tickets/${tk.json.ticket.id}`, T);
  if (det.json.checks?.[0] && det.json.checks[0].status !== 'pending') break;
  await sleep(250);
}
ok(det.json.proposals?.some((p) => p.document_code.endsWith('-StRS-000')), 'đề xuất trỏ tới StRS (theo mã StR-01)', det.json.proposals?.map((p) => p.section));

const pubdoc = await call('GET', `/public/documents/${strs.json.document.id}`, null);
ok(pubdoc.status === 404, 'tài liệu mức Workspace không xem công khai được');
const sec = await call('PATCH', `/documents/${strs.json.document.id}`, T, { security: 'public', confirm_public: true });
ok(sec.json?.document?.security === 'public', 'đổi sang Công khai');
ok((await call('GET', `/public/documents/${strs.json.document.id}`, null)).json?.version === '1.0', 'khách xem được bản phát hành Công khai');

console.log(fails ? `\n${fails} kiểm tra thất bại` : '\nTất cả kiểm tra đều đạt');
process.exit(fails ? 1 : 0);
