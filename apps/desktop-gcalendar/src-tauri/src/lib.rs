use desktop_google_core::{scripts::get_injected_bundle, DesktopAppConfig};
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
    pub fn minimize_window<R: Runtime>(app: AppHandle<R>) {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.minimize();
        }
    }

    #[tauri::command]
    pub fn maximize_window<R: Runtime>(app: AppHandle<R>) {
        if let Some(w) = app.get_webview_window("main") {
            if let Ok(is_max) = w.is_maximized() {
                if is_max {
                    let _ = w.unmaximize();
                } else {
                    let _ = w.maximize();
                }
            }
        }
    }

    #[tauri::command]
    pub fn close_window<R: Runtime>(app: AppHandle<R>) {
        app.exit(0);
    }
}

pub fn run() {
    let config = DesktopAppConfig::for_calendar();

    tauri::Builder::<tauri::Wry>::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_external_url,
            commands::minimize_window,
            commands::maximize_window,
            commands::close_window
        ])
        .setup(move |app| {
            let injected_script = get_injected_bundle();

            let initial_url = WebviewUrl::External(
                config
                    .initial_url
                    .parse()
                    .expect("Failed to parse initial URL for Calendar"),
            );

            let app_nav = app.handle().clone();
            let app_win = app.handle().clone();

            let window = WebviewWindowBuilder::new(app, "main", initial_url)
                .title(&config.title)
                .inner_size(config.width, config.height)
                .min_inner_size(config.min_width, config.min_height)
                .resizable(true)
                .decorations(false)
                .shadow(true)
                .user_agent(USER_AGENT)
                .initialization_script(&injected_script)
                .on_document_title_changed({
                    let app_cmd = app.handle().clone();
                    move |window, title| {
                        if let Some(cmd) = title.strip_prefix("__desktop_cmd__:") {
                            match cmd {
                                "drag" => {
                                    let _ = window.start_dragging();
                                }
                                "minimize" => {
                                    let _ = window.minimize();
                                }
                                "maximize" => {
                                    if let Ok(is_max) = window.is_maximized() {
                                        if is_max {
                                            let _ = window.unmaximize();
                                        } else {
                                            let _ = window.maximize();
                                        }
                                    }
                                }
                                "close" => {
                                    app_cmd.exit(0);
                                }
                                "fullscreen" => {
                                    if let Ok(is_full) = window.is_fullscreen() {
                                        let _ = window.set_fullscreen(!is_full);
                                    }
                                }
                                "autostart:on" => {
                                    set_windows_autostart(true);
                                }
                                "autostart:off" => {
                                    set_windows_autostart(false);
                                }
                                _ => {}
                            }
                        }
                    }
                })
                .on_navigation(move |url| {
                    if url.scheme() == "desktop-app" {
                        if url.host_str() == Some("window") {
                            match url.path() {
                                "/drag" => {
                                    if let Some(w) = app_nav.get_webview_window("main") {
                                        let _ = w.start_dragging();
                                    }
                                }
                                "/minimize" => {
                                    if let Some(w) = app_nav.get_webview_window("main") {
                                        let _ = w.minimize();
                                    }
                                }
                                "/maximize" => {
                                    if let Some(w) = app_nav.get_webview_window("main") {
                                        if let Ok(is_max) = w.is_maximized() {
                                            if is_max {
                                                let _ = w.unmaximize();
                                            } else {
                                                let _ = w.maximize();
                                            }
                                        }
                                    }
                                }
                                "/close" => {
                                    app_nav.exit(0);
                                }
                                "/fullscreen" => {
                                    if let Some(w) = app_nav.get_webview_window("main") {
                                        if let Ok(is_full) = w.is_fullscreen() {
                                            let _ = w.set_fullscreen(!is_full);
                                        }
                                    }
                                }
                                _ => {}
                            }
                        }
                        return false;
                    }

                    let url_str = url.as_str();
                    if let Some(host) = url.host_str() {
                        if host == "workspace.google.com" {
                            if let Some(w) = app_nav.get_webview_window("main") {
                                let _ = w.eval("window.location.replace('https://calendar.google.com/calendar/u/0/r');");
                            }
                            return false;
                        }
                    }

                    if desktop_google_core::should_open_in_external_browser(
                        url_str,
                        desktop_google_core::AppKind::Calendar,
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
                    if let Some(host) = url.host_str() {
                        if host == "workspace.google.com" {
                            if let Some(w) = app_win.get_webview_window("main") {
                                let _ = w.eval("window.location.replace('https://calendar.google.com/calendar/u/0/r');");
                            }
                            return tauri::webview::NewWindowResponse::Deny;
                        }
                    }

                    if desktop_google_core::should_open_in_external_browser(
                        url_str,
                        desktop_google_core::AppKind::Calendar,
                    ) {
                        use tauri_plugin_shell::ShellExt;
                        let _ = app_win.shell().open(url_str, None);
                        tauri::webview::NewWindowResponse::Deny
                    } else {
                        if let Some(w) = app_win.get_webview_window("main") {
                            let _ = w.navigate(url);
                        }
                        tauri::webview::NewWindowResponse::Deny
                    }
                })
                .build()?;

            // Exit application directly when window close button (X) is clicked
            let app_handle_for_close = app.handle().clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { .. } = event {
                    app_handle_for_close.exit(0);
                }
            });

            // System Tray
            let show_i = MenuItem::with_id(app, "show", "Open Calendar", true, None::<&str>)?;
            let refresh_i = MenuItem::with_id(app, "refresh", "Refresh", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_i, &refresh_i, &quit_i])?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    "refresh" => {
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
        .expect("error while running Desktop Google Calendar");
}

#[cfg(target_os = "windows")]
fn set_windows_autostart(enable: bool) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    if let Ok(exe_path) = std::env::current_exe() {
        let exe_str = exe_path.to_string_lossy();
        if enable {
            let _ = std::process::Command::new("reg")
                .args(&[
                    "add",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "DesktopGoogleCalendar",
                    "/t",
                    "REG_SZ",
                    "/d",
                    &format!("\"{}\"", exe_str),
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        } else {
            let _ = std::process::Command::new("reg")
                .args(&[
                    "delete",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "DesktopGoogleCalendar",
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn set_windows_autostart(_enable: bool) {}
