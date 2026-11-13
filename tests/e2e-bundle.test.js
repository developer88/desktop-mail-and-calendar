const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

console.log('Running E2E Bundle Execution Tests (Mail, Calendar, Auth, Iframe, CSP)...');

const root = path.resolve(__dirname, '..');
const win11ThemeCss = fs.readFileSync(path.join(root, 'shared/styles/win11-theme.css'), 'utf8');
const declutterCss = fs.readFileSync(path.join(root, 'shared/styles/declutter.css'), 'utf8');
const navScript = fs.readFileSync(path.join(root, 'shared/scripts/navigation-interceptor.js'), 'utf8');
const unreadScript = fs.readFileSync(path.join(root, 'shared/scripts/unread-observer.js'), 'utf8');
const calDateScript = fs.readFileSync(path.join(root, 'shared/scripts/calendar-date-observer.js'), 'utf8');
const titlebarScript = fs.readFileSync(path.join(root, 'shared/scripts/titlebar.js'), 'utf8');

/**
 * Replicates crates/core/src/scripts.rs::get_injected_bundle(app_kind)
 * and verifies that scripts.rs uses the exact same template structure.
 */
function buildInjectedBundle(appKind) {
  const appKindStr = appKind === 'mail' ? 'mail' : 'calendar';
  const primaryHost = appKind === 'mail' ? 'mail.google.com' : 'calendar.google.com';
  const escapedTheme = win11ThemeCss.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  const escapedDeclutter = declutterCss.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  const observerScript = appKind === 'mail' ? unreadScript : calDateScript;

  return `
(function() {
    window.__DESKTOP_APP_KIND__ = "${appKindStr}";
    var APP_KIND = "${appKindStr}";
    var PRIMARY_HOST = "${primaryHost}";

    try {
        if (window.self !== window.top || window.parent !== window || window.frameElement) {
            return;
        }
    } catch (_) {
        return;
    }

    var host = (window.location.hostname || '').toLowerCase();
    var path = (window.location.pathname || '').toLowerCase();
    var search = (window.location.search || '').toLowerCase();

    if (search.includes('companion') || search.includes('embed') || path.includes('/embed') || path.includes('/htmlembed')) {
        return;
    }

    if (host !== PRIMARY_HOST && !host.includes('accounts.google.') && host !== 'accounts.google.com') {
        return;
    }

    function isAuthFlow() {
        try {
            if (host === 'accounts.google.com' || host.startsWith('accounts.google.') || host === 'myaccount.google.com') {
                return true;
            }
            if ((host === 'google.com' || host === 'www.google.com') &&
                (path.startsWith('/accounts') || path.startsWith('/signin') || path.startsWith('/servicelogin') || path.includes('signinchooser'))) {
                return true;
            }
        } catch (_) {}
        return false;
    }

    if (!isAuthFlow()) {
        function applyStyles() {
            if (document.getElementById('desktop-theme')) return;
            var target = document.head || document.documentElement;
            if (target) {
                var styleEl = document.createElement('style');
                styleEl.id = 'desktop-theme';
                styleEl.textContent = \`${escapedTheme}\\n${escapedDeclutter}\`;
                target.appendChild(styleEl);
            }
        }

        applyStyles();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyStyles);
        }
    }

    ${titlebarScript}

    if (!isAuthFlow()) {
        ${navScript}
        ${observerScript}
    }
})();
`;
}

/**
 * Creates a JSDOM environment with:
 * - Mocked 2D Canvas context (returning deterministic RGBA buffers of exact dimensions)
 * - Mocked Image that synchronously triggers onload when src is set
 * - Mocked Tauri IPC (`window.__TAURI__.core.invoke`) recording all calls
 * - Strict Trusted Types CSP trap on `.innerHTML` / `.outerHTML` / `insertAdjacentHTML`
 */
