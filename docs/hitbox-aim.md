# Hitbox do jogador, mira junto ao personagem e som de grau

Pedido do matheus em 19/10/2026, a partir do estudo do DDTank 4.1 em `output/player-hitbox-aim-reference/` (só no PC dele; arte e som de lá são referência, nunca usados no jogo).

## Hitbox (`shared/physics.ts`)

- **Comprovado na fonte**: `Player.cs` cria `m_rect=Rectangle(-15,-20,30,30)` em volta da origem lógica O: caixa alinhada aos eixos, 30×30, sem headshot, sem teste por pixel.
- **Contrato**: `fighterHitBounds(fighter)` devolve `[x-15,x+15] × [y-46,y-16]` e a origem O. `FIGHTER_HIT_BOX` guarda a caixa; `FIGHTER_ORIGIN_LIFT=26` converte o apoio dos pés do Brasa (`fighter.y`) para O.
- **Decisão**: o 26 é uma adaptação do Brasa, não uma constante do DDTank. Ele mantém o centro físico onde estava o círculo antigo (31 px acima dos pés, `FIGHTER_BODY_CENTER`). No DDTank O fica no chão e a caixa desce 10 px dentro dele. Copiar isso no Brasa deixaria a caixa nos pés do boneco deitado, longe da cabeça pintada. Escala 1: a balística do Brasa já usa as unidades do DDTank (`docs/ballistics.md`).
- **O que não muda a caixa**: roupa, fantasia, gênero, cabeça, cabelo, chapéu, pose, direção e rampa. A arte inclinada não gira a caixa.
- **Monstros e chefões** continuam com o próprio círculo (`hitRadius`/`hitHeight`).
- **Contato**: disco do projétil (raio de cada arma, inalterado) contra a caixa expandida com cantos redondos (soma de Minkowski, `rectContact`, a mesma função das células do terreno). A varredura continua contínua e o primeiro contato ao longo do segmento vence o terreno. A borda é inclusiva: tangente exata conta, como já acontecia no terreno e no círculo. `x/y` do resultado é o ponto da caixa mais perto do centro da bala; `points` guarda o centro.
- **Raspão**: a qualidade é a distância da linha do tiro ao centro da caixa sobre o suporte da caixa expandida naquela direção (`15|nx|+15|ny|+raio`). Vale 1 no centro e 0 na tangente, em qualquer face ou canto. O limite de `direct` (0,65) e as curvas de dano não mudaram.
- **Splash** continua com seu círculo (`SPLASH_BODY` em `shared/combat.ts`, raio 22 a 31 px dos pés), agora explícito e separado da colisão.
- **Saída do lançador**: um rival a menos de 16 px na horizontal é ignorado enquanto a bala está dentro da caixa dele. Tiro a 90° cai 27 px à frente dos pés: passa da meia largura de 15 de quem está em cima do atirador e acerta quem está um pouco à frente.
- **Lacuna da fonte**: `Config.CanCollied` (falso por padrão) e `m_demageRect` sem inicialização impedem afirmar o comportamento do oficial em execução. Aqui jogador vivo sempre intercepta. Morto não intercepta. Invisível é atingível no servidor, sem revelar posição.

## Mira junto ao personagem (`src/game/aimIndicator.ts`, `src/game/aimArt.json`)

- **Referência**: `TakeAimAsset`, com arco vermelho fixo no símbolo e a mão de dez pontos amarelos girando por `gunAngle`. Não é o mostrador do HUD.
- **Arte original pintada pelo Codex** (19/10) a partir das peças extraídas: `public/assets/ui/aim/aim-red-arc.png` e `aim-yellow-dot.png`, montadas por `py -3 scripts/build-aim-art.py <arco-bruto> <ponto-bruto>`. O script ajusta um círculo na borda externa do arco (centro de curvatura = pivô da textura) e grava tamanhos e pivôs em `aimArt.json`.
- **Geometria** (`aimArt.json`, `draw`, em unidades do TakeAimAsset × `scale` 1,2; era 1,8 e o matheus achou grande em 20/10):
  - Os 10 pontos ficam a 15 até 58,95 com as opacidades do original.
  - O centro da borda do arco fica 6 para trás e 3,5 para cima do pivô, com raio 53, medido em `faixa-angular.png`.
- **Pivô**: a origem real do tiro (`SHOT_ORIGIN`, 27 à frente e 40 acima dos pés). Os pontos seguem o mesmo ângulo de elevação mundial que o servidor usa no lançamento, então mostram a direção inicial verdadeira, sem somar a rampa duas vezes.
- **Arco**: espelhado pela direção e girado pela inclinação desenhada do corpo, atrás do avatar. Pontos e placa de grau ficam na frente.
- **O que não existe mais**: a faixa verde de limites e a seta afilada. O arco é pintura fixa, não máscara de graus. Os limites por arma continuam no controle e no servidor.

## Som de grau (`angleChange`)

- **Referência**: `Sound006`, o mesmo som para subir e descer, tocado só quando o grau muda de fato.
- **Arquivo**: `public/assets/audio/sfx/angle-change.mp3` é original, sintetizado por `scripts/make-angle-click.py`. Imita ataque de cerca de 10 ms, pico em 20 ms, clique claro de 2 a 3,5 kHz com corpo de cerca de 1 kHz e fim em cerca de 120 ms.
- **Onde toca**: `BattleHud.stepAngle` é o único caminho de ajuste (teclas ↑/↓/W/S e botões da tela, que servem ao toque).
  - Passo de 1°, repetição de 90 ms independente do FPS (o ritmo já aprovado).
  - Toca uma vez por mudança real. No limite fica em silêncio.
  - Não toca em correção de terreno, snapshot ou render.
- **Áudio**: o cue tem `gap` de 60 ms e no máximo 2 vozes.

## Debug

`localStorage['brasa-debug-hitbox']='1'` ou `?hitbox=1` mostra pés (amarelo), origem O (rosa), caixa (ciano), pivô da mira, centro do projétil e primeiro contato (`src/game/hitboxDebug.ts`, mesmo contrato do servidor). Jogador escondido pelo servidor é pulado.

Prévia: `node scripts/preview-aim.mjs` (`DEBUG=1` para as guias). Ela também verifica o som: 3 cliques dão 3 toques, no limite nada toca, snapshot não toca e segurar a tecla repete.
