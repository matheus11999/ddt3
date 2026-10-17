import {useEffect,useMemo,useState} from 'react';
import {Loader2,Search,X} from 'lucide-react';
import {ASSET_FOLDERS,ASSET_KIND_NAMES,loadLibrary,matches,SHEET_NAMES} from './assets';
import type {AssetKind,LibraryEntry} from './assets';

/** Piece palette of the map editor: this map's folder by default, any other folder or all of them, with search. */
export function PiecePicker({source,onPick}:{source:string;onPick:(entry:LibraryEntry)=>void}){
 const own=ASSET_FOLDERS.find(f=>f.source===source)?.id??'';
 const [library,setLibrary]=useState<LibraryEntry[]|null>(null),[query,setQuery]=useState(''),[folder,setFolder]=useState(own||'all'),[kind,setKind]=useState<AssetKind|'all'>('all');
 useEffect(()=>{let live=true;loadLibrary().then(l=>live&&setLibrary(l));return()=>{live=false;};},[]);
 const shown=useMemo(()=>(library??[]).filter(e=>(folder==='all'||e.folder.id===folder)&&(kind==='all'||e.sheet.kind===kind)&&matches(e,query)),[library,query,folder,kind]);
 const groups=useMemo(()=>{const m=new Map<string,LibraryEntry[]>();for(const e of shown){const k=`${e.folder.id}/${e.sheet.sheet}`;m.set(k,[...(m.get(k)??[]),e]);}return [...m.values()];},[shown]);
 return <div className="adm-picker">
  <label className="adm-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar peça (ex.: ponte, poste)" aria-label="Buscar peça"/>{query&&<button onClick={()=>setQuery('')} title="Limpar"><X size={14}/></button>}</label>
  <div className="adm-picker-filters">
   <select value={folder} onChange={e=>setFolder(e.target.value)} aria-label="Pasta">
    {own&&<option value={own}>Este mapa</option>}
    <option value="all">Todas as pastas</option>
    {ASSET_FOLDERS.filter(f=>f.id!==own).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
   </select>
   <span className="adm-seg small">{(['all','terreno','objeto'] as const).map(k=><button key={k} className={kind===k?'on':''} onClick={()=>setKind(k)}>{k==='all'?'Tudo':ASSET_KIND_NAMES[k]}</button>)}</span>
  </div>
  <p className="adm-hint">Clique numa peça para pôr no meio da tela. Objetos já caem no chão.</p>
  {!library?<p className="adm-empty"><Loader2 className="adm-spin" size={16}/> Recortando as peças…</p>
  :!groups.length?<p className="adm-empty">Nada com “{query}”. Tente outra palavra ou “Todas as pastas”.</p>
  :groups.map(list=>{const {folder:f,sheet}=list[0],foreign=f.source!==source;return <section key={`${f.id}/${sheet.sheet}`} className="adm-picker-group">
   <h5>{SHEET_NAMES[sheet.sheet]??sheet.sheet}{(foreign||folder==='all')&&<em className={foreign?'foreign':''}>{f.name}</em>}<small>{list.length}</small></h5>
   <div className="adm-pieces">{list.map(e=><button key={e.key} onClick={()=>onPick(e)} title={`${e.name} · ${f.name} · peça ${e.n} · ${e.piece.w}×${e.piece.h}`}><img src={e.piece.thumb} alt=""/><small>{e.name}</small></button>)}</div>
  </section>;})}
 </div>;
}
