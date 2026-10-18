import {SNOW_REGIONS} from './generated/snowTerrain';
import {ANTHILL_1_REGIONS,ANTHILL_1_MONSTERS} from './generated/anthill-1Terrain';
import {ANTHILL_2_REGIONS,ANTHILL_2_MONSTERS} from './generated/anthill-2Terrain';
import type {MonsterPlacement} from './expeditions';

/** Maps in the game. Each is painted art assembled by `npm run build:map` (docs/maps-kit.md). */
export const MAP_IDS = ['snow'] as const;
/** Expedition stage maps (kind 'instance'): never in the PvP draw. */
export const INSTANCE_MAP_IDS = ['anthill-1','anthill-2'] as const;
/** Chefão Mundial maps (kind 'instance' in the panel): never in the PvP draw nor in an expedition. */
export const WORLD_BOSS_MAP_IDS = ['dragon-lair'] as const;
export type CanonicalMapId = typeof MAP_IDS[number] | typeof INSTANCE_MAP_IDS[number] | typeof WORLD_BOSS_MAP_IDS[number];
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
 /** Instance maps: monsters and markers placed in the map editor (layout `monsters`). */
 monsters?:readonly MonsterPlacement[];
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
  dimensions:{width:3072,height:864},camera:{minZoom:1,maxZoom:1.65},spawns:[[1040,820,1190,385],[2032,2252,1882,2687]],
  lighting:{sky:'#5d6fb8',horizon:'#b9c4ee',ambient:'#dfe8ff'},audio:{ambience:'wind',impact:{earth:'dust'}},
  art:{background:'/assets/maps/snow/background.webp',terrain:'/assets/maps/snow/terrain-world.png'},
  regions:SNOW_REGIONS},
 'anthill-1':{id:'anthill-1',name:'Formigueiro · O tronco caído',subtitle:'Expedição · Estágio 1',color:'#9bc463',
  dimensions:{width:3072,height:864},camera:{minZoom:1,maxZoom:1.65},spawns:[[1300,1780,1090,1880],[0]],
  lighting:{sky:'#c6d98a',horizon:'#f4e3a1',ambient:'#fff3cf'},audio:{ambience:'birds',impact:{earth:'dust'}},
  art:{background:'/assets/maps/anthill-1/background.webp',terrain:'/assets/maps/anthill-1/terrain-world.png'},
  regions:ANTHILL_1_REGIONS,monsters:ANTHILL_1_MONSTERS},
 'anthill-2':{id:'anthill-2',name:'Formigueiro · A câmara da rainha',subtitle:'Expedição · Estágio 2',color:'#c4774a',
  dimensions:{width:3072,height:864},camera:{minZoom:1,maxZoom:1.65},spawns:[[640,900,480,1040],[0]],
  lighting:{sky:'#6b3c2a',horizon:'#c98a55',ambient:'#ffd8a8'},audio:{ambience:'wind',impact:{earth:'dust'}},
  art:{background:'/assets/maps/anthill-2/background.webp',terrain:'/assets/maps/anthill-2/terrain-world.png'},
  regions:ANTHILL_2_REGIONS,monsters:ANTHILL_2_MONSTERS},
 'dragon-lair':{id:'dragon-lair',name:'Covil do Dragão',subtitle:'Chefão Mundial',color:'#d0643c',
  dimensions:{width:3072,height:864},camera:{minZoom:1,maxZoom:1.65},spawns:[[1300],[0]],
  lighting:{sky:'#3b2440',horizon:'#c86a3c',ambient:'#ffd2a8'},audio:{ambience:'wind',impact:{earth:'dust'}},
  art:{background:'/assets/maps/anthill-2/background.webp',terrain:'/assets/maps/anthill-2/terrain-world.png'},
  regions:ANTHILL_2_REGIONS},
};
/** The map a new room starts on and the one unknown ids fall back to (tests point it at their fixture map). */
export const MAP_DEFAULT:{id:MapId}={id:'snow'};
/** Maps in the PvP draw, as listed to players. Kept in place when the admin panel publishes a map. */
export const MAPS:{id:MapId;name:string;subtitle:string;color:string}[]=[];

/**
 * Maps published from the admin panel (shared/mapAdmin.ts) replace a built-in map's name, spawns,
 * collision and terrain art, or add a new map based on another one's art. Server and client apply the same list.
 */
