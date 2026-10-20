import type {AvatarPose} from './avatar';
import {COMBAT_FRAMES} from './rig/combatFrames';

/**
 * Vara das Marés cast (matheus, 20/10: "segurando a vara e, ao disparar, lançar como se fosse jogar na água"):
 * while charging the fighter holds the rod up over the shoulder in the front fist, the throw swings it forward like
 * a fishing cast and the fish leaves from the rod tip. Everything is drawing only; the server still launches the
 * shot from its usual origin and the projectile eases from the tip onto that path (Scene, `heldMuzzle`).
 * Measures are on the held painting (held-<stage>.png, 1254 px, rod running from the grip at lower right to the
 * tip at upper left), as shares of its side from the centre.
 */
export const TIDE_ROD='tide-rod';
export const ROD={
 /** Drawn size in avatar units (the back mount is 64). */
 size:124,
 grip:[.154,.3] as const,
 tip:[-.35,-.41] as const,
 /** The little fish on the hook, hidden once it has been thrown. */
 hook:[.75,.4,.96,.62] as const
};
/** Turn of the painting (radians, facing right): +0.5 holds it almost upright so it rises over the big head, the cast ends pointing forward. */
const HOLD=.5,BACK=-.2,CAST=1.6;
const ease=(k:number)=>{const t=Math.min(1,Math.max(0,k));return t*t*(3-2*t);};
/** Matches combatFrames.ts THROW_STEPS: windup 50 ms, release 110, follow 120, settle 140. */
const WINDUP=50,RELEASE=110,FOLLOW=120,SETTLE=140;

/** The rod in the hand for this pose and frame, or undefined while it rides on the back. */
export function rodInHand(pose:AvatarPose,poseTime:number,frame:string):{turn:number;thrown:boolean}|undefined{
 const t=Math.max(0,poseTime);
 if(pose==='fire'){
  if(t<WINDUP)return {turn:HOLD+(BACK-HOLD)*ease(t/WINDUP),thrown:false};
  if(t<WINDUP+RELEASE)return {turn:BACK+(CAST-BACK)*ease((t-WINDUP)/RELEASE),thrown:t>WINDUP+RELEASE*.45};
  if(t<WINDUP+RELEASE+FOLLOW+SETTLE)return {turn:CAST,thrown:true};
  return undefined;
 }
 if(pose==='charge'||frame==='ready'||frame==='rise')return {turn:HOLD,thrown:false};
 return undefined;
}
/** The rod tip at the end of the cast, in world pixels from the fighter's feet for an avatar drawn `size` tall. */
export function rodTip(facing:number,size:number):[number,number]{
 const [fx,fy]=COMBAT_FRAMES.follow.fists[1],cos=Math.cos(CAST),sin=Math.sin(CAST);
 const dx=(ROD.tip[0]-ROD.grip[0])*ROD.size,dy=(ROD.tip[1]-ROD.grip[1])*ROD.size;
 const x=fx+dx*cos-dy*sin,y=fy+dx*sin+dy*cos+7,k=size/160;
 return [x*k*(facing<0?-1:1),y*k];
}
