import type {Equipment} from '../../shared/catalog';
import {WEAPONS,weaponAssetPath} from '../../shared/catalog';
import type {AvatarPart} from './appearance';
import {asset,AVATAR_UNIT,drawHeadLayers,drawHeadRearLayers,drawPart} from './appearance';
import type {AvatarPose} from './avatar';
import type {FaceState} from './faceExpressions';
import {recolorItem,tintSkin} from './recolor';
import {HEAD_SCALE} from './rig/anchors';
import type {CombatFrameName} from './rig/combatFrames';
import {COMBAT_ATLAS,COMBAT_FRAMES,combatFrame,combatFrameIndex,HEAD_SILHOUETTE_CENTER} from './rig/combatFrames';
import {drawWeaponEnergy} from './weaponEffects';
import atlases from './combatAtlas.json';

/** DDTank-style combat body (docs/combat-frames.md): the outfit's painted frame for the current
 * action, the universal head where that painting expects it, and the weapon strapped on the back. */
interface AtlasEntry {path:string;frames:{head:[number,number]}[];}
const ATLASES=atlases as unknown as Record<string,AtlasEntry>;
const tinted=new Map<string,HTMLCanvasElement>();

export const hasCombatFrames=(outfit:string)=>!!ATLASES[outfit];
/** The outfit's atlas with its Color Ticket and the body color applied, or null while it loads. */
function combatAtlas(eq:Equipment):HTMLCanvasElement|null {
 const entry=ATLASES[eq.outfit];if(!entry)return null;
 const image=asset(entry.path);if(!image.complete||!image.naturalWidth)return null;
 const key=`${eq.outfit}:${eq.colors?.outfit??''}:${eq.skin??''}`,known=tinted.get(key);if(known)return known;
 const out=document.createElement('canvas');out.width=image.naturalWidth;out.height=image.naturalHeight;out.getContext('2d')!.drawImage(image,0,0);
 recolorItem(out,eq.outfit,eq.colors?.outfit);tintSkin(out,eq.skin,true);
 tinted.set(key,out);if(tinted.size>24)tinted.delete(tinted.keys().next().value!);return out;
}
export const combatBodyReady=(eq:Equipment)=>!!combatAtlas(eq);

const effectColor:Record<string,string>={fire:'#ffb45a',electric:'#69dfff',dynamite:'#ffb52c',brick:'#ff7a3d',crystal:'#d4a0ff',boomerang:'#ff8fc4'};
/** Weapon art is drawn this many avatar units across on the back. */
const BACK_WEAPON_SIZE=74;

export interface CombatBodyState {pose:AvatarPose;poseTime:number;phase:number;walk:number;time:number;power:number;face?:FaceState;lively:number;weapon:boolean;modular:boolean;}
/** Draws the combat fighter facing right in avatar units from its contact point. Returns false
 * when the outfit has no combat atlas (yet), so the caller can fall back to the cut-out rig. */
export function drawCombatBody(c:CanvasRenderingContext2D,eq:Equipment,head:AvatarPart,state:CombatBodyState):boolean {
 const atlas=combatAtlas(eq),entry=ATLASES[eq.outfit];if(!atlas||!entry)return false;
 const name=combatFrame(state.pose,state.poseTime,state.phase,state.walk),index=combatFrameIndex(name),spec=COMBAT_FRAMES[name];
 const measured=entry.frames[index]?.head??spec.head,dx=measured[0]-spec.head[0],dy=measured[1]-spec.head[1];
 const hit=state.pose==='hit'?Math.exp(-Math.max(0,state.poseTime)/210):0,breath=name==='rest'?Math.sin(state.time/900)*.35:0;
 const weapon=WEAPONS.find(item=>item.id===eq.weapon),color=effectColor[weapon?.effect??'brick']??'#ffe5a0';
 c.save();c.translate(-hit*3+Math.sin(state.time/28)*hit*1.2,0);
 // faceDown: the weapon on the back, behind the body and the head.
 if(state.weapon)drawBackWeapon(c,eq,spec.back[0]+dx,spec.back[1]+dy+breath,spec.backAngle,state.time);
 const atHead=(draw:()=>void)=>{c.save();c.translate(measured[0],measured[1]+breath);c.rotate(state.lively+hit*.05);c.scale(HEAD_SCALE,HEAD_SCALE);
  c.translate(-(HEAD_SILHOUETTE_CENTER[0]-625)*AVATAR_UNIT,-(HEAD_SILHOUETTE_CENTER[1]-1225)*AVATAR_UNIT);draw();c.restore();};
 // face: the head and the hair; then the outfit painting, then hat and glasses (DDTank's faceUp).
 atHead(()=>{drawHeadRearLayers(c,eq,state.time,state.pose,state.modular);drawPart(c,head);drawHeadLayers(c,eq,state.time,state.pose,state.modular,state.face,'hair');});
 const [cw,ch]=COMBAT_ATLAS.cell,[ox,oy]=COMBAT_ATLAS.origin,ppu=COMBAT_ATLAS.pixelsPerUnit,sx=(index%COMBAT_ATLAS.columns)*cw,sy=Math.floor(index/COMBAT_ATLAS.columns)*ch;
 c.drawImage(atlas,sx,sy,cw,ch,-ox/ppu,-oy/ppu+breath*.4,cw/ppu,ch/ppu);
 atHead(()=>drawHeadLayers(c,eq,state.time,state.pose,state.modular,state.face,'top'));
 if(state.weapon)drawThrowCue(c,name,state,spec.hand[0]+dx,spec.hand[1]+dy,color);
 c.restore();return true;
}
function drawBackWeapon(c:CanvasRenderingContext2D,eq:Equipment,x:number,y:number,angle:number,time:number){
 const level=eq.upgrade??0,image=asset(weaponAssetPath(eq.weapon,level));if(!image.complete||!image.naturalWidth)return;
 const weapon=WEAPONS.find(item=>item.id===eq.weapon);
 c.save();c.translate(x,y);c.rotate(angle);
 c.save();c.scale(.7,.7);drawWeaponEnergy(c,weapon?.effect??'brick',level,time);c.restore();
 if(level>=9){c.shadowColor=weapon?.color??'#ff7a3d';c.shadowBlur=level>=12?9:4;}
 c.drawImage(image,-BACK_WEAPON_SIZE/2,-BACK_WEAPON_SIZE/2,BACK_WEAPON_SIZE,BACK_WEAPON_SIZE);c.restore();
}
/** The projectile glows in the fist while the shot charges; the release leaves a short swoosh. */
function drawThrowCue(c:CanvasRenderingContext2D,name:CombatFrameName,state:CombatBodyState,x:number,y:number,color:string){
 if(state.pose==='charge'&&name==='ready'){
  const r=6+state.power/100*4+Math.sin(state.time/70)*.8;
  c.save();c.shadowColor=color;c.shadowBlur=10;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#ffffff');g.addColorStop(.45,color);g.addColorStop(1,color+'00');c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.restore();
 }
 if(state.pose==='fire'&&(name==='release'||name==='follow')){
  const from=COMBAT_FRAMES.windup.hand,fade=Math.max(0,1-state.poseTime/300);
  c.save();c.globalAlpha*=fade*.75;c.strokeStyle=color;c.lineCap='round';c.shadowColor=color;c.shadowBlur=7;
  for(const [w,k] of [[6,1],[2.5,.9]] as const){c.lineWidth=w;c.beginPath();c.moveTo(from[0],from[1]);c.quadraticCurveTo(x+12*k,from[1]+10,x,y);c.stroke();}c.restore();
 }
}
