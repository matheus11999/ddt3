"""Combat body templates for Codex (docs/combat-frames.md): one 1536x1024 sheet per group of frames,
3x2 cells of 512 px on magenta. In every cell the universal head is a flat green silhouette, the
small chibi body to paint is a flat gray mannequin (DDTank proportions: the body is smaller than the
head) with gray arms reaching two skin-colored fist guides. Like DDTank, the hands are painted in the
outfit's own sheet, joined to the sleeves; the game tints every skin-colored pixel to the player's skin.
Codex paints the outfit over the gray mannequin; scripts/build-combat-atlas.py finds the green heads
again, so the body is registered to the head without any per-outfit numbers.
Usage: python3 scripts/make-combat-templates.py"""
import json
from PIL import Image, ImageDraw
import numpy as np

contract = json.load(open('src/game/rig/combatFrames.json'))
T = contract['template']; cell = T['cell']; ppu = T['pixelsPerUnit']
H = contract['headSilhouette']
GRAY, SKIN, LINE = (128, 128, 128), (252, 208, 172), (58, 36, 20)
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
        limb(leg[0], leg[1], 9); limb(leg[1], leg[2], 8)
        x, y = P(leg[2]); draw.ellipse([x - 5 * ppu, y - 3.5 * ppu, x + 5 * ppu, y + 3.5 * ppu], fill=GRAY)
    limb(body["neck"], body["hip"], 20)


def arm(draw, sleeve, fist, at):
    """Gray sleeve from the shoulder through the elbow down to the wrist, then the skin fist guide."""
    P = lambda p: (at[0] + p[0] * ppu, at[1] + p[1] * ppu)
    (shoulder, elbow), (fx, fy) = sleeve, fist[:2]
    for a, b, width in ((shoulder, elbow, 8), (elbow, (fx, fy), 6)):
        draw.line([P(a), P(b)], fill=GRAY, width=round(width * ppu))
        for q in (a, b):
            x, y = P(q); r = width * ppu / 2
            draw.ellipse([x - r, y - r, x + r, y + r], fill=GRAY)
    x, y = P((fx, fy)); rx, ry = contract['fist']['size'] * .5 * ppu, contract['fist']['size'] * .45 * ppu
    draw.ellipse([x - rx, y - ry, x + rx, y + ry], fill=SKIN, outline=LINE, width=3)


for sheet in contract['sheets']:
    out = Image.new('RGB', (cell * T['columns'], cell * T['rows']), (255, 0, 255))
    draw = ImageDraw.Draw(out)
    for i, name in enumerate(sheet['frames']):
        frame, body = contract['frames'][name], contract['mannequin'][name]
        at = ((i % T['columns']) * cell + sheet['origin'][0], (i // T['columns']) * cell + sheet['origin'][1])
        prone = name in ('rest', 'hurt') or name.startswith('crawl')
        # Kneeling, the far arm is behind the body; lying, both fists rest in front of the chin.
        if not prone:
            arm(draw, body['sleeves'][0], frame['fists'][0], at)
        mannequin(draw, body, at)
        hx, hy = frame['head']
        cx, cy = at[0] + hx * ppu, at[1] + hy * ppu
        out.paste((0, 255, 0), (round(cx - size[0] / 2), round(cy - size[1] / 2)), mask)
        if prone:
            arm(draw, body['sleeves'][0], frame['fists'][0], at)
        arm(draw, body['sleeves'][1], frame['fists'][1], at)
    out.save(f"docs/templates/combat-{sheet['name']}.png")
    print(f"docs/templates/combat-{sheet['name']}.png", sheet['frames'])
