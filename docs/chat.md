# Chat

Quatro abas, um canal cada (`ChatChannel` em `shared/protocol.ts`); o servidor (`case 'chat'` em `server/game.ts`) decide quem recebe:

- **Mundo**: todos no mesmo canal da praça.
- **Sala**: quem está na sala; durante a batalha, todos da partida (os dois grupos). Ao trocar de sala, as linhas da sala antiga somem.
- **Guilda**: membros online da mesma guilda (`memberships`); a aba fica desligada para quem não tem guilda e o servidor recusa.
- **Privado**: um jogador, aberto por "Enviar mensagem" no menu do jogador ou clicando no nome de uma mensagem privada.

Mensagens privadas aparecem em todas as abas (nome rosa), para não passarem despercebidas; quem recebe uma sem ter escolhido ninguém já fica pronto para responder a quem mandou. Aba com mensagem nova não lida ganha um ponto vermelho (Mundo, Sala, Guilda). Tudo entra no histórico de denúncias (`ReportChatLine`, com o nome da guilda).

Teste no navegador: `npm run test:chat:browser` (jogo rodando e Postgres para dar o ouro da guilda).

## Balões de fala (Bolha)

Quem escreve ganha um balão sobre a cabeça por 5 s (`CHAT_BUBBLE_MS`), com a aparência da **Bolha** equipada (slot `bubble` da mochila; o servidor manda o id em `ChatLine.bubble`):

- **Praça**: mensagens de Mundo, sobre quem andou na praça (`Scene.tsx`).
- **Salas PvP e de expedição**: mensagens de Sala, sobre o card de quem escreveu (`SeatSpeech`).
- **Batalha**: mensagens de Sala, sobre o lutador. Na batalha, **Enter** (ou o botão de balão acima das ferramentas) abre a linha para escrever na Sala; as últimas linhas flutuam no canto inferior esquerdo (`BattleChat`).

Balões próximos se empilham (o mais novo sobe). Cada Bolha é um estilo em `BUBBLE_STYLES` (`src/game/speechBubble.ts`): forma (`round` ou `cloud`), preenchimento, contorno, cor do texto e contorno interno. Hoje: Sem bolha (balão branco padrão), Nuvem, Brasa e Real (loja). Bolha nova: item em `shared/catalog.ts`, preço em `shared/shop.ts` e um estilo em `BUBBLE_STYLES`. O texto é sempre desenhado pelo jogo. Teste: `npm run test:chat:browser`.
