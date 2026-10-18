/**
 * The Chefão Mundial dragon in battle: a painted parts rig (body, head, lower jaw, eyelid, claw, flames) moved
 * along the server's act timeline, the way DDTank animates its world boss. Every client computes the same pose
 * from `act.startedAt` and the server time, so the blows land in sync with the damage numbers.
 * Art and pivots: public/assets/world-boss/ (docs/world-boss.md).
 */
import type {Battle,Fighter} from '../../../shared/protocol';
import {DRAGON_ACTIONS,FIRESWEEP_WINDOW,sweepFrontX} from '../../../shared/worldBoss';
import type {DragonAct} from '../../../shared/worldBoss';

type Part='body'|'head'|'jaw'|'lid'|'clawOpen'|'clawFist'|'flame';
/** Each part: its file, the pivot in image pixels and the size it is drawn at (world px per image px). */
export const DRAGON_PARTS:Record<Part,{src:string;pivot:[number,number];scale:number;frames?:number}>={
 body:{src:'/assets/world-boss/body.png',pivot:[560,1010],scale:.82},
 head:{src:'/assets/world-boss/head.png',pivot:[600,430],scale:.8},
 jaw:{src:'/assets/world-boss/jaw.png',pivot:[470,80],scale:.8},
 lid:{src:'/assets/world-boss/lid.png',pivot:[60,40],scale:.8},
 clawOpen:{src:'/assets/world-boss/claw-open.png',pivot:[300,560],scale:.72},
 clawFist:{src:'/assets/world-boss/claw-fist.png',pivot:[300,520],scale:.72},
 flame:{src:'/assets/world-boss/flame.png',pivot:[128,128],scale:1,frames:8},
};
/** Where the parts join, relative to the dragon fighter's (x, y): the neck, then points inside the head. */
export const DRAGON_RIG={
 body:[170,150] as const,
 neck:[110,-230] as const,
 /** In head space (world px from the neck pivot, head facing left, before rotation). */
 hinge:[-150,-10] as const,eye:[-205,-120] as const,mouth:[-400,-20] as const,nostril:[-440,-80] as const,
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
 claw?:{x:number;y:number;closed:boolean;alpha:number;tilt:number};
 shake:number;
 /** How far up the claw holds the player (grab), in px. */
 lift:number;
}
const act=(b:Battle)=>b.worldBoss?.act;
const ageOf=(a:DragonAct|undefined,now:number)=>a?now-a.startedAt:Infinity;

