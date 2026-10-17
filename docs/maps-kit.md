# Mapas montados com peças pintadas

Primeiro mapa feito assim: `snow` / Sonho Nevado (17/10/2026). Plano completo em `/mnt/project-files/mapas/plano-cenarios.md`.

## Como funciona

- **Largura**: um mapa pode ter mais de uma tela (`dimensions.width`, `width` no layout; o Sonho Nevado tem 3072 px, duas telas). A altura é sempre 864. A câmera rola, o minimapa fica largo e baixo, e a física lê a largura do próprio terreno. Spawns de 1x1 ficam entre 900 e 1200 px de distância (teste).
- **Fundo**: uma imagem grande e fixa (`art.background`), que não colide. Substitui o céu, a paisagem e o meio procedurais e quase não se move com a câmera.
- **Meio** (opcional, `art.mid`, `mid` no layout): faixa pintada sobre magenta, repetida e espelhada pela largura do mundo a meia velocidade da câmera.
- **Terreno**: uma ou mais folhas de peças (`sheets` no layout; cada item diz `sheet` e `piece`). Objetos (boneco de neve, barril, poste) são peças também: sólidos e destrutíveis, porque só aparece o que tem colisão. Folha pintadas pelo Codex sobre magenta `#FF00FF`. `npm run build:map -- --map=<id>` recorta as peças, numera (linha de cima, depois de baixo, da esquerda para a direita), coloca cada uma segundo `scripts/map-layouts/<id>.json` (`mirror` cria o lado do outro time espelhado) e grava:
  - `public/assets/maps/<id>/terrain-world.png` e `background.webp`, mais `public/assets/maps/<id>-preview.png`;
  - `shared/generated/<id>Terrain.ts`: a colisão tirada do alfa de cada peça (forma `cells`, células de 3 px). O que está pintado é chão.
  - relatório em `test-results/maps-kit/<id>/`: `sheet.png` (peças numeradas; borda vermelha = peça cortada), `montage.png`, `collision.png` (verde quebra, cinza não quebra, amarelo = spawns, vermelho = linha da morte).
- Cada item do layout diz se a peça quebra (`destructible`). Não há distinção de material para o jogador.
- Cair abaixo da base do mapa continua matando (servidor, `WORLD.height`).
- Crateras têm borda irregular (`CRATER_ROUGHNESS`, mesma no servidor e no cliente) e um acabamento genérico para todas as armas: sombra fria curta dentro do corte e um filete claro na borda.

## Gerar um mapa novo

1. Escrever os prompts do fundo e da folha de peças (modelo: `/mnt/project-files/mapas/neve/prompts/`). Sem texto na imagem; fundo claro e de baixo contraste; peças mais escuras e com contorno.
2. Gerar pelo Codex no PC (`codex exec` com a referência anexada) em `test-results/codex-maps/<id>/`.
3. Escrever `scripts/map-layouts/<id>.json`, rodar `npm run build:map -- --map=<id>` e olhar o relatório.
4. Adicionar o mapa em `shared/maps.ts` (`MAP_IDS` e `MAP_DEFINITIONS`) usando as regiões geradas. `tests/maps.test.ts` confere spawns espelhados, apoiados e com espaço.
