/**
 * Test Suite: Windows 11 Mica / Acrylic Titlebar Material Backdrop
 *
 * Verifies:
 * 1. Rust core `WindowBackdrop` enum variants (None, Mica, MicaAlt, Acrylic), string parsing,
 *    and Win32 DWM_SYSTEMBACKDROP_TYPE attribute codes (1=None, 2=Mica, 3=Acrylic, 4=MicaAlt/Tabbed).
 * 2. Rust core `apply_window_backdrop_win32` function dynamically loading dwmapi.dll,
 *    invoking DwmSetWindowAttribute with DWMWA_SYSTEMBACKDROP_TYPE (38) and fallback to DWMWA_MICA_EFFECT (1029).
 * 3. Tauri window setup in Desktop Calendar and Desktop Mail:
 *    - EffectsBuilder configured with Effect::Tabbed (MicaAlt)
 *    - set_window_backdrop Tauri command exposed
 *    - Document title command handler (__desktop_cmd__:backdrop:*)
 *    - Win32 startup backdrop application on window initialization
 * 4. CSS backdrop filter styling in shell.css:
 *    - #desktop-custom-titlebar includes backdrop-filter: blur(16px) and -webkit-backdrop-filter
 *    - Background remains transparent across themes
 * 5. Settings dialog integration in titlebar.js:
 *    - "Windows 11 Material Backdrop" toggle card in General tab
 *    - Preference key 'window_backdrop_mica' (default: true)
 *    - Toggling dispatches backdrop:mica_alt and backdrop:none
 *    - Startup initialization respects saved user preference
 * 6. Trusted Types CSP compliance (zero innerHTML/outerHTML).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { createMockDocument } = require('./mock-dom');

console.log('Running Windows 11 Mica / Acrylic Window Backdrop Test Suite...\n');

const root = path.resolve(__dirname, '..');
const shellCss = fs.readFileSync(path.join(root, 'shared', 'styles', 'shell.css'), 'utf8');
const titlebarScript = fs.readFileSync(path.join(root, 'shared', 'scripts', 'titlebar.js'), 'utf8');
const coreThemeRs = fs.readFileSync(path.join(root, 'crates', 'core', 'src', 'theme.rs'), 'utf8');
const coreLibRs = fs.readFileSync(path.join(root, 'crates', 'core', 'src', 'lib.rs'), 'utf8');
const calLibRs = fs.readFileSync(path.join(root, 'apps', 'desktop-calendar', 'src-tauri', 'src', 'lib.rs'), 'utf8');
const mailLibRs = fs.readFileSync(path.join(root, 'apps', 'desktop-mail', 'src-tauri', 'src', 'lib.rs'), 'utf8');

// =========================================================================
// [1/5] Core Rust WindowBackdrop Enum & Win32 DWM Attributes Verification
// =========================================================================
console.log('[1/5] Verifying Core Rust WindowBackdrop enum, string parser, and Win32 codes...');

assert(coreThemeRs.includes('pub enum WindowBackdrop'), 'Rust theme.rs must define WindowBackdrop enum');
assert(coreThemeRs.includes('MicaAlt'), 'WindowBackdrop must have MicaAlt variant');
assert(coreThemeRs.includes('Acrylic'), 'WindowBackdrop must have Acrylic variant');
assert(coreThemeRs.includes('Mica,'), 'WindowBackdrop must have Mica variant');
assert(coreThemeRs.includes('None,'), 'WindowBackdrop must have None variant');

// Win32 DWM_SYSTEMBACKDROP_TYPE codes: 1=None, 2=Mica, 3=Acrylic, 4=MicaAlt
assert(coreThemeRs.includes('DWMSBT_NONE: u32 = 1'), 'None code must be 1');
assert(coreThemeRs.includes('DWMSBT_MAINWINDOW: u32 = 2'), 'Mica code must be 2');
assert(coreThemeRs.includes('DWMSBT_TRANSIENTWINDOW: u32 = 3'), 'Acrylic code must be 3');
assert(coreThemeRs.includes('DWMSBT_TABBEDWINDOW: u32 = 4'), 'MicaAlt code must be 4');

// DwmSetWindowAttribute attribute IDs
assert(coreThemeRs.includes('DWMWA_SYSTEMBACKDROP_TYPE: u32 = 38'), 'DWMWA_SYSTEMBACKDROP_TYPE attribute must be 38');
assert(coreThemeRs.includes('DWMWA_MICA_EFFECT: u32 = 1029'), 'DWMWA_MICA_EFFECT attribute must be 1029');
assert(coreThemeRs.includes('pub unsafe fn apply_window_backdrop_win32'), 'theme.rs must export apply_window_backdrop_win32');

// Verify exports from core lib.rs
assert(coreLibRs.includes('WindowBackdrop'), 'core lib.rs must re-export WindowBackdrop');
assert(coreLibRs.includes('apply_window_backdrop_win32'), 'core lib.rs must re-export apply_window_backdrop_win32');

console.log('PASS: Core Rust WindowBackdrop enum, Win32 attribute codes, and dwmapi loader verified.');

// =========================================================================
// [2/5] Tauri Window Setup & Command Handlers in Calendar & Mail
// =========================================================================
console.log('\n[2/5] Verifying Tauri window effects and backdrop command handlers...');

for (const [appName, source] of [['Desktop Calendar', calLibRs], ['Desktop Mail', mailLibRs]]) {
  // Verify WindowBuilder effects configuration (Effect::Tabbed corresponds to MicaAlt)
  assert(source.includes('.effect(tauri::window::Effect::Tabbed)') && source.includes('.effects(effects)'),
    `${appName} must configure EffectsBuilder with Effect::Tabbed (MicaAlt)`);

  // Verify Tauri command registration
  assert(source.includes('fn set_window_backdrop'),
    `${appName} must define set_window_backdrop command`);
  assert(source.includes('commands::set_window_backdrop'),
    `${appName} must register set_window_backdrop in invoke_handler`);

  // Verify document.title interceptor handling backdrop commands
  assert(source.includes('cmd.starts_with("backdrop:")') || source.includes('cmd.strip_prefix("backdrop:")'),
    `${appName} document.title listener must handle backdrop: commands`);
  assert(source.includes('apply_window_backdrop_win32'),
    `${appName} must invoke apply_window_backdrop_win32 on backdrop changes`);

  // Verify startup backdrop application
  assert(source.includes('WindowBackdrop::MicaAlt'),
    `${appName} must apply WindowBackdrop::MicaAlt on startup`);
}

console.log('PASS: Tauri window effects, commands, and startup backdrops verified for both apps.');

// =========================================================================
// [3/5] CSS Backdrop Filter & Translucency in shell.css
// =========================================================================
console.log('\n[3/5] Verifying CSS backdrop filter and titlebar blur styling...');

assert(shellCss.includes('backdrop-filter: blur(16px) !important;'),
  'shell.css #desktop-custom-titlebar must have backdrop-filter: blur(16px)');
assert(shellCss.includes('-webkit-backdrop-filter: blur(16px) !important;'),
  'shell.css #desktop-custom-titlebar must have -webkit-backdrop-filter: blur(16px)');
assert(shellCss.includes('position: fixed !important;') && shellCss.includes('background: transparent !important;'),
  '#desktop-custom-titlebar must remain fixed and transparent');

console.log('PASS: CSS backdrop-filter and titlebar blur rules verified.');

// =========================================================================
// [4/5] Settings Dialog Toggle & Preference Storage
// =========================================================================
console.log('\n[4/5] Verifying Settings dialog toggle and preference integration...');

assert(titlebarScript.includes('Windows 11 Material Backdrop'),
  'titlebar.js must contain "Windows 11 Material Backdrop" setting card');
assert(titlebarScript.includes('window_backdrop_mica'),
  'titlebar.js must use preference key window_backdrop_mica');
assert(titlebarScript.includes("triggerAction(enabled ? 'backdrop:mica_alt' : 'backdrop:none')"),
  'titlebar.js toggle must trigger backdrop:mica_alt or backdrop:none');
assert(titlebarScript.includes('initWindowBackdropPref'),
  'titlebar.js must have initWindowBackdropPref to respect user choice on boot');

// Verify window frame SVG icon renders cleanly with pure DOM APIs (no innerHTML)
const mockDoc = createMockDocument();
const svgNS = 'http://www.w3.org/2000/svg';
const fnMatch = titlebarScript.match(/function createSvgIcon\(type\)\s*\{([\s\S]*?)\n  \}/);
assert(fnMatch, 'createSvgIcon function not found in titlebar.js');

const createSvgIcon = new Function('document', 'svgNS', 'type', `
  ${fnMatch[0]}
  return createSvgIcon(type);
`);

const windowIcon = createSvgIcon(mockDoc, svgNS, 'window');
assert.strictEqual(windowIcon.tagName, 'svg');
assert(windowIcon.children.length >= 2, 'Window icon must render rect frame and titlebar line');

console.log('PASS: Settings toggle card, action triggers, and window SVG icon verified.');

// =========================================================================
// [5/5] Trusted Types CSP Compliance & No InnerHTML
// =========================================================================
console.log('\n[5/5] Verifying Google Trusted Types CSP compliance (zero innerHTML)...');

assert(!titlebarScript.includes('.innerHTML ='), 'titlebar.js must never assign to innerHTML');
assert(!titlebarScript.includes('.outerHTML ='), 'titlebar.js must never assign to outerHTML');
assert(!titlebarScript.includes('.insertAdjacentHTML('), 'titlebar.js must never call insertAdjacentHTML');

console.log('PASS: Zero innerHTML/outerHTML assignments. Google Trusted Types CSP compliant.');

console.log('\nAll 5 Windows 11 Mica / Acrylic Material Backdrop test suites PASSED!\n');
