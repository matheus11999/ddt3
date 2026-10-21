"""Cuts the Codex sheet of the POW ready aura (src/game/powReadyAura.ts) into the game strip.

Source: public/assets/combat/source/pow-ready-aura.png, a 3x2 grid of flicker frames of fire painted on flat black.
Fire is light: black becomes transparent by brightness and the colour is un-premultiplied, so the painting keeps its
glow on any background. Every cell keeps its whole canvas (never trimmed per frame) so the loop does not shake.
Run: py scripts/build-pow-aura.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public/assets/combat/source/pow-ready-aura.png'
OUT = ROOT / 'public/assets/combat/pow-ready-aura.png'
COLS, ROWS, SIZE = 3, 2, 256

def unblack(img: Image.Image) -> Image.Image:
    a = np.asarray(img.convert('RGB')).astype(np.float32) / 255.0
    # Near-black noise of the painted background goes fully clear.
    alpha = np.clip((a.max(axis=2) - .035) / .965, 0, 1)
    rgb = np.where(alpha[..., None] > 0, np.clip(a / np.maximum(alpha[..., None], 1e-3), 0, 1), 0)
    return Image.fromarray((np.dstack([rgb, alpha[..., None]]) * 255).round().astype(np.uint8), 'RGBA')

sheet = Image.open(SRC)
cw, ch = sheet.width // COLS, sheet.height // ROWS
strip = Image.new('RGBA', (SIZE * COLS * ROWS, SIZE))
for i in range(COLS * ROWS):
    col, row = i % COLS, i // COLS
    cell = unblack(sheet.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch)))
    # The painter drifts the oval a little from cell to cell: centre every frame on its own bright ring.
    alpha = np.asarray(cell)[..., 3] > 128
    ys, xs = np.nonzero(alpha)
    cx, cy = int(round(xs.mean())), int(round(ys.mean()))
    side = min(cw, ch)
    cell = cell.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)).resize((SIZE, SIZE), Image.LANCZOS)
    strip.paste(cell, (i * SIZE, 0))
OUT.parent.mkdir(parents=True, exist_ok=True)
strip.save(OUT, optimize=True)
print(f'{OUT.relative_to(ROOT)}: {COLS * ROWS} frames of {SIZE}px')
