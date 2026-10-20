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
/** Turn of the painting (radians, facing right): +0.9 holds it up and a little forward so it rises clear of the big head, leaning back to +0.25 with the power, the cast ends pointing forward. */
const HOLD=.9,BACK=.25,CAST=1.6;
const ease=(k:number)=>{const t=Math.min(1,Math.max(0,k));return t*t*(3-2*t);};
/** The body's throw drawings run this many times slower with the rod (matheus, 20/10: the cast was too fast). */
export const ROD_THROW_SLOW=2.2;
/** The forward swing (the fish leaves the tip halfway), the pose held after it, and the end of the slowed throw
 * (combatFrames.ts THROW_STEPS, 420 ms × ROD_THROW_SLOW), when the rod goes back on the back. */
const SWING=220,HOLD_UNTIL=650,END=420*ROD_THROW_SLOW;
/** How long the shooter keeps the throw pose with the rod (Scene; 500 ms for the other weapons). */
export const ROD_THROW_MS=Math.ceil(END+70*ROD_THROW_SLOW);

/** The rod in the hand for this pose and frame, or undefined while it rides on the back. Charging, it leans back
 * with the power, like a cast being loaded. */
export function rodInHand(pose:AvatarPose,poseTime:number,frame:string,power=0):{turn:number;thrown:boolean}|undefined{
 const t=Math.max(0,poseTime);
 if(pose==='fire'){
  if(t<SWING)return {turn:BACK+(CAST-BACK)*ease(t/SWING),thrown:t>SWING*.45};
  if(t<HOLD_UNTIL)return {turn:CAST,thrown:true};
  if(t<END)return {turn:CAST+.35*ease((t-HOLD_UNTIL)/(END-HOLD_UNTIL)),thrown:true};
  return undefined;
 }
 if(pose==='charge'||frame==='ready'||frame==='rise')return {turn:HOLD+(BACK-HOLD)*ease(power/100),thrown:false};
 return undefined;
}
/** The rod tip at the end of the cast, in world pixels from the fighter's feet for an avatar drawn `size` tall. */
export function rodTip(facing:number,size:number):[number,number]{
 const [fx,fy]=COMBAT_FRAMES.follow.fists[1],cos=Math.cos(CAST),sin=Math.sin(CAST);
 const dx=(ROD.tip[0]-ROD.grip[0])*ROD.size,dy=(ROD.tip[1]-ROD.grip[1])*ROD.size;
 const x=fx+dx*cos-dy*sin,y=fy+dx*sin+dy*cos+7,k=size/160;
 return [x*k*(facing<0?-1:1),y*k];
}
