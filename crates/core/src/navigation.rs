use crate::config::AppKind;
use url::Url;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UrlCategory {
    InApp,
    Auth,
    Mailto,
    External,
}

/// Identifies whether a given hostname belongs to the first-party Google ecosystem.
///
/// Rather than maintaining an exhaustive and fragile whitelist of individual subdomains
/// (which breaks when Google adds or changes internal API subdomains like `calendar-pa.clients6.google.com`),
/// we verify whether the host is legitimately owned by Google:
/// 1. Well-known Google infrastructure and top-level service base domains (and any of their subdomains).
/// 2. Google's `.google` top-level domain.
/// 3. Regional Google ccTLDs (e.g. `google.de`, `calendar.google.co.uk`, `accounts.google.co.jp`).
pub fn is_google_host(host: &str) -> bool {
    let host = host.trim().to_lowercase();
    if host.is_empty() {
        return false;
    }

    // Direct matches or subdomains of well-known Google base domains
    const GOOGLE_BASE_DOMAINS: &[&str] = &[
        "google.com",
        "googleapis.com",
        "gstatic.com",
        "googleusercontent.com",
        "googlevideo.com",
        "googlecode.com",
        "googleblog.com",
        "googletagmanager.com",
        "googletagservices.com",
        "google-analytics.com",
        "googleadservices.com",
        "appspot.com",
        "1e100.net",
        "ggpht.com",
        "gvt1.com",
        "gvt2.com",
        "youtube.com",
        "youtu.be",
        "ytimg.com",
        "g.co",
        "goo.gl",
    ];

    for base in GOOGLE_BASE_DOMAINS {
        if host == *base || host.ends_with(&format!(".{base}")) {
            return true;
        }
    }

    // Google top-level domain (*.google or google)
    if host == "google" || host.ends_with(".google") {
        return true;
    }

    // Regional Google ccTLDs:
    // e.g. google.de, calendar.google.de, google.co.uk, calendar-pa.clients6.google.co.uk
    let parts: Vec<&str> = host.split('.').collect();
    let n = parts.len();
    if n >= 2 {
        // google.<tld> or <subdomains>.google.<tld>
        // Example: ["google", "de"] or ["calendar", "google", "de"]
        if parts[n - 2] == "google" {
            return true;
        }

        // google.<cc>.<tld> or <subdomains>.google.<cc>.<tld>
        // Example: ["google", "co", "uk"] or ["calendar", "google", "com", "au"]
        if n >= 3
            && parts[n - 3] == "google"
            && (parts[n - 2] == "co"
                || parts[n - 2] == "com"
                || parts[n - 2] == "net"
                || parts[n - 2] == "org"
                || parts[n - 2] == "edu"
                || parts[n - 2] == "ac")
        {
            return true;
        }
    }

    false
}

/// Checks if a URL is a Google redirector (e.g. `google.com/url?q=...`) and extracts the target URL.
pub fn extract_redirect_target(url: &Url) -> Option<String> {
    let host = url.host_str()?;
    if !is_google_host(host) {
        return None;
    }
    if url.path() == "/url" {
        for (key, value) in url.query_pairs() {
            if key == "q" || key == "url" {
                return Some(value.into_owned());
            }
        }
    }
    None
}

/// Returns the resolved target URL that should be opened in the external browser.
/// If `raw_url` is a Google redirect link (`/url?q=https://external.com`), returns the unwrapped target.
pub fn get_external_browser_target(raw_url: &str) -> String {
    if let Ok(parsed) = Url::parse(raw_url) {
        if let Some(target) = extract_redirect_target(&parsed) {
            return target;
        }
    }
    raw_url.to_string()
}

