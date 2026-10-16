# Controles e recompensas de batalha

Revisão de 16/10/2026. Régua com 101 traços: marcas menores a cada ponto, intermediárias a cada 5 e principais numeradas a cada 10. Segurar Espaço ou tocar/segurar a régua carrega; soltar dispara exatamente o número já pintado. Chegar a 100 espera a soltura. Botões separados de carregar/andar foram removidos; setas do teclado continuam para movimento e ângulo. Timer sem placa de fundo, alerta a partir de 10 segundos e destaque adicional nos últimos 5. Retrato próprio, nome e HP ficam no alto à esquerda.

## Cartas

- O cenário continua visível atrás do resultado translúcido. Personagem ao lado da seleção e texto em relevo de vitória, derrota ou empate.
- Oito cartas, uma escolha permanente por participante. `reward-pick` só aceita índice inteiro 0–7 e nenhuma informação de prêmio.
- Seleção é síncrona no servidor antes de qualquer operação assíncrona: duas conexões não podem reservar a mesma carta.
- **Todas as cartas escolhidas revelam juntas após 15 segundos**, inclusive a carta própria. Antes do prazo, os eventos e reconexões contêm apenas índice/dono, nunca o prêmio secreto.
- Bots reservam cartas livres. Ao fim do prazo, participantes sem escolha recebem uma carta livre automaticamente; nenhuma escolha existente é substituída.
- Resultado base e bônus são salvos juntos pela transação idempotente de `finishMatch`, usando o ID da partida como chave. Uma repetição não duplica moeda ou XP. Falhas temporárias são tentadas novamente e bloqueiam a revanche enquanto o saldo não é confirmado.
- Mesmo quando todos saem, a partida permanece em memória até concluir o pagamento. Como o próprio combate, uma rodada ainda pendente não é retomada após reinício do processo; persistência/recuperação de partidas em andamento é uma etapa futura.

## Economia provisória

Moedas Brasa reutilizam `Profile.gold`, sem criar um saldo paralelo. Vitória: 80 moedas + 120 XP; demais resultados: 25 moedas + 50 XP. Carta extra sorteada pelo servidor: 40/60/80/100/150 moedas ou 40/60/100 XP. Valores e probabilidades ainda estão sujeitos ao balanceamento solicitado pelo usuário. A moeda é usada no HUD, mochila, ferreiro, loja e resultados.

## Arte

`public/assets/ui/reward-cards.png`: atlas RGBA 1536×1024, duas colunas iguais (costas/frente), moldura bronze discreta, tecido azul e relevo. A versão ornamentada RPG e a versão de plástico cartunesco foram rejeitadas e não são usadas. A última revisão busca textura e volume contidos. Texto, número da carta e nome do dono são DOM, não pintados no atlas.

`reward-icons.png`: atlas RGBA 1774×887, moeda dourada com chama original e estrela azul de XP. Nenhum asset DDTank foi copiado.

Prompt final das cartas: “Restrained tactile painted online artillery game finish; thinner brushed bronze rim, gently bevelled edges, tight corner radius, subdued highlights, fine-grain material texture. Back deep navy fabric with faint diamond pattern and copper flame seal; front matching bronze rim and clean dark petrol-blue interior. No jewels, filigree or lettering; two identical cards in equal cells, transparent outside.”

## Evidência

- `scripts/smoke-battle-controls.mjs`: teclado/toque, cancelamento, valor enviado igual ao mostrado, força 100 sem disparo automático.
- `scripts/smoke-rewards.mjs`: PvP real até fim, escolha concorrente rejeitada, cartas ocultas, reconexão, revelação conjunta, pagamento PostgreSQL e revanche.
- Unitários: exclusividade, prazo, autoescolha, abandono, retry, prêmio e progressão atômicos.
- Capturas em `test-results/rewards/` e `test-results/battle-controls/`.
