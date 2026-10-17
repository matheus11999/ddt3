# Kit de arma e validador — 17/10/2026

**Arsenal refeito do zero (17/10/2026).** As cinco armas antigas e toda a arte delas foram apagadas. O Quebra-Tijolos é a única arma e a arma inicial: de início e meio de jogo, atributos equilibrados (85/95/85/85), cratera pequena (22), um tijolo por tiro sem estilhaços que acertam alvos (os cacos são só efeito visual) e POW de projétil único (`pow-unico`). Perfis com armas antigas passam para ele. As 4 fases, o atlas de efeitos, a marca no cenário e os 4 sons dele estão prontos.

Cada arma do Brasa Arena é única, como no DDTank: arte própria em cada fase de evolução, projétil próprio (o DDTank lança uma TV, bisturis, um bumerangue), efeitos e sons próprios e uma regra de POW × Tridente. O contrato fica em `shared/weaponKit.ts` (`WEAPON_KITS`) e é conferido por `npm run verify:weapons`.

## O que cada arma precisa

| Por fase (+0 a +9, +10 e +11, +12 a +14, +15; nível máximo 15) | Arquivo |
| --- | --- |
| Ícone (inventário, loja, ferreiro) | `public/assets/weapons/<id>/icon-<fase>.png`, 512×512, objeto sem moldura; o jogo pinta o quadro |
| Arma na mão | `public/assets/weapons/<id>/held-<fase>.png`, 1254×1254 (`weaponAssetPath`) |
| Projétil, disparo e impacto | atlas `public/assets/weapons/<id>/effects.png`, 1448×1086, linhas projétil / disparo / impacto, colunas = fases |

| Por arma | Arquivo |
| --- | --- |
| Marca no cenário (destruição) | `public/assets/weapons/<id>/terrain.png`, 1024×1024 |
| Som de disparo, de voo, de colisão e do cenário quebrando | `public/assets/audio/weapons/<id>/{fire,flight,impact,terrain}.mp3`, até 4 s, listados em `sounds` no kit |
| Regra POW × Tridente | `powTrident`: `livre`, `exclusivo` (não combina), `pow-tridente` (o POW já é o tridente) ou `pow-unico` (POW é um projétil só: sem Tridente, +1 ou +2) |
| Identidade | `identity`: o que todas as fases mantêm (materiais, ângulo, luz, traço), para as fases parecerem a mesma arma |

As fases seguem `weaponVisualStage()`. Cada fase precisa de arte própria: o validador acusa célula vazia, imagem sem transparência e fase igual à anterior.

## Estilo travado

Todas as armas seguem o mesmo estilo (`WEAPON_STYLE` em `shared/weaponKit.ts`): pintura digital 2D estilo DDTank, traço marrom grosso, luz de cima à esquerda, vista três-quartos. Todo prompt repete esse texto e proíbe explicitamente pixel art, voxel, 3D, vetor chapado, anime cel, foto e rascunho. As primeiras peças aprovadas do Quebra-Tijolos (`WEAPON_STYLE_ANCHORS`) entram como imagem de referência nos prompts de todas as outras armas. O validador mede cada imagem (quantidade de cores, pixels repetidos, borda suave) e reprova como "fora do estilo da casa" o que parecer pixel art ou vetor chapado.

## Sons padrão

Enquanto uma arma não tem o arquivo próprio, `src/game/weaponSounds.ts` toca o som sintetizado da família em `src/game/audio.ts` (com a camada de explosão gravada do PR de áudio, quando entrar). Voo e cenário quebrando não têm padrão: ficam em silêncio até chegar o arquivo. Um som só toca depois de entrar em `sounds` no kit, para que um arquivo esquecido na pasta não mude o jogo sem querer.

## Regra POW × Tridente

O servidor aplica a regra (`server/game.ts`, `powBoostConflict`): Power armado recusa as ferramentas que a regra proíbe e ferramenta comprada recusa o Power. Em `pow-tridente` o tiro com Power sai em leque de três; em `pow-unico`, um projétil só (`boostsForShot`). O HUD desabilita o botão correspondente. Arma sem regra definida fica `livre`, como antes, e o validador avisa.

## Fluxo para criar ou completar uma arma

1. Rodar `npm run verify:weapons` (`--weapon=<id>` para uma só). Saída em `test-results/weapons/`: `report.md`, `sheet.png` (prancha com cada peça) e `prompts.md`.
2. Imagens: colar os prompts de `prompts.md` no ChatGPT **na ordem numerada** (ícone +0, arma +0, ícone +10…). A partir do segundo, anexar as imagens listadas em "Reference images": é isso que mantém o mesmo traço, luz e ângulo entre as fases. Cada prompt diz o tamanho e onde salvar. A IA pinta a forma; nada de texto ou número na imagem.
   Atalho (prompt `00-prancha-fases.txt`): as 4 fases numa só imagem 2×2 (+0, +10 / +12, +15), o que mantém o mesmo estilo e faz o recipiente **e os tijolos** evoluírem juntos. Depois `npm run split:weapon-sheet -- --weapon=<id> prancha.png` corta em `held-<fase>.png` (1254) e `icon-<fase>.png` (512); `--only=12,15` salva só algumas fases.
   Cada fase tem `ammo` no kit: a munição dentro do recipiente, que é o mesmo objeto que voa. Ela muda de fase para fase, como o recipiente. O recipiente é sempre algo que uma pessoa carrega.
3. Sons: `npm run sounds:weapons -- --weapon=<id>` gera os que faltam no ElevenLabs com a chave do `.env` local (`ELEVENLABS_API_KEY`, nunca no git), ou colar o texto no site. Depois acrescentar o slot em `sounds` do kit.
4. Rodar o validador de novo e mostrar `sheet.png` ao usuário. Passar no validador não é aprovação visual.

Arma nova: entrada em `WEAPONS` (`shared/catalog.ts`) e em `WEAPON_KITS` com conceito, identidade, paleta, o que ela lança em cada fase e como cada som deve soar. As famílias de efeito do renderer (`fire`, `electric`, `crystal`, `dynamite`, `brick`) continuam no código para reaproveitar; o atlas vem sempre da arma.

Testes: as mecânicas genéricas (dano, forja, loja, migração) usam as armas antigas como dados de teste em `tests/fixtures/weapons.ts`, carregado por `npm test`. `--strict` faz o validador sair com erro enquanto faltar alguma peça.
