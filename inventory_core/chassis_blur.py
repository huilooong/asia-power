"""Precisely mask the last 7 characters of a 17-char VIN on chassis plate photos."""

from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageDraw

VIN_STRICT = re.compile(r"[A-HJ-NPR-Z][A-HJ-NPR-Z0-9]{16}")
VIN_LOOSE = re.compile(r"[A-Z][A-Z0-9]{16}")
VIN_LABEL_RE = re.compile(r"vin.*plate|chassis.*plate|底盘|铭牌", re.I)

LAST_N = 7
VIN_LEN = 17
MIN_OCR_CONF = 35
MIN_VIN_MATCH = 12
PADDING_PX = 3

_EASYOCR_READER: Any = None


@dataclass
class TextBox:
    text: str
    left: int
    top: int
    right: int
    bottom: int
    confidence: float
    scale: float = 1.0
    source: str = ""


@dataclass
class VinDetection:
    vin: str
    suffix_box: tuple[int, int, int, int]
    confidence: float
    method: str
    needs_review: bool = False
    review_reason: str = ""


def is_vin_plate_label(label: str) -> bool:
    text = str(label or "").strip()
    if text == "VIN Plate":
        return True
    return bool(VIN_LABEL_RE.search(text))


def collect_vin_photo_targets(item: dict[str, Any]) -> list[dict[str, Any]]:
    photos = item.get("photos") or []
    n = len(photos)
    stock_id = str(item.get("stockId") or "")
    targets: list[dict[str, Any]] = []

    for index, photo in enumerate(photos):
        if isinstance(photo, str):
            url = photo.split("?")[0]
            label = ""
            thumb = ""
        else:
            url = str(photo.get("url") or "").split("?")[0]
            label = str(photo.get("label") or "")
            thumb = str(photo.get("thumbUrl") or "").split("?")[0]

        if not url:
            continue

        reason = ""
        if is_vin_plate_label(label):
            reason = "label"
        elif n >= 15 and index in (15, 16, 17):
            reason = "qxb_tail"
        elif n <= 10 and index == 3 and label != "Interior":
            reason = "slot4"

        if not reason:
            continue

        targets.append(
            {
                "stockId": stock_id,
                "index": index,
                "label": label,
                "url": url,
                "thumbUrl": thumb if thumb and thumb != url else "",
                "reason": reason,
                "knownVin": str(item.get("vin") or "").upper(),
            }
        )
    return targets


