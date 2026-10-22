"""Monta as folhas do rig v2 (docs/rig-v2.md) do kit masculino v5 a partir das camadas pintadas pelo MCP.

Cabeças entram em cada célula pelo crânio careca: a caixa do crânio vai na caixa da cabeça verde do molde do rig
(docs/templates/rig/*-m.png) e o queixo encosta na base dela; cabelo e chapéu seguem a mesma transformação.
Saída em output/kit-v5-mcp/rig/<contexto>/<peça>.png, publicada depois por scripts/rig/publish.py.
Uso: py output/kit-v5-mcp/build-rig.py
"""
import json
import os

import numpy as np
from PIL import Image

K = 'output/kit-v5-mcp'
T = 'docs/templates/rig'
OUT = f'{K}/rig'
L = lambda p: Image.open(p).convert('RGBA')


def save(img, context, name):
    os.makedirs(f'{OUT}/{context}', exist_ok=True)
    img.save(f'{OUT}/{context}/{name}.png')


def green(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(int)
    return (a[..., 1] > 200) & (a[..., 0] < 90) & (a[..., 2] < 90)


def core_box(cell):
    """Caixa do miolo da cabeça verde (sem os riscos do choro): colunas e linhas bem cheias."""
    if not cell.any():
        return None
    cols = cell.sum(0); kc = np.nonzero(cols > cols.max() * .35)[0]
    rows = cell[:, kc.min():kc.max() + 1].sum(1); kr = np.nonzero(rows > rows.max() * .35)[0]
    return kc.min(), kr.min(), kc.max() + 1, kr.max() + 1


def skull(img):
    return img.split()[3].point(lambda v: 255 if v > 128 else 0).getbbox()


def place(layers, bald, box, size):
    """Encaixa as camadas (mesma tela da careca) na caixa do molde: crânio na caixa, queixo na base."""
    bb = skull(bald)
    gx0, gy0, gx1, gy1 = box
    s = ((gx1 - gx0) / (bb[2] - bb[0]) + (gy1 - gy0) / (bb[3] - bb[1])) / 2
    ox = (gx0 + gx1) / 2 - (bb[0] + bb[2]) / 2 * s
    oy = gy1 - bb[3] * s
    out = []
    for layer in layers:
        r = layer.resize((round(layer.width * s), round(layer.height * s)), Image.LANCZOS)
        cell = Image.new('RGBA', size); cell.paste(r, (round(ox), round(oy)), r)
        out.append(cell)
    return out


def key_out(a):
    """Tira magenta, verde e ciano do molde (e o serrilhado deles) de uma pintura sobre o molde."""
    a = np.asarray(a.convert('RGBA')).astype(int).copy()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = (r > 140) & (b > 140) & (g < 150) & (b > g + 40)
    grn = (g > r + 50) & (g > b + 50)
    cyn = (g > 180) & (b > 180) & (r < 100)
    a[mag | grn | cyn, 3] = 0
    return Image.fromarray(a.astype(np.uint8))


# ---------- mochila (SHOW): 1000x1368, pintada para a esquerda como no DDTank ----------
# A pintura (1000x1248 = 250x312 x4) completa o resto da célula de 342 embaixo, como o make-molds do rig.
# O jogo espelha a mochila (o DDTank pinta virado para a esquerda) e põe os pés em x=402 (FEET.show em rig.ts):
# a nossa pintura olha para a direita, então entra espelhada e deslocada para os pés caírem em 402.
lay = {n: L(f'{K}/camadas-mochila/{n}.png') for n in ('cabeca-frente', 'cabelo-frente', 'roupa-frente')}
feet = np.asarray(lay['roupa-frente'])[..., 3] > 128
rows = np.nonzero(feet.any(1))[0]; fx = np.nonzero(feet[rows.max() - 40:rows.max()].any(0))[0]
SHIFT = 402 - (1000 - (fx.min() + fx.max()) / 2)
def show_cell(img):
    cell = Image.new('RGBA', (1000, 1368)); cell.paste(img.transpose(Image.FLIP_LEFT_RIGHT), (round(SHIFT), 0)); return cell
# a roupa não pinta por cima do queixo (ordem do DDTank: rosto, cabelo, roupa)
ra = np.asarray(lay['roupa-frente']).copy(); ra[np.asarray(lay['cabeca-frente'])[..., 3] > 0, 3] = 0
lay['roupa-frente'] = Image.fromarray(ra)
face4 = Image.new('RGBA', (4000, 1368))
for k in range(4):
    face4.paste(show_cell(lay['cabeca-frente']), (k * 1000, 0))
save(face4, 'show', 'face-basic-male')
save(show_cell(lay['cabelo-frente']), 'show', 'hair-basic-male-A')
save(show_cell(lay['roupa-frente']), 'show', 'outfit-basic-male')
# boné da mochila: a edição "careca + boné", alinhada pelo corpo, menos a careca alinhada (scripts align.py)
cap_front = None
if os.path.exists(f'{K}/bone-mochila/alinhada.png'):
    from scipy import ndimage
    C = np.asarray(L(f'{K}/bone-mochila/alinhada.png')).astype(int)
    B = np.asarray(L(f'{K}/mochila-careca/alinhada.png')).astype(int)
    d = np.abs(C[..., :3] - B[..., :3]).sum(-1)
    m = (C[..., 3] > 20) & ((B[..., 3] < 20) | (d > 60)) & (np.mgrid[:C.shape[0], :C.shape[1]][0] < 776)
    m = ndimage.binary_opening(m, iterations=3)
    m = ndimage.binary_fill_holes(ndimage.binary_closing(m, iterations=4)) & (C[..., 3] > 20)
    lab, n = ndimage.label(m)
    if n:
        sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); m &= np.isin(lab, 1 + np.nonzero(sz >= sz.max() * .05)[0])
    C[~m, 3] = 0
    cap_front = Image.fromarray(C.astype(np.uint8))
    save(show_cell(cap_front), 'show', 'hat-starter')

