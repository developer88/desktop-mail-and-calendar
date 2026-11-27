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

  function isGoogleHost(host) {
    if (!host) return false;
    host = host.toLowerCase();
    const googleBases = [
      'google.com',
      'googleapis.com',
      'gstatic.com',
      'googleusercontent.com',
      'googlevideo.com',
      'googlecode.com',
      'googleblog.com',
      'googletagmanager.com',
      'googletagservices.com',
      'google-analytics.com',
      'googleadservices.com',
      'appspot.com',
      '1e100.net',
      'ggpht.com',
      'gvt1.com',
      'gvt2.com',
      'youtube.com',
      'youtu.be',
      'ytimg.com',
      'g.co',
      'goo.gl',
    ];
    for (let i = 0; i < googleBases.length; i++) {
      const base = googleBases[i];
      if (host === base || host.endsWith('.' + base)) {
        return true;
      }
    }
    if (host === 'google' || host.endsWith('.google')) {
      return true;
    }
    const parts = host.split('.');
    const n = parts.length;
    if (n >= 2) {
      if (parts[n - 2] === 'google') {
        return true;
      }
      if (
        n >= 3 &&
        parts[n - 3] === 'google' &&
        (parts[n - 2] === 'co' ||
          parts[n - 2] === 'com' ||
          parts[n - 2] === 'net' ||
          parts[n - 2] === 'org' ||
          parts[n - 2] === 'edu' ||
          parts[n - 2] === 'ac')
      ) {
        return true;
      }
    }
    return false;
  }

  function isInternalUrl(url) {
    if (!url) return false;
    const proto = (url.protocol || '').toLowerCase();
    if (proto === 'blob:' || proto === 'data:' || proto === 'about:' || proto === 'javascript:') {
      return true;
    }
    const host = (url.hostname || '').toLowerCase();
    const path = url.pathname || '';
    if (path === '/url') {
      try {
        const target = url.searchParams.get('q') || url.searchParams.get('url');
        if (target) {
          const targetUrl = new URL(target, window.location.href);
          return isInternalUrl(targetUrl);
        }
      } catch (_) {}
    }
    if (host === 'accounts.google.com' || host.startsWith('accounts.google.') || host === 'myaccount.google.com') {
      return true;
    }
    if (typeof PRIMARY_HOST !== 'undefined' && PRIMARY_HOST) {
      return host === PRIMARY_HOST;
    }
    return isGoogleHost(host);
  }

  // Keyboard reload shortcut: F5 or Ctrl+R / Cmd+R
  window.addEventListener('keydown', function(e) {
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
      window.location.reload();
    }
  }, true);

  function navigateInApp(targetUrl) {
    if (typeof window.__DESKTOP_NAVIGATE__ === 'function') {
      window.__DESKTOP_NAVIGATE__(targetUrl);
    } else {
      window.location.href = targetUrl;
    }
  }

  // Intercept clicks on links
  document.addEventListener('click', function(event) {
    let target = event.target;
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
    }
    if (!target || !target.href) return;

    const href = target.href;

    // In-app mailto: links route directly to compose
    if (href.startsWith('mailto:')) {
      if (typeof APP_KIND !== 'undefined' && APP_KIND === 'mail') {
        event.preventDefault();
        event.stopPropagation();
        const mailtoQuery = href.slice(7);
        navigateInApp('https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(mailtoQuery));
        return;
      }
    }

    // In-app webcal: and webcals: links route to add calendar subscription
    if (href.startsWith('webcal:') || href.startsWith('webcals:')) {
      if (typeof APP_KIND !== 'undefined' && APP_KIND === 'calendar') {
        event.preventDefault();
        event.stopPropagation();
        let httpUrl = href;
        if (href.startsWith('webcal://')) {
          httpUrl = 'http://' + href.slice(9);
        } else if (href.startsWith('webcal:')) {
          httpUrl = 'http://' + href.slice(7);
        } else if (href.startsWith('webcals://')) {
          httpUrl = 'https://' + href.slice(10);
        } else if (href.startsWith('webcals:')) {
          httpUrl = 'https://' + href.slice(8);
        }
        const webcalUrl = 'https://calendar.google.com/calendar/u/0/r/settings/addcalendar?cid=' + encodeURIComponent(httpUrl);
        navigateInApp(webcalUrl);
        return;
      }
    }

    // In-app .ics links route to calendar subscription
    if (typeof APP_KIND !== 'undefined' && APP_KIND === 'calendar') {
      try {
        const parsedLink = new URL(href, window.location.href);
        if (parsedLink.pathname && parsedLink.pathname.toLowerCase().endsWith('.ics')) {
          event.preventDefault();
          event.stopPropagation();
          const calUrl = 'https://calendar.google.com/calendar/u/0/r/settings/addcalendar?cid=' + encodeURIComponent(href);
          navigateInApp(calUrl);
          return;
        }
      } catch (_) {}
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
