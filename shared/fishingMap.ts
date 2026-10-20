/**
 * The Pescaria's ground (docs/fishing.md): a terraced sky garden, three terraces one above the other
 * joined by stone stairs that climb the walls. Lawns with ponds sunk into the grass and the Casa de
 * Pesca on the stone quay at the bottom. Players walk on the terraces, the stairs and on anything
 * placed as a walkway (piers, the bridge, the island); water and solid pieces (buildings, tree
 * trunks) block. The server walks everyone with `fishingStep` (a path over a grid, so going up and
 * down the stairs needs no help from the client).
 *
 * The terraces are fixed; everything on them is a `FishingLayout` that the admin panel edits
 * (/admin/mapas/pescaria): ponds, stairs, every painted piece, the Casa de Pesca, the airship and the
 * entrance. `applyFishingLayout` swaps it at run time on the server and in the game.
 *
 * World px like the plaza; the view is 1536×864 and the camera follows the player on both axes.
 * Pieces are painted by Codex (public/assets/fishing/source/, cut by `npm run build:fishing`), seen
 * from above at the map's angle.
 */
import {FISHING_PROPS} from './generated/fishingProps';
import type {FishingPropId} from './generated/fishingProps';

export const FISHING_WIDTH=2304;
export const FISHING_HEIGHT=2140;
export type Zone='plaza'|'fishing';

interface Rect {x0:number;x1:number;y0:number;y1:number;}
/** Terraces, top to bottom (y is depth: smaller y is farther back and higher up). */
export interface FishingTerrace extends Rect {id:string;name:string;}
export const FISHING_TERRACES:readonly FishingTerrace[]=[
 {id:'mirante',name:'Mirante',x0:110,x1:2194,y0:520,y1:780},
 {id:'jardim',name:'Jardim do Lago',x0:100,x1:2204,y0:920,y1:1600},
 {id:'cais',name:'Cais das Nuvens',x0:130,x1:2174,y0:1740,y1:1960},
];
/** Bounds of every walkable point (the protocol's move limits). */
export const FISHING_WALK={minX:100,maxX:2204,minY:520,maxY:1960};

/** A painted stair climbing a retaining wall from the side: its picture's size and the walkable line up its steps. */
export const STAIR_ART={w:588,h:360,bottom:{x:70,y:330},top:{x:520,y:30},half:50,scale:.556};
/**
 * Stairs seen from the front (20/10, pedido do matheus: "escadaria com visão reta"): the picture stands
 * against the wall, its top on the upper lawn's edge and its foot on the terrace below; players walk
 * straight up the middle. `half` is half the walkable width, in widths of the picture.
 */
export const FRONT_STAIRS={grand:{prop:'stair-grand',name:'Escadaria larga',half:.2},narrow:{prop:'stair-narrow',name:'Escada estreita',half:.22}} as const;
export type StairArt='side'|keyof typeof FRONT_STAIRS;
/**
 * Stairs from the front edge of `upper` down to the terrace below. `x` is the picture's left edge;
 * `flip` mirrors it (a side stair then climbs to the left). `art` picks the painting (side by default).
 */
export interface FishingStairs {id:string;upper:'mirante'|'jardim';x:number;flip?:boolean;art?:StairArt;}
/** Where a stair's picture sits and its walkable band, in world px. */
export function stairPlace(s:FishingStairs){
 const i=FISHING_TERRACES.findIndex(t=>t.id===s.upper),upper=FISHING_TERRACES[i],lower=FISHING_TERRACES[i+1];
 const art=s.art&&s.art!=='side'?FRONT_STAIRS[s.art]:null;
 if(art){
  const size=FISHING_PROPS[art.prop],top=upper.y1-46,h=lower.y0+60-top,w=size.w*h/size.h,cx=s.x+w/2;
  return {x:s.x,y:top,w,h,flip:!!s.flip,art:art.prop as FishingPropId,front:true,bottom:{x:cx,y:lower.y0+40},top:{x:cx,y:upper.y1-12},half:w*art.half};
 }
 const k=STAIR_ART.scale,w=STAIR_ART.w*k,h=STAIR_ART.h*k,top=upper.y1-30;
 const px=(x:number)=>s.flip?s.x+w-x*k:s.x+x*k;
 return {x:s.x,y:top,w,h,flip:!!s.flip,art:'stair' as FishingPropId,front:false,bottom:{x:px(STAIR_ART.bottom.x),y:top+STAIR_ART.bottom.y*k},top:{x:px(STAIR_ART.top.x),y:top+STAIR_ART.top.y*k},half:STAIR_ART.half*k};
}

