(() => {
  // 갤러리 목록. 파일명은 실제 앨범 인덱스를 따르므로 연번이 아니어도 됨.
  // 가로로 긴 사진은 fit: 'contain' — 썸네일에서 잘리지 않고 위아래가 비워짐.
  const GALLERY = [
    { src: 'gallery-01.jpg' },
    { src: 'gallery-03.jpg' },
    { src: 'gallery-06.jpg' },
    { src: 'gallery-07.jpg' },
    { src: 'gallery-08.jpg' },
    { src: 'gallery-10.jpg' },
    { src: 'gallery-11.jpg' },
    { src: 'gallery-12.jpg' },
    { src: 'gallery-19.jpg' },
    { src: 'gallery-24.jpg' },
    { src: 'gallery-28.jpg', fit: 'contain' },
    { src: 'gallery-30.jpg' },
  ];

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

  // Share
  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) {
    const shareData = {
      url: 'https://hodu-ho.me/wedding/',
    };
    shareBtn.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share(shareData).catch(() => {});
      } else {
        copyText(shareData.url).then(() => {
          shareBtn.textContent = '링크가 복사되었어요';
          setTimeout(() => { shareBtn.textContent = '청첩장 공유하기'; }, 2000);
        });
      }
    });
  }

  // Build gallery
  const gallery = document.querySelector('.gallery');
  if (gallery) {
    gallery.innerHTML = GALLERY.map(({ src, fit }) => {
      const cls = fit === 'contain' ? 'gallery__item gallery__item--contain' : 'gallery__item';
      return `<button class="${cls}" type="button"><img src="assets/gallery/${src}" alt="" loading="lazy"></button>`;
    }).join('');
  }

  // Gallery lightbox
  const lightbox = document.querySelector('.lightbox');
  const lightboxImg = lightbox?.querySelector('.lightbox__img');
  const lightboxPrev = lightbox?.querySelector('.lightbox__nav--prev');
  const lightboxNext = lightbox?.querySelector('.lightbox__nav--next');
  if (gallery && lightbox && lightboxImg) {
    let currentIndex = 0;
    const galleryImgs = () => Array.from(gallery.querySelectorAll('.gallery__item img'));

    const showAt = (index) => {
      const imgs = galleryImgs();
      currentIndex = (index + imgs.length) % imgs.length;
      const img = imgs[currentIndex];
      lightboxImg.src = img.currentSrc || img.src;
      lightboxImg.alt = img.alt || '';
    };
    const openLightbox = (index) => {
      showAt(index);
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('no-scroll');
    };
    const closeLightbox = () => {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
    };
    gallery.addEventListener('click', (e) => {
      const item = e.target.closest('.gallery__item');
      if (!item) return;
      const index = galleryImgs().indexOf(item.querySelector('img'));
      if (index > -1) openLightbox(index);
    });
    lightbox.addEventListener('click', closeLightbox);
    lightboxPrev?.addEventListener('click', (e) => {
      e.stopPropagation();
      showAt(currentIndex - 1);
    });
    lightboxNext?.addEventListener('click', (e) => {
      e.stopPropagation();
      showAt(currentIndex + 1);
    });
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
        if (attendance === '참석' && message) {
          clearGuestbookCache();
          loadGuestbook(true);
        }
      } catch {
        submit.disabled = false;
        submit.textContent = '전달하기';
        alert('전송에 실패했습니다. 다시 시도해 주세요.');
      }
    });
  }

  // Guestbook (참석자 축하 메시지, 이름 마스킹은 서버에서 처리됨)
  const GUESTBOOK_CACHE_KEY = 'guestbook_cache_v1';
  const GUESTBOOK_CACHE_TTL = 5 * 60 * 1000;
  const GUESTBOOK_PAGE_SIZE = 5;

  function readGuestbookCache() {
    try {
      const raw = sessionStorage.getItem(GUESTBOOK_CACHE_KEY);
      if (!raw) return null;
      const { ts, items } = JSON.parse(raw);
      if (!Array.isArray(items) || Date.now() - ts > GUESTBOOK_CACHE_TTL) return null;
      return items;
    } catch {
      return null;
    }
  }

  function writeGuestbookCache(items) {
    try {
      sessionStorage.setItem(GUESTBOOK_CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
    } catch {
      // 저장 실패해도 렌더링엔 지장 없음 (다음 로드 때 다시 받아옴)
    }
  }

  function clearGuestbookCache() {
    try {
      sessionStorage.removeItem(GUESTBOOK_CACHE_KEY);
    } catch {
      // no-op
    }
  }

  function fetchGuestbookJSONP(url) {
    return new Promise((resolve, reject) => {
      const cbName = `gbCb${Date.now()}${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => { cleanup(); reject(new Error('guestbook timeout')); }, 8000);
      function cleanup() {
        clearTimeout(timer);
        delete window[cbName];
        script.remove();
      }
      window[cbName] = (data) => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error('guestbook script error')); };
      script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${cbName}`;
      document.body.appendChild(script);
    });
  }

  let guestbookItems = [];
  let guestbookShown = 0;

  function renderGuestbookPage() {
    const next = guestbookItems.slice(guestbookShown, guestbookShown + GUESTBOOK_PAGE_SIZE);
    next.forEach(({ name, message }) => {
      const li = document.createElement('li');
      li.className = 'guestbook__item';
      const nameEl = document.createElement('span');
      nameEl.className = 'guestbook__name';
      nameEl.textContent = name;
      const msgEl = document.createElement('p');
      msgEl.className = 'guestbook__message';
      msgEl.textContent = message;
      li.append(nameEl, msgEl);
      guestbookList.appendChild(li);
    });
    guestbookShown += next.length;
    guestbookMore.hidden = guestbookShown >= guestbookItems.length;
  }

  const guestbookSection = document.getElementById('guestbookSection');
  const guestbookList = document.getElementById('guestbookList');
  const guestbookMore = document.getElementById('guestbookMore');

  async function loadGuestbook(force) {
    if (!guestbookSection || !guestbookList || !guestbookMore || !APPS_SCRIPT_URL) return;

    let items = force ? null : readGuestbookCache();
    if (!items) {
      try {
        const res = await fetchGuestbookJSONP(APPS_SCRIPT_URL);
        if (res && res.result === 'ok' && Array.isArray(res.items)) {
          items = res.items;
          writeGuestbookCache(items);
        }
      } catch {
        items = null; // 실패 시 섹션은 계속 숨김 상태 유지
      }
    }

    if (!items || items.length === 0) {
      guestbookSection.hidden = true;
      return;
    }

    guestbookItems = items;
    guestbookShown = 0;
    guestbookList.innerHTML = '';
    renderGuestbookPage();
    guestbookSection.hidden = false;
  }

  guestbookMore?.addEventListener('click', renderGuestbookPage);
  loadGuestbook(false);

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
