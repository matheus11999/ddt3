# Power de combate

Power é um recurso separado da força da trajetória. A régua continua a disparar exatamente a força exibida quando Espaço ou o toque é solto; ativar Power não altera esse valor nem o fortalecimento persistido da arma.

## Regras autoritativas

- Cada participante começa com 0 de Power, até o máximo de 100. A carga atravessa os turnos da mesma partida.
- Dano efetivamente retirado de um inimigo gera `60 × dano / vida máxima do alvo` para quem acertou e `100 × dano / vida máxima própria` para quem recebeu. Não conta excesso além da vida restante, dano em aliado ou dano em si mesmo.
- Exemplo com 1.000 de vida: retirar 200 gera 12 para o atacante e 20 para o atingido. O servidor limita a carga em 100, mantendo frações; a interface mostra a parte inteira.
- O comando estrito `{type: 'power'}` só funciona no próprio turno, vivo, com carga completa e sem ativação anterior. Consome 100 imediatamente e prepara o próximo disparo.
- Passar, esgotar o turno ou morrer perde a ativação sem reembolso. Isso aparece na ajuda do botão. Ativar novamente não consome nada adicional. Uma nova partida zera a carga.
- Ao disparar Power, o servidor bloqueia ações e espera 1.400 ms antes de calcular dano, terreno e projéteis. Nesse intervalo, `Battle.powerCutIn` informa personagem e prazo. Saída/morte que encerra a batalha cancela o disparo pendente.
- O tiro recebe dano ×1,65, raio de dano ×1,15 e raio de destruição ×1,18. Combina com as ferramentas normais e suas penalidades. O terreno indestrutível permanece indestrutível. Todos esses coeficientes são **provisórios para balanceamento posterior**, em `shared/power.ts`.
- Bots também acumulam e ativam quando cheios. A ativação não concede moedas, não muda equipamentos nem contorna a validação de turno.

## Apresentação

Círculo metálico com o nome POWER, preenchimento progressivo e número legível. Cheio fica dourado, com luz e arcos giratórios; durante a própria vez oferece ATIVAR. Preparado mostra ATIVADO. O clique libera o foco para continuar a carga com Espaço; navegação por teclado preserva o foco.

O disparo abre uma faixa diagonal sobre o próprio cenário, personagem equipado ao centro, nome e POWER! em texto 3D. Respeita `prefers-reduced-motion`, sem tremor ou flashes de tela. O prazo usa o relógio do servidor, inclusive após reconexão durante a preparação.

As quatro famílias preservam seus projéteis próprios. Power acrescenta trilhas paralelas luminosas, núcleo ampliado, lançamento reforçado, ondas e raios de impacto na cor da família, além de uma camada sonora. Esses efeitos são temporários via `Shot.powered`/`Projectile.powered`; não simulam uma arma +12. Os resíduos de cada família continuam recortados no terreno real.

O retrato do HUD recebe luz discreta mesmo em +0; a evolução visual do equipamento continua a adicionar suas camadas próprias. Nenhuma aura foi acrescentada ao boneco dentro do mapa.

## Evidências

- `tests/power.test.ts`: seis casos para carga proporcional, limites, validação de turno, ativação duplicada, espera sem dano, disparo único, passagem/timeout, cancelamento por saída e comparação do dano/cratera contra um tiro normal +0.
- `npm run check`, `npm test`: 96 testes passaram após integração; `npm run build` passou.
- `npm run test:power:integration`: duas conexões WebSocket reais no mapa Fortaleza Celestial. Oito tiros normais acumularam 100 para ambos; o nono consumiu a carga, esperou o cut-in sem dano e transmitiu o tiro Power com projéteis reforçados.
- `scripts/inspect-power.mjs`: fixture explícita de componentes no navegador para carga parcial/completa, ativação, clique seguido de Espaço, apresentação/expiração do cut-in e movimento reduzido. Não representa uma partida PvP natural.
- Capturas em `test-results/power/charging.png`, `ready.png` e `cut-in.png`; relatório em `report.json`. Resultados temporários não são versionados.
