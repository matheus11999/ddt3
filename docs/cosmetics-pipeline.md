# Padrão aprovado de cosméticos (matheus, 19/10/2026)

Aprovado pelo matheus em 19/10/2026 ("agora ficou do jeito que eu quero"). Vale para **qualquer IA** (Claude, Codex, ChatGPT) que crie roupa, rosto, cabelo, chapéu ou óculos. Não mude este padrão sem pedido dele.

## 1. Escolher o tema

- Temas **variados**, como no DDTank: surfista, piloto de avião, hip hop, espadachim, pirata, bobo da corte, fedora com óculos escuros, moletom com coroa, astronauta, chef, idol… Lista em `docs/cosmetic-sets.json` (`ideas`).
- Cada conjunto é masculino **ou** feminino (`gender`). Corpo feminino tem silhueta feminina (ombros estreitos, cintura, quadril, pernas finas); a cabeça universal é a mesma para todos.
- Escreva o conjunto em `docs/cosmetic-sets.json` (`sets`): `brief` de cada peça e, na roupa, `walkParts` e `details` (a lista de **todos** os detalhes da roupa: estampas, acabamentos, bolsos, acessórios, cores).

## 2. Gerar pelo Codex (nunca à mão)

- `node scripts/cosmetic-prompts.mjs --set=<id> --run` escreve e roda os prompts (Codex local do usuário, `codex exec`).
- Todo prompt tem a **TRAVA DE ESTILO** e anexa as peças já aprovadas do mesmo tipo: o tema muda, o estilo de pintura não (pintado DDTank, volume, contorno castanho, luz de cima à esquerda; nunca vetorial, pixel art, foto, 3D ou infantil). Sem texto na imagem.
- Peças aprovadas entram em `APPROVED` no script para virar referência das próximas.

## 3. O que cada roupa precisa ter

| Arte | Para quê | Como |
| --- | --- | --- |
| Pintura em pé **com pose** (`<id>-atlas.png`) | Prévias: mochila, sala PvP, sala de expedição, loja, ícone | `stand` do gerador; pose com personalidade (mão na cintura, sinal de paz, etc.), **nunca os dois braços retos para baixo** |
| Folha de andar, 6 quadros (`walk/`) | Lobby andando | `walk` do gerador → `build-walk-atlas.py` |
| Folha parada reta (`idle/`) | Lobby parado | `docs/combat-art-prompts/idle.txt` a partir da própria folha de andar → `build-walk-atlas.py --idle`; mesmo tamanho e detalhes do andar, então nada muda ao começar a andar |
| Pranchas de combate (`ground`, `throw`) | Batalha: deitado, rastejar, ajoelhado para arremessar | `build-combat-atlas.py` e depois `python scripts/soften-crawl-kick.py outfit-<id>` (chute do rastejar mais baixo); nunca de pé na batalha, arma nas costas |

**Mesma roupa em todas as pinturas:** o andar, a pose parada e o combate copiam os `details` da pintura em pé. Se a cor mudar, `python scripts/match-outfit-color.py <roupa> <matiz>`.

## 4. Mãos (coesão com o DDTank)

- Na pintura em pé (prévias) as mãos também seguem o padrão: mãos chibi na pele clara `#FCD0AC`, sombra suave, contorno escuro fino, saindo do punho da manga; o gerador já pede isso e a pose no prompt de `stand`.

- Em todas as folhas (andar, parada, combate) as mãos são **pintadas na própria folha**: manga com punho saindo do casaco, terminando num **punho redondo sem dedos** sobre os discos cor de pele do molde, na pele clara `#FCD0AC` com sombra suave e contorno escuro fino. O jogo só tinge a pele (`tintSkin`).
- Deitado: punho da frente por cima do queixo, o de trás meio escondido atrás da cabeça.
- Não usar ciano nas roupas perto das mãos sem conferir: o montador de combate só apaga como disco de punho o ciano quase puro do molde.

## 5. Cabelo, chapéu, óculos e rosto

- **Cabelo curto:** laterais e nuca descem até a orelha, com **costeleta na frente da orelha**, nuca rente ao crânio (nada pendurado atrás da cabeça), franja acima das sobrancelhas, nada sobre olhos/boca. Referência: Corte Tempestade (`docs/templates/ref-hair-ear.png`). Cabelo longo e maria-chiquinha usam as classes `hair-long` e `hair-twin`.
- **Chapéu:** pintado **vestido e visto um pouco de cima**, sem mostrar o lado de dentro; assenta na testa (sem testa aparecendo entre a borda e a cabeça); aba curta e alta para não esconder os óculos. Tiaras e viseiras são `hat-band`.
- **Óculos:** centro de cada lente sobre um olho, lente distante menor e um pouco mais baixa, só a haste da frente aparece, lentes translúcidas (olhos visíveis).
- **Rosto:** editado a partir do `face-brave` (masculino) ou `face-smile` (feminino), mesma silhueta universal; muda só a feição. Registrar no retângulo comum `[380,222,521,505]`.

## 6. Ícones

Ícone da loja e da mochila sempre **consistentes** entre si: mesma peça centralizada, mesma escala relativa e mesma iluminação; o ícone vem da própria arte da peça (`getOutfitPortrait`, `getAccessoryPortrait`, `getWornHatPortrait`, `getFacePortrait`), nunca uma pintura à parte.

## 7. Encaixar e validar

1. `node scripts/fit-cosmetic.mjs <id>` sugere o pin que zera o validador (cola no `COSMETIC_MANIFEST`); confira o resultado nas prévias, porque o validador mede medida, não beleza.
2. `npm run verify:cosmetics -- --strict --only=<ids>` com **zero problemas** (zona, olhos/boca, orelha, costeleta, assento do chapéu, óculos visíveis, andar, pose parada, batalha, cor igual em todas as pinturas, Ticket de Cor).
3. `node scripts/preview-cosmetic-set.mjs <ids>` (loja, prévia com pose, lobby parado e andando, batalha) e `node scripts/preview-lobby-walk.mjs` (andar a 60 fps sem quadro sem corpo); `ears.png` do validador.
4. Cadastrar: catálogo (`shared/catalog.ts`, gênero em `GENDERED_ITEMS`), loja (`shared/shop.ts`), `SHOP_ONLY_COSMETICS` (`server/store.ts`, senão perfis antigos ganham de graça), zona de cor (`src/game/rig/recolorZones.ts`, **toda peça aceita Ticket de Cor**), `PAINTED_OUTFITS` (`appearance.ts`).
5. `npm run check`, `npm test`, `npm run build`; teste no jogo local (`node scripts/smoke-female-sets.mjs <itens>` compra e veste numa personagem nova); mostrar as prévias ao matheus.
