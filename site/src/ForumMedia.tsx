import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ImagePlus,LoaderCircle,Play,X} from 'lucide-react';
import {api} from './api';
import {FORUM_MEDIA,type ForumMedia} from './forumRules';

type Pending={key:string;name:string;kind:'image'|'video';preview:string;media?:ForumMedia;error?:string};
const ACCEPTED=FORUM_MEDIA.accept.split(',');

/** Attachments of one message: pick images or videos, each uploads at once; `onChange` gets the uploaded ids. */
export function MediaPicker({onChange,onBusy,reset}:{onChange:(ids:string[])=>void;onBusy?:(busy:boolean)=>void;reset?:number}){
 const [items,setItems]=useState<Pending[]>([]);
 const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{setItems(list=>{list.forEach(i=>URL.revokeObjectURL(i.preview));return [];});},[reset]);
 useEffect(()=>{onChange(items.flatMap(i=>i.media?[i.media.id]:[]));onBusy?.(items.some(i=>!i.media&&!i.error));},[items]);
 const add=(files:FileList|null)=>{
  for(const file of [...files??[]].slice(0,FORUM_MEDIA.perPost-items.length)){
   const key=crypto.randomUUID(),kind=file.type.startsWith('video/')?'video':'image';
   const item:Pending={key,name:file.name,kind,preview:URL.createObjectURL(file)};
   const limit=FORUM_MEDIA.maxBytes[kind];
   if(!ACCEPTED.includes(file.type))item.error='Formato não aceito';
   else if(file.size>limit)item.error=`Máximo ${limit/1048576} MB`;
   setItems(list=>[...list,item]);
   if(!item.error)api.upload(file).then(media=>setItems(list=>list.map(i=>i.key===key?{...i,media}:i)),e=>setItems(list=>list.map(i=>i.key===key?{...i,error:(e as Error).message}:i)));
  }
  if(input.current)input.current.value='';
 };
 const remove=(key:string)=>setItems(list=>list.filter(i=>{if(i.key===key)URL.revokeObjectURL(i.preview);return i.key!==key;}));
 return <div className="media-picker">
  {items.map(i=><div key={i.key} className={`media-chip${i.error?' bad':''}`} title={i.error??i.name}>
   {i.kind==='image'?<img src={i.preview} alt=""/>:<video src={i.preview} muted/>}
   {i.kind==='video'&&<Play className="media-chip-play" size={18}/>}
   {!i.media&&!i.error&&<span className="media-chip-busy"><LoaderCircle size={20} className="spin"/></span>}
   {i.error&&<span className="media-chip-error">{i.error}</span>}
   <button type="button" className="media-chip-x" aria-label="Remover anexo" onClick={()=>remove(i.key)}><X size={14}/></button>
  </div>)}
  {items.length<FORUM_MEDIA.perPost&&<button type="button" className="media-add" onClick={()=>input.current?.click()}><ImagePlus size={20}/><span>Imagem ou vídeo</span><small>até {FORUM_MEDIA.perPost}</small></button>}
  <input ref={input} type="file" accept={FORUM_MEDIA.accept} multiple hidden onChange={e=>add(e.target.files)}/>
 </div>;
}

/** Images and videos inside a post; images open big on click. */
export function MediaGrid({media}:{media:ForumMedia[]}){
 const [open,setOpen]=useState<string|null>(null);
 if(!media.length)return null;
 return <div className={`media-grid n${Math.min(media.length,4)}`}>
  {media.map(m=>m.kind==='image'
   ?<button key={m.id} type="button" className="media-item" onClick={()=>setOpen(m.url)}><img src={m.url} alt="" loading="lazy"/></button>
   :<video key={m.id} className="media-item" src={m.url} controls preload="metadata" playsInline/>)}
  {open&&createPortal(<div className="lightbox" role="dialog" aria-modal="true" aria-label="Imagem" onClick={()=>setOpen(null)}><img src={open} alt=""/><button className="icon-btn lightbox-close" aria-label="Fechar"><X size={22}/></button></div>,document.body)}
 </div>;
}
