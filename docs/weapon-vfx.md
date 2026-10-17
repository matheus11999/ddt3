# Efeitos de armas — 16/10/2026

> **Obsoleto desde 17/10/2026.** As armas foram apagadas para serem refeitas pelo kit de arma (`docs/weapon-kit.md`). O código das famílias de efeito continua; a arte descrita aqui não existe mais.


O renderer usa os quatro atlas existentes em `public/assets/vfx/`, preservando as identidades e os estágios 0–8 / 9 / 10–11 / 12. Nenhuma pintura original foi substituída. As imagens de energia recebem transparência e seis fases de dissolução em cache; partículas e curvas dão movimento entre essas fases.

- **Brasa:** língua de fogo, duas trilhas oscilantes nos estágios altos, brasas e arcos ascendentes.
- **Voltagem:** descargas que mudam de percurso, pequenas bobinas e expansão elétrica irregular.
- **Cristal:** núcleo prismático legível, fragmentos orbitais, geometria refratada e estilhaços que caem.
- **Dinamite:** cartucho girando, pavio aceso, fumaça discreta, faíscas e onda de pressão baixa.

O estado dos efeitos é derivado do tempo e da trajetória recebidos. Não há arrays de partículas por disparo, simulação física local, alteração de dano ou alteração de terreno nestas funções. Destroços usam o material informado pelo impacto. Valores temporais autoritativos continuam em `Projectile.flightTime`, `Shot.startedAt` e eventos de impacto; o renderer não calcula esses contratos.

## Integração

`drawProjectile(c, projectile, index, level, time, options?)` aceita índice fracionário. Interpola somente os pontos vizinhos para desenhar a cabeça do projétil e a trilha, sem copiar a trajetória. `drawImpact` e `drawMuzzle` preservam os argumentos anteriores e aceitam `options` ao final. `options.quality` pode ser `high` ou `low`; `options.reducedMotion` permite uma preferência explícita, além da consulta a `prefers-reduced-motion`.

`drawWeaponEnergy(c, effect, level, time, options?)` desenha luz leve ao redor da origem local. Chamar na transformação da arma equipada, antes da pintura, com uma translação para o centro dela. Níveis inferiores a +9 não emitem essa energia. A função não altera pose, cabeça, hitbox ou equipamento; uma prévia congelada deve continuar usando tempo zero.

`drawHitFeedback(c, hit, age, options?)`, em `hitFeedback.ts`, recebe `ShotHit` do servidor. O renderer respeita `critical`, `kind` e o dano publicado; nunca sorteia crítico nem infere qualidade pelo desenho. Dano normal dura até 900 ms e crítico até `HIT_FEEDBACK_DURATION` (1100 ms), com numeral maior e um estouro translúcido. A idade deve começar no impacto correspondente, e não no início do disparo.

## Limites e evidências

`VFX_LIMITS` limita amostras de trilha, partículas de voo, partículas de impacto e destroços. Qualidade baixa reduz as camadas e os limites. Os glows e as fases de dissolução são calculados uma vez, sem `getImageData` durante o combate. O cache de textos de dano tem no máximo 96 entradas.

`node scripts/verify-weapon-vfx.mjs` com Vite produz pranchas e um vídeo em `test-results/weapon-vfx/`. O teste cobre as quatro famílias em +0/+9/+10/+12, movimento das três fases, interpolação fracionária, preferência por movimento reduzido, expiração, transparência, restauração de estado Canvas, imutabilidade da trajetória e diferenciação de crítico. Também confere orçamento de cache e chamadas de desenho.

Na verificação local, os 16 casos passaram. O cache de superfícies RGBA dos efeitos somou 15.472.512 bytes (cerca de 14,76 MiB; não representa toda a memória do navegador). Máximos observados: 39 operações de desenho por projétil em voo, 81 por impacto em qualidade alta e 37 em baixa. Esses números são por efeito; tiros múltiplos somam seus custos. Não constituem medição de FPS em celulares físicos nem teste de capacidade do servidor.

Pranchas de estágio, dissolução e composição sobre o mapa foram inspecionadas. O vídeo `effects-motion.webm` registra movimento contínuo; os resultados temporários não devem ser versionados.
