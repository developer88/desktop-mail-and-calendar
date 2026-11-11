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

fn urlencoding_decode(input: &str) -> String {
    form_urlencoded::parse(input.as_bytes())
        .next()
        .map(|(k, _)| k.into_owned())
        .unwrap_or_else(|| input.to_string())
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
}