/**
 * A painted pond sunk into the lawn: `aspect` is its width over its height and the water an ellipse
 * (cx,cy,rx,ry) in fractions of the piece. Everything outside the water is its stone and grass rim.
 */
export interface PondArt {name:string;aspect:number;cx:number;cy:number;rx:number;ry:number;}
export const POND_ARTS:Record<string,PondArt>={
 'pond-clear':{name:'Lago limpo',aspect:4.9,cx:.49,cy:.51,rx:.385,ry:.37},
 'pond-lily':{name:'Ninfeias',aspect:1095/263,cx:.51,cy:.54,rx:.41,ry:.32},
 'pond-well':{name:'Poço de pedra',aspect:1114/299,cx:.51,cy:.51,rx:.39,ry:.29},
 'pond-crystal':{name:'Lagoa de cristal',aspect:1190/227,cx:.5,cy:.5,rx:.43,ry:.36},
 'pond-reeds':{name:'Lago de juncos',aspect:1179/247,cx:.51,cy:.55,rx:.41,ry:.32},
};
/** Fish tables (FISH[].lakes in shared/fishing.ts): every pond draws its fish from one of them. */
export const FISH_TABLES={ninfeias:'Lago das Ninfeias',profundo:'Poço Azul',cristal:'Lagoa de Cristal',juncos:'Lago dos Juncos',termal:'Fonte Termal'} as const;
export type FishTable=keyof typeof FISH_TABLES;
/** A pond as placed in the editor: (x,y) is the middle of the water, `width` the painted pond's width. */
export interface FishingLakeDef {id:string;name:string;fish:FishTable;art:string;x:number;y:number;width:number;flip?:boolean;}
/** A placed pond with its water ellipse (`rx`,`ry`, where the float lands). */
export interface FishingLake extends FishingLakeDef {rx:number;ry:number;}
export const lakeOf=(d:FishingLakeDef):FishingLake=>{const a=POND_ARTS[d.art]??POND_ARTS['pond-well'],h=d.width/a.aspect;return {...d,rx:a.rx*d.width,ry:a.ry*h};};
/** A pond's picture (left, top, size) and the solid ellipse of water and rim stones, in world px. */
export function pondPlace(lake:FishingLake){
 const a=POND_ARTS[lake.art]??POND_ARTS['pond-well'],w=lake.width,h=w/a.aspect,left=lake.x-(lake.flip?1-a.cx:a.cx)*w,top=lake.y-a.cy*h;
 return {x:left,y:top,w,h,block:{rx:lake.rx+w*.035,ry:lake.ry+h*.1}};
}

/**
 * A painted piece placed by its base (bottom centre, where it touches the floor), turned by
 * `rotation` degrees around its middle. `ground` pieces are flat and baked into the floor, `water`
 * pieces float and bob (boats, lily pads), `stand` pieces stand up and are sorted with the walkers.
 * `solid` blocks walking around its base; `walk` makes its deck walkable over water (piers, bridge,
 * island). Both default by piece (FOOTPRINTS, DECKS). A `lake-sign` shows the name of its `lake`.
 */
export type FishingLayer='ground'|'water'|'stand';
export interface FishingItem {id:string;prop:string;x:number;y:number;scale?:number;rotation?:number;flip?:boolean;layer:FishingLayer;solid?:boolean;walk?:boolean;lake?:string;}
export interface FishingLayout {
 lakes:FishingLakeDef[];stairs:FishingStairs[];items:FishingItem[];
 /** The Casa de Pesca's base, the airship's mooring along the quay and where players appear. */
 casa:{x:number;y:number};airship:{x:number};spawn:{x:number;y:number};
}

