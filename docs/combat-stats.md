# Atributos, mira e dano — Brasa Arena

Contrato conferido em `shared/catalog.ts`, `shared/stats.ts`, `shared/combat.ts`, `shared/aim.ts`, `shared/physics.ts`, `shared/fall.ts` e `server/game.ts`. Desde 18/10/2026 atributos, fortalecimento, Vida, Vigor, dano, crítico e Delay seguem o perfil clássico do DDTank descrito em [Matemática dos atributos](attributes.md).

## Atributos compartilhados

`itemAttributes(item, level, composition)` e `attributes(equipment, level)` são usados na interface e no servidor. Ataque, Defesa, Agilidade, Sorte, Dano e Armadura são campos distintos. A soma inicial do personagem é Ataque 80, Defesa 30, Agilidade 50, Sorte 20 e Armadura 20; o dano base vem da arma.

```text
Poder do perfil = arredondar(6 × Ataque + 4 × Defesa + 3 × Agilidade
                            + 3 × Sorte + 3 × Dano + 2 × Armadura)
```

Rosto, cabelo e fantasia são visuais. Chapéu, roupa e joias podem conceder atributos conforme o catálogo; ocultar um item não remove seus atributos. O Poder do perfil é um índice comparativo, separado da carga Power do combate e da força escolhida na régua.

Exemplo verificável com `DEFAULT_EQUIPMENT` dos testes (Dragão de Brasa +0), nível 1: Ataque 236, Defesa 109, Agilidade 146, Sorte 105, Dano 230, Armadura 41, Vida 1010, Vigor 244, Delay base 1493 e Poder 3377. Contra o mesmo equipamento, com exposição 1, sem crítico ou ferramentas, `damageAtImpact` retorna **264**.

## Dano e crítico

Fórmulas em [Matemática dos atributos](attributes.md). O servidor arredonda apenas o resultado final, **sem mínimo de 1**. Dano bruto abaixo de 0,5 arredonda para zero, inclusive resíduos numéricos na borda da explosão. Um resultado zero não reduz HP, não aparece em `ShotHit` e não carrega Power. O dano efetivamente aplicado é limitado à vida restante; é esse valor que entra no evento e na carga Power. O sorteio do crítico ocorre no servidor por impacto/alvo elegível, não pela animação; `ShotHit.critical` informa o resultado autoritativo.

### Acerto direto, raspão e explosão próxima

A colisão é varrida ao longo do deslocamento do projétil, incluindo o raio próprio da arma. A hitbox do personagem usa círculo de raio **22** (antes 24), centrado em `(x, y - 31)`. O contato direto usa uma qualidade `q` entre 0 e 1, derivada da passagem da linha do tiro pela hitbox expandida pelo raio do projétil.

| Contato | Condição | Exposição |
| --- | --- | --- |
| Direto (`direct`) | Projétil tocou esse alvo e q ≥ 0,65 | 0,84 + 0,16q |
| Raspão (`graze`) | Tocou esse alvo e q < 0,65 | 0,84 + 0,16q |
| Explosão próxima (`splash`) | Alvo não foi o contato direto | 0,82 × [1 − (1 − q)^1,5] |

Para splash, `distância = max(0, distância do impacto ao centro da hitbox - 22)`, `raio = blast × 0,60` e `q = max(0, 1 - distância / raio)`. Portanto o alcance é medido **a partir da borda da hitbox**, não dos pés nem só do centro. Na borda externa da explosão, q = 0 e o dano é zero. Splash no seu melhor ponto tem 82% de exposição, sem piso artificial. A 25%, 50% e 75% do raio a partir da hitbox, a exposição é aproximadamente 71,75%, 53% e 28,7% do dano pleno, antes de defesa, crítico e ferramentas. Um impacto no chão exatamente sob um personagem de pé, a 31 unidades do centro da hitbox, fica perto de 78% com Dragão de Brasa +0. O raspão agora parte de 84%; contato e explosão mantêm uma transição sem queda brusca.

