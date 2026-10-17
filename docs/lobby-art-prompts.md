# Praça Celeste — lobby (17/10/2026)

Pedidos do usuário, em ordem: lobby parecido com a foto de referência de lobby clássico de artilharia; a primeira versão por código ficou "simples, de jogo infantil"; a pintura gerada pelo Codex ficou no nível certo, mas com NPCs pintados. Decisões finais:

- **Cenário vazio** em panorama e cada ponto de interação como camada separada, para poder adicionar NPCs no futuro.
- **NPCs inteiros** (mudança de 17/10, 03h30): braços animados ficaram com cara de quebrados, então cada NPC e cada animal é uma peça só que apenas respira. A forja ficou sem fogo animado.
- Os três "portais" da referência são o **pódio do ranking PvP do dia (1º, 2º, 3º)**, com espaço para o boneco do jogador ficar em cima.
- A praça tem **três telas de largura** e a câmera segue o jogador para os lados (clique ou setas/A-D), para caber mais NPCs.

## Como está no código

- `shared/lobby.ts`: largura 4608 (três telas de 1536), área de caminhada x 120–4488 / y 560–750, nascimento no pódio (2304, 670). Servidor e protocolo usam esses limites.
- `src/game/lobbyWorld.ts`, `LOBBY_STATIONS` (coordenadas do mundo):

| Estação | x | Ação | Pasta de camadas |
| --- | --- | --- | --- |
| Ateliê (loja) | 560 | abre a loja | `npc-loja/` |
| Guarda-volumes | 1220 | abre a mochila | `npc-armazem/` |
| Pódio 2º | 2040 | vitrine | `podio-2/` |
| Pódio 1º | 2304 | vitrine | `podio-1/` |
| Pódio 3º | 2568 | vitrine | `podio-3/` |
| Arena PvP | 2980 | abre a arena | `portal-arena/` |
| Ferreiro | 3720 | anda até ele e abre a forja (`SMITH_POSITION` 3640, 640) | `npc-ferreiro/` |
| livre | 120–380 e 3950–4480 | NPCs futuros | — |

- `LobbyWorld.podiums()` devolve onde ficam os pés do 1º, 2º e 3º colocados. Falta o servidor ter o ranking PvP do dia para desenhar os bonecos ali.
- Camadas: barraca (parada) e NPC inteiro (respira) no MESMO canvas transparente, pés no centro da borda inferior. Portal e pódios ainda têm brilho, asas e emblema flutuando. Sem arte, o jogo usa um desenho provisório por código.
- Sombras: cada estação projeta o próprio contorno no chão (achatado e inclinado para a esquerda, luz vinda da direita) e tem sombra de contato onde toca o piso (`shadows` em `LOBBY_STATIONS`).
- Piso: se existir `public/assets/lobby/floor.webp`, o código cobre o piso pintado com essa textura em perspectiva a partir de y 548 (`FLOOR_TOP`). Sem o arquivo, fica o piso do panorama. O piso atual é o segundo do Codex (pedras irregulares cinza e bege, 17/10); o primeiro, de lajes retangulares, parecia parede de tijolo.
- Novo NPC = uma pasta de camadas + uma linha em `LOBBY_STATIONS` (+ a ação em `App.tsx`).
- Verificação: `node scripts/shot-lobby.mjs <pasta>` com Vite e servidor ligados (prévia, câmera andando com as setas, porta da Arena, caminhada até o Ferreiro).

## Arte integrada (17/10, 03h)

Codex entregou o panorama 9216×1728 e 28 camadas (montagens de referência ficaram só na pasta local, fora do Git). Pivôs e pontos de faísca medidos nas camadas e gravados em `LOBBY_STATIONS`; o martelo do ferreiro gira no cotovelo e bate na bigorna. Prancha de animação conferida quadro a quadro.

## Resolução

