# Chefão Mundial (dragão)

Evento global: um dragão com uma vida só, dividida por todos os jogadores enquanto o evento está aberto. Não faz
parte da Central de Expedições. Especificação e referências do DDTank: `/mnt/project-files/chefao-mundial/`.
Prompts da arte: `docs/world-boss-art-prompts.md`.

## Regras (pedidas pelo matheus em 18/10)

- Com o evento ativo aparece na praça o botão com o rosto do dragão (`WorldBossButton`, canto superior direito, com a
  contagem regressiva). Ele abre a janela do evento: retrato, estado, vida global, texto e **Entrar**, e o ranking de
  dano em tabela (ouro, prata e bronze nos três primeiros; minha linha fixa embaixo quando estou fora do top 50).
- Entrar abre uma tentativa **solo** (quantas vezes quiser). O jogador causa dano até morrer ou sair; então volta
  para a praça com a janela aberta. **Sem recompensa e sem tela de resultado.**
- O evento termina quando o tempo acaba, quando o admin para ou quando a vida chega a 0. Depois a janela e o ranking
  ficam visíveis por 20 minutos (`WORLD_BOSS_RESULTS_MS`). Tentativas em andamento terminam com o dragão caindo
  (morto) ou indo embora (tempo/admin) e todos voltam para a janela.
- Tudo fica no Postgres (`server/worldBoss.ts`): um reinício do servidor não perde o evento, a vida nem o ranking.
  As tentativas em si não são salvas no estado ao vivo (`Game.savedState` as ignora).

## Servidor

- Tabelas: `world_boss_settings` (nome, vida padrão, agendas ligadas), `world_boss_schedules`,
  `world_boss_occurrences` (um índice parcial único garante só um evento ativo), `world_boss_damage` (livro de dano
  idempotente por evento, batalha, turno e jogador) e `world_boss_ranking`.
- O dano do jogador é somado durante o turno dele e gravado no fim do turno (e ao sair). A gravação trava a linha
  do evento, só diminui a vida e nunca passa de 0; repetir a mesma entrada não conta de novo. Se o banco falhar, a
  fila tenta de novo.
- `tick` a cada 1 s: fecha por tempo e abre as janelas das agendas (horário de Brasília, `repeat` none/daily).
- Cada tentativa é uma sala escondida `kind: 'world-boss'` (fora das listas de salas e sem espectadores). O dragão é
  um `Fighter` com `boss: 'dragon'`; os golpes dele são uma linha do tempo (`DragonAct`, `shared/worldBoss.ts`) que o
  servidor decide e todos os clientes desenham no mesmo tempo. Ele nunca repete a mesma família de golpe duas vezes
  seguidas e fica mais forte a cada rodada (`DRAGON_RAGE_PER_ROUND`).
- Golpes: entrada (sobe e ruge), garra que rompe o chão sob o jogador, agarrão (a pata sai do chão, levanta e esmaga), sopro de fogo e fogo varrendo o chão (o
  chão não queima). Tempos e dano em `DRAGON_ACTIONS`.

## Cliente

- `src/game/worldBoss/dragon.ts`: rig de partes pintadas (corpo, cabeça, mandíbula, pálpebra, garra aberta e fechada,
  em `public/assets/world-boss/`; o fogo é desenhado em código em `src/game/worldBoss/fire.ts`, com vida própria: acende, queima e apaga); respiração, piscar, recuo ao levar dano e cada golpe. Os pivôs
  ficam em `DRAGON_PARTS`/`DRAGON_RIG` (medir de novo se a arte mudar). Sem a arte o jogo desenha formas simples.
- Na batalha a barra do chefe substitui a lista de inimigos (`WorldBossBar`) e o relógio mostra "DRAGÃO" no turno dele.

## Painel admin (`/admin/eventos`)

Estado do evento, **Iniciar agora** (duração e vida), **Parar agora**, agendas (início em horário de Brasília,
duração, repetir todo dia, ligar/desligar), configurações (nome, vida padrão, agendas ligadas) e histórico. Tudo
auditado.

## Testes

`tests/worldBoss.test.ts` (no `npm test`), `npm run test:worldboss:integration` (Postgres real) e
`node scripts/smoke-world-boss.mjs` com o jogo rodando e `ADMIN_USERNAME`/`ADMIN_PASSWORD` (prévias em
`test-results/world-boss/`).
