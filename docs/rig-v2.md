# Rig v2: montagem do personagem como no DDTank (plano, 21/10/2026)

Pedido do matheus: refazer o sistema de rig do zero, aprendendo com o estudo do cliente DDTank 4.1
(`D:/APPS/ddt/output/ddtank-character-system/`, `GUIA.txt`, `PROMPT.txt`, `engine.js`, `manifest.json`, fontes AS3 em
`sources/`). Os PNGs do DDTank são só referência: toda a arte nova é nossa, pintada pelo Codex.

## O que o DDTank faz (e o nosso rig atual não)

| | DDTank | Brasa/Bomb Masters hoje |
| --- | --- | --- |
| Contextos | Três montadores com folhas próprias: GAME (combate), SHOW (mochila, loja, salas), VIRTUAL (cenas sociais, frente e costas) | Uma pintura em pé + folhas de andar/parado + 12 poses de combate, com cabeça universal colada por cima |
| Peças | Cada peça (rosto, cabelo, roupa, chapéu, óculos, efeito) é pintada **em cada quadro**, no mesmo espaço de coordenadas da célula, com margens transparentes | Cabelo, chapéu e óculos são uma imagem só, encaixada por pino (mover/girar/escalar) sobre a cabeça; não acompanham a pose |
| Encaixe | Nenhum: as camadas são empilhadas célula com célula | Pinos, validador de zonas, recortes de orelha, cabelo "coberto" |
| Animação | Sequências de índices por ação (com repetições, `repeat`, `stopAtEnd`, `replaceSame`) | Trocas por distância andada e poses avulsas |
| Cabelo sob chapéu | Variante pintada A/B escolhida pelo chapéu (`Property1`) | Cabelo cortado por código |
| Cor | Máscaras por peça; tintura = ColorTransform + realce HARDLIGHT; pele comum na máscara 2 de rosto e roupa | Recolor por faixa de matiz |

## Contratos propostos (grade única, 2× o DDTank)

Toda a arte nova numa grade só, o dobro da do DDTank (escala inteira; nada de auto-encaixe por bounding box):

| Contexto | Uso no jogo | Célula | Folha por peça | Ordem de pintura |
| --- | --- | --- | --- | --- |
| GAME | Batalha | 228 × 190, origem do boneco em (124,166) | 13 × 3 = 2964 × 570 (39 células) | arma → rosto → cabelo → roupa → efeito → chapéu → óculos |
| SHOW | Mochila, loja, salas, informações, pódio | 500 × 684 | rosto 4 células (piscar); demais 1 célula | rosto → cabelo → roupa → efeito → chapéu → óculos |
| VIRTUAL | Praça e Pescaria | cabeça 240 × 350 (3: frente, olhos fechados, costas); corpo 240 × 350, 7 × 2 (frente/costas) | cabeça 720 × 350; corpo 1680 × 700 | frente: cabeça → corpo; costas: corpo → cabeça |

- Ações do combate com as sequências verificadas do `manifest.combat.actions` (STAND, WALK, SHOWGUN, SHOT, SHOWTHROWS, THROWS, HANDCLIP, HIT, CRY…), mesmo número de células e índices. A física e a hitbox continuam como estão.
- Mochila: `NORMAL_STANDBY` (piscar) e opção de quadro 0 fixo.
- Praça/Pescaria: `naturalStandFront`, `naturalWalkFront`, `naturalStandBack`, `naturalWalkBack`, com os deslocamentos de cabeça `[0,0,-1,2,0,-1,2]`. **Extensão nossa, deliberada:** o DDTank não mostra chapéu e óculos na igreja; como o jogo quer a personalização na praça, chapéu e óculos ganham também folha VIRTUAL (cabeça).

## Como a arte é feita

- Para cada contexto, um **molde** (boneco cinza por quadro, cabeça como silhueta) na grade acima; o Codex pinta cada peça sobre o molde, sempre o molde inteiro, e o montador corta as células sem mexer em posição nem escala.
- Validador novo: mesma peça em todos os quadros e contextos numa prancha (aprovação), alinhamento com o molde por quadro, margem transparente preservada, cor igual entre contextos.
- Orçamento por peça (máscaras base/cor; o cabelo tem A e B): rosto 9 PNG, cabelo 10, roupa 6, chapéu 4 (+2 VIRTUAL), óculos 4 (+2 VIRTUAL), efeito 6, corpo social 6 por roupa.

## Etapas

1. Moldes dos três contextos e o montador isolado (prancha com o boneco cinza em todas as ações).
2. Piloto: kit inicial masculino (rosto, cabelo A/B, roupa, boné) nos três contextos; prancha para aprovação.
3. Kit feminino.
4. Ligar no jogo: batalha (GAME), mochila/loja/salas (SHOW), praça/Pescaria (VIRTUAL). Substitui o rig atual e a vista de frente provisória (`src/game/front.ts`).
5. Apagar os cosméticos antigos e migrar quem os tinha para o kit inicial.

