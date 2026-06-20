#!/usr/bin/env python3
"""Process AsiaPower master logo → transparent PNG/WebP/SVG assets."""
from __future__ import annotations

import base64
import json
import subprocess
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE_WHITE = ROOT / 'assets' / 'logo-source-white.png'
SOURCE = ROOT / 'assets' / 'logo-source.png'
ASSETS = ROOT / 'assets'
CWEBP = '/opt/homebrew/bin/cwebp'

WIDTHS = {
    'logo.png': 256,
    'logo@2x.png': 512,
    'logo@3x.png': 768,
}

BG_TOLERANCE = 42
FOOTER_BG = (6, 16, 24)  # --navy-950
FOOTER_BG_TOLERANCE = 36
CHINESE_TAGLINE = '亚洲动力'
BRAND_NAVY = (10, 37, 64)
BRAND_LIGHT = (236, 242, 248)
BRAND_WHITE = (255, 255, 255)
TEXT_SUPERSAMPLE = 2
CHINESE_FONT_CANDIDATES = [
    '/System/Library/AssetsV2/com_apple_MobileAsset_Font8/86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc',
    '/System/Library/Fonts/STHeiti Medium.ttc',
    '/System/Library/Fonts/Supplemental/Songti.ttc',
]
WHITE_BG_MIN = 238
DARK_MAX = 48
FRINGE_ALPHA = 240
ICON_ZONE_RATIO = 0.28  # fallback only


def is_dark(r: int, g: int, b: int) -> bool:
    return max(r, g, b) <= DARK_MAX


def is_background_pixel(r: int, g: int, b: int) -> bool:
    return max(r, g, b) <= BG_TOLERANCE


def is_white_background_pixel(r: int, g: int, b: int) -> bool:
    return min(r, g, b) >= WHITE_BG_MIN


def remove_white_background_flood(img: Image.Image) -> Image.Image:
    """Remove outer white matte; preserve enclosed whites (icon letter A)."""
    rgba = img.convert('RGBA')
    w, h = rgba.size
    px = rgba.load()
    bg = [[False] * w for _ in range(h)]

    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, _ = px[x, y]
            if is_white_background_pixel(r, g, b):
                if not bg[y][x]:
                    bg[y][x] = True
                    q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            r, g, b, _ = px[x, y]
            if is_white_background_pixel(r, g, b):
                if not bg[y][x]:
                    bg[y][x] = True
                    q.append((x, y))

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx]:
                r, g, b, _ = px[nx, ny]
                if is_white_background_pixel(r, g, b):
                    bg[ny][nx] = True
                    q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if bg[y][x]:
                px[x, y] = (0, 0, 0, 0)
            else:
                r, g, b, a = px[x, y]
                px[x, y] = (r, g, b, 255)

    return rgba


def defringe_white_halos(img: Image.Image) -> Image.Image:
    """Remove near-white fringe pixels that cause grey halos on light headers."""
    rgba = img.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if min(r, g, b) >= 220 and a < FRINGE_ALPHA:
                px[x, y] = (0, 0, 0, 0)
    return rgba


def erode_white_fringe(img: Image.Image, passes: int = 2) -> Image.Image:
    rgba = img.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size
    for _ in range(passes):
        to_clear: list[tuple[int, int]] = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0 or min(r, g, b) < 220:
                    continue
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                        to_clear.append((x, y))
                        break
        for x, y in to_clear:
            px[x, y] = (0, 0, 0, 0)
    return rgba


def remove_enclosed_white(img: Image.Image) -> Image.Image:
    """Turn enclosed white regions transparent (icon A, letter counters)."""
    rgba = img.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size
    seen = [[False] * w for _ in range(h)]

    for y in range(h):
        for x in range(w):
            if seen[y][x]:
                continue
            r, g, b, a = px[x, y]
            if a == 0 or min(r, g, b) < 250:
                continue
            q: deque[tuple[int, int]] = deque([(x, y)])
            seen[y][x] = True
            pts: list[tuple[int, int]] = []
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx]:
                        nr, ng, nb, na = px[nx, ny]
                        if na > 0 and min(nr, ng, nb) >= 250:
                            seen[ny][nx] = True
                            q.append((nx, ny))
            for cx, cy in pts:
                px[cx, cy] = (0, 0, 0, 0)

    return rgba


