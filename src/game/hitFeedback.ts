import type {ShotHit} from '../../shared/protocol';
import type {WeaponEffectOptions} from './weaponEffects';

export const HIT_FEEDBACK_DURATION=1200;
/** Vertical gap between numbers stacked on the same fighter by one shot (one number per hit). */
export const HIT_STACK_GAP=46;
const TW=340,TH=130,BW=420,BH=300;
const FONT='"Lilita One","Nunito",sans-serif';
const textCache=new Map<string,HTMLCanvasElement>(),burstCache=new Map<number,HTMLCanvasElement>();
const motionPreference=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const easeOutBack=(t:number)=>{const k=2.2;return 1+(k+1)*(t-1)**3+k*(t-1)**2;};
// Fixed spike lengths and angle jitter so the critical burst keeps the same hand-cut silhouette every time.
const SPIKES=[1,1.16,.9,1.22,.96,1.1,.86,1.2,1.02,.92,1.18,.94,1.12,.88,1.24,.98,1.06,.9,1.15,1];
const JITTER=[0,.05,-.04,.03,-.06,.02,.05,-.03,.04,-.05,.01,.06,-.02,.03,-.04,.05,-.06,.02,-.03,.04];
let scratch:HTMLCanvasElement|null=null;

function fontReady(){try{return typeof document==='undefined'||!document.fonts||document.fonts.check(`40px ${FONT}`);}catch{return true;}}
function sparkle(c:CanvasRenderingContext2D,x:number,y:number,r:number){c.beginPath();c.moveTo(x,y-r);c.quadraticCurveTo(x,y,x+r*.32,y);c.quadraticCurveTo(x,y,x,y+r);c.quadraticCurveTo(x,y,x-r*.32,y);c.quadraticCurveTo(x,y,x,y-r);c.moveTo(x-r*.75,y);c.quadraticCurveTo(x,y,x,y-r*.22);c.quadraticCurveTo(x,y,x+r*.75,y);c.quadraticCurveTo(x,y,x,y+r*.22);c.quadraticCurveTo(x,y,x-r*.75,y);c.fill();}

/** Red jagged starburst painted behind critical numbers, DDTank style: dark rim, hot centre, glossy top. */
function burstFor(rx:number){
 const key=Math.round(rx/6)*6,known=burstCache.get(key);if(known)return known;
 const ry=key*.66,art=document.createElement('canvas');art.width=BW;art.height=BH;const c=art.getContext('2d')!;
 const star=(outer:number,inner:number)=>{c.beginPath();const n=SPIKES.length*2;for(let i=0;i<n;i++){const tip=i%2===0,s=SPIKES[i>>1],theta=i*Math.PI*2/n-Math.PI/2+(tip?JITTER[i>>1]:0);const r=tip?outer*s:inner*(.94+(s-1)*.3);const px=Math.cos(theta)*key*r,py=Math.sin(theta)*ry*r;if(i===0)c.moveTo(px,py);else c.lineTo(px,py);}c.closePath();};
 c.translate(BW/2,BH/2);c.lineJoin='miter';c.miterLimit=3;
 c.save();c.shadowColor='rgba(40,0,0,.55)';c.shadowBlur=10;c.shadowOffsetY=4;star(1,.7);c.fillStyle='#2c0303';c.fill();c.restore();
 star(1,.7);c.lineWidth=8;c.strokeStyle='#2c0303';c.stroke();
 const body=c.createRadialGradient(0,-ry*.2,6,0,0,key*1.15);body.addColorStop(0,'#ff5a2c');body.addColorStop(.3,'#e8200f');body.addColorStop(.7,'#bb0a0a');body.addColorStop(1,'#7a0404');
 c.fillStyle=body;c.fill();
 // Second, smaller layer of spikes in hot orange gives the painted depth of the reference.
 c.save();c.rotate(.08);star(.78,.56);const hot=c.createRadialGradient(0,-ry*.1,4,0,0,key*.85);hot.addColorStop(0,'#ff9a4a');hot.addColorStop(.5,'#f8461c');hot.addColorStop(1,'rgba(220,30,10,0)');c.fillStyle=hot;c.globalAlpha=.55;c.fill();c.restore();
 // Glossy highlight on the upper half.
 c.save();star(1,.7);c.clip();const gloss=c.createLinearGradient(0,-ry*1.2,0,0);gloss.addColorStop(0,'rgba(255,200,180,.42)');gloss.addColorStop(1,'rgba(255,200,160,0)');c.fillStyle=gloss;c.beginPath();c.ellipse(0,-ry*.55,key*.95,ry*.6,0,0,Math.PI*2);c.fill();c.restore();
 star(1,.7);c.lineWidth=2;c.strokeStyle='rgba(255,170,110,.75)';c.stroke();
 burstCache.set(key,art);return art;
}

