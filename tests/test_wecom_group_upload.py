"""Tests for WeCom group upload → 子龙 QXB MVP (no network)."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from integrations import wecom_group_upload as wgu
from integrations.wecom_zijing_handler import dispatch_wecom_message, handle_wecom_xml_message


class WeComGroupUploadTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.root_patcher = mock.patch.object(wgu, "ROOT", root)
        self.root_patcher.start()
        self.addCleanup(self.root_patcher.stop)

        wgu.SESSIONS_PATH = root / "data/wecom/group-sessions.json"
        wgu.GROUP_LEARNINGS_PATH = root / "data/knowledge-base/wecom-group-learnings.json"
        wgu.PHOTO_ROOT = root / "data/qxb-photos"
        wgu.PHOTO_ROOT.mkdir(parents=True)

        suppliers = root / "config/wecom-group-suppliers.json"
        suppliers.parent.mkdir(parents=True)
        suppliers.write_text(
            json.dumps({
                "groups": {
                    "wr1": {"supplier_id": "s1", "supplier_name": "测试供应商"},
                }
            }),
            encoding="utf-8",
        )
        wgu.SUPPLIERS_PATH = suppliers

    def test_is_wecom_upload_command(self) -> None:
        self.assertTrue(wgu.is_wecom_upload_command("子龙032 上传"))
        self.assertTrue(wgu.is_wecom_upload_command("@AsiaPower 上传 QXB0032"))
        self.assertFalse(wgu.is_wecom_upload_command("你好"))

    def test_ingest_group_image_accumulates_session(self) -> None:
        reply = wgu.ingest_group_image(
            chat_id="wr1",
            user_id="u1",
            media_id="m1",
            image_bytes=b"\xff\xd8\xff" + b"x" * 50,
        )
        self.assertIn("第 1 张", reply)
        sess = wgu.get_session("wr1")
        self.assertEqual(len(sess["pendingImages"]), 1)
        self.assertEqual(sess["supplierName"], "测试供应商")

    @mock.patch("inventory_core.qxb_pipeline.load_context")
    @mock.patch("inventory_core.qxb_pipeline.inspect_row")
    @mock.patch("inventory_core.qxb_pipeline.audit_row")
    def test_process_upload_commits_photos(
        self,
        mock_audit: mock.MagicMock,
        mock_inspect: mock.MagicMock,
        mock_ctx: mock.MagicMock,
    ) -> None:
        wgu.ingest_group_image(
            chat_id="wr1",
            user_id="u1",
            media_id="m1",
            image_bytes=b"\xff\xd8\xff" + b"a" * 50,
        )
        manifest = wgu.ROOT / "manifest.csv"
        photos = wgu.PHOTO_ROOT / "row-0005_起亚_测试"
        photos.mkdir(parents=True)

        class FakePaths:
            manifest = wgu.ROOT / "manifest.csv"

        fake_paths = FakePaths()
        fake_paths.manifest = manifest
        class FakeCtx:
            paths = fake_paths
            sources = [{"row": 5, "brand_cn": "起亚", "trim": "测试", "description": "测试"}]
            manifest = {}

        mock_ctx.return_value = FakeCtx()
        mock_inspect.return_value = {
            "ready": True,
            "blockers": [],
            "fields": {"vin": "TESTVIN1234567890", "engineCode": "G4FC"},
        }
        mock_audit.return_value = {"stage": "pending"}

        reply = wgu.process_wecom_upload_command("子龙005 上传", chat_id="wr1", user_id="u1")
        self.assertIn("QXB0005", reply)
        self.assertIn("CEO", reply)
        sess = wgu.get_session("wr1")
        self.assertEqual(sess["pendingImages"], [])

    def test_handle_image_message(self) -> None:
        msg = {
            "MsgType": "image",
            "ChatType": "group",
            "ChatId": "wr1",
            "FromUserName": "u1",
            "MediaId": "media123",
        }
        cfg = mock.MagicMock()
        cfg.allowed_chat_ids = frozenset()
        cfg.allowed_user_ids = frozenset()
        cfg.require_at_mention = True

        with mock.patch(
            "integrations.wecom_client.download_media",
            return_value=b"\xff\xd8\xff" + b"b" * 20,
        ):
            reply = wgu.handle_group_image_message(
                msg, cfg=cfg, download_media=lambda *_a, **_k: b"\xff\xd8\xff" + b"b" * 20,
            )
        self.assertIn("子龙已收到", reply)

    def test_dispatch_upload_command(self) -> None:
        wgu.ingest_group_image(
            chat_id="wr1",
            user_id="u1",
            media_id="m1",
            image_bytes=b"\xff\xd8\xff" + b"c" * 20,
        )
        with mock.patch(
            "integrations.wecom_zijing_handler.process_wecom_upload_command",
            return_value="mock upload ok",
        ) as proc:
            out = dispatch_wecom_message("子龙005 上传", user_id="u1", chat_id="wr1")
        self.assertEqual(out, "mock upload ok")
        proc.assert_called_once()


class WeComHandlerRoutingTests(unittest.TestCase):
    def test_upload_routes_to_apinventory_via_resolve(self) -> None:
        from integrations.wecom_zijing_handler import _route_agent_id

        self.assertEqual(_route_agent_id("上传任务 状态"), "apinventory")
        self.assertEqual(_route_agent_id("客户询价"), "apsales")

    def test_image_xml_handler(self) -> None:
        cfg = mock.MagicMock()
        cfg.allowed_chat_ids = frozenset({"wr1"})
        cfg.allowed_user_ids = frozenset()
        cfg.require_at_mention = True
        msg = {
            "MsgType": "image",
            "ChatType": "group",
            "ChatId": "wr1",
            "FromUserName": "u1",
            "MediaId": "mid",
        }
        with mock.patch(
            "integrations.wecom_zijing_handler.handle_group_image_message",
            return_value="ok image",
        ):
            reply = handle_wecom_xml_message(msg, cfg=cfg)
        self.assertEqual(reply, "ok image")


if __name__ == "__main__":
    unittest.main()
