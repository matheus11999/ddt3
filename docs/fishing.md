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
- **Layout editável** (20/10, pedido do matheus: "quero poder editar esse mapa no editor do painel admin, arrastar os lagos etc.."): terraços e muros são fixos; lagos, peças, escadas, Casa de Pesca, dirigível e chegada vêm de um `FishingLayout` (`defaultFishingLayout()` em `shared/fishingMap.ts`). `applyFishingLayout()` troca o layout em uso (servidor e cliente) e recalcula obstáculos, chão e lugares de pesca. Cada lago tem nome, tabela de peixes (`FISH_TABLES`: ninfeias, profundo, cristal, juncos, termal), arte (`POND_ARTS`), posição, largura e espelho. Cada peça tem posição pela base, tamanho, giro, camada (`ground` no chão, `water` flutua e balança, `stand` em pé, ordenada com os jogadores), sólida e "dá para andar" (padrões por peça em `FOOTPRINTS`/`DECKS`); a placa `lake-sign` mostra o nome do lago escolhido.
- Lugares de pesca (`FISHING_SPOTS`, gerados): em volta de cada lago (6 a 16 conforme o tamanho) e nas passarelas sobre a água (píer, ilha, ponte), a pelo menos 60 px um do outro; 37 no layout padrão. Não aparecem na tela. **Lançar** (ou Espaço) entra no modo de escolher lago: os lagos brilham, o do ponteiro mais forte; clicar num lago leva ao lugar livre mais perto e lança ao chegar (ou lança na hora se já estiver num lugar dele); Esc, andar ou clicar fora cancela. Depois de uma pescaria, Lançar lança de novo no mesmo lugar. Clicar num lago fora do modo só anda até a margem. Um lugar por jogador por canal.
- Caminhada: grade de 8 px (água e pedras da borda, troncos de árvore, casas e o pagode bloqueiam; ilha, ponte e píer são chão), campo de distância por destino (Dial, custo 5 reto / 7 diagonal, cache de 48) e o servidor anda por `fishingStep` até o ponto mais longe em linha reta no caminho; sobe e desce as escadas sozinho. O telhado da Casa de Pesca passa por cima do gramado de trás: clique no gramado anda, não abre a loja.
- **Cenário** (arte do Codex, gpt-6-astra médio, pranchas em `public/assets/fishing/source/`; prompts em `docs/fishing-art-prompts.md`): céu, lagos vistos de cima rebaixados no gramado, píer, ponte, deque, barco, atracadouro, escadas, muros, cascata, arco, Casa de Pesca, barraca, pagode, quiosque, árvores, enfeites, a textura do gramado (`grass.webp`, repete sem emenda) e peças de grama (faixas, manchas, trilha de pedras, tufos, sebe). Balaústres, lampiões, ciprestes e dirigível vêm da praça; o piso do cais é o da praça. `npm run build:fishing` recorta tudo para `public/assets/fishing/props/` e escreve `shared/generated/fishingProps.ts`. Gramado, lagos, ilha, ponte, píer, muros e escadas ficam guardados em blocos de 768 px; água (textura pintada `water.webp` correndo em duas camadas, anéis e brilhos, sem cobrir passarelas), vapor, cascata, barco, ninfeias e lótus se mexem ao vivo; árvores, casas e enfeites têm sombra pintada em código a partir do próprio contorno, inclinada para a esquerda como na praça (`src/game/fishingWorld.ts`). A imagem-alvo do cenário está em `/mnt/project-files/pescaria/codex/9-cena-conceito.png`. Prévia: `npx tsx scripts/shot-fishing.mjs` (jogo rodando).

