# Praça Celeste — lobby (17/10/2026)

Pedido do usuário: o lobby deve ficar parecido com a foto de referência de lobby clássico de artilharia (céu ensolarado, ilhas flutuantes, praça com portais, NPCs ferreiro e guarda-volumes, ícones de evento no topo). Primeira versão desenhada por código foi recusada: "ficou simples, com cara de jogo infantil". **A versão final precisa ser uma pintura detalhada**, no nível de acabamento de jogo comercial; o desenho por código fica só como reserva enquanto a pintura não existe.

## Estado atual (17/10/2026, 02h)

O Codex gerou uma pintura aprovada pelo usuário (nível certo), mas com NPCs e portais pintados no cenário. Decisão do usuário: **cenário vazio + cada interação como sprite separado**, para poder adicionar NPCs no futuro. O código já suporta isso:

- `public/assets/lobby/plaza.webp`: cenário vazio, sem portais nem NPCs.
- Sprites PNG transparentes em `public/assets/lobby/`, registrados em `LOBBY_STATIONS` (`src/game/lobbyWorld.ts`): `npc-loja.png` (Ateliê → loja), `portal-treino.png` (Treino → arena), `portal-arena.png` (Arena PvP), `npc-armazem.png` (Guarda-volumes → mochila), `npc-ferreiro.png` (Ferreiro → forja). Cada entrada tem posição dos pés, altura na tela, placa, brilho ao passar o mouse e área de clique.
- **Novo NPC no futuro** = um PNG transparente + uma linha em `LOBBY_STATIONS` (e a ação em `LobbyAction`/`App.tsx`). Deixar espaço livre na praça para isso.

### NPCs e portais animados (pedido do usuário: nada de PNG estático)

Cada estação é uma pasta `public/assets/lobby/<pasta>/` com **camadas recortadas**, todas exportadas no MESMO canvas transparente (pés no centro da borda inferior), como camadas de um PSD. O código anima cada camada em volta de um pivô, no estilo recorte (cut-out) dos NPCs do DDTank:

| Pasta | Camadas (ordem de desenho) | Animação |
| --- | --- | --- |
| `npc-ferreiro` | barraca, fogo, corpo, cabeca, braco (braço + martelo), olhos (pálpebras fechadas) | respira, martelada com faíscas na bigorna, cabeça acompanha, pisca, fogo tremula |
| `npc-armazem` | burro, rabo, orelhas, corpo, braco, cabeca, olhos | burro respira e abana rabo/orelhas, NPC acena e pisca |
| `npc-loja` | barraca, toldo, corpo, braco, cabeca, olhos | toldo balança, costureira acena e pisca |
| `portal-arena` | base, calice, asas | cálice flutua, asas balançam, luz e faíscas por código |
| `portal-treino` | base, calice | cálice flutua, luz por código |

Pivôs ficam em `LOBBY_STATIONS` (frações do canvas) e são medidos quando as camadas chegarem. Camada que falta é ignorada.

### Resolução

O jogo usa o quadro 1536×864 e desenha o canvas em até 2× (3072×1728) em telas de alta densidade. Para ficar nítido:

- Cenário: **3072×1728** (ou o maior 16:9 que o gerador aceitar e depois ampliar 2× com um upscaler de IA). Qualquer tamanho 16:9 funciona; o jogo ajusta.
- Sprites: gerar com o **dobro** do tamanho em tela, por exemplo portal da arena ~600×700, NPCs ~700×600. Salvar WebP/PNG qualidade alta.

## Como a pintura entra no jogo

Salvar uma única imagem 16:9 em `public/assets/lobby/plaza.webp` (1536×864 ou 1672×941). Quando o arquivo existe, `src/game/lobbyWorld.ts`:

- desenha a pintura no fundo e esconde todo o cenário por código, inclusive os NPCs-boneco;
- mantém por cima apenas: brilho pulsante e faíscas nos portais, placas Ateliê/Arena/Treino, nomes Guarda-volumes/Ferreiro, partículas e os pontos clicáveis;
- os jogadores andam na faixa da praça (y 560–750 no quadro 1536×864).

Depois de salvar a imagem, **medir na pintura** o centro da base de cada portal e os pés dos NPCs e atualizar `LOBBY_PORTALS` e `LOBBY_NPCS` em `lobbyWorld.ts` (e `SMITH_POSITION` em `shared/catalog.ts`, logo à esquerda do ferreiro). A pintura deve seguir o layout abaixo para que as mudanças sejam pequenas.

## Layout obrigatório (percentuais do quadro)

