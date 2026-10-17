# Mapas montados com peças pintadas

Primeiro mapa feito assim: `snow` / Sonho Nevado (17/10/2026). Plano completo em `/mnt/project-files/mapas/plano-cenarios.md`.

## Como funciona

- **Fundo**: uma imagem grande e fixa (`art.background`), que não colide. Substitui o céu, a paisagem e o meio procedurais e quase não se move com a câmera.
- **Terreno**: folha de peças pintadas pelo Codex sobre magenta `#FF00FF`. `npm run build:map -- --map=<id>` recorta as peças, numera (linha de cima, depois de baixo, da esquerda para a direita), coloca cada uma segundo `scripts/map-layouts/<id>.json` (`mirror` cria o lado do outro time espelhado) e grava:
  - `public/assets/maps/<id>/terrain-world.png` e `background.webp`, mais `public/assets/maps/<id>-preview.png`;
  - `shared/generated/<id>Terrain.ts`: a colisão tirada do alfa de cada peça (forma `cells`, células de 3 px). O que está pintado é chão.
  - relatório em `test-results/maps-kit/<id>/`: `sheet.png` (peças numeradas; borda vermelha = peça cortada), `montage.png`, `collision.png` (verde quebra, cinza não quebra, amarelo = spawns, vermelho = linha da morte).
- Cada item do layout diz se a peça quebra (`destructible`). Não há distinção de material para o jogador.
- Cair abaixo da base do mapa continua matando (servidor, `WORLD.height`).

## Gerar um mapa novo

1. Escrever os prompts do fundo e da folha de peças (modelo: `/mnt/project-files/mapas/neve/prompts/`). Sem texto na imagem; fundo claro e de baixo contraste; peças mais escuras e com contorno.
2. Gerar pelo Codex no PC (`codex exec` com a referência anexada) em `test-results/codex-maps/<id>/`.
3. Escrever `scripts/map-layouts/<id>.json`, rodar `npm run build:map -- --map=<id>` e olhar o relatório.
4. Adicionar o mapa em `shared/maps.ts` (`MAP_IDS` e `MAP_DEFINITIONS`) usando as regiões geradas. `tests/maps.test.ts` confere spawns espelhados, apoiados e com espaço.
