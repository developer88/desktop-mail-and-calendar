/**
 * Watches document title and DOM changes to extract unread email count
 * and reports it to the Tauri backend to set Taskbar title, main icon, and overlay badge.
 */
(function initUnreadObserver() {
  try {
    if (window.top !== window.self) return;
  } catch (_) {
    return;
  }

  let lastReportedCount = -1;
  const BASE_ICON = 'data:image/png;base64,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';

  let cachedBaseImg = null;
  function getBaseImage(callback) {
    if (cachedBaseImg) {
      callback(cachedBaseImg);
      return;
    }
    const img = new Image();
    img.onload = () => {
      cachedBaseImg = img;
      callback(img);
    };
    img.src = BASE_ICON;
  }

  function formatCountLabel(count) {
    if (count >= 1000000) {
      return Math.floor(count / 1000000) + 'M';
    }
    if (count >= 1000) {
      return Math.floor(count / 1000) + 'K';
    }
    return count.toString();
  }

  function generateBadgedIcon(baseImg, count) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Draw base Gmail icon
    ctx.drawImage(baseImg, 0, 0, 128, 128);

    if (count <= 0) {
      return Array.from(ctx.getImageData(0, 0, 128, 128).data);
    }

    // 2. Format badge text (matches Telegram taskbar badge style)
    const label = formatCountLabel(count);
    ctx.font = 'bold 34px "Segoe UI", -apple-system, sans-serif';
    const textWidth = ctx.measureText(label).width;

    const bh = 42;
    const bw = Math.max(textWidth + 20, 42);
    const bx = 128 - bw - 2;
    const by = 2;
    const r = bh / 2;

    // 3. Dark outline / shadow for contrast on both light & dark taskbars
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx - 2, by - 2, bw + 4, bh + 4, r + 2);
    } else {
      ctx.arc(bx + r, by + r, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fill();

    // 4. Vivid red pill badge (#eb4034 matching Telegram badge)
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx, by, bw, bh, r);
    } else {
      ctx.arc(bx + r, by + r, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = '#eb4034';
    ctx.fill();

    // 5. Crisp centered white text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + bw / 2, by + bh / 2 + 1);

    return Array.from(ctx.getImageData(0, 0, 128, 128).data);
  }

  function generateOverlayIcon(count) {
    if (count <= 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const label = formatCountLabel(count);
    const fontSize = label.length <= 2 ? 16 : (label.length <= 3 ? 12 : 10);
    ctx.font = 'bold ' + fontSize + 'px "Segoe UI", -apple-system, sans-serif';

    // Red circle / pill
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#eb4034';
    ctx.fill();

    // Dark outline
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.stroke();

    // Centered white text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 16, 17);

    return Array.from(ctx.getImageData(0, 0, 32, 32).data);
  }

  function extractUnreadCount() {
    // 1. Check document.title: "Inbox (66) - ...", "(255K) Inbox...", "Posteingang (4)..."
    const titleMatch = document.title.match(/\(([\d,]+|\d+[KkMm\+]?)\)/);
    if (titleMatch) {
      const raw = titleMatch[1].replace(/,/g, '');
      if (raw.endsWith('+')) {
        return parseInt(raw.slice(0, -1), 10) || 0;
      }
      if (raw.toLowerCase().endsWith('k')) {
        return Math.round(parseFloat(raw.slice(0, -1)) * 1000) || 0;
      }
      if (raw.toLowerCase().endsWith('m')) {
        return Math.round(parseFloat(raw.slice(0, -1)) * 1000000) || 0;
      }
      const num = parseInt(raw, 10);
      if (!isNaN(num)) return num;
    }

    // 2. Check sidebar inbox badge element
    const sidebarEl = document.querySelector('a[href*="#inbox"] .bsU, .aio .bsU, [data-tooltip*="Inbox"] .bsU, [aria-label*="Inbox"] .bsU, div.bsU');
    if (sidebarEl && sidebarEl.textContent) {
      const clean = sidebarEl.textContent.trim().replace(/,/g, '');
      const parsed = parseInt(clean, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }

    return 0;
  }

  function inspectAndReport() {
    const count = extractUnreadCount();
    if (count === lastReportedCount) return;
    lastReportedCount = count;

    // Fast, CSP-proof title command trigger for Rust backend
    try {
      const prevTitle = document.title;
      if (!prevTitle.startsWith('__desktop_cmd__:')) {
        document.title = '__desktop_cmd__:unread:' + count;
        setTimeout(() => {
          if (document.title.startsWith('__desktop_cmd__:')) {
            document.title = prevTitle;
          }
        }, 40);
      }
    } catch (_) {}

    if (window.__TAURI__ && window.__TAURI__.core) {
      if (count <= 0) {
        window.__TAURI__.core.invoke('update_unread_badge', {
          count: 0,
          iconRgba: null,
          overlayRgba: null,
          width: null,
          height: null
        }).catch(() => {});
      } else {
        getBaseImage((baseImg) => {
          try {
            const rgba = generateBadgedIcon(baseImg, count);
            const overlayRgba = generateOverlayIcon(count);
            window.__TAURI__.core.invoke('update_unread_badge', {
              count: count,
              iconRgba: rgba,
              overlayRgba: overlayRgba,
              width: 128,
              height: 128
            }).catch(() => {});
          } catch (_) {
            window.__TAURI__.core.invoke('update_unread_badge', {
              count: count,
              iconRgba: null,
              overlayRgba: null,
              width: null,
              height: null
            }).catch(() => {});
          }
        });
      }
    }
  }

  const observer = new MutationObserver(function() {
    inspectAndReport();
  });

  function attachObservers() {
    const titleEl = document.querySelector('title');
    if (titleEl) {
      try {
        observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
      } catch (_) {}
    }
    if (document.body) {
      try {
        observer.observe(document.body, { childList: true, subtree: true });
      } catch (_) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      attachObservers();
      inspectAndReport();
    });
  } else {
    attachObservers();
  }

  window.addEventListener('focus', inspectAndReport);
  document.addEventListener('visibilitychange', inspectAndReport);

  // Periodic fallback check (every 1s)
  setInterval(inspectAndReport, 1000);

  // Pre-load base image
  getBaseImage(() => {
    inspectAndReport();
  });
})();
