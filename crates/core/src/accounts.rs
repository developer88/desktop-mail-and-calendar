use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AccountInfo {
    pub id: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub avatar_local_path: Option<String>,
    #[serde(default)]
    pub unread_count: u32,
    /// `None` for `"default"` (uses default WebView2 profile directory so existing users stay signed in).
    /// `Some("profiles/<id>")` for additional isolated accounts.
    #[serde(default)]
    pub profile_subdir: Option<String>,
}

impl AccountInfo {
    pub fn default_account() -> Self {
        Self {
            id: "default".to_string(),
            email: None,
            name: None,
            avatar_url: None,
            avatar_local_path: None,
            unread_count: 0,
            profile_subdir: None,
        }
    }

    pub fn display_label(&self) -> &str {
        self.email
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .or_else(|| self.name.as_deref().filter(|s| !s.trim().is_empty()))
            .unwrap_or(&self.id)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AccountsState {
    pub active_account_id: String,
    pub accounts: Vec<AccountInfo>,
    #[serde(default = "default_true")]
    pub notifications_enabled: bool,
}

impl Default for AccountsState {
    fn default() -> Self {
        Self::default_state()
    }
}

impl AccountsState {
    pub fn default_state() -> Self {
        Self {
            active_account_id: "default".to_string(),
            accounts: vec![AccountInfo::default_account()],
            notifications_enabled: true,
        }
    }

    pub fn load(app_id: &str) -> Self {
        let path = accounts_file_path(app_id);
        let Ok(raw) = std::fs::read_to_string(&path) else {
            return Self::default_state();
        };
        let Ok(mut state) = serde_json::from_str::<AccountsState>(&raw) else {
            return Self::default_state();
        };
        if state.accounts.is_empty() {
            return Self::default_state();
        }
        if !state
            .accounts
            .iter()
            .any(|a| a.id == state.active_account_id)
        {
            state.active_account_id = state.accounts[0].id.clone();
        }
        state
    }

    pub fn save(&self, app_id: &str) -> Result<(), String> {
        let path = accounts_file_path(app_id);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create accounts dir: {}", e))?;
        }
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize accounts state: {}", e))?;
        std::fs::write(&path, json).map_err(|e| format!("Failed to write accounts state: {}", e))
    }

    pub fn add_account(&mut self) -> AccountInfo {
        let mut idx = self.accounts.len() + 1;
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let mut id = format!("acct-{}-{}", idx, nanos);
        while self.accounts.iter().any(|a| a.id == id) {
            idx += 1;
            id = format!("acct-{}-{}", idx, nanos);
        }

        let account = AccountInfo {
            id: id.clone(),
            email: None,
            name: None,
            avatar_url: None,
            avatar_local_path: None,
            unread_count: 0,
            profile_subdir: Some(format!("profiles/{}", id)),
        };
        self.accounts.push(account.clone());
        self.active_account_id = account.id.clone();
        account
    }

    /// Removes an account by ID. Never removes the last remaining account.
    /// Returns `(removed_account, new_active_account_id)` if removed.
    pub fn remove_account(&mut self, account_id: &str) -> Option<(AccountInfo, String)> {
        if self.accounts.len() <= 1 {
            return None;
        }
        let pos = self.accounts.iter().position(|a| a.id == account_id)?;
        let removed = self.accounts.remove(pos);
        if self.active_account_id == account_id {
            let next_idx = pos.min(self.accounts.len() - 1);
            self.active_account_id = self.accounts[next_idx].id.clone();
        }
        Some((removed, self.active_account_id.clone()))
    }

    pub fn set_active(&mut self, account_id: &str) -> bool {
        if self.accounts.iter().any(|a| a.id == account_id) {
            self.active_account_id = account_id.to_string();
            true
        } else {
            false
        }
    }

    pub fn get_account(&self, account_id: &str) -> Option<&AccountInfo> {
        self.accounts.iter().find(|a| a.id == account_id)
    }

    pub fn update_profile(
        &mut self,
        account_id: &str,
        email: Option<String>,
        name: Option<String>,
        avatar_url: Option<String>,
    ) -> (bool, bool) {
        let Some(acc) = self.accounts.iter_mut().find(|a| a.id == account_id) else {
            return (false, false);
        };
        let mut changed = false;
        let mut avatar_changed = false;

        if let Some(e) = email
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
        {
            if acc.email.as_deref() != Some(&e) {
                acc.email = Some(e);
                changed = true;
            }
        }
        if let Some(n) = name.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
            if acc.name.as_deref() != Some(&n) {
                acc.name = Some(n);
                changed = true;
            }
        }
        if let Some(u) = avatar_url
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
        {
            if acc.avatar_url.as_deref() != Some(&u) {
                acc.avatar_url = Some(u);
                changed = true;
                avatar_changed = true;
            }
        }
        (changed, avatar_changed)
    }

