"""Builds the Vento Celeste effect atlases from its approved phase art (docs/wind-thunder.md).

The thrown object is the weapon itself, so the projectile row reuses icon-<phase>.png; the POW projectile groups
three of them into one compact object (one physical projectile, like DDTank's sprite 131). Launch and impacts are
soft wind rings and sparks painted in each phase's colours. Writes effects.png (1448×1086, projectile / launch /
impact rows) and pow.png (1448×724, POW projectile / POW impact rows); columns are the phases +0, +10, +12, +15.

    py -3 scripts/build-shuriken-effects.py
"""
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'weapons' / 'wind-shuriken'
CELL = 362
STAGES = [0, 10, 12, 15]
# Light, mid and accent colour of each phase, taken from its painting.
PALETTE = {
    0: ((255, 250, 238), (214, 222, 232), (255, 214, 150)),
    10: ((255, 238, 200), (255, 140, 70), (230, 40, 50)),
    12: ((255, 244, 220), (205, 160, 255), (255, 196, 70)),
    15: ((255, 250, 220), (255, 206, 80), (80, 160, 255)),
}


def icon(stage, size):
    image = Image.open(ROOT / f'icon-{stage}.png').convert('RGBA')
    return image.crop(image.getbbox()).resize((size, size), Image.LANCZOS)


def blank():
    return Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))


def glow(cell, radius, color, alpha, blur):
    layer = blank()
    d = ImageDraw.Draw(layer)
    c = CELL / 2
    d.ellipse((c - radius, c - radius, c + radius, c + radius), fill=color + (alpha,))
    cell.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def rings(cell, stage, scale, seed):
    light, mid, accent = PALETTE[stage]
    rnd = random.Random(seed)
    c = CELL / 2
    glow(cell, 70 * scale, mid, 120, 26 * scale)
    glow(cell, 34 * scale, light, 230, 12 * scale)
    # Swirling wind arcs, thick in the middle and fading at both ends.
    for n in range(5 + stage // 5):
        layer = blank()
        d = ImageDraw.Draw(layer)
        r = (40 + n * 12) * scale * rnd.uniform(.9, 1.05)
        start = rnd.uniform(0, 360)
        sweep = rnd.uniform(110, 190)
        steps = 24
        for k in range(steps):
            t = k / steps
            a0 = math.radians(start + sweep * t)
            a1 = math.radians(start + sweep * (t + 1 / steps))
            width = max(1, int((6 - n * .6) * scale * math.sin(math.pi * t) + 1))
            color = (light if n % 2 == 0 else mid) + (int(235 * math.sin(math.pi * t)),)
            d.line((c + math.cos(a0) * r, c + math.sin(a0) * r * .82, c + math.cos(a1) * r, c + math.sin(a1) * r * .82), fill=color, width=width)
        cell.alpha_composite(layer.filter(ImageFilter.GaussianBlur(.8)))
    # Sparks and thin slash marks flying out.
    layer = blank()
    d = ImageDraw.Draw(layer)
    for n in range(14 + stage // 2):
        a = rnd.uniform(0, math.tau)
        r0 = rnd.uniform(40, 70) * scale
        r1 = r0 + rnd.uniform(16, 38) * scale
        color = (accent if n % 3 == 0 else light) + (255,)
        d.line((c + math.cos(a) * r0, c + math.sin(a) * r0, c + math.cos(a) * r1, c + math.sin(a) * r1), fill=color, width=max(2, int(3 * scale)))
    for n in range(10):
        a = rnd.uniform(0, math.tau)
        r = rnd.uniform(55, 100) * scale
        s = rnd.uniform(2.5, 5) * scale
        x, y = c + math.cos(a) * r, c + math.sin(a) * r
        d.polygon([(x - s, y), (x, y - s * 1.8), (x + s, y), (x, y + s * 1.8)], fill=accent + (255,))
    cell.alpha_composite(layer.filter(ImageFilter.GaussianBlur(.6)))
    return cell


def launch(stage):
    light, mid, accent = PALETTE[stage]
    cell = blank()
    c = CELL / 2
    rnd = random.Random(stage + 7)
    # Air ribbons blowing to the right, spreading a little.
    tier = STAGES.index(stage)
    ribbons = 3 + tier
    for n in range(ribbons):
        layer = blank()
        d = ImageDraw.Draw(layer)
        y0 = c + (n - (ribbons - 1) / 2) * (12 + tier * 3)
        points = []
        for k in range(30):
            t = k / 29
            x = c - 95 + 190 * t
            y = y0 + (n - (ribbons - 1) / 2) * (14 + tier * 6) * t + math.sin(t * (4 + tier) + n) * (5 + tier * 2)
            points.append((x, y))
        for k in range(len(points) - 1):
            t = k / (len(points) - 1)
            width = max(1, int(7 * math.sin(math.pi * t) * (1 - n * .12)))
            d.line((points[k], points[k + 1]), fill=(light if n % 3 == 0 else mid if n % 3 == 1 else accent) + (int(230 * math.sin(math.pi * t)),), width=width)
        cell.alpha_composite(layer.filter(ImageFilter.GaussianBlur(1)))
    layer = blank()
    d = ImageDraw.Draw(layer)
    for n in range(8 + stage // 3):
        x = c + rnd.uniform(-20, 90)
        y = c + rnd.uniform(-40, 40)
        d.line((x, y, x + rnd.uniform(10, 22), y + rnd.uniform(-4, 4)), fill=accent + (255,), width=3)
    cell.alpha_composite(layer)
    glow(cell, 20 + tier * 6, mid, 200, 10 + tier * 2)
    return cell


def pow_projectile(stage):
    cell = blank()
    glow(cell, 100, (255, 200, 90), 170, 30)
    size = 150
    c = CELL / 2
    for n, angle in enumerate([-90, 30, 150]):
        piece = icon(stage, size).rotate(n * 40, Image.BICUBIC, expand=True)
        a = math.radians(angle)
        x = c + math.cos(a) * 52 - piece.width / 2
        y = c + math.sin(a) * 52 - piece.height / 2
        cell.alpha_composite(piece, (int(x), int(y)))
    return cell


def main():
    effects = Image.new('RGBA', (CELL * 4, CELL * 3), (0, 0, 0, 0))
    pow_sheet = Image.new('RGBA', (CELL * 4, CELL * 2), (0, 0, 0, 0))
    for column, stage in enumerate(STAGES):
        projectile = blank()
        piece = icon(stage, 200)
        projectile.alpha_composite(piece, ((CELL - 200) // 2, (CELL - 200) // 2))
        effects.alpha_composite(projectile, (column * CELL, 0))
        effects.alpha_composite(launch(stage), (column * CELL, CELL))
        effects.alpha_composite(rings(blank(), stage, .95, stage), (column * CELL, CELL * 2))
        pow_sheet.alpha_composite(pow_projectile(stage), (column * CELL, 0))
        burst = rings(blank(), stage, 1.25, stage + 31)
        glow(burst, 120, (255, 170, 60), 90, 34)
        pow_sheet.alpha_composite(rings(burst, stage, 1.0, stage + 57), (column * CELL, CELL))
    effects.save(ROOT / 'effects.png')
    pow_sheet.save(ROOT / 'pow.png')
    print('effects.png e pow.png em', ROOT)


if __name__ == '__main__':
    main()
