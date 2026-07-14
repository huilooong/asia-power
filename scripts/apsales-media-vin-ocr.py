#!/usr/bin/env python3
"""OCR VIN candidates from a local WhatsApp inbound image.

Reuses inventory_core.chassis_blur helpers. Read-only; stdin JSON in, stdout JSON out.
Never prints full image bytes.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from PIL import Image, ImageOps

from inventory_core.chassis_blur import (  # noqa: E402
    _normalize_vin,
    _ocr_tesseract_boxes,
    _ocr_tesseract_chars,
    _preprocess_variants,
    _pytesseract_available,
)

# NHTSA-compatible VIN charset (I/O/Q excluded). First char may be digit.
VIN_RE = re.compile(r"[A-HJ-NPR-Z0-9]{17}")
VIN_FULL = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")


def _is_valid_vin(vin: str) -> bool:
    return bool(VIN_FULL.fullmatch(_normalize_vin(vin)))


def _pick_vin_from_text(text: str) -> tuple[str, float]:
    clean = _normalize_vin(text)
    if not clean:
        return "", 0.0
    if _is_valid_vin(clean):
        return clean, 0.95
    best = ""
    for match in VIN_RE.finditer(clean):
        candidate = match.group(0)
        if _is_valid_vin(candidate):
            best = candidate
            break
    if not best:
        for idx in range(max(0, len(clean) - 16)):
            chunk = clean[idx : idx + 17]
            if _is_valid_vin(chunk):
                best = chunk
                break
    return best, 0.8 if best else 0.0


def _cli_tesseract_text(image: Image.Image) -> str:
    tesseract = shutil.which("tesseract")
    if not tesseract:
        return ""
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "vin.png"
        image.save(png)
        try:
            proc = subprocess.run(
                [
                    tesseract,
                    str(png),
                    "stdout",
                    "--psm",
                    "6",
                    "-c",
                    "tessedit_char_whitelist=ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
                ],
                check=False,
                capture_output=True,
                text=True,
                timeout=30,
            )
        except (OSError, subprocess.TimeoutExpired):
            return ""
        return _normalize_vin(proc.stdout or "")


def _add_candidate(
    candidates: list[dict[str, Any]],
    seen: set[str],
    text: str,
    source: str,
    conf: float,
) -> None:
    vin, picked_conf = _pick_vin_from_text(text)
    if not vin or vin in seen:
        return
    seen.add(vin)
    score = float(picked_conf if picked_conf else conf)
    if score > 1.0:
        score = score / 100.0
    candidates.append(
        {
            "vin": vin,
            "confidence": round(min(score, 1.0), 3),
            "valid_format": bool(_is_valid_vin(vin)),
            "source": source,
        }
    )


def _collect_text(image: Image.Image) -> tuple[str, list[dict[str, Any]]]:
    chunks: list[str] = []
    candidates: list[dict[str, Any]] = []
    seen: set[str] = set()

    if _pytesseract_available():
        for variant, scale in _preprocess_variants(image):
            boxes = _ocr_tesseract_boxes(variant, scale)
            for box in boxes:
                text = _normalize_vin(box.text)
                if text:
                    chunks.append(text)
                _add_candidate(candidates, seen, box.text, "tesseract_box", float(box.confidence or 60))
            for char_box in _ocr_tesseract_chars(variant, scale):
                text = _normalize_vin(getattr(char_box, "text", "") or "")
                if text:
                    chunks.append(text)

    cli_text = _cli_tesseract_text(image)
    if cli_text:
        chunks.append(cli_text)
        _add_candidate(candidates, seen, cli_text, "tesseract_cli", 70.0)

    joined = "".join(chunks)
    _add_candidate(candidates, seen, joined, "tesseract_joined", 60.0)
    candidates.sort(key=lambda row: (row["valid_format"], row["confidence"]), reverse=True)
    return joined[:2000], candidates[:8]


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        image_path = Path(str(payload.get("path") or "")).expanduser()
        if not image_path.is_file():
            print(json.dumps({"status": "failed", "error": "image_not_found"}))
            return 0
        with Image.open(image_path) as img:
            image = ImageOps.exif_transpose(img).convert("RGB")
        ocr_text, candidates = _collect_text(image)
        print(
            json.dumps(
                {
                    "status": "success",
                    "ocr_text": ocr_text,
                    "vin_candidates": candidates,
                    "best_vin": next((c["vin"] for c in candidates if c["valid_format"]), None),
                },
                ensure_ascii=False,
            )
        )
    except Exception as exc:
        print(json.dumps({"status": "failed", "error": type(exc).__name__}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
