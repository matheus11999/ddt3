# Estrela Pop e Onda Tropical — conjuntos femininos (19/10/2026)

Gerados com `node scripts/cosmetic-prompts.mjs --set=idol --run` e `--set=surf --run` (`docs/cosmetic-sets.json`); rostos editados a partir do Sorriso Radiante. Só na loja, femininos.

| Conjunto | Peças |
| --- | --- |
| Estrela Pop | `outfit-idol`, `face-idol` Brilho de Palco, `hair-idol` Maria-Chiquinha Estelar (`hair-twin`), `hat-idol` Laço de Palco (tiara), `glasses-idol` Óculos Coração |
| Onda Tropical | `outfit-surf`, `face-surf` Sorriso de Verão, `hair-surf` Ondas de Praia, `hat-surf` Viseira de Praia, `glasses-surf` Óculos Sol Poente |

Encaixe pelo `scripts/fit-cosmetic.mjs`. O primeiro Ondas de Praia cobria as bochechas e foi refeito com o Cabelo Ondulado como referência de tamanho e abertura do rosto. `build-combat-atlas.py` agora só apaga como disco de punho o ciano quase puro do molde (a blusa turquesa da surfista sumia).

Validação: `npm run verify:cosmetics -- --strict --only=<as 10 peças>` sem problemas; andar no lobby sem quadro sem corpo.
