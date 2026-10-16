# Sistema de encaixe de cosméticos (rig v1)

Pedido do usuário em 16/10/2026: personagens altamente personalizáveis, em que qualquer rosto, cabelo, chapéu, óculos e roupa encaixe em todas as combinações, inclusive nos itens e gerações de arte futuras. O plano completo, com diagnóstico e decisões, está no documento "Sistema de encaixe de cosméticos" do projeto.

## Princípio

O rosto já segue um contrato universal (`face-authoring-rules.md`). O rig v1 estende essa ideia aos outros slots: um molde único, âncoras nomeadas, zonas de tamanho por classe de peça e um verificador. Uma peça nova é desenhada sobre o molde e aprovada pela ferramenta; não se ajustam coordenadas caso a caso.

## Fonte de verdade

- `src/game/rig/anchors.ts`: `RIG_VERSION`, âncoras da cabeça (`HEAD_ANCHORS`), largura de referência `HEAD_WIDTH=417`, áreas proibidas (`FACE_KEEPOUT`: olhos e boca), zonas por classe (`FIT_ZONES`), margem do quadro e a classe de cada item (`COSMETIC_FIT`).
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
2. **Migrar o renderer**: manifesto por item e posicionamento por âncoras e camadas; sem mudança visual.
3. **Corrigir a arte**: repintar o que o relatório reprova; perfil Faixa para Óculos de Voo; Elmo pintado.
4. **Roupas**: escala única e âncoras por pose.
5. **Travar**: `--strict` no fluxo de verificação, kit de criação e regra no AGENTS.md.

## Relatório inicial (fase 1)

8 de 17 peças fora da zona: Corte Tempestade, Rabo de Cavalo Rubi, Cabelo Aventureiro e Lunar (largura, altura, quadro); Cabelo Ondulado (desce 10 px além e franja sobre os olhos); Chapéu Astral (aba baixa e sai do quadro); Elmo do Guardião (sai do quadro e cobre os olhos); Óculos Gatinho (0,99× a cabeça). 49 de 54 combinações com problema, principalmente franja sobre os olhos e aba de bonés cobrindo 25–35% da frente dos óculos. Executivo e Dançarina têm tronco de 0,77–0,78× a cabeça, contra 0,85–1,01× nas outras roupas.
