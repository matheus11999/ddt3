import {WEAPONS,weaponAssetPath,weaponIconPath} from './catalog';
import type {BoostId,Weapon} from './catalog';
import {DESTRUCTION_STAGES,destructionMarkPath,destructionProfileId,destructionProfiles,MARK_ART} from './destruction';
import type {DestructionMode,DestructionStage} from './destruction';
import {CRATER_MASKS} from './physics';

/**
 * Weapon kit: everything one weapon needs to feel unique, DDTank style.
 * Each weapon has its own art per visual phase (icon, held art, projectile, launch, impact),
 * its own terrain mark and its own sounds. `npm run verify:weapons` checks this contract,
 * reports what is missing and writes ChatGPT/ElevenLabs prompts for every gap.
 * Paths are conventions under public/assets/weapons/<id>/: drop a file with the expected name and
 * both the validator and the game pick it up.
 */

/** Visual phases follow `weaponVisualStage()`, like DDTank: +0 to +9, +10 and +11, +12 to +14, +15. */
export const WEAPON_PHASES=[
 {stage:0,label:'+0 a +9',tier:0},
 {stage:10,label:'+10 e +11',tier:1},
 {stage:12,label:'+12 a +14',tier:2},
 {stage:15,label:'+15',tier:3}
] as const;
export type WeaponPhase=typeof WEAPON_PHASES[number]['stage'];

/**
 * POW × Tridente, per weapon.
 * - livre: POW and the Tridente tool combine.
 * - exclusivo: the weapon cannot fire POW and Tridente in the same shot.
 * - pow-tridente: this weapon's POW already fires the three-way spread; the tool is redundant.
 * - pow-unico: POW is one single projectile; Tridente, +1 and +2 do not combine with it.
 */
export type PowTridentRule='livre'|'exclusivo'|'pow-tridente'|'pow-unico';

export const PHASE_ART_SLOTS={
 icon:{label:'Ícone',size:[512,512]},
 held:{label:'Arma na mão',size:[1254,1254]},
 projectile:{label:'Projétil',size:null},
 muzzle:{label:'Disparo',size:null},
 impact:{label:'Impacto',size:null},
 powProjectile:{label:'Projétil do POW',size:null},
 powImpact:{label:'Impacto do POW',size:null}
} as const;
export type PhaseArtSlot=keyof typeof PHASE_ART_SLOTS;
export const WEAPON_ART_SLOTS={terrain:{label:'Marca no cenário'}} as const;
export const WEAPON_SOUND_SLOTS={
 fire:{label:'Som de disparo',seconds:1.2},
 flight:{label:'Som do projétil em voo',seconds:1.5},
 impact:{label:'Som de colisão',seconds:1.6},
 terrain:{label:'Som do cenário quebrando',seconds:1.4}
} as const;
export type WeaponSoundSlot=keyof typeof WEAPON_SOUND_SLOTS;

/** Row of the 4 × 3 effect atlas `effects.png` (columns are the phases). */
export const ATLAS_ROWS:Record<'projectile'|'muzzle'|'impact',number>={projectile:0,muzzle:1,impact:2};
export const ATLAS_SIZE=[1448,1086] as const;
/** Row of the 4 × 2 POW atlas `pow.png`: the POW shot always looks different from the normal one (user rule, 18/10/2026). */
export const POW_ATLAS_ROWS:Record<'powProjectile'|'powImpact',number>={powProjectile:0,powImpact:1};
export const POW_ATLAS_SIZE=[1448,724] as const;

export interface PhaseBrief {
 /** What the weapon looks like in this phase. */
 held:string;
 /** The ammunition of this phase as it sits inside the container; it is the same object that flies. */
 ammo:string;
 /** The thrown object (DDTank: a TV, scalpels, a boomerang…). */
 projectile:string;
 muzzle:string;
 impact:string;
 /** The POW shot of this phase: a different, bigger object than `projectile`, never the same one with more glow. */
 powProjectile:string;
 powImpact:string;
}
export interface WeaponKit {
 id:string;
 /** What the weapon is, what it throws and where it sits in the game's progression. */
 concept:string;
 palette:string;
 /** Traits every phase keeps, so the four looks read as the same weapon. */
 identity:string;
 /** Undefined means nobody decided yet: the game keeps `livre` and the validator warns. */
 powTrident?:PowTridentRule;
 /** Slots that already have their own file at `weaponSoundPath()`; the rest use the synthesized default. */
 sounds?:readonly WeaponSoundSlot[];
 /** Distinct recorded cues for the special shot; undeclared slots keep the normal sound. */
 powSounds?:readonly WeaponSoundSlot[];
 /** Weapon-specific residue brief for the terrain decal. */
 terrain?:string;
 /** The 8 destruction marks (shared/destruction.ts): what the painted rim around this weapon's hole is made of,
  * per phase and normal|POW. Only weapons with a destruction profile need it. */
 /** `rim`: a bright painted rim around the hole is the approved look for this weapon (the Vara das Marés water ring,
  * matheus 20/10), so the validator skips the gradient-and-gaps rule written for the scorched marks. */
 destruction?:{normal:string;pow:string;rim?:true;phases:Record<WeaponPhase,{normal:string;pow:string}>};
 /** Degrees the painted projectile points above horizontal in the atlas; the renderer rotates it back. */
 projectileTilt?:number;
 /** How the four sounds should feel (English, it feeds the ElevenLabs prompt). */
 sound:Record<WeaponSoundSlot,string>;
 phases:Record<WeaponPhase,PhaseBrief>;
}

