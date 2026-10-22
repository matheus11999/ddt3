# Alinha a versão editada (careca) à pintura original pelo corpo (que não muda):
# procura escala e deslocamento que melhor sobrepõem as silhuetas abaixo do pescoço.
# Uso: py align.py <original> <editada> <saida_alinhada> <linha_pescoco_aprox>
import sys
import numpy as np
from PIL import Image
from scipy.signal import fftconvolve

orig, edited, out, neck = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
O = Image.open(orig).convert('RGBA'); E = Image.open(edited).convert('RGBA')
W, H = O.size
k = 4  # busca em 1/4 do tamanho
def body(img, cut):
    a = (np.array(img)[..., 3] > 128).astype(float)
    a[:cut] = 0
    return a
ob = body(O, neck)[::k, ::k]
best = None
for s in np.arange(0.85, 1.20, 0.005):
    e = E.resize((round(W * s), round(H * s)), Image.BILINEAR)
    eb = body(e, round(neck * s))[::k, ::k]
    corr = fftconvolve(ob, eb[::-1, ::-1], mode='full')
    i = np.unravel_index(np.argmax(corr), corr.shape)
    score = corr[i] / np.sqrt(ob.sum() * eb.sum())
    if best is None or score > best[0]:
        dy = (i[0] - (eb.shape[0] - 1)) * k; dx = (i[1] - (eb.shape[1] - 1)) * k
        best = (score, s, dx, dy)
score, s, dx, dy = best
# refinamento fino em pixel inteiro
e = E.resize((round(W * s), round(H * s)), Image.BICUBIC)
canvas = Image.new('RGBA', (W, H)); canvas.alpha_composite(e, (0, 0)) if False else None
res = Image.new('RGBA', (W, H), (0, 0, 0, 0)); res.paste(e, (int(dx), int(dy)), e)
res.save(out)
print(f'escala {s:.3f} desloc {dx},{dy} nota {score:.3f}')
