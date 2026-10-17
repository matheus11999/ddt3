# Quebra-Tijolos (`brick`)

> **Revisado em 17/10/2026.** O Quebra-Tijolos está sendo refeito do zero como arma inicial (atributos 85/95/85/85, cratera 30, demolição 30%, cacos com cratera 10, POW de projétil único). Arte e fases novas em `docs/weapon-kit.md`; a mecânica dos cacos abaixo continua valendo, com as fases +0–9/+10/+12/+15.


Arma épica nova, vendida na loja por 500 Brasas (não é concedida por migração). Referências do usuário: saco vermelho, pote dourado com picareta e caixa vermelha laqueada com blocos.

## Mecânica única — estilhaços autoritativos

| Atributo | Valor | Comparação |
| --- | --- | --- |
| Ataque / Defesa / Agilidade / Sorte | 125 / 100 / 55 / 80 | 360 pontos, defesa mais alta das armas épicas |
| Dano principal | 200 | menor que as demais; compensa com os cacos |
| Cratera / explosão | 44 / 92 | cratera principal compacta |
| Gravidade | 345 | trajetória pesada, a mais curva do arsenal |
| Ângulo | 20°–80° | |
| Demolição | 60% | ignora 60% da resistência extra de cristal, pedra e metal (terra/areia/gelo inalterados) |
| Cacos por impacto | 2 (+0–8) · 3 (+9) · 4 (+10–11) · 5 (+12); Power soma +2 | |
| Caco | 24% do dano, explosão 44, cratera 17, raio 3, gravidade 420, vento ×0,5 | |

- O servidor (`server/game.ts`) simula os cacos com `shatter()` (`shared/physics.ts`) a partir do centro do impacto principal, em leque determinístico de 32° a 148° voltado para o lado do atirador. Cada caco aplica cratera, dano, carga Power e acomodação dos jogadores pela mesma função do tiro principal.
- O alvo atingido diretamente não é atingido de novo pelos próprios cacos no mesmo quadro. Impactos fora do mapa não geram cacos.
- Cacos chegam ao cliente como `Projectile` com `fragment:true` e `delay` igual ao pouso do projétil principal: sem clarão de disparo, sem pose de disparo, sem som próprio e sem marca de resíduo (o limite de 48 marcas fica para os impactos principais).
- `impact.demolition` faz o cliente reproduzir a mesma cratera em `terrainPlayback.ts`.
- Funciona com +1, +2 e Tridente: cada impacto principal se estilhaça; a duração do tiro inclui o último caco.

## Evolução visual (0–8 / 9 / 10–11 / 12)

| Estágio | Arma | Projétil | Impacto |
| --- | --- | --- | --- |
| +0–8 `weapon-brick-base.png` | saco de pano vermelho amarrado com corda e emblema de tijolos | tijolo amarrado | poeira de barro e cacos |
| +9 `weapon-brick-evolved.png` | pote dourado com faixa vermelha de nuvens, tijolos e picareta | dois tijolos com cintas douradas | clarão quente |
| +10–11 `weapon-brick-awakened.png` | caixa laqueada carmim com moldura dourada e blocos de concreto | blocos com cinta carmim e gema azul | blocos de concreto entre os cacos, faíscas |
| +12 `weapon-brick.png` | relicário carmim com asas, gema de brasa, picareta e martelo dourados, tijolos incandescentes | fardo incandescente com rachaduras de lava e tijolos orbitando | cacos em brasa |

O atlas `vfx/brick-effects.png` segue o contrato 4×3 das outras famílias (linhas: projétil, disparo, impacto; colunas: estágios), 1448×1086 RGBA. `vfx/brick-residue.png` (1024×1024) é o anel de entulho no terreno. A prancha está em `docs/previews/brick-weapon.png`.

## Origem da arte — final com `image_gen`

As seis pinturas finais foram geradas em 16/10/2026 pelo `image_gen` integrado, com `transparent_background:true`. As pinturas provisórias de Canvas serviram apenas como referência de silhueta/conteúdo; `weapon-dynamite-base.png` e `vfx/dynamite-effects.png` orientaram a qualidade da pintura. Os PNGs finais substituem os provisórios nos mesmos caminhos, sem alteração do renderer ou da mecânica. A prancha `docs/previews/brick-weapon.png` mostra os arquivos finais.

