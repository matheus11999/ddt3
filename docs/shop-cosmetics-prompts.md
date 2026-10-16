# Coleção da loja — roupas e acessórios


## Correção do Cabelo Ondulado vendido na loja

`hair-wavy.png` era referenciado pelo catálogo mas nunca havia sido gerado; a busca no workspace e `docs/art-prompts.md` confirmaram a ausência. Em 16/10/2026 foi criada pintura original dourada com mechas onduladas e silhueta própria. Fonte preservada: `/workspace/generated_images/exec-b6b1c175-f249-449d-a9b9-b1ba5f1f1c2a.png`, RGBA 1254×1254. O registro explícito em `PAINTED_ACCESSORIES` adapta a pintura à cabeça universal; não altera a cabeça para acomodar o cabelo. Ícone e avatar usam o mesmo recorte pintado; tinturas preservadas.

24 combinações foram verificadas com o ondulado: óculos Sprint/Gatinho, sem óculos, boné, direita/esquerda, caminhada, disparo e corpo de combate. Prancha em `test-results/shop-wavy-hair-sheet.png`. Executar com `BASE_URL='http://127.0.0.1:5177/?wavy' node scripts/verify-shop-cosmetics.mjs`.

### Prompt exato do cabelo ondulado

```text
Precise registered game hair-layer edit. Image1 is the HAIR LAYER edit target and its exact transparent canvas registration, Image2 is the universal bald HEAD and BODY only as a fitting reference. Produce ONLY an entirely new WAVY GOLDEN-HONEY HAIRSTYLE matching the same chibi hand-painted game, with softly layered S-shaped waves, a side-swept wavy fringe and curled side locks. Visibly distinct from the spiky silhouette: NO sharp spiky quiff. Warm saturated honey gold and rich caramel shadows, crisp delicate brown contours, painted volumetric strands and restrained polished highlights. Preserve Image1 canvas dimensions, scale, orientation and registration. Same three-quarter head looking right, near ear left, far eye right. Hair sits on universal skull Image2 around x425-845,y180-596 on a 1254 square. Hair silhouette should occupy roughly x300-950,y70-620, with LARGE fully transparent face opening around x550-830,y370-590. Leave both eyes at (650,444),(798,466), cheek, nose and mouth entirely visible. Preserve empty lower half of full square canvas, DO NOT crop or recenter or enlarge to fill canvas. Hair ONLY, genuinely transparent RGBA elsewhere. No skin, head, eyes, face, ears, neck, clothing, hat, glasses, jewelry, text, particles, frame, background or shadow outside hair. Designed as a hair layer applied above the same universal bald head.
```



### Pernas para caminhada

```text
Create a transparent game animation atlas with EXACT TWO lower-body clothing sprites, left and right, side-by-side separate with ample blank alpha gap. Use supplied image as CLOTHING STYLE AND COLOR reference. ONLY waist, hips, legs and shoes, no heads, no arms, no chest, no accessories, no labels. LEFT: lower half of blue/orange male racing jumpsuit from reference, complete pants and driving sneakers, waist to soles. RIGHT: lower half of female dancer clothing from reference, navy shorts, opaque black leggings, red high-top sneakers, waist to soles. Both stand neutrally in three-quarter view toward RIGHT, legs STRAIGHT and PARALLEL separated with visible transparent gap from crotch to soles, two complete feet on same ground line. Neither crossing, bending nor touching legs. This is an animation rig source; left anatomical leg belongs to LEFT half of each lower body, right leg to RIGHT half, no crossing anywhere. Vivid saturated painted chibi materials with refined shaded volume, match exact same clothing design and blue orange/red black colors of reference. Canvas wide, each outfit occupies its own half with waist centered near upper10%, soles near90%, both same height. Do not include upper clothing. Transparent RGBA no background, no glow, no shadows outside garments.
```


Assets originais gerados com image_gen em 16/10/2026. Fontes RGBA preservadas: `shop-outfits.png` e `shop-accessories.png`, ambas 1254×1254. Crops e encaixes explícitos em `PAINTED_OUTFITS` e `PAINTED_ACCESSORIES`, sem recortar ou repintar a arte por script. Ícones de acessórios e roupas reutilizam a mesma pintura aplicada ao avatar.

