/**
 * Injected script that ensures:
 * 1. Links with target="_blank" that belong to the current service or auth flow open in the same window.
 * 2. mailto: links route to the mail compose window.
 * 3. F5 and Ctrl+R keyboard shortcuts reload the current page.
 */
(function initNavigationInterceptor() {
  try {
    if (window.top !== window.self) return;
  } catch (_) {
    return;
  }

  function isInternalUrl(url) {
    if (!url) return false;
    const host = (url.hostname || '').toLowerCase();
    const path = url.pathname || '';
    return (
      host === 'mail.google.com' ||
      host === 'calendar.google.com' ||
      host === 'accounts.google.com' ||
      host.startsWith('accounts.google.') ||
      host === 'accounts.youtube.com' ||
      host === 'myaccount.google.com' ||
      host === 'contacts.google.com' ||
      host === 'chat.google.com' ||
      host === 'meet.google.com' ||
      host === 'gstatic.com' ||
      host.endsWith('.gstatic.com') ||
      host === 'googleusercontent.com' ||
      host.endsWith('.googleusercontent.com') ||
      ((host === 'google.com' || host === 'www.google.com') &&
        (path.startsWith('/accounts') || path.startsWith('/signin') || path.startsWith('/gmail') || path.startsWith('/calendar') || path.startsWith('/ServiceLogin') || path.startsWith('/CheckCookie') || path.startsWith('/SetOSID') || path.startsWith('/_/signin') || path.includes('signinchooser')))
    );
  }

  // Keyboard reload shortcut: F5 or Ctrl+R / Cmd+R
  window.addEventListener('keydown', function(e) {
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
      window.location.reload();
    }
  }, true);

  // Override window.open to keep internal URLs within the single desktop window
  try {
    const originalOpen = window.open;
    window.open = function(url, target, features) {
      if (url) {
        try {
          const parsed = new URL(url, window.location.href);
          if (isInternalUrl(parsed)) {
            window.location.href = parsed.href;
            return window;
          }
        } catch (_) {}
      }
      return originalOpen.apply(this, arguments);
    };
  } catch (_) {}

  // Intercept clicks on links
  document.addEventListener('click', function(event) {
    let target = event.target;
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
    }
    if (!target || !target.href) return;

    const href = target.href;

    // Handle mailto: links (only if user explicitly enabled this in Settings; off by default)
    if (href.startsWith('mailto:')) {
      const handleMailto = localStorage.getItem('desktop_pref_handle_mailto_links') === 'true';
      if (handleMailto) {
        event.preventDefault();
        event.stopPropagation();
        const mailtoQuery = href.slice(7);
        window.location.href = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(mailtoQuery);
        return;
      }
      return;
    }

    // Handle webcal: links (only if user explicitly enabled this in Settings; off by default)
    if (href.startsWith('webcal:')) {
      const handleCalendar = localStorage.getItem('desktop_pref_handle_calendar_links') === 'true';
      if (handleCalendar) {
        event.preventDefault();
        event.stopPropagation();
        const webcalUrl = 'https://calendar.google.com/calendar/u/0/r/settings/addcalendar?cid=' + encodeURIComponent(href);
        window.location.href = webcalUrl;
        return;
      }
      return;
    }

    try {
      const url = new URL(href, window.location.href);
      if (isInternalUrl(url)) {
        // If an internal link requested a new window/tab, redirect in current window so it doesn't get blocked
        if (target.target === '_blank' || target.getAttribute('target') === '_blank') {
          target.target = '_self';
        }
      }
    } catch (_) {}
  }, true);
})();
