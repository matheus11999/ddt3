# Identidade visual compartilhada

Atualizada em 16/10/2026. A sala PvP aprovada pelo usuário estabelece a família de materiais para salão, mochila, loja e ferreiro. A referência orienta organização; as pinturas do jogo são originais.

## Materiais e hierarquia

A fonte de cores é `src/components/GameTheme.css`. Consuma seus tokens nos componentes em vez de criar uma paleta independente para cada tela.

| Token | Uso |
| --- | --- |
| --game-panel / --game-deep | Safira escura dos painéis e áreas de repouso |
| --game-texture | Grão fino de safira, asset arena-sapphire-texture.webp (512 × 512) |
| --game-gold | Filetes, seleção e acabamento metálico discreto |
| --game-card / --game-card-surface | Marfim das cartas e área de equipamento/prévia da mochila |
| --game-ink | Texto escuro sobre marfim/ouro |
| --game-text / --game-muted | Texto primário/secundário sobre safira |
| --game-header | Cabeçalho safira; sem placa de outra família cromática |
| --game-button / --game-button-primary | Ações secundárias safira, ação principal/aba selecionada ouro |
| --game-focus | Anel de foco de teclado |

Preservar moldura fina arredondada de MenuFrame, com conteúdo dentro da área interna e fechamento acessível. Não reintroduzir borda ornamental de 40px, extensões de madeira/pergaminho, verde nos menus ou gradações rubi independentes por tela. Cor saturada continua presente nos cosméticos, gemas, armas e efeitos, sem lavar as pinturas.

## Aplicação nesta etapa

- MenuFrame importa os tokens globais. Cabeçalho, fundo, moldura e botão de fechar compartilham materiais com a arena.
- Mochila: marfim envolve slots e personagem até Poder. Corpo estático, aura independente, equipamentos imediatos e tooltips preservados.
- Loja: mantém estrutura e provador local, com safira no fundo, abas selecionadas douradas, botões coerentes. Masculino, Feminino e Unissex têm estado ativo igualmente legível, sem depender somente da cor. Compras continuam transacionais.
- Ferreiro: preserva pintura da oficina, fogo e animação de fortalecimento. Trilho de serviços, estoque, materiais e ações usam safira/ouro comuns. Fortalecer/Composição não mudam regras.
- Celular permanece exclusivamente em paisagem. A camada mobile controla geometria e rolagem, sem impor uma segunda paleta.

### Sala PvP — painel central e comandos

A pintura `pvp-room-banner-v2.webp` não contém letras. O título “Batalha PvP” é HTML, em Cinzel com relevo dourado discreto; não adicionar outro título à imagem. O relevo de PvP usa uma face em gradiente dourado e camadas de extrusão por CSS, com nome acessível único. A coluna central ocupa toda a altura disponível até a base da sala, usando `object-fit: cover` e posição central em 48%. Em 1536×864, o banner mede aproximadamente 573×828px; em 667×375, 270×363px. Não deformar a pintura para preencher a área.

O degradê inferior safira mais alto (respiro superior de 140px no desktop e 64px no celular) recebe os textos “Junte-se ao campo de batalha”, “Batalhas de até 8 jogadores” e “Mostre o seu poder e que vença o melhor”. O título usa até 35/90px e as frases até 31/22/18px no desktop, reduzindo proporcionalmente em paisagem. Manter o texto HTML legível e preservar os rostos e armas da ilustração.

Ferramentas, espectadores, convite/treino e Início permanecem no trilho direito. Os cinco menus independentes — mochila, correio, missões, guilda e saída — ficam **abaixo do Início**, fora da pintura. Os ícones se ajustam à largura desse trilho (aproximadamente 49px de altura no desktop e 29–32px no celular). Abaixo de 760px em janela desktop, o corpo da sala continua rolável; a sessão mobile continua exclusivamente em paisagem. Capturas e verificação de geometria, convite, menus e abertura da mochila em `test-results/room-banner/`, nas resoluções 1536×864, 844×390 e 667×375.

O trilho direito usa quatro faixas: cabeçalho, preparação flexível, controles e menus. A preparação ocupa a altura restante e distribui os respiros entre seus grupos; nunca usar `margin-top: auto` nos controles para criar um vão entre ferramentas e espectadores. Slots mantêm 72/56px no desktop e 38–40/29–31px no celular. O número da sala usa 58px no desktop e 28px em paisagem, com face em gradiente ouro/ciano e extrusão discreta; o nome preserva 16px/9px. A distância entre a preparação e os controles fica em 12px/5px. Capturas e verificação deste ajuste em `test-results/room-column/`, nas mesmas três resoluções.

## Verificação

Check TypeScript passou. Capturas de loja, ferreiro e composição em navegador real ficam em `test-results/menu-identity/`, desktop 1536 × 864 e paisagem 844 × 390 / 667 × 375. Esta rodada de inspeção não compra itens nem tenta fortalecimento para verificar apenas apresentação.

### Mochila — medidas do refinamento

O grupo `character-display` contém nome, prévia, nove slots, opções de cor e Poder. Seu marfim termina antes de Atributos; o painel exterior e a lista continuam safira. A prévia mantém `animated={false}`, `auraAnimated` e `weapon={false}`. As colunas equipadas ficam limitadas a 360px, com intervalos de 13px (11px no celular), preservando alvos de 68px/48px. Ícones da lista foram reduzidos para 93% da escala anterior, sem reduzir a área clicável dos cards. Abas têm estado dourado comum aos demais menus.

A mochila foi inspecionada em 1536×864, 1280×800, 844×390 e 667×375. Capturas `inventory-*.png` e `inventory-options-*.png` em `test-results/menu-identity/`. Arraste de fantasia possuída para seu slot no desktop, equipamento por toque no celular e retirada por duplo clique foram confirmados via sessão HTTP autoritativa; nenhum recurso consumido. Engrenagem e popup permanecem acessíveis. Sem erros JavaScript ou overflow horizontal externo.
