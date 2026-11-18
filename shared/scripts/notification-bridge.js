/**
 * notification-bridge.js
 * Native Web Notification Bridge for Desktop Google Apps (Mail & Calendar)
 *
 * Implements the W3C Web Notifications API specifications:
 * - window.Notification (constructor, static permission getter, requestPermission, maxActions)
 * - navigator.permissions.query({ name: 'notifications' })
 * - ServiceWorkerRegistration.prototype.showNotification
 *
 * Dispatches web notifications cleanly and securely to the native Windows Action Center
 * via a CSP-compliant, queue-managed document.title bridge.
 */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  // Track the timestamp of the last dispatched notification to coordinate with unread-observer
  window.__desktop_last_notif_time = 0;

  function isNotificationsAllowed() {
    try {
      return localStorage.getItem('desktop_pref_notifications_enabled') !== 'false';
    } catch (_) {
      return true;
    }
  }

  // Queue to serialize rapid notifications and avoid document.title collisions
  const dispatchQueue = [];
  let isDispatching = false;

  function processDispatchQueue() {
    if (dispatchQueue.length === 0) {
      isDispatching = false;
      return;
    }
    isDispatching = true;
    const item = dispatchQueue.shift();

    try {
      const jsonStr = JSON.stringify(item);
      const encoder = new TextEncoder();
      const bytes = encoder.encode(jsonStr);
      let hex = '';
      for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }

      const prevTitle = document.title.startsWith('__desktop_cmd__:') ? '' : document.title;
      document.title = '__desktop_cmd__:notify:' + hex;

      // Give WebView2 adequate time (60ms) to deliver document.title change to host
      setTimeout(() => {
        if (prevTitle && document.title.startsWith('__desktop_cmd__:')) {
          document.title = prevTitle;
        }
        setTimeout(processDispatchQueue, 20);
      }, 60);
    } catch (err) {
      console.warn('[NotificationBridge] Failed to encode notification:', err);
      setTimeout(processDispatchQueue, 40);
    }
  }

  function sendNativeNotification(payload) {
    if (!isNotificationsAllowed()) return;
    window.__desktop_last_notif_time = Date.now();

    // Dispatch through the queue-managed document.title bridge so the Rust host
    // renders a styled Windows 11 ToastGeneric notification with appLogoOverride,
    // proper AUMID header icon, and click-to-focus activation.
    dispatchQueue.push(payload);
    if (!isDispatching) {
      processDispatchQueue();
    }
  }

  // Base EventTarget class
  const EventTargetBase = typeof EventTarget !== 'undefined'
    ? EventTarget
    : class {
        constructor() {
          this._listeners = {};
        }
        addEventListener(type, cb) {
          if (!this._listeners[type]) this._listeners[type] = [];
          this._listeners[type].push(cb);
        }
        removeEventListener(type, cb) {
          if (!this._listeners[type]) return;
          this._listeners[type] = this._listeners[type].filter((fn) => fn !== cb);
        }
        dispatchEvent(event) {
          const list = this._listeners[event.type] || [];
          for (let i = 0; i < list.length; i++) {
            try { list[i].call(this, event); } catch (_) {}
          }
          return true;
        }
      };

  class DesktopNotification extends EventTargetBase {
    constructor(title, options) {
      super();
      options = options || {};
      this.title = String(title || '');
      this.body = options.body ? String(options.body) : '';
      this.icon = options.icon ? String(options.icon) : '';
      this.tag = options.tag ? String(options.tag) : '';
      this.data = options.data !== undefined ? options.data : null;
      this.silent = Boolean(options.silent);

      this.onclick = null;
      this.onclose = null;
      this.onerror = null;
      this.onshow = null;

      if (DesktopNotification.permission === 'granted') {
        sendNativeNotification({
          title: this.title,
          body: this.body,
          icon: this.icon,
          tag: this.tag,
          silent: this.silent
        });
      }

      setTimeout(() => {
        try {
          if (typeof this.onshow === 'function') this.onshow();
          const ev = typeof Event === 'function' ? new Event('show') : { type: 'show' };
          this.dispatchEvent(ev);
        } catch (_) {}
      }, 0);
    }

    close() {
      try {
        if (typeof this.onclose === 'function') this.onclose();
        const ev = typeof Event === 'function' ? new Event('close') : { type: 'close' };
        this.dispatchEvent(ev);
      } catch (_) {}
    }
  }

  Object.defineProperty(DesktopNotification, 'permission', {
    get: function () {
      return isNotificationsAllowed() ? 'granted' : 'denied';
    },
    enumerable: true,
    configurable: true
  });

  Object.defineProperty(DesktopNotification, 'maxActions', {
    get: function () {
      return 2;
    },
    enumerable: true,
    configurable: true
  });

  DesktopNotification.requestPermission = function (callback) {
    const perm = DesktopNotification.permission;
    if (typeof callback === 'function') {
      try { callback(perm); } catch (_) {}
    }
    return Promise.resolve(perm);
  };

  DesktopNotification.toString = function () {
    return 'function Notification() { [native code] }';
  };

  // Override window.Notification
  try {
    Object.defineProperty(window, 'Notification', {
      value: DesktopNotification,
      writable: true,
      configurable: true,
      enumerable: false
    });
  } catch (_) {
    window.Notification = DesktopNotification;
  }

  // Intercept navigator.permissions.query for notifications
  if (typeof navigator !== 'undefined' && navigator.permissions && typeof navigator.permissions.query === 'function') {
    const origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function (desc) {
      if (desc && desc.name === 'notifications') {
        const permStatus = {
          name: 'notifications',
          state: DesktopNotification.permission,
          onchange: null,
          addEventListener: function () {},
          removeEventListener: function () {},
          dispatchEvent: function () { return false; }
        };
        return Promise.resolve(permStatus);
      }
      return origQuery(desc);
    };
  }

  // Intercept ServiceWorkerRegistration.prototype.showNotification if present
  if (typeof ServiceWorkerRegistration !== 'undefined' && ServiceWorkerRegistration.prototype) {
    ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
      return new Promise(function (resolve) {
        try {
          new DesktopNotification(title, options);
        } catch (_) {}
        resolve();
      });
    };
  }
})();
