# Separa o boneco aprovado em camadas: cabeça careca, cabelo e roupa (com o pescoço).
# Entrada: o mestre (com cabelo) e o mestre careca, pintados no mesmo lugar.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

master, bald, outdir = sys.argv[1:4]
M = np.array(Image.open(master).convert('RGBA')).astype(int)
B = np.array(Image.open(bald).convert('RGBA')).astype(int)
H, W = B.shape[:2]
yy = np.mgrid[:H, :W][0]

# Pescoço: a linha mais estreita da silhueta careca entre a cabeça e os ombros.
width = (B[..., 3] > 128).sum(1)
rows = np.nonzero(width)[0]
top, bottom = rows.min(), rows.max()
lo, hi = top + int((bottom - top) * .35), top + int((bottom - top) * .65)
neck = lo + int(np.argmin(width[lo:hi]))
print('topo', top, 'pescoco', neck, 'pes', bottom)

def save(mask, src, name):
    out = src.copy()
    out[~mask, 3] = 0
    Image.fromarray(out.astype(np.uint8)).save(f'{outdir}/{name}.png')

# Cabeça: tudo da careca acima do pescoço.
save((B[..., 3] > 0) & (yy < neck + 4), B, 'cabeca-frente')
# Roupa: do pescoço para baixo, subindo um pouco por baixo do queixo (a cabeça cobre).
save((B[..., 3] > 0) & (yy >= neck - 8), B, 'roupa-frente')
# Cabelo: onde o mestre difere da careca, só na altura da cabeça.
diff = np.abs(M[..., :3] - B[..., :3]).sum(-1)
hair = (M[..., 3] > 20) & ((B[..., 3] < 20) | (diff > 60)) & (yy < neck)
# contornos finos (o contorno do crânio careca e do queixo) saem; buracos dentro do cabelo fecham
hair = ndimage.binary_opening(hair, iterations=3)
hair = ndimage.binary_fill_holes(ndimage.binary_closing(hair, iterations=4)) & (M[..., 3] > 20)
lab, n = ndimage.label(hair)
if n:
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    hair &= np.isin(lab, 1 + np.nonzero(sizes >= 300)[0])
save(hair, M, 'cabelo-frente')
