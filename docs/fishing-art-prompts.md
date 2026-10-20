# Prompts de arte da Pescaria

Arte gerada pelo Codex no PC do usuário (`codex exec` em `D:\APPS\ddt`, uma sessão de Remote Control por vez), anexando como referência as peças já aprovadas do lobby (`public/assets/lobby/parallax/source/*.png`, `public/assets/lobby/floor.webp`, um NPC do lobby e um ícone do menu `public/assets/ui/*-button.png`). Hoje a Pescaria usa as camadas da praça e desenhos provisórios em código (`docs/fishing.md`); cada arquivo abaixo, quando existir, substitui o provisório sozinho ou com o encaixe indicado.

Regras para todas as peças: nada de texto, letras ou números na imagem; nada vetorial, chapado ou "infantil"; nunca copiar arte do DDTank (só o nível de acabamento).

## BASE (colar no começo de todo prompt)

Pinte no estilo do jogo de navegador Brasa Arena, igual ao acabamento do DDTank: pintura 2D à mão, volume, luz vinda da direita, cores vivas e saturadas, contorno marrom-escuro suave, acabamento de jogo coreano/chinês, mesma paleta e mesma luz das imagens anexadas (Praça Celeste). Nada de texto, letras, números, placas escritas, marcas d'água ou interface. Nada de estilo vetorial, flat, pixel art ou 3D renderizado.

## 1. Cenário de fundo (parallax), `public/assets/fishing/parallax/source/`

Mesmas regras e tamanhos das pranchas do lobby (ver "Parallax" em `docs/lobby-art-prompts.md`): pranchas largas sobre magenta #FF00FF para as camadas recortadas, céu em duas metades que emendam só no céu. Depois de salvar, troque `source` e os nomes em `scripts/fishing-layout.json` e rode `npm run build:lobby -- --layout=scripts/fishing-layout.json` (a montagem sai em `test-results/fishing-parallax/`).

- `01-ceu-esquerda.png` / `02-ceu-direita.png` — BASE + Céu de fim de tarde dourado sobre um vale de lagos, nuvens grandes e fofas com borda rosada, ao longe montanhas azuladas com cachoeiras finas e ilhas flutuantes pequenas (como as da praça). A linha do horizonte a 62% da altura. As duas metades emendam só no céu e na névoa (nada cortado na emenda).
- `03-longe.png` — BASE + Prancha sobre magenta com 5 peças separadas por 80 px: colinas verdes distantes com bosques, um moinho de água, uma ponte de pedra em arco sobre um rio, um vilarejo de pescadores com telhados vermelhos, um farol pequeno. Tudo com névoa azulada (está longe).
- `04-meio.png` — BASE + Prancha sobre magenta com 5 peças: salgueiros-chorões grandes, um bambuzal, uma cabana de palafita, um barco a remo virado na margem com redes secando, um varal de peixes secando entre dois postes.
- `05-perto.png` — BASE + Prancha sobre magenta com 6 peças para a frente do caminho: moitas de juncos e taboas, tufos de flores azuis e amarelas, cerca baixa de madeira com cordas, cestos de vime com peixes, lanternas de papel penduradas em poste, pedras com musgo.

## 2. Casa de Pesca, `public/assets/fishing/house.png`

