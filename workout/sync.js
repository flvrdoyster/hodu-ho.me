(function (root) {
  const URL = '';
  const KEY = 'workout_v1_sync';
  const BATCH = 20;
  const TIMEOUT_MS = 25000;

  let cfg = null;
  let st = null;
  let busy = false;
  let again = false;
  let connecting = false;
  let failure = '';
  let unread = 0;
  const listeners = [];

  function blank() {
    return { token: '', queue: [], known: [], rejected: [], last: '', at: {}, sig: {}, dq: [], dr: [], ov: [], skew: 0 };
  }

  function strings(v) {
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  }

  function load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
    const s = blank();
    if (raw && typeof raw === 'object') {
      if (typeof raw.token === 'string') s.token = raw.token;
      s.queue = strings(raw.queue);
      s.known = strings(raw.known);
      s.rejected = strings(raw.rejected);
      if (typeof raw.last === 'string') s.last = raw.last;
      s.dq = strings(raw.dq);
      s.dr = strings(raw.dr);
      s.ov = strings(raw.ov);
      if (typeof raw.skew === 'number' && isFinite(raw.skew)) s.skew = raw.skew;
      ['at', 'sig'].forEach((f) => {
        if (raw[f] && typeof raw[f] === 'object' && !Array.isArray(raw[f])) {
          Object.keys(raw[f]).forEach((k) => { if (typeof raw[f][k] === 'string') s[f][k] = raw[f][k]; });
        }
      });
    }
    return s;
  }

  function state() {
    if (!st) st = load();
    return st;
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state())); } catch (e) { return; }
  }

  function emit() {
    listeners.forEach((fn) => { try { fn(); } catch (e) { return; } });
  }

  const enabled = () => !!URL;
  const connected = () => enabled() && !!state().token;
  const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

  function status() {
    const s = state();
    let kind = 'ok';
    if (!enabled()) kind = 'off';
    else if (!s.token) kind = 'signed-out';
    else if (failure === 'auth') kind = 'auth';
    else if (busy) kind = 'busy';
    else if (failure === 'network') kind = 'error';
    else if (failure) kind = 'refused';
    return { kind, pending: s.queue.length, rejected: s.rejected.length, pendingData: s.dq.length, rejectedData: s.dr.length, overridden: s.ov.length, unread, last: s.last, failure };
  }

  function api(body) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : null;
    const done = () => { if (timer) clearTimeout(timer); };
    return fetch(URL, { method: 'POST', body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then((r) => r.text().then((t) => {
        done();
        let j = null;
        try { j = JSON.parse(t); } catch (e) { j = null; }
        if (!j || typeof j !== 'object') throw Object.assign(new Error('response'), { code: 'response' });
        return j;
      }), (e) => { done(); throw e; });
  }

  function fail(res) {
    failure = res && res.error === 'auth' ? 'auth' : (res && res.error) || 'response';
  }

  function failed(e) {
    failure = e && e.code === 'response' ? 'response' : 'network';
  }

  function known(id) {
    return state().known.indexOf(id) >= 0;
  }

  function markKnown(ids) {
    const s = state();
    let changed = false;
    ids.forEach((id) => {
      if (s.known.indexOf(id) < 0) { s.known.push(id); changed = true; }
    });
    if (changed) persist();
  }

  function noteRemote(local, incoming) {
    markKnown(local.filter((x) => incoming.some((r) => cfg.same(x, r))).map((x) => x.id));
  }

  function unsynced(sessions) {
    return sessions.filter((x) => !known(x.id));
  }

  function enqueue(ids) {
    const s = state();
    let changed = false;
    ids.forEach((id) => {
      if (s.queue.indexOf(id) < 0 && s.rejected.indexOf(id) < 0) { s.queue.push(id); changed = true; }
    });
    if (changed) persist();
  }

  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v);
  }

  async function flushInner() {
    for (;;) {
      const s = state();
      const have = {};
      cfg.sessions().forEach((x) => { have[x.id] = x; });
      s.queue = s.queue.filter((id) => have[id]);
      s.rejected = s.rejected.filter((id) => have[id]);
      if (!s.queue.length) { persist(); return; }
      if (offline()) { failure = 'network'; return; }
      const ids = s.queue.slice(0, BATCH);
      const res = await api({ action: 'upsert', token: s.token, sessions: ids.map((id) => have[id]) });
      if (!res.ok) { fail(res); persist(); return; }
      const saved = strings(res.saved);
      const refused = (Array.isArray(res.rejected) ? res.rejected : []).map((r) => (r && typeof r.id === 'string' ? r.id : '')).filter((id) => ids.indexOf(id) >= 0);
      const gone = saved.concat(refused);
      if (!gone.length) { failure = 'response'; persist(); return; }
      s.queue = s.queue.filter((id) => gone.indexOf(id) < 0);
      refused.forEach((id) => { if (s.rejected.indexOf(id) < 0) s.rejected.push(id); });
      markKnown(saved);
      s.last = new Date().toISOString();
      failure = '';
      persist();
    }
  }

  async function pullInner() {
    if (offline()) { failure = 'network'; return; }
    const s = state();
    const res = await api({ action: 'list', token: s.token });
    if (!res.ok || !Array.isArray(res.sessions)) { fail(res); return; }
    const r = root.Data.parseImport(res.sessions, cfg.catalog);
    const incoming = r.sessions || [];
    unread = (r.skipped ? r.skipped.length : 0) + (typeof res.bad === 'number' ? res.bad : 0);
    const local = cfg.sessions();
    const changed = incoming.filter((x) => local.some((y) => y.id === x.id && canon(y) !== canon(x)));
    if (changed.length) cfg.replace(changed);
    cfg.merge(incoming);
    const now = cfg.sessions();
    markKnown(incoming.map((x) => x.id));
    noteRemote(now, incoming);
    enqueue(now.filter((x) => !incoming.some((y) => cfg.same(x, y))).map((x) => x.id));
    s.last = new Date().toISOString();
    failure = '';
    persist();
  }

  const stamp = () => new Date().toISOString();
  const wire = (at) => new Date(Date.parse(at) + state().skew).toISOString();
  const local = (iso) => new Date(Date.parse(iso) - state().skew).toISOString();

  function learn(res) {
    const t = typeof res.now === 'string' ? Date.parse(res.now) : NaN;
    if (!isFinite(t)) return;
    state().skew = t - Date.now();
  }

  function enqueueData(key) {
    const s = state();
    if (s.dq.indexOf(key) < 0 && s.dr.indexOf(key) < 0) { s.dq.push(key); }
  }

  function keep(key, value) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem('workout_v1_replaced_data')) || []; } catch (e) { list = []; }
    list.push({ key, value, at: stamp() });
    try { localStorage.setItem('workout_v1_replaced_data', JSON.stringify(list)); } catch (e) { return; }
  }

  function adopt(key, parsed, serverAt) {
    const k = cfg.keys[key];
    const s = state();
    let differs = false;
    if (canon(parsed.value) !== canon(k.get())) { k.set(parsed.value); differs = true; }
    s.sig[key] = canon(k.get());
    s.at[key] = local(serverAt);
    s.dq = s.dq.filter((x) => x !== key);
    return differs;
  }

  function mine(key) {
    const s = state();
    s.at[key] = stamp();
    s.dr = s.dr.filter((x) => x !== key);
    enqueueData(key);
  }

  function check() {
    if (!enabled() || !cfg || !cfg.keys) return;
    const s = state();
    let changed = false;
    Object.keys(cfg.keys).forEach((key) => {
      const sig = canon(cfg.keys[key].get());
      if (s.sig[key] === undefined) { s.sig[key] = sig; changed = true; return; }
      if (s.sig[key] === sig) return;
      s.sig[key] = sig;
      mine(key);
      changed = true;
    });
    if (!changed) return;
    persist();
    if (connected() && s.dq.length) run(flushAll);
    else emit();
  }

  async function pullData() {
    if (!cfg.keys) return;
    if (offline()) { failure = 'network'; return; }
    const s = state();
    const res = await api({ action: 'data_list', token: s.token });
    if (!res.ok || !Array.isArray(res.items)) { fail(res); return; }
    learn(res);
    const by = {};
    res.items.forEach((i) => { if (i && typeof i.key === 'string' && typeof i.updated_at === 'string' && isFinite(Date.parse(i.updated_at))) by[i.key] = i; });
    const changed = [];
    Object.keys(cfg.keys).forEach((key) => {
      const k = cfg.keys[key];
      const sv = by[key];
      const cur = k.get();
      const pristine = canon(cur) === canon(k.def);
      const at = s.at[key] || '';
      if (!sv) {
        if (at) enqueueData(key);
        else if (!pristine) mine(key);
        return;
      }
      const p = k.parse(sv.value);
      if (!at) {
        if (pristine) {
          if (!p.ok) mine(key);
          else if (adopt(key, p, sv.updated_at)) changed.push(key);
        } else if (p.ok && canon(p.value) === canon(cur)) {
          adopt(key, p, sv.updated_at);
        } else if (!p.ok || canon(p.value) === canon(k.def)) {
          mine(key);
        } else {
          keep(key, cur);
          if (s.ov.indexOf(key) < 0) s.ov.push(key);
          adopt(key, p, sv.updated_at);
          changed.push(key);
        }
        return;
      }
      if (!p.ok) { mine(key); return; }
      const sMs = Date.parse(sv.updated_at);
      const lMs = Date.parse(at) + s.skew;
      if (sMs > lMs) { if (adopt(key, p, sv.updated_at)) changed.push(key); }
      else if (sMs < lMs) enqueueData(key);
    });
    persist();
    if (changed.length && cfg.applied) cfg.applied(changed);
  }

  async function flushData() {
    if (!cfg.keys) return;
    for (;;) {
      const s = state();
      s.dq = s.dq.filter((k) => cfg.keys[k]);
      if (!s.dq.length) { persist(); return; }
      if (offline()) { failure = 'network'; return; }
      const keys = s.dq.slice(0, 20);
      const sent = {};
      keys.forEach((k) => { if (!s.at[k]) s.at[k] = stamp(); sent[k] = s.at[k]; });
      const res = await api({ action: 'data_put', token: s.token, items: keys.map((k) => ({ key: k, updated_at: wire(sent[k]), value: cfg.keys[k].get() })) });
      if (!res.ok) { fail(res); persist(); return; }
      learn(res);
      const same = (k) => s.at[k] === sent[k];
      const saved = strings(res.saved).filter((k) => keys.indexOf(k) >= 0);
      const stale = (Array.isArray(res.stale) ? res.stale : []).filter((x) => x && typeof x.key === 'string' && typeof x.updated_at === 'string' && isFinite(Date.parse(x.updated_at)) && keys.indexOf(x.key) >= 0);
      const refused = (Array.isArray(res.rejected) ? res.rejected : []).map((r) => (r && typeof r.key === 'string' ? r.key : '')).filter((k) => keys.indexOf(k) >= 0);
      if (!saved.length && !stale.length && !refused.length) { failure = 'response'; persist(); return; }
      saved.forEach((k) => { if (same(k)) s.dq = s.dq.filter((x) => x !== k); });
      refused.forEach((k) => {
        if (!same(k)) return;
        s.dq = s.dq.filter((x) => x !== k);
        if (s.dr.indexOf(k) < 0) s.dr.push(k);
      });
      const changed = [];
      stale.forEach((x) => {
        if (!same(x.key)) return;
        const p = cfg.keys[x.key].parse(x.value);
        if (!p.ok) { mine(x.key); return; }
        if (adopt(x.key, p, x.updated_at)) changed.push(x.key);
      });
      s.last = stamp();
      failure = '';
      persist();
      if (changed.length && cfg.applied) cfg.applied(changed);
    }
  }

  async function flushAll() {
    failure = '';
    await flushInner();
    if (failure) return;
    await flushData();
  }

  async function run(fn) {
    if (!connected()) return;
    if (busy) { again = true; return; }
    busy = true;
    emit();
    try {
      await fn();
    } catch (e) {
      failed(e);
    }
    busy = false;
    emit();
    if (again) { again = false; run(both); }
  }

  async function both() {
    await pullInner();
    if (failure) return;
    await pullData();
    if (failure) return;
    await flushAll();
  }

  function syncNow(retry) {
    if (retry) { state().rejected = []; state().dr = []; state().ov = []; persist(); }
    if (failure && failure !== 'auth') failure = '';
    return run(both);
  }

  function push(id) {
    if (!id) return Promise.resolve();
    if (connected()) enqueue([id]);
    return run(flushAll);
  }

  async function connect(password, label) {
    if (!enabled()) return { ok: false, error: 'off' };
    if (connecting) return { ok: false, error: 'busy-local' };
    connecting = true;
    try {
      const res = await api({ action: 'login', password: String(password || ''), label: label || '' });
      if (!res.ok || typeof res.token !== 'string') return { ok: false, error: res.error || 'response' };
      state().token = res.token;
      failure = '';
      persist();
      emit();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e && e.code === 'response' ? 'response' : 'network' };
    } finally {
      connecting = false;
    }
  }

  function disconnect() {
    const s = state();
    const token = s.token;
    s.token = '';
    failure = '';
    persist();
    emit();
    if (token && enabled()) api({ action: 'logout', token }).catch(() => {});
  }

  function reset() {
    const s = state();
    s.queue = [];
    s.known = [];
    s.rejected = [];
    s.last = '';
    s.at = {};
    s.sig = {};
    s.dq = [];
    s.dr = [];
    s.ov = [];
    unread = 0;
    persist();
    emit();
  }

  function init(c) {
    cfg = c;
    if (typeof window !== 'undefined') window.addEventListener('online', () => { syncNow(); });
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  root.Sync = { enabled, connected, status, init, push, check, syncNow, connect, disconnect, reset, onChange, unsynced, noteRemote, markKnown };
})(typeof window !== 'undefined' ? window : globalThis);
