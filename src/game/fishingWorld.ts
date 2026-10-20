/**
 * Pescaria: the fishing zone next to Praça Celeste (docs/fishing.md), a terraced garden on a sky
 * island three screens wide and three tall; the camera follows the player both ways.
 *
 * Depth, back to front: the painted sky (parallax both ways); baked once into tiles, the lawns of the
 * two upper terraces and the quay's stone, the retaining walls, the stairs, the waterfall and the ponds
 * sunk into the grass with the island, the bridge and the pier; then the moving water, the boat and
 * the shadows; then, sorted with the walkers by their feet, trees, buildings, lanterns, the Casa de
 * Pesca and the airship back to the plaza; clouds drift under the island at the very front.
 *
 * Everything was painted by Codex for the Pescaria (public/assets/fishing/source/, cut by
 * `npm run build:fishing`) except the balustrades, lamps, cypresses and airship, which come from the
 * plaza, and the quay's floor, the plaza's own.
 */
import {FISHING_AIRSHIP,FISHING_HEIGHT,FISHING_ISLAND,FISHING_LAKES,FISHING_PIERS,FISHING_SPOTS,FISHING_STAIRS,FISHING_TERRACES,FISHING_WIDTH,FISH_BY_ID,POND_ART,fishingBlocked,pondPlace,stairPlace,terraceAt} from '../../shared/fishing';
import type {FishingLake,FishingPose,FishingSpot} from '../../shared/fishing';
import {FISHING_PROPS} from '../../shared/generated/fishingProps';
import type {FishingPropId} from '../../shared/generated/fishingProps';
import {drawScaled,imageReady,screenScale} from './spriteCache';
import {plaque} from './lobbyWorld';

const VIEW_W=1536,VIEW_H=864,W=FISHING_WIDTH,H=FISHING_HEIGHT;
/** Where the baked ground starts (the top balustrade's lamps reach this high). */
const GROUND_TOP=560;
/** Width of one baked ground tile (world px). */
const TILE=768;
/** How far the sky moves for each px the camera moves, across and up and down. */
const SKY_X=.12,SKY_Y=.2;
/** World px of one repeat of the lawn texture (it is seen from above at an angle: a little squashed). */
const GRASS=520,GRASS_SQUASH=.72;
const [MIRANTE,JARDIM,CAIS]=FISHING_TERRACES;
/** The front wall under each terrace: from just behind its edge (the painted grass lip) down to the next terrace or the clouds. */
const WALLS=[{top:MIRANTE.y1-40,bottom:JARDIM.y0+10},{top:JARDIM.y1-40,bottom:CAIS.y0+10},{top:CAIS.y1-40,bottom:CAIS.y1+150}];
const CLOUDS_TOP=CAIS.y1+90;
/** The hot spring overflows down the top wall toward the Poço Azul. */
const CASCADE={x:3300,y:MIRANTE.y1-24};
/** Gap in the quay's balustrade for the airship's gangway. */
const GANGWAY={x0:FISHING_AIRSHIP.x-60,x1:FISHING_AIRSHIP.x+60};
const PONDS=FISHING_LAKES.map(lake=>({lake,...pondPlace(lake)}));
const STAIRS=FISHING_STAIRS.map(stairPlace);
const [BRIDGE,PIER]=FISHING_PIERS;
/** Pieces that cast a leaning shadow of their own outline (the light comes from the right); squashed onto the floor and leaning left, like the plaza's. */
const CASTS=new Set<string>(['willow','cherry','cypress-pair','pagoda','stall','bait-kiosk','deck-umbrella','arch','paper-lantern','hydrangea','urn-pillar','lamp-pillar','fishing-house','lake-sign','reeds','fish-basket','bait-bucket']);
const CAST_SQUASH=.24,CAST_LEAN=.6,CAST_PAD=.08;

export type FishingAction='shop'|'plaza';
export interface FishingStation {id:'casa'|'airship';title:string;x:number;y:number;width:number;height:number;action:FishingAction;}
/** Things to click: the Casa de Pesca on the quay, and the airship back to the plaza (feet at the bottom centre). */
export const FISHING_STATIONS:FishingStation[]=[
 {id:'casa',title:'Casa de Pesca',x:2300,y:2390,width:FISHING_PROPS['fishing-house'].w,height:FISHING_PROPS['fishing-house'].h,action:'shop'},
 {id:'airship',title:'Praça Celeste',x:FISHING_AIRSHIP.x,y:FISHING_AIRSHIP.y+60,width:FISHING_PROPS.airship.w,height:FISHING_PROPS.airship.h,action:'plaza'},
];
/** What a click means: a station, or a pond (walk to its nearest free spot). */
export type FishingHit={kind:'station';station:FishingStation}|{kind:'lake';lake:FishingLake};