BASE + Uma casa de pesca de madeira de dois andares, vista de frente levemente de três-quartos, sobre fundo transparente (ou magenta #FF00FF para recorte), cerca de 760 x 520 px, pés da construção na borda de baixo e centralizados. Telhado de telhas azul-petróleo com chaminé soltando um fio de fumaça, varanda com balcão de vender (vazio, sem placa escrita), redes de pesca, boias coloridas, varas encostadas, um peixe grande de madeira pendurado como enfeite, lanternas quentes acesas, barris e caixotes na frente. Detalhada e aconchegante. Sem personagens. O jogo desenha o nome "Casa de Pesca" por cima.

## 3. Portão de volta, `public/assets/fishing/gate.png`

BASE + Um arco de madeira com cordas e boias penduradas, fundo transparente (ou magenta), cerca de 260 x 300 px, pés na borda de baixo. No alto do arco um medalhão redondo em branco (o jogo escreve o destino "Praça Celeste"). Trepadeira com flores subindo pelas colunas.

## 4. Gramado, lagos e píeres, `public/assets/fishing/ground/`

- `meadow.png` — BASE + Textura de gramado visto de cima em leve perspectiva, 2048 x 320 px, emendável na horizontal (a borda esquerda continua a direita), com trilha de terra batida clara correndo na faixa de cima, flores pequenas espalhadas e tufos de grama mais escura. Sem objetos grandes.
- `lake.png` — BASE + Um lago oval visto em perspectiva baixa, 1100 x 200 px, fundo transparente, margem de pedras arredondadas e terra úmida, água azul-esverdeada com reflexo do céu e ondulações suaves, ninfeias e flores de lótus rosadas nas bordas. O centro da água sem objetos (o jogo desenha boias e peixes ali).
- `pier.png` — BASE + Um píer de tábuas de madeira visto de cima em perspectiva, 80 x 160 px, fundo transparente, estacas grossas aparecendo embaixo, cordas amarradas nas estacas da ponta.

Encaixe: hoje gramado, lagos e píeres são desenhados em `src/game/fishingWorld.ts`; quando os PNGs existirem, trocar o desenho pela imagem esticada à elipse de cada lago e ao retângulo de cada píer (`FISHING_LAKES`, `FISHING_PIERS`).

## 5. Ícones, `public/assets/fishing/icons/<id>.png`

Cada ícone 256 x 256 px, fundo transparente, objeto centralizado ocupando ~80% do quadro, mesmo ângulo e mesma luz em todos, para ficarem juntos na Coleção. O jogo já troca o desenho provisório pelo PNG quando o arquivo existe (`src/components/FishingIcon.tsx`). Gerar em pranchas de 4 sobre magenta e recortar, sempre anexando os ícones já aprovados.

BASE + Ícone de item de jogo, peixe de lado olhando para a esquerda, corpo com volume, escamas pintadas, olho grande e brilhante, brilho branco no topo, contorno marrom-escuro:

- `bota-velha` — bota de couro velha e encharcada, com uma alga pendurada.
- `lambari-dourado` — peixinho fino e prateado com reflexos dourados.
- `tilapia-rosada` — tilápia alta e arredondada, rosa-salmão com listras suaves.
- `carpa-lua` — carpa prateada-perolada com escamas grandes que brilham como luar.
- `baiacu-bolha` — baiacu verde-limão meio inflado, com espinhos curtos.
- `koi-celeste` — carpa koi laranja e branca com manchas azul-celeste e barbatanas longas.
- `bagre-barbudo` — bagre marrom-oliva com bigodes longos.
- `tucunare-brasa` — tucunaré amarelo-alaranjado com faixas escuras e olho-de-fogo na cauda.
- `enguia-trovao` — enguia azul-elétrica com faíscas pintadas na pele (sem raios soltos fora do corpo).
- `pirarucu-ancestral` — pirarucu enorme com escamas vermelho-sangue na metade de trás.
- `peixe-vidro` — peixe translúcido azul-claro, dá para ver a espinha.
- `truta-aurora` — truta com faixa lateral em degradê roxo-rosa-verde como aurora.
- `dourado-real` — dourado amarelo-ouro com nadadeiras alaranjadas e ar nobre.
- `carpa-dragao` — carpa vermelha e dourada com barbatanas em forma de chama e pequenos bigodes de dragão.
- `rod-bamboo` — vara de bambu simples com carretilha pequena de madeira e linha enrolada.
- `rod-oak` — vara de carvalho envernizada com detalhes de latão e carretilha dourada.
- `bait-simple` — minhoca rosada enrolada.
- `bait-glow` — isca em forma de bolinha que brilha em azul-turquesa, com anzol.
- `fishing-points` — moeda de Pontos de Pesca: moeda de bronze-azulado com um peixe em relevo (sem número).

## 6. Botão do menu, `public/assets/ui/fishing-button.png`

BASE + Ícone de botão do menu da praça, 128 x 128 px, fundo transparente, no mesmo estilo e tamanho visual dos botões anexados (`public/assets/ui/*-button.png`): uma vara de pescar curvada com um peixe dourado pulando preso na linha, sobre um balde de madeira. Depois de salvar, trocar o `icon` do item `fishing` em `src/components/Hud.tsx` por `art:'fishing-button.png'`.

## 7. Animações de pesca (pranchas de quadros)

Pintar sobre o molde do personagem (`docs/templates/`, mesmo boneco cinza de cabeça verde do combate) para que qualquer roupa encaixe; a vara e a linha são da Vara de Bambu (a Vara de Carvalho troca só a cor da vara). Cada prancha 6 quadros lado a lado de 256 x 256 px sobre magenta, pés no mesmo ponto em todos os quadros.

- `public/assets/fishing/anim/cast.png` — lançar: segura a vara atrás do ombro, gira o braço para frente e solta a linha.
- `public/assets/fishing/anim/wait.png` — esperando: vara apoiada, leve balanço da respiração (4 quadros bastam).
- `public/assets/fishing/anim/hooked.png` — fisgou: o corpo é puxado para frente, vara curvada para baixo, pés firmes.
- `public/assets/fishing/anim/success.png` — sucesso: levanta a vara com força para trás, a linha sobe; o peixe é desenhado pelo jogo na ponta da linha.
- `public/assets/fishing/anim/fail.png` — escapou: a vara volta reta de repente, o personagem cambaleia para trás com a linha frouxa.
- `public/assets/fishing/anim/splash.png` — respingo de água na boia (6 quadros, 256 x 128, sem personagem): ondinha, gotas subindo e caindo.

Encaixe: hoje `drawGear` em `src/game/fishingWorld.ts` desenha vara, linha, boia e o peixe em código para cada fase (`FishingPose`). Quando as pranchas existirem, montar um atlas como o do combate (`scripts/build-combat-atlas.py`) e desenhar o quadro da fase no lugar do braço e da vara, mantendo a boia e o peixe em código.