export const WEAPON_KITS:Record<string,WeaponKit>={
 'wind-shuriken':{
  // Reconstructed from DDTank 4.1 Verdadeiro Vento de Deus 7008 (docs/wind-thunder.md); held art made with Nano Banana 2 (20/10).
  id:'wind-shuriken',
  concept:'Vento Celeste: arma de arremesso de Agilidade, uma shuriken de três lâminas curvas que gira no ar. A arma e o projétil são o mesmo objeto. Tiro normal: uma shuriken. POW: três shurikens agrupadas num só golpe (um único projétil físico, ×1,5), maior e com silhueta própria.',
  identity:'shuriken de três lâminas curvas e afiadas girando em volta de um cubo central redondo; lâminas e cubo mudam de material a cada fase. Contorno marrom grosso, pintura suave com volume, luz de cima à esquerda; sem mão, personagem ou pedestal.',
  palette:'aço prateado e ferrugem no início, lâminas de fogo carmim e laranja com rubi em +10, pétalas vermelho-douradas e aletas lilás em +12, ouro de nuvens com núcleo de safira em +15',
  powTrident:'exclusivo',projectileTilt:0,
  // The launch is only the package's disparo-normal.mp3 (20/10): no flight loop and no separate POW launch, which layered a second throw over it.
  sounds:['fire','impact','terrain'],powSounds:['impact'],
  terrain:'pequeno resíduo de cortes finos em leque ao redor de uma cratera oval com centro transparente, poeira clara e lascas metálicas; sem pedra ou tijolos',
  destruction:{
   normal:'sombra em DEGRADÊ que nasce escura colada à borda OVAL do buraco e se dissolve para fora, em cinza-azulado escuro, atravessada por muitos CORTES finos e direcionais saindo da borda (como golpes de lâmina), alguns ramificados, que se apagam aos poucos. Função do craterBrink do Vento de Deus do DDTank: chão cortado, nunca uma moldura, nunca lâminas desenhadas',
   pow:'o mesmo degradê, mais largo e escuro junto à oval POW (maior), com cortes mais longos e mais numerosos em leque giratório',
   phases:{
    0:{normal:'degradê cinza-ferrugem fosco, cortes finos escuros',pow:'degradê cinza-ferrugem largo, cortes longos em leque'},
    10:{normal:'degradê cinza-avermelhado, cortes com um fio de brasa carmim no fundo',pow:'degradê largo, cortes longos com brasa carmim'},
    12:{normal:'degradê ameixa escuro, cortes com reflexo lilás fraco',pow:'degradê ameixa largo, cortes longos com reflexo lilás'},
    15:{normal:'degradê marrom-dourado profundo, cortes com fio de luz dourada e azul-safira',pow:'degradê largo e profundo, cortes longos com luz dourada e safira'}
   }
  },
  sound:{fire:'fast spinning blade throw, sharp metallic whoosh',flight:'whirring blade cutting the air',impact:'sharp metal slash impact with a short ring',terrain:'quick crisp cut into dirt and gravel'},
  phases:{
   0:{ammo:'a própria shuriken de aço',held:'shuriken de três lâminas curvas serrilhadas de aço prateado com bordas enferrujadas e cubo redondo furado no centro',projectile:'a shuriken de aço girando, sem rastro pintado',muzzle:'redemoinho curto de vento claro',impact:'estouro rosado de vento com faíscas brancas e cortes',powProjectile:'três shurikens de bronze polido agrupadas em triângulo, com aura dourada; um único objeto',powImpact:'explosão de anéis de vento laranja e dourado com faíscas'},
   10:{ammo:'a própria shuriken de fogo',held:'shuriken de lâminas de fogo carmim e laranja com serrilhas em forma de chama e cubo de rubi com aro dourado',projectile:'a shuriken de fogo girando, sem rastro pintado',muzzle:'redemoinho de vento com faíscas carmim',impact:'estouro de vento carmim com brasas',powProjectile:'três shurikens de fogo agrupadas em triângulo dentro de um anel de brasa; um único objeto',powImpact:'explosão de anéis de fogo carmim e dourado'},
   12:{ammo:'a própria shuriken de pétalas',held:'shuriken de lâminas vermelho-douradas em forma de pétalas curvas, aletas lilás translúcidas entre as lâminas e cubo de flor dourada',projectile:'a shuriken de pétalas girando, sem rastro pintado',muzzle:'redemoinho de pétalas lilás',impact:'estouro de pétalas lilás e douradas',powProjectile:'três shurikens de pétalas agrupadas com aletas lilás e brilho dourado; um único objeto',powImpact:'explosão de pétalas lilás com anel dourado'},
   15:{ammo:'a própria shuriken celeste',held:'shuriken de ouro radiante com ornamentos de nuvens, pontas de bronze escuro e núcleo hexagonal de safira com três raios azuis',projectile:'a shuriken celeste girando, sem rastro pintado',muzzle:'redemoinho dourado com faíscas azuis',impact:'estouro de nuvens douradas e faíscas azuis',powProjectile:'três shurikens celestes de ouro agrupadas em volta de uma safira brilhante; um único objeto',powImpact:'grande explosão de nuvens douradas com anel azul-safira'}
  }
 },
 'thunder-coil':{
  // Reconstructed from DDTank 4.1 Verdadeiro Trovão 7009 (docs/wind-thunder.md); held art made with Nano Banana 2 (20/10).
  id:'thunder-coil',
  concept:'Bobina do Trovão: pistola de raio de Sorte, segurada numa mão, com bobina e dois terminais de onde sai o raio. Tiro normal: uma bola de energia branco-azulada. POW: três raios rosa-violeta em leque, cada um com cratera própria.',
  identity:'pistola de raio de desenho animado, cabo embaixo, corpo arredondado, bobina enrolada e dois terminais paralelos apontando para a frente; materiais e terminais mudam a cada fase. Contorno marrom grosso, pintura suave com volume, luz de cima à esquerda; sem mão, personagem ou pedestal.',
  palette:'metal vermelho-ferrugem e cobre no início, vermelho-laranja com molas douradas e cápsula ciano em +10, azul-petróleo blindado com luzes laranja e molas azuis em +12, violeta real com ouro e cristais azul-gelo e rubi em +15',
  powTrident:'exclusivo',projectileTilt:0,
  sounds:['fire','flight','impact','terrain'],powSounds:['fire','impact'],
  terrain:'queimadura elétrica escura com ramificações irregulares ao redor de uma cratera com centro transparente; sem pedra ou tijolos',
  destruction:{
   normal:'QUEIMADURA elétrica em degradê, quase preta colada à borda serrilhada do buraco e dissolvendo-se para fora em azul-acinzentado escuro, com ramificações finas e irregulares como raízes de raio saindo da borda e se apagando. Função do craterBrink do Trovão do DDTank: chão queimado e rachado por eletricidade, nunca uma moldura',
   pow:'a mesma queimadura, menor e mais concentrada junto ao buraco POW (menor), com ramificações curtas e densas em tom violeta escuro',
   phases:{
    0:{normal:'queimadura preto-azulada fosca, ramificações finas',pow:'queimadura preto-violeta compacta, ramificações curtas'},
    10:{normal:'queimadura com fio ciano fraco no fundo das ramificações',pow:'queimadura violeta com fio ciano fraco'},
    12:{normal:'queimadura azul-petróleo com pontos laranja apagados',pow:'queimadura violeta com fios azul-petróleo'},
    15:{normal:'queimadura profunda com fios de luz azul-gelo e rubi nas pontas',pow:'queimadura violeta profunda com fios rosa-violeta vivos'}
   }
  },
  sound:{fire:'electric zap blast with a crackling coil charge',flight:'buzzing electric orb hum',impact:'loud electric crackle burst with sparks',terrain:'short sizzling crack of scorched ground'},
  phases:{
   0:{ammo:'carga elétrica branco-azulada',held:'pistola de raio de metal vermelho-ferrugem com placa rebitada, medidor redondo de vidro, fio de cobre enrolado no cabo e dois terminais de latão com isoladores de porcelana branca',projectile:'bola de energia branco-azulada com fiapos elétricos, sem objeto sólido',muzzle:'faísca branca curta em leque',impact:'explosão esférica azul-ciano de raios',powProjectile:'raio rosa-violeta alongado com núcleo branco',powImpact:'explosão violeta de raios ramificados'},
   10:{ammo:'carga elétrica ciano',held:'pistola de raio vermelho-laranja brilhante com reflexos de chama, cápsula ciano de energia na lateral, guarda-mato dourado e dois terminais de mola dourada em espiral terminando em ponta',projectile:'bola de energia ciano mais forte com fiapos elétricos',muzzle:'faísca ciano com anel dourado',impact:'explosão ciano com raios e faíscas douradas',powProjectile:'raio rosa-violeta mais grosso com faíscas douradas',powImpact:'explosão violeta e dourada de raios'},
   12:{ammo:'carga elétrica azul-petróleo',held:'pistola de raio azul-petróleo blindada com aletas, parafusos, fileira de luzes laranja, gema verde em cima, bobina dourada e dois terminais de mola azul terminando em pontas douradas',projectile:'bola de energia azul intensa com anel elétrico',muzzle:'faísca azul com pontos laranja',impact:'explosão azul elétrica com anel de raios',powProjectile:'raio violeta com anel elétrico azul',powImpact:'explosão violeta-azul com anel de raios'},
   15:{ammo:'carga elétrica azul-gelo e rubi',held:'pistola de raio violeta real com filigrana dourada e diamante vermelho na lateral; os terminais viram dois grandes cristais facetados, azul-gelo e rubi, presos num colar dourado com gemas verdes',projectile:'bola de energia branca com raios azul-gelo e rubi',muzzle:'faísca dupla azul e rubi',impact:'explosão de raios azul-gelo e rubi',powProjectile:'raio rosa-violeta com cristais de luz',powImpact:'grande explosão violeta com raios azul-gelo e rubi'}
  }
 },
 'tide-rod':{
  // Pedido do matheus (20/10): a vara de pesca do DDTank (hook1) com desenho próprio; fases pintadas pelo Codex (21-arma-vara-fases).
  id:'tide-rod',
  concept:'Vara das Marés: vara de pesca curta com um peixe grande montado no cabo e um peixinho preso no anzol. O personagem arremessa o peixinho do anzol. Tiro normal: um peixe que voa de lado e explode em água. POW: um tubarão inteiro, bem maior, de boca aberta; combina com +1, +2 e os bônus de dano, nunca com o Tridente.',
  identity:'vara de madeira e latão curvada em diagonal, carretilha redonda na base, linha preta fina até o anzol com um peixinho pendurado; um peixe gordinho de olho grande abraça a vara. Peixe, enfeites e pedras mudam a cada fase. Contorno marrom grosso, pintura suave com volume, luz de cima à esquerda; sem mão, personagem ou pedestal.',
  palette:'azul-celeste e madeira no início, dourado com coral e estrela-do-mar em +10, carmim com pérolas e algas em +12, ouro real com coroa de coração e rubis em +15; água azul-clara nos efeitos',
  // 20/10 (matheus): POW usa todos os poderes menos o Tridente.
  powTrident:'exclusivo',projectileTilt:0,
  terrain:'respingo de água escura e escamas soltas em volta de uma cratera oval com centro transparente; sem pedra ou tijolos',
  destruction:{
   normal:'borda de ÁGUA em volta do buraco OVAL: espuma e redemoinhos de água azul brilhante colados à borda, como uma poça que espirrou e congelou no chão, com brilho azul suave que se dissolve para fora em respingos e gotas soltas; falhas transparentes onde o terreno aparece. Referência do matheus (20/10): anel de redemoinhos azuis com espuma branca e brilho que some para fora; nunca moldura sólida',
   pow:'a mesma borda de água, mais larga e mais agitada junto à oval POW (maior), com ondas curvas em espiral e mais respingos espalhados',
   rim:true,
   phases:{
    0:{normal:'água azul-clara e espuma branca',pow:'água azul-clara agitada com espuma e ondas'},
    10:{normal:'água azul com fios dourados e escamas douradas pequenas',pow:'ondas azuis com brilho dourado e escamas'},
    12:{normal:'água rosada e carmim com pérolas pequenas',pow:'ondas rosadas com pérolas e espuma'},
    15:{normal:'água dourada com brilho azul e corações de rubi pequenos',pow:'ondas douradas com corações de rubi e faíscas'}
   }
  },
  sound:{fire:'whip of a fishing rod cast with a reel click',flight:'wet fish flapping through the air',impact:'big wet splash with a fish slap',terrain:'muddy splash cracking wet ground'},
  phases:{
   0:{ammo:'peixinho azul',held:'vara de madeira com carretilha azul e um peixe azul gordinho de olho grande montado nela; peixinho azul no anzol',projectile:'peixinho azul de lado, nadadeiras abertas, sem rastro pintado',muzzle:'gotas de água azul em leque',impact:'respingo de água azul com bolhas',powProjectile:'tubarão azul-acinzentado de boca aberta e dentes brancos, grande, de lado',powImpact:'grande onda de água azul com espuma branca'},
   10:{ammo:'peixinho dourado',held:'vara de latão com coral vermelho, estrela-do-mar laranja, pérolas e gema azul; carpa dourada montada; peixinho dourado no anzol',projectile:'peixinho dourado de lado, sem rastro pintado',muzzle:'gotas de água com brilho dourado',impact:'respingo de água com escamas douradas',powProjectile:'tubarão dourado de boca aberta com barbatanas de coral',powImpact:'onda dourada com espuma e escamas'},
   12:{ammo:'peixinho carmim',held:'vara dourada com pérolas e algas verdes, peixe carmim de nadadeiras longas e véu montado; peixinho carmim no anzol',projectile:'peixinho carmim de nadadeiras longas, sem rastro pintado',muzzle:'gotas de água rosada e pérolas pequenas',impact:'respingo carmim com pérolas',powProjectile:'tubarão carmim com pérolas e nadadeiras em véu, de boca aberta',powImpact:'onda carmim com espuma e pérolas'},
   15:{ammo:'peixinho dourado real',held:'vara real de ouro com rubis e coração, carpa dourada com coroa de coração e nadadeiras reais montada; peixinho dourado no anzol',projectile:'peixinho dourado real com nadadeiras em véu, sem rastro pintado',muzzle:'gotas de água dourada com faíscas vermelhas',impact:'respingo dourado com corações e rubis pequenos',powProjectile:'tubarão real dourado com coroa de coração, de boca aberta',powImpact:'grande onda dourada com espuma e corações'}
  }
 },
 'love-boomerang':{
  id:'love-boomerang',
  concept:'Arma de arremesso romântica e ágil: um bumerangue curvo de lâminas com um coração central, que evolui de madeira e bronze para joia rosa e asas brancas. Tiro único normal; POW lança uma estrela alada de coração, maior e com silhueta própria.',
  identity:'Bumerangue compacto portátil de três lâminas curvas em leque, coração de rubi no encaixe, ornamentos dourados. Contorno marrom grosso, pintura suave com volume, luz de cima à esquerda; sem mão, personagem ou pedestal.',
  palette:'madeira âmbar e bronze no início, rubi rosa vivo e ouro nas evoluções, penas brancas com reflexos azul-celeste, luz rosa e dourada',
  powTrident:'exclusivo',projectileTilt:0,
  sounds:['fire','flight','impact','terrain'],powSounds:['fire','impact'],
  terrain:'pequeno resíduo em meia-lua de poeira rosada, duas penas brancas e brilhos em forma de coração nas bordas de uma cratera com centro transparente; sem tijolos, pedra ou barro',
  destruction:{
   normal:'sombra queimada em DEGRADÊ que nasce escura colada à borda OVAL do buraco e se dissolve no chão para fora, em tom rosa-vinho profundo (quase bordô na borda, rosado translúcido longe dela), com rachaduras finas e irregulares saindo da borda em direções variadas, algumas ramificadas, que também se apagam aos poucos. Função do craterBrink rosa do DDTank: chão marcado e rachado, nunca uma moldura, nunca ornamentos',
   pow:'o mesmo degradê queimado rosa-vinho, mais largo e mais escuro junto à oval POW (mais larga e mais rasa), com rachaduras mais longas e mais ramificadas em raios, algumas chegando perto do limite da faixa; o buraco continua limpo e legível',
   phases:{
    0:{normal:'degradê rosa-vinho fosco puxado para o marrom de madeira, rachaduras finas escuras e poucas',pow:'degradê rosa-vinho amarronzado mais largo, rachaduras longas escuras em raios'},
    10:{normal:'degradê rosa-vinho mais vivo, rachaduras com um fio de brilho rosa-claro no fundo da fenda',pow:'degradê rosa-vinho vivo e largo, rachaduras longas com fio rosa-claro brilhando no fundo'},
    12:{normal:'degradê bordô com reflexo azul-celeste frio nas pontas que se apagam, rachaduras com fio de luz branca fraca',pow:'degradê bordô largo com reflexo azul-celeste nas pontas, rachaduras longas com luz branca fraca'},
    15:{normal:'degradê bordô profundo com halo rosa-dourado bem suave na ponta externa, rachaduras com fio de luz rosa-dourada',pow:'degradê bordô profundo e largo com halo rosa-dourado suave, rachaduras longas e ramificadas com luz rosa-dourada viva no fundo'}
   }
  },
  sound:{fire:'bright curved boomerang throw, short airy swoosh and bell accent',flight:'soft spinning air with a light romantic shimmer',impact:'sharp magical heart burst with bright feathers and a short sparkle tail',terrain:'short airy crack and ground dust scattering, no heavy brick crash'},
  phases:{
   0:{ammo:'um bumerangue pequeno de madeira âmbar com três lâminas curvas e encaixe de bronze em forma de coração',held:'bumerangue de três lâminas curvas de madeira âmbar em leque, pequenas pontas de bronze polido, junta central de couro creme com um coração de rubi pequeno',projectile:'um bumerangue de três lâminas de madeira âmbar e bronze com coração rubi, sem rastro pintado',muzzle:'redemoinho curto de vento creme com dois pequenos brilhos rosa',impact:'estouro compacto de corações rosa e poeira creme',powProjectile:'uma estrela de cinco lâminas curvas de bronze com um grande coração rosa no centro e duas penas brancas; objeto único sem rastro',powImpact:'explosão de coração rosa com cinco faixas douradas e um anel leve de penas'},
   10:{ammo:'um bumerangue de três lâminas de cristal rosa preso em ouro com coração rubi',held:'bumerangue de três lâminas curvas de cristal rosa vivo em leque, encaixes e pontas douradas, coração rubi grande no centro e pequeno laço de seda rubi junto ao punho',projectile:'um bumerangue de três lâminas de cristal rosa com bordas douradas e coração rubi, sem rastro pintado',muzzle:'faixas de vento rosa e brilho dourado em leque',impact:'estouro de pétalas rosa e pequenos cacos de cristal dourado',powProjectile:'uma estrela de cinco lâminas de cristal rosa com aro dourado e grande coração rubi central, duas pequenas asas brancas; objeto único sem rastro',powImpact:'explosão rubi com coração luminoso, pétalas e anel rosa-dourado'},
   12:{ammo:'um bumerangue alado branco e dourado com coração vermelho',held:'bumerangue em arco de duas asas brancas largas com penas azul-celeste nas sombras, núcleo dourado delicado e coração rubi grande, três pontas curvas douradas integradas às penas',projectile:'um bumerangue de asas brancas abertas em arco, bordas douradas e coração rubi central, sem rastro pintado',muzzle:'espiral curta de penas brancas com luz rosa',impact:'explosão de penas brancas e corações rubi com anel de luz',powProjectile:'uma estrela alada de cinco lâminas de ouro e penas brancas, com grande coração rubi no centro, silhueta radial; sem rastro',powImpact:'grande clarão de coração com asas de luz e chuva curta de penas brancas'},
   15:{ammo:'um bumerangue celestial de duas camadas de penas brancas e rosa com coração de rubi coroado',held:'bumerangue celestial de asas duplas: duas camadas de penas brancas e rosa-pálido em arco, ponta das penas azul-celeste, estrutura de ouro polido, grande coração de rubi coroado e duas pequenas fitas vermelhas; compacto e portátil',projectile:'um bumerangue celestial de asas duplas brancas e rosa, núcleo de ouro e coração de rubi coroado, sem rastro pintado',muzzle:'leque dourado com penas brancas e corações rubi',impact:'coração de luz rubi com penas rosas e brancas e estrela dourada',powProjectile:'uma estrela celestial radial de cinco lâminas curvas de ouro com asas brancas duplas, grande coração rubi coroado e penas rosa; objeto único sem rastro',powImpact:'grande explosão de coração rubi com cinco raios de ouro e um anel amplo de penas rosa e brancas'}
  }
 },
 brick:{
  // Redone from zero on 17/10/2026: the starter weapon for early and mid game, balanced and defensive,
  // small craters, POW combines with every boost except the Tridente (user rule, 18/10).
  id:'brick',
  concept:'Quebra-Tijolos, a arma inicial de início e meio de jogo. Como as armas do DDTank, a arma é um RECIPIENTE cheio de munição: um saco, balde ou estojo de obra com tijolos de olaria, de onde o personagem tira e arremessa um tijolo que se estilhaça no impacto e solta cacos (só visuais: nenhum caco acerta alvos). Nunca desenhar só tijolos soltos ou amarrados: sempre o recipiente com os tijolos aparecendo dentro. O recipiente sempre tem tamanho que uma pessoa carrega numa mão ou no ombro (nunca caixote ou baú grande); a partir de +12 leva só 3 ou 4 tijolos. Arma de trabalhador, robusta e simpática, nunca uma relíquia divina: o recipiente cresce em capricho e acabamento até +15, sem coroas nem auras de lenda.',
  identity:'um recipiente de obra com os tijolos aparecendo pela boca; os TIJOLOS evoluem a cada fase junto com o recipiente (o tijolo de dentro é o mesmo que é arremessado), nunca o mesmo tijolo em duas fases; alça ou corda grossa de sisal; detalhes de latão; uma pequena gema cor de brasa que aparece em +10 e cresce a cada fase. Mesmo ângulo três-quartos levemente de cima, luz de cima à esquerda, contorno marrom-escuro grosso, mesma espessura de pincel em todas as fases.',
  palette:'vermelho tijolo, laranja barro, creme da argamassa, marrom da corda, latão; brasa laranja-amarela a partir de +10; madeira laqueada vermelha em +12; couro vermelho, latão polido e brasa viva em +15',
  destruction:{
   normal:'sombra de barro queimado em DEGRADÊ que nasce escura colada à borda do buraco HEXAGONAL ACHATADO e se dissolve no chão para fora, em marrom-terra escuro (quase preto-amarronzado na borda, marrom translúcido longe dela), com rachaduras finas e irregulares saindo da borda, algumas ramificadas, que também se apagam aos poucos. Função do craterBrink do DDTank: chão marcado e rachado, nunca uma moldura, nunca tijolos ou cacos desenhados em volta',
   pow:'o mesmo degradê de barro queimado, mais largo e mais escuro junto ao hexágono POW (um pouco maior), com rachaduras mais longas e mais ramificadas em raios, algumas chegando perto do limite da faixa; o buraco continua limpo e legível',
   phases:{
    0:{normal:'degradê marrom-terra fosco com leve tom de barro alaranjado, rachaduras finas escuras e poucas',pow:'degradê marrom-terra mais largo com tom de barro, rachaduras longas escuras em raios'},
    10:{normal:'degradê marrom-terra com um fio de brasa laranja fraca no fundo de algumas rachaduras',pow:'degradê marrom-terra largo, rachaduras longas com brasa laranja fraca no fundo'},
    12:{normal:'degradê marrom-avermelhado mais quente, rachaduras com brasa laranja média no fundo',pow:'degradê marrom-avermelhado largo, rachaduras longas e ramificadas com brasa laranja média'},
    15:{normal:'degradê marrom-avermelhado profundo com calor laranja suave na borda, rachaduras com brasa viva laranja-amarela no fundo',pow:'degradê marrom-avermelhado profundo e largo, rachaduras longas e ramificadas com veios de brasa viva laranja-amarela; nada de chamas'}
   }
  },
  powTrident:'exclusivo',
  // Recorded with ElevenLabs on 17/10/2026 (version 01 of two; the others are in armas/quebra-tijolos-final/).
  sounds:['fire','flight','impact','terrain'],
  projectileTilt:25,
  sound:{fire:'heavy underarm throw whoosh with a creaking rope',flight:'low tumbling whoosh with bricks knocking together',impact:'bricks smashing with a dry crash and clay shards scattering',terrain:'small chunk of wall crumbling, gravel falling'},
  phases:{
   0:{ammo:'tijolos comuns de barro vermelho-alaranjado, foscos, cantos lascados e manchas de argamassa creme',held:'saco de estopa bege remendado, com a boca aberta e franzida por uma corda de sisal, cheio de tijolos vermelhos aparecendo pela abertura, alça de corda para carregar no ombro',projectile:'um tijolo vermelho girando, com lascas nos cantos',muzzle:'nuvem curta de pó de barro com duas lascas',impact:'tijolo partindo em cacos com poeira de barro alaranjada',powProjectile:'um TIJOLÃO: bloco grande de dois tijolos comuns colados com argamassa creme, girando dentro de um redemoinho de poeira de barro com uma faixa branca de vento em espiral',powImpact:'estouro grande de cacos de tijolo e argamassa com anel largo de poeira de barro e onda de choque bege'},
   10:{ammo:'tijolos mais firmes e alaranjados, cada um com uma cinta fina de latão e rachaduras finas com brilho fraco de brasa',held:'balde de obra de madeira com aros de latão e alça de corda dupla, transbordando de tijolos, uma pequena gema cor de brasa presa no aro',projectile:'tijolo com cinta de latão e brilho de brasa fraco nas rachaduras',muzzle:'pó de barro com faíscas de latão em leque',impact:'estouro de cacos com brasas pequenas e anel de poeira',powProjectile:'um TIJOLÃO de dois tijolos alaranjados presos por duas cintas largas de latão, rachaduras de brasa acesas e uma espiral de faíscas de latão em volta',powImpact:'explosão de cacos com brasas, anel de faíscas de latão e onda de poeira alaranjada'},
   12:{ammo:'tijolos laqueados vermelho-escuro brilhantes, cinta vermelha com rebite de latão e uma pequena gema de brasa incrustada em cada um',held:'estojo de pedreiro pequeno e portátil, de madeira laqueada vermelha com cantoneiras de latão e alça de corda grossa de sisal por cima para carregar numa mão, aberto em cima mostrando 4 tijolos encaixados, gema de brasa média na frente e uma picareta pequena presa na lateral; do tamanho de uma caixa de ferramentas de mão, nunca um caixote',projectile:'tijolo laqueado com cinta vermelha e gema de brasa acesa',muzzle:'leque de pó dourado e lascas de tijolo',impact:'cacos quentes voando com anel de faíscas',powProjectile:'um TIJOLÃO laqueado vermelho-escuro de dois tijolos com cinta vermelha larga e uma gema de brasa GRANDE acesa no centro, puxando um cometa curto de brasa',powImpact:'explosão de cacos laqueados com clarão vermelho da gema, anel de brasas e poeira dourada'},
   15:{ammo:'tijolos de mestre com cantos de latão polido e veios de brasa viva laranja-amarela correndo pelas rachaduras, soltando pequenas faíscas',held:'bolsa de mestre de obras de couro vermelho reforçada com placas de latão polido, alça de ombro de couro trançado, aberta em cima mostrando 4 tijolos encaixados em compartimentos, gema de brasa viva na tampa dobrada, martelo e colher de pedreiro pequenos cruzados presos na frente; do tamanho de uma bolsa carregada no ombro, nunca um baú',projectile:'um único tijolo de mestre inteiro, cantos de latão polido e rachaduras de brasa viva, com rastro curto de faíscas e calor atrás; nenhum caco, lasca ou pedaço solto ao redor',muzzle:'estouro de brasa com pó dourado',impact:'explosão de cacos em brasa com onda de poeira dourada',powProjectile:'um TIJOLÃO de mestre de dois tijolos com cantoneiras de latão polido, veios de brasa viva por todo o bloco e um cometa de fogo laranja-amarelo atrás; tudo numa peça só, sem pedaços soltos',powImpact:'grande explosão de brasa com cacos incandescentes, onda de choque dourada em anel e coluna curta de faíscas'}
  }
 }
};

