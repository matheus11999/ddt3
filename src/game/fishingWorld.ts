/**
 * Pescaria: the fishing zone next to Praça Celeste (docs/fishing.md), a terraced garden on a sky
 * island three screens wide and two tall; the camera follows the player both ways.
 *
 * Depth, back to front: the plaza's own painted sky, sea, far islands and tree line (lowered behind
 * the top terrace, with parallax both ways); the stone terraces, their retaining walls, stairs,
 * lakes, piers and the bridge (baked once into tiles); then, sorted with the walkers by their feet,
 * the painted trees, pillars, hedges, bushes, the gazebo of the Casa de Pesca and the airship back
 * to the plaza; clouds drift under the island at the very front.
 *
 * Every painting comes from art the game already has (`npm run build:fishing` cuts it); the
 * stone, water, wood and the waterfall are drawn in code to match it.
 */
import {FISHING_AIRSHIP,FISHING_SPOTS,FISHING_HEIGHT,FISHING_LAKES,FISHING_PIERS,FISHING_STAIRS,FISHING_TERRACES,FISHING_WIDTH,FISH_BY_ID,inLake} from '../../shared/fishing';
import type {FishingLake,FishingPier,FishingPose,FishingSpot} from '../../shared/fishing';
import {LOBBY_FLOATERS,LOBBY_PARALLAX} from '../../shared/generated/lobbyParallax';
import type {LobbyFloater,LobbyParallaxLayer} from '../../shared/generated/lobbyParallax';
import {FISHING_PROPS} from '../../shared/generated/fishingProps';
import type {FishingPropId} from '../../shared/generated/fishingProps';
import {drawScaled,imageReady,scaledCopy,screenScale} from './spriteCache';
import {plaque} from './lobbyWorld';

const VIEW_W=1536,VIEW_H=864,W=FISHING_WIDTH,H=FISHING_HEIGHT;
/** The plaza's backdrop sits this much lower here, so its tree line meets the top terrace's balustrade. */
const SKY_DROP=100;
const BACKDROP=new Set(['sky','far','mid','trees']);
/** Where the baked ground starts (the top balustrade's lamps reach this high). */
const GROUND_TOP=470;
/** Width of one baked ground tile (world px). */
const TILE=768;
const [MIRANTE,JARDIM,CAIS]=FISHING_TERRACES;
/** The front wall under each terrace: from its edge down to the next terrace (the last one, down into the clouds). */
const WALLS=[{top:MIRANTE.y1,bottom:JARDIM.y0},{top:JARDIM.y1,bottom:CAIS.y0},{top:CAIS.y1,bottom:CAIS.y1+92}];
const CLOUDS_TOP=CAIS.y1+70;
/** The Lagoa de Cristal spills through a channel in the top terrace's front and falls into the Poço Azul. */
const CRISTAL=FISHING_LAKES.find(l=>l.id==='cristal')!,PROFUNDO=FISHING_LAKES.find(l=>l.id==='profundo')!;
const FALL={x0:CRISTAL.x-34,x1:CRISTAL.x+34,lip:CRISTAL.y+CRISTAL.ry-6,edge:MIRANTE.y1,base:PROFUNDO.y-PROFUNDO.ry+14};
/** Gaps in the hedges and balustrades: the stairs, the waterfall's channel and the airship's gangway. */
const GANGWAY={x0:FISHING_AIRSHIP.x-46,x1:FISHING_AIRSHIP.x+46};

export type FishingAction='shop'|'plaza';
export interface FishingStation {id:'casa'|'airship';title:string;x:number;y:number;width:number;height:number;action:FishingAction;}
/** Things to click: the gazebo of the Casa de Pesca on its island, and the airship back to the plaza (feet at the bottom centre). */
export const FISHING_STATIONS:FishingStation[]=[
 {id:'casa',title:'Casa de Pesca',x:1180,y:1176,width:FISHING_PROPS.gazebo.w,height:FISHING_PROPS.gazebo.h,action:'shop'},
 {id:'airship',title:'Praça Celeste',x:FISHING_AIRSHIP.x,y:FISHING_AIRSHIP.y+70,width:FISHING_PROPS.airship.w,height:FISHING_PROPS.airship.h,action:'plaza'},
];
/** What a click means: a station, or the water of a lake (walk to its nearest free spot). */
export type FishingHit={kind:'station';station:FishingStation}|{kind:'lake';lake:FishingLake};

