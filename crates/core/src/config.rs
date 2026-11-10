use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AppKind {
    Gmail,
    Calendar,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopAppConfig {
    pub kind: AppKind,
    pub title: String,
    pub initial_url: String,
    pub width: f64,
    pub height: f64,
    pub min_width: f64,
    pub min_height: f64,
    pub close_to_tray: bool,
    pub start_minimized: bool,
    pub user_agent: Option<String>,
}

impl DesktopAppConfig {
    pub fn for_gmail() -> Self {
        Self {
            kind: AppKind::Gmail,
            title: "Gmail".to_string(),
            initial_url: "https://mail.google.com".to_string(),
            width: 1280.0,
            height: 800.0,
            min_width: 800.0,
            min_height: 600.0,
            close_to_tray: true,
            start_minimized: false,
            user_agent: None,
        }
    }

    pub fn for_calendar() -> Self {
        Self {
            kind: AppKind::Calendar,
            title: "Google Calendar".to_string(),
            initial_url: "https://calendar.google.com".to_string(),
            width: 1120.0,
            height: 760.0,
            min_width: 720.0,
            min_height: 520.0,
            close_to_tray: true,
            start_minimized: false,
            user_agent: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gmail_defaults() {
        let cfg = DesktopAppConfig::for_gmail();
        assert_eq!(cfg.kind, AppKind::Gmail);
        assert_eq!(cfg.title, "Gmail");
        assert!(cfg.initial_url.starts_with("https://mail.google.com"));
        assert!(cfg.close_to_tray);
    }

    #[test]
    fn test_calendar_defaults() {
        let cfg = DesktopAppConfig::for_calendar();
        assert_eq!(cfg.kind, AppKind::Calendar);
        assert_eq!(cfg.title, "Google Calendar");
        assert!(cfg.initial_url.starts_with("https://calendar.google.com"));
        assert!(cfg.close_to_tray);
    }
}