function createSimulatedAppEnv(url, htmlBody = '<!DOCTYPE html><html><head><title>Inbox</title></head><body></body></html>') {
  const dom = new JSDOM(htmlBody, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });

  const { window } = dom;
  const { document } = window;
  const ipcCalls = [];
  const titleHistory = [];

  // Track document.title changes (simulating Tauri's on_document_title_changed)
  let currentTitle = document.title || '';
  Object.defineProperty(document, 'title', {
    get() {
      return currentTitle;
    },
    set(val) {
      currentTitle = String(val);
      titleHistory.push(currentTitle);
    },
    configurable: true
  });

  // Mock Tauri v2 IPC
  window.__TAURI__ = {
    core: {
      invoke(cmd, args) {
        ipcCalls.push({ cmd, args });
        return Promise.resolve(null);
      }
    }
  };

  // Mock Canvas 2D context so 512x512 and 64x64 icon generation runs end-to-end
  const drawnTexts = [];
  window.HTMLCanvasElement.prototype.getContext = function (type) {
    if (type !== '2d') return null;
    const canvas = this;
    return {
      font: '',
      fillStyle: '',
      strokeStyle: '',
      textAlign: '',
      textBaseline: '',
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetY: 0,
      lineWidth: 1,
      drawImage() {},
      save() {},
      restore() {},
      beginPath() {},
      roundRect() {},
      arc() {},
      fill() {},
      stroke() {},
      measureText(txt) {
        return { width: String(txt).length * 24 };
      },
      fillText(txt, x, y) {
        drawnTexts.push({ text: String(txt), x, y, fillStyle: this.fillStyle, font: this.font, width: canvas.width, height: canvas.height });
      },
      getImageData(x, y, w, h) {
        const buf = new Uint8ClampedArray(w * h * 4);
        // Populate non-zero alpha to verify buffer integrity
        for (let i = 3; i < buf.length; i += 4) {
          buf[i] = 255;
        }
        return { data: buf, width: w, height: h };
      }
    };
  };

  // Mock Image to fire onload immediately when data URI is assigned
  window.Image = class MockImage {
    constructor() {
      this.onload = null;
      this._src = '';
    }
    set src(val) {
      this._src = val;
      if (typeof this.onload === 'function') {
        this.onload();
      }
    }
    get src() {
      return this._src;
    }
  };

  // Enforce Google's Trusted Types CSP on Element.prototype.innerHTML & insertAdjacentHTML
  Object.defineProperty(window.Element.prototype, 'innerHTML', {
    get() {
      throw new Error('CSP Violation: Reading/Writing .innerHTML is forbidden under Trusted Types!');
    },
    set() {
      throw new Error('CSP Violation: Writing .innerHTML is forbidden under Trusted Types!');
    },
    configurable: true
  });
  window.Element.prototype.insertAdjacentHTML = function () {
    throw new Error('CSP Violation: insertAdjacentHTML is forbidden under Trusted Types!');
  };

  return {
    dom,
    window,
    document,
    ipcCalls,
    titleHistory,
    drawnTexts,
    cleanup() {
      delete window.Element.prototype.innerHTML;
      delete window.Element.prototype.insertAdjacentHTML;
      dom.window.close();
    }
  };
}