Uma explosão calcula exposição, defesa, crítico e dano **separadamente para cada alvo**. Acertar dois inimigos próximos não divide o dano entre eles. O contato direto pode receber mais dano que o segundo alvo alcançado pelo splash; se esse segundo estiver apenas na borda, seu dano pode arredondar para zero. O ajuste aumenta o dano de quem realmente estiver dentro da explosão, enquanto reduz um pouco tanto a colisão direta quanto o alcance da explosão.

`ShotHit.kind` também pode ser `fall` quando a destruição deixa o personagem sem terreno e ele cai fora do mapa. Essa perda de vida não recebe crítico.

## Ferramentas e cadência

Regras completas em [power-ups.md](power-ups.md) (`shared/powerUps.ts`).

```text
multiplicador por impacto = modo do disparo × (1 + soma dos bônus de dano)
modo: normal 1,00 · +1 0,90 (2 disparos seguidos) · +2 0,60 (3 seguidos) · Tridente 0,50 (3 juntos)
ângulos do Tridente = ângulo escolhido + [-9°, 0°, +9°]
```

O intervalo entre disparos seguidos é `VOLLEY_CADENCE_MS` (570 ms); projéteis do mesmo leque saem juntos.

## Relógio e terreno autoritativos

A simulação calcula os contatos em ordem, considerando a alteração do terreno pelos impactos anteriores. A velocidade visual/temporal usa `PROJECTILE_SPEED_SCALE = 1,18`, preservando o arco balístico. Cada projétil carrega `flightTime` explícito em milissegundos; não derivar sua duração de `points.length / 60`.

`Shot.startedAt + projectile.delay + projectile.flightTime` define o momento do impacto. O evento inicial `shot` não aplica dano: `hits` começa vazio. Ao chegar o momento, o servidor altera HP, cratera e posição e publica `impact {shotId, projectileIndex, at, hits}`. `Shot.impacted` evita reaplicar um contato; `Battle.activeShot` permite recuperar a apresentação na reconexão. O cliente interpola índices fracionários, sem decidir dano, crítico ou cratera.

A cratera usa o raio da arma e a flag de destrutibilidade da região; cristal, pedra, metal e terra quebram igual (decisão do usuário em 17/10/2026). Um acerto em cheio num jogador também cava, só que menos: `DIRECT_HIT_DIG` (75% da profundidade da cratera), sob os pés do alvo (`impact.dig`). O buraco é uma bacia rasa com pelo menos `DIRECT_HIT_HALF_WIDTH` (46 px) para cada lado dos pés (`stretch`), porque um buraco redondo de 75% ficava inteiro escondido atrás do corpo (cerca de 70 px) e parecia que o tiro não cavou. O raio visual de explosão e o raio da cratera não são intercambiáveis. Voo é um projétil de deslocamento sem dano ou cratera; ver [Habilidades](abilities.md).

## Queda depois de crateras ou caminhada

No impacto, o servidor resolve o novo apoio e publica `Fighter.y` e HP autoritativos. Uma descida de pelo menos 9 unidades recebe também `Fighter.fall`, que descreve o percurso visual até essa posição final. A simulação antecipada em cópia não altera a posição publicada nem inicia uma animação antes do contato.

```ts
interface FighterFall {
  fromY: number;
  toY: number;
  startedAt: number; // relógio do servidor, em ms
  duration: number;  // ms
  velocity: number;  // velocidade inicial para baixo, unidades/s
  void: boolean;
}
```

`shared/fall.ts` concentra `createFall`, `fallDuration`, `fallPosition` e `fallVelocity`. A gravidade é **1800 unidades/s²**, com posição `fromY + velocity × t + 0,5 × 1800 × t²`, limitada ao destino. O cliente usa esses mesmos helpers e o relógio sincronizado, sem acrescentar outra curva de suavização. Uma nova cratera durante a queda recomeça do ponto visual atual e preserva a velocidade, evitando saltos. Ao voltar a caminhar ou assentar, metadata de uma queda já concluída é removida; uma queda ainda ativa no mesmo apoio é preservada.

