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


def face_with_neck(bald_path, head_only):
    """Como no DDTank (matheus 22/10, a emenda queixo/pescoço rasgava): o pescoço é da cabeça, pintado junto com o queixo,
    descendo até um pouco abaixo da gola; a roupa é desenhada por cima e a gola cobre a ponta. Vem da pintura careca
    aprovada: a cabeça já recortada mais a pele contínua logo abaixo do queixo."""
    from scipy import ndimage
    B = np.asarray(L(bald_path)).astype(int)
    H = np.asarray(head_only)
    r, g, b = B[..., 0], B[..., 1], B[..., 2]
    skin = (B[..., 3] > 40) & (r > 170) & (g > 110) & (b > 70) & (r - b > 35) & (r - b < 190) & ~((r > 225) & (g > 215) & (b > 205))
    rows = np.nonzero((H[..., 3] > 40).any(1))[0]
    chin = rows.max()
    cols = np.nonzero(H[chin - 6:chin + 1, :, 3].max(0) > 40)[0]
    region = np.zeros(skin.shape, bool)
    reach = int((chin - rows.min()) * .28)  # até um pouco abaixo da gola
    region[chin - 10:chin + reach, max(0, cols.min() - 20):cols.max() + 20] = True
    neck = skin & region
    lab, n = ndimage.label(neck)
    if n:  # só a pele ligada ao queixo
        touching = set(np.unique(lab[chin - 10:chin + 3][lab[chin - 10:chin + 3] > 0]))
        neck = np.isin(lab, list(touching))
    neck = ndimage.binary_closing(neck, iterations=2) & (B[..., 3] > 40)
    out = H.copy()
    add = neck & (H[..., 3] < 200)
    out[add] = B[add]
    # contorno escuro dos lados do pescoço (o que a pintura tinha ali)
    edge = ndimage.binary_dilation(neck, iterations=3) & ~neck & region & (B[..., 3] > 40) & (r + g + b < 260)
    edge &= np.arange(B.shape[0])[:, None] > chin
    out[edge & (H[..., 3] < 200)] = B[edge & (H[..., 3] < 200)]
    return Image.fromarray(out.astype(np.uint8))


face_neck = face_with_neck(f'{K}/mochila-careca/alinhada.png', lay['cabeca-frente'])
face_neck.save(f'{K}/camadas-mochila/cabeca-pescoco.png')
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
    face4.paste(show_cell(face_neck), (k * 1000, 0))
save(face4, 'show', 'face-basic-male')
save(show_cell(lay['cabelo-frente']), 'show', 'hair-basic-male-A')
save(show_cell(lay['roupa-frente']), 'show', 'outfit-basic-male')
def diff_layer(full, base, below=776):
    """A peça que uma edição acrescentou (boné, cabelo B): a edição alinhada menos a base alinhada (align.py)."""
    from scipy import ndimage
    C = np.asarray(L(full)).astype(int)
    B = np.asarray(L(base)).astype(int)
    d = np.abs(C[..., :3] - B[..., :3]).sum(-1)
    m = (C[..., 3] > 20) & ((B[..., 3] < 20) | (d > 60)) & (np.mgrid[:C.shape[0], :C.shape[1]][0] < below)
    m = ndimage.binary_opening(m, iterations=3)
    m = ndimage.binary_fill_holes(ndimage.binary_closing(m, iterations=4)) & (C[..., 3] > 20)
    lab, n = ndimage.label(m)
    if n:
        sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); m &= np.isin(lab, 1 + np.nonzero(sz >= sz.max() * .05)[0])
    C[~m, 3] = 0
    return Image.fromarray(C.astype(np.uint8))


# boné e cabelo B (sob chapéu) da mochila: edições da careca, alinhadas pelo corpo
cap_front = diff_layer(f'{K}/bone-mochila/alinhada.png', f'{K}/mochila-careca/alinhada.png') if os.path.exists(f'{K}/bone-mochila/alinhada.png') else None
hairB_front = diff_layer(f'{K}/cabeloB-frente/alinhada.png', f'{K}/mochila-careca/alinhada.png') if os.path.exists(f'{K}/cabeloB-frente/alinhada.png') else None
if cap_front:
    save(show_cell(cap_front), 'show', 'hat-starter')
