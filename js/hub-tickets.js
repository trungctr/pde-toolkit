/* =========================================================================
 * Tab Dự án – ticket góp ý tính năng / báo lỗi (desc §4.4, §5.4), dùng khung của js/hub.js:
 *  - Danh sách, mở ticket (cả khi chưa là thành viên workspace), ticket tôi gửi.
 *  - Xử lý: trạng thái, giao người, đánh dấu trùng, AI kiểm tra trùng và đề xuất sửa tài liệu
 *    (kết quả là gợi ý – người xử lý quyết định).
 *  - Quyền ticket: cấp xem / xử lý cho cá nhân hoặc group, uỷ quyền quyết định, uỷ quyền AI tự chạy.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const HUB = DE.hub;
  const API = DE.api;
  const { esc, svg, ICON, fmtTime, fmtRel, who, pill, fail, empty, $ } = HUB.h;
  const S = HUB.S;
  const toast = (m, t) => DE.ui.toast(m, t);
  const tf = (S.ticketFilters = { q: '', status: '', kind: '', mine: false });

  const ST = {
    new: ['st-draft', 'Mới'],
    checking: ['st-pending', 'Đang kiểm tra trùng'],
    reviewing: ['st-pending', 'Đang xem xét'],
    accepted: ['st-approved', 'Chấp nhận'],
    in_progress: ['st-approved', 'Đang xử lý'],
    resolved: ['st-published', 'Đã xử lý'],
    deferred: ['muted', 'Tạm hoãn'],
    rejected: ['muted', 'Từ chối'],
    duplicate: ['muted', 'Trùng'],
  };
  /** Trạng thái người xử lý chọn được (giống máy chủ) */
  const NEXT = {
    new: ['reviewing', 'accepted', 'deferred', 'rejected'],
    checking: ['reviewing', 'accepted', 'deferred', 'rejected'],
    reviewing: ['accepted', 'deferred', 'rejected'],
    accepted: ['in_progress', 'resolved', 'deferred', 'rejected'],
    in_progress: ['resolved', 'accepted', 'deferred'],
    resolved: ['reviewing'],
    deferred: ['reviewing'],
    rejected: ['reviewing'],
    duplicate: ['reviewing'],
  };
  const tpill = (s) => pill(...(ST[s] || ['muted', s]));
  const kindPill = (k) => (k === 'bug' ? pill('err', 'Báo lỗi') : pill('st-approved', 'Góp ý'));

  // ================================================================ DANH SÁCH
  function table(list, showWs = false) {
    return list.length
      ? `<table class="hub-table"><thead><tr><th>#</th><th>Tiêu đề</th><th>Loại</th><th>Trạng thái</th><th>Người gửi</th><th>Giao cho</th><th>Cập nhật</th></tr></thead><tbody>${list
          .map(
            (t) =>
              `<tr class="click" data-hub-ticket="${esc(t.id)}" tabindex="0"><td class="hub-nowrap">${showWs ? esc(t.workspace_code || '') + ' ' : ''}#${t.number}</td><td>${esc(t.title)}</td>` +
              `<td>${kindPill(t.kind)}</td><td>${tpill(t.status)}</td><td>${who(t.author)}</td><td>${who(t.assignee)}</td><td class="hub-sub hub-nowrap">${fmtRel(t.updated_at)}</td></tr>`
          )
          .join('')}</tbody></table>`
      : empty('Không có ticket nào.');
  }

  HUB.pages.tickets = async (el, { isCurrent }) => {
    const qs = new URLSearchParams();
    if (tf.q) qs.set('q', tf.q);
    if (tf.status) qs.set('status', tf.status);
    if (tf.kind) qs.set('kind', tf.kind);
    if (tf.mine) qs.set('mine', 'true');
    const list = await API.get(`/workspaces/${S.ws.id}/tickets?${qs}`);
    if (!isCurrent()) return;
    const opt = (v, l, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`;
    el.innerHTML =
      HUB.head(
        'Ticket',
        'Góp ý tính năng và báo lỗi phần mềm của dự án. Bạn thấy ticket mình gửi và ticket thuộc phạm vi được cấp quyền xem.',
        `<button type="button" class="btn primary" data-hub="new-ticket">${svg(ICON.plus, 14)} Ticket</button>`
      ) +
      `<div class="hub-filters"><input class="hub-input grow" type="search" data-hub-filter="tk-q" placeholder="Tìm tiêu đề, nội dung, #số…" value="${esc(tf.q)}">` +
      `<select class="hub-select" data-hub-filter="tk-status">${opt('', 'Mọi trạng thái', tf.status)}${Object.entries(ST)
        .map(([k, [, l]]) => opt(k, l, tf.status))
        .join('')}</select>` +
      `<select class="hub-select" data-hub-filter="tk-kind">${opt('', 'Mọi loại', tf.kind)}${opt('bug', 'Báo lỗi', tf.kind)}${opt('feature_feedback', 'Góp ý tính năng', tf.kind)}</select>` +
      `<label class="chk"><input type="checkbox" data-hub-change="tk-mine"${tf.mine ? ' checked' : ''}> Chỉ ticket tôi gửi</label></div>` +
      `<section class="set-card hub-flush">${table(list)}</section>`;
  };
  HUB.filters['tk-q'] = (v) => (tf.q = v);
  HUB.filters['tk-status'] = (v) => (tf.status = v);
  HUB.filters['tk-kind'] = (v) => (tf.kind = v);
  HUB.changes['tk-mine'] = (t) => {
    tf.mine = t.checked;
    HUB.render();
  };

  HUB.pages['my-tickets'] = async (el) => {
    const list = await API.get('/me/tickets');
    el.innerHTML =
      HUB.head('Ticket tôi gửi', 'Ở mọi workspace – kể cả nơi bạn không phải thành viên.', `<button type="button" class="btn primary" data-hub="new-ticket-any">${svg(ICON.plus, 14)} Ticket</button>`) +
      `<section class="set-card hub-flush">${table(list, true)}</section>`;
  };

  // ------------------------------------------------------------ mở ticket
  function ticketForm(t = {}, { groups = [], workspaces = null } = {}) {
    const bug = !t.kind || t.kind === 'bug';
    return (
      (workspaces
        ? `<label class="f"><span>Dự án</span><select name="workspace_id" required>${workspaces.map((w) => `<option value="${esc(w.id)}">${esc(w.code)} – ${esc(w.name)}</option>`).join('')}</select></label>`
        : '') +
      (t.id
        ? ''
        : `<div class="hub-grid2"><label class="f"><span>Loại</span><select name="kind" data-tk-kind><option value="bug"${bug ? ' selected' : ''}>Báo lỗi</option><option value="feature_feedback"${bug ? '' : ' selected'}>Góp ý tính năng</option></select></label>` +
          (groups.length
            ? `<label class="f"><span>Group liên quan (không bắt buộc)</span><select name="group_id"><option value="">–</option>${groups.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></label>`
            : '<span></span>') +
          `</div>`) +
      `<label class="f"><span>Tiêu đề</span><input name="title" required maxlength="200" value="${esc(t.title || '')}" autofocus></label>` +
      `<label class="f"><span>Mô tả</span><textarea name="body" rows="4" required>${esc(t.body || '')}</textarea></label>` +
      `<div class="hub-bug"${bug ? '' : ' hidden'}>` +
      `<label class="f"><span>Bước tái hiện</span><textarea name="reproduction_steps" rows="3">${esc(t.reproduction_steps || '')}</textarea></label>` +
      `<div class="hub-grid2"><label class="f"><span>Kết quả thực tế</span><textarea name="actual_result" rows="2">${esc(t.actual_result || '')}</textarea></label>` +
      `<label class="f"><span>Kết quả mong đợi</span><textarea name="expected_result" rows="2">${esc(t.expected_result || '')}</textarea></label></div></div>` +
      `<div class="hub-grid2"><label class="f"><span>Môi trường (không bắt buộc)</span><input name="environment" value="${esc(t.environment || '')}" placeholder="Chrome 140, Windows 11"></label>` +
      `<label class="f"><span>Phiên bản phần mềm</span><input name="software_version" value="${esc(t.software_version || '')}"></label></div>` +
      `<p class="hint">Có thể nhắc mã truy vết (StR-01, FR-ORD-CART-001…) – AI dùng chúng để tìm tài liệu liên quan.</p>`
    );
  }
  const bindKind = (f) => {
    const k = $('[data-tk-kind]', f);
    if (k) k.addEventListener('change', () => ($('.hub-bug', f).hidden = k.value !== 'bug'));
  };
  const clean = (d) => {
    const out = {};
    Object.entries(d).forEach(([k, v]) => (out[k] = v === '' ? null : v));
    return out;
  };

  async function newTicket(anyWorkspace) {
    let workspaces = null;
    let groups = [];
    if (anyWorkspace || !S.ws) workspaces = await API.get('/workspaces/directory');
    else groups = await HUB.groups().catch(() => []);
    if (workspaces && !workspaces.length) return toast('Chưa có dự án nào trên máy chủ', 'warn');
    const r = await HUB.dialog({
      title: 'Gửi ticket',
      wide: true,
      body: ticketForm({}, { groups, workspaces }),
      ok: 'Gửi ticket',
      onOpen: bindKind,
      onOk: (f) => {
        const d = clean(HUB.formData(f));
        const ws = d.workspace_id || S.ws.id;
        delete d.workspace_id;
        return API.post(`/workspaces/${ws}/tickets`, d);
      },
    });
    if (r) {
      toast(`Đã gửi ticket #${r.ticket.number}`, 'ok');
      HUB.go('ticket', r.ticket.id);
    }
  }
  HUB.actions['new-ticket'] = () => newTicket(false);
  HUB.actions['new-ticket-any'] = () => newTicket(true);

  // ================================================================ CHI TIẾT
  HUB.pages.ticket = async (el, { isCurrent, sub: id }) => {
    const det = await API.get(`/tickets/${id}`);
    if (!isCurrent()) return;
    S.ticketDetail = det;
    const t = det.ticket;
    const c = t.capabilities;
    const field = (label, v) => (v ? `<div class="hub-field"><b>${label}</b><div>${esc(v)}</div></div>` : '');
    const running = det.checks.some((x) => x.status === 'pending');
    el.innerHTML =
      HUB.head(
        `#${t.number} ${esc(t.title)}`,
        `${kindPill(t.kind)} ${tpill(t.status)} · ${esc((t.author && t.author.display_name) || '')} gửi ${fmtRel(t.created_at)}${t.workspace_code ? ' · ' + esc(t.workspace_code) : ''}`,
        (c.edit ? `<button type="button" class="btn" data-hub="tk-edit">Sửa</button>` : '') +
          (c.process ? `<button type="button" class="btn" data-hub="tk-status">Đổi trạng thái</button><button type="button" class="btn" data-hub="tk-assign">Giao người</button><button type="button" class="btn" data-hub="tk-dup">Đánh dấu trùng</button>` : ''),
        HUB.backLink(S.ws && S.ws.id === t.workspace_id ? 'tickets' : 'my-tickets', 'Ticket')
      ) +
      (t.duplicate_of
        ? `<p class="set-status">Trùng với <button type="button" class="hub-link" data-hub-ticket="${esc(t.duplicate_of.id)}">#${t.duplicate_of.number} ${esc(t.duplicate_of.title)}</button> – theo dõi tiếp ở ticket gốc.</p>`
        : t.duplicate_of_hidden
          ? `<p class="set-status">Ticket này được đánh dấu trùng với một ticket khác mà bạn không có quyền xem.</p>`
          : '') +
      `<div class="hub-cols"><div>` +
      `<section class="set-card"><h3>Nội dung</h3><div class="hub-text">${esc(t.body)}</div>` +
      field('Bước tái hiện', t.reproduction_steps) +
      field('Kết quả thực tế', t.actual_result) +
      field('Kết quả mong đợi', t.expected_result) +
      field('Môi trường', t.environment) +
      field('Phiên bản phần mềm', t.software_version) +
      `</section>` +
      (c.process
        ? `<section class="set-card"><h3>AI hỗ trợ</h3><p class="set-desc">AI chạy với quyền của bạn tại lúc chạy – chỉ so với ticket và tài liệu bạn được xem. Kết quả là gợi ý; AI không tự đóng, gộp ticket hay sửa tài liệu.</p>` +
          `<div class="hub-actions"><button type="button" class="btn" data-hub="tk-ai" data-purpose="duplicates"${running ? ' disabled' : ''}>Kiểm tra trùng</button>` +
          `<button type="button" class="btn" data-hub="tk-ai" data-purpose="proposals"${running ? ' disabled' : ''}>Đề xuất sửa tài liệu</button>${running ? '<span class="hub-sub"><span class="ai-spinner"></span> AI đang chạy…</span>' : ''}</div>` +
          det.checks.map(checkCard).join('') +
          `</section>` +
          (det.proposals.length || det.hidden_proposals
            ? `<section class="set-card"><h3>Đề xuất sửa tài liệu</h3>${det.proposals.map(proposalCard).join('')}` +
              (det.hidden_proposals ? `<p class="hub-sub">${det.hidden_proposals} đề xuất cho tài liệu ngoài quyền xem của bạn được ẩn.</p>` : '') +
              `</section>`
            : '')
        : '') +
      `</div><div>` +
      `<section class="set-card"><h3>Thông tin</h3><div class="hub-field"><b>Giao cho</b><div>${who(t.assignee)}</div></div><div class="hub-field"><b>Người gửi</b><div>${who(t.author)}</div></div>` +
      `<div class="hub-field"><b>Cập nhật</b><div>${fmtTime(t.updated_at)}</div></div></section>` +
      `<section class="set-card"><h3>Hoạt động</h3><ul class="hub-timeline">${det.activity
        .map((a) => `<li>${esc(a.text)}<div class="hub-sub">${esc((a.actor && a.actor.display_name) || 'Hệ thống')} · ${fmtTime(a.created_at)}</div></li>`)
        .join('')}</ul></section></div></div>`;
    if (running) {
      clearTimeout(S.ticketPoll);
      S.ticketPoll = setTimeout(() => S.visible && S.page === 'ticket' && S.sub === id && HUB.render(), 3000);
    }
  };

  const CHECK_ST = { pending: ['st-pending', 'Đang chạy'], completed: ['st-published', 'Xong'], failed: ['err', 'Thất bại'], insufficient_access: ['err', 'Thiếu quyền'] };
  function checkCard(c) {
    const [cls, lbl] = CHECK_ST[c.status] || ['muted', c.status];
    const result =
      c.status === 'completed'
        ? c.purpose === 'duplicates'
          ? c.result === 'candidates_found'
            ? 'Có ticket nghi trùng – xem xét bên dưới.'
            : 'Không tìm thấy ticket trùng trong phạm vi đã kiểm tra (không khẳng định chắc chắn không có).'
          : c.result === 'candidates_found'
            ? 'Có đề xuất sửa tài liệu.'
            : 'Không có đề xuất.'
        : '';
    return (
      `<div class="hub-check"><div class="hub-check-head"><b>${c.purpose === 'duplicates' ? 'Kiểm tra trùng' : 'Đề xuất tài liệu'}</b>${pill(cls, lbl)}` +
      `<span class="hub-sub">${c.trigger_mode === 'automatic' ? 'tự động' : 'thủ công'} · thay mặt ${esc((c.acting_user && c.acting_user.display_name) || '')} · ${c.engine === 'ai' ? 'AI' : 'so khớp từ khoá'} · ${fmtRel(c.created_at)}</span></div>` +
      (result ? `<p class="set-desc">${result}</p>` : '') +
      (c.note ? `<p class="msg warn">${esc(c.note)}</p>` : '') +
      (c.checked_scope ? `<p class="hub-sub">Phạm vi: ${esc(c.checked_scope)}</p>` : '') +
      (c.candidates.length
        ? `<ul class="hub-list">${c.candidates
            .map(
              (x) =>
                `<li><span><button type="button" class="hub-link" data-hub-ticket="${esc(x.ticket.id)}">#${x.ticket.number} ${esc(x.ticket.title)}</button> ${tpill(x.ticket.status)}<small class="hub-sub"> – ${esc(x.reason)}</small></span>` +
                (x.decision === 'suggested'
                  ? `<span class="hub-row-actions"><button type="button" class="btn sm" data-hub="cand" data-id="${esc(x.id)}" data-d="rejected">Không trùng</button><button type="button" class="btn sm primary" data-hub="cand" data-id="${esc(x.id)}" data-d="confirmed">Xác nhận trùng</button></span>`
                  : pill(x.decision === 'confirmed' ? 'st-published' : 'muted', x.decision === 'confirmed' ? 'Đã xác nhận' : 'Đã bác bỏ')) +
                `</li>`
            )
            .join('')}</ul>`
        : '') +
      (c.hidden ? `<p class="hub-sub">${c.hidden} kết quả ngoài quyền xem của bạn được ẩn.</p>` : '') +
      `</div>`
    );
  }

  const PROP_ST = { proposed: ['st-pending', 'Đề xuất'], accepted: ['st-approved', 'Chấp nhận'], implemented: ['st-approved', 'Đã đưa vào dự thảo'], applied: ['st-published', 'Đã áp dụng'], rejected: ['muted', 'Từ chối'] };
  function proposalCard(p) {
    const [cls, lbl] = PROP_ST[p.status] || ['muted', p.status];
    return (
      `<div class="hub-prop"><div class="hub-check-head"><button type="button" class="hub-link" data-hub-doc="${esc(p.document_id)}"><code>${esc(p.document_code)}</code></button>` +
      `<span class="hub-sub">bản ${esc(p.based_on_version)} · ${esc(p.section)}</span>${pill(cls, lbl)}</div>` +
      (p.stale ? `<p class="msg warn">Tài liệu đã có bản phát hành mới hơn bản ${esc(p.based_on_version)} – rà soát lại căn cứ trước khi đưa vào dự thảo.</p>` : '') +
      `<div class="hub-text">${esc(p.proposed_change)}</div><p class="hub-sub">Lý do: ${esc(p.reason)}</p>` +
      (p.can_decide
        ? `<div class="hub-row-actions">` +
          (p.status === 'proposed'
            ? `<button type="button" class="btn sm" data-hub="prop" data-id="${esc(p.id)}" data-d="rejected">Từ chối</button><button type="button" class="btn sm primary" data-hub="prop" data-id="${esc(p.id)}" data-d="accepted">Chấp nhận</button>`
            : '') +
          (p.status === 'accepted' ? `<button type="button" class="btn sm primary" data-hub="prop-draft" data-id="${esc(p.id)}" data-doc="${esc(p.document_id)}">Đưa vào bản dự thảo…</button>` : '') +
          (p.status === 'rejected' ? `<button type="button" class="btn sm" data-hub="prop" data-id="${esc(p.id)}" data-d="proposed">Xem xét lại</button>` : '') +
          `</div>`
        : '') +
      `</div>`
    );
  }

  // ------------------------------------------------------------ thao tác
  const tid = () => S.sub;
  HUB.actions['tk-ai'] = async (b) => {
    b.disabled = true;
    await API.post(`/tickets/${tid()}/ai/${b.dataset.purpose}`);
    toast('AI đang chạy – kết quả hiện ở đây khi xong', 'info');
    HUB.render();
  };
  HUB.actions.cand = async (b) => {
    await API.post(`/ticket-candidates/${b.dataset.id}/decision`, { decision: b.dataset.d });
    HUB.render();
  };
  HUB.actions.prop = async (b) => {
    await API.post(`/ticket-proposals/${b.dataset.id}/decision`, { decision: b.dataset.d });
    HUB.render();
  };
  HUB.actions['prop-draft'] = async (b) => {
    const det = await API.get(`/documents/${b.dataset.doc}`);
    const d = det.document;
    const draft = det.versions.find((v) => v.id === d.working_version_id);
    if (!draft) {
      const ok = await HUB.confirm(
        `${d.code} chưa có bản dự thảo`,
        'Tạo phiên bản mới từ bản đang phát hành (ở trang tài liệu), sửa theo đề xuất, rồi quay lại liên kết đề xuất với bản dự thảo đó.',
        'Mở tài liệu'
      );
      if (ok) HUB.go('doc', d.id);
      return;
    }
    const r = await HUB.dialog({
      title: 'Đưa đề xuất vào bản dự thảo',
      body: `<p class="modal-msg">Liên kết đề xuất với bản ${esc(draft.version)} (${esc(draft.status_label)}) của ${esc(d.code)}. Hệ thống chỉ ghi liên kết, không tự sửa nội dung – người soạn sửa theo đề xuất. Đề xuất thành "Đã áp dụng" khi bản này được phát hành.</p>`,
      ok: 'Liên kết',
      onOk: () => API.post(`/ticket-proposals/${b.dataset.id}/draft`, { version_id: draft.id }),
    });
    if (r) HUB.render();
  };
  HUB.actions['tk-status'] = async () => {
    const t = S.ticketDetail.ticket;
    const next = NEXT[t.status] || [];
    const r = await HUB.dialog({
      title: `Trạng thái #${t.number}`,
      body:
        `<label class="f"><span>Chuyển từ “${esc(t.status_label)}” sang</span><select name="status">${next.map((s) => `<option value="${s}">${ST[s][1]}</option>`).join('')}</select></label>` +
        `<label class="f"><span>Ghi chú cho người gửi (không bắt buộc)</span><textarea name="note" rows="3"></textarea></label>` +
        `<p class="hint">Hoàn tất ticket là xác nhận riêng – phát hành tài liệu không đồng nghĩa tính năng đã có hay lỗi đã được sửa.</p>`,
      onOk: (f) => API.post(`/tickets/${t.id}/status`, clean(HUB.formData(f))),
    });
    if (r) HUB.render();
  };
  HUB.actions['tk-assign'] = async () => {
    const t = S.ticketDetail.ticket;
    const members = S.ws && S.ws.id === t.workspace_id ? await HUB.members() : [];
    const r = await HUB.dialog({
      title: `Giao #${t.number}`,
      body: `<label class="f"><span>Người xử lý (phải có quyền xem và xử lý ticket)</span><select name="user_id"><option value="">– Bỏ giao –</option>${members
        .map((m) => `<option value="${esc(m.user.id)}"${m.user.id === t.assignee_id ? ' selected' : ''}>${esc(m.user.display_name)}</option>`)
        .join('')}</select></label>`,
      onOk: (f) => API.post(`/tickets/${t.id}/assign`, { user_id: HUB.formData(f).user_id || null }),
    });
    if (r) HUB.render();
  };
  HUB.actions['tk-dup'] = async () => {
    const t = S.ticketDetail.ticket;
    const r = await HUB.dialog({
      title: `#${t.number} trùng với ticket nào?`,
      body: `<label class="f"><span>Số ticket gốc</span><input name="n" type="number" min="1" required placeholder="12"></label><p class="hint">Ticket gốc phải cùng dự án và bạn xem được; không tạo vòng trùng.</p>`,
      ok: 'Đánh dấu trùng',
      onOk: async (f) => {
        const n = parseInt(HUB.formData(f).n, 10);
        const found = await API.get(`/workspaces/${t.workspace_id}/tickets?q=${n}`);
        const orig = found.find((x) => x.number === n);
        if (!orig) throw new Error(`Không thấy ticket #${n} (hoặc bạn không được xem)`);
        return API.post(`/tickets/${t.id}/duplicate`, { original_ticket_id: orig.id });
      },
    });
    if (r) HUB.render();
  };
  HUB.actions['tk-edit'] = async () => {
    const t = S.ticketDetail.ticket;
    const r = await HUB.dialog({
      title: `Sửa #${t.number}`,
      wide: true,
      body: ticketForm(t),
      onOk: (f) => API.patch(`/tickets/${t.id}`, clean(HUB.formData(f))),
    });
    if (r) HUB.render();
  };

  // ================================================================ QUYỀN TICKET
  HUB.pages['ticket-access'] = async (el, { isCurrent }) => {
    const [a, groups, members] = await Promise.all([API.get(`/workspaces/${S.ws.id}/ticket-access`), HUB.groups(), HUB.members()]);
    if (!isCurrent()) return;
    const canAny = a.can_decide_view || a.can_decide_process;
    el.innerHTML =
      HUB.head(
        'Quyền ticket',
        'Không ai có quyền xem hay xử lý ticket mặc định theo vai trò – kể cả workspace owner. Người gửi luôn xem được ticket của mình. Quyền ticket không kèm quyền tài liệu.',
        canAny ? `<button type="button" class="btn primary" data-hub="grant-add">${svg(ICON.plus, 14)} Cấp quyền</button>` : ''
      ) +
      `<section class="set-card hub-flush"><h3 class="hub-card-h">Quyền đã cấp</h3>${
        a.grants.length
          ? `<table class="hub-table"><thead><tr><th>Quyền</th><th>Cấp cho</th><th>Phạm vi</th><th>Lúc</th><th></th></tr></thead><tbody>${a.grants
              .map(
                (g) =>
                  `<tr><td>${g.kind === 'view' ? pill('st-approved', 'Xem') : pill('st-pending', 'Xử lý')}</td><td>${g.subject_type === 'group' ? 'Group ' : ''}<b>${esc(g.subject_name || g.subject_id)}</b></td>` +
                  `<td>${g.scope_type === 'workspace' ? 'Cả workspace' : 'Ticket của group ' + esc(g.scope_name || '')}</td><td class="hub-sub">${fmtRel(g.created_at)}</td>` +
                  `<td class="hub-right">${(g.kind === 'view' ? a.can_decide_view : a.can_decide_process) ? `<button type="button" class="btn sm" data-hub="grant-del" data-id="${esc(g.id)}">Thu hồi</button>` : ''}</td></tr>`
              )
              .join('')}</tbody></table>`
          : empty('Chưa cấp quyền ticket cho ai.')
      }</section>` +
      `<section class="set-card"><h3>Uỷ quyền quyết định</h3><p class="set-desc">Workspace owner uỷ quyền cho người khác quyết định cấp quyền xem / xử lý ticket. Người được uỷ quyền không tự có các quyền đó.</p>${
        a.delegations.length
          ? `<ul class="hub-list">${a.delegations
              .map(
                (d) =>
                  `<li><span>${who(d.delegate)} <small class="hub-sub">quyết định: ${[d.can_decide_view && 'xem', d.can_decide_process && 'xử lý'].filter(Boolean).join(', ')}</small></span>` +
                  (a.can_manage_delegations ? `<button type="button" class="btn sm" data-hub="deleg-del" data-id="${esc(d.id)}">Thu hồi</button>` : '') +
                  `</li>`
              )
              .join('')}</ul>`
          : '<p class="hub-muted hub-small">Chưa uỷ quyền cho ai.</p>'
      }${
        a.can_manage_delegations
          ? `<form class="hub-inline" data-hub-form="deleg"><select class="hub-select" name="user_id" required><option value="">Chọn thành viên…</option>${members
              .map((m) => `<option value="${esc(m.user.id)}">${esc(m.user.display_name)}</option>`)
              .join('')}</select><label class="chk"><input type="checkbox" name="can_decide_view" checked> Xem</label><label class="chk"><input type="checkbox" name="can_decide_process"> Xử lý</label><button type="submit" class="btn">Uỷ quyền</button></form>`
          : ''
      }</section>` +
      `<section class="set-card"><h3>AI tự kiểm tra trùng</h3><div class="set-row"><div class="set-row-text"><b>Cho AI tự kiểm tra ticket mới thay mặt tôi</b>` +
      `<span>AI dùng quyền xem / xử lý của bạn tại lúc chạy, không thấy dữ liệu ngoài quyền của bạn. Bộ so: ${a.ai_engine === 'ai' ? 'AI (Claude)' : 'so khớp từ khoá – máy chủ chưa cấu hình AI'}.</span></div>` +
      `<span class="set-switch"><input type="checkbox" role="switch" data-hub-change="ai-deleg"${a.my_ai_delegation ? ' checked' : ''}><span></span></span></div></section>`;
    S.ticketAccessGroups = groups;
  };
  HUB.changes['ai-deleg'] = async (t) => {
    try {
      await API.put(`/workspaces/${S.ws.id}/ticket-ai-delegation`, { enabled: t.checked });
      toast(t.checked ? 'AI sẽ tự kiểm tra ticket mới thay mặt bạn' : 'Đã tắt AI tự kiểm tra', 'ok');
    } catch (e) {
      t.checked = !t.checked;
      fail(e);
    }
  };
  HUB.actions['grant-add'] = async () => {
    const [a, groups, members] = await Promise.all([API.get(`/workspaces/${S.ws.id}/ticket-access`), HUB.groups(), HUB.members()]);
    const subjects = (type) =>
      type === 'group'
        ? groups.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')
        : members.map((m) => `<option value="${esc(m.user.id)}">${esc(m.user.display_name)} – ${esc(m.user.email)}</option>`).join('');
    const r = await HUB.dialog({
      title: 'Cấp quyền ticket',
      body:
        `<div class="hub-grid2"><label class="f"><span>Quyền</span><select name="kind">${a.can_decide_view ? '<option value="view">Xem ticket</option>' : ''}${a.can_decide_process ? '<option value="process">Xử lý ticket</option>' : ''}</select></label>` +
        `<label class="f"><span>Cấp cho</span><select name="subject_type" data-subj><option value="group">Một group</option><option value="user">Một người</option></select></label></div>` +
        `<label class="f"><span>Group / người</span><select name="subject_id" data-subj-list>${subjects('group')}</select></label>` +
        `<label class="f"><span>Áp dụng cho</span><select name="scope"><option value="workspace:">Mọi ticket của workspace</option>${groups
          .map((g) => `<option value="group:${esc(g.id)}">Ticket gắn với group ${esc(g.name)}</option>`)
          .join('')}</select></label>` +
        `<p class="hint">Xử lý cần cả quyền xem. Ticket không gắn group chỉ xét quyền ở phạm vi workspace.</p>`,
      ok: 'Cấp quyền',
      onOpen: (f) => $('[data-subj]', f).addEventListener('change', (e) => ($('[data-subj-list]', f).innerHTML = subjects(e.target.value))),
      onOk: (f) => {
        const d = HUB.formData(f);
        const [scope_type, scope_id] = d.scope.split(':');
        return API.post(`/workspaces/${S.ws.id}/ticket-grants`, { kind: d.kind, subject_type: d.subject_type, subject_id: d.subject_id, scope_type, scope_id: scope_id || null });
      },
    });
    if (r) HUB.render();
  };
  HUB.actions['grant-del'] = async (b) => {
    await API.del(`/ticket-grants/${b.dataset.id}`);
    HUB.render();
  };
  HUB.actions['deleg-del'] = async (b) => {
    await API.del(`/ticket-delegations/${b.dataset.id}`);
    HUB.render();
  };
  HUB.forms.deleg = async (form, d) => {
    await API.post(`/workspaces/${S.ws.id}/ticket-delegations`, d);
    HUB.render();
  };
})(window.DE);
