# Central de Expedições

Expedições são masmorras cooperativas, como as do DDTank: a equipe (até 4) cria uma sala na Central de Expedições (botão Expedições no menu do lobby), o líder escolhe a expedição e a dificuldade e todos entram juntos. Primeira expedição: **Formigueiro**, só no Fácil (Normal, Difícil e Herói aparecem como "Em breve").

## Como joga

- **Sala**: igual à sala PvP (cartões da equipe, chat, ferramentas, botão Convidar). O quadro pintado "Central de Expedições" abre a janela com as expedições: capa grande com título 3D, poder recomendado ao lado do poder do jogador e drops pintados por cima da arte (só os itens, sem porcentagem), dificuldades num seletor compacto (cada uma com sua cor); drops (por enquanto só a Pedra de Fortificação I; os outros espaços ficam vazios para drops futuros) e, por enquanto (teste), a escolha do estágio. Escolhida a expedição, o quadro mostra a arte da expedição (a mesma em todos os estágios, `board`), o título 3D, a placa dourada "ESTÁGIO N" (mesmo estilo da placa "SALA N"), a dificuldade e os drops. Só o líder escolhe; todos precisam estar prontos para Iniciar. Não há bots nem espectadores.
- **Estágios**: cada estágio é uma batalha separada. Ao vencer, a equipe volta para a sala com o próximo estágio já marcado; depois do último, volta ao estágio 1. Perder mantém o estágio escolhido.
- **Turno da instância** (`shared/instanceTurn.ts`, reaproveitável em qualquer masmorra futura):
  1. O estágio 1 abre com os monstros entrando pelas bordas do mapa (2,6 s) e a câmera mostrando cada lado; nos outros estágios eles já estão no lugar e só aparece o título (1,6 s). Ninguém joga antes disso.
  2. Cada aventureiro vivo joga uma vez por rodada, em ordem de agilidade.
  3. Depois os monstros jogam **todos juntos**, num turno só (`turnId: 'monsters'`): andam um pouco na direção do aventureiro mais próximo; quem já estava colado nele morde, todos ao mesmo tempo. Quem chega perto só morde na rodada seguinte, então dá tempo de reagir.
  4. Cada tipo anda num ritmo (Operária rápida, Soldado médio, Guerreira lenta) e cada formiga varia 85%–115% por turno, então elas se espalham. Mantêm distância umas das outras em volta do alvo, param na beira do abismo e não atravessam paredes.
- **Na tela**: formigas têm barra de vida fina, sem nome, embaixo dos pés; a rainha tem a placa de jogador (nome e vida) embaixo dela. Abaixo do minimapa fica o objetivo do estágio ("Derrotar todas as formigas 3/6" ou "Derrotar a Rainha Formiga"). O terreno do formigueiro não quebra (todas as peças com `destructible: false`).
- **Estágio 1, O tronco caído** (`anthill-1`): dois troncos caídos; 6 formigas (Operária, Soldado, Guerreira) vêm das duas pontas. Matar todas encerra o estágio.
- **Estágio 2, A câmara da rainha** (`anthill-2`): a Rainha Formiga fica parada no trono, à direita. No turno dos monstros ela atira uma flecha (mira no aventureiro com menos vida, erra um pouco de propósito) e, a cada 2 rodadas, manda 2 formigas saírem do ninho (máximo de 5 vivas). Matar a rainha encerra a expedição, mesmo com formigas vivas.
- **Recompensas**: ao fim de cada estágio vencido, prêmio fixo (moedas e XP) e a mesa de cartas. Estágio 1: 4 cartas básicas (moedas, XP, pedra I, Ticket de Cor). Rainha: 8 cartas melhores (até pedra III e 2 tickets). Perder dá 0 cartas. Expedição não conta para o ranking PvP.
- A vida dos monstros cresce com a equipe (`partyHpScale`: 1 jogador ×0,93, 4 jogadores ×1,9).

## Onde fica cada coisa

- Regras e números: `shared/expeditions.ts` (monstros, estágios, cartas, dificuldades).
- Servidor: `server/game.ts` (salas `kind:'expedition'`, `launchExpedition`, `nextInstanceTurn`, `startMonsterTurn`, `queenArrow`, `checkInstanceEnd`) e `server/expedition.ts` (montagem do estágio, mira da rainha).
- Cliente: `src/components/ExpeditionHall.tsx`, `ExpeditionRoom.tsx` (sala e janela de escolha), `ExpeditionBattle.tsx` (contador de formigas, barra da rainha, faixas "ESTÁGIO" e "VEZ DAS FORMIGAS"), `src/game/monsters.ts` (desenho e animação dos monstros e da flecha).
- Monstros são `Fighter` do time 1 com `monster`, `hitRadius` e `hitHeight`: tiros, dano, crateras, números de dano e minimapa funcionam como em PvP.

## Editar no painel

Os dois estágios são mapas do tipo **Instância** no editor do `/admin` (Mapas → Instâncias). Além de peças e spawns (só time 1), a lista **Monstros** adiciona, apaga, troca o tipo e arrasta cada monstro; o **Ninho** marca de onde a rainha manda formigas. Publicar põe no jogo sem rebuild, como os mapas PvP. O montador avisa monstro sem chão ou fora do mapa.

## Arte

- Gerada pelo Codex no PC do usuário. Prompts em `docs/expedition-prompts/` (01 a 14), fontes em `public/assets/expeditions/anthill/source/` e `public/assets/maps/anthill-*/source/`.
- Monstros: folha 2×2 sobre magenta (operária, soldado e guerreira: andar A, andar B, preparar, morder; rainha: parada, puxar o arco, soltar, dor). `npm run cut:monster-sheet` recorta cada folha numa tira de 4 quadros com a mesma base; os quadros de andar ficam centrados no corpo (sem escorregar entre um passo e outro) e os de ataque presos pelas costas, e também a flecha, o ícone do menu (`public/assets/ui/expedition-button.png`), a capa e o quadro da sala. O movimento (respirar, andar, dar o bote, tremer ao apanhar, virar de barriga para cima ao morrer) é desenhado em código.
- Arte da janela e dos estágios: `python3 scripts/compose-expedition-cover.py` (depois de montar os dois mapas) monta `picker-art.webp`, `stage-1.webp` e `stage-2.webp` só com peças do próprio jogo (mapas e formigas).
- Chão: cada estágio tem o chão numa peça só (`source/chao.png`, pintada pelo Codex sobre os moldes de `docs/expedition-prompts/ground/`, escala 2). Quadro da sala: `source/15-quadro.png` → `board.webp`.
- Mapas: `npm run build:map -- --map=anthill-1` e `--map=anthill-2` (`scripts/map-layouts/`). Os brotos pintados em cima do tronco foram apagados da folha porque funcionavam como paredes para quem anda.
- Teste no navegador: `node scripts/smoke-expedition.mjs` (com o jogo rodando) cria a sala, escolhe, inicia, passa os turnos até a primeira mordida e tira as prévias em `test-results/expedition/`.

## Próximos passos

- Balancear e abrir Normal, Difícil e Herói (os poderes recomendados de lá são provisórios).
- Tirar a escolha de estágio da janela quando não for mais preciso para testar.
- Sons próprios das formigas (mordida, flecha, saída do ninho).
- Mais expedições: cada estágio é um mapa de instância com `monsters` no layout.
