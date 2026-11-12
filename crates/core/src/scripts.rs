use crate::config::AppKind;

pub const WIN11_THEME_CSS: &str = include_str!("../../../shared/styles/win11-theme.css");
pub const DECLUTTER_CSS: &str = include_str!("../../../shared/styles/declutter.css");
pub const NAVIGATION_INTERCEPTOR_SCRIPT: &str =
    include_str!("../../../shared/scripts/navigation-interceptor.js");
pub const UNREAD_OBSERVER_SCRIPT: &str = include_str!("../../../shared/scripts/unread-observer.js");
pub const CALENDAR_DATE_SCRIPT: &str =
    include_str!("../../../shared/scripts/calendar-date-observer.js");
pub const TITLEBAR_SCRIPT: &str = include_str!("../../../shared/scripts/titlebar.js");

/// Constructs the complete consolidated JavaScript bundle injected into the webview on page initialization
pub fn get_injected_bundle(app_kind: AppKind) -> String {
    let app_kind_str = match app_kind {
        AppKind::Mail => "mail",
        AppKind::Calendar => "calendar",
    };
    let primary_host = match app_kind {
        AppKind::Mail => "mail.google.com",
        AppKind::Calendar => "calendar.google.com",
    };

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

    if (!isAuthFlow()) {{
        function applyStyles() {{
            if (document.getElementById('desktop-theme')) return;
            var styleEl = document.createElement('style');
            styleEl.id = 'desktop-theme';
            styleEl.textContent = `{theme}\n{declutter}`;
            (document.head || document.documentElement).appendChild(styleEl);
        }}

        if (document.readyState === 'loading') {{
            document.addEventListener('DOMContentLoaded', applyStyles);
        }} else {{
            applyStyles();
        }}
    }}

    // Titlebar: Always provide native Windows 11 window controls (drag, minimize, maximize, close)
    {titlebar}

    // Interactive interceptors: only active within the main app
    if (!isAuthFlow()) {{
        {nav}
        {unread}
    }}
}})();
"#,
        app_kind_str = app_kind_str,
        primary_host = primary_host,
        theme = escaped_theme,
        declutter = escaped_declutter,
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
        let bundle = get_injected_bundle(AppKind::Mail);
        assert!(bundle.contains("APP_KIND = \"mail\""));
        assert!(bundle.contains("PRIMARY_HOST = \"mail.google.com\""));
        assert!(bundle.contains("window.self !== window.top"));
        assert!(bundle.contains("isAuthFlow"));
        assert!(bundle.contains("desktop-theme"));
        assert!(bundle.contains("initNavigationInterceptor"));
        assert!(bundle.contains("initUnreadObserver"));
        assert!(bundle.contains("initTitlebarOverlay"));
        assert!(bundle.contains("Segoe UI Variable Text"));
        assert!(bundle.contains("desktop_first_run_completed"));
        assert!(bundle.contains("desktop-splash-overlay"));

        let cal_bundle = get_injected_bundle(AppKind::Calendar);
        assert!(cal_bundle.contains("APP_KIND = \"calendar\""));
        assert!(cal_bundle.contains("PRIMARY_HOST = \"calendar.google.com\""));
    }
}