/** Small deterministic generator, so the garden never shimmers between reloads. */
function random(seed:number){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/** A painted piece placed in the world by its base (bottom centre). */
interface Prop {id:FishingPropId;x:number;y:number;flip?:boolean;scale?:number;}
/** Flat pieces baked into the ground: grass borders and patches, stepping stones and tufts. */
function lawn():Prop[]{
 const list:Prop[]=[],r=random(11);
 // A thick grass border along the foot of every wall and along the back of the top terrace.
 const strip=FISHING_PROPS['grass-strip'];
 for(const y of [MIRANTE.y0+40,JARDIM.y0+44])for(let x=-80;x<W+strip.w;x+=strip.w*.9)list.push({id:'grass-strip',x,y,flip:r()<.5});
 // Stepping stones from each stair's landing into the garden.
 for(const s of STAIRS)list.push({id:'stone-trail',x:s.bottom.x+(s.flip?-120:120),y:s.bottom.y+50,scale:.8,flip:s.flip});
 // Patches of lighter grass and flowering tufts scattered on the lawns, kept out of the water.
 const dry=(x:number,y:number)=>!PONDS.some(p=>((x-p.lake.x)/(p.w*.55))**2+((y-p.lake.y)/(p.h*.62))**2<1);
 for(const t of [MIRANTE,JARDIM]){
  for(let n=0;n<16;n++){const x=t.x0+r()*(t.x1-t.x0),y=t.y0+90+r()*(t.y1-t.y0-140);if(!dry(x,y))continue;list.push({id:(['grass-patch','grass-patch-2','grass-patch-3'] as const)[n%3],x,y,flip:r()<.5,scale:.8+r()*.3});}
  for(let n=0;n<70;n++){const x=t.x0+r()*(t.x1-t.x0),y=t.y0+70+r()*(t.y1-t.y0-90);if(!dry(x,y))continue;list.push({id:(['tuft-1','tuft-2','tuft-3'] as const)[n%3],x,y,flip:r()<.5,scale:.7+r()*.4});}
 }
 return list;
}
/** Standing pieces, sorted with the walkers by their base. */
function props():Prop[]{
 const list:Prop[]=[];
 // Trees (their trunks are obstacles in shared/fishingMap.ts) and cypresses framing the sides.
 list.push({id:'willow',x:500,y:912},{id:'cherry',x:2700,y:942,flip:true},{id:'willow',x:4150,y:942,flip:true},
  {id:'willow',x:420,y:1572},{id:'cherry',x:2760,y:1492,flip:true},{id:'cherry',x:3000,y:1992},
  {id:'cherry',x:FISHING_ISLAND.x+10,y:FISHING_ISLAND.y-4,scale:.62});
 for(const [x,y] of [[40,800],[4570,800],[30,1400],[4580,1400],[60,2280],[4560,2280]] as const)list.push({id:'cypress-pair',x,y,flip:x>W/2});
 // The lookout on the top terrace.
 list.push({id:'pagoda',x:2250,y:1002});
 // Around each pond: its name on a sign, a basket and a bucket, flowers, rocks and a lantern.
 for(const p of PONDS){const {lake,block}=p,r=random(lake.x),front=lake.y+block.ry+30;
  list.push({id:'lake-sign',x:lake.x-block.rx*.78,y:front-10});
  list.push({id:'fish-basket',x:lake.x+block.rx*.95,y:lake.y+block.ry*.55+26,scale:.9},{id:'bait-bucket',x:lake.x-block.rx*.97,y:lake.y+block.ry*.5+24,scale:.85});
  list.push({id:r()<.5?'hydrangea':'flower-bed',x:lake.x+block.rx*.62,y:front+8,scale:.8},{id:'paper-lantern',x:lake.x-block.rx-50,y:lake.y-6,scale:.8});
  if(lake.id!=='juncos')list.push({id:'reeds',x:lake.x+block.rx*.98,y:lake.y-block.ry*.2,scale:.75,flip:true});
 }
 // Lanterns at both ends of the bridge.
 list.push({id:'paper-lantern',x:BRIDGE.x1+16,y:BRIDGE.y0-4,scale:.7},{id:'paper-lantern',x:BRIDGE.x0-6,y:BRIDGE.y0-6,scale:.6});
 // Flower beds and low hedges along the foot of the walls.
 for(const x of [700,1900,2350,3700,4300])list.push({id:'flower-bed',x,y:JARDIM.y0+30,scale:.85});
 for(const x of [300,1650,3000,4250])list.push({id:'flower-bed',x,y:CAIS.y0+24,scale:.85});
 for(const x of [1050,3000,3650])list.push({id:'hedge-low',x,y:MIRANTE.y0+60,scale:.9});
 // The quay: stall, Casa de Pesca (a station), bait kiosk, a deck with a parasol and the arch to the airship.
 list.push({id:'stall',x:1150,y:2370},{id:'bait-kiosk',x:3350,y:2370},{id:'deck-umbrella',x:3900,y:2390},{id:'arch',x:785,y:2380});
 list.push({id:'paper-lantern',x:1500,y:2350,scale:.85},{id:'paper-lantern',x:2950,y:2350,scale:.85},{id:'hydrangea',x:1700,y:2410,scale:.8},{id:'hydrangea',x:3100,y:2410,scale:.8},{id:'fish-basket',x:1340,y:2400},{id:'bait-bucket',x:3540,y:2400});
 // The quay's balustrade over the clouds, open at the airship's gangway.
 const run=FISHING_PROPS.balustrade.w*.8;
 for(let x=run/2-20;x<W+run;x+=run)if(x+run/2<GANGWAY.x0||x-run/2>GANGWAY.x1)list.push({id:'balustrade',x,y:CAIS.y1+16,scale:.8});
 for(let x=-20,n=0;x<W+run;x+=run,n++)if(x<GANGWAY.x0-20||x>GANGWAY.x1+20)list.push({id:n%3===2?'lamp-pillar':'urn-pillar',x,y:CAIS.y1+20,scale:.8});
 // Urns at the top of every stair.
 for(const s of STAIRS)list.push({id:'urn-pillar',x:s.top.x+(s.flip?42:-42),y:s.top.y+4,scale:.6},{id:'urn-pillar',x:s.top.x+(s.flip?-42:42),y:s.top.y+4,scale:.6});
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

export class FishingWorld {
 private sky=new Image();private floor=new Image();private grass=new Image();private art=new Map<FishingPropId,HTMLImageElement>();
 private tiles=new Map<number,HTMLCanvasElement>();private tileScale=0;private assets=false;
 private placed=props();private flat=lawn();private casts=new Map<FishingPropId,HTMLCanvasElement>();
 load(){
  if(this.assets)return;this.assets=true;
  this.sky=new Image();this.sky.decoding='async';this.sky.src='/assets/fishing/sky.webp';
  this.floor=new Image();this.floor.src='/assets/lobby/floor.webp';
  this.grass=new Image();this.grass.src='/assets/fishing/grass.webp';
  for(const id of Object.keys(FISHING_PROPS) as FishingPropId[]){const image=new Image();image.decoding='async';image.src=`/assets/fishing/props/${id}.webp`;this.art.set(id,image);}
 }
 release(){if(!this.assets)return;this.assets=false;this.art.clear();this.tiles.clear();this.casts.clear();this.sky=new Image();this.floor=new Image();this.grass=new Image();}
 get isLoaded(){return this.assets;}
 /** True once everything on screen can be painted without a gap. */
 ready(_scale:number){return this.assets&&imageReady(this.sky)&&imageReady(this.floor)&&imageReady(this.grass)&&[...this.art.values()].every(imageReady);}
 /** Camera that keeps the player a little below the middle (they are tall), never past the island's edges. */
 static camera(focusX:number,focusY:number){return {x:Math.max(0,Math.min(W-VIEW_W,focusX-VIEW_W/2)),y:Math.max(0,Math.min(H-VIEW_H,focusY-VIEW_H*.6))};}
 /** The sky fills the view and slides a little as the camera moves. */
 private drawSky(c:CanvasRenderingContext2D,camX:number,camY:number){
  const iw=this.sky.naturalWidth,ih=this.sky.naturalHeight,k=Math.max((VIEW_W+(W-VIEW_W)*SKY_X)/iw,(VIEW_H+(H-VIEW_H)*SKY_Y)/ih);
  drawScaled(c,this.sky,camX-camX*SKY_X,camY-camY*SKY_Y,iw*k,ih*k);
 }
 /** Back of the scene, in world coordinates (the caller has translated by the camera). */
 drawBack(c:CanvasRenderingContext2D,t:number,camX:number,camY:number){
  if(!this.ready(1)){c.fillStyle='#9ed4e8';c.fillRect(camX,camY,VIEW_W,VIEW_H);return;}
  c.save();c.imageSmoothingQuality='low';
  this.drawSky(c,camX,camY);
  const scale=Math.min(1.5,Math.max(1,Math.ceil(screenScale(c)*4)/4));
  if(scale!==this.tileScale){this.tiles.clear();this.tileScale=scale;}
  for(let n=Math.floor(camX/TILE);n*TILE<camX+VIEW_W;n++){const tile=this.tile(n);if(!tile)continue;
   const y0=Math.max(GROUND_TOP,camY),y1=Math.min(H,camY+VIEW_H);if(y1>y0)c.drawImage(tile,0,(y0-GROUND_TOP)*scale,tile.width,(y1-y0)*scale,n*TILE,y0,TILE,y1-y0);}
  this.cascade(c,t,camX,camY);
  for(const p of PONDS)if(p.x+p.w>camX&&p.x<camX+VIEW_W&&p.y+p.h>camY&&p.y<camY+VIEW_H)this.water(c,p.lake,t);
  // The rowboat moored on the lilies, bobbing.
  const lily=FISHING_LAKES[0],boat=FISHING_PROPS.rowboat,bob=Math.sin(t/1100)*2;
  if(lily.x-lily.rx<camX+VIEW_W&&lily.y>camY-200&&lily.y<camY+VIEW_H+200)drawScaled(c,this.art.get('rowboat')!,lily.x-lily.rx*.15-boat.w/2,lily.y-boat.h*.55+bob,boat.w,boat.h);
  this.shadows(c,camX,camY);
  c.restore();
 }
 /** One baked column of the ground: lawns, quay, walls, stairs, ponds and the top balustrade (the clouds below stay clear). */
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
  this.balustradeRow(g,x0,x1,MIRANTE.y0+8);
  // Lawns on the two upper terraces, the plaza's stone on the quay; a shadow under the wall behind each.
  const grass=g.createPattern(this.grass,'repeat')!,stone=g.createPattern(this.floor,'repeat')!,gw=this.grass.naturalWidth,tex=this.floor.naturalWidth;
  for(const t of FISHING_TERRACES){
   const top=t===MIRANTE?MIRANTE.y0-4:t.y0-10,bottom=t.y1;
   if(t===CAIS){stone.setTransform(new DOMMatrix([520/tex,0,0,520*.56/tex,0,top]));g.fillStyle=stone;}
   else{grass.setTransform(new DOMMatrix([GRASS/gw,0,0,GRASS*GRASS_SQUASH/gw,0,top]));g.fillStyle=grass;}
   g.fillRect(x0,top,x1-x0,bottom-top);
   const warm=g.createLinearGradient(0,top,0,bottom);warm.addColorStop(0,'rgba(255,240,200,.12)');warm.addColorStop(1,'rgba(60,70,30,.14)');g.fillStyle=warm;g.fillRect(x0,top,x1-x0,bottom-top);
   const back=g.createLinearGradient(0,top,0,top+60);back.addColorStop(0,'rgba(30,40,15,.45)');back.addColorStop(1,'rgba(30,40,15,0)');g.fillStyle=back;g.fillRect(x0,top,x1-x0,60);
  }
  // Grass borders, patches, stepping stones and tufts.
  for(const p of this.flat)this.piece(g,p,x0,x1);
  // The ponds, sunk into the lawn, then the island, the pier and the bridge over the lilies.
  for(const p of PONDS)if(p.x+p.w>x0&&p.x<x1){
   g.drawImage(this.art.get(POND_ART[p.lake.id].art as FishingPropId)!,p.x,p.y,p.w,p.h);}
  const i=FISHING_ISLAND;
  if(i.x+i.rx*2>x0&&i.x-i.rx*2<x1){
   const patch=FISHING_PROPS['grass-patch-2'],k=i.rx*2.3/patch.w;
   g.fillStyle='rgba(20,40,50,.35)';g.beginPath();g.ellipse(i.x+6,i.y+14,i.rx*1.12,i.ry*1.1,0,0,Math.PI*2);g.fill();
   g.drawImage(this.art.get('grass-patch-2')!,i.x-patch.w*k/2,i.y-patch.h*k*.55,patch.w*k,patch.h*k);
   const rocks=FISHING_PROPS['pond-rocks'];
   for(const [dx,dy,s] of [[-1,.55,.55],[.1,.95,.6],[.95,.45,.5],[-.5,1,.45]] as const)g.drawImage(this.art.get('pond-rocks')!,i.x+dx*i.rx-rocks.w*s/2,i.y+dy*i.ry-rocks.h*s,rocks.w*s,rocks.h*s);
  }
  // The pier out from the front shore (seen from the shore: its far end up, toward the water).
  const pier=FISHING_PROPS.pier,pk=(PIER.y1-PIER.y0+50)/pier.h;
  if(PIER.x1+pier.w>x0&&PIER.x0-pier.w<x1)g.drawImage(this.art.get('pier')!,(PIER.x0+PIER.x1)/2-pier.w*pk/2,PIER.y0-40,pier.w*pk,pier.h*pk);
  // The bridge from the island to the east shore: its deck at the walkable band.
  const bridge=FISHING_PROPS.bridge,bk=(BRIDGE.x1-BRIDGE.x0+40)/bridge.w;
  if(BRIDGE.x1+20>x0&&BRIDGE.x0-20<x1)g.drawImage(this.art.get('bridge')!,BRIDGE.x0-20,BRIDGE.y1+22-bridge.h*bk,bridge.w*bk,bridge.h*bk);
  // The painted retaining wall, side by side along every terrace front (its grass lip over the edge).
  const wall=this.art.get('wall')!,size=FISHING_PROPS.wall;
  for(const w of WALLS){const k=(w.bottom-w.top)/size.h,ww=size.w*k*.97;
   const foot=g.createLinearGradient(0,w.bottom-10,0,w.bottom+26);foot.addColorStop(0,'rgba(40,30,15,.35)');foot.addColorStop(1,'rgba(40,30,15,0)');g.fillStyle=foot;g.fillRect(x0,w.bottom-10,x1-x0,36);
   for(let x=Math.floor(x0/ww)*ww-ww*.02;x<x1;x+=ww)g.drawImage(wall,x,w.top,size.w*k,w.bottom-w.top);}
  const stair=this.art.get('stair')!;
  for(const s of STAIRS)if(s.x+s.w>x0&&s.x<x1){g.save();if(s.flip){g.translate(s.x*2+s.w,0);g.scale(-1,1);}g.drawImage(stair,s.x,s.y,s.w,s.h);g.restore();}
  const fall=FISHING_PROPS.cascade;if(CASCADE.x+fall.w/2>x0&&CASCADE.x-fall.w/2<x1)g.drawImage(this.art.get('cascade')!,CASCADE.x-fall.w/2,CASCADE.y,fall.w,fall.h);
 }
 /** One painted piece by its base, if it reaches the column. */
 private piece(g:CanvasRenderingContext2D,p:Prop,x0:number,x1:number){
  const size=FISHING_PROPS[p.id],k=p.scale??1,w=size.w*k,h=size.h*k;if(p.x+w/2<x0||p.x-w/2>x1)return;
  g.save();if(p.flip){g.translate(p.x*2,0);g.scale(-1,1);}g.drawImage(this.art.get(p.id)!,p.x-w/2,p.y-h,w,h);g.restore();
 }
 /** A row of the painted balustrade with its posts, bottom at `y`. */
 private balustradeRow(g:CanvasRenderingContext2D,x0:number,x1:number,y:number){
  const run=this.art.get('balustrade')!,urn=this.art.get('urn-pillar')!,lamp=this.art.get('lamp-pillar')!;
  const b=FISHING_PROPS.balustrade,w=b.w*.9,h=b.h*.9;
  for(let x=Math.floor((x0-w)/w)*w;x<x1+w;x+=w)g.drawImage(run,x,y-h,w,h);
  for(let x=Math.floor((x0-w)/w)*w,n=Math.floor((x0-w)/w);x<x1+w*2;x+=w,n++){const lampPost=((n%4)+4)%4===1,a=lampPost?FISHING_PROPS['lamp-pillar']:FISHING_PROPS['urn-pillar'],k=.86;
   g.drawImage(lampPost?lamp:urn,x-a.w*k/2,y+2-a.h*k,a.w*k,a.h*k);}
 }
 /** Falling water over the painted cascade: streaks running down and spray at its foot. */
 private cascade(c:CanvasRenderingContext2D,t:number,camX:number,camY:number){
  const size=FISHING_PROPS.cascade,x=CASCADE.x-size.w*.12,top=CASCADE.y+size.h*.2,bottom=CASCADE.y+size.h*.9;
  if(x+60<camX||x-60>camX+VIEW_W||bottom<camY||top>camY+VIEW_H)return;
  c.save();c.lineCap='round';
  for(let i=0;i<9;i++){const sx=x-size.w*.12+i*size.w*.03,len=18+(i*7)%16,yy=top+((t*.25+i*53)%(bottom-top));c.strokeStyle=`rgba(255,255,255,${.35+(i%3)*.12})`;c.lineWidth=1.6;c.beginPath();c.moveTo(sx,yy);c.lineTo(sx,Math.min(bottom,yy+len));c.stroke();}
  for(let i=0;i<8;i++){const k=(t/800+i/8)%1,a=i/8*Math.PI*2;c.fillStyle=`rgba(255,255,255,${.7*(1-k)})`;c.beginPath();c.arc(x+Math.cos(a)*(14+k*16),bottom+4-k*12,2+k*3,0,Math.PI*2);c.fill();}
  c.restore();
 }
 /** Moving light on a pond's surface: rings and sparkles (the picture already has its color and depth). */
 private water(c:CanvasRenderingContext2D,lake:FishingLake,t:number){
  const {x,y,rx,ry}=lake,r=random(lake.x+3);
  c.save();c.beginPath();c.ellipse(x,y,rx*.92,ry*.85,0,0,Math.PI*2);c.clip();
  for(let i=0;i<7;i++){const px=x+(r()-.5)*rx*1.4,py=y+(r()-.5)*ry*1.1,k=((t/2600)+r())%1;c.strokeStyle=`rgba(255,255,255,${.35*(1-k)})`;c.lineWidth=1.2;c.beginPath();c.ellipse(px,py,5+k*20,1.6+k*5,0,0,Math.PI*2);c.stroke();}
  for(let i=0;i<14;i++){const px=x+(r()-.5)*rx*1.6,py=y+(r()-.5)*ry*1.4,a=Math.max(0,Math.sin(t/(380+i*37)+i*2));if(a<.6)continue;c.fillStyle=`rgba(255,255,240,${(a-.6)*2})`;c.beginPath();c.moveTo(px-5,py);c.lineTo(px,py-1.2);c.lineTo(px+5,py);c.lineTo(px,py+1.2);c.closePath();c.fill();}
  if(lake.id==='termal')for(let i=0;i<6;i++){const k=(t/3200+i/6)%1,sx=x+(i-2.5)*rx*.28+Math.sin(t/900+i)*10,sy=y-k*90,s=18+k*30;const g=c.createRadialGradient(sx,sy,0,sx,sy,s);g.addColorStop(0,`rgba(255,255,255,${.22*(1-k)})`);g.addColorStop(1,'rgba(255,255,255,0)');c.restore();c.save();c.fillStyle=g;c.fillRect(sx-s,sy-s,s*2,s*2);}
  c.restore();
 }
 drawSpots(c:CanvasRenderingContext2D,t:number,taken:Set<string>,hoverLake:string|null){
  for(const spot of FISHING_SPOTS){if(taken.has(spot.id))continue;const on=hoverLake===spot.lake,a=(on?.75:.3)+Math.sin(t/500+spot.x)*.1;
   c.save();c.strokeStyle=`rgba(255,236,150,${a})`;c.lineWidth=on?3:2;c.beginPath();c.ellipse(spot.x,spot.y+4,22,7,0,0,Math.PI*2);c.stroke();
   c.fillStyle=`rgba(255,236,150,${a*.25})`;c.fill();c.restore();}
 }
 /** Shadows on the floor under every standing piece: a soft dark spot where it touches, and its outline cast to the left. */
 private shadows(c:CanvasRenderingContext2D,camX:number,camY:number){
  const pieces:{id:FishingPropId;x:number;y:number;w:number;h:number;flip?:boolean}[]=[];
  for(const p of this.placed)if(CASTS.has(p.id)){const size=FISHING_PROPS[p.id],k=p.scale??1;pieces.push({id:p.id,x:p.x,y:p.y,w:size.w*k,h:size.h*k,flip:p.flip});}
  const casa=FISHING_STATIONS[0];pieces.push({id:'fishing-house',x:casa.x,y:casa.y-20,w:casa.width,h:casa.height});
  for(const p of pieces){if(p.x+p.w*.5<camX-p.h*CAST_LEAN||p.x-p.w*.5>camX+VIEW_W||p.y<camY-40||p.y-p.h*CAST_SQUASH>camY+VIEW_H+40)continue;
   const cast=this.cast(p.id);
   c.save();c.translate(p.x,p.y);
   // Contact shadow first, darkest right under the base.
   c.save();c.scale(1,.2);const g=c.createRadialGradient(0,0,0,0,0,p.w*.42);g.addColorStop(0,'rgba(40,52,20,.42)');g.addColorStop(.6,'rgba(40,52,20,.2)');g.addColorStop(1,'rgba(40,52,20,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,p.w*.42,0,Math.PI*2);c.fill();c.restore();
   if(cast){c.transform(1,0,CAST_LEAN,CAST_SQUASH,0,0);if(p.flip)c.scale(-1,1);c.globalAlpha=.34;c.drawImage(cast,-p.w/2-CAST_PAD*p.w,-p.h-CAST_PAD*p.h,p.w*(1+2*CAST_PAD),p.h*(1+2*CAST_PAD));}
   c.restore();}
 }
 /** The piece's outline as a blurred dark shape, built once its art has loaded. */
 private cast(id:FishingPropId){
  const done=this.casts.get(id);if(done)return done;
  const image=this.art.get(id);if(!image?.complete||!image.naturalWidth)return null;
  const k=.25,w=Math.max(8,Math.round(image.naturalWidth*k)),h=Math.max(8,Math.round(image.naturalHeight*k)),pw=Math.round(w*CAST_PAD),ph=Math.round(h*CAST_PAD);
  const shape=document.createElement('canvas');shape.width=w+2*pw;shape.height=h+2*ph;const s=shape.getContext('2d')!;
  s.drawImage(image,pw,ph,w,h);s.globalCompositeOperation='source-in';s.fillStyle='#24300f';s.fillRect(0,0,shape.width,shape.height);
  const blurred=document.createElement('canvas');blurred.width=shape.width;blurred.height=shape.height;const b=blurred.getContext('2d')!;
  b.filter='blur(4px)';b.drawImage(shape,0,0);
  this.casts.set(id,blurred);return blurred;
 }
 /** Standing pieces and stations, sorted with the walkers by their base. */
 sprites(t:number,hover:string|null,camX:number,camY:number){
  const list:{y:number;draw:(c:CanvasRenderingContext2D)=>void}[]=[];
  const seen=(x0:number,x1:number,y0:number,y1:number)=>x1>camX-20&&x0<camX+VIEW_W+20&&y1>camY-10&&y0<camY+VIEW_H+10;
  for(const p of this.placed){const size=FISHING_PROPS[p.id],k=p.scale??1,w=size.w*k,h=size.h*k;
   if(!seen(p.x-w/2,p.x+w/2,p.y-h,p.y))continue;
   list.push({y:p.y,draw:c=>{const image=this.art.get(p.id);if(!image)return;c.save();if(p.flip){c.translate(p.x*2,0);c.scale(-1,1);}drawScaled(c,image,p.x-w/2,p.y-h,w,h);c.restore();
    if(p.id==='lake-sign'){const pond=PONDS.find(q=>Math.abs(q.lake.x-q.block.rx*.78-p.x)<1);if(pond)this.signText(c,pond.lake.name,p.x,p.y-h*.66,w*.8);}}});}
  for(const s of FISHING_STATIONS)list.push({y:s.id==='casa'?s.y-20:s.y,draw:c=>this.station(c,s,t,hover===s.id)});
  return list;
 }
 /** The pond's name written on its painted sign. */
 private signText(c:CanvasRenderingContext2D,text:string,x:number,y:number,width:number){
  c.save();const words=text.split(' '),lines=words.length>2?[words.slice(0,Math.ceil(words.length/2)).join(' '),words.slice(Math.ceil(words.length/2)).join(' ')]:[text];
  c.font='900 10px Nunito, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#4a2a10';
  const size=Math.min(11,Math.min(...lines.map(l=>width/c.measureText(l).width*10)));c.font=`900 ${size}px Nunito, sans-serif`;
  lines.forEach((line,i)=>c.fillText(line,x,y+(i-(lines.length-1)/2)*size*1.05));c.restore();
 }
 private station(c:CanvasRenderingContext2D,s:FishingStation,t:number,hover:boolean){
  const image=this.art.get(s.id==='casa'?'fishing-house':'airship');if(!image)return;
  const bob=s.id==='airship'?Math.sin(t/900)*5:0;
  c.save();
  if(s.id==='airship'){
   // The mooring dock out over the clouds, and the gangway up to the airship's deck.
   const dock=FISHING_PROPS.dock;drawScaled(c,this.art.get('dock')!,s.x+30-dock.w/2,CAIS.y1+110-dock.h,dock.w,dock.h);
   c.fillStyle='#8a5629';c.strokeStyle='#3a2410';c.lineWidth=2;c.beginPath();c.moveTo(s.x-26,CAIS.y1-2);c.lineTo(s.x+26,CAIS.y1-2);c.lineTo(s.x+22,s.y-s.height*.32+bob);c.lineTo(s.x-22,s.y-s.height*.32+bob);c.closePath();c.fill();c.stroke();
  }
  if(hover)c.filter='brightness(1.1) drop-shadow(0 0 10px #fff2a0)';
  drawScaled(c,image,s.x-s.width/2,s.y-s.height+bob,s.width,s.height);
  c.restore();
 }
 drawFront(c:CanvasRenderingContext2D,t:number,hover:string|null,camX:number,camY:number){
  // Clouds drifting under the island, in front of everything.
  if(camY+VIEW_H>CLOUDS_TOP){const r=random(5);
   for(let i=0;i<46;i++){const base=r()*W,speed=4+r()*6,x=((base+t/1000*speed)%(W+300))-150,y=CLOUDS_TOP+18+r()*60,s=60+r()*80;if(x+s<camX||x-s>camX+VIEW_W)continue;
    const g=c.createRadialGradient(x,y,s*.1,x,y,s);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.6,'rgba(250,253,255,.7)');g.addColorStop(1,'rgba(240,250,255,0)');c.fillStyle=g;c.beginPath();c.ellipse(x,y,s,s*.45,0,0,Math.PI*2);c.fill();}}
  for(const s of FISHING_STATIONS){const top=s.y-s.height-16;if(top>camY-40&&top<camY+VIEW_H)plaque(c,s.title,s.x,top,true,hover===s.id);}
 }
 drawOverlay(c:CanvasRenderingContext2D,t:number){
  for(let i=0;i<18;i++){const x=(i*137+t*.012)%VIEW_W,y=140+(i*71)%460+Math.sin(t/1300+i)*15;c.fillStyle=`rgba(255,255,230,${.22+Math.sin(t/800+i)*.16})`;c.beginPath();c.arc(x,y,1.4+i%2,0,Math.PI*2);c.fill();}
 }
 hit(x:number,y:number):FishingHit|null{
  // A tall building pokes over the terrace above it: clicks on that terrace's floor still walk.
  const floor=terraceAt(x,y);
  for(const station of FISHING_STATIONS){if(floor&&floor.y1<station.y-150)continue;const half=station.width*.4,top=station.y-station.height*.92,bottom=station.y-20;if(x>=station.x-half&&x<=station.x+half&&y>=top&&y<=bottom)return {kind:'station',station};}
  // The island, the bridge and the pier are floor: a click there walks.
  if(!fishingBlocked(x,y))return null;
  const pond=PONDS.find(p=>((x-p.lake.x)/(p.lake.rx+20))**2+((y-p.lake.y)/(p.lake.ry+16))**2<1||((x-p.lake.x)/p.block.rx)**2+((y-p.lake.y)/p.block.ry)**2<1);
  return pond?{kind:'lake',lake:pond.lake}:null;
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
