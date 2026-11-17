#[cfg(target_os = "windows")]
pub fn register_aumid(aumid: &str, display_name: &str) -> Option<std::path::PathBuf> {
    register_aumid_with_icons(aumid, display_name, None, None)
}

#[cfg(target_os = "windows")]
pub fn register_aumid_with_icons(
    aumid: &str,
    display_name: &str,
    icon_png_bytes: Option<&[u8]>,
    icon_ico_bytes: Option<&[u8]>,
) -> Option<std::path::PathBuf> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE,
        REG_DWORD, REG_SZ,
    };

    // 1. Resolve or extract permanent icon files on disk
    let mut resolved_png_path: Option<std::path::PathBuf> = None;
    let mut resolved_ico_path: Option<std::path::PathBuf> = None;

    // Check application directory first (e.g. installed app with bundled app.png / app.ico)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let p_png = parent.join("app.png");
            if p_png.is_file() {
                resolved_png_path = Some(p_png);
            }
            let p_ico = parent.join("app.ico");
            if p_ico.is_file() {
                resolved_ico_path = Some(p_ico);
            }
        }
    }

    // Ensure icon files exist in %LOCALAPPDATA%/<aumid>/ as permanent fallback & standalone cache
    if let Some(local_appdata) = std::env::var_os("LOCALAPPDATA") {
        let app_dir = std::path::PathBuf::from(local_appdata).join(aumid);
        let _ = std::fs::create_dir_all(&app_dir);

        let target_png = app_dir.join("app.png");
        if let Some(bytes) = icon_png_bytes {
            let _ = std::fs::write(&target_png, bytes);
            resolved_png_path = Some(target_png);
        } else if resolved_png_path.is_none() && target_png.is_file() {
            resolved_png_path = Some(target_png);
        }

        let target_ico = app_dir.join("app.ico");
        if let Some(bytes) = icon_ico_bytes {
            let _ = std::fs::write(&target_ico, bytes);
            resolved_ico_path = Some(target_ico);
        } else if resolved_ico_path.is_none() && target_ico.is_file() {
            resolved_ico_path = Some(target_ico);
        }
    }

    // 2. Register HKCU\Software\Classes\AppUserModelId\<aumid>
    let subkey_str = format!("Software\\Classes\\AppUserModelId\\{}", aumid);
    let subkey_w: Vec<u16> = OsStr::new(&subkey_str)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut hkey: HKEY = std::mem::zeroed();
        let status = RegCreateKeyExW(
            HKEY_CURRENT_USER,
            subkey_w.as_ptr(),
            0,
            std::ptr::null_mut(),
            0,
            KEY_SET_VALUE,
            std::ptr::null_mut(),
            &mut hkey,
            std::ptr::null_mut(),
        );

        if status == 0 && !hkey.is_null() {
            let name_disp_w: Vec<u16> = OsStr::new("DisplayName")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let val_disp_w: Vec<u16> = OsStr::new(display_name)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let _ = RegSetValueExW(
                hkey,
                name_disp_w.as_ptr(),
                0,
                REG_SZ,
                val_disp_w.as_ptr() as *const u8,
                (val_disp_w.len() * 2) as u32,
            );

            let name_show_w: Vec<u16> = OsStr::new("ShowInSettings")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let val_show: u32 = 1;
            let _ = RegSetValueExW(
                hkey,
                name_show_w.as_ptr(),
                0,
                REG_DWORD,
                &val_show as *const u32 as *const u8,
                std::mem::size_of::<u32>() as u32,
            );

            // IconUri: Must point directly to a valid .png or .ico file on disk without quotes or PE index
            let icon_for_uri = resolved_png_path.as_ref().or(resolved_ico_path.as_ref());
            if let Some(icon_path) = icon_for_uri {
                let icon_str = icon_path.to_string_lossy();
                let name_icon_w: Vec<u16> = OsStr::new("IconUri")
                    .encode_wide()
                    .chain(std::iter::once(0))
                    .collect();
                let val_icon_w: Vec<u16> = OsStr::new(&icon_str as &str)
                    .encode_wide()
                    .chain(std::iter::once(0))
                    .collect();
                let _ = RegSetValueExW(
                    hkey,
                    name_icon_w.as_ptr(),
                    0,
                    REG_SZ,
                    val_icon_w.as_ptr() as *const u8,
                    (val_icon_w.len() * 2) as u32,
                );

                let name_path_w: Vec<u16> = OsStr::new("IconPath")
                    .encode_wide()
                    .chain(std::iter::once(0))
                    .collect();
                let _ = RegSetValueExW(
                    hkey,
                    name_path_w.as_ptr(),
                    0,
                    REG_SZ,
                    val_icon_w.as_ptr() as *const u8,
                    (val_icon_w.len() * 2) as u32,
                );
            }

            RegCloseKey(hkey);
        }
    }

    resolved_png_path.or(resolved_ico_path)
}

#[cfg(not(target_os = "windows"))]
pub fn register_aumid(_aumid: &str, _display_name: &str) -> Option<std::path::PathBuf> {
    None
}

#[cfg(not(target_os = "windows"))]
pub fn register_aumid_with_icons(
    _aumid: &str,
    _display_name: &str,
    _icon_png_bytes: Option<&[u8]>,
    _icon_ico_bytes: Option<&[u8]>,
) -> Option<std::path::PathBuf> {
    None
}
