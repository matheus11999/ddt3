# Pintura e animação dos efeitos de armas — 16/10/2026

> **Obsoleto desde 17/10/2026.** A arte destes prompts foi apagada; as armas novas seguem `docs/weapon-kit.md` e os prompts gerados por `npm run verify:weapons`.


Esta etapa substitui os núcleos geométricos provisórios por pinturas originais de projéteis, lançamentos e impactos. Segue o pedido atual de cores vivas e fantasiosas; as pinturas básicas já têm a identidade de cada material. A evolução muda desenho, silhueta e estrutura da trilha, além da intensidade.

## Contrato de arte e execução

| Família | Atlas em public/assets/vfx/ | Núcleo e evolução | Trilha e impacto |
| --- | --- | --- | --- |
| Dragão de Brasa | ember-effects.png | Brasa de carvão → meteoro com chifres → cabeça de dragão → dragão solar | Fogo/fuligem → línguas pintadas → fitas duplas; explosão rochosa, flor de magma, vórtice e coroa de fogo |
| Tempestade | volt-effects.png | Cápsula condutora → ponta com aletas → núcleo entre anéis → coroa elétrica | Descarga fina → bifurcação → bobinas/linhas de indução; estalo, roseta e jaula de raios |
| Flor de Cristal | crystal-effects.png | Lâmina única → prisma bifurcado → lança de três lâminas → lança de lótus | Estilhaços pintados → trilhas refratadas → fragmentos orbitais; estrela partida, espinhos e flor de cristal |

Os três PNGs finais são RGBA de **1448 × 1086**, razão 4:3, com 4 colunas e 3 linhas. Cada célula lógica mede 362 × 362. Colunas: estágios **0–8 / 9 / 10–11 / 12**, usando a função compartilhada `weaponVisualStage()`. Linhas: **projétil apontando para a direita / lançamento para a direita / impacto**.

As imagens foram geradas e corrigidas por `image_gen`; os PNGs originais foram copiados sem retoque programático. A primeira composição invadia células e cortava alguns impactos. A revisão por prancha identificou isso; uma segunda edição reorganizou os mesmos desenhos com margens transparentes amplas. As saídas finais foram novamente inspecionadas no renderer.

`src/game/weaponEffects.ts` carrega as três pinturas ao importar o módulo, recorta células no Canvas apenas em runtime e cria snapshots `ImageBitmap` quando disponíveis. Pixels residuais com alfa até 12 são descartados nesse cache; o arquivo original não é alterado. Limites de conteúdo são detectados acima de alfa20 e acrescidos de uma pequena margem. Nenhum recorte invade a célula vizinha.

`drawProjectile()`, `drawImpact()` e os sete parâmetros anteriores de `drawMuzzle()` permanecem compatíveis. O lançamento aceita um oitavo parâmetro opcional `directionRadians`, para acompanhar a tangente inicial da trajetória; sem ele mantém a direção horizontal indicada por `facing`. `preloadWeaponEffects()` permite aguardar a decodificação em verificações visuais.

O projétil gira com a tangente da trajetória autoritativa. O contato visual nasce em `impact.x/y`; a pintura do projétil usa `points[index]`, que representa seu centro. As auras, caudas, faíscas e fragmentos são cosméticos. Não calculam colisão, dano, cratera ou acerto. O renderer não altera os raios físicos, definidos pelo catálogo/servidor, nem deduz o contato a partir do tamanho da pintura. O raio recebido em `impact.radius` é o raio da cratera autoritativa e serve de referência de escala para o impacto.

A base tem trilha curta. Os estágios superiores recebem estruturas diferentes: duas fitas flamejantes para Brasa, anéis de indução para Tempestade e trilhas refratadas com lascas pintadas para Cristal. O estágio12 de Cristal tem fragmentos em órbita; a Tempestade tem um aro de campo adicional. Com preferência de movimento reduzido, as trilhas encurtam e os ornamentos orbitais são suprimidos.

