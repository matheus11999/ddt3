"""Packs an outfit's two Codex combat sheets (docs/combat-frames.md) into the game's combat atlas.

Each sheet is 3x2 cells of 512 px on magenta with the head as a flat green silhouette; the hands are painted
in the sheet over the template's skin discs, like DDTank (older sheets left cyan discs for code-drawn fists). Per frame this script keys the magenta and the
cyan out, finds the green head (top and width; fists may cover the chin), scales the
sheet so the head matches the universal head, removes the green, and places the body in its atlas cell
with the head at the contract's x and the lowest painted row on the ground line. The measured head
height of every frame goes to src/game/combatAtlas.json, so the game puts the player's head exactly
where the painting expects it. No per-outfit numbers.

Usage: python3 scripts/build-combat-atlas.py <outfit-id> [ground.png throw.png]   ('-' keeps that sheet's frames from the current atlas)
       python3 scripts/build-combat-atlas.py --fist fist.png   (the universal fist, docs/combat-art-prompts/fist.txt)
Default input: test-results/codex-combat/out/<id without outfit->-{ground,throw}.png
Output: public/assets/outfits/combat/<id>.png, src/game/combatAtlas.json, test-results/combat/<id>/"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
try:
    from scipy import ndimage
except ImportError:  # optional: only drops stray specks
    ndimage = None

contract = json.load(open('src/game/rig/combatFrames.json'))
T, A, HS = contract['template'], contract['atlas'], contract['headSilhouette']
NAMES = list(contract['frames'])
outfit = sys.argv[1]
short = outfit.removeprefix('outfit-')
inputs = sys.argv[2:4] or [f'test-results/codex-combat/out/{short}-{s["name"]}.png' for s in contract['sheets']]
report_dir = f'test-results/combat/{outfit}'
os.makedirs(report_dir, exist_ok=True)
os.makedirs('public/assets/outfits/combat', exist_ok=True)

head_px = HS['width'] * contract['headScale'] * contract['avatarUnit'] * A['pixelsPerUnit']  # head width in the atlas
aspect = HS['height'] / HS['width']


def unkey(rgb):
    """Magenta -> alpha with a soft edge and the pink spill removed (same rule as shared/mapBuilder.ts unkey)."""
    r, g, b = (rgb[..., k].astype(float) for k in range(3))
    key = np.minimum(r, b) - g
    alpha = np.clip((150 - key) / 110, 0, 1)
    edge = (key > 40) & (key <= 150)
    low = np.minimum(r, b)
    r = np.where(edge, np.minimum(r, g + (r - low) + 40), r)
    b = np.where(edge, np.minimum(b, g + (b - low) + 60), b)
    return np.dstack([r, g, b, alpha * 255])


if sys.argv[1] == '--fist':
    rgba = unkey(np.asarray(Image.open(sys.argv[2]).convert('RGB')))
    fist = Image.fromarray(rgba.astype('uint8'), 'RGBA')
    fist = fist.crop(fist.getbbox())
    fist.thumbnail((64, 64), Image.LANCZOS)
    fist.save('public/assets/outfits/combat/fist.png', optimize=True)
    print('public/assets/outfits/combat/fist.png', fist.size)
    sys.exit(0)


def grow(mask, size):
    """Dilates a mask by size//2 px: the key colors' anti-aliased rim must go with them."""
    return np.asarray(Image.fromarray((mask * 255).astype('uint8')).filter(ImageFilter.MaxFilter(size))) > 0


def greenness(rgb):
    r, g, b = (rgb[..., k].astype(float) for k in range(3))
    return g - np.maximum(r, b)


def components(mask):
    """Connected pixel groups of a boolean mask, largest first (4-neighbour flood fill)."""
    seen, groups = np.zeros_like(mask), []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        stack, group = [(y, x)], []
        seen[y, x] = True
        while stack:
            cy, cx = stack.pop()
            group.append((cy, cx))
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        groups.append(np.array(group))
    return sorted(groups, key=len, reverse=True)


