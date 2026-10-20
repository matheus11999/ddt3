# Consumíveis de batalha: Enfurecer e Gelo

Pedido do matheus em 20/10/2026, a partir do pacote de referência `output/ddtank-consumables-reference` (pasta local, fora do repositório). Regras em `shared/ice.ts`, custos em `BOOSTS` (`shared/catalog.ts`), validação no servidor (`Game.boost`, `Game.fireIce`, `Game.applyImpact`, `Game.nextTurn`). Testes em `tests/consumables.test.ts`; prévia com `node scripts/preview-consumables.mjs` (precisa do jogo rodando, `BASE_URL`).

## Regras (iguais ao DDTank 4.1)

| Ferramenta | Tecla | Vigor | Delay | Efeito | Fonte |
| --- | --- | ---: | ---: | --- | --- |
| Enfurecer | 9 | 120 | 450 | +50 pontos na barra de POW na hora (0–100), pode repetir; recusado com a barra cheia ou o POW já armado | 10018, `AttackUpSpell` → `AddDander(100)` numa escala de 200 |
| Gelo | 0 | 150 | 700 | o disparo vira uma bomba de gelo: um projétil, sem dano, sem cratera, sem marca; congela os inimigos que tocar | 10015, `FrostSpell` → `SetBall(1)`, Ball1 `Radii 60`, `IceFronzeEffect(2)` |

- Enfurecer não é o bônus de dano +50% e não muda a força do lançamento. Usar o POW continua sendo outro clique.
- Gelo: uma vez por turno; não combina com +1, +2, Tridente, bônus de dano, POW nem mira assistida (combina com Enfurecer). Voa como o avião (Ball1 = Ball3) e para em corpos.
- Congelado (`Fighter.frozenTurns`): perde os próximos 2 turnos próprios (`ICE_FROZEN_TURNS = 3`, cada início de turno tira 1; em 0 descongela e joga). No PvP o turno perdido soma mais um Delay base, como o `PrepareSelfTurn` do DDTank. Monstros de expedição congelados ficam parados no turno dos monstros; o dragão do Chefão Mundial não congela.
- Congelado não toma dano: o primeiro ataque só quebra o gelo, e o resto daquele mesmo tiro também é gasto no gelo (`thawedBy`). Queda na base continua matando. Limitação: dano em área de pet ainda atinge quem está congelado.

## Arte e sons

- Arte original pintada pelo Codex (`codex exec`) sobre magenta, no estilo da barra de poderes e dos efeitos de arma do jogo; nenhum pixel do DDTank. Fontes em `public/assets/consumables/source/` (`icons.png`, `iceshot.png`, `frozen.png`), recorte com `py scripts/build-consumables-art.py` (cada quadro mantém a célula inteira, sem tremor):
  - `rage-icon.png`, `ice-icon.png` (256 px): botões da barra (o jogo escreve "POW +50" no Enfurecer) e ícone de 60×60 sobre a cabeça ao usar (AutoPropEffect em (−5, −140), some em 1,2 s).
  - `ice-projectile.png` (192 px): bola de gelo girada pela velocidade.
  - `ice-impact.png`: 7 quadros de 256 px, 80 ms cada.
  - `ice-block.png`: 3 quadros de 320 px (inteiro, rachado no último turno congelado, quebrando); cresce do chão em 320 ms, translúcido sobre o lutador.
- Sons do pacote de referência, como pedido: `activate.mp3` (039, ativação compartilhada, ao usar Enfurecer ou Gelo), `ice-fire.mp3` (023, lançamento da bola de gelo), `ice-impact.mp3` (093, impacto e gelo quebrando), em `public/assets/audio/consumables/`.
