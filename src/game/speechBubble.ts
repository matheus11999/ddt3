import bubbleArt from './bubbleArt.json';
/**
 * Comic speech bubble drawn in world space: a rounded (or cloud) balloon with a thick outline and bold
 * text (the game draws the words; no painted text), its tail pointing at the speaker's head.
 * It sits above the head, toward the side the speaker faces; when the top edge leaves no room
 * (the queen on her throne), it moves beside the head with a sideways tail. It pops in and fades out.
 * The look comes from the speaker's equipped Bolha (`BUBBLE_STYLES`, the `bubble` slot).
 */
export type BubbleEffect='none'|'puffs'|'embers'|'sparkles'|'stars'|'dragon';
export interface BubbleStyle {shape:'round'|'cloud';/** One colour, or top → bottom. */fill:string|[string,string];stroke:string;text:string;line:number;/** A thin second outline just inside the first. */inner?:string;/** Animated extras around the balloon (rarer Bolhas). */effect?:BubbleEffect;/** Soft light around the frame. */glow?:string;}
export const BUBBLE_STYLES:Record<string,BubbleStyle>={
 'bubble-classic':{shape:'round',fill:'#fffdf4',stroke:'#2a1a10',text:'#2a1a10',line:5},
 'bubble-cloud':{shape:'cloud',fill:['#ffffff','#dcefff'],stroke:'#2c5a86',text:'#173a5c',line:4.5,effect:'puffs'},
 'bubble-ember':{shape:'round',fill:['#fff6e2','#ffd9a0'],stroke:'#3a1405',text:'#4a1503',line:5.5,inner:'#ff8a2a',effect:'embers',glow:'#ff7a1a'},
 'bubble-royal':{shape:'round',fill:['#fffaf0','#f6e3b4'],stroke:'#5e3f0c',text:'#4a3008',line:5.5,inner:'#e3b23f',effect:'sparkles',glow:'#ffd76a'},
 'bubble-starlight':{shape:'round',fill:['#fbf8ff','#e6ddff'],stroke:'#2b2a6e',text:'#2b2160',line:5.5,inner:'#8fd6ff',effect:'stars',glow:'#9d7cff'},
 'bubble-dragon':{shape:'round',fill:['#f7fff2','#dcf5d2'],stroke:'#0f3a1e',text:'#123d1f',line:5.5,inner:'#d8b24a',effect:'dragon',glow:'#3fe07a'},
};
BUBBLE_STYLES['bubble-none']=BUBBLE_STYLES['bubble-classic'];
export const bubbleStyle=(id?:string)=>BUBBLE_STYLES[id??'']??BUBBLE_STYLES['bubble-classic'];
/** How long a chat line stays over the speaker, in ms. */
export const CHAT_BUBBLE_MS=5000;

/** Keeps the balloon below the battle HUD's top band (wind, clock, minimap). */
const HUD_BOTTOM=196,FONT=26,LINE=31,PAD_X=22,PAD_Y=16,MAX_WIDTH=300,RADIUS=24,TAIL=34;

function wrap(c:CanvasRenderingContext2D,text:string,max:number){
 const lines:string[]=[];let line='';
 for(const word of text.split(' ')){const next=line?`${line} ${word}`:word;if(line&&c.measureText(next).width>max){lines.push(line);line=word;}else line=next;}
 if(line)lines.push(line);return lines.slice(0,4);
}

/** Cloud outline: bumps all round the box. */
function cloudPath(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,bump:number){
 const edge=(x0:number,y0:number,x1:number,y1:number,nx:number,ny:number)=>{
  const n=Math.max(2,Math.round(Math.hypot(x1-x0,y1-y0)/(bump*2.6)));
  for(let i=0;i<n;i++){const a=i/n,b=(i+1)/n,mx=x0+(x1-x0)*(a+b)/2,my=y0+(y1-y0)*(a+b)/2;c.quadraticCurveTo(mx+nx*bump*1.6,my+ny*bump*1.6,x0+(x1-x0)*b,y0+(y1-y0)*b);}
 };
 c.moveTo(x,y);edge(x,y,x+w,y,0,-1);edge(x+w,y,x+w,y+h,1,0);edge(x+w,y+h,x,y+h,0,1);edge(x,y+h,x,y,-1,0);
}

