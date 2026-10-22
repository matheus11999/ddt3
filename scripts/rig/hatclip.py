"""Rig v2: one hair for every hat (matheus 22/10: hair, hats and outfits universally compatible, no hair painted per hat).

For each hat sheet this writes <hat>-clip.png next to it: in every cell, the part of the head where a hair must NOT show
when the hat is worn. The game cuts the hair with it (rig.ts), so any hair goes under any hat:
  - the hat itself;
  - every column above the hat (hair can't poke through the crown);
  - every row above the hat's band (hair pressed under the hat doesn't stick out beside it).
Below the band the hair shows: the fringe under a brim, the sides, the nape, and through the hat's openings.

  py scripts/rig/hatclip.py <sex> <hat-id>
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

CELLS = {'game': (456, 380), 'show': (1000, 1368), 'virtualhead': (480, 700)}
BAND = .5  # the band, as a share of the hat's height from its top


def clip_cell(alpha):
    hat = alpha > 40
    if not hat.any():
        return np.zeros(alpha.shape, np.uint8)
    ys, xs = np.nonzero(hat)
    top, bottom = ys.min(), ys.max()
    band = int(top + BAND * (bottom - top))
    out = hat.copy()
    out[:band + 1, :] = True
    first = np.where(hat.any(0), hat.argmax(0), -1)
    for x in np.nonzero(first >= 0)[0]:
        out[:first[x], x] = True
    m = Image.fromarray((out * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))
    return np.asarray(m)


def main(sex, hat):
    for context, (cw, ch) in CELLS.items():
        path = f'public/assets/rig/{sex}/{context}/{hat}.png'
        a = np.asarray(Image.open(path).convert('RGBA'))[..., 3]
        clip = np.zeros(a.shape, np.uint8)
        for y in range(0, a.shape[0], ch):
            for x in range(0, a.shape[1], cw):
                clip[y:y + ch, x:x + cw] = clip_cell(a[y:y + ch, x:x + cw])
        out = np.zeros((*a.shape, 4), np.uint8)
        out[..., 3] = clip
        dest = path.replace('.png', '-clip.png')
        Image.fromarray(out).save(dest, optimize=True)
        print(dest)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