- **Editor no `/admin`** (Mapas → Pescaria, `src/admin/FishingEditor.tsx`): arrastar lagos (com "Levar as peças junto"), peças, escadas, Casa de Pesca, dirigível e chegada; paleta de peças com busca; alças de tamanho e giro (5° em 5°, Shift livre); inspetor com X/Y, tamanho, giro, camada, sólida, dá para andar, espelhar, duplicar, ordem e excluir; botão das regras de caminhada (obstáculos laranja, passarelas azuis, lugares de pesca amarelos, só no editor). Salvar, Publicar, histórico e Voltar ao original como nos outros mapas; publicar é recusado se a chegada ficar bloqueada ou um lago ficar sem lugar livre (`fishingBlockers`). O jogo aplica o layout publicado sem reiniciar. Teste: `node scripts/smoke-fishing-editor.mjs` (`ADMIN_PASSWORD`).

## Pesca

Servidor autoritativo (`server/game.ts`, `castLine`/`pressBar`/`tickFishing`):

1. `fish-cast {spot}` → esperando (6 a 13 s, vezes a velocidade da vara e da isca; isca brilhante ×0,8; no automático ×1,2).
2. Morde: o servidor sorteia o peixe (lago, sorte da vara, isca e nível) e manda a barra (`fishChallenge`, semente). A barra começa 0,7 s depois ("Fisgou!").
3. **Manual**: uma boia vai e volta numa faixa de água; o jogador aperta Espaço ou clica quando ela está no alvo verde (o miolo dourado vale Perfeito). Peixes difíceis pedem mais acertos, boia mais rápida e alvo menor, e a partir da dificuldade 3 o alvo **nada** de um lado para o outro (`drift`, `zoneAt`); a vara aumenta o verde (`control`). 2 erros ou o tempo acabar = o peixe escapa. O cliente manda o horário do servidor estimado do aperto; o servidor confere com folga de 0,7 s.
4. **Automático** (`fish-auto`): o minigame não aparece (só o aviso "Fisgou! Puxando no automático"), ninguém aperta; cada peixe rende **25% dos Pontos e da EXP** de um peixe pescado à mão (`AUTO_EFFICIENCY`, `autoReward`, pedido do matheus em 20/10); chance fixa por peixe (`autoChance`: 82% no mais fácil, −11% por dificuldade, mínimo 20%, máximo 85%) e só 30% da sorte de peixes raros. Depois do resultado ele lança de novo sozinho, sem fim, enquanto a conexão estiver aberta.
5. Resultado (2,6 s): peixe, peso, Pontos de Pesca, EXP, "Novo na coleção!", "Recorde!" e subida de nível.

Andar para longe recolhe a linha; trocar vara/isca pode a qualquer hora, menos no meio da barra (`fish-gear`).

## Varas, prêmios e peixes

- **Sem iscas** (pedido do matheus, 20/10): a vara é a progressão da pesca. Quem tinha Isca Brilhante recebe 6 Pontos de Pesca por isca (`normalizeFishing`).
- 6 varas (`FISHING_RODS`), compradas na Casa de Pesca com nível de pescador: Bambu (inicial), Carvalho (Nv. 5), Coral (Nv. 12), Cristal (Nv. 20), Aurora (Nv. 30) e Real (Nv. 40). Cada uma tem controle, velocidade, sorte, bônus no automático e uma **tabela de prêmios** própria (`drops`): Ouro a partir do Carvalho, Fragmentos da Vara das Marés a partir do Coral, Cupons na Aurora e na Real (0,05% e 0,1% por peixe).
- Os prêmios são sorteados no servidor a cada peixe pescado (`rollRodDrops`); no automático a chance cai para 25%. **Limite diário** por jogador (dia de Brasília, `FISHING_DAILY_CAPS`): 2000 de Ouro, 5 Cupons e 10 Fragmentos. O nível de pescador melhora só os peixes (barra, sorte, automático), nunca os prêmios.
- Cupons e Fragmentos são anunciados no chat Mundo, como os peixes Épicos e Lendários; aparecem no resultado e no Histórico. No console, o segundo encaixe mostra os Fragmentos (x/50) e abre os prêmios da vara com o quanto já saiu hoje.
- 20 peixes (`FISH`), dificuldade 1 a 5, com lagos, peso em kg e pontos: Bota Velha (todos os lagos), Lambari Dourado, Tilápia Rosada, Carpa da Lua, Baiacu Bolha, Koi Celeste, Bagre Barbudo, Tucunaré Brasa, Enguia do Trovão, Pirarucu Ancestral, Peixe-Vidro, Truta Aurora, Dourado Real, Traíra das Taboas, Pacu Esmeralda e Peixe-Junco Dourado (Lago dos Juncos), Carpa Termal, Salamandra do Vapor e Fênix d'Água (Fonte Termal), Carpa-Dragão. Ícones pintados pelo Codex em `public/assets/fishing/icons/` (`python3 scripts/build-fishing-icons.py`, pranchas 19a/19b/19c e 20-varas); falta a Fênix d'Água.

