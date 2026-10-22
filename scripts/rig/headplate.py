"""Rig v2, the whole head painted ONCE per view (docs/rig-v2.md, "Peças de cabeça pintadas uma vez"; matheus 21-22/10).

The head is the same rigid head in almost every cell: in combat it only moves and tilts (measured on the mold: 30 of 33
cells match cell 0 with IoU >= 0.98). So the face, the hair, a hat or glasses are painted once per VIEW on a head plate
and this script puts that painting in every cell of every context with the transform measured once from the mold.
The fit no longer depends on the painter: what fits the plate head fits every cell, and the bodies are painted on the
same mold, so the neck meets the collar. The game still only stacks sheets (rig.ts is unchanged).

Head plate, 1536x1024: FRONT view in the left 1024x1024 (bag, rooms, plaza), SIDE view top right 512x512 (combat),
BACK view bottom right 512x512 (plaza walking away). Expression plates for the face: SIDE expressions (3x2 cells of
512: closed, laugh, grimace, cry, oh, ghost) and FRONT blink (2 cells of 768x1024: closed, half).

  py scripts/rig/headplate.py measure <sex>        -> scripts/rig/headfit-<sex>.json (combat cell transforms, from the mold)
  py scripts/rig/headplate.py make <sex> [--with=<item>[,<item>]] [--mold=views|side|blink]
        the plate to paint on: with no face baked yet (or --mold) the GREEN head silhouettes of the mold; otherwise the
        baked face, plus the baked pieces of --with (hair B is painted on the face WITH the hat)
  py scripts/rig/headplate.py face <sex> <face-id> <views.png> <side-expressions.png> <front-blink.png>
        [--side-normal=<side plate>]: the battle face from the TOP-LEFT cell of another side plate (3/4, kit3-face-side34)
        keys out the three painted face plates (each moved back onto the mold silhouettes first) and writes the face
        sheets of the three contexts
  py scripts/rig/headplate.py bake <sex> <item> <painted.png> --hat|--hair|--glasses [--base=<plate.png>]
        lifts the piece off the base plate (registered first by the face, refused if the face changed), applies the
        hard rules (a hat never covers the eyes) and writes the sheets of the three contexts
  py scripts/rig/headplate.py resheet <sex> <item>  re-places an already lifted piece (after a new measure)
  py scripts/rig/headplate.py cleanhat <sex> <item> keeps a hat baked before the hat-area rule inside its outline
Pieces lifted: test-results/rig/head/<item>-<sex>.png (plate-sized). Sheets: public/assets/rig/<sex>/{game,show,virtualhead}/.
"""
import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = 'test-results/rig/head'
PLATE = (1536, 1024)
GAME = ((456, 380), 13, 3)
SHOW = (1000, 1368)
VHEAD = (480, 700)
# where each view sits on the plate: box, head centroid inside the box, head height on the plate
VIEWS = {'front': ((0, 0, 1024, 1024), (512, 600), 600), 'side': ((1024, 0, 1536, 512), (256, 300), 300),
         'back': ((1024, 512, 1536, 1024), (256, 300), 300)}
EXPRESSIONS = ['closed', 'laugh', 'grimace', 'cry', 'oh', 'ghost']  # side plate, 3x2 cells of 512
BLINK = ['closed', 'half']  # front plate, 2 cells of 768x1024
# Which side face each combat cell wears (the DDTank default face, read cell by cell); the rest is 'normal'.
GAME_FACE = {10: 'closed', 13: 'laugh', 14: 'grimace', 15: 'grimace', 16: 'cry', 17: 'cry', 18: 'cry', 34: 'oh', 35: 'oh', 36: 'ghost'}
SHOW_FACE = ['normal', 'normal', 'closed', 'half']  # SHOW face cells (NORMAL_STANDBY blinks with 2 and 3)
MAGENTA, GREEN = (255, 0, 255), (0, 255, 0)


