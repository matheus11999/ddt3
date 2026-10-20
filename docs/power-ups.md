# Power-ups de combate (perfil DDTank clássico)

Matemática e regras em `shared/powerUps.ts`; custos, Delay e textos em `BOOSTS` (`shared/catalog.ts`). O servidor valida cada ativação (`Game.boost`) e a barra de poderes usa as mesmas regras para apagar o que não pode ser usado. Testes em `tests/power-ups.test.ts`.

## Efeitos

| Power-up | Vigor | Delay | Efeito |
| --- | ---: | ---: | --- |
| +1 | 110 | 500 | 2 disparos seguidos, 90% do dano cada |
| +2 | 110 | 600 | 3 disparos seguidos, 60% do dano cada |
| Tridente | 110 | 600 | 3 projéteis ao mesmo tempo (−5°, 0°, +5°), 50% do dano cada |
| +50% / +40% / +30% / +20% / +10% | 85 / 80 / 70 / 55 / 50 | 400 / 340 / 200 / 150 / 70 | soma 0,50 / 0,40 / 0,30 / 0,20 / 0,10 ao bônus |
| Enfurecer / Gelo | 120 / 150 | 450 / 700 | +50 de POW na hora / disparo vira bomba de gelo que congela 2 turnos (`docs/consumables.md`) |

```text
MultiplicadorFinal = MultiplicadorModo × (1 + SomaDosBônus)
DanoDoImpacto      = arredondar(DanoNormalDoImpacto × MultiplicadorFinal)
CustoTotal         = soma do Vigor de cada power-up escolhido
```

Os bônus somam: +50% e +20% dão ×1,70 (nunca ×1,80). O multiplicador entra no `damageAtImpact` como `shotMultiplier` (modo) e `boostMultiplier` (bônus), junto com Ataque, Defesa, Sorte, Armadura, exposição à explosão, crítico e POW; o arredondamento é um só, no fim de cada impacto. Nada disso muda os atributos do personagem, e os power-ups acabam quando o próximo turno do jogador começa.

Exemplos com 1.000 de dano por impacto: +1 com 50% e 20% = 1.530 por disparo (3.060 nos dois); +2 com 50% e 20% = 1.020 (3.060 nos três); Tridente com 50% e 20% = 850 (2.550 nos três); só 50% = 1.500; 50% + 50% + 40% = 2.400.

## Combinações (`POWER_UP_RULES`)

- +1 e +2 se repetem enquanto houver Vigor (pedido do matheus, 19/10): cada uso soma seus disparos extras (+1 → 1, +2 → 2) e as penalidades se multiplicam (+1 duas vezes = 3 disparos a 0,90 × 0,90 = 0,81; +1 com +2 = 4 disparos a 0,54). Volte ao limite antigo com `repeatSequential:false`.
- Só o Tridente fica limitado a uma vez por turno; combina com +1 ou +2 (regra antiga do projeto): cada disparo seguido sai em leque e as penalidades se multiplicam (+2 com Tridente = 9 projéteis a 0,60 × 0,50 = 0,30 cada). Escolha do Brasa, sem valor histórico verificado; desligue com `tridentWithSequential:false`.
- Bônus de dano se repetem enquanto houver Vigor.
- POW e Tridente seguem a regra de cada arma (`powTrident` em `shared/weaponKit.ts`); o Quebra-Tijolos não combina POW com Tridente.
- Voo não combina com power-ups.

## Disparos e turno

Todos os disparos de uma sequência são uma ação só: o servidor simula +1/+2 em ordem, e cada disparo vê a cratera, as quedas e as mortes dos anteriores; cada projétil tem trajetória, colisão, sorteio de crítico e dano próprios. Cada impacto é aplicado uma vez só (`shot.impacted`). O turno termina depois do último impacto e da pausa `TURN_GAP_MS`. O Delay do tiro (tempo usado + `shotDelay` da arma) é somado uma vez, não por projétil; o Delay de cada power-up é somado uma vez por ativação válida (repetir soma de novo; comando recusado não gasta Vigor nem soma Delay). Delay dos power-ups conferido na fonte do DDTank 4.1 (19/10); é penalidade na ordem dos turnos, não pausa entre projéteis (essa é `VOLLEY_CADENCE_MS`).

A fila de poderes usados no meio da tela também mostra a habilidade de pet ativada no turno (`BattlePetSkill.usedTurn`).

Power Max não existe no projeto.
