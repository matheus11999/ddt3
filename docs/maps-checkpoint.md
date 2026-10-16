# Checkpoint dos cenários — 16/10/2026

O usuário retomou os mapas após o checkpoint facial, rejeitou o acabamento simples e forneceu cinco referências reais do DDTank. A revisão atual usa cenários pintados originais com terreno integrado, silhuetas próprias e cores vivas; não copia sprites do jogo de referência.

## Implementado

- `garden`/Jardim Encantado: árvores monumentais e fonte, ravina aquática, raízes e minerais; destrutível.
- `park`/Parque dos Sonhos: atrações e cidade mecânica, carcaça rubi/ouro e pilares de engrenagens; híbrido, ponte/pilares preservados.
- `celestial`/Fortaleza Celestial: castelos cobalto, contrafortes obsidiana/ouro, abismo e cristais; indestrutível.
- Sete camadas, parallax, ambiente próximo e solo pintados separadamente, atlas de objetos animados, primeiro plano e partículas. Roda/carrossel, nuvens, cercas, estátuas/cristais usam pinturas.
- Terreno mundial registrado na superfície da máscara e recortado por ela. Caixas/barris compartilham máscara visual/física. Remover células remove a arte correspondente.
- Quatro spawns por equipe, para partidas até 4×4: A `[260,395,125,470]`, B `[1276,1141,1411,1066]`. Os dois pontos anteriores e as rampas da ponte foram preservados; os novos pontos são espelhados, apoiados e têm espaço para corpo e movimento inicial. As silhuetas inferiores foram redesenhadas; o mundo continua 1536×864, com células 3px.
- Câmera 1–1,65×, acompanhamento, roda do mouse, botão do meio e controles visíveis com modo de arraste/toque. HUD fica fora do transform.
- Qualidade baixa/média/alta e áudio persistidos em localStorage. Ambiência original procedural: aves/água, música de parque e vento/cristais. Início após gesto, suspensão em aba oculta, descarte ao sair.
- Antialias exclusivamente visual: terreno e máscaras de objetos compostos a 2×, resolvidos uma vez com filtro de alta qualidade e apresentados com interpolação bilinear. Bordas de crateras usam sombra suave, sem os traços opacos por célula que anulavam a suavização. A física mantém as mesmas células de 3px.
- Caches de terreno/props, objetos sólidos e decoração estática agrupados no terreno, margem no recorte da câmera e descarte de objetos fora da vista. Nenhuma animação decorativa gera tráfego.
- Preload dos assets da sala e carregamento completo antes de revelar o cenário. Durante a carga, aparece a prévia do mapa; falhas têm estado de erro. Atualizações de terreno recebidas durante o download são preservadas, sem mostrar a pintura antiga entre assets.

## Contratos

`createTerrain(map)` entrega cópia independente; `terrainTemplate(map)` guarda máscara e regiões em cache. `crater(mask,x,y,radius,map)` remove apenas células destrutíveis conforme resistência, retornando contagem. `terrainMaterial()` informa material/região. Aliases antigos `sky`/`valley` são normalizados pelo servidor.

Projéteis usam colisão contínua de disco contra terreno e personagens, com raios de 6px para Dragão de Brasa, 3px para Tempestade e 9px para Flor de Cristal. Os pontos da trajetória registram o centro do projétil; as coordenadas do impacto registram o contato real com a superfície. Caminhada verifica bloqueios antes de gastar vigor. Impactos são resolvidos em ordem temporal; novas salvas usam a posição do atirador após queda. Cliente nunca decide dano ou modifica terreno remoto.

O servidor transmite material/destrutibilidade/região do impacto e snapshot compacto na conexão, fim da resolução e fim da partida. O cliente conserva relógio e base anteriores ao tiro; aplica impactos vencidos mesmo após pausa longa, e aceita a confirmação autoritativa. A cabeça/vida não recebem dano duplicado após remontar a cena.

Eventos de câmera: `brasa-camera` com `in|out|reset`; `brasa-camera-pan` boolean; `brasa-camera-state` com `{zoom,panning}`. Qualidade: `getEnvironmentQuality/setEnvironmentQuality`; som: `getEnvironmentAudioEnabled/setEnvironmentAudioEnabled`, início/parada em `audio.ts`.

## Verificação

Unitários cobrem spawns, resistência, sólidos, crateras repetidas, regiões intactas, queda, colisão fina, caminhada, salvas, snapshots e retomada de replay. `npm run test:maps:integration` usa Docker/HTTP/WebSocket reais: três mapas, quatro jogadores 2×2, dez projéteis por mapa, reconexão durante/depois da resolução, revanche e permanência no lobby após sair.

Na integração final, os 30 projéteis removeram 6.398 células no Jardim, 361 no Parque e nenhuma na Fortaleza. Células indestrutíveis foram preservadas; tentativas de alteração do terreno pelo cliente foram rejeitadas. O teste de integração de mapas permanece em 2×2, enquanto a definição dos mapas oferece os quatro pontos por equipe necessários ao modo 4×4.

`npm run test:maps:browser` cria partidas pela interface e conecta outro humano por WebSocket; testa nove projéteis/mapa, controles de câmera, Espaço sem tiro acidental, qualidade/som persistidos, recarga e layout 640px. Relatórios e capturas em `test-results/maps/`.

`node scripts/inspect-maps.mjs` validou os três mapas em alta/baixa qualidade e DPR1/DPR2, com crateras e câmera subpixel a 1,45×. Os 12 casos tiveram zero pixels divergentes ao repetir um frame, retornar a câmera e restaurar a qualidade. A reconstrução após impacto ao vivo coincidiu exatamente com um renderer novo; a carga bloqueada/falha também passou, sem exceções JavaScript ou alteração da máscara física.

O harness precisa Vite e mede separadamente submissão Canvas e intervalo RAF, sem leitura de pixels durante o benchmark. No Chromium/SwiftShader desta cloud, DPR1 apresentou mediana de 16,7ms; DPR2 ficou entre 66,6 e 116,7ms. Esses números não representam FPS do jogo completo nem desempenho em aparelhos alvo. Método, filmstrips e limites estão em [Validação visual dos cenários](map-rendering-validation.md). As capturas reais de partidas complementam o harness.

## Limites

Parametrizar física/snapshot/câmera antes de anunciar dimensões arbitrárias. Versionar geometria/protocolo antes de atualizar produção com clientes mistos. Medir carregamento em rede lenta e aparelhos alvo; reduzir arquivos se necessário. A revisão estética do usuário continua sendo distinta dos testes funcionais.

Prompts novos: `world-art-prompts.md` e `scenario-props-prompts.md`; `map-art-prompts.md` guarda a geração anterior. Artes em `public/assets/maps/`; cenários e materiais em `shared/maps.ts`, renderizador em `src/game/environment.ts`.
