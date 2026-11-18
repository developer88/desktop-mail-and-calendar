use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AppKind {
    Mail,
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
    pub start_minimized: bool,
    pub user_agent: Option<String>,
}

impl DesktopAppConfig {
    pub fn for_mail() -> Self {
        Self {
            kind: AppKind::Mail,
            title: "Desktop Mail".to_string(),
            initial_url: "https://mail.google.com/mail/u/0/".to_string(),
            width: 1280.0,
            height: 800.0,
            min_width: 800.0,
            min_height: 600.0,
            start_minimized: false,
            user_agent: None,
        }
    }

    pub fn for_calendar() -> Self {
        Self {
            kind: AppKind::Calendar,
            title: "Desktop Calendar".to_string(),
            initial_url: "https://calendar.google.com/calendar/u/0/r".to_string(),
            width: 1380.0,
            height: 920.0,
            min_width: 800.0,
            min_height: 600.0,
            start_minimized: false,
            user_agent: None,
        }
    }
}

pub fn get_first_run_marker_path(app_id: &str) -> std::path::PathBuf {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        std::path::PathBuf::from(local_app_data)
            .join(app_id)
            .join(".first_run_completed")
    } else {
        std::env::temp_dir().join(format!("{}.first_run_completed", app_id))
    }
}

pub fn is_first_run(app_id: &str) -> bool {
    !get_first_run_marker_path(app_id).exists()
}

pub fn mark_first_run_completed(app_id: &str) {
    let path = get_first_run_marker_path(app_id);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(path, b"1");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mail_defaults() {
        let cfg = DesktopAppConfig::for_mail();
        assert_eq!(cfg.kind, AppKind::Mail);
        assert_eq!(cfg.title, "Desktop Mail");
        assert!(cfg.initial_url.starts_with("https://mail.google.com"));
        assert_eq!(cfg.width, 1280.0);
        assert_eq!(cfg.height, 800.0);
        assert_eq!(cfg.min_width, 800.0);
        assert_eq!(cfg.min_height, 600.0);
    }

    #[test]
    fn test_calendar_defaults() {
        let cfg = DesktopAppConfig::for_calendar();
        assert_eq!(cfg.kind, AppKind::Calendar);
        assert_eq!(cfg.title, "Desktop Calendar");
        assert!(cfg.initial_url.starts_with("https://calendar.google.com"));
        assert_eq!(cfg.width, 1380.0);
        assert_eq!(cfg.height, 920.0);
        assert_eq!(cfg.min_width, 800.0);
        assert_eq!(cfg.min_height, 600.0);
    }

    #[test]
    fn test_first_run_lifecycle() {
        let test_id = format!(
            "com.andrey.test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        assert!(is_first_run(&test_id));
        mark_first_run_completed(&test_id);
        assert!(!is_first_run(&test_id));
        let path = get_first_run_marker_path(&test_id);
        let _ = std::fs::remove_file(path);
    }
}
