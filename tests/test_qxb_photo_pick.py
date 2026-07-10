"""Tests for QXB photo picker."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from inventory_core import qxb_photo_pick


class QxbPhotoPickTests(unittest.TestCase):
    def _candidates(self, root: Path, count: int = 17) -> list[dict]:
        photos = []
        for i in range(1, count + 1):
            p = root / f"{i:02d}.jpg"
            p.write_bytes(b"\xff\xd8\xff" + b"x" * 80)
            photos.append({"local_path": str(p), "image_index": i})
        return photos

    def test_row3_uses_manual_override_for_approved_upload(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            learnings = root / "learnings.json"
            learnings.write_text(
                json.dumps({
                    "rowOverrides": {
                        "3": {
                            "Front view": str(root / "01.jpg"),
                            "Rear view": str(root / "05.jpg"),
                            "Engine bay": str(root / "09.jpg"),
                        }
                    }
                }),
                encoding="utf-8",
            )
            for name in ("01.jpg", "05.jpg", "09.jpg"):
                (root / name).write_bytes(b"\xff\xd8\xff")
            photos = self._candidates(root)
            picks, meta = qxb_photo_pick.pick_photo_slots(
                photos, row=3, learnings_path=learnings,
            )
            self.assertEqual(meta["method"], "manual_override")
            labels = {p["label"] for p in picks}
            self.assertIn("Front view", labels)

    def test_training_exemplar_applies_only_to_matching_row(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            learnings = root / "learnings.json"
            learnings.write_text(
                json.dumps({
                    "trainingExemplars": [{
                        "row": 2,
                        "lesson": "CEO row2",
                        "indexBands": {
                            "Front view": [2, 3],
                            "Rear view": [4, 5, 6],
                            "Engine bay": [7, 8, 9],
                            "Interior": [10, 11, 12, 13],
                            "VIN / chassis plate": [17, 16],
                        },
                    }],
                }),
                encoding="utf-8",
            )
            photos = self._candidates(root)
            picks, meta = qxb_photo_pick.pick_photo_slots(
                photos, row=2, learnings_path=learnings,
            )
            self.assertEqual(meta["method"], "training_exemplar_row")
            front = next(p for p in picks if p["label"] == "Front view")
            self.assertIn("02.jpg", front["path"])
            picks4, meta4 = qxb_photo_pick.pick_photo_slots(
                photos, row=4, learnings_path=learnings,
            )
            self.assertNotEqual(meta4["method"], "training_exemplar_row")

    def test_row2_training_exemplar_picks_ceo_indices(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            learnings = root / "learnings.json"
            learnings.write_text(
                json.dumps({
                    "trainingExemplars": [{
                        "row": 2,
                        "lesson": "CEO row2",
                        "indexBands": {
                            "Front view": [2],
                            "Rear view": [5],
                            "Engine bay": [9],
                            "Interior": [13],
                            "VIN / chassis plate": [17, 16],
                        },
                    }],
                }),
                encoding="utf-8",
            )
            photos = self._candidates(root)
            picks, meta = qxb_photo_pick.pick_photo_slots(
                photos, row=2, learnings_path=learnings,
            )
            self.assertEqual(meta["method"], "training_exemplar_row")
            by_label = {p["label"]: Path(p["path"]).name for p in picks}
            self.assertEqual(by_label["Front view"], "02.jpg")
            self.assertEqual(by_label["Rear view"], "05.jpg")
            self.assertEqual(by_label["Engine bay"], "09.jpg")
            self.assertEqual(by_label["Interior"], "13.jpg")
            self.assertEqual(by_label["VIN / chassis plate"], "17.jpg")

    def test_vin_prefers_17_in_training_band(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            both = [
                {"path": str(root / "16.jpg"), "image_index": 16, "scores": {"vin": 0.1}},
                {"path": str(root / "17.jpg"), "image_index": 17, "scores": {"vin": 0.1}},
            ]
            picked = qxb_photo_pick._pick_vin_from_band(both, (17, 16), set())
            self.assertEqual(picked["image_index"], 17)

    def test_recognition_model_vin_prefers_tail_index(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            candidates = []
            for i in range(1, 18):
                p = root / f"{i:02d}.jpg"
                p.write_bytes(b"\xff\xd8\xff" + b"x" * 80)
                candidates.append({
                    "path": str(p),
                    "image_index": i,
                    "scores": {"front": 0.1, "rear": 0.1, "engine": 0.1, "interior": 0.1, "vin": 0.1},
                })
            model = {
                "slotBands": qxb_photo_pick.DEFAULT_ALBUM_BANDS,
                "indexAffinities": {},
                "indexPenalties": {},
                "ceoExemplarCount": 2,
            }
            picks, meta = qxb_photo_pick.pick_by_recognition_model(candidates, model)
            vin = next(p for p in picks if p["label"] == "VIN / chassis plate")
            self.assertIn("17.jpg", vin["path"])

    def test_vin_scan_indices_covers_full_album(self) -> None:
        photos = [{"image_index": i, "local_path": f"/p/{i}.jpg"} for i in (1, 3, 5, 17, 20)]
        order = qxb_photo_pick.vin_photo_scan_indices(photos, model={"indexAffinities": {"vin": {"3": 5.0}}})
        self.assertEqual(order[0], 3)
        self.assertEqual(set(order), {1, 3, 5, 17, 20})

    def test_record_training_exemplar_persists(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "learnings.json"
            qxb_photo_pick.LEARNINGS_FILE = path
            try:
                entry = qxb_photo_pick.record_training_exemplar(
                    4,
                    {"Front view": [1, 2]},
                    lesson="CEO test",
                    stock_id="QXB0004",
                )
                self.assertEqual(entry["row"], 4)
                self.assertTrue(entry["ceoVerified"])
                store = qxb_photo_pick.load_learnings(path)
                self.assertEqual(len(store["trainingExemplars"]), 1)
                self.assertIn("recognitionModel", store)
            finally:
                qxb_photo_pick.LEARNINGS_FILE = (
                    Path(__file__).resolve().parent.parent
                    / "data/knowledge-base/qxb-photo-slot-learnings.json"
                )

    def test_batch_exemplar_does_not_train_recognition(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            learnings = root / "learnings.json"
            learnings.write_text(
                json.dumps({
                    "trainingExemplars": [{
                        "row": 8,
                        "lesson": "子龙批量 row8 启发式",
                        "indexBands": {"Rear view": [6], "Front view": [3]},
                    }],
                }),
                encoding="utf-8",
            )
            self.assertFalse(
                qxb_photo_pick.is_ceo_verified_exemplar(
                    {"lesson": "子龙批量 row8 启发式"},
                ),
            )
            boosts = qxb_photo_pick.aggregate_training_boosts(
                [{"row": 8, "lesson": "子龙批量", "indexBands": {"Rear view": [6]}}],
            )
            self.assertEqual(boosts, {})

    def test_recognition_model_picks_ceo_bands_for_new_row(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            learnings = root / "learnings.json"
            learnings.write_text(
                json.dumps({
                    "trainingExemplars": [
                        {
                            "row": 2,
                            "lesson": "CEO row2",
                            "indexBands": {
                                "Front view": [2],
                                "Rear view": [5],
                                "Engine bay": [9],
                                "Interior": [13],
                                "VIN / chassis plate": [17],
                            },
                        },
                        {
                            "row": 12,
                            "lesson": "CEO row12",
                            "indexBands": {
                                "Front view": [3],
                                "Rear view": [4, 5, 6],
                                "Engine bay": [8],
                                "Interior": [10],
                                "VIN / chassis plate": [18, 17],
                            },
                        },
                    ],
                }),
                encoding="utf-8",
            )
            store = qxb_photo_pick.load_learnings(learnings)
            store["recognitionModel"] = qxb_photo_pick.rebuild_recognition_model(store)
            photos = []
            for i in range(1, 19):
                p = root / f"{i:02d}.jpg"
                p.write_bytes(b"\xff\xd8\xff" + b"x" * 80)
                photos.append({"local_path": str(p), "image_index": i})
            picks, meta = qxb_photo_pick.pick_photo_slots(
                photos, row=99, learnings_path=learnings,
            )
            self.assertEqual(meta["method"], "recognition_model")
            by_label = {p["label"]: Path(p["path"]).name for p in picks}
            self.assertIn(by_label["Rear view"], ("04.jpg", "05.jpg", "06.jpg"))
            self.assertEqual(by_label["Interior"], "10.jpg")


if __name__ == "__main__":
    unittest.main()
