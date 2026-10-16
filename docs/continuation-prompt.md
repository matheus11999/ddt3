# Prompt de continuidade — Brasa Arena / ddt3

Use o texto abaixo quando solicitar a próxima etapa. Esta documentação não autoriza iniciar trabalho adicional durante o encerramento do checkpoint atual.

---

Continue o projeto existente neste repositório. Primeiro leia `AGENTS.md`, `README.md`, `docs/implementation-status.md`, `docs/cloud-handoff.md` e `docs/face-authoring-rules.md`. Inspecione o código e o jogo antes de alterar. Não recomece do zero nem confunda recursos presentes com acabamento concluído.

Estamos criando um jogo de navegador de artilharia por turnos, com referência de funcionamento no DDTank, arte original chibi pintada e interface com aspecto de jogo. O usuário rejeitou cenários genéricos, itens com cara de pixel art, rostos geométricos, chapéus colados, roupas que mudam apenas de cor e menus verdes com aspecto de site.

## Decisões finais que prevalecem sobre os briefings antigos

- Personalização visível: rosto completo, roupa completa, cabelo, chapéu e óculos. Arma separada. Pulseira e bracelete equipáveis, porém invisíveis no personagem.
- Sem bolsa, acessórios extras, asas, anel, luvas ou slots separados de boca/olhos/sobrancelhas/calça/sapatos.
- Roupa cobre todo o corpo do pescoço para baixo, incluindo mãos, calça e sapatos. Cada roupa pode ter pose própria.
- Rosto troca a feição inteira: olhos, pálpebras, sobrancelhas e boca. Criar expressões diferentes de verdade. **Todos devem usar o mesmo shape, escala e âncoras universais**, sem prejudicar encaixe dos cabelos. Seguir integralmente `face-authoring-rules.md`.
- Cabelos, roupas e chapéus devem ter cortes/silhuetas diferentes, acabamento pintado, volume e detalhes. Variação de cor é uma personalização adicional, não substitui uma nova peça.
- Ícone e item vestido devem representar a mesma arte. Não entregar um ícone bonito enquanto o boneco usa um desenho provisório incompatível.
- UI arredondada, confortável, animada, coesa e com acabamento de jogo. Preservar o tema quente atual como base, melhorar fundos/texturas; poucos textos, sem explicações técnicas no fluxo do jogador.

## Objetivo da próxima etapa

Retomar as pendências priorizadas em `implementation-status.md`, começando pelos cabelos, roupas completas, chapéus e ícones. Os cinco rostos deste checkpoint já estão integrados e validados; preservá-los. O flag de corpos completos está desativado intencionalmente até as artes pendentes serem terminadas e testadas.

Organize especialistas conforme `AGENTS.md`: arte de equipamentos, animação/encaixes, UI/UX, cenários, armas/VFX e QA. Distribua arquivos sem sobreposição; coordenador mantém catálogo/protocolo e integra os contratos. Use rodízio de agentes se houver limite de concorrência. Não precisa recriar agentes cujo escopo não faça parte da etapa pedida.

## Requisitos do jogo a preservar

Lobby como uma rua medieval ilustrada, com jogadores andando e entrada da arena/ferreiro; outras construções podem vir depois. Presença real de outros jogadores, salas/criação de sala, 1×1/2×2 e treino. HUD com dados do jogador e mochila com personagem, slots, drag-and-drop e detalhes ao passar o mouse.

Inventário: experimentar localmente, remover, restaurar e salvar uma combinação. A mesma aparência deve funcionar na prévia, lobby, sala e batalha. Chapéu, cabelo e óculos simultâneos, com oclusão correta. Nenhum item pode apagar outro slot indevidamente. Salvar e sincronizar para outros jogadores; servidor impede itens não possuídos.

Animações: parado, caminhada, mira, carga, disparo/recuo, dano, queda, inclinação, deitado, vitória e derrota. Equipamentos acompanham partes do rig; evitar apenas girar o boneco inteiro em situações que exigem articulação.

Três armas com identidade própria, atributos, trajetória, crateras e efeitos de lançamento/impacto. Arte simples e pouco saturada em +0–8, primeira evolução em +9, outra em +10–11 e completa em +12. VFX acompanham a evolução. Badge ao lado do nome nos detalhes; elaborado a partir de +5. Círculo atrás do personagem gira e evolui em +5, +9 e +12.

Ferreiro: acesso pelo NPC, só aba Upgrade ativa, escolher arma por duplo clique ou arraste; pedras níveis I–V, várias pedras aumentam a chance exibida, níveis altos mais difíceis, todas as pedras selecionadas consumidas em sucesso ou falha. Falha não derruba nível. Feedback de sucesso/falha grande e bonito, efeito de fortalecimento; sem atributos ou prévia da futura arma no painel.

Cartões compartilhados: cinza comum, azul raro/normal, roxo épico, dourado lendário; há também incomum no catálogo. Fundo e borda coerentes com a raridade. Todas as pedras são comuns, embora suas cores minerais sejam diferentes.

Cenários: Jardim Encantado destrutível, Parque dos Sonhos híbrido, Fortaleza Celestial indestrutível. Sete camadas, parallax, objetos animados, materiais, crateras e colisão autoritativos. Não considerar terminado um fundo ilustrado com plataforma genérica. Consultar `maps-checkpoint.md` e o briefing de mapas.

## Arquitetura, segurança e validação

React + Canvas 2D no cliente; TypeScript/Fastify/WebSocket, PostgreSQL e Redis no servidor. Reutilizar módulos existentes. Cliente envia intenções, servidor decide recursos/dano/chance/terreno. Testar posse, transações, turnos, reconexão e estado consistente entre clientes. Otimizar caches/partículas/texturas e evitar tráfego cosmético desnecessário.

Não prometer suporte a milhares de jogadores sem ensaios relevantes. Estado de partidas ainda está num processo: horizontalização é uma etapa explícita futura. Documentar limites e decisões com honestidade.

Trabalhar até código, arte, integração e testes da etapa solicitada estarem concluídos. Inspecionar capturas reais antes de habilitar uma arte nova. Rodar checks adequados, smoke de navegador e integração. Registrar prompts usados, metadados de encaixe, evidências e pendências. Não declarar todo o jogo pronto se houve apenas checkpoint parcial.

Os briefings originais estão em `docs/briefings/customization-original.md` e `maps-original.md`; são referências detalhadas. Quando contradizem os slots/roupas/rostos definidos acima, **as decisões recentes acima prevalecem**.
