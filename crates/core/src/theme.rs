//! Windows 11 Personalization & Accent Color Integration
//!
//! Queries the user's active Windows 11 accent color via Win32 `DwmGetColorizationColor`
//! with graceful fallback to Windows Registry (`HKCU\Software\Microsoft\Windows\DWM`).
//! Generates scoped CSS rules strictly and exclusively for desktop wrapper UI elements.

use serde::{Deserialize, Serialize};

/// Represents an RGBA/ARGB accent color extracted from Windows personalization.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct AccentColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl AccentColor {
    /// Creates a new `AccentColor` from red, green, blue, and alpha components.
    pub const fn new(r: u8, g: u8, b: u8, a: u8) -> Self {
        Self { r, g, b, a }
    }

    /// Constructs an `AccentColor` from a raw 32-bit integer in ARGB format (0xAARRGGBB),
    /// as returned by Win32 `DwmGetColorizationColor`.
    pub const fn from_argb_u32(raw: u32) -> Self {
        let a = ((raw >> 24) & 0xFF) as u8;
        let r = ((raw >> 16) & 0xFF) as u8;
        let g = ((raw >> 8) & 0xFF) as u8;
        let b = (raw & 0xFF) as u8;
        Self { r, g, b, a }
    }

    /// Formats the RGB channels as a lowercase hex string (e.g. `"#0078d4"`).
    pub fn to_hex_rgb(&self) -> String {
        format!("#{:02x}{:02x}{:02x}", self.r, self.g, self.b)
    }

    /// Formats the ARGB channels as a lowercase hex string (e.g. `"#ff0078d4"`).
    pub fn to_hex_argb(&self) -> String {
        format!("#{:02x}{:02x}{:02x}{:02x}", self.a, self.r, self.g, self.b)
    }

    /// Formats the color as a CSS `rgba(r, g, b, a)` string with custom alpha.
    pub fn to_rgba_css(&self, alpha: f32) -> String {
        format!("rgba({}, {}, {}, {:.3})", self.r, self.g, self.b, alpha)
    }

    /// Calculates ITU-R BT.601 relative luminance (0.0 to 1.0).
    pub fn luminance(&self) -> f32 {
        (0.299 * (self.r as f32) + 0.587 * (self.g as f32) + 0.114 * (self.b as f32)) / 255.0
    }

    /// Returns whether text rendered on top of this color should be dark.
    pub fn prefers_dark_text(&self) -> bool {
        self.luminance() > 0.55
    }

    /// Produces a lighter variant of the color by moving toward white.
    pub fn lighten(&self, factor: f32) -> Self {
        let factor = factor.clamp(0.0, 1.0);
        let r = (self.r as f32 + (255.0 - self.r as f32) * factor) as u8;
        let g = (self.g as f32 + (255.0 - self.g as f32) * factor) as u8;
        let b = (self.b as f32 + (255.0 - self.b as f32) * factor) as u8;
        Self { r, g, b, a: self.a }
    }

    /// Produces a darker variant of the color by scaling toward black.
    pub fn darken(&self, factor: f32) -> Self {
        let factor = factor.clamp(0.0, 1.0);
        let r = (self.r as f32 * (1.0 - factor)) as u8;
        let g = (self.g as f32 * (1.0 - factor)) as u8;
        let b = (self.b as f32 * (1.0 - factor)) as u8;
        Self { r, g, b, a: self.a }
    }

    /// Official Windows 11 default blue accent color (`#0078d4`).
    pub const fn default_windows_accent() -> Self {
        Self {
            r: 0x00,
            g: 0x78,
            b: 0xd4,
            a: 0xff,
        }
    }
}

/// Queries the user's active Windows 11 accent color via Win32 `DwmGetColorizationColor`,
/// falling back to the Windows Registry if DWM is unavailable.
pub fn get_windows_accent_color() -> AccentColor {
    #[cfg(windows)]
    {
        if let Some(color) = query_dwm_colorization_color() {
            return color;
        }
        if let Some(color) = query_registry_accent_color() {
            return color;
        }
    }

    #[cfg(not(windows))]
    {
        if let Ok(val) = std::env::var("DESKTOP_GOOGLE_TEST_ACCENT_COLOR") {
            let hex_clean = val.trim_start_matches("0x").trim_start_matches('#');
            if let Ok(raw) = u32::from_str_radix(hex_clean, 16) {
                return if raw <= 0x00FF_FFFF {
                    AccentColor::from_argb_u32(raw | 0xFF00_0000)
                } else {
                    AccentColor::from_argb_u32(raw)
                };
            }
        }
    }

    AccentColor::default_windows_accent()
}