A resposta do terreno acrescenta materiais às pinturas: terra/pedra lançam fragmentos facetados, areia grãos menores, metal linhas de faíscas e lascas refletivas, gelo fragmentos ciano e magia prismas violeta. São detritos de animação, não blocos físicos. Os impactos duram620–680ms, dentro da janela já desenhada pela cena.

Existe um pequeno núcleo luminoso de contingência enquanto a primeira imagem decodifica ou se seu carregamento falhar. A apresentação final validada usa os atlas; a contingência não é anunciada como pintura concluída.

## Verificação visual e limites

- Prancha com **3 famílias × 4 estágios**, cada painel contendo projétil, lançamento e impacto: `test-results/vfx/stages.png`.
- Prancha de seis materiais do terreno: `test-results/vfx/materials.png`.
- Impactos lendários em30/130/340/570ms: `test-results/vfx/timeline.png`.
- As pranchas finais foram abertas e inspecionadas após a correção de margens. Não há cortes retangulares ou pedaços do sprite vizinho na composição final. Formas evoluídas são diferentes em todas as famílias.
- Harness no Chromium: nenhuma exceção de JavaScript. Ensaio de36 operações de efeitos por quadro, com aquecimento e80 amostras: mediana de desenho1,1ms, p953,1ms; intervalo entre quadros mediano16,7ms e p9524,3ms neste ambiente compartilhado. Esse ensaio isola os efeitos; não mede o jogo completo nem garante a mesma taxa em dispositivos móveis.
- TypeScript: `npm run check` aprovado após a alteração.
- As pranchas são verificação do renderer e não comprovam uma partida completa com todas as armas/níveis. A integração real de combate, origem de lançamento e física é validada junto com a cena/servidor.
- Integração real adicional em treino, cliente Vite e servidor WebSocket: Ember base, ângulo 45°, força 35; origem do clarão alinhada à arma atrás do corpo compacto, projétil tangente à trajetória e impacto sobre a cratera autoritativa em x746/y567. Capturas nativas do canvas: `test-results/vfx/battle-canvas-muzzle.png` e `battle-canvas-impact.png`; interface completa em `battle-real-idle.png`, `battle-charging.png` e `battle-low-crater.png`. Nenhuma exceção de JavaScript ou erro de protocolo. A inspeção cobre essa combinação real; os demais estágios/famílias são cobertos pelas pranchas do renderer.
- Sala 4×4 criada pelo fluxo normal da Arena, com um humano e sete bots: `test-results/vfx/battle-8players.png`, `battle-8players-idle.png` e `battle-8players-crater.png`. Quatro barras de vida por equipe permanecem legíveis e o centro fica livre; força 35 enviada e congelada na barra, tiro e cratera aplicados sem erro de JavaScript ou protocolo. A coluna de poderes no desktop foi ajustada para 72px de largura, a 8px da borda, com botões de 58×58px. Nova captura inspecionada confirma o avatar do extremo direito livre; regras mobile preservadas.

## Prompts executados

### ember: geração original

- Ferramenta: `image_gen`, `transparent_background=true`, sem referência de entrada.
- Original da sessão: `/workspace/generated_images/exec-84d2412b-673b-4e78-8b72-c238551dd610.png`.

