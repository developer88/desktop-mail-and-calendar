pub mod accounts;
pub mod aumid;
pub mod config;
pub mod icon;
pub mod jumplist;
pub mod navigation;
pub mod protocol;
pub mod scripts;
pub mod theme;
pub mod toast;

pub use aumid::{register_aumid, register_aumid_with_icons};
pub use config::{AppKind, DesktopAppConfig};
pub use jumplist::{
    delete_jump_list, get_calendar_jumplist_tasks, get_mail_jumplist_tasks, register_jump_list,
    JumpListTask,
};
pub use navigation::{
    classify_url, extract_redirect_target, get_external_browser_target, is_google_host,
    should_open_in_external_browser, UrlCategory,
};
pub use protocol::{
    calendar_import_export_url, parse_ics_content, parse_mailto_url,
    register_calendar_protocol_handlers, register_mail_protocol_handlers,
    resolve_calendar_target_url, resolve_mail_target_url, to_calendar_event_url,
    to_calendar_subscribe_url, to_gmail_compose_url, to_mail_compose_url, IcsEventData, MailtoData,
};
pub use theme::{
    apply_window_backdrop_win32, generate_accent_css, get_windows_accent_color, AccentColor,
    WindowBackdrop,
};
