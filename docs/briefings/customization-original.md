# PROMPT — SISTEMA COMPLETO DE PERSONALIZAÇÃO E EQUIPAMENTOS ESTILO DDTANK

Você é um **diretor de desenvolvimento de jogos com mais de 15 anos de experiência**, especializado em jogos 2D, personagens modulares, animações, sistemas de equipamentos, personalização visual e efeitos especiais.

Sua missão é criar e coordenar uma equipe de agentes especialistas para implementar no meu jogo um **sistema completo de personalização de personagens e armas, com funcionamento equivalente ao DDTank clássico**.

## 1. CRIAÇÃO DOS AGENTES ESPECIALISTAS

Crie agentes com especializações distintas:

- **Character Customization Specialist:** responsável pelo sistema de personalização, troca de equipamentos e combinações visuais.
- **2D Character Artist:** responsável pela qualidade artística dos personagens, roupas, cabelos, olhos e acessórios.
- **Character Animation Specialist:** responsável pelas animações e pela adaptação dos equipamentos aos movimentos.
- **Equipment System Engineer:** responsável pelo catálogo, slots, regras de equipamentos e integração com inventário.
- **Weapon & VFX Specialist:** responsável pelas armas, animações de disparo, projéteis, efeitos especiais e explosões.
- **Game UI/UX Specialist:** responsável pela interface de personalização, inventário e pré-visualização.
- **QA & Integration Specialist:** responsável por testar todas as combinações, validar o funcionamento e corrigir defeitos.

Os agentes devem analisar o projeto atual, planejar suas responsabilidades e implementar as funcionalidades diretamente nos sistemas existentes.

Não quero apenas documentação, exemplos isolados ou demonstrações visuais. Quero tudo integrado e funcional.

## 2. SISTEMA DE PERSONALIZAÇÃO IGUAL AO FUNCIONAMENTO DO DDTANK

Implementar um sistema de personalização inspirado no funcionamento do DDTank, permitindo modificar individualmente a aparência do personagem.

Categorias obrigatórias:

- Olhos.
- Expressões faciais.
- Sobrancelhas.
- Boca.
- Cabelos.
- Óculos.
- Bonés.
- Chapéus.
- Capacetes.
- Roupas.
- Calças.
- Sapatos.
- Luvas.
- Asas.
- Acessórios.
- Armas.
- Efeitos cosméticos especiais.

**REGRA FUNDAMENTAL:** cada item equipado precisa modificar visualmente o personagem de verdade.

Exemplo:

Se o jogador selecionar olhos azuis, o personagem deverá passar a utilizar aqueles olhos imediatamente.

Se trocar para olhos vermelhos, os olhos anteriores devem ser substituídos, mantendo todos os outros equipamentos.

Se equipar óculos, eles devem aparecer corretamente sobre os olhos.

Se equipar um boné, ele deve encaixar naturalmente sobre a cabeça e o cabelo.

Se equipar uma roupa, o corpo deverá apresentar a nova roupa, mantendo as proporções e a identidade visual.

Todos esses itens precisam funcionar simultaneamente, sem conflitos visuais.

## 3. QUALIDADE ARTÍSTICA DOS PERSONAGENS

Os personagens devem apresentar a mesma categoria de acabamento artístico que tornou os avatares do DDTank reconhecíveis.

Características:

- Estilo chibi 2D.
- Cabeças proporcionalmente grandes.
- Corpos compactos e expressivos.
- Olhos grandes e detalhados.
- Roupas com volume e acabamento.
- Cabelos com formas bem definidas.
- Acessórios harmonizados.
- Contornos consistentes.
- Cores vibrantes.
- Sombras e iluminação suaves.
- Animações expressivas.

Não criar bonecos genéricos, personagens geométricos simples ou acessórios que pareçam apenas imagens coladas sobre o corpo.

Todos os equipamentos devem parecer parte natural do personagem.

A direção artística deve ser original, mantendo o charme e a riqueza visual característicos do gênero.

## 4. SISTEMA DE EQUIPAMENTOS E CAMADAS

Desenvolver um sistema capaz de combinar todos os equipamentos no mesmo personagem.

Cada item deverá ter seu próprio encaixe visual.

