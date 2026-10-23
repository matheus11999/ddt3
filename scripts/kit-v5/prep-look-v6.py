"""Deixa um conjunto de look-jobs-v6.py no formato que build-show-v6.py e build-gv-v6.py leem.

  py scripts/kit-v5/prep-look-v6.py <sexo> <look>
"""
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SEX, LOOK = sys.argv[1], sys.argv[2]
D = f'output/base-v6/looks/{LOOK}'
KIT0 = 'output/kit-v5-mcp' if SEX == 'm' else 'output/kit-v5f'
L = lambda p: Image.open(p).convert('RGBA')
out = lambda n: f'{D}/{n}/{n}.png'


def layer_diff(full, bald, min_size=300):
    """O que a edição acrescentou (cabelo) sobre a careca."""
    C = np.asarray(L(full)).astype(int); Bm = np.asarray(L(bald)).astype(int)
    d = np.abs(C[..., :3] - Bm[..., :3]).sum(-1)
    m = (C[..., 3] > 20) & ((Bm[..., 3] < 20) | (d > 60))
    m = ndimage.binary_opening(m, iterations=3); m = ndimage.binary_fill_holes(ndimage.binary_closing(m, iterations=4)) & (C[..., 3] > 20)
    lab, n = ndimage.label(m)
    if n:
        sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); m &= np.isin(lab, 1 + np.nonzero(sz >= min_size)[0])
    C[~m, 3] = 0
    return Image.fromarray(C.astype(np.uint8))


def align(ref, src, dst):
    a = np.asarray(L(ref))[..., 3] > 128; w = a.sum(1); r = np.nonzero(w)[0]
    lo, hi = r.min() + int((r.max() - r.min()) * .35), r.min() + int((r.max() - r.min()) * .65)
    neck = lo + int(np.argmin(w[lo:hi]))
    subprocess.run(['py', 'output/kit-v5-mcp/align.py', ref, src, dst, str(neck)], check=True, capture_output=True)


for sub in ('mochila-careca', 'camadas-mochila', 'cabeloB-frente', 'costas-careca', 'camadas', 'cabeloB-costas'):
    os.makedirs(f'{D}/{sub}', exist_ok=True)
align(out('pose'), out('careca'), f'{D}/mochila-careca/alinhada.png')
align(f'{D}/mochila-careca/alinhada.png', out('mestre'), f'{D}/mestre/alinhada.png')
align(f'{D}/mochila-careca/alinhada.png', out('cabeloB'), f'{D}/cabeloB-frente/alinhada.png')
layer_diff(f'{D}/mestre/alinhada.png', f'{D}/mochila-careca/alinhada.png').save(f'{D}/camadas-mochila/cabelo-frente.png')
shutil.copyfile(f'{KIT0}/costas-careca/costas-careca.png', f'{D}/costas-careca/costas-careca.png')
cc = f'{D}/costas-careca/costas-careca.png'
align(cc, out('costas'), f'{D}/costas/alinhada.png')
layer_diff(f'{D}/costas/alinhada.png', cc).save(f'{D}/camadas/cabelo-costas.png')
align(cc, out('costasB'), f'{D}/cabeloB-costas/alinhada.png')
print('ok', LOOK)
