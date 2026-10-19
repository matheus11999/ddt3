# Estado da entrega — 16/10/2026

## Combate em quadros pintados (rig do DDTank) — 18/10/2026

- A partir do relatório `output/pdf/DDTank-rig-corpo-combate.pdf`: compositor por quadros como o `GameCharacter` do DDTank. Contrato de 12 quadros em `src/game/rig/combatFrames.json`, sequências portadas (WALK, SHOWTHROWS, THROWS, HIDETHROWS) em `combatFrames.ts`, desenho em `src/game/combatBody.ts` (arma nas costas → cabeça e cabelo → roupa → óculos e chapéu).
- Arte das 5 roupas e do arremesso da Raposa Arcana gerada pelo Codex no PC do usuário sobre os moldes `docs/templates/combat-*.png`; atlas montados por `scripts/build-combat-atlas.py`. Pintinho do Trovão: gerador barrou (moderação), segue com o arremesso deitado.
- Verificação: `npm run check`, `npm test` (348), `npm run build`; prancha `node scripts/verify-combat-frames.mjs` com todas as roupas × ações; partida de treino real mostrou o jogador se levantando ao carregar e segurando até o disparo.

## Relatório do compositor de combate — 18/10/2026

- Relatório ilustrado em `output/pdf/DDTank-rig-corpo-combate.pdf`, com seis páginas verificadas por renderização: atlas de 39 células de 114×95, camadas, caminhada, preparação e arremesso. Figuras e proveniência em `output/pdf/ddtank-rig-imagens/`.
- A análise distingue o compositor original por quadros do rig atual de recortes/transformações do projeto. Não integra um port completo nem altera o combate. Arquivos intermediários de autoria ficam em `tmp/`, fora do versionamento.

## Praça única, desempenho e áudio compartilhado — 18/10/2026

- A praça usa somente as camadas atuais de parallax e o piso. Removidos o carregamento do panorama antigo `plaza.webp` (3,2 MB), duas telas procedurais alocadas no construtor e o código do cenário antigo. O arquivo legado foi retirado de `public/`. Fallbacks independentes dos NPCs/estações continuam preservados. Navegador verificou zero pedidos do panorama antigo e capturou a praça atual em `test-results/current-plaza.png`.
- `Scene` não redesenha a praça oculta por menus/salas e não pinta com a página oculta; estado do servidor continua sendo recebido e combate mantém desenho normal. Medição em navegador: trabalho na loja estabilizada passou de 234 ms para 37 ms por cerca de um segundo/120 frames; zero erros JS e nenhuma resposta HTTP com erro na verificação. Resultados em `test-results/performance-{before-scene-pause,report}.json`. Os tempos são da máquina/teste, não garantia de FPS para todos os dispositivos.
- Polling do Vite em Docker: código a cada 1000 ms e binários a cada 5000 ms, preservando HMR e bind mounts. Foram observados picos do servidor web durante atualizações e um reinício externo do motor Docker durante o diagnóstico, sem OOM nos containers do jogo; backend respondeu normalmente fora desse intervalo.
- POW e power-ups usam o mesmo objeto de cue, arquivo e volume: `/assets/audio/sfx/powerup.mp3`. URLs do preload de áudio são deduplicadas. Teste confirmou dois acionamentos usando o mesmo AudioBuffer e uma única requisição do MP3.
- Recursos em execução ficam no projeto: efeitos/imagens/sons em `public/assets/`, metadados dos impactos em `src/game/boomerangImpactData.json`. Corrigida a importação desses metadados da pasta pública, que gerava avisos/erros no Vite de desenvolvimento. Nenhuma dependência de galerias ou arquivos temporários externos no renderer.

## Bumerangue e som dos menus — 18/10/2026

- Impactos normal e POW do bumerangue usam as timelines originais 461/471: 51 quadros a 24 fps, com pivôs (160,123)/(157,128.95) preservados e escala adaptada ao jogo. Atlas WebP estático sem perdas em `public/assets/weapons/love-boomerang/` e mapa de quadros em `src/game/boomerangImpactData.json`; seleção por tempo em `boomerangImpact.ts`, sem relógios de GIF/WebP animado nem efeitos de fogo. Todas as fases comuns compartilham 461/471, conforme a configuração original.
- `Scene.tsx` mantém o efeito visual até completar 2125 ms mesmo quando o servidor já avançou o turno. Isso não atrasa dano, turno ou recursos. Movimento reduzido usa um quadro curto estático. Sons de impacto normal/POW existentes foram preservados.
- O clique de loja, mochila e demais menus passa a usar a cópia exata de `test-results/ddtank-audio/power-up-clique-Sound008.mp3`, em `public/assets/audio/sfx/ui-click.mp3`; cue `click` continua respeitando a preferência de som.
- A pedido do usuário, servidores de galeria encerrados e galerias, scripts auxiliares e extrações temporárias retirados do checkout. Exclusão em lote foi rejeitada pela revisão automática; a alternativa reversível moveu-os para `C:/Users/Alienware/.codex/temporary-artifacts/ddtank-galleries-20261018/`. Assets usados no jogo e o arquivo de áudio fornecido pelo usuário foram preservados. Milhares de arquivos públicos eram monitorados a cada 250 ms pelo Vite no Docker.
- Pesquisa da forja: Normal 7035→70351→70352→70354; Verdadeiro 7024→70241→70242→70248; Super 7089→70891→70892→70894 em +10/+12/+15. Não há promoção de família no +9 nas tabelas examinadas. `boomerang4` e `superboomerang5` existem mas não são selecionados nessas cadeias. Arquivos CDN 62/63 de fogo foram rejeitados como não correspondentes e não entram no jogo.
- Verificação: `npm run check`, 344 testes e `npm run build` passaram. Renderer real no navegador confirmou quadros normal/POW 0/8/20/50 e fim em 2125 ms (`test-results/boomerang-impact-renderer-qa/`); não é teste de partida. Loja/mochila tocaram exatamente o buffer do clique fornecido; preferência off permaneceu silenciosa após reload (`test-results/menu-click/`). Ao concluir, Docker Desktop estava desligado; conferência em partida permanece pendente, sem reabrir Docker automaticamente.
- Som de início do próprio turno encontrado em `Source Flash/scripts/game/actions/ChangePlayerAction.as:221–224`: `LocalPlayer` toca `016`, enquanto a outra condição toca `038`. `Sound016` é o símbolo 42 de `Web/Flash/audio.swf`; extração de prévia fora do checkout em `C:/Users/Alienware/.codex/temporary-artifacts/ddtank-turn-sound/minha-vez-Sound016.mp3`. Apenas identificado/extraído, sem substituir o cue de turno do jogo.
- O usuário rejeitou Sound016 como a referência procurada. Não tratar a identificação de uma chamada de código como aprovação do som. Para POW: `PrepareShootAction.as` chama `map.spellKill` quando `isSpecialSkill`; `MapView.as:320` toca `097` na animação antes do disparo. `DanderStrip.as:238` usa `008` no clique do botão. Sound097 (símbolo 4 de audio.swf) foi extraído fora do checkout para `ativacao-POW-Sound097.mp3`; cue POW do jogo não foi substituído sem pedido de integração.
- Docker Desktop iniciado e desenvolvimento retomado a pedido do usuário com `docker compose -f compose.yaml -f compose.dev.yaml up -d --build`, preservando banco e volumes. Frontend 8097 e `/api/health` responderam 200. Nenhuma galeria ou servidor 8191 foi reaberto.

## Badges de nível em HTML/CSS — 17/10/2026

- `LevelBadge` compõe os números originais 1–60 com cinco atlas de animação a 24 fps em `public/assets/ui/levels/`, extraídos do `levelicon.swf` local a pedido do usuário. Preserva as origens de cada efeito e a mistura aditiva do 41 em diante, sem Flash. 61–70 mantêm os números dourados do jogo com o último efeito. `prefers-reduced-motion` pausa a animação.
- `LevelNumber` agora encaminha para o mesmo componente: cartas das salas PvP/expedição, salões e ficha do jogador também exibem a arte nova, além de HUD/mochila/loja/combate/convites.
- Evidência: `npm run check`, `npm test` (341 passando) e `npm run build`; navegador em 8097 verificou todos os 70 níveis, carregamento das 60 imagens, avanço da animação, mistura aditiva e movimento reduzido (`test-results/verify-level-badges.mjs`); a sala real usa o novo badge (`verify-room-level.mjs`). Retrato/HUD em DPR 1 e 3 passou (`scripts/verify-avatar-portrait.mjs`).

## Som de ativação dos power-ups — 17/10/2026

- `public/assets/audio/sfx/powerup.mp3` é a cópia exata do arquivo enviado pelo usuário (`Desktop/powerup.mp3`). O cue `boost` usa esse som para as ferramentas (+1/+2, Tridente e bônus de dano), mantendo o acionamento após confirmação do servidor em `Scene.tsx` e a preferência de áudio do jogador.
- Evidência: `npm run check`, `npm test` (341 passando) e `npm run build`; navegador em 8097 iniciou treino, ativou +50%, confirmou a seleção autoritativa e verificou que o buffer reproduzido corresponde ao MP3 enviado (`test-results/verify-powerup.mjs`).


## Hall da Fama — 18/10/2026

- Hall da Fama (`docs/hall-of-fame.md`): Poder, PvP diário/semanal/geral, Guildas (poder dos 10 mais fortes, PvP dos 20 maiores contribuidores, GvG, nível), Evolução, Conquistas e Lendas; top 50 paginado, pódio com personagem real, posição própria, perfis de jogador e guilda; fechamento automático no fuso de Brasília com foto oficial, títulos e recompensas pelo Correio; alertas antifraude e anulação com auditoria no `/admin/hall`. O pódio da praça passou a usar o PvP diário do Hall.
- Evidência: `tests/hall.test.ts`, `npm run test:hall:integration` (20 cenários) e `npx tsx scripts/preview-hall.ts` (capturas em `test-results/hall/`).

## Leilão e Cupons — 18/10/2026

- Leilão (`docs/auction.md`): abas Comprar/Vender, menu de categorias que expande, busca, tabela paginada com item, vendedor (botão direito: informações, mensagem privada, denúncia), tempo e preço; venda por Ouro ou Cupons com taxa em ouro (2h/8h/24h), até 3 anúncios; sino de vendas; pagamento, devolução e retirada pelo Correio.
- Cupons (`Profile.coupons`) no topo da praça, na mochila e no leilão; o painel envia cupons por carta. Ícones pintados pelo Codex: `coupon.png`, `auction-button.png`, `auction-bell.png`.
- Evidência: `tests/auction.test.ts`, `npm run test:auction:integration` (compra simultânea, limite, devoluções) e `node scripts/preview-auction.mjs` (capturas em `test-results/auction/`).

## Jogadores no painel e Correio — 18/10/2026

