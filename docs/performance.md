# Desempenho (19/10/2026)

Análise feita com `scripts/perf-probe.mjs` (Chromium headless, tempo de cada quadro e perfil de CPU). Números de software (sem GPU), servem para comparar antes e depois.

| Cena | Antes | Depois |
|---|---|---|
| Praça parada | ~27 ms por quadro | ~19 ms |
| Praça andando | ~48 ms | ~18 ms |
| Primeiro tiro da batalha | travada de 400–660 ms | máx. ~100 ms |
| Cratera (redesenho do terreno) | ~310 ms por impacto | ~15 ms |

## O que causava queda de FPS
- **Pinturas enormes reduzidas a cada quadro**: céu, ilhas, cidade, árvores, balaustrada e piso da praça (até 9216 px) e os NPCs/pódios (1400×1200) eram reduzidos de novo a cada quadro com filtro de alta qualidade. Agora `src/game/spriteCache.ts` faz uma cópia no tamanho da tela (redimensionada pelo navegador fora da thread principal) e desenha a cópia.
- **Primeiro desenho decodificava a imagem na hora** (a arma de 1254 px travava o primeiro quadro da batalha). Agora a imagem é decodificada antes (`imageReady`/`drawDecoded`) e só então desenhada.
- **Cada cratera repintava o mapa inteiro** (tela de 6144×1728 e um laço por todos os pixels já cavados, que cresce durante a partida). Agora `paintTerrain` refaz só as células afetadas pela cratera (`setTerrain` compara com o terreno anterior).
- **Marcas no chão** redesenhavam a arte de 1254 px de cada marca: agora usam a cópia pequena.
- **Cada imagem de avatar que chegava limpava todos os caches de avatar**; agora uma limpeza por lote (40 ms).
- **Monitores de 120/144 Hz desenhavam o dobro**: o jogo limita a 60 quadros (as animações são feitas para 60).
- **Máquina lenta**: com quadros lentos por ~2,5 s seguidos, a resolução do canvas cai 0,25x (até 1x).
- Monstros da expedição e o dragão só carregam em salas/batalhas que usam.

## Som que não saía
- Os sons das armas usavam um `<audio>` novo por tiro: carregava de novo, atrasava e era bloqueado pelo navegador. Agora tudo toca pelo Web Audio com arquivos já decodificados.
- Os arquivos só começavam a carregar no primeiro som (os primeiros sons saíam como "bip" sintetizado). Agora carregam com a página.
- O áudio só era destravado dentro da batalha; agora qualquer clique/tecla destrava, e ele volta ao voltar para a aba (inclusive o estado `interrupted` do Safari).

## Descarregar a praça na batalha
A praça ocupa mais de 100 MB de imagens decodificadas. Ela é liberada quando a batalha começa (`LobbyWorld.release`) e recarregada na tela de resultado (`load`); ao sair no meio da partida, o último quadro fica parado até a praça estar pronta (no máx. 1,5 s), sem tela vazia. A arte do mapa da batalha é liberada ao sair (`releaseEnvironment`), menos o mapa da sala.

## Trocar de área (20/10)
Pedido do matheus depois de entrar na Pescaria, sair e ir para o PvP com o jogo "super bugado". As pinturas ficam fora da memória do JavaScript, então o coletor de lixo demora a devolvê-las: cada troca de área podia começar com a anterior ainda na memória. Agora cada área devolve o que usava **na hora** (`freeImage`, `freeSurface`, `freeAll`, `forgetCopies` em `src/game/spriteCache.ts`: tira a imagem decodificada, zera canvas e fecha `ImageBitmap`):
- **Praça e Pescaria** (`LobbyWorld.release`, `FishingWorld.release`): pinturas, cópias reduzidas, sombras, piso e blocos assados do jardim. Só a área em que o jogador está fica carregada; na batalha nenhuma das duas. As folhas de andar tingidas (`releaseWalkBodies`) saem na batalha.
- **Batalha** (`releaseBattleArt` em `Scene.tsx`, ao sair): canvases do terreno e das marcas (`EnvironmentRenderer.dispose`, `TerrainResidues.dispose`), pinturas do mapa (`releaseEnvironment`, menos o mapa da sala), atlas das armas (`releaseWeaponEffects`), Enfurecer/Gelo, efeitos do pet, corpos de combate tingidos, marcas no chão, monstros (menos com a sala de expedição aberta) e dragão (menos com a sala do Chefão aberta). O terreno reaproveita o mesmo canvas a cada repintura inteira.
- **Só carrega o que a área usa**: os atlas de todas as armas e o Enfurecer/Gelo eram carregados ao abrir o jogo e ficavam para sempre; agora a tela de carregamento traz só as armas dos lutadores (`battlePreload.ts`). O minimapa usa as mesmas pinturas da batalha (antes decodificava o fundo e o terreno de novo) e o portão de imagens (`screenAssets.ts`) não guarda mais cada fundo de CSS já visto.
- Servidor: sair da Pescaria desliga também o automático (antes o HUD voltava em manual e o servidor seguia no automático).

Medição com `npx tsx scripts/probe-area-memory.mjs` (memória de pixels ainda presa, MB; jogo rodando): praça 454 → 382 (superfícies vivas 1032 → 122); batalha 366 → 249; praça depois da batalha 509 → 388 (a batalha não deixa mais 60 MB para trás).

## Pescaria com muitos jogadores (20/10)
Pedido do matheus ("desempenho baixo na pescaria, esse cenário terá vários players"). Medido com `npx tsx scripts/perf-fishing.mjs` (bots andando e pescando no automático, um navegador na Pescaria):
- **Cabelo, chapéu e óculos** eram desenhados a partir do recorte inteiro (centenas de px) reduzido a poucas dezenas a cada quadro, para cada cabeça na tela. Agora `drawPinned` (`src/game/rig/draw.ts`) usa a cópia no tamanho da tela (`scaledCopy`), e o chapéu sem cor também usa o recorte em cache. JS por quadro com 20 jogadores: 15,6 ms → 2,2 ms (50 jogadores: 3,1 ms). Vale também para a praça e as prévias.
- **Rede**: o servidor mandava a lista inteira de jogadores (com roupas) para todos a cada 100 ms, o que cresce com o quadrado dos jogadores. Agora o passo de andar manda só `lobby-moves` (posição e pose de pesca de quem mudou); a lista completa (`lobby`) só sai quando alguém entra, sai ou troca de roupa. Com 20 jogadores: 168 KB/s → 13 KB/s por jogador; com 50, 35 KB/s. Canal continua com até 60 jogadores.

## Tentado e descartado
- Cortar as pinturas largas em blocos de 4096 px (para GPUs com limite de textura): ficou mais lento; o Chrome já divide sozinho.
- Cópia reduzida das armas na batalha: não ganhou nada e piorou a medição; ficou só a decodificação antecipada.

## Próximo passo possível
- A interface React redesenha a árvore toda a cada mensagem do servidor (`useGame()` devolve o estado inteiro). Seletores por componente reduziriam isso, principalmente na praça cheia.
