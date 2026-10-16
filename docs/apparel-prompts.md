# Estado atual — duas roupas, caminhada articulada e combate deitado

Esta seção prevalece sobre o histórico abaixo. Por instrução posterior do usuário, **todas as roupas antigas foram removidas, inclusive Azure/Celeste e Royal/Real**. O catálogo, o inventário migrado e o renderer usam somente `outfit-surfer` (Surfista da Maré) e `outfit-executive` (Executivo). IDs antigos recebidos pelo renderer resolvem para Surfista; enquanto a pintura carrega, nenhuma roupa antiga aparece como fallback. `adventurer.png` permanece apenas como fallback da cabeça, nunca como corpo.

No lobby, mochila e sala, cada roupa conserva sua pose pintada exclusiva: shaka/base aberta do Surfista; mão na gravata/bolso e tornozelos cruzados do Executivo. Cores vivas, materiais definidos e cabeça universal são regras permanentes. No combate, ambas usam pinturas próprias deitadas e compactadas para proporção chibi: corpo com cerca de 71 × 28 unidades, pernas curtas atrás e cabeça universal ocupando aproximadamente 75% da altura total. A roupa permanece reconhecível pelas mangas, cores e gravata, com antebraços apoiados e cabeça erguida. Não se gira o boneco inteiro para fingir essa posição. A arma é desenhada atrás de todas as partes do personagem. O contrato é `AvatarContext.combat`; na escala 112 da batalha a arma respeita a referência de disparo `x + 27 × facing, y - 40`.

## Caminhada e registro

Os PNGs de caminhada foram pintados por `image_gen`, com pernas descruzadas e separadas. Os originais são preservados. O recorte de torso usa a pintura original da roupa para manter seus gestos. Coxa, canela e pé têm pivôs próprios por conjunto; cinemática inversa de duas juntas mantém o comprimento dos membros e alterna apoio/levantamento. A fase recebe a distância real percorrida em `movementDistance`, evitando pés deslizando no chão. A sola é medida pelo alfa da própria pintura. A transição usa uma única silhueta opaca, sem sobrepor dois pares de pernas transparentes; ao parar volta à pose exclusiva.

| Asset | Original gerado | Registro fonte → atlas 1254² |
| --- | --- | --- |
| `outfits/outfit-surfer-walk.png` | `exec-b3f5396a-d1d7-4873-b806-eb520532a813.png` | `[450,675,500,540]` → `[500,818,380,410]`; somente pernas |
| `outfits/outfit-executive-walk.png` | `exec-3afd59d4-b656-4844-8248-66cf99b2b2ed.png` | `[415,405,500,830]` → `[470,555,405,673]` |
| `outfits/combat-prone.png` | `exec-f1ba6da2-f78a-4a93-89b5-0a7a6fcee818.png` | Surfista `[25,380,990,350]`, Executivo `[1040,380,970,350]` → `[201,1018,560,220]` |
| `auras/upgrade-rings.png` | `exec-162f7431-6f91-4846-9b7a-00511f834b2a.png` | centros/raios `387,358,345`; `1097,347,347`; `1790,360,340` |

Originais em `/workspace/generated_images/`. Os cortes e pivôs detalhados estão em `appearance.ts`. As duas pernas deitadas e o torso usam camadas próprias para um rastejo curto; a cabeça mantém desenho, escala e encaixe universal, mudando somente a transformação do conjunto. O combate não possui dez pinturas completas diferentes: reação, tiro, carga, queda e derrota usam a pintura deitada com movimentos limitados. A reconstrução das mãos para cada arma e deformação contínua do tecido continuam fora desta entrega.

## Aura luminosa: somente inventário, perfil e cartas

A instrução final do usuário rejeitou os aros metálicos sólidos. A correção final seguinte pediu um anel mais grosso. O atlas ativo contém bandas contínuas de plasma com bordas luminosas duplas e núcleo energético, ainda de **luz translúcida**: +5 ciano/safira, +9 violeta com pequenas runas, +12 luz dourada com estrelas. A composição `screen` com alfa oscilando suavemente em torno de 64% deixa o fundo visível; os centros permanecem vazios. Os estágios completam uma volta em 18/15/12 segundos, com pulso de escala de 1,8% e 3/5/7 partículas orbitais. A preferência `prefers-reduced-motion: reduce` congela rotação, pulso e partículas. A progressão continua exatamente +5/+9/+12, independente do nível do jogador.

`AvatarContext.showAura` e a prop React `showAura` são **false por padrão**. O coordenador integra o opt-in somente em inventário, perfil e cartas da Arena. Lobby e sala não ativam o efeito; combate o bloqueia explicitamente mesmo se receber `showAura:true`. Não há disco mágico horizontal sob os pés, nem aura no cenário de combate. `getUpgradeAura` recorta cada célula com margens separadas. Uma máscara radial no cache mantém intacto o raio interno de 236 px e suaviza somente os 19 px externos até alfa zero, removendo cantos residuais do brilho gerado. A verificação `aura-edges-45deg.png` compara o PNG recortado e a margem final isolados sobre fundo escuro; o núcleo pintado mantém zero diferenças de pixels. `drawAura` compõe a pintura luminosa, sem redesenhá-la em linhas procedurais.

## Evidências desta revisão

