/**
 * account-observer.js
 * Detects the signed-in Google account's email, display name, and avatar URL
 * from the Mail / Calendar DOM and reports changes to the Rust host via document.title.
 */
(function initAccountObserver() {
  try {
    if (window.self !== window.top || window.parent !== window || window.frameElement) return;
  } catch (_) {
    return;
  }

  let lastSignature = '';

  function toHex(str) {
    const bytes = new TextEncoder().encode(str);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  function cleanText(str) {
    return String(str || '')
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00A0]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractNameFromAria(aria, email) {
    const normalized = cleanText(aria);
    const emailIdx = normalized.indexOf(email);
    let beforeEmail = emailIdx > 0 ? normalized.slice(0, emailIdx) : normalized;
    beforeEmail = beforeEmail
      .replace(/^(Google Account|Google-Konto|Compte Google|Cuenta de Google|Account Google)\s*:\s*/i, '')
      .replace(/,?\s*Google\s+(membership|One|Workspace)\b.*/i, '')
      .replace(/[(\[\s,\-|]+$/g, '')
      .replace(/^[(\[\s,\-|]+/g, '')
      .trim();
    return beforeEmail;
  }

  function extractProfile() {
    let email = '';
    let name = '';
    let avatarUrl = '';

    try {
      // 1. Look for Google Account switcher button in header / banner
      const candidates = document.querySelectorAll(
        'a[aria-label*="Google Account"], a[aria-label*="Google-Konto"], a[aria-label*="@"], a[href*="SignOutOptions"], [data-ogsr-up] a'
      );
      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        const aria = cleanText(el.getAttribute('aria-label') || el.getAttribute('title') || '');
        if (aria) {
          const emailMatch = aria.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
          if (emailMatch) {
            email = emailMatch[1];
            const extracted = extractNameFromAria(aria, email);
            if (extracted) {
              name = extracted;
            }
          }
        }
        const img = el.querySelector('img');
        if (img && img.src && (img.src.includes('googleusercontent.com') || img.src.includes('ggpht.com'))) {
          avatarUrl = img.src;
        }
        if (email && avatarUrl) break;
      }

      // 2. Fallback avatar search in header/banner
      if (!avatarUrl) {
        const imgs = document.querySelectorAll('header img, [role="banner"] img, img.gb_q, img.gb_Q, img.gb_n');
        for (let i = 0; i < imgs.length; i++) {
          const src = imgs[i].src || '';
          if (src.includes('googleusercontent.com') || src.includes('ggpht.com')) {
            avatarUrl = src;
            break;
          }
        }
      }

      // 3. Fallback email from document.title (e.g. "Inbox (3) - user@gmail.com - Gmail")
      if (!email && document.title && !document.title.startsWith('__desktop_cmd__:')) {
        const titleMatch = document.title.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
        if (titleMatch) {
          email = titleMatch[1];
        }
      }
    } catch (_) {}

    return { email: email || null, name: name || null, avatar_url: avatarUrl || null };
  }

  function reportIfChanged() {
    const profile = extractProfile();
    if (!profile.email && !profile.name && !profile.avatar_url) return;
    const sig = JSON.stringify(profile);
    if (sig === lastSignature) return;
    lastSignature = sig;

    try {
      const hex = toHex(sig);
      const prevTitle = document.title.startsWith('__desktop_cmd__:') ? '' : document.title;
      document.title = '__desktop_cmd__:profile:' + hex;
      setTimeout(() => {
        if (prevTitle && document.title.startsWith('__desktop_cmd__:')) {
          document.title = prevTitle;
        }
      }, 40);
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(reportIfChanged, 500));
  } else {
    setTimeout(reportIfChanged, 500);
  }

  setInterval(reportIfChanged, 3000);
})();
