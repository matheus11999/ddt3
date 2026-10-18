/**
 * The Chefão Mundial dragon in battle: a painted parts rig (body, head, lower jaw, eyelid, paw) moved
 * along the server's act timeline, the way DDTank animates its world boss. Every client computes the same pose
 * from `act.startedAt` and the server time, so the blows land in sync with the damage numbers.
 * Art and pivots: public/assets/world-boss/ (docs/world-boss.md). The fire is drawn in code (fire.ts).
 */
import type {Battle,Fighter} from '../../../shared/protocol';
import {DRAGON_ACTIONS,FIRESWEEP_WINDOW,sweepFrontX,sweepReachAt} from '../../../shared/worldBoss';
import type {DragonAct} from '../../../shared/worldBoss';
import {glow,groundFire,hash,puff,stream,tongue} from './fire';

type Part='body'|'head'|'jaw'|'lid'|'clawOpen'|'clawFist';
/** Each part: its file, the pivot in image pixels and the size it is drawn at (world px per image px). */
export const DRAGON_PARTS:Record<Part,{src:string;pivot:[number,number];scale:number}>={
 body:{src:'/assets/world-boss/body.png',pivot:[420,905],scale:.75},
 head:{src:'/assets/world-boss/head.png',pivot:[720,600],scale:.6},
 jaw:{src:'/assets/world-boss/jaw.png',pivot:[620,105],scale:.48},
 lid:{src:'/assets/world-boss/lid.png',pivot:[95,80],scale:.4},
 // The paw comes up out of the ground, drawn upside down: the pivot is the tip of the claws, the forearm goes down into the earth.
 clawOpen:{src:'/assets/world-boss/claw-open.png',pivot:[340,870],scale:.42},
 clawFist:{src:'/assets/world-boss/claw-fist.png',pivot:[314,860],scale:.42},
};
/** Where the parts join, relative to the dragon fighter's (x, y): the base of the neck (below the map), the head's neck pivot, then points inside the head. */
export const DRAGON_RIG={
 body:[430,250] as const,
 neck:[180,-340] as const,
 /** In head space (world px from the neck pivot, head facing left, before rotation). */
 hinge:[-132,-48] as const,eye:[-252,-135] as const,mouth:[-408,-48] as const,nostril:[-381,-108] as const,
};
const images=new Map<Part,HTMLImageElement>();
export function preloadDragon(){
 if(typeof Image==='undefined'||images.size)return;
 for(const [part,def] of Object.entries(DRAGON_PARTS) as [Part,typeof DRAGON_PARTS[Part]][]){const image=new Image();image.decoding='async';image.src=def.src;images.set(part,image);}
}
const ready=(part:Part)=>{const image=images.get(part);return image&&image.complete&&image.naturalWidth>0?image:null;};

