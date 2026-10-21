"""Rig v2 (docs/rig-v2.md): builds the MOLDS every piece is painted on, from the geometry of the DDTank 4.1 study
(D:/APPS/ddt/output/ddtank-character-system). Only silhouettes are taken (flat gray body, flat green head, magenta
background), never the original paint. Everything at 2x the DDTank grid; cells keep their transparent margins.

  docs/templates/rig/game-<m|f>.png     2964x570, 13x3 cells of 228x190 (combat, GAME)
  docs/templates/rig/show-<m|f>.png     500x684  (bag, shop, rooms, SHOW: body + head, frame 0)
  docs/templates/rig/showface-<m|f>.png 2000x684 (the 4 face cells of SHOW: blink)
  docs/templates/rig/virtual-<m|f>.png  1680x700, 7x2 cells of 240x350 (plaza and Pescaria, VIRTUAL: front row, back row)
  docs/templates/rig/virtualhead-<m|f>.png 720x350 (3 head cells: front, eyes closed, back)
Usage: py scripts/rig/make-molds.py [D:/APPS/ddt/output/ddtank-character-system]
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

REF = (sys.argv[1] if len(sys.argv) > 1 else 'D:/APPS/ddt/output/ddtank-character-system') + '/assets/original/image'
K = 2
MAGENTA, GRAY, GREEN, OUTLINE = (255, 0, 255), (150, 150, 150), (0, 255, 0), (70, 70, 70)


def alpha(path, size=None):
    im = Image.open(f'{REF}/{path}').convert('RGBA')
    if size and im.size != size:  # older revision (SHOW 312 in a 342 cell, VIRTUAL head 150 in 175): pad, never scale
        pad = Image.new('RGBA', size, (0, 0, 0, 0))
        pad.alpha_composite(im, (0, 0))
        im = pad
    a = im.split()[3].resize((im.width * K, im.height * K), Image.LANCZOS)
    return np.asarray(a.filter(ImageFilter.GaussianBlur(0.8))) > 110


def mold(body, head):
    out = np.zeros(body.shape + (3,), np.uint8)
    out[:] = MAGENTA
    edge = np.asarray(Image.fromarray((body * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    out[edge & ~body] = OUTLINE
    out[body] = GRAY
    if head is not None:
        out[head] = GREEN
    return Image.fromarray(out, 'RGB')


for sex, S in (('m', 'M'), ('f', 'F')):
    e = f'equip/{sex}'
    mold(alpha(f'{e}/cloth/default/1/game.png'), alpha(f'{e}/face/default/1/game.png')).save(f'docs/templates/rig/game-{sex}.png')
    mold(alpha(f'{e}/cloth/default/1/show.png', (250, 342)), alpha(f'{e}/face/default/1/show.png', (1000, 342))[:, :500]).save(f'docs/templates/rig/show-{sex}.png')
    face = alpha(f'{e}/face/default/1/show.png', (1000, 342))
    mold(np.zeros_like(face), face).save(f'docs/templates/rig/showface-{sex}.png')
    front, back = alpha(f'virtual/{S}/clothF/default/1.png'), alpha(f'virtual/{S}/cloth/default/1.png')
    body = front | back
    head = alpha(f'virtual/{S}/face/default/1.png', (360, 175))
    # each body cell wears its head (front cells take head cell 0, back cells head cell 2) with the AS3 y offsets
    offsets = [0, 0, -1, 2, 0, -1, 2]
    heads = np.zeros_like(body)
    cw, ch = 120 * K, 175 * K
    for row, cell in ((0, 0), (1, 2)):
        h = head[:, cell * cw:(cell + 1) * cw]
        for col in range(7):
            dy = offsets[col] * K
            y0 = row * ch + dy
            dst = heads[max(0, y0):y0 + ch, col * cw:(col + 1) * cw]
            src = h[max(0, -y0):max(0, -y0) + dst.shape[0]]
            dst |= src
    mold(body & ~heads, heads).save(f'docs/templates/rig/virtual-{sex}.png')
    mold(np.zeros_like(head), head).save(f'docs/templates/rig/virtualhead-{sex}.png')
    print(sex, 'ok')