def collect_unique_photo_jobs(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_url: dict[str, dict[str, Any]] = {}
    for item in items:
        for target in collect_vin_photo_targets(item):
            for key in ("url", "thumbUrl"):
                url = str(target.get(key) or "").strip()
                if not url or url in by_url:
                    continue
                by_url[url] = {
                    "url": url,
                    "stockId": target.get("stockId"),
                    "label": target.get("label"),
                    "reason": target.get("reason"),
                    "knownVin": target.get("knownVin") or "",
                    "variant": "thumb" if key == "thumbUrl" else "full",
                }
    return sorted(by_url.values(), key=lambda row: row["url"])


def _normalize_vin(text: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(text or "").upper())


def _is_valid_vin(vin: str) -> bool:
    return len(vin) == 17 and bool(VIN_STRICT.fullmatch(vin))


def _tesseract_available() -> bool:
    return shutil.which("tesseract") is not None


def _pytesseract_available() -> bool:
    try:
        import pytesseract  # noqa: F401

        return _tesseract_available()
    except ImportError:
        return False


def _easyocr_available() -> bool:
    try:
        import easyocr  # noqa: F401

        return True
    except ImportError:
        return False


def _preprocess_variants(image: Image.Image) -> list[tuple[Image.Image, float]]:
    base = image.convert("RGB")
    width, height = base.size
    variants: list[tuple[Image.Image, float]] = []

    for scale in (1.5, 2.0):
        gray = base.convert("L")
        target_w = max(1, int(width * scale))
        target_h = max(1, int(height * scale))
        gray = gray.resize((target_w, target_h))
        contrast = ImageEnhance.Contrast(gray).enhance(2.8)
        sharp = ImageEnhance.Sharpness(contrast).enhance(1.4)
        variants.append((sharp, scale))
    return variants


def _map_box_to_original(
    left: int, top: int, right: int, bottom: int, scale: float, orig_w: int, orig_h: int
) -> tuple[int, int, int, int]:
    x1 = int(round(left / scale))
    y1 = int(round(top / scale))
    x2 = int(round(right / scale))
    y2 = int(round(bottom / scale))
    x1 = max(0, min(orig_w - 1, x1))
    y1 = max(0, min(orig_h - 1, y1))
    x2 = max(x1 + 1, min(orig_w, x2))
    y2 = max(y1 + 1, min(orig_h, y2))
    return x1, y1, x2, y2


def _suffix_box_from_vin_span(
    left: int, top: int, right: int, bottom: int, *, start_char: int, char_count: int = LAST_N
) -> tuple[int, int, int, int]:
    width = max(1, right - left)
    height = max(1, bottom - top)
    char_w = width / VIN_LEN
    x1 = int(round(left + char_w * start_char)) - PADDING_PX
    x2 = int(round(left + char_w * (start_char + char_count))) + PADDING_PX
    y1 = top - PADDING_PX
    y2 = bottom + PADDING_PX
    return x1, y1, x2, y2


def _score_vin_match(candidate: str, known: str) -> tuple[int, int]:
    candidate = _normalize_vin(candidate)
    known = _normalize_vin(known)
    if not candidate or not known:
        return 0, 0
    if candidate == known:
        return 17, 17
    best = 0
    for offset in range(-3, 4):
        matches = 0
        for idx in range(17):
            c_idx = idx + offset
            if 0 <= c_idx < len(candidate) and candidate[c_idx] == known[idx]:
                matches += 1
        best = max(best, matches)
    longest = 0
    for i in range(len(candidate)):
        for j in range(i + MIN_VIN_MATCH, len(candidate) + 1):
            chunk = candidate[i:j]
            if chunk and chunk in known:
                longest = max(longest, len(chunk))
    return best, longest


def _pick_vin_from_text(text: str, known_vin: str = "") -> tuple[str, int, float]:
    clean = _normalize_vin(text)
    known = _normalize_vin(known_vin)
    best = ""
    best_score = 0
    best_conf = 0.0

    if known and known in clean:
        return known, clean.index(known), 95.0

    candidates: list[str] = []
    for pattern in (VIN_STRICT, VIN_LOOSE):
        candidates.extend(match.group(0) for match in pattern.finditer(clean))
    for idx in range(max(0, len(clean) - 16)):
        chunk = clean[idx : idx + 17]
        if len(chunk) == 17:
            candidates.append(chunk)

    for candidate in candidates:
        score = 0
        conf = 60.0 if _is_valid_vin(candidate) else 45.0
        if known:
            exact, longest = _score_vin_match(candidate, known)
            score = exact
            conf = max(conf, min(95.0, 40.0 + exact * 3 + longest))
            if exact >= 15 or longest >= MIN_VIN_MATCH:
                if exact > best_score:
                    best, best_score, best_conf = candidate, exact, conf
                continue
        if _is_valid_vin(candidate) and len(candidate) > len(best):
            best, best_score, best_conf = candidate, 17, conf

    if best and known and best != known:
        exact, longest = _score_vin_match(best, known)
        if exact >= 15 or longest >= MIN_VIN_MATCH:
            return known if exact >= 15 else best, 0, best_conf
    if best:
        return best, 0, best_conf
    return "", 0, 0.0


def _ocr_tesseract_boxes(image: Image.Image, scale: float) -> list[TextBox]:
    if not _pytesseract_available():
        return []
    import pytesseract

    config = (
        "--psm 6 -c tessedit_char_whitelist=ABCDEFGHJKLMNPRSTUVWXYZ0123456789"
    )
    data = pytesseract.image_to_data(image, config=config, output_type=pytesseract.Output.DICT)
    boxes: list[TextBox] = []
    for idx, raw in enumerate(data["text"]):
        text = _normalize_vin(raw)
        if not text:
            continue
        try:
            conf = float(data["conf"][idx])
        except (TypeError, ValueError):
            conf = -1.0
        if conf < MIN_OCR_CONF:
            continue
        left = int(data["left"][idx])
        top = int(data["top"][idx])
        width = int(data["width"][idx])
        height = int(data["height"][idx])
        boxes.append(
            TextBox(
                text=text,
                left=left,
                top=top,
                right=left + width,
                bottom=top + height,
                confidence=conf,
                scale=scale,
                source="tesseract",
            )
        )
    boxes.sort(key=lambda row: (row.top, row.left))
    return boxes


def _ocr_tesseract_chars(image: Image.Image, scale: float) -> list[TextBox]:
    if not _pytesseract_available():
        return []
    import pytesseract

    height = image.height
    config = "-c tessedit_char_whitelist=ABCDEFGHJKLMNPRSTUVWXYZ0123456789"
    raw = pytesseract.image_to_boxes(image, config=config)
    chars: list[TextBox] = []
    for line in raw.splitlines():
        parts = line.split()
        if len(parts) != 6:
            continue
        ch, x1, y1, x2, y2 = parts[0], int(parts[1]), int(parts[2]), int(parts[3]), int(parts[4])
        if ch in {"~", "|", "_"}:
            continue
        top = height - y2
        bottom = height - y1
        chars.append(
            TextBox(
                text=ch.upper(),
                left=x1,
                top=top,
                right=x2,
                bottom=bottom,
                confidence=55.0,
                scale=scale,
                source="tesseract-char",
            )
        )
    chars.sort(key=lambda row: (row.top, row.left))
    return chars


def _get_easyocr_reader() -> Any:
    global _EASYOCR_READER
    if _EASYOCR_READER is None:
        import easyocr

        _EASYOCR_READER = easyocr.Reader(["en"], gpu=False, verbose=False)
    return _EASYOCR_READER


def _ocr_easyocr_boxes(image: Image.Image, scale: float) -> list[TextBox]:
    if not _easyocr_available():
        return []
    import numpy as np

    reader = _get_easyocr_reader()
    results = reader.readtext(np.array(image.convert("RGB")), detail=1, paragraph=False)
    boxes: list[TextBox] = []
    for polygon, text, conf in results:
        clean = _normalize_vin(text)
        if not clean:
            continue
        xs = [int(point[0]) for point in polygon]
        ys = [int(point[1]) for point in polygon]
        boxes.append(
            TextBox(
                text=clean,
                left=min(xs),
                top=min(ys),
                right=max(xs),
                bottom=max(ys),
                confidence=float(conf) * 100.0,
                scale=scale,
                source="easyocr",
            )
        )
    boxes.sort(key=lambda row: (row.top, row.left))
    return boxes


def _group_line_boxes(boxes: list[TextBox], *, y_tol: int = 18) -> list[list[TextBox]]:
    if not boxes:
        return []
    lines: list[list[TextBox]] = []
    current: list[TextBox] = [boxes[0]]
    current_y = boxes[0].top
    for box in boxes[1:]:
        if abs(box.top - current_y) <= y_tol:
            current.append(box)
        else:
            lines.append(sorted(current, key=lambda row: row.left))
            current = [box]
            current_y = box.top
    lines.append(sorted(current, key=lambda row: row.left))
    return lines


def _detect_from_line(
    line: list[TextBox], known_vin: str, orig_w: int, orig_h: int
) -> VinDetection | None:
    if not line:
        return None

    joined = "".join(box.text for box in line)
    vin, _, conf = _pick_vin_from_text(joined, known_vin)
    if not vin:
        return None

    start = joined.find(_normalize_vin(vin))
    if start < 0:
        known = _normalize_vin(known_vin)
        if known:
            _, longest = _score_vin_match(joined, known)
            if longest >= MIN_VIN_MATCH:
                vin = known
                start = 0
            else:
                return None
        else:
            return None

    end = start + VIN_LEN
    pos = 0
    suffix_boxes: list[TextBox] = []
    for box in line:
        next_pos = pos + len(box.text)
        overlap_start = max(start, pos)
        overlap_end = min(end, next_pos)
        if overlap_end > overlap_start:
            rel_start = overlap_start - pos
            rel_end = overlap_end - pos
            char_w = max(1.0, (box.right - box.left) / max(1, len(box.text)))
            left = int(round(box.left + char_w * rel_start))
            right = int(round(box.left + char_w * rel_end))
            suffix_boxes.append(
                TextBox(
                    text=box.text[rel_start:rel_end],
                    left=left,
                    top=box.top,
                    right=right,
                    bottom=box.bottom,
                    confidence=box.confidence,
                    scale=box.scale,
                    source=box.source,
                )
            )
        pos = next_pos

    if not suffix_boxes:
        return None

    left = min(box.left for box in suffix_boxes)
    right = max(box.right for box in suffix_boxes)
    top = min(box.top for box in suffix_boxes)
    bottom = max(box.bottom for box in suffix_boxes)
    scale = suffix_boxes[0].scale
    x1, y1, x2, y2 = _map_box_to_original(left, top, right, bottom, scale, orig_w, orig_h)
    x1 -= PADDING_PX
    y1 -= PADDING_PX
    x2 += PADDING_PX
    y2 += PADDING_PX
    x1 = max(0, x1)
    y1 = max(0, y1)
    x2 = min(orig_w, x2)
    y2 = min(orig_h, y2)
    avg_conf = sum(box.confidence for box in suffix_boxes) / len(suffix_boxes)
    return VinDetection(
        vin=vin,
        suffix_box=(x1, y1, x2, y2),
        confidence=min(conf, avg_conf),
        method=f"{suffix_boxes[0].source}+line",
    )


def _detect_from_single_box(
    box: TextBox, known_vin: str, orig_w: int, orig_h: int
) -> VinDetection | None:
    vin, _, conf = _pick_vin_from_text(box.text, known_vin)
    if not vin:
        return None
    known = _normalize_vin(known_vin)
    if known:
        exact, longest = _score_vin_match(vin, known)
        if exact < 12 and longest < MIN_VIN_MATCH:
            return None
        if exact >= 14:
            vin = known
    start_char = VIN_LEN - LAST_N
    x1, y1, x2, y2 = _suffix_box_from_vin_span(
        box.left, box.top, box.right, box.bottom, start_char=start_char
    )
    x1, y1, x2, y2 = _map_box_to_original(x1, y1, x2, y2, box.scale, orig_w, orig_h)
    return VinDetection(
        vin=vin,
        suffix_box=(x1, y1, x2, y2),
        confidence=min(conf, box.confidence),
        method=f"{box.source}+span",
    )


def _collect_tesseract_detections(
    image: Image.Image, known_vin: str, orig_w: int, orig_h: int
) -> list[VinDetection]:
    detections: list[VinDetection] = []
    for variant, scale in _preprocess_variants(image):
        word_boxes = _ocr_tesseract_boxes(variant, scale)
        for box in word_boxes:
            hit = _detect_from_single_box(box, known_vin, orig_w, orig_h)
            if hit:
                detections.append(hit)
        for line in _group_line_boxes(word_boxes):
            hit = _detect_from_line(line, known_vin, orig_w, orig_h)
            if hit:
                detections.append(hit)
        for line in _group_line_boxes(_ocr_tesseract_chars(variant, scale), y_tol=24):
            hit = _detect_from_line(line, known_vin, orig_w, orig_h)
            if hit:
                detections.append(hit)
    return detections


def _collect_easyocr_detections(
    image: Image.Image, known_vin: str, orig_w: int, orig_h: int
) -> list[VinDetection]:
    detections: list[VinDetection] = []
    for variant, scale in _preprocess_variants(image):
        boxes = _ocr_easyocr_boxes(variant, scale)
        for box in boxes:
            hit = _detect_from_single_box(box, known_vin, orig_w, orig_h)
            if hit:
                detections.append(hit)
        for line in _group_line_boxes(boxes, y_tol=28):
            hit = _detect_from_line(line, known_vin, orig_w, orig_h)
            if hit:
                detections.append(hit)
    return detections


def _rank_detection(item: VinDetection, known: str) -> tuple[float, float, float]:
    exact, longest = _score_vin_match(item.vin, known) if known else (17, 17)
    box_w = item.suffix_box[2] - item.suffix_box[0]
    box_h = item.suffix_box[3] - item.suffix_box[1]
    tightness = 1.0 / max(1.0, box_w * box_h)
    return (item.confidence, exact + longest, tightness)


def detect_vin_suffix_box(image: Image.Image, *, known_vin: str = "") -> VinDetection | None:
    orig_w, orig_h = image.size
    known = _normalize_vin(known_vin)

    detections = _collect_tesseract_detections(image, known_vin, orig_w, orig_h)
    if not detections and (_easyocr_available() or known):
        detections = _collect_easyocr_detections(image, known_vin, orig_w, orig_h)

    if not detections:
        return None

    best = max(detections, key=lambda item: _rank_detection(item, known))
    if known:
        exact, longest = _score_vin_match(best.vin, known)
        if exact < 12 and longest < MIN_VIN_MATCH:
            return None
        if exact >= 14:
            best.vin = known
    if best.confidence < MIN_OCR_CONF and not known:
        return None
    return best


def _apply_suffix_mask(image: Image.Image, box: tuple[int, int, int, int], *, mode: str = "bar") -> Image.Image:
    out = image.convert("RGB")
    x1, y1, x2, y2 = box
    x1 = max(0, x1)
    y1 = max(0, y1)
    x2 = min(out.width, x2)
    y2 = min(out.height, y2)
    if x2 <= x1 or y2 <= y1:
        return out
    draw = ImageDraw.Draw(out)
    if mode == "semi":
        overlay = Image.new("RGBA", out.size, (0, 0, 0, 0))
        o_draw = ImageDraw.Draw(overlay)
        o_draw.rectangle((x1, y1, x2, y2), fill=(0, 0, 0, 180))
        out = Image.alpha_composite(out.convert("RGBA"), overlay).convert("RGB")
    else:
        draw.rectangle((x1, y1, x2, y2), fill=(0, 0, 0))
    return out


def blur_vin_suffix(
    image: Image.Image,
    *,
    known_vin: str = "",
    last_n: int = LAST_N,
    mode: str = "bar",
) -> tuple[Image.Image, dict[str, Any]]:
    del last_n  # last_n fixed to 7 by detection logic
    base = image.convert("RGB")
    meta: dict[str, Any] = {
        "method": "ocr-precise",
        "knownVinUsed": bool(_normalize_vin(known_vin)),
        "ocrVin": "",
        "confidence": 0,
        "needsReview": False,
        "reviewReason": "",
        "box": [],
        "suffixBox": [],
    }

    detection = detect_vin_suffix_box(base, known_vin=known_vin)
    if detection is None:
        meta["needsReview"] = True
        meta["reviewReason"] = "ocr_low_confidence"
        meta["method"] = "manual_review"
        return base, meta

    if detection.confidence < MIN_OCR_CONF and not _normalize_vin(known_vin):
        meta["needsReview"] = True
        meta["reviewReason"] = "ocr_low_confidence"
        meta["method"] = "manual_review"
        meta["ocrVin"] = detection.vin
        meta["confidence"] = round(detection.confidence, 1)
        meta["box"] = list(detection.suffix_box)
        return base, meta

    meta["ocrVin"] = detection.vin
    meta["confidence"] = round(detection.confidence, 1)
    meta["method"] = detection.method
    meta["box"] = list(detection.suffix_box)
    meta["suffixBox"] = list(detection.suffix_box)
    out = _apply_suffix_mask(base, detection.suffix_box, mode=mode)
    return out, meta


def blur_file(
    src: Path,
    dst: Path,
    *,
    known_vin: str = "",
    mode: str = "bar",
) -> dict[str, Any]:
    with Image.open(src) as image:
        blurred, meta = blur_vin_suffix(image, known_vin=known_vin, mode=mode)
        dst.parent.mkdir(parents=True, exist_ok=True)
        suffix = src.suffix.lower()
        if suffix in {".jpg", ".jpeg"}:
            blurred.save(dst, quality=90, optimize=True)
        elif suffix == ".webp":
            blurred.save(dst, quality=88, method=6)
        else:
            blurred.save(dst)
    meta["src"] = str(src)
    meta["dst"] = str(dst)
    return meta