    pub fn set_avatar_local_path(&mut self, account_id: &str, path: &Path) -> bool {
        let Some(acc) = self.accounts.iter_mut().find(|a| a.id == account_id) else {
            return false;
        };
        let s = path.to_string_lossy().into_owned();
        if acc.avatar_local_path.as_deref() != Some(&s) {
            acc.avatar_local_path = Some(s);
            true
        } else {
            false
        }
    }

    pub fn set_unread_count(&mut self, account_id: &str, count: u32) -> (bool, u32) {
        let mut changed = false;
        if let Some(acc) = self.accounts.iter_mut().find(|a| a.id == account_id) {
            if acc.unread_count != count {
                acc.unread_count = count;
                changed = true;
            }
        }
        (changed, self.total_unread())
    }

    pub fn total_unread(&self) -> u32 {
        self.accounts
            .iter()
            .fold(0u32, |acc, a| acc.saturating_add(a.unread_count))
    }
}

pub fn app_data_dir(app_id: &str) -> PathBuf {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        PathBuf::from(local_app_data).join(app_id)
    } else {
        std::env::temp_dir().join(app_id)
    }
}

pub fn accounts_file_path(app_id: &str) -> PathBuf {
    app_data_dir(app_id).join("accounts.json")
}

pub fn profile_dir(app_id: &str, account: &AccountInfo) -> Option<PathBuf> {
    account
        .profile_subdir
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|sub| app_data_dir(app_id).join(sub))
}

pub fn avatar_cache_path(app_id: &str, account_id: &str) -> PathBuf {
    app_data_dir(app_id)
        .join("avatars")
        .join(format!("{}.png", account_id))
}

pub fn webview_label(account_id: &str) -> String {
    if account_id == "default" {
        "content".to_string()
    } else {
        format!("content-{}", account_id)
    }
}

pub fn account_id_from_webview_label(label: &str) -> Option<&str> {
    if label == "content" {
        Some("default")
    } else {
        label.strip_prefix("content-")
    }
}

pub fn format_toast_attribution(
    default_attr: &str,
    account: Option<&AccountInfo>,
    total_accounts: usize,
) -> String {
    if total_accounts > 1 {
        if let Some(acc) = account {
            return format!("{} · {}", default_attr, acc.display_label());
        }
    }
    default_attr.to_string()
}

