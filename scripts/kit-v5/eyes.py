"""Olhos de cada rosto do rig, para o piscar universal feito em código (matheus 22/10: "um efeito nos olhos que funcione
com todos os rostos"). Para cada célula das folhas de rosto (game, show, virtualhead) acha os dois olhos: as maiores
manchas escuras no miolo do rosto que têm brilho branco perto (a íris com o reflexo; a sobrancelha não tem), e grava a
caixa de cada olho e a cor da pele logo abaixo dela em src/game/character/rigEyes.json. O jogo fecha o olho pintando a
caixa com essa pele e uma pálpebra por cima (rig.ts).

  py scripts/kit-v5/eyes.py <sexo> <rosto>    (rode de novo sempre que publicar um rosto)
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

CELLS = {'game': (456, 380), 'show': (1000, 1368), 'virtualhead': (480, 700)}
OUT = 'src/game/character/rigEyes.json'


def eyes(cell):
    a = cell.astype(int)
    alpha = a[..., 3] > 200
    if alpha.sum() < 500:
        return None
    face_w = np.ptp(np.nonzero(alpha.any(0))[0]) + 1
    inner = ndimage.binary_erosion(alpha, iterations=max(3, face_w // 40))
    lum = a[..., :3].mean(-1)
    dark = (lum < 110) & inner
    white = (lum > 215) & inner
    lab, n = ndimage.label(dark)
    found = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        m = lab[sl] == i
        area = m.sum()
        if area < face_w * face_w * .002:
            continue
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        h, w = y1 - y0, x1 - x0
        if h < w * .45:  # sobrancelha e boca são riscos baixos e largos; o olho é mais alto
            continue
        pad = max(2, w // 4)
        near = white[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad].sum()
        if near < area * .03:
            continue
        found.append((area, [int(x0 - pad // 2), int(y0 - pad // 2), int(w + pad), int(h + pad)]))
    found.sort(reverse=True)
    boxes = sorted([b for _, b in found[:2]], key=lambda b: b[0])
    if not boxes:
        return None
    out = []
    for x, y, w, h in boxes:
        sy = min(a.shape[0] - 1, y + h + max(2, h // 6))
        sx = min(a.shape[1] - 1, max(0, x + w // 2))
        skin = a[sy, sx, :3] if a[sy, sx, 3] > 200 else a[..., :3][alpha].mean(0)
        out.append({'box': [x, y, w, h], 'skin': [int(v) for v in skin]})
    return out


if __name__ == '__main__':
    sex, face = sys.argv[1:3]
    data = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
    for context, (w, h) in CELLS.items():
        path = f'public/assets/rig/{sex}/{context}/{face}.png'
        if not os.path.exists(path):
            continue
        img = np.asarray(Image.open(path).convert('RGBA'))
        cells = []
        for y0 in range(0, img.shape[0], h):
            for x0 in range(0, img.shape[1], w):
                cells.append(eyes(img[y0:y0 + h, x0:x0 + w]))
        data.setdefault(sex, {}).setdefault(context, {})[face] = cells
        print(context, sum(1 for c in cells if c), 'células com olhos de', len(cells))
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, separators=(',', ':'))
        f.write('\n')