if hairB_front:
    save(show_cell(hairB_front), 'show', 'hair-basic-male-B')

# ---------- combate (GAME): 13x3 células de 456x380 ----------
CW, CH = 456, 380
gmold = green(f'{T}/game-m.png')
# Uma cabeça só em todo lugar (matheus 22/10: "no combate o que muda é apenas o corpo"): a mesma cabeça 3/4 da mochila,
# então cada cabelo e chapéu pintado uma vez serve na mochila, no combate e na praça.
empty = Image.new('RGBA', lay['cabeca-frente'].size)
head_layers = [lay['cabeca-frente'], lay['cabelo-frente'], cap_front or empty, hairB_front or empty]
face = Image.new('RGBA', (CW * 13, CH * 3)); hair = face.copy(); hat = face.copy(); hairB = face.copy()
for i in range(39):
    r, c = divmod(i, 13)
    box = core_box(gmold[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW])
    if not box:
        continue
    f, h, t, hb = place(head_layers, head_layers[0], box, (CW, CH))
    face.paste(f, (c * CW, r * CH)); hair.paste(h, (c * CW, r * CH)); hat.paste(t, (c * CW, r * CH)); hairB.paste(hb, (c * CW, r * CH))
save(face, 'game', 'face-basic-male'); save(hair, 'game', 'hair-basic-male-A'); save(hat, 'game', 'hat-starter')
if hairB_front:
    save(hairB, 'game', 'hair-basic-male-B')
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


def chin_trim(img):
    # a cabeça da mochila foi cortada um pouco abaixo do queixo e trouxe pescoço/sombra laranja: só esse laranja sai,
    # nos 15% de baixo da cabeça
    a = np.asarray(img).copy()
    al = a[..., 3] > 40
    rows = np.nonzero(al.any(1))[0]
    lo = rows.max() - int((rows.max() - rows.min()) * .15)
    r, g, b = (a[..., i].astype(int) for i in range(3))
    orange = (r > 190) & (g < 175) & (b < 120) & (r - b > 110)
    sel = np.zeros(al.shape, bool); sel[lo:] = True
    a[sel & orange, 3] = 0
    return Image.fromarray(a)


front = [face_neck, L(f'{K}/camadas-mochila/cabelo-frente.png'), cap_front or empty, hairB_front or empty]
hairB_back = diff_layer(f'{K}/cabeloB-costas/alinhada.png', f'{K}/costas-careca/costas-careca.png', 10**6) if os.path.exists(f'{K}/cabeloB-costas/alinhada.png') else None
back = [L(f'{K}/camadas/cabeca-costas.png'), L(f'{K}/camadas/cabelo-costas.png'), L(f'{K}/camadas/bone-costas.png'), hairB_back or Image.new('RGBA', (1254, 1254))]
vface = Image.new('RGBA', (1440, 700)); vhair = vface.copy(); vhat = vface.copy(); vhairB = vface.copy()
for cell, layers in ((0, front), (1, front), (2, back)):
    box = core_box(vmold[:, cell * 480:(cell + 1) * 480])
    # a cabeça de frente do molde está virada para a esquerda: a nossa (virada para a direita) entra espelhada
    use = [l.transpose(Image.FLIP_LEFT_RIGHT) for l in layers] if cell < 2 else layers
    # encaixe pelo crânio sem pescoço (a cabeça com pescoço é mais alta e mudaria a escala)
    base = lay['cabeca-frente'].transpose(Image.FLIP_LEFT_RIGHT) if cell < 2 else use[0]
    placed = place(use, base, box, (480, 700))
    vface.paste(placed[0], (cell * 480, 0)); vhair.paste(placed[1], (cell * 480, 0))
    vhat.paste(placed[2], (cell * 480, 0)); vhairB.paste(placed[3], (cell * 480, 0))
save(vface, 'virtualhead', 'face-basic-male'); save(vhair, 'virtualhead', 'hair-basic-male-A')
if hairB_front and hairB_back:
    save(vhairB, 'virtualhead', 'hair-basic-male-B')
