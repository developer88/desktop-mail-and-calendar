use desktop_google_core::{
    scripts::{get_content_bundle, get_dialog_bundle, get_shell_bundle},
    AppKind, DesktopAppConfig,
};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    webview::WebviewBuilder,
    window::WindowBuilder,
    AppHandle, LogicalPosition, Manager, PhysicalPosition, PhysicalSize, Rect, Runtime, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};

// Standard Microsoft Edge on Windows 11 User-Agent required by Google Calendar and Google Services
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
const TITLEBAR_LOGICAL_HEIGHT: f64 = 32.0;

static CONTENT_ZOOM_BITS: AtomicU64 = AtomicU64::new(0x3ff0_0000_0000_0000); // 1.0f64

fn get_zoom() -> f64 {
    f64::from_bits(CONTENT_ZOOM_BITS.load(Ordering::Relaxed))
}

fn set_zoom_level<R: Runtime>(app: &AppHandle<R>, zoom: f64) {
    let clamped = zoom.clamp(0.5, 2.5);
    CONTENT_ZOOM_BITS.store(clamped.to_bits(), Ordering::Relaxed);
    if let Some(wv) = app.get_webview("content") {
        let _ = wv.set_zoom(clamped);
    }
}

fn titlebar_physical_height(scale_factor: f64) -> u32 {
    (TITLEBAR_LOGICAL_HEIGHT * scale_factor.max(1.0)).round() as u32
}

fn sync_child_webview_bounds<R: Runtime>(
    app: &AppHandle<R>,
    width: u32,
    height: u32,
    scale_factor: f64,
) {
    let bar_h = titlebar_physical_height(scale_factor).min(height);
    if let Some(shell) = app.get_webview("shell") {
        let _ = shell.set_bounds(Rect {
            position: PhysicalPosition::new(0, 0).into(),
            size: PhysicalSize::new(width, bar_h).into(),
        });
    }
    if let Some(content) = app.get_webview("content") {
        let _ = content.set_bounds(Rect {
            position: PhysicalPosition::new(0, bar_h as i32).into(),
            size: PhysicalSize::new(width, height.saturating_sub(bar_h)).into(),
        });
    }
}

