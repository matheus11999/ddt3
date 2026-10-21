"""Cuts the Codex sheets of the POW ready effects (src/game/powReadyAura.ts) into game strips.

Sources: public/assets/combat/source/pow-ready-<name>.png, a 3x2 grid of looping frames painted on flat black.
Light is drawn on black: black becomes transparent by brightness and the colour is un-premultiplied, so the painting
keeps its glow on any background. Every cell keeps its whole canvas so the loop does not shake; `ring` recentres each
frame on its bright ring, `base` moves the sheet so its lowest light sits on the ground line, and `orb` puts the white-hot core at the same spot (the painter drifts a little per cell).
Run: py scripts/build-pow-aura.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public/assets/combat/source'
OUT = ROOT / 'public/assets/combat'
COLS, ROWS = 3, 2
# name: (strip cell size, how each frame is aligned)
SHEETS = {'aura': (256, 'ring'), 'mantle': (256, 'base'), 'orb': (128, 'orb'), 'crown': (128, 'ring'), 'wings': (256, 'base'),
          'whirl': (256, 'base'), 'sparks': (256, 'base'), 'lightning': (256, 'base'), 'phoenix': (256, 'base'), 'dragon': (256, 'base'),
          'spirit': (256, 'base'), 'petals': (256, 'base'), 'crystals': (256, 'base'), 'stars': (128, 'ring'),
          'aura-gold': (256, 'body'), 'aura-soft': (256, 'body'), 'aura-ember': (256, 'body')}
# `body` auras are painted around the green silhouette of the lying fighter (pow-ready-silhouette.png, drawn 2.6x at
# x=256, feet at y=452 of each cell): the green goes clear and every frame is moved so its silhouette sits where the
# template's does.
SILHOUETTE = SRC / 'pow-ready-silhouette.png'
# `base` looks rise from the ground line: the lowest light of the whole sheet lands BASE px above the cell bottom.
BASE = 60
ORB_CORE = (320 / 512, .5)

def unblack(img: Image.Image) -> Image.Image:
    a = np.asarray(img.convert('RGB')).astype(np.float32) / 255.0
    # Near-black noise of the painted background goes fully clear.
    alpha = np.clip((a.max(axis=2) - .035) / .965, 0, 1)
    rgb = np.where(alpha[..., None] > 0, np.clip(a / np.maximum(alpha[..., None], 1e-3), 0, 1), 0)
    return Image.fromarray((np.dstack([rgb, alpha[..., None]]) * 255).round().astype(np.uint8), 'RGBA')

def green(img: Image.Image) -> np.ndarray:
    a = np.asarray(img.convert('RGB')).astype(np.int16)
    return (a[..., 1] > 150) & (a[..., 1] > a[..., 0] + 60) & (a[..., 1] > a[..., 2] + 60)

def unbody(img: Image.Image) -> Image.Image:
    a = np.asarray(img.convert('RGB')).copy()
    a[green(img)] = 0
    return unblack(Image.fromarray(a))

def centre(cell: Image.Image, mode: str) -> tuple[int, int]:
    alpha = np.asarray(cell)[..., 3]
    if mode == 'ring':
        ys, xs = np.nonzero(alpha > 128)
        return int(round(xs.mean())), int(round(ys.mean()))
    if mode == 'orb':
        ys, xs = np.nonzero(alpha > 250)
        return int(round(xs.mean() + cell.width * (.5 - ORB_CORE[0]))), int(round(ys.mean() + cell.height * (.5 - ORB_CORE[1])))
    if mode == 'base':
        # Each frame centred sideways on its own light (the painter drifts); the height stays one shift for the sheet.
        xs = np.nonzero(alpha > 40)[1]
        return int(round(xs.mean())), cell.height // 2
    return cell.width // 2, cell.height // 2

for name, (size, mode) in SHEETS.items():
    source = SRC / f'pow-ready-{name}.png'
    if not source.exists():
        continue
    sheet = Image.open(source)
    cw, ch = sheet.width // COLS, sheet.height // ROWS
    crops = [sheet.crop(((i % COLS) * cw, (i // COLS) * ch, (i % COLS + 1) * cw, (i // COLS + 1) * ch)) for i in range(COLS * ROWS)]
    cells = [(unbody if mode == 'body' else unblack)(crop) for crop in crops]
    if mode == 'body':
        template = green(Image.open(SILHOUETTE).crop((0, 0, cw, ch)))
        ty, tx = (v.mean() for v in np.nonzero(template))
        # Where each frame's own silhouette sits against the template's, so the cut keeps the body in one place.
        offsets = [(lambda ys, xs: (int(round(xs.mean() - tx)), int(round(ys.mean() - ty))))(*np.nonzero(green(crop))) for crop in crops]
    # One shift for the whole sheet, so the loop never jumps.
    lift = ch - BASE - max(int(np.nonzero((np.asarray(cell)[..., 3] > 40).any(axis=1))[0].max()) for cell in cells) if mode == 'base' else 0
    strip = Image.new('RGBA', (size * COLS * ROWS, size))
    for i in range(COLS * ROWS):
        col, row = i % COLS, i // COLS
        cell = cells[i]
        cx, cy = centre(cell, mode)
        cy -= lift
        if mode == 'body':
            cx, cy = cw // 2 + offsets[i][0], ch // 2 + offsets[i][1]
        side = min(cw, ch)
        cell = cell.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)).resize((size, size), Image.LANCZOS)
        strip.paste(cell, (i * size, 0))
    out = OUT / f'pow-ready-{name}.png'
    strip.save(out, optimize=True)
    print(f'{out.relative_to(ROOT)}: {COLS * ROWS} frames of {size}px')
