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

  // Test 1: Titlebar Update Pill Activation & Direct Open
  console.log('\n[1/4] Testing Titlebar Update Pill Activation & Direct Open...');
  {
    window.__desktop_ui.showUpdateBanner('0.5.0', 'https://github.com/developer88/desktop-mail-and-calendar/releases/tag/v0.5.0');

    // Titlebar Update Pill
    const pill = document.getElementById('desktop-caption-update-pill');
    assert(pill, 'Titlebar update pill must exist in controls');
    assert.strictEqual(pill.style.display, 'inline-flex', 'Pill must be visible when update is ready');
    assert.strictEqual(pill.title, 'Update available (v0.5.0)', 'Pill title must include version');

    // Ensure no intrusive big banner exists
    const banner = document.getElementById('desktop-update-banner');
    assert.strictEqual(banner, null, 'Big banner row must NOT exist in the DOM');

    // Test clicking the titlebar pill directly opens the release URL
    pill.click();
    assert.strictEqual(openedUrls.length, 1);
    assert.strictEqual(openedUrls[0].url, 'https://github.com/developer88/desktop-mail-and-calendar/releases/tag/v0.5.0');
    assert.strictEqual(openedUrls[0].target, '_blank');

    console.log('PASS: Titlebar update pill created cleanly without Trusted Types violations and opens release page.');
  }

  // Test 2: Pill Theme & Structure
  console.log('\n[2/4] Testing Titlebar Update Pill Branding Structure...');
  {
    const pill = document.getElementById('desktop-caption-update-pill');
    assert(pill.classList.contains('calendar-theme'), 'Pill must have calendar-theme class');
    assert(pill.textContent.includes('Update'), 'Pill must display Update text');
    assert(pill.querySelector('svg'), 'Pill must have arrow SVG icon');

    console.log('PASS: Titlebar update pill has correct structure, icon, and theme.');
  }

  // Test 3: Desktop Mail Update Pill Handling
  console.log('\n[3/4] Testing Subsequent Version Updates Seamlessly...');
  {
    // Re-trigger update with subsequent version
    window.__desktop_ui.showUpdateBanner('0.6.0', 'https://github.com/developer88/desktop-mail-and-calendar/releases/tag/v0.6.0');
    const pill = document.getElementById('desktop-caption-update-pill');
    assert.strictEqual(pill.title, 'Update available (v0.6.0)');

    pill.click();
    assert.strictEqual(openedUrls.length, 2);
    assert.strictEqual(openedUrls[1].url, 'https://github.com/developer88/desktop-mail-and-calendar/releases/tag/v0.6.0');

    console.log('PASS: Update pill handles subsequent version updates seamlessly.');
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

    const pill = document.getElementById('desktop-caption-update-pill');
    assert.strictEqual(pill.style.display, 'inline-flex');
    assert.strictEqual(pill.title, 'Update available (v0.7.0)');

    const autoBanner = document.getElementById('desktop-update-banner');
    assert.strictEqual(autoBanner, null, 'Background check must NOT spawn an intrusive big banner');

    console.log('PASS: Background release checker correctly queries GitHub and triggers sleek titlebar pill.');
  }

  console.log('\nALL 4 UPDATE NOTIFICATION TESTS PASSED SUCCESSFULLY!');
  delete window.Element.prototype.innerHTML;
  process.exit(0);
}

main().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
