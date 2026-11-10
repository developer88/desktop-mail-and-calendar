#!/usr/bin/env python3
import sys
import struct

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

def create_res_with_manifest():
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

    # 2. RT_MANIFEST entry
    data_size = len(MANIFEST_XML)
    header_size = 32
    
    # RT_MANIFEST = 24 (0x18), ID = 1 (CREATEPROCESS_MANIFEST_RESOURCE_ID)
    manifest_header = struct.pack(
        "<IIHHHH I HH I I".replace(" ", ""),
        data_size,          # DataSize
        header_size,        # HeaderSize
        0xFFFF, 24,         # Type: 0xFFFF followed by 24 (RT_MANIFEST)
        0xFFFF, 1,          # Name: 0xFFFF followed by 1 (ID 1)
        0,                  # DataVersion
        0x1030,             # MemoryFlags (MOVEABLE | PURE | PRELOAD)
        0x0409,             # LanguageId (en-US, 0x0409)
        0,                  # Version
        0                   # Characteristics
    )

    padding_len = (4 - (data_size % 4)) % 4
    padding = b"\x00" * padding_len

    return null_header + manifest_header + MANIFEST_XML + padding

def main():
    args = sys.argv[1:]
    out_file = None

    for i, arg in enumerate(args):
        if arg.lower() in ("/fo", "-fo") and i + 1 < len(args):
            out_file = args[i + 1]
            break
        elif arg.lower().startswith("/fo"):
            out_file = arg[3:]
            break

    if out_file:
        res_data = create_res_with_manifest()
        with open(out_file, "wb") as f:
            f.write(res_data)

    sys.exit(0)

if __name__ == "__main__":
    main()
