/**
 * Pescaria: the fishing zone next to Praça Celeste (docs/fishing.md). Four screens wide; the camera
 * follows the player like on the plaza.
 *
 * Depth, back to front: the painted parallax layers built by `npm run build:lobby --
 * --layout=scripts/fishing-layout.json` (sky and sea, far islands with a lighthouse and sailboats,
 * floating islands, the tree line), the meadow floor with the lakes and piers, the hedge along the
 * path, then the fishing house, the gate and the players.
 *
 * The meadow, the water, the piers, the house, the gate, the rod and the fish are drawn in code
 * as STAND-INS until Codex paints them (docs/fishing-art-prompts.md lists every file). A painted file
 * at its path replaces its stand-in with no code change.
 */
import {FISHING_GROUND_TOP,FISHING_LAKES,FISHING_PIERS,FISHING_SPOTS,FISHING_WIDTH,FISH_BY_ID,inLake} from '../../shared/fishing';
import type {FishingLake,FishingPose,FishingSpot} from '../../shared/fishing';
import {FISHING_FLOATERS,FISHING_PARALLAX} from '../../shared/generated/fishingParallax';
import type {LobbyFloater,LobbyParallaxLayer} from '../../shared/generated/lobbyParallax';
import {drawScaled,imageReady,scaledCopy,screenScale} from './spriteCache';
import {plaque} from './lobbyWorld';

const VIEW=1536,H=864;
export type FishingAction='shop'|'plaza';
export interface FishingStation {id:'house'|'gate';title:string;x:number;y:number;width:number;height:number;action:FishingAction;art:string;}
/** Buildings standing on the meadow; `art` is the painted file that replaces the stand-in (feet at the bottom centre). */
export const FISHING_STATIONS:FishingStation[]=[
 {id:'house',title:'Casa de Pesca',x:2330,y:640,width:420,height:330,action:'shop',art:'/assets/fishing/house.png'},
 {id:'gate',title:'Praça Celeste',x:170,y:636,width:200,height:250,action:'plaza',art:'/assets/fishing/gate.png'},
];
/** What a click on the meadow means: a station, or the water of a lake (walk to its nearest free spot). */
export type FishingHit={kind:'station';station:FishingStation}|{kind:'lake';lake:FishingLake};