def split_fists(atlas, index, head, spec):
    """Lying frames: lifts the painted fists out of the body painting and returns where they were, so the
    game draws them as clean outlined fists, the far one behind the head and the near one over the chin
    (a painted fist cut along the green silhouette left a see-through gap next to every player's face).
    The far sleeve's bits over the face go too. Returns [[x, y, r], ...] in avatar units, near fist first."""
    ppu, (cw, ch), (ox, oy) = A['pixelsPerUnit'], A['cell'], A['origin']
    box = ((index % A['columns']) * cw, (index // A['columns']) * ch)
    cell = np.asarray(atlas.crop((*box, box[0] + cw, box[1] + ch))).astype(int).copy()
    r, g, b, a = (cell[..., k].astype(float) for k in range(4))
    hi, lo = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    sat = (hi - lo) / np.maximum(hi, 1)
    # Skin in any of its painted tones: warm, light, moderately saturated (not the gold trims or the white cuff).
    skin = (a > 60) & (r >= g) & (g >= b - 4) & (hi > 150) & (sat > .14) & (sat < .5) & (r - g < 70)
    dx, dy = head[0] - spec['head'][0], head[1] - spec['head'][1]
    found = []
    for fx, fy, _ in spec['fists']:
        px, py = ox + (fx + dx) * ppu, oy + (fy + dy) * ppu
        window = np.zeros(skin.shape, bool)
        window[max(0, round(py - 30)):round(py + 30), max(0, round(px - 34)):round(px + 34)] = True
        blobs = [blob for blob in components(skin & window) if len(blob) > 60]
        if not blobs:
            return None
        found.append(min(blobs, key=lambda blob: np.hypot(blob[:, 1].mean() - px, blob[:, 0].mean() - py) - len(blob) / 20))
    near, far = found
    # Every fist is the template's size; its free edges (the bottom, and the right one of the far fist) place it.
    radius = contract['fist']['size'] * .5 * ppu
    wide = np.ptp(near[:, 1]) + 1 >= radius * 1.6
    fists = [((near[:, 1].min() + near[:, 1].max()) / 2 if wide else near[:, 1].max() - radius, near[:, 0].max() - radius * .75),
             (far[:, 1].max() - radius, far[:, 0].max() - radius * .9)]
    yy, xx = np.mgrid[:ch, :cw]
    for (x, y), blob in zip(fists, found):
        mask = np.zeros(skin.shape, bool)
        mask[blob[:, 0], blob[:, 1]] = True
        cell[grow(mask, 5) | (np.hypot(xx - x, yy - y) < radius + 5), 3] = 0
    # Lying, the whole body is behind (left of) the near fist: whatever of the far arm shows past it goes.
    cell[xx > fists[0][0] + radius * .5, 3] = 0
    for blob in components(cell[..., 3] > 0)[1:]:
        if len(blob) < 60:
            cell[blob[:, 0], blob[:, 1], 3] = 0
    atlas.paste(Image.fromarray(cell.astype('uint8'), 'RGBA'), box)
    return [[round((x - ox) / ppu, 2), round((y - oy) / ppu, 2), round(radius / ppu, 2)] for x, y in fists]


issues, frames_meta, warnings = [], [None] * len(NAMES), []
atlas = Image.new('RGBA', (A['columns'] * A['cell'][0], A['rows'] * A['cell'][1]), (0, 0, 0, 0))
silhouette = None
size_limits = []
previous = json.load(open('src/game/combatAtlas.json')).get(outfit) if os.path.exists('src/game/combatAtlas.json') else None
for sheet, path in zip(contract['sheets'], inputs):
    if path == '-':
        # Keep this sheet as it is in the current atlas (repainting one sheet at a time).
        old = Image.open(f'public/assets/outfits/combat/{outfit}.png').convert('RGBA')
        (ow, oh), (oox, ooy) = previous.get('cell', [260, 180]), previous.get('origin', [160, 160])
        for name in sheet['frames']:
            index = NAMES.index(name)
            box = ((index % A['columns']) * A['cell'][0], (index // A['columns']) * A['cell'][1])
            src = ((index % A['columns']) * ow, (index // A['columns']) * oh)
            piece = old.crop((*src, src[0] + ow, src[1] + oh))
            layer = Image.new('RGBA', tuple(A['cell']), (0, 0, 0, 0))
            layer.paste(piece, (A['origin'][0] - oox, A['origin'][1] - ooy))
            atlas.alpha_composite(layer, box)
            frames_meta[index] = previous['frames'][index]
        continue
    src = Image.open(path).convert('RGB')
    if src.size != (T['cell'] * T['columns'], T['cell'] * T['rows']):
        src = src.resize((T['cell'] * T['columns'], T['cell'] * T['rows']), Image.LANCZOS)
    rgb = np.asarray(src)
    rgba = unkey(rgb)
    green = greenness(rgb)
    head_mask = (green > 90) & (rgb[..., 1] > 150)
    # Cyan discs mark the universal fists: nothing of the outfit is painted there.
    r_, g_, b_ = (rgb[..., k].astype(float) for k in range(3))
    cyan = (np.minimum(g_, b_) - r_ > 60) & (g_ > 120) & (b_ > 120)
    rgba[grow(cyan, 7), 3] = 0
    # Fists painted in the skin tone over the template's discs: the game draws no hands on these frames.
    hands = cyan.sum() < 200
    # Anti-aliased rim between the green head and the body or the background.
    rim = (green > 35) & ~head_mask
    measured = []
    for i, name in enumerate(sheet['frames']):
        cx, cy = (i % T['columns']) * T['cell'], (i // T['columns']) * T['cell']
        cell = slice(cy, cy + T['cell']), slice(cx, cx + T['cell'])
        hm = head_mask[cell]
        ys, xs = np.nonzero(hm)
        if len(xs) < 500:
            issues.append(f'{sheet["name"]} {name}: cabeça verde não encontrada')
            measured.append(None)
            continue
        # The widest rows give the head width; the top row its height. The chin may be under the fists.
        left, right, top = np.percentile(xs, 0.3), np.percentile(xs, 99.7), np.percentile(ys, 0.3)
        width = right - left + 1
        measured.append((cx + (left + right) / 2, cy + top + width * aspect / 2, width))
        body = rgba[cell][..., 3] > 128
        border = np.concatenate([body[:4].ravel(), body[-4:].ravel(), body[:, :4].ravel(), body[:, -4:].ravel()])
        if border.any():
            warnings.append(f'{sheet["name"]} {name}: pintura encosta na borda da célula')
    widths = [m[2] for m in measured if m]
    if not widths:
        continue
    median = float(np.median(widths))
    for m, name in zip(measured, sheet['frames']):
        if m and abs(m[2] / median - 1) > .1:
            warnings.append(f'{sheet["name"]} {name}: cabeça {m[2] / median:.0%} da mediana da prancha')
    scale = head_px / median
    clean = rgba.copy()
    # Only pixels that still carry green go: a blind band around the head would cut the fists' and collar's outlines.
    clean[(grow(head_mask | rim, 7) & (green > 8)) | head_mask | rim, 3] = 0
    # A soft green edge over the magenta leaves a gray seam (half magenta, half green: r = b, r + g = 255).
    seam = grow(head_mask, 9) & (np.abs(r_ - b_) < 45) & (np.abs(r_ + g_ - 255) < 70) & (g_ > 40) & (r_ > 40)
    clean[seam, 3] = 0
    if ndimage is not None:
        # Lone specks left by the key (a few pixels of the head's edge) go; the painting is one big piece.
        labels, count = ndimage.label(clean[..., 3] > 24)
        if count:
            sizes = ndimage.sum(np.ones_like(labels), labels, range(1, count + 1))
            clean[np.isin(labels, np.nonzero(sizes < 60)[0] + 1), 3] = 0
    for i, (m, name) in enumerate(zip(measured, sheet['frames'])):
        if not m:
            continue
        hx, hy, _ = m
        cx, cy = (i % T['columns']) * T['cell'], (i // T['columns']) * T['cell']
        figure = clean[cy:cy + T['cell'], cx:cx + T['cell']].copy()
        # Paint above the chin band inside the head belongs to nothing: the real head is drawn there.
        sw, sh = median, median * aspect
        mask = Image.new('L', (T['cell'], T['cell']), 0)
        ImageDraw.Draw(mask).ellipse([hx - cx - sw / 2, hy - cy - sh / 2, hx - cx + sw / 2, hy - cy + sh * .2], fill=255)
        # ...except the painted arms and fists, which may cross the head's lower half (the wind-up).
        keep = ImageDraw.Draw(mask)
        ox_, oy_ = sheet['origin']
        for k_, (fx, fy, _) in enumerate(contract['frames'][name]['fists']):
            elbow = contract['mannequin'][name]['sleeves'][k_][1]
            P = lambda q: (ox_ + q[0] * T['pixelsPerUnit'], oy_ + q[1] * T['pixelsPerUnit'])
            keep.line([P(elbow), P((fx, fy))], fill=0, width=round(10 * T['pixelsPerUnit']))
            r = contract['fist']['size'] * .7 * T['pixelsPerUnit']
            x, y = P((fx, fy)); keep.ellipse([x - r, y - r, x + r, y + r], fill=0)
        figure[np.asarray(mask) > 0, 3] = 0
        # Optional per-sheet shrink of an older, bigger painting: the body scales about the chin, so the
        # neck stays under the head and the head comes down with the smaller body.
        k = sheet.get('bodyScale', 1)
        if k != 1:
            chin = (hx - cx, hy - cy + sh * .45)
            img = Image.fromarray(figure.astype('uint8'), 'RGBA')
            img = img.transform(img.size, Image.AFFINE, (1 / k, 0, chin[0] - chin[0] / k, 0, 1 / k, chin[1] - chin[1] / k), Image.BICUBIC)
            figure = np.asarray(img).astype(float)
        solid = np.nonzero(figure[..., 3] > 128)
        if len(solid[0]) < 2000:
            issues.append(f'{sheet["name"]} {name}: corpo quase vazio')
            continue
        ground = solid[0].max() + 1
        # DDTank proportions: the body stays the size of the gray mannequin of the template.
        tall = (ground - solid[0].min()) * head_px / median / A['pixelsPerUnit']
        wide = (solid[1].max() - solid[1].min() + 1) * head_px / median / A['pixelsPerUnit']
        size_limits.append((name, wide, tall))
        piece = Image.fromarray(figure.astype('uint8'), 'RGBA')
        piece = piece.resize((round(T['cell'] * scale), round(T['cell'] * scale)), Image.LANCZOS)
        index = NAMES.index(name)
        spec = contract['frames'][name]
        ax = (index % A['columns']) * A['cell'][0] + A['origin'][0]
        ay = (index // A['columns']) * A['cell'][1] + A['origin'][1]
        target_x = ax + spec['head'][0] * A['pixelsPerUnit']
        ox, oy = round(target_x - (hx - cx) * scale), round(ay - ground * scale)
        cell_img = Image.new('RGBA', atlas.size, (0, 0, 0, 0))
        cell_img.paste(piece, (ox, oy))
        # Keep each frame inside its own cell.
        box = ((index % A['columns']) * A['cell'][0], (index // A['columns']) * A['cell'][1])
        own = cell_img.crop((box[0], box[1], box[0] + A['cell'][0], box[1] + A['cell'][1]))
        lost = np.asarray(cell_img)[..., 3].astype(bool).sum() - np.asarray(own)[..., 3].astype(bool).sum()
        if lost > 50:
            warnings.append(f'{name}: {lost} px fora da célula do atlas')
        atlas.alpha_composite(own, box)
        head_y = (hy - cy - ground) * scale / A['pixelsPerUnit']
        frames_meta[index] = {'head': [spec['head'][0], round(head_y, 2)], **({'hands': True} if hands else {})}
        if hands and (name in ('rest', 'hurt') or name.startswith('crawl')):
            fists = split_fists(atlas, index, frames_meta[index]['head'], spec)
            if fists:
                frames_meta[index]['lifted'] = fists
            else:
                warnings.append(f'{name}: punhos pintados não encontrados')

def mannequin_size(body):
    """Width and height of the template's gray body in avatar units (same widths as make-combat-templates.py)."""
    pts = [(*body['neck'], 12), (*body['hip'], 12)] + [(*p, 6) for leg in (body['near'], body['far']) for p in leg] + [(*p, 5) for s in body['sleeves'] for p in s]
    return (max(x + r for x, _, r in pts) - min(x - r for x, _, r in pts), max(y + r for _, y, r in pts) - min(y - r for _, y, r in pts))


limits = {name: mannequin_size(body) for name, body in contract['mannequin'].items()}
for name, wide, tall in size_limits:
    if name in limits and (wide > limits[name][0] * 1.3 or tall > limits[name][1] * 1.3):
        warnings.append(f'{name}: corpo {wide:.0f}x{tall:.0f} maior que o boneco cinza {limits[name][0]:.0f}x{limits[name][1]:.0f} (unidades)')

atlas_path = f'public/assets/outfits/combat/{outfit}.png'
complete = all(frames_meta) and not issues
if complete:
    atlas.save(atlas_path, optimize=True)
    meta_path = 'src/game/combatAtlas.json'
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    meta[outfit] = {**meta.get(outfit, {}), 'path': '/' + atlas_path.removeprefix('public/'), 'cell': A['cell'], 'origin': A['origin'], 'frames': frames_meta}
    json.dump(dict(sorted(meta.items())), open(meta_path, 'w'), indent=1)
atlas.save(f'{report_dir}/atlas.png')
json.dump({'outfit': outfit, 'complete': complete, 'issues': issues, 'warnings': warnings, 'frames': dict(zip(NAMES, frames_meta))}, open(f'{report_dir}/report.json', 'w'), indent=1)
print(f'{outfit}: {"OK" if complete else "INCOMPLETO"} -> {atlas_path if complete else report_dir}')
for line in issues:
    print('ERRO', line)
for line in warnings:
    print('AVISO', line)
sys.exit(0 if complete else 1)
