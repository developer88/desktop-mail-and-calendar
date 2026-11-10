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
    
    # Read icon dir entries
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

    # 3. Check for icon path in rc_path
    ico_path = None
    if rc_path and os.path.exists(rc_path):
        try:
            with open(rc_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            m = re.search(r'ICON\s+"([^"]+)"', content)
            if m:
                ico_path = m.group(1)
        except Exception:
            pass

    if not ico_path or not os.path.exists(ico_path):
        # Default fallback icon check
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
