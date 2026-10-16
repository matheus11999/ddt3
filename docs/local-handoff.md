# Retomar localmente — checkpoint de 16/10/2026

Repositório: `matheus11999/ddt3`, branch de entrega `main`. Este checkpoint reúne o trabalho da sessão cloud e termina na correção dos chapéus/cabelos. Não reiniciar o projeto nem retomar automaticamente outras pendências.

## Atualizar o checkout

No computador local, preserve primeiro qualquer alteração local indicada por `git status`. Não usar reset/clean para atualizar. Com a árvore local limpa e sem commits divergentes:

```sh
git switch main
git pull --ff-only origin main
```

Para uma instalação nova:

```sh
git clone https://github.com/matheus11999/ddt3.git
cd ddt3
```

Se o pull recusar por divergência, comparar e integrar os commits locais antes de continuar; não descartar trabalho.

## Iniciar

Com Docker Desktop/Engine executando containers Linux:

```sh
docker compose up -d --build
docker compose ps
```

Abrir `http://127.0.0.1:8097`. Os perfis ficam no volume local `brasa-data`. Não executar `docker compose down -v` para atualizar o projeto.

Para desenvolvimento com atualização automática, instalar Node.js 24 e executar:

```sh
npm ci
docker compose -f compose.yaml -f compose.dev.yaml up -d --build server
npm run dev
```

Abrir `http://127.0.0.1:5177`. Backend publicado em `127.0.0.1:4107`. Depois de mudar `shared/` ou `server/`, reconstruir o serviço `server`; Vite só atualiza o cliente.

Os auxiliares `/workspace/ddt3-cloud` eram adaptações do proxy/Chromium da cloud. **Não são necessários no computador local**. Usar os Dockerfiles e arquivos Compose deste repositório. Os caminhos `/workspace/generated_images` nos prompts são apenas a procedência da geração; todos os PNGs usados pelo jogo estão em `public/assets`.

## Onde paramos

- Correção mais recente: seis chapéus redesenhados como peças vestidas e quatro pinturas de cabelo coberto atendendo cinco estilos. O cabelo muda de variante conforme a cobertura; não é mais comprimido por colunas.
- `src/game/headwear.ts`: manifesto de chapéus, contato com o crânio, recortes, tinturas e ícones.
- `src/game/appearance.ts`: `COVERED_HAIR`, passagem posterior e franja. `avatar.ts` usa ambas no rig normal e de combate. O rosto universal não muda.
- Novos arquivos: `public/assets/headwear-worn-atlas.png` e `hair-covered-atlas.png`. Ícones dos seis chapéus usam a mesma arte vestida. Elmo e Óculos de Voo ainda usam desenhos procedurais; elmo seleciona cabelo coberto, óculos de voo preservam cabelo descoberto.
- Loja com cards compactos, prévia local, categorias/filtros, tooltip e carrinho transacional. Os quatro chapéus novos são comprados, nunca concedidos automaticamente por experimentar.
- O checkpoint também inclui arena até 4×4, inventário/ferreiro com composição, mapas/terreno e resíduos, HUD de força, Power, resultados PvP com cartas, arma Dinamite, roupas/rostos/óculos/cabelos, badges até 70 e direção artística viva. Consultar os documentos específicos antes de mudar esses sistemas.

Capturas de referência transportáveis: `docs/previews/headwear-fit.png`, `headwear-poses.png` e `shop-headwear.png`. São capturas reais desta revisão, não mockups. As demais pranchas podem ser regeneradas pelos scripts.

## Verificações

Nesta revisão passaram `npm run check`, 96 testes unitários e `npm run build`. A verificação de chapéus gerou 258 casos; pranchas ampliadas e poses foram inspecionadas com/sem óculos, sem cabelo e nos dois sentidos. Seis rostos mantiveram zero diferenças de alfa. Smoke de produção confirmou prévia dos quatro chapéus, compra, saldo, persistência e layout mobile, sem erros JS.

Para repetir:

```sh
npm run check
npm test
npm run build
npx playwright install chromium
node scripts/smoke-headwear.mjs
```

O smoke espera o jogo completo em 8097. A prancha visual precisa de Vite em 5177, pois importa módulos TypeScript. Em PowerShell:

```powershell
$env:BASE_URL = 'http://127.0.0.1:5177/?glasses=all'
node scripts/verify-headwear.mjs
Remove-Item Env:BASE_URL
node scripts/verify-faces.mjs
```

Em bash:

```sh
BASE_URL='http://127.0.0.1:5177/?glasses=all' node scripts/verify-headwear.mjs
node scripts/verify-faces.mjs
```

Os resultados regenerados ficam em `test-results/`, ignorado pelo Git. Conferir visualmente: os checks automáticos verificam carregamento/renderização, não gosto ou acabamento artístico.

## Limites e cuidados para continuar

- Dados/cookies de convidados, banco, partidas e processos da cloud não são transportados pelo Git. O volume local existente é preservado pelo Compose; instalação nova cria perfis novos. Não publicar dumps ou credenciais no repositório.
- Partidas/salas ficam em memória de um processo; reiniciar o servidor encerra partidas. Não existe validação de escala de produção para milhares de usuários.
- Balanceamento de economia, Power e recompensas é provisório. O projeto tem melhorias visuais, não uma certificação de acabamento de todo o jogo.
- Preservar cores vivas, poses próprias de roupa, cabeça universal, limites 70, regras de aura e autoridade do servidor descritas em `AGENTS.md`.
- Não restaurar roupas Celeste/Real nem o antigo ajuste de chapéus por compressão. A pesquisa e a implementação estão em `docs/headwear-research.md`.

## Prompt para a próxima conversa local

> Continue o projeto ddt3 a partir do checkpoint de 16/10/2026 em main. Leia AGENTS.md, docs/local-handoff.md, docs/implementation-status.md e docs/headwear-research.md. A última entrega corrigiu chapéus com artes vestidas e variantes de cabelo coberto, preservando rosto, óculos e poses. Inicie o ambiente local e confira o estado do Git antes de alterar. Preserve todo o trabalho já implementado e aguarde o próximo pedido para escolher a nova frente; não refaça o projeto nem retome pendências fora do escopo.
