# Loja da Brasa

A loja abre pelo botão **Loja** da barra inferior da rua. Reutiliza a moldura compacta de `MenuFrame.css`, com provador estático e ampliado à esquerda e catálogo/carrinho à direita. No celular, o provador fica acima do catálogo e o conteúdo rola dentro da moldura.

## Catálogo e prévia

- Categorias: Destaques, Armas, Roupas, Fantasias, Rostos e Complementos. Busca por nome ignora acentos.
- Seções **Masculino**, **Feminino** e **Unissex** são separadas; a inicial segue o gênero fixo do perfil. É possível consultar a outra seção, mas prévia, carrinho e compra incompatíveis ficam bloqueados. Armas e fantasias ficam em Unissex.
- Cartógrafo da Aurora, Corte Horizonte e Óculos de Navegação pertencem à coleção masculina. Os óculos anteriores permanecem compartilhados; a categoria e a compra derivam do gênero de cada item no catálogo.
- `shared/shop.ts` define ofertas permanentes e preço em Moedas Brasa; `shared/catalog.ts` é a fonte de compatibilidade usada pelo cliente e servidor. `Item.gender` omitido equivale a unissex. Gênero é escolhido na criação e não pode ser alterado. Preços iniciais são provisórios para a futura etapa de balanceamento.
- Armas são vendidas sem fortalecimento (+0). O botão **Experimentar** monta o item no mesmo compositor usado pelo personagem. Roupas, cabelos e rostos podem ser combinados na prévia; **Restaurar visual** recupera o equipamento atual.
- Experimentar não compra, equipa nem publica mudanças. Compras ficam na mochila para serem equipadas por seu fluxo normal.
- Experimentar revela a peça escolhida no provador: uma roupa/rosto/cabelo/chapéu/óculos oculta a fantasia apenas na prévia; uma fantasia experimentada fica visível mesmo se a preferência salva estiver desligada. Restaurar recupera todas as preferências e equipamentos salvos.
- Informações aparecem em tooltip por mouse, foco ou toque no botão de detalhes: raridade, descrição, atributos, destruição/ângulo das armas e permanência. Não há rodapé fixo de descrição de item.

## Carrinho e autoridade

O carrinho contém no máximo 20 IDs distintos e uma unidade de cada equipamento permanente. Itens já possuídos aparecem com **Na mochila** e não podem ser adicionados. A tela permite remover entradas, continuar comprando, conferir o total e usar **Comprar tudo**. Saldo insuficiente mostra o valor faltante e desabilita a compra.

O cliente envia somente `{type:'shop-buy',items:string[]}`. Preços, compatibilidade de gênero, posse, saldo e entrega são validados pelo servidor; esconder/desabilitar um botão não é a proteção financeira. Um carrinho com item incompatível falha integralmente. O retorno `shop-result` contém `items` e `spent`, acompanhado do perfil atualizado. A interface confirma a entrega observando a posse no perfil e mantém a compra bloqueada enquanto aguarda resposta. Não há débito otimista nem alteração local do inventário.

Moedas Brasa usam o saldo persistente `Profile.gold`, compartilhado com recompensas e ferreiro; não foi criada uma segunda moeda básica. O ícone é `RewardIcon`. Novos convidados começam com o kit equipado; perfis antigos preservam seus itens.

## Verificação

`scripts/smoke-shop.mjs` testa o fluxo real em um convidado novo, sem modificar perfis existentes:

1. Abre categorias e os filtros de estilo; consulta atributos e raridade no tooltip.
2. Experimenta Tempestade e Executivo e verifica que o equipamento salvo e comandos de compra/equipamento continuam inalterados.
3. Adiciona e remove itens compatíveis e conclui a compra conjunta com um único comando; verifica bloqueios de gênero em ambos os perfis.
4. Confirma posse, débito, carrinho vazio e manutenção do equipamento anterior.
5. Confirma que saldo insuficiente impede nova compra e que a recarga mantém inventário/saldo.
6. Inspeciona desktop 1536×864 e celular 390×844, tooltip dentro da tela e ausência de overflow horizontal/erros JavaScript.

Na cloud desta sessão:

```sh
node --import /workspace/ddt3-cloud/use-system-chromium.mjs scripts/smoke-shop.mjs
```

`BASE_URL` permite usar outra origem. O backend precisa estar atualizado após alterações de catálogo/protocolo. Relatório e capturas ficam em `test-results/shop/` (ignorados pelo Git). O script deixa apenas o convidado de teste criado por ele; nunca usa uma conta preexistente.

## Limites

O carrinho e a prévia são locais à janela e se desfazem ao fechá-la; compras confirmadas são persistentes. A loja atual vende equipamentos permanentes, sem quantidades, revenda, cupons, moeda premium ou reposição de materiais. O balanceamento econômico permanece uma etapa posterior, conforme pedido do usuário.
