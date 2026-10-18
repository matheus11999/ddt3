# Orientação para agentes

## Objetivo do jogo — pedido do usuário em 17/10/2026

O jogo deve ser **igual ao DDTank**: direção de arte, personalização e combate seguem o DDTank como referência principal. Antes de decidir arte, interface, cosméticos ou regras de combate, comparar com o DDTank e aproximar o resultado dele (proporções chibi, cabeça grande, cores vivas, molduras e menus, slots de roupa, combate por turnos com ângulo, força e vento, mapas destrutíveis). Assets, nomes e marcas proprietárias não são copiados: a arte é pintada de forma original no mesmo estilo.

## Pedido local mais recente — desenvolvimento ao vivo e combate

- Desenvolvimento atual em8097: `docker compose -f compose.yaml -f compose.dev.yaml up -d --build`, Vite/HMR e backend tsx watch com bind mounts. Salvar server/shared reinicia partidas/salas em memória; nunca reconstruir ou limpar banco para atualizar. Produção permanece `docker compose up -d --build`.
- Regras atuais em `docs/combat-stats.md`, `docs/abilities.md`, `docs/matchmaking.md`: dano só no impacto, Sorte/crítico, splash curto, mira inclinada, cura/mira/invisibilidade e voo. Invisibilidade deve redigir dados por destinatário no servidor, inclusive reconexão; cliente não pode interpolar posições ocultas.
- Criar sala imediato, vagas extras fechadas, líder abre; treino com confirmação dentro da sala e bots efêmeros equilibrados. Resultado3s → escolha5s (antecipa se todos escolheram) → cartas2s → mesmas salas após persistência, sem botões de rematch.
- Invisibilidade: ícone de uma silhueta chibi simples parcialmente desaparecendo, sem bolha/água. Mira: alvo circular clássico. Novos grupos de invisibilidade são futuros, não implementados.
- Mochila aplica equipamento, tintura e visibilidade imediatamente, com confirmação autoritativa e fila global correlacionada. Sem Salvar/Restaurar/lixeira; duplo clique no slot desequipa. Corpo estático, aura girando independentemente (`auraAnimated`), arma oculta na prévia e slots maiores/cards menores. Loja mantém provador local. Retrato do HUD do lobby usa só a cabeça universal, cabelo/chapéu/óculos visíveis, sem aura/corpo/arma/fantasia.
- Mochila segue o layout "Informações pessoais" do DDTank (slots ao lado do personagem, atributos em pílulas/barras, grade com abas verticais, carteira no rodapé); ver `docs/backpack-art-prompts.md`.
- Ferreiro segue o mesmo padrão da mochila (pedido de 17/10/2026): madeira laranja, painéis creme, faixas escuras de chance/ação, abas verticais Fortalecer/Composição à direita da grade, cards de classe, selo `UpgradeTag` e o card de informações `InventoryTooltip` reaproveitados da mochila. A bancada tem cara própria de forja (escura com brasas, encaixes redondos e canais até a bigorna, botão Fortalecer logo abaixo do item, animação curta de ~1,3 s antes do resultado); sem selo circular atrás do item e sem Atual/Próximo. Ver `docs/forge-art-prompts.md`.
- Mochila e loja: personagem maior e **estático** (`Avatar animated={false}`), sem controles de caminhada/mira/deitar. Manter redesenho por troca de equipamento e carregamento de assets. Slots da mochila maiores; restaurar visual somente por ícone acessível. Sem texto de convite para experimentar.
- **Celular joga somente em paisagem.** Em retrato, apresentar a orientação para girar o aparelho e bloquear os controles; manter a sessão e o estado do servidor. Girar não recarrega a página nem dispara uma carga pendente. Menus em paisagem usam a largura disponível, rolagem interna e ações acessíveis mesmo com pouca altura. Não reintroduzir a versão jogável vertical por causa de screenshots históricos de 390×844.
- Lobby: não desenhar armas nos jogadores nem nos NPCs. Combate e prévias de equipamentos continuam mostrando a arma. Cartas de jogadores da arena também usam personagem estático, sem flutuação.
- Salas PvP são **grupos de até quatro aliados**. Não mostrar cartas de inimigos, seleção de mapa, seleção manual de modo, vagas espelhadas ou adicionar bots no PvP. Quantidade de integrantes define 1×1/2×2/3×3/4×4; o líder busca outro grupo do mesmo tamanho, com todos conectados e prontos. Servidor sorteia o mapa ao parear. Treino separado usa `practice:true`.
- Fila `queue`/`cancel-queue`, cancelamento por saída/desconexão/equipamento/prontidão; preservar grupos de origem após combate. Não confundir fila por tamanho com ranking/MMR ou capacidade distribuída.
- **Clarificação final sobre itens antigos:** preservar rostos pintados, cabelo Ondulado e chapéus redesenhados. Retirar somente `hat-pilot`, `hat-knight`, `hair-spiky`, `hair-silver`, `glasses-round` e `glasses-pilot`. A migração troca posses antigas por peças atuais, preservando recursos e composições compatíveis. Não remover todos os cosméticos anteriores à loja.
- Gênero escolhido na criação e fixo no perfil; catálogo é a fonte da compatibilidade de rostos completos, roupas, chapéus e cabelos. Servidor impede compra/equipamento incompatível, incluindo customização e tintura. Loja mostra só itens do gênero do personagem e unissex. Perfis anteriores usam a roupa salva como referência, sem perder posses incompatíveis: apenas os itens equipados são ajustados.
- Nove slots incluindo **Fantasia**, unissex, que substitui a aparência completa sem alterar atributos, gênero, arma ou hitbox. Preservar roupa e rosto subjacentes. Fantasias funcionam em todos os contextos; a prévia continua estática. Ler `docs/customization.md` e `docs/costume-art-prompts.md`.
- Não mostrar itens “Sem ...” na mochila/loja. Sentinelas `*-none` existem apenas no contrato de desequipar; não são posses nem cards. Engrenagem na prévia abre opções para exibir chapéu, óculos e fantasia. `Equipment.visibility` é salvo/publicado junto da personalização e oculta só a aparência, preservando atributos.
- Conteúdo 12 concede as duas fantasias iniciais uma única vez, além das migrações anteriores; preservar ouro, materiais e upgrades. Demais cosméticos da loja continuam comprados.
- Menus usam a moldura fina e arredondada de `MenuFrame.css`; não reintroduzir a borda pintada ornamental de 40px. Formato aprovado pelo usuário, com cabeçalho e fundo coesos. A arena tem moldura e layout próprios coerentes com essa direção.
- Loja segue o padrão da mochila e do ferreiro (pedido de 17/10/2026): madeira laranja, provador estático com o selo da aura, vitrine creme com cards horizontais em duas colunas (estilo DDTank), abas verticais de categoria e paginação. **Sem carrinho, sem Poder na prévia, sem filtros Masculino/Feminino/Unissex e sem o texto Unissex** (pedido de 17/10/2026): a loja lista só itens do gênero do personagem e unissex, e cada item é comprado direto no card com uma confirmação. Cards de classe e `InventoryTooltip` reaproveitados da mochila. Ver `docs/shop-art-prompts.md`; prévia com `node scripts/preview-shop.mjs`.
- Salão PvP e sala de espera seguem o padrão da mochila (pedido de 17/10/2026): moldura de madeira laranja, barra de título escura com título dourado, painéis creme, cartas 4:5 com faixa laranja e o selo da aura atrás do personagem. Materiais compartilhados em `src/components/WoodTheme.css`; prompts em `docs/pvp-arena-art-prompts.md`; prévia com `node scripts/preview-arena.mjs`.

