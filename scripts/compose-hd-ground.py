"""Joins the Codex HD repaints of an anthill ground (docs/expedition-prompts/hd/out/*-chao-N.png, each a
1536-wide crop of the old piece enlarged 2x, see crops.json) into one full-resolution piece on magenta and
writes it as the map's chao.png. The layout then places it at scale 1 instead of 2.
Usage: python3 scripts/compose-hd-ground.py anthill-1 anthill-2"""
import json, sys
import numpy as np
from PIL import Image

HD = 'docs/expedition-prompts/hd'
meta = json.load(open(f'{HD}/crops.json'))
for map_id in sys.argv[1:] or meta:
    m = meta[map_id]; W, H = m['size']; top = m['top']
    color = np.zeros((H, W, 3)); weight = np.zeros((H, W, 1))
    crops = m['crops']
    for n, crop in enumerate(crops):
        x0 = crop['x']; img = np.asarray(Image.open(f"{HD}/out/{crop['out']}").convert('RGB'), float)[top:top + H]
        w = np.ones(1536)
        # Linear ramps where this crop overlaps its neighbours, so the seams cross-fade.
        if n > 0:
            prev_end = crops[n - 1]['x'] + 1536
            if prev_end > x0: ramp = prev_end - x0; w[:ramp] = np.linspace(0, 1, ramp)
        if n < len(crops) - 1:
            nxt = crops[n + 1]['x']
            if nxt < x0 + 1536: ramp = x0 + 1536 - nxt; w[-ramp:] = np.minimum(w[-ramp:], np.linspace(1, 0, ramp))
        span = min(1536, W - x0)
        color[:, x0:x0 + span] += img[:, :span] * w[:span, None]; weight[:, x0:x0 + span] += w[:span, None]
    piece = (color / np.maximum(weight, 1e-6)).clip(0, 255).astype(np.uint8)
    sheet = Image.new('RGB', (W + 40, H + 40), (255, 0, 255)); sheet.paste(Image.fromarray(piece), (20, 20))
    out = f'public/assets/maps/{map_id}/source/chao.png'; sheet.save(out); print(f'{out}: {sheet.size}')