```text
Create ONE original premium hand-painted 2D game VISUAL EFFECT SPRITE ATLAS, actual transparent RGBA background. Layout EXACTLY FOUR COLUMNS by THREE ROWS on a wide 4:3 canvas (nominal 2048x1536); each cell square. No visible gridlines, no border, no background color, no text, no numbers, no labels, no UI. All twelve sprites separate, carefully centered within their own cell with at least 12 percent transparent padding around every cell; absolutely no crossing into adjacent cells. Transparent negative space is essential, not fake checkerboard pixels. Four columns LEFT TO RIGHT are increasingly evolved designs: base, awakened, ascended, legendary; retain a unique silhouette at every stage, not merely add particles. Top row: four directional flying projectiles pointing RIGHT, solid core around cell center and trailing energy LEFT. Middle row: four directional launch/muzzle flashes, point from left origin toward RIGHT, no weapon body. Bottom row: four radial impact explosions with material debris, no ground/platform. Strong saturated luminous fantasy pigments, rich painted soft brush highlights, clearly sculpted volumes and crisp edges around solid cores, dramatic bright centers and colored edges. Production quality 2D painted cartoon VFX with readable chunky forms at small game size, not thin vector clipart, not generic circles, no photorealism. The core is visible at small sizes; glow and energy stay much lighter than solid dark details. Keep each sprite isolated. Exact4×3 evenly spaced atlas.
FAMILY EMBER / DRAGON FIRE: deep crimson, molten tangerine orange, gold and ivory-hot cores, dark burnt brown cracks. Top row c1: compact rough glowing charcoal ember with a short orange fire tongue, recognizable natural burning stone. c2: horned dragon-seed meteor, two curved charcoal horns and glowing magma cracks with bold orange flame jet. c3: an elongated red-gold dragon head-shaped comet, pointed swept horns and broad curling fire mane; not a character, pure elemental projectile. c4: royal solar dragon meteor, sharply recognizable gold-black draconic face embedded in blazing magma, swept flame antlers and a brilliant double golden plume, silhouette wider and more regal than c3. Middle row c1: short burst of three uneven flame tongues and soot puff; c2: twisting forked furnace eruption; c3: sweeping dragon-breath spiral with glowing ember teeth; c4: majestic double curling dragonflame shockburst with a solar ring around origin. Bottom row c1: compact irregular ember detonation with four scorched glowing fragments; c2: broad molten flame flower around cracked black rock chips; c3: deep red-orange fire vortex, prominent curving flame petals and ember shards; c4: spectacular sculpted dragonfire impact, rich gold/red flame crown and two curved draconic flame-wings spreading from brilliant core. Not just same explosion enlarged; stage silhouettes unmistakably different. Warm family only, no cyan, no pastel smoke.
```

### volt: geração original

- Ferramenta: `image_gen`, `transparent_background=true`, sem referência de entrada.
- Original da sessão: `/workspace/generated_images/exec-609f2d9a-82e7-4ef5-b4fd-0a14aeb9fdbe.png`.

```text
Create ONE original premium hand-painted 2D game VISUAL EFFECT SPRITE ATLAS, actual transparent RGBA background. Layout EXACTLY FOUR COLUMNS by THREE ROWS on a wide 4:3 canvas (nominal 2048x1536); each cell square. No visible gridlines, no border, no background color, no text, no numbers, no labels, no UI. All twelve sprites separate, carefully centered within their own cell with at least 12 percent transparent padding around every cell; absolutely no crossing into adjacent cells. Transparent negative space is essential, not fake checkerboard pixels. Four columns LEFT TO RIGHT are increasingly evolved designs: base, awakened, ascended, legendary; retain a unique silhouette at every stage, not merely add particles. Top row: four directional flying projectiles pointing RIGHT, solid core around cell center and trailing energy LEFT. Middle row: four directional launch/muzzle flashes, point from left origin toward RIGHT, no weapon body. Bottom row: four radial impact explosions with material debris, no ground/platform. Strong saturated luminous fantasy pigments, rich painted soft brush highlights, clearly sculpted volumes and crisp edges around solid cores, dramatic bright centers and colored edges. Production quality 2D painted cartoon VFX with readable chunky forms at small game size, not thin vector clipart, not generic circles, no photorealism. The core is visible at small sizes; glow and energy stay much lighter than solid dark details. Keep each sprite isolated. Exact4×3 evenly spaced atlas.
FAMILY VOLT / ELECTRIC STORM: cobalt blue, intense cyan, electric violet accents, white-hot electricity, metallic blueblack and copper/gold grounding rings. Top row c1: small solid copper/steel capacitor capsule with cyan conductive center and one short lightning tail, clearly a precise light dart. c2: bright sapphire charged core with two small opposing curved conductor fins and a sharp lightning tail. c3: compact twin rotating copper induction rings holding a vivid cyan plasma diamond with jagged forked blue lightning trail. c4: magnificent but compact golden-cobalt thunder crown core, four swept conductor horns around a whitecyan star nucleus, double zigzag lightning stream behind; no fire. Middle row c1: small sharp forked cyan discharge; c2: jagged three-prong lightning cone; c3: brilliant circular induction ring cracking into six bold electric branches; c4: double layered blue-copper arc gate releasing a sculpted branching thunder bolt cone. Bottom row c1: concentrated cyan electric crack with 4 bold jagged branches; c2: a spoked lightning rosette bursting from a tiny white center; c3: an electromagnetic double ring shockwave with intersecting geometric angular electrical forks and small burnt metal chips; c4: a spectacular star-shaped thunder cage, asymmetric bold jagged cyan/violet bolts exploding around two luminous induction rings with charged conductor fragments. Tightly focused electric family compared with broad fire, no flame textures, no soft pastel clouds. Shapes must read as real energy and painted metal, not a thin symbol or vector icon.
```

