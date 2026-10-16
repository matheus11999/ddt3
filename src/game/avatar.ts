import type {Equipment} from '../../shared/catalog';
import {weaponAssetPath} from '../../shared/catalog';
import {asset,avatarRig,AVATAR_UNIT,drawBackLayers,drawHeadLayers,drawPart,ellipse} from './appearance';

export type AvatarPose='idle'|'walk'|'aim'|'charge'|'fire'|'hit'|'fall'|'prone'|'victory'|'defeat';
export interface AvatarContext {pose?:AvatarPose;angle?:number;power?:number;slope?:number;poseTime?:number;}
export interface AvatarMotion {lastTime:number;walk:number;phase:number;facing:1|-1;previousFacing:1|-1;turn:number;pose:AvatarPose;poseAt:number;lie:number;lean:number;bodyY:number;leftArm:number;rightArm:number;headTilt:number;}
export function createAvatarMotion(facing:1|-1=1):AvatarMotion{return {lastTime:0,walk:0,phase:0,facing,previousFacing:facing,turn:1,pose:'idle',poseAt:0,lie:0,lean:0,bodyY:0,leftArm:0,rightArm:0,headTilt:0};}
const sigils=new Map<number,HTMLCanvasElement>();
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
function sigil(level:number){
 const stage=level>=12?12:level>=9?9:5;if(sigils.has(stage))return sigils.get(stage)!;
 const out=document.createElement('canvas');out.width=out.height=300;const c=out.getContext('2d')!;c.translate(150,150);
 const colors=stage===12?['#fff1a2','#ff933f','#dc4c67']:stage===9?['#f4d3ff','#b494ee','#729ce5']:['#d8ffff','#77d4d6','#4aa6ae'];c.shadowColor=colors[1];c.shadowBlur=7;c.strokeStyle=colors[1];c.lineWidth=2;
 for(const r of stage===12?[101,108,126,133]:stage===9?[106,114,132]:[112,124]){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();}c.fillStyle=colors[1]+'12';c.beginPath();c.arc(0,0,132,0,Math.PI*2);c.fill();
 const n=stage===12?16:stage===9?12:8;for(let i=0;i<n;i++){c.save();c.rotate(i*Math.PI*2/n);c.strokeStyle=colors[i%3];c.lineWidth=2;c.beginPath();c.moveTo(-4,-120);c.lineTo(0,-127);c.lineTo(4,-120);c.lineTo(0,-115);c.closePath();c.stroke();c.beginPath();c.moveTo(-3,-105);c.lineTo(0,-98);c.lineTo(3,-105);c.stroke();if(stage>=9){c.beginPath();c.moveTo(0,-135);c.lineTo(6,-121);c.lineTo(0,-126);c.lineTo(-6,-121);c.closePath();c.fillStyle=colors[0];c.fill();}c.restore();}
 if(stage===12){c.strokeStyle=colors[0];c.lineWidth=2.5;for(let i=0;i<6;i++){c.save();c.rotate(i*Math.PI/3);c.beginPath();c.moveTo(0,-145);c.lineTo(12,-111);c.lineTo(0,-120);c.lineTo(-12,-111);c.closePath();c.stroke();c.restore();}}sigils.set(stage,out);return out;
}
function animate(m:AvatarMotion,time:number,walking:boolean,facing:number,context:AvatarContext,outfitPose:'adventurer'|'confident'|'regal'){
 const dt=m.lastTime?clamp(time-m.lastTime,0,60):16,blend=1-Math.exp(-dt/95);m.lastTime=time;
 const pose=context.pose??(walking?'walk':'idle');if(m.pose!==pose){m.pose=pose;m.poseAt=time;}
 m.walk=mix(m.walk,Number(walking||pose==='walk'),blend);m.phase+=dt/105*(.2+.8*m.walk);
 const direction=facing<0?-1:1;if(direction!==m.facing){m.previousFacing=m.facing;m.facing=direction;m.turn=0;}m.turn=Math.min(1,m.turn+dt/150);
 const poseTime=context.poseTime??time-m.poseAt,stride=Math.sin(m.phase),aiming=pose==='aim'||pose==='charge'||pose==='fire',recoil=pose==='fire'?Math.exp(-Math.max(0,poseTime)/145):0,slope=clamp(context.slope??0,-.5,.5);
 let lean=slope*.55+stride*.025*m.walk,leftArm=-stride*.3*m.walk,rightArm=stride*.26*m.walk,bodyY=0,headTilt=-slope*.24;
 if(pose==='idle'){if(outfitPose==='confident'){lean-=.025;leftArm=.1;rightArm=-.16;headTilt=-.025;}if(outfitPose==='regal'){lean+=.025;leftArm=-.12;rightArm=.05;headTilt=-.035;}}
 if(aiming){const elevation=(clamp(context.angle??45,5,90)-45)*Math.PI/180;leftArm-=.85+elevation*.55;rightArm-=.38+elevation*.45;lean+=.045;headTilt-=.025+elevation*.06;}
 if(pose==='charge'){bodyY=3;lean+=.055;leftArm-=.05;headTilt-=.04;}
 if(pose==='fire'){lean-=recoil*.16;leftArm+=recoil*.22;rightArm+=recoil*.25;headTilt+=recoil*.065;}
 if(pose==='hit'){const jolt=Math.exp(-Math.max(0,poseTime)/210);lean-=.25*jolt;leftArm+=.4*jolt;rightArm-=.5*jolt;headTilt-=.1*jolt;bodyY=3*jolt;}
 if(pose==='fall'){lean+=Math.sin(time/170)*.08;leftArm=.65;rightArm=-.9;headTilt=-.07;bodyY=-3;}
 if(pose==='prone'){leftArm=-2.4;rightArm=-2.65;lean=0;headTilt=-1.05;}
 if(pose==='victory'){leftArm=2.3+Math.sin(time/180)*.12;rightArm=-2.4;bodyY=-Math.abs(Math.sin(time/260))*3;headTilt=-.05;}
 if(pose==='defeat'){lean=.2;bodyY=15;leftArm=.23;rightArm=.3;headTilt=.17;}
 m.lean=mix(m.lean,lean,blend);m.bodyY=mix(m.bodyY,bodyY,blend);m.leftArm=mix(m.leftArm,leftArm,blend);m.rightArm=mix(m.rightArm,rightArm,blend);m.headTilt=mix(m.headTilt,headTilt,blend);m.lie=mix(m.lie,Number(pose==='prone'),blend);
 return {pose,poseTime,stride,aiming,recoil,slope};
}

