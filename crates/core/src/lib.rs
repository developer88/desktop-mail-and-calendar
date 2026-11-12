pub mod config;
pub mod icon;
pub mod navigation;
pub mod protocol;
pub mod scripts;

pub use config::{AppKind, DesktopAppConfig};
pub use navigation::{
    classify_url, extract_redirect_target, get_external_browser_target, is_google_host,
    should_open_in_external_browser, UrlCategory,
};
pub use protocol::{parse_mailto_url, to_gmail_compose_url, to_mail_compose_url, MailtoData};