/// Dynamically invokes `DwmGetColorizationColor` exported by `dwmapi.dll`.
#[cfg(windows)]
pub fn query_dwm_colorization_color() -> Option<AccentColor> {
    use windows_sys::Win32::Foundation::FreeLibrary;
    use windows_sys::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryA};

    unsafe {
        let dwmapi = LoadLibraryA(b"dwmapi.dll\0".as_ptr());
        if dwmapi.is_null() {
            return None;
        }

        let proc = GetProcAddress(dwmapi, b"DwmGetColorizationColor\0".as_ptr());
        let result = if let Some(func) = proc {
            type DwmGetColorizationColorFn = unsafe extern "system" fn(*mut u32, *mut i32) -> i32;
            let func: DwmGetColorizationColorFn = std::mem::transmute(func);
            let mut color: u32 = 0;
            let mut opaque: i32 = 0;
            let hr = func(&mut color, &mut opaque);
            if hr == 0 {
                Some(AccentColor::from_argb_u32(color))
            } else {
                None
            }
        } else {
            None
        };

        FreeLibrary(dwmapi);
        result
    }
}

/// Fallback query inspecting Windows Registry `HKCU\Software\Microsoft\Windows\DWM\ColorizationColor`.
#[cfg(windows)]
pub fn query_registry_accent_color() -> Option<AccentColor> {
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ, REG_DWORD,
    };

    let subkey: Vec<u16> = "Software\\Microsoft\\Windows\\DWM\0"
        .encode_utf16()
        .collect();
    let val_name: Vec<u16> = "ColorizationColor\0".encode_utf16().collect();
    let mut hkey: HKEY = std::ptr::null_mut();

    unsafe {
        if RegOpenKeyExW(HKEY_CURRENT_USER, subkey.as_ptr(), 0, KEY_READ, &mut hkey) == 0 {
            let mut val_type: u32 = 0;
            let mut data: u32 = 0;
            let mut data_len: u32 = std::mem::size_of::<u32>() as u32;

            let res = RegQueryValueExW(
                hkey,
                val_name.as_ptr(),
                std::ptr::null_mut(),
                &mut val_type,
                &mut data as *mut u32 as *mut u8,
                &mut data_len,
            );
            RegCloseKey(hkey);

            if res == 0 && val_type == REG_DWORD {
                return Some(AccentColor::from_argb_u32(data));
            }
        }
    }
    None
}

/// Material backdrop options for Windows 11 Fluent Design window styling.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum WindowBackdrop {
    None,
    Mica,
    #[default]
    MicaAlt,
    Acrylic,
}

impl WindowBackdrop {
    /// Parses backdrop choice from a string identifier.
    pub fn from_str_name(name: &str) -> Self {
        match name.to_lowercase().trim() {
            "mica" => Self::Mica,
            "mica_alt" | "micaalt" | "tabbed" => Self::MicaAlt,
            "acrylic" => Self::Acrylic,
            "none" | "off" => Self::None,
            _ => Self::MicaAlt,
        }
    }

    /// String name of the backdrop option.
    pub fn as_str_name(&self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Mica => "mica",
            Self::MicaAlt => "mica_alt",
            Self::Acrylic => "acrylic",
        }
    }

    pub const DWMSBT_NONE: u32 = 1;
    pub const DWMSBT_MAINWINDOW: u32 = 2;
    pub const DWMSBT_TRANSIENTWINDOW: u32 = 3;
    pub const DWMSBT_TABBEDWINDOW: u32 = 4;

    /// Returns the Win32 `DWM_SYSTEMBACKDROP_TYPE` integer code.
    pub const fn to_dwmsbt_code(&self) -> u32 {
        match self {
            Self::None => Self::DWMSBT_NONE,
            Self::Mica => Self::DWMSBT_MAINWINDOW,
            Self::Acrylic => Self::DWMSBT_TRANSIENTWINDOW,
            Self::MicaAlt => Self::DWMSBT_TABBEDWINDOW,
        }
    }
}

