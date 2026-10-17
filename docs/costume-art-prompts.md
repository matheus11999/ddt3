# Fantasias completas — 16/10/2026

## Entrega e contrato

Duas fantasias unissex pintadas: **Pintinho do Trovão** (`costume-thunder-chick`) e **Raposa Arcana** (`costume-arcane-fox`). Criadas com a ferramenta integrada `image_gen`, fundo transparente real; sem SVG, pixel art ou downloads de sprites proprietários. O pintinho atende ao exemplo de Thor indicado pelo usuário.

Arquivos de execução no repositório:

- `public/assets/costumes/costume-thunder-chick.png`
- `public/assets/costumes/costume-arcane-fox.png`
- Registro/compositor: `src/game/costumes.ts`.
- Integração comum a todas as superfícies: `src/game/avatar.ts`.

Os PNGs são atlases RGBA **1254 × 1254 px**, com quatro células **627 × 627 px**. Ordem: parado, primeira passada, segunda passada, combate agachado. O jogo recorta somente margens transparentes, preservando pixels pintados. Escala nominal da figura: 155 unidades fora do combate e 109 em combate. O eixo horizontal é registrado pela posição do corpo/pés, sem centralizar pela cauda ou pela capa. O chão é a última linha opaca de cada pose.

`getCostumePortrait(id)` produz um canvas de 512 × 512 usando exatamente a pintura parada do avatar. Não existe ícone alternativo com proporções ou detalhes diferentes. O carregamento utiliza o cache `asset()` existente e o evento `brasa-art-loaded`, permitindo redesenhar retratos estáticos após o primeiro carregamento.

A fantasia visível substitui todo o compositor humano sem apagar rosto, cabelo, roupa, chapéu ou óculos equipados. `visibility.costume=false` restaura essas camadas. `visibility.hat=false` usa cabelo descoberto e `visibility.glasses=false` oculta os óculos apenas no desenho; não altera itens ou atributos. A identidade visual da fantasia é idêntica em personagens masculinos e femininos.

A arma real continua independente da fantasia e respeita o parâmetro `weapon`: oculta no lobby e presente atrás do corpo em combate. O martelo e o cajado pintados são adereços da fantasia; não substituem a arma do catálogo, dano, projétil ou física.

## Movimento e limites

Caminhada alterna duas pinturas de passada e a postura de contato usando a distância real do movimento comum ao avatar; não é um boneco deslocado para cima/baixo. Quadros opacos, sem mesclar pés transparentes, compartilham o chão. Mira/carga/disparo usam a postura baixa; recuo, dano, inclinação, queda, vitória e derrota reutilizam essa pintura com transformações leves. O custo de render é uma imagem em cache por figura, além da arma e aura quando habilitadas.

É um atlas de **quatro desenhos**, não dez animações quadro a quadro. Expressões faciais, capa e dedos não têm rig independente. `animated=false` congela tempo e estado de movimento inclusive quando há redesenho por assets; mochila e loja permanecem estáticas.

## Prompts usados

### Pintinho do Trovão

Use case: stylized-concept. Asset type: production transparent 2D game sprite atlas, 2 columns by 2 rows, four FULL-BODY drawings of the EXACT SAME tiny yellow CHICK dressed as Thor. Premium painted chibi browser game art, saturated golden yellow feathers, enormous expressive amber eyes and confident small orange beak, silver winged helmet, deep navy armor with silver chest discs, rich scarlet cape, tiny brown boots, small chunky steel hammer. Volumetric cel-painted material lighting, clean dark brown contours, sharp sculpted edges, polished mobile RPG illustration, absolutely no pixel art, no vector-flat cartoon, no gray washed colors. All 4 subjects face three-quarter RIGHT, EXACT SAME costume/design/head proportions, BIG head 60 percent total height, tiny round body. 2048x2048 square with each subject fully contained in its own equal quadrant and generous transparent gutter. TOP LEFT: proud standing idle with both feet planted, hammer low at the right. TOP RIGHT: walking contact pose, left foot forward and right foot behind, cape moving back, body upright. BOTTOM LEFT: walking opposite contact pose, right foot forward and left foot behind, same head and costume and scale. BOTTOM RIGHT: compact low combat ready crouch, feet planted and wide, body low, head forward, focused eyes, hammer held low. The feet ground alignment and scale consistent in each 1024 square quadrant; no drawing crosses quadrant edges. No stage, no shadow, no floor, no glow cloud, no scenery, no frames, NO letters NO numbers NO labels NO text. Genuine transparent background. This is a costume which completely replaces the player's avatar; every drawing must include head helmet body feet cape hammer. One character repeated four times, not four costume alternatives.

### Raposa Arcana

Use case: stylized-concept. Asset type: production transparent 2D game sprite atlas, 2 columns by 2 rows, four FULL-BODY drawings of EXACTLY THE SAME adorable little orange-and-cream fox wizard. Premium painted chibi browser game art, saturated orange fur, enormous emerald expressive eyes, cream muzzle and chest, huge softly pointed ears, tiny body, broad flowing rich violet cape with blue lining and gold embroidery, oversize bent violet witch hat with sapphire crystal clasp, short brown boots, thick bushy orange cream-tipped tail sweeping behind, compact curved gold staff with one turquoise crystal. Sculpted cel-painted volume, detailed leather/cloth/metal, clean strong brown contours and beautifully defined fur. Sharp warm lights, vivid color, polished mobile RPG character illustration, absolutely NO pixel art, NO flat vector, no washed pastel haze. All drawings three-quarter RIGHT, same costume, same head scale, same face identity, head about60%bodyheight. Square 2048x2048 canvas, four equal quadrants, each figure fully in its own quadrant with generous transparent gutters. TOP LEFT standing idle with bothfeetgrounded, staff lowered diagonally. TOP RIGHT walking contact pose NEAR leg forward/right, FAR leg backward/left, cape swinging back. BOTTOM LEFT walking OPPOSITE contact pose NEAR leg backward/left and FAR leg forward/right; clearly opposite crossed leg positions to top right. BOTTOM RIGHT compact low combat ready crouch, focused eyes, paws low on staff, legs squat and spread, hat NOT taller than top-left. All drawings COMPLETE from hat top to soles, no clipping. Consistent scale and feet baseline per cell. No scenery, no floor, no shadows, no stages, no frames, no numbers, no text, no labels, no watermarks. Genuine transparent background. A full avatar costume, not detached clothing pieces, no human heads.

## Verificação

`node scripts/verify-costumes.mjs`, com Vite em 5177: 80 combinações de duas fantasias × dez poses × duas direções × dois contextos; quatro células preenchidas por atlas, ícone pintado, alternância de três contatos de caminhada, arma presente em combate, pixels idênticos entre gêneros, congelamento da prévia, restauração das roupas ao ocultar fantasia, equipamento de entrada imutável e cabelo descoberto ao ocultar chapéu.

Pranchas inspecionadas em `test-results/costumes-preview-right.png`, `costumes-preview-left.png`, `costumes-combat-right.png` e `costumes-combat-armed.png`; relatório `costumes-report.json`. Capturas são temporárias e não versionadas. `npm run check` também passou após a integração.
