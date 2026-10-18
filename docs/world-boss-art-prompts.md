# Chefão Mundial: prompts de arte (Codex)

Arte do dragão "Dragão Ancestral" (conceito A, Esmeralda ancestral, da especificação em
`/mnt/project-files/chefao-mundial/especificacao-chefao-mundial.md`) e do mapa `dragon-lair`.
Gerar pelo Codex no PC do usuário (`codex exec`, `resume` para iterar), na ordem abaixo, sempre anexando o
modelo aprovado (01) e as peças já prontas como referência. Saída bruta em `test-results/codex-world-boss/<nn>/`.

Rig usado pelo jogo (`src/game/worldBoss/dragon.ts`): corpo/pescoço, cabeça sem a mandíbula, mandíbula,
pálpebra, garra aberta e garra fechada (o fogo é desenhado em código). O movimento (respirar, rugir, abrir a boca, a pata
saindo do chão, o agarrão, o sopro) é feito pelo jogo sobre essas pinturas.

## Bloco comum (início de todo prompt)

> Jogo de navegador de artilharia por turnos no estilo DDTank. Fantasia pintada à mão, cores vivas e saturadas,
> volume com luz vinda de cima à esquerda, contorno escuro legível, formas grandes e claras que continuam legíveis a
> 50% do tamanho, pouca textura fina, nada de aparência lavada, névoa leitosa ou acabamento genérico de IA. Sem texto,
> letras, números ou logotipos na imagem. Fundo magenta puro #FF00FF chapado, sem sombra projetada no fundo, sem
> degradê, com a peça inteira dentro da imagem e pelo menos 24 px de margem. Dragão original: não copie o dragão do
> DDTank (cabeça magenta, chifres dourados em leque, focinho em bico, punho com espinhos pretos).

Depois do 01 aprovado, acrescentar:

> Mantenha exatamente o dragão do modelo anexado (focinho, chifres, olhos, escamas, cores e proporções). Não redesenhe,
> não acrescente nem tire chifres, espinhos ou placas. As peças anteriores anexadas são o padrão de cor e de luz.

## Dragão (saída limpa em `public/assets/world-boss/`, PNG com transparência)

O dragão: escamas verde-esmeralda profundo com reflexo turquesa, placas creme-âmbar no queixo e na garganta, dois
grandes chifres de marfim que curvam **para a frente** como uma coroa e dois pequenos nas bochechas, barbatanas coral
atrás das bochechas, focinho largo e rombudo com um chifre nasal curto, olhos dourado-âmbar de pupila vertical,
sobrancelha óssea marcada, garra verde com placas de armadura no pulso e unhas pretas de ponta dourada. Ameaçador e
majestoso, nível de chefão final.

| # | Arquivo | Tela | Prompt (depois do bloco comum) |
| --- | --- | --- | --- |
| 01 | `model.png` (referência, não vai para o jogo) | 2048×1024 | Folha de modelo: à esquerda a cabeça e o pescoço de perfil virados para a esquerda, boca fechada; à direita a garra fechada vista de lado e a garra aberta com os dedos espalmados. Mesma luz e cores. |
| 02 | `body.png` | 1024×1024 | O pescoço grosso e o alto do peito do dragão subindo da borda de baixo à direita, curvando para cima e para a esquerda, como se saísse de trás de um morro; placas creme-âmbar na frente do pescoço, escamas grandes nas costas, uma fileira de espinhos curtos no dorso. Embaixo o corte é reto na borda (fica atrás do chão). No alto à esquerda o pescoço termina num encaixe arredondado (a cabeça é outra peça e cobre esse ponto). Sem cabeça, sem garras. |
| 03 | `head.png` | 1024×768 | Só a cabeça de perfil virada para a esquerda, **sem a mandíbula de baixo**: crânio, maxila superior com os dentes de cima, chifres, barbatanas, olho aberto dourado; atrás à direita um toco curto do pescoço. A parte de baixo onde entra a mandíbula fica limpa, com a dobradiça visível perto do canto da boca. |
| 04 | `jaw.png` | 768×384 | Só a mandíbula inferior fechada da mesma cabeça, de perfil para a esquerda, com dentes de baixo, placas creme-âmbar por baixo; a dobradiça na ponta direita. |
| 05 | `lid.png` | 256×192 | A pálpebra fechada do olho (escamas verdes sobre o olho), do tamanho do olho da cabeça 03, para piscar por cima. |
| 06 | `claw-open.png` | 768×1024 | A garra descendo do céu: o antebraço entra pela borda de cima, a mão aberta com os dedos espalmados para baixo, unhas pretas de ponta dourada, vista de lado de leve. |
| 07 | `claw-fist.png` | 768×1024 | A mesma garra, mesmo antebraço e mesmo enquadramento, com a mão fechada (agarrando algo do tamanho de uma pessoa, o meio da mão vazio). |
| 08 | ~~`flame.png`~~ (descartado em 18/10: o fogo agora é desenhado em código) | 2048×256 | Tira de 8 quadros de 256×256, da esquerda para a direita: uma bola de fogo pintada que pulsa em loop (laranja-dourado, miolo amarelo-claro, bordas vermelhas, línguas de fogo grandes), sem faíscas soltas demais. |
| 09 | `portrait.png` | 512×512 | A cabeça do dragão em 3/4 virada para a esquerda, boca entreaberta mostrando presas, enquadrada como retrato quadrado (a cabeça enche o quadro). |
| 10 | `icon.png` | 128×128 (gerar 512 e reduzir) | Ícone do botão da praça no estilo dos ícones do menu (`public/assets/ui/*-button.png`): a cabeça do dragão de perfil com os chifres de coroa, contorno forte, legível pequeno. |

Limpeza: magenta vira transparente sem franja, recorte justo com 8 px de margem (menos `flame.png`, que mantém a
grade de 256 px, e `icon.png`/`portrait.png`, que mantêm o quadrado).

## Covil do Dragão (mapa `dragon-lair`, fontes em `public/assets/maps/dragon-lair/source/`, magenta mantido)

Mapa de 3072×864. Os jogadores ficam à esquerda (x 600–1500); o dragão sobe atrás de um morro à direita (x 2300–3072),
onde só aparecem o pescoço, a cabeça e a garra.

| # | Arquivo | Tela | Prompt |
| --- | --- | --- | --- |
| 11 | `panorama-esquerda.png` | 1536×1024 | Fundo (sem magenta): ruínas antigas de um templo de pedra em um vale de montanhas, céu dramático de fim de tarde (roxo e laranja), névoa baixa. Metade esquerda de um panorama; a borda direita só com céu e névoa. |
| 12 | `panorama-direita.png` | 1536×1024 | Continuação à direita da 11 (anexar), borda esquerda só com céu e névoa; montanhas mais escuras e altas, a entrada de uma caverna enorme ao fundo de onde o dragão viria. Espaço livre no meio para o dragão ocupar. |
| 13 | `chao.png` | 2880×640 | Sobre magenta: uma única peça de chão larga de pedra antiga e terra, topo quase plano e caminhável à esquerda e no meio (lajes quebradas, raízes, grama seca), e na ponta direita um morro rochoso mais alto e quebrado, atrás do qual o dragão surge. Embaixo a peça termina reta. |
| 14 | `pecas.png` | 1536×1024 | Sobre magenta, separados: 2 pedras grandes, 1 coluna caída, 1 pedaço de estátua antiga, 1 plataforma de pedra pequena flutuante. |

Montagem: `scripts/map-layouts/dragon-lair.json` e `npm run build:map -- --map=dragon-lair` (ver `docs/maps-kit.md`).
