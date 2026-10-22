# Moldes NEUTROS a partir das medidas das folhas da pesquisa (output/ddtank-character-system).
# Só a silhueta de cada camada vira cor chapada: cabeça verde, corpo cinza, pele do corpo (mãos, pescoço) bege.
# Nenhum pixel pintado do DDTank vai para o molde; a arte original nunca é anexada ao Codex.
import glob, os
import numpy as np
from PIL import Image

SRC = 'output/ddtank-character-system/assets/original/image'
OUT = 'output/ddtank-molds'
GREEN, GRAY, SKIN, MAG = (0, 255, 0, 255), (128, 128, 128, 255), (252, 208, 172, 255), (255, 0, 255, 255)

def load(p):
    return np.array(Image.open(f'{SRC}/{p}').convert('RGBA')).astype(int)

def skinlike(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r > 200) & (g > 150) & (b > 110) & (r - b > 40) & (r - b < 130) & (r > g)

def mold(face, cloth, size, scale, skin=None):
    out = np.zeros((size[1], size[0], 4), np.uint8); out[:] = MAG
    if cloth is not None:
        # a sombra no chão (preto translúcido) não entra: o matheus não quer sombra/círculo sob o boneco
        shadow = (cloth[..., :3].sum(-1) < 40) & (cloth[..., 3] < 200)
        body = (cloth[..., 3] > 100) & ~shadow
        out[body] = GRAY
        # pele = a máscara de pele da própria roupa (camada 2), nunca adivinhada pela cor
        if skin is not None:
            out[body & (skin[..., 3] > 100)] = SKIN
    if face is not None:
        # cabeça = a maior peça do rosto em cada quadro; o resto (lágrimas, tontura) fica ciano = efeito do rosto
        from scipy import ndimage
        f = face[..., 3] > 100
        lab, n = ndimage.label(f)
        head = np.zeros_like(f)
        objs = ndimage.find_objects(lab)
        for cy in range(0, f.shape[0], 95 if f.shape[0] == 285 or f.shape[0] == 95 else f.shape[0]):
            for cx in range(0, f.shape[1], 114 if f.shape[1] in (1482,) else f.shape[1]):
                sub = lab[cy:cy + 95, cx:cx + 114] if f.shape[1] == 1482 else lab
                ids, cnt = np.unique(sub[sub > 0], return_counts=True)
                if len(ids):
                    big = ids[np.argmax(cnt)]
                    region = np.zeros_like(f); region[cy:cy + sub.shape[0], cx:cx + sub.shape[1]] = sub == big
                    head |= region
        out[f & ~head] = (0, 255, 255, 255)
        out[head] = GREEN
    img = Image.fromarray(out)
    return img.resize((size[0] * scale, size[1] * scale), Image.NEAREST)

os.makedirs(OUT, exist_ok=True)
# Mochila/loja (SHOW): 250x312, rosto com 4 quadros de piscar; o molde usa o quadro 0.
face = load('equip/m/face/default/1/show.png')[:, :250]
cloth = load('equip/m/cloth/default/1/show.png')
mold(face, cloth, (250, 312), 4, load('equip/m/cloth/default/2/show.png')).save(f'{OUT}/mochila-1000x1248.png')
# Combate (GAME): 1482x285 = 13x3 quadros de 114x95.
face = load('equip/m/face/default/1/game.png'); cloth = load('equip/m/cloth/default/1/game.png'); skin = load('equip/m/cloth/default/2/game.png')
mold(face, cloth, (1482, 285), 1, skin).save(f'{OUT}/combate-1482x285.png')
for row in range(3):
    f = face[row * 95:(row + 1) * 95]; c = cloth[row * 95:(row + 1) * 95]
    mold(f, c, (1482, 95), 2, skin[row * 95:(row + 1) * 95]).save(f'{OUT}/combate-linha{row + 1}-2x.png')
# Praça (VIRTUAL): corpo 840x350 = 7x2 quadros de 120x175 (linha 0 frente, linha 1 costas).
body = glob.glob(f'{SRC}/virtual/M/cloth/default/1.png')
if body:
    c = np.array(Image.open(body[0]).convert('RGBA')).astype(int)
    mold(None, c, (840, 350), 2).save(f'{OUT}/praca-corpo-1680x700.png')
head = glob.glob(f'{SRC}/virtual/M/face/default/1.png')
if head:
    h = np.array(Image.open(head[0]).convert('RGBA')).astype(int)
    mold(h, None, (h.shape[1], h.shape[0]), 4).save(f'{OUT}/praca-cabeca-4x.png')
    print('cabeca praca', h.shape)
print('ok')
