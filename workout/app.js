(function () {
  const get = (id) => window.Catalog.get(id);
  const E = window.Engine;
  const Dt = window.Data;
  const KEY = 'workout_v1';
  const DRAFT_KEY = 'workout_v1_draft';
  const BACKUP_KEY = 'workout_v1_pre3';
  const BAD_KEY = 'workout_v1_bad';
  const app = document.getElementById('app');
  const sheet = document.getElementById('sheet');
  const toastEl = document.getElementById('toast');
  const importFile = document.getElementById('importFile');

  const FEEL = { light: '가벼움', ok: '적당', heavy: '무거움' };
  const STATUS = { pending: '대기', done: '완료', skipped: '생략' };

  let S = load();
  E.setUnit(S.settings.weight_unit);
  const undoStack = [];
  const ui = {
    screen: 'main', phase: 'input', feelIdx: null, msg: '',
    reps: 0, editing: false, sheetKind: null, sheetArg: null,
    timer: { running: false, endsAt: 0, remaining: 0, total: 0 },
  };


  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function load() {
    let text = null;
    try { text = localStorage.getItem(KEY); } catch (e) { text = null; }
    let main = null;
    try { main = JSON.parse(text); } catch (e) { main = null; }
    const current = main && main.version === Dt.VERSION;
    if (!current && text) {
      try { if (localStorage.getItem(BACKUP_KEY) == null) localStorage.setItem(BACKUP_KEY, text); } catch (e) { toast('백업을 저장하지 못했어요'); }
    }
    const store = Dt.migrateStore(main, window.Catalog);
    if (current) store.draft = Dt.migrateDraft(readJson(DRAFT_KEY), false);
    const checked = Dt.checkList(store.sessions, window.Catalog, { lenient: true });
    if (checked.bad.length) {
      const old = readJson(BAD_KEY);
      try { localStorage.setItem(BAD_KEY, JSON.stringify((Array.isArray(old) ? old : []).concat(checked.bad.map((b) => b.raw)))); } catch (e) { toast('격리 보관에 실패했어요'); }
    }
    store.sessions = checked.good.sort(Dt.sessionOrder);
    if (store.draft) {
      if (store.sessions.some((s) => s.id === store.draft.id)) store.draft = null;
      else store.draft.items = store.draft.items.filter((x) => get(x.exercise_id));
    }
    return store;
  }

  function save(all) {
    try {
      if (all) {
        const main = Object.assign({}, S);
        delete main.draft;
        localStorage.setItem(KEY, JSON.stringify(main));
      }
      if (S.draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(S.draft));
      else localStorage.removeItem(DRAFT_KEY);
    } catch (e) { toast('저장 공간에 쓰지 못했어요'); }
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => E.localDate(new Date());
  const uid = () => Math.random().toString(36).slice(2, 9);

  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { toastEl.hidden = true; }, 2400);
  }

  function makeItem(rec) {
    const timed = E.isTimed(get(rec.exercise_id));
    const target = timed ? { sets: rec.sets, duration_sec: rec.duration_sec } : { weight_kg: rec.weight, reps: rec.reps, sets: rec.sets };
    const it = {
      uid: uid(), exercise_id: rec.exercise_id, slot: rec.slot, priority: rec.priority || 'main',
      status: 'pending', target, base_sets: rec.sets, sets: [],
    };
    if (rec.pre) it.pre = rec.pre;
    return it;
  }

  function retarget(it, id) {
    const rec = E.recommend(id, S.sessions, S.increments);
    const fresh = makeItem(Object.assign(rec, { slot: it.slot, priority: it.priority }));
    fresh.uid = it.uid;
    fresh.status = it.status;
    return fresh;
  }

  const D = () => S.draft;
  const items = () => D().items;
  const idxOf = (u) => items().findIndex((x) => x.uid === u);
  const cur = () => items()[idxOf(D().current)];
  const def = (it) => E.eff(it.exercise_id, S.increments);
  const unmeasured = (it) => !isTimed(it) && it.target.weight_kg == null;
  const workDone = (it) => it.sets.filter((s) => !s.is_warmup).length;
  const isTimed = (it) => E.isTimed(def(it));

  function nextPending(fromUid) {
    const list = items();
    const i = idxOf(fromUid);
    for (let k = i + 1; k < list.length; k++) if (list[k].status === 'pending' && list[k].uid !== fromUid) return list[k];
    for (let k = 0; k < i; k++) if (list[k].status === 'pending') return list[k];
    return null;
  }

  function targetText(it) {
    const d = def(it);
    if (E.isTimed(d)) return E.fmtMin(it.target.duration_sec);
    return E.fmtW(d, it.target.weight_kg) + ' × ' + it.target.reps + '회 × ' + it.target.sets + '세트';
  }

  function setText(d, s) {
    return E.fmtW(d, s.weight_kg) + ' × ' + s.reps + '회';
  }

  function weightSub(d, w) {
    const parts = [];
    if (d.weight_basis === 'per_side') parts.push('한 쪽');
    return parts.join(' · ');
  }

  const strength = (it) => it.status !== 'skipped' && !isTimed(it);

  function elapsedSec() {
    return D().started_at ? Math.max(0, (Date.now() - new Date(D().started_at).getTime()) / 1000) : 0;
  }

  function leftSec(it) {
    return Math.max(0, it.target.sets - workDone(it)) * setSec(it);
  }

  function projectedSec() {
    return elapsedSec() + items().filter(strength).reduce((a, it) => a + leftSec(it), 0);
  }

  const targetSec = () => D().target_sec || S.settings.target_sec;
  const targetMin = () => Math.round(targetSec() / 60);
  const setSec = (it) => E.setSec(it.exercise_id, S.sessions, it.sets, def(it).rest_sec + 40);
  const planSec = (it) => it.target.sets * setSec(it);

  function fitToTime(rebuild) {
    const open = (it) => strength(it) && !it.sets.length && it.uid !== D().current;
    if (rebuild) {
      items().forEach((it) => {
        if (it.auto && it.status === 'skipped') { it.status = 'pending'; it.auto = false; }
        if (it.base_sets && open(it)) it.target.sets = it.base_sets;
      });
    }
    let over = projectedSec() - targetSec();
    const cut = [];
    const trimmed = [];
    const back = items().slice().reverse();
    ['optional', 'main'].forEach((pr) => {
      back.forEach((it) => {
        if (over <= 0 || !open(it) || it.priority !== pr || it.keep) return;
        it.status = 'skipped';
        it.auto = true;
        over -= leftSec(it);
        cut.push(def(it).name);
      });
    });
    let changed = true;
    while (over > 0 && changed) {
      changed = false;
      back.forEach((it) => {
        if (over <= 0 || !open(it) || it.target.sets <= 2) return;
        it.target.sets--;
        over -= setSec(it);
        changed = true;
        if (trimmed.indexOf(def(it).name) < 0) trimmed.push(def(it).name);
      });
    }
    return { cut: cut.reverse(), trimmed: trimmed.reverse() };
  }

  const timeUp = () => D().phase === 'active' && elapsedSec() >= targetSec();

  function bandHTML() {
    const list = items().filter(strength);
    const planned = list.reduce((a, it) => a + Math.max(planSec(it), workDone(it) * setSec(it)), 0);
    const scale = Math.max(targetSec(), planned, 1);
    const segs = list.map((it) => {
      const sec = Math.max(planSec(it), workDone(it) * setSec(it));
      const fill = Math.min(1, workDone(it) / Math.max(1, it.target.sets));
      return '<span class="band__seg' + (D().phase === 'active' && it.uid === D().current ? ' is-current' : '') + '" style="flex:' + sec + ' 0 0"><span class="band__fill" style="width:' + (fill * 100) + '%"></span></span>';
    }).join('');
    const free = scale - planned;
    const tick = D().phase === 'active' ? '<span class="band__tick' + (timeUp() ? ' is-over' : '') + '" id="bandTick" data-scale="' + scale + '" style="left:' + Math.min(100, elapsedSec() / scale * 100) + '%"></span>' : '';
    return '<div class="band" role="img" aria-label="시간 배분">' + segs + (free > 0 ? '<span class="band__free" style="flex:' + free + ' 0 0"></span>' : '') + tick + '</div>';
  }

  function timeCardHTML() {
    const planned = Math.round(items().filter(strength).reduce((a, it) => a + planSec(it), 0) / 60);
    const cut = items().filter((it) => it.auto && it.status === 'skipped').length;
    const run = D().phase === 'active';
    return '<div class="card timecard">' + stepper('운동 시간', 'time', targetMin() + '분') + bandHTML() +
      '<p class="muted small">' + (run ? '경과 ' + Math.floor(elapsedSec() / 60) + '분 · ' : '') + '근력 예상 ' + planned + '분' + (cut ? ' · 시간에 맞춰 뺀 운동 ' + cut + '개' : '') + '</p></div>';
  }

  function remember() { undoStack.push({ reps: ui.reps }); }

  function resetCounters(it) {
    ui.reps = 0;
    undoStack.length = 0;
  }

  let actx = null;
  document.addEventListener('pointerdown', () => {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume();
  }, true);

  function beep() {
    if (S.settings.sound && actx) {
      [0, 0.25, 0.5].forEach((t) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, actx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, actx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + t + 0.18);
        o.connect(g).connect(actx.destination);
        o.start(actx.currentTime + t);
        o.stop(actx.currentTime + t + 0.2);
      });
    }
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }

  function startTimer(sec) {
    const t = ui.timer;
    t.total = sec;
    t.remaining = sec;
    t.endsAt = Date.now() + sec * 1000;
    t.running = sec > 0;
  }

  function timerLeft() {
    const t = ui.timer;
    return t.running ? Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000)) : t.remaining;
  }

  const mmss = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  setInterval(() => {
    const tick = document.getElementById('bandTick');
    if (tick && S.draft) {
      tick.style.left = Math.min(100, elapsedSec() / Number(tick.dataset.scale) * 100) + '%';
      tick.classList.toggle('is-over', timeUp());
    }
    const t = ui.timer;
    if (!t.running) return;
    const left = timerLeft();
    const el = document.getElementById('timerText');
    if (el) el.textContent = mmss(left);
    const bar = document.getElementById('timerBar');
    if (bar) bar.style.transform = 'scaleX(' + (t.total ? left / t.total : 0) + ')';
    if (left <= 0) {
      t.running = false;
      t.remaining = 0;
      beep();
      if (S.draft && D().phase === 'active' && ui.screen === 'main' && ui.phase === 'rest') {
        ui.phase = 'input';
        ui.feelIdx = null;
        render();
      }
      toast('휴식 끝');
    }
  }, 250);

  let wakeLock = null;
  function keepAwake() {
    if (!navigator.wakeLock || wakeLock || !S.draft || D().phase !== 'active') return;
    navigator.wakeLock.request('screen').then((l) => {
      wakeLock = l;
      l.addEventListener('release', () => { wakeLock = null; });
    }).catch(() => {});
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

  function render() {
    if (!S.draft) app.innerHTML = homeHTML();
    else if (D().phase === 'plan') app.innerHTML = planHTML();
    else if (ui.screen === 'summary') app.innerHTML = summaryHTML();
    else if (ui.screen === 'list') app.innerHTML = listHTML();
    else app.innerHTML = exerciseHTML();
    if (sheet.open) renderSheet();
    if (ui.askWeight) {
      ui.askWeight = false;
      const c = S.draft && D().phase === 'active' && ui.screen === 'main' ? cur() : null;
      if (c && unmeasured(c) && !sheet.open) openSheet('exset');
    }
    if (ui.scrollToCur) {
      ui.scrollToCur = false;
      const row = document.getElementById('curRow');
      window.scrollTo(0, 0);
      if (row) row.scrollIntoView({ block: 'center' });
    }
  }

  let drag = null;

  function dragUpdate() {
    const g = drag;
    const dy = g.y + window.scrollY - g.startY;
    g.li.style.transform = 'translateY(' + dy + 'px)';
    const center = g.rects[g.from].top + g.rects[g.from].h / 2 + dy;
    let to = g.from;
    g.rects.forEach((rc, i) => {
      const mid = rc.top + rc.h / 2;
      if (i > g.from && center > mid) to = Math.max(to, i);
      if (i < g.from && center < mid) to = Math.min(to, i);
    });
    g.to = to;
    const size = g.rects[g.from].h + 8;
    g.rows.forEach((el, i) => {
      if (i === g.from) return;
      let off = 0;
      if (g.from < i && i <= to) off = -size;
      else if (to <= i && i < g.from) off = size;
      el.style.transform = off ? 'translateY(' + off + 'px)' : '';
    });
  }

  function dragEnd() {
    if (!drag) return;
    const g = drag;
    drag = null;
    clearInterval(g.timer);
    if (g.to !== g.from) {
      const list = items();
      const moved = list.splice(g.from, 1)[0];
      list.splice(g.to, 0, moved);
      save();
    }
    render();
  }

  document.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('.row__handle');
    if (!h || drag) return;
    e.preventDefault();
    const li = h.closest('.row');
    const rows = Array.from(li.parentNode.children);
    const from = rows.indexOf(li);
    drag = {
      li, rows, from, to: from,
      rects: rows.map((el) => { const rc = el.getBoundingClientRect(); return { top: rc.top + window.scrollY, h: rc.height }; }),
      startY: e.clientY + window.scrollY, y: e.clientY,
    };
    h.setPointerCapture(e.pointerId);
    li.classList.add('is-dragging');
    rows.forEach((el) => { if (el !== li) el.classList.add('is-shifting'); });
    drag.timer = setInterval(() => {
      if (!drag) return;
      if (drag.y < 90) window.scrollBy(0, -10);
      else if (drag.y > window.innerHeight - 70) window.scrollBy(0, 10);
      else return;
      dragUpdate();
    }, 16);
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.y = e.clientY;
    dragUpdate();
  });
  document.addEventListener('pointerup', dragEnd);
  document.addEventListener('pointercancel', dragEnd);

  function topbar(title, sub, right, left, sticky) {
    return '<header class="topbar' + (sticky ? ' topbar--sticky' : '') + '">' + (left || '') + '<div class="topbar__title"><h1>' + esc(title) + '</h1>' + (sub ? '<p class="topbar__sub">' + esc(sub) + '</p>' : '') + '</div>' + (right || '') + '</header>';
  }

  const settingsBtn = '<button type="button" class="btn btn--ghost btn--sm" data-act="settings">설정</button>';

  function homeHTML() {
    const last = S.sessions[S.sessions.length - 1];
    let lastHTML = '<p class="muted">아직 기록이 없어요. 설정에서 이전 기록을 가져올 수 있어요.</p>';
    if (last) {
      const names = (last.exercises || []).map((e) => (get(e.exercise_id) ? get(e.exercise_id).name : e.exercise_id)).join(', ');
      lastHTML = '<p class="label">지난 세션</p><p><strong>' + esc(last.date) + '</strong> · ' + esc(tplName(last.session_type)) + (last.duration_sec ? ' · ' + Math.round(last.duration_sec / 60) + '분' : '') + '</p><p class="muted small">' + esc(names) + '</p>';
    }
    const btns = Object.keys(window.TEMPLATES).map((k) => '<button type="button" class="btn btn--primary btn--lg" data-act="new-session" data-type="' + k + '">' + esc(window.TEMPLATES[k].name) + ' 세션 만들기</button>').join('');
    return topbar('운동 기록', today(), settingsBtn) + '<section class="stack">' + btns + '<div class="card">' + lastHTML + '</div></section>';
  }

  function tplName(t) {
    return window.TEMPLATES[t] ? window.TEMPLATES[t].name : t;
  }

  function rowsHTML(mode) {
    const live = mode !== 'plan';
    const curUid = live ? D().current : null;
    return '<ol class="rows">' + items().map((it) => {
      const d = def(it);
      const isCur = it.uid === curUid;
      let status = '';
      if (live) status = '<span class="tag tag--' + (isCur ? 'active' : it.status) + '">' + (isCur ? '진행 중' : STATUS[it.status]) + '</span>';
      else if (it.priority === 'optional') status = '<span class="tag">선택</span>';
      const sub = live && it.sets.length ? doneText(it) : targetText(it) + (mode === 'plan' && strength(it) ? ' · 약 ' + Math.round(planSec(it) / 60) + '분' : '');
      const jumpable = mode === 'list' && it.status !== 'skipped';
      const main = '<span class="row__name">' + esc(d.name) + (unmeasured(it) ? '<span class="tag">미측정</span>' : '') + status + '</span>' +
        '<span class="row__sub">' + esc(sub) + '</span>' +
        (mode === 'plan' && it.status !== 'skipped' && !unmeasured(it) ? '<span class="row__reason">' + esc((it.pre || '') + E.recommend(it.exercise_id, S.sessions, S.increments).reason) + '</span>' : '');
      return '<li class="row' + (it.status === 'skipped' ? ' is-skipped' : '') + (isCur ? ' is-current' : '') + '"' + (isCur ? ' id="curRow"' : '') + '>' +
        (jumpable
          ? '<button type="button" class="row__main row__main--btn" data-act="jump" data-uid="' + it.uid + '"><span class="row__text">' + main + '</span><span aria-hidden="true">›</span></button>'
          : '<div class="row__main"><span class="row__text">' + main + '</span></div>') +
        (mode === 'list' ? '</li>' : '<div class="row__tools">' +
        '<button type="button" class="btn btn--sm" data-act="swap" data-uid="' + it.uid + '">대체</button>' +
        '<button type="button" class="btn btn--sm" data-act="skip" data-uid="' + it.uid + '">' + (it.status === 'skipped' ? '복원' : '생략') + '</button>' +
        '<button type="button" class="btn btn--sm row__handle" aria-label="끌어서 순서 바꾸기">≡</button>' +
        '</div></li>');
    }).join('') + '</ol>';
  }

  function doneText(it) {
    const d = def(it);
    if (E.isTimed(d)) return E.fmtMin(it.sets[0].duration_sec);
    const ws = it.sets.filter((x) => !x.is_warmup);
    if (!ws.length) return '웜업 ' + it.sets.length + '세트';
    const w = ws[0].weight_kg;
    if (ws.some((x) => x.weight_kg !== w)) return ws.map((x) => setText(d, x)).join(', ');
    const reps = ws.map((x) => x.reps);
    const same = reps.every((x) => x === reps[0]);
    return E.fmtW(d, w) + ' × ' + (same ? reps[0] + '회 × ' + ws.length + '세트' : reps.join('/') + '회');
  }

  function listHTML() {
    const editing = ui.editing;
    const done = items().filter((x) => x.status === 'done').length;
    const active = items().filter((x) => x.status !== 'skipped').length;
    return topbar('세션 목록', done + '/' + active + ' 완료',
      '<button type="button" class="btn btn--ghost btn--sm" data-act="list-edit">' + (editing ? '완료' : '편집') + '</button>',
      '<button type="button" class="btn btn--ghost btn--sm topbar__back" data-act="back-ex">‹ 운동으로</button>', true) +
      '<section class="stack">' + timeCardHTML() + rowsHTML(editing ? 'edit' : 'list') +
      '<button type="button" class="btn" data-act="add">운동 추가</button>' +
      '<button type="button" class="btn" data-act="finish">세션 종료</button>' +
      '<button type="button" class="btn btn--danger" data-act="abandon">기록 버리고 처음으로</button></section>';
  }

  function planHTML() {
    return topbar(tplName(D().session_type) + ' 세션', D().date, '<button type="button" class="btn btn--ghost btn--sm" data-act="plan-cancel">취소</button>') +
      '<section class="stack">' + timeCardHTML() + lastSessionHTML() + rowsHTML('plan') +
      '<button type="button" class="btn" data-act="add">운동 추가</button>' +
      '<button type="button" class="btn btn--primary btn--lg" data-act="plan-start">시작</button></section>';
  }

  function exerciseHTML() {
    const it = cur();
    const d = def(it);
    const nx = nextPending(it.uid);

    const progress = '<div class="progress">' + bandHTML() + '<button type="button" class="btn btn--ghost btn--sm" data-act="open-list">목록</button></div>';

    const card = '<div class="card ex"><h2>' + esc(d.name) + '</h2>' + targetsHTML(it, d) + '</div>';

    const panel = ui.phase === 'rest' ? restHTML(it, nx) : inputHTML(it);
    const memo = ui.phase === 'rest' ? '<button type="button" class="memo-row" data-act="note-edit"><span class="memo-row__n">메모</span>' +
      '<span class="memo-row__t">' + (it.note ? esc(it.note) : '오늘 메모 추가') + '</span><span aria-hidden="true">›</span></button>' : '';
    const sets = setsHTML(it);
    const log = sets || memo ? '<div class="card ex-log">' + sets + memo + '</div>' : '';
    return '<section class="stack stack--ex">' + progress + card + panel + log + lastMemoHTML(it) + prevHTML(it) + '</section>';
  }

  function stepper(label, act, val, note, off, extra) {
    const dis = off ? ' disabled' : '';
    return '<div class="tgt tgt--wide"><div class="head-row"><span class="label">' + label + '</span>' + (extra || '') + '</div>' +
      '<div class="stepper"><button type="button" class="btn btn--icon" data-act="' + act + '" data-dir="-1" aria-label="' + label + ' 줄이기"' + dis + '>−</button>' +
      '<button type="button" class="stepper__val" data-act="' + act + '-edit">' + esc(val) + '</button>' +
      '<button type="button" class="btn btn--icon" data-act="' + act + '" data-dir="1" aria-label="' + label + ' 늘리기"' + dis + '>+</button></div>' +
      (note ? '<span class="muted small">' + esc(note) + '</span>' : '') + '</div>';
  }

  const unitBtn = () => '<button type="button" class="btn btn--sm" data-act="unit-toggle" aria-label="무게 단위 바꾸기">' + S.settings.weight_unit + '</button>';

  function targetsHTML(it, d) {
    const cell = (label, val) => '<div class="tgt"><span class="label">' + label + '</span><span class="tgt__v">' + esc(val) + '</span></div>';
    if (isTimed(it)) return '<div class="tgts">' + stepper('시간', 'dur', E.fmtMin(it.target.duration_sec)) + '</div>';
    const none = it.target.weight_kg == null;
    return '<div class="tgts">' + stepper(d.load === 'assist' ? '보조 무게' : '무게', 'w', none ? '무게 미정' : E.fmtW(Object.assign({}, d, { load: 'weight' }), it.target.weight_kg), weightSub(d, it.target.weight_kg), none, unitBtn()) +
      cell('횟수', it.target.reps + '회') + cell('세트', it.target.sets + '세트') + '</div>';
  }

  function setRowHTML(d, s, label) {
    return '<span class="set__n">' + label + '</span>' +
      '<span class="set__v">' + esc(setText(d, s)) + '</span>' +
      (s.feel ? '<span class="set__feel">' + FEEL[s.feel] + '</span>' : '') +
      (s.note ? '<span class="set__note set__note--below">' + esc(s.note) + '</span>' : '');
  }

  function setsHTML(it) {
    if (!it.sets.length || isTimed(it)) return '';
    const d = def(it);
    let n = 0;
    return '<ol class="sets">' + it.sets.map((s, i) => '<li><button type="button" class="set' + (s.is_warmup ? ' set--warm' : '') + '" data-act="edit-set" data-i="' + i + '">' +
      setRowHTML(d, s, s.is_warmup ? '웜업' : (++n) + '세트') + '</button></li>').join('') + '</ol>';
  }

  function lastOf(id) {
    const h = E.history(S.sessions, id)[0];
    if (!h) return null;
    return { date: h.date, ex: h.ex, next: h.ex.next_note || null };
  }

  function lastMemoHTML(it) {
    const last = lastOf(it.exercise_id);
    if (!last || (!last.ex.note && !last.next)) return '';
    return '<div class="card memo-card"><span class="label">지난 메모 · ' + esc(last.date) + '</span>' +
      (last.ex.note ? '<p>' + esc(last.ex.note) + '</p>' : '') +
      (last.next ? '<p>다음 목표: ' + esc(last.next) + '</p>' : '') + '</div>';
  }

  function lastSessionHTML() {
    const same = S.sessions.filter((x) => x.session_type === D().session_type);
    const last = same[same.length - 1];
    const watch = last ? last.watch_note : null;
    if (!last || (!last.notes && !watch)) return '';
    return '<div class="card memo-card"><span class="label">지난 ' + esc(tplName(last.session_type)) + ' 세션 메모 · ' + esc(last.date) + '</span>' +
      (last.notes ? '<p>' + esc(last.notes) + '</p>' : '') +
      (watch ? '<p>지켜볼 것: ' + esc(watch) + '</p>' : '') + '</div>';
  }

  function inputHTML(it) {
    if (isTimed(it)) {
      return '<div class="panel panel--input">' +
        '<button type="button" class="btn btn--primary btn--lg" data-act="cardio-done">' + (it.sets.length ? '시간 다시 기록' : '기록') + '</button>' +
        navHTML(it, nextPending(it.uid)) + '</div>';
    }
    const target = it.target.reps;
    const counter = '<button type="button" class="counter stage--' + E.stage(ui.reps, target) + '" data-act="tap-full">' +
      '<span class="count__n">' + ui.reps + '</span><span class="count__t">눌러서 +1 · 목표 ' + target + '회</span></button>' +
      '<div class="row2"><button type="button" class="btn" data-act="tap-undo"' + (undoStack.length ? '' : ' disabled') + '>되돌리기</button>' +
      '<button type="button" class="btn" data-act="tap-fill"' + (target ? '' : ' disabled') + '>+' + target + '</button></div>';
    return '<div class="panel panel--input">' + counter +
      '<button type="button" class="btn btn--primary btn--lg" data-act="record">' + (workDone(it) + 1) + '세트 기록</button></div>';
  }

  function navHTML(it, nx, quiet) {
    const done = !quiet && (isTimed(it) ? it.sets.length > 0 : workDone(it) >= it.target.sets);
    if (!nx) {
      return '<button type="button" class="btn' + (done ? ' btn--primary btn--lg' : '') + '" data-act="finish">세션 종료</button>';
    }
    return '<button type="button" class="btn' + (done ? ' btn--primary btn--lg' : '') + '" data-act="next-ex">다음 운동으로 · ' + esc(def(nx).name) + '</button>';
  }

  function restHTML(it, nx) {
    const left = timerLeft();
    const t = ui.timer;
    let feel = '';
    if (ui.feelIdx != null && it.sets[ui.feelIdx]) {
      feel = '<div class="feel"><p class="label">방금 세트 어땠어요?</p><div class="row3">' +
        Object.keys(FEEL).map((k) => '<button type="button" class="btn" data-act="feel" data-v="' + k + '">' + FEEL[k] + '</button>').join('') +
        '</div></div>';
    }
    const up = timeUp();
    const done = up || workDone(it) >= it.target.sets;
    const nextSet = '<button type="button" class="btn' + (done ? '' : ' btn--primary btn--lg') + '" data-act="next-set">' + (done ? '한 세트 더' : '다음 세트 시작') + '</button>';
    return '<div class="panel panel--rest">' + feel +
      (up ? '<p class="note">운동 시간 ' + targetMin() + '분이 됐어요.</p>' : '') +
      (ui.msg ? '<p class="note">' + esc(ui.msg) + '</p>' : '') +
      '<div class="timer"><span class="label">휴식</span><span class="timer__t" id="timerText">' + mmss(left) + '</span>' +
      '<div class="timer__track"><div class="timer__bar" id="timerBar" style="transform:scaleX(' + (t.total ? left / t.total : 0) + ')"></div></div></div>' +
      '<div class="row3"><button type="button" class="btn" data-act="t-toggle">' + (t.running ? '일시정지' : '시작') + '</button>' +
      '<button type="button" class="btn" data-act="t-reset">리셋</button>' +
      '<button type="button" class="btn" data-act="t-add">+30초</button></div>' +
      (up ? '<button type="button" class="btn btn--primary btn--lg" data-act="finish">세션 종료</button>' : '') +
      (isTimed(it) ? '' : nextSet) + (up && !nx ? '' : navHTML(it, nx, up)) + '</div>';
  }

  function prevHTML(it) {
    const h = E.history(S.sessions, it.exercise_id)[0];
    if (!h) return '';
    const d = def(it);
    let body;
    if (E.isTimed(d)) body = '<p>' + E.fmtMin(h.ex.sets[0].duration_sec) + '</p>';
    else {
      let n = 0;
      body = '<ol class="sets">' + (h.ex.sets || []).map((s) => '<li class="set set--static' + (s.is_warmup ? ' set--warm' : '') + '">' +
        setRowHTML(d, s, s.is_warmup ? '웜업' : (++n) + '세트') + '</li>').join('') + '</ol>';
    }
    return '<details class="card prev-wrap"><summary>직전 기록 · ' + esc(h.date) + '</summary>' + body + '</details>';
  }

  function buildLog() {
    const dr = D();
    const exercises = [];
    dr.items.forEach((it) => {
      if (it.status === 'skipped' || !it.sets.length) return;
      const sets = E.isTimed(def(it))
        ? [Object.assign({}, it.sets[0], { duration_sec: it.target.duration_sec })]
        : it.sets.map((s) => Object.assign({}, s));
      const ex = { exercise_id: it.exercise_id, sets };
      if (it.note) ex.note = it.note;
      exercises.push(ex);
    });
    const started = dr.started_at ? new Date(dr.started_at) : new Date();
    const bw = dr.bodyweight_kg != null ? dr.bodyweight_kg : S.settings.bodyweight_kg;
    const log = { id: dr.id, date: dr.date, session_type: dr.session_type };
    if (dr.started_at) log.started_at = dr.started_at;
    log.duration_sec = Math.max(60, Math.round((Date.now() - started.getTime()) / 1000));
    if (bw != null) log.bodyweight_kg = bw;
    if (dr.notes) log.notes = dr.notes;
    log.exercises = exercises;
    return log;
  }

  function digestHTML(future) {
    const lines = [];
    const st = items().filter((it) => !isTimed(it));
    const stamps = [];
    st.forEach((it) => it.sets.forEach((x) => { if (x.at) stamps.push(new Date(x.at).getTime()); }));
    if (stamps.length && D().started_at) {
      const used = Math.max(1, Math.round((Math.max.apply(null, stamps) - new Date(D().started_at).getTime()) / 60000));
      const over = used - targetMin();
      lines.push('근력 ' + used + '분 · 운동 시간 ' + targetMin() + '분' + (over > 0 ? ' (' + over + '분 초과)' : ''));
    }
    const planned = st.filter((it) => it.status !== 'skipped' || it.auto).reduce((a, it) => a + (it.base_sets || it.target.sets), 0);
    const done = st.reduce((a, it) => a + workDone(it), 0);
    if (planned) lines.push('본세트 ' + done + '/' + planned);
    const by = { up: [], fail: [], wait: [], down: [] };
    st.forEach((it) => {
      if (it.status === 'skipped' || !workDone(it)) return;
      const rec = E.recommend(it.exercise_id, future, S.increments);
      if (by[rec.kind]) by[rec.kind].push(def(it).name + ' ' + E.fmtW(def(it), rec.weight));
    });
    if (by.up.length) lines.push('다음에 무게를 올리는 운동: ' + by.up.join(', '));
    if (by.wait.length) lines.push('횟수는 채웠지만 무거워서 한 번 더 같은 무게: ' + by.wait.join(', '));
    if (by.fail.length) lines.push('횟수를 못 채워 같은 무게로 다시: ' + by.fail.join(', '));
    if (by.down.length) lines.push('두 번 연속 못 채워 무게를 내리는 운동: ' + by.down.join(', '));
    const cut = st.filter((it) => it.auto && it.status === 'skipped').map((it) => def(it).name);
    if (cut.length) lines.push('시간에 맞춰 뺀 운동: ' + cut.join(', '));
    const short = st.filter((it) => it.status !== 'skipped' && it.base_sets && workDone(it) < it.base_sets && workDone(it) > 0).map((it) => def(it).name + ' ' + workDone(it) + '/' + it.base_sets);
    if (short.length) lines.push('세트를 덜 한 운동: ' + short.join(', '));
    if (!lines.length) return '';
    return '<div class="card memo-card"><span class="label">오늘 정리</span><ul class="digest">' + lines.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  }

  function summaryHTML() {
    const log = buildLog();
    const future = S.sessions.concat([log]);
    const rows = items().map((it) => {
      const d = def(it);
      if (it.status === 'skipped' || !it.sets.length) {
        return '<li class="sum is-skipped"><span class="row__name">' + esc(d.name) + '<span class="tag">' + (it.status === 'skipped' ? '생략' : '기록 없음') + '</span></span></li>';
      }
      let lines;
      if (E.isTimed(d)) lines = E.fmtMin(it.target.duration_sec);
      else lines = it.sets.map((s) => (s.is_warmup ? '웜업 ' : '') + setText(d, s)).join(', ');
      const rec = E.recommend(it.exercise_id, future, S.increments);
      const recText = E.isTimed(d) ? E.fmtMin(rec.duration_sec) : E.fmtW(d, rec.weight) + ' × ' + rec.reps + '회 × ' + rec.sets + '세트';
      return '<li class="sum"><span class="row__name">' + esc(d.name) + '</span><span class="row__sub">' + esc(lines) + '</span>' +
        (it.note ? '<span class="row__sub">메모: ' + esc(it.note) + '</span>' : '') +
        '<span class="row__reason">다음 ' + esc(recText) + '</span></li>';
    }).join('');
    return topbar('세션 요약', log.date + ' · ' + Math.round(log.duration_sec / 60) + '분', '<button type="button" class="btn btn--ghost btn--sm" data-act="sum-back">돌아가기</button>') +
      '<section class="stack">' + digestHTML(future) + '<ol class="rows">' + rows + '</ol>' +
      '<label class="field"><span class="label">체중 (kg)</span><input class="input" type="number" inputmode="decimal" step="0.1" id="bw" value="' + esc(log.bodyweight_kg == null ? '' : log.bodyweight_kg) + '"></label>' +
      '<label class="field"><span class="label">메모</span><textarea class="input" id="notes" rows="3">' + esc(log.notes || '') + '</textarea></label>' +
      '<button type="button" class="btn btn--primary btn--lg" data-act="sum-save">저장</button></section>';
  }

  function openSheet(kind, arg) {
    ui.sheetKind = kind;
    ui.sheetArg = arg;
    renderSheet();
    if (!sheet.open) sheet.showModal();
  }

  function closeSheet() {
    if (sheet.open) sheet.close();
    ui.sheetKind = null;
    ui.formKey = null;
  }

  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  sheet.addEventListener('close', () => { ui.sheetKind = null; ui.formKey = null; sheet.innerHTML = ''; });

  function sheetHead(title) {
    return '<div class="sheet__head"><h2>' + esc(title) + '</h2><button type="button" class="btn btn--ghost btn--sm" data-act="close-sheet">닫기</button></div>';
  }

  function renderSheet() {
    const k = ui.sheetKind;
    const key = k + ':' + ui.sheetArg;
    const saved = {};
    if (ui.formKey === key) sheet.querySelectorAll('input,select,textarea').forEach((el) => { saved[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
    ui.formKey = key;
    let html = '';
    if (k === 'swap' || k === 'add') {
      html = sheetHead(k === 'swap' ? '운동 대체' : '운동 추가') + pickerHTML(k, ui.sheetArg);
    } else if (k === 'set') {
      html = sheetHead('세트 수정') + setFormHTML(ui.sheetArg);
    } else if (k === 'note') {
      html = sheetHead(def(cur()).name + ' 메모') + '<div class="stack-sm">' +
        '<label class="field"><span class="label">오늘 메모</span><textarea class="input" id="exNote" rows="4">' + esc(cur().note || '') + '</textarea></label>' +
        '<button type="button" class="btn btn--primary" data-act="note-save">저장</button></div>';
    } else if (k === 'exset') {
      html = sheetHead(def(cur()).name + ' 설정') + exSetHTML(cur());
    } else if (k === 'settings') {
      html = sheetHead('설정') + settingsHTML();
    }
    sheet.innerHTML = '<div class="sheet__body">' + html + '</div>';
    sheet.querySelectorAll('input,select,textarea').forEach((el) => {
      if (!(el.id in saved)) return;
      if (el.type === 'checkbox') el.checked = saved[el.id]; else el.value = saved[el.id];
    });
  }

  function pickerHTML(kind, u) {
    const all = window.Catalog.ids().filter(E.pickable);
    let top = [];
    let self = null;
    if (kind === 'swap') {
      const it = items()[idxOf(u)];
      self = it.exercise_id;
      const p = def(it).pattern;
      top = all.filter((id) => get(id).pattern === p);
      if (it.slot != null && window.TEMPLATES[D().session_type]) {
        const slot = window.TEMPLATES[D().session_type].slots[it.slot];
        if (slot) E.candidates(slot).forEach((id) => { if (top.indexOf(id) < 0) top.push(id); });
      }
      top = top.filter((id) => id !== self).sort((a, b) => get(a).difficulty - get(b).difficulty);
    }
    const rest = all.filter((id) => id !== self && top.indexOf(id) < 0);
    const pick = (id, showPattern) => '<li><button type="button" class="pick" data-act="pick" data-id="' + id + '">' +
      '<span>' + esc(get(id).name) + (isNew(id) ? '<span class="tag">미측정</span>' : '') + '</span>' +
      (showPattern ? '<span class="muted small">' + esc(E.PATTERN_NAME[get(id).pattern]) + '</span>' : '') + '</button></li>';
    let html = '';
    if (top.length) html += '<div class="stack-sm"><p class="label">대체 후보</p><ul class="picks">' + top.map((id) => pick(id, true)).join('') + '</ul></div>';
    E.PATTERN_ORDER.forEach((p) => {
      const ids = rest.filter((id) => get(id).pattern === p);
      if (!ids.length) return;
      html += '<div class="stack-sm"><p class="label">' + esc(E.PATTERN_NAME[p]) + '</p><ul class="picks">' + ids.map((id) => pick(id, false)).join('') + '</ul></div>';
    });
    return html || '<p class="muted">바꿀 수 있는 운동이 없어요.</p>';
  }

  function isNew(id) {
    return !E.hasWeightFor(id, S.sessions);
  }

  function numField(id, labelHTML, kg) {
    const has = kg != null && kg !== '';
    const shown = has ? E.kgToDisp(kg, 2) : '';
    return '<label class="field">' + labelHTML + '<input class="input" id="' + id + '" type="number" inputmode="decimal" step="any" min="0" value="' + esc(shown) + '" data-shown="' + esc(shown) + '" data-kg="' + (has ? esc(kg) : '') + '"></label>';
  }

  function weightField(id, label, kg) {
    return numField(id, '<span class="head-row"><span class="label">' + label + ' (' + S.settings.weight_unit + ')</span>' + unitBtn() + '</span>', kg);
  }

  function fieldKg(id) {
    const el = document.getElementById(id);
    if (!el || el.value === '') return null;
    if (el.value === el.dataset.shown && el.dataset.kg !== '') return Number(el.dataset.kg);
    const n = Number(el.value);
    return isFinite(n) ? E.dispToKg(n) : NaN;
  }

  function exSetHTML(it) {
    const d = def(it);
    const needs = !E.hasWeightFor(it.exercise_id, S.sessions);
    const wl = (needs ? '시작 ' : '지금 ') + (d.load === 'assist' ? '보조 무게' : '무게');
    return '<div class="stack-sm">' +
      weightField('xW', wl, it.target.weight_kg) +
      numField('xI', '<span class="label">증량 폭 (' + S.settings.weight_unit + ')</span>', Math.abs(d.increment)) +
      '<button type="button" class="btn btn--primary" data-act="xset-save">저장</button></div>';
  }

  function setFormHTML(i) {
    const it = cur();
    const d = def(it);
    const s = it.sets[i];
    return '<div class="stack-sm">' +
      weightField('fW', d.load === 'assist' ? '보조 무게' : '무게', s.weight_kg) +
      '<label class="field"><span class="label">횟수</span><input class="input" id="fR" type="number" inputmode="numeric" min="0" value="' + s.reps + '"></label>' +
      '<label class="check"><input type="checkbox" id="fWu"' + (s.is_warmup ? ' checked' : '') + '> 웜업 세트</label>' +
      '<label class="field"><span class="label">체감</span><select class="select" id="fF"><option value="">없음</option>' +
      Object.keys(FEEL).map((k) => '<option value="' + k + '"' + (s.feel === k ? ' selected' : '') + '>' + FEEL[k] + '</option>').join('') + '</select></label>' +
      '<label class="field"><span class="label">메모</span><input class="input" id="fN" type="text" value="' + esc(s.note || '') + '"></label>' +
      '<button type="button" class="btn btn--primary" data-act="set-save" data-i="' + i + '">저장</button>' +
      '<button type="button" class="btn btn--danger" data-act="set-del" data-i="' + i + '">세트 삭제</button></div>';
  }

  function settingsHTML() {
    const st = S.settings;
    const last = S.sessions[S.sessions.length - 1];
    return '<div class="stack-sm">' +
      '<label class="field"><span class="label">체중 (kg)</span><input class="input" id="sBw" type="number" inputmode="decimal" step="0.1" value="' + esc(st.bodyweight_kg == null ? '' : st.bodyweight_kg) + '"></label>' +
      '<label class="check"><input type="checkbox" id="sSound"' + (st.sound ? ' checked' : '') + '> 휴식 끝 소리</label>' +
      '<button type="button" class="btn btn--primary" data-act="settings-save">설정 저장</button>' +
      '<hr><p class="muted small">저장된 세션 ' + S.sessions.length + '개' + (last ? ' · 최근 ' + esc(last.date) : '') + '</p>' +
      '<button type="button" class="btn" data-act="export">기록 내보내기 (JSON)</button>' +
      '<button type="button" class="btn" data-act="import">기록 가져오기 (JSON)</button>' +
      '<button type="button" class="btn btn--danger" data-act="wipe">모든 데이터 지우기</button></div>';
  }

  function backToExercise() {
    ui.screen = 'main';
    ui.editing = false;
    if (ui.phase === 'rest' && !ui.timer.running && ui.timer.remaining <= 0 && ui.timer.total) { ui.phase = 'input'; ui.feelIdx = null; }
    window.scrollTo(0, 0);
  }

  function setTime(min) {
    D().target_sec = Math.max(10, Math.min(120, min)) * 60;
    S.settings.target_sec = D().target_sec;
    fitToTime(true);
    save(true);
  }

  function goTo(it) {
    window.scrollTo(0, 0);
    D().current = it.uid;
    ui.phase = ui.timer.running ? 'rest' : 'input';
    ui.feelIdx = null;
    ui.msg = '';
    resetCounters(it);
    ui.askWeight = unmeasured(it);
  }

  const A = {
    'new-session'(ds) {
      const date = today();
      const recs = E.buildSession(ds.type, S.sessions, date, S.increments);
      S.draft = { id: uid(), date, session_type: ds.type, phase: 'plan', current: null, items: recs.map(makeItem), target_sec: S.settings.target_sec };
      fitToTime(true);
      save();
    },
    'plan-cancel'() {
      if (!confirm('이 세션 계획을 버릴까요?')) return;
      S.draft = null;
      save();
    },
    abandon() {
      if (!confirm('이번 세션 기록을 모두 버리고 첫 화면으로 갈까요?')) return;
      closeSheet();
      S.draft = null;
      ui.screen = 'main';
      ui.timer.running = false;
      if (wakeLock) wakeLock.release();
      save();
    },
    time(ds) { setTime(targetMin() + 5 * Number(ds.dir)); },
    'time-edit'() {
      const v = prompt('운동 시간 (분)', targetMin());
      if (v == null || v.trim() === '' || isNaN(Number(v))) return;
      setTime(Math.round(Number(v)));
    },
    'plan-start'() {
      const first = items().find((x) => x.status === 'pending');
      if (!first) return toast('남은 운동이 없어요');
      D().phase = 'active';
      D().started_at = new Date().toISOString();
      ui.screen = 'main';
      goTo(first);
      ui.phase = 'input';
      save();
      keepAwake();
    },
    skip(ds) {
      const it = items()[idxOf(ds.uid)];
      if (it.status === 'skipped') { it.status = it.sets.length ? 'done' : 'pending'; it.keep = true; it.auto = false; fitToTime(true); save(); return; }
      if (it.sets.length && !confirm('기록이 있는 운동이에요. 생략할까요? (기록은 저장되지 않아요)')) return;
      it.status = 'skipped';
      if (D().phase === 'active' && D().current === it.uid) {
        const nx = nextPending(it.uid);
        if (nx) goTo(nx);
        else { it.status = 'pending'; return toast('마지막 운동은 생략하지 말고 세션을 종료하세요'); }
      }
      fitToTime(true);
      save();
    },
    swap(ds) {
      const it = items()[idxOf(ds.uid)];
      if (it.sets.length) return toast('기록이 있는 운동은 대체할 수 없어요. 생략하고 추가하세요');
      openSheet('swap', ds.uid);
    },
    add() { openSheet('add'); },
    pick(ds) {
      if (ui.sheetKind === 'swap') {
        const i = idxOf(ui.sheetArg);
        items()[i] = retarget(items()[i], ds.id);
        if (D().phase === 'active' && D().current === items()[i].uid) resetCounters(items()[i]);
      } else {
        const rec = E.recommend(ds.id, S.sessions, S.increments);
        const it = makeItem(Object.assign(rec, { slot: null, priority: 'main' }));
        const list = items();
        if (D().phase === 'active') list.splice(idxOf(D().current) + 1, 0, it);
        else list.push(it);
      }
      fitToTime(true);
      save();
      closeSheet();
    },
    jump(ds) {
      const it = items()[idxOf(ds.uid)];
      if (it.uid !== D().current) goTo(it);
      save();
      backToExercise();
    },
    'open-list'() { ui.screen = 'list'; ui.editing = false; ui.scrollToCur = true; },
    'back-ex'() { backToExercise(); },
    'list-edit'() { ui.editing = !ui.editing; ui.scrollToCur = true; },
    'close-sheet'() { closeSheet(); },
    w(ds) {
      const it = cur();
      const d = def(it);
      const dir = Number(ds.dir);
      const now = Number(it.target.weight_kg || 0);
      it.target.weight_kg = S.settings.weight_unit === 'lbs'
        ? Math.max(0, E.dispToKg(E.kgToDisp(now) + 5 * dir))
        : Math.max(0, E.round(now + Math.abs(d.increment || 1) * dir));
      save();
    },
    'w-edit'() { openSheet('exset'); },
    'xset-save'() {
      const it = cur();
      const id = it.exercise_id;
      const base = get(id);
      const incv = fieldKg('xI');
      const inc = incv == null ? NaN : incv;
      const w = fieldKg('xW');
      if (!(inc > 0)) return toast('증량 폭을 입력해 주세요');
      if (w != null && !(w >= 0)) return toast('무게를 확인해 주세요');
      const needs = !E.hasWeightFor(id, S.sessions);
      if (needs && !(w > 0)) return toast('시작 무게를 입력해 주세요');
      if (Math.abs(inc - base.increment) > 1e-9) S.increments[id] = inc; else delete S.increments[id];
      items().forEach((i) => {
        if (i.exercise_id !== id || i.sets.length || w == null) return;
        if (needs || i.uid === it.uid) i.target.weight_kg = w;
      });
      save(true);
      closeSheet();
    },
    'unit-toggle'() {
      const ids = ['xW', 'xI', 'fW'];
      const kgs = ids.map(fieldKg);
      const next = S.settings.weight_unit === 'kg' ? 'lbs' : 'kg';
      S.settings.weight_unit = next;
      E.setUnit(next);
      ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && kgs[i] != null && isFinite(kgs[i])) el.value = E.kgToDisp(kgs[i], 2);
      });
      save(true);
    },
    'tap-full'() { remember(); ui.reps++; },
    'tap-fill'() { remember(); ui.reps += cur().target.reps; },
    'tap-undo'() { const h = undoStack.pop(); if (h) Object.assign(ui, h); },
    record() {
      const it = cur();
      const reps = ui.reps;
      if (it.target.weight_kg == null) { toast('무게를 먼저 입력해 주세요'); return openSheet('exset'); }
      if (!reps) return toast('횟수를 먼저 입력해 주세요');
      const set = { weight_kg: E.dispToKg(E.kgToDisp(it.target.weight_kg, 2)), reps, is_warmup: false, at: new Date().toISOString() };
      const prev = it.sets.filter((s) => !s.is_warmup).pop();
      ui.msg = '';
      if (!set.is_warmup && prev && prev.reps > 0 && reps <= prev.reps * 0.6) ui.msg = '직전 세트보다 40% 넘게 줄었어요. 여기서 마무리해도 좋아요.';
      it.sets.push(set);
      const fit = fitToTime();
      const said = [];
      if (fit.cut.length) said.push('뺀 운동: ' + fit.cut.join(', '));
      if (fit.trimmed.length) said.push('세트를 줄인 운동: ' + fit.trimmed.join(', '));
      if (said.length) ui.msg = (ui.msg ? ui.msg + ' ' : '') + '운동 시간에 맞췄어요. ' + said.join(' · ') + '.';
      ui.feelIdx = it.sets.length - 1;
      ui.phase = 'rest';
      resetCounters(it);
      startTimer(def(it).rest_sec);
      save();
    },
    feel(ds) {
      const it = cur();
      const s = it.sets[ui.feelIdx];
      ui.feelIdx = null;
      if (!s) return;
      if (ds.v) s.feel = ds.v; else delete s.feel;
      save();
    },
    't-toggle'() {
      const t = ui.timer;
      if (t.running) { t.remaining = timerLeft(); t.running = false; }
      else {
        const sec = t.remaining > 0 ? t.remaining : (t.total || def(cur()).rest_sec);
        if (!t.total) t.total = sec;
        t.endsAt = Date.now() + sec * 1000;
        t.running = true;
      }
    },
    't-reset'() {
      const t = ui.timer;
      if (!t.total) t.total = def(cur()).rest_sec;
      t.remaining = t.total;
      if (t.running) t.endsAt = Date.now() + t.total * 1000;
    },
    't-add'() {
      const t = ui.timer;
      if (t.running) t.endsAt += 30000;
      else t.remaining += 30;
      t.total += 30;
    },
    'next-set'() {
      ui.phase = 'input';
      ui.feelIdx = null;
      ui.msg = '';
      resetCounters(cur());
    },
    'next-ex'() {
      const it = cur();
      const nx = nextPending(it.uid);
      it.status = 'done';
      if (!nx) return A.finish();
      goTo(nx);
      save();
    },
    finish() {
      if (!confirm('세션을 끝내고 요약으로 갈까요?')) return;
      const it = cur();
      if (it && (it.sets.length)) it.status = 'done';
      closeSheet();
      ui.screen = 'summary';
      window.scrollTo(0, 0);
      save();
    },
    dur(ds) {
      const it = cur();
      it.target.duration_sec = Math.max(60, (it.target.duration_sec || 0) + 60 * Number(ds.dir));
      save();
    },
    'dur-edit'() {
      const it = cur();
      const v = prompt('시간 (분)', it.target.duration_sec == null ? '' : Math.round(it.target.duration_sec / 60));
      if (v == null || v.trim() === '' || isNaN(Number(v))) return;
      it.target.duration_sec = Math.max(60, Math.round(Number(v)) * 60);
      save();
    },
    'cardio-done'() {
      const it = cur();
      it.sets = [{ duration_sec: it.target.duration_sec }];
      it.status = 'done';
      save();
      toast(def(it).name + ' ' + E.fmtMin(it.target.duration_sec) + ' 기록');
    },
    'note-edit'() { openSheet('note'); },
    'note-save'() {
      cur().note = document.getElementById('exNote').value.trim();
      save();
      closeSheet();
    },
    'edit-set'(ds) { openSheet('set', Number(ds.i)); },
    'set-save'(ds) {
      const it = cur();
      const s = it.sets[Number(ds.i)];
      const w = fieldKg('fW');
      const reps = parseInt(document.getElementById('fR').value, 10);
      if (!(reps >= 1)) return toast('횟수를 확인해 주세요');
      if (w != null && isFinite(w)) s.weight_kg = w;
      s.reps = reps;
      s.is_warmup = document.getElementById('fWu').checked;
      const feel = document.getElementById('fF').value;
      if (feel) s.feel = feel; else delete s.feel;
      const memo = document.getElementById('fN').value.trim();
      if (memo) s.note = memo; else delete s.note;
      save();
      closeSheet();
    },
    'set-del'(ds) {
      if (!confirm('이 세트를 삭제할까요?')) return;
      const it = cur();
      it.sets.splice(Number(ds.i), 1);
      if (ui.feelIdx != null) ui.feelIdx = null;
      save();
      closeSheet();
    },
    'sum-back'() {
      ui.screen = 'main';
      const it = cur();
      if (it) it.status = 'pending';
      ui.phase = 'rest';
    },
    'sum-save'() {
      const bw = document.getElementById('bw').value;
      D().bodyweight_kg = bw === '' ? null : Number(bw);
      D().notes = document.getElementById('notes').value;
      if (!confirm('이 세션을 기록으로 저장할까요?')) return;
      const log = buildLog();
      if (log.bodyweight_kg != null) S.settings.bodyweight_kg = log.bodyweight_kg;
      S.sessions.push(log);
      S.sessions.sort(Dt.sessionOrder);
      S.draft = null;
      ui.screen = 'main';
      ui.timer.running = false;
      if (wakeLock) wakeLock.release();
      save(true);
      toast('저장했어요');
    },
    settings() { openSheet('settings'); },
    'settings-save'() {
      const bw = document.getElementById('sBw').value;
      S.settings.bodyweight_kg = bw === '' ? null : Number(bw);
      S.settings.sound = document.getElementById('sSound').checked;
      save(true);
      closeSheet();
      toast('설정을 저장했어요');
    },
    export() {
      const data = { version: Dt.VERSION, exported_at: new Date().toISOString(), settings: S.settings, increments: S.increments, sessions: S.sessions };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'workout_export_' + today() + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    import() { importFile.click(); },
    wipe() {
      if (!confirm('세션 기록·진행 중 세션·설정을 모두 지울까요? 되돌릴 수 없어요.')) return;
      if (!confirm('정말 지울까요? 먼저 내보내기를 해 두는 것을 권해요.')) return;
      S = Dt.emptyStore();
      E.setUnit('kg');
      save(true);
      closeSheet();
    },
  };


  importFile.addEventListener('change', () => {
    const f = importFile.files[0];
    importFile.value = '';
    if (!f) return;
    f.text().then((txt) => {
      let data;
      try { data = JSON.parse(txt); } catch (e) { return toast('JSON을 읽지 못했어요'); }
      const r = Dt.parseImport(data, window.Catalog);
      if (r.error) return toast(r.error);
      const nInc = Object.keys(r.increments).length;
      const nSet = r.settings ? Object.keys(r.settings).length : 0;
      if (!r.sessions.length && !nInc && !nSet) return toast('가져올 세션이 없어요');
      const merged = Dt.mergeSessions(S.sessions, r.sessions);
      let msg = '세션 ' + r.sessions.length + '개' + (nInc ? '와 운동 설정 ' + nInc + '개' : '') + (nSet ? '와 앱 설정' : '') + '를 가져올까요?';
      if (merged.replaced) msg += ' 같은 세션 ' + merged.replaced + '개는 덮어씁니다.';
      if (r.skipped.length) msg += ' 형식이 맞지 않아 건너뛰는 세션 ' + r.skipped.length + '개.';
      if (r.unknown.length) msg += ' 카탈로그에 없는 운동 ' + r.unknown.length + '개(' + r.unknown.join(', ') + ')는 기록만 보관합니다.';
      if (nSet) msg += ' 앱 설정도 덮어씁니다.';
      if (!confirm(msg)) return;
      Object.assign(S.increments, r.increments);
      S.sessions = merged.sessions;
      if (r.settings) {
        Object.assign(S.settings, r.settings);
        E.setUnit(S.settings.weight_unit);
      }
      save(true);
      closeSheet();
      render();
      toast('세션 ' + r.sessions.length + '개를 가져왔어요');
    });
  });

  function dispatch(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    if (e.type === 'change' && el.tagName !== 'SELECT') return;
    if (e.type === 'click' && el.tagName === 'SELECT') return;
    const fn = A[act];
    if (!fn) return;
    fn(el.dataset, el);
    render();
  }

  document.addEventListener('click', dispatch);
  document.addEventListener('change', dispatch);

  if (S.draft && S.draft.phase === 'active') {
    const it = cur();
    if (!it) S.draft.current = (S.draft.items.find((x) => x.status === 'pending') || S.draft.items[0]).uid;
    const c = cur();
    resetCounters(c);
    ui.phase = c.sets.length || S.draft.items.some((x) => x.sets.length) ? 'rest' : 'input';
    ui.timer.total = def(c).rest_sec || 0;
    ui.timer.remaining = ui.timer.total;
    ui.askWeight = unmeasured(c) && !c.sets.length;
    keepAwake();
  }
  save(true);
  render();
})();