/** What each piece blocks when solid: ellipses at its base (u across the piece, dy px above the base, rx in piece widths, ry px). */
type Foot={u:number;dy:number;rx:number;ry:number};
const FOOTPRINTS:Partial<Record<string,Foot[]>>={
 willow:[{u:.5,dy:-12,rx:.108,ry:12}],cherry:[{u:.5,dy:-12,rx:.11,ry:12}],'cypress-pair':[{u:.5,dy:-10,rx:.3,ry:12}],
 pagoda:[{u:.5,dy:-12,rx:.37,ry:26}],stall:[{u:.5,dy:-15,rx:.405,ry:30}],'bait-kiosk':[{u:.5,dy:-15,rx:.44,ry:30}],
 'deck-umbrella':[{u:.5,dy:-20,rx:.465,ry:30}],arch:[{u:.17,dy:-10,rx:.093,ry:12},{u:.83,dy:-10,rx:.093,ry:12}],
 'fishing-house':[{u:.5,dy:-25,rx:.382,ry:42}],
};
const DEFAULT_SOLID=new Set(['willow','cherry','cypress-pair','pagoda','stall','bait-kiosk','deck-umbrella','arch']);
/** The walkable deck of each walkway piece, in fractions of its picture (before turning or mirroring). */
type Deck={shape:'rect'|'ellipse';u0:number;u1:number;v0:number;v1:number};
const DECKS:Partial<Record<string,Deck>>={
 pier:{shape:'rect',u0:.37,u1:.63,v0:.165,v1:.959},
 'pier-l':{shape:'rect',u0:.3,u1:.7,v0:.15,v1:.95},
 bridge:{shape:'rect',u0:.053,u1:.947,v0:.711,v1:.886},
 'bridge-arch':{shape:'rect',u0:.04,u1:.96,v0:.36,v1:.66},
 'bridge-arch-v':{shape:'rect',u0:.3,u1:.7,v0:.06,v1:.95},
 walkway:{shape:'rect',u0:.04,u1:.96,v0:.3,v1:.72},
 'pier-stone':{shape:'rect',u0:.3,u1:.7,v0:.14,v1:.95},
 dock:{shape:'rect',u0:.1,u1:.9,v0:.4,v1:.92},
 'grass-patch':{shape:'ellipse',u0:.08,u1:.92,v0:.2,v1:.88},
 'grass-patch-2':{shape:'ellipse',u0:.065,u1:.935,v0:.23,v1:.87},
 'grass-patch-3':{shape:'ellipse',u0:.1,u1:.9,v0:.2,v1:.88},
};
const DEFAULT_WALK=new Set(['pier','pier-l','bridge','dock','bridge-arch','bridge-arch-v','walkway','pier-stone']);
export const isWalkway=(item:FishingItem)=>item.walk??DEFAULT_WALK.has(item.prop);
export const isSolid=(item:FishingItem)=>!isWalkway(item)&&(item.solid??DEFAULT_SOLID.has(item.prop));

/** Drawn size of a piece. */
export function itemSize(item:Pick<FishingItem,'prop'|'scale'>){const s=FISHING_PROPS[item.prop as FishingPropId]??{w:60,h:60},k=item.scale??1;return {w:s.w*k,h:s.h*k};}
/** World point of (u,v), fractions of the piece's picture (0,0 top left, 1,1 bottom right), after mirroring and turning. */
export function itemPoint(item:FishingItem,u:number,v:number){
 const {w,h}=itemSize(item),a=(item.rotation??0)*Math.PI/180,lx=(u-.5)*w*(item.flip?-1:1),ly=(v-.5)*h,cy=item.y-h/2;
 return {x:item.x+lx*Math.cos(a)-ly*Math.sin(a),y:cy+lx*Math.sin(a)+ly*Math.cos(a)};
}
/** The reverse of itemPoint: where a world point falls on the piece's picture. */
export function itemLocal(item:FishingItem,x:number,y:number){
 const {w,h}=itemSize(item),a=-(item.rotation??0)*Math.PI/180,dx=x-item.x,dy=y-(item.y-h/2);
 const lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a);
 return {u:lx/w*(item.flip?-1:1)+.5,v:ly/h+.5};
}
/** Solid ellipses on the floor: buildings, tree trunks, the arch's pillars. */
export interface FishingObstacle {id:string;x:number;y:number;rx:number;ry:number;}
export function footprints(item:FishingItem):FishingObstacle[]{
 const {w}=itemSize(item),k=item.scale??1;
 return (FOOTPRINTS[item.prop]??[{u:.5,dy:-8,rx:.3,ry:12}]).map((f,n)=>{const p=itemPoint(item,f.u,1);return {id:`${item.id}-${n}`,x:p.x,y:p.y+f.dy*k,rx:Math.max(4,f.rx*w),ry:Math.max(3,f.ry*k)};});
}
export const deckOf=(item:FishingItem):Deck=>DECKS[item.prop]??{shape:'rect',u0:.1,u1:.9,v0:.2,v1:.9};
const inDeck=(item:FishingItem,deck:Deck,x:number,y:number)=>{
 const {u,v}=itemLocal(item,x,y);
 if(deck.shape==='rect')return u>=deck.u0&&u<=deck.u1&&v>=deck.v0&&v<=deck.v1;
 return ((u-(deck.u0+deck.u1)/2)/((deck.u1-deck.u0)/2))**2+((v-(deck.v0+deck.v1)/2)/((deck.v1-deck.v0)/2))**2<1;
};

