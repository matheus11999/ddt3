# Salão PvP e sala — prompts de arte

Salão PvP (`src/components/ArenaHall.tsx`, `ArenaHall.css`) e sala de espera (`src/components/Arena.tsx`, `Arena.css`) redesenhados em 17/10/2026 no mesmo padrão da mochila: moldura de madeira laranja, barra de título escura com título dourado em Cinzel, painéis creme, faixa laranja, botões amarelo-laranja e o selo da aura atrás de cada personagem. Os materiais estão em `src/components/WoodTheme.css`, que outras telas podem reutilizar.

Tudo funciona só com CSS e com as artes que já existem (`pvp-room-banner-v2.webp`, `aura-blue-sigil.png`, ícones dos menus). As peças abaixo são opcionais e substituem os ícones de linha que ainda restam. Arte original no estilo do DDTank: nada copiado, sem logotipos, sem texto pintado.

Regras comuns:

- PNG com fundo transparente, cores vivas e saturadas, contornos marrons limpos, luz suave de cima à esquerda, acabamento de jogo casual de navegador dos anos 2010.
- Sem texto, números ou letras na imagem. Os textos ficam no HTML.
- Nada de pastel lavado ou névoa leitosa (ver `AGENTS.md`).
- A textura de madeira é a mesma da mochila: usar o prompt 1 de `docs/backpack-art-prompts.md` e trocar `--wood-grain` em `WoodTheme.css`.

## 1. Brasão do Salão PvP

Arquivo: `public/assets/ui/pvp-hall-crest.png`, 256×256, transparente. Substitui o círculo laranja com espadas de linha (`.hall-crest`).

```text
Game UI emblem, 256x256, transparent background, round orange-gold medallion with a thick caramel wooden rim, two crossed chibi cartoon swords over a small flame, glossy painted metal with bright highlights, warm orange and gold palette with a little red, thick clean brown outline, casual Asian browser artillery game style, centered, no text, no letters, no background.
```

## 2. Selos das vagas vazias (atlas 2×1)

Arquivo: `public/assets/ui/pvp-seat-emblems.png`, 512×256 (células de 256×256), transparente. Substitui os ícones de pessoa com "+" (vaga aberta) e cadeado (vaga fechada) em `.party-vacant-emblem`.

```text
Sprite sheet, 2 cells of 256x256 side by side, transparent background, round cream-and-orange game UI seal icons for empty team seats in a chibi artillery game lobby. Left cell: a friendly chibi silhouette with a small glowing plus sign, warm orange and cream, inviting. Right cell: a chunky golden padlock on a muted beige seal, closed. Same size, rim and line weight in both cells, soft painted shading, thick clean brown outline, no text, no background.
```

## 3. Ilustração de salão vazio

Arquivo: `public/assets/ui/pvp-hall-empty.png`, 512×320, transparente. Mostrada quando não há salas (`.hall-empty`), no lugar do ícone de espadas.

```text
Small game illustration, 512x320, transparent background, two cute chibi adventurers (one boy with a green newsboy cap, one girl with purple ponytail and goggles) sitting on a wooden bench waiting, holding cartoon artillery weapons, a little wooden signpost with crossed swords beside them, warm afternoon light, vivid saturated colors, thick clean brown outlines, casual Asian browser artillery game style, no text on the sign, no background scenery.
```

Integração: depois de gerar, colocar os arquivos em `public/assets/ui/` e trocar o ícone correspondente por `<img>` no componente. Conferir em `node scripts/preview-arena.mjs` (desktop e celular em paisagem).

## 4. Escudo VIP (atlas 2×1) — prioridade

Arquivo: `public/assets/ui/vip-badges.webp`, 1024×512 (duas células de 512×512), transparente. Substitui o escudo em SVG de `src/components/VipBadge.tsx`. A arte **não leva texto**: o número do nível e a palavra "VIP" são escritos pelo jogo por cima, em Nunito com contorno.

```text
Game UI sprite sheet, 1024x512, two cells of 512x512 side by side, transparent background, each cell one centered VIP rank badge for a chibi casual artillery browser game in the style of classic DDTank / Gunny UI. Shape: a heraldic shield with a small three-point crown on top and a wide horizontal ribbon banner across the lower third. The centre of the shield is a smooth empty plate (for a big number painted later) and the ribbon is an empty smooth band (for the word VIP painted later). LEFT cell, ACTIVE: polished gold metal with warm orange shading, deep red enamel centre plate, glossy highlights, small red gem in the crown, tiny sparkles, dark brown clean outline, rich and premium. RIGHT cell, INACTIVE: identical shape and size but dull grey stone/pewter, desaturated, no sparkles, no gem glow, same outline. Thick clean outlines, saturated painted shading, front view, no text, no letters, no numbers, no background, no drop shadow outside the badge.
```

Integração: `VipBadge` mostra a célula esquerda (ativo) ou direita (inativo) como fundo e mantém o número e "VIP" em texto por cima.

## 5. Selo de nível (atlas 3×2)

Arquivo: `public/assets/ui/level-plates.webp`, 1536×1024 (seis células de 512×512), transparente. Uma célula por faixa de nível do `LevelBadge` (1–10, 11–20, 21–30, 31–40, 41–50, 51–70), na ordem da esquerda para a direita, de cima para baixo. Mesmo acabamento do escudo VIP. A arte **não leva texto**: o jogo escreve o número no centro.

```text
Game UI sprite sheet, 1536x1024, a 3x2 grid of six 512x512 cells, transparent background, each cell one centered player LEVEL badge for a chibi casual artillery browser game in the style of classic DDTank / Gunny UI, matching a painted gold-and-red VIP heraldic shield from the same game. Shape for every cell: a round medallion with a wide smooth empty centre plate (for a big level number painted later by the game), a thick bevelled metal rim, small wings or leaves on the left and right sides, and one small gem at the bottom. All six cells share the exact same size, silhouette and centre plate position, only materials and ornaments grow richer. Cell 1 (top-left, levels 1-10): plain iron grey metal, dark slate plate, no gem glow. Cell 2 (top-middle, 11-20): emerald green metal, deep green plate, small green gem. Cell 3 (top-right, 21-30): sapphire blue metal, navy plate, blue gem, small crystal spikes on the wings. Cell 4 (bottom-left, 31-40): polished bronze with warm copper shading, dark brown plate, amber gem. Cell 5 (bottom-middle, 41-50): bright silver with cool white highlights, dark steel-blue plate, small three-point silver crown on top, diamond gem. Cell 6 (bottom-right, 51-70): polished gold with orange shading, deep red enamel plate, gold crown with a red gem on top, larger feathered wings, tiny sparkles. The centre plate must be flat and evenly lit with high contrast against a white number. Thick clean dark outlines, saturated painted shading, glossy highlights, front view, no text, no letters, no numbers, no background, no drop shadow outside the badge.
```

Integração: o selo de nível do card da sala mostra a célula da faixa como fundo e escreve o número em Nunito branco com contorno, igual ao VIP.
