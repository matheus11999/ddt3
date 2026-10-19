# Capitão Escarlate — conjunto masculino (19/10/2026)

Roupa `outfit-captain`, rosto `face-captain` (Olhar do Capitão), cabelo `hair-captain` (Corte Capitão), chapéu `hat-captain` (Quepe Escarlate) e óculos `glasses-captain` (Óculos do Capitão). Masculinos, só na loja (`SHOP_ONLY_COSMETICS`). Gerados pelo Codex (`codex exec` com as peças aprovadas como referência); prompts e originais em `test-results/codex-cosmetics/` na máquina do usuário.

| Peça | Arquivo | Encaixe |
| --- | --- | --- |
| Roupa em pé | `public/assets/outfits/captain-atlas.png` | `PAINTED_OUTFITS`: `[335,5,640,1233]` → `[437,500,384,740]` (mesmo tamanho dos quadros de andar) |
| Andar do lobby | `public/assets/outfits/walk/outfit-captain.png` | `build-walk-atlas.py` |
| Batalha | `public/assets/outfits/combat/outfit-captain.png` | `build-combat-atlas.py` (pranchas `ground` e `throw`) |
| Rosto | `public/assets/faces/face-captain.png` | editado pelo Codex a partir de `face-brave.png` e registrado no mesmo retângulo alfa `[380,222,521,505]`; o compositor usa a silhueta universal (0 diferenças de alfa contra o `face-brave`, 12.286 pixels de feição diferentes) |
| Cabelo | `public/assets/hair-captain.png` | região `[340,150,795,560]`, `shrink(...,.94)` |
| Quepe | `public/assets/hat-captain.png` | pin na faixa `(310,868)`–`(1030,790)` → `hatSeat` |
| Óculos | `public/assets/glasses-captain.png` | centros das lentes `(879,493)`, `(1539,566)` → olhos; lentes com 40% de opacidade |

Prompts: roupa em pé com o Cartógrafo (`cartographer-atlas.png`) como referência de escala e acabamento; andar e combate com `docs/combat-art-prompts/walk.txt`, `ground.txt` e `throw.txt` (descrição da roupa trocada); cabelo, quepe e óculos pintados sozinhos, com o molde da classe (`docs/templates/`) e uma peça aprovada como referência. Os óculos foram refeitos uma vez (`codex exec` com a primeira versão anexada) sem a haste distante, que fica atrás da cabeça.

Validação: `npm run verify:cosmetics -- --strict --only=outfit-captain,hair-captain,hat-captain,glasses-captain` sem problemas; prévias com `node scripts/preview-cosmetic-set.mjs outfit-captain hair-captain hat-captain glasses-captain` e `node scripts/preview-lobby-walk.mjs`.
