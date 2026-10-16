# Rostos completos — arte e registro

Gerados em 16/10/2026 com a ferramenta integrada `image_gen`, em modo de edição com transparência. Não foi utilizado CLI/API alternativo. Arquivos finais em `public/assets/faces/`, PNG RGBA 1254×1254.

## Direção de arte

Cada item representa rosto completo: olhos, sobrancelhas, boca e expressão. A paleta comum âmbar/castanha é intencional: a diferença é de feição e de desenho, não apenas de cor. A cabeça, perspectiva em 3/4, orelha, nariz, sombras de pele e iluminação permanecem na mesma família visual. Os arquivos não incluem cabelo, chapéu, pescoço, corpo ou roupas.

## Registro obrigatório

A geração preservou aproximadamente o template entre as cinco expressões, mas não garante uma silhueta idêntica pixel a pixel. O jogo deve usar a máscara universal da cabeça de `character-base.png` e conservar a pele base sob a arte; não se deve substituir o contorno por cada PNG. O manifesto `public/assets/faces/manifest.json` registra o retângulo de conteúdo de cada PNG, medido com alfa >= 128 para ignorar resíduos de antialias quase invisíveis. Todos devem ser registrados no mesmo destino universal (aproximadamente `[425,180,420,416]`, com encaixe final definido pelo renderer). A máscara universal é necessária mesmo após a normalização. Integração concluída em `src/game/faces.ts`: enquadramento comum `[375,218,531,514]`, destino `[425,180,420,416]`, máscara e mesclagem preservam a silhueta-base. Cinco rostos montados e inspecionados; `scripts/verify-faces.mjs` confirmou zero diferenças de alfa. Regra obrigatória para futuras artes em `docs/face-authoring-rules.md`.

Inspeção visual realizada em todas as saídas: sem cabelo/corpo; cabeça em 3/4; alegria, confiança, provocação, serenidade e determinação identificáveis. Inspeção de pixels confirma transparência real, aproximadamente 1,36 milhão de pixels totalmente transparentes por imagem. Os contornos de alfa variam poucos pixels entre saídas e não devem definir o contorno final do personagem.

A primeira tentativa de sorriso, que ampliou demais a cabeça, foi descartada. A segunda editada é o arquivo final. Todos os demais rostos derivam dessa segunda versão, com `face-brave` como referência intermediária.

## Prompts exatos

### face-smile.png — sorriso alegre

Passagem 1:

```text
Use case: precise-object-edit. Asset type: registered character head layer for a 2D chibi fantasy game.
Image 1 is the EDIT TARGET, a bald blank-face character on transparent 1254 by 1254 canvas. Image 2 is STYLE REFERENCE for hand-painted facial features and quality.
Create ONLY the complete painted HEAD, ears and face from Image 1, adding a JOYFUL SMILING expression. Remove the entire neck and body, leaving genuine transparent alpha everywhere outside the head. Preserve the EXACT head outer silhouette, position, scale and three-quarter right-facing perspective from Image 1. Do not crop or recenter or zoom: preserve the full square canvas and empty space below. Head extends approximately x425–845, y180–596. Left ear x435–534,y421–532. Chin y596. Keep that registration exactly.
The face must have expressive curved happily smiling eyes with delicately rendered upper eyelid shapes (the near eye centered around654,447; far eye793,477), warm brown expressive brows and a naturally open joyful smile near740,541 with small refined teeth and warm pink tongue. Two eyes with different perspective sizes, not straight-on symmetry. Soft blush cheeks, tiny nose, warm peach skin and hand-painted volume. Match Image 2's sophisticated clean warm brown linework, beautiful smooth shaded skin, and appealing refined anime-chibi illustration. Expression should read joy at small size, not an emoji. NO HAIR at all. No eyebrows outside head. No hat, glasses, neck, collar, clothing, body, shadow underneath, particles, label, frames, text or watermarks. No flat vector drawing, no oversized oval eye holes, no photographic texture. Preserve transparent canvas.
```

Passagem 2:

```text
Precise registration correction. Image 1 is the CANVAS AND SILHOUETTE REFERENCE. Image 2 is the EXPRESSION AND PAINTING REFERENCE. Produce an edited copy of IMAGE 1 where the existing blank head is filled with exactly Image 2's cheerful closed happy eyes, arched brows and joyful open smile. Do not change Image 1's canvas framing or head position or head scale at all: same SMALL head in UPPER HALF of 1254 by1254 transparent square, at x427 to842,y181 to596. Preserve Image1 ear/nose/chin silhouette and skin. Keep Image1 entire body in EXACT same position and dimensions as temporary spatial scaffold, but turn ALL BODY AND NECK pixels fully transparent in the final output. Only the existing small head stays. Bottom half belowy600 must be completely empty transparent. Do not resize that head to fill the image. Final HEAD occupies exactly33% of canvas width and33% height, and center approximately(635,390). No hair, neck, clothes, body, icons, borders, particles or text. High quality soft painted chibi skin and expressive elegant warm brown linework, consistent with reference.
```

