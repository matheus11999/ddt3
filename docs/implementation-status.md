# Estado da entrega — 16/10/2026

## Limite desta etapa

Última instrução: terminar **somente os rostos**, documentar pendências, prompt e agentes, enviar a `matheus11999/ddt3` e preparar continuidade na cloud. As outras frentes foram encerradas no ponto em que estavam. Este é um checkpoint de um jogo em desenvolvimento, não o jogo completo aprovado.

## Rostos concluídos

- Cinco pinturas completas: `face-brave`, `face-smile`, `face-taunt`, `face-serene`, `face-fierce`. Cada item troca olhos, pálpebras, sobrancelhas e boca juntos. São feições diferentes, não somente cores.
- PNGs RGBA em `public/assets/faces/`; medidas de conteúdo em `manifest.json`; prompts exatos em `docs/face-art-prompts.md`.
- `src/game/faces.ts` define o registro universal. `composeUniversalHead()` preserva transparência, crânio, orelha e pescoço da base; mescla a pintura facial no interior com `source-atop`. Nenhum rosto modifica o encaixe dos cabelos, chapéus ou óculos.
- `getFacePortrait()` fornece a mesma pintura ao ícone e ao avatar. `drawAvatar()` é compartilhado entre mochila, sala, lobby e combate; os rostos acompanham o transform da cabeça nas poses.
- Catálogo, validação, salvamento atômico, recarga e sincronização multiplayer usam o slot único `face`.
- Rostos estão ativos independentemente de `ENABLE_MODULAR_APPEARANCE=false`, que protege a troca para corpos de roupa ainda incompletos.
- Prévia em `docs/previews/faces.png`: cinco cabeças com **zero diferenças de alfa** e mais de 10 mil pixels de cor diferentes entre a expressão-base e cada outra.

Expressões são pinturas estáticas escolhidas pelo jogador. Piscadas, fala e sprites faciais específicos de dano/vitória não estão prontos. Falha de carga preserva o avatar original; não há retry automático de asset com erro, sendo necessária recarga.

## Regras atuais consolidadas

Oito slots: `weapon`, `face`, `outfit`, `hair`, `hat`, `glasses`, `wristband`, `bracelet`. Roupa inclui todo o corpo do pescoço para baixo, inclusive mãos, calça e sapatos. Pulseira e bracelete têm atributos, mas não aparecem no boneco. A arma permanece separada para combate.

Itens antigos de olhos/boca/sobrancelhas separados, luvas, sapatos/calças separados, bolsa, acessório/cachecol, asas, anel e efeito cosmético independente foram retirados do catálogo e da normalização do inventário. `CONTENT_VERSION=5` migra os itens iniciais. A aura automática de fortalecimento +5/+9/+12 continua.

## Sistemas presentes

| Parte | Estado real |
| --- | --- |
| Infraestrutura | Docker, Nginx, Fastify/WebSocket, PostgreSQL e Redis; execução local |
| Lobby | Rua ilustrada, arena/ferreiro, presença, movimento interpolado e animação |
| Salas/combate | 1×1, 2×2, bots, turnos, vigor, vento, trajetória/terreno autoritativos |
| Mochila | Oito slots, filtros, busca, páginas, arraste, tooltip, prévia local, remover/restaurar/salvar |
| Ferreiro | Upgrade, pedras I–V, chance autoritativa, consumo em sucesso/falha, feedback grande animado; sem atributos/prévia de evolução |
| Armas | Três famílias, arte 0/9/10/12, VFX/áudio próprios; empunhadura ainda precisa acabamento |
| Cartões/badges | Raridades compartilhadas; pedras comuns; badge junto ao nome nos detalhes, elaborado a partir de +5 |
| Poses | Rig recortado/articulado com dez estados; ainda requer revisão artística |
| Cenários | Jardim, Parque e Fortaleza integrados; acabamento e QA final pendentes |

## O que falta — ordem sugerida para a próxima etapa

