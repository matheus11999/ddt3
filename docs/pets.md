# Pets

Infraestrutura completa de pets no estilo do DDTank (18/10/2026). O motor não traz conteúdo: os registros só ganham pets quando `shared/petContent.ts` é importado (servidor e cliente o importam primeiro; `tests/pets-empty.test.ts` confere o motor vazio). O conteúdo de teste vive em `tests/fixtures/pets.ts`.

## Verdália, o primeiro pet

Uma planta que evolui sozinha com o nível, como as armas por fase: **Broto** (nível 1), **Botão** (nível 20), **Flor** (nível 40). Conteúdo em `shared/petContent.ts`; números provisórios (matheus vai editar). Todo jogador ganha uma Verdália **uma vez**, já equipada e com 10 Adubo de Orvalho (`PET_GIFTS`, `Profile.petGifts`, `PetService.gift` ao conectar).

| Habilidade | Tipo | O que faz |
| --- | --- | --- |
| Raízes da Terra | passiva, inata (não ocupa slot) | depois do último projétil do tiro do dono, a terra ataca onde o primeiro projétil caiu: dano em área (`area-damage`, gatilho `shot-end`), sem projétil, número de dano próprio; raio e dano crescem com o estágio (`stageScaling`), arte `roots-{estágio}.png` |
| Orbe da Natureza | ativa | o próximo tiro vira uma bola verde (`special-shot`): um projétil só, sem ferramentas, POW, voo ou mira assistida no turno (bloqueados), dano sempre crítico × multiplicador do estágio |
| Orvalho Curativo | ativa, nível 10 | cura % da Vida no **começo** de cada um dos próximos 3 turnos do dono (`hot` com `at: 'turn-start'`) |

- Estágio: `evolveByLevel` troca o estágio quando o nível passa do requisito (`PET_EVOLVED`); com `stageScaling`, o nível da habilidade em batalha é o estágio + 1.
- No servidor: `Game.resolveFire` (tiro especial e o ataque das raízes, `PendingImpact.petStrike`, índice 1000 nos eventos de impacto) e `Game.petStrike`. No cliente: `src/game/petEffects.ts` desenha o efeito em área (nasce do chão), a cura e o projétil/impacto do orbe.
- Arte: gerada pelo Codex no PC do usuário a partir da referência dele (`/mnt/project-files/pets/planta/`, prompts em `prompts/`), sobre magenta, recortada por `python3 scripts/cut-pet-sheet.py` (modos `pieces` e `grid`) para `public/assets/pets/verdalia/`.

## Camadas

| Camada | Onde | O que é |
| --- | --- | --- |
| Configuração | `shared/petConfig.ts` (`PET_CONFIG`, validado por zod) | limites (20 pets, 1 equipado), nome, curva de EXP, nível máximo 60, fontes de EXP, vitalidade e eficiência, estrelas, 4 slots de habilidade e níveis de desbloqueio, 3 slots de equipamento (desligados), evolução (desligada), magia em batalha, limites anti-loop |
| Definição (`PetDefinition`) | `shared/pets.ts`, registro `PET_SPECIES` | espécie: qualidades permitidas, base, crescimento por nível, bônus por estrela, estágios, habilidades e em que nível liberam, faixa de traços, visual |
| Qualidade | `PET_QUALITIES` | raridade (Comum, Normal, Raro, Épico, Lendário) com multiplicador; independente de estrelas e estágio |
| Habilidade | `shared/petSkills.ts`, registro `PET_SKILLS` | ativa, passiva, permanente ou condicional; níveis com custo, recarga, chance, efeitos, atributos e Delay; gatilhos, condições, requisitos, modos, limites |
| Alimento | `PET_FOODS` (`pet-food-*`) | contrato: vitalidade, EXP, espécies, nível mínimo, máximo por uso, limite diário, ícone. A posse fica em `Profile.petFood` |
| Instância (`PlayerPet`) | tabela `player_pets` | o pet do jogador: espécie, nome, nível, EXP, qualidade, estrelas, estágio, vitalidade, traços, habilidades conhecidas e nos slots, travado, equipado |
| Estado de batalha (`BattlePetState`) | `Fighter.pet` | magia, recargas, usos e efeitos ativos (`Fighter.petEffects`); criado no início da partida, salvo com a partida (live state) |

## Atributos e FC

O pet equipado entra no equipamento como `Equipment.pet` (um `PetSnapshot` que só o servidor escreve, `PetService.wear`). `attributes()` em `shared/catalog.ts` soma `petContribution(snapshot)`, então Ataque, Defesa, Agilidade, Sorte, Dano, Armadura, Vida e Vigor do pet aparecem na mochila, na sala, no Poder (FC) e no combate pelo mesmo caminho do resto do equipamento. Nunca some FC à parte.

- Contribuição = (base + crescimento × (nível − 1) + traços) × qualidade × (1 + bônus por estrela) × fator de vitalidade, mais os atributos das habilidades **permanentes** nos slots.
- Vitalidade (0 a 100): 75–100 rende 100%, 50–74 75%, 25–49 50%, 1–24 25%, 0 deixa o pet inativo (não luta e não soma nada).
- Buffs temporários de batalha ficam em `Equipment.battleBuffs` só durante a partida (`combatEquipment`) e nunca são salvos no perfil.

