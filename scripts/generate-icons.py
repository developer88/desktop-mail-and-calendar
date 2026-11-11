import os
from PIL import Image, ImageDraw, ImageFont

def render_calendar(size):
    # Professional tactile calendar pad matching Desktop Mail envelope style
    scale = 4
    s = size * scale
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Palette
    green_main = (34, 197, 94, 255)     # #22c55e (vibrant green header)
    green_dark = (21, 128, 61, 255)     # #15803d (deep green base/back)
    green_crease = (18, 107, 51, 255)   # #126b33
    green_text = (21, 128, 61, 255)     # #15803d
    white = (255, 255, 255, 255)

    # Geometry relative to s (identical bounding proportions to mail)
    pad_x = int(s * 0.08)
    cw = s - 2 * pad_x
    ch = int(cw * 0.88)

    x0 = pad_x
    y0 = int(s * 0.14)
    x1 = x0 + cw
    y1 = y0 + ch
    r = int(s * 0.16)

    # 1. Back plate / base in dark green
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=green_dark)

    # 2. White calendar tear-off page (solid white body)
    inset_x = int(s * 0.025)
    inset_y = int(s * 0.025)
    px0 = x0 + inset_x
    py0 = y0 + inset_y
    px1 = x1 - inset_x
    py1 = y1 - inset_y
    pr = int(r * 0.85)
    draw.rounded_rectangle([px0, py0, px1, py1], radius=pr, fill=white)

    # 3. Top header banner (vibrant green)
    header_h = int(ch * 0.32)
    top_mask = Image.new("L", (s, s), 0)
    tm_draw = ImageDraw.Draw(top_mask)
    tm_draw.rounded_rectangle([px0, py0, px1, py1], radius=pr, fill=255)
    tm_draw.rectangle([0, py0 + header_h, s, s], fill=0)

    header_layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    h_draw = ImageDraw.Draw(header_layer)
    h_draw.rectangle([px0, py0, px1, py0 + header_h], fill=green_main)

    sw = max(2, int(s * 0.018))
    h_draw.line([(px0, py0 + header_h), (px1, py0 + header_h)], fill=green_crease, width=sw)

    im.paste(header_layer, (0, 0), top_mask)

    # Binder rings / hanging tabs at top (2 rounded tabs)
    ring_w = int(s * 0.07)
    ring_h = int(s * 0.11)
    ring_y0 = y0 - int(ring_h * 0.30)
    ring_y1 = ring_y0 + ring_h
    rr = ring_w // 2

    rx1 = px0 + int((px1 - px0) * 0.28)
    rx2 = px0 + int((px1 - px0) * 0.72)

    draw.rounded_rectangle([rx1 - rr, ring_y0, rx1 + rr, ring_y1], radius=rr, fill=white, outline=green_dark, width=max(2, int(s * 0.015)))
    draw.rounded_rectangle([rx2 - rr, ring_y0, rx2 + rr, ring_y1], radius=rr, fill=white, outline=green_dark, width=max(2, int(s * 0.015)))

    # 4. Bold '31' text in lower body of the white page
    font_size = int((py1 - (py0 + header_h)) * 0.68)
    font_path = "/mnt/c/Windows/Fonts/segoeuib.ttf"
    if not os.path.exists(font_path):
        font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    font = ImageFont.truetype(font_path, font_size)

    text = "31"
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]

    center_y = py0 + header_h + (py1 - (py0 + header_h)) / 2
    tx = (s - tw) / 2 - bbox[0]
    ty = center_y - th / 2 - bbox[1]
    draw.text((tx, ty), text, font=font, fill=green_text)

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
