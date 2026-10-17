# Celular em paisagem

O jogo é jogável no celular somente na horizontal. `MobileOrientation.tsx` distingue dispositivos com toque/ponteiro primário móvel de janelas desktop estreitas. Em retrato, a tela **Vire o celular** cobre o jogo e bloqueia os controles, inclusive na criação do personagem. A detecção acompanha a mudança de orientação e o tamanho da janela.

Ao girar, a página não recarrega: sessão, personagem, itens, rascunho da mochila e partida são preservados. A entrada em retrato cancela a carga de tiro e limpa entradas pendentes; soltar o dedo ou uma tecla depois não dispara. O servidor continua contando o tempo do turno e simulando os outros jogadores. Isso não é uma pausa da partida multiplayer.

Mochila, loja, ferreiro e arena em celulares deitados usam a largura da tela, dois painéis e rolagem interna. Cabeçalho, fechamento e ações permanecem dentro da área útil. `viewport-fit=cover` e margens `safe-area-inset-*` acomodam recortes da tela. O desktop mantém o layout aprovado e não recebe o bloqueio só por estreitar uma janela.

Não há promessa de forçar a orientação física do navegador: o jogador gira o aparelho, e a tela de orientação controla quando a interface fica disponível. Não é preciso aceitar tela cheia, recarregar ou recriar personagem.

## Verificação

Com Vite ou a versão Docker atualizados:

```powershell
$env:BASE_URL='http://127.0.0.1:8097'
npm run test:mobile:browser
```

`scripts/smoke-mobile-landscape.mjs` usa emulação de navegador com toque. Verifica retrato bloqueado, rotação, criação, mochila/loja/ferreiro/arena, controles de combate e preservação da sessão. As resoluções de referência são 844×390, 932×430 e 667×375. Capturas ficam em `test-results/`; o teste não substitui avaliação em aparelhos iOS/Android físicos.
