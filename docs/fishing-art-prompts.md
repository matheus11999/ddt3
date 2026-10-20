# Prompts de arte da Pescaria

Arte gerada pelo Codex no PC do usuário (`codex exec` em `D:\APPS\ddt`, uma sessão de Remote Control por vez), anexando como referência as peças já aprovadas do lobby (`public/assets/lobby/parallax/source/*.png`, `public/assets/lobby/floor.webp`, um NPC do lobby e um ícone do menu `public/assets/ui/*-button.png`). Ícones, botão e animações abaixo ainda são desenho provisório em código (`docs/fishing.md`); cada arquivo, quando existir, substitui o provisório sozinho ou com o encaixe indicado.

Regras para todas as peças: nada de texto, letras ou números na imagem; nada vetorial, chapado ou "infantil"; nunca copiar arte do DDTank (só o nível de acabamento).

## BASE (colar no começo de todo prompt)

Pinte no estilo do jogo de navegador Brasa Arena, igual ao acabamento do DDTank: pintura 2D à mão, volume, luz vinda da direita, cores vivas e saturadas, contorno marrom-escuro suave, acabamento de jogo coreano/chinês, mesma paleta e mesma luz das imagens anexadas (Praça Celeste). Nada de texto, letras, números, placas escritas, marcas d'água ou interface. Nada de estilo vetorial, flat, pixel art ou 3D renderizado.

## Cenário

Não precisa de arte nova (pedido do matheus em 20/10: "faça o cenário mais bonito e condizente ao meu jogo, sem criar imagem"). O jardim em terraços é montado com peças que o jogo já tem, recortadas por `npm run build:fishing` (`scripts/build-fishing-props.mjs`), e pedra, água, madeira e cascata são desenhadas em código no mesmo tom (ver "Cenário" em `docs/fishing.md`).

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
