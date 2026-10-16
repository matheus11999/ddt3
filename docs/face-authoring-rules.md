# Regra obrigatória: cabeça universal para todos os rostos

Solicitação explícita do usuário: os rostos devem obedecer ao mesmo shape e às mesmas medidas para que qualquer cabelo funcione corretamente. Esta regra vale para todos os novos itens, inclusive em futuras sessões na cloud.

## O que varia e o que fica fixo

Um item de rosto contém a feição completa: olhos, pálpebras, sobrancelhas, boca, expressão e pequenos detalhes internos. Criar alegria, provocação, calma, determinação e outras emoções por **desenho das feições**, não somente troca de cor.

Nunca variar crânio, contorno do rosto, bochecha, queixo, orelha, base do nariz, pescoço, escala, perspectiva ou âncora de encaixe entre os itens. Cabelo, chapéu e óculos continuam nas mesmas coordenadas. Não resolver uma arte fora de medida deslocando a cabeça ou cada cabelo.

## Contrato técnico atual

Fonte de verdade: `src/game/faces.ts`, constante `FACE_REGISTRATION`.

| Propriedade | Valor no atlas |
| --- | --- |
| Canvas | 1254 × 1254, RGBA, transparência real |
| Fonte das cinco pinturas atuais | `[375, 218, 531, 514]` — x, y, largura, altura |
| Destino universal da cabeça | `[425, 180, 420, 416]` |
| Pivô de pescoço | `[650, 610]` |
| Centro de referência do olho próximo | `[650, 444]` |
| Centro de referência do olho distante | `[798, 466]` |
| Nariz | `[760, 502]` |
| Região da boca | `[716, 542]` |
| Pose-base | Três quartos, olhando para a direita |

As âncoras delimitam regiões coerentes; o formato interno da pálpebra/boca muda com a expressão. Não transformar todos os olhos em elipses iguais. O giro para a esquerda e as poses são transformações do rig, não pinturas com medidas diferentes.

`public/assets/faces/manifest.json` documenta limites alfa medidos das fontes. Não usar esses limites para aumentar/diminuir cada cabeça separadamente. O registro comum preserva escala; o compositor preserva o shape.

## Composição obrigatória

1. Usar `character-base.png` como cabeça neutra universal.
2. Registrar a pintura nova no mesmo enquadramento das cinco fontes existentes.
3. Usar `composeUniversalHead()`; a pele/base e sua máscara definem o contorno final. A mesclagem facial muda somente o interior. Não desenhar o PNG novo cru sobre o personagem.
4. Preservar `source-atop` ou uma solução comprovadamente equivalente que mantenha o mesmo alfa, inclusive nas bordas suavizadas.
5. Usar `getFacePortrait()` tanto para o ícone quanto para o avatar. Não desenhar uma versão simplificada/emoji só para o inventário.
6. Adicionar o item ao slot `face`, validar posse no servidor e conservar os outros slots ao salvar.

A geração de imagens pode alterar bordas alguns pixels apesar do prompt. Por isso, uma instrução no prompt **não substitui** a máscara e a verificação no jogo. O compositor também não corrige olhos/boca desenhados fora de posição: inspecionar a montagem continua obrigatório.

## Qualidade artística

Pintura chibi com olhos detalhados, contornos castanhos consistentes, volume e sombras suaves, iluminação superior esquerda e pele da mesma família. Nenhum pixel art, círculo procedural como olho final, rosto frontal simétrico em cabeça 3/4, textura fotográfica, fundo, borda de card, texto, cabelo ou chapéu dentro do PNG do rosto.

Use a cabeça-base, `face-brave.png` e a prancha atual como referências. Não redesenhar outro personagem a cada expressão. Ícones devem permanecer legíveis em aproximadamente 47–68 px.

## Prompt-base para novas expressões

```text
Editar a cabeça-template fornecida do jogo. Alterar SOMENTE a feição interna para [EXPRESSÃO], com mudanças coerentes em pálpebras, sobrancelhas e boca. Preservar exatamente shape externo, crânio, orelha, bochecha, queixo, nariz, perspectiva em três quartos para a direita, pele, iluminação, escala, posição e canvas da referência. Manter as regiões de olhos, sobrancelhas e boca no mesmo registro universal. Não recortar, ampliar ou recentralizar a cabeça. Pintura chibi refinada, contorno castanho, volume suave, olhos detalhados. Mesma identidade visual da referência, expressão reconhecível em tamanho pequeno, sem depender de mudar a cor da íris. PNG RGBA com transparência real; sem cabelo, chapéu, óculos, pescoço, corpo, texto, moldura ou fundo. Canvas 1254×1254 e mesmo enquadramento da pintura facial de referência. Não criar pixel art, emoji ou formas geométricas simples.
```

Guardar prompt exato e referências em `docs/face-art-prompts.md`. Preservar os arquivos originais gerados; ajustes de composição devem ficar explícitos no renderer/metadados.

## Aceitação de um novo rosto

- `npm run check`, `npm test`, `npm run build` passam.
- `node scripts/verify-faces.mjs` inclui o novo item e confirma **zero diferenças de alfa** entre as cabeças compostas.
- Há diferenças reais de pintura facial; contorno idêntico sozinho não comprova qualidade.
- Inspeção montada com e sem cabelo, com boné/chapéu e óculos; sem costura de pele, olho cortado, boca fora da face ou mudança de proporção.
- Testar ambos os sentidos e poses de mira, caminhada, dano, deitado e vitória; o rosto acompanha a cabeça.
- Ícone e personagem correspondem; salvamento, recarga e outro cliente mostram o mesmo item.
- Não alterar o shape universal para aprovar um item isolado. Se for inevitável um novo rig de personagem no futuro, versioná-lo como contrato separado e produzir/validar toda a compatibilidade desse rig.
