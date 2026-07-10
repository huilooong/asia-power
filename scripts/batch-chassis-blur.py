#!/usr/bin/env python3
"""Batch blur/redact the last 7 VIN/chassis characters in website plate photos."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from inventory_core.chassis_blur import blur_file, collect_unique_photo_jobs  # noqa: E402

DEFAULT_INVENTORY = ROOT / "data" / "half-cut-approved.json"
DEFAULT_PREVIEW_DIR = ROOT / "work" / "chassis-blur-preview" / "v2"
R2_HELPER = ROOT / "scripts" / "chassis-blur-r2.mjs"

SAMPLE_STOCK_IDS = [
    "HC250511",
    "HC250512",
    "HC250513",
    "HC250510",
    "HC250507",
    "HC250506",
    "HC250505",
    "HC250502",
    "HC250036",
    "HC250040",
]


def load_inventory(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    return data.get("approved") or data.get("items") or []


def url_to_key(url: str) -> str:
    clean = url.split("?")[0]
    if clean.startswith("http"):
        idx = clean.find("/uploads/")
        if idx >= 0:
            return clean[idx + 1 :]
        raise ValueError(f"Unsupported URL: {url}")
    return clean.lstrip("/")


def mime_for_path(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".webp": "image/webp",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
    }.get(ext, "application/octet-stream")


def run_node_r2(site_root: Path, *args: str) -> dict:
    env = os.environ.copy()
    cmd = ["node", str(R2_HELPER), *args]
    proc = subprocess.run(cmd, cwd=str(site_root), env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "R2 helper failed")
    return json.loads(proc.stdout.strip())


def download_http(url: str, dest: Path, base_url: str = "https://asia-power.com") -> None:
    full = url if url.startswith("http") else f"{base_url.rstrip('/')}{url}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(full, timeout=60) as resp:  # noqa: S310
        dest.write_bytes(resp.read())


def backup_key_for(url: str) -> str:
    key = url_to_key(url)
    name = Path(key).name
    return f"backups/chassis-originals/{name}"


def select_sample_jobs(jobs: list[dict], stock_ids: list[str]) -> list[dict]:
    by_stock: dict[str, list[dict]] = {}
    for job in jobs:
        stock = str(job.get("stockId") or "")
        by_stock.setdefault(stock, []).append(job)

    picked: list[dict] = []
    seen_urls: set[str] = set()
    for stock in stock_ids:
        for job in by_stock.get(stock, []):
            if job["url"] in seen_urls:
                continue
            if job.get("variant") == "thumb":
                continue
            seen_urls.add(job["url"])
            picked.append(job)
            break
    return picked


def process_job(
    job: dict,
    *,
    site_root: Path,
    preview_dir: Path | None,
    apply: bool,
    use_r2: bool,
    from_backup: bool,
    base_url: str,
) -> dict:
    url = job["url"]
    key = url_to_key(url)
    known_vin = str(job.get("knownVin") or "")
    result = {
        "url": url,
        "stockId": job.get("stockId"),
        "reason": job.get("reason"),
        "knownVin": known_vin,
        "status": "pending",
    }

    with tempfile.TemporaryDirectory(prefix="chassis-blur-") as tmpdir:
        src = Path(tmpdir) / Path(key).name
        out = Path(tmpdir) / f"blurred_{Path(key).name}"

        download_key = backup_key_for(url) if from_backup else key
        try:
            if use_r2 or from_backup:
                run_node_r2(site_root, "get", download_key, str(src))
            else:
                download_http(url, src, base_url=base_url)
        except Exception as err:  # noqa: BLE001
            result["status"] = "download_failed"
            result["error"] = str(err)
            return result

        meta = blur_file(src, out, known_vin=known_vin)
        result["blur"] = meta

        if meta.get("needsReview"):
            result["status"] = "manual_review"
            if preview_dir is not None:
                stock = str(job.get("stockId") or "sample")
                variant = job.get("variant") or "full"
                compare_src = preview_dir / f"{stock}_{variant}_before{src.suffix or '.webp'}"
                compare_src.write_bytes(src.read_bytes())
                result["previewBefore"] = str(compare_src)
            return result

        if preview_dir is not None:
            stock = str(job.get("stockId") or "sample")
            variant = job.get("variant") or "full"
            compare_src = preview_dir / f"{stock}_{variant}_before{src.suffix or '.webp'}"
            compare_dst = preview_dir / f"{stock}_{variant}_after{out.suffix or '.webp'}"
            compare_src.write_bytes(src.read_bytes())
            compare_dst.write_bytes(out.read_bytes())
            result["previewBefore"] = str(compare_src)
            result["previewAfter"] = str(compare_dst)

        if not apply:
            result["status"] = "preview"
            return result

        try:
            if use_r2:
                backup = backup_key_for(url)
                run_node_r2(site_root, "put", str(out), key, mime_for_path(out))
            else:
                result["status"] = "skipped_apply_no_r2"
                return result
            result["status"] = "applied"
            result["backupKey"] = backup_key_for(url)
        except Exception as err:  # noqa: BLE001
            result["status"] = "upload_failed"
            result["error"] = str(err)

    return result


def write_chinese_report(report_path: Path, results: list[dict], preview_dir: Path | None) -> None:
    lines = [
        "# 底盘号遮罩 v2 样例报告",
        "",
        f"生成时间：{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "## 对比说明",
        "",
        "| 问题 | 旧版 | 新版 v2 |",
        "| --- | --- | --- |",
        "| 遮罩太大 | 整块铭牌/大黑条 | 仅最后 7 位字符 |",
        "| 遮错位置 | 固定比例区域猜测 | OCR 精确定位 VIN 后 7 位 |",
        "",
        f"样例目录：`{preview_dir}`",
        "",
        "## 样例明细",
        "",
    ]

    for row in results:
        stock = row.get("stockId") or "?"
        blur = row.get("blur") or {}
        lines.extend(
            [
                f"### {stock}",
                "",
                f"- 状态：{row.get('status')}",
                f"- 库存 VIN：{row.get('knownVin') or '未知'}",
                f"- OCR 识别 VIN：{blur.get('ocrVin') or '未识别'}",
                f"- 置信度：{blur.get('confidence', 0)}",
                f"- 后 7 位遮罩框 (x1,y1,x2,y2)：{blur.get('suffixBox') or blur.get('box') or '无'}",
                f"- 方法：{blur.get('method') or '-'}",
            ]
        )
        if row.get("previewBefore"):
            lines.append(f"- 处理前：{row['previewBefore']}")
        if row.get("previewAfter"):
            lines.append(f"- 处理后：{row['previewAfter']}")
        if blur.get("needsReview"):
            lines.append(f"- ⚠️ 需人工复核：{blur.get('reviewReason') or 'ocr_low_confidence'}")
        lines.append("")

    ok = sum(1 for row in results if row.get("status") == "preview")
    review = sum(1 for row in results if row.get("status") == "manual_review")
    lines.extend(
        [
            "## 汇总",
            "",
            f"- 成功样例：{ok}/{len(results)}",
            f"- 需人工复核：{review}/{len(results)}",
            "- 全站 764 张重跑：**等待 CEO 确认样例后再执行**",
            "- CDN 版本：确认后更新为 `?v=20260704blur2`",
            "",
        ]
    )
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch blur VIN suffix in chassis plate photos")
    parser.add_argument("--inventory", type=Path, default=DEFAULT_INVENTORY)
    parser.add_argument("--site-root", type=Path, default=Path("/root/.openclaw/workspace/inventory-site"))
    parser.add_argument("--preview-dir", type=Path, default=DEFAULT_PREVIEW_DIR)
    parser.add_argument("--base-url", default="https://asia-power.com")
    parser.add_argument("--limit", type=int, default=0, help="Process only N jobs (0 = all)")
    parser.add_argument("--preview", action="store_true", help="Save before/after previews only")
    parser.add_argument("--apply", action="store_true", help="Upload blurred photos to R2")
    parser.add_argument("--from-backup", action="store_true", help="Load originals from R2 backups/chassis-originals/")
    parser.add_argument("--samples", action="store_true", help="Run fixed 10-stock CEO sample set")
    parser.add_argument("--no-r2", action="store_true", help="Download via HTTPS only (no R2 get/put)")
    parser.add_argument("--report", type=Path, default=ROOT / "reports" / "chassis-blur-v2-preview.json")
    parser.add_argument("--report-md", type=Path, default=ROOT / "reports" / "chassis-blur-v2-preview.md")
    args = parser.parse_args()

    if not args.preview and not args.apply:
        parser.error("Specify --preview and/or --apply")

    inventory_path = args.inventory
    if not inventory_path.is_file():
        prod = args.site_root / "data" / "half-cut-approved.json"
        local_prod = ROOT / "work" / "half-cut-approved-prod.json"
        if prod.is_file():
            inventory_path = prod
        elif local_prod.is_file():
            inventory_path = local_prod
        else:
            print(f"Inventory not found: {args.inventory}", file=sys.stderr)
            return 1

    items = load_inventory(inventory_path)
    jobs = collect_unique_photo_jobs(items)
    if args.samples:
        jobs = select_sample_jobs(jobs, SAMPLE_STOCK_IDS)
    if args.limit:
        jobs = jobs[: args.limit]

    use_r2 = (args.apply or args.from_backup) and not args.no_r2
    preview_dir = args.preview_dir if args.preview else None
    if preview_dir:
        preview_dir.mkdir(parents=True, exist_ok=True)

    print(
        f"inventory={inventory_path} jobs={len(jobs)} preview={args.preview} "
        f"apply={args.apply} r2={use_r2} from_backup={args.from_backup}"
    )

    results = []
    counts: dict[str, int] = {}
    for idx, job in enumerate(jobs, start=1):
        row = process_job(
            job,
            site_root=args.site_root,
            preview_dir=preview_dir,
            apply=args.apply,
            use_r2=use_r2,
            from_backup=args.from_backup,
            base_url=args.base_url,
        )
        results.append(row)
        counts[row["status"]] = counts.get(row["status"], 0) + 1
        print(
            f"[{idx}/{len(jobs)}] {row.get('stockId')} {row['status']} "
            f"vin={((row.get('blur') or {}).get('ocrVin') or '-')}",
            flush=True,
        )

    summary = {
        "inventory": str(inventory_path),
        "jobCount": len(jobs),
        "statusCounts": counts,
        "previewDir": str(preview_dir) if preview_dir else "",
        "applied": args.apply,
        "fromBackup": args.from_backup,
        "results": results,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.preview:
        write_chinese_report(args.report_md, results, preview_dir)

    print(f"report={args.report}")
    if args.preview:
        print(f"report_md={args.report_md}")
    print(json.dumps({"jobCount": len(jobs), "statusCounts": counts}, ensure_ascii=False))
    return 0 if counts.get("upload_failed", 0) == 0 and counts.get("download_failed", 0) == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
