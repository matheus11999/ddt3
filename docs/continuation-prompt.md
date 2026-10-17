# Prompt de continuidade — Brasa Arena / ddt3

Último estado local: desenvolvimento ao vivo em8097 com compose.dev (Vite+tsx watch); manter essa configuração solicitada. Combate/habilidades/salas/recompensas evoluíram depois da cloud. Leia primeiro a seção superior de implementation-status, combat-stats, abilities e matchmaking. Não restaurar os antigos passos de criação, Salvar na mochila ou rematch manual. Não editar backend durante teste de partida sem considerar que o watch reinicia as salas em memória.

## Continuação após refinamento local

Pedido posterior prevalece: mochila equipa/pinta/oculta imediatamente por fila global com ACK correlacionado, sem Salvar/Restaurar/lixeira; duplo clique no slot desequipa. Corpo estático, aura animada separada, arma oculta na prévia e composição mais próxima do nome. Retrato circular do HUD do lobby preenchido pela cabeça universal e equipamentos visíveis, sem aura/corpo/arma/fantasia. Loja conserva experimentação local. Ler `customization.md` antes de editar esse fluxo.
Preservar personagens estáticos e maiores na mochila/loja, ausência de armas no lobby, slots ampliados, restauração por ícone e molduras de `MenuFrame.css`. Arena usa matchmaking de grupos separados: quatro cartas somente de aliados, formato pela ocupação, `queue`/`cancel-queue`, mapa aleatório servidor e treino explícito separado. Ler `docs/matchmaking.md` antes de mudar salas ou seus testes.

Somente os seis cosméticos provisórios listados no topo de `AGENTS.md` foram retirados. Manter os rostos, Surfista, Executivo, cabelo Ondulado e chapéus pintados. A migração troca posses dos protótipos por peças atuais. Esta clarificação substitui qualquer interpretação de remover todos os itens anteriores à loja.

Gênero escolhido na criação e fixo; rostos completos, roupas, cabelos e chapéus possuem compatibilidade autoritativa. Loja separada em Masculino, Feminino e Unissex. Não permitir experimentar/comprar/equipar peças incompatíveis. Perfis legados preservam posses e recebem migração baseada na roupa. Ler `docs/customization.md`.

Fantasia é o nono slot, unissex, substitui a aparência completa em todos os contextos sem alterar atributos/hitbox/gênero. Coleção inicial: Pintinho do Trovão e Raposa Arcana, concedidos uma vez no conteúdo 12. Sem itens “Sem ...” no inventário: sentinelas internas representam slots vazios. Engrenagem na prévia controla chapéu, óculos e fantasia; preferências fazem parte da personalização salva. Não alterar o shape de rostos normais para acomodar fantasias. Prompts e medidas em `costume-art-prompts.md`.

Usuário aprovou o formato dos menus e pediu harmonizar cabeçalho/fundo. Preservar molduras compactas, personagem estático, slots maiores e botões por ícone.

No celular, somente paisagem é jogável. Retrato mostra uma orientação para girar, bloqueia entrada e cancela a carga pendente sem dispará-la. Preservar sessão, rascunhos e partida ao girar; servidor continua autoritativo. Testar celulares em 844×390, 932×430 e 667×375, com toque real/emulado e ações acessíveis. Screenshots antigos em retrato não autorizam manter o jogo vertical.

## Checkpoint atual para voltar ao computador local

Ler primeiro [local-handoff.md](local-handoff.md). A sessão cloud encerra após integrar seis chapéus vestidos e variantes pintadas de cabelo coberto, substituindo compressão e sobreposição antigas. `headwear.ts`, `COVERED_HAIR` e as passagens posterior/frontal do rig são o caminho atual. Ícones usam a arte vestida. Loja, compra/persistência, seis rostos universais e poses foram verificados. Preservar essa implementação; documentos abaixo descrevem também etapas históricas. O próximo trabalho depende do novo pedido do usuário, sem retomada automática de outras frentes.

Use o texto abaixo quando solicitar a próxima etapa. Esta documentação não autoriza iniciar trabalho adicional durante o encerramento do checkpoint atual.

---

Continue o projeto existente neste repositório. Primeiro leia `AGENTS.md`, `README.md`, `docs/implementation-status.md`, `docs/cloud-handoff.md` e `docs/face-authoring-rules.md`. Inspecione o código e o jogo antes de alterar. Não recomece do zero nem confunda recursos presentes com acabamento concluído.

