(() => {
  const STORAGE_KEY = 'pullup_data_v1';

  const DEFAULT_DATA = {
    settings: {
      targetSets: 6,
      targetReps: 8,
      restSeconds: 150,
      hasThinnerBand: false,
      blackOwned: 2,
      greenOwned: 1,
      sheetsUrl: '',
      dismissedDowngradeFor: null,
    },
    draft: null,
    sessions: [],
  };

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_DATA);
      const parsed = JSON.parse(raw);
      return {
        settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) },
        draft: parsed.draft || null,
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      };
    } catch {
      return structuredClone(DEFAULT_DATA);
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  let data = loadData();

  const pad = (n) => String(n).padStart(2, '0');

  function dateStr(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function todayStr() { return dateStr(new Date()); }
  function parseDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function formatShort(s) {
    const d = parseDate(s);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  function formatLong(s) {
    const d = parseDate(s);
    const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${week})`;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function beep() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  }

  document.addEventListener('click', ensureAudio, { once: true });

  document.getElementById('todayLabel').textContent = formatLong(todayStr());

  function checkDowngrade(session) {
    const s = data.settings;
    const allMet = session.sets.length >= s.targetSets &&
      session.sets.every((set) => setRom(set) >= s.targetReps);
    if (allMet && s.dismissedDowngradeFor !== session.id) {
      s.suggestDowngradeSessionId = session.id;
    }
  }

  function renderDowngradeBanner() {
    const banner = document.getElementById('downgradeBanner');
    const text = document.getElementById('downgradeText');
    const s = data.settings;
    const pending = s.suggestDowngradeSessionId && s.dismissedDowngradeFor !== s.suggestDowngradeSessionId;

    if (!pending) { banner.hidden = true; return; }

    text.textContent = s.hasThinnerBand
      ? '🎉 마지막 세션, 6세트 모두 여유 있게 완료했어요! 더 얇은 밴드로 교체를 고려해보세요.'
      : '🎉 마지막 세션, 6세트 모두 여유 있게 완료했어요! 더 얇은 밴드가 없다면 다음엔 세트나 횟수를 조금 늘려보세요.';
    banner.hidden = false;
  }

  document.getElementById('downgradeDismiss').addEventListener('click', () => {
    data.settings.dismissedDowngradeFor = data.settings.suggestDowngradeSessionId;
    saveData();
    renderDowngradeBanner();
  });

  function initActiveArray(owned, usedCount) {
    return Array.from({ length: owned }, (_, i) => i < usedCount);
  }

  function syncBandArray(arr, owned) {
    arr = Array.isArray(arr) ? arr.slice(0, owned) : [];
    while (arr.length < owned) arr.push(true);
    return arr;
  }

  function ensureDraft() {
    if (!data.draft) {
      const lastSession = data.sessions[data.sessions.length - 1];
      data.draft = {
        date: todayStr(),
        blackActive: initActiveArray(data.settings.blackOwned, lastSession ? lastSession.black : data.settings.blackOwned),
        greenActive: initActiveArray(data.settings.greenOwned, lastSession ? lastSession.green : data.settings.greenOwned),
        sets: [],
      };
      saveData();
    }
    if (data.draft.sets.length === 0 && data.draft.date !== todayStr()) {
      data.draft.date = todayStr();
    }
    data.draft.blackActive = syncBandArray(data.draft.blackActive, data.settings.blackOwned);
    data.draft.greenActive = syncBandArray(data.draft.greenActive, data.settings.greenOwned);
    return data.draft;
  }

  function activeCount(arr) { return arr.filter(Boolean).length; }

  function setRom(set) {
    if (typeof set.romReps === 'number') return set.romReps;
    return set.fullROM ? set.reps : 0;
  }

  function bandIconHtml(kind, i, on, isGroupStart) {
    const cls = ['band-icon', `band-icon--${kind}`, on ? '' : 'is-off', isGroupStart ? 'band-icon--group-start' : ''].filter(Boolean).join(' ');
    const label = kind === 'black' ? '검정' : '초록';
    return `<button type="button" class="${cls}" data-kind="${kind}" data-index="${i}" aria-pressed="${on}" aria-label="${label} 밴드 ${i + 1} ${on ? '사용 중' : '미사용'}">${on ? '✓' : i + 1}</button>`;
  }

  function renderBandPicker() {
    const draft = ensureDraft();
    const blackHtml = draft.blackActive.map((on, i) => bandIconHtml('black', i, on, false)).join('');
    const greenHtml = draft.greenActive.map((on, i) => bandIconHtml('green', i, on, i === 0 && draft.blackActive.length > 0)).join('');
    document.getElementById('bandIcons').innerHTML = blackHtml + greenHtml;
  }

  document.getElementById('bandIcons').addEventListener('click', handleBandToggle);
  function handleBandToggle(e) {
    const btn = e.target.closest('.band-icon');
    if (!btn) return;
    const draft = ensureDraft();
    const arr = btn.dataset.kind === 'black' ? draft.blackActive : draft.greenActive;
    const i = Number(btn.dataset.index);
    arr[i] = !arr[i];
    saveData();
    renderBandPicker();
  }

  function renderTargetLabel() {
    const s = data.settings;
    document.getElementById('targetLabel').textContent = `목표 ${s.targetSets}세트 × ${s.targetReps}회`;
  }

  function romIcon(set) {
    const partial = set.reps - setRom(set);
    return partial > 0
      ? `<span class="set-row__rom set-row__rom--no">부분 ${partial}</span>`
      : '<span class="set-row__rom set-row__rom--yes">✅ 전부 Full ROM</span>';
  }

  function renderSetList() {
    const draft = ensureDraft();
    const list = document.getElementById('setList');
    list.innerHTML = draft.sets.map((set, i) => `
      <li class="set-row">
        <span class="set-row__num">${i + 1}</span>
        <span class="set-row__reps">${setRom(set)}회</span>
        ${romIcon(set)}
        <span class="set-row__bands">
          <span class="chip chip--black">검${set.black}</span>
          <span class="chip chip--green">초${set.green}</span>
        </span>
        <button type="button" class="set-row__del" data-index="${i}" aria-label="세트 삭제">✕</button>
      </li>
    `).join('');

    list.querySelectorAll('.set-row__del').forEach((btn) => {
      btn.addEventListener('click', () => {
        draft.sets.splice(Number(btn.dataset.index), 1);
        saveData();
        renderAll();
      });
    });

    document.getElementById('finishBtn').disabled = draft.sets.length === 0;

    const warn = document.getElementById('dropWarning');
    if (draft.sets.length >= 2) {
      const prev = setRom(draft.sets[draft.sets.length - 2]);
      const cur = setRom(draft.sets[draft.sets.length - 1]);
      warn.hidden = !(prev > 0 && cur <= prev * 0.6);
    } else {
      warn.hidden = true;
    }

  }

  const figure = Figure.create(document.getElementById('figure'), EXERCISES.pullup);

  let resting = false;

  function setMode(rest) {
    resting = rest;
    document.getElementById('setForm').hidden = rest;
    document.getElementById('timer').hidden = !rest;
    figure.rest(rest);
  }

  let repLog = [];

  const romCount = () => repLog.filter(Boolean).length;
  const partialCount = () => repLog.length - romCount();

  const counterEl = document.querySelector('.counter');
  const repsValueEl = document.getElementById('repsValue');
  const repsGoalEl = document.getElementById('repsGoal');
  const repsPartialEl = document.getElementById('repsPartial');

  function effortStage() {
    const over = romCount() - data.settings.targetReps;
    if (romCount() === 0 || over < 0) return '';
    if (over === 0) return 'goal';
    if (over < 3) return 'over1';
    return 'over2';
  }

  function renderReps() {
    repsValueEl.textContent = romCount();
    repsGoalEl.textContent = `목표 ${data.settings.targetReps}`;
    repsPartialEl.textContent = `부분 ${partialCount()}회`;
    repsPartialEl.hidden = partialCount() === 0;

    document.getElementById('logSetBtn').disabled = repLog.length === 0;
    document.getElementById('repUndo').disabled = repLog.length === 0;

    const stage = effortStage();
    for (const st of ['goal', 'over1', 'over2']) counterEl.classList.toggle(`is-${st}`, st === stage);
    figure.effort(stage);
  }

  function bumpCounter() {
    counterEl.classList.add('is-bumped');
    setTimeout(() => counterEl.classList.remove('is-bumped'), 120);
  }

  function spillSweat() {
    const over = romCount() - data.settings.targetReps;
    if (over > 0) figure.sweat(over >= 3 ? 3 : 2);
  }

  function countRep(isFullRom) {
    if (resting || repLog.length >= 99) return;
    repLog.push(isFullRom);
    renderReps();
    bumpCounter();
    figure.rep(isFullRom);
    spillSweat();
  }

  document.getElementById('repFullBtn').addEventListener('click', () => countRep(true));
  document.getElementById('repPartialBtn').addEventListener('click', () => countRep(false));
  figure.el.addEventListener('click', () => countRep(true));

  document.getElementById('repUndo').addEventListener('click', () => {
    repLog.pop();
    renderReps();
  });

  document.getElementById('setForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const draft = ensureDraft();
    if (repLog.length === 0) return;

    draft.sets.push({
      reps: repLog.length,
      romReps: romCount(),
      black: activeCount(draft.blackActive),
      green: activeCount(draft.greenActive),
    });
    saveData();

    repLog = [];
    renderAll();

    rewindTimer();
    setMode(true);
    if (draft.sets.length < data.settings.targetSets) startTimer();
  });

  let timerRemaining = data.settings.restSeconds;
  let timerTotal = data.settings.restSeconds;
  let timerInterval = null;
  let timerRunning = false;

  function renderTimer() {
    const m = Math.floor(Math.max(timerRemaining, 0) / 60);
    const s = Math.max(timerRemaining, 0) % 60;
    document.getElementById('timerDisplay').textContent = `${pad(m)}:${pad(s)}`;
    document.getElementById('timerFill').style.width = `${Math.max(0, (timerRemaining / timerTotal) * 100)}%`;
    document.getElementById('timerToggle').textContent = timerRunning ? '일시정지' : '시작';
  }

  function startTimer() {
    if (timerRunning) return;
    ensureAudio();
    timerRunning = true;
    timerInterval = setInterval(() => {
      timerRemaining -= 1;
      if (timerRemaining <= 0) {
        endRest();
        beep();
        return;
      }
      renderTimer();
    }, 1000);
    renderTimer();
  }
  function stopTimer() {
    timerRunning = false;
    clearInterval(timerInterval);
    renderTimer();
  }
  function rewindTimer() {
    timerTotal = data.settings.restSeconds;
    timerRemaining = timerTotal;
    renderTimer();
  }
  function endRest() {
    stopTimer();
    rewindTimer();
    setMode(false);
  }

  document.getElementById('timerToggle').addEventListener('click', () => {
    timerRunning ? stopTimer() : startTimer();
  });
  document.getElementById('timerReset').addEventListener('click', rewindTimer);
  document.getElementById('nextSetBtn').addEventListener('click', endRest);
  document.getElementById('timerAdd').addEventListener('click', () => {
    timerRemaining += 30;
    timerTotal = Math.max(timerTotal, timerRemaining);
    renderTimer();
  });

  function syncSessionToSheets(session) {
    const url = data.settings.sheetsUrl;
    if (!url) return;
    session.sets.forEach((set, i) => {
      const row = {
        date: session.date,
        setNumber: i + 1,
        reps: set.reps,
        romReps: setRom(set),
        black: set.black,
        green: set.green,
        restSeconds: data.settings.restSeconds,
        note: '',
      };
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      }).catch(() => {});
    });
  }

  document.getElementById('finishBtn').addEventListener('click', () => {
    const draft = ensureDraft();
    if (draft.sets.length === 0) return;
    if (!confirm('오늘 운동을 종료하고 저장할까요?')) return;

    const session = {
      id: uid(),
      date: draft.date,
      black: activeCount(draft.blackActive),
      green: activeCount(draft.greenActive),
      sets: draft.sets,
    };
    data.sessions.push(session);
    data.draft = null;
    checkDowngrade(session);
    saveData();
    syncSessionToSheets(session);
    endRest();
    renderAll();
  });

  function fullRomTotal(session) {
    return session.sets.reduce((sum, s) => sum + setRom(s), 0);
  }

  function renderChart() {
    const chart = document.getElementById('chart');
    const empty = document.getElementById('chartEmpty');
    const sessions = data.sessions.slice(-12);

    if (sessions.length === 0) {
      chart.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    const values = sessions.map(fullRomTotal);
    const max = Math.max(1, ...values);
    const W = 320, H = 140, padX = 8, padY = 10, gap = 8;
    const barW = (W - padX * 2 - gap * (sessions.length - 1)) / sessions.length;

    const bars = sessions.map((session, i) => {
      const v = values[i];
      const h = (v / max) * (H - padY * 2 - 16);
      const x = padX + i * (barW + gap);
      const y = H - padY - h;
      const color = v > 0 ? 'var(--accent)' : 'var(--line)';
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 2)}" rx="3" fill="${color}"></rect>
        <text x="${x + barW / 2}" y="${y - 4}" font-size="10" text-anchor="middle" fill="var(--ink)">${v}</text>
        <text x="${x + barW / 2}" y="${H - 1}" font-size="9" text-anchor="middle" fill="var(--muted)">${formatShort(session.date)}</text>
      `;
    }).join('');

    chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${bars}</svg>`;
  }

  function renderHistory() {
    const list = document.getElementById('historyList');
    const empty = document.getElementById('historyEmpty');
    const sessions = [...data.sessions].reverse();

    if (sessions.length === 0) {
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    list.innerHTML = sessions.map((session) => {
      const romSets = session.sets.filter((s) => setRom(s) > 0).length;
      const setsDetail = session.sets.map((s, i) =>
        `<li>${i + 1}세트 · Full ROM ${setRom(s)}회${s.reps - setRom(s) > 0 ? ` (부분 ${s.reps - setRom(s)})` : ''} · 검${s.black}+초${s.green}</li>`
      ).join('');
      return `
        <li class="history__item">
          <details>
            <summary>
              <span>${formatLong(session.date)} · ${session.sets.length}세트 · Full ROM ${romSets}세트</span>
              <span class="arrow">▾</span>
            </summary>
            <div class="history__body">
              <ul class="history__sets">${setsDetail}</ul>
              <button type="button" class="history__delete" data-id="${session.id}">이 기록 삭제</button>
            </div>
          </details>
        </li>
      `;
    }).join('');

    list.querySelectorAll('.history__delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!confirm('이 운동 기록을 삭제할까요?')) return;
        data.sessions = data.sessions.filter((s) => s.id !== btn.dataset.id);
        saveData();
        renderAll();
      });
    });
  }

  const sheet = document.getElementById('settingsSheet');
  function openSettings() {
    document.getElementById('cfgTargetSets').value = data.settings.targetSets;
    document.getElementById('cfgTargetReps').value = data.settings.targetReps;
    document.getElementById('cfgRestSeconds').value = data.settings.restSeconds;
    document.getElementById('cfgHasThinnerBand').checked = data.settings.hasThinnerBand;
    document.getElementById('cfgBlackOwned').value = data.settings.blackOwned;
    document.getElementById('cfgGreenOwned').value = data.settings.greenOwned;
    document.getElementById('cfgSheetsUrl').value = data.settings.sheetsUrl;
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
  }
  function closeSettings() {
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
  }
  document.getElementById('settingsToggle').addEventListener('click', openSettings);
  document.getElementById('settingsClose').addEventListener('click', closeSettings);
  document.getElementById('settingsBackdrop').addEventListener('click', closeSettings);

  function bindSetting(id, key, kind) {
    document.getElementById(id).addEventListener('change', (e) => {
      let v = kind === 'checkbox' ? e.target.checked : Number(e.target.value);
      if (kind === 'text') v = e.target.value.trim();
      data.settings[key] = v;
      saveData();
      renderAll();
    });
  }
  bindSetting('cfgTargetSets', 'targetSets', 'number');
  bindSetting('cfgTargetReps', 'targetReps', 'number');
  bindSetting('cfgRestSeconds', 'restSeconds', 'number');
  bindSetting('cfgHasThinnerBand', 'hasThinnerBand', 'checkbox');
  bindSetting('cfgBlackOwned', 'blackOwned', 'number');
  bindSetting('cfgGreenOwned', 'greenOwned', 'number');
  bindSetting('cfgSheetsUrl', 'sheetsUrl', 'text');

  document.getElementById('cfgRestSeconds').addEventListener('change', () => {
    if (!timerRunning) rewindTimer();
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pullup-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById('importInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.sessions)) throw new Error('invalid');
      if (!confirm('가져온 데이터로 현재 기록을 덮어쓸까요?')) return;
      data = {
        settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) },
        draft: parsed.draft || null,
        sessions: parsed.sessions,
      };
      saveData();
      endRest();
      repLog = [];
      renderAll();
      closeSettings();
    } catch {
      alert('올바른 백업 파일이 아니에요.');
    } finally {
      e.target.value = '';
    }
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('모든 운동 기록과 설정을 삭제할까요? 되돌릴 수 없어요.')) return;
    data = structuredClone(DEFAULT_DATA);
    saveData();
    endRest();
    repLog = [];
    renderAll();
    closeSettings();
  });

  function renderAll() {
    renderDowngradeBanner();
    renderTargetLabel();
    renderBandPicker();
    renderReps();
    renderSetList();
    renderChart();
    renderHistory();
  }

  rewindTimer();
  renderAll();
  setMode(ensureDraft().sets.length > 0);
})();
