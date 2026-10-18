/**
 * Praça Celeste: the social lobby. The world is LOBBY_WIDTH wide (three
 * screens) and the camera follows the player sideways.
 *
 * Painted art (preferred): parallax depth layers built by `npm run build:lobby`
 * (sky, far islands, castle city, balustrade; airship and balloons float on top),
 * the floor texture `floor.webp`, plus one folder of cut-out layers per station.
 * The parallax layers are the only backdrop. No flat panorama or procedural
 * plaza is allocated or loaded while those assets are arriving.
 */
import {LOBBY_WIDTH,LOBBY_WALK,onLobbyLayout} from '../../shared/lobby';
import {LOBBY_PARALLAX,LOBBY_FLOATERS} from '../../shared/generated/lobbyParallax';
import type {LobbyParallaxLayer,LobbyFloater} from '../../shared/generated/lobbyParallax';
import type {LobbyStationSpot} from '../../shared/lobby';
export {LOBBY_WIDTH,LOBBY_WALK};
export const LOBBY_W=1536,LOBBY_H=864;

export type LobbyAction='arena'|'practice'|'shop'|'storage'|'forge';
type Theme={glow:string;core:string;metal:[string,string,string];rune:string};
type Portal={x:number;y:number;scale:number;theme:Theme;wings?:boolean};

const BLUE:Theme={glow:'#2fb6ff',core:'#d9f6ff',metal:['#f3fbff','#8fc4ef','#3d5fa8'],rune:'#7fe2ff'};
const GOLD:Theme={glow:'#ffb11f',core:'#fff3c0',metal:['#fff1a6','#f2b73a','#a8641c'],rune:'#ffd34d'};
const SILVER:Theme={glow:'#9fd8ff',core:'#f4fbff',metal:['#ffffff','#c9d3e6','#6f7d9a'],rune:'#cfe9ff'};
const BRONZE:Theme={glow:'#ff8a3d',core:'#ffe0c2',metal:['#ffd9a8','#d08a4a','#7a4220'],rune:'#ffb27a'};

/**
 * Stations on the plaza. Each one is a folder in /assets/lobby/<dir>/ of layers
 * exported on the SAME transparent canvas (feet at the bottom centre), like PSD
 * layers, drawn in order. Keepers and animals are whole figures that only
 * breathe (moving limbs looked broken, 17/10); props may sway, bob or pulse around their pivot (fractions of the canvas). A missing layer is
 * skipped; with no layer at all the single `<dir>.png` is drawn breathing.
 * Every station casts a shadow of its own outline onto the floor.
 *
 * Podiums carry `rank` and `stand`, the point on the canvas where the ranked
 * player's feet go (see LobbyWorld.podiums()).
 */
type Motion='still'|'breathe'|'sway'|'bob'|'pulse';
type Layer={name:string;motion:Motion;pivot?:[number,number];period?:number;amount?:number;phase?:number};
type Fallback={kind:'podium'|'gate';portal:Portal}|{kind:'keeper';hat:string;facing:1|-1};
export type Station={id:string;title:string;dir:string;x:number;y:number;height:number;layers:Layer[];action?:LobbyAction;rank?:1|2|3;stand?:[number,number];glow?:Portal;shadows?:Shadow[];noCast?:boolean;fallback:Fallback};
/**
 * Contact shadow where a station touches the floor: centre x/y, radius x/y, as fractions of the canvas, and an optional darkness (1 = default).
 * Round, squat pieces (podiums, the arena platform) set `noCast`: a sheared outline of a
 * cylinder trails off as a band, so they only get a contact shadow hugging the base.
 */
type Shadow=[number,number,number,number,number?];
// Pivots were measured on Codex's layers (17/10): canvases are
// 1400×1200 for keepers and 1200×1400 for the gate and podiums.
/** Podiums sit a little smaller than the other stations so the ranked players stand out. */
const PODIUM_HEIGHT=255;
export const LOBBY_STATIONS:Station[]=[
 {id:'shop',title:'Ateliê',dir:'npc-loja',x:560,y:626,height:300,action:'shop',shadows:[[.5,.95,.5,.05],[.51,.99,.09,.02]],fallback:{kind:'keeper',hat:'hat-tide',facing:1},layers:[
  {name:'barraca',motion:'still'},{name:'npc',motion:'breathe'}]},
 {id:'storage',title:'Guarda-volumes',dir:'npc-armazem',x:1220,y:628,height:240,action:'storage',shadows:[[.31,.99,.21,.03],[.73,.99,.12,.025]],fallback:{kind:'keeper',hat:'hat-cap',facing:1},layers:[
  {name:'burro',motion:'breathe',period:3400},{name:'npc',motion:'breathe'}]},
 // All podium canvases share one scale, so they share one height; `stand` is the centre of each top.
 ...([[2,2040,616,[.5,.66],SILVER],[1,2304,608,[.5,.49],GOLD],[3,2568,620,[.5,.75],BRONZE]] as const).map(([rank,x,y,stand,theme]):Station=>({
  id:`podium-${rank}`,title:`${rank}º lugar`,dir:`podio-${rank}`,x,y,height:PODIUM_HEIGHT,rank,noCast:true,shadows:[[.5,.97,.5,.07,1.5],[.34,.95,.44,.07,1.1]],stand:[stand[0],stand[1]],glow:{x,y:y-PODIUM_HEIGHT*(1-stand[1])+40,scale:.8,theme},
  fallback:{kind:'podium',portal:{x,y,scale:1,theme}},layers:[{name:'base',motion:'still'},{name:'brilho',motion:'pulse'}]})),
 {id:'arena',title:'Arena PvP',dir:'portal-arena',x:2980,y:618,height:360,action:'arena',noCast:true,shadows:[[.5,.97,.52,.075,1.5],[.34,.95,.48,.075,1.1]],glow:{x:2980,y:600,scale:1.1,theme:BLUE},fallback:{kind:'gate',portal:{x:2980,y:600,scale:1.1,theme:BLUE,wings:true}},layers:[
  {name:'base',motion:'still'},{name:'asas',motion:'sway',pivot:[.5,.45],period:1700,amount:.03},{name:'calice',motion:'bob',period:2400,amount:8}]},
 {id:'forge',title:'Ferreiro',dir:'npc-ferreiro',x:3720,y:632,height:300,action:'forge',shadows:[[.5,.95,.5,.05],[.48,.99,.15,.025]],fallback:{kind:'keeper',hat:'hat-cap',facing:-1},layers:[
  {name:'barraca',motion:'still'},
  {name:'npc',motion:'breathe'}]},
];