| Elemento | Posição |
| --- | --- |
| Horizonte / mar | faixa de 44% a 54% da altura |
| Balaustrada de pedra | topo em ~54%, base em ~61% |
| Portal rosa (Ateliê) | centro x 28%, base y 63% |
| Portal azul, maior (Arena) | centro x 45%, base y 63% |
| Portal dourado (Treino) | centro x 62%, base y 63% |
| Guarda-volumes com burrinho | pés em x 72%, y 68% |
| Ferreiro com bigorna | pés em x 86%, y 69% |
| Praça livre para caminhar | de 64% até a borda inferior, sem objetos no meio |
| Topo direito (0–22% da altura, 75–100% da largura) | só céu ou nuvens: ali ficam os ícones do jogo |
| Canto superior esquerdo (0–20%, 0–22%) | só céu: ali fica o retrato do jogador |

## Prompt principal (colar no ChatGPT junto com a foto de referência)

Anexar a foto `referencia-lobby.png` e escrever:

```
Use a imagem anexada APENAS como referência de estilo, enquadramento e nível de acabamento. Não copie logotipos, textos, personagens nem objetos idênticos: tudo deve ser um desenho original.

Crie o cenário de lobby de um jogo online de artilharia por turnos para navegador, no mesmo estilo da referência: ilustração 2D pintada à mão, acabamento de jogo comercial asiático (estilo DDTank / Gunny), muito detalhada, materiais bem definidos (mármore, ouro polido, pedra, madeira, metal, cristal), luz de sol forte e quente vinda da direita, sombras suaves, contornos finos e limpos, cores vivas e saturadas. NÃO pode parecer jogo infantil, vetor plano, clip-art nem desenho simples: profundidade, perspectiva e textura como na referência.

Formato 16:9, 1672×941, visão frontal levemente de cima, câmera parada.

Composição:
- Céu azul intenso com nuvens volumosas e realistas; ao fundo, mar turquesa brilhante no horizonte (44% a 54% da altura).
- À esquerda, no alto, uma grande ilha flutuante de rocha com grama, árvores e um pequeno santuário, com uma cascata caindo dela e um arco-íris suave; ilhotas flutuantes menores ao redor.
- Ao fundo no centro, ruínas de colunas brancas sobre ilhotas no mar.
- À direita, um templo/palácio de mármore branco com detalhes dourados, escadaria larga, torre com cúpula, estandartes coloridos, e um dirigível de madeira com balão listrado ancorado no céu acima dele; balões coloridos e uma faixa festiva rosa SEM texto.
- Plano médio: sebe verde, balaustrada de pedra clara com pilares e vasos de flores, canteiro florido, postes de ferro ornamentados com lanternas.
- Sobre a borda de trás da praça, três portais mágicos lado a lado (centros em 28%, 45% e 62% da largura, bases em 63% da altura): cada um é uma plataforma redonda de mármore com runas brilhantes e um cálice/coroa flutuante de metal ornamentado com um cristal apontando para baixo, ligado à plataforma por um feixe de luz. Esquerdo rosa-magenta, central azul-ciano (maior, com asas de prata), direito dourado-âmbar.
- À direita da praça: um NPC guarda-volumes simpático ao lado de um burrinho de carga carregando baús e caixotes (pés em 72% da largura, 68% da altura); e um ferreiro forte e barbudo, avental de couro, martelo grande, ao lado de uma bigorna e um braseiro aceso (pés em 86% da largura, 69% da altura). Proporção chibi de cabeça grande como na referência.
- Primeiro plano: praça ampla de lajotas de pedra clara em perspectiva, com um mosaico circular dourado parcialmente visível no canto inferior direito. A parte inferior central da praça fica livre (é onde os jogadores andam).
- Deixe o canto superior esquerdo e o canto superior direito só com céu, sem objetos importantes (serão cobertos pela interface).

Sem nenhum texto, número, letra, logotipo, ícone de interface ou jogador no chão.
```

Se o resultado vier com cara simples ou infantil, pedir na mesma conversa: *"Mais detalhado e com mais textura, iluminação e profundidade, igual ao acabamento da referência; menos traço grosso e menos cores chapadas."*

## Depois de gerar

1. Salvar como WebP (qualidade ~88) em `public/assets/lobby/plaza.webp`.
2. Medir portais e NPCs e ajustar `LOBBY_PORTALS`, `LOBBY_NPCS` e `SMITH_POSITION`.
3. Rodar `node scripts/shot-lobby.mjs <pasta>` com Vite e servidor ligados: salva `lobby.png`, abre as missões e confere que o portal da Arena abre a arena e o Ferreiro abre a forja.

## Medalhas do topo (opcional, depois)

Ícones redondos 256×256, fundo transparente, aro dourado grosso e figura 3D brilhante no centro, no estilo das medalhas de evento da referência: Arena (espadas cruzadas, azul), Ateliê (cabide com vestido, rosa), Missões (pergaminho, dourado), Ferreiro (martelo e bigorna, laranja). Hoje são feitas em CSS em `Hud.css`.
