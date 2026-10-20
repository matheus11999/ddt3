# Vento Celeste e Bobina do Trovão — 20/10/2026

Duas armas reconstruídas a partir do **Verdadeiro Vento de Deus 7008** e do **Verdadeiro Trovão 7009** do DDTank 4.1 (pacote de referência `output/true-wind-thunder-reference/` no PC do matheus, prompt em `docs/true-wind-thunder-reconstruction-prompt.md`). Nomes, ids e arte são originais do Brasa; os ids e números do DDTank ficam só como referência.

| | Vento Celeste (`wind-shuriken`) | Bobina do Trovão (`thunder-coil`) |
| --- | --- | --- |
| Identidade | shuriken de três lâminas, arremessada | pistola de raio com bobina, segurada (`hold:'hand'`) |
| Graus | 15–50° | 25–60° |
| Dano-base | 200 (`round(200 × 1,1^nível)`: +10 = 519, +12 = 628, +15 = 835) | 200 |
| Raio físico do projétil | 3 (o DDTank usa quadrado 6×6) | 3 |
| Área de dano | 55 normal / 65 POW (`splash`, aplicada uma vez: `blast = splash / SPLASH_RADIUS_SCALE`) | 55 / 65 |
| POW | 1 projétil ×1,5 (a pintura mostra três shurikens) | 3 projéteis ×0,6 em leque −5°/0°/+5° com força ×0,9/×1/×1,1 |
| POW × ferramentas | `exclusivo`: Tridente nunca; +1, +2 e bônus de dano sim | `exclusivo` |
| Delay do tiro | 150 (adaptação provisória do Brasa; o Ball.Delay do DDTank não foi encontrado) | 150 |
| Loja | 520 de ouro (decisão de economia do Brasa) | 520 |

## Atributos por fase (tabela, sem a regra de marco)

`Weapon.phaseStats` substitui `weaponMilestoneValue` só nessas armas; `weaponStats` é a única leitura (tooltip, loja, mochila, ferreiro, combate).

| Fase | Vento Atq/Def/Agi/Sor | Trovão Atq/Def/Agi/Sor |
| --- | --- | --- |
| +0 a +9 | 60/30/250/40 | 30/40/60/250 |
| +10 e +11 | 72/36/300/48 | 36/48/72/300 |
| +12 a +14 | 93/46/390/62 | 46/62/93/390 |
| +15 | 111/55/488/77 | 55/77/111/488 |

## POW próprio (`Weapon.pow`)

`server/game.ts` usa `w.pow.damage` no lugar de `POWER_DAMAGE_MULTIPLIER` (1,65), `w.pow.splash` no lugar de `POWER_BLAST_MULTIPLIER` e `w.pow.crater` no lugar de `POWER_CRATER_MULTIPLIER`; as outras armas continuam com os padrões globais. O leque do Trovão (`pow.fan`) troca o projétil único de cada salva por três, com força própria (`volley(..., forces)`), e nunca recebe a penalidade 0,5 do Tridente. Com +1 são 2 salvas × 3 raios, com +2 3 × 3. O pet que age no fim do tiro continua usando o raio do meio da última salva.

## Crateras

Máscaras analíticas em `CRATER_MASKS` (`shared/physics.ts`), medidas no alfa 128 dos `crater.png` do DDTank e centradas no bitmap inteiro:

| Máscara | DDTank (px) | Proporção | Raio no Brasa |
| --- | --- | --- | --- |
| `wind` (121) | 107×72 | oval .67 | 26 |
| `wind-pow` (131) | 117×83 | oval .71 | 28,5 |
| `thunder` (141) | 103×84 | oval .82 serrilhada (26 dentes, 2,3%) | 25 |
| `thunder-pow` (151) | 92×68 | oval .74 serrilhada (4,4%) | 22,5 |

Escala única 0,486 (largura do DDTank → diâmetro no Brasa), a mesma do Bumerangue do Amor, cuja máscara do DDTank tem exatamente os 107×72 do Vento normal; a escala 1 abriria buracos duas vezes maiores que os aprovados no jogo. Os dentes do Trovão reproduzem a área medida (97,7% e 95,6% da elipse). Os `.bomb` do servidor original não existem no pacote: as máscaras são uma reconstrução declarada a partir das imagens do cliente. As quatro fases compartilham a máscara; o Trovão POW cava três buracos menores que o normal.

## Arte e som

- Pranchas das 4 fases geradas com **Nano Banana 2** pela Higgsfield (20/10, 6 créditos: Vento, Trovão, duas novas tentativas do Trovão até o matheus aprovar a versão "estilo DDTank com detalhes trocados"). Fundo magenta recortado por chave de cor e `npm run split:weapon-sheet`.
- Vento: `effects.png` e `pow.png` montados por `py -3 scripts/build-shuriken-effects.py` a partir dos ícones (a arma é o projétil; o POW agrupa três shurikens num só objeto). Gira ~5 voltas por segundo no tempo da apresentação (`sample × .52`), sem mexer no colisor.
- Trovão: efeitos elétricos (família `electric` do renderer) pela última imagem do Nano Banana 2.
- Trovão, projéteis (20/10): normal e POW das 4 fases voam como animação pintada de 5 quadros a 25 FPS (4 no normal +15), do pacote `output/thunder-projectiles-original-v1` (gerado pelo Codex). `py scripts/build-projectile-strips.py --weapon=thunder-coil --src=<pacote>` recorta e reduz cada sequência para `public/assets/weapons/thunder-coil/projectile/<normal|pow>-<fase>.png` e escreve `src/game/projectileStrips.json` (quadros, FPS e o núcleo, que fica na posição do projétil). Arma listada ali troca a célula parada de `effects.png`/`pow.png` pela animação e perde os anéis desenhados em código; disparo e impacto continuam nos atlas.
- Vento, projéteis (20/10): normal e POW das 4 fases vêm do pacote `output/wind-projectiles-original-v2` (Codex, giro rígido de uma pintura). Como os 48 quadros só giram a mesma imagem, `py scripts/build-projectile-strips.py --weapon=wind-shuriken --src=<pacote> --spin` guarda só o primeiro quadro e o `spin` do pacote (450°/s, horário) em `projectileStrips.json`, e o jogo gira a pintura em código; tamanho igual ao da célula antiga. O som de disparo (`fire.mp3`) é o `disparo-normal.mp3` do pacote; `pow-fire.mp3` não mudou.
- `terrain.png` provisório das duas (`py -3 scripts/build-terrain-fallback.py`): degradê escuro com cortes (Vento) ou queimadura ramificada (Trovão). As 8 marcas de destruição por arma seguem o fluxo de `docs/weapon-kit.md` e só entram quando aprovadas em `PAINTED`.
- Sons gerados no ElevenLabs (`npm run sounds:weapons`): disparo, voo, colisão e cenário, mais `pow-fire` e `pow-impact`. Exceção (20/10, escolha do matheus): o disparo normal do Trovão (`fire.mp3`) é o `disparo-normal.mp3` do pacote `output/thunder-projectiles-original-v1`.

## Fora do escopo, de propósito

SpecialII 891, CommonMultiBall e CommonAddWound não viraram botões nem gatilhos (sem evidência de gatilho de combate). Os extras dart4/electricbar4 não são uma quinta fase. Trovão não atordoa, não encadeia e não é instantâneo: é um projétil balístico comum.
