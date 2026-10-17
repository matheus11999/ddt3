import {WEAPONS,weaponAssetPath} from './catalog';
import type {BoostId,Weapon} from './catalog';

/**
 * Weapon kit: everything one weapon needs to feel unique, DDTank style.
 * Each weapon has its own art per visual phase (icon, held art, projectile, launch, impact),
 * its own terrain mark and its own sounds. `npm run verify:weapons` checks this contract,
 * reports what is missing and writes ChatGPT/ElevenLabs prompts for every gap.
 * Paths are conventions: drop a file with the expected name and the validator picks it up.
 */

/** Visual phases follow `weaponVisualStage()`: 0–8, 9, 10–11 and 12. */
export const WEAPON_PHASES=[
 {stage:0,label:'+0 a +8',tier:0},
 {stage:9,label:'+9',tier:1},
 {stage:10,label:'+10 e +11',tier:2},
 {stage:12,label:'+12',tier:3}
] as const;
export type WeaponPhase=typeof WEAPON_PHASES[number]['stage'];

/**
 * POW × Tridente, per weapon.
 * - livre: POW and the Tridente tool combine (current behaviour).
 * - exclusivo: the weapon cannot fire POW and Tridente in the same shot.
 * - pow-tridente: this weapon's POW already fires the three-way spread; the tool is redundant.
 */
export type PowTridentRule='livre'|'exclusivo'|'pow-tridente';

