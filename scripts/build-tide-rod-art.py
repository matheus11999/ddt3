#!/usr/bin/env python3
"""Vara das Marés (tide-rod): cuts the three sheets the Codex painted on magenta (docs/tide-rod.md "Arte")
into the weapon kit files.

  fish-sheet.png   4 rows (phases +0, +10, +12, +15) x 4 tail-swish frames: the normal shot, animated
  shark-sheet.png  same grid: the POW shark, animated
  fx-sheet.png     4 columns (phases) x 3 rows: cast splash, normal splash, POW wave

Writes public/assets/weapons/tide-rod/projectile/{normal,pow}-<stage>.png (horizontal strips), the tide-rod
entry of src/game/projectileStrips.json, and the atlases effects.png (fish still, cast, splash) and
pow.png (shark still, wave) in the 362 px cells of shared/weaponKit.ts.

  py scripts/build-tide-rod-art.py public/assets/weapons/tide-rod/source
"""
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('cut', ROOT / 'scripts' / 'cut-pet-sheet.py')
cut = importlib.util.module_from_spec(spec); spec.loader.exec_module(cut)

WEAPON = 'tide-rod'
STAGES = [0, 10, 12, 15]
MAX_SIDE = 192
CELL = 362
FPS = 12
# The shark flies this much bigger than the fish (the strip width is the fish's times this).
POW_SCALE = 1.4
OUT = ROOT / 'public' / 'assets' / 'weapons' / WEAPON


