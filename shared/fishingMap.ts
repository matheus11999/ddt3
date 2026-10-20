/**
 * The Pescaria's ground (docs/fishing.md): a terraced sky garden, three terraces one above the other
 * joined by stone stairs that climb the walls. Lawns with five ponds sunk into the grass (two on the top
 * terrace, three on the middle one, the biggest with an island, a bridge and a pier) and the Casa de
 * Pesca on the stone quay at the bottom. Players walk on the terraces, the stairs, the pier, the bridge
 * and the island; water, buildings and tree trunks block. The server walks everyone with `fishingStep`
 * (a path over a grid, so going up and down the stairs needs no help from the client).
 *
 * World px like the plaza; the view is 1536×864 and the camera follows the player on both axes.
 * Ponds, piers and stairs are pieces painted by Codex (public/assets/fishing/source/, cut by
 * `npm run build:fishing`), seen from above at the map's angle.
 */
export const FISHING_WIDTH=4608;
export const FISHING_HEIGHT=2620;
export type Zone='plaza'|'fishing';

interface Rect {x0:number;x1:number;y0:number;y1:number;}
/** Terraces, top to bottom (y is depth: smaller y is farther back and higher up). */
export interface FishingTerrace extends Rect {id:string;name:string;}
export const FISHING_TERRACES:readonly FishingTerrace[]=[
 {id:'mirante',name:'Mirante das Fontes',x0:120,x1:4488,y0:700,y1:1180},
 {id:'jardim',name:'Jardim dos Lagos',x0:110,x1:4498,y0:1320,y1:2080},
 {id:'cais',name:'Cais das Nuvens',x0:150,x1:4458,y0:2220,y1:2440},
];

/** A painted stair climbing a retaining wall: its picture's size and the walkable line up its steps. */
export const STAIR_ART={w:588,h:360,bottom:{x:70,y:330},top:{x:520,y:30},half:50,scale:.556};
/**
 * Stairs from the front edge of `upper` down to the terrace below. `x` is the picture's left edge;
 * `flip` mirrors it (climbing to the left). Walkable along the band from the bottom landing to the top.
 */
export interface FishingStairs {id:string;upper:'mirante'|'jardim';x:number;flip?:boolean;}
export const FISHING_STAIRS:readonly FishingStairs[]=[
 {id:'escada-mirante-oeste',upper:'mirante',x:280},
 {id:'escada-mirante-meio',upper:'mirante',x:2420},
 {id:'escada-mirante-leste',upper:'mirante',x:4090,flip:true},
 {id:'escada-cais-oeste',upper:'jardim',x:1480},
 {id:'escada-cais-leste',upper:'jardim',x:2700},
];
/** Where a stair's picture sits and its walkable band, in world px. */
export function stairPlace(s:FishingStairs){
 const upper=FISHING_TERRACES.find(t=>t.id===s.upper)!,k=STAIR_ART.scale,w=STAIR_ART.w*k,h=STAIR_ART.h*k,top=upper.y1-30;
 const px=(x:number)=>s.flip?s.x+w-x*k:s.x+x*k;
 return {x:s.x,y:top,w,h,flip:!!s.flip,bottom:{x:px(STAIR_ART.bottom.x),y:top+STAIR_ART.bottom.y*k},top:{x:px(STAIR_ART.top.x),y:top+STAIR_ART.top.y*k},half:STAIR_ART.half*k};
}
const STAIRS=FISHING_STAIRS.map(stairPlace);
const inStair=(x:number,y:number)=>STAIRS.some(s=>{const t=(s.bottom.y-y)/(s.bottom.y-s.top.y);if(t<-.02||t>1.02)return false;const cx=s.bottom.x+(s.top.x-s.bottom.x)*t;return Math.abs(x-cx)<s.half;});

/**
 * A painted pond sunk into the lawn: `art` is the piece, `aspect` its width over its height and the
 * water an ellipse (cx,cy,rx,ry) in fractions of the piece. Everything outside the water is its
 * stone and grass rim.
 */
