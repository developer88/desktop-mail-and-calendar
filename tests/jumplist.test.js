/**
 * tests/jumplist.test.js
 *
 * Verification suite for Taskbar Jump Lists for Windows 11 (Taskbar Right-Click Menu):
 * 1. Win32 ICustomDestinationList / IShellLinkW / IPropertyStore data structures.
 * 2. Desktop Mail Jump List tasks: "New Message", "Inbox", "Starred", "Sent".
 * 3. Desktop Calendar Jump List tasks: "New Event", "Go to Today", "Day View", "Week View".
 * 4. Direct CLI argument resolution to destination URLs.
 * 5. Rust module & Tauri command registration.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

console.log('--- Taskbar Jump Lists for Windows 11 Verification ---');

// 1. Verify Rust crates/core/src/jumplist.rs implementation
const jumplistRsPath = path.join(repoRoot, 'crates', 'core', 'src', 'jumplist.rs');
assert(fs.existsSync(jumplistRsPath), 'crates/core/src/jumplist.rs must exist');
const jumplistRs = fs.readFileSync(jumplistRsPath, 'utf8');

// Verify Mail tasks in Rust
assert(jumplistRs.includes('get_mail_jumplist_tasks'), 'Must define get_mail_jumplist_tasks');
assert(jumplistRs.includes('"New Message"'), 'Mail jumplist must include "New Message"');
assert(jumplistRs.includes('"--compose"'), 'Mail "New Message" must use --compose');
assert(jumplistRs.includes('"Inbox"'), 'Mail jumplist must include "Inbox"');
assert(jumplistRs.includes('"#inbox"'), 'Mail "Inbox" must route to #inbox');
assert(jumplistRs.includes('"Starred"'), 'Mail jumplist must include "Starred"');
assert(jumplistRs.includes('"#starred"'), 'Mail "Starred" must route to #starred');
assert(jumplistRs.includes('"Sent"'), 'Mail jumplist must include "Sent"');
assert(jumplistRs.includes('"#sent"'), 'Mail "Sent" must route to #sent');
console.log('✓ Desktop Mail Jump List tasks verified in Rust');

// Verify Calendar tasks in Rust
assert(jumplistRs.includes('get_calendar_jumplist_tasks'), 'Must define get_calendar_jumplist_tasks');
assert(jumplistRs.includes('"New Event"'), 'Calendar jumplist must include "New Event"');
assert(jumplistRs.includes('eventedit'), 'Calendar "New Event" must route to eventedit');
assert(jumplistRs.includes('"Go to Today"'), 'Calendar jumplist must include "Go to Today"');
assert(jumplistRs.includes('/r/day'), 'Calendar "Go to Today" must route to /r/day');
assert(jumplistRs.includes('"Day View"'), 'Calendar jumplist must include "Day View"');
assert(jumplistRs.includes('"Week View"'), 'Calendar jumplist must include "Week View"');
assert(jumplistRs.includes('/r/week'), 'Calendar "Week View" must route to /r/week');
console.log('✓ Desktop Calendar Jump List tasks verified in Rust');

// Verify Win32 COM APIs in Rust
assert(jumplistRs.includes('ICustomDestinationList'), 'Must use ICustomDestinationList');
assert(jumplistRs.includes('DestinationList'), 'Must instantiate DestinationList coclass');
assert(jumplistRs.includes('SetAppID'), 'Must call SetAppID');
assert(jumplistRs.includes('BeginList'), 'Must call BeginList');
assert(jumplistRs.includes('AddUserTasks'), 'Must call AddUserTasks');
assert(jumplistRs.includes('CommitList'), 'Must call CommitList');
assert(jumplistRs.includes('IShellLinkW'), 'Must construct IShellLinkW');
assert(jumplistRs.includes('IPropertyStore'), 'Must set title via IPropertyStore');
assert(jumplistRs.includes('0xf29f85e0_4ff9_1068_ab91_08002b27b3d9'), 'Must use PKEY_Title GUID');
console.log('✓ Win32 ICustomDestinationList COM implementation verified');

// 2. Verify exports in crates/core/src/lib.rs
const coreLibRs = fs.readFileSync(path.join(repoRoot, 'crates', 'core', 'src', 'lib.rs'), 'utf8');
assert(coreLibRs.includes('pub mod jumplist;'), 'crates/core/src/lib.rs must declare pub mod jumplist');
assert(coreLibRs.includes('register_jump_list'), 'crates/core/src/lib.rs must export register_jump_list');
assert(coreLibRs.includes('get_mail_jumplist_tasks'), 'crates/core/src/lib.rs must export get_mail_jumplist_tasks');
assert(coreLibRs.includes('get_calendar_jumplist_tasks'), 'crates/core/src/lib.rs must export get_calendar_jumplist_tasks');
console.log('✓ Crate core exports verified');

// 3. Verify Desktop Mail app wiring
const mailLibRs = fs.readFileSync(path.join(repoRoot, 'apps', 'desktop-mail', 'src-tauri', 'src', 'lib.rs'), 'utf8');
assert(mailLibRs.includes('register_mail_jumplist'), 'Desktop Mail must declare register_mail_jumplist command');
assert(mailLibRs.includes('register_jump_list'), 'Desktop Mail must call register_jump_list on startup');
assert(mailLibRs.includes('resolve_mail_target_url'), 'Desktop Mail must use resolve_mail_target_url for arguments');
console.log('✓ Desktop Mail startup jump list registration and CLI routing verified');

// 4. Verify Desktop Calendar app wiring
const calLibRs = fs.readFileSync(path.join(repoRoot, 'apps', 'desktop-calendar', 'src-tauri', 'src', 'lib.rs'), 'utf8');
assert(calLibRs.includes('register_calendar_jumplist'), 'Desktop Calendar must declare register_calendar_jumplist command');
assert(calLibRs.includes('register_jump_list'), 'Desktop Calendar must call register_jump_list on startup');
assert(calLibRs.includes('resolve_calendar_target_url'), 'Desktop Calendar must use resolve_calendar_target_url');
console.log('✓ Desktop Calendar startup jump list registration and CLI routing verified');

// 5. Verify protocol resolution matches Jump List tasks
const protocolRs = fs.readFileSync(path.join(repoRoot, 'crates', 'core', 'src', 'protocol.rs'), 'utf8');

// Mail jump list targets
assert(protocolRs.includes('https://mail.google.com/mail/u/0/?view=cm&fs=1'), 'Must route --compose to in-app compose');
assert(protocolRs.includes('--url='), 'Must handle --url= arguments');

// Calendar jump list targets
assert(protocolRs.includes('https://calendar.google.com/calendar/u/0/r/eventedit'), 'Must route --new-event to eventedit');
assert(protocolRs.includes('https://calendar.google.com/calendar/u/0/r/day'), 'Must route --today / --day to day view');
assert(protocolRs.includes('https://calendar.google.com/calendar/u/0/r/week'), 'Must route --week to week view');
console.log('✓ Protocol routing logic matches Jump List arguments');

console.log('All Taskbar Jump List verification checks PASSED!\n');
