# Badges de nível — cores, bases e aura progressiva

Revisão de 16/10/2026, seguindo a imagem de numerais em relevo confirmada pelo usuário. Preservar o número inclinado e tridimensional. A nova base decorativa acompanha a faixa de cor; não restaurar ciano no nível inicial ou ouro no50.

## Faixas definitivas

| Níveis | Número e base | Efeito |
| --- | --- | --- |
| 1–10 | Cinza completo, grafite e reflexos cinza; base simples | Sem aura |
| 11–20 | Verde esmeralda, base de duas asas compactas | Sem aura |
| 21–30 | Azul safira/cobalto, asas e cristais | Aura azul começa exatamente no30 |
| 31–40 | Bronze/cobre, base mais trabalhada | Aura bronze cresce; segunda camada no40 |
| 41–50 | Prata/platina, asas e coroa prateada | Aura prateada mais forte; seis raios no50 |
| 51–70 | Dourado | Aura solar no 60 e soberana no 70 |

**O limite agora é 70**, conforme pedido mais recente. Contas com XP acumulado no antigo limite 50 passam a aproveitar essa experiência. Cores de nível são independentes do fortalecimento da arma.

## Número e base

O numeral DOM usa Nunito900, inclinação8°, três camadas de frente/contorno/profundidade e altura tipográfica76% do componente. Somente o rótulo externo `Nível N de 70` é exposto à acessibilidade. A base fica atrás, com centro transparente, sem medalhão, disco ou anel opaco.

Novo atlas ativo: `public/assets/ui/level-badge-backdrops.png`, RGBA **1536×1024**, grade3×2 de células512px. Centro alfa0 em todas as células. Ordem: cinza, verde, azul, bronze, prata, ouro. PNG copiado diretamente de `image_gen`, sem edição externa. O estilo da primeira faixa aplica também escala de cinza aos ornamentos; os tons do numeral e as sombras são neutros.

Limites de alfa>16 dentro de cada célula: (54,274)–(459,438), (24,173)–(489,470), (12,119)–(500,465), (10,86)–(503,434), (6,47)–(507,448), (4,46)–(509,447). Posição CSS X0/50/100%, Y0/100%. A arte anterior `level-badges.png` não é carregada pelo componente.

## Aura que cresce

De 30 a 70, `--level-aura-progress` sobe de0 a1. Expansão, opacidade e velocidade evoluem gradualmente. No40 entra uma segunda camada de raios em contrarrotação; no50 aparece o efeito de seis raios, mais amplo. As luzes usam a própria cor da faixa, incluindo bronze no40 e prata no50. No 60 a aura dourada ganha oito raios e no 70 doze raios. Não há aura antes do 30.

`prefers-reduced-motion:reduce` preserva cor e luminosidade, desativando pulsação/rotação. A aura da badge não altera o efeito atrás do personagem.

## Tamanhos reduzidos

- API: `LevelBadge({level,size=42,className})`.
- HUD do jogador:46→40px; mochila:48→42px.
- Carta da arena:58→46px desktop;36px efetivos mobile, sem a escala legada.
- Personagem da carta:236→204px desktop e210→180px mobile.
- Cartas permanecem verticais, com moldura e espaços próprios para nome, nível, dono, poder e prontidão.

## Verificação

Prancha do componente real:39 casos, níveis1/10/11/20/21/29/30/31/39/40/41/49/50 em36/46/72px, DPR2, fundos claro/escuro. Confirma faixas incluindo os limites10/11,20/21,30/31,40/41; nenhum transbordamento, aura somente a partir de30, estágios40/50, crescimento e movimento reduzido. Zero erros JavaScript. Capturas em `test-results/levels/palette-revision/`.

Arena real com oito ocupantes e chat:24 cartas medidas em1536×864,1280×720,390×844 e640×480. Personagem e badge dentro da moldura, sem corte na pintura ou sobreposição com cabeçalho/rodapé; chat e saída acessíveis. Capturas em `test-results/arena/arena-levels-final.png`, `card-levels-final.png` e `mobile-levels-final.png`. No modo horizontal de640×480, a faixa de cartas continua curta e rolável, conforme o layout existente.

## Prompt exato da nova base

