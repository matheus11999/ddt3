"""Rig v2 (docs/rig-v2.md): plates for Codex and back.

Codex paints best on a few big cells, the game needs every cell of its grid exactly in place. A plate is up to 3x2
cells of a context, each grid cell scaled by an integer-free but FIXED factor into a 512x512 plate cell (SHOW: one cell
in a 1024x1400 plate; VIRTUAL: 3 cells of 512x1024, front and back never on the same plate). Assembling divides by the same factor and puts each cell back in its grid position, so nothing
is fitted by bounding box: what the painter moved, moves.

  py scripts/rig/plates.py make <context> <sex> [--base=<sheet.png>] [--ref]   writes test-results/rig/plates/<context>-<sex>-<n>.png
      (--ref: the same plates from the DDTank default character, the POSE reference attached to the prompts)
      (the mold; with --base the lower pieces already painted are drawn into the mold instead of the green head)
  py scripts/rig/plates.py assemble <context> <sex> <out.png> <plate-1.png> [<plate-2.png> ...] [--region=head|body|aroundhead]
      keys out magenta (and green) and writes the full sheet in the grid of the context; --region keeps only the
      piece's part of the mold (the head for faces, hair and hats, the body for outfits), dropping the untouched mold.
  py scripts/rig/plates.py lift <base-sheet.png> <painted-sheet.png> <out.png> [--noskin] [--solid]
      the piece painted ON a base (hair over a face): every pixel that changed or lies outside the base.
Contexts (4x the DDTank grid): game (13x3 of 456x380, 33 used cells), show (1000x1368), showface (4 x 1000x1368),
virtual (7x2 of 480x700), virtualhead (3 x 480x700).
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

GRIDS = {  # 4x the DDTank grid since 22/10
    'game': ((456, 380), 13, 3, [i for i in range(39) if i % 13 < 11]),
    'show': ((1000, 1368), 1, 1, [0]),
    'showface': ((1000, 1368), 4, 1, [0, 1, 2, 3]),
    'virtual': ((480, 700), 7, 2, list(range(14))),
    'virtualhead': ((480, 700), 3, 1, [0, 1, 2]),
}
PLATE_CELL = 512
OUT = 'test-results/rig/plates'


def layout(context):
    (w, h), cols, rows, used = GRIDS[context]
    if context in ('show', 'showface'):
        k = 1.0  # one 1000x1368 cell inside a 1024x1400 plate
        return [[(i, 0, 0)] for i in used], k, (1024, 1400)
    if context == 'virtual':
        # 3 tall cells per plate (512x1024 each), never front and back on the same plate: Codex mixed them up (22/10)
        k = min(PLATE_CELL / w, 2 * PLATE_CELL / h)
        groups = [[0, 1, 2], [3, 4, 5], [6], [7, 8, 9], [10, 11, 12], [13]]
        return [[(idx, n, 0) for n, idx in enumerate(g)] for g in groups], k, (PLATE_CELL * 3, PLATE_CELL * 2)
    k = min(PLATE_CELL / w, PLATE_CELL / h)
    per = 6
    groups = [used[i:i + per] for i in range(0, len(used), per)]
    return [[(idx, n % 3, n // 3) for n, idx in enumerate(g)] for g in groups], k, (PLATE_CELL * 3, PLATE_CELL * 2)


def place(context, px, py, cw, ch, size):
    """Top-left corner of a scaled grid cell inside its plate cell (centered)."""
    if context in ('show', 'showface'):
        return (size[0] - cw) // 2, (size[1] - ch) // 2
    tall = 2 if context == 'virtual' else 1
    return px * PLATE_CELL + (PLATE_CELL - cw) // 2, py * PLATE_CELL * tall + (PLATE_CELL * tall - ch) // 2


def cell_of(sheet, context, index):
    (w, h), cols, _, _ = GRIDS[context]
    return sheet.crop((index % cols * w, index // cols * h, index % cols * w + w, index // cols * h + h))


def make(context, sex, base=None, ref=False):
    mold = Image.open(reference(context, sex) if ref else f'docs/templates/rig/{context}-{sex}.png').convert('RGBA')
    if base:
        b = Image.open(base).convert('RGBA')
        mold.alpha_composite(b)
    plates, k, size = layout(context)
    (w, h), *_ = GRIDS[context]
    os.makedirs(OUT, exist_ok=True)
    files = []
    for n, plate in enumerate(plates, 1):
        out = Image.new('RGB', size, (255, 0, 255))
        for idx, px, py in plate:
            c = cell_of(mold, context, idx).resize((round(w * k), round(h * k)), Image.LANCZOS)
            ox, oy = place(context, px, py, c.width, c.height, size)
            bg = Image.new('RGBA', c.size, (255, 0, 255, 255))
            bg.alpha_composite(c)
            out.paste(bg.convert('RGB'), (ox, oy))
        name = f"{OUT}/{'ref-' if ref else ''}{context}-{sex}-{n}.png"
        out.save(name)
        files.append(name)
    print('\n'.join(files))


REF = 'D:/APPS/ddt/output/ddtank-character-system/assets/original/image'
REF_LAYERS = {
    'game': ['{e}/face/default/1/game.png', '{e}/hair/default/1/A/game.png', '{e}/cloth/default/1/game.png'],
    'show': ['{e}/face/default/1/show.png', '{e}/hair/default/1/A/show.png', '{e}/cloth/default/1/show.png'],
    'virtual': ['virtual/{S}/cloth/default/1.png', 'virtual/{S}/clothF/default/1.png'],
    'virtualhead': ['virtual/{S}/face/default/1.png', 'virtual/{S}/hair/default/1.png'],
}


def reference(context, sex):
    """The DDTank default character in the same plate layout: POSE reference for Codex only (never pasted in the game)."""
    (w, h), cols, rows, _ = GRIDS[context]
    sheet = Image.new('RGBA', (w * cols, h * rows), (0, 0, 0, 0))
    for path in REF_LAYERS[context]:
        p = f"{REF}/{path.format(e='equip/' + sex, S=sex.upper())}"
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('RGBA')
        if context == 'show' and im.width > 250:
            im = im.crop((0, 0, 250, im.height))
        native = (w * cols // 4, h * rows // 4)
        if im.size != native:  # older revision smaller than the cell: pad at the bottom, never scale
            pad = Image.new('RGBA', native, (0, 0, 0, 0))
            pad.alpha_composite(im)
            im = pad
        im = im.resize((im.width * 4, im.height * 4), Image.LANCZOS)
        sheet.alpha_composite(im)
    os.makedirs(OUT, exist_ok=True)
    tmp = f'{OUT}/_ref-{context}-{sex}.png'
    bg = Image.new('RGBA', sheet.size, (255, 0, 255, 255))
    bg.alpha_composite(sheet)
    bg.save(tmp)
    return tmp


def key(img):
    a = np.asarray(img.convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    magenta = (r > 160) & (b > 160) & (g < 120)
    green = (g > 170) & (r < 130) & (b < 130)
    alpha = (~(magenta | green) * 255).astype(np.uint8)
    alpha = np.asarray(Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7)))
    return Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), 'RGBA')


def region_mask(context, sex, region):
    """Where a piece may be: the mold's head (green) or body (gray), grown a little; None keeps everything."""
    if region not in ('head', 'body', 'aroundhead'):
        return None
    m = np.asarray(Image.open(f'docs/templates/rig/{context}-{sex}.png').convert('RGB')).astype(int)
    r, g, b = m[..., 0], m[..., 1], m[..., 2]
    sel = (g > 200) & (r < 60) if region != 'body' else (abs(r - g) < 12) & (abs(g - b) < 12) & (r < 200)
    grow = 17 if region != 'aroundhead' else 161  # hats and hair go past the skull, never down the body
    m = Image.fromarray((sel * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(grow))
    if region == 'aroundhead':  # long hair falls to the shoulders: let it go down a little more below the head
        m = Image.fromarray(np.maximum(np.asarray(m), np.roll(np.asarray(m), 80, axis=0)))
    return m


def assemble(context, sex, out, plate_files, region=None):
    plates, k, size = layout(context)
    (w, h), cols, rows, _ = GRIDS[context]
    sheet = Image.new('RGBA', (w * cols, h * rows), (0, 0, 0, 0))
    for plate, path in zip(plates, plate_files):
        src = Image.open(path).resize(size, Image.LANCZOS)
        lifted = src.mode == 'RGBA' and src.split()[3].getextrema()[0] < 255  # already cut out by `lift`
        img = src if lifted else key(src)
        for idx, px, py in plate:
            cw, ch = round(w * k), round(h * k)
            ox, oy = place(context, px, py, cw, ch, size)
            c = img.crop((ox, oy, ox + cw, oy + ch)).resize((w, h), Image.LANCZOS)
            sheet.alpha_composite(c, (idx % cols * w, idx // cols * h))
    allowed = region_mask(context, sex, region)
    if allowed is not None:
        a = np.minimum(np.asarray(sheet.split()[3]), np.asarray(allowed))
        # the untouched mold (flat gray body, its dark outline, the ground shadow) is never part of a piece
        px = np.asarray(sheet.convert('RGB')).astype(int)
        flat = (np.ptp(px, axis=2) < 10) & (((px[..., 0] > 135) & (px[..., 0] < 165)) | ((px[..., 0] > 55) & (px[..., 0] < 85)))
        a = np.where(flat, 0, a).astype(np.uint8)
        sheet.putalpha(Image.fromarray(a))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out)
    print(out)


def lift(base, painted, out, noskin=False, solid=False):
    b = np.asarray(Image.open(base).convert('RGBA')).astype(int)
    p = np.asarray(Image.open(painted).convert('RGBA')).astype(int)
    diff = np.abs(p[..., :3] - b[..., :3]).sum(axis=2)
    magenta = (p[..., 0] > 150) & (p[..., 2] > 150) & (p[..., 1] < 120)
    mask = (((b[..., 3] < 40) & (p[..., 3] > 40)) | ((diff > 70) & (p[..., 3] > 40))) & ~magenta
    if noskin:  # hair: a face the edit repainted a little is not part of the piece
        r, g, bb = p[..., 0], p[..., 1], p[..., 2]
        mask &= ~((r > 235) & (g > 185) & (bb > 150) & (r > g) & (g > bb))
    # an edit is never pixel-identical: drop the thin slivers where the old outlines moved by a pixel or two
    m = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    # parts of the piece that look like what was under them (a tan brim over skin) leave holes: fill enclosed holes
    from PIL import ImageDraw
    outside = m.point(lambda v: 0 if v > 127 else 255)
    ImageDraw.floodfill(outside, (0, 0), 128)
    holes = np.asarray(outside) == 255
    m = Image.fromarray(np.maximum(np.asarray(m), holes.astype(np.uint8) * 255))
    if solid:  # a hat is one solid piece: parts that look like the skin under them (a tan brim) are holes to close
        m = m.filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.MinFilter(31))
        outside = m.point(lambda v: 0 if v > 127 else 255)
        ImageDraw.floodfill(outside, (0, 0), 128)
        m = Image.fromarray(np.maximum(np.asarray(m), (np.asarray(outside) == 255).astype(np.uint8) * 255))
    m = m.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(0.8))
    p[..., 3] = np.minimum(np.asarray(m), p[..., 3])
    Image.fromarray(p.astype(np.uint8), 'RGBA').save(out)
    print(out)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'make':
        base = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--base=')), None)
        make(sys.argv[2], sys.argv[3], base, '--ref' in sys.argv)
    elif cmd == 'assemble':
        region = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--region=')), None)
        assemble(sys.argv[2], sys.argv[3], sys.argv[4], [a for a in sys.argv[5:] if not a.startswith('--')], region)
    elif cmd == 'lift':
        lift(sys.argv[2], sys.argv[3], sys.argv[4], '--noskin' in sys.argv, '--solid' in sys.argv)
