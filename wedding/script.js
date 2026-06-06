(() => {
  // ─────────────────────────────────────────────
  //  갤러리 사진 세트 (전체 1~32). 각 세트에서 1장씩 랜덤 추출 →
  //  균형 잡힌 9장이 접속할 때마다 새로 표시됩니다 (세트 순서대로 배치).
  //  번호↔사진 확인: gallery-index.html
  const GALLERY_SETS = [
    [1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11, 12, 13],
    [14, 15, 16, 17],
    [18, 19],
    [20, 21],
    [22, 23, 24, 25],
    [26, 27],
    [28, 29, 30],
    [31, 32],
  ];
  const GALLERY_PICKS = GALLERY_SETS.map(
    (set) => set[Math.floor(Math.random() * set.length)]
  );
  // ─────────────────────────────────────────────

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

  const hint = document.querySelector('.hint');
  hint?.addEventListener('click', reveal);

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

  // Build gallery from GALLERY_PICKS
  const gallery = document.querySelector('.gallery');
  if (gallery) {
    gallery.innerHTML = GALLERY_PICKS.map((n) => {
      const id = String(n).padStart(2, '0');
      return `<button class="gallery__item" type="button"><img src="assets/gallery/gallery-${id}.webp" alt="" loading="lazy"></button>`;
    }).join('');
  }

  // Gallery lightbox
  const lightbox = document.querySelector('.lightbox');
  const lightboxImg = lightbox?.querySelector('.lightbox__img');
  if (gallery && lightbox && lightboxImg) {
    const openLightbox = (img) => {
      lightboxImg.src = img.currentSrc || img.src;
      lightboxImg.alt = img.alt || '';
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
    };
    const closeLightbox = () => {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
    };
    gallery.addEventListener('click', (e) => {
      const item = e.target.closest('.gallery__item');
      const img = item?.querySelector('img');
      if (img) openLightbox(img);
    });
    lightbox.addEventListener('click', closeLightbox);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') closeLightbox();
    });
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
