# Habilidades de combate

Contrato conferido em `shared/abilities.ts`, `shared/protocol.ts`, `shared/physics.ts` e `server/game.ts` em 16/10/2026. O servidor é a autoridade sobre uso, efeito, posição e duração. Pinturas e efeitos do cliente não concedem benefícios por conta própria.

## Preparar três espaços na sala

Cada jogador organiza suas próprias habilidades no painel **Preparação** da sala, separado das cartas dos participantes. Arrastar do catálogo para um dos três espaços equipa a habilidade; arrastar entre espaços reorganiza a seleção sem duplicar itens. Clique/toque na habilidade seguido do espaço oferece a mesma operação. Duplo clique no espaço ocupado, ou Delete/Backspace com foco, retira a habilidade.

Os três espaços têm ordem fixa e aceitam posições vazias. A batalha conserva essa ordem: cada habilidade selecionada recebe **um uso por partida**, e habilidades ausentes recebem zero usos e não podem ser ativadas. O avião de papel é um modo fixo separado e não ocupa espaço. Bots usam as três habilidades padrão.

`AbilityLoadout` é a tupla `[AbilityId | null, AbilityId | null, AbilityId | null]`, compartilhada por `Profile.abilityLoadout`, `Seat.abilityLoadout` e pelo personagem da batalha. IDs aceitos: `heal`, `homing` e `invisibility`, sem repetições. Perfis antigos sem uma seleção recebem `['heal', 'homing', 'invisibility']`; uma seleção salva com espaços vazios, inclusive `[null, null, null]`, **não é preenchida novamente**. `normalizeAbilityLoadout` preserva os IDs válidos e sua posição, removendo entradas inválidas ou duplicadas de dados legados.

## Gravação e confirmação da preparação

Alterar um espaço aplica a seleção imediatamente, sem botão de salvar. O cliente envia a intenção completa:

```ts
{type: 'ability-loadout', slots: ['invisibility', null, 'heal'], requestId: 'loadout-7'}
```

O servidor permite a alteração somente a membros de uma sala em espera. Fila, combate e praça rejeitam o comando. A validação exige exatamente três posições e IDs conhecidos e únicos; `requestId`, quando presente, tem de 1 a 64 caracteres. Selecionar habilidades desfaz a prontidão. Enquanto a gravação está pendente, o servidor impede ficar pronto, buscar partida, iniciar treino e alterar equipamento para aquele jogador; o líder também não pode iniciar um grupo que contenha uma gravação pendente.

`Store.saveAbilityLoadout` usa transação PostgreSQL e `SELECT ... FOR UPDATE`, atualizando a seleção no JSON do perfil bloqueado. Equipamento, moedas, posses, materiais e fortalecimento são preservados, inclusive ao concorrer com outra gravação de equipamento. Sucesso publica `profile` com o mesmo `requestId` **depois do commit** e atualiza a seleção da sala. Uma falha de execução reverte a transação e publica `error` com o ID recebido; comandos rejeitados pelo schema de transporte recebem o erro genérico de comando inválido, sem ACK de sucesso.

`AbilityLoadoutQueue`, em `src/abilityLoadout.ts`, mantém uma solicitação em andamento e a última seleção desejada. Mudanças rápidas são consolidadas após a confirmação correspondente; fechar o painel não descarta a fila. IDs `loadout-*` e confirmações dessa fila são independentes da personalização de equipamentos. Uma rejeição correlacionada abandona a intenção pendente e restaura o estado confirmado.

Reconectar não substitui o perfil confirmado em memória por uma leitura antiga da sessão. Se o jogador sair e entrar em outra sala enquanto a gravação termina, o resultado atualiza seu espaço na sala em espera atual antes de permitir iniciar. Um jogador desconectado não é removido da memória enquanto há gravação de perfil pendente. Após reiniciar o servidor, a seleção é recuperada do PostgreSQL; salas e batalhas continuam sendo estado transitório de um único processo.

## Ativar no próprio turno

