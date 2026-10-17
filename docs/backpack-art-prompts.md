# Mochila — prompts de arte

Layout da mochila redesenhado em 17/10/2026 no padrão "Informações pessoais" do DDTank: prévia com slots nas laterais, atributos em pílulas creme e barras coloridas, grade de itens com abas verticais à direita e carteira com ações no rodapé (`src/components/Inventory.tsx`, `src/components/Backpack.css`).

Atrás do personagem fica o selo pintado da aura do jogo (`aura-blue-sigil.png` girando devagar abaixo de +5; a partir de +5 o próprio Avatar desenha o selo verde, roxo ou dourado). O resto é desenhado em CSS (madeira laranja, painéis creme) e as silhuetas dos slots vazios e os ícones das abas usam ícones de linha. As peças abaixo substituem esses provisórios por arte pintada. Arte original no estilo do DDTank: nada copiado, sem logotipos, sem texto pintado.

Regras comuns a todos os prompts:

- PNG com fundo transparente (exceto a textura), cores vivas e saturadas, contornos marrons limpos, luz suave de cima à esquerda, acabamento de jogo casual coreano/chinês dos anos 2010.
- Sem texto, números, letras ou marcas d'água na imagem. Os textos ficam no HTML.
- Nada de pastel lavado ou névoa leitosa (ver `AGENTS.md`, direção artística).

## 1. Textura de madeira da moldura

Arquivo: `public/assets/ui/bag-wood-texture.webp`, 512×512, repetível nos quatro lados.

```text
Seamless tileable texture, 512x512, warm painted wood planks for a casual MMO game window frame, vivid orange-amber and caramel brown, soft vertical grain lines, subtle hand-painted highlights, slightly glossy lacquer, cartoon game UI style like classic Asian browser artillery games, no knots that repeat noticeably, no text, no border, flat lighting so it tiles cleanly.
```

Uso: substitui `--bag-grain` em `Backpack.css` (`background: url(...) repeat, linear-gradient(...)`).

## 2. Silhuetas dos slots vazios (atlas 3×3)

Arquivo: `public/assets/ui/bag-slot-silhouettes.png`, 768×768 (células de 256×256), transparente.

```text
Sprite sheet, 3x3 grid of 256x256 cells, transparent background, each cell one centered embossed silhouette icon for an empty equipment slot in a chibi game inventory, tan-caramel color (#cf9a5c) with a soft lighter top edge and darker bottom edge as if pressed into cream leather, same size and line weight in every cell. Order left-to-right, top-to-bottom: spiky anime hair tuft, newsboy cap, round goggles, chibi face outline with closed eyes, short-sleeve shirt with shorts, star-shaped costume mask with sparkles, sports wristband, gem bracelet, cartoon cannon-gun weapon. No text, no frames, no background.
```

Uso: trocar `SLOT_ICONS` (ícones de linha) por recortes do atlas, na ordem hair, hat, glasses, face, outfit, costume, wristband, bracelet, weapon.

## 3. Ícones das abas verticais (atlas 4×1)

Arquivo: `public/assets/ui/bag-tab-icons.png`, 1024×256 (células de 256×256), transparente.

```text
Sprite sheet, 4 cells of 256x256 in a row, transparent background, chunky glossy game UI icons with thick brown outline and vivid colors, painted 3D look, consistent lighting and size. Cells: 1) a stuffed leather adventurer backpack with brass buckles (all items), 2) a folded colorful shirt with a small star (cosmetics), 3) a stubby cartoon cannon-gun crossed with a wrench (weapons), 4) three faceted upgrade crystals in blue, red and gold (stones). No text, no background, no frames.
```

Uso: trocar `BAG_TABS[].Icon` pelos recortes; o texto vertical da aba continua no HTML.

## Depois de gerar

1. Salvar os arquivos nos caminhos acima e registrar em `public/assets/ui/manifest.json`.
2. Rodar `npm run check`, `npm test` e `npm run test:mobile:browser`.
3. Conferir 1536×864, 1280×720 e celular em paisagem (844×390): as silhuetas precisam ler bem a 30 px e as abas a 19 px.

## 4. Selos de aura repintados (opcional)

O círculo de aura (+5 verde, +9 roxo, +12 dourado) agora é desenhado em camadas por `drawAura` (`src/game/avatar.ts`): brilho de fundo, selo principal, cópia interna girando ao contrário a partir de +9, raios de luz no +12, anel pulsante, gemas orbitando e partículas subindo. Para subir a qualidade da pintura, gerar os três selos novos no mesmo formato e substituir `public/assets/ui/aura-{green,purple,gold}-sigil.png`.

Arquivos: 1024×1024, PNG transparente, centrado, ocupando 92% da imagem, simetria radial perfeita (o código gira a imagem).

```text
Single circular magic seal for a chibi browser artillery game character aura, 1024x1024, perfectly centered, transparent background, flat face-on view, radial symmetry with 8 main points. Two concentric thin glowing rings, an ornate band of curling filigree between them, eight sharp diamond-shaped spikes on the outer ring alternating long and short, tiny rune-like dots (no letters) evenly spaced, an open center (the inner 45% fully transparent so the character stays clear). Luminous neon line art with a bright white core and a saturated colored glow. COLOR: [emerald green #3ee87f | royal violet #b45cff | radiant gold #ffc93a]. Higher tiers more ornate: [simple | add a second inner star ring | add a third ring and small flame-like flares on every spike]. No text, no character, no background, no perspective, crisp edges.
```

## 5. Ícones pintados de anel, colar e bolha (atlas 4×1)

Hoje anel, colar e bolha usam ícones SVG em `ItemIcon.tsx`. Para pintá-los no padrão dos outros itens, gerar um atlas e trocar os cases `ring`, `necklace` e `bubble`.

Arquivo: `public/assets/items/jewelry-icons.png`, 1024×256 (células de 256×256), transparente.

```text
Sprite sheet, 4 cells of 256x256 in a row, transparent background, chunky glossy chibi game item icons, thick dark-brown outline, painted 3D look, soft top-left light, consistent size, centered with 10% padding. Cells: 1) gold ring with a glowing orange ember gem (Anel da Brasa), 2) silver ring with a teal sea-drop gem and tiny wave engraving (Anel da Maré), 3) golden chain necklace with a big shining star pendant and sparkles (Colar Estelar), 4) fluffy white-blue cloud speech bubble with three dots (Bolha Nuvem). No text, no background, no frames.
```