1. **Cabelos.** `hair-spiky.png` integrado; `hair-wavy.png` falta. `hair-silver` reutiliza o curto com outra cor, contrariando a meta de penteados distintos. Criar silhuetas diferentes, partes frente/trás e compatibilidade com chapéus. Cabelo ausente usa o curto como fallback.
2. **Roupas completas.** `outfit-azure-body.png` existe, desativado e não validado; `outfit-royal-body.png` falta. Corpo original e tintura provisória mantêm o jogo estável. Criar cortes, materiais e poses distintos, revisar máscaras/articulações e só então ativar o flag. Não alterar a cabeça universal.
3. **Chapéus/óculos.** Novo `hat-mage.png` existe, mas ainda não está ligado ao catálogo/renderer. Piloto/cavaleiro não têm PNGs finais. Há desenhos Canvas/SVG provisórios. Ajustar volume do boné sobre cabelo, oclusão, perspectiva e máscaras de tintura; preservar metal/pele.
4. **Ícones restantes.** Rostos usam pintura real. Cabelos, roupas, vários chapéus, óculos e joias ainda usam SVGs provisórios. Substituir por recortes/enquadramentos da própria arte final. `outfit-azure.png`/`outfit-royal.png` são ícones antigos de torso, anteriores à regra de roupa completa.
5. **Animações.** Revisar ombros, joelhos, pescoço e mãos nas dez poses, duas direções e inclinações. Empunhadura das armas ainda aproximada; precisa encaixe por família/pose. Verificar dois jogadores reais com combinações diferentes. Execução sem erro não equivale a aprovação artística.
6. **Cenários.** Seguir `maps-checkpoint.md`: harmonizar objetos animados, bordas das ilhas, três mapas no Docker em 2×2/reconexão, áudio ambiental, culling e mobile. Qualidade possui API/localStorage, mas falta seletor. Zoom funciona com roda/botão do meio e evento `brasa-camera`; faltam botões/toque. Miniaturas precisam arte própria.
7. **Interface.** Preservar madeira/creme/cobre e bordas arredondadas. Revisar responsividade, tooltip/toque e textos redundantes; não voltar ao visual verde de formulário rejeitado.
8. **VFX/balanceamento.** Validar todas as armas/estágios/ferramentas/mapas e sons por material. Base +0–8 simples e pouco saturada, mudanças em +9/+10/+12. Auras +5/+9/+12 independem da arte da arma.
9. **Produção/escala.** Login/recuperação, economia/reposição de pedras, TLS, backups, métricas, distribuição das simulações, versionamento de mapa/protocolo e carga com partidas concorrentes. Redis hoje não distribui salas. Capacidade de muitos jogadores não comprovada.

Essas frentes não foram concluídas nesta entrega, por solicitação do usuário. Retomar mediante novo pedido.

## Verificação

- TypeScript e build de produção aprovados.
- Suíte unitária: 36 testes de catálogo/migração, posse, combate, materiais, mapas, snapshots e transações.
- `verify-faces.mjs`: cinco expressões, contorno alfa idêntico, montagem com cabelo/boné inspecionada.
- `smoke-browser.mjs`: regressão da tela vazia com `scrollIntoView` assíncrono; oito slots; arraste; prévia local; restauração; chapéu/óculos simultâneos; rosto/joias/tintura salvos; caminhada/deitado; recarga; treino e retorno ao lobby.
- Integração real: cinco rostos persistidos no PostgreSQL e recebidos por um segundo cliente WebSocket; sala de dois jogadores; fortalecimento; nove projéteis; reconexão e concorrência transacional.
- Docker web/server reconstruídos; smoke e integração completos aprovados também em `http://127.0.0.1:8097`. Inspeção do lobby de produção sem erros de console/JavaScript. A verificação em Linux/cloud continua a cargo do novo ambiente; a portabilidade dos scripts foi preparada, mas não foi anunciada como testada em Linux.
- Cenários: 13 testes da suíte e nove capturas do harness, detalhados em `maps-checkpoint.md`.
- Carga anterior: 24 conexões locais de lobby; não foi repetida por esta alteração facial e não comprova capacidade de produção.

Capturas temporárias ficam em `test-results/` (ignorado); a prancha facial é versionada em `docs/previews/`. Veja `cloud-handoff.md` para executar os testes em Linux/cloud.

## Continuidade

Leia `continuation-prompt.md`, `face-authoring-rules.md` e `AGENTS.md`. Os dois briefings originais em `docs/briefings/` são contexto histórico: as decisões recentes deste documento prevalecem. Agentes não são processos persistidos pelo Git; recrie as funções necessárias em outra sessão.
