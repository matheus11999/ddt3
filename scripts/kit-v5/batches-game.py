# Divide as poses únicas do molde de combate (13x3 quadros de 114x95) em pranchas 3x2 ampliadas 4x
# para o Codex pintar; lotes.json guarda de qual quadro veio cada célula (para remontar a folha).
import hashlib, json
import numpy as np
from PIL import Image
K = 'output/kit-v5-mcp/combate-lotes'
a = np.array(Image.open('output/ddtank-molds/combate-1482x285.png').convert('RGBA'))
cells, seen = [], set()
for i in range(39):
    r, c = divmod(i, 13); cell = a[r * 95:(r + 1) * 95, c * 114:(c + 1) * 114]
    if not ((cell[..., 1] == 255) & (cell[..., 0] == 0)).any(): continue
    h = hashlib.md5(cell.tobytes()).hexdigest()
    if h in seen: continue
    seen.add(h); cells.append(i)
S, CW, CH = 4, 512, 512  # cada quadro 114x95 vira 456x380 no centro de uma célula 512x512
batches = [cells[i:i + 6] for i in range(0, len(cells), 6)]
for b, ids in enumerate(batches):
    sheet = Image.new('RGBA', (CW * 3, CH * 2), (255, 0, 255, 255))
    for k, i in enumerate(ids):
        r, c = divmod(i, 13)
        cell = Image.fromarray(a[r * 95:(r + 1) * 95, c * 114:(c + 1) * 114]).resize((114 * S, 95 * S), Image.NEAREST)
        sheet.paste(cell, ((k % 3) * CW + (CW - 114 * S) // 2, (k // 3) * CH + (CH - 95 * S) // 2))
    sheet.save(f'{K}/molde-lote{b + 1}.png')
json.dump({'scale': S, 'cell': [CW, CH], 'batches': batches}, open(f'{K}/lotes.json', 'w'))
print(len(cells), batches)
