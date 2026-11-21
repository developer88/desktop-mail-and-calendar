use crate::config::AppKind;

pub const SHELL_CSS: &str = include_str!("../../../shared/styles/shell.css");
pub const WIN11_THEME_CSS: &str = include_str!("../../../shared/styles/win11-theme.css");
pub const DECLUTTER_CSS: &str = include_str!("../../../shared/styles/declutter.css");
pub const NAVIGATION_INTERCEPTOR_SCRIPT: &str =
    include_str!("../../../shared/scripts/navigation-interceptor.js");
pub const UNREAD_OBSERVER_SCRIPT: &str = include_str!("../../../shared/scripts/unread-observer.js");
pub const CALENDAR_DATE_SCRIPT: &str =
    include_str!("../../../shared/scripts/calendar-date-observer.js");
pub const NOTIFICATION_BRIDGE_SCRIPT: &str =
    include_str!("../../../shared/scripts/notification-bridge.js");
pub const TITLEBAR_SCRIPT: &str = include_str!("../../../shared/scripts/titlebar.js");

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct NotificationPayload {
    pub title: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub tag: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub silent: Option<bool>,
}

/// Decodes hex string into UTF-8 string
pub fn from_hex(hex: &str) -> Option<String> {
    if hex.len() % 2 != 0 {
        return None;
    }
    let mut bytes = Vec::with_capacity(hex.len() / 2);
    for i in (0..hex.len()).step_by(2) {
        let b = u8::from_str_radix(&hex[i..i + 2], 16).ok()?;
        bytes.push(b);
    }
    String::from_utf8(bytes).ok()
}

/// Encodes UTF-8 string into hex string
pub fn to_hex(s: &str) -> String {
    s.as_bytes().iter().map(|b| format!("{:02x}", b)).collect()
}