Estas regras substituem instruções históricas conflitantes abaixo.

## Direção artística atual — pedido do usuário em 16/10/2026

- Usar cores vivas, fantasiosas e contrastes claros, com pigmentos saturados, luz e materiais bem definidos. Evitar predominância de tons pastéis, aparência lavada, névoa leitosa e o acabamento genérico associado a imagens de IA.
- Power-ups de combate seguem a referência de setas +1/+2/×3 e POWER com 50%/40%/30%/20% grandes e legíveis, em vermelho com contorno claro. Base ilustrada 3D, volume espesso e cores vivas; textos sobrepostos no HUD, nunca somente em tooltip. Atlas ativo `boost-arrows-power.png`; não substituir a linguagem de setas/porcentagens por armas, punhos ou gemas sem números.
- Cenários devem ser lugares originais ricos e reconhecíveis, com terreno integrado à composição. Pesquisar e inspecionar referências reais de mapas do DDTank antes de decidir composição; estudar linguagem visual e destruição sem copiar seus assets proprietários.
- Redesenhar a apresentação dos menus: fundos, molduras, hierarquia, botões com proporções ajustadas e ícones coerentes. Aplicar a mesma direção às roupas e aos cenários, preservando legibilidade e os fluxos funcionais.
- Roupas completas mantêm a cabeça universal e incluem todo o corpo do pescoço para baixo. **Cada roupa tem uma pose base exclusiva, desenhada no próprio corpo**, além de corte e materiais próprios: surfista relaxado não pode ser o mesmo corpo/gesto de executivo formal. Ícone e avatar usam essa mesma composição pintada; não reduzir a diferenciação a cores ou às animações genéricas do rig.
- Roupas antigas, inclusive Celeste/Azure e Real/Royal, foram retiradas. Em 18/10 o matheus deixou **uma única roupa, o Cartógrafo da Aurora** (unissex, inicial de todos); Surfista, Executivo, Piloto e Dançarina foram retiradas e viram Cartógrafo na migração (`RETIRED_OUTFIT_REPLACEMENTS`, versão 15). Preservar os cinco rostos originais; novos cosméticos da loja são autorizados, mas não restaurar itens antigos em migrações.
- Aura do personagem é luz translúcida, com centro vazio e rotação lenta, ativada explicitamente no inventário, perfil, cartas da arena e retrato do jogador no HUD/resultados. Nunca desenhar pedestal/elipse sob os pés nem aura nos bonecos dentro do cenário do lobby ou combate. Evolução visual progressiva é uma característica central do jogo.
- Badges de nível: **1–10 inteiramente cinza, 11–20 verde, 21–30 azul, 31–40 bronze, 41–50 prata, 51–70 dourado**. Pedido mais recente amplia o limite para **70**. Atrás do badge, todas as faixas usam o mesmo padrão de raios de sol do nível 60, na cor da faixa e mais intenso a cada faixa (`level-badge-fx`, pedido de 17/10/2026); sem anéis ou círculos. Aura começa no 30, cresce continuamente e ganha camadas no 40, 50, 60 e 70, sempre na cor da faixa. Badges menores: 40px HUD, 42px mochila, 46px carta desktop/36px mobile; personagem da carta 204px/180px.
- Cabeça dos bonecos 30% maior em todo lugar (pedido de 17/10/2026): `HEAD_SCALE=1.3` em `src/game/rig/anchors.ts`, aplicado no pivô do pescoço. Não compensar redimensionando cabelos, chapéus ou óculos; eles seguem a cabeça.
- Combate usa corpo chibi reduzido, baixo sob a cabeça universal, preservando roupa e arma atrás do corpo. Fora do combate, preservar as poses base exclusivas.
- Combate deitado (pedido de 17/10/2026): arrastar, arma nas costas apontando a mira e arremesso com as mãos valem para todas as roupas pelas camadas universais de `docs/prone-combat.md`. Roupa nova pinta o corpo deitado sobre `docs/templates/prone-body.png`; nunca adicionar coordenadas de braço por roupa.
- Lápide (pedido de 17/10/2026): quem morre vira uma lápide (`public/assets/combat/tombstone.png`, `src/game/tombstone.ts`) no lugar onde caiu, sem barra de vida, nome nem controles; nunca recebe turno. Pode assistir até o fim e recebe a recompensa; se sair no meio da partida (vivo ou morto) fica `left` e perde a recompensa. Sair depois do resultado mantém a recompensa.
- Arena ocupa a área completa do jogo, com chat integrado e cartas verticais. Quatro vagas por equipe permitem 1×1 a 4×4. Apenas o dono fecha pares de vagas ou expulsa outros ocupantes durante a espera; servidor valida todas as ações.
- Mochila e ferreiro compartilham moldura com área interna real. Detalhes de item somente em tooltip, nunca num rodapé permanente. Ferreiro tem Fortalecer e Composição funcionais; chance, custo e resultado são autoritativos.
- Armas sem fortalecimento têm cores vivas e materiais legíveis, com desenho mais simples; nunca arte carbonizada/cinza por serem básicas. **Super começa em +9**, com fundo exclusivo no card, sem substituir a raridade. Cada arma possui projétil, impacto e resíduos próprios no terreno (dinamite deixa queimadura; sorvete é exemplo de futura arma).
- Combate: setas do teclado para andar/mirar, Espaço para carregar/soltar. Não reintroduzir botões separados de segurar ou andar. Régua aceita toque; timer sem placa de fundo e alerta desde 10 segundos. Resultado translúcido permanece sobre o mapa: oito cartas, uma escolha exclusiva por participante e revelação de TODAS somente ao fim dos 15 segundos. Cartas com acabamento sóbrio, textura discreta e relevo; sem excesso de ornamentos RPG ou aparência de brinquedo plástico.
- Power é uma carga de combate de 0 a 100: acertar um inimigo acumula energia, receber dano acumula mais. Somente com carga cheia, vivo e no próprio turno é possível ativar; arma o próximo tiro, com dano/área/efeitos ampliados e animação central do personagem antes do lançamento. Servidor valida tudo; não confundir a carga Power com o atributo Poder do perfil nem com a força da régua.
- Chapéus/bonés devem envolver a cabeça e acomodar o cabelo: dimensionar pela abertura interna, nunca pela ponta da aba. Preservar cabelo posterior/laterais/rabo, encaixar a copa e manter a aba na frente. Conferir também sem cabelo e em movimento; não aprovar apenas porque o asset carregou.
- Encaixe de chapéus usa variantes pintadas de cabelo em `hair-covered-atlas.png` e seis chapéus vestidos em `headwear-worn-atlas.png`, registrados em `src/game/headwear.ts`. Ler `docs/headwear-research.md`: não restaurar a compressão do cabelo normal, os antigos bonés sobrepostos ou os recortes antigos nos ícones. Cabelo posterior é desenhado antes da cabeça; franja e aba depois, acompanhando a mesma transformação em combate e fora dele. Óculos de voo usam cabelo descoberto; elmo usa a variante coberta.
- Moedas Brasa são a moeda básica (campo persistido `gold`). Loja com prévia local, categorias, atributos em tooltip e compra direta por item com confirmação; servidor valida preços, posse e saldo em uma transação. Novos itens da loja são comprados, nunca equipados ou concedidos automaticamente por experimentar.
- Esta direção mais recente prevalece sobre descrições antigas de paletas pastel/creme nos prompts e checkpoints. O pedido atual autoriza retomar cenários, roupas e interface; não altera as regras de rostos e autoridade do servidor.

