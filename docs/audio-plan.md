# Áudio da Brasa Arena: recomendação

## 1. Por que soa simples hoje

Todo o som do jogo é sintetizado na hora, em código (`src/game/audio.ts` e `src/game/ambience.ts`): cada tiro e explosão são 2 ou 3 osciladores (seno, triângulo, serra) mais um ruído filtrado. Existem só 4 eventos (`click`, `shot`, `impact`, `turn`), o mesmo `click` serve para loja, mochila, ferreiro e menus, e não há música. Não existe nenhum arquivo de áudio em `public/`.

Oscilador puro sempre vai soar "bip de jogo antigo". O DDTank soa rico porque usa **amostras gravadas e editadas** (explosões com corpo, assobio do projétil, vozinhas, UI com "plim" de moeda) e **música própria** em cada tela. Não dá para chegar nesse nível ajustando o sintetizador; precisa trocar a fonte do som.

## 2. A recomendação, em uma frase

Trocar para **arquivos de som gerados por IA + bibliotecas CC0**, montados em **camadas com variações**, tocados por um motor de áudio com **canais (mixer), prioridade e posição na tela**. O sintetizador atual fica só como reserva enquanto um arquivo não carrega.

Regra de sempre: nada copiado do DDTank. Sons e músicas originais, no mesmo *estilo* (fofo, exagerado, "cartoon" com peso).

## 3. De onde tirar os sons

Você já gera a arte fora; o som segue o mesmo fluxo: eu escrevo os prompts, você gera, coloca em `public/assets/audio/` e eu integro.

| Fonte | Para quê | Licença (confira no site antes de usar) |
|---|---|---|
| **ElevenLabs Sound Effects** (elevenlabs.io) | Principal: armas, explosões, habilidades, UI | Uso comercial nos planos pagos |
| **Stable Audio** (stableaudio.com) | Alternativa para efeitos e trechos de música | Comercial com assinatura |
| **Kenney.nl** (Interface Sounds, Impact Sounds, RPG Audio) | Cliques, moedas, passos, UI pronta | CC0, sem atribuição |
| **Freesound.org** (filtro "Creative Commons 0") | Camadas reais: madeira, pedra, vidro, pavio, vento | Use só os CC0 |
| **Sonniss GDC Game Audio Bundle** (gratuito, anual) | Explosões e impactos de nível profissional para misturar | Royalty-free, comercial |
| **Suno** ou **Udio** (plano pago) | Música do lobby, batalha, vitória e derrota | Direito comercial só no plano pago |

Ferramenta para editar (cortar silêncio, juntar camadas, normalizar): **Audacity** (grátis). Se quiser algo ainda mais rápido para cliques e moedas, **jsfxr** (sfxr.me) gera efeitos retrô que, misturados por baixo de um som real, dão "brilho" de jogo.

Minha sugestão prática: **ElevenLabs para quase tudo** (você descreve, ele gera 4 variações de uma vez, ótimo para camadas), **Kenney para UI**, **Suno para música**.

## 4. Como um som "nível DDTank" é montado

Um tiro não é um som, são várias camadas curtas tocadas juntas:

1. **Disparo**: estalo/whoosh de 0,2 a 0,4 s, com a cara da arma (rugido do dragão, faísca elétrica, tilintar de cristal).
2. **Voo** (opcional, em loop baixo): assobio que sobe e desce com a altura do projétil.
3. **Impacto**: 
   - *transiente* (o "pá" seco, 50 ms),
   - *corpo* (o "bum" grave, 0,3 a 0,6 s),
   - *cauda* (detritos, poeira caindo, faíscas, 0,5 a 1,5 s).
4. **Material do terreno**: o mapa já define `dust`, `spark` e `chime` (`shared/maps.ts`); vira uma camada a mais conforme onde caiu.
5. **Nível da arma**: armas nível 9, 10 e 12 já ficam mais ricas no código; com arquivos, cada faixa ganha uma camada extra (brilho mágico, sub-grave).
6. **POW** (tiro carregado): camada extra de "peso" no disparo e no impacto.
7. **Reação do alvo**: vozinha curta de dor ("ai!", "ugh") e, no crítico, um "ting" mais agudo junto do número vermelho.

E para não cansar o ouvido:

