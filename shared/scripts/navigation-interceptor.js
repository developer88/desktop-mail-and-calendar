/**
 * Injected script that intercepts all link clicks inside the WebView:
 * 1. Checks if the link is a `mailto:` -> sends to Tauri backend to open compose in-app.
 * 2. Checks if the destination is internal (mail.google.com, accounts.google.com) -> allows normal webview navigation.
 * 3. External links (anything else) -> delegates to OS default browser via Tauri shell.
 */
(function initNavigationInterceptor() {
  document.addEventListener('click', function(event) {
    let target = event.target;
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
    }
    if (!target || !target.href) return;

    const href = target.href;

    // Handle mailto: links
    if (href.startsWith('mailto:')) {
      event.preventDefault();
      event.stopPropagation();
      if (window.__TAURI__ && window.__TAURI__.core) {
        window.__TAURI__.core.invoke('handle_mailto', { mailto: href });
      }
      return;
    }

    try {
      const url = new URL(href);
      const isInternal = (
        url.hostname === 'mail.google.com' ||
        url.hostname === 'calendar.google.com' ||
        url.hostname === 'accounts.google.com' ||
        url.hostname === 'myaccount.google.com' ||
        url.hostname === 'contacts.google.com' ||
        url.hostname === 'meet.google.com'
      );

      // Open external links in default Windows browser
      if (!isInternal && (url.protocol === 'http:' || url.protocol === 'https:')) {
        event.preventDefault();
        event.stopPropagation();
        if (window.__TAURI__ && window.__TAURI__.core) {
          window.__TAURI__.core.invoke('open_external_url', { url: href });
        }
      }
    } catch (_) {}
  }, true);
})();
