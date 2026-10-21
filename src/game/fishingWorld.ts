/**
 * Pescaria: the fishing zone next to Praça Celeste (docs/fishing.md), a terraced garden on a sky
 * island three screens wide and three tall; the camera follows the player both ways.
 *
 * Depth, back to front: the painted sky (parallax both ways); baked once into tiles, the lawns of the
 * two upper terraces and the quay's stone, the retaining walls, the stairs, the ponds sunk into the
 * grass and every flat piece of the layout (island, pier, bridge, cascade, tufts); then the moving
 * water, the floating pieces (boat, lily pads) and the shadows; then, sorted with the walkers by their
 * feet, the standing pieces, the Casa de Pesca and the airship back to the plaza; clouds drift under
 * the island at the very front.
 *
 * What stands where comes from the layout in shared/fishingMap.ts (edited in /admin/mapas/pescaria);
 * the world rebuilds itself when it changes. Everything was painted by Codex for the Pescaria
 * (public/assets/fishing/source/, cut by `npm run build:fishing`) except the balustrades, lamps,
 * cypresses and airship, which come from the plaza, and the quay's floor, the plaza's own.
 */
import {view} from './viewport';
import {FISHING_AIRSHIP,FISHING_HEIGHT,FISHING_ITEMS,FISHING_LAKES,FISHING_STAIRS,FISHING_TERRACES,FISHING_WIDTH,FISH_BY_ID,fishingBlocked,fishingLayoutVersion,isWalkway,itemPoint,itemSize,deckOf,pondPlace,stairPlace,terraceAt} from '../../shared/fishing';
import type {FishingItem,FishingLake,FishingPose,FishingSpot} from '../../shared/fishing';
import {FISHING_PROPS} from '../../shared/generated/fishingProps';
import type {FishingPropId} from '../../shared/generated/fishingProps';
import {ROD_FRAMES,SPLASHES} from '../../shared/generated/fishingFx';
import type {RodFrame} from '../../shared/generated/fishingFx';
import {drawScaled,freeAll,freeImage,freeSurface,imageReady,resizedBitmap,screenScale,visibleArea} from './spriteCache';
import {plaque,releaseStamps} from './lobbyWorld';

const VIEW_H=864,W=FISHING_WIDTH,H=FISHING_HEIGHT;

/** Width of one baked ground tile (world px). */
const TILE=768;
/** How far the sky moves for each px the camera moves, across and up and down. */
const SKY_X=.12,SKY_Y=.2;
/** World px of one repeat of the lawn texture (it is seen from above at an angle: a little squashed). */
const GRASS=520,GRASS_SQUASH=.72;
/** World px of one repeat of the moving water, and how strongly it shows over each painted pond. */
const WATER=300,WATER_SQUASH=.55,WATER_ALPHA=.38;
/** How often the ponds' moving surface is repainted (ms): 20 times a second, steps under a pixel. */
const WATER_FRAME_MS=50;
const [MIRANTE,JARDIM,CAIS]=FISHING_TERRACES;
/** Where the baked ground starts (the top balustrade's lamps reach this high). */
const GROUND_TOP=MIRANTE.y0-140;
/** The front wall under each terrace: from just behind its edge (the painted grass lip) down to the next terrace or the clouds. */
const WALLS=[{top:MIRANTE.y1-40,bottom:JARDIM.y0+10},{top:JARDIM.y1-40,bottom:CAIS.y0+10},{top:CAIS.y1-40,bottom:CAIS.y1+150}];
const CLOUDS_TOP=CAIS.y1+90;
/** Pieces that cast a leaning shadow of their own outline (the light comes from the right); squashed onto the floor and leaning left, like the plaza's. */
const CASTS=new Set<string>(['willow','cherry','cypress-pair','pagoda','stall','bait-kiosk','deck-umbrella','arch','paper-lantern','hydrangea','urn-pillar','lamp-pillar','fishing-house','lake-sign','reeds','fish-basket','bait-bucket']);
const CAST_SQUASH=.24,CAST_LEAN=.6,CAST_PAD=.08;
/** Drawn length of the rod (grip to tip at rest) per px of the player's height. */
const ROD_LENGTH=.82;
/** Cast timing (ms from the cast): the frames of the swing, then the float flies until it lands. */
const SWING=[['windup',150],['overhead',300],['whip',420],['release',600]] as const,LAND_MS=820;

export type FishingAction='shop'|'plaza';
export interface FishingStation {id:'casa'|'airship';title:string;x:number;y:number;width:number;height:number;action:FishingAction;}
/** Things to click: the Casa de Pesca on the quay, and the airship back to the plaza (feet at the bottom centre). */
export const FISHING_STATIONS:FishingStation[]=[];
function placeStations(){
 FISHING_STATIONS.splice(0,FISHING_STATIONS.length,
  {id:'airship',title:'Praça Celeste',x:FISHING_AIRSHIP.x,y:FISHING_AIRSHIP.y+60,width:FISHING_PROPS.airship.w,height:FISHING_PROPS.airship.h,action:'plaza'});
}
placeStations();
/** What a click means: a station, or a pond (walk to its nearest free spot). */
export type FishingHit={kind:'station';station:FishingStation}|{kind:'lake';lake:FishingLake};