/** The pose at `now` (server time). `t` (page time) drives breathing and blinking, which need no sync. */
export function dragonPose(b:Battle,f:Fighter,now:number,t:number,hurtAge:number,heroGround:number):DragonPose{
 const breathing=Math.sin(t*Math.PI*2/3400),a=act(b),age=ageOf(a,now);
 const pose:DragonPose={bodyDX:0,bodyDY:0,breath:breathing,headDX:0,headDY:-6*breathing,headRot:.018*breathing,jaw:.03+.025*Math.max(0,breathing),blink:0,glow:0,alpha:1,gray:0,shake:0,lift:0};
 const blinkAt=t%5200;if(blinkAt<170)pose.blink=Math.sin(blinkAt/170*Math.PI);
 if(a&&age>=0&&age<DRAGON_ACTIONS[a.action].duration+400){
  const tx=a.targetX??f.x-900,ty=a.targetY??heroGround;
  switch(a.action){
   case 'entrance':{
    const rise=easeOut(span(age,0,1700));pose.bodyDY=(1-rise)*560;pose.shake=age<1700?3.5:0;
    const roar=bump(age,1900,3700);pose.headRot-=.2*roar;pose.headDY-=24*roar;pose.jaw+=.62*roar;pose.shake+=roar>.3?9*roar:0;
    break;}
   case 'claw':{
    // Wind-up (the head pulls back), the claw drops from the sky onto the player, holds, then goes back up.
    pose.headRot-=.08*bump(age,0,1000);pose.headDX+=20*bump(age,0,1000);pose.jaw+=.4*bump(age,800,1900);pose.headRot+=.06*bump(age,1000,1800);
    const down=easeIn(span(age,850,1250)),up=easeIn(span(age,1750,2250));
    if(age>=500&&age<2250){const drop=(1-down)*920+up*1000;pose.claw={x:tx+30,y:ty-drop,closed:false,alpha:clamp(span(age,500,800)-span(age,2150,2250)),tilt:-.15*(1-down)};}
    pose.shake=age>=1250&&age<1700?16*(1-span(age,1250,1700)):0;
    break;}
   case 'grab':{
    pose.headRot-=.07*bump(age,0,1100);pose.jaw+=.3*bump(age,1300,2600);
    const down=easeIn(span(age,850,1350)),lift=easeInOut(span(age,1400,1900)),slam=easeIn(span(age,2180,2300)),up=easeIn(span(age,2650,3250));
    const hold=age>=1350&&age<2300?lift*(1-slam)*170:0;pose.lift=hold;
    const squeeze=age>=1900&&age<2180?Math.sin(age/26)*5:0;
    if(age>=500&&age<3250){const drop=(1-down)*920+up*1000;pose.claw={x:tx+30+squeeze,y:ty-drop-hold,closed:age>=1350&&age<2550,alpha:clamp(span(age,500,800)-span(age,3150,3250)),tilt:-.1*(1-down)};}
    pose.shake=age>=2300&&age<2750?18*(1-span(age,2300,2750)):age>=1900&&age<2180?2:0;
    break;}
   case 'breath':{
    // Rears back breathing in (the throat glows), then breathes the fire stream onto the player.
    const inhale=easeInOut(span(age,0,1100)),out=span(age,1100,1300)-span(age,2300,2800);
    pose.headRot-=.14*inhale*(1-span(age,1100,1350))-.1*out;pose.headDX+=26*inhale*(1-span(age,1100,1350));pose.jaw+=.18*inhale+.5*clamp(out);pose.glow=clamp(inhale+out);
    pose.shake=age>=1450&&age<2200?4:0;
    break;}
   case 'firesweep':{
    const lower=easeInOut(span(age,0,900))-easeInOut(span(age,2700,3300));pose.headRot+=.2*lower;pose.headDY+=70*lower;pose.headDX-=30*lower;pose.jaw+=.55*clamp(lower*1.2);pose.glow=clamp(lower);
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
 const a=act(b);if(!a)return null;const age=now-a.startedAt,head={x:f.x-140,y:f.y-330},tx=a.targetX??heroX,ty=(a.targetY??heroY)-120;
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

const flameFrame=(t:number,seed:number)=>Math.floor(t/55+seed)%(DRAGON_PARTS.flame.frames??8);
/** A painted flame (or a soft fallback glow until the sheet is loaded), centered on (x, y). */
function flame(c:CanvasRenderingContext2D,x:number,y:number,size:number,frame:number,rotation:number,alpha:number){
 if(alpha<=0||size<=1)return;const sheet=ready('flame');c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(rotation);
 if(sheet){const frames=DRAGON_PARTS.flame.frames??8,w=sheet.naturalWidth/frames,h=sheet.naturalHeight;c.drawImage(sheet,frame*w,0,w,h,-size/2,-size/2*h/w,size,size*h/w);}
 else{const g=c.createRadialGradient(0,0,0,0,0,size/2);g.addColorStop(0,'#fff6b8');g.addColorStop(.35,'#ffb030');g.addColorStop(.75,'#e8401ccc');g.addColorStop(1,'#e8401c00');c.fillStyle=g;c.beginPath();c.arc(0,0,size/2,0,Math.PI*2);c.fill();}
 c.restore();
}
function drawPart(c:CanvasRenderingContext2D,part:Part,fallback:(c:CanvasRenderingContext2D)=>void){
 const image=ready(part),def=DRAGON_PARTS[part];
 if(image)c.drawImage(image,-def.pivot[0]*def.scale,-def.pivot[1]*def.scale,image.naturalWidth*def.scale,image.naturalHeight*def.scale);else fallback(c);
}
/** World position of a point given in head space. */
function headPoint(f:Fighter,pose:DragonPose,point:readonly [number,number]){
 const nx=f.x+DRAGON_RIG.neck[0]+pose.bodyDX+pose.headDX,ny=f.y+DRAGON_RIG.neck[1]+pose.bodyDY+pose.headDY,cos=Math.cos(pose.headRot),sin=Math.sin(pose.headRot);
 return {x:nx+point[0]*cos-point[1]*sin,y:ny+point[0]*sin+point[1]*cos};
}
export function dragonMouth(f:Fighter,pose:DragonPose){return headPoint(f,pose,DRAGON_RIG.mouth);}

/** Body, head and jaw: drawn before the terrain so the ridge in front hides where the dragon rises from. */
export function drawDragonBack(c:CanvasRenderingContext2D,f:Fighter,pose:DragonPose,hurtAge:number){
 c.save();c.globalAlpha*=pose.alpha;if(pose.gray>0)c.filter=`grayscale(${pose.gray*.7}) brightness(${1-pose.gray*.25})`;
 // Body: the chest swells a little with each breath, from its base.
 c.save();c.translate(f.x+DRAGON_RIG.body[0]+pose.bodyDX,f.y+DRAGON_RIG.body[1]+pose.bodyDY);c.scale(1-.004*pose.breath,1+.012*pose.breath);
 drawPart(c,'body',c=>{c.fillStyle='#1f6b4f';c.beginPath();c.ellipse(-40,-380,330,420,0,0,Math.PI*2);c.fill();c.fillStyle='#e9c98a';c.beginPath();c.ellipse(-140,-300,120,300,.15,0,Math.PI*2);c.fill();});
 c.restore();
 const flash=hurtAge>=0&&hurtAge<260?(1-hurtAge/260)*.45:0;
 c.save();c.translate(f.x+DRAGON_RIG.neck[0]+pose.bodyDX+pose.headDX,f.y+DRAGON_RIG.neck[1]+pose.bodyDY+pose.headDY);c.rotate(pose.headRot);
 const head=()=>{
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

/** Claw, flames, smoke and dust: drawn over the fighters. */
export function drawDragonFront(c:CanvasRenderingContext2D,b:Battle,f:Fighter,pose:DragonPose,now:number,t:number,ground:(x:number)=>number,quality:'low'|'high'){
 const a=act(b),age=ageOf(a,now),high=quality==='high';
 // Idle: a thin puff from the nostrils now and then.
 const puff=t%7000;if(!a&&puff<1600){const n=headPoint(f,pose,DRAGON_RIG.nostril);for(let i=0;i<(high?5:3);i++){const k=clamp((puff-i*140)/1300);if(k<=0||k>=1)continue;c.save();c.globalAlpha=.28*(1-k);c.fillStyle='#d8d2cc';c.beginPath();c.arc(n.x-30*k-i*6,n.y-50*k-i*4,10+26*k,0,Math.PI*2);c.fill();c.restore();}}
 if(pose.claw){
  const cl=pose.claw,ground0=a?.targetY??ground(cl.x);
  // The claw's shadow grows on the ground as it comes down: the player sees where it lands.
  const fall=clamp(1-(ground0-cl.y)/900);if(fall>0){c.save();c.globalAlpha=.32*fall*cl.alpha;c.fillStyle='#1a0d08';c.beginPath();c.ellipse(cl.x,ground0+4,40+110*fall,10+18*fall,0,0,Math.PI*2);c.fill();c.restore();}
  c.save();c.globalAlpha*=cl.alpha*pose.alpha;c.translate(cl.x,cl.y);c.rotate(cl.tilt);
  drawPart(c,cl.closed?'clawFist':'clawOpen',c=>{c.fillStyle='#1f6b4f';c.fillRect(-60,-700,120,640);c.beginPath();c.ellipse(0,-30,cl.closed?90:120,cl.closed?80:60,0,0,Math.PI*2);c.fill();c.fillStyle='#262626';for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(i*40,0);c.lineTo(i*44-8,cl.closed?20:55);c.lineTo(i*40+10,0);c.fill();}});
  c.restore();
 }
 if(!a||age<0)return;
 const dust=(x:number,y:number,k:number,size:number)=>{if(k<=0||k>=1)return;const count=high?9:5;for(let i=0;i<count;i++){const dir=(i/(count-1)-.5)*2.6,r=size*(.4+.9*k);c.save();c.globalAlpha=.42*(1-k);c.fillStyle=i%2?'#c9a07a':'#a37b58';c.beginPath();c.arc(x+Math.sin(dir)*r*1.6,y-Math.cos(dir)*r*.55-8,size*.22*(1+k),0,Math.PI*2);c.fill();c.restore();}};
 if(a.action==='claw')dust(a.targetX??f.x,(a.targetY??0)+2,span(age,1250,2000),90);
 if(a.action==='grab')dust(a.targetX??f.x,(a.targetY??0)+2,span(age,2300,3000),100);
 if(a.action==='entrance'&&age<2200)for(let x=f.x-260;x<=f.x+400;x+=130)dust(x,ground(x),((age+x*3)%900)/900,60);
 if((a.action==='death'||a.action==='retreat')&&age>900&&age<4200)for(let x=f.x-260;x<=f.x+400;x+=130)dust(x,ground(x),((age+x*3)%1000)/1000,70);
 if(a.action==='breath'){
  const mouth=dragonMouth(f,pose),tx=a.targetX??f.x-900,ty=(a.targetY??ground(tx))-26;
  const reach=easeOut(span(age,1100,1450)),tail=span(age,2150,2650),cx=(mouth.x+tx)/2,cy=Math.min(mouth.y,ty)-120;
  if(reach>0&&tail<1){
   const count=high?26:14;c.save();if(high)c.globalCompositeOperation='lighter';
   for(let i=0;i<count;i++){const s=i/(count-1);if(s>reach||s<tail)continue;const u=1-s,x=u*u*mouth.x+2*u*s*cx+s*s*tx,y=u*u*mouth.y+2*u*s*cy+s*s*ty,dx=2*u*(cx-mouth.x)+2*s*(tx-cx),dy=2*u*(cy-mouth.y)+2*s*(ty-cy);
    flame(c,x,y,60+130*s,flameFrame(t,i*3),Math.atan2(dy,dx)+Math.PI,.9);}
   c.restore();
  }
  const burst=span(age,1450,2500);if(burst>0&&burst<1){c.save();if(high)c.globalCompositeOperation='lighter';for(let i=0;i<(high?7:4);i++){const dir=(i/6-.5)*2.4;flame(c,tx+Math.sin(dir)*110*burst,ty-Math.cos(dir)*50*burst-30*burst,150*(1-burst*.5),flameFrame(t,i*5),0,(1-burst)*.95);}c.restore();
   c.save();c.globalAlpha=.3*(1-burst);c.fillStyle='#5a5552';c.beginPath();c.arc(tx,ty-90*burst-20,40+90*burst,0,Math.PI*2);c.fill();c.restore();}
 }
 if(a.action==='firesweep'){
  const mouth=dragonMouth(f,pose),startX=f.x-320,front=sweepFrontX(age,startX,0),active=age>=FIRESWEEP_WINDOW.from-150&&age<FIRESWEEP_WINDOW.to+700;
  if(active){c.save();if(high)c.globalCompositeOperation='lighter';
   // The stream from the mouth to the ground where the flames start.
   const stream=clamp(span(age,FIRESWEEP_WINDOW.from-150,FIRESWEEP_WINDOW.from)-span(age,FIRESWEEP_WINDOW.to,FIRESWEEP_WINDOW.to+300)),sy=ground(startX)-20;
   for(let i=0;i<(high?8:5);i++){const s=i/(high?7:4);flame(c,mouth.x+(startX-mouth.x)*s,mouth.y+(sy-mouth.y)*s,50+60*s,flameFrame(t,i*2),Math.PI/2,stream*.9);}
   // The flames run along the ground and die out behind the front: nothing keeps burning.
   const fade=span(age,FIRESWEEP_WINDOW.to,FIRESWEEP_WINDOW.to+700),step=high?38:60;
   for(let x=Math.max(0,front);x<=startX;x+=step){const behind=(x-front)/520;if(behind>1)continue;const life=(1-behind)*(1-fade),y=ground(x);flame(c,x,y-34-50*life,70+90*life,flameFrame(t,x/step),0,life);}
   c.restore();}
 }
}

/** The dragon's opening, its turn and its end are shown as a banner by the HUD; these say which. */
export const DRAGON_ACT_NAMES:Record<DragonAct['action'],string>={entrance:'O DRAGÃO DESPERTA',claw:'GARRA ESMAGADORA',grab:'AGARRÃO',breath:'SOPRO DE FOGO',firesweep:'RIO DE CHAMAS',death:'O DRAGÃO CAIU!',retreat:'O DRAGÃO SE RECOLHE'};
