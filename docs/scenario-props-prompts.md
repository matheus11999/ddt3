# Atlas pintados de objetos dos cenários

Artes originais geradas e ajustadas exclusivamente com `image_gen`, em 16/10/2026. A direção recente de `AGENTS.md` prevalece sobre os prompts antigos: cores vivas e fantasiosas, contraste claro, volume pintado e materiais definidos. As referências públicas DDTank inspecionadas orientaram a leitura de silhuetas e materiais; nenhum asset ou composição foi copiado.

## Contrato de integração

- Arquivos: `public/assets/maps/garden-props.png`, `park-props.png` e `celestial-props.png`.
- Cada atlas: **1536×1024, RGBA**, seis células de **512×512**, três colunas e duas linhas. Índices em ordem de leitura, de 0 a 5.
- Recortar o conteúdo de cada célula pelo alfa **maior que 16** e guardar o recorte em cache. A ferramenta produz resíduos de alfa 1–16 em parte dos espaços vazios, embora o fundo seja transparente; um teste `alpha > 0` gera caixas incorretamente grandes. Descartar esses resíduos no recorte evita halos e vazamento cosmético.
- Os sprites visíveis (`alpha > 16`) têm pelo menos 40 px de margem em todos os lados de suas células e nenhum cruza a célula vizinha. O alfa vai de 0 a 254. Não tratar canais RGB de pixels transparentes como um fundo pintado.
- O aro do Parque tem bbox 245×239: desenhar quadrado para rotação frontal circular. Cabines devem permanecer aprumadas e independentes do giro do aro. Suporte, telhado e base são fixos.
- Props são arte decorativa; dano, cratera, queda e colisão continuam sob responsabilidade da geometria e do servidor.

## Conteúdo e caixas medidas

Caixas locais `[left, top, right, bottom]`, com bordas direita e inferior exclusivas, considerando `alpha > 16`.

| Atlas | Slot | Conteúdo | Caixa alfa |
| --- | --- | --- | --- |
| garden | 0 | Cerca entalhada com flores e metal | `[150, 198, 403, 369]` |
| garden | 1 | Moita de flores laranja, carmesim e azul | `[117, 166, 401, 407]` |
| garden | 2 | Raízes pendentes orgânicas | `[142, 170, 365, 414]` |
| garden | 3 | Nuvem volumétrica azul | `[132, 160, 418, 343]` |
| garden | 4 | Caixa de madeira esmeralda e ouro | `[157, 150, 370, 350]` |
| garden | 5 | Barril de madeira com cintas verdes | `[169, 133, 346, 353]` |
| park | 0 | Aro frontal da roda-gigante, sem cabines | `[140, 159, 385, 398]` |
| park | 1 | Suporte A azul real e ouro | `[135, 146, 379, 401]` |
| park | 2 | Cabine estilo carruagem de carnaval | `[160, 153, 342, 401]` |
| park | 3 | Telhado do carrossel rubi/azul/ouro | `[114, 125, 410, 368]` |
| park | 4 | Base elíptica do carrossel | `[121, 239, 392, 354]` |
| park | 5 | Cavalo de carrossel com sela e haste | `[146, 108, 386, 387]` |
| celestial | 0 | Estátua de ave guardiã em pedra azul/ouro | `[170, 153, 376, 453]` |
| celestial | 1 | Cristais ciano e ametista | `[142, 168, 368, 452]` |
| celestial | 2 | Ilha pontuda com ruína arquitetônica | `[112, 140, 361, 470]` |
| celestial | 3 | Nuvem volumétrica azulada | `[89, 109, 440, 356]` |
| celestial | 4 | Bandeira azul real com sol fictício dourado | `[158, 61, 404, 359]` |
| celestial | 5 | Friso de pedra azul e ouro | `[73, 214, 415, 335]` |

## Prompts iniciais

### garden

