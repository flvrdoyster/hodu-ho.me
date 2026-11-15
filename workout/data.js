(function (root) {
  const VERSION = 3;
  const KG_PER_LB = 0.45359237;
  const LEGACY_LB = ['reverse_pec_deck', 'leg_curl', 'leg_extension'];
  const FEELS = ['light', 'ok', 'heavy'];
  const round2 = (x) => Math.round(x * 100) / 100;
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const isStr = (v) => typeof v === 'string' && v.trim() !== '';
  const lbToKg = (w) => (isNum(w) ? round2(w * KG_PER_LB) : w);
  const newId = () => Math.random().toString(36).slice(2, 9);

  function defaultSettings() {
    return { bodyweight_kg: null, sound: true, haptic: true, target_sec: 2100, weight_unit: 'kg' };
  }

  function emptyStore() {
    return { version: VERSION, sessions: [], draft: null, settings: defaultSettings(), increments: {} };
  }

  function sessionOrder(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const sa = a.started_at || '';
    const sb = b.started_at || '';
    if (sa !== sb) return sa < sb ? -1 : 1;
    const ia = a.id || '';
    const ib = b.id || '';
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  }

  function migrateSet(s, lb) {
    if (!isObj(s)) return s;
    const o = Object.assign({}, s);
    if ('weight' in o) {
      const w = o.weight;
      delete o.weight;
      if (isNum(w)) o.weight_kg = lb ? lbToKg(w) : w;
      else if (typeof w === 'string' && w.trim() !== '' && isFinite(Number(w))) o.weight_kg = lb ? lbToKg(Number(w)) : Number(w);
    }
    if ('duration_min' in o) {
      if (isNum(o.duration_min)) o.duration_sec = Math.round(o.duration_min * 60);
      delete o.duration_min;
    }
    delete o.set_number;
    delete o.input_mode;
    if (o.feel == null) delete o.feel;
    if (o.note == null || o.note === '') delete o.note;
    return o;
  }

  function hasLbWeights(e) {
    return (e.sets || []).some((x) => isObj(x) && isNum(x.weight));
  }

  function migrateExercise(e) {
    if (!isObj(e)) return e;
    const o = Object.assign({}, e);
    const legacyId = o.exercise_type;
    const lb = o.unit === 'lb' || (o.unit == null && 'exercise_type' in o && LEGACY_LB.indexOf(legacyId) >= 0 && hasLbWeights(o));
    if (!o.exercise_id && legacyId) o.exercise_id = legacyId;
    delete o.exercise_type;
    let sets = Array.isArray(o.sets) ? o.sets.map((s) => migrateSet(s, lb)) : null;
    if (!sets) sets = isNum(o.duration_min) ? [{ duration_sec: Math.round(o.duration_min * 60) }] : [];
    o.sets = sets;
    ['order', 'equipment', 'equipment_id', 'unit', 'weight_basis', 'weight_kg_approx', 'duration_min'].forEach((k) => { delete o[k]; });
    if (o.note == null || o.note === '') delete o.note;
    return o;
  }

  function takeNextTargets(o) {
    const nt = o.next_targets;
    if (!isObj(nt)) return;
    const rest = Object.assign({}, nt);
    const exercises = Array.isArray(o.exercises) ? o.exercises : [];
    exercises.forEach((e) => {
      if (isObj(e) && typeof rest[e.exercise_id] === 'string' && rest[e.exercise_id] !== '' && !e.next_note) {
        e.next_note = rest[e.exercise_id];
        delete rest[e.exercise_id];
      }
    });
    const lines = [];
    if (typeof rest.watch === 'string' && rest.watch !== '') lines.push(rest.watch);
    if (Array.isArray(rest.add_next_time) && rest.add_next_time.length) lines.push('다음에 추가: ' + rest.add_next_time.join(', '));
    if (lines.length && !o.watch_note) o.watch_note = lines.join('\n');
    delete rest.watch;
    delete rest.add_next_time;
    if (Object.keys(rest).length) o.next_targets = rest; else delete o.next_targets;
  }

  function migrateSession(s, ctx) {
    if (!isObj(s)) return s;
    const o = Object.assign({}, s);
    if (Array.isArray(o.exercises)) o.exercises = o.exercises.map(migrateExercise);
    takeNextTargets(o);
    if ('duration_min' in o) {
      if (isNum(o.duration_min) && !isNum(o.duration_sec)) o.duration_sec = Math.round(o.duration_min * 60);
      delete o.duration_min;
    }
    if (o.bodyweight_kg == null) delete o.bodyweight_kg;
    if (o.notes == null || o.notes === '') delete o.notes;
    if (!isStr(o.id) && isStr(o.date) && isStr(o.session_type)) {
      const base = 'legacy:' + o.date + ':' + o.session_type;
      const n = ((ctx && ctx.seen) ? (ctx.seen[base] = (ctx.seen[base] || 0) + 1) : 1);
      o.id = n > 1 ? base + ':' + n : base;
    }
    return o;
  }

  function migrateSessions(list) {
    const ctx = { seen: {} };
    return (Array.isArray(list) ? list : []).map((s) => migrateSession(s, ctx));
  }

  function migrateItem(it, lbDraft) {
    if (!isObj(it)) return it;
    const o = Object.assign({}, it);
    const legacyId = o.exercise_type;
    if (!o.exercise_id && legacyId) o.exercise_id = legacyId;
    delete o.exercise_type;
    const lb = lbDraft && LEGACY_LB.indexOf(o.exercise_id) >= 0;
    const t = isObj(o.target) ? Object.assign({}, o.target) : {};
    const timed = o.duration_min != null || t.duration != null || t.duration_sec != null;
    if (timed) {
      const m = o.duration_min != null ? o.duration_min : t.duration;
      if (isNum(m)) t.duration_sec = Math.round(m * 60);
      delete t.weight;
      delete t.weight_kg;
      if (t.reps == null) delete t.reps;
    } else if ('cur_weight' in o || 'weight' in t) {
      const w = 'cur_weight' in o ? o.cur_weight : t.weight;
      t.weight_kg = isNum(w) ? (lb ? lbToKg(w) : w) : null;
    }
    delete t.weight;
    delete t.duration;
    delete t.rest_sec;
    o.target = t;
    ['cur_weight', 'duration_min', 'reason', 'exploring'].forEach((k) => { delete o[k]; });
    o.sets = Array.isArray(o.sets) ? o.sets.map((s) => migrateSet(s, lb)) : [];
    if (o.note == null || o.note === '') delete o.note;
    if (o.pre === '') delete o.pre;
    return o;
  }

  function migrateDraft(d, lbDraft) {
    if (!isObj(d)) return null;
    const o = Object.assign({}, d);
    if ('target_min' in o) {
      if (isNum(o.target_min) && !isNum(o.target_sec)) o.target_sec = Math.round(o.target_min * 60);
      delete o.target_min;
    }
    if (!isStr(o.id)) o.id = newId();
    if (o.bodyweight_kg == null) delete o.bodyweight_kg;
    if (o.notes == null || o.notes === '') delete o.notes;
    o.items = Array.isArray(o.items) ? o.items.map((it) => migrateItem(it, lbDraft)) : [];
    return o;
  }

  function migrateSettings(st) {
    const o = Object.assign(defaultSettings(), isObj(st) ? st : {});
    if ('target_min' in o) {
      if (isNum(o.target_min) && !(isObj(st) && isNum(st.target_sec))) o.target_sec = Math.round(o.target_min * 60);
      delete o.target_min;
    }
    return o;
  }

  function cleanSettings(st) {
    const out = {};
    if (!isObj(st)) return out;
    if (typeof st.sound === 'boolean') out.sound = st.sound;
    if (typeof st.haptic === 'boolean') out.haptic = st.haptic;
    if (st.weight_unit === 'kg' || st.weight_unit === 'lbs') out.weight_unit = st.weight_unit;
    const sec = isNum(st.target_sec) ? st.target_sec : (isNum(st.target_min) ? st.target_min * 60 : null);
    if (sec != null && sec >= 600 && sec <= 7200) out.target_sec = Math.round(sec);
    if (isNum(st.bodyweight_kg) && st.bodyweight_kg >= 20 && st.bodyweight_kg <= 300) out.bodyweight_kg = st.bodyweight_kg;
    return out;
  }

  function cleanIncrements(raw, catalog) {
    const out = {};
    if (!isObj(raw)) return out;
    Object.keys(raw).forEach((id) => {
      const b = catalog && catalog.get(id);
      const v = raw[id];
      if (!b || b.load === 'none' || !isNum(v) || !(v > 0) || v > 100) return;
      if (Math.abs(v - b.increment) < 0.005) return;
      out[id] = v;
    });
    return out;
  }

  function migratePrefs(prefs, kgPrefs, catalog) {
    const inc = {};
    if (!isObj(prefs)) return inc;
    Object.keys(prefs).forEach((id) => {
      const p = prefs[id];
      if (!isObj(p) || !isNum(p.increment) || p.increment === 0) return;
      const lb = !kgPrefs && (p.unit === 'lb' || (p.unit == null && LEGACY_LB.indexOf(id) >= 0));
      inc[id] = round2(Math.abs(lb ? lbToKg(p.increment) : p.increment));
    });
    return cleanIncrements(inc, catalog);
  }

  function migrateStore(raw, catalog) {
    const src = isObj(raw) ? raw : {};
    if (src.version === VERSION) {
      return Object.assign({}, src, {
        sessions: Array.isArray(src.sessions) ? src.sessions : [],
        draft: isObj(src.draft) ? src.draft : null,
        settings: Object.assign(defaultSettings(), isObj(src.settings) ? src.settings : {}),
        increments: isObj(src.increments) ? src.increments : {},
      });
    }
    const kgStore = src.kg_v === 2 || src.version === 2;
    const out = Object.assign({}, src);
    delete out.kg_v;
    delete out.prefs;
    out.version = VERSION;
    out.sessions = migrateSessions(src.sessions);
    out.draft = src.draft ? migrateDraft(src.draft, !kgStore) : null;
    out.settings = migrateSettings(src.settings);
    out.increments = Object.assign(migratePrefs(src.prefs, kgStore, catalog), cleanIncrements(src.increments, catalog));
    return out;
  }

  function validDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }

  function validIso(s, now) {
    if (typeof s !== 'string') return false;
    const t = Date.parse(s);
    return isFinite(t) && t <= now + 86400000;
  }

  function numOf(v) {
    if (isNum(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && isFinite(Number(v))) return Number(v);
    return null;
  }

  function checkSet(s, def, opt) {
    if (!isObj(s)) return null;
    const o = Object.assign({}, s);
    const strict = !opt.lenient;
    const w = 'weight_kg' in o ? numOf(o.weight_kg) : null;
    const r = 'reps' in o ? numOf(o.reps) : null;
    const d = 'duration_sec' in o ? numOf(o.duration_sec) : null;
    if ('weight_kg' in o) {
      if (w == null || (strict && (w < 0 || w > 1000))) return null;
      o.weight_kg = w;
    }
    if ('reps' in o) {
      if (r == null || (strict && (!Number.isInteger(r) || r < 1 || r > 200))) return null;
      o.reps = r;
    }
    if ('duration_sec' in o) {
      if (d == null || (strict && (!Number.isInteger(d) || d < 1 || d > 14400))) return null;
      o.duration_sec = d;
    }
    if (def) {
      if (def.load !== 'none' && w == null) return null;
      if (def.measure === 'reps' && r == null) return null;
      if (def.measure === 'seconds' && d == null) return null;
    } else if (r == null && d == null) return null;
    if ('is_warmup' in o && typeof o.is_warmup !== 'boolean') o.is_warmup = !!o.is_warmup;
    if ('feel' in o && FEELS.indexOf(o.feel) < 0) delete o.feel;
    if ('note' in o && (typeof o.note !== 'string' || o.note === '')) delete o.note;
    if ('at' in o && !validIso(o.at, opt.now)) delete o.at;
    return o;
  }

  function checkSession(s, catalog, opt) {
    const o0 = opt || {};
    const o = { now: o0.now || Date.now(), lenient: !!o0.lenient };
    if (!isObj(s)) return { reason: '세션 모양이 아님' };
    if (!validDate(s.date)) return { reason: '날짜 오류' };
    if (!isStr(s.session_type)) return { reason: '세션 종류 없음' };
    if (!isStr(s.id)) return { reason: 'id 없음' };
    if (!Array.isArray(s.exercises)) return { reason: '운동 목록 없음' };
    const out = Object.assign({}, s);
    const unknown = [];
    const exercises = [];
    s.exercises.forEach((e) => {
      if (!isObj(e) || !isStr(e.exercise_id) || !Array.isArray(e.sets)) return;
      const def = catalog && catalog.get(e.exercise_id);
      if (!def && unknown.indexOf(e.exercise_id) < 0) unknown.push(e.exercise_id);
      const sets = e.sets.map((x) => checkSet(x, def, o)).filter(Boolean);
      if (!sets.length) return;
      const ex = Object.assign({}, e, { sets });
      ['note', 'next_note'].forEach((k) => { if (k in ex && (typeof ex[k] !== 'string' || ex[k] === '')) delete ex[k]; });
      exercises.push(ex);
    });
    if (!exercises.length) return { reason: '유효한 운동 없음' };
    out.exercises = exercises;
    if ('started_at' in out && !validIso(out.started_at, o.now)) delete out.started_at;
    if ('duration_sec' in out) {
      const d = numOf(out.duration_sec);
      if (d == null || d <= 0) delete out.duration_sec; else out.duration_sec = d;
    }
    if ('bodyweight_kg' in out) {
      const b = numOf(out.bodyweight_kg);
      if (b == null || b < 20 || b > 300) delete out.bodyweight_kg; else out.bodyweight_kg = b;
    }
    ['notes', 'watch_note'].forEach((k) => { if (k in out && (typeof out[k] !== 'string' || out[k] === '')) delete out[k]; });
    return { session: out, unknown };
  }

  function checkList(list, catalog, opt) {
    const good = [];
    const bad = [];
    const unknown = [];
    (Array.isArray(list) ? list : []).forEach((s, i) => {
      const r = checkSession(s, catalog, opt);
      if (!r.session) { bad.push({ index: i, reason: r.reason, raw: s }); return; }
      r.unknown.forEach((id) => { if (unknown.indexOf(id) < 0) unknown.push(id); });
      good.push(r.session);
    });
    return { good, bad, unknown };
  }

  function firstAt(s) {
    let t = '';
    (s.exercises || []).forEach((e) => (e.sets || []).forEach((x) => { if (x.at && (!t || x.at < t)) t = x.at; }));
    return t;
  }

  function shape(s) {
    return (s.exercises || []).map((e) => e.exercise_id + ':' + (e.sets || []).length).join(',');
  }

  function sameSession(a, b) {
    if (a.id === b.id) return true;
    if (a.date !== b.date || a.session_type !== b.session_type) return false;
    const fa = firstAt(a);
    const fb = firstAt(b);
    if (fa && fb) return fa === fb;
    if (a.started_at && b.started_at) return a.started_at === b.started_at;
    return shape(a) === shape(b);
  }

  function addMissing(existing, incoming) {
    const sessions = existing.slice();
    let added = 0;
    incoming.forEach((s) => {
      if (sessions.some((x) => sameSession(x, s))) return;
      sessions.push(s);
      added++;
    });
    return { sessions: sessions.sort(sessionOrder), added };
  }

  function parseImport(data, catalog, opt) {
    let list = null;
    let version = 1;
    let settings = null;
    let increments = {};
    if (Array.isArray(data)) list = data;
    else if (isObj(data) && Array.isArray(data.sessions)) {
      list = data.sessions;
      if (data.version != null) version = data.version;
      if (data.version != null && !(Number.isInteger(data.version) && data.version >= 1)) return { error: '버전을 알 수 없는 파일이에요' };
      if (version > VERSION) return { error: '더 새 버전의 파일이에요' };
      settings = isObj(data.settings) ? cleanSettings(data.settings) : null;
      const kgPrefs = version >= 2;
      increments = Object.assign(migratePrefs(data.prefs, kgPrefs, catalog), cleanIncrements(data.increments, catalog));
    } else if (isObj(data) && isStr(data.date) && Array.isArray(data.exercises)) list = [data];
    else return { error: '가져올 수 있는 형식이 아니에요' };
    const checked = checkList(migrateSessions(list), catalog, opt);
    return { sessions: checked.good, skipped: checked.bad, unknown: checked.unknown, settings, increments, version };
  }

  const Data = {
    VERSION, LEGACY_LB, newId, round2, lbToKg, defaultSettings, emptyStore, sessionOrder,
    migrateSession, migrateSessions, migrateDraft, migrateStore, migratePrefs, cleanIncrements, cleanSettings,
    checkSession, checkList, sameSession, addMissing, parseImport,
  };
  root.Data = Data;
  if (typeof module !== 'undefined' && module.exports) module.exports = Data;
})(typeof window !== 'undefined' ? window : globalThis);
