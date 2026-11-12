#[cfg(target_os = "windows")]
pub mod windows {
    use std::ffi::c_void;
    use std::sync::atomic::{AtomicIsize, Ordering};
    use windows_sys::core::GUID;
    use windows_sys::Win32::Foundation::{HWND, RECT};
    use windows_sys::Win32::Graphics::Gdi::*;
    use windows_sys::Win32::System::Com::{
        CoCreateInstance, CoTaskMemAlloc, CoTaskMemFree, CLSCTX_INPROC_SERVER,
    };
    use windows_sys::Win32::System::LibraryLoader::{GetModuleHandleA, GetProcAddress};
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    type HRESULT = i32;
    type BOOL = i32;

    static LAST_MAIN_HICON: AtomicIsize = AtomicIsize::new(0);
    static LAST_OVERLAY_HICON: AtomicIsize = AtomicIsize::new(0);

    const CLSID_TASKBAR_LIST: GUID = GUID {
        data1: 0x56FDF344,
        data2: 0xFD6D,
        data3: 0x11D0,
        data4: [0x95, 0x8A, 0x00, 0x60, 0x97, 0xC9, 0xA0, 0x90],
    };

    const IID_ITASKBAR_LIST3: GUID = GUID {
        data1: 0xEA1AFB91,
        data2: 0x9E28,
        data3: 0x4B86,
        data4: [0x90, 0xE9, 0x9E, 0x9F, 0x8A, 0x5E, 0xEF, 0xAF],
    };

    #[repr(C)]
    struct ITaskbarList3Vtbl {
        pub query_interface: unsafe extern "system" fn(
            this: *mut c_void,
            riid: *const GUID,
            ppv: *mut *mut c_void,
        ) -> HRESULT,
        pub add_ref: unsafe extern "system" fn(this: *mut c_void) -> u32,
        pub release: unsafe extern "system" fn(this: *mut c_void) -> u32,
        pub hr_init: unsafe extern "system" fn(this: *mut c_void) -> HRESULT,
        pub add_tab: unsafe extern "system" fn(this: *mut c_void, hwnd: HWND) -> HRESULT,
        pub delete_tab: unsafe extern "system" fn(this: *mut c_void, hwnd: HWND) -> HRESULT,
        pub activate_tab: unsafe extern "system" fn(this: *mut c_void, hwnd: HWND) -> HRESULT,
        pub set_active_alt: unsafe extern "system" fn(this: *mut c_void, hwnd: HWND) -> HRESULT,
        pub mark_fullscreen_window:
            unsafe extern "system" fn(this: *mut c_void, hwnd: HWND, f_fullscreen: BOOL) -> HRESULT,
        pub set_progress_value: unsafe extern "system" fn(
            this: *mut c_void,
            hwnd: HWND,
            ull_completed: u64,
            ull_total: u64,
        ) -> HRESULT,
        pub set_progress_state:
            unsafe extern "system" fn(this: *mut c_void, hwnd: HWND, tbp_flags: i32) -> HRESULT,
        pub register_tab:
            unsafe extern "system" fn(this: *mut c_void, hwnd_tab: HWND, hwnd_mdi: HWND) -> HRESULT,
        pub unregister_tab: unsafe extern "system" fn(this: *mut c_void, hwnd_tab: HWND) -> HRESULT,
        pub set_tab_order: unsafe extern "system" fn(
            this: *mut c_void,
            hwnd_tab: HWND,
            hwnd_insert_before: HWND,
        ) -> HRESULT,
        pub set_tab_active: unsafe extern "system" fn(
            this: *mut c_void,
            hwnd_tab: HWND,
            hwnd_mdi: HWND,
            tbat_flags: u32,
        ) -> HRESULT,
        pub thumb_bar_add_buttons: unsafe extern "system" fn(
            this: *mut c_void,
            hwnd: HWND,
            c_buttons: u32,
            p_button: *const c_void,
        ) -> HRESULT,
        pub thumb_bar_update_buttons: unsafe extern "system" fn(
            this: *mut c_void,
            hwnd: HWND,
            c_buttons: u32,
            p_button: *const c_void,
        ) -> HRESULT,
        pub thumb_bar_set_image_list:
            unsafe extern "system" fn(this: *mut c_void, hwnd: HWND, himl: *mut c_void) -> HRESULT,
        pub set_overlay_icon: unsafe extern "system" fn(
            this: *mut c_void,
            hwnd: HWND,
            hicon: HICON,
            psz_description: *const u16,
        ) -> HRESULT,
        pub set_thumbnail_tooltip: unsafe extern "system" fn(
            this: *mut c_void,
            hwnd: HWND,
            psz_tip: *const u16,
        ) -> HRESULT,
        pub set_thumbnail_clip: unsafe extern "system" fn(
            this: *mut c_void,
            hwnd: HWND,
            prc_clip: *const c_void,
        ) -> HRESULT,
    }

