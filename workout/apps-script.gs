const SHEET = '세션';
const COLS = [
  ['id', 'id', 's'],
  ['date', '날짜', 's'],
  ['session_type', '종류', 's'],
  ['started_at', '시작', 's'],
  ['duration_sec', '시간(초)', 'n'],
  ['exercises', '운동', 's'],
  ['updated_at', '갱신', 's'],
  ['json', '세션 JSON', 's'],
];
const DATA_SHEET = '데이터';
const DATA_COLS = [
  ['key', '키', 's'],
  ['updated_at', '갱신 시각', 's'],
  ['json', 'JSON', 's'],
];
const KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;
const MAX_KEYS = 200;
const MAX_DATA_BATCH = 20;
const MAX_FUTURE = 24 * 60 * 60 * 1000;
const MAX_ROWS = 5000;
const MAX_BATCH = 50;
const MAX_CELL = 45000;
const MAX_FAILS = 8;
const FAIL_WINDOW = 10 * 60 * 1000;
const MAX_TOKENS = 5;

function setup() {
  columns(ensureSheet());
  dataColumns(ensureDataSheet());
}

function revokeAll() {
  PropertiesService.getScriptProperties().deleteProperty('TOKENS');
}

function doGet() {
  return out({ ok: true });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return out({ ok: false, error: 'json' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return out({ ok: false, error: 'json' });
  try {
    if (body.action === 'login') return out(login(body));
    if (body.action === 'check') return out(authed(body.token) ? { ok: true } : { ok: false, error: 'auth' });
    if (body.action === 'logout') return out(logout(body.token));
    if (body.action === 'list') return out(list(body));
    if (body.action === 'upsert') return out(upsert(body));
    if (body.action === 'data_list') return out(dataList(body));
    if (body.action === 'data_put') return out(dataPut(body));
    return out({ ok: false, error: 'action' });
  } catch (err) {
    return out({ ok: false, error: 'server' });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sha(s) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s)));
}

function props() {
  return PropertiesService.getScriptProperties();
}

function password() {
  return String(props().getProperty('PASSWORD') || '').trim();
}

function passwordFingerprint() {
  const pw = password();
  return pw ? sha('workout:' + pw) : '';
}

function tokenList() {
  try {
    return JSON.parse(props().getProperty('TOKENS')) || [];
  } catch (err) {
    return [];
  }
}

function authed(token) {
  const fp = passwordFingerprint();
  if (!token || !fp) return false;
  const h = sha(token);
  return tokenList().some(t => t.h === h && t.pw === fp);
}

function locked(fn) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return { ok: false, error: 'busy' };
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function login(body) {
  return locked(() => loginLocked(body));
}

function loginLocked(body) {
  const pw = password();
  if (!pw) return { ok: false, error: 'no-password' };
  const now = Date.now();
  let fails = [];
  try {
    fails = (JSON.parse(props().getProperty('FAILS')) || []).filter(t => now - t < FAIL_WINDOW);
  } catch (err) {
    fails = [];
  }
  if (fails.length >= MAX_FAILS) return { ok: false, error: 'locked' };
  if (String(body.password || '').trim() !== pw) {
    fails.push(now);
    props().setProperty('FAILS', JSON.stringify(fails));
    Utilities.sleep(1000);
    return { ok: false, error: 'password' };
  }
  props().deleteProperty('FAILS');
  const token = Utilities.getUuid() + Utilities.getUuid();
  const fp = passwordFingerprint();
  const tokens = tokenList().filter(t => t.pw === fp);
  tokens.push({ h: sha(token), pw: fp, t: now, n: String(body.label || '').slice(0, 60) });
  props().setProperty('TOKENS', JSON.stringify(tokens.slice(-MAX_TOKENS)));
  return { ok: true, token: token };
}

function logout(token) {
  if (!token) return { ok: true };
  return locked(() => {
    const h = sha(token);
    props().setProperty('TOKENS', JSON.stringify(tokenList().filter(t => t.h !== h)));
    return { ok: true };
  });
}

function ensureSheet() {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
}

function ensureDataSheet() {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(DATA_SHEET) || ss.insertSheet(DATA_SHEET);
}

function dataColumns(sh) {
  return columns(sh, DATA_COLS);
}

function columns(sh, cols) {
  const defs = cols || COLS;
  const last = sh.getLastColumn();
  const head = last > 0 ? sh.getRange(1, 1, 1, last).getValues()[0].map(String) : [];
  const pos = defs.map(c => {
    let i = head.indexOf(c[1]);
    if (i < 0) {
      head.push(c[1]);
      i = head.length - 1;
      sh.getRange(1, i + 1).setValue(c[1]);
    }
    return i + 1;
  });
  sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
  sh.setFrozenRows(1);
  return pos;
}

