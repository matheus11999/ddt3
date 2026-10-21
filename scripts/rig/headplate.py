"""Rig v2, head pieces painted ONCE (docs/rig-v2.md, "Peças de cabeça"; matheus 21/10).

The head is the same rigid head in almost every cell: in combat it only moves and tilts (measured: 30 of 33 cells
match cell 0 with IoU >= 0.98). So a hat, hair or glasses is painted once per VIEW on a head plate (side, front,
back) over the approved bald head, and this script places that painting in every cell of every context with the
transform measured once from the approved face sheets. The fit no longer depends on the painter: if the cap fits
the plate head, it fits every cell. The game still only stacks sheets (rig.ts is unchanged).

  py scripts/rig/headplate.py measure <sex>            -> scripts/rig/headfit-<sex>.json (cell transforms, from the faces)
  py scripts/rig/headplate.py make <sex> [--with=<item>[,<item>]]
        -> test-results/rig/head/head-<sex>.png: 1536x512, 3 cells of 512 (side, front, back), bald head on magenta;
           --with draws baked pieces on it (hair B under a hat is painted over the head WITH the hat)
  py scripts/rig/headplate.py bake <sex> <item> <painted-plate.png> [--hat|--hair|--glasses] [--base=<plate.png>]
        lifts the piece off the base plate (registered first: a shifted Codex canvas is moved back), applies the hard
        rules (a hat never covers the eyes), writes the plate piece to test-results/rig/head/<item>-<sex>.png and the
        sheets of the three contexts to public/assets/rig/<sex>/{game,show,virtualhead}/<item>.png, then the index.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter

CELL = 512
OUT = 'test-results/rig/head'
GAME = ((228, 190), 13, 3)
SIDE_K, FRONT_K, BACK_K = 4.0, 1.2, 2.5  # plate pixels per sheet pixel: every head ends up about 300 px tall
CENTER = (256, 300)  # head centroid in each plate cell; room above for tall hats


def rgba(path):
    return Image.open(path).convert('RGBA')


def sheet(sex, context, item):
    return rgba(f'public/assets/rig/{sex}/{context}/{item}.png')


def face_id(sex):
    return 'face-basic-male' if sex == 'm' else 'face-basic-female'


def head_mask(cell):
    """The skull of a painted face cell: opaque pixels that are not tears (blue) nor the thin neck strokes."""
    a = np.asarray(cell).astype(int)
    tear = (a[..., 2] > a[..., 0] + 20) & (a[..., 2] > 120)
    m = (a[..., 3] > 128) & ~tear
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))) > 0


def centroid(m):
    ys, xs = np.nonzero(m)
    return float(xs.mean()), float(ys.mean())


def measure(sex):
    """Transform of each combat cell relative to cell 0 (rotation and scale about the centroid, mirror, move)."""
    (w, h), cols, rows = GAME
    face = sheet(sex, 'game', face_id(sex))
    cells = {}
    for i in range(cols * rows):
        c = face.crop((i % cols * w, i // cols * h, i % cols * w + w, i // cols * h + h))
        m = head_mask(c)
        if m.sum() > 200:
            cells[i] = m
    ref = cells[0]
    rc = centroid(ref)
    refimg = Image.fromarray((ref * 255).astype(np.uint8))
    fits = {}
    for i, m in cells.items():
        mc = centroid(m)
        best = (-1, 0, 0, 1.0)
        for flip in (0, 1):
            base = refimg.transpose(Image.FLIP_LEFT_RIGHT) if flip else refimg
            c0 = (w - 1 - rc[0], rc[1]) if flip else rc
            for s in (0.6, 0.7, 0.8, 0.9, 0.95, 1.0, 1.05, 1.1):
                for a in range(-44, 45, 2):
                    r = np.asarray(place(base, c0, mc, a, s, (w, h), Image.NEAREST)) > 0
                    iou = (r & m).sum() / max(1, (r | m).sum())
                    if iou > best[0]:
                        best = (iou, a, flip, s)
        fits[i] = {'iou': round(float(best[0]), 3), 'rot': best[1], 'flip': best[2], 'scale': best[3], 'at': [round(mc[0], 2), round(mc[1], 2)]}
    data = {'_comment': 'headplate.py measure: cell -> transform of the cell-0 head (about its centroid `from`).', 'from': [round(rc[0], 2), round(rc[1], 2)], 'cells': fits}
    path = f'scripts/rig/headfit-{sex}.json'
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, indent=1)
        f.write('\n')
    low = {i: f['iou'] for i, f in fits.items() if f['iou'] < 0.95}
    print(path, len(fits), 'cells; below 0.95:', low)


def place(img, center, at, rot, scale, size, resample=Image.BICUBIC):
    """img rotated by rot degrees and scaled about `center`, with `center` landing on `at`, on a canvas of `size`."""
    import math
    t = math.radians(rot)
    cos, sin = math.cos(t) / scale, math.sin(t) / scale
    # inverse map (output -> input) for Image.transform: x_in = a*x + b*y + c
    a, b = cos, -sin
    d, e = sin, cos
    c = center[0] - a * at[0] - b * at[1]
    f = center[1] - d * at[0] - e * at[1]
    return img.transform(size, Image.AFFINE, (a, b, c, d, e, f), resample=resample)


def views(sex):
    """The three bald heads of the plate and where each sits in its sheet: (image, k, sheet centroid)."""
    (w, h), cols, _ = GAME
    side = sheet(sex, 'game', face_id(sex)).crop((0, 0, w, h))
    front = sheet(sex, 'show', face_id(sex)).crop((0, 0, 500, 684))
    back = sheet(sex, 'virtualhead', face_id(sex)).crop((480, 0, 720, 350))
    return [(side, SIDE_K, centroid(head_mask(side))), (front, FRONT_K, centroid(head_mask(front))), (back, BACK_K, centroid(head_mask(back)))]


def to_plate(img, k, c):
    """A sheet cell scaled by k with its head centroid at CENTER of a 512 cell."""
    big = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
    out = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    pos = (round(CENTER[0] - c[0] * k), round(CENTER[1] - c[1] * k))
    out.paste(big, pos, big)
    # the painted faces leave the eye whites see-through: close the head so the plate shows no magenta inside it
    from PIL import ImageDraw
    solid = Image.fromarray(((np.asarray(out.split()[3]) > 100) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
    ImageDraw.floodfill(solid, (0, 0), 128)
    inside = np.asarray(solid) != 128
    under = Image.new('RGBA', out.size, (0, 0, 0, 0))
    under.paste((250, 248, 245, 255), mask=Image.fromarray((inside * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)))
    under.alpha_composite(out)
    return under


def from_plate(piece, k, c, size):
    """Inverse of to_plate: the plate cell back in sheet pixels (head centroid on c)."""
    small = piece.resize((round(CELL / k), round(CELL / k)), Image.LANCZOS)
    out = Image.new('RGBA', size, (0, 0, 0, 0))
    out.paste(small, (round(c[0] - CENTER[0] / k), round(c[1] - CENTER[1] / k)), small)
    return out


def make(sex, extra=()):
    plate = Image.new('RGBA', (CELL * 3, CELL), (255, 0, 255, 255))
    for n, (img, k, c) in enumerate(views(sex)):
        cell = to_plate(img, k, c)
        for item in extra:
            p = f'{OUT}/{item}-{sex}.png'
            if os.path.exists(p):
                cell.alpha_composite(rgba(p).crop((n * CELL, 0, n * CELL + CELL, CELL)))
        plate.alpha_composite(cell, (n * CELL, 0))
    os.makedirs(OUT, exist_ok=True)
    name = f"{OUT}/head-{sex}{''.join('+' + e for e in extra)}.png"
    plate.convert('RGB').save(name)
    print(name)
    return name


def register(base, painted):
    """Moves the painted plate back over the base: best shift (+-24 px) of the two faces (side, front), by the lower face
    that hats and hair never change. The back has no face: it takes the mean shift of the two."""
    b = np.asarray(base.convert('L')).astype(float)
    p = np.asarray(painted.convert('L')).astype(float)
    out = painted.copy()
    shifts = []

    def diff(n, dx, dy):
        y0, y1, x0, x1 = 300, 470, n * CELL + 96, n * CELL + 416
        return ((p[y0 + dy:y1 + dy, x0 + dx:x1 + dx] - b[y0:y1, x0:x1]) ** 2).mean()

    for n in range(2):
        best = min((diff(n, dx, dy), dx, dy) for dy in range(-24, 25, 2) for dx in range(-24, 25, 2))
        best = min((diff(n, dx, dy), dx, dy) for dy in range(best[2] - 1, best[2] + 2) for dx in range(best[1] - 1, best[1] + 2))
        print(f'  cell {n}: moved back by ({-best[1]},{-best[2]}), face difference {best[0]:.0f}')
        if best[0] > 900:
            raise SystemExit(f'cell {n}: the painter changed the face (difference {best[0]:.0f} > 900); generate again')
        shifts.append(best[1:])
    shifts.append((round((shifts[0][0] + shifts[1][0]) / 2), round((shifts[0][1] + shifts[1][1]) / 2)))
    pad = Image.new('RGB', (painted.width + 64, painted.height + 64), (255, 0, 255))
    pad.paste(painted, (32, 32))
    for n, (dx, dy) in enumerate(shifts):
        out.paste(pad.crop((n * CELL + dx + 32, dy + 32, n * CELL + CELL + dx + 32, CELL + dy + 32)), (n * CELL, 0))
    return out


def eye_guard(sex):
    """Plate areas a hat may never paint over: from the brow down, inside the face (eyes, nose, mouth)."""
    m = np.zeros((CELL, CELL * 3), bool)
    for n, (img, k, c) in enumerate(views(sex)):
        if n == 2:
            continue  # the back has no face
        head = np.asarray(to_plate(img, k, c).split()[3]) > 128
        ys, xs = np.nonzero(head)
        top, bottom = ys.min(), ys.max()
        brow = top + int((bottom - top) * 0.50)
        g = head.copy()
        g[:brow] = False
        g = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(25))) > 0
        m[:, n * CELL:(n + 1) * CELL] = g
    return m


def bake(sex, item, painted, kind, base_path=None):
    base_path = base_path or make(sex)
    base = Image.open(base_path).convert('RGB')
    src = Image.open(painted).convert('RGB').resize(base.size, Image.LANCZOS)
    src = register(base, src)
    os.makedirs(OUT, exist_ok=True)
    tmp_b, tmp_p, lifted = f'{OUT}/_base.png', f'{OUT}/_painted.png', f'{OUT}/{item}-{sex}.png'
    base.save(tmp_b)
    src.save(tmp_p)
    flags = {'hat': ['--solid'], 'hair': ['--noskin'], 'glasses': []}[kind]
    subprocess.run([sys.executable, 'scripts/rig/plates.py', 'lift', tmp_b, tmp_p, lifted, *flags], check=True)
    piece = rgba(lifted)
    if kind == 'hat':
        a = np.asarray(piece.split()[3]).copy()
        a[eye_guard(sex)] = 0
        piece.putalpha(Image.fromarray(a))
    if kind == 'hair':  # the back of a cap seen from behind is not hair: nothing above the hat band is kept by `lift` anyway
        pass
    piece.save(lifted)
    write_sheets(sex, item, piece)


def write_sheets(sex, item, piece):
    (w, h), cols, rows = GAME
    side, front, back = (piece.crop((n * CELL, 0, n * CELL + CELL, CELL)) for n in range(3))
    vs = views(sex)
    fit = json.load(open(f'scripts/rig/headfit-{sex}.json'))
    # combat: the side painting, at high resolution, put on every cell with the measured transform, then scaled down
    hi = 4
    side_hi = from_plate(side, SIDE_K / hi, (vs[0][2][0] * hi, vs[0][2][1] * hi), (w * hi, h * hi))
    rc = [v * hi for v in fit['from']]
    game = Image.new('RGBA', (w * cols, h * rows), (0, 0, 0, 0))
    for i, f in fit['cells'].items():
        i = int(i)
        img, c0 = side_hi, rc
        if f['flip']:
            img, c0 = img.transpose(Image.FLIP_LEFT_RIGHT), [w * hi - 1 - rc[0], rc[1]]
        cell = place(img, c0, [v * hi for v in f['at']], f['rot'], f['scale'], (w * hi, h * hi)).resize((w, h), Image.LANCZOS)
        game.alpha_composite(cell, (i % cols * w, i // cols * h))
    # bag/shop/rooms: the front painting in the show cell
    show = from_plate(front, FRONT_K, vs[1][2], (500, 684))
    # plaza: the front painting in cells 0 and 1 (eyes open, closed), the back painting in cell 2
    head_front = head_mask(sheet(sex, 'virtualhead', face_id(sex)).crop((0, 0, 240, 350)))
    hf = head_mask(vs[1][0])
    vk = FRONT_K * np.sqrt(hf.sum() / head_front.sum())  # same head, smaller: scale from the areas
    vfront = from_plate(front, vk, centroid(head_front), (240, 350))
    vback = from_plate(back, BACK_K, vs[2][2], (240, 350))
    vhead = Image.new('RGBA', (720, 350), (0, 0, 0, 0))
    for n, img in enumerate((vfront, vfront, vback)):
        vhead.alpha_composite(img, (n * 240, 0))
    for context, img in (('game', game), ('show', show), ('virtualhead', vhead)):
        os.makedirs(f'public/assets/rig/{sex}/{context}', exist_ok=True)
        img.save(f'public/assets/rig/{sex}/{context}/{item}.png', optimize=True)
        print(f'public/assets/rig/{sex}/{context}/{item}.png')
    subprocess.run([sys.executable, 'scripts/rig/publish.py', '--index'], check=True)


if __name__ == '__main__':
    cmd, sex = sys.argv[1], sys.argv[2]
    opt = lambda name: next((a.split('=', 1)[1] for a in sys.argv if a.startswith(f'--{name}=')), None)
    if cmd == 'measure':
        measure(sex)
    elif cmd == 'make':
        make(sex, tuple(filter(None, (opt('with') or '').split(','))))
    elif cmd == 'bake':
        kind = 'hat' if '--hat' in sys.argv else 'glasses' if '--glasses' in sys.argv else 'hair'
        bake(sex, sys.argv[3], sys.argv[4], kind, opt('base'))
    elif cmd == 'resheet':  # re-place an already lifted plate piece (after a new measure)
        write_sheets(sex, sys.argv[3], rgba(f'{OUT}/{sys.argv[3]}-{sex}.png'))