/** A layered 2D cutout rig. Every item shares the head/chest/hand transforms in all poses. */
export function drawAvatar(c:CanvasRenderingContext2D,eq:Equipment,x:number,y:number,height:number,time:number,walking=false,facing=1,weapon=true,motion?:AvatarMotion,context:AvatarContext={}){
 const rig=avatarRig(eq);if(!rig)return;
 const m=motion??createAvatarMotion(facing<0?-1:1);if(!motion){m.phase=time/105;m.walk=Number(walking||context.pose==='walk');}
 const {pose,stride,aiming,recoil,slope}=animate(m,time,walking,facing,context,rig.outfitPose),walk=m.walk,lie=m.lie,bounce=(-Math.abs(Math.cos(m.phase))*2.4*walk+Math.sin(time/620)*.65*(1-walk))*(1-lie);
 c.save();c.translate(x,y);c.scale(height/160,height/160);ellipse(c,-lie*3,-1,30+lie*25,7-lie*2,'#162c3c35');
 if((eq.upgrade??0)>=5){c.save();c.translate(0,-82+lie*29);c.rotate(time/(eq.upgrade>=12?12000:18000));const size=eq.upgrade>=12?171:eq.upgrade>=9?158:144;c.globalAlpha=eq.upgrade>=12?.9:.7;c.drawImage(sigil(eq.upgrade),-size/2,-size/2,size,size);if(eq.upgrade>=12){c.rotate(-time/6500);c.globalAlpha=.35;c.drawImage(sigil(5),-66,-66,132,132);}c.restore();}
 const body=(direction:number,opacity:number)=>{
  if(opacity<.01)return;c.save();c.globalAlpha*=opacity;c.scale(direction*(1-Math.sin(m.turn*Math.PI)*.12),1);
  let leftLeg=stride*.4*walk,rightLeg=-stride*.4*walk,leftLift=-Math.max(0,stride)*6*walk,rightLift=-Math.max(0,-stride)*6*walk;
  if(pose==='fall'){leftLeg=-.35;rightLeg=.4;leftLift=-5;rightLift=-2;}if(pose==='defeat'){leftLeg=.48;rightLeg=-.65;leftLift=3;rightLift=2;}
  drawPart(c,rig.leftLeg,mix(leftLeg+slope*.15,1.35,lie),mix(-stride*1.2*walk,-24,lie),mix(leftLift+Math.tan(slope)*-16,22,lie));
  drawPart(c,rig.rightLeg,mix(rightLeg+slope*.15,1.7,lie),mix(stride*1.2*walk,-40,lie),mix(rightLift+Math.tan(slope)*20,25,lie));
  c.save();c.translate(-24*lie,bounce+m.bodyY+18*lie);c.translate(0,-32);c.rotate(m.lean+lie*Math.PI/2);c.translate(0,32);
  drawBackLayers(c,eq,time,walk);if(pose!=='victory')drawPart(c,rig.rightArm,m.rightArm);drawPart(c,rig.torso);if(pose!=='victory')drawPart(c,rig.leftArm,m.leftArm);
  c.save();const headPivotX=25*AVATAR_UNIT,headPivotY=-615*AVATAR_UNIT;c.translate(headPivotX,headPivotY);c.rotate(m.headTilt+Math.sin(time/1700)*.006);c.translate(-headPivotX,-headPivotY);drawPart(c,rig.head);drawHeadLayers(c,eq,time,pose,rig.modular);c.restore();
  if(pose==='victory'){drawPart(c,rig.rightArm,m.rightArm);drawPart(c,rig.leftArm,m.leftArm);}
  if(weapon){const level=eq.upgrade??0,w=asset(weaponAssetPath(eq.weapon,level));if(w.complete&&w.naturalWidth){
   c.save();const angle=aiming?-(clamp(context.angle??45,5,90)-35)*Math.PI/180:0;
   c.translate(mix(31-stride*2.8*walk-recoil*7,7,lie),mix(-35-Math.abs(stride)*1.6*walk-(aiming?5:0),-125,lie));c.rotate(Math.sin(time/600)*.02+stride*.065*walk+angle-recoil*.17-lie*Math.PI/2);
   if(pose==='charge'){c.save();c.globalAlpha*=.18+clamp(context.power??50,0,100)/250;c.shadowColor='#ffe5a0';c.shadowBlur=12;ellipse(c,11,-9,15+Math.sin(time/80)*2,15,'#fbe3a6');c.restore();}
   if(level>=9){const color=eq.weapon==='ember'?'#ffb45a':eq.weapon==='volt'?'#69dfff':'#d4a0ff';c.shadowColor=color;c.shadowBlur=level>=12?17:level>=10?7:3;c.save();c.globalAlpha*=.25+Math.sin(time/400)*.05;ellipse(c,5,-5,level>=12?29:20,level>=12?29:20,color);c.restore();if(level>=12)for(let i=0;i<5;i++){const a=time/700+i*1.26;ellipse(c,5+Math.cos(a)*30,-5+Math.sin(a)*25,1.5,1.5,'#fff4bf');}}
   c.drawImage(w,-35,-46,82,82);c.restore();
  }}c.restore();c.restore();
 };
 const turn=m.turn*m.turn*(3-2*m.turn);if(turn<1)body(m.previousFacing,1-turn);body(m.facing,turn);c.restore();
}
