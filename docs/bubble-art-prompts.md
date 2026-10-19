# Prompts das Bolhas pintadas

Cada Bolha rara tem uma prancha pintada pelo Codex no PC do usuário (`codex exec`, imagem 1536x1024 sobre magenta) em `public/assets/ui/bubbles/<id>-sheet.png`. O prompt é o texto BASE mais o texto da Bolha. Depois de salvar a prancha: `python3 scripts/build-bubble-art.py <id>` recorta o corpo esticável (9 fatias) e atualiza `src/game/bubbleArt.json`. O rabicho pintado fica só como referência de cor: o jogo desenha a ponta curva e suave nas cores do estilo (`BUBBLE_STYLES`), para ela poder virar na direção de quem fala.

## BASE

Pinte UMA prancha 1536x1024 para um cosmético "balão de fala" de um jogo de navegador no estilo DDTank (pintado à mão, volume, cores vivas, contorno marrom-escuro, acabamento de jogo coreano/chinês 2D, nada vetorial nem chapado).
Fundo inteiro magenta puro #FF00FF, sem sombra, sem brilho e sem nenhum pixel magenta dentro das peças.
Duas peças separadas por pelo menos 80 px de magenta:
(A) CORPO do balão, centralizado na metade de cima, cerca de 1100x500 px: retângulo de cantos bem arredondados com moldura decorada. Os ornamentos ficam SÓ nos quatro cantos (cerca de 150 px de cada canto); o trecho reto do meio de cada lado é liso e igual em todo o comprimento, porque o jogo estica esse trecho. Miolo liso e claro, de uma cor só (o jogo escreve o texto em cima), sem textura, sem desenho e sem degradê forte.
(B) RABICHO do balão, embaixo, cerca de 220x200 px: ponta triangular arredondada apontando para baixo, com a mesma moldura e o mesmo miolo; a borda de cima é reta e aberta, para encaixar embaixo do corpo.
Nada de texto, letras, números, pontos de reticência, personagens ou carinhas. Não desenhe partículas soltas (o jogo anima os efeitos).

## bubble-classic

Bolha Clássica (comum, kit inicial): balão de quadrinho clássico, miolo creme quase branco #FFFDF4, moldura marrom-escura grossa com leve volume (realce claro em cima, sombra suave embaixo), cantos simples sem ornamento, só um brilho pintado no canto de cima à esquerda.

## bubble-cloud

Bolha Nuvem (incomum): balão em forma de nuvem fofinha, borda toda em gomos arredondados de nuvem com sombra azul-clara pintada, contorno azul-marinho suave, miolo branco-azulado #F4FAFF. Os cantos têm gomos maiores; o meio de cada lado tem gomos pequenos e iguais. O rabicho são três bolinhas de nuvem em fila, da maior para a menor, ligadas.

## bubble-dragon

Bolha do Dragão (lendária, tema do Dragão Ancestral esmeralda): moldura de escamas verde-esmeralda com bordas douradas, cantos de cima com pequenos chifres curvos de dragão e cantos de baixo com garras douradas segurando o balão, contorno verde-escuro quase preto, miolo creme esverdeado bem claro #F4FFF0.

## bubble-ember

Bolha Brasa (rara): moldura de madeira carbonizada com rachaduras de brasa laranja brilhando por dentro, cantos com pequenas pedras de carvão incandescente e chamas curtas pintadas presas ao canto, contorno marrom-quase-preto, miolo creme quente #FFF2DC. Brilho laranja suave só na moldura.

## bubble-royal

Bolha Real (épica): moldura de ouro polido com filigrana nos cantos e uma pedra vermelha lapidada em cada canto, borda dupla dourada no meio dos lados, contorno marrom-escuro, miolo pergaminho claro #FFF8E6. Ouro com reflexos fortes e volume metálico.

## bubble-starlight

Bolha Estelar (lendária): moldura de cristal azul-arroxeado translúcido com reflexos ciano, cantos com aglomerados de cristais pontudos e uma estrela dourada de quatro pontas brilhando em cada canto, contorno azul-marinho, miolo lavanda bem claro #F6F2FF.