// ── The layout in use: these arrays and points are refilled in place by applyFishingLayout ──
export const FISHING_LAKES:FishingLake[]=[];
export const FISHING_STAIRS:FishingStairs[]=[];
export const FISHING_ITEMS:FishingItem[]=[];
export const FISHING_OBSTACLES:FishingObstacle[]=[];
export const FISHING_CASA={x:0,y:0};
/** The airship back to Praça Celeste, moored at the front of the lowest terrace. */
export const FISHING_AIRSHIP={x:0,y:FISHING_TERRACES[2].y1+30};
export const FISHING_SPAWN={x:0,y:0};
let stairs:ReturnType<typeof stairPlace>[]=[],ponds:({lake:FishingLake}&ReturnType<typeof pondPlace>)[]=[],walkways:{item:FishingItem;deck:Deck}[]=[];
let layout:FishingLayout,version=0;
/** The layout in use (do not change it: copy it) and a number that changes every time it is replaced. */
export const fishingLayout=():FishingLayout=>layout;
export const fishingLayoutVersion=()=>version;

const inRect=(r:Rect,x:number,y:number)=>x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1;
const inStair=(x:number,y:number)=>stairs.some(s=>{const t=(s.bottom.y-y)/(s.bottom.y-s.top.y);if(t<-.02||t>1.02)return false;const cx=s.bottom.x+(s.top.x-s.bottom.x)*t;return Math.abs(x-cx)<s.half;});
const pondAt=(x:number,y:number)=>ponds.find(p=>((x-p.lake.x)/p.block.rx)**2+((y-p.lake.y)/p.block.ry)**2<1);
/** On a walkway's deck (pier, bridge, island). */
export const onDeck=(x:number,y:number)=>walkways.some(w=>inDeck(w.item,w.deck,x,y));
const inObstacle=(x:number,y:number)=>FISHING_OBSTACLES.some(o=>((x-o.x)/o.rx)**2+((y-o.y)/o.ry)**2<1);
export const inLake=(lake:Pick<FishingLake,'x'|'y'|'rx'|'ry'>,x:number,y:number)=>((x-lake.x)/lake.rx)**2+((y-lake.y)/lake.ry)**2<1;
export const lakeAt=(x:number,y:number)=>FISHING_LAKES.find(lake=>inLake(lake,x,y));
/** The terrace under a point, if any. */
export const terraceAt=(x:number,y:number)=>FISHING_TERRACES.find(t=>inRect(t,x,y));
/** Inside something solid, in a pond (but not on a walkway over it), or off the terraces, stairs and walkways. */
export function fishingBlocked(x:number,y:number):boolean{
 if(inObstacle(x,y))return true;
 if(onDeck(x,y))return false;
 if(!terraceAt(x,y)&&!inStair(x,y))return true;
 return !!pondAt(x,y);
}

/**
 * Where a player stands to fish, facing the water, and where the float lands. One player per spot:
 * around each pond's rim and out on the walkways over it. `fish` is the pond's fish table.
 */
