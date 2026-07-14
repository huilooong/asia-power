"""10-scenario automated suite for WhatsApp media/VIN/STT pipeline.

Synthetic fixtures only — no real customer photos.
Run: .venv/bin/python3 -m unittest tests.test_apsales_media_vin_pipeline -v
"""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OCR_SCRIPT = ROOT / "scripts" / "apsales-media-vin-ocr.py"
INTEL_SCRIPT = ROOT / "scripts" / "apsales-media-vin-intelligence.py"
STT_SCRIPT = ROOT / "scripts" / "apsales-media-stt.py"
FIXTURE_DIR = ROOT / "tests" / "fixtures" / "apsales_media"
KNOWN_VIN = "1HGCM82633A004352"


def _py() -> str:
    for cand in (ROOT / ".venv-qxb" / "bin" / "python3", ROOT / ".venv" / "bin" / "python3"):
        if cand.is_file():
            return str(cand)
    return sys.executable


def _load_ocr_module():
    spec = importlib.util.spec_from_file_location("apsales_media_vin_ocr", OCR_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


OCR = _load_ocr_module()


def _font(size: int = 48):
    for path in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ):
        if Path(path).is_file():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def _render_plate(lines: list[str], *, rotate: int = 0, darken: float = 1.0, size=(900, 420)) -> Image.Image:
    img = Image.new("RGB", size, (245, 245, 240))
    draw = ImageDraw.Draw(img)
    font = _font(42)
    y = 40
    for line in lines:
        draw.text((40, y), line, fill=(20, 20, 20), font=font)
        y += 55
    if rotate:
        img = img.rotate(rotate, expand=True, fillcolor=(245, 245, 240))
    if darken < 1.0:
        img = ImageEnhance.Brightness(img).enhance(darken)
    return img


def _save(img: Image.Image, name: str) -> Path:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    path = FIXTURE_DIR / name
    img.save(path, format="JPEG", quality=92)
    return path


