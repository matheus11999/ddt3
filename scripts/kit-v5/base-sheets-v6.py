"""Moldes e pedidos do Codex para a base de pele única no combate e na praça (matheus 22/10).

  py scripts/kit-v5/base-sheets-v6.py molds <sexo>        moldes com a cabeça careca de verdade no lugar da verde
  py scripts/kit-v5/base-sheets-v6.py dress <sexo> <look> <kit-dir>   pedidos de vestir a base de combate e praça

A base do combate e da praça é pintada pelo Codex com a cabeça careca real no molde (o pescoço liga no queixo) e
depois vestida com cada roupa; a roupa é a base vestida menos a base, como na mochila.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

L = lambda p: Image.open(p).convert('RGBA')
mode, SEX = sys.argv[1], sys.argv[2]
OUT = f'output/base-v6/{SEX}'
os.makedirs(OUT, exist_ok=True)
KID = 'boy' if SEX == 'm' else 'girl'
KIT = 'output/kit-v5-mcp' if SEX == 'm' else 'output/kit-v5f'


def job(d, refs, size, prompt):
    os.makedirs(d, exist_ok=True)
    open(f'{d}/refs.txt', 'w').write('\n'.join(refs) + '\n')
    json.dump({'background': 'magenta', 'size': size}, open(f'{d}/job.json', 'w'))
    open(f'{d}/prompt.txt', 'w', encoding='utf8').write(prompt)


def green(a):
    return (a[..., 1] > 180) & (a[..., 0] < 120) & (a[..., 2] < 120)


def core_box(cell):
    if not cell.any():
        return None
    cols = cell.sum(0); kc = np.nonzero(cols > cols.max() * .35)[0]
    rows = cell[:, kc.min():kc.max() + 1].sum(1); kr = np.nonzero(rows > rows.max() * .35)[0]
    return kc.min(), kr.min(), kc.max() + 1, kr.max() + 1


def skull(img):
    return img.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()


def place(head, box, size):
    bb = skull(head); gx0, gy0, gx1, gy1 = box
    s = ((gx1 - gx0) / (bb[2] - bb[0]) + (gy1 - gy0) / (bb[3] - bb[1])) / 2
    r = head.resize((round(head.width * s), round(head.height * s)), Image.LANCZOS)
    out = Image.new('RGBA', size)
    out.paste(r, (round((gx0 + gx1) / 2 - (bb[0] + bb[2]) / 2 * s), round(gy1 - bb[3] * s)), r)
    return out


def head_only(img):
    a = np.asarray(img).copy(); al = a[..., 3] > 128; w = al.sum(1); r = np.nonzero(w)[0]
    lo, hi = r.min() + int((r.max() - r.min()) * .3), r.min() + int((r.max() - r.min()) * .65)
    nk = lo + int(np.argmin(w[lo:hi])); a[nk + 2:, :, 3] = 0
    return Image.fromarray(a)


def with_heads(mold_path, head, cells, cw, ch, out_path, flip=False):
    """Troca a cabeça verde de cada célula pela cabeça careca real (o resto do molde fica)."""
    m = L(mold_path); a = np.asarray(m).astype(int).copy()
    g = green(a)
    a[g] = (255, 0, 255, 255)
    base = Image.fromarray(a.astype(np.uint8))
    h = head.transpose(Image.FLIP_LEFT_RIGHT) if flip else head
    for cx, cy in cells:
        box = core_box(g[cy:cy + ch, cx:cx + cw])
        if box:
            p = place(h, box, (cw, ch)); base.alpha_composite(p, (cx, cy))
    base.save(out_path)


if mode == 'molds':
    bh = head_only(L(f'output/base-v6/layers/{SEX}/base-{SEX}.png'))
    back = head_only(L(f'{KIT}/costas-careca/costas-careca.png'))
    src = 'output/kit-v5-mcp' if SEX == 'm' else 'output/kit-v5f'
    for b in range(1, 6):
        with_heads(f'{src}/combate-lotes/molde-lote{b}.png', bh, [(x * 512, y * 512) for y in range(2) for x in range(3)], 512, 512, f'{OUT}/molde-combate{b}.png')
        job(f'{OUT}/combate{b}', [f'{OUT}/molde-combate{b}.png', f'output/base-v6/{SEX}-mochila/{SEX}-mochila.png'], [1536, 1024], f'''Production 2D game sprite sheet of a small BATTLE character, 1536x1024, 3 columns x 2 rows of 512x512 cells, flat magenta background. IMAGE 1 is the MOLD: in each cell the character's real painted BALD HEAD (keep every head pixel EXACTLY as it is) over a small flat GRAY body guide and BEIGE skin parts (fists, legs) in a pose. IMAGE 2 is the game's neutral BASE BODY (blank bald head, plain light-gray tank top and short shorts, bare arms, legs and feet).
In every cell paint that BASE BODY exactly over the gray and beige of the mold, facing RIGHT, same pose and size, nothing wider: plain light-gray tank top and shorts, bare skin arms ending in ROUND fists (no fingers) over the beige fists, bare legs and feet. THE NECK comes out of the shoulders and goes up under the chin of the painted head, ONE continuous piece of skin, seamless. When KNEELING one knee rests on the ground with that lower leg lying flat going BACK. Clean dark outlines, soft cel shading, DDTank style. No weapon, floor or shadow, nothing outside the mold.''')
    psrc = 'output/kit-v5-mcp/praca-lotes' if SEX == 'm' else 'output/kit-v5f/praca-lotes'
    offs = [0, 0, -1, 2, 0, -1, 2]
    for name, head, flip in (('frente', bh, True), ('costas', back, False)):
        cells = [((c % 4) * 480, (c // 4) * 700) for c in range(7)]
        with_heads(f'{psrc}/molde-{name}-inteiro.png', head, cells, 480, 700, f'{OUT}/molde-praca-{name}.png', flip)
        view = '3/4 FRONT view (turned the same way as the head)' if name == 'frente' else 'seen from BEHIND, walking away'
        job(f'{OUT}/praca-{name}', [f'{OUT}/molde-praca-{name}.png', f'output/base-v6/{SEX}-mochila/{SEX}-mochila.png', 'output/kit-v5-mcp/praca-frente-v3/praca-frente-v3.png'], [1920, 1400], f'''Production 2D game sprite sheet of ONE character walking, 1920x1400, 4 columns x 2 rows of 480x700 cells; the bottom-right cell stays EMPTY magenta. IMAGE 1 shows in each of the 7 cells the character's real painted BALD HEAD (keep every head pixel EXACTLY as it is) over a flat gray body guide, on flat magenta. IMAGE 2 is the game's neutral BASE BODY (plain light-gray tank top and short shorts, bare arms, legs and feet). IMAGE 3 is an approved walk sheet of the same game: copy its step timing, size and painting.
Paint the BASE BODY under each head, {view}, all 7 cells as ONE consistent animation: identical body size and painting, only legs and arms move. Cell 1: standing, feet together. Cells 2-7: smooth walk cycle with clear natural steps, arms swinging opposite. THE NECK goes up under the chin of the painted head, one continuous piece of skin, seamless. Feet on the same ground line. Clean dark outlines, soft cel shading. No floor, no shadow.''')
    print('ok molds', SEX)

if mode == 'dress':
    look, kit = sys.argv[3], sys.argv[4]
    D = f'output/base-v6/{SEX}/veste-{look}'
    ref = f'{kit}/mochila-mestre/mochila-mestre.png'
    for b in range(1, 6):
        job(f'{D}-combate{b}', [f'{OUT}/combate{b}/combate{b}.png', ref, f'{kit}/combate-lote{b}/combate-lote{b}.png'], [1536, 1024], f'''Use case: precise image EDIT. IMAGE 1 is the edit target: a battle sprite sheet of the game's neutral BASE BODY (bald head, plain gray tank top and shorts, bare limbs) in 6 poses on magenta. IMAGE 2 shows the outfit to wear; IMAGE 3 shows the same outfit already painted in these same poses.
DRESS the body in every cell of IMAGE 1 in EXACTLY that outfit (same clothes, colors, details, shoes), fitted to IMAGE 1's body as it is: the clothes completely cover the gray tank top and shorts; skin stays only where the outfit shows skin. Do NOT touch the head, the neck, the fists, the skin, the magenta or anything that is not clothing: every other pixel stays exactly as in IMAGE 1.''')
    for name in ('frente', 'costas'):
        job(f'{D}-praca-{name}', [f'{OUT}/praca-{name}/praca-{name}.png', ref], [1920, 1400], f'''Use case: precise image EDIT. IMAGE 1 is the edit target: a walk sprite sheet of the game's neutral BASE BODY (bald head, plain gray tank top and shorts, bare limbs) in 7 cells on magenta, {'front 3/4 view' if name == 'frente' else 'seen from behind'}. IMAGE 2 shows the outfit to wear.
DRESS the body in every cell of IMAGE 1 in EXACTLY the outfit of IMAGE 2 (same clothes, colors, details, shoes; {'the back of the outfit' if name == 'costas' else 'the front of the outfit'}), fitted to each cell's body and pose as it is, the same in every cell: the clothes completely cover the gray tank top and shorts; skin stays only where the outfit shows skin. Do NOT touch the head, the neck, the hands, the skin, the magenta or anything that is not clothing: every other pixel stays exactly as in IMAGE 1.''')
    print('ok dress', look)