export function weaponKit(id:string):WeaponKit|undefined {return WEAPON_KITS[id];}
export function powTridentRule(weaponId:string):PowTridentRule {return WEAPON_KITS[weaponId]?.powTrident??'livre';}
export const POW_TRIDENT_LABELS:Record<PowTridentRule,string>={livre:'POW e Tridente combinam','exclusivo':'POW não combina com Tridente','pow-tridente':'O POW desta arma é o Tridente','pow-unico':'POW é um projétil único (sem Tridente, +1 ou +2)'};
/** Boosts that add projectiles, which a `pow-unico` weapon refuses alongside POW. */
export const MULTI_PROJECTILE_BOOSTS:readonly BoostId[]=['trident','extra1','extra2'];
/** Why a boost cannot join POW on this weapon, or undefined when it can. */
export function powBoostConflict(weaponId:string,boost:BoostId):string|undefined {
 const rule=powTridentRule(weaponId);
 if(rule==='pow-unico'&&MULTI_PROJECTILE_BOOSTS.includes(boost))return 'O Power desta arma é um projétil único: não combina com Tridente, +1 ou +2.';
 if(boost!=='trident')return undefined;
 if(rule==='exclusivo')return 'Esta arma não combina Power com Tridente.';
 if(rule==='pow-tridente')return 'O Power desta arma já dispara o Tridente.';
 return undefined;
}
/** Boosts that shape a shot: `pow-tridente` fires the three-way spread on POW, `pow-unico` fires one projectile. */
export function boostsForShot(weaponId:string,boosts:readonly BoostId[],powered:boolean):readonly BoostId[] {
 if(!powered)return boosts;
 const rule=powTridentRule(weaponId);
 if(rule==='pow-unico')return boosts.filter(id=>!MULTI_PROJECTILE_BOOSTS.includes(id));
 return rule==='pow-tridente'&&!boosts.includes('trident')?[...boosts,'trident']:boosts;
}

