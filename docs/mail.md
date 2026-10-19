# Correio (caixa de entrada do jogador)

Caixa de entrada no estilo e-mail, aberta pelo botão Correio da praça e da sala (o número vermelho conta cartas não lidas ou com anexos para receber). Cada carta tem remetente, assunto, data, texto e até 10 anexos. O painel do administrador (`/admin/jogadores`) é quem envia por enquanto: moedas, itens e mensagens chegam todos como cartas.

## Regras

- **Anexos**: Moedas Brasa, item do catálogo (até 10 cópias; arma pode vir com nível de forja), Pedras de Fortificação I–V, pedras de composição, Tickets de Cor e comida de pet (aba "Comida de pet" do painel, lista vinda de `PET_FOODS`; `shared/mail.ts`, validado com zod no servidor).
- **Receber** pega os anexos de uma carta; **Receber tudo**, de todas. O servidor trava as cartas e o jogador na mesma transação do Postgres (`server/mail.ts`), então dois cliques ou duas abas nunca recebem duas vezes. Cada item chega como cópia separada, como na compra repetida (`id~2`, ver `docs/shop.md`); Tickets de Cor respeitam o limite da mochila.
- **Apagar** só some com a carta quando não há anexo pendente; a carta continua no histórico do painel (marcada como apagada pelo jogador).
- Item que não serve no gênero do personagem é recusado no envio (o catálogo do painel já mostra bloqueado).
- A caixa mostra as 100 cartas mais novas. Jogador online recebe a carta na hora (evento `mail`); offline, ao entrar.

## Protocolo

Comandos: `mail-list`, `mail-read {id}`, `mail-claim {id?}` (sem id = Receber tudo), `mail-delete {id}`. Eventos: `mail {mails, unread}` e `mail-claim-result {result}`, além do `profile` atualizado.

## Onde está o código

- Servidor: `server/mail.ts` (tabela `player_mail`, `MailStore`, `applyAttachments`), comandos em `server/game.ts`, envio pelo painel em `server/admin.ts` (`POST /api/admin/players/:id/mail`).
- Jogo: `src/components/Mailbox.tsx` e `Mailbox.css` (janela de madeira no padrão da mochila), estado em `src/client.ts`.
- Testes: `tests/mail.test.ts` (unidade), `npm run test:mail:integration` (Postgres real, resgate duplo simultâneo) e `ADMIN_PASSWORD=<senha> npm run test:mail:browser` (painel envia, jogador recebe; capturas em `test-results/mail/`).
