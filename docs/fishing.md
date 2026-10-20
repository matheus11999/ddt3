# Pescaria (20/10/2026)

Pedido do matheus: uma zona separada da Praça Celeste, mais larga, com lagos, Casa de Pesca e profundidade, onde os jogadores pescam à mão (barra de tempo) ou no automático (AFK enquanto o jogo estiver aberto), trocam Pontos de Pesca por recompensas e sobem o **nível de pescador**. Todos os números abaixo são provisórios: ficam em `shared/fishing.ts`.

## Zona

- `Zone = 'plaza' | 'fishing'` (`shared/fishing.ts`). O jogador entra pelo botão **Pescaria** do menu da praça e sai pelo botão **Sair da Pescaria** (topo) ou pelo portão "Praça Celeste" à esquerda do mapa.
- Comando `zone` → o servidor troca `Peer.zone`, põe o jogador em `FISHING_SPAWN` (ou em `LOBBY_SPAWN` na volta) e manda `zone` com os jogadores da nova zona. Cada canal tem uma lista de andarilhos por zona; chat Mundo/Guilda/Privado continua igual.
- Na Pescaria o menu mostra mochila, loja, leilão, missões, correio, guilda, pets etc., **sem** Arena PvP, Expedições e Ferreiro. O servidor recusa `create`, `create-expedition`, `join`, `spectate`, `world-boss-enter` e aceitar convite de sala fora da praça (`PLAZA_ONLY_COMMANDS`).
- Mapa 6144 px (4 telas), chão a partir de y 548, caminhada x 140–6004 / y 575–805. Três lagos (`FISHING_LAKES`): **Lago das Ninfeias** (x 1380), **Poço Azul** (x 3420, dois píeres) e **Lagoa de Cristal** (x 5180), cada um com píer. Casa de Pesca em x 2330.
- Lugares de pesca (`FISHING_SPOTS`): duas margens por lago e ponta e meio de cada píer. Clicar na água leva ao lugar livre mais perto e já lança. Um lugar por jogador por canal.
- Caminhada: lagos e casa bloqueiam; o servidor anda por `fishingStep` (contorna pelo caminho de trás, y 584).
- Cenário: parallax montado por `npm run build:lobby -- --layout=scripts/fishing-layout.json` (por enquanto com as peças da praça) + gramado, lagos, píeres, casa e portão desenhados em código até a arte pintada chegar (`docs/fishing-art-prompts.md`).

## Pesca

Servidor autoritativo (`server/game.ts`, `castLine`/`pressBar`/`tickFishing`):

1. `fish-cast {spot}` → esperando (6 a 13 s, vezes a velocidade da vara e da isca; isca brilhante ×0,8; no automático ×1,2).
2. Morde: o servidor sorteia o peixe (lago, sorte da vara, isca e nível) e manda a barra (`fishChallenge`, semente). A barra começa 0,7 s depois ("Fisgou!").
3. **Manual**: um marcador vai e volta; o jogador aperta Espaço ou clica quando ele está no verde. Peixes difíceis pedem mais acertos, marcador mais rápido e verde menor; a vara aumenta o verde (`control`). 2 erros ou o tempo acabar = o peixe escapa. O cliente manda o horário do servidor estimado do aperto; o servidor confere com folga de 0,7 s.
4. **Automático** (`fish-auto`): ninguém aperta; chance fixa por peixe (`autoChance`: 82% no mais fácil, −11% por dificuldade, mínimo 20%, máximo 85%) e só 30% da sorte de peixes raros. Depois do resultado ele lança de novo sozinho, sem fim, enquanto a conexão estiver aberta.
5. Resultado (2,6 s): peixe, peso, Pontos de Pesca, EXP, "Novo na coleção!", "Recorde!" e subida de nível.

Andar para longe recolhe a linha; trocar vara/isca pode a qualquer hora, menos no meio da barra (`fish-gear`).

## Varas, iscas e peixes

- **Vara de Bambu** (inicial, dada a todos) e **Vara de Carvalho** (Casa de Pesca, Nv. 5: +18% de verde, marcador 10% mais lento, +12% sorte, +6% no automático).
- **Isca Simples** (infinita) e **Isca Brilhante** (gasta 1 por lançamento, morde mais rápido, +30% sorte).
- 14 peixes (`FISH`), dificuldade 1 a 5, com lagos, peso em kg e pontos: Bota Velha (todos os lagos), Lambari Dourado, Tilápia Rosada, Carpa da Lua, Baiacu Bolha, Koi Celeste, Bagre Barbudo, Tucunaré Brasa, Enguia do Trovão, Pirarucu Ancestral, Peixe-Vidro, Truta Aurora, Dourado Real, Carpa-Dragão.

## Nível de pescador

- EXP = 10 × pontos do peixe. Nível n pede `60 × (n−1)^1,7` de EXP total; máximo 50 (`fishingLevel`, `fishingLevelProgress`).
- Cada nível acima do 1: +0,8% de verde, +0,6% de sorte, +0,2% no automático (`levelBonus`, aplicado por `effectiveRod`). Itens da loja podem pedir nível (Pedra Nv. 2 pede Nv. 3, Vara de Carvalho Nv. 5).

## Pontos de Pesca e Casa de Pesca

- Cada peixe pescado dá Pontos de Pesca (`Profile.fishing.points`). Clicar na Casa de Pesca abre a janela com **Trocas** e **Coleção** (peixes por lago, `???` para os não pescados, quantidade e recorde).
- Trocas (`FISHING_SHOP`, `fish-buy`, validado em `server/fishing.ts`): 100 de Ouro (50), Isca Brilhante ×10 (60), Pedra Nv. 1 (30), Pedra Nv. 2 (110, Nv. 3), Ticket de Cor (150, respeita o máximo), Adubo de Orvalho (40), Vara de Carvalho (800, Nv. 5, uma vez). Até 20 por troca.

## Dados

`Profile.fishing` (`FishingProfile`, normalizado por `normalizeFishing`): vara e isca escolhidas, varas e iscas que tem, pontos, coleção, recordes, total e EXP. Gravado por `Store.fishSettle`/`fishGear`/`fishBuy` com trava da linha. A pose de quem pesca (`LobbyPlayer.fishing`) vai para todos na zona, para desenhar vara, linha, boia e o peixe.

## Testes

- `tests/fishing.test.ts`: lugares e píeres, caminhada até todos os lugares, notas da barra, automático e sorte, gravação, loja, separação das zonas, fluxo manual, dois erros e três rodadas AFK.
- `npm run test:fishing:browser` (jogo rodando): um amigo pesca no automático, o jogador entra, pesca à mão até pegar, troca a vara, abre a Casa de Pesca e a Coleção, anda pelos três lagos e volta à praça. Prévias em `test-results/fishing/`.

## Falta

- Arte pintada (prompts em `docs/fishing-art-prompts.md`): cenário, casa, portão, píeres, ícones de peixe/vara/isca/pontos, botão `fishing-button.png` e as animações (fisgar, levantar a vara no sucesso, perder o peixe). Hoje tudo isso é desenho provisório em código.
- Sons de lançar, morder, acertar e escapar.
- Mais varas e iscas, eventos de pesca, ranking de pescadores.