O sistema precisa controlar automaticamente:

- Posição do equipamento.
- Tamanho e proporção.
- Ordem de sobreposição.
- Rotação.
- Movimento.
- Compatibilidade com outros itens.
- Visibilidade das partes do corpo.
- Adaptação às animações.

Exemplo: ao equipar um capacete, determinadas partes do cabelo poderão ficar escondidas.

Ao equipar óculos e chapéu simultaneamente, ambos precisam aparecer corretamente.

Ao trocar uma camiseta, apenas a camiseta deve mudar.

Nenhuma personalização poderá provocar perda dos demais equipamentos.

## 5. EQUIPAMENTOS DURANTE O COMBATE

A aparência personalizada do personagem deve continuar exatamente igual durante as batalhas.

Implementar compatibilidade com:

- Personagem parado.
- Caminhada.
- Mira.
- Preparação do disparo.
- Disparo.
- Recuo da arma.
- Recebimento de dano.
- Quedas.
- Personagem inclinado sobre o terreno.
- Personagem deitado.
- Vitória.
- Derrota.

**ATENÇÃO ESPECIAL:** assim como no combate do DDTank, os personagens podem ficar inclinados ou deitados conforme o terreno e as situações de batalha.

Todos os equipamentos devem acompanhar corretamente a posição e as animações, sem se separarem do corpo.

Os olhos, óculos, cabelos, bonés, roupas e armas precisam permanecer visualmente encaixados.

Não basta rotacionar o personagem inteiro caso isso produza resultados artificiais. Desenvolva as poses necessárias para manter a qualidade artística.

## 6. SISTEMA DE ARMAS COM IDENTIDADE VISUAL

Criar um sistema de armas com variedade visual e comportamentos individuais, inspirado na diversidade de armamentos do DDTank.

Cada arma deverá ter:

- Aparência própria.
- Posição correta nas mãos.
- Animação de preparação.
- Animação de disparo.
- Efeito visual de lançamento.
- Projétil correspondente.
- Efeito de impacto.
- Explosão própria.
- Efeitos sonoros associados.
- Características de combate configuráveis.

As armas precisam ser visualmente diferentes, e não apenas variações de cor do mesmo objeto.

### Exemplos de armas

**Arma de fogo:** projétil com rastro de fumaça, clarão no disparo e explosão no impacto.

**Arma de gelo:** projétil com partículas congeladas, efeito de cristalização e explosão gelada.

**Arma elétrica:** projétil energizado, raios elétricos, faíscas e efeito elétrico de impacto.

**Arma de fogo mágico:** disparo flamejante, partículas incandescentes e explosão com labaredas.

**Arma lendária:** efeitos visuais mais elaborados, animação especial de disparo, projétil exclusivo e impacto marcante.

Os exemplos servem como referência. Os agentes devem criar uma estrutura que permita adicionar novas armas e efeitos sem precisar reconstruir o sistema.

## 7. SISTEMA DE VISUALIZAÇÃO EM TEMPO REAL

Criar ou aprimorar a interface de personalização existente.

O jogador deverá conseguir:

1. Visualizar seu personagem completo.
2. Selecionar uma categoria de equipamento.
3. Examinar os itens disponíveis.
4. Pré-visualizar um item antes de equipá-lo.
5. Equipar o item.
6. Visualizar a alteração imediatamente.
7. Remover um equipamento.
8. Restaurar a aparência anterior.
9. Salvar sua personalização.

A pré-visualização deve corresponder fielmente à aparência apresentada durante as batalhas.

Não utilizar uma representação simplificada diferente do personagem real.

## 8. SISTEMA DE RARIDADE E EFEITOS COSMÉTICOS

Preparar os equipamentos para diferentes raridades:

- Comum.
- Incomum.
- Raro.
- Épico.
- Lendário.

Itens raros e superiores poderão possuir características visuais especiais.

Exemplos:

- Olhos com brilho animado.
- Óculos com reflexos.
- Cabelos com partículas.
- Chapéus com pequenas animações.
- Roupas com efeitos luminosos.
- Asas animadas.
- Armas com auras.
- Efeitos exclusivos ao disparar.

Os efeitos devem acompanhar os personagens durante o movimento e permanecer visualmente consistentes.

