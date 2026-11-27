const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

console.log('Running Multi-Account UI & Observer Test Suite...\n');

const root = path.resolve(__dirname, '..');
const titlebarScript = fs.readFileSync(path.join(root, 'shared/scripts/titlebar.js'), 'utf8');
const accountObserverScript = fs.readFileSync(path.join(root, 'shared/scripts/account-observer.js'), 'utf8');
const shellCss = fs.readFileSync(path.join(root, 'shared/styles/shell.css'), 'utf8');

// 1. Trusted Types CSP check
assert(!titlebarScript.includes('.innerHTML'), 'titlebar.js must never use .innerHTML');
assert(!accountObserverScript.includes('.innerHTML'), 'account-observer.js must never use .innerHTML');
assert(!accountObserverScript.includes('insertAdjacentHTML'), 'account-observer.js must never use insertAdjacentHTML');
console.log('[1/4] PASS: Trusted Types CSP compliance verified.');

// 2. Titlebar single-account vs multi-account Jira-style stack
{
  const dom = new JSDOM('<!DOCTYPE html><html><head><title>Shell</title></head><body></body></html>', {
    url: 'https://tauri.localhost/shell.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const { document } = window;
  const invoked = [];

  window.APP_KIND = 'mail';
  window.PRIMARY_HOST = 'mail.google.com';
  window.__DESKTOP_SHELL_ONLY__ = true;
  window.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  window.__TAURI__ = {
    core: {
      invoke: (cmd, args) => {
        invoked.push({ cmd, args });
        if (cmd === 'get_accounts_state') {
          return Promise.resolve({
            active_account_id: 'default',
            accounts: [{ id: 'default', email: 'one@gmail.com', name: 'One', avatar_url: null, unread_count: 2 }],
            notifications_enabled: true
          });
        }
        return Promise.resolve();
      }
    }
  };

  const styleEl = document.createElement('style');
  styleEl.textContent = shellCss;
  document.head.appendChild(styleEl);
  window.eval(titlebarScript);

  const controls = document.getElementById('desktop-custom-titlebar-controls');
  const addBtn = document.getElementById('desktop-caption-add-account');
  const stack = document.getElementById('desktop-account-stack');
  const menuBtn = document.getElementById('desktop-caption-menu');

  assert(addBtn, '+ Add Account button must exist in titlebar');
  assert(stack, 'Account stack container must exist in titlebar');
  assert(menuBtn, 'Hamburger menu button must exist in titlebar');

  // Verify order: addBtn -> stack -> menuBtn
  const children = Array.from(controls.children);
  assert(children.indexOf(addBtn) < children.indexOf(stack), '+ button must appear before avatar stack');
  assert(children.indexOf(stack) < children.indexOf(menuBtn), 'avatar stack must appear between + button and hamburger menu');

  // Single account: stack must NOT be visible and must have 0 circles
  assert(!stack.classList.contains('visible'), 'Stack must be hidden when only 1 account exists');
  assert.strictEqual(stack.children.length, 0, 'Stack must have 0 circles for 1 account');

  addBtn.click();
  assert(invoked.some((c) => c.cmd === 'add_account'), 'Clicking + button must invoke add_account');

  // Multi-account: update state with 3 accounts
  window.__desktop_update_accounts({
    active_account_id: 'acct-2',
    accounts: [
      { id: 'default', email: 'personal@gmail.com', name: 'Personal User', avatar_url: null, unread_count: 3 },
      { id: 'acct-2', email: 'work@company.com', name: 'Work User', avatar_url: 'https://lh3.googleusercontent.com/a/work', unread_count: 4 },
      { id: 'acct-3', email: 'side@gmail.com', name: 'Side Project', avatar_url: null, unread_count: 0 }
    ],
    notifications_enabled: true
  });

  assert(stack.classList.contains('visible'), 'Stack must be visible when 2+ accounts exist');
  assert.strictEqual(stack.children.length, 3, 'Stack must render 3 avatar circles');

  const circles = Array.from(stack.children);
  // Fixed order preserved
  assert.strictEqual(circles[0].getAttribute('data-account-id'), 'default');
  assert.strictEqual(circles[1].getAttribute('data-account-id'), 'acct-2');
  assert.strictEqual(circles[2].getAttribute('data-account-id'), 'acct-3');

  // Jira-style overlap: each next circle has lower z-index than previous
  assert(parseInt(circles[0].style.zIndex, 10) > parseInt(circles[1].style.zIndex, 10));
  assert(parseInt(circles[1].style.zIndex, 10) > parseInt(circles[2].style.zIndex, 10));

  // Active account highlighted
  assert(!circles[0].classList.contains('active'));
  assert(circles[1].classList.contains('active'));

  // Unsigned-in account (no name/email) renders SVG user icon instead of raw number
  window.__desktop_update_accounts({
    active_account_id: 'default',
    accounts: [
      { id: 'default', email: 'personal@gmail.com', name: 'Personal User', avatar_url: null, unread_count: 0 },
      { id: 'acct-2', email: null, name: null, avatar_url: null, unread_count: 0 }
    ],
    notifications_enabled: true
  });
  assert(stack.children[1].querySelector('svg'), 'Unsigned-in fallback circle must render crisp vector user icon');

  // Clicking circle switches account
  stack.children[1].click();
  assert(invoked.some((c) => c.cmd === 'switch_account' && c.args.accountId === 'acct-2'), 'Clicking avatar circle must invoke switch_account');
  console.log('[2/4] PASS: Titlebar single-account vs Jira-style multi-account stack verified.');
}

// 3. Settings Dialog Accounts Tab
{
  const dom = new JSDOM('<!DOCTYPE html><html class="desktop-dialog-window"><head><title>Dialog</title></head><body></body></html>', {
    url: 'https://tauri.localhost/dialog.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const { document } = window;
  const invoked = [];

  window.APP_KIND = 'mail';
  window.PRIMARY_HOST = 'mail.google.com';
  window.__DESKTOP_DIALOG_MODE__ = 'settings';
  window.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  window.__TAURI__ = {
    core: {
      invoke: (cmd, args) => {
        invoked.push({ cmd, args });
        return Promise.resolve();
      }
    }
  };

  window.eval(titlebarScript);
  window.__desktop_update_accounts({
    active_account_id: 'default',
    accounts: [
      { id: 'default', email: 'personal@gmail.com', name: 'Personal', avatar_url: null, unread_count: 5 },
      { id: 'acct-2', email: 'work@company.com', name: 'Work', avatar_url: null, unread_count: 2 }
    ],
    notifications_enabled: true
  });

  window.__desktop_open_dialog_mode('accounts');
  const list = document.getElementById('desktop-accounts-list');
  assert(list, 'Accounts tab must render #desktop-accounts-list');
  assert.strictEqual(list.children.length, 2, 'Accounts tab must list both accounts');
  assert(list.textContent.includes('personal@gmail.com'), 'Must display first account email');
  assert(list.textContent.includes('work@company.com'), 'Must display second account email');
  assert(list.textContent.includes('Active'), 'Must mark active account');
  assert(list.textContent.includes('5 unread'), 'Must display unread count per account in Mail');

  const addInSettings = document.getElementById('desktop-accounts-add-btn');
  assert(addInSettings, 'Accounts tab must have Add account button');
  addInSettings.click();
  assert(invoked.some((c) => c.cmd === 'add_account'), 'Add account button in Settings must invoke add_account');

  const switchBtns = Array.from(list.querySelectorAll('.desktop-account-action-btn')).filter((b) => b.textContent === 'Switch');
  assert.strictEqual(switchBtns.length, 1, 'Non-active account must have Switch button');
  switchBtns[0].click();
  assert(invoked.some((c) => c.cmd === 'switch_account' && c.args.accountId === 'acct-2'));

  const removeBtns = Array.from(list.querySelectorAll('.desktop-account-action-btn.danger'));
  assert.strictEqual(removeBtns.length, 2, 'Both accounts must have Remove button when 2+ accounts exist');
  removeBtns[1].click();
  assert(invoked.some((c) => c.cmd === 'remove_account' && c.args.accountId === 'acct-2'));

  console.log('[3/4] PASS: Settings dialog Accounts tab verified.');
}

// 4. Account Observer Profile Extraction (including invisible chars & ", Google membership" stripping)
{
  const dom = new JSDOM(`<!DOCTYPE html><html><head><title>Inbox (4) - test@gmail.com - Gmail</title></head><body>
    <header>
      <a aria-label="Google Account: Andrey Eremin\u00A0\u200B(andrey@example.com), Google membership" href="https://accounts.google.com/SignOutOptions">
        <img src="https://lh3.googleusercontent.com/a/avatar123=s64" />
      </a>
    </header>
  </body></html>`, {
    url: 'https://mail.google.com/mail/u/0/',
    runScripts: 'outside-only'
  });
  const { window } = dom;
  const { document } = window;
  const cmds = [];
  const origTitleDesc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(document), 'title')
    || Object.getOwnPropertyDescriptor(document, 'title');

  let titleVal = document.title;
  Object.defineProperty(document, 'title', {
    get: () => titleVal,
    set: (v) => {
      titleVal = v;
      if (typeof v === 'string' && v.startsWith('__desktop_cmd__:profile:')) {
        cmds.push(v);
      }
    },
    configurable: true
  });

  window.eval(accountObserverScript);

  setTimeout(() => {
    assert(cmds.length >= 1, 'Account observer must emit profile command');
    const hex = cmds[0].replace('__desktop_cmd__:profile:', '');
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    const parsed = JSON.parse(Buffer.from(bytes).toString('utf8'));
    assert.strictEqual(parsed.email, 'andrey@example.com');
    assert.strictEqual(parsed.name, 'Andrey Eremin');
    assert.strictEqual(parsed.avatar_url, 'https://lh3.googleusercontent.com/a/avatar123=s64');
    console.log('[4/4] PASS: Account observer profile extraction verified.');
    console.log('\nALL MULTI-ACCOUNT UI & OBSERVER TESTS PASSED!');
    process.exit(0);
  }, 650);
}