## Raridade e histórico (20/10, pedido do matheus)

- Raridade vem da dificuldade do peixe (`fishRarity`, `FISH_RARITIES`): 1 Comum (cinza), 2 Normal (verde), 3 Raro (azul), 4 Épico (roxo), 5 Lendário (dourado).
- Resultado da pesca com selo e borda na cor da raridade; Raro ganha brilho, Épico brilho com faixa de luz e faíscas, Lendário tudo isso maior e um clarão dourado nas bordas da tela. Épico e Lendário são anunciados no chat Mundo do canal ("Fulano pescou Koi Celeste (Épico, 3,4 kg)!").
- Botão Histórico (ao lado de Trocas) abre as últimas 30 capturas (`FishingProfile.history`, `FISHING_HISTORY`), com raridade, kg, pontos, EXP, selo Auto e há quanto tempo. A Sacola pinta cada peixe na cor da raridade.
- Prévia: `npx tsx scripts/preview-fishing-rarity.mjs` (jogo rodando).

## Nível de pescador

- EXP = 10 × pontos do peixe. Nível n pede `60 × (n−1)^1,7` de EXP total; máximo 50 (`fishingLevel`, `fishingLevelProgress`).
- Cada nível acima do 1: +0,8% de verde, +0,6% de sorte, +0,2% no automático (`levelBonus`, aplicado por `effectiveRod`). Itens da loja podem pedir nível (Pedra Nv. 2 pede Nv. 3, Vara de Carvalho Nv. 5).

## Interface

- Painel do pescador e bandeja (20/10, pedido do matheus: "redesenhe onde fica o nível do pescador, e onde seleciona a vara e a isca"): pintura do Codex em vidro azul com ouro (opção B, `15-ui-pescador-b.png`, recortada por `python3 scripts/build-fishing-ui.py` para `public/assets/fishing/ui/`). Painel com a carpa dourada: nível no hexágono, "Pescador" e Pontos na faixa, EXP na barra fina. Bandeja com vara e isca nos dois círculos (a isca mostra quantas restam; clicar abre a lista em vidro azul) e a chave Auto (o botão dourado é peça separada e desliza; ligada fica verde). Botão redondo de lançar com a vara pintada, aceso no passar do mouse e pulsando enquanto escolhe o lago; o nome (Lançar, Escolha o lago, Recolher) numa plaquinha embaixo. Texto e números são do jogo.
- Vara de Bambu em quadros pintados (`rod-bamboo.webp`, 12 quadros: preparo, lançamento, espera, fisgada, puxada forte, sucesso, falha; `ROD_FRAMES` em `shared/generated/fishingFx.ts` com punho e ponta de cada quadro, de onde sai a linha). A Vara de Carvalho usa a mesma folha por enquanto. Respingos pintados: isca caindo na água (`splash-bait.webp`) e captura (`splash-catch.webp`), 8 quadros cada.
- **Menu da Pescaria** (20/10, pedido do matheus): sem Mochila, Loja, Leilão, Pets, Missões e Guilda; entra a **Sacola** (cesto pintado, `FishingBag`: peixes pescados por espécie com quantidade e recorde, mais varas e iscas) e, na tela, o botão **Trocas** (baú pintado) que abre as Trocas da Casa de Pesca de qualquer lugar. Ícones `17-botoes.png`.
- Chave Auto pintada (`18-toggle-auto.png`): desligada cinza com carretilha de ferro, ligada verde com carretilha dourada e brilho pulsando, selo AUTOMÁTICO sobre a bandeja, aviso curto ao trocar e um selo de carretilha girando ao lado da cabeça de quem pesca no automático (visto por todos, `FishingPose.auto`).
- Desafio pequeno sobre a cabeça (só no manual), pintado (`16-minigame-b.png`): painel com a carpa e a escotilha (sombra do peixe e anel do tempo), canal de água correndo, alvo verde, boia, gemas de acerto/erro e estrelas (`scripts/build-fishing-ui.py` recorta todas as pranchas da interface).
- Resultado: o peixe (sem círculo atrás, pedido do matheus), nome em Lilita One, peso, estrelas, Pontos e EXP.
- Casa de Pesca: balcão à esquerda (a Casa de Pesca sobre a aura dourada, nível, Pontos, totais) e abas Trocas (cards com moldura de item, preço, quantidade − / +) e Coleção (por lago, com contagem).