Leia primeiro `README.md`, `docs/implementation-status.md`, `docs/cloud-handoff.md` e `docs/continuation-prompt.md`. A instrução mais recente do usuário prevalece. O checkpoint inicial de rostos foi ampliado pelo pedido de cenários, roupas e interface. **Não retomar outras pendências automaticamente** ao apenas inspecionar ou publicar o projeto.

## Regra obrigatória de armas: validar antes e depois de gerar

Pedido do usuário em 17/10/2026. Cada arma é única: ícone, arma na mão, projétil, disparo e impacto próprios em cada fase (+0 a +9, +10 e +11, +12 a +14, +15), marca no cenário, sons próprios e regra POW × Tridente. Contrato em `shared/weaponKit.ts` e `docs/weapon-kit.md`.

1. **Antes de gerar:** `npm run verify:weapons` e usar os prompts de `test-results/weapons/prompts.md` na ordem numerada, anexando as peças anteriores como referência (já trazem tamanho e caminho do arquivo).
2. **Depois de gerar:** rodar de novo; a peça sai do relatório. Mostrar `test-results/weapons/sheet.png` ao usuário.
3. Arma nova só entra com entrada em `WEAPON_KITS`. Chave do ElevenLabs só no `.env` local.

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
| `costume_specialist` | Pinturas, manifesto e animação de fantasias completas; coordenar o slot/protocolo com integração e os ícones com UI |
| `qa_integration` | Persistência/protocolo, navegador, capturas, poses e combinações, revisão das limitações |

