import {useEffect,useState} from 'react';
import {Pencil,Plus,X} from 'lucide-react';
import {api} from './api';
import {navigate} from './AdminApp';
import {MAP_KIND_NAMES,MAP_ID_PATTERN} from '../../shared/mapAdmin';
import type {AdminMapSummary,MapKind} from '../../shared/mapAdmin';

const FILTERS:[MapKind|'all',string][]=[['all','Todos'],['pvp','PvP'],['instance','Instâncias'],['lobby','Lobby']];
const slug=(name:string)=>name.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32);

export function status(map:AdminMapSummary){
 if(map.publishedRevision&&map.draftRevision!==map.publishedRevision)return {label:'Rascunho novo',tone:'draft'};
 if(map.publishedRevision)return {label:map.builtIn?'Editado e publicado':'Publicado',tone:'live'};
 if(map.draftRevision)return {label:'Rascunho (não publicado)',tone:'draft'};
 return {label:map.builtIn?'Original do jogo':'Novo',tone:'base'};
}

export function MapList(){
 const [maps,setMaps]=useState<AdminMapSummary[]|null>(null),[filter,setFilter]=useState<MapKind|'all'>('all'),[creating,setCreating]=useState(false),[error,setError]=useState('');
 useEffect(()=>{api.maps().then(r=>setMaps(r.maps)).catch(e=>setError(e.message));},[]);
 const shown=(maps??[]).filter(m=>filter==='all'||m.kind===filter);
 return <section className="adm-page">
  <header className="adm-head"><div><h1>Mapas</h1><p>Abra um mapa para mover peças, objetos e spawns. Salvar guarda um rascunho; publicar põe no jogo na hora.</p></div>
   <button className="adm-btn gold" onClick={()=>setCreating(true)}><Plus size={16}/>Novo mapa</button></header>
  <div className="adm-tabs">{FILTERS.map(([id,label])=><button key={id} className={filter===id?'on':''} onClick={()=>setFilter(id)}>{label}<small>{id==='all'?maps?.length??0:maps?.filter(m=>m.kind===id).length??0}</small></button>)}</div>
  {error&&<p className="adm-error">{error}</p>}
  {!maps?<div className="adm-skeleton"/>:shown.length?<div className="adm-maps">{shown.map(map=>{const s=status(map);return <article key={map.id} className="adm-map" onClick={()=>navigate(`/admin/mapas/${map.id}`)}>
   <div className="adm-map-art" style={{backgroundImage:`url(${map.preview})`}}><span className={`adm-kind ${map.kind}`}>{MAP_KIND_NAMES[map.kind]}</span>{!map.enabled&&map.kind==='pvp'&&<span className="adm-kind off">Fora do sorteio</span>}</div>
   <div className="adm-map-body"><h3>{map.name}</h3><p>{map.subtitle||' '}</p>
    <footer><span className={`adm-status ${s.tone}`}>{s.label}</span><small>{map.width/1536>1?`${(map.width/1536).toLocaleString('pt-BR')} telas`:'1 tela'} · {map.id}</small></footer>
    <button className="adm-btn small"><Pencil size={14}/>Editar</button>
   </div>
  </article>;})}</div>:<p className="adm-empty big">{filter==='instance'?'Ainda não há instâncias. Crie uma a partir de um mapa com peças; elas ficam salvas para quando as dungeons existirem.':'Nada aqui.'}</p>}
  {creating&&maps&&<CreateDialog maps={maps} onClose={()=>setCreating(false)}/>}
 </section>;
}

function CreateDialog({maps,onClose}:{maps:AdminMapSummary[];onClose:()=>void}){
 const bases=maps.filter(m=>m.kind!=='lobby');
 const [name,setName]=useState(''),[id,setId]=useState(''),[edited,setEdited]=useState(false),[kind,setKind]=useState<'pvp'|'instance'>('pvp'),[base,setBase]=useState(bases[0]?.id??''),[error,setError]=useState('');
 const code=edited?id:slug(name);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');
  if(!MAP_ID_PATTERN.test(code)){setError('O código usa letras minúsculas, números e hífen (2 a 32).');return;}
  try{await api.create({id:code,name:name.trim(),kind,base});sessionStorage.setItem(`brasa-new-map:${code}`,JSON.stringify({name:name.trim(),kind,base}));navigate(`/admin/mapas/${code}`);}catch(err){setError((err as Error).message);}};
 return <div className="adm-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <form className="adm-dialog" onSubmit={submit}>
   <header><h2>Novo mapa</h2><button type="button" className="adm-icon" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
   <label>Nome<input autoFocus value={name} onChange={e=>setName(e.target.value)} maxLength={40} required placeholder="Ex.: Templo Dourado"/></label>
   <label>Código<input value={code} onChange={e=>{setEdited(true);setId(e.target.value);}} maxLength={32} required/><small>Fica no endereço e no jogo; não muda depois.</small></label>
   <label>Tipo<div className="adm-seg">{(['pvp','instance'] as const).map(k=><button type="button" key={k} className={kind===k?'on':''} onClick={()=>setKind(k)}>{MAP_KIND_NAMES[k]}</button>)}</div></label>
   <label>Começar a partir de<select value={base} onChange={e=>setBase(e.target.value)}>{bases.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select><small>Usa o fundo e as folhas de peças desse mapa. Arte nova continua vindo pelo Codex.</small></label>
   {error&&<p className="adm-error">{error}</p>}
   <footer><button type="button" className="adm-btn ghost" onClick={onClose}>Cancelar</button><button className="adm-btn gold"><Plus size={16}/>Criar e abrir</button></footer>
  </form>
 </div>;
}