- Piloto Relâmpago: postura com mãos na cintura e pés separados, macacão azul/laranja.
- Dançarina Rubi: gesto de paz, mão na cintura e pernas inclinadas, jaqueta vermelha, camiseta turquesa, shorts e leggings opacas.
- Cada roupa possui pintura própria compacta de combate, conservando os materiais e as cores.
- Corte Tempestade e Rabo de Cavalo Rubi: pinturas independentes compatíveis com cabeça universal.
- Óculos Sprint e Gatinho: pinturas registradas nos mesmos centros oculares; direção e poses seguem o rig.
- Piscadela Confiante: sexto rosto, composto pelo mesmo `composeUniversalHead`, sem alterar máscara, shape ou âncoras universais.

Itens vendidos na loja, sem entrega automática por migração. O filtro masculino/feminino organiza a vitrine; não cria uma restrição no equipamento do perfil.

As pernas de caminhada usam `shop-walking-legs.png` (1774×887), com desenhos separados e sem cruzar as pernas, enquanto a postura parada preserva o gesto exclusivo de cada roupa. O cache do rig inclui o ID da roupa além do atlas, para impedir reutilização incorreta entre roupas que compartilham PNG. Recortes poligonais dos cabelos isolam as células vizinhas do atlas; ícone e avatar usam o mesmo recorte.

## Prompts exatos

### Roupas

```text
Create a production sprite atlas on genuine transparent RGBA canvas, 2048x2048 square, EXACT 2 columns by 2 rows. Four isolated complete clothing bodies with no heads, no hair, no helmets, no backgrounds, no cards, no labels. Sophisticated painted chibi game illustration matching reference garment quality, vivid saturated materials, fine brown edges and shaded dimensional folds. TOP LEFT: male racing outfit in cobalt blue, bright orange panels and white piping, high collar, gloves and chunky driving sneakers. Unique confident standing pose: both elbows bent, gloved hands on hips, feet planted wide, torso 3/4 right. TOP RIGHT: female street dancer in crimson cropped varsity jacket over teal shirt, navy shorts with full opaque black leggings, red high-top sneakers. Unique lively standing pose: left hand raised near shoulder making peace sign, other hand on hip, knees subtly angled, NOT crossed legs, torso 3/4 right. Neck visible, no head. Upper bodies fit own 1024 square cells with neck centered x512 local at y100, feet y920, occupy x200-850. BOTTOM LEFT: compact prone combat version of EXACT blue/orange racer clothing, complete body sideways with feet on left and neck collar at right, arms supporting upper torso. BOTTOM RIGHT: compact prone combat version of EXACT crimson/teal dancer clothing, complete body sideways with legs left, neck collar right, arms supporting upper torso. Bottom prone bodies span x100-920 locally,y350-700 local; matching game chibi battle body, NOT realistic human. All painted parts intact inside own cell with ample alpha gaps. Only clothing bodies, preserve obvious different poses. No weapons, no aura, no shadows outside bodies.
```

### Cabelos e óculos

```text
Production painted chibi equipment atlas, genuine transparent RGBA, square canvas. EXACT four isolated items in 2x2 equal cells. Top-left: masculine cobalt-black undercut hairstyle, brushed up quiff with azure highlights, short sides, 3/4 view toward right. Top-right: feminine dark auburn high ponytail with bright red tie, swept bangs and thick flowing ponytail extending LEFT behind head, 3/4 toward right. Both hairstyles are ONLY HAIR with large transparent opening for face, NO skin or head or eyes or ears; compatible with the supplied universal bald head proportion and 3/4 orientation. Each hairstyle fills x10%-90% of its own cell, y5%-95%, isolated. Bottom-left: SPORT WRAP sunglasses, dark cobalt curved frame with cyan reflective lenses, seen three-quarter right. Larger near lens on LEFT, smaller far lens on RIGHT and a short left temple extending left-up toward ear; transparent outside glasses, eyes visible through translucent lenses. Bottom-right: CAT-EYE glasses, elegant crimson translucent frames and clear lightly rose lenses, three-quarter RIGHT same perspective as sport glasses. Larger near lens LEFT, smaller far lens RIGHT. Each glasses pair at center of own cell with generous transparent margins. Refined painted materials, smooth volumetric shading, fine clean contours, vivid colors, readable small game icons, NOT flat vector, NOT photographic. No text, no card frame, no face or skin, no background, no shadows outside objects. No extra accessories or repeated items.
```

### Rosto

