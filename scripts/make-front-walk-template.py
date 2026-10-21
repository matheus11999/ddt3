"""docs/templates/front-walk.png: 3x2 cells of 512 px on magenta with the FRONT head as a flat green silhouette,
where Codex paints the lobby walk (or idle) sheet of an outfit in the front view (pedido do matheus, 21/10).
The head is drawn at the size the game draws it on the body: head (crown to neck stub) = 0.9 x body (collar to soles)."""
from PIL import Image
import numpy as np

CELL, K, TOP = 512, 0.478, 26          # head scale in the cell, crown y in the cell
head = Image.open('public/assets/front/face-basic-male.png').convert('RGBA')
a = np.asarray(head)[..., 3] > 128
green = np.zeros(a.shape + (4,), np.uint8)
green[a] = (0, 255, 0, 255)
g = Image.fromarray(green).resize((round(1254 * K), round(1254 * K)), Image.NEAREST)
sheet = Image.new('RGB', (CELL * 3, CELL * 2), (255, 0, 255))
for i in range(6):
    x, y = (i % 3) * CELL, (i // 3) * CELL
    sheet.paste(g, (x + round(CELL / 2 - 583 * K), y + round(TOP - 182 * K)), g)  # neck centred in the cell
sheet.save('docs/templates/front-walk.png')
print('neck at y', round(TOP + (627 - 182) * K), 'soles at y', round(TOP + (627 - 182) * K * (1 + 1 / 0.9)))