/** Small deterministic generator, so the meadow never shimmers between reloads. */
function random(seed:number){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const LAKE_COLORS:Record<string,{deep:string;mid:string;edge:string}>={
 ninfeias:{deep:'#1f7f78',mid:'#2fae9c',edge:'#8fe3c8'},
 profundo:{deep:'#0f2f78',mid:'#1f5fb0',edge:'#6fc2ec'},
 cristal:{deep:'#1b8fc0',mid:'#43c9ea',edge:'#c4f6ff'},
};

/** A fish seen from the side (stand-in for the painted fish atlas), nose toward +x. */
export function drawFish(c:CanvasRenderingContext2D,id:string,x:number,y:number,length:number,angle=0,alpha=1){
 const fish=FISH_BY_ID.get(id),color=fish?.color??'#8fb8d8',l=length;c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(angle);
 if(id==='bota-velha'){c.fillStyle='#6b4a2e';c.strokeStyle='#2e1c10';c.lineWidth=l*.05;c.beginPath();c.moveTo(-l*.3,-l*.35);c.lineTo(l*.05,-l*.35);c.lineTo(l*.08,-l*.02);c.quadraticCurveTo(l*.45,0,l*.42,l*.18);c.lineTo(-l*.32,l*.18);c.closePath();c.fill();c.stroke();c.fillStyle='#3a2616';c.fillRect(-l*.34,l*.12,l*.78,l*.08);c.restore();return;}
 const body=c.createLinearGradient(0,-l*.22,0,l*.22);body.addColorStop(0,shade(color,-.35));body.addColorStop(.45,color);body.addColorStop(1,shade(color,.45));
 c.strokeStyle=shade(color,-.6);c.lineWidth=Math.max(1,l*.035);c.lineJoin='round';
 // Tail, then the body over it, a fin and the eye.
 c.fillStyle=shade(color,-.15);c.beginPath();c.moveTo(-l*.32,0);c.lineTo(-l*.55,-l*.2);c.quadraticCurveTo(-l*.47,0,-l*.55,l*.2);c.closePath();c.fill();c.stroke();
 c.fillStyle=body;c.beginPath();c.ellipse(0,0,l*.38,l*.19,0,0,Math.PI*2);c.fill();c.stroke();
 c.fillStyle=shade(color,-.2);c.beginPath();c.moveTo(-l*.08,-l*.17);c.quadraticCurveTo(l*.02,-l*.34,l*.14,-l*.16);c.closePath();c.fill();c.stroke();
 c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=Math.max(1,l*.025);c.beginPath();c.ellipse(-l*.02,-l*.05,l*.24,l*.08,0,Math.PI*1.1,Math.PI*1.9);c.stroke();
 c.fillStyle='#fff';c.beginPath();c.arc(l*.22,-l*.04,l*.055,0,Math.PI*2);c.fill();c.fillStyle='#1b1b2a';c.beginPath();c.arc(l*.235,-l*.04,l*.03,0,Math.PI*2);c.fill();
 c.restore();
}
/** Lighter (k>0) or darker (k<0) version of a #rrggbb color. */
function shade(hex:string,k:number){const n=parseInt(hex.slice(1),16),f=(v:number)=>Math.round(k>0?v+(255-v)*k:v*(1+k));return `rgb(${f(n>>16&255)},${f(n>>8&255)},${f(n&255)})`;}

export class FishingWorld {
 private depth:{factor:number;layer?:LobbyParallaxLayer;floater?:LobbyFloater;image:HTMLImageElement}[]=[];
 private meadow:HTMLCanvasElement|null=null;private assets=false;
 private art=new Map<string,HTMLImageElement>();
 load(){
  if(this.assets)return;this.assets=true;
  const entries=[...FISHING_PARALLAX.map(layer=>({factor:layer.factor,layer,file:layer.file})),...FISHING_FLOATERS.map(floater=>({factor:floater.factor,floater,file:floater.file}))];
  this.depth=entries.sort((a,b)=>a.factor-b.factor).map(({file,...entry})=>{const image=new Image();image.decoding='async';image.src=file;return {...entry,image};});
  for(const station of FISHING_STATIONS){const image=new Image();image.src=station.art;this.art.set(station.id,image);}
 }
 release(){if(!this.assets)return;this.assets=false;this.depth=[];this.meadow=null;this.art.clear();}
 get isLoaded(){return this.assets;}
 private deep(){return this.depth.length>0&&this.depth.every(d=>imageReady(d.image));}
 ready(_scale:number){return this.deep();}
 static camera(focusX:number){return Math.max(0,Math.min(FISHING_WIDTH-VIEW,focusX-VIEW/2));}
 private drawDepth(c:CanvasRenderingContext2D,t:number,cam:number,front:boolean){
  const scale=screenScale(c),x0=cam,x1=cam+VIEW;
  for(const {factor,layer,floater,image} of this.depth){
   if((factor>=1)!==front)continue;
   const left=cam*(1-factor);
   if(layer){const art=scaledCopy(image,layer.width*scale)??image,k=art.width/layer.width,from=Math.max(0,x0-left),to=Math.min(layer.width,x1-left);if(to>from)c.drawImage(art,from*k,0,(to-from)*k,art.height,left+from,layer.y,to-from,layer.height);continue;}
   const f=floater!,phase=t/f.period*Math.PI*2+f.x*.01,x=left+f.x+Math.sin(phase*.5)*f.drift-f.w/2,y=f.y+Math.sin(phase)*f.bob-f.h/2;
   if(x<x1&&x+f.w>x0)c.drawImage(image,x,y,f.w,f.h);
  }
 }
 /**
  * The meadow under the walkers (stand-in for the painted ground): grass that darkens toward the
  * front, a sandy path behind the lakes, tufts and flowers. Built once.
  */
 private ground(){
  if(this.meadow)return this.meadow;
  const top=FISHING_GROUND_TOP-6,h=H-top,canvas=document.createElement('canvas');canvas.width=FISHING_WIDTH;canvas.height=h;
  const g=canvas.getContext('2d')!,rand=random(31);
  const base=g.createLinearGradient(0,0,0,h);base.addColorStop(0,'#a8d86a');base.addColorStop(.25,'#86c454');base.addColorStop(1,'#3f8a33');g.fillStyle=base;g.fillRect(0,0,FISHING_WIDTH,h);
  // Soft light patches, like sun through the clouds.
  for(let i=0;i<70;i++){const x=rand()*FISHING_WIDTH,y=rand()*h,r=60+rand()*160,p=g.createRadialGradient(x,y,0,x,y,r);p.addColorStop(0,rand()<.5?'rgba(255,250,190,.16)':'rgba(30,90,30,.14)');p.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=p;g.fillRect(x-r,y-r,r*2,r*2);}
  // The sandy path behind the lakes (the walking line at y≈584) and its worn edges.
  const py=584-top;
  for(let x=-40;x<FISHING_WIDTH+40;x+=6){const w=22+Math.sin(x/170)*5+rand()*3;const s=g.createLinearGradient(0,py-w,0,py+w);s.addColorStop(0,'rgba(222,190,120,0)');s.addColorStop(.3,'#e2c182');s.addColorStop(.7,'#d4ae6c');s.addColorStop(1,'rgba(180,140,80,0)');g.fillStyle=s;g.fillRect(x,py-w,7,w*2);}
  for(let i=0;i<500;i++){const x=rand()*FISHING_WIDTH,y=py-14+rand()*28;g.fillStyle=rand()<.5?'rgba(150,115,70,.55)':'rgba(255,240,200,.6)';g.beginPath();g.ellipse(x,y,1.5+rand()*3,1+rand()*1.6,0,0,Math.PI*2);g.fill();}
  // Grass tufts grow with depth: small and pale far away, big and dark near the camera.
  for(let i=0;i<9000;i++){
   const y=rand()*h,x=rand()*FISHING_WIDTH,depth=y/h,len=3+depth*11+rand()*4;
   if(Math.abs(y-py)<18)continue;
   g.strokeStyle=rand()<.55?`rgba(40,${100+depth*20|0},35,${.35+depth*.3})`:`rgba(${190-depth*60|0},235,120,${.35+depth*.2})`;g.lineWidth=1+depth*1.4;
   g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+(rand()-.5)*6,y-len*.6,x+(rand()-.5)*8,y-len);g.stroke();
  }
  for(let i=0;i<420;i++){const x=rand()*FISHING_WIDTH,y=20+rand()*(h-20),depth=y/h,r=1.4+depth*2.6;if(Math.abs(y-py)<20)continue;g.fillStyle=['#fff7e6','#ffd84a','#ff9ec4','#c9a8ff'][i%4];for(let k=0;k<5;k++){g.beginPath();g.arc(x+Math.cos(k*1.26)*r,y+Math.sin(k*1.26)*r*.6,r*.7,0,Math.PI*2);g.fill();}g.fillStyle='#f6a21a';g.beginPath();g.arc(x,y,r*.5,0,Math.PI*2);g.fill();}
  const fade=g.createLinearGradient(0,0,0,40);fade.addColorStop(0,'rgba(60,110,40,.45)');fade.addColorStop(1,'rgba(60,110,40,0)');g.fillStyle=fade;g.fillRect(0,0,FISHING_WIDTH,40);
  this.meadow=canvas;return canvas;
 }
 private lake(c:CanvasRenderingContext2D,lake:FishingLake,t:number){
  const {x,y,rx,ry}=lake,colors=LAKE_COLORS[lake.id]??LAKE_COLORS.ninfeias;
  c.save();
  // Muddy shore, then a wet dark band where the bank meets the water.
  const shore=c.createRadialGradient(x,y,rx*.8,x,y,rx+26);shore.addColorStop(0,'#8a6a3a');shore.addColorStop(.85,'#c9a768');shore.addColorStop(1,'rgba(201,167,104,0)');
  c.fillStyle=shore;c.beginPath();c.ellipse(x,y+2,rx+26,ry+13,0,0,Math.PI*2);c.fill();
  c.fillStyle='#5a4426';c.beginPath();c.ellipse(x,y+1,rx+6,ry+4,0,0,Math.PI*2);c.fill();
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.clip();
  const water=c.createRadialGradient(x,y+ry*.25,rx*.05,x,y+ry*.1,rx);water.addColorStop(0,colors.deep);water.addColorStop(.6,colors.mid);water.addColorStop(1,colors.edge);
  c.fillStyle=water;c.fillRect(x-rx,y-ry,rx*2,ry*2);
  // The far bank shades the back of the water; the sky brightens the front.
  const back=c.createLinearGradient(0,y-ry,0,y);back.addColorStop(0,'rgba(10,30,40,.45)');back.addColorStop(1,'rgba(10,30,40,0)');c.fillStyle=back;c.fillRect(x-rx,y-ry,rx*2,ry);
  const sky=c.createLinearGradient(0,y,0,y+ry);sky.addColorStop(0,'rgba(220,250,255,0)');sky.addColorStop(1,'rgba(220,250,255,.28)');c.fillStyle=sky;c.fillRect(x-rx,y,rx*2,ry);
  // Drifting glints and slow ripples.
  const rand=random(lake.x);
  c.globalCompositeOperation='lighter';
  for(let i=0;i<26;i++){const gx=x-rx+((rand()*rx*2+t*.012*(1+rand()))%(rx*2)),gy=y-ry*.7+rand()*ry*1.5,a=.18+Math.sin(t/600+i)*.12,w=10+rand()*26;c.strokeStyle=`rgba(255,255,255,${Math.max(0,a)})`;c.lineWidth=1.6;c.beginPath();c.moveTo(gx-w/2,gy);c.lineTo(gx+w/2,gy);c.stroke();}
  c.globalCompositeOperation='source-over';
  for(let i=0;i<5;i++){const k=((t/4200+i/5)%1),rx2=10+k*46,cx=x+(rand()-.5)*rx*1.4,cy=y+(rand()-.5)*ry*1.1;c.strokeStyle=`rgba(255,255,255,${.35*(1-k)})`;c.lineWidth=1.4;c.beginPath();c.ellipse(cx,cy,rx2,rx2*.3,0,0,Math.PI*2);c.stroke();}
  if(lake.id==='ninfeias')for(let i=0;i<14;i++){const lx=x+(rand()-.5)*rx*1.7,ly=y+(rand()-.5)*ry*1.5,r=9+rand()*9;if(!inLake(lake,lx,ly))continue;c.fillStyle='#3e9c3a';c.strokeStyle='#235f22';c.lineWidth=1.5;c.beginPath();c.ellipse(lx,ly,r,r*.42,0,.25,Math.PI*2-.25);c.lineTo(lx,ly);c.closePath();c.fill();c.stroke();if(i%3===0){c.fillStyle='#ff9ec4';c.beginPath();c.arc(lx+r*.3,ly-3,4,0,Math.PI*2);c.fill();c.fillStyle='#fff3a0';c.beginPath();c.arc(lx+r*.3,ly-3,1.6,0,Math.PI*2);c.fill();}}
  if(lake.id==='cristal'){c.globalCompositeOperation='lighter';for(let i=0;i<18;i++){const sx=x+(rand()-.5)*rx*1.8,sy=y+(rand()-.5)*ry*1.6,a=Math.max(0,Math.sin(t/500+i*1.7));c.fillStyle=`rgba(220,255,255,${a*.8})`;c.beginPath();c.moveTo(sx,sy-5);c.lineTo(sx+1.5,sy);c.lineTo(sx,sy+5);c.lineTo(sx-1.5,sy);c.closePath();c.fill();}c.globalCompositeOperation='source-over';}
  if(lake.id==='profundo'){const swirl=c.createRadialGradient(x,y+6,0,x,y+6,rx*.35);swirl.addColorStop(0,'rgba(5,10,40,.55)');swirl.addColorStop(1,'rgba(5,10,40,0)');c.fillStyle=swirl;c.beginPath();c.ellipse(x,y+6,rx*.35,ry*.45,0,0,Math.PI*2);c.fill();}
  c.restore();
  // Reeds and stones on the shore.
  c.save();for(let i=0;i<10;i++){const a=rand()*Math.PI*2;if(Math.sin(a)>.2)continue;const ex=x+Math.cos(a)*(rx+4),ey=y+Math.sin(a)*(ry+3);for(let k=0;k<4;k++){const h=14+rand()*16,sway=Math.sin(t/900+i+k)*2;c.strokeStyle='#2f6a28';c.lineWidth=2;c.beginPath();c.moveTo(ex+k*3,ey);c.quadraticCurveTo(ex+k*3,ey-h*.5,ex+k*3+sway,ey-h);c.stroke();if(k===1){c.fillStyle='#7a4a24';c.beginPath();c.ellipse(ex+k*3+sway,ey-h,2.2,5,0,0,Math.PI*2);c.fill();}}}
  for(let i=0;i<6;i++){const a=Math.PI*(.15+rand()*.7),ex=x+Math.cos(a)*(rx+8),ey=y+Math.sin(a)*(ry+5),r=5+rand()*7;const s=c.createLinearGradient(0,ey-r,0,ey+r);s.addColorStop(0,'#c9c4b8');s.addColorStop(1,'#7d776c');c.fillStyle=s;c.beginPath();c.ellipse(ex,ey,r,r*.6,0,0,Math.PI*2);c.fill();}
  c.restore();
 }
 private pier(c:CanvasRenderingContext2D,p:typeof FISHING_PIERS[number]){
  const w=p.x1-p.x0;c.save();
  // Posts into the water with their reflection, then the deck and its front edge.
  for(const px of [p.x0+5,p.x1-5])for(const py of [p.y1-4,(p.y0+p.y1)/2+20]){c.fillStyle='#4a2f1a';c.fillRect(px-4,py,8,22);c.fillStyle='rgba(30,20,10,.25)';c.fillRect(px-4,py+22,8,10);}
  const deck=c.createLinearGradient(p.x0,0,p.x1,0);deck.addColorStop(0,'#9a6838');deck.addColorStop(.5,'#c08a50');deck.addColorStop(1,'#8f5e32');
  c.fillStyle=deck;c.fillRect(p.x0,p.y0,w,p.y1-p.y0);
  c.strokeStyle='rgba(70,40,18,.55)';c.lineWidth=1.5;for(let y=p.y0+9;y<p.y1;y+=9){c.beginPath();c.moveTo(p.x0,y);c.lineTo(p.x1,y);c.stroke();}
  c.fillStyle='rgba(255,230,180,.25)';c.fillRect(p.x0+3,p.y0,3,p.y1-p.y0);
  c.fillStyle='#5b3a1e';c.fillRect(p.x0,p.y1,w,9);c.strokeStyle='#3a2410';c.lineWidth=2;c.strokeRect(p.x0,p.y0,w,p.y1-p.y0+9);
  c.restore();
 }
 /** Sky, far layers, meadow, lakes, piers and the hedge; the caller already translated by -camX. */
 drawBack(c:CanvasRenderingContext2D,t:number,camX:number){
  if(!this.deep()){c.fillStyle='#9ed4e8';c.fillRect(camX,0,VIEW,H);return;}
  c.save();c.imageSmoothingQuality='low';this.drawDepth(c,t,camX,false);
  const meadow=this.ground(),top=FISHING_GROUND_TOP-6;c.drawImage(meadow,camX,0,VIEW,meadow.height,camX,top,VIEW,meadow.height);
  for(const lake of FISHING_LAKES)if(lake.x+lake.rx+40>camX&&lake.x-lake.rx-40<camX+VIEW)this.lake(c,lake,t);
  for(const pier of FISHING_PIERS)if(pier.x1>camX&&pier.x0<camX+VIEW)this.pier(c,pier);
  this.drawDepth(c,t,camX,true);c.restore();
 }
 /** Free spots glow softly on the ground; the lake under the pointer glows more. */
 drawSpots(c:CanvasRenderingContext2D,t:number,taken:Set<string>,hoverLake:string|null){
  for(const spot of FISHING_SPOTS){if(taken.has(spot.id))continue;const on=hoverLake===spot.lake,a=(on?.75:.35)+Math.sin(t/500+spot.x)*.12;
   c.save();c.strokeStyle=`rgba(255,236,150,${a})`;c.lineWidth=on?3:2;c.beginPath();c.ellipse(spot.x,spot.y+4,22,7,0,0,Math.PI*2);c.stroke();
   c.fillStyle=`rgba(255,236,150,${a*.25})`;c.fill();c.restore();}
 }
 private station(c:CanvasRenderingContext2D,s:FishingStation,t:number,hover:boolean){
  const image=this.art.get(s.id);
  c.save();c.fillStyle='rgba(40,60,20,.35)';c.beginPath();c.ellipse(s.x,s.y,s.width*.48,18,0,0,Math.PI*2);c.fill();
  // The glow filter goes on the one painted image only: on the many paths of a stand-in it costs seconds a frame.
  if(image&&imageReady(image)){const h=s.height,w=h*image.naturalWidth/image.naturalHeight;if(hover)c.filter='brightness(1.1) drop-shadow(0 0 10px #fff2a0)';drawScaled(c,image,s.x-w/2,s.y-h,w,h);}
  else{if(s.id==='house')house(c,s.x,s.y,t);else gate(c,s.x,s.y);
   if(hover){c.strokeStyle='rgba(255,242,160,.8)';c.lineWidth=3;c.beginPath();c.ellipse(s.x,s.y,s.width*.5,20,0,0,Math.PI*2);c.stroke();}}
  c.restore();
 }
 sprites(t:number,hover:string|null){return FISHING_STATIONS.map(s=>({y:s.y-20,draw:(c:CanvasRenderingContext2D)=>this.station(c,s,t,hover===s.id)}));}
 drawFront(c:CanvasRenderingContext2D,_t:number,hover:string|null){
  for(const s of FISHING_STATIONS)plaque(c,s.title,s.x,s.y-s.height-18,s.id==='house',hover===s.id);
 }
 drawOverlay(c:CanvasRenderingContext2D,t:number){
  for(let i=0;i<18;i++){const x=(i*137+t*.012)%VIEW,y=140+(i*71)%460+Math.sin(t/1300+i)*15;c.fillStyle=`rgba(255,255,230,${.22+Math.sin(t/800+i)*.16})`;c.beginPath();c.arc(x,y,1.4+i%2,0,Math.PI*2);c.fill();}
 }
 hit(x:number,y:number):FishingHit|null{
  for(const station of FISHING_STATIONS){const half=station.width*.4;if(x>=station.x-half&&x<=station.x+half&&y>=station.y-station.height&&y<=station.y+14)return {kind:'station',station};}
  const lake=FISHING_LAKES.find(l=>((x-l.x)/(l.rx+10))**2+((y-l.y)/(l.ry+8))**2<1);
  return lake?{kind:'lake',lake}:null;
 }
 /**
  * The rod, line and float of someone fishing, and the fish on a catch (stand-ins for the
  * painted rod and catch sprites). `x,y` are the player's feet, `size` their drawn height.
  */
 drawGear(c:CanvasRenderingContext2D,pose:FishingPose,spot:FishingSpot,x:number,y:number,size:number,now:number){
  const age=Math.max(0,now-pose.since),f=spot.facing,hx=x+f*size*.2,hy=y-size*.55,length=size*.95;
  let angle=pose.phase==='idle'?70:pose.phase==='waiting'?38:pose.phase==='bite'?28+Math.sin(age/70)*4:38,bend=pose.phase==='bite'?.22:0;
  if(pose.phase==='result'&&pose.success){const k=Math.min(1,age/450);angle=38+k*70;bend=.12*(1-k);}
  if(pose.phase==='result'&&!pose.success){const k=Math.min(1,age/250);angle=38+k*40;}
  const a=angle*Math.PI/180,tx=hx+f*Math.cos(a)*length,ty=hy-Math.sin(a)*length;
  // Bent rod: the tip pulled toward the water.
  const mx=(hx+tx)/2+f*bend*length*.4,my=(hy+ty)/2+bend*length*.6;
  c.save();c.lineCap='round';
  c.strokeStyle='#4a2c14';c.lineWidth=5;c.beginPath();c.moveTo(hx,hy);c.quadraticCurveTo(mx,my,tx,ty);c.stroke();
  c.strokeStyle='#c99152';c.lineWidth=2.6;c.beginPath();c.moveTo(hx,hy);c.quadraticCurveTo(mx,my,tx,ty);c.stroke();
  c.fillStyle='#2b2b38';c.beginPath();c.arc(hx+f*size*.06,hy-size*.02,4.5,0,Math.PI*2);c.fill();
  const line=(ex:number,ey:number,sag:number)=>{c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=1.1;c.beginPath();c.moveTo(tx,ty);c.quadraticCurveTo((tx+ex)/2,Math.max(ty,ey)+sag,ex,ey);c.stroke();};
  if(pose.phase==='idle'){line(tx,ty+size*.35,0);c.fillStyle='#e8433a';c.beginPath();c.arc(tx,ty+size*.35,3.5,0,Math.PI*2);c.fill();}
  else if(pose.phase==='waiting'||pose.phase==='bite'){
   const bite=pose.phase==='bite',dip=bite?Math.max(0,Math.sin(age/90))*7:Math.sin(now/600)*1.5,bx=spot.bobX,by=spot.bobY+dip;
   line(bx,by-4,bite?4:26);
   if(bite)for(let i=0;i<3;i++){const k=((age/700)+i/3)%1;c.strokeStyle=`rgba(255,255,255,${.7*(1-k)})`;c.lineWidth=1.5;c.beginPath();c.ellipse(spot.bobX,spot.bobY+2,6+k*26,2+k*7,0,0,Math.PI*2);c.stroke();}
   else{c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=1;c.beginPath();c.ellipse(spot.bobX,spot.bobY+2,9,3,0,0,Math.PI*2);c.stroke();}
   c.fillStyle='#fff';c.beginPath();c.arc(bx,by-3,4.2,Math.PI,0);c.fill();c.fillStyle='#e8433a';c.beginPath();c.arc(bx,by-3,4.2,0,Math.PI);c.fill();
   if(bite){c.font='900 30px Nunito, sans-serif';c.textAlign='center';c.lineWidth=5;c.strokeStyle='#5a1a00';const jump=Math.abs(Math.sin(age/120))*6;c.strokeText('!',x,y-size*1.35-jump);c.fillStyle='#ffd23a';c.fillText('!',x,y-size*1.35-jump);}
  }
  else if(pose.success&&pose.fish){
   // The catch flies out of the water to the rod tip, then dangles there.
   const k=Math.min(1,age/600),ease=1-(1-k)**2,len=pose.fish==='pirarucu-ancestral'||pose.fish==='carpa-dragao'?54:40;
   const fx=spot.bobX+(tx-spot.bobX)*ease,fy=spot.bobY+(ty+len*.7-spot.bobY)*ease-Math.sin(k*Math.PI)*90;
   if(k<1){c.strokeStyle='rgba(255,255,255,.8)';c.lineWidth=2;for(let i=0;i<5;i++){const d=age/14;c.beginPath();c.arc(spot.bobX+(i-2)*7,spot.bobY-d*(.4+i%2*.3)+(d*d)/60,2.2,0,Math.PI*2);c.stroke();}}
   line(fx,fy-len*.35,0);
   drawFish(c,pose.fish,fx,fy,len,-Math.PI/2+Math.sin(now/180)*.35);
   if(k>=1){c.globalCompositeOperation='lighter';for(let i=0;i<6;i++){const s=(now/300+i)%6;c.fillStyle=`rgba(255,240,170,${.8-s/7})`;c.beginPath();c.arc(fx+Math.cos(i*1.05+now/500)*len*.7,fy+Math.sin(i*1.05+now/500)*len*.5,2,0,Math.PI*2);c.fill();}c.globalCompositeOperation='source-over';}
  }
  else{
   // Lost it: the line hangs slack and a fish jumps away from the float.
   line(tx+f*10,ty+size*.45,0);
   const k=Math.min(1,age/900);if(k<1&&pose.fish){const fx=spot.bobX+f*k*70,fy=spot.bobY-Math.sin(k*Math.PI)*45;drawFish(c,pose.fish,fx,fy,30,f>0?-.6+k*1.2:Math.PI+.6-k*1.2,1-k*.5);}
   const s=Math.min(1,age/600);c.strokeStyle=`rgba(255,255,255,${.8*(1-s)})`;c.lineWidth=2;c.beginPath();c.ellipse(spot.bobX,spot.bobY+2,8+s*30,3+s*8,0,0,Math.PI*2);c.stroke();
  }
  c.restore();
 }
}

