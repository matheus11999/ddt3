import type {Equipment} from '../../shared/catalog';
import {weaponAssetPath} from '../../shared/catalog';
import type {WalkingLeg} from './appearance';
import {asset,avatarRig,AVATAR_UNIT,drawHeadLayers,drawHeadRearLayers,drawPart,ellipse} from './appearance';

export type AvatarPose='idle'|'walk'|'aim'|'charge'|'fire'|'hit'|'fall'|'prone'|'victory'|'defeat';
export interface AvatarContext {pose?:AvatarPose;angle?:number;power?:number;slope?:number;poseTime?:number;movementDistance?:number;combat?:boolean;showAura?:boolean;}
export interface AvatarMotion {lastTime:number;walk:number;phase:number;facing:1|-1;previousFacing:1|-1;turn:number;pose:AvatarPose;poseAt:number;lie:number;lean:number;bodyY:number;leftArm:number;rightArm:number;headTilt:number;}
export function createAvatarMotion(facing:1|-1=1):AvatarMotion{return {lastTime:0,walk:0,phase:0,facing,previousFacing:facing,turn:1,pose:'idle',poseAt:0,lie:0,lean:0,bodyY:0,leftArm:0,rightArm:0,headTilt:0};}
const sigils=new Map<number,HTMLCanvasElement>();
const auraAtlas=asset('/assets/auras/upgrade-rings.png');
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
/** Opt-in light halos for profile, inventory and arena cards, with fully transparent centers. */
export function getUpgradeAura(level:number):HTMLCanvasElement|null{
 if(level<5||!auraAtlas.complete||!auraAtlas.naturalWidth)return null;
 const stage=level>=12?12:level>=9?9:5,known=sigils.get(stage);if(known)return known;
 const [cx,cy,r]=stage===12?[1790,360,340]:stage===9?[1097,347,347]:[387,358,345];
 const out=document.createElement('canvas');out.width=out.height=512;
 const c=out.getContext('2d')!;c.drawImage(auraAtlas,cx-r,cy-r,r*2,r*2,0,0,512,512);
 // Generated glow can reach a square crop's corners. Feather only its outer 19px;
 // the painted energy band and runes inside radius 236 remain unchanged.
 const margin=c.createRadialGradient(256,256,236,256,256,255);margin.addColorStop(0,'#fff');margin.addColorStop(1,'#fff0');
 c.globalCompositeOperation='destination-in';c.fillStyle=margin;c.fillRect(0,0,512,512);
 sigils.set(stage,out);return out;
}
export function drawAura(c:CanvasRenderingContext2D,level:number,time:number){
 const art=getUpgradeAura(level);if(!art)return;const reduced=motionPreference?.matches??false,t=reduced?0:time;
 const size=level>=12?177:level>=9?163:151,period=level>=12?12000:level>=9?15000:18000,rotation=t/period*Math.PI*2;
 const pulse=1+Math.sin(t/1800)*.018,color=level>=12?'#ffde7a':level>=9?'#c399ff':'#6ceaff';
 c.save();c.translate(0,-85);c.rotate(rotation);c.scale(pulse,pulse);
 c.globalCompositeOperation='screen';c.globalAlpha*=.64+Math.sin(t/1500)*.045;c.drawImage(art,-size/2,-size/2,size,size);
 const count=level>=12?7:level>=9?5:3;c.shadowColor=color;c.shadowBlur=4;
 for(let i=0;i<count;i++){
  const a=i*Math.PI*2/count-rotation*.38,r=size*(.44+(i%2)*.025),brightness=.72+Math.sin(t/700+i*1.7)*.18;
  c.save();c.globalAlpha*=brightness;ellipse(c,Math.cos(a)*r,Math.sin(a)*r,i%3===0?1.35:.9,i%3===0?1.35:.9,color);c.restore();
 }
 c.restore();
}

