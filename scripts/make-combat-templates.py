"""Combat body templates for Codex (docs/combat-frames.md): one 1536x1024 sheet per group of frames,
3x2 cells of 512 px on magenta. In every cell the universal head is a flat green silhouette, the
small chibi body to paint is a flat gray mannequin (DDTank proportions: the body is smaller than the
head) and the two hands are cyan discs: the game draws the same skin-colored fists for every outfit.
Codex paints the outfit over the gray mannequin; scripts/build-combat-atlas.py finds the green heads
again, so the body is registered to the head without any per-outfit numbers.
Usage: python3 scripts/make-combat-templates.py"""
import json
from PIL import Image, ImageDraw
import numpy as np

contract = json.load(open('src/game/rig/combatFrames.json'))
T = contract['template']; cell = T['cell']; ppu = T['pixelsPerUnit']
H = contract['headSilhouette']
GRAY, CYAN = (128, 128, 128), (0, 255, 255)
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


def mannequin(draw, body, at):
    """Gray guide body in avatar units: torso capsule, legs, feet and short sleeves."""
    P = lambda p: (at[0] + p[0] * ppu, at[1] + p[1] * ppu)
    def limb(a, b, width):
        draw.line([P(a), P(b)], fill=GRAY, width=round(width * ppu))
        for q in (a, b):
            x, y = P(q); r = width * ppu / 2
            draw.ellipse([x - r, y - r, x + r, y + r], fill=GRAY)
    for leg in (body['far'], body['near']):
        limb(leg[0], leg[1], 11); limb(leg[1], leg[2], 9)
        x, y = P(leg[2]); draw.ellipse([x - 6 * ppu, y - 4 * ppu, x + 6 * ppu, y + 4 * ppu], fill=GRAY)
    limb(body["neck"], body["hip"], 24)
    for a, b in body['sleeves']:
        limb(a, b, 10)


for sheet in contract['sheets']:
    out = Image.new('RGB', (cell * T['columns'], cell * T['rows']), (255, 0, 255))
    draw = ImageDraw.Draw(out)
    for i, name in enumerate(sheet['frames']):
        frame = contract['frames'][name]
        at = ((i % T['columns']) * cell + sheet['origin'][0], (i // T['columns']) * cell + sheet['origin'][1])
        mannequin(draw, contract['mannequin'][name], at)
        hx, hy = frame['head']
        cx, cy = at[0] + hx * ppu, at[1] + hy * ppu
        out.paste((0, 255, 0), (round(cx - size[0] / 2), round(cy - size[1] / 2)), mask)
        r = contract['fist']['size'] / 2 * ppu
        for x, y, _ in frame['fists']:
            x, y = at[0] + x * ppu, at[1] + y * ppu
            draw.ellipse([x - r, y - r, x + r, y + r], fill=CYAN)
    out.save(f"docs/templates/combat-{sheet['name']}.png")
    print(f"docs/templates/combat-{sheet['name']}.png", sheet['frames'])
