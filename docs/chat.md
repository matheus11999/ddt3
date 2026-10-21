# Chat

Quatro abas, um canal cada (`ChatChannel` em `shared/protocol.ts`); o servidor (`case 'chat'` em `server/game.ts`) decide quem recebe:

- **Mundo**: todos no mesmo canal da praça.
- **Sala**: quem está na sala; durante a batalha, todos da partida (os dois grupos). Ao trocar de sala, as linhas da sala antiga somem.
- **Guilda**: membros online da mesma guilda (`memberships`); a aba fica desligada para quem não tem guilda e o servidor recusa.
- **Privado**: um jogador, aberto por "Enviar mensagem" no menu do jogador ou clicando no nome de uma mensagem privada.

Na praça e na Pescaria o chat flutua sobre o cenário (`Chat overlay` em `Hud.tsx`): as linhas ficam sobre um vidro escuro bem leve, o campo de escrever é um vidro escuro translúcido (sem madeira) e **as abas só aparecem enquanto o jogador escreve**: Enter (ou um toque no campo, no celular) abre a linha com as abas; Enter envia e fecha, Esc fecha (pedido do matheus em 21/10). Nunca 100% transparente.

Mensagens privadas aparecem em todas as abas (nome rosa), para não passarem despercebidas; quem recebe uma sem ter escolhido ninguém já fica pronto para responder a quem mandou. Aba com mensagem nova não lida ganha um ponto vermelho (Mundo, Sala, Guilda). Tudo entra no histórico de denúncias (`ReportChatLine`, com o nome da guilda).

Teste no navegador: `npm run test:chat:browser` (jogo rodando e Postgres para dar o ouro da guilda).

## Balões de fala (Bolha)

Quem escreve ganha um balão sobre a cabeça por 5 s (`CHAT_BUBBLE_MS`), com a aparência da **Bolha** equipada (slot `bubble` da mochila; o servidor manda o id em `ChatLine.bubble`):

- **Praça**: mensagens de Mundo, sobre quem andou na praça (`Scene.tsx`).
- **Salas PvP e de expedição**: mensagens de Sala, sobre o card de quem escreveu (`SeatSpeech`).
- **Batalha**: mensagens de Sala, sobre o lutador. Na batalha, **Enter** (ou o botão de balão acima das ferramentas) abre a linha para escrever na Sala; as últimas linhas flutuam no canto inferior esquerdo (`BattleChat`).

Balões próximos se empilham (o mais novo sobe). Cada Bolha é um estilo em `BUBBLE_STYLES` (`src/game/speechBubble.ts`): forma (`round` ou `cloud`), preenchimento, contorno, cor do texto, contorno interno, brilho e efeito animado. A **Bolha Clássica** vem no kit inicial (`DEFAULT_EQUIPMENT.bubble`; `CONTENT_VERSION` 17 dá e veste uma vez em quem estava sem bolha). Na loja: Nuvem (incomum, nuvenzinhas subindo), Brasa (rara, faíscas), Real (épica, brilhos e faixa de luz), Estelar e do Dragão (lendárias: estrelas em órbita, chamas verdes nos cantos). A moldura de cada uma é pintada pelo Codex (prompts em `docs/bubble-art-prompts.md`, recorte com `python3 scripts/build-bubble-art.py`) e esticada em 9 fatias; a ponta é desenhada pelo jogo, curva e arredondada, nas cores do estilo. Sem a pintura carregada, o balão desenhado em código serve de reserva. Na batalha o balão fica ao lado do rosto, com a ponta virada para ele nos dois sentidos. Bolha nova: item em `shared/catalog.ts`, preço em `shared/shop.ts`, um estilo em `BUBBLE_STYLES` e a prancha pintada. O texto é sempre desenhado pelo jogo. Teste: `npm run test:chat:browser`.
