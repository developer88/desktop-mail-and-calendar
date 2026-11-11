/**
 * Watches document title and DOM changes to extract unread email count
 * and reports it to the Tauri backend to set Taskbar title and badge.
 */
(function initUnreadObserver() {
  try {
    if (window.top !== window.self) return;
  } catch (_) {
    return;
  }
  let lastReportedCount = -1;

  function inspectTitle() {
    // Gmail sets document.title to "Inbox (4) - user@gmail.com - Gmail"
    const match = document.title.match(/\((\d+)\)/);
    const count = match ? parseInt(match[1], 10) : 0;

    if (count !== lastReportedCount) {
      lastReportedCount = count;
      if (window.__TAURI__ && window.__TAURI__.core) {
        window.__TAURI__.core.invoke('update_unread_badge', { count: count });
      }
    }
  }

  const observer = new MutationObserver(function() {
    inspectTitle();
  });

  const titleEl = document.querySelector('title');
  if (titleEl) {
    observer.observe(titleEl, { childList: true });
  }

  // Fallback periodic check every 3 seconds
  setInterval(inspectTitle, 3000);
  inspectTitle();
})();
