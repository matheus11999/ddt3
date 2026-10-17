# Ferreiro — prompts de arte

Ferreiro redesenhado em 17/10/2026 no mesmo padrão da mochila (`src/components/Forge.tsx`, `src/components/Forge.css`): moldura de madeira laranja, painéis creme, faixas de madeira escura para chance e ação, cards de classe compartilhados (`ItemCard`, pedra no canto), selo `+N` por marco (`UpgradeTag`) e o mesmo card de informações da mochila (`InventoryTooltip`). Abas Fortalecer e Composição ficam na vertical, à direita da grade, como as abas da mochila.

A bancada tem cara própria (pedido de 17/10/2026): forja escura com brasas, cinco encaixes redondos de ferro no topo ligados à bigorna por canais que acendem quando recebem pedra, item sobre a bigorna com o selo +N no canto, e logo abaixo a barra de chance (vermelha, amarela ou verde, com +x% ao adicionar pedra) e o botão Fortalecer. Etapas Arma → Pedras → Forjar no cabeçalho. Ao forjar (1,3 s): as pedras voam para a bigorna, o martelo bate duas vezes e só então aparece SUCESSO com o novo selo ou FALHOU com o card tremendo. Sem selo circular atrás do item e sem Atual/Próximo. A pintura antiga da oficina azul (`forge-workshop.png`) não é usada; o arquivo continua no projeto. Regras comuns iguais às de `docs/backpack-art-prompts.md`: PNG transparente, cores vivas, contorno marrom limpo, sem texto, sem pastel lavado, arte original no estilo do DDTank.

## 1. Bigorna sob o item

Arquivo: `public/assets/ui/forge-anvil.png`, 768×384, transparente.

```text
Single game UI prop, 768x384, transparent background, a chunky cartoon blacksmith anvil seen slightly from above and front, centered, wide flat top surface left empty because an item card will sit on it, dark steel body with warm orange forge-glow reflections on the left side, polished gold trim along the top edge, small glowing ember cracks near the base, sitting on a short round oak stump with iron bands, thick clean brown outline, vivid saturated colors, painted 3D look like classic Asian browser artillery games, soft light from top-left. No text, no hammer, no weapon on it, no background, no floor shadow beyond a small soft contact shadow.
```

Uso: substitui `.smith-anvil-base` (base de ferro em CSS) sob `.forge-weapon-target`.

## 2. Fundo do palco da bancada

Arquivo: `public/assets/ui/forge-stage.webp`, 1024×1024.

```text
Square game UI panel background, 1024x1024, the inside of a cozy blacksmith forge seen straight on and softly out of focus: dark warm brown stone and brick walls, a bed of glowing orange coals along the whole bottom edge, faint hanging tongs and hammers as dark silhouettes near the top corners, center area darker and clean so an item card, five round iron sockets and a button can sit on top, warm orange rim light, vivid saturated painted casual MMO style matching orange wood UI frames. No text, no characters, no items in the center, no frame or border.
```

Uso: substitui os gradientes escuros de `.smith-stage` em `Forge.css` (`background: url(...) center / cover`), mantendo `.smith-coals` por cima.

## 3. Martelo da animação

Arquivo: `public/assets/ui/forge-hammer.png`, 256×320, transparente.

```text
Single game UI prop, 256x320, transparent background, a cartoon blacksmith hammer standing upright with the head on top, chunky steel head with gold bands and a warm orange glow on its striking face, short wrapped leather handle in caramel brown, thick clean brown outline, vivid saturated painted 3D look like classic Asian browser artillery games. No text, no sparks, no background.
```

Uso: troca o martelo em SVG de `StrengtheningEffect` (`.forge-striking-hammer`) mantendo a mesma animação de batida.