## Pontos de Pesca e Casa de Pesca

- Cada peixe pescado dá Pontos de Pesca (`Profile.fishing.points`). Clicar na Casa de Pesca abre a janela com **Trocas** e **Coleção** (peixes por lago, `???` para os não pescados, quantidade e recorde).
- Trocas (`FISHING_SHOP`, `fish-buy`, validado em `server/fishing.ts`): 100 de Ouro (50), Isca Brilhante ×10 (60), Pedra Nv. 1 (30), Pedra Nv. 2 (110, Nv. 3), Ticket de Cor (150, respeita o máximo), Adubo de Orvalho (40), Vara de Carvalho (800, Nv. 5, uma vez). Até 20 por troca.

## Dados

`Profile.fishing` (`FishingProfile`, normalizado por `normalizeFishing`): vara e isca escolhidas, varas e iscas que tem, pontos, coleção, recordes, total e EXP. Gravado por `Store.fishSettle`/`fishGear`/`fishBuy` com trava da linha. A pose de quem pesca (`LobbyPlayer.fishing`) vai para todos na zona, para desenhar vara, linha, boia e o peixe.

## Testes

- `tests/fishing.test.ts`: lugares e píeres, caminhada até todos os lugares, notas da barra, automático e sorte, gravação, raridade, histórico, loja, separação das zonas, fluxo manual, dois erros e três rodadas AFK.
- `npm run test:fishing:browser` (jogo rodando): um amigo pesca no automático, o jogador entra, sobe a escada até o gramado do Lago das Ninfeias, aperta Lançar, escolhe o lago, pesca à mão até pegar, troca a vara, abre a Casa de Pesca e a Coleção e volta à praça. Prévias em `test-results/fishing/`.

## Falta

- Arte pintada (prompts em `docs/fishing-art-prompts.md`): ícones de peixe/vara/isca/pontos, botão `fishing-button.png` e a folha da Vara de Carvalho. 
- Sons de lançar, morder, acertar e escapar.
- Eventos de pesca, ranking de pescadores.
- Ícone pintado do botão Histórico (hoje um desenho provisório); ícone da Fênix d'Água; pranchas de animação das varas novas (hoje todas usam a do Bambu); a bandeja do console ainda tem a minhoca pintada.

## Console da pesca (20/10, pedidos do matheus)