fn is_auth_host_or_path(host: &str, path: &str) -> bool {
    host == "accounts.google.com"
        || host.starts_with("accounts.google.")
        || host == "accounts.youtube.com"
        || host == "myaccount.google.com"
        || host == "oauth2.googleapis.com"
        || host == "apis.google.com"
        || ((host == "google.com" || host == "www.google.com" || host.starts_with("www.google."))
            && (path.starts_with("/accounts")
                || path.starts_with("/signin")
                || path.starts_with("/gmail")
                || path.starts_with("/calendar")
                || path.starts_with("/ServiceLogin")
                || path.starts_with("/CheckCookie")
                || path.starts_with("/SetOSID")
                || path.starts_with("/_/signin")
                || path.contains("signinchooser")))
}

pub fn classify_url(raw_url: &str, _app_kind: AppKind) -> UrlCategory {
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

    // Check if this is a Google redirector (e.g. google.com/url?q=https://external.com)
    if let Some(target_url_str) = extract_redirect_target(&parsed) {
        if let Ok(target_url) = Url::parse(&target_url_str) {
            if let Some(target_host) = target_url.host_str() {
                if !is_google_host(target_host) {
                    return UrlCategory::External;
                }
            }
        }
    }

    let host = match parsed.host_str() {
        Some(h) => h.to_lowercase(),
        None => return UrlCategory::External,
    };

    // If host is not in Google ecosystem, route to external browser
    if !is_google_host(&host) {
        return UrlCategory::External;
    }

    // Authentication & identity endpoints stay in-app as Auth
    if is_auth_host_or_path(&host, parsed.path()) {
        return UrlCategory::Auth;
    }

    // All other Google ecosystem hosts stay in-app
    UrlCategory::InApp
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
            "https://zoom.us/j/123456",
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
    fn test_google_redirect_to_external() {
        let redirect_url =
            "https://www.google.com/url?q=https://github.com/rust-lang/rust&source=gmail";
        assert_eq!(
            classify_url(redirect_url, AppKind::Mail),
            UrlCategory::External
        );
        assert!(should_open_in_external_browser(redirect_url, AppKind::Mail));
        assert_eq!(
            get_external_browser_target(redirect_url),
            "https://github.com/rust-lang/rust"
        );

        // Google target inside redirect stays in-app
        let internal_redirect =
            "https://www.google.com/url?q=https://calendar.google.com/calendar/u/0/r";
        assert_eq!(
            classify_url(internal_redirect, AppKind::Mail),
            UrlCategory::InApp
        );
        assert!(!should_open_in_external_browser(
            internal_redirect,
            AppKind::Mail
        ));
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
    fn test_google_ecosystem_endpoints_stay_in_app() {
        let ecosystem_urls = [
            "https://calendar.google.com/calendar/u/0/r",
            "https://calendar-pa.clients6.google.com/calendar/v3/users/me/calendarList",
            "https://clients4.google.com/inbox/sync",
            "https://tasks.google.com/embed",
            "https://keep.google.com/u/0",
            "https://contacts.google.com/widget",
            "https://ogs.google.com/widget/app",
            "https://play.google.com/log",
            "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2",
            "https://lh3.googleusercontent.com/a/default-user=s64",
            "https://meet.google.com/abc-defg-hij",
            "https://workspace.google.com/products/calendar",
            "https://calendar.google.co.uk/calendar/u/0/r",
            "https://google.de/search?q=test",
            "https://blog.google/technology/ai",
            "https://drive.google.com/drive/u/0/my-drive",
            "https://docs.google.com/document/d/123/edit",
            "https://chat.google.com",
        ];

        for url in ecosystem_urls {
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

    #[test]
    fn test_spoofed_google_domains_are_external() {
        let spoofed_urls = [
            "https://google.evil.com/phishing",
            "https://notgoogle.com",
            "https://evil-google.com",
            "https://google.com.attacker.com",
        ];

        for url in spoofed_urls {
            assert_eq!(
                classify_url(url, AppKind::Calendar),
                UrlCategory::External,
                "Expected {url} to be classified as External"
            );
            assert!(
                should_open_in_external_browser(url, AppKind::Calendar),
                "Expected {url} to open in external browser"
            );
        }
    }
}
