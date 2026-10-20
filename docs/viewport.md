# Visão larga (20/10)

Pedido do matheus: "porque o jogo ficou com borda preta? nao ocupo toda tela no navegador". Escolheu **mostrar mais cenário**.

- A visão do jogo tem sempre 864 de altura e largura variável: `view.width` em `src/game/viewport.ts`, de 1536 (16:9) até 2304 (`MAX_VIEW_WIDTH`), calculada pela forma da janela (`viewWidthFor`) no `resize` do `App.tsx`.
- Janela mais larga que 16:9 mostra mais da praça, da Pescaria e da batalha, sem borda preta; janela mais alta que 16:9 continua com faixas em cima e embaixo (nenhum mapa passa de 864 de altura).
- O `.game-frame` tem a largura da visão (`--frame-width`); o HUD em HTML fica preso às bordas (left/right), então acompanha sozinho.
- Código de desenho nunca usa 1536 fixo para a tela: use `view.width` (Scene, environment, lobbyWorld, fishingWorld, minimapa). Larguras do mundo (`WORLD.width`, `LOBBY_WIDTH`, mapas) não mudam.
- Parallax da praça: as camadas foram pintadas para 1536; `layerSpan` em `lobbyWorld.ts` mantém o mesmo deslize na tela e só estica a camada quando ela é mais estreita que a visão.
- A tela de carregamento continua num palco de 1536 × 864 centralizado.
- Teste rápido: abrir o jogo numa janela 1920 × 950 e conferir praça, Pescaria, salão e batalha.
