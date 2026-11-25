const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

console.log('Running Dual-WebView Shell, Native Menu & Child Dialog E2E Tests...');

const root = path.resolve(__dirname, '..');
const calLibRs = fs.readFileSync(path.join(root, 'apps/desktop-calendar/src-tauri/src/lib.rs'), 'utf8');
const mailLibRs = fs.readFileSync(path.join(root, 'apps/desktop-mail/src-tauri/src/lib.rs'), 'utf8');
const titlebarScript = fs.readFileSync(path.join(root, 'shared/scripts/titlebar.js'), 'utf8');
const shellCss = fs.readFileSync(path.join(root, 'shared/styles/shell.css'), 'utf8');
const win11ThemeCss = fs.readFileSync(path.join(root, 'shared/styles/win11-theme.css'), 'utf8');

// ============================================================================
// 1. Verify Native Menu Structure & Mica Backdrop in Both Rust Apps
// ============================================================================
console.log('\n[1/4] Verifying native menu structure, off-thread dialog spawn, and Mica backdrop...');
for (const [name, src] of [['Desktop Calendar', calLibRs], ['Desktop Mail', mailLibRs]]) {
  // Single File->Settings and File->About (no duplicates, no New Event/New Message)
  assert(!src.includes('app_settings_top'), `${name} must NOT duplicate Settings at top level`);
  assert(!src.includes('file_new_event'), `${name} must NOT have New Event menu item`);
  assert(!src.includes('file_new_message'), `${name} must NOT have New Message menu item`);

  const fileMenuMatch = src.match(/let file_menu = SubmenuBuilder::new\(&app, "File"\)([\s\S]*?)\.build\(\)/);
  assert(fileMenuMatch, `${name} must define File submenu`);
  assert(fileMenuMatch[1].includes('"app_settings"'), `${name} File submenu must contain Settings...`);
  assert(fileMenuMatch[1].includes('"app_about"'), `${name} File submenu must contain About...`);

  // Ensure root MenuBuilder only adds the 4 standard submenus
  const rootMenuMatch = src.match(/let menu = MenuBuilder::new\(&app\)([\s\S]*?)\.build\(\)/);
  assert(rootMenuMatch, `${name} must build root MenuBuilder`);
  assert(!rootMenuMatch[1].includes('app_settings'), `${name} root menu must not duplicate Settings`);
  assert(!rootMenuMatch[1].includes('app_about'), `${name} root menu must not duplicate About`);

  // Ensure dialog window creation in on_menu_event is spawned off the main thread
  assert(src.includes('open_dialog_window_impl(&app_dlg, "settings", false, true);'), `${name} must spawn Settings dialog off main thread`);
  assert(src.includes('open_dialog_window_impl(&app_dlg, "about", false, true);'), `${name} must spawn About dialog off main thread`);
  assert(src.includes('open_dialog_window_impl(&app_prewarm, "settings", false, false);'), `${name} must pre-warm hidden dialog window for instant opening`);

  // Ensure Option 1: Windows 11 Mica + transparent main window + transparent shell webview
  assert(src.includes('WindowBackdrop::Mica'), `${name} must apply WindowBackdrop::Mica`);
  assert(src.includes('.transparent(true)'), `${name} must configure transparent(true) for Mica`);
  assert(src.includes('.owner_raw(hwnd)'), `${name} must use owner_raw(hwnd) for dialog window so it floats above WebView2`);
  assert(!src.includes('.parent_raw(hwnd)'), `${name} must NOT use parent_raw(hwnd) (WS_CHILD hides behind WebView2)`);
}
console.log('PASS: Native menu, off-thread dialog spawn, and Mica backdrop verified for both apps.');