fn open_dialog_window_impl<R: Runtime>(
    app: &AppHandle<R>,
    mode: &str,
    is_first_run: bool,
    show_immediately: bool,
) {
    let (w, h, title) = match mode {
        "welcome" => (500.0, 470.0, "Welcome to Desktop Calendar"),
        "about" => (680.0, 520.0, "About Desktop Calendar"),
        _ => (680.0, 520.0, "Settings"),
    };

    if let Some(existing) = app.get_webview_window("dialog") {
        let _ = existing.set_title(title);
        let _ = existing.set_size(tauri::LogicalSize::new(w, h));
        let js = format!(
            "window.__desktop_open_dialog_mode && window.__desktop_open_dialog_mode('{}');",
            mode
        );
        let _ = existing.eval(&js);
        if show_immediately {
            let _ = existing.center();
            let _ = existing.show();
            let _ = existing.set_focus();
        }
        return;
    }

    let dialog_script = get_dialog_bundle(AppKind::Calendar, mode, is_first_run);
    let mut builder =
        WebviewWindowBuilder::new(app, "dialog", WebviewUrl::App("dialog.html".into()))
            .title(title)
            .inner_size(w, h)
            .resizable(false)
            .decorations(false)
            .shadow(true)
            .visible(show_immediately)
            .focused(show_immediately)
            .center()
            .initialization_script(&dialog_script);

    #[cfg(target_os = "windows")]
    if let Some(main_win) = app.get_window("main") {
        if let Ok(hwnd) = main_win.hwnd() {
            builder = builder.owner_raw(hwnd);
        }
    }

    match builder.build() {
        Ok(dlg) => {
            let dlg_hide = dlg.clone();
            dlg.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = dlg_hide.hide();
                }
            });
        }
        Err(e) => {
            eprintln!("[Dialog] Failed to open {} dialog: {}", mode, e);
        }
    }
}

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
    pub fn drag_window<R: Runtime>(app: AppHandle<R>) {
        if let Some(w) = app.get_window("main") {
            let _ = w.start_dragging();
        }
    }

    #[tauri::command]
    pub fn minimize_window<R: Runtime>(app: AppHandle<R>) {
        if let Some(w) = app.get_window("main") {
            let _ = w.minimize();
        }
    }

    #[tauri::command]
    pub fn maximize_window<R: Runtime>(app: AppHandle<R>) {
        if let Some(w) = app.get_window("main") {
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
    pub fn close_dialog<R: Runtime>(app: AppHandle<R>) {
        if let Some(d) = app.get_webview_window("dialog") {
            let _ = d.hide();
        }
    }

    #[tauri::command]
    pub fn mark_first_run_completed() {
        desktop_google_core::config::mark_first_run_completed("com.andrey.desktop-calendar");
    }

    #[tauri::command]
    pub fn open_default_apps<R: Runtime>(app: AppHandle<R>) {
        use tauri_plugin_shell::ShellExt;
        let _ = app.shell().open("ms-settings:defaultapps", None);
    }

    #[tauri::command]
    pub fn register_app_protocols() -> Result<(), String> {
        desktop_google_core::register_calendar_protocol_handlers(None)
    }

    #[tauri::command]
    pub fn set_autostart_on() {
        set_windows_autostart(true);
    }

    #[tauri::command]
    pub fn set_autostart_off() {
        set_windows_autostart(false);
    }

    #[tauri::command]
    pub fn show_app_menu<R: Runtime>(app: AppHandle<R>, x: f64, y: f64) -> Result<(), String> {
        let Some(window) = app.get_window("main") else {
            return Ok(());
        };

        let file_menu = SubmenuBuilder::new(&app, "File")
            .item(
                &MenuItemBuilder::with_id("view_reload", "Reload")
                    .accelerator("CmdOrCtrl+R")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .separator()
            .item(
                &MenuItemBuilder::with_id("app_settings", "Settings...")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .item(
                &MenuItemBuilder::with_id("app_about", "About Desktop Calendar...")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .separator()
            .item(
                &MenuItemBuilder::with_id("file_exit", "Exit")
                    .accelerator("Alt+F4")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .build()
            .map_err(|e| e.to_string())?;

        let edit_menu = SubmenuBuilder::new(&app, "Edit")
            .item(
                &MenuItemBuilder::with_id("edit_undo", "Undo")
                    .accelerator("CmdOrCtrl+Z")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .item(
                &MenuItemBuilder::with_id("edit_redo", "Redo")
                    .accelerator("CmdOrCtrl+Y")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .separator()
            .item(
                &MenuItemBuilder::with_id("edit_cut", "Cut")
                    .accelerator("CmdOrCtrl+X")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .item(
                &MenuItemBuilder::with_id("edit_copy", "Copy")
                    .accelerator("CmdOrCtrl+C")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .item(
                &MenuItemBuilder::with_id("edit_paste", "Paste")
                    .accelerator("CmdOrCtrl+V")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .separator()
            .item(
                &MenuItemBuilder::with_id("edit_select_all", "Select All")
                    .accelerator("CmdOrCtrl+A")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .build()
            .map_err(|e| e.to_string())?;

        let view_menu = SubmenuBuilder::new(&app, "View")
            .item(
                &MenuItemBuilder::with_id("view_zoom_reset", "Actual Size")
                    .accelerator("CmdOrCtrl+0")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .item(
                &MenuItemBuilder::with_id("view_zoom_in", "Zoom In")
                    .accelerator("CmdOrCtrl+=")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .item(
                &MenuItemBuilder::with_id("view_zoom_out", "Zoom Out")
                    .accelerator("CmdOrCtrl+-")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .separator()
            .item(
                &MenuItemBuilder::with_id("view_fullscreen", "Toggle Fullscreen")
                    .accelerator("F11")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .build()
            .map_err(|e| e.to_string())?;

        let window_menu = SubmenuBuilder::new(&app, "Window")
            .item(
                &MenuItemBuilder::with_id("win_minimize", "Minimize")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .item(
                &MenuItemBuilder::with_id("win_maximize", "Maximize / Restore")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .separator()
            .item(
                &MenuItemBuilder::with_id("win_close", "Close")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .build()
            .map_err(|e| e.to_string())?;

        let menu = MenuBuilder::new(&app)
            .item(&file_menu)
            .item(&edit_menu)
            .item(&view_menu)
            .item(&window_menu)
            .build()
            .map_err(|e| e.to_string())?;

        window
            .popup_menu_at(&menu, LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn handle_calendar_url<R: Runtime>(
        app: AppHandle<R>,
        url_or_path: String,
    ) -> Result<(), String> {
        if let Some(target_url) = desktop_google_core::resolve_calendar_target_url(&url_or_path) {
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            if let Some(wv) = app.get_webview("content") {
                let script = format!("window.location.href = '{}';", target_url);
                let _ = wv.eval(&script);
            }
        }
        Ok(())
    }

    #[tauri::command]
    pub fn register_calendar_protocols() -> Result<(), String> {
        desktop_google_core::register_calendar_protocol_handlers(None)
    }

    #[tauri::command]
    pub fn register_calendar_jumplist() -> Result<(), String> {
        desktop_google_core::delete_jump_list("com.andrey.desktop-calendar")
    }

    #[tauri::command]
    pub fn get_windows_accent_color() -> desktop_google_core::AccentColor {
        desktop_google_core::get_windows_accent_color()
    }

    #[tauri::command]
    pub fn update_calendar_date_icon<R: Runtime>(
        app: AppHandle<R>,
        _day: u32,
        icon_rgba: Option<Vec<u8>>,
        width: Option<u32>,
        height: Option<u32>,
    ) -> Result<(), String> {
        if let Some(window) = app.get_window("main") {
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

static APP_ICON_PATH: std::sync::OnceLock<std::path::PathBuf> = std::sync::OnceLock::new();

fn show_native_toast<R: Runtime>(
    app: &AppHandle<R>,
    title: &str,
    body: &str,
    tag: Option<&str>,
    silent: bool,
    meeting_url: Option<&str>,
) {
    #[cfg(target_os = "windows")]
    {
        let app_click = app.clone();
        let opts = desktop_google_core::toast::ToastOptions {
            aumid: "com.andrey.desktop-calendar",
            app_name: "Desktop Calendar",
            title,
            body,
            icon_path: APP_ICON_PATH.get().map(|p| p.as_path()),
            attribution: None,
            open_label: "Open Calendar",
            tag,
            silent,
            meeting_url,
        };
        let action_app = app_click.clone();
        if let Err(e) =
            desktop_google_core::toast::show_windows_toast(&opts, move |action| match action {
                desktop_google_core::toast::ToastAction::JoinMeeting(url) => {
                    use tauri_plugin_shell::ShellExt;
                    let _ = action_app.shell().open(&url, None);
                }
                desktop_google_core::toast::ToastAction::OpenApp => {
                    if let Some(w) = action_app.get_window("main") {
                        let _ = w.show();
                        let _ = w.unminimize();
                        let _ = w.set_focus();
                    }
                }
            })
        {
            eprintln!(
                "[Notification] WinRT ToastGeneric failed: {}, falling back",
                e
            );
            use tauri_plugin_notification::NotificationExt;
            let _ = app.notification().builder().title(title).body(body).show();
        }
        return;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (tag, silent, meeting_url);
        use tauri_plugin_notification::NotificationExt;
        let _ = app.notification().builder().title(title).body(body).show();
    }
}

pub fn run() {
    let config = DesktopAppConfig::for_calendar();

    let mut start_url = config.initial_url.clone();
    for arg in std::env::args().skip(1) {
        let clean = arg.trim_matches('"').trim_matches('\'');
        if let Some(target) = desktop_google_core::resolve_calendar_target_url(clean) {
            start_url = target;
            break;
        }
    }

    tauri::Builder::<tauri::Wry>::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_external_url,
            commands::handle_calendar_url,
            commands::register_calendar_protocols,
            commands::register_calendar_jumplist,
            commands::get_windows_accent_color,
            commands::update_calendar_date_icon,
            commands::drag_window,
            commands::minimize_window,
            commands::maximize_window,
            commands::close_window,
            commands::close_dialog,
            commands::show_app_menu,
            commands::mark_first_run_completed,
            commands::open_default_apps,
            commands::register_app_protocols,
            commands::set_autostart_on,
            commands::set_autostart_off
        ])
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "view_reload" => {
                    if let Some(wv) = app.get_webview("content") {
                        let _ = wv.reload();
                    }
                }
                "edit_undo" => {
                    if let Some(wv) = app.get_webview("content") {
                        let _ = wv.eval("document.execCommand('undo');");
                    }
                }
                "edit_redo" => {
                    if let Some(wv) = app.get_webview("content") {
                        let _ = wv.eval("document.execCommand('redo');");
                    }
                }
                "edit_cut" => {
                    if let Some(wv) = app.get_webview("content") {
                        let _ = wv.eval("document.execCommand('cut');");
                    }
                }
                "edit_copy" => {
                    if let Some(wv) = app.get_webview("content") {
                        let _ = wv.eval("document.execCommand('copy');");
                    }
                }
                "edit_paste" => {
                    if let Some(wv) = app.get_webview("content") {
                        let _ = wv.eval("document.execCommand('paste');");
                    }
                }
                "edit_select_all" => {
                    if let Some(wv) = app.get_webview("content") {
                        let _ = wv.eval("document.execCommand('selectAll');");
                    }
                }
                "view_zoom_reset" => set_zoom_level(app, 1.0),
                "view_zoom_in" => set_zoom_level(app, get_zoom() + 0.1),
                "view_zoom_out" => set_zoom_level(app, get_zoom() - 0.1),
                "view_fullscreen" => {
                    if let Some(w) = app.get_window("main") {
                        if let Ok(is_full) = w.is_fullscreen() {
                            let _ = w.set_fullscreen(!is_full);
                        }
                    }
                }
                "win_minimize" => {
                    if let Some(w) = app.get_window("main") {
                        let _ = w.minimize();
                    }
                }
                "win_maximize" => {
                    if let Some(w) = app.get_window("main") {
                        if let Ok(is_max) = w.is_maximized() {
                            if is_max {
                                let _ = w.unmaximize();
                            } else {
                                let _ = w.maximize();
                            }
                        }
                    }
                }
                "win_close" | "file_exit" => app.exit(0),
                "app_settings" => {
                    let app_dlg = app.clone();
                    std::thread::spawn(move || {
                        open_dialog_window_impl(&app_dlg, "settings", false, true);
                    });
                }
                "app_about" => {
                    let app_dlg = app.clone();
                    std::thread::spawn(move || {
                        open_dialog_window_impl(&app_dlg, "about", false, true);
                    });
                }
                _ => {}
            }
        })
        .setup(move |app| {
            let _ = desktop_google_core::register_calendar_protocol_handlers(None);
            let _ = desktop_google_core::delete_jump_list("com.andrey.desktop-calendar");
            let icon_path = desktop_google_core::register_aumid_with_icons(
                "com.andrey.desktop-calendar",
                "Desktop Calendar",
                Some(include_bytes!("../icons/512x512.png")),
                Some(include_bytes!("../icons/icon.ico")),
            );
            if let Some(p) = icon_path {
                let _ = APP_ICON_PATH.set(p);
            }
            use tauri_plugin_notification::NotificationExt;
            let app_click = app.handle().clone();
            let _ = app.notification().on_action(move |_action| {
                if let Some(w) = app_click.get_window("main") {
                    let _ = w.show();
                    let _ = w.unminimize();
                    let _ = w.set_focus();
                }
            });

            let is_first_run = desktop_google_core::config::is_first_run("com.andrey.desktop-calendar");
            let content_script = get_content_bundle(config.kind);
            let shell_script = get_shell_bundle(config.kind);

            let initial_url = WebviewUrl::External(
                start_url
                    .parse()
                    .expect("Failed to parse initial URL for Calendar"),
            );

            let mut win_builder = WindowBuilder::new(app, "main")
                .title(&config.title)
                .inner_size(config.width, config.height)
                .min_inner_size(config.min_width, config.min_height)
                .center()
                .resizable(true)
                .decorations(false)
                .transparent(true)
                .shadow(true);

            #[cfg(target_os = "windows")]
            {
                let day = unsafe { desktop_google_core::icon::windows::get_local_day() };
                if let Ok(base_img) = tauri::image::Image::from_bytes(include_bytes!("../icons/blank_256.png")) {
                    if let Some(rgba) = unsafe {
                        desktop_google_core::icon::windows::render_calendar_date_rgba(base_img.rgba(), day)
                    } {
                        win_builder = win_builder.icon(tauri::image::Image::new_owned(rgba, 256, 256)).expect("valid icon");
                    }
                }
            }

            let window = win_builder.build()?;

            #[cfg(target_os = "windows")]
            if let Ok(hwnd_obj) = window.hwnd() {
                let hwnd = hwnd_obj.0 as isize;
                unsafe {
                    desktop_google_core::apply_window_backdrop_win32(
                        hwnd,
                        desktop_google_core::WindowBackdrop::Mica,
                    );
                }
            }

            // Spawn child webviews on a worker thread to avoid WebView2 synchronous deadlock on Windows
            let app_setup = app.handle().clone();
            let win_setup = window.clone();
            std::thread::spawn(move || {
                let scale = win_setup.scale_factor().unwrap_or(1.0);
                let size = win_setup
                    .inner_size()
                    .unwrap_or(PhysicalSize::new(config.width as u32, config.height as u32));
                let bar_h = titlebar_physical_height(scale).min(size.height);

                let shell_builder =
                    WebviewBuilder::new("shell", WebviewUrl::App("shell.html".into()))
                        .transparent(true)
                        .initialization_script(&shell_script);
                let _ = win_setup.add_child(
                    shell_builder,
                    PhysicalPosition::new(0, 0),
                    PhysicalSize::new(size.width, bar_h),
                );

                let app_cmd = app_setup.clone();
                let app_nav = app_setup.clone();
                let app_win = app_setup.clone();

                let content_builder = WebviewBuilder::new("content", initial_url)
                    .user_agent(USER_AGENT)
                    .initialization_script(&content_script)
                    .on_document_title_changed(move |_webview, title| {
                        if let Some(cmd) = title.strip_prefix("__desktop_cmd__:") {
                            if let Some(hex_data) = cmd.strip_prefix("notify:") {
                                if let Some(json_str) = desktop_google_core::scripts::from_hex(hex_data) {
                                    if let Ok(payload) = serde_json::from_str::<desktop_google_core::scripts::NotificationPayload>(&json_str) {
                                        let meeting_url = payload.meeting_url
                                            .or_else(|| payload.body.as_deref().and_then(desktop_google_core::toast::extract_meeting_url))
                                            .or_else(|| desktop_google_core::toast::extract_meeting_url(&payload.title));
                                        show_native_toast(
                                            &app_cmd,
                                            &payload.title,
                                            payload.body.as_deref().unwrap_or(""),
                                            payload.tag.as_deref(),
                                            payload.silent.unwrap_or(false),
                                            meeting_url.as_deref(),
                                        );
                                    }
                                }
                                return;
                            }
                        }
                    })
                    .on_navigation(move |url| {
                        if url.scheme() == "desktop-app" {
                            return false;
                        }

                        let url_str = url.as_str();
                        if url.scheme() == "webcal" || url.scheme() == "webcals" {
                            let target = desktop_google_core::to_calendar_subscribe_url(url_str);
                            if let Ok(parsed_target) = target.parse() {
                                if let Some(wv) = app_nav.get_webview("content") {
                                    let _ = wv.navigate(parsed_target);
                                }
                            }
                            return false;
                        }

                        if let Some(host) = url.host_str() {
                            if host == "workspace.google.com" {
                                if let Some(wv) = app_nav.get_webview("content") {
                                    let _ = wv.eval("window.location.replace('https://calendar.google.com/calendar/u/0/r');");
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
                        if url.scheme() == "webcal" || url.scheme() == "webcals" {
                            let target = desktop_google_core::to_calendar_subscribe_url(url_str);
                            if let Ok(parsed_target) = target.parse() {
                                if let Some(wv) = app_win.get_webview("content") {
                                    let _ = wv.navigate(parsed_target);
                                }
                            }
                            return tauri::webview::NewWindowResponse::Deny;
                        }

                        if let Some(host) = url.host_str() {
                            if host == "workspace.google.com" {
                                if let Some(wv) = app_win.get_webview("content") {
                                    let _ = wv.eval("window.location.replace('https://calendar.google.com/calendar/u/0/r');");
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
                            if let Some(wv) = app_win.get_webview("content") {
                                let _ = wv.navigate(url);
                            }
                            tauri::webview::NewWindowResponse::Deny
                        }
                    });

                let _ = win_setup.add_child(
                    content_builder,
                    PhysicalPosition::new(0, bar_h as i32),
                    PhysicalSize::new(size.width, size.height.saturating_sub(bar_h)),
                );

                if is_first_run {
                    let app_welcome = app_setup.clone();
                    let _ = app_setup.run_on_main_thread(move || {
                        open_dialog_window_impl(&app_welcome, "welcome", true, true);
                    });
                } else {
                    let app_prewarm = app_setup.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(600));
                        open_dialog_window_impl(&app_prewarm, "settings", false, false);
                    });
                }
            });

            #[cfg(target_os = "windows")]
            {
                let win_handle = window.clone();
                std::thread::spawn(move || {
                    let mut last_day = 0u32;
                    let base_bytes = include_bytes!("../icons/blank_256.png");
                    let base_img = tauri::image::Image::from_bytes(base_bytes).ok();

                    let update_icon = |win: &tauri::Window, current_day: u32| {
                        if let Some(ref img) = base_img {
                            unsafe {
                                if let Some(rgba) = desktop_google_core::icon::windows::render_calendar_date_rgba(
                                    img.rgba(),
                                    current_day,
                                ) {
                                    let _ = win.set_icon(tauri::image::Image::new_owned(rgba.clone(), 256, 256));
                                    if let Ok(hwnd_obj) = win.hwnd() {
                                        let hwnd = hwnd_obj.0 as isize;
                                        if hwnd != 0 {
                                            let hicon = desktop_google_core::icon::windows::create_hicon_from_rgba(
                                                &rgba,
                                                256,
                                                256,
                                            );
                                            if hicon != 0 {
                                                desktop_google_core::icon::windows::set_window_hicon(hwnd, hicon);
                                            }

                                            desktop_google_core::icon::windows::set_taskbar_overlay_icon(
                                                hwnd,
                                                0,
                                                "",
                                            );

                                            desktop_google_core::icon::windows::notify_shell_icon_cache_change();
                                        }
                                    }
                                }
                            }
                        }
                    };

                    let startup_delays_ms = [50, 100, 200, 400, 800, 1500, 3000];
                    for &delay in &startup_delays_ms {
                        std::thread::sleep(std::time::Duration::from_millis(delay));
                        let day = unsafe { desktop_google_core::icon::windows::get_local_day() };
                        last_day = day;
                        update_icon(&win_handle, day);
                    }

                    loop {
                        std::thread::sleep(std::time::Duration::from_secs(10));
                        let day = unsafe { desktop_google_core::icon::windows::get_local_day() };
                        if day != last_day {
                            last_day = day;
                            update_icon(&win_handle, day);
                        }
                    }
                });
            }

            // Keep child webview bounds synchronized on resize/DPI change and exit on close
            let app_handle_for_events = app.handle().clone();
            let win_for_events = window.clone();
            window.on_window_event(move |event| {
                match event {
                    WindowEvent::Resized(new_size) => {
                        let scale = win_for_events.scale_factor().unwrap_or(1.0);
                        sync_child_webview_bounds(
                            &app_handle_for_events,
                            new_size.width,
                            new_size.height,
                            scale,
                        );
                    }
                    WindowEvent::ScaleFactorChanged {
                        scale_factor,
                        new_inner_size,
                        ..
                    } => {
                        sync_child_webview_bounds(
                            &app_handle_for_events,
                            new_inner_size.width,
                            new_inner_size.height,
                            *scale_factor,
                        );
                    }
                    WindowEvent::CloseRequested { .. } => {
                        app_handle_for_events.exit(0);
                    }
                    _ => {}
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

#[cfg(test)]
mod tests {
    #[test]
    fn test_calendar_blank_image_and_date_render() {
        let base_bytes = include_bytes!("../icons/blank_512.png");
        let base_img = tauri::image::Image::from_bytes(base_bytes);
        assert!(
            base_img.is_ok(),
            "blank_512.png must be decoded by tauri::image::Image"
        );
        let img = base_img.unwrap();
        assert_eq!(img.width(), 512);
        assert_eq!(img.height(), 512);
        #[cfg(target_os = "windows")]
        unsafe {
            let rendered =
                desktop_google_core::icon::windows::render_calendar_date_rgba(img.rgba(), 15);
            assert!(rendered.is_some());
            let rgba = rendered.unwrap();
            assert_eq!(rgba.len(), 512 * 512 * 4);
            let hicon = desktop_google_core::icon::windows::create_hicon_from_rgba(&rgba, 512, 512);
            assert_ne!(hicon, 0);
        }
    }
}