export interface MapOverride {id:string;kind:'pvp'|'instance';name:string;subtitle:string;enabled:boolean;base:string;width:number;spawns:[number[],number[]];regions:readonly MapRegion[];terrain:string;monsters?:MonsterPlacement[];/** Published revision (0 or absent: the repository version). */revision?:number;}
const BUILT_IN=new Map<string,MapDefinition>([...MAP_IDS,...INSTANCE_MAP_IDS,...WORLD_BOSS_MAP_IDS].map(id=>[id,MAP_DEFINITIONS[id]]));
const status=new Map<string,{kind:'pvp'|'instance';enabled:boolean}>();
/** Revision each map currently plays (absent: the repository version, revision 0). */
const revisions=new Map<string,number>();
function overrideDefinition(o:MapOverride,id:MapId):MapDefinition{
 const base=BUILT_IN.get(o.id)??BUILT_IN.get(o.base)??MAP_DEFINITIONS[o.base as MapId]??MAP_DEFINITIONS[MAP_DEFAULT.id]!;
 return {...base,id,name:o.name,subtitle:o.subtitle||base.subtitle,dimensions:{...base.dimensions,width:o.width},spawns:[[...o.spawns[0]],[...o.spawns[1]]],regions:o.regions,art:{...base.art,terrain:o.terrain},monsters:o.monsters??base.monsters};
}
export function applyMapOverride(o:MapOverride){
 MAP_DEFINITIONS[o.id as MapId]=overrideDefinition(o,o.id as MapId);
 if(o.revision)revisions.set(o.id,o.revision);else revisions.delete(o.id);
 status.set(o.id,{kind:o.kind,enabled:o.enabled});listMaps();
}
/** Back to the repository version (or gone, for a map created in the panel). */
export function removeMapOverride(id:string){
 const original=BUILT_IN.get(id);if(original)MAP_DEFINITIONS[id as MapId]=original;else delete MAP_DEFINITIONS[id as MapId];
 revisions.delete(id);status.delete(id);listMaps();
}

/**
 * A match plays the map as it was when it started: its `Battle.map` is a pinned id (`snow@12`, map id and revision)
 * that keeps that version while the admin panel publishes new ones. The next match picks up the new version.
 */
const PIN='@';
const pins=new Set<string>();
export function mapRevision(id:string){return revisions.get(id)??0;}
export function pinnedMap(key:string):{id:string;revision:number}|null{
 const at=key.lastIndexOf(PIN);if(at<1)return null;const revision=Number(key.slice(at+1));
 return Number.isSafeInteger(revision)&&revision>=0?{id:key.slice(0,at),revision}:null;
}
/** The map id without its pinned revision. */
export function baseMapId(id:string):MapId{return (pinnedMap(id)?.id??id) as MapId;}
/** Pins the version a map plays right now and returns the id a match keeps. */
export function pinMap(id:MapId):MapId{
 const current=canonicalMap(baseMapId(id)),key=`${current}${PIN}${mapRevision(current)}` as MapId;
 if(!MAP_DEFINITIONS[key]){MAP_DEFINITIONS[key]={...MAP_DEFINITIONS[current]!,id:key};pins.add(key);}
 return key;
}
/** Registers an older published version a running match still plays (after a restart, or on clients). */
export function registerPinnedMap(o:MapOverride&{revision:number}){
 const key=`${o.id}${PIN}${o.revision}` as MapId;MAP_DEFINITIONS[key]=overrideDefinition(o,key);pins.add(key);return key;
}
/** Forgets pinned versions no match plays any more. */
export function releasePinnedMaps(inUse:Iterable<string>){
 const keep=new Set(inUse);for(const key of pins)if(!keep.has(key)){delete MAP_DEFINITIONS[key as MapId];pins.delete(key);}
}
export function mapStatus(id:string){return status.get(id)??{kind:([...INSTANCE_MAP_IDS,...WORLD_BOSS_MAP_IDS] as readonly string[]).includes(id)?'instance' as const:'pvp' as const,enabled:true};}
/** Maps a PvP match may be drawn on: built-in and published PvP maps that are switched on. */
export function pvpRotation():MapId[]{
 const ids=[...new Set([...MAP_IDS,...status.keys()])].filter(id=>MAP_DEFINITIONS[id as MapId]&&mapStatus(id).kind==='pvp'&&mapStatus(id).enabled) as MapId[];
 return ids.length?ids:[MAP_DEFAULT.id];
}
function listMaps(){MAPS.splice(0,MAPS.length,...pvpRotation().map(id=>{const m=MAP_DEFINITIONS[id]!;return {id:m.id,name:m.name,subtitle:m.subtitle,color:m.color};}));}
listMaps();
const ALIASES:Partial<Record<MapId,MapId>>={sky:'garden',valley:'park'};
export function canonicalMap(id:MapId):MapId{
 const alias=ALIASES[id]??id;if(MAP_DEFINITIONS[alias])return alias;
 // A pinned id not known here: revision 0 is the repository version; otherwise the map as it is now.
 const pin=pinnedMap(alias);if(!pin)return MAP_DEFAULT.id;
 const original=BUILT_IN.get(pin.id);if(pin.revision===0&&original){MAP_DEFINITIONS[alias]={...original,id:alias};pins.add(alias);return alias;}
 return canonicalMap(pin.id as MapId);
}
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
