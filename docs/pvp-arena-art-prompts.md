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