/// Constructs the complete consolidated JavaScript bundle injected into the webview on page initialization
pub fn get_injected_bundle(app_kind: AppKind, is_first_run: bool) -> String {
    let app_kind_str = match app_kind {
        AppKind::Mail => "mail",
        AppKind::Calendar => "calendar",
    };
    let primary_host = match app_kind {
        AppKind::Mail => "mail.google.com",
        AppKind::Calendar => "calendar.google.com",
    };

    let accent = crate::theme::get_windows_accent_color();
    let accent_css = crate::theme::generate_accent_css(&accent);
    let escaped_accent = accent_css.replace('\\', "\\\\").replace('`', "\\`");
    let accent_hex = accent.to_hex_rgb();

    let escaped_shell = SHELL_CSS.replace('\\', "\\\\").replace('`', "\\`");
    let escaped_theme = WIN11_THEME_CSS.replace('\\', "\\\\").replace('`', "\\`");
    let escaped_declutter = DECLUTTER_CSS.replace('\\', "\\\\").replace('`', "\\`");
    let unread_script = match app_kind {
        AppKind::Mail => UNREAD_OBSERVER_SCRIPT,
        AppKind::Calendar => CALENDAR_DATE_SCRIPT,
    };

    format!(
        r#"
(function() {{
    window.__DESKTOP_APP_KIND__ = "{app_kind_str}";
    window.__DESKTOP_FIRST_RUN__ = {is_first_run};
    window.__DESKTOP_ACCENT_COLOR__ = {{
        hex: "{accent_hex}",
        r: {accent_r},
        g: {accent_g},
        b: {accent_b},
        a: {accent_a}
    }};
    var APP_KIND = "{app_kind_str}";
    var PRIMARY_HOST = "{primary_host}";

    // 1. Multi-Layer Subframe / Iframe / Companion Guard:
    // Never inject the desktop shell, titlebar, or modals into:
    // - Subframes or child iframes (window.self !== window.top)
    // - Embedded companion sidebars (e.g. companion inside mail)
    // - Non-primary service hosts (e.g. Mail must NEVER inject into calendar.google.com)
    try {{
        if (window.self !== window.top || window.parent !== window || window.frameElement) {{
            return;
        }}
    }} catch (_) {{
        return;
    }}

    var host = (window.location.hostname || '').toLowerCase();
    var path = (window.location.pathname || '').toLowerCase();
    var search = (window.location.search || '').toLowerCase();

    // Block embedded widgets / sidebars / companion panels
    if (search.includes('companion') || search.includes('embed') || path.includes('/embed') || path.includes('/htmlembed')) {{
        return;
    }}

    // Block injection into cross-service hosts (Mail app only runs on Mail, Calendar only on Calendar)
    if (host !== PRIMARY_HOST && !host.includes('accounts.google.') && host !== 'accounts.google.com') {{
        return;
    }}

    // 2. Authentication Flow Guard:
    // When on OAuth, Accounts, or Sign-In screens, do NOT alter DOM,
    // intercept navigation, or override window.open. Keeps auth flow 100% untouched.
    function isAuthFlow() {{
        try {{
            if (host === 'accounts.google.com' || host.startsWith('accounts.google.') || host === 'myaccount.google.com') {{
                return true;
            }}
            if ((host === 'google.com' || host === 'www.google.com') &&
                (path.startsWith('/accounts') || path.startsWith('/signin') || path.startsWith('/servicelogin') || path.includes('signinchooser'))) {{
                return true;
            }}
        }} catch (_) {{}}
        return false;
    }}

    // Shell UI styles: Titlebar, Personalization Accent, and first-run Welcome modal styles are ALWAYS applied
    // so wrapper controls and the welcome screen are properly rendered even during sign-in.
    function applyShellStyles() {{
        if (!document.getElementById('desktop-accent-theme')) {{
            var target = document.head || document.documentElement;
            if (target) {{
                var accentStyleEl = document.createElement('style');
                accentStyleEl.id = 'desktop-accent-theme';
                accentStyleEl.textContent = `{accent}`;
                target.appendChild(accentStyleEl);
            }}
        }}
        if (document.getElementById('desktop-shell-theme')) return;
        var target = document.head || document.documentElement;
        if (target) {{
            var styleEl = document.createElement('style');
            styleEl.id = 'desktop-shell-theme';
            styleEl.textContent = `{shell}`;
            target.appendChild(styleEl);
        }}
    }}
    applyShellStyles();
    if (document.readyState === 'loading') {{
        document.addEventListener('DOMContentLoaded', applyShellStyles);
    }}

    if (!isAuthFlow()) {{
        function applyStyles() {{
            if (document.getElementById('desktop-theme')) return;
            var target = document.head || document.documentElement;
            if (target) {{
                var styleEl = document.createElement('style');
                styleEl.id = 'desktop-theme';
                styleEl.textContent = `{theme}\n{declutter}`;
                target.appendChild(styleEl);

                var accentEl = document.getElementById('desktop-accent-theme');
                if (accentEl) {{
                    target.appendChild(accentEl);
                }}
            }}
        }}

        applyStyles();
        if (document.readyState === 'loading') {{
            document.addEventListener('DOMContentLoaded', applyStyles);
        }}
    }}

    // Titlebar: Always provide native Windows 11 window controls (drag, minimize, maximize, close)
    {titlebar}

    // Interactive interceptors: only active within the main app
    if (!isAuthFlow()) {{
        {notif}
        {nav}
        {unread}
    }}
}})();
"#,
        app_kind_str = app_kind_str,
        is_first_run = is_first_run,
        primary_host = primary_host,
        accent_hex = accent_hex,
        accent_r = accent.r,
        accent_g = accent.g,
        accent_b = accent.b,
        accent_a = accent.a,
        accent = escaped_accent,
        shell = escaped_shell,
        theme = escaped_theme,
        declutter = escaped_declutter,
        notif = NOTIFICATION_BRIDGE_SCRIPT,
        nav = NAVIGATION_INTERCEPTOR_SCRIPT,
        unread = unread_script,
        titlebar = TITLEBAR_SCRIPT,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_injected_bundle_generation() {
        let bundle = get_injected_bundle(AppKind::Mail, true);
        assert!(bundle.contains("APP_KIND = \"mail\""));
        assert!(bundle.contains("PRIMARY_HOST = \"mail.google.com\""));
        assert!(bundle.contains("window.__DESKTOP_FIRST_RUN__ = true"));
        assert!(bundle.contains("window.self !== window.top"));
        assert!(bundle.contains("isAuthFlow"));
        assert!(bundle.contains("desktop-shell-theme"));
        assert!(bundle.contains("desktop-accent-theme"));
        assert!(bundle.contains("window.__DESKTOP_ACCENT_COLOR__"));
        assert!(bundle.contains("desktop-theme"));
        assert!(bundle.contains("initNavigationInterceptor"));
        assert!(bundle.contains("initUnreadObserver"));
        assert!(bundle.contains("initTitlebarOverlay"));
        assert!(bundle.contains("Segoe UI Variable Text"));
        assert!(bundle.contains("desktop_first_run_completed"));
        assert!(bundle.contains("desktop-splash-overlay"));

        assert!(bundle.contains("DesktopNotification"));
        assert!(bundle.contains("__desktop_last_notif_time"));
        assert!(bundle.contains("isNotificationsAllowed"));

        let cal_bundle = get_injected_bundle(AppKind::Calendar, false);
        assert!(cal_bundle.contains("DesktopNotification"));
        assert!(cal_bundle.contains("APP_KIND = \"calendar\""));
        assert!(cal_bundle.contains("PRIMARY_HOST = \"calendar.google.com\""));
        assert!(cal_bundle.contains("window.__DESKTOP_FIRST_RUN__ = false"));
        assert!(cal_bundle.contains("initCalendarDateObserver"));
        assert!(cal_bundle.contains("#15803d"));
        assert!(!CALENDAR_DATE_SCRIPT.contains("#1a73e8"));
    }

    #[test]
    fn test_zero_inner_html_in_injected_bundles() {
        for kind in [AppKind::Mail, AppKind::Calendar] {
            let bundle = get_injected_bundle(kind, true);
            assert!(
                !bundle.contains(".innerHTML"),
                "Bundle for {:?} must not contain .innerHTML (violates Google Trusted Types CSP)",
                kind
            );
            assert!(
                !bundle.contains(".outerHTML"),
                "Bundle for {:?} must not contain .outerHTML (violates Google Trusted Types CSP)",
                kind
            );
            assert!(
                !bundle.contains("insertAdjacentHTML"),
                "Bundle for {:?} must not contain insertAdjacentHTML (violates Google Trusted Types CSP)",
                kind
            );
        }
    }

    #[test]
    fn test_bundle_version_matches_cargo_pkg_version() {
        let pkg_version = env!("CARGO_PKG_VERSION");
        for kind in [AppKind::Mail, AppKind::Calendar] {
            let bundle = get_injected_bundle(kind, true);
            assert!(
                bundle.contains(&format!("currentVer = '{}'", pkg_version)),
                "Bundle for {:?} must contain currentVer = '{}'",
                kind,
                pkg_version
            );
            assert!(
                bundle.contains(&format!("verNum.textContent = '{}'", pkg_version)),
                "Bundle for {:?} must display Build Version {}",
                kind,
                pkg_version
            );
        }
    }

    #[test]
    fn test_notification_hex_encoding_and_serialization() {
        let payload = NotificationPayload {
            title: "Andrey: New Mail! 🎉".to_string(),
            body: Some("Hey Andrey, let's meet tomorrow!\nBest regards.".to_string()),
            tag: Some("msg_12345".to_string()),
            icon: Some("https://mail.google.com/icon.png".to_string()),
            silent: Some(false),
        };

        let json = serde_json::to_string(&payload).expect("Serialization failed");
        let hex = to_hex(&json);
        assert_eq!(hex.len() % 2, 0);

        let decoded = from_hex(&hex).expect("Hex decoding failed");
        assert_eq!(decoded, json);

        let roundtrip: NotificationPayload =
            serde_json::from_str(&decoded).expect("Deserialization failed");
        assert_eq!(roundtrip, payload);

        // Edge cases
        assert!(from_hex("odd").is_none());
        assert!(from_hex("zz").is_none());
        assert_eq!(from_hex("").unwrap(), "");
    }
}
