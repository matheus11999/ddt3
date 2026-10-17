import {cutSheet,isPropSheet,loadImage} from '../../shared/mapBuilder';
import type {MapLayout,Piece} from '../../shared/mapBuilder';
import {sourceUrl} from '../../shared/mapAdmin';
export {relativeFile,sourceUrl} from '../../shared/mapAdmin';

/**
 * Map asset library. Every map keeps its art in its own folder (public/assets/maps/<id>/source: piece sheets on magenta,
 * background halves and an optional pieces.json with piece names). The folders come from the shipped layouts
 * (scripts/map-layouts), so a new map folder appears here as soon as its layout exists.
 */
export const SHIPPED=import.meta.glob('../../scripts/map-layouts/*.json',{eager:true,import:'default'}) as Record<string,MapLayout>;
export const shippedLayout=(id:string)=>{const found=Object.entries(SHIPPED).find(([path])=>path.endsWith(`/${id}.json`));return found?structuredClone(found[1]):null;};

export const SHEET_NAMES:Record<string,string>={pecas:'Terreno',pecas2:'Terreno 2',objetos:'Objetos'};
export type AssetKind='terreno'|'objeto'|'fundo';
export const ASSET_KIND_NAMES:Record<AssetKind,string>={terreno:'Terreno',objeto:'Objetos',fundo:'Fundo'};
export const sheetKind=(sheet:string):AssetKind=>isPropSheet(sheet)?'objeto':'terreno';

export interface AssetSheet {folder:string;sheet:string;file:string;url:string;kind:AssetKind;}
export interface AssetFolder {id:string;name:string;source:string;sheets:AssetSheet[];backgrounds:{file:string;url:string}[];}
export const ASSET_FOLDERS:AssetFolder[]=(()=>{
 const bySource=new Map<string,AssetFolder>();
 for(const [path,layout] of Object.entries(SHIPPED)){
  const id=path.split('/').pop()!.replace(/\.json$/,''),source=layout.source??`public/assets/maps/${id}/source`;
  // Sheets borrowed from another folder belong to that folder, not to this map.
  const own=Object.entries(layout.sheets??{pieces:layout.pieces??''}).filter(([,file])=>file&&!file.includes('..'));
  const folder=bySource.get(source)??{id,name:layout.name??id,source,sheets:[],backgrounds:[]};
  for(const [sheet,file] of own)if(!folder.sheets.some(s=>s.file===file))folder.sheets.push({folder:folder.id,sheet,file,url:sourceUrl(source,file),kind:sheetKind(sheet)});
  for(const file of [layout.background].flat())if(file&&!folder.backgrounds.some(b=>b.file===file))folder.backgrounds.push({file,url:sourceUrl(source,file)});
  bySource.set(source,folder);
 }
 return [...bySource.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
})();
export const folderOf=(url:string)=>{for(const f of ASSET_FOLDERS){const sheet=f.sheets.find(s=>s.url===url);if(sheet)return {folder:f,sheet};}return null;};

export interface LibraryPiece extends Piece {alpha:Uint8ClampedArray;thumb:string;}
const sheetCache=new Map<string,Promise<LibraryPiece[]>>(),namesCache=new Map<string,Promise<Record<string,string[]>>>();
/** Cuts a sheet once per page load; every editor and the library share the result. */
export function loadSheet(url:string){
 let pending=sheetCache.get(url);
 if(!pending){pending=loadImage(url).then(image=>cutSheet(image).pieces.map(p=>{const thumb=document.createElement('canvas'),k=Math.min(1,160/Math.max(p.w,p.h));thumb.width=Math.max(1,p.w*k);thumb.height=Math.max(1,p.h*k);thumb.getContext('2d')!.drawImage(p.canvas,0,0,thumb.width,thumb.height);
  return {...p,alpha:p.canvas.getContext('2d')!.getImageData(0,0,p.w,p.h).data,thumb:thumb.toDataURL()};}));sheetCache.set(url,pending);pending.catch(()=>sheetCache.delete(url));}
 return pending;
}
/** Optional names per sheet, from <folder>/pieces.json ({"objetos": ["Boneco de neve", …]}). */
export function folderNames(folder:AssetFolder){
 let pending=namesCache.get(folder.source);
 if(!pending){pending=fetch(sourceUrl(folder.source,'pieces.json')).then(r=>r.ok?r.json():{}).catch(()=>({}));namesCache.set(folder.source,pending);}
 return pending;
}
export const pieceName=(names:Record<string,string[]>|undefined,sheet:string,n:number)=>names?.[sheet]?.[n]??`${SHEET_NAMES[sheet]??sheet} ${n}`;

export interface LibraryEntry {key:string;folder:AssetFolder;sheet:AssetSheet;n:number;name:string;piece:LibraryPiece;}
/** Every piece of every folder, named. */
export async function loadLibrary():Promise<LibraryEntry[]>{
 const groups=await Promise.all(ASSET_FOLDERS.map(async folder=>{const names=await folderNames(folder);
  return (await Promise.all(folder.sheets.map(async sheet=>(await loadSheet(sheet.url).catch(()=>[] as LibraryPiece[])).map((piece,n)=>({key:`${folder.id}/${sheet.sheet}/${n}`,folder,sheet,n,name:pieceName(names,sheet.sheet,n),piece}))))).flat();}));
 return groups.flat();
}
export const normalize=(text:string)=>text.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
export const matches=(entry:LibraryEntry,query:string)=>{const q=normalize(query.trim());if(!q)return true;
 const hay=normalize(`${entry.name} ${entry.folder.name} ${entry.folder.id} ${SHEET_NAMES[entry.sheet.sheet]??entry.sheet.sheet} ${ASSET_KIND_NAMES[entry.sheet.kind]} ${entry.n} ${entry.piece.w}x${entry.piece.h}`);
 return q.split(/\s+/).every(w=>hay.includes(w));};
