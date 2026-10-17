# Instruções para o Claude

Leia e siga `AGENTS.md`: ele vale para todos os agentes, inclusive o Claude. Este arquivo é o resumo para retomar o trabalho: o que é o projeto, o que o usuário aprovou ou rejeitou, como trabalhamos e o que falta. Se algo aqui conflitar com um pedido novo do usuário, vale o pedido novo; depois atualize este arquivo.

## O projeto

- **Brasa Arena**: jogo de navegador, online, de artilharia por turnos, **igual ao DDTank** em direção de arte, personalização (rosto, cabelo, chapéu, óculos, roupa, fantasia) e combate (ângulo, força, vento, terreno destrutível). Assets e nomes são originais, pintados no mesmo estilo; nunca copiar arquivos do DDTank.
- Dono: matheus (GitHub `matheus11999`). Escreve em português, muitas vezes em maiúsculas e com mensagens curtas; responda em português, direto, com imagem do resultado.
- Repositório: https://github.com/matheus11999/ddt3. Pasta local do usuário: `D:\APPS\ddt` (roda com Docker, ver `AGENTS.md`).
- Stack: React + Vite (`src/`), servidor Node/TypeScript autoritativo (`server/`, WebSocket), código comum em `shared/`, PostgreSQL + Redis. Cliente nunca decide dano, chance, saldo ou posse.

## Sincronização: Codex, pasta local e nuvem

- O Codex também edita o projeto na pasta `D:\APPS\ddt`; as threads do Claude trabalham num clone do GitHub. São cópias separadas: tudo se encontra pelo GitHub.
- Antes de trabalhar: `git fetch` e confira `main`, branches `codex/*` e PRs abertos. Se o Codex tiver trabalho não enviado, peça ao usuário para ele fazer commit e push num branch, faça o merge e depois peça `git checkout main && git pull` no Codex.
- **Só um editor por vez** na pasta local. Quando várias threads terminam, **uma só** atualiza a pasta local (commit do WIP local primeiro, depois merge da `main`); as outras não mexem nela.
- Trabalho na nuvem: branch a partir da `main`, PR, CI verde, atualizar com a `main` logo antes do merge. Nunca force push, reset ou exclusão para resolver conflito.

## Como o usuário gera arte

- Não há gerador de imagens nas sessões de nuvem. O usuário gera a arte no ChatGPT/Codex a partir de prompts que nós escrevemos em `docs/*-prompts.md` (um arquivo por área: `lobby-art-prompts.md`, `shop-art-prompts.md`, `forge-art-prompts.md`, `backpack-art-prompts.md`, `pvp-arena-art-prompts.md`, `cosmetics-art-briefs.md` etc.).
- **A IA pinta a forma; o jogo desenha texto e números.** Nada de texto dentro da imagem gerada (placas, níveis, números de dano, VIP).
- Cosméticos: rodar `npm run verify:cosmetics` **antes e depois** de gerar qualquer cabelo, chapéu, óculos ou roupa (regra completa em `AGENTS.md` e `docs/cosmetics-fit.md`). Passar no validador não é aprovação: mostre `zones.png` e `matrix.png` ao usuário.
- Corpo deitado de roupa nova: pintar sobre `docs/templates/prone-body.png` (contrato em `docs/prone-combat.md`); nunca coordenadas de braço por roupa.

## Gosto do usuário (aprovado e rejeitado)

Regra geral: ele quer arte **pintada, nível DDTank**, com volume e cores vivas. Rejeita o que parece "simples", "infantil", vetorial ou "cara de IA". Ao mesmo tempo, em efeitos ele costuma rejeitar versões carregadas e ficar com a primeira versão simples e discreta. Mostre uma prévia antes de mudança visual grande e ofereça poucas alternativas lado a lado.

- **Aprovado**
  - Atrás de personagens, usar a aura/selo pintado do próprio jogo (`public/assets/ui/aura-*-sigil.png`), não círculos novos.
  - Texto com aparência 3D estilo DDTank quando for destaque (ex.: SUCESSO!/FALHOU do Ferreiro em SVG extrudado com Lilita One).
  - Asas pintadas de `level-badge-backdrops.png` no `UpgradeTag`.
  - Nível na sala PvP como número com brilho na cor da faixa + estrelas (`LevelNumber`); escudo VIP pintado (`VipBadge`, `vip-badges.webp`).
  - Números de dano empilhados por acerto; crítico com estrela vermelha simples desenhada em código atrás; intervalo de 380 ms entre tiros de rajada.
  - Aura do POW: pequena, quente e discreta.
  - NPCs do lobby como figura inteira que só respira; sombras desenhadas em código a partir do contorno.
