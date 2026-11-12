/**
 * Automatically calculates the current day of the month (1-31)
 * and renders it dynamically on the Google Calendar app icon
 * so the taskbar icon displays today's real date.
 */
(function initCalendarDateObserver() {
  try {
    if (window.top !== window.self) return;
  } catch (_) {
    return;
  }

  let lastReportedDay = -1;
  const BASE_CALENDAR_ICON = 'data:image/png;base64,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';

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
    img.src = BASE_CALENDAR_ICON;
  }

  function generateCalendarDateIcon(baseImg, day) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Draw base Calendar Fluent icon
    ctx.drawImage(baseImg, 0, 0, 256, 256);

    // 2. Render current day centered in Google Calendar blue (#1a73e8)
    const dayStr = day.toString();
    ctx.font = 'bold 96px "Segoe UI Variable Display", "Segoe UI", -apple-system, sans-serif';
    ctx.fillStyle = '#1a73e8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dayStr, 128, 160);

    return Array.from(ctx.getImageData(0, 0, 256, 256).data);
  }

  function updateCalendarDate() {
    const currentDay = new Date().getDate();
    if (currentDay === lastReportedDay) return;
    lastReportedDay = currentDay;

    getBaseImage((baseImg) => {
      try {
        const rgba = generateCalendarDateIcon(baseImg, currentDay);
        if (rgba && window.__TAURI__ && window.__TAURI__.core) {
          window.__TAURI__.core.invoke('update_calendar_date_icon', {
            day: currentDay,
            iconRgba: rgba,
            width: 256,
            height: 256
          }).catch(() => {});
        }
      } catch (_) {}
    });
  }

  // Pre-load base image and update immediately
  getBaseImage(() => {
    updateCalendarDate();
  });

  // Check periodically (every 60s) for date change across midnight
  setInterval(updateCalendarDate, 60000);

  // Auto-dismiss and hide erroneous "could not load the data" toast
  function dismissDataLoadToast() {
    const alerts = document.querySelectorAll('div[role="status"], div[role="alert"], .YuhOnd, .M6CB1c, [jsaction*="toast"]');
    for (let i = 0; i < alerts.length; i++) {
      const el = alerts[i];
      if (el.textContent && el.textContent.includes('could not load the data')) {
        el.style.setProperty('display', 'none', 'important');
        const closeBtn = el.querySelector('button, [aria-label*="Dismiss"], [aria-label*="Close"], svg');
        if (closeBtn && typeof closeBtn.click === 'function') {
          try { closeBtn.click(); } catch (_) {}
        }
      }
    }
  }

  try {
    const toastObserver = new MutationObserver(dismissDataLoadToast);
    if (document.body) {
      toastObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          toastObserver.observe(document.body, { childList: true, subtree: true });
        }
      });
    }
    // Initial sweep
    dismissDataLoadToast();
    setInterval(dismissDataLoadToast, 1000);
  } catch (_) {}
})();
