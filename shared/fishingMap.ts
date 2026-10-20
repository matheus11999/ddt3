/**
 * The Pescaria's ground (docs/fishing.md): a terraced sky garden, three stone terraces one above the
 * other joined by stairs, with a lake on each side of the middle terrace and one on the top terrace
 * whose waterfall feeds the Poço Azul. Players walk on the terraces, the stairs, the piers and the
 * bridge; water, buildings and tree trunks block. The server walks everyone with `fishingStep`
 * (a path over a grid, so going up and down the stairs needs no help from the client).
 *
 * World px like the plaza; the view is 1536×864 and the camera follows the player on both axes.
 */
export const FISHING_WIDTH=4608;
export const FISHING_HEIGHT=1728;
export type Zone='plaza'|'fishing';

interface Rect {x0:number;x1:number;y0:number;y1:number;}
/** Stone terraces, top to bottom (y is depth: smaller y is farther back and higher up). */
export interface FishingTerrace extends Rect {id:string;name:string;}
export const FISHING_TERRACES:readonly FishingTerrace[]=[
 {id:'mirante',name:'Mirante da Cascata',x0:150,x1:4458,y0:648,y1:852},
 {id:'jardim',name:'Jardim dos Lagos',x0:110,x1:4498,y0:990,y1:1330},
 {id:'cais',name:'Cais das Nuvens',x0:190,x1:4418,y0:1440,y1:1610},
];
/** Stone stairs down the cliff between two terraces (walkable, they overlap both). */
export interface FishingStairs extends Rect {id:string;}
export const FISHING_STAIRS:readonly FishingStairs[]=[
 {id:'escada-mirante-oeste',x0:1880,x1:2000,y0:820,y1:1010},
 {id:'escada-mirante-leste',x0:4230,x1:4350,y0:820,y1:1010},
 {id:'escada-cais-oeste',x0:690,x1:810,y0:1300,y1:1460},
 {id:'escada-cais-leste',x0:2560,x1:2680,y0:1300,y1:1460},
];

export interface FishingLake {id:string;name:string;x:number;y:number;rx:number;ry:number;}
/** Water: ellipses inside the terraces. */
export const FISHING_LAKES:readonly FishingLake[]=[
 {id:'ninfeias',name:'Lago das Ninfeias',x:1180,y:1150,rx:470,ry:104},
 {id:'profundo',name:'Poço Azul',x:3560,y:1150,rx:520,ry:104},
 {id:'cristal',name:'Lagoa de Cristal',x:3560,y:752,rx:400,ry:62},
];
/** Wooden piers and the bridge to the Casa de Pesca: walkable over the water. */
export interface FishingPier extends Rect {id:string;lake:string;kind:'pier'|'bridge';}
export const FISHING_PIERS:readonly FishingPier[]=[
 {id:'ponte-casa',lake:'ninfeias',kind:'bridge',x0:1150,x1:1210,y0:1150,y1:1300},
 {id:'pier-profundo-oeste',lake:'profundo',kind:'pier',x0:3300,x1:3360,y0:1110,y1:1300},
 {id:'pier-profundo-leste',lake:'profundo',kind:'pier',x0:3780,x1:3840,y0:1110,y1:1300},
 {id:'pier-cristal',lake:'cristal',kind:'pier',x0:3530,x1:3590,y0:660,y1:768},
];
/** Solid things on the floor: the Casa de Pesca's island, the waterfall, tree trunks and the dock. */
export interface FishingObstacle {id:string;x:number;y:number;rx:number;ry:number;}
export const FISHING_OBSTACLES:readonly FishingObstacle[]=[
 {id:'casa',x:1180,y:1112,rx:132,ry:44},
 {id:'cascata',x:3560,y:1010,rx:64,ry:42},
 {id:'arvore-mirante-1',x:520,y:700,rx:40,ry:14},
 {id:'arvore-mirante-2',x:1460,y:690,rx:40,ry:14},
 {id:'arvore-mirante-3',x:4020,y:700,rx:40,ry:14},
 {id:'arvore-jardim-1',x:2330,y:1030,rx:40,ry:14},
 {id:'arvore-jardim-2',x:4380,y:1060,rx:34,ry:12},
 {id:'arvore-cais-1',x:1700,y:1470,rx:40,ry:14},
 {id:'arvore-cais-2',x:3300,y:1475,rx:40,ry:14},
];
/** The airship back to Praça Celeste, moored at the front of the lowest terrace. */
export const FISHING_AIRSHIP={x:430,y:1640};
export const FISHING_SPAWN={x:560,y:1540};
/** Bounds of every walkable point (the protocol's move limits). */
export const FISHING_WALK={minX:110,maxX:4498,minY:648,maxY:1610};

