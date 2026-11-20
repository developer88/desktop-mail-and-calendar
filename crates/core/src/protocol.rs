use serde::{Deserialize, Serialize};
use url::form_urlencoded;

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct MailtoData {
    pub to: String,
    pub cc: Option<String>,
    pub bcc: Option<String>,
    pub subject: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct IcsEventData {
    pub summary: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start: Option<String>,
    pub end: Option<String>,
}

/// Parses a RFC 6068 mailto URI into structured parameters
pub fn parse_mailto_url(raw: &str) -> Option<MailtoData> {
    if !raw.to_ascii_lowercase().starts_with("mailto:") {
        return None;
    }

    let without_prefix = &raw[7..];
    let (to_part, query_part) = match without_prefix.split_once('?') {
        Some((to, q)) => (to, Some(q)),
        None => (without_prefix, None),
    };

    let mut data = MailtoData {
        to: urlencoding_decode(to_part),
        cc: None,
        bcc: None,
        subject: None,
        body: None,
    };

    if let Some(query) = query_part {
        for (key, value) in form_urlencoded::parse(query.as_bytes()) {
            match key.to_ascii_lowercase().as_str() {
                "to" => {
                    if data.to.is_empty() {
                        data.to = value.into_owned();
                    } else {
                        data.to = format!("{}, {}", data.to, value);
                    }
                }
                "cc" => data.cc = Some(value.into_owned()),
                "bcc" => data.bcc = Some(value.into_owned()),
                "subject" => data.subject = Some(value.into_owned()),
                "body" => data.body = Some(value.into_owned()),
                _ => {}
            }
        }
    }

    Some(data)
}

/// Converts a MailtoData structure into a web compose URL that opens inside the app
pub fn to_mail_compose_url(data: &MailtoData) -> String {
    let mut params = form_urlencoded::Serializer::new(String::new());
    params.append_pair("view", "cm");
    params.append_pair("fs", "1");
    params.append_pair("tf", "1");

    if !data.to.is_empty() {
        params.append_pair("to", &data.to);
    }
    if let Some(ref su) = data.subject {
        params.append_pair("su", su);
    }
    if let Some(ref body) = data.body {
        params.append_pair("body", body);
    }
    if let Some(ref cc) = data.cc {
        params.append_pair("cc", cc);
    }
    if let Some(ref bcc) = data.bcc {
        params.append_pair("bcc", bcc);
    }

    format!("https://mail.google.com/mail/?{}", params.finish())
}

#[inline]
pub fn to_gmail_compose_url(data: &MailtoData) -> String {
    to_mail_compose_url(data)
}

/// Converts a webcal or calendar subscription feed URL into a Google Calendar subscription URL
pub fn to_calendar_subscribe_url(feed_url: &str) -> String {
    let http_url = if let Some(stripped) = feed_url.strip_prefix("webcals://") {
        format!("https://{}", stripped)
    } else if let Some(stripped) = feed_url.strip_prefix("webcals:") {
        format!("https://{}", stripped)
    } else if let Some(stripped) = feed_url.strip_prefix("webcal://") {
        format!("http://{}", stripped)
    } else if let Some(stripped) = feed_url.strip_prefix("webcal:") {
        format!("http://{}", stripped)
    } else {
        feed_url.to_string()
    };

    let encoded_cid: String = form_urlencoded::byte_serialize(http_url.as_bytes()).collect();
    format!(
        "https://calendar.google.com/calendar/u/0/r/settings/addcalendar?cid={}",
        encoded_cid
    )
}

/// Returns Google Calendar's dedicated Import & Export settings page URL
pub fn calendar_import_export_url() -> &'static str {
    "https://calendar.google.com/calendar/u/0/r/settings/export"
}

/// Unfolds lines according to RFC 5545 (lines beginning with space or tab continue the prior line)
fn unfold_ics(content: &str) -> Vec<String> {
    let mut unfolded: Vec<String> = Vec::new();
    for line in content.lines() {
        let trimmed_line = line.trim_end_matches('\r');
        if (trimmed_line.starts_with(' ') || trimmed_line.starts_with('\t')) && !unfolded.is_empty()
        {
            let last = unfolded.last_mut().unwrap();
            last.push_str(&trimmed_line[1..]);
        } else if !trimmed_line.trim().is_empty() {
            unfolded.push(trimmed_line.to_string());
        }
    }
    unfolded
}