def cells(path, cols, rows, body_only=False):
    """Every cell's sprite: magenta keyed out, the biggest painted piece whose centre lies in a grid cell is that
    cell's body, and every loose drop joins the nearest body (none farther than 60 px), so a fin crossing the
    grid line stays whole and a neighbour's splash never leaks in."""
    rgba = cut.unkey(str(path))
    image = Image.fromarray(rgba, 'RGBA')
    h, w = rgba.shape[:2]
    cw, ch = w / cols, h / rows
    # Pieces are found on their solid paint, so a faint halo never glues a loose drop to the body; every soft
    # edge pixel then joins the nearest piece (up to 10 px away).
    alpha = rgba[..., 3]
    # An opening also cuts the thin necks where a drop just touches a fin.
    solid = ndimage.binary_opening(alpha > 160, structure=np.ones((3, 3)), iterations=4)
    labels, count = ndimage.label(solid, structure=np.ones((3, 3)))
    distance, (iy, ix) = ndimage.distance_transform_edt(labels == 0, return_indices=True)
    labels = np.where((alpha > 0) & (distance <= 10), labels[iy, ix], 0)
    slices = ndimage.find_objects(labels)
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, count + 1))
    boxes = [(sl[1].start, sl[0].start, sl[1].stop, sl[0].stop) for sl in slices]
    bodies = {}
    for n, box in enumerate(boxes):
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        key = (min(rows - 1, int(cy // ch)), min(cols - 1, int(cx // cw)))
        if key not in bodies or sizes[n] > sizes[bodies[key]]:
            bodies[key] = n
    if len(bodies) != cols * rows:
        sys.exit(f'{path.name}: achei {len(bodies)} sprites, esperava {cols * rows}')
    members = {key: [n] for key, n in bodies.items()}
    for n, b in enumerate(boxes):
        if body_only or n in bodies.values():
            continue
        def gap(key):
            o = boxes[bodies[key]]
            return max(o[0] - b[2], b[0] - o[2], 0) + max(o[1] - b[3], b[1] - o[3], 0)
        key = min(members, key=gap)
        if gap(key) < 60:
            members[key].append(n)
    out = {}
    for key, ns in members.items():
        mask = np.isin(labels, [n + 1 for n in ns])
        own = rgba.copy(); own[..., 3] = np.where(mask, own[..., 3], 0)
        sel = [boxes[n] for n in ns]
        union = (min(b[0] for b in sel), min(b[1] for b in sel), max(b[2] for b in sel), max(b[3] for b in sel))
        out[key] = {'union': union, 'body': boxes[bodies[key]], 'image': Image.fromarray(own, 'RGBA')}
    return image, out


def strips(sheet, mode, entry):
    # The fish flies clean, without the painted drops behind it (matheus, 20/10); the shark keeps its spray.
    image, found = cells(sheet, 4, 4, body_only=mode == 'normal')
    for r, stage in enumerate(STAGES):
        # Frames share one box lined up on the nose (the body's right edge), so the head stays still while the
        # tail swings; the pivot is the body's average centre.
        rel, centre = [], []
        for c in range(4):
            u, b = found[(r, c)]['union'], found[(r, c)]['body']
            ox, oy = b[2], (b[1] + b[3]) / 2
            rel.append((u[0] - ox, u[1] - oy, u[2] - ox, u[3] - oy, ox, oy))
            centre.append(((b[0] + b[2]) / 2 - ox, 0))
        x0, y0 = min(v[0] for v in rel), min(v[1] for v in rel)
        x1, y1 = max(v[2] for v in rel), max(v[3] for v in rel)
        w, h = x1 - x0, y1 - y0
        scale = min(1, MAX_SIDE / max(w, h))
        fw, fh = max(1, round(w * scale)), max(1, round(h * scale))
        strip = Image.new('RGBA', (fw * 4, fh))
        for c, v in enumerate(rel):
            ox, oy = v[4], v[5]
            frame = found[(r, c)]['image'].crop((round(ox + x0), round(oy + y0), round(ox + x1), round(oy + y1))).resize((fw, fh), Image.LANCZOS)
            strip.paste(frame, (c * fw, 0))
        (OUT / 'projectile').mkdir(parents=True, exist_ok=True)
        strip.save(OUT / 'projectile' / f'{mode}-{stage}.png', optimize=True)
        entry.setdefault(mode, {})[str(stage)] = {
            'frames': 4, 'width': fw, 'height': fh,
            # The body's centre as a share of the frame: the game puts it on the projectile's position.
            'pivot': [round((sum(v[0] for v in centre) / 4 - x0) / w, 4), round(-y0 / h, 4)],
            'span': round(w / (image.width / 4), 4)
        }
        print(f'{mode}-{stage}.png {strip.width}x{strip.height}')
    return image, found


def fit(piece, size):
    piece = piece.crop(piece.getbbox()) if piece.getbbox() else piece
    scale = min(1, size / max(piece.width, piece.height))
    return piece.resize((max(1, round(piece.width * scale)), max(1, round(piece.height * scale))), Image.LANCZOS)


def place(atlas, piece, col, row):
    piece = fit(piece, int(CELL * .86))
    atlas.paste(piece, (col * CELL + (CELL - piece.width) // 2, row * CELL + (CELL - piece.height) // 2), piece)


def main():
    src = Path(sys.argv[1])
    entry = {'fps': FPS, 'powScale': POW_SCALE}
    fish, fish_cells = strips(src / 'fish-sheet.png', 'normal', entry)
    shark, shark_cells = strips(src / 'shark-sheet.png', 'pow', entry)
    fx, fx_cells = cells(src / 'fx-sheet.png', 4, 3)
    effects = Image.new('RGBA', (CELL * 4, CELL * 3))
    pow_atlas = Image.new('RGBA', (CELL * 4, CELL * 2))
    for col in range(4):
        place(effects, fish_cells[(col, 0)]['image'].crop(fish_cells[(col, 0)]['union']), col, 0)
        # The cast spray was painted narrowing to the right: mirrored, it widens away from the rod like the other muzzles.
        place(effects, fx_cells[(0, col)]['image'].crop(fx_cells[(0, col)]['union']).transpose(Image.FLIP_LEFT_RIGHT), col, 1)
        place(effects, fx_cells[(1, col)]['image'].crop(fx_cells[(1, col)]['union']), col, 2)
        place(pow_atlas, shark_cells[(col, 0)]['image'].crop(shark_cells[(col, 0)]['union']), col, 0)
        place(pow_atlas, fx_cells[(2, col)]['image'].crop(fx_cells[(2, col)]['union']), col, 1)
    effects.save(OUT / 'effects.png', optimize=True)
    pow_atlas.save(OUT / 'pow.png', optimize=True)
    index_path = ROOT / 'src' / 'game' / 'projectileStrips.json'
    index = json.loads(index_path.read_text(encoding='utf-8'))
    index[WEAPON] = entry
    index_path.write_text(json.dumps(index, indent=1) + '\n', encoding='utf-8')
    print('effects.png e pow.png escritos')


if __name__ == '__main__':
    main()
