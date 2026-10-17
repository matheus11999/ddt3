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
