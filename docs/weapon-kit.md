# Kit de arma e validador — 17/10/2026

Cada arma do Brasa Arena é única, como no DDTank: arte própria em cada fase de evolução, projétil próprio (o DDTank lança uma TV, bisturis, um bumerangue), efeitos e sons próprios e uma regra de POW × Tridente. O contrato fica em `shared/weaponKit.ts` (`WEAPON_KITS`) e é conferido por `npm run verify:weapons`.

## O que cada arma precisa

| Por fase (+0 a +8, +9, +10 e +11, +12) | Arquivo |
| --- | --- |
| Ícone (inventário, loja, ferreiro) | `public/assets/weapons/<id>/icon-<fase>.png`, 512×512, objeto sem moldura; o jogo pinta o quadro |
| Arma na mão | `public/assets/weapon-<id>-{base,evolved,awakened}.png` e `weapon-<id>.png` (+12), 1254×1254 (`weaponAssetPath`) |
| Projétil, disparo e impacto | atlas `public/assets/vfx/<família>-effects.png`, 1448×1086, linhas projétil / disparo / impacto, colunas = fases |

| Por arma | Arquivo |
| --- | --- |
| Marca no cenário (destruição) | célula de `vfx/terrain-residues.png` ou imagem própria (`vfx/<id>-residue.png`) |
| Som de disparo, de voo, de colisão e do cenário quebrando | `public/assets/audio/weapons/<id>/{fire,flight,impact,terrain}.mp3`, até 4 s, listados em `sounds` no kit |
| Regra POW × Tridente | `powTrident`: `livre`, `exclusivo` (não combina) ou `pow-tridente` (o POW já é o tridente) |

As fases seguem `weaponVisualStage()`. Cada fase precisa de arte própria: o validador acusa célula vazia, imagem sem transparência e fase igual à anterior.

## Sons padrão

Enquanto uma arma não tem o arquivo próprio, `src/game/weaponSounds.ts` toca o som sintetizado da família em `src/game/audio.ts` (com a camada de explosão gravada do PR de áudio, quando entrar). Voo e cenário quebrando não têm padrão: ficam em silêncio até chegar o arquivo. Um som só toca depois de entrar em `sounds` no kit, para que um arquivo esquecido na pasta não mude o jogo sem querer.

## Regra POW × Tridente

O servidor aplica a regra (`server/game.ts`): em `exclusivo` e `pow-tridente`, Power armado recusa o Tridente e Tridente comprado recusa o Power. Em `pow-tridente` o tiro com Power sai em leque de três (`boostsForShot`). O HUD desabilita o botão correspondente. Arma sem regra definida fica `livre`, como antes, e o validador avisa.

## Fluxo para criar ou completar uma arma

1. Rodar `npm run verify:weapons` (`--weapon=<id>` para uma só). Saída em `test-results/weapons/`: `report.md`, `sheet.png` (prancha com cada peça) e `prompts.md`.
2. Imagens: colar o prompt de `prompts.md` (ou `prompts/<id>/*.txt`) no ChatGPT. Cada prompt já diz o tamanho e onde salvar. A IA pinta a forma; nada de texto ou número na imagem.
3. Sons: `npm run sounds:weapons -- --weapon=<id>` gera os que faltam no ElevenLabs com a chave do `.env` local (`ELEVENLABS_API_KEY`, nunca no git), ou colar o texto no site. Depois acrescentar o slot em `sounds` do kit.
4. Rodar o validador de novo e mostrar `sheet.png` ao usuário. Passar no validador não é aprovação visual.

Arma nova: entrada em `WEAPONS` (`shared/catalog.ts`) e em `WEAPON_KITS` com conceito, paleta, o que ela lança em cada fase e como cada som deve soar; o teste `tests/weapon-kit.test.ts` falha se uma arma não tiver kit. `--strict` faz o validador sair com erro enquanto faltar alguma peça.
