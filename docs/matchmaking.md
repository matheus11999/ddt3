# Grupos, matchmaking e retorno à sala

Contrato conferido em `server/game.ts`, `shared/rooms.ts`, `shared/rewards.ts`, `shared/protocol.ts`, `src/components/Arena.tsx` e `src/components/ArenaHall.tsx` em 16/10/2026.

## Salão e presença

O salão lista todos os grupos PvP, inclusive completos, em busca e em batalha. Somente grupos aguardando com vaga aberta permitem entrar. O formato exibido é `openSlots.length × openSlots.length`, sem contador de vagas nem filtro por tamanho. A lupa abre uma pesquisa compacta por nome, ignorando diferenças de maiúsculas e acentos; fechar ou Escape limpa a pesquisa. Criar sala permanece uma única ação.

O cabeçalho mostra o total de **humanos conectados na arena**, calculado pelo servidor pela união de quem está com o salão aberto e quem pertence a uma sala existente, inclusive em partida ou treino. Cada perfil conta uma vez; bots, conexões ausentes e jogadores apenas na rua não contam. `arena-presence {open:boolean}` anuncia a montagem/saída do salão; o schema rejeita contagem ou identidade enviadas pelo cliente. `welcome.arenaOnline` fornece o valor inicial e `arena-population {count}` publica somente mudanças. Reconectar limpa uma presença de salão antiga, mantendo a participação em sala válida; a interface anuncia novamente se o salão continuar aberto.

`Room.matchStartedAt` recebe o instante de início da batalha no servidor, igual para os dois grupos PvP. Reconexão preserva esse instante. O salão mostra o tempo decorrido em `mm:ss` corrigido pelo relógio servidor, e o campo é removido ao retornar à preparação. O valor não é a idade da sala nem uma estimativa da fila.

`ArenaHall.tsx` e `ArenaHall.css` são independentes da preparação em `Arena.tsx`. O salão ocupa a tela inteira por um portal fora da escala do cenário. `ArenaTheme.css` compartilha cores e botões com a sala: safira e azul noturno com textura fina, ouro acetinado discreto e marfim no interior dos cards, seguindo as cartas de recompensa. A lista ocupa o painel principal e o chat integra a coluna lateral, sem ilustração acima dele. Os cards medem 148px de altura no desktop, com largura máxima de 380px, e 109px em paisagem móvel. A lista tem rolagem interna e as ações permanecem acessíveis; o bloqueio em retrato preserva sessão e presença.

## Criar e preparar

**Criar sala é uma ação de um clique**: `create {}`. O servidor escolhe o nome `Sala de <jogador>` quando nenhum nome é enviado, cria um grupo PvP em `waiting` e abre somente `openSlots: [0]`. O primeiro espaço é do líder e permanece aberto.

`Room.number` é um número positivo atribuído pelo servidor, único e crescente durante a vida do processo. É a identificação curta mostrada na sala; UUID continua sendo a chave de comandos e convites. Renomear, reconectar, iniciar e voltar da partida mantêm o número. Reiniciar o servidor encerra as salas em memória e reinicia a numeração; não há reserva persistente de números.

O lápis junto do nome permite ao líder renomear a sala durante a espera: `room-rename {name}`. O schema remove espaços nas pontas, exige de 2 a 24 caracteres e rejeita campos extras. Apenas o líder em `waiting` pode alterar; busca e combate rejeitam a operação. O novo nome é publicado para os integrantes e a listagem, permanece no retorno da partida e existe somente enquanto essa sala estiver na memória do servidor.

A sala é um grupo de até quatro aliados. O líder abre ou fecha os espaços 1, 2 e 3 com `room-slot {slot, open}`, somente durante a espera. Não pode fechar uma vaga ocupada por outro humano. Abrir mais espaços aumenta a capacidade e o formato correspondente; não há seletor manual de modo. `join` ocupa uma vaga aberta livre, não uma vaga fechada.

O PvP não mostra cartas adversárias, seleção de mapa ou botão de adicionar bots. A interface usa as quatro cartas do grupo, com vagas fechadas ou abertas. O líder pode expulsar outro integrante com `kick {playerId}` somente enquanto espera fora da fila. Alterações de vagas, integrantes e equipamento invalidam a preparação pertinente.

Cada jogador configura **três espaços próprios de habilidades** no painel Preparação, fora das cartas dos participantes. Arrastar ou selecionar e tocar equipa/reordena; duplo clique ou Delete/Backspace no espaço retira. Posições vazias são permitidas e a mesma ordem chega ao combate. A seleção é persistida imediatamente, sem botão Salvar; somente as habilidades equipadas recebem um uso por partida. Voo permanece separado. Mudanças são aceitas apenas em sala aguardando, desfazem prontidão e bloqueiam o início até a confirmação da gravação; contrato completo em [Habilidades](abilities.md).

