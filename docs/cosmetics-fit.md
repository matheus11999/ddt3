# Sistema de encaixe de cosméticos (rig v1)

Pedido do usuário em 16/10/2026: personagens altamente personalizáveis, em que qualquer rosto, cabelo, chapéu, óculos e roupa encaixe em todas as combinações, inclusive nos itens e gerações de arte futuras. O plano completo, com diagnóstico e decisões, está no documento "Sistema de encaixe de cosméticos" do projeto.

## Princípio

O rosto já segue um contrato universal (`face-authoring-rules.md`). O rig v1 estende essa ideia aos outros slots: um molde único, âncoras nomeadas, zonas de tamanho por classe de peça e um verificador. Uma peça nova é desenhada sobre o molde e aprovada pela ferramenta; não se ajustam coordenadas caso a caso.

## Fonte de verdade

- `src/game/rig/anchors.ts`: `RIG_VERSION`, âncoras da cabeça (`HEAD_ANCHORS`), largura de referência `HEAD_WIDTH=417`, áreas proibidas (`FACE_KEEPOUT`: olhos e boca), zonas por classe (`FIT_ZONES`), margem do quadro.
- `src/game/rig/manifest.ts`: `COSMETIC_MANIFEST`, um registro por cabelo, chapéu e óculos com rig, classe, perfil de cabeça e a arte (atlas, região, recorte e **pin**). O pin liga dois pontos da arte a dois pontos do molde; o encaixe é sempre semelhança (mover, girar, escala uniforme), nunca esticar.
- `src/game/rig/draw.ts`: `drawPinned`, o único caminho de posicionamento de cabelo descoberto, cabelo coberto, chapéu e óculos pintados. Ícones usam `cutRegion` na mesma região.
- `src/game/rig/fit.ts`: avaliação pura sobre máscaras de alfa, usada pelo verificador e pelos testes.
- Coordenadas no espaço de 1254 px de `FACE_REGISTRATION`.

| Classe | Largura máx. (× cabeça) | Acima do crânio | Outros limites |
| --- | --- | --- | --- |
| `hair-short` | 1,45 | 0,30 | Até y=640; sem cobrir olhos/boca |
| `hair-long` | 1,55 | 0,30 | Até y=820 (atrás do corpo); sem cobrir olhos/boca |
| `hat-tight` | 1,40 | 0,60 | Até y=450 |
| `hat-wide` | 1,75 | 0,90 | Até y=470 |
| `hat-band` | 1,20 | 0,30 | Até y=420; sem cobrir olhos/boca |
| `hat-helmet` | 1,30 | 0,70 | Até y=470; sem cobrir olhos/boca |
| `glasses` | 0,80–0,95 | — | A partir de y=340; frente ≥70% visível (aba pode cobrir o topo do aro) |
| Roupa | ombros 0,85–1,05 (cabeça de referência) | — | Cabeça = 47–53% da altura em pé, já com `HEAD_SCALE` |
| Roupa deitada | corpo 1–1,8× a cabeça escalada | — | Braços 6–40% do tronco; mão sobre os punhos; ver `prone-combat.md` |

Todo PNG mantém 24 px de margem transparente até a borda do quadro de 1254 px.

## Tamanho da cabeça

Pedido do usuário em 17/10/2026: cabeça 30% maior em todos os bonecos e telas. `HEAD_SCALE=1.3` em `anchors.ts` é aplicado em `avatar.ts` no pivô do pescoço, em pé, andando e em combate. Rosto, cabelo, chapéu e óculos estão no espaço da cabeça e crescem juntos; moldes, âncoras e zonas continuam no espaço de 1254 px e não mudam. O corpo não muda. Para caber nas molduras, `Avatar.tsx` desenha o boneco a 74% do quadro (antes 79%), e nome, barra de vida e seta de turno no cenário subiram (`Scene.tsx`). Mudar o tamanho da cabeça no futuro é trocar só esse número e conferir esses enquadramentos.

## Gerações futuras

Um novo corpo, cabeça ou estilo de arte recebe outro `RIG_VERSION` com âncoras e zonas próprias. Cada item declara o rig para o qual foi desenhado; o verificador mede cada geração contra o seu contrato, sem misturar gerações em silêncio.

## Verificação

```bash
npm run verify:cosmetics            # relatório, não reprova
npm run verify:cosmetics -- --strict # reprova se restar qualquer problema
```

Inicia o Vite sozinho. `BROWSER_EXECUTABLE` aponta um Chromium específico; `OUTPUT_DIR` muda a pasta (padrão `test-results/cosmetics`). Gera `report.md`, `report.json`, `colors.png` (cada peça em 6 cores e o corpo em 6 tons de pele e de olho, ver `docs/color-tickets.md`), `zones.png` (cada peça com sua zona: verde dentro, vermelho fora), `matrix.png` (chapéu × cabelo com Óculos Sprint) e `prone.png` (cada roupa deitada parada, arrastando, carregando e arremessando).

Mede cada peça isolada, as 54 combinações chapéu × cabelo com cada óculos (cabelo sobre olhos/boca, frente dos óculos encoberta) e a proporção das roupas. Rostos continuam em `verify-faces.mjs`. A inspeção visual do usuário continua necessária: a ferramenta barra o que está fora da medida, não decide se a arte é bonita.

## Fases

