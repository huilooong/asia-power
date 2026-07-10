"""QXB photo slot picker — vision heuristics + CEO learnings (not sequential guess)."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageFilter, ImageStat

ROOT = Path(__file__).resolve().parent.parent
LEARNINGS_FILE = ROOT / "data" / "knowledge-base" / "qxb-photo-slot-learnings.json"

SLOT_LABELS = [
    "Front view",
    "Rear view",
    "Engine bay",
    "Interior",
    "VIN / chassis plate",
]

SLOT_KEYS = ("front", "rear", "engine", "interior", "vin")

TRAINING_SCORE_BOOST = 0.7
VIN_PREFERRED_BOOST = 0.85
VIN_FALLBACK_BOOST = 0.35
RECOGNITION_AFFINITY_BOOST = 0.9
RECOGNITION_PENALTY = 1.2

# Weak defaults for non-VIN slot bands when CEO training has no signal yet.
DEFAULT_ALBUM_BANDS: dict[str, tuple[int, ...]] = {
    "Front view": (1, 2, 4, 5),
    "Rear view": (4, 5, 6),
    "Engine bay": (7, 8, 9),
    "Interior": (10, 11, 12, 13),
    "VIN / chassis plate": (),
}

# QXB 铭牌常见位置：前段 App 截图(≈3) 或 相册末尾(≈16–19)
QXB_VIN_SCAN_PRIORS: tuple[int, ...] = (3, 17, 18, 19, 16, 15)

CEO_VIN_AFFINITY_BOOST = 12.0

SLOT_KEY_BY_LABEL = {
    "Front view": "front",
    "Rear view": "rear",
    "Engine bay": "engine",
    "Interior": "interior",
    "VIN / chassis plate": "vin",
}


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_learnings(path: Path | None = None) -> dict[str, Any]:
    p = path or LEARNINGS_FILE
    if not p.is_file():
        return {"version": "1.0", "globalLessons": [], "rowFeedback": [], "rowOverrides": {}}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"version": "1.0", "globalLessons": [], "rowFeedback": [], "rowOverrides": {}}


def save_learnings(data: dict[str, Any], path: Path | None = None) -> Path:
    p = path or LEARNINGS_FILE
    p.parent.mkdir(parents=True, exist_ok=True)
    data["updated_at"] = _iso_now()
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(p)
    return p


def record_photo_feedback(
    row: int,
    *,
    stock_id: str,
    brand: str,
    model: str,
    slot_results: list[dict[str, Any]],
    lesson: str,
    source: str = "ceo_feedback",
) -> dict[str, Any]:
    """Persist CEO/agent photo slot correction for all agents."""
    store = load_learnings()
    entry = {
        "at": _iso_now(),
        "source": source,
        "row": row,
        "stockId": stock_id,
        "brand": brand,
        "model": model,
        "lesson": lesson,
        "slots": slot_results,
    }
    store.setdefault("rowFeedback", []).append(entry)
    global_lessons = store.setdefault("globalLessons", [])
    bullets = [
        "汽修宝 QXB 相册顺序≠前/后/发动机/内饰槽位；禁止用 manifest 前 4 张顺序贴标签。",
        "VIN 铭牌图通常在后段照片 + OCR 路径，可优先锁定 VIN 槽。",
        "车头图之后可能仍是车头；需对全相册打分选 rear/engine/interior。",
        "CEO 纠错写入 recognitionModel，供未来行自动识图；禁止批量启发式污染训练样本。",
    ]
    for b in bullets:
        if b not in global_lessons:
            global_lessons.append(b)
    store["recognitionModel"] = rebuild_recognition_model(store)
    save_learnings(store)

    try:
        from tools import memory_tool

        memory_tool.remember(
            f"QXB row {row} ({stock_id}) 照片槽位教训: {lesson}",
            category="inventory",
            source="apinventory",
            tags=["qxb", "photo-slots", "ceo-feedback"],
        )
    except Exception:
        pass

    return entry


def _region_mean(img: Image.Image, box: tuple[int, int, int, int]) -> tuple[float, float, float]:
    stat = ImageStat.Stat(img.crop(box))
    m = stat.mean
    return float(m[0]), float(m[1]), float(m[2])


def _red_ratio(img: Image.Image, y_start_frac: float = 0.55) -> float:
    small = img.resize((100, 75))
    w, h = small.size
    y0 = int(h * y_start_frac)
    hits = 0
    total = 0
    for y in range(y0, h):
        for x in range(w):
            r, g, b = small.getpixel((x, y))
            if r > 110 and r > g * 1.25 and r > b * 1.25:
                hits += 1
            total += 1
    return hits / max(total, 1)


def _corner_brightness(img: Image.Image) -> float:
    w, h = img.size
    bw = max(1, w // 5)
    bh = max(1, h // 5)
    corners = [
        img.crop((0, 0, bw, bh)),
        img.crop((w - bw, 0, w, bh)),
    ]
    vals = []
    for c in corners:
        stat = ImageStat.Stat(c.convert("L"))
        vals.append(stat.mean[0])
    return (vals[0] + vals[1]) / 2.0


def _center_texture(img: Image.Image) -> float:
    w, h = img.size
    cx0, cy0 = int(w * 0.25), int(h * 0.25)
    cx1, cy1 = int(w * 0.75), int(h * 0.75)
    region = img.crop((cx0, cy0, cx1, cy1)).convert("L")
    edges = region.filter(ImageFilter.FIND_EDGES)
    stat = ImageStat.Stat(edges)
    return float(stat.stddev[0])


def _interior_score(img: Image.Image) -> float:
    """Dashboard / cabin: muted tones, less sky-blue, moderate edge density."""
    w, h = img.size
    mid = img.crop((int(w * 0.15), int(h * 0.2), int(w * 0.85), int(h * 0.8)))
    r, g, b = _region_mean(mid, (0, 0, mid.width, mid.height))
    # sky blue penalty
    sky_penalty = max(0.0, (b - max(r, g)) / 255.0)
    gray = (r + g + b) / 3.0
    warmth = 1.0 - abs(r - g) / 255.0
    return max(0.0, (gray / 255.0) * warmth - sky_penalty * 2.0)


def score_image(path: str | Path) -> dict[str, float]:
    """Heuristic scores per slot (0–1-ish). PIL-only, no ML deps."""
    p = Path(path)
    if not p.is_file():
        return {k: 0.0 for k in SLOT_KEYS}

    try:
        img = Image.open(p).convert("RGB")
    except OSError:
        return {k: 0.0 for k in SLOT_KEYS}
    w, h = img.size

    front = _corner_brightness(img) / 255.0
    if w > h * 1.15:
        front += 0.15

    rear = _red_ratio(img) * 3.5
    engine = _center_texture(img) / 64.0
    interior = _interior_score(img)
    vin = 0.0
    # VIN plates: high edge density + often portrait-ish text block
    gray = img.convert("L").resize((80, 60))
    edge = gray.filter(ImageFilter.FIND_EDGES)
    vin = min(1.0, float(ImageStat.Stat(edge).stddev[0]) / 50.0)
    if h > w * 1.05:
        vin += 0.2

    return {
        "front": front,
        "rear": rear,
        "engine": engine,
        "interior": interior,
        "vin": vin,
    }


def _path_key(path: str) -> str:
    return Path(path).name


def photo_index_from_path(path: str) -> int:
    m = re.match(r"^(\d+)_", Path(path).name)
    return int(m.group(1)) if m else 0


def _ceo_vin_csv_affinities() -> dict[str, float]:
    """CEO 审图确认的铭牌序号 → 高权重 VIN affinity（矫正 OCR/选图）。"""
    vin_csv = ROOT / "reports" / "qxb-vin-ocr-results.csv"
    if not vin_csv.is_file():
        return {}
    try:
        from inventory_core import qxb_pipeline

        rows = qxb_pipeline._read_vin_csv_rows(vin_csv)
    except Exception:
        return {}
    aff: dict[str, float] = {}
    for rec in rows:
        conf = str(rec.get("confidence") or "")
        m = re.search(r"ceo_confirmed:photo(\d+)", conf, re.I)
        if not m:
            continue
        idx_s = str(int(m.group(1)))
        aff[idx_s] = max(aff.get(idx_s, 0.0), CEO_VIN_AFFINITY_BOOST)
    return aff


def vin_photo_scan_indices(
    photos: list[dict],
    *,
    model: dict[str, Any] | None = None,
) -> list[int]:
    """OCR scan order: CEO-trained affinities first, then every album photo."""
    by_idx = {int(p["image_index"]): p for p in photos if p.get("image_index")}
    if not by_idx:
        return []
    order = sorted(by_idx)
    aff = (model or {}).get("indexAffinities", {}).get("vin", {}) or {}
    trained = sorted(
        (i for i in order if float(aff.get(str(i), 0.0)) > 0),
        key=lambda i: (-float(aff.get(str(i), 0.0)), -i),
    )
    preferred: list[int] = []
    for idx in trained + list(QXB_VIN_SCAN_PRIORS):
        if idx in by_idx and idx not in preferred:
            preferred.append(idx)
    preferred += [i for i in order if i not in preferred]
    return preferred


def is_ceo_verified_exemplar(exemplar: dict[str, Any]) -> bool:
    """Only CEO-labeled albums may train cross-row recognition."""
    if exemplar.get("ceoVerified") is True:
        return True
    if exemplar.get("ceoVerified") is False:
        return False
    lesson = str(exemplar.get("lesson") or "")
    if "CEO" in lesson or "ceo" in lesson.lower():
        return True
    if any(k in lesson for k in ("子龙", "启发式", "批量")):
        return False
    return False


def _slot_key_from_actual(actual: str) -> str | None:
    if actual in SLOT_KEYS:
        return actual
    return SLOT_KEY_BY_LABEL.get(actual)


def rebuild_recognition_model(store: dict[str, Any]) -> dict[str, Any]:
    """Aggregate CEO-verified exemplars + feedback into cross-row pick priors."""
    ceo_exemplars = [
        e for e in load_training_exemplars(store) if is_ceo_verified_exemplar(e)
    ]
    slot_bands: dict[str, set[int]] = defaultdict(set)
    for ex in ceo_exemplars:
        for label, raw_indices in (ex.get("indexBands") or ex.get("bands") or {}).items():
            if label not in SLOT_KEY_BY_LABEL:
                continue
            for idx in raw_indices:
                slot_bands[label].add(int(idx))

    merged_bands: dict[str, list[int]] = {}
    for label, default_band in DEFAULT_ALBUM_BANDS.items():
        indices = slot_bands.get(label) or set(default_band)
        merged_bands[label] = sorted(indices)

    index_affinities: dict[str, dict[str, float]] = defaultdict(dict)
    index_penalties: dict[str, dict[str, float]] = defaultdict(dict)

    for fb in store.get("rowFeedback", []):
        for slot in fb.get("slots") or []:
            if not isinstance(slot, dict):
                continue
            idx = photo_index_from_path(str(slot.get("path") or ""))
            if idx <= 0:
                continue
            idx_s = str(idx)
            actual_key = _slot_key_from_actual(str(slot.get("actual") or ""))
            if actual_key:
                index_affinities[actual_key][idx_s] = (
                    index_affinities[actual_key].get(idx_s, 0.0) + 1.0
                )
            if slot.get("assigned_ok") is False:
                wrong_key = SLOT_KEY_BY_LABEL.get(str(slot.get("label") or ""))
                if wrong_key:
                    index_penalties[wrong_key][idx_s] = (
                        index_penalties[wrong_key].get(idx_s, 0.0) + 1.0
                    )
        bands = fb.get("indexBands")
        if not isinstance(bands, dict):
            continue
        for label, raw_indices in bands.items():
            slot_key = SLOT_KEY_BY_LABEL.get(str(label))
            if not slot_key:
                continue
            for idx in raw_indices:
                idx_s = str(int(idx))
                index_affinities[slot_key][idx_s] = (
                    index_affinities[slot_key].get(idx_s, 0.0) + 0.5
                )

    for idx_s, boost in _ceo_vin_csv_affinities().items():
        index_affinities["vin"][idx_s] = max(index_affinities["vin"].get(idx_s, 0.0), boost)

    return {
        "version": "1.0",
        "ceoExemplarCount": len(ceo_exemplars),
        "slotBands": merged_bands,
        "indexAffinities": {k: dict(v) for k, v in index_affinities.items()},
        "indexPenalties": {k: dict(v) for k, v in index_penalties.items()},
        "updatedAt": _iso_now(),
    }


def _album_slot_bands(
    candidates: list[dict[str, Any]],
    model: dict[str, Any],
) -> dict[str, tuple[int, ...]]:
    max_idx = max(c["image_index"] for c in candidates)
    bands: dict[str, tuple[int, ...]] = {}
    for label in SLOT_LABELS:
        raw = [int(i) for i in (model.get("slotBands", {}).get(label) or DEFAULT_ALBUM_BANDS[label])]
        usable = [i for i in raw if 1 <= i <= max_idx]
        if label == "VIN / chassis plate":
            aff = model.get("indexAffinities", {}).get("vin", {}) or {}
            if usable:
                indices = usable
            else:
                indices = list(range(1, max_idx + 1))
            bands[label] = tuple(sorted(
                set(indices),
                key=lambda i: (-float(aff.get(str(i), 0.0)), -i),
            ))
        elif usable:
            bands[label] = tuple(sorted(set(usable)))
        else:
            bands[label] = tuple(i for i in DEFAULT_ALBUM_BANDS[label] if i <= max_idx)
    return bands


def _recognition_adjusted_score(
    candidate: dict[str, Any],
    slot_key: str,
    model: dict[str, Any],
) -> float:
    idx = candidate["image_index"]
    base = candidate["scores"].get(slot_key, 0.0)
    aff = float((model.get("indexAffinities", {}).get(slot_key, {}) or {}).get(str(idx), 0.0))
    pen = float((model.get("indexPenalties", {}).get(slot_key, {}) or {}).get(str(idx), 0.0))
    return base + aff * RECOGNITION_AFFINITY_BOOST - pen * RECOGNITION_PENALTY


def _pick_best_in_band_with_model(
    candidates: list[dict[str, Any]],
    indices: tuple[int, ...],
    slot_key: str,
    used: set[str],
    model: dict[str, Any],
) -> dict[str, Any] | None:
    pool = [
        c for c in candidates
        if c["image_index"] in indices and c["path"] not in used
    ]
    if not pool:
        return None
    return max(
        pool,
        key=lambda c: (_recognition_adjusted_score(c, slot_key, model), -c["image_index"]),
    )


def pick_by_recognition_model(
    candidates: list[dict[str, Any]],
    model: dict[str, Any],
    *,
    max_photos: int = 5,
    vin_info: dict | None = None,
) -> tuple[list[dict[str, str]], dict[str, Any]]:
    """Pick slots using CEO-aggregated album bands + feedback affinities."""
    bands = _album_slot_bands(candidates, model)
    used: set[str] = set()
    picks: list[dict[str, str]] = []
    band_hits: dict[str, int | None] = {}

    ocr_path = (vin_info or {}).get("image_path") or ""
    ceo_vin_lock = (
        ocr_path
        and Path(ocr_path).is_file()
        and str((vin_info or {}).get("confidence") or "").startswith("ceo_confirmed")
    )
    if ceo_vin_lock:
        vin_cand = next(
            (
                c for c in candidates
                if c["path"] == ocr_path or Path(c["path"]).name == Path(ocr_path).name
            ),
            None,
        )
        if vin_cand:
            used.add(vin_cand["path"])
            picks.append({"path": vin_cand["path"], "label": "VIN / chassis plate"})
            band_hits["VIN / chassis plate"] = vin_cand["image_index"]

    for label in ("Front view", "Rear view", "Engine bay", "Interior"):
        slot_key = SLOT_KEY_BY_LABEL[label]
        best = _pick_best_in_band_with_model(
            candidates, bands[label], slot_key, used, model,
        )
        if best:
            used.add(best["path"])
            picks.append({"path": best["path"], "label": label})
            band_hits[label] = best["image_index"]
        else:
            band_hits[label] = None

    vin_indices = bands["VIN / chassis plate"]
    ocr_idx = photo_index_from_path(ocr_path) if ocr_path and Path(ocr_path).is_file() else 0
    if ocr_idx:
        vin_indices = (ocr_idx,) + tuple(i for i in vin_indices if i != ocr_idx)
    if not ceo_vin_lock:
        vin_cand = _pick_vin_from_band(candidates, vin_indices, used)
        if vin_cand and len(picks) < max_photos:
            used.add(vin_cand["path"])
            picks.append({"path": vin_cand["path"], "label": "VIN / chassis plate"})
            band_hits["VIN / chassis plate"] = vin_cand["image_index"]

    swapped = _maybe_swap_rear_interior(picks, candidates, allow_swap=False)
    filled = sum(1 for v in band_hits.values() if v is not None)
    confidence = "high" if filled >= 5 else "medium" if filled >= 4 else "low"
    return picks[:max_photos], {
        "method": "recognition_model",
        "confidence": confidence,
        "bandHits": band_hits,
        "bands": {k: list(v) for k, v in bands.items()},
        "rearInteriorSwapped": swapped,
        "candidates": len(candidates),
        "ceoExemplars": model.get("ceoExemplarCount", 0),
    }


def set_row_overrides(row: int, slots: dict[str, str], *, source: str = "ceo") -> dict[str, Any]:
    """CEO/agent confirmed slot → path mapping for a row."""
    store = load_learnings()
    store.setdefault("rowOverrides", {})[str(row)] = dict(slots)
    store.setdefault("rowFeedback", []).append({
        "at": _iso_now(),
        "source": source,
        "row": row,
        "lesson": "manual slot overrides applied",
        "slots": [{"label": k, "path": v} for k, v in slots.items()],
    })
    save_learnings(store)
    return store["rowOverrides"][str(row)]


def _candidate_map(candidates: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {c["path"]: c for c in candidates}


def _maybe_swap_rear_interior(
    picks: list[dict[str, str]],
    candidates: list[dict[str, Any]],
    *,
    allow_swap: bool = True,
) -> bool:
    """Swap rear/interior labels when each image fits the other slot better."""
    if not allow_swap:
        return False
    by_path = _candidate_map(candidates)
    rear_idx = next((i for i, p in enumerate(picks) if p["label"] == "Rear view"), None)
    int_idx = next((i for i, p in enumerate(picks) if p["label"] == "Interior"), None)
    if rear_idx is None or int_idx is None:
        return False
    rear_path = picks[rear_idx]["path"]
    int_path = picks[int_idx]["path"]
    rc, ic = by_path.get(rear_path), by_path.get(int_path)
    if not rc or not ic:
        return False
    rs, is_ = rc["scores"], ic["scores"]
    before = rs.get("rear", 0) + is_.get("interior", 0)
    after = rs.get("interior", 0) + is_.get("rear", 0)
    if after > before + 0.05:
        picks[rear_idx]["label"] = "Interior"
        picks[int_idx]["label"] = "Rear view"
        return True
    return False


def _pick_best_in_index_band(
    candidates: list[dict[str, Any]],
    indices: tuple[int, ...],
    slot_key: str,
    used: set[str],
) -> dict[str, Any] | None:
    pool = [
        c for c in candidates
        if c["image_index"] in indices and c["path"] not in used
    ]
    if not pool:
        return None
    return max(pool, key=lambda c: (c["scores"].get(slot_key, 0.0), -c["image_index"]))


def _pick_vin_from_band(
    candidates: list[dict[str, Any]],
    indices: tuple[int, ...],
    used: set[str],
) -> dict[str, Any] | None:
    """indices ordered by preference (e.g. 17 before 16)."""
    by_index = {
        c["image_index"]: c
        for c in candidates
        if c["path"] not in used
    }
    for idx in indices:
        if idx in by_index:
            return by_index[idx]
    return None


def load_training_exemplars(store: dict[str, Any]) -> list[dict[str, Any]]:
    """CEO-labeled albums used to train index→slot recognition (not per-row hard rules)."""
    out: list[dict[str, Any]] = list(store.get("trainingExemplars") or [])
    seen_rows = {int(e["row"]) for e in out if e.get("row") is not None}
    for row_s, entry in (store.get("rowPhotoIndexMap") or {}).items():
        if not isinstance(entry, dict) or not entry.get("bands"):
            continue
        row_n = int(row_s)
        if row_n in seen_rows:
            continue
        out.append({
            "row": row_n,
            "stockId": entry.get("stockId", f"QXB{row_n:04d}"),
            "lesson": entry.get("lesson", ""),
            "indexBands": entry["bands"],
        })
    return out


def aggregate_training_boosts(exemplars: list[dict[str, Any]]) -> dict[str, dict[int, float]]:
    """Merge index bands from CEO-verified exemplars into per-slot score boosts."""
    boosts: dict[str, dict[int, float]] = defaultdict(dict)
    for ex in exemplars:
        if not is_ceo_verified_exemplar(ex):
            continue
        bands = ex.get("indexBands") or ex.get("bands") or {}
        for label, raw_indices in bands.items():
            slot_key = SLOT_KEY_BY_LABEL.get(str(label))
            if not slot_key:
                continue
            indices = [int(i) for i in raw_indices]
            for rank, idx in enumerate(indices):
                if slot_key == "vin":
                    boost = (
                        CEO_VIN_AFFINITY_BOOST if rank == 0 and "CEO确认" in str(ex.get("lesson") or "")
                        else (VIN_PREFERRED_BOOST if rank == 0 else VIN_FALLBACK_BOOST)
                    )
                else:
                    boost = TRAINING_SCORE_BOOST
                boosts[slot_key][idx] = max(boosts[slot_key].get(idx, 0.0), boost)
    return dict(boosts)


def apply_training_boosts(
    candidates: list[dict[str, Any]],
    boosts: dict[str, dict[int, float]],
) -> list[dict[str, Any]]:
    if not boosts:
        return candidates
    boosted: list[dict[str, Any]] = []
    for c in candidates:
        scores = dict(c["scores"])
        idx = int(c["image_index"])
        for slot_key, index_map in boosts.items():
            if idx in index_map:
                scores[slot_key] = scores.get(slot_key, 0.0) + index_map[idx]
        boosted.append({**c, "scores": scores})
    return boosted


def record_training_exemplar(
    row: int,
    bands: dict[str, list[int]],
    *,
    lesson: str,
    stock_id: str = "",
    ceo_verified: bool = True,
) -> dict[str, Any]:
    """Persist CEO album judgment as training signal for future rows."""
    store = load_learnings()
    exemplars = [e for e in store.get("trainingExemplars", []) if e.get("row") != row]
    entry = {
        "row": row,
        "stockId": stock_id or f"QXB{row:04d}",
        "lesson": lesson,
        "indexBands": bands,
        "ceoVerified": ceo_verified,
        "recordedAt": _iso_now(),
    }
    exemplars.append(entry)
    store["trainingExemplars"] = exemplars
    store.setdefault("rowFeedback", []).append({
        "at": _iso_now(),
        "source": "ceo_training_exemplar" if ceo_verified else "agent_heuristic",
        "row": row,
        "stockId": entry["stockId"],
        "lesson": lesson,
        "indexBands": bands,
    })
    global_lessons = store.setdefault("globalLessons", [])
    note = "CEO 相册序号判读写入 trainingExemplars，供跨行 recognitionModel 学习，不是盲目硬编码。"
    if note not in global_lessons:
        global_lessons.append(note)
    store["recognitionModel"] = rebuild_recognition_model(store)
    save_learnings(store)
    return entry


def row_photo_index_map(store: dict[str, Any], row: int) -> dict[str, Any] | None:
    """Per-row CEO index→content map (NOT a global slot rule)."""
    entry = (store.get("rowPhotoIndexMap") or {}).get(str(row))
    if not isinstance(entry, dict):
        return None
    bands = entry.get("bands")
    if not isinstance(bands, dict) or not bands:
        return None
    return entry


def pick_by_row_photo_index_map(
    candidates: list[dict[str, Any]],
    bands: dict[str, list[int] | tuple[int, ...]],
    *,
    max_photos: int = 5,
) -> tuple[list[dict[str, str]], dict[str, Any]]:
    """Pick within CEO-provided index lists for one row; tie-break via heuristics."""
    used: set[str] = set()
    picks: list[dict[str, str]] = []
    band_hits: dict[str, int | None] = {}

    for label in ("Front view", "Rear view", "Engine bay", "Interior"):
        indices = tuple(int(i) for i in (bands.get(label) or []))
        slot_key = SLOT_KEY_BY_LABEL[label]
        best = _pick_best_in_index_band(candidates, indices, slot_key, used)
        if best:
            used.add(best["path"])
            picks.append({"path": best["path"], "label": label})
            band_hits[label] = best["image_index"]
        else:
            band_hits[label] = None

    vin_indices = tuple(int(i) for i in (bands.get("VIN / chassis plate") or []))
    if vin_indices:
        vin_cand = _pick_vin_from_band(candidates, vin_indices, used)
    else:
        pool = [c for c in candidates if c["path"] not in used]
        vin_cand = max(pool, key=lambda c: (c["scores"].get("vin", 0.0), -c["image_index"])) if pool else None
    if vin_cand and len(picks) < max_photos:
        used.add(vin_cand["path"])
        picks.append({"path": vin_cand["path"], "label": "VIN / chassis plate"})
        band_hits["VIN / chassis plate"] = vin_cand["image_index"]

    filled = sum(1 for v in band_hits.values() if v is not None)
    confidence = "high" if filled >= 5 else "medium" if filled >= 4 else "low"
    return picks[:max_photos], {
        "method": "row_photo_index_map",
        "confidence": confidence,
        "bandHits": band_hits,
        "candidates": len(candidates),
    }


def record_row_photo_index_map(
    row: int,
    bands: dict[str, list[int]],
    *,
    lesson: str,
    stock_id: str = "",
    resolved_overrides: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Persist CEO per-row photo index judgment as a training exemplar."""
    entry = record_training_exemplar(row, bands, lesson=lesson, stock_id=stock_id)
    if resolved_overrides:
        set_row_overrides(row, resolved_overrides, source="ceo")
    return entry


