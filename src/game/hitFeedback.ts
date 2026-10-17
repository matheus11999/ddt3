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

function fontReady(){try{return typeof document==='undefined'||!document.fonts||document.fonts.check(`40px ${FONT}`);}catch{return true;}}
/** Red jagged starburst painted behind critical numbers, DDTank style: dark rim, folded two-tone spikes, hot core. */
function burstFor(rx:number){
 const key=Math.round(rx/6)*6,known=burstCache.get(key);if(known)return known;
 const ry=key*.66,art=document.createElement('canvas');art.width=BW;art.height=BH;const c=art.getContext('2d')!;
 const n=SPIKES.length*2,points=Array.from({length:n},(_,i)=>{const tip=i%2===0,s=SPIKES[i>>1],theta=i*Math.PI*2/n-Math.PI/2+(tip?JITTER[i>>1]:0),r=tip?s:.7*(.94+(s-1)*.3);return [Math.cos(theta)*key*r,Math.sin(theta)*ry*r];});
 const star=(scale=1)=>{c.beginPath();points.forEach(([px,py],i)=>i===0?c.moveTo(px*scale,py*scale):c.lineTo(px*scale,py*scale));c.closePath();};
 c.translate(BW/2,BH/2);c.lineJoin='miter';c.miterLimit=3;
 c.save();c.shadowColor='rgba(40,0,0,.55)';c.shadowBlur=10;c.shadowOffsetY=4;star();c.fillStyle='#2c0303';c.fill();c.restore();
 star();c.lineWidth=8;c.strokeStyle='#2c0303';c.stroke();
 const body=c.createRadialGradient(0,-ry*.15,6,0,0,key*1.15);body.addColorStop(0,'#f8442a');body.addColorStop(.4,'#d81a10');body.addColorStop(.8,'#a8090a');body.addColorStop(1,'#740404');
 c.fillStyle=body;c.fill();
 // Each spike is folded down its middle: a lit face and a shaded face, so the star reads as cut paper, not a flat shape.
 c.save();star();c.clip();
 for(let i=0;i<n;i+=2){const tip=points[i],prev=points[(i+n-1)%n],next=points[(i+1)%n];
  c.beginPath();c.moveTo(0,0);c.lineTo(prev[0],prev[1]);c.lineTo(tip[0],tip[1]);c.closePath();c.fillStyle='rgba(255,120,90,.28)';c.fill();
  c.beginPath();c.moveTo(0,0);c.lineTo(tip[0],tip[1]);c.lineTo(next[0],next[1]);c.closePath();c.fillStyle='rgba(70,0,0,.24)';c.fill();
  c.beginPath();c.moveTo(tip[0]*.2,tip[1]*.2);c.lineTo(tip[0]*.97,tip[1]*.97);c.lineWidth=1.4;c.strokeStyle='rgba(255,150,120,.45)';c.stroke();}
 c.restore();
 // Hot core behind the digits.
 const core=c.createRadialGradient(0,0,4,0,0,key*.75);core.addColorStop(0,'rgba(255,120,50,.75)');core.addColorStop(.6,'rgba(240,60,25,.35)');core.addColorStop(1,'rgba(220,30,10,0)');c.fillStyle=core;star(.8);c.fill();
 star();c.lineWidth=2.4;c.strokeStyle='#ff7a52';c.stroke();
 burstCache.set(key,art);return art;
}

/** Glyph rim used for the fixed bevel: the text minus a shifted copy of itself leaves only one edge. */
function rim(value:string,font:string,cx:number,y:number,dy:number,color:string){
 const r=document.createElement('canvas');r.width=TW;r.height=TH;const g=r.getContext('2d')!;g.font=font;g.textAlign='center';g.textBaseline='middle';
 g.fillStyle=color;g.fillText(value,cx,y);g.globalCompositeOperation='destination-out';g.fillText(value,cx,y+dy);return r;
}

