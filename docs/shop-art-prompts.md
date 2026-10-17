# Loja da Brasa — prompts de arte

Loja redesenhada em 17/10/2026 no mesmo padrão da mochila e do ferreiro (`src/components/Shop.tsx`, `src/components/Shop.css`): moldura de madeira laranja, barra de título escura com título dourado em Cinzel, Nunito no conteúdo, painéis creme e faixa laranja com nível, nome e gênero. À esquerda fica o **provador** (personagem estático sobre o selo pintado da aura, restaurar visual por ícone, nome da peça experimentada numa faixa laranja e carteira). À direita fica a **vitrine**: busca creme, cards horizontais em três colunas como no DDTank (ícone com o card de classe da mochila, nome, tipo, preço e Comprar; clicar no item veste a prévia), abas verticais de categoria à direita da grade e paginação de 12 itens. Sem carrinho, sem Poder na prévia e só itens do gênero do personagem e unissex; Comprar abre uma confirmação em madeira. O card de informações é o `InventoryTooltip` da mochila, com o preço no rodapé.

Hoje tudo é desenhado em CSS sobre os materiais de `WoodTheme.css`; as peças abaixo são opcionais e trocam só o fundo de áreas que já existem. Regras comuns iguais às de `docs/backpack-art-prompts.md`: cores vivas, contorno marrom limpo, volume pintado, sem texto, sem pastel lavado, sem cara de vetor, arte original no estilo do DDTank.

## 1. Fundo do provador

Arquivo: `public/assets/ui/shop-fitting-stage.webp`, 768×1024.

```text
Vertical game UI panel background, 768x1024, the inside of a cozy fantasy clothing boutique seen straight on and slightly out of focus: warm cream plaster wall with soft orange light, two heavy red-orange velvet curtains tied open at the left and right edges, a round polished oak platform with a thin gold rim in the lower third where a chibi character will stand, a tall oval mirror frame and a few hanging hats and outfits as soft silhouettes near the top corners, the center left clean and bright for the character and a rotating magic sigil, vivid saturated painted casual MMO style matching orange wood UI frames, soft light from top-left. No text, no characters, no logo, no frame or border.
```

Uso: substitui o gradiente creme de `.shop-stage` (`background: url(...) center / cover`), mantendo o selo `.shop-sigil` e o tablado `::after` por cima.

## 2. Ícones das categorias

Arquivo: `public/assets/ui/shop-category-icons.png`, 1536×256, transparente, seis células de 256×256.

```text
Game UI icon sheet, 1536x256, transparent background, six square cells of 256x256 in one row, each a chunky painted 3D icon centered with a thick clean brown outline, vivid saturated colors, glossy highlights from top-left, classic Asian browser artillery game style. Left to right: 1 a small gift box with a gold ribbon and a sparkle (featured items), 2 a cartoon bazooka cannon with a red-gold barrel (weapons), 3 a folded blue jacket with gold buttons (outfits), 4 a magic fox mask with a purple star (costumes), 5 a smiling round chibi face mask (faces), 6 a pair of round goggles crossed with a gem ring (accessories). No text, no background, no cell borders, same size and lighting for all six.
```

Uso: troca os ícones de linha de `CATEGORIES` em `Shop.tsx` por recortes desta folha (`background-position` de 0 a 5 × 256 px), nas abas `.shop-tabs`.

## 3. Placa da loja

Arquivo: `public/assets/ui/shop-sign.png`, 512×192, transparente.

```text
Single game UI prop, 512x192, transparent background, a hanging wooden shop signboard made of warm orange-brown planks with dark iron corner brackets and two short chains at the top, an empty smooth cream-colored central plate for text added later in code, a small golden coin and a red ribbon tucked on the left corner, thick clean brown outline, vivid saturated painted 3D look like classic Asian browser artillery games, soft light from top-left. No text, no letters, no background.
```

Uso: opcional, atrás do título "Loja da Brasa" na barra escura, com o título continuando em Cinzel dourado por cima.

## Prévia

```sh
node scripts/preview-shop.mjs   # BASE_URL, OUT, SIZES e CHROME_PATH opcionais
```

Gera `test-results/shop-preview/` com catálogo, armas com o card de informações e a confirmação de compra em desktop (1536×864, 1280×720) e celular em paisagem (844×390, 667×375).