### crystal: geração original

- Ferramenta: `image_gen`, `transparent_background=true`, sem referência de entrada.
- Original da sessão: `/workspace/generated_images/exec-b93ad548-1eaf-4c35-8b6a-5c1ef90d2f54.png`.

```text
Create ONE original premium hand-painted 2D game VISUAL EFFECT SPRITE ATLAS, actual transparent RGBA background. Layout EXACTLY FOUR COLUMNS by THREE ROWS on a wide 4:3 canvas (nominal 2048x1536); each cell square. No visible gridlines, no border, no background color, no text, no numbers, no labels, no UI. All twelve sprites separate, carefully centered within their own cell with at least 12 percent transparent padding around every cell; absolutely no crossing into adjacent cells. Transparent negative space is essential, not fake checkerboard pixels. Four columns LEFT TO RIGHT are increasingly evolved designs: base, awakened, ascended, legendary; retain a unique silhouette at every stage, not merely add particles. Top row: four directional flying projectiles pointing RIGHT, solid core around cell center and trailing energy LEFT. Middle row: four directional launch/muzzle flashes, point from left origin toward RIGHT, no weapon body. Bottom row: four radial impact explosions with material debris, no ground/platform. Strong saturated luminous fantasy pigments, rich painted soft brush highlights, clearly sculpted volumes and crisp edges around solid cores, dramatic bright centers and colored edges. Production quality 2D painted cartoon VFX with readable chunky forms at small game size, not thin vector clipart, not generic circles, no photorealism. The core is visible at small sizes; glow and energy stay much lighter than solid dark details. Keep each sprite isolated. Exact4×3 evenly spaced atlas.
FAMILY CRYSTAL / ARCANE LANCE: brilliant amethyst violet, saturated magenta cores, deep indigo dark faces, icy-cyan facet highlights and polished golden accents only on evolved stages. Top row c1: one long thick faceted amethyst spear-shard pointingRIGHT, hard sharp polygonal facets and short lavender luminous dust tail. c2: forked double-prism arrow with two long violet crystal tines, vivid cyan ridge and tiny gold socket. c3: a three-bladed star lance with long central amethyst blade and two shorter swept indigo facets, golden hinge and curved magenta aura; clearly elongated sharp body. c4: grand crystalline lotus-lance pointingRIGHT, long royal violet central spear surrounded by four swept crystal petals, gold bindings and brilliant cyan-magenta prism refractions, majestic broad angular silhouette without becoming a sphere. Middle row c1: a short 3-facet crystal flash; c2: an opening fan of sharp amethyst shards; c3: a sculpted crystalline flower with six interlocking prisms launching toRIGHT; c4: a royal lotus-shaped prism gate opening into a rainbow-magenta/cyan crystal spear burst, no flames. Bottom row c1: small sharp shattered crystal star with 5 large facets; c2: a broad radial bed of long amethyst spikes with cyan fracture lines; c3: magnificent angular crystalline flower, rising giant purple facets with bright magenta center and flying shard clusters; c4: dramatic royal crystal lotus implosion/eruption, six large asymmetrical faceted violet/indigo petals, solid cyan crystalline rays, gold stardust and many visibly sharp large separate fragments. Wider hard geometry than the electric family, no blue blobs, no soft pastel lavender, no cotton cloud effects.
```