export {weaponIconPath};
/** Sounds are per weapon, MP3, one file per slot. */
export function weaponSoundPath(id:string,slot:WeaponSoundSlot,powered=false){return `/assets/audio/weapons/${id}/${powered?'pow-':''}${slot}.mp3`;}
export function weaponEffectsPath(id:string){return `/assets/weapons/${id}/effects.png`;}
export function weaponTerrainPath(id:string){return `/assets/weapons/${id}/terrain.png`;}
export function weaponPowPath(id:string){return `/assets/weapons/${id}/pow.png`;}
export function phaseArtPath(kit:WeaponKit,stage:WeaponPhase,slot:PhaseArtSlot):string {
 if(slot==='icon')return weaponIconPath(kit.id,stage);
 if(slot==='held')return weaponAssetPath(kit.id,stage);
 if(slot==='powProjectile'||slot==='powImpact')return weaponPowPath(kit.id);
 return weaponEffectsPath(kit.id);
}

/**
 * House style for every weapon, locked so no weapon ever drifts into another look (user, 17/10/2026).
 * Every prompt repeats it word for word; the validator flags art that reads as pixel art or flat vector.
 */
export const WEAPON_STYLE='HOUSE STYLE (mandatory, identical for every weapon of this game): original hand-painted 2D chibi browser-game art in the polished DDTank-like style (2009-2014 Korean/Chinese artillery MMO). Smooth digital painting with soft brush blending and gradients, chunky readable silhouette, bold clean dark-brown contour of even thickness, sculpted volume, vivid saturated colors, soft painted highlights, light from the top left, three-quarter view, slightly cute proportions. FORBIDDEN styles: pixel art, 8-bit or 16-bit sprites, visible pixels or dithering, voxel, low poly, 3D render or CGI, flat vector or clipart, cel-shaded anime screenshot, photorealism, sketch or line art, watercolor paper texture. No text, no letters, no numbers, no UI, no watermark, no frame, no floor, no cast shadow. Real transparent RGBA background (no fake checkerboard), generous transparent margins, smooth anti-aliased edges.';
/**
 * Approved pieces that define the house style for all weapons. Once the first Quebra-Tijolos pieces are
 * approved they are attached to every prompt of every other weapon, so a new weapon starts from the same look.
 */
