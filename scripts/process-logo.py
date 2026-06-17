#!/usr/bin/env python3
"""Process AsiaPower master logo → transparent PNG/WebP/SVG assets."""
from __future__ import annotations

import base64
import json
import struct
import subprocess
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(
    '/Users/longhui/.cursor/projects/Users-longhui-Desktop-AsiaPower/assets/'
    'logo-d7967094-b641-4040-9c3b-cefa23156b2b.png'
)
ASSETS = ROOT / 'assets'
CWEBP = '/opt/homebrew/bin/cwebp'

# Header-optimized widths (1x / 2x / 3x)
WIDTHS = {
    'logo.png': 256,
    'logo@2x.png': 512,
    'logo@3x.png': 768,
}

BG_TOLERANCE = 42  # max(R,G,B) for flood-fill background seeds


def is_background_pixel(r: int, g: int, b: int) -> bool:
    return max(r, g, b) <= BG_TOLERANCE


def remove_background_flood(img: Image.Image) -> Image.Image:
    """Remove outer black background; preserve enclosed dark logo shapes."""
    rgba = img.convert('RGBA')
    w, h = rgba.size
    px = rgba.load()
    bg = [[False] * w for _ in range(h)]

    q: deque[tuple[int, int]] = deque()
    for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        r, g, b, _ = px[x, y]
        if is_background_pixel(r, g, b):
            bg[y][x] = True
            q.append((x, y))

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, (y - 1)), (x, y + 1)):
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


def save_webp(img: Image.Image, path: Path) -> None:
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
    """SVG wrapper with embedded master PNG (true color fidelity)."""
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


def try_potrace_svg(cropped: Image.Image, out_path: Path) -> str | None:
    """Attempt monochrome vector trace (fallback quality check)."""
    potrace = subprocess.run(['which', 'potrace'], capture_output=True, text=True)
    if potrace.returncode != 0:
        return None

    tmp_bmp = ASSETS / '_logo_trace.bmp'
    tmp_svg = ASSETS / '_logo_trace.svg'
    gray = cropped.convert('L')
    gray = gray.point(lambda p: 255 if p > 40 else 0)
    gray.save(tmp_bmp)
    r = subprocess.run(
        ['potrace', str(tmp_bmp), '-s', '-o', str(tmp_svg), '--flat'],
        capture_output=True,
    )
    tmp_bmp.unlink(missing_ok=True)
    if r.returncode != 0:
        return None
    # Potrace is monochrome — not suitable as primary brand SVG
    tmp_svg.unlink(missing_ok=True)
    return None


def main() -> int:
    if not SOURCE.exists():
        print(f'Source not found: {SOURCE}', file=sys.stderr)
        return 1

    ASSETS.mkdir(parents=True, exist_ok=True)
    meta: dict = {'source': str(SOURCE)}

    src = Image.open(SOURCE)
    meta['source_size'] = {'width': src.width, 'height': src.height}

    transparent = trim_transparent(remove_background_flood(src))
    meta['cropped_size'] = {'width': transparent.width, 'height': transparent.height}
    meta['aspect'] = round(transparent.width / transparent.height, 4)

    files: dict[str, dict] = {}
    for name, width in WIDTHS.items():
        scaled = resize_to_width(transparent, width)
        out = ASSETS / name
        save_png(scaled, out)
        files[name] = {
            'width': scaled.width,
            'height': scaled.height,
            'bytes': out.stat().st_size,
        }

    # Combined webp from @2x (good balance for optional use)
    webp_src = resize_to_width(transparent, WIDTHS['logo@2x.png'])
    webp_path = ASSETS / 'logo.webp'
    save_webp(webp_src, webp_path)
    files['logo.webp'] = {
        'width': webp_src.width,
        'height': webp_src.height,
        'bytes': webp_path.stat().st_size,
    }

    svg_path = ASSETS / 'logo.svg'
    svg_method = create_embedded_svg(transparent, svg_path)
    files['logo.svg'] = {'bytes': svg_path.stat().st_size, 'method': svg_method}

    traced = try_potrace_svg(transparent, svg_path)
    meta['svg'] = {
        'created': True,
        'method': svg_method,
        'color_trace': traced or 'not-available (potrace monochrome only)',
    }
    meta['files'] = files

    # Remove legacy upscaled hd asset
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