`ability {ability: 'heal' | 'homing' | 'invisibility'}` exige habilidade equipada, personagem vivo, no próprio turno, em fase `aiming` e antes do prazo. Cada habilidade selecionada começa com **um uso por partida**, em `Fighter.abilities`, e atualmente tem custo de vigor zero. A reserva é consumida na ativação válida. Habilidades são bloqueadas enquanto voo está armado. Durante uma queda ativa, todas as ações de turno também aguardam o pouso, sem consumir usos, vigor ou Power; ver [Quedas e relógio de combate](combat-stats.md#queda-depois-de-crateras-ou-caminhada).

| Habilidade | Regra atual |
| --- | --- |
| Cura | Recupera até **300 HP**, limitada a `maxHp`. Vida já cheia rejeita o comando sem consumir o uso. |
| Mira assistida | Arma orientação para o primeiro projétil do próximo tiro. Um uso por partida, mesmo se o jogador encerrar o turno sem atirar. |
| Invisibilidade | Oculta a posição aos inimigos imediatamente e durante **três turnos próprios completos posteriores ao turno da ativação**. |

Cura publica a quantidade efetivamente recuperada em `AbilityEffect.amount`: por exemplo +140 quando faltavam 140 HP. O cliente nunca substitui isso por +300 fixo.

## Mira assistida

`homingArmed` é consumido ao lançar o tiro e se aplica apenas ao **projétil de índice 0**, inclusive em salvas e Tridente. Não guia todos os projéteis nem garante acerto.

Funciona como um **ímã**: em qualquer fase do voo (subida ou descida), assim que o centro do projétil passa a até **220 unidades** (`HOMING_RADIUS`) do centro da hitbox de um inimigo vivo e não invisível, ele **trava** no mais próximo e mantém a trava enquanto esse alvo viver. Travado, o projétil ignora vento e gravidade, mantém no mínimo `HOMING_MIN_SPEED = 520` px/s e faz perseguição pura: a curvatura é `max(HOMING_TURN_RATE = 6, 2·velocidade/distância)` rad/s, ou seja, o raio de curva nunca passa de metade da distância ao alvo, então não fica orbitando. Não há teleporte; a trajetória é simulada no servidor (`shared/physics.ts`) e o cliente só reproduz os pontos recebidos.

A colisão continua valendo: terreno e corpo atingido antes do alvo ainda bloqueiam; vento e gravidade só valem antes da trava. Jogadores invisíveis não são adquiridos pela mira assistida nem selecionados como alvo pela IA do bot, mas continuam sujeitos a colisões e dano.

## Invisibilidade e destinatários

`invisibleTurns` começa em 3. O servidor registra o turno de ativação para não descontá-lo; depois reduz o contador no fim de cada turno **do próprio personagem**. Turnos dos outros participantes não o reduzem. A transição por disparo, passagem ou tempo esgotado usa a mesma regra. Morrer não transforma invisibilidade em invulnerabilidade.

Aliados e o próprio jogador recebem posição verdadeira e podem ver a representação translúcida. Para adversários, o servidor gera uma cópia filtrada por destinatário:

- `Fighter.hidden: true`, `x/y = HIDDEN_POSITION (-10000)`, direção neutra e remoção de ângulo, inclinação da mira, força, estado de carregamento e percurso de queda (`fall`).
- Tiro de lançador invisível recebe `Shot.hidden: true` e lista de projéteis vazia, em vez de expor a origem pelo caminho.
- Hits em alvo invisível recebem `ShotHit.hidden: true` e coordenadas sentinela.
- Eventos de habilidade do jogador invisível recebem `hidden: true` e coordenadas sentinela.
- O mesmo filtro é usado em eventos de combate, tiro, impacto e habilidade, e no snapshot `welcome`/`Battle.activeShot` de reconexão.

Renderers devem ignorar `hidden` e sentinelas, sem reconstruir posições a partir de cache visual anterior. Essa proteção reduz a exposição direta de posições; **não promete eliminar inferências** a partir de terreno público, crateras, marcas de impacto, HP, turnos ou movimentos observados antes da ativação. A simulação completa continua no servidor, incluindo personagens ocultos.

## Voo com avião de papel

Voo é um modo de disparo, separado das três habilidades de uso único: `flight {active: true | false}`. Atualmente não possui contador de usos por partida nem custo próprio de vigor. Só pode ser armado/desarmado pelo personagem vivo em seu turno válido.

Armar voo é rejeitado quando já existem ferramentas de tiro, Power preparado ou mira assistida preparada. Enquanto está armado, andar, ativar ferramentas, Power ou habilidades é rejeitado. Mirar e escolher força continuam disponíveis; o próximo `fire` lança um único avião e encerra esse modo. Passar/encerrar o turno também limpa a preparação.

O avião usa a trajetória autoritativa, a gravidade e os limites de mira da arma equipada, com raio de projétil 6. O projétil publica `kind: 'flight'`, `delay: 0`, `flightTime` e impacto com raio 0. Ele **não causa dano, não abre cratera e não recebe Power**.

No contato, o servidor procura uma aterrissagem segura próxima, sem atravessar o terreno para escolher um ponto arbitrário:

- Impacto deve estar dentro dos limites válidos do mapa.
- Busca horizontal até 48 unidades do contato; apoio vertical até 54 unidades.
- Exige terreno sob os pés, espaço livre para o corpo e ausência de outro personagem vivo ocupando a chegada.
- Ponto fora do mapa, parede fechada ou falta de apoio/espaço mantém o lançador no lugar.
- O ponto é conferido novamente no momento real do impacto; só então o servidor muda a posição, limpa metadata anterior de queda, ajusta a mira ao terreno e emite `ability-effect` de `flight`.

O cliente anima o avião e o teleporte recebido, sem escolher a aterrissagem. A invisibilidade não é removida por essa apresentação; efeitos de um lançador ainda invisível são filtrados aos adversários.

## Eventos, relógio e apresentação

```ts
interface AbilityEffect {
  playerId: string;
  ability: 'heal' | 'homing' | 'invisibility' | 'flight';
  x: number;
  y: number;
  amount?: number;
  at: number;
  hidden?: boolean;
}
// ServerEvent: {type: 'ability-effect'} & AbilityEffect
```

`x/y` são os pés do personagem. `at` é tempo do servidor; o cliente calcula a idade usando o relógio sincronizado. Para o avião, o tempo vem de `Shot.startedAt + delay + flightTime`, com interpolação fracionária das amostras. As mesmas regras de impacto temporal e reconexão descritas em [Combate](combat-stats.md) se aplicam.

`src/game/abilityEffects.ts` fornece `drawAbilityEffect`, `drawFlightProjectile`, `drawTeleportEffect` e `preloadAbilityEffects`. Todos respeitam `hidden`/sentinelas e movimento reduzido; o efeito visual de desaparecimento não decide o contador nem a invisibilidade do corpo. A cura usa estrelas verdes e o número recebido. O avião usa a pintura de papel e uma trilha leve. Efeitos têm duração finita, sem disco opaco ou pedestal persistente.

Ícones ativos: `/assets/abilities/heal.png`, `homing.png`, `invisibility.png` e `flight.png`, todos PNG RGBA de 384px. A direção final de invisibilidade é **uma silhueta humana chibi simples, translúcida e sem rosto**, desaparecendo em poucas faixas; a mira é um alvo clássico vermelho/ivório. Não restaurar capa, figura líquida, lente mecânica ou ornamentos dourados descartados.

## Referências e verificações

- [Prompts e arte de habilidades](ability-art-prompts.md): prompts finais, alfa, medidas, contratos de renderer e budgets.
- [VFX de armas](weapon-vfx.md): efeitos por família e estágio, dano normal/crítico, clocks e caches.
- [Grupos e matchmaking](matchmaking.md): treino com bots, retorno à sala e resultado/cartas.
- `scripts/verify-ability-vfx.mjs`: prancha com ícones a 60px, animação, movimento reduzido, ausência de pixels ocultos, expiração e contagem de chamadas.
- `tests/abilities.test.ts` e `tests/abilities.integration.ts` verificam os comandos e a filtragem do servidor. O harness visual é complementar e não prova autorização, persistência ou privacidade sozinho.
- `tests/ability-loadout.test.ts` verifica normalização, schema, confirmação após commit, rollback, bloqueio de início durante gravação, usos somente das habilidades escolhidas e reconexão/troca de sala durante persistência.
- `tests/ability-loadout.integration.ts` (`npm run test:loadout:integration`) verifica HTTP/WebSocket/PostgreSQL reais: ordem, espaços vazios, prontidão, seleção na batalha, reconexão e gravações concorrentes de equipamento/preparação.
- `tests/ability-loadout-queue.test.ts` verifica a fila do cliente, a última intenção e o isolamento das confirmações de personalização.
