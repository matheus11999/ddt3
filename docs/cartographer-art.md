# Cartógrafo da Aurora — arte e registro

Conjunto masculino original: roupa completa `outfit-cartographer`, cabelo `hair-horizon` e óculos `glasses-navigator`. Pinturas geradas com a ferramenta de imagens integrada, em PNG RGBA 1254 × 1254, sem incorporar assets de terceiros. A arte de cabelo e roupa existente foi usada apenas como referência de acabamento e escala.

| Peça | Arquivo | Recorte alfa medido (x, y, largura, altura) |
| --- | --- | --- |
| Corpo em pé | `public/assets/outfits/cartographer-atlas.png` | `240, 8, 775, 904` |
| Corpo de combate | mesmo atlas | `101, 926, 1055, 317` |
| Pernas de caminhada, bloco esquerdo | `public/assets/outfits/cartographer-walk.png` | `47, 162, 713, 1009` |
| Pernas de caminhada, bloco direito | mesmo arquivo | `760, 185, 480, 985` |
| Cabelo descoberto | `public/assets/hair-horizon.png` | `270, 49, 753, 593` |
| Cabelo sob chapéu | mesmo arquivo | `312, 739, 698, 472` |
| Óculos | `public/assets/glasses-navigator.png` | `29, 483, 1197, 387` |

As coordenadas foram medidas nos PNGs finais por alfa > 20. Para o molde universal 1254, a proposta inicial de mapeamento do corpo parado é source `[240,8,775,904]` → destination `[340,610,542,630]`; a gola fica perto de `[650,610]` e a sola perto de `y1240`. Combate: `[101,926,1055,317]` → `[180,1018,650,195]`, com a gola perto de `[800,1033]`. O registro final deve ser aprovado no compositor, também em caminhada e espelhamento.

**Prompt da roupa:** pintar um corpo masculino chibi completo do pescoço aos pés e sua pose compacta de combate, no mesmo atlas transparente. Casaco de cartógrafo em safira com forro coral, fechos dourados, calça índigo e botas de couro cobre. Pose assimétrica: uma mão toca o mapa preso ao cinto e a outra fica na cintura. Sem cabeça, arma ou objetos soltos. Perspectiva 3/4 direita, pigmentos vivos, volume pintado e contorno quente controlado. Corpo deitado na faixa inferior, botas à esquerda e gola à direita. Sem pixel art ou fundo.

**Prompt das pernas:** duas pinturas transparentes da parte da cintura às botas correspondentes à mesma roupa, em fases opostas da passada. Preservar materiais do casaco, calça e botas do atlas; sem cabeça ou tronco.

**Prompt do cabelo:** duas versões do mesmo corte masculino na mesma imagem transparente: parte superior com franja diagonal e nuca curta, parte inferior com a copa naturalmente rebaixada sob chapéu, mantendo franja, têmporas e nuca. Cabelo azul-preto com realces cobalto; grande abertura transparente para o rosto universal. Sem rosto, pele ou chapéu. Não comprimir a arte descoberta no renderer.

**Prompt dos óculos:** um par em perspectiva 3/4 direita, lente próxima maior à esquerda e lente distante menor à direita; armação fina de cobre com esmalte safira e hastes curtas, lentes azul-claro. Pintura dimensional, sem rosto ou fundo. Centros ópticos iniciais estimados no atlas: `(640,679)` e `(1094,704)`; alinhar aos sockets universais `(650,444)` e `(798,466)`. A montagem deve confirmar que a expressão continua legível através das lentes.

Os itens são cosméticos da loja e não são concedidos automaticamente. A roupa não muda o formato da cabeça; a versão de cabelo sob chapéu é um recurso pintado separado. Atributos, preço e compatibilidade são definidos no catálogo e validados pelo servidor.
