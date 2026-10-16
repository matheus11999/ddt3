# Quebra-Tijolos (`brick`)

Arma épica nova, vendida na loja por 500 Brasas (não é concedida por migração). Referências do usuário: saco vermelho, pote dourado com picareta e caixa vermelha laqueada com blocos.

## Mecânica única — estilhaços autoritativos

| Atributo | Valor | Comparação |
| --- | --- | --- |
| Ataque / Defesa / Agilidade | 130 / 70 / 60 | defesa mais alta das armas épicas |
| Dano principal | 200 | menor que as demais; compensa com os cacos |
| Cratera / explosão | 44 / 92 | cratera principal compacta |
| Gravidade | 345 | trajetória pesada, a mais curva do arsenal |
| Ângulo | 20°–80° | |
| Demolição | 60% | ignora 60% da resistência extra de cristal, pedra e metal (terra/areia/gelo inalterados) |
| Cacos por impacto | 2 (+0–8) · 3 (+9) · 4 (+10–11) · 5 (+12); Power soma +2 | |
| Caco | 24% do dano, explosão 44, cratera 17, raio 3, gravidade 420, vento ×0,5 | |

- O servidor (`server/game.ts`) simula os cacos com `shatter()` (`shared/physics.ts`) a partir do centro do impacto principal, em leque determinístico de 32° a 148° voltado para o lado do atirador. Cada caco aplica cratera, dano, carga Power e acomodação dos jogadores pela mesma função do tiro principal.
- O alvo atingido diretamente não é atingido de novo pelos próprios cacos no mesmo quadro. Impactos fora do mapa não geram cacos.
- Cacos chegam ao cliente como `Projectile` com `fragment:true` e `delay` igual ao pouso do projétil principal: sem clarão de disparo, sem pose de disparo, sem som próprio e sem marca de resíduo (o limite de 48 marcas fica para os impactos principais).
- `impact.demolition` faz o cliente reproduzir a mesma cratera em `terrainPlayback.ts`.
- Funciona com +1, +2 e Tridente: cada impacto principal se estilhaça; a duração do tiro inclui o último caco.

## Evolução visual (0–8 / 9 / 10–11 / 12)

| Estágio | Arma | Projétil | Impacto |
| --- | --- | --- | --- |
| +0–8 `weapon-brick-base.png` | saco de pano vermelho amarrado com corda e emblema de tijolos | tijolo amarrado | poeira de barro e cacos |
| +9 `weapon-brick-evolved.png` | pote dourado com faixa vermelha de nuvens, tijolos e picareta | dois tijolos com cintas douradas | clarão quente |
| +10–11 `weapon-brick-awakened.png` | caixa laqueada carmim com moldura dourada e blocos de concreto | blocos com cinta carmim e gema azul | blocos de concreto entre os cacos, faíscas |
| +12 `weapon-brick.png` | relicário carmim com asas, gema de brasa, picareta e martelo dourados, tijolos incandescentes | fardo incandescente com rachaduras de lava e tijolos orbitando | cacos em brasa |

O atlas `vfx/brick-effects.png` segue o contrato 4×3 das outras famílias (linhas: projétil, disparo, impacto; colunas: estágios), 1448×1086 RGBA. `vfx/brick-residue.png` (1024×1024) é o anel de entulho no terreno. A prancha está em `docs/previews/brick-weapon.png`.

## Origem da arte — provisória

Esta sessão não tinha `image_gen`. As seis imagens foram pintadas por código Canvas 2D (`scripts/art/brick-weapon-painter.js`, renderizado com `node scripts/art/render-brick-weapon.mjs scripts/art/brick-weapon-painter.js <saída>`), com contorno escuro, faces iluminadas, textura de barro e cores saturadas. Elas são legíveis e coerentes, mas não têm o acabamento pintado das armas Dragão/Cesto de Pavio. Para a arte final, gerar com os prompts abaixo e substituir os arquivos com os mesmos nomes e medidas; nenhum código precisa mudar.

### Prompts para a arte final (image_gen)

Base comum: "Chibi mobile game weapon icon, thick painted 3D volume, dark brown outline, vivid saturated reds and golds, clear studio light from top-left, transparent background, centered, 1254×1254, no text, no pastel, no haze, in the same style as a red dynamite basket weapon icon."

- +0–8: "a plump red cloth sack tied at the neck with a cream rope and tassels, three chunky red clay bricks poking out the top, a small gold brick-pattern emblem stitched on the front."
- +9: "a round golden pot with a red band decorated with gold cloud swirls and two ring handles, filled with red clay bricks, a steel pickaxe stuck in the bricks."
- +10–11: "an ornate crimson lacquer crate with gold frame, gold flame scrolls and short curled legs, holding grey cinder blocks and a red brick, a blue gem on a gold shield badge."
- +12: "a royal crimson and gold reliquary crate with golden wings around an ember gem, glowing molten bricks with lava cracks, a golden pickaxe and golden hammer crossing behind, warm golden aura and sparkles."
- Atlas: "sprite sheet 4 columns × 3 rows, wide transparent margins; row 1 flying brick bundles growing from one tied brick to a molten gilded bundle; row 2 forward dust bursts with brick chips; row 3 masonry impacts: clay dust dome, flying broken bricks, growing warm flash, last column with molten bricks and gold sparks."