const inRect=(r:Rect,x:number,y:number)=>x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1;
export const inLake=(lake:FishingLake,x:number,y:number)=>((x-lake.x)/lake.rx)**2+((y-lake.y)/lake.ry)**2<1;
/**
 * Where a player stands to fish, facing the water, and where the float lands.
 * One player per spot.
 */
export interface FishingSpot {id:string;lake:string;x:number;y:number;facing:1|-1;bobX:number;bobY:number;}
const shoreSpots=(lake:FishingLake):FishingSpot[]=>[
 {id:`${lake.id}-oeste`,lake:lake.id,x:lake.x-lake.rx-34,y:lake.y,facing:1,bobX:lake.x-lake.rx+170,bobY:lake.y+10},
 {id:`${lake.id}-leste`,lake:lake.id,x:lake.x+lake.rx+34,y:lake.y,facing:-1,bobX:lake.x+lake.rx-170,bobY:lake.y+10},
 {id:`${lake.id}-margem-1`,lake:lake.id,x:lake.x-lake.rx*.62,y:lake.y+lake.ry*.8+26,facing:1,bobX:lake.x-lake.rx*.44,bobY:lake.y+lake.ry*.2},
 {id:`${lake.id}-margem-2`,lake:lake.id,x:lake.x+lake.rx*.62,y:lake.y+lake.ry*.8+26,facing:-1,bobX:lake.x+lake.rx*.44,bobY:lake.y+lake.ry*.2},
];
const deckSpots=(lake:FishingLake,p:FishingPier,n:number):FishingSpot[]=>{
 // A pier fishes from its tip (the end over the water); the bridge from its middle.
 const mid=(p.x0+p.x1)/2,ry=p.kind==='bridge'?(p.y0+p.y1)/2+8:inLake(lake,mid,p.y0+4)?p.y0+16:p.y1-16;
 return [
  {id:`${lake.id}-${p.kind}${n}-oeste`,lake:lake.id,x:p.x0+12,y:ry,facing:-1,bobX:mid-200,bobY:Math.min(lake.y+lake.ry*.45,ry-6)},
  {id:`${lake.id}-${p.kind}${n}-leste`,lake:lake.id,x:p.x1-12,y:ry,facing:1,bobX:mid+200,bobY:Math.min(lake.y+lake.ry*.45,ry-6)},
 ];
};

export const lakeAt=(x:number,y:number)=>FISHING_LAKES.find(lake=>inLake(lake,x,y));
const onDeck=(x:number,y:number)=>FISHING_PIERS.some(p=>inRect(p,x,y));
const inObstacle=(x:number,y:number)=>FISHING_OBSTACLES.some(o=>((x-o.x)/o.rx)**2+((y-o.y)/o.ry)**2<1);
/** The terrace (or stairs) under a point, if any. */
export const terraceAt=(x:number,y:number)=>FISHING_TERRACES.find(t=>inRect(t,x,y));
/** Off the stone, in the water (not on a pier) or inside something solid. */
export function fishingBlocked(x:number,y:number):boolean{
 if(!terraceAt(x,y)&&!FISHING_STAIRS.some(s=>inRect(s,x,y)))return true;
 if(inObstacle(x,y))return true;
 return !!lakeAt(x,y)&&!onDeck(x,y);
}

/** Every spot: the shore ones that would stand or cast onto a pier are left out. */
export const FISHING_SPOTS:readonly FishingSpot[]=FISHING_LAKES.flatMap(lake=>[
 ...shoreSpots(lake).filter(s=>!fishingBlocked(s.x,s.y)&&!onDeck(s.x,s.y)&&!onDeck(s.bobX,s.bobY)),
 ...FISHING_PIERS.filter(p=>p.lake===lake.id).flatMap((p,n)=>deckSpots(lake,p,n+1)),
]);
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