- **Rejeitado**
  - Arte procedural/canvas como arte final do lobby ("jogo infantil").
  - Braços recortados e animados nos NPCs (pareciam quebrados); fogo na forja do lobby.
  - Asas e brasões desenhados em SVG à mão; medalhões de nível pintados, coroas de louro, raios girando.
  - Feixes de luz, brilhos e chanfros nos números de dano.
  - Chamas, selo pintado e brilho grande no POW; rótulo "+N°" de inclinação na mira.
  - No Ferreiro: registros Atual/Próximo e selo circular atrás do item.
  - Na mochila: losango de raridade sobre o item, texto "clique para equipar", força do item fora do hover, pedras com quantidade 0.
  - Na loja: carrinho, "Poder na prévia", filtros Masculino/Feminino/Unissex, texto "Unissex", ícone de olho, arma atual no provador, texto "Na mochila".

## Padrão visual compartilhado

- **Fontes** (`src/fonts.css`, `public/fonts/`): Nunito no corpo, Cinzel só em títulos de janela, Lilita One em textos de destaque 3D (resultado do Ferreiro, números de combate).
- **Estilo madeira**: mochila, ferreiro, loja, salão e sala PvP usam madeira laranja, barra de título escura com título dourado e painéis creme. Tokens e classes `wood-*` em `src/components/WoodTheme.css`; menus usam a moldura fina de `MenuFrame.css`.
- **Componentes reaproveitados**: `InventoryTooltip` (exportado da mochila, prop `action`), cards de classe por `data-tier` (regras em `Backpack.css` com `:is(.bag-window, .smith-window, .shop-window)`), `UpgradeTag`, `LevelNumber`, `LevelBadge`, `VipBadge`, `Avatar` (`animated={false}` nas prévias). Se mudar card ou tooltip da mochila, confira ferreiro e loja.
- Classes raiz: `.bag-window` (mochila), `.smith-window` (ferreiro), `.shop-window` (loja), `.pvp-hall` e `.pvp-room`.
- Personagem: cabeça 30% maior (`HEAD_SCALE=1.3` em `src/game/rig/anchors.ts`); cabelo, chapéu e óculos seguem a cabeça. Chapéu mostra o mesmo penteado de sem chapéu, cortado pelo chapéu.
- Combate deitado: arrasta ao andar, arma nas costas apontando a mira, só aparece na mão ao carregar/atirar; armas de arremesso (dinamite, tijolo) saem da mão.
- Lobby "Praça Celeste": praça com 3 telas de largura (4608 px, `shared/lobby.ts`), câmera segue o jogador; os três "portais" são o pódio do ranking PvP diário: os 3 jogadores com mais vitórias no dia (horário de Brasília, partidas contra bot contam) aparecem em pé no pódio com a roupa equipada, nome e vitórias, sem o anel/halo de brilho atrás (`Store.dailyRanking`, evento `ranking`). Prompts em `docs/lobby-art-prompts.md`; o Codex entrega imagens em `public/assets/lobby` e não edita o código do lobby.

## Testes e prévias

- Antes de entregar: `npm run check`, `npm test`, `npm run build`, mais os testes da área (`npm run test:shop:browser`, `test:rooms:browser`, `test:battle:browser`, `test:mobile:browser` etc., ver `package.json`).
- Cosméticos: `npm run verify:cosmetics` (relatório em `test-results/cosmetics/`). Rostos: `node scripts/verify-faces.mjs`. Mapas: `node scripts/inspect-maps.mjs`.
- Prévias com dados falsos: `node scripts/preview-shop.mjs` e `node scripts/preview-arena.mjs`. O lobby (`node scripts/shot-lobby.mjs`) precisa do jogo rodando. Na nuvem use `CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` se o Playwright não achar o navegador.
- Rodar o jogo na nuvem: PostgreSQL 16 na porta 5447 (usuário/senha `brasa`/`brasa_local`), Redis na 6397, `npx tsx server/index.ts` e Vite na 5177. Alguns smoke tests (ex.: compra legada da loja) precisam de Docker e só passam na máquina local.
- Celular joga só em paisagem; teste também no layout de celular.

## Pendências para continuar

- **VIP no servidor**: o escudo VIP existe só na interface; não há dado de VIP persistido.
- Comprar de novo item que já possui: feito (PR #27). Cada compra repetida vira cópia separada (`id~2`, `id~3`…) com forja e composição próprias; `equipment.copies` diz qual cópia está vestida (ver `docs/shop.md`).
- **Rabo de cavalo sob chapéu**: com chapéu o penteado perde o rabo; falta arte do rabo visível abaixo do chapéu (gerar pelo fluxo de cosméticos).
- Lápide no lugar do jogador morto (sem barra de vida; pode assistir até o fim e receber recompensa, ou sair e perder a recompensa): em andamento numa thread em 17/10/2026.
- Perguntas abertas: permitir itens de tiro junto com o voo; arte pintada pendente da loja (fundo do provador, ícones de categoria, placa) e do piso do lobby (`floor.webp`).
- PR #1 (Quebra-Tijolos antigo) está obsoleto: a versão do Codex já está na `main`.
- Registre evidências e pendências também em `docs/implementation-status.md`.
