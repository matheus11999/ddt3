"""Pedidos do Codex para um conjunto novo (rosto, cabelo, roupa) na base de pele única, com pose própria na mochila.

  py scripts/kit-v5/look-jobs-v6.py <sexo> <look>     cria os pedidos em output/base-v6/looks/<look>/ (rode com run-look.ps1)

A pose da mochila é da roupa (matheus 23/10: "faça pose diferente"): a base careca ganha braços e pernas novos com a
cabeça idêntica, e o jogo desenha base-<sexo>~<look> no lugar da base quando essa roupa está vestida. Rosto e cabelo
encaixam porque a cabeça não muda. Combate e praça seguem as poses do jogo.
"""
import json
import os
import sys

SEX, LOOK = sys.argv[1], sys.argv[2]
D = f'output/base-v6/looks/{LOOK}'
LOOKS = {
    'mage-male': dict(
        outfit='a young apprentice MAGE outfit: a short deep-indigo hooded cape (hood DOWN on the back, never on the head) with a gold clasp and small gold star embroidery on the hem, a teal tunic with a wide brown leather belt holding a small pouch, navy knee shorts, striped indigo-and-gold knee socks and pointed brown ankle boots with gold buckles',
        hair='silver-white hair, a bit long and swept up, with a long side fringe falling over one eye side and a few soft locks at the nape',
        face='a confident mischievous smirk (one corner of the mouth up), one eyebrow raised, big bright AMBER eyes',
        pose='a lively MAGIC pose: the left arm raised high with the open hand up as if casting a spell, the right hand resting on the hip, the weight on one leg with the other foot slightly forward and turned out',
        hairB='the same silver-white hair pressed FLAT under a hat: no volume, it hugs the skull, the side fringe just above the eyebrow, short neat sides and nape'),
}
T = LOOKS[LOOK]
STYLE = 'Clean dark outlines, soft cel shading with a little painted volume, bright clean colors (DDTank style). No text, no shadow on the ground, no circle.'
BASE = f'output/base-v6/{SEX}-mochila/{SEX}-mochila.png'
KIT0 = 'output/kit-v5-mcp' if SEX == 'm' else 'output/kit-v5f'


def job(name, refs, size, bg, prompt):
    d = f'{D}/{name}'; os.makedirs(d, exist_ok=True)
    open(f'{d}/refs.txt', 'w').write('\n'.join(refs) + '\n')
    json.dump({'background': bg, 'size': size}, open(f'{d}/job.json', 'w'))
    open(f'{d}/prompt.txt', 'w', encoding='utf8').write(prompt)