def process_from_white_source(src: Image.Image) -> Image.Image:
    transparent = remove_white_background_flood(src)
    transparent = remove_enclosed_white(transparent)
    transparent = defringe_white_halos(transparent)
    transparent = erode_white_fringe(transparent)
    transparent = trim_transparent(transparent)
    return add_safe_padding(transparent)


def process_from_black_source(src: Image.Image) -> Image.Image:
    """Legacy pipeline for black-matte logo sources."""
    transparent = remove_background_flood(src)
    transparent = trim_transparent(transparent)
    icon_right = detect_icon_right_px(transparent)
    transparent = remove_enclosed_dark(transparent, protect_left_px=icon_right)
    transparent = defringe_dark_halos(transparent)
    transparent = erode_dark_fringe(transparent)
    transparent = remove_stray_dark_pixels(transparent, icon_right)
    transparent = clean_emblem_base(transparent, icon_right)
    transparent = clean_icon_zone(transparent, icon_right)
    transparent = trim_transparent(transparent)
    return add_safe_padding(transparent)


def is_footer_bg_pixel(r: int, g: int, b: int) -> bool:
    return all(abs(channel - FOOTER_BG[i]) <= FOOTER_BG_TOLERANCE for i, channel in enumerate((r, g, b)))


def replace_black_matte_with_footer_bg(img: Image.Image) -> Image.Image:
    """Replace outer black matte with footer navy; keep logo fully opaque."""
    rgba = img.convert('RGBA')
    w, h = rgba.size
    px = rgba.load()
    bg = [[False] * w for _ in range(h)]

    q: deque[tuple[int, int]] = deque()
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        r, g, b, _ = px[x, y]
        if is_background_pixel(r, g, b):
            bg[y][x] = True
            q.append((x, y))

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx]:
                r, g, b, _ = px[nx, ny]
                if is_background_pixel(r, g, b):
                    bg[ny][nx] = True
                    q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if bg[y][x]:
                px[x, y] = (*FOOTER_BG, 255)
            else:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 255)

    return rgba


def trim_uniform_color(img: Image.Image, bg: tuple[int, int, int], tolerance: int = FOOTER_BG_TOLERANCE) -> Image.Image:
    rgba = img.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size

    def matches_bg(r: int, g: int, b: int) -> bool:
        return all(abs(channel - bg[i]) <= tolerance for i, channel in enumerate((r, g, b)))

    min_x, min_y, max_x, max_y = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and not matches_bg(r, g, b):
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    if max_x < min_x:
        return img
    return rgba.crop((min_x, min_y, max_x + 1, max_y + 1))


def add_footer_padding(img: Image.Image, pad: int = 6) -> Image.Image:
    out = Image.new('RGB', (img.width + pad * 2, img.height + pad * 2), FOOTER_BG)
    source = img.convert('RGBA')
    out.paste(source, (pad, pad), source)
    return out


def fill_enclosed_dark_with_footer_bg(img: Image.Image, protect_left_px: int) -> Image.Image:
    """Fill trapped black matte in letter counters with footer navy."""
    rgba = img.convert('RGBA')
    w, h = rgba.size
    px = rgba.load()
    seen = [[False] * w for _ in range(h)]

    for y in range(h):
        for x in range(w):
            if seen[y][x]:
                continue
            r, g, b, a = px[x, y]
            if a == 0 or not is_dark(r, g, b):
                continue

            q: deque[tuple[int, int]] = deque([(x, y)])
            seen[y][x] = True
            pts: list[tuple[int, int]] = []

            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx]:
                        nr, ng, nb, na = px[nx, ny]
                        if na > 0 and is_dark(nr, ng, nb):
                            seen[ny][nx] = True
                            q.append((nx, ny))

            xs = [p[0] for p in pts]
            if max(xs) <= protect_left_px:
                continue
            for cx, cy in pts:
                px[cx, cy] = (*FOOTER_BG, 255)

    return rgba


def normalize_footer_dark_pixels(img: Image.Image, icon_right: int) -> Image.Image:
    """Map leftover matte black to footer navy while preserving emblem and wordmark."""
    rgba = img.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or max(r, g, b) > DARK_MAX:
                continue
            if x <= icon_right and is_emblem_pixel(r, g, b):
                continue
            if x <= icon_right and max(r, g, b) <= DARK_MAX:
                continue  # keep emblem "A"
            if is_wordmark_pixel(r, g, b):
                continue
            px[x, y] = (*FOOTER_BG, 255)

    return rgba


