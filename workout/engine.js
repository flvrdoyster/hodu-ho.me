(function () {
  const get = (id) => window.Catalog.get(id);
  const round = (x) => Math.round(x * 100) / 100;
  const isNum = (s) => typeof s.weight_kg === 'number' && isFinite(s.weight_kg);
  const eq = (a, b) => Math.abs(a - b) < 0.1;
  const KG_PER_LB = 0.45359237;
  let unit = 'kg';

  function setUnit(u) {
    unit = u === 'lbs' ? 'lbs' : 'kg';
  }

  function lbsToKg(lbs) {
    return round(Number(lbs) * KG_PER_LB);
  }

  function kgToDisp(kg, digits) {
    const n = Number(kg);
    if (unit === 'lbs') return Math.round(n / KG_PER_LB / 5) * 5;
    const f = Math.pow(10, digits == null ? 1 : digits);
    return Math.round(n * f) / f;
  }

  function dispToKg(v) {
    const n = Number(v);
    return unit === 'lbs' ? lbsToKg(n) : n;
  }

  function fmtInc(inc) {
    return kgToDisp(Math.abs(inc)) + unit;
  }

  function eff(id, increments) {
    const base = get(id);
    const v = increments && increments[id];
    const increment = typeof v === 'number' && isFinite(v) && v > 0 ? v : base.increment;
    return Object.assign({}, base, { id, increment });
  }

  const isTimed = (def) => def.measure === 'seconds';
  const fmtMin = (sec) => Math.round(sec / 60) + '분';

  function fmtW(ex, w) {
    if (w == null || w === '') return '무게 미정';
    return (ex.load === 'assist' ? '보조 ' : '') + kgToDisp(w) + unit;
  }

  function history(sessions, id) {
    const out = [];
    for (let i = sessions.length - 1; i >= 0; i--) {
      const s = sessions[i];
      const ex = (s.exercises || []).find((e) => e.exercise_id === id);
      if (!ex) continue;
      if (ex.sets && ex.sets.some((x) => isNum(x) || typeof x.duration_sec === 'number')) out.push({ date: s.date, ex, session: s });
    }
    return out;
  }

  function hasWeightFor(id, sessions) {
    return isTimed(get(id)) || history(sessions, id).length > 0;
  }

  function workSets(ex) {
    return (ex.sets || []).filter((s) => !s.is_warmup && isNum(s));
  }

  function atWorkingWeight(ex) {
    const ws = workSets(ex);
    if (!ws.length) return { w: null, sets: [] };
    const w = ws[ws.length - 1].weight_kg;
    return { w, sets: ws.filter((s) => eq(s.weight_kg, w)) };
  }

  function repsText(ex, w, sets) {
    const reps = sets.map((s) => s.reps);
    const same = reps.every((r) => r === reps[0]);
    return fmtW(ex, w) + ' × ' + (same ? reps[0] + '회 × ' + reps.length + '세트' : reps.join('/') + '회');
  }

  function failCount(sets, min) {
    return sets.filter((s) => s.reps < min).length;
  }

  function doubleRule(def, hist) {
    const [min, max] = def.rep_range;
    const last = atWorkingWeight(hist[0].ex);
    if (!last.sets.length) {
      const all = (hist[0].ex.sets || []).filter(isNum);
      const w = all[all.length - 1].weight_kg;
      return { weight: w, reps: min, reason: '지난 세션 본세트 없음 → 마지막 무게 ' + fmtW(def, w) };
    }
    const w = last.w;
    const sets = last.sets;
    const txt = '지난 세션 ' + repsText(def, w, sets);
    const inc = def.load === 'assist' ? -def.increment : def.increment;
    const step = (inc > 0 ? '+' : '-') + fmtInc(inc);

    if (sets.every((s) => s.reps >= max)) {
      if (sets.length < def.default_sets) {
        return { weight: w, reps: max, reason: txt + ' 상한 달성, 세트 수 부족 → 무게 유지', kind: 'hold' };
      }
      if (sets.some((s) => s.feel === 'heavy')) {
        return { weight: w, reps: max, reason: txt + ' 상한 달성, 체감 무거움 → 증량 한 세션 미룸', kind: 'wait' };
      }
      return { weight: Math.max(0, round(w + inc)), reps: min, reason: txt + ' 전부 상한 달성 → ' + step, kind: 'up' };
    }
    if (failCount(sets, min) >= 2) {
      const prev = hist[1] && atWorkingWeight(hist[1].ex);
      if (prev && prev.w != null && eq(prev.w, w) && failCount(prev.sets, min) >= 2) {
        return { weight: Math.max(0, round(w - inc)), reps: min, reason: txt + ', 2회 연속 하한 미달 → ' + (inc > 0 ? '-' : '+') + fmtInc(inc), kind: 'down' };
      }
      return { weight: w, reps: min, reason: txt + ', 하한 미달 세트 2개 이상 → 무게 유지', kind: 'fail' };
    }
    if (sets.every((s) => s.reps >= min)) {
      const low = Math.min(...sets.map((s) => s.reps));
      return { weight: w, reps: Math.min(max, low + 1), reason: txt + ' 범위 안 → 무게 유지, 목표 +1회', kind: 'reps' };
    }
    return { weight: w, reps: min, reason: txt + ', 하한 미달 1세트 → 무게 유지', kind: 'fail' };
  }

  function linearRule(def, hist) {
    const reps = def.rep_range[0];
    const last = atWorkingWeight(hist[0].ex);
    if (!last.sets.length) {
      const all = (hist[0].ex.sets || []).filter(isNum);
      const w0 = all[all.length - 1].weight_kg;
      return { weight: w0, reps, reason: '지난 세션 본세트 없음 → 마지막 무게 ' + fmtW(def, w0) };
    }
    const w = last.w;
    const txt = '지난 세션 ' + repsText(def, w, last.sets);
    const missed = (sets) => sets.some((s) => s.reps < reps);
    if (!missed(last.sets)) {
      if (last.sets.length < def.default_sets) return { weight: w, reps, reason: txt + ' 달성, 세트 수 부족 → 무게 유지', kind: 'hold' };
      if (last.sets.some((s) => s.feel === 'heavy')) return { weight: w, reps, reason: txt + ' 달성, 체감 무거움 → 증량 한 세션 미룸', kind: 'wait' };
      return { weight: round(w + def.increment), reps, reason: txt + ' 전부 달성 → +' + fmtInc(def.increment), kind: 'up' };
    }
    const prev = hist[1] && atWorkingWeight(hist[1].ex);
    if (prev && prev.w != null && eq(prev.w, w) && prev.sets.length && missed(prev.sets)) {
      const down = Math.round(w * 0.9 / def.increment) * def.increment;
      return { weight: round(down), reps, reason: txt + ', 2회 연속 ' + reps + '회 미달 → 10% 감량', kind: 'down' };
    }
    return { weight: w, reps, reason: txt + ', ' + reps + '회 못 채운 세트 있음 → 무게 유지', kind: 'fail' };
  }

  function recommend(id, sessions, increments) {
    const def = eff(id, increments);
    const hist = history(sessions, id);
    const base = { exercise_id: id, sets: def.default_sets || 1 };

    if (isTimed(def)) {
      const last = hist.length ? hist[0].ex.sets.filter((x) => typeof x.duration_sec === 'number').pop() : null;
      const d = last ? last.duration_sec : def.default_duration_sec;
      return Object.assign(base, { weight: null, reps: null, duration_sec: d, reason: last ? '지난 세션 ' + fmtMin(d) : '기본 ' + fmtMin(d) });
    }

    if (!hist.length) {
      return Object.assign(base, { weight: null, reps: def.rep_range[0], reason: '기록 없음 → 시작 무게를 입력해 주세요' });
    }

    if (def.progression === 'double') return Object.assign(base, doubleRule(def, hist));

    if (def.progression === 'linear') return Object.assign(base, linearRule(def, hist));

    const last = atWorkingWeight(hist[0].ex);
    const w = last.sets.length ? last.w : null;
    const low = last.sets.length ? Math.min(...last.sets.map((s) => s.reps)) : def.rep_range[0];
    const reps = Math.max(def.rep_range[0], Math.min(def.rep_range[1], low));
    return Object.assign(base, { weight: w, reps, reason: last.sets.length ? '지난 세션 ' + repsText(def, w, last.sets) + ' → 같은 값' : '등록된 기준값' });
  }

  function lastUsed(sessions, ids) {
    let best = null;
    let bestDate = '';
    ids.forEach((id) => {
      const h = history(sessions, id);
      if (h.length && h[0].date > bestDate) { best = id; bestDate = h[0].date; }
    });
    return best;
  }

  function setsInDays(sessions, pattern, today, days) {
    const from = new Date(today + 'T00:00:00');
    from.setDate(from.getDate() - days);
    const fromStr = localDate(from);
    let n = 0;
    sessions.forEach((s) => {
      if (s.date <= fromStr || s.date > today) return;
      (s.exercises || []).forEach((e) => {
        const def = get(e.exercise_id);
        if (def && def.pattern === pattern) n += workSets(e).length;
      });
    });
    return n;
  }

  const PATTERN_NAME = {
    vertical_pull: '수직 당기기', horizontal_pull: '수평 당기기', horizontal_push: '수평 밀기',
    vertical_push: '수직 밀기', rear_delt: '후면 어깨', lateral_delt: '측면 어깨',
    elbow_extension: '삼두', elbow_flexion: '이두', squat: '스쿼트', hinge: '힌지',
    lunge: '런지', knee_extension: '대퇴사두', knee_flexion: '햄스트링', calf: '종아리',
    core: '코어', cardio: '유산소',
  };

  const PATTERN_ORDER = [
    'vertical_pull', 'horizontal_pull', 'horizontal_push', 'vertical_push', 'rear_delt', 'lateral_delt',
    'elbow_extension', 'elbow_flexion', 'squat', 'hinge', 'lunge', 'knee_extension', 'knee_flexion',
    'calf', 'core', 'cardio',
  ];

  function pickable(id) {
    return !!get(id) && !get(id).unsupported;
  }

  function candidates(slot) {
    if (slot.balance) return slot.balance.filter(pickable);
    return [slot.default].concat(slot.alts || []).filter(pickable);
  }

  function buildSession(type, sessions, today, increments) {
    const tpl = window.TEMPLATES[type];
    return tpl.slots.map((slot, i) => {
      let id;
      let pre = '';
      if (slot.balance) {
        const counts = slot.balance.map((x) => setsInDays(sessions, get(x).pattern, today, 7));
        const k = counts.indexOf(Math.min(...counts));
        id = slot.balance[k];
        pre = '최근 7일 ' + PATTERN_NAME[get(id).pattern] + ' ' + counts[k] + '세트 · ';
      } else {
        id = lastUsed(sessions, candidates(slot)) || slot.default;
      }
      const r = recommend(id, sessions, increments);
      return Object.assign(r, { slot: i, priority: slot.priority, pre });
    });
  }

  function stage(reps, target) {
    if (!target || reps < target) return 'below';
    if (reps === target) return 'goal';
    if (reps - target <= 2) return 'over1';
    return 'over2';
  }

  function gaps(sets) {
    const t = (sets || []).filter((x) => x.at).map((x) => new Date(x.at).getTime());
    const out = [];
    for (let i = 1; i < t.length; i++) {
      const g = (t[i] - t[i - 1]) / 1000;
      if (g > 0 && g <= 600) out.push(g);
    }
    return out;
  }

  function setSec(id, sessions, current, fallback) {
    const g = gaps(current);
    for (const h of history(sessions, id).slice(0, 3)) g.push(...gaps(h.ex.sets));
    return g.length ? Math.round(g.reduce((a, b) => a + b, 0) / g.length) : fallback;
  }

  function localDate(d) {
    const z = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }

  window.Engine = {
    fmtW, fmtMin, isTimed, setUnit, lbsToKg, kgToDisp, dispToKg, fmtInc, eff, eq, history, hasWeightFor, workSets, recommend, buildSession,
    candidates, pickable, stage, setSec, localDate, PATTERN_NAME, PATTERN_ORDER, round,
  };
})();
