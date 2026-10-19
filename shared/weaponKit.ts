import {WEAPONS,weaponAssetPath,weaponIconPath} from './catalog';
import type {BoostId,Weapon} from './catalog';
import {DESTRUCTION_STAGES,destructionMarkPath,destructionProfileId,destructionProfiles,MARK_ART} from './destruction';
import type {DestructionMode,DestructionStage} from './destruction';

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
 destruction?:{normal:string;pow:string;phases:Record<WeaponPhase,{normal:string;pow:string}>};
 /** Degrees the painted projectile points above horizontal in the atlas; the renderer rotates it back. */
 projectileTilt?:number;
 /** How the four sounds should feel (English, it feeds the ElevenLabs prompt). */
 sound:Record<WeaponSoundSlot,string>;
 phases:Record<WeaponPhase,PhaseBrief>;
}

export const WEAPON_KITS:Record<string,WeaponKit>={
 'love-boomerang':{
  id:'love-boomerang',
  concept:'Arma de arremesso romântica e ágil: um bumerangue curvo de lâminas com um coração central, que evolui de madeira e bronze para joia rosa e asas brancas. Tiro único normal; POW lança uma estrela alada de coração, maior e com silhueta própria.',
  identity:'Bumerangue compacto portátil de três lâminas curvas em leque, coração de rubi no encaixe, ornamentos dourados. Contorno marrom grosso, pintura suave com volume, luz de cima à esquerda; sem mão, personagem ou pedestal.',
  palette:'madeira âmbar e bronze no início, rubi rosa vivo e ouro nas evoluções, penas brancas com reflexos azul-celeste, luz rosa e dourada',
  powTrident:'exclusivo',projectileTilt:0,
  sounds:['fire','flight','impact','terrain'],powSounds:['fire','impact'],
  terrain:'pequeno resíduo em meia-lua de poeira rosada, duas penas brancas e brilhos em forma de coração nas bordas de uma cratera com centro transparente; sem tijolos, pedra ou barro',
  destruction:{
   normal:'acabamento que acompanha a borda OVAL do buraco, com caráter romântico: uma faixa estreita de terra pressionada com contorno marrom-escuro e, por cima dela, elementos curvos leves desenhados por nós (volutas suaves, pequenos corações, pétalas ou penas deitadas ao longo da curva). Função da borda rosa do DDTank reinterpretada com desenho próprio: nunca traçar os arabescos da referência',
   pow:'acabamento POW do bumerangue, mais expressivo que o normal e próprio da oval POW (mais larga e mais rasa): coroa dupla de volutas curvas e corações ao longo da borda, um leve brilho rosado pintado (não luz de explosão), alguns elementos saindo em leque nas laterais; o buraco continua limpo e legível',
   phases:{
    0:{normal:'madeira âmbar e bronze: lascas finas de madeira âmbar curvadas ao longo da oval, pontinhos de bronze polido e dois ou três corações de rubi pequenos, poeira creme contida',pow:'lâminas curvas de bronze e madeira âmbar em volutas maiores, cinco corações de rubi distribuídos na borda e pó dourado-claro'},
    10:{normal:'cristal rosa vivo e ouro: cacos curvos de cristal rosa com filetes dourados acompanhando a oval, pétalas rosa e um laço de seda rubi pequeno',pow:'arcos de cristal rosa com aro dourado em volutas duplas, pétalas em leque nas laterais e corações de rubi maiores'},
    12:{normal:'penas brancas com sombra azul-celeste deitadas ao longo da oval, detalhes de ouro delicado e pequenos corações rubi entre as penas',pow:'penas brancas maiores abertas em leque nas laterais, ouro delicado em volutas e um coração rubi de cada lado'},
    15:{normal:'penas em duas camadas branca e rosa-pálido com pontas azul-celeste, filetes de ouro polido e coração de rubi coroado pequeno, duas fitinhas vermelhas curtas',pow:'coroa celestial de penas duplas branco e rosa ao redor da oval POW, ouro polido, corações de rubi coroados e fitas vermelhas curtas em curva'}
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
   normal:'acabamento de borda do buraco do tijolo, alinhado ao recorte HEXAGONAL ACHATADO (topo e fundo retos, lados inclinados): uma faixa estreita de terra fraturada com contorno marrom-escuro, rachaduras curtas saindo da borda, pequenos cacos de olaria presos à borda e poeira de barro contida. Arma de trabalhador: material de obra, nunca relíquia mágica',
   pow:'acabamento POW do tijolo, mais expressivo que o normal e próprio do hexágono POW (um pouco maior): fraturas mais longas em raios, cacos maiores e lascas de argamassa espalhados ao redor da borda, barro levemente tostado (nunca preto); o buraco continua limpo e legível',
   phases:{
    0:{normal:'cacos de tijolo vermelho-alaranjado foscos com cantos lascados, manchas de argamassa creme e poeira de barro alaranjada',pow:'cacos grandes de tijolo vermelho e pedaços de argamassa creme, rachaduras longas e poeira de barro em leque nas laterais'},
    10:{normal:'cacos alaranjados mais firmes, uma lasca de cinta de latão e rachaduras com brilho fraco de brasa laranja',pow:'cacos alaranjados com pedaços de cinta de latão retorcida, rachaduras com brasa fraca acesa e faíscas pequenas presas à borda'},
    12:{normal:'cacos de tijolo laqueado vermelho-escuro brilhante com rebites de latão, rachaduras com brilho de brasa médio e uma gema de brasa pequena entre os cacos',pow:'cacos laqueados vermelho-escuros maiores, rebites e cantoneiras de latão, rachaduras de brasa acesa e duas gemas de brasa pequenas'},
    15:{normal:'cacos de tijolo de mestre com cantos de latão polido, veios de brasa viva laranja-amarela nas fraturas e poucas faíscas presas à borda',pow:'cantos de latão polido entre cacos grandes, veios de brasa viva correndo pelas rachaduras longas e faíscas laranja-amarelas; poderoso mas ainda material de obra'}
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
export function destructionReferencePath(weapon:string,mode:DestructionMode){return `output/weapon-destruction-reference/${DDTANK_REFERENCE[weapon]??weapon}/ddtank/${mode}/craterBrink.png`;}
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
 const hole=Math.round(MARK_ART.width*profile.mark.holeShare),deep=Math.round(hole*({brick:.66,'brick-pow':.66,oval:.67,'oval-pow':.59} as Record<string,number>)[profile.mask]);
 return `${STYLE}
Weapon "${weapon.name}" (${kit.id}), visual phase ${phase.label}, ${mode==='pow'?'POW (special shot)':'normal shot'}.
Paint the GROUND MARK this shot leaves around its hole in destructible ground (like DDTank's craterBrink): the game cuts the hole with its own fixed mask and keeps only the part of this painting that lands on ground that is left, so it never floats over empty space. It is NOT the explosion: no fireball, no smoke cloud, no flash, no pedestal, no disc inside the hole, no soil or scenery painted in the file (the real ground shows under the mark).
Attach these images, in this order: ${refs.join(', ')}.
- The first image is the TECHNICAL TEMPLATE on the same ${MARK_ART.width}×${MARK_ART.height} canvas: magenta = the hole the game cuts (${hole}×${deep} px, centred on the cross at ${MARK_ART.pivotX},${MARK_ART.pivotY}); cyan = the band where the rim must sit, hugging the hole's outline; outside it stays transparent. Follow its position and size exactly; never move, rotate or rescale the hole.
- The held weapon and icon of this phase give the materials and palette: the mark must read as left by THIS phase of the weapon.
- The DDTank mark (${mode}) shows only the FUNCTION and proportion of a rim around the hole: do not copy its painting, ornaments or colours; paint an original design.${refs.length>4?`
- The other new marks are already approved: keep their style, outline and scale, but this one must be clearly different (${mode==='pow'?'the POW of this phase, more expressive than its normal mark':'the next phase, new materials, never the same mark recoloured'}).`:''}
What the rim is: ${mode==='pow'?brief.pow:brief.normal}.
This phase: ${brief.phases[stage][mode]}.
Rules: small and integrated with the ground, readable at 60 px on screen; the hole area (magenta) stays FULLY TRANSPARENT; the rim touches the hole's outline all around; nothing painted outside the cyan band; transparent RGBA background, no text, letters, numbers, card frame or border.
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
