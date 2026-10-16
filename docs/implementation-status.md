# Estado da entrega — 16/10/2026

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

### Nova arma — Quebra-Tijolos (16/10/2026)

Arma épica `brick` na loja (500 Brasas). Mecânica própria: o impacto principal se estilhaça em 2/3/4/5 cacos autoritativos conforme o estágio 0–8/9/10–11/12 (+2 com Power), cada um com cratera, dano e carga Power; demolição de 60% contra materiais duros. Arte de quatro estágios, atlas de efeitos e resíduo de entulho pintados por Canvas 2D como versão provisória; prompts para a arte final em `docs/brick-weapon.md`. Testes de física e servidor adicionados; renderização de tiro, cacos e impactos conferida nos quatro estágios no mapa Jardim (`docs/previews/brick-weapon.png`). Pendente: arte final por image_gen e inspeção em partida real no navegador com backend.
