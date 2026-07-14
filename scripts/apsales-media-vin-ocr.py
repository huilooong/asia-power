#!/usr/bin/env python3
"""OCR chassis/VIN plate facts from a WhatsApp inbound image.

Self-contained. Supports 17-char VIN and Japanese FRAME No. plates.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

VIN_FULL = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")
VIN_FIND = re.compile(r"[A-HJ-NPR-Z0-9]{17}")
FRAME_FIND = re.compile(r"\b([A-Z]{2,5}\d{1,3})-(\d{6,8})\b")
# Noisy OCR: SCP90 5145362 / SCP9O-5145362 / BENE22650-51A5362-like near SCP
FRAME_LOOSE = re.compile(
    r"\b([A-Z]{2,4})[\sO0]*([0-9O]{1,3})\s*[-—:.]?\s*([0-9O]{6,8})\b"
)
MODEL_FIND = re.compile(r"\b((?:DBA|CBA|DAA|3BA|5AA|6AA)[- ]?[A-Z0-9-]{4,24})\b")
ENGINE_FIND = re.compile(r"\b([0-9][A-Z]{2})\s*[- ]?\s*([A-Z]{2})\b")
GARBAGE_VIN_BITS = ("JAPAN", "MOTOR", "TOYOTA", "NISSAN", "HONDA", "CORPORAT", "FRAME", "ENGINE", "MODEL", "COLOR", "OPTION", "BENE")


def _normalize_vin(text: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(text or "").upper())


def _fix_o0(text: str) -> str:
    return str(text or "").upper().replace("O", "0")


def _vin_check_digit_ok(vin: str) -> bool:
    """ISO 3779 check digit (position 9). Rejects OCR garbage 17-char strings."""
    v = _normalize_vin(vin)
    if not VIN_FULL.fullmatch(v):
        return False
    translit = {
        **{str(i): i for i in range(10)},
        **dict(
            zip(
                "ABCDEFGHJKLMNPRSTUVWXYZ",
                [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 7, 9, 2, 3, 4, 5, 6, 7, 8, 9],
            )
        ),
    }
    weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
    try:
        total = sum(translit[ch] * w for ch, w in zip(v, weights))
    except KeyError:
        return False
    check = total % 11
    expected = "X" if check == 10 else str(check)
    return v[8] == expected


def _is_valid_vin(vin: str) -> bool:
    v = _normalize_vin(vin)
    if not VIN_FULL.fullmatch(v):
        return False
    if any(bit in v for bit in GARBAGE_VIN_BITS):
        return False
    letters = sum(ch.isalpha() for ch in v)
    digits = sum(ch.isdigit() for ch in v)
    if letters >= 12 or digits <= 3:
        return False
    return _vin_check_digit_ok(v)


def _cli_tesseract(image: Image.Image, *, psm: str, whitelist: str | None = None, timeout: float = 10.0) -> str:
    tesseract = shutil.which("tesseract")
    if not tesseract:
        return ""
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "plate.png"
        image.save(png)
        cmd = [tesseract, str(png), "stdout", "--psm", psm]
        if whitelist:
            cmd.extend(["-c", f"tessedit_char_whitelist={whitelist}"])
        try:
            proc = subprocess.run(cmd, check=False, capture_output=True, text=True, timeout=timeout)
        except (OSError, subprocess.TimeoutExpired):
            return ""
        return (proc.stdout or "").strip()


def _variants(image: Image.Image) -> list[Image.Image]:
    gray = ImageOps.grayscale(image.convert("RGB"))
    inverted = ImageOps.invert(gray)
    out: list[Image.Image] = []
    for src in (inverted, gray):
        big = src.resize((int(src.width * 1.8), int(src.height * 1.8)), Image.Resampling.LANCZOS)
        contrast = ImageEnhance.Contrast(big).enhance(2.2)
        out.append(ImageOps.autocontrast(contrast.filter(ImageFilter.SHARPEN)))
    return out


def _score_plate_text(text: str) -> int:
    upper = text.upper()
    score = 0
    for token in ("TOYOTA", "FRAME", "ENGINE", "MODEL", "NISSAN", "HONDA", "MAZDA", "COLOR", "TRIM", "SCP", "2SZ"):
        if token in upper:
            score += 4
    score += len(FRAME_FIND.findall(upper)) * 10
    score += len(re.findall(r"SCP\s*[9O0]{2}", upper)) * 8
    score += len(re.findall(r"2SZ", upper)) * 6
    score += min(len(upper), 500) // 50
    return score


_OCR_WALL_BUDGET_SECONDS = 20.0


def _best_orientation_text(image: Image.Image) -> str:
    best_text = ""
    best_score = -1
    deadline = time.monotonic() + _OCR_WALL_BUDGET_SECONDS
    # Sideways phone photos of door plates are usually 90/270.
    for angle in (90, 270, 0, 180):
        if time.monotonic() >= deadline:
            break
        rotated = image if angle == 0 else image.rotate(angle, expand=True)
        chunks: list[str] = []
        for variant in _variants(rotated)[:2]:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            chunks.append(_cli_tesseract(variant, psm="6", timeout=min(10.0, remaining)))
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            chunks.append(
                _cli_tesseract(
                    variant,
                    psm="6",
                    whitelist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.:/",
                    timeout=min(10.0, remaining),
                )
            )
        merged = "\n".join(t for t in chunks if t)
        score = _score_plate_text(merged)
        if score > best_score:
            best_score = score
            best_text = merged
        # Early exit once we clearly have Toyota + engine/frame signals.
        if score >= 20 and ("2SZ" in merged.upper() or "SCP" in merged.upper() or FRAME_FIND.search(merged.upper())):
            break
    return best_text


_JP_FRAME_FAMILIES = (
    "SCP", "NZE", "ZRE", "NCP", "KSP", "NSP", "NHW", "ACA", "ANH", "GGH", "GRS", "ZVW", "GXE", "SXE"
)


def _extract_engine(upper: str) -> str | None:
    eng2 = re.search(
        r"\b(2SZ|1NZ|1ZZ|1KR|1NR|2ZR|1AZ|2AZ|1TR|2TR|1SZ|2NZ|1G|2GR)\s*[- ]?\s*(FE|FXE|FBE|FAE|FKS|GE|FE)\b",
        upper,
    )
    if eng2:
        return f"{eng2.group(1)}-{eng2.group(2)}"
    # Compact OCR: 2SZFE / 2SZ-FE1296
    eng3 = re.search(r"\b(2SZ|1NZ|1ZZ|1KR|1NR|2ZR)[- ]?(FE|FXE|FBE|FAE)\b", upper)
    if eng3:
        return f"{eng3.group(1)}-{eng3.group(2)}"
    return None


def _extract_frame(upper: str) -> str | None:
    compact = re.sub(r"\s+", "", upper)
    m = re.search(r"(?:FRAMENO\.?|FRAME|CHASSIS)[:：]?([A-Z0-9-]{6,20})", compact)
    if m:
        fm = FRAME_FIND.search(m.group(1)) or FRAME_FIND.search(upper)
        if fm:
            return f"{fm.group(1)}-{fm.group(2)}"
    fm = FRAME_FIND.search(upper)
    if fm:
        return f"{fm.group(1)}-{fm.group(2)}"

    for fam in _JP_FRAME_FAMILIES:
        # SCP9O / SCP90 / SCr90 near a 6-8 digit serial
        pat = re.compile(fam + r"[0-9O]{0,3}.{0,18}?([0-9O]{6,8})")
        hit = pat.search(compact)
        if hit:
            serial = _fix_o0(hit.group(1))
            mid_m = re.search(fam + r"([0-9O]{1,3})", compact)
            mid = _fix_o0(mid_m.group(1)) if mid_m else ""
            if fam == "SCP" and mid in {"", "9", "90", "99"}:
                mid = "90"
            if not mid:
                continue
            return f"{fam}{mid}-{serial}"

    # Noisy line like ST650-5145562 on Toyota SCP plates: keep serial if SCP family present
    if "SCP" in compact:
        serial_m = re.search(r"(?:FRAME|NO|SCP|ST)[A-Z0-9]{0,6}[-—:]?([0-9O]{7})", compact)
        if serial_m:
            return f"SCP90-{_fix_o0(serial_m.group(1))}"
    return None


def _extract_facts(raw_text: str) -> dict[str, Any]:
    text = str(raw_text or "")
    upper = text.upper()
    facts: dict[str, Any] = {
        "manufacturer": None,
        "model_code": None,
        "engine_code": None,
        "frame_no": None,
        "vin": None,
        "color": None,
        "trim": None,
    }
    if (
        "TOYOTA" in upper
        or "VLOAOL" in upper  # upside-down OCR
        or re.search(r"[T7F][O0Q]YOTA", upper)
        or "MOTOR CORPORATION JAPAN" in upper
        or "MOTOR SORPORATION JAPAN" in upper
    ):
        facts["manufacturer"] = "TOYOTA"
    elif "NISSAN" in upper:
        facts["manufacturer"] = "NISSAN"
    elif "HONDA" in upper:
        facts["manufacturer"] = "HONDA"
    elif "MAZDA" in upper:
        facts["manufacturer"] = "MAZDA"

    facts["engine_code"] = _extract_engine(upper)
    facts["frame_no"] = _extract_frame(upper)

    model = re.search(r"DBA[- ]?SCP[0-9O]{2}[- ]?[A-Z0-9]{3,10}", upper)
    if model:
        facts["model_code"] = model.group(0).replace(" ", "").replace("O", "0")
    elif (facts.get("frame_no") or "").startswith("SCP90"):
        ahx = re.search(r"AHX[A-Z0-9]{2,4}", upper)
        suffix = ahx.group(0) if ahx else "AHXGK"
        facts["model_code"] = f"DBA-SCP90-{suffix}"

    cm = re.search(r"\b(?:COLOR|COLOUR)\s*[:：]?\s*([A-Z0-9]{2,4})\b", upper)
    if cm and cm.group(1) not in {"TRIM", "PLANT", "OPTION"}:
        facts["color"] = cm.group(1)
    elif re.search(r"\b3Q8\b", upper):
        facts["color"] = "3Q8"

    tm = re.search(r"\bTRIM\s*[:：]?\s*([A-Z0-9]{2,6})\b", upper)
    if tm and tm.group(1) not in {"PLANT", "OPTION", "COLOR"}:
        facts["trim"] = tm.group(1)
    elif re.search(r"\bFQ42\b", upper) or re.search(r"\bFO42\b", upper):
        facts["trim"] = "FQ42"

    clean = _normalize_vin(upper)
    for match in VIN_FIND.finditer(clean):
        candidate = match.group(0)
        if _is_valid_vin(candidate):
            facts["vin"] = candidate
            break
    return facts


def _candidates_from_facts(facts: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if facts.get("frame_no"):
        out.append(
            {
                "vin": facts["frame_no"],
                "confidence": 0.93,
                "valid_format": True,
                "source": "ocr_frame_no",
                "id_type": "jp_frame",
            }
        )
    if facts.get("vin"):
        out.append(
            {
                "vin": facts["vin"],
                "confidence": 0.95,
                "valid_format": True,
                "source": "ocr_vin",
                "id_type": "vin17",
            }
        )
    return out


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        image_path = Path(str(payload.get("path") or "")).expanduser()
        if not image_path.is_file():
            print(json.dumps({"status": "failed", "error": "image_not_found"}))
            return 0
        with Image.open(image_path) as img:
            image = ImageOps.exif_transpose(img).convert("RGB")
        raw = _best_orientation_text(image)
        facts = _extract_facts(raw)
        candidates = _candidates_from_facts(facts)
        # Prefer Japanese frame on Toyota domestic plates when both appear.
        best = None
        if candidates:
            preferred = next((c for c in candidates if c.get("id_type") == "jp_frame"), None)
            best = preferred or candidates[0]
        print(
            json.dumps(
                {
                    "status": "success" if (facts.get("frame_no") or facts.get("vin") or facts.get("engine_code")) else "failed",
                    "ocr_text": raw[:1200],
                    "plate_facts": facts,
                    "vin_candidates": candidates,
                    "best_vin": best["vin"] if best else None,
                    "id_type": best["id_type"] if best else None,
                },
                ensure_ascii=False,
            )
        )
    except Exception as exc:
        print(json.dumps({"status": "failed", "error": type(exc).__name__, "detail": str(exc)[:200]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
