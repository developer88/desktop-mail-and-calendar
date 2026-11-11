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
    # Professional tactile envelope with white letter card
    scale = 4
    s = size * scale
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Palette
    orange_main = (249, 115, 22, 255)    # #f97316 (vibrant orange front)
    orange_dark = (217, 83, 10, 255)     # #d9530a (deep orange back)
    orange_crease = (194, 65, 12, 255)   # #c2410c
    white = (255, 255, 255, 255)
    gray_line = (203, 213, 225, 255)     # #cbd5e1

    # Geometry relative to s
    pad_x = int(s * 0.08)
    ew = s - 2 * pad_x
    eh = int(ew * 0.76)

    x0 = pad_x
    y0 = int(s * 0.22)
    x1 = x0 + ew
    y1 = y0 + eh
    r = int(s * 0.16)

    # 1. Back flap / envelope back
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=orange_dark)

    # 2. White letter peeking out at top
    lw = int(ew * 0.80)
    lh = int(eh * 0.72)
    lx0 = (s - lw) // 2
    ly0 = int(s * 0.10)
    lx1 = lx0 + lw
    ly1 = ly0 + lh
    lr = int(s * 0.08)
    draw.rounded_rectangle([lx0, ly0, lx1, ly1], radius=lr, fill=white)

    # Text lines on the letter
    line_h = max(2, int(s * 0.025))
    line_r = line_h // 2
    draw.rounded_rectangle(
        [lx0 + int(lw * 0.16), ly0 + int(lh * 0.28), lx0 + int(lw * 0.58), ly0 + int(lh * 0.28) + line_h],
        radius=line_r,
        fill=gray_line,
    )
    draw.rounded_rectangle(
        [lx0 + int(lw * 0.16), ly0 + int(lh * 0.48), lx0 + int(lw * 0.82), ly0 + int(lh * 0.48) + line_h],
        radius=line_r,
        fill=gray_line,
    )

    # 3. Front pocket (clipped to envelope rounded bounds)
    mask = Image.new("L", (s, s), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=255)

    front = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    f_draw = ImageDraw.Draw(front)

    cx = s // 2
    notch_y = y0 + int(eh * 0.44)
    # Front pocket polygon
    f_draw.polygon(
        [
            (x0, y0 + int(eh * 0.14)),
            (cx, notch_y),
            (x1, y0 + int(eh * 0.14)),
            (x1, y1),
            (x0, y1),
        ],
        fill=orange_main,
    )

    # Delicate crease line
    sw = max(2, int(s * 0.022))
    f_draw.line([(x0, y0 + int(eh * 0.14)), (cx, notch_y)], fill=orange_crease, width=sw)
    f_draw.line([(x1, y0 + int(eh * 0.14)), (cx, notch_y)], fill=orange_crease, width=sw)

    im.paste(front, (0, 0), mask)

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
