#!/usr/bin/env python3
"""Cuts the Bolha sheets painted by Codex (public/assets/ui/bubbles/<id>-sheet.png, magenta background, prompts in
docs/bubble-art-prompts.md) into a stretchable 9-slice body and writes src/game/bubbleArt.json, which the
speech balloon (src/game/speechBubble.ts) reads. The painted tail stays on the sheet as the colour reference: the game
draws a smooth curved tail in the frame's colours so it can bend toward the speaker. A Bolha without a sheet keeps the balloon drawn in code.

  python3 scripts/build-bubble-art.py            every sheet found
  python3 scripts/build-bubble-art.py bubble-ember
"""
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'public/assets/ui/bubbles'
OUT = ROOT / 'src/game/bubbleArt.json'
spec = importlib.util.spec_from_file_location('cut', ROOT / 'scripts/cut-pet-sheet.py')
cut = importlib.util.module_from_spec(spec); spec.loader.exec_module(cut)
# A one-line balloon is about this tall on screen at scale 1; the painted body maps onto it.
BODY_HEIGHT = 74
MAX_BODY_WIDTH = 640


def border(rgba, axis_line, inner):
    """Pixels from the outside edge until the interior colour starts, along one line of the body."""
    run = 0
    for i, px in enumerate(axis_line):
        if px[3] > 200 and np.abs(px[:3].astype(int) - inner).sum() < 60:
            run += 1
            if run >= 6:
                return i - run + 1
        else:
            run = 0
    return len(axis_line) // 3


def build(sheet):
    bid = sheet.name.removesuffix('-sheet.png')
    rgba = cut.unkey(sheet)
    boxes = cut.components(rgba[..., 3])
    if len(boxes) < 2:
        print(f'{bid}: achei {len(boxes)} peça(s), preciso do corpo e do rabicho'); return None
    area = lambda b: (b[2] - b[0]) * (b[3] - b[1])
    body_box = sorted(boxes, key=area, reverse=True)[0]
    image = Image.fromarray(rgba, 'RGBA')
    body = cut.trim(image.crop(body_box))
    factor = min(1, MAX_BODY_WIDTH / body.width)
    if factor < 1:
        body = body.resize((round(body.width * factor), round(body.height * factor)), Image.LANCZOS)
    a = np.asarray(body)
    h, w = a.shape[:2]
    inner = a[h // 2, w // 2, :3].astype(int)
    left = border(a, a[h // 2, :], inner); right = border(a, a[h // 2, ::-1], inner)
    top = border(a, a[:, w // 2], inner); bottom = border(a, a[::-1, w // 2], inner)
    # Corner ornaments never stretch: keep a good share of each side fixed, but leave a middle to stretch.
    sl = min(max(left + 8, round(w * .16)), w // 2 - 4); sr = min(max(right + 8, round(w * .16)), w // 2 - 4)
    st = min(max(top + 8, round(h * .3)), h // 2 - 4); sb = min(max(bottom + 8, round(h * .3)), h // 2 - 4)
    body.save(ART / f'{bid}-body.png', optimize=True)
    print(f'{bid}: corpo {w}x{h} (fatias {st},{sr},{sb},{sl})')
    return bid, {'body': f'/assets/ui/bubbles/{bid}-body.png', 'slice': [st, sr, sb, sl], 'density': round(h / BODY_HEIGHT, 3)}


def main():
    wanted = set(sys.argv[1:])
    data = json.loads(OUT.read_text()) if OUT.exists() else {}
    for sheet in sorted(ART.glob('*-sheet.png')):
        if wanted and sheet.name.removesuffix('-sheet.png') not in wanted:
            continue
        result = build(sheet)
        if result:
            data[result[0]] = result[1]
    OUT.write_text(json.dumps(data, indent=1, sort_keys=True) + '\n')
    print(f'{OUT.relative_to(ROOT)}: {len(data)} bolha(s) pintada(s)')


if __name__ == '__main__':
    main()
