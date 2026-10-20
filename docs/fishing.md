# Pescaria (20/10/2026)

Pedido do matheus: uma zona separada da Praça Celeste, mais larga, com lagos, Casa de Pesca e profundidade, onde os jogadores pescam à mão (barra de tempo) ou no automático (AFK enquanto o jogo estiver aberto), trocam Pontos de Pesca por recompensas e sobem o **nível de pescador**. Todos os números abaixo são provisórios: ficam em `shared/fishing.ts`.

## Zona

- `Zone = 'plaza' | 'fishing'` (`shared/fishing.ts`). O jogador entra pelo botão **Pescaria** do menu da praça e sai pelo botão **Sair da Pescaria** (topo) ou pelo dirigível "Praça Celeste" no cais.
- Comando `zone` → o servidor troca `Peer.zone`, põe o jogador em `FISHING_SPAWN` (ou em `LOBBY_SPAWN` na volta) e manda `zone` com os jogadores da nova zona. Cada canal tem uma lista de andarilhos por zona; chat Mundo/Guilda/Privado continua igual.
- Na Pescaria o menu mostra mochila, loja, leilão, missões, correio, guilda, pets etc., **sem** Arena PvP, Expedições e Ferreiro. O servidor recusa `create`, `create-expedition`, `join`, `spectate`, `world-boss-enter` e aceitar convite de sala fora da praça (`PLAZA_ONLY_COMMANDS`).
- Mapa (`shared/fishingMap.ts`, terceira versão em 20/10; pedidos do matheus: "quero algo que tenha caminhos vertical também", "o objetivo é ser tipo um jardim com lagos, ponte etc.. com sombras etc.. para parecer um jogo mesmo"): jardim suspenso em **terraços** de gramado, 4608 × 2620 px (3 telas de largura, 3 de altura), câmera segue o jogador nos dois eixos e W/S ou ↑/↓ andam na vertical.
  - **Mirante** (y 700–1180, o de cima, com a balaustrada sobre o céu): **Lagoa de Cristal** (x 1250) e **Fonte Termal** (x 3300, com vapor), pagode no meio; a fonte cai em cascata pelo muro.
  - **Jardim** (y 1320–2080): **Lago das Ninfeias** (x 1750, o maior) com barco, píer e uma **ilha** com cerejeira ligada à margem por **ponte**; **Poço Azul** (x 3350) sob a cascata; **Lago dos Juncos** (x 4000).
  - **Cais** (y 2220–2440, o de baixo, de pedra, sobre as nuvens): chegada (`FISHING_SPAWN`), a **Casa de Pesca** (x 2300), barraca, quiosque de iscas, deque com guarda-sol, arco e o dirigível de volta à praça.
  - Escadas: três entre Mirante e Jardim (x 280, 2420 e 4090) e duas entre Jardim e Cais (x 1480 e 2700).
- Lugares de pesca (`FISHING_SPOTS`, 33): seis em volta de cada lago, sete no das Ninfeias, mais um na ilha e um na ponta do píer. Clicar na água leva ao lugar livre mais perto e já lança; clicar na ilha, na ponte ou no píer só anda. Um lugar por jogador por canal.
- Caminhada: grade de 8 px (água e pedras da borda, troncos de árvore, casas e o pagode bloqueiam; ilha, ponte e píer são chão), campo de distância por destino (Dial, custo 5 reto / 7 diagonal, cache de 48) e o servidor anda por `fishingStep` até o ponto mais longe em linha reta no caminho; sobe e desce as escadas sozinho. O telhado da Casa de Pesca passa por cima do gramado de trás: clique no gramado anda, não abre a loja.
- **Cenário** (arte do Codex, gpt-6-astra médio, pranchas em `public/assets/fishing/source/`; prompts em `docs/fishing-art-prompts.md`): céu, lagos vistos de cima rebaixados no gramado, píer, ponte, deque, barco, atracadouro, escadas, muros, cascata, arco, Casa de Pesca, barraca, pagode, quiosque, árvores, enfeites, a textura do gramado (`grass.webp`, repete sem emenda) e peças de grama (faixas, manchas, trilha de pedras, tufos, sebe). Balaústres, lampiões, ciprestes e dirigível vêm da praça; o piso do cais é o da praça. `npm run build:fishing` recorta tudo para `public/assets/fishing/props/` e escreve `shared/generated/fishingProps.ts`. Gramado, lagos, ilha, ponte, píer, muros e escadas ficam guardados em blocos de 768 px; água, vapor, cascata e barco se mexem ao vivo; árvores, casas e enfeites têm sombra pintada em código a partir do próprio contorno, inclinada para a esquerda como na praça (`src/game/fishingWorld.ts`). A imagem-alvo do cenário está em `/mnt/project-files/pescaria/codex/9-cena-conceito.png`. Prévia: `npx tsx scripts/shot-fishing.mjs` (jogo rodando).

## Pesca

Servidor autoritativo (`server/game.ts`, `castLine`/`pressBar`/`tickFishing`):

