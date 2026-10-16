# Original game artwork

Mode: built-in `image_gen.imagegen` generation and targeted edits. No fallback CLI. Original artwork and original-derived variants, not copied game assets. Generated source PNGs preserve their native alpha in `public/assets/`; superseded variants are retained with version suffixes.

## Initial lobby (archived)

- File: `public/assets/lobby-v1.png`
- Dimensions: 1672 × 941 px (RGB).
- Intended game use: full scene background for plaza, traversable ground in lower half. Crystal fountain around x35%, arena entrance upper-right.
- Inspected: no characters, lettering, UI or watermark.

```text
Use case: stylized-concept
Asset type: Original 2D browser MMORPG plaza environment background, wide 16:9 landscape 2048x1152.
Primary request: A richly illustrated medieval fantasy town plaza for a cute chibi artillery multiplayer game. Polished hand-painted anime game environment, dimensional and delightful, fine readable edges and lush materials, not pixel art.
Scene/backdrop: Golden sandstone town walls and orange terracotta turret roofs across the upper half, warm ivy-clad archways, banners without markings, a monumental blue-shadowed arched ARENA entrance in the upper-right quadrant framed in ornate gold and warm stone. Cyan glowing crystal fountain in the middle-left with a round turquoise pool and gentle water jets. Open curving pale sandstone cobblestone plaza across the whole bottom half with clear traversable space for small player sprites. Pretty hedges and flower beds at far edges, distant towers and blue sky.
Composition/framing: Fixed isometric-ish front 3/4 camera at modest downward angle like a classic 2D casual MMORPG social hub. Buildings fill upper 55%; fountain center at x35%, y55%; unobstructed paving from y60% to bottom edge. Wide immersive game environment fills full image. Small decorative roof and stone details; avoid overly intricate noise on paving.
Lighting/mood: Bright inviting late-afternoon sun, soft shadows, turquoise water, warm gold stone, green ivy, terracotta roofs, deep blue shadows.
Constraints: ORIGINAL artwork. No characters, people, animals, text, letters, signs with words, numbers, logos, watermarks, UI, icons, borders, frame, pixel art, photorealism, or white margins. Make an actual in-game environment asset, not a website.
```

## Initial battlefield (archived)

- File: `public/assets/battlefield-v1.png`
- Dimensions: 1672 × 941 px (RGB).
- Intended game use: fixed or parallax background behind separately rendered destructible terrain.
- Inspected: architecture in upper part and side edges, lower half clear sky; no characters, UI, or lettering.

```text
Use case: stylized-concept
Asset type: Original 2D browser artillery combat game background, wide 16:9 landscape 2048x1152.
Primary request: A richly illustrated floating sky ruins landscape for a cute chibi artillery multiplayer game. Polished hand-painted anime casual MMORPG environment, lush dimensional materials, fine readable edges, not pixel art.
Scene/backdrop: Radiant blue sky and fluffy clouds, very distant airborne sandstone islands and elegant ancient temples, warm sunlit cream columns and arches covered in greenery, turquoise glints from small crystals, hazy mountain silhouettes below. Main architectural features are distant and arranged in upper half and extreme side edges. Lush greenery and tiny wildflowers on floating ruins at left and right. A distant arched bridge and a soft glowing waterfall drifting into clouds. Entire lower 40% is soft open blue atmospheric sky and wispy cloud haze, with NO foreground terrain/platforms/rocks, because the destructible landscape will be rendered separately by the game engine. Center combat region is clear and uncluttered.
Composition/framing: Wide side-scrolling 2D artillery game stage background, fixed horizon around y40%. Strong sense of fantasy scale and depth. NO close foreground elements. Background parallax painting only.
Lighting/mood: Bright inviting afternoon sun from upper left, luminous sky, warm sandstone, fresh moss green, turquoise accents, clear readable contrast for characters layered over.
Constraints: ORIGINAL artwork. No characters, creatures, people, text, letters, numbers, logos, watermarks, UI, borders, frames, pixel art, photorealism, or white margins. Avoid floor and foreground ground because ground is a separate layer.
```

## Adventurer

- File: `public/assets/adventurer.png`
- Dimensions: 1254 × 1254 px (RGBA).
- Genuine generated transparency preserved: 1,128,781 fully transparent pixels; 443,735 pixels with nonzero alpha.
- Visual silhouette approximately x285–950, y10–1233. Tiny generated antialiasing/noise pixels extend raw nonzero bounds to x0–1235, y9–1237, so rendering/cropping should use visual bounds, not raw alpha-only bounds.
- Suggested feet origin in source image: (650, 1228).
- Suggested head/face area in source image: x430–860, y300–620.
- Inspected: one fully visible neutral character, empty hands, no hat or weapon.

```text
Use case: stylized-concept
Asset type: Transparent PNG character sprite for an original high-quality 2D chibi fantasy browser artillery game.
Primary request: One adorable chibi adventurer boy, FULL BODY standing relaxed, facing slightly to the RIGHT in three-quarter side view, hands at sides with palms empty and visible. Chestnut brown spiky swept hair, huge glossy chocolate brown eyes, cheerful confident small smile. Cream long-sleeved shirt, simple warm brown sleeveless vest with subtle gold buttons, brown shorts, plain brown leather ankle boots. NO hat, NO weapon, NO accessories, NO scarf, NO belt pouch.
Style/medium: Polished hand-painted 2D anime sprite with clean dark warm outlines, soft dimensional cel shading, subtle highlights, lovely detailed hair, large glossy eyes, cute proportions: head 48% of body height, compact small body and stubby limbs. Charming early casual MMORPG chibi art, production game sprite. No pixel art, not 3D render, no photo.
Composition/framing: Single entire character centered with generous empty transparent margins on every side, character occupies 76% image height, feet fully visible, flat orthographic near-front 3/4 view. Neutral idle standing pose, no ground shadow. Square image 1024x1024.
Background: Genuine transparency, alpha channel, no background.
Constraints: Exactly ONE character. No text, watermarks, branding, extra objects, additional figures, scene, backdrop, platform, floor, cast shadow or border. All background pixels transparent. Distinct clean silhouette for overlay in game scene.
```


## Active lobby revision (street)

- Active file: `public/assets/lobby.png`, 1672 × 941 RGB.
- Earlier plaza preserved at `public/assets/lobby-v1.png`.
- User direction: close horizontal street, reference-inspired compact cartoon rendering, future shops plus arena building. No distant fantasy vista.
- Reference image inspected before generation; provided as style/composition reference to built-in imagegen.
- Arena double doors are approximately x1220–1500, y180–500 in source image. Street sidewalk is y550, entire lower ~40% is open walking space.
- Inspected: no player characters, UI, text or watermark.