```text
Create ONE finished original hand-painted 2D fantasy game sprite atlas, exactly 1536 pixels wide by 1024 pixels tall, RGBA PNG on genuinely transparent background. CRITICAL TECHNICAL LAYOUT: exactly 3 columns by 2 rows; each invisible cell is exactly 512x512. Each isolated object must be centered in its own cell, entirely confined to the inner 416x416 area, with AT LEAST 48 fully transparent pixels of padding on ALL FOUR cell edges. Row-major arrangement: top-left slot0, top-middle slot1, top-right slot2, bottom-left slot3, bottom-middle slot4, bottom-right slot5. No labels, grid lines, frames, contact shadows outside object, floor, backdrop, checkerboard painting, text, letters or numbers. Alpha must be empty between all sprites. This is a game-ready sprite atlas, NOT one connected scene.

STYLE: bespoke original polished commercial 2D fantasy artillery game illustration with rich brushed pigments, strong confident dark warm contours, dimensional edge highlights and cool deep shaded recesses, readable chunky shapes, clear textures of wood, bark, leaf and metal. Extremely vibrant and fantastical colors: emerald green, viridian, electric blue, tangerine orange, crimson red, antique gold, strong cool blue shadows. Clean whimsical miniature world but NOT simplistic vector icons, NOT flat clip art, NO pastel wash, NO milk haze, NO beige uniform lighting, NO photorealism, NO 3D render. Light from upper left throughout. Objects shown in side-view or slight three-quarter depth suitable for a side-view game. Small details support big strong silhouettes.

CELL CONTENTS, exactly in this order:
slot0 top-left: a short wide ornate rustic fence segment, three thick warm chestnut wood posts and two bent horizontal rails, carved leaf motifs, small forged dark teal metal braces and rivets, vivid emerald vine growing around it with three crimson flowers; isolated readable warm weathered wood grains; width about400 height280.
slot1 top-middle: a lush asymmetric clump of fantastical garden flowers and foliage, big fiery tangerine blossoms, crimson scarlet blooms and a few saturated cobalt blue flowers, layered dark emerald leaves with bright lime-lit veins; no pot or ground; width400 height340.
slot2 top-right: one hanging tangled woody root cluster, thick expressive organic chestnut roots interlacing then tapering downward, turquoise moss hugging top, sparse emerald leaves, varied interesting silhouette and deep bark creases; roots hang from a horizontal cropped ROOT MASS but all within cell, not a terrain slab; width370 height405.
slot3 bottom-left: one isolated compact volumetric fantasy cumulus cloud, richly sculpted forms with a brilliant azure/cyan illuminated rim, saturated royal blue/lavender underside shadows and sunlit cream-white highlights only on the top third; sky blue shaded rounded volume, not a milky white blob, no sky/background; width405 height280.
slot4 bottom-middle: one wooden garden supply crate, three-quarter frontal view, thick polished emerald-painted wood slats worn to warm brown along bevels, heavy ornate gold corner protectors and rivets, gold curving leaf-shaped latch, clearly a square crate with closed lid; width330 height330.
slot5 bottom-right: one squat enchanted garden barrel, warm reddish chestnut wooden staves with detailed grain, dark forest-green hoops accented with bright warm gold rivets, small carved leaf emblem centered, closed wooden lid visible in slight depth, dimensional well-rendered prop; width300 height365.

Each sprite must remain entirely isolated and fit within the specified inner safe area. Make the transparent gutters unmistakably empty. Original assets only; no proprietary game emblems.
```

### park

