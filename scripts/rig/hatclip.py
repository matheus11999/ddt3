"""Rig v2: one hair for every hat (matheus 22/10: hair, hats and outfits universally compatible, no hair painted per hat).

For each hat sheet this writes <hat>-clip.png next to it: in every cell, the part of the head where a hair must NOT show
when the hat is worn. The game cuts the hair with it (rig.ts), so any hair goes under any hat:
  - the hat itself;
  - every column above the hat (hair can't poke through the crown);
  - every row above the hat's band (hair pressed under the hat doesn't stick out beside it);
  - from the band down to the bottom of the hat, whatever sticks out of the head's own outline (matheus 22/10: a lock
    poked out behind the cap): pressed by the hat, the hair hugs the head there.
Below that the hair shows: the fringe under a brim, the sides, the nape, and through the hat's openings.

  py scripts/rig/hatclip.py <sex> <hat-id>
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

CELLS = {'game': (456, 380), 'show': (1000, 1368), 'virtualhead': (480, 700)}
BAND = .5  # the band, as a share of the hat's height from its top


HUG = .02  # how far the hair may stand off the head beside the hat, as a share of the cell width


def clip_cell(alpha, head):
    hat = alpha > 40
    if not hat.any():
        return np.zeros(alpha.shape, np.uint8)
    ys, xs = np.nonzero(hat)
    top, bottom = ys.min(), ys.max()
    band = int(top + BAND * (bottom - top))
    out = hat.copy()
    out[:band + 1, :] = True
    if head.any():
        grow = max(3, round(HUG * alpha.shape[1])) | 1
        near = np.asarray(Image.fromarray((head * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(grow))) > 0
        out[band:bottom + 1] |= ~near[band:bottom + 1]
    first = np.where(hat.any(0), hat.argmax(0), -1)
    for x in np.nonzero(first >= 0)[0]:
        out[:first[x], x] = True
    m = Image.fromarray((out * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))
    return np.asarray(m)


def main(sex, hat):
    face = 'face-basic-male' if sex == 'm' else 'face-basic-female'  # every face is painted on the same head outline
    for context, (cw, ch) in CELLS.items():
        path = f'public/assets/rig/{sex}/{context}/{hat}.png'
        a = np.asarray(Image.open(path).convert('RGBA'))[..., 3]
        head = np.asarray(Image.open(f'public/assets/rig/{sex}/{context}/{face}.png').convert('RGBA'))[..., 3] > 40
        clip = np.zeros(a.shape, np.uint8)
        for y in range(0, a.shape[0], ch):
            for x in range(0, a.shape[1], cw):
                clip[y:y + ch, x:x + cw] = clip_cell(a[y:y + ch, x:x + cw], head[y:y + ch, x:x + cw])
        out = np.zeros((*a.shape, 4), np.uint8)
        out[..., 3] = clip
        dest = path.replace('.png', '-clip.png')
        Image.fromarray(out).save(dest, optimize=True)
        print(dest)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