```text
Use case: stylized-concept
Asset type: Production browser-game environment background, 16:9 wide 1536x864.
Input image: Style, camera proximity, materials and color distribution REFERENCE ONLY. Create a NEW environment scene inspired by reference, not a screenshot editing exercise.
Primary request: A very close side-on horizontal medieval chibi MMORPG STREET, in the chunky saturated 2.5D cartoon style of the provided game screenshot. Camera perpendicular to the street and only slightly elevated, flat stage-like view, very limited depth. Giant close building facades fill the upper 55% of the frame, oversize cream/yellow stone bricks with strong brown outlines, burgundy/red conical shingled roofs cropped by the top edge, stout rounded towers, golden ornate window frames, very big wooden arched doors. Three adjoining facades from left to right: cozy shop with small timber awning and shutter windows, taller central fantasy guild facade with a jewel-shaped purple ornament, broad ARENA gateway at upper-right around 76% width with enormous wooden double doors and two red-roof round towers. Doors meet the same horizontal pavement/sidewalk line around y55% image height; this is one flat walkable street. There is a small low circular turquoise fountain near the LEFT sidewalk only, cyan diamond center and thin parabolic blue water streams; it occupies less than 25% image width. Black chunky lanterns attached to buildings. Small green bushes around the side of doors.
The entire lower 45% of image must be a wide open horizontal walking street of giant warm yellow/cream cartoon paving slabs, enough unobstructed empty space for chibi player sprites in both directions. NO huge fountain obstructing street.
Style/medium: Very faithful to the provided REFERENCE environmental rendering: 2009-2014 Korean/Chinese cute 2D browser MMORPG, brightly saturated cartoon forms, slightly pre-rendered dimensional cel shading, thick painted outlines, big simple readable geometry, yellow-green stone light, dark warm shadows, bold cyan fountain. Compact cozy game world. Do NOT turn this into generic fantasy concept art or a scenic realistic painting.
Composition constraints: Close zoom, no distant vista, no visible sky band, no vanishing-point street, no cathedral, no distant castle panorama, no mountains, no enormous ornate fountain, no photographic textures, no pixel art. Reference-inspired street composition must fill frame edge-to-edge.
Absolutely NO characters, people, animals, silhouettes, balloons, text, letters, lettering, numbers, HUD, UI, borders, watermarks, minimap, chat box, logos or icons. Only the game environment background.
```

## Active battlefield revision

- Active file: `public/assets/battlefield.png`, 1672 × 941 RGB.
- Earlier floating island scene preserved at `public/assets/battlefield-v1.png`.
- Closely rendered chunky cartoon garden ruins with outlined trees, mushrooms, small waterfalls; pale atmosphere along lower third for separately drawn terrain.
- Inspected: no characters, UI, text or watermark.

```text
Use case: stylized-concept
Asset type: Production 2D side-view artillery combat background, wide 16:9 image.
Input image: Style reference for colors, chunky painted forms, dimensional cel shading and outlined surfaces only. Do not include any UI or characters from reference.
Primary request: Original whimsical forest-garden medieval ruins combat background in a very polished 2009-2014 Korean/Chinese chibi browser MMORPG visual style. Closely packed chunky cream-stone arch ruins with broad dark painted outlines, oversize curled tree trunks, rounded emerald and lime tree foliage, a few large cute red mushrooms with cream spots near the far left and right edges, warm old stone garden walls and jewel-blue small waterfalls in background. Bright saturated color, yellow-green sunlight, soft blue shadows, 2.5D pre-rendered cartoon appearance. Flat side-view camera, compact stage-like composition with limited depth, similar environmental rendering to attached game reference. Distant pale cyan atmospheric clearing through central arch.
COMPOSITION: Background layer only, no solid foreground. Ruins and tree canopy occupy top 50% and far left/right edges; middle 50% width is a soft uncluttered pale cyan-green sunlit clearing. Lower 40% is empty pale turquoise atmospheric haze and subtle soft vegetation silhouettes far in the distance, suitable behind a separately rendered destructible ground layer. Do not draw a foreground floor, terrain platform or ground surface; engine will render those.
Style: Chunky simple cartoon geometry, visible clean dark outlines, broad painted gradients, oversized plants and blocks, cute casual anime MMO scenery. NO tiny realistic texture or majestic high-fantasy panorama. No long deep perspective, no cathedral or castle vista. Non-pixel-art.
Constraints: NO characters, people, animals, faces, text, numbers, lettering, signs, HUD, UI, borders, watermarks, icons, screenshot overlays, or weapons. Image fills entire canvas.
```

## Weapon sprites

Generated separately in built-in imagegen mode with `transparent_background: true`. Each original is 1254 × 1254 RGBA with genuine transparent corners (alpha 0); no resizing, alpha extraction or painted edits were applied. Full silhouettes inspected. All point diagonally toward the upper right.

### Ember

File: `public/assets/weapon-ember.png`. Orange-red brass dragon cannon.

```text
Use case: stylized-concept
Asset type: Original transparent PNG equipment sprite/icon for a high quality chibi anime fantasy artillery browser game.
Primary request: ONE compact playful dragon-head hand cannon. Short stout orange-red carved dragon head forming the barrel, a wide circular glowing fiery orange mouth aimed diagonally upper-right, small cheerful horn shapes, polished brass and warm gold mechanical accents, dark red compact handle angled down-left, small turquoise jewel accents. Cute but powerful toy-like heroic fantasy weapon, held easily by a small chibi character. Complete standalone weapon, no character or hands.
Style: Hand-painted 2D anime game equipment sprite, clean warm dark contour, rich cel shading with gentle painted material detail, dimensional highlights and bold readable silhouette, matches cute brown-haired chibi MMORPG adventurer. Not photorealistic, not pixel art, not 3D render.
Composition: square 1024x1024 transparent canvas, full object centrally placed with generous transparent empty margin on all four sides, weapon occupies about 65% canvas area. Barrel directed diagonally upper-right, short grip lower-left. Actual alpha transparency, no ground shadow.
Constraints: Exactly one weapon. No UI, text, lettering, numerals, frames, border, watermark, symbols, backdrop, floor, smoke cloud, particles detached from weapon, extra weapons, human hands, character. Preserve all edges within frame.
```

### Volt

File: `public/assets/weapon-volt.png`. Cobalt and silver electric coil cannon.

```text
Use case: stylized-concept
Asset type: Original transparent PNG equipment sprite/icon for a high quality chibi anime fantasy artillery browser game.
Primary request: ONE compact whimsical blue-silver steampunk electric coil cannon. Short chunky cannon with luminous faceted cyan crystal inside barrel, silver-blue concentric coils and polished silver rings along body, deep cobalt enamel panels, tiny warm brass screws, three slim cyan glass electric tubes, compact navy pistol grip lower-left. Barrel mouth aimed diagonally upper-right. Soft restrained blue electric energy glow contained inside barrel and between coils, weapon silhouette clean and distinct. Powerful cute fantasy equipment held by a chibi character, complete standalone weapon, no person or hands.
Style: Hand-painted 2D anime game equipment sprite, clean dark navy contour, rich cel shading with gentle painted material detail, dimensional metallic highlights, bold readable silhouette, matches polished cute brown-haired chibi MMORPG adventurer. Not photorealistic, not pixel art, not 3D render.
Composition: square 1024x1024 genuinely transparent canvas, full object centered with generous transparent empty margin on all four sides, weapon occupies about 65% canvas area. Barrel directed diagonally upper-right, short grip lower-left. No ground shadow.
Constraints: Exactly one weapon. No UI, text, lettering, numerals, frames, border, watermark, symbols, backdrop, floor, smoke cloud, particles detached from weapon, extra weapons, human hands, character. Preserve all edges within frame.
```

### Crystal

File: `public/assets/weapon-crystal.png`. Purple amethyst flower artillery staff.

