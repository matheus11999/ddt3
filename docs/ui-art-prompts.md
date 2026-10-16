# Arte da interface — safira, rubi e ouro

Arte original gerada com `image_gen` em 16/10/2026 para o pedido de cores vivas e menus de fantasia. As imagens não contêm texto, botões ou dados de jogo. Rótulos, foco, interação e resultados continuam em HTML/React.

## Moldura e encaixe

`fantasy-panel.png` é aplicada como borda de nove fatias (`border-image-slice: 160 fill`), com borda física de 40 px nos menus grandes, 36 px na Arena e 19–20 px em telas estreitas. Os painéis e botões ocupam somente a área interna; a borda ilustrada não fica atrás deles. A fatia central fornece a pedra azul sem esticar os cantos.

A oficina é uma camada decorativa independente da arma, das pedras e dos efeitos de fortalecimento. A interface usa azul safira, rubi, esmeralda e ouro vivos, com superfícies escuras de baixo contraste sob textos e itens. O significado das raridades permanece cinza/verde/azul/roxo/dourado.

## Prompts exatos

### `fantasy-panel.png` — 1536 × 1024

Reusable menu panel and frame; no embedded labels or controls.

```text
Create an original production game UI panel background texture for a whimsical high-fantasy 2D chibi browser artillery game. Wide landscape 3:2 image. Rich vivid jewel colors, confident clean illustrated painterly craft, crisp premium mobile/PC fantasy RPG game finish. NO TEXT, no letters, no icons, no controls, no characters. The composition is a simple usable rectangle: broad quiet deep royal sapphire and midnight petrol blue stone center occupying 82 percent of the image, subtle hand-painted stone slabs and carved swirling leaf flourishes ONLY close to the edges, strong warm polished gold beveled frame occupying 5 percent of image width on all four edges, shaped rounded corners, small faceted glowing ruby-red gem inset in each corner. Tiny emerald reflections on the gold, saturated gold highlights and warm orange bouncing light. Dark ruby stained wooden outermost rim. Center needs to remain flat, low-contrast and uncluttered so actual HTML game buttons and items can be placed over it. Ornamental detail is concentrated in the perimeter, functional restrained border, absolutely no central crest. Straight orthographic flat 2D texture, no perspective, rectangle fills whole image. No cream parchment, pastel, washed-out colors, bloom, generic UI mockup, scene/background outside frame, illegible AI text, metallic photorealism. Save the finished image asset for use as a web game panel texture.
```

### `forge-workshop.png` — 1862 × 845

Workshop under weapon and forge effects, replacing the vector scenery. Image remains decorative and cannot alter strengthening outcomes.

```text
Original hand-painted 2D fantasy game blacksmith interior backdrop, very wide cinematic 2.2:1 horizontal layout, for a colorful chibi browser artillery RPG. Professional polished vivid stylized fantasy game environment art, confident outlines and dimensional brushwork, vivid royal cobalt blue stone arches, glowing molten orange forge fire, polished gold/brass fittings, vivid emerald enchanted crystals, warm mahogany beams. Composition must be UI-usable: huge richly illustrated arched orange-glowing furnace at far LEFT quarter; heavy detailed iron anvil with gold rim sits in LOWER CENTER at 53 percent horizontal, its upper striking surface at 72 percent image height; center upper area above anvil must be clean dark sapphire stone with open empty space for an equipped weapon icon and game text; far RIGHT quarter holds ornate weapon racks and a few fantasy forging tools. Depth, foreground workbench and coal, enchanted sparks at furnace, vivid saturated colors, rich fantasy atmosphere. No human or creature, no weapon floating above anvil, no interface, no buttons, no lettering, no numbers, no border. Original illustration not based on any existing game's copyrighted art. No pale pastel, no washed-out cream scene, no realistic photograph, no generic clipart, no flat vector minimalism. This is a background art asset, not a full interface mockup.
```

## Validação