```text
Create ONE finished original hand-painted 2D fantasy carnival game sprite atlas, exactly 1536 pixels wide by 1024 pixels tall, RGBA PNG with genuinely transparent background. TECHNICAL LAYOUT IS CRITICAL: exactly 3 columns by 2 rows with equal invisible 512x512 cells. Each of six separate object sprites is centered inside its OWN cell and fits entirely within the inner 416x416 pixel safe area with AT LEAST 48 transparent pixels on EACH of the cell's FOUR edges. No object may overlap or touch any other cell. Slot0=top-left, slot1=top-middle, slot2=top-right, slot3=bottom-left, slot4=bottom-middle, slot5=bottom-right. NO visible grid, NO labels/text/numbers, NO frame, NO floor, NO painted checkerboard, NO ground shadow beyond an object. Fully transparent spaces between sprites. This is a separated animation-parts atlas and NOT a scene.

ART STYLE: lush highly crafted original commercial hand-painted 2D fantasy game art, miniature magical carnival, strong dimensional brush rendering, defined dark blue/purple contours, jewel saturated colors, rich carved surfaces, burnished bright gold details, polished painted wood, ornate fantasy fittings. Palette ruby-red lacquer, royal cobalt blue, electric turquoise tiny accents and gleaming marigold gold. Deep purple shadows and small sunlit warm highlights make volume. Same strong upper-left light on all parts. NO pastel, NO washed-out haze, NO generic flat vector icons, NO photorealism, NO 3D renderer. Beautiful original silhouettes; every part will be assembled in side-view game so make architecture nearly frontal with only enough depth to show material.

EXACT SIX PARTS:
slot0 top-left: ONLY a perfectly FRONT-FACING circular Ferris wheel rim and spokes with central jewel hub. One 395px diameter circle with ornate ruby red and polished gold outer ring, decorated royal blue metal radial spokes and ornate gold joints, genuine empty alpha spaces between spokes. Geometrically round viewed head-on, NOT ellipse. NO cabins, NO support stand, NO ground, NO wires beyond circular rim. This ring rotates around its center in game.
slot1 top-middle: ONLY the triangular A-shaped support stand of the Ferris wheel, frontal view, sturdy two royal blue metal legs with elaborate gold filigree braces and ruby jewel bolts, joined at a gold circular top pivot, horizontal crossbrace. Width about300 height395. NO wheel, NO cabins, NO background. Its feet have little decorative gold shoes.
slot2 top-right: ONLY one small passenger gondola designed as an ornate miniature carnival carriage, rounded ruby lower basket, two short gold suspension arms and hook at top, curved royal blue canopy roof, gold filigree rails, OPEN central passenger space transparent, no people, front view slightly dimensional, width300 height330. This hangs from the wheel.
slot3 bottom-left: ONLY the crown and roof of a carousel, wide elegant conical scalloped canopy alternating rich ruby and cobalt panels with gold trim, tall gold decorative finial at center, jewel finial ornament, carved gold hanging scallops under eaves, small warm bulb dots along rim; width405 height285. NO center pole, NO horses, NO base.
slot4 bottom-middle: ONLY a carousel floor/base, wide low elliptical stage platform seen slightly from above but nearly side-on, polished warm mahogany floor boards, deep blue ornate apron with gold shell-like carvings and ruby inset gems, thick scalloped rim; width405 height160. NO roof, NO poles, NO horses.
slot5 bottom-right: ONLY one side-facing elegant carved carousel toy horse rearing gently, rich ivory painted wood with warm gold bevels and cobalt shadow planes, flowing gold mane and tail, royal blue saddle with ruby saddlecloth and gold embroidery, slender vertical gold ride pole passing through center with visible ends inside cell; width330 height400. A handcrafted sculptural TOY horse, not alive, not unicorn, no rider, not a rocking horse, no base.

Keep every sprite complete and fully inside its own padded square. Preserve TRUE alpha, including openings within structures. Original graphics, no branded logos.
```

### celestial

