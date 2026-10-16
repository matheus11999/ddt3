# Atributos e dano — Brasa Arena

Dano e Armadura são atributos reais usados pelo servidor, além de Ataque, Defesa e Agilidade. O modelo separa dano base da arma, amplificação ofensiva e duas camadas de proteção, inspirado nessa distinção dos jogos de artilharia como DDTank. Os coeficientes abaixo são balanceamento próprio de Brasa; não representam uma reprodução verificada da fórmula proprietária de DDTank.

## Números compartilhados

`itemAttributes(item,level,composition)` retorna ataque, defesa, agilidade, dano e armadura. Somente a arma usa seu nível de fortalecimento: +8 de ataque por nível e dano base multiplicado por `1 + 0,035 × nível`, arredondado. `attributes(equipment)` soma esses valores e os bônus de composição uma única vez e serve tanto à interface quanto ao servidor.

O personagem começa com 80 de ataque, 30 de defesa, 50 de agilidade e 20 de armadura. A arma fornece dano base. Chapéu/roupa/bracelete podem acrescentar armadura; rosto e cabelo são visuais. Surfista prioriza agilidade e Executivo prioriza ataque/proteção. Vida = 1200 + 3 × defesa; vigor = 240 + piso(agilidade/30). Poder é um índice de comparação, não dano por tiro.

## Impacto autoritativo

Em `shared/combat.ts`:

```
dano bruto = dano base × (1 + ataque / 500)
             ÷ (1 + defesa do alvo / 1000)
             ÷ (1 + armadura do alvo / 600)
             × distância × multiplicador da salva × bônus de ferramentas
```

O servidor arredonda somente o resultado final, com mínimo 1 para impacto positivo. Fora da explosão não há dano. Dentro dela, o fator de distância decresce até 15%; o centro recebe 100%. Defesa e armadura reduzem o dano com retornos decrescentes, sem imunidade abrupta.

Salva dupla usa 90% por tiro; tripla 60%; Tridente 50% por projétil. As penalidades combinam multiplicativamente. Bônus 20/30/40/50% somam ao multiplicador base 1. Não há crítico aleatório novo nesta etapa. Trajetória, impacto, posse, vigor e dano continuam validados pelo servidor.

Tooltip mostra os atributos do item e diferenças em relação ao equipamento vestido; a ficha do personagem mostra os totais. Dano base não é uma promessa de dano final, pois alvo, distância e ferramentas alteram o resultado. A HUD de combate exibe força/ângulo/vigor, sem informações da arma.

## Progressão

Nível máximo 50, mantendo 300 EXP por nível. A barra de experiência fica completa no nível 50; recompensas posteriores não criam nível 51. Badges usam seis faixas: 1–10, 11–20, 21–29, 30–39, 40–49 e 50. Aura aparece desde 30, evolui para uma camada mais intensa e elaborada no 40 e culmina no efeito dourado máximo no 50. Isso é separado do círculo do personagem, que continua vinculado ao fortalecimento +5/+9/+12.

Composição aplica o melhor tier de cada atributo por equipamento. Trocar o item retira seus bônus dos totais; equipá-lo novamente os restaura. `equipment.compositions` é derivado do perfil bloqueado no servidor e não aceita pontos enviados pelo cliente.
