import {WEAPONS,weaponAssetPath,weaponIconPath} from './catalog';
import type {BoostId,Weapon} from './catalog';

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

/** Row of the 4 × 3 effect atlas `effects.png` (columns are the phases). */
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
 /** What the weapon is, what it throws and where it sits in the game's progression. */
 concept:string;
 palette:string;
 /** Traits every phase keeps, so the four looks read as the same weapon. */
 identity:string;
 /** Undefined means nobody decided yet: the game keeps `livre` and the validator warns. */
 powTrident?:PowTridentRule;
 /** Slots that already have their own file at `weaponSoundPath()`; the rest use the synthesized default. */
 sounds?:readonly WeaponSoundSlot[];
 /** How the four sounds should feel (English, it feeds the ElevenLabs prompt). */
 sound:Record<WeaponSoundSlot,string>;
 phases:Record<WeaponPhase,PhaseBrief>;
}

export const WEAPON_KITS:Record<string,WeaponKit>={
 brick:{
  // Redone from zero on 17/10/2026: the starter weapon for early and mid game, balanced and defensive,
  // small craters, POW is a single projectile.
  id:'brick',
  concept:'Quebra-Tijolos, a arma inicial de início e meio de jogo: o personagem arremessa um fardo de tijolos de olaria que se estilhaça no impacto e solta cacos. Arma de trabalhador, robusta e simpática, nunca uma relíquia divina: cresce em capricho e acabamento até +15, sem coroas nem auras de lenda.',
  identity:'tijolos de barro vermelho-alaranjado com cantos lascados e argamassa creme, amarrados por corda grossa de sisal; cantoneiras de latão; uma pequena gema cor de brasa que aparece em +10 e cresce a cada fase. Mesmo ângulo três-quartos, luz de cima à esquerda, contorno marrom-escuro grosso, mesma espessura de pincel em todas as fases.',
  palette:'vermelho tijolo, laranja barro, creme da argamassa, marrom da corda, latão; brasa laranja-amarela a partir de +10; madeira laqueada vermelha em +12; latão polido e brasa viva em +15',
  powTrident:'pow-unico',
  sound:{fire:'heavy underarm throw whoosh with a creaking rope',flight:'low tumbling whoosh with bricks knocking together',impact:'bricks smashing with a dry crash and clay shards scattering',terrain:'small chunk of wall crumbling, gravel falling'},
  phases:{
   0:{held:'fardo simples de quatro tijolos amarrados em cruz com corda de sisal e uma alça de corda para arremessar',projectile:'um tijolo amarrado com uma volta de corda, girando',muzzle:'nuvem curta de pó de barro com duas lascas',impact:'tijolo partindo em cacos com poeira de barro alaranjada'},
   10:{held:'seis tijolos numa armação de madeira com cantoneiras de latão, corda dupla e uma pequena gema cor de brasa no fecho',projectile:'dois tijolos presos por uma cinta de latão, brilho de brasa fraco nas frestas',muzzle:'pó de barro com faíscas de latão em leque',impact:'estouro de cacos com brasas pequenas e anel de poeira'},
   12:{held:'caixote de tijolos de madeira laqueada vermelha com cantos de latão, gema de brasa média no centro e uma picareta pequena presa na lateral',projectile:'bloco de três tijolos com cinta vermelha e gema de brasa acesa',muzzle:'leque de pó dourado e lascas de tijolo',impact:'cacos quentes voando com anel de faíscas'},
   15:{held:'caixote de mestre de obras em latão polido com tijolos rachados de brasa por dentro, gema de brasa viva, martelo e picareta cruzados presos na frente',projectile:'fardo de tijolos com rachaduras de brasa e dois cacos girando em volta',muzzle:'estouro de brasa com pó dourado',impact:'explosão de cacos em brasa com onda de poeira dourada'}
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
export function weaponSoundPath(id:string,slot:WeaponSoundSlot){return `/assets/audio/weapons/${id}/${slot}.mp3`;}
export function weaponEffectsPath(id:string){return `/assets/weapons/${id}/effects.png`;}
export function weaponTerrainPath(id:string){return `/assets/weapons/${id}/terrain.png`;}
export function phaseArtPath(kit:WeaponKit,stage:WeaponPhase,slot:PhaseArtSlot):string {
 if(slot==='icon')return weaponIconPath(kit.id,stage);
 if(slot==='held')return weaponAssetPath(kit.id,stage);
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
const CONSISTENCY='CONSISTENCY: attach the reference images listed below. Match their camera angle, outline thickness, brush texture, lighting and proportions exactly, so every phase reads as the same weapon family; only the design described here changes.';

/** Order to generate pieces: each one uses earlier, approved pieces as references. */
export function promptOrder(slot:PhaseArtSlot|'terrain'|'atlas',stage?:WeaponPhase):number {
 const tier=stage===undefined?0:WEAPON_PHASES.find(p=>p.stage===stage)!.tier;
 return slot==='icon'?1+tier*2:slot==='held'?2+tier*2:slot==='atlas'?9:10;
}
function references(kit:WeaponKit,slot:PhaseArtSlot|'terrain'|'atlas',stage?:WeaponPhase):string[] {
 const tier=stage===undefined?0:WEAPON_PHASES.find(p=>p.stage===stage)!.tier,previous=tier>0?WEAPON_PHASES[tier-1].stage:undefined;
 const icon=(s:WeaponPhase)=>`public${weaponIconPath(kit.id,s)}`,held=(s:WeaponPhase)=>`public${weaponAssetPath(kit.id,s)}`;
 if(slot==='icon')return previous===undefined?[]:[...new Set([icon(0),icon(previous)])];
 if(slot==='held')return [icon(stage!),...(previous===undefined?[]:[held(previous)])];
 if(slot==='atlas')return WEAPON_PHASES.map(p=>held(p.stage));
 return [`public${weaponEffectsPath(kit.id)}`];
}

/** ChatGPT image prompt for one missing art piece. */
export function artPrompt(weapon:Weapon,kit:WeaponKit,slot:PhaseArtSlot|'terrain'|'atlas',stage?:WeaponPhase):string {
 const phase=stage===undefined?undefined:WEAPON_PHASES.find(p=>p.stage===stage)!,brief=stage===undefined?undefined:kit.phases[stage];
 const own=references(kit,slot,stage),anchors=WEAPON_STYLE_ANCHORS.filter(path=>!path.startsWith(`/assets/weapons/${kit.id}/`)).map(path=>`public${path}`);
 const refs=[...new Set([...anchors,...own])];
 const head=`${STYLE}\nWeapon "${weapon.name}" (${kit.id}): ${kit.concept}\nEvery phase keeps: ${kit.identity}\nPalette: ${kit.palette}.${refs.length?`\n${CONSISTENCY}\nReference images: ${refs.join(', ')}`:'\nThis is the FIRST piece of the weapon: it sets the style every later phase will copy.'}`;
 const growth=phase?`\nThis is visual phase ${phase.label} (${phase.tier+1} of ${WEAPON_PHASES.length}). Each phase changes silhouette, ornaments and materials, not only adds glow. The base phase is simpler but already colorful, never burnt or gray.`:'';
 if(slot==='icon')return `${head}${growth}\nCreate ONE square inventory ICON, 512×512, of this weapon: ${brief!.held}. Icon framing like DDTank weapon icons: the object fills about 80% of the square, slight diagonal three-quarter view, chunky and readable at 64 px. Transparent background: the game paints the colored tile behind it.\nSave as public${weaponIconPath(kit.id,stage!)}`;
 if(slot==='held')return `${head}${growth}\nCreate ONE isolated weapon asset, 1254×1254, the same design as the icon of this phase, as the character holds it in combat: ${brief!.held}. Centered, diagonal pointing up-right, no hand or person.\nSave as public${weaponAssetPath(kit.id,stage!)}`;
 if(slot==='terrain')return `${head}\nCreate the TERRAIN MARK this weapon leaves on destructible ground after it explodes: a small organic decal with a transparent center (the crater hole), soft painted edges and little clay shards and mortar dust that match the weapon. The weapon digs small craters, so the mark is modest. Not an active explosion, not a cloud. Square 1024×1024, transparent.\nSave as public${weaponTerrainPath(kit.id)}`;
 const rows=WEAPON_PHASES.map(p=>`column ${p.tier+1} (${p.label}): projectile = ${kit.phases[p.stage].projectile}; launch = ${kit.phases[p.stage].muzzle}; impact = ${kit.phases[p.stage].impact}`).join('\n');
 return `${head}\nCreate ONE visual effect SPRITE ATLAS, exactly 1448×1086, FOUR columns × THREE rows of square 362×362 cells, no gridlines. Columns left to right are the phases ${WEAPON_PHASES.map(p=>p.label).join(' / ')}; each column is a clearly more evolved design with a different silhouette, matching the held weapon of that phase. Top row: flying projectile pointing RIGHT, trail to the LEFT. Middle row: launch/muzzle flash from the left toward the RIGHT, no weapon body. Bottom row: radial impact with matching debris, no ground. Every sprite stays inside the central 65% of its cell.\n${rows}\nSave as public${weaponEffectsPath(kit.id)}`;
}

/** ElevenLabs sound-effects prompt (English works best there) for one missing sound. */
export function soundPrompt(kit:WeaponKit,slot:WeaponSoundSlot):string {
 const what=slot==='fire'?'weapon firing':slot==='flight'?'projectile flying':slot==='impact'?'projectile impact':'destructible terrain breaking';
 return `Cartoon 2D artillery game, ${what}: ${kit.sound[slot]}. Punchy, clean, mid-range, immediate attack, short tail, no music, no voice.`;
}

export {WEAPONS};
