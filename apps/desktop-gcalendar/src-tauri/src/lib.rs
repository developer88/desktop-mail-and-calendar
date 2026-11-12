use desktop_google_core::{scripts::get_injected_bundle, DesktopAppConfig};
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder, WindowEvent};

// Standard Microsoft Edge on Windows 11 User-Agent required by Google Calendar and Google Services
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

    #[tauri::command]
    pub fn update_calendar_date_icon<R: Runtime>(
        app: AppHandle<R>,
        _day: u32,
        icon_rgba: Option<Vec<u8>>,
        width: Option<u32>,
        height: Option<u32>,
    ) -> Result<(), String> {
        if let Some(window) = app.get_webview_window("main") {
            #[cfg(target_os = "windows")]
            if let Ok(hwnd_obj) = window.hwnd() {
                let hwnd = hwnd_obj.0 as isize;
                if let (Some(rgba), Some(w), Some(h)) = (icon_rgba, width, height) {
                    unsafe {
                        let hicon =
                            desktop_google_core::icon::windows::create_hicon_from_rgba(&rgba, w, h);
                        if hicon != 0 {
                            desktop_google_core::icon::windows::set_window_hicon(hwnd, hicon);
                        }
                    }
                }
            }
        }
        Ok(())
    }
}

pub fn run() {
    let config = DesktopAppConfig::for_calendar();

    let mut start_url = config.initial_url.clone();
    for arg in std::env::args().skip(1) {
        let clean = arg.trim_matches('"').trim_matches('\'');
        if clean.starts_with("webcal://")
            || clean.starts_with("webcals://")
            || clean.ends_with(".ics")
        {
            let http_url = if let Some(stripped) = clean.strip_prefix("webcal://") {
                format!("http://{}", stripped)
            } else if let Some(stripped) = clean.strip_prefix("webcals://") {
                format!("https://{}", stripped)
            } else {
                clean.to_string()
            };
            start_url = format!(
                "https://calendar.google.com/calendar/u/0/r/settings/addcalendar?cid={}",
                url::form_urlencoded::byte_serialize(http_url.as_bytes()).collect::<String>()
            );
            break;
        }
    }

    tauri::Builder::<tauri::Wry>::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_external_url,
            commands::update_calendar_date_icon,
            commands::minimize_window,
            commands::maximize_window,
            commands::close_window
        ])
        .setup(move |app| {
            let injected_script = get_injected_bundle(config.kind);

            let initial_url = WebviewUrl::External(
                start_url
                    .parse()
                    .expect("Failed to parse initial URL for Calendar"),
            );

            let app_nav = app.handle().clone();
            let app_win = app.handle().clone();

            let window = WebviewWindowBuilder::new(app, "main", initial_url)
                .title(&config.title)
                .inner_size(config.width, config.height)
                .min_inner_size(config.min_width, config.min_height)
                .center()
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
                                "open:defaultapps" => {
                                    use tauri_plugin_shell::ShellExt;
                                    let _ = app_cmd.shell().open("ms-settings:defaultapps", None);
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
                        let target = desktop_google_core::get_external_browser_target(url_str);
                        let _ = app_nav.shell().open(target, None);
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
                        let target = desktop_google_core::get_external_browser_target(url_str);
                        let _ = app_win.shell().open(target, None);
                        tauri::webview::NewWindowResponse::Deny
                    } else {
                        if let Some(w) = app_win.get_webview_window("main") {
                            let _ = w.navigate(url);
                        }
                        tauri::webview::NewWindowResponse::Deny
                    }
                })
                .build()?;

            #[cfg(target_os = "windows")]
            if let Ok(hwnd_obj) = window.hwnd() {
                let hwnd = hwnd_obj.0 as isize;
                unsafe {
                    desktop_google_core::icon::windows::set_window_relaunch_properties(
                        hwnd,
                        "com.andrey.desktop-gcalendar",
                        "Desktop Calendar",
                    );
                }
            }

            #[cfg(target_os = "windows")]
            {
                let win_handle = window.clone();
                std::thread::spawn(move || {
                    let mut last_day = 0u32;
                    let base_img = tauri::image::Image::from_bytes(include_bytes!(
                        "../icons/blank_256.png"
                    ))
                    .ok();

                    for _ in 0..100 {
                        if let Ok(hwnd_obj) = win_handle.hwnd() {
                            let hwnd = hwnd_obj.0 as isize;
                            if hwnd != 0 {
                                unsafe {
                                    let day = desktop_google_core::icon::windows::get_local_day();
                                    if day != last_day {
                                        last_day = day;
                                        if let Some(ref img) = base_img {
                                            let hicon = desktop_google_core::icon::windows::render_calendar_date_hicon(
                                                img.rgba(), day,
                                            );
                                            if hicon != 0 {
                                                desktop_google_core::icon::windows::set_window_hicon(hwnd, hicon);
                                            }
                                        }
                                    }
                                }
                                break;
                            }
                        }
                        std::thread::sleep(std::time::Duration::from_millis(50));
                    }

                    // Background loop: check every 30s for date change across midnight
                    loop {
                        std::thread::sleep(std::time::Duration::from_secs(30));
                        if let Ok(hwnd_obj) = win_handle.hwnd() {
                            let hwnd = hwnd_obj.0 as isize;
                            if hwnd != 0 {
                                unsafe {
                                    let day = desktop_google_core::icon::windows::get_local_day();
                                    if day != last_day {
                                        last_day = day;
                                        if let Some(ref img) = base_img {
                                            let hicon = desktop_google_core::icon::windows::render_calendar_date_hicon(
                                                img.rgba(), day,
                                            );
                                            if hicon != 0 {
                                                desktop_google_core::icon::windows::set_window_hicon(hwnd, hicon);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            }

            // Exit application directly when window close button (X) is clicked
            let app_handle_for_close = app.handle().clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { .. } = event {
                    app_handle_for_close.exit(0);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Desktop Calendar");
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
                    "DesktopCalendar",
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
                    "DesktopCalendar",
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn set_windows_autostart(_enable: bool) {}
