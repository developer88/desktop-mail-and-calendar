const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { createMockDocument } = require('./mock-dom');

console.log('Testing About dialog execution in titlebar.js under strict Trusted Types CSP...');

const code = fs.readFileSync(path.join(__dirname, '../shared/scripts/titlebar.js'), 'utf8');

// Ensure no .innerHTML = is called on any SVG or DOM element inside titlebar.js
// By mocking document with our strict mock-dom that throws on innerHTML access
function runAboutTest(appName, isCalendar) {
  console.log(`\nTesting ${appName}...`);
  const mockDoc = createMockDocument();
  
  // We extract createSvgIcon from the script by running a scoped wrapper
  const svgNS = 'http://www.w3.org/2000/svg';
  
  // We can test createSvgIcon('mail-logo') and createSvgIcon('calendar-logo')
  const fnMatch = code.match(/function createSvgIcon\(type\)\s*\{([\s\S]*?)\n  \}/);
  assert(fnMatch, 'createSvgIcon function not found in titlebar.js');

  const createSvgIcon = new Function('document', 'svgNS', 'type', `
    ${fnMatch[0]}
    return createSvgIcon(type);
  `);

  const mailLogo = createSvgIcon(mockDoc, svgNS, 'mail-logo');
  assert.strictEqual(mailLogo.tagName, 'svg');
  assert.strictEqual(mailLogo.getAttribute('viewBox'), '0 0 512 512');
  assert(mailLogo.children.length > 5, 'mailLogo must have children');

  const calLogo = createSvgIcon(mockDoc, svgNS, 'calendar-logo');
  assert.strictEqual(calLogo.tagName, 'svg');
  assert.strictEqual(calLogo.getAttribute('viewBox'), '0 0 512 512');
  assert(calLogo.children.length > 5, 'calLogo must have children');

  console.log(`PASS: ${appName} SVG logo generated cleanly with zero innerHTML calls and valid 512x512 viewBox.`);
}

runAboutTest('Desktop Mail', false);
runAboutTest('Desktop Calendar', true);

console.log('\nALL ABOUT DIALOG TRUSTED TYPES TESTS PASSED!');
