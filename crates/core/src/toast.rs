use std::path::Path;

/// Configuration for rendering a native Windows 11 `ToastGeneric` notification.
pub struct ToastOptions<'a> {
    pub aumid: &'a str,
    pub app_name: &'a str,
    pub title: &'a str,
    pub body: &'a str,
    pub icon_path: Option<&'a Path>,
    pub icon_crop_circle: bool,
    pub attribution: Option<&'a str>,
    pub open_label: &'a str,
    pub tag: Option<&'a str>,
    pub silent: bool,
    pub meeting_url: Option<&'a str>,
    pub account_id: Option<&'a str>,
}

/// Describes the user's action when activating a Windows toast notification.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ToastAction {
    /// Restore, unminimize, focus the application window, and optionally switch to an account.
    OpenApp(Option<String>),
    /// Launch a meeting or video conference URL in the user's default browser.
    JoinMeeting(String),
}

/// Extracts a video conference URL (Google Meet, Zoom, Teams, Webex, Jitsi) from raw text.
pub fn extract_meeting_url(text: &str) -> Option<String> {
    for raw_word in text.split_whitespace() {
        let trimmed = raw_word
            .trim_start_matches(|c: char| {
                c == '(' || c == '<' || c == '[' || c == '{' || c == '"' || c == '\''
            })
            .trim_end_matches(|c: char| {
                c == ')'
                    || c == '>'
                    || c == ']'
                    || c == '}'
                    || c == '"'
                    || c == '\''
                    || c == '.'
                    || c == ','
                    || c == ';'
                    || c == '!'
                    || c == '?'
            });

        if trimmed.is_empty() {
            continue;
        }

        let is_meet = trimmed.contains("meet.google.com/");
        let is_zoom = trimmed.contains("zoom.us/j/") || trimmed.contains("zoom.us/my/");
        let is_teams = trimmed.contains("teams.microsoft.com/l/meetup-join/")
            || trimmed.contains("teams.live.com/meet/");
        let is_webex = trimmed.contains(".webex.com/meet/")
            || (trimmed.contains(".webex.com/") && trimmed.contains("/j.php"));
        let is_jitsi = trimmed.contains("meet.jit.si/");

        if is_meet || is_zoom || is_teams || is_webex || is_jitsi {
            let candidate = if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
                format!("https://{}", trimmed)
            } else {
                trimmed.to_string()
            };

            if let Ok(parsed) = url::Url::parse(&candidate) {
                if parsed.scheme() == "http" || parsed.scheme() == "https" {
                    if let Some(host) = parsed.host_str() {
                        let host_lower = host.to_ascii_lowercase();
                        if host_lower == "meet.google.com"
                            || host_lower == "zoom.us"
                            || host_lower.ends_with(".zoom.us")
                            || host_lower == "teams.microsoft.com"
                            || host_lower == "teams.live.com"
                            || host_lower == "webex.com"
                            || host_lower.ends_with(".webex.com")
                            || host_lower == "meet.jit.si"
                        {
                            return Some(candidate);
                        }
                    }
                }
            }
        }
    }
    None
}

/// Escapes special XML characters for safe embedding inside Toast XML payloads.
pub fn escape_xml(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(ch),
        }
    }
    out
}

/// Converts a filesystem path into a `file:///` URI suitable for WinRT Toast `<image src="..."/>`.
pub fn path_to_file_uri(path: &Path) -> String {
    let raw = path.to_string_lossy().replace('\\', "/");
    if raw.starts_with("file:///") {
        raw
    } else if raw.starts_with('/') {
        format!("file://{}", raw)
    } else {
        format!("file:///{}", raw)
    }
}

