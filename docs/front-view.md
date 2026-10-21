# Vista de frente (21/10/2026)

Pedido do matheus: fora da batalha (mochila, salas, loja, informações, lobby, pescaria, pódio, retrato do HUD) o boneco aparece em **3/4 de frente**, como o retrato da mochila do DDTank (`test-results/references/ddtank-bag-angle-*.png`): a orelha de perto aparece e o olho de trás fica menor. **A batalha continua de lado**, e também o retrato da batalha, a tela de carregamento e o cut-in do poder (`view="side"`).

## Como funciona

- `src/game/front.ts` desenha a vista de frente. Um visual só aparece de frente quando **todas** as peças visíveis têm arte de frente (`hasFrontView`); senão o jogo desenha a vista de lado como antes. Hoje isso vale para o kit inicial: rosto, cabelo e roupa básicos (slot vazio) e o Boné Inicial.
- Cabeça universal de frente: `public/assets/front/face-basic-*.png` (molde de 1254 px; topo do crânio em (634,182), crânio com 417 px de largura, a mesma da cabeça de lado; ponta do pescoço em (583,627)). Os rostos também trazem a cabeça.
- Cabelos e chapéus: `public/assets/front/<id>.png`, encaixe em `src/game/rig/frontFit.json` (`[escala em volta do topo do crânio, dx, dy]`). Cabelo comprido é desenhado atrás e na frente da cabeça; com chapéu, nada do cabelo aparece acima da borda de baixo do chapéu.
- Roupas: a pintura com pose das prévias (`stand`) e as folhas do lobby (`idle`, `walk`, 3×2 quadros de 512 px), todas em `src/game/frontAtlas.json`. As mãos têm dedos; só o combate usa o punho redondo.
- Medidas em unidades do boneco: corpo de 80 da gola aos pés, cabeça de 72 do topo ao pescoço.

## Fazer uma peça nova de frente

1. Prompts do Codex: `node scripts/front-kit-prompts.mjs --only=<peça> --run` (cabeça, rostos, cabelos, chapéu, `stand-*`, `walk-*`, `idle-*`). Os prompts anexam o molde com guias `docs/templates/front-head.png` e as referências de ângulo do DDTank.
2. Roupa: `py scripts/build-front-sheets.py stand|walk|idle <roupa> <imagem>` (o andar e o parado usam o molde `docs/templates/front-walk.png`, gerado por `scripts/make-front-walk-template.py`).
3. Validar: `npm run verify:front -- --fit=<id>` acha o encaixe e grava em `frontFit.json`; `npm run verify:front` (sempre) gera para aprovação `test-results/front/pieces.png` (peça na cabeça, olhos e boca em vermelho, topo das orelhas em azul), `figures.png` (figura inteira com e sem chapéu), `sheets.png` (cada quadro do lobby com a cabeça e o chão) e `report.md`.
4. A peça continua precisando da arte de lado para a batalha (fluxo de `docs/cosmetics-pipeline.md`).
5. Cadastrar a peça em `front.ts` (rostos em `FACES`, cabelo comprido em `LONG_HAIR`) e em `scripts/verify-front.py`.