def rgba(path):
    return Image.open(path).convert('RGBA')


def green(path, box=None):
    a = np.asarray(Image.open(path).convert('RGB').crop(box) if box else Image.open(path).convert('RGB')).astype(int)
    return (a[..., 1] > 200) & (a[..., 0] < 60) & (a[..., 2] < 60)


def centroid(m):
    ys, xs = np.nonzero(m)
    return float(xs.mean()), float(ys.mean())


def height(m):
    ys, _ = np.nonzero(m)
    return float(ys.max() - ys.min() + 1)


def mold_heads(sex):
    """The green head of the mold in each view, in sheet pixels: side (combat cell 0), front (bag), back and the plaza front."""
    (w, h), _, _ = GAME
    return {'side': green(f'docs/templates/rig/game-{sex}.png', (0, 0, w, h)),
            'front': green(f'docs/templates/rig/show-{sex}.png'),
            'back': green(f'docs/templates/rig/virtualhead-{sex}.png', (2 * VHEAD[0], 0, 3 * VHEAD[0], VHEAD[1])),
            'vfront': green(f'docs/templates/rig/virtualhead-{sex}.png', (0, 0, VHEAD[0], VHEAD[1]))}


def view_k(heads, view):
    return VIEWS[view][2] / height(heads[view])


def affine(img, center, at, rot, scale, size, resample=Image.BICUBIC):
    """img rotated by `rot` degrees and scaled about `center`, `center` landing on `at`, on a canvas of `size`."""
    t = math.radians(rot)
    a, b, d, e = math.cos(t) / scale, -math.sin(t) / scale, math.sin(t) / scale, math.cos(t) / scale
    return img.transform(size, Image.AFFINE, (a, b, center[0] - a * at[0] - b * at[1], d, e, center[1] - d * at[0] - e * at[1]), resample=resample)


def to_sheet(piece, k, c_plate, c_sheet, size):
    """A plate painting (head centroid c_plate) scaled by 1/k into a sheet cell of `size` with the centroid on c_sheet."""
    small = piece.resize((round(piece.width / k), round(piece.height / k)), Image.LANCZOS)
    out = Image.new('RGBA', size, (0, 0, 0, 0))
    out.paste(small, (round(c_sheet[0] - c_plate[0] / k), round(c_sheet[1] - c_plate[1] / k)), small)
    return out


def view_of(plate, view):
    return plate.crop(VIEWS[view][0])


# ---------------------------------------------------------------- measure
def measure(sex):
    """Transform of each combat cell's head relative to cell 0 (rotation and scale about the centroid, mirror, move)."""
    (w, h), cols, rows = GAME
    mold = f'docs/templates/rig/game-{sex}.png'
    cells = {i: green(mold, (i % cols * w, i // cols * h, i % cols * w + w, i // cols * h + h)) for i in range(cols * rows)}
    cells = {i: m for i, m in cells.items() if m.sum() > 800}
    # tears and the ghost's tail are thin: an opening leaves only the head
    cells = {i: np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(17)).filter(ImageFilter.MaxFilter(17))) > 0 for i, m in cells.items()}
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
                    r = np.asarray(affine(base, c0, mc, a, s, (w, h), Image.NEAREST)) > 0
                    iou = (r & m).sum() / max(1, (r | m).sum())
                    if iou > best[0]:
                        best = (iou, a, flip, s)
        if best[0] < 0.85:
            # tears or the ghost's tail around the head: the biggest upright head that sits inside the green
            cand = []
            for s in (0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05):
                for a in range(-20, 21, 2):
                    for dx in range(-24, 25, 4):
                        for dy in range(-24, 25, 4):
                            r = np.asarray(affine(refimg, rc, (mc[0] + dx, mc[1] + dy), a, s, (w, h), Image.NEAREST)) > 0
                            cand.append(((r & m).sum() / max(1, r.sum()), s, a, dx, dy))
            inside = [c for c in cand if c[0] >= 0.97] or [max(cand)]
            prec, s, a, dx, dy = max(inside, key=lambda c: (c[1], c[0]))
            best = (prec, a, 0, s)
            mc = (mc[0] + dx, mc[1] + dy)
        fits[i] = {'iou': round(float(best[0]), 3), 'rot': best[1], 'flip': best[2], 'scale': best[3], 'at': [round(mc[0], 2), round(mc[1], 2)]}
    data = {'_comment': 'headplate.py measure: combat cell -> transform of the cell-0 head of the mold (about its centroid `from`), 4x grid.',
            'from': [round(rc[0], 2), round(rc[1], 2)], 'cells': fits}
    path = f'scripts/rig/headfit-{sex}.json'
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, indent=1)
        f.write('\n')
    print(path, len(fits), 'cells; below 0.95:', {i: f['iou'] for i, f in fits.items() if f['iou'] < 0.95})


