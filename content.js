(() => {
  'use strict';

  const ON_CLASS = 'ytfv-on';
  const EDGE_CLASS = 'ytfv-edge';
  const BTN_ID = 'ytfv-button';
  const EDGE_PX = 40; // distance from left/right window edge that hides the overlay

  let enabled = true; // persisted; applies to every /watch page
  let lastOn = null;
  let shelf = null;
  let shelfOpen = false;
  let lastWheel = 0;

  const isWatchPage = () => location.pathname === '/watch';
  const isActive = () => document.documentElement.classList.contains(ON_CLASS);

  // YouTube sizes the video from JS, so nudge it to recalculate after layout changes.
  function nudgeLayout() {
    [50, 250, 600].forEach((ms) =>
      setTimeout(() => window.dispatchEvent(new Event('resize')), ms)
    );
  }

  /* ---------- toggle button ---------- */

  function ensureButton() {
    if (!isWatchPage() || document.getElementById(BTN_ID)) return;

    const fsBtn = document.querySelector('.ytp-fullscreen-button');
    if (!fsBtn || !fsBtn.parentNode) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.className = 'ytp-button';
    btn.title = 'Full viewport (W)';
    btn.setAttribute('aria-label', 'Toggle full viewport');
    btn.setAttribute('aria-pressed', String(enabled));
    btn.innerHTML =
      '<svg viewBox="0 0 36 36" width="100%" height="100%" aria-hidden="true">' +
      '<path fill="#fff" d="M10 10h7v2h-5v5h-2zM26 10v7h-2v-5h-5v-2z' +
      'M10 26v-7h2v5h5v2zM26 26h-7v-2h5v-5h2z"/></svg>';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });

    fsBtn.parentNode.insertBefore(btn, fsBtn);
  }

  function sync() {
    const on = enabled && isWatchPage();
    if (on !== lastOn) {
      lastOn = on;
      document.documentElement.classList.toggle(ON_CLASS, on);
      if (!on) {
        closeShelf();
        document.documentElement.classList.remove(EDGE_CLASS);
      }
      nudgeLayout();
    }
    ensureButton();
    const btn = document.getElementById(BTN_ID);
    if (btn) btn.setAttribute('aria-pressed', String(enabled));
  }

  function toggle() {
    enabled = !enabled;
    try {
      chrome.storage.local.set({ enabled });
    } catch (_) {
      /* storage unavailable; state still works for this session */
    }
    lastOn = null;
    sync();
  }

  /* ---------- recommendations shelf (scroll down, like YouTube on TV) ---------- */

  function currentVideoId() {
    return new URLSearchParams(location.search).get('v');
  }

  // Reads the recommended videos YouTube already rendered (invisibly) on the page.
  // Searches the whole watch page (YouTube moves related videos between the sidebar
  // and the area under the player depending on layout) and skips the player,
  // description and comments.
  function collectRecommendations() {
    const cur = currentVideoId();
    const found = new Map();
    const root = document.querySelector('ytd-watch-flexy') || document;
    const skip =
      '#movie_player, #comments, ytd-comments, ytd-watch-metadata, #description, ' +
      'ytd-engagement-panel-section-list-renderer, #ytfv-shelf';

    root.querySelectorAll('a[href*="/watch?v="]').forEach((a) => {
      if (a.closest(skip)) return;
      const m = (a.getAttribute('href') || '').match(/[?&]v=([\w-]{11})/);
      if (!m || m[1] === cur) return;
      const id = m[1];
      const title = (a.getAttribute('title') || a.textContent || a.getAttribute('aria-label') || '')
        .replace(/\s+/g, ' ')
        .trim();
      const prev = found.get(id);
      if (!prev) found.set(id, { id, a, title });
      else if (title.length > prev.title.length) prev.title = title;
    });

    const items = [...found.values()];
    console.info('[YT Full Viewport] recommendations found:', items.length);
    return items;
  }

  function buildShelf() {
    if (shelf) return shelf;
    shelf = document.createElement('div');
    shelf.id = 'ytfv-shelf';
    // Over the shelf, the vertical wheel scrolls the row sideways;
    // scrolling up while at the start closes the shelf.
    shelf.addEventListener(
      'wheel',
      (e) => {
        const row = shelf.querySelector('.ytfv-row');
        if (e.deltaY < 0 && row && row.scrollLeft <= 0) {
          closeShelf();
          return;
        }
        if (row) row.scrollLeft += (e.deltaY + e.deltaX) * 1.5;
        e.preventDefault();
      },
      { passive: false }
    );
    document.documentElement.appendChild(shelf);
    return shelf;
  }

  function renderShelf() {
    const el = buildShelf();
    el.textContent = '';
    const row = document.createElement('div');
    row.className = 'ytfv-row';

    const items = collectRecommendations();
    if (!items.length) {
      const msg = document.createElement('div');
      msg.className = 'ytfv-empty';
      msg.textContent = 'No recommendations loaded yet.';
      row.appendChild(msg);
    }

    items.forEach(({ id, a, title }) => {
      const card = document.createElement('a');
      card.className = 'ytfv-card';
      card.href = '/watch?v=' + id;

      const img = document.createElement('img');
      img.src = 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg';
      img.alt = '';
      img.loading = 'lazy';

      const t = document.createElement('div');
      t.className = 'ytfv-title';
      t.textContent = title || id;

      card.append(img, t);
      card.addEventListener('click', (e) => {
        e.preventDefault();
        closeShelf();
        // Click YouTube's own link so it navigates without a full page reload
        if (a.isConnected) a.click();
        else location.href = card.href;
      });
      row.appendChild(card);
    });

    el.appendChild(row);
  }

  function openShelf() {
    if (shelfOpen || !isActive()) return;
    renderShelf();
    shelfOpen = true;
    shelf.classList.add('ytfv-open');

    // Recommendations can load a moment late: retry while the shelf is still empty
    let tries = 0;
    const retry = () => {
      if (!shelfOpen || tries++ >= 6) return;
      if (!shelf.querySelector('.ytfv-card')) {
        renderShelf();
        setTimeout(retry, 800);
      }
    };
    setTimeout(retry, 800);
  }

  function closeShelf() {
    shelfOpen = false;
    if (shelf) shelf.classList.remove('ytfv-open');
  }

  // Wheel down over the video opens the shelf, wheel up closes it
  window.addEventListener(
    'wheel',
    (e) => {
      if (!isActive()) return;
      if (shelf && shelf.contains(e.target)) return;
      const now = Date.now();
      if (now - lastWheel < 400) return;
      if (e.deltaY > 15) {
        lastWheel = now;
        openShelf();
      } else if (e.deltaY < -15 && shelfOpen) {
        lastWheel = now;
        closeShelf();
      }
    },
    { passive: true }
  );

  /* ---------- hide overlay when the cursor is at the far left/right edge ---------- */

  document.addEventListener(
    'mousemove',
    (e) => {
      if (!isActive()) return;
      const atEdge = e.clientX <= EDGE_PX || e.clientX >= window.innerWidth - EDGE_PX;
      document.documentElement.classList.toggle(EDGE_CLASS, atEdge);
    },
    { passive: true }
  );

  /* ---------- keyboard ---------- */

  // While the shelf is open, Left/Right arrows move along the row instead of seeking
  window.addEventListener(
    'keydown',
    (e) => {
      if (!shelfOpen) return;
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const row = shelf && shelf.querySelector('.ytfv-row');
      if (row) {
        row.scrollBy({ left: e.key === 'ArrowRight' ? 320 : -320, behavior: 'smooth' });
      }
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && shelfOpen) {
      closeShelf();
      return;
    }
    if (e.key !== 'w' && e.key !== 'W') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const t = e.target;
    if (
      t &&
      (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    ) {
      return;
    }
    if (!isWatchPage()) return;
    toggle();
  });

  /* ---------- YouTube is a single-page app ---------- */

  window.addEventListener('yt-navigate-finish', sync);
  window.addEventListener('yt-page-data-updated', sync);
  setInterval(sync, 1000); // controls get rebuilt now and then

  try {
    chrome.storage.local.get({ enabled: true }, (res) => {
      enabled = res.enabled;
      sync();
    });
  } catch (_) {
    sync();
  }
})();