    #[repr(C)]
    struct ITaskbarList3 {
        pub vtbl: *const ITaskbarList3Vtbl,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    pub struct PROPERTYKEY {
        pub fmtid: GUID,
        pub pid: u32,
    }

    #[repr(C)]
    struct IPropertyStoreVtbl {
        pub query_interface: unsafe extern "system" fn(
            this: *mut c_void,
            riid: *const GUID,
            ppv: *mut *mut c_void,
        ) -> HRESULT,
        pub add_ref: unsafe extern "system" fn(this: *mut c_void) -> u32,
        pub release: unsafe extern "system" fn(this: *mut c_void) -> u32,
        pub get_count: unsafe extern "system" fn(this: *mut c_void, c_props: *mut u32) -> HRESULT,
        pub get_at: unsafe extern "system" fn(
            this: *mut c_void,
            i_prop: u32,
            pkey: *mut PROPERTYKEY,
        ) -> HRESULT,
        pub get_value: unsafe extern "system" fn(
            this: *mut c_void,
            key: *const PROPERTYKEY,
            pv: *mut c_void,
        ) -> HRESULT,
        pub set_value: unsafe extern "system" fn(
            this: *mut c_void,
            key: *const PROPERTYKEY,
            propvar: *const c_void,
        ) -> HRESULT,
        pub commit: unsafe extern "system" fn(this: *mut c_void) -> HRESULT,
    }

    #[repr(C)]
    struct IPropertyStore {
        pub vtbl: *const IPropertyStoreVtbl,
    }

    const PKEY_APP_USER_MODEL_ID: PROPERTYKEY = PROPERTYKEY {
        fmtid: GUID {
            data1: 0x9F4C2855,
            data2: 0x9F79,
            data3: 0x4B39,
            data4: [0xA8, 0xD0, 0xE1, 0xD4, 0x2D, 0xE1, 0xD5, 0xF3],
        },
        pid: 5,
    };

    const PKEY_APP_USER_MODEL_RELAUNCH_COMMAND: PROPERTYKEY = PROPERTYKEY {
        fmtid: GUID {
            data1: 0x9F4C2855,
            data2: 0x9F79,
            data3: 0x4B39,
            data4: [0xA8, 0xD0, 0xE1, 0xD4, 0x2D, 0xE1, 0xD5, 0xF3],
        },
        pid: 2,
    };

    const PKEY_APP_USER_MODEL_RELAUNCH_ICON_RESOURCE: PROPERTYKEY = PROPERTYKEY {
        fmtid: GUID {
            data1: 0x9F4C2855,
            data2: 0x9F79,
            data3: 0x4B39,
            data4: [0xA8, 0xD0, 0xE1, 0xD4, 0x2D, 0xE1, 0xD5, 0xF3],
        },
        pid: 3,
    };

    const PKEY_APP_USER_MODEL_RELAUNCH_DISPLAY_NAME_RESOURCE: PROPERTYKEY = PROPERTYKEY {
        fmtid: GUID {
            data1: 0x9F4C2855,
            data2: 0x9F79,
            data3: 0x4B39,
            data4: [0xA8, 0xD0, 0xE1, 0xD4, 0x2D, 0xE1, 0xD5, 0xF3],
        },
        pid: 4,
    };

    const IID_IPROPERTY_STORE: GUID = GUID {
        data1: 0x886D8EEB,
        data2: 0x8CF2,
        data3: 0x4446,
        data4: [0x8D, 0x02, 0xCD, 0xBA, 0x1D, 0xBD, 0xCF, 0x99],
    };

    #[repr(C)]
    struct PropVariantStr {
        vt: u16,
        w_reserved1: u16,
        w_reserved2: u16,
        w_reserved3: u16,
        pwsz_val: *mut u16,
        _padding: [u8; 8],
    }

    unsafe fn make_propvariant_string(s: &str) -> Option<PropVariantStr> {
        let wide: Vec<u16> = s.encode_utf16().chain(std::iter::once(0)).collect();
        let bytes_needed = wide.len() * std::mem::size_of::<u16>();
        let mem = CoTaskMemAlloc(bytes_needed) as *mut u16;
        if mem.is_null() {
            return None;
        }
        std::ptr::copy_nonoverlapping(wide.as_ptr(), mem, wide.len());
        Some(PropVariantStr {
            vt: 31, // VT_LPWSTR
            w_reserved1: 0,
            w_reserved2: 0,
            w_reserved3: 0,
            pwsz_val: mem,
            _padding: [0; 8],
        })
    }

