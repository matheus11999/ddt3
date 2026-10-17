# Orientação para agentes

## Direção artística atual — pedido do usuário em 16/10/2026

- Usar cores vivas, fantasiosas e contrastes claros, com pigmentos saturados, luz e materiais bem definidos. Evitar predominância de tons pastéis, aparência lavada, névoa leitosa e o acabamento genérico associado a imagens de IA.
- Power-ups de combate seguem a referência de setas +1/+2/×3 e POWER com 50%/40%/30%/20% grandes e legíveis, em vermelho com contorno claro. Base ilustrada 3D, volume espesso e cores vivas; textos sobrepostos no HUD, nunca somente em tooltip. Atlas ativo `boost-arrows-power.png`; não substituir a linguagem de setas/porcentagens por armas, punhos ou gemas sem números.
- Cenários devem ser lugares originais ricos e reconhecíveis, com terreno integrado à composição. Pesquisar e inspecionar referências reais de mapas do DDTank antes de decidir composição; estudar linguagem visual e destruição sem copiar seus assets proprietários.
- Redesenhar a apresentação dos menus: fundos, molduras, hierarquia, botões com proporções ajustadas e ícones coerentes. Aplicar a mesma direção às roupas e aos cenários, preservando legibilidade e os fluxos funcionais.
- Roupas completas mantêm a cabeça universal e incluem todo o corpo do pescoço para baixo. **Cada roupa tem uma pose base exclusiva, desenhada no próprio corpo**, além de corte e materiais próprios: surfista relaxado não pode ser o mesmo corpo/gesto de executivo formal. Ícone e avatar usam essa mesma composição pintada; não reduzir a diferenciação a cores ou às animações genéricas do rig.
- Roupas antigas, inclusive Celeste/Azure e Real/Royal, foram retiradas. Preservar Surfista, Executivo e os cinco rostos originais; novos cosméticos da loja são autorizados, mas não restaurar itens antigos em migrações.
- Aura do personagem é luz translúcida, com centro vazio e rotação lenta, ativada explicitamente no inventário, perfil, cartas da arena e retrato do jogador no HUD/resultados. Nunca desenhar pedestal/elipse sob os pés nem aura nos bonecos dentro do cenário do lobby ou combate. Evolução visual progressiva é uma característica central do jogo.
- Badges de nível: **1–10 inteiramente cinza, 11–20 verde, 21–30 azul, 31–40 bronze, 41–50 prata, 51–70 dourado**. Pedido mais recente amplia o limite para **70**. Aura começa no 30, cresce continuamente e ganha camadas no 40, 50, 60 e 70, sempre na cor da faixa. Badges menores: 40px HUD, 42px mochila, 46px carta desktop/36px mobile; personagem da carta 204px/180px.
- Combate usa corpo chibi reduzido, baixo sob a cabeça universal, preservando roupa e arma atrás do corpo. Fora do combate, preservar as poses base exclusivas.
- Arena ocupa a área completa do jogo, com chat integrado e cartas verticais. Quatro vagas por equipe permitem 1×1 a 4×4. Apenas o dono fecha pares de vagas ou expulsa outros ocupantes durante a espera; servidor valida todas as ações.
- Mochila e ferreiro compartilham moldura com área interna real. Detalhes de item somente em tooltip, nunca num rodapé permanente. Ferreiro tem Fortalecer e Composição funcionais; chance, custo e resultado são autoritativos.
- Armas sem fortalecimento têm cores vivas e materiais legíveis, com desenho mais simples; nunca arte carbonizada/cinza por serem básicas. **Super começa em +9**, com fundo exclusivo no card, sem substituir a raridade. Cada arma possui projétil, impacto e resíduos próprios no terreno (dinamite deixa queimadura; sorvete é exemplo de futura arma).
- Combate: setas do teclado para andar/mirar, Espaço para carregar/soltar. Não reintroduzir botões separados de segurar ou andar. Régua aceita toque; timer sem placa de fundo e alerta desde 10 segundos. Resultado translúcido permanece sobre o mapa: oito cartas, uma escolha exclusiva por participante e revelação de TODAS somente ao fim dos 15 segundos. Cartas com acabamento sóbrio, textura discreta e relevo; sem excesso de ornamentos RPG ou aparência de brinquedo plástico.
- Power é uma carga de combate de 0 a 100: acertar um inimigo acumula energia, receber dano acumula mais. Somente com carga cheia, vivo e no próprio turno é possível ativar; arma o próximo tiro, com dano/área/efeitos ampliados e animação central do personagem antes do lançamento. Servidor valida tudo; não confundir a carga Power com o atributo Poder do perfil nem com a força da régua.
- Chapéus/bonés devem envolver a cabeça e acomodar o cabelo: dimensionar pela abertura interna, nunca pela ponta da aba. Preservar cabelo posterior/laterais/rabo, encaixar a copa e manter a aba na frente. Conferir também sem cabelo e em movimento; não aprovar apenas porque o asset carregou.
- Encaixe de chapéus usa variantes pintadas de cabelo em `hair-covered-atlas.png` e seis chapéus vestidos em `headwear-worn-atlas.png`, registrados em `src/game/headwear.ts`. Ler `docs/headwear-research.md`: não restaurar a compressão do cabelo normal, os antigos bonés sobrepostos ou os recortes antigos nos ícones. Cabelo posterior é desenhado antes da cabeça; franja e aba depois, acompanhando a mesma transformação em combate e fora dele. Óculos de voo usam cabelo descoberto; elmo usa a variante coberta.
- Moedas Brasa são a moeda básica (campo persistido `gold`). Loja com prévia local, categorias, filtros masculino/feminino/todos, atributos em tooltip e carrinho; servidor valida preços, posse e saldo em uma transação. Novos itens da loja são comprados, nunca equipados ou concedidos automaticamente por experimentar.
- Esta direção mais recente prevalece sobre descrições antigas de paletas pastel/creme nos prompts e checkpoints. O pedido atual autoriza retomar cenários, roupas e interface; não altera as regras de rostos e autoridade do servidor.

