# Briefs de arte para o rig v1

Peças que o `npm run verify:cosmetics` reprova e que só se corrigem repintando. O código já foi ajustado no que dependia dele (assento único dos chapéus, óculos por cima da franja, tintura em todos os cabelos). Cada arte nova é aprovada quando sai do relatório **e** passa pela inspeção visual do usuário.

Molde de referência para gerar ou pintar: `docs/templates/<classe>.png` (gerado por `node scripts/make-cosmetic-templates.mjs`). Verde é a zona máxima, vermelho são olhos e boca que nada cobre, laranja é o assento do chapéu ou o centro das lentes.

## Formato de entrega (vale para toda peça nova)

- PNG RGBA 1254×1254 pintado **diretamente sobre o molde**, na mesma perspectiva 3/4 olhando para a direita e na mesma escala. Assim o pin é a identidade (`onTemplate`) e não há medida a ajustar.
- Camadas separadas no mesmo quadro: `back.png` (atrás da cabeça: nuca, rabo, parte traseira da copa) e `front.png` (franja, têmporas, copa visível e aba). Chapéus entregam também `opening.png`, máscara branca da abertura interna onde o cabelo pode aparecer.
- Cabelo entrega as variantes por perfil: aberto, faixa, justo, aba larga e elmo (ou declara qual reaproveita).
- 24 px de margem transparente até a borda. Peças mais altas que o quadro (chapéu cônico) vão para um atlas com pin no assento universal.
- Sem cabeça, rosto, pescoço, texto, fundo ou sombra no chão dentro do PNG. Preservar o prompt e o original gerado em `docs/shop-cosmetics-prompts.md`.

## Peças a repintar

Cabelo Aventureiro, Lunar, Elmo do Guardião, Óculos de Voo e Óculos Redondos/Piloto foram retirados do catálogo na versão do Codex (17/10/2026) e saíram do manifesto.

| Peça | Medida atual | Meta | O que mudar |
| --- | --- | --- | --- |
| Corte Horizonte | 1,61×; 0,37×; franja toca o olho (76 px) | ≤1,45×; ≤0,30× | Reduzir volume lateral e topete; franja acima da sobrancelha |
| Corte Tempestade | 1,56×; 0,40× | ≤1,45×; ≤0,30× | Topete mais baixo, laterais raspadas mais justas; não cobrir o olho |
| Rabo de Cavalo Rubi | 1,71×; 0,41×; cobre olhos (1.895 px) | ≤1,55×; ≤0,30× | Rabo vai para `back.png`, atrás do pescoço; franja abre sobre os olhos |
| Cabelo Ondulado | desce 10 px além; franja sobre olhos | até y=640 | Encurtar 10 px na nuca; afastar mecha da franja do olho próximo |
| Cabelos cobertos (Ondulado e Rabo) | franja sobre olhos sob bonés (até 2.178 px) | 0 px nos olhos | Repintar a franja das variantes cobertas acima dos olhos |
| Chapéu Astral | aba desce até y=492 | até y=470 | Aba menos caída na frente; manter o cone |
| Boné Relâmpago | aba cobre 31–38% da frente dos óculos | ≤30% | Aba 15–20 px mais alta ou mais curta |
| Óculos Gatinho | 0,99× a cabeça | 0,80–0,95× | Estreitar as pontas do gatinho; manter o centro das lentes |

As roupas (Executivo e Dançarina com tronco 0,77–0,78× a cabeça) ficam para a fase 4.

## Prompt-base por slot

Usar o molde da classe como imagem de referência, junto com a arte atual da peça quando for repintura.

### Cabelo

```text
Pintar SOMENTE o cabelo [NOME E DESCRIÇÃO] sobre a cabeça-molde fornecida do jogo, no mesmo canvas 1254×1254, mesma posição, escala e perspectiva três quartos para a direita. O cabelo deve caber inteiro dentro do retângulo verde do molde: largura máxima [1,45|1,55]× a cabeça e no máximo 0,30× acima do topo do crânio. Franja termina acima da linha azul da sobrancelha e nunca cobre as áreas vermelhas dos olhos e da boca. Seguir o contorno do crânio, sem flutuar acima dele. Pintura chibi refinada, contorno castanho, volume e brilho de mechas, cores vivas e saturadas, iluminação superior esquerda. Entregar duas camadas em PNG RGBA com transparência real: traseira (nuca e mechas atrás da cabeça) e frontal (franja e têmporas). Sem rosto, pele, chapéu, texto, fundo ou guias do molde.
```

### Chapéu

```text
Pintar SOMENTE o chapéu [NOME E DESCRIÇÃO] vestido na cabeça-molde fornecida, mesmo canvas 1254×1254, mesma posição, escala e perspectiva três quartos para a direita. A faixa interna apoia exatamente na linha laranja de assento do molde e envolve o crânio, com a abertura dimensionada pela cabeça e não pela aba. Caber dentro do retângulo verde; a aba não desce abaixo da borda inferior verde e não cobre as áreas vermelhas dos olhos. Pintura chibi refinada, volume espesso, materiais bem definidos, cores vivas. Entregar em PNG RGBA: camada traseira (parte de trás da copa), camada frontal (copa visível e aba) e máscara branca da abertura interna. Sem cabeça, cabelo, texto, fundo ou guias.
```

### Óculos

```text
Pintar SOMENTE os óculos [NOME E DESCRIÇÃO] na cabeça-molde fornecida, mesmo canvas 1254×1254, perspectiva três quartos para a direita. O centro óptico de cada lente fica exatamente sobre os pontos laranja dos olhos; a lente distante é menor pela perspectiva. Largura total entre 0,80× e 0,95× a cabeça (dentro do retângulo verde), haste passando por trás da orelha. Lentes translúcidas que deixam os olhos visíveis. Pintura chibi refinada, contorno consistente, cores vivas. PNG RGBA com transparência real, sem rosto, texto, fundo ou guias.
```
