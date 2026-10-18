# Power-ups de combate (perfil DDTank clássico)

Matemática e regras em `shared/powerUps.ts`; custos, Delay e textos em `BOOSTS` (`shared/catalog.ts`). O servidor valida cada ativação (`Game.boost`) e a barra de poderes usa as mesmas regras para apagar o que não pode ser usado. Testes em `tests/power-ups.test.ts`.

## Efeitos

| Power-up | Vigor | Delay | Efeito |
| --- | ---: | ---: | --- |
| +1 | 110 | 110 | 2 disparos seguidos, 90% do dano cada |
| +2 | 110 | 110 | 3 disparos seguidos, 60% do dano cada |
| Tridente | 110 | 110 | 3 projéteis ao mesmo tempo, 50% do dano cada |
| +50% / +40% / +30% / +20% / +10% | 85 / 80 / 70 / 55 / 50 | igual ao Vigor | soma 0,50 / 0,40 / 0,30 / 0,20 / 0,10 ao bônus |

```text
MultiplicadorFinal = MultiplicadorModo × (1 + SomaDosBônus)
DanoDoImpacto      = arredondar(DanoNormalDoImpacto × MultiplicadorFinal)
CustoTotal         = soma do Vigor de cada power-up escolhido
```

Os bônus somam: +50% e +20% dão ×1,70 (nunca ×1,80). O multiplicador entra no `damageAtImpact` como `shotMultiplier` (modo) e `boostMultiplier` (bônus), junto com Ataque, Defesa, Sorte, Armadura, exposição à explosão, crítico e POW; o arredondamento é um só, no fim de cada impacto. Nada disso muda os atributos do personagem, e os power-ups acabam quando o próximo turno do jogador começa.

Exemplos com 1.000 de dano por impacto: +1 com 50% e 20% = 1.530 por disparo (3.060 nos dois); +2 com 50% e 20% = 1.020 (3.060 nos três); Tridente com 50% e 20% = 850 (2.550 nos três); só 50% = 1.500; 50% + 50% + 40% = 2.400.

## Combinações (`POWER_UP_RULES`)

- +1 e +2 são um modo de disparos seguidos: só um deles, uma vez por turno (+1 duas vezes seria um +2 mais forte).
- Tridente uma vez por turno; combina com +1 ou +2 (regra antiga do projeto): cada disparo seguido sai em leque e as penalidades se multiplicam (+2 com Tridente = 9 projéteis a 0,60 × 0,50 = 0,30 cada). Escolha do Brasa, sem valor histórico verificado; desligue com `tridentWithSequential:false`.
- Bônus de dano se repetem enquanto houver Vigor.
- POW e Tridente seguem a regra de cada arma (`powTrident` em `shared/weaponKit.ts`); o Quebra-Tijolos não combina POW com Tridente.
- Voo não combina com power-ups.

## Disparos e turno

Todos os disparos de uma sequência são uma ação só: o servidor simula +1/+2 em ordem, e cada disparo vê a cratera, as quedas e as mortes dos anteriores; cada projétil tem trajetória, colisão, sorteio de crítico e dano próprios. Cada impacto é aplicado uma vez só (`shot.impacted`). O turno termina depois do último impacto e da pausa `TURN_GAP_MS`. O Delay do tiro (tempo usado + `shotDelay` da arma) é somado uma vez, não por projétil; o Delay de cada power-up é somado na ativação.

Power Max não existe no projeto.