```text
Use case: stylized-concept
Asset type: Original transparent PNG equipment sprite/icon for a high quality chibi anime fantasy artillery browser game.
Primary request: ONE compact elegant purple crystal-flower magical artillery device. A short ornate throwing staff with a compact broad flower-shaped muzzle aimed diagonally upper-right. Five thick faceted violet amethyst crystal petals surround a glowing lavender crystal sphere at center. Silver and pale gold metal petal braces, two small curling gold leaves, rich purple compact handle tapering toward lower-left. It must read like a hand-held compact fantasy artillery weapon, not a long walking staff or ordinary flower. Magical and precise, lovely readable silhouette, complete standalone equipment, no person or hands.
Style: Hand-painted 2D anime game equipment sprite, clean dark violet contour, rich cel shading with gentle painted material detail, dimensional crystal highlights, cute polished MMORPG game item. Not photorealistic, not pixel art, not 3D render.
Composition: square 1024x1024 genuinely transparent canvas, entire object centered with generous transparent empty margin on all four sides, occupies about 65% canvas area. Crystal flower cannon head directed diagonally upper-right, short handle lower-left. No ground shadow.
Constraints: Exactly one weapon. No UI, text, lettering, numerals, frame, border, watermark, symbols, background, floor, smoke cloud, particles detached from weapon, extra weapons, human hands, characters. Preserve all edges within frame.
```


## Final art handoff and current status

New item generation was stopped at the user's explicit request to finish only faces in this stage, document pending work, and prepare the repository for GitHub. No image generation remained in flight. This art agent did not enable renderer features or edit application code.

### Delivered active artwork owned by this agent

- `lobby.png`: close horizontal street, 1672 × 941 RGB. `battlefield.png`: compact cartoon garden ruins, 1672 × 941 RGB.
- `adventurer.png`: original complete chibi sprite, 1254 × 1254 RGBA.
- Twelve weapon stage assets: `weapon-{ember,volt,crystal}-base.png` for levels 0–8; `-evolved.png` for +9; `-awakened.png` for +10–11; original unsuffixed `weapon-{ember,volt,crystal}.png` for +12. All 1254 × 1254 RGBA.
- `stone-1.png` through `stone-5.png`: current rough low ore chunks, respectively gray, cyan, ruby-pink, golden amber, multicolor rainbow. All 1254 × 1254 RGBA.
- `character-base.png`: faceless, hairless full body, neutral cream shirt, original limb pose and source registration. 1254 × 1254 RGBA.
- `hair-spiky.png`: chestnut spiky hair extracted as its own aligned layer. 1254 × 1254 RGBA.
- `hat-mage.png`: painted violet cloth hat with copper embroidery and folded brim. 1254 × 1254 RGBA.
- `outfit-azure-body.png`: complete neck-down azure outfit, hands, navy shorts, bare knees and buckled boots included, no head. 1254 × 1254 RGBA.

All current source assets above were visually inspected after generation. File dimensions and RGBA formats were checked. Transparent item/character assets have alpha 0 at the source corner; original generated alpha is preserved. No Python or raster postprocessing was used to manufacture cutouts. No compression/downscale pass was performed by this agent.

### Registration contract

All avatar-aligned layers use the unchanged 1254 × 1254 source canvas. Do not crop/recenter these source layers before rendering them together. Renderer origin agreement: source center x625, foot contact approximately y1225. Original painted face eye centers approximately (654,447) and (793,477).

- Base scalp/blank head visible region approximately x427–842, y181–592. Ear, chin, arms, hands, legs and boots visually retain the original pose.
- Hair visible region approximately x285–960, y10–595; the rest of the full canvas is transparent. These are visual bounds, not guaranteed pixel-exact alpha bounds.
- Azure full body visible region approximately x423–855, y562–1234. Neck starts around y563. It retains the original body pose and limb coordinates. Head is transparent.
- Mage hat is a standalone equipment image, NOT a pre-aligned full-avatar layer. Approximate visible source bounds x18–1232, y180–1070. Its wearer scale, crown anchor, clipping with hair, and front/back brim order must be reviewed in the renderer; avoid covering face or enlarging it excessively.

### Pending at stop

No final files were generated for `hair-wavy.png`, `outfit-royal-body.png`, `hat-pilot.png`, or `hat-knight.png`. The wavy hair should use a genuinely distinct wavy silhouette, golden-honey palette, and the same universal head registration. Royal body must be a complete neck-down outfit including limbs/boots with the same limb anchors; a torso inventory icon is not a body layer.

Other agents supplied `outfit-azure.png`, `outfit-royal.png` and `hat-cap.png` inventory/wear artwork; their provenance/prompts are recorded separately in `docs/apparel-prompts.md`. This agent did not own or revise those files. No new eye/face assets were generated by this agent: painted original face extraction was implemented by the renderer agent, and the dedicated face artist owns the final expression assets.

The modular outfit/hair/hat integration, face alignment, battle/lobby consistency, animation masks, and screenshot acceptance are not claimed complete by this art handoff. The renderer agent was advised to gate incomplete modular combinations and preserve a valid original fallback. Character-code owners must confirm all visual combinations before enabling them.

### Coordinator and roles

- `game_art` (this agent): raster environments, weapon stages, forging ore, base/hair/mage/azure body; only `public/assets/` and this prompt log.
- `upgrade_server`: modular renderer, registration, animation masks and visual integration.
- `face_artist`: final complete painted facial expression assets on the universal head.
- `forge_ui`: inventory and item icon cropping; hair icons need the visible source region rather than the whole avatar canvas.
- Root coordinator: scope, catalog, gameplay integration, verification, final documentation and GitHub delivery.

### Archived material

Previous broad fantasy backgrounds remain as `lobby-v1.png` and `battlefield-v1.png`. The rejected glow-only weapon base/+10 variants remain as `weapon-*-base-v1.png` and `weapon-*-awakened-v1.png`. Earlier tall colored crystals remain as `stone-1-v1.png` through `stone-5-v1.png`. These are historical alternatives, not current tier art.

### Next steps when the user resumes equipment work

1. Finish and review the universal painted faces in the dedicated face pipeline.
2. Keep working source registration fixed; generate wavy hair and the royal neck-down outfit against the current base.
3. Produce pilot and knight painted hats, then review all hats at natural head scale with visible fringe/face.
4. Validate direct scene previews of each full outfit and hat combination in idle, walk, aim, prone and battle states before enabling combinations.
5. Build optimized runtime derivatives if needed while preserving original source PNGs and alpha.

## Additional exact prompts and execution history

All entries below used built-in `image_gen.imagegen`. Transparent assets used `transparent_background: true`. Edits used local reference images; completed originals at +12 remained untouched. The exact generation prompts are retained below, including superseded instructions, so the revision history is reproducible.

### weapon-ember-base-v1.png

Archived: superseded glow-only base

```text
Use case: lighting-weather (precise game equipment level variant)
Asset type: transparent PNG sprite weapon upgrade tier BASE (level 0–5).
Input image: EDIT TARGET, this exact Ember dragon cannon. It is currently fully upgraded.
EDIT ONLY its magical energy intensity: change the bright luminous orange furnace in the mouth to a very dim dark reddish ember core with restrained orange center and no bloom; reduce dragon-eye magical shine and turquoise gem emission, retain their physical reflective colors. No sparks or outward aura. Make metal and enamel lighting a little quieter but still beautiful polished painted anime equipment.
STRICT INVARIANTS: This must remain the exact same weapon, not a redesign. Preserve exact silhouette, proportions, dragon head shape, two horns, all teeth, same turquoise gems and locations, carved gold parts, red enamel body, handle, trigger guard, every physical ornament, viewing angle, upper-right direction, object size, position and framing. Preserve existing hand-painted linework and material identity. Do not remove geometry, simplify shapes, invent details, change camera, rotate, zoom, or crop. Preserve transparent background and alpha edges. Maintain source square dimensions and original margins. No text, UI, numbers, watermark, shadow, ground or background. The only meaningful visible change is that the magic core and gems are inactive/subdued.
```