# ---------- combate (GAME): 13x3 células de 456x380 ----------
CW, CH = 456, 380
gmold = green(f'{T}/game-m.png')
# Uma cabeça só em todo lugar (matheus 22/10: "no combate o que muda é apenas o corpo"): a mesma cabeça 3/4 da mochila,
# então cada cabelo e chapéu pintado uma vez serve na mochila, no combate e na praça.
head_layers = [lay['cabeca-frente'], lay['cabelo-frente'], cap_front or Image.new('RGBA', lay['cabeca-frente'].size)]
face = Image.new('RGBA', (CW * 13, CH * 3)); hair = face.copy(); hat = face.copy()
for i in range(39):
    r, c = divmod(i, 13)
    box = core_box(gmold[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW])
    if not box:
        continue
    f, h, t = place(head_layers, head_layers[0], box, (CW, CH))
    face.paste(f, (c * CW, r * CH)); hair.paste(h, (c * CW, r * CH)); hat.paste(t, (c * CW, r * CH))
save(face, 'game', 'face-basic-male'); save(hair, 'game', 'hair-basic-male-A'); save(hat, 'game', 'hat-starter')
# corpo: as pranchas pintadas em 4x (lotes de 6), recortadas célula a célula e repetidas como no molde
meta = json.load(open(f'{K}/combate-lotes/lotes.json'))
S, (BW, BH) = meta['scale'], meta['cell']
src = {}
for b, ids in enumerate(meta['batches']):
    sheet = L(f'{K}/combate-lote{b + 1}/combate-lote{b + 1}.png')
    for k, i in enumerate(ids):
        x, y = (k % 3) * BW + (BW - 114 * S) // 2, (k // 3) * BH + (BH - 95 * S) // 2
        src[i] = key_out(sheet.crop((x, y, x + 114 * S, y + 95 * S)))
small = np.asarray(Image.open('output/ddtank-molds/combate-1482x285.png').convert('RGBA'))
same = {}
for i in range(39):
    r, c = divmod(i, 13)
    same.setdefault(small[r * 95:(r + 1) * 95, c * 114:(c + 1) * 114].tobytes(), []).append(i)
body = Image.new('RGBA', (CW * 13, CH * 3))
for group in same.values():
    p = next((i for i in group if i in src), None)
    for i in group:
        if p is not None:
            r, c = divmod(i, 13)
            body.paste(src[p], (c * CW, r * CH))
save(body, 'game', 'outfit-basic-male')

# ---------- praça (VIRTUAL): cabeça 3 células de 480x700 (frente, olhos fechados, costas); corpo 7x2 ----------
vmold = green(f'{T}/virtualhead-m.png')
front = [L(f'{K}/camadas-mochila/cabeca-frente.png'), L(f'{K}/camadas-mochila/cabelo-frente.png')] + ([cap_front] if cap_front else [])
back = [L(f'{K}/camadas/cabeca-costas.png'), L(f'{K}/camadas/cabelo-costas.png'), L(f'{K}/camadas/bone-costas.png')]
vface = Image.new('RGBA', (1440, 700)); vhair = vface.copy(); vhat = vface.copy()
for cell, layers in ((0, front), (1, front), (2, back)):
    box = core_box(vmold[:, cell * 480:(cell + 1) * 480])
    # a cabeça de frente do molde está virada para a esquerda: a nossa (virada para a direita) entra espelhada
    use = [l.transpose(Image.FLIP_LEFT_RIGHT) for l in layers] if cell < 2 else layers
    placed = place(use, use[0], box, (480, 700))
    vface.paste(placed[0], (cell * 480, 0)); vhair.paste(placed[1], (cell * 480, 0))
    if len(placed) > 2:
        vhat.paste(placed[2], (cell * 480, 0))
save(vface, 'virtualhead', 'face-basic-male'); save(vhair, 'virtualhead', 'hair-basic-male-A')
if cap_front:
    save(vhat, 'virtualhead', 'hat-starter')
pm = json.load(open(f'{K}/praca-lotes/lotes.json'))
vbody = Image.new('RGBA', (3360, 1400))
for n, lot in enumerate(pm['lots']):
    path = f'{K}/praca-lote{n + 1}/praca-lote{n + 1}.png'
    if not os.path.exists(path):
        continue
    sheet = L(path)
    for k, col in enumerate(lot['cols']):
        vbody.paste(key_out(sheet.crop((k * 480, 0, k * 480 + 480, 700))), (col * 480, lot['row'] * 700))
save(vbody, 'virtual', 'outfit-basic-male')
print('ok')
