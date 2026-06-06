(() => {
  const cover = document.querySelector('.section--cover');
  const recall = document.querySelector('.recall');
  const body = document.body;
  if (!cover) return;

  let revealed = false;
  let touchStartY = null;
  let dragOffset = 0;

  const reveal = () => {
    if (revealed) return;
    revealed = true;
    cover.classList.remove('is-dragging');
    cover.style.transform = '';
    cover.classList.add('is-revealed');
    setTimeout(() => body.classList.add('is-revealed'), 600);
  };

  const conceal = () => {
    if (!revealed) return;
    revealed = false;
    body.classList.remove('is-revealed');
    cover.classList.remove('is-revealed');
    window.scrollTo({ top: 0 });
  };

  cover.addEventListener('touchstart', (e) => {
    if (revealed) return;
    touchStartY = e.touches[0].clientY;
    cover.classList.add('is-dragging');
  }, { passive: true });

  cover.addEventListener('touchmove', (e) => {
    if (revealed || touchStartY === null) return;
    const delta = e.touches[0].clientY - touchStartY;
    if (delta < 0) {
      dragOffset = delta;
      cover.style.transform = `translateY(${delta}px)`;
    }
  }, { passive: true });

  cover.addEventListener('touchend', () => {
    if (revealed || touchStartY === null) return;
    cover.classList.remove('is-dragging');
    if (dragOffset < -80) {
      reveal();
    } else {
      cover.style.transform = '';
    }
    touchStartY = null;
    dragOffset = 0;
  });

  recall?.addEventListener('click', conceal);

  window.addEventListener('wheel', (e) => {
    if (!revealed && e.deltaY > 10) {
      reveal();
    } else if (revealed && window.scrollY <= 0 && e.deltaY < -20) {
      conceal();
    }
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (!revealed) {
      if (['ArrowDown', 'PageDown', 'Space', 'Enter'].includes(e.code)) reveal();
    } else if (window.scrollY <= 0 && ['ArrowUp', 'PageUp', 'Home'].includes(e.code)) {
      conceal();
    }
  });

  // Time-of-day tint
  const applyTimeTone = () => {
    const hour = new Date().getHours();
    let bg = '#ffffff';
    let slot = '#f0f0f0';
    if (hour >= 5 && hour < 9)        { bg = '#fafbff'; slot = '#ecedf2'; } // dawn
    else if (hour >= 9 && hour < 16)  { bg = '#ffffff'; slot = '#f0f0f0'; } // day
    else if (hour >= 16 && hour < 19) { bg = '#fdf8f2'; slot = '#f0e9df'; } // dusk
    else                              { bg = '#f5f4f8'; slot = '#e8e7ec'; } // night
    const root = document.documentElement.style;
    root.setProperty('--tone-bg', bg);
    root.setProperty('--tone-slot', slot);
  };
  applyTimeTone();
  setInterval(applyTimeTone, 60_000);

  // Live D-day  (TODO: replace with actual ceremony datetime)
  const ddayEl = document.querySelector('.dday');
  if (ddayEl) {
    const ceremony = new Date('2026-11-28T11:00:00');
    const pad = (n) => String(n).padStart(2, '0');
    const updateDday = () => {
      const diff = ceremony - new Date();
      if (diff <= 0) { ddayEl.textContent = 'D-DAY'; return; }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      ddayEl.textContent = `D-${d} · ${pad(h)}:${pad(m)}:${pad(s)}`;
    };
    updateDday();
    setInterval(updateDday, 1_000);
  }

  // Scroll reveal sections
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.section:not(.section--cover)').forEach((s) => io.observe(s));
})();
