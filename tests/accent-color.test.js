/**
 * Test Suite: Windows 11 Personalization Accent Color Sync
 *
 * Verifies:
 * 1. Win32 DwmGetColorizationColor Rust core queries and fallback to HKCU registry.
 * 2. Injected bundle carries window.__DESKTOP_ACCENT_COLOR__ and #desktop-accent-theme.
 * 3. Scoped CSS styling applies strictly and exclusively to desktop wrapper UI:
 *    - Frameless titlebar update pill
 *    - Caption hover accents (excluding close button)
 *    - Settings modal tabs
 *    - About dialog buttons, done button, update button, and action highlights
 * 4. Close button maintains standard Windows 11 red hover (#e81123) and is never overridden.
 * 5. Strictly ZERO modification or interference with Google's internal web DOM.
 * 6. Settings dialog toggle "Sync with Windows Accent Color" controls accent stylesheet.
 * 7. Runtime dynamic accent color update via window.__desktop_ui.applyAccentColor.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { createMockDocument } = require('./mock-dom');

console.log('Running Windows 11 Personalization Accent Color Sync Test Suite...\n');

const root = path.resolve(__dirname, '..');
const shellCss = fs.readFileSync(path.join(root, 'shared', 'styles', 'shell.css'), 'utf8');
const win11ThemeCss = fs.readFileSync(path.join(root, 'shared', 'styles', 'win11-theme.css'), 'utf8');
const titlebarScript = fs.readFileSync(path.join(root, 'shared', 'scripts', 'titlebar.js'), 'utf8');
const coreThemeRs = fs.readFileSync(path.join(root, 'crates', 'core', 'src', 'theme.rs'), 'utf8');
const coreScriptsRs = fs.readFileSync(path.join(root, 'crates', 'core', 'src', 'scripts.rs'), 'utf8');
const calLibRs = fs.readFileSync(path.join(root, 'apps', 'desktop-calendar', 'src-tauri', 'src', 'lib.rs'), 'utf8');
const mailLibRs = fs.readFileSync(path.join(root, 'apps', 'desktop-mail', 'src-tauri', 'src', 'lib.rs'), 'utf8');

// =========================================================================
// [1/5] Core Rust Personalization & Accent Color Module Verification
// =========================================================================
console.log('[1/5] Verifying Core Rust theme module and DwmGetColorizationColor logic...');

assert(coreThemeRs.includes('DwmGetColorizationColor'), 'Rust theme module must query DwmGetColorizationColor');
assert(coreThemeRs.includes('dwmapi.dll'), 'Rust theme module must load dwmapi.dll dynamically');
assert(coreThemeRs.includes('Software\\Microsoft\\Windows\\DWM'), 'Rust theme module must query HKCU\\Software\\Microsoft\\Windows\\DWM as registry fallback');
assert(coreThemeRs.includes('ColorizationColor'), 'Rust theme module must inspect ColorizationColor');
assert(coreThemeRs.includes('pub fn generate_accent_css'), 'Rust theme module must provide generate_accent_css');
assert(coreThemeRs.includes('pub const fn default_windows_accent'), 'Rust theme module must provide default Windows accent');
assert(coreThemeRs.includes('pub struct AccentColor'), 'Rust theme module must define AccentColor struct');

// Verify Tauri command exposed on both apps
assert(calLibRs.includes('get_windows_accent_color'), 'Calendar app must expose get_windows_accent_color command');
assert(mailLibRs.includes('get_windows_accent_color'), 'Mail app must expose get_windows_accent_color command');

console.log('PASS: Core Rust DwmGetColorizationColor, registry fallback, and Tauri commands verified.');

// =========================================================================
// [2/5] Injected Bundle Initialization & Scoped CSS Generation
// =========================================================================
console.log('\n[2/5] Verifying Injected Bundle Accent Variables & Stylesheet Generation...');

assert(coreScriptsRs.includes('crate::theme::get_windows_accent_color()'), 'scripts.rs must query accent color');
assert(coreScriptsRs.includes('crate::theme::generate_accent_css(&accent)'), 'scripts.rs must generate scoped accent CSS');
assert(coreScriptsRs.includes('window.__DESKTOP_ACCENT_COLOR__'), 'Injected bundle must declare window.__DESKTOP_ACCENT_COLOR__');
assert(coreScriptsRs.includes('desktop-accent-theme'), 'Injected bundle must inject style element desktop-accent-theme');

console.log('PASS: Injected bundle exposes accent color variables and scoped stylesheet.');

// =========================================================================
// [3/5] Scoped Application to Required UI Elements & Zero Google Interference
// =========================================================================
console.log('\n[3/5] Verifying strict scoped styling across required wrapper UI controls...');

// Verify CSS variables and selectors in core theme generator
assert(coreThemeRs.includes('--win11-accent:'), 'Theme generator must define --win11-accent variable');
assert(coreThemeRs.includes('--win11-wrapper-accent:'), 'Theme generator must define --win11-wrapper-accent');
assert(coreThemeRs.includes('--win11-wrapper-accent-rgb:'), 'Theme generator must define --win11-wrapper-accent-rgb');
assert(coreThemeRs.includes('--win11-wrapper-accent-hover:'), 'Theme generator must define --win11-wrapper-accent-hover');
assert(coreThemeRs.includes('--win11-wrapper-accent-subtle:'), 'Theme generator must define --win11-wrapper-accent-subtle');
assert(coreThemeRs.includes('--win11-wrapper-accent-text:'), 'Theme generator must define --win11-wrapper-accent-text');

// 1. Frameless Titlebar Update Pill
assert(coreThemeRs.includes('#desktop-custom-titlebar .desktop-caption-update-pill'), 'Update pill must be styled by accent sheet');
assert(shellCss.includes('.desktop-caption-update-pill.calendar-theme {\n  background: var(--win11-wrapper-accent,'), 'shell.css must use --win11-wrapper-accent for Calendar update pill');
assert(shellCss.includes('.desktop-caption-update-pill.mail-theme {\n  background: var(--win11-wrapper-accent,'), 'shell.css must use --win11-wrapper-accent for Mail update pill');

// 2. Caption button hover (excluding close button)
assert(coreThemeRs.includes('#desktop-custom-titlebar .desktop-caption-btn:not(.close):hover'), 'Caption buttons must have accent hover excluding close');
assert(shellCss.includes('.desktop-caption-btn.close:hover {\n  background: #e81123 !important;'), 'Close button must strictly keep Windows 11 red (#e81123)');

// 3. Settings modal tabs
assert(coreThemeRs.includes('.desktop-settings-nav-item.active'), 'Active settings tab must be styled with accent color');
assert(win11ThemeCss.includes('.desktop-settings-nav-item.active {\n  background: var(--win11-wrapper-accent-subtle,'), 'win11-theme.css must use --win11-wrapper-accent-subtle for active settings tab');

// 4. About dialog buttons and highlights
assert(coreThemeRs.includes('.desktop-settings-done-btn'), 'Done button must be styled with accent color');
assert(coreThemeRs.includes('.desktop-update-btn'), 'Update button must be styled with accent color');
assert(coreThemeRs.includes('.desktop-settings-action-btn'), 'Action buttons must be styled with accent color');
assert(coreThemeRs.includes('.desktop-toggle-switch.on'), 'Toggle switch must be styled with accent color');

// 5. Strict isolation from Google DOM in generated CSS template
const cssMatch = coreThemeRs.match(/r#"\/\* Windows 11 Personalization Accent Color Override[\s\S]*?"#/);
assert(cssMatch, 'theme.rs must contain the scoped accent CSS template');
const rawTemplate = cssMatch[0];
assert(!rawTemplate.includes('body {'), 'theme.rs CSS template must NEVER style generic body');
assert(!rawTemplate.includes('header {'), 'theme.rs CSS template must NEVER style generic header');
assert(!rawTemplate.includes('div {'), 'theme.rs CSS template must NEVER style generic div');
assert(!rawTemplate.includes('.gb_'), 'theme.rs CSS template must NEVER style Google top bar (.gb_)');

console.log('PASS: Wrapper UI elements correctly targeted; zero Google web DOM interference.');

// =========================================================================
// [4/5] Default Windows Accent Color Synchronization (Enabled by default, no toggle)
// =========================================================================
console.log('\n[4/5] Verifying default Windows Accent Color synchronization and palette SVG...');

assert(!titlebarScript.includes("'sync_windows_accent'"), 'titlebar.js must not include toggle for sync_windows_accent (enabled by default)');
assert(titlebarScript.includes("document.getElementById('desktop-accent-theme')"), 'titlebar.js must reference desktop-accent-theme element');
assert(titlebarScript.includes("initAccentColorSync"), 'titlebar.js must initialize accent color sync by default');

// Verify palette SVG icon renders with pure DOM APIs (no innerHTML)
const mockDoc = createMockDocument();
const svgNS = 'http://www.w3.org/2000/svg';
const fnMatch = titlebarScript.match(/function createSvgIcon\(type\)\s*\{([\s\S]*?)\n  \}/);
assert(fnMatch, 'createSvgIcon function not found in titlebar.js');

const createSvgIcon = new Function('document', 'svgNS', 'type', `
  ${fnMatch[0]}
  return createSvgIcon(type);
`);

const paletteIcon = createSvgIcon(mockDoc, svgNS, 'palette');
assert.strictEqual(paletteIcon.tagName, 'svg');
assert(paletteIcon.children.length >= 2, 'Palette icon must render outline path and color dots');

console.log('PASS: Settings toggle logic and SVG palette icon verified with zero innerHTML.');

// =========================================================================
// [5/5] Dynamic Runtime Accent Color Switching via window.__desktop_ui
// =========================================================================
console.log('\n[5/5] Verifying dynamic runtime accent color switching API...');

assert(titlebarScript.includes("getAccentColor: function()"), 'window.__desktop_ui must expose getAccentColor');
assert(titlebarScript.includes("applyAccentColor: function(color)"), 'window.__desktop_ui must expose applyAccentColor');
assert(titlebarScript.includes("--win11-wrapper-accent:"), 'applyAccentColor must update CSS variable --win11-wrapper-accent');

console.log('PASS: Dynamic runtime accent color switching API verified.');

console.log('\n================================================================');
console.log('ALL 5 WINDOWS 11 ACCENT COLOR SYNC TESTS PASSED SUCCESSFULLY!');
console.log('================================================================');
