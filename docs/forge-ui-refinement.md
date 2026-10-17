# Ferreiro — revisão de 16/10/2026

O ferreiro mantém a identidade compartilhada em `GameTheme.css`: moldura fina, safira, ouro discreto e botões arredondados. As abas Fortalecer e Composição ficam na horizontal. A bancada pintada preserva o item escolhido, os materiais preparados, a chance e a ação no mesmo painel; não há prévia da evolução da arma nem atributos permanentes da arma.

## Proporções e organização

- Cards de equipamento e minerais são quadrados, com o mesmo `ItemCard` da mochila. As quatro armas e cinco pedras ocupam a largura do painel; os 16 equipamentos da conta de QA cabem numa grade completa, inclusive em 667 × 375, sem paginação nem rolagem interna.
- O alvo selecionado é um card compacto apoiado no topo da bigorna, com retirada no próprio canto. O badge de fortalecimento no cabeçalho foi ampliado. A régua de níveis e a indicação de nível atual → futuro foram retiradas; a chance autoritativa aparece dentro de uma barra luminosa.
- Composição: escolher equipamento, atributo e mineral I–III. Os três minerais exibem bônus e chance; o selecionado mostra bônus atual → novo, custo e chance antes de confirmar. Alterar o filtro de atributo limpa o mineral anterior, evitando compor inadvertidamente o atributo anterior.
- Fortalecimento: cinco pedras comuns na coleção; clicar/arrastar adiciona e clicar no slot preparado retira uma unidade. O contador mantém o teto definido pelo catálogo. As pedras continuam comuns, independentemente da cor mineral.
- A animação do martelo e das partículas acompanha as dimensões da bancada. Sucesso/falha permanece grande e depende da resposta autoritativa. Seleção e remoção não consomem recursos.

## Validação

`npm run check`, `npm test` (221 testes) e `npm run build` passaram. `node scripts/verify-forge-layout.mjs` usa perfis novos de QA com 16 itens compatíveis para verificar a grade completa sem paginação em 1536×864, 1280×720, 844×390 e 667×375; seleção/retirada, arraste de materiais no desktop, troca de atributo, proporção quadrada, ausência de rolagem, texto dos minerais dentro do painel e botão de ação visível. Ouro, pedras, composições e upgrades permanecem iguais durante o ensaio. Nenhum erro JavaScript nas quatro resoluções.

Capturas e relatório locais: `test-results/forge-refinement-v2/`. Economia, catálogo, protocolo e validação do servidor não foram alterados. A revisão usa a oficina pintada já existente; nenhuma nova arte foi gerada.