### Correção aplicada individualmente aos três atlas

A pintura de cada família foi inspecionada antes desta edição e fornecida via `referenced_image_paths`. A ferramenta preservou o estilo e reorganizou os sprites para eliminar invasão entre células. `transparent_background=true`.

```text
Re-layout this exact set of 12 painted game effect sprites into a STRICT SPARSE PRODUCTION ATLAS. Preserve all twelve illustrated designs, materials, colors and their ordering. Keep FOUR COLUMNS × THREE ROWS, exact4:3 canvas, transparent RGBA background. CRITICAL: individually SHRINK AND REPOSITION every sprite so each one fits COMPLETELY inside the central65% of its square grid cell. This includes all flames, smoke, glow, particles, electrical arcs and crystal shards. Every sprite must have its own large fully transparent margin ON ALL FOUR SIDES, at least17.5% of a cell. This must look sparse and carefully aligned, not a collage that fills all available space! All twelve must remain separate and uncropped. DO NOT merely resize the whole sheet. The tallest/widest evolved sprites in column4 need to be reduced much more than their current size. Use exact cell centers at x12.5%,37.5%,62.5%,87.5% of canvas, y16.666%,50%,83.333%. Maximum sprite width16.25% of canvas and maximum sprite height21.666% of canvas. The row separator bands around y33.333% and y66.666% must be entirely transparent, with a generous empty gutter. Likewise column separator bands around x25%,50%,75% fully transparent. No glowing pixels cross any cell boundary. Remove every loose fragment lying outside its assigned central65% box. No new labels, border, frame, icons, background, grid lines or text. Preserve transparency. Same artwork and twelve designs, but enforce the small sprites within extremely generous padded cells.
```

| Família | Referência da edição | Saída final da sessão |
| --- | --- | --- |
| ember | /workspace/ddt3/public/assets/vfx/ember-effects.png, contendo a geração original no momento da edição | /workspace/generated_images/exec-bd2bfe1a-0a9c-490a-958c-c04c5c7f574d.png |
| volt | /workspace/ddt3/public/assets/vfx/volt-effects.png, contendo a geração original no momento da edição | /workspace/generated_images/exec-05bdd968-ed87-4a61-8ad5-1ac1a705ecd6.png |
| crystal | /workspace/ddt3/public/assets/vfx/crystal-effects.png, contendo a geração original no momento da edição | /workspace/generated_images/exec-d5beda4c-2582-4183-bf8e-92b617784e3c.png |

Os caminhos absolutos de geração são registros desta sessão, não dependências do jogo. Os três arquivos finais em `public/assets/vfx/` acompanham o repositório.


## Revisão: armas coloridas, Cesto de Pavio, Super e resíduos

A regra mais recente do usuário substitui a direção antiga de armas básicas monocromáticas: **sem upgrade significa desenho mais simples, nunca arma carbonizada, cinza ou dessaturada**. A cor pertence ao material desde +0. Ornamentos, silhueta e efeitos crescem nos estágios 0–8 / 9 / 10–11 / 12. O fundo especial **Super começa em +9**, conforme confirmado, e não muda a raridade do item.