/** Chunky yellow-orange numerals with a dark outline, dropped 3D edge, warm glow and a glossy top. */
function drawDigits(c:CanvasRenderingContext2D,value:string,size:number,cx:number,y:number){
 c.font=`${size}px ${FONT}`;
 const depth=Math.round(size*.1),half=c.measureText(value).width/2;
 c.save();c.shadowColor='rgba(255,140,20,.55)';c.shadowBlur=14;c.lineWidth=size*.26;c.strokeStyle='#2a0e02';c.strokeText(value,cx,y+depth);c.restore();
 c.fillStyle='#6a2804';c.fillText(value,cx,y+depth);
 c.lineWidth=size*.24;c.strokeStyle='#2e1002';c.strokeText(value,cx,y+depth*.5);
 c.lineWidth=size*.2;c.strokeStyle='#3e1603';c.strokeText(value,cx,y);
 const fill=c.createLinearGradient(0,y-size*.5,0,y+size*.45);fill.addColorStop(0,'#ffffff');fill.addColorStop(.18,'#fff59a');fill.addColorStop(.42,'#ffd21c');fill.addColorStop(.7,'#ff9a0e');fill.addColorStop(1,'#e8480a');
 c.fillStyle=fill;c.fillText(value,cx,y);
 // Glossy band across the upper half of each digit.
 c.save();c.beginPath();c.rect(0,y-size*.62,TW,size*.46);c.clip();c.globalAlpha=.5;c.fillStyle='#ffffff';c.fillText(value,cx,y-size*.04);c.restore();
 c.lineWidth=1.4;c.strokeStyle='rgba(255,250,210,.8)';c.strokeText(value,cx,y);
 c.fillStyle='#ffffff';sparkle(c,cx-half+size*.12,y-size*.36,size*.2);sparkle(c,cx+half-size*.05,y+size*.12,size*.13);
}

function textFor(hit:ShotHit){
 const critical=hit.critical===true,kind=hit.kind,value=String(Math.max(0,Math.round(hit.damage))),key=`${critical}:${kind}:${value}`;
 const known=textCache.get(key);if(known)return known;
 const art=document.createElement('canvas');art.width=TW;art.height=TH;const c=art.getContext('2d')!;
 c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
 const size=critical?52:42;
 const label=kind==='graze'?'RASPÃO':kind==='fall'?'QUEDA':'';
 if(label&&!critical){c.font=`17px ${FONT}`;c.lineWidth=5;c.strokeStyle='#14233a';c.strokeText(label,TW/2,TH/2-38);c.fillStyle='#bfe4fa';c.fillText(label,TW/2,TH/2-38);}
 drawDigits(c,value,size,TW/2,TH/2);
 // Text drawn before the webfont arrives would be frozen in the fallback face: only cache once it is ready.
 if(fontReady()){textCache.set(key,art);if(textCache.size>96)textCache.delete(textCache.keys().next().value!);}
 return art;
}