// ============================================================================
// 2. Verify Shell WebView Renders on tauri.localhost & Invokes show_app_menu
// ============================================================================
console.log('\n[2/4] Verifying Shell WebView on tauri.localhost...');
{
  const dom = new JSDOM('<!DOCTYPE html><html><head><title>Desktop Shell</title></head><body></body></html>', {
    url: 'https://tauri.localhost/shell.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const { document } = window;

  const invoked = [];
  window.APP_KIND = 'mail';
  window.PRIMARY_HOST = 'mail.google.com';
  window.__DESKTOP_SHELL_ONLY__ = true;
  window.__DESKTOP_FIRST_RUN__ = false;
  window.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  window.__TAURI__ = {
    core: {
      invoke: (cmd, args) => {
        invoked.push({ cmd, args });
        return Promise.resolve();
      }
    }
  };

  const styleEl = document.createElement('style');
  styleEl.textContent = shellCss;
  document.head.appendChild(styleEl);
  window.eval(titlebarScript);

  const titlebar = document.getElementById('desktop-custom-titlebar');
  assert(titlebar, 'Titlebar must render inside shell.html on tauri.localhost');
  const menuBtn = document.getElementById('desktop-caption-menu');
  assert(menuBtn, 'Menu button must exist in shell.html');
  menuBtn.click();

  const menuCall = invoked.find((c) => c.cmd === 'show_app_menu');
  assert(menuCall, 'Clicking menu button in shell mode must invoke show_app_menu');
  assert.strictEqual(menuCall.args.y, 32, 'Popup menu y coordinate must be 32');

  const minBtn = document.getElementById('desktop-caption-min');
  minBtn.click();
  assert(invoked.some((c) => c.cmd === 'minimize_window'), 'Minimize button must invoke minimize_window');
  console.log('PASS: Shell WebView renders on tauri.localhost and dispatches native commands.');
}

// ============================================================================
// 3. Verify Dialog WebView Renders Settings, About, and Welcome Modes
// ============================================================================
console.log('\n[3/4] Verifying Child Dialog WebView modes (settings, about, welcome)...');
for (const mode of ['settings', 'about', 'welcome']) {
  const dom = new JSDOM('<!DOCTYPE html><html class="desktop-dialog-window"><head><title>Desktop Dialog</title></head><body></body></html>', {
    url: 'https://tauri.localhost/dialog.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const { document } = window;
  const invoked = [];

  window.APP_KIND = 'calendar';
  window.PRIMARY_HOST = 'calendar.google.com';
  window.__DESKTOP_DIALOG_MODE__ = mode;
  window.__DESKTOP_FIRST_RUN__ = mode === 'welcome';
  window.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  window.__TAURI__ = {
    core: {
      invoke: (cmd, args) => {
        invoked.push({ cmd, args });
        return Promise.resolve();
      }
    }
  };

  const styleEl = document.createElement('style');
  styleEl.textContent = shellCss + '\n' + win11ThemeCss;
  document.head.appendChild(styleEl);
  window.eval(titlebarScript);

  if (mode === 'welcome') {
    const splash = document.getElementById('desktop-splash-dialog');
    assert(splash, 'Welcome dialog must render in welcome mode');
    const actionBtn = splash.querySelector('.desktop-splash-btn');
    assert(actionBtn, 'Welcome dialog must have Get Started button');
    actionBtn.click();
    assert(invoked.some((c) => c.cmd === 'mark_first_run_completed'), 'Dismissing welcome must invoke mark_first_run_completed');
  } else {
    const dialog = document.getElementById('desktop-settings-dialog');
    assert(dialog, `Settings/About dialog must render in ${mode} mode`);
    if (mode === 'settings') {
      const contentEl = dialog.querySelector('.desktop-settings-content');
      contentEl.scrollTop = 240;
      const navItems = dialog.querySelectorAll('.desktop-settings-nav-item');
      navItems[2].click();
      assert.strictEqual(contentEl.scrollTop, 0, 'Switching settings tabs must reset scrollTop to 0');
      contentEl.scrollTop = 180;
      window.__desktop_open_dialog_mode('general');
      assert.strictEqual(contentEl.scrollTop, 0, 'Reopening dialog mode must reset scrollTop to 0');
    }
    if (mode === 'about') {
      assert(dialog.textContent.includes('Desktop Calendar'), 'About mode must display Desktop Calendar info');
    }
    const doneBtn = dialog.querySelector('.desktop-settings-done-btn');
    assert(doneBtn, 'Settings/About dialog must have Done button');
    doneBtn.click();
    assert(invoked.some((c) => c.cmd === 'close_dialog'), 'Done button must invoke close_dialog');
  }
}
console.log('PASS: All child dialog modes (settings, about, welcome) verified.');

// ============================================================================
// 4. Verify Dialog Mode Survives WebView2 document_start (null root/body)
// ============================================================================
console.log('\n[4/5] Verifying dialog mode handles WebView2 document_start (null body)...');
{
  const dom = new JSDOM('<!DOCTYPE html><html class="desktop-dialog-window"><head><title>Desktop Dialog</title></head><body></body></html>', {
    url: 'https://tauri.localhost/dialog.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const { document } = window;
  const realBody = document.body;
  // Simulate document_start where body is not parsed yet
  Object.defineProperty(document, 'body', { get: () => null, configurable: true });
  Object.defineProperty(document, 'readyState', { get: () => 'loading', configurable: true });

  window.APP_KIND = 'calendar';
  window.PRIMARY_HOST = 'calendar.google.com';
  window.__DESKTOP_DIALOG_MODE__ = 'settings';
  window.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });

  window.eval(titlebarScript);
  assert.strictEqual(document.getElementById('desktop-settings-dialog'), null, 'Must defer dialog mount until body exists');

  // Restore body and fire DOMContentLoaded
  Object.defineProperty(document, 'body', { get: () => realBody, configurable: true });
  Object.defineProperty(document, 'readyState', { get: () => 'interactive', configurable: true });
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  assert(document.getElementById('desktop-settings-dialog'), 'Dialog must render cleanly on DOMContentLoaded after document_start');
  console.log('PASS: Dialog mode survives WebView2 document_start and renders on DOMContentLoaded.');
}

// ============================================================================
// 5. Verify UI HTML Entrypoints Exist for Both Apps
// ============================================================================
console.log('\n[5/5] Verifying shell.html and dialog.html exist for both apps...');
for (const app of ['desktop-calendar', 'desktop-mail']) {
  for (const file of ['shell.html', 'dialog.html']) {
    const p = path.join(root, 'apps', app, 'ui', file);
    assert(fs.existsSync(p), `Missing ${app}/ui/${file}`);
  }
}
console.log('PASS: All shell.html and dialog.html assets exist.');
console.log('\nALL DUAL-WEBVIEW SHELL & DIALOG E2E TESTS PASSED!');
process.exit(0);