export interface FishingSpot {id:string;lake:string;fish:FishTable;x:number;y:number;facing:1|-1;bobX:number;bobY:number;}
/** How close (px) a player must stand to a spot to fish from it. */
export const SPOT_REACH=48;
export const FISHING_SPOTS:FishingSpot[]=[];
function spot(lake:FishingLake,id:string,x:number,y:number,bobX:number,bobY:number):FishingSpot{
 x=Math.round(x);y=Math.round(y);bobX=Math.round(bobX);bobY=Math.round(bobY);
 // Straight above or below the float: lean a little so the player faces one side.
 if(bobX===x)bobX+=bobX>=lake.x?-3:3;
 return {id,lake:lake.id,fish:lake.fish,x,y,facing:bobX>x?1:-1,bobX,bobY};
}
function lakeSpots(lake:FishingLake):FishingSpot[]{
 const {block}=pondPlace(lake),n=Math.max(6,Math.min(16,Math.round(Math.PI*(block.rx+block.ry)/240))),list:FishingSpot[]=[];
 for(let i=0;i<n;i++){const a=(15+i*360/n)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  list.push(spot(lake,`${lake.id}-${i+1}`,lake.x+(block.rx+18)*c,lake.y+(block.ry+(s<0?6:22))*s,lake.x+lake.rx*.6*c,lake.y+lake.ry*.45*s));}
 // Out on the walkways over the water: the points of each deck that look onto open water.
 const water={x:lake.x,y:lake.y,rx:block.rx,ry:block.ry},open={x:lake.x,y:lake.y,rx:lake.rx*.9,ry:lake.ry*.9};let n2=0;
 for(const w of walkways){const d=w.deck;
  for(const v of [.2,.5,.8])for(const u of [.15,.5,.85]){
   const p=itemPoint(w.item,d.u0+(d.u1-d.u0)*u,d.v0+(d.v1-d.v0)*v);if(!inDeck(w.item,d,p.x,p.y)||!inLake(water,p.x,p.y))continue;
   const dx=lake.x-p.x,dy=lake.y-p.y,len=Math.hypot(dx,dy)||1,far=Math.min(170,len*.7),bx=p.x+dx/len*far,by=p.y+dy/len*far;
   if(!inLake(open,bx,by)||onDeck(bx,by)||inObstacle(bx,by))continue;
   list.push(spot(lake,`${lake.id}-d${++n2}`,p.x,p.y,bx,by));}
 }
 return list;
}
/** Floating lily pads and lotus: the float never lands on one (pedido do matheus: o respingo passava por cima). */
const PAD=/^(lily|lotus)/;
function clearOfPads(lake:FishingLake,s:FishingSpot):FishingSpot{
 const pads=FISHING_ITEMS.filter(i=>i.layer==='water'&&PAD.test(i.prop)).map(i=>{const {w,h}=itemSize(i);return {x:i.x,y:i.y-h/2,r:Math.max(w,h)/2+22};});
 let {bobX,bobY}=s;
 for(let n=0;n<24&&pads.some(p=>Math.hypot((bobX-p.x),(bobY-p.y)*1.6)<p.r);n++){
  // Slide the float around the lake's middle, toward the open water.
  const a=Math.atan2((bobY-lake.y)/lake.ry,(bobX-lake.x)/lake.rx)+(n%2?1:-1)*.05*(n+1),k=Math.max(.25,.6-n*.012);
  bobX=lake.x+lake.rx*k*Math.cos(a);bobY=lake.y+lake.ry*k*.75*Math.sin(a);
 }
 return {...s,bobX:Math.round(bobX),bobY:Math.round(bobY),facing:bobX>s.x?1:-1};
}
/** Spots on free floor, at least a body apart. */
function placeSpots(){
 const list:FishingSpot[]=[];
 for(const lake of FISHING_LAKES)for(const raw of lakeSpots(lake)){
  const s=clearOfPads(lake,raw);
  if(fishingBlocked(s.x,s.y)||!inLake(lake,s.bobX,s.bobY)||onDeck(s.bobX,s.bobY))continue;
  if(list.some(o=>Math.hypot(o.x-s.x,o.y-s.y)<60))continue;
  list.push(s);}
 FISHING_SPOTS.splice(0,FISHING_SPOTS.length,...list);
}

/**
 * A layout published for this map, or the shipped one: layouts published in the /admin for the old,
 * twice as wide garden (before 20/10) no longer fit and are ignored until republished.
 */
export function publishedFishingLayout(layout:FishingLayout|undefined):FishingLayout{
 if(!layout)return defaultFishingLayout();
 const fits=[...layout.lakes,...layout.items,layout.spawn].every(p=>p.x>=0&&p.x<=FISHING_WIDTH&&p.y>=0&&p.y<=FISHING_HEIGHT)&&layout.airship.x<=FISHING_WIDTH;
 return fits?layout:defaultFishingLayout();
}
/** Makes `next` the Pescaria everyone walks and fishes in (server and game). */
export function applyFishingLayout(next:FishingLayout){
 layout=structuredClone(next);
 FISHING_LAKES.splice(0,FISHING_LAKES.length,...layout.lakes.map(lakeOf));
 FISHING_STAIRS.splice(0,FISHING_STAIRS.length,...layout.stairs);
 FISHING_ITEMS.splice(0,FISHING_ITEMS.length,...layout.items);
 Object.assign(FISHING_CASA,layout.casa);FISHING_AIRSHIP.x=layout.airship.x;Object.assign(FISHING_SPAWN,layout.spawn);
 stairs=FISHING_STAIRS.map(stairPlace);
 ponds=FISHING_LAKES.map(lake=>({lake,...pondPlace(lake)}));
 walkways=FISHING_ITEMS.filter(isWalkway).map(item=>({item,deck:deckOf(item)}));
 // No Casa de Pesca building since 20/10 (pedido do matheus): the shop opens from the Trocas button.
 FISHING_OBSTACLES.splice(0,FISHING_OBSTACLES.length,...FISHING_ITEMS.filter(isSolid).flatMap(footprints));
 open=null;fields.clear();
 placeSpots();version++;
}