- A vara equipada aparece dentro do círculo de Lançar (anel pintado vazio, `22-hud-lancar.png` linha B, recortado por `scripts/build-fishing-ui.py` em `cast-ring*` e `rod-swap`); o selo de setas na borda abre **Trocar vara**: as seis varas em cards de item, a equipada com brilho e "Em uso", as que faltam em cinza com o nível; um clique troca, clicar numa bloqueada abre a Casa de Pesca.
- Prêmios ficam num círculo menor ao lado; a bandeja antiga (`gear-tray.webp`, com a minhoca) saiu do console.
- Cartão do pescador 30% menor.
- Trocas compactas: 4 por linha, ícone pequeno, nome e custo; a quantidade só aparece depois de clicar em Trocar.
- Atualizar a página ou reiniciar o servidor devolve à Pescaria quem estava nela (zona lembrada no navegador, `brasa-zone:<id>`); botão de sair ao lado de Configurações.

## Mapa menor (20/10, pedido do matheus: "travando", um lago só, sem a Casa de Pesca)

- 2304 × 2140 (era 4608 × 2620): mirante estreito atrás, o gramado com o **Lago das Ninfeias** (ilha, ponte, píer, barco) e o cais com o dirigível. Todos os 20 peixes vivem nesse lago (`FISH[].lakes = ['ninfeias']`); a Coleção agrupa por raridade.
- Sem a construção da Casa de Pesca: a loja abre pelo botão Trocas.
- Layouts publicados no `/admin` para o mapa antigo (fora dos limites novos) são ignorados até serem publicados de novo (`publishedFishingLayout`).
- Prévia do mapa inteiro: `npx tsx scripts/preview-fishing-map.mjs <pasta>` (Vite rodando).
- Falta: o cenário redesenhado em pintura única pelo Codex, com sombras e profundidade.

## Casa de Pesca, Sacola e informações da vara (20/10, pedidos do matheus)

- Trocas em cards pequenos de coluna (ícone 42 px, nome, preço, botão); a troca de **Fragmento da Vara das Marés** (300 Pontos, Pescador Nv. 12) credita `profile.fragments['tide-rod']` no servidor.
- Sem a lista de prêmios ao lado da vara. Passar o mouse numa vara (Trocar vara, Sacola, Trocas) abre a ficha da vara (`src/components/FishingRodInfo.tsx`): peixes raros, alvo na barra, automático, Ouro, Cupons e Fragmentos em 0 a 5 marcas comparadas com a melhor vara, **sem números**.
- Sacola com abas **Peixes** e **Varas** (as seis varas, com a ficha no mouse) e o encaixe de Fragmentos x/50.
- Os Pontos de Pesca saíram do cartão de pescador e ficam ao lado das moedas do jogo enquanto se está na Pescaria (`currency-fishing` em `Hud.tsx`, ícone `23-moeda-pesca.png`).
- Cais sem barraca e sem deque com guarda-sol (pedido do matheus: "remova essas casas do início").

## Escadarias de frente, pontes e lago limpo (20/10, pedido do matheus)

- Arte do Codex: `24-escadarias.png` (escadaria larga e estreita vistas de frente, trecho que se repete e patamar), `25-pontes.png` (ponte em arco horizontal e vertical, passarela e píer, todos com cabeceira em terra) e `26-lagos-limpos.png` (lagos só com água e margem). Peças `stair-grand`, `stair-narrow`, `bridge-arch`, `bridge-arch-v`, `walkway`, `pier-stone` e o lago `pond-clear`.
- Escadas têm `art` (`side` de lado, `grand` ou `narrow` de frente, `FRONT_STAIRS`): a de frente fica encostada no muro, do gramado de cima ao terraço de baixo, e anda-se reto pelo meio. Escolha no editor do `/admin` (campo Desenho).
- O Lago das Ninfeias usa o lago limpo; as vitórias-régias e lótus são peças soltas que balançam por cima da água, e a isca nunca cai sobre uma delas (`clearOfPads` em `shared/fishingMap.ts`, vale para qualquer layout).
- A ponte em arco liga a ilha à margem leste com as duas cabeceiras de pedra em terra; o píer de pedra sai da margem da frente.
