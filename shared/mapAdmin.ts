import {z} from 'zod';
import {MARKER_KINDS,MONSTER_KINDS} from './expeditions';
import {FISH_TABLES,POND_ARTS} from './fishingMap';
import {FISHING_PROPS} from './generated/fishingProps';

/**
 * Maps edited in the admin panel (/admin). A save is a revision; publishing a revision
 * makes the game use it (server collision and client art) without a rebuild.
 * Built-in maps keep their repository version until a revision is published.
 */
export const MAP_KINDS=['pvp','instance','lobby','fishing'] as const;
export type MapKind=typeof MAP_KINDS[number];
export const MAP_KIND_NAMES:Record<MapKind,string>={pvp:'PvP',instance:'Instância',lobby:'Lobby',fishing:'Pescaria'};
/** The plaza's map id; it is the only lobby for now. */
export const LOBBY_MAP_ID='praca-celeste';
/** The Pescaria's map id (shared/fishingMap.ts FishingLayout). */
export const FISHING_MAP_ID='pescaria';
export const MAP_ID_PATTERN=/^[a-z][a-z0-9-]{1,31}$/;
export const MAX_MAP_WIDTH=1536*4;

const coordinate=(max:number)=>z.number().finite().min(-max).max(max*2);
const text=(max:number)=>z.string().trim().min(1).max(max);
const sheetName=z.string().regex(/^[a-z0-9_-]{1,32}$/i);

export const layoutItemSchema=z.object({
 id:z.string().regex(/^[a-z0-9_-]{1,48}$/i),sheet:sheetName.optional(),piece:z.number().int().min(0).max(199),
 x:coordinate(MAX_MAP_WIDTH),top:coordinate(864),scale:z.number().finite().min(.05).max(4).optional(),
 material:z.enum(['earth','sand','stone','ice','metal','magic']).optional(),destructible:z.boolean().optional(),
 mirror:z.boolean().optional(),flip:z.boolean().optional(),
 mirrorAs:z.object({sheet:sheetName.optional(),piece:z.number().int().min(0).max(199).optional(),scale:z.number().finite().min(.05).max(4).optional(),top:coordinate(864).optional()}).strict().optional(),
 rest:z.boolean().optional(),sink:z.number().finite().min(-100).max(200).optional(),solid:z.boolean().optional(),
 passThrough:z.array(z.object({x:coordinate(MAX_MAP_WIDTH),y:coordinate(864),w:z.number().finite().min(1).max(MAX_MAP_WIDTH),h:z.number().finite().min(1).max(864)}).strict()).max(20).optional(),
 smooth:z.number().finite().min(8).max(600).optional(),
}).strict();
export const mapLayoutSchema=z.object({
 name:text(40),subtitle:z.string().trim().max(80).optional(),kind:z.enum(MAP_KINDS).optional(),
 source:z.string().max(200).regex(/^[\w./-]+$/).optional(),
 background:z.union([z.string().max(120),z.array(z.string().max(120)).max(4)]),backgroundBlend:z.number().finite().min(0).max(2000).optional(),mid:z.string().max(120).optional(),
 mirror:z.boolean().optional(),width:z.number().int().min(1536).max(MAX_MAP_WIDTH).refine(w=>w%3===0,'A largura precisa ser múltipla de 3.').optional(),
 // Instance maps leave team 2 empty: the monsters come from `monsters`.
 spawns:z.array(z.array(z.number().finite().min(0).max(MAX_MAP_WIDTH)).max(4)).length(2),
 monsters:z.array(z.object({kind:z.enum([...MONSTER_KINDS,...MARKER_KINDS]),x:z.number().finite().min(0).max(MAX_MAP_WIDTH),y:z.number().finite().min(0).max(864).optional()}).strict()).max(40).optional(),
 items:z.array(layoutItemSchema).max(300),
 sheets:z.record(sheetName,z.string().max(120)).optional(),pieces:z.string().max(120).optional(),
}).strict();
export type EditableLayout=z.infer<typeof mapLayoutSchema>;

export const regionSchema=z.object({
 id:z.string().max(64),material:z.enum(['earth','sand','stone','ice','metal','magic']),destructible:z.boolean(),
 shape:z.object({kind:z.literal('cells'),col:z.number().int().min(0),row:z.number().int().min(0),cols:z.number().int().min(1),rows:z.number().int().min(1),bits:z.string().max(400000).regex(/^[A-Za-z0-9+/]*={0,2}$/)}).strict(),
}).strict();

export const lobbyObstacleSchema=z.object({id:z.string().regex(/^[a-z0-9_-]{1,32}$/i),x:z.number().finite(),y:z.number().finite(),rx:z.number().finite().min(4).max(800),ry:z.number().finite().min(2).max(300)}).strict();
export const lobbyLayoutSchema=z.object({
 spawn:z.object({x:z.number().finite(),y:z.number().finite()}).strict(),
 walk:z.object({minX:z.number().finite(),maxX:z.number().finite(),minY:z.number().finite(),maxY:z.number().finite()}).strict(),
 obstacles:z.array(lobbyObstacleSchema).max(60),
 stations:z.array(z.object({id:z.string().regex(/^[a-z0-9_-]{1,32}$/i),x:z.number().finite(),y:z.number().finite(),height:z.number().finite().min(40).max(800)}).strict()).max(40),
}).strict().refine(l=>l.walk.minX<l.walk.maxX&&l.walk.minY<l.walk.maxY,'A área de caminhada está invertida.');
export type LobbyLayout=z.infer<typeof lobbyLayoutSchema>;

