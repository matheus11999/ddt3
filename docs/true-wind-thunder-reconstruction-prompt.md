# Reconstrução de Verdadeiro Vento de Deus e Verdadeiro Trovão

Prompt completo para implementar duas armas novas no Brasa a partir das referências DDTank4.1 reunidas em `D:/APPS/ddt/output/true-wind-thunder-reference/`. O pedido correto é **Verdadeiro Vento de Deus7008 e Verdadeiro Trovão7009**. Raio Laser, famílias Super e o Vento de Deus normal7105 não fazem parte desta implementação.

Copie o texto a seguir para a IA implementadora e disponibilize o pacote ZIP junto do repositório.

---

Implemente duas armas novas no jogo existente em `D:/APPS/ddt`, reconstruindo os atributos, identidade visual, evolução, disparos, POW, som e destruição das referências **Verdadeiro Vento de Deus** e **Verdadeiro Trovão**. Use as fontes e assets de pesquisa abaixo para criar arte e áudio originais semelhantes, no estilo aprovado do Brasa. Não substitua as armas existentes nem integre a família Laser ou Super por engano.

## 1. Contexto e leitura obrigatória

Leia primeiro `AGENTS.md`, `README.md`, `docs/implementation-status.md`, `docs/cloud-handoff.md`, `docs/continuation-prompt.md`, `docs/weapon-kit.md`, `docs/attributes.md`, `docs/ballistics.md`, `docs/combat-stats.md`, `docs/power-ups.md`, `docs/hitbox-aim.md` e `docs/prone-combat.md`. Leia as versões atuais no checkout; os documentos em `context/` do pacote são retratos para consulta, não autorização para restaurar código antigo.

O jogo já contém balística com força×20, passo40ms, vento e arrasto; hitbox retangular universal dos jogadores; origem compartilhada de tiro; limites de mira com inclinação; Delay dos power-ups ajustado; Tridente manual com ±5°; destruição por perfis; marcas persistentes recortadas ao terreno; rig deitado; sons e sistema de POW. Reaproveite esses sistemas.

Inspecione especialmente:

```text
shared/catalog.ts             catálogo, Weapon, attributes, weaponStats
shared/stats.ts               fortalecimento e atributos derivados
shared/weaponKit.ts           WEAPON_KITS, arte, sons, regra POW×Tridente
shared/physics.ts             ballMotion, volley, contato, hitbox, craterMask
shared/aim.ts                 limites e inclinação da mira
shared/combat.ts              exposição e dano
shared/power.ts               defaults globais de POW
shared/powerUps.ts            ferramentas, salvas e leque
shared/destruction.ts         perfis de recorte e marca por fase/modo
shared/terrainMarks.ts        histórico das marcas
shared/protocol.ts            metadados autoritativos do tiro/impacto
server/game.ts                planejar e aplicar tiros/impactos
src/game/weaponEffects.ts     projétil, disparo, impacto, POW
src/game/weaponSounds.ts      resolução de áudio por arma
src/game/audio.ts             preload, cache, mute e reprodução
src/game/terrainResidues.ts   composição persistente das marcas
src/game/Scene.tsx            apresentação da batalha
src/game/avatar.ts            arma e pose no rig
```

Os nomes podem ter mudado. Rastreie as chamadas reais antes de editar. Preservar a personalização, loja, ferreiro, matchmaking, pets, invisibilidade por destinatário e persistência de recursos.

## 2. Referências locais e como abri-las

Use como raiz de referências:

```text
REF = D:/APPS/ddt/output/true-wind-thunder-reference/

REF/PROMPT.md                        cópia deste prompt
REF/LEIA-ME.md                       índice, escopo e lacunas
REF/weapon-data.json                 templates completos, munições e evoluções
REF/manifest.json                    inventário e hashes do pacote
REF/weapons-overview.png             fases e atributos das duas armas
REF/terrain-overview.png             máscaras, bordas e composição ilustrativa
REF/terrain-measurements.json         medidas do alfa dos PNGs originais
REF/research/physics-rules.md          regras e comparação com o Brasa
REF/research/physics-evidence.json     trechos C#/AS3, números e hashes
REF/research/source-index.json        caminhos das cópias portáteis das fontes
REF/research/source/DDTank4.1/         fontes originais relevantes copiadas
REF/sources/client/                  fontes do cliente e Tile.Dig

REF/vento-de-deus/weapons/            dart, dart2, dart3, dart6 e extra dart4
REF/vento-de-deus/terrain/121/         crater.png e craterBrink.png normal
REF/vento-de-deus/terrain/131/         crater.png e craterBrink.png POW
REF/trovao/weapons/                  electricbar,2,3,6 e extra4
REF/trovao/terrain/141/               crater.png e craterBrink.png normal
REF/trovao/terrain/151/               crater.png e craterBrink.png POW

REF/vfx/                            exportação de efeitos e áudio
REF/vfx/LEIA-ME.md                   índice detalhado dos efeitos, quando presente
REF/vfx/manifest.json                ligações entre tabelas e arquivos
REF/vfx/identity-vfx.png             normal e POW das duas identidades
REF/vfx/stages-projectiles.png       variantes dos projéteis por evolução
REF/vfx/role-previews/<pic>/         quadros nomeados por modo e papel para abrir rápido
REF/vfx/swfs/                       SWFs de origem preservados
REF/vfx/timelines/                   PNGs por quadro e APNGs extraídos
REF/vfx/timelines/timeline-inventory.json  fps, bounds, pivôs, labels e filhos
REF/vfx/particles/                  formas e configuração procedural dos rastros
REF/vfx/audio/wav/                  sons originais decodificados
REF/vfx/audio/mp3/                  cópias convertidas para escuta
```

Se estiver em outro computador, extraia o ZIP e ajuste apenas a raiz REF. A reconstrução não deve depender de `C:/Users/Alienware/Desktop/...`; as fontes relevantes foram copiadas para dentro do pacote e são encontradas pelo índice.

Abra de fato as pranchas, os PNGs das armas, sequências/APNGs e os sons. Não deduza a aparência apenas pelos IDs. Em cada pasta de arma há `icon.png`, `show.png`, `game-front-atlas.png` e `game-back-atlas.png`. A camada frontal pode ser totalmente transparente de propósito; a pintura da arma está na outra camada. O PNG250×312 de prévia inclui margens de encaixe. Os atlas de combate não são uma imagem única para aplicar inteira no avatar.

As tabelas são de uma cópia privada local4.1; os assets recuperados pelo CDN podem pertencer a outra revisão. O pacote registra cada origem e mantém as divergências explícitas. Não afirmar execução do DDTank oficial nem equivalência pixel a pixel onde a evidência não permite.

## 3. Atributos e evolução exatos

Valores abaixo são a contribuição **da arma**, antes da soma com personagem, roupas, joias, composição e pets. Não são os atributos totais do jogador.

| Arma | Fase | Template de referência | Pic | Ataque | Defesa | Agilidade | Sorte |
|---|---|---:|---|---:|---:|---:|---:|
| Vento |+0–9|7008|dart|60|30|250|40|
| Vento |+10–11|70081|dart2|72|36|300|48|
| Vento |+12–14|70082|dart3|93|46|390|62|
| Vento |+15|70084|dart6|111|55|488|77|
| Trovão |+0–9|7009|electricbar|30|40|60|250|
| Trovão |+10–11|70091|electricbar2|36|48|72|300|
| Trovão |+12–14|70092|electricbar3|46|62|93|390|
| Trovão |+15|70094|electricbar6|55|77|111|488|

Para ambas: dano-base `Property7=200`, `Property8=0`, nível mínimo1 e compatibilidade unissex. A referência tem `Quality=4`; não confundir esse enum original com uma raridade numérica do Brasa. Traduzir a classificação de apresentação conforme o catálogo atual, registrando a correspondência. Não inventar Armadura de arma a partir de Property8.

Limites de grau relativos ao apoio: **Vento15–50°; Trovão25–60°**. Adicionar a inclinação apenas pela transformação compartilhada já existente.

Vento deve ser reconhecido pela Agilidade alta; Trovão, pela Sorte alta. Agilidade afeta atributos derivados e ordem de turnos, não autoriza acelerar projéteis ou dar turnos extras por sorteio. Sorte usa as fórmulas atuais de crítico e mitigação; não significa crítico garantido.