function isDate(v) {
  return Object.prototype.toString.call(v) === '[object Date]';
}

function fmtDate(d) {
  return Utilities.formatDate(d, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
}

function text(v) {
  if (isDate(v)) return fmtDate(v);
  return v === null || v === undefined ? '' : String(v);
}

function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function check(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return 'shape';
  if (typeof s.id !== 'string' || !s.id || s.id.length > 100) return 'id';
  if (!validDate(s.date)) return 'date';
  if (typeof s.session_type !== 'string' || !s.session_type || s.session_type.length > 40) return 'type';
  if (!Array.isArray(s.exercises)) return 'exercises';
  if (JSON.stringify(s).length > MAX_CELL) return 'too-large';
  return '';
}

function rowOf(s, now) {
  return {
    id: s.id,
    date: s.date,
    session_type: s.session_type,
    started_at: typeof s.started_at === 'string' ? s.started_at : '',
    duration_sec: typeof s.duration_sec === 'number' && isFinite(s.duration_sec) ? s.duration_sec : '',
    exercises: s.exercises.map(e => (e && e.exercise_id) || '').filter(Boolean).join(' | '),
    updated_at: now,
    json: JSON.stringify(s),
  };
}

function list(body) {
  if (!authed(body.token)) return { ok: false, error: 'auth' };
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET);
  if (!sh || sh.getLastRow() < 2) return { ok: true, sessions: [], bad: 0 };
  const vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const head = vals[0].map(String);
  const ji = head.indexOf('세션 JSON');
  const ii = head.indexOf('id');
  if (ji < 0 || ii < 0) return { ok: false, error: 'sheet' };
  const sessions = [];
  const seen = {};
  let bad = 0;
  vals.slice(1).forEach(row => {
    if (row.every(v => v === '' || v === null)) return;
    let o = null;
    try {
      o = JSON.parse(text(row[ji]));
    } catch (err) {
      o = null;
    }
    if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !o.id || seen[o.id]) {
      bad++;
      return;
    }
    seen[o.id] = true;
    sessions.push(o);
  });
  return { ok: true, sessions: sessions, bad: bad };
}

function upsert(body) {
  if (!authed(body.token)) return { ok: false, error: 'auth' };
  const items = body.sessions;
  if (!Array.isArray(items) || !items.length || items.length > MAX_BATCH) return { ok: false, error: 'shape' };
  const rejected = [];
  const latest = {};
  items.forEach((s, i) => {
    const why = check(s);
    if (why) {
      rejected.push({ id: s && typeof s.id === 'string' ? s.id : '', index: i, error: why });
      return;
    }
    latest[s.id] = s;
  });
  const valid = Object.keys(latest).map(id => latest[id]);
  if (!valid.length) return { ok: true, saved: [], rejected: rejected };
  return locked(() => {
    const sh = ensureSheet();
    const pos = columns(sh);
    const width = sh.getLastColumn();
    const last = sh.getLastRow();
    const rows = {};
    if (last >= 2) {
      sh.getRange(2, pos[0], last - 1, 1).getValues().forEach((r, i) => {
        const id = text(r[0]);
        if (id && !rows[id]) rows[id] = i + 2;
      });
    }
    const now = new Date().toISOString();
    const fresh = valid.filter(s => !rows[s.id]);
    if (last - 1 + fresh.length > MAX_ROWS) {
      return { ok: true, saved: [], rejected: rejected.concat(valid.map(s => ({ id: s.id, index: -1, error: 'full' }))) };
    }
    const cells = (o) => {
      const cur = [];
      for (let i = 0; i < width; i++) cur.push('');
      COLS.forEach((c, i) => { cur[pos[i] - 1] = o[c[0]]; });
      return cur;
    };
    valid.filter(s => rows[s.id]).forEach(s => {
      const range = sh.getRange(rows[s.id], 1, 1, width);
      const cur = range.getValues()[0];
      const o = rowOf(s, now);
      COLS.forEach((c, i) => { cur[pos[i] - 1] = o[c[0]]; });
      range.setValues([cur]);
    });
    if (fresh.length) {
      const start = Math.max(last, 1) + 1;
      if (sh.getMaxRows() < start + fresh.length - 1) sh.insertRowsAfter(sh.getMaxRows(), start + fresh.length - 1 - sh.getMaxRows());
      COLS.forEach((c, i) => {
        if (c[2] !== 'n') sh.getRange(start, pos[i], fresh.length, 1).setNumberFormat('@');
      });
      sh.getRange(start, 1, fresh.length, width).setValues(fresh.map(s => cells(rowOf(s, now))));
    }
    SpreadsheetApp.flush();
    return { ok: true, saved: valid.map(s => s.id), rejected: rejected };
  });
}

