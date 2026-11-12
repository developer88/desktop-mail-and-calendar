const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Testing unread-observer and calendar-date-observer assets and logic...');

const root = path.resolve(__dirname, '..');
const unreadJs = fs.readFileSync(path.join(root, 'shared/scripts/unread-observer.js'), 'utf8');
const calJs = fs.readFileSync(path.join(root, 'shared/scripts/calendar-date-observer.js'), 'utf8');

// 1. Verify unread-observer BASE_ICON
const mailMatch = unreadJs.match(/const BASE_ICON = 'data:image\/png;base64,([^']+)';/);
assert(mailMatch, 'BASE_ICON must be defined in unread-observer.js');
const mailBuf = Buffer.from(mailMatch[1], 'base64');
assert.strictEqual(mailBuf.readUInt32BE(16), 512, 'Mail BASE_ICON width must be 512');
assert.strictEqual(mailBuf.readUInt32BE(20), 512, 'Mail BASE_ICON height must be 512');

// 2. Verify calendar-date-observer BASE_CALENDAR_ICON
const calMatch = calJs.match(/const BASE_CALENDAR_ICON = 'data:image\/png;base64,([^']+)';/);
assert(calMatch, 'BASE_CALENDAR_ICON must be defined in calendar-date-observer.js');
const calBuf = Buffer.from(calMatch[1], 'base64');
assert.strictEqual(calBuf.readUInt32BE(16), 512, 'Calendar BASE_CALENDAR_ICON width must be 512');
assert.strictEqual(calBuf.readUInt32BE(20), 512, 'Calendar BASE_CALENDAR_ICON height must be 512');

// 3. Verify text color is emerald green (#15803d) and NOT Google blue (#1a73e8)
assert(calJs.includes('#15803d'), 'Calendar date observer must use emerald green #15803d');
assert(!calJs.includes('#1a73e8'), 'Calendar date observer must NOT use Google Blue #1a73e8');

console.log('PASS: Observers configured with 512x512 high-resolution templates and correct brand styling.');
