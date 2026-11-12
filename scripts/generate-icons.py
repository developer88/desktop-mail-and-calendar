import os
import subprocess
from PIL import Image

def generate():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    scratch = os.path.join(os.path.expanduser("~"), ".gemini", "antigravity-cli", "brain", "2fd59015-3f92-4354-aac0-8617b56c7c60", "scratch")
    if not os.path.exists(scratch):
        os.makedirs(scratch, exist_ok=True)

    mail_svg = os.path.join(scratch, "hq_mail.svg")
    cal_svg = os.path.join(scratch, "hq_calendar.svg")
    cal_blank_svg = os.path.join(scratch, "hq_calendar_blank.svg")

    for svg, base_name in [(mail_svg, "mail"), (cal_svg, "cal"), (cal_blank_svg, "cal_blank")]:
        for sz in [512, 256, 128, 64, 48, 32, 24, 16]:
            out = os.path.join(scratch, f"{base_name}_{sz}.png")
            subprocess.run(["rsvg-convert", "-w", str(sz), "-h", str(sz), svg, "-o", out], check=True)

    # 1. Desktop Mail
    gmail_icons = os.path.join(root, "apps", "desktop-gmail", "src-tauri", "icons")
    Image.open(os.path.join(scratch, "mail_512.png")).save(os.path.join(gmail_icons, "icon.png"))
    Image.open(os.path.join(scratch, "mail_256.png")).save(os.path.join(gmail_icons, "128x128@2x.png"))
    Image.open(os.path.join(scratch, "mail_128.png")).save(os.path.join(gmail_icons, "128x128.png"))
    Image.open(os.path.join(scratch, "mail_32.png")).save(os.path.join(gmail_icons, "32x32.png"))

    mail_ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    Image.open(os.path.join(scratch, "mail_256.png")).save(
        os.path.join(gmail_icons, "icon.ico"),
        format="ICO",
        sizes=mail_ico_sizes
    )

    # 2. Desktop Calendar
    gcal_icons = os.path.join(root, "apps", "desktop-gcalendar", "src-tauri", "icons")
    Image.open(os.path.join(scratch, "cal_512.png")).save(os.path.join(gcal_icons, "icon.png"))
    Image.open(os.path.join(scratch, "cal_256.png")).save(os.path.join(gcal_icons, "128x128@2x.png"))
    Image.open(os.path.join(scratch, "cal_128.png")).save(os.path.join(gcal_icons, "128x128.png"))
    Image.open(os.path.join(scratch, "cal_32.png")).save(os.path.join(gcal_icons, "32x32.png"))
    Image.open(os.path.join(scratch, "cal_blank_256.png")).save(os.path.join(gcal_icons, "blank_256.png"))
    Image.open(os.path.join(scratch, "cal_blank_128.png")).save(os.path.join(gcal_icons, "blank_128.png"))

    cal_ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    Image.open(os.path.join(scratch, "cal_256.png")).save(
        os.path.join(gcal_icons, "icon.ico"),
        format="ICO",
        sizes=cal_ico_sizes
    )

    print("Icons successfully generated and deployed!")

if __name__ == "__main__":
    generate()
