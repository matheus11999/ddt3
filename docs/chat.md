# Chat

Quatro abas, um canal cada (`ChatChannel` em `shared/protocol.ts`); o servidor (`case 'chat'` em `server/game.ts`) decide quem recebe:

- **Mundo**: todos no mesmo canal da praça.
- **Sala**: quem está na sala; durante a batalha, todos da partida (os dois grupos). Ao trocar de sala, as linhas da sala antiga somem.
- **Guilda**: membros online da mesma guilda (`memberships`); a aba fica desligada para quem não tem guilda e o servidor recusa.
- **Privado**: um jogador, aberto por "Enviar mensagem" no menu do jogador ou clicando no nome de uma mensagem privada.

Mensagens privadas aparecem em todas as abas (nome rosa), para não passarem despercebidas; quem recebe uma sem ter escolhido ninguém já fica pronto para responder a quem mandou. Aba com mensagem nova não lida ganha um ponto vermelho (Mundo, Sala, Guilda). Tudo entra no histórico de denúncias (`ReportChatLine`, com o nome da guilda).

Teste no navegador: `npm run test:chat:browser` (jogo rodando e Postgres para dar o ouro da guilda).
