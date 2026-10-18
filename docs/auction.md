# Leilão

Janela aberta pelo botão Leilão (martelo) da praça. Jogadores anunciam itens e pedras por **Ouro** (Moedas Brasa, campo `gold`) ou **Cupons** (a moeda cash, campo `coupons` do perfil, ícone pintado `public/assets/ui/coupon.png`). O total de cupons aparece no topo da praça, no rodapé da mochila e no topo do leilão.

## Regras

- **Comprar**: menu à esquerda que expande (Arma → Arma, Arma Secundária; Vestuário → Roupa, Chapéu; Beleza → Rosto, Óculos, Cabelos, Bolha; Pedra de Upgrade → Pedra Nv. 1–5; Pedra de Composição → Composição Nv. 1–3), busca por nome e tabela paginada (8 por página) com item, vendedor, tempo restante e preço. Clicar com o botão direito no vendedor abre Ver informações, Enviar mensagem (chat privado) e Denunciar. Só aparecem itens do gênero do personagem e unissex, como na loja.
- **Vender**: à esquerda, "Meus anúncios" com tempo, preço e Retirar; à direita, o novo anúncio, cujo botão "Selecionar item" abre a janela com itens não equipados dos tipos acima e pedras (por quantidade). Escolhe moeda, preço e tempo: 2h (20 de ouro), 8h (50) ou 24h (100). A taxa é paga em ouro e não volta. Jogador comum tem até **3 anúncios** ao mesmo tempo (`AUCTION_MAX_LISTINGS`; o VIP ainda não existe no servidor).
- O item sai da mochila ao anunciar, com nível de forja, composições e cor. Na compra chega inteiro na mochila do comprador como cópia separada (`id~2`).
- **Pagamento** e **itens não vendidos** chegam pelo **Correio** (remetente "Leilão"). Retirar um anúncio também devolve o item pelo correio.
- **Sino**: avisa vendas e anúncios vencidos (número vermelho no sino e no botão da praça).
- Arma Secundária ainda não existe no jogo: a categoria fica vazia até ela entrar.

## Servidor

- `server/auction.ts`: tabela `auction_listings` (status `active`/`sold`/`expired`/`cancelled`). Anunciar, comprar e retirar travam o anúncio e o jogador na mesma transação do Postgres; o pagamento e as devoluções são cartas escritas na mesma transação (`insertMail`). Dois compradores ao mesmo tempo: só um leva.
- A cada 15 s o servidor encerra os anúncios vencidos (`Game.auctionSweep`) e devolve os itens.
- Protocolo: `auction-list {category?, page, search?}`, `auction-mine`, `auction-seen`, `auction-sell {source, currency, price, hours}`, `auction-buy {id, currency, price}` (o preço esperado evita comprar algo diferente do que estava na tela), `auction-cancel {id}`. Eventos `auction-page`, `auction-mine`, `auction-result`.
- Chat privado: `chat {channel:'private', to}`; só chega aos dois jogadores e entra no histórico das denúncias.
- Cupons: o painel do administrador envia cupons pelo correio (anexo `coupons`).

## Testes e prévia

`tests/auction.test.ts`, `npm run test:auction:integration` (Postgres real: compra dupla simultânea, limite de 3, devoluções) e `node scripts/preview-auction.mjs` (jogo rodando; capturas em `test-results/auction/`).
