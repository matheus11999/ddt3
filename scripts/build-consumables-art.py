"""Cuts the Codex sheets of the battle consumables (Enfurecer, Gelo) into game sprites.

Sources: public/assets/consumables/source/{icons,iceshot,frozen}.png, painted on flat magenta.
Each cell keeps its whole canvas (never trimmed per frame) so animations do not shake.
Run: python scripts/build-consumables-art.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public/assets/consumables/source'
OUT = ROOT / 'public/assets/consumables'

def unmagenta(img: Image.Image, cold=False) -> Image.Image:
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # Magenta is (255,0,255): its distance above green in both red and blue is how much background shows.
    bg = np.clip(np.minimum(r - g, b - g) / 255.0, 0, 1)
    alpha = np.clip((1 - bg - .04) / .96, 0, 1)
    safe = np.maximum(alpha, 1e-3)[..., None]
    mag = np.array([255, 0, 255], np.float32)
    fg = np.clip((a - (1 - alpha[..., None]) * mag) / safe, 0, 255)
    # Ice is never warmer than it is green: mist left purple by the magenta goes back to white-blue.
    if cold: fg[..., 0] = np.minimum(fg[..., 0], fg[..., 1])
    alpha[alpha < .03] = 0
    out = np.dstack([fg, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

def cells(img: Image.Image, cols: int, rows: int):
    w, h = img.size
    for j in range(rows):
        for i in range(cols):
            yield img.crop((round(i * w / cols), round(j * h / rows), round((i + 1) * w / cols), round((j + 1) * h / rows)))

def strip(frames, size):
    sheet = Image.new('RGBA', (size * len(frames), size))
    for n, f in enumerate(frames):
        sheet.paste(f.resize((size, size), Image.LANCZOS), (n * size, 0))
    return sheet

def main():
    icons = list(cells(unmagenta(Image.open(SRC / 'icons.png')), 2, 1))
    ice_icon = list(cells(unmagenta(Image.open(SRC / 'icons.png'), True), 2, 1))[1]
    icons[0].resize((256, 256), Image.LANCZOS).save(OUT / 'rage-icon.png')
    ice_icon.resize((256, 256), Image.LANCZOS).save(OUT / 'ice-icon.png')
    shot = list(cells(unmagenta(Image.open(SRC / 'iceshot.png'), True), 4, 2))
    shot[0].resize((192, 192), Image.LANCZOS).save(OUT / 'ice-projectile.png')
    strip(shot[1:], 256).save(OUT / 'ice-impact.png')
    strip(list(cells(unmagenta(Image.open(SRC / 'frozen.png'), True), 3, 1)), 320).save(OUT / 'ice-block.png')
    print('ok', sorted(p.name for p in OUT.glob('*.png')))

main()