Implemente bases por fase ou override equivalente somente nestas duas armas. `weaponMilestoneValue` atual ganha em +10 e +12, mas estaciona em +12: ele sozinho não reproduz a linha +15 acima. Não aplique o multiplicador de marco sobre valores que já vieram da tabela evoluída. Todos os consumidores — tooltip, perfil, loja, mochila, ferreiro e combate — devem ler a mesma função.

O Dano200 fortalece uma única vez pela regra existente: `round(200 × 1.1^nível)`. Exemplos: +0=200, +10=519, +12=628, +15=835. Composição entra depois, segundo o contrato vigente. Não multiplique o dano novamente ao trocar a aparência ou template da fase.

Fases visuais confirmadas: +0–9, +10–11, +12–14, +15. `dart4/70083` e `electricbar4/70093` são extras preservados para referência; a tabela examinada não os seleciona como +15. O +15 correto é sufixo6. Não converter para Super em+9 e não usar os atributos das famílias7017/7018.

`Property8=0` é somente a parcela da arma no Delay do tiro. Na fonte, soma-se também `CurrentBall.Delay`, que vem de dados do servidor; não deduzir Delay total zero apenas pelo XML de equipamento. Os valores de Ball.Delay/HasTunnel não foram encontrados nos exports textuais, e os backups de banco não foram restaurados. Para viabilizar a integração, adote provisoriamente `shotDelay:150`, como nas armas atuais, com anotação explícita de adaptação do Brasa; não apresente150 como valor comprovado destas duas armas no DDTank. Não inferir HasTunnel pelo nome Crater nem usar null como motivo para desativar a destruição prevista nesta reconstrução.

## 4. Identidade e apresentação

**Vento:** arma de arremesso em forma de shuriken de três lâminas curvas; fases alteram metal, recorte das lâminas, núcleo e ornamentos. Use as quatro referências corretas. No código original o ActionType efetivo é0, com SHOWTHROWS/THROWS/HIDETHROWS.

**Trovão:** dispositivo elétrico portátil com dois terminais e bobina, que evolui de peça simples para uma arma elétrica mais trabalhada. ActionType1, com SHOWGUN/SHOT/HIDEGUN. No Brasa, adaptar o contrato de arma segurada (`hold:'hand'` ou equivalente atual), reaproveitando o rig e mantendo o visual deitado universal.

Preservar `SHOT_ORIGIN`, a hitbox universal e o apoio físico do personagem. A arte e o flash do cano se alinham à origem comum; não mova o collider ou a origem física separadamente a cada roupa ou estágio para acomodar o PNG. Prévia de mochila/loja continua estática; arma continua ausente dos bonecos do lobby.

Crie IDs próprios estáveis, por exemplo `wind-shuriken` e `thunder-coil`, e nomes de produção originais coerentes com AGENTS.md. Mantenha os nomes/IDs DDTank nos metadados de referência. Não renomeie uma arma atual para ocupar o lugar da nova nem conceda itens automaticamente por migração ou por experimentar no provador.

## 5. Física comum e colisão

Todos os41 registros de munição auditados compartilham:

```text
Mass=10
Weight=70
Wind=240
DragIndex=1

Mapa comum: Weight=10, DragIndex=2
dt=0.04s
ax = 24 × vento − 0.2 × vx
ay = 700 − 0.2 × vy
vx += ax × dt
vy += ay × dt
x  += vx × dt
y  += vy × dt
```

Força0–100 do Brasa corresponde a0–2000 na decomposição original. Use `ballMotion` e `volley` atuais, com seus estados float32, contato varrido e relógio autoritativo. Não crie outra gravidade para a shuriken nem torne Trovão um raio instantâneo/hitscan. A aparência elétrica não acrescenta corrente entre alvos, atordoamento, perfuração ou guiamento automático: esses efeitos não foram comprovados como propriedades destas armas.

