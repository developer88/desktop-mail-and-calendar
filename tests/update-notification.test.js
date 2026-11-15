const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

console.log('Running Update Notification & Background Release Checker Tests...');

const root = path.resolve(__dirname, '..');
const titlebarScript = fs.readFileSync(path.join(root, 'shared', 'scripts', 'titlebar.js'), 'utf8');
const shellCss = fs.readFileSync(path.join(root, 'shared', 'styles', 'shell.css'), 'utf8');

async function main() {
  const dom = new JSDOM('<!DOCTYPE html><html><head><title>Test App</title></head><body><div id="content">Hello</div></body></html>', {
    url: 'https://calendar.google.com/calendar/u/0/r',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });

  const { window } = dom;
  const { document } = window;

  window.APP_KIND = 'calendar';
  window.APP_VERSION = '0.4.0';
  window.PRIMARY_HOST = 'calendar.google.com';

  // Inject shell styles
  const styleEl = document.createElement('style');
  styleEl.textContent = shellCss;
  document.head.appendChild(styleEl);

  // Track window.open calls
  const openedUrls = [];
  window.open = function(targetUrl, target) {
    openedUrls.push({ url: targetUrl, target });
    return {};
  };

  // Mock fetch
  let mockReleaseTag = 'v0.5.0';
  let lastFetchedUrl = null;
  window.fetch = function(fetchUrl) {
    lastFetchedUrl = fetchUrl;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        tag_name: mockReleaseTag,
        html_url: 'https://github.com/developer88/desktop-mail-and-calendar/releases/tag/' + mockReleaseTag
      })
    });
  };

  // Trusted Types CSP guard: throw on innerHTML access
  Object.defineProperty(window.Element.prototype, 'innerHTML', {
    get() {
      throw new Error('CSP Violation: Reading/Writing .innerHTML is forbidden under Trusted Types!');
    },
    set() {
      throw new Error('CSP Violation: Writing .innerHTML is forbidden under Trusted Types!');
    },
    configurable: true
  });

  // Evaluate titlebar script
  window.eval(titlebarScript);
  assert(window.__desktop_ui, '__desktop_ui must be exported');

  // Test 1: Desktop Calendar Update Banner & Trusted Types DOM
  console.log('\n[1/4] Testing Desktop Calendar Update Banner DOM & Trusted Types...');
  {
    window.__desktop_ui.showUpdateBanner('0.5.0', 'https://github.com/developer88/desktop-mail-and-calendar/releases/tag/v0.5.0');

    const banner = document.getElementById('desktop-update-banner');
    assert(banner, 'Update banner must exist in the DOM');
    assert(banner.classList.contains('calendar-theme'), 'Banner must have calendar-theme class');
    assert.strictEqual(banner.querySelector('.desktop-update-badge').textContent, 'v0.5.0');
    assert(banner.textContent.includes('Desktop Calendar update is ready (v0.5.0)'), 'Banner must include Desktop Calendar text');

    // Titlebar Update Pill
    const pill = document.getElementById('desktop-caption-update-pill');
    assert(pill, 'Titlebar update pill must exist in controls');
    assert.strictEqual(pill.style.display, 'inline-flex', 'Pill must be visible when update is ready');

    // Test Action Button
    const actionBtn = banner.querySelector('.desktop-update-action-btn');
    assert(actionBtn, 'Action button must exist');
    actionBtn.click();
    assert.strictEqual(openedUrls.length, 1);
    assert.strictEqual(openedUrls[0].url, 'https://github.com/developer88/desktop-mail-and-calendar/releases/tag/v0.5.0');
    assert.strictEqual(openedUrls[0].target, '_blank');

    console.log('PASS: Calendar update banner and titlebar pill created cleanly without Trusted Types violations.');
  }

  // Test 2: Dismissal & Persistence
  console.log('\n[2/4] Testing Banner Dismissal & Non-Pushy Persistence...');
  {
    const banner = document.getElementById('desktop-update-banner');
    assert(banner, 'Banner must be present before dismissal');

    const dismissBtn = banner.querySelector('.desktop-update-dismiss-btn');
    assert(dismissBtn, 'Dismiss button must exist');
    dismissBtn.click();

    assert(banner.classList.contains('closing'), 'Banner must have closing class on dismiss');
    assert.strictEqual(window.sessionStorage.getItem('desktop_dismissed_update_0.5.0'), 'true');

    // Subtle Titlebar Pill stays visible
    const pill = document.getElementById('desktop-caption-update-pill');
    assert.strictEqual(pill.style.display, 'inline-flex', 'Pill must stay visible after dismissing top banner');

    console.log('PASS: Dismissal properly marks session and leaves subtle titlebar pill without intrusive popups.');
    banner.remove();
  }

  // Test 3: Desktop Mail Update Banner Styling
  console.log('\n[3/4] Testing Desktop Mail Update Banner DOM & Styling...');
  {
    // Re-trigger banner with Mail theme
    window.__desktop_ui.showUpdateBanner('0.6.0', 'https://github.com/developer88/desktop-mail-and-calendar/releases/tag/v0.6.0');
    const banner = document.getElementById('desktop-update-banner');
    assert(banner, 'Update banner must exist');
    assert.strictEqual(banner.querySelector('.desktop-update-badge').textContent, 'v0.6.0');

    console.log('PASS: Update banner handles subsequent version notifications seamlessly.');
    banner.remove();
  }

  // Test 4: Background Release Checker
  console.log('\n[4/4] Testing Background Check Endpoint & SemVer Evaluation...');
  {
    mockReleaseTag = 'v0.7.0';
    const result = await window.__desktop_ui.checkForUpdates(false);
    assert(result.updateAvailable, 'Must detect update available when latest (0.7.0) > current (0.4.0)');
    assert.strictEqual(result.version, '0.7.0');
    assert.strictEqual(result.tag, 'v0.7.0');
    assert(lastFetchedUrl.includes('releases/latest'), 'Fetch URL must target releases/latest endpoint');

    const autoBanner = document.getElementById('desktop-update-banner');
    assert(autoBanner, 'Background check must automatically spawn update banner when new release is detected');

    console.log('PASS: Background release checker correctly queries GitHub and triggers update banner.');
  }

  console.log('\nALL 4 UPDATE NOTIFICATION TESTS PASSED SUCCESSFULLY!');
  delete window.Element.prototype.innerHTML;
  process.exit(0);
}

main().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