if cap_front:
    save(vhat, 'virtualhead', 'hat-starter')
def clean_neck(cell):
    """O pescoço foi pintado sobre o toquinho verde do molde e saiu manchado (laranja, verde, contorno solto; matheus 22/10).
    Tudo acima da gola sai e o pescoço é redesenhado limpo: pele com sombra do queixo e contorno escuro dos lados,
    da gola até um pouco acima (a cabeça, desenhada por cima, cobre o resto)."""
    from PIL import ImageDraw
    a = np.asarray(cell).astype(int).copy()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    a[(r > g + 40) & (b > g + 20) & (r < 200), 3] = 0  # franja magenta do fundo
    m = a[..., 3] > 40
    white = m & (r > 185) & (g > 175) & (b > 170) & (np.abs(r - b) < 40)
    if not white.any():
        return Image.fromarray(a.astype(np.uint8))
    rows = np.nonzero(white.any(1))[0]
    collar = rows.min()
    xs = np.nonzero(white[collar:collar + 12].any(0))[0]
    cx = (xs.min() + xs.max()) / 2
    shirt_w = xs.max() - xs.min()
    a[:collar + 2, :, 3] = 0  # tudo acima da gola
    # dentro da gola a pintura ficou laranja (o verde do molde por baixo): vira a sombra da pele
    band = np.zeros(m.shape, bool); band[collar:collar + max(10, int(shirt_w * .25))] = True
    orange = band & m & (r > 190) & (g < 175) & (b < 130) & (r - b > 90)
    a[orange, :3] = (205, 150, 115)
    img = Image.fromarray(a.astype(np.uint8))
    neck = Image.new('RGBA', img.size)
    d = ImageDraw.Draw(neck)
    hw = max(6, shirt_w * .16)
    top = collar - max(8, shirt_w * .16)
    d.rectangle((cx - hw, top, cx + hw, collar + 6), fill=(247, 198, 160, 255))
    for k in range(int(collar - top) + 7):  # sombra do queixo descendo até a gola
        y = top + k; f = 0.80 + 0.2 * min(1, k / max(1, (collar - top) * .6))
        d.line((cx - hw, y, cx + hw, y), fill=(int(247 * f), int(198 * f), int(160 * f), 255))
    # sem contorno dos lados: o queixo é meio translúcido na borda e as linhas apareciam através do rosto
    neck.alpha_composite(img)  # a camiseta (gola) por cima do pescoço
    return neck


def fit_to_mold(cell, mold):
    """Cada prancha da praça saiu numa escala (matheus 22/10: o andar de lado ficou esquisito, os quadros 4-6 maiores):
    o corpo pintado vai para a altura do boneco cinza do molde, pés na base dele, centrado nele; sobras soltas saem."""
    from scipy import ndimage
    a = np.asarray(cell).copy()
    m = a[..., 3] > 40
    lab, n = ndimage.label(m)
    if n:  # contorno pontilhado que sobra da cabeça verde: fica só a maior peça (o corpo)
        sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); keep = np.isin(lab, 1 + np.nonzero(sz >= sz.max() * .15)[0])
        a[~keep, 3] = 0
    img = Image.fromarray(a)
    pb = img.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()
    ys, xs = np.nonzero(mold)
    if not pb or not len(ys):
        return img
    s = (ys.max() - ys.min() + 1) / (pb[3] - pb[1])
    body = img.crop(pb).resize((round((pb[2] - pb[0]) * s), round((pb[3] - pb[1]) * s)), Image.LANCZOS)
    out = Image.new('RGBA', img.size)
    # sobe um pouco: o pescoço entra por baixo do queixo (a cabeça é desenhada por cima do corpo na praça)
    lift = round(body.height * .03)
    out.paste(body, (round((xs.min() + xs.max()) / 2 - body.width / 2), ys.max() + 1 - body.height - lift), body)
    return out