No C#, a bomba tem retângulo6×6 centrado no ponto físico; o Player tem30×30. São independentes da pintura. O Brasa já usa varredura contínua de disco contra a caixa universal. Para integrar sem regressão global, usar raio técnico3 nas novas munições como aproximação coerente da meia largura original, sem aumentar o raio por causa de brilho ou da evolução. Registre que disco de raio3 e quadrado6×6 diferem nas quinas. Não substitua a física de todas as armas para esconder essa diferença.

Manter a hitbox atual do Brasa, inclusive `fighterHitBounds`, a conversão entre pés e origem lógica, os testes de saída do próprio lançador/sobreposição, os tamanhos especiais de monstros e a separação entre centro da bala e superfície tocada. Primeiro contato com terreno/entidade deve vencer; nada de atravessar parede para atingir alvo. Morte remove alvo físico, invisibilidade não. Não transmitir dados ocultos para resolver visualização de uma nova arma.

Não são a mesma medida:

1. Caixa/raio físico do projétil, que decide contato.
2. `Radii` de dano:55 normal e65 POW.
3. Máscara de terreno escolhida por Crater.
4. Tamanho da animação e do brilho.

A cópia privada tem lacunas em `Config.CanCollied` e `m_demageRect`, descritas na pesquisa. Preserve a colisão autoritativa funcional do Brasa; não copie atravessamento acidental nem dano zero por retângulo sem inicialização.

## 6. Perfis normal e POW por arma

| Arma/modo | Projéteis físicos por salva | Fator de dano por projétil | Radii de referência |
|---|---:|---:|---:|
| Vento normal |1|1.0|55|
| Vento POW |1|1.5|65|
| Trovão normal |1|1.0|55|
| Trovão POW |3|0.6|65|

O POW do Vento pode desenhar um agrupamento de três shurikens, como o sprite131, mas **é um projétil físico**, um contato e uma cratera. Não transforme os três desenhos em três entidades de dano.

O POW do Trovão tem **três entidades físicas**, cada uma com trajetória, primeiro contato, tempo de impacto, cratera, consulta de dano e crítico próprios. A soma nominal é1.8× se os três acertarem em condições equivalentes, antes das demais regras.

Implemente perfil de disparo por arma e modo com quantidade, fator, área e recorte explícitos. Não deixe os defaults globais de POW1.65 de dano,1.15 de blast e1.05 de cratera sobreporem estes perfis. Os defaults continuam valendo onde já valiam para as armas existentes.

Não resolver o POW do Trovão simplesmente injetando a ferramenta Tridente: ela traz fator0.5. `.6×.5×1.65` ou `.5×1.65` não representam o POW original. Se aproveitar o rótulo `pow-tridente`, adapte a implementação para que o leque intrínseco não receba uma segunda penalidade de ferramenta.

Em ambas as armas, POW e ferramenta Tridente são exclusivos nas duas ordens de seleção. **+1 e +2 continuam permitidos com POW**, sujeitos aos custos e limites atuais. Não escolher `pow-unico` para o Vento se essa regra bloquear +1/+2 por acidente.

Exemplos sem crítico, mitigação ou queda por distância:

```text
Vento POW simples:       1 projétil × 1.5
Vento POW +1:            2 salvas × 1 projétil × (1.5 × .9)
Vento POW +2:            3 salvas × 1 projétil × (1.5 × .6)
Trovão POW simples:      1 salva × 3 projéteis × .6
Trovão POW +1:           2 salvas × 3 projéteis × (.6 × .9)
Trovão POW +2:           3 salvas × 3 projéteis × (.6 × .6)
```

Somar bônus percentuais pela regra atual, sem introduzir a dependência de ordem Tridente/percentual encontrada na fonte privada. Preservar custos, Delay, cadência de salvas e carga Power atuais; a tarefa reconstrói estas duas armas, não refaz globalmente a barra de carga ou o balanceamento das ferramentas.

### Leque intrínseco do POW do Trovão

Na fonte original, os três vetores usam `(desvio, multiplicador de força)` iguais a `(0°,1)`, `(−5°,0.9)` e `(+5°,1.1)`. Reproduzir isso **no perfil intrínseco do POW desta arma**, separando multiplicador de força de multiplicador de dano. Pode ordenar o array como[-5,0,+5] para preservar convenções atuais, desde que mantenha a associação0.9/1/1.1 e a identificação do projétil central.