/** A light streak that sweeps once across the digits right after they land. */
function drawWithShine(c:CanvasRenderingContext2D,art:HTMLCanvasElement,shine:number){
 if(shine<=0||shine>=1){c.drawImage(art,-TW/2,-TH/2);return;}
 scratch??=document.createElement('canvas');if(scratch.width!==TW||scratch.height!==TH){scratch.width=TW;scratch.height=TH;}
 const s=scratch.getContext('2d')!;s.globalCompositeOperation='source-over';s.clearRect(0,0,TW,TH);s.drawImage(art,0,0);
 s.globalCompositeOperation='source-atop';const x=-60+shine*(TW+120),band=s.createLinearGradient(x-40,0,x+40,0);band.addColorStop(0,'rgba(255,255,255,0)');band.addColorStop(.5,'rgba(255,255,255,.85)');band.addColorStop(1,'rgba(255,255,255,0)');
 s.fillStyle=band;s.setTransform(1,0,-.45,1,0,0);s.fillRect(x-60,0,120+TH,TH);s.setTransform(1,0,0,1,0,0);s.globalCompositeOperation='source-over';
 c.drawImage(scratch,-TW/2,-TH/2);
}

/** Read-only feedback: damage, critical and hit kind always come from the server.
 * Call in world coordinates at the matching authoritative impact's visual age.
 * `stack` is how many earlier hits of the same shot landed on this fighter, so each hit gets its own number above the last. */
export function drawHitFeedback(c:CanvasRenderingContext2D,hit:ShotHit,age:number,options:WeaponEffectOptions&{stack?:number}={}){
 const critical=hit.critical===true,duration=HIT_FEEDBACK_DURATION;if(age<0||age>=duration||!Number.isFinite(hit.damage)||hit.damage<=0)return;
 const progress=age/duration,motion=options.reducedMotion??motionPreference?.matches??false,stack=Math.max(0,options.stack??0),low=options.quality==='low';
 const art=textFor(hit),fade=1-clamp((progress-.72)/.28);
 const x=hit.x,y=hit.y-30-stack*HIT_STACK_GAP-(motion?0:Math.max(0,progress-.6)*36);
 c.save();c.translate(x,y);c.globalAlpha*=fade;
 if(critical){
  // The burst slams in first, overshoots, then breathes slowly behind the number.
  c.font=`52px ${FONT}`;const rx=Math.min(150,c.measureText(String(Math.round(hit.damage))).width/2+32),burst=burstFor(rx);
  const grow=clamp(age/220),bs=motion?1:easeOutBack(grow)*(1+Math.sin(age/140)*.025*grow);
  c.save();if(!motion)c.rotate(-.12+.1*grow);c.scale(bs,bs);c.drawImage(burst,-BW/2,-BH/2);c.restore();
  if(!motion&&!low&&age<260){const t=age/260;c.save();c.globalAlpha*=(1-t)*.9;c.fillStyle='#ffe9a0';for(let n=0;n<8;n++){const a=n*Math.PI/4+.3,d=rx*(.8+t*.9);c.save();c.translate(Math.cos(a)*d,Math.sin(a)*d*.66);c.rotate(a);c.beginPath();c.moveTo(10,0);c.lineTo(-6,-3);c.lineTo(-6,3);c.closePath();c.fill();c.restore();}c.restore();}
 }
 // Digits drop in big, squash on landing, then settle; a light streak sweeps across.
 const land=critical?150:120,enter=clamp(age/land),settle=clamp((age-land)/180);
 const sx=motion?1:enter<1?.4+enter*1.1:1.5-.5*easeOutBack(settle)+(settle<.35?.08*Math.sin(settle/.35*Math.PI):0);
 const sy=motion?1:enter<1?.4+enter*1.1:1.5-.5*easeOutBack(settle)-(settle<.35?.08*Math.sin(settle/.35*Math.PI):0);
 c.globalAlpha*=motion?1:Math.min(1,enter*1.8);
 if(critical&&!motion)c.rotate(-.05+.05*settle);
 c.scale(sx,sy);
 if(!motion&&age<160){c.save();c.globalAlpha*=(1-age/160)*.7;const flash=c.createRadialGradient(0,0,4,0,0,90);flash.addColorStop(0,'rgba(255,255,230,1)');flash.addColorStop(1,'rgba(255,220,120,0)');c.fillStyle=flash;c.fillRect(-90,-90,180,180);c.restore();}
 drawWithShine(c,art,motion||low?0:(age-land-60)/320);
 c.restore();
}