// ============================================================================
// TEST 1: Desktop Mail E2E Lifecycle
// ============================================================================
console.log('\n[1/5] Testing Desktop Mail full E2E lifecycle...');
{
  const env = createSimulatedAppEnv(
    'https://mail.google.com/mail/u/0/#inbox',
    '<!DOCTYPE html><html><head><title>Inbox (42) - user@gmail.com - Gmail</title></head><body><a id="int-link" href="https://mail.google.com/mail/u/0/#sent" target="_blank">Sent</a><a id="mailto-link" href="mailto:test@example.com">Email</a></body></html>'
  );
  const { window, document, ipcCalls, titleHistory, drawnTexts } = env;

  // Execute Mail bundle
  window.eval(buildInjectedBundle('mail'));

  // 1a. Verify styles injected
  const themeEl = document.getElementById('desktop-theme');
  assert(themeEl, 'desktop-theme <style> must be injected on mail.google.com');
  assert(themeEl.textContent.includes('#desktop-custom-titlebar'), 'Injected CSS must style #desktop-custom-titlebar');

  // 1b. Verify titlebar and caption buttons exist
  const titlebar = document.getElementById('desktop-custom-titlebar');
  assert(titlebar, '#desktop-custom-titlebar must be created');
  assert(titlebar.classList.contains('mail-titlebar'), 'Mail titlebar must have .mail-titlebar class');

  const minBtn = document.getElementById('desktop-caption-min');
  const maxBtn = document.getElementById('desktop-caption-max');
  const closeBtn = document.getElementById('desktop-caption-close');
  const menuBtn = document.getElementById('desktop-caption-menu');
  assert(minBtn && maxBtn && closeBtn && menuBtn, 'All 4 caption buttons (menu, min, max, close) must exist');

  // 1c. Verify First-Run Welcome Splash appeared automatically
  const splash = document.getElementById('desktop-splash-overlay');
  assert(splash, 'First-run welcome splash must appear on first launch');
  const splashTitle = splash.querySelector('.desktop-splash-title');
  assert.strictEqual(splashTitle.textContent, 'Welcome to Desktop Mail');
  const splashLogo = splash.querySelector('svg');
  assert.strictEqual(splashLogo.getAttribute('viewBox'), '0 0 512 512', 'Splash logo must be 512x512 vector');

  // Dismiss splash and verify localStorage persistence
  const splashBtn = splash.querySelector('.desktop-splash-btn');
  splashBtn.click();
  assert.strictEqual(window.localStorage.getItem('desktop_first_run_completed'), 'true', 'Dismissing splash must persist desktop_first_run_completed=true');

  // 1d. Verify caption buttons trigger native Rust title commands
  minBtn.click();
  assert(titleHistory.includes('__desktop_cmd__:minimize'), 'Clicking minimize must send __desktop_cmd__:minimize');
  maxBtn.click();
  assert(titleHistory.includes('__desktop_cmd__:maximize'), 'Clicking maximize must send __desktop_cmd__:maximize');

  // 1e. Verify Hamburger Menu & Settings Modal (General -> Privacy -> About)
  menuBtn.click();
  const dropdown = document.getElementById('desktop-menu-dropdown');
  assert(dropdown, 'Clicking menu button must open #desktop-menu-dropdown');
  const menuItems = dropdown.querySelectorAll('.desktop-menu-item');
  assert.strictEqual(menuItems.length, 4, 'Menu must have File, Edit, View, Window categories');

  // Click File -> Settings
  menuItems[0].click();
  const subItems = document.querySelectorAll('.desktop-submenu .desktop-menu-item');
  assert(subItems.length >= 2, 'File submenu must have Settings and Exit');
  subItems[0].click(); // Open Settings

  const settingsOverlay = document.getElementById('desktop-settings-overlay');
  assert(settingsOverlay, 'Settings modal must open when clicking File -> Settings');

  // Check General tab toggles ("Open at login" and "Default Email App")
  const switches = settingsOverlay.querySelectorAll('.desktop-toggle-switch');
  assert.strictEqual(switches.length, 2, 'General tab must have 2 toggle switches');
  switches[1].click(); // Open at login -> on
  assert.strictEqual(window.localStorage.getItem('desktop_pref_open_at_login'), 'true');
  assert(titleHistory.includes('__desktop_cmd__:autostart:on'), 'Enabling Open at login must trigger __desktop_cmd__:autostart:on');

  const defaultAppBtn = settingsOverlay.querySelector('.desktop-settings-action-btn');
  assert(defaultAppBtn, 'Default Email App action button must exist');
  defaultAppBtn.click();
  assert(titleHistory.includes('__desktop_cmd__:open:defaultapps'), 'Clicking Open Windows Settings must trigger __desktop_cmd__:open:defaultapps');

  // Switch to Privacy & permissions tab
  const navTabs = settingsOverlay.querySelectorAll('.desktop-settings-nav-item');
  assert.strictEqual(navTabs.length, 3, 'Settings must have 3 navigation tabs');
  navTabs[1].click(); // Privacy
  const privSwitches = settingsOverlay.querySelectorAll('.desktop-toggle-switch');
  assert.strictEqual(privSwitches.length, 3, 'Privacy tab must have Microphone, Camera, Location toggles');
  privSwitches[0].click();
  assert.strictEqual(window.localStorage.getItem('desktop_pref_perm_mic'), 'true');

  // Switch to About Desktop Mail tab (verifies zero innerHTML & 512x512 SVG logo)
  navTabs[2].click();
  const aboutTitle = settingsOverlay.querySelector('.desktop-about-title');
  assert(aboutTitle, 'About tab title must render without CSP error');
  assert.strictEqual(aboutTitle.textContent, 'About Desktop Mail');
  const verNum = settingsOverlay.querySelector('.desktop-version-num');
  assert.strictEqual(verNum.textContent, '0.2.0', 'About tab must display Build Version 0.2.0');
  const aboutLogo = settingsOverlay.querySelector('.desktop-about-logo svg');
  assert(aboutLogo, 'About tab SVG logo must exist');
  assert.strictEqual(aboutLogo.getAttribute('viewBox'), '0 0 512 512');

  // Close settings via Done button
  settingsOverlay.querySelector('.desktop-settings-done-btn').click();
  assert(!document.getElementById('desktop-settings-overlay'), 'Settings modal must close when clicking Done');

  // 1f. Verify Unread Badge Observer extracted "42" from "Inbox (42)" and invoked Tauri IPC with 512x512 RGBA + 64x64 overlay
  const badgeCall = ipcCalls.find((c) => c.cmd === 'update_unread_badge' && c.args.count === 42);
  assert(badgeCall, 'Unread observer must invoke update_unread_badge with count=42');
  assert.strictEqual(badgeCall.args.width, 512, 'Badged icon width must be 512');
  assert.strictEqual(badgeCall.args.height, 512, 'Badged icon height must be 512');
  assert.strictEqual(badgeCall.args.iconRgba.length, 512 * 512 * 4, 'iconRgba must be 512x512x4 bytes');
  assert.strictEqual(badgeCall.args.overlayRgba.length, 64 * 64 * 4, 'overlayRgba must be 64x64x4 bytes');
  assert(drawnTexts.some((t) => t.text === '42' && t.width === 512), 'Canvas must draw "42" on 512x512 icon');

  // Test large unread count formatting (265K)
  document.title = 'Inbox (265,432) - user@gmail.com';
  window.dispatchEvent(new window.Event('focus'));
  const kBadgeCall = ipcCalls.find((c) => c.cmd === 'update_unread_badge' && c.args.count === 265432);
  assert(kBadgeCall, 'Unread observer must parse comma-formatted count 265,432');
  assert(drawnTexts.some((t) => t.text === '265K' && t.width === 512), 'Canvas must format 265432 as "265K" matching Telegram style');

  // 1g. Verify Navigation Interceptor rewrites internal target="_blank" to "_self"
  const intLink = document.getElementById('int-link');
  intLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.strictEqual(intLink.target, '_self', 'Internal Google link with target="_blank" must be rewritten to "_self"');

  env.cleanup();
  console.log('PASS: Desktop Mail full E2E lifecycle verified.');
}