O Tridente manual do Brasa já foi ajustado para±5° com a mesma força nos três por pedido anterior. Preserve essa regra geral; não a altere silenciosamente ao acrescentar o leque próprio do POW do Trovão. Pets que usam o ponto do projétil central precisam continuar recebendo um ponto consistente, sem duplicar o ataque por causa do leque.

### Área de dano e queda por distância

Preserve `Radii55/65` como dados de referência separados. O Brasa atual transforma `blast` em raio efetivo com fator0.60 e usa sua própria curva de splash, distinta da consulta e atenuação da fonte privada. Não atribua `blast=55` e afirme que isso produziu alcance55: daria33 nessa rotina.

Para estas novas armas, use um raio efetivo explícito normal55/POW65 na infraestrutura atual, mantendo a curva de exposição e o contrato de distância do Brasa. Isso pode ser um override de raio no perfil ou adaptação equivalente aplicada uma única vez. Não alterar a curva, os raios ou o dano das armas existentes. Registre que manter a curva/distância do Brasa é uma adaptação, pois a fonte privada tem a inconsistência de retângulos já documentada. `Power1.5/.6` entra uma vez além de exposição, mitigação, ferramentas e crítico.

## 7. Munições e vínculos dos assets

O vínculo confiável é `Template → bombconfig → BallList → símbolos/arquivos`. Use `weapon-data.json` e o manifesto VFX, não sufixos de arquivos isolados.

| Família/fase | Common | AddWound | MultiBall | Special/POW |
|---|---:|---:|---:|---:|
| Vento0 |121|1212|1211|131|
| Vento10 |122|1222|1221|132|
| Vento12 |123|1232|1231|133|
| Vento15 |126|1262|1261|136|
| Trovão0 |141|1412|1411|151|
| Trovão10 |142|1422|1421|152|
| Trovão12 |143|1432|1431|153|
| Trovão15 |146|1462|1461|157|

Os extras124/134 e144/154, com seus submodos, também foram preservados para inspeção, sem virarem uma quinta fase jogável.

`CommonMultiBall` não significa automaticamente “a ferramenta Tridente física”. O ramo C# correspondente exige `BallCount==1`, `!IsSpecialSkill` e `Prop==20002`; o Tridente real usa três em BallCount. `CommonAddWound` exige outro marcador legado20008. Esses templates legados não apareceram no catálogo examinado. Preserve os assets e modos como referência; não invente botões ou gatilhos de combate só pelo nome. A implementação básica tem de funcionar com Common/Special e as ferramentas atuais, sem depender desses ramos incertos.

`bombconfig.xml` servido ao cliente não contém SpecialII; o export alternativo `_out` contém. No Vento,891 aparece nessa coluna, mas não foi encontrado gatilho de combate ativo para ela. Inclua esse material na referência, sem atribuir uma habilidade nova, chance aleatória ou evolução obrigatória ao891. Trovão usa Special normal como modo principal comprovado.

Nas origens Flash, o nome da pasta pode enganar: os SWFs `blastOut<ID>` normalmente contêm `bullet<ID>` e `shootMovie<ID>`, enquanto `bullet<BombPartical>` contém `blastOutMovie<ID>`. O inventário exportado confirma os símbolos. Use os papéis identificados no manifesto.

## 8. Destruição e marca persistente

| Arma/modo | Crater | Arquivo da máscara | Arquivo da marca | Área alfa≥128 da máscara |
|---|---:|---|---|---:|
| Vento normal |121|142×116|160×160|6003 pixels|
| Vento POW |131|162×132|160×160|7559 pixels|
| Trovão normal |141|142×116|160×160|6640 pixels|
| Trovão POW |151|128×96|128×128|4696 pixels|

São medidas dos PNGs do cliente, não raio de dano nem prova da máscara binária `.bomb` do servidor. Limites alfa completos, centros e caixas ocupadas estão em `terrain-measurements.json`. Os recortes opacos medidos a128 são, respectivamente,107×72,117×83,103×84 e92×68.

