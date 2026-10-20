import {WEAPONS,weaponVisualStage} from './catalog';
import type {CraterShape} from './catalog';
import {POWER_CRATER_MULTIPLIER} from './power';

/**
 * Destruction profiles, DDTank style (docs/weapon-kit.md, "Destruição"): every (weapon, visual phase, normal|POW)
 * names the fixed physical mask that cuts the ground and the painting that marks the ground left around it.
 * In DDTank a projectile's `craterID` picks `crater.png` (cut) and `craterBrink.png` (mark); here the cut is the
 * analytic mask compiled by `craterMask()` (shared/physics.ts, identical on server and clients, no images) and the
 * mark is one of 16 paintings (2 weapons × 4 phases × 2 modes). Phases share the cut: a stronger weapon does not
 * dig a bigger hole, it only leaves a different mark.
 *
 * The server picks the profile from the shooter's weapon and level at the moment of the shot and writes its id
 * into the impact and the terrain mark, so changing equipment later never changes an old mark.
 * A painting change bumps DESTRUCTION_VERSION (old ids stay valid while their files exist).
 */
export const DESTRUCTION_VERSION=1;
export type DestructionMode='normal'|'pow';
export type DestructionStage=0|10|12|15;
export const DESTRUCTION_STAGES:readonly DestructionStage[]=[0,10,12,15];
export const DESTRUCTION_MODES:readonly DestructionMode[]=['normal','pow'];
/** Authoring canvas of a mark painting, and of its technical template (same pivot). */
export const MARK_ART={width:1024,height:1024,pivotX:512,pivotY:512} as const;

export interface DestructionProfile {
 /** Stable id carried by impacts and marks: `weapon:mode:stage@version`. */
 id:string;version:number;weapon:string;stage:DestructionStage;mode:DestructionMode;
 /** Physical mask id (`CRATER_MASKS`) and the radius the mark was framed for (weapon crater, ×POWER_CRATER_MULTIPLIER for POW). */
 mask:CraterShape;radius:number;
 /** The painting: authored on MARK_ART with the hole centred on its pivot; drawn `world` px wide/high around the
  * impact anchor (`craterAnchor`), scaled by digRadius/radius (a body hit digs and marks at DIRECT_HIT_CRATER). */
 mark:{src:string;world:number;holeShare:number};
 /** False until the painting is approved and in place: the game then keeps the weapon's legacy `terrain.png` on purpose. */
 painted:boolean;
}

/** How much of the mark's width the hole takes, per weapon and mode. Taken from the DDTank 4.1 references
 * (alpha extent of crater ÷ craterBrink width: brick 96/122, boomerang 107/152 and 131/198); the brick POW
 * keeps a wider rim than DDTank's 116/142, since its hole is only 5% bigger and the POW mark must read as its own. */
const FRAMING:Record<string,Record<DestructionMode,number>>={brick:{normal:.79,pow:.74},'love-boomerang':{normal:.70,pow:.66}};
/** Phases whose painting is approved (filled in when the art lands). */
const PAINTED=new Set<string>(['brick','love-boomerang'].flatMap(weapon=>DESTRUCTION_MODES.flatMap(mode=>DESTRUCTION_STAGES.map(stage=>`${weapon}:${mode}:${stage}`))));

export function destructionMarkPath(weapon:string,mode:DestructionMode,stage:DestructionStage){return `/assets/weapons/${weapon}/destruction/${mode}/mark-${stage}.png`;}
export function destructionProfileId(weapon:string,mode:DestructionMode,stage:DestructionStage,version=DESTRUCTION_VERSION){return `${weapon}:${mode}:${stage}@${version}`;}

function build():Map<string,DestructionProfile>{
 const out=new Map<string,DestructionProfile>();
 for(const weapon of WEAPONS){
  const framing=FRAMING[weapon.id];if(!framing||!weapon.craterShape)continue;
  for(const mode of DESTRUCTION_MODES)for(const stage of DESTRUCTION_STAGES){
   const mask=mode==='pow'?weapon.powCraterShape??weapon.craterShape:weapon.craterShape,radius=weapon.crater*(mode==='pow'?POWER_CRATER_MULTIPLIER:1),holeShare=framing[mode];
   const id=destructionProfileId(weapon.id,mode,stage);
   out.set(id,{id,version:DESTRUCTION_VERSION,weapon:weapon.id,stage,mode,mask,radius,mark:{src:destructionMarkPath(weapon.id,mode,stage),world:Math.round(radius*2/holeShare),holeShare},painted:PAINTED.has(`${weapon.id}:${mode}:${stage}`)});
  }
 }
 return out;
}
let profiles:Map<string,DestructionProfile>|undefined;
/** Every profile, built once (after the catalog is loaded, so test fixtures see the real weapons). */
export function destructionProfiles():ReadonlyMap<string,DestructionProfile>{return profiles??=build();}
export function destructionProfileById(id:string|undefined):DestructionProfile|undefined{return id?destructionProfiles().get(id):undefined;}
/** The profile of a shot fired with `weapon` at forge `level`; undefined for weapons without one (round legacy craters). */
export function destructionProfile(weapon:string,level:number,powered:boolean):DestructionProfile|undefined{
 return destructionProfiles().get(destructionProfileId(weapon,powered?'pow':'normal',weaponVisualStage(level)));
}
/** World box (left, top, size) a mark covers around the anchor at a dig of `radius`. */
export function markBox(profile:DestructionProfile,anchorX:number,anchorY:number,radius=profile.radius){
 const size=profile.mark.world*radius/profile.radius;return {x:anchorX-size/2,y:anchorY-size/2,size};
}