- `/admin/jogadores`: tabela paginada de todos os jogadores com status ao vivo (praça, sala, batalha), nível, moedas, vitórias, partidas, itens, tickets e pedras; busca, aba Online, ordenação e ficha com mochila e cartas enviadas. Botões de moedas, itens (catálogo por categoria, bloqueia item do outro gênero, arma com nível de forja) e mensagem.
- Correio no jogo (`docs/mail.md`): caixa de entrada estilo e-mail na moldura de madeira, contador no botão da praça e da sala, carta com remetente, texto e anexos, Receber, Receber tudo e Apagar. Anexos resgatados no servidor numa transação que trava cartas e jogador (sem resgate duplo).
- Evidência: `tests/mail.test.ts`, `npm run test:mail:integration` (dois resgates simultâneos da mesma carta: só um recebe) e `npm run test:mail:browser` (painel envia três cartas, jogador recebe tudo; capturas em `test-results/mail/`).

## Painel do administrador — 17/10/2026

- `/admin` com login próprio (credenciais em `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH`, scrypt, sessão de 8 h no Postgres, trava após 5 erros), visão geral com estatísticas do dia e dos últimos 14 dias, e editor de mapas PvP/instância/lobby com rascunhos, histórico e publicação no jogo sem rebuild (`docs/admin-panel.md`).
- `build:map` e o editor usam o mesmo montador (`shared/mapBuilder.ts`); a saída do Sonho Nevado ficou idêntica byte a byte. Folhas e panorama do Sonho Nevado agora estão no repositório em `public/assets/maps/snow/source/`.
- Evidência: `npm run test:admin:browser` (login, salvar, publicar, `/api/maps`, voltar ao original) e uma partida de treino no mapa publicado com nome e ponte alterados. Unidade: `tests/admin.test.ts`.

## Validador de armas — 17/10/2026

- `shared/weaponKit.ts` descreve cada arma: o que lança e como evolui em cada fase, paleta, sons e regra POW × Tridente. `npm run verify:weapons` confere ícone, arma na mão, projétil, disparo e impacto por fase, marca no cenário, quatro sons e a regra, com prancha `sheet.png` e prompts prontos para ChatGPT/ElevenLabs (`docs/weapon-kit.md`).
- Sons próprios por arma em `public/assets/audio/weapons/<id>/`; sem arquivo, toca o som sintetizado da família. `npm run sounds:weapons` gera os que faltam pelo ElevenLabs.
- POW × Tridente aplicado no servidor e no HUD (`exclusivo`, `pow-tridente`, `pow-unico`).
- Pedido do usuário no mesmo dia: fases como no DDTank (+0 a +9, +10, +12, +15; nível máximo 15, forja até +15) e arsenal apagado para refazer do zero. Ficou só o Quebra-Tijolos, arma inicial: 85/95/85/85, cratera 22 (antes 30; terreno sem resistência por material desde 17/10/2026), um tijolo por tiro sem estilhaços com dano (pedido do usuário; a mecânica `fragments` fica só nos testes), POW de projétil único (desde 18/10: POW combina com +1, +2 e dano, só não com o Tridente), preço na loja 300. Arte antiga apagada (`public/assets/weapon-*.png`, `vfx/`); perfis com armas antigas recebem o Quebra-Tijolos.
- Relatório: ícones e armas na mão das 4 fases prontos (aprovados em 17/10/2026); faltam atlas de efeitos e marca e 4 sons no padrão. Prompts em ordem, cada um referenciando as peças anteriores. A arma é um recipiente cheio de tijolos (saco +0, balde +10, estojo pequeno de 3 tijolos +12, bolsa de ombro de 4 tijolos +15; sempre algo que uma pessoa carrega), como as armas do DDTank; o projétil é um tijolo. Teste: `tests/weapon-kit.test.ts`; armas antigas viraram dados de teste em `tests/fixtures/weapons.ts`.
## Ranking PvP do dia no pódio do lobby — 17/10/2026

- Servidor: `Store.dailyRanking()` conta as vitórias do dia (fuso America/Sao_Paulo) na tabela `matches`; toda partida salva conta, inclusive treino contra bot. Empate: quem chegou primeiro. Top 3 com aparência equipada.
- `Game.refreshRanking()` roda ao iniciar, após salvar cada partida e a cada minuto (virada do dia); envia `ranking` a todos e no `welcome`.
- Lobby: os 3 primeiros ficam em pé no pódio, virados para o centro, com "Nome · N vitórias". Pódio ocupado esconde o anel `brilho` e o halo de luz atrás do boneco.
- Teste: `tests/ranking.test.ts` (vitória contra bot entra no pódio).

## Lápide ao morrer — 17/10/2026

- Fighter morto: após ~0,65 s na pose de derrota a arte do usuário (`public/assets/combat/tombstone.png`, 265×320 recortada do original 1254²) cai no lugar, com sombra e poeira; sem placa de vida/nome, aura POW ou mira. Ao reconectar, mortos já aparecem como lápide.
- HUD do jogador morto esconde console, poderes e habilidades e mostra "VOCÊ CAIU · Assista até o fim para receber a recompensa".
- Servidor: morto nunca recebe turno (já existia). Sair no meio da partida marca `left`: não escolhe carta e fica fora de `finishMatch`. Sair depois do resultado mantém a recompensa.
- Testes: `tests/game.test.ts` (morto assiste e recebe; quem sai perde), `tests/matchmaking.test.ts` ajustado. Evidência visual em captura 2v2 com bots.

## Lobby redesenhado — Praça Celeste (17/10/2026)

- Rua dos Aventureiros substituída pela Praça Celeste, no estilo de lobby clássico de artilharia: céu aberto, ilha flutuante com cascata, mar, templo, dirigível, balões e faixa de festival animados. Três portais na praça (Ateliê → loja, Arena e Treino → arena) e dois NPCs (Guarda-volumes → mochila, Ferreiro → forja). Ferreiro mudou para a direita: `SMITH_POSITION` agora é (1250, 630).
- HUD do lobby: título central e placas Arena/Ferreiro trocados por medalhas de evento no topo direito (Arena, Ateliê, Missões com contador, Ferreiro) e um selo de canal sob o retrato. Painel de missões abre pela medalha Missões.
- Fundo pintado por código é só reserva (usuário achou simples/infantil); a arte final é uma pintura única em `public/assets/lobby/plaza.webp`, que substitui o cenário e os NPCs-boneco. Prompts e mapa de cliques em [lobby-art-prompts.md](lobby-art-prompts.md). Verificação: `scripts/shot-lobby.mjs`.

- Atualização 17/10 02h: praça com **três telas de largura** (`shared/lobby.ts`, 4608 px) e câmera seguindo o jogador (clique ou setas/A-D). Portais viraram o **pódio do ranking PvP do dia** (1º/2º/3º, `LobbyWorld.podiums()` pronto para os bonecos), porta da Arena PvP e NPCs animados por camadas recortadas. Ferreiro em x 3720 (`SMITH_POSITION` 3640, 640). Prompt e mapa das estações em [lobby-art-prompts.md](lobby-art-prompts.md).
- Atualização 17/10 03h30: NPCs e animais viraram figuras inteiras que só respiram (braços animados pareciam quebrados), forja sem fogo animado, sombra do contorno de cada estação no chão, placas de nome em esmalte azul com moldura dourada e suporte a `floor.webp` para trocar o piso borrado.

## Salão PvP e sala no padrão da mochila — 17/10/2026

- Salão PvP: moldura de madeira em tela cheia, barra de título com brasão, população e saída; salas em cartas creme (número, nome, líder, formato, vagas ocupadas, estado colorido e assistir) sobre área creme; conversa creme ao lado; botão Criar sala no rodapé.
- Sala: título com número, nome editável, formato, estado e saída; cartas 4:5 com faixa laranja, selo da aura abaixo de +5 e estado Pronto/Líder/Preparando; faixa pintada da Batalha PvP no centro (some abaixo de 1180px); painel com ferramentas, espectadores, convite, treino, Início e menus. No celular em paisagem as quatro cartas ficam em linha e o painel rola por dentro.
- Materiais em `WoodTheme.css` (tokens e classes `wood-*`); `ArenaTheme.css`, `RoomSpectators.css` e `RoomInvitations.css` passaram para `.pvp-room`. Regras antigas da arena em `MobileOrientation.css` removidas.
- Evidência: `npm run check`, `npm test` (232), `smoke-arena-hall`, `smoke-rooms`, `smoke-spectators`, `smoke-room-invites`, `smoke-loadout` e `smoke-mobile-landscape` passando. Prévias em `docs/previews/pvp-*.png`.

## Mochila: cards mais limpos — 17/10/2026

- Sem a gema de raridade no canto dos cards (a cor da carta, o brilho do épico e o pulso do lendário continuam).
- Selo de força da arma só aparece ao passar o mouse ou focar o card; o hover continua mostrando o selo grande.
- O hover não mostra mais "Clique/Toque para equipar"; só avisa quando o item é incompatível (ou o texto de ação do Ferreiro).
- Pedras com quantidade 0 não aparecem na grade (Tudo e Pedras).

## Mochila: anéis, colar, bolha, classes e selos de nível — 17/10/2026

- 13 slots: entram Anel ×2 (`ring` e `ring2`, mesma família; um anel só ocupa um slot), Colar (`necklace`) e Bolha (`bubble`). Pulseira e Bracelete são os 2 slots de pulseira. Anéis ficam na base das colunas laterais (Anel à esquerda, Anel à direita); fileira inferior só Colar, Arma e Bolha. Joias e bolha são invisíveis no boneco; a bolha ainda é só cosmética (sem efeito no chat).
- Loja: Anel da Brasa (200), Anel da Maré (160), Colar Estelar (320) e Bolha Nuvem (150), com ícones SVG próprios. Anel e colar entram na composição.
- Cards por classe: Comum, Normal (uncommon/rare), Épico e Lendário (`data-tier`), com gema no canto, brilho no épico e pulso no lendário. O ícone de sexo saiu da grade e só aparece no hover.
- Hover refeito (`bag-tooltip`): cabeçalho com carta, tipo e sexo; faixa "Classe" com estrelas só para arma, roupa e chapéu (`CLASSED_SLOTS`); atributos em 2 colunas com ícones e diferença ▲/▼ contra o equipado; destruição/ângulo da arma.
- `UpgradeTag` usa as asas pintadas do jogo (`level-badge-backdrops.png`, mesma folha do `LevelBadge`) com número esculpido e faixa "FORÇA" (só a partir de 64 px): até +4 divisa cinza, +5 a +8 asas verdes, +9 asas azuis, +10 asas douradas, +11 asas douradas com coroa e brilho, +12 coroa com raios girando e faíscas. O hover não mostra mais "Equipado".
- Evidência: `npm run check`, `npm test` (233), build, `test:mobile:browser` e `test:immediate:browser` passando; `test:customization:browser` para no mesmo passo "Treinar" de `main`; `verify:cosmetics` igual a `main`. Prévia em `docs/previews/backpack.png`.

