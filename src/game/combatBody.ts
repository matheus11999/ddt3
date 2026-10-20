import type {Equipment} from '../../shared/catalog';
import {CATALOG,WEAPONS,weaponAssetPath} from '../../shared/catalog';
import {drawScaled,freeAll,freeSurface} from './spriteCache';
import type {AvatarPart} from './appearance';
import {asset,AVATAR_UNIT,drawHeadLayers,drawHeadRearLayers,drawPart} from './appearance';
import type {AvatarPose} from './avatar';
import type {FaceState} from './faceExpressions';
import {recolorItem,tintSkin} from './recolor';
import {HEAD_SCALE} from './rig/anchors';
import type {CombatFrameName,Fist} from './rig/combatFrames';
import {COMBAT_ATLAS,COMBAT_FIST_SIZE,COMBAT_FRAMES,COMBAT_MANNEQUIN,combatFrameBlend,combatFrameIndex,HEAD_SILHOUETTE_CENTER} from './rig/combatFrames';
import {drawWeaponEnergy} from './weaponEffects';
import atlases from './combatAtlas.json';

/** DDTank-style combat body (docs/combat-frames.md): the outfit's small painted body for the current
 * action, the universal head where that painting expects it, the universal skin-colored fists and the
 * weapon strapped on the back. */
type Point=readonly [number,number];
interface AtlasEntry {path:string;frames:{head:[number,number];/** Arms and fists are painted in this frame (DDTank): the game draws no hands. */hands?:boolean;/** Lying: the painted fists lifted out of the painting ([x,y,radius], near first), drawn by the game so the far one sits behind the head. */lifted?:[number,number,number][];}[];/** The painted sleeve's cloth color, continued by the code-drawn forearm. */sleeve?:string;}
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
 tinted.set(key,out);if(tinted.size>24){const oldest=tinted.keys().next().value!;freeSurface(tinted.get(oldest));tinted.delete(oldest);}return out;
}
/** The tinted combat sheets live only while a battle is on screen. */
export function releaseCombatBodies(){freeAll(tinted);}
export const combatBodyReady=(eq:Equipment)=>!!combatAtlas(eq);

const effectColor:Record<string,string>={fire:'#ffb45a',electric:'#69dfff',dynamite:'#ffb52c',brick:'#ff7a3d',crystal:'#d4a0ff',boomerang:'#ff8fc4',shuriken:'#ffd27a'};
/** Weapon art is drawn this many avatar units across on the back. */
const BACK_WEAPON_SIZE=64;
/** The weapon hangs this far further back and up from the body than combatFrames.json's `back` (20/10,
 * matheus: a little gap so it reads as strapped on, not stuck into the body). The hands are not moved. */
const BACK_WEAPON_GAP:Point=[-8,-3];
/** The painted body sinks this many avatar units into the ground, as in DDTank: the terrain's
 * painted top (snow, grass) is soft and a body standing exactly on the collision line reads as floating. */
const GROUND_SINK=7;
/** Base skin of character-base.png; the fists follow the player's body color. */
const BASE_SKIN='#fcd0ac';

export interface CombatBodyState {pose:AvatarPose;poseTime:number;/** Ms since the fighter last charged: it stays up while the shot reaches the server. */sinceCharge:number;phase:number;walk:number;time:number;power:number;face?:FaceState;lively:number;weapon:boolean;modular:boolean;}
/** Draws the combat fighter facing right in avatar units from its contact point. Returns false
 * when the outfit has no combat atlas (yet), so the caller can fall back to the cut-out rig. */