Tela do jogo 1536×864, desenhada em até 2× (3072×1728). Panorama ideal **9216×1728** (três telas em 2×). Geradores não chegam nisso direto: gerar a parte central em 16:9, estender para os lados (outpaint) e ampliar 2× com upscaler. NPCs com canvas 1400×1200; pódios e portal 1200×1400.

## Prompt para o Codex

```
Vamos refazer o lobby em camadas. Não altere código e não faça commit; só gere e salve imagens em public/assets/lobby/. Use a pintura do lobby que você gerou antes como referência de estilo (mesma luz, cores, acabamento).

1) PANORAMA VAZIO — public/assets/lobby/plaza.webp
Cenário largo com 3 telas de largura (proporção 16:3, ideal 9216x1728). Gere a parte central em 16:9 e depois estenda para a esquerda e para a direita, contínuo e sem emenda visível; amplie 2x com upscaler se precisar.
Mesmo mundo da pintura anterior: céu azul, nuvens, mar turquesa no horizonte, ilhas flutuantes com cascatas, templo branco e dourado, dirigível, balões e faixa festiva sem texto, balaustrada de pedra com vasos e postes de lanterna, piso de lajotas claras em perspectiva.
A praça fica VAZIA: sem NPCs, sem animais, sem barracas, sem bigorna, sem pódios, sem portais, sem pessoas, sem texto. A faixa de baixo (de 64% da altura até o fim) é chão livre em toda a largura, pois os jogadores andam ali. Varie o fundo ao longo da largura (mais ilhas à esquerda, ruínas no mar no centro, templo e cidade à direita) para não repetir.

2) CAMADAS PARA ANIMAÇÃO — mesmo estilo, luz vinda da direita, chibi de cabeça grande. Para cada item, desenhe a figura inteira e exporte cada parte como PNG transparente separado, TODOS NO MESMO CANVAS e na mesma posição (como camadas de um PSD), pés no centro da borda de baixo, sem texto. Nas partes que ficam por baixo de outras, complete o desenho escondido para não abrir buraco quando a peça se mexer. Canvas 1400x1200 para NPCs; 1200x1400 para pódios e portal.

npc-loja/: barraca.png (ateliê de moda com araras de roupas, chapéus e óculos, sem o toldo), toldo.png (toldo rosa e dourado), corpo.png (costureira sem cabeça e sem o braço que acena), braco.png, cabeca.png, olhos.png (só as pálpebras fechadas, encaixadas nos olhos da cabeça).
npc-armazem/: burro.png (burrinho com baús, sem rabo e sem orelhas), rabo.png, orelhas.png, corpo.png (guarda-volumes sem cabeça e sem o braço que acena), braco.png, cabeca.png, olhos.png.
npc-ferreiro/: barraca.png (barraca de madeira, bigorna e braseiro SEM fogo), fogo.png (só as chamas), corpo.png (ferreiro forte e barbudo, avental de couro, sem cabeça e sem o braço direito), cabeca.png, braco.png (braço direito com martelo grande, levemente erguido), olhos.png.
portal-arena/: base.png (grande portal/arco da Arena PvP sobre plataforma de mármore com runas azuis), calice.png (emblema de cristal azul flutuando no centro do arco), asas.png (par de asas de prata do emblema).
podio-1/, podio-2/, podio-3/: pódio do ranking PvP do dia. 1º o mais alto, ouro com coroa e louros; 2º médio, prata com safira; 3º mais baixo, bronze com rubi. Cada pódio é um pedestal ornamentado com o TOPO PLANO E VAZIO, onde um personagem vai ficar de pé (deixe espaço livre acima do topo). base.png = o pódio; brilho.png = só o brilho mágico em volta do topo. Sem números, sem texto, sem personagem.
```

## Prompt do piso para o Codex

O piso do panorama saiu borrado (foi ampliado). Em vez de repintar o panorama, o jogo desenha uma textura de piso repetida, sem ampliação.