### weapon-ember-awakened-v1.png

Archived: superseded glow-only +10

```text
Use case: lighting-weather (precise game equipment level variant)
Asset type: transparent PNG sprite weapon upgrade tier AWAKENED (level +10).
Input image: EDIT TARGET, this exact Ember dragon cannon, currently full level +12.
EDIT ONLY magical energy intensity: decrease the bright luminous orange furnace mouth to moderate warm orange light at about 50% source brightness, with a clearly visible reddish-orange core and only gentle amber glow inside barrel. Add only two tiny ember specks immediately inside the mouth, no outward aura. Reduce eye magical shine and turquoise gem emission slightly so this is a clearly intermediate powered tier. It is stronger than an inactive dim ember, weaker than the provided bright full furnace.
STRICT INVARIANTS: Exact same weapon, silhouette, proportions, dragon head shape, horns, teeth, turquoise gems, carved gold parts, red enamel body, handle, trigger guard and every physical ornament. Preserve original viewing angle, diagonal upper-right direction, exact object size, position, framing and original margins. Keep source hand-painted linework and material colors. Do not redesign, remove geometry, invent adornments, zoom, crop or rotate. Preserve genuine transparency and alpha edges and source square dimensions. No text, UI, numbers, watermark, background, floor or shadow. Only core and gem energy intensity changes.
```

### weapon-volt-base-v1.png

Archived: superseded glow-only base

```text
Use case: lighting-weather (precise game equipment level variant)
Asset type: transparent PNG sprite weapon upgrade tier BASE (levels 0–5).
Input image: EDIT TARGET, this exact Volt electric coil cannon, currently fully upgraded.
EDIT ONLY magical electric intensity: switch OFF the vivid white cyan lightning arcs in barrel coils and three rear glass tubes. Keep coil spaces dark cobalt with a very faint blue electric glimmer. The large diamond crystal in the mouth remains physically identical but becomes subdued deeper cyan with reflective facets, not emissive, no bloom. Rear three glass tubes stay blue glass but inactive, no white bolts. No sparks or outward aura.
STRICT INVARIANTS: Exact same weapon, every silver ring and notch, crystal shape and position, all three blue glass tubes, gold screws, cobalt enamel panels, grip, trigger guard, every physical ornament. Preserve original silhouette, proportions, direction diagonal upper-right, exact object size, position, original margins and square canvas dimensions. Keep original hand-painted outlines, material identity and blue/silver/gold colors. Do not redesign, simplify geometry, remove components, invent details, rotate, crop or zoom. Preserve genuine transparent background and alpha edges. No text, UI, numbers, watermark, floor, ground, cast shadow or background. Only energy emission changes.
```

### weapon-volt-awakened-v1.png

Archived: superseded glow-only +10

```text
Use case: lighting-weather (precise game equipment level variant)
Asset type: transparent PNG sprite weapon upgrade tier AWAKENED (level +10).
Input image: EDIT TARGET, this exact Volt electric coil cannon, currently fully upgraded at +12.
EDIT ONLY electric energy intensity to an intermediate tier: reduce cyan lightning brightness to 50% of original. The coils show a thin modest blue glow, with only a few small delicate arcs contained between rings. Large diamond crystal in mouth emits a gentle cyan glow, half original intensity, blue facets remain visible instead of nearly-white glare. Three rear glass tubes show modest blue glow and one small electric glimmer each. No outward aura or detached sparks. It must look powered, but clearly less electrically intense than source full weapon.
STRICT INVARIANTS: Exact same weapon and all physical geometry: silver rings and notches, crystal shape/position, three tubes, gold screws, cobalt enamel panels, grip, trigger guard. Preserve silhouette, proportions, original diagonal upper-right direction, exact size and position on canvas, original margins and source square dimensions. Keep original hand-painted outlines and blue/silver/gold material colors. Do not redesign, add/remove physical pieces, simplify geometry, zoom, rotate or crop. Preserve genuine transparency and alpha edges. No text, UI, numbers, watermark, floor, background or cast shadow.
```

### weapon-crystal-base-v1.png

Archived: superseded glow-only base

```text
Use case: lighting-weather (precise game equipment level variant)
Asset type: transparent PNG sprite weapon upgrade tier BASE (levels 0–5).
Input image: EDIT TARGET, this exact Crystal flower artillery staff, currently fully upgraded.
EDIT ONLY magical energy intensity: central purple orb must become an inactive deep violet gem, reflective facets but NO luminous white center. All large amethyst petals remain purple, exact existing facets and shape, but their glow is subdued and darker saturated amethyst rather than pink-white lit interiors. Small handle gems have physical reflections only. Eliminate inner sparkles, bloom, emitted light and magical aura. Retain pleasing dimensional painted material reflections and visible facets.
STRICT INVARIANTS: Exact same staff/device, every purple petal with exact outline and proportions, orb shape/size/location, gold silver braces, curling gold leaves, purple handle and all gems. Preserve silhouette, original diagonal upper-right angle, exact weapon scale, position, original transparent margins and source square dimensions. Do not redesign, add or remove ornaments, change materials or hue identity, zoom, rotate or crop. Preserve original linework, genuine transparent background and alpha edges. No text, UI, numbers, watermark, floor, background or shadow. Only emission and core activation changes.
```

### weapon-crystal-awakened-v1.png

Archived: superseded glow-only +10

```text
Use case: lighting-weather (precise game equipment level variant)
Asset type: transparent PNG sprite weapon upgrade tier AWAKENED (level +10).
Input image: EDIT TARGET, this exact Crystal flower artillery staff, currently fully upgraded +12.
EDIT ONLY magical energy intensity: central purple orb becomes moderately luminous lavender with clearly visible purple facets, at half the source bright white inner light. A few tiny subtle pinprick sparkles stay inside the orb only. All large amethyst petals remain same purple with the identical facets and shapes, but reduce luminous pale pink-white interiors by 50%, keep saturated purple. Small handle gems have gentle contained glints. It should look magically active at intermediate power, visibly between dark inactive violet and source bright white-lavender full upgrade. No outward sparks or aura.
STRICT INVARIANTS: Exact same staff/device and every petal exact outline, orb size/location, gold silver braces, curling gold leaves, handle and all gems. Preserve silhouette, source original diagonal upper-right angle, exact scale, canvas position, source square dimensions and original transparent margins. Do not redesign, add/remove geometry, change hue identity, crop, rotate or zoom. Preserve source linework, genuine transparent background and alpha edges. No text, UI, numbers, watermark, floor, background or shadow. Only emission and core activation changes.
```

### weapon-ember-base.png

Current: levels 0–8, iron and wood

