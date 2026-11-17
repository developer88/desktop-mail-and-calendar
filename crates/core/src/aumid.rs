#[cfg(target_os = "windows")]
pub fn register_aumid(aumid: &str, display_name: &str) {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE,
        REG_DWORD, REG_SZ,
    };

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

            if let Ok(exe_path) = std::env::current_exe() {
                let icon_uri = format!("{},0", exe_path.display());
                let name_icon_w: Vec<u16> = OsStr::new("IconUri")
                    .encode_wide()
                    .chain(std::iter::once(0))
                    .collect();
                let val_icon_w: Vec<u16> = OsStr::new(&icon_uri)
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
            }

            RegCloseKey(hkey);
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn register_aumid(_aumid: &str, _display_name: &str) {}
