# Gênero, visibilidade e fantasias

O gênero é escolhido uma única vez ao criar o personagem. `GET /api/session` recupera um perfil existente ou retorna `profile:null`; `POST /api/session` de um convidado novo exige `gender:male|female`. Uma sessão existente não pode trocar esse campo. O cliente não cria um personagem automaticamente antes da escolha.

## Compatibilidade dos equipamentos

`shared/catalog.ts` é a fonte de verdade: `Item.gender`, `itemGender` e `canEquipItem` são compartilhados pelo inventário, loja e servidor. Rostos são feições completas, não olhos e boca separados. Roupas, rostos, chapéus e cabelos possuem gênero. O novo Óculos de Navegação também é masculino; os óculos anteriores continuam unissex. Armas, joias e fantasias são unissex.

A loja separa Masculino, Feminino e Unissex. É possível consultar a outra seção, mas experimentar, comprar e equipar itens incompatíveis fica bloqueado. A validação autoritativa inclui `shop-buy`, `equip`, `customize`, `recolor` e `discard`; um comando forjado não ignora a regra. Compras conjuntas falham integralmente se algum item for incompatível.

Para perfis anteriores sem gênero, Dançarina Rubi define feminino; os demais conjuntos definem masculino. Depois da migração o valor é persistido e não muda por trocar de roupa. Itens reais já possuídos permanecem na mochila, mesmo incompatíveis. Equipamentos incompatíveis são substituídos por uma opção possuída compatível ou pelo conjunto inicial do gênero. Ouro, upgrades e materiais não são reiniciados.

## Equipar e exibir são controles separados

Há nove slots: arma, rosto, roupa completa, cabelo, chapéu, óculos, pulseira, bracelete e fantasia. Pulseira e bracelete afetam atributos, sem desenho no corpo.

Os IDs `hat-none`, `hair-none`, `glasses-none`, `wristband-none`, `bracelet-none` e `costume-none` representam slots vazios no protocolo. Não são itens na mochila, não ocupam cards e não são vendidos. O servidor permite desequipar para a sentinela válida do slot sem exigir posse de um item fictício.

A engrenagem junto ao personagem abre as opções **Exibir chapéu**, **Exibir óculos** e **Exibir fantasia**. Equipamento e opções são aplicados imediatamente, sem botão Salvar. `Equipment.visibility` armazena booleanos; ausência de uma opção equivale a `true`. O servidor normaliza/valida a entrada e transmite o equipamento para a rua, grupo e combate. Duplo clique no slot desequipa. O botão direito abre o menu do jogo (Equipar/Remover, Aprimorar, Trocar cor, Excluir); a troca de cor gasta um Ticket de Cor (`docs/color-tickets.md`). O provador da loja continua local.

`src/customization.ts` mantém uma transação por vez e acumula as escolhas seguintes por slot, inclusive se a mochila fechar. `customize.requestId` opcional (1–64 caracteres) é devolvido pelo servidor em `profile` depois do commit ou em `error`. Falha correlacionada desfaz o visual não confirmado; queda da conexão descarta a fila local e a reconexão recupera o perfil persistido. Cliques rápidos não sobrescrevem outros slots nem enviam transações simultâneas.

Ocultar chapéu mostra o cabelo na variante descoberta, sem mudar o rosto universal. Ocultar não desequipa, não elimina bônus, não consome recursos e não altera a física. Alterações de equipamento/visibilidade são bloqueadas durante o combate.

## Fantasias completas

Pintinho do Trovão (`costume-thunder-chick`) e Raposa Arcana (`costume-arcane-fox`) formam a coleção inicial unissex. A migração de conteúdo 12 concede os dois itens uma única vez, inclusive para perfis existentes; não equipa nenhum automaticamente. Demais cosméticos mantêm as regras de compra.

Uma fantasia equipada e visível substitui toda a aparência normal: corpo, rosto, cabelo, chapéu e óculos. Os equipamentos subjacentes continuam salvos e voltam ao desmarcar **Exibir fantasia** ou desequipá-la. Arma, gênero, atributos, tamanho físico e colisões permanecem os mesmos.

O renderer compartilhado atende mochila, loja, lobby, cartas e combate. Ícone e personagem usam a mesma pintura; não criar um ícone independente que prometa outra aparência. Caminhada segue o movimento, e o renderer responde às poses de combate. `animated:false` congela o personagem nas prévias, inclusive fantasias. Medidas, recortes, prompts e limites artísticos constam em `costume-art-prompts.md`.

Na mochila, `auraAnimated` mantém somente o círculo em movimento; corpo e equipamento permanecem parados e a arma não é desenhada ao lado. O retrato pequeno do HUD do lobby é uma exceção intencional à fantasia: mostra a identidade do personagem (cabeça universal e equipamentos visíveis da cabeça), sem corpo, arma ou aura. Não depende do carregamento da roupa.

## Validação

Unidades: `tests/gender.test.ts` e testes de catálogo/persistência. Integração HTTP/WebSocket/PostgreSQL: `tests/gender.integration.ts` e a integração principal. Navegador: `scripts/smoke-shop.mjs`, `smoke-browser.mjs` e `smoke-customization.mjs`. Inspeção da arte: `scripts/verify-costumes.mjs`, além da regressão dos rostos universais. Os resultados temporários ficam em `test-results/`.