export interface BubbleRect {x:number;y:number;w:number;h:number;}
export interface BubbleOptions {style?:BubbleStyle;/** Balloons already on screen: this one climbs above any it would cover (its tail grows). */avoid?:BubbleRect[];/** Only work out where it goes. */measure?:boolean;/** A top already worked out by a measuring pass. */at?:number;/** Lowest the balloon's top may go (the HUD band above it). */top?:number;/** 1 is the battle size. */scale?:number;/** Beside the face instead of above the head (a fighter lying down). */side?:boolean;}

/** Painted frames cut from the Codex sheets (scripts/build-bubble-art.py): a 9-slice body. The painted tail is
 * only the colour reference: the game draws a smooth curved tail in the frame's colours, so it can bend toward the speaker. */
interface BubbleArt {body:string;/** Border widths of the body that never stretch, in source pixels. */slice:[number,number,number,number];/** Source pixels per balloon pixel at scale 1. */density:number;}
const BUBBLE_ART=bubbleArt as unknown as Record<string,BubbleArt>;
const images=new Map<string,HTMLImageElement>();
function loaded(src:string){
 if(typeof Image==='undefined')return null;let img=images.get(src);
 if(!img){img=new Image();img.decoding='async';img.src=src;images.set(src,img);}
 return img.complete&&img.naturalWidth>0?img:null;
}
function artFor(style:BubbleStyle){
 const id=Object.keys(BUBBLE_STYLES).find(key=>BUBBLE_STYLES[key]===style&&BUBBLE_ART[key]),art=id?BUBBLE_ART[id]:undefined;if(!art)return null;
 const body=loaded(art.body);return body?{art,body}:null;
}
/** The stretched painted body, cut on whole pixels with no overlap (an overlap doubles the soft edges into
 * seams) and kept per size, so the glow is drawn once round the whole frame. */
const bodies=new Map<string,HTMLCanvasElement>();
function paintedBody(img:HTMLImageElement,[t,r,b,l]:[number,number,number,number],w:number,h:number,k:number){
 const W=Math.max(1,Math.round(w)),H=Math.max(1,Math.round(h)),key=`${img.src}|${W}x${H}|${k.toFixed(4)}`;let canvas=bodies.get(key);if(canvas)return canvas;
 if(bodies.size>48)bodies.clear();canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const g=canvas.getContext('2d')!;g.imageSmoothingQuality='high';
 const sw=img.naturalWidth,sh=img.naturalHeight,L=Math.min(Math.round(l*k),W>>1),R=Math.min(Math.round(r*k),W-L),T=Math.min(Math.round(t*k),H>>1),B=Math.min(Math.round(b*k),H-T);
 const xs=[[0,l,0,L],[l,sw-l-r,L,W-L-R],[sw-r,r,W-R,R]],ys=[[0,t,0,T],[t,sh-t-b,T,H-T-B],[sh-b,b,H-B,B]];
 for(const [sy,shh,dy,dh] of ys)for(const [sx,sww,dx,dw] of xs)if(sww>0&&shh>0&&dw>0&&dh>0)g.drawImage(img,sx,sy,sww,shh,dx,dy,dw,dh);
 bodies.set(key,canvas);return canvas;
}

/** Smooth tail from a base on the balloon's edge (`bx,by`, edge direction `ux,uy`, half width `hw`) to the tip:
 * both sides narrow in soft curves, bending a little like a comic balloon's, and meet in a rounded point. */
