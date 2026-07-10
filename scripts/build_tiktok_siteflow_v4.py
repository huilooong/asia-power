from __future__ import annotations

import math
import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "uploads/videos/raw/tiktok-inbox/2026-07-06-corolla09-v2/v4-siteflow"
SCENES = OUT / "scenes"
W, H = 1080, 1920


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Helvetica.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
    ]
    for p in candidates:
        if p and Path(p).exists():
            return ImageFont.truetype(p, size=size)
    return ImageFont.load_default()


F_TITLE = font(74, True)
F_HOOK = font(62, True)
F_BODY = font(44, False)
F_BODY_B = font(44, True)
F_SMALL = font(32, False)
F_TAG = font(28, True)


def fit_lines(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, width: int) -> list[str]:
    lines: list[str] = []
    for para in text.split("\n"):
        words = para.split()
        cur = ""
        for word in words:
            test = (cur + " " + word).strip()
            if draw.textbbox((0, 0), test, font=fnt)[2] <= width:
                cur = test
            else:
                if cur:
                    lines.append(cur)
                cur = word
        if cur:
            lines.append(cur)
    return lines


def draw_text_box(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fnt: ImageFont.ImageFont,
    width: int,
    fill=(250, 252, 255),
    line_gap=12,
) -> int:
    x, y = xy
    for line in fit_lines(draw, text, fnt, width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += draw.textbbox((0, 0), line, font=fnt)[3] + line_gap
    return y


def rounded(draw: ImageDraw.ImageDraw, box, radius=34, fill=(255, 255, 255), outline=None, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def cover_image(path: Path, size: tuple[int, int]) -> Image.Image:
    img = Image.open(path).convert("RGB")
    target_w, target_h = size
    scale = max(target_w / img.width, target_h / img.height)
    nw, nh = int(img.width * scale), int(img.height * scale)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - target_w) // 2
    top = (nh - target_h) // 2
    return img.crop((left, top, left + target_w, top + target_h))


def contain_image(path: Path, size: tuple[int, int]) -> Image.Image:
    img = Image.open(path).convert("RGB")
    img.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, (246, 248, 250))
    canvas.paste(img, ((size[0] - img.width) // 2, (size[1] - img.height) // 2))
    return canvas


def phone_frame(img: Image.Image, size=(470, 1018)) -> Image.Image:
    w, h = size
    phone = Image.new("RGBA", (w + 36, h + 36), (0, 0, 0, 0))
    d = ImageDraw.Draw(phone)
    d.rounded_rectangle((0, 0, w + 36, h + 36), radius=58, fill=(16, 20, 28))
    d.rounded_rectangle((18, 18, w + 18, h + 18), radius=46, fill=(255, 255, 255))
    shot = img.resize((w, h), Image.Resampling.LANCZOS)
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w, h), radius=42, fill=255)
    phone.paste(shot, (18, 18), mask)
    d.rounded_rectangle((w // 2 - 66, 26, w // 2 + 102, 54), radius=15, fill=(16, 20, 28))
    return phone


def background(accent=(28, 74, 134)) -> Image.Image:
    img = Image.new("RGB", (W, H), (14, 19, 29))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        r = int(12 + accent[0] * 0.20 * t)
        g = int(17 + accent[1] * 0.14 * t)
        b = int(25 + accent[2] * 0.12 * t)
        d.line((0, y, W, y), fill=(r, g, b))
    return img


def paste_card(base: Image.Image, path: Path, box: tuple[int, int, int, int], label: str):
    d = ImageDraw.Draw(base)
    x1, y1, x2, y2 = box
    rounded(d, box, radius=30, fill=(244, 247, 250))
    img = cover_image(path, (x2 - x1, y2 - y1 - 78))
    base.paste(img, (x1, y1))
    overlay = Image.new("RGBA", (x2 - x1, 90), (12, 18, 28, 210))
    base.paste(overlay, (x1, y2 - 90), overlay)
    d.text((x1 + 24, y2 - 64), label, font=F_BODY_B, fill=(255, 255, 255))


def caption_bar(img: Image.Image, text: str):
    d = ImageDraw.Draw(img)
    bar = Image.new("RGBA", (W - 96, 240), (0, 0, 0, 185))
    mask = Image.new("L", (W - 96, 240), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, W - 96, 240), radius=34, fill=255)
    img.paste(bar, (48, H - 310), mask)
    draw_text_box(d, (84, H - 276), text, F_BODY_B, W - 168, fill=(255, 255, 255), line_gap=8)


def scene_hook(assets):
    img = background((30, 100, 150))
    d = ImageDraw.Draw(img)
    hero = cover_image(assets["hero"], (W, 720)).filter(ImageFilter.GaussianBlur(1.2))
    img.paste(hero, (0, 0))
    shade = Image.new("RGBA", (W, 760), (0, 0, 0, 104))
    img.paste(shade, (0, 0), shade)
    d.text((58, 82), "ASIAPOWER", font=F_TAG, fill=(255, 205, 76))
    draw_text_box(d, (58, 150), "Ghana mechanics", F_TITLE, 900)
    draw_text_box(d, (58, 322), "Pick your part from China.\nWe handle the rest.", F_HOOK, 900)
    rounded(d, (58, 720, 1022, 1170), radius=36, fill=(245, 248, 252))
    for i, (name, sub) in enumerate([
        ("1. Browse", "real China inventory"),
        ("2. Choose", "the exact part"),
        ("3. Pick up", "at Ghana office"),
    ]):
        y = 770 + i * 128
        d.ellipse((94, y, 158, y + 64), fill=(23, 67, 120))
        d.text((116, y + 11), str(i + 1), font=F_SMALL, fill=(255, 255, 255))
        d.text((184, y - 2), name, font=F_BODY_B, fill=(14, 26, 43))
        d.text((184, y + 48), sub, font=F_SMALL, fill=(86, 98, 115))
    caption_bar(img, "Mechanics in Ghana — pick your part from China. We handle the rest.")
    return img


def scene_website(assets):
    img = background((36, 80, 110))
    d = ImageDraw.Draw(img)
    d.text((58, 80), "Browse our website", font=F_TITLE, fill=(255, 255, 255))
    d.text((62, 176), "Real inventory, straight from China", font=F_BODY, fill=(215, 224, 235))
    phone = phone_frame(Image.open(assets["site_home"]).convert("RGB"))
    img.paste(phone, (304, 330), phone)
    rounded(d, (72, 1280, 1008, 1520), radius=32, fill=(246, 248, 251))
    d.text((112, 1326), "China stock, shown before you order", font=F_BODY_B, fill=(15, 30, 48))
    d.text((112, 1392), "Use the website as proof and selection tool.", font=F_BODY, fill=(78, 91, 108))
    caption_bar(img, "Browse our website. Real inventory from China.")
    return img


def scene_inventory(assets):
    img = background((44, 64, 90))
    d = ImageDraw.Draw(img)
    d.text((58, 70), "Engines. Gearboxes. Half-cuts.", font=F_HOOK, fill=(255, 255, 255))
    d.text((62, 154), "Show the customer what is actually available.", font=F_BODY, fill=(214, 224, 236))
    paste_card(img, assets["engine"], (58, 260, 514, 780), "Engines")
    paste_card(img, assets["gearbox"], (566, 260, 1022, 780), "Gearboxes")
    paste_card(img, assets["halfcut"], (58, 850, 1022, 1380), "Half-cuts")
    caption_bar(img, "Engines, gearboxes, half-cuts — see what is in stock.")
    return img


def scene_pick(assets):
    img = background((36, 86, 110))
    d = ImageDraw.Draw(img)
    d.text((58, 76), "Pick the exact piece", font=F_TITLE, fill=(255, 255, 255))
    rounded(d, (58, 230, 1022, 1460), radius=38, fill=(245, 247, 250))
    d.rounded_rectangle((104, 292, 976, 390), radius=28, fill=(255, 255, 255), outline=(218, 226, 235), width=2)
    d.text((140, 320), "Search: Corolla 09 engine", font=F_BODY, fill=(31, 45, 62))
    rows = [
        ("Toyota Corolla 2009", "Engine assembly", "China stock"),
        ("Toyota Camry 2007", "Gearbox / engine", "China stock"),
        ("Hyundai ix35", "Half-cut / engine", "China stock"),
    ]
    for i, row in enumerate(rows):
        y = 450 + i * 275
        d.rounded_rectangle((104, y, 976, y + 220), radius=30, fill=(255, 255, 255), outline=(218, 226, 235), width=2)
        thumb = cover_image(assets["stock"][i], (220, 172))
        img.paste(thumb, (132, y + 24))
        d.text((382, y + 38), row[0], font=F_BODY_B, fill=(16, 29, 47))
        d.text((382, y + 100), row[1], font=F_BODY, fill=(65, 79, 96))
        d.rounded_rectangle((382, y + 154, 590, y + 196), radius=20, fill=(230, 244, 236))
        d.text((406, y + 164), row[2], font=F_TAG, fill=(18, 110, 58))
    caption_bar(img, "Find what you need. Send us the exact piece.")
    return img


def scene_process(assets):
    img = background((56, 72, 82))
    d = ImageDraw.Draw(img)
    d.text((58, 76), "We handle the hard part", font=F_TITLE, fill=(255, 255, 255))
    steps = [
        ("Disassemble", "remove the selected part"),
        ("Ship", "load from China"),
        ("Clear customs", "prepare Ghana pickup"),
    ]
    for i, (name, sub) in enumerate(steps):
        y = 310 + i * 360
        d.rounded_rectangle((82, y, 998, y + 260), radius=38, fill=(248, 250, 252))
        d.ellipse((126, y + 58, 250, y + 182), fill=(23, 67, 120))
        d.text((169, y + 89), str(i + 1), font=F_HOOK, fill=(255, 255, 255))
        d.text((292, y + 58), name, font=F_BODY_B, fill=(15, 28, 45))
        d.text((292, y + 124), sub, font=F_BODY, fill=(74, 88, 106))
    caption_bar(img, "We remove the part, ship it, and handle customs clearance.")
    return img


def scene_pickup(assets):
    img = background((26, 88, 92))
    d = ImageDraw.Draw(img)
    d.text((58, 82), "Arrives in Ghana", font=F_TITLE, fill=(255, 255, 255))
    rounded(d, (78, 310, 1002, 1240), radius=42, fill=(246, 248, 250))
    d.ellipse((410, 430, 670, 690), fill=(21, 96, 91))
    d.polygon([(540, 825), (424, 640), (656, 640)], fill=(21, 96, 91))
    d.ellipse((486, 505, 594, 613), fill=(255, 255, 255))
    d.text((210, 900), "Pickup at Ghana office", font=F_HOOK, fill=(16, 28, 44))
    draw_text_box(d, (186, 1000), "No sourcing headache.\nNo customs stress.", F_BODY, 720, fill=(78, 91, 108))
    caption_bar(img, "When it arrives, pick up from our office in Ghana.")
    return img


def scene_request(assets):
    img = background((70, 66, 92))
    d = ImageDraw.Draw(img)
    d.text((58, 78), "Not on the site?", font=F_TITLE, fill=(255, 255, 255))
    rounded(d, (82, 300, 998, 1260), radius=42, fill=(246, 248, 250))
    messages = [
        ("Customer", "I need engine for Corolla 09."),
        ("AsiaPower", "Send model year, gearbox type and city."),
        ("AsiaPower", "We will find the matching stock."),
    ]
    for i, (name, body) in enumerate(messages):
        y = 380 + i * 220
        fill = (255, 255, 255) if name == "Customer" else (229, 245, 238)
        d.rounded_rectangle((138, y, 942, y + 150), radius=30, fill=fill)
        d.text((174, y + 28), name, font=F_TAG, fill=(20, 78, 120))
        d.text((174, y + 74), body, font=F_BODY, fill=(20, 32, 48))
    caption_bar(img, "Need something not on the site? Leave us a message — we will find it.")
    return img


def scene_cta(assets):
    img = background((18, 42, 70))
    d = ImageDraw.Draw(img)
    hero = cover_image(assets["engine"], (W, 900))
    hero = ImageEnhance.Contrast(hero).enhance(1.08)
    img.paste(hero, (0, 0))
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 114))
    img.paste(shade, (0, 0), shade)
    d.text((58, 690), "Shop now", font=F_TITLE, fill=(255, 255, 255))
    d.text((58, 800), "asia-power.com", font=font(86, True), fill=(255, 205, 76))
    rounded(d, (58, 1010, 1022, 1280), radius=36, fill=(246, 248, 250))
    d.text((104, 1065), "Pick part → We ship → Ghana pickup", font=F_BODY_B, fill=(15, 28, 45))
    draw_text_box(d, (104, 1138), "Built for mechanics,\nparts sellers and workshops.", F_BODY, 820, fill=(75, 88, 106))
    caption_bar(img, "Visit our website today.")
    return img


