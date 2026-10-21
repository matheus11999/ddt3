# Celular em paisagem

O jogo é jogável no celular somente na horizontal. `MobileOrientation.tsx` distingue dispositivos com toque/ponteiro primário móvel de janelas desktop estreitas. Em retrato, a tela **Vire o celular** cobre o jogo e bloqueia os controles, inclusive na criação do personagem. A detecção acompanha a mudança de orientação e o tamanho da janela.

Ao girar, a página não recarrega: sessão, personagem, itens, rascunho da mochila e partida são preservados. A entrada em retrato cancela a carga de tiro e limpa entradas pendentes; soltar o dedo ou uma tecla depois não dispara. O servidor continua contando o tempo do turno e simulando os outros jogadores. Isso não é uma pausa da partida multiplayer.

Mochila, loja, ferreiro e arena em celulares deitados usam a largura da tela, dois painéis e rolagem interna. Cabeçalho, fechamento e ações permanecem dentro da área útil. `viewport-fit=cover` e margens `safe-area-inset-*` acomodam recortes da tela. O desktop mantém o layout aprovado e não recebe o bloqueio só por estreitar uma janela.

Não há promessa de forçar a orientação física do navegador: o jogador gira o aparelho, e a tela de orientação controla quando a interface fica disponível. Não é preciso aceitar tela cheia, recarregar ou recriar personagem.

## Tamanhos reais (21/10)

Toda a tela do jogo é desenhada em 864 de altura e encolhida para caber (`--game-scale`, cerca de 0,43 num celular de 375 px). Por isso, no celular, as regras `html.mobile-landscape` desfazem a escala (`scale(calc(N / var(--game-scale)))` ou `calc(Npx / var(--game-scale))`) e medem em **pixels reais da tela**. Botão de toque tem pelo menos 36 px; os principais do combate têm 58 a 80 px.

## Combate no celular (21/10, pedido do matheus)

`BattleHud.tsx` mostra `touch-controls` só em aparelho de toque (`useMobileOrientation().mobile`); estilo em `BattleTouch.css`.

- **Setas de andar** (esquerda, 58 px): segurar anda como a seta do teclado (o mesmo comando `walk` a cada `WALK_COMMAND_MS`); soltar para na hora. Fora da vez só vira o boneco.
- **Botão FORÇA** (21/10, matheus achou o primeiro botão feio e mal colocado): no celular ocupa o lugar do mostrador de ângulo (`TouchFireDial` em `CombatGauges.tsx`), como um botão vermelho abaulado em moldura dourada que afunda ao tocar; mostra só "FORÇA" (e a força enquanto segura, sem o ângulo, pedido do matheus) e um anel laranja que enche com a força; soltar dispara. As setas de ângulo ficam ao lado. A régua do console continua aceitando o toque; os dois usam a mesma carga (`chargeByPointer`).
- **Poderes** numa coluna só na borda direita, sob o minimapa, sem título nem painel azul (21/10, pedido do matheus; também no PC, botões de 52 px) (Enfurecer e Gelo viraram itens do preparo, `docs/consumables.md`); habilidades e voo ao lado das setas; habilidades do pet logo acima delas.
- Setas de ângulo, PASS e Sair maiores.

## Praça e Pescaria no celular

- O menu da praça encolhe em telas até 760 px para os 13 ícones caberem (antes o da Arena saía da tela no iPhone SE).
- Botões redondos do topo (som, tela cheia, ajustes) com 36 px.
- O chat da praça e da Pescaria fica no celular, pequeno, acima do menu, sempre aberto com as últimas linhas (sem a setinha).
- Pescaria: cartão do pescador logo abaixo do perfil, Trocas e Histórico embaixo dele; SAIR e o ranking "Maior peixe da semana" menores, abaixo da linha de moedas; Lançar/Auto num tamanho médio.
- Menu da praça (21/10, computador e celular): sem Hall da Fama (abre clicando no pódio "Ranking PvP do dia") e sem Ajustes (a engrenagem do topo); a Pescaria saiu do menu e virou um botão pintado à direita, igual ao do Chefão Mundial (`.lobby-event-buttons` em `Hud.tsx`).

## Prévia de todas as telas

`node scripts/tour-mobile.mjs` (com o jogo rodando; `SIZES=667x375,740x360,844x390`) abre cada botão do menu, a arena, a sala e a batalha, salva as fotos em `test-results/mobile-tour/` e lista em `small-targets.json` todo botão com menos de 36 px.

Falta: alvos ainda pequenos dentro das janelas (abas do chat do Hall da Fama) e arte pintada para as setas e o botão FOGO, se o matheus quiser trocar o desenho em código.

## Verificação

Com Vite ou a versão Docker atualizados:

```powershell
$env:BASE_URL='http://127.0.0.1:8097'
npm run test:mobile:browser
```

`scripts/smoke-mobile-landscape.mjs` usa emulação de navegador com toque. Verifica retrato bloqueado, rotação, criação, mochila/loja/ferreiro/arena, controles de combate (setas de andar e botão FOGO por toque) e preservação da sessão. As resoluções de referência são 844×390, 932×430 e 667×375. Capturas ficam em `test-results/`; o teste não substitui avaliação em aparelhos iOS/Android físicos.

## Tamanho do HUD por resolução (21/10)

Pedido do matheus: menos poluição na tela do celular. `--hud-k` (em `MobileOrientation.css`) encolhe o HUD conforme a altura da tela: 1 acima de 460 px, 0,92 até 460, 0,85 até 400 e 0,8 até 360. As regras do celular dividem por `--touch-scale` (= `--game-scale` / `--hud-k`) em vez de `--game-scale`. Na Pescaria, chat, painel da vara e Auto ficam numa linha só embaixo, sem se sobrepor ao menu.
