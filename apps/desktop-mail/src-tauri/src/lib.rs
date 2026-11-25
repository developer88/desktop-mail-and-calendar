use desktop_google_core::{
    scripts::{get_content_bundle, get_dialog_bundle, get_shell_bundle, ThemePayload},
    AppKind, DesktopAppConfig,
};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    webview::WebviewBuilder,
    window::WindowBuilder,
    AppHandle, LogicalPosition, Manager, PhysicalPosition, PhysicalSize, Rect, Runtime, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};

// Standard Microsoft Edge on Windows 11 User-Agent required by Google Services
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

fn open_dialog_window_impl<R: Runtime>(app: &AppHandle<R>, mode: &str, is_first_run: bool) {
    if let Some(existing) = app.get_webview_window("dialog") {
        let _ = existing.close();
    }

    let (w, h, title) = match mode {
        "welcome" => (500.0, 470.0, "Welcome to Desktop Mail"),
        "about" => (680.0, 520.0, "About Desktop Mail"),
        _ => (680.0, 520.0, "Settings"),
    };

    let dialog_script = get_dialog_bundle(AppKind::Mail, mode, is_first_run);
    let mut builder =
        WebviewWindowBuilder::new(app, "dialog", WebviewUrl::App("dialog.html".into()))
            .title(title)
            .inner_size(w, h)
            .resizable(false)
            .decorations(false)
            .shadow(true)
            .center()
            .initialization_script(&dialog_script);

    #[cfg(target_os = "windows")]
    if let Some(main_win) = app.get_window("main") {
        if let Ok(hwnd) = main_win.hwnd() {
            builder = builder.parent_raw(hwnd);
        }
    }

    let _ = builder.build();
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
    pub fn update_unread_badge<R: Runtime>(
        app: AppHandle<R>,
        count: u32,
        icon_rgba: Option<Vec<u8>>,
        overlay_rgba: Option<Vec<u8>>,
        width: Option<u32>,
        height: Option<u32>,
    ) -> Result<(), String> {
        if let Some(window) = app.get_window("main") {
            apply_unread_count(&window, count, icon_rgba, overlay_rgba, width, height);
        }
        Ok(())
    }

    #[tauri::command]
    pub fn handle_mailto<R: Runtime>(app: AppHandle<R>, mailto: String) -> Result<(), String> {
        if let Some(target_url) = desktop_google_core::resolve_mail_target_url(&mailto) {
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
    pub fn handle_mail_url<R: Runtime>(
        app: AppHandle<R>,
        url_or_path: String,
    ) -> Result<(), String> {
        if let Some(target_url) = desktop_google_core::resolve_mail_target_url(&url_or_path) {
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
    pub fn register_mail_jumplist() -> Result<(), String> {
        desktop_google_core::delete_jump_list("com.andrey.desktop-mail")
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
    pub fn register_mail_protocols() -> Result<(), String> {
        desktop_google_core::register_mail_protocol_handlers(None)
    }

    #[tauri::command]
    pub fn get_windows_accent_color() -> desktop_google_core::AccentColor {
        desktop_google_core::get_windows_accent_color()
    }

    #[tauri::command]
    pub fn close_window<R: Runtime>(app: AppHandle<R>) {
        app.exit(0);
    }

    #[tauri::command]
    pub fn close_dialog<R: Runtime>(app: AppHandle<R>) {
        if let Some(d) = app.get_webview_window("dialog") {
            let _ = d.close();
        }
    }

    #[tauri::command]
    pub fn mark_first_run_completed() {
        desktop_google_core::config::mark_first_run_completed("com.andrey.desktop-mail");
    }

    #[tauri::command]
    pub fn open_default_apps<R: Runtime>(app: AppHandle<R>) {
        use tauri_plugin_shell::ShellExt;
        let _ = app.shell().open("ms-settings:defaultapps", None);
    }

    #[tauri::command]
    pub fn register_app_protocols() -> Result<(), String> {
        desktop_google_core::register_mail_protocol_handlers(None)
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
                &MenuItemBuilder::with_id("file_new_message", "New Message")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
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
            .item(&PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?)
            .item(
                &MenuItemBuilder::with_id("app_settings_top", "Settings...")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .item(
                &MenuItemBuilder::with_id("app_about", "About Desktop Mail...")
                    .build(&app)
                    .map_err(|e| e.to_string())?,
            )
            .build()
            .map_err(|e| e.to_string())?;

        window
            .popup_menu_at(&menu, LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())
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
            aumid: "com.andrey.desktop-mail",
            app_name: "Desktop Mail",
            title,
            body,
            icon_path: APP_ICON_PATH.get().map(|p| p.as_path()),
            attribution: None,
            open_label: "Open Mail",
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

fn apply_unread_count<R: Runtime>(
    window: &tauri::Window<R>,
    count: u32,
    icon_rgba: Option<Vec<u8>>,
    overlay_rgba: Option<Vec<u8>>,
    width: Option<u32>,
    height: Option<u32>,
) {
    let title = if count > 0 {
        format!("Desktop Mail ({})", count)
    } else {
        "Desktop Mail".to_string()
    };
    let _ = window.set_title(&title);

    #[cfg(target_os = "windows")]
    if let Ok(hwnd_obj) = window.hwnd() {
        let hwnd = hwnd_obj.0 as isize;
        unsafe {
            if count > 0 {
                if let (Some(rgba), Some(w), Some(h)) = (icon_rgba, width, height) {
                    let hicon =
                        desktop_google_core::icon::windows::create_hicon_from_rgba(&rgba, w, h);
                    if hicon != 0 {
                        desktop_google_core::icon::windows::set_window_hicon(hwnd, hicon);
                    }
                } else if let Ok(img) =
                    tauri::image::Image::from_bytes(include_bytes!("../icons/512x512.png"))
                {
                    let hicon = desktop_google_core::icon::windows::render_mail_badged_hicon(
                        img.rgba(),
                        count,
                    );
                    if hicon != 0 {
                        desktop_google_core::icon::windows::set_window_hicon(hwnd, hicon);
                    }
                }

                if let Some(ol_rgba) = overlay_rgba {
                    let ol_size = if ol_rgba.len() == (64 * 64 * 4) {
                        64
                    } else {
                        32
                    };
                    let ol_hicon = desktop_google_core::icon::windows::create_hicon_from_rgba(
                        &ol_rgba, ol_size, ol_size,
                    );
                    if ol_hicon != 0 {
                        let desc = format!("{} unread", count);
                        desktop_google_core::icon::windows::set_taskbar_overlay_icon(
                            hwnd, ol_hicon, &desc,
                        );
                    }
                } else {
                    let ol_hicon = desktop_google_core::icon::windows::render_overlay_hicon(count);
                    if ol_hicon != 0 {
                        let desc = format!("{} unread", count);
                        desktop_google_core::icon::windows::set_taskbar_overlay_icon(
                            hwnd, ol_hicon, &desc,
                        );
                    }
                }
            } else {
                desktop_google_core::icon::windows::set_taskbar_overlay_icon(hwnd, 0, "");
                if let Ok(img) =
                    tauri::image::Image::from_bytes(include_bytes!("../icons/512x512.png"))
                {
                    let hicon = desktop_google_core::icon::windows::create_hicon_from_rgba(
                        img.rgba(),
                        img.width(),
                        img.height(),
                    );
                    if hicon != 0 {
                        desktop_google_core::icon::windows::set_window_hicon(hwnd, hicon);
                    }
                }
            }
        }
    }
}

pub fn run() {
    let config = DesktopAppConfig::for_mail();

    let mut start_url = config.initial_url.clone();
    for arg in std::env::args().skip(1) {
        let clean = arg.trim_matches('"').trim_matches('\'');
        if let Some(target) = desktop_google_core::resolve_mail_target_url(clean) {
            start_url = target;
            break;
        }
    }

    tauri::Builder::<tauri::Wry>::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_external_url,
            commands::update_unread_badge,
            commands::handle_mailto,
            commands::handle_mail_url,
            commands::register_mail_protocols,
            commands::register_mail_jumplist,
            commands::get_windows_accent_color,
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
                "file_new_message" => {
                    if let Some(wv) = app.get_webview("content") {
                        let _ = wv.eval("window.location.href = 'https://mail.google.com/mail/u/0/#compose';");
                    }
                }
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
                "app_settings" | "app_settings_top" => {
                    open_dialog_window_impl(app, "settings", false);
                }
                "app_about" => {
                    open_dialog_window_impl(app, "about", false);
                }
                _ => {}
            }
        })
        .setup(move |app| {
            let _ = desktop_google_core::register_mail_protocol_handlers(None);
            let _ = desktop_google_core::delete_jump_list("com.andrey.desktop-mail");
            let icon_path = desktop_google_core::register_aumid_with_icons(
                "com.andrey.desktop-mail",
                "Desktop Mail",
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

            let is_first_run = desktop_google_core::config::is_first_run("com.andrey.desktop-mail");
            let content_script = get_content_bundle(config.kind);
            let shell_script = get_shell_bundle(config.kind);

            let initial_url = WebviewUrl::External(
                start_url
                    .parse()
                    .expect("Failed to parse initial URL for Mail"),
            );

            let window = WindowBuilder::new(app, "main")
                .title(&config.title)
                .inner_size(config.width, config.height)
                .min_inner_size(config.min_width, config.min_height)
                .center()
                .resizable(true)
                .decorations(false)
                .shadow(true)
                .build()?;

            #[cfg(target_os = "windows")]
            if let Ok(hwnd_obj) = window.hwnd() {
                let hwnd = hwnd_obj.0 as isize;
                unsafe {
                    desktop_google_core::icon::windows::set_window_relaunch_properties(
                        hwnd,
                        "com.andrey.desktop-mail",
                        "Desktop Mail",
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
                        .initialization_script(&shell_script);
                let _ = win_setup.add_child(
                    shell_builder,
                    PhysicalPosition::new(0, 0),
                    PhysicalSize::new(size.width, bar_h),
                );

                let app_cmd = app_setup.clone();
                let win_cmd = win_setup.clone();
                let app_nav = app_setup.clone();
                let app_win = app_setup.clone();

                let content_builder = WebviewBuilder::new("content", initial_url)
                    .user_agent(USER_AGENT)
                    .initialization_script(&content_script)
                    .on_document_title_changed(move |_webview, title| {
                        if let Some(cmd) = title.strip_prefix("__desktop_cmd__:") {
                            if let Some(hex_data) = cmd.strip_prefix("notify:") {
                                if let Some(json_str) =
                                    desktop_google_core::scripts::from_hex(hex_data)
                                {
                                    if let Ok(payload) =
                                        serde_json::from_str::<
                                            desktop_google_core::scripts::NotificationPayload,
                                        >(&json_str)
                                    {
                                        let meeting_url = payload
                                            .meeting_url
                                            .or_else(|| {
                                                payload.body.as_deref().and_then(
                                                    desktop_google_core::toast::extract_meeting_url,
                                                )
                                            })
                                            .or_else(|| {
                                                desktop_google_core::toast::extract_meeting_url(
                                                    &payload.title,
                                                )
                                            });
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
                            if let Some(hex_data) = cmd.strip_prefix("theme:") {
                                if let Some(json_str) =
                                    desktop_google_core::scripts::from_hex(hex_data)
                                {
                                    if let Ok(theme) = serde_json::from_str::<ThemePayload>(&json_str)
                                    {
                                        if let Some(shell) = app_cmd.get_webview("shell") {
                                            let bg_json = serde_json::to_string(&theme.bg_color)
                                                .unwrap_or_else(|_| "null".to_string());
                                            let js = format!(
                                                "window.__desktop_shell_set_theme && window.__desktop_shell_set_theme({}, {});",
                                                theme.is_dark, bg_json
                                            );
                                            let _ = shell.eval(&js);
                                        }
                                    }
                                }
                                return;
                            }
                            if let Some(unread_str) = cmd.strip_prefix("unread:") {
                                if let Ok(count) = unread_str.parse::<u32>() {
                                    apply_unread_count(&win_cmd, count, None, None, None, None);
                                }
                                return;
                            }
                        } else {
                            // Extract unread count from natural Gmail title: e.g. "Inbox (66) - ...", "(66) Inbox", "Posteingang (12)"
                            if let Some(start) = title.find('(') {
                                if let Some(end) = title[start..].find(')') {
                                    let inner = &title[start + 1..start + end];
                                    let raw = inner.replace(',', "");
                                    let parsed_count = if raw.ends_with('+') {
                                        raw[..raw.len() - 1].parse::<u32>().ok()
                                    } else if raw.to_lowercase().ends_with('k') {
                                        raw[..raw.len() - 1]
                                            .parse::<f32>()
                                            .ok()
                                            .map(|k| (k * 1000.0) as u32)
                                    } else {
                                        raw.parse::<u32>().ok()
                                    };
                                    if let Some(count) = parsed_count {
                                        apply_unread_count(&win_cmd, count, None, None, None, None);
                                    }
                                }
                            }
                        }
                    })
                    .on_navigation(move |url| {
                        if url.scheme() == "desktop-app" {
                            return false;
                        }

                        let url_str = url.as_str();
                        if let Some(host) = url.host_str() {
                            if host == "workspace.google.com" {
                                if let Some(wv) = app_nav.get_webview("content") {
                                    let _ = wv.eval(
                                        "window.location.replace('https://mail.google.com/mail/u/0/');",
                                    );
                                }
                                return false;
                            }
                        }

                        if desktop_google_core::should_open_in_external_browser(
                            url_str,
                            desktop_google_core::AppKind::Mail,
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
                                if let Some(wv) = app_win.get_webview("content") {
                                    let _ = wv.eval(
                                        "window.location.replace('https://mail.google.com/mail/u/0/');",
                                    );
                                }
                                return tauri::webview::NewWindowResponse::Deny;
                            }
                        }

                        if desktop_google_core::should_open_in_external_browser(
                            url_str,
                            desktop_google_core::AppKind::Mail,
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
                        open_dialog_window_impl(&app_welcome, "welcome", true);
                    });
                }
            });

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
        .expect("error while running Desktop Mail");
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
                    "DesktopMail",
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
                    "DesktopMail",
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn set_windows_autostart(_enable: bool) {}
