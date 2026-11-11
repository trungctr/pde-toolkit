/* =========================================================================
 * PlantUML -> diagram JSON của app (chạy ngay trong trình duyệt, KHÔNG gửi
 * nội dung lên máy chủ PlantUML).
 *
 * Hỗ trợ tập con phổ biến của: sequence, use case, class, activity (cú pháp
 * mới :hành động; và cú pháp cũ (*) -->), state, component / deployment, ER
 * (entity + crow's foot). Phần không hiểu được bỏ qua và liệt kê trong warnings.
 *
 * PlantUML không ghi toạ độ (Graphviz tự xếp), nên app tự tính bố cục:
 *  - sequence, activity: xếp theo cấu trúc (thứ tự message / nhánh if, while, fork)
 *  - các loại còn lại: xếp lớp kiểu Graphviz "dot" (phá chu trình, chia tầng theo
 *    đường dài nhất, giảm giao cắt bằng barycenter, căn toạ độ), có khung lồng nhau
 *    (package, rectangle, node, state con).
 *
 * API: DE.plantuml.convert(text) -> { ok, doc, kind, warnings } | { ok:false, error, kind }
 *
 * Mermaid (DE.mermaidConv.convert, cùng dạng kết quả): sequence / class / state / ER có cú pháp gần
 * PlantUML nên được dịch từng dòng rồi dùng chung bộ phân tích + bố cục ở đây; lưu đồ (flowchart /
 * graph) có bộ đọc riêng, ra các hình của chế độ Flowchart. Gantt, pie, mindmap… không có hình tương
 * ứng trên whiteboard -> báo không chuyển được (tài liệu vẫn vẽ chúng bằng thư viện Mermaid).
 * ========================================================================= */
