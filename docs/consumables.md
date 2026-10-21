# Consumíveis de batalha: Enfurecer e Gelo

Pedido do matheus em 20/10/2026, a partir do pacote de referência `output/ddtank-consumables-reference` (pasta local, fora do repositório). Regras em `shared/ice.ts`, custos em `BOOSTS` (`shared/catalog.ts`), validação no servidor (`Game.boost`, `Game.fireIce`, `Game.applyImpact`, `Game.nextTurn`). Testes em `tests/consumables.test.ts`; prévia com `node scripts/preview-consumables.mjs` (precisa do jogo rodando, `BASE_URL`).

## Itens do preparo (21/10, pedido do matheus)

Enfurecer e Gelo saíram da barra de poderes: agora são **itens escolhidos na sala**, em "Minhas ferramentas", junto de Cura, Mira assistida e Invisibilidade (3 espaços, 5 opções; `ABILITY_IDS`/`ABILITIES` em `shared/abilities.ts`). Cada um tem **1 uso por partida** (`uses`, número provisório), não gasta Vigor e mantém o Delay (450 e 700). Na batalha ficam na bandeja de habilidades; as teclas 9 e 0 ainda usam. O servidor arma o mesmo efeito de antes pelo comando `ability` (`Game.useAbility` → `Game.boost(f,id,true)`) e recusa o comando `boost` para eles. As regras de combinação abaixo continuam iguais; só a coluna de Vigor deixou de valer.

## Regras (iguais ao DDTank 4.1)

| Ferramenta | Tecla | Vigor | Delay | Efeito | Fonte |
| --- | --- | ---: | ---: | --- | --- |
| Enfurecer | 9 | 120 | 450 | +100 pontos de raiva na hora (escala 0–200, metade da barra), pode repetir; recusado com a barra cheia ou o POW já armado | 10018, `AttackUpSpell` → `AddDander(100)` |
| Gelo | 0 | 150 | 700 | o disparo vira uma bomba de gelo: um projétil, sem dano, sem cratera, sem marca; congela os inimigos que tocar | 10015, `FrostSpell` → `SetBall(1)`, Ball1 `Radii 60`, `IceFronzeEffect(2)` |

- Enfurecer não é o bônus de dano +50% e não muda a força do lançamento. Usar o POW continua sendo outro clique.
- Gelo: uma vez por turno; não combina com +1, +2, Tridente, bônus de dano, POW nem mira assistida (combina com Enfurecer). Voa como o avião (Ball1 = Ball3) e para em corpos.
- Congelado (`Fighter.frozenTurns`): perde os próximos 2 turnos próprios (`ICE_FROZEN_TURNS = 3`, cada início de turno tira 1; em 0 descongela e joga). No PvP o turno perdido soma mais um Delay base, como o `PrepareSelfTurn` do DDTank. Monstros de expedição congelados ficam parados no turno dos monstros; o dragão do Chefão Mundial não congela.
- Congelado não toma dano: o primeiro projétil que acerta só quebra o gelo; os próximos, mesmo do mesmo turno, já causam dano (pedido do matheus em 20/10). Queda na base continua matando. Limitação: dano em área de pet ainda atinge quem está congelado.

## Arte e sons

- Arte original pintada pelo Codex (`codex exec`) sobre magenta, no estilo da barra de poderes e dos efeitos de arma do jogo; nenhum pixel do DDTank. Fontes em `public/assets/consumables/source/` (`icons.png`, `iceshot.png`, `frozen.png`), recorte com `py scripts/build-consumables-art.py` (cada quadro mantém a célula inteira, sem tremor):
  - `rage-icon.png`, `ice-icon.png` (256 px): botões da barra (o jogo escreve "POW +50" no Enfurecer) e ícone sobre a cabeça ao usar (ver "Efeito ao usar").
  - `ice-projectile.png` (192 px): bola de gelo girada pela velocidade.
  - `ice-impact.png`: 7 quadros de 256 px, 80 ms cada.
  - `ice-block.png`: 3 quadros de 320 px (inteiro, rachado no último turno congelado, quebrando); cresce do chão em 320 ms, desenhado com 180 × 130 px e opacidade 0,46 para o lutador aparecer dentro (pedidos do matheus em 20/10: o de 124 px ficou pequeno, o de 190 px alto demais e opaco).
- Sons do pacote de referência: `ice-fire.mp3` (023, lançamento da bola de gelo), `ice-impact.mp3` (093, impacto e gelo quebrando), em `public/assets/audio/consumables/`. Ao usar Enfurecer ou Gelo toca o som padrão das ferramentas (o 039 da referência saiu: o matheus achou feio).

## Efeito ao usar (21/10)

Todo item ou poder usado na batalha (+1, +2, Tridente, bônus de dano, Enfurecer, Gelo, Cura, Mira e Invisibilidade) toca o mesmo efeito no lutador, recriado a partir do estudo do `ghostPcikPropAsset` + `AutoPropEffect` do DDTank (nenhuma arte copiada), em `drawItemUse` de `src/game/consumableEffects.ts`, 2,2 s no total:

- 0–420 ms: clarão quente pequeno no corpo; 100–760 ms: 7 pontos dourados se espalham; 140–520 ms: um brilho sobe do corpo até o lugar do ícone.
- A partir de 460 ms: o ícone do item (o mesmo da barra, com o número desenhado pelo jogo; Cura, Mira e Invisibilidade usam `public/assets/abilities/`) aparece com um halo dourado de raios suaves (pintado uma vez num canvas), respira e no fim o halo abre e some.
- O ícone fica 192 px acima dos pés e é desenhado depois do nome, da vida e da seta da vez, para nunca ficar coberto.
- Gesto do boneco (a parte "somente o boneco" da referência, poses 13→14→15→14 por 2,08 s): sem pose pintada para isso, o corpo afunda em três passos pequenos a cada 83 ms com o rosto de esforço (`itemGesture`); não roda andando, levando dano ou disparando.
- Sem som próprio: continua o som padrão das ferramentas.
- Prévia: `node scripts/preview-item-use.mjs` (quadros e vídeo `item-use.webm` em `test-results/item-use/`).