def row_manual_overrides(store: dict[str, Any], row: int) -> dict[str, str]:
    raw = (store.get("rowOverrides") or {}).get(str(row)) or {}
    return {str(k): str(v) for k, v in raw.items()}


def pick_photo_slots(
    photos: list[dict],
    vin_info: dict | None = None,
    *,
    row: int | None = None,
    max_photos: int = 5,
    learnings_path: Path | None = None,
) -> tuple[list[dict[str, str]], dict[str, Any]]:
    """
    Pick labeled slots from all manifest photos.
    Returns (picks, meta) where meta includes scores and method.
    """
    store = load_learnings(learnings_path)
    overrides = row_manual_overrides(store, row) if row is not None else {}

    candidates: list[dict[str, Any]] = []
    for rec in photos:
        path = rec.get("local_path") or rec.get("path") or ""
        if not path or not Path(path).is_file():
            continue
        scores = score_image(path)
        candidates.append({
            "path": path,
            "image_index": int(rec.get("image_index") or 0),
            "scores": scores,
        })

    if not candidates:
        return [], {"method": "empty", "confidence": "none"}

    # CEO-finalized upload paths (e.g. approved row 3) — not training.
    # Keep CEO slot labels first, then append remaining album photos so we never
    # silently drop images the CEO saw on the review page (compress ≠ drop).
    if overrides:
        picks = []
        used: set[str] = set()
        for label in SLOT_LABELS:
            path = overrides.get(label)
            if path and Path(path).is_file() and path not in used:
                picks.append({"path": path, "label": label})
                used.add(path)
        if len(picks) >= 3:
            # Never drop album photos the CEO reviewed — fill beyond the 5 slots.
            fill_cap = max(int(max_photos or 0), len(candidates))
            for c in sorted(candidates, key=lambda x: x["image_index"]):
                if len(picks) >= fill_cap:
                    break
                if c["path"] in used:
                    continue
                idx = int(c.get("image_index") or 0)
                label = f"Photo {idx:02d}" if idx else Path(c["path"]).stem
                picks.append({"path": c["path"], "label": label})
                used.add(c["path"])
            return picks[:fill_cap], {
                "method": "manual_override+album_fill",
                "confidence": "ceo",
                "candidates": len(candidates),
                "picked": len(picks[:fill_cap]),
            }

    exemplars = load_training_exemplars(store)
    row_exemplar = (
        next((e for e in exemplars if e.get("row") == row), None)
        if row is not None
        else None
    )
    if row_exemplar and row_exemplar.get("indexBands") and is_ceo_verified_exemplar(row_exemplar):
        bands = row_exemplar["indexBands"]
        train_picks, train_meta = pick_by_row_photo_index_map(
            candidates,
            bands,
            max_photos=max_photos,
        )
        if len(train_picks) >= 3:
            train_meta["method"] = "training_exemplar_row"
            train_meta["trainingRow"] = row
            train_meta["lesson"] = row_exemplar.get("lesson")
            train_meta["scores"] = [
                {"path": Path(c["path"]).name, "index": c["image_index"], "scores": c["scores"]}
                for c in candidates
            ]
            return train_picks[:max_photos], train_meta

    recognition_model = store.get("recognitionModel") or rebuild_recognition_model(store)
    if recognition_model.get("ceoExemplarCount", 0) >= 2:
        rec_picks, rec_meta = pick_by_recognition_model(
            candidates, recognition_model, max_photos=max_photos, vin_info=vin_info,
        )
        if len(rec_picks) >= 4:
            rec_meta["scores"] = [
                {"path": Path(c["path"]).name, "index": c["image_index"], "scores": c["scores"]}
                for c in candidates
            ]
            return rec_picks[:max_photos], rec_meta

    ceo_exemplars = [e for e in exemplars if is_ceo_verified_exemplar(e)]
    training_boosts = aggregate_training_boosts(ceo_exemplars)
    training_active = bool(training_boosts)
    scored_candidates = apply_training_boosts(candidates, training_boosts)

    used: set[str] = set()
    picks: list[dict[str, str]] = []

    def take_best(slot_key: str, label: str, *, bonus_path: str | None = None) -> bool:
        if len(picks) >= max_photos:
            return False
        pool = [c for c in scored_candidates if c["path"] not in used]
        if not pool:
            return False
        trained_indices = set(training_boosts.get(slot_key, {}).keys())
        if trained_indices:
            band_pool = [c for c in pool if c["image_index"] in trained_indices]
            if band_pool:
                pool = band_pool
        if bonus_path and any(c["path"] == bonus_path for c in pool):
            used.add(bonus_path)
            picks.append({"path": bonus_path, "label": label})
            return True
        if slot_key == "vin" and trained_indices:
            vin_order = sorted(
                trained_indices,
                key=lambda i: -training_boosts["vin"].get(i, 0.0),
            )
            by_index = {c["image_index"]: c for c in pool}
            for idx in vin_order:
                if idx in by_index:
                    best = by_index[idx]
                    used.add(best["path"])
                    picks.append({"path": best["path"], "label": label})
                    return True
        best = max(pool, key=lambda c: (c["scores"].get(slot_key, 0.0), -c["image_index"]))
        used.add(best["path"])
        picks.append({"path": best["path"], "label": label})
        return True

    vin_path = (vin_info or {}).get("image_path") or ""
    ceo_vin_lock = (
        vin_path
        and Path(vin_path).is_file()
        and str((vin_info or {}).get("confidence") or "").startswith("ceo_confirmed")
    )
    use_ocr_vin = (
        vin_path
        and Path(vin_path).is_file()
        and (not training_active or ceo_vin_lock)
    )
    if use_ocr_vin:
        take_best("vin", "VIN / chassis plate", bonus_path=vin_path)
    else:
        take_best("vin", "VIN / chassis plate")

    if not training_active:
        first_path = min(candidates, key=lambda c: c["image_index"])["path"]
        take_best("front", "Front view", bonus_path=first_path)
    else:
        take_best("front", "Front view")

    take_best("rear", "Rear view")
    take_best("engine", "Engine bay")
    take_best("interior", "Interior")

    swapped = _maybe_swap_rear_interior(picks, candidates)

    # Fill remaining if short
    for c in sorted(candidates, key=lambda x: x["image_index"]):
        if len(picks) >= max_photos:
            break
        if c["path"] in used:
            continue
        picks.append({
            "path": c["path"],
            "label": SLOT_LABELS[min(len(picks), len(SLOT_LABELS) - 1)],
        })
        used.add(c["path"])

    avg_top = 0.0
    if picks:
        score_keys = ["front", "rear", "engine", "interior", "vin"]
        vals = []
        for p in picks:
            cand = next((c for c in candidates if c["path"] == p["path"]), None)
            if not cand:
                continue
            key = p["label"].split()[0].lower()
            if "vin" in p["label"].lower():
                vals.append(cand["scores"]["vin"])
            elif "front" in p["label"].lower():
                vals.append(cand["scores"]["front"])
            elif "rear" in p["label"].lower():
                vals.append(cand["scores"]["rear"])
            elif "engine" in p["label"].lower():
                vals.append(cand["scores"]["engine"])
            elif "interior" in p["label"].lower():
                vals.append(cand["scores"]["interior"])
        avg_top = sum(vals) / max(len(vals), 1)

    confidence = "low" if avg_top < 0.35 else "medium" if avg_top < 0.55 else "high"
    method = "heuristic_v1+training" if training_active else "heuristic_v1"
    meta = {
        "method": method,
        "confidence": confidence,
        "rearInteriorSwapped": swapped,
        "candidates": len(candidates),
        "trainingExemplars": len(ceo_exemplars),
        "scores": [
            {"path": Path(c["path"]).name, "index": c["image_index"], "scores": c["scores"]}
            for c in candidates
        ],
    }
    if training_active:
        meta["trainingBoosts"] = {
            k: dict(v) for k, v in training_boosts.items()
        }
    return picks[:max_photos], meta