As três bases foram repintadas por `image_gen`, preservando silhueta, orientação e transparência. Dragão de Brasa: esmalte vermelho e cobre, madeira mel e olho âmbar. Tempestade: corpo ciano, prata limpa e anéis de latão. Flor de Cristal: ametista violeta, facetas ciano, gema magenta e haste de madeira quente. Os arquivos `weapon-{ember,volt,crystal}-base.png` são as pinturas novas; não há filtro CSS usado para esconder o problema. Os arquivos históricos `*-v1.png` não são carregados.

### Quarta família: Cesto de Pavio

ID `dynamite`, efeito `dynamite`, arma original inspirada na linguagem de cestos de explosivos da referência. Corpo básico de lona turquesa com três dinamites vermelhas; +9 cesto de couro rubro com placas de latão e fecho verde; +10 cesto azul real com asas pequenas e escudo esmeralda; +12 fênix dourada, marfim e rubi, com dinamites de pavio aceso. São quatro pinturas distintas, sem reutilizar uma arma escura para representar o começo.

| Parâmetro provisório | Valor |
| --- | --- |
| Dano base | 230 |
| Raio de destruição | 56 |
| Raio de dano | 118 |
| Raio físico do projétil | 7 |
| Gravidade | 310 |
| Ângulo permitido | 15–85° |

O servidor conserva autoridade sobre trajetória, acerto, dano e destruição. A dinamite tem gravidade, raio e orçamento de destruição diferentes das outras famílias. Fortalecimento altera dano/ataque pela regra compartilhada, não aumenta a cratera sem autorização de balanceamento.

O atlas `vfx/dynamite-effects.png` segue quatro colunas por três linhas: projéteis / lançamento / impacto. Projétil base é uma banana de dinamite vermelha, seguido por feixes maiores com amarras e ornamentos; todos giram em voo, deixam faíscas do pavio e fumaça de pólvora. Impacto tem clarão âmbar, plumas creme, fragmentos de papel vermelho e onda de pressão achatada. O som usa estalo de pavio e explosão grave própria. Movimento reduzido remove o giro e faíscas orbitais, mantendo trajetória e legibilidade.

### Marcas que permanecem no terreno

`vfx/terrain-residues.png`: atlas RGBA 2×2, 1254×1254. Ordem fogo / eletricidade / cristal / dinamite. Fogo deixa carvão avermelhado e fissuras de brasa; eletricidade deixa veios ramificados azul-escuros; cristal deixa lascas roxas; dinamite deixa queimadura de pólvora com papel vermelho e fibra de pavio. A futura arma de sorvete deverá ter resíduos de sorvete, mas não foi adicionada nesta etapa.

`TerrainResidues` conserva no máximo 48 marcas em coordenadas do mundo, deduplicadas pelo ID do impacto. O servidor envia `Battle.terrainMarks` apenas para impactos já ocorridos, permitindo reconexão. O cliente acrescenta a marca ao reproduzir o contato e funde o snapshot sem duplicar. Cada mudança no terreno recompõe a máscara de células sólidas: nenhuma marca é pintada sobre céu ou dentro de um buraco, e uma cratera posterior remove também o trecho da marca que perdeu apoio. Marcas são exclusivamente visuais; não criam dano contínuo, gelo, atrito nem colisão. Limpeza ocorre ao sair ou começar outra partida.

### Prompts desta revisão

Edições das bases, sempre com referência do respectivo `weapon-*-base.png` e `transparent_background=true`:

```text
Edit this isolated transparent fantasy game weapon asset. Preserve exact simple base silhouette and diagonal orientation. Original hand-painted chibi 2D game art, dimensional materials, bold readable contour, colored midtones and clean highlights. No black charcoal, dirty gray or burnt finish. No additional crowns, wings, aura or floating particles. Transparent RGBA background, no text or frame. Ember: saturated vermilion red enamel plates, bright copper-orange muzzle, honey wood grip, small amber eye. Volt: turquoise-blue barrel, narrow brass collars, clean silver muzzle, small cyan crystal, honey wood grip. Crystal: saturated amethyst violet crystals, cyan facets, magenta center, cherrywood shaft and simple brass bindings.
```

