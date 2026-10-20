# Ticket de Cor, menu da mochila e Excluir

## O que o jogador vê

- **Botão direito na mochila** (grade e slots do personagem) abre o menu do jogo, nunca o do navegador:
  - **Equipar** ou **Remover**;
  - **Aprimorar**: armas e itens que aceitam composição; abre o Ferreiro com o item já carregado;
  - **Trocar cor**: cabelo, chapéu, óculos e roupa;
  - **Excluir**: pede confirmação. Fica desativado na última arma, roupa ou rosto.
- **Trocar cor** abre uma janela única para pintar várias partes de uma vez:
  - no topo ficam as peças vestidas (cabelo, chapéu, óculos, roupa; a peça clicada entra no lugar da vestida), o Corpo e os Olhos;
  - cada parte mostra um ponto laranja quando tem cor nova, e Desfazer volta só aquela parte;
  - a prévia mostra todas as cores juntas, sem círculo atrás;
  - só cores prontas, sem seletor RGB (cores fortes demais ficavam feias no jogo): peças com "Original" e 12 tons suaves (`COLOR_PALETTE`), olhos com "Original" e 8 tons (`EYE_PALETTE`);
  - no Corpo, só 6 tons de pele realistas (`SKIN_TONES`): Clara (a pele pintada), Branca, Morena clara, Morena, Morena escura e Negra;
  - **Aplicar tudo · N** envia tudo junto.
- **Cor do corpo e dos olhos**: o botão ao lado do personagem na mochila abre a mesma janela já no Corpo.
  - Corpo: rosto, orelhas, braços e pernas.
  - Olhos: só a íris; o branco e o contorno ficam.
  - Rostos de olhos fechados (`CLOSED_EYE_FACES` em `shared/colors.ts`: Sorriso Radiante, Sorriso de Verão) não oferecem Olhos, e o servidor recusa a troca.
  - Corpo: no rosto, o branco dos olhos, brilhos, dentes e boca nunca seguem o tom de pele (`faceFeatures` em `src/game/appearance.ts`); conferir os 6 tons.
- Cada parte que muda de verdade gasta **1 Ticket de Cor**, inclusive voltar ao Original.
  - Sem ticket, o botão Aplicar fica desativado e a janela manda comprar na loja.
  - Personagem novo (ou perfil antigo) começa com 3 tickets.
  - A loja vende o ticket por 60 moedas, com escolha de quantidade (até 20 por compra).
  - A mochila mostra o ticket na grade com a quantidade, e o total junto das moedas.

## Regras no servidor

- O servidor decide tudo; o cliente só pede.
  - `paint {changes:[{target,color|null}]}` (target = cópia do item, `skin` ou `eyes`; até 8) e `discard {item}`;
  - `paint` é tudo ou nada: sem tickets para todas as trocas, nada muda; partes que não mudaram não são cobradas;
  - `paint` só aceita as cores da paleta da parte (`isPaletteColor`); uma cor pintada antes da paleta continua até o jogador trocar;
  - `shop-buy` com `quantity` para o ticket.
- Cada ação roda numa transação com trava da linha do perfil (`Store.mutate`). Se faltar ticket, nada muda.
- A cor é **por cópia**: `profile.itemColors['hat-cap~2']`.
  - O servidor calcula `equipment.colors`, `equipment.skin` e `equipment.eyes` a partir das cópias vestidas (`refreshWorn`).
  - Trocar de cópia troca a cor.
- Excluir apaga a cópia com forja, composição e cor.
  - Ao excluir a peça base com cópias, a cópia mais nova passa a ser a base.
  - A peça vestida volta para "sem item", ou para outra roupa ou rosto que o jogador tenha.
- Recolor, cor do corpo e excluir ficam bloqueados durante a partida.
- A tintura antiga e gratuita (`equipment.dyes`, 4 cores por slot) saiu.
  - Perfis antigos migram para `itemColors` com as mesmas cores (`LEGACY_DYE_COLORS`).

## Como a cor é pintada

- `src/game/recolor.ts` repinta sobre a arte pintada, mantendo luz e sombra.
  - A claridade média da região vai para a da cor nova; cada pixel mantém a distância dela, então dobras, contornos e brilhos continuam.
- **Região de cor por peça** em `src/game/rig/recolorZones.ts`:
  - Sem `hue`: muda a peça inteira (cabelos, Óculos Sprint e Gatinho).
  - Com `hue`, `tolerance` e `minSaturation`: muda só a cor principal pintada. A aba, a estrela, as faixas, as penas, o dourado e as partes laranja ficam como estão.
  - `label` é o texto que a janela mostra ("Muda: a copa do boné; a aba e a estrela ficam como estão").
- Pele: multiplica a cor pintada pela razão entre a cor escolhida e a pele de referência (252,207,172), então a sombra acompanha qualquer tom.
  - A pele pintada segue uma reta: azul/vermelho ≈ 1,2 × verde/vermelho − 0,3, do brilho até a sombra funda. Só muda o que está perto dessa reta.
  - Só mudam regiões conectadas que têm brilho de pele; couro marrom, dourado e laranja perto da reta ficam como estão.
  - A prancha `skins.png` do validador mostra cada roupa e cada rosto nos 6 tons; braços, pernas e rosto precisam ficar iguais.
- Olhos: só a íris, dentro das elipses `EYES` de `faceExpressions.ts`.

## Cosmético novo

- Todo cabelo, chapéu, óculos e roupa precisa de uma entrada em `RECOLOR_ZONES`.
  - O teste `tests/colors.test.ts` falha sem ela.
- `npm run verify:cosmetics` mede a região de cada peça:
  - Uma região com `hue` precisa cobrir de 6% a 85% da peça pintada (`RECOLOR_COVERAGE`).
  - Abaixo disso, a troca quase não aparece.
  - Acima disso, a faixa pegou a peça toda ou a pele: use a peça inteira ou estreite a faixa.
- O validador desenha `colors.png`:
  - cada peça na cor original e em 5 cores;
  - a cabeça em 6 tons de pele e 6 cores de olho;
  - cada roupa em 6 tons de pele.
- Confira na prancha se só a parte certa mudou.
- Ao pintar a arte nova, deixe a parte que deve mudar de cor numa cor viva e única. Os detalhes que não mudam (metal, aba, enfeites) devem ficar em outra cor.

## Testes

- `tests/colors.test.ts` testa regiões, migração, cobrança, cópias, compra por quantidade e excluir.
- `npm run test:colors:browser` roda o menu, a janela de cor, corpo e olhos, sem ticket, excluir e a compra na loja. As capturas ficam em `test-results/colors/`.
- Arte do ticket: `public/assets/ui/color-ticket.png`, gerada pelo Codex. Os originais e o prompt estão em `/mnt/project-files/troca-de-cor/`.