# ---------------------------------------------------------------- plates
def silhouette(heads, view, k, size, center):
    m = Image.fromarray((heads[view] * 255).astype(np.uint8))
    m = m.resize((round(m.width * k), round(m.height * k)), Image.LANCZOS)
    c = centroid(heads[view])
    out = Image.new('L', size, 0)
    out.paste(m, (round(center[0] - c[0] * k), round(center[1] - c[1] * k)))
    return np.asarray(out) > 127


def mold_plate(sex, kind='views'):
    """GREEN head silhouettes on magenta, outlined, for painting the face."""
    heads = mold_heads(sex)
    plate = np.zeros(PLATE[::-1] + (3,), np.uint8)
    plate[:] = MAGENTA
    mask = np.zeros(PLATE[::-1], bool)
    if kind == 'views':
        for view, (box, center, _) in VIEWS.items():
            mask[box[1]:box[3], box[0]:box[2]] = silhouette(heads, view, view_k(heads, view), (box[2] - box[0], box[3] - box[1]), center)
    elif kind == 'side':
        k = view_k(heads, 'side')
        for n in range(6):
            x0, y0 = n % 3 * 512, n // 3 * 512
            mask[y0:y0 + 512, x0:x0 + 512] = silhouette(heads, 'side', k, (512, 512), VIEWS['side'][1])
    else:
        k = view_k(heads, 'front')
        for n in range(2):
            mask[:, n * 768:n * 768 + 768] = silhouette(heads, 'front', k, (768, 1024), (384, 600))
    edge = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
    plate[edge & ~mask] = (70, 70, 70)
    plate[mask] = GREEN
    return Image.fromarray(plate, 'RGB'), mask


def make(sex, extra=(), mold=None):
    os.makedirs(OUT, exist_ok=True)
    face = next((f for f in sorted(os.listdir(OUT)) if f.startswith('face-') and f.endswith(f'-views-{sex}.png')), None) if os.path.isdir(OUT) else None
    if mold or not face:
        plate, _ = mold_plate(sex, mold or 'views')
        name = f'{OUT}/mold-{mold or "views"}-{sex}.png'
        plate.save(name)
        print(name)
        return name
    plate = Image.new('RGBA', PLATE, MAGENTA + (255,))
    plate.alpha_composite(rgba(f'{OUT}/{face}'))
    for item in extra:
        plate.alpha_composite(rgba(f'{OUT}/{item}-{sex}.png'))
    name = f"{OUT}/head-{sex}{''.join('+' + e for e in extra)}.png"
    plate.convert('RGB').save(name)
    print(name)
    return name


def key(img):
    """Magenta (and leftover green) out, with a soft edge."""
    a = np.asarray(img.convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    out = (r > 160) & (b > 160) & (g < 120) | (g > 170) & (r < 130) & (b < 130)
    alpha = np.asarray(Image.fromarray((~out * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8)))
    return Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), 'RGBA')