- **3 a 4 variações** de cada som, sorteadas a cada vez.
- Variação aleatória de **tom (±5%) e volume (±2 dB)**.
- **Posição na tela**: tiro à esquerda soa à esquerda (pan estéreo pelo `x`), e mais baixo se estiver longe da câmera.
- **Abafar a música** um instante em explosões grandes (ducking), para a explosão "bater".

## 5. Lista do que o jogo precisa

Nomes sugeridos de arquivo entre parênteses. Variações terminam em `-01`, `-02`...

### Armas (5)

| Arma | Disparo | Voo | Impacto | Extra |
|---|---|---|---|---|
| Dragão de Brasa (fogo) | rugido curto + sopro de fogo (`ember-launch`) | crepitar baixo (`ember-fly`) | explosão de fogo com estalos (`ember-impact`) | chiado de brasa na cauda |
| Tempestade (elétrica) | descarga + estalo (`volt-launch`) | zumbido elétrico (`volt-fly`) | trovão curto com zap (`volt-impact`) | estalos aleatórios após o impacto |
| Flor de Cristal | tilintar mágico subindo (`crystal-launch`) | brilho cintilante (`crystal-fly`) | vidro mágico estilhaçando (`crystal-impact`) | fragmentos tilintando caindo |
| Cesto de Pavio (dinamite) | arremesso + pavio aceso (`dynamite-throw`) | pavio chiando (`dynamite-fuse`) | explosão grande, grave (`dynamite-impact`) | chuva de faíscas |
| Quebra-Tijolos | arremesso pesado (`brick-throw`) | whoosh de objeto pesado | tijolo quebrando (`brick-impact`) | cacos quicando (`brick-shard`, um por fragmento) |

Comum a todas: camada de material `impact-dust`, `impact-spark`, `impact-chime`; camada de nível `tier-9`, `tier-10`, `tier-12`; `pow-launch` e `pow-impact`.

### Combate (geral)

- Mira: tique ao mudar ângulo (`aim-tick`), barra de força enchendo em loop (`power-charge`), soltar (`power-release`).
- Turno: "sua vez" (`turn-yours`), turno do inimigo (`turn-enemy`), aviso de 5 s restantes (`turn-timer`), tempo esgotado (`turn-timeout`).
- Andar deitado/arrastando (`crawl`), pulo/queda (`fall`), cair no vazio (`fall-out`).
- Dano: acerto normal (`hit`), crítico (`hit-crit`), vozinha de dor masculina e feminina (`hurt-m`, `hurt-f`), morte e lápide aparecendo (`death`, `tombstone`).
- Vento mudando (`wind-change`).
- Resultado: vitória (`victory`), derrota (`defeat`), recompensa/cartas (`reward-flip`, `reward-gold`).

### Habilidades (4)

- Voo (`ability-flight`), Cura (`ability-heal`), Mira assistida/ímã (`ability-homing` + trava no alvo `homing-lock`), Invisibilidade (`ability-invisible-on`, `ability-invisible-off`).

### Interface

- Clique de botão (`ui-click`), passar o mouse (`ui-hover`, bem baixo), abrir e fechar janela de madeira (`ui-open`, `ui-close`), trocar aba (`ui-tab`), erro/negado (`ui-error`).
- Mochila: equipar (`equip`), desequipar (`unequip`).
- Loja: provar item (`shop-try`), comprar com moedas (`shop-buy`), sem ouro (`ui-error`).
- Ferreiro: colocar pedra (`forge-stone`), martelando durante a animação (`forge-hammer`), **sucesso** (`forge-success`, fanfarra curta) e **falha** (`forge-fail`, "plof" triste). Hoje o sucesso usa o som de turno e a falha usa o de explosão.
- Sala PvP: jogador entrou/saiu (`room-join`, `room-leave`), pronto (`room-ready`), partida começando com contagem (`match-start`).
- Subir de nível (`level-up`), missão concluída (`quest-done`), chat recebido (`chat`).

### Lobby

- Passos na praça (`step-01..04`, sincronizados com a animação de andar).
- Ambiente: praça no céu, vento leve, pássaros, burburinho distante (`lobby-ambience`, loop de 30 a 60 s).

### Música (loops)

| Faixa | Clima | Duração |
|---|---|---|
| `music-lobby` | alegre, fofa, aventura leve (estilo jogo casual asiático) | 1:30 a 2:30, loop |
| `music-shop` (opcional) | mais calma, "lojinha" | 1:00, loop |
| `music-battle-garden`, `-park`, `-celestial` | uma por mapa, energia média, sem atrapalhar os sons | 2:00, loop |
| `music-victory` / `music-defeat` | jingles curtos | 4 a 8 s |

