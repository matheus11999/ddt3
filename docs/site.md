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

- As features mostram prints reais em `site/public/shots/` (batalha PvP, salas PvP, expedição e instância, Chefão Mundial, Hall da Fama, Pescaria); clicar amplia.
- Tirados de uma cópia do jogo com banco de teste e dados simulados (nomes de jogadores, níveis, ranking do Chefão e maior peixe da semana), usando os scripts de prévia (`preview-arena`, `preview-battle-hud`, `smoke-expedition`, `shot-fishing`, `preview-hall.ts`, `smoke-world-boss`). Nunca rodar esses scripts no banco de verdade.
- Sem selo BETA ao lado da logo e sem círculos girando (matheus rejeitou). Fundo do hero (`hero-bg2`) e do céu (`sky-bg`) gerados pelo Codex e ampliados para 2560 px.

## O que ainda é Brasa Arena

O nome e a logo **dentro do jogo** (título da aba, telas de carregamento, textos) continuam Brasa Arena; trocar é uma decisão separada.
