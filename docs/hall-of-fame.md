# Hall da Fama

Pedido do matheus em 18/10/2026. Botão **Hall da Fama** no menu da praça (troféu do pódio). Tudo é calculado no servidor; o cliente só pede páginas (`hall-board`, `hall-profile`, `hall-guild`, `hall-legends`) e nunca envia resultado.

## Categorias

- **Poder**: o Poder (FC) de sempre, `attributes(equipamento, nível).power`. Não há cálculo novo.
- **PvP**: Diário, Semanal e Geral. Ordem: vitórias, adversários distintos vencidos, menos derrotas, quem chegou primeiro ao total, id. Mostra derrotas, taxa e sequência atual.
- **Guildas**: Mais poderosas (soma do Poder dos `guildPowerMembers` = 10 membros mais fortes, então tamanho sozinho não vence), Vitórias PvP semanal/geral (soma dos `guildPvpContributors` = 20 maiores contribuidores, vitória conta para a guilda em que o jogador estava na hora), Guerras GvG e Nível (nível e Riqueza).
- **Evolução**: nível e EXP.
- **Conquistas**: 18 conquistas permanentes vindas de dados reais (`ACHIEVEMENTS` em `shared/hall.ts`): vitórias PvP, nível, Poder, forja, guilda, títulos. Pontos somados.
- **Lendas**: histórico dos campeões (dia, semana, guilda da semana) com a foto oficial de cada período e contagem de títulos.

## Tela (pedido do matheus, 18/10 à noite)

Tela cheia como no DDTank, sem a moldura de madeira. À esquerda, o **palco** pintado pelo Codex (`public/assets/ui/hall-stage.webp`, placa `hall-title-plate.webp`; o jogo escreve "Hall da Fama" e "Nº lugar" em dourado 3D) com quem está selecionado no ranking em pé sobre o tablado e a aura; embaixo, a placa com nível, nome, número, guilda e o botão Ver equipamento; depois o **chat** do jogo. À direita, o ranking escuro: Jogadores / Guildas / Lendas, categorias (Poder, Nível, Conquistas, PvP; nas guildas Poder, PvP, GvG, Nível), Diário/Semanal/Total, 10 linhas por página com placas Nº1/Nº2/Nº3, Anterior/Próximo e "Meu ranking". Clique numa linha põe a pessoa no palco. O palco ocupa cerca de 30% da largura e não há janela de perfil (Ver conquistas / Ver guilda saíram a pedido do matheus, 18/10).

## O que conta

- Conta só partida PvP terminada entre duas salas de pessoas (`kind = 'pvp'`) e GvG. Treino e partida com bot ficam fora, a não ser que o admin ligue "Contar treino e batalhas contra bots" (só para jogadores, nunca para guildas). O pódio da praça usa o PvP diário do Hall, então segue a mesma regra.
- Quem abandona: derrota se o time perdeu, nada se o time venceu.
- A contagem oficial começa no merge (partidas antigas não são importadas).
- Registro dentro da mesma transação do `finishMatch`; `pvp_matches` tem o id da partida como chave, então o mesmo resultado nunca conta duas vezes.

## Períodos

- Fuso `America/Sao_Paulo` (configurável). Dia de 00:00 a 00:00, semana de segunda 00:00 a segunda 00:00, guardados em UTC como intervalos semiabertos `[início, fim)`. A batalha entra no período do momento em que terminou (`Match.finishedAt`).
- O fechamento espera `closeGraceSeconds` (300 s) depois da virada para receber resultados atrasados, trava o período (`FOR UPDATE SKIP LOCKED`) e grava a foto oficial (`hall_snapshots`), títulos e recompensas numa transação. Reiniciar no meio não duplica nada. Resultado que chega depois do fechamento não altera o período oficial.

## Recompensas

Configuráveis por faixa de posição (ouro, cupons; Riqueza para guilda), entregues pelo **Correio** (remetente "Hall da Fama") uma vez só por período e posição (`hall_rewards`). Nunca dão Poder. Padrão: campeão diário 150/100/60 de ouro; semanal 1000+30 cupons, 600+20, 400+10, 4º–10º 150 de ouro; guilda da semana sem recompensa até o admin definir.

## Antifraude

O servidor não bloqueia ninguém sozinho; ele cria alertas para o admin revisar: mesmos jogadores muitas vezes no dia, batalhas curtas demais, abandonos repetidos, vitórias demais em uma hora. No `/admin/hall` o admin anula uma batalha (com motivo, auditoria em `hall_audit`) ou a restaura, e os rankings abertos são recontados a partir dos eventos. Períodos já fechados mantêm a foto oficial.

## Admin (`/admin/hall`)

Abas Configuração (categorias, top, fuso, membros/contribuidores da guilda, espera do fechamento, treino, limites dos alertas, recompensas), Alertas, Batalhas (anular/restaurar), Encerramentos (histórico e auditoria) e o botão Recontar rankings.

## Banco

Criado por `HallStore.init` (`server/hall.ts`), todas com `scope` para vários servidores no futuro: `hall_config`, `hall_audit`, `player_standings` (+ fila `standings_dirty` alimentada por gatilho em `players` e `guild_members`), `player_achievements`, `pvp_matches`, `pvp_results`, `pvp_totals`, `pvp_beaten`, `guild_pvp_totals`, `hall_periods`, `hall_snapshots`, `hall_titles`, `hall_rewards`, `hall_alerts`.

## Testes

- `tests/hall.test.ts` (no `npm test`): períodos, horário de verão, ordem, guilda, configuração, conquistas, comandos.
- `npm run test:hall:integration` (Postgres real): os 20 cenários do pedido mais recontagem igual à contagem incremental.
- `npx tsx scripts/preview-hall.ts`: grava dados de teste no banco local e tira capturas em `test-results/hall/` (só em banco de desenvolvimento).

## Ainda não existe

- VIP no servidor, títulos e molduras como cosméticos (o título fica registrado e aparece como coroa e contador), ranking semanal de EXP.