As quatro armas saíram diretamente em **1254×1254 RGBA** e o atlas em **1448×1086 RGBA**. PIL removeu apenas alfa residual quase invisível. Para manter o contrato de recorte automático, cada pintura do atlas foi reenquadrada na sua célula de 362×362 com margem transparente verificada; nenhuma célula atravessa outra. O resíduo foi redimensionado para **1024×1024 RGBA**, com centro explicitamente transparente e borda externa suavizada. Não houve repintura procedural dos desenhos. Os originais locais do gerador ficam fora do Git; os seis assets finais e esta receita acompanham o repositório.

### Prompts utilizados

**Arma +0–8** — referências: `weapon-brick-base.png` provisória e `weapon-dynamite-base.png`.

```text
Use case: stylized-concept. Asset: FINAL transparent PNG mobile-game weapon icon replacing the provided provisional Quebra-Tijolos +0–8 icon. Image 1 is the composition/silhouette reference; Image 2 (Dynamite) is ONLY the painted rendering-quality reference. Repaint image 1 as a plump red cloth sack with thick tactile fabric folds, gathered neck tied by an ivory cream twisted cord with two short golden tassels; exactly THREE chunky terracotta-red fired-clay bricks protrude clearly from the top; small stitched gold emblem of a brick-laying pattern centered on the sack front. Preserve the simple early-stage identity: no pot, pickaxe, box, magical aura or other objects. High-end hand-painted chibi mobile RPG weapon illustration, thick dimensional 3D volume, saturated crimson and warm gold, restrained dark-brown contour, distinct rough clay grain and textile texture, luminous studio light upper left with deep warm shadow lower right. Three-quarter view with visually coherent brick perspective. Centered large subject, nearly fills a square canvas but all edges safely inside. Genuine fully transparent background; no black/white backdrop, card, ground shadow, text, watermark, UI, haze, pastel, flat vector, pixel art. Output intended to be resized to 1254x1254 RGBA.
```

**Arma +9** — referências: pintura provisória +9 e pintura final +0.

```text
Use case: stylized-concept. FINAL transparent PNG icon of the SAME Quebra-Tijolos weapon upgraded to +9. Image 1 is provisional silhouette/composition reference; Image 2 is its +0 painted style reference. Preserve weapon family identity: red clay bricks. A round substantial GOLDEN POT, thick rim and short foot, encircled by a SATURATED CARMINE RED band ornamented with golden spiral cloud swirls, two dimensional hanging gold ring handles (one each side). Filled with several chunky terracotta bricks, a single STEEL pickaxe with warm wooden handle embedded diagonally in the brick pile. No cloth sack remains; this is the first evolved vessel. Exquisite hand-painted chibi mobile RPG weapon art, thick volumetric 3D shapes, tactile cast metal, fired-clay grain, deep dark-brown controlled contour, top-left studio highlights, warm shadow, lively saturated scarlet and gold, clear silhouette at 64px. Centered on square canvas, object almost fills but never clips. Genuine transparent background, no text, no card, no floating unrelated props, no white or black backdrop, no flat vector or pixel art, no washed colors.
```

**Arma +10–11** — referências: pintura provisória +10–11 e pintura final +0.

```text
Use case: stylized-concept. FINAL transparent PNG icon of the SAME Quebra-Tijolos weapon upgraded to +10/11. Image 1 provisional concept gives exact object hierarchy; Image 2 shows the earlier painted family finish. A solid ORNATE CARMINE LACQUERED OPEN CRATE, deep dimensional red panels, thick gleaming gold frame and gold FLAME SCROLLS engraved on front, FOUR SHORT CURLED GOLD FEET. Front-center golden shield badge set with ONE luminous blue gem. The open crate holds THREE clearly legible gray concrete cinder blocks with visible two holes each, plus ONE terracotta red brick, all nested naturally rather than floating. No pickaxe and no wings at this stage. Hand-painted chibi mobile RPG item, lush saturated red and gold, rough concrete vs glossy lacquer vs metal distinct, thick painted 3D volume, restrained dark brown outlines, upper-left studio light, deep warm shadows. Centered large on square canvas with all object edges inside. Real transparent alpha background. No text, no ground/card, no haze, no pastel, no flat vector, no pixel art.
```

**Arma +12** — referências: pintura provisória +12 e pintura final +0.