export const WEAPON_STYLE_ANCHORS=['/assets/weapons/brick/icon-0.png','/assets/weapons/brick/held-0.png'] as const;
const STYLE=WEAPON_STYLE;
const CONSISTENCY='CONSISTENCY: attach the reference images listed below. Copy only their STYLE (camera angle, outline thickness, brush texture, lighting, level of detail), so every phase reads as the same weapon family.';
const NEW_OBJECT='IMPORTANT: the reference images show EARLIER phases of this weapon. Do NOT redraw, edit or recolor their object. Paint a DIFFERENT object with a new silhouette, exactly as described below; if the result looks like a reference image, it is wrong.';

/** Order to generate pieces: each one uses earlier, approved pieces as references. */
export function promptOrder(slot:PhaseArtSlot|'terrain'|'atlas'|'pow',stage?:WeaponPhase):number {
 const tier=stage===undefined?0:WEAPON_PHASES.find(p=>p.stage===stage)!.tier;
 return slot==='icon'?1+tier*2:slot==='held'?2+tier*2:slot==='atlas'?9:slot==='pow'?11:10;
}
function references(kit:WeaponKit,slot:PhaseArtSlot|'terrain'|'atlas'|'pow',stage?:WeaponPhase):string[] {
 const tier=stage===undefined?0:WEAPON_PHASES.find(p=>p.stage===stage)!.tier,previous=tier>0?WEAPON_PHASES[tier-1].stage:undefined;
 const icon=(s:WeaponPhase)=>`public${weaponIconPath(kit.id,s)}`,held=(s:WeaponPhase)=>`public${weaponAssetPath(kit.id,s)}`;
 if(slot==='icon')return previous===undefined?[]:[...new Set([icon(0),icon(previous)])];
 if(slot==='held')return [icon(stage!),...(previous===undefined?[]:[held(previous)])];
 if(slot==='atlas')return WEAPON_PHASES.map(p=>held(p.stage));
 if(slot==='pow')return [`public${weaponEffectsPath(kit.id)}`,...WEAPON_PHASES.map(p=>held(p.stage))];
 return [`public${weaponEffectsPath(kit.id)}`];
}

