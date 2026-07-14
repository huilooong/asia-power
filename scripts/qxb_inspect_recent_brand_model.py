#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import re
from pathlib import Path

APPROVED = Path("/root/.openclaw/workspace/inventory-site/data/half-cut-approved.json")
SUBS = Path("/root/.openclaw/workspace/inventory-site/data/half-cut-submissions.json")

BRAND_CN = {
    "丰田": "Toyota",
    "本田": "Honda",
    "日产": "Nissan",
    "马自达": "Mazda",
    "三菱": "Mitsubishi",
    "斯巴鲁": "Subaru",
    "铃木": "Suzuki",
    "雷克萨斯": "Lexus",
    "英菲尼迪": "Infiniti",
    "讴歌": "Acura",
    "现代": "Hyundai",
    "起亚": "Kia",
    "双龙": "SsangYong",
    "大众": "Volkswagen",
    "奥迪": "Audi",
    "宝马": "BMW",
    "奔驰": "Mercedes-Benz",
    "保时捷": "Porsche",
    "雪佛兰": "Chevrolet",
    "别克": "Buick",
    "福特": "Ford",
    "吉普": "Jeep",
    "道奇": "Dodge",
    "克莱斯勒": "Chrysler",
    "凯迪拉克": "Cadillac",
    "沃尔沃": "Volvo",
    "标致": "Peugeot",
    "雪铁龙": "Citroen",
    "雷诺": "Renault",
    "斯柯达": "Skoda",
    "捷豹": "Jaguar",
    "路虎": "Land Rover",
    "迷你": "MINI",
    "菲亚特": "Fiat",
    "荣威": "Roewe",
    "名爵": "MG",
    "吉利": "Geely",
    "比亚迪": "BYD",
    "长城": "Great Wall",
    "哈弗": "Haval",
    "传祺": "Trumpchi",
    "奇瑞": "Chery",
    "长安": "Changan",
    "五菱": "Wuling",
    "宝骏": "Baojun",
    "红旗": "Hongqi",
    "启辰": "Venucia",
}


def load_items(path: Path):
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return raw, "list"
    if isinstance(raw, dict):
        for k in ("items", "approved", "data", "submissions", "records"):
            if isinstance(raw.get(k), list):
                return raw[k], k
        vals = [v for v in raw.values() if isinstance(v, dict) and (v.get("stockId") or v.get("id"))]
        return vals, "values"
    return [], "empty"


def ts(it: dict) -> str:
    for k in ("updatedAt", "approvedAt", "createdAt", "submittedAt", "uploadedAt"):
        if it.get(k):
            return str(it[k])
    return ""


def chassis_of(it: dict) -> str:
    for k in ("vin", "VIN", "chassisNumber", "chassis", "chassisNo", "vinNumber", "frameNumber"):
        v = str(it.get(k) or "").strip().upper()
        if re.fullmatch(r"[A-HJ-NPR-Z0-9]{11,17}", v):
            return v
    qxb = it.get("qxb") if isinstance(it.get("qxb"), dict) else {}
    for k in ("vin", "chassisNumber", "chassis"):
        v = str(qxb.get(k) or "").strip().upper()
        if re.fullmatch(r"[A-HJ-NPR-Z0-9]{11,17}", v):
            return v
    return ""


def expected_brand(ovn: str) -> str:
    for cn, en in sorted(BRAND_CN.items(), key=lambda x: -len(x[0])):
        if cn in ovn:
            return en
    return ""


def parse_model(ovn: str, brand_cn_hit: str = "") -> tuple[str, str]:
    text = (ovn or "").strip()
    year = ""
    m = re.search(r"(20\d{2}|19\d{2})\s*款", text)
    if m:
        year = m.group(1)
    rest = text
    for cn in sorted(BRAND_CN.keys(), key=len, reverse=True):
        if cn in rest:
            rest = rest.split(cn, 1)[-1]
            break
    model = re.sub(r"(20\d{2}|19\d{2})\s*款.*$", "", rest)
    model = re.sub(r"[0-9.]+\s*[Ll升].*$", "", model)
    model = re.sub(r"(自动|手动|CVT|DCT|AMT|双离合|四驱|两驱).*$", "", model)
    model = model.strip(" -_/·")
    return model, year


