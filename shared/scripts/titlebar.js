/**
 * Injects a modern Windows 11 frameless titlebar overlay
 * that blends seamlessly with Gmail's background image.
 */
(function initTitlebarOverlay() {
  function createTitlebar() {
    if (document.getElementById('desktop-custom-titlebar')) return;

    const titlebar = document.createElement('div');
    titlebar.id = 'desktop-custom-titlebar';
    titlebar.setAttribute('data-tauri-drag-region', '');

    const dragArea = document.createElement('div');
    dragArea.id = 'desktop-custom-titlebar-drag';
    dragArea.setAttribute('data-tauri-drag-region', '');

    const titleText = document.createElement('span');
    titleText.id = 'desktop-custom-titlebar-title';
    titleText.textContent = 'Gmail';
    titleText.setAttribute('data-tauri-drag-region', '');
    dragArea.appendChild(titleText);

    const controls = document.createElement('div');
    controls.id = 'desktop-custom-titlebar-controls';

    function createBtn(id, title, svgContent, isClose) {
      const btn = document.createElement('button');
      btn.className = 'desktop-caption-btn' + (isClose ? ' close' : '');
      btn.id = id;
      btn.title = title;
      btn.innerHTML = svgContent;
      return btn;
    }

    const minBtn = createBtn('desktop-caption-min', 'Minimize', '<svg viewBox="0 0 10 10"><path d="M 0,5 L 10,5" stroke="currentColor" stroke-width="1.2"/></svg>', false);
    const maxBtn = createBtn('desktop-caption-max', 'Maximize', '<svg viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>', false);
    const closeBtn = createBtn('desktop-caption-close', 'Close', '<svg viewBox="0 0 10 10"><path d="M 1.5,1.5 L 8.5,8.5 M 8.5,1.5 L 1.5,8.5" stroke="currentColor" stroke-width="1.2"/></svg>', true);

    controls.appendChild(minBtn);
    controls.appendChild(maxBtn);
    controls.appendChild(closeBtn);

    titlebar.appendChild(dragArea);
    titlebar.appendChild(controls);

    (document.body || document.documentElement).appendChild(titlebar);

    function triggerAction(action) {
      if (window.__TAURI__ && window.__TAURI__.core) {
        window.__TAURI__.core.invoke(action + '_window');
        return;
      }
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = 'desktop-app://window/' + action;
      document.documentElement.appendChild(iframe);
      setTimeout(() => iframe.remove(), 100);
    }

    minBtn.addEventListener('click', (e) => { e.stopPropagation(); triggerAction('minimize'); });
    maxBtn.addEventListener('click', (e) => { e.stopPropagation(); triggerAction('maximize'); });
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); triggerAction('close'); });

    dragArea.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      triggerAction('maximize');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createTitlebar);
  } else {
    createTitlebar();
  }
  setInterval(createTitlebar, 2000);
})();
