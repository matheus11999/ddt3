# Ferreiro — prompts de arte

Ferreiro redesenhado em 17/10/2026 no mesmo padrão da mochila (`src/components/Forge.tsx`, `src/components/Forge.css`): moldura de madeira laranja, painéis creme, faixas de madeira escura para chance e ação, cards de classe compartilhados (`ItemCard`, pedra no canto), selo `+N` por marco (`UpgradeTag`) e o mesmo card de informações da mochila (`InventoryTooltip`). Abas Fortalecer e Composição ficam na vertical, à direita da grade, como as abas da mochila.

Atrás do item na bigorna gira o selo pintado `aura-gold-sigil.png`, igual ao selo atrás do personagem na mochila. A pintura antiga da oficina azul (`forge-workshop.png`) não é mais usada porque destoava da paleta laranja/creme; o arquivo continua no projeto. As peças abaixo dão ao palco creme um ar de forja sem voltar ao azul. Regras comuns iguais às de `docs/backpack-art-prompts.md`: PNG transparente, cores vivas, contorno marrom limpo, sem texto, sem pastel lavado, arte original no estilo do DDTank.

## 1. Bigorna sob o item

Arquivo: `public/assets/ui/forge-anvil.png`, 768×384, transparente.

```text
Single game UI prop, 768x384, transparent background, a chunky cartoon blacksmith anvil seen slightly from above and front, centered, wide flat top surface left empty because an item card will sit on it, dark steel body with warm orange forge-glow reflections on the left side, polished gold trim along the top edge, small glowing ember cracks near the base, sitting on a short round oak stump with iron bands, thick clean brown outline, vivid saturated colors, painted 3D look like classic Asian browser artillery games, soft light from top-left. No text, no hammer, no weapon on it, no background, no floor shadow beyond a small soft contact shadow.
```

Uso: `<img className="smith-anvil">` atrás de `.forge-weapon-target`, com a face de cima alinhada à metade de baixo do card; o selo dourado continua atrás dos dois.

## 2. Fundo do palco da bancada

Arquivo: `public/assets/ui/forge-stage-cream.webp`, 1024×1024.

```text
Square game UI panel background, 1024x1024, warm cream parchment-colored blacksmith workshop seen softly out of focus: honey-colored wooden wall planks, a rounded brick furnace mouth glowing orange on the far left edge, a few hanging tongs and hammers as soft silhouettes on the right edge, center area very light and clean (pale cream #fff6e2 fading to #f7e4bd) so an item card and a golden magic circle can sit on top, gentle warm vignette at the corners, vivid but light palette matching orange wood UI frames, painted casual MMO style. No text, no characters, no items in the center, no frame or border.
```

Uso: substitui o gradiente creme de `.smith-stage` em `Forge.css` (`background: url(...) center / cover`), mantendo a borda laranja interna.

## 3. Martelo da animação

Arquivo: `public/assets/ui/forge-hammer.png`, 256×320, transparente.

```text
Single game UI prop, 256x320, transparent background, a cartoon blacksmith hammer standing upright with the head on top, chunky steel head with gold bands and a warm orange glow on its striking face, short wrapped leather handle in caramel brown, thick clean brown outline, vivid saturated painted 3D look like classic Asian browser artillery games. No text, no sparks, no background.
```

Uso: troca o martelo em SVG de `StrengtheningEffect` (`.forge-striking-hammer`) mantendo a mesma animação de batida.