## Batalha

- O pet entra se estiver equipado, com vitalidade > 0 e o modo liberado (`PET_CONFIG.battles`: PvP e PvE sim, treino não). `armPets` tira o retrato no lançamento da partida (sala e expedição); trocar de pet no meio da partida é recusado.
- Magia começa em 30, máximo 100, +10 por turno. Habilidade ativa pelo comando `pet-skill` no próprio turno, com custo, recarga e Delay. Passivas respondem a gatilhos (`PET_TRIGGERS`).
- Bônus de tiro valem uma vez **por tiro** (não por projétil), então +1, +2, Tridente e 50% continuam corretos. Escudos absorvem depois dos multiplicadores de defesa.
- Anti-loop: cadeia máxima 2, até 12 ativações por ação, a habilidade não reage a si mesma e só reage a outra habilidade com `allowFromSkills`; limites `perTurn`, `perShot`, `perBattle`.
- Fim da partida: `PetService.settleBattle` aplica EXP e custo de vitalidade uma vez por (partida, pet) via `pet_battle_results`, mesmo com entregas repetidas.
- Eventos para o cliente: `pets`, `pet-result`, `pet-effect`. A barra de habilidades (`PetSkillBar`) só aparece com pet que tem habilidade ativa.

## Banco

Migrações versionadas em `PET_MIGRATIONS` (`server/pets.ts`), aplicadas uma vez com trava (`pet_migrations` + advisory lock):

1. `player_pets` (CHECKs de nível, vitalidade, estrelas, nome; FK para `players` com cascade; índices por dono e por equipado; o limite de equipados é checado na transação), `pet_events` (auditoria de domínio, mantida após soltar o pet), `pet_feedings` (limite diário por dia de Brasília), `pet_battle_results` (PK `battle_id, pet_id`).

Toda operação roda em transação por dono: trava a linha de `players`, depois os pets, grava diferenças, perfil e eventos juntos.

## Comandos

`pet-list`, `pet-equip`, `pet-unequip`, `pet-rename`, `pet-lock`, `pet-release` (exige `confirm: true` e o nome digitado; pet travado ou equipado não sai), `pet-feed`, `pet-skill-slot`, `pet-skill`. Fora de `pet-list` e `pet-skill`, todos são recusados durante uma partida.

## Como registrar a primeira espécie

1. **Habilidades**: em um arquivo de conteúdo novo (por exemplo `shared/petContent.ts`), chame `registerPetSkill({...})` para cada habilidade. Os dados são validados por `petSkillSchema`; use `tests/fixtures/pets.ts` como exemplo de forma.
2. **Espécie**: `registerPetSpecies({id, name, enabled: true, qualities, maxStars, base, growth, starBonus, skills: [{skill, level}], visual})`. Habilidades citadas precisam estar registradas antes. Com `enabled: false` a espécie existe mas não pode ser concedida.
3. **Alimentos** (opcional): `registerPetFood({id: 'pet-food-...', name, vitality, xp, maxPerUse, dailyLimit, icon})`. Para vender, ligue o id à loja; a posse é `Profile.petFood[id]`.
4. **Carregar o conteúdo**: importe `shared/petContent.ts` uma vez em `server/index.ts` e em `src/main.tsx` (cliente e servidor precisam ver os mesmos registros).
5. **Arte**: retrato, sprite ou atlas em `public/assets/pets/<id>/`, apontados em `visual`. Sem arte o jogo mostra a pata no retrato e não desenha nada em campo (`src/game/petSprite.ts`). Gerar pelo Codex como as outras artes; nada de texto na imagem.
6. **Obtenção**: chame `PetService.grant(ownerId, speciesId, {source})` de onde o pet vier (loja, recompensa, correio, admin). Ele respeita o limite de 20, sorteia traços na faixa da espécie e grava o evento `PET_OBTAINED`.
7. **Testes**: teste o conteúdo num arquivo que importa `shared/petContent.ts` (exemplo: `tests/pets-verdalia.test.ts`) e rode `npm test` e `npm run test:pets:integration`.

## Testes

- `tests/pets-verdalia.test.ts`: presente único, evolução e liberação por nível, raízes na área, cura nos 3 começos de turno, ataque das raízes depois do tiro e orbe crítico de um projétil só no `Game`.
- `tests/pets-empty.test.ts`: motor sem conteúdo, pet desconhecido não soma nada, configuração validada.
- `tests/pets.test.ts`: serviço, vitalidade, EXP, slots, motor de habilidades (custo, recarga, chance, cadeia, por tiro, escudo) e integração com `Game` (batalha sem pet inalterada, retrato, troca recusada, habilidade no turno, reinício e reconexão, liquidação única, treino sem EXP).
- `npm run test:pets:integration`: Postgres real (migrações uma vez, persistência, alimentação concorrente, liquidação repetida, auditoria ao soltar).

## Pendências

- Botão pintado do menu (`public/assets/ui/pets-button.png`); hoje usa um ícone de pata dourado.
- Equipamento de pet e evolução estão modelados e desligados na configuração.
- Verdália: balancear números; som dos efeitos; número verde de cura; segunda habilidade ativa por slot (hoje Orbe e Orvalho ocupam os slots 1 e 2).
