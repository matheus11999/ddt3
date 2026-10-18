# Combate em quadros pintados (como no DDTank)

Pedido do usuário em 18/10/2026, a partir do relatório `output/pdf/DDTank-rig-corpo-combate.pdf`: o corpo de combate funciona como o compositor de sprites do DDTank. Cada roupa traz as poses de combate **pintadas** em células compatíveis; o jogo só escolhe o quadro da ação atual e empilha por cima, no mesmo espaço, a cabeça universal, o cabelo, o chapéu, os óculos e a arma nas costas. Deitado para andar e mirar, **ajoelhado para arremessar** (nunca fica de pé), arma presa nas costas o tempo todo. Revisão de 18/10 à tarde (pedido do matheus): o corpo é pequeno como no DDTank, menor que a cabeça, e as **mãos são universais**: um punho achatado simples (mais largo que alto, topo redondo, base reta, três tons de pele e contorno quase preto), sem dedos, desenhado pelo jogo em todos os personagens na cor da pele (como no DDTank). Deitado, os dois punhos ficam lado a lado na frente do queixo, com a base na mesma linha, e o da frente é menor (cerca de 2/3), como medido na simulação do DDTank. O deitado segue as medidas da simulação do DDTank: cabeça parada, corpo curto e reto (cerca de meia cabeça aparece atrás dela), punhos sob o queixo, arma baixa atrás do quadril. Vale para todas as roupas, sem números por roupa.

## Quadros (`src/game/rig/combatFrames.json`)

| # | Quadro | Uso | DDTank |
| --- | --- | --- | --- |
| 0 | rest | parado, mirando | STAND (0) |
| 1-4 | crawl1..crawl4 | rastejar, cada desenho dura dois passos | WALK [1,1,2,2,3,3,4,4,5,5] |
| 5 | hurt | atingido, queda, derrota | |
| 6 | rise | começou a carregar: sobe para os joelhos | SHOWTHROWS 28-29 |
| 7 | ready | segurando enquanto carrega (o projétil brilha no punho) | SHOWTHROWS 30 / STOPTHROWS |
| 8-11 | windup, release, follow, settle | disparo: prepara, solta, acompanha, assenta | THROWS 31-35 |

Depois do disparo volta por `rise` e deita (`rest`), como HIDETHROWS. As sequências e tempos estão em `combatFrames.ts` (`combatFrame`); o servidor continua lançando no início de `fire`, então o preparo dura um passo curto. O ponto de saída do projétil (`x + 27 × facing, y − 40`) não mudou.

Para cada quadro o contrato diz onde fica a cabeça (`head`), os dois punhos universais (`fists`: o de trás, atrás do corpo, e o da frente, que segura e solta o projétil, com inclinação) e o centro e a inclinação da arma nas costas (`back`, `backAngle`), em unidades do avatar a partir do ponto de contato com o chão, virado para a direita.

## Ordem das camadas

Como no `GameCharacterLoader` do DDTank: arma nas costas → punho de trás (só ajoelhado) → cabeça e cabelo → roupa → óculos e chapéu → punho da frente. Deitado, os dois punhos ficam por cima do rosto, cobrindo a parte de baixo do queixo, igual ao original. Entre um quadro e o seguinte (rastejar, levantar, arremesso) os punhos deslizam suavemente; rastejando eles também sobem e descem alternados.

## Andar deitado

O servidor anda 8 px a cada comando (90 ms). O cliente persegue essa posição em velocidade constante (`src/game/battleMotion.ts`) em vez de cobrir uma fração da distância por quadro, e o rastejar continua 140 ms depois do último pixel, então não para nem dá tranco entre os passos.

## Arte de uma roupa nova

1. `python3 scripts/make-combat-templates.py` gera os moldes `docs/templates/combat-ground.png` e `combat-throw.png`: 3×2 células de 512 px sobre magenta, com a cabeça como silhueta verde, o corpo como boneco cinza pequeno (`mannequin` no contrato, no tamanho do DDTank) e os punhos como discos ciano, onde o jogo desenha a mão universal.
2. O Codex pinta a roupa por cima do boneco cinza, sem mãos (mangas terminam no cotovelo), com os prompts de `docs/combat-art-prompts/`: anexar o molde, a roupa em pé e as referências de pose do relatório (`output/pdf/ddtank-rig-imagens/04`, `05`, `06`). As referências do DDTank servem só de pose; a arte é nossa.
3. `python3 scripts/build-combat-atlas.py outfit-<id>` acha a cabeça verde de cada quadro, escala a prancha para a cabeça universal, apaga o verde, coloca o corpo na célula do atlas (cabeça no x do contrato, linha mais baixa no chão) e grava `public/assets/outfits/combat/outfit-<id>.png` e a altura medida da cabeça em `src/game/combatAtlas.json`. Avisa quando o corpo pintado passa 30% do boneco cinza. Avisos e erros em `test-results/combat/outfit-<id>/`.
4. `node scripts/verify-combat-frames.mjs` monta a prancha de todas as roupas × ações (`test-results/combat/combat-frames.png`) para mostrar ao usuário.

Roupa sem atlas continua no corpo deitado recortado antigo (`docs/prone-combat.md`). O Ticket de Cor e a cor do corpo se aplicam ao atlas inteiro pela mesma zona da roupa.

## Fantasias

A fantasia substitui as peças (como no DDTank) e já tem a prancha deitada (`-prone.png`). Para ficar de pé no arremesso ganha `-throw.png` (mesmos 6 quadros de `rise` a `settle`, cabeça própria sobre a silhueta verde do molde), registrada em `throw` no `COSTUMES` de `costumes.ts`; prompt `costume-throw.txt`.
