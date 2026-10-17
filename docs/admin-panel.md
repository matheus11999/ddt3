# Painel do administrador (`/admin`)

Painel separado do jogo, com login próprio. Primeira versão (17/10/2026): visão geral com estatísticas e editor de mapas. Jogadores, loja e eventos aparecem como "em breve".

## Acesso e segurança

- Credenciais só no ambiente do servidor, nunca no git: `ADMIN_USERNAME` e `ADMIN_PASSWORD_HASH`. Gere o hash com `npm run admin:password` (pede a senha, mínimo 10 caracteres, e imprime as duas linhas para o `.env`). O hash é scrypt com sal (`scrypt:<sal>:<hash>`, sem `$`, então o docker compose não o estraga). Sem as duas variáveis, o painel fica fechado e avisa na tela de login.
- Login com limite: 10 tentativas por minuto por endereço e, depois de 5 senhas erradas, usuário e endereço ficam travados por 15 minutos. Nome errado custa o mesmo tempo que senha errada.
- Sessão de 8 horas guardada no Postgres (só o hash do token), cookie `brasa_admin` httpOnly, SameSite=Strict, restrito a `/api/admin` e `Secure` quando `COOKIE_SECURE=true`. Toda escrita também passa pela checagem de Origin do servidor.
- Cada login, senha errada, salvamento e publicação vai para `admin_audit` e aparece em "Atividade do painel".

## Visão geral

Online agora, salas e partidas rolando; jogadores totais, novos hoje e na semana; ativos, partidas e vitórias do dia (dia de Brasília, como o ranking do lobby); gráfico de partidas por dia dos últimos 14 dias; ranking do dia (top 10) e últimos jogadores criados. Atualiza a cada 30 s.

## Mapas

Tipos: **PvP** (entra no sorteio das partidas), **Instância** (dungeons; guardada até as instâncias existirem) e **Lobby** (a Praça Celeste).

- **Salvar** grava um rascunho (versão nova no histórico). **Publicar** põe a versão no jogo na hora: o servidor troca colisão, spawns e nome, e avisa os jogadores conectados para recarregar a lista de mapas (`GET /api/maps`, evento `maps`). Partidas em andamento terminam no mapa antigo.
- **Histórico**: as últimas 50 versões; abrir qualquer uma no editor ou publicá-la direto. **Voltar ao original** tira a versão publicada e o jogo volta ao mapa do repositório.
- **Novo mapa**: escolha nome, código, tipo e o mapa de base (fundo e folhas de peças). Arte nova continua vindo pelo Codex (`docs/maps-kit.md`).

### Editor de mapas com peças (PvP e instância)

Usa o mesmo montador do `npm run build:map` (`shared/mapBuilder.ts`): as peças saem das folhas em magenta de `public/assets/maps/<id>/source/`, a colisão é traçada do alfa e os avisos são os mesmos (objeto flutuando, peça escondida, spawn sem chão, colado em objeto ou com obstáculo). Ao salvar, o editor monta o terreno e a prévia e manda para o servidor, que confere de novo os spawns e os limites da colisão; com spawn sem chão o mapa não pode ser publicado.

- Arrastar peças, objetos e spawns; Shift trava o eixo; setas movem 1 px (Shift: 10 px); Del apaga; Ctrl+D duplica; Ctrl+Z/Ctrl+Y desfaz e refaz; Ctrl+S salva; roda do mouse dá zoom; arrastar o fundo navega.
- Painel da peça: folha, número da peça, nome, X, topo, escala, virar, repetir espelhado no outro time, peça diferente no lado espelhado (`mirrorAs`), apoiar no chão (`rest`, `sink`), quebra com tiros, tem colisão.
- Painel do mapa: subtítulo, tipo, no sorteio PvP, largura em telas, espelhar para o outro time.
- Spawns: 4 por time, só na horizontal (o pé fica no chão); mostra a distância do 1x1 (ideal 900–1200) e espelha o time 1 no time 2.
- **JSON** baixa o layout no formato de `scripts/map-layouts/<id>.json`, para levar a mudança para o repositório e rodar `npm run build:map`.

### Editor do lobby

Desenha a praça com o próprio `LobbyWorld` do jogo. Move as estações (barracas, pódios, portal da arena, ferreiro) e muda a altura delas; move e redimensiona as pegadas no chão que os jogadores contornam (com "levar a pegada junto" ligado, a pegada acompanha a estação); move a entrada dos jogadores e os limites da área de caminhada. O ponto de usar o ferreiro anda junto com a barraca do ferreiro.

## Onde está o código

- Servidor: `server/admin.ts` (rotas e aplicação dos mapas publicados), `server/adminAuth.ts` (senha, limite de tentativas), `server/adminStore.ts` (tabelas `admin_sessions`, `admin_audit`, `game_maps`, `game_map_revisions` e as estatísticas).
- Formatos e validação: `shared/mapAdmin.ts`. Mapas publicados no jogo: `applyMapOverride`/`pvpRotation` em `shared/maps.ts`, `applyLobbyLayout` em `shared/lobby.ts`, cliente em `src/publishedMaps.ts`.
- Interface: `admin.html` e `src/admin/`. No nginx, `/admin` serve `admin.html` e `/api/admin/` aceita corpo de até 32 MB (o terreno montado).
- Teste no navegador: `ADMIN_PASSWORD=<senha> npm run test:admin:browser` (login, estatísticas, abre o Sonho Nevado, move a torre, salva, publica, confere `/api/maps` e volta ao original). Unidade: `tests/admin.test.ts`.