## Convidar jogadores online

**Convidar** abre a lista de pessoas online no próprio jogo. Apenas o líder de uma sala em espera com vaga aberta livre pode solicitar a lista ou enviar convites. `room-invite-list {}` devolve `room-invite-list {roomId, players}`, com somente ID, nome e nível dos humanos conectados e livres na rua ou no salão, inclusive em outros canais. Não inclui o próprio líder, bots, pessoas desconectadas ou integrantes de qualquer sala. A interface usa `roomId` para descartar uma resposta de outra sala.

`room-invite {playerId}` envia ao destinatário `room-invitation {invite}`. O convite recebe UUID aleatório e contém `roomId`, número e nome da sala, ID e nome do líder e `expiresAt`, calculados no servidor. O cliente não pode escolher remetente, sala nem prazo. O destinatário responde `room-invite-answer {inviteId, accept}`; apenas ele pode responder ao ID, uma única vez. `room-invite-result` contém `inviteId`, `playerId` do destinatário, `roomId`, estado e mensagem: `sent` confirma ao líder; `accepted`, `declined`, `expired` ou `unavailable` encerram o convite para ambas as pessoas ainda conectadas. Rejeições de comandos usam `error`.

**O convite dura 60 segundos e não reserva vaga.** Aceitar revalida, sem operação assíncrona entre verificação e entrada, se o líder continua conectado e responsável pela mesma sala em espera, se existe vaga e se o destinatário continua conectado e fora de qualquer sala. Duas aceitações não podem ocupar o mesmo lugar. Nunca se sai de um grupo automaticamente para aceitar outro convite; recusar também não altera salas nem perfis.

O servidor encerra convites quando a sala fica cheia, inicia uma partida, troca de líder, desaparece, quando o destinatário entra em outra sala ou quando uma das pessoas desconecta. Um convite válido reaparece se uma conexão ativa for substituída, mas convites encerrados pela desconexão não ressurgem. O ciclo do servidor também publica a expiração pelo relógio autoritativo.

Limites por líder: uma atualização da lista por segundo, intervalo de 2 segundos entre envios e de 30 segundos para o mesmo destinatário, até três convites pendentes. Cada destinatário recebe no máximo cinco pendentes. Dados ficam apenas em memória; não há amizade, mensagens privadas ou concessão de acesso privilegiado. A entrada aceita usa o mesmo caminho de `join`, preservando equipamento, recursos e preparação salvos.

A interface deixou de oferecer cópia de link. Links antigos com `?room=<UUID>` continuam compatíveis pelo consumidor de `src/roomInvite.ts`: o parâmetro é consumido uma vez, sem carregar tokens, e a entrada passa pelas validações normais de `join`.

## Espectadores

Cada sala possui **dois lugares de espectador**, inicialmente fechados, separados das quatro vagas de aliados. `Room.spectatorSlots` lista os lugares abertos, 0 e 1; `Room.spectators` contém somente ID, nome, nível, lugar e conexão de quem assiste. Esses campos são opcionais no tipo para compatibilidade com snapshots antigos, mas toda sala criada pelo servidor recebe os dois arrays. Espectadores não são `Seat` nem `Fighter` e não alteram o formato, a prontidão ou a quantidade de bots do treino.

O líder usa `room-spectator-slot {slot, open}` para abrir/fechar e `spectator-kick {playerId}` para retirar alguém, inclusive durante busca ou combate. Um lugar ocupado precisa ser esvaziado antes de ser fechado. As ações só afetam espectadores e não cancelam a fila nem alteram participantes. A opção **Assistir** do salão envia `spectate {roomId}`: exige usuário fora de qualquer sala e lugar de espectador aberto livre, enquanto a sala espera ou já joga. Quem entrou antes continua assistindo durante a busca; não é possível ingressar nela enquanto está buscando.

Ingresso e reserva de lugar são síncronos, impedindo mais de dois espectadores por sala. O servidor publica a sala e, em combate, um snapshot completo com terreno e tiro ativo. A audiência da partida reúne os participantes e espectadores dos dois grupos, sem duplicar envios. Quem assiste recebe tiros, impactos, habilidades, turnos, terreno, resultado e revelação de cartas; o chat da partida também é compartilhado. **Invisibilidade esconde as posições das duas equipes dos espectadores**, incluindo mira, queda, origem/trajetória de tiro e efeitos posicionais, também após reconexão. Nome e HP seguem o contrato público existente.

