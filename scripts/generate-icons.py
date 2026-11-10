import os
import struct
import zlib

def make_png(width, height, r, g, b):
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw = b"".join(b"\x00" + bytes([r, g, b]) * width for _ in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )

def generate():
    base_repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    targets = [
        (os.path.join(base_repo, "apps", "desktop-gmail", "src-tauri", "icons"), 234, 67, 53),
        (os.path.join(base_repo, "apps", "desktop-gcalendar", "src-tauri", "icons"), 26, 115, 232),
    ]

    for base_dir, r, g, b in targets:
        os.makedirs(base_dir, exist_ok=True)
        for size, name in [
            (32, "32x32.png"),
            (128, "128x128.png"),
            (256, "128x128@2x.png"),
            (256, "icon.png"),
        ]:
            file_path = os.path.join(base_dir, name)
            with open(file_path, "wb") as f:
                f.write(make_png(size, size, r, g, b))

        # Windows .ico container embedding the 32x32 PNG
        png_data = make_png(32, 32, r, g, b)
        ico_header = struct.pack("<HHH", 0, 1, 1)
        ico_entry = struct.pack("<BBBBHHII", 32, 32, 0, 0, 1, 32, len(png_data), 22)
        with open(os.path.join(base_dir, "icon.ico"), "wb") as f:
            f.write(ico_header + ico_entry + png_data)

    print("Icons successfully generated for both apps.")

if __name__ == "__main__":
    generate()
