#!/usr/bin/env python3
import sys
import os
import struct
import re

MANIFEST_XML = b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity
        type="win32"
        name="Microsoft.Windows.Common-Controls"
        version="6.0.0.0"
        processorArchitecture="*"
        publicKeyToken="6595b64144ccf1df"
        language="*"
      />
    </dependentAssembly>
  </dependency>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <!-- Windows 10 and Windows 11 -->
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
    </application>
  </compatibility>
</assembly>
"""

def pad32(b):
    pad = (4 - (len(b) % 4)) % 4
    return b + b"\x00" * pad

def make_version_string(key, val):
    key_bytes = (key + "\x00").encode("utf-16le")
    val_bytes = (val + "\x00").encode("utf-16le")
    wValueLength = len(val) + 1  # word count including null terminator
    wType = 1  # text
    header = struct.pack("<HHH", 0, wValueLength, wType) + key_bytes
    header = pad32(header)
    entry = pad32(header + val_bytes)
    return struct.pack("<H", len(entry)) + entry[2:]

def make_string_table(lang_cp, strings):
    body = b"".join(make_version_string(k, v) for k, v in strings.items())
    key_bytes = (lang_cp + "\x00").encode("utf-16le")
    header = struct.pack("<HHH", 0, 0, 1) + key_bytes
    header = pad32(header)
    block = pad32(header + body)
    return struct.pack("<H", len(block)) + block[2:]

def make_string_file_info(lang_cp, strings):
    st = make_string_table(lang_cp, strings)
    key_bytes = ("StringFileInfo\x00").encode("utf-16le")
    header = struct.pack("<HHH", 0, 0, 1) + key_bytes
    header = pad32(header)
    block = pad32(header + st)
    return struct.pack("<H", len(block)) + block[2:]

def make_var_file_info(lang, cp):
    val = struct.pack("<HH", lang, cp)
    key_bytes = ("Translation\x00").encode("utf-16le")
    header = struct.pack("<HHH", 0, 4, 0) + key_bytes
    header = pad32(header)
    var_block = pad32(header + val)
    var_block = struct.pack("<H", len(var_block)) + var_block[2:]

    key_bytes2 = ("VarFileInfo\x00").encode("utf-16le")
    header2 = struct.pack("<HHH", 0, 0, 1) + key_bytes2
    header2 = pad32(header2)
    block = pad32(header2 + var_block)
    return struct.pack("<H", len(block)) + block[2:]

def make_vs_version_info(major, minor, patch, build, strings, lang=0x0409, cp=0x04B0):
    lang_cp = f"{lang:04X}{cp:04X}"
    sfi = make_string_file_info(lang_cp, strings)
    vfi = make_var_file_info(lang, cp)

    file_ver_ms = (major << 16) | minor
    file_ver_ls = (patch << 16) | build
    fixed = struct.pack(
        "<IIIIIIIIIIIII",
        0xFEEF04BD,  # dwSignature
        0x00010000,  # dwStrucVersion
        file_ver_ms,
        file_ver_ls,
        file_ver_ms,
        file_ver_ls,
        0x3F,        # dwFileFlagsMask
        0,           # dwFileFlags
        0x00040004,  # dwFileOS (VOS_NT_WINDOWS32)
        1,           # dwFileType (VFT_APP)
        0,           # dwFileSubtype
        0, 0         # dwFileDate
    )

    key_bytes = ("VS_VERSION_INFO\x00").encode("utf-16le")
    header = struct.pack("<HHH", 0, len(fixed), 0) + key_bytes
    header = pad32(header)

    root = pad32(header + fixed) + sfi + vfi
    root = struct.pack("<H", len(root)) + root[2:]
    return root

def make_res_entry(type_id, name_id, data):
    data_size = len(data)
    header_size = 32
    # Struct: DataSize, HeaderSize, 0xFFFF, Type, 0xFFFF, Name, DataVersion, MemoryFlags, LanguageId, Version, Characteristics
    entry_header = struct.pack(
        "<IIHHHH I HH I I".replace(" ", ""),
        data_size,          # DataSize
        header_size,        # HeaderSize
        0xFFFF, type_id,    # Type
        0xFFFF, name_id,    # Name
        0,                  # DataVersion
        0x1030,             # MemoryFlags (MOVEABLE | PURE | PRELOAD)
        0x0409,             # LanguageId (en-US, 0x0409)
        0,                  # Version
        0                   # Characteristics
    )
    padding_len = (4 - (data_size % 4)) % 4
    return entry_header + data + (b"\x00" * padding_len)

def build_icon_resources(ico_bytes, group_ids=(32512, 1)):
    res_chunks = []
    if len(ico_bytes) < 6:
        return b""
    
    _, typ, count = struct.unpack("<HHH", ico_bytes[:6])
    if typ != 1 or count == 0:
        return b""
    
    grp_entries = []
    offset = 6
    for i in range(count):
        w, h, c, r, planes, bpp, size, img_off = struct.unpack("<BBBBHHII", ico_bytes[offset:offset+16])
        offset += 16
        icon_id = i + 1
        img_data = ico_bytes[img_off:img_off + size]
        
        # RT_ICON = 3
        res_chunks.append(make_res_entry(3, icon_id, img_data))
        
        # GRPICONDIRENTRY (14 bytes)
        grp_entries.append(struct.pack("<BBBBHHIH", w, h, c, r, planes, bpp, size, icon_id))
    
    # GRPICONDIR (6 bytes) + entries
    grp_data = struct.pack("<HHH", 0, 1, count) + b"".join(grp_entries)
    
    # RT_GROUP_ICON = 14
    for gid in group_ids:
        res_chunks.append(make_res_entry(14, gid, grp_data))
        
    return b"".join(res_chunks)

def create_complete_res(rc_path=None):
    # 1. Null header (32 bytes)
    null_header = (
        b"\x00\x00\x00\x00"  # DataSize
        b"\x20\x00\x00\x00"  # HeaderSize = 32
        b"\xff\xff\x00\x00"  # Type
        b"\xff\xff\x00\x00"  # Name
        b"\x00\x00\x00\x00"  # DataVersion
        b"\x00\x00"          # MemoryFlags
        b"\x00\x00"          # LanguageId
        b"\x00\x00\x00\x00"  # Version
        b"\x00\x00\x00\x00"  # Characteristics
    )

    chunks = [null_header]

    # 2. RT_MANIFEST (type 24, id 1)
    chunks.append(make_res_entry(24, 1, MANIFEST_XML))

    # Read rc file content if available
    rc_content = ""
    ico_path = None
    if rc_path and os.path.exists(rc_path):
        try:
            with open(rc_path, "r", encoding="utf-8", errors="ignore") as f:
                rc_content = f.read()
        except Exception:
            pass

    # 3. Parse and build RT_VERSION (type 16, id 1)
    strings = {}
    ver_nums = [0, 1, 0, 0]
    if rc_content:
        # Parse version numbers
        vm = re.search(r'FILEVERSION\s+(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)', rc_content)
        if vm:
            ver_nums = [int(vm.group(1)), int(vm.group(2)), int(vm.group(3)), int(vm.group(4))]
        
        # Parse string table entries
        for sm in re.finditer(r'VALUE\s+"([^"]+)"\s*,\s*"([^"]+)"', rc_content):
            strings[sm.group(1)] = sm.group(2)

    # If no strings were parsed, provide sensible defaults based on path
    if not strings:
        if rc_path and "desktop-gcalendar" in rc_path.lower():
            strings["FileDescription"] = "Desktop Calendar"
            strings["ProductName"] = "Desktop Calendar"
            strings["InternalName"] = "desktop-calendar"
            strings["OriginalFilename"] = "desktop-calendar.exe"
        else:
            strings["FileDescription"] = "Desktop Mail"
            strings["ProductName"] = "Desktop Mail"
            strings["InternalName"] = "desktop-mail"
            strings["OriginalFilename"] = "desktop-mail.exe"
        strings["CompanyName"] = "Andrey Eremin"
        strings["FileVersion"] = "0.1.0"
        strings["ProductVersion"] = "0.1.0"

    try:
        vinfo_data = make_vs_version_info(ver_nums[0], ver_nums[1], ver_nums[2], ver_nums[3], strings)
        chunks.append(make_res_entry(16, 1, vinfo_data))
    except Exception as e:
        sys.stderr.write(f"Warning: failed to build VERSIONINFO: {e}\n")

    # 4. Check for icon path in rc_path
    if rc_content:
        m = re.search(r'ICON\s+"([^"]+)"', rc_content)
        if m:
            ico_path = m.group(1)

    if not ico_path or not os.path.exists(ico_path):
        # Default fallback icon check
        if rc_path and "calendar" in rc_path.lower():
            candidates = [
                "/mnt/c/Users/andrey/Documents/GitHub/desktop-google-apps/apps/desktop-gcalendar/src-tauri/icons/icon.ico",
                "icons/icon.ico"
            ]
        else:
            candidates = [
                "/mnt/c/Users/andrey/Documents/GitHub/desktop-google-apps/apps/desktop-gmail/src-tauri/icons/icon.ico",
                "icons/icon.ico",
                "../icons/icon.ico"
            ]
        for c in candidates:
            if os.path.exists(c):
                ico_path = c
                break

    if ico_path and os.path.exists(ico_path):
        try:
            with open(ico_path, "rb") as f:
                ico_bytes = f.read()
            chunks.append(build_icon_resources(ico_bytes))
        except Exception as e:
            sys.stderr.write(f"Warning: failed to embed icon: {e}\n")

    return b"".join(chunks)

def main():
    args = sys.argv[1:]
    out_file = None
    rc_file = None

    for i, arg in enumerate(args):
        if arg.lower() in ("/fo", "-fo") and i + 1 < len(args):
            out_file = args[i + 1]
        elif arg.lower().startswith("/fo"):
            out_file = arg[3:]
        elif arg.endswith(".rc"):
            rc_file = arg

    if out_file:
        res_data = create_complete_res(rc_file)
        with open(out_file, "wb") as f:
            f.write(res_data)

    sys.exit(0)

if __name__ == "__main__":
    main()
