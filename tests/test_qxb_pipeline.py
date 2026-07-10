"""Tests for QXB one-row pipeline (子龙 upload workflow)."""

from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from inventory_core import qxb_pipeline
from tools.qxb_upload_tool import TOOL as QXB_TOOL


class QxbPipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        photos = root / "photos"
        photos.mkdir()
        paths = []
        for i in range(3):
            p = photos / f"{i+1}.jpg"
            p.write_bytes(b"\xff\xd8\xff" + b"x" * 100)
            paths.append(str(p))

        manifest = root / "manifest.csv"
        with manifest.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["row", "local_path", "status", "image_index"],
            )
            writer.writeheader()
            for i, p in enumerate(paths):
                writer.writerow({
                    "row": 2,
                    "local_path": p,
                    "status": "exists",
                    "image_index": i + 1,
                })

        (root / "brand.json").write_text(
            json.dumps({"起亚": {"english": "Kia"}}),
            encoding="utf-8",
        )
        (root / "model.json").write_text(json.dumps({"kia": {}}), encoding="utf-8")
        (root / "queue.json").write_text(
            json.dumps({"version": "1.0", "rows": {}}),
            encoding="utf-8",
        )
        (root / "approved.json").write_text("[]", encoding="utf-8")
        (root / "vins.csv").write_text(
            "row,vin,image_path,confidence\n2,LBEXDAEB09X742323,,high\n",
            encoding="utf-8",
        )

        self.decode_patcher = mock.patch.object(
            qxb_pipeline,
            "decode_vin_via_api",
            return_value={
                "ok": True,
                "engineCode": "G4ED",
                "transmissionCode": "5MT",
                "drivetrain": "2WD",
            },
        )
        self.decode_patcher.start()
        self.addCleanup(self.decode_patcher.stop)
        self.price_patcher = mock.patch.object(
            qxb_pipeline,
            "estimate_half_cut_price_usd",
            return_value={
                "priceUsd": 850,
                "priceEstimated": True,
                "method": "catalog_median",
                "note": "test estimate",
            },
        )
        self.price_patcher.start()
        self.addCleanup(self.price_patcher.stop)

        self.paths = qxb_pipeline.QxbPaths(
            root=root,
            xlsx=root / "missing.xlsx",
            manifest=manifest,
            vin_csv=root / "vins.csv",
            upload_state=root / "upload-state.json",
            approved_out=root / "approved.json",
            agent_queue=root / "queue.json",
            model_dict=root / "model.json",
            brand_dict=root / "brand.json",
        )
        self.source = {
            "row": 2,
            "brand_cn": "起亚",
            "trim": "起亚 赛拉图 2008款 欧风 1.6 MT GL",
            "description": "测试",
            "year": 2008,
        }

    def _make_ctx(self) -> qxb_pipeline.PipelineContext:
        with mock.patch.object(qxb_pipeline, "load_rows", return_value=[self.source]):
            return qxb_pipeline.load_context(self.paths)

    def test_parse_vin_ocr_confidence_labels(self) -> None:
        label, score = qxb_pipeline.parse_vin_ocr_confidence("very_high:gray:rot0")
        self.assertEqual(label, "very_high:gray:rot0")
        self.assertGreater(score or 0, 0.9)
        _, none_score = qxb_pipeline.parse_vin_ocr_confidence("none")
        self.assertEqual(none_score, 0.0)

    def test_inspect_ready_with_photos(self) -> None:
        ctx = self._make_ctx()
        data = qxb_pipeline.inspect_row(ctx, 2)
        self.assertTrue(data["ready"])
        self.assertEqual(data["stockId"], "QXB0002")
        self.assertGreaterEqual(len(data["fields"]["photoSlots"]), 3)

    def test_prepare_dry_run_record(self) -> None:
        ctx = self._make_ctx()
        result = qxb_pipeline.prepare_row(ctx, 2)
        self.assertTrue(result["ok"])
        self.assertEqual(result["record"]["stockId"], "QXB0002")
        self.assertTrue(result["dryRun"])

    def test_block_and_unblock(self) -> None:
        ctx = self._make_ctx()
        qxb_pipeline.set_row_status(ctx, 2, "blocked", issue="test blocker")
        entry = ctx.queue["rows"]["2"]
        self.assertEqual(entry["status"], "blocked")
        qxb_pipeline.set_row_status(ctx, 2, "pending", clear_issues=True)
        self.assertEqual(ctx.queue["rows"]["2"]["status"], "pending")

    def test_find_next_row_skips_blocked(self) -> None:
        ctx = self._make_ctx()
        qxb_pipeline.set_row_status(ctx, 2, "blocked")
        self.assertIsNone(qxb_pipeline.find_next_row(ctx))

    def test_find_next_row_skips_parked(self) -> None:
        ctx = self._make_ctx()
        qxb_pipeline.park_row(ctx, 2, category="no_vin", note="test")
        self.assertIsNone(qxb_pipeline.find_next_row(ctx))

    def test_powertrain_blockers_require_decode(self) -> None:
        blockers = qxb_pipeline.powertrain_blockers("LJDEAA294B0158251", None)
        self.assertTrue(any("decode failed" in b.lower() or "missing" in b.lower() for b in blockers))
        ok_decode = {
            "ok": True,
            "engineCode": "G4EE",
            "transmissionCode": "5MT",
        }
        self.assertEqual(qxb_pipeline.powertrain_blockers("LJDEAA294B0158251", ok_decode), [])

    def test_nameplate_engine_overrides_decode_guess(self) -> None:
        ctx = self._make_ctx()
        ctx.vins[2] = {
            "vin": "LBEXDAEB09X742323",
            "image_path": "",
            "confidence": "ceo_confirmed",
            "engine_code": "G4KD",
            "transmission_code": "",
        }
        fields = qxb_pipeline.resolve_listing_fields(ctx, 2)
        decode = fields["vin_decode"]
        self.assertEqual(decode["engineCode"], "G4KD")
        self.assertEqual(decode["decodeMethod"], "Nameplate")
        self.assertTrue(decode["ok"])
        self.assertEqual(qxb_pipeline.powertrain_blockers("LBEXDAEB09X742323", decode), [])

    def test_fallback_engine_uses_trim_not_wrong_catalog_model(self) -> None:
        refs = [
            {"model": "Accord", "engineCode": "R20A3", "score": 46},
            {"model": "Accord", "engineCode": "K24A8", "score": 40},
        ]
        trim = "本田 飞度 2011款 1.3L 手动舒适版"
        engine = qxb_pipeline.pick_fallback_engine(trim, "Honda", "Fit", refs)
        self.assertEqual(engine, "L13Z")

    def test_fallback_previa_24l_powertrain(self) -> None:
        trim = "丰田 普瑞维亚 2006款 2.4L 7人座豪华版"
        engine = qxb_pipeline.infer_engine_from_trim(trim, "Toyota", "Previa")
        trans = qxb_pipeline.infer_default_transmission(trim, "Toyota", "Previa")
        self.assertEqual(engine, "2AZ-FE")
        self.assertEqual(trans, "4AT")

    def test_parse_model_qxb_trim_year_prefix(self) -> None:
        mk, _ = qxb_pipeline.parse_model("福特", "2012款 三厢经典 1.8L 手动时尚型")
        self.assertEqual(mk, "三厢经典")

    def test_normalize_decode_model_strips_brand_prefix(self) -> None:
        name = qxb_pipeline.normalize_decode_model_name("克莱斯勒300C", "克莱斯勒", "克莱斯勒")
        self.assertEqual(name, "300C")

    def test_apply_vin_decode_sets_model_from_decode(self) -> None:
        rec = {"brand": "Ford", "model": "2012 1 8L", "engineCode": "", "transmissionCode": ""}
        qxb_pipeline.apply_vin_decode_to_record(rec, {
            "ok": True,
            "brand": "Ford",
            "model": "福克斯",
            "engineCode": "CAF483Q0",
            "transmissionCode": "5MT",
        })
        self.assertEqual(rec["model"], "福克斯")

    def test_decode_vin_uses_local_cache_without_api(self) -> None:
        root = self.paths.root
        cache_path = root / "data/knowledge-base/vin-decode-cache.json"
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        vin = "LBEXDAEB09X742323"
        cache_path.write_text(
            json.dumps(
                {
                    vin: {
                        "ok": True,
                        "vin": vin,
                        "brand": "Kia",
                        "model": "Cerato",
                        "engineCode": "G4ED",
                        "transmissionCode": "5MT",
                        "drivetrain": "2WD",
                        "decodeSource": "test_cache",
                    }
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        qxb_pipeline._VIN_DECODE_MEMORY.clear()
        with mock.patch("urllib.request.urlopen") as urlopen_mock:
            out = qxb_pipeline.decode_vin_via_api("https://asia-power.com", vin, root=root)
        urlopen_mock.assert_not_called()
        self.assertTrue(out.get("ok"))
        self.assertEqual(out.get("engineCode"), "G4ED")

    def test_normalize_vin_strict_fixes_ocr_o(self) -> None:
        fixed = qxb_pipeline.normalize_vin_strict("LGBP12EO9BY052062")
        self.assertEqual(fixed, "LGBP12E09BY052062")
        self.assertTrue(qxb_pipeline.VIN_STRICT.match(fixed))
        rec = {"brand": "Kia", "model": "Rio", "engineCode": "", "transmissionCode": ""}
        qxb_pipeline.apply_vin_decode_to_record(rec, {
            "ok": True,
            "engineCode": "G4EE",
            "transmissionCode": "5MT",
            "drivetrain": "2WD",
        })
        self.assertEqual(rec["engineCode"], "G4EE")
        self.assertEqual(rec["transmissionCode"], "5MT")
        self.assertIn("G4EE", rec["title"])

    def test_resolve_submission_id_after_reupload(self) -> None:
        self.assertEqual(qxb_pipeline.resolve_submission_id(3, {}), "QXB-0003")
        self.assertEqual(qxb_pipeline.resolve_submission_id(3, {"resubmitCount": 1}), "QXB-0003-R1")

    def test_qxb_tool_status(self) -> None:
        ctx = self._make_ctx()
        with mock.patch.object(qxb_pipeline, "load_context", return_value=ctx):
            result = QXB_TOOL.run("status", [], dry_run=True)
        self.assertTrue(result.ok)
        self.assertIn("QXB Upload Queue", result.output)

    def test_listing_to_submission_maps_labels(self) -> None:
        record = {
            "submissionId": "QXB-0003",
            "stockId": "QXB0003",
            "brand": "Kia",
            "brandSlug": "kia",
            "model": "Cerato",
            "photos": [
                {"label": "Front view", "url": "https://asia-power.com/uploads/pending/photos/a.jpg"},
                {"label": "VIN / chassis plate", "url": "https://asia-power.com/uploads/pending/photos/b.jpg"},
            ],
        }
        sub = qxb_pipeline.listing_to_submission(record)
        self.assertEqual(sub["reviewStatus"], "pending")
        self.assertEqual(sub["photos"][0]["label"], "Vehicle Front")
        self.assertEqual(sub["photos"][1]["label"], "VIN Plate")
        self.assertEqual(sub["qxbStockId"], "QXB0003")

    def test_submit_row_for_review_posts_and_updates_queue(self) -> None:
        ctx = self._make_ctx()
        record = {
            "submissionId": "QXB-0003",
            "stockId": "QXB0003",
            "brand": "Kia",
            "brandSlug": "kia",
            "model": "Cerato",
            "photos": [
                {"label": "Front view", "url": "https://asia-power.com/uploads/pending/photos/a.jpg"},
            ],
        }
        ctx.approved.append(record)
        with mock.patch.dict("os.environ", {"SUPPLIER_UPLOAD_KEY": "test-key"}):
            with mock.patch.object(qxb_pipeline, "_get_upload_token", return_value="tok"):
                with mock.patch.object(
                    qxb_pipeline,
                    "_request_json",
                    return_value={"submissionId": "QXB-0003", "reviewStatus": "pending"},
                ) as req:
                    result = qxb_pipeline.submit_row_for_review(ctx, 3)
        self.assertTrue(result["ok"])
        self.assertEqual(ctx.queue["rows"]["3"]["status"], "pending_review")
        req.assert_called_once()
        call_url = req.call_args[0][0]
        self.assertIn("/api/half-cuts/submissions", call_url)

    def test_audit_staged_vs_pending_review(self) -> None:
        ctx = self._make_ctx()
        record = {
            "stockId": "QXB0003",
            "slug": "kia-cerato",
            "photos": [{"url": "https://asia-power.com/uploads/pending/photos/a.jpg"}],
        }
        ctx.approved.append(record)
        staged = qxb_pipeline.audit_row(ctx, 3, record=record)
        self.assertEqual(staged["stage"], "staged_pending_promote")
        qxb_pipeline.set_row_status(ctx, 3, "pending_review")
        ctx.queue["rows"]["3"]["submissionId"] = "QXB-0003"
        pending = qxb_pipeline.audit_row(ctx, 3, record=record)
        self.assertEqual(pending["stage"], "pending_review")

    def test_load_vins_skips_corrupt_csv_line(self) -> None:
        vin_csv = Path(self.tmp.name) / "vins.csv"
        vin_csv.write_bytes(
            b"row,model,vin,image_path,confidence\r\n"
            b"387,Toyota,JTDBR32E920012345,/a.jpg,high\r\n"
            b"\x88,,,none\r\n"
            b"23,Honda,JHMFA36259S012345,/b.jpg,high\r\n"
        )
        vins = qxb_pipeline.load_vins(vin_csv)
        self.assertEqual(set(vins.keys()), {23, 387})

    def test_write_vin_csv_row_rewrites_without_corrupt_line(self) -> None:
        vin_csv = Path(self.tmp.name) / "vins.csv"
        vin_csv.write_bytes(
            b"row,model,vin,image_path,confidence\r\n"
            b"387,Toyota,JTDBR32E920012345,/a.jpg,high\r\n"
            b"\x88,,,none\r\n"
        )
        qxb_pipeline.write_vin_csv_row(
            vin_csv, 388, "Camry", "JT2BF22K130123456", "/c.jpg", "album_ocr:high"
        )
        text = vin_csv.read_text(encoding="utf-8")
        self.assertNotIn("\x88", text)
        vins = qxb_pipeline.load_vins(vin_csv)
        self.assertIn(387, vins)
        self.assertIn(388, vins)
        self.assertEqual(vins[388]["vin"], "JT2BF22K130123456")


    def test_format_vin_decode_error_surfaces_reason(self) -> None:
        msg = qxb_pipeline.format_vin_decode_error({"ok": False, "reason": "rate_limited"})
        self.assertIn("限流", msg)
        self.assertNotEqual(msg, "decode failed")

    def test_fallback_rows_404_407_trims(self) -> None:
        cases = [
            ("现代 胜达经典 2011款 2.4L 舒适版 七座四驱", "Hyundai", "胜达经典", "G4KE", "6AT"),
            ("奔驰 奔驰M级 2008款 ML 350 4MATIC豪华型", "Mercedes-Benz", "E", "M272.967", "7AT"),
            ("日产 奇骏 2010款 2.5L CVT旗舰版 4WD", "Nissan", "X-Trail", "QR25DE", "CVT"),
            ("奔驰 奔驰C级 2008款 C 200K 标准型", "Mercedes-Benz", "E", "M271.951", "5AT"),
        ]
        for trim, brand, model, exp_engine, exp_trans in cases:
            engine = qxb_pipeline.infer_engine_from_trim(trim, brand, model)
            trans = (
                qxb_pipeline.infer_transmission_from_trim(trim)
                or qxb_pipeline.infer_default_transmission(trim, brand, model)
            )
            self.assertEqual(engine, exp_engine, trim)
            self.assertEqual(trans, exp_trans, trim)


class QxbDuplicateVinTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        photos = root / "photos"
        photos.mkdir()
        paths = []
        for i in range(3):
            p = photos / f"{i+1}.jpg"
            p.write_bytes(b"\xff\xd8\xff" + b"x" * 100)
            paths.append(str(p))

        manifest = root / "manifest.csv"
        with manifest.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["row", "local_path", "status", "image_index"],
            )
            writer.writeheader()
            for row_n in (2, 5):
                for i, p in enumerate(paths):
                    writer.writerow({
                        "row": row_n,
                        "local_path": p,
                        "status": "exists",
                        "image_index": i + 1,
                    })

        (root / "brand.json").write_text(
            json.dumps({"起亚": {"english": "Kia"}}),
            encoding="utf-8",
        )
        (root / "model.json").write_text(json.dumps({"kia": {}}), encoding="utf-8")
        (root / "queue.json").write_text(
            json.dumps({"version": "1.0", "rows": {}}),
            encoding="utf-8",
        )
        (root / "approved.json").write_text("[]", encoding="utf-8")
        shared_vin = "LBEXDAEB09X742323"
        (root / "vins.csv").write_text(
            f"row,vin,image_path,confidence\n"
            f"2,{shared_vin},,high\n"
            f"5,{shared_vin},,high\n",
            encoding="utf-8",
        )

        self.decode_patcher = mock.patch.object(
            qxb_pipeline,
            "decode_vin_via_api",
            return_value={
                "ok": True,
                "engineCode": "G4ED",
                "transmissionCode": "5MT",
                "drivetrain": "2WD",
            },
        )
        self.decode_patcher.start()
        self.addCleanup(self.decode_patcher.stop)
        self.price_patcher = mock.patch.object(
            qxb_pipeline,
            "estimate_half_cut_price_usd",
            return_value={"priceUsd": 850, "priceEstimated": True, "method": "catalog_median"},
        )
        self.price_patcher.start()
        self.addCleanup(self.price_patcher.stop)

        self.paths = qxb_pipeline.QxbPaths(
            root=root,
            xlsx=root / "missing.xlsx",
            manifest=manifest,
            vin_csv=root / "vins.csv",
            upload_state=root / "upload-state.json",
            approved_out=root / "approved.json",
            agent_queue=root / "queue.json",
            model_dict=root / "model.json",
            brand_dict=root / "brand.json",
        )
        self.sources = [
            {
                "row": 2,
                "brand_cn": "起亚",
                "trim": "起亚 赛拉图 2008款",
                "description": "测试2",
                "year": 2008,
            },
            {
                "row": 5,
                "brand_cn": "起亚",
                "trim": "起亚 赛拉图 2008款",
                "description": "测试5",
                "year": 2008,
            },
        ]

    def _make_ctx(self) -> qxb_pipeline.PipelineContext:
        with mock.patch.object(qxb_pipeline, "load_rows", return_value=self.sources):
            return qxb_pipeline.load_context(self.paths)

    def test_find_duplicate_vin_other_csv_row(self) -> None:
        ctx = self._make_ctx()
        dup = qxb_pipeline.find_duplicate_vin(ctx, "LBEXDAEB09X742323", exclude_row=5)
        self.assertIsNotNone(dup)
        self.assertEqual(dup["row"], 2)
        self.assertEqual(dup["stockId"], "QXB0002")
        self.assertEqual(dup["source"], "vin_csv")

    def test_find_duplicate_vin_excludes_same_row(self) -> None:
        ctx = self._make_ctx()
        dup = qxb_pipeline.find_duplicate_vin(ctx, "LBEXDAEB09X742323", exclude_row=2)
        self.assertIsNotNone(dup)
        self.assertEqual(dup["row"], 5)
        only_row = qxb_pipeline.PipelineContext(
            paths=ctx.paths,
            sources=ctx.sources,
            manifest=ctx.manifest,
            vins={2: ctx.vins[2]},
            cn_to_en=ctx.cn_to_en,
            cn_to_slug=ctx.cn_to_slug,
            upload_state=ctx.upload_state,
            queue=ctx.queue,
            approved=ctx.approved,
        )
        self.assertIsNone(qxb_pipeline.find_duplicate_vin(only_row, "LBEXDAEB09X742323", exclude_row=2))

    def test_format_duplicate_vin_message(self) -> None:
        msg = qxb_pipeline.format_duplicate_vin_message(
            {"stockId": "QXB0002", "row": 2, "submissionId": "QXB-0002"}
        )
        self.assertIn("此底盘号已上传过，禁止重复上传", msg)
        self.assertIn("QXB0002", msg)
        self.assertIn("row 2", msg)

    def test_inspect_row_blocks_duplicate_vin(self) -> None:
        ctx = self._make_ctx()
        data = qxb_pipeline.inspect_row(ctx, 5)
        self.assertFalse(data["ready"])
        self.assertTrue(any("禁止重复上传" in b for b in data["blockers"]))
        self.assertEqual(data["duplicateVin"]["row"], 2)
        self.assertIn("禁止重复上传", data["duplicateVinMessage"])

    def test_categorize_blocker_duplicate_vin(self) -> None:
        self.assertEqual(
            qxb_pipeline.categorize_blocker("此底盘号已上传过，禁止重复上传（已有 QXB0002 / row 2）"),
            "duplicate_vin",
        )

    def test_submit_row_for_review_blocks_duplicate(self) -> None:
        ctx = self._make_ctx()
        ctx.approved.extend([
            {
                "stockId": "QXB0002",
                "vin": "LBEXDAEB09X742323",
                "submissionId": "QXB-0002",
                "photos": [{"label": "Front view", "url": "https://example.com/a.jpg"}],
            },
            {
                "stockId": "QXB0005",
                "vin": "LBEXDAEB09X742323",
                "submissionId": "QXB-0005",
                "photos": [{"label": "Front view", "url": "https://example.com/b.jpg"}],
            },
        ])
        with mock.patch.dict("os.environ", {"SUPPLIER_UPLOAD_KEY": "test-key"}):
            result = qxb_pipeline.submit_row_for_review(ctx, 5)
        self.assertFalse(result["ok"])
        self.assertIn("禁止重复上传", result["error"])
        self.assertEqual(result["duplicate"]["row"], 2)


class QxbUploadRetryTests(unittest.TestCase):
    def test_is_upload_rate_limited(self) -> None:
        self.assertTrue(qxb_pipeline.is_upload_rate_limited("HTTP 423 on upload-token: Locked"))
        self.assertTrue(qxb_pipeline.is_upload_rate_limited("HTTP 429 on upload-token: Too many requests"))
        self.assertFalse(qxb_pipeline.is_upload_rate_limited("HTTP 403 on upload-token: Forbidden"))

    def test_request_json_retries_upload_token(self) -> None:
        responses = [
            urllib_error_response(423, b"Locked"),
            urllib_error_response(423, b"Locked"),
            json_response(201, b'{"token":"abc"}'),
        ]

        def fake_urlopen(req, timeout=30):
            return responses.pop(0)

        with mock.patch("inventory_core.qxb_pipeline.time.sleep"):
            with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
                out = qxb_pipeline._request_json(
                    "https://example.com/api/half-cuts/upload-token",
                    "POST",
                    {"X-Supplier-Key": "k"},
                    {},
                    max_retries=3,
                    retry_backoff=0.01,
                )
        self.assertEqual(out["token"], "abc")


def urllib_error_response(code: int, body: bytes):
    import io
    import urllib.error

    return urllib.error.HTTPError(
        "https://example.com",
        code,
        "Locked" if code == 423 else "Error",
        {},
        io.BytesIO(body),
    )


def json_response(code: int, body: bytes):
    import io

    class Resp:
        status = code

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return body

    return Resp()


class APInventoryQxbCommandTests(unittest.TestCase):
    def test_qxb_status_command(self) -> None:
        from inventory_core.apinventory_handler import dispatch_apinventory_command

        with mock.patch(
            "inventory_core.apinventory_handler.run_tool",
        ) as mock_tool:
            mock_tool.return_value.output = "QXB Upload Queue"
            out = dispatch_apinventory_command("/qxb status")
        self.assertIn("QXB", out)
        mock_tool.assert_called_once()

    def test_qxb_routes_in_cli(self) -> None:
        from coo_core.cli_router import resolve_agent_id

        self.assertEqual(resolve_agent_id("/qxb status"), "apinventory")


if __name__ == "__main__":
    unittest.main()