Leia primeiro `README.md`, `docs/implementation-status.md`, `docs/cloud-handoff.md` e `docs/continuation-prompt.md`. A instrução mais recente do usuário prevalece. O checkpoint inicial de rostos foi ampliado pelo pedido de cenários, roupas e interface. **Não retomar outras pendências automaticamente** ao apenas inspecionar ou publicar o projeto.

## Regra obrigatória de cosméticos: validar antes e depois de gerar

Pedido do usuário em 17/10/2026. Vale para qualquer IA ou agente que gere ou repinte cabelo, chapéu, óculos ou roupa. Contrato em `docs/cosmetics-fit.md`.

1. **Antes de gerar:** rodar `npm run verify:cosmetics` e ler `test-results/cosmetics/report.md`. Usar como referência o molde da classe em `docs/templates/` (regerar com `node scripts/make-cosmetic-templates.mjs`) e o prompt-base de `docs/cosmetics-art-briefs.md`.
2. **Gerar** a peça pintada sobre o molde de 1254 px, dentro da zona verde e sem cobrir olhos/boca. Registrar em `COSMETIC_MANIFEST` (`src/game/rig/manifest.ts`); nunca adicionar números de encaixe em `appearance.ts` ou `headwear.ts`.
3. **Depois de gerar:** rodar `npm run verify:cosmetics` de novo. A peça só entra com zero problemas no relatório e `npm test` passando. Em seguida mostrar `zones.png` e `matrix.png` ao usuário: passar no validador não substitui a aprovação visual.

## Regra obrigatória de novos rostos

Siga `docs/face-authoring-rules.md`. Todos os rostos devem ter exatamente o mesmo shape universal, tamanho, orientação e âncoras. Mudar a feição completa, nunca o contorno para acomodar cabelos. Ícones e avatar devem usar o mesmo compositor. Validar `scripts/verify-faces.mjs` e inspecionar o resultado montado antes de entregar. Não editar cada cabelo para compensar um rosto fora da medida.

## Coordenação quando a continuidade for solicitada

O usuário pediu agentes especialistas. Use subagentes por domínio, em rodízio quando necessário, sem criar chats separados. Defina propriedade dos arquivos e comunique contratos antes de editar código compartilhado.

| Papel | Responsabilidade |
| --- | --- |
| Integração / coordenador | Catálogo, protocolo, persistência, contratos, revisão e publicação; proprietário dos arquivos compartilhados |
| `face_artist` | PNGs/manifesto de rostos, prompts; preservar regra universal, sem alterar renderer por conta própria |
| `game_art` | Pintura de cabelos, roupas, chapéus e óculos; `public/assets/` exceto rostos/mapas; prompts/encaixes |
| `character_animation` (antes `upgrade_server`) | `avatar.ts`, `appearance.ts`, `faces.ts`, `Avatar.tsx`; rig, oclusão, tintura, dez poses |
| `forge_ui` | `Inventory.*`, `Forge.*`, `ItemIcon.tsx`, `ItemCard.*`, `UpgradeBadge.*`; ícones, menus, interações |
| `environment_engineer` | `shared/maps.ts`, física de mapas, `environment.ts`, assets/prompts de cenários; coordenar mudanças em `Scene.tsx` |
| `weapon_vfx` | `weaponEffects.ts`, `audio.ts`, efeitos por família/estágio; sprites em coordenação com artista |
| `qa_integration` | Persistência/protocolo, navegador, capturas, poses e combinações, revisão das limitações |

O agente `upgrade_server` também implementou fortalecimento/transações na primeira etapa. Os nomes são histórico de responsabilidades, não agentes que continuarão ativos na cloud. Não manter agentes editando após instrução de encerramento.

## Contratos

- Slots: arma, rosto, roupa completa, cabelo, chapéu, óculos, pulseira e bracelete. Joias invisíveis. Sem bolsa/acessórios/asas/anel ou olhos/boca separados.
- Roupa cobre do pescoço para baixo: mãos, calça e sapatos incluídos. Pose pode variar sem alterar a cabeça universal.
- `ENABLE_MODULAR_APPEARANCE=false` é intencional para corpos incompletos. Rostos estão ativos independentemente desse flag.
- Arte da arma: 0–8 / 9 / 10–11 / 12. Aura automática: 5 / 9 / 12. Pedras I–V sempre comuns.
- Jogo chibi pintado, com volume e contornos consistentes; sem pixel art ou SVG genérico apresentado como arte final. UI arredondada, coesa, com aspecto de jogo.
- Servidor valida intenção, posse, turno e recursos. Cliente não decide dano, chance, saldo, cratera ou sucesso de upgrade. Salvar em transações PostgreSQL.
- Preservar código existente e trabalho de outros agentes. Sem reconstrução desnecessária, reset, force push ou exclusão de diretórios para resolver conflitos.

## Verificação e entrega

Use `npm run check`, `npm test`, `npm run build` e testes de integração pertinentes. Para rostos: `node scripts/verify-faces.mjs` com Vite e inspeção da prancha. Para mapas: `scripts/inspect-maps.mjs`.

Após mudanças em `shared/`/`server/`, atualize o backend antes de testar o navegador. Documente evidências e pendências em `docs/implementation-status.md`; registre prompts e medidas dos assets. Não versionar segredos, `.env`, bancos, builds, `node_modules` ou resultados temporários. Nunca prometer milhares de jogadores a partir de um limite configurado.