Capturas de navegador em `test-results/fantasy-*` (ignoradas no Git) mostram inventário, forja, Arena e seleção de mapas. A revisão cobre as larguras de 1536, 1024 e 390 px. Menus estreitos usam portal para o viewport, áreas roláveis e controles com tamanho de toque; o mundo de batalha mantém o enquadramento original do jogo.

A validação de encaixe mediu zero overflow horizontal no inventário e na forja em 1536, 1024 e 390 px. O cabeçalho permanece 40 px dentro da moldura no desktop e 19 px no portal mobile. Prévia/restauração no mobile e seleção de arma/pedra na forja foram exercitadas. O smoke existente passou com arraste, salvamento, recarga, poses e treino. Miniaturas dos mapas usam os PNGs `{id}-preview.png` gerados pelo renderer real, inclusive terreno e objetos atuais.

## Inventário e ferreiro — revisão de interação em 16/10/2026

- O inventário não mantém um painel de informações do item selecionado. O rodapé da mochila contém moedas e ações; tinturas e remoção de aparência ficam sob o personagem.
- Detalhes aparecem em tooltip ancorado ao item por hover, foco de teclado ou toque prolongado de 430 ms. O tooltip é renderizado fora do menu, limitado ao viewport e não intercepta cliques ou arrastes. Escape, rolagem, redimensionamento e toque fora dispensam a leitura. Toque prolongado não equipa; toque curto experimenta o item.
- A ficha mostra Ataque, Defesa, Dano, Armadura, Agilidade, Vida e Vigor. O tooltip usa `itemAttributes` do catálogo, incluindo o nível real de fortalecimento, e compara o item com o equipamento salvo. Armas ainda mostram destruição e intervalo de ângulo. Itens cosméticos informam quando não alteram atributos.
- Botões compartilham foco dourado, pressão visual, hover e estado desabilitado. Experimentar item e adicionar pedra produzem um pulso breve. Salvar apresenta carregamento e confirmação apenas após resposta do servidor.
- O ferreiro aceita clique simples, teclado ou arraste na arma e nas pedras. A orientação indica o próximo passo quando faltar arma/material, e a ação de fortalecer apresenta carregamento. A animação mantém a arte do nível atual até a resposta autoritativa; nenhum item de nível futuro é pré-visualizado.
- O compositor de ícones de roupa sempre usa a mesma pintura do corpo equipado, sem ramo SVG para roupa antiga.

Validação visual desta revisão: capturas reais em `test-results/inventory-rich-tooltip-1536.png`, `inventory-outfit-compare-1536.png`, `inventory-feedback-{1536,1024,390}.png`, `inventory-touch-tooltip-390.png` e `forge-feedback-{1536,390}.png` (arquivos locais, não versionados). O script local `test-results/inventory-feedback-check.mjs` cobre hover/foco/Escape, comparação, encaixe da moldura, clique no ferreiro, toque prolongado e confirmação do salvamento; os smokes versionados são mantidos pela integração.
- O inventário usa o componente compartilhado `LevelBadge` em 48 px. O número acompanha o nível autoritativo do perfil; as faixas visuais e a aura a partir do nível 30 são centralizadas no componente (teto de nível 50).

## Emblema de Poder e encaixe final

`public/assets/ui/power-emblem.png`: PNG RGBA 1254×1254, gerado original em 16/10/2026. Componente `PowerIcon` reutilizável (24 px por padrão), aplicado em 29 px no campo Poder da Mochila. Prompt exato:

> Create a single original game UI POWER emblem icon, on a transparent RGBA background. Square composition. A strong compact sculpted golden shield surrounding a brilliant cyan crystal core and a small upward ruby-red flame, with gold flame wings closely attached to the shield. Vivid fantasy adventure RPG, hand-painted 3D volume, deep clean outlines, controlled sharp highlights, rich saturated gold/cyan/ruby, no pastel or washed colors. Icon silhouette must be instantly readable at 24–48 pixels. Central shield and crystal should be thick, simple, bold, balanced and almost fill the square with 7% transparent padding. ONE isolated emblem only, no background panel, no floor, no ring, no pedestal, no text, no letters, no numbers, no watermark, no tiny floating sparks or debris. No swords. Transparent exterior, crisp alpha edge, no black or white background.