```text
Use case: precise-object-edit
Asset type: transparent PNG RPG weapon BASE level0 starter prototype.
Input image: EDIT TARGET. This is the finished level12 Ember dragon cannon. Downgrade it dramatically to its ORIGINAL UNFINISHED LEVEL0 PROTOTYPE.
The user explicitly rejected merely reducing glow. Make the entire visible weapon almost COLORLESS and visibly simple: 90% less color and ornament finish. Replace ALL red/orange enamel and gold/brass with matte dark charcoal-gray cast iron. Replace red ornate grip with plain weathered gray-brown WOOD grip. Keep the recognizable dragon-head anatomy, circular mouth, horns and short handle, same proportions/silhouette/viewpoint, but simplify surface carving into broad crude cast iron panels: no detailed scale etchings, no ornate gold scrolling. Eyes are blank dull charcoal metal recesses, no amber iris. Mouth is empty dormant darkgray iron, NO colored core. Turquoise gems become small plain dull gray rivet-like stones without shine. Horns/teeth matte iron. Plain iron trigger and rough wood handle. No gold, bright colors, glow, sparks or aura.
Retain production quality painted 2D anime game sprite, clean readable outlines and dimensional soft gray shading. This is the same recognizable dragon cannon before upgrades, NOT a different weapon. Source composition, size, upper-right direction, position and transparent margins stay exact. Genuine transparency, no background or ground shadow. No text, labels, UI, numbers, watermark. Full original is not changed, this is separate starter-tier asset.
```

### weapon-ember-evolved.png

Current: level +9, first construction upgrade

```text
Use case: precise-object-edit
Asset type: transparent PNG RPG Ember dragon cannon upgrade stage +9, FIRST EVOLUTION.
Image1: finished +12 weapon design reference. Image2: gray wooden starter base reference. Create the +9 intermediary from this weapon family; SAME dragon cannon idea and diagonal upper-right view, but a DIFFERENT CONSTRUCTION STAGE, not just brightness adjustment.
Keep a simplified compact cast-iron dragon head muzzle, add a few dull brick-red enamel plates on upper head only (about25% color), one simple burnished COPPER mouth ring, two SHORT dark iron horn nubs. Fewer scales/spikes than finished source, smooth broad side plates. Small amber eye newly awake, quiet orange ember deep inside mouth with no strong glow. Plain wood grip now leather wrapped with a simple copper pommel ring, no gem-studded gold handle. One small dull blue bead at upper forehead. No ornate scrolls, no huge gold horns or ornate curling gold side pieces. Predominantly iron gray and warm brown, restrained red/copper upgrades. It must visibly sit between the almost colorless raw starter and highly ornate redgold +12.
High polish painted 2D anime/chibi game sprite, clean outlines and dimensional soft shading. Single full weapon in same square framing, centered, transparent alpha and empty margins. No text, UI, numbers, labels, watermark, floor or shadow.
```

### weapon-ember-awakened.png

Current: levels +10–11, second construction upgrade

```text
Use case: precise-object-edit
Asset type: transparent PNG RPG Ember dragon cannon upgrade +10 SECOND EVOLUTION.
Image1 finished elaborate full+12 reference. Image2 first evolution +9 reference. Create distinct second evolutionary construction between them, SAME recognizable dragoncannon family and upper-right view.
Upgrade +9 iron dragon muzzle: red-orange lacquer now covers about HALF the dragon head, underside remains exposed darkgunmetal panels. Two medium-sized curved bronze horns (smaller/plainer than full gold horns), newly fitted bronze cheek armor, simple gold-toned rim around mouth. A modest turquoise forehead gem and one small turquoise grip stud, amber eye, glowing orange mouth at medium power with restrained small inner spark. Grip is now darkred leather reinforced by simple brass caps but no large ornate gold scrolls or diamond inset. Add a modest pair of layered finlike cheekplates; retain broad simpler scales than full+12. NO full ornate gold side scrolling, no polished large golden horn surfaces, no intense fully blazing yellow core. It should clearly look more advanced than +9 grayiron/redpatches, and visibly less decorative than full+12. Construction grows and refines, not only brightness.
Original handpainted outlined anime/chibi equipment style; crisp polished but readable. Same square size, centered full object in similar scale, transparent alpha, empty margins. No text, UI, numbers, watermark, background, floor or shadow.
```

### weapon-volt-base.png

Current: levels 0–8, two rings and one tube

```text
Use case: precise-object-edit
Asset type: transparent PNG RPG weapon BASE level0–8 starter prototype.
Input image: EDIT TARGET showing full upgraded Volt cannon. Create the MUCH SIMPLER unfinished starter ancestor of this same weapon family.
Keep core recognizable electric coil cannon family, diagonal upper-right orientation, approximate same icon framing/center. You MAY simplify and change construction visibly to depict evolutionary stage. Base has only TWO plain broad rough iron barrel rings instead of full elaborate silver multi-ring assembly, small dull cloudy gray crystal at muzzle with NO glow, simple cylindrical unpainted charcoal iron body. Replace rear three energy tubes with ONE short cloudy glass tube in plain dull copper holders, no blue emission. Plain weathered wood pistol grip with simple iron trigger guard. Remove ornate armor plates, unnecessary gold screws, fancy decorative cutouts, sharp accents. All surfaces crude matte gray iron and slightly brown wood; almost monochrome, 90% less color, NO cobalt enamel, NO polished silver, NO gold, NO energy arcs or aura. Still high-quality clean outlined hand-painted 2D anime/chibi equipment sprite, physically dimensional but obviously BASIC construction. No different weapon family, no rifle, no extra weapon.
Transparent background, one complete item, original square canvas and generous margins, no shadow, text, labels, numbers, UI or watermark. The substantial construction/material simplification must be immediately obvious next to source full design.
```

### weapon-volt-evolved.png

Current: level +9, three rings and two tubes

```text
Use case: precise-object-edit
Asset type: transparent PNG RPG Volt electric cannon stage +9 FIRST EVOLUTION.
Image1 finished full+12 reference; image2 raw graywood base reference. Create FIRST developed stage of same family, intermediate construction, NOT only brightness change.
Build on base cannon: THREE simple brushed iron coil rings around a short gray barrel instead of the full highly ornate silver assembly; two small rear glass energy tubes with restrained dim CYAN contents instead of base one tube or full three. Add a few modest muted dusty blue steel panels on rear housing (~25% blue color, rest gray iron), thin simple copper brackets and ordinary screws. Front crystal is now small PALE BLUE translucent cut diamond with very gentle glow, no lightning arcs. Grip remains warm brown leather-wrapped wood with plain iron trigger guard; no full blue enamel grip, no elaborate gold wheel/armor. Slightly stronger refined silhouette than base but simpler, less colorful and less ornamented than finished full model. Preserve recognizable coil cannon anatomy, diagonal upper-right direction and similar center/scale.
Polished 2D anime equipment painting, clean dark outlines, soft dimensional shading. Transparent alpha square canvas, generous margins, exactly one complete weapon, no UI/text/numerals/watermark/background/ground/shadow.
```

### weapon-volt-awakened.png

Current: levels +10–11, refined blue/silver two-tube construction

```text
Use case: precise-object-edit
Asset type: transparent PNG RPG Volt cannon upgrade +10 SECOND EVOLUTION.
Image1 elaborate full+12 source reference; image2 +9 construction reference. Create a visibly refined second evolution but still less elaborate than full model, SAME electric coil cannon family and upperright view.
Upgrade +9: FOUR brushed silver coil rings, moderately large front diamond now cyan and luminous with a SINGLE restrained arc in muzzle. TWO rear energy tubes retained but in refined silver holders; source full+12 has three tubes, DO NOT add third yet. Body is about HALF cobalt blue enamel, HALF exposed gray steel, simple small brass rivets and a plain circular brass gear disk. Grip becomes navy leather with plain silver borders, NO fine angular full enamel designs, no detailed gold screws covering grip, keep simpler than full. A short protective plate newly wraps barrel rear. Moderate blue energy between coils, no intense lightning chains everywhere. Make construction and materials visibly more advanced than ironwood+9, less ornamented than saturated goldsilver-blue full12. No identical full model with glow simply lowered.
Keep polished handpainted clean-outlined 2D anime equipment sprite, similar centered framing, entire object complete on square transparent canvas, empty margins. No text, UI, labels, numerals, watermark, background, floor, shadow, external aura cloud.
```