O Trovão POW tem três impactos, cada um com recorte151 **menor** que o141 normal. Não usar “normal ampliado em5%” como substituto. As quatro fases de cada arma compartilham os IDs de recorte dentro de normal/POW; aumentar o fortalecimento não aumenta automaticamente o buraco.

Crie quatro perfis de máscara técnica coerentes com estas silhuetas e proporções: vento normal/POW e trovão normal/POW. Reutilize o sistema determinístico de `shared/destruction.ts` e `craterMask`; estenda o contrato de formas onde necessário. Não aponte todas para `oval` ou `brick` apenas para passar na tipagem. Nenhum PNG deve decidir física em tempo de renderização: compilar a geometria/dados do recorte no build ou em cache compartilhado e versionado, igual para cliente e servidor. Documente o limiar e arredondamento adotados.

A unidade de balística é1:1 no projeto; use escala física explícita e inicialmente1 para a referência do cliente ao calibrar estas novas máscaras. Não normalize o PNG inteiro para um raio sem levar em conta suas margens transparentes. Preserve a origem do bitmap completo (`width/2,height/2`), em vez de recentrar pelo bounding box do alfa. Se a composição do Brasa exigir uma escala diferente, registre o fator único e mostre medidas comparativas; não o esconda em offsets por fase.

**Os arquivos `.bomb` exatos não foram encontrados na árvore original.** Não inventar sua existência nem dizer que o alfa128 é o algoritmo original do servidor. A geometria nova deve ser uma reconstrução técnica declarada a partir da referência visual medida e das regras disponíveis.

A marca no chão usa `craterBrink`, separada da explosão. A referência do Vento tem cortes/rachaduras direcionais finas ao redor de uma oval; a do Trovão tem queimadura escura e ramificações irregulares. O centro colorido da imagem original é removido pelo recorte do terreno: não pintar uma tampa azul/laranja dentro do buraco.

Sequência a preservar no sistema atual:

1. Aplicar recorte físico autoritativo no impacto.
2. Apagar da composição visual também a marca antiga onde o novo tiro tirou chão.
3. Recortar a nova marca pelo solo destrutível restante.
4. Compor a nova marca na ordem dos impactos, sem recolorir o vazio.
5. Manter histórico e reconstrução idênticos em reconexão/carregamento tardio.

Máscara e marca podem ter tamanhos diferentes, mas compartilham o centro de impacto. Não girar aleatoriamente pelo ângulo de voo. Conserve a adaptação atual de acerto direto sob os pés a75% e a restrição de chão indestrutível, aplicada uma vez; não mude isso globalmente para acomodar novas pinturas.

Crie marcas originais por fase e normal/POW conforme o contrato vigente: degradê escuro que se dissolve para fora, rachaduras finas/ramificadas, falhas transparentes e terreno legível. Não gerar molduras sólidas, ornamentos, peças de arma ou pedestal ao redor da cratera. Use os templates técnicos da destruição e as novas armas aprovadas como anexos da geração.

## 9. VFX e som

Vento normal lança a shuriken; POW tem a composição própria agrupada, maior e distinta. Trovão normal usa energia branco/azulada; POW tem energia rosada/violeta e explosão elétrica própria. As quatro fases devem manter a identidade e evoluir conforme os frames extraídos. Faíscas, destroços e rastros são visuais, sem novas entidades de dano.

Respeite fps, limites de imagem e pivôs do `timeline-inventory.json`. Muitos `shootMovie` têm um frame externo, mas dezenas de frames nos filhos. Use as sequências expandidas/APNGs, não apenas o primeiro frame. Arquivos `frames.png` em `apng/` são PNGs animados. Pivôs podem estar fora do retângulo recortado; não girar automaticamente pelo centro do PNG.

Vento tem `SpinV180`, `SpinVA1` nos modos normal/POW; AddWound usa60 e MultiBall0. Trovão tem0. O cliente gira o movie interno por `_spinV` a cada atualização e orienta o contêiner pela velocidade, apesar do campo IsSpinfalse. Não interpretar180 automaticamente como graus por segundo: leia `SimpleBomb.updatePosition`, cujo relógio avança40ms. Reproduzir o efeito no tempo de apresentação sem fazê-lo depender do FPS de desenho ou mudar o collider.