// ── Walking: a grid of walkable cells, a distance field per destination and straight lines where they fit ──
const CELL=8,COLS=Math.ceil(FISHING_WIDTH/CELL),ROWS=Math.ceil(FISHING_HEIGHT/CELL);
let open:Uint8Array|null=null;
/** A cell is open when its centre and a little around it are walkable, so walking from cell to cell never clips the water. */
function grid(){
 if(open)return open;open=new Uint8Array(COLS*ROWS);
 const around=[[0,0],[-3,-3],[3,-3],[-3,3],[3,3]];
 for(let r=0;r<ROWS;r++)for(let q=0;q<COLS;q++){const x=q*CELL+CELL/2,y=r*CELL+CELL/2;open[r*COLS+q]=around.every(([dx,dy])=>!fishingBlocked(x+dx,y+dy))?1:0;}
 return open;
}
const cellOf=(x:number,y:number)=>{const q=Math.max(0,Math.min(COLS-1,Math.floor(x/CELL))),r=Math.max(0,Math.min(ROWS-1,Math.floor(y/CELL)));return r*COLS+q;};
const centre=(i:number)=>({x:(i%COLS)*CELL+CELL/2,y:Math.floor(i/COLS)*CELL+CELL/2});
/** The open cell nearest to a point (rings outward), or -1. */
function nearestOpen(x:number,y:number,radius=60):number{
 const g=grid(),q0=Math.floor(x/CELL),r0=Math.floor(y/CELL);let best=-1,bestD=Infinity;
 for(let k=0;k<=radius;k++){
  for(let dr=-k;dr<=k;dr++)for(let dq=-k;dq<=k;dq++){
   if(Math.max(Math.abs(dr),Math.abs(dq))!==k)continue;const q=q0+dq,r=r0+dr;if(q<0||r<0||q>=COLS||r>=ROWS)continue;
   const i=r*COLS+q;if(!g[i])continue;const c=centre(i),d=(c.x-x)**2+(c.y-y)**2;if(d<bestD){bestD=d;best=i;}
  }
  if(best>=0&&k*CELL>Math.sqrt(bestD))return best;
 }
 return best;
}
/** Nearest walkable point: a click on water, a cliff or a building goes to the closest floor. */
export function fishingFree(x:number,y:number):{x:number;y:number}{
 const px=Math.max(0,Math.min(FISHING_WIDTH,x)),py=Math.max(0,Math.min(FISHING_HEIGHT,y));
 if(!fishingBlocked(px,py))return {x:px,y:py};
 const i=nearestOpen(px,py);return i<0?{...FISHING_SPAWN}:centre(i);
}
const NEIGHBOURS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const;
/** Straight and diagonal steps in whole units (5 : 7 ≈ 1 : √2), so a circular bucket queue (Dial) does the search. */
const STEP=[5,5,5,5,7,7,7,7],FAR=0x7fffffff;
const fields=new Map<number,Int32Array>();
/** Walking distance from every open cell to `goal` (few destinations, cached). */
function field(goal:number):Int32Array{
 const cached=fields.get(goal);if(cached){fields.delete(goal);fields.set(goal,cached);return cached;}
 const g=grid(),dist=new Int32Array(COLS*ROWS).fill(FAR),buckets:number[][]=Array.from({length:8},()=>[]);
 dist[goal]=0;buckets[0].push(goal);let pending=1;
 for(let d=0;pending>0;d++){
  const list=buckets[d&7];if(!list.length)continue;buckets[d&7]=[];pending-=list.length;
  for(const i of list){if(dist[i]!==d)continue;const q=i%COLS,r=(i-q)/COLS;
   for(let k=0;k<8;k++){const nq=q+NEIGHBOURS[k][0],nr=r+NEIGHBOURS[k][1];if(nq<0||nr<0||nq>=COLS||nr>=ROWS)continue;const m=nr*COLS+nq;if(!g[m])continue;
    if(k>=4&&(!g[r*COLS+nq]||!g[nr*COLS+q]))continue;const nd=d+STEP[k];if(nd<dist[m]){dist[m]=nd;buckets[nd&7].push(m);pending++;}}}
 }
 fields.set(goal,dist);if(fields.size>48)fields.delete(fields.keys().next().value!);
 return dist;
}
/** A straight walk between two points crosses nothing solid. */
export function fishingClear(a:{x:number;y:number},b:{x:number;y:number}):boolean{
 const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3);
 for(let i=1;i<=n;i++){const k=i/n;if(fishingBlocked(a.x+(b.x-a.x)*k,a.y+(b.y-a.y)*k))return false;}
 return true;
}
/** Next point to head for: the destination when the line is clear, else the farthest visible cell down the path. */
export function fishingWaypoint(from:{x:number;y:number},to:{x:number;y:number}):{x:number;y:number}{
 if(fishingClear(from,to))return to;
 const goal=nearestOpen(to.x,to.y);if(goal<0)return from;
 const dist=field(goal);let i=cellOf(from.x,from.y);
 if(dist[i]===FAR){const near=nearestOpen(from.x,from.y,4);if(near<0||dist[near]===FAR)return from;i=near;}
 let best=centre(i),first:{x:number;y:number}|undefined,seen=false;
 for(let n=0;n<80&&dist[i]>0;n++){
  const q=i%COLS,r=(i-q)/COLS;let next=-1,nextD=dist[i];
  for(const [dq,dr] of NEIGHBOURS){const nq=q+dq,nr=r+dr;if(nq<0||nr<0||nq>=COLS||nr>=ROWS)continue;const k=nr*COLS+nq;if(dist[k]<nextD){nextD=dist[k];next=k;}}
  if(next<0)break;i=next;const c=dist[i]===0?to:centre(i);first??=c;
  if(fishingClear(from,c)){best=c;seen=true;}else if(n>6)break;
 }
 // Nothing down the path is in plain sight (standing right at an edge): one cell at a time.
 return seen?best:first??best;
}
/** One walking step of at most `distance` px toward `to`, along the path (stairs, piers, around water). */
export function fishingStep(from:{x:number;y:number},to:{x:number;y:number},distance:number):{x:number;y:number}{
 const target=fishingFree(to.x,to.y);let p={x:from.x,y:from.y},left=distance;
 for(let n=0;n<4&&left>1e-6;n++){
  const w=fishingWaypoint(p,target),d=Math.hypot(w.x-p.x,w.y-p.y);
  if(d<1e-6)break;let k=Math.min(1,left/d);
  // A step that would clip a corner of water gets shorter; right at the edge, it slides onto the nearest open cell.
  while(k*d>.5&&fishingBlocked(p.x+(w.x-p.x)*k,p.y+(w.y-p.y)*k))k/=2;
  if(fishingBlocked(p.x+(w.x-p.x)*k,p.y+(w.y-p.y)*k)){const i=nearestOpen(p.x,p.y,2);if(i<0)break;const c=centre(i);left-=Math.hypot(c.x-p.x,c.y-p.y);p=c;continue;}
  p={x:p.x+(w.x-p.x)*k,y:p.y+(w.y-p.y)*k};left-=d*k;
 }
 return fishingBlocked(p.x,p.y)?{x:from.x,y:from.y}:p;
}
export function nearestSpot(x:number,y:number,lake?:string):FishingSpot|undefined{
 let best:FishingSpot|undefined,bestD=Infinity;
 for(const spot of FISHING_SPOTS){if(lake&&spot.lake!==lake)continue;const d=Math.hypot(spot.x-x,spot.y-y);if(d<bestD){best=spot;bestD=d;}}
 return best;
}