### weapon-crystal-base.png

Current: levels 0–8, three rough quartz petals and wood

```text
Use case: precise-object-edit
Asset type: transparent PNG RPG weapon BASE level0–8 starter prototype.
Input image: EDIT TARGET showing full upgraded Crystal flower artillery staff. Create its MUCH SIMPLER unrefined starter ancestor.
Keep core recognizable crystal-flower staff family, same diagonal upper-right direction and approximate framing/center. Simplify construction dramatically: replace ornate four-petal amethyst head with THREE broad short crude pale-gray opaque QUARTZ petals around a small darkgray cloudy round quartz center. Quartz has rough cloudy uneven simple facets, almost colorless slight cool gray tint, NO purple color, no magical light. Use a plain narrow weathered wooden handle tied with simple dark leather wrap and TWO plain matte iron bands. Remove curling golden leaves, decorative silver petal braces, gem-studded ornate handle and gold end finial. The visual silhouette is simpler but still recognizably same flower-headed crystal artillery staff. All palette 90% gray/brown, crude inactive materials. Not fancy, no gold, no vivid purple, no glow, no sparks, no aura.
Keep beautiful clean-outlined hand-painted 2D chibi anime equipment sprite, original square canvas and transparent margins, complete centered item. No background, floor, shadow, text, labels, numbers, UI or watermark. Strong substantial construction/material simplification immediately obvious beside source full weapon.
```

### weapon-crystal-evolved.png

Current: level +9, pale lavender three-petal construction

```text
Use case: precise-object-edit
Asset type: transparent PNG RPG Crystal flower artillery staff stage +9 FIRST EVOLUTION.
Image1 full ornate purple/gold+12 reference; image2 raw grayquartz/wood base reference. Create first evolutionary tier of same family, clearly changing construction/materials.
Keep THREE petal crystal head from starter, now more carefully cut pale smoky LAVENDER quartz (only25% vivid purple saturation) surrounding a small paleviolet polished orb. Basic broad angular facets, very gentle interior purple glimmer. Fit petals into simple plain SILVER iron braces instead of leather lashings, without ornate gold flower details. Slim handle remains brown wood with muted dark lavender leather wrap sections and three plain silver bands. Small simple silver end cap, no endgem. No curling metal leaves, no giant gold frills, no fourth petal, no ornate gemstone studs on handle. The construction is visibly more developed than graywood base, visibly much simpler than fourpetal ornate gold +12. Maintain crystal-flower staff identity, original diagonal upper-right direction, similar centered scale.
Beautiful outlined hand-painted 2D chibi/anime equipment sprite, genuine transparent square canvas and empty margins. No text, UI, numbers, watermark, background, ground, cast shadow, detached sparks or aura.
```

### weapon-crystal-awakened.png

Current: levels +10–11, three polished purple petals with restrained gold/silver

```text
Use case: precise-object-edit
Asset type: transparent PNG RPG Crystal flower artillery staff upgrade +10 SECOND EVOLUTION.
Image1 finished elaborate full+12 source reference; image2 +9 pale3petal reference. Create clearly refined intermediate construction in SAME crystal-flower staff family and diagonal upperright view.
Keep THREE broad amethyst crystal petals, now rich medium PURPLE and expertly cut with crisp luminous facets; DO NOT add fourth large petal yet (that is full+12). Add elegant newly forged SILVER petal braces with narrow gold rims and TWO small short silver leaf prongs at head base, NOT the enormous curled gold leaves of finished source. Orb becomes medium purple luminous heart with modest lavender light. Handle now smooth darkpurple wood/leather with3 refined silver bands and tiny restrained gold edges; add one small purple endgem in a plain silver cap, but no chain of ornate gold diamond inlays. Clearly less gold/scrollwork and simpler head silhouette than full12, more crafted and colorful than pale silverwood +9. No huge aura or bright whitewashed core.
Highquality cleanoutlined handpainted 2Danime chibi game sprite. Similar centered scale on square transparent alpha canvas with generous margins, exactlyone entire weapon. No text, labels, UI, numbers, watermark, background, floor or shadow. Substantial refinement of construction, not just brightness.
```

### stone-1-v1.png

Archived: upright crystal variant, superseded by rough ore

```text
Use case: stylized-concept
Asset type: transparent PNG forging-stone inventory item icon, level 1, for a polished chibi anime fantasy browser game.
Primary request: ONE recognizable magic forging crystal. A compact upright squat hexagonal mineral shard with a broad pointed top, two smaller side facets at its base, roughly symmetrical chunky silhouette. Pale mint green (#a9e3bd) main color, deeper jade facets, a few creamy reflective highlights. Slightly rough natural edges and simple broad facets, barely glowing inner heart. Small gold mineral inclusions near base, no metal mounting. It is the basic first tier of a progression, beautiful but restrained.
Style: High polish hand-painted anime/chibi MMORPG equipment art matching ornate cartoon weapons; clean dark green outlines, soft cel shading, dimensional painted gem highlights, readable tiny icon. Not pixel art, photo or 3D render.
Composition: Single complete crystal centered on square 1024x1024 canvas, occupies about65% width and height, generous empty transparent margins all sides, slightly three-quarter front view, upright. Genuine transparent alpha, no cast shadow.
Constraints: No numbers, text, UI, border, watermark, background, floor, detached sparkles, piles of gems, container, hands, characters. Just one connected mineral crystal item.
```

### stone-2-v1.png

Archived: upright crystal variant, superseded by rough ore

```text
Use case: precise-object-edit
Asset type: transparent PNG forging stone inventory icon, tier 2.
Input image: EDIT TARGET, the existing mint green forging crystal tier1.
Change ONLY gem COLOR and degree of refinement/magical energy: recolor crystal to bright light CYAN BLUE (#6bd3ec), deeper teal-blue shaded facets. Make it more polished and refined than the source rough stone, gentle cyan inner sheen, restrained soft reflective highlights; no aura. Keep tiny gold inclusions at base.
STRICT INVARIANTS: exact same recognizable connected crystal silhouette: one tall central pointed hexagonal shard and two short side shards at base. Keep same viewpoint, tilt, proportions, center position, overall object size, original square image dimensions and empty transparent margins. Preserve hand-painted anime fantasy item rendering and clean outlines. Do not invent metal mounting, ornaments, extra stones, change camera, rotate, zoom or crop. Actual transparent background and alpha edges preserved. No detached particles, no background, cast shadow, floor, text, numbers, UI, labels, watermark or border. This is a coherent rarity tier of the SAME item, not a different design.
```

### stone-3-v1.png

Archived: upright crystal variant, superseded by rough ore