### face-brave.png — corajoso

```text
Use case: precise-object-edit. Image1 is EDIT TARGET: transparent complete bald smiling head. Image2 is FACIAL STYLE REFERENCE, the game's original hero.
Change ONLY Image1 facial expression to BRAVE / friendly confident default expression, using the original hero's richly painted AMBER-BROWN open eyes with iris depth, elegant upper eyelids, naturally raised brown eyebrows and a subtle closed-mouth confident smile. Preserve the exact bald head silhouette, ear, nose, skin painting and canvas position and dimensions from Image1. Eyes in three-quarter right-facing perspective, near eye larger than far eye, positioned like Image2 original. A soft confident expression with excellent illustrated detail at small game size, not aggressive. No hair, no hat, no body, no neck, no clothing, no particles, no symbols, no text. Retain genuinely transparent background and full square canvas. Premium warm hand-painted chibi fantasy game illustration, refined thin brown contours and soft peach shaded volume. No vector circles or oversized black holes, no emoji face.
```

### face-taunt.png — provocador

```text
Use case: precise-object-edit. Image1 is EDIT TARGET: the finished brave bald chibi head layer. Change ONLY the FACIAL EXPRESSION to PLAYFULLY TAUNTING / cheeky challenger. Preserve the exact outer head silhouette, warm peach skin painting, ear, tiny nose, scale and position on the transparent square canvas. New expression: distinctly asymmetrical eyebrows with one eyebrow lifted, near eye confidently half-lidded and far eye slightly narrower, richly painted amber-brown irises gazing forward-right, a mischievous asymmetrical closed smile lifted at one corner. Relaxed smart teasing character, not angry, cruel, evil or aggressive. Eyes and mouth must be genuinely different shapes from the brave face. Keep premium hand-painted anime-chibi fantasy art, refined brown contours, warm shaded cheeks, glossy detailed irises with subtle highlights, not flat vector. No hair, no hat, no neck, no body, no clothes, no props, no text, no icons or particles. The head must not move or resize. Preserve full square canvas and genuine transparent alpha outside the head.
```

### face-serene.png — sereno

```text
Use case: precise-object-edit. Image1 is the universal bald chibi HEAD template and edit target. Change ONLY its INTERNAL painted facial expression to SERENE / sweet and calm. Everything about HEAD EXTERNAL SHAPE MUST REMAIN PIXEL ALIGNED: same round scalp outline, cheek, chin, ear, tiny nose, width, height, three-quarter right-facing perspective, canvas position and scale. Do not move skin edges. Keep universal eye centers, brow areas and mouth center, varying eyelids and features within them.
Expression: softly relaxed almond-shaped half-open eyes, amber-brown irises with finely painted detail, gently curved resting brows and a very small closed sweet smile. Calm content mood with subtle peach blush. The expression must be noticeably different from the wide-eyed brave face: relaxed upper lids, soft smaller smile, restful brows. No exaggerated sleepiness or squint, no tears.
Same premium painted chibi fantasy art, refined brown linework, smooth warm skin volume, not flat vectors, not emoji. No hair, hat, neck, body, clothes, props, text, symbols, shadows outside the head. Retain genuine alpha outside the unchanged head and original full square canvas framing.
```

### face-fierce.png — determinado

```text
Use case: precise-object-edit. Image1 is the universal bald chibi HEAD template and edit target. Change ONLY its INTERNAL facial expression to FIERCE / focused determined adventurer. Keep the identical outer head silhouette and registration: same scalp, cheek, chin, ear, nose, skin tones, canvas position, width, height and right-facing three-quarter perspective. Do not change head anatomy or move the universal facial anchors.
Expression: determined focused amber-brown eyes with lower narrower upper lids, gently sharply angled eyebrows leaning down toward the nose, firm small closed mouth with a slight set lower lip. The eyes remain beautifully rendered and appealing, not enraged, not villainous. Clearly a brave battle-ready focused face, visibly different from the cheerful original. Refined warm brown linework, premium soft painted skin, amber irises with detailed depth and controlled highlights. No grimace, no fangs, no wrinkles, no huge eyebrows, no rage marks. No hair, no hat, no neck, body, clothing, props, lettering, icons or particles. Full square canvas unchanged and genuinely transparent outside head.
```


## Piscadela Confiante — coleção da loja

Sexta expressão gerada a partir de `face-brave.png`, no mesmo canvas RGBA 1254×1254. Fonte original preservada em `/workspace/generated_images/exec-6de60093-b54e-4401-bf0b-b5de215a6790.png`. Prompt exato registrado em [coleção da loja](shop-cosmetics-prompts.md). Usa o mesmo retângulo universal e compositor; limite alfa medido `[379,221,523,506]` é apenas metadado, sem alterar escala por rosto. Verificação dos seis rostos confirmou zero diferenças de alfa e 15.176 pixels internos significativamente diferentes da expressão base.