    unsafe fn free_propvariant_string(pv: &mut PropVariantStr) {
        if !pv.pwsz_val.is_null() {
            CoTaskMemFree(pv.pwsz_val as *mut _);
            pv.pwsz_val = std::ptr::null_mut();
        }
    }

    /// Sets explicit Windows AppUserModelID and Taskbar Jump List relaunch properties
    /// (display name, launch command, icon) on the window's IPropertyStore.
    /// This ensures Windows Taskbar right-click shows the proper human-readable application name
    /// (e.g. "Desktop Mail") instead of the executable filename ("desktop-mail.exe").
    pub unsafe fn set_window_relaunch_properties(hwnd: isize, app_id: &str, display_name: &str) {
        if hwnd == 0 {
            return;
        }

        let shell32 = GetModuleHandleA(b"shell32.dll\0".as_ptr());
        if shell32.is_null() {
            return;
        }

        // 1. Set explicit process AppUserModelID
        let set_aumid_proc = GetProcAddress(
            shell32,
            b"SetCurrentProcessExplicitAppUserModelID\0".as_ptr(),
        );
        if let Some(set_aumid) = set_aumid_proc {
            type SetAumidFn = unsafe extern "system" fn(appid: *const u16) -> HRESULT;
            let set_aumid_fn: SetAumidFn = std::mem::transmute(set_aumid);
            let wide_id: Vec<u16> = app_id.encode_utf16().chain(std::iter::once(0)).collect();
            let _ = set_aumid_fn(wide_id.as_ptr());
        }

        // 2. Set window-specific relaunch properties via IPropertyStore
        let get_store_proc = GetProcAddress(shell32, b"SHGetPropertyStoreForWindow\0".as_ptr());
        if let Some(get_store) = get_store_proc {
            type GetStoreFn = unsafe extern "system" fn(
                hwnd: HWND,
                riid: *const GUID,
                ppv: *mut *mut c_void,
            ) -> HRESULT;
            let get_store_fn: GetStoreFn = std::mem::transmute(get_store);
            let mut store_ptr: *mut c_void = std::ptr::null_mut();
            if get_store_fn(hwnd as HWND, &IID_IPROPERTY_STORE, &mut store_ptr) == 0
                && !store_ptr.is_null()
            {
                let store = store_ptr as *mut IPropertyStore;
                let vtbl = &*(*store).vtbl;

                // AppUserModelID on window
                if let Some(mut pv_id) = make_propvariant_string(app_id) {
                    let _ = (vtbl.set_value)(
                        store_ptr,
                        &PKEY_APP_USER_MODEL_ID,
                        &pv_id as *const _ as *const c_void,
                    );
                    free_propvariant_string(&mut pv_id);
                }

                // RelaunchDisplayNameResource -> Sets Taskbar right-click name!
                if let Some(mut pv_name) = make_propvariant_string(display_name) {
                    let _ = (vtbl.set_value)(
                        store_ptr,
                        &PKEY_APP_USER_MODEL_RELAUNCH_DISPLAY_NAME_RESOURCE,
                        &pv_name as *const _ as *const c_void,
                    );
                    free_propvariant_string(&mut pv_name);
                }

                // RelaunchCommand and RelaunchIconResource pointing to current exe
                if let Ok(exe_path) = std::env::current_exe() {
                    let exe_str = exe_path.to_string_lossy();
                    if let Some(mut pv_cmd) = make_propvariant_string(&exe_str) {
                        let _ = (vtbl.set_value)(
                            store_ptr,
                            &PKEY_APP_USER_MODEL_RELAUNCH_COMMAND,
                            &pv_cmd as *const _ as *const c_void,
                        );
                        free_propvariant_string(&mut pv_cmd);
                    }
                    let icon_res_str = format!("{},0", exe_str);
                    if let Some(mut pv_icon) = make_propvariant_string(&icon_res_str) {
                        let _ = (vtbl.set_value)(
                            store_ptr,
                            &PKEY_APP_USER_MODEL_RELAUNCH_ICON_RESOURCE,
                            &pv_icon as *const _ as *const c_void,
                        );
                        free_propvariant_string(&mut pv_icon);
                    }
                }

                let _ = (vtbl.commit)(store_ptr);
                let _ = (vtbl.release)(store_ptr);
            }
        }
    }

