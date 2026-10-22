# O cabelo tirado pela diferença trouxe pedaços do rosto (cílios, pele) onde a careca saiu um pouco diferente:
# fica só o que tem cor de cabelo (castanho) e o contorno escuro ligado a ele.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
p = sys.argv[1]
a = np.asarray(Image.open(p).convert('RGBA')).astype(int).copy()
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
lum = (r + g + b) / 3
brown = (al > 20) & (r >= g) & (g >= b - 5) & (lum < 175) & (r - b > 15)
skin = (r > 200) & (g > 150) & (b > 110)
keep = brown & ~skin
lab, n = ndimage.label(ndimage.binary_closing(keep, iterations=2))
if n:
    sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    keep &= np.isin(lab, 1 + np.nonzero(sz >= sz.max() * .02)[0])
keep = ndimage.binary_fill_holes(ndimage.binary_closing(keep, iterations=3)) & (al > 20) & ~skin
a[~keep, 3] = 0
Image.fromarray(a.astype(np.uint8)).save(p)
