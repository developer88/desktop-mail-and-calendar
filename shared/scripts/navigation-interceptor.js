/**
 * Injected script that ensures:
 * 1. Links with target="_blank" that belong to Gmail or Google Auth open in the same window (not blocked popups).
 * 2. window.open calls for Google Auth / Sign In stay in the same window.
 * 3. mailto: links route to Gmail's compose window.
 */
(function initNavigationInterceptor() {
  function isInternalUrl(url) {
    if (!url) return false;
    const host = (url.hostname || '').toLowerCase();
    const path = url.pathname || '';
    return (
      host === 'mail.google.com' ||
      host === 'calendar.google.com' ||
      host === 'accounts.google.com' ||
      host === 'myaccount.google.com' ||
      host === 'contacts.google.com' ||
      host === 'chat.google.com' ||
      host === 'meet.google.com' ||
      host === 'gstatic.com' ||
      host.endsWith('.gstatic.com') ||
      host === 'googleusercontent.com' ||
      host.endsWith('.googleusercontent.com') ||
      ((host === 'google.com' || host === 'www.google.com') &&
        (path.startsWith('/accounts') || path.startsWith('/signin') || path.startsWith('/gmail') || path.includes('signinchooser')))
    );
  }

  // Intercept window.open so Google login popups stay in the main app window
  const originalOpen = window.open;
  window.open = function(url, target, features) {
    if (url && typeof url === 'string') {
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

  // Intercept clicks on links
  document.addEventListener('click', function(event) {
    let target = event.target;
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
    }
    if (!target || !target.href) return;

    const href = target.href;

    // Handle mailto: links directly to Gmail in-app compose
    if (href.startsWith('mailto:')) {
      event.preventDefault();
      event.stopPropagation();
      const mailtoQuery = href.slice(7);
      window.location.href = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(mailtoQuery);
      return;
    }

    try {
      const url = new URL(href, window.location.href);
      if (isInternalUrl(url)) {
        // If internal link requested a new window/tab, redirect in current window so WebView2 displays it
        if (target.target === '_blank' || target.getAttribute('target') === '_blank') {
          target.target = '_self';
        }
      }
    } catch (_) {}
  }, true);
})();
