pub const NAVIGATION_INTERCEPTOR_SCRIPT: &str = r#"
(function() {
    window.addEventListener('click', function(e) {
        var target = e.target;
        while (target && target.tagName !== 'A') {
            target = target.parentElement;
        }
        if (!target || !target.href) return;
        
        var href = target.href;
        if (href.startsWith('mailto:')) {
            e.preventDefault();
            if (window.__TAURI__ && window.__TAURI__.core) {
                window.__TAURI__.core.invoke('handle_mailto', { mailto: href });
            }
            return;
        }

        try {
            var url = new URL(href);
            var isInternal = (
                url.hostname === 'mail.google.com' ||
                url.hostname === 'calendar.google.com' ||
                url.hostname === 'accounts.google.com' ||
                url.hostname === 'contacts.google.com' ||
                url.hostname === 'meet.google.com'
            );

            if (!isInternal && (url.protocol === 'http:' || url.protocol === 'https:')) {
                e.preventDefault();
                e.stopPropagation();
                if (window.__TAURI__ && window.__TAURI__.core) {
                    window.__TAURI__.core.invoke('open_external_url', { url: href });
                }
            }
        } catch (_) {}
    }, true);
})();
"#;

pub const UNREAD_OBSERVER_SCRIPT: &str = r#"
(function() {
    function checkUnread() {
        var match = document.title.match(/\((\d+)\)/);
        var count = match ? parseInt(match[1], 10) : 0;
        if (window.__TAURI__ && window.__TAURI__.core) {
            window.__TAURI__.core.invoke('update_unread_badge', { count: count });
        }
    }

    var observer = new MutationObserver(function() {
        checkUnread();
    });

    var titleEl = document.querySelector('title');
    if (titleEl) {
        observer.observe(titleEl, { childList: true });
    }
    checkUnread();
})();
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scripts_not_empty() {
        assert!(NAVIGATION_INTERCEPTOR_SCRIPT.contains("open_external_url"));
        assert!(NAVIGATION_INTERCEPTOR_SCRIPT.contains("handle_mailto"));
        assert!(UNREAD_OBSERVER_SCRIPT.contains("update_unread_badge"));
    }
}
