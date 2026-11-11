use crate::config::AppKind;
use url::Url;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UrlCategory {
    InApp,
    GoogleAuth,
    Mailto,
    External,
}

pub fn classify_url(raw_url: &str, app_kind: AppKind) -> UrlCategory {
    if raw_url.starts_with("mailto:") {
        return UrlCategory::Mailto;
    }

    let parsed = match Url::parse(raw_url) {
        Ok(u) => u,
        Err(_) => return UrlCategory::External,
    };

    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return UrlCategory::External;
    }

    let host = match parsed.host_str() {
        Some(h) => h.to_lowercase(),
        None => return UrlCategory::External,
    };

    // Authentication & identity domains must remain in-app
    if host == "accounts.google.com"
        || host == "myaccount.google.com"
        || host == "oauth2.googleapis.com"
        || host == "apis.google.com"
        || host == "gstatic.com"
        || host.ends_with(".gstatic.com")
        || host == "googleusercontent.com"
        || host.ends_with(".googleusercontent.com")
        || ((host == "google.com" || host == "www.google.com")
            && (parsed.path().starts_with("/accounts")
                || parsed.path().starts_with("/signin")
                || parsed.path().starts_with("/gmail")
                || parsed.path().contains("signinchooser")))
    {
        return UrlCategory::GoogleAuth;
    }

    // App-specific internal domains
    match app_kind {
        AppKind::Gmail => {
            if host == "mail.google.com"
                || host == "contacts.google.com"
                || host == "chat.google.com"
            {
                return UrlCategory::InApp;
            }
        }
        AppKind::Calendar => {
            if host == "calendar.google.com"
                || host == "meet.google.com"
                || host == "contacts.google.com"
            {
                return UrlCategory::InApp;
            }
        }
    }

    UrlCategory::External
}

pub fn should_open_in_external_browser(raw_url: &str, app_kind: AppKind) -> bool {
    matches!(classify_url(raw_url, app_kind), UrlCategory::External)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_internal_gmail_navigation() {
        assert_eq!(
            classify_url("https://mail.google.com/mail/u/0/#inbox", AppKind::Gmail),
            UrlCategory::InApp
        );
        assert!(!should_open_in_external_browser(
            "https://mail.google.com/mail/u/0/#inbox",
            AppKind::Gmail
        ));
    }

    #[test]
    fn test_auth_keeps_in_app() {
        assert_eq!(
            classify_url(
                "https://accounts.google.com/signin/v2/identifier",
                AppKind::Gmail
            ),
            UrlCategory::GoogleAuth
        );
        assert!(!should_open_in_external_browser(
            "https://accounts.google.com/signin/v2/identifier",
            AppKind::Gmail
        ));
    }

    #[test]
    fn test_external_links_redirect() {
        let external_urls = [
            "https://github.com/rust-lang/rust",
            "https://nytimes.com/article",
            "http://example.org",
            "https://amazon.com/dp/123",
        ];

        for url in external_urls {
            assert_eq!(
                classify_url(url, AppKind::Gmail),
                UrlCategory::External,
                "Expected {url} to be classified as External for Gmail"
            );
            assert!(
                should_open_in_external_browser(url, AppKind::Gmail),
                "Expected {url} to open in external browser"
            );
        }
    }

    #[test]
    fn test_mailto_classification() {
        assert_eq!(
            classify_url("mailto:support@example.com", AppKind::Gmail),
            UrlCategory::Mailto
        );
        assert!(!should_open_in_external_browser(
            "mailto:support@example.com",
            AppKind::Gmail
        ));
    }

    #[test]
    fn test_calendar_classification() {
        assert_eq!(
            classify_url(
                "https://calendar.google.com/calendar/u/0/r",
                AppKind::Calendar
            ),
            UrlCategory::InApp
        );
        assert_eq!(
            classify_url("https://meet.google.com/abc-defg-hij", AppKind::Calendar),
            UrlCategory::InApp
        );
        assert_eq!(
            classify_url("https://zoom.us/j/123456", AppKind::Calendar),
            UrlCategory::External
        );
    }
}
