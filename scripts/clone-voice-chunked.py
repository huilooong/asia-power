import sys, os
import perth, torchaudio, torch
# PerthImplicitWatermarker fails to load in this env; skip watermark
perth.PerthImplicitWatermarker = perth.DummyWatermarker

from chatterbox.tts import ChatterboxTTS

REF = "/Users/longhui/Desktop/AsiaPower/uploads/videos/review/voice-source-candidates/20260705-drive-dismantling/selected/longhui-chinese-english-reference-20s.wav"
OUTDIR = "/Users/longhui/Desktop/AsiaPower/uploads/videos/raw/tiktok-inbox/2026-07-06-corolla09-v2"

# One short sentence per line -> generate separately, then concat
LINES = [
    "Ghana mechanics, pick your part from China. We handle the rest.",
    "Browse our website. Real inventory, straight from China.",
    "Engines, gearboxes, half-cuts. You see exactly what is in stock.",
    "Find what you need, tell us which piece you want.",
    "We disassemble it, ship it, and clear customs for you.",
    "All you do is pick up at our Ghana office when it arrives.",
    "No sourcing headache. No customs stress. We sort everything.",
    "Got a request not on the site? Leave us a message, we will find it.",
    "Shop now at asia power dot com.",
]

model = ChatterboxTTS.from_pretrained(device="cpu")
sr = model.sr
gap = torch.zeros(1, int(sr * 0.35))  # 350ms pause between lines
segs = []
for i, line in enumerate(LINES):
    print(f"[{i+1}/{len(LINES)}] {line}", flush=True)
    wav = model.generate(line, audio_prompt_path=REF, exaggeration=0.4, cfg_weight=0.5)
    torchaudio.save(f"{OUTDIR}/clone-seg-{i:02d}.wav", wav, sr)
    segs.append(wav)
    if i < len(LINES) - 1:
        segs.append(gap)

full = torch.cat(segs, dim=1)
torchaudio.save(f"{OUTDIR}/voiceover-cloned.wav", full, sr)
dur = full.shape[1] / sr
print(f"DONE total={dur:.1f}s sr={sr}", flush=True)
