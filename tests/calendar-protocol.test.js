const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

console.log('Running Calendar Protocol & File Association Test Suite (.ics & webcal://)...');

const root = path.resolve(__dirname, '..');
const navScript = fs.readFileSync(path.join(root, 'shared', 'scripts', 'navigation-interceptor.js'), 'utf8');
const installerScript = fs.readFileSync(path.join(root, 'scripts', 'build-installers.js'), 'utf8');
const coreProtocolRs = fs.readFileSync(path.join(root, 'crates', 'core', 'src', 'protocol.rs'), 'utf8');
const coreNavRs = fs.readFileSync(path.join(root, 'crates', 'core', 'src', 'navigation.rs'), 'utf8');
const calLibRs = fs.readFileSync(path.join(root, 'apps', 'desktop-calendar', 'src-tauri', 'src', 'lib.rs'), 'utf8');

// ============================================================================
// 1. Verify Rust Core Protocol & Navigation Registration
// ============================================================================
console.log('\n[1/4] Verifying Core Rust protocol implementation...');
assert(coreProtocolRs.includes('pub struct IcsEventData'), 'protocol.rs must define IcsEventData');
assert(coreProtocolRs.includes('pub fn parse_ics_content'), 'protocol.rs must define parse_ics_content');
assert(coreProtocolRs.includes('pub fn to_calendar_event_url'), 'protocol.rs must define to_calendar_event_url');
assert(coreProtocolRs.includes('pub fn to_calendar_subscribe_url'), 'protocol.rs must define to_calendar_subscribe_url');
assert(coreProtocolRs.includes('pub fn resolve_calendar_target_url'), 'protocol.rs must define resolve_calendar_target_url');
assert(coreProtocolRs.includes('pub fn register_calendar_protocol_handlers'), 'protocol.rs must define register_calendar_protocol_handlers');

assert(coreNavRs.includes('UrlCategory::Webcal'), 'navigation.rs must include UrlCategory::Webcal');
assert(coreNavRs.includes('raw_url.starts_with("webcal:")'), 'navigation.rs must classify webcal: urls');
assert(coreNavRs.includes('raw_url.starts_with("webcals:")'), 'navigation.rs must classify webcals: urls');
console.log('PASS: Core Rust protocol and navigation implementation verified.');

// ============================================================================
// 2. Verify Desktop Calendar Tauri Handlers & Startup Routing
// ============================================================================
console.log('\n[2/4] Verifying Desktop Calendar Tauri command integration...');
assert(calLibRs.includes('handle_calendar_url'), 'Calendar lib.rs must provide handle_calendar_url command');
assert(calLibRs.includes('register_calendar_protocols'), 'Calendar lib.rs must provide register_calendar_protocols command');
assert(calLibRs.includes('register_calendar_protocol_handlers(None)'), 'Calendar setup must call register_calendar_protocol_handlers');
assert(calLibRs.includes('resolve_calendar_target_url'), 'Calendar startup must resolve calendar target url from args');
assert(calLibRs.includes('"register:protocols"'), 'Calendar must handle register:protocols command from UI');
console.log('PASS: Desktop Calendar Tauri commands and lifecycle registration verified.');

// ============================================================================
// 3. Verify NSIS Installer Registrations
// ============================================================================
console.log('\n[3/4] Verifying NSIS Installer protocol & file association records...');
assert(installerScript.includes('DesktopCalendar.Url.webcal'), 'Installer must define DesktopCalendar.Url.webcal ProgID');
assert(installerScript.includes('DesktopCalendar.Assoc.ics'), 'Installer must define DesktopCalendar.Assoc.ics ProgID');
assert(installerScript.includes('.ics\\\\OpenWithProgids'), 'Installer must register .ics\\OpenWithProgids');
assert(installerScript.includes('URLAssociations" "webcal"'), 'Installer must register webcal URLAssociation');
assert(installerScript.includes('URLAssociations" "webcals"'), 'Installer must register webcals URLAssociation');
assert(installerScript.includes('FileAssociations" ".ics"'), 'Installer must register .ics FileAssociation');
assert(installerScript.includes('DeleteRegValue HKCU "Software\\\\Classes\\\\.ics\\\\OpenWithProgids"'), 'Uninstaller must clean up .ics OpenWithProgids');
console.log('PASS: NSIS installer protocol and file associations verified.');

// ============================================================================
// 4. Verify In-App Link Interception (webcal:, webcals:, and .ics)
// ============================================================================
console.log('\n[4/4] Verifying in-app link interception for webcal://, webcals://, and .ics...');
{
  const dom = new JSDOM('<!DOCTYPE html><html><head><title>Calendar</title></head><body></body></html>', {
    url: 'https://calendar.google.com/calendar/u/0/r',
    runScripts: 'outside-only'
  });
  const { window } = dom;
  window.APP_KIND = 'calendar';
  const navigatedUrls = [];
  window.__DESKTOP_NAVIGATE__ = (url) => {
    navigatedUrls.push(url);
  };

  window.eval(`(function() {
    var APP_KIND = "calendar";
    var PRIMARY_HOST = "calendar.google.com";
    ${navScript}
  })();`);

  // Test webcal:// link
  const link1 = window.document.createElement('a');
  link1.href = 'webcal://example.com/sports-schedule.ics';
  window.document.body.appendChild(link1);
  link1.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert(
    navigatedUrls.some((u) => u.includes('addcalendar?cid=http%3A%2F%2Fexample.com%2Fsports-schedule.ics')),
    'webcal: link click must redirect to addcalendar?cid='
  );

  // Test webcals:// link
  const link2 = window.document.createElement('a');
  link2.href = 'webcals://example.com/team-calendar.ics';
  window.document.body.appendChild(link2);
  link2.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert(
    navigatedUrls.some((u) => u.includes('addcalendar?cid=https%3A%2F%2Fexample.com%2Fteam-calendar.ics')),
    'webcals: link click must redirect to addcalendar?cid= with https:// prefix'
  );

  // Test .ics link
  const link3 = window.document.createElement('a');
  link3.href = 'https://example.com/downloads/invite.ics';
  window.document.body.appendChild(link3);
  link3.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert(
    navigatedUrls.some((u) => u.includes('addcalendar?cid=https%3A%2F%2Fexample.com%2Fdownloads%2Finvite.ics')),
    '.ics link click must redirect to addcalendar?cid='
  );

  console.log('PASS: In-app link interception correctly routes all calendar protocol formats.');
}

console.log('\n================================================================');
console.log('ALL 4 CALENDAR PROTOCOL & FILE ASSOCIATION TESTS PASSED!');
console.log('================================================================');
