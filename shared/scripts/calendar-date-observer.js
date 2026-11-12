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
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Draw base Calendar icon
    ctx.drawImage(baseImg, 0, 0, 128, 128);

    // 2. Cover the static "31" with clean white matching the calendar card page
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(28, 54, 72, 48);

    // 3. Render current day of the month centered in bold green
    const dayStr = day.toString();
    ctx.font = 'bold 44px "Segoe UI", -apple-system, sans-serif';
    ctx.fillStyle = '#15803d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dayStr, 64, 78);

    return Array.from(ctx.getImageData(0, 0, 128, 128).data);
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
            width: 128,
            height: 128
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
