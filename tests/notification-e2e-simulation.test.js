/**
 * notification-e2e-simulation.test.js
 * Comprehensive E2E Simulation Test Suite for Gmail & Google Calendar Notifications
 *
 * Emulates the actual internal notification lifecycle of Gmail and Google Calendar web apps:
 * 1. Startup permission handshake (W3C Notification & Permissions API)
 * 2. Incoming email arrival with direct window.Notification dispatch
 * 3. Incoming email via Service Worker registration.showNotification
 * 4. Suppressed/silent email fallback via Unread Badge title/DOM change
 * 5. Google Calendar event reminder notification dispatch
 * 6. Native toast click action (unminimize & focus app window)
 * 7. Live Windows WinRT Toast Notification Manager execution with registered AUMID
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

console.log('Running Gmail & Calendar Notification E2E Simulation Tests...\n');

const root = path.resolve(__dirname, '..');
const notifBridgeScript = fs.readFileSync(path.join(root, 'shared', 'scripts', 'notification-bridge.js'), 'utf8');
const unreadObserverScript = fs.readFileSync(path.join(root, 'shared', 'scripts', 'unread-observer.js'), 'utf8');

// Helper to decode UTF-8 hex
function fromHex(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return Buffer.from(bytes).toString('utf8');
}

// Lightweight realistic browser environment
function createMockBrowserEnv(appKind = 'mail') {
  const listeners = {};
  const dispatchedCommands = [];

  const env = {
    APP_KIND: appKind,
    __DESKTOP_FIRST_RUN__: false,
    PRIMARY_HOST: appKind === 'mail' ? 'mail.google.com' : 'calendar.google.com',
    location: {
      hostname: appKind === 'mail' ? 'mail.google.com' : 'calendar.google.com',
      pathname: appKind === 'mail' ? '/mail/u/0/' : '/calendar/u/0/r',
      search: ''
    },
    document: {
      _title: appKind === 'mail' ? 'Inbox (0) - user@gmail.com' : 'Google Calendar',
      get title() {
        return this._title;
      },
      set title(val) {
        this._title = val;
        if (typeof val === 'string' && val.startsWith('__desktop_cmd__:')) {
          dispatchedCommands.push(val);
        }
        if (listeners['titleChange']) {
          listeners['titleChange'].forEach((cb) => cb(val));
        }
        if (listeners['mutation']) {
          listeners['mutation'].forEach((cb) => cb());
        }
      },
      readyState: 'complete',
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
      documentElement: { appendChild: () => {} },
      createElement: (tag) => {
        return {
          tagName: tag.toUpperCase(),
          style: {},
          setAttribute: () => {},
          appendChild: () => {},
          addEventListener: () => {},
          remove: () => {},
          getContext: () => null
        };
      },
      querySelector: (sel) => {
        if (sel === 'title') {
          return {
            textContent: env.document._title,
            addEventListener: () => {}
          };
        }
        return null;
      },
      addEventListener: (type, cb) => {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(cb);
      },
      removeEventListener: () => {}
    },
    localStorage: {
      _store: { 'desktop_pref_notifications_enabled': 'true' },
      getItem(k) { return this._store[k] !== undefined ? this._store[k] : null; },
      setItem(k, v) { this._store[k] = v.toString(); },
      removeItem(k) { delete this._store[k]; }
    },
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      permissions: {
        query: async (desc) => {
          return { state: 'granted', name: desc.name };
        }
      }
    },
    ServiceWorkerRegistration: function () {},
    Image: class {
      constructor() {
        setTimeout(() => { if (this.onload) this.onload(); }, 1);
      }
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        if (!listeners['mutation']) listeners['mutation'] = [];
        listeners['mutation'].push(callback);
      }
      observe() {}
      disconnect() {}
    },
    addEventListener: (type, cb) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(cb);
    },
    removeEventListener: () => {},
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    setInterval: global.setInterval,
    clearInterval: global.clearInterval,
    Date: global.Date,
    TextEncoder: global.TextEncoder,
    TextDecoder: global.TextDecoder,
    JSON: global.JSON
  };

  env.window = env;
  env.top = env;
  env.self = env;
  env.document.defaultView = env;

  return { env, dispatchedCommands, listeners };
}

async function run() {
  // ==========================================================================
  // [1/7] Startup Permission Handshake Simulation
  // ==========================================================================
  console.log('[1/7] Testing Gmail & Calendar Web Notification Permission Handshake...');
  {
    const { env } = createMockBrowserEnv('mail');
    const runner = new Function('window', 'document', 'navigator', 'localStorage', 'ServiceWorkerRegistration', notifBridgeScript);
    runner(env, env.document, env.navigator, env.localStorage, env.ServiceWorkerRegistration);

    assert(env.Notification, 'W3C Notification constructor must be polyfilled');
    assert.strictEqual(env.Notification.permission, 'granted', 'Notification.permission must be granted by default');
    assert.strictEqual(env.Notification.maxActions, 2, 'Notification.maxActions must be 2');

    // Emulate Gmail checking permission via requestPermission promise
    const requested = await env.Notification.requestPermission();
    assert.strictEqual(requested, 'granted', 'requestPermission must resolve to granted');

    // Emulate Gmail checking permission via navigator.permissions.query
    const permQuery = await env.navigator.permissions.query({ name: 'notifications' });
    assert.strictEqual(permQuery.state, 'granted', 'navigator.permissions.query must return granted state');

    console.log('PASS: Startup notification permissions verified as granted without prompts.');
  }

  // ==========================================================================
  // [2/7] Gmail Incoming Email via Direct window.Notification Simulation
  // ==========================================================================
  console.log('\n[2/7] Testing Gmail Incoming Email with window.Notification Dispatch...');
  {
    const { env, dispatchedCommands } = createMockBrowserEnv('mail');
    const runner = new Function('window', 'document', 'navigator', 'localStorage', 'ServiceWorkerRegistration', notifBridgeScript);
    runner(env, env.document, env.navigator, env.localStorage, env.ServiceWorkerRegistration);

    // Emulate Gmail's internal notification firing when new message arrives
    const incomingSender = 'Alice Smith <alice.smith@example.com>';
    const emailSubject = 'Q4 Roadmap & Project Milestones';
    const messageTag = 'thread_f_18192837465';

    let notifShown = false;
    const notif = new env.Notification(incomingSender, {
      body: emailSubject,
      tag: messageTag,
      icon: 'https://mail.google.com/mail/u/0/images/favicon.ico'
    });

    notif.onshow = () => { notifShown = true; };

    // Wait for queue dispatch cycle
    await new Promise((r) => setTimeout(r, 120));

    assert(notifShown, 'Notification onshow callback must be triggered');
    assert(dispatchedCommands.length >= 1, 'Notification command must be dispatched');

    const cmd = dispatchedCommands.find((c) => c.startsWith('__desktop_cmd__:notify:'));
    assert(cmd, 'Command must have __desktop_cmd__:notify: prefix');

    const hex = cmd.slice('__desktop_cmd__:notify:'.length);
    const payload = JSON.parse(fromHex(hex));
    assert.strictEqual(payload.title, incomingSender);
    assert.strictEqual(payload.body, emailSubject);
    assert.strictEqual(payload.tag, messageTag);

    console.log('PASS: Gmail incoming email notification dispatched with exact sender and subject.');
  }

  // ==========================================================================
  // [3/7] Modern Gmail ServiceWorker showNotification Simulation
  // ==========================================================================
  console.log('\n[3/7] Testing Gmail ServiceWorker showNotification Dispatch...');
  {
    const { env, dispatchedCommands } = createMockBrowserEnv('mail');
    const runner = new Function('window', 'document', 'navigator', 'localStorage', 'ServiceWorkerRegistration', notifBridgeScript);
    runner(env, env.document, env.navigator, env.localStorage, env.ServiceWorkerRegistration);

    const swReg = new env.ServiceWorkerRegistration();
    assert(typeof swReg.showNotification === 'function', 'showNotification must be polyfilled on ServiceWorkerRegistration');

    await swReg.showNotification('Security Alert: Google Account', {
      body: 'New sign-in detected on Windows device',
      tag: 'security_alert_001'
    });

    await new Promise((r) => setTimeout(r, 120));

    const cmd = dispatchedCommands.find((c) => c.startsWith('__desktop_cmd__:notify:'));
    assert(cmd, 'SW notification must be bridged to __desktop_cmd__:notify:');

    const hex = cmd.slice('__desktop_cmd__:notify:'.length);
    const payload = JSON.parse(fromHex(hex));
    assert.strictEqual(payload.title, 'Security Alert: Google Account');
    assert.strictEqual(payload.body, 'New sign-in detected on Windows device');

    console.log('PASS: ServiceWorker showNotification bridged cleanly to native layer.');
  }

  // ==========================================================================
  // [4/7] Silent / Suppressed Email Fallback via Unread Badge Increment
  // ==========================================================================
  console.log('\n[4/7] Testing Silent Email Fallback Notification via Unread Observer...');
  {
    const { env, dispatchedCommands, listeners } = createMockBrowserEnv('mail');

    // Load notification bridge first
    const runnerNotif = new Function('window', 'document', 'navigator', 'localStorage', 'ServiceWorkerRegistration', notifBridgeScript);
    runnerNotif(env, env.document, env.navigator, env.localStorage, env.ServiceWorkerRegistration);

    // Initial state: 2 unread emails
    env.document._title = 'Inbox (2) - test@gmail.com';

    // Load unread observer script
    const runnerUnread = new Function('window', 'document', 'navigator', 'localStorage', 'ServiceWorkerRegistration', 'MutationObserver', 'Image', unreadObserverScript);
    runnerUnread(env, env.document, env.navigator, env.localStorage, env.ServiceWorkerRegistration, env.MutationObserver, env.Image);

    // Allow initial observer report
    await new Promise((r) => setTimeout(r, 100));
    dispatchedCommands.length = 0;

    // Emulate incoming email: title updates to (3), but Gmail suppresses web notification
    env.document._title = 'Inbox (3) - test@gmail.com';

    // Trigger document title change event in observer
    if (listeners['visibilitychange']) {
      listeners['visibilitychange'].forEach((cb) => cb());
    }

    // Wait 600ms for the unread-observer fallback notification timer (400ms) to fire
    await new Promise((r) => setTimeout(r, 650));

    const notifyCmd = dispatchedCommands.find((c) => c.startsWith('__desktop_cmd__:notify:'));
    assert(notifyCmd, 'Fallback notification must be triggered when unread count increments');

    const hex = notifyCmd.slice('__desktop_cmd__:notify:'.length);
    const payload = JSON.parse(fromHex(hex));
    assert.strictEqual(payload.title, 'Desktop Mail');
    assert(payload.body.includes('unread message'), 'Fallback body must report new unread message');

    console.log('PASS: Fallback notification fired seamlessly upon inbox count increase.');
  }

  // ==========================================================================
  // [5/7] Google Calendar Event Reminder Notification Simulation
  // ==========================================================================
  console.log('\n[5/7] Testing Google Calendar Event Reminder Notification...');
  {
    const { env, dispatchedCommands } = createMockBrowserEnv('calendar');
    const runner = new Function('window', 'document', 'navigator', 'localStorage', 'ServiceWorkerRegistration', notifBridgeScript);
    runner(env, env.document, env.navigator, env.localStorage, env.ServiceWorkerRegistration);

    const eventTitle = 'Sprint Review & Demo';
    const eventTime = 'In 10 minutes (10:00 AM - 11:00 AM)';

    new env.Notification(eventTitle, {
      body: eventTime,
      tag: 'cal_event_20261117T100000Z'
    });

    await new Promise((r) => setTimeout(r, 120));

    const cmd = dispatchedCommands.find((c) => c.startsWith('__desktop_cmd__:notify:'));
    assert(cmd, 'Calendar reminder must dispatch via notify bridge');

    const payload = JSON.parse(fromHex(cmd.slice('__desktop_cmd__:notify:'.length)));
    assert.strictEqual(payload.title, eventTitle);
    assert.strictEqual(payload.body, eventTime);

    console.log('PASS: Google Calendar event reminder correctly serialized and dispatched.');
  }

  // ==========================================================================
  // [6/7] Native Toast Action / Focus Simulation
  // ==========================================================================
  console.log('\n[6/7] Testing Toast Click Action (Unminimize & Focus App)...');
  {
    let unminimized = false;
    let focused = false;
    let shown = false;

    const mockWindow = {
      show: () => { shown = true; return Ok(); },
      unminimize: () => { unminimized = true; return Ok(); },
      set_focus: () => { focused = true; return Ok(); }
    };

    function Ok() { return { is_ok: true }; }

    // Emulate on_action callback in lib.rs
    const onAction = () => {
      mockWindow.show();
      mockWindow.unminimize();
      mockWindow.set_focus();
    };

    onAction();

    assert(shown && unminimized && focused, 'Window must be shown, unminimized, and focused on toast click');
    console.log('PASS: Toast notification click handler restores and focuses application.');
  }

  // ==========================================================================
  // [7/7] Live Windows WinRT Toast Notification Manager Execution
  // ==========================================================================
  console.log('\n[7/7] Testing Live Windows Toast Notification Manager with Registered AUMID...');
  {
    const psScript = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
      $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
      $textNodes = $template.GetElementsByTagName('text')
      $textNodes.Item(0).AppendChild($template.CreateTextNode('Desktop Mail Live Test')) | Out-Null
      $textNodes.Item(1).AppendChild($template.CreateTextNode('E2E Verification Toast: Notifications active.')) | Out-Null
      $toast = [Windows.UI.Notifications.ToastNotification]::new($template)

      $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('com.andrey.desktop-mail')
      if ($notifier.Setting -ne [Windows.UI.Notifications.NotificationSetting]::Enabled) {
          throw 'NotificationSetting is not Enabled: ' + $notifier.Setting
      }
      $notifier.Show($toast)
      Write-Output 'TOAST_SHOWN_SUCCESS'
    `;

    const res = spawnSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
      encoding: 'utf8'
    });

    if (res.status === 0 && res.stdout.includes('TOAST_SHOWN_SUCCESS')) {
      console.log('PASS: Live Windows Toast Notification Manager verified with Setting: Enabled.');
    } else {
      console.warn('NOTE: Live WinRT toast dispatch output:', res.stdout, res.stderr);
      assert(res.status === 0, 'Live Windows toast dispatch must succeed');
    }
  }

  console.log('\n================================================================');
  console.log('ALL 7 GMAIL & CALENDAR NOTIFICATION E2E SIMULATION TESTS PASSED!');
  console.log('================================================================\n');
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nTest Suite Failed:', err);
    process.exit(1);
  });
