"""Cuts the Bobina do Trovão effect sheet (Nano Banana 2, 4 columns × 5 rows on black) into the kit atlases.

Rows of the source: projectile, launch, impact, POW projectile, POW impact; columns are the phases +0, +10, +12, +15.
Black becomes transparency (alpha = brightest channel, colour un-premultiplied), so the glow keeps its light.
The POW is always pink-violet (DDTank Trovão 151); where the sheet painted the POW of +10/+12 in the phase colour,
it is shifted halfway to violet so it never reads as the normal shot. docs/wind-thunder.md.

    py -3 scripts/build-thunder-effects.py <sheet.png>
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'weapons' / 'thunder-coil'
CELL = 362
VIOLET = np.array([.86, .42, 1.0])


def light_to_alpha(cell, violet=0.0):
    rgb = np.asarray(cell.convert('RGB')).astype(np.float32) / 255
    alpha = rgb.max(axis=2)
    alpha = np.clip((alpha - .04) / .96, 0, 1)
    color = np.where(alpha[..., None] > 0, rgb / np.maximum(rgb.max(axis=2, keepdims=True), 1e-6), 0)
    if violet:
        # Keep the white core, tint the coloured light toward violet.
        whiteness = color.min(axis=2, keepdims=True)
        color = color * (1 - violet) + (whiteness + (1 - whiteness) * VIOLET) * violet
    out = np.dstack([np.clip(color, 0, 1), alpha])
    return Image.fromarray((out * 255 + .5).astype(np.uint8), 'RGBA')


def main(source):
    sheet = Image.open(source)
    w, h = sheet.size
    cw, ch = w / 4, h / 5
    effects = Image.new('RGBA', (CELL * 4, CELL * 3), (0, 0, 0, 0))
    pow_sheet = Image.new('RGBA', (CELL * 4, CELL * 2), (0, 0, 0, 0))
    for row in range(5):
        for column in range(4):
            box = tuple(round(v) for v in (column * cw, row * ch, (column + 1) * cw, (row + 1) * ch))
            violet = .55 if row >= 3 and column in (1, 2) else 0
            cell = light_to_alpha(sheet.crop(box), violet).resize((CELL, CELL), Image.LANCZOS)
            if row < 3:
                effects.alpha_composite(cell, (column * CELL, row * CELL))
            else:
                pow_sheet.alpha_composite(cell, (column * CELL, (row - 3) * CELL))
    effects.save(ROOT / 'effects.png')
    pow_sheet.save(ROOT / 'pow.png')
    print('effects.png e pow.png em', ROOT)


if __name__ == '__main__':
    main(sys.argv[1])
