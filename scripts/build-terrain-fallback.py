"""Paints the legacy terrain.png (1024×1024) of Vento Celeste and Bobina do Trovão (docs/wind-thunder.md).

The game uses it only until the eight gradient marks of shared/destruction.ts are painted and listed in PAINTED.
Like the approved mark rule: a dark gradient hugging a transparent hole that fades outward, thin cracks running
out of the rim (straight blade cuts for the Vento, branching burns for the Trovão) and gaps where the ground shows.

    py -3 scripts/build-terrain-fallback.py
"""
import math
import random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'weapons'
SIZE = 1024
C = SIZE / 2


def mark(weapon, height, tone, seed, branching):
    rnd = random.Random(seed)
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    # The legacy draw is radius × 4.3 wide (src/game/terrainResidues.ts), so the hole spans 2/4.3 of the canvas.
    hole = 238
    r = np.hypot((xx - C) / hole, (yy - C) / (hole * height))
    # Gradient: opaque at the rim, gone by 1.45× the hole, broken by low-frequency noise.
    noise = np.zeros_like(r)
    for k in range(4):
        fx, fy, ph = rnd.uniform(3, 9), rnd.uniform(3, 9), rnd.uniform(0, 6.28)
        noise += np.sin(xx / SIZE * fx * 6.28 + ph) * np.cos(yy / SIZE * fy * 6.28 + ph * 1.3)
    noise = noise / 4
    fade = np.clip(1 - (r - 1) / (.45 + noise * .12), 0, 1) ** 1.6
    alpha = np.where(r >= 1, fade * np.clip(.82 + noise * .5, 0, 1), 0)
    base = Image.fromarray(np.dstack([np.full_like(r, tone[0]), np.full_like(r, tone[1]), np.full_like(r, tone[2]), alpha * 220]).astype(np.uint8), 'RGBA')
    cracks = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(cracks)
    for n in range(46):
        a = rnd.uniform(0, math.tau)
        x, y = C + math.cos(a) * hole, C + math.sin(a) * hole * height
        length = rnd.uniform(70, 170)
        heading = a + rnd.uniform(-.35, .35)
        width = rnd.uniform(5, 9)
        steps = 10
        for k in range(steps):
            t = k / steps
            nx = x + math.cos(heading) * length / steps
            ny = y + math.sin(heading) * length / steps
            d.line((x, y, nx, ny), fill=tone + (int(255 * (1 - t)),), width=max(1, int(width * (1 - t))))
            if branching and rnd.random() < .22:
                b = heading + rnd.choice([-1, 1]) * rnd.uniform(.5, 1)
                d.line((nx, ny, nx + math.cos(b) * 40 * (1 - t), ny + math.sin(b) * 40 * (1 - t)), fill=tone + (int(200 * (1 - t)),), width=max(1, int(width * .5 * (1 - t))))
            heading += rnd.uniform(-.25, .25) if branching else rnd.uniform(-.05, .05)
            x, y = nx, ny
    out = base.filter(ImageFilter.GaussianBlur(3))
    out.alpha_composite(cracks.filter(ImageFilter.GaussianBlur(1.2)))
    pixels = np.asarray(out).copy()
    pixels[..., 3] = np.where(r < 1, 0, pixels[..., 3])
    Image.fromarray(pixels, 'RGBA').save(ROOT / weapon / 'terrain.png')


mark('wind-shuriken', .67, (34, 38, 52), 7, False)
mark('thunder-coil', .82, (22, 24, 40), 11, True)
print('terrain.png do Vento Celeste e da Bobina do Trovão')
