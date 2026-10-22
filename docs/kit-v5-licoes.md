# Personagem rig v5: regras para cosméticos novos (22/10, aprovado pelo matheus)

Lições do kit inicial masculino. Toda IA que gerar cosmético segue isto; o fluxo técnico está em `docs/codex-mcp.md` ("Kit de personagem") e os scripts em `scripts/kit-v5/`.

## Antes de pintar

1. **Aprovar um boneco inteiro primeiro**, nas proporções dos prints do DDTank (cabeça quase do tamanho do corpo, corpo curto e fino). Nunca pintar peças soltas sem esse boneco aprovado: a cabeça sai pequena e o cabelo grande.
2. **Moldes neutros** com as medidas do DDTank (`output/ddtank-molds/`, `docs/templates/rig/`): verde = cabeça, cinza = corpo, bege = pele (da máscara de pele, nunca adivinhada pela cor), sem sombra no chão. Nunca anexar a arte original do DDTank.

## Peças

- **Cada peça numa camada só**: cabelo, chapéu, óculos e roupa nunca aparecem juntos numa pintura que vai para o jogo. O matheus rejeitou cabeça e boné na mesma imagem.
- **Camadas por edição, não por pintura solta**: pedir ao Codex a mesma imagem sem o cabelo (careca) ou com o chapéu, alinhar pelo corpo (`align.py`) e tirar a diferença. Cabelo ou chapéu pintados sozinhos nunca encaixam (cobriam os olhos, ficavam deslocados).
- **Uma cabeça para tudo**: a mesma cabeça 3/4 da mochila vai para combate e praça; só o corpo muda entre os contextos. Vista extra só a de costas (praça, andando para cima).
- **Cabelo sob chapéu = folha B** (o mesmo cabelo baixinho, pintado por edição da careca). Cortar cabelo por código deixa borda, fiapo e careca: não usar.
- **Pescoço é da cabeça** (como no DDTank): pintado junto com o queixo, descendo até abaixo da gola; a roupa vem por cima e a gola cobre a ponta. Pescoço da roupa encostando no queixo sempre dá rasgo.
- **Encaixe da cabeça pelo crânio careca** (caixa do crânio na caixa verde, queixo na base). Pela largura do cabelo a cabeça sai pequena e solta.

## Animação

- **Folhas de animação numa prancha só** (todos os quadros juntos): em duas pranchas a escala e o ângulo mudam e o passo fica feio.
- **Corpo da praça com a cabeça de verdade no molde** (não o verde): senão o Codex inventa o pescoço.
- **Ajoelhado** (carregar e arremessar): um joelho no chão, a perna deitada para trás com o tênis de lado atrás do corpo; nunca os dois tênis lado a lado na frente.
- **Parado e dano**: o corpo fica imóvel; só a cabeça mexe (em código). Piscar é universal, em código (`eyes.py` mede os olhos de cada rosto novo).
- **Sem sombra/círculo** embaixo do boneco, em lugar nenhum.

## Conferir antes de mostrar

- Prévia com o desenho do próprio jogo: `node scripts/rig/preview-rig.mjs m` (mochila, praça 8 direções, combate) e ampliar pescoço, aba do chapéu e pés.
- Restos de molde: franja magenta, contorno pontilhado da cabeça verde, laranja/verde no pescoço. O `build-rig.py` limpa os casos conhecidos; olhar ampliado mesmo assim.