A Mochila agora usa um modal próprio de viewport: moldura de 40 px + respiro interno de 6 px no desktop, 19 px + 4 px no mobile. O cabeçalho e a pintura ficam fixos; apenas o corpo interno rola. Sem pedestal ou anel dourado sob o personagem. Validado com LevelBadge, sete atributos e ícone de Poder em 1536×864, 1280×720, 1024×768, 390×844, e 1536/1280/1024/390×480. Todos apresentaram zero overflow horizontal da moldura e do conteúdo. Atributos e rodapé permanecem acessíveis na rolagem interna. Evidência quantitativa local: `test-results/inventory-shell-fit.json`; captura anotada: `test-results/inventory-shell-markup-1536.png`.

## Ferreiro com Composição

O ferreiro usa a mesma moldura física, respiro e área de rolagem interna da Mochila. As duas abas funcionais ficam à esquerda no desktop e em uma linha no mobile: Fortalecer e Composição. A bancada usa três linhas de grid; a cena ocupa a altura restante, enquanto materiais e ações reservam seu tamanho natural. Isso impede que a ficha de atributos aplicados seja cortada pela moldura.

Composição seleciona equipamento elegível, um dos quatro atributos e pedra I/II/III. Exibe bônus atual → bônus proposto, chance, custo, estoque, saldo e os quatro bônus aplicados. O botão só envia a intenção ao servidor; resultado, ouro, consumo e bônus dependem da resposta autoritativa. Falha mantém o bônus anterior. Nível futuro da arma não é pré-visualizado no fortalecimento.

`public/assets/ui/composition-stones.png`: atlas RGBA 1254×1254, quatro minerais originais em grade2×2. Componente `CompositionIcon` compartilha os recortes: rubi/ataque, safira/defesa, esmeralda/agilidade e ametista/armadura. Níveis I/II/III e quantidades são texto da interface, sem texto embutido na pintura. Prompt exato:

> Create an original fantasy game ITEM ICON ATLAS, transparent RGBA canvas, square image divided into an exact 2 by 2 equal grid. Four isolated mineral stones, each perfectly centered within its own equal quadrant, completely contained with generous 16% empty transparent padding around each stone. No panel backgrounds, no borders, no text, no numbers, no labels. TOP LEFT: ATTACK mineral, bold ruby-red jagged crystal with a small golden flame embedded in the red stone, compact chunky silhouette. TOP RIGHT: DEFENSE mineral, royal sapphire-blue polished stone with a silver shield-shaped natural crystalline front facet. BOTTOM LEFT: AGILITY mineral, emerald-green crystal shard with flowing golden winglike mineral ridges. BOTTOM RIGHT: ARMOR mineral, rich violet-purple crystal ore partially enclosed in two thick golden-metal plates, solid protective silhouette. Keep all four icons similar visual weight and size, approximately 70% of each quadrant width/height. Hand-painted high quality fantasy RPG inventory illustrations, sculpted 3D volume, defined dark contours, vivid saturated pigments, strong controlled highlights, crisp readability at 32–64 px. Original designs, no copied game assets. No pastel, no white haze, no background or floor shadow outside the item. No floating sparkles. Transparent outside each isolated mineral. Strict layout: attack top-left, defense top-right, agility bottom-left, armor bottom-right.

Validação: smoke de integração confirmou composição I de ataque, consumo de40ouro/1pedra, bônus+10, atualização do tooltip e persistência após recarga; fortalecimento continua independente. Capturas e medições locais em `test-results/forge-shell-*` cobrem1536×864,1280×720,1024×768,390×844,1280×480 e390×480. O navegador não apresentou erros.
