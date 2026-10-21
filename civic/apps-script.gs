const TABS = [
  { key: 'records', sheet: '정비이력', cols: [['id', 'id', 's'], ['date', '날짜', 's'], ['km', '주행거리', 'n'], ['shop', '정비소', 's'], ['shopType', '정비소유형', 's'], ['kind', '구분', 's'], ['title', '제목', 's'], ['items', '내역', 'l'], ['amount', '금액', 'n'], ['note', '메모', 's']] },
  { key: 'parts', sheet: '교체주기', cols: [['id', 'id', 's'], ['name', '항목', 's'], ['intervalKm', '주기(km)', 'n'], ['intervalMonths', '주기(개월)', 'n'], ['lastDate', '마지막 교체일', 's'], ['lastKm', '마지막 교체 주행거리', 'n'], ['note', '메모', 's']] },
  { key: 'inspections', sheet: '종합검사', cols: [['id', 'id', 's'], ['date', '검사일', 's'], ['km', '주행거리', 'n'], ['result', '결과', 's'], ['nextDate', '다음 검사일', 's'], ['note', '메모', 's']] },
  { key: 'issues', sheet: '이슈', cols: [['id', 'id', 's'], ['text', '내용', 's'], ['status', '상태', 's'], ['since', '발견일', 's'], ['doneDate', '완료일', 's']] },
  { key: 'policies', sheet: '자동차보험', cols: [['id', 'id', 's'], ['insurer', '보험사', 's'], ['start', '시작일', 's'], ['end', '만기일', 's'], ['premium', '보험료', 'n'], ['payMethod', '납입방법', 's'], ['coverage', '가입담보', 'l'], ['terms', '특별약관', 'l'], ['mileageStartKm', '마일리지 최초 주행거리', 'n'], ['mileageStartDate', '최초 주행거리 확인일', 's'], ['mileageLimitKm', '마일리지 약정 상한', 'n'], ['note', '메모', 's']] },
];
const SETTINGS = {
  sheet: '설정',
  rows: [['plate', '차량번호', 's'], ['model', '차종 표시', 's'], ['vin', '차대번호', 's'], ['currentKm', '현재 주행거리', 'n'], ['kmDate', '주행거리 기준일', 's'], ['area.name', '날씨 지역', 's'], ['area.lat', '날씨 위도', 'n'], ['area.lon', '날씨 경도', 'n']],
};
const CHOICES = { kind: ['repair', 'insurance', 'estimate'], shopType: ['honda', 'general'], status: ['open', 'done'] };
const MAX_ROWS = 3000;
const MAX_FAILS = 8;
const FAIL_WINDOW = 10 * 60 * 1000;
const MAX_TOKENS = 5;

function setup() {
  TABS.forEach(t => tabColumns(ensureSheet(t.sheet), t));
  const sh = ensureSheet(SETTINGS.sheet);
  if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, 2).setValues([['항목', '값']]);
  sh.getRange(1, 1, 1, 2).setFontWeight('bold');
  sh.setFrozenRows(1);
}