/// Applies Windows 11 Mica, MicaAlt, or Acrylic backdrop to a window handle (HWND).
/// Supports modern Windows 11 (build 22621+ DWMWA_SYSTEMBACKDROP_TYPE)
/// with fallback to Windows 11 21H2 (build 22000 DWMWA_MICA_EFFECT).
#[cfg(windows)]
pub unsafe fn apply_window_backdrop_win32(hwnd: isize, backdrop: WindowBackdrop) -> bool {
    use windows_sys::Win32::Foundation::FreeLibrary;
    use windows_sys::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryA};

    if hwnd == 0 {
        return false;
    }

    let dwmapi = LoadLibraryA(b"dwmapi.dll\0".as_ptr());
    if dwmapi.is_null() {
        return false;
    }

    let proc = GetProcAddress(dwmapi, b"DwmSetWindowAttribute\0".as_ptr());
    let success = if let Some(func) = proc {
        type DwmSetWindowAttributeFn = unsafe extern "system" fn(
            hwnd: isize,
            dw_attribute: u32,
            pv_attribute: *const std::ffi::c_void,
            cb_attribute: u32,
        ) -> i32;
        let func: DwmSetWindowAttributeFn = std::mem::transmute(func);

        // 1. Try DWMWA_SYSTEMBACKDROP_TYPE (attribute 38, Windows 11 22H2 / build 22621+)
        const DWMWA_SYSTEMBACKDROP_TYPE: u32 = 38;
        let backdrop_type = backdrop.to_dwmsbt_code();
        let hr = func(
            hwnd,
            DWMWA_SYSTEMBACKDROP_TYPE,
            &backdrop_type as *const u32 as *const std::ffi::c_void,
            std::mem::size_of::<u32>() as u32,
        );

        if hr == 0 {
            true
        } else if backdrop == WindowBackdrop::Mica || backdrop == WindowBackdrop::MicaAlt {
            // 2. Fallback for Windows 11 21H2 (build 22000): DWMWA_MICA_EFFECT = 1029
            const DWMWA_MICA_EFFECT: u32 = 1029;
            let enable_mica: i32 = 1;
            let hr2 = func(
                hwnd,
                DWMWA_MICA_EFFECT,
                &enable_mica as *const i32 as *const std::ffi::c_void,
                std::mem::size_of::<i32>() as u32,
            );
            hr2 == 0
        } else {
            false
        }
    } else {
        false
    };

    FreeLibrary(dwmapi);
    success
}

#[cfg(not(windows))]
pub unsafe fn apply_window_backdrop_win32(hwnd: isize, _backdrop: WindowBackdrop) -> bool {
    if hwnd == 0 {
        return false;
    }
    true
}

/// Generates scoped CSS rules strictly and exclusively for wrapper UI elements.
///
/// Under NO circumstances are Google web elements, banner icons, or internal DOM modified.
pub fn generate_accent_css(accent: &AccentColor) -> String {
    let hex = accent.to_hex_rgb();
    let hover_hex = accent.darken(0.12).to_hex_rgb();
    let subtle_light = accent.to_rgba_css(0.12);
    let subtle_dark = accent.to_rgba_css(0.24);
    let border_color = accent.to_rgba_css(0.35);
    let light_hex = accent.lighten(0.70).to_hex_rgb();
    let text_color = if accent.prefers_dark_text() {
        "#1e293b"
    } else {
        "#ffffff"
    };

    format!(
        r#"/* Windows 11 Personalization Accent Color Override (Scoped strictly to Desktop Wrapper UI) */
:root, :root:root, html {{
  --win11-accent: {hex};
  --win11-wrapper-accent: {hex};
  --win11-wrapper-accent-rgb: {r}, {g}, {b};
  --win11-wrapper-accent-hover: {hover_hex};
  --win11-wrapper-accent-subtle: {subtle_light};
  --win11-wrapper-accent-subtle-dark: {subtle_dark};
  --win11-wrapper-accent-border: {border_color};
  --win11-wrapper-accent-light: {light_hex};
  --win11-wrapper-accent-text: {text_color};
}}

/* 1. Frameless Titlebar Update Pill */
#desktop-custom-titlebar .desktop-caption-update-pill {{
  background: var(--win11-wrapper-accent, {hex}) !important;
  color: var(--win11-wrapper-accent-text, {text_color}) !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25) !important;
}}