function validTime(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(s)) return false;
  const t = new Date(s).getTime();
  return !isNaN(t) && t <= Date.now() + MAX_FUTURE;
}

function checkEntry(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return 'shape';
  if (typeof e.key !== 'string' || !KEY_PATTERN.test(e.key)) return 'key';
  if (!validTime(e.updated_at)) return 'time';
  if (e.value === undefined) return 'value';
  const j = JSON.stringify(e.value);
  if (j === undefined || j.length > MAX_CELL) return 'too-large';
  return '';
}

function readData() {
  const sh = SpreadsheetApp.getActive().getSheetByName(DATA_SHEET);
  if (!sh || sh.getLastRow() < 2) return { items: [], bad: 0 };
  const vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const head = vals[0].map(String);
  const ki = head.indexOf('키');
  const ti = head.indexOf('갱신 시각');
  const ji = head.indexOf('JSON');
  if (ki < 0 || ti < 0 || ji < 0) return null;
  const items = [];
  const seen = {};
  let bad = 0;
  vals.slice(1).forEach((row, i) => {
    if (row.every(v => v === '' || v === null)) return;
    const key = text(row[ki]);
    let value;
    try {
      value = JSON.parse(text(row[ji]));
    } catch (err) {
      value = undefined;
    }
    if (!KEY_PATTERN.test(key) || seen[key] || value === undefined) {
      bad++;
      return;
    }
    seen[key] = true;
    items.push({ key: key, updated_at: text(row[ti]), value: value, row: i + 2 });
  });
  return { items: items, bad: bad };
}

function dataList(body) {
  if (!authed(body.token)) return { ok: false, error: 'auth' };
  const d = readData();
  if (!d) return { ok: false, error: 'sheet' };
  return { ok: true, now: new Date().toISOString(), items: d.items.map(i => ({ key: i.key, updated_at: i.updated_at, value: i.value })), bad: d.bad };
}

function dataPut(body) {
  if (!authed(body.token)) return { ok: false, error: 'auth' };
  const items = body.items;
  if (!Array.isArray(items) || !items.length || items.length > MAX_DATA_BATCH) return { ok: false, error: 'shape' };
  const rejected = [];
  const latest = {};
  items.forEach((e, i) => {
    const why = checkEntry(e);
    if (why) {
      rejected.push({ key: e && typeof e.key === 'string' ? e.key : '', index: i, error: why });
      return;
    }
    const n = { key: e.key, updated_at: new Date(e.updated_at).toISOString(), value: e.value };
    if (!latest[n.key] || latest[n.key].updated_at <= n.updated_at) latest[n.key] = n;
  });
  const valid = Object.keys(latest).map(k => latest[k]);
  if (!valid.length) return { ok: true, now: new Date().toISOString(), saved: [], stale: [], rejected: rejected };
  return locked(() => {
    const sh = ensureDataSheet();
    const pos = dataColumns(sh);
    const width = sh.getLastColumn();
    const cur = readData();
    if (!cur) return { ok: false, error: 'sheet' };
    const byKey = {};
    cur.items.forEach(i => { byKey[i.key] = i; });
    const saved = [];
    const stale = [];
    const fresh = [];
    const cells = (e) => {
      const row = [];
      for (let i = 0; i < width; i++) row.push('');
      row[pos[0] - 1] = e.key;
      row[pos[1] - 1] = e.updated_at;
      row[pos[2] - 1] = JSON.stringify(e.value);
      return row;
    };
    valid.forEach(e => {
      const old = byKey[e.key];
      if (old && old.updated_at > e.updated_at) {
        stale.push({ key: old.key, updated_at: old.updated_at, value: old.value });
        return;
      }
      if (old) {
        sh.getRange(old.row, 1, 1, width).setValues([cells(e)]);
        saved.push(e.key);
        return;
      }
      fresh.push(e);
    });
    if (cur.items.length + fresh.length > MAX_KEYS) {
      fresh.forEach(e => rejected.push({ key: e.key, index: -1, error: 'full' }));
    } else if (fresh.length) {
      const start = Math.max(sh.getLastRow(), 1) + 1;
      if (sh.getMaxRows() < start + fresh.length - 1) sh.insertRowsAfter(sh.getMaxRows(), start + fresh.length - 1 - sh.getMaxRows());
      DATA_COLS.forEach((c, i) => { sh.getRange(start, pos[i], fresh.length, 1).setNumberFormat('@'); });
      sh.getRange(start, 1, fresh.length, width).setValues(fresh.map(cells));
      fresh.forEach(e => saved.push(e.key));
    }
    SpreadsheetApp.flush();
    return { ok: true, now: new Date().toISOString(), saved: saved, stale: stale, rejected: rejected };
  });
}