```
Gere só uma imagem e salve em public/assets/lobby/floor.webp. Não altere código e não faça commit.
Textura de piso de praça, vista DE CIMA (top-down, sem perspectiva), 1024x1024, SEM EMENDA nas quatro bordas (tileable: a borda esquerda continua na direita e a de cima na de baixo).
Lajotas de pedra clara (creme e bege quente, alguns tons de areia e marfim) em padrão de lajes retangulares desencontradas, 4 fileiras por 4 colunas, rejunte fino dourado-acinzentado, leve musgo verde em poucos rejuntes, pequenas lascas e textura de pedra polida, acabamento pintado à mão no mesmo estilo de anime vibrante do panorama.
Iluminação uniforme e plana: sem sombra projetada, sem vinheta, sem brilho forte de um lado, para a repetição não aparecer. Sem objetos, sem texto, sem personagens. Nitidez alta (não ampliar de imagem menor).
```

## Menu inferior e cursor (17/10, tarde)

O menu de medalhas do topo foi removido. A barra de baixo segue a sala PvP: madeira laranja, ladrilhos creme e os ícones pintados da sala (`backpack-button.png`, `arena-quests.png`, `arena-mail.png`, `arena-guild.png`). Arena, Loja, Ferreiro, Como jogar e Ajustes usam `arena-button.png`, `shop-button.png`, `forge-button.png`, `help-button.png` e `settings-button.png`, gerados pelo Codex com os prompts abaixo (17/10, 15h). O cursor `public/assets/ui/cursor.png` é o original de 128 px reduzido para 32 px, ponta em 2,2 (`--cursor-arrow` em `src/styles.css`).

### Prompt dos ícones que faltam (ChatGPT)

Mande junto a imagem `public/assets/ui/backpack-button.png` como referência de estilo.

```
Gere 5 ícones de menu de jogo, um por imagem, cada um PNG 256x256 com FUNDO TRANSPARENTE, no MESMO estilo da imagem de referência (mochila pintada): objeto único pintado à mão, estilo de jogo de navegador DDTank, contorno escuro marrom firme, volume forte, luz vinda de cima à esquerda, cores vivas (couro marrom, azul royal, dourado polido, detalhes vermelhos), vista levemente de 3/4, objeto ocupando ~85% do quadro e centralizado, sem sombra no chão, SEM TEXTO, sem letras, sem números, sem moldura, sem fundo.

1. arena-button.png — duas espadas cruzadas de lâmina prateada com punhos dourados e uma gema azul no cruzamento, atrás um pequeno escudo redondo azul e dourado.
2. shop-button.png — sacola de compras de tecido rosa e creme com alças de couro e um laço dourado, um chapéu pequeno saindo de dentro.
3. forge-button.png — martelo de ferreiro grande com cabo de madeira e anéis dourados apoiado sobre uma bigorna de ferro escuro com borda dourada, sem fogo.
4. help-button.png — livro grosso de capa azul royal com cantoneiras douradas, aberto em leque, com um pergaminho e uma pena saindo das páginas.
5. settings-button.png — engrenagem de bronze/dourado polido com uma gema vermelha no centro e uma chave inglesa pequena de prata cruzada atrás.

Salve como public/assets/ui/<nome>.png. Não altere código.
```

### Prompt do cursor (ChatGPT)

```
Gere um cursor de mouse para jogo de navegador no estilo DDTank, PNG 128x128 com FUNDO TRANSPARENTE. Uma seta de ponteiro clássica (ponta no canto SUPERIOR ESQUERDO, a 6 px das bordas), corpo dourado polido com brilho creme na borda esquerda, contorno marrom-escuro grosso e contínuo para ler bem sobre céu azul e sobre pedra clara, pequena gema vermelha perto da base da seta. Forma simples e limpa que continue legível reduzida para 32x32. Sem fogo, sem chamas, sem faíscas, sem sombra projetada, sem texto, sem fundo.
Salve como public/assets/ui/cursor.png. Não altere código.
```
