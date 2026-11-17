const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

console.log('Running UI Screenshot & Offline Visual Test Suite...');

const root = path.resolve(__dirname, '..');
const appVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const outputDir = path.join(root, 'tests', 'screenshots');
const harnessDir = path.join(root, 'tests', '.screenshot-harness');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
if (!fs.existsSync(harnessDir)) {
  fs.mkdirSync(harnessDir, { recursive: true });
}

// 1. Locate Headless Edge or Chrome browser executable
const browserCandidates = [
  '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
  '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'google-chrome',
  'chromium-browser',
  'chromium'
];

let browserPath = null;
for (const cand of browserCandidates) {
  try {
    if (cand.startsWith('/mnt/c/')) {
      if (fs.existsSync(cand)) {
        browserPath = cand;
        break;
      }
    } else {
      execSync(`which ${cand}`, { stdio: 'ignore' });
      browserPath = cand;
      break;
    }
  } catch (_) {}
}

if (!browserPath) {
  console.log('WARNING: Headless browser not found. Skipping screenshot visual capture.');
  process.exit(0);
}

console.log(`Using headless browser engine: ${browserPath}`);

function toWindowsPath(p) {
  if (p.startsWith('/mnt/c/')) {
    return 'C:\\' + p.slice(7).replace(/\//g, '\\');
  }
  return p.replace(/\//g, '\\');
}

function toFileUrl(p) {
  const win = toWindowsPath(p);
  return 'file:///' + win.replace(/\\/g, '/');
}

// 2. Define test scenarios
const scenarios = [
  {
    name: '01-mail-offline-splash',
    title: 'Desktop Mail Offline / Splash Screen',
    sourceHtml: path.join(root, 'apps', 'desktop-mail', 'ui', 'index.html'),
    queryString: '?offline=true'
  },
  {
    name: '02-calendar-offline-splash',
    title: 'Desktop Calendar Offline / Splash Screen',
    sourceHtml: path.join(root, 'apps', 'desktop-calendar', 'ui', 'index.html'),
    queryString: '?offline=true'
  },
  {
    name: '03-mail-titlebar-shell',
    title: 'Desktop Mail Frameless Titlebar & Window Shell',
    generateHarness: () => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Desktop Mail</title>
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'win11-theme.css'))}">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'shell.css'))}">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'declutter.css'))}">
        <style>
          body { margin: 0; padding: 0; background: #f6f8fc; font-family: 'Segoe UI Variable', system-ui, sans-serif; height: 100vh; overflow: hidden; }
          .mock-body { margin-top: 36px; padding: 24px; display: flex; gap: 20px; }
          .mock-nav { width: 220px; background: #f0f4f9; border-radius: 12px; height: 500px; padding: 16px; box-sizing: border-box; }
          .mock-list { flex: 1; background: #ffffff; border-radius: 12px; height: 500px; padding: 16px; box-sizing: border-box; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        </style>
      </head>
      <body>
        <div class="mock-body">
          <div class="mock-nav"><div style="font-weight: 600; color: #444746;">Desktop Mail Folders</div></div>
          <div class="mock-list"><div style="font-weight: 600; color: #1f1f1f;">Offline Mail Client Preview</div></div>
        </div>
        <script>
          window.APP_KIND = 'mail';
          window.APP_VERSION = '${appVersion}';
          window.__DESKTOP_FIRST_RUN__ = false;
        </script>
        <script src="${toFileUrl(path.join(root, 'shared', 'scripts', 'titlebar.js'))}"></script>
      </body>
      </html>
    `
  },
  {
    name: '04-calendar-titlebar-shell',
    title: 'Desktop Calendar Frameless Titlebar & Window Shell',
    generateHarness: () => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Desktop Calendar</title>
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'win11-theme.css'))}">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'shell.css'))}">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'declutter.css'))}">
        <style>
          body { margin: 0; padding: 0; background: #ffffff; font-family: 'Segoe UI Variable', system-ui, sans-serif; height: 100vh; overflow: hidden; }
          .mock-body { margin-top: 36px; padding: 24px; display: flex; gap: 20px; }
          .mock-cal-sidebar { width: 240px; background: #f8fafc; border-radius: 12px; height: 500px; padding: 16px; box-sizing: border-box; }
          .mock-cal-grid { flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; height: 500px; padding: 16px; box-sizing: border-box; }
        </style>
      </head>
      <body>
        <div class="mock-body">
          <div class="mock-cal-sidebar"><div style="font-weight: 600; color: #15803d;">Desktop Calendar Mini-Month</div></div>
          <div class="mock-cal-grid"><div style="font-weight: 600; color: #1e293b;">Schedule View Preview</div></div>
        </div>
        <script>
          window.APP_KIND = 'calendar';
          window.APP_VERSION = '${appVersion}';
          window.__DESKTOP_FIRST_RUN__ = false;
        </script>
        <script src="${toFileUrl(path.join(root, 'shared', 'scripts', 'titlebar.js'))}"></script>
      </body>
      </html>
    `
  },
  {
    name: '05-mail-welcome-overlay',
    title: 'Desktop Mail First-Run Welcome & Privacy Overlay',
    generateHarness: () => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'win11-theme.css'))}">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'shell.css'))}">
        <style>body { margin: 0; background: #f6f8fc; font-family: 'Segoe UI Variable', system-ui, sans-serif; height: 100vh; }</style>
      </head>
      <body>
        <script>
          window.APP_KIND = 'mail';
          window.APP_VERSION = '${appVersion}';
        </script>
        <script src="${toFileUrl(path.join(root, 'shared', 'scripts', 'titlebar.js'))}"></script>
        <script>
          window.__desktop_ui.showWelcome(false);
        </script>
      </body>
      </html>
    `
  },
  {
    name: '06-calendar-welcome-overlay',
    title: 'Desktop Calendar First-Run Welcome & Privacy Overlay',
    generateHarness: () => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'win11-theme.css'))}">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'shell.css'))}">
        <style>body { margin: 0; background: #ffffff; font-family: 'Segoe UI Variable', system-ui, sans-serif; height: 100vh; }</style>
      </head>
      <body>
        <script>
          window.APP_KIND = 'calendar';
          window.APP_VERSION = '${appVersion}';
        </script>
        <script src="${toFileUrl(path.join(root, 'shared', 'scripts', 'titlebar.js'))}"></script>
        <script>
          window.__desktop_ui.showWelcome(false);
        </script>
      </body>
      </html>
    `
  },
  {
    name: '07-mail-settings-general',
    title: 'Desktop Mail Settings Dialog (General Tab)',
    generateHarness: () => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'win11-theme.css'))}">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'shell.css'))}">
        <style>body { margin: 0; background: #f6f8fc; font-family: 'Segoe UI Variable', system-ui, sans-serif; height: 100vh; }</style>
      </head>
      <body>
        <script>
          window.APP_KIND = 'mail';
          window.APP_VERSION = '${appVersion}';
          window.__DESKTOP_FIRST_RUN__ = false;
        </script>
        <script src="${toFileUrl(path.join(root, 'shared', 'scripts', 'titlebar.js'))}"></script>
        <script>
          window.__desktop_ui.openSettings('general');
        </script>
      </body>
      </html>
    `
  },
  {
    name: '08-calendar-settings-general',
    title: 'Desktop Calendar Settings Dialog (General Tab)',
    generateHarness: () => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'win11-theme.css'))}">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'shell.css'))}">
        <style>body { margin: 0; background: #ffffff; font-family: 'Segoe UI Variable', system-ui, sans-serif; height: 100vh; }</style>
      </head>
      <body>
        <script>
          window.APP_KIND = 'calendar';
          window.APP_VERSION = '${appVersion}';
          window.__DESKTOP_FIRST_RUN__ = false;
        </script>
        <script src="${toFileUrl(path.join(root, 'shared', 'scripts', 'titlebar.js'))}"></script>
        <script>
          window.__desktop_ui.openSettings('general');
        </script>
      </body>
      </html>
    `
  },
  {
    name: '09-mail-settings-about',
    title: 'Desktop Mail About Dialog (Tactile Orange Branding)',
    generateHarness: () => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'win11-theme.css'))}">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'shell.css'))}">
        <style>body { margin: 0; background: #f6f8fc; font-family: 'Segoe UI Variable', system-ui, sans-serif; height: 100vh; }</style>
      </head>
      <body>
        <script>
          window.APP_KIND = 'mail';
          window.APP_VERSION = '${appVersion}';
          window.__DESKTOP_FIRST_RUN__ = false;
        </script>
        <script src="${toFileUrl(path.join(root, 'shared', 'scripts', 'titlebar.js'))}"></script>
        <script>
          window.__desktop_ui.openSettings('about');
        </script>
      </body>
      </html>
    `
  },
  {
    name: '10-calendar-settings-about',
    title: 'Desktop Calendar About Dialog (Emerald Green "31" Branding)',
    generateHarness: () => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'win11-theme.css'))}">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'shell.css'))}">
        <style>body { margin: 0; background: #ffffff; font-family: 'Segoe UI Variable', system-ui, sans-serif; height: 100vh; }</style>
      </head>
      <body>
        <script>
          window.APP_KIND = 'calendar';
          window.APP_VERSION = '${appVersion}';
          window.__DESKTOP_FIRST_RUN__ = false;
        </script>
        <script src="${toFileUrl(path.join(root, 'shared', 'scripts', 'titlebar.js'))}"></script>
        <script>
          window.__desktop_ui.openSettings('about');
        </script>
      </body>
      </html>
    `
  },
  {
    name: '11-calendar-update-banner',
    title: 'Desktop Calendar Non-Intrusive Titlebar Update Pill',
    generateHarness: () => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Desktop Calendar</title>
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'win11-theme.css'))}">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'shell.css'))}">
        <style>
          body { margin: 0; padding: 0; background: #ffffff; font-family: 'Segoe UI Variable', system-ui, sans-serif; height: 100vh; overflow: hidden; }
          .mock-body { margin-top: 36px; padding: 24px; display: flex; gap: 20px; }
          .mock-cal-sidebar { width: 240px; background: #f8fafc; border-radius: 12px; height: 500px; padding: 16px; box-sizing: border-box; }
          .mock-cal-grid { flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; height: 500px; padding: 16px; box-sizing: border-box; }
        </style>
      </head>
      <body>
        <div class="mock-body">
          <div class="mock-cal-sidebar"><div style="font-weight: 600; color: #15803d;">Desktop Calendar Sidebar</div></div>
          <div class="mock-cal-grid"><div style="font-weight: 600; color: #1e293b;">Calendar Schedule Grid</div></div>
        </div>
        <script>
          window.APP_KIND = 'calendar';
          window.APP_VERSION = '${appVersion}';
          window.__DESKTOP_FIRST_RUN__ = false;
        </script>
        <script src="${toFileUrl(path.join(root, 'shared', 'scripts', 'titlebar.js'))}"></script>
        <script>
          window.__desktop_ui.showUpdateBanner('0.6.0', 'https://github.com/developer88/desktop-mail-and-calendar/releases/tag/v0.6.0');
        </script>
      </body>
      </html>
    `
  },
  {
    name: '12-mail-update-banner',
    title: 'Desktop Mail Non-Intrusive Titlebar Update Pill',
    generateHarness: () => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Desktop Mail</title>
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'win11-theme.css'))}">
        <link rel="stylesheet" href="${toFileUrl(path.join(root, 'shared', 'styles', 'shell.css'))}">
        <style>
          body { margin: 0; padding: 0; background: #f6f8fc; font-family: 'Segoe UI Variable', system-ui, sans-serif; height: 100vh; overflow: hidden; }
          .mock-body { margin-top: 36px; padding: 24px; display: flex; gap: 20px; }
          .mock-nav { width: 220px; background: #ffffff; border-radius: 12px; height: 500px; padding: 16px; box-sizing: border-box; }
          .mock-list { flex: 1; background: #ffffff; border-radius: 12px; height: 500px; padding: 16px; box-sizing: border-box; }
        </style>
      </head>
      <body>
        <div class="mock-body">
          <div class="mock-nav"><div style="font-weight: 600; color: #444746;">Desktop Mail Folders</div></div>
          <div class="mock-list"><div style="font-weight: 600; color: #1f1f1f;">Inbox - Email List View</div></div>
        </div>
        <script>
          window.APP_KIND = 'mail';
          window.APP_VERSION = '${appVersion}';
          window.__DESKTOP_FIRST_RUN__ = false;
        </script>
        <script src="${toFileUrl(path.join(root, 'shared', 'scripts', 'titlebar.js'))}"></script>
        <script>
          window.__desktop_ui.showUpdateBanner('0.6.0', 'https://github.com/developer88/desktop-mail-and-calendar/releases/tag/v0.6.0');
        </script>
      </body>
      </html>
    `
  }
];