/** Spots as shipped; a layout published in the admin panel moves stations from these (podium glows follow). */
export const LOBBY_STATION_DEFAULTS:readonly LobbyStationSpot[]=LOBBY_STATIONS.map(({id,x,y,height})=>({id,x,y,height}));
const glowDefaults=new Map(LOBBY_STATIONS.map(s=>[s.id,s.glow?{...s.glow}:undefined]));
export function placeStations(spots:readonly LobbyStationSpot[]){
 for(const station of LOBBY_STATIONS){
  const spot=spots.find(s=>s.id===station.id)??LOBBY_STATION_DEFAULTS.find(s=>s.id===station.id)!,home=LOBBY_STATION_DEFAULTS.find(s=>s.id===station.id)!,glow=glowDefaults.get(station.id);
  station.x=spot.x;station.y=spot.y;station.height=spot.height;
  if(glow&&station.glow){station.glow.x=glow.x+spot.x-home.x;station.glow.y=station.rank&&station.stand?spot.y-spot.height*(1-station.stand[1])+40:glow.y+spot.y-home.y;}
  if(station.fallback.kind!=='keeper'){station.fallback.portal.x=spot.x;station.fallback.portal.y=station.fallback.kind==='gate'?spot.y-18:spot.y;}
 }
}
onLobbyLayout(layout=>placeStations(layout.stations));

/** Where the painted floor starts under the balustrade's curb; floor tile width, its depth at the bottom (fraction of width) and at the far edge (fraction of that). */
const FLOOR_TOP=548,FLOOR_TILE=620,FLOOR_NEAR=.6,FLOOR_FAR=.28;
/** Cast shadows lie on the floor squashed to this height and lean left by CAST_LEAN per unit of height. */
const CAST_SQUASH=.22,CAST_LEAN=.55,CAST_PAD=.06;
/** Soft oval shadow on the plaza floor, darkest under the middle. */
function groundShadow(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,dark=1){
 c.save();c.translate(x,y);c.scale(1,ry/rx);
 const a=(k:number)=>`rgba(55,36,18,${Math.min(1,k*dark)})`;
 const g=c.createRadialGradient(0,0,0,0,0,rx);g.addColorStop(0,a(.55));g.addColorStop(.6,a(.34));g.addColorStop(1,a(0));
 c.fillStyle=g;c.beginPath();c.arc(0,0,rx,0,Math.PI*2);c.fill();c.restore();
}

export interface LobbySprite {y:number;draw:(c:CanvasRenderingContext2D)=>void;}

