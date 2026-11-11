/**
 * Injects a modern Windows 11 frameless titlebar overlay
 * that blends seamlessly with Gmail's background image.
 * Uses strict DOM methods (no innerHTML) to comply with Gmail's Trusted Types CSP.
 */
(function initTitlebarOverlay() {
  const svgNS = 'http://www.w3.org/2000/svg';

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
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('width', '12');
    svg.setAttribute('height', '12');
    svg.style.pointerEvents = 'none';

    if (type === 'menu') {
      const line1 = document.createElementNS(svgNS, 'line');
      line1.setAttribute('x1', '1');
      line1.setAttribute('y1', '4');
      line1.setAttribute('x2', '11');
      line1.setAttribute('y2', '4');
      line1.setAttribute('stroke', 'currentColor');
      line1.setAttribute('stroke-width', '1.3');
      line1.setAttribute('stroke-linecap', 'round');

      const line2 = document.createElementNS(svgNS, 'line');
      line2.setAttribute('x1', '1');
      line2.setAttribute('y1', '8');
      line2.setAttribute('x2', '11');
      line2.setAttribute('y2', '8');
      line2.setAttribute('stroke', 'currentColor');
      line2.setAttribute('stroke-width', '1.3');
      line2.setAttribute('stroke-linecap', 'round');

      svg.appendChild(line1);
      svg.appendChild(line2);
    } else if (type === 'min') {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 1,6 L 11,6');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.2');
      svg.appendChild(path);
    } else if (type === 'max') {
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', '1.5');
      rect.setAttribute('y', '1.5');
      rect.setAttribute('width', '9');
      rect.setAttribute('height', '9');
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', 'currentColor');
      rect.setAttribute('stroke-width', '1.2');
      svg.appendChild(rect);
    } else if (type === 'close') {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 2,2 L 10,10 M 10,2 L 2,10');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.2');
      svg.appendChild(path);
    } else if (type === 'gear') {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', '6');
      circle.setAttribute('cy', '6');
      circle.setAttribute('r', '2.5');
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', 'currentColor');
      circle.setAttribute('stroke-width', '1.2');

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M6,0.5 L6,2 M6,10 L6,11.5 M0.5,6 L2,6 M10,6 L11.5,6 M2.1,2.1 L3.2,3.2 M8.8,8.8 L9.9,9.9 M2.1,9.9 L3.2,8.8 M8.8,3.2 L9.9,2.1');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.2');

      svg.appendChild(circle);
      svg.appendChild(path);
    }
    return svg;
  }

  function triggerAction(action) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'desktop-app://window/' + action;
    (document.documentElement || document.body).appendChild(iframe);
    setTimeout(() => {
      try { iframe.remove(); } catch (_) {}
    }, 150);
  }

  // Settings Modal Dialog
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

    const nav = document.createElement('div');
    nav.className = 'desktop-settings-nav';

    const generalNav = document.createElement('div');
    generalNav.className = 'desktop-settings-nav-item active';
    generalNav.textContent = 'General';
    nav.appendChild(generalNav);

    const aboutNav = document.createElement('div');
    aboutNav.className = 'desktop-settings-nav-item';
    aboutNav.textContent = 'About';
    nav.appendChild(aboutNav);

    const content = document.createElement('div');
    content.className = 'desktop-settings-content';

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'desktop-settings-section-title';
    sectionTitle.textContent = 'General Preferences';

    const sectionDesc = document.createElement('div');
    sectionDesc.className = 'desktop-settings-section-desc';
    sectionDesc.textContent = 'Desktop Gmail application settings and options.';

    const card = document.createElement('div');
    card.className = 'desktop-settings-card';
    card.textContent = 'Configuration settings are in preparation for future releases. Shortcuts and zoom levels are managed via the titlebar menu.';

    content.appendChild(sectionTitle);
    content.appendChild(sectionDesc);
    content.appendChild(card);

    body.appendChild(nav);
    body.appendChild(content);

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

  // Dropdown Menu
  let activeDropdown = null;

  function closeMenu() {
    if (activeDropdown) {
      activeDropdown.remove();
      activeDropdown = null;
    }
  }

  function toggleMenu(anchorBtn) {
    if (activeDropdown) {
      closeMenu();
      return;
    }

    const dropdown = document.createElement('div');
    dropdown.id = 'desktop-menu-dropdown';

    function addHeader(text) {
      const h = document.createElement('div');
      h.className = 'desktop-menu-section-header';
      h.textContent = text;
      dropdown.appendChild(h);
    }

    function addSeparator() {
      const sep = document.createElement('div');
      sep.className = 'desktop-menu-separator';
      dropdown.appendChild(sep);
    }

    function addItem(label, shortcut, onClick) {
      const item = document.createElement('div');
      item.className = 'desktop-menu-item';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'desktop-menu-item-label';
      labelSpan.textContent = label;
      item.appendChild(labelSpan);

      if (shortcut) {
        const scSpan = document.createElement('span');
        scSpan.className = 'desktop-menu-item-shortcut';
        scSpan.textContent = shortcut;
        item.appendChild(scSpan);
      }

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenu();
        onClick();
      });

      dropdown.appendChild(item);
    }

    // File section
    addHeader('File');
    addItem('Settings', '', () => {
      openSettingsDialog();
    });
    addItem('Exit', 'Alt+F4', () => {
      triggerAction('close');
    });

    addSeparator();

    // View section
    addHeader('View');
    addItem('Reload', 'Ctrl+R', () => {
      window.location.reload();
    });
    addItem('Force Reload', 'Ctrl+Shift+R', () => {
      window.location.reload(true);
    });
    addSeparator();
    addItem('Actual size', 'Ctrl+0', () => {
      applyZoom(1.0);
    });
    addItem('Zoom in', 'Ctrl++', () => {
      applyZoom(currentZoom + 0.1);
    });
    addItem('Zoom out', 'Ctrl+-', () => {
      applyZoom(currentZoom - 0.1);
    });
    addSeparator();
    addItem('Toggle full screen', 'F11', () => {
      triggerAction('fullscreen');
    });

    const rect = anchorBtn.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.right = (window.innerWidth - rect.right) + 'px';

    (document.documentElement || document.body).appendChild(dropdown);
    activeDropdown = dropdown;
  }

  // Dismiss menu on outside clicks
  window.addEventListener('pointerdown', (e) => {
    if (activeDropdown && !activeDropdown.contains(e.target)) {
      const menuBtn = document.getElementById('desktop-caption-menu');
      if (menuBtn && menuBtn.contains(e.target)) return;
      closeMenu();
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

    const titleText = document.createElement('span');
    titleText.id = 'desktop-custom-titlebar-title';
    titleText.textContent = 'Gmail';
    dragArea.appendChild(titleText);

    const controls = document.createElement('div');
    controls.id = 'desktop-custom-titlebar-controls';

    // Hamburger Menu Button (=)
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
