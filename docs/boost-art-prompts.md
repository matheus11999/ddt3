# Power-ups de combate — referência de setas e POWER

A revisão atual segue a referência enviada pelo usuário: setas com **+1/+2/×3** e símbolos de dano com **POWER e porcentagem em destaque**. Os símbolos têm volume 3D ilustrado, faces espessas, reflexos e cores vivas. Os números são texto real da interface para permanecer legíveis no tamanho dos botões.

## Asset e integração

Arquivo ativo: `public/assets/ui/boost-arrows-power.png`. PNG RGBA **1774×887**, proporção **2:1**, quatro colunas por duas linhas. Células proporcionais de **443,5×443,5px**; a oitava está vazia. Imagem copiada diretamente da ferramenta, sem pós-processamento da pintura.

| Slot | ID | Arte e texto do botão |
| --- | --- | --- |
| 0 | `extra1` | Seta laranja/dourada em relevo, **+1** |
| 1 | `extra2` | Setas rubi/laranja, **+2** |
| 2 | `trident` | Leque de três setas safira, **×3** |
| 3 | `damage50` | Explosão dourada com chama/raio, **POWER 50%** |
| 4 | `damage40` | Explosão dourada, **POWER 40%** |
| 5 | `damage30` | Explosão dourada, **POWER 30%** |
| 6 | `damage20` | Estrela dourada, **POWER 20%** |
| 7 | — | Transparente |

O atlas contém só a base ilustrada. `BattleHud.tsx` monta a arte com o texto: porcentagem vermelha grande, contorno claro e sombra de relevo; POWER dourado acima. Não apresentar a prancha sem texto como o botão final. As porcentagens vêm de `BOOSTS.label`; multiplicadores usam os mesmos bônus existentes. A tecla permanece no canto superior direito e o custo de vigor no tooltip e nome acessível. Nenhum bônus ou custo do servidor foi alterado.

CSS usa `background-size:400% 200%`, posições horizontais `0%,33.333333%,66.666667%,100%` e verticais `0%,100%`; elemento quadrado. Encaixes têm relevo, cor coordenada e feedback de hover/foco/pressão. Indisponíveis escurecem preservando a cor; seleção recebe borda dourada e confirmação no canto superior esquerdo. Movimento reduzido desativa transições.

## Verificação

RGBA, proporção e sete células verificadas por leitura do PNG (alfa >16 ignora resíduos quase transparentes). Capturas reais da HUD, dos mapas Parque/Fortaleza e do layout compacto ficam em `test-results/screenshots/`, ignorado pelo Git. Inspeção em1536×864/DPR2 confirmou POWER inteiro, +1/+2/×3 e todas as porcentagens, sem sobreposição com atalhos. Clique, tecla3, seleção e indisponibilidade por vigor foram exercitados; zero erros de JavaScript/servidor. Verificação compacta em640×960.

`npm run check`, 76 testes unitários, build e `git diff --check` passaram nesta revisão. Frontend de produção recompilado: HTML e SHA256 do atlas servido conferem com os arquivos locais. Capturas finais usam sufixo `reference-final`.

## Prompt exato

```text
Redesign the seven power-up icon ART assets for our fantasy artillery game, following the compact DDTank-like action-symbol language in the user's newly attached screenshot: upward diagonal ARROWS for extra shots, BLUE SPREAD ARROWS for three-way fire, and golden POWER energy emblems behind percentage labels. Preserve recognizability of that reference while making original art with much stronger rounded 3D volume, jewel colors, glossy beveled edges. DO NOT make rockets, swords, fists, meteors or crescent blades.

Deliver a clean TRANSPARENT RGBA PNG sprite atlas, exact landscape 2:1 aspect ratio, four equal square columns by two equal square rows. Seven symbols centered in the first seven cells in reading order; the bottom-right eighth cell entirely empty. Ideally 2048x1024. Each icon must have generous transparent margins 12% on EVERY edge. Never cross the cell border. No square plates, no tile frame or background, no checkerboard. No words, letters or numerals anywhere: the game will place crisp +1/+2/×3 and POWER 50%/40%/30%/20% labels on top with live text, so these are ONLY the underlying illustrations.

Use commercially polished chunky 3D fantasy GAME ICONS: broad colored faces, thick extrusion clearly visible on the lower-right, glossy gem/glazed enamel material, bright cream key light upper-left, dark saturated undersides, crisp cream and gold bevels, light hand-painted finishing to fit a painted chibi world. High contrast vivid scarlet, tangerine orange, electric sapphire blue, and polished warm gold. Light contained glow. No pastel, no muted colors, no fine clutter. All icon silhouettes must be instantly readable at 45px.

Exact order and composition:
row1 column1 EXTRA ONE: one thick zigzag lightning-shaped ARROW pointing upper right, large beveled orange face, bright golden yellow edge, ruby-red extruded side, short small orange motion wedge behind it. Lower-right quadrant intentionally spare for the game's +1 label. This must resemble a substantial rising zigzag ARROW, not a rocket or sword.
row1 column2 EXTRA TWO: a large thick scarlet-red rising zigzag ARROW pointing upper right with a smaller parallel orange arrow behind it, glowing golden white rounded bevel, deep ruby-red sides. Lower-right quadrant spare for +2 label. Compact two-layer silhouette.
row1 column3 SPREAD: three thick SAPPHIRE BLUE arrowheads fanning up-left, up, upper-right from one compact cyan lower junction. Icy blue bevels and deep cobalt 3D extrusion, small radiant turquoise energy at center. Lower-right quadrant spare for ×3 label. Recognizably a blue three-way split arrow.
row1 column4 DAMAGE50 base emblem: a substantial rounded GOLD eight-point power explosion star, warm orange inset and small bright golden lightning shard at top center, deep amber thickness, two short red-orange flame curls at upper sides; wide open simple center for POWER at top and 50% below to be overlaid. The silhouette belongs behind typography, not an unrelated object.
row2 column1 DAMAGE40 base emblem: rounded GOLD seven-point power explosion star, rich amber inset, glowing cream golden upper edges, deep orange extruded sides. Clear simple center for typography. Slightly calmer than50.
row2 column2 DAMAGE30 base emblem: rounded GOLD six-point power explosion star, rich amber inset, cream golden upper edges, deep orange extruded sides. Clear simple center for typography.
row2 column3 DAMAGE20 base emblem: compact rounded GOLD five-point power explosion star, rich amber inset, cream golden upper edges, deep orange extruded sides. Clear simple center for typography.
row2 column4 EMPTY fully transparent.

Make these a unified kit of diagonal colorful extra-shot arrows and chunky gold power emblems. The screenshot is a style/layout reference, not to be copied as a pixel crop. Do NOT reproduce the surrounding HUD or map. Artwork only on transparency, absolutely no numerals or text.
```
