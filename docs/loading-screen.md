# Tela de carregamento (PvP e expedição)

Entre achar a partida (ou iniciar um estágio de expedição) e a batalha, todos veem a mesma tela: times frente a frente com um "VS" 3D no meio, fundo do mapa desfocado e, embaixo, a miniatura do mapa (`/assets/maps/<id>-preview.png`). Na expedição o lado direito mostra a arte do estágio (`stage.art`) e o rodapé a instância.

## Regras (servidor, `server/game.ts`)
- `launchMatch` e `launchExpedition` abrem a fase de carregamento (`openLoading`); a batalha só é criada (`beginMatch`/`beginExpedition`) quando todos chegam a 100 %.
- Prazo `LOADING_SECONDS` (30 s, `shared/protocol.ts`). Quem não terminou sai da sala, volta ao salão (PvP) ou à Central de Expedições e recebe o aviso. Os outros jogam sem ele; se um lado ficar vazio, todos voltam à sala com o aviso "Um jogador não carregou a tempo".
- Sair durante o carregamento tira o jogador da espera dos outros.
- Só esperamos clientes que avisaram `client-features {loading:true}` ao conectar. Bots, clientes antigos e testes por WebSocket cru contam como 100 % (a partida começa na hora, como antes).
- Eventos: `loading` (estado com o progresso de cada um, ou `null` ao fechar; `dropped` quando o jogador foi deixado de fora). Comando: `loading-progress {id, progress}` (só sobe).
- O carregamento não é salvo no estado persistente: depois de um reinício as salas voltam a "esperando".

## Cliente
- `src/components/MatchLoading.tsx` (+ `.css`): a tela, em portal sobre a sala, escalada como o jogo (celular em paisagem incluso).
- `src/game/battlePreload.ts`: carrega e decodifica só o que a batalha desenha: pinturas do mapa, cada lutador desenhado uma vez fora da tela (corpo de combate, cabeça, cabelo, chapéu, arma, pet), efeitos das armas em uso, lápide e, só na expedição, os monstros. A barra tem mínimo de 1,2 s para o VS ser lido.
- A praça sai da memória já no carregamento (`Scene.tsx`).

Prévia com dois jogadores reais (precisa do jogo rodando): `node scripts/preview-match-loading.mjs` (`KIND=expedition`, `SLOW=1` para o jogador que não carrega, `VIEWPORT=844x390`). Testes: `tests/loading-screen.test.ts`.
