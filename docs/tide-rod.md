# Vara das Marés (20/10/2026)

Pedido do matheus: a vara de pesca do DDTank (hook1, ID 7072) como arma, com desenho próprio.

- `shared/catalog.ts` (`tide-rod`): Dano 242, Ataque 193, Defesa 138, Agilidade 28, Sorte 39, ângulo 20° a 65°. Tiro normal = um peixe (`effect:'fish'`); POW = um tubarão, único (`powTrident:'pow-unico'`, ×1,5). Cratera oval por enquanto (`oval`/`oval-pow`).
- Não se compra: 50 Fragmentos pescados (`Profile.fragments`, prêmios das varas Coral, Cristal, Aurora e Real, `docs/fishing.md`) + 5000 de ouro viram a arma na Síntese do Ferreiro, categoria "Armas por Fragmentos" (`WEAPON_FRAGMENT_RECIPES` em `shared/synthesis.ts`). Já tendo uma, vira cópia `tide-rod~2` em +0.
- Arte: as 4 fases pintadas pelo Codex (`public/assets/weapons/tide-rod/source/fases.png`, cortadas com `npm run split:weapon-sheet`). Falta, depois da aprovação das fases: atlas do peixe (`effects.png`), o tubarão do POW (`pow.png`), marcas de destruição e sons (`npm run verify:weapons` lista e escreve os prompts).
- Prévia: `npx tsx scripts/preview-fishing-rods.mjs` (Síntese em `06-sintese.png`).