/// Formats notification title, body, and attribution so the app name is not duplicated
/// between the Windows toast header and the bold notification title.
pub fn format_toast_content(
    app_name: &str,
    raw_title: &str,
    raw_body: &str,
) -> (String, String, String) {
    let trimmed_title = raw_title.trim();
    let trimmed_body = raw_body.trim();
    let is_calendar = app_name.eq_ignore_ascii_case("Desktop Calendar");
    let default_attr = if is_calendar { "Calendar" } else { "Inbox" };

    if trimmed_title.is_empty() || trimmed_title.eq_ignore_ascii_case(app_name) {
        if !is_calendar {
            if let Some(count_str) = trimmed_body
                .strip_prefix("You have ")
                .and_then(|s| s.split_whitespace().next())
                .filter(|s| s.chars().all(|c| c.is_ascii_digit()))
            {
                let count: u32 = count_str.parse().unwrap_or(1);
                let title = if count == 1 {
                    "New Unread Message".to_string()
                } else {
                    format!("{} New Unread Messages", count)
                };
                return (title, trimmed_body.to_string(), "Inbox".to_string());
            }
            if trimmed_body.contains("Notifications are working") {
                return (
                    "Notifications Enabled".to_string(),
                    trimmed_body.to_string(),
                    "Mail".to_string(),
                );
            }
            return (
                "New Mail Notification".to_string(),
                trimmed_body.to_string(),
                "Inbox".to_string(),
            );
        } else {
            if trimmed_body.contains("Notifications are working") {
                return (
                    "Notifications Enabled".to_string(),
                    trimmed_body.to_string(),
                    "Calendar".to_string(),
                );
            }
            return (
                "Upcoming Event".to_string(),
                trimmed_body.to_string(),
                "Calendar".to_string(),
            );
        }
    }

    (
        trimmed_title.to_string(),
        trimmed_body.to_string(),
        default_attr.to_string(),
    )
}

/// Builds a modern Windows 11 `ToastGeneric` XML document with `appLogoOverride`,
/// structured title/body/attribution, and a foreground open action button.
pub fn build_toast_xml(opts: &ToastOptions<'_>) -> String {
    let (formatted_title, formatted_body, default_attr) =
        format_toast_content(opts.app_name, opts.title, opts.body);
    let attribution = opts.attribution.unwrap_or(&default_attr);

    let image_xml = if let Some(path) = opts.icon_path {
        let uri = escape_xml(&path_to_file_uri(path));
        let crop = if opts.icon_crop_circle {
            "circle"
        } else {
            "none"
        };
        format!(
            "<image placement=\"appLogoOverride\" hint-crop=\"{}\" src=\"{}\"/>",
            crop, uri
        )
    } else {
        String::new()
    };

    let body_xml = if formatted_body.is_empty() {
        String::new()
    } else {
        format!("<text>{}</text>", escape_xml(&formatted_body))
    };

    let audio_xml = if opts.silent {
        "<audio silent=\"true\"/>"
    } else {
        ""
    };

    let open_arg = opts
        .account_id
        .filter(|id| !id.trim().is_empty())
        .map(|id| format!("open:{}", id.trim()))
        .unwrap_or_else(|| "open".to_string());
    let escaped_open_arg = escape_xml(&open_arg);

    let actions_xml = if let Some(meeting_url) = opts.meeting_url.filter(|u| !u.trim().is_empty()) {
        format!(
            "<actions>\
                <action content=\"Join Video Call\" arguments=\"join:{meeting_url}\" activationType=\"foreground\"/>\
                <action content=\"{open_label}\" arguments=\"{open_arg}\" activationType=\"foreground\"/>\
            </actions>",
            meeting_url = escape_xml(meeting_url.trim()),
            open_label = escape_xml(opts.open_label),
            open_arg = escaped_open_arg,
        )
    } else {
        format!(
            "<actions>\
                <action content=\"{open_label}\" arguments=\"{open_arg}\" activationType=\"foreground\"/>\
            </actions>",
            open_label = escape_xml(opts.open_label),
            open_arg = escaped_open_arg,
        )
    };

    format!(
        "<toast launch=\"{open_arg}\" activationType=\"foreground\">\
            <visual>\
                <binding template=\"ToastGeneric\">\
                    {image_xml}\
                    <text>{title}</text>\
                    {body_xml}\
                    <text placement=\"attribution\">{attribution}</text>\
                </binding>\
            </visual>\
            {actions_xml}\
            {audio_xml}\
        </toast>",
        open_arg = escaped_open_arg,
        image_xml = image_xml,
        title = escape_xml(&formatted_title),
        body_xml = body_xml,
        attribution = escape_xml(attribution),
        actions_xml = actions_xml,
        audio_xml = audio_xml,
    )
}

