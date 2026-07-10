from __future__ import annotations

import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "uploads/videos/raw/tiktok-inbox/2026-07-06-corolla09-v2/v5-gallery"
SCENES = OUT / "scenes"
W, H = 1080, 1920


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    names = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Helvetica.ttf",
    ]
    for name in names:
        if name and Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


F_BIG = font(78, True)
F_HEAD = font(58, True)
F_BODY = font(40, False)
F_BODY_B = font(40, True)
F_SMALL = font(28, False)
F_TAG = font(28, True)


def cover(path: Path, size: tuple[int, int]) -> Image.Image:
    im = Image.open(path).convert("RGB")
    tw, th = size
    scale = max(tw / im.width, th / im.height)
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.Resampling.LANCZOS)
    x = (im.width - tw) // 2
    y = (im.height - th) // 2
    return im.crop((x, y, x + tw, y + th))


def contain(path: Path, size: tuple[int, int], bg=(244, 247, 250)) -> Image.Image:
    im = Image.open(path).convert("RGB")
    im.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, bg)
    canvas.paste(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2))
    return canvas


def grad() -> Image.Image:
    im = Image.new("RGB", (W, H), (11, 16, 24))
    d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H
        d.line((0, y, W, y), fill=(int(12 + 18 * t), int(17 + 20 * t), int(25 + 24 * t)))
    return im


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, width: int) -> list[str]:
    lines = []
    for para in text.split("\n"):
        cur = ""
        for word in para.split():
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


def text_block(d: ImageDraw.ImageDraw, xy, text: str, fnt, width: int, fill=(255, 255, 255), gap=8):
    x, y = xy
    for line in wrap(d, text, fnt, width):
        d.text((x, y), line, font=fnt, fill=fill)
        y += d.textbbox((0, 0), line, font=fnt)[3] + gap
    return y


def caption(im: Image.Image, text: str):
    d = ImageDraw.Draw(im)
    box = Image.new("RGBA", (W - 84, 184), (0, 0, 0, 186))
    mask = Image.new("L", box.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, box.width, box.height), radius=28, fill=255)
    im.paste(box, (42, H - 238), mask)
    text_block(d, (76, H - 205), text, F_BODY_B, W - 152, gap=6)


def label(d: ImageDraw.ImageDraw, xy, text: str, fill=(255, 203, 78)):
    x, y = xy
    d.rounded_rectangle((x, y, x + d.textbbox((0, 0), text, font=F_TAG)[2] + 34, y + 48), radius=18, fill=(16, 26, 40))
    d.text((x + 17, y + 10), text, font=F_TAG, fill=fill)


def photo_tile(base: Image.Image, path: Path, box, title: str | None = None):
    d = ImageDraw.Draw(base)
    x1, y1, x2, y2 = box
    d.rounded_rectangle(box, radius=26, fill=(235, 239, 244))
    im = cover(path, (x2 - x1, y2 - y1))
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width, im.height), radius=26, fill=255)
    base.paste(im, (x1, y1), mask)
    if title:
        shade = Image.new("RGBA", (x2 - x1, 92), (0, 0, 0, 170))
        base.paste(shade, (x1, y2 - 92), shade)
        d.text((x1 + 22, y2 - 64), title, font=F_BODY_B, fill=(255, 255, 255))


def qxb_pick() -> list[Path]:
    roots = [
        ROOT / "data/qxb-photos/row-0522_丰田_丰田 花冠 2004款 1.8L 自动GLX-i",
        ROOT / "data/qxb-photos/row-0011_丰田_丰田 凯美瑞 2009款 240V G-BOOK智能导航版",
        ROOT / "data/qxb-photos/row-0071_起亚_起亚 起亚K5 2011款 2.0L 自动GLS",
        ROOT / "data/qxb-photos/row-0410_现代_现代 胜达经典 2011款 2.4L 至尊版 七座四驱",
        ROOT / "data/qxb-photos/row-0507_本田_本田 本田CR-V 2010款 2.0L 自动两驱都市版",
    ]
    picks = []
    for r in roots:
        picks.extend(sorted(r.glob("*.jpg"))[:4])
    return picks