Os ambientes dos mapas (pássaros, parque de diversões, vento) já existem sintetizados; podem virar arquivos também, mas são a última prioridade.

## 6. Como o código deveria tocar isso

1. **Manifesto de sons** (`src/game/sounds.ts`): cada id aponta para as variações, volume base, canal e prioridade. Exemplo:
   `'ember-impact': {files:['ember-impact-01','ember-impact-02','ember-impact-03'], volume:.9, bus:'sfx', priority:3}`.
2. **Formato**: `.ogg` (Opus/Vorbis) com cópia `.mp3` para Safari antigo; 48 kHz, mono para efeitos e estéreo para música. Efeitos de 30 a 120 KB cada.
3. **Carregamento**: decodificar com `decodeAudioData` e guardar em cache. UI e combate carregam ao entrar na tela; música é tocada em streaming (`<audio>` ligado ao WebAudio), sem baixar tudo de uma vez.
4. **Mixer**: canais `master > música, efeitos, interface, ambiente, voz`, cada um com volume próprio nos Ajustes (hoje só há liga/desliga). Compressor leve no master para explosões não estourarem.
5. **`play(id, {x, pitch, volume})`**: sorteia variação, aplica variação de tom/volume, faz o pan pela posição `x` na tela.
6. **Limites**: no máximo ~3 cópias do mesmo som ao mesmo tempo e ~24 vozes no total; sons de menor prioridade são cortados primeiro (importante na rajada do Quebra-Tijolos e na chuva de faíscas).
7. **Eventos de combate**: os pontos de chamada já existem em `src/game/Scene.tsx` (disparo, impacto, turno); só passam a chamar ids específicos (`ember-launch`, `impact-dust`, `tier-12`...).
8. **Reserva**: se um arquivo falhar ou ainda não chegou, toca o som sintetizado atual. O jogo nunca fica mudo.
9. Continuar respeitando o que já funciona: só tocar após o primeiro toque do jogador, pausar com a aba escondida, e lembrar as preferências no navegador.

## 7. Ordem de trabalho sugerida

1. **Armas + impactos + crítico + turno** (é onde o jogo mais "sente"). Integro com 2 armas primeiro (Brasa e Dinamite) para você ouvir e aprovar o estilo antes de gerar o resto.
2. **UI + ferreiro + loja + mochila**.
3. **Música do lobby e da batalha**.
4. Habilidades, vozinhas, passos, ambientes.

## 8. Prompts para gerar (ElevenLabs Sound Effects)

Os geradores entendem melhor em inglês. Configure a **duração** indicada e **"Prompt influence" alto (~0.7)**. Gere 4 de cada, escolha as 3 melhores. Peça sempre "no music, no voice" quando for efeito.

Estilo base para colar no começo de todos:
> `Cartoon casual mobile game sound effect, punchy and exaggerated, clean studio quality, no music, no voice.`

### Armas

| Arquivo | Duração | Prompt |
|---|---|---|
| ember-launch | 0.6 s | small dragon roaring briefly and spitting a fireball, whoosh of flame launching |
| ember-fly | 2 s loop | soft crackling fireball flying through the air, gentle whoosh, seamless loop |
| ember-impact | 1.5 s | fireball explosion with deep boom, flames bursting, embers crackling and sizzling after |
| volt-launch | 0.5 s | electric zap charging and firing a lightning orb, sharp crackle |
| volt-fly | 2 s loop | humming buzzing electric orb traveling, light crackles, seamless loop |
| volt-impact | 1.5 s | small thunder clap with electric discharge, crackling sparks fading |
| crystal-launch | 0.6 s | magical crystal shimmer rising, sparkling chime launch |
| crystal-fly | 2 s loop | twinkling magic sparkle trail, airy, seamless loop |
| crystal-impact | 1.5 s | magic crystal shattering like enchanted glass, bright chimes, shards tinkling down |
| dynamite-throw | 0.5 s | throwing a stick of dynamite, quick whoosh with fuse ignition hiss |
| dynamite-fuse | 2 s loop | burning fuse hissing and sparkling, seamless loop |
| dynamite-impact | 2 s | big cartoon dynamite explosion, heavy deep boom, debris and dirt falling, sparks |
| brick-throw | 0.5 s | heavy bundle of bricks thrown, heavy whoosh |
| brick-impact | 1.2 s | bricks smashing into ground, heavy crunch, clay breaking apart |
| brick-shard | 0.3 s | small brick shard bouncing on ground, light clack |

