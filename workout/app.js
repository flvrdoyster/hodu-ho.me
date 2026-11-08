(function () {
  const C = window.CATALOG;
  const E = window.Engine;
  const KEY = 'workout_v1';
  const app = document.getElementById('app');
  const sheet = document.getElementById('sheet');
  const toastEl = document.getElementById('toast');
  const importFile = document.getElementById('importFile');

  const FEEL = { light: '가벼움', ok: '적당', heavy: '무거움' };
  const STATUS = { pending: '대기', done: '완료', skipped: '생략' };

  let S = load();
  const undoStack = [];
  const ui = {
    screen: 'main', phase: 'input', feelIdx: null, msg: '',
    reps: 0, filled: false, editing: false, sheetKind: null, sheetArg: null,
    timer: { running: false, endsAt: 0, remaining: 0, total: 0 },
  };

  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
    d = d || {};
    return {
      sessions: Array.isArray(d.sessions) ? d.sessions : [],
      draft: d.draft || null,
      settings: Object.assign({ bodyweight_kg: null, sound: true, target_min: 35 }, d.settings),
    };
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('저장 공간에 쓰지 못했어요'); }
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
    return {
      uid: uid(), exercise_type: rec.exercise_type, slot: rec.slot, priority: rec.priority || 'main',
      status: 'pending',
      target: { weight: rec.weight, reps: rec.reps, sets: rec.sets, rest_sec: rec.rest_sec, duration: rec.duration },
      reason: rec.reason,
      cur_weight: rec.weight, duration_min: rec.duration != null ? rec.duration : null,
      sets: [], note: '',
    };
  }

  function retarget(it, id) {
    const rec = E.recommend(id, S.sessions);
    const fresh = makeItem(Object.assign(rec, { slot: it.slot, priority: it.priority }));
    fresh.uid = it.uid;
    fresh.status = it.status;
    return fresh;
  }

  const D = () => S.draft;
  const items = () => D().items;
  const idxOf = (u) => items().findIndex((x) => x.uid === u);
  const cur = () => items()[idxOf(D().current)];
  const def = (it) => C[it.exercise_type];
  const workDone = (it) => it.sets.filter((s) => !s.is_warmup).length;
  const isCardio = (it) => def(it).unit === 'min';

  function nextPending(fromUid) {
    const list = items();
    const i = idxOf(fromUid);
    for (let k = i + 1; k < list.length; k++) if (list[k].status === 'pending' && list[k].uid !== fromUid) return list[k];
    for (let k = 0; k < i; k++) if (list[k].status === 'pending') return list[k];
    return null;
  }

  function targetText(it) {
    const d = def(it);
    if (d.unit === 'min') return it.target.duration + '분';
    return E.fmtW(d, it.target.weight) + ' × ' + it.target.reps + '회 × ' + it.target.sets + '세트';
  }

  function setText(d, s) {
    return E.fmtW(d, s.weight) + ' × ' + s.reps + '회';
  }

  function weightSub(d, w) {
    const parts = [];
    if (d.weight_basis === 'per_side') parts.push('한 쪽');
    const c = E.convert(d, w);
    if (c) parts.push(c);
    return parts.join(' · ');
  }

  const strength = (it) => it.status !== 'skipped' && !isCardio(it);

  function elapsedSec() {
    return D().started_at ? Math.max(0, (Date.now() - new Date(D().started_at).getTime()) / 1000) : 0;
  }

  function leftSec(it) {
    return Math.max(0, it.target.sets - workDone(it)) * (it.target.rest_sec + 40);
  }

  function projectedSec() {
    return elapsedSec() + items().filter(strength).reduce((a, it) => a + leftSec(it), 0);
  }

  function fitToTime() {
    const limit = S.settings.target_min * 60;
    let over = projectedSec() - limit;
    const cut = [];
    ['optional', 'main'].forEach((pr) => {
      items().slice().reverse().forEach((it) => {
        if (over <= 0 || !strength(it) || it.priority !== pr || it.keep || it.sets.length || it.uid === D().current) return;
        it.status = 'skipped';
        over -= leftSec(it);
        cut.push(def(it).name);
      });
    });
    return cut;
  }

  const timeUp = () => D().phase === 'active' && elapsedSec() >= S.settings.target_min * 60;

  function remember() { undoStack.push({ reps: ui.reps, filled: ui.filled }); }

  function resetCounters(it) {
    ui.reps = 0;
    ui.filled = false;
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

  const elapsedText = () => Math.floor(elapsedSec() / 60) + '/' + S.settings.target_min + '분';

  const mmss = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  setInterval(() => {
    const clock = document.getElementById('elapsed');
    if (clock && S.draft) {
      clock.textContent = elapsedText();
      clock.classList.toggle('is-over', timeUp());
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

  function topbar(title, sub, right) {
    return '<header class="topbar"><div class="topbar__title"><h1>' + esc(title) + '</h1>' + (sub ? '<p class="topbar__sub">' + esc(sub) + '</p>' : '') + '</div>' + (right || '') + '</header>';
  }

  const settingsBtn = '<button type="button" class="btn btn--ghost btn--sm" data-act="settings">설정</button>';

  function homeHTML() {
    const last = S.sessions[S.sessions.length - 1];
    let lastHTML = '<p class="muted">아직 기록이 없어요. 설정에서 이전 기록을 가져올 수 있어요.</p>';
    if (last) {
      const names = (last.exercises || []).map((e) => (C[e.exercise_type] ? C[e.exercise_type].name : e.exercise_type)).join(', ');
      lastHTML = '<p class="label">지난 세션</p><p><strong>' + esc(last.date) + '</strong> · ' + esc(tplName(last.session_type)) + (last.duration_min ? ' · ' + last.duration_min + '분' : '') + '</p><p class="muted small">' + esc(names) + '</p>';
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
      const sub = live && it.sets.length ? doneText(it) : targetText(it);
      const jumpable = mode === 'list' && it.status !== 'skipped';
      const main = '<span class="row__name">' + esc(d.name) + status + '</span>' +
        '<span class="row__sub">' + esc(sub) + '</span>' +
        (mode === 'plan' && it.status !== 'skipped' ? '<span class="row__reason">' + esc(it.reason) + '</span>' : '');
      return '<li class="row' + (it.status === 'skipped' ? ' is-skipped' : '') + (isCur ? ' is-current' : '') + '"' + (isCur ? ' id="curRow"' : '') + '>' +
        (jumpable
          ? '<button type="button" class="row__main row__main--btn" data-act="jump" data-uid="' + it.uid + '"><span class="row__text">' + main + '</span><span aria-hidden="true">›</span></button>'
          : '<div class="row__main"><span class="row__text">' + main + '</span></div>') +
        (mode === 'list' ? '</li>' : '<div class="row__tools">' +
        '<button type="button" class="btn btn--sm" data-act="swap" data-uid="' + it.uid + '">대체</button>' +
        '<button type="button" class="btn btn--sm" data-act="skip" data-uid="' + it.uid + '">' + (it.status === 'skipped' ? '복원' : '생략') + '</button>' +
        '<button type="button" class="btn btn--icon row__handle" aria-label="끌어서 순서 바꾸기">≡</button>' +
        '</div></li>');
    }).join('') + '</ol>';
  }

  function doneText(it) {
    const d = def(it);
    if (d.unit === 'min') return it.duration_min + '분';
    const ws = it.sets.filter((x) => !x.is_warmup);
    if (!ws.length) return '웜업 ' + it.sets.length + '세트';
    const w = ws[0].weight;
    if (ws.some((x) => x.weight !== w)) return ws.map((x) => setText(d, x)).join(', ');
    const reps = ws.map((x) => x.reps);
    const same = reps.every((x) => x === reps[0]);
    return E.fmtW(d, w) + ' × ' + (same ? reps[0] + '회 × ' + ws.length + '세트' : reps.join('/') + '회');
  }

  function listHTML() {
    const editing = ui.editing;
    const done = items().filter((x) => x.status === 'done').length;
    const active = items().filter((x) => x.status !== 'skipped').length;
    return '<header class="topbar topbar--fixed">' +
      '<button type="button" class="btn btn--ghost btn--sm topbar__back" data-act="back-ex">‹ 운동으로</button>' +
      '<h1 class="topbar__title topbar__title--one">세션 목록 <span class="topbar__sub">' + done + '/' + active + ' 완료</span></h1>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-act="list-edit">' + (editing ? '완료' : '편집') + '</button></header>' +
      '<section class="stack">' + rowsHTML(editing ? 'edit' : 'list') +
      '<button type="button" class="btn" data-act="add">운동 추가</button>' +
      '<button type="button" class="btn" data-act="finish">세션 종료</button>' +
      '<button type="button" class="btn btn--danger" data-act="abandon">기록 버리고 처음으로</button></section>';
  }

  function planHTML() {
    const min = E.estimateMin(items().filter((x) => !isCardio(x)));
    return topbar(tplName(D().session_type) + ' 세션', D().date + ' · 근력 예상 ' + min + '분 · 목표 ' + S.settings.target_min + '분', '<button type="button" class="btn btn--ghost btn--sm" data-act="plan-cancel">취소</button>') +
      '<section class="stack">' + rowsHTML('plan') +
      '<button type="button" class="btn" data-act="add">운동 추가</button>' +
      '<button type="button" class="btn btn--primary btn--lg" data-act="plan-start">시작</button></section>';
  }

  function exerciseHTML() {
    const it = cur();
    const d = def(it);
    const active = items().filter((x) => x.status !== 'skipped');
    const pos = active.findIndex((x) => x.uid === it.uid) + 1;
    const nx = nextPending(it.uid);

    const progress = '<button type="button" class="progress" data-act="open-list">' +
      '<span class="progress__count">운동 ' + pos + '/' + active.length + '</span>' +
      '<span class="progress__next">' + (nx ? '다음 ' + esc(def(nx).name) : '마지막 운동') + '</span>' +
      '<span class="progress__time' + (timeUp() ? ' is-over' : '') + '" id="elapsed">' + elapsedText() + '</span><span aria-hidden="true">›</span></button>';

    const card = '<div class="card ex"><h2>' + esc(d.name) + '</h2>' + targetsHTML(it, d) + setsHTML(it) + '</div>';

    const panel = ui.phase === 'rest' ? restHTML(it, nx) : inputHTML(it);
    return '<section class="stack">' + progress + card + panel + prevHTML(it) + '</section>';
  }

  function stepper(label, act, val, note) {
    return '<div class="tgt tgt--wide"><span class="label">' + label + '</span>' +
      '<div class="stepper"><button type="button" class="btn btn--icon" data-act="' + act + '" data-dir="-1" aria-label="' + label + ' 줄이기">−</button>' +
      '<button type="button" class="stepper__val" data-act="' + act + '-edit">' + esc(val) + '</button>' +
      '<button type="button" class="btn btn--icon" data-act="' + act + '" data-dir="1" aria-label="' + label + ' 늘리기">+</button></div>' +
      (note ? '<span class="muted small">' + esc(note) + '</span>' : '') + '</div>';
  }

  function targetsHTML(it, d) {
    const cell = (label, val) => '<div class="tgt"><span class="label">' + label + '</span><span class="tgt__v">' + esc(val) + '</span></div>';
    if (isCardio(it)) return '<div class="tgts">' + stepper('시간', 'dur', it.duration_min + '분') + '</div>';
    return '<div class="tgts">' + stepper(d.assisted ? '보조 무게' : '무게', 'w', E.round(Number(it.cur_weight)) + d.unit, weightSub(d, it.cur_weight)) +
      cell('횟수', it.target.reps + '회') + cell('세트', it.target.sets + '세트') + '</div>';
  }

  function setsHTML(it) {
    if (!it.sets.length || isCardio(it)) return '';
    const d = def(it);
    let n = 0;
    return '<ol class="sets">' + it.sets.map((s, i) => {
      const label = s.is_warmup ? '웜업' : (++n) + '세트';
      return '<li><button type="button" class="set' + (s.is_warmup ? ' set--warm' : '') + '" data-act="edit-set" data-i="' + i + '">' +
        '<span class="set__n">' + label + '</span>' +
        '<span class="set__v">' + esc(setText(d, s)) + '</span>' +
        (s.feel ? '<span class="set__feel">' + FEEL[s.feel] + '</span>' : '') +
        '</button></li>';
    }).join('') + '</ol>';
  }

  function inputHTML(it) {
    if (isCardio(it)) {
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
    const done = !quiet && (isCardio(it) ? it.sets.length > 0 : workDone(it) >= it.target.sets);
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
      (up ? '<p class="note">목표 시간 ' + S.settings.target_min + '분이 됐어요.</p>' : '') +
      (ui.msg ? '<p class="note">' + esc(ui.msg) + '</p>' : '') +
      '<div class="timer"><span class="label">휴식</span><span class="timer__t" id="timerText">' + mmss(left) + '</span>' +
      '<div class="timer__track"><div class="timer__bar" id="timerBar" style="transform:scaleX(' + (t.total ? left / t.total : 0) + ')"></div></div></div>' +
      '<div class="row3"><button type="button" class="btn" data-act="t-toggle">' + (t.running ? '일시정지' : '시작') + '</button>' +
      '<button type="button" class="btn" data-act="t-reset">리셋</button>' +
      '<button type="button" class="btn" data-act="t-add">+30초</button></div>' +
      (up ? '<button type="button" class="btn btn--primary btn--lg" data-act="finish">세션 종료</button>' : '') +
      (isCardio(it) ? '' : nextSet) + (up && !nx ? '' : navHTML(it, nx, up)) + '</div>';
  }

  function prevHTML(it) {
    const h = E.history(S.sessions, it.exercise_type)[0];
    if (!h) return '';
    const d = def(it);
    let body;
    if (d.unit === 'min') body = '<p>' + h.ex.duration_min + '분</p>';
    else {
      let n = 0;
      body = '<ol class="sets">' + (h.ex.sets || []).map((s) => '<li class="set set--static' + (s.is_warmup ? ' set--warm' : '') + '">' +
        '<span class="set__n">' + (s.is_warmup ? '웜업' : (++n) + '세트') + '</span><span class="set__v">' + esc(setText(d, s)) + '</span>' +
        (s.feel ? '<span class="set__feel">' + FEEL[s.feel] + '</span>' : '') + '</li>').join('') + '</ol>';
    }
    return '<details class="card prev-wrap"><summary>직전 기록 · ' + esc(h.date) + '</summary>' + body + (h.ex.note ? '<p class="muted small">' + esc(h.ex.note) + '</p>' : '') + '</details>';
  }

  function buildLog() {
    const dr = D();
    const exercises = [];
    dr.items.forEach((it) => {
      if (it.status === 'skipped') return;
      const d = def(it);
      if (d.unit === 'min') {
        if (!it.sets.length) return;
        exercises.push({ order: exercises.length + 1, exercise_type: it.exercise_type, equipment: d.equipment, duration_min: it.duration_min, note: it.note || null });
        return;
      }
      if (!it.sets.length) return;
      exercises.push({
        order: exercises.length + 1, exercise_type: it.exercise_type, equipment: d.equipment, equipment_id: null,
        unit: d.unit, weight_basis: d.weight_basis,
        sets: it.sets.map((s, i) => Object.assign({}, s, { set_number: i + 1 })),
        note: it.note || null,
      });
    });
    const started = dr.started_at ? new Date(dr.started_at) : new Date();
    return {
      date: dr.date, session_type: dr.session_type,
      duration_min: Math.max(1, Math.round((Date.now() - started.getTime()) / 60000)),
      bodyweight_kg: dr.bodyweight_kg != null ? dr.bodyweight_kg : S.settings.bodyweight_kg,
      notes: dr.notes || '', exercises,
    };
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
      if (d.unit === 'min') lines = it.duration_min + '분';
      else lines = it.sets.map((s) => (s.is_warmup ? '웜업 ' : '') + setText(d, s)).join(', ');
      const rec = E.recommend(it.exercise_type, future);
      const recText = d.unit === 'min' ? rec.duration + '분' : E.fmtW(d, rec.weight) + ' × ' + rec.reps + '회 × ' + rec.sets + '세트';
      return '<li class="sum"><span class="row__name">' + esc(d.name) + '</span><span class="row__sub">' + esc(lines) + '</span>' +
        '<span class="row__reason">다음 ' + esc(recText) + '</span></li>';
    }).join('');
    return topbar('세션 요약', log.date + ' · ' + log.duration_min + '분', '<button type="button" class="btn btn--ghost btn--sm" data-act="sum-back">돌아가기</button>') +
      '<section class="stack"><ol class="rows">' + rows + '</ol>' +
      '<label class="field"><span class="label">체중 (kg)</span><input class="input" type="number" inputmode="decimal" step="0.1" id="bw" value="' + esc(log.bodyweight_kg == null ? '' : log.bodyweight_kg) + '"></label>' +
      '<label class="field"><span class="label">메모</span><textarea class="input" id="notes" rows="3">' + esc(log.notes) + '</textarea></label>' +
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
  }

  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  sheet.addEventListener('close', () => { ui.sheetKind = null; sheet.innerHTML = ''; });

  function sheetHead(title) {
    return '<div class="sheet__head"><h2>' + esc(title) + '</h2><button type="button" class="btn btn--ghost btn--sm" data-act="close-sheet">닫기</button></div>';
  }

  function renderSheet() {
    const k = ui.sheetKind;
    let html = '';
    if (k === 'swap' || k === 'add') {
      html = sheetHead(k === 'swap' ? '운동 대체' : '운동 추가') + pickerHTML(k, ui.sheetArg);
    } else if (k === 'set') {
      html = sheetHead('세트 수정') + setFormHTML(ui.sheetArg);
    } else if (k === 'settings') {
      html = sheetHead('설정') + settingsHTML();
    }
    sheet.innerHTML = '<div class="sheet__body">' + html + '</div>';
  }

  function pickerHTML(kind, u) {
    let ids;
    if (kind === 'swap') {
      const it = items()[idxOf(u)];
      const p = def(it).pattern;
      ids = Object.keys(C).filter((id) => C[id].pattern === p);
      if (it.slot != null && window.TEMPLATES[D().session_type]) {
        const slot = window.TEMPLATES[D().session_type].slots[it.slot];
        if (slot) E.candidates(slot).forEach((id) => { if (ids.indexOf(id) < 0) ids.push(id); });
      }
      ids = ids.filter((id) => id !== it.exercise_type).sort((a, b) => C[a].difficulty - C[b].difficulty);
    } else {
      ids = Object.keys(C);
    }
    if (!ids.length) return '<p class="muted">바꿀 수 있는 운동이 없어요.</p>';
    return '<ul class="picks">' + ids.map((id) => '<li><button type="button" class="pick" data-act="pick" data-id="' + id + '">' +
      '<span>' + esc(C[id].name) + '</span><span class="muted small">' + esc(E.PATTERN_NAME[C[id].pattern]) + '</span></button></li>').join('') + '</ul>';
  }

  function setFormHTML(i) {
    const it = cur();
    const d = def(it);
    const s = it.sets[i];
    const weight = '<input class="input" id="fW" type="number" inputmode="decimal" step="any" value="' + esc(s.weight) + '">';
    return '<div class="stack-sm">' +
      '<label class="field"><span class="label">' + (d.assisted ? '보조 무게' : '무게') + ' (' + d.unit + ')</span>' + weight + '</label>' +
      '<label class="field"><span class="label">횟수</span><input class="input" id="fR" type="number" inputmode="numeric" min="0" value="' + s.reps + '"></label>' +
      '<label class="check"><input type="checkbox" id="fWu"' + (s.is_warmup ? ' checked' : '') + '> 웜업 세트</label>' +
      '<label class="field"><span class="label">체감</span><select class="select" id="fF"><option value="">없음</option>' +
      Object.keys(FEEL).map((k) => '<option value="' + k + '"' + (s.feel === k ? ' selected' : '') + '>' + FEEL[k] + '</option>').join('') + '</select></label>' +
      '<button type="button" class="btn btn--primary" data-act="set-save" data-i="' + i + '">저장</button>' +
      '<button type="button" class="btn btn--danger" data-act="set-del" data-i="' + i + '">세트 삭제</button></div>';
  }

  function settingsHTML() {
    const st = S.settings;
    const last = S.sessions[S.sessions.length - 1];
    return '<div class="stack-sm">' +
      '<label class="field"><span class="label">체중 (kg)</span><input class="input" id="sBw" type="number" inputmode="decimal" step="0.1" value="' + esc(st.bodyweight_kg == null ? '' : st.bodyweight_kg) + '"></label>' +
      '<label class="field"><span class="label">근력 운동 목표 시간 (분)</span><input class="input" id="sTarget" type="number" inputmode="numeric" min="10" step="5" value="' + S.settings.target_min + '"></label>' +
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

  function goTo(it) {
    D().current = it.uid;
    ui.phase = ui.timer.running ? 'rest' : 'input';
    ui.feelIdx = null;
    ui.msg = '';
    resetCounters(it);
  }

  const A = {
    'new-session'(ds) {
      const date = today();
      const recs = E.buildSession(ds.type, S.sessions, date);
      S.draft = { id: uid(), date, session_type: ds.type, phase: 'plan', current: null, items: recs.map(makeItem), notes: '' };
      fitToTime();
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
      if (it.status === 'skipped') { it.status = it.sets.length ? 'done' : 'pending'; it.keep = true; save(); return; }
      if (it.sets.length && !confirm('기록이 있는 운동이에요. 생략할까요? (기록은 저장되지 않아요)')) return;
      it.status = 'skipped';
      if (D().phase === 'active' && D().current === it.uid) {
        const nx = nextPending(it.uid);
        if (nx) goTo(nx);
        else { it.status = 'pending'; return toast('마지막 운동은 생략하지 말고 세션을 종료하세요'); }
      }
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
        const rec = E.recommend(ds.id, S.sessions);
        const it = makeItem(Object.assign(rec, { slot: null, priority: 'main' }));
        const list = items();
        if (D().phase === 'active') list.splice(idxOf(D().current) + 1, 0, it);
        else list.push(it);
      }
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
      const step = Math.abs(d.increment || 1);
      it.cur_weight = Math.max(0, E.round(Number(it.cur_weight || 0) + step * Number(ds.dir)));
      it.target.weight = it.cur_weight;
      save();
    },
    'w-edit'() {
      const it = cur();
      const v = prompt('무게 (' + def(it).unit + ')', it.cur_weight == null ? '' : it.cur_weight);
      if (v == null || v.trim() === '' || isNaN(Number(v))) return;
      it.cur_weight = E.round(Number(v));
      it.target.weight = it.cur_weight;
      save();
    },
    'tap-full'() { remember(); ui.reps++; },
    'tap-fill'() { remember(); ui.reps += cur().target.reps; ui.filled = true; },
    'tap-undo'() { const h = undoStack.pop(); if (h) Object.assign(ui, h); },
    record() {
      const it = cur();
      const reps = ui.reps;
      if (!reps) return toast('횟수를 먼저 입력해 주세요');
      const set = { set_number: it.sets.length + 1, weight: it.cur_weight, reps, is_warmup: false, input_mode: ui.filled ? 'batch' : 'tap', feel: null };
      const prev = it.sets.filter((s) => !s.is_warmup).pop();
      ui.msg = '';
      if (!set.is_warmup && prev && prev.reps > 0 && reps <= prev.reps * 0.6) ui.msg = '직전 세트보다 40% 넘게 줄었어요. 여기서 마무리해도 좋아요.';
      it.sets.push(set);
      const cut = fitToTime();
      if (cut.length) ui.msg = (ui.msg ? ui.msg + ' ' : '') + '목표 시간에 맞춰 뺀 운동: ' + cut.reverse().join(', ') + '. 세션 목록에서 되살릴 수 있어요.';
      ui.feelIdx = it.sets.length - 1;
      ui.phase = 'rest';
      resetCounters(it);
      startTimer(it.target.rest_sec);
      save();
    },
    feel(ds) {
      const it = cur();
      const s = it.sets[ui.feelIdx];
      ui.feelIdx = null;
      if (!s) return;
      s.feel = ds.v || null;
      save();
    },
    't-toggle'() {
      const t = ui.timer;
      if (t.running) { t.remaining = timerLeft(); t.running = false; }
      else {
        const sec = t.remaining > 0 ? t.remaining : (t.total || cur().target.rest_sec);
        if (!t.total) t.total = sec;
        t.endsAt = Date.now() + sec * 1000;
        t.running = true;
      }
    },
    't-reset'() {
      const t = ui.timer;
      if (!t.total) t.total = cur().target.rest_sec;
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
      save();
    },
    dur(ds) {
      const it = cur();
      it.duration_min = Math.max(1, (it.duration_min || 0) + Number(ds.dir));
      save();
    },
    'dur-edit'() {
      const it = cur();
      const v = prompt('시간 (분)', it.duration_min == null ? '' : it.duration_min);
      if (v == null || v.trim() === '' || isNaN(Number(v))) return;
      it.duration_min = Math.max(1, Math.round(Number(v)));
      save();
    },
    'cardio-done'() {
      const it = cur();
      it.sets = [{ duration_min: it.duration_min }];
      it.status = 'done';
      save();
      toast(def(it).name + ' ' + it.duration_min + '분 기록');
    },
    'edit-set'(ds) { openSheet('set', Number(ds.i)); },
    'set-save'(ds) {
      const it = cur();
      const s = it.sets[Number(ds.i)];
      const d = def(it);
      const w = document.getElementById('fW').value;
      s.weight = E.round(Number(w));
      s.reps = Math.max(0, parseInt(document.getElementById('fR').value, 10) || 0);
      s.is_warmup = document.getElementById('fWu').checked;
      s.feel = document.getElementById('fF').value || null;
      save();
      closeSheet();
    },
    'set-del'(ds) {
      if (!confirm('이 세트를 삭제할까요?')) return;
      const it = cur();
      it.sets.splice(Number(ds.i), 1);
      it.sets.forEach((s, i) => { s.set_number = i + 1; });
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
      S.sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      S.draft = null;
      ui.screen = 'main';
      ui.timer.running = false;
      if (wakeLock) wakeLock.release();
      save();
      toast('저장했어요');
    },
    settings() { openSheet('settings'); },
    'settings-save'() {
      const bw = document.getElementById('sBw').value;
      S.settings.bodyweight_kg = bw === '' ? null : Number(bw);
      S.settings.sound = document.getElementById('sSound').checked;
      const tm = parseInt(document.getElementById('sTarget').value, 10);
      if (tm > 0) S.settings.target_min = tm;
      save();
      closeSheet();
      toast('설정을 저장했어요');
    },
    export() {
      const data = { version: 1, exported_at: new Date().toISOString(), settings: S.settings, sessions: S.sessions };
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
      S = { sessions: [], draft: null, settings: { bodyweight_kg: null, sound: true, target_min: 35 } };
      save();
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
      let list = [];
      if (Array.isArray(data)) list = data;
      else if (data && Array.isArray(data.sessions)) list = data.sessions;
      else if (data && data.date && Array.isArray(data.exercises)) list = [data];
      list = list.filter((s) => s && typeof s.date === 'string' && Array.isArray(s.exercises));
      if (!list.length) return toast('가져올 세션이 없어요');
      const key = (s) => s.date + '|' + s.session_type;
      const existing = new Set(S.sessions.map(key));
      const dup = list.filter((s) => existing.has(key(s))).length;
      if (!confirm('세션 ' + list.length + '개를 가져올까요?' + (dup ? ' 같은 날짜·종류 ' + dup + '개는 덮어씁니다.' : ''))) return;
      const incoming = new Set(list.map(key));
      S.sessions = S.sessions.filter((s) => !incoming.has(key(s))).concat(list);
      S.sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      save();
      closeSheet();
      render();
      toast('세션 ' + list.length + '개를 가져왔어요');
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

  if (S.draft) {
    S.draft.items = S.draft.items.filter((x) => C[x.exercise_type]).map((x) => {
      if (C[x.exercise_type].unit === 'min' || typeof x.cur_weight === 'number') return x;
      const fresh = retarget(x, x.exercise_type);
      fresh.sets = x.sets.filter((s) => typeof s.weight === 'number');
      return fresh;
    }).map((x) => { delete x.exploring; return x; });
    save();
  }
  if (S.draft && S.draft.phase === 'active') {
    const it = cur();
    if (!it) S.draft.current = (S.draft.items.find((x) => x.status === 'pending') || S.draft.items[0]).uid;
    const c = cur();
    resetCounters(c);
    ui.phase = c.sets.length || S.draft.items.some((x) => x.sets.length) ? 'rest' : 'input';
    ui.timer.total = c.target.rest_sec || 0;
    ui.timer.remaining = ui.timer.total;
    keepAwake();
  }
  render();
})();
