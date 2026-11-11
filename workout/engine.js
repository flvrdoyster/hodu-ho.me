(function () {
  const C = window.CATALOG;
  const round = (x) => Math.round(x * 100) / 100;
  const isNum = (s) => typeof s.weight === 'number' && isFinite(s.weight);

  function fmtW(ex, w) {
    if (w == null || w === '') return '—';
    if (ex.unit === 'min') return w + '분';
    const n = round(Number(w));
    return (ex.assisted ? '보조 ' : '') + n + ex.unit;
  }

  function convert(ex, w) {
    if (ex.unit === 'lb' && w != null) return '≈ ' + round(Number(w) * 0.4536).toFixed(1) + 'kg';
    return '';
  }

  function history(sessions, id) {
    const out = [];
    for (let i = sessions.length - 1; i >= 0; i--) {
      const s = sessions[i];
      const ex = (s.exercises || []).find((e) => e.exercise_type === id);
      if (!ex) continue;
      if ((ex.sets && ex.sets.some(isNum)) || ex.duration_min != null) out.push({ date: s.date, ex });
    }
    return out;
  }

  function workSets(ex) {
    return (ex.sets || []).filter((s) => !s.is_warmup && isNum(s));
  }

  function atWorkingWeight(ex) {
    const ws = workSets(ex);
    if (!ws.length) return { w: null, sets: [] };
    const w = ws[ws.length - 1].weight;
    return { w, sets: ws.filter((s) => s.weight === w) };
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
      const all = hist[0].ex.sets || [];
      const w = all.length ? all[all.length - 1].weight : def.estimate;
      return { weight: w, reps: min, reason: '지난 세션 본세트 없음 → 마지막 무게 ' + fmtW(def, w) };
    }
    const w = last.w;
    const sets = last.sets;
    const txt = '지난 세션 ' + repsText(def, w, sets);
    const inc = def.increment;
    const step = (inc > 0 ? '+' : '') + inc + (def.unit === 'lb' ? 'lb' : 'kg');

    if (sets.every((s) => s.reps >= max)) {
      if (sets.length < def.default_sets) {
        return { weight: w, reps: max, reason: txt + ' 상한 달성, 세트 수 부족 → 무게 유지', kind: 'hold' };
      }
      if (sets.some((s) => s.feel === 'heavy')) {
        return { weight: w, reps: max, reason: txt + ' 상한 달성, 체감 무거움 → 증량 한 세션 미룸', kind: 'wait' };
      }
      return { weight: round(w + inc), reps: min, reason: txt + ' 전부 상한 달성 → ' + step, kind: 'up' };
    }
    if (failCount(sets, min) >= 2) {
      const prev = hist[1] && atWorkingWeight(hist[1].ex);
      if (prev && prev.w === w && failCount(prev.sets, min) >= 2) {
        return { weight: round(w - inc), reps: min, reason: txt + ', 2회 연속 하한 미달 → ' + (inc > 0 ? '-' : '+') + Math.abs(inc) + (def.unit === 'lb' ? 'lb' : 'kg'), kind: 'down' };
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
    if (!last.sets.length) return { weight: def.baseline, reps, reason: '지난 세션 본세트 없음 → 등록된 작업 무게 ' + fmtW(def, def.baseline) };
    const w = last.w;
    const txt = '지난 세션 ' + repsText(def, w, last.sets);
    const missed = (sets) => sets.some((s) => s.reps < reps);
    if (!missed(last.sets)) {
      if (last.sets.length < def.default_sets) return { weight: w, reps, reason: txt + ' 달성, 세트 수 부족 → 무게 유지', kind: 'hold' };
      if (last.sets.some((s) => s.feel === 'heavy')) return { weight: w, reps, reason: txt + ' 달성, 체감 무거움 → 증량 한 세션 미룸', kind: 'wait' };
      return { weight: round(w + def.increment), reps, reason: txt + ' 전부 달성 → +' + def.increment + def.unit, kind: 'up' };
    }
    const prev = hist[1] && atWorkingWeight(hist[1].ex);
    if (prev && prev.w === w && prev.sets.length && missed(prev.sets)) {
      const down = Math.round(w * 0.9 / def.increment) * def.increment;
      return { weight: round(down), reps, reason: txt + ', 2회 연속 ' + reps + '회 미달 → 10% 감량', kind: 'down' };
    }
    return { weight: w, reps, reason: txt + ', ' + reps + '회 못 채운 세트 있음 → 무게 유지', kind: 'fail' };
  }

  function recommend(id, sessions) {
    const def = C[id];
    const hist = history(sessions, id);
    const base = { exercise_type: id, sets: def.default_sets || 1, rest_sec: def.rest_sec || 0 };

    if (def.unit === 'min') {
      const d = hist.length && hist[0].ex.duration_min != null ? hist[0].ex.duration_min : def.baseline;
      return Object.assign(base, { weight: null, reps: null, duration: d, reason: hist.length ? '지난 세션 ' + d + '분' : '기본 ' + d + '분' });
    }

    if (!hist.length) {
      if (def.baseline != null) {
        return Object.assign(base, { weight: def.baseline, reps: def.rep_range[0], reason: '기록 없음 → 등록된 작업 무게 ' + fmtW(def, def.baseline) });
      }
      return Object.assign(base, { weight: def.estimate, reps: def.rep_range[0], reason: '기록 없음 → 추정 무게 ' + fmtW(def, def.estimate) });
    }

    if (def.progression === 'double') return Object.assign(base, doubleRule(def, hist));

    if (def.progression === 'linear') return Object.assign(base, linearRule(def, hist));

    const last = atWorkingWeight(hist[0].ex);
    const w = last.sets.length ? last.w : def.baseline;
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
        const def = C[e.exercise_type];
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

  function candidates(slot) {
    if (slot.balance) return slot.balance.filter((id) => C[id]);
    return [slot.default].concat(slot.alts || []).filter((id) => C[id]);
  }

  function buildSession(type, sessions, today) {
    const tpl = window.TEMPLATES[type];
    return tpl.slots.map((slot, i) => {
      let id;
      let pre = '';
      if (slot.balance) {
        const counts = slot.balance.map((x) => setsInDays(sessions, C[x].pattern, today, 7));
        const k = counts.indexOf(Math.min(...counts));
        id = slot.balance[k];
        pre = '최근 7일 ' + PATTERN_NAME[C[id].pattern] + ' ' + counts[k] + '세트 · ';
      } else {
        id = lastUsed(sessions, candidates(slot)) || slot.default;
      }
      const r = recommend(id, sessions);
      r.reason = pre + r.reason;
      return Object.assign(r, { slot: i, priority: slot.priority });
    });
  }

  function stage(reps, target) {
    if (!target || reps < target) return 'below';
    if (reps === target) return 'goal';
    if (reps - target <= 2) return 'over1';
    return 'over2';
  }

  function estimateMin(items) {
    let sec = 0;
    items.forEach((it) => {
      if (it.status === 'skipped') return;
      if (C[it.exercise_type].unit === 'min') sec += (it.target.duration || 0) * 60;
      else sec += it.target.sets * (it.target.rest_sec + 40);
    });
    return Math.round(sec / 60);
  }

  function localDate(d) {
    const z = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }

  window.Engine = {
    fmtW, convert, history, workSets, recommend, buildSession,
    candidates, stage, estimateMin, localDate, PATTERN_NAME, round,
  };
})();