## Mochila no padrão DDTank — 17/10/2026

- Layout "Informações pessoais": cabeçalho laranja com nível, nome, vitórias e partidas; personagem estático sobre o selo da aura do jogo (`aura-blue-sigil.png` abaixo de +5; selo da aura do Avatar a partir de +5) com 4 slots de cada lado (2×2 em telas baixas) e arma embaixo; barra de XP e Poder; Ataque/Agilidade/Defesa/Sorte em pílulas e Dano/Armadura/Vida/Vigor em barras coloridas.
- Grade 7×6 com abas verticais (Tudo, Visuais, Armas, Pedras), busca e categoria no topo; rodapé com Moedas Brasa, total de pedras e botão Ferreiro.
- Moldura continua fina e arredondada, só com paleta de madeira nesta janela (`bag-window`); estilos em `Backpack.css`. A loja ainda usa `inventory-window` e `Inventory.css`.
- Evidência: `npm run check`, `npm test` (232), `test:mobile:browser` e `test:immediate:browser` passando; `test:customization:browser` passa toda a mochila e para no mesmo passo "Treinar" que já falha em `main`. Prévia em `docs/previews/backpack.png`; prompts de arte pendentes em `docs/backpack-art-prompts.md`.

## Ajuste atual — contato e dano próximo

- Colisão direta do personagem reduzida de raio 24 para 22; raio adicional da explosão reduzido de `blast × 0,65` para `blast × 0,60`. Um disparo que passa mais longe não deve registrar contato ou dano.
- Dentro desse alcance menor, o splash usa `0,82 × [1 − (1 − q)^1,5]`: máximo 82%, metade do raio ~53%, três quartos do raio ~28,7%, sempre com zero na borda. A primeira curva de 55% linear ainda deixava um impacto no chão sob o jogador fraco; esta revisão aumenta o dano próximo sem ampliar a área. Raspão passou a `0,84 + 0,16q`, contínuo com o acerto direto, para evitar um salto brusco de dano entre as classificações. Defesa, crítico e ferramentas continuam autoritativos e cada alvo recebe cálculo independente; não há mínimo artificial de 1.
- Conjunto masculino Cartógrafo da Aurora, cabelo Horizonte e Óculos do Navegador integra catálogo, loja e avatar. Roupa completa usa pose/corpo pintados, incluindo a gola corrigida sob a cabeça universal. Loja exige compra de 680 Brasa pelo trio; servidor bloqueia compra/equipamento em perfil feminino. Smoke em 8097 validou compra, equipamento imediato, persistência, rejeições forjadas e paisagem 844×390. Arte/prompts em `cartographer-art.md`; evidências locais em `test-results/cartographer-qa/`.
- Verificação após o último ajuste: `npm run check`, **223 testes**, `npm run build` e 30 testes focados de combate/física passaram. Backend `/api/health` e web em 8097 responderam; HMR/watch ativos. Salas de memória estavam vazias após o reinício automático de `shared/`.

## Refinamento vigente — menus, convites e espectadores

- Sala com espaçamento regular entre cartas/banner/ferramentas; ferramentas, dois espectadores, convite/treino e início agrupados no trilho direito. Convidar compacto, quatro espaços futuros desativados, número da sala ampliado. Pareamento com animação, tempo autoritativo e “Toque para parar” no próprio botão.
- Revisão mais recente: menus mochila/correio/missões/guilda/saída ficam abaixo de Início. Banner ocupa a coluna central até a base (573×828 no desktop,270×363 no celular667), com título maior e três frases do usuário sobre degradê inferior. Probe real em1536/844/667 confirmou geometria, convite, menus, mochila e saída; sem erros de página. Capturas em test-results/room-banner.
- Coluna direita adaptativa com quatro faixas, sem o vão entre ferramentas e controles. Número da sala58px desktop/28px mobile com relevo ouro/ciano, nome preservado; título PvP com acabamento3D, degradê mais alto e frases maiores. Evidência final em test-results/room-column.
- Ferreiro refinado nas duas abas: card compacto fixado sobre a bigorna, badge superior ampliado, régua/avanço de nível removidos e chance em barra com percentual interno. Grades de armas, equipamentos e pedras ocupam a largura disponível sem paginação; 16 equipamentos aparecem sem scroll interno em1536/1280/844/667. Cards permanecem quadrados. Ver forge-ui-refinement.md e scripts/verify-forge-layout.mjs. Smoke-browser completo anterior passou com fortalecimento e composição reais; o verificador de layout atualizado passou após o refinamento.
- Convites privados no jogo: lista de disponíveis, aceitar/recusar, TTL60s e limites de envio; servidor revalida vaga/estado/identidade. Não gera links nem reserva vagas. Ícones pintados de correio, missões e guilda integrados; correio/guilda ainda indicam “Em breve”.
- Dois espectadores separados das quatro vagas de combate, fechados por padrão. Dono abre/fecha vagas vazias e expulsa ocupantes. Assistir pelo salão funciona em espera/combate, inclusive durante disparo/reconexão; bloqueado durante busca. HUD próprio mostra equipes/vida/vento/turno, sem comandos de combate. Invisibilidade de ambos os times é filtrada no servidor. Espectadores não escolhem cartas nem recebem recompensas; voltam à mesma sala.
- Mochila, loja e ferreiro compartilham GameTheme.css: safira, ouro discreto e marfim. Prévia/equipamentos/poder usam o material da carta PvP; atributos abaixo em painel compacto com números alinhados. Grade próxima, espaçamento8px desktop/6px mobile, arte dos itens7% menor. Equipamento imediato, posse e economia preservados.
- Personagem/aura maiores na sala, sombra de contato e arma esquerda mais baixa. VIP com coroa cinza inativa; apresentação dourada preparada, mas ainda não há assinatura/entitlement VIP.
- Auras transparentes: **verde +5 substitui azul, roxo +9, dourado +12**, rotação independente do corpo estático, sem recortar pontas. Azul mantido apenas como arte alternativa. Prompts e medidas em aura-art-prompts.md e arena-art-prompts.md.
- Auras finais sem contorno escuro, todas8% menores. Verde ajustado para espessura intermediária após ficar pesado; preservados brilho e rotação. Assets e montagem atualizados, cache invalidado nasURLs.
- Banner PvP repintado nativamente1024×1536, WebP632390B; três ícones de menu com alpha próprio. Evidências locais ignoradas pelo Git em test-results/latest-inventory, menu-identity, room-invites, spectators e arena-sapphire.
- Validação: check, **221 testes**, build; convites em3 contextos reais; espectadores em4 sessões HTTP/WS (privacidade, reconexão, gates, recompensas e retorno) e navegador desktop/paisagem. Montagem das auras inspecionada. Desenvolvimento continua em8097 com HMR. Sem commit/push automático.

Esta seção substitui as descrições históricas de convite por link e materiais separados abaixo.

## Atualização vigente — combate, habilidades e desenvolvimento ao vivo

Esta seção e os contratos atuais em [combate](combat-stats.md), [habilidades](abilities.md) e [matchmaking](matchmaking.md) prevalecem sobre as descrições históricas abaixo. Alterações locais ainda não foram publicadas automaticamente no Git.

