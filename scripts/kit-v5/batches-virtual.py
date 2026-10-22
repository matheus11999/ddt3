# Pranchas ampliadas 4x do molde da praça para o Codex: linha da frente e de costas, em lotes de 4 e 3 quadros.
import json
from PIL import Image
m = Image.open('output/ddtank-molds/praca-1680x700.png').resize((840, 350), Image.NEAREST)
S = 4; lots = []
for row in (0, 1):
    for cols in ((0, 1, 2, 3), (4, 5, 6)):
        sheet = Image.new('RGBA', (120 * S * len(cols), 175 * S), (255, 0, 255, 255))
        for k, c in enumerate(cols):
            sheet.paste(m.crop((c * 120, row * 175, c * 120 + 120, row * 175 + 175)).resize((120 * S, 175 * S), Image.NEAREST), (k * 120 * S, 0))
        n = len(lots) + 1; sheet.save(f'output/kit-v5-mcp/praca-lotes/molde-lote{n}.png')
        lots.append({'row': row, 'cols': list(cols)})
json.dump({'scale': S, 'lots': lots}, open('output/kit-v5-mcp/praca-lotes/lotes.json', 'w'))
print(lots)