function animate(m:AvatarMotion,time:number,walking:boolean,facing:number,context:AvatarContext,outfitPose:'surfer'|'executive'|'racer'|'dancer'){
 const dt=m.lastTime?clamp(time-m.lastTime,0,60):16,blend=1-Math.exp(-dt/95);m.lastTime=time;
 const pose=context.pose??(walking?'walk':'idle');if(m.pose!==pose){m.pose=pose;m.poseAt=time;}
 m.walk=mix(m.walk,Number(walking||pose==='walk'),blend);const strideLength=outfitPose==='surfer'?42:36;m.phase+=context.movementDistance===undefined?dt/105*(.2+.8*m.walk):Math.abs(context.movementDistance)*Math.PI*2/strideLength;
 const direction=facing<0?-1:1;if(direction!==m.facing){m.previousFacing=m.facing;m.facing=direction;m.turn=0;}m.turn=Math.min(1,m.turn+dt/150);
 const poseTime=context.poseTime??time-m.poseAt,stride=Math.sin(m.phase),aiming=pose==='aim'||pose==='charge'||pose==='fire',recoil=pose==='fire'?Math.exp(-Math.max(0,poseTime)/145):0,slope=clamp(context.slope??0,-.5,.5);
 let lean=slope*.55+stride*.025*m.walk,leftArm=-stride*.3*m.walk,rightArm=stride*.26*m.walk,bodyY=0,headTilt=-slope*.24;
 if(aiming){const elevation=(clamp(context.angle??45,5,90)-45)*Math.PI/180;leftArm-=.85+elevation*.55;rightArm-=.38+elevation*.45;lean+=.045;headTilt-=.025+elevation*.06;}
 if(pose==='charge'){bodyY=3;lean+=.055;leftArm-=.05;headTilt-=.04;}
 if(pose==='fire'){lean-=recoil*.16;leftArm+=recoil*.22;rightArm+=recoil*.25;headTilt+=recoil*.065;}
 if(pose==='hit'){const jolt=Math.exp(-Math.max(0,poseTime)/210);lean-=.25*jolt;leftArm+=.4*jolt;rightArm-=.5*jolt;headTilt-=.1*jolt;bodyY=3*jolt;}
 if(pose==='fall'){lean+=Math.sin(time/170)*.08;leftArm=.65;rightArm=-.9;headTilt=-.07;bodyY=-3;}
 if(pose==='prone'){leftArm=-2.4;rightArm=-2.65;lean=0;headTilt=-1.05;}
 if(pose==='victory'){leftArm=2.3+Math.sin(time/180)*.12;rightArm=-2.4;bodyY=-Math.abs(Math.sin(time/260))*3;headTilt=-.05;}
 if(pose==='defeat'){lean=.2;bodyY=15;leftArm=.23;rightArm=.3;headTilt=.17;}
 if(outfitPose==='surfer'){
  // The illustration already has bent knees and a shaka gesture; keep that personality in motion.
  lean=slope*.32+Math.sin(time/720)*.018;headTilt=-slope*.15;
  bodyY=m.walk*1.8+Math.sin(time/880)*.55*(1-m.walk);
  if(aiming){lean+=.035;bodyY+=pose==='charge'?1.6:0;}
  if(pose==='fire')lean-=recoil*.09;
  if(pose==='hit')lean-=Math.exp(-Math.max(0,poseTime)/210)*.12;
  if(pose==='fall'){lean+=Math.sin(time/180)*.08;bodyY=-4;}
  if(pose==='victory'){bodyY=-Math.abs(Math.sin(time/240))*5;lean-=.025;}
  if(pose==='defeat'){lean=.12;bodyY=5;headTilt=.12;}
  if(pose==='prone'){lean=0;headTilt=-1.05;}
 }
 if(outfitPose==='executive'){
  // The lapel hand, pocket hand and crossed ankles belong to the painted formal stance.
  lean=slope*.25;headTilt=-.025-slope*.12;bodyY=Math.sin(time/1100)*.35;
  if(m.walk>.01){bodyY=m.walk*2;lean+=stride*.012*m.walk;}
  if(aiming){lean+=.02;headTilt-=.02;}
  if(pose==='charge')bodyY+=1;
  if(pose==='fire')lean-=recoil*.065;
  if(pose==='hit'){lean-=Math.exp(-Math.max(0,poseTime)/230)*.09;headTilt+=.06;}
  if(pose==='fall'){lean-=.06;bodyY=-2;}
  if(pose==='victory'){lean=-.035;headTilt=-.065;bodyY=-1;}
  if(pose==='defeat'){lean=.09;headTilt=.16;bodyY=2;}
  if(pose==='prone'){lean=0;headTilt=-1.05;}
 }
 m.lean=mix(m.lean,lean,blend);m.bodyY=mix(m.bodyY,bodyY,blend);m.leftArm=mix(m.leftArm,leftArm,blend);m.rightArm=mix(m.rightArm,rightArm,blend);m.headTilt=mix(m.headTilt,headTilt,blend);m.lie=mix(m.lie,Number(pose==='prone'),blend);
 return {pose,poseTime,stride,aiming,recoil,slope};
}

