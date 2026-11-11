use desktop_google_core::{
    parse_mailto_url, scripts::get_injected_bundle, to_gmail_compose_url, DesktopAppConfig,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";

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
        if let Some(tray) = app.tray_by_id("main-tray") {
            let tooltip = if count > 0 {
                format!("Gmail - {} unread messages", count)
            } else {
                "Gmail - Inbox zero".to_string()
            };
            let _ = tray.set_tooltip(Some(tooltip));
        }
        Ok(())
    }

    #[tauri::command]
    pub fn handle_mailto<R: Runtime>(app: AppHandle<R>, mailto: String) -> Result<(), String> {
        if let Some(data) = parse_mailto_url(&mailto) {
            let compose_url = to_gmail_compose_url(&data);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
                let script = format!("window.location.href = '{}';", compose_url);
                let _ = window.eval(&script);
            }
        }
        Ok(())
    }
}

pub fn run() {
    let config = DesktopAppConfig::for_gmail();

    tauri::Builder::<tauri::Wry>::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_external_url,
            commands::update_unread_badge,
            commands::handle_mailto
        ])
        .setup(move |app| {
            let injected_script = get_injected_bundle();

            // 1. Build main WebviewWindow with injected styles, scripts, and modern Windows 11 user-agent
            let initial_url = WebviewUrl::External(
                config
                    .initial_url
                    .parse()
                    .expect("Failed to parse initial URL for Gmail"),
            );

            let app_nav = app.handle().clone();
            let app_win = app.handle().clone();

            let window = WebviewWindowBuilder::new(app, "main", initial_url)
                .title(&config.title)
                .inner_size(config.width, config.height)
                .min_inner_size(config.min_width, config.min_height)
                .resizable(true)
                .user_agent(USER_AGENT)
                .initialization_script(&injected_script)
                .on_navigation(move |url| {
                    let url_str = url.as_str();
                    if desktop_google_core::should_open_in_external_browser(
                        url_str,
                        desktop_google_core::AppKind::Gmail,
                    ) {
                        use tauri_plugin_shell::ShellExt;
                        let _ = app_nav.shell().open(url_str, None);
                        false
                    } else {
                        true
                    }
                })
                .on_new_window(move |url, _features| {
                    let url_str = url.as_str();
                    if desktop_google_core::should_open_in_external_browser(
                        url_str,
                        desktop_google_core::AppKind::Gmail,
                    ) {
                        use tauri_plugin_shell::ShellExt;
                        let _ = app_win.shell().open(url_str, None);
                        tauri::webview::NewWindowResponse::Deny
                    } else {
                        if let Some(w) = app_win.get_webview_window("main") {
                            let _ = w.navigate(url.clone());
                        }
                        tauri::webview::NewWindowResponse::Deny
                    }
                })
                .build()?;

            // 2. Handle close button: exit immediately when close_to_tray is disabled
            let window_clone = window.clone();
            let app_handle = app.handle().clone();
            let close_to_tray = config.close_to_tray;
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    if close_to_tray {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    } else {
                        app_handle.exit(0);
                    }
                }
            });

            // 3. Build System Tray Menu
            let show_item = MenuItem::with_id(app, "show", "Show Gmail", true, None::<&str>)?;
            let compose_item =
                MenuItem::with_id(app, "compose", "Compose New Mail", true, None::<&str>)?;
            let reload_item = MenuItem::with_id(app, "reload", "Refresh Inbox", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Gmail", true, None::<&str>)?;

            let tray_menu =
                Menu::with_items(app, &[&show_item, &compose_item, &reload_item, &quit_item])?;

            let tray_icon = app.default_window_icon().cloned();

            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .menu(&tray_menu)
                .tooltip("Desktop Gmail")
                .show_menu_on_left_click(false);

            if let Some(icon) = tray_icon {
                tray_builder = tray_builder.icon(icon);
            }

            let _tray = tray_builder
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    "compose" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                            let _ = w.eval("window.location.href = 'https://mail.google.com/mail/?view=cm&fs=1';");
                        }
                    }
                    "reload" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.eval("window.location.reload();");
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Desktop Gmail");
}
