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
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('width', '12');
    svg.setAttribute('height', '12');
    svg.style.pointerEvents = 'none';

    if (type === 'menu') {
      // 3 clean horizontal lines matching Gemini Desktop app
      [2.5, 6, 9.5].forEach((y) => {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', '1.5');
        line.setAttribute('y1', y.toString());
        line.setAttribute('x2', '10.5');
        line.setAttribute('y2', y.toString());
        line.setAttribute('stroke', 'currentColor');
        line.setAttribute('stroke-width', '1.2');
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
      });
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
    
    // Position to the left of the main menu if near right edge
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

    // Clean, natural background without artificial serif title
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
