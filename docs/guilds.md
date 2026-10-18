# Guildas

Pedido do matheus em 18/10/2026. Botão **Guilda** na praça (e no menu da sala) abre a janela da guilda.

## Regras

- **Fundar**: custa ouro (`GUILD_CREATE_COST` = 1.000), o fundador escolhe o nome (3 a 16 letras, único) e a guilda começa no **nível 0**.
- **Entrar**: o jogador pede para entrar pela lista de guildas; o dono aceita ou recusa em *Gerenciar*. Até 5 pedidos abertos por jogador. Vagas: `10 + 5 × nível`.
- **Riqueza**: moeda que só existe dentro da guilda. Vem das vitórias **GvG**: cada membro do time vencedor rende `GVG_CONTRIBUTION` (10) de Riqueza para a guilda e o mesmo valor de *contribuição* no seu registro. Conta uma vez por batalha (`guild_gvg`, chave = id da partida).
- **Nível e construções**: o dono gasta Riqueza para evoluir a guilda (até o nível 10) e as três construções. **Construção nunca passa do nível da guilda.** Custos em `GUILD_LEVEL_COSTS` e `BUILDING_LEVEL_COSTS` (`shared/guilds.ts`).
  - **Ferreiro da Guilda**: não é um ferreiro novo. Cada nível soma `SMITH_BONUS_PER_LEVEL` (2) pontos de chance de sucesso ao Fortalecer e à Composição de todos os membros (só sobre uma chance que já existe, até 100%). O botão Ferreiro da guilda abre o ferreiro normal, de qualquer lugar da praça.
  - **Loja da Guilda**: itens só para membros, pagos em ouro. Nível 1: **Colar da Guilda Nv. 1** (800 de ouro, +5% de Vida; `hpPercent` no catálogo, somado em `attributes`).
  - **Depósito da Guilda**: 10 espaços por nível (fechado no nível 0). Qualquer membro guarda itens não equipados e pedras; qualquer membro retira.
- **Sair**: o membro sai quando quiser; o dono que sai passa a guilda para o membro com mais contribuição; o último a sair encerra a guilda e recebe o que estava no depósito.

## GvG

- Botão **GvG** ao lado do **Início** na sala PvP. Só o líder liga, e só se todos da sala forem da mesma guilda; ninguém de fora entra numa sala GvG.
- Com GvG ligado, a busca só encontra outra sala GvG do **mesmo tamanho** e de **outra guilda**. Salas normais nunca encontram salas GvG.
- A partida guarda as duas guildas (`Match.gvg`, JSON, sobrevive a reinício como o resto da partida).

## Onde está

- `shared/guilds.ts`: regras, custos, comandos. `server/guilds.ts`: `GuildStore` (Postgres: `guilds`, `guild_members`, `guild_applications`, `guild_storage`, `guild_gvg`).
- `server/game.ts`: comandos `guild-*` e `room-gvg`, nome da guilda no `Seat.guild` (cards das salas PvP e de expedição), bônus do ferreiro, pareamento GvG e Riqueza no fim da partida.
- `src/components/Guild.tsx` (janela), `Arena.tsx` (botão GvG e nome da guilda no card), `Forge.tsx` (selo "+N% guilda" na barra de chance).
- Arte: `public/assets/ui/guild-shop.png`, `guild-smith.png`, `guild-storage.png` (construções) e `public/assets/items/necklace-guild-1.png` (colar). Sem a arte, a janela usa os botões da praça e o colar desenhado em código.

## Testes

- `npm test` (`tests/guilds.test.ts`): custos, nível das construções, colar +5% de Vida, bônus do ferreiro, nome no card, pareamento GvG e Riqueza.
- `npm run test:guilds:integration` (Postgres): fundar, pedir/aceitar, evoluir em ordem, loja, depósito, Riqueza uma vez por batalha, sair/encerrar.
- `node scripts/smoke-guilds.mjs` (jogo rodando + `DATABASE_URL`): fluxo completo no navegador, capturas em `test-results/guilds/`.