#desktop-custom-titlebar .desktop-caption-update-pill:hover {{
  background: var(--win11-wrapper-accent-hover, {hover_hex}) !important;
  filter: brightness(1.08) !important;
}}

/* 2. Caption Hover Accents (excluding close button) */
#desktop-custom-titlebar .desktop-caption-btn:not(.close):hover {{
  background: var(--win11-wrapper-accent-subtle, {subtle_light}) !important;
  color: var(--win11-wrapper-accent, {hex}) !important;
}}

#desktop-custom-titlebar.dark-mode .desktop-caption-btn:not(.close):hover,
#desktop-custom-titlebar.calendar-titlebar.dark-mode .desktop-caption-btn:not(.close):hover {{
  background: var(--win11-wrapper-accent-subtle-dark, {subtle_dark}) !important;
  color: var(--win11-wrapper-accent-light, {light_hex}) !important;
}}

/* 3. Settings Modal Tabs */
.desktop-settings-nav-item.active,
#desktop-settings-dialog .desktop-settings-nav-item.active {{
  background: var(--win11-wrapper-accent-subtle, {subtle_light}) !important;
  color: var(--win11-wrapper-accent, {hex}) !important;
  font-weight: 600 !important;
}}

@media (prefers-color-scheme: dark) {{
  .desktop-settings-nav-item.active,
  #desktop-settings-dialog .desktop-settings-nav-item.active {{
    background: var(--win11-wrapper-accent-subtle-dark, {subtle_dark}) !important;
    color: var(--win11-wrapper-accent-light, {light_hex}) !important;
  }}
}}

.desktop-settings-nav-item:hover:not(.active) {{
  background: var(--win11-wrapper-accent-subtle, {subtle_light}) !important;
}}

/* 4. About Dialog & Settings Modal Buttons and Highlights */
.desktop-settings-done-btn,
#desktop-settings-dialog .desktop-settings-done-btn {{
  background: var(--win11-wrapper-accent, {hex}) !important;
  color: var(--win11-wrapper-accent-text, {text_color}) !important;
}}

.desktop-settings-done-btn:hover,
#desktop-settings-dialog .desktop-settings-done-btn:hover {{
  background: var(--win11-wrapper-accent-hover, {hover_hex}) !important;
}}

.desktop-update-btn {{
  border-color: var(--win11-wrapper-accent, {hex}) !important;
  color: var(--win11-wrapper-accent, {hex}) !important;
}}

.desktop-update-btn:hover {{
  background: var(--win11-wrapper-accent-subtle, {subtle_light}) !important;
}}

.desktop-settings-action-btn,
.desktop-test-notif-btn,
#desktop-settings-dialog .desktop-settings-action-btn,
#desktop-settings-dialog .desktop-test-notif-btn {{
  color: var(--win11-wrapper-accent, {hex}) !important;
  border-color: var(--win11-wrapper-accent-border, {border_color}) !important;
}}

.desktop-settings-action-btn:hover,
.desktop-test-notif-btn:hover,
#desktop-settings-dialog .desktop-settings-action-btn:hover,
#desktop-settings-dialog .desktop-test-notif-btn:hover {{
  background: var(--win11-wrapper-accent-subtle, {subtle_light}) !important;
  border-color: var(--win11-wrapper-accent, {hex}) !important;
}}

.desktop-toggle-switch.on,
#desktop-settings-dialog .desktop-toggle-switch.on {{
  background: var(--win11-wrapper-accent, {hex}) !important;
  border-color: var(--win11-wrapper-accent, {hex}) !important;
}}

.desktop-update-action-btn {{
  background: var(--win11-wrapper-accent, {hex}) !important;
  color: var(--win11-wrapper-accent-text, {text_color}) !important;
}}