export function drawCombatBody(c:CanvasRenderingContext2D,eq:Equipment,head:AvatarPart,state:CombatBodyState):boolean {
 const atlas=combatAtlas(eq),entry=ATLASES[eq.outfit];if(!atlas||!entry)return false;
 const blend=combatFrameBlend(state.pose,state.poseTime,state.phase,state.walk,state.sinceCharge),name=blend.name,index=combatFrameIndex(name),spec=COMBAT_FRAMES[name],next=COMBAT_FRAMES[blend.next];
 // Crawling (19/10, matheus: legs must move and the fists must pull, not push): the painted crawl drawings move the
 // legs while the head stays where the rest drawing has it; the fists keep the rest drawing's place and pull the
 // body along, reaching forward in the air and sliding back on the ground, one after the other.
 const rest=combatFrameIndex('rest'),crawling=name.startsWith('crawl')&&!!entry.frames[rest]?.lifted,art=index;
 const measured=entry.frames[crawling?rest:art]?.head??spec.head,dx=measured[0]-spec.head[0],dy=measured[1]-spec.head[1];
 const hit=state.pose==='hit'?Math.exp(-Math.max(0,state.poseTime)/210):0,breath=name==='rest'?Math.sin(state.time/900)*.35:0;
 const weapon=WEAPONS.find(item=>item.id===eq.weapon),color=effectColor[weapon?.effect??'brick']??'#ffe5a0';
 // The fists glide from this drawing's place to the next one's; crawling they also lift off the ground.
 const lift=name.startsWith('crawl')?state.walk:0,turn=state.phase;
 const fist=(k:0|1):Fist=>{const a=spec.fists[k],b=next.fists[k],m=blend.mix,up=lift*Math.max(0,Math.sin(turn+(k?Math.PI:0)))*2.5;
  return [a[0]+(b[0]-a[0])*m+dx,a[1]+(b[1]-a[1])*m+dy-up+breath,a[2]+(b[2]-a[2])*m];};
 c.save();c.translate(-hit*3+Math.sin(state.time/28)*hit*1.2,GROUND_SINK);
 // faceDown: the weapon on the back, behind the body and the head. Kneeling, the far fist goes behind the
 // body; lying, both fists sit in front of the chin like DDTank's, the forward one smaller and lower.
 const prone=name==='rest'||name==='hurt'||name.startsWith('crawl');
 if(state.weapon)drawBackWeapon(c,eq,spec.back[0]+BACK_WEAPON_GAP[0]+dx,spec.back[1]+BACK_WEAPON_GAP[1]+dy+breath,spec.backAngle,state.time);
 // Each fist hangs from a short forearm in the outfit's own sleeve color that starts under the painted
 // sleeve, so the hand reads as part of the arm (the outfit art ends its sleeves at the elbow).
 const [cw,ch]=COMBAT_ATLAS.cell,[ox,oy]=COMBAT_ATLAS.origin,ppu=COMBAT_ATLAS.pixelsPerUnit,sx=(art%COMBAT_ATLAS.columns)*cw,sy=Math.floor(art/COMBAT_ATLAS.columns)*ch;
 const cloth=eq.colors?.outfit??entry.sleeve??CATALOG[eq.outfit]?.color??'#2b3f9e';
 const arm=(k:0|1,to:Fist)=>{const [shoulder,elbow]=COMBAT_MANNEQUIN[name].sleeves[k],at=(p:Point):Point=>[p[0]+dx,p[1]+dy+breath*.4];
  drawArm(c,at(shoulder),at(elbow),to,cloth,eq.skin);};
 const drawnHands=!entry.frames[index]?.hands;
 if(drawnHands&&!prone){arm(0,fist(0));drawFist(c,eq.skin,fist(0),.9);}
 const atHead=(draw:()=>void)=>{c.save();c.translate(measured[0],measured[1]+breath);c.rotate(state.lively+hit*.05);c.scale(HEAD_SCALE,HEAD_SCALE);
  c.translate(-(HEAD_SILHOUETTE_CENTER[0]-625)*AVATAR_UNIT,-(HEAD_SILHOUETTE_CENTER[1]-1225)*AVATAR_UNIT);draw();c.restore();};
 // face: the head and the hair; then the outfit painting, then hat and glasses (DDTank's faceUp).
 const stroke=Math.sin(state.phase)*state.walk,sweep=Math.cos(state.phase)*state.walk,bob=crawling?stroke*.8:0;
 const paddle=(k:0|1):[number,number,number]|undefined=>{const f=entry.frames[crawling?rest:art]?.lifted?.[k];if(!f||!crawling)return f;const side=k?-1:1;
  return [f[0]-sweep*2.2*side,f[1]-Math.max(0,stroke*side)*2.4,f[2]];};
 const lifted=entry.frames[crawling?rest:art]?.lifted?[paddle(0)!,paddle(1)!]:undefined;
 if(lifted)drawBlockFist(c,eq.skin,lifted[1],breath*.4,.92);
 atHead(()=>{drawHeadRearLayers(c,eq,state.time,state.pose,state.modular);drawPart(c,head);drawHeadLayers(c,eq,state.time,state.pose,state.modular,state.face,'hair');});
 if(drawnHands&&prone)arm(0,fist(0));
 if(drawnHands)arm(1,fist(1));
 // Painted hands carry their own depth (DDTank): the near fist is painted over the chin, the far one only
 // where it shows past the face, so the body painting goes over the head as it is.
 c.drawImage(atlas,sx,sy,cw,ch,-ox/ppu,-oy/ppu+breath*.4-bob,cw/ppu,ch/ppu);
 atHead(()=>drawHeadLayers(c,eq,state.time,state.pose,state.modular,state.face,'top'));
 if(lifted)drawBlockFist(c,eq.skin,lifted[0],breath*.4,1);
 // The near fist goes over everything, under the chin while lying, like in DDTank.
 if(drawnHands&&prone)drawFist(c,eq.skin,fist(0),1);
 const front=fist(1);if(drawnHands)drawFist(c,eq.skin,front,1,prone?.8:1);
 if(state.weapon)drawThrowCue(c,name,state,front[0],front[1],color);
 c.restore();return true;
}
/** The universal fist, simple like DDTank's: a round skin-colored ball a little wider than tall, painted
 * in three tones (near-white top, the skin, a darker bottom) with a thin near-black outline; no fingers.
 * `shade` darkens the far one a little and `scale` shrinks the forward fist while lying. */