Comandos de prontidão, fila, configuração de habilidades, controle de vagas/jogadores, combate e escolha de recompensa são bloqueados para espectadores no servidor. Equipar o próprio personagem pode persistir normalmente, mas não desfaz prontidão ou busca do grupo e não cria um combatente. Quem assiste não escolhe carta, não entra na contagem de escolhas e não recebe bônus, vitórias ou partidas no perfil.

Sair, ser retirado ou desconectar como espectador não muda HP, turnos ou fila. Reconectar recupera o mesmo lugar e a visão filtrada; após 30 segundos desconectado o ciclo de limpeza libera apenas essa participação. Se o último participante humano sair, a sala encerra e seus espectadores voltam ao lobby. Ao fim normal, os espectadores retornam com seus grupos às mesmas salas, conservando os lugares abertos. Pessoas conectadas assistindo contam uma vez na população da arena, sem entrar na contagem de combatentes.

## Prontidão e fila autoritativa

| Comando | Regra |
| --- | --- |
| `ready` | Alterna a prontidão na espera. Durante a busca, volta a preparar e cancela a fila. |
| `queue` | Exclusivo do líder; exige todas as vagas abertas preenchidas por humanos conectados, demais integrantes prontos e nenhuma alteração de perfil/equipamento pendente. A ação do líder confirma sua participação. |
| `cancel-queue` | Exclusivo do líder, somente durante a busca. |
| `leave` | Sai do grupo; cancela uma busca em andamento. |
| `room-slot` / `kick` / `room-rename` | Exclusivos do líder e restritos ao estado `waiting`. |
| `room-invite-list` / `room-invite` | Líder em espera, com vaga aberta livre; destinatário conectado fora de salas. |
| `room-invite-answer` | Somente o destinatário do convite; aceite revalida sala, líder, capacidade e disponibilidade. |
| `room-spectator-slot` / `spectator-kick` | Líder da própria sala, inclusive em busca/combate; nunca alteram vagas de combatentes. |
| `spectate` | Usuário fora de salas, vaga de espectador aberta livre, sala em espera ou combate. |
| `ability-loadout` | Preparação do próprio integrante durante a espera; confirma após persistência e desfaz prontidão. |

Não é possível buscar 1×1 com três vagas abertas vazias: é preciso fechá-las ou preenchê-las. Com todas preenchidas, uma, duas, três ou quatro vagas definem 1×1, 2×2, 3×3 ou 4×4. O servidor exige correspondência entre cada vaga aberta e exatamente um integrante.

`Room.status` é `waiting`, `searching` ou `playing`. A fila percorre grupos elegíveis do **mesmo tamanho**, reservando ambos de forma síncrona antes de iniciar. O servidor sorteia um mapa de `MAP_IDS` com `crypto.randomInt`: atualmente Jardim Encantado, Parque dos Sonhos ou Fortaleza Celestial. Campos legados `mode`/`map` enviados na criação PvP não escolhem a partida.

`Room.searchStartedAt` registra o instante servidor de entrada na fila. O botão pode calcular o tempo de busca usando o relógio corrigido por `state.offset`; não é uma estimativa de quanto falta para encontrar partida. Trocar uma conexão ainda ativa conserva o instante. Cancelar, sair, desconectar ou começar uma batalha remove o campo; uma nova busca recebe um novo instante.

Saída, desconexão, mudança de prontidão ou alteração de equipamento/personalização cancelam a busca. O cancelamento devolve o grupo à preparação e limpa a prontidão; reconectar não o reinscreve automaticamente. PvP nunca completa a equipe ou os adversários com bots.

## Treino dentro da sala

O fluxo visível usa **Treinar com bots** dentro do grupo, seguido de uma confirmação com o tamanho das duas equipes. Confirmar envia `practice-start`. É uma partida de treino separada da fila; o grupo não é transformado permanentemente em uma sala com bots.

O líder inicia enquanto a sala espera, com os humanos conectados e sem gravações de equipamento pendentes. A interface também exige os integrantes presentes prontos. O servidor cria assentos de combate temporários: humanos ficam no time aliado e bots preenchem as vagas restantes das duas equipes até o mesmo tamanho, definido por `openSlots`. Os bots não são gravados em `Room.players`; desaparecem ao terminar. O mapa também é sorteado nesse fluxo.

O protocolo mantém `create {practice:true, mode?, map?}`, `bot` e `start` para treino explícito/testes determinísticos. Esses grupos nunca entram na fila PvP. Nesse caminho separado, os dois times precisam estar preenchidos e os humanos prontos/conectados; não confundir esse suporte com seleção de mapa ou de adversários na interface PvP.

## Combate, reconexão e vínculo do grupo