- `verify-outfits.mjs`: duas roupas × dez estados × duas direções; cabeça mudou **0 pixels**, as duas pinturas estão ativas e ambas têm rig de caminhada. Tintura altera o tecido e mantém as regiões quentes medidas de pele/couro.
- `verify-walking.mjs`: 120 amostras por conjunto, erro de apoio zero, levantamento de pé de 10 unidades, pelo menos um pé apoiado em todas as fases e deslizamento de apoio inferior a 0,001 unidade. `walking-filmstrip.png` mostra oito fases nos dois sentidos; `walking-transitions.png` mostra entrada, passos e retorno ao idle sem rastro de pernas.
- `verify-combat-avatar.mjs`: dez estados × duas roupas × duas direções na postura baixa, pranchas `combat-tenposes-right/left.png` e `combat-poses-auras.png` (nome histórico, atualmente sem aura no combate); `aura-light-profile.png` compara os três estágios permitidos. Asserts confirmam aura desativada por padrão e bloqueada em combate; centros dos três aros têm zero pixels opacos na área central medida; rotação muda com o tempo e para com reduced-motion.
- `smoke-outfits.mjs`: exatamente duas roupas no inventário, preview local, salvamento, broadcast para outro navegador, recarga preservando equipamento/cabeça/cabelo/chapéu/óculos e entrada no treino com Executivo.
- `verify-faces.mjs`: cinco expressões, zero diferenças de alfa. `npm run check` aprovado. Na cloud os scripts de navegador usam `node --import /workspace/ddt3-cloud/use-system-chromium.mjs`.

## Histórico de autoria

**As seções seguintes registram etapas anteriores; nomes, contagens e limitações antigas não descrevem o catálogo atual.** Azure/Royal não estão mais ativos. As afirmações históricas sobre ausência de passos articulados foram superadas pela revisão acima.

# Starter apparel art prompts

Created with the built-in `image_gen` tool on 2026-10-16. All three PNGs were requested with `transparent_background: true`; generated alpha was preserved without image postprocessing. Original generations remain under `C:\Users\Alienware\.codex\generated_images\01a142c4-20cf-74b0-af71-620361f43e42`.

Visual references inspected before generation: `public/assets/adventurer.png` (cream shirt, tailored vest, chibi painted proportions) and `public/assets/weapon-ember-base.png` (painted item rendering, contour, lighting, transparent inventory presentation). These references informed the written prompts; no original game artwork was included in the generation call.

The files were visually inspected for garment-only content, palette, cloth detail, consistency, silhouette, framing, and absence of labels or backgrounds. PNG dimensions and alpha were checked after copying into the project.

## outfit-azure.png

Saved: `public/assets/outfit-azure.png`

Prompt:

Use case: stylized-concept. Asset type: one transparent inventory equipment icon for a polished hand-painted chibi fantasy browser game. Subject: an empty wearable adventurer torso garment, blue-teal tailored waistcoat over an ivory cream collared shirt with softly puffed long sleeves and neat cuffs, three rounded warm-gold buttons and a simple brown leather waist belt with a small brass buckle. Match classic softly painted anime/chibi item art: confident dark-brown contour, smooth rounded shapes, subtle painterly fabric folds, warm highlights from upper left, delicate material texture, readable silhouettes, charming and premium. This is simple starter equipment, coherent with a boy adventurer wearing a brown three-button vest and cream shirt, now a blue-teal alternate vest. Composition: exactly one torso-only garment, a gentle three-quarter view facing right, centered and large, entire garment visible, consistent roughly 12 percent transparent margin on each side. Neck opening and sleeve openings contain only fabric shadows. Genuinely transparent RGBA background. No person, no body, no head, no hair, no hands, no legs, no trousers, no boots, no mannequin, no hanger, no weapon, no glow, no particles, no frame, no badge, no labels, no text, no background, no checkerboard baked into image. Beautiful production game item art, non-pixel, not flat vector.

## outfit-royal.png

Saved: `public/assets/outfit-royal.png`

Prompt:

Use case: stylized-concept. Asset type: one transparent inventory equipment icon for a polished hand-painted chibi fantasy browser game. Subject: an empty wearable adventurer torso garment, muted plum-purple tailored three-button waistcoat over an ivory cream collared shirt with softly puffed long sleeves and neat cuffs, simple brown leather waist belt, plus an elegant short muted-purple shoulder cape with a small warm-gold clasp. Cape ends at waist, remains subtle and practical. Match classic softly painted anime/chibi item art: confident dark-brown contour, smooth rounded shapes, subtle painterly fabric folds, warm highlights from upper left, delicate material texture, readable silhouettes, charming and premium. Keep the basic vest-and-shirt proportions of a simple starter adventurer outfit, elegant but not ornate or armored. Composition: exactly one torso-only garment, gentle three-quarter view facing right, centered and large, entire garment visible, consistent roughly 12 percent transparent margin on each side. Neck opening and sleeve openings contain only fabric shadows. Genuinely transparent RGBA background. No person, no body, no head, no hair, no hands, no legs, no trousers, no boots, no mannequin, no hanger, no weapon, no crown, no glow, no particles, no frame, no badge, no labels, no text, no background, no checkerboard baked into image. Beautiful production game item art, non-pixel, not flat vector.

