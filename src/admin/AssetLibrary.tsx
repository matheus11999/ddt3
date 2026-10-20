import {useEffect,useMemo,useState} from 'react';
import {FolderOpen,Image as ImageIcon,Loader2,Search,X} from 'lucide-react';
import {api} from './api';
import {ASSET_FOLDERS,ASSET_KIND_NAMES,loadLibrary,matches,normalize,SHEET_NAMES,shippedLayout,sourceUrl} from './assets';
import type {AssetKind,LibraryEntry} from './assets';
import type {MapLayout} from '../../shared/mapBuilder';
import {navigate} from './AdminApp';

interface Usage {map:string;name:string;items:string[];}
/** Which maps use each piece (by sheet URL and piece number), from the saved drafts or the shipped layouts. */
async function usages(){
 const {maps}=await api.maps(),found=new Map<string,Usage[]>();
 await Promise.all(maps.filter(m=>m.kind!=='lobby'&&m.kind!=='fishing').map(async m=>{
  const draft=await api.map(m.id).catch(()=>null),layout=(draft?.draft?.layout as MapLayout|undefined)??shippedLayout(m.id)??shippedLayout(m.base);if(!layout)return;
  const files=layout.sheets??{pieces:layout.pieces??''},first=Object.keys(files)[0];
  for(const item of layout.items)for(const [sheet,piece] of [[item.sheet??first,item.piece],...(item.mirrorAs?.piece!==undefined?[[item.mirrorAs.sheet??item.sheet??first,item.mirrorAs.piece]]:[])] as [string,number][]){
   const key=`${sourceUrl(layout.source,files[sheet]??'')}#${piece}`,list=found.get(key)??[];let u=list.find(x=>x.map===m.id);
   if(!u){u={map:m.id,name:m.name,items:[]};list.push(u);found.set(key,list);}if(!u.items.includes(item.id))u.items.push(item.id);}
 }));
 return found;
}

