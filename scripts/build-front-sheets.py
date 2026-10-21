"""Packs a FRONT-view lobby sheet painted by Codex on docs/templates/front-walk.png (3x2 cells of 512 px, magenta,
green head) into public/assets/front/<kind>/<outfit>.png and src/game/frontAtlas.json.

Per frame the atlas keeps the body only (magenta and green removed) and where the green neck ended (the point the
game hangs the front head from), both in cell pixels. headHeight is the green head height (crown to neck stub),
so the game draws the front head at exactly the painted size.
Usage: py scripts/build-front-sheets.py <walk|idle> <outfit-id> <sheet.png>
       py scripts/build-front-sheets.py stand <outfit-id> <painting.png>   (the standing painting of the previews:
       records its collar top, soles and centre in the same index)
"""
import json
import os
import sys

import numpy as np
from PIL import Image

CELL = 512
kind, outfit, path = sys.argv[1], sys.argv[2], sys.argv[3]
index = 'src/game/frontAtlas.json'
data = json.load(open(index, encoding='utf-8')) if os.path.exists(index) else {}


def save():
    with open(index, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, indent=1)
        f.write('\n')


if kind == 'stand':
    im = Image.open(path).convert('RGBA')
    target = f'public/assets/front/{outfit}.png'
    if os.path.abspath(path) != os.path.abspath(target):
        im.save(target)
    al = np.asarray(im)[..., 3] > 128
    ys, xs = np.nonzero(al)
    soles = int(ys.max())
    feet_x = int(xs[ys > soles - 60].mean())
    # The collar: the first row with a wide run of torso over the feet (a raised hand never fills that band).
    band = al[:, max(0, feet_x - 90):feet_x + 90]
    collar_y = int(next(y for y in range(al.shape[0]) if band[y].sum() >= 40))
    row = np.nonzero(band[collar_y + 6])[0] + max(0, feet_x - 90)
    collar = [int(row.mean()), collar_y]
    data.setdefault('stand', {})[outfit] = {'path': f'/assets/front/{outfit}.png', 'collar': collar, 'soles': soles}
    save()
    print(f'{outfit} stand: gola {collar}, pés y={soles}')
    sys.exit()
src = np.asarray(Image.open(path).convert('RGB').resize((CELL * 3, CELL * 2), Image.LANCZOS)).astype(int)
r, g, b = src[..., 0], src[..., 1], src[..., 2]
magenta = (r > 170) & (b > 170) & (g < 110)
green = (g > 170) & (r < 120) & (b < 120)
frames, cells = [], []
for i in range(6):
    x0, y0 = (i % 3) * CELL, (i // 3) * CELL
    gm = green[y0:y0 + CELL, x0:x0 + CELL]
    ys, xs = np.nonzero(gm)
    if not len(ys):
        sys.exit(f'quadro {i + 1}: sem cabeça verde')
    crown, neck_y = int(ys.min()), int(ys.max())
    neck_x = int(round(xs[ys > neck_y - 8].mean()))
    # Codex outlines the green head and darkens its anti-aliased edge: clear a ring around it (the game's head covers it).
    ring = np.zeros_like(gm)
    for dy in range(-9, 10):
        for dx in range(-9, 10):
            if dx * dx + dy * dy <= 81:
                ring |= np.roll(np.roll(gm, dy, axis=0), dx, axis=1)
    body = ~(magenta | green)[y0:y0 + CELL, x0:x0 + CELL] & ~ring
    body[:crown + 20] = False  # stray marks Codex leaves above the head (the head covers that band anyway)
    # soften the key edge: pixels next to magenta lose part of their alpha
    alpha = (body * 255).astype(np.uint8)
    rgba = np.dstack([src[y0:y0 + CELL, x0:x0 + CELL].astype(np.uint8), alpha])
    by = np.nonzero(body.any(axis=1))[0]
    frames.append({'neck': [neck_x, neck_y], 'headHeight': neck_y - crown, 'soles': int(by.max())})
    cells.append(Image.fromarray(rgba, 'RGBA'))
# Codex sometimes paints a row lower than the other: every frame stands on the same ground line.
ground = max(f['soles'] for f in frames)
atlas = Image.new('RGBA', (CELL * 3, CELL * 2), (0, 0, 0, 0))
for i, c in enumerate(cells):
    shift = ground - frames[i]['soles']
    frames[i]['neck'][1] += shift
    frames[i]['soles'] = ground
    moved = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    moved.alpha_composite(c.crop((0, 0, CELL, CELL - shift)), (0, shift))
    atlas.alpha_composite(moved, ((i % 3) * CELL, (i // 3) * CELL))
os.makedirs(f'public/assets/front/{kind}', exist_ok=True)
atlas.save(f'public/assets/front/{kind}/{outfit}.png')
index = 'src/game/frontAtlas.json'
data = json.load(open(index, encoding='utf-8')) if os.path.exists(index) else {}
data.setdefault(kind, {})[outfit] = {'path': f'/assets/front/{kind}/{outfit}.png', 'cell': CELL, 'frames': frames}
with open(index, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(data, f, indent=1)
    f.write('\n')
heights = [f['headHeight'] for f in frames]
print(f'{outfit} {kind}: OK -> public/assets/front/{kind}/{outfit}.png (cabeça {min(heights)}-{max(heights)} px)')