## hat-cap.png

Saved: `public/assets/hat-cap.png`

Prompt:

Use case: stylized-concept. Asset type: one transparent inventory hat equipment icon for a polished hand-painted chibi fantasy browser game. Subject: a soft blue-green teal adventurer cap, friendly rounded fabric crown with a few gently shaped stitched panels, a short brown leather curved brim pointing to the right, one small warm-gold star emblem on its front, tasteful simple starter equipment. Match classic softly painted anime/chibi item art: confident dark-brown contour, smooth rounded volumes, subtle painterly fabric folds and leather texture, warm highlights from upper left, soft warm shadow, readable silhouette, charming and premium. A cap designed for a brown-haired chibi boy wearing a cream shirt and brown waistcoat. Composition: exactly one empty cap, gentle three-quarter view facing right, centered and large, entire cap visible with consistent roughly 12 percent transparent margin on each side. Genuinely transparent RGBA background. No head, no hair, no person, no mannequin, no hanger, no extra accessories, no armor, no horns, no goggles, no glow, no particles, no frame, no badge, no labels, no text, no background, no checkerboard baked into image. Beautiful production game item art, non-pixel, not flat vector.

# Roupas completas — continuidade cloud, 16/10/2026

As entradas antigas acima documentam ícones de torso. Foram substituídas no jogo, para Azure e Royal, pelos corpos completos abaixo. `outfit-azure.png` e `outfit-royal.png` antigos não são a fonte dos ícones atuais: mochila e personagem usam a mesma pintura `*-body.png`. O traje Ranger continua sendo a arte original.

## Direção aprovada e implementação

**Regra do usuário: cores vivas e fantasiosas; evitar roupas lavadas ou predominantemente pastéis.** Azure usa safira/ciano, ouro e couro chocolate; Royal usa violeta real, rubi, ouro e botas escuras. São cortes e materiais diferentes: jaqueta curta assimétrica com botas de cadarço versus casaca longa de veludo com abas bordadas, punhos de cetim e botas de montaria. Ambas incluem braços, luvas, calça e botas; não criam slots adicionais.

As artes foram criadas/ajustadas com `image_gen`, RGBA transparente, 1254 × 1254. Os PNGs foram copiados integralmente, sem editar a pintura por scripts. O enquadramento diferente da geração Royal é registrado no compositor; nenhum ajuste de cabeça, shape, feição, pivô de pescoço, cabelo, chapéu ou óculos foi feito.

| Arquivo | Registro fonte → atlas universal | Corte para ícone |
| --- | --- | --- |
| `public/assets/outfit-azure-body.png` | `[0,0,1254,1254]` → `[0,0,1254,1254]` | `[405,558,465,682]` |
| `public/assets/outfit-royal-body.png` | `[395,410,525,830]` → `[428,562,425,672]` | `[395,410,525,830]` |

Fonte de verdade: `PAINTED_OUTFITS` em `src/game/appearance.ts`. A mesma roupa usa cinco recortes articulados, com máscaras próprias de costura, nos dez estados do rig. Pivôs preservados: ombros `[526,661]`/`[730,681]`, quadris `[576,973]`/`[708,974]` e cabeça `[650,610]`. `getOutfitPortrait()` gera um canvas 512 × 768 da pintura completa, sem a cabeça; os ícones preservam sua proporção.

`paintedOutfitReady()` habilita apenas a roupa equipada após o PNG estar carregado. O flag amplo `ENABLE_MODULAR_APPEARANCE` continua `false`: cabelo ondulado e outros equipamentos pendentes não são ativados por esta entrega. Falha/carregamento da roupa preserva o fallback existente. O manto procedural antigo não é desenhado sobre a casaca Royal final.

Tintura atua nas famílias de matiz do tecido (Azure 0,61, Royal 0,75), preservando metal, couro quente, rubi contrastante e pele. O efeito é adicional ao desenho; a identidade dos dois conjuntos existe sem tintura.

## Referências e originais

Referências inspecionadas: `character-base.png`, `adventurer.png` e o antigo `outfit-azure-body.png` do checkpoint anterior. A cabeça-base serviu apenas para estilo/proporções. Nenhuma imagem de DDTank foi usada nestas gerações de roupas.

Originais de geração nesta sessão (não são dependências de execução):

- Azure, primeira pintura: `/workspace/generated_images/exec-05f2fd92-bfc1-418e-819c-100bc764aeed.png`.
- Azure, ajuste final de paleta, copiado para o projeto: `/workspace/generated_images/exec-70fd33e1-0bc6-4520-83bf-61fd4cc235e2.png`.
- Royal, pintura final, copiada para o projeto: `/workspace/generated_images/exec-f50d3083-1ca5-4035-8a3c-6f5d57085d6c.png`.

## Prompt exato — Azure, desenho

Referências: antigo `outfit-azure-body.png`, depois `character-base.png`. `transparent_background: true`.