const clamp=(v:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const span=(t:number,from:number,to:number)=>clamp((t-from)/(to-from));
const easeOut=(k:number)=>1-(1-k)**3,easeIn=(k:number)=>k*k*k,easeInOut=(k:number)=>k<.5?4*k*k*k:1-(-2*k+2)**3/2;
const backOut=(k:number)=>{const s=1.7;return 1+(s+1)*(k-1)**3+s*(k-1)**2;};
/** A bump that rises and falls between `from` and `to` (0 outside). */
const bump=(t:number,from:number,to:number)=>{const k=span(t,from,to);return k<=0||k>=1?0:Math.sin(k*Math.PI);};

export interface DragonPose {
 bodyDX:number;bodyDY:number;breath:number;headDX:number;headDY:number;headRot:number;jaw:number;blink:number;glow:number;alpha:number;gray:number;
 /** How hard fire is pouring out of the mouth right now (0 to 1). */
 fire:number;
 claw?:{x:number;y:number;closed:boolean;alpha:number;tilt:number};
 shake:number;
 /** How far up the claw holds the player (grab), in px. */
 lift:number;
}
const act=(b:Battle)=>b.worldBoss?.act;
/** The paw, by the tip of its claws: hidden this far under the ground, risen this far above it, and how high the fist sits over a held player. */
const PAW_HIDDEN=40,PAW_RISE=360,PAW_GRIP=120;
const ageOf=(a:DragonAct|undefined,now:number)=>a?now-a.startedAt:Infinity;

/** The pose at `now` (server time). `t` (page time) drives breathing and blinking, which need no sync. */
export function dragonPose(b:Battle,f:Fighter,now:number,t:number,hurtAge:number,heroGround:number):DragonPose{
 const breathing=Math.sin(t*Math.PI*2/3400),a=act(b),age=ageOf(a,now);
 const pose:DragonPose={bodyDX:0,bodyDY:0,breath:breathing,headDX:0,headDY:-6*breathing,headRot:.018*breathing,jaw:.03+.025*Math.max(0,breathing),blink:0,glow:0,alpha:1,gray:0,shake:0,lift:0,fire:0};
 const blinkAt=t%5200;if(blinkAt<170)pose.blink=Math.sin(blinkAt/170*Math.PI);
 if(a&&age>=0&&age<DRAGON_ACTIONS[a.action].duration+400){
  const tx=a.targetX??f.x-900,ty=a.targetY??heroGround;
  switch(a.action){
   case 'entrance':{
    const rise=easeOut(span(age,0,1700));pose.bodyDY=(1-rise)*560;pose.shake=age<1700?3.5:0;
    const roar=bump(age,1900,3700);pose.headRot-=.2*roar;pose.headDY-=24*roar;pose.jaw+=.62*roar;pose.shake+=roar>.3?9*roar:0;
    break;}
   case 'claw':{
    // The ground cracks under the player, then the paw bursts up out of it, holds a moment and sinks back into the earth.
    pose.headRot-=.08*bump(age,0,1000);pose.headDX+=20*bump(age,0,1000);pose.jaw+=.4*bump(age,800,1900);pose.headRot+=.06*bump(age,1000,1800);
    const up=backOut(span(age,950,1250)),down=easeIn(span(age,1700,2150));
    if(age>=950&&age<2150)pose.claw={x:tx+20,y:ty+PAW_HIDDEN-PAW_RISE*up+(PAW_RISE+PAW_HIDDEN)*down,closed:false,alpha:1,tilt:.12*Math.sin(age/90)*(1-span(age,1250,1500))};
    pose.shake=age>=500&&age<1250?2.5*span(age,500,1250):age>=1250&&age<1700?16*(1-span(age,1250,1700)):0;
    break;}
   case 'grab':{
    // The paw bursts up open, closes around the player, lifts them high, slams them down and goes back under the ground.
    pose.headRot-=.07*bump(age,0,1100);pose.jaw+=.3*bump(age,1300,2600);
    const up=backOut(span(age,900,1250)),grip=easeInOut(span(age,1250,1400)),lift=easeInOut(span(age,1400,1900)),slam=easeIn(span(age,2180,2300)),down=easeIn(span(age,2650,3200));
    const hold=age>=1350&&age<2300?lift*(1-slam)*170:0;pose.lift=hold;
    const squeeze=age>=1900&&age<2180?Math.sin(age/26)*5:0,closed=age>=1350&&age<2550;
    // Open, the claws stand above the player; closed, the fist sits around them.
    const open=ty+PAW_HIDDEN-PAW_RISE*up,fist=ty-hold-PAW_GRIP;
    if(age>=900&&age<3200)pose.claw={x:tx+20+squeeze,y:(age<1350?open+(fist-open)*grip:age<2650?fist:ty-PAW_GRIP)+(PAW_RISE+PAW_HIDDEN)*down,closed,alpha:1,tilt:0};
    pose.shake=age>=500&&age<900?2.5*span(age,500,900):age>=2300&&age<2750?18*(1-span(age,2300,2750)):age>=1900&&age<2180?2:0;
    break;}
   case 'breath':{
    // Rears back breathing in (the throat glows), then breathes the fire stream onto the player.
    const inhale=easeInOut(span(age,0,1100)),out=span(age,1100,1300)-span(age,2300,2800);
    pose.headRot-=.14*inhale*(1-span(age,1100,1350))-.1*out;pose.headDX+=26*inhale*(1-span(age,1100,1350));pose.jaw+=.18*inhale+.5*clamp(out);pose.glow=clamp(inhale+out);
    pose.fire=span(age,BREATH.from-140,BREATH.from)-span(age,BREATH.to,BREATH.to+160);
    pose.shake=age>=1450&&age<2200?4:0;
    break;}
   case 'firesweep':{
    const lower=easeInOut(span(age,0,900))-easeInOut(span(age,2700,3300));pose.headRot+=.2*lower;pose.headDY+=70*lower;pose.headDX-=30*lower;pose.jaw+=.55*clamp(lower*1.2);pose.glow=clamp(lower);
    pose.fire=span(age,FIRESWEEP_WINDOW.from-400,FIRESWEEP_WINDOW.from-260)-span(age,FIRESWEEP_WINDOW.to,FIRESWEEP_WINDOW.to+160);
    pose.shake=age>=FIRESWEEP_WINDOW.from&&age<FIRESWEEP_WINDOW.to?3:0;
    break;}
   case 'death':{
    const sink=easeIn(span(age,900,4400));pose.headDX+=30*bump(age,0,700);pose.headRot+=.08*bump(age,0,700)+.28*easeOut(span(age,500,2200));pose.jaw+=.35*span(age,300,1500);
    pose.bodyDY=sink*620;pose.gray=span(age,600,2400);pose.alpha=1-span(age,3800,4600);pose.shake=age<4000?6*(1-span(age,0,4000)):0;
    break;}
   case 'retreat':{
    const roar=bump(age,0,1100);pose.headRot-=.15*roar;pose.jaw+=.5*roar;
    pose.bodyDY=easeIn(span(age,1000,3400))*620;pose.alpha=1-span(age,3000,3600);pose.shake=age>=1000&&age<3400?4:0;
    break;}
  }
 }
 // Taking damage: a recoil that never stops an attack, and a short pale flash.
 if(hurtAge>=0&&hurtAge<450){const k=(1-hurtAge/450)**2;pose.headDX+=20*k;pose.headRot+=.07*k;}
 return pose;
}

/** How high the claw holds a fighter right now (grab); 0 when it does not hold them. */
export function dragonLift(b:Battle,fighterId:string,now:number){
 const a=act(b);if(!a||a.action!=='grab'||a.targetId!==fighterId)return 0;const age=now-a.startedAt;
 if(age<1400||age>=2300)return 0;return easeInOut(span(age,1400,1900))*(1-easeIn(span(age,2180,2300)))*170;
}
/** Where the camera looks while the dragon acts (null: the scene's usual focus). */
export function dragonFocus(b:Battle,f:Fighter,now:number,heroX:number,heroY:number):{x:number;y:number}|null{
 const a=act(b);if(!a)return null;const age=now-a.startedAt,head={x:f.x-60,y:f.y-400},tx=a.targetX??heroX,ty=(a.targetY??heroY)-120;
 if(age<0||age>DRAGON_ACTIONS[a.action].duration+300)return null;
 switch(a.action){
  case 'entrance':return age<3900?head:null;
  case 'death':case 'retreat':return head;
  case 'claw':return age<650?head:{x:tx,y:ty};
  case 'grab':return age<650?head:{x:tx,y:ty-60};
  case 'breath':return age<1050?head:{x:(tx+head.x)/2,y:Math.min(ty,head.y)};
  case 'firesweep':return age<FIRESWEEP_WINDOW.from?head:{x:sweepFrontX(age,f.x-320,0),y:ty};
 }
}

function drawPart(c:CanvasRenderingContext2D,part:Part,fallback:(c:CanvasRenderingContext2D)=>void,armAbove=0){
 const image=ready(part),def=DRAGON_PARTS[part];
 if(!image){fallback(c);return;}
 const x=-def.pivot[0]*def.scale,y=-def.pivot[1]*def.scale,w=image.naturalWidth*def.scale;
 // The claws are painted with the forearm cut at the top: repeat its first scales upward, out of the screen.
 if(armAbove>0){const rows=70,h=rows*def.scale;for(let top=y-h;top>y-h-armAbove;top-=h-1)c.drawImage(image,0,0,image.naturalWidth,rows,x,top,w,h);}
 c.drawImage(image,x,y,w,image.naturalHeight*def.scale);
}
/** World position of a point given in head space. */
function headPoint(f:Fighter,pose:DragonPose,point:readonly [number,number]){
 const nx=f.x+DRAGON_RIG.neck[0]+pose.bodyDX+pose.headDX,ny=f.y+DRAGON_RIG.neck[1]+pose.bodyDY+pose.headDY,cos=Math.cos(pose.headRot),sin=Math.sin(pose.headRot);
 return {x:nx+point[0]*cos-point[1]*sin,y:ny+point[0]*sin+point[1]*cos};
}
/** In head space: the tip of the lower jaw for an opening `jaw` (it turns about its hinge). */
const jawTip=(jaw:number)=>[DRAGON_RIG.hinge[0]-JAW_LENGTH*Math.cos(jaw),DRAGON_RIG.hinge[1]+JAW_LENGTH*Math.sin(jaw)] as const;
const JAW_LENGTH=280,THROAT=[-170,-26] as const;
/** In head space: the middle of the gap between the upper teeth and the open jaw, where the fire comes out. */
function mouthGap(jaw:number){const tip=jawTip(jaw),lip=DRAGON_RIG.mouth;return [(lip[0]+tip[0])/2+6,(lip[1]+tip[1])/2+4] as const;}
/** World point where the fire leaves the mouth. */
export function dragonMouth(f:Fighter,pose:DragonPose){return headPoint(f,pose,mouthGap(pose.jaw));}
/** Fire roaring inside the open mouth, from the throat to the teeth: drawn between the jaw and the skull, so the teeth stay in front of it. */
function mouthFire(c:CanvasRenderingContext2D,pose:DragonPose,t:number){
 const k=clamp(pose.fire);if(k<=0)return;const gap=mouthGap(pose.jaw),dx=gap[0]-THROAT[0],dy=gap[1]-THROAT[1],angle=Math.atan2(dx,-dy),open=clamp(pose.jaw/.6);
 glow(c,gap[0]-10,gap[1],90*k,.8*k);
 for(let i=0;i<7;i++){const u=i/6,x=THROAT[0]+dx*u,y=THROAT[1]+dy*u,r=(20+30*u)*(.5+.5*open)*(.7+.3*k);
  puff(c,x,y,r*1.1,.6,.7*k);tongue(c,x,y,r*2.4,r*1.3,t,40+i,k,0,angle);}
 for(let i=0;i<12;i++){const u=i/11,w=Math.sin(t/70+i*1.7)*.35;puff(c,THROAT[0]+dx*u-dy*.04*w,THROAT[1]+dy*u+dx*.04*w,(24+18*u)*(.5+.5*open)*(1+.15*Math.sin(t/55+i)),.97,.95*k);}
}

/** Body, head and jaw: drawn before the terrain so the ridge in front hides where the dragon rises from. */
export function drawDragonBack(c:CanvasRenderingContext2D,f:Fighter,pose:DragonPose,hurtAge:number,t=0){
 c.save();c.globalAlpha*=pose.alpha;if(pose.gray>0)c.filter=`grayscale(${pose.gray*.7}) brightness(${1-pose.gray*.25})`;
 // Body: the chest swells a little with each breath, from its base.
 c.save();c.translate(f.x+DRAGON_RIG.body[0]+pose.bodyDX,f.y+DRAGON_RIG.body[1]+pose.bodyDY);c.scale(1-.004*pose.breath,1+.012*pose.breath);
 drawPart(c,'body',c=>{c.fillStyle='#1f6b4f';c.beginPath();c.ellipse(-40,-380,330,420,0,0,Math.PI*2);c.fill();c.fillStyle='#e9c98a';c.beginPath();c.ellipse(-140,-300,120,300,.15,0,Math.PI*2);c.fill();});
 c.restore();
 const flash=hurtAge>=0&&hurtAge<260?(1-hurtAge/260)*.45:0;
 c.save();c.translate(f.x+DRAGON_RIG.neck[0]+pose.bodyDX+pose.headDX,f.y+DRAGON_RIG.neck[1]+pose.bodyDY+pose.headDY);c.rotate(pose.headRot);
 const head=()=>{
  // Fire inside the mouth goes first: the jaw below and the skull above cover it, so it only shows between the teeth.
  mouthFire(c,pose,t);
  // The lower jaw hangs from its hinge behind the skull; opening is a rotation.
  c.save();c.translate(DRAGON_RIG.hinge[0],DRAGON_RIG.hinge[1]);c.rotate(-pose.jaw);drawPart(c,'jaw',c=>{c.fillStyle='#185a43';c.beginPath();c.moveTo(0,0);c.lineTo(-260,40);c.lineTo(-250,75);c.lineTo(10,60);c.fill();});c.restore();
  if(pose.glow>0){const m=DRAGON_RIG.mouth,g=c.createRadialGradient(m[0]+70,m[1]+20,0,m[0]+70,m[1]+20,170);g.addColorStop(0,`rgba(255,226,120,${.75*pose.glow})`);g.addColorStop(.5,`rgba(255,120,30,${.35*pose.glow})`);g.addColorStop(1,'rgba(255,90,20,0)');c.fillStyle=g;c.beginPath();c.arc(m[0]+70,m[1]+20,170,0,Math.PI*2);c.fill();}
  drawPart(c,'head',c=>{c.fillStyle='#22795a';c.beginPath();c.moveTo(40,-120);c.quadraticCurveTo(-200,-260,-440,-70);c.lineTo(-420,-10);c.lineTo(-140,-20);c.quadraticCurveTo(60,40,60,-40);c.fill();c.fillStyle='#f3e2b0';c.beginPath();c.moveTo(-120,-210);c.lineTo(-60,-330);c.lineTo(-30,-190);c.fill();c.fillStyle='#ffc23a';c.beginPath();c.arc(DRAGON_RIG.eye[0],DRAGON_RIG.eye[1],16,0,Math.PI*2);c.fill();});
  if(pose.blink>0){c.save();c.globalAlpha*=pose.blink;c.translate(DRAGON_RIG.eye[0],DRAGON_RIG.eye[1]);drawPart(c,'lid',c=>{c.fillStyle='#1c6a4e';c.beginPath();c.ellipse(0,0,22,18*pose.blink,0,0,Math.PI*2);c.fill();});c.restore();}
 };
 head();
 if(flash>0){c.globalCompositeOperation='lighter';c.globalAlpha*=flash;head();}
 c.restore();c.restore();
}

/** The breath: when the mouth starts and stops pouring fire (ms into the act; the first fire lands at contact). */
const BREATH={from:1080,to:2250} as const;
type Ctx=CanvasRenderingContext2D;
/** A puff of dust thrown up from the ground at (x, y); `k` runs 0 to 1. */
function dust(c:Ctx,x:number,y:number,k:number,size:number,high:boolean){
 if(k<=0||k>=1)return;const count=high?9:5;
 for(let i=0;i<count;i++){const dir=(i/(count-1)-.5)*2.6,r=size*(.4+.9*k);c.save();c.globalAlpha=.42*(1-k);c.fillStyle=i%2?'#c9a07a':'#a37b58';c.beginPath();c.arc(x+Math.sin(dir)*r*1.6,y-Math.cos(dir)*r*.55-8,size*.22*(1+k),0,Math.PI*2);c.fill();c.restore();}
}
/** Cracks opening in the ground where the paw will come out (`open` 0 to 1), closing again with `stay`. */
function cracks(c:Ctx,x:number,y:number,open:number,stay:number){
 const k=Math.min(open,stay);if(k<=0)return;
 c.save();c.globalAlpha*=.85*Math.min(1,stay*1.5);c.strokeStyle='#2b1a0e';c.lineCap='round';c.lineJoin='round';
 for(let i=0;i<7;i++){const dir=(i/6-.5)*2.9,len=(26+70*hash(i+1))*k;c.lineWidth=4-i%3;c.beginPath();c.moveTo(x,y+3);
  for(let j=1;j<=3;j++){const d=len*j/3,wob=(hash(i*5+j)-.5)*14;c.lineTo(x+Math.sin(dir)*d+wob,y+3+Math.abs(Math.cos(dir))*d*.14);}c.stroke();}
 c.restore();
}
/** Rocks thrown out of the ground when the paw bursts through (`age` ms since). */
function rocks(c:Ctx,x:number,y:number,age:number,high:boolean){
 if(age<0||age>900)return;const g=.0016;
 for(let i=0;i<(high?10:6);i++){const vx=(hash(i*3)-.5)*.75,vy=-(.55+.5*hash(i*3+1)),size=5+8*hash(i*3+2),px=x+vx*age,py=y-4+vy*age+g*age*age/2;
  if(py>y+10)continue;c.save();c.globalAlpha*=1-age/900;c.translate(px,py);c.rotate(age/120*(i%2?1:-1));c.fillStyle=i%3?'#8a6440':'#6b4a2e';c.beginPath();c.moveTo(-size,-size*.4);c.lineTo(-size*.2,-size);c.lineTo(size,-size*.3);c.lineTo(size*.6,size*.7);c.lineTo(-size*.7,size*.6);c.closePath();c.fill();c.restore();}
}
/** Paw, fire, smoke and dust: drawn over the fighters. */
export function drawDragonFront(c:CanvasRenderingContext2D,b:Battle,f:Fighter,pose:DragonPose,now:number,t:number,ground:(x:number)=>number,quality:'low'|'high'){
 const a=act(b),age=ageOf(a,now),high=quality==='high';
 // Idle: a thin puff from the nostrils now and then.
 const puff=t%7000;if(!a&&puff<1600){const n=headPoint(f,pose,DRAGON_RIG.nostril);for(let i=0;i<(high?5:3);i++){const k=clamp((puff-i*140)/1300);if(k<=0||k>=1)continue;c.save();c.globalAlpha=.28*(1-k);c.fillStyle='#d8d2cc';c.beginPath();c.arc(n.x-30*k-i*6,n.y-50*k-i*4,10+26*k,0,Math.PI*2);c.fill();c.restore();}}
 if(!a||age<0)return;
 const tx=a.targetX??f.x-900,ty=a.targetY??ground(tx);
 // The paw: cracks open in the ground first, rocks fly when it bursts out, dust when it goes back down.
 if(a.action==='claw'||a.action==='grab'){
  const burst=a.action==='claw'?950:900,sink=a.action==='claw'?1700:2650;
  cracks(c,tx+20,ty,span(age,450,burst),1-span(age,sink+200,sink+900));
  rocks(c,tx+20,ty,age-burst-150,high);
  if(pose.claw){
   const cl=pose.claw;c.save();
   // Only what is above the ground shows: the forearm stays in the earth.
   c.beginPath();c.moveTo(cl.x-320,-2000);c.lineTo(cl.x+320,-2000);for(let x=cl.x+320;x>=cl.x-320;x-=16)c.lineTo(x,ground(x)+6);c.closePath();c.clip();
   c.globalAlpha*=cl.alpha*pose.alpha;c.translate(cl.x,cl.y);c.rotate(cl.tilt);c.scale(1,-1);
   drawPart(c,cl.closed?'clawFist':'clawOpen',c=>{c.fillStyle='#1f6b4f';c.fillRect(-60,-700,120,640);c.beginPath();c.ellipse(0,-30,cl.closed?90:120,cl.closed?80:60,0,0,Math.PI*2);c.fill();c.fillStyle='#262626';for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(i*40,0);c.lineTo(i*44-8,cl.closed?20:55);c.lineTo(i*40+10,0);c.fill();}},900);
   c.restore();
  }
  dust(c,tx+20,ty+2,span(age,burst+250,burst+1000),95,high);
  dust(c,tx+20,ty+2,span(age,sink,sink+700),80,high);
  if(a.action==='grab')dust(c,tx,ty+2,span(age,2300,3000),100,high);
 }
 if(a.action==='entrance'&&age<2200)for(let x=f.x-260;x<=f.x+400;x+=130)dust(c,x,ground(x),((age+x*3)%900)/900,60,high);
 if((a.action==='death'||a.action==='retreat')&&age>900&&age<4200)for(let x=f.x-260;x<=f.x+400;x+=130)dust(c,x,ground(x),((age+x*3)%1000)/1000,70,high);
 if(a.action==='breath'){
  // A stream of fire from the mouth to the player; the fire there catches, burns while the breath lasts and dies out.
  const mouth=dragonMouth(f,pose),to={x:tx,y:ty-30},via={x:(mouth.x+tx)/2,y:Math.min(mouth.y,to.y)-120},travel=420;
  glow(c,mouth.x,mouth.y,70+40*span(age,BREATH.from-250,BREATH.from),1-span(age,BREATH.to,BREATH.to+200));
  stream(c,mouth,via,to,age,BREATH.from,BREATH.to,travel,62,high);
  groundFire(c,tx,ty,210,170,age-BREATH.from-travel,BREATH.to-BREATH.from,900,t,7,high);
 }
 if(a.action==='firesweep'){
  // The dragon pours fire on the ground in front of it and the flames run towards the far side.
  // Each spot catches when the front passes, burns a little and goes out: the fire moves on and leaves nothing burning.
  const mouth=dragonMouth(f,pose),startX=f.x-320,W=FIRESWEEP_WINDOW,to={x:startX,y:ground(startX)-20};
  stream(c,mouth,{x:(mouth.x+to.x)/2-40,y:(mouth.y+to.y)/2},to,age,W.from-260,W.to,260,48,high);
  const step=high?44:70;
  for(let x=startX;x>=0;x-=step){const caught=sweepReachAt(x,startX,0);if(age<caught)break;groundFire(c,x,ground(x),step*1.3,120,age-caught,420,750,t,x/step,high);}
  groundFire(c,startX,ground(startX),110,150,age-W.from+200,W.to-W.from,800,t,99,high);
 }
}

/** The dragon's opening, its turn and its end are shown as a banner by the HUD; these say which. */
export const DRAGON_ACT_NAMES:Record<DragonAct['action'],string>={entrance:'O DRAGÃO DESPERTA',claw:'GARRA ESMAGADORA',grab:'AGARRÃO',breath:'SOPRO DE FOGO',firesweep:'RIO DE CHAMAS',death:'O DRAGÃO CAIU!',retreat:'O DRAGÃO SE RECOLHE'};
