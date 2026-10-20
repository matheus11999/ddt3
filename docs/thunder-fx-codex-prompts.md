# Bobina do Trovão: efeitos pintados pelo Codex (20/10)

O matheus rejeitou duas versões do projétil e da explosão do Trovão:
- a pintura antiga do atlas, que parecia uma bolinha com um fio solto e repetia o POW +0 no +10;
- a versão desenhada em código (PR #236), que ele chamou de "lixo".

Agora o Codex repinta as duas pranchas do kit. Este branch já desfaz o código do PR #236, então o jogo volta a ler os atlas.

## Saídas (substituem os arquivos atuais)

| Arquivo | Tamanho | Grade |
| --- | --- | --- |
| `public/assets/weapons/thunder-coil/effects.png` | 1448×1086 RGBA | 4 colunas (+0, +10, +12, +15) × 3 linhas (projétil, disparo, explosão), células de 362 |
| `public/assets/weapons/thunder-coil/pow.png` | 1448×724 RGBA | 4 colunas × 2 linhas (projétil POW, explosão POW), células de 362 |

Fundo transparente na entrega final. Se o gerador só pintar sobre cor sólida, pinte sobre magenta `#FF00FF` e recorte (mesmo fluxo de `scripts/cut-pet-sheet.py`), sem franja rosa.

## Referências para anexar (nesta ordem)

1. `public/assets/weapons/thunder-coil/held-0.png`, `held-10.png`, `held-12.png`, `held-15.png`: a arma de cada fase, aprovada. A cor e o material de cada coluna saem daqui.
2. `public/assets/weapons/wind-shuriken/effects.png` e `public/assets/weapons/brick/effects.png`: o padrão de pintura, enquadramento e escala aprovados nos atlas do jogo.
3. `public/assets/weapons/thunder-coil/effects.png` e `pow.png` atuais: só para posição e grade. **Não copiar o desenho**, que foi rejeitado.

## Validação

Antes e depois: `npm run verify:weapons`. Mostrar ao matheus o `test-results/weapons/sheet.png` e uma prévia das duas pranchas.

---

## Prompt 1: `effects.png` (tiro normal)

```
Hand-painted 2D game VFX in the style of DDTank (Chinese/Brazilian browser artillery game, 2010s): thick glossy painted shapes with strong volume, a dark saturated outline colour on the outside, bright saturated body colours, a white-hot core and crisp highlights. Never vector-flat, never thin neon lines, never photoreal, never "AI glow soup". Every effect must read clearly at 40–60 px on screen, over a light blue sky AND over snow.

Weapon: "Bobina do Trovão", a ray pistol with a copper coil and two terminals that fire ELECTRICITY. The attached held-weapon images (phases +0, +10, +12, +15) are approved: each column of this atlas must use the colours and materials of its phase.

Create ONE sprite atlas, exactly 1448×1086, FOUR columns × THREE rows of square 362×362 cells, no gridlines, no text, transparent background. Every sprite stays inside the central 65% of its cell and is centred in it.

Columns, left to right = phases:
1. +0: white and electric blue.
2. +10: bright cyan with small golden sparks.
3. +12: deep royal blue with orange spark specks.
4. +15: ice blue AND ruby red twisted together, white core.
Each column must look clearly more powerful than the previous one (bigger, more branches, richer colours), not the same drawing recoloured.

ROW 1, PROJECTILE (the most important row): a compact BALL OF LIGHTNING flying to the RIGHT. A solid, glossy, round energy core (about 40% of the sprite) with a white-hot centre, a dark coloured rim so it reads on a light sky, and 4–7 short jagged lightning arcs crackling out from its surface. Behind it, to the LEFT, a short tapering comet trail of the same energy with a few tiny zig-zag sparks. One single object: no loose wires, no separate floating pieces, no stray line sticking out of it. It must never look like a small blob with a thread attached.

ROW 2, MUZZLE: the launch flash, from the left toward the RIGHT, no weapon body: a short fan of jagged electric sparks with a bright white burst at the left, in the phase colours.

ROW 3, IMPACT: a radial ELECTRIC EXPLOSION seen from the side, no ground: a bright white-hot round flash in the centre, a ring of energy in the phase colours, and 6–10 thick jagged lightning bolts bursting outward that taper to sharp points, with small sparks flying. Bolts are chunky painted shapes with a dark outline and a light core, never thin hairlines or spider legs.

Save as public/assets/weapons/thunder-coil/effects.png
```

## Prompt 2: `pow.png` (POW)

```
Hand-painted 2D game VFX in the style of DDTank (Chinese/Brazilian browser artillery game, 2010s): thick glossy painted shapes with strong volume, a dark saturated outline colour on the outside, bright saturated body colours, a white-hot core and crisp highlights. Never vector-flat, never thin neon lines, never photoreal. Readable at 50–70 px over a light blue sky AND over snow.

Weapon: "Bobina do Trovão", an electric ray pistol. Its POW (special super shot) fires THREE lightning bolts in a fan; each bolt is drawn from this atlas. The attached effects.png is the NORMAL shot of each phase: the POW must be a clearly DIFFERENT and BIGGER object in every column, never the normal ball with more glow.

Create ONE sprite atlas, exactly 1448×724, FOUR columns × TWO rows of square 362×362 cells, no gridlines, no text, transparent background. Every sprite stays inside the central 70% of its cell.

Columns, left to right = phases. Each one has its OWN main colour, so no two columns look alike:
1. +0: pink-violet with a white core.
2. +10: GOLD and orange with small cyan sparks (must look nothing like column 1).
3. +12: deep indigo-violet with electric blue.
4. +15: ice blue and ruby red twisted together, white core, the biggest and richest.

ROW 1, POW PROJECTILE flying to the RIGHT: an elongated LIGHTNING SPEAR. A thick jagged zig-zag lightning bolt, glossy and painted, with a dark outline, a saturated body and a white-hot core, ending at the RIGHT in a bright sharp arrow-like point with a small burst of light. The bolt tapers and fades toward the LEFT. A few short side forks. One single object, no loose pieces around it.

ROW 2, POW IMPACT: a bigger and stronger radial electric explosion than the normal one, no ground: a large white-hot flash, a thick crackling energy ring, and 8–12 heavy jagged lightning bolts bursting outward that taper to sharp points, plus flying sparks, all in the column colours. Chunky painted bolts with a dark outline, never thin hairlines.

Save as public/assets/weapons/thunder-coil/pow.png
```