_vm = np.asarray(Image.open(f'{T}/virtual-m.png').convert('RGB')).astype(int)
vmold_body = (np.abs(_vm - 150).sum(-1) < 30)  # o boneco cinza (150,150,150) de make-molds.py
pm = json.load(open(f'{K}/praca-lotes/lotes.json'))
vbody = Image.new('RGBA', (3360, 1400))
for n, lot in enumerate(pm['lots']):
    path = f'{K}/praca-lote{n + 1}/praca-lote{n + 1}.png'
    if not os.path.exists(path):
        continue
    sheet = L(path)
    for k, col in enumerate(lot['cols']):
        cell = key_out(sheet.crop((k * 480, 0, k * 480 + 480, 700)))
        vbody.paste(fit_to_mold(cell, vmold_body[lot['row'] * 700:(lot['row'] + 1) * 700, col * 480:(col + 1) * 480]), (col * 480, lot['row'] * 700))
# Andar de frente (também o dos lados, espelhado) repintado numa prancha só, 4x2 com os 7 quadros (matheus 22/10:
# as duas pranchas antigas não combinavam entre si); substitui a linha de frente.
v3 = f'{K}/praca-frente-v3/praca-frente-v3.png'
if os.path.exists(v3):
    # Pintado com a cabeça de verdade no molde (matheus 22/10: o pescoço sob a cabeça verde saía manchado): o pescoço
    # liga no queixo real. Aqui sai a cabeça (a mesma que o jogo desenha por cima), um pouco folgada para os lados e
    # para cima, nunca abaixo do queixo, para o pescoço continuar inteiro debaixo dele.
    from scipy import ndimage
    sheet = L(v3)
    hd = Image.open('public/assets/rig/m/virtualhead/face-basic-male.png').convert('RGBA').crop((0, 0, 480, 700))
    hh = Image.open('public/assets/rig/m/virtualhead/hair-basic-male-A.png').convert('RGBA').crop((0, 0, 480, 700))
    hd.alpha_composite(hh)
    hmask = np.asarray(hd.transpose(Image.FLIP_LEFT_RIGHT))[..., 3] > 30
    chin = np.full(480, -1)
    for x in np.nonzero(hmask.any(0))[0]:
        chin[x] = np.nonzero(hmask[:, x])[0].max()
    offs = [0, 0, -1, 2, 0, -1, 2]
    for col in range(7):
        x, y = (col % 4) * 480, (col // 4) * 700
        cell = np.asarray(key_out(sheet.crop((x, y, x + 480, y + 700)))).copy()
        m = np.roll(hmask, offs[col] * 4, axis=0)
        grown = ndimage.binary_dilation(m, iterations=10)
        ys = np.arange(700)[:, None]
        below = ys > (np.roll(chin, 0)[None, :] + offs[col] * 4)
        grown &= ~(below & (chin[None, :] >= 0)) | m
        grown &= ~(chin[None, :] < 0) | (ys < (chin[chin >= 0].min() if (chin >= 0).any() else 0))
        cell[grown, 3] = 0
        # o pescoço agora é da cabeça: a roupa fica só da gola para baixo
        r_, g_, b_ = (cell[..., i].astype(int) for i in range(3))
        whiteshirt = (cell[..., 3] > 40) & (r_ > 185) & (g_ > 175) & (b_ > 170) & (np.abs(r_ - b_) < 40)
        if whiteshirt.any():
            collar = np.nonzero(whiteshirt.any(1))[0].min()
            cell[:collar, :, 3] = 0
        r_, g_, b_ = (cell[..., i].astype(int) for i in range(3))
        cell[(r_ > g_ + 35) & (b_ > g_ + 15) & (r_ < 235), 3] = 0  # franja magenta
        lab, n = ndimage.label(cell[..., 3] > 30)
        if n:  # pontinhos soltos (resto do contorno da cabeça pintada)
            sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
            cell[np.isin(lab, 1 + np.nonzero(sz < sz.max() * .02)[0]), 3] = 0
        vbody.paste(Image.new('RGBA', (480, 700)), (col * 480, 0))
        vbody.paste(Image.fromarray(cell), (col * 480, 0))
save(vbody, 'virtual', 'outfit-basic-male')
print('ok')
