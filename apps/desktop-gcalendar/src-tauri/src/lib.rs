use desktop_google_core::DesktopAppConfig;
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
}

pub fn run() {
    let _config = DesktopAppConfig::for_calendar();

    tauri::Builder::<tauri::Wry>::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![commands::open_external_url])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("Google Calendar");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Desktop Google Calendar");
}