```text
Edit the FIRST supplied image as a production game CHARACTER BODY equipment sprite, replacing all clothes below the neck with an original complete AZURE WIND COURIER costume. Preserve the exact canvas size 1254x1254, empty upper half, body registration, 3/4 facing right, neutral relaxed arm stance, body proportions and hand/foot positions of first reference. Pixel coordinate registration is crucial: neck opening near (635,600), shoulders near (526,661) and (730,681), wrists around (470,875) and (802,880), hips at (576,973) and (708,974), boot soles y1225. DO NOT enlarge or recenter the body. NO HEAD: everything above y560 is fully transparent. Second reference is only style/proportion guidance, don't include head. Create genuinely DIFFERENT clothing: a tailored azure teal heavy-twill short COURIER JACKET with diagonal brass fastening, asymmetrical overlapping hip-length hem, padded rolled collar in warm ivory lining, fitted sleeves with leather strap cuffs; no waistcoat or shirt visible apart from a tiny ivory neckline. Broad cinnamon leather belt, understated brass oval buckle. Navy tailored full-length trousers with a side seam, thick tan leather gauntlet gloves covering both hands, and compact deep brown lace-up knee boots with wide folded azure cuffs and small brass clasps. The left boot is planted forward-left and right boot pointing right, EXACTLY as reference. Original chibi hand-painted fantasy RPG art, rich fabric folds, confident warm brown outline, painterly material variation, rounded volumetric shape, warm upper-left lighting; sophisticated illustration, no pixel art, no vector art. All body parts must form a coherent wearable outfit, gloves included. Keep arms a small distance from torso as reference, preserve fingertips and soles inside reference occupied region. No cape, scarf, backpack, accessories, weapon, ornaments flying outside the body, text, labels, ground, cast shadow, frame or background. True RGBA transparent.
```

## Prompt exato — Azure, paleta viva final

Referência: primeira pintura Azure acima. `transparent_background: true`.

```text
Make this production chibi game body sprite's costume MUCH MORE VIBRANT, saturated and fantastical. Preserve EXACT image dimensions 1254x1254, pixel registration, occupied bounding box, pose, anatomy, proportions, silhouette, rendering quality, transparent background, and all details: edit ONLY costume palette/material finish. The jacket and folded boot cuffs must be radiant rich SAPPHIRE BLUE with luminous CYAN EDGE HIGHLIGHTS and deep cobalt shadows. Distinct visible hues, saturated gemstone fantasy colors, no muted slate/denim/teal grey, no faded or pastel result. The jacket trim and buttons are rich polished warm GOLD, not muted brass. Leather gloves, belt and boots deep dark chocolate with glowing warm amber highlights; full-length trousers nearly black navy to contrast rich sapphire jacket. Keep tiny ivory collar lining. This is the AZURE WIND COURIER complete outfit: same distinctive diagonal jacket fastening, asymmetrical hem, leather gloves, trousers, wide boot cuffs, laces and buckles. High quality hand-painted fabric texture and dimensional folds, warm brown contour, warm upper-left lighting. NO head/hair/face. Keep every pixel above y560 transparent. No added items, no background, no ground shadow, no writing, no borders. This is a color/material edit, absolutely no rescaling or repositioning.
```

## Prompt exato — Royal

Referências: antigo `outfit-azure-body.png`, depois `character-base.png`. `transparent_background: true`.

```text
Edit the FIRST image into a complete ROYAL STAR MARSHAL body costume for this original chibi painted fantasy game. This is a registered game sprite: KEEP canvas 1254x1254, same size and exact body pose positions, empty upper half. NO head or hair. Neck opening around (635,590), left shoulder (526,661), right shoulder (730,681), left wrist (470,875), right wrist (802,880), hips (576,973) and (708,974), boot soles y1225. Do not enlarge/recenter. Second reference is style/proportions only; NEVER paint head. Change outfit silhouette and materials thoroughly from reference: sumptuous VIVID SATURATED royal-violet long cavalry coat, high scarlet-lined folded collar, saturated ruby-red diagonal chest sash incorporated into coat, warm polished golden piping and generous gold embroidered star motif on breast, double ornamental gold buttons, strong waist pinch then flaring split coat skirts to mid thigh (around y1010). The shoulder construction is structured with a small gold-edged violet puff and ruby decorative shoulder flap, NOT armor. Royal coat sleeves narrow toward rich ruby gauntlet cuffs; both entire hands wearing tailored dark plum gloves. Elegant close-fitting midnight-purple full length trousers with narrow gold side stripes; tall fitted polished near-black oxblood riding boots with angular ruby turnover cuffs and gold buckles, distinct from chunky laced explorer boots. Tailored regal stance still same arm/foot anchors. Rich VIBRANT fantasy jewel colors, no muted desaturated or pastel costume. Clear contrast between velvet violet, ruby satin, warm gold and dark leather. Rounded chibi proportions, fine hand-painted folds and volume, warm dark-brown outlines, upper-left warm light, refined production game art. Full costume neck down including BOTH arms, BOTH gloved hands, BOTH trousers and BOTH boots; coherent contiguous body in relaxed neutral stance. Transparent background above and around sprite. No head, no mannequin, no weapon, no bag, no cape, no crown, no wings, no detached pieces, no text, no ground, no shadow, no frame. True RGBA transparency. Preserve small clear gaps between arms and waist like reference.
```

## Verificação e limites

