/**
 * Injects a modern Windows 11 frameless titlebar overlay.
 * Uses strict DOM methods (no innerHTML) to comply with Trusted Types CSP.
 */
(function initTitlebarOverlay() {
  try {
    if (window.self !== window.top || window.parent !== window || window.frameElement) return;
  } catch (_) {
    return;
  }
  const curHost = (window.location.hostname || '').toLowerCase();
  const curSearch = (window.location.search || '').toLowerCase();
  const curPath = (window.location.pathname || '').toLowerCase();
  if (curSearch.includes('companion') || curSearch.includes('embed') || curPath.includes('/embed') || curPath.includes('/htmlembed')) {
    return;
  }
  if (typeof PRIMARY_HOST !== 'undefined' && curHost && curHost !== PRIMARY_HOST && !curHost.includes('accounts.google.') && curHost !== 'accounts.google.com') {
    return;
  }

  const svgNS = 'http://www.w3.org/2000/svg';
  const isCalendar = (typeof APP_KIND !== 'undefined')
    ? (APP_KIND === 'calendar')
    : (curHost.includes('calendar.google.com') || window.location.href.includes('calendar'));

  // Prevent root window/body from scrolling vertically or horizontally.
  // Google Calendar and Mail have internal scroll containers;
  // the main application window must never scroll up under the custom titlebar.
  function preventRootScroll() {
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
    if (document.documentElement && (document.documentElement.scrollTop !== 0 || document.documentElement.scrollLeft !== 0)) {
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
    }
    if (document.body && (document.body.scrollTop !== 0 || document.body.scrollLeft !== 0)) {
      document.body.scrollTop = 0;
      document.body.scrollLeft = 0;
    }
  }

  window.addEventListener('scroll', preventRootScroll, { passive: true });

  // Tag calendar root so CSS can cleanly position Calendar content below the dedicated titlebar
  function ensureAppRootClasses() {
    if (isCalendar) {
      if (document.documentElement && !document.documentElement.classList.contains('desktop-calendar-app')) {
        document.documentElement.classList.add('desktop-calendar-app');
      }
      if (document.body && !document.body.classList.contains('desktop-calendar-app')) {
        document.body.classList.add('desktop-calendar-app');
      }
    }
  }

  // Dynamic adaptive theme update for Calendar and Gmail titlebars
  function updateAdaptiveTheme() {
    ensureAppRootClasses();
    const titlebar = document.getElementById('desktop-custom-titlebar');
    if (!titlebar) return;

    if (isCalendar) {
      titlebar.classList.add('calendar-titlebar');
      titlebar.classList.remove('mail-titlebar');
      const isDark = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
        || (document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark')
        || (document.body && (document.body.classList.contains('dark-mode') || document.body.classList.contains('dark-theme')));
      titlebar.classList.toggle('dark-mode', isDark);
    } else {
      titlebar.classList.add('mail-titlebar');
      titlebar.classList.remove('calendar-titlebar');

      // Adaptive brightness detection for Gmail
      const isDarkSys = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      let isLightPlainTheme = false;

      if (!isDarkSys) {
        const bodyBgImg = document.body ? window.getComputedStyle(document.body).backgroundImage : 'none';
        const hasBgImage = bodyBgImg && bodyBgImg !== 'none' && bodyBgImg.includes('url');

        const header = document.querySelector('header') || document.querySelector('[role="banner"]');
        let iconIsLight = false;
        if (header) {
          const sampleEl = header.querySelector('[role="button"] svg, button svg, [role="search"], span') || header;
          const computedColor = window.getComputedStyle(sampleEl).color;
          const rgb = computedColor.match(/\d+/g);
          if (rgb && rgb.length >= 3) {
            const brightness = (parseInt(rgb[0], 10) * 299 + parseInt(rgb[1], 10) * 587 + parseInt(rgb[2], 10) * 114) / 1000;
            iconIsLight = brightness > 140;
          }
        }

        // Only treat as light plain theme if NO background wallpaper image and icons are dark
        if (!hasBgImage && !iconIsLight) {
          isLightPlainTheme = true;
        }
      }

      titlebar.classList.toggle('mail-light-mode', isLightPlainTheme);
      titlebar.classList.toggle('dark-mode', !isLightPlainTheme);
    }
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateAdaptiveTheme);
  }

  // Fast, CSP-proof native action trigger via document.title interceptor
  let lastNonCmdTitle = document.title || (isCalendar ? 'Desktop Calendar' : 'Desktop Mail');
  function triggerAction(action) {
    if (!document.title.startsWith('__desktop_cmd__:')) {
      lastNonCmdTitle = document.title;
    }
    document.title = '__desktop_cmd__:' + action;
    setTimeout(() => {
      if (document.title.startsWith('__desktop_cmd__:')) {
        document.title = lastNonCmdTitle;
      }
    }, 40);
  }

  // Zoom management
  let currentZoom = 1.0;
  try {
    const saved = localStorage.getItem('desktop_zoom_level');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.5) {
        currentZoom = parsed;
      }
    }
  } catch (_) {}

  function applyZoom(val) {
    currentZoom = Math.min(Math.max(parseFloat(val.toFixed(2)), 0.5), 2.5);
    try {
      localStorage.setItem('desktop_zoom_level', currentZoom.toString());
    } catch (_) {}

    if (document.body) {
      document.body.style.zoom = currentZoom;
    }
  }

  // Restore zoom on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (currentZoom !== 1.0) applyZoom(currentZoom);
    });
  } else {
    if (currentZoom !== 1.0) applyZoom(currentZoom);
  }

  function createSvgIcon(type) {
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.style.pointerEvents = 'none';

    if (type === 'menu') {
      // 3 clean horizontal lines matching Gemini Desktop app
      [3.5, 8, 12.5].forEach((y) => {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', '2');
        line.setAttribute('y1', y.toString());
        line.setAttribute('x2', '14');
        line.setAttribute('y2', y.toString());
        line.setAttribute('stroke', 'currentColor');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
      });
    } else if (type === 'min') {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 2,8 L 14,8');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.4');
      svg.appendChild(path);
    } else if (type === 'max') {
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', '2.5');
      rect.setAttribute('y', '2.5');
      rect.setAttribute('width', '11');
      rect.setAttribute('height', '11');
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', 'currentColor');
      rect.setAttribute('stroke-width', '1.4');
      svg.appendChild(rect);
    } else if (type === 'close') {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 3,3 L 13,13 M 13,3 L 3,13');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.4');
      svg.appendChild(path);
    } else if (type === 'gear') {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', '8');
      circle.setAttribute('cy', '8');
      circle.setAttribute('r', '3');
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', 'currentColor');
      circle.setAttribute('stroke-width', '1.4');

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M8,1 L8,3 M8,13 L8,15 M1,8 L3,8 M13,8 L15,8 M3,3 L4.5,4.5 M11.5,11.5 L13,13 M3,13 L4.5,11.5 M11.5,4.5 L13,3');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.4');
      svg.appendChild(circle);
      svg.appendChild(path);
    } else if (type === 'shield') {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 8,1.5 L 14,4 C 14,10 8,14.5 8,14.5 C 8,14.5 2,10 2,4 Z');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.4');
      svg.appendChild(path);
    } else if (type === 'info') {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', '8');
      circle.setAttribute('cy', '8');
      circle.setAttribute('r', '6.5');
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', 'currentColor');
      circle.setAttribute('stroke-width', '1.4');

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 8,7 L 8,11.5 M 8,4.5 L 8.01,4.5');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.6');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(circle);
      svg.appendChild(path);
    } else if (type === 'bell') {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 8,2 C 5.5,2 4.5,4 4.5,7 C 4.5,9.5 3,11 3,11 L 13,11 C 13,11 11.5,9.5 11.5,7 C 11.5,4 10.5,2 8,2 Z M 6.5,12 C 6.5,12.8 7.2,13.5 8,13.5 C 8.8,13.5 9.5,12.8 9.5,12');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.3');
      svg.appendChild(path);
    } else if (type === 'login') {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 6,3 L 3,3 C 2.4,3 2,3.4 2,4 L 2,12 C 2,12.6 2.4,13 3,13 L 6,13 M 9,11 L 12,8 L 9,5 M 5,8 L 12,8');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.3');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
    } else if (type === 'link') {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 6.5,9.5 C 5,11 3.5,11 2.5,10 C 1.5,9 1.5,7.5 3,6 L 5.5,3.5 C 7,2 8.5,2 9.5,3 M 9.5,6.5 C 11,5 12.5,5 13.5,6 C 14.5,7 14.5,8.5 13,10 L 10.5,12.5 C 9,14 7.5,14 6.5,13 M 5.5,10.5 L 10.5,5.5');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.3');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
    } else if (type === 'mic') {
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', '5.5');
      rect.setAttribute('y', '2');
      rect.setAttribute('width', '5');
      rect.setAttribute('height', '8');
      rect.setAttribute('rx', '2.5');
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', 'currentColor');
      rect.setAttribute('stroke-width', '1.3');

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 3,7 C 3,9.8 5.2,12 8,12 C 10.8,12 13,9.8 13,7 M 8,12 L 8,14.5 M 5.5,14.5 L 10.5,14.5');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.3');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(rect);
      svg.appendChild(path);
    } else if (type === 'camera') {
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', '2');
      rect.setAttribute('y', '4');
      rect.setAttribute('width', '8.5');
      rect.setAttribute('height', '8');
      rect.setAttribute('rx', '1.5');
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', 'currentColor');
      rect.setAttribute('stroke-width', '1.3');

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 10.5,6.5 L 14,4.5 L 14,11.5 L 10.5,9.5 Z');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.3');
      svg.appendChild(rect);
      svg.appendChild(path);
    } else if (type === 'location') {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 8,1.5 C 5.5,1.5 3.5,3.5 3.5,6 C 3.5,9.5 8,14.5 8,14.5 C 8,14.5 12.5,9.5 12.5,6 C 12.5,3.5 10.5,1.5 8,1.5 Z');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.3');

      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', '8');
      circle.setAttribute('cy', '6');
      circle.setAttribute('r', '2');
      circle.setAttribute('fill', 'currentColor');
      svg.appendChild(path);
      svg.appendChild(circle);
    } else if (type === 'bug') {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 5,6 L 3,4 M 11,6 L 13,4 M 5,10 L 3,12 M 11,10 L 13,12 M 2,8 L 4,8 M 12,8 L 14,8 M 8,4 C 6.3,4 5,5.3 5,7 L 5,10 C 5,11.7 6.3,13 8,13 C 9.7,13 11,11.7 11,10 L 11,7 C 11,5.3 9.7,4 8,4 Z');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.2');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
    } else if (type === 'mail-logo') {
      const back = document.createElementNS(svgNS, 'rect');
      back.setAttribute('x', '1.5');
      back.setAttribute('y', '1.5');
      back.setAttribute('width', '13');
      back.setAttribute('height', '13');
      back.setAttribute('rx', '2.5');
      back.setAttribute('fill', '#d9530a');

      const letter = document.createElementNS(svgNS, 'rect');
      letter.setAttribute('x', '2.5');
      letter.setAttribute('y', '2.2');
      letter.setAttribute('width', '11');
      letter.setAttribute('height', '11');
      letter.setAttribute('rx', '1.8');
      letter.setAttribute('fill', '#ffffff');

      const line1 = document.createElementNS(svgNS, 'line');
      line1.setAttribute('x1', '4.2');
      line1.setAttribute('y1', '4.2');
      line1.setAttribute('x2', '8.5');
      line1.setAttribute('y2', '4.2');
      line1.setAttribute('stroke', '#cbd5e1');
      line1.setAttribute('stroke-width', '1');
      line1.setAttribute('stroke-linecap', 'round');

      const line2 = document.createElementNS(svgNS, 'line');
      line2.setAttribute('x1', '4.2');
      line2.setAttribute('y1', '6.0');
      line2.setAttribute('x2', '11.2');
      line2.setAttribute('y2', '6.0');
      line2.setAttribute('stroke', '#cbd5e1');
      line2.setAttribute('stroke-width', '1');
      line2.setAttribute('stroke-linecap', 'round');

      const front = document.createElementNS(svgNS, 'path');
      front.setAttribute('d', 'M 1.5,5.5 L 8,9.5 L 14.5,5.5 L 14.5,12 C 14.5,13.4 13.4,14.5 12,14.5 L 4,14.5 C 2.6,14.5 1.5,13.4 1.5,12 Z');
      front.setAttribute('fill', '#f97316');

      const fold = document.createElementNS(svgNS, 'path');
      fold.setAttribute('d', 'M 1.5,5.5 L 8,9.5 L 14.5,5.5');
      fold.setAttribute('stroke', '#c2410c');
      fold.setAttribute('stroke-width', '0.9');
      fold.setAttribute('fill', 'none');

      svg.appendChild(back);
      svg.appendChild(letter);
      svg.appendChild(line1);
      svg.appendChild(line2);
      svg.appendChild(front);
      svg.appendChild(fold);
    } else if (type === 'calendar-logo') {
      const back = document.createElementNS(svgNS, 'rect');
      back.setAttribute('x', '1.5');
      back.setAttribute('y', '1.5');
      back.setAttribute('width', '13');
      back.setAttribute('height', '13');
      back.setAttribute('rx', '2.5');
      back.setAttribute('fill', '#15803d');

      const page = document.createElementNS(svgNS, 'rect');
      page.setAttribute('x', '2.5');
      page.setAttribute('y', '2.2');
      page.setAttribute('width', '11');
      page.setAttribute('height', '11');
      page.setAttribute('rx', '1.8');
      page.setAttribute('fill', '#ffffff');

      const top = document.createElementNS(svgNS, 'path');
      top.setAttribute('d', 'M 2.5,6.5 L 2.5,4.0 C 2.5,3.0 3.3,2.2 4.3,2.2 L 11.7,2.2 C 12.7,2.2 13.5,3.0 13.5,4.0 L 13.5,6.5 Z');
      top.setAttribute('fill', '#22c55e');

      const crease = document.createElementNS(svgNS, 'line');
      crease.setAttribute('x1', '2.5');
      crease.setAttribute('y1', '6.5');
      crease.setAttribute('x2', '13.5');
      crease.setAttribute('y2', '6.5');
      crease.setAttribute('stroke', '#126b33');
      crease.setAttribute('stroke-width', '0.6');

      const ring1 = document.createElementNS(svgNS, 'rect');
      ring1.setAttribute('x', '4.6');
      ring1.setAttribute('y', '0.9');
      ring1.setAttribute('width', '1.4');
      ring1.setAttribute('height', '2.4');
      ring1.setAttribute('rx', '0.7');
      ring1.setAttribute('fill', '#ffffff');
      ring1.setAttribute('stroke', '#15803d');
      ring1.setAttribute('stroke-width', '0.4');

      const ring2 = document.createElementNS(svgNS, 'rect');
      ring2.setAttribute('x', '10.0');
      ring2.setAttribute('y', '0.9');
      ring2.setAttribute('width', '1.4');
      ring2.setAttribute('height', '2.4');
      ring2.setAttribute('rx', '0.7');
      ring2.setAttribute('fill', '#ffffff');
      ring2.setAttribute('stroke', '#15803d');
      ring2.setAttribute('stroke-width', '0.4');

      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', '8');
      text.setAttribute('y', '11.8');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#15803d');
      text.setAttribute('font-size', '5.8');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('font-family', 'sans-serif');
      text.textContent = '31';

      svg.appendChild(back);
      svg.appendChild(page);
      svg.appendChild(top);
      svg.appendChild(crease);
      svg.appendChild(ring1);
      svg.appendChild(ring2);
      svg.appendChild(text);
    } else if (type === 'window') {
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', '2');
      rect.setAttribute('y', '3');
      rect.setAttribute('width', '12');
      rect.setAttribute('height', '10');
      rect.setAttribute('rx', '2');
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', 'currentColor');
      rect.setAttribute('stroke-width', '1.2');
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', '2');
      line.setAttribute('y1', '6');
      line.setAttribute('x2', '14');
      line.setAttribute('y2', '6');
      line.setAttribute('stroke', 'currentColor');
      line.setAttribute('stroke-width', '1.2');
      svg.appendChild(rect);
      svg.appendChild(line);
    } else if (type === 'lock') {
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', '3');
      rect.setAttribute('y', '6.5');
      rect.setAttribute('width', '10');
      rect.setAttribute('height', '7.5');
      rect.setAttribute('rx', '1.5');
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', 'currentColor');
      rect.setAttribute('stroke-width', '1.2');
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 5,6.5 L 5,4.5 C 5,2.8 6.3,1.5 8,1.5 C 9.7,1.5 11,2.8 11,4.5 L 11,6.5');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.2');
      svg.appendChild(rect);
      svg.appendChild(path);
    } else if (type === 'code') {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 5.5,4.5 L 2,8 L 5.5,11.5 M 10.5,4.5 L 14,8 L 10.5,11.5 M 9,3 L 7,13');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.2');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
    }
    return svg;
  }

  // Preference Storage Helper
  function getPref(key, defaultVal) {
    try {
      const val = localStorage.getItem('desktop_pref_' + key);
      return val !== null ? val === 'true' : defaultVal;
    } catch (_) {
      return defaultVal;
    }
  }

  function setPref(key, boolVal) {
    try {
      localStorage.setItem('desktop_pref_' + key, boolVal ? 'true' : 'false');
    } catch (_) {}
  }

  // Settings Modal Dialog with 3 sections matching Gemini
  function openSettingsDialog() {
    if (document.getElementById('desktop-settings-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'desktop-settings-overlay';

    const dialog = document.createElement('div');
    dialog.id = 'desktop-settings-dialog';

    // Header
    const header = document.createElement('div');
    header.className = 'desktop-settings-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'desktop-settings-title-group';
    titleGroup.appendChild(createSvgIcon('gear'));
    const titleText = document.createElement('span');
    titleText.textContent = 'Settings';
    titleGroup.appendChild(titleText);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'desktop-settings-close-btn';
    closeBtn.title = 'Close';
    closeBtn.appendChild(createSvgIcon('close'));
    closeBtn.addEventListener('click', closeSettingsDialog);

    header.appendChild(titleGroup);
    header.appendChild(closeBtn);

    // Body
    const body = document.createElement('div');
    body.className = 'desktop-settings-body';

    // Sidebar navigation
    const nav = document.createElement('div');
    nav.className = 'desktop-settings-nav';

    const tabs = [
      { id: 'general', label: 'General', icon: 'gear' },
      { id: 'privacy', label: 'Privacy & permissions', icon: 'shield' },
      { id: 'about', label: isCalendar ? 'About Desktop Calendar' : 'About Desktop Mail', icon: 'info' }
    ];

    const contentArea = document.createElement('div');
    contentArea.className = 'desktop-settings-content';

    let currentTab = 'general';
    const navItems = {};

    function renderToggleCard(parent, iconName, title, desc, prefKey, defaultVal, onToggle) {
      const card = document.createElement('div');
      card.className = 'desktop-settings-card';

      const info = document.createElement('div');
      info.className = 'desktop-card-info';

      const iconWrap = document.createElement('div');
      iconWrap.className = 'desktop-card-icon';
      iconWrap.appendChild(createSvgIcon(iconName));

      const textWrap = document.createElement('div');
      textWrap.className = 'desktop-card-text';

      const titleEl = document.createElement('div');
      titleEl.className = 'desktop-card-title';
      titleEl.textContent = title;

      const descEl = document.createElement('div');
      descEl.className = 'desktop-card-sub';
      descEl.textContent = desc;

      textWrap.appendChild(titleEl);
      textWrap.appendChild(descEl);
      info.appendChild(iconWrap);
      info.appendChild(textWrap);

      // Toggle switch
      const switchEl = document.createElement('div');
      switchEl.className = 'desktop-toggle-switch' + (getPref(prefKey, defaultVal) ? ' on' : '');

      const knob = document.createElement('div');
      knob.className = 'desktop-toggle-knob';
      switchEl.appendChild(knob);

      switchEl.addEventListener('click', () => {
        const isNowOn = !switchEl.classList.contains('on');
        if (isNowOn) {
          switchEl.classList.add('on');
        } else {
          switchEl.classList.remove('on');
        }
        setPref(prefKey, isNowOn);
        if (onToggle) onToggle(isNowOn);
      });

      card.appendChild(info);
      card.appendChild(switchEl);
      parent.appendChild(card);
    }

    function renderActionCard(parent, iconName, title, desc, btnText, onAction) {
      const card = document.createElement('div');
      card.className = 'desktop-settings-card';

      const info = document.createElement('div');
      info.className = 'desktop-card-info';

      const iconWrap = document.createElement('div');
      iconWrap.className = 'desktop-card-icon';
      iconWrap.appendChild(createSvgIcon(iconName));

      const textWrap = document.createElement('div');
      textWrap.className = 'desktop-card-text';

      const titleEl = document.createElement('div');
      titleEl.className = 'desktop-card-title';
      titleEl.textContent = title;

      const descEl = document.createElement('div');
      descEl.className = 'desktop-card-sub';
      descEl.textContent = desc;

      textWrap.appendChild(titleEl);
      textWrap.appendChild(descEl);
      info.appendChild(iconWrap);
      info.appendChild(textWrap);

      const btn = document.createElement('button');
      btn.className = 'desktop-settings-action-btn';
      btn.textContent = btnText;
      btn.addEventListener('click', onAction);

      card.appendChild(info);
      card.appendChild(btn);
      parent.appendChild(card);
    }

    function renderContent(tabId) {
      contentArea.className = 'desktop-settings-content' + (tabId === 'about' ? ' about-view' : '');
      while (contentArea.firstChild) {
        contentArea.removeChild(contentArea.firstChild);
      }

      if (tabId === 'general') {
        const secTitle = document.createElement('div');
        secTitle.className = 'desktop-settings-section-title';
        secTitle.textContent = 'General';

        const secDesc = document.createElement('div');
        secDesc.className = 'desktop-settings-section-desc';
        secDesc.textContent = 'Application preferences and system integration.';

        contentArea.appendChild(secTitle);
        contentArea.appendChild(secDesc);

        // 1. Desktop Notifications (off by default)
        renderToggleCard(
          contentArea,
          'bell',
          'Desktop Notifications',
          isCalendar
            ? 'Allow notifications for upcoming calendar events and reminders.'
            : 'Allow notifications for incoming emails.',
          'notifications_enabled',
          false,
          (enabled) => {
            if (enabled && typeof Notification !== 'undefined') {
              Notification.requestPermission();
            }
          }
        );

        // 2. Open at login (off by default)
        renderToggleCard(
          contentArea,
          'login',
          'Open at login',
          isCalendar
            ? 'Start Desktop Calendar automatically when you sign into Windows.'
            : 'Start Desktop Mail automatically when you sign into Windows.',
          'open_at_login',
          false,
          (enabled) => {
            triggerAction(enabled ? 'autostart:on' : 'autostart:off');
          }
        );

        // 3. Default app instruction with deep link to Windows Settings
        renderActionCard(
          contentArea,
          'link',
          isCalendar ? 'Default Calendar App' : 'Default Email App',
          isCalendar
            ? 'To set as default for calendar links, select Desktop Calendar under Default apps in Windows Settings.'
            : 'To set as default for mailto: links, select Desktop Mail under Default apps in Windows Settings.',
          'Open Windows Settings',
          () => {
            triggerAction('open:defaultapps');
          }
        );
      } else if (tabId === 'privacy') {
        const secTitle = document.createElement('div');
        secTitle.className = 'desktop-settings-section-title';
        secTitle.textContent = 'App Permissions';

        const secDesc = document.createElement('div');
        secDesc.className = 'desktop-settings-section-desc';
        secDesc.textContent = isCalendar
          ? 'Control what device hardware and capabilities Calendar can access.'
          : 'Control what device hardware and capabilities Mail can access.';

        contentArea.appendChild(secTitle);
        contentArea.appendChild(secDesc);

        // Permissions needed for calls and media (all off by default)
        renderToggleCard(
          contentArea,
          'mic',
          'Microphone',
          isCalendar
            ? 'Allow voice calls and meetings inside Calendar to access your microphone.'
            : 'Allow Desktop Mail to access your microphone for audio and voice calls.',
          'perm_mic',
          false
        );

        renderToggleCard(
          contentArea,
          'camera',
          'Camera',
          isCalendar
            ? 'Allow video calls and meetings inside Calendar to access your camera.'
            : 'Allow Desktop Mail to access your camera for video calls.',
          'perm_camera',
          false
        );

        renderToggleCard(
          contentArea,
          'location',
          'Location',
          isCalendar
            ? 'Allow Desktop Calendar to access approximate location for event addresses and directions.'
            : 'Allow Desktop Mail to access approximate location for security alerts and sign-in verification.',
          'perm_location',
          false
        );

        // Reset stored permissions inside Privacy section
        const resetWrap = document.createElement('div');
        resetWrap.className = 'desktop-privacy-reset-wrap';

        const resetBtn = document.createElement('button');
        resetBtn.className = 'desktop-reset-btn';
        resetBtn.textContent = 'Reset stored permissions';
        resetBtn.addEventListener('click', () => {
          ['notifications_enabled', 'open_at_login', 'perm_mic', 'perm_camera', 'perm_location'].forEach((k) => {
            try { localStorage.removeItem('desktop_pref_' + k); } catch (_) {}
          });
          try { localStorage.removeItem('desktop_first_run_completed'); } catch (_) {}
          renderContent('privacy');
        });

        resetWrap.appendChild(resetBtn);
        contentArea.appendChild(resetWrap);
      } else if (tabId === 'about') {
        // About Header
        const aboutHead = document.createElement('div');
        aboutHead.className = 'desktop-about-header';

        const logoWrap = document.createElement('div');
        logoWrap.className = 'desktop-about-logo';
        const logoSvg = createSvgIcon(isCalendar ? 'calendar-logo' : 'mail-logo');
        logoSvg.setAttribute('viewBox', '0 0 16 16');
        logoSvg.setAttribute('width', '48');
        logoSvg.setAttribute('height', '48');
        logoWrap.appendChild(logoSvg);

        const aboutTitles = document.createElement('div');
        const mainTitle = document.createElement('div');
        mainTitle.className = 'desktop-about-title';
        mainTitle.textContent = isCalendar ? 'About Desktop Calendar' : 'About Desktop Mail';

        const subTitle = document.createElement('div');
        subTitle.className = 'desktop-about-sub';
        subTitle.textContent = isCalendar
          ? 'Unofficial desktop wrapper for Calendar.'
          : 'Unofficial desktop wrapper for Mail.';

        aboutTitles.appendChild(mainTitle);
        aboutTitles.appendChild(subTitle);
        aboutHead.appendChild(logoWrap);
        aboutHead.appendChild(aboutTitles);
        contentArea.appendChild(aboutHead);

        // Version & Check for Updates row
        const verRow = document.createElement('div');
        verRow.className = 'desktop-version-row';

        const verLeft = document.createElement('div');
        verLeft.className = 'desktop-version-label';
        verLeft.textContent = 'Build Version ';
        const verNum = document.createElement('span');
        verNum.className = 'desktop-version-num';
        verNum.textContent = '0.1.0';
        verLeft.appendChild(verNum);

        const updateBtn = document.createElement('button');
        updateBtn.className = 'desktop-update-btn';
        updateBtn.textContent = 'Check for Updates';

        let targetUpdateUrl = null;

        updateBtn.addEventListener('click', () => {
          if (targetUpdateUrl) {
            window.open(targetUpdateUrl, '_blank');
            return;
          }

          updateBtn.disabled = true;
          updateBtn.textContent = 'Checking for updates...';

          fetch('https://api.github.com/repos/developer88/desktop-mail-and-calendar/releases/latest', {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
          })
            .then((res) => {
              if (res.status === 404) {
                return { tag_name: 'v0.1.0' };
              }
              if (!res.ok) throw new Error('Status ' + res.status);
              return res.json();
            })
            .then((data) => {
              const latestTag = (data && data.tag_name) || '';
              const latestVer = latestTag.replace(/^v/, '');
              const currentVer = '0.1.0';

              function isNewer(latest, current) {
                const p1 = latest.split('.').map((n) => parseInt(n, 10) || 0);
                const p2 = current.split('.').map((n) => parseInt(n, 10) || 0);
                for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
                  const num1 = p1[i] || 0;
                  const num2 = p2[i] || 0;
                  if (num1 > num2) return true;
                  if (num1 < num2) return false;
                }
                return false;
              }

              if (latestVer && isNewer(latestVer, currentVer)) {
                targetUpdateUrl = data.html_url || ('https://github.com/developer88/desktop-mail-and-calendar/releases/tag/' + latestTag);
                updateBtn.disabled = false;
                updateBtn.textContent = 'Download ' + latestTag + ' ↗';
                updateBtn.style.background = isCalendar ? '#16a34a' : '#ea580c';
                updateBtn.style.color = '#ffffff';
                updateBtn.style.borderColor = 'transparent';
              } else {
                updateBtn.textContent = 'You are on the latest version (v0.1.0)';
                setTimeout(() => {
                  updateBtn.disabled = false;
                  updateBtn.textContent = 'Check for Updates';
                }, 3500);
              }
            })
            .catch(() => {
              updateBtn.textContent = 'You are on the latest version (v0.1.0)';
              setTimeout(() => {
                updateBtn.disabled = false;
                updateBtn.textContent = 'Check for Updates';
              }, 3000);
            });
        });

        verRow.appendChild(verLeft);
        verRow.appendChild(updateBtn);
        contentArea.appendChild(verRow);

        // Disclaimer Box
        const discBox = document.createElement('div');
        discBox.className = 'desktop-disclaimer-box';

        const discTitle = document.createElement('div');
        discTitle.className = 'desktop-disclaimer-title';
        discTitle.textContent = 'Disclaimer & Legal Notice';

        const discText = document.createElement('div');
        discText.textContent = isCalendar
          ? 'Desktop Calendar is an independent open-source wrapper created solely to provide a focused desktop window for Google Calendar. It has no affiliation, connection, or endorsement with Google LLC or Alphabet Inc. All Google Calendar trademarks, logos, web interfaces, and intellectual property remain the exclusive property of Google LLC.'
          : 'Desktop Mail is an independent open-source wrapper created solely to provide a focused desktop window for Gmail. It has no affiliation, connection, or endorsement with Google LLC or Alphabet Inc. All Gmail trademarks, logos, web interfaces, and intellectual property remain the exclusive property of Google LLC.';

        const discLiability = document.createElement('div');
        discLiability.style.marginTop = '8px';
        discLiability.style.fontSize = '11px';
        discLiability.style.opacity = '0.85';
        discLiability.textContent = 'NO WARRANTY: THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, MISSED NOTIFICATIONS, OR OTHER LIABILITY ARISING FROM THE USE OF THIS SOFTWARE.';

        discBox.appendChild(discTitle);
        discBox.appendChild(discText);
        discBox.appendChild(discLiability);

        const noticeLink = document.createElement('button');
        noticeLink.className = 'desktop-about-link-btn';
        noticeLink.textContent = 'Review Welcome & Privacy Notice';
        noticeLink.addEventListener('click', () => {
          closeSettingsDialog();
          showWelcomeSplash(true);
        });
        discBox.appendChild(noticeLink);

        contentArea.appendChild(discBox);
      }
    }

    tabs.forEach((tab) => {
      const navItem = document.createElement('div');
      navItem.className = 'desktop-settings-nav-item' + (tab.id === currentTab ? ' active' : '');
      navItem.appendChild(createSvgIcon(tab.icon));

      const label = document.createElement('span');
      label.textContent = tab.label;
      navItem.appendChild(label);

      navItem.addEventListener('click', () => {
        if (currentTab === tab.id) return;
        currentTab = tab.id;
        Object.keys(navItems).forEach((id) => {
          if (id === tab.id) {
            navItems[id].classList.add('active');
          } else {
            navItems[id].classList.remove('active');
          }
        });
        renderContent(tab.id);
      });

      navItems[tab.id] = navItem;
      nav.appendChild(navItem);
    });

    body.appendChild(nav);
    body.appendChild(contentArea);

    // Initial render
    renderContent('general');

    // Footer
    const footer = document.createElement('div');
    footer.className = 'desktop-settings-footer';

    const doneBtn = document.createElement('button');
    doneBtn.className = 'desktop-settings-done-btn';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', closeSettingsDialog);

    footer.appendChild(doneBtn);

    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeSettingsDialog();
      }
    });

    (document.documentElement || document.body).appendChild(overlay);
  }

  function closeSettingsDialog() {
    const overlay = document.getElementById('desktop-settings-overlay');
    if (overlay) overlay.remove();
  }

  // Welcome & Privacy Notice Splash Screen (shown on very first load)
  function showWelcomeSplash(isRevisit) {
    if (document.getElementById('desktop-splash-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'desktop-splash-overlay';

    const dialog = document.createElement('div');
    dialog.id = 'desktop-splash-dialog';

    // Badge with app logo
    const badge = document.createElement('div');
    badge.className = 'desktop-splash-badge ' + (isCalendar ? 'calendar-theme' : 'mail-theme');
    const logoSvg = createSvgIcon(isCalendar ? 'calendar-logo' : 'mail-logo');
    logoSvg.setAttribute('viewBox', '0 0 16 16');
    logoSvg.setAttribute('width', '36');
    logoSvg.setAttribute('height', '36');
    badge.appendChild(logoSvg);

    // Title
    const title = document.createElement('h1');
    title.className = 'desktop-splash-title';
    title.textContent = isCalendar ? 'Welcome to Desktop Calendar' : 'Welcome to Desktop Mail';

    // Subtitle / Description
    const desc = document.createElement('p');
    desc.className = 'desktop-splash-desc';
    desc.textContent = isCalendar
      ? 'An independent, fast, and focused desktop experience for Calendar.'
      : 'An independent, fast, and focused desktop experience for Mail.';

    // Disclaimer & Privacy Highlights Cards
    const cards = document.createElement('div');
    cards.className = 'desktop-splash-cards';

    const items = [
      {
        icon: 'window',
        title: 'Independent Wrapper',
        desc: isCalendar
          ? 'Desktop Calendar is an unofficial desktop client created solely to provide a focused native window for Calendar.'
          : 'Desktop Mail is an unofficial desktop client created solely to provide a focused native window for Mail.'
      },
      {
        icon: 'shield',
        title: 'Privacy-First (No Tracking & No Logging)',
        desc: 'Strictly zero telemetry. The wrapper does not collect analytics, track your activity, or record background diagnostic logs.'
      },
      {
        icon: 'lock',
        title: 'Zero Data Access',
        desc: isCalendar
          ? 'The wrapper never reads, inspects, intercepts, or alters your calendar events, agendas, or account credentials.'
          : 'The wrapper never reads, inspects, intercepts, or alters your emails, messages, contacts, or account credentials.'
      },
      {
        icon: 'code',
        title: '100% Free & Open Source',
        desc: 'Built with Rust and Tauri. The complete source code is transparent, publicly auditable, and freely available on GitHub.'
      }
    ];

    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'desktop-splash-card-row';

      const iconWrap = document.createElement('div');
      iconWrap.className = 'desktop-splash-card-icon';
      iconWrap.appendChild(createSvgIcon(item.icon));

      const textWrap = document.createElement('div');
      textWrap.className = 'desktop-splash-card-text';

      const head = document.createElement('div');
      head.className = 'desktop-splash-card-header';
      head.textContent = item.title;

      const body = document.createElement('div');
      body.className = 'desktop-splash-card-body';
      body.textContent = item.desc;

      textWrap.appendChild(head);
      textWrap.appendChild(body);
      row.appendChild(iconWrap);
      row.appendChild(textWrap);
      cards.appendChild(row);
    });

    // Action button
    const actionBtn = document.createElement('button');
    actionBtn.className = 'desktop-splash-btn ' + (isCalendar ? 'calendar-theme' : 'mail-theme');
    actionBtn.textContent = isRevisit ? 'Got It' : 'Get Started';

    function dismissSplash() {
      try {
        localStorage.setItem('desktop_first_run_completed', 'true');
      } catch (_) {}
      overlay.classList.add('closing');
      setTimeout(() => {
        overlay.remove();
      }, 200);
    }

    actionBtn.addEventListener('click', dismissSplash);

    dialog.appendChild(badge);
    dialog.appendChild(title);
    dialog.appendChild(desc);
    dialog.appendChild(cards);
    dialog.appendChild(actionBtn);

    overlay.appendChild(dialog);

    if (isRevisit) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          dismissSplash();
        }
      });
    }

    const root = document.documentElement || document.body;
    if (root) {
      root.appendChild(overlay);
    }
  }

  function checkFirstRunSplash() {
    try {
      if (window.self !== window.top || window.parent !== window || window.frameElement) return;
      const completed = localStorage.getItem('desktop_first_run_completed');
      if (!completed) {
        showWelcomeSplash(false);
      }
    } catch (_) {}
  }

  // Dropdown Menu System matching Gemini Desktop app
  let activeDropdown = null;
  let activeSubmenu = null;

  function closeSubmenu() {
    if (activeSubmenu) {
      activeSubmenu.remove();
      activeSubmenu = null;
    }
  }

  function closeMenu() {
    closeSubmenu();
    if (activeDropdown) {
      activeDropdown.remove();
      activeDropdown = null;
    }
  }

  function createSubmenu(parentItem, items) {
    closeSubmenu();

    const submenu = document.createElement('div');
    submenu.className = 'desktop-menu-dropdown desktop-submenu';

    items.forEach((itemDef) => {
      if (itemDef.separator) {
        const sep = document.createElement('div');
        sep.className = 'desktop-menu-separator';
        submenu.appendChild(sep);
        return;
      }

      const item = document.createElement('div');
      item.className = 'desktop-menu-item';

      const label = document.createElement('span');
      label.className = 'desktop-menu-item-label';
      label.textContent = itemDef.label;
      item.appendChild(label);

      if (itemDef.shortcut) {
        const sc = document.createElement('span');
        sc.className = 'desktop-menu-item-shortcut';
        sc.textContent = itemDef.shortcut;
        item.appendChild(sc);
      }

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenu();
        if (itemDef.action) itemDef.action();
      });

      submenu.appendChild(item);
    });

    const rect = parentItem.getBoundingClientRect();
    submenu.style.top = rect.top + 'px';

    const subWidth = 190;
    if (rect.left - subWidth < 10) {
      submenu.style.left = (rect.right + 2) + 'px';
    } else {
      submenu.style.right = (window.innerWidth - rect.left + 2) + 'px';
    }

    (document.documentElement || document.body).appendChild(submenu);
    activeSubmenu = submenu;
  }

  function toggleMenu(anchorBtn) {
    if (activeDropdown) {
      closeMenu();
      return;
    }

    const dropdown = document.createElement('div');
    dropdown.id = 'desktop-menu-dropdown';
    dropdown.className = 'desktop-menu-dropdown';

    const menuStructure = [
      {
        label: 'File',
        subitems: [
          { label: 'Settings', action: () => openSettingsDialog() },
          { separator: true },
          { label: 'Exit', shortcut: 'Alt+F4', action: () => triggerAction('close') }
        ]
      },
      {
        label: 'Edit',
        subitems: [
          { label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
          { label: 'Redo', shortcut: 'Ctrl+Y', action: () => document.execCommand('redo') },
          { separator: true },
          { label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
          { label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
          { label: 'Paste', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
          { separator: true },
          { label: 'Select all', shortcut: 'Ctrl+A', action: () => document.execCommand('selectAll') }
        ]
      },
      {
        label: 'View',
        subitems: [
          { label: 'Reload', shortcut: 'Ctrl+R', action: () => window.location.reload() },
          { label: 'Force Reload', shortcut: 'Ctrl+Shift+R', action: () => window.location.reload(true) },
          { separator: true },
          { label: 'Actual size', shortcut: 'Ctrl+0', action: () => applyZoom(1.0) },
          { label: 'Zoom in', shortcut: 'Ctrl++', action: () => applyZoom(currentZoom + 0.1) },
          { label: 'Zoom out', shortcut: 'Ctrl+-', action: () => applyZoom(currentZoom - 0.1) },
          { separator: true },
          { label: 'Toggle full screen', shortcut: 'F11', action: () => triggerAction('fullscreen') }
        ]
      },
      {
        label: 'Window',
        subitems: [
          { label: 'Minimize', action: () => triggerAction('minimize') },
          { label: 'Maximize', action: () => triggerAction('maximize') }
        ]
      }
    ];

    menuStructure.forEach((category) => {
      const item = document.createElement('div');
      item.className = 'desktop-menu-item has-sub';

      const label = document.createElement('span');
      label.className = 'desktop-menu-item-label';
      label.textContent = category.label;
      item.appendChild(label);

      const arrow = document.createElement('span');
      arrow.className = 'desktop-menu-arrow';
      arrow.textContent = '›';
      item.appendChild(arrow);

      item.addEventListener('mouseenter', () => {
        createSubmenu(item, category.subitems);
      });

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        createSubmenu(item, category.subitems);
      });

      dropdown.appendChild(item);
    });

    const rect = anchorBtn.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.right = (window.innerWidth - rect.right) + 'px';

    (document.documentElement || document.body).appendChild(dropdown);
    activeDropdown = dropdown;
  }

  // Dismiss menu on outside clicks
  window.addEventListener('pointerdown', (e) => {
    if (activeDropdown || activeSubmenu) {
      const inDropdown = activeDropdown && activeDropdown.contains(e.target);
      const inSubmenu = activeSubmenu && activeSubmenu.contains(e.target);
      const menuBtn = document.getElementById('desktop-caption-menu');
      const inMenuBtn = menuBtn && menuBtn.contains(e.target);

      if (!inDropdown && !inSubmenu && !inMenuBtn) {
        closeMenu();
      }
    }
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.getElementById('desktop-settings-overlay')) {
        closeSettingsDialog();
      } else if (activeDropdown) {
        closeMenu();
      }
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') {
        e.preventDefault();
        applyZoom(currentZoom + 0.1);
      } else if (e.key === '-' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        applyZoom(currentZoom - 0.1);
      } else if (e.key === '0' || e.code === 'Numpad0') {
        e.preventDefault();
        applyZoom(1.0);
      } else if (e.key === 'r' || e.key === 'R') {
        if (e.shiftKey) {
          e.preventDefault();
          window.location.reload(true);
        } else {
          e.preventDefault();
          window.location.reload();
        }
      }
    } else if (e.key === 'F11') {
      e.preventDefault();
      triggerAction('fullscreen');
    } else if (e.key === 'F5') {
      e.preventDefault();
      if (e.ctrlKey || e.shiftKey) {
        window.location.reload(true);
      } else {
        window.location.reload();
      }
    }
  });

  function createTitlebar() {
    checkFirstRunSplash();
    if (document.getElementById('desktop-custom-titlebar')) {
      updateAdaptiveTheme();
      return;
    }

    const titlebar = document.createElement('div');
    titlebar.id = 'desktop-custom-titlebar';
    titlebar.setAttribute('data-tauri-drag-region', 'deep');

    const dragArea = document.createElement('div');
    dragArea.id = 'desktop-custom-titlebar-drag';
    dragArea.setAttribute('data-tauri-drag-region', 'deep');

    const title = document.createElement('span');
    title.id = 'desktop-custom-titlebar-title';
    title.textContent = isCalendar ? 'Google Calendar' : '';
    dragArea.appendChild(title);

    const controls = document.createElement('div');
    controls.id = 'desktop-custom-titlebar-controls';

    // Hamburger Menu Button (3 horizontal lines)
    const menuBtn = document.createElement('button');
    menuBtn.className = 'desktop-caption-btn menu';
    menuBtn.id = 'desktop-caption-menu';
    menuBtn.title = 'Menu';
    menuBtn.appendChild(createSvgIcon('menu'));

    const minBtn = document.createElement('button');
    minBtn.className = 'desktop-caption-btn';
    minBtn.id = 'desktop-caption-min';
    minBtn.title = 'Minimize';
    minBtn.appendChild(createSvgIcon('min'));

    const maxBtn = document.createElement('button');
    maxBtn.className = 'desktop-caption-btn';
    maxBtn.id = 'desktop-caption-max';
    maxBtn.title = 'Maximize';
    maxBtn.appendChild(createSvgIcon('max'));

    const closeBtn = document.createElement('button');
    closeBtn.className = 'desktop-caption-btn close';
    closeBtn.id = 'desktop-caption-close';
    closeBtn.title = 'Close';
    closeBtn.appendChild(createSvgIcon('close'));

    controls.appendChild(menuBtn);
    controls.appendChild(minBtn);
    controls.appendChild(maxBtn);
    controls.appendChild(closeBtn);

    titlebar.appendChild(dragArea);
    titlebar.appendChild(controls);

    const root = document.documentElement || document.body;
    if (root) {
      root.appendChild(titlebar);
    }
    updateAdaptiveTheme();

    // Action handlers
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleMenu(menuBtn);
    });

    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      closeMenu();
      triggerAction('minimize');
    });

    maxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      closeMenu();
      triggerAction('maximize');
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      closeMenu();
      triggerAction('close');
    });

    dragArea.addEventListener('mousedown', (e) => {
      if (e.button === 0 && e.detail === 1) {
        closeMenu();
        triggerAction('drag');
      }
    });

    dragArea.addEventListener('dblclick', (e) => {
      if (e.button === 0) {
        e.stopPropagation();
        e.preventDefault();
        closeMenu();
        triggerAction('maximize');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createTitlebar);
  } else {
    createTitlebar();
  }
  setInterval(createTitlebar, 1500);
})();