```text
Use case: stylized-concept. FINAL transparent PNG icon of the SAME Quebra-Tijolos weapon fully evolved at +12, retaining the +10 rectangular open crimson lacquer crate silhouette (Image 1) and the exact painted family finish of Image 2. Royal crimson-and-gold RELIQUARY CRATE with heavy ornate gold frame, curled feet and inner masonry; sculpted broad golden WINGS flanking one glowing ember-red gemstone set on its front. Inside are several clearly recognizable red CLAY BRICKS with incandescent orange LAVA CRACKS; some golden masonry fittings. A gilded pickaxe and gilded mason's hammer cross BEHIND the crate, their handles and heads identifiable without hiding the bricks. Localized warm golden aura hugging the object and a few sharp star-like glints, all fading into true transparency within the canvas. Most ornate stage, but retains same weapon identity and central readable silhouette. Hand-painted premium chibi mobile RPG icon, thick volumetric 3D, vivid saturated carmine, molten orange and polished gold, controlled dark brown painterly contours, upper-left studio light, jewel-like highlights. Object large with small safe margins, no clipping. Genuine transparent alpha, no rectangle or opaque background, no label/text/card/ground, no haze, no pastel, no flat vector, no pixel art.
```

**Atlas de efeitos** — referências: atlas `brick-effects.png` provisório e `dynamite-effects.png`.

```text
Use case: stylized-concept. FINAL 4-COLUMN by 3-ROW painted 2D mobile-game VFX SPRITE ATLAS for one masonry weapon, reference image 1 is the provisional layout and contents; image 2 is the painting quality/style. EXACTLY TWELVE ISOLATED SPRITES in a regular invisible 4×3 grid on a true transparent rectangular 4:3 canvas. Each of the 12 cells has its own generous fully TRANSPARENT margin of at least 12% on every side; no visible grid, borders, labels, text, background or shadows across cells. Nothing crosses from one cell into another. Columns are weapon +0–8, +9, +10–11, +12, evolving consistently left to right. ROW 1, flight sprites horizontally pointing RIGHT: cell1 one red clay brick wrapped by cream rope; cell2 two red clay bricks with small gold bands; cell3 gray two-hole concrete block plus a red brick bound with carmine straps and one tiny blue gem; cell4 compact glowing gilded bundle of lava-cracked masonry, outlined in gold. All flight sprites individually centered. ROW 2, muzzle launch effects traveling LEFT TO RIGHT: compact clay-dust jet with several orange brick chips, growing progressively to gilded warm sparks in last cell; increasingly dramatic but confined to cells. ROW 3, impact effects: clay dust domes with broken bricks flying and a bright warm central flash, increasing through columns; third adds gray broken concrete pieces; fourth glowing molten bricks and golden sparks. Art style: premium HAND-PAINTED chibi action-game VFX like reference dynamite sprite sheet, layered semi-transparent dust and luminous bursts, rich terracotta, crimson, gold, ivory light, controlled deep-brown fine outlines on SOLID projectiles only, volumetric 3D painted fragments, saturated and crisp. No flat vector, no neon circles, no opaque backdrop, no haze or pastel. Especially keep 12 isolated alpha islands with transparent gutters both horizontally and vertically. Intended final size 1448×1086 RGBA, each cell 362×362.
```

**Resíduo** — referências: resíduo provisório e pintura provisória +10–11.

```text
Use case: stylized-concept. FINAL transparent top-down TERRAIN RESIDUE sprite for Quebra-Tijolos masonry weapon, replacing provisional Image 1, matching the refined materials/color of Image 2. Single circular broken ring viewed DIRECTLY FROM ABOVE, evenly centered on a square transparent canvas. Ring consists of scattered recognizable broken RED CLAY bricks, a few cracked GRAY concrete fragments, warm ochre mortar cracks and fine red clay dust. CENTER MUST BE A LARGE CLEAN FULLY TRANSPARENT HOLE (at least 42% canvas width) so original game terrain shows through. Outside edge feathered/dissolving gradually into real alpha transparency; no hard circular cut line. Visually rich but restrained hand-painted chibi game debris with textured stone and individual masonry chips, warm top-left light and dark brown detail, saturated terracotta plus ochre; NOT a solid explosion, fire aura or ground disk. No background, no turf, no text, no border, no other objects, no pixel art, no flat vector, no washed-out haze. Final intended 1024×1024 RGBA.
```