    /// Creates an HICON from 32-bit RGBA pixel buffer (with full 8-bit alpha channel).
    pub unsafe fn create_hicon_from_rgba(rgba: &[u8], width: u32, height: u32) -> isize {
        if rgba.len() != (width * height * 4) as usize {
            return 0;
        }

        let bi = BITMAPV5HEADER {
            bV5Size: std::mem::size_of::<BITMAPV5HEADER>() as u32,
            bV5Width: width as i32,
            bV5Height: -(height as i32), // top-down
            bV5Planes: 1,
            bV5BitCount: 32,
            bV5Compression: BI_BITFIELDS,
            bV5SizeImage: (width * height * 4) as u32,
            bV5XPelsPerMeter: 0,
            bV5YPelsPerMeter: 0,
            bV5ClrUsed: 0,
            bV5ClrImportant: 0,
            bV5RedMask: 0x00FF0000,
            bV5GreenMask: 0x0000FF00,
            bV5BlueMask: 0x000000FF,
            bV5AlphaMask: 0xFF000000,
            bV5CSType: 0x73524742, // sRGB
            bV5Endpoints: std::mem::zeroed(),
            bV5GammaRed: 0,
            bV5GammaGreen: 0,
            bV5GammaBlue: 0,
            bV5Intent: 0,
            bV5ProfileData: 0,
            bV5ProfileSize: 0,
            bV5Reserved: 0,
        };

        let hdc = GetDC(0 as _);
        let mut bits: *mut u8 = std::ptr::null_mut();
        let hbm_color = CreateDIBSection(
            hdc,
            &bi as *const _ as *const BITMAPINFO,
            DIB_RGB_COLORS,
            &mut bits as *mut _ as *mut *mut c_void,
            0 as _,
            0,
        );

        if !bits.is_null() && !hbm_color.is_null() {
            let pixel_count = (width * height) as usize;
            let dest = std::slice::from_raw_parts_mut(bits, pixel_count * 4);
            for i in 0..pixel_count {
                let src_idx = i * 4;
                let a = rgba[src_idx + 3] as u32;
                let r = rgba[src_idx] as u32;
                let g = rgba[src_idx + 1] as u32;
                let b = rgba[src_idx + 2] as u32;
                dest[src_idx] = ((b * a + 127) / 255) as u8;
                dest[src_idx + 1] = ((g * a + 127) / 255) as u8;
                dest[src_idx + 2] = ((r * a + 127) / 255) as u8;
                dest[src_idx + 3] = a as u8;
            }
        }

        let hbm_mask = CreateBitmap(width as i32, height as i32, 1, 1, std::ptr::null());
        ReleaseDC(0 as _, hdc);

        let icon_info = ICONINFO {
            fIcon: 1, // TRUE
            xHotspot: 0,
            yHotspot: 0,
            hbmMask: hbm_mask,
            hbmColor: hbm_color,
        };

        let hicon = CreateIconIndirect(&icon_info);
        if !hbm_color.is_null() {
            DeleteObject(hbm_color as _);
        }
        if !hbm_mask.is_null() {
            DeleteObject(hbm_mask as _);
        }

        hicon as isize
    }

    /// Returns the local day of the month (1-31).
    pub unsafe fn get_local_day() -> u32 {
        let mut st: windows_sys::Win32::Foundation::SYSTEMTIME = std::mem::zeroed();
        windows_sys::Win32::System::SystemInformation::GetLocalTime(&mut st);
        st.wDay as u32
    }

