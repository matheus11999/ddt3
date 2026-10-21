# Tela de carregamento (PvP e expedição)

Entre achar a partida (ou iniciar um estágio de expedição) e a batalha, todos veem a mesma tela: times frente a frente (até 4 por lado; cada jogador em pé sobre a aura do jogo, sem card atrás, com nome e barra embaixo; 1 ou 2 numa linha, 3 ou 4 em duas) com um "VS" 3D no meio, sem título no PvP (pedido do matheus em 19/10), fundo do mapa desfocado e, embaixo, a miniatura do mapa (`/assets/maps/<id>-preview.png`). Na expedição o lado direito mostra a arte do estágio (`stage.art`) maior, com as marcas da sala (dificuldade em cima, placa dourada "ESTÁGIO N", nome 3D e nome do estágio) só dentro da imagem; não há título no topo nem rodapé (pedidos do matheus em 19/10).

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

Prévia com dois jogadores reais (precisa do jogo rodando): `node scripts/preview-match-loading.mjs` (`PLAYERS=1..4` por lado, `KIND=expedition`, `SLOW=1` para o jogador que não carrega, `HOLD=ms` para atrasar o último e fotografar o carregamento, `VIEWPORT=844x390`). Testes: `tests/loading-screen.test.ts`.

## Cobertura geral do jogo (19/10, pedido do matheus)
Além da tela da partida, uma cobertura de tela cheia impede que o jogador veja conteúdo pela metade:
- **Início**: fica até chegar o estado do servidor (`welcome`), as fontes, todas as imagens na tela decodificadas e um quadro completo do canvas (praça com toda a arte, ou a batalha). Se a entrada falhar, mostra o erro e "Tentar novamente".
- **Volta da aba**: aba escondida por 1,5 s ou mais (`RESUME_AFTER_MS`) volta coberta; as imagens são decodificadas de novo (o navegador descarta a arte decodificada de aba escondida) e a cobertura sai com um quadro completo. Olhada rápida não mostra nada.
- **Pescaria** (21/10, pedido do matheus): entrar na Pescaria ou voltar à praça (botão, Sair, dirigível, ou a volta automática para a Pescaria ao recarregar) cobre a tela na hora do clique ("Indo para a Pescaria…" / "Voltando à Praça Celeste…") até o servidor trocar a zona, todos os botões e imagens do HUD novo chegarem e o canvas pintar a zona inteira. Se o servidor não responder em 5 s, a cobertura sai mesmo assim. O pedido de troca avisa a cobertura pelo evento `brasa-zone-going` (`client.goTo`).
- **Reconexão**: conexão caiu → "Conexão perdida. Reconectando…" até o novo `welcome` estar na tela. O aviso pequeno ficou só para "entrou em outra aba".
- **Janelas e listas**: toda peça nova da tela (janela, aba, item, dica) com imagem ainda carregando fica invisível até as imagens chegarem (no máximo 1,5 s; `src/screenAssets.ts`, atributo `data-pictures-pending`). Vale para `<img>` e fundos de CSS, inclusive `::before`/`::after`.

Visual (21/10, pedido do matheus): logomarca **Bomb Masters** do site sobre a arte pintada do site (`public/assets/ui/loading/backdrop.webp`, cópia em 1920 de `site/public/art/hero-4.webp`, com deriva lenta e sombra no centro), barra de pavio com aro dourado, listras correndo e a faísca pintada da própria logo na ponta (`spark.png`, recortada da logo e espelhada), percentual em Lilita One. Logo e fundo são pré-carregados no `index.html`.

Arquivos: `src/screenCurtain.ts` (quando cobrir e quando sair), `src/components/ScreenCurtain.tsx` (+ `.css`), `src/screenAssets.ts`, `src/game/scenePaint.ts` (o `Scene` avisa o primeiro quadro completo). Prévia: `node scripts/preview-screen-curtain.mjs` (`VIEWPORT=844x390` para celular; precisa do jogo rodando).
