"""Combate e praça com a base de pele única (matheus 22/10): monta as folhas do rig a partir das pranchas do Codex
(base pintada com a cabeça careca real no molde, e a base vestida com cada roupa) e das camadas da mochila.

  py scripts/kit-v5/build-gv-v6.py <sexo> <look>:<kit-dir> [...]

Saída direto em public/assets/rig/<sexo>/{game,virtual,virtualhead}/ (base-<sexo>, base-<sexo>-head, face-, hair-, outfit-).
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SEX = sys.argv[1]; LOOKS = [a.split(':') for a in sys.argv[2:]]
G = 'male' if SEX == 'm' else 'female'
B6 = f'output/base-v6/{SEX}'; RAW = f'output/base-v6/layers/{SEX}'
KIT0 = 'output/kit-v5-mcp' if SEX == 'm' else 'output/kit-v5f'
OUT = f'public/assets/rig/{SEX}'
L = lambda p: Image.open(p).convert('RGBA')
CW, CH = 456, 380  # célula do combate (4x 114x95)
VW, VH = 480, 700  # célula da praça


def save(img, ctx, name):
    os.makedirs(f'{OUT}/{ctx}', exist_ok=True); img.save(f'{OUT}/{ctx}/{name}.png')


def green(a):
    return (a[..., 1] > 180) & (a[..., 0] < 120) & (a[..., 2] < 120)


def core_box(cell):
    if not cell.any():
        return None
    cols = cell.sum(0); kc = np.nonzero(cols > cols.max() * .35)[0]
    rows = cell[:, kc.min():kc.max() + 1].sum(1); kr = np.nonzero(rows > rows.max() * .35)[0]
    return kc.min(), kr.min(), kc.max() + 1, kr.max() + 1


def skull(img):
    return img.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()


def place(layer, ref, box, size, flip=False):
    if flip:
        layer, ref = layer.transpose(Image.FLIP_LEFT_RIGHT), ref.transpose(Image.FLIP_LEFT_RIGHT)
    bb = skull(ref); gx0, gy0, gx1, gy1 = box
    s = ((gx1 - gx0) / (bb[2] - bb[0]) + (gy1 - gy0) / (bb[3] - bb[1])) / 2
    r = layer.resize((round(layer.width * s), round(layer.height * s)), Image.LANCZOS)
    out = Image.new('RGBA', size)
    out.paste(r, (round((gx0 + gx1) / 2 - (bb[0] + bb[2]) / 2 * s), round(gy1 - bb[3] * s)), r)
    return out


def head_only(img):
    a = np.asarray(img).copy(); al = a[..., 3] > 128; w = al.sum(1); r = np.nonzero(w)[0]
    lo, hi = r.min() + int((r.max() - r.min()) * .3), r.min() + int((r.max() - r.min()) * .65)
    nk = lo + int(np.argmin(w[lo:hi])); a[nk + 2:, :, 3] = 0
    lab, n = ndimage.label(a[..., 3] > 20)
    if n > 1:
        sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); a[(lab > 0) & (lab != 1 + int(np.argmax(sz))), 3] = 0
    return Image.fromarray(a)


def key_out(a):
    a = np.asarray(a.convert('RGBA')).astype(int).copy()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    a[((r > 140) & (b > 140) & (g < 150) & (b > g + 40)) | ((g > r + 50) & (g > b + 50)), 3] = 0  # azul claro é roupa, não fundo
    return a


TONE = None


def skinish(a):
    """Pele = mesma matiz da pele da base (em luz ou sombra); cáqui e creme da roupa ficam de fora."""
    n = a[..., :3] / np.maximum(1, a[..., :3].sum(-1, keepdims=True)) - TONE / TONE.sum()
    lum = a[..., :3].mean(-1) / TONE.mean()
    return (np.abs(n).sum(-1) < .05) & (lum > .5) & (lum < 1.2)


def snap(dressed, base, reach=14):
    """A edição do Codex pode mexer a figura uns pixels: alinha a célula vestida à base pelo contorno."""
    A = (base[..., 3] > 30).astype(float); D = (dressed[..., 3] > 30).astype(float)
    F = np.fft.ifft2(np.fft.fft2(A) * np.conj(np.fft.fft2(D))).real
    best, by, bx = -1, 0, 0
    for dy in range(-reach, reach + 1):
        for dx in range(-reach, reach + 1):
            v = F[dy % F.shape[0], dx % F.shape[1]]
            if v > best:
                best, by, bx = v, dy, dx
    return np.roll(dressed, (by, bx), (0, 1))


def diff_cloth(dressed, base, hm, ring):
    """Roupa = a figura vestida inteira (alinhada à base), menos a cabeça e menos a pele do pescoço.

    Recortar só o tecido pela diferença abria buracos (roupa da cor da base) e deixava contornos soltos; a figura
    vestida é a própria base com a roupa pintada por cima, então braços e pernas da roupa coincidem com os da base (e
    recebem a mesma cor de pele no jogo). No anel em volta da cabeça fica só o tecido: o pescoço é sempre o da base.
    """
    o = snap(dressed, base).copy()
    near = ndimage.binary_dilation(hm, iterations=ring) & ~hm
    r, g, b = o[..., 0], o[..., 1], o[..., 2]
    skin = (r > 150) & (r > g) & (g > b) & (r - b > 40)
    o[hm | (near & skin), 3] = 0
    o[near & ~ndimage.binary_opening(o[..., 3] > 30, iterations=2), 3] = 0  # sobras de contorno da cabeça
    lab, n = ndimage.label(o[..., 3] > 30)
    if n:
        sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); o[np.isin(lab, 1 + np.nonzero(sz < 60)[0]), 3] = 0
    return o


def layer_diff(full, bald):
    C = np.asarray(L(full)).astype(int); Bm = np.asarray(L(bald)).astype(int)
    d = np.abs(C[..., :3] - Bm[..., :3]).sum(-1)
    m = (C[..., 3] > 20) & ((Bm[..., 3] < 20) | (d > 60))
    m = ndimage.binary_opening(m, iterations=3); m = ndimage.binary_fill_holes(ndimage.binary_closing(m, iterations=4)) & (C[..., 3] > 20)
    lab, n = ndimage.label(m)
    if n:
        sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); m &= np.isin(lab, 1 + np.nonzero(sz >= 300)[0])
    C[~m, 3] = 0
    return Image.fromarray(C.astype(np.uint8))


base_full = L(f'{RAW}/base-{SEX}.png'); bhead = head_only(base_full)
_bf = np.asarray(base_full).astype(int); _r, _g, _b = _bf[..., 0], _bf[..., 1], _bf[..., 2]
TONE = _bf[(_bf[..., 3] > 200) & (_r > 200) & (_r - _b > 35) & (_r > _g)][:, :3].mean(0)
hat = layer_diff(f'{KIT0}/bone-mochila/alinhada.png', f'{KIT0}/mochila-careca/alinhada.png') if os.path.exists(f'{KIT0}/bone-mochila/alinhada.png') else None

# ---------------- combate ----------------
srcmold = 'output/kit-v5-mcp/combate-lotes' if SEX == 'm' else 'output/kit-v5f/combate-lotes'
meta = json.load(open(f'{srcmold}/lotes.json'))
small = np.asarray(L('output/ddtank-molds/combate-1482x285.png' if SEX == 'm' else 'output/ddtank-molds-f/combate-1482x285.png'))
groups = {}
for i in range(39):
    r, c = divmod(i, 13); groups.setdefault(small[r * 95:(r + 1) * 95, c * 114:(c + 1) * 114].tobytes(), []).append(i)
src_of = {}
for g in groups.values():
    for i in g:
        src_of[i] = g[0]
pos = {}  # célula do combate -> (lote, x, y) do quadro pintado
for b, ids in enumerate(meta['batches']):
    for k, i in enumerate(ids):
        pos[i] = (b + 1, (k % 3) * 512 + 28, (k // 3) * 512 + 66)
for g in groups.values():  # repetição do molde
    p = next((i for i in g if i in pos), None)
    for i in g:
        if p is not None:
            pos[i] = pos[p]

sheets = {}
def sheet(path):
    if path not in sheets:
        sheets[path] = L(path)
    return sheets[path]

W13 = Image.new('RGBA', (CW * 13, CH * 3))
gbase = W13.copy(); ghead = W13.copy(); gface = {l: W13.copy() for l, _ in LOOKS}
ghair = {(l, v): W13.copy() for l, _ in LOOKS for v in 'AB'}; ghat = W13.copy(); gout = {l: W13.copy() for l, _ in LOOKS}
for i in range(39):
    if i not in pos:
        continue
    b, x, y = pos[i]; r, c = divmod(i, 13); at = (c * CW, r * CH)
    mold = np.asarray(L(f'{srcmold}/molde-lote{b}.png'))[y:y + CH, x:x + CW]
    box = core_box(green(mold))
    if not box:
        continue
    hb = place(bhead, bhead, box, (CW, CH)); ghead.paste(hb, at)
    for l, _ in LOOKS:
        gface[l].paste(place(L(f'{RAW}/face-{l}.png'), bhead, box, (CW, CH)), at)
        for v in 'AB':
            if os.path.exists(f'{RAW}/hair-{l}-{v}.png'):
                ghair[(l, v)].paste(place(L(f'{RAW}/hair-{l}-{v}.png'), bhead, box, (CW, CH)), at)
    if hat:
        ghat.paste(place(hat, bhead, box, (CW, CH)), at)
    base_cell = key_out(sheet(f'{B6}/combate{b}/combate{b}.png').crop((x, y, x + CW, y + CH)))
    hm = np.asarray(hb)[..., 3] > 40
    body = base_cell.copy(); body[hm, 3] = 0  # a cabeça vem da folha de cabeça
    gbase.paste(Image.fromarray(body.astype(np.uint8)), at)
    for l, _ in LOOKS:
        dp = f'{B6}/veste-{l}-combate{b}/veste-{l}-combate{b}.png'
        if not os.path.exists(dp):  # conjunto novo (look-jobs-v6.py)
            dp = f'output/base-v6/looks/{l}/combate{b}/combate{b}.png'
        if os.path.exists(dp):
            dr = key_out(sheet(dp).crop((x, y, x + CW, y + CH)))
            o = diff_cloth(dr, base_cell, hm, max(4, (box[3] - box[1]) // 4))
            gout[l].paste(Image.fromarray(o.astype(np.uint8)), at)
save(gbase, 'game', f'base-{SEX}'); save(ghead, 'game', f'base-{SEX}-head')
if hat:
    save(ghat, 'game', 'hat-starter')
for l, _ in LOOKS:
    save(gface[l], 'game', f'face-{l}'); save(gout[l], 'game', f'outfit-{l}')
    for v in 'AB':
        save(ghair[(l, v)], 'game', f'hair-{l}-{v}')

# ---------------- praça ----------------
psrc = 'output/kit-v5-mcp/praca-lotes' if SEX == 'm' else 'output/kit-v5f/praca-lotes'
bback = head_only(L(f'{KIT0}/costas-careca/costas-careca.png'))
vbody = Image.new('RGBA', (VW * 7, VH * 2)); vout = {l: Image.new('RGBA', (VW * 7, VH * 2)) for l, _ in LOOKS}
vhead = Image.new('RGBA', (VW * 3, VH)); vface = {l: vhead.copy() for l, _ in LOOKS}
vhair = {(l, v): vhead.copy() for l, _ in LOOKS for v in 'AB'}; vhat = vhead.copy()
for row, name, flip in ((0, 'frente', True), (1, 'costas', False)):
    mold = np.asarray(L(f'{psrc}/molde-{name}-inteiro.png'))
    bsheet = f'{B6}/praca-{name}/praca-{name}.png'
    for col in range(7):
        x, y = (col % 4) * VW, (col // 4) * VH
        box = core_box(green(mold[y:y + VH, x:x + VW]))
        ref = bhead if row == 0 else bback
        hb = place(ref, ref, box, (VW, VH), flip); hm = np.asarray(hb)[..., 3] > 40
        if col == 0:  # a célula de cabeça (o jogo aplica os deslocamentos de cada quadro)
            cells = (0, 1) if row == 0 else (2,)
            for hc in cells:
                vhead.paste(hb, (hc * VW, 0))
                for l, kit in LOOKS:
                    if row == 0:
                        vface[l].paste(place(L(f'{RAW}/face-{l}.png'), ref, box, (VW, VH), flip), (hc * VW, 0))
                        for v in 'AB':
                            if os.path.exists(f'{RAW}/hair-{l}-{v}.png'):
                                vhair[(l, v)].paste(place(L(f'{RAW}/hair-{l}-{v}.png'), ref, box, (VW, VH), flip), (hc * VW, 0))
                    else:
                        kback = head_only(L(f'{kit}/costas-careca/costas-careca.png'))
                        vhair[(l, 'A')].paste(place(L(f'{kit}/camadas/cabelo-costas.png'), kback, box, (VW, VH)), (hc * VW, 0))
                        bp = f'{kit}/cabeloB-costas/alinhada.png'
                        if os.path.exists(bp):
                            vhair[(l, 'B')].paste(place(layer_diff(bp, f'{kit}/costas-careca/costas-careca.png'), kback, box, (VW, VH)), (hc * VW, 0))
                if hat and row == 0:
                    vhat.paste(place(hat, ref, box, (VW, VH), flip), (hc * VW, 0))
                if row == 1 and os.path.exists(f'{KIT0}/camadas/bone-costas.png'):
                    vhat.paste(place(L(f'{KIT0}/camadas/bone-costas.png'), bback, box, (VW, VH)), (hc * VW, 0))
        if not os.path.exists(bsheet):
            continue
        base_cell = key_out(L(bsheet).crop((x, y, x + VW, y + VH)))
        hm = ndimage.binary_dilation(hm, iterations=3); hm[:box[3] - 6] = True  # na praça nada passa do queixo para cima
        body = base_cell.copy(); body[hm, 3] = 0
        # o molde já tem o deslocamento da cabeça desta coluna; o jogo desenha a cabeça com o mesmo deslocamento
        vbody.paste(Image.fromarray(body.astype(np.uint8)), (col * VW, row * VH))
        for l, _ in LOOKS:
            dp = f'{B6}/veste-{l}-praca-{name}/veste-{l}-praca-{name}.png'
            if not os.path.exists(dp):
                dp = f'output/base-v6/looks/{l}/praca-{name}/praca-{name}.png'
            if os.path.exists(dp):
                o = diff_cloth(key_out(L(dp).crop((x, y, x + VW, y + VH))), base_cell, hm, max(4, (box[3] - box[1]) // 4))
                vout[l].paste(Image.fromarray(o.astype(np.uint8)), (col * VW, row * VH))
# as células da praça são pintadas viradas para a esquerda no DDTank: o jogo espelha a frente; o molde já está assim
save(vbody, 'virtual', f'base-{SEX}'); save(vhead, 'virtualhead', f'base-{SEX}-head')
if hat:
    save(vhat, 'virtualhead', 'hat-starter')
for l, _ in LOOKS:
    save(vout[l], 'virtual', f'outfit-{l}'); save(vface[l], 'virtualhead', f'face-{l}')
    for v in 'AB':
        save(vhair[(l, v)], 'virtualhead', f'hair-{l}-{v}')
print('ok', SEX)
