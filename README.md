# Brasa Arena

Jogo de navegador de artilharia por turnos, com rua social, salas, terreno destrutível, equipamentos visuais e ferreiro. Cliente React + Canvas 2D; servidor TypeScript autoritativo com WebSocket, PostgreSQL e Redis.

**Retomada local:** leia [o checkpoint e os comandos de execução](docs/local-handoff.md). A última entrega da cloud integra chapéus vestidos e variantes de cabelo sob cobertura, com prévia, compra e poses verificadas. Código e artes necessários acompanham o repositório.

## Checkpoint — cenários, roupas e interface, 16/10/2026

Esta etapa retoma os cenários e a personalização a pedido do usuário. Jardim, Parque e Fortaleza têm novas pinturas de ambiente e terreno, cores vivas e materiais distintos. Surfista da Maré, Executivo, Piloto Relâmpago e Dançarina Rubi têm poses base próprias. A loja reúne armas e cosméticos, incluindo cabelos e óculos novos. Menus usam fundos pintados e molduras com área interna reservada, incluindo mochila e ferreiro.

Seis expressões pintadas estão integradas aos ícones, à prévia, ao lobby e ao combate, usando a mesma cabeça universal; trocar a expressão não muda o contorno nem o encaixe do cabelo.

![Cinco expressões na mesma cabeça, com e sem boné](docs/previews/faces.png)

Para continuar: leia [estado e pendências](docs/implementation-status.md), [prompt de continuidade](docs/continuation-prompt.md) e [responsabilidades dos agentes](AGENTS.md). O jogo continua em desenvolvimento: cabelos, chapéus, empunhadura e articulações ainda têm pendências. Corpos pintados são ativados individualmente; o flag geral de aparência modular continua desativado.

## Executar com Docker

Requer Docker Engine/Desktop em modo Linux e Docker Compose v2. A imagem instala o runtime Node.js 24 e as dependências; não é necessário Node no computador para esta opção.

```powershell
docker compose up -d --build
docker compose ps
```