```text
Precise registered face-expression edit. Image1 is exact EDIT TARGET and reference of painting and canvas registration. Change ONLY INTERNAL expression to confident playful WINK: near larger LEFT eye closed in an elegant smiling curved eyelid, far RIGHT eye open with amber brown detailed iris, raised friendly brows, small open side smile with tiny upper teeth. No other changes. Preserve exactly Image1 existing bald head silhouette, ear, nose, chin, warm peach skin, shading, width, height, 3/4 right perspective, position and size on full square transparent canvas. Head is small in upper middle of canvas, approximately x375 to906,y218 to732 on 1254 square. DO NOT zoom or recenter. No hair, hat, body, neck, props, text or background. Fine painted chibi features with controlled brown contours, genuine transparent alpha outside head. Match existing texture and style.
```



## Verificação

`verify-shop-cosmetics.mjs` inspeciona 24 montagens: duas roupas, dois cabelos, dois óculos, rostos Brave/Wink, com e sem boné, ambos os sentidos, caminhada, disparo e combate. Confere o ID da pose por roupa, existência de rig de caminhada/combate, ícones pintados e zero diferenças de alfa da nova expressão. Prancha: `test-results/shop-cosmetics-sheet.png`. `verify-faces.mjs` verificou os seis rostos, todos com alfa idêntico e desenho interno diferente.

## Correção de encaixe dos óculos — 16/10/2026

Sprint e Gatinho não compartilham mais um retângulo de destino que esticava as lentes verticalmente. O renderer registra dois centros ópticos medidos no atlas original: Sprint `(344,1014)/(557,1042)` e Gatinho `(945,1018)/(1155,1036)`. Uma transformação de escala uniforme, rotação e translação alinha esses pontos aos sockets universais `(650,444)/(798,466)`, sem deformar cabeça ou lentes. Os recortes originais dos ícones permanecem iguais.

Óculos são compostos sobre o rosto, antes do cabelo e do chapéu: franja e costeletas ocluem as hastes. Os modelos antigos também usam os sockets universais, com lentes menores. Não voltar a posicionar óculos pelas bordas externas da arte; hastes compridas deslocam esse enquadramento.

`verify-glasses.mjs` gera uma prancha ampliada de 30 combinações (seis rostos × sem óculos/quatro modelos); `verify-shop-cosmetics.mjs` cobre sentidos, caminhada, disparo, combate e chapéu. Inspecionar as imagens além de verificar carregamento.

### Chapéus e bonés

Boné: largura66, altura máxima46, base−112, centro−3. Astral: pintura existente `/assets/hat-mage.png` usada tanto no avatar como no ícone; largura82, altura máxima70, base−107, centro−4. Ambos giram0,035rad em torno da própria base, sem o deslocamento lateral causado pela origem do personagem. Óculos de Voo usam escala0,80 em `(1,−124)`; elmo escala0,85 em `(−3,−116)`.

O cabelo sob copa fechada tem somente a região superior acomodada verticalmente (fator0,42, junção−112 ou−105 no elmo), em camada cacheada. Franja inferior e comprimento do rabo/laterais permanecem no registro original; não usar um corte horizontal que deixe pontas retas expostas fora do chapéu. O rosto não é deformado.

Para a prancha de 30 combinações de cabelo/chapéu, incluindo sem cabelo: `BASE_URL='http://127.0.0.1:5177/?hats' OUTPUT=test-results/hats-fit.png node scripts/verify-glasses.mjs`. A prancha de poses também inclui os quatro chapéus.

## Coleção de chapéus — revisão de encaixe pela banda

Original: `/workspace/generated_images/exec-a140223d-84c7-4701-8ae7-857e868c7359.png`; cópia RGBA1254×1254 em `public/assets/shop-hats.png`. Atlas2×2: Boné Relâmpago(vermelho/azul/raio), Bucket da Maré(turquesa/faixa laranja/concha), Boina Rubi(veludo magenta/pena turquesa), Chapéu Tropical(palha/faixa esmeralda/flor coral). Todos unissex; preços140/140/180/180 Moedas Brasa; cosméticos sem bônus, comprados e nunca concedidos automaticamente.

Prompt utilizado: production-ready 2D painted equipment atlas, square transparent RGBA, four isolated hats in a 2×2 grid with generous gutters; three-quarter right, near ear on left; no head/mannequin/face/hair/body. Painted dimensional materials, saturated vivid colors, crisp dark outlines and controlled highlights. Red baseball cap/cobalt visor/yellow lightning badge; turquoise bucket/orange band/shell; ruby magenta beret/purple band/teal feather; golden woven straw hat/emerald band/coral flower. Same upper-left light and chibi fantasy artillery-game style, full crown depth, no cards, text, detached sparkles or aura.