(function (DE) {
  'use strict';
  const PU = (DE.plantuml = {});
  const FS = 14, LH = 18.2;
  const tw = (s, bold) => Math.max(0, ...String(s == null ? '' : s).split('\n').map((l) => DE.measure(l, FS, bold ? 'bold' : 'normal')));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const unq = (s) =>
    String(s == null ? '' : s)
      .trim()
      .replace(/^"([\s\S]*)"$/, '$1')
      .replace(/\\n/g, '\n')
      .trim();
  const wrapLines = (text, w, bold) => String(text || '').split('\n').reduce((n, l) => n + DE.wrap(l, w, FS, bold ? 'bold' : 'normal').length, 0);

  PU.KIND_NAME = {
    sequence: 'Sequence (tuần tự)', usecase: 'Use case', class: 'Class', activity: 'Activity', 'activity-old': 'Activity (cú pháp cũ)',
    state: 'State machine', component: 'Component / Deployment', er: 'ER (cơ sở dữ liệu)',
  };
  const UNSUPPORTED = {
    mindmap: 'sơ đồ tư duy (mindmap)', wbs: 'cây công việc (WBS)', gantt: 'Gantt', salt: 'phác thảo giao diện (salt)', json: 'JSON', yaml: 'YAML',
    ebnf: 'EBNF', regex: 'regex', ditaa: 'ditaa', dot: 'Graphviz dot', math: 'công thức', latex: 'LaTeX', board: 'board', chen: 'ER kiểu Chen', files: 'files',
  };
  PU.looksLike = (text) => /^\s*@start\w+/im.test(String(text || ''));

  // ============================================================ TIỀN XỬ LÝ
  function prep(src) {
    const raw = String(src || '').replace(/\r\n?/g, '\n').replace(/\/'[\s\S]*?'\//g, '');
    const lines = [], ignored = new Set();
    let kind = 'uml', title = '', skip = null;
    for (const r of raw.split('\n')) {
      const l = r.trim();
      if (skip) {
        if (skip.test(l)) skip = null;
        continue;
      }
      if (!l || l.startsWith("'")) continue;
      let m;
      if ((m = l.match(/^@start(\w+)/i))) {
        kind = m[1].toLowerCase();
        continue;
      }
      if (/^@end\w*/i.test(l)) break;
      if ((m = l.match(/^title\s+(.+)$/i))) {
        title = unq(m[1]);
        continue;
      }
      if ((m = l.match(/^(title|legend|header|footer|caption)\b/i))) {
        const k = m[1].toLowerCase();
        if (k !== 'caption' && !/^\w+\s*(left|right|center|top|bottom)?\s*$/i.test(l)) {
          ignored.add('header / footer / legend');
          continue;
        }
        skip = new RegExp(`^end\\s*${k}$`, 'i');
        ignored.add(k === 'title' ? 'tiêu đề nhiều dòng' : 'header / footer / legend');
        continue;
      }
      if (/^skinparam\b.*\{\s*$/i.test(l)) {
        skip = /^\}$/;
        ignored.add('giao diện (skinparam)');
        continue;
      }
      if (/^(skinparam|!theme|skin)\b/i.test(l)) {
        ignored.add('giao diện (skinparam / theme)');
        continue;
      }
      if (/^!(include|import|define|definelong|enddefinelong|pragma|procedure|function|endprocedure|endfunction|if|else|endif|\$)/i.test(l)) {
        ignored.add('lệnh tiền xử lý (!include, !define…)');
        continue;
      }
      if (/^(hide|show|scale|allowmixing|newpage|mainframe|autoactivate|set\s+namespaceseparator|left\s+header|right\s+footer)\b/i.test(l)) continue;
      lines.push(l);
    }
    return { lines, kind, title, ignored: [...ignored] };
  }

  // ============================================================ NHẬN DẠNG LOẠI
  function detect(P) {
    if (P.kind !== 'uml') return P.kind;
    const L = P.lines;
    const any = (re) => L.some((l) => re.test(l));
    if (any(/^(start|stop|kill|detach)$/i) || any(/^:[\s\S]*;$/) || any(/^(else)?if\s*\(.*\)\s*then\b/i) || any(/^(while|repeat|fork|split)\b/i) || any(/^\|[^|]+\|\s*$/)) return 'activity';
    if (any(/\(\*\)/)) return 'activity-old';
    if (any(/\[\*\]/) || any(/^state\s/i)) return 'state';
    if (any(/(\|\||\|o|\}o|\}\|)\s*[-.]+\s*(\|\||o\||o\{|\|\{)/) || any(/^entity\s+.+\{\s*$/i)) return 'er';
    if (any(/^(participant|boundary|control|collections|queue)\s/i) || any(/^(autonumber|activate|deactivate|alt|loop|opt|par|break|critical|ref)\b/i) || any(/^return\b/i)) return 'sequence';
    if (any(/^usecase\s/i) || any(/(^|[\s>\-.])\([^()*]+\)(\s|$|[-.<])/) || any(/^:[^:]+:/)) return 'usecase';
    if (any(/^(abstract|class|interface|enum|annotation|protocol|struct|exception)\s/i) || any(/<\||\|>|\*--|--\*|o--|--o(\s|$)/)) return 'class';
    if (any(/^\[[^\]*]+\]/) || any(/\[[^\]*]+\]\s*[-.]/) || any(/^(component|node|database|artifact|cloud|frame|folder|storage)\s/i)) return 'component';
    if (any(/^(actor|entity|database)\s/i) || any(/^\S+\s*<?-{1,2}>{1,2}\s*\S+\s*(:|$)/)) return 'sequence';
    if (any(/[-.]{1,}>/)) return 'class';
    return 'unknown';
  }

  // ============================================================ CÔNG CỤ CHUNG
  function warner() {
    const list = [];
    const seen = new Set();
    const w = (msg) => {
      if (seen.has(msg) || list.length > 40) return;
      seen.add(msg);
      list.push(msg);
    };
    w.list = list;
    return w;
  }
  const stripWrap = (s) =>
    unq(
      String(s || '')
        .trim()
        .replace(/^\[([\s\S]*)\]$/, '$1')
        .replace(/^\(([\s\S]*)\)$/, '$1')
        .replace(/^:([\s\S]*):$/, '$1')
    );
  /** "Tên" as A | A as "Tên" | A | "Tên" -> { text, key, stereo, open } */
  function nameAlias(rest) {
    let s = String(rest || '').trim();
    let open = false, stereo = '';
    if (/\{\s*$/.test(s)) {
      open = true;
      s = s.replace(/\{\s*$/, '').trim();
    }
    s = s
      .replace(/<<\s*([^>]+?)\s*>>/g, (_, x) => {
        stereo = x;
        return '';
      })
      .replace(/(^|\s)#[\w#.]+(?=\s|$)/g, ' ')
      .replace(/\s+\[\[[^\]]*\]\]/g, '')
      .trim();
    const m = s.match(/^("[^"]*"|\[[^\]]+\]|\([^)]+\)|:[^:]+:|[^\s"]+)\s+as\s+("[^"]*"|[^\s"]+)$/i);
    if (m) {
      const a = stripWrap(m[1]), b = stripWrap(m[2]);
      if (m[2].startsWith('"') && !m[1].startsWith('"')) return { text: b, key: a, stereo, open };
      return { text: a, key: b, stereo, open };
    }
    const t = stripWrap(s);
    return { text: t, key: t, stereo, open };
  }

  // ============================================================ SEQUENCE
  const SEQ_KIND = { participant: 'lifeline', actor: 'actor', boundary: 'lifeline', control: 'lifeline', entity: 'lifeline', database: 'lifeline', collections: 'lifeline', queue: 'lifeline' };
  const SOP = '"[^"]+"|[^\\s"<>\\\\/:\\-+*!]+';
  const SEQ_MSG = new RegExp(`^(${SOP})\\s*([xo]?)(<<?|[\\\\/]{1,2})?(-{1,2})(?:\\[[^\\]]*\\])?(-?)(>>?|[\\\\/]{1,2})?([xo]?)\\s*(${SOP})\\s*(\\+\\+|--|\\*\\*|!!)?\\s*(?::\\s*(.*))?$`, 'u');

  function parseSequence(P, warn) {
    const parts = [], byKey = new Map();
    const get = (tok) => {
      const key = stripWrap(tok);
      let p = byKey.get(key);
      if (!p) {
        p = { key, text: key, kind: 'lifeline' };
        byKey.set(key, p);
        parts.push(p);
      }
      return p;
    };
    const ev = [];
    const L = P.lines;
    for (let i = 0; i < L.length; i++) {
      const l = L[i];
      let m;
      if ((m = l.match(/^(participant|actor|boundary|control|entity|database|collections|queue)\s+(.+)$/i))) {
        const na = nameAlias(m[2].replace(/\s+order\s+-?\d+/i, ''));
        let p = byKey.get(na.key);
        if (!p) {
          p = { key: na.key };
          byKey.set(na.key, p);
          parts.push(p);
        }
        Object.assign(p, { text: na.text, kind: SEQ_KIND[m[1].toLowerCase()] });
      } else if ((m = l.match(/^autonumber\b\s*(\d+)?/i))) ev.push({ t: 'auto', n: m[1] ? +m[1] : 1 });
      else if ((m = l.match(/^(activate|deactivate|destroy)\s+(\S+)/i))) ev.push({ t: m[1].toLowerCase(), who: get(m[2]).key });
      else if ((m = l.match(/^(alt|opt|loop|par|break|critical|group|neg|strict|seq|assert)\b\s*(.*)$/i))) ev.push({ t: 'frag', kind: m[1].toLowerCase(), label: m[2].trim() });
      else if ((m = l.match(/^else\b\s*(.*)$/i))) ev.push({ t: 'else', label: m[1].trim() });
      else if (/^end(\s+(alt|opt|loop|par|group|critical|break))?$/i.test(l)) ev.push({ t: 'end' });
      else if ((m = l.match(/^ref\s+over\s+([^:]+?)\s*:\s*(.*)$/i))) ev.push({ t: 'note', pos: 'over', who: m[1].split(',').map((x) => get(x).key), text: 'ref: ' + unq(m[2]) });
      else if ((m = l.match(/^[hr]?note\s+(left|right|over)(?:\s+of)?\s*([^:]*?)\s*(?::\s*(.*))?$/i))) {
        let text = m[3];
        if (text == null) {
          const body = [];
          while (++i < L.length && !/^end\s*[hr]?note$/i.test(L[i])) body.push(L[i]);
          text = body.join('\n');
        }
        const who = m[2] ? m[2].split(',').map((x) => get(x).key) : parts.length ? [parts[parts.length - 1].key] : [];
        if (who.length) ev.push({ t: 'note', pos: m[1].toLowerCase(), who, text: unq(text) });
      } else if ((m = l.match(/^==\s*(.*?)\s*==$/))) ev.push({ t: 'divider', text: m[1] });
      else if (/^\.\.\./.test(l)) ev.push({ t: 'space', h: 30 });
      else if ((m = l.match(/^\|\|(\d*)\|\|$/))) ev.push({ t: 'space', h: m[1] ? +m[1] : 24 });
      else if ((m = l.match(/^return\b\s*(.*)$/i))) ev.push({ t: 'return', label: unq(m[1]) });
      else if ((m = l.match(SEQ_MSG)) && (m[3] || m[6])) {
        if (m[1] === '[' || m[1] === ']' || m[8] === '[' || m[8] === ']') {
          warn('message đến / từ ngoài sơ đồ ([-> / ->])');
          continue;
        }
        const left = get(m[1]).key, right = get(m[8]).key;
        const lh = m[3] || '', rh = m[6] || '';
        const reverse = lh && !rh;
        ev.push({
          t: 'msg',
          a: reverse ? right : left,
          b: reverse ? left : right,
          dashed: m[4].length > 1 || m[5] === '-',
          async: (rh || lh).length > 1 || /[\\/]/.test(rh || lh),
          bidi: !!(lh && rh),
          act: m[9] || '',
          label: unq(m[10] || ''),
        });
      } else if (!/^(hide|show|skinparam|autonumber|box|end\s*box|space)\b/i.test(l)) warn(`dòng chưa hiểu: ${l.slice(0, 60)}`);
      else if (/^box\b/i.test(l)) warn('nhóm box');
    }
    if (!parts.length) throw new Error('Không tìm thấy đối tượng nào (participant / actor) trong sơ đồ tuần tự');

    // ---- lượt 1: hàng (y) của từng sự kiện, khoảng kích hoạt (activation)
    const TOP = 40, HEAD = parts.some((p) => p.kind === 'actor') ? 74 : 46;
    let y = TOP + HEAD + 34;
    let lastY = y;
    const open = new Map(); // key -> [{ y0, caller }]
    const acts = []; // { key, y0, y1, level }
    const actOrder = []; // thứ tự kích hoạt (cho "return")
    const frags = [], fstack = [];
    const notes = [], dividers = [];
    let num = null;
    const involve = (...keys) => fstack.forEach((f) => keys.forEach((k) => f.who.add(k)));
    const activate = (key, at, caller) => {
      const st = open.get(key) || [];
      st.push({ y0: at, caller, level: st.length });
      open.set(key, st);
      actOrder.push(key);
    };
    const deactivate = (key, at) => {
      const st = open.get(key);
      if (!st || !st.length) return null;
      const a = st.pop();
      acts.push({ key, y0: a.y0, y1: Math.max(at, a.y0 + 18), level: a.level });
      const k = actOrder.lastIndexOf(key);
      if (k >= 0) actOrder.splice(k, 1);
      return a;
    };
    const msgs = [];
    const pushMsg = (e) => {
      const lines = String(e.label || '').split('\n').length;
      y += (lines - 1) * 16;
      e.y = y;
      lastY = y;
      if (num != null) e.label = e.label ? `${num++}: ${e.label}` : String(num++);
      involve(e.a, e.b);
      msgs.push(e);
      y += e.a === e.b ? 62 : 42;
    };
    for (const e of ev) {
      switch (e.t) {
        case 'auto':
          num = e.n;
          break;
        case 'msg':
          pushMsg(e);
          if (e.act === '++') activate(e.b, e.y, e.a);
          else if (e.act === '--') deactivate(e.a, e.y);
          else if (e.act === '!!') while (deactivate(e.b, e.y));
          break;
        case 'return': {
          const callee = actOrder[actOrder.length - 1];
          const st = callee && open.get(callee);
          const caller = st && st.length ? st[st.length - 1].caller : null;
          if (!callee || !caller) {
            warn('"return" không có lời gọi tương ứng');
            break;
          }
          const m = { t: 'msg', a: callee, b: caller, dashed: true, async: false, bidi: false, label: e.label };
          pushMsg(m);
          deactivate(callee, m.y);
          break;
        }
        case 'activate': {
          const caller = msgs.length ? msgs[msgs.length - 1].a : null;
          activate(e.who, msgs.length ? lastY : y, caller);
          break;
        }
        case 'deactivate':
          deactivate(e.who, lastY);
          break;
        case 'destroy':
          while (deactivate(e.who, lastY));
          break;
        case 'frag': {
          const f = { kind: e.kind, label: e.label, top: y - 14, elses: [], who: new Set(), depth: fstack.length };
          fstack.push(f);
          frags.push(f);
          y += 30;
          break;
        }
        case 'else': {
          const f = fstack[fstack.length - 1];
          if (!f) break;
          y += 4;
          f.elses.push({ y, label: e.label });
          y += 26;
          break;
        }
        case 'end': {
          const f = fstack.pop();
          if (!f) break;
          f.bottom = y - 8;
          y += 14;
          break;
        }
        case 'note': {
          const h = Math.max(36, String(e.text).split('\n').length * LH + 18);
          notes.push({ ...e, y: y - 8, h });
          involve(...e.who);
          y += h + 8;
          break;
        }
        case 'divider':
          y += 6;
          dividers.push({ text: e.text, y });
          y += 34;
          break;
        case 'space':
          y += e.h;
          break;
      }
    }
    while (fstack.length) {
      const f = fstack.pop();
      f.bottom = y - 8;
      warn('khối alt / loop… thiếu "end"');
    }
    for (const [key, st] of open) while (st.length) deactivate(key, y - 10);
    const H = y + 20;

    // ---- cột: khoảng cách đủ cho chữ của message
    const n = parts.length;
    const idx = new Map(parts.map((p, i) => [p.key, i]));
    const colW = parts.map((p) => (p.kind === 'actor' ? Math.max(80, tw(p.text) + 20) : clamp(tw(p.text, true) + 32, 100, 260)));
    const need = parts.map((_, i) => (i ? (colW[i - 1] + colW[i]) / 2 + 40 : 0));
    const spans = msgs.map((m) => ({ lo: Math.min(idx.get(m.a), idx.get(m.b)), hi: Math.max(idx.get(m.a), idx.get(m.b)), w: tw(m.label) + 44 }));
    for (const nt of notes) {
      const ws = tw(nt.text) + 40;
      const i = idx.get(nt.who[0]);
      if (nt.pos === 'right' && i + 1 < n) spans.push({ lo: i, hi: i + 1, w: ws + 40 });
      if (nt.pos === 'left' && i > 0) spans.push({ lo: i - 1, hi: i, w: ws + 40 });
    }
    spans.sort((a, b) => a.hi - a.lo - (b.hi - b.lo));
    for (const s of spans) {
      if (s.lo === s.hi) {
        if (s.hi + 1 < n) need[s.hi + 1] = Math.max(need[s.hi + 1], s.w + 30);
        continue;
      }
      let sum = 0;
      for (let i = s.lo + 1; i <= s.hi; i++) sum += need[i];
      if (sum < s.w) need[s.hi] += s.w - sum;
    }
    const leftNote = Math.max(0, ...notes.filter((nt) => nt.pos === 'left' && idx.get(nt.who[0]) === 0).map((nt) => tw(nt.text) + 50));
    const cx = [];
    parts.forEach((p, i) => (cx[i] = i ? cx[i - 1] + need[i] : 40 + Math.max(colW[0] / 2, leftNote)));

    // ---- dựng node / edge
    const nodes = [], edges = [];
    let nid = 0, eid = 0;
    const N = (o) => {
      const node = Object.assign({ id: 'n' + ++nid, style: {} }, o);
      nodes.push(node);
      return node;
    };
    const life = new Map();
    parts.forEach((p, i) => {
      const w = colW[i];
      life.set(p.key, N({ type: p.kind === 'actor' ? 'uml.actorLifeline' : 'uml.lifeline', x: cx[i] - w / 2, y: TOP, w, h: H - TOP, text: p.text }));
    });
    const actNodes = acts.map((a) => {
      const i = idx.get(a.key);
      const node = N({ type: 'uml.activation', x: cx[i] - 8 + a.level * 6, y: a.y0, w: 16, h: a.y1 - a.y0, text: '' });
      return { ...a, node };
    });
    // khung alt/loop vẽ sau thanh kích hoạt: nhãn của khung không bị che
    for (const f of frags) {
      const ids = f.who.size ? [...f.who].map((k) => idx.get(k)) : parts.map((_, i) => i);
      const lo = Math.min(...ids), hi = Math.max(...ids);
      const inset = f.depth * 10;
      const x0 = cx[lo] - Math.max(colW[lo], 120) / 2 - 16 + inset, x1 = cx[hi] + Math.max(colW[hi], 120) / 2 + 16 - inset;
      const label = f.label ? `${f.kind} [${f.label.replace(/^\[|\]$/g, '')}]` : f.kind;
      N({ type: 'uml.fragment', x: x0, y: f.top, w: Math.max(x1 - x0, 160), h: Math.max(f.bottom - f.top, 50), text: label });
      for (const s of f.elses) {
        const a = N({ type: 'basic.text', x: x0, y: s.y - 1, w: 2, h: 2, text: '' });
        const b = N({ type: 'basic.text', x: x0 + Math.max(x1 - x0, 160) - 2, y: s.y - 1, w: 2, h: 2, text: '' });
        edges.push({ id: 'e' + ++eid, type: 'uml.association', source: a.id, target: b.id, label: '', sourcePort: 'right', targetPort: 'left', style: { dash: 'dashed', endArrow: 'none', stroke: '#475569' } });
        if (s.label) {
          const lt = `[${s.label.replace(/^\[|\]$/g, '')}]`;
          N({ type: 'basic.rect', x: x0 + 6, y: s.y + 3, w: tw(lt) * 0.93 + 14, h: 20, text: lt, style: { fill: '#ffffff', stroke: 'none', fontSize: 13 } });
        }
      }
    }
    const endAt = (key, yy) => {
      let best = null;
      for (const a of actNodes) if (a.key === key && yy >= a.y0 - 0.5 && yy <= a.y1 + 0.5 && (!best || a.level > best.level)) best = a;
      if (best) return { id: best.node.id, anchor: clamp((yy - best.node.y) / best.node.h, 0, 1) };
      const l = life.get(key);
      return { id: l.id, anchor: clamp((yy - l.y) / l.h, 0, 1) };
    };
    for (const m of msgs) {
      const self = m.a === m.b;
      const s = endAt(m.a, m.y), t = endAt(m.b, self ? m.y + 22 : m.y);
      const e = {
        id: 'e' + ++eid,
        type: m.dashed ? 'uml.returnMessage' : m.async ? 'uml.asyncMessage' : 'uml.syncMessage',
        source: s.id, target: t.id, label: m.label, sourceAnchor: Math.round(s.anchor * 10000) / 10000, targetAnchor: Math.round(t.anchor * 10000) / 10000, style: {},
      };
      if (m.bidi) e.style.startArrow = m.async ? 'open' : 'arrow';
      if (m.dashed && m.async) e.style.endArrow = 'open';
      if (self) e.routing = 'orthogonal';
      edges.push(e);
    }
    for (const nt of notes) {
      const ii = nt.who.map((k) => idx.get(k));
      const w = clamp(tw(nt.text) + 30, 80, 320);
      let x;
      if (nt.pos === 'left') x = cx[ii[0]] - w - 16;
      else if (nt.pos === 'right') x = cx[ii[0]] + 16;
      else {
        const lo = Math.min(...ii), hi = Math.max(...ii);
        const span = cx[hi] - cx[lo];
        const ww = Math.max(w, span + 80);
        x = (cx[lo] + cx[hi]) / 2 - ww / 2;
        N({ type: 'uml.note', x, y: nt.y, w: ww, h: nt.h, text: nt.text });
        continue;
      }
      N({ type: 'uml.note', x, y: nt.y, w, h: nt.h, text: nt.text });
    }
    for (const d of dividers) {
      const x0 = cx[0] - colW[0] / 2, x1 = cx[n - 1] + colW[n - 1] / 2;
      N({ type: 'basic.text', x: x0, y: d.y, w: x1 - x0, h: 26, text: `═══ ${d.text} ═══`, style: { fontWeight: 'bold', fontSize: 13 } });
    }
    return { nodes, edges };
  }

  // ============================================================ ACTIVITY (cú pháp mới)
  function parseActivity(P, warn) {
    const L = P.lines;
    let i = 0, lane = null, pendingLabel = '';
    const lanes = [];
    const ACT_END = /[;|<>/\]}]\s*$/;
    const readAction = (first) => {
      let s = first.slice(1);
      while (!ACT_END.test(s) && i < L.length) s += '\n' + L[i++];
      return s.replace(ACT_END, '').trim().replace(/\\n/g, '\n');
    };
    const takeLabel = () => {
      const l = pendingLabel;
      pendingLabel = '';
      return l;
    };
    function seq(stop) {
      const out = [];
      while (i < L.length) {
        const l = L[i];
        if (stop && stop.test(l)) return out;
        i++;
        let m;
        if (/^start$/i.test(l)) out.push({ t: 'start', lane });
        else if (/^(stop|end)$/i.test(l)) out.push({ t: 'stop', lane, label: takeLabel() });
        else if (/^(kill|detach)$/i.test(l)) out.push({ t: 'kill', lane, label: takeLabel() });
        else if (l.startsWith(':')) out.push({ t: 'action', text: readAction(l), lane, label: takeLabel() });
        else if ((m = l.match(/^if\s*\((.*?)\)\s*(?:then\s*(?:\((.*?)\))?)?\s*$/i))) {
          const node = { t: 'if', cond: m[1].trim(), lane, label: takeLabel(), branches: [] };
          node.branches.push({ label: (m[2] || '').trim(), body: seq(/^(else\s*if|elseif|else|endif|end\s*if)\b/i) });
          while (i < L.length) {
            const t = L[i++];
            let mm;
            if ((mm = t.match(/^(?:else\s*if|elseif)\s*\((.*?)\)\s*(?:then\s*(?:\((.*?)\))?)?\s*$/i)))
              node.branches.push({ label: [mm[1].trim(), (mm[2] || '').trim()].filter(Boolean).join(' → '), body: seq(/^(else\s*if|elseif|else|endif|end\s*if)\b/i) });
            else if ((mm = t.match(/^else\b\s*(?:\((.*?)\))?/i))) node.branches.push({ label: (mm[1] || '').trim(), body: seq(/^(endif|end\s*if)\b/i), isElse: true });
            else if (/^(endif|end\s*if)\b/i.test(t)) break;
          }
          out.push(node);
        } else if ((m = l.match(/^while\s*\((.*?)\)\s*(?:is\s*\((.*?)\))?\s*$/i))) {
          const node = { t: 'while', cond: m[1].trim(), yes: (m[2] || '').trim(), lane, label: takeLabel() };
          node.body = seq(/^(endwhile|end\s*while)\b/i);
          const em = (L[i++] || '').match(/\((.*?)\)/);
          node.no = em ? em[1].trim() : '';
          out.push(node);
        } else if (/^repeat\b(?!\s*while)/i.test(l)) {
          const node = { t: 'repeat', lane, label: takeLabel() };
          const rest = l.replace(/^repeat\s*/i, '');
          const first = rest.startsWith(':') ? [{ t: 'action', text: readAction(rest), lane }] : [];
          node.body = first.concat(seq(/^repeat\s*while\b|^repeatwhile\b/i));
          const em = (L[i++] || '').match(/^repeat\s*while\s*\((.*?)\)\s*(?:is\s*\((.*?)\))?\s*(?:not\s*\((.*?)\))?\s*$/i);
          Object.assign(node, { cond: em ? em[1].trim() : '', yes: (em && em[2]) || '', no: (em && em[3]) || '' });
          out.push(node);
        } else if (/^(fork|split)$/i.test(l)) {
          const node = { t: 'fork', lane, label: takeLabel() };
          const END = /^(fork\s*again|split\s*again|end\s*fork|endfork|end\s*split|endsplit|end\s*merge|endmerge)\b/i;
          node.branches = [seq(END)];
          while (i < L.length) {
            const t = L[i++];
            if (/again/i.test(t)) node.branches.push(seq(END));
            else break;
          }
          out.push(node);
        } else if ((m = l.match(/^\|(?:#[^|]*\|)?([^|]+)\|/))) {
          lane = m[1].trim();
          if (!lanes.includes(lane)) lanes.push(lane);
        } else if ((m = l.match(/^-+>\s*(.*?);?\s*$/))) pendingLabel = m[1].trim();
        else if (/^(partition|package|rectangle|card|group)\b/i.test(l) || l === '}' || /^end\s*group$/i.test(l)) warn('nhóm partition / group (vẽ phẳng)');
        else if (/^(floating\s+)?[hr]?note\b/i.test(l)) {
          if (!/:/.test(l)) while (i < L.length && !/^end\s*[hr]?note$/i.test(L[i++]));
          warn('ghi chú (note) trong activity');
        } else if (/^(backward|break|goto|label)\b/i.test(l)) warn(`chưa hỗ trợ: ${l.split(/\s/)[0]}`);
        else warn(`dòng chưa hiểu: ${l.slice(0, 60)}`);
      }
      return out;
    }
    const tree = seq(null);
    if (!tree.length) throw new Error('Sơ đồ activity trống');

    // ---- bố cục theo cấu trúc
    const GY = 34, GX = 40, CH = 34;
    const nodes = [], allEdges = [];
    let nid = 0;
    const mk = (type, text, w, h, ln) => {
      const n = { id: 'n' + ++nid, type, text: text || '', w, h, x: 0, y: 0, style: {}, lane: ln };
      nodes.push(n);
      return n;
    };
    const actionNode = (text, ln) => {
      const w = clamp(tw(text) + 34, 110, 260);
      const lines = wrapLines(text, w - 20);
      return mk('uml.action', text, w, Math.max(44, lines * LH + 22), ln);
    };
    const decisionNode = (cond, ln) => {
      if (!cond) return mk('uml.decision', '', 36, 36, ln);
      const w = clamp(tw(cond) + 64, 110, 240);
      const lines = wrapLines(cond, w * 0.6);
      return mk('flow.decision', cond, w, Math.max(60, lines * LH + 34), ln);
    };
    const nb = (n) => ({ w: n.w, h: n.h, cx: n.w / 2, items: [{ n, x: 0, y: 0 }], kids: [], edges: [], entry: n, exits: [{ n }] });
    const E = (from, to, label, extra) => Object.assign({ from, to, label: label || '' }, extra);

    function seqBlock(stmts) {
      const bs = stmts.map(stmt).filter(Boolean);
      if (!bs.length) return null;
      const cx = Math.max(...bs.map((b) => b.cx));
      const right = Math.max(...bs.map((b) => b.w - b.cx));
      const B = { w: cx + right, h: 0, cx, items: [], kids: [], edges: [], entry: bs[0].entry, exits: [] };
      let y = 0, prev = null;
      for (const b of bs) {
        B.kids.push({ b, x: cx - b.cx, y });
        if (prev && b.entry) for (const ex of prev) B.edges.push(E(ex.n, b.entry, ex.label || b.inLabel, ex.extra));
        prev = b.exits;
        y += b.h + GY;
      }
      B.h = y - GY;
      B.exits = prev || [];
      return B;
    }
    function stmt(s) {
      let b;
      switch (s.t) {
        case 'start':
          b = nb(mk('uml.initial', '', 30, 30, s.lane));
          break;
        case 'stop':
          b = nb(mk('uml.final', '', 34, 34, s.lane));
          b.exits = [];
          break;
        case 'kill':
          b = nb(mk('uml.flowFinal', '', 34, 34, s.lane));
          b.exits = [];
          break;
        case 'action':
          b = nb(actionNode(s.text, s.lane));
          break;
        case 'if':
          b = ifBlock(s);
          break;
        case 'while':
          b = whileBlock(s);
          break;
        case 'repeat':
          b = repeatBlock(s);
          break;
        case 'fork':
          b = forkBlock(s);
          break;
      }
      if (b) b.inLabel = s.label || '';
      return b;
    }
    function sideBySide(blocks, minW) {
      // blocks: [{ b|null }] -> vị trí x trong hàng, tổng bề rộng
      let x = 0;
      const xs = blocks.map((it) => {
        const w = it.b ? it.b.w : 40;
        const at = x;
        x += w + GX;
        return at;
      });
      const total = Math.max(x - GX, minW);
      const off = (total - (x - GX)) / 2;
      return { xs: xs.map((v) => v + off), total };
    }
    function ifBlock(s) {
      const D = decisionNode(s.cond, s.lane);
      const br = s.branches.map((x) => ({ x, b: seqBlock(x.body) }));
      if (!s.branches.some((x) => x.isElse)) br.push({ x: { label: '' }, b: null });
      const lay = sideBySide(br, D.w);
      const top = D.h + GY;
      const maxH = Math.max(0, ...br.map((it) => (it.b ? it.b.h : 0)));
      const needM = br.some((it) => !it.b || it.b.exits.length);
      const M = needM ? mk('uml.decision', '', 30, 30, s.lane) : null;
      const cx = lay.total / 2;
      const B = { w: lay.total, cx, items: [{ n: D, x: cx - D.w / 2, y: 0 }], kids: [], edges: [], entry: D, exits: [] };
      const mY = top + maxH + GY;
      br.forEach((it, k) => {
        if (it.b) {
          B.kids.push({ b: it.b, x: lay.xs[k], y: top });
          B.edges.push(E(D, it.b.entry, it.x.label));
          if (M) it.b.exits.forEach((ex) => B.edges.push(E(ex.n, M, ex.label, ex.extra)));
        } else if (M) B.edges.push(E(D, M, it.x.label));
      });
      if (M) {
        B.items.push({ n: M, x: cx - 15, y: mY });
        B.exits = [{ n: M }];
        B.h = mY + 30;
      } else B.h = top + maxH;
      return B;
    }
    function whileBlock(s) {
      const D = decisionNode(s.cond, s.lane);
      const body = seqBlock(s.body);
      const M = mk('uml.decision', '', 30, 30, s.lane);
      const inner = Math.max(D.w, body ? body.w : 0);
      const w = inner + CH * 2;
      const cx = CH + Math.max(D.w / 2, body ? body.cx : 0);
      const B = { w: Math.max(w, cx + Math.max(D.w / 2, body ? body.w - body.cx : 0) + CH), cx, items: [{ n: D, x: cx - D.w / 2, y: 0 }], kids: [], edges: [], entry: D, exits: [] };
      let y = D.h + GY;
      if (body) {
        B.kids.push({ b: body, x: cx - body.cx, y });
        B.edges.push(E(D, body.entry, s.yes));
        body.exits.forEach((ex) => B.edges.push(E(ex.n, D, ex.label, { sourcePort: 'left', targetPort: 'left', chan: { b: B, side: 'left' } })));
        y += body.h + GY;
      }
      B.items.push({ n: M, x: cx - 15, y });
      B.edges.push(E(D, M, s.no, { sourcePort: 'right', targetPort: 'right', chan: { b: B, side: 'right' } }));
      B.exits = [{ n: M }];
      B.h = y + 30;
      return B;
    }
    function repeatBlock(s) {
      const M0 = mk('uml.decision', '', 30, 30, s.lane);
      const body = seqBlock(s.body);
      const D = decisionNode(s.cond, s.lane);
      const cx = CH + Math.max(D.w / 2, body ? body.cx : 15);
      const right = Math.max(D.w / 2, body ? body.w - body.cx : 15);
      const B = { w: cx + right + CH, cx, items: [{ n: M0, x: cx - 15, y: 0 }], kids: [], edges: [], entry: M0, exits: [] };
      let y = 30 + GY;
      if (body) {
        B.kids.push({ b: body, x: cx - body.cx, y });
        B.edges.push(E(M0, body.entry));
        body.exits.forEach((ex) => B.edges.push(E(ex.n, D, ex.label, ex.extra)));
        y += body.h + GY;
      } else B.edges.push(E(M0, D));
      B.items.push({ n: D, x: cx - D.w / 2, y });
      B.edges.push(E(D, M0, s.yes, { sourcePort: 'left', targetPort: 'left', chan: { b: B, side: 'left' } }));
      B.exits = [{ n: D, label: s.no }];
      B.h = y + D.h;
      return B;
    }
    function forkBlock(s) {
      const br = s.branches.map((x) => ({ b: seqBlock(x) }));
      const lay = sideBySide(br, 120);
      const F = mk('uml.forkH', '', Math.max(lay.total - 20, 80), 8, s.lane);
      const J = mk('uml.forkH', '', F.w, 8, s.lane);
      const cx = lay.total / 2;
      const B = { w: lay.total, cx, items: [{ n: F, x: cx - F.w / 2, y: 0 }], kids: [], edges: [], entry: F, exits: [{ n: J }] };
      const top = 8 + GY;
      const maxH = Math.max(0, ...br.map((it) => (it.b ? it.b.h : 0)));
      br.forEach((it, k) => {
        if (!it.b) return;
        B.kids.push({ b: it.b, x: lay.xs[k], y: top });
        B.edges.push(E(F, it.b.entry));
        it.b.exits.forEach((ex) => B.edges.push(E(ex.n, J, ex.label, ex.extra)));
      });
      B.items.push({ n: J, x: cx - J.w / 2, y: top + maxH + GY });
      B.h = top + maxH + GY + 8;
      return B;
    }
    const root = seqBlock(tree);
    const place = (b, ax, ay) => {
      b.ax = ax;
      b.ay = ay;
      for (const it of b.items) {
        it.n.x = ax + it.x;
        it.n.y = ay + it.y;
      }
      for (const k of b.kids) place(k.b, ax + k.x, ay + k.y);
      for (const e of b.edges) allEdges.push(e);
    };
    place(root, 40, lanes.length ? 84 : 40);

    // ---- làn (swimlane): mỗi làn một cột; phần tử đứng riêng một hàng thì căn giữa làn,
    //      các phần tử cùng làn trùng hàng (hai nhánh if…) thì dàn ngang theo thứ tự trong cấu trúc
    const out = [];
    if (lanes.length) {
      const laneOf = (n) => n.lane || lanes[0];
      let x0 = 40;
      const info = lanes.map((ln) => {
        const ns = nodes.filter((n) => laneOf(n) === ln).sort((a, b) => a.y - b.y);
        const groups = [];
        for (const n of ns) {
          const g = groups.find((gr) => gr.some((m) => n.y < m.y + m.h + 6 && m.y < n.y + n.h + 6));
          if (g) g.push(n);
          else groups.push([n]);
        }
        const widthOf = (g) => g.reduce((s, n) => s + n.w, 0) + 30 * (g.length - 1);
        const w = clamp(Math.max(0, ...groups.map(widthOf)) + 70, 220, 1200);
        const r = { ln, x0, w, c: x0 + w / 2, groups, widthOf };
        x0 += w;
        return r;
      });
      for (const r of info)
        for (const g of r.groups) {
          g.sort((a, b) => a.x - b.x);
          let x = r.c - r.widthOf(g) / 2;
          for (const n of g) {
            n.x = x;
            x += n.w + 30;
          }
        }
      const bottom = Math.max(...nodes.map((n) => n.y + n.h)) + 30;
      for (const r of info) out.push({ id: 'lane' + out.length, type: 'uml.partition', x: r.x0, y: 40, w: r.w, h: bottom - 40, text: r.ln, style: {} });
    }
    let eid = 0;
    const edges = allEdges.map((e) => {
      const o = { id: 'e' + ++eid, type: 'uml.transition', source: e.from.id, target: e.to.id, label: e.label || '', style: {} };
      if (e.sourcePort) o.sourcePort = e.sourcePort;
      if (e.targetPort) o.targetPort = e.targetPort;
      if (e.chan && !lanes.length) o.midX = Math.round(e.chan.side === 'left' ? e.chan.b.ax + 8 : e.chan.b.ax + e.chan.b.w - 8);
      return o;
    });
    for (const n of nodes) {
      delete n.lane;
      out.push(n);
    }
    return { nodes: out, edges };
  }

  // ============================================================ CÁC LOẠI DẠNG ĐỒ THỊ
  const OP = '\\[\\*\\]|\\(\\*\\)|\\[H\\*?\\]|"[^"]+"|\\[[^\\]]+\\]|\\([^()]+\\)|:[^:]+:|===+[^=]*===+|[\\p{L}\\p{N}_.$]+';
  const HL = '<\\|>?|<<|\\}o|\\}\\||\\|o|\\|\\||<|\\*(?=[-.])|o(?=[-.])|\\+(?=[-.])|#(?=[-.])|x(?=[-.])|\\^(?=[-.])';
  const HR = '\\|>|>>|o\\{|\\|\\{|o\\||\\|\\||>|\\*|o(?![\\p{L}\\p{N}_])|\\+|#|x(?![\\p{L}\\p{N}_])|\\^';
  const BODY = '[-.]+(?:(?:left|right|up|down|le|ri|l|r|u|d)[-.]*|\\[[^\\]]*\\][-.]*)?';
  const REL = new RegExp(`^(${OP})\\s*(?:"([^"]*)"\\s*)?(${HL})?(${BODY})(${HR})?\\s*(?:\\[([^\\]]*)\\]\\s*)?(?:"([^"]*)"\\s*)?(${OP})\\s*(?::\\s*(.*))?$`, 'u');
  const ER_HEAD = { '||': 'erOnlyOne', '|o': 'erZeroOne', 'o|': 'erZeroOne', '}o': 'erZeroMany', 'o{': 'erZeroMany', '}|': 'erOneMany', '|{': 'erOneMany' };
  const CONTAINER = { boundary: 'uml.systemBoundary', package: 'uml.package', node: 'uml.node', composite: 'uml.state', subgraph: 'basic.frame' };
  const PAD = {
    boundary: { t: 46, l: 26, r: 26, b: 26 },
    package: { t: 46, l: 22, r: 22, b: 22 },
    node: { t: 58, l: 22, r: 36, b: 24 },
    composite: { t: 48, l: 22, r: 22, b: 22 },
    subgraph: { t: 42, l: 24, r: 24, b: 24 },
  };

  function parseGraph(P, kind, warn) {
    const G = { nodes: new Map(), order: [], edges: [], dir: kind === 'usecase' ? 'LR' : 'TB' };
    const stack = [];
    const cur = () => (stack.length ? stack[stack.length - 1] : null);
    const DEFAULT = { class: 'class', usecase: 'actor', component: 'component', state: 'state', er: 'entity', 'activity-old': 'action' };
    const byText = (t) => {
      for (const n of G.nodes.values()) if (n.text === t) return n;
      return null;
    };
    function add(key, type, text, extra) {
      key = String(key).trim();
      let n = G.nodes.get(key);
      if (n) {
        if (type && (n.implicit || n.type === DEFAULT[kind])) n.type = type;
        if (text != null && text !== '') n.text = text;
        if (type) n.implicit = false;
        if (extra) Object.assign(n, extra);
        return n;
      }
      n = Object.assign({ key, type: type || DEFAULT[kind] || 'class', text: text != null ? text : key, parent: cur(), kids: [], members: [], implicit: !type }, extra);
      G.nodes.set(key, n);
      G.order.push(key);
      if (n.parent) G.nodes.get(n.parent).kids.push(key);
      return n;
    }
    let lastTo = null; // activity cú pháp cũ: "--> X" nối tiếp từ phần tử trước
    const ifStack = [];
    function operand(tok, side) {
      tok = tok.trim();
      let m;
      if (tok === '__LAST__' && lastTo) return lastTo;
      const scope = cur() ? cur() + '/' : '';
      if (tok === '[*]' || tok === '(*)') {
        const first = side === 'L';
        return add(scope + (first ? '::start' : '::end'), first ? 'initial' : 'final', '').key;
      }
      if ((m = tok.match(/^\[(H\*?)\]$/))) return add(scope + '::' + m[1], 'history', m[1] === 'H*' ? 'H*' : 'H').key;
      if ((m = tok.match(/^===+\s*([^=]*?)\s*===+$/))) return add('bar:' + m[1], 'fork', '').key;
      if ((m = tok.match(/^\[([^\]]+)\]$/))) return (G.nodes.get(m[1]) || byText(m[1]) || add(m[1], 'component', unq(m[1]))).key;
      if ((m = tok.match(/^\(([^)]+)\)$/))) return (G.nodes.get(m[1]) || byText(unq(m[1])) || add(m[1], kind === 'component' ? 'lollipop' : 'usecase', unq(m[1]))).key;
      if ((m = tok.match(/^:([^:]+):$/))) return (G.nodes.get(m[1]) || byText(unq(m[1])) || add(m[1], 'actor', unq(m[1]))).key;
      if ((m = tok.match(/^"([^"]+)"$/))) return (G.nodes.get(m[1]) || byText(unq(m[1])) || add(m[1], kind === 'activity-old' ? 'action' : null, unq(m[1]))).key;
      return (G.nodes.get(tok) || add(tok, null, tok)).key;
    }
    function relation(m) {
      const [, lt, m1, hl0, body, hr0, oldLabel, m2, rt, lbl] = m;
      const hl = hl0 || '', hr = hr0 || '';
      const a = operand(lt, 'L'), b = operand(rt, 'R');
      const dashed = body.includes('.');
      const len = (body.match(/[-.]/g) || []).length;
      const dk = (body.match(/(left|right|up|down|le|ri|l|r|u|d)/) || [])[1] || '';
      const dirKey = { le: 'left', l: 'left', ri: 'right', r: 'right', u: 'up', d: 'down' }[dk] || dk;
      let label = unq(lbl || oldLabel || '').replace(/^<\s*|\s*>$/g, '').trim();
      let type, src = 'L', style = {};
      if (kind === 'er') {
        type = 'erd.oneToMany';
        style.startArrow = ER_HEAD[hl] || 'none';
        style.endArrow = ER_HEAD[hr] || 'none';
        if (dashed) style.dash = 'dashed';
      } else if (kind === 'state' || kind === 'activity-old') {
        type = 'uml.transition';
        if (hl && !hr) src = 'R';
        if (!hl && !hr) style.endArrow = 'none';
        if (dashed) style.dash = 'dashed';
      } else if (hl.startsWith('<|') || hr === '|>') {
        type = dashed ? 'uml.realization' : 'uml.generalization';
        src = hl.startsWith('<|') ? 'R' : 'L';
      } else if (hl === '*' || hr === '*') {
        type = 'uml.composition';
        src = hl === '*' ? 'L' : 'R';
      } else if (hl === 'o' || hr === 'o') {
        type = 'uml.aggregation';
        src = hl === 'o' ? 'L' : 'R';
      } else if (dashed && /include/i.test(label)) {
        type = 'uml.include';
        src = hl && !hr ? 'R' : 'L';
        label = '«include»';
      } else if (dashed && /extend/i.test(label)) {
        type = 'uml.extend';
        src = hl && !hr ? 'R' : 'L';
        label = '«extend»';
      } else if (hr === '>' || hr === '>>' || hl === '<' || hl === '<<') {
        type = dashed ? 'uml.dependency' : 'uml.directedAssociation';
        src = hl && !hr ? 'R' : 'L';
        if (hl && hr) style.startArrow = 'open';
      } else {
        type = 'uml.association';
        if (dashed) style.dash = 'dashed';
      }
      const [from, to] = src === 'L' ? [a, b] : [b, a];
      const mult = [src === 'L' ? m1 : m2, src === 'L' ? m2 : m1].map((x) => (x ? unq(x) : ''));
      const multS = mult[0] || mult[1] ? `${mult[0]} – ${mult[1]}`.trim().replace(/^– |– $/g, '') : '';
      if (multS) label = label ? `${label} [${multS}]` : multS;
      // hướng cho bố cục: kế thừa -> cha ở trên; "->" một nét -> cùng hàng; -up- / -left- …
      let rank = 'down';
      if (type === 'uml.generalization' || type === 'uml.realization') rank = 'up';
      if (dirKey === 'up') rank = rank === 'up' ? 'down' : 'up';
      else if (dirKey === 'left' || dirKey === 'right') rank = dirKey;
      else if (!dirKey && len === 1 && kind !== 'activity-old') rank = 'same';
      if (rank === 'left' || rank === 'right') rank = src === 'L' ? rank : rank === 'left' ? 'right' : 'left';
      G.edges.push({ from, to, type, label, style, rank });
      lastTo = b;
    }
    const L = P.lines;
    for (let i = 0; i < L.length; i++) {
      let l = L[i];
      let m;
      if (kind === 'activity-old') {
        // if "điều kiện" then … else … endif (cú pháp cũ)
        if ((m = l.match(/^if\s+(?:"([^"]*)"|(.+?))\s+then$/i))) {
          const d = add('if:' + G.order.length, 'choice', unq(m[1] || m[2]));
          if (lastTo) G.edges.push({ from: lastTo, to: d.key, type: 'uml.transition', label: '', style: {}, rank: 'down' });
          ifStack.push(d.key);
          lastTo = d.key;
          continue;
        }
        if (/^else\b/i.test(l)) {
          if (ifStack.length) lastTo = ifStack[ifStack.length - 1];
          continue;
        }
        if (/^end\s*if$/i.test(l)) {
          ifStack.pop();
          lastTo = null;
          continue;
        }
        if (lastTo && /^[-.]+(\[[^\]]*\])?[-.]*>/.test(l)) l = '__LAST__ ' + l;
      }
      if (/^left\s+to\s+right\s+direction$/i.test(l)) {
        G.dir = 'LR';
        continue;
      }
      if (/^top\s+to\s+bottom\s+direction$/i.test(l)) {
        G.dir = 'TB';
        continue;
      }
      if (l === '}') {
        if (stack.length) stack.pop();
        continue;
      }
      if (kind === 'state' && /^(--|\|\|)$/.test(l)) {
        warn('trạng thái song song (-- / ||) vẽ chung một vùng');
        continue;
      }
      // ---- ghi chú
      if ((m = l.match(/^note\s+(left|right|top|bottom)\s+of\s+(\S+?)\s*(?::\s*(.*))?$/i)) || (m = l.match(/^note\s+(left|right|top|bottom)\s*:\s*(.*)$/i))) {
        const target = m[3] !== undefined || l.includes(' of ') ? m[2] : G.order[G.order.length - 1];
        let text = l.includes(' of ') ? m[3] : m[2];
        if (text == null) {
          const body = [];
          while (++i < L.length && !/^end\s*note$/i.test(L[i])) body.push(L[i]);
          text = body.join('\n');
        }
        if (!target) continue;
        const tk = operand(target, 'L');
        const nn = add('note:' + G.order.length, 'note', unq(text));
        G.edges.push({ from: nn.key, to: tk, type: 'uml.association', label: '', style: { dash: 'dashed' }, rank: 'same' });
        continue;
      }
      if ((m = l.match(/^note\s+"([^"]*)"\s+as\s+(\S+)$/i))) {
        add(m[2], 'note', unq(m[1]));
        continue;
      }
      if ((m = l.match(/^note\s+as\s+(\S+)$/i))) {
        const body = [];
        while (++i < L.length && !/^end\s*note$/i.test(L[i])) body.push(L[i]);
        add(m[1], 'note', body.join('\n'));
        continue;
      }
      if (/^note\b/i.test(l)) {
        if (!/:|"/.test(l)) while (++i < L.length && !/^end\s*note$/i.test(L[i]));
        warn('ghi chú gắn trên đường nối');
        continue;
      }
      // ---- khai báo
      if ((kind === 'class' || kind === 'er') && (m = l.match(/^(package|namespace)\s+(.+?)\s*\{\s*$/i))) {
        const na = nameAlias(m[2]);
        const n = add(na.key, 'package', na.text);
        stack.push(n.key);
        continue;
      }
      if (kind === 'class' && (m = l.match(/^(abstract\s+class|abstract|class|interface|enum|annotation|entity|protocol|struct|exception|metaclass|stereotype|circle|diamond|dataclass|record)\s+(.+)$/i))) {
        let rest = m[2];
        let ext = '';
        rest = rest.replace(/\s+(extends|implements)\s+(.+?)(?=\s*\{|\s*$)/i, (_, kw, x) => {
          ext = kw.toLowerCase() + ':' + x;
          return '';
        });
        const na = nameAlias(rest.replace(/<(?!<)[^<>]*>(?!>)/, (g) => (g.includes(',') || /^<[A-Z\s?]/.test(g) ? '' : g)));
        const kw = m[1].toLowerCase();
        const type = /abstract/.test(kw) ? 'abstract' : kw === 'interface' || kw === 'protocol' ? 'interface' : kw === 'enum' ? 'enum' : 'class';
        const n = add(na.key, type, na.text, { stereo: na.stereo || (/^(annotation|entity|struct|exception|record|dataclass)$/.test(kw) ? kw : '') });
        if (na.open || /\{\s*\}?\s*$/.test(rest)) {
          if (!/\}\s*$/.test(rest)) while (++i < L.length && L[i] !== '}') n.members.push(L[i]);
        }
        if (ext) {
          const [k, list] = ext.split(':');
          for (const p of list.split(',')) G.edges.push({ from: n.key, to: operand(p.trim(), 'R'), type: k === 'extends' ? 'uml.generalization' : 'uml.realization', label: '', style: {}, rank: 'up' });
        }
        continue;
      }
      if (kind === 'er' && (m = l.match(/^entity\s+(.+)$/i))) {
        const na = nameAlias(m[1]);
        const n = add(na.key, 'entity', na.text);
        if (na.open) while (++i < L.length && L[i] !== '}') n.members.push(L[i]);
        continue;
      }
      if (kind === 'state' && (m = l.match(/^state\s+(.+)$/i))) {
        let rest = m[1], desc = '';
        const dm = rest.match(/^("[^"]*"(?:\s+as\s+\S+)?|\S+(?:\s+as\s+"[^"]*")?)\s*:\s*(.*)$/);
        if (dm) {
          rest = dm[1];
          desc = dm[2];
        }
        const na = nameAlias(rest);
        const st = (na.stereo || '').toLowerCase();
        const type = st === 'choice' ? 'choice' : st === 'fork' || st === 'join' ? 'fork' : st === 'end' ? 'final' : st === 'start' ? 'initial' : st.includes('history') ? 'history' : na.open ? 'composite' : 'state';
        const n = add(na.key, type, na.text);
        if (desc) n.members.push(unq(desc));
        if (na.open) stack.push(n.key);
        continue;
      }
      if ((kind === 'usecase' || kind === 'component') && (m = l.match(/^(actor|usecase|component|interface|node|database|cloud|frame|folder|package|rectangle|artifact|file|queue|storage|card|agent|boundary|control|entity|collections|stack|hexagon|person|label|circle)\s+(.+)$/i))) {
        const kw = m[1].toLowerCase();
        const na = nameAlias(m[2]);
        const CONT = ['node', 'cloud', 'frame', 'folder', 'package', 'rectangle', 'card'];
        let type;
        if (kw === 'actor' || kw === 'person') type = 'actor';
        else if (kw === 'usecase') type = 'usecase';
        else if (kw === 'interface' || kw === 'circle') type = 'lollipop';
        else if (kw === 'database' || kw === 'storage' || kw === 'queue' || kw === 'collections' || kw === 'stack') type = 'database';
        else if (kw === 'artifact' || kw === 'file') type = 'artifact';
        else if (CONT.includes(kw)) type = na.open ? (kind === 'usecase' && kw === 'rectangle' ? 'boundary' : kw === 'node' ? 'node' : 'package') : kw === 'node' ? 'node-leaf' : 'component';
        else type = 'component';
        const n = add(na.key, type, na.text, { stereo: na.stereo });
        if (na.open) stack.push(n.key);
        continue;
      }
      if ((m = l.match(/^\(\)\s*(.+)$/))) {
        const na = nameAlias(m[1]);
        add(na.key, 'lollipop', na.text);
        continue;
      }
      // dòng chỉ có một phần tử: [Comp] as C · (Use case) as U · :Actor: as A
      if ((m = l.match(/^(\[[^\]]+\]|\([^)]+\)|:[^:]+:)(\s+as\s+\S+)?\s*(\{)?$/))) {
        const na = nameAlias(l);
        const t = m[1][0] === '[' ? 'component' : m[1][0] === '(' ? 'usecase' : 'actor';
        const n = add(na.key, t, na.text);
        if (na.open) stack.push(n.key);
        continue;
      }
      // ---- quan hệ
      if ((m = l.match(REL))) {
        relation(m);
        continue;
      }
      // ---- A : thành viên / mô tả trạng thái
      if ((m = l.match(/^("[^"]+"|[\p{L}\p{N}_.$]+)\s*:\s*(.+)$/u))) {
        const n = G.nodes.get(unq(m[1])) || byText(unq(m[1])) || add(unq(m[1]), null, unq(m[1]));
        n.members.push(m[2]);
        continue;
      }
      // ---- tên đứng một mình (state / class đơn giản)
      if ((m = l.match(/^([\p{L}\p{N}_.$]+)$/u)) && kind !== 'usecase' && !/^(else|endif|end|then|endwhile|start|stop|together)$/i.test(m[1])) {
        add(m[1], null, m[1]);
        continue;
      }
      warn(`dòng chưa hiểu: ${l.slice(0, 60)}`);
    }
    if (!G.nodes.size) throw new Error('Không tìm thấy phần tử nào trong sơ đồ');
    return G;
  }

  // ---- kích thước từng loại phần tử (w, h: hình; fw, fh: chỗ chiếm khi xếp – gồm cả chữ bên dưới)
  function compSize(text, minW, extraLine) {
    const parts = [[]];
    String(text)
      .split('\n')
      .forEach((l) => (/^\s*-{2,}\s*$/.test(l) ? parts.push([]) : parts[parts.length - 1].push(l)));
    const pad = 5;
    let h = pad + (parts[0].length + (extraLine ? 1 : 0)) * LH + pad;
    for (let i = 1; i < parts.length; i++) h += pad + Math.max(parts[i].length, 0.5) * LH + pad;
    const w = Math.max(minW, ...parts[0].map((l) => tw(l, true) + 30), ...parts.slice(1).flat().map((l) => tw(l) + 26));
    return { w: Math.ceil(Math.min(w, 460)), h: Math.ceil(h + 2) };
  }
  function memberText(n) {
    const clean = (s) => s.replace(/\{(static|abstract|field|method|classifier)\}\s*/gi, '').trim();
    const mem = n.members.map((x) => x.trim()).filter((x) => x && x !== '{' && x !== '}');
    const head = (n.stereo && !['interface', 'enum'].includes(n.type) ? `«${n.stereo}»\n` : '') + n.text;
    if (n.type === 'entity') {
      const sep = mem.findIndex((x) => /^(--+|==+|\.\.+|__+)/.test(x));
      const keys = sep >= 0 ? mem.slice(0, sep) : [];
      const rest = (sep >= 0 ? mem.slice(sep + 1) : mem).filter((x) => !/^(--+|==+|\.\.+|__+)/.test(x));
      const fmt = (x, pk) => {
        let s = x.replace(/^\*\s*/, '');
        let tag = pk ? 'PK ' : '';
        s = s
          .replace(/<<\s*(PK|FK)\s*>>/gi, (_, k) => {
            tag = k.toUpperCase() + ' ';
            return '';
          })
          .replace(/<<[^>]*>>/g, '');
        return tag + s.trim();
      };
      const lines = keys.map((x) => fmt(x, true)).concat(rest.map((x) => fmt(x, false)));
      return lines.length ? head + '\n--\n' + lines.join('\n') : head;
    }
    if (n.type === 'state') return mem.length ? head + '\n--\n' + mem.map(unq).join('\n') : head;
    if (/^(class|abstract|interface|enum)$/.test(n.type)) {
      if (!mem.length) return head;
      if (mem.some((x) => /^(--+|==+|\.\.+|__+)/.test(x))) {
        const out = [];
        for (const x of mem) out.push(/^(--+|==+|\.\.+|__+)/.test(x) ? '--' : clean(x));
        return head + '\n--\n' + out.join('\n').replace(/\n--\n--/g, '\n--');
      }
      if (n.type === 'enum') return head + '\n--\n' + mem.flatMap((x) => x.split(/\s*,\s*/)).map(clean).filter(Boolean).join('\n');
      const fields = mem.filter((x) => !x.includes('(')).map(clean);
      const methods = mem.filter((x) => x.includes('(')).map(clean);
      if (!fields.length) return head + '\n--\n' + methods.join('\n');
      return head + '\n--\n' + fields.join('\n') + (methods.length ? '\n--\n' + methods.join('\n') : '');
    }
    return mem.length ? head + '\n' + mem.map(unq).join('\n') : head;
  }
  const SHAPE = {
    class: 'uml.class', abstract: 'uml.abstractClass', interface: 'uml.interface', enum: 'uml.enum', entity: 'erd.table',
    actor: 'uml.actor', usecase: 'uml.useCase', component: 'uml.component', lollipop: 'uml.providedInterface', database: 'flow.database',
    artifact: 'uml.artifact', note: 'uml.note', state: 'uml.state', initial: 'uml.initial', final: 'uml.final', choice: 'uml.decision',
    fork: 'uml.forkH', history: 'uml.history', action: 'uml.action', 'node-leaf': 'uml.node',
    // lưu đồ (từ Mermaid flowchart)
    'fl:process': 'flow.process', 'fl:roundrect': 'basic.roundrect', 'fl:terminator': 'flow.terminator', 'fl:decision': 'flow.decision',
    'fl:data': 'flow.data', 'fl:database': 'flow.database', 'fl:connector': 'flow.connector', 'fl:predefined': 'flow.predefined',
    'fl:preparation': 'flow.preparation', 'fl:manualOperation': 'flow.manualOperation', 'fl:manualInput': 'flow.manualInput',
    'fl:document': 'flow.document', 'fl:multiDocument': 'flow.multiDocument', 'fl:delay': 'flow.delay', 'fl:display': 'flow.display',
    'fl:comment': 'flow.comment', 'fl:text': 'basic.text',
  };
  function sizeFlow(n, t) {
    const k = n.type.slice(3);
    let w, h;
    switch (k) {
      case 'decision':
        w = clamp(tw(t) * 1.25 + 60, 130, 280);
        h = Math.max(84, wrapLines(t, w * 0.6) * LH * 1.5 + 44);
        break;
      case 'terminator':
        w = clamp(tw(t) + 48, 110, 260);
        h = Math.max(50, wrapLines(t, w - 36) * LH + 22);
        break;
      case 'connector':
        w = h = clamp(tw(t) + 26, 48, 130);
        break;
      case 'database':
        w = clamp(tw(t) + 40, 110, 240);
        h = Math.max(80, wrapLines(t, w - 20) * LH + 44);
        break;
      case 'data':
      case 'preparation':
      case 'manualOperation':
      case 'manualInput':
        w = clamp(tw(t) + 64, 130, 300);
        h = Math.max(60, wrapLines(t, w - 60) * LH + 24);
        break;
      case 'document':
      case 'multiDocument':
        w = clamp(tw(t) + 40, 130, 280);
        h = Math.max(74, wrapLines(t, w - 24) * LH * 1.3 + 30);
        break;
      case 'text':
        w = clamp(tw(t) + 16, 40, 300);
        h = Math.max(30, wrapLines(t, w) * LH + 8);
        break;
      default:
        w = clamp(tw(t) + 40, 120, 280);
        h = Math.max(56, wrapLines(t, w - 24) * LH + 26);
    }
    n.w = n.fw = w;
    n.h = n.fh = h;
    n.ox = n.oy = 0;
  }
  function sizeLeaf(n) {
    const t = n.text || '';
    if (String(n.type).startsWith('fl:')) return sizeFlow(n, t);
    let w, h, fw, fh;
    switch (n.type) {
      case 'class':
      case 'abstract':
      case 'interface':
      case 'enum':
      case 'entity':
      case 'state': {
        n.text = memberText(n);
        const s = compSize(n.text, n.type === 'state' ? 110 : 130, n.type === 'interface' || n.type === 'enum');
        w = s.w;
        h = n.type === 'state' && !n.text.includes('\n') ? Math.max(48, s.h) : s.h;
        break;
      }
      case 'actor':
        w = 40;
        h = 80;
        fw = Math.max(70, tw(t) + 16);
        fh = 80 + wrapLines(t, fw + 60) * LH + 12;
        break;
      case 'usecase':
        w = clamp(tw(t) + 56, 130, 260);
        h = Math.max(60, wrapLines(t, w * 0.72) * LH + 30);
        break;
      case 'lollipop':
        w = h = 24;
        fw = Math.max(70, tw(t) + 16);
        fh = 24 + LH + 12;
        break;
      case 'database':
        w = clamp(tw(t) + 44, 110, 240);
        h = Math.max(80, wrapLines(t, w - 20) * LH + 44);
        break;
      case 'note':
        w = clamp(tw(t) + 34, 100, 300);
        h = Math.max(40, wrapLines(t, w - 30) * LH + 22);
        break;
      case 'initial':
      case 'history':
        w = h = 30;
        break;
      case 'final':
        w = h = 34;
        break;
      case 'choice':
        w = h = 40;
        if (t) {
          fw = Math.max(60, tw(t) + 16);
          fh = 40 + LH + 10;
        }
        break;
      case 'fork':
        w = 120;
        h = 8;
        break;
      case 'action':
        w = clamp(tw(t) + 34, 110, 260);
        h = Math.max(44, wrapLines(t, w - 20) * LH + 22);
        break;
      case 'node-leaf':
        w = clamp(tw(t) + 60, 150, 280);
        h = 90;
        break;
      default:
        w = clamp(tw(t) + 64, 140, 300);
        h = Math.max(60, wrapLines(t, w - 44) * LH + 26);
    }
    n.w = w;
    n.h = h;
    n.fw = Math.max(fw || 0, w);
    n.fh = Math.max(fh || 0, h);
    n.ox = (n.fw - w) / 2;
    n.oy = 0;
  }

  // ---- xếp lớp (layered) một nhóm phần tử cùng cấp
  function layered(items, E, dir) {
    const n = items.length;
    const LR = dir === 'LR';
    const id = new Map(items.map((v, i) => [v.key, i]));
    const main = (v) => (LR ? v.fw : v.fh), cross = (v) => (LR ? v.fh : v.fw);
    const succ = items.map(() => new Set()), adj = items.map(() => new Set()), same = [];
    for (const e of E) {
      let a = id.get(e.a), b = id.get(e.b);
      if (a == null || b == null || a === b) continue;
      adj[a].add(b);
      adj[b].add(a);
      if (e.rank === 'same' || e.rank === 'left' || e.rank === 'right') {
        same.push(e.rank === 'left' ? [b, a] : [a, b]);
        continue;
      }
      if (e.rank === 'up') [a, b] = [b, a];
      succ[a].add(b);
    }
    // phá chu trình (DFS, đảo cạnh quay lui)
    const st = new Array(n).fill(0);
    const S = items.map(() => []);
    const visit = (u) => {
      st[u] = 1;
      for (const v of succ[u]) {
        if (st[v] === 1) S[v].push(u);
        else {
          S[u].push(v);
          if (!st[v]) visit(v);
        }
      }
      st[u] = 2;
    };
    for (let i = 0; i < n; i++) if (!st[i]) visit(i);
    const pred = items.map(() => []);
    S.forEach((vs, u) => vs.forEach((v) => pred[v].push(u)));
    // tầng: đường dài nhất (Kahn)
    const indeg = pred.map((p) => p.length), rank = new Array(n).fill(0), q = [];
    indeg.forEach((d, i) => d || q.push(i));
    while (q.length) {
      const u = q.shift();
      for (const v of S[u]) {
        rank[v] = Math.max(rank[v], rank[u] + 1);
        if (--indeg[v] === 0) q.push(v);
      }
    }
    // kéo nút nguồn sát xuống tầng của nút nó trỏ tới (actor đứng cạnh use case…)
    for (let i = 0; i < n; i++) if (!pred[i].length && S[i].length) rank[i] = Math.max(0, Math.min(...S[i].map((v) => rank[v])) - 1);
    for (const [a, b] of same) {
      const freeB = !pred[b].length && !S[b].length, freeA = !pred[a].length && !S[a].length;
      if (freeB) rank[b] = rank[a];
      else if (freeA) rank[a] = rank[b];
    }
    // phần tử đứng riêng (không nối): xếp thành các hàng gọn ở cuối
    const lonely = items.map((_, i) => i).filter((i) => !adj[i].size);
    const top = Math.max(-1, ...items.map((_, i) => (adj[i].size ? rank[i] : -1)));
    const perRow = Math.max(3, Math.ceil(Math.sqrt(lonely.length * 1.5)));
    lonely.forEach((i, k) => (rank[i] = top + 1 + Math.floor(k / perRow)));
    const R = Math.max(0, ...rank);
    const layers = Array.from({ length: R + 1 }, () => []);
    for (let i = 0; i < n; i++) layers[rank[i]].push(i);
    const pos = new Array(n);
    const reindex = () => layers.forEach((L) => L.forEach((v, k) => (pos[v] = k)));
    // cùng hàng: b ngay sau a
    for (const [a, b] of same)
      if (rank[a] === rank[b]) {
        const L = layers[rank[a]];
        L.splice(L.indexOf(b), 1);
        L.splice(L.indexOf(a) + 1, 0, b);
      }
    reindex();
    // giảm giao cắt: barycenter lên / xuống
    for (let it = 0; it < 8; it++) {
      const down = it % 2 === 0;
      const order = down ? layers.slice(1) : layers.slice(0, -1).reverse();
      for (const L of order) {
        if (L.length < 2) continue;
        const ref = rank[L[0]] + (down ? -1 : 1);
        const bc = new Map(
          L.map((v) => {
            const nb = [...adj[v]].filter((u) => rank[u] === ref);
            return [v, nb.length ? nb.reduce((s, u) => s + pos[u], 0) / nb.length : pos[v]];
          })
        );
        L.sort((a, b) => bc.get(a) - bc.get(b) || pos[a] - pos[b]);
        L.forEach((v, k) => (pos[v] = k));
      }
    }
    // cặp "cùng hàng" (A .> B, A -> B): giữ liền nhau thành chuỗi theo đúng thứ tự
    const nextOf = new Map(), prevOf = new Map();
    for (const [a, b] of same) if (rank[a] === rank[b] && !nextOf.has(a) && !prevOf.has(b) && a !== b) {
      nextOf.set(a, b);
      prevOf.set(b, a);
    }
    if (nextOf.size)
      for (const L of layers) {
        const inL = new Set(L), done = new Set(), out = [];
        for (const v of L) {
          if (done.has(v)) continue;
          if (prevOf.has(v) && inL.has(prevOf.get(v)) && !done.has(prevOf.get(v))) continue;
          for (let x = v; x != null && inL.has(x) && !done.has(x); x = nextOf.get(x)) {
            out.push(x);
            done.add(x);
          }
        }
        for (const v of L) if (!done.has(v)) out.push(v);
        L.splice(0, L.length, ...out);
      }
    reindex();
    // toạ độ
    const GAPM = LR ? 110 : 76, GAPC = LR ? 34 : 46;
    const lsz = layers.map((L) => Math.max(0, ...L.map((v) => main(items[v]))));
    const lpos = [];
    lsz.reduce((acc, s, r) => ((lpos[r] = acc), acc + s + GAPM), 0);
    const c = new Array(n);
    const pack = (L, want) => {
      const out = [];
      let prev = -Infinity;
      L.forEach((v, k) => {
        const w = cross(items[v]);
        const x = Math.max(want[k], prev + GAPC + w / 2);
        out.push(x);
        prev = x + w / 2;
      });
      const back = out.slice();
      let next = Infinity;
      for (let k = L.length - 1; k >= 0; k--) {
        const w = cross(items[L[k]]);
        back[k] = Math.min(want[k], next - GAPC - w / 2);
        next = back[k] - w / 2;
      }
      const avg = out.map((x, k) => (x + back[k]) / 2);
      prev = -Infinity;
      return avg.map((x, k) => {
        const w = cross(items[L[k]]);
        const y = Math.max(x, prev + GAPC + w / 2);
        prev = y + w / 2;
        return y;
      });
    };
    layers.forEach((L) => {
      let acc = 0;
      const want = L.map((v) => {
        const w = cross(items[v]);
        const x = acc + w / 2;
        acc += w + GAPC;
        return x;
      });
      pack(L, want).forEach((x, k) => (c[L[k]] = x));
    });
    const widest = Math.max(...layers.map((L) => (L.length ? c[L[L.length - 1]] + cross(items[L[L.length - 1]]) / 2 : 0)));
    layers.forEach((L) => {
      if (!L.length) return;
      const w = c[L[L.length - 1]] + cross(items[L[L.length - 1]]) / 2 - (c[L[0]] - cross(items[L[0]]) / 2);
      const shift = (widest - w) / 2 - (c[L[0]] - cross(items[L[0]]) / 2);
      L.forEach((v) => (c[v] += shift));
    });
    for (let it = 0; it < 6; it++) {
      const down = it % 2 === 0;
      const order = down ? layers.slice(1) : layers.slice(0, -1).reverse();
      for (const L of order) {
        if (!L.length) continue;
        const ref = rank[L[0]] + (down ? -1 : 1);
        const want = L.map((v) => {
          const nb = [...adj[v]].filter((u) => rank[u] === ref);
          return nb.length ? nb.reduce((s, u) => s + c[u], 0) / nb.length : c[v];
        });
        pack(L, want).forEach((x, k) => (c[L[k]] = x));
      }
    }
    const minC = Math.min(...items.map((v, i) => c[i] - cross(v) / 2));
    const out = new Map();
    let W = 0, H = 0;
    items.forEach((v, i) => {
      const m = lpos[rank[i]] + (lsz[rank[i]] - main(v)) / 2;
      const cc = c[i] - cross(v) / 2 - minC;
      const p = LR ? { x: m, y: cc } : { x: cc, y: m };
      out.set(v.key, p);
      W = Math.max(W, p.x + v.fw);
      H = Math.max(H, p.y + v.fh);
    });
    return { pos: out, w: W, h: H };
  }

  function layoutGraph(G, kind) {
    const N = G.nodes;
    const isCont = (n) => n.kids.length > 0 || ['boundary', 'package', 'node', 'composite', 'subgraph'].includes(n.type);
    function group(parentKey) {
      const kids = parentKey ? N.get(parentKey).kids : G.order.filter((k) => !N.get(k).parent);
      for (const k of kids) {
        const n = N.get(k);
        if (isCont(n)) {
          if (n.type === 'state' || n.type === 'node-leaf') n.type = n.type === 'state' ? 'composite' : 'node';
          if (!CONTAINER[n.type]) n.type = 'package';
          group(k);
        } else sizeLeaf(n);
      }
      if (!kids.length) {
        if (parentKey) {
          const c = N.get(parentKey);
          c.w = c.fw = Math.max(tw(c.text, true) + 50, 160);
          c.h = c.fh = 90;
          c.ox = c.oy = 0;
        }
        return { w: 120, h: 50 };
      }
      const set = new Set(kids);
      const lift = (key) => {
        let k = key;
        while (k != null && !set.has(k)) k = N.get(k) ? N.get(k).parent : null;
        return k;
      };
      const E = [];
      for (const e of G.edges) {
        const a = lift(e.from), b = lift(e.to);
        if (a != null && b != null && a !== b) E.push({ a, b, rank: e.rank });
      }
      const r = layered(kids.map((k) => N.get(k)), E, G.dir);
      for (const k of kids) {
        const p = r.pos.get(k), n = N.get(k);
        n.rx = p.x;
        n.ry = p.y;
      }
      if (parentKey) {
        const c = N.get(parentKey), pd = PAD[c.type] || PAD.package;
        const tW = tw(c.text, true) + 50;
        c.w = c.fw = Math.max(r.w + pd.l + pd.r, tW, 160);
        c.h = c.fh = r.h + pd.t + pd.b;
        c.ox = c.oy = 0;
        const extra = (c.w - (r.w + pd.l + pd.r)) / 2;
        for (const k of kids) {
          N.get(k).rx += pd.l + extra;
          N.get(k).ry += pd.t;
        }
      }
      return r;
    }
    group(null);
    const out = [], contIds = new Set();
    const emit = (key, ax, ay) => {
      const n = N.get(key);
      const type = CONTAINER[n.type] || SHAPE[n.type] || 'uml.component';
      let text = n.text;
      if (n.type === 'composite') text = n.text + '\n--';
      else if (n.type === 'node' && n.stereo) text = `«${n.stereo}»\n${n.text}`;
      const node = { id: 'n' + (out.length + 1), type, x: Math.round(ax + (n.ox || 0)), y: Math.round(ay + (n.oy || 0)), w: Math.round(n.w), h: Math.round(n.h), text, style: Object.assign({}, n.style || {}) };
      if (n.type === 'composite') node.style = Object.assign({ fill: '#f0fdff' }, node.style);
      if (CONTAINER[n.type]) contIds.add(node.id);
      n.id = node.id;
      out.push(node);
      for (const k of n.kids) {
        const c = N.get(k);
        emit(k, ax + c.rx, ay + c.ry);
      }
    };
    for (const k of G.order) {
      const n = N.get(k);
      if (!n.parent) emit(k, 40 + n.rx, 40 + n.ry);
    }
    let eid = 0;
    const byId = new Map(out.map((n) => [n.id, n]));
    // ---- chọn cổng nối: ước lượng đường vuông góc, tránh đi xuyên qua hình khác
    // (tính trong hệ "trên xuống"; bố cục LR thì đổi trục x <-> y)
    const T = G.dir === 'LR';
    const tr = (r) => (T ? { id: r.id, type: r.type, x: r.y, y: r.x, w: r.h, h: r.w } : r);
    const OB = out.filter((n) => !contIds.has(n.id)).map(tr);
    const BACK = { top: 'left', bottom: 'right', left: 'top', right: 'bottom' };
    const portOf = (p) => (T ? BACK[p] : p);
    const hits = (segs, skip) => {
      let k = 0;
      for (const r of OB) {
        if (skip.has(r.id)) continue;
        const hit = segs.some(([x1, y1, x2, y2]) =>
          x1 === x2
            ? x1 > r.x + 1 && x1 < r.x + r.w - 1 && Math.max(y1, y2) > r.y + 1 && Math.min(y1, y2) < r.y + r.h - 1
            : y1 > r.y + 1 && y1 < r.y + r.h - 1 && Math.max(x1, x2) > r.x + 1 && Math.min(x1, x2) < r.x + r.w - 1
        );
        if (hit) k++;
      }
      return k;
    };
    const PORTS = { bt: null, tb: null, rr: ['right', 'right'], ll: ['left', 'left'], lt: ['left', 'top'], rt: ['right', 'top'] };
    function route(o, s0, t0, e) {
      const s = tr(s0), t = tr(t0), skip = new Set([s.id, t.id]);
      const sx = s.x + s.w / 2, sy = s.y + s.h / 2, tx = t.x + t.w / 2, ty = t.y + t.h / 2, GAP = 24;
      const C = {
        bt: () => {
          const y1 = s.y + s.h, y2 = t.y, ym = (y1 + y2) / 2;
          return [[sx, y1, sx, ym], [sx, ym, tx, ym], [tx, ym, tx, y2]];
        },
        tb: () => {
          const y1 = s.y, y2 = t.y + t.h, ym = (y1 + y2) / 2;
          return [[sx, y1, sx, ym], [sx, ym, tx, ym], [tx, ym, tx, y2]];
        },
        rr: () => {
          const cx = Math.max(s.x + s.w, t.x + t.w) + GAP;
          return [[s.x + s.w, sy, cx, sy], [cx, sy, cx, ty], [cx, ty, t.x + t.w, ty]];
        },
        ll: () => {
          const cx = Math.min(s.x, t.x) - GAP;
          return [[s.x, sy, cx, sy], [cx, sy, cx, ty], [cx, ty, t.x, ty]];
        },
        lt: () => [[s.x, sy, tx, sy], [tx, sy, tx, t.y]],
        rt: () => [[s.x + s.w, sy, tx, sy], [tx, sy, tx, t.y]],
      };
      let cands;
      if (t.y >= s.y + s.h - 2) {
        cands = ['bt', 'rr', 'll'];
        // lưu đồ: nhánh của hình thoi ra từ đỉnh trái / phải
        if (kind === 'flowchart' && s0.type === 'flow.decision') {
          if (tx < s.x - 4) cands.unshift('lt');
          else if (tx > s.x + s.w + 4) cands.unshift('rt');
        }
      } else if (t.y + t.h <= s.y + 2) cands = e.rank === 'up' ? ['tb', 'rr', 'll'] : ['rr', 'll'];
      else return;
      let best = cands[0], bh = hits(C[best](), skip);
      for (const c of cands.slice(1)) {
        if (!bh) break;
        const h = hits(C[c](), skip);
        if (h < bh) {
          best = c;
          bh = h;
        }
      }
      const pp = PORTS[best];
      if (pp) {
        o.sourcePort = portOf(pp[0]);
        o.targetPort = portOf(pp[1]);
      }
    }
    const edges = G.edges
      .filter((e) => N.get(e.from) && N.get(e.to))
      .map((e) => {
        const o = { id: 'e' + ++eid, type: e.type, source: N.get(e.from).id, target: N.get(e.to).id, label: e.label || '', style: e.style || {} };
        if (kind === 'usecase' && (e.type === 'uml.association' || e.type === 'uml.directedAssociation')) o.routing = 'straight';
        // cạnh quay ngược (vòng lặp) đi vòng ra cạnh bên; cạnh dài không xuyên qua hình nằm giữa
        const s = byId.get(o.source), t = byId.get(o.target);
        if (s && t && o.source !== o.target && e.rank !== 'same' && !contIds.has(s.id) && !contIds.has(t.id)) route(o, s, t, e);
        if (o.source === o.target) {
          o.sourcePort = 'right';
          o.targetPort = 'top';
        }
        return o;
      });
    return { nodes: out, edges };
  }

  // ============================================================ HOÀN THIỆN (dùng chung)
  function finish(g, kind, name, mode, warn) {
    if (!g.nodes.length) return { ok: false, kind, error: 'Không tìm thấy phần tử nào trong sơ đồ' };
    if (g.nodes.length > 600) return { ok: false, kind, error: 'Sơ đồ quá lớn (trên 600 phần tử)' };
    // dời về góc trên trái
    const minX = Math.min(...g.nodes.map((n) => n.x)), minY = Math.min(...g.nodes.map((n) => n.y));
    g.nodes.forEach((n) => {
      n.x = Math.round(n.x - minX + 40);
      n.y = Math.round(n.y - minY + 40);
      n.w = Math.max(2, Math.round(n.w));
      n.h = Math.max(2, Math.round(n.h));
    });
    const r = DE.normalizeDoc({ version: 1, meta: { name, mode }, nodes: g.nodes, edges: g.edges });
    return { ok: true, kind, doc: r.doc, warnings: warn.list.concat(r.removed.map((x) => 'bỏ ' + x)) };
  }

  // ============================================================ API
  PU.convert = function (src) {
    let P, kind = 'uml';
    try {
      P = prep(src);
      kind = detect(P);
      if (UNSUPPORTED[kind]) return { ok: false, kind, error: `Chưa hỗ trợ loại sơ đồ PlantUML: ${UNSUPPORTED[kind]}. Gợi ý: dùng khối \`\`\`mermaid (mindmap, gantt…) hoặc vẽ ở tab Diagram.` };
      if (kind === 'unknown' || !P.lines.length) return { ok: false, kind, error: 'Không nhận ra loại sơ đồ PlantUML (hỗ trợ: sequence, use case, class, activity, state, component / deployment, ER).' };
      const warn = warner();
      P.ignored.forEach((x) => warn(`bỏ qua ${x}`));
      let g;
      if (kind === 'sequence') g = parseSequence(P, warn);
      else if (kind === 'activity') g = parseActivity(P, warn);
      else if (PU.KIND_NAME[kind]) g = layoutGraph(parseGraph(P, kind, warn), kind);
      else return { ok: false, kind, error: `Chưa hỗ trợ loại sơ đồ PlantUML: ${kind}` };
      return finish(g, kind, P.title || PU.KIND_NAME[kind] || 'PlantUML', 'uml', warn);
    } catch (e) {
      return { ok: false, kind, error: e.message || String(e) };
    }
  };

  // ============================================================ MERMAID
  const MM = (DE.mermaidConv = {});
  MM.KIND_NAME = { flowchart: 'Flowchart', sequence: 'Sequence (tuần tự)', class: 'Class', state: 'State machine', er: 'ER (cơ sở dữ liệu)' };
  const MM_OTHER = {
    gantt: 'Gantt', pie: 'biểu đồ tròn', mindmap: 'sơ đồ tư duy', journey: 'hành trình người dùng', timeline: 'dòng thời gian',
    gitgraph: 'nhánh Git', quadrantchart: 'ma trận 4 ô', xychart: 'biểu đồ XY', sankey: 'Sankey', requirementdiagram: 'sơ đồ yêu cầu',
    block: 'sơ đồ khối', packet: 'gói tin', kanban: 'Kanban', architecture: 'kiến trúc', zenuml: 'ZenUML', radar: 'radar', treemap: 'treemap',
    c4context: 'C4', c4container: 'C4', c4component: 'C4', c4dynamic: 'C4', c4deployment: 'C4',
  };
  MM.OTHER_NAME = MM_OTHER;
  const ENT = { quot: '"', amp: '&', lt: '<', gt: '>', nbsp: ' ', apos: "'", '35': '#', '59': ';' };
  /** Chữ hiển thị của Mermaid: bỏ ngoặc kép, chuỗi markdown `…`, thẻ HTML định dạng; <br> -> xuống dòng */
  const mmText = (v) => {
    let t = String(v == null ? '' : v).trim();
    if (/^"[\s\S]*"$/.test(t)) t = t.slice(1, -1).trim();
    if (/^`[\s\S]*`$/.test(t)) t = t.slice(1, -1).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1$2').replace(/_([^_]+)_/g, '$1');
    return t
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/#(\w+);/g, (m0, k) => (ENT[k] != null ? ENT[k] : /^\d+$/.test(k) ? String.fromCodePoint(Math.min(+k, 0x10ffff)) : m0))
      .replace(/<\/?(b|i|u|em|strong|small|big|sub|sup|span|code)\b[^>]*>/gi, '')
      .replace(/^fa:fa-[\w-]+\s*/, '')
      .trim();
  };
  /** Chữ đặt vào một dòng kiểu PlantUML (xuống dòng ghi thành \n) */
  const mmInline = (v) => mmText(v).replace(/\n/g, '\\n');

  function mmPrep(src) {
    let s = String(src || '').replace(/\r\n?/g, '\n');
    let title = '';
    const fm = s.match(/^\s*---[ \t]*\n([\s\S]*?)\n---[ \t]*(\n|$)/);
    if (fm) {
      const t = fm[1].match(/^title:\s*(.+)$/m);
      if (t) title = mmText(t[1]);
      s = s.slice(fm[0].length);
    }
    s = s.replace(/%%\{[\s\S]*?\}%%/g, '');
    const lines = [];
    let skip = false;
    for (const r of s.split('\n')) {
      const l = r.trim();
      if (skip) {
        if (l.includes('}')) skip = false;
        continue;
      }
      if (!l || l.startsWith('%%')) continue;
      if (/^acc(Title|Descr)\s*:/.test(l)) continue;
      if (/^accDescr\s*\{/.test(l)) {
        if (!l.includes('}')) skip = true;
        continue;
      }
      lines.push(l);
    }
    const head = lines.shift() || '';
    const m = head.match(/^([\w-]+)(?:[\s;]+(.*))?$/) || [];
    const kw = (m[1] || '').toLowerCase().replace(/-(beta|v2|elk)$/, '');
    const kind =
      kw === 'graph' || kw === 'flowchart' ? 'flowchart'
        : kw === 'sequencediagram' ? 'sequence'
          : kw === 'classdiagram' ? 'class'
            : kw === 'statediagram' ? 'state'
              : kw === 'erdiagram' ? 'er'
                : MM_OTHER[kw] ? kw : 'unknown';
    return { kind, lines, rest: (m[2] || '').trim(), title };
  }
  MM.kindOf = (src) => mmPrep(src).kind;
  MM.canConvert = (src) => !!MM.KIND_NAME[mmPrep(src).kind];

  // ---- sequence -> dòng PlantUML
  const MM_MSG = /^(.+?)\s*(<<-->>|<<->>|-->>|->>|--x|-x|--\)|-\)|-->|->)\s*([+-]?)\s*([^:]+?)\s*(?::\s*(.*))?$/;
  function mmSequence(M, warn) {
    const out = [], blocks = [];
    const id = (x) => '"' + String(x).trim().replace(/"/g, "'") + '"';
    for (let l of M.lines) {
      let m;
      l = l.replace(/^create\s+/i, '');
      if ((m = l.match(/^(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/i))) {
        const key = m[2].replace(/@\{[\s\S]*$/, '').trim();
        out.push(`${m[1].toLowerCase()} "${mmInline(m[3] || key).replace(/"/g, "'")}" as ${id(key)}`);
      } else if ((m = l.match(/^(activate|deactivate|destroy)\s+(.+)$/i))) out.push(`${m[1].toLowerCase()} ${id(m[2])}`);
      else if ((m = l.match(/^note\s+(left of|right of|over)\s+([^:]+?)\s*:\s*(.*)$/i)))
        out.push(`note ${m[1].toLowerCase()} ${m[2].split(',').map(id).join(',')} : ${mmInline(m[3])}`);
      else if ((m = l.match(/^(loop|alt|opt|par|critical|break)\b\s*(.*)$/i))) {
        blocks.push(m[1].toLowerCase());
        out.push(`${m[1].toLowerCase()} ${mmInline(m[2])}`);
      } else if ((m = l.match(/^(rect|box)\b/i))) {
        blocks.push('skip');
        warn(m[1].toLowerCase() === 'box' ? 'nhóm box' : 'vùng tô màu (rect)');
      } else if ((m = l.match(/^(else|and|option)\b\s*(.*)$/i))) out.push(`else ${mmInline(m[2])}`);
      else if (/^end$/i.test(l)) {
        if (blocks.pop() !== 'skip') out.push('end');
      } else if (/^autonumber\b/i.test(l)) out.push('autonumber');
      else if ((m = l.match(/^title\s*:?\s*(.+)$/i))) M.title = M.title || mmText(m[1]);
      else if (/^(links?|properties|details)\b/i.test(l)) warn('liên kết của participant');
      else if ((m = l.match(MM_MSG))) {
        const [, a, arrow, act, b, label] = m;
        const dashed = arrow.includes('--');
        let op = dashed ? '-->' : '->';
        if (/\)$/.test(arrow)) op = dashed ? '-->>' : '->>';
        if (arrow.startsWith('<<')) op = dashed ? '<-->' : '<->';
        out.push(`${id(a)} ${op} ${id(b)}${act === '+' ? ' ++' : act === '-' ? ' --' : ''}${label ? ' : ' + mmInline(label) : ''}`);
      } else warn(`dòng chưa hiểu: ${l.slice(0, 60)}`);
    }
    return out;
  }

  // ---- class -> dòng PlantUML
  function mmClass(M, warn) {
    const L = M.lines, out = [];
    const gen = (x) => String(x).replace(/~([^~]*)~/g, '<$1>');
    const ANN = { interface: 'interface', abstract: 'abstract class', enumeration: 'enum', enum: 'enum' };
    const ann = new Map(); // tên lớp -> chú thích <<interface>>…
    const declared = new Set();
    // lượt 1: chú thích đứng riêng (<<interface>> Animal) và trong thân lớp
    for (let i = 0; i < L.length; i++) {
      let m;
      if ((m = L[i].match(/^<<\s*([^>]+?)\s*>>\s*([^\s{]+)\s*$/))) ann.set(m[2], m[1]);
      else if ((m = L[i].match(/^class\s+([^\s{\["~:]+)/i)) && /\{\s*$/.test(L[i]))
        for (let j = i + 1; j < L.length && L[j] !== '}'; j++) {
          const a = L[j].match(/^<<\s*([^>]+?)\s*>>$/);
          if (a) ann.set(m[1], a[1]);
        }
    }
    const kwOf = (name) => {
      const a = (ann.get(name) || '').toLowerCase();
      return ANN[a] ? [ANN[a], ''] : ['class', a ? ` <<${ann.get(name)}>>` : ''];
    };
    let styled = false;
    for (let i = 0; i < L.length; i++) {
      const l = L[i].replace(/:::[\w-]+/g, '');
      let m;
      if ((m = l.match(/^direction\s+(LR|RL|TB|BT|TD)$/i))) out.push(/LR|RL/i.test(m[1]) ? 'left to right direction' : 'top to bottom direction');
      else if ((m = l.match(/^namespace\s+(\S+?)\s*\{$/i))) out.push(`package ${m[1]} {`);
      else if (/^<<[^>]+>>\s*\S+$/.test(l)) continue;
      else if ((m = l.match(/^class\s+([^\s{\["~:]+)(~[^~]*~)?(?:\s*\[\s*"([^"]*)"\s*\])?\s*(\{)?\s*(\})?\s*$/i))) {
        const [kw, stereo] = kwOf(m[1]);
        declared.add(m[1]);
        const name = m[3] ? `"${mmInline(m[3]).replace(/"/g, "'")}" as ${m[1]}` : m[1];
        if (m[4] && !m[5]) {
          out.push(`${kw} ${name}${gen(m[2] || '')}${stereo} {`);
          while (++i < L.length && L[i] !== '}') {
            const x = L[i];
            if (/^<<[^>]+>>$/.test(x)) continue;
            out.push(gen(x).replace(/\$\s*$/, '').replace(/\*\s*$/, '').trim());
          }
          out.push('}');
        } else out.push(`${kw} ${name}${gen(m[2] || '')}${stereo}`);
      } else if ((m = l.match(/^note\s+for\s+(\S+)\s+"([\s\S]*)"$/i))) out.push(`note right of ${m[1]} : ${mmInline(m[2])}`);
      else if ((m = l.match(/^note\s+"([\s\S]*)"$/i))) out.push(`note "${mmInline(m[1]).replace(/"/g, "'")}" as MMNOTE${i}`);
      else if (/^(style|classDef|cssClass|class\s+\S+\s*,|link|click|callback)\b/i.test(l)) {
        if (!styled) warn('màu / liên kết (style, classDef, click…)');
        styled = true;
      } else out.push(gen(l));
    }
    // lớp chỉ có chú thích, chưa khai báo
    for (const [name] of ann) if (!declared.has(name)) out.unshift(`${kwOf(name)[0]} ${name}${kwOf(name)[1]}`);
    return out;
  }

  // ---- state -> dòng PlantUML
  function mmState(M, warn) {
    const out = [];
    let styled = false;
    for (const l0 of M.lines) {
      const l = l0.replace(/:::[\w-]+/g, '');
      let m;
      if ((m = l.match(/^direction\s+(LR|RL|TB|BT|TD)$/i))) out.push(/LR|RL/i.test(m[1]) ? 'left to right direction' : 'top to bottom direction');
      else if (/^(classDef|class\s|style\s)/i.test(l)) {
        if (!styled) warn('màu (classDef, style…)');
        styled = true;
      } else out.push(l.replace(/<br\s*\/?>/gi, '\\n'));
    }
    return out;
  }

  // ---- ER -> dòng PlantUML (tên thực thể có thể chứa "-" nên luôn đặt trong ngoặc kép)
  const ER_WORD_L = { 'one or zero': '|o', 'zero or one': '|o', 'one or more': '}|', 'one or many': '}|', 'many(1)': '}|', '1+': '}|', 'zero or more': '}o', 'zero or many': '}o', 'many(0)': '}o', '0+': '}o', 'only one': '||', '1': '||' };
  const ER_FLIP = { '|o': 'o|', '}|': '|{', '}o': 'o{', '||': '||' };
  const ER_WORDS = Object.keys(ER_WORD_L).sort((x, y) => y.length - x.length).map((w) => w.replace(/[()+]/g, '\\$&')).join('|');
  const ER_SYM = /^("[^"]+"|[^\s|}{"]+)\s*(\|o|\|\||\}o|\}\|)(--|\.\.)(o\||\|\||o\{|\|\{)\s*("[^"]+"|[^\s:"]+)\s*:\s*(.*)$/;
  const ER_TXT = new RegExp(`^("[^"]+"|\\S+)\\s+(${ER_WORDS})\\s+(to|optionally to)\\s+(${ER_WORDS})\\s+("[^"]+"|\\S+)\\s*:\\s*(.*)$`, 'i');
  function mmER(M, warn) {
    const L = M.lines, out = [];
    const q = (x) => '"' + mmText(x).replace(/"/g, "'") + '"';
    for (let i = 0; i < L.length; i++) {
      const l = L[i].replace(/:::[\w-]+/g, '');
      let m;
      if ((m = l.match(ER_SYM))) out.push(`${q(m[1])} ${m[2]}${m[3]}${m[4]} ${q(m[5])} : ${mmInline(m[6])}`);
      else if ((m = l.match(ER_TXT))) {
        const lf = ER_WORD_L[m[2].toLowerCase()], rt = ER_FLIP[ER_WORD_L[m[4].toLowerCase()]];
        out.push(`${q(m[1])} ${lf}${/optionally/i.test(m[3]) ? '..' : '--'}${rt} ${q(m[5])} : ${mmInline(m[6])}`);
      } else if ((m = l.match(/^([^\s{\[]+)(?:\s*\[\s*"?([^"\]]*)"?\s*\])?\s*(\{)?\s*$/))) {
        const name = m[2] ? `"${mmInline(m[2]).replace(/"/g, "'")}" as "${m[1]}"` : q(m[1]);
        if (!m[3]) {
          out.push(`entity ${name}`);
          continue;
        }
        out.push(`entity ${name} {`);
        while (++i < L.length && L[i] !== '}') {
          const a = L[i].match(/^(\S+)\s+(\S+)\s*((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*)?\s*("[^"]*")?\s*$/i);
          if (!a) continue;
          const keys = (a[3] || '').toUpperCase();
          out.push(`${a[2]} : ${a[1].replace(/~([^~]*)~/g, '<$1>')}${/PK/.test(keys) ? ' <<PK>>' : /FK/.test(keys) ? ' <<FK>>' : ''}`);
        }
        out.push('}');
      } else if (/^(direction|style|classDef|class)\b/i.test(l)) warn('hướng / màu (direction, style…)');
      else warn(`dòng chưa hiểu: ${l.slice(0, 60)}`);
    }
    return out;
  }

  // ---- lưu đồ: đọc riêng, ra đồ thị cho layoutGraph
  const FL_SHAPES = [
    ['(((', [')))'], 'connector'], ['((', ['))'], 'connector'], ['([', ['])'], 'terminator'], ['[[', [']]'], 'predefined'],
    ['[(', [')]'], 'database'], ['{{', ['}}'], 'preparation'], ['[/', ['/]', '\\]'], 'data'], ['[\\', ['\\]', '/]'], 'data'],
    ['(', [')'], 'roundrect'], ['[', [']'], 'process'], ['{', ['}'], 'decision'], ['>', [']'], 'process'],
  ];
  const FL_NEW = {
    rect: 'process', proc: 'process', process: 'process', rectangle: 'process', rounded: 'roundrect', event: 'roundrect',
    stadium: 'terminator', terminal: 'terminator', pill: 'terminator', diam: 'decision', diamond: 'decision', decision: 'decision', question: 'decision',
    hex: 'preparation', hexagon: 'preparation', prepare: 'preparation', 'lean-r': 'data', 'lean-right': 'data', 'lean-l': 'data', 'lean-left': 'data', 'in-out': 'data', 'out-in': 'data',
    cyl: 'database', cylinder: 'database', database: 'database', db: 'database', circle: 'connector', circ: 'connector', 'sm-circ': 'connector', 'small-circle': 'connector', 'dbl-circ': 'connector', 'double-circle': 'connector',
    doc: 'document', document: 'document', docs: 'multiDocument', documents: 'multiDocument', 'st-doc': 'multiDocument', 'stacked-document': 'multiDocument',
    'fr-rect': 'predefined', subprocess: 'predefined', subroutine: 'predefined', 'framed-rectangle': 'predefined',
    'trap-t': 'manualOperation', 'trap-b': 'manualOperation', manual: 'manualOperation', 'inv-trapezoid': 'manualOperation', trapezoid: 'manualOperation', priority: 'manualOperation',
    'sl-rect': 'manualInput', 'manual-input': 'manualInput', 'sloped-rectangle': 'manualInput', delay: 'delay', 'half-rounded-rectangle': 'delay',
    'curv-trap': 'display', display: 'display', 'curved-trapezoid': 'display', comment: 'comment', braces: 'comment', 'brace-l': 'comment', 'brace-r': 'comment', text: 'text',
  };
  const ID = /[\p{L}\p{N}_](?:[\p{L}\p{N}_.]|-(?=[\p{L}\p{N}_]))*/uy;
  const HEAD = '(>|o(?![\\p{L}\\p{N}_])|x(?![\\p{L}\\p{N}_]))';
  const LINK_PLAIN = new RegExp(`^(<|o|x)?(?:(-{2,})${HEAD}|(-{3,})|(={2,})${HEAD}|(={3,})|(-\\.+-)${HEAD}?|(~{3,}))`, 'u');
  const LINK_TEXT = /^(<|o|x)?(--|==|-\.)(?![->.=])\s*(.+?)\s*(-{2,}[>ox]|-{3,}|={2,}[>ox]|={3,}|\.+-+[>ox]?)(?=\s|[\p{L}\p{N}_"|]|$)/u;
  const ARROW_OF = { '>': 'arrow', o: 'circle', x: 'slash' };
  const hex6 = (v) => (/^#[0-9a-f]{3}$/i.test(v) ? '#' + v.slice(1).replace(/./g, '$&$&') : v.toLowerCase());
  function mmStyle(props) {
    const st = {};
    for (const part of String(props || '').split(',')) {
      const i = part.indexOf(':');
      if (i < 0) continue;
      const k = part.slice(0, i).trim().toLowerCase(), v = part.slice(i + 1).trim().replace(/\s*!important$/, '');
      if (k === 'stroke-width') {
        const n = parseFloat(v);
        if (n > 0) st.strokeWidth = Math.min(n, 6);
        continue;
      }
      if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) continue;
      if (k === 'fill') st.fill = hex6(v);
      else if (k === 'stroke') st.stroke = hex6(v);
      else if (k === 'color') st.textColor = hex6(v);
    }
    return st;
  }
  /** Tách các câu lệnh bằng ";" – không tách trong ngoặc kép, trong ngoặc của hình, hay mã ký tự #quot; */
  const splitStmts = (l) => {
    const out = [];
    let cur = '', q = false, depth = 0;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') q = !q;
      else if (!q && '[({'.includes(ch)) depth++;
      else if (!q && '])}'.includes(ch)) depth = Math.max(0, depth - 1);
      if (ch === ';' && !q && !depth && !/#\w+$/.test(cur)) {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };
  function mmFlow(M, warn) {
    const dirTok = (M.rest.match(/^(TB|TD|BT|LR|RL)\b/i) || [])[1] || 'TB';
    const G = { nodes: new Map(), order: [], edges: [], dir: /LR|RL/i.test(dirTok) ? 'LR' : 'TB', flip: /BT|RL/i.test(dirTok) };
    const stack = [], classes = {}, nodeClass = [];
    const cur = () => (stack.length ? stack[stack.length - 1] : null);
    let auto = 0;
    function node(key, type, text) {
      let n = G.nodes.get(key);
      if (!n) {
        n = { key, type: type ? 'fl:' + type : 'fl:process', text: text != null ? text : key, parent: cur(), kids: [], members: [], implicit: !type };
        G.nodes.set(key, n);
        G.order.push(key);
        if (n.parent) G.nodes.get(n.parent).kids.push(key);
        return n;
      }
      if (type && n.type !== 'subgraph') {
        n.type = 'fl:' + type;
        n.implicit = false;
      }
      if (text != null && n.type !== 'subgraph') n.text = text;
      // nhắc tới trong subgraph khi đang ở ngoài cùng -> chuyển vào subgraph (giống Mermaid)
      if (!n.parent && cur() && cur() !== key && n.type !== 'subgraph') {
        n.parent = cur();
        G.nodes.get(cur()).kids.push(key);
      }
      return n;
    }
    function statement(st) {
      const s = st;
      let i = 0;
      const ws = () => {
        while (i < s.length && /\s/.test(s[i])) i++;
      };
      const readNode = () => {
        ws();
        ID.lastIndex = i;
        const m = ID.exec(s);
        if (!m) return null;
        i = ID.lastIndex;
        let type = null, text = null;
        if (s.startsWith('@{', i)) {
          const k = s.indexOf('}', i);
          const body = s.slice(i + 2, k < 0 ? s.length : k);
          i = k < 0 ? s.length : k + 1;
          const sh = (body.match(/shape\s*:\s*"?([\w-]+)"?/) || [])[1];
          const lb = body.match(/label\s*:\s*("(?:[^"\\]|\\.)*"|[^,}]+)/);
          type = sh ? FL_NEW[sh.toLowerCase()] || 'process' : null;
          if (lb) text = mmText(lb[1]);
          if (sh && !FL_NEW[sh.toLowerCase()]) warn(`hình "${sh}" vẽ thành hình chữ nhật`);
        } else
          for (const [open, closes, t] of FL_SHAPES) {
            if (!s.startsWith(open, i)) continue;
            let j = i + open.length, k = -1, close = closes[0];
            if (s[j] === '"') {
              const qe = s.indexOf('"', j + 1);
              if (qe > 0)
                for (const c of closes)
                  if (s.startsWith(c, qe + 1)) {
                    k = qe + 1;
                    close = c;
                  }
            }
            if (k < 0)
              for (const c of closes) {
                const kk = s.indexOf(c, j);
                if (kk >= 0 && (k < 0 || kk < k)) {
                  k = kk;
                  close = c;
                }
              }
            if (k < 0) continue;
            text = mmText(s.slice(j, k));
            type = (open === '[/' && close === '\\]') || (open === '[\\' && close === '/]') ? 'manualOperation' : t;
            i = k + close.length;
            break;
          }
        const cm = /^:::([\w-]+)/.exec(s.slice(i));
        if (cm) {
          i += cm[0].length;
          nodeClass.push([m[0], cm[1]]);
        }
        return node(m[0], type, text).key;
      };
      const readGroup = () => {
        const g = [];
        let k = readNode();
        if (!k) return null;
        g.push(k);
        for (;;) {
          ws();
          if (s[i] !== '&') break;
          i++;
          k = readNode();
          if (!k) break;
          g.push(k);
        }
        return g;
      };
      const readLink = () => {
        ws();
        const rest = s.slice(i);
        let m = rest.match(LINK_PLAIN), lk;
        if (m) {
          const body = m[2] || m[4] || m[5] || m[7] || m[8] || m[10] || '';
          const head = m[3] || m[6] || m[9] || '';
          lk = { left: m[1] || '', head, body, label: '' };
        } else if ((m = rest.match(LINK_TEXT))) {
          const close = m[4];
          const head = /[>ox]$/.test(close) ? close.slice(-1) : '';
          lk = { left: m[1] || '', head, body: m[2] + close, label: mmText(m[3]) };
        } else return null;
        i += m[0].length;
        ws();
        if (s[i] === '|') {
          const k = s.indexOf('|', i + 1);
          if (k > i) {
            lk.label = mmText(s.slice(i + 1, k));
            i = k + 1;
          }
        }
        return lk;
      };
      let left = readGroup();
      if (!left) return false;
      for (;;) {
        ws();
        if (i >= s.length) return true;
        const lk = readLink();
        if (!lk) return false;
        const right = readGroup();
        if (!right) return false;
        if (!lk.body.startsWith('~')) {
          const style = {};
          if (lk.body.includes('.')) style.dash = 'dashed';
          if (lk.body.includes('=')) style.strokeWidth = 3;
          style.endArrow = lk.head ? ARROW_OF[lk.head] : 'none';
          if (lk.left) style.startArrow = lk.left === '<' ? 'arrow' : ARROW_OF[lk.left];
          for (const a of left) for (const b of right) G.edges.push({ from: a, to: b, type: 'flow.arrow', label: lk.label, style: { ...style }, rank: 'down' });
        }
        left = right;
      }
    }
    const first = M.rest.replace(/^(TB|TD|BT|LR|RL)\b\s*;?/i, '').trim();
    const lines = first ? [first, ...M.lines] : M.lines;
    let ignored = false;
    for (const line of lines) {
      for (const l of splitStmts(line)) {
        let m;
        if ((m = l.match(/^subgraph\b\s*(.*)$/i))) {
          const r = m[1].trim();
          let key, title;
          if ((m = r.match(/^([^\s\["]+)\s*\[\s*([\s\S]*?)\s*\]$/))) {
            key = m[1];
            title = mmText(m[2]);
          } else if (/^"[\s\S]*"$/.test(r)) {
            key = 'subgraph:' + ++auto;
            title = mmText(r);
          } else {
            key = r || 'subgraph:' + ++auto;
            title = mmText(r);
          }
          const n = node(key, null, title);
          n.type = 'subgraph';
          n.text = title;
          n.implicit = false;
          stack.push(key);
        } else if (/^end$/i.test(l)) stack.pop();
        else if (/^direction\s+\w+$/i.test(l)) {
          if (stack.length) warn('hướng riêng trong subgraph');
          else G.dir = /LR|RL/i.test(l) ? 'LR' : 'TB';
        } else if ((m = l.match(/^classDef\s+(\S+)\s+(.+)$/i))) for (const c of m[1].split(',')) classes[c] = mmStyle(m[2]);
        else if ((m = l.match(/^class\s+(\S+)\s+(\S+)$/i))) for (const k of m[1].split(',')) nodeClass.push([k.trim(), m[2]]);
        else if ((m = l.match(/^style\s+(\S+)\s+(.+)$/i))) nodeClass.push([m[1], null, mmStyle(m[2])]);
        else if (/^(linkStyle|click|interpolate)\b/i.test(l)) {
          if (!ignored) warn('kiểu đường nối / liên kết (linkStyle, click)');
          ignored = true;
        } else if (!statement(l)) warn(`dòng chưa hiểu: ${l.slice(0, 60)}`);
      }
    }
    for (const [k, cls, st] of nodeClass) {
      const n = G.nodes.get(k);
      if (!n) continue;
      n.style = Object.assign(n.style || {}, cls ? classes[cls] || {} : {}, st || {});
    }
    if (!G.nodes.size) throw new Error('Không tìm thấy hình nào trong lưu đồ');
    return G;
  }
  /** Lật bố cục cho BT (dưới lên) / RL (phải sang trái) */
  function mirror(g, dir) {
    const vert = dir === 'TB';
    const lo = Math.min(...g.nodes.map((n) => (vert ? n.y : n.x))), hi = Math.max(...g.nodes.map((n) => (vert ? n.y + n.h : n.x + n.w)));
    g.nodes.forEach((n) => (vert ? (n.y = lo + hi - n.y - n.h) : (n.x = lo + hi - n.x - n.w)));
    const flip = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
    g.edges.forEach((e) => {
      if (vert) {
        if (e.sourcePort === 'top' || e.sourcePort === 'bottom') e.sourcePort = flip[e.sourcePort];
        if (e.targetPort === 'top' || e.targetPort === 'bottom') e.targetPort = flip[e.targetPort];
      } else {
        if (e.sourcePort === 'left' || e.sourcePort === 'right') e.sourcePort = flip[e.sourcePort];
        if (e.targetPort === 'left' || e.targetPort === 'right') e.targetPort = flip[e.targetPort];
      }
    });
  }

  /** Mermaid -> diagram JSON: { ok, kind, doc, warnings } | { ok:false, kind, error } */
  MM.convert = function (src) {
    let M, kind = 'unknown';
    try {
      M = mmPrep(src);
      kind = M.kind;
      if (MM_OTHER[kind]) return { ok: false, kind, error: `Sơ đồ Mermaid loại ${MM_OTHER[kind]} không có dạng tương ứng trên whiteboard – chỉ sửa được bằng mã.` };
      if (!MM.KIND_NAME[kind]) return { ok: false, kind, error: 'Không nhận ra loại sơ đồ Mermaid (chuyển được: flowchart / graph, sequenceDiagram, classDiagram, stateDiagram, erDiagram).' };
      const warn = warner();
      let g;
      if (kind === 'flowchart') {
        const G = mmFlow(M, warn);
        g = layoutGraph(G, 'flowchart');
        if (G.flip) mirror(g, G.dir);
      } else if (kind === 'sequence') {
        const lines = mmSequence(M, warn);
        g = parseSequence({ lines, title: M.title }, warn);
      } else {
        const lines = kind === 'class' ? mmClass(M, warn) : kind === 'state' ? mmState(M, warn) : mmER(M, warn);
        g = layoutGraph(parseGraph({ lines }, kind, warn), kind);
      }
      return finish(g, kind, M.title || MM.KIND_NAME[kind], kind === 'flowchart' ? 'flowchart' : 'uml', warn);
    } catch (e) {
      return { ok: false, kind, error: e.message || String(e) };
    }
  };
})(window.DE);
