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
/** A fist: centre and tilt (radians). The game draws the same skin-colored fist for every outfit. */
export type Fist=readonly [number,number,number];
export interface CombatFrameSpec {
 /** Where the template places the head; each outfit's painted head is measured, this is the target. */
 head:Point;
 /** The fist behind the body, then the fist in front (it holds and releases the projectile). */
 fists:readonly [Fist,Fist];
 /** Centre of the weapon strapped on the back, and its tilt (radians, negative leans it back). */
 back:Point;backAngle:number;
}
/** Frames 0-5 lie on the ground, 6-11 kneel to throw. Shared with scripts/build-combat-atlas.py. */
export const COMBAT_FRAMES=contract.frames as unknown as Readonly<Record<CombatFrameName,CombatFrameSpec>>;
/** Codex paints two sheets per outfit, 3×2 cells of 512 px on magenta, with the head as a flat
 * green silhouette at the template position (docs/templates/combat-*.png). */
export const COMBAT_TEMPLATE=contract.template;
/** Packed atlas written by scripts/build-combat-atlas.py: frame i at column i%columns, row
 * i/columns, each cell with the contact point at `origin`, `pixelsPerUnit` px per avatar unit. */
/** Universal fist size in avatar units. */
export const COMBAT_FIST_SIZE=contract.fist.size;
/** The gray guide body the outfits are painted over; its sleeves end at the elbow, where the forearm starts. */
export const COMBAT_MANNEQUIN=contract.mannequin as unknown as Readonly<Record<CombatFrameName,{sleeves:readonly [readonly [Point,Point],readonly [Point,Point]]}>>;
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

/** After a release the fighter keeps holding until the server's shot starts the throw. */
export const COMBAT_RELEASE_HOLD_MS=600;
/** The drawing for a pose, the one that follows it and how far (0..1) the motion is towards it:
 * the painting changes on the drawing, the code-drawn fists glide between the two. */
export interface CombatFrameBlend {name:CombatFrameName;next:CombatFrameName;mix:number;}
const still=(name:CombatFrameName):CombatFrameBlend=>({name,next:name,mix:0});
const smooth=(t:number)=>t*t*(3-2*t);
/** `phase` is the crawl cycle (2π per stride), `walk` 0..1 how much it crawls. */
export function combatFrameBlend(pose:AvatarPose,poseTime:number,phase:number,walk:number,sinceCharge=Infinity):CombatFrameBlend {
 const t=Math.max(0,poseTime);
 if((pose==='aim'||pose==='idle')&&sinceCharge<COMBAT_RELEASE_HOLD_MS)return still('ready');
 if(pose==='charge')return t<COMBAT_STEP_MS*2?{name:'rise',next:'ready',mix:smooth(t/(COMBAT_STEP_MS*2))}:still('ready');
 if(pose==='fire'){
  const steps=COMBAT_SEQUENCES.throws;let at=0;
  for(let i=0;i<THROW_STEPS.length;i++){const end=at+THROW_STEPS[i];if(t<end)return {name:steps[i],next:steps[i+1]??'rise',mix:smooth((t-at)/THROW_STEPS[i])};at=end;}
  return t<at+COMBAT_STEP_MS?{name:'rise',next:'rest',mix:smooth((t-at)/COMBAT_STEP_MS)}:still('rest');
 }
 if(pose==='hit'||pose==='fall'||pose==='defeat')return still('hurt');
 if(walk>.35){
  // Four drawings, each held for two steps as in DDTank's WALK; the fists keep gliding through them.
  const cycle=['crawl1','crawl2','crawl3','crawl4'] as const,turn=((phase/(Math.PI*2))%1+1)%1*cycle.length,i=Math.floor(turn)%cycle.length;
  return {name:cycle[i],next:cycle[(i+1)%cycle.length],mix:turn-Math.floor(turn)};
 }
 return still('rest');
}
export const combatFrame=(pose:AvatarPose,poseTime:number,phase:number,walk:number,sinceCharge=Infinity)=>combatFrameBlend(pose,poseTime,phase,walk,sinceCharge).name;
export const combatFrameIndex=(name:CombatFrameName)=>COMBAT_FRAME_NAMES.indexOf(name);