// ── The Pescaria as shipped ──
/** Small deterministic generator, so the garden is the same on every machine. */
function random(seed:number){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
/**
 * The garden since 20/10 (pedido do matheus: menor, um lago só, sem a Casa de Pesca): a narrow lookout
 * with trees at the back, the lawn with the Lago das Ninfeias (island, bridge, pier, boat) in the middle
 * and the quay with the airship at the front. Every fish lives in this one lake.
 */
export function defaultFishingLayout():FishingLayout{
 const lakes:FishingLakeDef[]=[{id:'ninfeias',name:'Lago das Ninfeias',fish:'ninfeias',art:'pond-clear',x:1130,y:1285,width:1750}];
 const placed=lakes.map(d=>{const lake=lakeOf(d);return {lake,...pondPlace(lake)};});
 const [MIRANTE,JARDIM,CAIS]=FISHING_TERRACES;
 const items:FishingItem[]=[],counts=new Map<string,number>();
 const add=(prop:FishingPropId,x:number,y:number,more:Partial<FishingItem>={})=>{const n=(counts.get(prop)??0)+1;counts.set(prop,n);
  items.push({id:`${prop}-${n}`,prop,x:Math.round(x),y:Math.round(y),layer:'stand',...more,...(more.scale!==undefined?{scale:Math.round(more.scale*1000)/1000}:{})});};
 // The lawn: a few patches of lighter grass and tufts, kept out of the water and off the paths.
 const r=random(11),dry=(x:number,y:number)=>!placed.some(p=>((x-p.lake.x)/(p.w*.56))**2+((y-p.lake.y)/(p.h*.66))**2<1);
 for(const t of [MIRANTE,JARDIM]){
  const patches=t===JARDIM?7:3,tufts=t===JARDIM?26:10;
  for(let n=0;n<patches;n++){const x=t.x0+80+r()*(t.x1-t.x0-160),y=t.y0+90+r()*(t.y1-t.y0-140);if(!dry(x,y))continue;add((['grass-patch','grass-patch-2','grass-patch-3'] as const)[n%3],x,y,{layer:'ground',flip:r()<.5,scale:.8+r()*.3});}
  for(let n=0;n<tufts;n++){const x=t.x0+40+r()*(t.x1-t.x0-80),y=t.y0+70+r()*(t.y1-t.y0-90);if(!dry(x,y))continue;add((['tuft-1','tuft-2','tuft-3'] as const)[n%3],x,y,{layer:'ground',flip:r()<.5,scale:.7+r()*.4});}
 }
 // The island, ringed by rocks, with the arched bridge to the east shore and the pier from the front:
 // both with their stone heads on dry ground (pedido do matheus: nada de ponte dentro da água).
 const lily=placed[0].lake,island={x:lily.x+318,y:lily.y-9,rx:127,ry:49};
 add('grass-patch-2',island.x,island.y+68,{layer:'ground',scale:1.32,walk:true});
 for(const [dx,dy,s] of [[-1,.55,.5],[.1,.95,.55],[.95,.45,.48],[-.5,1,.42]] as const)add('pond-rocks',island.x+dx*island.rx,island.y+dy*island.ry,{layer:'ground',scale:s});
 add('bridge-arch',lily.x+591,lily.y+62,{layer:'ground',scale:.85});
 add('pier-stone',lily.x-420,lily.y+190,{layer:'ground',scale:.9});
 // Floating over the clean water (the pond is painted without them): the rowboat, lily pads and lotus that bob.
 add('rowboat',lily.x-lily.rx*.15,lily.y+FISHING_PROPS.rowboat.h*.45,{layer:'water'});
 for(const [prop,dx,dy] of [['lotus-1',-.82,-.15],['lily-pad-1',-.86,.22],['lily-pad-3',-.66,-.5],['lily-cluster',-.33,.62],['lily-pad-2',-.3,-.72],['lily-pad-4',-.05,.72],['lotus-2',.12,-.7],['lily-pad-1',.2,.66],['lily-pad-3',.72,.62],['lily-cluster',.78,-.55]] as const)add(prop,lily.x+dx*lily.rx,lily.y+dy*lily.ry,{layer:'water'});
 add('cherry',island.x+10,island.y-4,{scale:.68});
 // Around the lake: the sign, a basket, a bucket, flowers, reeds and lanterns at the bridge.
 const {block}=placed[0],front=lily.y+block.ry+30;
 add('lake-sign',lily.x-block.rx*.78,front-10,{lake:lily.id});
 add('fish-basket',lily.x+block.rx*.95,lily.y+block.ry*.55+26,{scale:.9});add('bait-bucket',lily.x-block.rx*.97,lily.y+block.ry*.5+24,{scale:.85});
 add('hydrangea',lily.x+block.rx*.62,front+8,{scale:.8});add('reeds',lily.x+block.rx*.98,lily.y-block.ry*.2,{scale:.75,flip:true});add('reeds',lily.x-block.rx*.98,lily.y-block.ry*.1,{scale:.7});
 add('paper-lantern',lily.x+850,lily.y-30,{scale:.7});
 // Trees framing the lawn and the lookout; cypresses at the corners; the lookout's pagoda.
 add('willow',230,1150);add('cherry',2010,1162,{flip:true});add('willow',1960,MIRANTE.y1-30,{flip:true});add('cherry',380,MIRANTE.y1-40);
 add('pagoda',1150,MIRANTE.y1-24);
 for(const [x,y] of [[40,620],[2270,620],[30,1220],[2280,1220],[2250,1830]] as const)add('cypress-pair',x,y,{flip:x>FISHING_WIDTH/2});
 for(const x of [700,1600])add('hedge-low',x,MIRANTE.y0+60,{scale:.9});
 for(const x of [520,1700])add('flower-bed',x,JARDIM.y0+30,{scale:.85});
 // The quay: only the arch to the airship, lanterns and flowers (pedido do matheus: sem as barracas na chegada).
 add('arch',640,CAIS.y1-60);
 add('paper-lantern',900,CAIS.y1-90,{scale:.85});add('hydrangea',1200,CAIS.y1-30,{scale:.8});add('paper-lantern',1500,CAIS.y1-90,{scale:.85});add('hydrangea',1980,CAIS.y1-30,{scale:.75,flip:true});
 return {lakes,items,
  stairs:[{id:'escada-mirante',upper:'mirante',x:600,art:'narrow'},{id:'escada-cais',upper:'jardim',x:1600,art:'grand'}],
  casa:{x:1150,y:CAIS.y1-50},airship:{x:400},spawn:{x:620,y:CAIS.y1-80}};
}
applyFishingLayout(defaultFishingLayout());