/** Small deterministic generator, so the garden never shimmers between reloads. */
function random(seed:number){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const LAKE_COLORS:Record<string,{deep:string;mid:string;edge:string;foam:string}>={
 ninfeias:{deep:'#13615f',mid:'#2b9c8c',edge:'#8fe0c4',foam:'#e6fff4'},
 profundo:{deep:'#0b2766',mid:'#1d58a8',edge:'#66b8e8',foam:'#e8f6ff'},
 cristal:{deep:'#1478a8',mid:'#3fc2e6',edge:'#c8f7ff',foam:'#ffffff'},
};
/** Stone colors from the plaza's painted floor (cream and grey slabs), light to dark. */
const STONE=[['#f3e8cf','#d9c7a3','#a8916c'],['#e4e0d6','#c4bfb3','#8f897d'],['#efe2c4','#d3bf95','#9c8460']];
const MORTAR='rgba(92,72,48,.55)';

/** Painted pieces placed in the world, sorted with the walkers by `y` (their base). */
interface Prop {id:FishingPropId;x:number;y:number;flip?:boolean;scale?:number;sway?:boolean;}
function props():Prop[]{
 const list:Prop[]=[];
 // Hedges along the front edges of the two upper terraces, open at the stairs and the waterfall.
 const gaps=[...FISHING_STAIRS.map(s=>({x0:s.x0-6,x1:s.x1+6})),{x0:FALL.x0-10,x1:FALL.x1+10}];
 const hedge=FISHING_PROPS.hedge.w*.5;
 for(const edge of [MIRANTE.y1+8,JARDIM.y1+8])for(let x=-hedge/2;x<W+hedge;x+=hedge*.92)if(!gaps.some(g=>x+hedge/2>g.x0&&x-hedge/2<g.x1))list.push({id:'hedge',x,y:edge,scale:.5});
 // Lamp posts along the same edges, and urns at the top of every stair.
 for(const [edge,xs] of [[MIRANTE.y1+10,[380,1240,2620,3160,4010]],[JARDIM.y1+10,[300,1460,2160,3080,4150]]] as const)for(const x of xs)list.push({id:'lamp-pillar',x,y:edge,scale:.8});
 for(const s of FISHING_STAIRS){const top=FISHING_TERRACES.find(t=>Math.abs(t.y1-s.y0-32)<40)?.y1??s.y0;list.push({id:'urn-pillar',x:s.x0-14,y:top+12,scale:.72},{id:'urn-pillar',x:s.x1+14,y:top+12,scale:.72});}
 // Trees (their trunks are obstacles in shared/fishingMap.ts), cypresses framing the sides.
 list.push({id:'oak',x:520,y:712},{id:'blossom',x:1460,y:702},{id:'oak',x:4020,y:712,flip:true},{id:'oak',x:2330,y:1042,flip:true},{id:'cypress',x:4380,y:1070,scale:.95},{id:'oak',x:1700,y:1482},{id:'blossom',x:3300,y:1487,flip:true});
 for(const [x,y] of [[40,664],[4570,664],[30,1000],[4580,1000],[60,1450],[4560,1450]] as const)list.push({id:'cypress-pair',x,y,flip:x>W/2});
 list.push({id:'cypress',x:860,y:654,scale:.8},{id:'cypress',x:2240,y:654,scale:.85},{id:'cypress-pair',x:2780,y:654,scale:.8},{id:'cypress',x:4280,y:654,scale:.8});
 // Flower beds against the walls of the lower terraces.
 for(const x of [420,1560,2240,2880,4060])list.push({id:'flower-bush',x,y:JARDIM.y0+4,scale:.8});
 for(const x of [300,1150,2150,3050,3880,4280])list.push({id:'flower-bush',x,y:CAIS.y0+4,scale:.75});
 // Lakeside life: rocks, mushrooms, bluebells and clover around the rims; logs and a stump on the quay.
 for(const lake of FISHING_LAKES){const r=random(lake.x);
  for(const [a,id] of [[200,'mossy-rocks'],[340,'bluebell'],[160,'clover'],[20,'mushrooms']] as const){const rad=a*Math.PI/180,x=lake.x+Math.cos(rad)*(lake.rx+30),y=lake.y-Math.sin(rad)*(lake.ry+18);if(r()<.95)list.push({id,x,y:y+4,scale:.8});}}
 list.push({id:'log',x:2400,y:1560,scale:.8},{id:'stump',x:4100,y:1500,scale:.8},{id:'mushrooms',x:4140,y:1508,scale:.7},{id:'bluebell',x:1000,y:1500,scale:.8},{id:'mossy-rocks',x:3600,y:1590,scale:.8},{id:'stump',x:880,y:744,scale:.7},{id:'bluebell',x:2520,y:700,scale:.7});
 // The quay's balustrade over the clouds, open at the airship's gangway.
 const run=FISHING_PROPS.balustrade.w*.8;
 for(let x=run/2-20;x<W+run;x+=run)if(x+run/2<GANGWAY.x0||x-run/2>GANGWAY.x1)list.push({id:'balustrade',x,y:CAIS.y1+16,scale:.8});
 for(let x=-20,n=0;x<W+run;x+=run,n++)if(x<GANGWAY.x0-20||x>GANGWAY.x1+20)list.push({id:n%3===2?'lamp-pillar':'urn-pillar',x,y:CAIS.y1+20,scale:.8});
 return list;
}

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
function roundRect(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){c.beginPath();c.roundRect(x,y,w,h,r);}

/** Every stone of the walls, stairs and lake rims, laid out once for the whole island (tiles draw the ones they cover). */
interface Block {x:number;y:number;w:number;h:number;tone:number;moss:number;crack:boolean;}
interface Vine {x:number;y:number;len:number;sway:number;flower:string;}
function masonry(){
 const r=random(77),blocks:Block[]=[],vines:Vine[]=[];
 for(const wall of WALLS){
  const coping=14,rows=Math.max(1,Math.round((wall.bottom-wall.top-coping)/30)),rh=(wall.bottom-wall.top-coping)/rows;
  for(let row=0;row<rows;row++){let x=-40+(row%2)*45-r()*30;
   while(x<W+40){const w=58+r()*72;blocks.push({x,y:wall.top+coping+row*rh,w,h:rh,tone:Math.floor(r()*3),moss:row===0?r():r()*.25,crack:r()<.08});x+=w;}}
  for(let x=20;x<W;x+=40+r()*120)if(r()<.55)vines.push({x,y:wall.top+10,len:24+r()*(wall.bottom-wall.top)*.7,sway:r()*Math.PI*2,flower:['#fff6f0','#ffc2d6','#fff1a8'][Math.floor(r()*3)]});
 }
 return {blocks,vines};
}

export class FishingWorld {
 private depth:{factor:number;layer?:LobbyParallaxLayer;floater?:LobbyFloater;image:HTMLImageElement}[]=[];
 private floor=new Image();private art=new Map<FishingPropId,HTMLImageElement>();
 private tiles=new Map<number,HTMLCanvasElement>();private tileScale=0;private assets=false;
 private placed=props();private stones=masonry();
 load(){
  if(this.assets)return;this.assets=true;
  const entries=[...LOBBY_PARALLAX.filter(l=>BACKDROP.has(l.id)).map(layer=>({factor:layer.factor,layer,file:layer.file})),...LOBBY_FLOATERS.filter(f=>f.id!=='airship').map(floater=>({factor:floater.factor,floater,file:floater.file}))];
  this.depth=entries.sort((a,b)=>a.factor-b.factor).map(({file,...entry})=>{const image=new Image();image.decoding='async';image.src=file;return {...entry,image};});
  this.floor=new Image();this.floor.src='/assets/lobby/floor.webp';
  for(const id of Object.keys(FISHING_PROPS) as FishingPropId[]){const image=new Image();image.decoding='async';image.src=`/assets/fishing/props/${id}.webp`;this.art.set(id,image);}
 }
 release(){if(!this.assets)return;this.assets=false;this.depth=[];this.art.clear();this.tiles.clear();this.floor=new Image();}
 get isLoaded(){return this.assets;}
 /** True once everything on screen can be painted without a gap. */
 ready(_scale:number){return this.depth.length>0&&this.depth.every(d=>imageReady(d.image))&&imageReady(this.floor)&&[...this.art.values()].every(imageReady);}
 /** Camera that keeps the player a little below the middle (they are tall), never past the island's edges. */
 static camera(focusX:number,focusY:number){return {x:Math.max(0,Math.min(W-VIEW_W,focusX-VIEW_W/2)),y:Math.max(0,Math.min(H-VIEW_H,focusY-VIEW_H*.6))};}
 private drawDepth(c:CanvasRenderingContext2D,t:number,camX:number,camY:number){
  const scale=screenScale(c),x0=camX,x1=camX+VIEW_W;
  for(const {factor,layer,floater,image} of this.depth){
   // Each layer moves `factor` px per camera px, across and up and down.
   const left=camX*(1-factor),top=camY*(1-factor)+SKY_DROP;
   if(layer){
    const art=scaledCopy(image,layer.width*scale)??image,k=art.width/layer.width,from=Math.max(0,x0-left),to=Math.min(layer.width,x1-left);
    // The sky stretches up to the top of the world.
    const y=layer.id==='sky'?top-SKY_DROP:top+layer.y,h=layer.id==='sky'?layer.height+SKY_DROP:layer.height;
    if(to>from)c.drawImage(art,from*k,0,(to-from)*k,art.height,left+from,y,to-from,h);continue;}
   const f=floater!,phase=t/f.period*Math.PI*2+f.x*.01,x=left+f.x+Math.sin(phase*.5)*f.drift-f.w/2,y=top+f.y+Math.sin(phase)*f.bob-f.h/2;
   if(x<x1&&x+f.w>x0)c.drawImage(image,x,y,f.w,f.h);
  }
 }
 /** Back of the scene, in world coordinates (the caller has translated by the camera). */
 drawBack(c:CanvasRenderingContext2D,t:number,camX:number,camY:number){
  if(!this.ready(1)){c.fillStyle='#9ed4e8';c.fillRect(camX,camY,VIEW_W,VIEW_H);return;}
  c.save();c.imageSmoothingQuality='low';
  if(camY<MIRANTE.y0)this.drawDepth(c,t,camX,camY);
  const scale=Math.min(1.5,Math.max(1,Math.ceil(screenScale(c)*4)/4));
  if(scale!==this.tileScale){this.tiles.clear();this.tileScale=scale;}
  for(let n=Math.floor(camX/TILE);n*TILE<camX+VIEW_W;n++){const tile=this.tile(n);if(!tile)continue;
   const y0=Math.max(GROUND_TOP,camY),y1=Math.min(H,camY+VIEW_H);if(y1>y0)c.drawImage(tile,0,(y0-GROUND_TOP)*scale,tile.width,(y1-y0)*scale,n*TILE,y0,TILE,y1-y0);}
  for(const lake of FISHING_LAKES)if(lake.x+lake.rx>camX&&lake.x-lake.rx<camX+VIEW_W&&lake.y+lake.ry>camY&&lake.y-lake.ry<camY+VIEW_H)this.water(c,lake,t);
  if(FALL.x1>camX&&FALL.x0<camX+VIEW_W&&FALL.base>camY&&FALL.lip<camY+VIEW_H)this.waterfall(c,t);
  c.restore();
 }
 /** One baked column of the ground: floor, walls, stairs, lake rims and beds, piers and the top balustrade. */
 private tile(n:number){
  const cached=this.tiles.get(n);if(cached)return cached;
  if(n<0||n*TILE>=W)return null;
  const d=this.tileScale,canvas=document.createElement('canvas');canvas.width=Math.ceil(TILE*d);canvas.height=Math.ceil((H-GROUND_TOP)*d);
  const g=canvas.getContext('2d')!;g.imageSmoothingQuality='high';g.scale(d,d);g.translate(-n*TILE,-GROUND_TOP);
  g.beginPath();g.rect(n*TILE,GROUND_TOP,TILE,H-GROUND_TOP);g.clip();
  this.paintGround(g,n*TILE,n*TILE+TILE);
  this.tiles.set(n,canvas);return canvas;
 }
 private paintGround(g:CanvasRenderingContext2D,x0:number,x1:number){
  // The sea of clouds under the island.
  const sky=g.createLinearGradient(0,CAIS.y1,0,H);sky.addColorStop(0,'#bfe6f6');sky.addColorStop(1,'#f4fbff');g.fillStyle=sky;g.fillRect(x0,CAIS.y1,x1-x0,H-CAIS.y1);
  // Top balustrade behind the first terrace.
  this.balustradeRow(g,x0,x1,MIRANTE.y0+8);
  // Terrace floors: the plaza's stone slabs, seen at an angle, with a shadow under the wall behind and a lit front lip.
  const pattern=g.createPattern(this.floor,'repeat')!,tex=this.floor.naturalWidth;
  for(const t of FISHING_TERRACES){
   const top=t===MIRANTE?MIRANTE.y0-4:t.y0-10,bottom=t.y1+2;
   pattern.setTransform(new DOMMatrix([520/tex,0,0,520*.56/tex,0,top]));g.fillStyle=pattern;g.fillRect(x0,top,x1-x0,bottom-top);
   const warm=g.createLinearGradient(0,top,0,bottom);warm.addColorStop(0,'rgba(255,240,210,.18)');warm.addColorStop(1,'rgba(120,90,60,.12)');g.fillStyle=warm;g.fillRect(x0,top,x1-x0,bottom-top);
   const back=g.createLinearGradient(0,top,0,top+46);back.addColorStop(0,'rgba(50,36,20,.42)');back.addColorStop(1,'rgba(50,36,20,0)');g.fillStyle=back;g.fillRect(x0,top,x1-x0,46);
  }
  this.paintWalls(g,x0,x1);
  for(const s of FISHING_STAIRS)if(s.x1+30>x0&&s.x0-30<x1)this.paintStairs(g,s);
  for(const lake of FISHING_LAKES)if(lake.x+lake.rx+60>x0&&lake.x-lake.rx-60<x1)this.paintLake(g,lake);
  // The waterfall's channel through the top terrace's front.
  if(FALL.x1+30>x0&&FALL.x0-30<x1){const cx0=FALL.x0-14,cx1=FALL.x1+14;
   g.fillStyle='#8f7a5a';g.fillRect(cx0,FALL.lip-8,cx1-cx0,FALL.edge-FALL.lip+10);
   g.fillStyle='#d9c7a3';g.fillRect(cx0,FALL.lip-8,10,FALL.edge-FALL.lip+12);g.fillRect(cx1-10,FALL.lip-8,10,FALL.edge-FALL.lip+12);}
  for(const p of FISHING_PIERS)if(p.x1+40>x0&&p.x0-40<x1)this.paintDeck(g,p);
 }
 /** A row of the painted balustrade with its posts, bottom at `y`. */
 private balustradeRow(g:CanvasRenderingContext2D,x0:number,x1:number,y:number){
  const run=this.art.get('balustrade')!,urn=this.art.get('urn-pillar')!,lamp=this.art.get('lamp-pillar')!,hedge=this.art.get('hedge')!;
  const hs=FISHING_PROPS.hedge,hw=hs.w*.6;for(let x=Math.floor((x0-hw)/hw)*hw;x<x1+hw;x+=hw*.9)g.drawImage(hedge,x,y-44-hs.h*.6,hw,hs.h*.6);
  const b=FISHING_PROPS.balustrade,w=b.w*.9,h=b.h*.9;
  for(let x=Math.floor((x0-w)/w)*w;x<x1+w;x+=w)g.drawImage(run,x,y-h,w,h);
  for(let x=Math.floor((x0-w)/w)*w,n=Math.floor((x0-w)/w);x<x1+w*2;x+=w,n++){const lampPost=((n%4)+4)%4===1,a=lampPost?FISHING_PROPS['lamp-pillar']:FISHING_PROPS['urn-pillar'],k=.86;
   g.drawImage(lampPost?lamp:urn,x-a.w*k/2,y+2-a.h*k,a.w*k,a.h*k);}
 }
 /** Retaining walls of cream and grey blocks, a lit coping on top, moss and vines with flowers. */
 private paintWalls(g:CanvasRenderingContext2D,x0:number,x1:number){
  for(const wall of WALLS){
   const shadow=g.createLinearGradient(0,wall.top,0,wall.bottom);shadow.addColorStop(0,'#cdbb98');shadow.addColorStop(1,'#8c7656');g.fillStyle=shadow;g.fillRect(x0,wall.top,x1-x0,wall.bottom-wall.top);
  }
  for(const b of this.stones.blocks){if(b.x+b.w<x0-4||b.x>x1+4)continue;const [light,mid,dark]=STONE[b.tone];
   const f=g.createLinearGradient(0,b.y,0,b.y+b.h);f.addColorStop(0,light);f.addColorStop(.55,mid);f.addColorStop(1,dark);
   g.fillStyle=f;roundRect(g,b.x+1.5,b.y+1.5,b.w-3,b.h-3,5);g.fill();g.strokeStyle=MORTAR;g.lineWidth=2;g.stroke();
   g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1.5;g.beginPath();g.moveTo(b.x+6,b.y+4);g.lineTo(b.x+b.w-8,b.y+4);g.stroke();
   if(b.crack){g.strokeStyle='rgba(80,60,40,.5)';g.lineWidth=1.2;g.beginPath();g.moveTo(b.x+b.w*.4,b.y+3);g.lineTo(b.x+b.w*.48,b.y+b.h*.5);g.lineTo(b.x+b.w*.42,b.y+b.h-3);g.stroke();}
   if(b.moss>.55){g.fillStyle='rgba(98,150,52,.8)';for(let i=0;i<5;i++){g.beginPath();g.ellipse(b.x+b.w*(.15+i*.18),b.y+3+(i%2)*3,7+b.moss*6,4,0,0,Math.PI*2);g.fill();}}
  }
  for(const wall of WALLS){
   // Coping: a lit lip of the terrace above, and the shade it throws on the blocks.
   const lip=g.createLinearGradient(0,wall.top,0,wall.top+14);lip.addColorStop(0,'#fff6de');lip.addColorStop(.5,'#e6d4ae');lip.addColorStop(1,'#a88f66');g.fillStyle=lip;g.fillRect(x0,wall.top,x1-x0,14);
   g.strokeStyle='rgba(92,72,48,.6)';g.lineWidth=2;g.beginPath();g.moveTo(x0,wall.top+14);g.lineTo(x1,wall.top+14);g.stroke();
   const under=g.createLinearGradient(0,wall.top+14,0,wall.top+40);under.addColorStop(0,'rgba(60,40,20,.35)');under.addColorStop(1,'rgba(60,40,20,0)');g.fillStyle=under;g.fillRect(x0,wall.top+14,x1-x0,26);
   const foot=g.createLinearGradient(0,wall.bottom-30,0,wall.bottom);foot.addColorStop(0,'rgba(40,30,15,0)');foot.addColorStop(1,'rgba(40,30,15,.35)');g.fillStyle=foot;g.fillRect(x0,wall.bottom-30,x1-x0,30);
  }
  for(const v of this.stones.vines){if(v.x<x0-30||v.x>x1+30)continue;
   g.strokeStyle='#3f7a2a';g.lineWidth=2.4;g.beginPath();g.moveTo(v.x,v.y);g.bezierCurveTo(v.x+Math.sin(v.sway)*14,v.y+v.len*.35,v.x-Math.sin(v.sway)*12,v.y+v.len*.7,v.x+Math.sin(v.sway)*6,v.y+v.len);g.stroke();
   for(let k=0;k<1;k+=.12){const lx=v.x+Math.sin(v.sway+k*5)*10,ly=v.y+v.len*k;g.fillStyle=k%.24<.12?'#5fa83a':'#78c045';g.beginPath();g.ellipse(lx+4,ly,6,3.4,.6,0,Math.PI*2);g.fill();g.beginPath();g.ellipse(lx-4,ly+4,6,3.4,-.6,0,Math.PI*2);g.fill();}
   for(let k=.2;k<1;k+=.3){const fx=v.x+Math.sin(v.sway+k*5)*10,fy=v.y+v.len*k+2;g.fillStyle=v.flower;for(let p=0;p<5;p++){g.beginPath();g.arc(fx+Math.cos(p*1.26)*3,fy+Math.sin(p*1.26)*3,2.3,0,Math.PI*2);g.fill();}g.fillStyle='#f3b43a';g.beginPath();g.arc(fx,fy,1.6,0,Math.PI*2);g.fill();}
  }
 }
 /** Stone stairs cut into the wall, with side walls. */
 private paintStairs(g:CanvasRenderingContext2D,s:typeof FISHING_STAIRS[number]){
  const top=FISHING_TERRACES.find(t=>Math.abs(t.y1-s.y0-32)<40)!.y1,bottom=FISHING_TERRACES.find(t=>t.y0>top)!.y0,steps=Math.round((bottom-top)/15),h=(bottom-top)/steps;
  g.save();
  for(let i=0;i<steps;i++){const y=top+i*h;
   const riser=g.createLinearGradient(0,y,0,y+h);riser.addColorStop(0,'#efe2c4');riser.addColorStop(.35,'#e2d1ad');riser.addColorStop(.36,'#b39c76');riser.addColorStop(1,'#8f7a5a');
   g.fillStyle=riser;g.fillRect(s.x0,y,s.x1-s.x0,h+1);g.strokeStyle='rgba(92,72,48,.45)';g.lineWidth=1.2;g.beginPath();g.moveTo(s.x0,y+h*.36);g.lineTo(s.x1,y+h*.36);g.stroke();}
  for(const [x,w] of [[s.x0-16,16],[s.x1,16]] as const){const side=g.createLinearGradient(x,0,x+w,0);side.addColorStop(0,'#cdb995');side.addColorStop(.5,'#f2e6c9');side.addColorStop(1,'#b09a72');g.fillStyle=side;g.fillRect(x,top-6,w,bottom-top+6);g.strokeStyle=MORTAR;g.lineWidth=2;g.strokeRect(x,top-6,w,bottom-top+6);}
  const shade=g.createLinearGradient(s.x0,0,s.x1,0);shade.addColorStop(0,'rgba(60,40,20,.18)');shade.addColorStop(.2,'rgba(60,40,20,0)');shade.addColorStop(.8,'rgba(60,40,20,0)');shade.addColorStop(1,'rgba(60,40,20,.22)');g.fillStyle=shade;g.fillRect(s.x0,top,s.x1-s.x0,bottom-top);
  g.restore();
 }
 /** Lake bed: water deepening to the middle inside a rim of rounded stones and grass; lilies on the Ninfeias. */
 private paintLake(g:CanvasRenderingContext2D,lake:FishingLake){
  const {x,y,rx,ry}=lake,col=LAKE_COLORS[lake.id],r=random(lake.x+7);
  // Grass verge, then the stones.
  g.fillStyle='#6fae45';g.beginPath();g.ellipse(x,y+4,rx+30,ry+20,0,0,Math.PI*2);g.fill();
  g.fillStyle='#8cc95a';g.beginPath();g.ellipse(x,y+2,rx+24,ry+15,0,0,Math.PI*2);g.fill();
  const water=g.createRadialGradient(x,y+ry*.2,ry*.2,x,y,rx);water.addColorStop(0,col.deep);water.addColorStop(.7,col.mid);water.addColorStop(1,col.edge);
  g.save();g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=water;g.fill();g.clip();
  g.setTransform(g.getTransform().scale(1,ry/rx));const sy=y*rx/ry;
  const deep=g.createRadialGradient(x,sy,0,x,sy,rx);deep.addColorStop(0,'rgba(0,10,40,.25)');deep.addColorStop(.6,'rgba(0,10,40,.05)');deep.addColorStop(1,'rgba(255,255,255,.12)');g.fillStyle=deep;g.fillRect(x-rx,sy-rx,rx*2,rx*2);
  g.restore();
  // Shade of the back rim on the water.
  g.save();g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.clip();const lip=g.createLinearGradient(0,y-ry,0,y-ry+26);lip.addColorStop(0,'rgba(10,30,30,.45)');lip.addColorStop(1,'rgba(10,30,30,0)');g.fillStyle=lip;g.fillRect(x-rx,y-ry,rx*2,26);g.restore();
  if(lake.id==='ninfeias')for(let i=0;i<26;i++){const lx=x+(r()-.5)*rx*1.8,ly=y+(r()-.5)*ry*1.7,s=10+r()*10;if(!inLake({...lake,rx:rx-24,ry:ry-14},lx,ly)||Math.abs(lx-1180)<170&&ly<y+30)continue;
   g.fillStyle='#3d9a3a';g.strokeStyle='#245d22';g.lineWidth=1.5;g.beginPath();g.ellipse(lx,ly,s,s*.45,0,.25,Math.PI*2-.25);g.lineTo(lx,ly);g.closePath();g.fill();g.stroke();
   g.strokeStyle='rgba(180,240,140,.6)';g.beginPath();g.ellipse(lx,ly,s*.6,s*.25,0,Math.PI*1.1,Math.PI*1.7);g.stroke();
   if(r()<.4){g.fillStyle='#ffc6dc';for(let p=0;p<6;p++){g.beginPath();g.ellipse(lx+Math.cos(p)*4,ly-3+Math.sin(p)*1.6,4,2.2,p,0,Math.PI*2);g.fill();}g.fillStyle='#ffe46a';g.beginPath();g.arc(lx,ly-3,2,0,Math.PI*2);g.fill();}}
  // Rim of rounded stones all around.
  const count=Math.round((rx+ry)*.16);
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2+r()*.04,sx=x+Math.cos(a)*(rx+6),sy2=y+Math.sin(a)*(ry+4),w=16+r()*12,h=9+r()*5,[light,mid,dark]=STONE[Math.floor(r()*3)];
   const f=g.createLinearGradient(0,sy2-h/2,0,sy2+h/2);f.addColorStop(0,light);f.addColorStop(.6,mid);f.addColorStop(1,dark);g.fillStyle=f;g.strokeStyle=MORTAR;g.lineWidth=1.6;g.beginPath();g.ellipse(sx,sy2,w/2,h/2,Math.cos(a)*.3,0,Math.PI*2);g.fill();g.stroke();}
 }
 /** Wooden pier or bridge: planks across, beams on the sides, posts and rope at the corners over the water. */
 private paintDeck(g:CanvasRenderingContext2D,p:FishingPier){
  const lake=FISHING_LAKES.find(l=>l.id===p.lake)!,r=random(p.x0);
  const tipTop=inLake(lake,(p.x0+p.x1)/2,p.y0+4);
  // Stilts under the deck where it stands in the water.
  g.fillStyle='rgba(20,40,50,.35)';g.fillRect(p.x0+2,p.y0+6,p.x1-p.x0-4,p.y1-p.y0);
  for(let y=p.y0;y<p.y1;y+=10){const tone=r();g.fillStyle=tone<.33?'#b9824a':tone<.66?'#a8733f':'#c58f55';g.fillRect(p.x0,y,p.x1-p.x0,9.5);
   g.fillStyle='rgba(255,230,180,.35)';g.fillRect(p.x0,y,p.x1-p.x0,2);g.fillStyle='#4a2c14';g.fillRect(p.x0,y+9,p.x1-p.x0,1.5);
   g.fillStyle='#3a2410';g.beginPath();g.arc(p.x0+6,y+5,1.3,0,Math.PI*2);g.arc(p.x1-6,y+5,1.3,0,Math.PI*2);g.fill();}
  for(const x of [p.x0-4,p.x1-4]){g.fillStyle='#7a4a24';g.fillRect(x,p.y0,8,p.y1-p.y0);g.strokeStyle='#3a2410';g.lineWidth=1.5;g.strokeRect(x,p.y0,8,p.y1-p.y0);}
  const end=tipTop?p.y0:p.y1;g.fillStyle='#6a3e1c';g.fillRect(p.x0-4,end-(tipTop?0:8),p.x1-p.x0+8,8);
  const posts=p.kind==='bridge'?Array.from({length:Math.floor((p.y1-p.y0)/34)+1},(_,i)=>p.y0+6+i*34):[end+(tipTop?6:-2)];
  for(const py of posts)for(const x of [p.x0-2,p.x1+2]){const pg=g.createLinearGradient(x-5,0,x+5,0);pg.addColorStop(0,'#5a3418');pg.addColorStop(.5,'#a8733f');pg.addColorStop(1,'#5a3418');g.fillStyle=pg;g.strokeStyle='#2e1a0a';g.lineWidth=1.5;roundRect(g,x-5,py-26,10,30,3);g.fill();g.stroke();g.fillStyle='#c99a5a';g.beginPath();g.ellipse(x,py-26,5,2.4,0,0,Math.PI*2);g.fill();}
  if(p.kind==='bridge')for(const x of [p.x0-2,p.x1+2]){g.strokeStyle='#e8d6a8';g.lineWidth=2.2;g.beginPath();for(let i=0;i<posts.length-1;i++){const a=posts[i]-22,b=posts[i+1]-22;g.moveTo(x,a);g.quadraticCurveTo(x+(x<p.x0+10?-3:3),(a+b)/2+7,x,b);}g.stroke();}
  else for(const x of [p.x0-2,p.x1+2]){g.strokeStyle='#e8d6a8';g.lineWidth=2;g.beginPath();g.moveTo(x,posts[0]-18);g.lineTo(x+(x<p.x0+10?-6:6),posts[0]-6);g.stroke();}
 }
 /** Moving light on the water: the sky's sheen, rings and sparkles. */
 private water(c:CanvasRenderingContext2D,lake:FishingLake,t:number){
  const {x,y,rx,ry}=lake,col=LAKE_COLORS[lake.id];
  c.save();c.beginPath();c.ellipse(x,y,rx-2,ry-2,0,0,Math.PI*2);c.clip();
  c.globalCompositeOperation='screen';
  for(let i=0;i<4;i++){const k=((t/9000+i/4)%1),sx=x-rx+k*rx*2,band=c.createLinearGradient(sx-90,0,sx+90,0);band.addColorStop(0,'rgba(255,255,255,0)');band.addColorStop(.5,`rgba(220,245,255,${.1+.06*Math.sin(t/1300+i)})`);band.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=band;c.fillRect(sx-90,y-ry,180,ry*2);}
  c.globalCompositeOperation='source-over';
  const r=random(lake.x+3);
  for(let i=0;i<9;i++){const px=x+(r()-.5)*rx*1.5,py=y+(r()-.5)*ry*1.3,k=((t/2600)+r())%1;c.strokeStyle=`rgba(255,255,255,${.4*(1-k)})`;c.lineWidth=1.2;c.beginPath();c.ellipse(px,py,6+k*22,2+k*6,0,0,Math.PI*2);c.stroke();}
  for(let i=0;i<16;i++){const px=x+(r()-.5)*rx*1.7,py=y+(r()-.5)*ry*1.5,a=Math.max(0,Math.sin(t/(380+i*37)+i*2));if(a<.6)continue;c.fillStyle=`rgba(255,255,240,${(a-.6)*2})`;c.beginPath();c.moveTo(px-5,py);c.lineTo(px,py-1.2);c.lineTo(px+5,py);c.lineTo(px,py+1.2);c.closePath();c.fill();}
  c.strokeStyle=col.foam;c.globalAlpha=.35+.15*Math.sin(t/700);c.lineWidth=2;c.beginPath();c.ellipse(x,y+1,rx-5,ry-4,0,Math.PI*.05,Math.PI*.95);c.stroke();c.globalAlpha=1;
  c.restore();
 }
 /** The Lagoa de Cristal's water running down the channel and falling into the Poço Azul, with foam and mist. */
 private waterfall(c:CanvasRenderingContext2D,t:number){
  const {x0,x1,lip,edge,base}=FALL,w=x1-x0;
  c.save();
  const run=c.createLinearGradient(0,lip,0,edge);run.addColorStop(0,'#5fd0f0');run.addColorStop(1,'#9fe6fb');c.fillStyle=run;c.fillRect(x0,lip,w,edge-lip+2);
  const sheet=c.createLinearGradient(0,edge,0,base);sheet.addColorStop(0,'rgba(190,240,255,.95)');sheet.addColorStop(.5,'rgba(120,205,240,.9)');sheet.addColorStop(1,'rgba(230,250,255,.95)');
  c.fillStyle=sheet;c.beginPath();c.moveTo(x0-2,edge);c.quadraticCurveTo(x0-4,edge+10,x0-8,base);c.lineTo(x1+8,base);c.quadraticCurveTo(x1+4,edge+10,x1+2,edge);c.closePath();c.fill();
  c.save();c.clip();c.lineCap='round';
  for(let i=0;i<22;i++){const sx=x0-6+(i*13.7)%(w+12),len=26+(i*17)%30,speed=.32+(i%5)*.05,yy=edge+((t*speed+i*61)%(base-edge+len))-len;c.strokeStyle=i%3?'rgba(255,255,255,.55)':'rgba(70,160,210,.45)';c.lineWidth=i%3?2:3;c.beginPath();c.moveTo(sx,yy);c.lineTo(sx,yy+len);c.stroke();}
  c.restore();
  // The lip where it pours over, and the foam and mist at the bottom.
  c.fillStyle='rgba(255,255,255,.85)';c.beginPath();c.ellipse((x0+x1)/2,edge+2,w/2+3,5,0,0,Math.PI*2);c.fill();
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2+t/900,k=(t/700+i/14)%1,fx=(x0+x1)/2+Math.cos(a)*(w*.5+k*18),fy=base+2+Math.sin(a)*6-k*10;c.fillStyle=`rgba(255,255,255,${.85*(1-k)})`;c.beginPath();c.arc(fx,fy,4+k*5,0,Math.PI*2);c.fill();}
  const mist=c.createRadialGradient((x0+x1)/2,base,4,(x0+x1)/2,base,90);mist.addColorStop(0,'rgba(255,255,255,.7)');mist.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=mist;c.fillRect((x0+x1)/2-90,base-90,180,180);
  c.restore();
 }
 /** Spots free to fish glow softly on the ground; the lake under the pointer glows more. */
 drawSpots(c:CanvasRenderingContext2D,t:number,taken:Set<string>,hoverLake:string|null){
  for(const spot of FISHING_SPOTS){if(taken.has(spot.id))continue;const on=hoverLake===spot.lake,a=(on?.75:.3)+Math.sin(t/500+spot.x)*.1;
   c.save();c.strokeStyle=`rgba(255,236,150,${a})`;c.lineWidth=on?3:2;c.beginPath();c.ellipse(spot.x,spot.y+4,22,7,0,0,Math.PI*2);c.stroke();
   c.fillStyle=`rgba(255,236,150,${a*.25})`;c.fill();c.restore();}
 }
 /** Painted pieces, stations included, sorted with the walkers by their base. */
 sprites(t:number,hover:string|null,camX:number,camY:number){
  const list:{y:number;draw:(c:CanvasRenderingContext2D)=>void}[]=[];
  for(const p of this.placed){const size=FISHING_PROPS[p.id],k=p.scale??1,w=size.w*k,h=size.h*k;
   if(p.x+w/2<camX-20||p.x-w/2>camX+VIEW_W+20||p.y<camY-10||p.y-h>camY+VIEW_H)continue;
   list.push({y:p.y,draw:c=>{const image=this.art.get(p.id);if(!image)return;c.save();if(p.flip){c.translate(p.x*2,0);c.scale(-1,1);}drawScaled(c,image,p.x-w/2,p.y-h,w,h);c.restore();}});}
  for(const s of FISHING_STATIONS)list.push({y:s.id==='casa'?s.y-60:s.y,draw:c=>this.station(c,s,t,hover===s.id)});
  return list;
 }
 private station(c:CanvasRenderingContext2D,s:FishingStation,t:number,hover:boolean){
  const image=this.art.get(s.id==='casa'?'gazebo':'airship');if(!image)return;
  const bob=s.id==='airship'?Math.sin(t/900)*5:0;
  c.save();
  if(s.id==='airship'){
   // The gangway from the quay to the airship's deck.
   c.fillStyle='#8a5629';c.strokeStyle='#3a2410';c.lineWidth=2;c.beginPath();c.moveTo(s.x-26,CAIS.y1-2);c.lineTo(s.x+26,CAIS.y1-2);c.lineTo(s.x+22,s.y-s.height*.32+bob);c.lineTo(s.x-22,s.y-s.height*.32+bob);c.closePath();c.fill();c.stroke();
   for(let k=.15;k<1;k+=.18){const yy=CAIS.y1-2+(s.y-s.height*.32+bob-CAIS.y1+2)*k;c.strokeStyle='rgba(58,36,16,.6)';c.beginPath();c.moveTo(s.x-24,yy);c.lineTo(s.x+24,yy);c.stroke();}
  }
  if(hover)c.filter='brightness(1.1) drop-shadow(0 0 10px #fff2a0)';
  drawScaled(c,image,s.x-s.width/2,s.y-s.height+bob,s.width,s.height);
  c.restore();
 }
 drawFront(c:CanvasRenderingContext2D,t:number,hover:string|null,camX:number,camY:number){
  // Clouds drifting under the island, in front of everything.
  if(camY+VIEW_H>CLOUDS_TOP){const r=random(5);
   for(let i=0;i<46;i++){const base=r()*W,speed=4+r()*6,x=((base+t/1000*speed)%(W+300))-150,y=CLOUDS_TOP+18+r()*40,s=50+r()*70;if(x+s<camX||x-s>camX+VIEW_W)continue;
    const g=c.createRadialGradient(x,y,s*.1,x,y,s);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.6,'rgba(250,253,255,.7)');g.addColorStop(1,'rgba(240,250,255,0)');c.fillStyle=g;c.beginPath();c.ellipse(x,y,s,s*.45,0,0,Math.PI*2);c.fill();}}
  for(const s of FISHING_STATIONS){const top=s.y-s.height-(s.id==='casa'?-10:16);if(top>camY-40&&top<camY+VIEW_H)plaque(c,s.title,s.x,top,true,hover===s.id);}
 }
 drawOverlay(c:CanvasRenderingContext2D,t:number){
  for(let i=0;i<18;i++){const x=(i*137+t*.012)%VIEW_W,y=140+(i*71)%460+Math.sin(t/1300+i)*15;c.fillStyle=`rgba(255,255,230,${.22+Math.sin(t/800+i)*.16})`;c.beginPath();c.arc(x,y,1.4+i%2,0,Math.PI*2);c.fill();}
 }
 hit(x:number,y:number):FishingHit|null{
  for(const station of FISHING_STATIONS){const half=station.width*.36,top=station.y-station.height*(station.id==='casa'?.95:.9),bottom=station.id==='casa'?station.y-60:station.y;if(x>=station.x-half&&x<=station.x+half&&y>=top&&y<=bottom)return {kind:'station',station};}
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
