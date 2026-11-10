#!/usr/bin/env python3
import sys

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
        # Standard empty WIN32 .RES header (32 bytes)
        # DataSize: 0, HeaderSize: 32, Type: 0xFFFF0000, Name: 0xFFFF0000, DataVersion: 0, MemoryFlags: 0, LanguageId: 0, Version: 0, Characteristics: 0
        empty_res_header = (
            b"\x00\x00\x00\x00"  # DataSize = 0
            b"\x20\x00\x00\x00"  # HeaderSize = 32
            b"\xff\xff\x00\x00"  # Type = 0xFFFF
            b"\xff\xff\x00\x00"  # Name = 0xFFFF
            b"\x00\x00\x00\x00"  # DataVersion = 0
            b"\x00\x00"          # MemoryFlags = 0
            b"\x00\x00"          # LanguageId = 0
            b"\x00\x00\x00\x00"  # Version = 0
            b"\x00\x00\x00\x00"  # Characteristics = 0
        )
        with open(out_file, "wb") as f:
            f.write(empty_res_header)

    sys.exit(0)

if __name__ == "__main__":
    main()