.desktop-update-action-btn:hover {{
  background: var(--win11-wrapper-accent-hover, {hover_hex}) !important;
}}
"#,
        hex = hex,
        r = accent.r,
        g = accent.g,
        b = accent.b,
        hover_hex = hover_hex,
        subtle_light = subtle_light,
        subtle_dark = subtle_dark,
        border_color = border_color,
        light_hex = light_hex,
        text_color = text_color
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_accent_color_from_argb_u32() {
        // Test Windows default 0xFF0078D4
        let color = AccentColor::from_argb_u32(0xFF0078D4);
        assert_eq!(color.a, 255);
        assert_eq!(color.r, 0);
        assert_eq!(color.g, 120);
        assert_eq!(color.b, 212);
        assert_eq!(color.to_hex_rgb(), "#0078d4");
        assert_eq!(color.to_hex_argb(), "#ff0078d4");
        assert_eq!(color.to_rgba_css(0.15), "rgba(0, 120, 212, 0.150)");
    }

    #[test]
    fn test_accent_color_luminance_and_shades() {
        let dark_color = AccentColor::new(10, 10, 10, 255);
        assert!(!dark_color.prefers_dark_text());

        let bright_color = AccentColor::new(250, 250, 250, 255);
        assert!(bright_color.prefers_dark_text());

        let base = AccentColor::new(100, 150, 200, 255);
        let light = base.lighten(0.5);
        assert!(light.r > base.r);
        assert!(light.g > base.g);
        assert!(light.b > base.b);

        let dark = base.darken(0.3);
        assert!(dark.r < base.r);
        assert!(dark.g < base.g);
        assert!(dark.b < base.b);
    }

    #[test]
    fn test_generate_accent_css_scope_and_elements() {
        let accent = AccentColor::new(0, 120, 212, 255);
        let css = generate_accent_css(&accent);

        // Verify variables
        assert!(css.contains("--win11-accent: #0078d4;"));
        assert!(css.contains("--win11-wrapper-accent: #0078d4;"));
        assert!(css.contains("--win11-wrapper-accent-rgb: 0, 120, 212;"));

        // Verify required UI elements
        assert!(css.contains("#desktop-custom-titlebar .desktop-caption-update-pill"));
        assert!(css.contains("#desktop-custom-titlebar .desktop-caption-btn:not(.close):hover"));
        assert!(css.contains(".desktop-settings-nav-item.active"));
        assert!(css.contains(".desktop-settings-done-btn"));
        assert!(css.contains(".desktop-update-btn"));
        assert!(css.contains(".desktop-toggle-switch.on"));
        assert!(css.contains(".desktop-settings-action-btn"));

        // Verify strict isolation from Google elements
        assert!(!css.contains("header {"));
        assert!(!css.contains("body {"));
        assert!(!css.contains("div {"));
        assert!(!css.contains(".gb_"));
    }

    #[test]
    fn test_get_windows_accent_color_fallback() {
        let accent = get_windows_accent_color();
        assert_eq!(accent.a, 255);
        // Under test environment without env var, falls back to Windows 11 default
        assert_eq!(accent.to_hex_rgb(), "#0078d4");
    }

    #[test]
    fn test_window_backdrop_parsing_and_codes() {
        assert_eq!(WindowBackdrop::from_str_name("mica"), WindowBackdrop::Mica);
        assert_eq!(
            WindowBackdrop::from_str_name("mica_alt"),
            WindowBackdrop::MicaAlt
        );
        assert_eq!(
            WindowBackdrop::from_str_name("tabbed"),
            WindowBackdrop::MicaAlt
        );
        assert_eq!(
            WindowBackdrop::from_str_name("acrylic"),
            WindowBackdrop::Acrylic
        );
        assert_eq!(WindowBackdrop::from_str_name("none"), WindowBackdrop::None);

        assert_eq!(WindowBackdrop::None.to_dwmsbt_code(), 1);
        assert_eq!(WindowBackdrop::Mica.to_dwmsbt_code(), 2);
        assert_eq!(WindowBackdrop::Acrylic.to_dwmsbt_code(), 3);
        assert_eq!(WindowBackdrop::MicaAlt.to_dwmsbt_code(), 4);

        assert_eq!(WindowBackdrop::MicaAlt.as_str_name(), "mica_alt");
        unsafe {
            assert!(apply_window_backdrop_win32(0, WindowBackdrop::MicaAlt) == false);
        }
    }
}
