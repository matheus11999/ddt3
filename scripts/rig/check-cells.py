"""Rig v2: per-cell check of a body sheet (outfit) against the mold, so a bad cell is caught and redone alone.

Each painted cell is moved (up to +-12 px) to sit best on the gray mannequin of the mold, then scored by how much of
the mannequin it covers and how much it spills outside. Cells under the bar are listed with the plate that holds them
(plates.py layout) so only that plate goes back to Codex.
  py scripts/rig/check-cells.py <game|virtual|show> <sex> <sheet.png> [--fix]   (--fix writes the moved cells back)
Exit code 1 when some cell fails."""
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, 'scripts/rig')
from plates import GRIDS, layout  # noqa: E402

context, sex, path = sys.argv[1:4]
(w, h), cols, rows, used = GRIDS[context]
mold = np.asarray(Image.open(f'docs/templates/rig/{context}-{sex}.png').convert('RGB')).astype(int)
body = (np.ptp(mold, axis=2) < 12) & (mold[..., 0] > 120) & (mold[..., 0] < 180)
sheet = Image.open(path).convert('RGBA')
alpha = np.asarray(sheet.split()[3]) > 100
plate_of = {idx: n + 1 for n, plate in enumerate(layout(context)[0]) for idx, _, _ in plate}
bad = []
for i in used:
    x0, y0 = i % cols * w, i // cols * h
    b, a = body[y0:y0 + h, x0:x0 + w], alpha[y0:y0 + h, x0:x0 + w]
    if b.sum() == 0:
        continue
    best = (-1, 0, 0, 0, 0)
    for dy in range(-12, 13, 2):
        for dx in range(-12, 13, 2):
            s = np.roll(np.roll(a, dy, 0), dx, 1)
            cover = (s & b).sum() / b.sum()
            spill = (s & ~b).sum() / max(1, s.sum())
            score = cover - spill
            if score > best[0]:
                best = (score, dx, dy, cover, spill)
    score, dx, dy, cover, spill = best
    ok = cover >= 0.85 and spill <= 0.4
    print(f'cell {i:2d} (plate {plate_of[i]}): covers {cover:.0%} of the mannequin, {spill:.0%} outside, moved ({dx},{dy}) {"ok" if ok else "REDO"}')
    if not ok:
        bad.append(i)
    if '--fix' in sys.argv and (dx or dy):
        # moved inside its own cell: a cell on the sheet edge moved outwards used to be wiped and never put back
        moved = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        moved.paste(sheet.crop((x0, y0, x0 + w, y0 + h)), (dx, dy))
        sheet.paste(moved, (x0, y0))
if '--fix' in sys.argv:
    sheet.save(path)
plates = sorted({plate_of[i] for i in bad})
print('ALL OK' if not bad else f'REDO plates {plates} (cells {bad})')
sys.exit(1 if bad else 0)
