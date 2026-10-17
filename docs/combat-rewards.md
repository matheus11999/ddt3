# Resultado e recompensas de batalha

Contrato local vigente em 16/10/2026. O estado, o relógio, as reservas e o pagamento pertencem ao servidor; a interface apresenta as transições sem decidir prêmios ou encerrar a partida.

## Sequência

1. Se a eliminação envolver queda, o personagem conclui o percurso visual de gravidade antes do anúncio. HP e resultado já são autoritativos; isso não abre uma janela de ação adicional.
2. Vitória, derrota ou empate aparece centralizado por **3 segundos**, com texto em relevo, luz e entrada suave. Não há botão de revanche ou de voltar.
3. Surgem **oito cartas** com entrada escalonada. A escolha dura até **5 segundos** e termina antes se todos os humanos escolherem. A carta própria recebe destaque dourado e identificação.
4. Todos os oito prêmios revelam juntos. Após pelo menos **2 segundos**, e somente com pagamento confirmado, a apresentação sai e os jogadores retornam às **mesmas salas**, preservando nome, ID e vagas abertas.

Os tempos vêm de REWARD_RESULT_MS, REWARD_PICK_MS e REWARD_RETURN_MS em shared/rewards.ts. opensAt inclui a conclusão da queda; o cliente aguarda opensAt − REWARD_RESULT_MS antes do anúncio. Deadline é opensAt + REWARD_PICK_MS. revealedAt marca a revelação real, inclusive antecipada.

## Reserva e pagamento

- reward-pick aceita somente índice inteiro0–7, depois de opensAt e antes do prazo. Um jogador reserva uma carta, sem troca; duas pessoas não podem reservar a mesma carta. A reserva é síncrona antes de gravações assíncronas.
- Reconexão antes da revelação recebe apenas índices/donos, nunca prêmios secretos. Bots e humanos sem escolha recebem automaticamente uma carta livre.
- O deck inteiro é revelado, mas somente cartas reservadas concedem bônus. finishMatch grava resultado e bônus numa transação idempotente identificada pela partida. Repetição não duplica moeda/XP.
- Falha temporária tenta novamente; o retorno aguarda rewards.saved. A partida pendente continua em memória mesmo se todos saírem, até concluir o pagamento. Reinício do processo ainda não recupera batalhas em andamento.
- Bots de treino não permanecem na sala. Humanos voltam sem prontidão e decidem uma nova busca na preparação; o comando legado rematch não antecipa os tempos nem o pagamento.

## Apresentação

As cartas flutuam sobre o campo de batalha, sem o painel azul grande ou coluna de personagem das versões anteriores. Frente marfim, verso navy com constelação e aro ouro/bronze; números dos prêmios escuros e ícones centralizados menores. Seleção própria sobe levemente, recebe contorno/luz e rótulo. Entrada, virada e saída respeitam prefers-reduced-motion.

Atlas ativo: public/assets/ui/reward-cards-refined.png,768×512, duas células384×512, proporção3:4. Verso à esquerda, frente à direita. Textos, donos e valores são DOM. Prêmios usam reward-icons.png. Prompts/medidas e materiais estão em [arena-art-prompts.md](arena-art-prompts.md).

## Economia provisória

Moedas Brasa usam Profile.gold. Vitória concede80 moedas e120XP; demais resultados25 moedas e50XP. Carta adiciona40/60/80/100/150 moedas ou40/60/100XP, sorteadas no servidor. Balanceamento ainda provisório.

## Verificação

- scripts/smoke-rewards.mjs: PvP real, bloqueio antecipado, reserva exclusiva, prêmios ocultos na reconexão, revelação antecipada, pagamento PostgreSQL e retorno automático das duas salas.
- tests/fall.test.ts: resultado espera saída do personagem, gravidade contínua/reconexão e privacidade do invisível.
- scripts/verify-battle-readability.mjs: corpo em posições intermediárias, sem tela de resultado durante queda; número de dano sem sinal negativo.
- Capturas visuais em test-results/rewards/ e fixtures da revisão atual; resultados temporários não são assets de produção.

### Acabamento vigente das cartas

A revisão visual de16/10 mantém o atlas pintado navy/ouro e frente marfim, remove as cascatas antigas de CSS e usa a textura safira também no contador. Brilho discreto no verso, entrada escalonada, borda dupla dourada na escolha própria e prêmios menores centralizados. Sem modal grande nem botões de saída manual. `scripts/smoke-rewards.mjs` passou em8097 após a revisão, incluindo pagamento real e retorno automático.
