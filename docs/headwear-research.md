# Chapéus e cabelos: diagnóstico de encaixe

Pesquisa de 16/10/2026, após o usuário rejeitar o encaixe anterior. A implementação subsequente está descrita no fim deste documento. Compra, prévia, persistência e carregamento funcionando não substituem inspeção visual.

## Evidência encontrada no cliente antigo

Foi consultado um repositório público de terceiros denominado DDTank41, fixado no commit `7fcb55290e4c7aabd6887d3c1ccd2621b5080924`. Isso documenta esse cliente específico; não comprova que todas as versões oficiais usam a mesma implementação. Nenhum código ou asset desse cliente foi incorporado ao jogo.

- [`PlayerInfo.getHairType()`](https://github.com/pnkl1999/DDTank41/blob/7fcb55290e4c7aabd6887d3c1ccd2621b5080924/Source%20Flash/src/ddt/data/player/PlayerInfo.as#L516) consulta `Property1` do equipamento de cabeça.
- [`BaseLayer`](https://github.com/pnkl1999/DDTank41/blob/7fcb55290e4c7aabd6887d3c1ccd2621b5080924/Source%20Flash/src/ddt/view/character/BaseLayer.as#L60) transforma esse valor em variante `B` quando igual a 1 e `A` nos demais casos.
- [`PathManager.solveGoodsPath()`](https://github.com/pnkl1999/DDTank41/blob/7fcb55290e4c7aabd6887d3c1ccd2621b5080924/Source%20Flash/src/ddt/manager/PathManager.as#L194) inclui a variante no caminho do PNG do cabelo vestido, sem acrescentá-la ao caminho do ícone. Portanto existem recursos distintos por variante; não se trata apenas de deslocar o mesmo cabelo.
- [`BaseCharacterLoader`](https://github.com/pnkl1999/DDTank41/blob/7fcb55290e4c7aabd6887d3c1ccd2621b5080924/Source%20Flash/src/ddt/view/character/BaseCharacterLoader.as#L285) recarrega a camada de cabelo quando o chapéu muda, mesmo se o cabelo equipado permanece igual.
- [`ShowCharacterLoader`](https://github.com/pnkl1999/DDTank41/blob/7fcb55290e4c7aabd6887d3c1ccd2621b5080924/Source%20Flash/src/ddt/view/character/ShowCharacterLoader.as#L88) compõe as camadas em `BitmapData`. [`GameCharacterLoader`](https://github.com/pnkl1999/DDTank41/blob/7fcb55290e4c7aabd6887d3c1ccd2621b5080924/Source%20Flash/src/ddt/view/character/GameCharacterLoader.as#L80) também recebe o tipo de cabelo.

A evidência confirma seleção de arte de cabelo dependente do chapéu. Sem examinar as pinturas correspondentes, não se deve afirmar que A significa sempre descoberto, que B significa sempre boné, nem atribuir ao cliente um algoritmo de deformação ou uma separação traseira/frente que não foi verificada.

## Por que o resultado do Brasa Arena falhou

A implementação anterior em `src/game/appearance.ts` utilizava `CAP_BANDS` para aproximar a posição da faixa; `drawFittedHair` comprimia por colunas a imagem normal do cabelo; `drawFrontLocks` reutilizava partes dessa mesma imagem abaixo da faixa. Essas operações não desenhavam uma raiz de rabo de cavalo saindo pela abertura, nem recolhiam um topete sob a copa de maneira natural. Esse caminho foi removido na implementação abaixo.

As pinturas dos novos chapéus mostram objetos isolados, incluindo aberturas internas vistas por baixo. Sobrepor essa abertura opaca ao rosto resulta numa peça atravessando a testa. As pranchas `test-results/new-hats-fit.png` e `hats-seated.png` mostram esse problema e cabelos salientes ao redor da copa. São evidência do problema, não aprovação visual.

Anteriormente `src/game/avatar.ts` desenhava a cabeça antes de todas as peças. Agora chama `drawHeadRearLayers` antes dela e `drawHeadLayers` depois, nas poses em pé e em combate.

## Decisão técnica

Manter Canvas 2D. Ele já permite PNGs com transparência, composição em camadas, máscaras e transformações. Não foi encontrado um limite do renderizador que impeça o encaixe solicitado.

| Opção | O que oferece | O que ainda exige |
| --- | --- | --- |
| Canvas atual | Camadas, transparência, máscaras, cache e rig existente | Artes compatíveis e contrato explícito de variantes |
| PixiJS | Organização de sprites, máscaras e renderização acelerada | As mesmas artes e medidas; migração não corrige perspectiva |
| Spine 2D | Rig, skins e deformação por malha para animação | Autoria do rig e das peças; não adapta automaticamente qualquer PNG |
| Personagens 3D | Equipamentos modelados no mesmo crânio e materiais | Refazer personagens, cabelo, roupas e animações; escopo muito maior |

## Contrato para a correção visual

Contrato usado na implementação após a autorização do usuário:

1. Manter o molde, as expressões e as âncoras universais da cabeça. Não deformar o rosto para caber no chapéu.
2. Cada cabelo possui arte descoberta e arte preparada para cobertura. Preservar identidade, cor, franja, costeletas e comprimento; recolher o volume que fica dentro da copa. Rabo de cavalo deve sair de uma abertura coerente.
3. Cada chapéu declara o perfil de cabelo compatível. Desenhar a peça vestida sobre o molde, na mesma perspectiva; a imagem de produto isolado não basta como prova de encaixe.
4. Onde a geometria exigir, separar traseira e frente/aba. A composição deve permitir traseira do chapéu/cabelo antes do rosto e aba depois das mechas previstas. A ordem exata deve ser declarada por perfil, sem recortes genéricos usados como solução final.
5. Registrar as peças num mesmo espaço de coordenadas. Não depender de caixas de alfa para inferir automaticamente o tamanho de uma abertura interna.
6. Primeiro validar uma combinação montada, ampliada e no tamanho real do jogo. Depois ampliar para todos os cabelos, chapéus, expressões, óculos e poses. Conferir frente/verso espelhado, combate, movimento, inventário e prévia da loja.
7. Quando houver variantes autoradas completas, substituir o caminho de compressão. Não substituir por outra sequência de ajustes empíricos e declarar resolvido apenas porque os testes passaram.

## Implementação após autorização

- Quatro pinturas novas de cabelo coberto: aventureiro castanho, ondulado dourado, Tempestade azul/preto e rabo de cavalo Rubi baixo. Lunar reutiliza o corte aventureiro com sua tintura, como no cabelo descoberto. Os cinco cabelos têm registro explícito em `COVERED_HAIR`; sem cabelo continua sem cabelo.
- Seis novas pinturas de chapéu vestido: Explorador, Relâmpago, Maré, Rubi, Tropical e Astral. `getHeadwearProfile` seleciona o cabelo coberto para essas peças e para o elmo. Óculos de Voo não cobrem a cabeça e preservam o penteado descoberto.
- Nuca/rabo de cavalo atrás da cabeça; franja e têmporas diante dela; aba depois do cabelo. Cabeça universal e encaixe dos óculos preservados. As duas passagens seguem a mesma transformação do rig, incluindo combate e espelhamento.
- Ícones dos seis chapéus usam exatamente as pinturas vestidas. O catálogo, a posse, os preços e as transações não mudaram.
- Recortes poligonais do atlas excluem fragmentos de peças vizinhas sem cortar abas. Tingimentos permanecem funcionais. Não há compressão por colunas, repetição de mechas sobre a aba, nem substituição pela pintura antiga enquanto a nova carrega.
- `scripts/verify-headwear.mjs` gera 258 casos com oito equipamentos de cabeça, seis opções de cabelo, sem óculos/com Sprint/com Gatinho e poses reais. Verifica hashes dos novos assets servidos. Pranchas inspecionadas de bonés/chapéus, cabeça sem cabelo, óculos, caminhada e combate em ambos os sentidos. O relatório automatizado deixa a aprovação visual separada dos checks de renderização.

O Elmo do Guardião e Óculos de Voo mantêm seus desenhos procedurais anteriores; o elmo participa da nova seleção de cabelo. Não houve migração de tecnologia. Prompts, originais e registros em `shop-cosmetics-prompts.md`.