- `node scripts/verify-outfits.mjs` com Vite: 40 montagens, dois conjuntos × dez poses × duas direções. As pranchas `test-results/outfits-right.png` e `outfits-left.png` foram inspecionadas visualmente. Incluem boné/óculos e mira em terreno inclinado.
- Os pixels da cabeça recortada têm **zero diferenças** ao trocar a roupa. A regressão `verify-faces.mjs` confirma cinco expressões e zero diferenças de alfa entre cabeças universais.
- Tintura Coral altera 27.268 pixels Azure e 21.542 Royal. Na medição das regiões quentes de metal/couro, 99,56% e 98,71% ficam idênticos; pequena diferença em bordas filtradas deriva do tecido adjacente recolorido. Não se afirma preservação pixel a pixel das bordas de materiais.
- `node scripts/smoke-outfits.mjs` com backend: duas roupas experimentadas localmente, salvamento, recarga, recebimento por um segundo navegador e Royal em treino. Cabeça, cabelo, chapéu e óculos continuam equipados. Capturas de mochila e combate foram inspecionadas. O convidado QA recebe prefixo `TEST-OUTFIT-`.
- Na cloud atual, os scripts foram executados com `node --import /workspace/ddt3-cloud/use-system-chromium.mjs ...`, usando Chromium do sistema. Esse adaptador é configuração do ambiente; em outros ambientes vale a configuração Playwright normal documentada em `cloud-handoff.md`.

O rig continua sendo recorte articulado 2D, sem deformação contínua de tecido ou sprites redesenhados por pose. A empunhadura das armas continua aproximada e não foi redesenhada nesta tarefa. Esta entrega conclui os dois conjuntos; não conclui cabelos/chapéus/óculos pendentes nem todos os itens do jogo.

# Correção de direção — cada roupa tem uma pose própria

A instrução posterior do usuário prevalece: **“cada roupa é uma pose, cada roupa tem sua pose única; por exemplo, roupa de surfista, roupa de executivo”**. Azure e Royal permanecem como roupas anteriores, mas não satisfazem sozinhos essa direção: não basta variar o corte do casaco sobre a mesma posição neutra. A entrega principal passa a ser os dois conjuntos abaixo, com corpos inteiros e gestos pintados próprios. Toda roupa futura deve estabelecer identidade temática, silhueta e pose base antes da animação.

| ID / nome no jogo | Pose e roupa | Registro fonte → atlas | Matiz de tintura |
| --- | --- | --- | --- |
| `outfit-surfer` / Surfista da Maré | Base larga, joelhos relaxados, mão em shaka levantada e outra no quadril. Camisa tropical turquesa/coral aberta, bermuda, pele de mãos/pernas/pés e sandálias. | `[340,350,710,890]` → `[362,484,593,743]` | 0,51 |
| `outfit-executive` / Executivo | Corpo ereto, uma mão ajusta a gravata, outra fica no bolso, tornozelos cruzados. Terno marinho, gravata azul, lenço rubi, calça e sapato social. | `[415,405,460,830]` → `[470,555,373,673]` | 0,64 |

Os arquivos são `public/assets/outfit-surfer-body.png` e `outfit-executive-body.png`, ambos PNG RGBA 1254 × 1254. Os cortes de ícone usam os mesmos retângulos fonte da tabela. Não há prancha, maleta, óculos, chapéu ou cabeça incorporados. A pintura inclui o corpo inteiro do pescoço para baixo, incluindo a pele aparente; não se trata de roupa vazia sobre o corpo neutro.

`ItemVisual.pose` aceita `surfer` e `executive`. O rig usa `stanceBody`, preservando a pintura inteira e os gestos sobrepostos em vez de cortá-los pelas máscaras do aventureiro. `avatar.ts` fornece ritmo, balanço, apoio, recuo, reação, queda e vitória próprios por conjunto, e mantém a cabeça como camada independente. O surfista é mais solto e tem um salto de comemoração; o executivo mantém movimentos mais contidos. A postura deitada usa um enquadramento específico para a base larga do surfista. **São poses base próprias animadas por transformações limitadas: não há dez pinturas novas por roupa, passo articulado de pernas cruzadas ou reconstrução de mãos para segurar cada arma.** A empunhadura continua aproximada.

O recorte histórico da cabeça neutra inclui alguns pixels da camisa antiga perto do pescoço. No surfista, uma camada pequena de tecido extraída da própria pintura cobre somente esses pixels de camisa; os pixels da cabeça universal continuam idênticos. Crânio, pele, shape, feições, pivô, cabelo e chapéus não são modificados.

Comparativa principal: `test-results/outfits-new-poses.png`. As pranchas `outfits-new-right.png` e `outfits-new-left.png` mostram os dois novos conjuntos nos dez estados do renderer. O harness completo agora cobre quatro roupas, dez estados e dois sentidos (80 montagens), incluindo a regressão de Azure/Royal. As expressões continuam passando pelo compositor universal existente.

Originais preservados sem edição de pixels por scripts:

- Surfista: `/workspace/generated_images/exec-3c39a1cf-1ec4-475e-9224-ef140ea51b54.png`.
- Executivo: `/workspace/generated_images/exec-2491257e-9a63-437c-b10d-c4c1ab1f0d7d.png`.

Os dois arquivos foram criados com `image_gen`, usando `character-base.png` apenas como referência de acabamento, escala e pele. A alteração de registro é explícita no compositor; nenhum arquivo da cabeça foi editado.

## Prompt exato — Surfista

