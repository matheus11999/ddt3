# Praça Celeste — lobby redesenhado (17/10/2026)

Pedido do usuário: deixar o lobby parecido com a referência de lobby clássico de artilharia (céu ensolarado, ilhas flutuantes, praça com portais, NPCs ferreiro e guarda-volumes, ícones de evento no topo). A arte é original no mesmo estilo; nenhum arquivo da referência é copiado.

## Como está montado

`src/game/lobbyWorld.ts` desenha a praça em camadas, todas no quadro 1536×864:

1. **Céu** (estático): degradê, sol, banco de nuvens no horizonte e mar.
2. Nuvens que andam e brilho no mar (animados).
3. **Mundo** (estático): ilha flutuante com cascata, ruínas no mar, templo branco à direita, árvores, balaustrada, canteiro e piso da praça com mosaico.
4. Cascata, dirigível, faixa do festival e balões (animados).
5. Postes, portais, caixotes/baú e bigorna/braseiro, ordenados por profundidade junto com os personagens.
6. Títulos da praça, placas dos portais e nomes dos NPCs.

Pontos clicáveis (`LOBBY_HOTSPOTS`): portal **Arena** (centro) e **Treino** (dourado) abrem a arena; **Ateliê** (rosa) abre a loja; **Guarda-volumes** abre a mochila; **Ferreiro** leva o jogador até `SMITH_POSITION` (1250, 630) e abre a forja. Área de caminhada: x 160–1400, y 560–750.

Hoje as camadas 1 e 3 são pintadas por código, como substituto provisório. Para trocar pela arte final basta salvar os arquivos abaixo; o código usa a imagem quando ela existe e mantém o desenho por código quando não existe.

| Arquivo | Tamanho | Fundo |
| --- | --- | --- |
| `public/assets/lobby/sky.webp` | 1536×864 | opaco |
| `public/assets/lobby/world.webp` | 1536×864 | transparente onde o céu aparece (acima das ilhas, do templo e da balaustrada) |

Portais, postes, NPCs, placas e animações continuam no código, por cima da pintura: **não pintar portais, personagens, textos nem ícones na arte do fundo.**

## Prompt — céu (`sky.webp`)

```
Fundo de jogo 2D estilo chibi coreano/chinês de artilharia por turnos, pintado à mão, cores vivas e saturadas, contorno escuro fino e consistente, sem aparência lavada ou pastel. Quadro 16:9, 1536×864.
Céu azul intenso de dia ensolarado, degradê do azul-cobalto no topo ao azul-claro perto do horizonte, sol forte no canto superior direito com brilho suave. Faixas longas de nuvens altas e um banco de nuvens brancas fofas, volumosas, com sombra azulada, apoiado na linha do horizonte (por volta de 46% da altura). Ilhas distantes azuladas no horizonte. Mar turquesa brilhante ocupando a faixa entre 46% e 54% da altura, com reflexos claros.
Nada abaixo de 54% importa (será coberto). Sem personagens, sem construções, sem texto, sem logotipos.
```

## Prompt — mundo (`world.webp`, PNG/WebP com transparência)

```
Camada de cenário 2D para o lobby de um jogo chibi de artilharia por turnos, pintado à mão, cores vivas, contorno escuro fino, iluminação de dia ensolarado vinda da direita. Quadro 16:9, 1536×864, FUNDO TRANSPARENTE onde ficaria o céu.
Composição, da esquerda para a direita:
- Esquerda alta: grande ilha flutuante de rocha em camadas (marrom, malva e roxo), topo gramado com arbustos e um pequeno santuário branco de telhado azul; cascata caindo da borda direita da ilha até o mar; ilhotas menores ao redor; um arco-íris discreto atrás.
- Centro ao fundo: mar aberto com duas pequenas ruínas de colunas brancas em ilhotas verdes (deixar o centro livre e baixo: portais serão desenhados à frente, entre x 330 e x 1050).
- Direita: templo de mármore branco com colunas, frontão triangular com medalhão dourado, torre com cúpula turquesa, escadaria larga e estandartes laranja.
- Faixa inferior do fundo (y 440–545): sebe verde baixa, balaustrada de pedra clara com balaústres arredondados e pilares com vasos de flores, canteiro de grama com flores pequenas coloridas.
- Praça (y 545–864): piso de lajotas de pedra clara e irregular, bege e creme, em perspectiva suave; mosaico circular com estrela dourada parcialmente visível no canto inferior direito; um quadro de avisos de madeira com papéis no canto esquerdo.
Sem personagens, NPCs, portais, postes, dirigível, balões, texto ou interface.
```

## Próximas pinturas sugeridas

Ainda desenhadas por código ou usando o boneco padrão; podem ganhar arte própria depois:

- **Ferreiro**: NPC grande e musculoso, avental de couro, martelo, bigorna (sprite parado + 2 quadros de martelada), fundo transparente.
- **Guarda-volumes**: NPC amigável com um pônei/burrinho de carga carregando baús, fundo transparente.
- **Medalhas de evento** do topo (Arena, Ateliê, Missões, Ferreiro): ícones redondos 128×128 com aro dourado e figura 3D no centro, no estilo dos ícones já pintados de correio/missões/guilda (`public/assets/ui/arena-*.png`).

Quando essas pinturas existirem, registrar aqui as medidas e ligar no código (`lobbyWorld.ts` para NPCs, `Hud.tsx` para medalhas).

## Verificação

`node scripts/shot-lobby.mjs <pasta>` (com Vite e servidor rodando) salva `lobby.png`, abre as missões, clica no portal da Arena e no Ferreiro e confere que a arena e a forja abrem.
