"""Packs an outfit's Codex walk sheet (docs/combat-art-prompts/walk.txt, template docs/templates/walk.png)
into the lobby walk atlas, like scripts/build-combat-atlas.py does for combat: per frame it keys the
magenta out, finds the green head, scales the sheet so the head matches the universal head, removes the
green and places the body in its atlas cell with the head at the standing avatar's x and the lowest
painted row on the ground. The measured head height of every frame (the step's bob) goes to
src/game/walkAtlas.json, so the game draws the player's head where the painting expects it.

Usage: python3 scripts/build-walk-atlas.py <outfit-id> [walk.png]
Default input: test-results/codex-walk/out/<id without outfit->-walk.png
Output: public/assets/outfits/walk/<id>.png, src/game/walkAtlas.json, test-results/walk/<id>/"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

contract = json.load(open('src/game/rig/walkFrames.json'))
combat = json.load(open('src/game/rig/combatFrames.json'))
T, A = contract['template'], contract['atlas']
HS, unit, hs = combat['headSilhouette'], combat['avatarUnit'], contract['headScale']
outfit = sys.argv[1]
short = outfit.removeprefix('outfit-')
path = sys.argv[2] if len(sys.argv) > 2 else f'test-results/codex-walk/out/{short}-walk.png'
report_dir = f'test-results/walk/{outfit}'
os.makedirs(report_dir, exist_ok=True)
os.makedirs('public/assets/outfits/walk', exist_ok=True)

head_px = HS['width'] * hs * unit * A['pixelsPerUnit']
aspect = HS['height'] / HS['width']
# Where the standing avatar wears the head (avatar units from the contact point): the silhouette's centre,
# scaled by HEAD_SCALE about the head pivot, in the 1254 px avatar space centred on (625, 1225).
px, py = contract['headPivot']
standing = ((px + (HS['left'] + HS['width'] / 2 - px) * hs - 625) * unit, (py + (HS['top'] + HS['height'] / 2 - py) * hs - 1225) * unit)


def unkey(rgb):
    r, g, b = (rgb[..., k].astype(float) for k in range(3))
    key = np.minimum(r, b) - g
    alpha = np.clip((150 - key) / 110, 0, 1)
    edge = (key > 40) & (key <= 150)
    low = np.minimum(r, b)
    r = np.where(edge, np.minimum(r, g + (r - low) + 40), r)
    b = np.where(edge, np.minimum(b, g + (b - low) + 60), b)
    return np.dstack([r, g, b, alpha * 255])


def grow(mask, size):
    return np.asarray(Image.fromarray((mask * 255).astype('uint8')).filter(ImageFilter.MaxFilter(size))) > 0


src = Image.open(path).convert('RGB')
if src.size != (T['cell'] * T['columns'], T['cell'] * T['rows']):
    src = src.resize((T['cell'] * T['columns'], T['cell'] * T['rows']), Image.LANCZOS)
rgb = np.asarray(src)
rgba = unkey(rgb)
r, g, b = (rgb[..., k].astype(float) for k in range(3))
green = g - np.maximum(r, b)
head_mask = (green > 90) & (g > 150)
rim = (green > 35) & ~head_mask
clean = rgba.copy()
clean[grow(head_mask | rim, 7), 3] = 0

issues, warnings, frames_meta = [], [], []
atlas = Image.new('RGBA', (A['columns'] * A['cell'][0], A['rows'] * A['cell'][1]), (0, 0, 0, 0))
measured = []
for i, frame in enumerate(contract['frames']):
    cx, cy = (i % T['columns']) * T['cell'], (i // T['columns']) * T['cell']
    ys, xs = np.nonzero(head_mask[cy:cy + T['cell'], cx:cx + T['cell']])
    if len(xs) < 500:
        issues.append(f'{frame["name"]}: cabeça verde não encontrada')
        measured.append(None)
        continue
    left, right, top = np.percentile(xs, 0.3), np.percentile(xs, 99.7), np.percentile(ys, 0.3)
    measured.append(((left + right) / 2, top + (right - left + 1) * aspect / 2, right - left + 1))
widths = [m[2] for m in measured if m]
median = float(np.median(widths)) if widths else 1
for m, frame in zip(measured, contract['frames']):
    if m and abs(m[2] / median - 1) > .06:
        warnings.append(f'{frame["name"]}: cabeça {m[2] / median:.0%} da mediana')
scale = head_px / median
for i, (m, frame) in enumerate(zip(measured, contract['frames'])):
    if not m:
        frames_meta.append(None)
        continue
    hx, hy, _ = m
    cx, cy = (i % T['columns']) * T['cell'], (i // T['columns']) * T['cell']
    figure = clean[cy:cy + T['cell'], cx:cx + T['cell']].copy()
    sw, sh = median, median * aspect
    mask = Image.new('L', (T['cell'], T['cell']), 0)
    ImageDraw.Draw(mask).ellipse([hx - sw / 2, hy - sh / 2, hx + sw / 2, hy + sh * .2], fill=255)
    figure[np.asarray(mask) > 0, 3] = 0
    solid = np.nonzero(figure[..., 3] > 128)
    if len(solid[0]) < 4000:
        issues.append(f'{frame["name"]}: corpo quase vazio')
        frames_meta.append(None)
        continue
    if np.concatenate([(figure[..., 3] > 128)[:3].ravel(), (figure[..., 3] > 128)[-3:].ravel(), (figure[..., 3] > 128)[:, :3].ravel(), (figure[..., 3] > 128)[:, -3:].ravel()]).any():
        warnings.append(f'{frame["name"]}: pintura encosta na borda da célula')
    ground = solid[0].max() + 1
    piece = Image.fromarray(figure.astype('uint8'), 'RGBA').resize((round(T['cell'] * scale), round(T['cell'] * scale)), Image.LANCZOS)
    ax = (i % A['columns']) * A['cell'][0] + A['origin'][0]
    ay = (i // A['columns']) * A['cell'][1] + A['origin'][1]
    ox, oy = round(ax + standing[0] * A['pixelsPerUnit'] - hx * scale), round(ay - ground * scale)
    layer = Image.new('RGBA', atlas.size, (0, 0, 0, 0))
    layer.paste(piece, (ox, oy))
    box = ((i % A['columns']) * A['cell'][0], (i // A['columns']) * A['cell'][1])
    own = layer.crop((box[0], box[1], box[0] + A['cell'][0], box[1] + A['cell'][1]))
    lost = np.asarray(layer)[..., 3].astype(bool).sum() - np.asarray(own)[..., 3].astype(bool).sum()
    if lost > 50:
        warnings.append(f'{frame["name"]}: {lost} px fora da célula do atlas')
    atlas.alpha_composite(own, box)
    frames_meta.append({'head': [round(standing[0], 2), round((hy - ground) * scale / A['pixelsPerUnit'], 2)]})

atlas_path = f'public/assets/outfits/walk/{outfit}.png'
complete = all(frames_meta) and not issues
if complete:
    atlas.save(atlas_path, optimize=True)
    meta_path = 'src/game/walkAtlas.json'
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    meta[outfit] = {'path': '/' + atlas_path.removeprefix('public/'), 'standing': [round(v, 2) for v in standing], 'frames': frames_meta}
    json.dump(dict(sorted(meta.items())), open(meta_path, 'w'), indent=1)
atlas.save(f'{report_dir}/atlas.png')
json.dump({'outfit': outfit, 'complete': complete, 'issues': issues, 'warnings': warnings, 'standingHead': standing, 'frames': frames_meta}, open(f'{report_dir}/report.json', 'w'), indent=1)
print(f'{outfit}: {"OK" if complete else "INCOMPLETO"} -> {atlas_path if complete else report_dir}')
for line in issues:
    print('ERRO', line)
for line in warnings:
    print('AVISO', line)
sys.exit(0 if complete else 1)
