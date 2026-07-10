#!/usr/bin/env python3
"""OCR VIN/chassis numbers from locally downloaded QXB photos.

Input:  data/qxb-photos/manifest.csv from scripts/download-qxb-photos.py
Output: reports/qxb-vin-ocr-results.csv

Default scans only the last 2 successfully downloaded photos per vehicle row,
because QXB VIN screenshots/nameplates usually sit at the end of each row's
photo list.
"""

from __future__ import annotations

import argparse
import shutil
import csv
import pathlib
import re
import subprocess
import tempfile
from collections import defaultdict

from PIL import Image, ImageEnhance, ImageOps


ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "data" / "qxb-photos" / "manifest.csv"
DEFAULT_OUT = ROOT / "reports" / "qxb-vin-ocr-results.csv"
VIN_STRICT = re.compile(r"\b[A-HJ-NPR-Z][A-HJ-NPR-Z0-9]{16}\b")
VIN_LOOSE = re.compile(r"\b[A-Z][A-Z0-9]{16}\b")


def read_manifest(path: pathlib.Path, only_last: int) -> list[dict]:
    rows = [r for r in csv.DictReader(path.open(encoding="utf-8")) if r["status"] in {"downloaded", "exists"}]
    by_row: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_row[row["row"]].append(row)
    selected: list[dict] = []
    for items in by_row.values():
        items.sort(key=lambda r: int(r["image_index"]))
        selected.extend(items[-only_last:] if only_last else items)
    return selected


def image_variants(path: pathlib.Path, thorough: bool):
    image = Image.open(path).convert("L")
    if max(image.size) < 1800:
        scale = 1800 / max(image.size)
        image = image.resize((int(image.width * scale), int(image.height * scale)))
    rotations = [0, 90, 270] if thorough else [0]
    for rotation in rotations:
        rotated = image.rotate(rotation, expand=True)
        yield rotation, "gray", rotated
        yield rotation, "contrast", ImageEnhance.Contrast(rotated).enhance(2.2)
        if thorough:
            yield rotation, "invert", ImageOps.invert(rotated)


