# Checkpoint dos cenários

O usuário redirecionou a etapa para concluir apenas os rostos. O trabalho de cenários já integrado foi preservado neste checkpoint, com o estado real abaixo; ele ainda não representa acabamento final aprovado.

## Implementado

- Três definições em `shared/maps.ts`: `garden` (Jardim Encantado), `park` (Parque dos Sonhos) e `celestial` (Fortaleza Celestial). `sky` e `valley` continuam como aliases de leitura, normalizados pelo servidor.
- Sete camadas independentes: céu, paisagem distante, ambiente próximo, terreno físico, objetos, primeiro plano e partículas. A camada artística principal e a textura do terreno são arquivos originais separados.
- Jardim destrutível; Parque híbrido com ponte metálica e pilares intactos; Fortaleza inteiramente indestrutível. Terra, areia, pedra, gelo, metal e material mágico têm definições de resistência. Os mapas iniciais usam terra, areia, pedra, metal e magia; gelo está disponível na configuração.
- Caixas e barris sólidos e destrutíveis. A arte desses objetos usa a mesma máscara de células da colisão, evitando arte intacta sobre um objeto removido.
- Roda-gigante, carrossel, balões, bandeirolas, água, borboletas, pétalas, cristais e nuvens possuem animação local conforme o mapa. Esses efeitos não geram tráfego de rede.
- Spawns espelhados para 1×1 e 2×2; rampas de acesso à ponte do Parque.
- Câmera com zoom de 1× a 1,65×, acompanhamento do jogador/projétil, roda do mouse e deslocamento com botão do meio. Evento `brasa-camera`, `CustomEvent.detail` igual a `in`, `out` ou `reset`, permite controles externos. HUD permanece fora da transformação do mundo.
- Qualidade `low`, `medium` e `high`, por `getEnvironmentQuality()` / `setEnvironmentQuality()` em `src/game/environment.ts`, persistida em `brasa-environment-quality`. Ela muda quantidades de elementos cosméticos e brilho, nunca física.

## Contratos

`createTerrain(map)` cria uma cópia independente. `terrainTemplate(map)` mantém uma máscara original e índices de regiões determinísticos em cache. Polígonos usam conversão por linha; os três mapas inicializaram em cerca de 20 ms no teste local.

`crater(mask, x, y, radius, map)` remove apenas células destrutíveis e aplica resistência do material. Todos os chamadores de combate servidor/cliente passam o mapa. O valor de retorno é a quantidade de células removidas. `terrainMaterial(map,x,y)` informa material, região e destrutibilidade.

O servidor transmite `impact.material`, `impact.destructible` e `impact.region`. O cliente reproduz o evento sobre a máscara inicial; reconexão recebe a máscara autoritativa compactada. A API não aceita alterações de terreno vindas dos clientes.

## Verificado

`npx tsx --test tests/maps.test.ts tests/physics.test.ts`: 13 testes aprovados. Cobrem três mapas, spawns apoiados, crateras repetidas, queda pela remoção de apoio, resistência, objetos sólidos, regiões indestrutíveis, eventos idênticos para dois clientes, replay local igual ao estado servidor, snapshot de reconexão e encerramento.

`node scripts/inspect-maps.mjs`: renderizador real em Edge headless, os três mapas em 1×, 1,45× e após impactos, sem erros JavaScript. Capturas e relatório em `test-results/maps/`. A contagem de células da Fortaleza permaneceu 21.989 antes/depois; Jardim e Parque perderam somente células permitidas. Tempos de comandos Canvas no ensaio ficaram com mediana de 0,3–0,4 ms e p95 de 0,7–1 ms; isso **não mede FPS completo nem desempenho em celulares**.

As capturas foram inspecionadas. A arte principal possui detalhe, mas alguns elementos vetoriais animados ainda destoam do acabamento das ilustrações. A validação visual foi feita num harness isolado do renderizador, não numa sessão Docker publicada dos três mapas.

## Pendências para retomar

1. Harmonizar o acabamento dos objetos animados — especialmente carrossel, roda-gigante, estátuas, cercas, flores e nuvens — com as ilustrações geradas. Melhorar transição entre cenário próximo e bordas/parte inferior das ilhas.
2. Validar os três mapas em partidas reais pelo Docker, incluindo UI de criação, zoom/controle de qualidade, 2×2, múltiplos projéteis e reconexão durante a resolução. Os testes atuais de multiplayer executam a classe autoritativa do jogo em memória.
3. Produzir áudio ambiental por tema: a configuração de áudio existe, mas ainda não há reprodução de ambiência específica por mapa. Sons atuais de arma/impacto continuam funcionando.
4. Revisar desempenho no dispositivo alvo, carregamento em rede lenta, cache/compactação de assets e descarte de objetos fora da câmera. Hoje existem poucos objetos e as texturas ficam em cache, mas não foi implementada uma política geral de culling.
5. Ampliar a variação de tamanho de mapa: a definição declara dimensões, mas a física atual continua em 1536×864 e células de 3 px. Não anunciar arenas arbitrariamente grandes antes de parametrizar snapshot/física/câmera.
6. Versionar as definições de geometria no protocolo antes de atualizações de produção com clientes de versões diferentes.

As artes e os prompts exatos estão em `docs/map-art-prompts.md`; foi usada a ferramenta integrada `image_gen`, sem CLI externo. Todos os seis PNGs finais estão em `public/assets/maps/`.
