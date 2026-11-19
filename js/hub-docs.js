/* =========================================================================
 * Tab Dự án – tài liệu và truy vết (dùng khung của js/hub.js):
 *  - Sổ đăng ký tài liệu (DOCREG tự sinh), tạo tài liệu từ 24 mẫu.
 *  - Chi tiết tài liệu: vòng đời Dự thảo → Chờ duyệt → Đã duyệt → Đã phát hành, kiểm tra trước khi gửi duyệt /
 *    phát hành (desc §7.4), phiên bản, quan hệ ↑ ↓ ⇄, nhận xét theo phiên bản, lịch sử duyệt, mức bảo mật.
 *  - Mở phiên bản trong tab Tài liệu (DE.docs.openServerDoc) – Ctrl+S lưu lên máy chủ; thanh #doc-srv.
 *  - Truy vết: mã đã định nghĩa / tham chiếu, tài liệu Cần rà soát.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const HUB = DE.hub;
  const API = DE.api;
  const { esc, svg, ICON, fmtDate, fmtTime, fmtRel, who, ava, pill, statusPill, secPill, SEC_VI, fail, empty, $, $$ } = HUB.h;
  const S = HUB.S;
  const toast = (m, t) => DE.ui.toast(m, t);
  const filters = (S.docFilters = { q: '', type: '', group: '', status: '', archived: false });

  // ================================================================ SỔ ĐĂNG KÝ
  HUB.pages.docs = async (el, { isCurrent }) => {
    const ws = S.ws;
    const qs = new URLSearchParams();
    if (filters.q) qs.set('q', filters.q);
    if (filters.type) qs.set('type_code', filters.type);
    if (filters.group) qs.set('group_id', filters.group);
    if (filters.status) qs.set('status', filters.status);
    if (filters.archived) qs.set('archived', 'true');
    const [docs, types, groups] = await Promise.all([API.get(`/workspaces/${ws.id}/documents?${qs}`), HUB.types(), HUB.groups()]);
    if (!isCurrent()) return;
    const tname = (c) => (types.find((t) => t.code === c) || {}).family || c;
    const canCreate = HUB.h.canDocAnywhere('create');
    // loại "một bản cho cả workspace" chưa có – gợi ý tạo theo trình tự lập tài liệu
    let missing = [];
    if (canCreate && !filters.q && !filters.type && !filters.group && !filters.status && !filters.archived) {
      const have = new Set(docs.map((d) => d.type_code));
      missing = types.filter((t) => t.cardinality === 'workspace' && !have.has(t.code)).sort((a, b) => a.step - b.step || a.sort - b.sort);
    }
    const opt = (v, l, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`;
    el.innerHTML =
      HUB.head(
        'Tài liệu',
        'Sổ đăng ký tài liệu của dự án – tự cập nhật theo mã, phiên bản, trạng thái. Chỉ hiện tài liệu bạn được xem.',
        canCreate ? `<button type="button" class="btn primary" data-hub="new-doc">${svg(ICON.plus, 14)} Tài liệu mới</button>` : ''
      ) +
      `<div class="hub-filters">` +
      `<input class="hub-input grow" type="search" data-hub-filter="docs-q" placeholder="Tìm mã, tên tài liệu…" value="${esc(filters.q)}">` +
      `<select class="hub-select" data-hub-filter="docs-type">${opt('', 'Mọi loại', filters.type)}${types.map((t) => opt(t.code, `${t.family} – ${t.name}`, filters.type)).join('')}</select>` +
      `<select class="hub-select" data-hub-filter="docs-group">${opt('', 'Mọi group', filters.group)}${groups.map((g) => opt(g.id, g.name, filters.group)).join('')}</select>` +
      `<select class="hub-select" data-hub-filter="docs-status">${[
        ['', 'Mọi trạng thái'],
        ['draft', 'Đang dự thảo'],
        ['pending', 'Chờ duyệt'],
        ['approved', 'Đã duyệt'],
        ['published', 'Đã phát hành'],
      ]
        .map(([v, l]) => opt(v, l, filters.status))
        .join('')}</select>` +
      `<label class="chk"><input type="checkbox" data-hub-change="docs-archived"${filters.archived ? ' checked' : ''}> Đã lưu trữ</label></div>` +
      (missing.length
        ? `<div class="hub-suggest"><span>Chưa có:</span>${missing
            .slice(0, 8)
            .map((t) => `<button type="button" class="hub-chip" data-hub="new-doc" data-type="${esc(t.code)}" title="${esc(t.name)}">+ ${esc(t.family)}</button>`)
            .join('')}</div>`
        : '') +
      `<section class="set-card hub-flush">${
        docs.length
          ? `<table class="hub-table hub-docs"><thead><tr><th>Mã</th><th>Tên</th><th>Group</th><th>Phát hành</th><th>Đang soạn</th><th>Bảo mật</th><th>Cập nhật</th></tr></thead><tbody>${docs
              .map(
                (d) =>
                  `<tr class="click" data-hub-doc="${esc(d.id)}" tabindex="0"><td class="hub-nowrap"><code>${esc(d.code)}</code><div class="hub-sub">${esc(tname(d.type_code))}</div></td>` +
                  `<td>${esc(d.title)}${d.archived ? ' ' + pill('muted', 'Lưu trữ') : ''}</td><td>${esc(d.group_name || '')}</td>` +
                  `<td>${d.published_version ? pill('st-published', d.published_version) : '<span class="hub-muted">–</span>'}</td>` +
                  `<td>${d.working_status ? `${statusPill(d.working_status)} <span class="hub-sub">${esc(d.working_version || '')}</span>` : '<span class="hub-muted">–</span>'}</td>` +
                  `<td>${secPill(d.security)}</td><td class="hub-nowrap hub-sub">${fmtRel(d.updated_at)}</td></tr>`
              )
              .join('')}</tbody></table>`
          : empty(filters.q || filters.type || filters.group || filters.status ? 'Không có tài liệu khớp bộ lọc.' : 'Chưa có tài liệu nào.')
      }</section>`;
  };
  HUB.filters['docs-q'] = (v) => (filters.q = v);
  HUB.filters['docs-type'] = (v) => (filters.type = v);
  HUB.filters['docs-group'] = (v) => (filters.group = v);
  HUB.filters['docs-status'] = (v) => (filters.status = v);
  HUB.changes['docs-archived'] = (t) => {
    filters.archived = t.checked;
    HUB.render();
  };

  // ------------------------------------------------------------ tạo tài liệu
  HUB.actions['new-doc'] = async (btn) => {
    const [types, groups, subsystems] = await Promise.all([HUB.types(), HUB.groups(), HUB.subsystems()]);
    const myGroups = groups.filter((g) => (HUB.h.myGroupAccess(g.id) || {}).doc_perms?.create);
    if (!myGroups.length) return toast('Bạn không có quyền tạo tài liệu trong group nào', 'warn');
    const pre = btn && btn.dataset.type;
    const folders = [...new Set(types.map((t) => t.folder_label))];
    const typeOpts = folders
      .map(
        (f) =>
          `<optgroup label="${esc(f)}">${types
            .filter((t) => t.folder_label === f)
            .map((t) => `<option value="${esc(t.code)}"${t.code === pre ? ' selected' : ''}>${esc(t.family)} – ${esc(t.name)}</option>`)
            .join('')}</optgroup>`
      )
      .join('');
    const fields = (code) => {
      const t = types.find((x) => x.code === code) || types[0];
      const sub =
        t.cardinality === 'subsystem'
          ? subsystems.length
            ? `<div class="hub-grid2"><label class="f"><span>Hệ thống con</span><select name="subsystem_id" required>${subsystems
                .map((s) => `<option value="${esc(s.id)}">${esc(s.code)} – ${esc(s.name)}</option>`)
                .join('')}</select></label>` +
              `<label class="f"><span>Mã module đầu tiên (không bắt buộc)</span><input name="module_code" maxlength="5" class="hub-upper" placeholder="CART"></label></div>`
            : `<p class="msg warn">Chưa có hệ thống con nào – thêm ở mục Thành viên → Hệ thống con trước.</p>`
          : '';
      const proc =
        t.cardinality === 'process'
          ? `<div class="hub-grid2"><label class="f"><span>Số quy trình cấp 1 (01–99)</span><input name="process_no" type="number" min="1" max="99" required placeholder="11"></label>` +
            `<label class="f"><span>Tên quy trình</span><input name="process_name" placeholder="Mua hàng và thanh toán"></label></div>`
          : '';
      return (
        `<p class="hint">${esc(t.iso_process)}${t.standard ? ' · ' + esc(t.standard) : ''} · ${
          t.cardinality === 'workspace' ? 'một bản cho cả workspace' : t.cardinality === 'subsystem' ? 'một bản cho mỗi hệ thống con' : 'một bản cho mỗi quy trình'
        }${t.optional ? ' (chỉ khi hệ thống con có hạ tầng riêng)' : ''}</p>` +
        sub +
        proc
      );
    };
    const first = pre || types[0].code;
    const r = await HUB.dialog({
      title: 'Tài liệu mới',
      wide: true,
      body:
        `<label class="f"><span>Loại tài liệu (theo bộ mẫu ISO/IEC/IEEE 12207)</span><select name="type_code" data-type-select>${typeOpts}</select></label>` +
        `<div class="hub-type-fields">${fields(first)}</div>` +
        `<div class="hub-grid2"><label class="f"><span>Group (phạm vi an ninh)</span><select name="group_id">${myGroups
          .map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`)
          .join('')}</select></label>` +
        `<label class="f"><span>Mức bảo mật khi phát hành</span><select name="security"><option value="group">Group – người cùng group</option><option value="workspace">Workspace – mọi thành viên có quyền xem</option><option value="private">Riêng tư – người tạo và workspace owner</option></select></label></div>` +
        `<label class="f"><span>Tên tài liệu (để trống = lấy theo mẫu)</span><input name="title" maxlength="200"></label>` +
        `<p class="hint">Mã tài liệu do hệ thống sinh (ví dụ ${esc(S.ws.code)}-SRS-ORD-001). Nội dung lấy từ mẫu, đã điền mã dự án / hệ thống con / quy trình; bạn là người soạn bản 0.1.</p>`,
      ok: 'Tạo tài liệu',
      onOpen: (f) => {
        const sel = $('[data-type-select]', f);
        sel.value = first;
        sel.addEventListener('change', () => ($('.hub-type-fields', f).innerHTML = fields(sel.value)));
      },
      onOk: (f) => {
        const d = HUB.formData(f);
        const body = { type_code: d.type_code, group_id: d.group_id, security: d.security, title: d.title || null };
        if (d.subsystem_id) body.subsystem_id = d.subsystem_id;
        if (d.module_code) body.module_code = d.module_code;
        if (d.process_no) body.process_no = parseInt(d.process_no, 10);
        if (d.process_name) body.process_name = d.process_name;
        return API.post(`/workspaces/${S.ws.id}/documents`, body);
      },
    });
    if (r) {
      toast(`Đã tạo ${r.document.code}`, 'ok');
      HUB.go('doc', r.document.id);
    }
  };

  // ================================================================ CHI TIẾT
  const DIR = { up: '↑ Tầng trên', down: '↓ Tầng dưới', peer: '⇄ Ngang hàng' };
  let selVersion = {}; // tài liệu → phiên bản đang xem nhận xét

  HUB.pages.doc = async (el, { isCurrent, sub: id }) => {
    const det = await API.get(`/documents/${id}`);
    const reviews = await API.get(`/documents/${id}/reviews`).catch(() => []);
    if (!isCurrent()) return;
    const d = det.document;
    const c = det.capabilities;
    const working = det.versions.find((v) => v.id === d.working_version_id);
    const published = det.versions.find((v) => v.id === d.published_version_id);
    const vid = selVersion[id] && det.versions.some((v) => v.id === selVersion[id]) ? selVersion[id] : (working || published || det.versions[0] || {}).id;
    const comments = vid ? await API.get(`/versions/${vid}/comments`).catch(() => []) : [];
    if (!isCurrent()) return;
    const actBtn = (cond, act, label, cls = '') => (cond ? `<button type="button" class="btn ${cls}" data-hub="doc-act" data-act="${act}">${label}</button>` : '');
    const editLabel = c.edit_content ? 'Soạn trong tab Tài liệu' : 'Mở trong tab Tài liệu';
    el.innerHTML =
      HUB.head(
        `${esc(d.title)}`,
        `<code class="hub-code">${esc(d.code)}</code> ${esc(d.type_family || d.type_code)} · group ${esc(d.group_name || '')} · bảo mật ${secPill(d.security)}${d.archived ? ' ' + pill('muted', 'Đã lưu trữ') : ''}` +
          ` · phụ trách: ${esc((d.owner && d.owner.display_name) || '')}`,
        (working ? `<button type="button" class="btn primary" data-hub="doc-open" data-vid="${esc(working.id)}">${editLabel}</button>` : '') +
          (published ? `<button type="button" class="btn" data-hub="doc-view" data-vid="${esc(published.id)}">Xem bản ${esc(published.version)}</button>` : '') +
          (c.edit_meta || c.change_security || c.archive || c.delete ? `<button type="button" class="btn" data-hub="doc-more" aria-haspopup="dialog">Tuỳ chọn…</button>` : ''),
        HUB.backLink('docs', 'Tài liệu')
      ) +
      // ---- vòng đời
      `<section class="set-card hub-life"><h3>Vòng đời</h3>` +
      `<ol class="hub-steps">${['draft', 'pending', 'approved', 'published']
        .map((s, i) => {
          const curIdx = working ? ['draft', 'pending', 'approved'].indexOf(working.status) : 3;
          return `<li class="${i < curIdx ? 'done' : i === curIdx ? 'cur' : ''}">${esc(HUB.h.STATUS_VI[s])}</li>`;
        })
        .join('')}</ol>` +
      `<div class="set-row"><div class="set-row-text">${
        working
          ? `<b>Bản ${esc(working.version)} – ${esc(working.status_label)}</b><span>Người soạn: ${esc((working.editor && working.editor.display_name) || '–')} · vòng duyệt ${working.review_round || 0} · cập nhật ${fmtRel(working.updated_at)}</span>`
          : d.published_version
            ? `<b>Bản ${esc(d.published_version)} đang phát hành</b><span>Muốn sửa: tạo phiên bản mới (chép từ bản đang phát hành).</span>`
            : `<b>Chưa có phiên bản</b>`
      }</div><div class="hub-actions">` +
      actBtn(c.submit, 'submit', 'Gửi duyệt', 'primary') +
      actBtn(c.withdraw, 'withdraw', 'Rút lại') +
      actBtn(c.reject, 'reject', 'Trả lại') +
      actBtn(c.approve, 'approve', 'Duyệt', 'primary') +
      actBtn(c.reopen, 'reopen', 'Mở lại để sửa') +
      actBtn(c.publish, 'publish', 'Phát hành', 'primary') +
      actBtn(c.change_editor, 'editor', 'Đổi người soạn') +
      (c.new_version ? `<button type="button" class="btn" data-hub="doc-newver">Tạo phiên bản mới</button>` : '') +
      `</div></div>` +
      (working && working.status === 'pending' && !c.approve && c.reject ? `<p class="set-desc">Việc duyệt do group owner thực hiện; bạn có thể trả lại kèm lý do.</p>` : '') +
      `</section>` +
      `<div class="hub-cols">` +
      // ---- cột chính: phiên bản + nhận xét
      `<div>` +
      `<section class="set-card hub-flush"><h3 class="hub-card-h">Phiên bản</h3><table class="hub-table"><thead><tr><th>Bản</th><th>Trạng thái</th><th>Người soạn</th><th>Cập nhật</th><th></th></tr></thead><tbody>${det.versions
        .map(
          (v) =>
            `<tr class="${v.id === vid ? 'sel' : ''}"><td><b>${esc(v.version)}</b>${v.change_note ? `<div class="hub-sub">${esc(v.change_note)}</div>` : ''}</td><td>${statusPill(v.status)}</td>` +
            `<td>${who(v.editor)}</td><td class="hub-sub hub-nowrap">${fmtDate(v.published_at || v.updated_at)}</td>` +
            `<td class="hub-right hub-nowrap"><button type="button" class="btn sm" data-hub="doc-view" data-vid="${esc(v.id)}">Xem</button><button type="button" class="btn sm" data-hub="doc-cmt-sel" data-vid="${esc(v.id)}">Nhận xét</button></td></tr>`
        )
        .join('')}</tbody></table></section>` +
      renderComments(det, vid, comments) +
      `</div>` +
      // ---- cột phụ: quan hệ + lịch sử
      `<div>` +
      `<section class="set-card"><h3>Quan hệ</h3>${['up', 'down', 'peer']
        .map((dir) => {
          const list = det.links.filter((l) => l.direction === dir);
          return `<h4 class="hub-sec">${DIR[dir]}</h4>${
            list.length
              ? `<ul class="hub-links">${list
                  .map(
                    (l) =>
                      `<li><button type="button" class="hub-link" data-hub-doc="${esc(l.document_id)}"><code>${esc(l.code)}</code></button>` +
                      `${l.published_version ? pill('st-published', l.published_version) : statusPill(l.working_status) || pill('muted', 'chưa có bản')}` +
                      (c.manage_links && dir !== 'down' && !l.is_default ? `<button type="button" class="hub-x" data-hub="link-del" data-id="${esc(l.id)}" title="Bỏ quan hệ" aria-label="Bỏ quan hệ">×</button>` : '') +
                      `</li>`
                  )
                  .join('')}</ul>`
              : '<p class="hub-muted hub-small">–</p>'
          }`;
        })
        .join('')}${c.manage_links ? `<div class="set-actions"><button type="button" class="btn sm" data-hub="link-add">${svg(ICON.plus, 13)} Thêm quan hệ</button></div>` : ''}</section>` +
      `<section class="set-card"><h3>Lịch sử duyệt</h3>${
        reviews.length
          ? `<ul class="hub-timeline">${reviews
              .map(
                (r) =>
                  `<li><b>${esc(r.action_label)}</b> · bản ${esc(r.version)}<div class="hub-sub">${esc((r.actor && r.actor.display_name) || '')} · ${fmtTime(r.created_at)}</div>${
                    r.comment ? `<div class="hub-quote">${esc(r.comment)}</div>` : ''
                  }</li>`
              )
              .join('')}</ul>`
          : '<p class="hub-muted hub-small">Chưa có.</p>'
      }</section>` +
      `</div></div>`;
    el.dataset.doc = id;
    S.docDetail = det;
  };

  function renderComments(det, vid, list) {
    if (!vid) return '';
    const v = det.versions.find((x) => x.id === vid);
    const roots = list.filter((c) => !c.parent_id);
    const replies = (id) => list.filter((c) => c.parent_id === id);
    const item = (c, reply = false) =>
      `<li class="hub-cmt${c.resolved_at ? ' resolved' : ''}${reply ? ' reply' : ''}">${ava(c.author)}<div class="hub-cmt-main"><div class="hub-cmt-head"><b>${esc((c.author && c.author.display_name) || '')}</b>` +
      `<span class="hub-sub">${fmtRel(c.created_at)}${c.edited_at ? ' · đã sửa' : ''}${c.anchor ? ' · ' + esc(c.anchor) : ''}</span>${c.resolved_at ? pill('ok', 'Đã xử lý') : ''}</div>` +
      `<div class="hub-cmt-body">${esc(c.body)}</div><div class="hub-cmt-acts">` +
      (!reply ? `<button type="button" class="hub-link" data-hub="cmt-reply" data-id="${esc(c.id)}">Trả lời</button>` : '') +
      (c.can_resolve ? `<button type="button" class="hub-link" data-hub="cmt-resolve" data-id="${esc(c.id)}" data-on="${!c.resolved_at}">${c.resolved_at ? 'Mở lại' : 'Đánh dấu đã xử lý'}</button>` : '') +
      (c.can_edit ? `<button type="button" class="hub-link" data-hub="cmt-del" data-id="${esc(c.id)}">Xoá</button>` : '') +
      `</div></div></li>` +
      (reply ? '' : replies(c.id).map((r) => item(r, true)).join(''));
    return (
      `<section class="set-card"><h3>Nhận xét – bản ${esc((v && v.version) || '')}</h3>` +
      (roots.length ? `<ul class="hub-cmts">${roots.map((c) => item(c)).join('')}</ul>` : '<p class="set-desc">Chưa có nhận xét cho bản này.</p>') +
      `<form class="hub-cmt-form" data-hub-form="comment" data-vid="${esc(vid)}"><input class="hub-input" name="anchor" placeholder="Mục được nhận xét (không bắt buộc), ví dụ §5 Yêu cầu chức năng">` +
      `<textarea class="hub-input" name="body" rows="3" required placeholder="Viết nhận xét…"></textarea><input type="hidden" name="parent_id" value="">` +
      `<p class="msg err" hidden></p><div class="set-actions"><span class="hub-sub hub-reply-note" hidden></span><button type="submit" class="btn primary">Gửi nhận xét</button></div></form></section>`
    );
  }

  HUB.forms.comment = async (form, d) => {
    const vid = form.dataset.vid;
    await API.post(`/versions/${vid}/comments`, { body: d.body, anchor: d.anchor || null, parent_id: d.parent_id || null });
    HUB.render();
  };

  const docId = () => S.sub;
  const reload = () => HUB.render();

  HUB.actions['doc-cmt-sel'] = (b) => {
    selVersion[docId()] = b.dataset.vid;
    reload();
  };
  HUB.actions['cmt-reply'] = (b) => {
    const form = $('.hub-cmt-form');
    $('[name=parent_id]', form).value = b.dataset.id;
    const note = $('.hub-reply-note', form);
    note.hidden = false;
    note.innerHTML = `Đang trả lời một nhận xét · <a href="#" data-hub="cmt-reply-cancel">bỏ</a>`;
    $('[name=body]', form).focus();
  };
  HUB.actions['cmt-reply-cancel'] = () => {
    const form = $('.hub-cmt-form');
    $('[name=parent_id]', form).value = '';
    $('.hub-reply-note', form).hidden = true;
  };
  HUB.actions['cmt-resolve'] = async (b) => {
    await API.post(`/comments/${b.dataset.id}/${b.dataset.on === 'true' ? 'resolve' : 'reopen'}`);
    reload();
  };
  HUB.actions['cmt-del'] = async (b) => {
    if (!(await HUB.confirm('Xoá nhận xét?', 'Các trả lời của nhận xét này cũng bị xoá.', 'Xoá', true))) return;
    await API.del(`/comments/${b.dataset.id}`);
    reload();
  };

  // ------------------------------------------------------------ xem phiên bản
  async function viewVersion(vid) {
    const v = await API.get(`/versions/${vid}`);
    const det = S.docDetail;
    const html = `<article class="md-preview hub-viewer"></article>`;
    await HUB.dialog({
      title: `${(det && det.document.code) || ''} – bản ${v.version} (${v.status_label})`,
      wide: true,
      body: html,
      ok: v.capabilities.edit_content ? 'Soạn trong tab Tài liệu' : 'Mở trong tab Tài liệu (chỉ đọc)',
      cancel: 'Đóng',
      onOpen: (f) => {
        const art = $('.hub-viewer', f);
        art.replaceChildren(DE.md.sanitizeFragment(DE.md.render(v.content)));
        if (DE.mdRich) DE.mdRich.enhance(art, {}).catch(() => {});
      },
      onOk: () => openInEditor(v),
    });
  }

  /** Mở một phiên bản trong tab Tài liệu (soạn được nếu mình là người soạn bản dự thảo) */
  async function openInEditor(vOrId) {
    const v = typeof vOrId === 'string' ? await API.get(`/versions/${vOrId}`) : vOrId;
    const det = S.docDetail && S.docDetail.document.id === v.document_id ? S.docDetail : await API.get(`/documents/${v.document_id}`);
    const d = det.document;
    return DE.docs.openServerDoc(v.content, {
      versionId: v.id,
      documentId: d.id,
      workspaceId: d.workspace_id,
      code: d.code,
      title: d.title,
      version: v.version,
      status: v.status,
      statusLabel: v.status_label,
      revision: v.revision,
      editable: !!v.capabilities.edit_content,
    });
  }
  HUB.openInEditor = openInEditor;
  HUB.actions['doc-open'] = (b) => openInEditor(b.dataset.vid);
  HUB.actions['doc-view'] = (b) => viewVersion(b.dataset.vid);

  // ------------------------------------------------------------ chuyển trạng thái
  const LEVEL = { error: 'Chặn', warning: 'Cảnh báo', info: 'Thông tin' };
  const issueList = (issues) =>
    issues.length
      ? `<ul class="hub-issues">${issues.map((i) => `<li class="lv-${esc(i.level)}"><b>${LEVEL[i.level] || i.level}</b> ${esc(i.message)}</li>`).join('')}</ul>`
      : '<p class="msg ok">Không có vấn đề nào.</p>';
  HUB.issueList = issueList;

  HUB.actions['doc-act'] = async (b) => {
    const det = S.docDetail;
    const d = det.document;
    const vid = d.working_version_id;
    const act = b.dataset.act;
    if (act === 'editor') return changeEditor(det);
    let issues = [];
    if (act === 'submit' || act === 'publish') issues = await API.get(`/versions/${vid}/check/${act}`);
    const errors = issues.filter((i) => i.level === 'error');
    const TITLE = { submit: 'Gửi duyệt', withdraw: 'Rút lại', reject: 'Trả lại để sửa', approve: 'Duyệt', reopen: 'Mở lại để sửa', publish: 'Phát hành' };
    if (errors.length) {
      return HUB.dialog({
        title: `Chưa ${TITLE[act].toLowerCase()} được`,
        body: `<p class="modal-msg">Cần xử lý các vấn đề dưới đây (desc §7.4):</p>${issueList(issues)}`,
        ok: null,
        cancel: 'Đóng',
      });
    }
    const needReason = act === 'reject' || act === 'reopen';
    const v = det.versions.find((x) => x.id === vid);
    const body =
      (issues.length ? `<p class="modal-msg">Kiểm tra trước khi ${TITLE[act].toLowerCase()}:</p>${issueList(issues)}` : '') +
      (act === 'publish'
        ? `<p class="modal-msg">Bản ${esc(v.version)} sẽ được phát hành với số ${d.published_version ? '' : '<b>1.0</b>'}${
            d.published_version ? `<b>${esc(nextVer(d.published_version, false))}</b> (hoặc <b>${esc(nextVer(d.published_version, true))}</b> nếu là thay đổi lớn)` : ''
          }; bản phát hành trước (nếu có) chuyển sang Thay thế.</p>` +
          (d.published_version ? `<label class="chk"><input type="checkbox" name="major"> Thay đổi lớn (lên số chính)</label>` : '')
        : '') +
      `<label class="f"><span>${needReason ? 'Lý do (bắt buộc)' : 'Ghi chú (không bắt buộc)'}</span><textarea name="comment" rows="3"${needReason ? ' required' : ''}></textarea></label>` +
      (act === 'approve' ? `<p class="hint">Bạn duyệt với tư cách group owner của tài liệu.</p>` : '');
    const r = await HUB.dialog({
      title: `${TITLE[act]} ${d.code} bản ${v.version}`,
      body,
      ok: issues.some((i) => i.level === 'warning') ? `Vẫn ${TITLE[act].toLowerCase()}` : TITLE[act],
      danger: act === 'reject',
      onOk: async (f) => {
        const x = HUB.formData(f);
        if (needReason && !x.comment) throw new Error('Ghi lý do để người soạn biết cần sửa gì');
        try {
          return await API.post(`/versions/${vid}/${act}`, { comment: x.comment || null, acknowledge_warnings: true, major: !!x.major });
        } catch (e) {
          if (e.details && e.details.issues) throw new Error(e.message + ': ' + e.details.issues.map((i) => i.message).join('; '));
          throw e;
        }
      },
    });
    if (r) {
      toast(`${TITLE[act]}: ${d.code} – ${r.document.published_version && act === 'publish' ? 'bản ' + r.document.published_version : r.document.working_status_label || ''}`, 'ok');
      syncEditor(r);
      reload();
    }
  };
  const nextVer = (p, major) => {
    const [a, b] = p.split('.').map((n) => parseInt(n, 10) || 0);
    return major ? `${a + 1}.0` : `${a}.${b + 1}`;
  };

  /** Trạng thái đổi ⇒ cập nhật thanh tài liệu đang mở trong tab Tài liệu (nếu đúng tài liệu đó) */
  async function syncEditor(det) {
    const b = DE.docs.serverBinding && DE.docs.serverBinding();
    if (!b || b.documentId !== det.document.id) return;
    try {
      const v = await API.get(`/versions/${b.versionId}`);
      DE.docs.updateServer({ version: v.version, status: v.status, statusLabel: v.status_label, revision: v.revision, editable: !!v.capabilities.edit_content });
      if (b.revision !== v.revision && !DE.docs.isDirty?.()) DE.docs.reloadServer(v.content, Object.assign(b, { version: v.version, status: v.status, statusLabel: v.status_label, revision: v.revision, editable: !!v.capabilities.edit_content }));
    } catch (_) {
      DE.docs.updateServer({ editable: false });
    }
  }

  async function memberOptions(selected) {
    const members = await HUB.members();
    return members.map((m) => `<option value="${esc(m.user.id)}"${m.user.id === selected ? ' selected' : ''}>${esc(m.user.display_name)} – ${esc(m.user.email)}</option>`).join('');
  }

  async function changeEditor(det) {
    const d = det.document;
    const r = await HUB.dialog({
      title: `Giao bản dự thảo ${d.code} cho người khác`,
      body: `<p class="modal-msg">Mỗi bản dự thảo chỉ có một người được sửa; người khác chỉ nhận xét. Người nhận phải có quyền sửa tài liệu trong group.</p><label class="f"><span>Người soạn</span><select name="user_id">${await memberOptions(d.working_editor_id)}</select></label>`,
      ok: 'Giao',
      onOk: (f) => API.put(`/versions/${d.working_version_id}/editor`, HUB.formData(f)),
    });
    if (r) {
      syncEditor(r);
      reload();
    }
  }

  HUB.actions['doc-newver'] = async () => {
    const d = S.docDetail.document;
    const r = await HUB.dialog({
      title: `Tạo phiên bản mới cho ${d.code}`,
      body:
        `<p class="modal-msg">Bản dự thảo mới chép nội dung từ bản đang phát hành ${esc(d.published_version)}; người đọc vẫn thấy bản ${esc(d.published_version)} cho tới khi bản mới được phát hành.</p>` +
        `<label class="f"><span>Người soạn</span><select name="editor_id">${await memberOptions(HUB.h.me().id)}</select></label>` +
        `<label class="f"><span>Mục đích thay đổi (không bắt buộc)</span><input name="change_note" maxlength="300"></label>`,
      ok: 'Tạo bản dự thảo',
      onOk: (f) => API.post(`/documents/${d.id}/versions`, HUB.formData(f)),
    });
    if (r) {
      toast(`Đã tạo bản ${r.document.working_version}`, 'ok');
      reload();
    }
  };

  // ------------------------------------------------------------ tuỳ chọn tài liệu
  HUB.actions['doc-more'] = async () => {
    const det = S.docDetail;
    const d = det.document;
    const c = det.capabilities;
    const publicUrl = location.href.split('#')[0] + '#/hub/public/' + d.id;
    const r = await HUB.dialog({
      title: `Tuỳ chọn – ${d.code}`,
      body:
        (c.edit_meta ? `<label class="f"><span>Tên tài liệu</span><input name="title" value="${esc(d.title)}" maxlength="200"></label>` : '') +
        (c.change_security
          ? `<label class="f"><span>Mức bảo mật của bản phát hành (desc §6)</span><select name="security">${Object.entries(SEC_VI)
              .map(([k, l]) => `<option value="${k}"${k === d.security ? ' selected' : ''}>${l}</option>`)
              .join('')}</select></label><label class="chk" data-public-confirm hidden><input type="checkbox" name="confirm_public"> Tôi hiểu: mọi người có đường link đều xem được bản phát hành, không cần đăng nhập</label>`
          : '') +
        (d.security === 'public' && d.published_version ? `<p class="hint">Đường link công khai: <code class="hub-copy">${esc(publicUrl)}</code></p>` : '') +
        `<div class="hub-danger-zone">` +
        (c.archive ? `<button type="button" class="btn" data-r="archive">${d.archived ? 'Bỏ lưu trữ' : 'Lưu trữ tài liệu'}</button>` : '') +
        (c.delete ? `<button type="button" class="btn danger" data-r="delete">Xoá hẳn</button>` : '') +
        `</div>` +
        (c.delete ? '' : d.ever_published ? `<p class="hint">Tài liệu đã từng phát hành – không xoá được, chỉ lưu trữ.</p>` : ''),
      onOpen: (f, close) => {
        const sec = $('[name=security]', f);
        if (sec) sec.addEventListener('change', () => ($('[data-public-confirm]', f).hidden = sec.value !== 'public'));
        f.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-r="archive"],[data-r="delete"]');
          if (!b) return;
          try {
            if (b.dataset.r === 'archive') {
              await API.post(`/documents/${d.id}/${d.archived ? 'unarchive' : 'archive'}`);
              close(true);
            } else if (await HUB.confirm(`Xoá hẳn ${d.code}?`, 'Mọi phiên bản, nhận xét và quan hệ bị xoá. Không hoàn tác được.', 'Xoá hẳn', true)) {
              await API.del(`/documents/${d.id}`);
              close('deleted');
            }
          } catch (ex) {
            fail(ex);
          }
        });
      },
      onOk: (f) => {
        const x = HUB.formData(f);
        const body = {};
        if (x.title && x.title !== d.title) body.title = x.title;
        if (x.security && x.security !== d.security) {
          body.security = x.security;
          body.confirm_public = !!x.confirm_public;
        }
        return Object.keys(body).length ? API.patch(`/documents/${d.id}`, body) : true;
      },
    });
    if (r === 'deleted') HUB.go('docs');
    else if (r) reload();
  };

  // ------------------------------------------------------------ quan hệ
  HUB.actions['link-add'] = async () => {
    const d = S.docDetail.document;
    const docs = (await API.get(`/workspaces/${S.ws.id}/documents`)).filter((x) => x.id !== d.id);
    const r = await HUB.dialog({
      title: `Thêm quan hệ cho ${d.code}`,
      body:
        `<label class="f"><span>Tài liệu</span><select name="to_document_id">${docs.map((x) => `<option value="${esc(x.id)}">${esc(x.code)} – ${esc(x.title)}</option>`).join('')}</select></label>` +
        `<label class="f"><span>Quan hệ</span><select name="kind"><option value="up">↑ Tầng trên – nơi định nghĩa các mã tài liệu này dùng</option><option value="peer">⇄ Ngang hàng</option></select></label>` +
        `<p class="hint">Quan hệ ↓ tự suy ra từ ↑ của tài liệu khác. Phát hành bị chặn khi tài liệu ↑ chưa phát hành.</p>`,
      ok: 'Thêm',
      onOk: (f) => API.post(`/documents/${d.id}/links`, HUB.formData(f)),
    });
    if (r) reload();
  };
  HUB.actions['link-del'] = async (b) => {
    await API.del(`/links/${b.dataset.id}`);
    reload();
  };

  // ================================================================ THANH TRÌNH SOẠN
  /** Vẽ thanh "tài liệu trên máy chủ" phía trên trình soạn (docs.js gọi) */
  HUB.renderDocBar = function (el, b, { dirty }) {
    el.classList.toggle('dirty', !!dirty);
    el.innerHTML =
      `${svg(ICON.server, 15)}<code class="hub-code">${esc(b.code)}</code>` +
      `<span class="doc-srv-ver">bản ${esc(b.version)}</span>${statusPill(b.status)}` +
      (b.editable ? `<span class="doc-srv-dirty" title="Có thay đổi chưa lưu lên máy chủ">● Chưa lưu lên máy chủ</span>` : `<span class="doc-srv-lock">Chỉ đọc</span>`) +
      (b.lint ? `<button type="button" class="doc-srv-lint ${b.lint.errors ? 'err' : b.lint.warnings ? 'warn' : 'ok'}" data-srv="lint">${b.lint.errors ? b.lint.errors + ' lỗi' : b.lint.warnings ? b.lint.warnings + ' cảnh báo' : '✓ Mã truy vết ổn'}</button>` : '') +
      `<span class="doc-srv-sp"></span>` +
      (b.editable ? `<button type="button" class="btn" data-srv="lint" title="Kiểm tra mã truy vết, bảng thuộc tính, phần còn sót của mẫu">Kiểm tra</button><button type="button" class="btn primary" data-srv="save" title="Lưu lên máy chủ (Ctrl+S)">Lưu lên máy chủ</button>` : '') +
      `<button type="button" class="btn" data-srv="open" title="Mở tài liệu ở tab Dự án: gửi duyệt, phát hành, nhận xét">Mở trong Dự án</button>` +
      `<button type="button" class="doc-srv-x" data-srv="detach" title="Tách khỏi máy chủ – tài liệu thành file trên máy" aria-label="Tách khỏi máy chủ">×</button>`;
  };

  /** Ctrl+S / nút Lưu khi tài liệu đang mở là phiên bản trên máy chủ */
  HUB.saveServerDoc = async function () {
    const b = DE.docs.serverBinding();
    if (!b) return false;
    if (!b.editable) {
      toast(`${b.code} bản ${b.version} chỉ đọc (${b.statusLabel}) – không lưu được`, 'warn');
      return false;
    }
    if (!API.user()) {
      toast('Phiên đăng nhập đã hết – đăng nhập lại ở tab Dự án rồi lưu', 'warn');
      return false;
    }
    const content = DE.docs.serialize();
    try {
      const r = await API.put(`/versions/${b.versionId}/content`, { content, revision: b.revision });
      const lint = summarize(r.lint.issues);
      DE.docs.updateServer({ revision: r.revision, lint }, { saved: true });
      toast(`Đã lưu ${b.code} lên máy chủ` + (lint.errors || lint.warnings ? ` – ${lint.errors} lỗi, ${lint.warnings} cảnh báo về mã truy vết` : ''), lint.errors ? 'warn' : 'ok');
      return true;
    } catch (e) {
      if (e.code === 'document.stale_revision') {
        const ok = await HUB.confirm(
          'Bản trên máy chủ đã thay đổi',
          'Có người (hoặc bạn ở cửa sổ khác) vừa lưu bản này. Tải bản mới nhất sẽ bỏ thay đổi chưa lưu ở đây – muốn giữ, hãy Lưu ra file (Ctrl+Shift+S) trước.',
          'Tải bản mới nhất',
          true
        );
        if (ok) {
          const v = await API.get(`/versions/${b.versionId}`);
          DE.docs.reloadServer(v.content, Object.assign(b, { revision: v.revision }));
        }
        return false;
      }
      if (e.code === 'document.not_draft' || e.code === 'document.not_editor') {
        DE.docs.updateServer({ editable: false });
        toast(e.message, 'warn');
        return false;
      }
      fail(e);
      return false;
    }
  };
  const summarize = (issues) => ({
    errors: issues.filter((i) => i.level === 'error').length,
    warnings: issues.filter((i) => i.level === 'warning').length,
    issues,
  });

  async function lintCurrent() {
    const b = DE.docs.serverBinding();
    if (!b) return;
    try {
      const r = await API.post(`/versions/${b.versionId}/lint`, { content: DE.docs.serialize() });
      DE.docs.updateServer({ lint: summarize(r.issues) });
      HUB.dialog({
        title: `Kiểm tra ${b.code} bản ${b.version}`,
        wide: true,
        body:
          `<p class="modal-msg">Mã định nghĩa: ${r.defined.length ? r.defined.map((x) => `<code>${esc(x)}</code>`).join(' ') : '–'}<br>Mã tham chiếu: ${
            r.referenced.length ? r.referenced.map((x) => `<code>${esc(x)}</code>`).join(' ') : '–'
          }</p>` + issueList(r.issues),
        ok: null,
        cancel: 'Đóng',
      });
    } catch (e) {
      fail(e);
    }
  }

  function initDocBar() {
    const bar = $('#doc-srv');
    if (!bar) return;
    bar.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-srv]');
      if (!t) return;
      const b = DE.docs.serverBinding();
      if (!b) return;
      if (t.dataset.srv === 'save') return HUB.saveServerDoc();
      if (t.dataset.srv === 'lint') return lintCurrent();
      if (t.dataset.srv === 'open') {
        DE.docs.show('hub');
        if (!S.ws || S.ws.id !== b.workspaceId) await HUB.selectWs(b.workspaceId, 'docs').catch(fail);
        return HUB.go('doc', b.documentId);
      }
      if (t.dataset.srv === 'detach') {
        const ok = await HUB.confirm(
          'Tách khỏi máy chủ?',
          `Tài liệu đang mở thành file thường trên máy: Ctrl+S lưu ra file, không còn lưu lên ${b.code}. Phiên bản trên máy chủ giữ nguyên.`,
          'Tách'
        );
        if (ok) DE.docs.detachServer();
      }
    });
  }

  // ================================================================ TRANG CÔNG KHAI
  HUB.showPublic = async function (id) {
    try {
      const d = await API.public(`/public/documents/${id}`);
      await HUB.dialog({
        title: `${d.code} – ${d.title} (bản ${d.version})`,
        wide: true,
        body: `<p class="hint">Bản phát hành công khai · ${fmtDate(d.published_at)}</p><article class="md-preview hub-viewer"></article>`,
        ok: null,
        cancel: 'Đóng',
        onOpen: (f) => {
          const art = $('.hub-viewer', f);
          art.replaceChildren(DE.md.sanitizeFragment(DE.md.render(d.content)));
          if (DE.mdRich) DE.mdRich.enhance(art, {}).catch(() => {});
        },
      });
    } catch (e) {
      fail(e.status === 404 ? new Error('Tài liệu không công khai hoặc không còn tồn tại') : e);
    }
  };

  // ================================================================ TRUY VẾT
  const tf = (S.traceFilters = { tab: 'elements', q: '', kind: '' });
  const EL_STATUS = { active: ['st-published', 'Đã phát hành'], draft: ['st-draft', 'Dự thảo'], retired: ['muted', 'Đã bỏ'], undefined: ['err', 'Chưa định nghĩa'] };

  HUB.pages.trace = async (el, { isCurrent }) => {
    const ws = S.ws;
    const tabs = `<div class="mode-switch hub-seg" role="tablist">${[
      ['elements', 'Mã truy vết'],
      ['flags', 'Cần rà soát'],
    ]
      .map(([k, l]) => `<button type="button" role="tab" class="${tf.tab === k ? 'active' : ''}" aria-selected="${tf.tab === k}" data-hub="trace-tab" data-tab="${k}">${l}</button>`)
      .join('')}</div>`;
    const head = HUB.head('Truy vết', 'Mỗi mã (StR-01, UC-ORD-01, FR-ORD-CART-001…) được định nghĩa ở đúng một tài liệu và tham chiếu ở nơi khác (desc §7.2). Đọc tự động mỗi lần lưu.', tabs);
    if (tf.tab === 'flags') {
      const flags = await API.get(`/workspaces/${ws.id}/trace/flags`);
      if (!isCurrent()) return;
      el.innerHTML =
        head +
        `<section class="set-card hub-flush">${
          flags.length
            ? `<table class="hub-table"><thead><tr><th>Tài liệu cần rà soát</th><th>Mã</th><th>Thay đổi</th><th>Do</th><th>Lúc</th><th></th></tr></thead><tbody>${flags
                .map(
                  (f) =>
                    `<tr><td><button type="button" class="hub-link" data-hub-doc="${esc(f.document_id)}"><code>${esc(f.document_code)}</code></button></td><td><code>${esc(f.element_code)}</code></td>` +
                    `<td>${f.change === 'retired' ? pill('err', 'Đã bỏ') : pill('st-pending', 'Đã đổi')}</td><td><code>${esc(f.caused_by_document_code)}</code> bản ${esc(f.caused_by_version)}</td>` +
                    `<td class="hub-sub">${fmtRel(f.created_at)}</td><td class="hub-right"><button type="button" class="btn sm" data-hub="flag-done" data-id="${esc(f.id)}">Đã rà soát</button></td></tr>`
                )
                .join('')}</tbody></table>`
            : empty('Không có tài liệu nào cần rà soát.')
        }</section>`;
      return;
    }
    const qs = new URLSearchParams();
    if (tf.q) qs.set('q', tf.q);
    if (tf.kind) qs.set('kind', tf.kind);
    const list = await API.get(`/workspaces/${ws.id}/trace/elements?${qs}`);
    if (!isCurrent()) return;
    const KINDS = ['SH', 'StR', 'StC', 'BP', 'SYS-F', 'SYS-N', 'SYS-I', 'A', 'UC', 'FR', 'NFR', 'BR', 'ADR', 'SEQ', 'STM', 'ACT', 'AUTH', 'I', 'GAP', 'DG', 'C', 'TS', 'SEC', 'RISK', 'TD', 'OP', 'S'];
    el.innerHTML =
      head +
      `<div class="hub-filters"><input class="hub-input grow" type="search" data-hub-filter="trace-q" placeholder="Tìm mã…" value="${esc(tf.q)}">` +
      `<select class="hub-select" data-hub-filter="trace-kind"><option value="">Mọi loại mã</option>${KINDS.map((k) => `<option${k === tf.kind ? ' selected' : ''}>${k}</option>`).join('')}</select></div>` +
      `<section class="set-card hub-flush">${
        list.length
          ? `<table class="hub-table"><thead><tr><th>Mã</th><th>Loại</th><th>Trạng thái</th><th>Định nghĩa tại</th><th>Được tham chiếu</th></tr></thead><tbody>${list
              .map((e) => {
                const [cls, lbl] = EL_STATUS[e.status] || ['muted', e.status];
                return (
                  `<tr class="click" data-hub="trace-el" data-code="${esc(e.code)}" data-scope="${esc(e.scope)}" tabindex="0"><td class="hub-nowrap"><code>${esc(e.code)}</code>${e.scope ? `<div class="hub-sub">hệ thống con ${esc(e.scope)}</div>` : ''}</td>` +
                  `<td class="hub-sub">${esc(e.kind_name || e.kind)}</td><td>${pill(cls, lbl)}${e.provisional ? ' ' + pill('muted', 'dòng mẫu') : ''}</td>` +
                  `<td>${e.document_code ? `<code>${esc(e.document_code)}</code><div class="hub-sub">${esc(e.section || '')}</div>` : '<span class="hub-muted">–</span>'}</td>` +
                  `<td>${e.ref_count ? `${e.ref_count} · <span class="hub-sub">${esc(e.referenced_by.join(', '))}</span>` : '<span class="hub-muted">chưa có</span>'}</td></tr>`
                );
              })
              .join('')}</tbody></table>`
          : empty(tf.q || tf.kind ? 'Không có mã khớp bộ lọc.' : 'Chưa có mã nào – mã được đọc từ nội dung tài liệu mỗi lần lưu.')
      }</section>`;
  };
  HUB.filters['trace-q'] = (v) => (tf.q = v);
  HUB.filters['trace-kind'] = (v) => (tf.kind = v);
  HUB.actions['trace-tab'] = (b) => {
    tf.tab = b.dataset.tab;
    HUB.render();
  };
  HUB.actions['flag-done'] = async (b) => {
    await API.post(`/trace/flags/${b.dataset.id}/resolve`);
    toast('Đã đánh dấu đã rà soát', 'ok');
    HUB.render();
  };
  HUB.actions['trace-el'] = async (b) => {
    const d = await API.get(`/workspaces/${S.ws.id}/trace/elements/${encodeURIComponent(b.dataset.code)}${b.dataset.scope ? '?scope=' + encodeURIComponent(b.dataset.scope) : ''}`);
    const defs = d.occurrences.filter((o) => o.role === 'definition');
    const refs = d.occurrences.filter((o) => o.role === 'reference');
    const row = (o) =>
      `<li><button type="button" class="hub-link" data-hub-doc="${esc(o.document_id)}"><code>${esc(o.document_code)}</code></button> bản ${esc(o.version)}${o.published ? '' : ' (đang soạn)'}` +
      `<div class="hub-sub">${o.section_no ? '§' + esc(o.section_no) + ' · ' : ''}${esc(o.section)}${o.context_code ? ' · cùng dòng với ' + esc(o.context_code) : ''}${o.retired_on ? ' · đã bỏ ' + esc(o.retired_on) : ''}</div></li>`;
    HUB.dialog({
      title: `${d.code}${d.kind_name ? ' – ' + d.kind_name : ''}`,
      wide: true,
      body:
        (d.element && d.element.retired_note ? `<p class="msg warn">${esc(d.element.retired_note)}</p>` : '') +
        `<h4 class="hub-sec">Định nghĩa</h4>${defs.length ? `<ul class="hub-list">${defs.map(row).join('')}</ul>` : '<p class="hub-muted">Chưa tài liệu nào định nghĩa mã này.</p>'}` +
        `<h4 class="hub-sec">Tham chiếu (${refs.length})</h4>${refs.length ? `<ul class="hub-list">${refs.map(row).join('')}</ul>` : '<p class="hub-muted">Chưa nơi nào tham chiếu.</p>'}`,
      ok: null,
      cancel: 'Đóng',
    });
  };

  function init() {
    initDocBar();
    // bản đang mở trong trình soạn: kiểm tra lại quyền / trạng thái khi đăng nhập xong
    API.onAuth((u) => {
      const b = DE.docs && DE.docs.serverBinding && DE.docs.serverBinding();
      if (!b) return;
      if (!u) return DE.docs.updateServer({ editable: false });
      API.get(`/versions/${b.versionId}`)
        .then((v) => DE.docs.updateServer({ version: v.version, status: v.status, statusLabel: v.status_label, revision: v.revision, editable: !!v.capabilities.edit_content }))
        .catch(() => DE.docs.updateServer({ editable: false }));
    });
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('#hubview tr.click')) {
        e.preventDefault();
        e.target.click();
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.DE);
