# Partidas que sobrevivem a reinício e queda

Salas e partidas (PvP, treino e expedições) continuam depois que o servidor reinicia, cai ou o jogador perde a conexão.

## Como funciona

- O estado vivo fica na memória do servidor (`server/game.ts`). `Game.savedState()` tira uma cópia: salas, quem está em cada sala e cada partida.
- `server/liveState.ts` grava essa cópia em campos: `meta` (salas, assentos, relógio), `m:<id>` (uma partida) e `t:<id>` (o terreno da partida, comprimido). Só os campos que mudaram são gravados.
  - **Redis** (`brasa:live:v1`, hash) a cada 0,5 s: cópia quente.
  - **PostgreSQL** (tabela `live_state`) a cada 3 s: cópia durável, sobrevive a reinício do Docker inteiro (o Redis do compose não grava em disco).
  - No desligamento normal (SIGTERM, `docker compose restart`) as duas cópias são gravadas antes de sair.
- Ao subir, o servidor carrega a cópia mais nova das duas (`LiveState.restore`) e recria salas e partidas. Todos voltam como desconectados e mantêm o lugar; quando o jogador reconecta (o cliente tenta sozinho), recebe a sala e a partida com o terreno.

## Regras

- **Nunca no meio de um tiro.** Uma partida em `resolving` (projétil voando, turno dos monstros) não é gravada: a cópia fica no começo daquele turno. Se o servidor cair durante um tiro, o turno volta para o mesmo jogador, com o terreno e a vida de antes do tiro. Assim nada fica pela metade (dano aplicado sem cratera etc.).
- O relógio continua de onde parou: o turno volta com o tempo que faltava, no mínimo 15 s; prazos das cartas de recompensa e a introdução da expedição são empurrados pelo tempo em que o servidor ficou fora.
- Recompensas não duplicam: `finishMatch`/`finishExpedition` usam o id da partida como chave única na tabela `matches`.
- Quem cai no meio de uma partida mantém o lugar enquanto ela durar (até 5 min fora; os turnos dele passam pelo tempo). Fora de partida, 30 s (2 min logo depois de um reinício). Buscas na fila são canceladas no reinício.

## Testes

- `npm test` (`tests/live-state.test.ts`): restaurar partida, tiro em voo, cópia mais nova, queda longa.
- `npm run test:restart:integration`: sobe o servidor de verdade (precisa de `DATABASE_URL` e `REDIS_URL`), começa um treino, derruba com SIGTERM e com SIGKILL e confere que o jogador volta para a mesma partida com a mesma vida.

## Escala

Um servidor atende todas as partidas (shard 1). Gravar só o que mudou mantém o custo baixo: uma partida parada não grava nada, o terreno só é regravado quando muda de turno. Para vários servidores no futuro, cada um usaria sua própria chave (`brasa:live:<shard>`) e o jogador seria levado ao shard da sua partida.
