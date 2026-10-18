# Combate deitado: arrastar, arma nas costas e arremesso

> Desde 18/10/2026 as roupas com atlas de combate usam os quadros pintados de `docs/combat-frames.md` (de pé para arremessar, como no DDTank). Este corpo recortado continua só como reserva para roupa sem atlas.

Pedido do usuário em 17/10/2026: no combate os jogadores ficam deitados como no DDTank, se arrastam ao andar, a arma fica atrás do jogador e a mão arremessa o projétil. Tudo precisa funcionar igual em todas as roupas. Complemento do mesmo dia: armas de fogo e varinhas são tiradas das costas, seguradas na mão e disparam pela ponta; dinamite, tijolos e outras armas de arremesso continuam no arremesso com a mão.

## Como funciona

O corpo deitado de cada roupa é uma pintura própria (`combat-prone.png` ou o atlas da roupa), registrada no mesmo espaço de 1254 px. A partir dela o rig monta camadas universais, sem números por roupa:

| Camada | Origem | Uso |
| --- | --- | --- |
| Pernas (perto e longe) | cortes por roupa já existentes em `appearance.ts` | chutam alternadas e ficam para trás a cada impulso |
| Tronco | corte por roupa | avança e balança a cada impulso |
| Braços | **automático**: a parte da frente e de baixo da silhueta do tronco (`PRONE_ARMS` em `appearance.ts`) | remam ao arrastar, sobem no carregamento, arremessam no disparo |
| Cabeça | cabeça universal a 130% no encaixe do pescoço | balança levemente ao arrastar |

A caixa dos braços é calculada pelo alfa do tronco de cada roupa, então uma roupa nova pintada no molde funciona sem coordenadas. O ombro fica logo abaixo do pescoço e a mão é o ponto de onde saem o brilho do projétil e o arco do arremesso.

## Animações (`avatar.ts`)

- **Arrastar** (`walk` em combate): o tronco avança e volta, as pernas chutam alternadas, os braços remam um quarto de ciclo à frente das pernas e a cabeça acompanha. Fantasias (`costumes.ts`) mantêm a pintura de combate e fazem o mesmo impulso.
- **Mirar**: braços levemente erguidos.
- **Carregar**: braços sobem para trás da cabeça segurando o projétil, que brilha na cor da arma.
- **Disparar**: os braços chicoteiam para frente na direção da mira (o projétil sai em t=0), com um rastro na cor da arma, e descem de volta ao chão em ~350 ms. No disparo os braços passam à frente da cabeça.
- **Arma**: desenhada nas costas (`PRONE_WEAPON`), atrás do corpo e da cabeça, apontando para o ângulo de mira e acompanhando o impulso do arrasto.
- **Armas seguradas** (`hold:'hand'` no catálogo: Dragão de Brasa, Tempestade e Flor de Cristal): enquanto a barra de força é carregada (Espaço ou toque segurado), a arma sai das costas num arco sobre o ombro e vai para as mãos; mirar sem carregar mantém a arma nas costas; os braços seguram o cabo atrás da boca da arma, que fica à frente do rosto (`HELD_WEAPON`) e aponta para a mira. Carregar brilha na própria arma; disparar dá o recuo. Ao voltar a parar ou andar, a arma volta para as costas. Uma arma nova segurada só precisa de `hold:'hand'`.
- **Armas arremessadas** (sem `hold`): continuam nas costas e o projétil sai pelo arremesso das mãos.
- A física e o ponto de saída do servidor (`x + 27 × facing, y − 40`) não mudam. A boca da arma segurada fica cerca de 10 px à frente desse ponto para não cobrir o rosto. Só no desenho, `Scene.tsx` põe o clarão na boca pintada (`heldMuzzle`) e desliza os primeiros 140 ms do projétil dela até a trajetória real; a lógica e as colisões continuam no ponto do servidor.

## Validação

`npm run verify:cosmetics` mede também o corpo deitado de cada roupa (seção "Combate deitado" do relatório e prancha `prone.png`): camada de braços entre 6% e 40% do tronco, ponto da mão sobre os punhos pintados e corpo de 1 a 1,8× a largura da cabeça (`PRONE_PROPORTIONS` em `rig/anchors.ts`). `node scripts/verify-prone-crawl.mjs` gera a prancha de todas as roupas × poses × direções com vários cabelos, chapéus e óculos.

## Roupas novas

Pintar o corpo deitado sobre `docs/templates/prone-body.png` (gerado por `node scripts/make-cosmetic-templates.mjs`): do pescoço para baixo, de bruços, pés à esquerda e pescoço à direita, os dois antebraços e punhos apoiados no chão à frente do peito, dentro da caixa verde, sem nada do peito dentro dela. Rodar o validador antes e depois.

Prompt-base (anexar o molde e a roupa em pé como referência):

> Production 2D chibi RPG COMBAT BODY sprite for a turn-based artillery browser game, one NECK-DOWN character on a transparent 1254×1254 canvas, matching the attached template exactly in position and scale. Redraw the attached outfit LYING BELLY-DOWN, chest slightly raised, feet at LEFT, small open neck socket at the FRONT RIGHT, no head, no face, no hair. BOTH forearms bent forward and BOTH fists resting on the floor IN FRONT of the chest, fully inside the green box of the template, clearly separate from the chest so they can be lifted as one layer. Legs stretched behind, knees slightly apart. Same costume design, saturated colors, painted volume and clean warm brown outlines as the reference. No weapon, no props, no floor, no shadow, no text. Genuine transparent background.

## Inclinação do chão

No combate o corpo inteiro (pernas, tronco, braços, cabeça e arma) gira em torno do ponto de contato pelo ângulo do chão (`slope` vindo de `aimSlope`), como no DDTank (pedido do usuário em 17/10/2026). O ângulo de mira continua sendo um ângulo do mundo: dentro do corpo inclinado ele é convertido para o ângulo em relação à rampa. O pivô do arco de mira e o ponto visual da boca da arma (`heldMuzzle`) giram junto. Nome, barra de vida, aura do POW e lápide continuam retos.

## Limites

Os dois braços sobem juntos (arremesso com as duas mãos), porque as pinturas atuais têm os punhos lado a lado. Um braço único exigiria pintar os braços em camada separada; o molde já reserva a caixa para isso.