Os rastros são emissores procedurais. As formas exportadas em `particles/` são componentes, não o efeito inteiro. Ler `selected-emitters.xml`, o índice de shapes e as fontes de runtime para vida, intervalo, alfa, escala, rotação, orientação e blend. `displayCreator` é índice baseado em zero na biblioteca: não confundir o número do índice com o nome ParticalShap. A outra IA não precisa executar Flash para ler esses contratos.

Sons normais e POW:

| Arma/modo | Disparo | Impacto |
|---|---|---|
| Vento normal |Sound029|Sound089|
| Vento POW |Sound079|Sound090|
| Trovão normal |Sound035|Sound091|
| Trovão POW |Sound081|Sound092|

Oito WAVs estão em `REF/vfx/audio/wav/` e as versões de escuta em `mp3/`. Os nomes incluem o characterID do SWF, por exemplo `110_Sound029.wav`; a parte Sound029 identifica o vínculo. Use o índice para localizar cada arquivo, sem tratar characterID como número de habilidade.

Escute os oito efeitos e produza sons originais semelhantes, compatíveis com AGENTS.md. Integre em `public/assets/audio/weapons/<id>/` e registre `sounds`/`powSounds` no kit. Não usar áudio genérico do tijolo para o Trovão. Não inventar um loop original de voo ou de quebra de terreno que não foi encontrado: esses slots podem receber criação original explicitamente identificada como nova.

Reaproveite preload, cache, volume e mute; disparo toca no lançamento da salva, impacto no tempo autoritativo de cada contato. Não tocar durante preload, snapshot ou replay de reconexão. Controlar vozes simultâneas para três projéteis sem eliminar impactos distintos.

## 10. Produção de arte e arquivos finais

Antes de gerar qualquer peça, execute `npm run verify:weapons`, leia o relatório e siga os prompts numerados de `test-results/weapons/prompts.md` com as referências anexadas. Cadastre ambas em `WEAPONS` e `WEAPON_KITS`, com conceitos, identidades, quatro fases, regras, efeitos e sons, conforme a arquitetura atual. Não basta copiar um PNG para uma pasta e deixar a arma fora dos contratos.

Use a ferramenta de geração de imagens disponível. Anexe as fases corretas, projéteis/impactos, marca do modo e as âncoras de estilo aprovadas que o validador pedir. As cópias do DDTank ficam como referência em `output/`; não instalar seus pixels diretamente em `public/assets`. Gere desenhos originais próximos da referência em linguagem, volume, proporção, legibilidade e progressão. Cada arma tem identidade própria e arma/projétil coerentes; não fazer troca de cor do Quebra-Tijolos ou do Bumerangue.

Saídas mínimas, seguindo os tamanhos atuais do contrato:

```text
public/assets/weapons/<id>/icon-{0,10,12,15}.png     512×512
public/assets/weapons/<id>/held-{0,10,12,15}.png     1254×1254
public/assets/weapons/<id>/effects.png               atlas normal/disparo/impacto
public/assets/weapons/<id>/pow.png                   atlas projétil/impacto POW
public/assets/weapons/<id>/terrain.png               fallback, se ainda exigido
public/assets/weapons/<id>/destruction/normal/mark-{fase}.png
public/assets/weapons/<id>/destruction/pow/mark-{fase}.png
public/assets/audio/weapons/<id>/{fire,flight,impact,terrain}.mp3
public/assets/audio/weapons/<id>/...                 variantes POW conforme contrato
```

Se a nova apresentação precisar de animação por frames além dos atlas estáticos atuais, acrescente um contrato pequeno de animação com fps, frame count, pivô, bounds e papel; mantenha o fallback dos kits existentes. Não carregar milhares de PNGs de pesquisa em produção. Produza/empacote apenas os frames originais novos necessários, com cache e orçamento para celular.

A pose do Trovão deve parecer disparo de dispositivo segurado, e a do Vento, arremesso. As mãos e a cabeça continuam no padrão universal. Não gerar personagem inteiro dentro dos assets de arma. Corpo, fantasia e equipamento subjacente não mudam por equipar a arma.

