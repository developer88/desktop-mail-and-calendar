use desktop_google_core::{parse_mailto_url, to_gmail_compose_url, DesktopAppConfig};
use tauri::{AppHandle, Manager, Runtime};

mod commands {
    use super::*;

    #[tauri::command]
    pub fn open_external_url<R: Runtime>(app: AppHandle<R>, url: String) -> Result<(), String> {
        use tauri_plugin_shell::ShellExt;
        app.shell()
            .open(&url, None)
            .map_err(|e| format!("Failed to open external url {}: {}", url, e))
    }

    #[tauri::command]
    pub fn update_unread_badge<R: Runtime>(app: AppHandle<R>, count: u32) -> Result<(), String> {
        if let Some(window) = app.get_webview_window("main") {
            let title = if count > 0 {
                format!("Gmail ({})", count)
            } else {
                "Gmail".to_string()
            };
            let _ = window.set_title(&title);
        }
        Ok(())
    }

    #[tauri::command]
    pub fn handle_mailto<R: Runtime>(app: AppHandle<R>, mailto: String) -> Result<(), String> {
        if let Some(data) = parse_mailto_url(&mailto) {
            let compose_url = to_gmail_compose_url(&data);
            if let Some(window) = app.get_webview_window("main") {
                let script = format!("window.location.href = '{}';", compose_url);
                let _ = window.eval(&script);
            }
        }
        Ok(())
    }
}

pub fn run() {
    let _config = DesktopAppConfig::for_gmail();

    tauri::Builder::<tauri::Wry>::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_external_url,
            commands::update_unread_badge,
            commands::handle_mailto
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("Gmail");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Desktop Gmail");
}
