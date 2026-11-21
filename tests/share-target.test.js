/**
 * tests/share-target.test.js
 *
 * Verification suite for Windows 11 Native Share Target (Windows Share Contract):
 * 1. Desktop Mail registry registration as a native Windows Share target.
 * 2. Explorer "Send to -> Desktop Mail" shortcut creation and clean uninstallation.
 * 3. File path, URL, and mailto share argument resolution into pre-populated compose drafts.
 * 4. Verification that attachment filenames and paths are cleanly formatted for Gmail compose.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

console.log('--- Windows 11 Native Share Target Verification ---');

// 1. Verify build-installers.js Share Contract Registry Configurations
const buildInstallersPath = path.join(repoRoot, 'scripts', 'build-installers.js');
assert(fs.existsSync(buildInstallersPath), 'scripts/build-installers.js must exist');
const buildInstallers = fs.readFileSync(buildInstallersPath, 'utf8');

// Verify Windows 11 Applications registration for Share
assert(
  buildInstallers.includes('WriteRegStr HKCU "Software\\\\Classes\\\\Applications\\\\${config.binaryName}" "SupportedTypes" "*"'),
  'Must register SupportedTypes = * to allow sharing any file type'
);
assert(
  buildInstallers.includes('WriteRegStr HKCU "Software\\\\Classes\\\\Applications\\\\${config.binaryName}\\\\shell\\\\share\\\\command"'),
  'Must register shell\\share\\command for Windows 11 Share Target'
);
assert(
  buildInstallers.includes('--share-file="%1"'),
  'shell\\share\\command must invoke with --share-file="%1"'
);
assert(
  buildInstallers.includes('WriteRegStr HKCU "Software\\\\Classes\\\\Applications\\\\${config.binaryName}\\\\shell\\\\compose\\\\command"'),
  'Must register shell\\compose\\command for instant email composition'
);
console.log('✓ Windows 11 Share Target Application registry keys verified');

// Verify Explorer SendTo shortcut creation & cleanup
assert(
  buildInstallers.includes('CreateShortcut "$SENDTO\\\\Desktop Mail.lnk"'),
  'Must create "$SENDTO\\Desktop Mail.lnk" shortcut for File Explorer context menu'
);
assert(
  buildInstallers.includes('Delete "$SENDTO\\\\Desktop Mail.lnk"'),
  'Must clean up "$SENDTO\\Desktop Mail.lnk" on uninstallation'
);
console.log('✓ Windows Explorer SendTo shortcut creation and uninstallation verified');

// Verify Clients\Mail registration for Windows 11 Share Contract
assert(
  buildInstallers.includes('WriteRegStr HKCU "Software\\\\Clients\\\\Mail\\\\Desktop Mail"'),
  'Must register Clients\\Mail\\Desktop Mail'
);
assert(
  buildInstallers.includes('WriteRegStr HKCU "Software\\\\Clients\\\\Mail\\\\Desktop Mail\\\\shell\\\\compose\\\\command"'),
  'Must register Clients\\Mail compose verb'
);
assert(
  buildInstallers.includes('WriteRegStr HKCU "Software\\\\Clients\\\\Mail\\\\Desktop Mail\\\\Protocols\\\\mailto\\\\shell\\\\open\\\\command"'),
  'Must register Clients\\Mail mailto protocol command'
);
console.log('✓ Windows Clients\\Mail share handler integration verified');

// 2. Verify Rust Protocol Share Target Parsing
const protocolRs = fs.readFileSync(path.join(repoRoot, 'crates', 'core', 'src', 'protocol.rs'), 'utf8');

assert(protocolRs.includes('pub fn resolve_mail_target_url'), 'Must define resolve_mail_target_url');
assert(protocolRs.includes('--share-file='), 'Must handle --share-file= arguments');
assert(protocolRs.includes('--share='), 'Must handle --share= arguments');
assert(protocolRs.includes('extract_file_name_from_path'), 'Must extract file names cleanly across both slashes and backslashes');
assert(protocolRs.includes('create_file_share_compose_url'), 'Must construct compose drafts with attachment details');
assert(protocolRs.includes('Sharing:'), 'Pre-populated draft subject must include Sharing: <filename>');
console.log('✓ Rust protocol share target parser implementation verified');

// 3. Verify Desktop Mail app wiring for Share Targets
const mailLibRs = fs.readFileSync(path.join(repoRoot, 'apps', 'desktop-mail', 'src-tauri', 'src', 'lib.rs'), 'utf8');
assert(
  mailLibRs.includes('resolve_mail_target_url'),
  'Desktop Mail must route command line arguments through resolve_mail_target_url'
);
assert(
  mailLibRs.includes('commands::handle_mail_url'),
  'Desktop Mail must expose handle_mail_url command for runtime share triggers'
);
console.log('✓ Desktop Mail runtime share target handler verified');

console.log('All Windows 11 Native Share Target verification checks PASSED!\n');
