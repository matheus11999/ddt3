# Balística do tiro (DDTank 4.1)

Desde 19/10/2026 (pedido do matheus) o voo dos tiros segue as fórmulas do DDTank 4.1 lidas nas fontes do cliente AS3 e do servidor C# (`Living.cs`, `BombObject.cs`, `EulerVector.cs`, `SimpleBomb.cs`, `BallList.xml`). O código está em `shared/physics.ts` (`volley`, `ballMotion`) e vale para tudo que voa: tiro, +1/+2/Tridente, POW, mira assistida, avião de papel, bots, a flecha da rainha e a prévia.

## Fórmulas

- Régua 0–100 → força de lançamento `força × 20` (0–2000, `FORCE_PER_POWER`).
- Velocidade inicial: `vx = trunc(F·cos θ)·lado`, `vy = −trunc(F·sin θ)` (truncar para zero, como o C#).
- Acelerações por segundo, com o perfil dos mapas comuns (`MAP_PHYSICS` peso 10, arrasto 2) e a bola comum (`COMMON_BALL`: massa 10, peso 70, vento 240, arrasto 1; tijolo 381 e bumerangue 461 voam igual):
  - `ax = 24·vento − 0,2·vx`
  - `ay = 700 − 0,2·vy`
- Passo fixo de 0,04 s, Euler semi-implícito (velocidade antes da posição), estado em float32 (`Math.fround`). Cada projétil roda o próprio relógio a partir do lançamento; dentro de um passo ele anda em linha reta, e a colisão é varrida nesse segmento.
- Arma nova com outra bola: campo `ball` em `Weapon` (`shared/catalog.ts`).
- Os pontos da trajetória continuam amostrados a 60 por segundo para a tela; não há mais o fator de apresentação 1,18: o tempo de voo mostrado é o tempo físico.

Vetor de referência (sem terreno, força 50, 45°, 1 s = 25 passos): vento −3/0/+3 → x 602,8 / 638,0 / 673,1, y −296,2 (`tests/ballistics.test.ts`).

## Ângulo e vento (já eram iguais)

- O Brasa guarda o ângulo efetivo (`aimAngle`, já com a inclinação do chão somada, `shared/aim.ts`); é o `displayAngle` do DDTank. A conversão para velocidade equivale ao `physicalAngle` (`−θ` à direita, `θ − 180` à esquerda), sem somar a inclinação outra vez.
- Limites da arma relativos ao chão: Quebra-Tijolos 20–65°, Bumerangue 15–65°.
- Vento: número do mundo (positivo empurra para a direita), nunca multiplicado pelo lado; sorteado pelo servidor a cada turno e fixo no voo.

## Régua (`shared/forceBar.ts`)

Como o `EnergyView`: segurando, a régua sobe 1 ponto (20 de força) a cada 40 ms, de 1 a 100 em 4 s, depois desce; soltar dispara o valor pintado; segurar até zero passa a vez. O relógio é explícito (não por quadro), então a régua anda igual em 60 e 144 Hz. Espaço e toque na régua, sem botões novos; blur, troca de turno e janelas cancelam sem disparar.

Tempo do turno: se o relógio zerar com a régua já sendo segurada, o servidor mantém o turno até o disparo (soltar) ou até `CHARGE_HOLD_MS` = 9 s desde o início da carga (ciclo inteiro de 8 s + 1 s de rede). Nesse tempo extra só valem `aim` (a régua continua, sem começar nem largar a carga), `fire` e `pass`; andar, ferramentas e poderes já não. Carga começada depois do tempo não segura nada.

## Adaptações que continuam do Brasa

- Corte global do ângulo em 5–90° (o DDTank só limita pela arma).
- Origem do tiro fixa: 27 px à frente e 40 px acima dos pés (no DDTank é o ponto (30,−20) do corpo transformado pela pose).
- Colisão por disco varrido do raio do projétil (o DDTank usa caixa 6×6 a passos de 3 px).
- Vento sorteado uniforme de −3,5 a +3,5, em décimos, todo turno (a política do DDTank não foi auditada).
- Cacos do tijolo (`fragments`) não são bola do DDTank: sem arrasto, gravidade própria e metade do vento.
- Mira assistida: perseguição pura que ignora vento e gravidade, aplicada a cada passo de 0,04 s.

## Antes e depois (chão plano, mesma altura)

| Tiro | Antes | Agora |
|---|---|---|
| 45°, força 25 | 176 px / 0,86 s | 307 px / 0,96 s |
| 45°, força 50 | 702 px / 1,72 s | 1103 px / 1,88 s |
| 45°, força 100 | 2795 px / 3,42 s | 3582 px / 3,56 s |
| força 50, 20° / 65° | 453 / 535 px | 786 / 790 px |
| vento ±3, força 50 | ±6 % | ±10 % |
| força para 1000 px (20°/45°/65°) | 75 / 60 / 69 | 57 / 48 / 58 |
| régua | 5→100 em 2,6 s e para | 1→100 em 4 s, desce, zero passa a vez |
