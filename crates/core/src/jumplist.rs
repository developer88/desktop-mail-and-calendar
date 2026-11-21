//! Native Windows 11 Taskbar Jump List (`ICustomDestinationList`) management.
//!
//! Registers native Win32 Jump List destinations and user tasks on the Windows Taskbar:
//! - Desktop Mail: "New Message", "Inbox", "Starred", "Sent"
//! - Desktop Calendar: "New Event", "Go to Today", "Day View", "Week View"

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JumpListTask {
    pub title: &'static str,
    pub description: &'static str,
    pub arguments: &'static str,
    pub icon_index: i32,
}

/// Returns the official Jump List destinations for Desktop Mail.
pub fn get_mail_jumplist_tasks() -> Vec<JumpListTask> {
    vec![
        JumpListTask {
            title: "New Message",
            description: "Compose a new email draft",
            arguments: "--compose",
            icon_index: 0,
        },
        JumpListTask {
            title: "Inbox",
            description: "View your inbox",
            arguments: "--url=https://mail.google.com/mail/u/0/#inbox",
            icon_index: 0,
        },
        JumpListTask {
            title: "Starred",
            description: "View starred messages",
            arguments: "--url=https://mail.google.com/mail/u/0/#starred",
            icon_index: 0,
        },
        JumpListTask {
            title: "Sent",
            description: "View sent messages",
            arguments: "--url=https://mail.google.com/mail/u/0/#sent",
            icon_index: 0,
        },
    ]
}

/// Returns the official Jump List destinations for Desktop Calendar.
pub fn get_calendar_jumplist_tasks() -> Vec<JumpListTask> {
    vec![
        JumpListTask {
            title: "New Event",
            description: "Create a new calendar event",
            arguments: "--url=https://calendar.google.com/calendar/u/0/r/eventedit",
            icon_index: 0,
        },
        JumpListTask {
            title: "Go to Today",
            description: "View today's schedule",
            arguments: "--url=https://calendar.google.com/calendar/u/0/r/day",
            icon_index: 0,
        },
        JumpListTask {
            title: "Day View",
            description: "View schedule for the day",
            arguments: "--url=https://calendar.google.com/calendar/u/0/r/day",
            icon_index: 0,
        },
        JumpListTask {
            title: "Week View",
            description: "View schedule for the week",
            arguments: "--url=https://calendar.google.com/calendar/u/0/r/week",
            icon_index: 0,
        },
    ]
}

#[cfg(target_os = "windows")]
unsafe fn init_prop_variant_from_str(
    s: &str,
) -> Option<windows::Win32::System::Com::StructuredStorage::PROPVARIANT> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PWSTR;
    use windows::Win32::System::Com::CoTaskMemAlloc;
    use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
    use windows::Win32::System::Variant::VT_LPWSTR;

    let wide: Vec<u16> = OsStr::new(s)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let bytes_len = wide.len() * std::mem::size_of::<u16>();
    let mem = CoTaskMemAlloc(bytes_len) as *mut u16;
    if mem.is_null() {
        return None;
    }
    std::ptr::copy_nonoverlapping(wide.as_ptr(), mem, wide.len());

    let mut propvar: PROPVARIANT = std::mem::zeroed();
    (*propvar.Anonymous.Anonymous).vt = VT_LPWSTR;
    (*propvar.Anonymous.Anonymous).Anonymous.pwszVal = PWSTR(mem);
    Some(propvar)
}

