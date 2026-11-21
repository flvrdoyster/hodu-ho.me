(function () {
  const get = (id) => window.Catalog.get(id);
  const E = window.Engine;
  const Dt = window.Data;
  const LOCK_MS = 400;
  const TIME_MIN = 10;
  const TIME_MAX = 60;
  const TIME_STEP = 5;
  const KEY = 'workout_v1';
  const DRAFT_KEY = 'workout_v1_draft';
  const BACKUP_KEY = 'workout_v1_pre3';
  const BAD_KEY = 'workout_v1_bad';
  const app = document.getElementById('app');
  const sheet = document.getElementById('sheet');
  const toastEl = document.getElementById('toast');

  function fitApp() {
    const vv = window.visualViewport;
    const h = vv ? vv.height * vv.scale : window.innerHeight;
    document.documentElement.style.setProperty('--app-h', h + 'px');
  }
  fitApp();
  window.addEventListener('resize', fitApp);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitApp);

  const FEEL = { light: '가벼움', ok: '적당', heavy: '무거움' };
  const STATUS = { pending: '대기', done: '완료', skipped: '생략' };

  let S = load();
  E.setUnit(S.settings.weight_unit);
  const ui = {
    screen: 'main', phase: 'input', msg: '',
    reps: 0, editing: false, lockUntil: 0, sheetKind: null, sheetArg: null,
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

  function popToast(show) {
    if (!toastEl.showPopover) return;
    try { if (show) toastEl.showPopover(); else toastEl.hidePopover(); } catch (e) {}
  }

  function placeToast() {
    const sheet = document.getElementById('sheet');
    const base = sheet && sheet.open ? sheet : document.querySelector('.dock');
    const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s10')) || 10;
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const top = base ? base.getBoundingClientRect().top : h;
    toastEl.style.setProperty('--toast-bottom', Math.max(0, h - top + gap) + 'px');
  }

  function replaceToast() {
    if (!toastEl.hidden) placeToast();
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    popToast(false);
    popToast(true);
    placeToast();
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { toastEl.hidden = true; popToast(false); }, 2400);
  }

  function makeItem(rec) {
    const timed = E.isTimed(get(rec.exercise_id));
    const target = timed ? { sets: rec.sets, duration_sec: rec.duration_sec } : { weight_kg: rec.weight, reps: rec.reps, sets: rec.sets };
    const it = {
      uid: uid(), exercise_id: rec.exercise_id, slot: rec.slot, priority: rec.priority || 'main',
      status: 'pending', target, base_sets: rec.sets, sets: [],
    };
    if (!timed) it.goal_kg = rec.weight;
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
  const warmDone = (it) => it.sets.filter((s) => s.is_warmup).length;
  const warmLeft = (it) => (workDone(it) > 0 ? 0 : Math.max(0, E.warmEst(it.exercise_id, S.sessions) - warmDone(it)));
  const warmTotal = (it) => warmDone(it) + warmLeft(it);
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

  const strength = (it) => it.status !== 'skipped' && !isTimed(it);

  const IDLE_CAP_MS = 600000;
  const IDLE_END_MS = 1800000;

  function startMs() {
    const t = D().started_at ? new Date(D().started_at).getTime() : NaN;
    return isFinite(t) ? t : null;
  }

  function lastRecordMs() {
    let strengthEnd = null;
    let end = null;
    items().forEach((it) => {
      if (isTimed(it) || it.status === 'skipped') return;
      it.sets.forEach((x) => {
        const t = x.at ? new Date(x.at).getTime() : NaN;
        if (isFinite(t) && (strengthEnd == null || t > strengthEnd)) strengthEnd = t;
      });
    });
    items().forEach((it) => {
      if (!isTimed(it) || it.status === 'skipped' || !it.sets.length) return;
      const x = it.sets[0];
      const t = x.at ? new Date(x.at).getTime() : NaN;
      const e = isFinite(t) ? t : (strengthEnd != null && x.duration_sec ? strengthEnd + x.duration_sec * 1000 : null);
      if (e != null && (end == null || e > end)) end = e;
    });
    if (strengthEnd != null && (end == null || strengthEnd > end)) end = strengthEnd;
    return end;
  }

  function elapsedSec() {
    const st = startMs();
    if (st == null) return 0;
    const last = lastRecordMs();
    const cap = Math.max(st, last == null ? st : last) + IDLE_CAP_MS;
    return Math.max(0, (Math.min(Date.now(), cap) - st) / 1000);
  }

  function leftSec(it) {
    return (Math.max(0, it.target.sets - workDone(it)) + warmLeft(it)) * setSec(it);
  }

  function projectedSec() {
    return elapsedSec() + items().filter(strength).reduce((a, it) => a + leftSec(it), 0);
  }

  const targetSec = () => D().target_sec || S.settings.target_sec;
  const targetMin = () => Math.round(targetSec() / 60);
  const setSec = (it) => E.setSec(it.exercise_id, S.sessions, it.sets, def(it).rest_sec + 40);
  const planSec = (it) => (it.target.sets + warmTotal(it)) * setSec(it);
  const segSec = (it) => (Math.max(it.target.sets, workDone(it)) + warmTotal(it)) * setSec(it);

  const isFree = () => !!(window.TEMPLATES[D().session_type] && window.TEMPLATES[D().session_type].free);

  function fitToTime(rebuild) {
    if (isFree()) return { cut: [], trimmed: [] };
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
        if (over <= 0 || !open(it) || it.target.sets <= E.MIN_SETS) return;
        it.target.sets--;
        over -= setSec(it);
        changed = true;
        if (trimmed.indexOf(def(it).name) < 0) trimmed.push(def(it).name);
      });
    }
    return { cut: cut.reverse(), trimmed: trimmed.reverse() };
  }

  const timeUp = () => D().phase === 'active' && elapsedSec() >= targetSec();

  function overMin() {
    if (!isFree() || D().phase === 'active') return 0;
    return Math.round(items().filter(strength).reduce((a, it) => a + planSec(it), 0) / 60) - targetMin();
  }

  function sbarHTML(edit) {
    const list = items().filter(strength);
    const planned = list.reduce((a, it) => a + segSec(it), 0);
    const scale = Math.max(targetSec(), planned, 1);
    const run = D().phase === 'active';
    const segs = list.map((it) => {
      const sec = segSec(it);
      const fill = Math.min(1, (warmDone(it) + workDone(it)) / Math.max(1, warmTotal(it) + it.target.sets));
      return '<span class="sbar__s" style="flex:' + sec + ' 0 0"><i style="width:' + (fill * 100) + '%"></i></span>';
    }).join('');
    const free = scale - planned;
    const tick = run ? '<span class="sbar__n" id="bandTick" data-scale="' + scale + '" style="left:' + Math.min(100, elapsedSec() / scale * 100) + '%"></span>' : '';
    const text = (run ? Math.floor(elapsedSec() / 60) : Math.round(list.reduce((a, it) => a + planSec(it), 0) / 60)) + ' / ' + targetMin() + '분';
    const over = timeUp() || (!run && overMin() > 0) ? ' is-over' : '';
    const label = edit
      ? '<button type="button" class="sbar__l' + over + '" id="sbarL" data-act="time-edit" aria-label="운동 시간 바꾸기">' + text + '</button>'
      : '<span class="sbar__l' + over + '" id="sbarL">' + text + '</span>';
    return '<div class="sbar"><div class="sbar__t" role="img" aria-label="시간 배분">' + segs + (free > 0 ? '<span class="sbar__f" style="flex:' + free + ' 0 0"></span>' : '') + tick + '</div>' + label + '</div>';
  }

  function resetCounters(it) {
    ui.reps = it && !isTimed(it) ? (it.target.reps || 0) : 0;
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
    if (S.settings.haptic && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }

  const hxSwitch = !('vibrate' in navigator);
  const hx = (html) => {
    if (!S.settings.haptic || /\sdisabled[\s>]/.test(html)) return html;
    return '<span class="hx">' + html + (hxSwitch ? '<input class="hx__sw" type="checkbox" switch aria-hidden="true" tabindex="-1">' : '') + '</span>';
  };

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
    if (endIfIdle()) { render(); return; }
    const tick = document.getElementById('bandTick');
    if (tick && S.draft) {
      tick.style.left = Math.min(100, elapsedSec() / Number(tick.dataset.scale) * 100) + '%';
      const lab = document.getElementById('sbarL');
      if (lab) {
        lab.textContent = Math.floor(elapsedSec() / 60) + ' / ' + targetMin() + '분';
        lab.classList.toggle('is-over', timeUp());
      }
    }
    if (S.draft && D().phase === 'active') {
      const up = timeUp();
      if (up && !ui.upShown) {
        ui.upShown = true;
        if (ui.screen === 'main' && ui.phase === 'rest' && !ui.sheetKind) render();
      } else if (!up) ui.upShown = false;
    }
    const t = ui.timer;
    if (!t.running) return;
    const left = timerLeft();
    const el = document.getElementById('timerText');
    if (el) el.textContent = mmss(left);
    const fill = document.getElementById('restFill');
    if (fill) fill.style.height = (t.total ? Math.min(100, left / t.total * 100) : 0) + '%';
    if (left <= 0) {
      t.running = false;
      t.remaining = 0;
      beep();
      if (S.draft && D().phase === 'active' && ui.screen === 'main' && ui.phase === 'rest') {
        ui.phase = 'input';
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
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (endIfIdle()) render();
    keepAwake();
  });

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
    const size = g.rects[g.from].h;
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
      const moved = list.splice(idxOf(g.rows[g.from].dataset.uid), 1)[0];
      const at = idxOf(g.rows[g.to].dataset.uid);
      list.splice(g.to > g.from ? at + 1 : at, 0, moved);
      save();
    }
    render();
  }

  document.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('.row__handle');
    if (!h || drag) return;
    e.preventDefault();
    const li = h.closest('.row');
    const rows = Array.from(li.parentNode.children).filter((el) => el.classList.contains('row'));
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

  const ICONS = { back: '<path d="M12 2 L4 10 L12 18"/>', down: '<path d="M7 7 L13 13 L19 7"/>' };
  const icon = (name) => '<svg class="icon" viewBox="3 0 20 20" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
  const iconBtn = (act, name, label) => '<button type="button" class="hd__b" data-act="' + act + '" aria-label="' + label + '">' + icon(name) + '</button>';
  const textBtn = (act, label) => '<button type="button" class="hd__a" data-act="' + act + '">' + label + '</button>';
  const tag = (text) => '<span class="tag">' + text + '</span>';

  function topbar(o) {
    return '<header class="hd' + (o.fixed ? ' hd--fixed' : '') + '">' + (o.left || '') +
      (o.sub ? '<span class="lbl hd__s">' + esc(o.sub) + '</span>' : o.title ? '<h1 class="hd__t">' + esc(o.title) + '</h1>' : '<span class="hd__s"></span>') +
      (o.right || '') + '</header>';
  }

  function relDate(date) {
    const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today());
    if (!a || !b) return date;
    const n = Math.round((Date.UTC(+b[1], b[2] - 1, +b[3]) - Date.UTC(+a[1], a[2] - 1, +a[3])) / 86400000);
    return n < 0 ? date : n === 0 ? '오늘' : n === 1 ? '어제' : n + '일 전';
  }

  function homeHTML() {
    const recent = S.sessions.slice().sort((a, b) => (b.started_at || b.date).localeCompare(a.started_at || a.date)).slice(0, 2);
    const stage = '<div class="sec">운동 기록</div>' + (recent.length ? recent.map((x) => '<p class="last">' + esc(relDate(x.date)) + ' · ' + esc(tplName(x.session_type)) + (x.duration_sec ? ' · ' + Math.round(x.duration_sec / 60) + '분' : '') + '</p>').join('') : '<p class="last">아직 기록이 없어요.</p>');
    const btns = Object.keys(window.TEMPLATES).map((k) => '<button type="button" class="cta" data-act="new-session" data-type="' + k + '"><b>' + esc(window.TEMPLATES[k].name) + '</b><small>세션 만들기</small></button>').join('');
    return '<div class="screen">' + topbar({ right: textBtn('settings', '설정') }) +
      '<div class="stage">' + stage + '</div><div class="dock"><div class="pick">' + btns + '</div></div></div>';
  }

  function tplName(t) {
    return window.TEMPLATES[t] ? window.TEMPLATES[t].name : t;
  }

  function fullReason(it) {
    if (unmeasured(it)) return '';
    return (it.pre || '') + E.recommend(it.exercise_id, S.sessions, S.increments).reason;
  }

  function shortReason(it) {
    const r = fullReason(it);
    const i = r.lastIndexOf('→');
    return (i < 0 ? r : r.slice(i + 1)).trim().replace(/^무게 유지, /, '');
  }

  function rowHTML(it, mode) {
    const d = def(it);
    const live = D().phase === 'active';
    const isCur = live && it.uid === D().current;
    const off = it.status === 'skipped';
    const tags = (unmeasured(it) ? tag('미측정') : '') + (it.priority === 'optional' ? tag('선택') : '');
    let sub;
    if (live && it.sets.length) sub = doneText(it) + (!isTimed(it) && workDone(it) < it.target.sets ? ' · 목표 ' + it.target.sets + '세트' : '');
    else {
      sub = targetText(it);
      const why = live || off ? '' : shortReason(it);
      if (why) sub += ' · ' + why;
    }
    let right = '';
    if (mode !== 'edit') {
      if (live) right = isCur ? '진행 중' : STATUS[it.status];
      else right = off ? '생략' : (strength(it) ? '약 ' + Math.round(planSec(it) / 60) + '분' : '');
      right += (right ? ' ' : '') + '›';
    }
    const act = mode === 'list' && !off ? 'jump' : 'row-sheet';
    return '<li class="row xr' + (off ? ' off' : '') + (isCur ? ' cur' : '') + '" data-uid="' + it.uid + '"' + (isCur ? ' id="curRow"' : '') + '>' +
      '<button type="button" class="xr__b" data-act="' + act + '" data-uid="' + it.uid + '"><span class="xr__m"><span class="xr__n">' + esc(d.name) + tags + '</span>' +
      '<span class="xr__s">' + esc(sub) + '</span></span>' + (right ? '<span class="xr__r">' + right + '</span>' : '') + '</button>' +
      (mode === 'edit' || mode === 'plan' ? '<button type="button" class="row__handle" aria-label="끌어서 순서 바꾸기">≡</button>' : '') + '</li>';
  }

  const isCut = (it) => it.auto && it.status === 'skipped';

  function rowsHTML(mode) {
    const list = items();
    if (!list.length) return '<p class="empty">운동을 추가해서 시작하세요</p>';
    if (mode === 'edit') return '<ol class="rows">' + list.map((it) => rowHTML(it, mode)).join('') + '</ol>';
    const cut = list.filter(isCut);
    return '<ol class="rows">' + list.filter((it) => !isCut(it)).map((it) => rowHTML(it, mode)).join('') +
      (cut.length ? '<li class="xr off"><button type="button" class="xr__b" data-act="cut-sheet"><span class="xr__m"><span class="xr__n">시간에 맞춰 뺀 운동 ' + cut.length + '개</span>' +
        '<span class="xr__s">' + esc(cut.map((it) => def(it).name).join(', ')) + '</span></span><span class="xr__r">복원 ›</span></button></li>' : '') + '</ol>';
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
    return '<div class="screen">' + topbar({ title: '목록', fixed: true, left: iconBtn('back-ex', 'back', '운동으로'), right: textBtn('list-edit', editing ? '완료' : '편집') }) +
      sbarHTML(true) + rowsHTML(editing ? 'edit' : 'list') +
      '<div class="dock"><div class="quiet"><button type="button" data-act="add">운동 추가</button>' +
      '<button type="button" data-act="finish">세션 종료</button>' +
      '<button type="button" class="danger" data-act="abandon">기록 버리고 처음으로</button></div>' +
      (editing ? '' : hx('<button type="button" class="cta" data-act="back-ex">지금 운동으로</button>')) + '</div></div>';
  }

  function planHTML() {
    const planned = Math.round(items().filter(strength).reduce((a, it) => a + planSec(it), 0) / 60);
    return '<div class="screen">' + topbar({ title: tplName(D().session_type) + ' 세션 · ' + D().date, right: textBtn('plan-cancel', '취소') }) +
      '<div class="tm">' + hx('<button type="button" class="rnd rnd--sm" data-act="time" data-dir="-1" aria-label="운동 시간 줄이기"' + (targetMin() <= TIME_MIN ? ' disabled' : '') + '>−</button>') +
      '<div class="tm__c"><span class="lbl">운동 시간</span><button type="button" class="tm__v" data-act="time-edit"><b>' + targetMin() + '</b><u>분</u></button>' +
      '<p class="tm__s">근력 예상 ' + planned + '분</p></div>' +
      hx('<button type="button" class="rnd rnd--sm" data-act="time" data-dir="1" aria-label="운동 시간 늘리기"' + (targetMin() >= TIME_MAX ? ' disabled' : '') + '>+</button>') + '</div>' +
      sbarHTML() + (overMin() > 0 ? '<p class="over">목표를 ' + overMin() + '분 넘었어요</p>' : '') + lastSessionHTML() + rowsHTML('plan') +
      (items().length
        ? '<div class="dock"><div class="quiet"><button type="button" data-act="add">운동 추가</button></div>' + hx('<button type="button" class="cta" data-act="plan-start">시작</button>') + '</div></div>'
        : '<div class="dock">' + hx('<button type="button" class="cta" data-act="add">운동 추가</button>') + '</div></div>');
  }

  function exerciseHTML() {
    const it = cur();
    const d = def(it);
    const nx = nextPending(it.uid);
    const live = items().filter((x) => x.status !== 'skipped' || x.uid === it.uid);
    const rest = ui.phase === 'rest' && !isTimed(it);
    const t = ui.timer;
    const pct = t.total ? Math.min(100, timerLeft() / t.total * 100) : 0;
    return '<div class="screen' + (rest ? ' screen--rest' : '') + '">' +
      (rest ? '<div class="restfill" id="restFill" style="height:' + pct + '%"></div>' : '') +
      topbar({ sub: tplName(D().session_type) + ' · ' + (live.indexOf(it) + 1) + ' / ' + live.length + '번째 운동', right: textBtn('open-list', '목록') }) +
      sbarHTML() +
      '<button type="button" class="name" data-act="ex-sheet"><span>' + esc(d.name) + '</span>' + icon('down') + '</button>' +
      (isTimed(it) ? cardioHTML(it, nx) : rest ? restHTML(it, nx) : inputHTML(it)) + '</div>';
  }

  function wParts(d, kg) {
    const m = /^([\d.]+)(.*)$/.exec(E.fmtW(Object.assign({}, d, { load: 'weight' }), kg));
    return m ? { n: m[1], u: m[2] } : { n: '', u: '' };
  }

  function setLi(d, s, label, act) {
    const body = '<span class="li__n">' + label + '</span><span class="li__t">' + esc(setText(d, s)) + (s.note ? '<small>' + esc(s.note) + '</small>' : '') + '</span>' +
      '<span class="li__r">' + (s.feel ? FEEL[s.feel] : '') + (act ? ' ›' : '') + '</span>';
    const cls = 'li' + (s.is_warmup ? ' warm' : '');
    return act ? '<button type="button" class="' + cls + '" ' + act + '>' + body + '</button>' : '<div class="' + cls + '">' + body + '</div>';
  }

  function setLis(d, sets, actOf) {
    let n = 0;
    return (sets || []).map((s, i) => setLi(d, s, s.is_warmup ? '웜업' : String(++n), actOf ? actOf(i) : '')).join('');
  }

  function lastOf(id) {
    const h = E.history(S.sessions, id)[0];
    if (!h) return null;
    return { date: h.date, ex: h.ex, next: h.ex.next_note || null };
  }

  function lastSessionHTML() {
    const same = S.sessions.filter((x) => x.session_type === D().session_type);
    const last = same[same.length - 1];
    const watch = last ? last.watch_note : null;
    if (isFree() || !last || (!last.notes && !watch)) return '';
    return '<div class="memo"><span class="lbl">지난 ' + esc(tplName(last.session_type)) + ' 세션 메모 · ' + esc(last.date) + '</span>' +
      (last.notes ? '<p>' + esc(last.notes) + '</p>' : '') +
      (watch ? '<p>지켜볼 것: ' + esc(watch) + '</p>' : '') + '</div>';
  }

  function prevRowHTML(it) {
    const h = E.history(S.sessions, it.exercise_id)[0];
    if (!h) return '';
    const d = def(it);
    let text;
    if (E.isTimed(d)) text = '<b>지난번 ' + E.fmtMin(h.ex.sets[0].duration_sec) + '</b>';
    else {
      const ws = (h.ex.sets || []).filter((x) => !x.is_warmup);
      if (!ws.length) return '';
      const same = ws.every((x) => x.weight_kg === ws[0].weight_kg);
      text = same
        ? '<b>지난번 ' + ws.map((x) => x.reps).join(' · ') + '회</b> ' + esc(E.fmtW(d, ws[0].weight_kg))
        : '<b>지난번 ' + ws.length + '세트</b> ' + esc(E.fmtW(d, ws[ws.length - 1].weight_kg)) + '까지';
    }
    return '<button type="button" class="prev" data-act="ex-sheet">' + text + '<span>' + esc(h.date) + ' ›</span></button>';
  }

  function inputHTML(it) {
    const d = def(it);
    const n = workDone(it) + 1;
    const total = Math.max(it.target.sets, n);
    let pips = '';
    for (let i = 0; i < Math.min(total, 8); i++) pips += '<i' + (i < n - 1 ? ' class="d"' : i === n - 1 ? ' class="c"' : '') + '></i>';
    const head = '<div class="setno"><span class="pips">' + pips + '</span>' + n + '세트 <em>/ ' + it.target.sets + '</em></div>';
    if (unmeasured(it)) {
      return '<div class="stage">' + head + '<button type="button" class="big big--w" data-act="w-edit"><span class="big__none">무게 미정</span></button>' +
        '<div class="big"><span class="x">×</span><b>' + it.target.reps + '</b><u>회</u></div></div>' +
        '<div class="dock"><button type="button" class="cta" data-act="w-edit">시작 무게 정하기</button></div>';
    }
    const w = wParts(d, it.target.weight_kg);
    const side = (d.load === 'assist' ? '<span class="side">보조</span>' : '') + (d.weight_basis === 'per_side' ? '<span class="side">한 쪽</span>' : '');
    return '<div class="stage">' + head +
      '<button type="button" class="big big--w" data-act="ex-sheet" aria-label="무게 바꾸기"><b>' + esc(w.n) + '</b><u>' + esc(w.u) + '</u>' + side + '</button>' +
      '<div class="big"><span class="x">×</span><b>' + ui.reps + '</b><u>회</u></div>' + prevRowHTML(it) + '</div>' +
      '<div class="dock"><div class="enter">' +
      hx('<button type="button" class="rnd" data-act="reps" data-dir="-1" aria-label="횟수 줄이기"' + (ui.reps <= 1 ? ' disabled' : '') + '>−</button>') +
      hx('<button type="button" class="cta" data-act="record">' + ui.reps + '회 했어요</button>') +
      hx('<button type="button" class="rnd" data-act="reps" data-dir="1" aria-label="횟수 늘리기">+</button>') + '</div></div>';
  }

  function cardioHTML(it, nx) {
    const rec = it.sets.length > 0;
    const min = Math.round((it.target.duration_sec || 0) / 60);
    const nav = (cls) => hx('<button type="button" class="' + cls + '" data-act="' + (nx ? 'next-ex' : 'finish') + '">' + (nx ? '다음 운동으로 · ' + esc(def(nx).name) : '세션 종료') + '</button>');
    const enter = (mid) => '<div class="enter">' +
      hx('<button type="button" class="rnd" data-act="dur" data-dir="-1" aria-label="시간 줄이기">−</button>') + hx(mid) +
      hx('<button type="button" class="rnd" data-act="dur" data-dir="1" aria-label="시간 늘리기">+</button>') + '</div>';
    const got = rec ? Math.round(it.sets[0].duration_sec / 60) : 0;
    return '<div class="stage"><div class="setno">시간 운동' + (it.priority === 'optional' ? tag('선택') : '') + '</div>' +
      (rec ? '<p class="rec"><b>기록 ' + got + '분</b>' + (got === min ? '' : ' · 아래 ' + min + '분으로 다시 기록하면 바뀌어요') + '</p>' : '') +
      '<button type="button" class="big big--t" data-act="dur-edit" aria-label="시간 직접 입력"><b>' + min + '</b><u>분</u></button>' + prevRowHTML(it) + '</div>' +
      '<div class="dock">' + (rec
        ? enter('<button type="button" class="btn" data-act="cardio-done"' + (got === min ? ' disabled' : '') + '>' + min + '분으로 다시 기록</button>') + nav('cta')
        : nav('btn btn--plain') + enter('<button type="button" class="cta" data-act="cardio-done">' + min + '분 했어요</button>')) + '</div>';
  }

  function restHTML(it, nx) {
    const d = def(it);
    const left = timerLeft();
    const t = ui.timer;
    const li = it.sets.length - 1;
    const s = it.sets[li];
    const up = timeUp();
    const done = workDone(it) >= it.target.sets;
    let past = '';
    if (s) {
      const label = s.is_warmup ? '방금 웜업' : '방금 ' + workDone(it) + '세트' + (done ? ' · 목표 완료' : '');
      past = '<div class="past"><div class="past__h"><span class="lbl">' + label + '</span><b>' + esc(setText(d, s)) + '</b>' +
        '<button type="button" data-act="edit-set" data-i="' + li + '">고치기</button></div><div class="seg">' +
        Object.keys(FEEL).map((k) => hx('<button type="button"' + (s.feel === k ? ' class="on"' : '') + ' data-act="feel" data-i="' + li + '" data-v="' + k + '">' + FEEL[k] + '</button>')).join('') +
        '</div></div>';
    }
    let next;
    const block = (l, v, c) => '<div class="next__l">' + l + '</div><div class="next__v">' + esc(v) + '</div>' + (c ? '<p class="next__c">' + esc(c) + '</p>' : '');
    if (up) next = block('운동 시간', targetMin() + '분이 됐어요', nx ? '남은 운동 · ' + def(nx).name + ' ' + targetText(nx) : '');
    else if (done) next = nx ? block('다음 운동', def(nx).name, targetText(nx)) : block('다음', '남은 운동 없음', '');
    else next = block('다음', (workDone(it) + 1) + '세트 · ' + E.fmtW(d, it.target.weight_kg) + ' × ' + it.target.reps + '회', d.cue || '');
    const moreSet = (cls) => hx('<button type="button" class="' + cls + '" data-act="next-set">한 세트 더</button>');
    let dock;
    if (up) {
      dock = '<div class="duo">' + moreSet('btn') + (nx ? hx('<button type="button" class="btn" data-act="next-ex">다음 운동으로</button>') : '') + '</div>' +
        hx('<button type="button" class="cta" data-act="finish">세션 종료</button>');
    } else if (done) {
      dock = moreSet('btn btn--plain') + hx('<button type="button" class="cta" data-act="' + (nx ? 'next-ex' : 'finish') + '">' + (nx ? '다음 운동으로' : '세션 종료') + '</button>');
    } else {
      dock = hx('<button type="button" class="btn btn--plain" data-act="' + (nx ? 'next-ex' : 'finish') + '">' + (nx ? '다음 운동으로 · ' + esc(def(nx).name) : '세션 종료') + '</button>') +
        hx('<button type="button" class="cta" data-act="next-set">다음 세트 시작</button>');
    }
    return past +
      '<div class="clock"><span class="clock__t' + (left <= 0 ? ' end' : '') + '" id="timerText">' + mmss(left) + '</span><div class="quiet">' +
      hx('<button type="button" data-act="t-toggle">' + (t.running ? '일시정지' : '시작') + '</button>') +
      hx('<button type="button" data-act="t-reset">리셋</button>') +
      hx('<button type="button" data-act="t-add">+30초</button>') + '</div></div>' +
      '<div class="next">' + next + (ui.msg ? '<p class="next__m">' + esc(ui.msg) + '</p>' : '') + '</div>' +
      '<div class="dock">' + dock + '</div>';
  }

  function buildLog(auto) {
    const dr = D();
    const exercises = [];
    dr.items.forEach((it) => {
      if (it.status === 'skipped' || !it.sets.length) return;
      const sets = E.isTimed(def(it))
        ? [Object.assign({}, it.sets[0])]
        : it.sets.map((s) => { const c = Object.assign({}, s); delete c.wu_manual; return c; });
      const ex = { exercise_id: it.exercise_id, sets };
      if (it.note) ex.note = it.note;
      exercises.push(ex);
    });
    const bw = dr.bodyweight_kg != null || auto ? dr.bodyweight_kg : S.settings.bodyweight_kg;
    const log = { id: dr.id, date: dr.date, session_type: dr.session_type };
    if (dr.started_at) log.started_at = dr.started_at;
    const st = startMs();
    const last = lastRecordMs();
    log.duration_sec = st != null && last != null ? Math.max(60, Math.round((last - st) / 1000)) : 60;
    if (bw != null) log.bodyweight_kg = bw;
    if (dr.notes) log.notes = dr.notes;
    log.exercises = exercises;
    return log;
  }

  function commitSession(auto) {
    const log = buildLog(auto);
    if (log.bodyweight_kg != null) S.settings.bodyweight_kg = log.bodyweight_kg;
    S.sessions.push(log);
    S.sessions.sort(Dt.sessionOrder);
    S.draft = null;
    ui.screen = 'main';
    ui.timer.running = false;
    if (wakeLock) wakeLock.release();
    save(true);
  }

  function endIfIdle() {
    if (!S.draft || D().phase !== 'active') return false;
    const st = startMs();
    const last = lastRecordMs();
    const base = last != null ? last : st;
    if (base == null || Date.now() - base < IDLE_END_MS) return false;
    closeSheet();
    if (last == null || !buildLog(true).exercises.length) {
      S.draft = null;
      ui.screen = 'main';
      ui.timer.running = false;
      if (wakeLock) wakeLock.release();
      save();
      toast('기록이 없어 진행 중이던 세션을 지웠어요');
    } else {
      const it = cur();
      if (it && it.sets.length && !isTimed(it)) it.status = 'done';
      commitSession(true);
      toast(Math.round(IDLE_END_MS / 60000) + '분 동안 기록이 없어 세션을 자동으로 저장했어요');
    }
    return true;
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
    return '<p class="sum__d">' + lines.map((x, i) => (i ? esc(x) : '<b>' + esc(x) + '</b>')).join('<br>') + '</p>';
  }

  function summaryHTML() {
    const log = buildLog();
    const future = S.sessions.concat([log]);
    const rows = items().map((it) => {
      const d = def(it);
      if (it.status === 'skipped' || !it.sets.length) {
        return '<li class="sr off"><div class="sr__h"><b>' + esc(d.name) + '</b><span>' + (it.status === 'skipped' ? '생략' : '기록 없음') + '</span></div></li>';
      }
      let lines;
      if (E.isTimed(d)) lines = E.fmtMin(it.sets[0].duration_sec);
      else lines = it.sets.map((s) => (s.is_warmup ? '웜업 ' : '') + setText(d, s)).join(', ');
      const rec = E.recommend(it.exercise_id, future, S.increments);
      const recText = E.isTimed(d) ? E.fmtMin(rec.duration_sec) : E.fmtW(d, rec.weight) + ' × ' + rec.reps + '회 × ' + rec.sets + '세트';
      return '<li class="sr"><div class="sr__h"><b>' + esc(d.name) + '</b><span>다음 <i>' + esc(recText) + '</i></span></div><p>' + esc(lines) + '</p>' +
        (it.note ? '<p>메모: ' + esc(it.note) + '</p>' : '') + '</li>';
    }).join('');
    const bw = log.bodyweight_kg;
    return '<div class="screen">' + topbar({ title: '세션 요약', left: iconBtn('sum-back', 'back', '운동으로') }) +
      '<div class="sum"><span class="lbl">' + esc(log.date + ' · ' + tplName(log.session_type)) + '</span>' +
      '<div class="sum__v"><b>' + Math.round(log.duration_sec / 60) + '</b><u>분</u></div>' + digestHTML(future) +
      (log.notes ? '<p class="sum__d">메모: ' + esc(log.notes) + '</p>' : '') + '</div>' +
      '<ol class="rows">' + rows + '</ol>' +
      '<div class="dock"><div class="duo"><button type="button" class="btn" data-act="sum-bw">체중' + (bw == null ? ' 입력' : '<b>' + esc(bw) + 'kg</b>') + '</button>' +
      '<button type="button" class="btn" data-act="sum-note">' + (log.notes ? '메모 고치기' : '메모 추가') + '</button></div>' +
      '<button type="button" class="cta" data-act="sum-save">저장</button></div></div>';
  }

  function openSheet(kind, arg) {
    ui.sheetKind = kind;
    ui.sheetArg = arg;
    renderSheet();
    if (!sheet.open) sheet.showModal();
    replaceToast();
  }

  function closeSheet() {
    if (sheet.open) sheet.close();
    ui.sheetKind = null;
    ui.formKey = null;
  }

  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  sheet.addEventListener('close', () => { ui.sheetKind = null; ui.formKey = null; sheet.innerHTML = ''; replaceToast(); });

  function sheetHead(title) {
    return '<div class="sheet__head"><h2>' + esc(title) + '</h2>' + textBtn('close-sheet', '닫기') + '</div>';
  }

  function renderSheet() {
    const k = ui.sheetKind;
    const key = k + ':' + ui.sheetArg;
    const saved = {};
    const ae = document.activeElement;
    const focus = ui.formKey === key && ae && ae.id && sheet.contains(ae) ? { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd } : null;
    if (ui.formKey === key) sheet.querySelectorAll('input,select,textarea').forEach((el) => { saved[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
    ui.formKey = key;
    let html = '';
    if (k === 'swap' || k === 'add') {
      html = sheetHead(k === 'swap' ? '운동 대체' : '운동 추가') + pickerHTML(k, ui.sheetArg);
    } else if (k === 'set') {
      html = setFormHTML(ui.sheetArg);
    } else if (k === 'note') {
      html = sheetHead(def(cur()).name + ' 메모') +
        '<label class="field"><span class="sec">오늘 메모</span><textarea class="input" id="exNote" rows="4">' + esc(cur().note || '') + '</textarea></label>' +
        '<button type="button" class="cta" data-act="note-save">저장</button>';
    } else if (k === 'snote') {
      html = sheetHead('세션 메모') +
        '<label class="field"><span class="sec">오늘 세션 메모</span><textarea class="input" id="sNotes" rows="4">' + esc(D().notes || '') + '</textarea></label>' +
        '<button type="button" class="cta" data-act="snote-save">저장</button>';
    } else if (k === 'ex') {
      html = exSheetHTML(cur());
    } else if (k === 'row') {
      html = rowSheetHTML(ui.sheetArg);
    } else if (k === 'cut') {
      html = cutSheetHTML();
    } else if (k === 'exset') {
      html = sheetHead(def(cur()).name + ' 설정') + exSetHTML(cur());
    } else if (k === 'settings') {
      html = sheetHead('설정') + settingsHTML();
    } else if (k === 'export') {
      html = sheetHead('기록 복사') + '<p class="lbl">자동으로 복사하지 못했어요. 아래 내용을 모두 선택해서 복사해 주세요.</p>' +
        '<textarea class="input" id="exportText" rows="10" readonly>' + esc(ui.exportText || '') + '</textarea>';
    }
    sheet.innerHTML = '<div class="sheet__body">' + html + '</div>';
    sheet.querySelectorAll('input,select,textarea').forEach((el) => {
      if (!(el.id in saved)) return;
      if (el.type === 'checkbox') el.checked = saved[el.id]; else el.value = saved[el.id];
    });
    if (focus) {
      const el = document.getElementById(focus.id);
      if (el) {
        el.focus();
        try { el.setSelectionRange(focus.s, focus.e); } catch (e) { }
      }
    }
    const ff = document.getElementById('fF');
    if (ff) sheet.querySelectorAll('[data-act="f-feel"]').forEach((b) => b.classList.toggle('on', b.dataset.v === ff.value));
  }

  function exSheetHTML(it) {
    const d = def(it);
    let html = sheetHead(d.name);
    if (!isTimed(it)) {
      const none = it.target.weight_kg == null;
      const w = wParts(d, it.target.weight_kg);
      const step = S.settings.weight_unit === 'lbs' ? '5lbs' : E.round(Math.abs(d.increment || 1)) + 'kg';
      html += '<div class="sec">' + (d.load === 'assist' ? '보조 무게' : '무게') + (d.weight_basis === 'per_side' ? ' · 한 쪽' : '') + '</div>' +
        '<div class="wrow"><button type="button" class="rnd rnd--sm" data-act="w" data-dir="-1" aria-label="무게 줄이기"' + (none ? ' disabled' : '') + '>−</button>' +
        '<button type="button" class="v' + (none ? ' none' : '') + '" data-act="w-edit">' + (none ? '무게 미정' : esc(w.n) + '<u>' + esc(w.u) + '</u>') + '</button>' +
        '<button type="button" class="rnd rnd--sm" data-act="w" data-dir="1" aria-label="무게 늘리기"' + (none ? ' disabled' : '') + '>+</button>' +
        '<button type="button" class="unit" data-act="unit-toggle" aria-label="무게 단위 바꾸기">kg ⇄ lbs</button></div>' +
        '<button type="button" class="li li--sub" data-act="w-edit">증량 폭 ' + step + ' · 직접 입력<span class="li__r">›</span></button>';
    }
    html += '<div class="sec">오늘</div>' + (isTimed(it) ? '' : setLis(d, it.sets, (i) => 'data-act="edit-set" data-i="' + i + '"')) +
      '<button type="button" class="li" data-act="note-edit"><span class="li__n">메모</span><span class="li__t' + (it.note ? '' : ' lbl') + '">' + (it.note ? esc(it.note) : '오늘 메모 추가') + '</span><span class="li__r">›</span></button>';
    const last = lastOf(it.exercise_id);
    if (last) {
      if (last.ex.note || last.next) {
        html += '<div class="sec">지난 메모 · ' + esc(last.date) + '</div>' +
          (last.ex.note ? '<p class="note-p">' + esc(last.ex.note) + '</p>' : '') +
          (last.next ? '<p class="note-p">다음 목표: ' + esc(last.next) + '</p>' : '');
      }
      html += '<div class="sec">직전 기록 · ' + esc(last.date) + '</div>' +
        (isTimed(it) ? '<div class="li">' + E.fmtMin(last.ex.sets[0].duration_sec) + '</div>' : setLis(d, last.ex.sets));
    }
    return html;
  }

  function rowSheetHTML(u) {
    const it = items()[idxOf(u)];
    if (!it) return '';
    const d = def(it);
    const off = it.status === 'skipped';
    const why = fullReason(it);
    return sheetHead(d.name) +
      '<div class="sec">오늘 목표' + (isTimed(it) ? '' : ' · 약 ' + Math.round(planSec(it) / 60) + '분') + '</div><p class="goal">' + esc(targetText(it)) + '</p>' +
      (why ? '<div class="sec">이렇게 정한 이유</div><p class="why">' + esc(why) + '</p>' : '') +
      '<div class="duo"><button type="button" class="btn" data-act="swap" data-uid="' + it.uid + '">다른 운동으로 대체</button>' +
      '<button type="button" class="btn" data-act="row-skip" data-uid="' + it.uid + '">' + (off ? '복원' : '오늘은 생략') + '</button></div>';
  }

  function cutSheetHTML() {
    return sheetHead('시간에 맞춰 뺀 운동') + items().filter(isCut).map((it) =>
      '<div class="li"><span class="li__t"><b>' + esc(def(it).name) + '</b><small>' + esc(targetText(it)) + '</small></span>' +
      '<button type="button" class="unit" data-act="cut-restore" data-uid="' + it.uid + '">복원</button></div>').join('');
  }

  function pickerHTML(kind, u) {
    const present = {};
    items().forEach((i) => { if (!(kind === 'swap' && i.uid === u)) present[i.exercise_id] = i; });
    const all = window.Catalog.ids().filter(E.pickable).filter((id) => !present[id] || (kind === 'add' && present[id].status === 'skipped'));
    let top = [];
    let self = null;
    if (kind === 'swap') {
      const it = items()[idxOf(u)];
      self = it.exercise_id;
      const p = def(it).pattern;
      top = all.filter((id) => get(id).pattern === p);
      if (it.slot != null && window.TEMPLATES[D().session_type]) {
        const slot = window.TEMPLATES[D().session_type].slots[it.slot];
        if (slot) E.candidates(slot).forEach((id) => { if (top.indexOf(id) < 0 && all.indexOf(id) >= 0) top.push(id); });
      }
      top = top.filter((id) => id !== self).sort((a, b) => get(a).difficulty - get(b).difficulty);
    }
    const rest = all.filter((id) => id !== self && top.indexOf(id) < 0);
    const pick = (id, showPattern) => '<button type="button" class="li" data-act="pick" data-id="' + id + '">' +
      '<span class="li__t">' + (showPattern ? '<b>' + esc(get(id).name) + '</b>' : esc(get(id).name)) + (isNew(id) ? tag('미측정') : '') + '</span>' +
      '<span class="li__r">' + (present[id] ? '생략함 · 복원 ' : showPattern ? esc(E.PATTERN_NAME[get(id).pattern]) + ' ' : '') + '›</span></button>';
    let html = '';
    if (top.length) html += '<div class="sec">대체 후보</div>' + top.map((id) => pick(id, true)).join('');
    E.PATTERN_ORDER.forEach((p) => {
      const ids = rest.filter((id) => get(id).pattern === p);
      if (!ids.length) return;
      html += '<div class="sec">' + esc(E.PATTERN_NAME[p]) + '</div>' + ids.map((id) => pick(id, false)).join('');
    });
    return html || '<p class="lbl">바꿀 수 있는 운동이 없어요.</p>';
  }

  function isNew(id) {
    return !E.hasWeightFor(id, S.sessions);
  }

  function numInput(id, cls, kg) {
    const has = kg != null && kg !== '';
    const shown = has ? E.kgToDisp(kg, 2) : '';
    return '<input class="' + cls + '" id="' + id + '" type="number" inputmode="decimal" step="any" min="0" value="' + esc(shown) + '" data-shown="' + esc(shown) + '" data-kg="' + (has ? esc(kg) : '') + '">';
  }

  const unitBtn = () => '<button type="button" class="unit" data-act="unit-toggle" aria-label="무게 단위 바꾸기">kg ⇄ lbs</button>';

  const LIM = { w: [0, 1000], reps: [1, 200], bw: [20, 300], inc: [0, 100] };

  function fit(v, lim, label, fmt, josa) {
    const c = Math.max(lim[0], Math.min(lim[1], v));
    if (c !== v) toast(label + ' ' + fmt(c) + (josa || '으로') + ' 맞췄어요');
    return c;
  }

  const fmtKg = (kg) => E.kgToDisp(kg, 2) + S.settings.weight_unit;

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
    const u = S.settings.weight_unit;
    return '<div class="two"><label class="fld"><span class="fld__l">' + wl + ' (' + u + ')</span>' + numInput('xW', 'fld__i', it.target.weight_kg) + '</label>' +
      '<label class="fld"><span class="fld__l">증량 폭 (' + u + ')</span>' + numInput('xI', 'fld__i', Math.abs(d.increment)) + '</label></div>' +
      '<div class="wrow">' + unitBtn() + '</div>' +
      '<button type="button" class="cta" data-act="xset-save">' + (needs ? '이 무게로 시작' : '저장') + '</button>';
  }

  function setFormHTML(i) {
    const it = cur();
    const d = def(it);
    const s = it.sets[i];
    let n = 0;
    it.sets.forEach((x, k) => { if (!x.is_warmup && k <= i) n++; });
    return sheetHead((s.is_warmup ? '웜업' : n + '세트') + ' 고치기') +
      '<div class="two"><label class="fld"><span class="fld__l">' + (d.load === 'assist' ? '보조 무게' : '무게') + ' (' + S.settings.weight_unit + ')</span>' + numInput('fW', 'fld__i', s.weight_kg) + '</label>' +
      '<label class="fld"><span class="fld__l">횟수</span><input class="fld__i" id="fR" type="number" inputmode="numeric" min="0" value="' + s.reps + '"></label></div>' +
      '<div class="sec">체감</div><div class="seg">' +
      Object.keys(FEEL).map((k) => '<button type="button" data-act="f-feel" data-v="' + k + '">' + FEEL[k] + '</button>').join('') + '</div>' +
      '<input type="hidden" id="fF" value="' + esc(s.feel || '') + '">' +
      '<div class="sec"></div><label class="li li--first"><span>웜업 세트</span><input type="checkbox" class="sw" id="fWu"' + (s.is_warmup ? ' checked' : '') + '></label>' +
      '<div class="li">' + unitBtn() + '</div>' +
      '<label class="field"><span class="sec">메모</span><input class="input" id="fN" type="text" value="' + esc(s.note || '') + '"></label>' +
      '<button type="button" class="cta" data-act="set-save" data-i="' + i + '">저장</button>' +
      '<button type="button" class="btn btn--plain danger" data-act="set-del" data-i="' + i + '">세트 삭제</button>';
  }

  function settingsHTML() {
    const st = S.settings;
    const last = S.sessions[S.sessions.length - 1];
    return '<label class="field"><span class="sec">체중 (kg)</span><input class="input" id="sBw" type="number" inputmode="decimal" step="0.1" value="' + esc(st.bodyweight_kg == null ? '' : st.bodyweight_kg) + '"></label>' +
      '<div class="sec"></div><label class="li li--first"><span>휴식 끝 소리</span><input type="checkbox" class="sw" id="sSound"' + (st.sound ? ' checked' : '') + '></label>' +
      '<label class="li"><span>햅틱</span><input type="checkbox" class="sw" id="sHaptic"' + (st.haptic ? ' checked' : '') + '></label>' +
      '<button type="button" class="cta" data-act="settings-save">설정 저장</button>' +
      '<div class="sec">저장된 세션 ' + S.sessions.length + '개' + (last ? ' · 최근 ' + esc(last.date) : '') + '</div>' +
      '<button type="button" class="btn" data-act="export">기록 복사 (JSON)</button>' +
      '<button type="button" class="btn btn--plain danger" data-act="wipe">모든 데이터 지우기</button>';
  }

  function backToExercise() {
    ui.screen = 'main';
    ui.editing = false;
    if (ui.phase === 'rest' && !ui.timer.running && ui.timer.remaining <= 0 && ui.timer.total) ui.phase = 'input';
    window.scrollTo(0, 0);
  }

  const clampMin = (min) => Math.max(TIME_MIN, Math.min(TIME_MAX, min));

  function setTime(min) {
    D().target_sec = clampMin(min) * 60;
    S.settings.target_sec = D().target_sec;
    fitToTime(true);
    save(true);
  }

  function goTo(it) {
    window.scrollTo(0, 0);
    D().current = it.uid;
    ui.phase = ui.timer.running ? 'rest' : 'input';
    ui.msg = '';
    resetCounters(it);
    ui.askWeight = unmeasured(it);
  }

  function dropDraft() {
    closeSheet();
    S.draft = null;
    ui.screen = 'main';
    ui.editing = false;
    ui.timer.running = false;
    if (wakeLock) wakeLock.release();
    save();
  }

  const A = {
    'new-session'(ds) {
      const date = today();
      const recs = E.buildSession(ds.type, S.sessions, date, S.increments);
      S.draft = { id: uid(), date, session_type: ds.type, phase: 'plan', current: null, items: recs.map(makeItem), target_sec: S.settings.target_sec };
      ui.editing = false;
      fitToTime(true);
      save();
    },
    'plan-cancel'() {
      if (!confirm('이 세션 계획을 버릴까요?')) return;
      ui.editing = false;
      S.draft = null;
      save();
    },
    abandon() {
      if (!confirm('이번 세션 기록을 모두 버리고 첫 화면으로 갈까요?')) return;
      dropDraft();
    },
    time(ds) { setTime(targetMin() + TIME_STEP * Number(ds.dir)); },
    'time-edit'() {
      const v = prompt('운동 시간 (분)', targetMin());
      if (v == null || v.trim() === '' || isNaN(Number(v))) return;
      const want = Math.round(Number(v));
      setTime(want);
      if (want !== clampMin(want)) toast('운동 시간을 ' + clampMin(want) + '분으로 맞췄어요');
    },
    'plan-start'() {
      const first = items().find((x) => x.status === 'pending');
      if (!first) return toast('남은 운동이 없어요');
      D().phase = 'active';
      ui.editing = false;
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
      const dup = items().find((i) => i.exercise_id === ds.id && !(ui.sheetKind === 'swap' && i.uid === ui.sheetArg));
      if (dup) {
        if (ui.sheetKind === 'add' && dup.status === 'skipped') { A.skip({ uid: dup.uid }); closeSheet(); return; }
        return toast('이미 이 세션에 있는 운동이에요');
      }
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
        ? Math.min(LIM.w[1], Math.max(0, E.dispToKg(E.kgToDisp(now) + 5 * dir)))
        : Math.min(LIM.w[1], Math.max(0, E.round(now + Math.abs(d.increment || 1) * dir)));
      save();
    },
    'w-edit'() { openSheet('exset'); },
    'xset-save'() {
      const it = cur();
      const id = it.exercise_id;
      const base = get(id);
      const incv = fieldKg('xI');
      if (!(incv > 0)) return toast('증량 폭을 입력해 주세요');
      const inc = fit(incv, LIM.inc, '증량 폭을', fmtKg);
      const w0 = fieldKg('xW');
      if (w0 != null && isNaN(w0)) return toast('무게를 확인해 주세요');
      const w = w0 == null ? null : fit(w0, LIM.w, '무게를', fmtKg);
      const needs = !E.hasWeightFor(id, S.sessions);
      if (needs && !(w > 0)) return toast('시작 무게를 입력해 주세요');
      if (Math.abs(inc - base.increment) > 1e-9) S.increments[id] = inc; else delete S.increments[id];
      const xw = document.getElementById('xW');
      const edited = xw && xw.value !== xw.dataset.shown;
      items().forEach((i) => {
        if (i.exercise_id !== id || w == null || !edited) return;
        if (i.uid === it.uid || (needs && !i.sets.length)) { i.target.weight_kg = w; i.goal_kg = w; }
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
        if (el && kgs[i] != null && isFinite(kgs[i])) {
          const same = el.value === el.dataset.shown;
          el.value = E.kgToDisp(kgs[i], 2);
          if (same) { el.dataset.shown = el.value; el.dataset.kg = kgs[i]; }
        }
      });
      save(true);
    },
    reps(ds) { ui.reps = Math.min(LIM.reps[1], Math.max(1, ui.reps + Number(ds.dir))); },
    'ex-sheet'() { openSheet('ex'); },
    'row-sheet'(ds) { openSheet('row', ds.uid); },
    'cut-sheet'() { openSheet('cut'); },
    'row-skip'(ds) { A.skip(ds); closeSheet(); },
    'cut-restore'(ds) { A.skip(ds); if (!items().some(isCut)) closeSheet(); },
    'f-feel'(ds) {
      const ff = document.getElementById('fF');
      if (ff) ff.value = ff.value === ds.v ? '' : ds.v;
    },
    record() {
      const it = cur();
      const reps = ui.reps;
      if (it.target.weight_kg == null) { toast('무게를 먼저 입력해 주세요'); return openSheet('exset'); }
      if (!reps) return toast('횟수를 먼저 입력해 주세요');
      const w = E.dispToKg(E.kgToDisp(it.target.weight_kg, 2));
      let wu = E.isWarmup(def(it), it.goal_kg, it.sets, w);
      if (wu) {
        const same = it.sets.filter((x) => x.is_warmup && !x.wu_manual && E.eq(x.weight_kg, w));
        if (same.length) { same.forEach((x) => { x.is_warmup = false; }); wu = false; }
      }
      const set = { weight_kg: w, reps, is_warmup: wu, at: new Date().toISOString() };
      const prev = it.sets[it.sets.length - 1];
      ui.msg = '';
      if (!set.is_warmup && prev && !prev.is_warmup && !E.heavier(def(it), w, prev.weight_kg) && prev.reps > 0 && reps <= prev.reps * 0.6) ui.msg = '직전 세트보다 40% 넘게 줄었어요. 여기서 마무리해도 좋아요.';
      it.sets.push(set);
      const fit = fitToTime();
      const said = [];
      if (fit.cut.length) said.push('뺀 운동: ' + fit.cut.join(', '));
      if (fit.trimmed.length) said.push('세트를 줄인 운동: ' + fit.trimmed.join(', '));
      if (said.length) ui.msg = (ui.msg ? ui.msg + ' ' : '') + '운동 시간에 맞췄어요. ' + said.join(' · ') + '.';
      ui.phase = 'rest';
      resetCounters(it);
      startTimer(def(it).rest_sec);
      save();
    },
    feel(ds) {
      const it = cur();
      const s = it.sets[Number(ds.i)];
      if (!s) return;
      if (s.feel === ds.v) delete s.feel; else s.feel = ds.v;
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
      if (!buildLog().exercises.length) {
        if (!confirm('기록한 세트가 없어요. 세션을 지우고 첫 화면으로 갈까요?')) return;
        dropDraft();
        return toast('기록이 없어 진행 중이던 세션을 지웠어요');
      }
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
      const want = Math.round(Number(v)) * 60;
      const sec = Math.max(60, Math.min(14400, want));
      if (want !== sec) toast('시간을 ' + Math.round(sec / 60) + '분으로 맞췄어요');
      it.target.duration_sec = sec;
      save();
    },
    'cardio-done'() {
      const it = cur();
      it.sets = [{ duration_sec: it.target.duration_sec, at: new Date().toISOString() }];
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
      const raw = parseInt(document.getElementById('fR').value, 10);
      if (isNaN(raw)) return toast('횟수를 확인해 주세요');
      const reps = fit(raw, LIM.reps, '횟수를', (n) => n + '회', '로');
      if (w != null && isFinite(w)) s.weight_kg = fit(w, LIM.w, '무게를', fmtKg);
      s.reps = reps;
      const wu = document.getElementById('fWu').checked;
      if (wu !== !!s.is_warmup) { s.is_warmup = wu; s.wu_manual = true; }
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
      if (!confirm('이 세션을 기록으로 저장할까요?')) return;
      commitSession();
      toast('저장했어요');
    },
    'sum-bw'() {
      const now = D().bodyweight_kg != null ? D().bodyweight_kg : S.settings.bodyweight_kg;
      const v = prompt('체중 (kg)', now == null ? '' : now);
      if (v == null) return;
      if (v.trim() === '') { D().bodyweight_kg = null; save(); return; }
      if (isNaN(Number(v))) return toast('체중을 확인해 주세요');
      D().bodyweight_kg = fit(Number(v), LIM.bw, '체중을', (n) => n + 'kg');
      save();
    },
    'sum-note'() { openSheet('snote'); },
    'snote-save'() {
      D().notes = document.getElementById('sNotes').value.trim();
      save();
      closeSheet();
    },
    settings() { openSheet('settings'); },
    'settings-save'() {
      const bw = document.getElementById('sBw').value;
      let clamped = false;
      if (bw === '') S.settings.bodyweight_kg = null;
      else {
        const n = Number(bw);
        S.settings.bodyweight_kg = fit(n, LIM.bw, '체중을', (x) => x + 'kg');
        clamped = S.settings.bodyweight_kg !== n;
      }
      S.settings.sound = document.getElementById('sSound').checked;
      S.settings.haptic = document.getElementById('sHaptic').checked;
      save(true);
      closeSheet();
      if (!clamped) toast('설정을 저장했어요');
    },
    export() {
      const data = { version: Dt.VERSION, exported_at: new Date().toISOString(), settings: S.settings, increments: S.increments, sessions: S.sessions };
      const text = JSON.stringify(data, null, 2);
      const fallback = () => {
        ui.exportText = text;
        openSheet('export');
        const ta = document.getElementById('exportText');
        if (ta) { ta.focus(); ta.select(); }
      };
      try {
        navigator.clipboard.writeText(text).then(() => toast('기록을 클립보드에 복사했어요'), fallback);
      } catch (e) { fallback(); }
    },
    wipe() {
      if (!confirm('세션 기록·진행 중 세션·설정을 모두 지울까요? 되돌릴 수 없어요.')) return;
      if (!confirm('정말 지울까요? 먼저 기록 복사를 해 두는 것을 권해요.')) return;
      S = Dt.emptyStore();
      E.setUnit('kg');
      save(true);
      closeSheet();
    },
  };


  function dockSig() {
    const all = app.querySelectorAll('.dock .cta');
    const b = all[all.length - 1];
    return b ? b.dataset.act + '|' + (b.dataset.uid || '') : '';
  }

  function dispatch(e) {
    let el = e.target.closest('[data-act]');
    const viaSwitch = e.type === 'change' && e.target.matches('.hx__sw');
    if (viaSwitch) {
      e.target.checked = false;
      el = e.target.previousElementSibling;
    }
    if (!el || el.disabled) return;
    if (e.type === 'click' && !hxSwitch && el.parentNode.classList.contains('hx')) navigator.vibrate(15);
    const act = el.dataset.act;
    if (e.type === 'change' && !viaSwitch && el.tagName !== 'SELECT') return;
    if (e.type === 'click' && el.tagName === 'SELECT') return;
    const fn = A[act];
    if (!fn) return;
    if (Date.now() < ui.lockUntil && el.closest('.dock') && !el.classList.contains('rnd')) return;
    const before = dockSig();
    fn(el.dataset, el);
    render();
    if (dockSig() !== before) ui.lockUntil = Date.now() + LOCK_MS;
    replaceToast();
  }

  document.addEventListener('click', dispatch);
  document.addEventListener('change', dispatch);

  function fitStoredTime() {
    const fit = (sec) => (typeof sec === 'number' && isFinite(sec) ? clampMin(Math.round(sec / 60)) * 60 : sec);
    S.settings.target_sec = fit(S.settings.target_sec);
    if (S.draft && S.draft.target_sec != null) {
      const was = S.draft.target_sec;
      S.draft.target_sec = fit(was);
      if (S.draft.target_sec !== was && S.draft.phase === 'plan') fitToTime(true);
    }
  }

  fitStoredTime();
  endIfIdle();
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

  function loadRepoRecords() {
    if (typeof fetch !== 'function') return;
    const get1 = (url) => fetch(url, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    get1('records/index.json').then((list) => {
      if (!Array.isArray(list)) return;
      const names = list.filter((n) => typeof n === 'string' && /^[A-Za-z0-9._-]+\.json$/.test(n) && n !== 'index.json');
      return Promise.all(names.map((n) => get1('records/' + n)));
    }).then((files) => {
      if (!files) return;
      const incoming = [];
      files.forEach((data) => {
        if (!data) return;
        const r = Dt.parseImport(data, window.Catalog);
        if (!r.error) r.sessions.forEach((s) => incoming.push(s));
      });
      if (!incoming.length) return;
      const m = Dt.addMissing(S.sessions, incoming);
      if (!m.added) return;
      S.sessions = m.sessions;
      save(true);
      if (!S.draft && !ui.sheetKind) render();
    }).catch(() => {});
  }
  loadRepoRecords();
})();