Recortes e polígonos de isolamento estão em `PAINTED_ACCESSORIES`: thunder[20,110,635,425], tide[630,110,624,490], ruby[0,680,635,430], tropical[615,685,639,460]. Ícones e avatar usam esses mesmos recortes; não exibir o atlas inteiro.

**Substitui os ajustes anteriores dos bonés por retângulo externo:** `CAP_BANDS` alinha dois contatos da abertura interna. Boné antigo: PNG bruto[280,895]/[1110,700], limites alfa[95,142,1202,798]. Relâmpago:[84,492]/[548,350]. Alvos no atlas universal:[430,414]/[815,327]. A transformação é uniforme e acompanha o rig em todas as poses. A aba não participa da medida do tamanho da cabeça.

O cabelo não é mais comprimido em toda a largura. O ajuste de copa varia suavemente por coluna, preserva laterais e usa região central mais estreita para o rabo de cavalo. Cabelo posterior → chapéu → cabelo abaixo da faixa; o último passe dos bonés exclui a aba rígida por seu polígono transformado. Não introduzir recortes poligonais arbitrários em mechas opacas: deixam cortes retos sobre o chapéu. Cabeça universal intacta.

Pranchas: `new-hats-fit.png` e `hats-seated.png`, 30 combinações cada; `new-hats-poses.png`. Teste real: `scripts/smoke-headwear.mjs`; economia compra/equipa os quatro chapéus e confirma persistência.

## Chapéus vestidos e cabelos cobertos — correção após pesquisa A/B

Originais preservados:
- `/workspace/generated_images/exec-0d84eb91-161b-4b23-9819-f1a4398685c1.png` → `public/assets/hair-covered-atlas.png` (1536×1024 RGBA).
- `/workspace/generated_images/exec-530e7408-ac16-49aa-b4d0-60c03c37d170.png` → `public/assets/headwear-worn-atlas.png` (1536×1024 RGBA).

Cabelo: referências `character-base.png`, `hair-spiky.png`, `hair-wavy.png`, `shop-accessories.png`. Prompt solicitou atlas2×2 com apenas cabelo, sem rosto/corpo/chapéu; versões preparadas para boné justo, copa baixa naturalmente penteada, sem topetes altos; franjas/tempos/nuca preservados. Castanho aventureiro, dourado ondulado, azul/preto Tempestade e auburn Rubi com rabo baixo atrás da cabeça. Mesmo ângulo3/4 direita do molde universal, pintura saturada com contorno e fios. Transparência real confirmada pelo canal alfa; o RGB dos pixels transparentes contém cores de fundo que não são desenhadas.

Chapéus: seis peças em atlas3×2, Explorador verde/marrom, Relâmpago vermelho/azul, Maré turquesa/laranja, Rubi vermelha/roxa, Tropical palha/esmeralda e Astral violeta/dourado. Prompt enfatiza copa envolvendo o crânio, perspectiva3/4 direita ligeiramente vista de cima, abas curtas/adequadas e ausência da cavidade oval frontal das pinturas de produto anteriores. Não são artes copiadas do DDTank.

Registro definitivo do cabelo em `COVERED_HAIR` (`appearance.ts`): source em pixels do atlas, destination em coordenadas do molde1254×1254. Transformação uniforme; não deformar por colunas. Lunar usa a pintura castanha tingida. Chapéus em `WORN_HEADWEAR` (`headwear.ts`): source, pares de contatos/assento e polígonos clip que excluem imagens vizinhas. O mesmo recorte alimenta o ícone. O cabelo posterior passa antes do rosto e a franja antes da aba, tanto em pé quanto em combate.

Validação: 258 casos em `test-results/headwear/`, incluindo cabeça sem cabelo, dois óculos, cinco estilos, oito equipamentos de cabeça e poses espelhadas. Inspeção visual das pranchas confirmou ausência dos fragmentos do atlas e contato da faixa/copa sem os topetes antigos atravessando o chapéu. `headwear-research.md` registra a pesquisa e limitações. Elmo e Óculos de Voo permanecem desenhos procedurais; apenas o elmo seleciona cabelo coberto.