```text
Redesign the decorative background ornaments of a 3D numeric LEVEL BADGE for a colorful original fantasy artillery game. These are supporting BACKGROUND ornaments for live large level digits composited over them later. Create a transparent RGBA PNG atlas in exact3:2 landscape proportion, requested1536x1024, STRICT3columns x2rows of six equal square cells512x512. Each cell is ONE separate complete ornament centered at256,256 with transparent margins of60px on every cell edge. Six sequential tiers, simple to ornate. NO NUMBERS, WORDS OR TEXT at all, as the game adds sharp dynamic digits. Each cell's rectangle x145..367 and y150..345 MUST remain transparent for the digits. No circular medal, no closed ring, no opaque shield or disk or filled plate. Dark tones belong to the sculpture edges, NEVER to a square background. True clean alpha, no gradient filling empty regions, no checkerboard.

DESIGN LANGUAGE: new compact sculptural relief that nests under and behind two large italic numerals. A bold shallow UNDERLINE CHEVRON below center at y345..390 with small stepped broad side wings at x70..155 and360..440. Layered chunky curved metal/enamel feathers rather than thin pointy leaf sprigs. Strong 3D side thickness, polished round bevels, dark engraved creases, shaded metallic reflections and highlights. Nearly front-facing with extrusion down-right. Hand-finished 3D chibi MMORPG icon craftsmanship, vivid saturated materials, readable at36–46px. Compact, subordinate to the number, no tall framing. Original artwork, not copied from any franchise. The six silhouettes must visibly progress in complexity while staying inside their cells. Background behind the number remains transparent. NO haze, no pastel, no generic vector.

EXACT palettes and tier layout:
TOP LEFT tier1 GRAY levels1–10: FULLY achromatic gray metal. A simple gunmetal shallow three-step underline, two tiny short blunt side tabs. Dark graphite sides, neutral medium-gray faces, modest pale-gray glints. NO blue or cyan, NO gold, NO colored jewels. Restrained starter shape, no crown, no glow.
TOP CENTER tier2 GREEN levels11–20: glossy deep EMERALD GREEN throughout. A broad green chevron underline and TWO short rounded wing blades on each side, tiny green inset lozenge under center. Saturated green faces, dark forest-green sides, mint reflections. No gold, no blue, no silver except nearly white specular points. No crown or aura.
TOP RIGHT tier3 BLUE levels21–30: saturated COBALT/SAPPHIRE blue. Three compact broad layered blue wing feathers each side and angular sapphire chevron underline, two short cyan crystal accents near upper corners. Dark navy extrusions, electric blue bevels and icy cyan small highlights. Center transparent, no crown. The silhouette allows blue aura later.
BOTTOM LEFT tier4 BRONZE levels31–40: substantial BROWN COPPER-BRONZE sculpted wing fans, three compact layered rounded feathers each side and an interlocking bronze chevron at base, small copper spark diamonds at upper sides. Colors unmistakably bronze rather than yellow/gold: dark chocolate copper creases, medium warm russet bronze faces, pale copper reflections. Rich beautiful metal. NO silver, purple, green or gold jewels. Center transparent.
BOTTOM CENTER tier5 SILVER levels41–50: ornate luminous SILVER/PLATINUM fan wings, four broad layered feather blades each side, clean mirrored silver ridges, tiny clear diamond tips, small three-point SILVER crown above center at y90..135, elegant silver chevron pedestal below. Entirely neutral silver/white/graphite, NO yellow/gold or colored gems. Bright high-tier sophistication, visibly more elaborate than bronze. Center transparent. No opaque background.
BOTTOM RIGHT tier6 GOLD reserved51+: strongest elaborate glowing GOLD phoenix wing fans, four compact chunky feathers each side, miniature golden royal crown above digits at y85..135, small sunburst tips, sculpted gold chevron below with three tiny amber facets. Deep amber extrusion, lustrous golden faces, lemon specular edges. ALL GOLD with no red/blue jewels. Center transparent and generous margins. Maximal elaboration but still compact.

Consistent anchors across allsix cells. Digits will dominate, the base ornament must not hide the numbers. Clear negative space. Only the six isolated ornament cutouts visible, all unused pixels fullytransparent.
```


Revisão até 70: 45 casos em 36/46/72px, fundo claro/escuro, aura monotônica, acessibilidade e movimento reduzido verificados. Evidências em `test-results/levels/level70/`. O prompt original abaixo menciona reserva 51+; essa reserva foi ativada pelo novo limite.