/// Unescapes RFC 5545 escaped characters (\,, \;, \\, \n, \N)
fn unescape_ics_value(val: &str) -> String {
    let mut result = String::with_capacity(val.len());
    let mut chars = val.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.peek() {
                Some(',') => {
                    result.push(',');
                    chars.next();
                }
                Some(';') => {
                    result.push(';');
                    chars.next();
                }
                Some('\\') => {
                    result.push('\\');
                    chars.next();
                }
                Some('n') | Some('N') => {
                    result.push('\n');
                    chars.next();
                }
                _ => {
                    result.push('\\');
                }
            }
        } else {
            result.push(c);
        }
    }
    result
}

/// Parses an RFC 5545 iCalendar string.
/// Returns Some(IcsEventData) if exactly 1 VEVENT with a SUMMARY is present;
/// otherwise returns None (for multi-event files or non-event calendars).
pub fn parse_ics_content(ics_text: &str) -> Option<IcsEventData> {
    let lines = unfold_ics(ics_text);
    let mut in_vevent = false;
    let mut event_count = 0;
    let mut current_event = IcsEventData::default();

    for line in &lines {
        let upper = line.to_ascii_uppercase();
        if upper == "BEGIN:VEVENT" {
            in_vevent = true;
            event_count += 1;
            continue;
        }
        if upper == "END:VEVENT" {
            in_vevent = false;
            continue;
        }

        if in_vevent && event_count == 1 {
            if let Some((prop, val)) = line.split_once(':') {
                let prop_name = prop.split(';').next().unwrap_or(prop).to_ascii_uppercase();
                let unescaped_val = unescape_ics_value(val.trim());
                match prop_name.as_str() {
                    "SUMMARY" => {
                        current_event.summary = Some(unescaped_val);
                    }
                    "DESCRIPTION" => {
                        current_event.description = Some(unescaped_val);
                    }
                    "LOCATION" => {
                        current_event.location = Some(unescaped_val);
                    }
                    "DTSTART" => {
                        let clean_date: String = val
                            .trim()
                            .chars()
                            .filter(|c| c.is_ascii_alphanumeric())
                            .collect();
                        if !clean_date.is_empty() {
                            current_event.start = Some(clean_date);
                        }
                    }
                    "DTEND" => {
                        let clean_date: String = val
                            .trim()
                            .chars()
                            .filter(|c| c.is_ascii_alphanumeric())
                            .collect();
                        if !clean_date.is_empty() {
                            current_event.end = Some(clean_date);
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    if event_count == 1 && current_event.summary.is_some() {
        Some(current_event)
    } else {
        None
    }
}

/// Converts an IcsEventData structure into a Google Calendar event creation URL
pub fn to_calendar_event_url(event: &IcsEventData) -> String {
    let mut serializer = form_urlencoded::Serializer::new(String::new());
    if let Some(ref text) = event.summary {
        serializer.append_pair("text", text);
    }
    if let (Some(ref start), Some(ref end)) = (&event.start, &event.end) {
        serializer.append_pair("dates", &format!("{}/{}", start, end));
    } else if let Some(ref start) = event.start {
        serializer.append_pair("dates", &format!("{}/{}", start, start));
    }
    if let Some(ref details) = event.description {
        serializer.append_pair("details", details);
    }
    if let Some(ref loc) = event.location {
        serializer.append_pair("location", loc);
    }
    let query = serializer.finish();
    if query.is_empty() {
        calendar_import_export_url().to_string()
    } else {
        format!(
            "https://calendar.google.com/calendar/u/0/r/eventedit?{}",
            query
        )
    }
}

/// Resolves an incoming command-line argument, URI, or file path into the appropriate Google Calendar URL
pub fn resolve_calendar_target_url(raw: &str) -> Option<String> {
    let clean = raw.trim().trim_matches('"').trim_matches('\'');
    if clean.is_empty() {
        return None;
    }

    let lower = clean.to_ascii_lowercase();
    if lower.starts_with("webcal://")
        || lower.starts_with("webcals://")
        || lower.starts_with("webcal:")
        || lower.starts_with("webcals:")
    {
        return Some(to_calendar_subscribe_url(clean));
    }

    if lower.starts_with("http://") || lower.starts_with("https://") {
        if lower.ends_with(".ics") || lower.contains(".ics?") || lower.contains("cid=") {
            return Some(to_calendar_subscribe_url(clean));
        }
        return None;
    }

    // Handle file:// URIs or local file paths
    let file_path = if let Some(stripped) = clean.strip_prefix("file:///") {
        std::path::PathBuf::from(stripped)
    } else if let Some(stripped) = clean.strip_prefix("file://") {
        std::path::PathBuf::from(stripped)
    } else {
        std::path::PathBuf::from(clean)
    };

    if file_path.is_file() {
        if let Ok(content) = std::fs::read_to_string(&file_path) {
            if let Some(event) = parse_ics_content(&content) {
                return Some(to_calendar_event_url(&event));
            }
        }
        return Some(calendar_import_export_url().to_string());
    }

    if clean.contains("BEGIN:VCALENDAR") || clean.contains("BEGIN:VEVENT") {
        if let Some(event) = parse_ics_content(clean) {
            return Some(to_calendar_event_url(&event));
        }
        return Some(calendar_import_export_url().to_string());
    }

    if lower.ends_with(".ics") {
        return Some(calendar_import_export_url().to_string());
    }

    None
}

fn urlencoding_decode(input: &str) -> String {
    form_urlencoded::parse(input.as_bytes())
        .next()
        .map(|(k, _)| k.into_owned())
        .unwrap_or_else(|| input.to_string())
}

#[cfg(target_os = "windows")]
fn reg_set_string(
    hkey_root: windows_sys::Win32::System::Registry::HKEY,
    subkey: &str,
    value_name: Option<&str>,
    data: &str,
) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, RegSetValueExW, KEY_SET_VALUE, REG_SZ,
    };

    let subkey_w: Vec<u16> = OsStr::new(subkey)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut hkey = std::mem::zeroed();
        let status = RegCreateKeyExW(
            hkey_root,
            subkey_w.as_ptr(),
            0,
            std::ptr::null_mut(),
            0,
            KEY_SET_VALUE,
            std::ptr::null_mut(),
            &mut hkey,
            std::ptr::null_mut(),
        );
        if status != 0 || hkey.is_null() {
            return Err(format!(
                "RegCreateKeyExW failed on {} with status {}",
                subkey, status
            ));
        }

        let name_w: Vec<u16> = OsStr::new(value_name.unwrap_or(""))
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let data_w: Vec<u16> = OsStr::new(data)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let set_status = RegSetValueExW(
            hkey,
            if value_name.is_none() || value_name == Some("") {
                std::ptr::null()
            } else {
                name_w.as_ptr()
            },
            0,
            REG_SZ,
            data_w.as_ptr() as *const u8,
            (data_w.len() * 2) as u32,
        );
        RegCloseKey(hkey);
        if set_status != 0 {
            return Err(format!(
                "RegSetValueExW failed on {}\\{:?} with status {}",
                subkey, value_name, set_status
            ));
        }
    }
    Ok(())
}

/// Registers Desktop Calendar's protocol (webcal:, webcals:) and file (.ics) associations in Windows Registry (HKCU)
#[cfg(target_os = "windows")]
pub fn register_calendar_protocol_handlers(
    exe_path: Option<&std::path::Path>,
) -> Result<(), String> {
    use std::path::PathBuf;
    use windows_sys::Win32::System::Registry::HKEY_CURRENT_USER;

    let path_buf: PathBuf;
    let resolved_exe = match exe_path {
        Some(p) => p,
        None => {
            path_buf =
                std::env::current_exe().map_err(|e| format!("Failed to get current_exe: {}", e))?;
            &path_buf
        }
    };

    let exe_str = resolved_exe.to_string_lossy();
    let exe_name = resolved_exe
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("desktop-calendar.exe");
    let app_name = "Desktop Calendar";
    let aumid = "com.andrey.desktop-calendar";
    let desc = "Native-feeling Windows 11 desktop wrapper for Calendar";
    let icon_str = format!("\"{}\",0", exe_str);
    let open_cmd = format!("\"{}\" \"%1\"", exe_str);

    // 1. HKCU\Software\RegisteredApplications
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\RegisteredApplications",
        Some(app_name),
        "Software\\DesktopCalendar\\Capabilities",
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\RegisteredApplications",
        Some("DesktopCalendar"),
        "Software\\DesktopCalendar\\Capabilities",
    )?;

    // 2. HKCU\Software\DesktopCalendar\Capabilities
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\DesktopCalendar\\Capabilities",
        Some("ApplicationName"),
        app_name,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\DesktopCalendar\\Capabilities",
        Some("ApplicationCompany"),
        "Andrey Eremin",
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\DesktopCalendar\\Capabilities",
        Some("ApplicationDescription"),
        desc,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\DesktopCalendar\\Capabilities",
        Some("ApplicationIcon"),
        &icon_str,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\DesktopCalendar\\Capabilities\\URLAssociations",
        Some("webcal"),
        "DesktopCalendar.Url.webcal",
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\DesktopCalendar\\Capabilities\\URLAssociations",
        Some("webcals"),
        "DesktopCalendar.Url.webcal",
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\DesktopCalendar\\Capabilities\\FileAssociations",
        Some(".ics"),
        "DesktopCalendar.Assoc.ics",
    )?;

    // 3. HKCU\Software\Classes\Applications\<exe_name>
    let app_class = format!("Software\\Classes\\Applications\\{}", exe_name);
    reg_set_string(HKEY_CURRENT_USER, &app_class, None, app_name)?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &app_class,
        Some("FriendlyAppName"),
        app_name,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &app_class,
        Some("ApplicationName"),
        app_name,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &app_class,
        Some("ApplicationCompany"),
        "Andrey Eremin",
    )?;
    reg_set_string(HKEY_CURRENT_USER, &app_class, Some("AppUserModelId"), aumid)?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\DefaultIcon", app_class),
        None,
        &icon_str,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\SupportedProtocols\\webcal", app_class),
        None,
        "",
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\SupportedProtocols\\webcals", app_class),
        None,
        "",
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\shell\\open\\command", app_class),
        None,
        &open_cmd,
    )?;

    // 4. HKCU\Software\Classes\DesktopCalendar.Url.webcal
    let url_class = "Software\\Classes\\DesktopCalendar.Url.webcal";
    reg_set_string(HKEY_CURRENT_USER, url_class, None, app_name)?;
    reg_set_string(HKEY_CURRENT_USER, url_class, Some("URL Protocol"), "")?;
    reg_set_string(
        HKEY_CURRENT_USER,
        url_class,
        Some("FriendlyTypeName"),
        app_name,
    )?;
    reg_set_string(HKEY_CURRENT_USER, url_class, Some("AppUserModelId"), aumid)?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", url_class),
        Some("ApplicationName"),
        app_name,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", url_class),
        Some("ApplicationCompany"),
        "Andrey Eremin",
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", url_class),
        Some("ApplicationDescription"),
        desc,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", url_class),
        Some("ApplicationIcon"),
        &icon_str,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", url_class),
        Some("AppUserModelId"),
        aumid,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\DefaultIcon", url_class),
        None,
        &icon_str,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\shell\\open\\command", url_class),
        None,
        &open_cmd,
    )?;

    // 5. HKCU\Software\Classes\DesktopCalendar.Assoc.ics
    let assoc_class = "Software\\Classes\\DesktopCalendar.Assoc.ics";
    reg_set_string(HKEY_CURRENT_USER, assoc_class, None, "iCalendar File")?;
    reg_set_string(
        HKEY_CURRENT_USER,
        assoc_class,
        Some("FriendlyTypeName"),
        "iCalendar File",
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        assoc_class,
        Some("AppUserModelId"),
        aumid,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", assoc_class),
        Some("ApplicationName"),
        app_name,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", assoc_class),
        Some("ApplicationCompany"),
        "Andrey Eremin",
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", assoc_class),
        Some("ApplicationDescription"),
        desc,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", assoc_class),
        Some("ApplicationIcon"),
        &icon_str,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", assoc_class),
        Some("AppUserModelId"),
        aumid,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\DefaultIcon", assoc_class),
        None,
        &icon_str,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\shell\\open\\command", assoc_class),
        None,
        &open_cmd,
    )?;

    // 6. HKCU\Software\Classes\.ics\OpenWithProgids
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\Classes\\.ics\\OpenWithProgids",
        Some("DesktopCalendar.Assoc.ics"),
        "",
    )?;

    // 7. HKCU\Software\Clients\Calendar\Desktop Calendar
    let client_class = "Software\\Clients\\Calendar\\Desktop Calendar";
    reg_set_string(HKEY_CURRENT_USER, client_class, None, app_name)?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\DefaultIcon", client_class),
        None,
        &icon_str,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\shell\\open\\command", client_class),
        None,
        &open_cmd,
    )?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn register_calendar_protocol_handlers(
    _exe_path: Option<&std::path::Path>,
) -> Result<(), String> {
    Ok(())
}