Cada grupo conserva seu ID e seus integrantes. A batalha mantém um vínculo interno com os dois grupos; `Battle.roomId` identifica o primeiro e não deve ser tomado como o grupo de todos os participantes. Chat é privado do grupo antes/depois e compartilhado pelos participantes durante a batalha.

Reconexão recupera a sala e o snapshot de combate do destinatário, incluindo terreno, tiro ativo e percurso de queda quando aplicável. O servidor filtra posições e efeitos de inimigos invisíveis também nesse snapshot; ver [Habilidades](abilities.md). Conexão ausente por mais de 30 segundos é removida pelo ciclo atual do servidor, exceto enquanto houver gravação de perfil pendente. Uma desconexão não implica retomada automática da fila.

## Resultado, cartas e retorno automático

O resultado permanece sobre o mapa, seguindo os tempos de `shared/rewards.ts`:

1. **Resultado por 3 segundos após terminar uma eventual queda.** `opensAt` determina a abertura das cartas; escolhas antecipadas são rejeitadas.
2. **Escolha por até 5 segundos.** Oito cartas, uma reserva exclusiva por participante. O servidor reserva sincronamente antes de qualquer operação assíncrona, impedindo duas escolhas da mesma carta.
3. **Revelação antecipada se todos os humanos escolherem**, ou ao vencer o prazo. Bots já reservam seus espaços; quem não escolheu recebe uma carta automática. Todos os oito prêmios são revelados juntos, inclusive os de cartas não escolhidas.
4. **Revelação por pelo menos 2 segundos e persistência concluída.** O servidor retorna automaticamente os grupos às próprias salas de preparação. Não há botão de continuar, coletar ou revanche como requisito do fluxo.

Até a revelação, os prêmios permanecem exclusivamente no servidor. `finishMatch` persiste resultado e bônus dos humanos; `rewards.saved` só passa a true após a conclusão. Falhas de gravação são reportadas e tentadas novamente; o retorno aguarda o salvamento, mesmo que os dois segundos já tenham passado.

Ao retornar, `battle:null` remove a sobreposição, `Room.status` volta a `waiting`, os grupos, nomes e vagas abertas são preservados, e os humanos precisam confirmar prontidão novamente. Seus três espaços de habilidades continuam salvos. Bots temporários do treino não permanecem no grupo. O comando legado `rematch` ainda é validado pelo servidor, mas não substitui nem antecipa os dois segundos e o salvamento, e não é um botão necessário na interface.

## Limites e verificações

A fila considera tamanho do grupo, sem ranking/MMR, estimativa artificial de espera ou adversários simulados. Sem outro grupo compatível, a busca permanece aberta até cancelamento. Fila, salas, terrenos e simulações ficam em memória de um único processo; reiniciar o backend encerra esses estados. Isso não demonstra escala para milhares de jogadores.

Verificações existentes pertinentes: `npm run test:matchmaking:integration`, `npm run test:rooms:integration`, `npm run test:rooms:browser`, `npm run test:rewards:browser` e `npm run test:loadout:integration`. `tests/arena-party.test.ts` cobre autorização, validação e preservação do nome; `tests/room-invite.test.ts` cobre geração e consumo do link sem dados privados. `tests/arena-hall.test.ts` cobre presença única, inatividade/reconexão, redução de emissões, relógio e pesquisa. `node scripts/smoke-arena-hall.mjs` verifica presença/entrada/criação e tempo com HTTP/WS reais, separa fixtures de apresentação e captura desktop e paisagem 844/932/667. A variável `HALL_LAYOUT_ONLY=1` restringe esse script à pesquisa e à apresentação responsiva, incluindo desktop 1536/1280/2048, largura estreita 587 e bloqueio em retrato. Testes unitários de matchmaking, salas, habilidades e recompensas completam a cobertura; resultados vigentes ficam no checkpoint.

`tests/online-room-invites.test.ts` cobre destinatário/autoridade, payload estrito, filtros, limites de envio, expiração, mudança de estado, aceites concorrentes e ciclo de `searchStartedAt`. `npx tsx tests/online-room-invites.integration.ts` exercita quatro sessões reais HTTP/WS: entrega privada, aceite e recusa, identidade forjada, vaga ocupada enquanto o convite aguarda, reconexão e preservação do perfil consultado pelo HTTP.

`tests/spectators.test.ts` cobre capacidade concorrente, permissões, isolamento de fila/equipamento/combate, invisibilidade das duas equipes em snapshots/tiros/hits/críticos/voo e reconexão, saída/limpeza e exclusão das recompensas. `npx tsx tests/spectators.integration.ts` percorre quatro sessões HTTP/WS por ingresso durante espera e tiro ativo, eventos, comandos bloqueados, invisibilidade, reconexão, saída/reentrada, cartas e retorno, além do treino atual com bots efêmeros.