```text
Create ONE finished original hand-painted fantasy fortress game PROP ATLAS, exactly 1536x1024 pixels landscape RGBA PNG with genuinely transparent background. IMPORTANT TECHNICAL ARRANGEMENT: six independently isolated sprites centered on an invisible exact 3-column 2-row grid, cells512x512, row-major slots0 through5. Each individual sprite entirely inside its inner416x416 safe area with AT LEAST48px completely empty transparent margins on all four sides of EACH cell. No content touching adjacent cell. No labels, letters, numbers, grid, outline of cells, frame, floor, backdrop, painted checkerboard or outside ground shadows. This is an alpha sprite atlas, NOT a continuous scene.

STYLE: original professional commercial hand-painted 2D fantasy artillery game props, ornate monumental sky kingdom in miniature, rich textured brush rendering with confident dark ultramarine contours, strong volume, substantial chiseled architecture and intricate but readable material details. Saturated jewel palette: royal cobalt and lapis stone, cyan light, deep amethyst crystals, warm luminous gold metal; shadows indigo/violet, highlights bright cool blue and warm sunlight from upper-left. Fantastical alive colors; NO pale pastel treatment, NO milky atmosphere, NO grey fog, NO flat vector icon styling, NO photorealism, NO 3D render. A coherent art set for a 2D side-view arena.

EXACT ROW-MAJOR CONTENTS:
slot0 top-left: an original standing winged bird-dragon guardian STATUE on a small plinth, side three-quarter profile facing right, proudly lifted crested head, closed wings carved with feather and scale patterns, sturdy taloned feet, carved from deep royal BLUE STONE with chiseled cobalt highlights, antique gold ornamental chest inlay and golden head crest tips; expressive dignified fantasy architecture, not a living creature; width330 height405.
slot1 top-middle: one striking asymmetrical crystal cluster, chunky faceted cyan/aquamarine tall main prism with an amethyst-purple secondary prism and small saturated blue shards, small rugged lapis stone foot, clear dark edges and sharp reflected highlights, restrained luminous center without huge bloom; width345 height385.
slot2 top-right: one distant floating island carrying a tiny RUINED arched architectural structure, island rocky underside is a long sharply tapering pointed lapis/amethyst mass, ancient blue stone broken arch and two gold-capped little columns on top, vivid teal moss at rim, no clouds and no atmosphere backdrop; a complete narrow pointed island silhouette, width360 height405, not a massive terrain slab.
slot3 bottom-left: one compact sculpted cumulus cloud, vivid cyan edges, bright sunlit upper facets and rich blue-violet/royal blue volumetric underside shadows; more saturated blues than white; dramatic distinct lobes with painterly dimensional shading, no sky and no floor; width405 height285.
slot4 bottom-middle: one fantasy fortress FLAG on a short ornate gold pole with a gold spear-like finial, rich royal blue cloth waving gently to the right, gold hem and a large original simple golden sun emblem with eight triangular rays at the cloth center, no letters or real world emblem, cloth has folded cobalt/indigo shadows and electric blue edges, pole entirely within cell; width340 height395.
slot5 bottom-right: one horizontal architectural stone FRIEZE/CORNICE fragment, long broad lapis blue beveled stone band with chunky layered edge molding, ornate carved gold winding sun-ray inlays and two tiny cyan jewel insets, dark blue lower shadow; side-front view with subtle top plane, ends complete and visible, width405 height165; NO whole wall or castle.

Each object is complete and generously surrounded by genuine alpha. No cut off tips; all six sprites separate. Rich and textured professional miniature world props, original work only.
```


## Primeira correção de layout

A geração inicial ultrapassou as células; a primeira edição preservou os objetos e reduziu seus tamanhos. Ela ainda deixou alguns conteúdos cruzando a divisão horizontal. Foi aplicada a segunda edição abaixo antes da cópia final.

