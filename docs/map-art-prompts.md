# Artes de cenários

Geradas com a ferramenta integrada `image_gen` (skill imagegen). Artes originais, usadas como camadas independentes e texturas; a geometria jogável pertence à simulação autoritativa. Os arquivos finais ficam em `public/assets/maps/`.

## Regra atual de contraste entre camadas — 16/10/2026

Escurecer **levemente somente o fundo decorativo em parallax** para separar o cenário distante da ação. O terreno jogável, personagens, armas, projéteis, indicadores e HUD permanecem nítidos, com suas cores e iluminação preservadas. Aplicar a atenuação na composição das camadas de fundo; nunca sobrepor uma camada escura ao quadro completo nem alterar a máscara de colisão. Não usar desfoque ou névoa leitosa para obter essa separação.

Manter pigmentos vivos e materiais definidos. Esta direção prevalece sobre descrições históricas de tons pastéis abaixo. Os prompts registram a origem dos assets; a regra orienta novas pinturas e a composição em tempo real, cuja verificação pertence ao renderer.

## garden

Arquivo: `public/assets/maps/garden-midground.png`

Use case: stylized-concept. Asset type: transparent midground scenery layer for a polished 2D side-view chibi artillery browser game, wide 1536x864 landscape. Create an original enchanted garden scenic silhouette cluster: rounded peach blossom tree canopy on far left, lush lavender and emerald shrubs, tiny ornate cream marble fountain and arched garden gate near center, a tall blue-green whimsical tree on far right, cottage roof glimpses and flowerbeds. Fine hand-painted game illustration, warm clean outlines, dimensional soft highlights, richly detailed natural materials, friendly fantasy storybook craft. View straight from side with slight depth, NOT isometric or topdown. The scenery occupies lower 70% of image with top transparent, irregular silhouette and organic lower edge. Keep center upper area largely open for projectile visibility. This is only a non-colliding decorative midground layer; NO playable ground platform, NO sky, NO flat background, NO text, UI, characters, weapons or frame. Genuine transparency around all objects; trees connected visually by small shrubs, no opaque rectangular backdrop.

## park

Arquivo: `public/assets/maps/park-midground.png`

Use case: stylized-concept. Asset type: transparent midground scenery layer for a polished 2D side-view chibi artillery browser game, wide 1536x864 landscape. Create original magical amusement park architecture: richly painted striped pastel coral and cream tents, whimsical ticket kiosk, ornate little candy shop, distant looping rollercoaster structure, decorative turquoise trees and warm carnival bulb strings. Hand-painted 2D commercial game illustration, warm clean outlines, dimensional soft highlights and detailed materials, friendly fantasy storybook craft. View straight from side with slight depth, NOT isometric. Structures occupy lower 60% with irregular skyline. Leave left upper half open for a separately animated Ferris wheel and leave right upper half open for separate carousel. NO Ferris wheel or carousel in this layer. This is only a non-colliding decorative midground, NO playable ground platform, NO sky, NO flat background, NO text UI characters weapons or frame. Genuine transparency around all objects; buildings visually connected by shrubs and banners, no opaque rectangle.

## celestial

Arquivo: `public/assets/maps/celestial-midground.png`

Use case: stylized-concept. Asset type: transparent midground scenery layer for a polished 2D side-view chibi artillery browser game, wide 1536x864 landscape. Original magical celestial fortress silhouette: ornate ivory and lilac castle towers with blue slate pointed roofs, gold crescent finials, carved arches, elegant stone balcony and bridge architecture, blue luminous crystals embedded in columns, monumental but friendly whimsical fantasy. A large central castle rises tall with smaller satellite towers left and right. Rich hand-painted 2D game illustration, clean warm outlines, dimensional soft highlights, detailed stonework and warm sunlight, atmospheric pale blue lower walls. View straight side with depth, NOT isometric. Transparent around castle silhouette and beneath architecture. This layer is DISTANT NON-COLLIDING scenery, not the playable ground. NO sky, NO full background, NO text, UI, characters or frame. Do not include a massive ground platform; only the castle architecture silhouette with delicate wisps of cloud at lower edge.

## garden-terrain

Arquivo: `public/assets/maps/garden-terrain.png`

Use case: stylized-concept. Asset type: large seamless-feeling terrain MATERIAL texture for a colorful 2D fantasy artillery game, landscape 1536x864. Fill the entire image edge to edge with the SIDE CROSS-SECTION OF ENCHANTED GARDEN EARTH: softly illustrated honey-brown rich soil, embedded rounded peach stones and smooth pale river rocks, curling roots, tiny luminous lavender mineral flecks, elegant sediment striations. A handpainted commercial 2D game texture with dimensional warm highlights and gently dark crevices. Organic detailed material, no large cave holes, no scenery, NO sky, no characters, no buildings, NO grassy top edge: the engine adds a separate grass surface to arbitrary destructible contours. Even illumination, no composition focal point, no text. Avoid photographic dirt and pixel art.

## park-terrain

Arquivo: `public/assets/maps/park-terrain.png`

Use case: stylized-concept. Asset type: terrain MATERIAL texture for a polished 2D fantasy carnival artillery game, landscape 1536x864. Fill image edge to edge with a SIDE CROSS SECTION of pastel warm terracotta soil with chunky cream limestone cobbles and rounded amber rocks, delicate curling roots and layered colored sandstone seams. Commercial handpainted 2D game material, clean soft warm outlines, shaded dimensional stones, a friendly fairytale style. Organic nuanced detail throughout, NO scene, sky, buildings, characters, tunnels, grassy top edge, words or UI. No photographic dirt, no pixel art.

## celestial-terrain

Arquivo: `public/assets/maps/celestial-terrain.png`

Use case: stylized-concept. Asset type: terrain MATERIAL texture for a polished 2D celestial fortress artillery game, landscape 1536x864. Fill image edge to edge with magical pale IVORY AND BLUE LILAC MARBLE ASHLAR STONEWORK, elegant varied fitted blocks with beveled rounded edges, fine gold inlay runic decorative curves with no legible text, occasional tiny blue inset gemstones, dimensional hand painted masonry shadows and warm highlights. Lower areas can show rougher floating island pale violet crystal stone interlocked with refined masonry. Original fantasy 2D commercial game illustration, rich fine detail. NO entire castle, no sky, no characters, no platform shape, no background or scene, texture only. Not flat vector, not photographic, not pixel art.