/** Small deterministic generator, so the static plaza never shimmers between reloads. */
function random(seed:number){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const INK='#2b3550';

/** Union of circles with one shared outline, the chibi way of drawing clouds and foliage. */
function puff(c:CanvasRenderingContext2D,circles:[number,number,number][],fill:string|CanvasGradient,outline=INK,width=3){
 c.save();c.strokeStyle=outline;c.lineWidth=width*2;c.lineJoin='round';
 for(const [x,y,r] of circles){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();}
 c.fillStyle=fill;for(const [x,y,r] of circles){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}c.restore();
}
function path(c:CanvasRenderingContext2D,points:[number,number][]){c.beginPath();c.moveTo(points[0][0],points[0][1]);for(const [x,y] of points.slice(1))c.lineTo(x,y);c.closePath();}
function vgrad(c:CanvasRenderingContext2D,y0:number,y1:number,stops:string[]){const g=c.createLinearGradient(0,y0,0,y1);stops.forEach((s,i)=>g.addColorStop(i/(stops.length-1),s));return g;}
function roundRect(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){c.beginPath();c.roundRect(x,y,w,h,r);}

function portal(c:CanvasRenderingContext2D,p:Portal,t:number,hover:boolean){
 const {x,y,scale:s,theme}=p,bob=Math.sin(t/700+x)*5,glowBoost=hover?1.35:1;c.save();
 // Platform.
 c.strokeStyle=INK;c.lineWidth=2.5;c.fillStyle='#a9a4b3';c.beginPath();c.ellipse(x,y,82*s,24*s,0,0,Math.PI);c.lineTo(x-82*s,y-12*s);c.ellipse(x,y-12*s,82*s,24*s,0,Math.PI,0,true);c.closePath();c.fill();c.stroke();
 c.fillStyle=vgrad(c,y-36*s,y+12*s,['#ffffff','#d9d4e2']);c.beginPath();c.ellipse(x,y-12*s,82*s,24*s,0,0,Math.PI*2);c.fill();c.stroke();
 c.fillStyle=theme.metal[1];c.beginPath();c.ellipse(x,y-12*s,64*s,18*s,0,0,Math.PI*2);c.fill();c.stroke();
 const pool=c.createRadialGradient(x,y-12*s,4,x,y-12*s,58*s);pool.addColorStop(0,theme.core);pool.addColorStop(.6,theme.glow);pool.addColorStop(1,theme.glow+'00');c.fillStyle=pool;c.beginPath();c.ellipse(x,y-12*s,56*s,15*s,0,0,Math.PI*2);c.fill();
 c.strokeStyle=theme.rune;c.lineWidth=2.5;c.setLineDash([10,7]);c.lineDashOffset=-t/40;c.beginPath();c.ellipse(x,y-12*s,46*s,12*s,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
 // Beam of light.
 c.globalCompositeOperation='lighter';const flick=.75+Math.sin(t/180+x)*.12;
 const beam=c.createLinearGradient(0,y-150*s,0,y-12*s);beam.addColorStop(0,theme.glow+'00');beam.addColorStop(.5,theme.glow+'88');beam.addColorStop(1,theme.core+'cc');
 c.globalAlpha=flick*glowBoost*.85;c.fillStyle=beam;path(c,[[x-18*s,y-150*s+bob],[x+18*s,y-150*s+bob],[x+44*s,y-12*s],[x-44*s,y-12*s]]);c.fill();
 c.globalAlpha=1;for(let i=0;i<7;i++){const k=(t/1600+i/7+x*.01)%1,px=x+Math.sin(i*2.3+t/500)*30*s*(1-k);c.fillStyle=theme.core;c.globalAlpha=(1-k)*.9;c.beginPath();c.arc(px,y-14*s-k*150*s,(2.6-k)*s+1,0,Math.PI*2);c.fill();}
 c.globalAlpha=1;c.globalCompositeOperation='source-over';
 // Floating chalice: crystal point below, glowing bowl on top, wings on the arena gate.
 const cy=y-158*s+bob;c.strokeStyle=INK;c.lineWidth=2.5;
 c.fillStyle=vgrad(c,cy,cy+64*s,[theme.core,theme.glow]);path(c,[[x-20*s,cy+10*s],[x+20*s,cy+10*s],[x,cy+66*s]]);c.fill();c.stroke();
 c.fillStyle='#ffffff99';path(c,[[x-12*s,cy+12*s],[x-2*s,cy+12*s],[x-1*s,cy+52*s]]);c.fill();
 if(p.wings){for(const side of [-1,1]){c.fillStyle=vgrad(c,cy-40*s,cy+20*s,[theme.metal[0],theme.metal[1]]);c.beginPath();c.moveTo(x+side*40*s,cy+4*s);c.quadraticCurveTo(x+side*86*s,cy-6*s,x+side*94*s,cy-46*s);c.quadraticCurveTo(x+side*76*s,cy-26*s,x+side*70*s,cy-34*s);c.quadraticCurveTo(x+side*62*s,cy-14*s,x+side*50*s,cy-20*s);c.quadraticCurveTo(x+side*52*s,cy-6*s,x+side*36*s,cy-8*s);c.closePath();c.fill();c.stroke();}}
 const bowl=c.createLinearGradient(x-56*s,0,x+56*s,0);bowl.addColorStop(0,theme.metal[2]);bowl.addColorStop(.35,theme.metal[0]);bowl.addColorStop(.7,theme.metal[1]);bowl.addColorStop(1,theme.metal[2]);
 c.fillStyle=bowl;c.beginPath();c.moveTo(x-56*s,cy-8*s);c.quadraticCurveTo(x-50*s,cy+20*s,x,cy+20*s);c.quadraticCurveTo(x+50*s,cy+20*s,x+56*s,cy-8*s);c.closePath();c.fill();c.stroke();
 c.fillStyle=theme.metal[1];c.beginPath();c.ellipse(x,cy-8*s,58*s,13*s,0,0,Math.PI*2);c.fill();c.stroke();
 const surface=c.createRadialGradient(x,cy-8*s,2,x,cy-8*s,50*s);surface.addColorStop(0,'#ffffff');surface.addColorStop(.4,theme.core);surface.addColorStop(1,theme.glow);c.fillStyle=surface;c.beginPath();c.ellipse(x,cy-8*s,48*s,9*s,0,0,Math.PI*2);c.fill();
 c.save();c.globalCompositeOperation='lighter';c.strokeStyle=theme.core;c.lineWidth=2;c.globalAlpha=.8;c.beginPath();c.ellipse(x,cy-8*s,30*s,5*s,0,t/500,t/500+Math.PI*1.2);c.stroke();
 const halo=c.createRadialGradient(x,cy-8*s,4,x,cy-8*s,90*s*glowBoost);halo.addColorStop(0,theme.glow+'66');halo.addColorStop(1,theme.glow+'00');c.fillStyle=halo;c.globalAlpha=1;c.beginPath();c.arc(x,cy-8*s,90*s*glowBoost,0,Math.PI*2);c.fill();c.restore();
 for(const gx of [-30,0,30]){c.fillStyle=gx?theme.rune:'#ffffff';c.strokeStyle=INK;c.lineWidth=1.5;c.beginPath();c.moveTo(x+gx*s,cy+8*s);c.lineTo(x+gx*s+4*s,cy+13*s);c.lineTo(x+gx*s,cy+18*s);c.lineTo(x+gx*s-4*s,cy+13*s);c.closePath();c.fill();c.stroke();}
 c.restore();
}
/** Light only, laid over a painted portal: pulse, rising sparks and hover halo. */
function portalLight(c:CanvasRenderingContext2D,p:Portal,t:number,hover:boolean,halo=true){
 const {x,y,scale:s,theme}=p;c.save();c.globalCompositeOperation='lighter';
 if(halo){const pulse=.55+Math.sin(t/420+x)*.2+(hover?.35:0),glow=c.createRadialGradient(x,y-70*s,4,x,y-70*s,110*s);
  glow.addColorStop(0,theme.glow+'55');glow.addColorStop(1,theme.glow+'00');c.globalAlpha=pulse;c.fillStyle=glow;c.beginPath();c.arc(x,y-70*s,110*s,0,Math.PI*2);c.fill();}
 for(let i=0;i<9;i++){const k=(t/1700+i/9+x*.01)%1,px=x+Math.sin(i*2.3+t/500)*34*s*(1-k);c.fillStyle=theme.core;c.globalAlpha=(1-k)*.85;c.beginPath();c.arc(px,y-14*s-k*170*s,(2.4-k)*s+1,0,Math.PI*2);c.fill();}
 c.restore();
}
function storageProps(c:CanvasRenderingContext2D){
 c.save();c.strokeStyle=INK;c.lineWidth=2.5;
 const crate=(x:number,y:number,w:number,h:number)=>{c.fillStyle=vgrad(c,y-h,y,['#d79a5e','#a8693c']);c.fillRect(x,y-h,w,h);c.strokeRect(x,y-h,w,h);c.strokeStyle='#6d4228';c.lineWidth=2;c.beginPath();c.moveTo(x+4,y-h+4);c.lineTo(x+w-4,y-4);c.moveTo(x+w-4,y-h+4);c.lineTo(x+4,y-4);c.stroke();c.strokeStyle=INK;c.lineWidth=2.5;};
 crate(1012,572,58,52);crate(1020,520,44,40);crate(1064,574,40,36);
 // Treasure chest beside the keeper.
 c.fillStyle=vgrad(c,520,590,['#7b4bd1','#4a2c8f']);roundRect(c,1150,548,70,42,6);c.fill();c.stroke();
 c.beginPath();c.moveTo(1150,552);c.quadraticCurveTo(1185,512,1220,552);c.closePath();c.fill();c.stroke();
 c.fillStyle='#f2c34a';c.fillRect(1180,524,10,66);c.strokeRect(1180,524,10,66);roundRect(c,1176,550,18,16,4);c.fill();c.stroke();
 c.fillStyle='#d9b06b';c.beginPath();c.ellipse(1236,584,18,14,0,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#a87b3c';c.fillRect(1230,566,12,6);
 c.restore();
}
function forgeProps(c:CanvasRenderingContext2D,t:number){
 c.save();c.strokeStyle=INK;c.lineWidth=2.5;
 // Brazier.
 c.fillStyle='#3d3f55';path(c,[[1420,556],[1468,556],[1460,600],[1428,600]]);c.fill();c.stroke();c.fillStyle='#55576f';c.fillRect(1414,548,60,10);c.strokeRect(1414,548,60,10);
 for(let i=0;i<4;i++){const h=24+Math.sin(t/120+i*1.7)*8,fx=1426+i*12;const g=c.createLinearGradient(0,548-h,0,548);g.addColorStop(0,'#fff3a0');g.addColorStop(.5,'#ffa733');g.addColorStop(1,'#ff4d2e');c.fillStyle=g;c.beginPath();c.moveTo(fx-8,548);c.quadraticCurveTo(fx-6,548-h*.6,fx,548-h);c.quadraticCurveTo(fx+6,548-h*.6,fx+8,548);c.fill();}
 // Stump and anvil.
 c.fillStyle=vgrad(c,580,640,['#a8693c','#7a4a2a']);c.beginPath();c.ellipse(1392,636,36,10,0,0,Math.PI);c.lineTo(1356,604);c.ellipse(1392,604,36,10,0,Math.PI,0,true);c.closePath();c.fill();c.stroke();
 c.fillStyle='#d9a066';c.beginPath();c.ellipse(1392,604,36,10,0,0,Math.PI*2);c.fill();c.stroke();
 c.fillStyle=vgrad(c,560,600,['#7e86a6','#3e4560']);path(c,[[1350,570],[1426,570],[1446,560],[1430,582],[1412,584],[1408,598],[1376,598],[1372,584],[1356,582]]);c.fill();c.stroke();
 c.fillStyle='#b9c2df';c.fillRect(1356,571,68,4);
 const heat=.7+Math.sin(t/260)*.3;c.fillStyle=`rgba(255,${150+heat*70|0},60,1)`;roundRect(c,1372,562,30,8,3);c.fill();c.stroke();
 for(let i=0;i<6;i++){const k=(t/500+i/6)%1;c.fillStyle='#ffd25a';c.globalAlpha=1-k;c.beginPath();c.arc(1387+Math.cos(i*2.1)*k*40,562-k*34+k*k*18,2,0,Math.PI*2);c.fill();}
 c.restore();
}

export interface LobbyKeeper {id:string;x:number;y:number;hat:string;facing:1|-1;}
export interface LobbyPodium {rank:1|2|3;x:number;y:number;}

export class LobbyWorld {
 private art=new Map<string,HTMLImageElement>();private layers=new Map<string,HTMLImageElement>();private casts=new Map<string,HTMLCanvasElement>();
 private floor=new Image();private floorCanvas:HTMLCanvasElement|null=null;
 private depth:{factor:number;layer?:LobbyParallaxLayer;floater?:LobbyFloater;image:HTMLImageElement}[];
 /** Podium ranks with a player standing on them: their ring and halo are left out, so nothing glows behind the figure. */
 occupied=new Set<number>();
 constructor(_density=2){
  // Depth layers and floaters, back to front by how fast they follow the camera.
  const entries:{factor:number;layer?:LobbyParallaxLayer;floater?:LobbyFloater;file:string}[]=[...LOBBY_PARALLAX.map(layer=>({factor:layer.factor,layer,file:layer.file})),...LOBBY_FLOATERS.map(floater=>({factor:floater.factor,floater,file:floater.file}))];
  this.depth=entries.sort((a,b)=>a.factor-b.factor).map(({file,...entry})=>{const image=new Image();image.src=file;return {...entry,image};});
  // Optional floor texture laid over the painted floor; see docs/lobby-art-prompts.md.
  this.floor.src='/assets/lobby/floor.webp';
  for(const station of LOBBY_STATIONS){
   const image=new Image();image.src=`/assets/lobby/${station.dir}.png`;this.art.set(station.id,image);
   for(const layer of station.layers){const part=new Image();part.src=`/assets/lobby/${station.dir}/${layer.name}.png`;this.layers.set(`${station.dir}/${layer.name}`,part);}
  }
 }
 private loaded(station:Station){return station.layers.map(layer=>({layer,image:this.layers.get(`${station.dir}/${layer.name}`)!})).filter(({image})=>image.complete&&image.naturalWidth>0);}
 private hasArt(station:Station){const single=this.art.get(station.id)!;return this.loaded(station).length>0||(single.complete&&single.naturalWidth>0);}
 /** True once every depth layer has loaded, so the backdrop never pops in piece by piece. */
 private deep(){return this.depth.length>0&&this.depth.every(d=>d.image.complete&&d.image.naturalWidth>0);}
 /**
  * The depth layers as seen with the camera at `cam`, clipped to world columns x0..x1:
  * a layer with factor f is drawn from world x cam·(1-f), so it slides f px per camera px.
  */
 private drawDepth(c:CanvasRenderingContext2D,t:number,cam:number,x0:number,x1:number){
  for(const {factor,layer,floater,image} of this.depth){
   const left=cam*(1-factor);
   if(layer){const k=image.naturalWidth/layer.width,from=Math.max(0,x0-left),to=Math.min(layer.width,x1-left);if(to>from)c.drawImage(image,from*k,0,(to-from)*k,image.naturalHeight,left+from,layer.y,to-from,layer.height);continue;}
   const f=floater!,phase=t/f.period*Math.PI*2+f.x*.01,x=left+f.x+Math.sin(phase*.5)*f.drift-f.w/2,y=f.y+Math.sin(phase)*f.bob-f.h/2;
   if(x<x1&&x+f.w>x0)c.drawImage(image,x,y,f.w,f.h);
  }
 }
 /**
  * The whole plaza at once (admin editor): each spot shows the layers as a player
  * standing there sees them, so the slower layers are squeezed toward the middle.
  */
 drawWhole(c:CanvasRenderingContext2D,t:number){
  if(!this.deep()){for(let x=0;x<LOBBY_WIDTH;x+=LOBBY_W)this.drawBack(c,t,x);return;}
  const half=LOBBY_W/2,range=LOBBY_WIDTH-LOBBY_W,step=8;
  const local=(x:number,f:number)=>x-LobbyWorld.camera(x)*(1-f),world=(l:number,f:number)=>l<half?l:l>half+range*f?l+range*(1-f):(l-half*(1-f))/f;
  for(const {factor,layer,floater,image} of this.depth){
   if(floater){const f=floater,phase=t/f.period*Math.PI*2+f.x*.01,x=world(f.x+Math.sin(phase*.5)*f.drift,factor);c.drawImage(image,x-f.w/2,f.y+Math.sin(phase)*f.bob-f.h/2,f.w,f.h);continue;}
   const k=image.naturalWidth/layer!.width;
   for(let x=0;x<LOBBY_WIDTH;x+=step){const a=local(x,factor),b=local(x+step,factor);c.drawImage(image,a*k,0,(b-a)*k,image.naturalHeight,x,layer!.y,step+.5,layer!.height);}
  }
  this.drawFloor(c,0,LOBBY_WIDTH);
 }
 private drawFloor(c:CanvasRenderingContext2D,x0:number,w:number){
  const floor=this.floorBand();
  if(floor){const d=floor.width/LOBBY_WIDTH;c.drawImage(floor,x0*d,0,w*d,floor.height,x0,FLOOR_TOP,w,LOBBY_H-FLOOR_TOP);}
 }
 /**
  * The plaza floor across the whole width, built once from the tileable
  * top-down `floor.webp`: rows get shallower toward the balustrade so the
  * stones recede, and the far edge gets a curb shadow and a light haze. Widths
  * stay constant: the camera pans sideways, so there is no single vanishing
  * point to converge on.
  */
 private floorBand(){
  if(this.floorCanvas)return this.floorCanvas;
  if(!this.floor.complete||!this.floor.naturalWidth)return null;
  const d=2,W=LOBBY_WIDTH*d,H=(LOBBY_H-FLOOR_TOP)*d,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const c=canvas.getContext('2d')!,pattern=c.createPattern(this.floor,'repeat')!,tex=this.floor.naturalWidth;
  // Tile depth on screen grows linearly from the far edge to the bottom, as on a floor seen at an angle.
  const across=FLOOR_TILE*d/tex,near=FLOOR_TILE*d*FLOOR_NEAR,far=near*FLOOR_FAR,grow=(near-far)/H;
  let v=0;
  for(let y=0;y<H;y++){
   const deep=(far+grow*y)/tex;
   pattern.setTransform(new DOMMatrix([across,0,0,deep,0,y-v*deep]));
   c.fillStyle=pattern;c.fillRect(0,y,W,1);
   v+=1/deep;
  }
  const curb=c.createLinearGradient(0,0,0,26*d);curb.addColorStop(0,'rgba(60,40,20,.35)');curb.addColorStop(1,'rgba(60,40,20,0)');c.fillStyle=curb;c.fillRect(0,0,W,26*d);
  const haze=c.createLinearGradient(0,0,0,H*.5);haze.addColorStop(0,'rgba(255,248,225,.28)');haze.addColorStop(1,'rgba(255,248,225,0)');c.fillStyle=haze;c.fillRect(0,0,W,H*.5);
  this.floorCanvas=canvas;return canvas;
 }
 /** Camera x that keeps `focusX` centred without showing past the plaza's ends. */
 static camera(focusX:number){return Math.max(0,Math.min(LOBBY_WIDTH-LOBBY_W,focusX-LOBBY_W/2));}
 /** Draws the backdrop in world coordinates; the caller has already translated by -camX. */
 drawBack(c:CanvasRenderingContext2D,t:number,camX:number){
  if(!this.deep()){c.fillStyle='#9ed4e8';c.fillRect(camX,0,LOBBY_W,LOBBY_H);return;}
  this.drawDepth(c,t,camX,camX,camX+LOBBY_W);this.drawFloor(c,camX,LOBBY_W);
 }
 /** Stations that share the avatars' depth order. */
 sprites(t:number,hover:string|null):LobbySprite[]{
  return LOBBY_STATIONS.map(station=>({y:station.y-24,draw:(c:CanvasRenderingContext2D)=>this.station(c,station,t,hover===station.id)}));
 }
 /** Keepers to stand in as avatars while their painting is missing. */
 keepers():LobbyKeeper[]{
  return LOBBY_STATIONS.flatMap(station=>station.fallback.kind==='keeper'&&!this.hasArt(station)?[{id:`npc-${station.id}`,x:station.x,y:station.y,hat:station.fallback.hat,facing:station.fallback.facing}]:[]);
 }
 /** Where the day's top PvP players stand, in world coordinates. */
 podiums():LobbyPodium[]{
  return LOBBY_STATIONS.flatMap(station=>{
   if(!station.rank)return [];
   const image=this.loaded(station)[0]?.image;
   if(image&&station.stand)return [{rank:station.rank,x:station.x-station.height*image.naturalWidth/image.naturalHeight*(.5-station.stand[0]),y:station.y-station.height*(1-station.stand[1])}];
   const s=station.height/250;return [{rank:station.rank,x:station.x,y:station.y-166*s}];
  });
 }
 drawFront(c:CanvasRenderingContext2D,t:number,hover:string|null){
  title(c,'Ranking PvP do dia',2304,150,28);
  for(const station of LOBBY_STATIONS){
   const podium=station.rank?this.podiums().find(p=>p.rank===station.rank):undefined;
   // Plaques hold still above each station; podium plaques sit above where the ranked player stands.
   const top=podium?podium.y-(this.occupied.has(podium.rank)?262:190):station.fallback.kind==='keeper'&&!this.hasArt(station)?station.y-170:station.y-station.height-20;
   plaque(c,station.title,station.x,top,station.id==='arena'||station.rank===1,hover===station.id);
  }
 }
 /** Screen-space sparkle, drawn after the camera transform is undone. */
 drawOverlay(c:CanvasRenderingContext2D,t:number){
  for(let i=0;i<22;i++){const x=(i*137+t*.014)%LOBBY_W,y=140+(i*71)%560+Math.sin(t/1300+i)*15;c.fillStyle=`rgba(255,255,230,${.25+Math.sin(t/800+i)*.18})`;c.beginPath();c.arc(x,y,1.5+i%2,0,Math.PI*2);c.fill();}
 }
 /**
  * The station's outline as a blurred dark shape, built once its art has loaded.
  * Drawn squashed onto the floor and leaning left, away from the light.
  */
 private cast(station:Station,parts:{layer:Layer;image:HTMLImageElement}[]){
  if(this.casts.has(station.id))return this.casts.get(station.id)!;
  const solid=parts.filter(({layer})=>layer.motion==='still'||layer.motion==='breathe');
  if(!solid.length||solid.length<station.layers.filter(l=>l.motion==='still'||l.motion==='breathe').length)return null;
  const img=solid[0].image,k=.25,w=img.naturalWidth*k,h=img.naturalHeight*k,pw=w*CAST_PAD,ph=h*CAST_PAD;
  const shape=document.createElement('canvas');shape.width=w+2*pw;shape.height=h+2*ph;const s=shape.getContext('2d')!;
  for(const {image} of solid)s.drawImage(image,pw,ph,w,h);
  s.globalCompositeOperation='source-in';s.fillStyle='#3a2410';s.fillRect(0,0,shape.width,shape.height);
  const blurred=document.createElement('canvas');blurred.width=shape.width;blurred.height=shape.height;const b=blurred.getContext('2d')!;
  b.filter='blur(5px)';b.drawImage(shape,0,0);
  this.casts.set(station.id,blurred);return blurred;
 }
 private box(station:Station):[number,number,number,number]{
  const image=this.loaded(station)[0]?.image??this.art.get(station.id)!,ratio=image.naturalWidth?image.naturalWidth/image.naturalHeight:.8,half=station.height*ratio/2*.8;
  return [station.x-half,station.y-station.height,station.x+half,station.y+12];
 }
 private station(c:CanvasRenderingContext2D,station:Station,t:number,hover:boolean){
  const parts=this.loaded(station),single=this.art.get(station.id)!;
  const base=parts[0]?.image??(single.complete&&single.naturalWidth?single:null);
  if(!base){
   const fallback=station.fallback;
   // The props were drawn around the old keeper spots (storage 1112,582; smith 1316,596).
   if(station.id==='forge'){c.save();c.translate(station.x-1316,station.y-596);forgeProps(c,t);c.restore();}
   else if(station.id==='storage'){c.save();c.translate(station.x-1112,station.y-582);storageProps(c);c.restore();}
   else if(fallback.kind!=='keeper')portal(c,fallback.portal,t,hover);
   return;
  }
  const h=station.height,w=h*base.naturalWidth/base.naturalHeight,left=station.x-w/2,top=station.y-h;
  const breath=(period=3000)=>1+Math.sin(t/period*Math.PI*2)*.012;
  const cast=station.noCast?null:this.cast(station,parts);
  if(cast){c.save();c.translate(station.x,station.y);c.transform(1,0,CAST_LEAN,CAST_SQUASH,0,0);c.globalAlpha=.5;c.drawImage(cast,-w/2-CAST_PAD*w,-h-CAST_PAD*h,w*(1+2*CAST_PAD),h*(1+2*CAST_PAD));c.restore();}
  for(const [sx,sy,rx,ry,dark] of station.shadows??[])groundShadow(c,left+sx*w,top+sy*h,rx*w,ry*h,dark);
  c.save();if(hover)c.filter='brightness(1.12) drop-shadow(0 0 10px #fff2a0)';
  if(!parts.length){c.translate(station.x,station.y);c.scale(1,station.glow?1:breath());c.drawImage(base,-w/2,-h,w,h);}
  else for(const {layer,image} of parts){
   if(layer.motion==='pulse'&&station.rank&&this.occupied.has(station.rank))continue;
   const period=layer.period??3000,phase=(layer.phase??0)+station.x*3,amount=layer.amount,[px,py]=layer.pivot??[.5,1],ax=left+px*w,ay=top+py*h;
   c.save();
   if(layer.motion==='breathe'){c.translate(station.x,station.y);c.scale(1,breath(period));c.translate(-station.x,-station.y);}
   else if(layer.motion==='sway'){c.translate(ax,ay);c.rotate(Math.sin((t+phase)/period*Math.PI*2)*(amount??.1));c.translate(-ax,-ay);}
   else if(layer.motion==='bob')c.translate(0,Math.sin((t+phase)/period*Math.PI*2)*(amount??6));
   else if(layer.motion==='pulse'){c.globalCompositeOperation='lighter';c.globalAlpha=.55+Math.sin((t+phase)/700)*.35;}
   c.drawImage(image,left,top,w,h);c.restore();
  }
  c.restore();
  if(station.glow)portalLight(c,station.glow,t,hover,!(station.rank&&this.occupied.has(station.rank)));
 }
 /** World coordinates in, interactive station out (podiums are not interactive). */
 hit(x:number,y:number):LobbyAction|null{return this.hover(x,y)?.action??null;}
 hover(x:number,y:number):Station|null{
  for(const station of LOBBY_STATIONS){if(!station.action)continue;const [x0,y0,x1,y1]=this.box(station);if(x>=x0&&x<=x1&&y>=y0&&y<=y1)return station;}
  return null;
 }
}

const FONT='Nunito, "Trebuchet MS", sans-serif';
/** Polished gold lettering with a dark rim and a soft drop shadow. */
function goldText(c:CanvasRenderingContext2D,text:string,x:number,y:number,size:number,rim:string){
 c.save();c.font=`900 ${size}px ${FONT}`;c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
 c.shadowColor='rgba(20,10,0,.55)';c.shadowBlur=size*.35;c.shadowOffsetY=size*.1;
 c.lineWidth=size*.26;c.strokeStyle=rim;c.strokeText(text,x,y);c.shadowColor='transparent';
 const g=c.createLinearGradient(0,y-size*.5,0,y+size*.5);g.addColorStop(0,'#fffbe6');g.addColorStop(.45,'#ffe28a');g.addColorStop(.55,'#f5b93a');g.addColorStop(1,'#fff0b0');
 c.fillStyle=g;c.fillText(text,x,y);c.restore();
}
function title(c:CanvasRenderingContext2D,text:string,x:number,y:number,size:number){goldText(c,text,x,y,size,'#4a2408');}
/** Name plate over a station: deep blue enamel in a gold frame, with gem studs at the ends. */
function plaque(c:CanvasRenderingContext2D,text:string,x:number,y:number,big:boolean,hover:boolean){
 c.save();c.translate(x,y);const s=(big?1.1:.94)*(hover?1.06:1);c.scale(s,s);
 const size=18;c.font=`900 ${size}px ${FONT}`;const w=Math.max(96,c.measureText(text).width+46),h=32,r=9;
 c.shadowColor='rgba(15,20,40,.45)';c.shadowBlur=10;c.shadowOffsetY=4;
 const rim=c.createLinearGradient(0,-h/2-3,0,h/2+3);rim.addColorStop(0,'#fff3b8');rim.addColorStop(.5,'#e0a02c');rim.addColorStop(1,'#8a5414');
 c.fillStyle=rim;roundRect(c,-w/2-3,-h/2-3,w+6,h+6,r+3);c.fill();c.shadowColor='transparent';
 const face=c.createLinearGradient(0,-h/2,0,h/2);face.addColorStop(0,hover?'#3c5fa8':'#2c4a8c');face.addColorStop(1,hover?'#1d2f66':'#152350');
 c.fillStyle=face;roundRect(c,-w/2,-h/2,w,h,r);c.fill();
 c.save();roundRect(c,-w/2,-h/2,w,h,r);c.clip();const gloss=c.createLinearGradient(0,-h/2,0,0);gloss.addColorStop(0,'rgba(255,255,255,.28)');gloss.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gloss;c.fillRect(-w/2,-h/2,w,h/2);c.restore();
 c.strokeStyle='rgba(255,226,140,.55)';c.lineWidth=1;roundRect(c,-w/2+3,-h/2+3,w-6,h-6,r-3);c.stroke();
 for(const side of [-1,1]){const gx=side*(w/2+3);c.save();c.translate(gx,0);c.rotate(Math.PI/4);
  c.fillStyle=rim;c.fillRect(-7,-7,14,14);const gem=c.createLinearGradient(-5,-5,5,5);gem.addColorStop(0,'#bff1ff');gem.addColorStop(1,'#1f7fd6');c.fillStyle=gem;c.fillRect(-4.5,-4.5,9,9);c.restore();}
 if(hover){c.shadowColor='#ffe9a0';c.shadowBlur=12;}
 c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';c.lineWidth=4;c.strokeStyle='#0c1636';c.strokeText(text,0,1);
 const g=c.createLinearGradient(0,-size/2,0,size/2);g.addColorStop(0,'#ffffff');g.addColorStop(1,'#ffe39a');c.fillStyle=g;c.fillText(text,0,1);
 c.restore();
}