    /// Renders the current day of the month (1-31) onto the Fluent Design Calendar template.
    /// Supports both 256x256 and 128x128 base templates.
    pub unsafe fn render_calendar_date_hicon(base_rgba: &[u8], day: u32) -> isize {
        let width = if base_rgba.len() == (256 * 256 * 4) {
            256u32
        } else {
            128u32
        };
        let height = width;
        if base_rgba.len() != (width * height * 4) as usize {
            return 0;
        }

        let bi = BITMAPV5HEADER {
            bV5Size: std::mem::size_of::<BITMAPV5HEADER>() as u32,
            bV5Width: width as i32,
            bV5Height: -(height as i32),
            bV5Planes: 1,
            bV5BitCount: 32,
            bV5Compression: BI_BITFIELDS,
            bV5SizeImage: (width * height * 4) as u32,
            bV5XPelsPerMeter: 0,
            bV5YPelsPerMeter: 0,
            bV5ClrUsed: 0,
            bV5ClrImportant: 0,
            bV5RedMask: 0x00FF0000,
            bV5GreenMask: 0x0000FF00,
            bV5BlueMask: 0x000000FF,
            bV5AlphaMask: 0xFF000000,
            bV5CSType: 0x73524742,
            bV5Endpoints: std::mem::zeroed(),
            bV5GammaRed: 0,
            bV5GammaGreen: 0,
            bV5GammaBlue: 0,
            bV5Intent: 0,
            bV5ProfileData: 0,
            bV5ProfileSize: 0,
            bV5Reserved: 0,
        };

        let screen_dc = GetDC(0 as _);
        let mut bits: *mut u8 = std::ptr::null_mut();
        let hbm_color = CreateDIBSection(
            screen_dc,
            &bi as *const _ as *const BITMAPINFO,
            DIB_RGB_COLORS,
            &mut bits as *mut _ as *mut *mut c_void,
            0 as _,
            0,
        );
        ReleaseDC(0 as _, screen_dc);

        if bits.is_null() || hbm_color.is_null() {
            return 0;
        }

        let dest = std::slice::from_raw_parts_mut(bits, (width * height * 4) as usize);
        for i in 0..(width * height) as usize {
            let src_idx = i * 4;
            let a = base_rgba[src_idx + 3] as u32;
            let r = base_rgba[src_idx] as u32;
            let g = base_rgba[src_idx + 1] as u32;
            let b = base_rgba[src_idx + 2] as u32;
            dest[src_idx] = ((b * a + 127) / 255) as u8;
            dest[src_idx + 1] = ((g * a + 127) / 255) as u8;
            dest[src_idx + 2] = ((r * a + 127) / 255) as u8;
            dest[src_idx + 3] = a as u8;
        }

        let mem_dc = CreateCompatibleDC(0 as _);
        let old_bm = SelectObject(mem_dc, hbm_color as _);

        // Render day number with Segoe UI Variable / Segoe UI bold in Google Calendar Blue (#1A73E8 -> BGR: 0x00E8731A)
        let font_size = if width == 256 { 96 } else { 48 };
        let font_name: Vec<u16> = "Segoe UI Variable Display\0".encode_utf16().collect();
        let mut hfont = CreateFontW(
            font_size,
            0,
            0,
            0,
            FW_BOLD as i32,
            0,
            0,
            0,
            DEFAULT_CHARSET as u32,
            OUT_DEFAULT_PRECIS as u32,
            CLIP_DEFAULT_PRECIS as u32,
            CLEARTYPE_QUALITY as u32,
            (DEFAULT_PITCH | FF_DONTCARE) as u32,
            font_name.as_ptr(),
        );
        if hfont.is_null() {
            let fallback_name: Vec<u16> = "Segoe UI\0".encode_utf16().collect();
            hfont = CreateFontW(
                font_size,
                0,
                0,
                0,
                FW_BOLD as i32,
                0,
                0,
                0,
                DEFAULT_CHARSET as u32,
                OUT_DEFAULT_PRECIS as u32,
                CLIP_DEFAULT_PRECIS as u32,
                CLEARTYPE_QUALITY as u32,
                (DEFAULT_PITCH | FF_DONTCARE) as u32,
                fallback_name.as_ptr(),
            );
        }

        let old_font = SelectObject(mem_dc, hfont as _);
        SetBkMode(mem_dc, TRANSPARENT as i32);
        SetTextColor(mem_dc, 0x00E8731A); // Google Calendar Blue

        let day_str = format!("{}\0", day);
        let day_wide: Vec<u16> = day_str.encode_utf16().collect();
        let mut text_rect = if width == 256 {
            RECT {
                left: 24,
                top: 88,
                right: 232,
                bottom: 236,
            }
        } else {
            RECT {
                left: 12,
                top: 44,
                right: 116,
                bottom: 118,
            }
        };
        DrawTextW(
            mem_dc,
            day_wide.as_ptr(),
            -1,
            &mut text_rect,
            DT_CENTER | DT_VCENTER | DT_SINGLELINE,
        );

        SelectObject(mem_dc, old_font);
        DeleteObject(hfont as _);
        SelectObject(mem_dc, old_bm);
        DeleteDC(mem_dc);

        let hbm_mask = CreateBitmap(width as i32, height as i32, 1, 1, std::ptr::null());
        let icon_info = ICONINFO {
            fIcon: 1,
            xHotspot: 0,
            yHotspot: 0,
            hbmMask: hbm_mask,
            hbmColor: hbm_color,
        };
        let hicon = CreateIconIndirect(&icon_info);
        DeleteObject(hbm_color as _);
        if !hbm_mask.is_null() {
            DeleteObject(hbm_mask as _);
        }

        hicon as isize
    }

