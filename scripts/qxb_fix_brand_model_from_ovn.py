#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Inspect recent QXB half-cuts missing brand/model; prepare fixes from originalVehicleName."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

APPROVED = Path("/root/.openclaw/workspace/inventory-site/data/half-cut-approved.json")
# Brand map from Chinese OVN prefixes (minimal, known QXB patterns)
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
    "阿尔法罗密欧": "Alfa Romeo",
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
    "奔腾": "Bestune",
    "启辰": "Venucia",
    "东南": "Soueast",
    "陆风": "Landwind",
}


def load_items(path: Path):
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return raw, raw
    if isinstance(raw, dict):
        for k in ("items", "approved", "data", "records"):
            if isinstance(raw.get(k), list):
                return raw, raw[k]
        # id -> item map
        vals = [v for v in raw.values() if isinstance(v, dict) and (v.get("stockId") or v.get("id"))]
        if vals:
            return raw, vals
    return raw, []


def is_qxb(it: dict) -> bool:
    sn = str(it.get("supplierName") or "")
    ovn = str(it.get("originalVehicleName") or "")
    notes = str(it.get("notes") or "")
    if "汽修宝" in sn or "qxb" in sn.lower():
        return True
    if it.get("qxb") or it.get("qxbBrandCn"):
        return True
    if re.search(r"[\u4e00-\u9fff].*款", ovn):
        return True
    if "汽修宝" in notes or "originalVehicleName" in notes:
        return True
    return False


def chassis_of(it: dict) -> str:
    for k in (
        "vin",
        "VIN",
        "chassisNumber",
        "chassis",
        "chassisNo",
        "vinNumber",
        "frameNumber",
        "底盘号",
    ):
        v = str(it.get(k) or "").strip().upper()
        if re.fullmatch(r"[A-HJ-NPR-Z0-9]{11,17}", v):
            return v
    # sometimes nested
    qxb = it.get("qxb") if isinstance(it.get("qxb"), dict) else {}
    for k in ("vin", "chassisNumber", "chassis"):
        v = str(qxb.get(k) or "").strip().upper()
        if re.fullmatch(r"[A-HJ-NPR-Z0-9]{11,17}", v):
            return v
    return ""


def parse_brand_model_from_ovn(ovn: str) -> tuple[str, str, str]:
    """Return (brand_en, model_hint, year) from QXB originalVehicleName."""
    text = (ovn or "").strip()
    if not text:
        return "", "", ""
    year = ""
    m = re.search(r"(20\d{2}|19\d{2})\s*款", text)
    if m:
        year = m.group(1)
    brand = ""
    rest = text
    # longest brand first
    for cn in sorted(BRAND_CN.keys(), key=len, reverse=True):
        if cn in text:
            brand = BRAND_CN[cn]
            rest = text.split(cn, 1)[-1]
            break
    # model: after brand, before year款 / engine / 排量
    model = rest
    model = re.sub(r"^\s*", "", model)
    model = re.sub(r"(20\d{2}|19\d{2})\s*款.*$", "", model)
    model = re.sub(r"[0-9.]+\s*[Ll升].*$", "", model)
    model = re.sub(r"(自动|手动|CVT|DCT|AMT|双离合).*$", "", model)
    model = model.strip(" -_/·")
    # keep Chinese model names as-is if no latin; admin often wants EN brand + CN/EN model from OVN
    return brand, model, year


def empty(v) -> bool:
    s = str(v or "").strip()
    return (not s) or s.lower() in {"unknown", "n/a", "-", "null", "none"}


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else APPROVED)
    raw, items = load_items(path)
    print("items", len(items))

    def sk(it):
        sid = str(it.get("stockId") or it.get("id") or "")
        m = re.search(r"(\d+)$", sid)
        return int(m.group(1)) if m else 0

    # Recent by stockId among QXB
    qxb_items = [i for i in items if isinstance(i, dict) and is_qxb(i)]
    print("qxb_items", len(qxb_items))
    recent = sorted(qxb_items, key=sk, reverse=True)[:50]

    fixes = []
    skipped_no_chassis = []
    ok_already = []
    for it in recent:
        sid = it.get("stockId") or it.get("id")
        chassis = chassis_of(it)
        ovn = str(it.get("originalVehicleName") or "").strip()
        if not ovn:
            # try notes
            ovn = ""
            notes = str(it.get("notes") or "")
            m = re.search(r"(?:originalVehicleName|车型)[:：]\s*([^\n|]+)", notes)
            if m:
                ovn = m.group(1).strip()
        brand_now = it.get("brand") or it.get("make")
        model_now = it.get("model") or it.get("vehicleModel")
        need_b, need_m = empty(brand_now), empty(model_now)
        if not need_b and not need_m:
            ok_already.append(sid)
            continue
        if not chassis:
            skipped_no_chassis.append(
                {"stockId": sid, "reason": "no_chassis", "ovn": ovn[:60], "brand": brand_now, "model": model_now}
            )
            continue
        pb, pm, py = parse_brand_model_from_ovn(ovn)
        fix = {
            "stockId": sid,
            "chassis": chassis,
            "originalVehicleName": ovn,
            "brand_before": brand_now,
            "model_before": model_now,
            "year_before": it.get("year"),
            "brand_after": brand_now if not need_b else pb,
            "model_after": model_now if not need_m else pm,
            "year_after": it.get("year") or py,
            "need_brand": need_b,
            "need_model": need_m,
            "can_fix": bool((not need_b or pb) and (not need_m or pm)),
        }
        fixes.append(fix)

    print("recent_ok", len(ok_already), "need_fix", len(fixes), "skip_no_chassis", len(skipped_no_chassis))
    print("--- SKIP no chassis ---")
    for r in skipped_no_chassis[:30]:
        print(json.dumps(r, ensure_ascii=False))
    print("--- FIX candidates ---")
    for r in fixes:
        print(json.dumps(r, ensure_ascii=False))

    out = {
        "approved_path": str(path),
        "recent_qxb": len(recent),
        "fixes": fixes,
        "skipped_no_chassis": skipped_no_chassis,
    }
    outp = Path("/tmp/qxb-brand-model-fix-plan.json")
    outp.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", outp)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