def scene_intro(a):
    im = grad()
    d = ImageDraw.Draw(im)
    hero = cover(a["hero_engine"], (W, 1180))
    hero = ImageEnhance.Contrast(hero).enhance(1.12)
    im.paste(hero, (0, 0))
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 110))
    im.paste(shade, (0, 0), shade)
    label(d, (54, 62), "asia-power.com")
    text_block(d, (54, 160), "China stock for Ghana mechanics", F_BIG, 940)
    text_block(d, (54, 338), "Engines, gearboxes, half-cuts and more.", F_BODY_B, 840)
    photo_tile(im, a["engine"], (54, 920, 514, 1360), "Engines")
    photo_tile(im, a["gearbox"], (566, 920, 1026, 1360), "Gearboxes")
    caption(im, "Mechanics in Ghana — pick your part from China. We handle the rest.")
    return im


def scene_website(a):
    im = grad()
    d = ImageDraw.Draw(im)
    d.text((54, 60), "Browse. Pick. Send.", font=F_HEAD, fill=(255, 255, 255))
    d.text((58, 132), "Website shows China stock", font=F_BODY, fill=(218, 226, 236))
    photo_tile(im, a["site"], (620, 210, 1010, 1060), None)
    for i, p in enumerate([a["engine"], a["gearbox"], a["halfcut"]]):
        photo_tile(im, p, (58, 250 + i * 315, 560, 530 + i * 315), ["Engine stock", "Gearbox stock", "Half-cut stock"][i])
    d.rounded_rectangle((94, 1190, 986, 1348), radius=28, fill=(244, 247, 250))
    d.text((128, 1232), "asia-power.com", font=font(64, True), fill=(17, 46, 84))
    caption(im, "Browse our website. Real inventory from China.")
    return im


def scene_categories(a):
    im = grad()
    d = ImageDraw.Draw(im)
    d.text((54, 64), "What we can supply", font=F_HEAD, fill=(255, 255, 255))
    photo_tile(im, a["engine"], (54, 190, 1026, 620), "Complete engines")
    photo_tile(im, a["gearbox"], (54, 670, 514, 1120), "Gearboxes")
    photo_tile(im, a["halfcut"], (566, 670, 1026, 1120), "Half-cuts")
    photo_tile(im, a["chassis"], (54, 1170, 1026, 1510), "Chassis / donor cars")
    caption(im, "Engines, gearboxes, half-cuts — see what is in stock.")
    return im