/** Technical template of a mark (scripts/destruction-templates.mjs): the hole, its centre and the band where the rim shows, on the mark's canvas. */
export function destructionTemplatePath(weapon:string,mode:DestructionMode){return `docs/destruction-templates/${weapon}-${mode}.png`;}
/** The DDTank 4.1 craterBrink studied for this weapon and mode (local reference package on the user's PC, never shipped). */
const DDTANK_REFERENCE:Record<string,string>={brick:'quebra-tijolos','love-boomerang':'bumerangue-verdadeiro'};
/** Weapons studied in their own package (output/true-wind-thunder-reference): the craterBrink of each mode's crater id. */
const DDTANK_TERRAIN:Record<string,Record<DestructionMode,string>>={
 'wind-shuriken':{normal:'output/true-wind-thunder-reference/vento-de-deus/terrain/121/craterBrink.png',pow:'output/true-wind-thunder-reference/vento-de-deus/terrain/131/craterBrink.png'},
 'thunder-coil':{normal:'output/true-wind-thunder-reference/trovao/terrain/141/craterBrink.png',pow:'output/true-wind-thunder-reference/trovao/terrain/151/craterBrink.png'}
};
export function destructionReferencePath(weapon:string,mode:DestructionMode){return DDTANK_TERRAIN[weapon]?.[mode]??`output/weapon-destruction-reference/${DDTANK_REFERENCE[weapon]??weapon}/ddtank/${mode}/craterBrink.png`;}
/** Generation order of the marks: after the atlas, terrain and POW pieces (9–11), normal +0…+15 then POW +0…+15. */
export function destructionOrder(mode:DestructionMode,stage:DestructionStage){return 12+(mode==='pow'?4:0)+DESTRUCTION_STAGES.indexOf(stage);}
/** References a mark prompt attaches, in this order: template, held and icon of the phase, the DDTank mark of the mode, then the new marks already approved (earlier phase of the mode; for POW, the normal mark of the phase). */
export function destructionReferences(kit:WeaponKit,mode:DestructionMode,stage:DestructionStage):string[]{
 const index=DESTRUCTION_STAGES.indexOf(stage),earlier=index>0?DESTRUCTION_STAGES[index-1]:undefined;
 return [destructionTemplatePath(kit.id,mode),`public${weaponAssetPath(kit.id,stage)}`,`public${weaponIconPath(kit.id,stage)}`,destructionReferencePath(kit.id,mode),
  ...(earlier===undefined?[]:[`public${destructionMarkPath(kit.id,mode,earlier)}`]),...(mode==='pow'?[`public${destructionMarkPath(kit.id,'normal',stage)}`]:[])];
}
/** Image prompt for one of the 16 destruction marks (docs/weapon-kit.md, "Destruição"). */
export function destructionPrompt(weapon:Weapon,kit:WeaponKit,mode:DestructionMode,stage:DestructionStage):string {
 const brief=kit.destruction!,phase=WEAPON_PHASES.find(p=>p.stage===stage)!,profile=destructionProfiles().get(destructionProfileId(kit.id,mode,stage))!,refs=destructionReferences(kit,mode,stage);
 const hole=Math.round(MARK_ART.width*profile.mark.holeShare),deep=Math.round(hole*CRATER_MASKS[profile.mask].height);
 return `${STYLE}
Weapon "${weapon.name}" (${kit.id}), visual phase ${phase.label}, ${mode==='pow'?'POW (special shot)':'normal shot'}.
Paint the GROUND MARK this shot leaves around its hole in destructible ground (like DDTank's craterBrink): the game cuts the hole with its own fixed mask and keeps only the part of this painting that lands on ground that is left, so it never floats over empty space. It is NOT the explosion: no fireball, no smoke cloud, no flash, no pedestal, no disc inside the hole, no soil or scenery painted in the file (the real ground shows under the mark).
Attach these images, in this order: ${refs.join(', ')}.
- The first image is the TECHNICAL TEMPLATE on the same ${MARK_ART.width}×${MARK_ART.height} canvas: magenta = the hole the game cuts (${hole}×${deep} px, centred on the cross at ${MARK_ART.pivotX},${MARK_ART.pivotY}); cyan = the band where the rim must sit, hugging the hole's outline; outside it stays transparent. Follow its position and size exactly; never move, rotate or rescale the hole.
- The held weapon and icon of this phase give the materials and palette: the mark must read as left by THIS phase of the weapon.
- The DDTank mark (${mode}) shows only the FUNCTION and proportion of a rim around the hole: do not copy its painting, ornaments or colours; paint an original design.${refs.length>4?`
- The other new marks are already approved: keep their style, outline and scale, but this one must be clearly different (${mode==='pow'?'the POW of this phase, more expressive than its normal mark':'the next phase, new materials, never the same mark recoloured'}).`:''}
What the mark is: ${mode==='pow'?brief.pow:brief.normal}.
This phase: ${brief.phases[stage][mode]}.
How it must look (the user rejected solid rims, rings and ornamental frames): a SOFT GRADIENT, not a line. Darkest and most opaque right at the hole's outline, then fading smoothly and irregularly to fully transparent before the outer edge of the cyan band, like scorched, pressed ground. Over it, thin dark CRACKS start at the hole's edge and run outward a short way, branching and fading out; the outer limit is ragged, never a clean ellipse or hexagon. The mark must leave the REAL TERRAIN showing through: it is broken and patchy, never a continuous band. Between the dark cracks and scorched patches there are gaps and islands of fully transparent pixels where the map's own ground (snow, grass, stone, earth) shows and fits in; the dark parts are only where the ground is pressed, burnt or split. Keep the colour mostly a darkening of the ground (deep shadow tones of the phase) so the mark sits naturally on any terrain. No solid band of uniform width, no bricks, shards, hearts, feathers, gems, rivets or any object painted around the hole.
Rules: readable at 60 px on screen; the hole area (magenta) stays FULLY TRANSPARENT; the gradient touches the hole's outline all around; nothing painted outside the cyan band; transparent RGBA background, no text, letters, numbers, card frame or border.
Size: exactly ${MARK_ART.width}×${MARK_ART.height}, transparent PNG.
Save as public${destructionMarkPath(kit.id,mode,stage)}`;
}