    /// Renders the Telegram-style unread badge onto the Fluent Design Mail icon.
    /// Supports both 256x256 and 128x128 base templates.
    pub unsafe fn render_mail_badged_hicon(base_rgba: &[u8], count: u32) -> isize {
        let width = if base_rgba.len() == (256 * 256 * 4) {
            256u32
        } else {
            128u32
        };
        let height = width;
        if base_rgba.len() != (width * height * 4) as usize {
            return 0;
        }

        if count == 0 {
            return create_hicon_from_rgba(base_rgba, width, height);
        }

        let label = if count >= 1_000_000 {
            format!("{}M", count / 1_000_000)
        } else if count >= 1_000 {
            format!("{}K", count / 1_000)
        } else {
            count.to_string()
        };

        let bi = BITMAPV5HEADER {
            bV5Size: std::mem::size_of::<BITMAPV5HEADER>() as u32,
            bV5Width: width as i32,
            bV5Height: -(height as i32),
            bV5Planes: 1,
            bV5BitCount: 32,
            bV5Compression: BI_BITFIELDS,
            bV5SizeImage: (width * height * 4) as u32,
            bV5XPelsPerMeter: 0,
            bV5YPelsPerMeter: 0,
            bV5ClrUsed: 0,
            bV5ClrImportant: 0,
            bV5RedMask: 0x00FF0000,
            bV5GreenMask: 0x0000FF00,
            bV5BlueMask: 0x000000FF,
            bV5AlphaMask: 0xFF000000,
            bV5CSType: 0x73524742,
            bV5Endpoints: std::mem::zeroed(),
            bV5GammaRed: 0,
            bV5GammaGreen: 0,
            bV5GammaBlue: 0,
            bV5Intent: 0,
            bV5ProfileData: 0,
            bV5ProfileSize: 0,
            bV5Reserved: 0,
        };

        let screen_dc = GetDC(0 as _);
        let mut bits: *mut u8 = std::ptr::null_mut();
        let hbm_color = CreateDIBSection(
            screen_dc,
            &bi as *const _ as *const BITMAPINFO,
            DIB_RGB_COLORS,
            &mut bits as *mut _ as *mut *mut c_void,
            0 as _,
            0,
        );
        ReleaseDC(0 as _, screen_dc);

        if bits.is_null() || hbm_color.is_null() {
            return 0;
        }

        let dest = std::slice::from_raw_parts_mut(bits, (width * height * 4) as usize);
        for i in 0..(width * height) as usize {
            let src_idx = i * 4;
            let a = base_rgba[src_idx + 3] as u32;
            let r = base_rgba[src_idx] as u32;
            let g = base_rgba[src_idx + 1] as u32;
            let b = base_rgba[src_idx + 2] as u32;
            dest[src_idx] = ((b * a + 127) / 255) as u8;
            dest[src_idx + 1] = ((g * a + 127) / 255) as u8;
            dest[src_idx + 2] = ((r * a + 127) / 255) as u8;
            dest[src_idx + 3] = a as u8;
        }

        let mem_dc = CreateCompatibleDC(0 as _);
        let old_bm = SelectObject(mem_dc, hbm_color as _);

        let scale = width as f32 / 256.0;
        let bh = (72.0 * scale).round() as i32;
        let bw = ((48.0 + label.len() as f32 * 26.0).max(72.0).min(170.0) * scale).round() as i32;
        let bx = width as i32 - bw - (6.0 * scale).round() as i32;
        let by = (4.0 * scale).round() as i32;
        let r = bh / 2;

        // Soft subtle ambient shadow beneath badge (semi-transparent, no harsh black border!)
        let dark_brush = CreateSolidBrush(0x00141414);
        let old_brush = SelectObject(mem_dc, dark_brush as _);
        let null_pen = GetStockObject(NULL_PEN);
        let old_pen = SelectObject(mem_dc, null_pen);
        RoundRect(
            mem_dc,
            bx - 2,
            by + 1,
            bx + bw + 2,
            by + bh + 4,
            r + 4,
            r + 4,
        );

        // Vivid red pill (#eb4034 matching Telegram -> BGR: 0x003440EB)
        let red_brush = CreateSolidBrush(0x003440EB);
        let red_pen = CreatePen(PS_SOLID as i32, 1, 0x003440EB);
        SelectObject(mem_dc, red_brush as _);
        SelectObject(mem_dc, red_pen as _);
        RoundRect(mem_dc, bx, by, bx + bw, by + bh, r, r);

        // Clean white centered text
        let font_size = if label.len() <= 2 {
            (46.0 * scale).round() as i32
        } else if label.len() <= 3 {
            (38.0 * scale).round() as i32
        } else {
            (30.0 * scale).round() as i32
        };
        let font_name: Vec<u16> = "Segoe UI Variable Text\0".encode_utf16().collect();
        let mut hfont = CreateFontW(
            font_size,
            0,
            0,
            0,
            FW_BOLD as i32,
            0,
            0,
            0,
            DEFAULT_CHARSET as u32,
            OUT_DEFAULT_PRECIS as u32,
            CLIP_DEFAULT_PRECIS as u32,
            CLEARTYPE_QUALITY as u32,
            (DEFAULT_PITCH | FF_DONTCARE) as u32,
            font_name.as_ptr(),
        );
        if hfont.is_null() {
            let fallback_name: Vec<u16> = "Segoe UI\0".encode_utf16().collect();
            hfont = CreateFontW(
                font_size,
                0,
                0,
                0,
                FW_BOLD as i32,
                0,
                0,
                0,
                DEFAULT_CHARSET as u32,
                OUT_DEFAULT_PRECIS as u32,
                CLIP_DEFAULT_PRECIS as u32,
                CLEARTYPE_QUALITY as u32,
                (DEFAULT_PITCH | FF_DONTCARE) as u32,
                fallback_name.as_ptr(),
            );
        }

        let old_font = SelectObject(mem_dc, hfont as _);
        SetBkMode(mem_dc, TRANSPARENT as i32);
        SetTextColor(mem_dc, 0x00FFFFFF);

        let label_wide: Vec<u16> = format!("{}\0", label).encode_utf16().collect();
        let mut text_rect = RECT {
            left: bx,
            top: by + 1,
            right: bx + bw,
            bottom: by + bh + 1,
        };
        DrawTextW(
            mem_dc,
            label_wide.as_ptr(),
            -1,
            &mut text_rect,
            DT_CENTER | DT_VCENTER | DT_SINGLELINE,
        );

        // Ensure alpha channel is 255 for the red pill badge area
        for y in by.max(0)..(by + bh).min(height as i32) {
            for x in bx.max(0)..(bx + bw).min(width as i32) {
                let idx = ((y * width as i32 + x) * 4) as usize;
                dest[idx + 3] = 255;
            }
        }

        SelectObject(mem_dc, old_font);
        DeleteObject(hfont as _);
        SelectObject(mem_dc, old_brush);
        DeleteObject(dark_brush as _);
        DeleteObject(red_brush as _);
        SelectObject(mem_dc, old_pen);
        DeleteObject(red_pen as _);
        SelectObject(mem_dc, old_bm);
        DeleteDC(mem_dc);

        let hbm_mask = CreateBitmap(width as i32, height as i32, 1, 1, std::ptr::null());
        let icon_info = ICONINFO {
            fIcon: 1,
            xHotspot: 0,
            yHotspot: 0,
            hbmMask: hbm_mask,
            hbmColor: hbm_color,
        };
        let hicon = CreateIconIndirect(&icon_info);
        DeleteObject(hbm_color as _);
        if !hbm_mask.is_null() {
            DeleteObject(hbm_mask as _);
        }

        hicon as isize
    }

