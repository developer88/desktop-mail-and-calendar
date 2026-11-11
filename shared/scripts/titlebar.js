/**
 * Injects a modern Windows 11 frameless titlebar overlay
 * that blends seamlessly with Gmail's background image.
 * Uses strict DOM methods (no innerHTML) to comply with Gmail's Trusted Types CSP.
 */
(function initTitlebarOverlay() {
  const svgNS = 'http://www.w3.org/2000/svg';

  function createSvgIcon(type) {
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 10 10');
    svg.setAttribute('width', '10');
    svg.setAttribute('height', '10');
    svg.style.pointerEvents = 'none';

    if (type === 'min') {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 0,5 L 10,5');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.2');
      svg.appendChild(path);
    } else if (type === 'max') {
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', '1');
      rect.setAttribute('y', '1');
      rect.setAttribute('width', '8');
      rect.setAttribute('height', '8');
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', 'currentColor');
      rect.setAttribute('stroke-width', '1.2');
      svg.appendChild(rect);
    } else if (type === 'close') {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 1.5,1.5 L 8.5,8.5 M 8.5,1.5 L 1.5,8.5');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.2');
      svg.appendChild(path);
    }
    return svg;
  }

  function triggerAction(action) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'desktop-app://window/' + action;
    (document.body || document.documentElement).appendChild(iframe);
    setTimeout(() => {
      try { iframe.remove(); } catch (_) {}
    }, 150);
  }

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

    controls.appendChild(minBtn);
    controls.appendChild(maxBtn);
    controls.appendChild(closeBtn);

    titlebar.appendChild(dragArea);
    titlebar.appendChild(controls);

    const root = document.body || document.documentElement;
    if (root) {
      root.appendChild(titlebar);
    }

    // Window action handlers
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      triggerAction('minimize');
    });

    maxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      triggerAction('maximize');
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      triggerAction('close');
    });

    dragArea.addEventListener('mousedown', (e) => {
      if (e.button === 0 && e.detail === 1) {
        triggerAction('drag');
      }
    });

    dragArea.addEventListener('dblclick', (e) => {
      if (e.button === 0) {
        e.stopPropagation();
        e.preventDefault();
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