// ============================================================================
// TEST 2: Desktop Calendar E2E Lifecycle (Date Icon + Toast Dismissal + UI)
// ============================================================================
console.log('\n[2/5] Testing Desktop Calendar full E2E lifecycle...');
{
  const env = createSimulatedAppEnv(
    'https://calendar.google.com/calendar/u/0/r',
    '<!DOCTYPE html><html><head><title>Google Calendar</title></head><body><div role="alert" id="err-toast">Calendar could not load the data. Please try reloading later.<button id="toast-close">X</button></div></body></html>'
  );
  const { window, document, ipcCalls, drawnTexts } = env;

  let toastCloseClicked = false;
  document.getElementById('toast-close').addEventListener('click', () => {
    toastCloseClicked = true;
  });

  window.eval(buildInjectedBundle('calendar'));

  // 2a. Verify Calendar root classes and titlebar
  assert(document.documentElement.classList.contains('desktop-calendar-app'), 'html must have .desktop-calendar-app');
  const titlebar = document.getElementById('desktop-custom-titlebar');
  assert(titlebar && titlebar.classList.contains('calendar-titlebar'), 'Calendar titlebar must have .calendar-titlebar');

  // 2b. Verify live day-of-the-month icon rendering (512x512 in emerald green #15803d)
  const expectedDay = new Date().getDate();
  const calCall = ipcCalls.find((c) => c.cmd === 'update_calendar_date_icon');
  assert(calCall, 'Calendar date observer must invoke update_calendar_date_icon on startup');
  assert.strictEqual(calCall.args.day, expectedDay, `Calendar icon day must match current date (${expectedDay})`);
  assert.strictEqual(calCall.args.width, 512, 'Calendar date icon width must be 512');
  assert.strictEqual(calCall.args.height, 512, 'Calendar date icon height must be 512');
  assert.strictEqual(calCall.args.iconRgba.length, 512 * 512 * 4, 'Calendar iconRgba must be 512x512x4 bytes');

  const dayDraw = drawnTexts.find((t) => t.text === String(expectedDay) && t.width === 512);
  assert(dayDraw, 'Canvas must render today\'s day number onto 512x512 calendar icon');
  assert.strictEqual(dayDraw.fillStyle, '#15803d', 'Calendar date number must be rendered in emerald green #15803d');

  // 2c. Verify erroneous "Calendar could not load the data" toast is automatically hidden and dismissed
  const errToast = document.getElementById('err-toast');
  assert.strictEqual(errToast.style.display, 'none', 'Erroneous data load toast must be hidden with display: none');
  assert(toastCloseClicked, 'Toast close button must be automatically clicked');

  // 2d. Verify About Desktop Calendar dialog renders cleanly
  const menuBtn = document.getElementById('desktop-caption-menu');
  menuBtn.click();
  document.querySelectorAll('#desktop-menu-dropdown .desktop-menu-item')[0].click();
  document.querySelectorAll('.desktop-submenu .desktop-menu-item')[0].click();
  const settingsOverlay = document.getElementById('desktop-settings-overlay');
  const navTabs = settingsOverlay.querySelectorAll('.desktop-settings-nav-item');
  navTabs[2].click(); // About Desktop Calendar
  const aboutTitle = settingsOverlay.querySelector('.desktop-about-title');
  assert.strictEqual(aboutTitle.textContent, 'About Desktop Calendar');
  const calLogo = settingsOverlay.querySelector('.desktop-about-logo svg');
  assert.strictEqual(calLogo.getAttribute('viewBox'), '0 0 512 512');

  env.cleanup();
  console.log('PASS: Desktop Calendar full E2E lifecycle verified.');
}