`transparent_background: true`, referência `public/assets/character-base.png`.

```text
Create ONE new complete NECK-DOWN outfit body sprite for the supplied original chibi game character: SURFISTA DA MARÉ, a charismatic tropical surfer with a UNIQUE RELAXED SURFER BODY POSE. This is NOT a clothing recolor of the reference: completely redraw the arm pose, hips, legs, silhouette and costume. Only preserve art style, skin tone, chibi body scale and NECK SOCKET centered near (650,600). Canvas 1254x1254; leave entire upper half above y550 fully transparent for the separately rendered universal head. No head, face, hair, hat or glasses. Body occupies roughly x320..915, y565..1225. Three-quarter torso facing right. The near arm on IMAGE LEFT is bent UP and OUT, elbow around (415,790), hand around (375,650), clearly making a joyful SHAKA gesture (thumb and little finger extended, three middle fingers curled), hand separated from chest so its silhouette reads at small sizes. Far arm on IMAGE RIGHT bends comfortably with hand resting on hip around (780,840). Asymmetric casual hips; knees flexed gently in a broad relaxed surfing stance, two bare lower legs apart, left knee outward around (475,1025), right knee around (765,1030), left foot near (450,1200) and right foot near (845,1200), both fully visible. Rich vivid TURQUOISE short-sleeved open-collar Hawaiian surf shirt with a few bold original coral-red hibiscus flowers and small deep-blue leaves, airy cloth folds and knot-free hem. Vivid CORAL ORANGE knee-length board shorts with dark cobalt diagonal side panels, drawstring waist and a tiny wave motif. Bare warm peach forearms, bare shaka hand, bare knees/calves/toes; dark navy sport flip-flop sandals with vibrant cyan straps. Costume includes all hands, pants, feet and footwear; this is not an empty garment. Rounded chibi body and detailed hand-painted fantasy game art matching reference's warm brown outline, soft painted volume, upper-left highlights and polished materials. Saturated playful fantasy colors, no faded or pastel palette. Hands anatomically coherent, one clear shaka gesture. No surfboard, no floating accessory, no bags, no weapon, no neck jewelry, no mannequin, no text, no shadows on ground, no scenery, no frame. Transparent RGBA background. The lowered headless neck opening is natural, no cut-off head remnants. Entire sprite inside canvas with transparent margins.
```

## Prompt exato — Executivo

`transparent_background: true`, referência `public/assets/character-base.png`.

```text
Create ONE new complete NECK-DOWN body sprite for this original hand-painted chibi game: EXECUTIVO DA AURORA, an elegant self-assured executive in a UNIQUE FORMAL BODY POSE. NOT a recolored adventurer, NOT both arms down, NOT the reference stance. Redraw the entire body anatomy/gesture/silhouette while keeping the same compact chibi scale, 3/4 view facing right, skin tone, painting quality. Universal head is rendered separately: absolutely NO head, face, hair, hat, glasses. 1254x1254 transparent canvas, leave above y550 empty, neck socket centered around (650,600), feet near y1220. Body roughly x430..850. Pose reads immediately: torso upright with elegant narrow waist, shoulders squared; NEAR ARM on image LEFT bent across chest, hand delicately adjusting the BLUE TIE KNOT or lapel around (662,727), elbow projecting to left around (465,825). FAR ARM on image RIGHT bent with hand tucked inside trouser pocket at (755,865), elbow slightly outside torso; no second exposed hand hanging down. Legs close together in elegant asymmetrical contrapposto, right leg supporting weight straight and left leg loosely crossed at ankle in front, feet noticeably closer together than the adventurer, two polished oxford shoes both fully visible, one pointing right and one forward-right. Tailored dark navy blue suit with saturated cobalt-blue edge lighting, smooth fine wool and satin contrast, sharp broad jacket lapels, two-button jacket (only top button fastened) revealing clean white shirt and a vivid electric BLUE necktie, small RUBY RED pocket square on breast. Crisp full-length navy trousers with a pressed crease, polished black-brown low Oxford shoes with tiny laces and warm reflections. Both hands warm peach bare skin wherever visible. Sophisticated business identity, NO gold fantasy armor, NO cape, NO jewelry, NO briefcase, NO weapon or accessories, NO logos/text. Small chibi body under very large separate head, not adult long legs. Refined painted volume, dark warm brown outline, highlights from upper left, lively saturated fantasy game finish with readable dark/light contrasts; no gray washed-out pastel palette. Only complete body from neck down, true RGBA transparency, no ground, background, frame, mannequin, or detached pieces. Keep the UNIQUE hand-at-tie / hand-in-pocket / crossed-ankles pose visible and coherent.
```

Validação final desta correção: `npm run check`, `verify-outfits.mjs` (80 montagens, quatro roupas ativas, zero pixels de cabeça alterados) e `verify-faces.mjs` (cinco expressões, zero diferenças de alfa) aprovados. `smoke-outfits.mjs` passou com as quatro roupas: prévia local, salvar, recarregar, preservar os slots da cabeça, receber a roupa por um segundo navegador e entrar no treino com Executivo. Mochilas dos dois novos conjuntos e a captura de combate foram inspecionadas. Na tintura Coral, Surfista alterou 13.159 pixels e Executivo 25.328; nenhuma alteração foi medida nas regiões quentes de pele/couro de ambos. A medição é a mesma heurística de regiões de cor descrita acima, não uma segmentação semântica completa de materiais.