function tailPath(c:CanvasRenderingContext2D,bx:number,by:number,ux:number,uy:number,hw:number,tipX:number,tipY:number){
 const len=Math.max(1,Math.hypot(tipX-bx,tipY-by)),dx=(tipX-bx)/len,dy=(tipY-by)/len,nx=-dy,ny=dx,side=ux*nx+uy*ny>=0?1:-1;
 const ax=bx-ux*hw,ay=by-uy*hw,cx=bx+ux*hw,cy=by+uy*hw,r=Math.min(hw*.32,len*.12),bend=len*.12;
 // The tip's two shoulders, a rounded nose between them.
 const lx=tipX-dx*r-nx*side*r,ly=tipY-dy*r-ny*side*r,rx=tipX-dx*r+nx*side*r,ry=tipY-dy*r+ny*side*r;
 c.moveTo(ax,ay);
 c.bezierCurveTo(ax+dx*len*.45+nx*side*bend*.4,ay+dy*len*.45+ny*side*bend*.4,lx-dx*len*.25+nx*side*bend*.3,ly-dy*len*.25+ny*side*bend*.3,lx,ly);
 c.quadraticCurveTo(tipX+dx*r*.8,tipY+dy*r*.8,rx,ry);
 c.bezierCurveTo(rx-dx*len*.3+nx*side*bend,ry-dy*len*.3+ny*side*bend,cx+dx*len*.35+nx*side*bend*.6,cy+dy*len*.35+ny*side*bend*.6,cx,cy);
}