def write_srt(captions: list[tuple[float, float, str]], path: Path):
    def ts(sec: float) -> str:
        h = int(sec // 3600)
        m = int(sec % 3600 // 60)
        s = int(sec % 60)
        ms = int((sec - math.floor(sec)) * 1000)
        return f"{h:02}:{m:02}:{s:02},{ms:03}"

    lines = []
    for i, (start, end, text) in enumerate(captions, 1):
        lines += [str(i), f"{ts(start)} --> {ts(end)}", text, ""]
    path.write_text("\n".join(lines), encoding="utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    SCENES.mkdir(parents=True, exist_ok=True)
    assets = {
        "hero": ROOT / "assets/images/hero-composite-ship-truck-machinery.png",
        "engine": ROOT / "assets/images/supply-engines.jpg",
        "gearbox": ROOT / "assets/images/supply-gearbox.jpg",
        "halfcut": ROOT / "assets/images/supply-halfcut.jpg",
        "site_home": ROOT / "uploads/videos/raw/tiktok-inbox/2026-07-06-corolla09-v2/site-shots/home-mobile.png",
        "stock": [
            ROOT / "docs/tiktok/assets/vios_engine.webp",
            ROOT / "assets/images/supply-gearbox.jpg",
            ROOT / "assets/images/supply-halfcut.jpg",
        ],
    }
    scenes = [
        ("00-hook.png", 3.0, scene_hook, "Mechanics in Ghana — pick your part from China. We handle the rest."),
        ("01-website.png", 5.0, scene_website, "Browse our website. Real inventory from China."),
        ("02-inventory.png", 7.0, scene_inventory, "Engines, gearboxes, half-cuts — see what is in stock."),
        ("03-pick.png", 5.0, scene_pick, "Find what you need. Send us the exact piece."),
        ("04-process.png", 6.0, scene_process, "We remove the part, ship it, and handle customs clearance."),
        ("05-pickup.png", 4.0, scene_pickup, "When it arrives, pick up from our office in Ghana."),
        ("06-request.png", 4.0, scene_request, "Need something not on the site? Leave us a message — we will find it."),
        ("07-cta.png", 3.0, scene_cta, "Visit our website today."),
    ]
    concat = []
    srt = []
    t = 0.0
    for filename, dur, fn, cap in scenes:
        img = fn(assets)
        path = SCENES / filename
        img.save(path, quality=94)
        concat.append(f"file '{path}'\nduration {dur}\n")
        srt.append((t, t + dur, cap))
        t += dur
    concat.append(f"file '{SCENES / scenes[-1][0]}'\n")
    (OUT / "concat.txt").write_text("".join(concat), encoding="utf-8")
    write_srt(srt, OUT / "siteflow-v4.srt")
    silent = OUT / "siteflow-v4-silent.mp4"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(OUT / "concat.txt"),
            "-vf",
            "fps=30,format=yuv420p",
            "-r",
            "30",
            str(silent),
        ],
        check=True,
    )
    print(silent)


if __name__ == "__main__":
    main()