export interface WalkingLegFrame {hip:[number,number];knee:[number,number];ankle:[number,number];footAngle:number;grounded:boolean;phase:number;}
/** A planted foot moves backward exactly as far as the avatar advances; the other clears the floor. */
export function sampleWalkingLeg(leg:WalkingLeg,phase:number,bodyY=3,lean=0,slope=0,step=10.5):WalkingLegFrame{
 const p=((phase%(Math.PI*2))+Math.PI*2)%(Math.PI*2),grounded=p<Math.PI,t=grounded?p/Math.PI:(p-Math.PI)/Math.PI;
 const travel=grounded?step*(1-2*t):-step+2*step*t*t*(3-2*t),lift=grounded?0:Math.sin(t*Math.PI)**2*10;
 const hx=(leg.hip[0]-625)*AVATAR_UNIT,hy=(leg.hip[1]-1225)*AVATAR_UNIT;
 const hip:[number,number]=[hx*Math.cos(lean)-(hy+32)*Math.sin(lean),bodyY-32+hx*Math.sin(lean)+(hy+32)*Math.cos(lean)];
 const x=(leg.ankle[0]-625)*AVATAR_UNIT+travel,ankle:[number,number]=[x,(leg.ankle[1]-leg.groundY)*AVATAR_UNIT-lift+Math.tan(slope)*x];
 const l1=Math.hypot(leg.knee[0]-leg.hip[0],leg.knee[1]-leg.hip[1])*AVATAR_UNIT,l2=Math.hypot(leg.ankle[0]-leg.knee[0],leg.ankle[1]-leg.knee[1])*AVATAR_UNIT;
 const dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],raw=Math.hypot(dx,dy),distance=clamp(raw,.1,l1+l2-.05),ux=dx/raw,uy=dy/raw,a=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-a*a));
 return {hip,knee:[hip[0]+ux*a+uy*height,hip[1]+uy*a-ux*height],ankle,footAngle:grounded?slope:Math.sin(t*Math.PI*2)*.17+slope,grounded,phase:p};
}
function drawWalkingLeg(c:CanvasRenderingContext2D,leg:WalkingLeg,frame:WalkingLegFrame){
 const draw=(part:WalkingLeg['thigh'],joint:[number,number],angle:number)=>drawPart(c,part,angle,joint[0]-(part.pivot[0]-625)*AVATAR_UNIT,joint[1]-(part.pivot[1]-1225)*AVATAR_UNIT);
 const thighAngle=Math.atan2(frame.knee[1]-frame.hip[1],frame.knee[0]-frame.hip[0])-Math.atan2(leg.knee[1]-leg.hip[1],leg.knee[0]-leg.hip[0]);
 const shinAngle=Math.atan2(frame.ankle[1]-frame.knee[1],frame.ankle[0]-frame.knee[0])-Math.atan2(leg.ankle[1]-leg.knee[1],leg.ankle[0]-leg.knee[0]);
 draw(leg.foot,frame.ankle,frame.footAngle);draw(leg.shin,frame.knee,shinAngle);draw(leg.thigh,frame.hip,thighAngle);
}