1. **Medir** (feito): âncoras, zonas e verificador em modo relatório.
2. **Migrar o renderer** (feito): registro único e `drawPinned`; ajustes em unidades de tela removidos. As camadas separadas e a máscara de abertura entram com a arte nova da fase 3.
3. **Corrigir a arte** (código feito, arte pendente): assento único dos chapéus, óculos entre a franja e a aba, tintura em todos os cabelos, moldes em `docs/templates/` e briefs em `cosmetics-art-briefs.md`. Falta repintar as peças listadas nos briefs.
4. **Roupas**: escala única e âncoras por pose.
5. **Travar**: `--strict` no fluxo de verificação, kit de criação e regra no AGENTS.md.

## Como adicionar um cosmético

1. Pintar a peça vestida sobre o molde de 1254 px, na mesma perspectiva 3/4, respeitando a zona da classe.
2. Adicionar a entrada em `COSMETIC_MANIFEST` com `rig: RIG_VERSION`, classe, perfil (chapéus) e pin: chapéu nos dois pontos da faixa interna até `HEAD_ANCHORS.hatSeat`; óculos no centro das lentes até os olhos; cabelo pintado direto no molde usa `onTemplate`. Cabelo novo entrega também a variante `covered`.
3. Adicionar o item ao catálogo. O teste `cosmetic-fit.test.ts` falha se faltar manifesto ou se o slot divergir.
4. Adicionar a região de cor em `src/game/rig/recolorZones.ts` (peça inteira, ou a faixa de cor da parte principal). Ver `docs/color-tickets.md`.
5. Rodar `npm run verify:cosmetics` e corrigir a arte até o item sair do relatório, inclusive a seção "Ticket de Cor"; depois inspecionar as pranchas, incluindo `colors.png`.

Nenhum número novo vai para `appearance.ts` ou `headwear.ts`.

## Redução provisória (17/10/2026)

Corte Horizonte, Corte Tempestade e Rabo de Cavalo Rubi passavam da cabeça (1,56–1,71× de largura). `shrink(..., .9)` em `manifest.ts` reduz cada um a 90% em volta do centro do crânio (o Horizonte gira perto do olho distante para a franja não descer sobre os olhos). Agora cabem na largura; sobra uma pequena altura extra e a franja sobre os olhos, que só a arte nova corrige. Quando a arte repintada chegar, remover o `shrink` da peça.

## Orelha na frente do cabelo (17/10/2026)

O cabelo passava por cima da orelha. Agora cada arte de cabelo, descoberto ou coberto, é recortada pelo contorno exato da orelha (`EAR_FRONT` em `anchors.ts`, traçado no meio da linha pintada da cabeça universal) e ganha uma borda escura no corte, como no DDTank: a orelha da cabeça aparece por baixo e o cabelo a contorna com uma linha contínua, sem recorte quadrado. Arte nova não deve pintar mechas sobre a orelha.

## Fase 3: ajustes de código

- Todos os chapéus pintados usam o mesmo assento (`HEAD_ANCHORS.hatSeat`); antes cada um tinha o seu, com até 23 px de diferença.
- Ordem frontal: franja, óculos, chapéu. Óculos comprados nunca ficam sob a franja.
- Corte Tempestade e Rabo de Cavalo passaram a aceitar tintura, como os demais.
- O limite do quadro de 1254 px só vale para arte pintada no molde; arte em atlas é posicionada pelo pin e pode subir além dele.
- Moldes de criação por classe em `docs/templates/`, gerados por `scripts/make-cosmetic-templates.mjs` a partir do rig atual.

O que ainda reprova depende de arte nova; ver `cosmetics-art-briefs.md`. Não há corte ou deformação procedural para esconder peças grandes: isso trocaria um problema de encaixe por recortes visíveis.

## Migração (fase 2)

Comparação com 353 imagens de referência (todas as combinações chapéu × cabelo × óculos, tinturas, caminhada e combate espelhados, ícones): 313 idênticas. As 40 restantes envolvem Cabelo Ondulado, Corte Tempestade e Rabo de Cavalo descobertos, que eram esticados 0,5% na vertical; agora mantêm a proporção, diferença menor que meio pixel no tamanho do jogo. `verify-headwear`, `verify-glasses` e `verify-shop-cosmetics` passam. O relatório passou a apontar o assento dos chapéus: Boné, Relâmpago, Bucket e Astral estão 8–23 px fora da âncora universal (corrigir com a arte da fase 3).

## Relatório inicial (fase 1)

8 de 17 peças fora da zona: Corte Tempestade, Rabo de Cavalo Rubi, Cabelo Aventureiro e Lunar (largura, altura, quadro); Cabelo Ondulado (desce 10 px além e franja sobre os olhos); Chapéu Astral (aba baixa e sai do quadro); Elmo do Guardião (sai do quadro e cobre os olhos); Óculos Gatinho (0,99× a cabeça). 49 de 54 combinações com problema, principalmente franja sobre os olhos e aba de bonés cobrindo 25–35% da frente dos óculos. Executivo e Dançarina têm tronco de 0,77–0,78× a cabeça, contra 0,85–1,01× nas outras roupas.

## Cabelo sob chapéu

Com chapéu aparece o mesmo cabelo de sem chapéu, só cortado: nada surge que o cabelo descoberto não tenha. `drawHair` passa a arte por `underHat` em `appearance.ts`, que apaga tudo acima da linha de assento do chapéu (`HEAD_ANCHORS.hatSeat`). Atrás da cabeça o corte desce pela curva do crânio (`HAT_NAPE`) e, passando da frente da faixa, desce pela têmpora (`HAT_BROW`), com borda suave, para as mechas laterais parecerem sair por baixo do chapéu. As regiões `covered` do manifesto não são mais desenhadas. Vale para todo cabelo, sem número por item.
