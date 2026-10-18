# Combate em quadros pintados (como no DDTank)

Pedido do usuário em 18/10/2026, a partir do relatório `output/pdf/DDTank-rig-corpo-combate.pdf`: o corpo de combate funciona como o compositor de sprites do DDTank. Cada roupa traz as poses de combate **pintadas** em células compatíveis; o jogo só escolhe o quadro da ação atual e empilha por cima, no mesmo espaço, a cabeça universal, o cabelo, o chapéu, os óculos e a arma nas costas. Deitado para andar e mirar, **de pé para arremessar**, arma presa nas costas o tempo todo. Vale para todas as roupas, sem números por roupa.

## Quadros (`src/game/rig/combatFrames.json`)

| # | Quadro | Uso | DDTank |
| --- | --- | --- | --- |
| 0 | rest | parado, mirando | STAND (0) |
| 1-4 | crawl1..crawl4 | rastejar, cada desenho dura dois passos | WALK [1,1,2,2,3,3,4,4,5,5] |
| 5 | hurt | atingido, queda, derrota | |
| 6 | rise | começou a carregar: se levanta | SHOWTHROWS 28-29 |
| 7 | ready | segurando enquanto carrega (o projétil brilha no punho) | SHOWTHROWS 30 / STOPTHROWS |
| 8-11 | windup, release, follow, settle | disparo: prepara, solta, acompanha, assenta | THROWS 31-35 |

Depois do disparo volta por `rise` e deita (`rest`), como HIDETHROWS. As sequências e tempos estão em `combatFrames.ts` (`combatFrame`); o servidor continua lançando no início de `fire`, então o preparo dura um passo curto. O ponto de saída do projétil (`x + 27 × facing, y − 40`) não mudou.

Para cada quadro o contrato diz onde fica a cabeça (`head`), o punho que segura e solta o projétil (`hand`) e o centro e a inclinação da arma nas costas (`back`, `backAngle`), em unidades do avatar a partir do ponto de contato com o chão, virado para a direita.

## Ordem das camadas

Como no `GameCharacterLoader` do DDTank: arma nas costas → cabeça e cabelo → roupa → óculos e chapéu. Os punhos sob o queixo no quadro deitado ficam por cima do rosto, igual ao original.

## Arte de uma roupa nova

1. `python3 scripts/make-combat-templates.py` gera os moldes `docs/templates/combat-ground.png` e `combat-throw.png`: 3×2 células de 512 px sobre magenta, com a cabeça como silhueta verde onde cada quadro a coloca.
2. O Codex pinta o corpo da roupa em volta das cabeças verdes, com os prompts de `docs/combat-art-prompts/`: anexar o molde, a roupa em pé e as referências de pose do relatório (`output/pdf/ddtank-rig-imagens/04`, `05`, `06`). As referências do DDTank servem só de pose; a arte é nossa.
3. `python3 scripts/build-combat-atlas.py outfit-<id>` acha a cabeça verde de cada quadro, escala a prancha para a cabeça universal, apaga o verde, coloca o corpo na célula do atlas (cabeça no x do contrato, linha mais baixa no chão) e grava `public/assets/outfits/combat/outfit-<id>.png` e a altura medida da cabeça em `src/game/combatAtlas.json`. Avisos e erros em `test-results/combat/outfit-<id>/`.
4. `node scripts/verify-combat-frames.mjs` monta a prancha de todas as roupas × ações (`test-results/combat/combat-frames.png`) para mostrar ao usuário.

Roupa sem atlas continua no corpo deitado recortado antigo (`docs/prone-combat.md`). O Ticket de Cor e a cor do corpo se aplicam ao atlas inteiro pela mesma zona da roupa.

## Fantasias

A fantasia substitui as peças (como no DDTank) e já tem a prancha deitada (`-prone.png`). Para ficar de pé no arremesso ganha `-throw.png` (mesmos 6 quadros de `rise` a `settle`, cabeça própria sobre a silhueta verde do molde), registrada em `throw` no `COSTUMES` de `costumes.ts`; prompt `costume-throw.txt`.