export interface PondArt {art:string;aspect:number;cx:number;cy:number;rx:number;ry:number;}
export const POND_ART:Record<string,PondArt>={
 ninfeias:{art:'pond-lily',aspect:1095/263,cx:.51,cy:.54,rx:.41,ry:.32},
 profundo:{art:'pond-well',aspect:1114/299,cx:.51,cy:.51,rx:.39,ry:.29},
 cristal:{art:'pond-crystal',aspect:1190/227,cx:.5,cy:.5,rx:.43,ry:.36},
 juncos:{art:'pond-reeds',aspect:1179/247,cx:.51,cy:.55,rx:.41,ry:.32},
 termal:{art:'pond-well',aspect:1114/299,cx:.51,cy:.51,rx:.39,ry:.29},
};
/** Water: `x,y,rx,ry` is the surface (where the float lands); `width` is the painted pond's. */
export interface FishingLake {id:string;name:string;x:number;y:number;rx:number;ry:number;width:number;}
const pond=(id:string,name:string,x:number,y:number,width:number):FishingLake=>{const a=POND_ART[id],h=width/a.aspect;return {id,name,x,y,rx:a.rx*width,ry:a.ry*h,width};};
export const FISHING_LAKES:readonly FishingLake[]=[
 pond('ninfeias','Lago das Ninfeias',1750,1700,1600),
 pond('profundo','Poço Azul',3350,1560,800),
 pond('juncos','Lago dos Juncos',4000,1900,760),
 pond('cristal','Lagoa de Cristal',1250,960,900),
 pond('termal','Fonte Termal',3300,960,820),
];
/** A pond's picture (left, top, size) and the solid ellipse of water and rim stones, in world px. */
export function pondPlace(lake:FishingLake){
 const a=POND_ART[lake.id],w=lake.width,h=w/a.aspect,left=lake.x-a.cx*w,top=lake.y-a.cy*h;
 return {x:left,y:top,w,h,block:{rx:lake.rx+w*.035,ry:lake.ry+h*.1}};
}
const PONDS=FISHING_LAKES.map(lake=>({lake,...pondPlace(lake)}));
/** The island in the Lago das Ninfeias, reached by the bridge: walkable ellipse. */
const LILY=FISHING_LAKES[0];
export const FISHING_ISLAND={x:LILY.x+300,y:LILY.y-8,rx:120,ry:46};
/** Wooden walkways over the water: the bridge to the island and a pier out from the front shore. */
export interface FishingPier extends Rect {id:string;lake:string;kind:'pier'|'bridge';}
export const FISHING_PIERS:readonly FishingPier[]=[
 {id:'ponte-ilha',lake:'ninfeias',kind:'bridge',x0:FISHING_ISLAND.x+FISHING_ISLAND.rx-30,x1:LILY.x+LILY.rx+70,y0:LILY.y-26,y1:LILY.y+8},
 {id:'pier-ninfeias',lake:'ninfeias',kind:'pier',x0:LILY.x-420,x1:LILY.x-372,y0:LILY.y+20,y1:LILY.y+LILY.ry+90},
];
const inWater=(x:number,y:number)=>PONDS.some(p=>((x-p.lake.x)/p.block.rx)**2+((y-p.lake.y)/p.block.ry)**2<1);
const onIsland=(x:number,y:number)=>((x-FISHING_ISLAND.x)/FISHING_ISLAND.rx)**2+((y-FISHING_ISLAND.y)/FISHING_ISLAND.ry)**2<1;
/** Solid things on the floor: buildings, tree trunks and the arch's pillars. */
export interface FishingObstacle {id:string;x:number;y:number;rx:number;ry:number;}
export const FISHING_OBSTACLES:readonly FishingObstacle[]=[
 {id:'casa',x:2300,y:2365,rx:300,ry:42},
 {id:'barraca',x:1150,y:2355,rx:170,ry:30},
 {id:'quiosque',x:3350,y:2355,rx:140,ry:30},
 {id:'deque',x:3900,y:2370,rx:120,ry:30},
 {id:'mirante-pagode',x:2250,y:990,rx:95,ry:26},
 {id:'arco-oeste',x:700,y:2370,rx:24,ry:12},
 {id:'arco-leste',x:870,y:2370,rx:24,ry:12},
 {id:'salgueiro-1',x:500,y:900,rx:34,ry:12},
 {id:'cerejeira-1',x:2700,y:930,rx:34,ry:12},
 {id:'salgueiro-2',x:4150,y:930,rx:34,ry:12},
 {id:'salgueiro-3',x:420,y:1560,rx:34,ry:12},
 {id:'cerejeira-2',x:2760,y:1480,rx:34,ry:12},
 {id:'cerejeira-3',x:3000,y:1980,rx:34,ry:12},
 {id:'cerejeira-ilha',x:FISHING_ISLAND.x+10,y:FISHING_ISLAND.y-14,rx:30,ry:10},
];
/** The airship back to Praça Celeste, moored at the front of the lowest terrace. */
export const FISHING_AIRSHIP={x:430,y:2470};
export const FISHING_SPAWN={x:560,y:2340};
/** Bounds of every walkable point (the protocol's move limits). */
export const FISHING_WALK={minX:110,maxX:4498,minY:700,maxY:2440};