def process_from_dark_source_for_footer(src: Image.Image) -> Image.Image:
    """Opaque footer logo on footer navy — no transparency halos on dark sections."""
    opaque = replace_black_matte_with_footer_bg(src)
    icon_right = detect_icon_right_px(opaque)
    opaque = fill_enclosed_dark_with_footer_bg(opaque, protect_left_px=icon_right)
    opaque = normalize_footer_dark_pixels(opaque, icon_right)
    opaque = trim_uniform_color(opaque, FOOTER_BG)
    return add_footer_padding(opaque)


def remove_background_flood(img: Image.Image) -> Image.Image:
    """Remove outer black background; preserve enclosed dark logo shapes."""
    rgba = img.convert('RGBA')
    w, h = rgba.size
    px = rgba.load()
    bg = [[False] * w for _ in range(h)]

    q: deque[tuple[int, int]] = deque()
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        r, g, b, _ = px[x, y]
        if is_background_pixel(r, g, b):
            bg[y][x] = True
            q.append((x, y))

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx]:
                r, g, b, _ = px[nx, ny]
                if is_background_pixel(r, g, b):
                    bg[ny][nx] = True
                    q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if bg[y][x]:
                px[x, y] = (0, 0, 0, 0)
            else:
                r, g, b, a = px[x, y]
                px[x, y] = (r, g, b, 255)

    return rgba


def remove_enclosed_dark(img: Image.Image, protect_left_px: int) -> Image.Image:
    """Turn enclosed near-black regions transparent (letter counters on black source)."""
    rgba = img.convert('RGBA')
    w, h = rgba.size
    px = rgba.load()
    seen = [[False] * w for _ in range(h)]

    for y in range(h):
        for x in range(w):
            if seen[y][x]:
                continue
            r, g, b, a = px[x, y]
            if a == 0 or not is_dark(r, g, b):
                continue

            q: deque[tuple[int, int]] = deque([(x, y)])
            seen[y][x] = True
            pts: list[tuple[int, int]] = []

            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx]:
                        nr, ng, nb, na = px[nx, ny]
                        if na > 0 and is_dark(nr, ng, nb):
                            seen[ny][nx] = True
                            q.append((nx, ny))

            xs = [p[0] for p in pts]
            min_x = min(xs)
            max_x = max(xs)
            # Keep intentional black in the emblem (left icon zone).
            if max_x <= protect_left_px:
                continue
            # Remove trapped background in letter counters / text zone.
            for cx, cy in pts:
                px[cx, cy] = (0, 0, 0, 0)

    return rgba


def defringe_dark_halos(img: Image.Image) -> Image.Image:
    """Remove semi-transparent dark pixels that cause halos on light headers."""
    rgba = img.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if max(r, g, b) <= DARK_MAX and a < FRINGE_ALPHA:
                px[x, y] = (0, 0, 0, 0)
    return rgba


def clean_icon_zone(img: Image.Image, icon_right: int) -> Image.Image:
    """Keep only the emblem black 'A'; remove matte smudges in the icon area."""
    rgba = img.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size
    seen = [[False] * w for _ in range(h)]
    keep: set[tuple[int, int]] = set()
    best: list[tuple[int, int]] = []

    for y in range(h):
        for x in range(min(w, icon_right + 1)):
            if seen[y][x]:
                continue
            r, g, b, a = px[x, y]
            if a == 0 or not is_dark(r, g, b):
                continue
            q: deque[tuple[int, int]] = deque([(x, y)])
            seen[y][x] = True
            pts: list[tuple[int, int]] = []
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx > icon_right or nx < 0 or ny < 0 or ny >= h or seen[ny][nx]:
                        continue
                    nr, ng, nb, na = px[nx, ny]
                    if na > 0 and is_dark(nr, ng, nb):
                        seen[ny][nx] = True
                        q.append((nx, ny))
            if len(pts) > len(best):
                best = pts

    keep.update(best)

    for y in range(h):
        for x in range(min(w, icon_right + 16)):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if (x, y) in keep:
                continue
            if is_emblem_pixel(r, g, b) or is_wordmark_pixel(r, g, b):
                continue
            if max(r, g, b) <= 90:
                px[x, y] = (0, 0, 0, 0)

    return rgba