- Disparos usam relógio autoritativo: HP, crítico, cratera, queda e vitória mudam no contato, não no envio do tiro. Salvas saem a cada 240ms, sem esperar a anterior atingir. Velocidade temporal ×1,18 mantendo os arcos. Ferramentas repetem conforme vigor, exceto Tridente uma vez por turno.
- Removido o piso artificial de dano1: contribuição menor que0,5 arredonda para0, sem hit/Power; dano legítimo arredondado para1 e alvo com1HP ainda podem mostrar1. Números de dano não têm sinal negativo. A distância entre dois alvos não divide o dano, calculado individualmente.
- Sorte participa do crítico (2% + 0,1 ponto percentual por ponto, teto 30%; dano ×1,5). As quatro armas têm orçamento de 360 pontos de Ataque/Defesa/Agilidade/Sorte, com perfis distintos; fortalecimento soma 4 de ataque e 2% do dano base por nível. Acerto direto, raspão e explosão próxima têm exposições diferentes; o ajuste vigente do splash e da hitbox está no início deste documento.
- Quedas usam metadata de percurso com gravidade1800 e tempo servidor; sucessivas crateras preservam posição/velocidade. HP/chão final permanecem autoritativos no impacto. O cliente mostra a queda antes de sair do mapa; resultado espera sua conclusão. Ações durante queda são bloqueadas sem consumir recursos; metadata encerrada não prende o personagem ao caminhar depois.
- Console de combate redesenhado em 17/10/2026 no padrão DDTank (`BattleConsole.css`, `CombatGauges.tsx`): medidor de ângulo com ponteiro virado para o lado do personagem e faixa verde dos limites da arma; barra de força com gradiente verde→vermelho, listras ao carregar, marcador vermelho do último tiro e régua de marfim graduada; orbe de Power com líquido que sobe com a carga, brilha cheio e **esvazia visivelmente na ativação** (o servidor zera a carga; o cliente não mostra mais 100 enquanto armado). Mira no personagem mostra só ponteiro afunilado, placa do ângulo e faixa verde dos limites (sem aro, traços ou números, pedido do usuário). Power armado desenha chamas atrás do corpo e brasas na frente (`powerArmedEffect.ts`, sem elipse no chão). Cut-in do Power ganhou flash, raios girando, faixa de fogo, anel de choque, brasas e título com impacto. Layout no padrão DDTank: medidor no canto inferior esquerdo, régua acima da barra de força, Energia/Vida e orbe POW no canto inferior direito, PASS sob o tempo; topo com retrato grande do jogador da vez (esquerda), retratos de todos com mini HP, vento/tempo e minimapa com terreno vivo, jogadores e saída (direita) (`BattleTopBar.tsx`, `sceneView.ts`). Textos do HUD em Lilita One (OFL, `public/fonts`). Prévia: `scripts/inspect-power.mjs`.
- Topo do combate (17/10/2026): retratos dos aliados à esquerda do vento e dos inimigos à direita, como no DDTank. Nomes e barras de vida de jogadores lado a lado sobem uma linha em vez de se sobrepor, e ficam por cima de todos os bonecos (`drawFighterPlates` em `fighterIndicators.ts`).
- Mira acompanha apoio/inclinação após caminhada, inversão e crateras, respeitando limites da arma e envelope global. HUD mostra ângulo efetivo e deslocamento do chão; vento central, adversário no lado oposto, HP e turno destacados. Régua mais compacta/lenta; Power e vigor redesenhados. Mira no jogador é um transferidor graduado sem seta longa/linha azul; dial acompanha a mesma linguagem. Painel de cenário, zoom e pan manuais removidos. Regra visual: fundo parallax recebe sombra14%, terreno/personagens/HUD mantêm cores. Projéteis, energia das armas, hits e crítico têm animações próprias, com transparência e dissipação.
- Cura restaura até 300; mira assistida curva só o primeiro projétil na descida, próximo ao inimigo, respeitando obstáculos; invisibilidade oculta a posição por três turnos próprios completos. Cada item selecionado tem um uso por partida. Inimigos não recebem coordenadas/tiros do invisível; reconexão mantém essa privacidade. Voo é fixo e separado: avião até o destino, aterrissagem validada, sem dano/cratera e incompatível com ferramentas/Power/mira.
- Preparação tem três slots persistentes e ordenados, aceitando vazios e rejeitando duplicatas. Mudanças são autorizadas somente durante espera da sala, confirmadas após transação PostgreSQL, e desfazem prontidão. Apenas habilidades equipadas ficam utilizáveis na batalha. A fila global do cliente preserva a última escolha durante cliques rápidos/fechamento do menu e correlaciona confirmações por requestId.
- Criar sala é imediato, com apenas a vaga do líder aberta. Ele abre/fecha as outras três; PvP exige todas as abertas ocupadas por humanos conectados/prontos. Treino dentro da sala pede confirmação e completa os dois lados igualmente com bots temporários. Minimap e seleção manual de mapa removidos; mapa sorteado no servidor.
- Sala permite ao líder renomear pelo lápis e expulsar pelo X do cartão. Convidar gera link com apenas o ID público da sala, sem carregar parâmetros anteriores; a entrada pelo link passa pelas mesmas validações de lotação/estado do servidor.
- Salão separa pesquisa recolhida por ícone, formato1×1…4×4 derivado das vagas abertas, salas cheias/em busca/em combate bloqueadas e tempo de combate fornecido pelo servidor. A população conta humanos conectados no salão ou em salas/partidas uma única vez, sem bots nem pessoas apenas na rua.
- Resultado aparece por 3s antes das cartas; escolha dura até 5s e termina antes se todos os humanos escolherem. Oito cartas revelam juntas. Após pelo menos 2s e pagamento confirmado, os grupos voltam automaticamente às mesmas salas, com IDs/vagas preservados. Sem botões de revanche/voltar na tela de resultado. Cartas flutuantes sobre o cenário, sem modal azul grande; frente marfim, verso navy pintado, seleção dourada e entrada/saída animadas.
- Badge de nível do lobby preserva formato, tamanho e acabamento originais, sem placa extra; opacidade integral e contraste discreto para legibilidade; retrato com supersampling mínimo2×/até4× conformeDPR, suavização alta e boca desobstruída. Prancha verificada emDPR1 e3, preservando cabeça universal e visibilidade dos equipamentos.
- Direção visual vigente: sala e salão ocupam o viewport inteiro, com safira texturizada fina, marfim nas cartas e ouro discreto, coesos com as recompensas. Madeira/pergaminho extensos foram rejeitados. O salão não tem imagem acima do chat. Materiais e botões são compartilhados em `ArenaTheme.css`.
- Cartas dos jogadores têm cabeçalho próprio para nickname, separado do avatar; a última revisão estreita a carta para4:5, reduz o cabeçalho para28px e amplia o personagem. Arma menor à esquerda, sem inverter o corpo; `centerBody`, `weaponSide` e `weaponScale` são opções visuais da prévia, sem efeito no combate. Mochila e comandos maiores. Removidos os avisos de preencher/fechar vagas e de equipe pronta; validações de início continuam no servidor.
- Refinamento das cartas: nível40px desktop/25px mobile, personagem e aura elevados juntos12px/5px. Prontidão usa somente um medalhão de confirmação, com rótulo acessível. Arma à esquerda em72% da escala; nas fantasias dessa prévia ela fica à frente da capa/cauda para continuar visível, sem alterar camadas do combate.
- Expulsar usa X em botão rubi compacto integrado ao cabeçalho. Composição segue a referência: cartas à esquerda, banner PvP ao lado e trilho direito com número/nome da sala e ferramentas (ativas acima, disponíveis abaixo). Chat na metade inferior esquerda; convite/treino/início à direita. Mochila e saída são ícones independentes na base, sem botão redundante de chat. Vagas sem rótulos/instruções visíveis, com cadeados em traço e tom mais escuro quando fechadas. Mantido ajuste específico para celular em paisagem.
- Número curto da sala é gerado pelo servidor, crescente durante o processo e preservado em renomeação, reconexão e retorno. Comandos/convites continuam usando UUID; reiniciar o servidor encerra salas e reinicia numeração.
- Docker de desenvolvimento atende o mesmo endereço **8097** com Vite/HMR e backend em watch. Interface e assets atualizam ao salvar; mudanças em server/shared reiniciam o backend. Salas/fila/combates em memória terminam nesse reinício; perfis/recursos persistidos permanecem. Comandos em README e local-handoff. O build de produção continua separado e reproduzível.

### Evidência acumulada desta etapa

- Check,205 testes e build passaram após os refinamentos de carta/chat/comandos e número autoritativo da sala. Integração de mapas reexecutada com30 projéteis/reconexão/retorno. Inspeção visual final em `test-results/arena-sapphire/weapons-1536.png`, `weapons-667.png`, fantasias correspondentes e `room-final-iab.png` no navegador aberto em8097.
- QA final de controles em8097 passou: expulsão exclusiva do líder, vagas/prontidão, chat bidirecional, convite, mochila, fila/cancelamento e reconexão em celular844×390. Evidência em `test-results/arena-sapphire/controls/report.json`; sem erros de página.
- Integrações reais em8097: HTTP/WS/PostgreSQL; Power com dez tiros; três mapas/30 projéteis e reconexão; matchmaking1×1…4×4; habilidades com privacidade por audiência, voo, cura, mira e duração; preparação com ACK após commit, vazios, rejeições, reload/reconnect e gravação concorrente com equipamento.
- Navegador real: controles por teclado/toque com valor visível igual ao enviado; equipamento imediato com fila, fechamento e rollback; arena, loja/roupas, paisagem e smoke geral. PvP até resultado com reserva exclusiva, prêmios ocultos na reconexão, revelação antecipada, pagamento PostgreSQL e retorno às duas salas originais.
- scripts/smoke-loadout.mjs passou com drag catálogo→slot, troca, duplo clique/Delete, toque, persistência HTTP/reload e ordem em combate. scripts/verify-battle-readability.mjs passou com amostras de gravidade determinísticas, queda antes do resultado e dano sem sinal.
- Recompensas refinadas revalidadas em PvP real: introdução, cinco segundos, reserva exclusiva, reconexão, revelação antecipada das oito cartas, pagamento PostgreSQL e retorno automático às duas salas. Cards têm brilho suave, prêmio centralizado e seleção dourada; timings preservados.
- Convites: cópia do link, criação pelo convidado, entrada, permissões, prontidão, expulsão e rejeição de sala fechada passaram no navegador. Preparação por arraste/toque, troca de slots, retirada e persistência/reload também passou.
- Harnesses de efeitos: 16 combinações de famílias/estágios de arma e efeitos de habilidades, com pranchas inspecionadas. Layouts de combate/resultados verificados em desktop e paisagem emulada; a última revisão visual terá capturas próprias.
- Limites mantidos: balanceamento provisório; testes em navegador com toque emulado, sem validação de desempenho em aparelhos físicos. Fila sem MMR, salas/combates em um processo e sem recuperação após reinício; nenhuma evidência de escala para milhares de usuários.

## Refinamento posterior — equipamento imediato e retratos

- Mochila sem Salvar, Restaurar ou lixeira; clique/arraste, tintura e visibilidade aplicam imediatamente. Duplo clique no slot retira. Fila global por intenção mantém a última escolha em cliques rápidos e continua após fechar a mochila; servidor confirma o `requestId` somente após persistir, rejeições desfazem o visual não confirmado. Avisos agora aparecem acima dos menus.
- Corpo estático e aura animada separadamente, ambos mais altos. Arma oculta na prévia; slots 68px desktop/48px paisagem, cards menores. Retrato do HUD mostra apenas cabeça/cabelo/chapéu/óculos visíveis, preenchendo a moldura, sem aura/corpo/arma/fantasia.
- 139 unidades passaram, incluindo 11 de fila/ACK. Cinco smokes atualizados passaram em Vite (personalização, mobile, navegador geral, loja e roupas). `smoke-immediate-equipment.mjs` passou com ACK real atrasado: quatro cliques em duas transações, fechamento durante fila, persistência, retirada por slot e rollback após rejeição do servidor. `verify-avatar-portrait.mjs` e regressão estática passaram para corpo, duas fantasias, aura, HUD e carregamento tardio. Capturas inspecionadas. Estes resultados precedem o novo refinamento de combate solicitado em seguida.

## Atualização local — grupos, personalização e fantasias

Esta seção prevalece sobre o checkpoint da cloud descrito abaixo. A implementação local parte de `66cc0e8`, na branch `codex/party-matchmaking-ui`; as mudanças desta etapa não foram publicadas automaticamente.

- Mochila e loja usam personagens maiores e estáticos. O renderer redesenha por troca de equipamento/carregamento de arte, sem loop contínuo para a prévia. Removidos controles de caminhar/mirar/deitar, texto de convite da loja e texto do botão de restauração. Slots maiores. Lobby não exibe armas equipadas de jogadores/NPCs; cartas da arena também são estáticas.
- Decisão posterior: celular joga somente em paisagem. Retrato apresenta a tela para girar o aparelho; controles bloqueados e carga pendente cancelada, sem recarregar a sessão. Menus adaptados à pouca altura. Capturas históricas em 390×844 representam o layout anterior ou uma janela desktop estreita, não um modo jogável vertical em celular.
- Formato dos menus foi aprovado e preservado. Molduras finas, arredondadas, em `MenuFrame.css`; cabeçalho e fundos harmonizados com safira e metal discreto. Sem a moldura ornamental antiga de 40px nem o cabeçalho vinho destoante. Mochila, loja e ferreiro compartilham essa direção.
- Arena PvP reúne grupos de até quatro aliados e exibe somente essas quatro vagas. Ocupação define o formato; todos prontos e conectados permitem buscar outro grupo do mesmo tamanho. Mapa sorteado no servidor, sem seletor de mapa/modo ou bots em PvP. Saída, desconexão, equipamento ou retirada de prontidão cancelam a fila. Grupos conservam seus IDs e retornam separadamente após as recompensas. Contrato e limites em `matchmaking.md`.
- Apenas seis protótipos retirados: `hat-pilot`, `hat-knight`, `hair-spiky`, `hair-silver`, `glasses-round`, `glasses-pilot`. Migração troca posses por peças atuais e preserva composições compatíveis. Rostos pintados, Surfista, Executivo, Ondulado e chapéus pintados foram mantidos conforme a clarificação final.
- Gênero escolhido na criação e fixo no perfil. Rostos completos, roupas, cabelos e chapéus têm compatibilidade compartilhada entre catálogo, UI e servidor. Loja separada em Masculino/Feminino/Unissex. Itens incompatíveis podem ser consultados, mas não experimentados, comprados ou equipados. Posse antiga incompatível é preservada na mochila; somente o equipamento ativo recebe fallback compatível na migração.
- Fantasia é o nono slot, unissex, com Pintinho do Trovão e Raposa Arcana. Duas pinturas com quatro poses por atlas; ícones derivados da mesma arte. Fantasia visível substitui todo o personagem, preservando equipamentos subjacentes, gênero, atributos e hitbox. Renderer compartilhado para prévia, lobby, arena e batalha. As prévias continuam estáticas.
- Engrenagem junto à prévia abre **Exibir chapéu**, **Exibir óculos**, **Exibir fantasia**. Preferências pertencem ao rascunho e são salvas/publicadas junto da personalização. Ocultar preserva bônus e posse; chapéu oculto usa cabelo descoberto. Itens “Sem ...” removidos das posses e cards; sentinelas internas continuam representando slots vazios e podem ser usadas para desequipar.
- `CONTENT_VERSION=12`: inclui migrações de protótipos/gênero e concede as duas fantasias iniciais uma vez. Não equipa fantasias automaticamente nem repõe pedras/ouro. Novos perfis recebem kit compatível, 500 moedas e as duas fantasias. Contratos em `customization.md`; prompts/medidas em `costume-art-prompts.md`.

