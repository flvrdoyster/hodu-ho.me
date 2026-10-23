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

  const TIP = {
    winter: ['겨울', '워셔액·배터리', '영하에서는 겨울용 워셔액인지, 아침 시동이 약하지 않은지 봐요.'],
    fog: ['겨울', '김서림', '에어컨을 켜고 외기 유입으로 두면 유리 김이 빨리 걷혀요.'],
    tax: ['기한', '자동차세 연납 신청', '1월에 신청하면 할인이 가장 커요.'],
    salt: ['봄', '하부 세차', '겨울 동안 묻은 염화칼슘을 씻어 내요. 오래된 차일수록 부식이 빨라요.'],
    dust: ['봄', '황사·미세먼지', '먼지가 심한 날은 내기 순환으로 달리고, 맑은 날 환기해요.'],
    washer: ['봄', '워셔액 바꾸기', '꽃가루·송진 철이에요. 겨울용 워셔액을 사계절용으로 바꾸고 유리를 자주 닦아요.'],
    aircon: ['여름 준비', '에어컨 작동 확인', '더워지기 전에 찬바람이 제대로 나오는지 봐요. 2023년에 컴프레서 클러치를 고쳤어요.'],
    wiper: ['장마', '와이퍼·타이어 홈', '장마 전에 와이퍼가 줄무늬 없이 닦이는지, 타이어 홈이 충분한지 봐요.'],
    smell: ['장마', '에어컨 냄새 막기', '도착 몇 분 전에 에어컨을 끄고 송풍으로 말리면 에바 곰팡이 냄새가 덜해요.'],
    flood: ['장마', '침수 피하기', '물이 바퀴 절반 넘게 찬 길은 들어가지 않아요. 큰비 예보 때는 지하·하천변 주차를 피해요.'],
    heat: ['여름', '과열 주의', '막히는 길에서 수온계가 평소보다 오르면 에어컨을 끄고 안전한 곳에 세워요. 냉각수 수위도 봐요.'],
    cabin: ['여름', '실내 고온', '라이터·스프레이·보조배터리는 차에 두지 않고, 주차할 때 햇빛가리개를 써요.'],
    tire: ['여름', '타이어 공기압', '고속도로 타기 전 식은 상태에서 맞춰요. 공기압이 모자라면 뜨거운 노면에서 타이어가 상하기 쉬워요.'],
    dashcam: ['여름', '블랙박스 발열', '한낮 주차 중에는 블랙박스가 꺼지거나 녹화가 끊기기 쉬워요. 가끔 영상이 남았는지 봐요.'],
    typhoon: ['태풍', '주차 위치', '태풍 예보 때는 간판·가로수 아래와 저지대를 피해 세워요.'],
    sdcard: ['가을', '블랙박스 녹화 확인', '메모리카드는 1~2년이면 수명이 다해요. 최근 영상이 남는지 봐요.'],
    prep: ['겨울 준비', '배터리·워셔액·냉각수', '추워지기 전에 배터리 상태, 겨울용 워셔액, 냉각수 양을 챙겨요.'],
    leaves: ['가을', '낙엽 배수구', '앞유리 아래 카울 배수구에 낙엽이 쌓이면 실내로 물이 샐 수 있어요. 오래된 차에서 흔해요.'],
    lamp: ['가을', '전조등 점검', '해가 짧아져요. 전구가 나간 곳은 없는지, 렌즈가 누렇게 바래 어둡지 않은지 봐요.'],
  };
  const SEASON = {
    1: ['winter', 'fog', 'tax'], 2: ['winter', 'fog'], 3: ['salt', 'dust'], 4: ['dust', 'washer'],
    5: ['aircon', 'dust'], 6: ['wiper', 'smell', 'flood'], 7: ['heat', 'cabin', 'smell', 'flood'],
    8: ['heat', 'tire', 'dashcam', 'typhoon'], 9: ['sdcard', 'typhoon'], 10: ['prep', 'leaves', 'lamp'],
    11: ['prep', 'leaves'], 12: ['winter', 'fog'],
  };
  const HOLIDAYS = [['2027-02-07', '설'], ['2027-09-15', '추석'], ['2028-01-27', '설']];

  function weatherTips(days) {
    const out = [];
    if (!days || !days.length) return out;
    const md = s => Number(s.slice(5, 7)) + '/' + Number(s.slice(8, 10));
    const most = (k, sign) => days.reduce((a, b) => (sign * (b[k] - a[k]) > 0 ? b : a));
    const snow = days.find(x => x.snow > 0), cold = most('tmin', -1), wet = most('rain', 1), hot = most('tmax', 1);
    let d;
    if ((d = snow)) out.push({ lv: 'over', tag: '날씨', t: md(d.date) + ' 눈 예보', d: '전날 밤 와이퍼를 세워 두고, 아침에 유리 성에를 다 녹인 뒤 출발해요.' });
    d = cold;
    if (d.tmin <= -5) out.push({ lv: 'over', tag: '날씨', t: md(d.date) + ' 최저 ' + Math.round(d.tmin) + '°', d: '혹한에는 배터리가 약해져요. 시동이 무거우면 바로 점검받아요.' });
    else if (d.tmin <= 0) out.push({ lv: 'soon', tag: '날씨', t: md(d.date) + ' 영하 예보', d: '워셔액이 얼 수 있어요. 겨울용인지 확인해요.' });
    else if (d.tmin <= 5) out.push({ lv: 'ok', tag: '날씨', t: md(d.date) + ' 최저 ' + Math.round(d.tmin) + '°', d: '기온이 내려가면 타이어 공기압도 떨어져요. 아침에 한 번 봐요.' });
    if ((d = wet).rain >= 20) out.push({ lv: 'soon', tag: '날씨', t: md(d.date) + ' 비 ' + Math.round(d.rain) + 'mm', d: '와이퍼가 깨끗이 닦이는지 보고, 물이 고인 길은 피해요.' });
    if ((d = hot).tmax >= 33) out.push({ lv: 'soon', tag: '날씨', t: md(d.date) + ' 최고 ' + Math.round(d.tmax) + '°', d: '실내가 매우 뜨거워져요. 냉각수 수위를 보고 인화성 물건은 빼 둬요.' });
    return out;
  }

  function careTips(o) {
    const out = [], today = o.today;
    const add = (lv, tag, t, d) => out.push({ lv, tag, t, d });
    if (o.kmDate) {
      const ago = daysBetween(pd(o.kmDate), today);
      if (ago > 30) add('soon', '기록', '주행거리 갱신', `기준일이 ${ago}일 전이에요. 주행거리로 계산하는 교체 시기와 보험 마일리지가 실제보다 여유 있게 보여요.`);
    }
    if (o.policyEnd) {
      const dd = daysBetween(today, pd(o.policyEnd));
      if (dd >= 0 && dd <= 45) add('soon', '기한', '보험 갱신 준비', `만기 D-${dd}. 마일리지 정산용 계기판 사진을 등록하고 갱신 견적을 비교해요.`);
    }
    if (o.inspNext) {
      const w = inspectionWindow(o.inspNext), t = ymd(today);
      if (t >= w.start && t <= w.end) add('over', '기한', '종합검사 기간', `${w.start} ~ ${w.end} 안에 검사를 받아요.`);
      else if (t < w.start && daysBetween(today, pd(w.start)) <= 180 && o.inspAdvice) add('soon', '기한', '검사 전 정비', o.inspAdvice);
    }
    weatherTips(o.weather).forEach(x => out.push(x));
    HOLIDAYS.forEach(([date, name]) => {
      const dd = daysBetween(today, pd(date));
      if (dd >= 0 && dd <= 14) add('soon', '명절', `${name} 장거리 전 점검 (D-${dd})`, '출발 전에 타이어 공기압·엔진오일·냉각수·와이퍼를 보고, 세워 둔 자리 바닥에 오일 자국이 없는지 봐요.');
    });
    (SEASON[today.getUTCMonth() + 1] || []).forEach(k => add('ok', TIP[k][0], TIP[k][1], TIP[k][2]));
    if (o.routine) add('ok', '매달', '엔진오일 양·타이어 공기압', o.routine);
    return out;
  }

  const FUEL_WIN = 1000, FUEL_MIN = 1000;
  function fuelStats(list) {
    const rows = list.filter(f => f.km > 0 && f.liters > 0).sort((a, b) => a.km - b.km || (a.date || '').localeCompare(b.date || ''));
    const cum = [0];
    rows.forEach((f, i) => cum.push(cum[i] + f.liters));
    const used = (i, j) => cum[j + 1] - cum[i] - (rows[i].liters + rows[j].liters) / 2;
    const eco = {};
    let recent = null, recentDist = null;
    for (let j = 1; j < rows.length; j++) {
      let i = j - 1;
      while (i >= 0 && rows[j].km - rows[i].km < FUEL_WIN) i--;
      if (i < 0) continue;
      recentDist = rows[j].km - rows[i].km;
      recent = recentDist / used(i, j);
      eco[rows[j].id] = recent;
    }
    const n = rows.length, dist = n > 1 ? rows[n - 1].km - rows[0].km : 0;
    const priced = list.filter(f => f.amount > 0 && f.liters > 0);
    const money = priced.reduce((a, f) => a + f.amount, 0), liters = priced.reduce((a, f) => a + f.liters, 0);
    return {
      eco, recent, recentDist, dist,
      avg: dist >= FUEL_MIN ? dist / used(0, n - 1) : null,
      avgPrice: liters > 0 ? money / liters : null,
    };
  }

  function stationChoices(fuel, favorites) {
    const m = new Map();
    fuel.forEach(f => {
      const n = String(f.station || '').trim();
      if (!n) return;
      const e = m.get(n) || { n, c: 0, last: '', fav: false };
      e.c++;
      if ((f.date || '') > e.last) e.last = f.date || '';
      m.set(n, e);
    });
    (favorites || []).forEach(s => {
      const n = String(s || '').trim();
      if (!n) return;
      if (!m.has(n)) m.set(n, { n, c: 0, last: '', fav: true });
      else m.get(n).fav = true;
    });
    return [...m.values()].filter(e => e.c >= 2 || e.fav)
      .sort((a, b) => b.c - a.c || b.last.localeCompare(a.last) || a.n.localeCompare(b.n, 'ko'))
      .map(e => e.n);
  }

  const api = {
    DAY, pd, ymd, addMonths, daysBetween, calcPart, inspectionWindow, careTips, weatherTips, fuelStats, FUEL_WIN, FUEL_MIN, stationChoices,
    REC_COLS, COL_KO, recordsToCSV, parseCSV, csvToRecords, mergeById, normDate, toNum,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CivicLogic = api;
})(typeof window !== 'undefined' ? window : this);