A raridade não deve obrigatoriamente determinar a força do equipamento.

## 9. PERSISTÊNCIA E MULTIPLAYER

A personalização precisa funcionar para todos os jogadores.

Quando alguém equipar um item:

- A alteração deve ser salva.
- O equipamento deve permanecer após sair e entrar no jogo.
- Outros jogadores devem visualizar a aparência correta.
- A aparência deve ser carregada nas batalhas.
- As armas equipadas devem apresentar seus respectivos efeitos.
- O sistema deve impedir o uso de itens que o jogador não possui.

Utilizar os sistemas existentes do projeto, evitando criar estruturas redundantes.

## 10. SISTEMA EXTENSÍVEL DE CONTEÚDO

O sistema deve permitir adicionar centenas ou milhares de equipamentos futuramente.

Criar uma estrutura padronizada para cadastrar novos:

- Olhos.
- Cabelos.
- Roupas.
- Chapéus.
- Óculos.
- Acessórios.
- Armas.
- Efeitos especiais.

A adição de um novo item não pode exigir modificações extensas no código principal.

Sempre que possível, novos equipamentos devem ser cadastrados por meio de suas definições, recursos visuais e configurações.

## 11. IMPLEMENTAÇÃO REAL E TESTES

Os agentes deverão:

1. Inspecionar todo o projeto existente.
2. Identificar o personagem atual e seu sistema de renderização.
3. Identificar inventário, equipamentos e animações existentes.
4. Definir como integrar a personalização sem quebrar funcionalidades.
5. Implementar os sistemas necessários.
6. Criar recursos visuais originais ou adaptar os recursos já existentes.
7. Implementar a troca visual real dos equipamentos.
8. Integrar as animações.
9. Implementar o sistema de armas e seus efeitos.
10. Integrar a persistência e sincronização.
11. Testar combinações de equipamentos.
12. Validar o funcionamento em combate.
13. Corrigir problemas de encaixe e animação.
14. Verificar desempenho e estabilidade.

### Testes obrigatórios

- Trocar os olhos e verificar alteração visual.
- Equipar óculos e boné simultaneamente.
- Trocar roupas sem modificar o rosto.
- Trocar armas e verificar o novo sprite.
- Disparar diferentes armas e verificar seus efeitos individuais.
- Inclinar o personagem com todos os equipamentos.
- Testar personagem deitado.
- Verificar animações de dano.
- Salvar e recarregar o personagem.
- Verificar a aparência de outro jogador no multiplayer.

## 12. CRITÉRIOS DE ACEITAÇÃO

O trabalho somente estará concluído quando:

- A personalização realmente alterar os personagens.
- Todas as categorias implementadas funcionarem.
- Os acessórios estiverem corretamente posicionados.
- Os equipamentos acompanharem as animações.
- Os personagens permanecerem consistentes durante o combate.
- Cada arma demonstrar seu próprio efeito visual.
- A personalização funcionar na interface e nas batalhas.
- As alterações forem persistidas corretamente.
- Outros jogadores enxergarem os equipamentos.
- O sistema estiver preparado para novos itens.
- Não existirem erros relevantes de renderização, animação ou integração.

Não declare funcionalidades como concluídas sem implementá-las e validá-las.

## 13. ORIENTAÇÃO FINAL PARA A EQUIPE

**Nossa referência principal é a experiência do DDTank clássico: o jogador personaliza olhos, cabelos, roupas, acessórios e armas, e todas essas escolhas realmente se refletem no personagem durante o jogo.**

Não quero simplesmente uma interface que lista equipamentos, nem um boneco com acessórios sobrepostos de maneira improvisada.

Quero um sistema completo de personagens modulares com qualidade artística, comportamento consistente e efeitos de armas individualizados.

Os agentes devem atuar como uma equipe profissional de estúdio de jogos, respeitando a arquitetura atual e priorizando qualidade, manutenção, extensibilidade e desempenho.

**COMECE AGORA:** analise o projeto existente, organize os agentes, identifique o que já está implementado e inicie a implementação real do sistema de personalização e armas. Não interrompa o trabalho após o planejamento; avance para código, integração, testes e correções, dentro do ambiente disponível.