function drawFist(c:CanvasRenderingContext2D,skin:string|undefined,[x,y,angle]:Fist,shade:number,scale=1){
 const w=COMBAT_FIST_SIZE*.42*scale,h=COMBAT_FIST_SIZE*.38*scale,color=skin??BASE_SKIN;
 c.save();c.translate(x,y);c.rotate(angle);
 const ball=()=>{c.beginPath();c.ellipse(0,0,w,h,0,0,Math.PI*2);};
 ball();c.fillStyle=shadeColor(color,shade);c.fill();
 c.save();ball();c.clip();
 c.fillStyle=shadeColor(color,.86*shade,.74*shade,.66*shade);c.beginPath();c.ellipse(0,h*.95,w*1.2,h*.62,0,0,Math.PI*2);c.fill();
 const glow=c.createRadialGradient(-w*.25,-h*.5,0,-w*.25,-h*.5,w*.6);glow.addColorStop(0,lightTone(shade,246,236,.85));glow.addColorStop(.5,lightTone(shade,240,224,.35));glow.addColorStop(1,lightTone(shade,240,224,0));
 c.fillStyle=glow;c.fillRect(-w,-h,w*2,h*2);c.restore();
 ball();c.strokeStyle='#120e09';c.lineWidth=1.25;c.stroke();
 c.restore();
}
/** A lifted painted fist, like DDTank's lying hands: a slightly squared skin bun with a thin near-black
 * outline all round, so it closes against the face with a line instead of a see-through gap. */
function drawBlockFist(c:CanvasRenderingContext2D,skin:string|undefined,[x,y,r]:[number,number,number],lift:number,shade:number){
 const w=r*1.04,h=r*.92,color=skin??BASE_SKIN;
 c.save();c.translate(x,y+lift);
 const bun=()=>{c.beginPath();c.roundRect(-w,-h,w*2,h*2,r*.78);};
 bun();c.fillStyle=shadeColor(color,shade);c.fill();
 c.save();bun();c.clip();
 c.fillStyle=shadeColor(color,.9*shade,.8*shade,.73*shade);c.beginPath();c.ellipse(0,h*1.15,w*1.4,h*.6,0,0,Math.PI*2);c.fill();
 const glow=c.createRadialGradient(-w*.3,-h*.45,0,-w*.3,-h*.45,w*.75);glow.addColorStop(0,lightTone(shade,246,236,.85));glow.addColorStop(.5,lightTone(shade,240,224,.3));glow.addColorStop(1,lightTone(shade,240,224,0));
 c.fillStyle=glow;c.fillRect(-w,-h,w*2,h*2);c.restore();
 bun();c.strokeStyle='#120e09';c.lineWidth=.85;c.stroke();
 c.restore();
}
/** The arm under the painted body: the sleeve from the shoulder through the elbow (hidden where the outfit
 * painting already covers it), then a light cuff and a bit of wrist reaching the fist. A fist thrown far
 * (the windup) keeps a forearm of the usual length. */