/** Deterministic 0..1 noise for the effect particles. */
const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function star(c:CanvasRenderingContext2D,x:number,y:number,r:number,points=4){
 c.beginPath();for(let i=0;i<points*2;i++){const a=-Math.PI/2+i*Math.PI/points,rr=i%2?r*.32:r;c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();
}
/** The rarer Bolhas' animated extras, drawn over (`front`) or under the balloon. */
function drawEffect(c:CanvasRenderingContext2D,effect:BubbleEffect,x:number,y:number,w:number,h:number,t:number,k:number,front:boolean){
 if(effect==='none')return;c.save();
 if(effect==='puffs'&&!front){
  for(let i=0;i<4;i++){const p=(t/2400+hash(i))%1,px=x+w*(.15+.7*hash(i+9)),py=y-p*26*k;c.globalAlpha=.55*(1-p)*Math.min(1,p*6);c.fillStyle='#ffffff';c.beginPath();c.arc(px,py,(5+5*hash(i+3))*k*(1-p*.4),0,Math.PI*2);c.fill();}
 }
 if(effect==='embers'&&front){
  c.globalCompositeOperation='lighter';
  for(let i=0;i<12;i++){const p=(t/1500+hash(i))%1,edge=hash(i+40)<.6,px=x+w*hash(i+7)+Math.sin(t/260+i)*5*k,py=(edge?y+h*.2:y+h)-p*(edge?40:58)*k;const r=(1.6+2.2*hash(i+2))*k*(1-p*.5);
   c.globalAlpha=(1-p)*Math.min(1,p*5);const g=c.createRadialGradient(px,py,0,px,py,r*3);g.addColorStop(0,'#fff6c0');g.addColorStop(.35,'#ffae3a');g.addColorStop(1,'rgba(255,90,0,0)');c.fillStyle=g;c.beginPath();c.arc(px,py,r*3,0,Math.PI*2);c.fill();}
 }
 if(effect==='sparkles'&&front){
  for(let i=0;i<7;i++){const cycle=t/1400+hash(i)*3,phase=cycle%1,slot=Math.floor(cycle),along=hash(i*13+slot);const side=Math.floor(hash(i*7+slot)*4),px=side<2?x+w*along:side===2?x:x+w,py=side===0?y:side===1?y+h:y+h*along;
   const s=Math.sin(Math.PI*phase);if(s<=0)continue;c.globalAlpha=s;c.fillStyle='#fff7c8';c.shadowColor='#ffd24a';c.shadowBlur=8*k;star(c,px,py,(5+4*hash(i+5))*k*s);c.fill();}
 }
 if(effect==='stars'){
  // Little stars on an orbit round the balloon: the far half under it, the near half over it.
  for(let i=0;i<6;i++){const a=t/1700*Math.PI*2/3+i*Math.PI/3,near=Math.sin(a)>0;if(near!==front)continue;const px=x+w/2+Math.cos(a)*(w/2+12*k),py=y+h/2+Math.sin(a)*(h/2+9*k);
   c.globalAlpha=near?1:.55;c.fillStyle=i%2?'#fff1a8':'#bfe9ff';c.shadowColor=i%2?'#ffd24a':'#7fc8ff';c.shadowBlur=10*k;star(c,px,py,(near?8.5:6)*k*(1+.25*Math.sin(t/180+i)),i%3?4:5);c.fill();}
 }
 if(effect==='dragon'&&front){
  c.globalCompositeOperation='lighter';
  for(const cornerX of [x+10*k,x+w-10*k])for(let i=0;i<6;i++){const p=(t/900+hash(i+(cornerX>x+w/2?20:0)))%1,px=cornerX+Math.sin(t/200+i*2)*4*k,py=y+h-p*38*k,r=(4.5+4*hash(i+11))*k*(1-p*.7);
   c.globalAlpha=(1-p)*.9;const g=c.createRadialGradient(px,py,0,px,py,r*2.2);g.addColorStop(0,'#f2ffd0');g.addColorStop(.4,'#58f08a');g.addColorStop(1,'rgba(20,160,70,0)');c.fillStyle=g;c.beginPath();c.arc(px,py,r*2.2,0,Math.PI*2);c.fill();}
 }
 c.restore();
}
/** A band of light that sweeps across the balloon now and then (Real, Estelar). */
function drawSweep(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,t:number){
 const p=(t%2600)/1100;if(p>1)return;const sx=x-w*.3+(w*1.6)*p,g=c.createLinearGradient(sx-40,y,sx+40,y+h);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');
 c.save();c.globalCompositeOperation='lighter';c.fillStyle=g;c.fillRect(x,y,w,h);c.restore();
}

/** `tipX/tipY`: the speaker's head; `age` since it appeared and `left` until it goes, in ms; `worldWidth` keeps it on the map. */
export function drawSpeechBubble(c:CanvasRenderingContext2D,text:string,tipX:number,tipY:number,facing:1|-1,age:number,left:number,worldWidth:number,options:BubbleOptions={}):BubbleRect{
 const style=options.style??BUBBLE_STYLES['bubble-classic'],k=options.scale??1,limit=options.top??HUD_BOTTOM;
 const line=LINE*k,padX=PAD_X*k,padY=PAD_Y*k,radius=RADIUS*k,tail=TAIL*k,cloud=style.shape==='cloud',bump=8*k,painted=artFor(style);
 const frame=painted?{x:painted.art.slice[3]*k/painted.art.density*.55,y:painted.art.slice[0]*k/painted.art.density*.55}:{x:cloud?bump:0,y:cloud?bump/2:0};
 c.save();c.font=`900 ${FONT*k}px 'Nunito', sans-serif`;
 const lines=wrap(c,text,MAX_WIDTH*k),w=Math.max(...lines.map(l=>c.measureText(l).width))+padX*2+frame.x*2,h=lines.length*line+padY*2+frame.y*2;
 const above=!options.side&&tipY-tail-h>=limit,margin=10*k+(cloud?bump*1.6:0);
 const cx=above?Math.max(w/2+margin,Math.min(worldWidth-w/2-margin,tipX+facing*(w*.32))):Math.max(w/2+margin,Math.min(worldWidth-w/2-margin,tipX+facing*(w/2+tail+18*k)));
 let top=options.at??(above?tipY-tail-h:Math.max(limit,tipY-h*(options.side?1.05:.85)));const left0=cx-w/2,right0=cx+w/2;
 for(let moved=true,guard=0;moved&&guard<8;guard++){moved=false;for(const r of options.avoid??[])if(left0<r.x+r.w&&right0>r.x&&top<r.y+r.h&&top+h>r.y){top=r.y-h-4*k;moved=true;}}
 const bottom=top+h,rect={x:left0,y:top,w,h};
 if(options.measure){c.restore();return rect;}
 // Pop with a small overshoot, fade at the end.
 const pop=Math.min(1,age/200),scale=pop<1?.55+.55*pop-.1*Math.sin(Math.PI*pop):1;
 c.globalAlpha*=Math.max(0,Math.min(1,left/160,age/80));
 c.translate(tipX,tipY);c.scale(scale,scale);c.translate(-tipX,-tipY);
 // Where the tail leaves the balloon: under it toward the speaker, or from the edge facing the speaker.
 const sideX=tipX<cx?left0:right0,baseY=Math.min(bottom-radius-10*k,Math.max(top+radius,tipY-6*k));
 const base=above?{x:Math.max(left0+radius+12*k,Math.min(right0-radius-12*k,tipX+(cx-tipX)*.35)),y:bottom-style.line*k*.5,ux:1,uy:0}:{x:sideX+(sideX===left0?1:-1)*style.line*k*.5,y:baseY,ux:0,uy:1};
 const hw=12*k,body=()=>{c.beginPath();if(cloud)cloudPath(c,left0,top,w,h,bump);else c.roundRect(left0,top,w,h,radius);c.closePath();};
 let fill:string|CanvasGradient=typeof style.fill==='string'?style.fill:'';
 if(typeof style.fill!=='string'){const g=c.createLinearGradient(0,top,0,bottom);g.addColorStop(0,style.fill[0]);g.addColorStop(1,style.fill[1]);fill=g;}
 const t=age;drawEffect(c,style.effect??'none',left0,top,w,h,t,k,false);
 c.lineJoin='round';
 if(painted){
  // Painted frame: one smooth curved tail in the frame's colours, its root tucked under the border; then the
  // stretched body, with the glow (or a soft drop shadow) round it once.
  const {art,body:img}=painted,ks=k/art.density,tuck=Math.min(art.slice[0],art.slice[3])*ks*.45;
  const root=above?{...base,y:bottom-tuck}:{...base,x:sideX+(sideX===left0?1:-1)*tuck};
  if(cloud)for(const [f,r] of [[.45,9],[.78,5.5]] as const){const px=base.x+(tipX-base.x)*f,py=base.y+(tipY-base.y)*f;c.beginPath();c.arc(px,py,r*k,0,Math.PI*2);c.fillStyle=fill;c.fill();c.lineWidth=style.line*.8*k;c.strokeStyle=style.stroke;c.stroke();}
  else{c.beginPath();tailPath(c,root.x,root.y,root.ux,root.uy,hw*1.45,tipX,tipY);c.fillStyle=fill;c.fill();c.lineWidth=style.line*.75*k;c.strokeStyle=style.stroke;c.stroke();}
  if(style.inner&&!cloud){c.save();c.beginPath();tailPath(c,root.x,root.y,root.ux,root.uy,hw*1.45,tipX,tipY);c.clip();c.beginPath();tailPath(c,root.x,root.y,root.ux,root.uy,hw*1.45,tipX,tipY);c.lineWidth=style.line*1.9*k;c.strokeStyle=style.inner;c.stroke();c.lineWidth=style.line*.75*k;c.strokeStyle=style.stroke;c.stroke();c.restore();}
  const canvas=paintedBody(img,art.slice,w,h,ks);c.save();
  if(style.glow){c.shadowColor=style.glow;c.shadowBlur=14*k;}else{c.shadowColor='rgba(0,0,0,.3)';c.shadowOffsetY=3*k;c.shadowBlur=6*k;}
  c.drawImage(canvas,left0,top,w,h);c.restore();
 }else{
  // Cloud: a trail of little puffs, as in a thought balloon; others: one smooth curved tail.
  if(style.glow){c.save();c.shadowColor=style.glow;c.shadowBlur=16*k;body();c.fillStyle=fill;c.fill();c.restore();}
  if(cloud){for(const [f,r] of [[.42,8],[.72,5]] as const){const px=base.x+(tipX-base.x)*f,py=base.y+(tipY-base.y)*f;c.beginPath();c.arc(px,py,r*k,0,Math.PI*2);c.fillStyle=fill;c.fill();c.lineWidth=style.line*.8*k;c.strokeStyle=style.stroke;c.stroke();}}
  else{c.beginPath();tailPath(c,base.x,base.y,base.ux,base.uy,hw,tipX,tipY);c.fillStyle=fill;c.fill();c.lineWidth=style.line*k;c.strokeStyle=style.stroke;c.stroke();}
  body();c.shadowColor='rgba(0,0,0,.3)';c.shadowOffsetY=3*k;c.shadowBlur=6*k;c.fillStyle=fill;c.fill();
  c.shadowColor='transparent';c.lineWidth=style.line*k;c.strokeStyle=style.stroke;c.stroke();
  if(style.inner){c.save();body();c.clip();body();c.lineWidth=style.line*2.2*k;c.strokeStyle=style.inner;c.stroke();c.lineWidth=style.line*k;c.strokeStyle=style.stroke;c.stroke();c.restore();}
  // Merge the tail into the body: paint its root over the body's outline.
  if(!cloud){c.save();c.beginPath();tailPath(c,base.x,base.y,base.ux,base.uy,hw-style.line*k*.5,tipX,tipY);c.clip();c.beginPath();c.rect(base.x-hw*2,base.y-hw*2,hw*4,hw*4);c.fillStyle=fill;c.fill();c.restore();}
  // A painted-style highlight on the top-left of the frame.
  if(!cloud){c.save();body();c.clip();c.globalAlpha*=.55;c.strokeStyle='#ffffff';c.lineWidth=3*k;c.beginPath();c.moveTo(left0+radius*.7,top+6*k);c.lineTo(left0+Math.min(w*.45,90*k),top+6*k);c.stroke();c.restore();}
 }
 if(style.effect==='sparkles'||style.effect==='stars'){c.save();body();c.clip();drawSweep(c,left0,top,w,h,t);c.restore();}
 c.fillStyle=style.text;c.textAlign='center';c.textBaseline='middle';
 const textTop=top+padY+frame.y;
 lines.forEach((l,index)=>c.fillText(l,cx,textTop+line*(index+.5)+1*k));
 drawEffect(c,style.effect??'none',left0,top,w,h,t,k,true);
 c.restore();return rect;
}

export interface SpeechLine {text:string;tipX:number;tipY:number;facing:1|-1;age:number;left:number;options:BubbleOptions;}
/** Several balloons at once, oldest first: a newer one climbs above those it would cover, and the newer
 * (higher) ones are drawn first so the lower balloons sit over their longer tails. */
export function drawSpeechBubbles(c:CanvasRenderingContext2D,lines:SpeechLine[],worldWidth:number){
 const taken:BubbleRect[]=[],tops=lines.map(l=>{const r=drawSpeechBubble(c,l.text,l.tipX,l.tipY,l.facing,l.age,l.left,worldWidth,{...l.options,avoid:taken,measure:true});taken.push(r);return r.y;});
 for(let i=lines.length-1;i>=0;i--){const l=lines[i];drawSpeechBubble(c,l.text,l.tipX,l.tipY,l.facing,l.age,l.left,worldWidth,{...l.options,at:tops[i]});}
}
