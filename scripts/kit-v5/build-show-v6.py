"""Mochila com base de pele única (matheus 22/10): a base (cabeça careca sem rosto, pescoço e corpo numa peça só) e,
por cima, só o rosto (olhos, sobrancelhas, boca), o cabelo e a roupa, sem nenhuma pele na junção pescoço/gola.

  py scripts/kit-v5/build-show-v6.py <sexo> <base.png> <kit-dir>:<look> [<kit-dir>:<look> ...]

A base vem de output/base-v6/<sexo>-mochila (edição da careca aprovada). Cada kit é alinhado à base: a cabeça pela
caixa do crânio (rosto e cabelo) e o corpo pelo contorno abaixo do pescoço (roupa).
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SEX, BASE = sys.argv[1], sys.argv[2]
KITS = [a.split(':') for a in sys.argv[3:]]
OUT = f'public/assets/rig/{SEX}/show'
L = lambda p: Image.open(p).convert('RGBA')
NECK_X = 400
base = L(BASE)
B = np.asarray(base).astype(int)


def skinish(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r > 185) & (g > 120) & (b > 80) & (r - b > 35) & (r - b < 150) & (r > g)


_bb = None
def skin_tone(a, tone):
    """Pele = perto da cor da pele da base (luz e sombra), não só "bege": cáqui e creme da roupa ficam."""
    d = a[..., :3] - tone[None, None, :]
    lum = a[..., :3].mean(-1) / max(1, tone.mean())
    # compara a cor normalizada (mesma matiz em luz ou sombra) e a distância bruta
    n = a[..., :3] / np.maximum(1, a[..., :3].sum(-1, keepdims=True)) - tone / tone.sum()
    return (np.abs(n).sum(-1) < .045) & (lum > .55) & (lum < 1.15)


def head_box(a, neck):
    al = a[..., 3] > 200
    al[neck:] = False
    ys, xs = np.nonzero(al)
    return xs.min(), ys.min(), xs.max(), ys.max()


def neck_row(a):
    al = a[..., 3] > 128; w = al.sum(1); r = np.nonzero(w)[0]
    lo, hi = r.min() + int((r.max() - r.min()) * .35), r.min() + int((r.max() - r.min()) * .65)
    return lo + int(np.argmin(w[lo:hi]))


bn = neck_row(B)
_arm = (B[..., 3] > 200) & skinish(B); _arm[:neck_row(B) + 20] = False
TONE = B[_arm][:, :3].mean(0)
bx0, by0, bx1, by1 = head_box(B, bn)


def fit(img, src_box, dst_box):
    """Escala e move img para a caixa src cair na caixa dst (mesma escala nos dois eixos, centro e topo)."""
    sx0, sy0, sx1, sy1 = src_box; dx0, dy0, dx1, dy1 = dst_box
    s = ((dx1 - dx0) / (sx1 - sx0) + (dy1 - dy0) / (sy1 - sy0)) / 2
    r = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    out = Image.new('RGBA', img.size)
    out.paste(r, (round((dx0 + dx1) / 2 - (sx0 + sx1) / 2 * s), round(dy0 - sy0 * s)), r)
    return out


# coluna do pescoço da base (para alinhar a figura no meio da célula, como antes)
al = B[..., 3] > 200
mids = [np.nonzero(al[y])[0] for y in range(by1 - int((by1 - by0) * .16), by1 - int((by1 - by0) * .08))]
CX = float(np.median([(m.min() + m.max()) / 2 for m in mids if len(m)]))


def cell(img):
    c = Image.new('RGBA', (1000, 1368))
    c.paste(img.transpose(Image.FLIP_LEFT_RIGHT), (round(NECK_X - (1000 - CX)), 0))
    return c


def save(img, name):
    os.makedirs(OUT, exist_ok=True)
    cell(img).save(f'{OUT}/{name}.png')


save(base, f'base-{SEX}')
head_in = ndimage.binary_erosion(al & (np.arange(B.shape[0])[:, None] < by1 - 4), iterations=10)

for kit, look in KITS:
    careca = L(f'{kit}/mochila-careca/alinhada.png'); C = np.asarray(careca).astype(int)
    cn = neck_row(C)
    hb = head_box(C, cn)
    # ---- rosto: só o que difere da pele (olhos, sobrancelhas, boca), dentro do rosto da base
    head = fit(careca, hb, (bx0, by0, bx1, by1)); H = np.asarray(head).astype(int)
    diff = np.abs(H[..., :3] - B[..., :3]).sum(-1)
    feat = head_in & (H[..., 3] > 200) & ((~skinish(H)) | (diff > 90))
    feat = ndimage.binary_opening(feat, iterations=1)
    lab, n = ndimage.label(feat)
    if n:
        sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); feat &= np.isin(lab, 1 + np.nonzero(sz >= 40)[0])
    feat = ndimage.binary_dilation(feat, iterations=2) & head_in
    F = H.copy(); F[~feat, 3] = 0
    soft = ndimage.binary_dilation(feat, iterations=2) & ~feat & head_in  # borda suave
    F[soft] = H[soft]; F[soft, 3] = 90
    save(Image.fromarray(F.astype(np.uint8)), f'face-{look}')
    # ---- cabelo (A e B): mesma transformação da cabeça
    for v, src in (('A', f'{kit}/camadas-mochila/cabelo-frente.png'), ('B', None)):
        if src is None:
            bpath = f'{kit}/cabeloB-frente/alinhada.png'
            if not os.path.exists(bpath):
                continue
            Bm = np.asarray(L(bpath)).astype(int)
            d = np.abs(Bm[..., :3] - C[..., :3]).sum(-1)
            m = (Bm[..., 3] > 20) & ((C[..., 3] < 20) | (d > 60)) & (np.arange(C.shape[0])[:, None] < cn + (220 if SEX == 'f' else 40))
            m = ndimage.binary_opening(m, iterations=5)
            Bm2 = Bm.copy(); Bm2[~m, 3] = 0
            hair = Image.fromarray(Bm2.astype(np.uint8))
        else:
            hair = L(src)
        h = np.asarray(fit(hair, hb, (bx0, by0, bx1, by1))).copy()
        h[skinish(h) & (h[..., 3] > 0), 3] = 0
        lab, n = ndimage.label(h[..., 3] > 30)
        if n:
            sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); h[np.isin(lab, 1 + np.nonzero(sz < sz.max() * .05)[0]), 3] = 0
        save(Image.fromarray(h), f'hair-{look}-{v}')
    # ---- roupa: a base vestida pelo Codex (output/base-v6/veste-<look>) menos a base: só o que mudou (o tecido)
    from subprocess import run
    vest = f'output/base-v6/veste-{look}/veste-{look}.png'
    tmp = f'output/base-v6/veste-{look}/alinhada.png'
    run(['py', 'output/kit-v5-mcp/align.py', BASE, vest, tmp, str(bn)], check=True, capture_output=True)
    M = np.asarray(L(tmp)).astype(int)
    d = np.abs(M[..., :3] - B[..., :3]).sum(-1)
    m = (M[..., 3] > 30) & ((B[..., 3] < 30) | (d > 45))
    m[:bn - 6] = False
    m = ndimage.binary_opening(m, iterations=2)
    m = ndimage.binary_fill_holes(ndimage.binary_closing(m, iterations=3)) & (M[..., 3] > 30)
    lab, n = ndimage.label(m)
    if n:
        sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); m &= np.isin(lab, 1 + np.nonzero(sz >= sz.max() * .02)[0])
    O = M.copy(); O[~m, 3] = 0
    save(Image.fromarray(O.astype(np.uint8)), f'outfit-{look}')
    print('ok', look)
