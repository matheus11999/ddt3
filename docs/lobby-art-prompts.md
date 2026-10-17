# Praça Celeste — lobby (17/10/2026)

Pedidos do usuário, em ordem: lobby parecido com a foto de referência de lobby clássico de artilharia; a primeira versão por código ficou "simples, de jogo infantil"; a pintura gerada pelo Codex ficou no nível certo, mas com NPCs pintados. Decisões finais:

- **Cenário vazio** em panorama e cada ponto de interação como camada separada, para poder adicionar NPCs no futuro.
- **NPCs animados**, não PNG parado: cada NPC é recortado em partes que o código anima.
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
- Animação por camadas: as partes de um NPC são exportadas no MESMO canvas transparente (pés no centro da borda inferior). O código move cada parte em volta de um pivô: respirar, cabeça, martelada com faíscas, aceno, rabo/orelhas/toldo, flutuar, piscar, fogo. Pivôs são ajustados quando a arte chega. Sem arte, o jogo usa um desenho provisório por código.
- Novo NPC = uma pasta de camadas + uma linha em `LOBBY_STATIONS` (+ a ação em `App.tsx`).
- Verificação: `node scripts/shot-lobby.mjs <pasta>` com Vite e servidor ligados (prévia, câmera andando com as setas, porta da Arena, caminhada até o Ferreiro).

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
