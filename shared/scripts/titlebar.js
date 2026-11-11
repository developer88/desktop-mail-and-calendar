/**
 * Injects a modern Windows 11 frameless titlebar overlay
 * that blends seamlessly with Gmail's background image.
 * Uses strict DOM methods (no innerHTML) to comply with Gmail's Trusted Types CSP.
 */
(function initTitlebarOverlay() {
  const svgNS = 'http://www.w3.org/2000/svg';

  // Fast, CSP-proof native action trigger via document.title interceptor
  let lastNonCmdTitle = document.title || 'Gmail';
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
    } else if (type === 'gmail-logo') {
      // Modern Google 4-color M logo
      const p1 = document.createElementNS(svgNS, 'path');
      p1.setAttribute('d', 'M 3,4 L 3,12 L 5.5,12 L 5.5,6.5 L 8,8.5 L 10.5,6.5 L 10.5,12 L 13,12 L 13,4 L 8,8 Z');
      p1.setAttribute('fill', '#EA4335'); // Red

      const p2 = document.createElementNS(svgNS, 'path');
      p2.setAttribute('d', 'M 3,4 L 5.5,6.5 L 5.5,12 L 3,12 Z');
      p2.setAttribute('fill', '#4285F4'); // Blue

      const p3 = document.createElementNS(svgNS, 'path');
      p3.setAttribute('d', 'M 13,4 L 10.5,6.5 L 10.5,12 L 13,12 Z');
      p3.setAttribute('fill', '#34A853'); // Green

      const p4 = document.createElementNS(svgNS, 'path');
      p4.setAttribute('d', 'M 10.5,6.5 L 13,4 L 10.5,4 Z');
      p4.setAttribute('fill', '#FBBC05'); // Yellow

      svg.appendChild(p1);
      svg.appendChild(p2);
      svg.appendChild(p3);
      svg.appendChild(p4);
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
      { id: 'about', label: 'About Desktop Gmail', icon: 'info' }
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

    function renderContent(tabId) {
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

        // 1. Desktop Notifications
        renderToggleCard(
          contentArea,
          'bell',
          'Desktop Notifications',
          'Show system notifications for new unread incoming emails.',
          'notifications_enabled',
          true,
          (enabled) => {
            if (enabled && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
              Notification.requestPermission();
            }
          }
        );

        // 2. Open at login
        renderToggleCard(
          contentArea,
          'login',
          'Open at login',
          'Start Desktop Gmail automatically when you sign into Windows.',
          'open_at_login',
          false,
          (enabled) => {
            triggerAction(enabled ? 'autostart:on' : 'autostart:off');
          }
        );
      } else if (tabId === 'privacy') {
        const secTitle = document.createElement('div');
        secTitle.className = 'desktop-settings-section-title';
        secTitle.textContent = 'App Permissions';

        const secDesc = document.createElement('div');
        secDesc.className = 'desktop-settings-section-desc';
        secDesc.textContent = 'Control what device hardware and capabilities Gmail can access.';

        contentArea.appendChild(secTitle);
        contentArea.appendChild(secDesc);

        // Permissions needed by Gmail & Google Meet inside Gmail
        renderToggleCard(
          contentArea,
          'mic',
          'Microphone',
          'Allow Gmail and Google Meet to access your microphone for audio and calls.',
          'perm_mic',
          true
        );

        renderToggleCard(
          contentArea,
          'camera',
          'Camera',
          'Allow Google Meet inside Gmail to access your camera for video calls.',
          'perm_camera',
          true
        );

        renderToggleCard(
          contentArea,
          'location',
          'Location',
          'Allow Gmail to access approximate location for security alerts and sign-in verification.',
          'perm_location',
          false
        );

        renderToggleCard(
          contentArea,
          'bug',
          'Usage statistics and crash reporting',
          'Send anonymous diagnostic info to help improve Desktop Gmail performance.',
          'perm_telemetry',
          false
        );
      } else if (tabId === 'about') {
        // About Header
        const aboutHead = document.createElement('div');
        aboutHead.className = 'desktop-about-header';

        const logoWrap = document.createElement('div');
        logoWrap.className = 'desktop-about-logo';
        const logoSvg = createSvgIcon('gmail-logo');
        logoSvg.setAttribute('viewBox', '0 0 16 16');
        logoSvg.setAttribute('width', '48');
        logoSvg.setAttribute('height', '48');
        logoWrap.appendChild(logoSvg);

        const aboutTitles = document.createElement('div');
        const mainTitle = document.createElement('div');
        mainTitle.className = 'desktop-about-title';
        mainTitle.textContent = 'About Desktop Gmail';

        const subTitle = document.createElement('div');
        subTitle.className = 'desktop-about-sub';
        subTitle.textContent = 'Unofficial desktop wrapper for Google Gmail.';

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

        updateBtn.addEventListener('click', () => {
          updateBtn.disabled = true;
          updateBtn.textContent = 'Checking for updates...';
          setTimeout(() => {
            updateBtn.textContent = 'You are on the latest version';
            setTimeout(() => {
              updateBtn.disabled = false;
              updateBtn.textContent = 'Check for Updates';
            }, 3000);
          }, 900);
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
        discText.textContent =
          'Desktop Gmail is an independent open-source wrapper created solely to provide a focused desktop window for Gmail. It has no affiliation, connection, or endorsement with Google LLC or Alphabet Inc. All Gmail trademarks, logos, web interfaces, and intellectual property remain the exclusive property of Google LLC.';

        discBox.appendChild(discTitle);
        discBox.appendChild(discText);
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

    const resetBtn = document.createElement('button');
    resetBtn.className = 'desktop-reset-btn';
    resetBtn.textContent = 'Reset stored permissions';
    resetBtn.addEventListener('click', () => {
      ['notifications_enabled', 'open_at_login', 'perm_mic', 'perm_camera', 'perm_location', 'perm_telemetry'].forEach((k) => {
        try { localStorage.removeItem('desktop_pref_' + k); } catch (_) {}
      });
      renderContent(currentTab);
    });

    const doneBtn = document.createElement('button');
    doneBtn.className = 'desktop-settings-done-btn';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', closeSettingsDialog);

    footer.appendChild(resetBtn);
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
    if (document.getElementById('desktop-custom-titlebar')) return;

    const titlebar = document.createElement('div');
    titlebar.id = 'desktop-custom-titlebar';
    titlebar.setAttribute('data-tauri-drag-region', 'deep');

    const dragArea = document.createElement('div');
    dragArea.id = 'desktop-custom-titlebar-drag';
    dragArea.setAttribute('data-tauri-drag-region', 'deep');

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