# Prompts da revisão final — caminhada, corpo de combate e aura de luz

Todos os assets abaixo foram criados por `image_gen` com `transparent_background: true`. Os recortes/tinturas no renderer não alteram os PNGs originais nem a cabeça universal.

## Executivo — fonte de caminhada

Referência: `public/assets/outfit-executive-body.png`.

```text
Edit ONLY the legs of this exact registered chibi executive body sprite to produce the neutral WALK-RIG source for animation. Keep canvas 1254x1254, transparency, same pixel placement and scale. Preserve every part ABOVE THE HIPS around y790 unchanged: neck opening, torso, navy suit jacket, lapel/tie hand, pocket hand, royal blue tie, ruby square, sleeves and coat hem all stay exactly where they are. The executive MUST UN-CROSS his legs: redraw below the hips as TWO SEPARATE, NEARLY STRAIGHT LEGS standing parallel with clear transparent gap between them, both trousers hanging vertically. Left leg on image left centered x605 from hip at (605,800) through knee at (605,1000) to ankle at (605,1160). Right leg on image right centered x770 from hip at (770,800) through knee at (770,1000) to ankle at (770,1160). Both knees gently relaxed but not bent across each other; calves vertical and distinct, no overlapping limbs. Keep two polished brown-black low Oxford shoes, each pointing to the RIGHT in a readable three-quarter side view, soles both on the same y1225 baseline. Each shoe compact, about135px wide. Preserve the SAME fine navy wool trousers, sharp crease, cobalt edge highlights, warm brown painted outline, footwear style, shoe size, and chibi proportions from reference. This is source art that will be cut into thigh, shin and shoe layers, so each knee/calf must be unobscured by the other leg and joints have natural round volume. No new head, no text, no ground or shadows, no extra objects, no pose labels, no front-facing spread pose, no long adult legs. Do not recenter, enlarge, crop or move torso. Upper body identical; only uncross the legs for animation. True RGBA transparent.
```

## Surfista — fonte de caminhada

Referência: `public/assets/outfit-surfer-body.png`. A ferramenta alterou a posição do torso apesar do pedido; por isso somente o recorte inferior validado é usado e o torso continua vindo da pintura idle.

```text
Edit ONLY the lower-body stance of this exact chibi tropical surfer sprite to make a neutral WALK-RIG source for articulated animation. Same 1254x1254 transparent canvas and exact original registration. Preserve everything above the orange shorts waist at y755 pixel-for-pixel if possible: shaka hand, raised left arm, turquoise hibiscus open shirt, bare chest, right hand on hip, neck opening and shoulders all retain their exact location, proportions and style. Do not add a head or move torso. Unbend and bring the legs into TWO SEPARATE NEARLY VERTICAL LEGS, hip-width apart, knees relaxed and forward, not spread sideways as if surfing. Orange coral board shorts retain their navy side panels, cyan wave motif and white drawstring, but hang naturally above the knees around y990. Left thigh/leg on image LEFT is centered x620, knee center (620,1010), ankle center (620,1155). Right leg on image RIGHT centered x840, knee center (840,1010), ankle center (840,1155). Bare warm peach knees/calves/feet, both unobscured with transparent gap between legs. Both navy flip-flop sandals with bright cyan straps point gently RIGHT in readable three-quarter side view and rest on the SAME y1225 baseline. Keep compact chibi legs and feet the SAME size as reference, not adult anatomy. Natural rounded knee forms, both calves nearly straight, suitable for cutting into thigh, shin and foot sprites with no limb overlaps. Preserve hand-painted shading, warm brown outlines, skin color and vivid costume colors. The body remains full from neck to toes, no extra pieces, no surfboard, no hat/hair, no weapon, no labels, no ground, no shadow, no background. Do not enlarge, recenter or change upper body. Transparent RGBA.
```

## Dois corpos de combate

Referências: `outfit-surfer-body.png` e `outfit-executive-body.png`. O registro final compacta os corpos conforme a última orientação chibi do usuário; não se ativa o tamanho longo originalmente sugerido pelo prompt.