/** ChatGPT image prompt for one missing art piece. */
export function artPrompt(weapon:Weapon,kit:WeaponKit,slot:PhaseArtSlot|'terrain'|'atlas'|'pow',stage?:WeaponPhase):string {
 const phase=stage===undefined?undefined:WEAPON_PHASES.find(p=>p.stage===stage)!,brief=stage===undefined?undefined:kit.phases[stage];
 const own=references(kit,slot,stage),anchors=WEAPON_STYLE_ANCHORS.filter(path=>!path.startsWith(`/assets/weapons/${kit.id}/`)).map(path=>`public${path}`);
 const refs=[...new Set([...anchors,...own])];
 const head=`${STYLE}\nWeapon "${weapon.name}" (${kit.id}): ${kit.concept}\nEvery phase keeps: ${kit.identity}\nPalette: ${kit.palette}.${refs.length?`\n${CONSISTENCY}\nReference images: ${refs.join(', ')}`:'\nThis is the FIRST piece of the weapon: it sets the style every later phase will copy.'}`;
 const growth=phase?`\nThis is visual phase ${phase.label} (${phase.tier+1} of ${WEAPON_PHASES.length}). Each phase changes silhouette, ornaments and materials, not only adds glow. The base phase is simpler but already colorful, never burnt or gray.${phase.tier>0&&slot==='icon'?`\n${NEW_OBJECT}`:''}`:'';
 if(slot==='icon')return `${head}${growth}\nCreate ONE square inventory ICON, 512×512, of this weapon: ${brief!.held}. Ammunition of this phase: ${brief!.ammo}. Icon framing like DDTank weapon icons: the object fills about 80% of the square, slight diagonal three-quarter view, chunky and readable at 64 px. Transparent background: the game paints the colored tile behind it.\nSave as public${weaponIconPath(kit.id,stage!)}`;
 if(slot==='held')return `${head}${growth}\nCreate ONE isolated weapon asset, 1254×1254, the same design as the icon of this phase, as the character holds it in combat: ${brief!.held}. Ammunition of this phase: ${brief!.ammo}. Centered, diagonal pointing up-right, no hand or person.\nSave as public${weaponAssetPath(kit.id,stage!)}`;
 if(slot==='terrain')return `${head}\nCreate the TERRAIN MARK this weapon leaves on destructible ground after it explodes: ${kit.terrain??'a small organic decal with a transparent center (the crater hole), soft painted edges and little clay shards and mortar dust that match the weapon'}. The weapon digs small craters, so the mark is modest. Not an active explosion, not a cloud. Square 1024×1024, transparent.\nSave as public${weaponTerrainPath(kit.id)}`;
 if(slot==='pow'){
  const pow=WEAPON_PHASES.map(p=>`column ${p.tier+1} (${p.label}): POW projectile = ${kit.phases[p.stage].powProjectile} (the normal shot of this phase, which it must NOT look like: ${kit.phases[p.stage].projectile}); POW impact = ${kit.phases[p.stage].powImpact}`).join('\n');
  return `${head}\nCreate the POW SPRITE ATLAS, exactly 1448×724, FOUR columns × TWO rows of square 362×362 cells, no gridlines. POW is the special super shot: in every column it is a clearly DIFFERENT and BIGGER object than the normal projectile of the same phase in the reference atlas (different silhouette, not the same brick with more glow), yet clean and readable, not overloaded; the game draws the POW text and aura. Columns left to right are the phases ${WEAPON_PHASES.map(p=>p.label).join(' / ')}, evolving like the held weapon of that phase. Top row: flying POW projectile pointing RIGHT and tilted about ${kit.projectileTilt??0}° upward like the normal projectiles, one single object with its trail to the LEFT, no loose pieces around it. Bottom row: radial POW impact, bigger and stronger than the normal impact, no ground. Every sprite stays inside the central 70% of its cell.\n${pow}\nSave as public${weaponPowPath(kit.id)}`;
 }
 const rows=WEAPON_PHASES.map(p=>`column ${p.tier+1} (${p.label}): projectile = ${kit.phases[p.stage].projectile}; launch = ${kit.phases[p.stage].muzzle}; impact = ${kit.phases[p.stage].impact}`).join('\n');
 return `${head}\nCreate ONE visual effect SPRITE ATLAS, exactly 1448×1086, FOUR columns × THREE rows of square 362×362 cells, no gridlines. Columns left to right are the phases ${WEAPON_PHASES.map(p=>p.label).join(' / ')}; each column is a clearly more evolved design with a different silhouette, matching the held weapon of that phase. Top row: flying projectile pointing RIGHT, trail to the LEFT. Middle row: launch/muzzle flash from the left toward the RIGHT, no weapon body. Bottom row: radial impact with matching debris, no ground. Every sprite stays inside the central 65% of its cell.\n${rows}\nSave as public${weaponEffectsPath(kit.id)}`;
}