function drawCombatWeapon(c:CanvasRenderingContext2D,eq:Equipment,time:number,angle:number,recoil:number,charging:boolean,power:number){
 const level=eq.upgrade??0,w=asset(weaponAssetPath(eq.weapon,level));if(!w.complete||!w.naturalWidth)return;
 // The server's projectile starts at x + 27*facing, y - 40. Anchor the painted muzzle there.
 c.save();c.translate(27*160/112-recoil*5,-40*160/112);c.rotate(-(angle-30)*Math.PI/180-recoil*.06);
 if(level>=9||charging){c.shadowColor=eq.weapon==='ember'?'#ffb45a':eq.weapon==='volt'?'#69dfff':eq.weapon==='dynamite'?'#ffb52c':eq.weapon==='brick'?'#ff7a3d':'#d4a0ff';c.shadowBlur=charging?5+power/18:level>=12?9:4;}
 if(eq.weapon==='dynamite'||eq.weapon==='brick')c.drawImage(w,-40,-10,68,68);else c.drawImage(w,-67.2,-29.5,82,82);c.restore();
}

/** A layered 2D cutout rig. Every item shares the head/chest/hand transforms in all poses. */
export function drawAvatar(c:CanvasRenderingContext2D,eq:Equipment,x:number,y:number,height:number,time:number,walking=false,facing=1,weapon=true,motion?:AvatarMotion,context:AvatarContext={}){
 const rig=avatarRig(eq);if(!rig||context.combat&&!rig.combat)return;
 const m=motion??createAvatarMotion(facing<0?-1:1);if(!motion){m.phase=time/105;m.walk=Number(walking||context.pose==='walk');}
 const {pose,stride,aiming,recoil,slope}=animate(m,time,walking,facing,context,rig.outfitPose),walk=m.walk,lie=m.lie,bounce=((1.2+Math.cos(m.phase*2)*.55)*walk+Math.sin(time/620)*.65*(1-walk))*(1-lie);
 c.save();c.translate(x,y);c.scale(height/160,height/160);ellipse(c,-lie*3,-1,(rig.outfitPose==='surfer'?40:rig.outfitPose==='executive'?23:30)+lie*25,7-lie*2,'#162c3c35');
 if(context.showAura&&!context.combat)drawAura(c,eq.upgrade??0,time);
 const body=(direction:number,opacity:number)=>{
  if(opacity<.01)return;c.save();c.globalAlpha*=opacity;c.scale(direction*(1-Math.sin(m.turn*Math.PI)*.12),1);
  if(context.combat&&rig.combat){
   const painted=rig.combat,kick=Math.sin(m.phase)*walk,breath=Math.sin(time/900)*.28*(1-walk),hit=pose==='hit'?Math.exp(-Math.max(0,context.poseTime??0)/210):0;
   // Weapon is behind every body/head layer, unlike the menu's hand-held presentation.
   if(weapon)drawCombatWeapon(c,eq,time,context.angle??45,recoil,pose==='charge',context.power??0);
   c.save();c.translate(-recoil*3-hit*2,breath+Math.abs(kick)*.5);c.rotate(slope*.13);
   drawPart(c,painted.farLeg,-kick*.075,0,-Math.max(0,kick)*1.2);
   drawPart(c,painted.nearLeg,kick*.055,0,-Math.max(0,-kick)*.8);
   drawPart(c,painted.torso,0,-Math.sin(m.phase+.5)*walk*.7,pose==='charge'?.7:0);
   const neckX=(painted.neck[0]-625)*AVATAR_UNIT,neckY=(painted.neck[1]-1225)*AVATAR_UNIT;
   c.save();c.translate(neckX,neckY);c.rotate((pose==='defeat'?.13:pose==='victory'?-.035:0)-recoil*.04+hit*.045-slope*.13);c.translate(-25*AVATAR_UNIT,615*AVATAR_UNIT);
   drawHeadRearLayers(c,eq,time,pose,rig.modular);drawPart(c,rig.head);if(rig.neckCloth)drawPart(c,rig.neckCloth);drawHeadLayers(c,eq,time,pose,rig.modular);c.restore();
   c.restore();c.restore();return;
  }
  const rawWalk=rig.walking?clamp((walk-.04)/.75,0,1)*(1-lie):0,walkBlend=rawWalk>.08?1:0,rootY=bounce+m.bodyY,step=(rig.outfitPose==='surfer'?10.5:9)*Math.max(.25,rawWalk);
  // Switch one opaque silhouette at contact; alpha-crossfading two sets of legs creates ghost feet.
  if(rig.walking&&walkBlend>.001){
   c.save();c.globalAlpha*=walkBlend;
   const far=sampleWalkingLeg(rig.walking.far,m.phase+Math.PI,rootY,m.lean,slope,step),near=sampleWalkingLeg(rig.walking.near,m.phase,rootY,m.lean,slope,step);
   for(const frame of [far,near])if(frame.grounded)ellipse(c,frame.ankle[0]+2,Math.tan(slope)*frame.ankle[0]-.5,6,1.4,'#10213235');
   drawWalkingLeg(c,rig.walking.far,far);drawWalkingLeg(c,rig.walking.near,near);c.restore();
  }
  c.save();c.translate(-24*lie,rootY+(rig.outfitPose==='surfer'?-8:14)*lie);c.translate(0,-32);c.rotate(m.lean+lie*Math.PI/2);c.translate(0,32);
  if(walkBlend<.999){c.save();c.globalAlpha*=1-walkBlend;drawPart(c,rig.stanceBody);c.restore();}
  if(rig.walking&&walkBlend>.001){c.save();c.globalAlpha*=walkBlend;drawPart(c,rig.walking.torso);c.restore();}
  c.save();const headPivotX=25*AVATAR_UNIT,headPivotY=-615*AVATAR_UNIT;c.translate(headPivotX,headPivotY);c.rotate(m.headTilt+Math.sin(time/1700)*.006);c.translate(-headPivotX,-headPivotY);drawHeadRearLayers(c,eq,time,pose,rig.modular);drawPart(c,rig.head);if(rig.neckCloth)drawPart(c,rig.neckCloth);drawHeadLayers(c,eq,time,pose,rig.modular);c.restore();
  if(weapon){const level=eq.upgrade??0,w=asset(weaponAssetPath(eq.weapon,level));if(w.complete&&w.naturalWidth){
   c.save();const angle=aiming?-(clamp(context.angle??45,5,90)-35)*Math.PI/180:0;
   c.translate(mix(31-stride*2.8*walk-recoil*7,7,lie),mix(-35-Math.abs(stride)*1.6*walk-(aiming?5:0),-125,lie));c.rotate(Math.sin(time/600)*.02+stride*.065*walk+angle-recoil*.17-lie*Math.PI/2);
   if(pose==='charge'){c.save();c.globalAlpha*=.18+clamp(context.power??50,0,100)/250;c.shadowColor='#ffe5a0';c.shadowBlur=12;ellipse(c,11,-9,15+Math.sin(time/80)*2,15,'#fbe3a6');c.restore();}
   if(level>=9){const color=eq.weapon==='ember'?'#ffb45a':eq.weapon==='volt'?'#69dfff':eq.weapon==='dynamite'?'#ffb52c':eq.weapon==='brick'?'#ff7a3d':'#d4a0ff';c.shadowColor=color;c.shadowBlur=level>=12?17:level>=10?7:3;c.save();c.globalAlpha*=.25+Math.sin(time/400)*.05;ellipse(c,5,-5,level>=12?29:20,level>=12?29:20,color);c.restore();if(level>=12)for(let i=0;i<5;i++){const a=time/700+i*1.26;ellipse(c,5+Math.cos(a)*30,-5+Math.sin(a)*25,1.5,1.5,'#fff4bf');}}
   c.drawImage(w,-35,-46,82,82);c.restore();
  }}c.restore();c.restore();
 };
 const turn=m.turn*m.turn*(3-2*m.turn);if(turn<1)body(m.previousFacing,1-turn);body(m.facing,turn);c.restore();
}
