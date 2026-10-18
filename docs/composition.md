# Composição do ferreiro

A aba Composição usa a mesma moldura da mochila e do fortalecimento. O jogador escolhe um equipamento próprio e um mineral, confere o atributo anterior/futuro, chance e custo e confirma uma tentativa. A prévia não gasta recursos.

Minerais: Rubi da Fúria (Ataque), Safira Guardiã (Defesa), Esmeralda do Vento (Agilidade), Topázio da Fortuna (Sorte, 18/10/2026, arte própria em `public/assets/ui/composition-luck.png`; perfis antigos recebem 3/2/1 pedras de Sorte uma vez) e Ametista de Aço (Armadura). Equipamentos compatíveis: armas, roupas, chapéus, pulseiras e braceletes reais; peças “sem item”, rostos, cabelos e óculos não aceitam composição.

| Tier | Bônus do atributo | Chance | Ouro | Estoque inicial por mineral |
| --- | ---: | ---: | ---: | ---: |
| I | +10 | 100% | 40 | 3 |
| II | +20 | 60% | 100 | 2 |
| III | +30 | 30% | 180 | 1 |

Esses valores são balanceamento próprio, inspirado no funcionamento mostrado nas referências. Uma tentativa consome uma pedra e o custo exibido, com sucesso ou falha. A falha preserva o bônus anterior; sucesso substitui aquele atributo pelo tier da pedra, sem somar tiers repetidos. Pedras iguais ou inferiores ao bônus atual são recusadas sem custo. Cada equipamento mantém seus cinco atributos independentemente.

O comando `compose` aceita somente `item` e `stone`. `Store.compose()` bloqueia o perfil em uma transação PostgreSQL, valida proximidade/estado pelo `Game`, posse, compatibilidade, bônus, estoque e ouro; sorteia no servidor e persiste o resultado completo. Rollback devolve todos os recursos se a gravação falhar. O evento `composition-result` informa resultado e custo autoritativos. A interface bloqueia envios repetidos durante a tentativa.

`CONTENT_VERSION=8` migra o estoque inicial uma vez; campos existentes vazios continuam vazios. `compositions` pertence ao perfil, e `equipment.compositions` é derivado dele, sem confiar no cliente. Atributos, poder, tooltip e dano de combate usam os mesmos bônus. O sistema atual não inclui loja/reposição automática de minerais.

Validação: `tests/catalog.test.ts`, `tests/store.test.ts`, `tests/integration.ts` (PostgreSQL real, concorrência, HTTP/WebSocket) e `scripts/smoke-browser.mjs` (prévia, consumo, feedback, recarga e atributos).
