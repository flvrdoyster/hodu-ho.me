(() => {
  const GALLERY_COUNT = 9;

  const copyText = (text) => {
    if (navigator.clipboard) {
      return navigator.clipboard.writeText(text).catch(() => copyFallback(text));
    }
    return copyFallback(text);
  };
  const copyFallback = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return Promise.resolve();
  };

  // Time-of-day tint
  const applyTimeTone = () => {
    const hour = new Date().getHours();
    let bg = '#ffffff';
    if (hour >= 5 && hour < 9)        bg = '#fafbff'; // dawn
    else if (hour >= 9 && hour < 16)  bg = '#ffffff'; // day
    else if (hour >= 16 && hour < 19) bg = '#fdf8f2'; // dusk
    else                              bg = '#f5f4f8'; // night
    document.documentElement.style.setProperty('--tone-bg', bg);
  };
  applyTimeTone();
  setInterval(applyTimeTone, 60_000);

  // Live D-day
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

  // Copy address
  const copyAddr = document.getElementById('copyAddr');
  if (copyAddr) {
    copyAddr.addEventListener('click', () => {
      copyText('경기도 성남시 분당구 판교역로226번길 16').then(() => {
        copyAddr.textContent = '복사 완료';
        setTimeout(() => { copyAddr.textContent = '주소 복사'; }, 1500);
      });
    });
  }

  // Build gallery
  const gallery = document.querySelector('.gallery');
  if (gallery) {
    gallery.innerHTML = Array.from({length: GALLERY_COUNT}, (_, i) => {
      const id = String(i + 1).padStart(2, '0');
      return `<button class="gallery__item" type="button"><img src="assets/gallery/gallery-${id}.jpg" alt="" loading="lazy"></button>`;
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

  // RSVP
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx1bdxAOqroqtdd2p-G8ATqmVbL-PcBNN8Atch5WBJEZ_tYprxTRCTBdaxK1WhmYDBsfQ/exec';
  const rsvpForm = document.getElementById('rsvpForm');
  const rsvpDone = document.getElementById('rsvpDone');
  const guestsField = document.getElementById('rsvpGuestsField');
  const guestsCount = document.getElementById('rsvpGuests');

  if (localStorage.getItem('rsvp_submitted')) {
    rsvpForm?.remove();
    if (rsvpDone) rsvpDone.hidden = false;
  } else if (rsvpForm) {
    let attendance = '참석';
    let guests = 1;

    rsvpForm.querySelectorAll('.rsvp__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        rsvpForm.querySelectorAll('.rsvp__btn').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        attendance = btn.dataset.value;
        guestsField.classList.toggle('rsvp__field--hidden', attendance === '불참');
      });
    });

    rsvpForm.querySelectorAll('.rsvp__step').forEach((btn) => {
      btn.addEventListener('click', () => {
        guests = Math.max(1, Math.min(10, guests + Number(btn.dataset.delta)));
        guestsCount.textContent = guests;
      });
    });

    rsvpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = rsvpForm.querySelector('#rsvpName').value.trim();
      if (!name) {
        rsvpForm.querySelector('#rsvpName').focus();
        return;
      }
      const message = rsvpForm.querySelector('#rsvpMessage').value.trim();
      const submit = rsvpForm.querySelector('.rsvp__submit');
      submit.disabled = true;
      submit.textContent = '전달 중…';

      const data = { name, attendance, guests: attendance === '참석' ? guests : 0, message };

      try {
        if (APPS_SCRIPT_URL) {
          await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
        }
        localStorage.setItem('rsvp_submitted', '1');
        rsvpForm.remove();
        rsvpDone.hidden = false;
      } catch {
        submit.disabled = false;
        submit.textContent = '전달하기';
        alert('전송에 실패했습니다. 다시 시도해 주세요.');
      }
    });
  }

  // Account accordion & copy
  document.querySelectorAll('.account__toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const list = btn.nextElementSibling;
      const open = !list.hidden;
      list.hidden = open;
      btn.classList.toggle('is-open', !open);
    });
  });

  document.querySelectorAll('.account__copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const account = btn.dataset.account;
      copyText(account).then(() => {
        btn.textContent = '완료';
        setTimeout(() => { btn.textContent = '복사'; }, 1500);
      });
    });
  });

  // RSVP done trivia
  const triviaText = document.querySelector('.rsvp__done-trivia-text');
  const triviaRefresh = document.querySelector('.rsvp__done-trivia-refresh');
  if (triviaText) {
    const lines = [
      '이 청첩장은 신랑이 만들었습니다.',
      '신부는 이 청첩장이 처음엔 영 탐탁지 않았습니다.',
      '최호두는 고양이입니다.',
      '최호두는 동결 건조 간식만 먹습니다.',
      '이 청첩장은 몰래몰래 계속 업데이트 되고 있습니다.',
    ];
    let last = -1;
    const pick = () => {
      let i;
      do { i = Math.floor(Math.random() * lines.length); } while (i === last && lines.length > 1);
      last = i;
      triviaText.textContent = lines[i];
    };
    pick();
    triviaRefresh?.addEventListener('click', pick);
    triviaText.addEventListener('click', pick);
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