### Evidência desta atualização

- `npm run check`, 128 testes unitários e build passaram. Quinze unidades novas cobrem gênero/fantasias; outras quatorze cobrem matchmaking. `git diff --check` limpo.
- Integração principal HTTP/WebSocket/PostgreSQL passou: equipamento por gênero, cinco rostos publicados, fortalecimento, composição, nove projéteis, reconexão e concorrência de recursos/upgrade.
- Integração específica `tests/gender.integration.ts` passou com criação dos dois gêneros, rejeição 409 ao tentar alterá-los, comandos incompatíveis mesmo com posse, carrinho misto sem débito parcial, persistência de fantasias/visibilidade, atributos preservados, bloqueio durante batalha e migração real no PostgreSQL.
- `scripts/smoke-customization.mjs` passou: nove slots sem cards vazios fictícios, seleção de gênero, salvar/recargar preferências, fantasia estática, retorno ao visual original ao ocultar, ambos os gêneros equipando, publicação para outro cliente, batalha real e popup no celular. Capturas inspecionadas em `test-results/customization/`.
- `scripts/smoke-shop.mjs` passou com dois perfis, seções estritas, bloqueios de prévia/compra/arraste/tintura, carrinho, persistência, desktop/celular e zero erros JavaScript.
- `scripts/smoke-browser.mjs` passou com nove slots, prévia/arraste/tintura/salvar/restaurar, fortalecimento e composição transacionais, atributos, persistência e tiro no treino. `verify-costumes.mjs` validou 80 combinações de poses/direções/contextos, gênero, visibilidade, caminhada e retrato estático; pranchas inspecionadas. A fantasia usa quatro desenhos com reações por transformação, não dez sequências completas quadro a quadro.
- `tests/matchmaking.integration.ts` passou com nove clientes reais, 1×1 a 4×4, cancelamentos/reconexão, mapas escolhidos pelo servidor, fim em 80 turnos e oito recompensas exclusivas persistidas. `smoke-rooms.mjs` passou no navegador com criação somente por nome, cartas aliadas estáticas, chat/expulsão/fila/cancelamento e pareamento real 2×2.
- Economia no PostgreSQL e smoke de chapéus passaram após a separação de gênero: compra concorrente, rollback, recompensas idempotentes, limite 70, quatro chapéus distribuídos em perfis compatíveis e persistência após recarga.
- `scripts/smoke-mobile-landscape.mjs` passou em 844×390, 932×430 e 667×375: criação bloqueada em retrato, rotação sem recriar perfil nem perder rascunho, mochila/loja/carrinho/ferreiro/composição/arena acessíveis, cancelamento de movimento e carga sem tiro acidental. Uma janela desktop estreita continua livre. Capturas inspecionadas; teste em navegador com toque emulado, ainda sem avaliação em aparelhos físicos. Contrato em `mobile.md`.
- Docker atualizado em `http://127.0.0.1:8097/`, backend v12 saudável. Smoke de personalização e smoke mobile passaram também nessa versão de produção; o último rebuild atualizou somente o serviço web e preservou PostgreSQL/Redis/backend. Zero erros JavaScript nos dois testes.
- A fila permanece baseada somente no tamanho dos grupos, sem MMR; não há estimativa inventada de espera. Salas, fila e batalhas continuam em memória de um processo. Reinício encerra esses estados. Perfis/itens já salvos permanecem no PostgreSQL; nenhum teste local demonstra capacidade para milhares de jogadores.

## Checkpoint anterior da cloud

As seções seguintes registram recursos e evidências acumuladas. Para arena, slots, gênero, fantasias e molduras, usar a atualização local acima.

## Direção e escopo

O usuário ampliou o checkpoint de rostos para cenários, roupas, inventário, ferreiro, arena, progressão e combate. A direção atual usa cores vivas e fantasiosas, arte original e interface de jogo. As capturas de DDTank orientam composição, proporções e funcionamento; não foram copiadas para os assets. A validação técnica e a inspeção abaixo não substituem a aprovação artística do usuário.

## Cenários e combate

- Jardim Encantado: árvores monumentais, ravina, raízes e solo destrutível. Parque dos Sonhos: atrações rubi/ouro, terreno mecânico e ponte/pilares preservados. Fortaleza Celestial: arquitetura cobalto, contrafortes, cristais e terreno indestrutível.
- Seis pinturas novas de ambiente/terreno e três atlas com 18 objetos. A pintura é registrada na mesma máscara física das crateras; caixas e barris também são recortados. Os quatro spawns por equipe são espelhados e suportam salas até 4×4.
- Colisão contínua por disco, com raios físicos de 6px (Brasa), 3px (Tempestade) , 9px (Cristal) e 7px (Dinamite). Centro animado e ponto real de contato são separados para preservar aparência, material e cratera. A salva resolve impactos na ordem temporal e mantém consistência ao derrubar o atirador.
- Cada arma tem lançamento, projétil, trilha e impacto próprios nos quatro estágios +0–8/+9/+10–11/+12; quatro atlas originais, 48 pinturas de projétil/lançamento/impacto. Raio de explosão, cratera e hitbox são conceitos separados. Prompts em `weapon-vfx-prompts.md`.
- O servidor confirma terreno ao terminar a resolução. O cliente mantém relógio e estado anterior para recuperar crateras após suspensão de frames/remontagem sem duplicar dano. Saída/expulsão da sala não reabre a batalha por eventos antigos.
- HUD sem ficha da arma: segurar Espaço/toque carrega e soltar dispara o valor efetivamente exibido. No máximo, a barra espera a soltura. Blur, painel, câmera, visibilidade e cancelamento do toque interrompem a carga. Ferramentas usam ícones pintados; turno, contador, vitória, derrota e empate usam texto com relevo.
- Câmera com zoom/arraste, qualidade e áudio persistidos. Ambiência original por mapa, suspensa quando a aba fica oculta. Caches suavizados e carregamento atômico evitam alternar terreno provisório/final; ver `map-rendering-validation.md`.
- Power-ups redesenhados conforme a foto enviada: setas 3D +1/+2/×3 e POWER50%/40%/30%/20%, com números grandes vermelhos e contorno claro montados no HUD. Atlas `boost-arrows-power.png`, encaixes com relevo e feedback, atalhos no canto e vigor no tooltip; mecânicas preservadas. Prompt/contrato em `boost-art-prompts.md`.

## Personagens, nível e atributos

- Quatro roupas no catálogo: Surfista da Maré, Executivo, Piloto Relâmpago e Dançarina Rubi. Os dois novos conjuntos são vendidos na loja. Roupas antigas, inclusive Celeste/Azure e Real/Royal, foram removidas. Surfista tem base larga e shaka; Executivo, mão na gravata/bolso e postura formal. Ícones usam a pintura completa.
- Caminhada usa recortes próprios e pernas articuladas, com fase ligada à distância real. Combate usa corpo chibi compacto e baixo, roupa reconhecível, cabeça universal erguida e arma atrás. As poses de inventário/lobby/cartas continuam distintas por roupa.
- Seis rostos preservam exatamente o mesmo shape/alfa e âncoras. Oito slots: arma, rosto, roupa, cabelo, chapéu, óculos, pulseira e bracelete; joias invisíveis. `ENABLE_MODULAR_APPEARANCE=false` continua protegendo camadas incompletas, sem desativar os corpos registrados.
- Aura do personagem é luz translúcida com centro vazio, rotação lenta e estágios +5/+9/+12. Só aparece com `showAura` no inventário, perfil, cartas da arena e retrato/resultados do HUD. Luz discreta no retrato mesmo em +0. Sem pedestal sob os pés, sem aura no mundo do lobby ou nos bonecos dentro do combate.
- Nível máximo 70 confirmado. Badges em relevo:1–10 cinza completo,11–20 verde,21–30 azul,31–40 bronze,41–50 prata; dourado 51–70 ativo. Novas bases em `level-badge-backdrops.png`. Aura cresce de 30 a 70, com camadas extras no 40, 50, 60 e 70 na cor da faixa, independente do fortalecimento da arma. HUD/mochila/carta usam40/42/46px; carta mobile36px. Personagem da carta reduzido para204px desktop/180px mobile;45 casos de badge até o 70 e24 cartas em quatro resoluções validados.
- Ataque, Defesa, Dano, Armadura, Agilidade, Vida e Vigor usam totais compartilhados. Dano e Armadura participam da fórmula autoritativa; veja `combat-stats.md`. Os coeficientes são balanceamento próprio, sem alegação de reproduzir a fórmula proprietária de DDTank.

## Encaixe de cosméticos

- Fase 1 do rig v1 (`docs/cosmetics-fit.md`): âncoras, zonas de tamanho por classe e `npm run verify:cosmetics` em modo relatório. Nenhuma mudança visual. Relatório inicial: 8 de 17 peças fora da zona, 49 de 54 combinações chapéu × cabelo com franja sobre os olhos ou óculos encobertos, Executivo e Dançarina com tronco mais estreito. Fase 2: `COSMETIC_MANIFEST` e `drawPinned` substituem os ajustes manuais de cabelo, chapéu e óculos; 313 de 353 imagens de referência idênticas, o resto com diferença abaixo de meio pixel. Fase 3 (código): assento único dos chapéus, óculos entre franja e aba, tintura em todos os cabelos, moldes `docs/templates/` e briefs de repintura em `cosmetics-art-briefs.md`; a arte nova ainda não foi gerada nesta sessão (sem ferramenta de geração de imagem). Fases 4–5 pendentes.
- Cabeça 30% maior (`HEAD_SCALE=1.3`) em pé, andando, combate, cartas, HUD, mochila, loja, Power e resultado. Cosméticos seguem a cabeça sem mudança de arte; molduras de `Avatar.tsx` reduzidas a 74% e nome/vida/seta no cenário elevados. Conferido em prancha com Cabelo Aventureiro e Chapéu Astral com aura +12 (o mais alto). `npm run check`, `npm test` (103) e `npm run build` passam; relatório de encaixe inalterado, proporção da cabeça 50% em pé.

