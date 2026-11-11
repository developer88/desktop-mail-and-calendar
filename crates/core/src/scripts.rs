pub const WIN11_THEME_CSS: &str = include_str!("../../../shared/styles/win11-theme.css");
pub const DECLUTTER_CSS: &str = include_str!("../../../shared/styles/declutter.css");
pub const NAVIGATION_INTERCEPTOR_SCRIPT: &str =
    include_str!("../../../shared/scripts/navigation-interceptor.js");
pub const UNREAD_OBSERVER_SCRIPT: &str = include_str!("../../../shared/scripts/unread-observer.js");
pub const TITLEBAR_SCRIPT: &str = include_str!("../../../shared/scripts/titlebar.js");

/// Constructs the complete consolidated JavaScript bundle injected into the webview on page initialization
pub fn get_injected_bundle() -> String {
    let escaped_theme = WIN11_THEME_CSS.replace('\\', "\\\\").replace('`', "\\`");
    let escaped_declutter = DECLUTTER_CSS.replace('\\', "\\\\").replace('`', "\\`");

    format!(
        r#"
(function() {{
    // Google Authentication Guard:
    // When on Google OAuth, Accounts, or Sign-In screens, do NOT alter Google DOM,
    // intercept navigation, or override window.open. Keeps auth flow 100% untouched.
    function isGoogleAuthFlow() {{
        try {{
            var host = (window.location.hostname || '').toLowerCase();
            var path = (window.location.pathname || '').toLowerCase();
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

    if (!isGoogleAuthFlow()) {{
        function applyStyles() {{
            if (document.getElementById('desktop-google-theme')) return;
            var styleEl = document.createElement('style');
            styleEl.id = 'desktop-google-theme';
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
    if (!isGoogleAuthFlow()) {{
        {nav}
        {unread}
    }}
}})();
"#,
        theme = escaped_theme,
        declutter = escaped_declutter,
        nav = NAVIGATION_INTERCEPTOR_SCRIPT,
        unread = UNREAD_OBSERVER_SCRIPT,
        titlebar = TITLEBAR_SCRIPT,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_injected_bundle_generation() {
        let bundle = get_injected_bundle();
        assert!(bundle.contains("isGoogleAuthFlow"));
        assert!(bundle.contains("desktop-google-theme"));
        assert!(bundle.contains("initNavigationInterceptor"));
        assert!(bundle.contains("initUnreadObserver"));
        assert!(bundle.contains("initTitlebarOverlay"));
        assert!(bundle.contains("Segoe UI Variable Text"));
        assert!(bundle.contains("desktop_first_run_completed"));
        assert!(bundle.contains("desktop-splash-overlay"));
    }
}
