"""Combat body templates for Codex (docs/combat-frames.md): one 1536x1024 sheet per group of frames,
3x2 cells of 512 px on magenta, with the universal head as a flat green silhouette where each frame
puts it. Codex paints the outfit's body around the green heads; scripts/build-combat-atlas.py finds the
green heads again, so the body is registered to the head without any per-outfit numbers.
Usage: python3 scripts/make-combat-templates.py"""
import json
from PIL import Image, ImageDraw
import numpy as np

contract = json.load(open('src/game/rig/combatFrames.json'))
T = contract['template']; cell = T['cell']; ppu = T['pixelsPerUnit']
H = contract['headSilhouette']
# The head cut used by the game (appearance.ts avatarRig: rig.head) over character-base.png.
base = Image.open('public/assets/character-base.png').convert('RGBA')
cut = Image.new('L', base.size, 0)
ImageDraw.Draw(cut).polygon([(265, 0), (991, 0), (991, 600), (727, 608), (701, 631), (622, 629), (542, 608), (265, 608)], fill=255)
alpha = np.minimum(np.asarray(base)[:, :, 3], np.asarray(cut))
ys, xs = np.nonzero(alpha > 40)
assert (xs.min(), ys.min(), xs.max() - xs.min() + 1, ys.max() - ys.min() + 1) == (H['left'], H['top'], H['width'], H['height']), 'headSilhouette in combatFrames.json is stale'
box = (H['left'], H['top'], H['left'] + H['width'], H['top'] + H['height'])
scale = contract['headScale'] * contract['avatarUnit'] * ppu
size = (round(H['width'] * scale), round(H['height'] * scale))
mask = Image.fromarray(np.where(alpha > 40, 255, 0).astype('uint8')).crop(box).resize(size, Image.LANCZOS)
mask = mask.point(lambda v: 255 if v > 127 else 0)

for sheet in contract['sheets']:
    out = Image.new('RGB', (cell * T['columns'], cell * T['rows']), (255, 0, 255))
    for i, name in enumerate(sheet['frames']):
        hx, hy = contract['frames'][name]['head']
        cx = (i % T['columns']) * cell + sheet['origin'][0] + hx * ppu
        cy = (i // T['columns']) * cell + sheet['origin'][1] + hy * ppu
        out.paste((0, 255, 0), (round(cx - size[0] / 2), round(cy - size[1] / 2)), mask)
    out.save(f"docs/templates/combat-{sheet['name']}.png")
    print(f"docs/templates/combat-{sheet['name']}.png", sheet['frames'])
