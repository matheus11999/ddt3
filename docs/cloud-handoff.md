# Continuidade na cloud

Para sair da cloud e continuar no computador local, seguir [local-handoff.md](local-handoff.md), que registra o checkpoint mais recente, os comandos e as limitações de transporte de dados.

## O que acompanha o repositório

Código-fonte completo, lockfile npm, infraestrutura Docker, PNGs originais, fontes locais com licenças, prompts de arte, regras e testes. A cloud não precisa acessar pastas `C:\Users\...` ou `D:\APPS\...` da máquina original. Caminhos históricos citados em logs de geração não são dependências de execução.

Dados de convidados e partidas do PostgreSQL local **não estão no Git**. Um ambiente novo inicia perfis novos. Agentes desta conversa também não são processos salvos: recriar os papéis relevantes de `AGENTS.md` quando a continuidade for solicitada.

## Leitura inicial

1. `AGENTS.md` — regras e divisão dos agentes.
2. `docs/implementation-status.md` — concluído e pendente.
3. `docs/face-authoring-rules.md` — shape obrigatório para novos rostos.
4. `docs/continuation-prompt.md` — instrução consolidada.
5. `docs/art-prompts.md`, `face-art-prompts.md` e `map-art-prompts.md` — prompts/referências.

## Instalação e checks em Linux

Use Node.js 24 e npm. Execute na raiz do checkout:

```sh
npm ci
npm run check
npm test
npm run build
```

Não usar diretório absoluto do computador anterior. `package-lock.json` define a instalação reproduzível.

## Ambiente completo com Docker disponível

```sh
docker compose up -d --build
docker compose ps
```

Jogo e API em `http://127.0.0.1:8097`. Para Vite com atualização automática:

```sh
docker compose -f compose.yaml -f compose.dev.yaml up -d --build server
npm run dev -- --host 0.0.0.0
```

Vite usa porta `5177` e proxy para backend `127.0.0.1:4107`. O override publica o backend somente em loopback. Se a plataforma cloud oferece uma URL de preview por proxy, configurar `ALLOWED_ORIGINS` com as origens exatas permitidas e encaminhar também WebSocket. Não desativar a validação de origem para contornar um erro de preview. A execução pública precisa HTTPS e `COOKIE_SECURE=true`.

Após mudanças em `shared/`/`server/`, reconstruir o serviço server. O navegador não atualiza automaticamente a imagem do backend.

## Quando Docker não estiver disponível

Checks, unitários e build funcionam sem Docker. Para o jogo completo, são necessários PostgreSQL e Redis acessíveis, provisionados pelo ambiente, e suas URLs em segredos/variáveis locais:

```sh
export DATABASE_URL='postgres://USUARIO:SENHA@HOST:5432/BANCO'
export REDIS_URL='redis://HOST:6379'
export PORT=4107
export ALLOWED_ORIGINS='http://127.0.0.1:5177,http://localhost:5177'
npm run dev:server
```

Em outro processo, iniciar Vite. `.env.example` é somente modelo; scripts npm não carregam `.env` automaticamente. Nunca colocar credenciais reais no Git. Se não houver esses serviços, informar o bloqueio do multiplayer; não simular persistência ou inventar testes de integração aprovados.

## Navegador/testes na cloud

Os scripts usam Edge no Windows e Chromium do Playwright no Linux. Para instalar o navegador no Linux (quando o ambiente permitir instalar dependências):

```sh
npx playwright install --with-deps chromium
```

`BROWSER_CHANNEL` permite escolher explicitamente um canal instalado. Com Vite acessível:

```sh
BASE_URL=http://127.0.0.1:5177 node scripts/verify-faces.mjs
BASE_URL=http://127.0.0.1:5177 node scripts/smoke-browser.mjs
BASE_URL=http://127.0.0.1:5177 node scripts/inspect-maps.mjs
BASE_URL=http://127.0.0.1:5177 npm run test:rooms:integration
BASE_URL=http://127.0.0.1:5177 npm run test:battle:browser
BASE_URL=http://127.0.0.1:5177 npm run test:maps:integration
BASE_URL=http://127.0.0.1:5177 npm run test:maps:browser
BASE_URL=http://127.0.0.1:5177 npm run test:outfits
BASE_URL=http://127.0.0.1:5177 node scripts/smoke-outfits.mjs
```

`verify-faces` e `inspect-maps` importam módulos TypeScript servidos pelo Vite; não apontar esses harnesses para Nginx de produção. `smoke-browser` exige backend e pode rodar em `8097`. `npm run test:integration` também requer backend e usa `docker compose exec` na parte transacional; sem Docker, adaptar essa parte a um banco de testes dedicado antes de anunciar aprovação. Ele cria convidados `TEST-*`; não usar banco de produção para QA.

Capturas e relatórios ficam em `test-results/`, ignorado. A prancha facial aprovada está em `docs/previews/faces.png`. Avaliar visualmente, não só pelo exit code.

## Arte e continuidade segura

Utilizar a ferramenta de geração/edição de imagem disponível no ambiente quando produzir pinturas novas. Os PNGs atuais estão versionados, então executar o jogo não depende dela. Se geração de imagem estiver indisponível, continuar código/testes independentes e registrar a pendência; não substituir arte final por SVG genérico silenciosamente.

Preservar o compositor universal de rostos e seu teste. Surfista, Executivo, Piloto Relâmpago e Dançarina Rubi carregam por registro individual; roupas antigas foram removidas. O flag geral de camadas modulares permanece desativado intencionalmente. Chapéus vestidos e variantes de cabelo coberto estão integrados pelos registros específicos. Cada conjunto tem uma pose base própria. O estado exato está em `implementation-status.md`.

## Ambiente desta sessão cloud

Node24, Docker/Compose e Chromium do sistema foram executados em Linux. O setup salvo usa auxiliares em `/workspace/ddt3-cloud`, fora do repositório, para encaminhar a CA do proxy ao build e respeitar os usuários de execução node/nginx. Nenhuma verificação TLS foi desativada. `use-system-chromium.mjs` seleciona `/usr/bin/chromium` pelo `executablePath` do Playwright quando o download do navegador empacotado é bloqueado. Exemplo neste ambiente: `node --import /workspace/ddt3-cloud/use-system-chromium.mjs scripts/smoke-browser.mjs`.

Scripts de instalação/inicialização foram salvos no rascunho da configuração. Salvar o rascunho não publica o ambiente; revisar/salvar nas configurações e publicar continua sendo uma ação separada. Não assumir restauração em tarefa nova sem verificá-la.

## Git

Repositório: `https://github.com/matheus11999/ddt3`. Verificar branch/status e instruções do ambiente antes de alterar. A entrega inicial é um checkpoint em `main`; trabalho futuro deve preservar o histórico, preferencialmente em branch/PR conforme o fluxo solicitado. Não usar force push. Não criar uma nova tarefa cloud automaticamente: o usuário continuará a partir deste repositório.
