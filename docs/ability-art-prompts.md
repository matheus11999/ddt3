# Habilidades — arte e efeitos

Checkpoint local de 16/10/2026. Ícones originais gerados com a ferramenta integrada `image_gen`, seguindo a skill `imagegen`. Não são assets extraídos do DDTank. Os arquivos ativos ficam em `public/assets/abilities/` e são PNGs RGBA de **384 × 384**, redimensionados com bicúbica de alta qualidade, preservando alpha. O conjunto ocupa aproximadamente 557 KiB. Originais de geração permanecem fora do repositório no diretório de imagens do Codex.

| Arquivo | Leitura | Tamanho | Fonte final |
| --- | --- | --- | --- |
| heal.png | Bolsa de sangue rubi com coração claro | 200637 bytes | exec-127a3250-c209-427b-9660-edc580a80685.png |
| homing.png | Alvo clássico vermelho/ivório com quatro marcas retas | 129555 bytes | exec-ad26f2b0-a7b1-40a8-bf84-f1302510c6a7.png |
| invisibility.png | Uma silhueta chibi humana simples com três interrupções suaves | 118656 bytes | exec-64bc0930-a14f-4831-a77f-4624c811efdd.png |
| flight.png | Avião de papel marfim/turquesa com ponta laranja | 121508 bytes | exec-9868aafc-75b5-4ad6-9d13-20d45b4523ad.png |

## Regra atual dos ícones

A correção mais recente do usuário prevalece: **invisibilidade é um boneco humano chibi simples, translúcido e sem rosto**, com cabeça, tronco, braços e pernas reconhecíveis. Sem capa, bolhas, aparência de água/vidro, pedestal, anel, raios, olho ou lente tecnológica. O corpo desaparece em poucas faixas suaves. A mira é um alvo circular clássico com anéis concêntricos; não reintroduzir a engenhoca óptica nem os ponteiros dourados ornamentados. Cura e avião mantêm materiais pintados e volume. Sem texto embutido: nomes, custos e estados pertencem ao HUD. Conferir os quatro a 60px em fundos claros e escuros.

As primeiras versões de invisibilidade com capa e depois figura líquida, e da mira com lente e ponteiros dourados, foram descartadas. Não restaurá-las a partir do histórico de geração. Os novos PNGs já têm transparência; o botão não precisa opacificar o ícone inteiro. A silhueta tem alpha parcial real no interior (amostra central 153/255), não apenas um fundo recortado.

## API de integração

`src/game/abilityEffects.ts` exporta:

- `preloadAbilityEffects(): Promise<void>`: pré-carrega as quatro pinturas; carregamento também inicia automaticamente no navegador.
- `drawAbilityEffect(ctx, event: AbilityEffect, ageMs, options?)`: evento importado de `shared/abilities.ts`. Coordenadas `x/y` são os pés no mundo. `ageMs` vem do relógio alinhado ao servidor (`now - event.at`). Cura dura 1300ms; mira 950ms; desaparecer 1050ms; evento `flight` usa o teleporte de 780ms.
- `drawFlightProjectile(ctx, projectile, fractionalIndex, timeMs, options?)`: para `Projectile.kind === 'flight'`. Interpola amostras vizinhas sem copiar o trajeto. Usar o mesmo relógio `startedAt + delay + flightTime` autoritativo do restante do combate. Não supor uma amostra = 1/60s.
- `drawTeleportEffect(ctx, x, y, ageMs, options?)`: breve refração vertical na chegada, transparente e sem pedestal permanente. Normalmente chamar através do evento `flight`, evitando duplicá-lo.
- `ABILITY_EFFECT_DURATION = 1300` e `TELEPORT_EFFECT_DURATION = 780` delimitam retenção visual.
- `abilityEffectCacheStats()` e `ABILITY_VFX_LIMITS` expõem diagnósticos, sem acesso a estado de jogo.

`options` é compatível com `WeaponEffectOptions`: `quality: 'high' | 'low'` e `reducedMotion?: boolean`. Na ausência de override, respeita `prefers-reduced-motion`. Movimento reduzido desativa órbitas, oscilação e deslocamento ornamental; fade continua suave, e a trajetória real do avião continua correspondendo ao servidor.

### Autoridade e privacidade

- `AbilityEffect.hidden === true`, coordenadas sentinela `-10000` ou não finitas e idades fora do intervalo não desenham nada.
- Efeitos não armazenam cópia da aparência do jogador e não revelam inimigo oculto. A opacidade do aliado invisível e a ocultação do adversário pertencem ao renderer de personagens/Scene.
- Cura usa **somente `event.amount`**. Pode mostrar +300, +140 etc.; zero ou ausência de valor nunca inventa +300. Nenhum HP é alterado no Canvas.
- Mira desenha a ativação, não calcula nem escolhe alvos. Voo só representa os pontos e o teleporte recebido; não causa dano nem destrói terreno no cliente.
- Todos os helpers restauram o contexto Canvas e não alteram eventos/projéteis recebidos.

## Cache, limites e verificação

