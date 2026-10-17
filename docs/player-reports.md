# Informações do jogador e denúncias

O botão direito sobre outro jogador abre o menu do jogo com **Ver informações** e **Denunciar**. Funciona no nome do chat, nos jogadores andando na praça e no pódio, na lista de online do Salão PvP, nos cards da sala PvP e nos retratos do topo da batalha. Em bots e no próprio personagem aparece só "Ver informações" (bot não pode ser denunciado).

## Ver informações

- Janela só de leitura no mesmo layout do lado esquerdo da mochila: nível, nome e título sobre o boneco com a aura (sem vitórias, partidas ou "online"), os 13 slots, Poder (o gearscore) e os oito atributos. Ainda não há sistema de títulos: o título mostra Aventureiro, Aventureira ou Bot do jogo.
- Passar o mouse num item mostra o mesmo `InventoryTooltip` da mochila (no celular, toque no item).
- O servidor manda só o que está vestido (`PlayerInfo` em `shared/reports.ts`): nunca mochila, moedas ou pedras. Funciona com o jogador offline (pódio).

## Denunciar

- Motivos prontos (`REPORT_REASONS`) e um texto opcional de até 300 caracteres.
- O servidor guarda, em memória, as mensagens que cada jogador escreveu no chat (mundo e sala) nos últimos 30 minutos e anexa as do denunciado à denúncia. Linhas mais velhas são apagadas a cada minuto; reiniciar o servidor zera esse histórico.
- Limites: 5 denúncias por hora por jogador e uma por alvo a cada 30 minutos (`server/reports.ts`).
- Tabela `player_reports` no Postgres, criada sozinha ao subir o servidor.

## Painel do administrador

- `/admin/denuncias`: abas Abertas, Resolvidas, Descartadas e Todas; cada denúncia abre ao lado com motivo, quem denunciou, onde (chat, praça, batalha…), o texto, o chat do denunciado com horário e canal, e as outras denúncias contra o mesmo jogador.
- O admin escreve uma anotação e marca como resolvida ou descartada (e pode reabrir). Fica no registro de atividades.
- A Visão geral mostra o número de denúncias abertas.

## Testes

- `tests/reports.test.ts` (servidor) e `npm run test:reports:browser` (jogo e painel; o painel roda com `ADMIN_USERNAME` e `ADMIN_PASSWORD` no ambiente).
