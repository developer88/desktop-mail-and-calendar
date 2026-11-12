const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Testing icon assets and brand consistency across workspace...');

const root = path.resolve(__dirname, '..');
const mailIcons = path.join(root, 'apps/desktop-gmail/src-tauri/icons');
const calIcons = path.join(root, 'apps/desktop-gcalendar/src-tauri/icons');

// Helper to read PNG dimensions from header
function getPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  assert(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `${filePath} is not a valid PNG`);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

// 1. Verify Desktop Mail resolutions
console.log('Checking Desktop Mail icons...');
assert(fs.existsSync(path.join(mailIcons, 'icon_1024.png')), 'icon_1024.png must exist');
const mail1024 = getPngDimensions(path.join(mailIcons, 'icon_1024.png'));
assert.strictEqual(mail1024.width, 1024, 'Mail icon_1024 width must be 1024');
assert.strictEqual(mail1024.height, 1024, 'Mail icon_1024 height must be 1024');

const mailIcon = getPngDimensions(path.join(mailIcons, 'icon.png'));
assert.strictEqual(mailIcon.width, 1024, 'Mail icon.png must be 1024');

const mail512 = getPngDimensions(path.join(mailIcons, '512x512.png'));
assert.strictEqual(mail512.width, 512, 'Mail 512x512 width must be 512');

const mailIco = fs.readFileSync(path.join(mailIcons, 'icon.ico'));
assert(mailIco.length > 1000, 'icon.ico must not be empty');

// 2. Verify Desktop Calendar resolutions
console.log('Checking Desktop Calendar icons...');
assert(fs.existsSync(path.join(calIcons, 'icon_1024.png')), 'icon_1024.png must exist');
const cal1024 = getPngDimensions(path.join(calIcons, 'icon_1024.png'));
assert.strictEqual(cal1024.width, 1024, 'Calendar icon_1024 width must be 1024');
assert.strictEqual(cal1024.height, 1024, 'Calendar icon_1024 height must be 1024');

const calIcon = getPngDimensions(path.join(calIcons, 'icon.png'));
assert.strictEqual(calIcon.width, 1024, 'Calendar icon.png must be 1024');

const cal512 = getPngDimensions(path.join(calIcons, '512x512.png'));
assert.strictEqual(cal512.width, 512, 'Calendar 512x512 width must be 512');

const calBlank512 = getPngDimensions(path.join(calIcons, 'blank_512.png'));
assert.strictEqual(calBlank512.width, 512, 'Calendar blank_512 width must be 512');

const calIco = fs.readFileSync(path.join(calIcons, 'icon.ico'));
assert(calIco.length > 1000, 'Calendar icon.ico must not be empty');

console.log('PASS: All icon assets verified up to 1024x1024 resolution.');
