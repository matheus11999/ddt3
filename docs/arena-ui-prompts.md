# Arena e salas de batalha

Direção implementada em 16/10/2026: safira, rubi e ouro; cores vivas, materiais pintados e controles com acabamento de jogo. As imagens de salas DDTank enviadas pelo usuário foram inspecionadas: cartas em grade 2×2, personagem grande, emblema de nível e identificação do dono/prontidão orientaram a hierarquia. A composição e as pinturas usadas aqui são originais.

## Estrutura e comportamento

- `Arena.tsx` e `Arena.css` possuem listagem, criação e sala. A Arena ocupa toda a área de jogo de 1536×864, sem janela modal; `App.tsx` oculta o HUD da rua enquanto essa tela ou uma sala está aberta. Equipamentos continuam acessíveis sobre a sala.
- A moldura pintada original `fantasy-panel.png` aparece no contorno da tela, nas cartas, no palco do mapa e nas miniaturas. Nenhum asset proprietário foi copiado.
- Listagem com filtros de 1×1 a 4×4, busca, preview real do mapa, líder, ocupação e estado. Salas completas ou em batalha não aceitam entrada. Um painel de chat permanece visível ao lado da lista.
- Criação com palco ilustrado grande, título do mapa, informação de destruição e três miniaturas emolduradas. O painel lateral contém nome da sala, quatro tamanhos de equipe, resumo e ação de criação. O chat fica fora do formulário para evitar formulários aninhados.
- Sala com quatro cartas **por equipe**, em duas grades 2×2. Cartas verticais de aproximadamente206×306px em desktop, molduras douradas pintadas, fundos Safira/Rubi e posição estável. Retrato reduzido para204px desktop/180px mobile; badge46px/36px efetivos. Moldura e carta mantêm o tamanho.
- Carta ocupada exibe nome, distintivo de nível, poder calculado por `attributes()`, arma equipada, dono, marcador do próprio jogador e prontidão/conexão.
- Apenas o dono, durante a espera, vê um botão X no cabeçalho dos outros ocupantes. O nome acessível é “Expulsar NOME”. O comando `kick` envia somente o identificador do ocupante; o servidor valida autoridade e estado, remove humano ou bot e reinicia a prontidão dos restantes.
- Espaços abertos e fechados têm apresentação diferente. A posição inicial permanece aberta; o líder altera as outras posições simultaneamente nas duas equipes via `room-slot`.
- Vagas ocupadas por humanos bloqueiam o fechamento e explicam o motivo. Bots são removidos ao fechar a posição; não impedem reduzir o tamanho da sala.
- Painel central reúne preview do mapa, formato atual, posições abertas, prontidão e chat da sala. Equipamentos, bot e início/pronto permanecem numa linha de ações clara.
- Em telas até 700 px, a Arena e a sala usam portal fora do mundo transformado. A sala mostra abas de equipe, cartas verticais roláveis e chat/ações sempre visíveis. A equipe do próprio jogador é selecionada ao entrar.
- As cartas passam `showAura` ao avatar, conforme a correção mais recente do usuário. O renderer controla intensidade e estágio da aura de fortalecimento; lobby e combate não são ativados por esta interface. Não existe pedestal ou círculo de chão no CSS das cartas.
- Nomes acessíveis principais e seletores `.create-panel` e `.selected-map` foram preservados. A tela de sala recebe `.fullscreen-room`; a listagem e a criação, `.arena-screen`.

## Distintivos compartilhados

A primeira versão de medalhões circulares foi **substituída** após nova orientação do usuário. A versão vigente usa números grandes com volume e adornos abertos, conforme [level-badge-prompts.md](level-badge-prompts.md). Os prompts antigos de medalhões não devem orientar novas artes.

A API permanece `<LevelBadge level={30} size={42} className="minha-classe" />`. Limite 70: cinza 1–10, verde 11–20, azul 21–30, bronze 31–40, prata 41–50 e dourado 51–70. Aura começa no30, cresce continuamente e ganha camadas extras no40/50. Base decorativa nova, número DOM legível e preferência de movimento reduzido preservados.

## Verificação e evidências

- `npm run check` aprovado após a integração de fullscreen, chat, cartas e kick.
- Navegador real: criação 4×4, oito cartas, adição de sete bots, dimensões verticais verificadas e nenhuma exceção JavaScript.
- Interface anterior também verificou redução até 1×1, remoção automática de bots, reabertura de posição esparsa e abas de equipe em 390×844; contratos foram preservados.
- Capturas da versão completa em `test-results/arena/fullscreen-hall.png`, `fullscreen-create.png`, `fullscreen-create-mobile.png`, `fullscreen-room.png` e `fullscreen-room-mobile.png`.
- `scripts/smoke-rooms.mjs`, mantido pelo responsável de QA, cobre dois navegadores reais, chat bidirecional, expulsão, retorno à rua, reconexão e reentrada, além de acesso ao chat/saída em celular. Resultados ficam em `test-results/rooms/browser/`.
- A suíte geral, backend e verificações de rede são coordenados separadamente pelo agente integrador.