### Camadas comuns

| Arquivo | Duração | Prompt |
|---|---|---|
| impact-dust | 1 s | dirt and soil crumbling after impact, dust settling |
| impact-spark | 0.8 s | metal clang with sparks scattering |
| impact-chime | 1 s | magical stone hit with soft resonant chime |
| tier-12 | 1 s | epic magical power sweetener, shimmering rising tone with sub bass hit |
| pow-launch | 0.8 s | powerful charged shot release, deep heavy whoosh with energy burst |
| hit-crit | 0.5 s | critical hit, sharp bright ding with heavy punch |
| hit | 0.3 s | cartoon body hit, soft punchy thump |

### Combate, UI e ferreiro

| Arquivo | Duração | Prompt |
|---|---|---|
| power-charge | 2 s loop | power gauge filling up, rising energy hum, seamless loop |
| turn-yours | 0.8 s | cheerful bright notification chime, your turn, two ascending notes |
| turn-timer | 0.4 s | soft ticking clock warning |
| victory | 5 s | short triumphant fanfare jingle, cute casual game victory |
| defeat | 4 s | short sad cartoon defeat jingle, descending notes, light and funny |
| tombstone | 1 s | cartoon tombstone popping out of the ground, stone thud with puff |
| ui-click | 0.15 s | soft wooden button click, game menu |
| ui-open | 0.4 s | wooden panel sliding open, soft whoosh |
| ui-close | 0.3 s | wooden panel closing, soft thud |
| equip | 0.4 s | equipping armor item, cloth rustle with small metal clink |
| shop-buy | 0.6 s | coins dropping into pouch, cash register bling |
| forge-hammer | 1.5 s | blacksmith hammer striking anvil three times, metallic rings |
| forge-success | 2 s | magical upgrade success, sparkling rising chimes and triumphant shine |
| forge-fail | 1 s | upgrade failure, cartoon fizzle and puff of smoke, descending tone |
| level-up | 2 s | level up, bright ascending arpeggio with sparkles |
| ability-heal | 1.2 s | healing magic, soft warm shimmering chime with gentle rise |
| ability-flight | 1 s | wings flapping and magical whoosh taking off |
| ability-invisible-on | 0.8 s | magical cloaking, soft whoosh fading out shimmer |
| homing-lock | 0.4 s | target lock-on beep, sci-fi magnetic click |

### Vozinhas (opcional, ElevenLabs Voice ou Sound Effects)

- `hurt-m`: `short cartoon young male "ugh!" hurt grunt, cute game character` (0.4 s)
- `hurt-f`: `short cartoon young female "ah!" hurt yelp, cute game character` (0.4 s)
- `laugh-m`, `laugh-f`: `short cheerful cartoon laugh, cute anime game character` (1 s)

### Música (Suno ou Udio)

- **Lobby**: `Cheerful casual MMO town theme, bright orchestral pop, pizzicato strings, glockenspiel, flute, light percussion, happy adventure in a floating sky plaza, instrumental, seamless loop, 110 BPM`
- **Batalha, Jardim Encantado**: `Upbeat playful battle theme for a cute turn-based artillery game, orchestral with marimba and drums, energetic but not aggressive, instrumental, loopable, 128 BPM`
- **Batalha, Parque dos Sonhos**: `Playful carnival battle music, brass band, accordion, bouncy drums, whimsical and energetic, instrumental, loopable`
- **Batalha, Fortaleza Celestial**: `Epic but cute sky fortress battle theme, choir pads, strings, taiko drums, heroic and magical, instrumental, loopable`
- **Vitória / Derrota**: `Short 6 second victory fanfare, cute casual game, orchestral brass and bells` / `Short 5 second funny sad defeat jingle, tuba and xylophone descending`

Peça sempre "instrumental", e na música de batalha deixe espaço: nada de bateria muito alta, para as explosões aparecerem.

## 9. Como me entregar

Coloque os arquivos em `public/assets/audio/sfx/` e `public/assets/audio/music/` com os nomes acima (ex.: `ember-impact-01.mp3`), em qualquer formato (wav, mp3); eu corto, normalizo, converto e integro.
