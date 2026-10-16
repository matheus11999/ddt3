# Validação visual dos cenários — 16/10/2026

O renderer mantém a máscara autoritativa de células de 3px. A suavização é exclusivamente visual: não arredonda crateras no servidor, não muda materiais, não troca a geometria e não altera os bytes enviados aos clientes.

## Correções verificadas

- Terreno e máscaras de caixas/barris/cristais são compostos com cobertura filtrada a 2×. A resolução final é preparada uma vez na escala nativa da pintura, usando filtro de alta qualidade, e reutilizada ao mover a câmera. A apresentação usa interpolação bilinear sobre esses caches já suavizados; repetir o filtro bicúbico em cada quadro encarecia a rasterização no Chromium por software.
- Foram removidos os traços opacos de 3px desenhados sobre cada célula exposta da cratera: eles sobrescreviam a suavização da borda. A profundidade da fratura vem de sombra suave, recortada pelo terreno restante.
- Objetos sólidos e decoração estática apoiada no chão entram no mesmo cache do terreno. Animações, brilhos, atmosferas e objetos com movimento continuam separados.
- O recorte de desenho inclui uma margem de 8px fora da câmera para que o filtro não amostre a borda móvel do recorte durante deslocamentos fracionários.
- O mapa só aparece após decodificar sua pintura, terreno e atlas necessários. Enquanto isso, aparece a prévia do próprio mapa com estado de carregamento. Uma falha mostra mensagem de erro; o terreno antigo não aparece entre downloads. Atualizações de terreno recebidas durante a carga são preservadas.
- O Scene pode antecipar os downloads com `preloadEnvironment(map)`, e aguardar `renderer.whenReady()` quando necessário. O backing canvas acompanha o tamanho exibido e DPR com limite definido pelo Scene; os cálculos continuam no mundo lógico 1536×864.

## Reprodução

Com Vite na porta 5177 e Chromium do Playwright instalado:

```sh
node scripts/inspect-maps.mjs
npx tsx --test tests/maps.test.ts
```

Nesta cloud, o Chromium é fornecido pelo sistema:

```sh
node --import /workspace/ddt3-cloud/use-system-chromium.mjs scripts/inspect-maps.mjs
```

O harness cobre os três mapas, qualidades alta/baixa, buffers DPR1/DPR2, crateras, câmera a 145% com deslocamentos de 0,23px/0,13px e zoom fracionário, retorno à câmera original, ida e volta da qualidade, carga bloqueada e falha de asset. Também aplica um impacto sobre caixa/barril em um renderer já aberto e exige imagem idêntica à de um renderer novo com a mesma máscara atualizada. Produz `test-results/maps/report.json`, capturas abertas/com zoom/após impacto, filmstrips de seis quadros e imagens de carregamento/erro. Resultados temporários não devem ser versionados.

As comparações determinísticas exigem **zero pixels diferentes** ao desenhar novamente a mesma câmera/tempo/qualidade, ao retornar à câmera e ao restaurar a qualidade. O teste também exige máscara de física inalterada e presença de cobertura alfa intermediária. No teste de carga, o terreno permanece vazio e a prévia idêntica até liberar explicitamente o download.

As medições de tempo usam outro canvas apresentado, sem leitura de pixels por quadro. `drawSubmission` mede o tempo de submeter o desenho; `rafInterval` mede o intervalo observado entre quadros. A validação visual usa leitura de pixels separada, pois essa operação pode forçar rasterização por CPU e não representa o Scene.

## Resultado da execução final

Os 12 casos passaram, com zero pixels diferentes nas três comparações determinísticas e após reconstruir o cache de um impacto em tempo de execução. A carga bloqueada e a falha de asset também passaram, sem exceções JavaScript. `npm run check` e os 10 testes de mapas passaram.

Chromium 154 headless, ANGLE/Vulkan SwiftShader, 30 amostras após seis quadros de aquecimento por caso. Intervalos RAF mediano/p95 em milissegundos:

| Mapa | Qualidade | DPR1 | DPR2 |
| --- | --- | ---: | ---: |
| Jardim | Alta | 16,7 / 16,7 | 66,6 / 66,7 |
| Jardim | Baixa | 16,7 / 16,7 | 66,7 / 83,3 |
| Parque | Alta | 16,7 / 33,3 | 116,7 / 249,9 |
| Parque | Baixa | 16,7 / 16,7 | 66,7 / 66,8 |
| Fortaleza | Alta | 16,7 / 16,8 | 66,7 / 83,3 |
| Fortaleza | Baixa | 16,7 / 16,7 | 66,6 / 66,7 |

O custo mediano de submissão dos desenhos foi de 0,1–0,5ms, mas isso **não** equivale a FPS: a tabela inclui o custo posterior de apresentar os quadros e evidencia o limite de DPR2 neste renderizador por software. O teste força DPR2 também em qualidade baixa para medir a carga; não é recomendação de densidade para máquinas sem GPU.

## Limites concretos

- O ambiente medido usa Chromium headless/ANGLE SwiftShader, sem GPU física. Os números não representam FPS do jogo completo, navegador do jogador ou celular. A API registra o renderizador e as duas métricas separadamente.
- Filtros, máscaras e pintura continuam baseados em pixels. A cobertura suave reduz degraus visíveis, mas não permite prometer ausência absoluta de serrilhado em todo zoom, densidade e navegador.
- A comparação de frames iguais detecta variação indevida de cache, estado e composição. A filmstrip permite inspecionar o movimento; a animação intencional e a mudança de amostragem durante movimento não significam que os pixels devam ficar idênticos entre câmeras diferentes.
- A resolução original da pintura registrada no mundo limita o detalhe disponível ao aproximar. DPR alto melhora a apresentação e os elementos vetoriais, mas não inventa detalhe novo na pintura.
- A preparação dos assets e a recomposição após uma cratera têm custo pontual, separado do custo por quadro. O benchmark de animação não mede latência de rede nem garante ausência de pausas em hardware fraco.

## Spawns para 4×4

Cada mapa preserva os dois pontos anteriores e inclui mais dois por equipe: A `[260,395,125,470]`, B `[1276,1141,1411,1066]`. Os testes verificam espelho em torno de x=768, altura equivalente, pelo menos 72px entre aliados, apoio, espaço para corpo/cabeça e movimento inicial para ambos os lados. Nenhuma superfície foi alterada para acomodá-los.