Geração individual dos quatro cestos, `transparent_background=true`:

```text
Create one ORIGINAL isolated fantasy artillery game weapon asset: a playful portable dynamite basket, not a gun. Hand-painted polished chibi cartoon 2D game illustration with sculpted volume, thick clear contour, vibrant saturated colors, clean midtones. Upright basket, slight clockwise tilt, three-quarter front/right view, no hand or person. Whole object centered within square canvas, generous transparent margins, no floor shadow, icon border, lettering or numbers.
Base: turquoise canvas pouch-bucket, plain brass rim, three red dynamite sticks with cream caps and short unlit ropes, curved carrying strap.
Evolved: scarlet leather basket, brass corner plates, five red sticks and tiny lit fuses, emerald clasp.
Awakened: royal cobalt basket, elaborate golden bands, emerald shield emblem, six red sticks including one large central stick, small winglike side clasps.
Legendary: ruby and golden phoenix basket, sculpted wing plates around emerald flame crest, seven red sticks, small gold fuse sparks, ivory rim and thick curved handle.
```

Atlas de efeitos: 4×3 RGBA, sprites contidos no centro de 60% de cada célula, com margens transparentes de 20%. Topo: dinamite única / três amarradas / cinco com cinturão / feixe dourado esmeralda. Meio: puf de pólvora / faíscas triplas / leque dourado e papel / clarão com plumas e pontos verdes. Base: explosões crescentes com centro amarelo-branco, lóbulos laranja e nuvens creme. Sem texto, grade visível ou chão. A primeira geração precisou ser reeditada para garantir margens de cada célula.

Atlas de resíduos: quatro decals em 2×2 RGBA, centros transparentes, formas orgânicas com bordas difusas e fragmentos pequenos. Não pintar explosão ativa nem nuvem. Fogo carvão/brasa; eletricidade veios; cristal lascas; dinamite fuligem/papel/pavio. Cada pintura permanece isolada e é recortada pelo terreno em runtime.

Assets desta revisão: quatro cestos em RGBA 1254×1254; atlas de dinamite em RGBA 1448×1086. Originais de geração preservados em `/workspace/generated_images/`, copiados diretamente ao repositório sem edição programática.

### Evidência desta revisão

- TypeScript aprovado; 27 testes de catálogo/física aprovados, incluindo migração de dinamite sem repor materiais e trajetória/destruição próprias.
- Prancha atual de 4 famílias × 4 estágios: `test-results/weapons-revision/four-families.png`.
- Bases coloridas e quatro cestos: `test-results/weapons-revision/colorful-weapons.png`.
- Cards reais React +0/+8/+9/+10/+12: `test-results/weapons-revision/super-cards.png`; o fundo Super existe só a partir de +9.
- Resíduos: `test-results/weapons-revision/terrain-residues.png`. Ensaio Canvas confirmou 98.000 pixels visíveis, zero fora do chão (desconsiderada somente a borda antialias de 3px), nenhuma alteração ao repetir os mesmos IDs, e zero na região removida pela nova máscara. Nenhuma exceção JavaScript nos dois harnesses.
- Partida real no Jardim: conta de teste comprou Cesto de Pavio na loja por 480 moedas, equipou e disparou pela conexão WebSocket existente. Servidor confirmou efeito `dynamite` e uma marca de terreno; captura posterior mantém queimadura após o clarão desaparecer. Zero erros JavaScript/servidor. Capturas: `dynamite-impact-garden.png` e `dynamite-scorch-garden.png`, no mesmo diretório de revisão. O harness envia a intenção de disparo diretamente; a régua de força é verificada separadamente pelos testes do HUD.