/// Registers Desktop Mail's protocol (mailto:) association in Windows Registry (HKCU)
#[cfg(target_os = "windows")]
pub fn register_mail_protocol_handlers(exe_path: Option<&std::path::Path>) -> Result<(), String> {
    use std::path::PathBuf;
    use windows_sys::Win32::System::Registry::HKEY_CURRENT_USER;

    let path_buf: PathBuf;
    let resolved_exe = match exe_path {
        Some(p) => p,
        None => {
            path_buf =
                std::env::current_exe().map_err(|e| format!("Failed to get current_exe: {}", e))?;
            &path_buf
        }
    };

    let exe_str = resolved_exe.to_string_lossy();
    let exe_name = resolved_exe
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("desktop-mail.exe");
    let app_name = "Desktop Mail";
    let aumid = "com.andrey.desktop-mail";
    let desc = "Native-feeling Windows 11 desktop wrapper for Mail";
    let icon_str = format!("\"{}\",0", exe_str);
    let open_cmd = format!("\"{}\" \"%1\"", exe_str);

    // 1. HKCU\Software\RegisteredApplications
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\RegisteredApplications",
        Some(app_name),
        "Software\\DesktopMail\\Capabilities",
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\RegisteredApplications",
        Some("DesktopMail"),
        "Software\\DesktopMail\\Capabilities",
    )?;

    // 2. HKCU\Software\DesktopMail\Capabilities
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\DesktopMail\\Capabilities",
        Some("ApplicationName"),
        app_name,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\DesktopMail\\Capabilities",
        Some("ApplicationCompany"),
        "Andrey Eremin",
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\DesktopMail\\Capabilities",
        Some("ApplicationDescription"),
        desc,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\DesktopMail\\Capabilities",
        Some("ApplicationIcon"),
        &icon_str,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        "Software\\DesktopMail\\Capabilities\\URLAssociations",
        Some("mailto"),
        "DesktopMail.Url.mailto",
    )?;

    // 3. HKCU\Software\Classes\Applications\<exe_name>
    let app_class = format!("Software\\Classes\\Applications\\{}", exe_name);
    reg_set_string(HKEY_CURRENT_USER, &app_class, None, app_name)?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &app_class,
        Some("FriendlyAppName"),
        app_name,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &app_class,
        Some("ApplicationName"),
        app_name,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &app_class,
        Some("ApplicationCompany"),
        "Andrey Eremin",
    )?;
    reg_set_string(HKEY_CURRENT_USER, &app_class, Some("AppUserModelId"), aumid)?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\DefaultIcon", app_class),
        None,
        &icon_str,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\SupportedProtocols\\mailto", app_class),
        None,
        "",
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\shell\\open\\command", app_class),
        None,
        &open_cmd,
    )?;

    // 4. HKCU\Software\Classes\DesktopMail.Url.mailto
    let url_class = "Software\\Classes\\DesktopMail.Url.mailto";
    reg_set_string(HKEY_CURRENT_USER, url_class, None, app_name)?;
    reg_set_string(HKEY_CURRENT_USER, url_class, Some("URL Protocol"), "")?;
    reg_set_string(
        HKEY_CURRENT_USER,
        url_class,
        Some("FriendlyTypeName"),
        app_name,
    )?;
    reg_set_string(HKEY_CURRENT_USER, url_class, Some("AppUserModelId"), aumid)?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", url_class),
        Some("ApplicationName"),
        app_name,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", url_class),
        Some("ApplicationCompany"),
        "Andrey Eremin",
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", url_class),
        Some("ApplicationDescription"),
        desc,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", url_class),
        Some("ApplicationIcon"),
        &icon_str,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\Application", url_class),
        Some("AppUserModelId"),
        aumid,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\DefaultIcon", url_class),
        None,
        &icon_str,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\shell\\open\\command", url_class),
        None,
        &open_cmd,
    )?;

    // 5. HKCU\Software\Clients\Mail\Desktop Mail
    let client_class = "Software\\Clients\\Mail\\Desktop Mail";
    reg_set_string(HKEY_CURRENT_USER, client_class, None, app_name)?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\DefaultIcon", client_class),
        None,
        &icon_str,
    )?;
    reg_set_string(
        HKEY_CURRENT_USER,
        &format!("{}\\shell\\open\\command", client_class),
        None,
        &open_cmd,
    )?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn register_mail_protocol_handlers(_exe_path: Option<&std::path::Path>) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_mailto() {
        let parsed = parse_mailto_url("mailto:hello@example.com").unwrap();
        assert_eq!(parsed.to, "hello@example.com");
        assert!(parsed.subject.is_none());
        assert!(parsed.body.is_none());

        let url = to_mail_compose_url(&parsed);
        assert!(url.contains("to=hello%40example.com"));
        assert!(url.contains("view=cm"));
    }

    #[test]
    fn test_complex_mailto_with_parameters() {
        let uri =
            "mailto:alice@example.com?subject=Project%20Update&body=Hi%20Alice&cc=bob@example.com";
        let parsed = parse_mailto_url(uri).unwrap();

        assert_eq!(parsed.to, "alice@example.com");
        assert_eq!(parsed.subject.as_deref(), Some("Project Update"));
        assert_eq!(parsed.body.as_deref(), Some("Hi Alice"));
        assert_eq!(parsed.cc.as_deref(), Some("bob@example.com"));

        let compose_url = to_mail_compose_url(&parsed);
        assert!(compose_url.starts_with("https://mail.google.com/mail/?"));
        assert!(compose_url.contains("to=alice%40example.com"));
        assert!(compose_url.contains("su=Project+Update"));
        assert!(compose_url.contains("body=Hi+Alice"));
        assert!(compose_url.contains("cc=bob%40example.com"));
    }

    #[test]
    fn test_invalid_scheme() {
        assert!(parse_mailto_url("https://example.com").is_none());
        assert!(parse_mailto_url("ftp://example.com").is_none());
    }

    #[test]
    fn test_mailto_with_bcc_and_special_chars() {
        let uri = "mailto:user%2Btest@example.com?subject=Hello%20World!&bcc=secret@example.com";
        let parsed = parse_mailto_url(uri).unwrap();

        assert_eq!(parsed.to, "user+test@example.com");
        assert_eq!(parsed.subject.as_deref(), Some("Hello World!"));
        assert_eq!(parsed.bcc.as_deref(), Some("secret@example.com"));

        let compose_url = to_mail_compose_url(&parsed);
        assert!(compose_url.contains("bcc=secret%40example.com"));
        assert!(compose_url.contains("view=cm"));
        assert!(compose_url.contains("fs=1"));
    }

    #[test]
    fn test_empty_mailto_scheme() {
        let parsed = parse_mailto_url("mailto:").unwrap();
        assert_eq!(parsed.to, "");
        assert!(parsed.subject.is_none());
        let compose_url = to_mail_compose_url(&parsed);
        assert!(compose_url.contains("view=cm"));
    }

    #[test]
    fn test_calendar_subscribe_url() {
        let webcal = "webcal://example.com/calendar.ics";
        let target = to_calendar_subscribe_url(webcal);
        assert_eq!(
            target,
            "https://calendar.google.com/calendar/u/0/r/settings/addcalendar?cid=http%3A%2F%2Fexample.com%2Fcalendar.ics"
        );

        let webcals = "webcals://secure.example.com/events.ics";
        let target_s = to_calendar_subscribe_url(webcals);
        assert_eq!(
            target_s,
            "https://calendar.google.com/calendar/u/0/r/settings/addcalendar?cid=https%3A%2F%2Fsecure.example.com%2Fevents.ics"
        );
    }

    #[test]
    fn test_parse_ics_single_event() {
        let ics = "BEGIN:VCALENDAR\r\n\
VERSION:2.0\r\n\
PRODID:-//Example Corp.//EN\r\n\
BEGIN:VEVENT\r\n\
UID:event-12345@example.com\r\n\
DTSTART:20261125T140000Z\r\n\
DTEND:20261125T150000Z\r\n\
SUMMARY:Quarterly Strategy & Planning\r\n\
DESCRIPTION:Reviewing Q4 deliverables\\, roadmaps\\;\\nand next steps.\r\n\
LOCATION:Room 402 / Meet\r\n\
END:VEVENT\r\n\
END:VCALENDAR";

        let event = parse_ics_content(ics).expect("Must parse single event");
        assert_eq!(
            event.summary.as_deref(),
            Some("Quarterly Strategy & Planning")
        );
        assert_eq!(event.start.as_deref(), Some("20261125T140000Z"));
        assert_eq!(event.end.as_deref(), Some("20261125T150000Z"));
        assert_eq!(event.location.as_deref(), Some("Room 402 / Meet"));
        assert_eq!(
            event.description.as_deref(),
            Some("Reviewing Q4 deliverables, roadmaps;\nand next steps.")
        );

        let url = to_calendar_event_url(&event);
        assert!(url.starts_with("https://calendar.google.com/calendar/u/0/r/eventedit?"));
        assert!(url.contains("text=Quarterly+Strategy+%26+Planning"));
        assert!(url.contains("dates=20261125T140000Z%2F20261125T150000Z"));
        assert!(url.contains("location=Room+402+%2F+Meet"));
    }

    #[test]
    fn test_parse_ics_folded_lines() {
        let ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:A very long event title that was folded \r\n across two separate lines\r\nDTSTART:20261125T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";

        let event = parse_ics_content(ics).unwrap();
        assert_eq!(
            event.summary.as_deref(),
            Some("A very long event title that was folded across two separate lines")
        );
    }

    #[test]
    fn test_parse_ics_multiple_events_routes_to_import_page() {
        let ics = "BEGIN:VCALENDAR\r\n\
BEGIN:VEVENT\r\n\
SUMMARY:Event 1\r\n\
END:VEVENT\r\n\
BEGIN:VEVENT\r\n\
SUMMARY:Event 2\r\n\
END:VEVENT\r\n\
END:VCALENDAR";

        assert!(parse_ics_content(ics).is_none());
        let target = resolve_calendar_target_url(ics).unwrap();
        assert_eq!(target, calendar_import_export_url());
    }

    #[test]
    fn test_resolve_calendar_target_url_webcal() {
        let res = resolve_calendar_target_url("webcal://example.com/feed.ics").unwrap();
        assert!(res.contains("addcalendar?cid=http%3A%2F%2Fexample.com%2Ffeed.ics"));

        let res_s = resolve_calendar_target_url("webcals://example.com/feed.ics").unwrap();
        assert!(res_s.contains("addcalendar?cid=https%3A%2F%2Fexample.com%2Ffeed.ics"));
    }

    #[test]
    fn test_resolve_calendar_target_url_ics_string() {
        let ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Team Lunch\r\nDTSTART:20261120T120000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
        let res = resolve_calendar_target_url(ics).unwrap();
        assert!(res.contains("eventedit?"));
        assert!(res.contains("text=Team+Lunch"));
        assert!(res.contains("dates=20261120T120000Z%2F20261120T120000Z"));
    }

    #[test]
    fn test_resolve_calendar_target_url_empty_or_invalid() {
        assert!(resolve_calendar_target_url("").is_none());
        assert!(resolve_calendar_target_url("https://google.com").is_none());
    }

    #[test]
    fn test_protocol_registration_dry_run() {
        let res = register_calendar_protocol_handlers(None);
        assert!(
            res.is_ok(),
            "Calendar protocol handler registration should succeed"
        );

        let mail_res = register_mail_protocol_handlers(None);
        assert!(
            mail_res.is_ok(),
            "Mail protocol handler registration should succeed"
        );
    }
}
