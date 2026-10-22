# DDTank: como cabelo, chapéu e roupa ficam compatíveis

Estudo de 21/10/2026 do laboratório local do matheus (`http://127.0.0.1:52463/?catalog=expanded`,
pasta `D:/APPS/ddt/output/ddtank-character-system/`, port em Canvas do cliente Flash 4.1).
Os PNGs em `assets/` são **referência de estudo**, baixados do laboratório; nunca copiar para `public/`.

## Arquivos desta pasta

- `raw/00-full.png`: página inteira. `raw/01..05`: mochila com e sem chapéu (masc. e fem. com rabo de cavalo),
  combate e cena social. `raw/10-panel-*.png`: cada painel da página (personalização, visor, galeria, guia, tabela de produção, prompt).
- `hair-AB-*.png`: cabelo B (sem chapéu) × A (com chapéu) × diferença, nas duas máscaras.
- `hat-over-hair-*.png`: cabelo B, cabelo A, chapéu (máscara 1 e 2), A + chapéu (como o jogo faz) e B + chapéu (o que daria errado).
- `game-AB-*.png`, `game-*-head5.png`: folhas de combate inteiras (13×3 células de 114×95).
- `assets/<sexo>-<categoria>-<Pic>/<máscara>/[A|B/]{game,show}.png`: os originais de 3 cabelos
  (`m/hair/default`, `m/hair/hair1`, `f/hair/hair1` rabo de cavalo) e 3 chapéus (`m/head/head1` boné, `m/head/head5` e `f/head/head5` chapéu de feiticeiro), todas as variações.

## Estrutura das pastas do DDTank

```
image/equip/{m|f}/{head|glass|hair|eff|cloth|face}/{Pic}/{máscara}/[A|B/]{game|show}.png
image/equip/f/suits/suits16/1/{game|show}.png      fantasia
image/arm/{Pic}/1/{0|1}/{game|show}.png              arma (0/1 = gunBack)
image/virtual/{M|F}/{face|hair|eff}/{Pic}/{máscara}.png        cena social (cabeça)
image/virtual/{M|F}/{clothF|cloth}/{clothPath}/{máscara}.png  cena social (corpo)
```

`head` = chapéu, `glass` = óculos, `eff` = efeito facial. **Só o cabelo tem a pasta A/B.**
`Pic` vem do catálogo (`default`, `hair1`, `head5`…). A pasta `{máscara}` vem do `Property8`
(string de índices, ex. `"12"` → pastas `1` e `2`; `"123"` → três).

## Contextos (folhas diferentes, mesmo espaço de coordenadas por contexto)

| Contexto | Uso | Folha | Célula |
|---|---|---|---|
| GAME | combate | 1482×285, 13×3 | 114×95 |
| SHOW | mochila, loja, salas | 250×342 no fonte (PNGs atuais 250×312) | 1 célula (rosto e fantasia 4) |
| VIRTUAL | cenas sociais | cabeça 360×175 (3 células); corpo 840×350 (7×2) | 120×175 |

Todas as peças de um contexto são pintadas **no mesmo quadro inteiro**, com margem transparente: nada de recortar
pelo contorno, nada de âncora por peça. Empilhar os PNGs na origem (0,0) já monta o boneco. Ex.: o chapéu de feiticeiro
ocupa x 3–209, y 17–152 dentro da célula 250×312; os cabelos A começam todos em y = 74.

## Camadas e ordem

- Combate: arma → rosto → cabelo → roupa → efeito facial → chapéu → óculos.
- Mochila: rosto (4 quadros, só ele anima: piscar) → cabelo → roupa → efeito → chapéu → óculos; arma escondida.
- Social: cabeça = rosto → cabelo → efeito; sem chapéu, óculos, arma nem fantasia.
- Fantasia substitui tudo (só arma + fantasia), mas os itens continuam equipados.
- Cada peça tem até 3 máscaras: a **1** é a pintura base (sempre visível); as outras só aparecem quando recebem cor.
  Rosto e roupa: máscara 2 = pele (cor da pele do jogador), 3 = cor da peça. Cabelo, chapéu, óculos, efeito: máscara 2 = cor.
  Tintura = troca o RGB da máscara mantendo o alfa e aplica por cima uma cópia com `hard-light` (porta do `BitmapUtils`).

## Como o chapéu esconde o cabelo (a resposta)

1. **Não há máscara de recorte.** O chapéu é só desenhado por cima do cabelo (ordem acima). Não existe "clip" do chapéu.
2. **Todo cabelo tem duas pinturas: A e B**, em todas as máscaras e em GAME e SHOW (8 PNGs por cabelo; o VIRTUAL não tem A/B).
   - **B** = cabelo inteiro, usado sem chapéu.
   - **A** = cabelo "achatado" para caber debaixo de chapéu: tudo acima de uma linha fixa da cabeça sai (topete, coque,
     rabo de cavalo alto), sobram franja e laterais, e o contorno é repintado no corte. Medido: A é praticamente um
     subconjunto de B (0 a 28 px só em A no SHOW; ~10% dos pixels em comum mudam, é o contorno novo). No rabo de cavalo
     feminino o A perde ~60% da pintura (o rabo some, ficam mechas laterais).
3. **Quem escolhe é o chapéu**, pelo campo `Property1` do item: `getHairType` → `Property1 == 1` usa **B**, qualquer outro valor usa **A**.
   No catálogo estudado: "Sem chapéu"/padrão (`Pic default`) tem `Property1 = 1` (cabelo B); todos os chapéus reais têm `0` (cabelo A).
   Esconder o chapéu (flag `Hide`) volta para o padrão, logo para o B.
4. Como todo cabelo A termina na mesma linha (y = 74 no SHOW) e todo chapéu cobre pelo menos até essa linha,
   **qualquer chapéu combina com qualquer cabelo** sem ajuste por par. Comparação em `hat-over-hair-*`: B + chapéu deixa
   cabelo vazando por cima e pelos lados; A + chapéu fica limpo.

## Roupa

A roupa não interage com cabelo nem chapéu: é outra camada no mesmo quadro (3 máscaras: base, pele, cor), pintada sobre o
mesmo molde de corpo. A compatibilidade vem só de todas as peças serem pintadas sobre o mesmo boneco-molde por contexto.
Na cena social a roupa equipada nem é usada (o cenário escolhe o corpo `cloth1`).

## Para o Brasa / Bomb Masters

- Para cada cabelo, gerar duas pinturas no mesmo molde: **cheia (B)** e **sob chapéu (A)**, com o corte numa linha fixa
  do crânio igual para todos os cabelos; chapéus cobrindo pelo menos até essa linha. Isso dispensa o recorte do cabelo pela
  folha `clip` do chapéu e resolve o rabo de cavalo sob chapéu (o artista decide o que sobra, em vez de um corte automático).
- Um campo por chapéu equivalente ao `Property1` (ex. `hairUnder: 'full' | 'capped'`) permite chapéus pequenos (tiara, laço)
  que deixam o cabelo cheio.
- Manter: todas as peças no quadro inteiro do contexto (sem recorte por contorno), máscaras de cor separadas, pele numa máscara própria.