1. `fish-cast {spot}` → esperando (6 a 13 s, vezes a velocidade da vara e da isca; isca brilhante ×0,8; no automático ×1,2).
2. Morde: o servidor sorteia o peixe (lago, sorte da vara, isca e nível) e manda a barra (`fishChallenge`, semente). A barra começa 0,7 s depois ("Fisgou!").
3. **Manual**: uma boia vai e volta numa faixa de água; o jogador aperta Espaço ou clica quando ela está no alvo verde (o miolo dourado vale Perfeito). Peixes difíceis pedem mais acertos, boia mais rápida e alvo menor, e a partir da dificuldade 3 o alvo **nada** de um lado para o outro (`drift`, `zoneAt`); a vara aumenta o verde (`control`). 2 erros ou o tempo acabar = o peixe escapa. O cliente manda o horário do servidor estimado do aperto; o servidor confere com folga de 0,7 s.
4. **Automático** (`fish-auto`): ninguém aperta; chance fixa por peixe (`autoChance`: 82% no mais fácil, −11% por dificuldade, mínimo 20%, máximo 85%) e só 30% da sorte de peixes raros. Depois do resultado ele lança de novo sozinho, sem fim, enquanto a conexão estiver aberta.
5. Resultado (2,6 s): peixe, peso, Pontos de Pesca, EXP, "Novo na coleção!", "Recorde!" e subida de nível.

Andar para longe recolhe a linha; trocar vara/isca pode a qualquer hora, menos no meio da barra (`fish-gear`).

## Varas, iscas e peixes

- **Vara de Bambu** (inicial, dada a todos) e **Vara de Carvalho** (Casa de Pesca, Nv. 5: +18% de verde, marcador 10% mais lento, +12% sorte, +6% no automático).
- **Isca Simples** (infinita) e **Isca Brilhante** (gasta 1 por lançamento, morde mais rápido, +30% sorte).
- 20 peixes (`FISH`), dificuldade 1 a 5, com lagos, peso em kg e pontos: Bota Velha (todos os lagos), Lambari Dourado, Tilápia Rosada, Carpa da Lua, Baiacu Bolha, Koi Celeste, Bagre Barbudo, Tucunaré Brasa, Enguia do Trovão, Pirarucu Ancestral, Peixe-Vidro, Truta Aurora, Dourado Real, Traíra das Taboas, Pacu Esmeralda e Peixe-Junco Dourado (Lago dos Juncos), Carpa Termal, Salamandra do Vapor e Fênix d'Água (Fonte Termal), Carpa-Dragão.

## Nível de pescador

- EXP = 10 × pontos do peixe. Nível n pede `60 × (n−1)^1,7` de EXP total; máximo 50 (`fishingLevel`, `fishingLevelProgress`).
- Cada nível acima do 1: +0,8% de verde, +0,6% de sorte, +0,2% no automático (`levelBonus`, aplicado por `effectiveRod`). Itens da loja podem pedir nível (Pedra Nv. 2 pede Nv. 3, Vara de Carvalho Nv. 5).

## Interface

- Cartão do pescador (vidro azul com ouro, como o retrato do jogador): medalhão com a aura azul do jogo e a vara, nível, EXP em água e Pontos.
- Console de pesca (madeira escura com friso dourado): vara e isca em molduras de item (a isca mostra quantas restam), chave Auto e o botão Lançar/Recolher.
- Desafio pequeno sobre a cabeça: relógio redondo com a sombra do peixe, estrelas de dificuldade, faixa de água com o alvo e a boia, acertos em losangos e erros em pontos.
- Resultado: o peixe sobre a aura dourada do jogo, nome em Lilita One, peso, estrelas, Pontos e EXP.
- Casa de Pesca: balcão à esquerda (a Casa de Pesca sobre a aura dourada, nível, Pontos, totais) e abas Trocas (cards com moldura de item, preço, quantidade − / +) e Coleção (por lago, com contagem).

## Pontos de Pesca e Casa de Pesca

- Cada peixe pescado dá Pontos de Pesca (`Profile.fishing.points`). Clicar na Casa de Pesca abre a janela com **Trocas** e **Coleção** (peixes por lago, `???` para os não pescados, quantidade e recorde).
- Trocas (`FISHING_SHOP`, `fish-buy`, validado em `server/fishing.ts`): 100 de Ouro (50), Isca Brilhante ×10 (60), Pedra Nv. 1 (30), Pedra Nv. 2 (110, Nv. 3), Ticket de Cor (150, respeita o máximo), Adubo de Orvalho (40), Vara de Carvalho (800, Nv. 5, uma vez). Até 20 por troca.

## Dados

`Profile.fishing` (`FishingProfile`, normalizado por `normalizeFishing`): vara e isca escolhidas, varas e iscas que tem, pontos, coleção, recordes, total e EXP. Gravado por `Store.fishSettle`/`fishGear`/`fishBuy` com trava da linha. A pose de quem pesca (`LobbyPlayer.fishing`) vai para todos na zona, para desenhar vara, linha, boia e o peixe.

## Testes

- `tests/fishing.test.ts`: lugares e píeres, caminhada até todos os lugares, notas da barra, automático e sorte, gravação, loja, separação das zonas, fluxo manual, dois erros e três rodadas AFK.
- `npm run test:fishing:browser` (jogo rodando): um amigo pesca no automático, o jogador entra, sobe a escada até o gramado do Lago das Ninfeias, pesca à mão até pegar, troca a vara, abre a Casa de Pesca e a Coleção e volta à praça. Prévias em `test-results/fishing/`.

## Falta

- Arte pintada (prompts em `docs/fishing-art-prompts.md`): ícones de peixe/vara/isca/pontos, botão `fishing-button.png` e as animações (fisgar, levantar a vara no sucesso, perder o peixe). Hoje tudo isso é desenho provisório em código.
- Sons de lançar, morder, acertar e escapar.
- Mais varas e iscas, eventos de pesca, ranking de pescadores.