def tesseract_text(image: Image.Image, timeout: int) -> str:
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as fh:
        tmp = pathlib.Path(fh.name)
    try:
        image.save(tmp)
        best = ""
        for psm in ("6", "11"):
            proc = subprocess.run(
                [
                    "tesseract",
                    str(tmp),
                    "stdout",
                    "-l",
                    "eng",
                    "--psm",
                    psm,
                    "-c",
                    "tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=timeout,
            )
            if len(proc.stdout) > len(best):
                best = proc.stdout
        return best.upper().replace(" ", "").replace("\n", " ")
    finally:
        tmp.unlink(missing_ok=True)


def candidates_for(path: pathlib.Path, thorough: bool, timeout: int) -> list[dict]:
    hits: list[dict] = []
    for rotation, variant, image in image_variants(path, thorough):
        text = tesseract_text(image, timeout)
        for vin in sorted(set(VIN_STRICT.findall(text))):
            hits.append({"vin": vin, "confidence": f"high:{variant}:rot{rotation}", "strict": True})
        for vin in sorted(set(VIN_LOOSE.findall(text))):
            if not any(h["vin"] == vin for h in hits):
                hits.append({"vin": vin, "confidence": f"review:{variant}:rot{rotation}", "strict": False})
        compact = re.sub(r"[^A-Z0-9]", "", text.upper())
        for i in range(max(0, len(compact) - 16)):
            chunk = compact[i : i + 17]
            if len(chunk) != 17:
                continue
            if VIN_STRICT.match(chunk) and not any(h["vin"] == chunk for h in hits):
                hits.append({"vin": chunk, "confidence": f"compact:{variant}:rot{rotation}", "strict": True})
            elif VIN_LOOSE.match(chunk) and not any(h["vin"] == chunk for h in hits):
                hits.append({"vin": chunk, "confidence": f"compact_review:{variant}:rot{rotation}", "strict": False})
    return hits


ENGINE_CODE_PATTERNS = (
    re.compile(r"\b(G4[A-Z]{2})\b"),
    re.compile(r"\b([12][A-Z]{2}-FE)\b"),
    re.compile(r"\b(R20A3|K24A8|L15B7|L13Z|QR25DE|MR20DE|2GR-FE|1GR-FE)\b", re.I),
    re.compile(r"\b([A-Z]{1,3}[0-9]{1,2}[A-Z]{1,3})\b"),
)


def nameplate_powertrain_for(path: pathlib.Path, *, timeout: int = 12) -> dict[str, str]:
    """Best-effort OCR for 发动机型号 / transmission on a VIN nameplate photo."""
    if not path.is_file():
        return {}
    hits: dict[str, str] = {}
    for rotation, variant, image in image_variants(path, thorough=True):
        text = tesseract_text(image, timeout)
        upper = text.upper()
        compact = re.sub(r"[^A-Z0-9-]", "", upper)
        label_match = re.search(r"发动机型号[：:\s]*([A-Z0-9][A-Z0-9\-]{2,11})", text, re.I)
        if label_match:
            hits["engineCode"] = label_match.group(1).strip().upper()
            break
        for pattern in ENGINE_CODE_PATTERNS:
            match = pattern.search(compact) or pattern.search(upper.replace(" ", ""))
            if match:
                code = match.group(1).upper()
                if code in {"BHMC", "BH7203MY"}:
                    continue
                hits["engineCode"] = code
                break
        if hits.get("engineCode"):
            break
    return hits


def pick_best(hits: list[dict]) -> tuple[str, str]:
    if not hits:
        return "", "none"
    strict = [h for h in hits if h.get("strict")]
    pool = strict or [h for h in hits if not str(h.get("confidence") or "").startswith("compact_review")]
    if not pool:
        pool = hits
    counts: dict[str, int] = defaultdict(int)
    first_conf: dict[str, str] = {}
    for hit in pool:
        counts[hit["vin"]] += 1
        first_conf.setdefault(hit["vin"], hit["confidence"])
    vin = sorted(counts, key=lambda v: (-counts[v], first_conf[v], v))[0]
    conf = first_conf[vin]
    if counts[vin] > 1 and conf.startswith("high:"):
        conf = "very_high:" + conf.split(":", 1)[1]
    return vin, conf


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=pathlib.Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--out", type=pathlib.Path, default=DEFAULT_OUT)
    parser.add_argument("--only-last", type=int, default=2)
    parser.add_argument("--only-missing", action="store_true", help="skip rows that already have VIN in --out csv")
    parser.add_argument("--limit-rows", type=int)
    parser.add_argument("--thorough", action="store_true", help="also try 90/270 rotations and inverted images")
    parser.add_argument("--copy-hits", type=pathlib.Path, help="copy images with recognized VINs into this folder")
    parser.add_argument("--timeout", type=int, default=10)
    args = parser.parse_args()

    photos = read_manifest(args.manifest, args.only_last)
    existing_vins: set[str] = set()
    if args.only_missing and args.out.is_file():
        for rec in csv.DictReader(args.out.open(encoding="utf-8")):
            if str(rec.get("vin") or "").strip():
                existing_vins.add(str(rec["row"]))

    if args.only_missing:
        photos = [p for p in photos if p["row"] not in existing_vins]
    if args.limit_rows:
        allowed = set()
        for row in sorted({int(p["row"]) for p in photos})[: args.limit_rows]:
            allowed.add(str(row))
        photos = [p for p in photos if p["row"] in allowed]

    by_row: dict[str, list[dict]] = defaultdict(list)
    for photo in photos:
        by_row[photo["row"]].append(photo)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["row", "model", "vin", "image_path", "confidence"])
        writer.writeheader()
        done = 0
        for row, items in sorted(by_row.items(), key=lambda kv: int(kv[0])):
            row_hits = []
            for item in items:
                path = pathlib.Path(item["local_path"])
                if not path.exists():
                    continue
                for hit in candidates_for(path, args.thorough, args.timeout):
                    row_hits.append({**hit, "path": str(path)})
            vin, confidence = pick_best(row_hits)
            image_path = ""
            if vin:
                image_path = next((h["path"] for h in row_hits if h["vin"] == vin), "")
                if args.copy_hits and image_path:
                    args.copy_hits.mkdir(parents=True, exist_ok=True)
                    src = pathlib.Path(image_path)
                    dst = args.copy_hits / f"row-{int(row):04d}_{vin}{src.suffix.lower() or '.jpg'}"
                    if src.exists():
                        shutil.copy2(src, dst)
            writer.writerow(
                {
                    "row": row,
                    "model": items[0]["model"],
                    "vin": vin,
                    "image_path": image_path,
                    "confidence": confidence,
                }
            )
            done += 1
            if done % 50 == 0:
                print(f"progress={done}/{len(by_row)}", flush=True)
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
