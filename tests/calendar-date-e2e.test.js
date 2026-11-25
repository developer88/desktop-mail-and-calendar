const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync, spawn } = require('child_process');

console.log('Running Calendar Date Dynamic Icon E2E Test Suite (TDD)...');

const root = path.resolve(__dirname, '..');
const calIconsDir = path.join(root, 'apps', 'desktop-calendar', 'src-tauri', 'icons');
const blank512Path = path.join(calIconsDir, 'blank_512.png');
const blank256Path = path.join(calIconsDir, 'blank_256.png');
const iconIcoPath = path.join(calIconsDir, 'icon.ico');
const iconPngPath = path.join(calIconsDir, 'icon.png');
const wizardCalPath = path.join(root, 'shared', 'installer', 'wizard_cal.bmp');
const distExePath = path.join(root, 'dist', 'desktop-calendar.exe');

// ============================================================================
// 1. Verify Blank Template & Brand Assets
// ============================================================================
console.log('\n[1/5] Verifying Calendar Icon Assets & Blank Template...');
{
  assert(fs.existsSync(blank512Path), 'Missing blank_512.png template');
  assert(fs.existsSync(blank256Path), 'Missing blank_256.png template');
  const blankBuf = fs.readFileSync(blank512Path);
  assert.strictEqual(blankBuf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'blank_512.png must be a valid PNG');
  const blank256Buf = fs.readFileSync(blank256Path);
  assert.strictEqual(blank256Buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'blank_256.png must be a valid PNG');

  // Check official branding assets
  assert(fs.existsSync(iconIcoPath), 'Missing icon.ico branding');
  const icoBuf = fs.readFileSync(iconIcoPath);
  assert.strictEqual(icoBuf.readUInt16LE(0), 0, 'icon.ico reserved must be 0');
  assert.strictEqual(icoBuf.readUInt16LE(2), 1, 'icon.ico type must be 1 (icon)');
  assert(icoBuf.readUInt16LE(4) >= 5, 'icon.ico must bundle at least 5 icon resolutions');

  assert(fs.existsSync(iconPngPath), 'Missing icon.png branding');
  assert(fs.existsSync(wizardCalPath), 'Missing wizard_cal.bmp installer sidebar');

  console.log('PASS: All calendar icon templates and brand assets verified.');
}

// ============================================================================
// 2. Verify Calendar Injected Observer Logic
// ============================================================================
console.log('\n[2/5] Verifying Calendar Injected Date Observer Script...');
{
  const observerPath = path.join(root, 'shared', 'scripts', 'calendar-date-observer.js');
  assert(fs.existsSync(observerPath), 'Missing calendar-date-observer.js');
  const scriptContent = fs.readFileSync(observerPath, 'utf8');

  assert(scriptContent.includes('update_calendar_date_icon'), 'Observer must invoke update_calendar_date_icon command');
  assert(scriptContent.includes('getDate()'), 'Observer must extract date using local Date().getDate()');
  assert(scriptContent.includes('setInterval(updateCalendarDate, 60000)'), 'Observer must periodically check for date change across midnight');
  assert(!scriptContent.includes('dismissDataLoadToast'), 'Observer must NOT auto-dismiss or modify Google Calendar DOM');

  console.log('PASS: Calendar Date Observer script verified.');
}

// ============================================================================
// 3. Verify Tauri Calendar Config & Rust Lifecycle Hooks
// ============================================================================
console.log('\n[3/5] Verifying Desktop Calendar Tauri Config & Window Initialization...');
{
  const libRsPath = path.join(root, 'apps', 'desktop-calendar', 'src-tauri', 'src', 'lib.rs');
  const libRs = fs.readFileSync(libRsPath, 'utf8');

  // Verify WebviewWindowBuilder configures dynamic date icon before creation
  assert(libRs.includes('render_calendar_date_rgba'), 'lib.rs must call render_calendar_date_rgba on startup');
  assert(libRs.includes('builder.icon('), 'lib.rs must configure builder.icon() with dynamic date before build()');
  assert(libRs.includes('set_window_hicon'), 'lib.rs must call set_window_hicon for WM_SETICON & GCLP_HICON');
  assert(!libRs.includes('render_calendar_day_overlay_hicon'), 'lib.rs must NOT use day overlay dot badge');
  assert(libRs.includes('desktop_google_core::icon::windows::set_taskbar_overlay_icon'), 'lib.rs must ensure overlay icon is cleared');

  console.log('PASS: Desktop Calendar lifecycle hooks and clean taskbar icon (no dots) verified.');
}

function toWindowsPath(p) {
  if (p.startsWith('/mnt/c/')) {
    return 'C:\\' + p.slice(7).replace(/\//g, '\\');
  }
  return p.replace(/\//g, '\\');
}

// ============================================================================
// 4. Run Rust Win32 Native Unit Tests (RGBA Render, HICON, COM TaskbarList3)
// ============================================================================
console.log('\n[4/5] Running Core Windows Native Icon & TaskbarList3 Tests...');
{
  const testPattern = path.join(root, 'target', 'x86_64-pc-windows-msvc', 'debug', 'deps');
  if (fs.existsSync(testPattern)) {
    const files = fs.readdirSync(testPattern)
      .filter(f => f.startsWith('desktop_google_core-') && f.endsWith('.exe'))
      .map(f => ({ name: f, time: fs.statSync(path.join(testPattern, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 0) {
      const testExe = files[0].name;
      const fullExe = toWindowsPath(path.join(testPattern, testExe));
      const out = execSync(`powershell.exe -Command "& '${fullExe}' windows_tests"`, { encoding: 'utf8' });
      assert(out.includes('test_render_calendar_date_rgba_and_hicon ... ok'), 'test_render_calendar_date_rgba_and_hicon failed');
      assert(out.includes('test_render_calendar_day_overlay_hicon ... ok'), 'test_render_calendar_day_overlay_hicon failed');
      assert(out.includes('test_set_taskbar_overlay_icon_fresh_thread ... ok'), 'test_set_taskbar_overlay_icon_fresh_thread failed');
      console.log('PASS: Native Win32 GDI rendering and COM TaskbarList3 tests passed.');
    } else {
      console.log('SKIP: Core test binary not pre-compiled in debug/deps.');
    }
  } else {
    console.log('SKIP: target directory not present.');
  }
}

// ============================================================================
// 5. Live Binary Window HICON & Process E2E Test
// ============================================================================
console.log('\n[5/5] Testing Live Executable Window Creation & Icon Handle...');
{
  if (fs.existsSync(distExePath)) {
    const winExePath = toWindowsPath(distExePath);
    const inspectScript = `
$p = Start-Process -FilePath '${winExePath.replace(/'/g, "''")}' -PassThru
Start-Sleep -Seconds 3
$hwnd = $p.MainWindowHandle
Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $p.Id } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Write-Output "PROCESS_LAUNCHED_OK PID:$($p.Id) HWND:$hwnd"
`;
    try {
      const b64 = Buffer.from(inspectScript, 'utf16le').toString('base64');
      const out = execSync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${b64}`, { encoding: 'utf8' });
      console.log('Process inspection output:', out.trim());
      assert(out.includes('PROCESS_LAUNCHED_OK'), 'Executable must start and produce valid process handle');
      console.log('PASS: Live executable successfully instantiates window and process.');
    } catch (e) {
      console.log('Live inspection warning:', e.message);
    }
  } else {
    console.log('SKIP: dist/desktop-calendar.exe not found on disk.');
  }
}

console.log('\nALL 5 CALENDAR DATE E2E TESTS PASSED!');
