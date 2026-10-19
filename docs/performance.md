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

## Tentado e descartado
- Cortar as pinturas largas em blocos de 4096 px (para GPUs com limite de textura): ficou mais lento; o Chrome já divide sozinho.
- Cópia reduzida das armas na batalha: não ganhou nada e piorou a medição; ficou só a decodificação antecipada.

## Próximo passo possível
- A interface React redesenha a árvore toda a cada mensagem do servidor (`useGame()` devolve o estado inteiro). Seletores por componente reduziriam isso, principalmente na praça cheia.