export function AssetLibrary(){
 const [library,setLibrary]=useState<LibraryEntry[]|null>(null),[used,setUsed]=useState<Map<string,Usage[]>|null>(null);
 const [query,setQuery]=useState(''),[folder,setFolder]=useState('all'),[kind,setKind]=useState<AssetKind|'all'>('all'),[open,setOpen]=useState<LibraryEntry|null>(null);
 useEffect(()=>{let live=true;loadLibrary().then(l=>live&&setLibrary(l));usages().then(u=>live&&setUsed(u)).catch(()=>live&&setUsed(new Map()));return()=>{live=false;};},[]);
 const useOf=(e:LibraryEntry)=>used?.get(`${e.sheet.url}#${e.n}`)??[];
 const shown=useMemo(()=>(library??[]).filter(e=>(folder==='all'||e.folder.id===folder)&&(kind==='all'||e.sheet.kind===kind)&&matches(e,query)),[library,query,folder,kind]);
 const backgrounds=useMemo(()=>kind!=='all'&&kind!=='fundo'?[]:ASSET_FOLDERS.filter(f=>folder==='all'||f.id===folder).flatMap(f=>f.backgrounds.map(b=>({folder:f,...b}))).filter(b=>{const q=normalize(query.trim());return !q||q.split(/\s+/).every(w=>normalize(`fundo panorama ${b.file} ${b.folder.name}`).includes(w));}),[folder,kind,query]);
 const total=library?.length??0;
 return <section className="adm-page">
  <header className="adm-head"><div><h1>Assets dos mapas</h1><p>Cada mapa tem a sua pasta em <code>public/assets/maps/&lt;mapa&gt;/source</code>. Qualquer peça daqui pode ser usada em qualquer mapa pelo editor.</p></div></header>
  <div className="adm-toolbar">
   <label className="adm-search big"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nome, pasta, tipo ou tamanho (ex.: ponte, poste, 300x)" aria-label="Buscar assets"/>{query&&<button onClick={()=>setQuery('')} title="Limpar"><X size={15}/></button>}</label>
   <span className="adm-seg">{(['all','terreno','objeto','fundo'] as const).map(k=><button key={k} className={kind===k?'on':''} onClick={()=>setKind(k)}>{k==='all'?'Tudo':ASSET_KIND_NAMES[k]}</button>)}</span>
  </div>
  <div className="adm-chips">
   <button className={folder==='all'?'on':''} onClick={()=>setFolder('all')}><FolderOpen size={14}/>Todas as pastas <small>{total}</small></button>
   {ASSET_FOLDERS.map(f=><button key={f.id} className={folder===f.id?'on':''} onClick={()=>setFolder(f.id)}><FolderOpen size={14}/>{f.name}<small>{library?library.filter(e=>e.folder.id===f.id).length:'…'}</small></button>)}
  </div>
  {!library?<div className="adm-panel"><p className="adm-empty"><Loader2 className="adm-spin" size={16}/> Recortando as folhas de peças…</p></div>
  :<>{ASSET_FOLDERS.filter(f=>folder==='all'||f.id===folder).map(f=>{const list=shown.filter(e=>e.folder.id===f.id),bgs=backgrounds.filter(b=>b.folder.id===f.id);if(!list.length&&!bgs.length)return null;
    return <article key={f.id} className="adm-panel adm-asset-folder">
     <h2><FolderOpen size={18}/>{f.name}<code>{f.source}</code><small>{list.length} {list.length===1?'peça':'peças'}{bgs.length?` · ${bgs.length} ${bgs.length===1?'fundo':'fundos'}`:''}</small></h2>
     <div className="adm-assets">
      {list.map(e=>{const n=useOf(e).length;return <button key={e.key} className={open?.key===e.key?'on':''} onClick={()=>setOpen(e)}>
       <span className="adm-asset-art"><img src={e.piece.thumb} alt=""/></span><b>{e.name}</b><small>{SHEET_NAMES[e.sheet.sheet]??e.sheet.sheet} · {e.piece.w}×{e.piece.h}</small><em className={n?'':'idle'}>{used?n?`em ${n} ${n===1?'mapa':'mapas'}`:'sem uso':'…'}</em></button>;})}
      {bgs.map(b=><a key={b.url} className="adm-asset-bg" href={b.url} target="_blank" rel="noreferrer"><span className="adm-asset-art"><img src={b.url} alt="" loading="lazy"/></span><b><ImageIcon size={13}/> {b.file.replace(/\.\w+$/,'')}</b><small>Fundo · abre a imagem</small></a>)}
     </div>
    </article>;})}
   {!shown.length&&!backgrounds.length&&<div className="adm-panel"><p className="adm-empty">Nenhum asset com “{query}”. Tente outra palavra ou outra pasta.</p></div>}</>}
  {open&&<div className="adm-drawer"><header><h3>{open.name}</h3><button className="adm-icon" onClick={()=>setOpen(null)}><X size={17}/></button></header>
   <div className="adm-asset-big"><img src={open.piece.canvas.toDataURL()} alt=""/></div>
   <dl className="adm-facts"><dt>Pasta</dt><dd>{open.folder.name}</dd><dt>Folha</dt><dd>{SHEET_NAMES[open.sheet.sheet]??open.sheet.sheet} ({open.sheet.file})</dd><dt>Peça</dt><dd>nº {open.n}</dd><dt>Tamanho</dt><dd>{open.piece.w}×{open.piece.h} px</dd><dt>Tipo</dt><dd>{ASSET_KIND_NAMES[open.sheet.kind]}</dd></dl>
   <h4>Usado em</h4>
   {!used?<p className="adm-empty"><Loader2 className="adm-spin" size={14}/></p>:useOf(open).length?<ul className="adm-list">{useOf(open).map(u=><li key={u.map}><b>{u.name}</b><small>{u.items.join(', ')}</small><button className="adm-btn small ghost" onClick={()=>navigate(`/admin/mapas/${u.map}`)}>Abrir</button></li>)}</ul>:<p className="adm-empty">Nenhum mapa usa esta peça ainda.</p>}
   <p className="adm-hint">Para usar em outro mapa, abra o mapa no editor e escolha a peça em <b>Peças</b> (filtro “Todas as pastas”). A folha passa a fazer parte daquele mapa, sem copiar arquivos.</p>
  </div>}
 </section>;
}
