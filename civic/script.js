(function () {
  'use strict';
  const L = window.CivicLogic;
  const { DAY, pd, ymd, daysBetween, calcPart, inspectionWindow } = L;

  const EDIT = false;
  const KEY = 'civic:v1';
  const WRITE = new Set(['editKm', 'cancelKm', 'saveKm', 'new', 'edit', 'save', 'cancel', 'del', 'replaced', 'issueDone',
    'backup', 'restore', 'csvExport', 'csvImport', 'csvApply', 'csvClear', 'saveVehicle']);
  const ed = html => EDIT ? html : '';
  const COLS = ['records', 'parts', 'inspections', 'issues', 'policies'];

  function emptyData() {
    return { records: [], parts: [], inspections: [], issues: [], policies: [], settings: { currentKm: 0, plate: '', model: '' } };
  }
  function normalize(raw) {
    const d = emptyData();
    if (!raw || typeof raw !== 'object') return d;
    COLS.forEach(c => { if (Array.isArray(raw[c])) d[c] = raw[c].filter(x => x && x.id); });
    d.settings = Object.assign(d.settings, raw.settings || {});
    return d;
  }
  function loadData() {
    if (!EDIT) return normalize(window.CIVIC_DATA);
    try { return normalize(JSON.parse(localStorage.getItem(KEY)) || window.CIVIC_DATA); } catch (e) { return emptyData(); }
  }
  function saveData() {
    if (!EDIT) return false;
    try { localStorage.setItem(KEY, JSON.stringify(D)); return true; } catch (e) { toast('저장하지 못했어요. 브라우저 저장 공간을 확인하세요.'); return false; }
  }
  function newId() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  let D = loadData();
  const S = { tab: 'home', filter: 'all', shopf: 'all', q: '', editing: null, kmEdit: false, incIns: false, pending: null, pick: null, msg: '' };

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (n == null || isNaN(n)) ? '-' : Number(n).toLocaleString('ko-KR');
  const won = n => fmt(n) + '원';
  const man = n => Math.round(n / 10000).toLocaleString('ko-KR') + '만';
  function today() { const t = new Date(); return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())); }
  function todayStr() { return ymd(today()); }
  function curKm() {
    if (D.settings.currentKm > 0) return D.settings.currentKm;
    let m = 0;
    D.records.forEach(r => { if (r.km > m) m = r.km; });
    return m;
  }
  function toast(t) {
    const el = $('#toast');
    el.textContent = t; el.hidden = false;
    clearTimeout(toast.h);
    toast.h = setTimeout(() => { el.hidden = true; }, 2600);
  }
  const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '');

  const STAT = { ok: ['●', '정상'], soon: ['▲', '임박'], over: ['■', '교체 필요'], none: ['–', '기록 없음'] };
  const pill = s => `<span class="pill ${s}"><i aria-hidden="true">${STAT[s][0]}</i>${STAT[s][1]}</span>`;
  const KIND = { repair: '정비', insurance: '보험', estimate: '견적' };
  function kindPill(k) {
    return `<span class="pill ${k === 'insurance' || k === 'estimate' ? 'ins' : 'ok'}"><i aria-hidden="true">${k === 'repair' ? '●' : k === 'insurance' ? '◆' : '○'}</i>${KIND[k] || k}</span>`;
  }
  function shopPill(t) {
    return `<span class="pill ${t === 'honda' ? 'honda' : 'general'}"><i aria-hidden="true">●</i>${t === 'honda' ? '혼다 공식' : '일반'}</span>`;
  }

  function renderVehicle() {
    const s = D.settings;
    $('#plate').textContent = s.plate || '';
    $('#vehicle').textContent = s.model || '';
  }

  function renderHead() {
    if (S.kmEdit && $('#kmInput')) return;
    const km = curKm();
    const s = String(km).padStart(6, '0');
    let started = false;
    const cells = s.split('').map((d, i) => {
      if (d !== '0') started = true;
      const z = !started && i < s.length - 1;
      return (i === 3 ? '<span class="sep"></span>' : '') + `<span class="d${z ? ' z' : ''}">${d}</span>`;
    }).join('');
    $('#head').innerHTML = S.kmEdit
      ? `<span class="odo-label">현재 주행거리</span><div class="km-edit"><input id="kmInput" type="number" inputmode="numeric" min="0" value="${km || ''}" aria-label="현재 주행거리(km)"><button class="btn primary" data-act="saveKm">저장</button><button class="btn" data-act="cancelKm">취소</button></div>`
      : `<span class="odo-label">${!EDIT && D.settings.kmDate ? `주행거리 <span class="num">${esc(D.settings.kmDate)}</span> 기준` : '현재 주행거리'}</span><div class="odo px" role="img" aria-label="주행거리 ${fmt(km)}km">${cells}<span class="u">km</span></div>${ed('<button class="btn ghost" data-act="editKm">주행거리 수정</button>')}`;
    if (S.kmEdit) { const i = $('#kmInput'); if (i) { i.focus(); i.select(); } }
  }

  const TABS = [['home', '요약'], ['parts', '교체 주기'], ['log', '정비 이력'], ['stats', '통계'], ['data', '데이터']].filter(t => EDIT || t[0] !== 'data');
  function renderTabs() {
    $('#tabs').innerHTML = TABS.map(t => `<button class="tab" role="tab" aria-selected="${S.tab === t[0]}" data-act="tab" data-v="${t[0]}">${t[1]}</button>`).join('');
  }

  function latestInsp() { return D.inspections.slice().sort(byDateDesc)[0] || null; }
  function latestPolicy() { return D.policies.slice().sort((a, b) => (b.start || '').localeCompare(a.start || ''))[0] || null; }
  function ddayLabel(dd) { return dd > 0 ? 'D-' + dd : dd === 0 ? 'D-Day' : 'D+' + (-dd); }
  function mileageHTML(p) {
    const limit = p.mileageStartKm + p.mileageLimitKm, left = limit - curKm();
    return `<div class="meta" style="color:var(--ink2);margin-top:4px">마일리지 특약 최초 <span class="num">${fmt(p.mileageStartKm)}km</span>${p.mileageStartDate ? ` (${esc(p.mileageStartDate)})` : ''} · 한도 <span class="num">${fmt(limit)}km</span>까지 <span class="num">${fmt(left)}km</span> 남음</div>
      <div class="hint" style="margin-top:4px">만기 후 최종 주행거리를 등록해야 정산돼요.</div>`;
  }
  function policyHTML() {
    const p = latestPolicy();
    if (!p) return '<p class="hint">가입 기록이 없어요.</p>';
    const dd = p.end ? daysBetween(today(), pd(p.end)) : null;
    return `${dd != null ? `<div class="big num">${ddayLabel(dd)}</div>` : ''}<div class="meta" style="color:var(--ink2)">${esc(p.insurer)} · 만기 <span class="num">${esc(p.end || '-')}</span></div>
      <div class="meta" style="color:var(--muted);margin-top:4px">보험기간 <span class="num">${esc(p.start || '-')} ~ ${esc(p.end || '-')}</span></div>
      ${p.premium ? `<div class="meta" style="color:var(--ink2);margin-top:4px">보험료 <span class="num">${won(p.premium)}</span>${p.payMethod ? ' · ' + esc(p.payMethod) : ''}</div>` : ''}
      ${p.coverage && p.coverage.length ? `<div class="meta" style="color:var(--ink2);margin-top:4px">${p.coverage.map(esc).join(' · ')}</div>` : ''}
      ${p.terms && p.terms.length ? `<div class="meta" style="color:var(--muted);margin-top:4px">특약 ${p.terms.map(esc).join(' · ')}</div>` : ''}
      ${p.mileageStartKm && p.mileageLimitKm ? mileageHTML(p) : ''}
      ${p.note ? `<div class="hint" style="margin-top:4px">${esc(p.note)}</div>` : ''}`;
  }

  function remainText(p, c) {
    const a = [];
    if (c.kmLeft != null) a.push(c.kmLeft >= 0 ? `<span class="num">${fmt(c.kmLeft)}km</span> 남음` : `<span class="num">${fmt(-c.kmLeft)}km</span> 초과`);
    if (c.daysLeft != null) a.push(c.daysLeft >= 0 ? `<span class="num">${c.due}</span> 까지 (D-${c.daysLeft})` : `기한 <span class="num">${c.due}</span> 지남 (D+${-c.daysLeft})`);
    return a.join(' · ') || (p.intervalKm > 0 || p.intervalMonths > 0 ? '마지막 교체 기록 없음' : '주기 미설정');
  }
  function partRowShort(x) {
    const p = x.p, c = x.c;
    return `<div class="row"><div class="main"><div class="ttl">${esc(p.name)}</div><div class="meta">${remainText(p, c)}</div></div><div class="end">${pill(c.status)}</div></div>`;
  }

  function homeHTML() {
    const km = curKm(), t = today();
    const attn = D.parts.map(p => ({ p, c: calcPart(p, km, t) })).filter(x => x.c.status === 'over' || x.c.status === 'soon').sort((a, b) => b.c.ratio - a.c.ratio);
    const li = latestInsp();
    let insp = '<p class="hint">검사 기록이 없어요.</p>';
    if (li && li.nextDate) {
      const dd = daysBetween(t, pd(li.nextDate));
      const w = inspectionWindow(li.nextDate);
      const inWin = todayStr() >= w.start && todayStr() <= w.end;
      const label = ddayLabel(dd);
      insp = `<div class="big num">${label}</div><div class="meta" style="color:var(--ink2)">다음 종합검사일 <span class="num">${esc(li.nextDate)}</span></div>
      <div class="meta" style="color:var(--ink2);margin-top:4px">검사 가능 기간 <span class="num">${w.start} ~ ${w.end}</span> ${inWin ? pill('soon').replace('임박', '검사 기간') : ''}</div>
      <div class="meta" style="color:var(--muted);margin-top:4px">마지막 검사 <span class="num">${esc(li.date)}</span> · ${esc(li.result || '')}</div>`;
    }
    const repairs = D.records.filter(r => r.kind === 'repair');
    const total = repairs.reduce((a, r) => a + (r.amount || 0), 0);
    const dates = repairs.map(r => r.date).sort();
    const issues = D.issues.filter(i => i.status !== 'done').sort((a, b) => (a.since || '').localeCompare(b.since || ''));
    const recent = D.records.slice().sort(byDateDesc).slice(0, 4);
    return `<div class="grid">
    <div class="stack">
      <section><h2 class="sec">지금 챙길 소모품 <button class="btn ghost" data-act="tab" data-v="parts">전체 보기</button></h2>
        ${attn.length ? attn.map(partRowShort).join('') : `<div class="empty"><b>임박한 항목이 없어요</b>${D.parts.length ? '모든 항목이 주기 안에 있어요.' : '등록된 교체 항목이 없어요.'}</div>`}
      </section>
      <section><h2 class="sec">최근 정비 <button class="btn ghost" data-act="tab" data-v="log">전체 보기</button></h2>
        ${recent.length ? recent.map(r => `<div class="row ${r.kind === 'estimate' ? 'est' : ''}"><div class="main"><div class="ttl">${esc(r.title)}</div><div class="meta"><span class="date">${esc(r.date)}</span> · ${esc(r.shop)} · <span class="num">${fmt(r.km)}km</span></div></div><div class="end">${kindPill(r.kind)}<div class="num" style="margin-top:4px">${won(r.amount)}</div></div></div>`).join('') : '<p class="hint">정비 기록이 없어요.</p>'}
      </section>
    </div>
    <div class="stack">
      <section class="panel"><h2 class="sec">종합검사</h2>${insp}</section>
      <section class="panel"><h2 class="sec">자동차보험</h2>${policyHTML()}</section>
      <section><h2 class="sec">열린 이슈 ${ed('<button class="btn ghost" data-act="new" data-type="issue">추가</button>')}</h2>
        ${issues.length ? issues.map(i => `<div class="row"><div class="main"><div class="ttl">${esc(i.text)}</div><div class="meta"><span class="date">${esc(i.since || '')}</span></div></div>${ed(`<div class="end"><button class="btn ghost" data-act="issueDone" data-id="${esc(i.id)}">완료</button></div>`)}</div>`).join('') : '<p class="hint">열린 이슈가 없어요.</p>'}
      </section>
      <section><h2 class="sec">누적 정비비</h2>
        <div class="big num">${won(total)}</div>
        <div class="meta" style="color:var(--ink2)">자비 정비 ${repairs.length}건${dates.length ? ` · <span class="num">${dates[0].slice(0, 7)} ~ ${dates[dates.length - 1].slice(0, 7)}</span>` : ''}</div>
        <div class="hint" style="margin-top:4px">보험 수리와 견적은 제외</div>
      </section>
    </div>
  </div>`;
  }

  function partsHTML() {
    const km = curKm(), t = today();
    const list = D.parts.map(p => ({ p, c: calcPart(p, km, t) })).sort((a, b) => b.c.ratio - a.c.ratio);
    return `<div class="bar-row"><p class="hint">주기는 웹에서 찾은 참고값이에요. 공식 취급설명서 확인 전이에요.${ed(' 항목마다 수정할 수 있어요.')} 기준은 주행거리 <span class="num">${fmt(km)}km</span>.</p>${ed('<button class="btn primary" data-act="new" data-type="part">항목 추가</button>')}</div>
  ${list.length ? list.map(x => {
      const p = x.p, c = x.c, w = Math.min(100, Math.max(0, c.ratio * 100));
      return `<div class="part ${c.status}"><div class="part-h"><div><strong>${esc(p.name)}</strong> ${pill(c.status)}</div>
      ${ed(`<div class="actions"><button class="btn" data-act="replaced" data-id="${esc(p.id)}">오늘 교체함</button><button class="btn ghost" data-act="edit" data-type="part" data-id="${esc(p.id)}">수정</button></div>`)}</div>
      <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(w)}" aria-label="${esc(p.name)} 사용량"><b style="width:${w}%"></b></div>
      <div class="facts"><span>${remainText(p, c)}</span><span>마지막 교체 <span class="num">${esc(p.lastDate || '-')}</span> · <span class="num">${p.lastKm != null && p.lastKm !== '' ? fmt(p.lastKm) + 'km' : '-'}</span></span><span>주기 ${p.intervalKm > 0 ? `<span class="num">${fmt(p.intervalKm)}km</span>` : ''}${p.intervalKm > 0 && p.intervalMonths > 0 ? ' / ' : ''}${p.intervalMonths > 0 ? `<span class="num">${p.intervalMonths}개월</span>` : ''}</span></div>
      ${p.note ? `<div class="hint">${esc(p.note)}</div>` : ''}</div>`;
    }).join('') : `<div class="empty"><b>등록된 교체 항목이 없어요</b>${ed('항목 추가로 엔진오일, 미션오일 같은 소모품을 등록하세요.')}</div>`}`;
  }

  function logListHTML() {
    const q = S.q.trim().toLowerCase();
    const list = D.records.filter(r => {
      if (S.filter !== 'all' && r.kind !== S.filter) return false;
      if (S.shopf !== 'all' && r.shopType !== S.shopf) return false;
      if (q) {
        const hay = (r.title + ' ' + r.shop + ' ' + (r.items || []).join(' ') + ' ' + (r.note || '') + ' ' + r.date).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort(byDateDesc);
    if (!list.length) return `<div class="empty"><b>${D.records.length ? '조건에 맞는 기록이 없어요' : '아직 정비 기록이 없어요'}</b>${D.records.length ? '필터나 검색어를 바꿔 보세요.' : ed('정비 추가로 첫 기록을 남기세요.')}</div>`;
    return list.map(r => `<details class="rec ${r.kind === 'estimate' ? 'est' : ''}"><summary><div class="main" style="min-width:0;flex:1"><div class="ttl" style="font-weight:500;overflow-wrap:anywhere">${esc(r.title)}</div>
      <div class="meta" style="color:var(--ink2);font-size:12.5px;margin-top:2px"><span class="date">${esc(r.date)}</span> · ${esc(r.shop)} · <span class="num">${fmt(r.km)}km</span></div></div>
      <div class="end" style="text-align:right;white-space:nowrap">${kindPill(r.kind)} ${shopPill(r.shopType)}<div class="num" style="margin-top:4px">${won(r.amount)}</div></div></summary>
    <div class="rec-body">${(r.items && r.items.length) ? `<ul>${r.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}${r.note ? `<div class="hint">${esc(r.note)}</div>` : ''}
      ${ed(`<div class="actions"><button class="btn" data-act="edit" data-type="record" data-id="${esc(r.id)}">수정</button></div>`)}</div></details>`).join('');
  }
  function logHTML() {
    const chip = (k, v, l, cur) => `<button class="chip" aria-pressed="${cur === v}" data-act="${k}" data-v="${v}">${l}</button>`;
    const insp = D.inspections.slice().sort(byDateDesc);
    const pols = D.policies.slice().sort((a, b) => (b.start || '').localeCompare(a.start || ''));
    return `<div class="bar-row"><input id="q" class="search" type="search" placeholder="제목, 정비소, 내역 검색" value="${esc(S.q)}" aria-label="정비 이력 검색">${ed('<button class="btn primary" data-act="new" data-type="record">정비 추가</button>')}</div>
  <div class="chips" role="group" aria-label="구분">${chip('filter', 'all', '전체', S.filter)}${chip('filter', 'repair', '정비', S.filter)}${chip('filter', 'insurance', '보험', S.filter)}${chip('filter', 'estimate', '견적', S.filter)}</div>
  <div class="chips" role="group" aria-label="정비소 유형">${chip('shopf', 'all', '모든 정비소', S.shopf)}${chip('shopf', 'honda', '혼다 공식', S.shopf)}${chip('shopf', 'general', '일반', S.shopf)}</div>
  <div id="loglist">${logListHTML()}</div>
  <section style="margin-top:32px"><h2 class="sec">종합검사 ${ed('<button class="btn ghost" data-act="new" data-type="insp">검사 추가</button>')}</h2>
  ${insp.length ? insp.map(i => `<div class="row"><div class="main"><div class="ttl">${esc(i.result || '')} <span class="date">${esc(i.date)}</span></div><div class="meta"><span class="num">${fmt(i.km)}km</span> · 다음 검사일 <span class="num">${esc(i.nextDate || '-')}</span>${i.note ? '<br>' + esc(i.note) : ''}</div></div>${ed(`<div class="end"><button class="btn ghost" data-act="edit" data-type="insp" data-id="${esc(i.id)}">수정</button></div>`)}</div>`).join('') : '<p class="hint">검사 기록이 없어요.</p>'}</section>
  <section style="margin-top:32px"><h2 class="sec">자동차보험 ${ed('<button class="btn ghost" data-act="new" data-type="policy">가입 추가</button>')}</h2>
  ${pols.length ? pols.map(p => `<div class="row"><div class="main"><div class="ttl">${esc(p.insurer)} <span class="date">${esc(p.start || '')} ~ ${esc(p.end || '')}</span></div><div class="meta">${(p.coverage || []).map(esc).join(' · ')}${p.note ? '<br>' + esc(p.note) : ''}</div></div>${ed(`<div class="end"><button class="btn ghost" data-act="edit" data-type="policy" data-id="${esc(p.id)}">수정</button></div>`)}</div>`).join('') : '<p class="hint">가입 기록이 없어요.</p>'}</section>`;
  }

  function niceStep(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
  function statsData() {
    const recs = D.records.filter(r => r.kind === 'repair' || (S.incIns && r.kind === 'insurance'));
    const years = {};
    recs.forEach(r => {
      const y = (r.date || '').slice(0, 4);
      if (!y) return;
      (years[y] = years[y] || { sum: 0, n: 0 });
      years[y].sum += r.amount || 0; years[y].n++;
    });
    const ys = Object.keys(years).map(Number);
    const list = [];
    if (ys.length) for (let y = Math.min.apply(null, ys); y <= Math.max.apply(null, ys); y++) list.push({ y: String(y), sum: (years[y] || { sum: 0 }).sum, n: (years[y] || { n: 0 }).n });
    const shops = {};
    recs.forEach(r => {
      const k = r.shop || '기타';
      (shops[k] = shops[k] || { sum: 0, n: 0, type: r.shopType });
      shops[k].sum += r.amount || 0; shops[k].n++;
    });
    const shopList = Object.keys(shops).map(k => ({ name: k, sum: shops[k].sum, n: shops[k].n, type: shops[k].type })).sort((a, b) => b.sum - a.sum);
    const pts = [], seen = {};
    D.records.concat(D.inspections).forEach(r => {
      if (!r.date || !r.km) return;
      const k = r.date + '|' + r.km;
      if (seen[k]) return;
      seen[k] = 1; pts.push({ date: r.date, km: r.km });
    });
    pts.sort((a, b) => a.date.localeCompare(b.date));
    return { list, shopList, pts };
  }
  function yearChart(d) {
    const W = 640, H = 250, Lm = 48, R = 10, T = 22, B = 28;
    if (!d.list.length) return { html: '<p class="hint">표시할 지출이 없어요.</p>', pts: [], W };
    const maxV = Math.max.apply(null, d.list.map(x => x.sum)) || 1;
    const step = niceStep(maxV / 4), max = step * Math.ceil(maxV / step);
    const iw = W - Lm - R, ih = H - T - B, band = iw / d.list.length, bw = Math.min(54, band * 0.55);
    const y = v => T + ih - (v / max) * ih;
    let g = '', bars = '';
    const pts = [];
    for (let v = 0; v <= max + 1; v += step) g += `<line class="gl" x1="${Lm}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${Lm - 6}" y="${y(v) + 4}" text-anchor="end">${v === 0 ? '0' : man(v)}</text>`;
    d.list.forEach((x, i) => {
      const cx = Lm + band * i + band / 2, h = (x.sum / max) * ih, top = T + ih - h;
      if (x.sum > 0) {
        const r = Math.min(4, h / 2);
        bars += `<path class="bar" d="M${cx - bw / 2},${T + ih} V${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} H${cx + bw / 2 - r} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} V${T + ih} Z"/><text class="vlab" x="${cx}" y="${top - 6}" text-anchor="middle">${man(x.sum)}</text>`;
      }
      bars += `<text class="tick" x="${cx}" y="${H - 8}" text-anchor="middle">${x.y}</text>`;
      pts.push({ x: cx, y: top, html: `<b>${x.y}년</b><br>${won(x.sum)} · ${x.n}건` });
    });
    return { html: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="연도별 정비비">${g}<line class="ax" x1="${Lm}" x2="${W - R}" y1="${T + ih}" y2="${T + ih}"/>${bars}</svg><div class="tip" hidden></div>`, pts, W };
  }
  function kmChart(d) {
    const W = 640, H = 250, Lm = 56, R = 14, T = 16, B = 28;
    if (d.pts.length < 2) return { html: '<p class="hint">주행거리 기록이 2개 이상 필요해요.</p>', pts: [], W };
    const t0 = pd(d.pts[0].date).getTime(), t1 = pd(d.pts[d.pts.length - 1].date).getTime();
    const kmin = Math.min.apply(null, d.pts.map(p => p.km)), kmax = Math.max.apply(null, d.pts.map(p => p.km));
    const lo = Math.floor(kmin / 10000) * 10000, hi = Math.ceil(kmax / 10000) * 10000 || lo + 10000;
    const iw = W - Lm - R, ih = H - T - B;
    const X = t => Lm + (t - t0) / Math.max(1, t1 - t0) * iw, Y = k => T + ih - (k - lo) / Math.max(1, hi - lo) * ih;
    let g = '';
    const ts = Math.max(1, Math.round((hi - lo) / 10000 / 4)) * 10000;
    for (let k = lo; k <= hi; k += ts) g += `<line class="gl" x1="${Lm}" x2="${W - R}" y1="${Y(k)}" y2="${Y(k)}"/><text class="tick" x="${Lm - 6}" y="${Y(k) + 4}" text-anchor="end">${fmt(k)}</text>`;
    const y0 = new Date(t0).getUTCFullYear(), y1 = new Date(t1).getUTCFullYear();
    let xt = '';
    for (let y = y0 + 1; y <= y1; y++) {
      const tt = Date.UTC(y, 0, 1);
      xt += `<text class="tick" x="${X(tt)}" y="${H - 8}" text-anchor="middle">${y}</text><line class="ax" x1="${X(tt)}" x2="${X(tt)}" y1="${T + ih}" y2="${T + ih + 4}"/>`;
    }
    const pts = d.pts.map(p => ({ x: X(pd(p.date).getTime()), y: Y(p.km), html: `<b>${p.date}</b><br>${fmt(p.km)}km` }));
    const path = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    return { html: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="주행거리 추이">${g}<line class="ax" x1="${Lm}" x2="${W - R}" y1="${T + ih}" y2="${T + ih}"/>${xt}<path class="ln" d="${path}"/>${pts.map(p => `<circle class="pt" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"/>`).join('')}<circle class="hl" r="7" cx="-20" cy="-20"/></svg><div class="tip" hidden></div>`, pts, W };
  }
  let CH = [];
  function statsHTML() {
    const d = statsData();
    const yc = yearChart(d), kc = kmChart(d);
    CH = [{ id: 'c1', c: yc }, { id: 'c2', c: kc }];
    const maxS = Math.max.apply(null, d.shopList.map(s => s.sum)) || 1;
    let perYear = '';
    if (d.pts.length >= 2) {
      const a = d.pts[0], b = d.pts[d.pts.length - 1];
      const yrs = (pd(b.date) - pd(a.date)) / DAY / 365.25;
      if (yrs > 0.5) perYear = `연평균 약 <span class="num">${fmt(Math.round((b.km - a.km) / yrs / 100) * 100)}km</span> (${a.date.slice(0, 7)} ~ ${b.date.slice(0, 7)})`;
    }
    return `<div class="bar-row"><label class="toggle"><input type="checkbox" id="incIns" ${S.incIns ? 'checked' : ''}> 보험 수리 포함</label><span class="hint">견적은 항상 제외</span></div>
  <div class="charts">
   <section><h2 class="sec">연도별 정비비</h2><div class="cbox" id="c1">${yc.html}</div></section>
   <section><h2 class="sec">정비소별 정비비</h2><div class="legend"><span><i class="sw" style="background:var(--s1)"></i>혼다 공식</span><span><i class="sw" style="background:var(--s2)"></i>일반</span></div>
     <div class="hbars">${d.shopList.length ? d.shopList.map(s => `<div class="hb" title="${esc(s.name)} · ${won(s.sum)} · ${s.n}건"><span class="nm">${esc(s.name)}</span><span class="tr"><b style="width:${(s.sum / maxS * 100).toFixed(1)}%;background:var(${s.type === 'general' ? '--s2' : '--s1'})"></b></span><span class="vl">${won(s.sum)}</span></div>`).join('') : '<p class="hint">표시할 지출이 없어요.</p>'}</div></section>
   <section><h2 class="sec">주행거리 추이 (km)</h2><div class="cbox" id="c2">${kc.html}</div>${perYear ? `<p class="hint" style="margin-top:8px">${perYear}</p>` : ''}</section>
  </div>`;
  }
  function bindTip(box, c) {
    if (!box || !c.pts.length) return;
    const svg = box.querySelector('svg'), tip = box.querySelector('.tip'), hl = svg.querySelector('.hl');
    svg.addEventListener('pointermove', e => {
      const r = svg.getBoundingClientRect(), sc = r.width / c.W, x = (e.clientX - r.left) / sc;
      let b = null, bd = 1e9;
      c.pts.forEach(p => { const dd = Math.abs(p.x - x); if (dd < bd) { bd = dd; b = p; } });
      if (!b) return;
      tip.hidden = false; tip.innerHTML = b.html;
      tip.style.left = (b.x * sc) + 'px'; tip.style.top = (b.y * sc) + 'px';
      if (hl) { hl.setAttribute('cx', b.x); hl.setAttribute('cy', b.y); }
    });
    svg.addEventListener('pointerleave', () => {
      tip.hidden = true;
      if (hl) { hl.setAttribute('cx', -20); hl.setAttribute('cy', -20); }
    });
  }

  function dataHTML() {
    const s = D.settings, p = S.pending;
    return `<p class="notice">데이터는 이 브라우저에만 저장돼요. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 백업 파일을 받아 두세요.</p>
  <div class="grid"><div class="stack">
   <section class="panel"><h3>백업</h3><p class="hint">정비 이력, 교체 주기, 종합검사, 자동차보험, 이슈, 설정 전체를 JSON 파일로 저장하거나 복원해요. 복원하면 지금 데이터가 모두 바뀌어요.</p>
     <div class="actions" style="margin-top:12px"><button class="btn primary" data-act="backup">백업 받기</button><button class="btn" data-act="restore">백업 불러오기</button></div></section>
   <section class="panel"><h3>구글 시트</h3><p class="hint">정비 이력을 CSV로 받아 구글 시트의 파일 › 가져오기로 열어요. 시트에서 고친 CSV를 다시 불러오면 같은 id의 기록은 시트 값으로 덮어써요. 교체 주기와 검사 기록은 포함되지 않아요.</p>
     <div class="actions" style="margin-top:12px"><button class="btn primary" data-act="csvExport" ${D.records.length ? '' : 'disabled'}>CSV 내보내기</button><button class="btn" data-act="csvImport">CSV 불러오기</button></div>
     ${p ? `<div class="out"><b>${p.length}건</b>을 읽었어요.<div class="actions" style="margin-top:10px"><button class="btn primary" data-act="csvApply" ${p.length ? '' : 'disabled'}>병합 적용</button><button class="btn" data-act="csvClear">취소</button></div></div>` : ''}
     <div class="out">${esc(S.msg)}</div></section>
  </div><div class="stack">
   <section class="panel"><h3>차량 정보</h3><div class="formgrid" style="margin-top:12px">
     <label class="f wide">차량 번호<input id="s_plate" type="text" value="${esc(s.plate)}"></label>
     <label class="f wide">차종 표시<input id="s_model" type="text" value="${esc(s.model)}" placeholder="예: CIVIC 1.8 · FD1 · 2008년식"></label></div>
     <div class="actions" style="margin-top:12px"><button class="btn primary" data-act="saveVehicle">저장</button></div></section>
   <section><h2 class="sec">CSV 열 구성</h2><p class="hint" style="line-height:1.8">${L.REC_COLS.map(c => L.COL_KO[c]).join(' · ')}<br>내역은 「 | 」로 구분해요. 구분 값은 repair, insurance, estimate, 정비소유형 값은 honda, general이에요.</p></section>
  </div></div>`;
  }

  const FORMS = {
    record: { col: 'records', title: '정비 기록', fields: [
      { k: 'date', l: '날짜', t: 'date', req: 1 }, { k: 'km', l: '주행거리(km)', t: 'num' }, { k: 'shop', l: '정비소', t: 'text', req: 1 },
      { k: 'shopType', l: '정비소 유형', t: 'sel', o: [['honda', '혼다 공식'], ['general', '일반']] },
      { k: 'kind', l: '구분', t: 'sel', o: [['repair', '정비 (자비)'], ['insurance', '보험 수리'], ['estimate', '견적']] },
      { k: 'amount', l: '금액(원, VAT 포함)', t: 'num' }, { k: 'title', l: '제목', t: 'text', req: 1, w: 1 },
      { k: 'items', l: '내역 (줄바꿈으로 구분)', t: 'lines', w: 1 }, { k: 'note', l: '메모', t: 'area', w: 1 }] },
    part: { col: 'parts', title: '교체 항목', fields: [
      { k: 'name', l: '항목명', t: 'text', req: 1, w: 1 }, { k: 'intervalKm', l: '교체 주기(km)', t: 'num' }, { k: 'intervalMonths', l: '교체 주기(개월)', t: 'num' },
      { k: 'lastDate', l: '마지막 교체일', t: 'date' }, { k: 'lastKm', l: '마지막 교체 주행거리(km)', t: 'num' }, { k: 'note', l: '메모', t: 'area', w: 1 }] },
    insp: { col: 'inspections', title: '종합검사', fields: [
      { k: 'date', l: '검사일', t: 'date', req: 1 }, { k: 'km', l: '주행거리(km)', t: 'num' }, { k: 'result', l: '결과', t: 'text' },
      { k: 'nextDate', l: '다음 검사일', t: 'date' }, { k: 'note', l: '메모', t: 'area', w: 1 }] },
    policy: { col: 'policies', title: '자동차보험', fields: [
      { k: 'insurer', l: '보험사', t: 'text', req: 1 }, { k: 'start', l: '보험 시작일', t: 'date', req: 1 }, { k: 'end', l: '보험 만기일', t: 'date', req: 1 },
      { k: 'premium', l: '보험료(원)', t: 'num' }, { k: 'payMethod', l: '납입방법', t: 'text' },
      { k: 'coverage', l: '가입담보 (줄바꿈으로 구분)', t: 'lines', w: 1 }, { k: 'terms', l: '특별약관 (줄바꿈으로 구분)', t: 'lines', w: 1 },
      { k: 'mileageStartKm', l: '마일리지 최초 주행거리(km)', t: 'num' }, { k: 'mileageStartDate', l: '최초 주행거리 확인일', t: 'date' },
      { k: 'mileageLimitKm', l: '마일리지 약정 상한(km)', t: 'num' }, { k: 'note', l: '메모', t: 'area', w: 1 }] },
    issue: { col: 'issues', title: '이슈', fields: [
      { k: 'text', l: '내용', t: 'area', req: 1, w: 1 }, { k: 'since', l: '발견일', t: 'date' }] },
  };
  function formDefaults(type) {
    if (type === 'record') return { date: todayStr(), km: curKm() || null, shopType: 'honda', kind: 'repair', items: [], amount: 0 };
    if (type === 'insp') return { date: todayStr(), km: curKm() || null, result: '적합' };
    if (type === 'issue') return { since: todayStr(), status: 'open' };
    return {};
  }
  function formHTML() {
    const E = S.editing, F = FORMS[E.type], d = E.data;
    const f = F.fields.map(x => {
      const v = d[x.k];
      let inp;
      if (x.t === 'sel') inp = `<select id="f_${x.k}">${x.o.map(o => `<option value="${o[0]}" ${v === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
      else if (x.t === 'area') inp = `<textarea id="f_${x.k}">${esc(v || '')}</textarea>`;
      else if (x.t === 'lines') inp = `<textarea id="f_${x.k}">${esc((v || []).join('\n'))}</textarea>`;
      else if (x.t === 'num') inp = `<input id="f_${x.k}" type="number" inputmode="numeric" value="${v == null ? '' : esc(v)}">`;
      else inp = `<input id="f_${x.k}" type="${x.t === 'date' ? 'date' : 'text'}" value="${esc(v || '')}">`;
      return `<label class="f ${x.w ? 'wide' : ''}">${x.l}${x.req ? ' *' : ''}${inp}</label>`;
    }).join('');
    return `<section class="panel"><h3>${F.title} ${E.id ? '수정' : '추가'}</h3><div class="formgrid" style="margin-top:12px">${f}</div>
    <div class="actions" style="margin-top:16px"><button class="btn primary" data-act="save">저장</button><button class="btn" data-act="cancel">취소</button>${E.id ? '<button class="btn danger" data-act="del" style="margin-left:auto">삭제</button>' : ''}</div>
    <div class="out" id="formMsg"></div></section>`;
  }

  function upsert(col, id, body) {
    const list = D[col];
    if (id) {
      const i = list.findIndex(x => x.id === id);
      if (i >= 0) { list[i] = Object.assign({}, body, { id }); return id; }
    }
    const nid = id || newId();
    list.push(Object.assign({}, body, { id: nid }));
    return nid;
  }
  function saveForm() {
    const E = S.editing, F = FORMS[E.type], body = Object.assign({}, E.data);
    for (const x of F.fields) {
      const el = $('#f_' + x.k);
      if (!el) continue;
      let v = el.value;
      if (x.t === 'num') v = v.trim() === '' ? null : Number(v);
      else if (x.t === 'lines') v = v.split('\n').map(s => s.trim()).filter(Boolean);
      else v = v.trim();
      if (x.req && (v === '' || v == null || (Array.isArray(v) && !v.length))) { $('#formMsg').textContent = `${x.l} 항목이 필요해요.`; return; }
      body[x.k] = v;
    }
    delete body.id;
    upsert(F.col, E.id, body);
    if (E.type === 'record' && body.kind !== 'estimate' && body.km > D.settings.currentKm) D.settings.currentKm = body.km;
    if (!saveData()) return;
    S.editing = null; toast('저장됨'); render();
  }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function pickFile(kind, accept) {
    S.pick = kind;
    const f = $('#file');
    f.accept = accept; f.value = ''; f.click();
  }
  function onFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      if (S.pick === 'csv') {
        const rows = L.csvToRecords(text);
        S.pending = rows;
        S.msg = rows.length ? '' : '정비 이력 형식의 행을 찾지 못했어요. 열 이름(날짜, 정비소, 제목 등)을 확인하세요.';
      } else if (S.pick === 'json') {
        let raw = null;
        try { raw = JSON.parse(text); } catch (e) { /* 아래에서 처리 */ }
        const nd = raw && normalize(raw);
        if (!nd || !COLS.some(c => nd[c].length)) { S.msg = '백업 파일 형식이 아니에요.'; render(); return; }
        if (!window.confirm(`현재 데이터를 지우고 백업(정비 ${nd.records.length}건, 교체 항목 ${nd.parts.length}개)으로 바꿀까요?`)) return;
        D = nd; saveData(); S.msg = '백업을 불러왔어요.';
      }
      render();
    };
    reader.readAsText(file, 'utf-8');
  }

  const H = {
    tab(b) {
      S.tab = b.dataset.v; S.editing = null;
      try { history.replaceState(null, '', '#' + S.tab); } catch (e) { /* 무시 */ }
      render();
    },
    filter(b) { S.filter = b.dataset.v; render(); },
    shopf(b) { S.shopf = b.dataset.v; render(); },
    editKm() { S.kmEdit = true; renderHead(); },
    cancelKm() { S.kmEdit = false; renderHead(); },
    saveKm() {
      const v = Number($('#kmInput').value);
      if (!(v >= 0)) return;
      D.settings.currentKm = v;
      if (!saveData()) return;
      S.kmEdit = false; toast('주행거리 저장됨'); render();
    },
    new(b) { S.editing = { type: b.dataset.type, id: null, data: formDefaults(b.dataset.type) }; render(); window.scrollTo(0, 0); },
    edit(b) {
      const F = FORMS[b.dataset.type], d = D[F.col].find(x => x.id === b.dataset.id);
      if (!d) return;
      S.editing = { type: b.dataset.type, id: d.id, data: Object.assign({}, d) };
      render(); window.scrollTo(0, 0);
    },
    save() { saveForm(); },
    cancel() { S.editing = null; render(); },
    del(b) {
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = '한 번 더 누르면 삭제'; return; }
      const E = S.editing, col = FORMS[E.type].col;
      D[col] = D[col].filter(x => x.id !== E.id);
      if (!saveData()) return;
      S.editing = null; toast('삭제됨'); render();
    },
    replaced(b) {
      const km = curKm();
      if (!km) { toast('현재 주행거리를 먼저 입력하세요'); return; }
      const p = D.parts.find(x => x.id === b.dataset.id);
      if (!p) return;
      p.lastDate = todayStr(); p.lastKm = km;
      if (saveData()) { toast('교체 기록됨'); render(); }
    },
    issueDone(b) {
      const i = D.issues.find(x => x.id === b.dataset.id);
      if (!i) return;
      i.status = 'done'; i.doneDate = todayStr();
      if (saveData()) { toast('이슈 완료'); render(); }
    },
    backup() { download('civic-backup-' + todayStr() + '.json', JSON.stringify(D, null, 2), 'application/json'); },
    restore() { pickFile('json', 'application/json,.json'); },
    csvExport() { download('civic-records-' + todayStr() + '.csv', '﻿' + L.recordsToCSV(D.records.slice().sort(byDateDesc)), 'text/csv;charset=utf-8'); },
    csvImport() { pickFile('csv', '.csv,text/csv'); },
    csvApply() {
      if (!S.pending) return;
      const n = S.pending.length;
      D.records = L.mergeById(D.records, S.pending);
      S.pending = null;
      if (saveData()) S.msg = `${n}건을 병합했어요.`;
      render();
    },
    csvClear() { S.pending = null; S.msg = ''; render(); },
    saveVehicle() {
      D.settings.plate = $('#s_plate').value.trim();
      D.settings.model = $('#s_model').value.trim();
      if (saveData()) { toast('저장됨'); render(); }
    },
  };

  function bodyHTML() {
    if (!D.records.length && !D.parts.length && !S.editing && S.tab !== 'data') {
      return `<div class="empty"><b>아직 기록이 없어요</b>${ed('정비 이력 탭에서 첫 기록을 추가하거나, 데이터 탭에서 백업 파일을 불러오세요.<div class="actions" style="margin-top:12px"><button class="btn primary" data-act="new" data-type="record">정비 추가</button><button class="btn" data-act="tab" data-v="data">데이터 탭</button></div>')}</div>`;
    }
    return ({ home: homeHTML, parts: partsHTML, log: logHTML, stats: statsHTML, data: dataHTML })[S.tab]();
  }
  function render() {
    renderVehicle(); renderHead(); renderTabs();
    if (S.editing) { $('#view').innerHTML = formHTML(); return; }
    $('#view').innerHTML = bodyHTML();
    if (S.tab === 'stats') CH.forEach(x => bindTip($('#' + x.id), x.c));
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && H[b.dataset.act] && (EDIT || !WRITE.has(b.dataset.act))) H[b.dataset.act](b, e);
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'q') { S.q = e.target.value; const l = $('#loglist'); if (l) l.innerHTML = logListHTML(); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'incIns') { S.incIns = e.target.checked; render(); }
    if (e.target.id === 'file' && e.target.files[0]) onFile(e.target.files[0]);
  });
  document.addEventListener('keydown', e => { if (EDIT && e.key === 'Enter' && e.target.id === 'kmInput') H.saveKm(); });

  const h = (location.hash || '').replace('#', '');
  if (TABS.some(t => t[0] === h)) S.tab = h;
  render();
})();