const fishingId=z.string().regex(/^[a-z0-9_-]{1,48}$/i);
const point=z.object({x:z.number().finite().min(0).max(4608),y:z.number().finite().min(0).max(2620)}).strict();
const unique=(list:{id:string}[])=>new Set(list.map(i=>i.id)).size===list.length;
export const fishingLayoutSchema=z.object({
 lakes:z.array(z.object({id:fishingId,name:text(32),fish:z.enum(Object.keys(FISH_TABLES) as [keyof typeof FISH_TABLES,...(keyof typeof FISH_TABLES)[]]),art:z.enum(Object.keys(POND_ARTS) as [string,...string[]]),
  x:z.number().finite().min(0).max(4608),y:z.number().finite().min(0).max(2620),width:z.number().finite().min(200).max(2400),flip:z.boolean().optional()}).strict()).min(1).max(20).refine(unique,'Dois lagos com o mesmo código.'),
 stairs:z.array(z.object({id:fishingId,upper:z.enum(['mirante','jardim']),x:z.number().finite().min(-200).max(4608),flip:z.boolean().optional(),art:z.enum(['side','grand','narrow']).optional()}).strict()).max(20).refine(unique,'Duas escadas com o mesmo código.'),
 items:z.array(z.object({id:fishingId,prop:z.enum(Object.keys(FISHING_PROPS) as [string,...string[]]),x:z.number().finite().min(-400).max(5000),y:z.number().finite().min(0).max(3000),
  scale:z.number().finite().min(.1).max(5).optional(),rotation:z.number().finite().min(-360).max(360).optional(),flip:z.boolean().optional(),layer:z.enum(['ground','water','stand']),
  solid:z.boolean().optional(),walk:z.boolean().optional(),lake:fishingId.optional()}).strict()).max(900).refine(unique,'Duas peças com o mesmo código.'),
 casa:point,airship:z.object({x:z.number().finite().min(0).max(4608)}).strict(),spawn:point,
}).strict();
export type FishingLayoutData=z.infer<typeof fishingLayoutSchema>;

/** What the editor sends on save. Terrain and preview are PNGs in base64, built in the editor by shared/mapBuilder.ts. */
export const mapSaveSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.enum(['pvp','instance']),name:text(40),subtitle:z.string().trim().max(80).default(''),enabled:z.boolean().default(true),note:z.string().trim().max(200).optional(),
  layout:mapLayoutSchema,regions:z.array(regionSchema).max(600),terrain:z.string().max(24_000_000),preview:z.string().max(4_000_000),warnings:z.array(z.string().max(300)).max(200).default([])}).strict(),
 z.object({kind:z.literal('lobby'),name:text(40),subtitle:z.string().trim().max(80).default(''),enabled:z.boolean().default(true),note:z.string().trim().max(200).optional(),lobby:lobbyLayoutSchema,warnings:z.array(z.string().max(300)).max(200).default([])}).strict(),
 z.object({kind:z.literal('fishing'),name:text(40),subtitle:z.string().trim().max(80).default(''),enabled:z.boolean().default(true),note:z.string().trim().max(200).optional(),fishing:fishingLayoutSchema,warnings:z.array(z.string().max(300)).max(200).default([])}).strict(),
]);
export type MapSave=z.infer<typeof mapSaveSchema>;
export const mapCreateSchema=z.object({id:z.string().regex(MAP_ID_PATTERN,'Use letras minúsculas, números e hífen (2 a 32).'),name:text(40),kind:z.enum(['pvp','instance']),base:z.string().regex(MAP_ID_PATTERN)}).strict();

/** A published map as the game reads it from GET /api/maps. */
export interface PublishedMap {
 id:string;kind:'pvp'|'instance';name:string;subtitle:string;enabled:boolean;revision:number;base:string;
 width:number;spawns:[number[],number[]];regions:z.infer<typeof regionSchema>[];terrain:string;
 /** Instance maps: monsters and markers (shared/expeditions.ts). */
 monsters?:{kind:(typeof MONSTER_KINDS)[number]|(typeof MARKER_KINDS)[number];x:number;y?:number}[];
}
export interface PublishedLobby {id:string;kind:'lobby';name:string;revision:number;lobby:LobbyLayout;}
export interface PublishedFishing {id:string;kind:'fishing';name:string;revision:number;fishing:FishingLayoutData;}
export interface PublishedMaps {maps:PublishedMap[];lobby:PublishedLobby|null;fishing?:PublishedFishing|null;
 /** Older versions running matches still play (a match keeps the map it started on). */pinned?:PublishedMap[];}

/** Summary row of the admin map list. */
export interface AdminMapSummary {
 id:string;kind:MapKind;name:string;subtitle:string;builtIn:boolean;enabled:boolean;base:string;
 draftRevision:number|null;publishedRevision:number|null;updatedAt:string|null;updatedBy:string|null;preview:string;width:number;
}
export interface AdminRevision {id:number;createdAt:string;createdBy:string;note:string|null;published:boolean;warnings:number;}

/** layout.source is a repository path; files under public/ are served from the site root. Paths may climb into another map's folder. */
export function sourceUrl(source:string|undefined,file:string){
 const parts:string[]=[];for(const part of `${(source??'').replace(/^public\//,'')}/${file}`.split('/')){if(!part||part==='.')continue;if(part==='..')parts.pop();else parts.push(part);}
 return `/${parts.join('/')}`;
}
/** Relative path from one folder to a file in another, as stored in layout.sheets (build:map joins it with layout.source). */
export function relativeFile(fromSource:string,toSource:string,file:string){
 const a=fromSource.replace(/\/$/,'').split('/'),b=toSource.replace(/\/$/,'').split('/');let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;
 return [...a.slice(i).map(()=>'..'),...b.slice(i),file].join('/');
}