def empty(v) -> bool:
    s = str(v or "").strip()
    return (not s) or s.lower() in {"unknown", "n/a", "-", "null", "none"}


def main() -> None:
    approved, ak = load_items(APPROVED)
    subs, sk = load_items(SUBS)
    print("approved", len(approved), ak, "subs", len(subs), sk)

    for label, arr in (("approved", approved), ("subs", subs)):
        dated = sorted([i for i in arr if isinstance(i, dict)], key=lambda x: ts(x), reverse=True)[:12]
        print(f"\n== newest {label} ==")
        for it in dated:
            print(
                it.get("stockId") or it.get("id"),
                ts(it)[:19],
                "brand=",
                it.get("brand") or it.get("make"),
                "model=",
                it.get("model"),
                "vin=",
                chassis_of(it)[:17],
                "ovn=",
                str(it.get("originalVehicleName") or "")[:50],
                "supplier=",
                str(it.get("supplierName") or "")[:18],
            )

    # Recent uploads: top 80 by stockId among items with OVN Chinese
    def sk_id(it):
        m = re.search(r"(\d+)$", str(it.get("stockId") or it.get("id") or ""))
        return int(m.group(1)) if m else 0

    pool = [i for i in approved if isinstance(i, dict) and str(i.get("originalVehicleName") or "")]
    # Also include QXB-ish without requiring 款
    recent = sorted(pool, key=sk_id, reverse=True)[:80]
    fixes = []
    skipped = []
    for it in recent:
        ovn = str(it.get("originalVehicleName") or "").strip()
        if not re.search(r"[\u4e00-\u9fff]", ovn):
            continue
        chassis = chassis_of(it)
        brand = it.get("brand") or it.get("make")
        model = it.get("model")
        exp_b = expected_brand(ovn)
        exp_m, exp_y = parse_model(ovn)
        need_b = empty(brand) or (exp_b and str(brand).lower() != exp_b.lower())
        need_m = empty(model) or (
            exp_m
            and str(model).strip()
            and exp_m
            and str(model).strip() not in ovn
            and not re.search(re.escape(str(model).strip()), ovn, re.I)
            and len(str(model)) < 2
        )
        # Stricter: fix only missing brand/model (CEO: 如果没有请增加)
        need_b = empty(brand)
        need_m = empty(model)
        if not need_b and not need_m:
            continue
        if not chassis:
            skipped.append(
                {
                    "stockId": it.get("stockId") or it.get("id"),
                    "reason": "no_chassis",
                    "ovn": ovn[:70],
                    "brand": brand,
                    "model": model,
                }
            )
            continue
        if not exp_b and not exp_m:
            skipped.append(
                {
                    "stockId": it.get("stockId") or it.get("id"),
                    "reason": "cannot_parse_ovn",
                    "ovn": ovn[:70],
                    "chassis": chassis,
                }
            )
            continue
        fixes.append(
            {
                "stockId": it.get("stockId") or it.get("id"),
                "chassis": chassis,
                "ovn": ovn,
                "brand_before": brand,
                "model_before": model,
                "year_before": it.get("year"),
                "brand_after": (brand if not need_b else exp_b),
                "model_after": (model if not need_m else exp_m),
                "year_after": it.get("year") or exp_y,
                "need_brand": need_b,
                "need_model": need_m,
            }
        )

    print("\nfixes", len(fixes), "skipped", len(skipped))
    for r in skipped[:40]:
        print("SKIP", json.dumps(r, ensure_ascii=False))
    for r in fixes[:50]:
        print("FIX", json.dumps(r, ensure_ascii=False))

    Path("/tmp/qxb-brand-model-fix-plan.json").write_text(
        json.dumps({"fixes": fixes, "skipped": skipped}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
