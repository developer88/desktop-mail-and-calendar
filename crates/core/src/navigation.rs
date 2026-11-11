use crate::config::AppKind;
use url::Url;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UrlCategory {
    InApp,
    Auth,
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
        || host.starts_with("accounts.google.")
        || host == "accounts.youtube.com"
        || host == "myaccount.google.com"
        || host == "oauth2.googleapis.com"
        || host == "apis.google.com"
        || ((host == "google.com" || host == "www.google.com")
            && (parsed.path().starts_with("/accounts")
                || parsed.path().starts_with("/signin")
                || parsed.path().starts_with("/gmail")
                || parsed.path().starts_with("/calendar")
                || parsed.path().starts_with("/ServiceLogin")
                || parsed.path().starts_with("/CheckCookie")
                || parsed.path().starts_with("/SetOSID")
                || parsed.path().starts_with("/_/signin")
                || parsed.path().contains("signinchooser")))
    {
        return UrlCategory::Auth;
    }

    // Google API, static resources, and companion services required by web clients
    if host.ends_with(".googleapis.com")
        || host == "googleapis.com"
        || host.ends_with(".gstatic.com")
        || host == "gstatic.com"
        || host.ends_with(".googleusercontent.com")
        || host == "googleusercontent.com"
        || host.starts_with("clients") && host.ends_with(".google.com")
        || host == "ogs.google.com"
        || host == "play.google.com"
        || host == "contacts.google.com"
        || host == "tasks.google.com"
        || host == "keep.google.com"
        || host == "meet.google.com"
    {
        return UrlCategory::InApp;
    }

    // App-specific internal domains
    match app_kind {
        AppKind::Mail => {
            if host == "mail.google.com" || host == "chat.google.com" {
                return UrlCategory::InApp;
            }
        }
        AppKind::Calendar => {
            if host == "calendar.google.com" {
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
    fn test_internal_mail_navigation() {
        assert_eq!(
            classify_url("https://mail.google.com/mail/u/0/#inbox", AppKind::Mail),
            UrlCategory::InApp
        );
        assert!(!should_open_in_external_browser(
            "https://mail.google.com/mail/u/0/#inbox",
            AppKind::Mail
        ));
    }

    #[test]
    fn test_auth_keeps_in_app() {
        let auth_urls = [
            "https://accounts.google.com/signin/v2/identifier",
            "https://accounts.google.de/signin/challenge/pwd",
            "https://accounts.youtube.com/accounts/SetSID",
            "https://www.google.com/accounts/SetOSID?continue=https://mail.google.com",
            "https://www.google.com/CheckCookie?continue=https://mail.google.com",
            "https://www.google.com/ServiceLogin?service=mail",
        ];

        for url in auth_urls {
            assert_eq!(
                classify_url(url, AppKind::Mail),
                UrlCategory::Auth,
                "Expected {url} to be classified as Auth for Mail"
            );
            assert!(
                !should_open_in_external_browser(url, AppKind::Mail),
                "Expected {url} to stay in-app"
            );
        }
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
                classify_url(url, AppKind::Mail),
                UrlCategory::External,
                "Expected {url} to be classified as External for Mail"
            );
            assert!(
                should_open_in_external_browser(url, AppKind::Mail),
                "Expected {url} to open in external browser"
            );
        }
    }

    #[test]
    fn test_mailto_classification() {
        assert_eq!(
            classify_url("mailto:support@example.com", AppKind::Mail),
            UrlCategory::Mailto
        );
        assert!(!should_open_in_external_browser(
            "mailto:support@example.com",
            AppKind::Mail
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

    #[test]
    fn test_google_infrastructure_endpoints_stay_in_app() {
        let infra_urls = [
            "https://clients6.google.com/calendar/v3/users/me/calendarList",
            "https://clients4.google.com/inbox/sync",
            "https://tasks.google.com/embed",
            "https://keep.google.com/u/0",
            "https://contacts.google.com/widget",
            "https://ogs.google.com/widget/app",
            "https://play.google.com/log",
            "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2",
            "https://lh3.googleusercontent.com/a/default-user=s64",
        ];

        for url in infra_urls {
            assert_eq!(
                classify_url(url, AppKind::Calendar),
                UrlCategory::InApp,
                "Expected {url} to be classified as InApp for Calendar"
            );
            assert!(
                !should_open_in_external_browser(url, AppKind::Calendar),
                "Expected {url} to stay in-app for Calendar"
            );

            assert_eq!(
                classify_url(url, AppKind::Mail),
                UrlCategory::InApp,
                "Expected {url} to be classified as InApp for Mail"
            );
            assert!(
                !should_open_in_external_browser(url, AppKind::Mail),
                "Expected {url} to stay in-app for Mail"
            );
        }
    }
}