    /// Renders a 32x32 overlay icon for taskbar overlay badges.
    pub unsafe fn render_overlay_hicon(count: u32) -> isize {
        if count == 0 {
            return 0;
        }

        let width = 32u32;
        let height = 32u32;
        let label = if count >= 1_000_000 {
            format!("{}M", count / 1_000_000)
        } else if count >= 1_000 {
            format!("{}K", count / 1_000)
        } else {
            count.to_string()
        };

        let bi = BITMAPV5HEADER {
            bV5Size: std::mem::size_of::<BITMAPV5HEADER>() as u32,
            bV5Width: width as i32,
            bV5Height: -(height as i32),
            bV5Planes: 1,
            bV5BitCount: 32,
            bV5Compression: BI_BITFIELDS,
            bV5SizeImage: (width * height * 4) as u32,
            bV5XPelsPerMeter: 0,
            bV5YPelsPerMeter: 0,
            bV5ClrUsed: 0,
            bV5ClrImportant: 0,
            bV5RedMask: 0x00FF0000,
            bV5GreenMask: 0x0000FF00,
            bV5BlueMask: 0x000000FF,
            bV5AlphaMask: 0xFF000000,
            bV5CSType: 0x73524742,
            bV5Endpoints: std::mem::zeroed(),
            bV5GammaRed: 0,
            bV5GammaGreen: 0,
            bV5GammaBlue: 0,
            bV5Intent: 0,
            bV5ProfileData: 0,
            bV5ProfileSize: 0,
            bV5Reserved: 0,
        };

        let screen_dc = GetDC(0 as _);
        let mut bits: *mut u8 = std::ptr::null_mut();
        let hbm_color = CreateDIBSection(
            screen_dc,
            &bi as *const _ as *const BITMAPINFO,
            DIB_RGB_COLORS,
            &mut bits as *mut _ as *mut *mut c_void,
            0 as _,
            0,
        );
        ReleaseDC(0 as _, screen_dc);

        if bits.is_null() || hbm_color.is_null() {
            return 0;
        }

        let dest = std::slice::from_raw_parts_mut(bits, (width * height * 4) as usize);
        dest.fill(0);

        let mem_dc = CreateCompatibleDC(0 as _);
        let old_bm = SelectObject(mem_dc, hbm_color as _);

        // Red circle with dark border
        let dark_pen = CreatePen(PS_SOLID as i32, 1, 0x00141414);
        let red_brush = CreateSolidBrush(0x003440EB);
        let old_brush = SelectObject(mem_dc, red_brush as _);
        let old_pen = SelectObject(mem_dc, dark_pen as _);
        Ellipse(mem_dc, 1, 1, 31, 31);

        // White centered text
        let font_size = if label.len() <= 2 {
            16
        } else if label.len() <= 3 {
            12
        } else {
            10
        };
        let font_name: Vec<u16> = "Segoe UI\0".encode_utf16().collect();
        let hfont = CreateFontW(
            font_size,
            0,
            0,
            0,
            FW_BOLD as i32,
            0,
            0,
            0,
            DEFAULT_CHARSET as u32,
            OUT_DEFAULT_PRECIS as u32,
            CLIP_DEFAULT_PRECIS as u32,
            CLEARTYPE_QUALITY as u32,
            (DEFAULT_PITCH | FF_DONTCARE) as u32,
            font_name.as_ptr(),
        );
        let old_font = SelectObject(mem_dc, hfont as _);
        SetBkMode(mem_dc, TRANSPARENT as i32);
        SetTextColor(mem_dc, 0x00FFFFFF);

        let label_wide: Vec<u16> = format!("{}\0", label).encode_utf16().collect();
        let mut text_rect = RECT {
            left: 1,
            top: 1,
            right: 31,
            bottom: 31,
        };
        DrawTextW(
            mem_dc,
            label_wide.as_ptr(),
            -1,
            &mut text_rect,
            DT_CENTER | DT_VCENTER | DT_SINGLELINE,
        );

        // Set alpha channel for the circle
        for y in 0..32 {
            for x in 0..32 {
                let dx = x as f32 - 15.5;
                let dy = y as f32 - 15.5;
                if dx * dx + dy * dy <= 15.0 * 15.0 {
                    let idx = ((y * 32 + x) * 4) as usize;
                    dest[idx + 3] = 255;
                }
            }
        }

        SelectObject(mem_dc, old_font);
        DeleteObject(hfont as _);
        SelectObject(mem_dc, old_brush);
        DeleteObject(red_brush as _);
        SelectObject(mem_dc, old_pen);
        DeleteObject(dark_pen as _);
        SelectObject(mem_dc, old_bm);
        DeleteDC(mem_dc);

        let hbm_mask = CreateBitmap(width as i32, height as i32, 1, 1, std::ptr::null());
        let icon_info = ICONINFO {
            fIcon: 1,
            xHotspot: 0,
            yHotspot: 0,
            hbmMask: hbm_mask,
            hbmColor: hbm_color,
        };
        let hicon = CreateIconIndirect(&icon_info);
        DeleteObject(hbm_color as _);
        if !hbm_mask.is_null() {
            DeleteObject(hbm_mask as _);
        }

        hicon as isize
    }