Após gerar, rode novamente `npm run verify:weapons`, corrija os problemas e mostre `test-results/weapons/sheet.png`. Validação não substitui inspeção visual montada nas duas direções, em rampa, deitado e no tamanho real da UI.

## 11. Integração autoritativa e persistência

Adicionar as armas à loja e aos fluxos de equipamento/ferreiro usando posse, confirmação e transações existentes. Se precisar definir preço, use a política atual de armas equivalentes e registre como decisão de economia do Brasa, sem atribuir um preço ao DDTank que não está nesta pesquisa. Não conceder automaticamente nem sobrescrever equipamento existente.

Toda escolha que afeta dano — arma/fase/modo, fator POW, quantidade física, máscara e dimensões — é congelada no tiro pelo servidor. O cliente reproduz `Shot`, pontos e impactos; não escolhe crateras, alvo ou dano. Salvas posteriores devem observar a destruição e o estado autoritativo anteriores conforme o simulador atual.

Cada impacto é aplicado uma única vez. O histórico de marcas leva ID/versionamento do perfil da arma no disparo; trocar de arma ou fortalecer depois não muda marcas antigas. Reconexão preserva trajetória/impactos pendentes, HP e terreno. Invisibilidade continua filtrada por destinatário em todos esses eventos.

Preserve o comportamento atual dos pets. Ter três objetos desenhados no sprite do Vento não cria três gatilhos de pet; o leque físico do Trovão também não deve executar indevidamente a passiva a cada frame ou impacto.

## 12. Testes e critérios de aceite

- Bases exatas nas fases0/10/12/15 e fortalecimento de Dano200 uma vez; os demais equipamentos continuam com os mesmos números.
- Limites15–50 e25–60 nas duas direções, com inclinação positiva/negativa; seta aponta para a velocidade inicial real.
- Vento normal1, POW1; Trovão normal1, POW3. Três shurikens desenhadas no POW do Vento continuam um collider.
- POW por arma1.5/.6, sem1.65 ou0.5 adicional; +1/+2 mantidos; Tridente+POW recusado nas duas ordens sem cobrar recursos.
- Leque intrínseco do Trovão com ângulos e forças associados; o Tridente manual global permanece como está.
- Contato central, tangência, quinas, velocidade alta, parede antes do alvo, saída de sobreposição; invisível atingível sem vazamento e morto sem interceptação.
- Área de dano normal/POW separada do contato e da máscara; exposição e mitigação calculadas por alvo; sem dano antes do impacto.
- Quatro máscaras com medidas/proporções conferidas. Trovão POW tem três crateras151 por salva, sem ampliar cada uma pela regra genérica. Força e evolução não mudam a forma física por acaso.
- Marcas em chão plano/rampa/parede/ponte fina, sobreposição nas duas ordens, chão indestrutível, acerto direto, borda do mapa e reconstrução por histórico.
- Sons corretos normal/POW, expiração dos efeitos, fps e pivôs, cache, mute, movimento reduzido e celular paisagem. Não reintroduzir jogo em retrato.
- Compra/equipamento/fortalecimento, posse de cópias, tooltip e atributos consistentes; ouro/materiais/perfis preservados.

Execute `npm run check`, `npm test`, `npm run build`, `npm run verify:weapons` e testes de integração pertinentes. Se alterar shared/server, confirmar o reinício e a saúde do backend antes do navegador. Desenvolvimento continua pelo compose.dev em8097, com dados preservados; não apagar volumes nem restaurar banco para atualizar código.

Entregue capturas e vídeo curto das duas armas nas quatro fases, normal/POW, +1/+2, colisão com debug e crateras sobrepostas. Mostre a prancha do validador, registre os prompts usados e atualize `docs/implementation-status.md` com arquivos, medidas, testes, origem das referências e diferenças deliberadas. Mencione explicitamente os limites `.bomb`, SpecialII, gatilhos legados e a adaptação da curva de splash. Não chamar material de referência parcialmente reconstruído de teste do servidor original.

---

Esta entrega de pesquisa não implementa as armas nem altera o banco ou assets ativos. O pacote fornece referências, dados e uma especificação para a próxima IA realizar a implementação no checkout atual.