```text
Create a production 2D chibi RPG COMBAT BODY SPRITE ATLAS with EXACTLY TWO separate NECK-DOWN characters on a wide transparent RGBA canvas, one on LEFT and one on RIGHT. Use the supplied references only for the exact two costume designs, skin tone and polished hand-painted style. Completely REDRAW their posture into a LOW PRONE COMBAT POSITION, LYING BELLY-DOWN with CHEST slightly raised on BENT FOREARMS/ELBOWS, legs stretched behind. Both face RIGHT in three-quarter side view. Do not rotate a standing sprite. The large universal HEAD is rendered separately: NO HEAD, NO FACE, NO HAIR, NO HAT, NO GLASSES, not even silhouette/head placeholder. Show a small natural open neck socket upright above the raised shoulders at the FRONT RIGHT side of each body, no tall neck stump. This body has to attach to an upright head, despite lying down. Both low bodies occupy lower middle of their own half, with huge empty transparent upper half for head. Body height about 260px, width about 660px per 900px-wide half. Feet at LEFT, neck socket towards RIGHT. Hips low, belly close to floor, knees relaxed slightly bent and separated for articulated movement. Two feet fully visible, side-by-side or one knee slightly raised, naturally lying behind, no upright standing leg. Near forearm and hand support the upper chest just below neck, far arm also bent/supporting near front; no shaka/tie-adjust gesture in COMBAT, no fist floating in space. Neck/shoulder is the highest body point; elbows/hands and footwear lowest level. LEFT body: reference SURFER costume, vivid turquoise Hawaiian shirt with coral hibiscus motifs, open collar, orange/coral board shorts with navy side panels, natural warm peach arms/hands/bare calves/feet, navy flip-flops with cyan straps. RIGHT body: reference EXECUTIVE costume, beautifully tailored navy suit with cobalt highlights, white shirt and electric blue tie draping naturally in prone position, ruby pocket square, navy creased trousers and dark brown polished Oxford shoes, warm peach bare hands. Keep clothing very distinct and saturated, matching references' refined painted folds, chibi short limbs, warm brown clean outlines and volume. Both poses believable belly-down rests, as a turn-based artillery character would rest low with weapon rendered BEHIND their body. Do NOT draw ANY weapon, props, floor, shadow, scenery, text, labels, columns, dividers or background. Keep at least 100 transparent pixels between bodies and clear transparent margins. Full bodies must be complete with no cropped shoes or fingers. No head or disembodied facial parts anywhere. True transparent holes between limbs, transparent background. Original painted game art.
```

## Primeira aura de luz — referência para o engrossamento final

Geração nova, sem referência. O resultado fino foi usado como referência da etapa seguinte; não é o atlas ativo. O usuário pediu depois uma banda energética mais grossa e efeitos visíveis.

```text
Wide transparent game VFX sprite atlas: three SMALL DELICATE MAGIC LIGHT HALOS floating separately in one row, lots of empty transparent space. Think thin exposure trails of light painting, not portals or cloud doughnuts. Each halo is a loose open near-circle traced by only TWO or THREE fine curved luminous strokes, bright filament core with narrow transparent glow and a few tiny star sparkles, elegant graceful arcs tapering to hair-fine ends. 90 percent of the total circle area is EMPTY and transparent; stroke thickness ONLY about 3 percent of diameter. ZERO fog, ZERO clouds, ZERO filled colored bands, ZERO smoke, ZERO solid circular frames. No metal or jewels. Left halo: vivid cyan/sapphire curving light trails with four tiny electric sparks. Middle: vivid royal-violet with two white-violet sweeping curves and six small floating runic strokes. Right: warm golden light with two sweeping arcs, several tiny amber star sparks and white-hot highlights. The luminous line art is hand-painted delicate and magical, radiant but transparent, polished fantasy game spell quality. THREE effects centered at x25%,50%,75% across a very wide canvas and y50%; each halo diameter 22% of canvas width, with complete tips safely within transparent margins, no overlap. Absolutely transparent center and surroundings. No thick foggy ring, no opaque doughnut, no background, no characters, no objects, no words, no numbers, no checkered pattern. Only airy narrow light trails and tiny sparkles, true RGBA.
```

## Prompt final — anel de energia mais grosso

Edição por `image_gen`, `transparent_background: true`, referência `exec-1fda2a6a-ac07-4ad7-a2d2-bff1ca325863.png`. Saída ativa: `exec-162f7431-6f91-4846-9b7a-00511f834b2a.png`, copiada para `public/assets/auras/upgrade-rings.png`. As espessuras do prompt orientam a pintura, não são limites garantidos de alfa; a banda final inclui o brilho difuso e foi inspecionada montada. O renderer acrescenta apenas partículas orbitais e pulso; a arte do anel é o PNG pintado.

```text
Refine these three exact PURE LIGHT magic auras. The existing bright lines are too thin. Replace their hairline core strokes with substantial, CLEARLY VISIBLE THICK ANNULAR ENERGY BANDS while keeping the same saturated cyan, violet and gold light colors and completely transparent center. Each aura must read as a continuous luminous RING, not only isolated thin arcs. No physical metal or jewels. LEFT cyan ring: bright core band 10px thick at 512px ring diameter; MIDDLE violet ring: 14px bright band at512; RIGHT golden ring:18px bright band at512. Each band has TWO distinct crisp bright edges, a rich luminous color gradient between edges, and restrained semi-transparent glow extending just outside the band. Think a circular ring of flowing plasma or light, clearly thicker and more present than reference, still magical transparent LIGHT not opaque jewelry. Keep several subtle small runic marks following the band and 5 or 6 small soft sparks around each. All rings circular, open center must be completely transparent and occupy most diameter (about 85%), absolutely no clouds/fog filling the hole. Transparent outside. Both bright edges of bands should remain visible at small inventory-avatar sizes, with rich cyan/electric-violet/golden energy substance between them. Smooth polished hand-painted fantasy game VFX finish, not vector diagram. Keep exactly three separate complete effects in a horizontal row, safely within wide canvas and ample transparent gutters, no overlap or clipped tips. Do not add characters, text, symbols that look like letters/numbers, ground, scenery, opaque background, metallic frame, crown, gems or ornaments. Pure glowing annular energy bands, true RGBA transparency.
```