## Peças de cabeça pintadas uma vez (21-22/10, aprovado pelo matheus)

Medido no molde: a cabeça do combate é a mesma em 30 das 33 células, só movida e girada (as outras são o choro, igual com lágrimas, e o fantasma, menor). Pintar a cabeça em cada célula fazia cada cabeça sair diferente e o encaixe quebrar. Desde 22/10:

- **Grade 4× o DDTank** (era 2×; o matheus achou baixa resolução): combate 456 × 380, mochila 1000 × 1368, praça 480 × 700. O boneco da mochila e o da praça têm a altura do boneco de frente antigo.
- **Cabeça inteira pintada uma vez**: rosto, cabelo A, cabelo B (sob chapéu), chapéu e óculos numa placa de cabeça 1536 × 1024 (frente 3/4 grande à esquerda, lado em cima à direita, costas embaixo à direita). O rosto tem ainda a placa de expressões de lado (fechado, riso, dor, choro, surpresa, fantasma) e a de piscar de frente. `scripts/rig/headplate.py` (`make`, `face`, `bake`) recoloca cada placa sobre o molde (recusa rosto que não preenche a cabeça ou que mudou), recorta a peça e grava as folhas de combate, mochila e praça com a transformação de cada célula (`scripts/rig/headfit-<sexo>.json`, medida do molde por `measure`). O jogo continua só empilhando folhas.
- **Corpo por célula** (roupa): `scripts/rig/check-cells.py <contexto> <sexo> <folha> [--fix]` confere cada célula contra o molde e diz qual placa refazer. A praça usa placas só de frente (1 a 3) ou só de costas (4 a 6): misturadas, o Codex trocava frente e costas.
- Combate: deitado parado, andando e mirando; ajoelhado só para carregar e arremessar (`GAME_ACTION` em `src/game/avatar.ts`). Praça: as células de frente são pintadas viradas para a esquerda e o jogo as espelha; frente/costas × espelho = 8 direções.
- Nenhum boneco tem sombra cinza no chão (matheus 22/10).
- Prompts `kit3-*` em `scripts/rig/rig-prompts.mjs`. Prancha para aprovação com o desenho do próprio jogo: `node scripts/rig/preview-rig.mjs m` (mochila, praça nas 8 direções, combate em cada pose) e `py scripts/rig/head-sheet.py <sexo> <chapéu>`.

### Área do boné e arma no combate (22/10)

- **Área do chapéu** (ideia do matheus: "uma área definida e recortar por ela"): o `bake --hat` guarda o chapéu dentro do próprio contorno (`hat_area` em `scripts/rig/headplate.py`). O que o recorte traz da cabeça de baixo (testa sob a aba, nuca sob a borda) fica fora do contorno escuro e encosta no transparente: sai em passes que fecham o contorno cada vez menos, sem nunca tirar uma parte grande (a aba). Vista de trás: pele cercada na parte baixa é a abertura da tira e passa a mostrar o cabelo. Chapéu antigo: `py scripts/rig/headplate.py cleanhat <sexo> <item>` limpa as folhas publicadas.
- **Arma no combate**: o boneco do rig agora leva a arma nas costas em todas as poses, como no DDTank (`RIG_WEAPON` em `src/game/avatar.ts`), e deita acompanhando a inclinação do chão (ajoelhado, só 35% da inclinação).
- **Abertura do chapéu mostra cabelo** (matheus, 22/10, regra para os próximos): pela abertura de trás do boné (acima da tira) aparece cabelo, nunca pele. O `hat_area` deixa a abertura transparente, e o cabelo B precisa estar pintado também por baixo das aberturas (o prompt `kit3-hairB` já pede isso). O `hat-starter` atual não foi refeito (pedido do matheus).
- **Rosto de batalha em 3/4** (matheus, 22/10): no combate o rosto normal fica virado um pouco para a frente, como no DDTank (os dois olhos bem visíveis), igual às expressões. Prompt `kit3-face-side34`; entra com `headplate.py face ... --side-normal=<prancha>` (célula de cima à esquerda).
- **Sem selo/círculo atrás do boneco** (matheus, 22/10): o selo base (`aura-blue-sigil`) saiu da mochila, loja, guilda, salas, retrato da vez e tela de carregamento. As auras de +5/+9/+12 continuam. Boneco da mochila 18% maior (`RIG_UNITS.show`).
- **Um cabelo para todo chapéu** (matheus, 22/10: "cabelo, bonés e roupas universalmente compatíveis, sem precisar criar versão com boné"): o cabelo tem só a folha A. Cada chapéu ganha uma folha `<chapéu>-clip.png` por contexto (`scripts/rig/hatclip.py`, roda sozinho no `bake --hat` e no `cleanhat`), e o jogo corta o cabelo com ela (`stack` em `src/game/character/rig.ts`): some o que fica dentro do chapéu, acima dele e acima da faixa (metade da altura do chapéu); aparece a franja sob a aba, os lados, a nuca e o cabelo pelas aberturas. O cabelo B (`kit3-hairB`) não é mais usado.