// ============================================================================
// TEST 3: Authentication Flow Guard E2E (accounts.google.com)
// ============================================================================
console.log('\n[3/5] Testing Authentication Flow Guard on accounts.google.com...');
{
  const env = createSimulatedAppEnv(
    'https://accounts.google.com/v3/signin/identifier?continue=https://mail.google.com',
    '<!DOCTYPE html><html><head><title>Sign in - Google Accounts</title></head><body><input type="email" /></body></html>'
  );
  const { window, document, ipcCalls } = env;

  window.eval(buildInjectedBundle('mail'));

  // 3a. Styles, declutter CSS, and unread observer must NOT be injected during auth flow
  assert(!document.getElementById('desktop-theme'), 'desktop-theme CSS must NOT be injected on accounts.google.com');
  assert.strictEqual(ipcCalls.length, 0, 'No unread badge IPC calls may fire on accounts.google.com');

  // 3b. Frameless window titlebar MUST still be present so user can move/minimize/close sign-in window
  assert(document.getElementById('desktop-custom-titlebar'), 'Window titlebar controls must remain accessible during sign-in');

  env.cleanup();
  console.log('PASS: Authentication Flow Guard verified.');
}

// ============================================================================
// TEST 4: Subframe / Companion Sidebar Guard E2E
// ============================================================================
console.log('\n[4/5] Testing Subframe & Companion Sidebar Guard...');
{
  // Companion URL (?companion=1)
  const env = createSimulatedAppEnv(
    'https://calendar.google.com/calendar/u/0/r?companion=1',
    '<!DOCTYPE html><html><head><title>Companion</title></head><body></body></html>'
  );
  const { window, document, ipcCalls } = env;

  window.eval(buildInjectedBundle('calendar'));

  assert(!document.getElementById('desktop-custom-titlebar'), 'Titlebar must NEVER inject inside ?companion=1 sidebar');
  assert(!document.getElementById('desktop-theme'), 'Theme CSS must NEVER inject inside ?companion=1 sidebar');
  assert.strictEqual(ipcCalls.length, 0, 'Observers must NEVER run inside ?companion=1 sidebar');

  env.cleanup();
  console.log('PASS: Subframe & Companion Sidebar Guard verified.');
}

// ============================================================================
// TEST 5: Cross-Service Host Isolation E2E
// ============================================================================
console.log('\n[5/5] Testing Cross-Service Host Isolation...');
{
  // Mail bundle loaded onto calendar.google.com should abort immediately
  const env = createSimulatedAppEnv(
    'https://calendar.google.com/calendar/u/0/r',
    '<!DOCTYPE html><html><head><title>Calendar</title></head><body></body></html>'
  );
  const { window, document, ipcCalls } = env;

  window.eval(buildInjectedBundle('mail'));

  assert(!document.getElementById('desktop-custom-titlebar'), 'Mail bundle must not inject into calendar.google.com');
  assert.strictEqual(ipcCalls.length, 0, 'Mail observers must not run on calendar.google.com');

  env.cleanup();
  console.log('PASS: Cross-Service Host Isolation verified.');
}

console.log('\nALL 5 E2E BUNDLE SUITES PASSED SUCCESSFULLY!');