Abra [http://127.0.0.1:8097](http://127.0.0.1:8097). A primeira abertura cria um aventureiro convidado. O estado dos serviços pode ser consultado em [api/health](http://127.0.0.1:8097/api/health).

```powershell
docker compose logs -f server
docker compose down
```

O último comando encerra os serviços e preserva o volume `brasa-data`, que contém os perfis. A configuração padrão publica somente o navegador em `127.0.0.1:8097`; PostgreSQL e Redis permanecem na rede interna do Compose.

## Desenvolvimento

Requer também Node.js 24 e npm no computador. Use o servidor Docker com o cliente Vite:

```powershell
npm ci
docker compose -f compose.yaml -f compose.dev.yaml up -d --build server
npm run dev
```

Abra [http://127.0.0.1:5177](http://127.0.0.1:5177). O arquivo `compose.dev.yaml` publica o servidor em `127.0.0.1:4107`; o Vite encaminha `/api` e `/ws` para essa porta. Mudanças em `src/` têm atualização automática; mudanças em `server/` ou `shared/` exigem reconstruir o serviço `server` com o comando acima.

`npm run build` verifica TypeScript e gera `dist/`. `npm run dev:server` oferece reinício automático para um backend executado diretamente no computador, desde que `DATABASE_URL` e `REDIS_URL` estejam definidos e acessíveis. O Compose padrão não publica essas duas dependências no host, e os scripts npm não carregam `.env` automaticamente.

## Jogar

- Clique no chão da rua para caminhar e veja outros jogadores no mesmo canal. Entre na arena para criar ou encontrar salas de 1×1 até 4×4; o líder pode adicionar bots, fechar vagas por equipe e remover ocupantes durante a espera.
- Na batalha, use setas para andar e mirar; segure e solte Espaço para disparar. `1`–`7` selecionam ferramentas e `P` passa o turno.
- `B` abre a mochila e `R` abre a arena. Clique, dê duplo clique ou arraste um item para experimentar; **Salvar** publica a combinação. **Restaurar** volta ao visual salvo. Slots atuais: arma, rosto completo, roupa completa, cabelo, chapéu, óculos, pulseira e bracelete. As duas joias não aparecem no corpo.
- Visite o ferreiro para fortalecer armas. Escolha a arma por clique ou arraste, adicione pedras e confira a chance antes de confirmar. A aba **Composição** aplica minerais de Ataque, Defesa, Agilidade e Armadura; exibe bônus, chance e custo de ouro.

O nível máximo é **70**, com badges cinza (1–10), verde (11–20), azul (21–30), bronze (31–40) prata (41–50) e dourado (51–70). As bases acompanham a cor e a aura cresce a partir do nível 30, com mais camadas no 40, 50, 60 e 70. Há quatro armas com dano, gravidade, tamanho físico do projétil, cratera e efeitos próprios, três mapas em desenvolvimento, chat de mundo/sala, treino com bot e progressão persistente. Os estágios visuais das armas são **+0–8**, **+9**, **+10–11** e **+12**; as auras automáticas começam em **+5**, evoluem em **+9** e chegam ao estágio completo em **+12**. A aura luminosa do personagem aparece na mochila, perfil, cartas da arena e retrato do HUD/resultados. No combate o corpo é compacto, baixo, com a arma atrás. Os cenários e suas limitações estão em [maps-checkpoint.md](docs/maps-checkpoint.md).

A Loja da Brasa oferece prévia de equipamentos, categorias, filtros de estilo e carrinho. Moedas Brasa usam o saldo existente de `gold`; compras são transacionais. Ao fim do PvP, cada jogador escolhe uma das oito cartas exclusivas; todas revelam seus prêmios após 15 segundos, com escolha automática para quem não selecionou.

## Verificação

```powershell
npm run check
npm test
npm run build
```

Com o ambiente Docker completo aberto em `8097`:

```powershell
npm run test:integration
npm run test:maps:integration
npm run test:rooms:integration
npm run test:load
```

Para testar pelo Vite:

```powershell
$env:BASE_URL = 'http://127.0.0.1:5177'
npm run test:integration
npm run test:load
Remove-Item Env:BASE_URL
```

A integração cria dois convidados `TEST-*`, exercita HTTP/WebSocket e executa verificações transacionais no PostgreSQL do serviço `server`. O teste transacional usa uma conta própria, removida ao terminar; os convidados de rede permanecem identificados como teste. A carga padrão abre 24 sessões, movimenta jogadores, mede 288 respostas de ping e verifica rejeição de comandos. `LOAD_CLIENTS` e `LOAD_ROUNDS` ajustam o ensaio; o resultado é JSON.

Com Vite rodando, `node scripts/verify-faces.mjs` verifica cinco pinturas diferentes e **zero diferenças de alfa** entre suas cabeças compostas; gera a prancha em `test-results/faces-contact-sheet.png`. `node scripts/smoke-browser.mjs` testa mochila, arraste, prévia local, salvamento, recarga e treino no navegador. `npm run test:rooms:browser` verifica arena, chat e expulsão; `npm run test:battle:browser` verifica força exibida/disparada e cancelamentos; `npm run test:maps:browser` cobre partidas dos três mapas e seus controles; `npm run test:outfits` monta roupas nas poses/direções. `node scripts/smoke-outfits.mjs` verifica salvamento e sincronização dos conjuntos. Os scripts usam Microsoft Edge no Windows e Chromium do Playwright no Linux (instalação em `docs/cloud-handoff.md`); os harnesses de arte dependem do Vite. `test-results/` não é versionado.

## Limites atuais

Salas, batalhas e posições ficam na memória de um único processo. Reiniciar o servidor encerra partidas; Redis fornece limites HTTP e presença, sem distribuir simulações. O limite configurado de 1.000 conexões não é uma capacidade comprovada: o ensaio realizado cobre 24 conexões locais de lobby.

O acesso é de convidado, vinculado a um cookie com validade de 30 dias. Apagar ou perder esse cookie impede recuperar o perfil pela interface atual. Não há login com senha, comércio, guildas ou outras construções funcionais nesta etapa.

Estrutura, regras de fortalecimento, cores e decisões de segurança estão em [docs/architecture.md](docs/architecture.md). Os prompts das artes estão em [docs/art-prompts.md](docs/art-prompts.md) e [docs/apparel-prompts.md](docs/apparel-prompts.md).
