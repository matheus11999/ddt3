# Site Bomb Masters

Pedido do matheus em 20/10/2026: site do jogo com o novo nome **Bomb Masters**, em container próprio, com hero chamativo, recursos do jogo, aviso de beta (membros do beta recebem cosméticos exclusivos), PC e celular, login e cadastro bonitos, página do jogador com botão **JOGAR** e um mini fórum para a comunidade.

## Onde fica

- `site/`: página React (`site/src`), servidor Fastify (`site/server`) e arte (`site/public/art`, WebP).
- Container `site` no `compose.yaml` (`infra/Dockerfile.site`), em `127.0.0.1:8098`, usando o mesmo Postgres do jogo. Sobe junto com `docker compose up -d --build`.
- Variáveis: `GAME_URL` (para onde o JOGAR leva, padrão `http://localhost:8097`), `SITE_ORIGINS` (origens aceitas nos POST), `COOKIE_DOMAIN` (domínio pai em produção, por exemplo `.bombmasters.com.br`, vale para site e jogo), `COOKIE_SECURE`, `SITE_BEHIND_PROXY`.
- Desenvolvimento: `npm run start:site` (API e página pronta em 4120, precisa de `npm run build:site`) ou `npm run dev:site` (Vite em 5178 com proxy para 4120).

## Contas (uma conta para site e jogo)

- Tabelas `accounts` (usuário 3–16 letras/números/_, e-mail, senha scrypt, `player_id`) e `account_sessions`, criadas por `server/accounts.ts`, usado pelo site e pelo servidor do jogo.
- O site entra com o cookie `bm_account`. Cada servidor do jogo (variável `SERVER_ID`, padrão `s1`) troca a conta pela sessão do jogo (`brasa_session`) em `/api/session` (`server/index.ts`, `accountSession`):
  - **um personagem por servidor** (`account_characters`; lista de servidores em `game_servers`: nome, endereço, status online/manutenção/em breve). Servidor novo = linha em `game_servers` + jogo rodando com o seu `SERVER_ID`;
  - conta com personagem neste servidor: abre esse personagem;
  - conta sem personagem neste servidor: adota o convidado que já existe neste navegador (se nenhuma conta for dona dele) ou pede o gênero e cria o personagem com o nome do usuário;
  - personagem de outra conta nunca é usado. Os personagens ligados antes dos servidores (coluna antiga `accounts.player_id`) viraram do Servidor 1 (`s1`).
- Convidados sem conta continuam podendo jogar direto pelo jogo.
- Sair no site apaga os dois cookies.
- Logado, o topo é do jogador (Início, Fórum, Configurações, avatar), sem link para a landing; `/` leva para `/jogador`. JOGAR (botão de madeira dourada do jogo) abre a escolha de servidor.
- Configurações (`/configuracoes`): avatar (6 pintados em `site/public/avatars/`, recortados por `site/art-source/avatars.mjs`) e troca de senha (pede a atual e encerra as outras sessões).

## Fórum

- Categorias em `site/src/forumRules.ts` (Sugestões, Geral, Dúvidas, Bugs do beta, Guildas); tabelas `forum_topics`, `forum_replies`, `forum_likes` (`site/server/forum.ts`).
- Membros criam tópicos, respondem, curtem (tópico e resposta) e apagam o que escreveram. Texto puro, nunca HTML.
- Ainda não há moderação pelo `/admin` (fixar, apagar de outros).

## Arte

- Logo, hero e panoramas vieram do protótipo visual do Codex (`D:\APPS\bombmasters-site`, 20/10), convertidos para WebP.
- `heroes-beta` e `hall-of-fame` foram gerados pelo Codex com as artes do jogo como referência; prompts em `site/art-source/prompts.json` (`node site/art-source/run.mjs [id]`). Os PNG originais ficam fora do git.
- Prévia: `node scripts/preview-site.mjs [url]` (cadastro, página do jogador, fórum e Jogar) grava `test-results/site/*.png`.

## Telas do jogo (21/10, pedido do matheus)

- As features mostram prints reais em `site/public/shots/` (batalha PvP, Praça Celeste com o Chefão ativo, salas PvP, expedição e instância, Chefão Mundial, Hall da Fama, Pescaria); clicar amplia.
- Tirados de uma cópia do jogo com banco de teste e dados simulados (nomes de jogadores, níveis, ranking do Chefão e maior peixe da semana), usando os scripts de prévia (`preview-arena`, `preview-battle-hud`, `smoke-expedition`, `shot-fishing`, `preview-hall.ts`, `smoke-world-boss`). Nunca rodar esses scripts no banco de verdade.
- Sem selo BETA ao lado da logo e sem círculos girando (matheus rejeitou). Fundo do hero (`hero-bg2`) e do céu (`sky-bg`) gerados pelo Codex e ampliados para 2560 px.

## O que ainda é Brasa Arena

O nome e a logo **dentro do jogo** (título da aba, telas de carregamento, textos) continuam Brasa Arena; trocar é uma decisão separada.