```text
Use case: precise-object-edit
Asset type: transparent PNG forging stone inventory icon, tier 3.
Input image: EDIT TARGET, the existing mint green forging crystal tier1.
Change ONLY gem COLOR and degree of refinement/magical energy: recolor crystal to LAVENDER VIOLET (#a795ed), rich violet shadowed facets. Make it refined crisp gem facets, modest lavender inner glow, a few tiny glimmer points contained inside the central crystal; no outward aura. Keep tiny gold inclusions at base.
STRICT INVARIANTS: exact same recognizable connected crystal silhouette: one tall central pointed hexagonal shard and two short side shards at base. Keep same viewpoint, tilt, proportions, center position, overall object size, original square image dimensions and empty transparent margins. Preserve hand-painted anime fantasy item rendering and clean outlines. Do not invent metal mounting, ornaments, extra stones, change camera, rotate, zoom or crop. Actual transparent background and alpha edges preserved. No detached particles, no background, cast shadow, floor, text, numbers, UI, labels, watermark or border. This is a coherent rarity tier of the SAME item, not a different design.
```

### stone-4-v1.png

Archived: upright crystal variant, superseded by rough ore

```text
Use case: precise-object-edit
Asset type: transparent PNG forging stone inventory icon, tier 4.
Input image: EDIT TARGET, the existing mint green forging crystal tier1.
Change ONLY gem COLOR and degree of refinement/magical energy: recolor crystal to PINK VIOLET (#ec8dcb), rich magenta-purple shaded facets. Make it beautiful precisely polished facets, moderate rosy-violet glowing heart, a few fine internal sparkles; soft restrained magical radiance contained within stone. Keep tiny gold inclusions at base.
STRICT INVARIANTS: exact same recognizable connected crystal silhouette: one tall central pointed hexagonal shard and two short side shards at base. Keep same viewpoint, tilt, proportions, center position, overall object size, original square image dimensions and empty transparent margins. Preserve hand-painted anime fantasy item rendering and clean outlines. Do not invent metal mounting, ornaments, extra stones, change camera, rotate, zoom or crop. Actual transparent background and alpha edges preserved. No detached particles, no background, cast shadow, floor, text, numbers, UI, labels, watermark or border. This is a coherent rarity tier of the SAME item, not a different design.
```

### stone-5-v1.png

Archived: upright crystal variant, superseded by rough ore

```text
Use case: precise-object-edit
Asset type: transparent PNG forging stone inventory icon, tier 5.
Input image: EDIT TARGET, the existing mint green forging crystal tier1.
Change ONLY gem COLOR and degree of refinement/magical energy: recolor crystal to warm GOLD (#ffc76a), honey amber shadowed facets, luminous golden-white inner heart. Make it highest tier masterfully refined polished crystal, radiant golden-white core, intense yet contained golden light through facets, a few delicate star glints INSIDE crystal, no external aura cloud. Keep tiny gold inclusions at base.
STRICT INVARIANTS: exact same recognizable connected crystal silhouette: one tall central pointed hexagonal shard and two short side shards at base. Keep same viewpoint, tilt, proportions, center position, overall object size, original square image dimensions and empty transparent margins. Preserve hand-painted anime fantasy item rendering and clean outlines. Do not invent metal mounting, ornaments, extra stones, change camera, rotate, zoom or crop. Actual transparent background and alpha edges preserved. No detached particles, no background, cast shadow, floor, text, numbers, UI, labels, watermark or border. This is a coherent rarity tier of the SAME item, not a different design.
```

### stone-1.png

Current: rough ore matching latest user reference

```text
Use case: stylized-concept
Asset type: transparent PNG browsergame forging material inventory icon, tier1.
Input image: REFERENCE ONLY of five tiny rough ore stones. Use FIRST leftmost GRAY STONE as guidance for rough mineral shape, not any text or UI.
Primary request: ONE squat irregular natural chunk of RAW GRAY ORE. A broad low wedge-shaped rock, roughly low pyramid, wider than tall, uneven jagged fractured surfaces and chipped angular edges. Opaque chalky cool gray and slate gray, hints of palegray crystalline mineral within rock. NOT a tall crystal shard, NOT crystal cluster, NOT a neatly cut jewel or diamond. Resemble a beautiful collectible rough unprocessed rock with broad irregular planes, mineral veins and dark recesses. Simple coherent silhouette readable at32pixels.
Style: Polished handpainted 2D chibi Korean/Chinese browsergame item art, bold clean dark outline, simple broad shading and highlights, mildly dimensional, not photorealistic and not pixelart.
Composition: Single complete low squat rock centered, threequarter overhead view, square1024 canvas with ample transparent margins. Rock occupies about65% width and45% height. Genuine transparent alpha, no floor or cast shadow.
Constraints: No letters, numbers, text, icons, level labels, frame, UI, watermark, background, glow aura, detached particles, mounting or jewelry setting. Gray basic rough ore only.
```

### stone-2.png

Current: rough ore matching latest user reference

```text
Use case: precise-object-edit
Asset type: transparent PNG browsergame forging material ore icon, tier2.
Input image: EDIT TARGET gray rough ore chunk. Preserve exact squat irregular rock shape, jagged fractured angular planes, original composition, width/height/scale and centered square framing. Recolor the gray rock into luminous BLUE-CYAN rough mineral: saturated azure blue lower surfaces, turquoise cyan middle planes, icy pale cyan upper chipped planes. Opaque uneven raw mineral texture with modest crystalline shine, not polished jewelry. Keep darkblue fissures, veins and natural chipped facets. Only a subtle inner mineral sheen, no external aura. It must read as the same rough ore family in BLUE. No tallcrystals, crystalclusters, gemstone cut symmetry, gold mounting or ornaments.
Keep handpainted cleanoutlined 2D browsergame item style, dimensional shading, genuine transparent alpha and margins. No text,numbers,UI,labels,watermark,background,floor,castshadow or particles. Exactlyone complete rough blue ore chunk.
```

### stone-3.png

Current: rough ore matching latest user reference

```text
Use case: precise-object-edit
Asset type: transparent PNG browsergame forging material ore icon, tier3.
Input image: EDIT TARGET gray rough ore chunk. Preserve exact squat irregular rock silhouette, chipped angular fractured planes and original centered square framing, width, height and scale. Recolor raw mineral to RUBY PINK and MAGENTA RED: deep ruby redlower planes and fissures, rich pink middle facets, pale rose upper chipped surfaces. Opaque to partly crystalline unprocessed rough ore, mineral veins and natural uneven texture. Slight restrained internal sheen, NOT a polished gemstone or jewelry. Same compact low rough rock family, recognizable at32pixels. NO tall crystalspikes, clusters, symmetrical cuts, metal setting, ornaments, aura or detached sparkles.
Maintain handpainted cleanoutlined 2D anime browsergame item style, original alpha transparency and generous margins. Exactlyone complete rock, no text, labels, numbers, UI, watermark, background, ground or shadow.
```

### stone-4.png

Current: rough ore matching latest user reference

```text
Use case: precise-object-edit
Asset type: transparent PNG browsergame forging material ore icon, tier4.
Input image: EDIT TARGET gray rough orechunk. Preserve same squat low irregular rock silhouette, chipped angular planes, shape proportions, centered square framing, exact scale and margins. Recolor raw mineral to GOLDEN AMBER: warm amber/orange in lowerfractures, saturated rich yellowgold middle mineralplanes, pale creamy gold sunlightlike highlights on upper chipped surfaces. Rough NATURAL raw gold-bearing mineral with irregular crystalline grain, natural cracks and uneven texture, never polished jewelry. Modest contained glimmer, no aura. Must read as same low rawore family in GOLD/YELLOW, not tall crystalspikes or neatly cut jewel.
Preserve polished handpainted cleanoutlined 2D anime browsergame item style, actual transparent alpha and margins. Exactlyone whole orechunk, no text,numbers,UI,labels,watermark,background,floor,castshadow,metalsetting or floatingparticles.
```