function drawArm(c:CanvasRenderingContext2D,shoulder:Point,elbow:Point,[fx,fy]:Fist,cloth:string,skin:string|undefined){
 const vx=fx-elbow[0],vy=fy-elbow[1],length=Math.hypot(vx,vy);if(length<1)return;
 const reach=Math.min(length,FOREARM_MAX),ux=vx/length,uy=vy/length,start:Point=length>FOREARM_MAX?[fx-ux*reach,fy-uy*reach]:elbow;
 const cuff:Point=[fx-ux*Math.min(reach,7),fy-uy*Math.min(reach,7)],wrist:Point=[fx-ux*Math.min(reach,4.5),fy-uy*Math.min(reach,4.5)];
 const stroke=(points:readonly Point[],width:number,color:string)=>{c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);
  c.lineWidth=width+2.4;c.strokeStyle='#120e09';c.stroke();c.lineWidth=width;c.strokeStyle=color;c.stroke();};
 c.save();c.lineCap='round';c.lineJoin='round';
 stroke(length>FOREARM_MAX?[start,cuff]:[shoulder,elbow,cuff],7,cloth);
 stroke([cuff,wrist],6.6,'#f1e2c4');
 stroke([wrist,[fx,fy]],4.6,skin??BASE_SKIN);
 c.restore();
}
const FOREARM_MAX=26;
/** The fists' near-white highlight, darkened like the rest of a far fist (a canvas filter here cost more than the
 * whole body painting every frame). */
const lightTone=(shade:number,g:number,b:number,alpha:number)=>`rgba(${Math.round(255*shade)},${Math.round(g*shade)},${Math.round(b*shade)},${alpha})`;
const shadeColor=(hex:string,r:number,g=r,b=r)=>{const n=parseInt(hex.slice(1),16),f=(v:number,k:number)=>Math.min(255,Math.round(v*k));return `rgb(${f(n>>16&255,r)},${f(n>>8&255,g)},${f(n&255,b)})`;};
function drawBackWeapon(c:CanvasRenderingContext2D,eq:Equipment,x:number,y:number,angle:number,time:number){
 const level=eq.upgrade??0,image=asset(weaponAssetPath(eq.weapon,level));if(!image.complete||!image.naturalWidth)return;
 const weapon=WEAPONS.find(item=>item.id===eq.weapon);
 c.save();c.translate(x,y);c.rotate(angle);
 c.save();c.scale(.7,.7);drawWeaponEnergy(c,weapon?.effect??'brick',level,time);c.restore();
 if(level>=9){c.shadowColor=weapon?.color??'#ff7a3d';c.shadowBlur=level>=12?9:4;}
 // The 1254 px weapon painting shown 64 px wide: a copy at screen size, not a full filter pass every frame.
 drawScaled(c,image,-BACK_WEAPON_SIZE/2,-BACK_WEAPON_SIZE/2,BACK_WEAPON_SIZE,BACK_WEAPON_SIZE);c.restore();
}
/** The projectile glows in the fist while the shot charges; the release leaves a short swoosh. */
function drawThrowCue(c:CanvasRenderingContext2D,name:CombatFrameName,state:CombatBodyState,x:number,y:number,color:string){
 if(state.pose==='charge'&&name==='ready'){
  const r=6+state.power/100*4+Math.sin(state.time/70)*.8;
  c.save();c.shadowColor=color;c.shadowBlur=10;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#ffffff');g.addColorStop(.45,color);g.addColorStop(1,color+'00');c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.restore();
 }
 if(state.pose==='fire'&&(name==='release'||name==='follow')){
  const w=COMBAT_FRAMES.windup.fists[1],from=[w[0],w[1]],fade=Math.max(0,1-state.poseTime/300);
  c.save();c.globalAlpha*=fade*.75;c.strokeStyle=color;c.lineCap='round';c.shadowColor=color;c.shadowBlur=7;
  for(const [w,k] of [[6,1],[2.5,.9]] as const){c.lineWidth=w;c.beginPath();c.moveTo(from[0],from[1]);c.quadraticCurveTo(x+12*k,from[1]+10,x,y);c.stroke();}c.restore();
 }
}
