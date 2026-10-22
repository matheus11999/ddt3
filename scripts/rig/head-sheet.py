"""Rig v2: approval sheet of a head piece baked by headplate.py, stacked like the game does (rig.ts) in every combat
cell, the bag cell and the three plaza heads. Usage: py scripts/rig/head-sheet.py <sex> <hat> [<hair-B>] [<outfit>]
-> test-results/rig/head/sheet-<hat>-<sex>.png"""
import sys

from PIL import Image, ImageDraw

if sys.argv[1] == 'kit':  # Codex reference: the bag figure without and with the hat (show-kit-<sex>.png)
    import os
    sex = sys.argv[2]
    s = 'male' if sex == 'm' else 'female'
    out = Image.new('RGBA', (2000, 1368), (255, 0, 255, 255))
    for n, items in enumerate(([f'face-basic-{s}', f'hair-basic-{s}-A', f'outfit-basic-{s}'], [f'face-basic-{s}', f'hair-basic-{s}-A', f'outfit-basic-{s}', 'hat-starter'])):
        for it in items:
            out.alpha_composite(Image.open(f'public/assets/rig/{sex}/show/{it}.png').convert('RGBA').crop((0, 0, 1000, 1368)), (n * 1000, 0))
    os.makedirs('test-results/rig/sheets', exist_ok=True)
    out.convert('RGB').save(f'test-results/rig/sheets/show-kit-{sex}.png')
    print(f'test-results/rig/sheets/show-kit-{sex}.png')
    sys.exit(0)
sex, hat = sys.argv[1], sys.argv[2]
face = 'face-basic-male' if sex == 'm' else 'face-basic-female'
hair = sys.argv[3] if len(sys.argv) > 3 else face.replace('face', 'hair') + '-A'
outfit = sys.argv[4] if len(sys.argv) > 4 else face.replace('face', 'outfit')
BG = (226, 220, 232, 255)


def load(ctx, item):
    return Image.open(f'public/assets/rig/{sex}/{ctx}/{item}.png').convert('RGBA')


def stack(ctx, items, box):
    out = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), BG)
    for it in items:
        out.alpha_composite(load(ctx, it).crop(box))
    return out


w, h = 456, 380
cells = [i for i in range(39) if i % 13 < 11]
game = [stack('game', [face, hair, outfit, hat], (i % 13 * w, i // 13 * h, i % 13 * w + w, i // 13 * h + h)).crop((60, 60, 444, 380)).resize((192, 160), Image.LANCZOS) for i in cells]
sheet = Image.new('RGBA', (192 * 11, 160 * 3 + 420), BG)
for n, img in enumerate(game):
    sheet.alpha_composite(img, (n % 11 * 192, n // 11 * 160))
show = stack('show', [face, hair, outfit, hat], (0, 0, 1000, 1368)).crop((80, 120, 920, 960)).resize((400, 400), Image.LANCZOS)
sheet.alpha_composite(show, (10, 490))
for n in range(3):
    v = stack('virtualhead', [face, hair, hat], (n * 480, 0, n * 480 + 480, 700)).crop((40, 40, 440, 500)).resize((348, 400), Image.LANCZOS)
    sheet.alpha_composite(v, (440 + n * 360, 490))
ImageDraw.Draw(sheet).text((10, 470), f'{hat} + {hair} + {outfit}', fill=(60, 40, 30, 255))
out = f'test-results/rig/head/sheet-{hat}-{sex}.png'
sheet.convert('RGB').save(out)
print(out)
