import type {AvatarPose} from '../avatar';

/** DDTank-style combat body (docs/combat-frames.md). As in DDTank's GameCharacter, every outfit
 * carries its own painted combat poses in compatible cells: lying down, crawling, rising, holding
 * and throwing. The game only picks the frame for the current action and stacks the universal
 * head, the hair/hat/glasses and the weapon on the back in the same coordinate space.
 *
 * Coordinates are avatar units (a standing avatar is 160 tall), facing right, from the fighter's
 * contact point on the ground. Head points are the centre of the universal head's silhouette box. */
type Point=readonly [number,number];
import contract from './combatFrames.json';
export const COMBAT_FRAME_NAMES=['rest','crawl1','crawl2','crawl3','crawl4','hurt','rise','ready','windup','release','follow','settle'] as const;
export type CombatFrameName=typeof COMBAT_FRAME_NAMES[number];
export interface CombatFrameSpec {
 /** Where the template places the head; each outfit's painted head is measured, this is the target. */
 head:Point;
 /** Fist that holds and releases the projectile (charge glow, throw trail). */
 hand:Point;
 /** Centre of the weapon strapped on the back, and its tilt (radians, negative leans it back). */
 back:Point;backAngle:number;
}
/** Frames 0-5 lie on the ground, 6-11 rise to throw. Shared with scripts/build-combat-atlas.py. */
export const COMBAT_FRAMES=contract.frames as unknown as Readonly<Record<CombatFrameName,CombatFrameSpec>>;
/** Codex paints two sheets per outfit, 3×2 cells of 512 px on magenta, with the head as a flat
 * green silhouette at the template position (docs/templates/combat-*.png). */
export const COMBAT_TEMPLATE=contract.template;
/** Packed atlas written by scripts/build-combat-atlas.py: frame i at column i%columns, row
 * i/columns, each cell with the contact point at `origin`, `pixelsPerUnit` px per avatar unit. */
export const COMBAT_ATLAS=contract.atlas as unknown as {columns:number;rows:number;cell:Point;origin:Point;pixelsPerUnit:number};
/** The universal head's silhouette box in the 1254 px head template (character-base.png). */
export const HEAD_SILHOUETTE=contract.headSilhouette;
export const HEAD_SILHOUETTE_CENTER:Point=[HEAD_SILHOUETTE.left+HEAD_SILHOUETTE.width/2,HEAD_SILHOUETTE.top+HEAD_SILHOUETTE.height/2];

/** Action sequences, ported from GameCharacter.as: STAND, WALK (each drawing held two steps),
 * SHOWTHROWS (rise and hold), THROWS (wind up, release, follow through), then back down. */
export const COMBAT_SEQUENCES={
 walk:['crawl1','crawl1','crawl2','crawl2','crawl3','crawl3','crawl4','crawl4'],
 showThrow:['rise','ready'],
 throws:['windup','release','follow','settle'],
 hideThrow:['rise']
} as const satisfies Record<string,readonly CombatFrameName[]>;
/** Duration of one sequence step. */
export const COMBAT_STEP_MS=70;
/** The projectile leaves on the release drawing: the server launches it when `fire` starts,
 * so the wind-up is a single short step. */
const THROW_STEPS=[50,110,120,140] as const;

/** Frame for a pose. `phase` is the crawl cycle (2π per stride), `walk` 0..1 how much it crawls. */
/** After a release the fighter keeps holding until the server's shot starts the throw. */
export const COMBAT_RELEASE_HOLD_MS=600;
export function combatFrame(pose:AvatarPose,poseTime:number,phase:number,walk:number,sinceCharge=Infinity):CombatFrameName {
 const t=Math.max(0,poseTime);
 if((pose==='aim'||pose==='idle')&&sinceCharge<COMBAT_RELEASE_HOLD_MS)return 'ready';
 if(pose==='charge'){const step=Math.floor(t/COMBAT_STEP_MS);return COMBAT_SEQUENCES.showThrow[Math.min(step,COMBAT_SEQUENCES.showThrow.length-1)];}
 if(pose==='fire'){
  let at=0;for(let i=0;i<THROW_STEPS.length;i++){at+=THROW_STEPS[i];if(t<at)return COMBAT_SEQUENCES.throws[i];}
  return t<at+COMBAT_STEP_MS?COMBAT_SEQUENCES.hideThrow[0]:'rest';
 }
 if(pose==='hit'||pose==='fall'||pose==='defeat')return 'hurt';
 if(walk>.35){const cycle=COMBAT_SEQUENCES.walk,turn=((phase/(Math.PI*2))%1+1)%1;return cycle[Math.floor(turn*cycle.length)%cycle.length];}
 return 'rest';
}
export const combatFrameIndex=(name:CombatFrameName)=>COMBAT_FRAME_NAMES.indexOf(name);