## Inventário, ferreiro e arena

- Mochila e ferreiro usam a mesma moldura pintada com borda real de nove fatias e espaço interno reservado. Cabeçalho/moldura ficam fixos; conteúdo rola dentro. Encaixe inspecionado em 1536/1280/1024/390px e altura mínima 480px.
- Detalhes de itens somente em tooltip por hover/foco/toque prolongado, incluindo atributos, comparação e composição. Não há painel permanente de descrição no rodapé. Prévia, restauração, tintura, arraste e salvamento continuam funcionais. Ícone original de Poder aplicado ao inventário, perfil e cartas.
- Ferreiro com abas Fortalecer e Composição. Fortalecer preserva regras +0–12 e pedras I–V. Composição aplica minerais de Ataque/Defesa/Agilidade/Armadura com prévia, chance e custo; consumo e resultado são transacionais. Ver `composition.md`.
- `CONTENT_VERSION=9`: migração de roupas retiradas, minerais iniciais e nova dinamite para contas antigas, sem repor pilhas já gastas. Bônus de composição pertencem ao item e entram nos totais somente quando equipado. O cliente não define chance, bônus, saldo ou resultado.
- Arena ocupa toda a área do jogo, com cartas verticais, chat integrado e seleção ilustrada de mapas. Quatro vagas fixas por equipe: fechar três resulta em 1×1; fechar duas, 2×2; uma, 3×3; todas abertas, 4×4. Lacunas preservam índice e spawn.
- Dono pode remover outros ocupantes pelo X da carta durante a espera. O servidor impede ação de não dono, autoexpulsão, alvos de outra sala e expulsão durante batalha. O jogador removido volta à praça com a conexão ativa; ocupação muda sem fechar vagas. Alterar a equipe limpa a prontidão.

## Loja, recompensas e Power

- Loja com 29 ofertas, categorias, filtros masculino/feminino/todos, prévia acumulativa local, tooltip e carrinho. Compra conjunta com preço, saldo e posse autoritativos. Novos convidados começam com kit inicial e 500 Moedas Brasa; contas existentes mantêm a posse. Cosméticos novos não são repostos por migração. Detalhes em `shop.md`.
- Sete cosméticos novos: duas roupas, dois cabelos, dois óculos e um rosto universal. O cabelo Ondulado antigo ganhou pintura própria em vez do fallback. 24 montagens dos novos itens e 24 do Ondulado inspecionadas; seis rostos com alfa idêntico. Prompts em `shop-cosmetics-prompts.md`.
- Armas +0 repintadas com cores, com menos efeitos que as evoluções. Cesto de Pavio tem quatro artes, projétil/física/som próprios; fundo Super exclusivo em +9 ou mais. Quatro tipos de resíduos recortados pelo chão sobrevivente, sem pintar céu/crateras vazias e sincronizados em reconexões. Dinamite deixa queimadura; sorvete continua como exemplo de arma futura.
- Régua com marcas de 1/5/10, sem botões separados de carregar/andar. Timer sem fundo, alerta desde 10 segundos. Vida e retrato próprios no alto à esquerda. Resultado translúcido sobre o mapa, oito cartas exclusivas, todas as escolhas reveladas após 15 segundos, escolha automática no prazo e prêmio persistido em transação idempotente. Layout de resultados específico para celular. Ver `combat-rewards.md`.
- Power acumula por dano inimigo causado/recebido, com maior ganho ao receber. Só ativa cheio no próprio turno; tiro recebe dano/área/efeitos reforçados após animação central autoritativa de 1,4s. Círculo POWER no HUD e efeitos separados dos upgrades. Ver `combat-power.md`. Balanceamento ainda provisório.

## Evidências e verificações

- `npm run check`, 96 testes unitários (`npm test`), `npm run build` e `git diff --check`.
- `tests/integration.ts`: HTTP/WebSocket, equipamento, composição, fortalecimento, três projéteis por salva, reconexão e transações reais PostgreSQL; gastos concorrentes não duplicam recursos.
- `tests/maps.integration.ts`: três mapas, quatro clientes em 2×2, 30 projéteis. Última execução com discos físicos removeu 6.398 células do Jardim, 361 do Parque e zero da Fortaleza, preservando todas as regiões imutáveis.
- `tests/rooms.integration.ts`: oito clientes reais, capacidade esparsa, 4×4, snapshots idênticos, reconexão, expulsão/prontidão/chat e retorno ao lobby.
- `scripts/smoke-browser.mjs`: oito slots, duas roupas possuídas numa conta de teste com compras preparadas, tooltip, arraste/prévia/salvar/recarregar, fortalecimento, composição, treino e retorno à praça.
- `scripts/smoke-battle-controls.mjs`: valor visível = valor disparado, teto sem disparo automático, um envio, teclado/toque e cancelamentos. `scripts/smoke-maps.mjs`: três mapas, 27 projéteis, câmera, qualidade, áudio, reconexão e tela compacta.
- Harness de cenários: 12 combinações de mapas/qualidade/DPR, carregamento/falha, zero diferenças em frames equivalentes e reconstrução após impacto. Harnesses de roupa/caminhada/combate/aura preservam a cabeça universal e produzem pranchas inspecionadas.
- Capturas e relatórios ficam em `test-results/`, ignorado pelo Git. Prompts, contratos e medidas estão em `ui-art-prompts.md`, `apparel-prompts.md`, `arena-ui-prompts.md`, `level-badge-prompts.md` e demais documentos de arte.
- Versão atual recompilada e servida pelo Nginx; backend, PostgreSQL e Redis saudáveis. Testes atuais: compra real/persistência/concorrência e limite 70 (`economy.integration.ts`), PvP real com carga natural e disparo Power (`power.integration.ts`), cartas/reconexão/pagamento (`smoke-rewards.mjs`), loja em desktop/celular (`smoke-shop.mjs`) e controle de força (`smoke-battle-controls.mjs`). Os ensaios completos de mapas e salas acima são evidência da etapa anterior; não foram repetidos sem mudanças nesses contratos.
- Cloud com Node 24, Chromium, Docker, PostgreSQL e Redis. Instalação/inicialização salvas em rascunho; publicar é separado. HEAD base confirmado igual ao `main` remoto `89ce47a`; as alterações desta etapa estão no checkout, sem push automático.

## Limites concretos e continuidade

Os seis chapéus pintados usam agora artes vestidas e variantes de cabelo coberto, após a rejeição do encaixe anterior. Elmo do Guardião e Óculos de Voo ainda mantêm desenhos procedurais; o elmo usa a nova variante de cabelo. Ler `headwear-research.md` antes de continuar. A animação é 2D por recortes; dedos e expressões não têm animação completa. Preservar cabeça universal ao continuar essas peças.

Mapas têm tamanho fixo 1536×864 e células de 3px. No Chromium headless com SwiftShader, o ensaio isolado dos cenários apresentou mediana de 16,7ms em DPR1; DPR2 ficou entre 66,6–116,7ms. Isso não mede FPS do jogo completo nem desempenho em celular/GPU real. Qualidade baixa limita o backing canvas a 1×; não prometer ausência absoluta de serrilhado ou pausas em todos os aparelhos.

Perfis convidados dependem do cookie. Não há recuperação de conta, comércio/reposição econômica de minerais, guildas ou simulação distribuída. Partidas continuam em um processo e se encerram ao reiniciar o servidor. O ensaio antigo de 24 clientes/288 pings de lobby não demonstra capacidade de produção. Publicação pública, backups, TLS e carga em escala exigem trabalho próprio.

Retomar somente o escopo solicitado. Ler `AGENTS.md`, `continuation-prompt.md` e `face-authoring-rules.md`; pedidos recentes prevalecem sobre briefings históricos.

### Fechamento desta revisão

Build final local e HTML servido em `8097` idênticos: CSS `index-_l1TnIx6.css`, JS `index-BsHpMyv_.js`. Hashes de `server/game.ts`, `server/store.ts`, catálogo, protocolo, Power e loja conferidos contra o container. Health saudável, assets de cartas/moeda/cabelo respondendo PNG. Loja passou também no build de produção. Inventário/ferreiro/composição/disparo passaram no smoke com conta de teste preparada por compras reais; integração completa HTTP/WS/PostgreSQL passou após adaptar aquisição dos rostos ao kit inicial. Resultados mobile de cartas inspecionados. Nenhum commit ou push automático nesta revisão.

### Correção dos óculos Sprint/Gatinho

Encaixe independente pelos centros das lentes, escala uniforme e cabelo sobre as hastes. Cabeça/expressões preservadas. Prancha ampliada de seis rostos e quatro óculos em `test-results/glasses-fit.png`, complementada pela prancha de poses `shop-cosmetics-sheet.png`. Medidas em `shop-cosmetics-prompts.md`.

Chapéus também revisados: boné e Astral assentados pela base, rotação local, Óculos de Voo e elmo reduzidos. Cabelo acomodado sob a copa sem cortar laterais; cabeça universal preservada. Astral agora usa sua pintura existente no avatar e ícone. Evidência: `test-results/hats-fit.png` (30 combinações incluindo sem cabelo).

Validação desta correção: TypeScript, 96 testes e build aprovados; 30 combinações de rostos/óculos, 30 de cabelos/chapéus, 24 poses e seis rostos com zero diferenças de alfa. Prévia real da loja capturada com azul+boné e vermelho+Astral, sem erros de navegador. Cliente recompilado e servido em8097: `index-DtudFmA0.js`, HTML idêntico ao build local.

### Novos chapéus e cards compactos

Quatro chapéus pintados compráveis: Boné Relâmpago, Bucket da Maré, Boina Rubi e Chapéu Tropical; catálogo da loja agora33 ofertas. Migrações antigas excluem esses itens das concessões automáticas. Compra em lote e equipamento dos quatro validados em PostgreSQL.

Bonés usam contatos da faixa interna, sem dimensionar a cabeça pela aba; cabelo sob a copa tem acomodação localizada, preservando cauda/laterais, e passe abaixo da banda com proteção da aba. Substitui o encaixe anterior por caixa externa. Medidas e arte em `shop-cosmetics-prompts.md`.

Cards da loja: ~183px desktop, quatro colunas em1536px, duas colunas em390/360px; arte68px, preço/categoria juntos, prévia e carrinho compactos, sem espaço reservado para feedback vazio. Smoke completo da loja passou incluindo prévia local, filtros, tooltip, compra e persistência.

### Diagnóstico posterior — encaixe de chapéus ainda não aprovado