#[cfg(target_os = "windows")]
pub fn register_jump_list(aumid: &str, tasks: &[JumpListTask]) -> Result<(), String> {
    use windows::core::{Interface, GUID, HSTRING, PCWSTR};
    use windows::Win32::Foundation::PROPERTYKEY;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::Common::{IObjectArray, IObjectCollection};
    use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
    use windows::Win32::UI::Shell::{
        DestinationList, EnumerableObjectCollection, ICustomDestinationList, IShellLinkW, ShellLink,
    };

    let exe_path =
        std::env::current_exe().map_err(|e| format!("Failed to get current_exe: {e}"))?;
    let exe_path_str = exe_path.to_string_lossy();
    let exe_hstring = HSTRING::from(exe_path_str.as_ref());

    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

        // 1. Create ICustomDestinationList
        let dest_list: ICustomDestinationList =
            CoCreateInstance(&DestinationList, None, CLSCTX_INPROC_SERVER)
                .map_err(|e| format!("Failed to create DestinationList: {e:?}"))?;

        // 2. Set AppID (AUMID)
        let aumid_hstring = HSTRING::from(aumid);
        dest_list
            .SetAppID(PCWSTR(aumid_hstring.as_ptr()))
            .map_err(|e| format!("SetAppID failed: {e:?}"))?;

        // 3. BeginList
        let mut min_slots: u32 = 0;
        let _removed: windows::core::Result<IObjectArray> = dest_list.BeginList(&mut min_slots);

        // 4. Create IObjectCollection for user tasks
        let collection: IObjectCollection =
            CoCreateInstance(&EnumerableObjectCollection, None, CLSCTX_INPROC_SERVER)
                .map_err(|e| format!("Failed to create EnumerableObjectCollection: {e:?}"))?;

        // PKEY_Title = {F29F85E0-4FF9-1068-AB91-08002B27B3D9}, 2
        let pkey_title = PROPERTYKEY {
            fmtid: GUID::from_u128(0xf29f85e0_4ff9_1068_ab91_08002b27b3d9),
            pid: 2,
        };

        for task in tasks {
            let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)
                .map_err(|e| format!("Failed to create ShellLink: {e:?}"))?;

            link.SetPath(PCWSTR(exe_hstring.as_ptr()))
                .map_err(|e| format!("SetPath failed: {e:?}"))?;

            let args_hstring = HSTRING::from(task.arguments);
            link.SetArguments(PCWSTR(args_hstring.as_ptr()))
                .map_err(|e| format!("SetArguments failed: {e:?}"))?;

            let desc_hstring = HSTRING::from(task.description);
            link.SetDescription(PCWSTR(desc_hstring.as_ptr()))
                .map_err(|e| format!("SetDescription failed: {e:?}"))?;

            link.SetIconLocation(PCWSTR(exe_hstring.as_ptr()), task.icon_index)
                .map_err(|e| format!("SetIconLocation failed: {e:?}"))?;

            // Set Title via IPropertyStore
            let prop_store: IPropertyStore = link
                .cast()
                .map_err(|e| format!("Cast to IPropertyStore failed: {e:?}"))?;

            if let Some(propvar) = init_prop_variant_from_str(task.title) {
                let _ = prop_store.SetValue(&pkey_title, &propvar);
                let _ = prop_store.Commit();
            }

            collection
                .AddObject(&link)
                .map_err(|e| format!("AddObject failed: {e:?}"))?;
        }

        // 5. Add user tasks to jump list
        let obj_array: IObjectArray = collection
            .cast()
            .map_err(|e| format!("Cast to IObjectArray failed: {e:?}"))?;

        dest_list
            .AddUserTasks(&obj_array)
            .map_err(|e| format!("AddUserTasks failed: {e:?}"))?;

        // 6. CommitList
        dest_list
            .CommitList()
            .map_err(|e| format!("CommitList failed: {e:?}"))?;

        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
pub fn register_jump_list(_aumid: &str, _tasks: &[JumpListTask]) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mail_jumplist_tasks() {
        let tasks = get_mail_jumplist_tasks();
        assert_eq!(tasks.len(), 4);
        assert_eq!(tasks[0].title, "New Message");
        assert_eq!(tasks[0].arguments, "--compose");
        assert_eq!(tasks[1].title, "Inbox");
        assert!(tasks[1].arguments.contains("#inbox"));
        assert_eq!(tasks[2].title, "Starred");
        assert!(tasks[2].arguments.contains("#starred"));
        assert_eq!(tasks[3].title, "Sent");
        assert!(tasks[3].arguments.contains("#sent"));
    }

    #[test]
    fn test_calendar_jumplist_tasks() {
        let tasks = get_calendar_jumplist_tasks();
        assert_eq!(tasks.len(), 4);
        assert_eq!(tasks[0].title, "New Event");
        assert!(tasks[0].arguments.contains("eventedit"));
        assert_eq!(tasks[1].title, "Go to Today");
        assert!(tasks[1].arguments.contains("/r/day"));
        assert_eq!(tasks[2].title, "Day View");
        assert!(tasks[2].arguments.contains("/r/day"));
        assert_eq!(tasks[3].title, "Week View");
        assert!(tasks[3].arguments.contains("/r/week"));
    }
}
