#!/usr/bin/env python3
"""Cuts pet art painted by Codex on pure magenta (#FF00FF) into transparent PNGs (docs/pets.md "Arte").

Unlike the map keyer (shared/mapBuilder.ts), the background is removed only where it touches the sheet's
border through magenta-like pixels, so pink and magenta petals inside a creature are never keyed out.
Edge pixels are un-mixed from the magenta for a clean, spill-free outline.

  pieces: python3 scripts/cut-pet-sheet.py pieces SHEET OUT_DIR name1,name2,...   (big pieces left→right, top row first;
          small bits such as sparkles join the nearest piece)
  grid:   python3 scripts/cut-pet-sheet.py grid SHEET OUT_DIR COLSxROWS name1,name2,... (one name per row: a horizontal
          strip of that row's cells, every frame the same size, for animations)
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

MAGENTA = np.array([255, 0, 255], dtype=np.float32)


def unkey(path):
    rgb = np.asarray(Image.open(path).convert('RGB'), dtype=np.float32)
    h, w, _ = rgb.shape
    dist = np.sqrt(((rgb - MAGENTA) ** 2).sum(axis=2))
    near = dist < 70
    bg = np.zeros((h, w), bool)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not bg[y, x]:
                bg[y, x] = True; queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not bg[y, x]:
                bg[y, x] = True; queue.append((y, x))
    # Enclosed holes (between a stem and a petal) start their own fill from their almost pure magenta pixels.
    for y, x in zip(*np.nonzero((dist < 30) & ~bg)):
        if not bg[y, x]:
            bg[y, x] = True; queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; queue.append((ny, nx))
    # The anti-aliased rim: 3 px around the background, un-mixed from the magenta.
    grown = bg.copy()
    for _ in range(3):
        g = grown.copy()
        g[1:] |= grown[:-1]; g[:-1] |= grown[1:]; g[:, 1:] |= grown[:, :-1]; g[:, :-1] |= grown[:, 1:]
        grown = g
    rim = grown & ~bg
    alpha = np.ones((h, w), np.float32)
    alpha[bg] = 0
    spill = np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1]
    alpha[rim] = np.clip(1 - (spill[rim] - 20) / 200, 0, 1)
    out = rgb.copy()
    a = alpha[..., None]
    unmixed = np.clip((rgb - (1 - a) * MAGENTA) / np.maximum(a, 1e-3), 0, 255)
    out[rim] = unmixed[rim]
    rgba = np.dstack([out, alpha * 255]).astype(np.uint8)
    return rgba


def components(alpha, step=4, min_area=600):
    h, w = alpha.shape
    gh, gw = (h + step - 1) // step, (w + step - 1) // step
    grid = alpha[::step, ::step] > 128
    label = -np.ones(grid.shape, int)
    boxes = []
    for sy in range(grid.shape[0]):
        for sx in range(grid.shape[1]):
            if not grid[sy, sx] or label[sy, sx] >= 0:
                continue
            box = [sx, sy, sx, sy, 0]
            label[sy, sx] = len(boxes)
            stack = [(sy, sx)]
            while stack:
                y, x = stack.pop(); box[4] += 1
                box[0] = min(box[0], x); box[1] = min(box[1], y); box[2] = max(box[2], x); box[3] = max(box[3], y)
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= ny < grid.shape[0] and 0 <= nx < grid.shape[1] and grid[ny, nx] and label[ny, nx] < 0:
                        label[ny, nx] = len(boxes); stack.append((ny, nx))
            boxes.append(box)
    big = [b for b in boxes if b[4] * step * step >= min_area * 4]
    small = [b for b in boxes if b not in big]
    merged = [list(b) for b in big]
    for b in small:
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        def gap(m):
            dx = max(m[0] - cx, 0, cx - m[2]); dy = max(m[1] - cy, 0, cy - m[3]); return dx * dx + dy * dy
        if merged:
            m = min(merged, key=gap)
            if gap(m) < (60 / step) ** 2:
                m[0] = min(m[0], b[0]); m[1] = min(m[1], b[1]); m[2] = max(m[2], b[2]); m[3] = max(m[3], b[3])
    rows = sorted(merged, key=lambda b: (b[1] + b[3]) / 2)
    # Group into rows by vertical overlap, then left to right.
    lines = []
    for b in rows:
        for line in lines:
            if b[1] <= line[-1][3] and b[3] >= line[-1][1]:
                line.append(b); break
        else:
            lines.append([b])
    ordered = [b for line in lines for b in sorted(line, key=lambda b: b[0])]
    pad = 6
    return [(max(0, b[0] * step - pad), max(0, b[1] * step - pad), min(w, (b[2] + 1) * step + pad), min(h, (b[3] + 1) * step + pad)) for b in ordered]


def trim(img):
    box = img.getbbox()
    return img.crop(box) if box else img


def main():
    mode, sheet, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    rgba = unkey(sheet)
    image = Image.fromarray(rgba, 'RGBA')
    if mode == 'pieces':
        names = sys.argv[4].split(',')
        boxes = components(rgba[..., 3])
        if len(boxes) < len(names):
            sys.exit(f'{sheet}: achei {len(boxes)} peças, esperava {len(names)}')
        for name, box in zip(names, boxes):
            piece = trim(image.crop(box))
            piece.save(out / f'{name}.png', optimize=True)
            print(f'{name}.png {piece.width}x{piece.height}')
    elif mode == 'grid':
        cols, rows = (int(n) for n in sys.argv[4].lower().split('x'))
        names = sys.argv[5].split(',')
        cw, ch = image.width // cols, image.height // rows
        for r, name in enumerate(names):
            strip = Image.new('RGBA', (cw * cols, ch))
            for c in range(cols):
                strip.paste(image.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)), (c * cw, 0))
            strip.save(out / f'{name}.png', optimize=True)
            print(f'{name}.png {strip.width}x{strip.height} ({cols} quadros de {cw}x{ch})')
    else:
        sys.exit('modo: pieces ou grid')


if __name__ == '__main__':
    main()