pub fn download_avatar_to_cache(
    app_id: &str,
    account_id: &str,
    avatar_url: &str,
) -> Option<PathBuf> {
    if !avatar_url.starts_with("https://") && !avatar_url.starts_with("http://") {
        return None;
    }
    let dest = avatar_cache_path(app_id, account_id);
    if let Some(parent) = dest.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let tmp = dest.with_extension("tmp");

    #[cfg(target_os = "windows")]
    let status = {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        std::process::Command::new("curl.exe")
            .args([
                "-sSL",
                "--max-time",
                "10",
                "-o",
                &tmp.to_string_lossy(),
                avatar_url,
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .ok()?
    };

    #[cfg(not(target_os = "windows"))]
    let status = std::process::Command::new("curl")
        .args([
            "-sSL",
            "--max-time",
            "10",
            "-o",
            &tmp.to_string_lossy(),
            avatar_url,
        ])
        .status()
        .ok()?;

    if status.success() {
        if let Ok(meta) = std::fs::metadata(&tmp) {
            if meta.len() > 64 {
                if std::fs::rename(&tmp, &dest).is_ok() {
                    return Some(dest);
                }
            }
        }
    }
    let _ = std::fs::remove_file(&tmp);
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_state_and_webview_labels() {
        let state = AccountsState::default_state();
        assert_eq!(state.active_account_id, "default");
        assert_eq!(state.accounts.len(), 1);
        assert_eq!(state.accounts[0].id, "default");
        assert_eq!(state.accounts[0].profile_subdir, None);
        assert_eq!(webview_label("default"), "content");
        assert_eq!(account_id_from_webview_label("content"), Some("default"));
        assert_eq!(webview_label("acct-2-123"), "content-acct-2-123");
        assert_eq!(
            account_id_from_webview_label("content-acct-2-123"),
            Some("acct-2-123")
        );
        assert_eq!(account_id_from_webview_label("shell"), None);
    }

    #[test]
    fn test_add_switch_remove_preserves_order() {
        let mut state = AccountsState::default_state();
        let a2 = state.add_account();
        let a3 = state.add_account();
        assert_eq!(state.accounts.len(), 3);
        assert_eq!(state.active_account_id, a3.id);
        assert_eq!(state.accounts[0].id, "default");
        assert_eq!(state.accounts[1].id, a2.id);
        assert_eq!(state.accounts[2].id, a3.id);

        assert!(state.set_active("default"));
        assert_eq!(state.active_account_id, "default");
        assert!(!state.set_active("nonexistent"));

        // Removing active account switches to next remaining
        let (removed, next_active) = state.remove_account("default").unwrap();
        assert_eq!(removed.id, "default");
        assert_eq!(next_active, a2.id);
        assert_eq!(state.accounts.len(), 2);

        // Removing non-active keeps active
        let (_, still_active) = state.remove_account(&a3.id).unwrap();
        assert_eq!(still_active, a2.id);
        assert_eq!(state.accounts.len(), 1);

        // Cannot remove last remaining account
        assert!(state.remove_account(&a2.id).is_none());
        assert_eq!(state.accounts.len(), 1);
    }

    #[test]
    fn test_unread_count_aggregation() {
        let mut state = AccountsState::default_state();
        let a2 = state.add_account();
        let a3 = state.add_account();

        let (changed, total) = state.set_unread_count("default", 5);
        assert!(changed);
        assert_eq!(total, 5);

        let (changed, total) = state.set_unread_count(&a2.id, 12);
        assert!(changed);
        assert_eq!(total, 17);

        let (changed, total) = state.set_unread_count(&a3.id, 3);
        assert!(changed);
        assert_eq!(total, 20);

        // Setting same count reports unchanged
        let (changed, total) = state.set_unread_count(&a2.id, 12);
        assert!(!changed);
        assert_eq!(total, 20);
    }

    #[test]
    fn test_persistence_roundtrip() {
        let test_id = format!(
            "com.andrey.test-accounts-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let mut state = AccountsState::default_state();
        state.update_profile(
            "default",
            Some("personal@gmail.com".to_string()),
            Some("Personal".to_string()),
            Some("https://lh3.googleusercontent.com/a/1".to_string()),
        );
        let a2 = state.add_account();
        state.update_profile(
            &a2.id,
            Some("work@company.com".to_string()),
            Some("Work".to_string()),
            None,
        );
        state.notifications_enabled = false;
        state.save(&test_id).expect("save should succeed");

        let loaded = AccountsState::load(&test_id);
        assert_eq!(loaded, state);

        let _ = std::fs::remove_dir_all(app_data_dir(&test_id));
    }

    #[test]
    fn test_format_toast_attribution() {
        let mut acc = AccountInfo::default_account();
        acc.email = Some("work@company.com".to_string());

        assert_eq!(format_toast_attribution("Inbox", Some(&acc), 1), "Inbox");
        assert_eq!(
            format_toast_attribution("Inbox", Some(&acc), 2),
            "Inbox · work@company.com"
        );
        assert_eq!(
            format_toast_attribution("Calendar", Some(&acc), 3),
            "Calendar · work@company.com"
        );
    }
}