#[cfg(target_os = "windows")]
pub fn show_windows_toast<F>(opts: &ToastOptions<'_>, on_activate: F) -> Result<(), String>
where
    F: Fn(ToastAction) + Send + Sync + 'static,
{
    use windows::core::HSTRING;
    use windows::Data::Xml::Dom::XmlDocument;
    use windows::Foundation::TypedEventHandler;
    use windows::UI::Notifications::{
        ToastActivatedEventArgs, ToastNotification, ToastNotificationManager,
    };

    let xml = build_toast_xml(opts);
    let xml_doc = XmlDocument::new().map_err(|e| format!("XmlDocument::new failed: {e:?}"))?;
    xml_doc
        .LoadXml(&HSTRING::from(xml.as_str()))
        .map_err(|e| format!("XmlDocument::LoadXml failed: {e:?}"))?;

    let toast = ToastNotification::CreateToastNotification(&xml_doc)
        .map_err(|e| format!("CreateToastNotification failed: {e:?}"))?;

    if let Some(tag) = opts.tag {
        let clean_tag: String = tag.chars().take(64).collect();
        if !clean_tag.is_empty() {
            let _ = toast.SetTag(&HSTRING::from(clean_tag.as_str()));
        }
    }

    let fallback_account_id = opts.account_id.map(|s| s.to_string());
    let handler = TypedEventHandler::<ToastNotification, windows::core::IInspectable>::new(
        move |_sender, args| {
            let mut action = ToastAction::OpenApp(fallback_account_id.clone());
            if let Some(inspectable) = args.as_ref() {
                use windows::core::Interface;
                if let Ok(toast_args) = inspectable.cast::<ToastActivatedEventArgs>() {
                    if let Ok(args_hstring) = toast_args.Arguments() {
                        let arg_str = args_hstring.to_string_lossy();
                        if let Some(url) = arg_str.strip_prefix("join:") {
                            action = ToastAction::JoinMeeting(url.to_string());
                        } else if arg_str.starts_with("http://") || arg_str.starts_with("https://")
                        {
                            action = ToastAction::JoinMeeting(arg_str);
                        } else if let Some(acc_id) = arg_str.strip_prefix("open:") {
                            if !acc_id.trim().is_empty() {
                                action = ToastAction::OpenApp(Some(acc_id.trim().to_string()));
                            }
                        }
                    }
                }
            }
            on_activate(action);
            Ok(())
        },
    );
    let _ = toast.Activated(&handler);

    let notifier = ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(opts.aumid))
        .map_err(|e| format!("CreateToastNotifierWithId failed: {e:?}"))?;

    notifier
        .Show(&toast)
        .map_err(|e| format!("ToastNotifier::Show failed: {e:?}"))?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn show_windows_toast<F>(_opts: &ToastOptions<'_>, _on_activate: F) -> Result<(), String>
where
    F: Fn(ToastAction) + Send + Sync + 'static,
{
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_format_toast_content_deduplicates_app_name_for_unread_mail() {
        let (title, body, attr) = format_toast_content(
            "Desktop Mail",
            "Desktop Mail",
            "You have 6 new unread messages.",
        );
        assert_eq!(title, "6 New Unread Messages");
        assert_eq!(body, "You have 6 new unread messages.");
        assert_eq!(attr, "Inbox");
    }

    #[test]
    fn test_format_toast_content_preserves_sender_and_event_titles() {
        let (mail_title, mail_body, mail_attr) =
            format_toast_content("Desktop Mail", "Alice Johnson", "Q4 Roadmap Review");
        assert_eq!(mail_title, "Alice Johnson");
        assert_eq!(mail_body, "Q4 Roadmap Review");
        assert_eq!(mail_attr, "Inbox");

        let (cal_title, cal_body, cal_attr) = format_toast_content(
            "Desktop Calendar",
            "Sprint Review & Demo",
            "In 10 minutes (10:00 AM - 11:00 AM)",
        );
        assert_eq!(cal_title, "Sprint Review & Demo");
        assert_eq!(cal_body, "In 10 minutes (10:00 AM - 11:00 AM)");
        assert_eq!(cal_attr, "Calendar");
    }

    #[test]
    fn test_build_toast_xml_includes_app_logo_override_and_actions() {
        let icon = PathBuf::from(r"C:\Users\andrey\AppData\Local\com.andrey.desktop-mail\app.png");
        let xml = build_toast_xml(&ToastOptions {
            aumid: "com.andrey.desktop-mail",
            app_name: "Desktop Mail",
            title: "Desktop Mail",
            body: "You have 1 new unread message.",
            icon_path: Some(&icon),
            icon_crop_circle: false,
            attribution: None,
            open_label: "Open Mail",
            tag: Some("unread_inbox_1"),
            silent: false,
            meeting_url: None,
            account_id: None,
        });
        assert!(xml.contains("template=\"ToastGeneric\""));
        assert!(xml.contains("placement=\"appLogoOverride\""));
        assert!(xml.contains("hint-crop=\"none\""));
        assert!(
            xml.contains("file:///C:/Users/andrey/AppData/Local/com.andrey.desktop-mail/app.png")
        );
        assert!(xml.contains("<text>New Unread Message</text>"));
        assert!(xml.contains("<text placement=\"attribution\">Inbox</text>"));
        assert!(xml.contains("content=\"Open Mail\""));
        assert!(!xml.contains("silent=\"true\""));
    }

    #[test]
    fn test_build_toast_xml_escapes_special_chars_and_respects_silent() {
        let xml = build_toast_xml(&ToastOptions {
            aumid: "com.andrey.desktop-calendar",
            app_name: "Desktop Calendar",
            title: "Q&A <Team> \"Sync\"",
            body: "Room A & B",
            icon_path: None,
            icon_crop_circle: false,
            attribution: None,
            open_label: "Open Calendar",
            tag: None,
            silent: true,
            meeting_url: None,
            account_id: None,
        });
        assert!(xml.contains("Q&amp;A &lt;Team&gt; &quot;Sync&quot;"));
        assert!(xml.contains("Room A &amp; B"));
        assert!(xml.contains("<audio silent=\"true\"/>"));
    }

    #[test]
    fn test_extract_meeting_url_services_and_normalization() {
        // Google Meet
        assert_eq!(
            extract_meeting_url("Sprint Demo\nhttps://meet.google.com/abc-defg-hij"),
            Some("https://meet.google.com/abc-defg-hij".to_string())
        );
        assert_eq!(
            extract_meeting_url("Join: meet.google.com/abc-defg-hij."),
            Some("https://meet.google.com/abc-defg-hij".to_string())
        );
        assert_eq!(
            extract_meeting_url("(meet.google.com/xyz-uvwx-rst?authuser=0)"),
            Some("https://meet.google.com/xyz-uvwx-rst?authuser=0".to_string())
        );

        // Zoom
        assert_eq!(
            extract_meeting_url("Zoom call: https://us02web.zoom.us/j/1234567890?pwd=secret"),
            Some("https://us02web.zoom.us/j/1234567890?pwd=secret".to_string())
        );
        assert_eq!(
            extract_meeting_url("Personal room: zoom.us/my/johndoe!"),
            Some("https://zoom.us/my/johndoe".to_string())
        );

        // Microsoft Teams
        assert_eq!(
            extract_meeting_url(
                "Teams link: https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc"
            ),
            Some("https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc".to_string())
        );

        // Webex
        assert_eq!(
            extract_meeting_url("Webex: https://myorg.webex.com/meet/alice"),
            Some("https://myorg.webex.com/meet/alice".to_string())
        );

        // Non-meeting text & docs
        assert_eq!(extract_meeting_url("Just normal text with no link"), None);
        assert_eq!(
            extract_meeting_url("https://docs.google.com/document/d/123"),
            None
        );
    }

    #[test]
    fn test_build_toast_xml_with_meeting_action_button() {
        let xml = build_toast_xml(&ToastOptions {
            aumid: "com.andrey.desktop-calendar",
            app_name: "Desktop Calendar",
            title: "Sprint Review",
            body: "Join video call: https://meet.google.com/abc-defg-hij",
            icon_path: None,
            icon_crop_circle: false,
            attribution: None,
            open_label: "Open Calendar",
            tag: Some("cal_evt_1"),
            silent: false,
            meeting_url: Some("https://meet.google.com/abc-defg-hij"),
            account_id: None,
        });

        assert!(xml.contains("content=\"Join Video Call\""));
        assert!(xml.contains("arguments=\"join:https://meet.google.com/abc-defg-hij\""));
        assert!(xml.contains("activationType=\"foreground\""));
        assert!(xml.contains("content=\"Open Calendar\""));
        assert!(xml.contains("arguments=\"open\""));
    }

    #[test]
    fn test_build_toast_xml_multi_account_avatar_circle_and_routing() {
        let avatar = PathBuf::from(
            r"C:\Users\andrey\AppData\Local\com.andrey.desktop-mail\avatars\work.png",
        );
        let xml = build_toast_xml(&ToastOptions {
            aumid: "com.andrey.desktop-mail",
            app_name: "Desktop Mail",
            title: "Alice Johnson",
            body: "Budget approval needed",
            icon_path: Some(&avatar),
            icon_crop_circle: true,
            attribution: Some("Inbox · work@company.com"),
            open_label: "Open Mail",
            tag: Some("msg_99"),
            silent: false,
            meeting_url: None,
            account_id: Some("acct-2-123"),
        });

        assert!(xml.contains("hint-crop=\"circle\""));
        assert!(xml.contains("avatars/work.png"));
        assert!(xml.contains("<text placement=\"attribution\">Inbox · work@company.com</text>"));
        assert!(xml.contains("<toast launch=\"open:acct-2-123\" activationType=\"foreground\">"));
        assert!(xml.contains("arguments=\"open:acct-2-123\""));
    }
}