## Criação de personagem e landing curta (21/10, pedido do matheus)

- Conta logada sem personagem no servidor sempre passa pela criação (o convidado do navegador não é mais adotado). A tela (`src/components/CharacterCreation.tsx`, fundo `public/assets/ui/creation-bg.webp` do Codex) pede gênero e **nome**: regras em `shared/characterName.ts` (3 a 16 letras, números ou _, sem nomes de staff nem palavrões) e nome livre no servidor (`GET /api/character-name`, conferido de novo no `POST /api/session` com trava no banco).
- Personagem novo começa só com o **Vento Celeste** (`wind-shuriken`) e rosto, cabelo e roupa básicos do gênero (`newCharacterEquipment`); sem chapéu, óculos ou fantasias. Personagens antigos não mudam. Clientes de teste sem conta e sem nome continuam criando o convidado antigo.
- Landing: só o hero (com "Beta aberta", hero `hero-3` do Codex com degradê) e a galeria "Telas do jogo" (`#prints`, Ver o jogo). Login e cadastro em abas, com validação dos campos e força da senha.

## Rodada de 21/10 (madrugada)

- Criação de personagem: cena pintada da Praça Celeste em tela cheia (`public/assets/ui/creation-scene.webp`, Codex) com dois pedestais; o escolhido fica no da frente, o outro no de trás (`--front-*`/`--back-*` em `CharacterCreation.css` marcam o topo dos pedestais), e a janela de madeira do jogo com ♂/♀, nome e Entrar no jogo.
- Site: hero `hero-4` (mapa Sonho Nevado, Codex com GPT-6 Astra médio: `CODEX_MODEL=gpt-6-astra CODEX_EFFORT=medium node site/art-source/run.mjs <id>`), Telas do jogo em carrossel (troca sozinho a cada 5 s, pausa com o mouse em cima, miniaturas embaixo).
- Página do jogador: só o JOGAR, o card da recompensa da beta (baú `beta-reward.webp`) e a comunidade. Personagens por servidor ficaram em `/personagens` (Personagens no topo).
- Campos preenchidos pelo navegador mantêm o fundo escuro (`:-webkit-autofill`).

## Headers, anexos do fórum e segurança (21/10)

- Toda página interna usa `PageHeader` (`site/src/PageHeader.tsx`): mesma altura, pintura própria do Codex em `site/public/art/banner-<página>.webp` (fórum, tópico, jogador, personagens, configurações), todas recortadas em 2560×900 por `node site/art-source/banners.mjs <ids>`.
- Fórum: **Criar tópico abre uma janela** (modal) com categoria, título, mensagem e até 4 imagens ou vídeos; respostas também aceitam anexos (resposta só com imagem vale).
- Anexos (`site/server/media.ts`): PNG, JPG, GIF, WEBP (até 5 MB) e MP4, WEBM (até 30 MB), 40 por conta por dia; o tipo é decidido pelos bytes do arquivo (SVG, HTML e o resto são recusados), o JPEG perde o EXIF/GPS, o nome é aleatório, o arquivo fica no volume `site-uploads` (`UPLOAD_DIR`) e só aparece quando o próprio autor o anexa (uma vez). `/media/<id>.<ext>` serve com o tipo certo, `nosniff` e CSP `sandbox`.
- Login do site: 5 senhas erradas bloqueiam aquele usuário por 15 min, 20 por endereço (mesma regra do `/admin`); a troca de senha tem o mesmo limite. Testes: `tests/site-media.test.ts`.
- Revisado em 21/10: rotas do `/admin` exigem sessão (só `/api/maps` é público, por ser lido pelo jogo), login do admin com scrypt, bloqueio e auditoria; nada no site ou no jogo usa `innerHTML`.

## Um endereço só: site em /, jogo em /game (21/10, pedido do matheus)

- O container `web` (porta 8097) é a porta de entrada: `/game` abre o jogo, `/admin` o painel, `/assets`, `/fonts`, `/api` e `/ws` são do jogo, `/api/site` e todo o resto vão para o container `site` (`infra/nginx.conf`; no desenvolvimento o Vite faz o mesmo, `SITE_PATHS` em `vite.config.ts`). O site não publica mais a porta 8098. Em produção: `bombmasters.com` é o site e `bombmasters.com/game` o jogo.
- Para não colidir com o jogo, os arquivos gerados do site ficam em `/s/` e as fontes em `/site-fonts/`.
- `GAME_URL` (padrão `/game`) é o endereço do Servidor 1 no Jogar; o `s1` em `game_servers` acompanha essa variável ao iniciar.
- **O jogo só abre com conta do site**: sem conta, `/api/session` responde `signIn` e o jogo manda para `/jogador?entrar`; não há mais convidado nem criação de conta pelo jogo (só a criação do personagem, com a conta). O WebSocket exige a conta dona do personagem neste servidor. `ALLOW_GUESTS=true` traz o convidado de volta só para testes de integração e scripts de carga locais.