export const PHASE_ART_SLOTS={
 icon:{label:'Ícone',size:[512,512]},
 held:{label:'Arma na mão',size:[1254,1254]},
 projectile:{label:'Projétil',size:null},
 muzzle:{label:'Disparo',size:null},
 impact:{label:'Impacto',size:null}
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

/** Row of the 4 × 3 effect atlas in public/assets/vfx (columns are the phases). */
export const ATLAS_ROWS:Record<'projectile'|'muzzle'|'impact',number>={projectile:0,muzzle:1,impact:2};
export const ATLAS_SIZE=[1448,1086] as const;

export interface PhaseBrief {
 /** What the weapon looks like in this phase. */
 held:string;
 /** The thrown object (DDTank: a TV, scalpels, a boomerang…). */
 projectile:string;
 muzzle:string;
 impact:string;
}
export interface WeaponKit {
 id:string;
 /** One line: what the weapon is and what it throws. */
 concept:string;
 palette:string;
 /** Painted 4 × 3 effect atlas: rows projectile / launch / impact, columns = phases. */
 atlas:string;
 /** Terrain mark: an atlas cell or a dedicated image. */
 terrain:{path:string;cell?:{cols:number;rows:number;index:number}};
 /** Undefined means nobody decided yet: the game keeps `livre` and the validator warns. */
 powTrident?:PowTridentRule;
 /** Slots that already have their own file at `weaponSoundPath()`; the rest use the synthesized default. */
 sounds?:readonly WeaponSoundSlot[];
 /** How the four sounds should feel (English, it feeds the ElevenLabs prompt). */
 sound:Record<WeaponSoundSlot,string>;
 phases:Record<WeaponPhase,PhaseBrief>;
}

const residue=(index:number)=>({path:'/assets/vfx/terrain-residues.png',cell:{cols:2,rows:2,index}});

export const WEAPON_KITS:Record<string,WeaponKit>={
 ember:{
  id:'ember',concept:'Canhão-dragão de esmalte vermelho que cospe uma brasa viva, que vira meteoro e depois cabeça de dragão.',
  palette:'vermelho carmim, laranja tangerina, dourado, núcleo marfim incandescente, rachaduras marrom-queimado',
  atlas:'/assets/vfx/ember-effects.png',terrain:residue(0),
  sound:{fire:'short dragon roar mixed with a furnace whoosh',flight:'fire hiss with crackling embers',impact:'hot fire explosion with crackling embers',terrain:'rock cracking and crumbling with magma sizzle'},
  phases:{
   0:{held:'canhão compacto de esmalte vermelho e cobre, cabo de madeira mel, pequeno olho âmbar',projectile:'brasa de carvão com língua de fogo curta',muzzle:'três línguas de fogo irregulares e um puf de fuligem',impact:'detonação de brasa com quatro fragmentos queimados'},
   9:{held:'canhão-dragão com chifres pequenos e placas douradas',projectile:'meteoro-semente com dois chifres curvos e rachaduras de magma',muzzle:'erupção de fornalha bifurcada',impact:'flor de fogo larga em volta de lascas de rocha preta'},
   10:{held:'cabeça de dragão vermelha e dourada com juba de fogo',projectile:'cometa em forma de cabeça de dragão com juba de fogo',muzzle:'espiral de bafo de dragão com dentes de brasa',impact:'vórtice de fogo com pétalas de chama curvas'},
   12:{held:'dragão solar real dourado e preto, asas de chama',projectile:'meteoro-dragão solar com rosto dourado e pluma dupla',muzzle:'explosão dupla de chama com anel solar na origem',impact:'coroa de fogo dourada e vermelha com duas asas de chama'}
  }
 },
 volt:{
  id:'volt',concept:'Arma de tempestade turquesa que dispara uma cápsula elétrica, depois um núcleo entre anéis de indução.',
  palette:'azul cobalto, ciano intenso, violeta elétrico, branco incandescente, cobre e latão',
  atlas:'/assets/vfx/volt-effects.png',terrain:residue(1),
  sound:{fire:'sharp electric zap with a capacitor charge-up whine',flight:'crackling electric buzz',impact:'short dry thunder clap with spark snaps',terrain:'stone and metal cracking with an electric discharge'},
  phases:{
   0:{held:'cano turquesa com anéis de latão estreitos e um cristal ciano pequeno',projectile:'cápsula de cobre e aço com centro ciano e cauda de raio curta',muzzle:'descarga ciano bifurcada pequena',impact:'rachadura elétrica com quatro galhos'},
   9:{held:'arma ciano com aletas condutoras e bobina de cobre',projectile:'núcleo safira com duas aletas condutoras curvas',muzzle:'cone de raio de três pontas',impact:'roseta de raios saindo de um centro branco'},
   10:{held:'arma com anéis de indução girando e diamante de plasma',projectile:'dois anéis de cobre segurando um diamante de plasma ciano',muzzle:'anel de indução se partindo em seis raios',impact:'onda de choque de anel duplo com lascas de metal queimado'},
   12:{held:'coroa de trovão dourada e cobalto com quatro chifres condutores',projectile:'coroa de trovão compacta com núcleo estrela branco-ciano',muzzle:'portal de arco duplo azul e cobre soltando um raio esculpido',impact:'jaula de trovão em forma de estrela com dois anéis luminosos'}
  }
 },
 crystal:{
  id:'crystal',concept:'Cajado de flor de cristal que lança lâminas de ametista, depois uma lança de lótus.',
  palette:'ametista violeta, magenta saturado, índigo profundo, reflexos ciano gelo, dourado só nas fases altas',
  atlas:'/assets/vfx/crystal-effects.png',terrain:residue(2),
  sound:{fire:'crystalline chime with a rising magic whoosh',flight:'humming vibrating glass, harmonic',impact:'crystal shattering with a magic bell',terrain:'glass and stone breaking into shards'},
  phases:{
   0:{held:'cajado de madeira quente com ametista violeta e gema magenta',projectile:'lâmina de ametista facetada única',muzzle:'estilhaços de cristal pintados',impact:'estrela partida de cristal'},
   9:{held:'cajado com prisma bifurcado e engaste dourado pequeno',projectile:'flecha de prisma duplo com crista ciano',muzzle:'trilha refratada com lascas',impact:'espinhos de cristal em leque'},
   10:{held:'cajado de lança de três lâminas com dobradiça dourada',projectile:'lança estrela de três lâminas',muzzle:'leque de lâminas violeta',impact:'coroa de espinhos de cristal'},
   12:{held:'cajado de lótus de cristal dourado e ametista',projectile:'lança de lótus com fragmentos em órbita',muzzle:'flor de cristal se abrindo',impact:'flor de cristal gigante estilhaçando'}
  }
 },
 dynamite:{
  id:'dynamite',concept:'Cesto de dinamites que arremessa bananas de dinamite de pavio aceso.',
  palette:'vermelho dinamite, turquesa, couro rubro, latão, fênix dourada e marfim nas fases altas',
  atlas:'/assets/vfx/dynamite-effects.png',terrain:residue(3),
  sound:{fire:'throw whoosh with a lit fuse hiss',flight:'sizzling sparking fuse',impact:'deep gunpowder blast with tearing paper',terrain:'dirt and stone flying, gravel falling'},
  phases:{
   0:{held:'cesto de lona turquesa com três dinamites vermelhas',projectile:'uma banana de dinamite vermelha com pavio aceso',muzzle:'puf de pólvora',impact:'clarão âmbar com papel vermelho voando'},
   9:{held:'cesto de couro rubro com placas de latão e fecho verde',projectile:'três dinamites amarradas',muzzle:'faíscas triplas',impact:'explosão maior com plumas creme'},
   10:{held:'cesto azul real com asas pequenas e escudo esmeralda',projectile:'cinco dinamites com cinturão',muzzle:'leque dourado com papel',impact:'explosão larga com onda de pressão'},
   12:{held:'cesto fênix dourado, marfim e rubi, dinamites com pavio aceso',projectile:'feixe dourado e esmeralda de dinamites',muzzle:'clarão com plumas e pontos verdes',impact:'explosão real com centro branco-amarelo e lóbulos laranja'}
  }
 },
 brick:{
  id:'brick',concept:'Fardo de tijolos que se estilhaça no impacto e solta cacos que demolem cristal, pedra e metal.',
  palette:'vermelho tijolo, barro, dourado, carmim laqueado, gema azul e brasa nas fases altas',
  atlas:'/assets/vfx/brick-effects.png',terrain:{path:'/assets/vfx/brick-residue.png'},
  sound:{fire:'heavy throw with a creaking rope',flight:'low wind whoosh with bricks knocking',impact:'bricks smashing with a dry crash',terrain:'wall collapsing, rubble falling'},
  phases:{
   0:{held:'saco de pano vermelho amarrado com corda e emblema de tijolos',projectile:'tijolo amarrado',muzzle:'poeira de barro',impact:'poeira de barro e cacos'},
   9:{held:'pote dourado com faixa vermelha de nuvens, tijolos e picareta',projectile:'dois tijolos com cintas douradas',muzzle:'clarão quente de barro',impact:'clarão quente com cacos'},
   10:{held:'caixa laqueada carmim com moldura dourada e blocos de concreto',projectile:'blocos com cinta carmim e gema azul',muzzle:'faíscas e pó de concreto',impact:'blocos de concreto e faíscas entre os cacos'},
   12:{held:'relicário carmim com asas, gema de brasa, picareta e martelo dourados',projectile:'fardo incandescente com rachaduras de lava e tijolos em órbita',muzzle:'explosão de brasa e pó dourado',impact:'cacos em brasa voando'}
  }
 }
};

export function weaponKit(id:string):WeaponKit|undefined {return WEAPON_KITS[id];}
export function powTridentRule(weaponId:string):PowTridentRule {return WEAPON_KITS[weaponId]?.powTrident??'livre';}
/** Boosts that shape a shot: a `pow-tridente` weapon fires the three-way spread on POW. */
export function boostsForShot(weaponId:string,boosts:readonly BoostId[],powered:boolean):readonly BoostId[] {
 return powered&&powTridentRule(weaponId)==='pow-tridente'&&!boosts.includes('trident')?[...boosts,'trident']:boosts;
}
export const POW_TRIDENT_LABELS:Record<PowTridentRule,string>={livre:'POW e Tridente combinam','exclusivo':'POW não combina com Tridente','pow-tridente':'O POW desta arma é o Tridente'};

export function weaponIconPath(id:string,stage:WeaponPhase){return `/assets/weapons/${id}/icon-${stage}.png`;}
/** Sounds are per weapon, MP3, one file per slot. */
export function weaponSoundPath(id:string,slot:WeaponSoundSlot){return `/assets/audio/weapons/${id}/${slot}.mp3`;}
export function phaseArtPath(kit:WeaponKit,stage:WeaponPhase,slot:PhaseArtSlot):string {
 if(slot==='icon')return weaponIconPath(kit.id,stage);
 if(slot==='held')return weaponAssetPath(kit.id,stage);
 return kit.atlas;
}

const STYLE='Original hand-painted 2D chibi browser-game art in the polished DDTank-like style (2009-2014 Korean/Chinese artillery MMO): chunky readable silhouette, bold clean contour, sculpted volume, vivid saturated colors, soft painted highlights. Not vector clipart, not flat, not photorealistic, not childish. No text, no letters, no numbers, no UI, no watermark, no frame, no floor, no cast shadow. Real transparent RGBA background (no fake checkerboard), generous transparent margins.';

/** ChatGPT image prompt for one missing art piece. */
export function artPrompt(weapon:Weapon,kit:WeaponKit,slot:PhaseArtSlot|'terrain'|'atlas',stage?:WeaponPhase):string {
 const phase=stage===undefined?undefined:WEAPON_PHASES.find(p=>p.stage===stage)!,brief=stage===undefined?undefined:kit.phases[stage];
 const head=`${STYLE}\nWeapon "${weapon.name}" (${kit.id}): ${kit.concept}\nPalette: ${kit.palette}.`;
 const growth=phase?`\nThis is visual phase ${phase.label} (${phase.tier+1} of ${WEAPON_PHASES.length}). Higher phases change silhouette, ornaments and materials, not only add glow. Base phase is simpler but already colorful, never burnt or gray.`:'';
 if(slot==='icon')return `${head}${growth}\nCreate ONE square inventory ICON, 512×512, of this weapon: ${brief!.held}. Icon framing like DDTank weapon icons: the object fills about 80% of the square, slight diagonal three-quarter view, bigger and chunkier than the held version, readable at 64 px. Transparent background: the game paints the colored tile behind it.\nSave as public/assets/weapons/${kit.id}/icon-${stage}.png`;
 if(slot==='held')return `${head}${growth}\nCreate ONE isolated weapon asset, 1254×1254, held in the character's hand in combat: ${brief!.held}. Centered, diagonal pointing up-right, no hand or person.\nSave as public${weaponAssetPath(kit.id,stage)}`;
 if(slot==='terrain')return `${head}\nCreate the TERRAIN MARK this weapon leaves on destructible ground after it explodes: an organic decal with a transparent center (the crater hole), soft painted edges and small debris that match the weapon. Not an active explosion, not a cloud. Square 1024×1024, transparent.\nSave as public/assets/vfx/${kit.id}-residue.png`;
 const rows=WEAPON_PHASES.map(p=>`column ${p.tier+1} (${p.label}): projectile = ${kit.phases[p.stage].projectile}; launch = ${kit.phases[p.stage].muzzle}; impact = ${kit.phases[p.stage].impact}`).join('\n');
 return `${head}\nCreate ONE visual effect SPRITE ATLAS, exactly 1448×1086, FOUR columns × THREE rows of square 362×362 cells, no gridlines. Columns left to right are the phases ${WEAPON_PHASES.map(p=>p.label).join(' / ')}; each column is a clearly more evolved design, different silhouette. Top row: flying projectile pointing RIGHT, trail to the LEFT. Middle row: launch/muzzle flash from the left toward the RIGHT, no weapon body. Bottom row: radial impact explosion with matching debris, no ground. Every sprite stays inside the central 65% of its cell.\n${rows}\nSave as public${kit.atlas}`;
}

/** ElevenLabs sound-effects prompt (English works best there) for one missing sound. */
export function soundPrompt(kit:WeaponKit,slot:WeaponSoundSlot):string {
 const what=slot==='fire'?'weapon firing':slot==='flight'?'projectile flying':slot==='impact'?'projectile impact':'destructible terrain breaking';
 return `Cartoon 2D artillery game, ${what}: ${kit.sound[slot]}. Punchy, clean, mid-range, immediate attack, short tail, no music, no voice.`;
}

export {WEAPONS};
