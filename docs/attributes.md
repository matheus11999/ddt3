# Matemática dos atributos, fortalecimento e Delay

Perfil matemático do Brasa Arena desde 18/10/2026, conferido no código público do DDTank 3.0 (`Player.cs`, `Living.cs`, `TurnedLiving.cs`, `BaseGame.cs`, `PVPGame.cs` de geniushuai/DDTank-3.0) e do DDTank 4.1 (`Living.cs` de tungthit/full_client_server_Gun). As fórmulas ficam em `shared/stats.ts`; a soma dos equipamentos em `attributes()` de `shared/catalog.ts`; o dano em `shared/combat.ts`; a ordem dos turnos em `shared/turnDelay.ts`. Nenhuma outra parte do jogo calcula esses números.

## Atributos do personagem

`attributes(equipamento, nível)` soma a base do personagem (`CHARACTER_BASE`: Ataque 80, Defesa 30, Agilidade 50, Sorte 20, Armadura 20) e cada item vestido com seu fortalecimento e sua composição. Do total saem:

```text
Vida  = piso((950 + Nível×50 + BônusVidaNível + piso(Defesa/10)) × MultiplicadorVida)     MultiplicadorVida = 1
BônusVidaNível = Σ (Nível − i) × (i + 20) para i = 10, 20 … 60 com Nível > i
Vigor = 240 + piso(Agilidade/30)
Delay base = 1600 − piso(1200×Agilidade/(Agilidade+1200)) + piso(Ataque/10)
```

Poder = arredondar(Ataque×6 + Defesa×4 + Agilidade×3 + Sorte×3 + Dano×3 + Armadura×2) + truncar(Vida × 0,95). A parte da Vida é a do DDTank 4.1 (`GamePlayer.UpdateFightPower`: hp × 0,95); a soma dos outros atributos é a do Brasa.

As divisões inteiras repetem o código C# (`int`). A Vida é calculada no início de cada partida com o nível do jogador; a cura nunca passa do máximo (`clampHp`).

## Fortalecimento +0 a +15

| Equipamento | Atributo principal | Regra |
| --- | --- | --- |
| Arma | Dano | arredondar(Dano original × 1,10^nível) |
| Roupa, chapéu | Armadura | arredondar(Armadura original × 1,10^nível) |

O multiplicador é exato (não arredondado a cada nível) e sempre parte do valor do catálogo. +13 a +15 são extensão do Brasa à tabela clássica. Exemplos: Dano 200 → 322 (+5), 519 (+10), 628 (+12), 835 (+15); Armadura 100 → 161, 259, 314, 418; Armadura 90 → 145, 233, 282, 376.

Ataque, Defesa, Agilidade e Sorte **da arma** só mudam nos marcos: até +9 ficam no original; +10 e +11 = truncar(original × 1,2); +12 a +15 = truncar(valor do +10 × 1,3). 100 → 120 → 156; 40 → 48 → 62. Roupas e chapéus não têm marcos. A composição é somada depois, sem multiplicar.

O Ferreiro fortalece arma, roupa e chapéu (`canStrengthen` em `shared/catalog.ts`), com as mesmas pedras, chances e custos. O nível do chapéu e da roupa vestidos vai em `Equipment.slotUpgrades` (derivado no servidor de `Profile.upgrades`, como `Equipment.upgrade` para a arma).

## Dano

```text
Ofensivo   = Dano × (1 + Ataque/1000)
RedArmadura = 0,95 × A / (500 + A),   A = max(0, Armadura do alvo − 3 × nível do atacante)
RedDefesa   = 0,95 × D / (600 + D),   D = max(0, Defesa do alvo − Sorte do atacante)
RedTotal    = 1 − (1 − RedDefesa) × (1 − RedArmadura)
Dano        = Ofensivo × (1 − RedTotal) × exposição × multiplicador por projétil × ferramentas × Power
Crítico     = Dano × (1 + 0,5 + Sorte × 0,00015)
```

Arredondado uma vez no fim, sem mínimo de 1 (regra antiga do projeto). Monstros usam o próprio ataque como Dano, sem Ataque nem Sorte, com o nível do monstro; a resistência `toughness` dos monstros continua depois.

## Crítico

Chance = 45 × Sorte / (800 + Sorte) por cento (DDTank 4.1), sorteada no servidor por alvo. `CRITICAL_ROLL_MODE` em `shared/stats.ts`: `normalized` (padrão, 0% nunca critica) ou `legacy` (o original `chance >= Random.Next(100)`, em que 0% ainda critica 1 vez em 100).

## Delay e ordem dos turnos (PvP)

Cada lutador tem `Fighter.delay`. No início todos têm o Delay base. A cada turno:

1. joga o lutador vivo com menor Delay; empate vai para o próximo depois de quem jogou, na ordem da sala;
2. o Delay dele é subtraído de todos (ele fica com 0; os outros mantêm a distância);
3. ele recebe o próprio Delay base (uma vez por turno);
4. atirar soma `segundos usados × 20` (até 30 s) + `shotDelay` da arma; passar soma 100; ferramentas somam o `delay` delas; tempo esgotado não soma nada.

Quem continua com menor Delay joga de novo (turnos seguidos). Não há sorteio de turno extra.

Valores de Delay das ações (escolha de balanceamento do Brasa, sem valor histórico comprovado; ajustáveis):

| Ação | Delay |
| --- | --- |
| Tiro do Quebra-Tijolos (`shotDelay` em `WEAPONS`) | 150 + segundos × 20 |
| Passar o turno | 100 |
| +1, +2, Tridente (`BOOSTS`) | 110 cada |
| Dano +50% / +40% / +30% / +20% / +10% | 85 / 80 / 70 / 55 / 50 (igual ao Vigor gasto) |
| Cura / Míssil teleguiado / Invisibilidade (`ABILITIES`) | 150 / 100 / 150 |

Expedições continuam com o turno da instância (`shared/instanceTurn.ts`): cada aventureiro uma vez por rodada, por Agilidade, e os monstros juntos.
