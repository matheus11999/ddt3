"""Lowers the leg kick of the painted crawl drawings (crawl1, crawl3) in combat atlases (matheus, 19/10: the leg rose
too high). The legs behind the hips are squashed toward the ground so the raised boot climbs only `share` of the
way above the rest drawing's legs; the body and head are untouched. Run once per atlas; it records itself in
src/game/combatAtlas.json (`softKick`) so a second run does nothing.
Usage: python scripts/soften-crawl-kick.py [outfit-id ...] [--share=.5]"""
import json, sys
import numpy as np
from PIL import Image

share = float(next((a.split('=')[1] for a in sys.argv if a.startswith('--share=')), .5))
ids = [a for a in sys.argv[1:] if not a.startswith('--')]
contract = json.load(open('src/game/rig/combatFrames.json'))
A, names = contract['atlas'], list(contract['frames'])
cw, ch = A['cell']
meta = json.load(open('src/game/combatAtlas.json'))
for outfit in ids or list(meta):
    entry = meta[outfit]
    if entry.get('softKick'):
        print(f'{outfit}: já suavizado'); continue
    ox, oy = entry.get('origin', A['origin'])
    path = 'public' + entry['path']
    atlas = Image.open(path).convert('RGBA'); a = np.asarray(atlas).copy()
    def cell(i):
        x, y = (i % A['columns']) * cw, (i // A['columns']) * ch
        return a[y:y + ch, x:x + cw]
    legs = slice(0, max(1, ox - 45))
    def top(c):
        ys = np.nonzero((c[:, legs, 3] > 60).any(1))[0]
        return ys.min() if len(ys) else oy
    rest = top(cell(names.index('rest')))
    for name in ('crawl1', 'crawl3'):
        c = cell(names.index(name)); high = top(c)
        if high >= rest - 4:
            continue
        k = (oy - (rest - (rest - high) * share)) / (oy - high)
        region = Image.fromarray(c[:oy, legs].copy())
        h = region.height
        squashed = region.resize((region.width, max(1, round(h * k))), Image.LANCZOS)
        out = np.zeros_like(c[:oy, legs]); out[h - squashed.height:] = np.asarray(squashed)
        c[:oy, legs] = out
    Image.fromarray(a).save(path, optimize=True)
    entry['softKick'] = share
    print(f'{outfit}: chute suavizado ({share:.0%})')
json.dump(meta, open('src/game/combatAtlas.json', 'w'), indent=1)
