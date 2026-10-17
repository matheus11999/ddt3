/**
 * Praça Celeste: the social lobby. The world is LOBBY_WIDTH wide (three
 * screens) and the camera follows the player sideways.
 *
 * Painted art (preferred): `/assets/lobby/plaza.webp`, one panorama of the empty
 * plaza (no NPCs, no podiums), plus one folder of cut-out layers per station.
 * Without the panorama, a procedural plaza tiles the width as a stand-in, and
 * stations without art fall back to procedural podiums or keeper avatars.
 */
import {LOBBY_WIDTH,LOBBY_WALK,onLobbyLayout} from '../../shared/lobby';
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
type Fallback={kind:'podium'|'gate';portal:Portal}|{kind:'keeper';outfit:'surfer'|'executive';hat:string;facing:1|-1};
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
 {id:'shop',title:'Ateliê',dir:'npc-loja',x:560,y:626,height:300,action:'shop',shadows:[[.5,.95,.5,.05],[.51,.99,.09,.02]],fallback:{kind:'keeper',outfit:'surfer',hat:'hat-tide',facing:1},layers:[
  {name:'barraca',motion:'still'},{name:'npc',motion:'breathe'}]},
 {id:'storage',title:'Guarda-volumes',dir:'npc-armazem',x:1220,y:628,height:240,action:'storage',shadows:[[.31,.99,.21,.03],[.73,.99,.12,.025]],fallback:{kind:'keeper',outfit:'surfer',hat:'hat-cap',facing:1},layers:[
  {name:'burro',motion:'breathe',period:3400},{name:'npc',motion:'breathe'}]},
 // All podium canvases share one scale, so they share one height; `stand` is the centre of each top.
 ...([[2,2040,616,[.5,.66],SILVER],[1,2304,608,[.5,.49],GOLD],[3,2568,620,[.5,.75],BRONZE]] as const).map(([rank,x,y,stand,theme]):Station=>({
  id:`podium-${rank}`,title:`${rank}º lugar`,dir:`podio-${rank}`,x,y,height:PODIUM_HEIGHT,rank,noCast:true,shadows:[[.5,.97,.5,.07,1.5],[.34,.95,.44,.07,1.1]],stand:[stand[0],stand[1]],glow:{x,y:y-PODIUM_HEIGHT*(1-stand[1])+40,scale:.8,theme},
  fallback:{kind:'podium',portal:{x,y,scale:1,theme}},layers:[{name:'base',motion:'still'},{name:'brilho',motion:'pulse'}]})),
 {id:'arena',title:'Arena PvP',dir:'portal-arena',x:2980,y:618,height:360,action:'arena',noCast:true,shadows:[[.5,.97,.52,.075,1.5],[.34,.95,.48,.075,1.1]],glow:{x:2980,y:600,scale:1.1,theme:BLUE},fallback:{kind:'gate',portal:{x:2980,y:600,scale:1.1,theme:BLUE,wings:true}},layers:[
  {name:'base',motion:'still'},{name:'asas',motion:'sway',pivot:[.5,.45],period:1700,amount:.03},{name:'calice',motion:'bob',period:2400,amount:8}]},
 {id:'forge',title:'Ferreiro',dir:'npc-ferreiro',x:3720,y:632,height:300,action:'forge',shadows:[[.5,.95,.5,.05],[.48,.99,.15,.025]],fallback:{kind:'keeper',outfit:'executive',hat:'hat-cap',facing:-1},layers:[
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

function cloud(c:CanvasRenderingContext2D,x:number,y:number,s:number,alpha=1){
 c.save();c.globalAlpha=alpha;const g=c.createLinearGradient(0,y-40*s,0,y+26*s);g.addColorStop(0,'#ffffff');g.addColorStop(.62,'#f4fbff');g.addColorStop(1,'#bfdcf5');
 puff(c,[[x-58*s,y+6*s,26*s],[x-26*s,y-12*s,36*s],[x+16*s,y-22*s,42*s],[x+56*s,y-2*s,30*s],[x+82*s,y+10*s,20*s],[x,y+10*s,30*s]],g,'#9cc7ea',1.5*s);c.restore();
}

// ── Static sky: gradient, sun, cloud bank and sea ────────────────────────────
function paintSky(c:CanvasRenderingContext2D){
 c.fillStyle=vgrad(c,0,470,['#1c6fdc','#3d97ee','#74c3f6','#c4ecfd']);c.fillRect(0,0,LOBBY_W,470);
 const sun=c.createRadialGradient(1290,30,10,1290,30,420);sun.addColorStop(0,'#fffbe0ee');sun.addColorStop(.25,'#fff3b055');sun.addColorStop(1,'#fff3b000');c.fillStyle=sun;c.fillRect(0,0,LOBBY_W,470);
 // Long soft streaks give depth before the puffy clouds.
 c.save();c.globalAlpha=.35;c.fillStyle='#ffffff';for(const [x,y,w] of [[180,110,420],[820,70,360],[1100,170,300],[420,220,520]] as const){c.beginPath();c.ellipse(x,y,w/2,9,-.04,0,Math.PI*2);c.fill();}c.restore();
 // Cloud bank sitting on the horizon.
 for(let i=0;i<14;i++){const x=i*118-30,s=.8+(i*37%5)/10;cloud(c,x,372-(i%3)*12,s,.96);}
 // Distant isles on the horizon.
 c.fillStyle='#7fb7d8';for(const [x,w,h] of [[40,190,26],[520,140,16],[860,240,22],[1240,160,18]] as const){c.beginPath();c.ellipse(x+w/2,402,w/2,h,0,Math.PI,0);c.fill();}
 c.fillStyle=vgrad(c,398,470,['#55d3f2','#26b0e6','#1494d4']);c.fillRect(0,400,LOBBY_W,70);
 c.fillStyle='#e9fbff';c.fillRect(0,399,LOBBY_W,2.5);
}

// ── Static world: islands, temple, trees, balustrade, plaza ─────────────────
function island(c:CanvasRenderingContext2D,x:number,y:number,w:number,depth:number,seed:number){
 const r=random(seed),top:[number,number][]=[],steps=9;
 for(let i=0;i<=steps;i++)top.push([x-w/2+w*i/steps,y+(r()-.5)*8]);
 const bottom:[number,number][]=[[x+w/2-6,y+depth*.3],[x+w*.3,y+depth*.62],[x+w*.12,y+depth*.86],[x,y+depth],[x-w*.1,y+depth*.8],[x-w*.32,y+depth*.55],[x-w/2+4,y+depth*.25]];
 path(c,[...top,...bottom]);const g=c.createLinearGradient(0,y,0,y+depth);g.addColorStop(0,'#c99a6f');g.addColorStop(.45,'#9b6e63');g.addColorStop(1,'#5d4466');c.fillStyle=g;c.fill();c.strokeStyle=INK;c.lineWidth=3;c.stroke();
 c.save();c.clip();c.strokeStyle='#5a3e4f66';c.lineWidth=2;
 for(let i=1;i<5;i++){c.beginPath();c.moveTo(x-w/2,y+depth*i/6+8);for(let k=0;k<=8;k++)c.lineTo(x-w/2+w*k/8,y+depth*i/6+Math.sin(k*1.7+i)*6);c.stroke();}
 c.fillStyle='#ffffff2e';c.beginPath();c.ellipse(x-w*.22,y+depth*.25,w*.12,depth*.18,.2,0,Math.PI*2);c.fill();c.restore();
 // Grass cap with drips over the edge.
 const grass:[number,number,number][]=[];for(let i=0;i<=steps;i++)grass.push([x-w/2+w*i/steps,y+2+(r()-.5)*6,w/steps*.75]);
 const gg=c.createLinearGradient(0,y-20,0,y+20);gg.addColorStop(0,'#9be35b');gg.addColorStop(1,'#3fa144');puff(c,grass,gg,'#24603a',2.5);
 c.fillStyle='#c8f58a';for(const [gx,gy,gr] of grass){c.beginPath();c.ellipse(gx-gr*.2,gy-gr*.45,gr*.45,gr*.2,0,0,Math.PI*2);c.fill();}
}
function tree(c:CanvasRenderingContext2D,x:number,y:number,s:number,tone=0){
 c.fillStyle='#7a5038';c.strokeStyle=INK;c.lineWidth=2.5;roundRect(c,x-6*s,y-40*s,12*s,42*s,4*s);c.fill();c.stroke();
 const g=c.createLinearGradient(0,y-120*s,0,y-20*s);g.addColorStop(0,tone?'#b5ec62':'#8ee05a');g.addColorStop(1,tone?'#3f9a3a':'#2e8a3f');
 puff(c,[[x-30*s,y-52*s,28*s],[x+28*s,y-54*s,30*s],[x,y-82*s,38*s],[x-14*s,y-110*s,24*s],[x+18*s,y-104*s,24*s]],g,'#20563a',2.5);
 c.fillStyle='#dcffa24d';c.beginPath();c.ellipse(x-10*s,y-104*s,16*s,8*s,-.4,0,Math.PI*2);c.fill();
}
function bush(c:CanvasRenderingContext2D,x:number,y:number,s:number,flowers?:string){
 const g=c.createLinearGradient(0,y-40*s,0,y);g.addColorStop(0,'#86da55');g.addColorStop(1,'#2f8b3d');
 puff(c,[[x-22*s,y-14*s,18*s],[x+20*s,y-14*s,18*s],[x,y-26*s,22*s]],g,'#20563a',2.2);
 if(flowers){const r=random(Math.round(x*7+y));c.fillStyle=flowers;for(let i=0;i<7;i++){c.beginPath();c.arc(x+(r()-.5)*50*s,y-8*s-r()*30*s,3.2*s,0,Math.PI*2);c.fill();}}
}
function column(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number){
 const g=c.createLinearGradient(x-w/2,0,x+w/2,0);g.addColorStop(0,'#c9cfe0');g.addColorStop(.35,'#ffffff');g.addColorStop(1,'#a9b2cc');
 c.fillStyle=g;c.strokeStyle=INK;c.lineWidth=2.5;c.fillRect(x-w/2,y-h,w,h);c.strokeRect(x-w/2,y-h,w,h);
 c.strokeStyle='#8e98b455';c.lineWidth=1.5;for(const k of [-.22,.1,.36]){c.beginPath();c.moveTo(x+w*k,y-h+6);c.lineTo(x+w*k,y-6);c.stroke();}
 c.fillStyle='#f2c34a';c.strokeStyle=INK;c.lineWidth=2.5;roundRect(c,x-w/2-6,y-h-10,w+12,12,3);c.fill();c.stroke();roundRect(c,x-w/2-5,y-10,w+10,10,3);c.fill();c.stroke();
}
function temple(c:CanvasRenderingContext2D){
 // Stepped marble base rising from the sea on the right.
 for(let i=0;i<4;i++){const y=470-i*16,x=1140+i*22;c.fillStyle=i%2?'#eef1fa':'#dfe4f2';c.strokeStyle=INK;c.lineWidth=2.5;c.fillRect(x,y-16,LOBBY_W-x+10,16);c.strokeRect(x,y-16,LOBBY_W-x+10,16);}
 for(let i=0;i<5;i++)column(c,1236+i*62,406,30,150);
 // Entablature and pediment.
 c.fillStyle='#f5f7ff';c.strokeStyle=INK;c.lineWidth=3;c.fillRect(1210,232,330,30);c.strokeRect(1210,232,330,30);
 c.fillStyle='#f2c34a';c.fillRect(1210,252,330,10);c.strokeRect(1210,252,330,10);
 path(c,[[1200,232],[1374,168],[1548,232]]);c.fillStyle=vgrad(c,168,232,['#ffffff','#d7ddef']);c.fill();c.stroke();
 c.fillStyle='#ffcf4d';c.beginPath();c.arc(1374,212,15,0,Math.PI*2);c.fill();c.stroke();
 c.fillStyle='#ff6f3c';c.beginPath();c.arc(1374,212,7,0,Math.PI*2);c.fill();
 // Tower with a teal dome behind the colonnade.
 c.fillStyle=vgrad(c,60,240,['#ffffff','#d6dcef']);c.fillRect(1440,96,74,140);c.strokeRect(1440,96,74,140);
 c.fillStyle='#3cc6c9';c.beginPath();c.ellipse(1477,96,44,40,0,Math.PI,0);c.fill();c.stroke();
 c.fillStyle='#9ff0e5';c.beginPath();c.ellipse(1465,80,12,18,-.4,0,Math.PI*2);c.fill();
 c.fillStyle='#f2c34a';c.fillRect(1473,40,8,18);c.strokeRect(1473,40,8,18);c.beginPath();c.arc(1477,38,7,0,Math.PI*2);c.fill();c.stroke();
 for(const wx of [1458,1486]){c.fillStyle='#2d5d9a';roundRect(c,wx-7,128,14,30,7);c.fill();c.stroke();}
 // Hanging banners between columns.
 for(const bx of [1267,1391]){c.fillStyle='#ff7a2e';path(c,[[bx,262],[bx+40,262],[bx+40,350],[bx+20,334],[bx,350]]);c.fill();c.strokeStyle=INK;c.lineWidth=2.5;c.stroke();c.fillStyle='#ffd65a';c.beginPath();c.arc(bx+20,292,9,0,Math.PI*2);c.fill();c.stroke();}
}
function gazebo(c:CanvasRenderingContext2D,x:number,s:number){
 // A white ruin on its own islet out at sea, between the portals.
 c.save();c.translate(x,404);c.scale(s,s);
 c.fillStyle='#4da86a';c.strokeStyle=INK;c.lineWidth=2;c.beginPath();c.ellipse(0,0,92,14,0,Math.PI,0);c.fill();c.stroke();
 for(const k of [-48,-14,20,54])column(c,k,-4,14,74);
 c.fillStyle='#f5f7ff';c.strokeStyle=INK;c.lineWidth=2.5;c.fillRect(-64,-92,132,14);c.strokeRect(-64,-92,132,14);
 path(c,[[-70,-92],[2,-118],[74,-92]]);c.fillStyle='#e5e9f6';c.fill();c.stroke();c.restore();
}
function lawnAndBalustrade(c:CanvasRenderingContext2D){
 // Hedge band behind the railing.
 const r=random(41);const hedge:[number,number,number][]=[];for(let x=-20;x<LOBBY_W+40;x+=40)hedge.push([x,478+r()*6,20+r()*9]);
 const hg=c.createLinearGradient(0,446,0,490);hg.addColorStop(0,'#7dd651');hg.addColorStop(1,'#2a7f3c');puff(c,hedge,hg,'#1d5236',2.5);
 // Railing.
 const top=470,base=520;c.fillStyle=vgrad(c,top,base,['#f4f1ea','#d9d3c8']);c.fillRect(0,top+12,LOBBY_W,base-top-12);
 c.strokeStyle='#7f7c88';c.lineWidth=2;for(let x=8;x<LOBBY_W;x+=20){c.fillStyle='#ebe6dc';roundRect(c,x,top+16,12,base-top-24,5);c.fill();c.stroke();}
 c.fillStyle=vgrad(c,top,top+14,['#ffffff','#dcd6cb']);c.strokeStyle=INK;c.lineWidth=2.5;c.fillRect(-4,top,LOBBY_W+8,14);c.strokeRect(-4,top,LOBBY_W+8,14);
 c.fillStyle='#c9c2b5';c.fillRect(-4,base-6,LOBBY_W+8,8);c.strokeRect(-4,base-6,LOBBY_W+8,8);
 for(let x=60;x<LOBBY_W;x+=176){c.fillStyle=vgrad(c,top-26,base,['#ffffff','#d8d1c4']);c.fillRect(x-15,top-22,30,base-top+18);c.strokeRect(x-15,top-22,30,base-top+18);
  c.fillStyle='#f2c34a';roundRect(c,x-19,top-30,38,10,3);c.fill();c.stroke();
  c.fillStyle='#c46a3c';path(c,[[x-15,top-30],[x+15,top-30],[x+11,top-50],[x-11,top-50]]);c.fill();c.stroke();bush(c,x,top-46,.62,['#ff6fa8','#ffd64a','#ffffff'][(x/176|0)%3]);}
 // Flower bed between railing and plaza.
 c.fillStyle=vgrad(c,base,base+28,['#4fb24a','#3d963f']);c.fillRect(0,base,LOBBY_W,28);
 const fr=random(77);for(let i=0;i<180;i++){const x=fr()*LOBBY_W,y=base+5+fr()*20;c.fillStyle=['#ffffff','#ffe066','#ff8cc6','#9ee7ff'][i%4];c.beginPath();c.arc(x,y,2+fr()*1.6,0,Math.PI*2);c.fill();}
 c.fillStyle='#6cc95a';for(let i=0;i<120;i++){const x=fr()*LOBBY_W;c.beginPath();c.moveTo(x,base+28);c.lineTo(x+3,base+16+fr()*6);c.lineTo(x+6,base+28);c.fill();}
}
function plaza(c:CanvasRenderingContext2D){
 const y0=546;c.fillStyle=vgrad(c,y0,LOBBY_H,['#efe7d7','#e6dbc6','#d9ccb3']);c.fillRect(0,y0,LOBBY_W,LOBBY_H-y0);
 c.fillStyle='#b9ab93';c.fillRect(0,y0-6,LOBBY_W,8);c.fillStyle='#fffaf0';c.fillRect(0,y0-7,LOBBY_W,2);
 // Flagstones grow towards the viewer; the vanishing point sits behind the arena portal.
 const r=random(9);let y=y0+2,h=22,row=0;
 while(y<LOBBY_H){const depth=(y-y0)/(LOBBY_H-y0),stone=110+depth*190;let x=-(r()*stone);
  while(x<LOBBY_W){const w=stone*(.6+r()*.8),tint=r(),j=()=>(r()-.5)*h*.22;c.fillStyle=tint<.12?'#e6d6ba':tint<.22?'#f7f1e6':tint<.28?'#e2e2d4':'#eee6d6';
   path(c,[[x+3+j(),y+2+j()],[x+w-3+j(),y+2+j()],[x+w-2,y+h-2+j()],[x+2,y+h-2+j()]]);c.fill();c.strokeStyle='#d3c6ad';c.lineWidth=1.5;c.stroke();
   c.fillStyle='#ffffff48';c.fillRect(x+8,y+4,w*.35,Math.max(1.5,h*.1));x+=w;}
  y+=h;h*=1.2;row++;}
 // Inlaid star mosaic, half under the dock.
 c.save();c.translate(1205,836);c.scale(1,.36);
 c.fillStyle='#d6c6a6';c.strokeStyle='#a79070';c.lineWidth=5;c.beginPath();c.arc(0,0,250,0,Math.PI*2);c.fill();c.stroke();
 c.fillStyle='#efe5d1';c.beginPath();c.arc(0,0,215,0,Math.PI*2);c.fill();c.stroke();
 c.fillStyle='#e5b55a';c.beginPath();for(let i=0;i<16;i++){const a=i*Math.PI/8,rad=i%2?72:190;c.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);}c.closePath();c.fill();c.strokeStyle='#a87b3c';c.stroke();
 c.fillStyle='#fff3cc';c.beginPath();c.arc(0,0,58,0,Math.PI*2);c.fill();c.stroke();c.restore();
 // Soft shade under the railing.
 c.fillStyle=vgrad(c,y0,y0+40,['#7b6a5040','#7b6a5000']);c.fillRect(0,y0,LOBBY_W,40);
}
function signboard(c:CanvasRenderingContext2D){
 // Notice board on the left with pinned papers.
 c.strokeStyle=INK;c.lineWidth=2.5;c.fillStyle='#8a5a3a';for(const x of [52,148]){c.fillRect(x-5,452,10,92);c.strokeRect(x-5,452,10,92);}
 c.fillStyle=vgrad(c,440,512,['#c88a55','#9c6440']);roundRect(c,36,440,128,74,8);c.fill();c.stroke();
 c.fillStyle='#b5463b';path(c,[[28,446],[100,416],[172,446]]);c.fill();c.stroke();
 c.fillStyle='#fff6dc';for(const [x,y,w,h,a] of [[50,454,36,30,-.08],[92,450,30,40,.06],[128,458,24,26,-.05]] as const){c.save();c.translate(x+w/2,y+h/2);c.rotate(a);c.fillRect(-w/2,-h/2,w,h);c.strokeStyle='#8a6a4a';c.lineWidth=1.5;c.strokeRect(-w/2,-h/2,w,h);c.fillStyle='#d24b4b';c.beginPath();c.arc(0,-h/2+4,2.5,0,Math.PI*2);c.fill();c.restore();c.fillStyle='#fff6dc';}
}
function paintWorld(c:CanvasRenderingContext2D){
 // Rainbow behind the floating isles.
 c.save();c.globalAlpha=.42;c.lineWidth=9;['#ff6b6b','#ffb347','#ffe66d','#7ee081','#6ccff6','#a78bfa'].forEach((col,i)=>{c.strokeStyle=col;c.beginPath();c.arc(270,430,250-i*9,Math.PI*1.08,Math.PI*1.72);c.stroke();});c.restore();
 island(c,230,216,250,170,3);island(c,404,312,96,70,7);island(c,96,330,80,60,11);
 // Shrine on the big island.
 c.fillStyle=vgrad(c,130,214,['#ffffff','#d6dcef']);c.strokeStyle=INK;c.lineWidth=2.5;c.fillRect(196,150,56,62);c.strokeRect(196,150,56,62);
 c.fillStyle='#4a7fe0';path(c,[[186,152],[224,112],[262,152]]);c.fill();c.stroke();c.fillStyle='#2d5d9a';roundRect(c,214,176,20,36,10);c.fill();c.stroke();
 tree(c,150,214,.62,1);tree(c,302,212,.5);bush(c,262,214,.6,'#ff8cc6');bush(c,404,316,.5,'#ffe066');tree(c,96,334,.36,1);
 gazebo(c,822,.72);gazebo(c,560,.5);temple(c);
 // Trees framing the plaza.
 for(const [x,s,t] of [[26,1.25,0],[118,1.05,1],[1068,1.05,0],[1150,.8,1]] as const)tree(c,x,476,s,t);
 lawnAndBalustrade(c);plaza(c);signboard(c);
}

// ── Animated pieces ─────────────────────────────────────────────────────────
function waterfall(c:CanvasRenderingContext2D,t:number){
 const x=318,top=228,bottom=402;c.save();
 c.fillStyle=vgrad(c,top,bottom,['#e9fbffee','#9fe2ffcc','#c9f2ff55']);path(c,[[x-14,top],[x+14,top],[x+22,bottom],[x-20,bottom]]);c.fill();
 c.strokeStyle='#ffffffcc';c.lineWidth=2;for(let i=0;i<5;i++){const k=((t/420+i/5)%1);c.beginPath();c.moveTo(x-8+i*4,top+k*(bottom-top));c.lineTo(x-8+i*4+k*3,top+k*(bottom-top)+18);c.stroke();}
 c.fillStyle='#ffffffcc';for(let i=0;i<6;i++){const k=(t/700+i/6)%1;c.globalAlpha=1-k;c.beginPath();c.arc(x+(i-2.5)*9,bottom-k*14,6+k*8,0,Math.PI*2);c.fill();}
 c.restore();
}
function airship(c:CanvasRenderingContext2D,t:number){
 const x=1010+Math.sin(t/4200)*14,y=150+Math.sin(t/1700)*6;c.save();c.translate(x,y);c.rotate(Math.sin(t/2100)*.025);
 c.strokeStyle='#5b4334';c.lineWidth=1.8;for(const [a,b] of [[-52,-38],[-18,-14],[18,14],[52,38]] as const){c.beginPath();c.moveTo(a,24);c.lineTo(b,70);c.stroke();}
 const env=c.createLinearGradient(0,-50,0,40);env.addColorStop(0,'#fff6e0');env.addColorStop(1,'#e7c79a');c.fillStyle=env;c.strokeStyle=INK;c.lineWidth=3;c.beginPath();c.ellipse(0,-6,86,42,0,0,Math.PI*2);c.fill();c.stroke();
 c.save();c.clip();c.fillStyle='#ff7a3d';for(const k of [-50,-10,30])c.fillRect(k,-60,18,120);c.restore();c.beginPath();c.ellipse(0,-6,86,42,0,0,Math.PI*2);c.stroke();
 c.fillStyle='#f2c34a';path(c,[[-86,-6],[-112,-30],[-108,-6],[-112,18]]);c.fill();c.stroke();
 c.fillStyle='#9a5d3a';path(c,[[-66,66],[66,66],[52,92],[-52,92]]);c.fill();c.stroke();c.fillStyle='#c78452';c.fillRect(-62,66,124,8);
 c.fillStyle='#bfe8ff';for(const k of [-36,-8,20])c.beginPath(),c.arc(k+8,80,5,0,Math.PI*2),c.fill(),c.stroke();
 c.save();c.translate(76,78);c.rotate(t/90);c.fillStyle='#f2c34a';for(let i=0;i<3;i++){c.rotate(Math.PI*2/3);c.beginPath();c.ellipse(0,-9,3.5,9,0,0,Math.PI*2);c.fill();c.stroke();}c.restore();
 c.restore();
}
function balloon(c:CanvasRenderingContext2D,x:number,y:number,col:string,t:number,phase:number){
 const bx=x+Math.sin(t/1300+phase)*6,by=y+Math.sin(t/900+phase)*8;c.strokeStyle='#ffffffaa';c.lineWidth=1.2;c.beginPath();c.moveTo(bx,by+22);c.quadraticCurveTo(bx-6,by+46,bx+2,by+70);c.stroke();
 const g=c.createRadialGradient(bx-6,by-8,2,bx,by,24);g.addColorStop(0,'#ffffff');g.addColorStop(.25,col);g.addColorStop(1,col);c.fillStyle=g;c.strokeStyle=INK;c.lineWidth=2;c.beginPath();c.ellipse(bx,by,17,21,0,0,Math.PI*2);c.fill();c.stroke();
 c.fillStyle=col;path(c,[[bx-4,by+20],[bx+4,by+20],[bx,by+26]]);c.fill();
}
function banner(c:CanvasRenderingContext2D,t:number){
 // Festival ribbon strung across the temple steps.
 const x0=1062,x1=1500,y=286;c.strokeStyle='#5b4334';c.lineWidth=3;for(const x of [x0,x1]){c.beginPath();c.moveTo(x,y-30);c.lineTo(x,y+4);c.stroke();}
 c.save();const wave=(k:number)=>Math.sin(t/600+k*5)*4;c.beginPath();const n=24;for(let i=0;i<=n;i++){const k=i/n;c.lineTo(x0+(x1-x0)*k,y-26+Math.sin(k*Math.PI)*16+wave(k));}for(let i=n;i>=0;i--){const k=i/n;c.lineTo(x0+(x1-x0)*k,y+12+Math.sin(k*Math.PI)*16+wave(k));}c.closePath();
 c.fillStyle=c.createLinearGradient(x0,0,x1,0);(c.fillStyle as CanvasGradient).addColorStop(0,'#ff4fa3');(c.fillStyle as CanvasGradient).addColorStop(.5,'#ff7cc0');(c.fillStyle as CanvasGradient).addColorStop(1,'#ff4fa3');c.fill();c.strokeStyle='#7a1f55';c.lineWidth=2.5;c.stroke();
 c.font='900 21px Nunito, "Trebuchet MS", sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineWidth=4;c.strokeStyle='#8c1d5a';c.fillStyle='#fff7d6';
 const mid=(x0+x1)/2;c.strokeText('Festival de Brasa · Mire alto, jogue junto',mid,y+2+wave(.5));c.fillText('Festival de Brasa · Mire alto, jogue junto',mid,y+2+wave(.5));c.restore();
 // Pennants under the ribbon.
 for(let i=1;i<12;i++){const k=i/12,x=x0+(x1-x0)*k,yy=y+14+Math.sin(k*Math.PI)*16+wave(k);c.fillStyle=['#ffd34d','#56c7ff','#8ee05a'][i%3];c.strokeStyle=INK;c.lineWidth=1.5;path(c,[[x-8,yy],[x+8,yy],[x,yy+16+Math.sin(t/300+i)*2]]);c.fill();c.stroke();}
}

function lamp(c:CanvasRenderingContext2D,x:number,y:number,t:number){
 c.save();c.strokeStyle=INK;c.lineWidth=2.5;
 c.fillStyle='#d8d1c4';roundRect(c,x-16,y-14,32,16,4);c.fill();c.stroke();
 c.fillStyle=vgrad(c,y-210,y,['#4d6aa8','#2c3f6e']);roundRect(c,x-5,y-206,10,194,4);c.fill();c.stroke();
 c.fillStyle='#f2c34a';for(const k of [-70,-150,-206]){roundRect(c,x-9,y+k-6,18,9,3);c.fill();c.stroke();}
 // Scrolled arm with a hanging lantern on each side.
 for(const side of [-1,1]){c.strokeStyle='#2c3f6e';c.lineWidth=5;c.beginPath();c.moveTo(x,y-196);c.quadraticCurveTo(x+side*30,y-214,x+side*44,y-192);c.stroke();
  c.strokeStyle='#f2c34a';c.lineWidth=2;c.beginPath();c.arc(x+side*18,y-186,7,0,Math.PI*1.6);c.stroke();
  const lx=x+side*44,ly=y-180+Math.sin(t/900+side)*1.5,glow=c.createRadialGradient(lx,ly,2,lx,ly,34);glow.addColorStop(0,'#fff3b0aa');glow.addColorStop(1,'#fff3b000');c.fillStyle=glow;c.beginPath();c.arc(lx,ly,34,0,Math.PI*2);c.fill();
  c.fillStyle='#ffe58a';c.strokeStyle=INK;c.lineWidth=2;roundRect(c,lx-9,ly-12,18,24,5);c.fill();c.stroke();c.fillStyle='#2c3f6e';c.fillRect(lx-11,ly-15,22,5);c.fillRect(lx-8,ly+11,16,4);}
 c.restore();
}
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

export interface LobbyKeeper {id:string;x:number;y:number;outfit:'surfer'|'executive';hat:string;facing:1|-1;}
export interface LobbyPodium {rank:1|2|3;x:number;y:number;}

export class LobbyWorld {
 private sky:HTMLCanvasElement;private world:HTMLCanvasElement;private plaza=new Image();
 /** True once the painted panorama has loaded. */
 painted=false;
 private art=new Map<string,HTMLImageElement>();private layers=new Map<string,HTMLImageElement>();private casts=new Map<string,HTMLCanvasElement>();
 private floor=new Image();private floorCanvas:HTMLCanvasElement|null=null;
 /** Podium ranks with a player standing on them: their ring and halo are left out, so nothing glows behind the figure. */
 occupied=new Set<number>();
 constructor(density=2){
  this.sky=this.layer(density,paintSky);this.world=this.layer(density,paintWorld);
  this.plaza.onload=()=>{this.painted=true;};this.plaza.src='/assets/lobby/plaza.webp';
  // Optional floor texture laid over the painted floor; see docs/lobby-art-prompts.md.
  this.floor.src='/assets/lobby/floor.webp';
  for(const station of LOBBY_STATIONS){
   const image=new Image();image.src=`/assets/lobby/${station.dir}.png`;this.art.set(station.id,image);
   for(const layer of station.layers){const part=new Image();part.src=`/assets/lobby/${station.dir}/${layer.name}.png`;this.layers.set(`${station.dir}/${layer.name}`,part);}
  }
 }
 private layer(density:number,paint:(c:CanvasRenderingContext2D)=>void){const canvas=document.createElement('canvas');canvas.width=LOBBY_W*density;canvas.height=LOBBY_H*density;const c=canvas.getContext('2d')!;c.scale(density,density);c.lineCap='round';c.lineJoin='round';paint(c);return canvas;}
 private loaded(station:Station){return station.layers.map(layer=>({layer,image:this.layers.get(`${station.dir}/${layer.name}`)!})).filter(({image})=>image.complete&&image.naturalWidth>0);}
 private hasArt(station:Station){const single=this.art.get(station.id)!;return this.loaded(station).length>0||(single.complete&&single.naturalWidth>0);}
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
  if(this.painted){
   // Height fits the view; a panorama narrower than the plaza repeats.
   const k=LOBBY_H/this.plaza.naturalHeight,tile=this.plaza.naturalWidth*k;
   for(let x0=Math.floor(camX/tile)*tile;x0<camX+LOBBY_W;x0+=tile){const from=Math.max(camX,x0),to=Math.min(camX+LOBBY_W,x0+tile);c.drawImage(this.plaza,(from-x0)/k,0,(to-from)/k,this.plaza.naturalHeight,from,0,to-from,LOBBY_H);}
   const floor=this.floorBand();
   if(floor){const d=floor.width/LOBBY_WIDTH;c.drawImage(floor,camX*d,0,LOBBY_W*d,floor.height,camX,FLOOR_TOP,LOBBY_W,LOBBY_H-FLOOR_TOP);}
   return;
  }
  for(let x0=Math.floor(camX/LOBBY_W)*LOBBY_W;x0<camX+LOBBY_W;x0+=LOBBY_W){
   c.save();c.translate(x0,0);c.drawImage(this.sky,0,0,LOBBY_W,LOBBY_H);
   for(let i=0;i<5;i++){const s=.9+(i%3)*.25,x=((i*347+t*(.006+i*.0015))%(LOBBY_W+400))-200;cloud(c,x,60+(i*53)%170,s,.92);}
   c.save();c.strokeStyle='#ffffffb0';c.lineWidth=2;for(let i=0;i<26;i++){const x=(i*61+t*.012*(i%2?1:-1)+LOBBY_W*4)%LOBBY_W,y=410+(i*13)%52,w=10+(i%4)*6;c.globalAlpha=.4+Math.sin(t/500+i)*.35;c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y);c.stroke();}c.restore();
   c.drawImage(this.world,0,0,LOBBY_W,LOBBY_H);
   waterfall(c,t);airship(c,t);banner(c,t);
   balloon(c,1170,96,'#b05cff',t,0);balloon(c,1204,120,'#ff5f9e',t,1);balloon(c,1500,330,'#ff5f9e',t,2);balloon(c,860,120,'#c58cff',t,3);balloon(c,1086,70,'#ff8a3d',t,4);
   c.restore();
  }
 }
 /** Stations that share the avatars' depth order. */
 sprites(t:number,hover:string|null):LobbySprite[]{
  return LOBBY_STATIONS.map(station=>({y:station.y-24,draw:(c:CanvasRenderingContext2D)=>this.station(c,station,t,hover===station.id)}));
 }
 /** Keepers to stand in as avatars while their painting is missing. */
 keepers():LobbyKeeper[]{
  return LOBBY_STATIONS.flatMap(station=>station.fallback.kind==='keeper'&&!this.hasArt(station)?[{id:`npc-${station.id}`,x:station.x,y:station.y,outfit:station.fallback.outfit,hat:station.fallback.hat,facing:station.fallback.facing}]:[]);
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
