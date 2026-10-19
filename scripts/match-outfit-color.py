"""Matches the color of an outfit's Color Ticket zone in its lobby walk sheet and battle atlas to the standing
painting, when Codex painted the sheets a little darker or lighter (verify:cosmetics: "Cor da roupa muda").
Only pixels in the zone's hue band change, fading out at the band's edge.
Usage: python scripts/match-outfit-color.py <outfit-id> <hue 0-1> [tolerance=.06] [min-saturation=.3]"""
import sys
import numpy as np
from PIL import Image

outfit, hue = sys.argv[1], float(sys.argv[2])
tol = float(sys.argv[3]) if len(sys.argv) > 3 else .06
ms = float(sys.argv[4]) if len(sys.argv) > 4 else .3
short = outfit.removeprefix('outfit-')


def zone(image):
    a = np.asarray(image.convert('RGBA')).astype(float)
    hsv = np.asarray(image.convert('RGB').convert('HSV')).astype(float) / 255
    d = np.abs(((hsv[..., 0] - hue) + .5) % 1 - .5)
    return a, d, (a[..., 3] > 20) & (d < tol) & (hsv[..., 1] >= ms)


a, _, m = zone(Image.open(f'public/assets/outfits/{short}-atlas.png'))
target = a[..., :3][m & (a[..., 3] > 200)].mean(0)
for path in [f'public/assets/outfits/walk/{outfit}.png', f'public/assets/outfits/combat/{outfit}.png']:
    a, d, m = zone(Image.open(path))
    mean = a[..., :3][m & (a[..., 3] > 200)].mean(0)
    w = (np.clip(1 - d / tol, 0, 1) * m)[..., None]
    a[..., :3] = np.clip(a[..., :3] * (1 + (target / mean - 1) * w), 0, 255)
    Image.fromarray(a.astype(np.uint8)).save(path, optimize=True)
    print(f'{path}: {mean.round()} -> {target.round()}')
