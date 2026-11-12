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
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Draw base Gmail Fluent icon
    ctx.drawImage(baseImg, 0, 0, 256, 256);

    if (count <= 0) {
      return Array.from(ctx.getImageData(0, 0, 256, 256).data);
    }

    // 2. Format badge text (matches Telegram taskbar badge style)
    const label = formatCountLabel(count);
    const fontSize = label.length <= 2 ? 46 : (label.length <= 3 ? 38 : 30);
    ctx.font = 'bold ' + fontSize + 'px "Segoe UI Variable Text", "Segoe UI", -apple-system, sans-serif';
    const textWidth = ctx.measureText(label).width;

    const bh = 72;
    const bw = Math.max(textWidth + 36, 72);
    const bx = 256 - bw - 6;
    const by = 4;
    const r = bh / 2;

    // 3. Soft ambient drop shadow underneath badge
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // 4. Vivid red pill badge (#eb4034 matching Telegram badge)
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx, by, bw, bh, r);
    } else {
      ctx.arc(bx + r, by + r, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = '#eb4034';
    ctx.fill();
    ctx.restore();

    // 5. Crisp centered white text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + bw / 2, by + bh / 2 + 1);

    return Array.from(ctx.getImageData(0, 0, 256, 256).data);
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
              width: 256,
              height: 256
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
