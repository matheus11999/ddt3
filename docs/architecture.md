# Arquitetura e regras

## Organização

| Área | Responsabilidade |
| --- | --- |
| `src/components/` | HUD, mochila, salas, ferreiro, cartões e controles React |
| `src/game/` | Cena Canvas 2D, composição do avatar, animação e áudio |
| `src/client.ts` | Estado do cliente, comandos WebSocket e reconexão |
| `shared/catalog.ts` | Itens, atributos, ferramentas, materiais e fórmulas compartilhadas |
| `shared/protocol.ts` | Eventos tipados e validação Zod dos comandos |
| `shared/maps.ts` | Mapas, materiais, regiões, objetos, camadas e spawns |
| `src/game/faces.ts` | Registro e composição facial universal, sem variar a silhueta |
| `shared/physics.ts` | Trajetória, colisão, terreno e serialização binária |
| `server/game.ts` | Presença, salas, turnos, tiros, dano e resultado da partida |
| `server/store.ts` | Sessões, perfis e transações PostgreSQL |
| `server/index.ts` | HTTP, autenticação WebSocket, limites e ciclo do servidor |
| `public/assets/` | Artes raster com transparência e cenários |
| `infra/`, `compose*.yaml` | Imagens Docker, proxy Nginx e serviços |
| `tests/` | Testes unitários, integração real e ensaio de carga local |

O navegador envia intenções: mover, equipar, entrar em sala, usar ferramenta, disparar e fortalecer. O servidor valida sessão, comando, turno, posse e recursos antes de alterar o estado. O cliente anima os resultados recebidos; não determina dano, consumo de vigor, cratera ou sucesso de fortalecimento.

O ciclo do servidor roda a cada 50 ms. O lobby agrupa até 60 conexões por canal e transmite atualizações de movimento aproximadamente a 10 Hz. O cliente interpola posições e renderiza com `requestAnimationFrame`; aparências compostas e símbolos de aura são armazenados em cache.

## Batalha

Salas comportam 1×1 até 4×4, com quatro posições fixas por equipe. `openSlots` preserva índices mesmo com lacunas. O líder pode fechar pares de vagas sem ocupantes humanos (bots são removidos) e expulsar outros jogadores durante a espera. Expulsão retorna o jogador à praça, sem fechar sua conexão; capacidade e demais posições são preservadas. O líder inicia quando as vagas estão preenchidas e os demais jogadores estão prontos. Bots usam uma busca balística limitada; partidas com bots dão o primeiro turno ao jogador humano. Nas demais partidas, a agilidade define a ordem inicial. Os turnos seguintes percorrem os combatentes vivos e duram 30 segundos; esta versão usa alternância simples.

O terreno ocupa uma grade 512×288 de células de 3 pixels. O servidor integra trajetórias a 120 Hz, transmite pontos amostrados a 60 Hz, calcula colisão contínua por disco (raios físicos6/3/9px para Brasa/Tempestade/Cristal), remove material conforme raio, resistência e regiões destrutíveis e reposiciona combatentes no chão restante. A reconexão inclui um retrato completo da batalha e do terreno compactado. A sessão permanece na partida por até 30 segundos após desconectar, enquanto o processo continuar ativo.

| Ferramenta | Vigor | Efeito implementado |
| --- | ---: | --- |
| +1 | 110 | 2 disparos, 90% do dano por disparo |
| +2 | 110 | 3 disparos, 60% do dano por disparo |
| Tridente | 110 | 3 projéteis em leque, 50% do dano por projétil |
| +50% | 85 | Aumenta o multiplicador de dano em 0,50 |
| +40% | 80 | Aumenta o multiplicador de dano em 0,40 |
| +30% | 70 | Aumenta o multiplicador de dano em 0,30 |
| +20% | 55 | Aumenta o multiplicador de dano em 0,20 |

