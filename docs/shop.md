# Loja da Brasa

A loja abre pelo botão **Loja** da barra inferior da rua. Segue o padrão da mochila e do ferreiro (17/10/2026): madeira laranja, painéis creme, provador estático à esquerda com a carteira e vitrine à direita com cards horizontais em duas colunas, abas verticais de categoria e paginação de 10 itens. Sem carrinho e sem Poder na prévia (pedido do usuário). Celular em paisagem mantém as duas colunas com rolagem interna; janela estreita empilha provador e vitrine. Layout e prompts de arte em `docs/shop-art-prompts.md`; prévia com `node scripts/preview-shop.mjs`.

## Catálogo e prévia

- Categorias: Destaques, Armas, Roupas, Fantasias, Rostos e Complementos. Busca por nome ignora acentos.
- A loja lista só os itens do gênero fixo do perfil e os unissex. Itens do outro gênero não aparecem, não há filtros Masculino/Feminino/Unissex e o texto Unissex não é exibido nos cards nem no card de informações.
- Cartógrafo da Aurora, Corte Horizonte e Óculos de Navegação pertencem à coleção masculina. Os óculos anteriores permanecem compartilhados; a listagem e a compra derivam do gênero de cada item no catálogo.
- `shared/shop.ts` define ofertas permanentes e preço em Moedas Brasa; `shared/catalog.ts` é a fonte de compatibilidade usada pelo cliente e servidor. `Item.gender` omitido equivale a unissex. Gênero é escolhido na criação e não pode ser alterado. Preços iniciais são provisórios para a futura etapa de balanceamento.
- Armas são vendidas sem fortalecimento (+0). Clicar no item (ícone ou card) monta o item no mesmo compositor usado pelo personagem. Roupas, cabelos e rostos podem ser combinados na prévia; **Restaurar visual** recupera o equipamento atual. O provador não mostra a arma atual do jogador: só aparece arma quando uma arma da loja está sendo experimentada.
- Experimentar não compra, equipa nem publica mudanças. Compras ficam na mochila para serem equipadas por seu fluxo normal.
- Experimentar revela a peça escolhida no provador: uma roupa/rosto/cabelo/chapéu/óculos oculta a fantasia apenas na prévia; uma fantasia experimentada fica visível mesmo se a preferência salva estiver desligada. Restaurar recupera todas as preferências e equipamentos salvos.
- Informações aparecem no card de informações da mochila (`InventoryTooltip`) por mouse, foco ou toque no ícone do item: classe, descrição, atributos com comparação, destruição/ângulo das armas e preço. Não há rodapé fixo de descrição de item.

## Compra e autoridade

Cada card tem só o ícone de **Comprar** (sacola); clicar no item veste a prévia (no celular o toque também abre as informações). Comprar abre uma confirmação com o item, o preço e o saldo depois da compra; só **Confirmar** envia o pedido. Itens já possuídos não mostram texto e continuam com **Comprar**. Saldo insuficiente deixa o preço em vermelho e desabilita Comprar.

O cliente envia `{type:'shop-buy',items:[id]}`, um item por compra. Preços, compatibilidade de gênero, posse, saldo e entrega são validados pelo servidor; esconder ou desabilitar um botão não é a proteção financeira. O retorno `shop-result` contém `items` e `spent`, acompanhado do perfil atualizado. A interface confirma a entrega observando a posse no perfil e mantém a compra bloqueada enquanto aguarda resposta. Não há débito otimista nem alteração local do inventário.

Moedas Brasa usam o saldo persistente `Profile.gold`, compartilhado com recompensas e ferreiro; não foi criada uma segunda moeda básica. O ícone é `RewardIcon`. Novos convidados começam com o kit equipado; perfis antigos preservam seus itens.

## Verificação

`scripts/smoke-shop.mjs` testa o fluxo real em um convidado novo, sem modificar perfis existentes:

1. Confere que não há carrinho, filtros de gênero, Poder na prévia nem texto Unissex, e que itens femininos não aparecem para o perfil masculino.
2. Experimenta Tempestade e Executivo e verifica que o equipamento salvo e comandos de compra/equipamento continuam inalterados.
3. Cancela uma confirmação sem enviar pedido e compra dois itens, cada um com sua confirmação e um comando.
4. Confirma posse, débito total, manutenção do equipamento anterior.
5. Confirma que saldo insuficiente impede nova compra e que a recarga mantém inventário/saldo.
6. Inspeciona desktop 1536×864 e celular 390×844, tooltip dentro da tela e ausência de overflow horizontal/erros JavaScript.

Na cloud desta sessão:

```sh
node --import /workspace/ddt3-cloud/use-system-chromium.mjs scripts/smoke-shop.mjs
```

`BASE_URL` permite usar outra origem. O backend precisa estar atualizado após alterações de catálogo/protocolo. Relatório e capturas ficam em `test-results/shop/` (ignorados pelo Git). O script deixa apenas o convidado de teste criado por ele; nunca usa uma conta preexistente.

## Limites

A prévia é local à janela e se desfaz ao fechá-la; compras confirmadas são persistentes. A loja atual vende equipamentos permanentes, sem quantidades, revenda, cupons, moeda premium ou reposição de materiais. O balanceamento econômico permanece uma etapa posterior, conforme pedido do usuário.