O agente `upgrade_server` também implementou fortalecimento/transações na primeira etapa. Os nomes são histórico de responsabilidades, não agentes que continuarão ativos na cloud. Não manter agentes editando após instrução de encerramento.

## Contratos

- Slots: arma, rosto, roupa completa, cabelo, chapéu, óculos, pulseira, bracelete, fantasia, anel ×2 (`ring`/`ring2`, mesma família), colar e bolha. Joias, anéis, colar e bolha são invisíveis no boneco; fantasia unissex substitui o visual completo. Sem bolsa/asas ou olhos/boca separados. Classe (Comum/Normal/Épico/Lendário) só aparece no hover de arma, roupa e chapéu.
- Roupa cobre do pescoço para baixo: mãos, calça e sapatos incluídos. Pose pode variar sem alterar a cabeça universal.
- `ENABLE_MODULAR_APPEARANCE=false` é intencional para corpos incompletos. Rostos estão ativos independentemente desse flag.
- Arte da arma: 0–8 / 9 / 10–11 / 12. Aura automática: 5 / 9 / 12. Pedras I–V sempre comuns.
- Jogo chibi pintado, com volume e contornos consistentes; sem pixel art ou SVG genérico apresentado como arte final. UI arredondada, coesa, com aspecto de jogo.
- Servidor valida intenção, posse, turno e recursos. Cliente não decide dano, chance, saldo, cratera ou sucesso de upgrade. Salvar em transações PostgreSQL.
- Preservar código existente e trabalho de outros agentes. Sem reconstrução desnecessária, reset, force push ou exclusão de diretórios para resolver conflitos.

## Verificação e entrega

Use `npm run check`, `npm test`, `npm run build` e testes de integração pertinentes. Para rostos: `node scripts/verify-faces.mjs` com Vite e inspeção da prancha. Para mapas: `scripts/inspect-maps.mjs` e, nos mapas de peças pintadas, `npm run build:map -- --map=<id>` sem AVISOs (`docs/maps-kit.md`).

Após mudanças em `shared/`/`server/`, confirme o reinício e a saúde do backend antes de testar o navegador; em produção, reconstrua-o. Documente evidências e pendências em `docs/implementation-status.md`; registre prompts e medidas dos assets. Não versionar segredos, `.env`, bancos, builds, `node_modules` ou resultados temporários. Nunca prometer milhares de jogadores a partir de um limite configurado.
