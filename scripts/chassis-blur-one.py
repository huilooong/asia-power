#!/usr/bin/env python3
"""Blur one chassis plate image (CLI for batch + Node upload hook)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from inventory_core.chassis_blur import blur_file  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Precisely blur last 7 VIN chars in one photo")
    parser.add_argument("src", type=Path)
    parser.add_argument("dst", type=Path)
    parser.add_argument("--known-vin", default="")
    parser.add_argument("--mode", default="bar", choices=("bar", "semi"))
    parser.add_argument("--json", action="store_true", help="Print metadata JSON to stdout")
    args = parser.parse_args()

    meta = blur_file(args.src, args.dst, known_vin=args.known_vin, mode=args.mode)
    if args.json:
        print(json.dumps(meta, ensure_ascii=False))
    return 0 if not meta.get("needsReview") else 2


if __name__ == "__main__":
    raise SystemExit(main())