Quedas fora do cenário terminam em `WORLD.height + 150` para o corpo sair inteiro. HP zero e derrota continuam sendo decisões do servidor no impacto ou passo que tirou o apoio. O corpo pode continuar visível durante a queda; a apresentação do resultado aguarda seu término antes dos três segundos de resultado. Em descidas não letais durante um tiro, `resolveAt` espera também a aterrissagem antes de trocar o turno.

Durante uma queda ativa no próprio turno, o servidor rejeita andar, mirar, atirar, passar, usar ferramentas, Power, habilidades e voo **antes de consumir recursos**. Após o pouso, as ações voltam a seguir as validações normais. A reconexão recebe o mesmo percurso e timestamp; inimigos invisíveis têm o campo `fall` removido. Aterrissar por voo limpa qualquer metadata anterior de queda.

## Mira relativa ao terreno

`terrainAimOffset` estima o apoio próximo aos pés e considera a direção do personagem. A inclinação resultante é limitada a **−30°…+30°**. Esse deslocamento é somado aos limites próprios da arma e o resultado permanece dentro do envelope global **5°…90°**:

| Arma | Limites em terreno plano |
| --- | --- |
| Dragão de Brasa | 15°–85° |
| Tempestade | 15°–80° |
| Flor de Cristal | 20°–85° |
| Cesto de Pavio | 15°–85° |

Ao caminhar, inverter a direção, aterrissar ou mudar o apoio por uma cratera, o servidor recalcula `aimSlope` e preserva a elevação relativa quando possível. `aim` e `fire` sempre passam pelo clamp autoritativo. A régua, os controles e o ângulo da arma devem usar esses mesmos limites.

## Carga Power

Power começa em 0 e vai até 100. O ganho usa HP efetivamente perdido por um inimigo, nunca dano excedente: atacar concede `dano / HP máximo do alvo × 60`; receber concede `dano / HP máximo × 100`, limitado a 100.

Com carga cheia, vivo e no próprio turno, o comando `power` consome a carga e arma o próximo tiro. A animação central dura 1400ms antes do lançamento; o tiro recebe ×1,65 de dano, ×1,15 no raio de explosão e ×1,05 na cratera. Voo e Power não combinam. A validação e a transição de turno continuam no servidor.

## Progressão e composição

Nível máximo 70, mantendo 300 EXP por nível. A barra de experiência fica completa no nível 70. Badges usam seis faixas: 1–10 cinza, 11–20 verde, 21–30 azul, 31–40 bronze, 41–50 prata e 51–70 dourado. Aura aparece desde 30, com novas camadas no 40, 50, 60 e 70. Essa progressão é separada do fortalecimento +5/+9/+12 da arma.

Composição aplica o melhor tier de cada atributo por equipamento, sem somar tentativas repetidas do mesmo atributo: 10, 20 ou 30 pontos de Ataque, Defesa, Agilidade ou Armadura. É permitida em arma, chapéu, roupa, pulseira e bracelete válidos. Trocar o item retira seus bônus dos totais; equipá-lo novamente os restaura. `equipment.compositions` é derivado do perfil bloqueado no servidor e não aceita pontos enviados pelo cliente.

## Referências e verificação

- [VFX de armas](weapon-vfx.md): estágios, índices fracionários, dano normal/crítico e limites de renderização.
- [Habilidades](abilities.md) e [arte de habilidades](ability-art-prompts.md): contratos e efeitos de cura, mira assistida, invisibilidade e voo.
- `tests/combat-stats.test.ts`, `tests/combat-rules.test.ts`, `tests/combat-playback.test.ts`, `tests/aim.test.ts` e `tests/abilities.test.ts` cobrem atributos, contato, crítico, relógio, mira e habilidades, incluindo dois alvos próximos e ausência de microdano artificial.
- `tests/fall.test.ts` cobre início no impacto, continuidade de velocidade, vazio, reconexão, privacidade, bloqueio de ações até pousar e limpeza de metadata encerrada.