    /// Sets both ICON_BIG and ICON_SMALL on the window via SendMessageW.
    /// ICON_BIG is what the Windows Taskbar uses for the taskbar button.
    pub unsafe fn set_window_hicon(hwnd: isize, hicon: isize) {
        if hwnd == 0 {
            return;
        }
        // ICON_BIG = 1 (Windows Taskbar button icon)
        SendMessageW(hwnd as _, WM_SETICON, 1, hicon as _);
        // ICON_SMALL = 0 (Window titlebar and Alt+Tab)
        SendMessageW(hwnd as _, WM_SETICON, 0, hicon as _);

        let prev = LAST_MAIN_HICON.swap(hicon, Ordering::SeqCst);
        if prev != 0 && prev != hicon {
            DestroyIcon(prev as _);
        }
    }

    /// Sets or clears the taskbar overlay icon via ITaskbarList3::SetOverlayIcon.
    pub unsafe fn set_taskbar_overlay_icon(hwnd: isize, overlay_hicon: isize, description: &str) {
        if hwnd == 0 {
            return;
        }

        let mut taskbar: *mut c_void = std::ptr::null_mut();
        let hr = CoCreateInstance(
            &CLSID_TASKBAR_LIST,
            std::ptr::null_mut(),
            CLSCTX_INPROC_SERVER,
            &IID_ITASKBAR_LIST3,
            &mut taskbar,
        );

        if hr == 0 && !taskbar.is_null() {
            let tbl = taskbar as *mut ITaskbarList3;
            let vtbl = &*(*tbl).vtbl;
            let _ = (vtbl.hr_init)(taskbar);

            let wide: Vec<u16> = description
                .encode_utf16()
                .chain(std::iter::once(0))
                .collect();
            let _ = (vtbl.set_overlay_icon)(taskbar, hwnd as _, overlay_hicon as _, wide.as_ptr());
            let _ = (vtbl.release)(taskbar);
        }

        let prev = LAST_OVERLAY_HICON.swap(overlay_hicon, Ordering::SeqCst);
        if prev != 0 && prev != overlay_hicon {
            DestroyIcon(prev as _);
        }
    }
}