Não há leitura de pixels nem listas de partículas acumuladas por quadro. Quatro imagens 384px, quatro glows de 96px e cache limitado a 16 textos de cura 180 × 70. O máximo teórico destas superfícies é aproximadamente **3,16 MiB RGBA**, excluindo overhead do navegador. O harness mediu 2.607.552 bytes com dois números de cura. O efeito mais caro usa 20 chamadas de pintura por quadro; qualidade baixa usa no máximo 11. Avião usa 8 chamadas, ou 5 em qualidade baixa. Quantidade de efeitos simultâneos ainda multiplica o custo; esses números não são garantia de FPS em dispositivos móveis.

```sh
node scripts/verify-ability-vfx.mjs
npm run check
```

O harness usa Vite em 5177 por padrão (`BASE_URL` opcional) e Edge no Windows. Confere alpha, iconografia a 60px, quatro efeitos animados, geometria estática com movimento reduzido, índice fracionário, sentinelas/hidden sem pixels, expiração, orçamento de pintura, preservação do contexto e valor de cura autoritativo. Gera pranchas e gravação Canvas em `test-results/ability-vfx/`; esses resultados são temporários e não devem ser versionados. Pranchas de início e final foram inspecionadas sobre o cenário real e personagem do compositor atual. A gravação foi produzida para revisão; FPS em aparelho real não foi medido.

## Prompts finais

Os dois prompts de edição usam as gerações anteriores somente como referência de acabamento. A simplicidade solicitada para invisibilidade/mira prevalece sobre a direção inicial mais ornamentada.

### heal.png

```text
Use case: stylized-concept. Asset type: one isolated ability icon for a polished chibi fantasy browser artillery game, square composition, fully transparent background. Hand-painted 3D-volume game illustration, rich saturated pigments, crisp dark colored outline, deliberate broad highlights, tactile materials and readable big shapes. This is an original asset, no copied existing game artwork. The object fills 78% of canvas with safe margin. At 60px it must remain instantly readable. No frame, no card, no environment, no lettering, no numbers, no watermark, no pixel art, no flat vector, no white background, no excessive sparkles, no overall glow haze. Upper-left warm lighting and subtle cool right rim. Subject: a friendly fantastical blood transfusion bag for the healing ability. Plump clear thick soft pouch filled three quarters with vivid ruby-red liquid, rounded dark burgundy edged seams, small ivory hanging loop at top, turquoise stopper and a short curved medical tube with a capped tip neatly curled around lower-right. A large pale mint heart-shaped label on the pouch, no cross or writing. 3/4 view, slightly tilted left. Blood looks like ruby potion, no gore. Restrained tiny green glints. Shape and bag fill dominate, tubing secondary.
```

### homing.png

```text
EDIT: retain the painted red-and-ivory concentric target and its crisp beveled game-icon finish, but simplify it substantially. REMOVE all four gold ornate diamond pointers completely. Use only a clean round classic red-white bullseye with three red concentric bands and two broad ivory bands, viewed front-on. Add four SHORT SIMPLE straight dark burgundy crosshair ticks outside the circle aligned up/down/left/right. No gold, no gems, no ornaments, no arrowheads, no machinery, no lens, no lettering. Broad clean hand-painted warm highlights on raised concentric rings; pleasing volume without excessive details. Strong readable classic target silhouette at 60px. Fully transparent background, centered with 12% safe margin, no frame/card, no watermark.
```

### invisibility.png

```text
EDIT: replace this liquid-looking figure with a MUCH SIMPLER INVISIBILITY GAME ICON. One clear human chibi silhouette, standing upright, very round head, short neck, simple torso, two gently separated arms, two short separate legs. No face or facial detail, no clothing, no accessories. Color is muted cyan-indigo translucent light, drawn with a plain soft colored silhouette edge, a very faint interior (15% alpha), NO INTERNAL LINES, NO waves, NO glass, NO facets, NO bubbles, NO watery sheen, NO reflection hotspots, NO neon, NO electric veins, NO sparks, NO halo, NO pedestal. The body gradually DISAPPEARS toward its right side: two or three broad horizontal gaps with softly faded edges interrupt the torso/one arm/lower legs. This is a simple humanoid becoming invisible, not a 3D liquid mannequin. Maximum simplicity at 60 pixels, beautifully clean game-icon finishing with lightly shaded edges, restrained alpha only. Transparent empty background, just one figure centered and occupying 75% of square height. No text, no border.
```

### flight.png

```text
Use case: stylized-concept. Asset type: one isolated ability icon for a polished chibi fantasy browser artillery game, square composition, fully transparent background. Hand-painted 3D-volume game illustration, rich saturated pigments, crisp dark colored outline, deliberate broad highlights, tactile materials and readable big shapes. This is an original asset, no copied existing game artwork. The object fills 78% of canvas with safe margin. At 60px it must remain instantly readable. No frame, no card, no environment, no lettering, no numbers, no watermark, no pixel art, no flat vector, no white background, no excessive sparkles, no overall glow haze. Upper-left warm lighting and subtle cool right rim. Subject: a single beautifully folded paper airplane, diagonal toward upper right, side 3/4 angle showing triangular silhouette and folded central spine. Thick warm ivory paper, turquoise shaded underside, rich cyan edge reflected light and a tiny burnt-orange triangular folded-tip accent. Recognizably simple paper plane, not a metal aircraft, no propellers, no character, no symbols. Crisp angular folds with soft painted volume, enough contrast at tiny size. A short translucent turquoise swoosh behind left tail, restrained, no cloud/background. Nose pointing right and slightly upward.
```