/** Small deterministic generator, so the garden never shimmers between reloads. */
function random(seed:number){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/** A piece the world draws: the layout's, plus the ones that follow the terraces, stairs and airship. */
type Piece=FishingItem&{prop:FishingPropId};
/** Pieces that belong to the terraces and stairs (not edited one by one): grass borders, stepping stones, the quay's balustrade and the stair urns. */
function fixedPieces():Piece[]{
 const list:Piece[]=[],r=random(11);let n=0;
 const add=(prop:FishingPropId,x:number,y:number,more:Partial<FishingItem>={})=>{list.push({id:`fixo-${n++}`,x,y,layer:'stand',...more,prop});};
 const strip=FISHING_PROPS['grass-strip'];
 for(const y of [MIRANTE.y0+40,JARDIM.y0+44])for(let x=-80;x<W+strip.w;x+=strip.w*.9)add('grass-strip',x,y,{layer:'ground',flip:r()<.5});
 const stairs=FISHING_STAIRS.map(stairPlace);
 for(const s of stairs)if(!s.front)add('stone-trail',s.bottom.x+(s.flip?-120:120),s.bottom.y+50,{layer:'ground',scale:.8,flip:s.flip});
 // The quay's balustrade over the clouds, open at the airship's gangway.
 const gap={x0:FISHING_AIRSHIP.x-60,x1:FISHING_AIRSHIP.x+60},run=FISHING_PROPS.balustrade.w*.8;
 for(let x=run/2-20;x<W+run;x+=run)if(x+run/2<gap.x0||x-run/2>gap.x1)add('balustrade',x,CAIS.y1+16,{scale:.8});
 for(let x=-20,k=0;x<W+run;x+=run,k++)if(x<gap.x0-20||x>gap.x1+20)add(k%3===2?'lamp-pillar':'urn-pillar',x,CAIS.y1+20,{scale:.8});
 // Side stairs get urns at the top; the front ones have their own painted balustrade.
 for(const s of stairs)if(!s.front){add('urn-pillar',s.top.x+(s.flip?42:-42),s.top.y+4,{scale:.6});add('urn-pillar',s.top.x+(s.flip?-42:42),s.top.y+4,{scale:.6});}
 return list;
}

/** Painted fish icons (public/assets/fishing/icons, painted facing left), loaded on first use. */
const paintedFish=new Map<string,HTMLImageElement>();
function fishArt(id:string){
 if(typeof Image==='undefined')return null;
 let image=paintedFish.get(id);if(!image){image=new Image();image.src=`/assets/fishing/icons/${id}.png`;paintedFish.set(id,image);}
 return image.complete&&image.naturalWidth?image:null;
}
/** A fish seen from the side, nose toward +x: the painted icon, or a drawn stand-in while it loads or has no art. */
export function drawFish(c:CanvasRenderingContext2D,id:string,x:number,y:number,length:number,angle=0,alpha=1){
 const art=fishArt(id);
 if(art){const size=length*1.12;c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(angle);c.scale(-1,1);c.drawImage(art,-size/2,-size/2,size,size);c.restore();return;}
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
/** One cloud puff painted once and stretched: 46 gradient fills every frame cost more than the rest of the scene. */
let puff:HTMLCanvasElement|null=null;
function cloudPuff(){
 if(puff)return puff;puff=document.createElement('canvas');puff.width=256;puff.height=116;const g=puff.getContext('2d')!;g.scale(1,.45);
 const fill=g.createRadialGradient(128,128,12.8,128,128,128);fill.addColorStop(0,'rgba(255,255,255,.95)');fill.addColorStop(.6,'rgba(250,253,255,.7)');fill.addColorStop(1,'rgba(240,250,255,0)');
 g.fillStyle=fill;g.beginPath();g.ellipse(128,128,128,128,0,0,Math.PI*2);g.fill();return puff;
}
/** Cloud puffs under the island, as [x, y, size, speed] (world px, px/s). */
const CLOUD_PUFFS=(()=>{const r=random(5);return Array.from({length:46},()=>{const base=r()*W,speed=4+r()*6,y=CLOUDS_TOP+18+r()*60,s=60+r()*80;return [base,y,s,speed] as const;});})();
/** The puffs in three bands of close speeds, each band painted once into a strip that wraps every W+300 px. */
const CLOUD_SPEEDS=[5,7,9],CLOUD_WRAP=W+300,CLOUD_TOP=CLOUDS_TOP-50,CLOUD_HEIGHT=200;
function shade(hex:string,k:number){const n=parseInt(hex.slice(1),16),f=(v:number)=>Math.round(k>0?v+(255-v)*k:v*(1+k));return `rgb(${f(n>>16&255)},${f(n>>8&255)},${f(n&255)})`;}

export class FishingWorld {
 private sky=new Image();private floor=new Image();private grass=new Image();private water=new Image();private rod=new Image();private autoSeal=new Image();private splash={bait:new Image(),catch:new Image()};
 private art=new Map<FishingPropId,HTMLImageElement>();
 private tiles=new Map<number,HTMLCanvasElement>();private tileScale=0;private assets=false;private casts=new Map<FishingPropId,HTMLCanvasElement>();
 private clouds:HTMLCanvasElement[]=[];private cloudScale=0;
 private lakes=new Map<string,{canvas:HTMLCanvasElement;at:number;x:number;y:number;w:number;h:number}>();private sealGlow:HTMLCanvasElement|null=null;
 private built=-1;private flat:Piece[]=[];private floating:Piece[]=[];private standing:Piece[]=[];
 load(){
  if(this.assets)return;this.assets=true;
  const image=(src:string)=>{const i=new Image();i.decoding='async';i.src=src;return i;};
  this.sky=image('/assets/fishing/sky.webp');this.floor=image('/assets/lobby/floor.webp');this.grass=image('/assets/fishing/grass.webp');this.water=image('/assets/fishing/water.webp');
  this.rod=image('/assets/fishing/rod-bamboo.webp');this.autoSeal=image('/assets/fishing/ui/auto-seal.webp');this.splash={bait:image('/assets/fishing/splash-bait.webp'),catch:image('/assets/fishing/splash-catch.webp')};
  for(const id of Object.keys(FISHING_PROPS) as FishingPropId[])this.art.set(id,image(`/assets/fishing/props/${id}.webp`));
 }
 /** Lets go of every painting and baked tile at once (not at the next garbage collection) when the player leaves the Pescaria. */
 private skyCopy:ImageBitmap|null=null;private skyPending=false;
 release(){paintedFish.clear();this.skyCopy?.close();this.skyCopy=null;
  if(!this.assets)return;this.assets=false;
  freeAll(this.art);freeAll(this.tiles);freeAll(this.casts);this.dropBaked();releaseStamps();
  for(const k of ['sky','floor','grass','water','rod','autoSeal'] as const){freeImage(this[k]);this[k]=new Image();}
  freeImage(this.splash.bait);freeImage(this.splash.catch);this.splash={bait:new Image(),catch:new Image()};
 }
 /** Cloud strips, lake surfaces and the seal's glow: rebuilt on demand. */
 private dropBaked(){for(const strip of this.clouds)freeSurface(strip);this.clouds=[];for(const e of this.lakes.values())freeSurface(e.canvas);this.lakes.clear();freeSurface(this.sealGlow);this.sealGlow=null;}
 get isLoaded(){return this.assets;}
 /** True once everything on screen can be painted without a gap. */
 ready(_scale:number){return this.assets&&[this.sky,this.floor,this.grass,this.water,this.rod,this.splash.bait,this.splash.catch].every(imageReady)&&[...this.art.values()].every(imageReady);}
 /** Rebuilds the piece lists (and the baked floor) when the layout changed. */
 private sync(){
  const v=fishingLayoutVersion();if(v===this.built)return;this.built=v;placeStations();
  const all=[...fixedPieces(),...FISHING_ITEMS.filter(i=>i.prop in FISHING_PROPS) as Piece[]];
  this.flat=all.filter(p=>p.layer==='ground');this.floating=all.filter(p=>p.layer==='water');this.standing=all.filter(p=>p.layer==='stand');
  freeAll(this.tiles);this.dropBaked();
 }
 /** Camera that keeps the player a little below the middle (they are tall), never past the island's edges. */
 static camera(focusX:number,focusY:number){return {x:Math.max(0,Math.min(W-view.width,focusX-view.width/2)),y:Math.max(0,Math.min(H-VIEW_H,focusY-VIEW_H*.6))};}
 /** The sky fills the view and slides a little as the camera moves. */
 private drawSky(c:CanvasRenderingContext2D,camX:number,camY:number){
  const iw=this.sky.naturalWidth,ih=this.sky.naturalHeight,k=Math.max((view.width+(W-view.width)*SKY_X)/iw,(VIEW_H+(H-VIEW_H)*SKY_Y)/ih);
  // Stretched past the screen: only the part on screen is drawn (the whole painting enlarged was the costliest draw here).
  const x=camX-camX*SKY_X,y=camY-camY*SKY_Y,[vx0,vy0,vx1,vy1]=visibleArea(c),x0=Math.max(x,vx0-2),y0=Math.max(y,vy0-2),x1=Math.min(x+iw*k,vx1+2),y1=Math.min(y+ih*k,vy1+2);
  if(x1<=x0||y1<=y0||!imageReady(this.sky))return;
  // At screen size on whole screen pixels it is a plain copy, not an enlargement every frame.
  const m=c.getTransform(),w=Math.round(iw*k*m.a),h=Math.round(ih*k*m.d);
  if(!m.b&&!m.c&&this.skyCopy?.width===w&&this.skyCopy.height===h){
   const s=w/(iw*k),sx=Math.round((x0-x)*s),sy=Math.round((y0-y)*s),sw=Math.min(w-sx,Math.round((x1-x0)*s)),sh=Math.min(h-sy,Math.round((y1-y0)*s));
   c.save();c.setTransform(1,0,0,1,0,0);c.drawImage(this.skyCopy,sx,sy,sw,sh,Math.round(m.a*x0+m.e),Math.round(m.d*y0+m.f),sw,sh);c.restore();return;
  }
  if(!this.skyPending&&w>0&&h>0){const sky=this.sky;this.skyPending=true;resizedBitmap(sky,w,h).then(bitmap=>{this.skyPending=false;if(this.sky!==sky){bitmap.close();return;}this.skyCopy?.close();this.skyCopy=bitmap;},()=>{this.skyPending=false;});}
  c.drawImage(this.sky,(x0-x)/k,(y0-y)/k,(x1-x0)/k,(y1-y0)/k,x0,y0,x1-x0,y1-y0);
 }
 /** Back of the scene, in world coordinates (the caller has translated by the camera). */
 drawBack(c:CanvasRenderingContext2D,t:number,camX:number,camY:number){
  if(!this.ready(1)){c.fillStyle='#9ed4e8';c.fillRect(camX,camY,view.width,VIEW_H);return;}
  this.sync();
  c.save();c.imageSmoothingQuality='low';
  this.drawSky(c,camX,camY);
  const scale=Math.min(1.5,Math.max(1,Math.ceil(screenScale(c)*4)/4));
  if(scale!==this.tileScale){freeAll(this.tiles);for(const e of this.lakes.values())freeSurface(e.canvas);this.lakes.clear();this.tileScale=scale;}
  for(let n=Math.floor(camX/TILE);n*TILE<camX+view.width;n++){const tile=this.tile(n);if(!tile)continue;
   const y0=Math.max(GROUND_TOP,camY),y1=Math.min(H,camY+VIEW_H);if(y1>y0)c.drawImage(tile,0,(y0-GROUND_TOP)*scale,tile.width,(y1-y0)*scale,n*TILE,y0,TILE,y1-y0);}
  this.live(c,t,camX,camY,view.width,VIEW_H,true);
  c.restore();
 }
 /** Everything that moves over the floor: falling water, the ponds' surface, floating pieces, then the shadows. */
 private live(c:CanvasRenderingContext2D,t:number,camX:number,camY:number,viewW:number,viewH:number,baked=false){
  for(const p of this.flat)if(p.prop==='cascade')this.cascade(c,t,p,camX,camY,viewW,viewH);
  for(const lake of FISHING_LAKES){const p=pondPlace(lake);if(p.x+p.w>camX&&p.x<camX+viewW&&p.y+p.h>camY&&p.y<camY+viewH){if(baked)this.bakedSurface(c,lake,t);else this.surface(c,lake,t);}}
  for(const p of this.floating){const {w,h}=itemSize(p);if(p.x+w<camX||p.x-w>camX+viewW||p.y<camY-20||p.y-h>camY+viewH)continue;
   // Boats bob; pads and flowers sway a little, each in its own time.
   const phase=(p.x*7+p.y*3)%1000,boat=p.prop==='rowboat';
   this.drawPiece(c,p,boat?0:Math.sin(t/1700+phase)*1.6,boat?Math.sin(t/1100+phase)*2:Math.sin(t/1300+phase)*1.2,boat?0:Math.sin(t/2100+phase)*2.5);}
  this.shadows(c,camX,camY,viewW,viewH);
 }
 /** The whole map at once, for the admin editor (no baked tiles: everything painted every frame). */
 drawWhole(c:CanvasRenderingContext2D,t:number){
  if(!this.ready(1)){c.fillStyle='#9ed4e8';c.fillRect(0,0,W,H);return;}
  this.sync();
  const iw=this.sky.naturalWidth,ih=this.sky.naturalHeight,k=Math.max(W/iw,H/ih);c.drawImage(this.sky,0,0,iw*k,ih*k);
  this.paintGround(c,0,W);
  this.live(c,t,0,0,W,H);
  for(const s of this.sprites(t,null,0,0,W,H).sort((a,b)=>a.y-b.y))s.draw(c);
  this.drawFront(c,t,null,0,0,W,H);
 }
 /** One baked column of the ground: lawns, quay, walls, stairs, ponds, flat pieces and the top balustrade (the clouds below stay clear). */
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
  // Grass borders, patches, stepping stones and tufts under the ponds; then the ponds, then what lies over them (island, pier, bridge, rocks).
  // Walkways (pier, bridge, island) go over a pond whenever they reach into it, wherever their base is.
  const overPond=(p:Piece)=>FISHING_LAKES.some(l=>{const q=pondPlace(l);if(p.x>q.x&&p.x<q.x+q.w&&p.y>q.y&&p.y<q.y+q.h+40)return true;
   if(!isWalkway(p))return false;const {w,h}=itemSize(p);return p.x+w/2>q.x&&p.x-w/2<q.x+q.w&&p.y>q.y&&p.y-h<q.y+q.h;});
  const flat=this.flat.filter(p=>p.prop!=='cascade');
  for(const p of flat)if(!overPond(p))this.piece(g,p,x0,x1);
  for(const lake of FISHING_LAKES){const p=pondPlace(lake);if(p.x+p.w<=x0||p.x>=x1)continue;
   g.save();if(lake.flip){g.translate(p.x*2+p.w,0);g.scale(-1,1);}g.drawImage(this.art.get(lake.art as FishingPropId)!,p.x,p.y,p.w,p.h);g.restore();}
  for(const p of flat)if(overPond(p)){
   // An island sits on the water: a soft dark rim where it meets it.
   if(p.walk&&p.prop.startsWith('grass-patch')){const {w,h}=itemSize(p);g.fillStyle='rgba(20,40,50,.35)';g.beginPath();g.ellipse(p.x+6,p.y-h*.4,w*.49,h*.38,0,0,Math.PI*2);g.fill();}
   this.piece(g,p,x0,x1);}
  // The painted retaining wall, side by side along every terrace front (its grass lip over the edge).
  const wall=this.art.get('wall')!,size=FISHING_PROPS.wall;
  for(const w of WALLS){const k=(w.bottom-w.top)/size.h,ww=size.w*k*.97;
   const foot=g.createLinearGradient(0,w.bottom-10,0,w.bottom+26);foot.addColorStop(0,'rgba(40,30,15,.35)');foot.addColorStop(1,'rgba(40,30,15,0)');g.fillStyle=foot;g.fillRect(x0,w.bottom-10,x1-x0,36);
   for(let x=Math.floor(x0/ww)*ww-ww*.02;x<x1;x+=ww)g.drawImage(wall,x,w.top,size.w*k,w.bottom-w.top);}
  for(const s of FISHING_STAIRS.map(stairPlace))if(s.x+s.w>x0&&s.x<x1){const stair=this.art.get(s.art)!;
   // A front stair stands out of the wall: a soft shadow on the terrace below, to its left.
   if(s.front){g.fillStyle='rgba(30,35,15,.28)';g.beginPath();g.ellipse(s.x+s.w*.42,s.y+s.h-8,s.w*.5,16,0,0,Math.PI*2);g.fill();}
   g.save();if(s.flip){g.translate(s.x*2+s.w,0);g.scale(-1,1);}g.drawImage(stair,s.x,s.y,s.w,s.h);g.restore();}
  // The cascades over the wall.
  for(const p of this.flat)if(p.prop==='cascade')this.piece(g,p,x0,x1);
 }
 /** A piece by its base, mirrored and turned around its middle, nudged by (dx,dy) and `turn` extra degrees. */
 private drawPiece(c:CanvasRenderingContext2D,p:FishingItem,dx=0,dy=0,turn=0){
  const image=this.art.get(p.prop as FishingPropId);if(!image)return;
  const {w,h}=itemSize(p),a=((p.rotation??0)+turn)*Math.PI/180;
  c.save();c.translate(p.x+dx,p.y-h/2+dy);if(a)c.rotate(a);if(p.flip)c.scale(-1,1);drawScaled(c,image,-w/2,-h/2,w,h);c.restore();
 }
 /** A flat piece baked into a ground column, if it reaches it. */
 private piece(g:CanvasRenderingContext2D,p:FishingItem,x0:number,x1:number){
  const {w,h}=itemSize(p),r=Math.hypot(w,h)/2;if(p.x+r<x0||p.x-r>x1)return;
  const image=this.art.get(p.prop as FishingPropId);if(!image)return;
  g.save();g.translate(p.x,p.y-h/2);if(p.rotation)g.rotate(p.rotation*Math.PI/180);if(p.flip)g.scale(-1,1);g.drawImage(image,-w/2,-h/2,w,h);g.restore();
 }
 /** A row of the painted balustrade with its posts, bottom at `y`. */
 private balustradeRow(g:CanvasRenderingContext2D,x0:number,x1:number,y:number){
  const run=this.art.get('balustrade')!,urn=this.art.get('urn-pillar')!,lamp=this.art.get('lamp-pillar')!;
  const b=FISHING_PROPS.balustrade,w=b.w*.9,h=b.h*.9;
  for(let x=Math.floor((x0-w)/w)*w;x<x1+w;x+=w)g.drawImage(run,x,y-h,w,h);
  for(let x=Math.floor((x0-w)/w)*w,n=Math.floor((x0-w)/w);x<x1+w*2;x+=w,n++){const lampPost=((n%4)+4)%4===1,a=lampPost?FISHING_PROPS['lamp-pillar']:FISHING_PROPS['urn-pillar'],k=.86;
   g.drawImage(lampPost?lamp:urn,x-a.w*k/2,y+2-a.h*k,a.w*k,a.h*k);}
 }
 /** Falling water over a painted cascade: streaks running down and spray at its foot. */
 private cascade(c:CanvasRenderingContext2D,t:number,p:FishingItem,camX:number,camY:number,viewW:number,viewH:number){
  const size=itemSize(p),x=p.x-size.w*.12*(p.flip?-1:1),top=p.y-size.h*.8,bottom=p.y-size.h*.1;
  if(x+60<camX||x-60>camX+viewW||bottom<camY||top>camY+viewH)return;
  c.save();c.lineCap='round';
  for(let i=0;i<9;i++){const sx=x-size.w*.12+i*size.w*.03,len=18+(i*7)%16,yy=top+((t*.25+i*53)%(bottom-top));c.strokeStyle=`rgba(255,255,255,${.35+(i%3)*.12})`;c.lineWidth=1.6;c.beginPath();c.moveTo(sx,yy);c.lineTo(sx,Math.min(bottom,yy+len));c.stroke();}
  for(let i=0;i<8;i++){const k=(t/800+i/8)%1,a=i/8*Math.PI*2;c.fillStyle=`rgba(255,255,255,${.7*(1-k)})`;c.beginPath();c.arc(x+Math.cos(a)*(14+k*16),bottom+4-k*12,2+k*3,0,Math.PI*2);c.fill();}
  c.restore();
 }
 /**
  * A pond's moving surface: the painted water texture in two layers drifting against each other
  * (soft light, so each pond keeps its own color), rings opening here and there and glints.
  */
 private surface(c:CanvasRenderingContext2D,lake:FishingLake,t:number,under?:(g:CanvasRenderingContext2D)=>void){
  const {x,y,rx,ry}=lake,r=random(lake.x+3),tw=this.water.naturalWidth;
  // The moving water stays off the walkways that cross it (pier, bridge, island).
  c.save();c.beginPath();c.ellipse(x,y,rx*.97,ry*.93,0,0,Math.PI*2);
  for(const item of FISHING_ITEMS)if(isWalkway(item)){const d=deckOf(item);
   const corners=d.shape==='rect'?[[d.u0,d.v0],[d.u1,d.v0],[d.u1,d.v1],[d.u0,d.v1]]
    :Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2;return [(d.u0+d.u1)/2+Math.cos(a)*(d.u1-d.u0)/2,(d.v0+d.v1)/2+Math.sin(a)*(d.v1-d.v0)/2];});
   corners.forEach(([u,v],i)=>{const q=itemPoint(item,u,v);if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);});c.closePath();}
  c.clip('evenodd');under?.(c);
  const pattern=tw?c.createPattern(this.water,'repeat'):null;
  // The texture passes cover only the part of the lake on screen.
  const [vx0,vy0,vx1,vy1]=visibleArea(c),fx=Math.max(x-rx,vx0),fy=Math.max(y-ry,vy0),fw=Math.min(x+rx,vx1)-fx,fh=Math.min(y+ry,vy1)-fy;
  if(pattern&&fw>0&&fh>0){
   const k=WATER/tw,drift=(speed:number,dir:number)=>((t*speed*dir)%WATER+WATER)%WATER;
   c.globalCompositeOperation='soft-light';
   for(const [speed,dir,alpha,sk] of [[.012,1,WATER_ALPHA,1],[.008,-1,WATER_ALPHA*.8,1.35]] as const){
    pattern.setTransform(new DOMMatrix([k*sk,0,0,k*sk*WATER_SQUASH,x+drift(speed,dir),y+drift(speed*.4,dir)*WATER_SQUASH]));
    c.globalAlpha=alpha;c.fillStyle=pattern;c.fillRect(fx,fy,fw,fh);}
   // A little of the texture's light on top, so the surface glitters.
   c.globalCompositeOperation='screen';c.globalAlpha=.12;pattern.setTransform(new DOMMatrix([k,0,0,k*WATER_SQUASH,x-drift(.01,1),y]));c.fillStyle=pattern;c.fillRect(fx,fy,fw,fh);
   c.globalCompositeOperation='source-over';c.globalAlpha=1;
  }
  for(let i=0;i<7;i++){const px=x+(r()-.5)*rx*1.4,py=y+(r()-.5)*ry*1.1,k=((t/2600)+r())%1;c.strokeStyle=`rgba(255,255,255,${.4*(1-k)})`;c.lineWidth=1.3;c.beginPath();c.ellipse(px,py,5+k*22,1.6+k*5.5,0,0,Math.PI*2);c.stroke();}
  for(let i=0;i<14;i++){const px=x+(r()-.5)*rx*1.6,py=y+(r()-.5)*ry*1.4,a=Math.max(0,Math.sin(t/(380+i*37)+i*2));if(a<.6)continue;c.fillStyle=`rgba(255,255,240,${(a-.6)*2})`;c.beginPath();c.moveTo(px-5,py);c.lineTo(px,py-1.2);c.lineTo(px+5,py);c.lineTo(px,py+1.2);c.closePath();c.fill();}
  if(lake.fish==='termal')for(let i=0;i<6;i++){const k=(t/3200+i/6)%1,sx=x+(i-2.5)*rx*.28+Math.sin(t/900+i)*10,sy=y-k*90,s=18+k*30;const g=c.createRadialGradient(sx,sy,0,sx,sy,s);g.addColorStop(0,`rgba(255,255,255,${.22*(1-k)})`);g.addColorStop(1,'rgba(255,255,255,0)');c.restore();c.save();c.fillStyle=g;c.fillRect(sx-s,sy-s,s*2,s*2);}
  c.restore();
 }
 /**
  * The pond's surface repainted WATER_FRAME_MS apart into its own canvas (with the ground under it copied in, for the
  * soft-light passes) and copied every frame: the drift is a few pixels a second, and the clipped soft-light fills
  * every frame cost as much as the rest of the floor.
  */
 private bakedSurface(c:CanvasRenderingContext2D,lake:FishingLake,t:number){
  const d=this.tileScale,steam=lake.fish==='termal'?140:0;
  const x=Math.floor((lake.x-lake.rx-4)/4)*4,y=Math.floor((lake.y-lake.ry-4-steam)/4)*4,w=Math.ceil((lake.x+lake.rx+4)/4)*4-x,h=Math.ceil((lake.y+lake.ry+4)/4)*4-y;
  let e=this.lakes.get(lake.id);
  if(!e||e.x!==x||e.y!==y||e.w!==w||e.h!==h){if(e)freeSurface(e.canvas);const canvas=document.createElement('canvas');canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);e={canvas,at:-1e9,x,y,w,h};this.lakes.set(lake.id,e);}
  if(t-e.at>=WATER_FRAME_MS||t<e.at){
   const g=e.canvas.getContext('2d')!,lake0=e;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,e.canvas.width,e.canvas.height);g.setTransform(d,0,0,d,-x*d,-y*d);g.imageSmoothingQuality='low';
   this.surface(g,lake,t,g2=>{for(let n=Math.floor(x/TILE);n*TILE<x+w;n++){const tile=this.tile(n);if(!tile)continue;
    const sx0=Math.max(x,n*TILE),sx1=Math.min(x+w,n*TILE+TILE),sy0=Math.max(y,GROUND_TOP),sy1=Math.min(y+h,H);if(sx1<=sx0||sy1<=sy0)continue;
    g2.drawImage(tile,(sx0-n*TILE)*d,(sy0-GROUND_TOP)*d,(sx1-sx0)*d,(sy1-sy0)*d,sx0,sy0,sx1-sx0,sy1-sy0);}});
   lake0.at=t;
  }
  c.drawImage(e.canvas,x,y,w,h);
 }
 /** While the player chooses where to fish: every pond glows softly, the one under the pointer brighter. */
 drawPick(c:CanvasRenderingContext2D,t:number,hoverLake:string|null){
  for(const lake of FISHING_LAKES){const on=lake.id===hoverLake,pulse=.5+Math.sin(t/260)*.5;
   c.save();c.beginPath();c.ellipse(lake.x,lake.y,lake.rx*.98,lake.ry*.95,0,0,Math.PI*2);
   c.fillStyle=`rgba(255,240,170,${on?.16:.05+pulse*.04})`;c.fill();
   c.shadowColor='rgba(255,226,120,.9)';c.shadowBlur=on?22:12;c.lineWidth=on?4:2.5;c.strokeStyle=`rgba(255,236,160,${on?.95:.45+pulse*.3})`;c.setLineDash(on?[]:[14,10]);c.lineDashOffset=-t/40;c.stroke();
   c.restore();}
 }
 /** Shadows on the floor under every standing piece: a soft dark spot where it touches, and its outline cast to the left. */
 private shadows(c:CanvasRenderingContext2D,camX:number,camY:number,viewW:number,viewH:number){
  const pieces:{id:FishingPropId;x:number;y:number;w:number;h:number;flip?:boolean}[]=[];
  for(const p of this.standing)if(CASTS.has(p.prop)){const {w,h}=itemSize(p);pieces.push({id:p.prop,x:p.x,y:p.y,w,h,flip:p.flip});}
  for(const p of pieces){if(p.x+p.w*.5<camX-p.h*CAST_LEAN||p.x-p.w*.5>camX+viewW||p.y<camY-40||p.y-p.h*CAST_SQUASH>camY+viewH+40)continue;
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
 sprites(t:number,hover:string|null,camX:number,camY:number,viewW=view.width,viewH=VIEW_H){
  this.sync();
  const list:{y:number;draw:(c:CanvasRenderingContext2D)=>void}[]=[];
  const seen=(x0:number,x1:number,y0:number,y1:number)=>x1>camX-20&&x0<camX+viewW+20&&y1>camY-10&&y0<camY+viewH+10;
  for(const p of this.standing){const {w,h}=itemSize(p);
   if(!seen(p.x-w/2,p.x+w/2,p.y-h,p.y))continue;
   list.push({y:p.y,draw:c=>{this.drawPiece(c,p);
    if(p.prop==='lake-sign'&&!p.rotation){const lake=FISHING_LAKES.find(l=>l.id===p.lake);if(lake)this.signText(c,lake.name,p.x,p.y-h*.66,w*.8);}}});}
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
 /** One band of cloud puffs baked into a strip CLOUD_WRAP wide (drawn twice where it wraps), at the screen's scale. */
 private cloudStrip(band:number,scale:number){
  const k=Math.min(1.5,Math.max(1,Math.ceil(scale*4)/4)),done=this.clouds[band];if(done&&this.cloudScale===k)return done;
  if(this.cloudScale!==k){for(const strip of this.clouds)freeSurface(strip);this.clouds=[];this.cloudScale=k;}
  const strip=document.createElement('canvas');strip.width=Math.ceil(CLOUD_WRAP*k);strip.height=Math.ceil(CLOUD_HEIGHT*k);const g=strip.getContext('2d')!;g.scale(k,k);g.translate(0,-CLOUD_TOP);
  const lo=band?(CLOUD_SPEEDS[band-1]+CLOUD_SPEEDS[band])/2:0,hi=band<CLOUD_SPEEDS.length-1?(CLOUD_SPEEDS[band]+CLOUD_SPEEDS[band+1])/2:99;
  for(const [base,y,size,speed] of CLOUD_PUFFS)if(speed>=lo&&speed<hi)for(const x of [base+150,base+150-CLOUD_WRAP,base+150+CLOUD_WRAP])g.drawImage(cloudPuff(),x-size,y-size*.45,size*2,size*.9);
  this.clouds[band]=strip;return strip;
 }
 drawFront(c:CanvasRenderingContext2D,t:number,hover:string|null,camX:number,camY:number,viewW=view.width,viewH=VIEW_H){
  // Clouds drifting under the island, in front of everything.
  // 46 enlarged puffs every frame were the costliest draw of the Pescaria: three baked strips slide instead.
  if(camY+viewH>CLOUD_TOP)for(let band=0;band<CLOUD_SPEEDS.length;band++){
   const strip=this.cloudStrip(band,screenScale(c));if(!strip)continue;
   const shift=(t/1000*CLOUD_SPEEDS[band])%CLOUD_WRAP;
   for(const start of [shift-150-CLOUD_WRAP,shift-150]){const x0=Math.max(start,camX),x1=Math.min(start+CLOUD_WRAP,camX+viewW);if(x1<=x0)continue;
    const k=strip.width/CLOUD_WRAP;c.drawImage(strip,(x0-start)*k,0,(x1-x0)*k,strip.height,x0,CLOUD_TOP,x1-x0,CLOUD_HEIGHT);}
  }
  for(const s of FISHING_STATIONS){const top=s.y-s.height-16;if(top>camY-40&&top<camY+viewH)plaque(c,s.title,s.x,top,true,hover===s.id);}
 }
 drawOverlay(c:CanvasRenderingContext2D,t:number){
  for(let i=0;i<18;i++){const x=(i*137+t*.012)%view.width,y=140+(i*71)%460+Math.sin(t/1300+i)*15;c.fillStyle=`rgba(255,255,230,${.22+Math.sin(t/800+i)*.16})`;c.beginPath();c.arc(x,y,1.4+i%2,0,Math.PI*2);c.fill();}
 }
 hit(x:number,y:number):FishingHit|null{
  // A tall building pokes over the terrace above it: clicks on that terrace's floor still walk.
  const floor=terraceAt(x,y);
  for(const station of FISHING_STATIONS){if(floor&&floor.y1<station.y-150)continue;const half=station.width*.4,top=station.y-station.height*.92,bottom=station.y-20;if(x>=station.x-half&&x<=station.x+half&&y>=top&&y<=bottom)return {kind:'station',station};}
  // The island, the bridge and the pier are floor: a click there walks.
  if(!fishingBlocked(x,y))return null;
  const lake=FISHING_LAKES.find(lake=>{const p=pondPlace(lake);return ((x-lake.x)/(lake.rx+20))**2+((y-lake.y)/(lake.ry+16))**2<1||((x-lake.x)/p.block.rx)**2+((y-lake.y)/p.block.ry)**2<1;});
  return lake?{kind:'lake',lake}:null;
 }

 /** The rod's painted frame for a moment of the cast (`age` ms since the pose began). */
 private rodFrame(pose:FishingPose,age:number,now:number):RodFrame{
  if(pose.phase==='idle')return 'rest';
  if(pose.phase==='bite')return Math.floor(age/140)%2?'hooked-hard':'hooked';
  if(pose.phase==='result')return pose.success?'success':'fail';
  for(const [frame,until] of SWING)if(age<until)return frame;
  return (['wait1','wait2','wait3','wait2'] as const)[Math.floor(now/450)%4];
 }
 /** One frame of a splash sheet, with the water hit at (x,y), `width` px wide. */
 private drawSplash(c:CanvasRenderingContext2D,kind:'bait'|'catch',x:number,y:number,width:number,age:number,frameMs:number){
  const s=SPLASHES[kind],image=this.splash[kind],frame=Math.floor(age/frameMs);if(age<0||frame>=s.frames||!imageReady(image))return;
  const h=width*s.h/s.w;
  c.drawImage(image,(frame%s.cols)*s.w,Math.floor(frame/s.cols)*s.h,s.w,s.h,x-s.impact[0]*width,y-s.impact[1]*h,width,h);
 }
 /** The auto seal with its green glow painted once (a shadow blur on every fisher every frame is a blur pass each). */
 private sealGlowArt(size:number,scale:number){
  const k=Math.max(1,Math.ceil(scale*2)/2),pad=size*.5,px=Math.ceil((size+pad*2)*k);if(this.sealGlow?.width===px)return this.sealGlow;
  const out=document.createElement('canvas');out.width=out.height=px;const g=out.getContext('2d')!;g.scale(k,k);g.imageSmoothingQuality='high';
  g.shadowColor='rgba(120,255,150,.7)';g.shadowBlur=8;g.drawImage(this.autoSeal,pad,pad,size,size);
  this.sealGlow=out;return out;
 }
 /**
  * The painted Vara de Bambu in the player's hands with its line and float, the splash where the
  * float lands and where a fish is pulled out, and the fish on a catch. `x,y` are the player's feet,
  * `size` their drawn height.
  */
 drawGear(c:CanvasRenderingContext2D,pose:FishingPose,spot:FishingSpot,x:number,y:number,size:number,now:number){
  // Automatic mode: the painted reel seal floats beside the fisher's head, turning slowly (seen by everyone).
  if(pose.auto&&imageReady(this.autoSeal)){const s=36,sx=x-spot.facing*size*.34,sy=y-size*.86+Math.sin(now/420)*2.5;
   const glow=this.sealGlowArt(s,screenScale(c)),pad=s*.5;c.save();c.translate(sx,sy);c.rotate(Math.sin(now/900)*.18);c.drawImage(glow,-s/2-pad,-s/2-pad,s+pad*2,s+pad*2);c.restore();}
  const age=Math.max(0,now-pose.since),f=spot.facing,hx=x+f*size*.16,hy=y-size*.5;
  const frame=this.rodFrame(pose,age,now),fr=ROD_FRAMES[frame],rest=ROD_FRAMES.rest,k=size*ROD_LENGTH/Math.hypot(rest.tip[0]-rest.grip[0],rest.tip[1]-rest.grip[1]);
  const tx=hx+f*k*(fr.tip[0]-fr.grip[0]),ty=hy+k*(fr.tip[1]-fr.grip[1]);
  c.save();
  if(imageReady(this.rod)){c.save();c.translate(hx,hy);c.scale(f*k,k);c.drawImage(this.rod,fr.x,fr.y,fr.w,fr.h,-fr.grip[0],-fr.grip[1],fr.w,fr.h);c.restore();}
  c.lineCap='round';
  const line=(ex:number,ey:number,sag:number)=>{c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=1.1;c.beginPath();c.moveTo(tx,ty);c.quadraticCurveTo((tx+ex)/2,Math.max(ty,ey)+sag,ex,ey);c.stroke();};
  const float=(bx:number,by:number)=>{c.fillStyle='#fff';c.beginPath();c.arc(bx,by-3,4.2,Math.PI,0);c.fill();c.fillStyle='#e8433a';c.beginPath();c.arc(bx,by-3,4.2,0,Math.PI);c.fill();};
  if(pose.phase==='idle'){line(tx,ty+size*.3,0);float(tx,ty+size*.3+3);}
  else if(pose.phase==='waiting'&&age<LAND_MS){
   // The swing: the float hangs at the tip, then flies in an arc to the water.
   const from=SWING[2][1];
   if(age<from){line(tx,ty+size*.18,0);float(tx,ty+size*.18+3);}
   else{const k2=Math.min(1,(age-from)/(LAND_MS-from)),bx=tx+(spot.bobX-tx)*k2,by=ty+(spot.bobY-ty)*k2-Math.sin(k2*Math.PI)*size*.7;line(bx,by-3,0);float(bx,by);}
  }
  else if(pose.phase==='waiting'||pose.phase==='bite'){
   const bite=pose.phase==='bite',dip=bite?Math.max(0,Math.sin(age/90))*7:Math.sin(now/600)*1.5,bx=spot.bobX,by=spot.bobY+dip;
   line(bx,by-4,bite?4:26);
   if(bite)for(let i=0;i<3;i++){const k2=((age/700)+i/3)%1;c.strokeStyle=`rgba(255,255,255,${.7*(1-k2)})`;c.lineWidth=1.5;c.beginPath();c.ellipse(spot.bobX,spot.bobY+2,6+k2*26,2+k2*7,0,0,Math.PI*2);c.stroke();}
   else{c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=1;c.beginPath();c.ellipse(spot.bobX,spot.bobY+2,9,3,0,0,Math.PI*2);c.stroke();}
   float(bx,by);
   if(!bite)this.drawSplash(c,'bait',spot.bobX,spot.bobY,64,age-LAND_MS,75);
   if(bite){c.font='900 30px Nunito, sans-serif';c.textAlign='center';c.lineWidth=5;c.strokeStyle='#5a1a00';const jump=Math.abs(Math.sin(age/120))*6;c.strokeText('!',x,y-size*1.35-jump);c.fillStyle='#ffd23a';c.fillText('!',x,y-size*1.35-jump);}
  }
  else if(pose.success&&pose.fish){
   // The water bursts, the catch flies out to the rod tip, then dangles there.
   // Quanto mais raro, maior o respingo pintado; Épico e Lendário estouram a água duas vezes.
   const tier=Math.max(1,Math.min(5,FISH_BY_ID.get(pose.fish)?.difficulty??1));
   this.drawSplash(c,'catch',spot.bobX,spot.bobY,150+28*(tier-1),age,80);
   if(tier>=4)this.drawSplash(c,'catch',spot.bobX+f*14,spot.bobY,120+40*(tier-4),age-260,85);
   const k2=Math.min(1,age/600),ease=1-(1-k2)**2,len=pose.fish==='pirarucu-ancestral'||pose.fish==='carpa-dragao'?54:40;
   const fx=spot.bobX+(tx-spot.bobX)*ease,fy=spot.bobY+(ty+len*.7-spot.bobY)*ease-Math.sin(k2*Math.PI)*90;
   line(fx,fy-len*.35,0);
   drawFish(c,pose.fish,fx,fy,len,-Math.PI/2+Math.sin(now/180)*.35);
   if(k2>=1){c.globalCompositeOperation='lighter';for(let i=0;i<6;i++){const s=(now/300+i)%6;c.fillStyle=`rgba(255,240,170,${.8-s/7})`;c.beginPath();c.arc(fx+Math.cos(i*1.05+now/500)*len*.7,fy+Math.sin(i*1.05+now/500)*len*.5,2,0,Math.PI*2);c.fill();}c.globalCompositeOperation='source-over';}
  }
  else{
   // Lost it: a small splash, the line hangs slack and a fish jumps away from the float.
   this.drawSplash(c,'bait',spot.bobX,spot.bobY,70,age,70);
   line(tx+f*10,ty+size*.45,0);
   const k2=Math.min(1,age/900);if(k2<1&&pose.fish){const fx=spot.bobX+f*k2*70,fy=spot.bobY-Math.sin(k2*Math.PI)*45;drawFish(c,pose.fish,fx,fy,30,f>0?-.6+k2*1.2:Math.PI+.6-k2*1.2,1-k2*.5);}
  }
  c.restore();
 }
}