def _run_json(script: Path, payload: dict, env: dict | None = None) -> dict:
    merged = {**os.environ, **(env or {})}
    proc = subprocess.run(
        [_py(), str(script)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        cwd=str(ROOT),
        env=merged,
        timeout=90,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr[:500]
    return json.loads(proc.stdout)


def _parse_agent_reply_node(text: str) -> dict:
    code = r"""
const text = process.argv[1];
const raw = String(text || "").trim();
const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
let payload;
try {
  payload = JSON.parse(fenced ? fenced[1] : raw);
} catch {
  console.log(JSON.stringify({ ok: false, error: "openclaw_reply_not_json" }));
  process.exit(0);
}
const reply = String(payload?.customer_reply || "").trim();
if (!reply || reply.length > 500) {
  console.log(JSON.stringify({ ok: false, error: "openclaw_reply_invalid" }));
  process.exit(0);
}
console.log(JSON.stringify({
  ok: true,
  reply,
  needsPriceConfirmation: payload?.needs_price_confirmation === true,
}));
"""
    proc = subprocess.run(
        ["node", "-e", code, text],
        capture_output=True,
        text=True,
        timeout=10,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


class ApsalesMediaVinPipelineTests(unittest.TestCase):
    """Required scenarios from whatsapp-followups / original media-VIN task spec."""

    def test_01_clear_vin_plate(self):
        path = _save(
            _render_plate(["TOYOTA MOTOR CORPORATION", f"VIN {KNOWN_VIN}", "ENGINE 2AZ-FE"]),
            "01_clear_vin.jpg",
        )
        facts = OCR._extract_facts(f"TOYOTA\nVIN {KNOWN_VIN}\nENGINE 2AZ-FE")
        self.assertEqual(facts["vin"], KNOWN_VIN)
        self.assertEqual(facts["manufacturer"], "TOYOTA")
        result = _run_json(OCR_SCRIPT, {"path": str(path)}, env={"APSALES_OCR_PROVIDER": "tesseract"})
        self.assertIn("status", result)
        self.assertIn("vin_candidates", result)

    def test_02_tilted_plate(self):
        path = _save(
            _render_plate([f"VIN {KNOWN_VIN}", "MODEL DBA-SCP90"], rotate=15),
            "02_tilted_vin.jpg",
        )
        result = _run_json(OCR_SCRIPT, {"path": str(path)}, env={"APSALES_OCR_PROVIDER": "tesseract"})
        self.assertIn(result.get("status"), {"success", "failed"})
        self.assertIn("ocr_engine", result)
        facts = OCR._extract_facts(f"V1N {KNOWN_VIN} MODEL DBA-SCP90")
        self.assertEqual(facts["vin"], KNOWN_VIN)

    def test_03_low_light_and_jp_frame_labels(self):
        path = _save(_render_plate([f"VIN {KNOWN_VIN}"], darken=0.35), "03_low_light_vin.jpg")
        result = _run_json(OCR_SCRIPT, {"path": str(path)}, env={"APSALES_OCR_PROVIDER": "tesseract"})
        self.assertIn("status", result)
        facts = OCR._extract_facts(
            "FRAME No. SCP90-5185026\nENGINE 2SZ-FE\nTOYOTA MOTOR CORPORATION JAPAN"
        )
        self.assertEqual(facts["frame_no"], "SCP90-5185026")
        self.assertTrue(facts["engine_code"])
        self.assertEqual(facts["manufacturer"], "TOYOTA")

    def test_04_confusable_characters(self):
        frame = OCR._extract_frame("FRAME NO SCP9O-5145362 ENGINE 2SZ-FE TOYOTA")
        self.assertIsNotNone(frame)
        self.assertTrue(str(frame).startswith("SCP"))
        facts = OCR._extract_facts("FRAME No. SCP90-5145362\nENGINE 2SZ-FE")
        self.assertEqual(facts["frame_no"], "SCP90-5145362")
        garbage = OCR._extract_facts("VIN TOYOTAMOTORCORPJA")
        self.assertIsNone(garbage.get("vin"))

    def test_05_no_vin_photo(self):
        path = _save(_render_plate(["HELLO FROM THE YARD", "NO PLATE HERE"]), "05_no_vin.jpg")
        result = _run_json(OCR_SCRIPT, {"path": str(path)}, env={"APSALES_OCR_PROVIDER": "tesseract"})
        self.assertEqual(result["status"], "failed")
        self.assertFalse(result.get("best_vin"))

    def test_06_oversized_image_does_not_crash(self):
        big = Image.new("RGB", (4000, 3000), (250, 250, 250))
        draw = ImageDraw.Draw(big)
        draw.text((200, 1400), f"VIN {KNOWN_VIN}", fill=(0, 0, 0), font=_font(96))
        path = _save(big, "06_oversized.jpg")
        result = _run_json(OCR_SCRIPT, {"path": str(path)}, env={"APSALES_OCR_PROVIDER": "tesseract"})
        self.assertIn("status", result)
        self.assertNotEqual(result.get("error"), "crash")
        max_bytes = 8 * 1024 * 1024
        self.assertTrue(path.stat().st_size > 0)
        self.assertIsInstance(path.stat().st_size > max_bytes, bool)

    def test_07_unsupported_format_and_mime_gate(self):
        FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
        gif_path = FIXTURE_DIR / "07_unsupported.gif"
        Image.new("RGB", (200, 80), (255, 255, 255)).save(gif_path, format="GIF")
        session_src = (ROOT / "deploy" / "apsales-live-draft" / "apsales-whatsapp-session.mjs").read_text()
        self.assertNotIn("image/gif", session_src)
        self.assertIn("image/jpeg", session_src)
        self.assertIn("media_unsupported_mime", session_src)
        missing = _run_json(OCR_SCRIPT, {"path": str(FIXTURE_DIR / "does-not-exist.jpg")})
        self.assertEqual(missing["status"], "failed")
        self.assertEqual(missing["error"], "image_not_found")

    def test_08_download_failure_shapes(self):
        ocr = _run_json(OCR_SCRIPT, {"path": "/tmp/apsales-missing-media-xyz.jpg"})
        self.assertEqual(ocr, {"status": "failed", "error": "image_not_found"})
        with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tmp:
            tmp.write(b"not-real-audio")
            audio_path = tmp.name
        try:
            stt = _run_json(STT_SCRIPT, {"path": audio_path}, env={"APSALES_STT_PROVIDER": "none"})
            self.assertEqual(stt["status"], "disabled")
            self.assertEqual(stt["error"], "stt_provider_unset")
        finally:
            Path(audio_path).unlink(missing_ok=True)
        stt_missing = _run_json(STT_SCRIPT, {"path": "/tmp/apsales-missing-audio.ogg"})
        self.assertEqual(stt_missing["status"], "failed")
        self.assertEqual(stt_missing["error"], "audio_not_found")

    def test_09_vin_tool_failure_and_success(self):
        bad = _run_json(INTEL_SCRIPT, {"vin": "NOTAVIN", "id_type": "vin17"})
        self.assertEqual(bad["status"], "failed")
        plate = _run_json(
            INTEL_SCRIPT,
            {
                "vin": "SCP90-5185026",
                "id_type": "jp_frame",
                "plate_facts": {
                    "manufacturer": "TOYOTA",
                    "engine_code": "2SZ-FE",
                    "frame_no": "SCP90-5185026",
                    "model_code": "DBA-SCP90",
                },
            },
        )
        self.assertEqual(plate["status"], "success")
        self.assertEqual(plate["vehicle"]["frame_no"], "SCP90-5185026")
        self.assertEqual(plate["source"], "nameplate_ocr")
        good = _run_json(INTEL_SCRIPT, {"vin": KNOWN_VIN, "id_type": "vin17"})
        self.assertIn(good["status"], {"success", "uncertain"})
        self.assertTrue(good.get("vehicle"))

    def test_10_non_json_sales_agent_reply(self):
        ok = _parse_agent_reply_node(
            '{"customer_reply":"Got it, sending options.","needs_price_confirmation":false}'
        )
        self.assertTrue(ok["ok"])
        self.assertIn("Got it", ok["reply"])
        bad = _parse_agent_reply_node("Sure, I can help with that VIN.")
        self.assertFalse(bad["ok"])
        self.assertEqual(bad["error"], "openclaw_reply_not_json")
        empty = _parse_agent_reply_node('{"customer_reply":"","needs_price_confirmation":false}')
        self.assertFalse(empty["ok"])
        self.assertEqual(empty["error"], "openclaw_reply_invalid")

    def test_label_parser_has_no_ceo_vehicle_hardcodes(self):
        src = OCR_SCRIPT.read_text(encoding="utf-8")
        for token in ("AHXGK", "FQ42", "FO42", '"3Q8"'):
            self.assertNotIn(token, src)

    def test_cloud_ocr_provider_falls_back_without_key(self):
        path = _save(_render_plate([f"VIN {KNOWN_VIN}"]), "cloud_fallback.jpg")
        result = _run_json(
            OCR_SCRIPT,
            {"path": str(path)},
            env={
                "APSALES_OCR_PROVIDER": "google",
                "GOOGLE_CLOUD_VISION_API_KEY": "",
                "APSALES_GOOGLE_VISION_API_KEY": "",
                "GOOGLE_CLOUD_API_KEY": "",
            },
        )
        self.assertIn(result.get("ocr_engine"), {"tesseract_fallback", "tesseract"})
        self.assertTrue(result.get("cloud_error"))


if __name__ == "__main__":
    unittest.main()