/** Chunky yellow-orange numerals: dark outline, dropped 3D edge, bevelled rims and a glossy top, all fixed in the sprite. */
function drawDigits(c:CanvasRenderingContext2D,value:string,size:number,cx:number,y:number){
 const font=`${size}px ${FONT}`;c.font=font;
 const depth=Math.round(size*.1);
 c.lineWidth=size*.26;c.strokeStyle='#2a0e02';c.strokeText(value,cx,y+depth);
 c.fillStyle='#6a2804';c.fillText(value,cx,y+depth);
 c.lineWidth=size*.24;c.strokeStyle='#2e1002';c.strokeText(value,cx,y+depth*.5);
 c.lineWidth=size*.2;c.strokeStyle='#3e1603';c.strokeText(value,cx,y);
 const fill=c.createLinearGradient(0,y-size*.5,0,y+size*.45);fill.addColorStop(0,'#fff7c0');fill.addColorStop(.3,'#ffde2a');fill.addColorStop(.62,'#ffa412');fill.addColorStop(1,'#e8520a');
 c.fillStyle=fill;c.fillText(value,cx,y);
 // Bevel: a pale rim along the top of each glyph and a red-brown rim along the bottom.
 c.drawImage(rim(value,font,cx,y,size*.06,'rgba(255,255,240,.95)'),0,0);
 c.drawImage(rim(value,font,cx,y,-size*.06,'rgba(200,60,0,.45)'),0,0);
 // Glossy band across the upper half of each digit.
 c.save();c.beginPath();c.rect(0,y-size*.62,TW,size*.44);c.clip();c.globalAlpha=.32;c.fillStyle='#ffffff';c.fillText(value,cx,y-size*.04);c.restore();
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

/** Read-only feedback: damage, critical and hit kind always come from the server.
 * Call in world coordinates at the matching authoritative impact's visual age.
 * `stack` is how many earlier hits of the same shot landed on this fighter, so each hit gets its own number above the last. */
export function drawHitFeedback(c:CanvasRenderingContext2D,hit:ShotHit,age:number,options:WeaponEffectOptions&{stack?:number}={}){
 const critical=hit.critical===true,duration=HIT_FEEDBACK_DURATION;if(age<0||age>=duration||!Number.isFinite(hit.damage)||hit.damage<=0)return;
 const progress=age/duration,motion=options.reducedMotion??motionPreference?.matches??false,stack=Math.max(0,options.stack??0);
 const art=textFor(hit),fade=1-clamp((progress-.72)/.28);
 const x=hit.x,y=hit.y-30-stack*HIT_STACK_GAP-(motion?0:Math.max(0,progress-.6)*36);
 c.save();c.translate(x,y);c.globalAlpha*=fade;
 if(critical){
  // The burst slams in first, then overshoots and settles behind the number.
  c.font=`52px ${FONT}`;const rx=Math.min(150,c.measureText(String(Math.round(hit.damage))).width/2+32),burst=burstFor(rx);
  const grow=clamp(age/220),bs=motion?1:easeOutBack(grow);
  c.save();if(!motion)c.rotate(-.12+.1*grow);c.scale(bs,bs);c.drawImage(burst,-BW/2,-BH/2);c.restore();
 }
 // Digits drop in big, squash on landing, then settle.
 const land=critical?150:120,enter=clamp(age/land),settle=clamp((age-land)/180);
 const sx=motion?1:enter<1?.4+enter*1.1:1.5-.5*easeOutBack(settle)+(settle<.35?.08*Math.sin(settle/.35*Math.PI):0);
 const sy=motion?1:enter<1?.4+enter*1.1:1.5-.5*easeOutBack(settle)-(settle<.35?.08*Math.sin(settle/.35*Math.PI):0);
 c.globalAlpha*=motion?1:Math.min(1,enter*1.8);
 if(critical&&!motion)c.rotate(-.05+.05*settle);
 c.scale(sx,sy);
 c.drawImage(art,-TW/2,-TH/2);
 c.restore();
}
