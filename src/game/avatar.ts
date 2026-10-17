import type {Equipment} from '../../shared/catalog';
import {CATALOG,WEAPONS,weaponAssetPath} from '../../shared/catalog';
import {drawWeaponEnergy} from './weaponEffects';
import type {CombatRig,WalkingLeg} from './appearance';
import {asset,avatarRig,AVATAR_UNIT,drawHeadLayers,drawHeadRearLayers,drawPart,ellipse,getFacePortrait,visual} from './appearance';
import {COSTUMES,drawCostume} from './costumes';
import {FACE_REGISTRATION} from './faces';
import {HEAD_SCALE} from './rig/anchors';

export type AvatarPose='idle'|'walk'|'aim'|'charge'|'fire'|'hit'|'fall'|'prone'|'victory'|'defeat';
export interface AvatarContext {pose?:AvatarPose;angle?:number;power?:number;slope?:number;poseTime?:number;movementDistance?:number;combat?:boolean;showAura?:boolean;animated?:boolean;auraAnimated?:boolean;weaponOffset?:number;weaponSide?:1|-1;weaponScale?:number;weaponVerticalOffset?:number;groundedShadow?:boolean;}
export interface AvatarMotion {lastTime:number;walk:number;phase:number;facing:1|-1;previousFacing:1|-1;turn:number;pose:AvatarPose;poseAt:number;lie:number;lean:number;bodyY:number;leftArm:number;rightArm:number;headTilt:number;arm:number;}
export function createAvatarMotion(facing:1|-1=1):AvatarMotion{return {lastTime:0,walk:0,phase:0,facing,previousFacing:facing,turn:1,pose:'idle',poseAt:0,lie:0,lean:0,bodyY:0,leftArm:0,rightArm:0,headTilt:0,arm:0};}
const sigils=new Map<number,HTMLCanvasElement>();
const auraSigils={5:asset('/assets/ui/aura-green-sigil.png?v=4'),9:asset('/assets/ui/aura-purple-sigil.png?v=2'),12:asset('/assets/ui/aura-gold-sigil.png?v=2')};
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
/** Painted transparent sigils: green +5, purple +9, gold +12. */
export function getUpgradeAura(level:number):HTMLCanvasElement|null{
 if(level<5)return null;
 const stage=level>=12?12:level>=9?9:5,known=sigils.get(stage);if(known)return known;
 const image=auraSigils[stage];if(!image.complete||!image.naturalWidth)return null;
 const out=document.createElement('canvas');out.width=out.height=1024;
 const c=out.getContext('2d')!;c.drawImage(image,0,0,1024,1024);
 sigils.set(stage,out);return out;
}
export function drawAura(c:CanvasRenderingContext2D,level:number,time:number){
 const art=getUpgradeAura(level);if(!art)return;const reduced=motionPreference?.matches??false,t=reduced?0:time;
 const tier=level>=12?2:level>=9?1:0,size=[168,182,198][tier],period=[18000,15000,12000][tier],rotation=t/period*Math.PI*2;
 const color=['#71ed9b','#c399ff','#ffde7a'][tier],deep=['#16a24f','#7a2fd6','#f09a12'][tier],pulse=1+Math.sin(t/1800)*.022,r=size/2;
 c.save();c.translate(0,-88);
 // Soft bloom behind the sigil gives the ring depth on light and dark panels alike.
 const bloom=c.createRadialGradient(0,0,r*.12,0,0,r*1.08);
 bloom.addColorStop(0,color+'66');bloom.addColorStop(.55,deep+'2e');bloom.addColorStop(1,deep+'00');
 c.save();c.globalAlpha*=.85+Math.sin(t/1300)*.1;c.fillStyle=bloom;c.beginPath();c.arc(0,0,r*1.08,0,Math.PI*2);c.fill();c.restore();
 // Light shafts from +12 rotate slowly against the sigil.
 if(tier===2){c.save();c.rotate(-rotation*.5);c.globalAlpha*=.22+Math.sin(t/900)*.06;
  for(let i=0;i<12;i++){c.rotate(Math.PI/6);const beam=c.createLinearGradient(0,0,0,-r*1.15);beam.addColorStop(0,color+'00');beam.addColorStop(.35,color+'cc');beam.addColorStop(1,color+'00');c.fillStyle=beam;c.beginPath();c.moveTo(-r*.05,0);c.lineTo(0,-r*1.15);c.lineTo(r*.05,0);c.fill();}
  c.restore();}
 // Main sigil, then a smaller counter-rotating copy from +9 for a layered seal.
 c.save();c.rotate(rotation);c.scale(pulse,pulse);c.shadowColor=color;c.shadowBlur=10;c.globalAlpha*=.88+Math.sin(t/1500)*.04;c.drawImage(art,-r,-r,size,size);c.restore();
 if(tier>=1){c.save();c.rotate(-rotation*1.6);c.globalAlpha*=.5+Math.sin(t/1100)*.08;const inner=size*.58;c.drawImage(art,-inner/2,-inner/2,inner,inner);c.restore();}
 // Pulsing ring of light just inside the sigil edge.
 c.save();c.strokeStyle=color;c.lineWidth=1.4;c.shadowColor=color;c.shadowBlur=8;c.globalAlpha*=.35+Math.sin(t/700)*.2;c.beginPath();c.arc(0,0,r*(.86+Math.sin(t/1600)*.02),0,Math.PI*2);c.stroke();c.restore();
 // Orbiting gems.
 const count=[3,5,7][tier];c.save();c.shadowColor=color;c.shadowBlur=5;
 for(let i=0;i<count;i++){
  const a=i*Math.PI*2/count-rotation*.38,orbit=r*(.9+(i%2)*.05),brightness=.72+Math.sin(t/700+i*1.7)*.18,dot=i%3===0?1.5:1;
  c.save();c.globalAlpha*=brightness;ellipse(c,Math.cos(a)*orbit,Math.sin(a)*orbit,dot,dot,color);c.restore();
 }
 c.restore();
 // Motes rise through the circle; deterministic per time so still frames stay stable.
 const motes=[6,10,16][tier];
 for(let i=0;i<motes;i++){
  const seed=i*97.13,life=2600+(seed%900),phase=((t+seed*41)%life)/life,x=Math.sin(seed)*r*.7+Math.sin(t/900+seed)*3,y=r*.75-phase*r*1.6;
  c.save();c.globalAlpha*=Math.sin(phase*Math.PI)*.85;c.shadowColor=color;c.shadowBlur=6;ellipse(c,x,y,1+(i%3)*.35,1+(i%3)*.35,i%4===0?'#ffffff':color);c.restore();
 }
 c.restore();
}