const inRect=(r:Rect,x:number,y:number)=>x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1;
export const inLake=(lake:FishingLake,x:number,y:number)=>((x-lake.x)/lake.rx)**2+((y-lake.y)/lake.ry)**2<1;
/**
 * Where a player stands to fish, facing the water, and where the float lands.
 * One player per spot: around each pond's rim, on the island and at the pier's end.
 */
export interface FishingSpot {id:string;lake:string;x:number;y:number;facing:1|-1;bobX:number;bobY:number;}
const AROUND=[150,210,250,290,330,30];
const pondSpots=(lake:FishingLake):FishingSpot[]=>{
 const {block}=pondPlace(lake),angles=lake.id==='ninfeias'?[150,190,230,266,310,60,120]:AROUND;
 const list=angles.map((deg,i)=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=Math.round(lake.x+(block.rx+18)*c),y=Math.round(lake.y+(block.ry+(s<0?6:22))*s),bobX=Math.round(lake.x+lake.rx*.6*c),bobY=Math.round(lake.y+lake.ry*.45*s);
  return {id:`${lake.id}-${i+1}`,lake:lake.id,x,y,facing:(bobX>=x?1:-1) as 1|-1,bobX,bobY};});
 if(lake.id==='ninfeias'){const i=FISHING_ISLAND,pier=FISHING_PIERS[1];
  list.push({id:'ninfeias-ilha',lake:lake.id,x:i.x-i.rx+30,y:i.y+8,facing:-1,bobX:i.x-i.rx-140,bobY:i.y+10},
   {id:'ninfeias-pier',lake:lake.id,x:(pier.x0+pier.x1)/2,y:pier.y0+14,facing:1,bobX:(pier.x0+pier.x1)/2+150,bobY:pier.y0-10});}
 return list;
};

export const lakeAt=(x:number,y:number)=>FISHING_LAKES.find(lake=>inLake(lake,x,y));
const inObstacle=(x:number,y:number)=>FISHING_OBSTACLES.some(o=>((x-o.x)/o.rx)**2+((y-o.y)/o.ry)**2<1);
/** The terrace under a point, if any. */
export const terraceAt=(x:number,y:number)=>FISHING_TERRACES.find(t=>inRect(t,x,y));
/** Off the terraces and the stairs, in a pond (but not on its bridge, pier or island) or inside something solid. */
export function fishingBlocked(x:number,y:number):boolean{
 if(!terraceAt(x,y)&&!inStair(x,y))return true;
 if(inObstacle(x,y))return true;
 return inWater(x,y)&&!onIsland(x,y)&&!FISHING_PIERS.some(p=>inRect(p,x,y));
}

/** Every spot that stands on free floor. */
export const FISHING_SPOTS:readonly FishingSpot[]=FISHING_LAKES.flatMap(lake=>pondSpots(lake).filter(s=>!fishingBlocked(s.x,s.y)));
/** How close (px) a player must stand to a spot to fish from it. */
export const SPOT_REACH=48;

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