Estamos criando um jogo de navegador de artilharia por turnos, com referência de funcionamento no DDTank, arte original chibi pintada e interface com aspecto de jogo. O usuário rejeitou cenários genéricos, itens com cara de pixel art, rostos geométricos, chapéus colados, roupas que mudam apenas de cor e menus verdes com aspecto de site.

## Decisões finais que prevalecem sobre os briefings antigos

- Personalização visível: rosto completo, roupa completa, cabelo, chapéu, óculos e fantasia completa. Arma separada. Pulseira e bracelete equipáveis, porém invisíveis no personagem.
- Sem bolsa, acessórios extras, asas, anel, luvas ou slots separados de boca/olhos/sobrancelhas/calça/sapatos.
- Roupa cobre todo o corpo do pescoço para baixo, incluindo mãos, calça e sapatos. **Cada roupa tem pose base exclusiva desenhada**, não apenas outra cor ou uma animação genérica. Surfista usa base larga e gesto shaka; Executivo usa postura formal, mão na gravata e outra no bolso. Preservar essas silhuetas.
- Rosto troca a feição inteira: olhos, pálpebras, sobrancelhas e boca. Criar expressões diferentes de verdade. **Todos devem usar o mesmo shape, escala e âncoras universais**, sem prejudicar encaixe dos cabelos. Seguir integralmente `face-authoring-rules.md`.
- Cabelos, roupas e chapéus devem ter cortes/silhuetas diferentes, acabamento pintado, volume e detalhes. Variação de cor é uma personalização adicional, não substitui uma nova peça.
- Ícone e item vestido devem representar a mesma arte. Não entregar um ícone bonito enquanto o boneco usa um desenho provisório incompatível.
- Cores vivas, fantasiosas e materiais definidos; evitar predominância pastel ou névoa leitosa. Esta regra substitui a antiga direção creme/pastel. UI com safira, rubi e ouro, fundos pintados, botões proporcionais e molduras com conteúdo dentro da borda; poucos textos, sem explicações técnicas no fluxo do jogador.

## Objetivo da próxima etapa

Consultar as pendências em `implementation-status.md` e o pedido atual antes de escolher a próxima frente. Cenários, roupas Surfista/Executivo, arena, mochila, HUD e ferreiro foram retomados. Todas as roupas antigas, inclusive Azure/Celeste e Royal/Real, foram removidas. Os cinco rostos continuam integrados; preservá-los. Os dois corpos pintados carregam individualmente, enquanto o flag geral de aparência modular permanece desativado para as demais camadas incompletas.

Organize especialistas conforme `AGENTS.md`: arte de equipamentos, animação/encaixes, UI/UX, cenários, armas/VFX e QA. Distribua arquivos sem sobreposição; coordenador mantém catálogo/protocolo e integra os contratos. Use rodízio de agentes se houver limite de concorrência. Não precisa recriar agentes cujo escopo não faça parte da etapa pedida.

## Requisitos do jogo a preservar

Lobby como uma rua medieval ilustrada, com jogadores andando e entrada da arena/ferreiro; outras construções podem vir depois. Presença real de outros jogadores, grupos de aliados e matchmaking 1×1/2×2/3×3/4×4 e treino separado. Arena ocupa a tela do jogo, com chat e quatro vagas somente para aliados. O dono pode expulsar outros ocupantes durante a espera, fora da fila e do combate. Não restaurar vagas espelhadas, adversários manuais ou seletor de mapa. HUD com dados do jogador e mochila com personagem, slots, drag-and-drop e detalhes ao passar o mouse.

Inventário: experimentar localmente, remover, restaurar e salvar uma combinação. A mesma aparência deve funcionar na prévia, lobby, sala e batalha. Chapéu, cabelo e óculos simultâneos, com oclusão correta. Nenhum item pode apagar outro slot indevidamente. Salvar e sincronizar para outros jogadores; servidor impede itens não possuídos.

Animações: parado, caminhada, mira, carga, disparo/recuo, dano, queda, inclinação, deitado, vitória e derrota. No combate, o corpo fica chibi compacto e baixo sob a cabeça, mantendo a roupa e a arma atrás; no lobby, a roupa mantém sua pose exclusiva. Equipamentos acompanham partes do rig; evitar apenas girar o boneco inteiro em situações que exigem articulação.