function animate(m:AvatarMotion,time:number,walking:boolean,facing:number,context:AvatarContext,outfitPose:'surfer'|'executive'|'racer'|'dancer'|'cartographer'){
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
 if(outfitPose==='cartographer'){
  // The forward map-reading stance is painted into the outfit. Keep its
  // deliberate lean and compact, planted gait instead of borrowing Surfista.
  lean=.035+slope*.28+stride*.014*m.walk;headTilt=-.018-slope*.14;
  bodyY=m.walk*1.25+Math.sin(time/1180)*.3*(1-m.walk);
  if(aiming){lean+=.024;headTilt-=.025;}
  if(pose==='charge')bodyY+=1.3;
  if(pose==='fire')lean-=recoil*.08;
  if(pose==='hit')lean-=Math.exp(-Math.max(0,poseTime)/210)*.11;
  if(pose==='fall'){lean+=.08;bodyY=-3;}
  if(pose==='victory'){lean=-.025;bodyY=-Math.abs(Math.sin(time/300))*2.5;}
  if(pose==='defeat'){lean=.14;headTilt=.14;bodyY=3;}
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
 c.save();c.translate(eq.weapon==='dynamite'||eq.weapon==='brick'?-7:-30,eq.weapon==='dynamite'||eq.weapon==='brick'?18:4);drawWeaponEnergy(c,WEAPONS.find(weapon=>weapon.id===eq.weapon)?.effect??'fire',level,time);c.restore();
 if(level>=9||charging){c.shadowColor=eq.weapon==='ember'?'#ffb45a':eq.weapon==='volt'?'#69dfff':eq.weapon==='dynamite'?'#ffb52c':eq.weapon==='brick'?'#ff7a3d':'#d4a0ff';c.shadowBlur=charging?5+power/18:level>=12?9:4;}
 if(eq.weapon==='dynamite'||eq.weapon==='brick')c.drawImage(w,-40,-10,68,68);else c.drawImage(w,-67.2,-29.5,82,82);c.restore();
}

interface ProneThrow {angle:number;front:boolean;held:number;trail:number;from:number;dx:number;}
/** Arm rotation around the universal shoulder, measured from the painted rest
 * pose where the fists lie on the ground (negative raises them). Charging winds
 * the arms back over the head with the projectile in hand; firing whips them
 * forward along the aim, then they settle back on the ground. */
function proneThrow(m:AvatarMotion,pose:AvatarPose,poseTime:number,angle:number,power:number,crawl:number,cycle:number,time:number,rest:number):ProneThrow{
 const aim=clamp(angle,5,90)*Math.PI/180,windUp=-Math.PI*.5-1.05-power/100*.2-rest;
 if(pose==='fire'){
  const t=Math.max(0,poseTime),release=-aim-rest,through=-aim*.2-rest*.55;
  // The projectile leaves at t=0: whip past the release, then lower the arms.
  const a=t<60?mix(windUp*.55+release*.45,release,1-(1-t/60)**3):t<170?mix(release,through,(t-60)/110):mix(through,0,clamp((t-170)/180,0,1));
  m.arm=a;return {angle:a,front:true,held:0,trail:clamp(1-t/200,0,1),from:windUp,dx:5*clamp(1-t/350,0,1)};
 }
 let target=0;
 if(pose==='charge')target=windUp+Math.sin(time/55)*.04*power/100;
 else if(pose==='aim')target=-.12;
 else if(pose==='hit')target=.08;
 else if(pose==='victory')target=-rest-1.4+Math.sin(time/180)*.2;
 // Paddle stroke: reach out and pull back, a quarter cycle ahead of the legs.
 target+=-(.18+.18*Math.sin(cycle+Math.PI/2))*crawl;
 m.arm=mix(m.arm,target,pose==='charge'?.3:.22);
 return {angle:m.arm,front:false,held:pose==='charge'?1:0,trail:0,from:0,dx:Math.cos(cycle)*2*crawl};
}
const effectColor:Record<string,string>={fire:'#ffb45a',electric:'#69dfff',dynamite:'#ffb52c',brick:'#ff7a3d',crystal:'#d4a0ff'};
export const proneArmRest=(rig:CombatRig)=>Math.atan2(rig.hand![1]-rig.arms!.pivot[1],rig.hand![0]-rig.arms!.pivot[0]);
function drawProneArms(c:CanvasRenderingContext2D,rig:CombatRig,swing:ProneThrow,eq:Equipment){
 const arms=rig.arms!,hand=rig.hand!,[px,py]=arms.pivot,rest=proneArmRest(rig),grow=1+.5*clamp(-swing.angle/1.2,0,1),reach=Math.hypot(hand[0]-px,hand[1]-py)*AVATAR_UNIT*grow;
 const color=effectColor[WEAPONS.find(weapon=>weapon.id===eq.weapon)?.effect??'fire']??'#ffe5a0',ex=(px-625)*AVATAR_UNIT+swing.dx,ey=(py-1225)*AVATAR_UNIT;
 if(swing.trail>.01){
  // Swoosh along the throwing arc, fading as the fists follow through.
  c.save();c.globalAlpha*=swing.trail*.8;c.strokeStyle=color;c.lineCap='round';c.shadowColor=color;c.shadowBlur=7;
  for(const [w,r] of [[7,1.05],[3,.84]]){c.lineWidth=w;c.beginPath();c.arc(ex,ey,reach*r,rest+swing.from,rest+swing.angle);c.stroke();}c.restore();
 }
 // Raised arms grow slightly so the throw reads at the small combat size.
 c.save();c.translate(ex,ey);c.scale(grow,grow);c.translate(-ex,-ey);drawPart(c,arms,swing.angle,swing.dx);c.restore();
 if(swing.held>.01){
  // The projectile glows in the raised fists while the shot charges.
  const a=rest+swing.angle,x=ex+Math.cos(a)*reach,y=ey+Math.sin(a)*reach;
  c.save();c.globalAlpha*=swing.held;c.shadowColor=color;c.shadowBlur=10;const g=c.createRadialGradient(x,y,0,x,y,8);g.addColorStop(0,'#ffffff');g.addColorStop(.45,color);g.addColorStop(1,color+'00');c.fillStyle=g;c.beginPath();c.arc(x,y,8,0,Math.PI*2);c.fill();c.restore();
 }
}
/** Combat weapon worn on the back, behind the body and head, pointing along the aim. */
function drawBackWeapon(c:CanvasRenderingContext2D,eq:Equipment,time:number,angle:number,recoil:number,charging:boolean,power:number,surge:number,crawl:number,cycle:number){
 c.save();c.translate(PRONE_WEAPON.mount[0]+surge*.8,PRONE_WEAPON.mount[1]-Math.abs(Math.cos(cycle))*1.2*crawl);c.rotate(Math.sin(cycle)*.04*crawl);c.scale(PRONE_WEAPON.scale,PRONE_WEAPON.scale);c.translate(-27*160/112,40*160/112);
 drawCombatWeapon(c,eq,time,angle,recoil,charging,power);c.restore();
}
/** Back mount, in avatar units from the feet origin (facing right). */
export const PRONE_WEAPON={mount:[-34,-66] as [number,number],scale:.82};
function visibleHeadEquipment(eq:Equipment):Equipment {
 return eq.visibility?.hat===false||eq.visibility?.glasses===false?{...eq,hat:eq.visibility?.hat===false?'hat-none':eq.hat,glasses:eq.visibility?.glasses===false?'glasses-none':eq.glasses}:eq;
}

/** Lobby identity portrait: the universal head and its actual headwear, never a
 * costume, body, weapon or aura. Uses the same registration and hair occlusion
 * passes as the full avatar, without waiting for any outfit artwork. */
export function drawAvatarPortrait(c:CanvasRenderingContext2D,equipment:Equipment,x:number,y:number,size:number,facing=1){
 const eq=visibleHeadEquipment(equipment),head=getFacePortrait(CATALOG[eq.face]?.slot==='face'?eq.face:'face-brave');
 const hairPath=visual(eq,'hair').asset,hair=hairPath?asset(hairPath):null;
 if(!head||hair&&(!hair.complete||!hair.naturalWidth))return;
 const covered=eq.hat!=='hat-none',tall=eq.hat==='hat-mage',frame=tall?640:covered?560:540,centerX=635,centerY=tall?310:covered?355:370;
 c.save();c.translate(x+size/2,y+size/2);c.scale((facing<0?-1:1)*size/(frame*AVATAR_UNIT),size/(frame*AVATAR_UNIT));c.translate((625-centerX)*AVATAR_UNIT,(1225-centerY)*AVATAR_UNIT);
 drawHeadRearLayers(c,eq,0,'idle',true);
 // Reuse the universal face registration instead of framing each expression.
 const [hx,hy,hw,hh]=FACE_REGISTRATION.headRect;
 c.drawImage(head,hx,hy,hw,hh,(hx-625)*AVATAR_UNIT,(hy-1225)*AVATAR_UNIT,hw*AVATAR_UNIT,hh*AVATAR_UNIT);
 drawHeadLayers(c,eq,0,'idle',true);c.restore();
}

/** Soft room-card contact shadow, independent of the rotating light aura. */
function drawGroundedShadow(c:CanvasRenderingContext2D,width:number){
 c.save();c.translate(0,-1);c.scale(width,6);
 const shade=c.createRadialGradient(0,0,0,0,0,1);
 shade.addColorStop(0,'#29344259');shade.addColorStop(.45,'#29344230');shade.addColorStop(1,'#29344200');
 c.fillStyle=shade;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();c.restore();
}

/** A layered 2D cutout rig. Every item shares the head/chest/hand transforms in all poses. */
export function drawAvatar(c:CanvasRenderingContext2D,eq:Equipment,x:number,y:number,height:number,time:number,walking=false,facing=1,weapon=true,motion?:AvatarMotion,context:AvatarContext={}){
 const auraTime=context.animated!==false||context.auraAnimated?time:0;
 // Frozen portraits must also ignore prior motion state and the wall clock when
 // redrawn for an asset load or an equipment change. This freezes equipment VFX too.
 if(context.animated===false){time=0;motion=undefined;context={...context,poseTime:0,movementDistance:0};}
 // Visibility is a render preference: never mutate equipment, attributes or saved dyes.
 eq=visibleHeadEquipment(eq);
 if(COSTUMES[eq.costume]&&eq.visibility?.costume!==false){
  const m=motion??createAvatarMotion(facing<0?-1:1);if(!motion){m.phase=time/105;m.walk=Number(walking||context.pose==='walk');}
  const {pose,poseTime,recoil,slope}=animate(m,time,walking,facing,context,'racer');
  c.save();c.translate(x,y);c.scale(height/160,height/160);
  if(context.groundedShadow&&!context.combat)drawGroundedShadow(c,30);
  if(context.showAura&&!context.combat)drawAura(c,eq.upgrade??0,auraTime);
  const paint=(direction:number,opacity:number)=>{if(opacity<.01)return;c.save();c.globalAlpha*=opacity;c.scale(direction*(1-Math.sin(m.turn*Math.PI)*.12),1);
   // Menu cards keep the miniature weapon legible beside a costume. Combat
   // retains the original layering and authoritative muzzle placement.
   const paintWeapon=()=>{if(!weapon)return;c.save();if(!context.combat){const scale=clamp(context.weaponScale??1,.4,1.2);c.scale(context.weaponSide??1,1);c.translate(0,clamp(context.weaponVerticalOffset??0,-15,24));c.translate((context.weaponOffset??0)+27*160/112,-40*160/112);c.scale(scale,scale);c.translate(-27*160/112,40*160/112);}drawCombatWeapon(c,eq,time,context.angle??45,recoil,pose==='charge',context.power??0);c.restore();};
   const foregroundWeapon=!context.combat&&context.weaponSide===-1;
   if(!foregroundWeapon)paintWeapon();
   drawCostume(c,eq.costume,{pose,phase:m.phase,walk:m.walk,poseTime,angle:context.angle??45,power:context.power??0,slope,combat:context.combat??false,time});
   if(foregroundWeapon)paintWeapon();c.restore();};
  const turn=m.turn*m.turn*(3-2*m.turn);if(turn<1)paint(m.previousFacing,1-turn);paint(m.facing,turn);c.restore();return;
 }
 const rig=avatarRig(eq);if(!rig||context.combat&&!rig.combat)return;
 const m=motion??createAvatarMotion(facing<0?-1:1);if(!motion){m.phase=time/105;m.walk=Number(walking||context.pose==='walk');}
 const {pose,stride,aiming,recoil,slope}=animate(m,time,walking,facing,context,rig.outfitPose),walk=m.walk,lie=m.lie,bounce=((1.2+Math.cos(m.phase*2)*.55)*walk+Math.sin(time/620)*.65*(1-walk))*(1-lie);
 c.save();c.translate(x,y);c.scale(height/160,height/160);if(context.groundedShadow&&!context.combat)drawGroundedShadow(c,rig.outfitPose==='surfer'?38:rig.outfitPose==='executive'?23:30);else ellipse(c,-lie*3,-1,(rig.outfitPose==='surfer'?40:rig.outfitPose==='executive'?23:30)+lie*25,7-lie*2,'#162c3c35');
 if(context.showAura&&!context.combat)drawAura(c,eq.upgrade??0,auraTime);
 const body=(direction:number,opacity:number)=>{
  if(opacity<.01)return;c.save();c.globalAlpha*=opacity;c.scale(direction*(1-Math.sin(m.turn*Math.PI)*.12),1);
  if(context.combat&&rig.combat){
   const painted=rig.combat,crawl=walk,cycle=m.phase,stroke=Math.sin(cycle),breath=Math.sin(time/900)*.28*(1-crawl),hit=pose==='hit'?Math.exp(-Math.max(0,context.poseTime??0)/210):0;
   // Crawl: the chest surges forward on each stroke while the legs drag and
   // kick in turn and the forearms paddle. Built only from the universal prone
   // layers, so every outfit crawls the same way.
   const surge=stroke*3.6*crawl,rise=Math.abs(Math.cos(cycle))*2*crawl,throwing=proneThrow(m,pose,context.poseTime??0,context.angle??45,context.power??0,crawl,cycle,time,painted.arms?proneArmRest(painted):0);
   if(weapon)drawBackWeapon(c,eq,time,context.angle??45,recoil,pose==='charge',context.power??0,surge,crawl,cycle);
   c.save();c.translate(-recoil*3-hit*2,breath);c.rotate(slope*.13);
   c.save();c.translate(-surge*.55,0);
   drawPart(c,painted.farLeg,Math.max(0,stroke)*.46*crawl-.03*crawl,0,-Math.max(0,stroke)*2*crawl);
   drawPart(c,painted.nearLeg,Math.max(0,-stroke)*.42*crawl-.03*crawl,0,-Math.max(0,-stroke)*1.6*crawl);
   c.restore();
   c.save();c.translate(surge,-rise);c.rotate(stroke*.04*crawl);
   drawPart(c,painted.torso,0,0,pose==='charge'?.7:0);
   const arms=()=>{if(painted.arms)drawProneArms(c,painted,throwing,eq);};
   if(!throwing.front)arms();
   const neckX=(painted.neck[0]-625)*AVATAR_UNIT,neckY=(painted.neck[1]-1225)*AVATAR_UNIT;
   c.save();c.translate(neckX,neckY);c.rotate((pose==='defeat'?.13:pose==='victory'?-.035:0)-recoil*.04+hit*.045-slope*.13+Math.sin(cycle*2)*.03*crawl);c.scale(HEAD_SCALE,HEAD_SCALE);c.translate(-25*AVATAR_UNIT,615*AVATAR_UNIT);
   drawHeadRearLayers(c,eq,time,pose,rig.modular);drawPart(c,rig.head);if(rig.neckCloth)drawPart(c,rig.neckCloth,0,0,rig.outfitPose==='cartographer'?-5:0);drawHeadLayers(c,eq,time,pose,rig.modular);c.restore();
   if(throwing.front)arms();
   c.restore();c.restore();c.restore();return;
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
  c.save();const headPivotX=25*AVATAR_UNIT,headPivotY=-615*AVATAR_UNIT;c.translate(headPivotX,headPivotY);c.rotate(m.headTilt+Math.sin(time/1700)*.006);c.scale(HEAD_SCALE,HEAD_SCALE);c.translate(-headPivotX,-headPivotY);drawHeadRearLayers(c,eq,time,pose,rig.modular);drawPart(c,rig.head);if(rig.neckCloth)drawPart(c,rig.neckCloth,0,0,rig.outfitPose==='cartographer'?-5:0);drawHeadLayers(c,eq,time,pose,rig.modular);c.restore();
  if(weapon){const level=eq.upgrade??0,w=asset(weaponAssetPath(eq.weapon,level));if(w.complete&&w.naturalWidth){
   c.save();const angle=aiming?-(clamp(context.angle??45,5,90)-35)*Math.PI/180:0;
   // Presentation-only placement never changes the body's facing or combat muzzle.
   c.scale(context.weaponSide??1,1);c.translate(0,clamp(context.weaponVerticalOffset??0,-15,24));
   c.translate((context.weaponOffset??0)+mix(31-stride*2.8*walk-recoil*7,7,lie),mix(-35-Math.abs(stride)*1.6*walk-(aiming?5:0),-125,lie));c.rotate(Math.sin(time/600)*.02+stride*.065*walk+angle-recoil*.17-lie*Math.PI/2);
   const weaponScale=clamp(context.weaponScale??1,.4,1.2);c.translate(6,-5);c.scale(weaponScale,weaponScale);c.translate(-6,5);
   if(pose==='charge'){c.save();c.globalAlpha*=.18+clamp(context.power??50,0,100)/250;c.shadowColor='#ffe5a0';c.shadowBlur=12;ellipse(c,11,-9,15+Math.sin(time/80)*2,15,'#fbe3a6');c.restore();}
   c.save();c.translate(5,-5);drawWeaponEnergy(c,WEAPONS.find(weapon=>weapon.id===eq.weapon)?.effect??'fire',level,time);c.restore();
   c.drawImage(w,-35,-46,82,82);c.restore();
  }}c.restore();c.restore();
 };
 const turn=m.turn*m.turn*(3-2*m.turn);if(turn<1)body(m.previousFacing,1-turn);body(m.facing,turn);c.restore();
}