```text
TECHNICAL RE-LAYOUT EDIT of the provided original sprite atlas, retaining exactly the SAME SIX handpainted original props, colors and materials. Correct the sprite sizes and positioning ONLY, do not change which object belongs to which slot. The current props are oversized, touch their neighbors and cross cell boundaries, which breaks the game. Make them MUCH SMALLER and separated with LARGE EMPTY TRANSPARENT GUTTERS.

Output exactly1536x1024 RGBA PNG. Invisible grid3 columns by2 rows, each512x512. Put each COMPLETE prop wholly inside the following exact SAFE rectangles, positions listed as left,top,right,bottom in pixels:
top-left: (96,96)-(416,416), center(256,256);
top-middle: (608,96)-(928,416), center(768,256);
top-right: (1120,96)-(1440,416), center(1280,256);
bottom-left: (96,608)-(416,928), center(256,768);
bottom-middle: (608,608)-(928,928), center(768,768);
bottom-right: (1120,608)-(1440,928), center(1280,768).
The MAXIMUM dimension of ANY object is ONLY320 pixels; keep natural aspect ratio. The objects collectively occupy only about ONE THIRD of the canvas area. Visually the props must be significantly smaller than in the reference. LEAVE WIDE EMPTY GUTTERS. No sprite from one cell is allowed even partially inside another cell. It is okay to have much empty space. DO NOT FILL THE IMAGE with big sprites.

Remove the whole colored backdrop/blur/halos and make all space outside solid painted object edges FULLY TRANSPARENT ALPHA0. Fully opaque solid objects, natural antialiased edge only. KEEP inner holes between wheel spokes, fence rails, branches, supports TRANSPARENT. No fake transparency patterns. No background gradients, no fog, no glows extending beyond cutout, no floor or shadow, no grid, no text. Preserve beautiful saturated painted texture, clean contours and strong dimensional shading. This is precise game-sprite sheet production, not a poster.
```

## Segunda correção de layout

Os valores de tamanho solicitados são intenção do prompt; as medidas efetivas constam na tabela. A inspeção final confirmou separação das células e margens dos pixels visíveis.

```text
Please EDIT this sprite sheet to solve a precise engineering problem: SIX SPRITES MUST BE MUCH SMALLER and have LARGE CLEAR TRANSPARENT MARGINS around each one. Keep the six existing original painted props and their saturated textured rendering exactly recognizable. Reduce each current sprite to approximately 60 PERCENT of its CURRENT SIZE, preserving its own natural aspect ratio. This image should have lots of empty space. Do NOT maximize object sizes or beautify their arrangement.

Canvas1536x1024, fixed3-column2-row grid, cells512x512. The exact sprite CENTERS must be (256,256),(768,256),(1280,256),(256,768),(768,768),(1280,768). EACH WHOLE PROP must have its LONGEST DIMENSION ONLY220px. A sprite's uppermost/lowest/leftmost/rightmost pixels must not lie more than110px from its cell center. Top row therefore centered at y256 and fits entirely y146 through366. Bottom row centered at y768 and fits entirely y658 through878. Column1 centered x256, column2 x768, column3 x1280. Uniform central alignment within EACH cell; do NOT align top row by base or bottom row by roof.

Preserve all6 distinct cutouts in their current order. All empty surroundings must be TRUE FULLY TRANSPARENT alpha0. Do not paint a colored blurred background, dark background, fog, glow, vignette, reflections outside edges, or ground shadows. Make solid pixels opaque, small antialiased object edges, and all other pixels fully transparent. No checkerboard, no visible grid, no labels. After shrinking the props the majority of the canvas MUST be blank transparent. This is a technical game-ready atlas, not an illustration poster.
```

## Verificação

- Inspeção visual das três pinturas e das duas correções, mantendo os 18 objetos na ordem combinada.
- Leitura dos PNGs com Pillow somente para inspeção (sem editar os arquivos); formato RGBA e dimensões 1536×1024 confirmados.
- Teste de todas as 18 caixas com `alpha > 16`: margem mínima de 40 px aprovada.
- PNGs finais copiados diretamente das saídas da ferramenta. Fontes do jogo, atlas de outros artistas e arquivos existentes não foram alterados por esta entrega.