Os ajustes de faixa, compressão e mechas descritos acima foram tentativas intermediárias; o usuário rejeitou o resultado. A investigação de um cliente antigo disponível publicamente confirmou seleção de variantes A/B de cabelo conforme propriedade do chapéu, inclusive recarga do cabelo ao trocar somente o chapéu. Fontes fixadas por commit, limitações da pesquisa e contrato recomendado em [headwear-research.md](headwear-research.md).

Manter Canvas 2D e preparar artes compatíveis no molde universal. PixiJS/Spine não corrigem as pinturas isoladas existentes. Nesta investigação não houve nova alteração visual: variantes autoradas e composição traseira/frontal permanecem pendentes. Testes de compra/equipamento/persistência não devem ser apresentados como aprovação visual.

### Correção implementada — cabelo coberto e chapéu vestido

Após a autorização seguinte do usuário, o caminho provisório de compressão/mechas foi removido. Quatro pinturas novas compõem os cinco estilos de cabelo sob cobertura; seis chapéus foram redesenhados como peças vestidas. `headwear.ts` registra contato com o crânio, recorte e perfil coberto/aberto. Os ícones usam a mesma pintura vestida. Nuca e rabo de cavalo ficam atrás do rosto; franja e aba são montadas na frente, seguindo o rig em pé e no combate. Cabeça universal preservada. Elmo/Óculos de Voo conservam desenhos procedurais, com cabelo coberto/descoberto respectivamente.

TypeScript,96 testes e build passaram. `verify-headwear.mjs` executou258 casos com três condições de óculos e poses reais; pranchas ampliadas e poses inspecionadas, incluindo eliminação dos fragmentos vizinhos no atlas. `verify-faces.mjs` confirmou seis rostos com zero diferenças de alfa. Fontes e registros em `headwear-research.md` e `shop-cosmetics-prompts.md`. Build servido atualizado: `index-geuRugsw.js`, CSS `index-BXJpQn0G.css`. Não houve mudança de engine nem de regras de compra/posse.

Smoke no frontend de produção passou após liberar cache de builds que havia enchido o disco: prévia dos quatro chapéus da loja, compra, saldo, persistência, layout mobile e zero erros de navegador. HTML servido confirmado com `index-geuRugsw.js`. Captura real `test-results/shop-new-hats.png`; comparação ampliada com óculos em `test-results/headwear/heads-hats-5-8-hairs-1-2-cat.png`. Nenhum volume/banco foi removido na limpeza do cache.

### Quebra-Tijolos no checkout de desenvolvimento

O catálogo e a loja incluem a arma épica `brick` por 500 Brasas; a mecânica produz cacos autoritativos após o impacto principal e aplica demolição adicional em materiais resistentes. A arte final gerada por `image_gen` substitui as seis pinturas provisórias: quatro estágios da arma, atlas de efeitos e resíduo. Prompts, medidas e prancha estão em [brick-weapon.md](brick-weapon.md). Os testes específicos de física e combate foram adaptados ao checkout atual; `npx tsx --test tests/physics.test.ts tests/game.test.ts` passou com 27 testes.

## Lobby: menu inferior, chat e cursor (17/10/2026)
- Medalhas do topo removidas. Menu no canto inferior direito como no DDTank: ícones pintados grandes (`public/assets/ui/*-button.png`, sala PvP + gerados pelo Codex) numa tábua de madeira flutuante (ícones de 52 px), sem nomes visíveis nem teclas; "Como jogar" fora por enquanto. Chat transparente com texto contornado e faixa de madeira para digitar (`Hud.css`). Cursor pintado `public/assets/ui/cursor.png` (32 px, `--cursor-arrow`).
- Testes: check, test, build, `shot-lobby.mjs` e `test:mobile:browser` passaram na nuvem.

### Áudio: primeiros sons gravados

O impacto de todos os tiros agora toca duas camadas gravadas em `public/assets/audio/sfx/`: `impact-base.mp3` (grave, gerado pelo usuário) e `impact-crack.mp3` (estalo de médios, gerado pela API do ElevenLabs). As camadas tocam com tom sorteado entre ±5%; o som sintetizado da arma continua por cima, e o ruído sintetizado só toca enquanto os arquivos não carregaram. Plano completo e prompts em [audio-plan.md](audio-plan.md). A chave do ElevenLabs fica só no `.env` local (fora do git).

Sons do POW e da seleção de poderes (17/10/2026): `pow-activate-0[1-3].mp3` e `boost-select-0[1-3].mp3`, gerados pela API do ElevenLabs no PC do usuário e normalizados. `Scene.tsx` toca a deixa quando o servidor confirma mais um poder selecionado ou o POW armado do próprio jogador (`audio.cue`), sorteando uma das três variações.

Tiro POW e seleção de poder v2 (17/10/2026): `pow-shot-0[1-3].mp3` tocam no disparo e `pow-impact-0[1-3].mp3` na explosão de todo tiro POW (`audio.play` com `powered`), no lugar do brilho sintetizado; projéteis simultâneos dividem uma deixa só (250 ms). `boost-select-0[1-3].mp3` foram refeitos mais ricos a pedido do usuário. Com o PR #31, armas que tiverem som próprio de disparo/impacto não passam por `audio.play`, então ficam sem a camada POW gravada.

Sons menos robóticos (17/10/2026): o usuário achou os sons robotizados. Causa: os osciladores sintetizados (seno, serra, quadrada) tocavam por cima das gravações. Agora, quando há gravação carregada, nenhum oscilador toca (disparo `launch-0[1-3]`, impacto, POW, clique `ui-click-0[1-3]`, sua vez `turn-yours-0[1-3]`). Todos os sons de POW e de seleção de poder foram refeitos com prompts de foley natural ("no synthesizer, no electronic, no sci-fi"); o ElevenLabs aceita no mínimo 0,5 s, então o clique é cortado para 0,3 s.

## Virada do personagem ao andar (17/10/2026)

- Antes a virada misturava duas cópias espelhadas e semitransparentes e achatava o boneco na largura por 150 ms, o que parecia uma folha de papel girando. Agora o boneco troca de lado de uma vez, como no DDTank, com um agachamento curto e um pulinho nos pés (`turnPop` em `src/game/avatar.ts`). Vale para roupas, fantasias e combate.
- No lobby, o boneco só vira quando o movimento horizontal domina (`Scene.tsx`), para não ficar virando ao andar quase na vertical.
- Andar conferido nas cinco roupas e nas duas fantasias, com chapéus: todas mexem as pernas pelo mesmo mecanismo. Prévia: `docs/previews/lobby-turn.gif`.
- Passos (17/10/2026): o cliente suavizava a posição do lobby andando 16% da distância por quadro, e o servidor manda posição a cada 100 ms. A velocidade na tela oscilava entre 83 e 253 px/s, então as pernas aceleravam e freavam a cada pacote. Agora o boneco persegue a posição do servidor na velocidade de caminhada (`src/game/lobbyMotion.ts`), com ritmo constante e parada limpa. A caminhada caiu de 160 para 110 px/s (`LOBBY_WALK_SPEED` em `shared/lobby.ts`) e a passada cresceu (12 no Surfista, 11 nas outras), para cerca de 2,8 passadas por segundo em vez de 4,5 com o pé sempre plantado. Prévia: `docs/previews/lobby-steps.gif`.
- Pernas (17/10/2026): a pose pintada abre as pernas em 3/4, e a caminhada partia dessa abertura. Um passo virava um espacate largo e o seguinte uma tesoura, com os pés se cruzando. Agora cada perna inteira (quadril e pé) anda numa faixa 75% mais perto do meio (`WALK_LANE_PULL`), os dois passos ficam iguais e o pé balança mais baixo (7 em vez de 10). Prévia: `docs/previews/lobby-legs.gif`.

## Colisão no lobby (17/10/2026)

- Antes o jogador atravessava barracas, pódios e o portal da Arena. Agora cada estrutura tem uma base no chão (elipse em `LOBBY_OBSTACLES`, `shared/lobby.ts`, medida da parte de baixo da arte). O servidor anda o jogador com `lobbyStep`: ao encostar numa base, ele contorna pela frente, ou por trás quando o destino fica atrás. Clique sobre uma estrutura sem ação leva o jogador até a borda dela (`lobbyFree`). Teste: `tests/lobby-collision.test.ts`. Prévia: `docs/previews/lobby-collision.gif`.
- Lobby (17/10/2026, noite): sem o aviso "Clique na rua para caminhar"; caminhada de 110 para 132 px/s (`LOBBY_WALK_SPEED`). A passada mantém o tamanho e o ritmo das pernas sobe junto, com o pé apoiado sem escorregar.

## Ticket de Cor e menu da mochila (17/10/2026)

- O botão direito na mochila abre o menu do jogo: Equipar ou Remover, Aprimorar (abre o Ferreiro com o item carregado), Trocar cor e Excluir (com confirmação).
- A janela Trocar cor tem prévia, cores prontas e seletor RGB. Corpo e olhos ficam num botão ao lado do personagem.
- Cada troca gasta 1 Ticket de Cor. O jogador começa com 3, e a loja vende cada ticket por 60 moedas, com escolha de quantidade.
- A cor é guardada por cópia e decidida no servidor. A tintura gratuita antiga saiu, e as cores dela migraram.
- Cada cabelo, chapéu, óculos e roupa tem uma região de cor. Chapéus e roupas mudam só a parte principal; o validador mede a cobertura e desenha `colors.png`.
- Testes: `tests/colors.test.ts` e `npm run test:colors:browser`. Detalhes em `docs/color-tickets.md`.

## Informações do jogador e denúncias (17/10/2026)

- Botão direito em outro jogador (chat, praça, pódio, lista de online, sala PvP, retratos da batalha) abre Ver informações e Denunciar.
- Ver informações: janela no layout da mochila, só leitura, com tooltip dos itens, Poder e atributos.
- Denunciar: motivo pronto e texto opcional; a denúncia leva o chat do denunciado dos últimos 30 minutos. Limite de 5 por hora e 1 por alvo a cada 30 minutos.
- Painel `/admin/denuncias` com filtro por status, detalhe com o chat, anotação e resolver/descartar. Detalhes em `docs/player-reports.md`.

## Central de Expedições (17/10/2026)

- Botão Expedições no menu do lobby abre a Central: salas de até 4, quadro pintado que abre a escolha de expedição e dificuldade (só Fácil aberto).
- Formigueiro: estágio 1 no tronco caído (6 formigas de 3 tipos, corpo a corpo) e estágio 2 na câmara da rainha (flechas de longe, formigas saindo do ninho). Cartas ao fim de cada estágio, mais e melhores na rainha.
- Turno da instância reaproveitável (`shared/instanceTurn.ts`): aventureiros por agilidade, depois todos os monstros juntos.
- Estágios editáveis no `/admin` como mapas de instância, com lista de monstros e ninho.
- Testes: `tests/expedition.test.ts` (turno, plano das formigas, fluxo completo com os dois estágios, rainha atirando e invocando) e `node scripts/smoke-expedition.mjs`. Detalhes em `docs/expeditions.md`.

