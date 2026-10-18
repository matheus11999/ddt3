"""Lobby walk template for Codex (docs/walk-frames.md): one 1536x1024 sheet, 3x2 cells of 512 px on
magenta, one step per cell (contact, down, passing, then the same with the other leg). Each cell has the
universal head as a flat green silhouette where the standing avatar wears it, and a gray mannequin in the
walking pose with skin-colored hand guides. Codex paints the outfit over the mannequin (hands included,
like DDTank's sheets); scripts/build-walk-atlas.py finds the green heads again, so the body is registered
to the head without per-outfit numbers.
Usage: python3 scripts/make-walk-template.py"""
import json, math
from PIL import Image, ImageDraw
import numpy as np

contract = json.load(open('src/game/rig/walkFrames.json'))
T = contract['template']; cell = T['cell']; k = T['scale']
GRAY, SKIN, LINE = (128, 128, 128), (252, 208, 172), (58, 36, 20)
# The head exactly as the standing avatar draws it: rig.head cut from character-base.png, scaled by
# HEAD_SCALE about its pivot (650, 610) in the 1254 px avatar space.
base = Image.open('public/assets/character-base.png').convert('RGBA')
cut = Image.new('L', base.size, 0)
ImageDraw.Draw(cut).polygon([(265, 0), (991, 0), (991, 600), (727, 608), (701, 631), (622, 629), (542, 608), (265, 608)], fill=255)
alpha = np.where(np.minimum(np.asarray(base)[:, :, 3], np.asarray(cut)) > 40, 255, 0).astype('uint8')
head = Image.fromarray(alpha)
hs = contract['headScale']
pivot = contract['headPivot']
size = (round(base.size[0] * hs * k), round(base.size[1] * hs * k))
head = head.resize(size, Image.LANCZOS).point(lambda v: 255 if v > 127 else 0)


def place(i, p):
    """1254 px avatar space -> template pixels in cell i (ground at the contract's ground line)."""
    ox, oy = (i % T['columns']) * cell + cell / 2, (i // T['columns']) * cell + T['ground']
    return (ox + (p[0] - contract['center'][0]) * k, oy + (p[1] - contract['groundY']) * k)


out = Image.new('RGB', (cell * T['columns'], cell * T['rows']), (255, 0, 255))
draw = ImageDraw.Draw(out)
for i, frame in enumerate(contract['frames']):
    P = lambda p: place(i, p)
    lift = frame['bob']

    def limb(a, b, width, fill=GRAY):
        draw.line([P(a), P(b)], fill=fill, width=round(width * k))
        for q in (a, b):
            x, y = P(q); r = width * k / 2
            draw.ellipse([x - r, y - r, x + r, y + r], fill=fill)

    def leg(thigh, shin, x):
        hip = (x, contract['hip'][1] + lift)
        knee = (hip[0] + math.sin(math.radians(thigh)) * contract['thigh'], hip[1] + math.cos(math.radians(thigh)) * contract['thigh'])
        ankle = (knee[0] + math.sin(math.radians(shin)) * contract['shin'], knee[1] + math.cos(math.radians(shin)) * contract['shin'])
        limb(hip, knee, 92); limb(knee, ankle, 76)
        toe = (ankle[0] + 70 * math.cos(math.radians(frame.get('toe', 0))), ankle[1] + 40)
        limb((ankle[0] - 20, ankle[1] + 40), toe, 58)

    def arm(swing, x):
        shoulder = (x, contract['shoulderY'] + lift)
        elbow = (shoulder[0] + math.sin(math.radians(swing)) * 125, shoulder[1] + math.cos(math.radians(swing)) * 125)
        hand = (elbow[0] + math.sin(math.radians(swing * 1.4 + 12)) * 115, elbow[1] + math.cos(math.radians(swing * 1.4 + 12)) * 115)
        limb(shoulder, elbow, 58); limb(elbow, hand, 48)
        x, y = P(hand); r = 34 * k
        draw.ellipse([x - r, y - r * .92, x + r, y + r * .92], fill=SKIN, outline=LINE, width=3)

    far, near = frame['far'], frame['near']
    arm(frame['farArm'], contract['hip'][0] + 18)
    leg(*far, contract['hip'][0] + 12)
    limb((contract['hip'][0], contract['neckY'] + lift), (contract['hip'][0], contract['hip'][1] - 30 + lift), 230)
    leg(*near, contract['hip'][0] - 12)
    hx, hy = P((pivot[0] - pivot[0] * hs, pivot[1] - pivot[1] * hs + lift))
    out.paste((0, 255, 0), (round(hx), round(hy)), head)
    arm(frame['nearArm'], contract['hip'][0] - 18)
out.save('docs/templates/walk.png')
print('docs/templates/walk.png', len(contract['frames']), 'frames')