// 3. Execute Screenshot Capture & Verification
console.log(`\nExecuting ${scenarios.length} screenshot tests...`);

let passedCount = 0;
for (let i = 0; i < scenarios.length; i++) {
  const sc = scenarios[i];
  console.log(`\n[${i + 1}/${scenarios.length}] Testing ${sc.title}...`);

  let targetUrl = '';
  if (sc.sourceHtml) {
    targetUrl = toFileUrl(sc.sourceHtml) + (sc.queryString || '');
  } else if (sc.generateHarness) {
    const harnessPath = path.join(harnessDir, `${sc.name}.html`);
    fs.writeFileSync(harnessPath, sc.generateHarness());
    targetUrl = toFileUrl(harnessPath);
  }

  const outPngPath = path.join(outputDir, `${sc.name}.png`);
  const winOutPng = toWindowsPath(outPngPath);

  // Capture headless screenshot with 1280x800 resolution matching app windows
  const cmd = `"${browserPath}" --headless=new "--screenshot=${winOutPng}" --window-size=1280,800 "${targetUrl}"`;
  execSync(cmd, { stdio: 'pipe' });

  assert(fs.existsSync(outPngPath), `Screenshot file ${outPngPath} was not created`);
  const buf = fs.readFileSync(outPngPath);

  // Assert valid PNG magic bytes
  assert.strictEqual(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'File must be a valid PNG');

  // Assert minimum file size (ensuring non-blank rendered UI)
  assert(buf.length > 5000, `Screenshot size (${buf.length} bytes) is suspiciously small`);

  // Assert PNG width and height chunk (IHDR)
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.strictEqual(width, 1280, `Expected width 1280, got ${width}`);
  assert.strictEqual(height, 800, `Expected height 800, got ${height}`);

  console.log(`  PASS: ${sc.name}.png (${buf.length} bytes, 1280x800)`);
  passedCount++;
}

// 4. Clean up temporary test harnesses
try {
  fs.rmSync(harnessDir, { recursive: true, force: true });
} catch (_) {}

console.log(`\nALL ${passedCount} UI SCREENSHOT TESTS PASSED SUCCESSFULLY!`);
console.log(`Artifacts saved in: ${outputDir}`);
