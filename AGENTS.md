# Orientação para agentes

Leia primeiro `README.md`, `docs/implementation-status.md`, `docs/cloud-handoff.md` e `docs/continuation-prompt.md`. A instrução mais recente do usuário prevalece. Este checkpoint encerrou somente os rostos: **não retomar o backlog automaticamente** ao apenas inspecionar ou publicar o projeto.

## Regra obrigatória de novos rostos

Siga `docs/face-authoring-rules.md`. Todos os rostos devem ter exatamente o mesmo shape universal, tamanho, orientação e âncoras. Mudar a feição completa, nunca o contorno para acomodar cabelos. Ícones e avatar devem usar o mesmo compositor. Validar `scripts/verify-faces.mjs` e inspecionar o resultado montado antes de entregar. Não editar cada cabelo para compensar um rosto fora da medida.

## Coordenação quando a continuidade for solicitada

O usuário pediu agentes especialistas. Use subagentes por domínio, em rodízio quando necessário, sem criar chats separados. Defina propriedade dos arquivos e comunique contratos antes de editar código compartilhado.

| Papel | Responsabilidade |
| --- | --- |
| Integração / coordenador | Catálogo, protocolo, persistência, contratos, revisão e publicação; proprietário dos arquivos compartilhados |
| `face_artist` | PNGs/manifesto de rostos, prompts; preservar regra universal, sem alterar renderer por conta própria |
| `game_art` | Pintura de cabelos, roupas, chapéus e óculos; `public/assets/` exceto rostos/mapas; prompts/encaixes |
| `character_animation` (antes `upgrade_server`) | `avatar.ts`, `appearance.ts`, `faces.ts`, `Avatar.tsx`; rig, oclusão, tintura, dez poses |
| `forge_ui` | `Inventory.*`, `Forge.*`, `ItemIcon.tsx`, `ItemCard.*`, `UpgradeBadge.*`; ícones, menus, interações |
| `environment_engineer` | `shared/maps.ts`, física de mapas, `environment.ts`, assets/prompts de cenários; coordenar mudanças em `Scene.tsx` |
| `weapon_vfx` | `weaponEffects.ts`, `audio.ts`, efeitos por família/estágio; sprites em coordenação com artista |
| `qa_integration` | Persistência/protocolo, navegador, capturas, poses e combinações, revisão das limitações |

O agente `upgrade_server` também implementou fortalecimento/transações na primeira etapa. Os nomes são histórico de responsabilidades, não agentes que continuarão ativos na cloud. Não manter agentes editando após instrução de encerramento.

## Contratos

- Slots: arma, rosto, roupa completa, cabelo, chapéu, óculos, pulseira e bracelete. Joias invisíveis. Sem bolsa/acessórios/asas/anel ou olhos/boca separados.
- Roupa cobre do pescoço para baixo: mãos, calça e sapatos incluídos. Pose pode variar sem alterar a cabeça universal.
- `ENABLE_MODULAR_APPEARANCE=false` é intencional para corpos incompletos. Rostos estão ativos independentemente desse flag.
- Arte da arma: 0–8 / 9 / 10–11 / 12. Aura automática: 5 / 9 / 12. Pedras I–V sempre comuns.
- Jogo chibi pintado, com volume e contornos consistentes; sem pixel art ou SVG genérico apresentado como arte final. UI arredondada, coesa, com aspecto de jogo.
- Servidor valida intenção, posse, turno e recursos. Cliente não decide dano, chance, saldo, cratera ou sucesso de upgrade. Salvar em transações PostgreSQL.
- Preservar código existente e trabalho de outros agentes. Sem reconstrução desnecessária, reset, force push ou exclusão de diretórios para resolver conflitos.

## Verificação e entrega

Use `npm run check`, `npm test`, `npm run build` e testes de integração pertinentes. Para rostos: `node scripts/verify-faces.mjs` com Vite e inspeção da prancha. Para mapas: `scripts/inspect-maps.mjs`.

Após mudanças em `shared/`/`server/`, atualize o backend antes de testar o navegador. Documente evidências e pendências em `docs/implementation-status.md`; registre prompts e medidas dos assets. Não versionar segredos, `.env`, bancos, builds, `node_modules` ou resultados temporários. Nunca prometer milhares de jogadores a partir de um limite configurado.
