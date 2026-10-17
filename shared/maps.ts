import {SNOW_REGIONS} from './generated/snowTerrain';

/** Maps in the game. Each is painted art assembled by `npm run build:map` (docs/maps-kit.md). */
export const MAP_IDS = ['snow'] as const;
export type CanonicalMapId = typeof MAP_IDS[number];
/** Ids of removed maps still arrive from old clients and saved rooms; they resolve to a real map. */
export type LegacyMapId = 'garden'|'park'|'celestial'|'sky'|'valley';
export type MapId = CanonicalMapId | LegacyMapId;
export type MaterialId = 'earth'|'sand'|'stone'|'ice'|'metal'|'magic';
export type EnvironmentQuality = 'low'|'medium'|'high';
export type Point = readonly [number,number];
export type Shape = {kind:'polygon';points:readonly Point[]}|{kind:'ellipse';x:number;y:number;rx:number;ry:number}|{kind:'rect';x:number;y:number;width:number;height:number}
 /** Collision traced from painted art by `npm run build:map`: packed bits (base64), row-major, in 3px cells from (col,row). */
 |{kind:'cells';col:number;row:number;cols:number;rows:number;bits:string};
export interface MapRegion {id:string;shape:Shape;material:MaterialId;destructible:boolean;}
export interface MapDefinition {
 id:MapId;name:string;subtitle:string;color:string;
 dimensions:{width:number;height:number};camera:{minZoom:number;maxZoom:number};
 lighting:{sky:string;horizon:string;ambient:string};audio:{ambience:'birds'|'carnival'|'wind';impact:Partial<Record<MaterialId,'dust'|'spark'|'chime'>>};
 /** background: one fixed painting that never repeats; terrain: the painted pieces, masked by collision; mid: optional layer between them. */
 art:{background:string;terrain:string;mid?:string};
 regions:readonly MapRegion[];spawns:readonly [readonly number[],readonly number[]];
}
/** Debris palette for impacts; terrain itself has no material distinction for players. */
export const MATERIALS:Record<MaterialId,{color:string;highlight:string;debris:string}>={
 earth:{color:'#a46c48',highlight:'#d9a16c',debris:'#b18455'},
 sand:{color:'#d0aa69',highlight:'#f1d696',debris:'#e1c27c'},
 stone:{color:'#777c95',highlight:'#bdc0d0',debris:'#a4adc1'},
 ice:{color:'#78bbd4',highlight:'#d1f5ff',debris:'#c7efff'},
 metal:{color:'#696d83',highlight:'#becbd7',debris:'#d8dcdf'},
 magic:{color:'#8778b8',highlight:'#d3b9f4',debris:'#c5a4ed'}
};
export const MAP_DEFINITIONS:Partial<Record<MapId,MapDefinition>>&Record<CanonicalMapId,MapDefinition>={
 snow:{id:'snow',name:'Sonho Nevado',subtitle:'Pontes de pedra nevadas · Destrutível',color:'#8fb8ff',
  dimensions:{width:3072,height:864},camera:{minZoom:1,maxZoom:1.65},spawns:[[1040,820,1250,385],[2032,2252,1822,2687]],
  lighting:{sky:'#5d6fb8',horizon:'#b9c4ee',ambient:'#dfe8ff'},audio:{ambience:'wind',impact:{earth:'dust'}},
  art:{background:'/assets/maps/snow/background.webp',terrain:'/assets/maps/snow/terrain-world.png'},
  regions:SNOW_REGIONS}
};
/** The map a new room starts on and the one unknown ids fall back to (tests point it at their fixture map). */
export const MAP_DEFAULT:{id:MapId}={id:'snow'};
export const MAPS=MAP_IDS.map(id=>{const m=MAP_DEFINITIONS[id];return {id:m.id,name:m.name,subtitle:m.subtitle,color:m.color};});
const ALIASES:Partial<Record<MapId,MapId>>={sky:'garden',valley:'park'};
export function canonicalMap(id:MapId):MapId{const alias=ALIASES[id]??id;return MAP_DEFINITIONS[alias]?alias:MAP_DEFAULT.id;}
export function getMap(id:MapId):MapDefinition{return MAP_DEFINITIONS[canonicalMap(id)]!;}
export function contains(shape:Shape,x:number,y:number):boolean {
 if(shape.kind==='cells'){const cx=Math.floor(x/3)-shape.col,cy=Math.floor(y/3)-shape.row;if(cx<0||cy<0||cx>=shape.cols||cy>=shape.rows)return false;const n=cy*shape.cols+cx;return (cellBits(shape)[n>>3]>>(n&7)&1)===1;}
 if(shape.kind==='rect')return x>=shape.x&&y>=shape.y&&x<shape.x+shape.width&&y<shape.y+shape.height;
 if(shape.kind==='ellipse')return ((x-shape.x)/shape.rx)**2+((y-shape.y)/shape.ry)**2<=1;
 let inside=false;for(let i=0,j=shape.points.length-1;i<shape.points.length;j=i++){const [ax,ay]=shape.points[i],[bx,by]=shape.points[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;}return inside;
}
const decodedCells=new WeakMap<object,Uint8Array>();
/** Decoded once per shape; works in browsers and Node alike. */
export function cellBits(shape:Extract<Shape,{kind:'cells'}>):Uint8Array{
 let bits=decodedCells.get(shape);if(!bits){const raw=atob(shape.bits);bits=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bits[i]=raw.charCodeAt(i);decodedCells.set(shape,bits);}return bits;
}
