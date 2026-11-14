import os
import subprocess
from PIL import Image

def generate():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    scratch = "/mnt/c/Users/andrey/.gemini/antigravity-cli/brain/2fd59015-3f92-4354-aac0-8617b56c7c60/scratch"
    if not os.path.exists(scratch):
        os.makedirs(scratch, exist_ok=True)

    mail_svg = os.path.join(scratch, "hq_mail.svg")
    cal_svg = os.path.join(scratch, "hq_calendar.svg")
    cal_blank_svg = os.path.join(scratch, "hq_calendar_blank.svg")

    sizes = [1024, 512, 256, 128, 64, 48, 32, 24, 16]
    for svg, base_name in [(mail_svg, "mail"), (cal_svg, "cal"), (cal_blank_svg, "cal_blank")]:
        for sz in sizes:
            out = os.path.join(scratch, f"{base_name}_{sz}.png")
            subprocess.run(["rsvg-convert", "-w", str(sz), "-h", str(sz), svg, "-o", out], check=True)

    # 1. Desktop Mail
    mail_icons = os.path.join(root, "apps", "desktop-mail", "src-tauri", "icons")
    Image.open(os.path.join(scratch, "mail_1024.png")).save(os.path.join(mail_icons, "icon_1024.png"))
    Image.open(os.path.join(scratch, "mail_1024.png")).save(os.path.join(mail_icons, "icon.png"))
    Image.open(os.path.join(scratch, "mail_512.png")).save(os.path.join(mail_icons, "512x512.png"))
    Image.open(os.path.join(scratch, "mail_256.png")).save(os.path.join(mail_icons, "128x128@2x.png"))
    Image.open(os.path.join(scratch, "mail_128.png")).save(os.path.join(mail_icons, "128x128.png"))
    Image.open(os.path.join(scratch, "mail_32.png")).save(os.path.join(mail_icons, "32x32.png"))

    mail_ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    Image.open(os.path.join(scratch, "mail_256.png")).save(
        os.path.join(mail_icons, "icon.ico"),
        format="ICO",
        sizes=mail_ico_sizes
    )

    # 2. Desktop Calendar
    cal_icons = os.path.join(root, "apps", "desktop-calendar", "src-tauri", "icons")
    Image.open(os.path.join(scratch, "cal_1024.png")).save(os.path.join(cal_icons, "icon_1024.png"))
    Image.open(os.path.join(scratch, "cal_1024.png")).save(os.path.join(cal_icons, "icon.png"))
    Image.open(os.path.join(scratch, "cal_512.png")).save(os.path.join(cal_icons, "512x512.png"))
    Image.open(os.path.join(scratch, "cal_256.png")).save(os.path.join(cal_icons, "128x128@2x.png"))
    Image.open(os.path.join(scratch, "cal_128.png")).save(os.path.join(cal_icons, "128x128.png"))
    Image.open(os.path.join(scratch, "cal_32.png")).save(os.path.join(cal_icons, "32x32.png"))
    Image.open(os.path.join(scratch, "cal_blank_1024.png")).save(os.path.join(cal_icons, "blank_1024.png"))
    Image.open(os.path.join(scratch, "cal_blank_512.png")).save(os.path.join(cal_icons, "blank_512.png"))
    Image.open(os.path.join(scratch, "cal_blank_256.png")).save(os.path.join(cal_icons, "blank_256.png"))
    Image.open(os.path.join(scratch, "cal_blank_128.png")).save(os.path.join(cal_icons, "blank_128.png"))

    cal_ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    Image.open(os.path.join(scratch, "cal_256.png")).save(
        os.path.join(cal_icons, "icon.ico"),
        format="ICO",
        sizes=cal_ico_sizes
    )

    # 3. High-Resolution 6x Installer Sidebar Bitmaps (984x1884 for High-DPI screens)
    generate_installer_bitmaps(root)

    print("Icons successfully generated up to 1024x1024 and deployed!")

def generate_installer_bitmaps(root):
    from PIL import ImageDraw
    scale = 6
    W = 164 * scale   # 984
    H = 314 * scale   # 1884
    icon_sz = 128 * scale  # 768
    x = 18 * scale    # 108
    y = 90 * scale    # 540

    installer_dir = os.path.join(root, "shared", "installer")
    os.makedirs(installer_dir, exist_ok=True)

    # Desktop Mail: Slate to warm copper gradient
    im_mail = Image.new("RGB", (W, H), color="#1e293b")
    draw_mail = ImageDraw.Draw(im_mail)
    for row in range(H):
        t = row / float(H)
        r = int(30 + t * (234 - 30) * 0.35)
        g = int(41 + t * (88 - 41) * 0.35)
        b = int(59 + t * (12 - 59) * 0.35)
        draw_mail.line([(0, row), (W, row)], fill=(r, g, b))

    mail_ico = Image.open(os.path.join(root, "apps", "desktop-mail", "src-tauri", "icons", "icon_1024.png")).convert("RGBA")
    mail_ico = mail_ico.resize((icon_sz, icon_sz), Image.Resampling.LANCZOS)
    im_mail.paste(mail_ico, (x, y), mail_ico)
    im_mail.save(os.path.join(installer_dir, "wizard_mail.bmp"), format="BMP")

    # Desktop Calendar: Slate to deep emerald gradient
    im_cal = Image.new("RGB", (W, H), color="#1e293b")
    draw_cal = ImageDraw.Draw(im_cal)
    for row in range(H):
        t = row / float(H)
        r = int(30 + t * (22 - 30) * 0.35)
        g = int(41 + t * (163 - 41) * 0.35)
        b = int(59 + t * (74 - 59) * 0.35)
        draw_cal.line([(0, row), (W, row)], fill=(r, g, b))

    cal_ico = Image.open(os.path.join(root, "apps", "desktop-calendar", "src-tauri", "icons", "icon_1024.png")).convert("RGBA")
    cal_ico = cal_ico.resize((icon_sz, icon_sz), Image.Resampling.LANCZOS)
    im_cal.paste(cal_ico, (x, y), cal_ico)
    im_cal.save(os.path.join(installer_dir, "wizard_cal.bmp"), format="BMP")

if __name__ == "__main__":
    generate()