Quatro armas com identidade própria, atributos, trajetória, crateras e efeitos de lançamento/impacto. Arte base em +0–8, primeira evolução em +9, outra em +10–11 e completa em +12. VFX acompanham a evolução. Badge ao lado do nome nos detalhes; elaborado a partir de +5. Aura luminosa translúcida atrás do personagem gira e evolui em +5, +9 e +12; aparece SOMENTE no inventário, perfil e cartas da arena, por showAura explícito. Sem disco no chão ou moldura de metal opaco. Nível do jogador vai até 70; badges cinza completo1–10, verde11–20, azul21–30, bronze31–40 e prata41–50. Dourado ativo do 51 ao 70, conforme pedido mais recente. Novas bases atrás dos numerais e aura crescente desde30, mais elaborada no40/50; tamanhos menores nas cartas, com personagem204px desktop/180px mobile.

Ferreiro: acesso pelo NPC, mesma moldura do inventário, abas Fortalecer e Composição ativas, escolher equipamento por clique ou arraste; pedras níveis I–V, várias pedras aumentam a chance exibida, níveis altos mais difíceis, todas as pedras selecionadas consumidas em sucesso ou falha. Falha não derruba nível. Feedback de sucesso/falha grande e bonito, efeito de fortalecimento; Composição mostra prévia do atributo, chance e custo antes de confirmar; ver shared/composition.ts e docs/composition.md.

Cartões compartilhados: cinza comum, azul raro/normal, roxo épico, dourado lendário; há também incomum no catálogo. Fundo e borda coerentes com a raridade. Todas as pedras são comuns, embora suas cores minerais sejam diferentes.

Cenários: Jardim Encantado destrutível, Parque dos Sonhos híbrido, Fortaleza Celestial indestrutível. Sete camadas, parallax, objetos animados, materiais, crateras e colisão autoritativos. Não considerar terminado um fundo ilustrado com plataforma genérica. Consultar `maps-checkpoint.md` e o briefing de mapas.

## Arquitetura, segurança e validação

React + Canvas 2D no cliente; TypeScript/Fastify/WebSocket, PostgreSQL e Redis no servidor. Reutilizar módulos existentes. Cliente envia intenções, servidor decide recursos/dano/chance/terreno. Testar posse, transações, turnos, reconexão e estado consistente entre clientes. Otimizar caches/partículas/texturas e evitar tráfego cosmético desnecessário.

Não prometer suporte a milhares de jogadores sem ensaios relevantes. Estado de partidas ainda está num processo: horizontalização é uma etapa explícita futura. Documentar limites e decisões com honestidade.

Trabalhar até código, arte, integração e testes da etapa solicitada estarem concluídos. Inspecionar capturas reais antes de habilitar uma arte nova. Rodar checks adequados, smoke de navegador e integração. Registrar prompts usados, metadados de encaixe, evidências e pendências. Não declarar todo o jogo pronto se houve apenas checkpoint parcial.

Os briefings originais estão em `docs/briefings/customization-original.md` e `maps-original.md`; são referências detalhadas. Quando contradizem os slots/roupas/rostos definidos acima, **as decisões recentes acima prevalecem**.


## Continuação mais recente: loja, resultados e Power

Limite 70 ativo, dourado do 51 ao 70. Carga Power do combate é independente da força do disparo e do Poder do perfil. Ler `combat-power.md`, `combat-rewards.md`, `shop.md` e `shop-cosmetics-prompts.md` para contratos atuais. As cartas de recompensa só revelam no fim dos 15 segundos, inclusive a própria. Armas básicas têm cores; Super a partir de +9 possui fundo próprio. Dinamite deixa queimadura no terreno; cada família tem resíduos diferentes. Loja possui provador local, gêneros, categorias e carrinho transacional usando Moedas Brasa (`gold`). Novos convidados não começam possuindo todo o catálogo; preservar posses das contas antigas.

Quatro roupas, seis rostos universais, novos cabelos e óculos. Não restaurar Celeste/Real. Os novos cosméticos são comprados, nunca autoconcedidos por migração. Balanceamento econômico e do Power permanece provisório. Partidas e rodadas de cartas pendentes ainda são mantidas em memória e não sobrevivem a reinício do processo; perfis/compras/prêmios já concluídos são persistidos no PostgreSQL.
