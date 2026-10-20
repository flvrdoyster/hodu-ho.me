(function (root) {
  const DAY = 86400000;

  function pd(s) {
    const a = String(s).split('-').map(Number);
    return new Date(Date.UTC(a[0], a[1] - 1, a[2]));
  }
  function ymd(d) {
    return d.toISOString().slice(0, 10);
  }
  function addMonths(s, n) {
    const d = pd(s);
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    t.setUTCDate(Math.min(d.getUTCDate(), last));
    return t;
  }
  function daysBetween(a, b) {
    return Math.round((b - a) / DAY);
  }

  function calcPart(p, km, today) {
    const out = { kmLeft: null, daysLeft: null, ratio: 0, status: 'none', due: null };
    const r = [];
    if (p.intervalKm > 0 && p.lastKm != null && p.lastKm !== '') {
      out.kmLeft = p.lastKm + p.intervalKm - km;
      r.push((km - p.lastKm) / p.intervalKm);
    }
    if (p.intervalMonths > 0 && p.lastDate) {
      const due = addMonths(p.lastDate, p.intervalMonths);
      out.due = ymd(due);
      out.daysLeft = daysBetween(today, due);
      const tot = daysBetween(pd(p.lastDate), due);
      r.push(tot > 0 ? (tot - out.daysLeft) / tot : 0);
    }
    out.ratio = r.length ? Math.max.apply(null, r) : 0;
    out.status = !r.length ? 'none' : out.ratio >= 1 ? 'over' : out.ratio >= 0.85 ? 'soon' : 'ok';
    return out;
  }

  function inspectionWindow(nextDate) {
    const t = pd(nextDate).getTime();
    return { start: ymd(new Date(t - 90 * DAY)), end: ymd(new Date(t + 31 * DAY)) };
  }

  function csvEsc(v) {
    v = v == null ? '' : String(v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  const REC_COLS = ['id', 'date', 'km', 'shop', 'shopType', 'kind', 'title', 'items', 'amount', 'note'];
  const COL_KO = {
    id: 'id', date: '날짜', km: '주행거리', shop: '정비소', shopType: '정비소유형',
    kind: '구분', title: '제목', items: '내역', amount: '금액', note: '메모',
  };

  function recordsToCSV(recs) {
    const rows = [REC_COLS.map(c => COL_KO[c])];
    recs.forEach(r => rows.push(REC_COLS.map(c => (c === 'items' ? (r.items || []).join(' | ') : r[c]))));
    return rows.map(r => r.map(csvEsc).join(',')).join('\n');
  }

  function parseCSV(text) {
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; } else q = false;
        } else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = ''; rows.push(row); row = [];
      } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(x => x !== ''));
  }

  function normDate(s) {
    const m = String(s || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : null;
  }
  function toNum(s) {
    const t = String(s == null ? '' : s).replace(/[^\d.-]/g, '');
    return t === '' ? null : Number(t);
  }

  function csvToRecords(text) {
    const rows = parseCSV(text.replace(/^﻿/, ''));
    if (rows.length < 2) return [];
    const head = rows[0].map(h => h.trim());
    const idx = {};
    REC_COLS.forEach(c => {
      let i = head.indexOf(COL_KO[c]);
      if (i < 0) i = head.indexOf(c);
      idx[c] = i;
    });
    const out = [];
    rows.slice(1).forEach(r => {
      const g = c => (idx[c] >= 0 ? (r[idx[c]] || '').trim() : '');
      const date = normDate(g('date'));
      if (!date) return;
      const kind = ['repair', 'insurance', 'estimate'].includes(g('kind')) ? g('kind') : 'repair';
      out.push({
        id: g('id') || 'i' + out.length + '-' + date,
        date, km: toNum(g('km')), shop: g('shop'),
        shopType: g('shopType') === 'general' ? 'general' : 'honda',
        kind, title: g('title'),
        items: g('items') ? g('items').split(/\s*\|\s*/).filter(Boolean) : [],
        amount: toNum(g('amount')) || 0, note: g('note'),
      });
    });
    return out;
  }

  function mergeById(list, incoming) {
    const map = new Map(list.map(x => [x.id, x]));
    incoming.forEach(x => map.set(x.id, x));
    return Array.from(map.values());
  }

  const api = {
    DAY, pd, ymd, addMonths, daysBetween, calcPart, inspectionWindow,
    REC_COLS, COL_KO, recordsToCSV, parseCSV, csvToRecords, mergeById, normDate, toNum,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CivicLogic = api;
})(typeof window !== 'undefined' ? window : this);