def scene_grid(a):
    im = grad()
    d = ImageDraw.Draw(im)
    d.text((54, 64), "Real donor car photos", font=F_HEAD, fill=(255, 255, 255))
    d.text((58, 132), "Choose the exact piece before we quote.", font=F_BODY, fill=(220, 228, 238))
    x0, y0, gap = 54, 230, 22
    w, h = 310, 300
    for i, p in enumerate(a["qxb"][:12]):
        x = x0 + (i % 3) * (w + gap)
        y = y0 + (i // 3) * (h + gap)
        photo_tile(im, p, (x, y, x + w, y + h), None)
    caption(im, "Find what you need. Send us the exact piece.")
    return im


def scene_service(a):
    im = grad()
    d = ImageDraw.Draw(im)
    d.text((54, 64), "From China to Ghana", font=F_HEAD, fill=(255, 255, 255))
    photo_tile(im, a["hero_halfcut"], (54, 190, 1026, 860), None)
    steps = [("1", "Remove selected part"), ("2", "Ship from China"), ("3", "Customs clearance")]
    for i, (n, t) in enumerate(steps):
        y = 940 + i * 170
        d.rounded_rectangle((72, y, 1008, y + 120), radius=26, fill=(244, 247, 250))
        d.ellipse((106, y + 26, 174, y + 94), fill=(20, 72, 122))
        d.text((128, y + 40), n, font=F_TAG, fill=(255, 255, 255))
        d.text((208, y + 36), t, font=F_BODY_B, fill=(16, 28, 44))
    caption(im, "We remove the part, ship it, and handle customs clearance.")
    return im


def scene_pickup(a):
    im = grad()
    d = ImageDraw.Draw(im)
    photo_tile(im, a["isuzu"], (54, 90, 1026, 760), "Ghana pickup after arrival")
    photo_tile(im, a["qxb"][12], (54, 820, 514, 1290), "Toyota")
    photo_tile(im, a["qxb"][16], (566, 820, 1026, 1290), "Hyundai / Kia")
    d.rounded_rectangle((84, 1370, 996, 1508), radius=26, fill=(244, 247, 250))
    d.text((126, 1412), "No sourcing headache. No customs stress.", font=F_BODY_B, fill=(16, 28, 44))
    caption(im, "When it arrives, pick up from our office in Ghana.")
    return im


def scene_request(a):
    im = grad()
    d = ImageDraw.Draw(im)
    d.text((54, 64), "Need another part?", font=F_HEAD, fill=(255, 255, 255))
    pics = [a["qxb"][1], a["qxb"][5], a["qxb"][9], a["qxb"][13]]
    photo_tile(im, pics[0], (54, 190, 514, 670), "Toyota")
    photo_tile(im, pics[1], (566, 190, 1026, 670), "Camry")
    photo_tile(im, pics[2], (54, 720, 514, 1200), "Kia")
    photo_tile(im, pics[3], (566, 720, 1026, 1200), "Honda")
    d.rounded_rectangle((84, 1300, 996, 1450), radius=26, fill=(244, 247, 250))
    d.text((126, 1342), "Send model, year, photo, destination.", font=F_BODY_B, fill=(16, 28, 44))
    caption(im, "Need something not on the site? Leave us a message — we will find it.")
    return im


def scene_cta(a):
    im = grad()
    d = ImageDraw.Draw(im)
    hero = cover(a["engine"], (W, H))
    hero = ImageEnhance.Contrast(hero).enhance(1.15)
    im.paste(hero, (0, 0))
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 145))
    im.paste(shade, (0, 0), shade)
    d.text((58, 620), "Shop stock from China", font=F_BIG, fill=(255, 255, 255))
    d.text((58, 770), "asia-power.com", font=font(88, True), fill=(255, 205, 76))
    d.rounded_rectangle((58, 990, 1022, 1250), radius=34, fill=(244, 247, 250))
    d.text((102, 1040), "Engines  |  Gearboxes  |  Half-cuts", font=F_BODY_B, fill=(16, 28, 44))
    d.text((102, 1110), "Pick the part. We handle the rest.", font=F_BODY, fill=(75, 88, 106))
    caption(im, "Visit our website today.")
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    SCENES.mkdir(parents=True, exist_ok=True)
    a = {
        "engine": ROOT / "assets/images/supply-engines.jpg",
        "gearbox": ROOT / "assets/images/supply-gearbox.jpg",
        "halfcut": ROOT / "assets/images/supply-halfcut.jpg",
        "chassis": ROOT / "assets/images/supply-chassis.jpg",
        "hero_engine": ROOT / "assets/images/hero-engine.jpg",
        "hero_halfcut": ROOT / "assets/images/hero-halfcut.jpg",
        "isuzu": ROOT / "docs/tiktok/assets/isuzu_truck.webp",
        "site": ROOT / "uploads/videos/raw/tiktok-inbox/2026-07-06-corolla09-v2/site-shots/home-mobile.png",
        "qxb": qxb_pick(),
    }
    scenes = [
        ("00-intro.png", 3.6, scene_intro),
        ("01-website.png", 3.6, scene_website),
        ("02-categories.png", 4.6, scene_categories),
        ("03-grid.png", 4.4, scene_grid),
        ("04-service.png", 4.6, scene_service),
        ("05-pickup.png", 3.8, scene_pickup),
        ("06-request.png", 3.6, scene_request),
        ("07-cta.png", 2.24, scene_cta),
    ]
    concat = []
    for fn, dur, maker in scenes:
        p = SCENES / fn
        maker(a).save(p, quality=94)
        concat.append(f"file '{p}'\nduration {dur}\n")
    concat.append(f"file '{SCENES / scenes[-1][0]}'\n")
    (OUT / "concat.txt").write_text("".join(concat), encoding="utf-8")
    silent = OUT / "gallery-v5-silent.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", str(OUT / "concat.txt"),
            "-vf", "fps=30,format=yuv420p", "-r", "30", str(silent),
        ],
        check=True,
    )
    print(silent)


if __name__ == "__main__":
    main()
