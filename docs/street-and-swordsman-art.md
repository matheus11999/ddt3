# Rima de Rua e Espadachim Errante — conjuntos masculinos (19/10/2026)

Gerados com `node scripts/cosmetic-prompts.mjs --set=hiphop --run` e `--set=swordsman --run` (temas e textos em `docs/cosmetic-sets.json`, trava de estilo com as peças aprovadas anexadas). Todos masculinos e só na loja (`SHOP_ONLY_COSMETICS`).

| Conjunto | Peças |
| --- | --- |
| Rima de Rua (hip hop) | `outfit-hiphop`, `hair-hiphop` Degradê Trançado, `hat-hiphop` Boné Aba Reta, `glasses-hiphop` Óculos Escuros Neon |
| Espadachim Errante | `outfit-swordsman`, `hair-swordsman` Coque do Errante, `hat-swordsman` Chapéu de Palha Errante (aba larga) |

Ajustes: lentes dos óculos neon a ~53% de opacidade (máscara pela envoltória das lentes) e ponta da haste esmaecida para caber em 0,95× a cabeça; boné e chapéu de palha com o pin um pouco abaixo da faixa pintada para a aba não cobrir os óculos; o primeiro coque tinha mechas sobre os olhos e foi refeito sem elas. O `build-combat-atlas.py` passou a reconhecer como punho só o ciano puro do molde (antes o haori verde-azulado era apagado como se fosse disco de punho).

Validação: `npm run verify:cosmetics -- --strict --only=outfit-hiphop,hair-hiphop,hat-hiphop,glasses-hiphop,outfit-swordsman,hair-swordsman,hat-swordsman` sem problemas; `node scripts/preview-lobby-walk.mjs outfit-hiphop outfit-swordsman` com 10,6 passos/s e nenhum quadro sem corpo.

Correção (19/10, pedido do matheus): Corte Capitão, Degradê Trançado e Coque do Errante terminavam acima da orelha e o chapéu de palha saiu visto de baixo. Os três cabelos e o chapéu foram refeitos pelo gerador com as regras novas (laterais até a orelha; chapéu vestido, visto de cima) e reencaixados.

Segunda correção (19/10): o validador ganhou as medidas de orelha e de assento do chapéu e reprovou Degradê Trançado (passava da orelha, sem costeleta), Coque do Errante (sem costeleta), Boné Aba Reta e Quepe Escarlate (flutuavam acima da testa). O Degradê foi refeito duas vezes pelo Codex (nuca rente ao crânio, costeleta), o Coque reposicionado e os dois chapéus baixados. O Chapéu Astral (antigo) continua flutuando 21 px: a aba pintada cai na frente; precisa de arte nova.