### Expedições: ajustes de 17/10 (noite)

- Formigas: barra de vida fina embaixo dos pés (sem nome, sem empilhar sobre as placas dos jogadores), ritmo por tipo (passo 175/115/65 px com variação de 85%–115%), 56 px de distância entre elas; quadros de andar centrados no corpo (`scripts/cut-monster-sheet.mjs`).
- Estágio 2: túnel do ninho sem colisão e apoiado no chão, ninho na boca do túnel, degrau ligando o chão ao trono. Formigueiro sem destruição de terreno (servidor também não guarda marca de explosão em chão que não quebra numa instância).
- Cada estágio volta para a sala; `room.expedition.stage` guarda o próximo; o líder pode escolher o estágio (provisório). Chegada das formigas e câmera nos dois lados só no estágio 1.
- Janela: arte nova (`picker-art.webp`) montada com os mapas e as formigas, dificuldades com degradê por cor, poder recomendado x poder do jogador; quadro da sala mostra a arte do estágio escolhido. Botão Convidar na sala. Barra da rainha saiu do topo: placa pequena embaixo dela. Objetivo abaixo do minimapa.
- Evidência: `npm test` (296), `npm run check`, `npm run build`, `test:expedition:browser`, `test:rooms:browser`, `test:battle:browser`, `test:mobile:browser`; jogo rodando com os dois estágios (capturas em `test-results/expedition-live/`).
- 17/10 (noite, 2): chão de cada estágio do formigueiro numa peça só (Codex, `chao.png`); quadro da sala com arte fixa pintada pelo Codex (`board.webp`), título 3D, selo do estágio e chances de drop (Pedra I, espaços livres para mais); `build:map` não avisa peça cortada pela borda da folha quando ela atravessa a borda do mapa.

## Vento e POW no HUD de combate (17/10/2026)

- Vento sem fundo: número com contorno, seta que empurra mais longe e mais rápido quanto mais forte o vento (1 a 3 rastros), e abaixo o vento do seu último tiro ("ÚLTIMO"), ao lado da força "Último" (`WindGauge` em `src/components/CombatGauges.tsx`).
- POW: a ativação com 100 funcionava; o orbe não mostrava a carga e ignorava o clique sem dizer por quê. Agora mostra a carga em % e, quando não pode ser usado, o clique mostra o motivo (encher acertando/recebendo dano, só na sua vez, voo, +1/+2/Tridente). Carga em pontos inteiros (99,6 parecia cheio e ficava travado).

## Partidas sobrevivem a reinício e queda (17/10/2026)

- Salas e partidas (PvP, treino, expedições) são gravadas no Redis (0,5 s) e no PostgreSQL (3 s, tabela `live_state`) e voltam quando o servidor sobe; o jogador reconecta direto na partida. Detalhes em `docs/live-state.md`.
- Quem cai no meio de uma partida mantém o lugar enquanto ela durar (até 5 min fora), em vez de sair após 30 s.
- Evidência: `tests/live-state.test.ts`; `npm run test:restart:integration` derruba o servidor real com SIGTERM e SIGKILL no meio de um treino e o jogador volta à mesma partida com a mesma vida.
- Corrigido junto: adicionar bot na sala de treino quebrava com uma arma só no arsenal.
- 18/10/2026: pausa de 1,2 s (`TURN_GAP_MS`) entre o fim do tiro (impacto, dano, queda) e o próximo turno em PvP, treino e expedições; câmera para no último impacto. Teste em `tests/fall.test.ts`.
- 18/10/2026: virar o personagem no lugar (setas/A-D) funciona a qualquer momento da partida: turno de outro jogador, tiro no ar, pausa de 1,2 s e turno dos monstros da expedição; um botão do HUD focado não engole mais as setas. Testes em `tests/game.test.ts`, `tests/expedition.test.ts` e `npm run test:battle:browser`.

Som de arremesso (18/10/2026): o usuário escolheu a opção G ("bola arremessada", ElevenLabs eleven_text_to_sound_v2, 1,0 s, prompt_influence 0,8, prompt "throwing a ball hard by hand, fast arm swing and a clear whoosh of the ball flying away through the air, throw sound effect, no impact", cortada para 0,9 s, ~-22 LUFS). Agora o disparo usa um só arquivo, `public/assets/audio/sfx/launch-throw.mp3`; `launch-01..03` saíram. As outras 14 opções rejeitadas ficam só no PC (`test-results/launch-options`). Correção (18/10): o Quebra-Tijolos tem som próprio de disparo no kit (`public/assets/audio/weapons/brick/fire.mp3`), que toca no lugar do `launch`; agora esse arquivo também é a opção G (a ~-16 LUFS, perto do volume do antigo). Arma com `fire` no kit usa o próprio arquivo; `launch-throw.mp3` é o padrão das demais.

Atributos clássicos do DDTank (18/10/2026, `docs/attributes.md`): fórmulas centralizadas em `shared/stats.ts`. Ataque multiplica (1 + Ataque/1000); Defesa (menos a Sorte do atacante) e Armadura (menos 3 × nível do atacante) reduzem com 0,95×X/(600 ou 500+X) combinadas multiplicativamente; crítico 45×Sorte/(800+Sorte)% com bônus 0,5+Sorte×0,00015; Vida = 950 + nível×50 + bônus de nível + Defesa/10; Vigor 240 + Agilidade/30; forja ×1,10 por nível no Dano da arma e na Armadura de roupa/chapéu, marcos +10 (×1,2) e +12 (×1,3) nos outros atributos da arma; turnos PvP pelo Delay acumulado (turnos seguidos possíveis). Testes em `tests/attributes.test.ts`. Depois (18/10): Ferreiro fortalece roupa e chapéu; Delay de tiro (150), passar (100), ferramentas (55 a 110) e habilidades (100 a 150), valores do Brasa ajustáveis; pedras de composição de Sorte I/II/III com arte gerada pelo Codex. Pendente: balancear expedições para a nova Vida.

Power-ups clássicos (18/10/2026, `docs/power-ups.md`): +1 0,90 (2 disparos), +2 0,60 (3), Tridente 0,50 (3 simultâneos), bônus +10/20/30/40/50% aditivos; +1/+2 exclusivos e uma vez por turno; novo +10% (50 de Vigor e Delay) com estrela de 4 pontas pintada pelo Codex. Testes em `tests/power-ups.test.ts`.

Guildas (18/10/2026, `docs/guilds.md`): criação por ouro, níveis 0–10, Loja/Ferreiro/Depósito limitados pelo nível da guilda, Riqueza ganha em GvG (10 por membro vencedor, uma vez por partida), bônus do Ferreiro +2%/nível na chance, Colar da Guilda Nv. 1 (+5% Vida, 800 ouro), botão GvG na sala e nome da guilda nos cards. Testes: `tests/guilds.test.ts`, `npm run test:guilds:integration`, `scripts/smoke-guilds.mjs` (prévias em `test-results/guilds/`). Pendente: arte pintada do colar e das três construções (há fallback com os ícones do lobby).

Chefão Mundial (18/10/2026, `docs/world-boss.md`): dragão com vida global e ranking no PostgreSQL (livro de dano idempotente, um evento ativo por vez), botão com o rosto do dragão na praça, janela com ranking em tabela e Entrar (tentativa solo, sem recompensa nem tela de resultado), resultado visível por 20 min, admin `/admin/eventos` (iniciar/parar agora, agendas em horário de Brasília, histórico). Testes: `tests/worldBoss.test.ts`, `npm run test:worldboss:integration`, `scripts/smoke-world-boss.mjs` (prévias em `test-results/world-boss/`). Arte pelo Codex (`docs/world-boss-art-prompts.md`). Pendente: sons do dragão.

Pets (18/10/2026, `docs/pets.md`): infraestrutura completa sem nenhum pet. Configuração central (`shared/petConfig.ts`), definição/qualidade/alimento/instância (`shared/pets.ts`), motor de habilidades com gatilhos, custo, recarga, chance, escudo, DoT/HoT, imunidade, bloqueio e anti-loop (`shared/petSkills.ts`), serviço transacional e migrações versionadas (`server/pets.ts`: `player_pets`, `pet_events`, `pet_feedings`, `pet_battle_results`), contribuição do pet em `attributes()`/FC via `Equipment.pet`, retrato no início da partida, habilidade ativa no turno, EXP/vitalidade liquidadas uma vez por partida, janela Pets com 5 abas e botão de pata no menu da praça. Testes: `tests/pets-empty.test.ts`, `tests/pets.test.ts`, `npm run test:pets:integration`; prévias em `/mnt/project-files/pets/`. Pendente: botão pintado, primeira espécie e arte.

Verdália, o primeiro pet (18/10/2026, `docs/pets.md`): planta com 3 aparências por nível (Broto, Botão, Flor), Raízes da Terra (passiva inata, ataque em área depois do tiro), Orbe da Natureza (tiro especial crítico de um projétil) e Orvalho Curativo (cura no começo de 3 turnos); presente único com 10 Adubo de Orvalho. Arte pelo Codex a partir da referência do matheus. Testes: `tests/pets-verdalia.test.ts`; prévia em `/mnt/project-files/pets/planta/verdalia-no-jogo.jpg`. Pendente: balancear, sons, número de cura.

## Síntese de pedras e colar sem aprimoramento (19/10)

- Aba **Síntese** no Ferreiro: 4 pedras de um nível → 1 do nível seguinte, sem custo e sem falha, para Pedras de Fortificação (I→V) e pedras de composição (I→III por atributo). Servidor valida estoque e níveis (`shared/synthesis.ts`, `Store.synthesize`); teste em `tests/synthesis.test.ts`; prévia `scripts/preview-forge-synthesis.mjs`.
- Colar não pode mais ser composto (o único aprimoramento que tinha); composições antigas de colar são descartadas na normalização do perfil.
- Corrigido: o comando `compose` recusava as pedras de Sorte (`luck-*`).
- 19/10 (revisão): Síntese virou tabela com categorias que abrem, máximo por linha, quantidade, custo em ouro (provisório: fortalecimento 10/25/60/150, composição 50/120 por síntese) e filtro "Mostrar apenas disponíveis". Item na bigorna sai da lista de equipamentos; sucesso no fortalecimento tira o item da bigorna.
- 19/10: validador de cosméticos mede lobby (folha de andar) e batalha (quadros pintados), `--only`; conjunto masculino Capitão Escarlate (roupa, cabelo, quepe, óculos) gerado pelo Codex, zerado no `verify:cosmetics --strict --only`; troca imediata entre pintura em pé e andar no lobby (`scripts/preview-lobby-walk.mjs`). Ver `docs/captain-art.md`.
- 19/10: gerador de prompts de cosméticos com temas (`docs/cosmetic-sets.json`, `scripts/cosmetic-prompts.mjs`) e trava de estilo; conjuntos masculinos Rima de Rua e Espadachim Errante zerados no `verify:cosmetics --strict --only`.
