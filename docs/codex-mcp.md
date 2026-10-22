# Codex como ferramenta MCP no Claude Code

No PC do matheus (Remote Control em `D:\APPS\ddt`) o Codex CLI aparece para o Claude Code como ferramentas MCP. O objetivo é diminuir o erro na geração de arte: toda imagem sai com o molde e as peças aprovadas anexados, as regras do projeto e uma conferência automática do arquivo.

## Por que um servidor próprio

O app Codex (0.163) tirou o subcomando `codex mcp-server`, e o `codex` do npm (0.128) não lê a `~/.codex/config.toml` atual (`service_tier = "default"`). Por isso o servidor é um script local, só stdio, sem porta e sem túnel: `C:\Users\Alienware\.claude\mcp\codex-mcp.mjs` (cópia versionada em `scripts/codex-mcp.mjs`; ao mudar, copie de volta para a pasta do usuário). Ele chama o `codex.exe` mais novo de `%LOCALAPPDATA%\OpenAI\Codex\bin\*\` (ou `CODEX_BIN`) e usa o `sharp` do projeto para conferir as imagens.

Registro (escopo de usuário, vale para toda sessão nova):

```
claude mcp add codex -s user -- node C:\Users\Alienware\.claude\mcp\codex-mcp.mjs
```

## Arte do jogo: `codex_image` e `codex_image_fix`

- `codex_image` gera **uma** imagem. Recebe o brief (`prompt`, `prompt_file` ou `job_dir` com `prompt.txt`), as referências (`refs` na ordem IMAGE 1..N, `refs_file`, ou `refs.txt` do `job_dir`; primeiro o molde, depois as aprovadas), `output` (caminho exato do PNG), `background` (`alpha` padrão, `magenta` para folhas de peças de mapa e pet, `opaque` para fundos) e `size` opcional.
- Antes de gerar ele **recusa** se faltar referência, se alguma não existir ou se o prompt mandar salvar em outro caminho. No prompt ele lista os anexos por nome (IMAGE 1 = `docs/templates/...`) e junta as regras do projeto (pintado estilo DDTank, sem texto na imagem, nada além do brief) e a regra de fundo.
- Depois confere: arquivo novo no caminho pedido, PNG, tamanho, fundo transparente sem magenta ou cantos magenta, e se não é cópia de uma referência. A versão anterior vai para `.versions/` ao lado, o prompt final para `<saída>.prompt.txt` e o histórico (thread do Codex, referências, correções) para `<saída>.codex.json`.
- As pastas de `node scripts/cosmetic-prompts.mjs --set=<id>` (sem `--run`) já servem como `job_dir`: `test-results/codex-cosmetics/<set>/<peça>`.
- `codex_image_fix` (`output` ou `job_dir`, `prompt` com só o que mudar, `refs` novas opcionais) continua a **mesma conversa** do Codex, que lembra o brief, as referências e a imagem anterior, e confere de novo.
- `model`/`reasoning_effort` escolhem o modelo que conduz o Codex; a ferramenta de imagem é sempre a do Codex.
- Passar na conferência não é aprovação: abra a imagem, rode o validador da área (`verify:cosmetics`, `verify:weapons`, `build:map`) e mostre ao matheus.

## Kit de personagem (rig v2), aprovado pelo matheus em 22/10

O que funcionou no kit masculino v5 (scripts em `scripts/kit-v5/`, rodados a partir de `output/`):

1. **Moldes neutros** só com as medidas das folhas do DDTank (cabeça verde, corpo cinza, pele bege pela máscara de pele da roupa, sem sombra): `molds-show-game.py`, `molds-virtual.py`. Nunca anexar a arte original do DDTank.
2. **Um boneco inteiro aprovado primeiro** (proporções dos prints do DDTank), depois pintado sobre o molde da mochila.
3. **Camadas por edição**: pedir ao Codex a mesma imagem sem o cabelo (ou com o boné), alinhar pelo corpo (`align.py`, o Codex mexe um pouco a escala) e tirar a diferença (`split-layers.py`). Pintar cabelo ou chapéu sozinhos nunca encaixa.
4. **Combate e praça** em pranchas 3x2 ou faixas ampliadas 4x das poses únicas do molde (`batches-game.py`, `batches-virtual.py`), o Codex pinta só o corpo e mantém a cabeça verde.
5. **Cabeça por célula pelo crânio careca**: caixa do crânio na caixa verde do molde, queixo na base dela (`build-rig.py`); cabelo e chapéu seguem a mesma transformação. Pela largura do cabelo a cabeça sai pequena e solta.
6. Publicar com `scripts/rig/publish.py`, clipe do chapéu com `scripts/rig/hatclip.py`, conferir com `node scripts/rig/preview-rig.mjs m` (desenho do próprio jogo).

## Conversa livre: `codex` e `codex_reply`

`codex` abre uma conversa (devolve a resposta, o `thread_id` e as imagens novas dessa conversa em `~/.codex/generated_images/`) e `codex_reply` continua pelo `thread_id`. Para arte prefira `codex_image`.

## Regras

- **Uma tarefa por vez no PC inteiro**: o servidor recusa com "Codex ocupado" enquanto outra chamada roda (trava em `%TEMP%\codex-mcp.lock`). Ele não enxerga `codex exec` lançado à mão nem o matheus gerando no app; pergunte antes se ele disse que está gerando.
- Uma imagem por chamada (~2 min, limite de 15 min).
- Só no PC do usuário: sessões na nuvem não têm o Codex.
