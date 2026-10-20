"""Turns a painted destruction mark into the DDTank-like ground mark the game wants (matheus, 20/10: no solid rim):
dark at the hole and fading out across the template's band, with the hole and everything outside the band transparent.
The painting keeps its colours and cracks; only its alpha changes. Geometry comes from the template
(docs/destruction-templates/<weapon>-<mode>.png: magenta = hole, cyan = band).
Usage: python scripts/fade-destruction-mark.py <weapon> <normal|pow> <mark.png> [--power=1.4]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

weapon, mode, path = sys.argv[1:4]
power = float(next((a.split('=')[1] for a in sys.argv if a.startswith('--power=')), 1.4))
t = np.asarray(Image.open(f'docs/destruction-templates/{weapon}-{mode}.png').convert('RGB')).astype(int)
r, g, b = t[..., 0], t[..., 1], t[..., 2]
hole = (r > 180) & (b > 180) & (g < 90)
band = (g > 180) & (b > 180) & (r < 90)
inside = ndimage.distance_transform_edt(~hole)          # distance from the hole
outside = ndimage.distance_transform_edt(hole | band)   # distance to the outside of the band
fade = np.clip(1 - inside / np.maximum(inside + outside, 1), 0, 1) ** power
fade[hole] = 0
fade[~(hole | band)] = 0
# Keep the rim fully painted right at the hole's outline (the game's mask follows it).
fade[(inside > 0) & (inside < 6)] = 1
im = Image.open(path).convert('RGBA')
if im.size != (t.shape[1], t.shape[0]):
    im = im.resize((t.shape[1], t.shape[0]), Image.LANCZOS)
a = np.asarray(im).astype(float)
a[..., 3] = a[..., 3] * fade
Image.fromarray(a.astype(np.uint8)).save(path, optimize=True)
print(f'{path}: alpha faded across the band (power {power})')
