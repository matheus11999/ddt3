"""Clipe do boné do kit v5 (matheus 22/10: "em batalha não mostra na lateral o cabelo").

O hatclip.py cortava todo cabelo acima da faixa do chapéu e fora do contorno da cabeça: com o boné pequeno da batalha
sobrava quase nada e a lateral ficava careca. Aqui o cabelo some só onde o boné cobre: em cada coluna, tudo acima da
borda de baixo do boné; nas colunas fora do boné vale a borda da coluna do boné mais próxima (nada de mecha saindo por
trás ou pela frente da copa). Embaixo da borda o cabelo aparece: costeleta, lateral e nuca.

  py scripts/kit-v5/capclip.py <sexo> <chapéu>     reescreve public/assets/rig/<sexo>/<contexto>/<chapéu>-clip.png
"""
import sys

import numpy as np
from PIL import Image

CELLS = {'game': (456, 380), 'show': (1000, 1368), 'virtualhead': (480, 700)}
LIP = .04  # o cabelo aparece só um pouco abaixo da borda (fração da altura do boné): a borda tem contorno


HUG = .03  # fora do boné o cabelo fica colado no crânio: no máximo isso (fração da largura da cabeça) para fora


def clip_cell(cap, head):
    out = np.zeros_like(cap)
    cols = np.nonzero(cap.any(0))[0]
    if not len(cols):
        return out
    rows = np.nonzero(cap.any(1))[0]
    lip = max(1, int((rows.max() - rows.min()) * LIP))
    ys = np.arange(cap.shape[0])[:, None]
    under = np.zeros_like(cap)
    for x in cols:
        under[:np.nonzero(cap[:, x])[0].max() + lip + 1, x] = True
    # fora das colunas do boné (atrás da copa, na nuca): o cabelo fica, mas só colado no crânio e abaixo do topo do boné
    hx = np.nonzero(head.any(0))[0]
    grow = max(1, int((hx.max() - hx.min()) * HUG)) if len(hx) else 1
    from scipy import ndimage
    hug = ndimage.binary_dilation(head, iterations=grow) if head.any() else head
    # borda de baixo da coluna do boné mais próxima: abaixo dela o cabelo aparece inteiro (costeleta, nuca)
    rim = np.full(cap.shape[1], 0)
    for x in range(cap.shape[1]):
        n = cols[np.argmin(np.abs(cols - x))]
        rim[x] = np.nonzero(cap[:, n])[0].max() + lip
    outside = ~np.isin(np.arange(cap.shape[1]), cols)[None, :] & ((ys < rows.min()) | (~hug & (ys < rim[None, :])))
    return under | outside | cap


if __name__ == '__main__':
    sex, hat = sys.argv[1:3]
    for context, (w, h) in CELLS.items():
        path = f'public/assets/rig/{sex}/{context}/{hat}.png'
        a = np.asarray(Image.open(path).convert('RGBA'))[..., 3] > 40
        face = np.asarray(Image.open(f'public/assets/rig/{sex}/{context}/face-basic-{"male" if sex == "m" else "female"}.png').convert('RGBA'))[..., 3] > 128
        out = np.zeros(a.shape, bool)
        for y0 in range(0, a.shape[0], h):
            for x0 in range(0, a.shape[1], w):
                fy, fx = min(y0, face.shape[0] - h), min(x0, face.shape[1] - w)  # mochila: rosto tem 4 células, o boné 1
                out[y0:y0 + h, x0:x0 + w] = clip_cell(a[y0:y0 + h, x0:x0 + w], face[fy:fy + h, fx:fx + w])
        img = np.zeros(a.shape + (4,), np.uint8); img[out] = (0, 0, 0, 255)
        Image.fromarray(img).save(f'public/assets/rig/{sex}/{context}/{hat}-clip.png')
        print(context, out.mean().round(3))
