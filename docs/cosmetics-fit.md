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
| `glasses` | 0,80–0,95 | — | A partir de y=340; frente sempre ≥90% visível |
| Roupa | ombros 0,85–1,05 | — | Cabeça = 42–48% da altura em pé |

Todo PNG mantém 24 px de margem transparente até a borda do quadro de 1254 px.

## Gerações futuras

Um novo corpo, cabeça ou estilo de arte recebe outro `RIG_VERSION` com âncoras e zonas próprias. Cada item declara o rig para o qual foi desenhado; o verificador mede cada geração contra o seu contrato, sem misturar gerações em silêncio.

## Verificação

```bash
npm run verify:cosmetics            # relatório, não reprova
npm run verify:cosmetics -- --strict # reprova se restar qualquer problema
```

Inicia o Vite sozinho. `BROWSER_EXECUTABLE` aponta um Chromium específico; `OUTPUT_DIR` muda a pasta (padrão `test-results/cosmetics`). Gera `report.md`, `report.json`, `zones.png` (cada peça com sua zona: verde dentro, vermelho fora) e `matrix.png` (chapéu × cabelo com Óculos Sprint).

Mede cada peça isolada, as 54 combinações chapéu × cabelo com cada óculos (cabelo sobre olhos/boca, frente dos óculos encoberta) e a proporção das roupas. Rostos continuam em `verify-faces.mjs`. A inspeção visual do usuário continua necessária: a ferramenta barra o que está fora da medida, não decide se a arte é bonita.

## Fases

1. **Medir** (feito): âncoras, zonas e verificador em modo relatório.
2. **Migrar o renderer** (feito): registro único e `drawPinned`; ajustes em unidades de tela removidos. As camadas separadas e a máscara de abertura entram com a arte nova da fase 3.
3. **Corrigir a arte**: repintar o que o relatório reprova; perfil Faixa para Óculos de Voo; Elmo pintado.
4. **Roupas**: escala única e âncoras por pose.
5. **Travar**: `--strict` no fluxo de verificação, kit de criação e regra no AGENTS.md.

## Como adicionar um cosmético

1. Pintar a peça vestida sobre o molde de 1254 px, na mesma perspectiva 3/4, respeitando a zona da classe.
2. Adicionar a entrada em `COSMETIC_MANIFEST` com `rig: RIG_VERSION`, classe, perfil (chapéus) e pin: chapéu nos dois pontos da faixa interna até `HEAD_ANCHORS.hatSeat`; óculos no centro das lentes até os olhos; cabelo pintado direto no molde usa `onTemplate`. Cabelo novo entrega também a variante `covered`.
3. Adicionar o item ao catálogo. O teste `cosmetic-fit.test.ts` falha se faltar manifesto ou se o slot divergir.
4. Rodar `npm run verify:cosmetics` e corrigir a arte até o item sair do relatório; depois inspecionar as pranchas.

Nenhum número novo vai para `appearance.ts` ou `headwear.ts`.

## Migração (fase 2)

Comparação com 353 imagens de referência (todas as combinações chapéu × cabelo × óculos, tinturas, caminhada e combate espelhados, ícones): 313 idênticas. As 40 restantes envolvem Cabelo Ondulado, Corte Tempestade e Rabo de Cavalo descobertos, que eram esticados 0,5% na vertical; agora mantêm a proporção, diferença menor que meio pixel no tamanho do jogo. `verify-headwear`, `verify-glasses` e `verify-shop-cosmetics` passam. O relatório passou a apontar o assento dos chapéus: Boné, Relâmpago, Bucket e Astral estão 8–23 px fora da âncora universal (corrigir com a arte da fase 3).

## Relatório inicial (fase 1)

8 de 17 peças fora da zona: Corte Tempestade, Rabo de Cavalo Rubi, Cabelo Aventureiro e Lunar (largura, altura, quadro); Cabelo Ondulado (desce 10 px além e franja sobre os olhos); Chapéu Astral (aba baixa e sai do quadro); Elmo do Guardião (sai do quadro e cobre os olhos); Óculos Gatinho (0,99× a cabeça). 49 de 54 combinações com problema, principalmente franja sobre os olhos e aba de bonés cobrindo 25–35% da frente dos óculos. Executivo e Dançarina têm tronco de 0,77–0,78× a cabeça, contra 0,85–1,01× nas outras roupas.