### stone-5.png

Current: rough ore matching latest user reference

```text
Use case: precise-object-edit
Asset type: transparent PNG browsergame forging material ore icon, tier5 ultimate rainbow ore.
Input image: EDIT TARGET gray rawore rock. Preserve exact squat irregular mineral chunk shape, lowpyramid silhouette, jagged chipped fractureplanes, proportions and original centered square framing. Recolor into a MULTICOLOR RAW ORE with distinct mineral zones across connected rock: magenta/ruby pink at upperleft, golden-yellow on uppercenter ridge, vivid emerald green at upperright and center, turquoise blue and rich violet along lowerplanes. Natural irregular transitions following rockfractures, like a fantastical rainbow mineral rich with different ores, NOT a smoothrainbow gradient painted onto a polished gem. Bright colorful rough crystalline mineralgrain, intense contained highlights, darkviolet/blue fissures, no external glowcloud. Recognizably same compact rawrock family, NOT tall crystalspikes, diamondcut jewelry or a cluster.
Highpolish cleanoutlined handpainted 2D chibi fantasy browsergame item art, dimensions/shading consistent with source, genuine transparent alpha and empty margins. Exactlyone whole orechunk. No text,labels,numbers,UI,watermarks,frames,background,floor,shadow,metalsetting or detachedparticles.
```

### character-base.png

Delivered modular faceless/hairless base; integration owned by renderer agent

```text
Use case: precise-object-edit
Asset type: modular 2D chibi game character BASE SPRITE.
Input image: EDIT TARGET is the current exact 1254x1254 adventurer sprite. EDIT IN PLACE WITH PIXEL POSITION FIDELITY.
Only these changes: remove ALL brown hair to reveal a natural smooth bald chibi scalp matching current underlying head volume; remove both eyes including eyelashes, both eyebrows and mouth, leaving a softly shaded BLANK skin face (tiny existing nose and ears may remain). Do not move face or distort head. Remove brown vest only, keeping a simple neutral CREAM SHIRT underneath shaped to exactly current torso contours, same sleeves/cuffs/arms. Keep existing simple brown shorts and boots unchanged. Hands remain empty, feet fully visible.
STRICTLY preserve entire pose and every body coordinate: unchanged head angle3/4right, ear positions, chin at current location, arms/hands, torso, hips, knees, legs, boots. Keep original body proportions and source1254square canvas framing/margins. Source face eye centers were about(654,447) and(793,477); leave these points as clean blank skin for separate eyes. Source feet staynear y1225, charactercenter~625. NO repositioning, no recentering, no scaling, no newpose. Do not alter the rest of source character.
Retain exact polished painted anime chibi style, skin colors, outlines, gentle shading. Preserve genuine transparency. Entire fullbody remains visible. No hair, no eyes, no eyebrows, no mouth, no clothing accessories, no weapon, no hat, no shadows, no background, no text or watermark. This is modular paperdoll artwork, not a new character design.
```

### hair-spiky.png

Delivered hair-only aligned layer

```text
Use case: background-extraction
Asset type: modular hair-only layer for exact same game sprite.
Input image: EDIT TARGET current adventurer1254x1254. EXTRACT ONLY THE EXISTING BROWN SPIKY HAIR. Keep every original brown hair pixel, outline, lock, shading, shape and position unchanged. Make all character skin, ears, eyes, face, nose, mouth, neck, torso, shirt, vest, arms, hands, shorts, legs and boots FULLY TRANSPARENT. No bald head or dummy face, no skin atall. The output contains ONLY the existing chestnut spiky hair floating in its original location and nothingelse.
STRICT exact canvas alignment: 1254x1254 source canvas, NOT tightlycropped or recentered; hair stays roughlyx285–950,y10–595, bottomtwo-thirds ofcanvas remains EMPTYtransparent. Keep original topmost spike nearx700,y10. Do not scale, rotate, move or redraw hair. Preserve the precise empty facial opening where current face will be removed. No background, shadow, text, eyes, accessories or watermark. Genuine alpha transparency throughout removedbody. This image will be overlaid over faceless hairless original body using identical coordinates.
```

### hat-mage.png

Delivered painted equipment asset; fitting must be reviewed in renderer

```text
Use case: stylized-concept
Asset type: transparent wearable wizard HAT equipment sprite for a polished chibi anime fantasy MMORPG.
Primary request: ONE beautifully hand-painted compact wizard hat in three-quarter RIGHT-facing perspective, fitted for a cute bigheaded chibi adventurer. Low-to-medium height crown with softly bent tapered tip folding backward left, NOT a giant tall cone. Rich dusky violet woven velvet fabric, subtle copper-gold embroidered small curling motifs along the lower crown, softly rolled wide oval brim with convincing cloth thickness and natural asymmetry, gentle folded creases, a narrow plum leather band with a small restrained polished copper buckle and tiny amethyst stud. Warm highlights from upperleft and soft deep violet shadows, dark warm fine outlines. Detailed handcrafted material, elegant original casual fantasy item, not overly ornate, no huge decorations.
Style: High quality painted 2D chibi anime browsergame equipment art, rounded dimensional cel shading, consistent with a brownhaired cute adventurer. No geometric vector appearance, not plastic, not pixelart, not 3Drender or photo.
Composition: Just hat, centered square1024 canvas, approximately75%width and60%height, complete edges with generous transparency, viewing down slightly at3/4right so ovalbrim front-rightlower andback-leftupper; inner opening underside subtly visible. NO head/hair/face/person/mannequin. Genuine transparent alpha, no shadow or floor.
Constraints: No text, numbers, starsymbols, logos, UI, watermark, scene/background, particles/aura, extraitems. This must look wearable and proportionate, not oversized and silly.
```

### outfit-azure-body.png

Delivered complete neck-down outfit aligned to base

```text
Use case: compositing
Asset type: complete BODY ONLY modular outfit layer, aligned1254x1254 transparent game sprite.
Image1 EDIT TARGET: exact faceless chibi characterbase. Image2 design reference ONLY: azure waistcoat/creamshirt equipment icon.
Change Image1body wardrobe to wear the bluewaistcoat from Image2, tailored to the small original chibi body: rich azureblue vest with3 small brassbuttons, creamshirt and rolled/puffed sleeves, brown narrowbelt goldbuckle; darknavy short trousers ending at exactly existing shortshem, warmbrown fitted leatherboots withsmall brass buckles at the current boot shapes. Keep original barehands and bareknees natural. Hands remainempty. Beautiful paintedcloth volume and detailing, matchingoriginalcharacterart.
REMOVE ENTIRE HEAD, EARS, face and scalp to transparent; keep neck BELOW chin only aroundy580andbelow. Nothingvisible above y575. Bodyincludingarms/hands/trousers/knees/boots must remain EXACTLY at Image1positions. Do NOT enlarge or recenter the body tofillcanvas. Final1254square stillhas huge emptyupperhalf, bodyvisible roughlyx420..855,y580..1234. Originalhandsat~(465,900)and(800,900),feetaty1225. Keeppose3/4right, shoulderposition, armangles, legangles, bodyproportionsandbootcontacts unchanged. This layerreplacesneckdownbodywithcompleteoutfit; itisNOTa torsoicon.
Original polishedoutlined2Danimechibi rendering, genuinealpha. Nohead,hair,face,hat,weapons,gloves,newhandpose,text,UI,watermark,background,shadoworplatform.
```