function revokeAll() {
  PropertiesService.getScriptProperties().deleteProperty('TOKENS');
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'get';
  if (action === 'get') return out(snapshot());
  return out({ ok: false, error: 'action' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return out({ ok: false, error: 'json' });
  }
  try {
    if (body.action === 'login') return out(login(body));
    if (body.action === 'check') return out(authed(body.token) ? { ok: true, sheetUrl: SpreadsheetApp.getActive().getUrl() } : { ok: false, error: 'auth' });
    if (body.action === 'logout') return out(logout(body.token));
    if (body.action === 'save') return out(save(body));
    return out({ ok: false, error: 'action' });
  } catch (err) {
    return out({ ok: false, error: 'server', message: String(err && err.message || err) });
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

function passwordFingerprint() {
  const pw = props().getProperty('PASSWORD');
  return pw ? sha('civic:' + pw) : '';
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

function login(body) {
  const pw = props().getProperty('PASSWORD');
  if (!pw) return { ok: false, error: 'no-password' };
  const now = Date.now();
  let fails = [];
  try {
    fails = (JSON.parse(props().getProperty('FAILS')) || []).filter(t => now - t < FAIL_WINDOW);
  } catch (err) {
    fails = [];
  }
  if (fails.length >= MAX_FAILS) return { ok: false, error: 'locked' };
  if (String(body.password || '') !== pw) {
    fails.push(now);
    props().setProperty('FAILS', JSON.stringify(fails));
    Utilities.sleep(1000);
    return { ok: false, error: 'password' };
  }
  props().deleteProperty('FAILS');
  const token = Utilities.getUuid() + Utilities.getUuid();
  const list = tokenList().filter(t => t.pw === passwordFingerprint());
  list.push({ h: sha(token), pw: passwordFingerprint(), t: now, n: String(body.label || '').slice(0, 60) });
  props().setProperty('TOKENS', JSON.stringify(list.slice(-MAX_TOKENS)));
  return { ok: true, token: token, sheetUrl: SpreadsheetApp.getActive().getUrl() };
}

function logout(token) {
  if (!token) return { ok: true };
  const h = sha(token);
  props().setProperty('TOKENS', JSON.stringify(tokenList().filter(t => t.h !== h)));
  return { ok: true };
}

function ensureSheet(name) {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function tabColumns(sh, t) {
  let last = sh.getLastColumn();
  let head = last > 0 ? sh.getRange(1, 1, 1, last).getValues()[0].map(String) : [];
  const pos = t.cols.map(c => {
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
  t.cols.forEach((c, i) => {
    const choice = CHOICES[c[0]];
    if (choice) {
      const rule = SpreadsheetApp.newDataValidation().requireValueInList(choice, true).setAllowInvalid(true).build();
      sh.getRange(2, pos[i], Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
    }
  });
  return pos;
}

function fmtDate(d) {
  return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd');
}

function cast(v, type) {
  if (type === 'n') {
    if (v === '' || v === null) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }
  if (v instanceof Date) return fmtDate(v);
  const s = v === null || v === undefined ? '' : String(v);
  if (type === 'l') return s.split('|').map(x => x.trim()).filter(Boolean);
  return s;
}

function toCell(v, type) {
  if (type === 'n') return v === null || v === undefined || v === '' ? '' : Number(v);
  if (type === 'l') return Array.isArray(v) ? v.join(' | ') : String(v || '');
  return v === null || v === undefined ? '' : String(v);
}

function readTab(t) {
  const sh = SpreadsheetApp.getActive().getSheetByName(t.sheet);
  if (!sh || sh.getLastRow() < 2) return [];
  const vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const head = vals[0].map(String);
  const idx = t.cols.map(c => head.indexOf(c[1]));
  const items = [];
  vals.slice(1).forEach(row => {
    if (row.every(v => v === '' || v === null)) return;
    const o = {};
    t.cols.forEach((c, i) => {
      const v = idx[i] < 0 ? '' : row[idx[i]];
      o[c[0]] = cast(v, c[2]);
    });
    if (!o.id) o.id = t.key + '-' + sha(JSON.stringify(row)).replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
    items.push(o);
  });
  return items;
}

function readSettings() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SETTINGS.sheet);
  const s = {};
  if (!sh || sh.getLastRow() < 2) return s;
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  SETTINGS.rows.forEach(r => {
    const row = vals.find(v => String(v[0]) === r[1]);
    if (!row || row[1] === '' || row[1] === null) return;
    const v = cast(row[1], r[2]);
    if (v === null) return;
    const path = r[0].split('.');
    if (path.length === 1) s[path[0]] = v;
    else {
      s[path[0]] = s[path[0]] || {};
      s[path[0]][path[1]] = v;
    }
  });
  return s;
}

function readAll() {
  const data = {};
  TABS.forEach(t => { data[t.key] = readTab(t); });
  data.settings = readSettings();
  return data;
}

function empty(data) {
  return TABS.every(t => !data[t.key].length) && !Object.keys(data.settings).length;
}

function revOf(data) {
  return sha(JSON.stringify(data));
}

function snapshot() {
  const data = readAll();
  return { ok: true, rev: revOf(data), empty: empty(data), data: data };
}

function writeTab(t, items) {
  const sh = ensureSheet(t.sheet);
  const pos = tabColumns(sh, t);
  const rows = Math.max(sh.getMaxRows() - 1, 1);
  t.cols.forEach((c, i) => {
    const r = sh.getRange(2, pos[i], rows, 1);
    r.clearContent();
    if (c[2] !== 'n') r.setNumberFormat('@');
  });
  if (!items.length) return;
  if (sh.getMaxRows() < items.length + 1) sh.insertRowsAfter(sh.getMaxRows(), items.length + 1 - sh.getMaxRows());
  t.cols.forEach((c, i) => {
    sh.getRange(2, pos[i], items.length, 1).setValues(items.map(it => [toCell(it[c[0]], c[2])]));
  });
}

function writeSettings(s) {
  const sh = ensureSheet(SETTINGS.sheet);
  sh.getRange(1, 1, 1, 2).setValues([['항목', '값']]);
  sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), 2).clearContent();
  const rows = SETTINGS.rows.map(r => {
    const path = r[0].split('.');
    const v = path.length === 1 ? s[path[0]] : (s[path[0]] || {})[path[1]];
    return [r[1], toCell(v, r[2])];
  });
  sh.getRange(2, 1, rows.length, 1).setNumberFormat('@');
  SETTINGS.rows.forEach((r, i) => { sh.getRange(i + 2, 2).setNumberFormat(r[2] === 'n' ? 'General' : '@'); });
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1, 1, 2).setFontWeight('bold');
  sh.setFrozenRows(1);
}

function save(body) {
  if (!authed(body.token)) return { ok: false, error: 'auth' };
  const changes = body.changes || {};
  const keys = TABS.map(t => t.key).concat('settings');
  for (const k of Object.keys(changes)) {
    if (keys.indexOf(k) < 0) return { ok: false, error: 'column' };
    if (k !== 'settings' && (!Array.isArray(changes[k]) || changes[k].length > MAX_ROWS)) return { ok: false, error: 'shape' };
    if (k !== 'settings' && changes[k].some(it => !it || typeof it.id !== 'string' || !it.id)) return { ok: false, error: 'id' };
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (revOf(readAll()) !== body.rev) return { ok: false, error: 'conflict' };
    TABS.forEach(t => { if (changes[t.key]) writeTab(t, changes[t.key]); });
    if (changes.settings) writeSettings(changes.settings);
    SpreadsheetApp.flush();
    const data = readAll();
    return { ok: true, rev: revOf(data) };
  } finally {
    lock.releaseLock();
  }
}