Os custos e as reduções dos disparos seguem a referência pública [VNG — guia de ferramentas de DDTank Origin](https://ddtank.vnggames.in.th/news/guide/x1-x2-x3-max-pow.html). As demais fórmulas e o balanceamento estão definidos no código deste projeto. +1 e +2 são mutuamente exclusivos; uma ferramenta não pode ser repetida no mesmo turno. Tridente pode combinar com disparos adicionais. Andar consome vigor e o início do próximo turno do jogador restaura sua reserva.

## Inventário e fortalecimento

O perfil contém `compositions` e `compositionStones` (ver [Composição](composition.md)), `inventory`, `equipment`, `upgrades` por ID de arma e `stones` por nível de material. `equipment.upgrade` espelha a arma equipada. A mochila mantém uma prévia local até Salvar. O comando `customize` valida todos os oito slots e a posse numa transação; o upgrade vem do estado persistido. Rosto é uma peça completa, e a mesma função de avatar atende à prévia, ao lobby e à batalha. O acabamento das roupas/cabelos restantes é pendente; veja `implementation-status.md`.

O ferreiro exige estar fora de salas e a até 180 pixels de `{x:310,y:610}`. Apenas armas próprias podem subir de +0 até +12. Cada tentativa recebe entre 1 e 20 pedras, de níveis I a V. A chance é calculada pelo mesmo helper usado na interface e recalculada no servidor com o nível e estoque atuais; o cliente não envia uma chance aceita como verdadeira.

| Pedra | Potência | Cor do material | Estoque inicial |
| --- | ---: | --- | ---: |
| I | 1 | Cinza `#c9d0ca` | 30 |
| II | 2 | Ciano `#65cffa` | 20 |
| III | 4 | Rosa/rubi `#ed6bb1` | 15 |
| IV | 8 | Dourado/laranja `#ffc44f` | 10 |
| V | 16 | Multicolorida; tom de referência `#ba8dec` | 8 |

A chance usa a soma das potências selecionadas e a exigência crescente em `UPGRADE_REQUIREMENTS`, arredondada a uma casa decimal e limitada a 100%. Por exemplo, uma pedra I dá 75% para +0→+1; uma pedra V dá 10,4% para +11→+12. A barra representa o nível atual em relação a +12; falhas não acumulam progresso oculto.

`Store.forge()` abre uma transação, bloqueia o perfil com `SELECT ... FOR UPDATE`, valida quantidades, sorteia com `crypto.randomInt`, consome todas as pedras selecionadas e persiste o resultado. Sucesso soma um nível; falha mantém o nível. Não há custo de ouro nem downgrade. `saveEquipment()` também bloqueia o perfil e lê o nível persistido, evitando perda de atualização entre troca de arma e fortalecimento concorrente.

Cada nível adiciona 8 de ataque à arma e 3,5% de seu dano-base, com arredondamento do dano. O raio de cratera permanece específico de cada arma. A arte preserva a identidade do equipamento. A aura do personagem só aparece por opção explícita no inventário, perfil e cartas da arena; não aparece no lobby ou no combate.

| Nível | Arte da arma | Aura do personagem |
| --- | --- | --- |
| +0–4 | Base: `weapon-ID-base.png` | Sem aura |
| +5–8 | Base | Aura de luz ciano |
| +9 | Evoluída: `weapon-ID-evolved.png` | Aura violeta ampliada |
| +10–11 | Desperta: `weapon-ID-awakened.png` | Aura violeta |
| +12 | Completa: `weapon-ID.png` | Aura dourada com camadas luminosas |

Os cartões reutilizam `ItemCard` na mochila, ferreiro e demais telas de equipamentos. Pedras I–V são sempre comuns. A moldura depende da raridade, e a cor da pedra segue seu material:

| Raridade exibida | Valor interno | Moldura |
| --- | --- | --- |
| Comum | `common` | Cinza `#a4aab0` |
| Incomum | `uncommon` | Verde-água |
| Raro | `rare` | Azul `#68b8e5` |
| Épico | `epic` | Roxo `#bd8fe2` |
| Lendário | `legendary` | Dourado `#f5cb68` |

Atributos e dano são definidos em [combat-stats.md](combat-stats.md). O nível máximo é50, com300EXP por nível; experiência extra não cria nível51. A barra de força mantém o último valor efetivamente exibido e dispara esse valor ao soltar Espaço/toque; blur, perda de visibilidade ou abertura de painel cancelam a carga.

## Persistência, segurança e operação

PostgreSQL armazena perfis JSONB, hashes SHA-256 dos tokens de sessão e resultados de partidas. O token aleatório fica em cookie `HttpOnly` e `SameSite=Strict`, com duração de 30 dias; `COOKIE_SECURE=true` habilita a exigência de HTTPS. A normalização de perfis antigos acrescenta campos ausentes sem repor pilhas de pedras consumidas. O registro único de resultado por partida evita premiar a mesma conclusão duas vezes.

O servidor verifica origens HTTP/WebSocket, limita tamanho e frequência de mensagens, valida números finitos e campos permitidos, serializa comandos por conexão e encerra clientes com excesso de dados pendentes. A troca de conexão da mesma conta invalida a anterior. O Nginx sobrescreve os cabeçalhos de IP usados pelo backend. `BEHIND_PROXY=true` pressupõe acesso ao servidor por esse proxy controlado; o Compose padrão mantém a porta do backend interna, e o override de desenvolvimento a publica somente em loopback.

Redis mantém os limites HTTP e um contador de presença com expiração. Ele não distribui salas, turnos ou terrenos. Essas estruturas ficam em mapas na memória do processo Node e são perdidas em reinícios. Adicionar réplicas sem roteamento e coordenação de estado não produz um servidor de jogo distribuído.

Há limites configurados de 200 salas e 1.000 conexões por processo, sem garantia de capacidade nessa quantidade. O ensaio local executado com 24 conexões, 288 pings e movimentação mediu p95 de 3,13 ms pelo Vite `5177` conectado ao backend Docker. Esse resultado cobre lobby e validação, sem representar latência externa, partidas simultâneas em escala ou capacidade de produção. `npm run test:load` publica os parâmetros e as medições de cada execução em JSON.

A implantação padrão serve apenas o computador local. Publicação externa ainda exige domínio, TLS, segredos adequados, cópias de segurança, observabilidade e testes de carga compatíveis com a meta real. Convidados não têm recuperação de conta, e o protótipo ainda não oferece reposição econômica de pedras, comércio ou guildas.

## Evolução visual do nível

Badges usam números inclinados em relevo e ornamentos pintados de apoio. Níveis 1–10 são simples; 11–20 e 21–29 recebem detalhes crescentes. A aura começa em 30–39, ganha outra camada e luz dourada em 40–49 e atinge o efeito mais elaborado em 50. Não confundir esses níveis com os estágios +5/+9/+12 da arma, responsáveis pelo anel luminoso do avatar. `prefers-reduced-motion` congela rotação/pulso sem ocultar a identidade de cada estágio.