def fit_to_mold(painted, mask, cells):
    """Moves each painted cell (box) back so its opaque part best covers the mold silhouette (+-32 px)."""
    alpha = np.asarray(painted.split()[3]) > 128
    out = Image.new('RGBA', painted.size, (0, 0, 0, 0))
    for x0, y0, x1, y1 in cells:
        a, m = alpha[y0:y1, x0:x1], mask[y0:y1, x0:x1]
        best = max((((np.roll(np.roll(a, dy, 0), dx, 1) & m).sum() / max(1, (np.roll(np.roll(a, dy, 0), dx, 1) | m).sum()), dx, dy)
                    for dy in range(-32, 33, 4) for dx in range(-32, 33, 4)))
        _, dx, dy = best
        cell = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
        cell.paste(painted.crop((x0, y0, x1, y1)), (dx, dy))
        out.paste(cell, (x0, y0))
        cover = (np.asarray(cell.split()[3])[m] > 128).mean()
        print(f'  cell {x0},{y0}: moved ({dx},{dy}), covers {cover:.0%} of the head')
        if cover < 0.9:
            raise SystemExit(f'cell {x0},{y0}: the face does not fill the head silhouette ({cover:.0%}); generate again')
    return out


def face(sex, item, views, side, blink, side_normal=None):
    os.makedirs(OUT, exist_ok=True)
    plates = {}
    for kind, path, cells in (('views', views, [v[0] for v in VIEWS.values()]),
                              ('side', side, [(n % 3 * 512, n // 3 * 512, n % 3 * 512 + 512, n // 3 * 512 + 512) for n in range(6)]),
                              ('blink', blink, [(n * 768, 0, n * 768 + 768, 1024) for n in range(2)])):
        _, mask = mold_plate(sex, kind)
        painted = key(Image.open(path).convert('RGB').resize(PLATE, Image.LANCZOS))
        print(kind)
        plates[kind] = fit_to_mold(painted, mask, cells)
        plates[kind].save(f'{OUT}/{item}-{kind}-{sex}.png')
    heads = mold_heads(sex)
    side_faces = {'normal': view_of(plates['views'], 'side')}
    if side_normal:  # the battle face turned a little toward the viewer (matheus 22/10): TOP-LEFT cell of a side plate
        _, mask = mold_plate(sex, 'side')
        painted = key(Image.open(side_normal).convert('RGB').resize(PLATE, Image.LANCZOS))
        side_faces['normal'] = fit_to_mold(painted, mask, [(0, 0, 512, 512)]).crop((0, 0, 512, 512))
        side_faces['normal'].save(f'{OUT}/{item}-side-normal-{sex}.png')
        # the plate the hair and hats are painted on shows this face too, so their side view fits it
        box = VIEWS['side'][0]
        plates['views'].paste(Image.new('RGBA', side_faces['normal'].size, (0, 0, 0, 0)), box[:2])
        plates['views'].paste(side_faces['normal'], box[:2])
        plates['views'].save(f'{OUT}/{item}-views-{sex}.png')
    for n, name in enumerate(EXPRESSIONS):
        side_faces[name] = plates['side'].crop((n % 3 * 512, n // 3 * 512, n % 3 * 512 + 512, n // 3 * 512 + 512))
    front_faces = {'normal': view_of(plates['views'], 'front')}
    for n, name in enumerate(BLINK):  # the 768x1024 cells, centered like the 1024x1024 front box
        cell = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
        cell.paste(plates['blink'].crop((n * 768, 0, n * 768 + 768, 1024)), (128, 0))
        front_faces[name] = cell
    game = game_sheet(sex, heads, lambda i: side_faces[GAME_FACE.get(i, 'normal')])
    show = Image.new('RGBA', (SHOW[0] * 4, SHOW[1]), (0, 0, 0, 0))
    for n, name in enumerate(SHOW_FACE):
        show.alpha_composite(front_sheet(heads, front_faces[name], 'front', SHOW), (n * SHOW[0], 0))
    vhead = virtual_sheet(heads, front_faces['normal'], front_faces['closed'], view_of(plates['views'], 'back'))
    publish(sex, item, game, show, vhead)


# ---------------------------------------------------------------- sheets
def game_sheet(sex, heads, side_for):
    """The side painting of each cell (side_for(i)) at its measured transform, worked at plate scale, then scaled down."""
    (w, h), cols, rows = GAME
    fit = json.load(open(f'scripts/rig/headfit-{sex}.json'))
    k = view_k(heads, 'side')
    W, H = round(w * k), round(h * k)
    rc = [v * k for v in fit['from']]
    sheet = Image.new('RGBA', (w * cols, h * rows), (0, 0, 0, 0))
    for i, f in fit['cells'].items():
        i = int(i)
        side = side_for(i)
        big = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        center = VIEWS['side'][1]
        big.paste(side, (round(rc[0] - center[0]), round(rc[1] - center[1])), side)
        c0 = rc
        if f['flip']:
            big, c0 = big.transpose(Image.FLIP_LEFT_RIGHT), [W - 1 - rc[0], rc[1]]
        cell = affine(big, c0, [v * k for v in f['at']], f['rot'], f['scale'], (W, H)).resize((w, h), Image.LANCZOS)
        sheet.alpha_composite(cell, (i % cols * w, i // cols * h))
    return sheet


def front_sheet(heads, painting, view, size, mold_view=None):
    """A front or back painting (plate box) in a sheet cell, centroid on the mold's head."""
    box, center, _ = VIEWS[view]
    k = view_k(heads, view)
    target = mold_view or view
    if target != view:  # the plaza front head is the bag head, smaller
        k = k * height(heads[view]) / height(heads[target])
    return to_sheet(painting, k, center, centroid(heads[target]), size)


def virtual_sheet(heads, front_open, front_closed, back):
    vhead = Image.new('RGBA', (VHEAD[0] * 3, VHEAD[1]), (0, 0, 0, 0))
    for n, img in enumerate((front_sheet(heads, front_open, 'front', VHEAD, 'vfront'), front_sheet(heads, front_closed, 'front', VHEAD, 'vfront'),
                             front_sheet(heads, back, 'back', VHEAD))):
        vhead.alpha_composite(img, (n * VHEAD[0], 0))
    return vhead


def publish(sex, item, game, show, vhead):
    for context, img in (('game', game), ('show', show), ('virtualhead', vhead)):
        os.makedirs(f'public/assets/rig/{sex}/{context}', exist_ok=True)
        img.save(f'public/assets/rig/{sex}/{context}/{item}.png', optimize=True)
        print(f'public/assets/rig/{sex}/{context}/{item}.png')
    subprocess.run([sys.executable, 'scripts/rig/publish.py', '--index'], check=True)


def write_sheets(sex, item, piece):
    heads = mold_heads(sex)
    side, front, back = (view_of(piece, v) for v in ('side', 'front', 'back'))
    game = game_sheet(sex, heads, lambda i: side)
    show = front_sheet(heads, front, 'front', SHOW)
    publish(sex, item, game, show, virtual_sheet(heads, front, front, back))


# ---------------------------------------------------------------- pieces over the face
def head_box(heads, view):
    """The head of a view on the plate: (mask in plate coordinates)."""
    box, center, _ = VIEWS[view]
    m = np.zeros(PLATE[::-1], bool)
    m[box[1]:box[3], box[0]:box[2]] = silhouette(heads, view, view_k(heads, view), (box[2] - box[0], box[3] - box[1]), center)
    return m


def register(base, painted, keep=None):
    """Moves the painted plate back over the base: best shift (+-32 px) of the faces (front, side) on the lower face,
    which hats and hair never change. The back has no face: it takes the mean shift. `keep` marks pixels the face
    check skips when they are hair-coloured (fringe and sideburns are the piece, not a changed face)."""
    heads = mold_heads(sex_of(base))
    b = np.asarray(base.convert('L')).astype(float)
    p = np.asarray(painted.convert('L')).astype(float)
    pc = np.asarray(painted.convert('RGB')).astype(int)
    hairy = (pc[..., 0] - pc[..., 2] > 40) & (pc[..., 0] < 200) & (pc[..., 1] < 150)
    pad = 40
    P = np.pad(p, pad, mode='edge')
    H = np.pad(hairy, pad)
    shifts = {}
    for view in ('front', 'side'):
        m = head_box(heads, view)
        ys, xs = np.nonzero(m)
        y0 = int(ys.min() + (ys.max() - ys.min()) * 0.55)
        sel = m.copy()
        sel[:y0] = False
        yy, xx = np.nonzero(sel)

        def diff(dx, dy):
            d = (P[yy + dy + pad, xx + dx + pad] - b[yy, xx]) ** 2
            if keep is not None:
                d = d[~(H[yy + dy + pad, xx + dx + pad] & keep[yy, xx])]
            return d.mean()

        best = min((diff(dx, dy), dx, dy) for dy in range(-32, 33, 4) for dx in range(-32, 33, 4))
        best = min((diff(dx, dy), dx, dy) for dy in range(best[2] - 3, best[2] + 4) for dx in range(best[1] - 3, best[1] + 4))
        print(f'  {view}: moved back by ({-best[1]},{-best[2]}), face difference {best[0]:.0f}')
        if best[0] > 900:
            raise SystemExit(f'{view}: the painter changed the face (difference {best[0]:.0f} > 900); generate again')
        shifts[view] = best[1:]
    shifts['back'] = (round((shifts['front'][0] + shifts['side'][0]) / 2), round((shifts['front'][1] + shifts['side'][1]) / 2))
    padded = Image.new('RGB', (painted.width + 2 * pad, painted.height + 2 * pad), MAGENTA)
    padded.paste(painted, (pad, pad))
    out = painted.copy()
    for view, (dx, dy) in shifts.items():
        x0, y0, x1, y1 = VIEWS[view][0]
        out.paste(padded.crop((x0 + dx + pad, y0 + dy + pad, x1 + dx + pad, y1 + dy + pad)), (x0, y0))
    return out


_SEX = {}


def sex_of(_):
    return _SEX['sex']


def eye_guard(sex, at=0.50):
    """Plate areas a hat may never paint over: from `at` of the head height down, inside the face (eyes, nose, mouth)."""
    heads = mold_heads(sex)
    g = np.zeros(PLATE[::-1], bool)
    for view in ('front', 'side'):
        m = head_box(heads, view)
        ys, _ = np.nonzero(m)
        m[:int(ys.min() + (ys.max() - ys.min()) * at)] = False
        g |= np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(41))) > 0
    return g


def bake(sex, item, painted, kind, base_path=None):
    _SEX['sex'] = sex
    base_path = base_path or make(sex)
    base = Image.open(base_path).convert('RGB')
    src = Image.open(painted).convert('RGB').resize(base.size, Image.LANCZOS)
    src = register(base, src, ~eye_guard(sex, 0.58) if kind == 'hair' else None)
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
        piece = clean_hat_plate(piece)
    piece.save(lifted)
    write_sheets(sex, item, piece)


# ---------------------------------------------------------------- hat area
def _components(mask):
    """4-connected components of a mask, each as an (n, 2) array of (y, x)."""
    from collections import deque
    h, w = mask.shape
    seen = np.zeros(mask.shape, bool)
    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        seen[sy, sx] = True
        pts, q = [], deque([(sy, sx)])
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True
                    q.append((yy, xx))
        yield np.array(pts)


def _grow(mask, size):
    return np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(size))) > 0


def hat_area(cell, back=False):
    """Keeps a hat inside its own outline (matheus 22/10: forehead skin under the brim and skin in the back strap).
    The painted hat is a closed shape with a dark outline; what the lift brings along from the head under it (the
    forehead under the brim, the nape under the rim) lies OUTSIDE that outline and touches the transparent area. Each
    pass closes the outline a bit less and drops the patches between the outline and the outside, never a big part
    (the brim itself). Seen from behind there is no brim: a patch of skin enclosed low in the hat is the strap
    opening and must show the hair. Tiny loose bits go last. RGBA array in, RGBA array out."""
    out = cell.copy()
    for grow, th in ((9, 110), (5, 110), (3, 110), (3, 80)):
        c = out.astype(int)
        a = c[..., 3]
        solid = a > 40
        if not solid.any():
            return out
        lum = .3 * c[..., 0] + .59 * c[..., 1] + .11 * c[..., 2]
        line = _grow(solid & (lum < th), grow)
        outside = _grow(~solid, 3)
        total, low = solid.sum(), np.nonzero(solid)[0].mean()
        kill = np.zeros(solid.shape, bool)
        for pts in _components(solid & ~line):
            ys, xs = pts[:, 0], pts[:, 1]
            if len(pts) > .08 * total:
                continue
            r, g, b = c[ys, xs, :3].mean(0)
            hole = back and r > b + 60 and r > 170 and ys.mean() > low and len(pts) > .004 * total
            if (outside[ys, xs].any() and len(pts) > 20) or hole:
                kill[ys, xs] = True
        kill = _grow(kill, grow + 2) & ~(line & ~kill & (lum < th))
        out[..., 3] = np.where(kill, 0, out[..., 3])
    solid = out[..., 3] > 40
    total = solid.sum()
    for pts in _components(solid):
        if len(pts) < .002 * total:
            out[pts[:, 0], pts[:, 1], 3] = 0
    return out


def clean_hat_plate(piece):
    """hat_area on each view of a lifted plate."""
    a = np.array(piece.convert('RGBA'))
    for view, (box, _, _) in VIEWS.items():
        x0, y0, x1, y1 = box
        a[y0:y1, x0:x1] = hat_area(a[y0:y1, x0:x1], view == 'back')
    return Image.fromarray(a)


def clean_hat_sheets(sex, item):
    """hat_area on the published sheets, cell by cell (for a hat baked before the rule)."""
    (gw, gh), _, _ = GAME
    for context, (cw, ch) in (('game', (gw, gh)), ('show', SHOW), ('virtualhead', VHEAD)):
        path = f'public/assets/rig/{sex}/{context}/{item}.png'
        a = np.array(Image.open(path).convert('RGBA'))
        for y in range(0, a.shape[0], ch):
            for x in range(0, a.shape[1], cw):
                a[y:y + ch, x:x + cw] = hat_area(a[y:y + ch, x:x + cw], context == 'virtualhead' and x // cw == 2)
        Image.fromarray(a).save(path, optimize=True)
        print(path)


if __name__ == '__main__':
    cmd, sex = sys.argv[1], sys.argv[2]
    opt = lambda name: next((a.split('=', 1)[1] for a in sys.argv if a.startswith(f'--{name}=')), None)
    _SEX['sex'] = sex
    if cmd == 'measure':
        measure(sex)
    elif cmd == 'make':
        make(sex, tuple(filter(None, (opt('with') or '').split(','))), opt('mold'))
    elif cmd == 'face':
        face(sex, *sys.argv[3:7], opt('side-normal'))
    elif cmd == 'bake':
        kind = 'hat' if '--hat' in sys.argv else 'glasses' if '--glasses' in sys.argv else 'hair'
        bake(sex, sys.argv[3], sys.argv[4], kind, opt('base'))
    elif cmd == 'cleanhat':
        clean_hat_sheets(sex, sys.argv[3])
    elif cmd == 'resheet':
        write_sheets(sex, sys.argv[3], rgba(f'{OUT}/{sys.argv[3]}-{sex}.png'))
