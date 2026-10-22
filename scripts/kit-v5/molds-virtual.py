# Molde neutro da praça (cenas sociais do DDTank): corpo 840x350 = 7x2 quadros de 120x175 (linha 0 frente, linha 1 costas),
# cabeça de 120x150 (frente/costas) por cima com o deslocamento por coluna. Só silhuetas chapadas, nada da pintura original.
import numpy as np
from PIL import Image
V = 'output/ddtank-character-system/assets/original/image/virtual/M'
L = lambda p: np.array(Image.open(f'{V}/{p}').convert('RGBA')).astype(int)
GREEN, GRAY, SKIN, MAG = (0, 255, 0, 255), (128, 128, 128, 255), (252, 208, 172, 255), (255, 0, 255, 255)
OFF = [0, 0, -1, 2, 0, -1, 2]
body = (L('cloth/default/1.png')[..., 3] > 100) | (L('clothF/default/1.png')[..., 3] > 100)
skin = (L('cloth/default/2.png')[..., 3] > 100) | (L('clothF/default/2.png')[..., 3] > 100)
shadow_c = L('cloth/default/1.png'); shadow = (shadow_c[..., :3].sum(-1) < 40) & (shadow_c[..., 3] < 200)
face = L('face/default/1.png')[..., 3] > 100
out = np.zeros((350, 840, 4), np.uint8); out[:] = MAG
out[body & ~shadow] = GRAY
out[body & skin & ~shadow] = SKIN
for row, hcol in ((0, 0), (1, 2)):  # cabeça de frente na linha 0, de costas na linha 1
    h = face[:, hcol * 120:(hcol + 1) * 120]
    for col in range(7):
        y0 = row * 175 + OFF[col]
        sub = out[max(0, y0):y0 + 150, col * 120:(col + 1) * 120]
        m = h[:sub.shape[0]]
        sub[m] = GREEN
Image.fromarray(out).resize((840 * 2, 350 * 2), Image.NEAREST).save('output/ddtank-molds/praca-1680x700.png')
print(face.shape, body.sum(), skin.sum())