def format_pick_report(row: int, picks: list[dict[str, str]], meta: dict[str, Any]) -> str:
    lines = [
        f"QXB row {row} photo pick ({meta.get('method')}, confidence={meta.get('confidence')})",
    ]
    if meta.get("trainingExemplars"):
        lines.append(f"  training exemplars: {meta.get('trainingExemplars')}")
    if meta.get("trainingBoosts"):
        lines.append(f"  index boosts: {meta.get('trainingBoosts')}")
    for p in picks:
        name = Path(p["path"]).name
        idx = re.match(r"^(\d+)_", name)
        idx_s = f" [#{idx.group(1)}]" if idx else ""
        lines.append(f"  - {p['label']}: {name}{idx_s}")
    if meta.get("confidence") == "low":
        lines.append("⚠ 置信度低 — 请 /qxb preview 人工核对后再上传。")
    elif meta.get("method") == "recognition_model":
        lines.append(
            f"✓ CEO 识图模型（{meta.get('ceoExemplars', 0)} 条样本 + 纠错沉淀）"
        )
    elif meta.get("method") == "training_exemplar_row":
        lines.append(f"✓ 使用本条训练样本相册判读（row {meta.get('trainingRow')}，非全局规则）")
    elif meta.get("method", "").endswith("+training"):
        lines.append("✓ 启发式 + CEO 训练样本 index 加分（非本条硬编码）")
    elif meta.get("method") == "manual_override":
        lines.append("✓ 使用 CEO rowOverrides 固定路径")
    return "\n".join(lines)