/** Cells of the all-phases sheet, left to right and top to bottom (2×2). */
export const PHASE_SHEET_GRID=[2,2] as const;

/**
 * One image with the four looks side by side, so the image model keeps one style and evolves the
 * container and the bricks together; `npm run split:weapon-sheet` cuts it into icon-N and held-N.
 */
export function phasesSheetPrompt(weapon:Weapon,kit:WeaponKit):string {
 const anchors=WEAPON_STYLE_ANCHORS.filter(path=>!path.startsWith(`/assets/weapons/${kit.id}/`)).map(path=>`public${path}`);
 const own=WEAPON_PHASES.map(p=>`public${weaponIconPath(kit.id,p.stage)}`);
 const cells=['top-left','top-right','bottom-left','bottom-right'];
 const rows=WEAPON_PHASES.map((p,i)=>`${cells[i]} (${p.label}): ${kit.phases[p.stage].held}. Ammunition: ${kit.phases[p.stage].ammo}.`).join('\n');
 return `${STYLE}\nWeapon "${weapon.name}" (${kit.id}): ${kit.concept}\nEvery phase keeps: ${kit.identity}\nPalette: ${kit.palette}.\nCONSISTENCY: if any of these files exist, attach them as STYLE references only (angle, outline, brush, light): ${[...new Set([...anchors,...own])].join(', ')}. Do not copy their objects.\nCreate ONE square image, 2048×2048, split into a 2×2 grid of four equal invisible cells (no gridlines, no labels), one evolution phase per cell, all with the same camera angle, scale, outline and light so they read as one weapon family. Each object is centered in its cell, fills about 75% of it and never touches or crosses into another cell. From cell to cell BOTH the container AND the bricks inside it change: new silhouette, materials and ornaments, never the same brick twice.\n${rows}\nTransparent RGBA background everywhere.\nSave as public/assets/weapons/${kit.id}/phases-sheet.png`;
}

/** ElevenLabs sound-effects prompt (English works best there) for one missing sound. */
export function soundPrompt(kit:WeaponKit,slot:WeaponSoundSlot):string {
 const what=slot==='fire'?'weapon firing':slot==='flight'?'projectile flying':slot==='impact'?'projectile impact':'destructible terrain breaking';
 return `Cartoon 2D artillery game, ${what}: ${kit.sound[slot]}. Punchy, clean, mid-range, immediate attack, short tail, no music, no voice.`;
}

export {WEAPONS};
