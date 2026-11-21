const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Running Web Notification Bridge & System Integration Tests...');

const root = path.resolve(__dirname, '..');
const bridgeScript = fs.readFileSync(path.join(root, 'shared', 'scripts', 'notification-bridge.js'), 'utf8');

function fromHex(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// Lightweight window & document mock for fast, robust unit testing
function createTestContext() {
  const storage = {};
  const dispatchedCommands = [];
  let title = 'Inbox (0) - user@gmail.com - Gmail';

  const mockWindow = {
    __desktop_last_notif_time: 0,
    localStorage: {
      getItem(k) { return storage[k] !== undefined ? storage[k] : null; },
      setItem(k, v) { storage[k] = String(v); },
      removeItem(k) { delete storage[k]; }
    },
    document: {
      get title() { return title; },
      set title(val) {
        title = val;
        if (typeof val === 'string' && val.startsWith('__desktop_cmd__:')) {
          dispatchedCommands.push(val);
        }
      }
    },
    navigator: {
      permissions: {
        query(param) { return Promise.resolve({ state: 'prompt', name: param.name }); }
      }
    },
    ServiceWorkerRegistration: function() {},
    setTimeout(fn, ms) { return setTimeout(fn, ms); },
    console: console
  };

  mockWindow.ServiceWorkerRegistration.prototype = {};
  mockWindow.window = mockWindow;

  return { mockWindow, storage, dispatchedCommands };
}

async function run() {
  const { mockWindow, storage, dispatchedCommands } = createTestContext();

  // Evaluate notification-bridge.js within the mock window context
  const runBridge = new Function('window', 'document', 'navigator', 'localStorage', 'ServiceWorkerRegistration', 'setTimeout', 'TextEncoder', `
    ${bridgeScript}
  `);

  runBridge(
    mockWindow,
    mockWindow.document,
    mockWindow.navigator,
    mockWindow.localStorage,
    mockWindow.ServiceWorkerRegistration,
    mockWindow.setTimeout,
    TextEncoder
  );

  // 1. Verify W3C Notification API Interface & Static Members
  console.log('\n[1/4] Verifying W3C Notification API Interface & Permissions...');
  {
    assert(mockWindow.Notification, 'window.Notification must be polyfilled');
    assert.strictEqual(typeof mockWindow.Notification, 'function');
    assert.strictEqual(mockWindow.Notification.maxActions, 2, 'maxActions must be 2');

    // Default permission (unconfigured) should be 'granted' for seamless desktop integration
    assert.strictEqual(mockWindow.Notification.permission, 'granted', 'Default permission must be granted');

    // Request permission promise and callback
    let callbackResult = null;
    const reqPromise = mockWindow.Notification.requestPermission((p) => { callbackResult = p; });
    const resolvedResult = await reqPromise;
    assert.strictEqual(resolvedResult, 'granted');
    assert.strictEqual(callbackResult, 'granted');

    // navigator.permissions.query integration
    const permQuery = await mockWindow.navigator.permissions.query({ name: 'notifications' });
    assert.strictEqual(permQuery.name, 'notifications');
    assert.strictEqual(permQuery.state, 'granted');

    console.log('PASS: W3C Notification API interface and permission query verified.');
  }

  // 2. Verify Settings Preference Toggling
  console.log('\n[2/4] Testing Notification Settings Preference Toggling...');
  {
    mockWindow.localStorage.setItem('desktop_pref_notifications_enabled', 'false');
    assert.strictEqual(mockWindow.Notification.permission, 'denied', 'Permission must be denied when disabled in settings');

    const permQueryDenied = await mockWindow.navigator.permissions.query({ name: 'notifications' });
    assert.strictEqual(permQueryDenied.state, 'denied');

    // Re-enable
    mockWindow.localStorage.setItem('desktop_pref_notifications_enabled', 'true');
    assert.strictEqual(mockWindow.Notification.permission, 'granted', 'Permission must be granted when re-enabled');

    console.log('PASS: Preference toggles reflect accurately across Notification and Permissions API.');
  }

  // 3. Verify Construction & Native Host Dispatch
  console.log('\n[3/4] Testing Notification Instantiation & Native Command Dispatch...');
  {
    dispatchedCommands.length = 0;
    let showFired = false;
    let closeFired = false;

    const notif = new mockWindow.Notification('John Doe', {
      body: 'Quarterly review meeting at 2:00 PM',
      tag: 'msg_998877',
      silent: false
    });

    assert.strictEqual(notif.title, 'John Doe');
    assert.strictEqual(notif.body, 'Quarterly review meeting at 2:00 PM');
    assert.strictEqual(notif.tag, 'msg_998877');

    notif.onshow = () => { showFired = true; };
    notif.onclose = () => { closeFired = true; };

    await new Promise((r) => setTimeout(r, 60));
    assert(showFired, 'onshow handler must fire asynchronously');

    notif.close();
    assert(closeFired, 'onclose handler must fire on close()');

    // Allow queue to settle
    await new Promise((r) => setTimeout(r, 120));

    // Verify dispatched command
    assert(dispatchedCommands.length >= 1, 'Command must be dispatched to native host');
    const lastCmd = dispatchedCommands[0];
    assert(lastCmd.startsWith('__desktop_cmd__:notify:'), 'Command prefix must be notify:');

    const hex = lastCmd.slice('__desktop_cmd__:notify:'.length);
    const decodedJson = JSON.parse(fromHex(hex));
    assert.strictEqual(decodedJson.title, 'John Doe');
    assert.strictEqual(decodedJson.body, 'Quarterly review meeting at 2:00 PM');
    assert.strictEqual(decodedJson.tag, 'msg_998877');

    console.log('PASS: Native notification dispatched cleanly with matching payload.');
  }

  // 4. Verify ServiceWorker showNotification Bridge
  console.log('\n[4/4] Testing ServiceWorker showNotification Bridge...');
  {
    dispatchedCommands.length = 0;
    const swReg = new mockWindow.ServiceWorkerRegistration();
    assert(typeof swReg.showNotification === 'function', 'showNotification must be polyfilled on SW registration');

    await swReg.showNotification('Calendar Alert', {
      body: 'Event starting in 10 minutes'
    });

    await new Promise((r) => setTimeout(r, 120));
    assert(dispatchedCommands.length >= 1, 'SW notification must dispatch to native host');
    const hex = dispatchedCommands[0].slice('__desktop_cmd__:notify:'.length);
    const decoded = JSON.parse(fromHex(hex));
    assert.strictEqual(decoded.title, 'Calendar Alert');
    assert.strictEqual(decoded.body, 'Event starting in 10 minutes');

    console.log('PASS: ServiceWorker showNotification successfully routes to native bridge.');
  }

  // 5. Verify Meeting URL Extraction for 1-Click Join Video Call
  console.log('\n[5/5] Testing Meeting URL Extraction for 1-Click Video Call Action...');
  {
    // Test helper methods directly
    assert.strictEqual(
      mockWindow.Notification.extractMeetingUrl(null, 'Sprint Demo', 'Join with Google Meet: meet.google.com/abc-defg-hij.'),
      'https://meet.google.com/abc-defg-hij'
    );
    assert.strictEqual(
      mockWindow.Notification.extractMeetingUrl({ data: { url: 'https://zoom.us/j/1234567890?pwd=xyz' } }, 'Zoom Sync', '10:00 AM'),
      'https://zoom.us/j/1234567890?pwd=xyz'
    );
    assert.strictEqual(
      mockWindow.Notification.extractMeetingUrl({ actions: [{ action: 'https://teams.microsoft.com/l/meetup-join/19%3axyz' }] }, 'Teams', ''),
      'https://teams.microsoft.com/l/meetup-join/19%3axyz'
    );
    assert.strictEqual(
      mockWindow.Notification.extractMeetingUrl(null, 'No link', 'Just regular text with https://google.com'),
      null
    );

    // Test through full notification constructor dispatch
    dispatchedCommands.length = 0;
    new mockWindow.Notification('Project Sync & Review', {
      body: '11:00 AM - 11:30 AM\nGoogle Meet: https://meet.google.com/xyz-uvwx-rst',
      tag: 'cal_event_meet_1'
    });

    await new Promise((r) => setTimeout(r, 120));

    assert(dispatchedCommands.length >= 1, 'Command must be dispatched for calendar event reminder');
    const hex = dispatchedCommands[0].slice('__desktop_cmd__:notify:'.length);
    const payload = JSON.parse(fromHex(hex));
    assert.strictEqual(payload.title, 'Project Sync & Review');
    assert.strictEqual(payload.meeting_url, 'https://meet.google.com/xyz-uvwx-rst');

    console.log('PASS: Meeting URL extracted cleanly and serialized in native notification payload.');
  }

  console.log('\nALL 5 NOTIFICATION BRIDGE TESTS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