/** Stand-in Casa de Pesca: a log cabin with a red roof, a fish sign, nets and barrels. */
function house(c:CanvasRenderingContext2D,x:number,y:number,t:number){
 const w=330,h=170,top=y-h;c.save();c.lineJoin='round';c.strokeStyle='#3a2410';c.lineWidth=3;
 // Porch deck.
 c.fillStyle='#8f5e32';c.fillRect(x-w/2-30,y-18,w+60,18);c.strokeRect(x-w/2-30,y-18,w+60,18);
 // Log walls.
 for(let i=0;i<8;i++){const ly=top+i*(h-18)/8,g=c.createLinearGradient(0,ly,0,ly+(h-18)/8);g.addColorStop(0,'#c58a4e');g.addColorStop(1,'#8a5629');c.fillStyle=g;c.fillRect(x-w/2,ly,w,(h-18)/8+1);c.strokeStyle='rgba(58,36,16,.7)';c.lineWidth=1.5;c.beginPath();c.moveTo(x-w/2,ly);c.lineTo(x+w/2,ly);c.stroke();}
 c.strokeStyle='#3a2410';c.lineWidth=3;c.strokeRect(x-w/2,top,w,h-18);
 // Roof.
 const roof=c.createLinearGradient(0,top-120,0,top+10);roof.addColorStop(0,'#e0563a');roof.addColorStop(1,'#9c2a1c');c.fillStyle=roof;
 c.beginPath();c.moveTo(x-w/2-40,top+12);c.lineTo(x,top-120);c.lineTo(x+w/2+40,top+12);c.closePath();c.fill();c.stroke();
 c.strokeStyle='rgba(90,20,10,.5)';c.lineWidth=1.5;for(let i=1;i<6;i++){const k=i/6;c.beginPath();c.moveTo(x-(w/2+40)*k,top-120+132*k);c.lineTo(x+(w/2+40)*k,top-120+132*k);c.stroke();}
 // Door, windows, the fish sign and a net.
 c.fillStyle='#5a3418';c.strokeStyle='#2a160a';c.lineWidth=3;c.beginPath();c.roundRect(x-26,y-18-92,52,92,[22,22,0,0]);c.fill();c.stroke();
 c.fillStyle='#ffd27a';c.beginPath();c.arc(x+16,y-60,4,0,Math.PI*2);c.fill();
 for(const wx of [x-110,x+110]){const g=c.createLinearGradient(0,top+40,0,top+90);g.addColorStop(0,'#fff3b0');g.addColorStop(1,'#f0a640');c.fillStyle=g;c.fillRect(wx-28,top+40,56,48);c.strokeRect(wx-28,top+40,56,48);c.beginPath();c.moveTo(wx,top+40);c.lineTo(wx,top+88);c.moveTo(wx-28,top+64);c.lineTo(wx+28,top+64);c.stroke();}
 drawFish(c,'tucunare-brasa',x,top-50,70,Math.sin(t/900)*.06);
 c.strokeStyle='rgba(240,230,200,.8)';c.lineWidth=1;for(let i=0;i<7;i++){c.beginPath();c.moveTo(x+w/2+4,top+20+i*12);c.lineTo(x+w/2+40,top+30+i*12);c.stroke();c.beginPath();c.moveTo(x+w/2+4+i*5,top+20);c.lineTo(x+w/2+8+i*5,top+104);c.stroke();}
 for(const bx of [x-w/2-6,x-w/2+34]){const g=c.createLinearGradient(bx-18,0,bx+18,0);g.addColorStop(0,'#7a4a24');g.addColorStop(.5,'#b47a40');g.addColorStop(1,'#7a4a24');c.fillStyle=g;c.strokeStyle='#3a2410';c.lineWidth=2.5;c.beginPath();c.roundRect(bx-18,y-62,36,46,6);c.fill();c.stroke();c.strokeStyle='#4a4a58';c.beginPath();c.moveTo(bx-18,y-50);c.lineTo(bx+18,y-50);c.moveTo(bx-18,y-28);c.lineTo(bx+18,y-28);c.stroke();}
 c.restore();
}
/** Stand-in gate back to Praça Celeste: a wooden arch with a lantern. */
function gate(c:CanvasRenderingContext2D,x:number,y:number){
 c.save();c.lineJoin='round';c.strokeStyle='#3a2410';c.lineWidth=3;
 for(const px of [x-70,x+70]){const g=c.createLinearGradient(px-12,0,px+12,0);g.addColorStop(0,'#7a4a24');g.addColorStop(.5,'#c08a50');g.addColorStop(1,'#7a4a24');c.fillStyle=g;c.fillRect(px-12,y-200,24,200);c.strokeRect(px-12,y-200,24,200);}
 c.fillStyle='#9a6838';c.beginPath();c.moveTo(x-100,y-196);c.quadraticCurveTo(x,y-250,x+100,y-196);c.lineTo(x+100,y-176);c.quadraticCurveTo(x,y-226,x-100,y-176);c.closePath();c.fill();c.stroke();
 c.fillStyle='#ffe08a';c.beginPath();c.arc(x,y-150,10,0,Math.PI*2);c.fill();c.strokeStyle='#5a3418';c.stroke();
 c.restore();
}
