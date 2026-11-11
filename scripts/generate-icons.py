import os
from PIL import Image, ImageDraw, ImageFont

def render_calendar(size):
    scale = 4
    s = size * scale
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    pad = int(s * 0.08)
    x0, y0, x1, y1 = pad, pad, s - pad, s - pad
    r = int(s * 0.22)
    border_w = max(2, int(s * 0.05))

    # Lite Green Palette
    green = (34, 197, 94, 255)       # #22c55e (lite green)
    dark_green = (22, 163, 74, 255)  # #16a34a
    white = (255, 255, 255, 255)

    # White card body
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=white, outline=green, width=border_w)

    # Top header banner (clipped to card's top rounded corners)
    header_h = int((y1 - y0) * 0.34)
    mask = Image.new("L", (s, s), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=255)

    header = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    h_draw = ImageDraw.Draw(header)
    h_draw.rectangle([x0, y0, x1, y0 + header_h], fill=green)
    im.paste(header, (0, 0), mask)

    # Re-draw outer border to ensure crisp edges over the header
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, outline=green, width=border_w)

    # Draw '31' text in lower body
    font_size = int((y1 - y0 - header_h) * 0.65)
    font_path = "/mnt/c/Windows/Fonts/segoeuib.ttf"
    if not os.path.exists(font_path):
        font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    font = ImageFont.truetype(font_path, font_size)

    text = "31"
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]

    center_y = y0 + header_h + (y1 - (y0 + header_h)) / 2
    tx = (s - tw) / 2 - bbox[0]
    ty = center_y - th / 2 - bbox[1]
    draw.text((tx, ty), text, font=font, fill=dark_green)

    return im.resize((size, size), Image.Resampling.LANCZOS)

def render_mail(size):
    scale = 4
    s = size * scale
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    pad = int(s * 0.08)
    x0, y0, x1, y1 = pad, pad, s - pad, s - pad
    r = int(s * 0.22)
    border_w = max(2, int(s * 0.05))

    # Orange Palette
    orange = (249, 115, 22, 255)      # #f97316 (vibrant orange)
    dark_orange = (234, 88, 12, 255)  # #ea580c
    white = (255, 255, 255, 255)

    # White card body
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=white, outline=orange, width=border_w)

    # Envelope flap: triangular flap pointing down
    cx = s / 2
    flap_tip_y = y0 + int((y1 - y0) * 0.52)

    mask = Image.new("L", (s, s), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=255)

    flap_im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    f_draw = ImageDraw.Draw(flap_im)
    f_draw.polygon([(x0, y0), (x1, y0), (cx, flap_tip_y)], fill=orange)
    im.paste(flap_im, (0, 0), mask)

    # Diagonal fold lines from bottom corners
    fold_w = max(2, int(s * 0.035))
    draw.line([(x0 + border_w, y1 - border_w), (cx - int(s * 0.12), flap_tip_y + int(s * 0.04))], fill=orange, width=fold_w)
    draw.line([(x1 - border_w, y1 - border_w), (cx + int(s * 0.12), flap_tip_y + int(s * 0.04))], fill=orange, width=fold_w)

    # Re-draw outer border to ensure crisp edges over the flap
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, outline=orange, width=border_w)

    return im.resize((size, size), Image.Resampling.LANCZOS)

def generate():
    base_repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    targets = [
        ("apps/desktop-gmail/src-tauri/icons", render_mail),
        ("apps/desktop-gcalendar/src-tauri/icons", render_calendar),
    ]

    for rel_dir, renderer in targets:
        out_dir = os.path.join(base_repo, rel_dir)
        os.makedirs(out_dir, exist_ok=True)

        img_512 = renderer(512)
        img_256 = renderer(256)
        img_128 = renderer(128)
        img_32 = renderer(32)

        img_32.save(os.path.join(out_dir, "32x32.png"))
        img_128.save(os.path.join(out_dir, "128x128.png"))
        img_256.save(os.path.join(out_dir, "128x128@2x.png"))
        img_512.save(os.path.join(out_dir, "icon.png"))

        # Save true multi-resolution Windows ICO (16, 32, 48, 64, 128, 256)
        img_256.save(
            os.path.join(out_dir, "icon.ico"),
            format="ICO",
            sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
        )

    print("Icons successfully generated for Desktop Mail and Desktop Calendar.")

if __name__ == "__main__":
    generate()
