# Mapas montados com peças pintadas

Primeiro mapa feito assim: `snow` / Sonho Nevado (17/10/2026). Plano completo em `/mnt/project-files/mapas/plano-cenarios.md`.

## Como funciona

- **Largura**: um mapa pode ter mais de uma tela (`dimensions.width`, `width` no layout; o Sonho Nevado tem 3072 px, duas telas). A altura é sempre 864. A câmera rola, o minimapa fica largo e baixo, e a física lê a largura do próprio terreno. Spawns de 1x1 ficam entre 900 e 1200 px de distância (teste).
- **Fundo**: uma imagem única (`art.background`), que não colide e **nunca se repete**. Em mapa largo ela é um panorama pintado em duas metades (`background: ["esquerda.png","direita.png"]` no layout), unidas com degradê (`backgroundBlend`, padrão 240 px). No jogo ela rola na velocidade que mostra o panorama inteiro uma vez de ponta a ponta; uma imagem estreita só desliza um pouco.
- **Meio** (opcional, `art.mid`, `mid` no layout): camada pintada sobre magenta, também desenhada uma única vez. Prefira pôr o meio dentro do panorama.
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

## Regras do layout

- Objetos (`objetos`) usam `"rest": true`: o script os derruba sobre o chão já colocado abaixo de `top` e afunda `sink` px (padrão 8) na neve. Nada flutua por erro.
- `mirrorAs` troca a peça do lado espelhado (ex.: boneco de neve de um lado, placa do outro), para os dois lados não ficarem iguais.
- A ordem importa: peças de terreno primeiro, objetos depois.

## Análise antes de mostrar ao usuário

O `build:map` imprime AVISO para cada problema; corrija todos antes de mostrar:
- objeto flutuando (base sem chão embaixo);
- peça escondida embaixo de outra, com ar entre elas (ex.: um portão debaixo da plataforma do meio): sem motivo, não entra;
- emenda do panorama com diferença média de cor acima de 28: gerar a metade de novo;
- fundo estreito para a largura do mapa (vai cortar o céu no mapa inteiro);
- peça cortada pela borda da folha.

Depois olhe `montage.png` (o mapa inteiro, que é a imagem para mostrar ao usuário) com estas perguntas: cada coisa tem motivo para estar ali (portão leva a algum lugar, ponte liga duas margens, poste fica em cima de chão)? Algo se repete à vista? As pontes e torres têm base ou são claramente ilhas no céu? Os dois lados estão justos sem serem cópia um do outro?

## Lições dos prompts

- Fundo em duas metades: cada metade deixa 20% do lado da emenda só com céu, nuvem e névoa; a segunda recebe a primeira como referência e é proibida de repetir ou espelhar elementos.
- Montes de neve sobre pontes parecem nuvens: não usar. Peças sem função (portões, muros soltos) não entram no layout.