def clean_emblem_base(img: Image.Image, icon_right: int) -> Image.Image:
    """Remove shadow smudges under the emblem left by the black source matte."""
    rgba = img.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size
    emblem_bottom = 0

    for y in range(h):
        for x in range(icon_right + 1):
            r, g, b, a = px[x, y]
            if a and is_emblem_pixel(r, g, b):
                emblem_bottom = max(emblem_bottom, y)

    cutoff = min(h, emblem_bottom + 4)
    for y in range(cutoff, h):
        for x in range(min(w, icon_right + 24)):
            if px[x, y][3]:
                px[x, y] = (0, 0, 0, 0)

    return rgba


def pick_chinese_font(size: int, *, medium: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    pingfang = CHINESE_FONT_CANDIDATES[0]
    if medium and Path(pingfang).exists():
        for idx in (4, 3, 2, 1, 0):
            try:
                return ImageFont.truetype(pingfang, size, index=idx)
            except OSError:
                continue
    for font_path in CHINESE_FONT_CANDIDATES:
        if not Path(font_path).exists():
            continue
        try:
            return ImageFont.truetype(font_path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_chinese_suffix(
    height: int,
    *,
    light: bool = False,
    sharp_text: bool = False,
) -> tuple[Image.Image, int]:
    """Render divider + Chinese tagline as a compositable RGBA strip."""
    scale = TEXT_SUPERSAMPLE if sharp_text else 1
    h = height * scale
    font_size = max(20, int(h * 0.78))
    font = pick_chinese_font(font_size, medium=light)

    probe = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    bbox = probe.textbbox((0, 0), CHINESE_TAGLINE, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    gap = max(10, int(h * 0.14))
    divider_w = max(2, int(h * 0.035))
    pad_right = max(8, int(h * 0.1))
    strip_w = gap + divider_w + gap + text_w + pad_right
    strip = Image.new('RGBA', (strip_w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(strip)

    divider_x = gap + divider_w // 2
    div_top = int(h * 0.18)
    div_bot = int(h * 0.82)
    divider_color = (*BRAND_WHITE, 110) if light else (*BRAND_NAVY, 100)
    draw.line([(divider_x, div_top), (divider_x, div_bot)], fill=divider_color, width=divider_w)

    text_x = gap + divider_w + gap
    text_y = (h - text_h) // 2 - bbox[1]
    text_color = (*BRAND_WHITE, 255) if light else (*BRAND_NAVY, 255)
    draw.text((text_x, text_y), CHINESE_TAGLINE, font=font, fill=text_color)

    if sharp_text:
        target_h = max(1, height)
        target_w = max(1, round(strip_w / scale))
        strip = strip.resize((target_w, target_h), Image.Resampling.LANCZOS)

    return strip, strip.width


def add_chinese_wordmark(img: Image.Image, *, light: bool = False, sharp_text: bool = False) -> Image.Image:
    """Append bilingual Chinese tagline to the right of the existing wordmark."""
    rgba = img.convert('RGBA')
    w, h = rgba.size
    suffix, suffix_w = render_chinese_suffix(h, light=light, sharp_text=sharp_text)
    out = Image.new('RGBA', (w + suffix_w, h), (0, 0, 0, 0))
    out.paste(rgba, (0, 0), rgba)
    out.paste(suffix, (w, 0), suffix)
    return out


def recolor_wordmark_for_dark_footer(img: Image.Image) -> Image.Image:
    """Lighten ASIAPOWER wordmark for transparent footer on navy — no baked black box."""
    rgba = img.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size
    icon_right = detect_icon_right_px(rgba)

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if x <= icon_right and is_emblem_pixel(r, g, b):
                continue
            if is_wordmark_pixel(r, g, b) or max(r, g, b) <= 150:
                px[x, y] = (*BRAND_WHITE, a)

    return rgba


def process_footer_transparent(src_white: Image.Image) -> Image.Image:
    """Transparent footer logo for dark sections — crisp text without matte background."""
    footer = process_from_white_source(src_white)
    footer = recolor_wordmark_for_dark_footer(footer)
    footer = add_chinese_wordmark(footer, light=True, sharp_text=True)
    footer = trim_transparent(footer)
    return add_safe_padding(footer)


def add_safe_padding(img: Image.Image, pad: int = 8) -> Image.Image:
    """Transparent padding so scaled header rendering does not pick up edge halos."""
    out = Image.new('RGBA', (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    out.paste(img, (pad, pad), img)
    return out


def is_wordmark_pixel(r: int, g: int, b: int) -> bool:
    if b > 65 and r < 60 and g < 80 and b >= max(r, g) - 5:
        return True
    if 55 <= max(r, g, b) <= 145 and abs(r - g) < 30 and abs(g - b) < 30:
        return True
    return False


def remove_stray_dark_pixels(img: Image.Image, icon_right: int) -> Image.Image:
    """Drop compression halos while preserving emblem and wordmark colors."""
    rgba = img.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if max(r, g, b) > 90:
                continue
            if x <= icon_right and is_emblem_pixel(r, g, b):
                continue
            if x <= icon_right and max(r, g, b) <= DARK_MAX:
                continue  # keep emblem "A"
            if x > icon_right and is_wordmark_pixel(r, g, b):
                continue
            px[x, y] = (0, 0, 0, 0)

    return rgba


def erode_dark_fringe(img: Image.Image, dark_max: int = 85, passes: int = 4) -> Image.Image:
    """Remove opaque dark anti-aliasing pixels touching transparency."""
    rgba = img.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size

    for _ in range(passes):
        to_clear: list[tuple[int, int]] = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0 or max(r, g, b) > dark_max:
                    continue
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                        to_clear.append((x, y))
                        break
        for x, y in to_clear:
            px[x, y] = (0, 0, 0, 0)

    return rgba


def is_emblem_pixel(r: int, g: int, b: int) -> bool:
    """Bright emblem facets — exclude navy wordmark blues."""
    if r > 100 and g < 70 and b < 70:
        return True
    if b > 90 and r < 70 and g < 90:
        return True
    if 95 <= g <= 200 and abs(r - g) < 45 and abs(b - g) < 45:
        return True
    return False


def detect_icon_right_px(img: Image.Image) -> int:
    """Right edge of the triangular emblem (exclude ASIAPOWER wordmark)."""
    rgba = img.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size
    right = int(w * 0.15)

    for x in range(w):
        emblem_pixels = sum(
            1
            for y in range(h)
            if px[x, y][3] and is_emblem_pixel(*px[x, y][:3])
        )
        if emblem_pixels >= 3:
            right = x

    return min(right + 10, int(w * 0.30))


def trim_transparent(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    return img.crop(bbox)


def resize_to_width(img: Image.Image, width: int) -> Image.Image:
    ratio = width / img.width
    height = max(1, round(img.height * ratio))
    return img.resize((width, height), Image.Resampling.LANCZOS)


def save_png(img: Image.Image, path: Path) -> None:
    img.save(path, 'PNG', optimize=True)


def save_webp(img: Image.Image, path: Path, *, opaque: bool = False) -> None:
    if opaque:
        rgb = img.convert('RGB')
        if Path(CWEBP).exists():
            tmp = path.with_suffix('.png.tmp')
            rgb.save(tmp, 'PNG', optimize=True)
            subprocess.run(
                [CWEBP, '-lossless', str(tmp), '-o', str(path)],
                check=True,
                stdout=subprocess.DEVNULL,
            )
            tmp.unlink(missing_ok=True)
        else:
            rgb.save(path, 'WEBP', lossless=True, quality=100)
        return

    if Path(CWEBP).exists():
        tmp = path.with_suffix('.png.tmp')
        save_png(img, tmp)
        subprocess.run(
            [CWEBP, '-lossless', '-alpha_q', '100', str(tmp), '-o', str(path)],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        tmp.unlink(missing_ok=True)
    else:
        img.save(path, 'WEBP', lossless=True, quality=100)


def create_embedded_svg(master: Image.Image, out_path: Path) -> str:
    import io

    buf = io.BytesIO()
    master.save(buf, format='PNG', optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    w, h = master.size
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="AsiaPower">
  <image width="{w}" height="{h}" xlink:href="data:image/png;base64,{b64}"/>
</svg>
'''
    out_path.write_text(svg, encoding='utf-8')
    return 'embedded-raster'


FOOTER_WIDTHS = {
    'logo-footer.png': 480,
    'logo-footer@2x.png': 960,
    'logo-footer@3x.png': 1440,
}


def export_logo_assets(
    transparent: Image.Image,
    widths: dict[str, int],
    webp_name: str,
    svg_name: str | None = None,
    *,
    opaque: bool = False,
) -> dict[str, dict]:
    files: dict[str, dict] = {}
    for name, width in widths.items():
        scaled = resize_to_width(transparent, width)
        out = ASSETS / name
        save_png(scaled.convert('RGB') if opaque else scaled, out)
        files[name] = {
            'width': scaled.width,
            'height': scaled.height,
            'bytes': out.stat().st_size,
        }

    webp_key = 'logo@2x.png' if 'logo@2x.png' in widths else 'logo-footer@2x.png'
    webp_src = resize_to_width(transparent, widths[webp_key])
    webp_path = ASSETS / webp_name
    save_webp(webp_src, webp_path, opaque=opaque)
    files[webp_name] = {
        'width': webp_src.width,
        'height': webp_src.height,
        'bytes': webp_path.stat().st_size,
    }

    if svg_name:
        svg_path = ASSETS / svg_name
        svg_method = create_embedded_svg(transparent, svg_path)
        files[svg_name] = {'bytes': svg_path.stat().st_size, 'method': svg_method}

    return files


def main() -> int:
    if not SOURCE_WHITE.exists() and not SOURCE.exists():
        print(f'Source not found: {SOURCE_WHITE} or {SOURCE}', file=sys.stderr)
        return 1

    ASSETS.mkdir(parents=True, exist_ok=True)
    meta: dict = {'files': {}}

    if SOURCE_WHITE.exists():
        src_white = Image.open(SOURCE_WHITE)
        header = add_chinese_wordmark(process_from_white_source(src_white))
        meta['header'] = {
            'source': str(SOURCE_WHITE),
            'pipeline': 'white+zh',
            'source_size': {'width': src_white.width, 'height': src_white.height},
            'cropped_size': {'width': header.width, 'height': header.height},
        }
        meta['files'].update(export_logo_assets(header, WIDTHS, 'logo.webp', 'logo.svg'))
    elif SOURCE.exists():
        src = Image.open(SOURCE)
        header = add_chinese_wordmark(process_from_black_source(src))
        meta['header'] = {
            'source': str(SOURCE),
            'pipeline': 'black+zh',
            'source_size': {'width': src.width, 'height': src.height},
            'cropped_size': {'width': header.width, 'height': header.height},
        }
        meta['files'].update(export_logo_assets(header, WIDTHS, 'logo.webp', 'logo.svg'))

    if SOURCE_WHITE.exists():
        src_white_footer = Image.open(SOURCE_WHITE)
        footer = process_footer_transparent(src_white_footer)
        meta['footer'] = {
            'source': str(SOURCE_WHITE),
            'pipeline': 'transparent-light+zh',
            'source_size': {'width': src_white_footer.width, 'height': src_white_footer.height},
            'cropped_size': {'width': footer.width, 'height': footer.height},
        }
        meta['files'].update(export_logo_assets(footer, FOOTER_WIDTHS, 'logo-footer.webp', opaque=False))
    elif SOURCE.exists():
        src_dark = Image.open(SOURCE)
        footer = add_chinese_wordmark(
            process_from_dark_source_for_footer(src_dark),
            light=True,
            sharp_text=True,
        )
        meta['footer'] = {
            'source': str(SOURCE),
            'pipeline': 'dark-opaque+zh-fallback',
            'source_size': {'width': src_dark.width, 'height': src_dark.height},
            'cropped_size': {'width': footer.width, 'height': footer.height},
        }
        meta['files'].update(export_logo_assets(footer, FOOTER_WIDTHS, 'logo-footer.webp', opaque=True))

    legacy = ASSETS / 'logo-hd.png'
    if legacy.exists():
        legacy.unlink()
        meta['removed'] = 'logo-hd.png'

    report = ASSETS / 'logo-build-report.json'
    report.write_text(json.dumps(meta, indent=2), encoding='utf-8')
    print(json.dumps(meta, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