out = lambda n: f'{D}/{n}/{n}.png'
job('pose', [BASE], [1000, 1248], 'alpha', f'''Use case: precise image EDIT. IMAGE 1 is the game's neutral BASE BODY (blank bald head with no face, plain light-gray tank top and short shorts, bare arms, legs and feet) and the edit target.
Change ONLY the pose of the body to {T['pose']}. The HEAD and the NECK stay pixel-identical (same position, size, outline and shading); the body keeps the same size, proportions, light-gray tank top and shorts, skin color and painting; the hands stay ROUND fists or a simple open hand with soft fingers, the same size as before. Feet stay on the same ground line. Same canvas 1000x1248. {STYLE} Fully transparent background.''')
job('mestre', [out('pose'), f'{KIT0}/mochila-mestre/mochila-mestre.png'], [1000, 1248], 'alpha', f'''Use case: precise image EDIT. IMAGE 1 is the edit target: the game's base body in its pose (bald head with no face). IMAGE 2 only shows the approved painting style and face proportions of the game.
Turn IMAGE 1 into a NEW character with the SAME head, pose and body: paint the FACE ({T['face']}, eyes placed like IMAGE 2's), the HAIR ({T['hair']}) and the OUTFIT ({T['outfit']}). Hair never covers the eyes; the ears stay visible. The skull, the jaw, the neck and the body keep IMAGE 1's exact outline, position and size. {STYLE} Fully transparent background.''')
job('careca', [out('mestre')], [1000, 1248], 'alpha', '''Use case: precise image EDIT. IMAGE 1 is the APPROVED character and the edit target. Remove ONLY the hair: he becomes BALD, the smooth round skull with the same skin color, shading and dark outline, the ears complete, the forehead continuing up to the top of the skull. Everything else (face, eyes, eyebrows, mouth, ears, body, outfit, pose, colors, canvas) stays pixel-identical to IMAGE 1. Fully transparent background.''')
job('cabeloB', [out('careca'), out('mestre')], [1000, 1248], 'alpha', f'''Use case: precise image EDIT. IMAGE 1 is the edit target: the approved character, bald. IMAGE 2 is the same character with his normal hair. Paint on IMAGE 1 {T['hairB']}, never sticking out past the skull outline. Same color, shine and painting style as IMAGE 2. Everything else stays pixel-identical to IMAGE 1. Fully transparent background.''')
job('veste', [out('pose'), out('mestre')], [1000, 1248], 'alpha', '''Use case: precise image EDIT. IMAGE 1 is the edit target: the game's neutral BASE BODY (blank bald head, plain gray tank top and shorts, bare limbs) in its pose. IMAGE 2 shows the approved outfit worn in the same pose.
DRESS the body of IMAGE 1 in EXACTLY the outfit of IMAGE 2 (same clothes, cape, colors, details, socks and boots), fitted to IMAGE 1's body, arms and legs as they are: the clothes completely cover the gray tank top and shorts; bare skin stays only where IMAGE 2 shows skin. Do NOT touch the head, the neck, the hands or any skin: every pixel that is not clothing stays exactly as in IMAGE 1 (same canvas, position and size). Fully transparent background.''')
cc = f'{KIT0}/costas-careca/costas-careca.png'
job('costas', [cc, out('mestre')], [1254, 1254], 'alpha', f'''Use case: precise image EDIT. IMAGE 1 is the edit target: the game's bald character seen from directly BEHIND. IMAGE 2 is the approved character from the front. Paint on IMAGE 1's head ONLY the same hair seen from BEHIND ({T['hair']}; from behind we see the back of the hair and the locks at the nape). Same color and painting as IMAGE 2. Everything else stays pixel-identical to IMAGE 1. Fully transparent background.''')
job('costasB', [cc, out('cabeloB')], [1254, 1254], 'alpha', f'''Use case: precise image EDIT. IMAGE 1 is the edit target: the game's bald character seen from directly BEHIND. IMAGE 2 shows the character's hair pressed flat under a hat, from the front. Paint on IMAGE 1's head ONLY that flat hair seen from BEHIND: it hugs the skull with NO volume, short neat nape, never past the skull outline. Same color and painting. Everything else stays pixel-identical to IMAGE 1. Fully transparent background.''')
B6 = f'output/base-v6/{SEX}'
for b in range(1, 6):
    job(f'combate{b}', [f'{B6}/combate{b}/combate{b}.png', out('mestre')], [1536, 1024], 'magenta', f'''Use case: precise image EDIT. IMAGE 1 is the edit target: a battle sprite sheet of the game's neutral BASE BODY (bald head, plain gray tank top and shorts, bare limbs) in 6 poses on magenta. IMAGE 2 shows the outfit to wear: {T['outfit']}.
DRESS the body in every cell of IMAGE 1 in EXACTLY that outfit (same clothes, colors, details, socks and boots), fitted to IMAGE 1's body as it is, the same in every cell: the clothes completely cover the gray tank top and shorts; the cape stays short and close to the back (never over the head or the face); skin stays only where the outfit shows skin. Do NOT touch the head, the neck, the fists, the skin, the magenta or anything that is not clothing: every other pixel stays exactly as in IMAGE 1.''')
for name in ('frente', 'costas'):
    job(f'praca-{name}', [f'{B6}/praca-{name}/praca-{name}.png', out('mestre')], [1920, 1400], 'magenta', f'''Use case: precise image EDIT. IMAGE 1 is the edit target: a walk sprite sheet of the game's neutral BASE BODY (bald head, plain gray tank top and shorts, bare limbs) in 7 cells on magenta, {'front 3/4 view' if name == 'frente' else 'seen from behind'}. IMAGE 2 shows the outfit to wear: {T['outfit']}.
DRESS the body in every cell of IMAGE 1 in EXACTLY that outfit ({'the back of the outfit, the cape hanging on the back' if name == 'costas' else 'the front of the outfit'}), fitted to each cell's body and pose as it is, the same in every cell: the clothes completely cover the gray tank top and shorts; skin stays only where the outfit shows skin. Do NOT touch the head, the neck, the hands, the skin, the magenta or anything that is not clothing: every other pixel stays exactly as in IMAGE 1.''')
open(f'{D}/order.txt', 'w').write('\n'.join(['pose', 'mestre', 'careca', 'cabeloB', 'veste', 'costas', 'costasB'] + [f'combate{b}' for b in range(1, 6)] + ['praca-frente', 'praca-costas']) + '\n')
print('ok', D)
