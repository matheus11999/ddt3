import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AlertTriangle,AlignCenterVertical,ArrowDown,ArrowLeft,ArrowUp,Copy,Download,FlipHorizontal2,Grid3x3,History,Keyboard,Layers,Loader2,Lock,Magnet,Maximize,Monitor,PanelLeftClose,PanelLeftOpen,PanelRightClose,PanelRightOpen,Redo2,RotateCcw,Rocket,Ruler,Save,ShieldAlert,Trash2,Undo2,Unlock,Users,X,Eye,EyeOff,ZoomIn,ZoomOut} from 'lucide-react';
import {api} from './api';
import type {RevisionData} from './api';
import {assemble,expandItems,loadImage,montage,preview,MAP_HEIGHT} from '../../shared/mapBuilder';
import type {Assembly,LayoutItem,MapLayout} from '../../shared/mapBuilder';
import {MAP_DEFINITIONS} from '../../shared/maps';
import type {MapId} from '../../shared/maps';
import {MAP_KIND_NAMES} from '../../shared/mapAdmin';
import type {AdminMapSummary,AdminRevision,MapSave} from '../../shared/mapAdmin';
import {status} from './MapList';
import {folderNames,folderOf,loadSheet,pieceName,relativeFile,shippedLayout,sheetKind,SHEET_NAMES,sourceUrl} from './assets';
import type {LibraryEntry,LibraryPiece} from './assets';
import {PiecePicker} from './PiecePicker';
import {MARKER_KINDS,MONSTER_KINDS,MONSTERS} from '../../shared/expeditions';
import type {MonsterPlacement} from '../../shared/expeditions';

const TEAM_COLORS=['#4aa8ff','#ff5a5a'];
const SCREEN_WIDTH=1536,SNAP=8,MIN_ZOOM=.1,MAX_ZOOM=4;
/** Editor preferences kept per browser: open sidebars and the drawing aids. */
interface Ui {left:boolean;right:boolean;snap:boolean;ruler:boolean;screen:boolean;}
const UI_KEY='brasa-admin-map-editor';
const loadUi=():Ui=>{const fallback={left:true,right:true,snap:false,ruler:true,screen:false};try{return {...fallback,...JSON.parse(localStorage.getItem(UI_KEY)??'{}')};}catch{return fallback;}};
const SHORTCUTS:[string,string][]=[['Arrastar','move a peça ou o spawn'],['Shift + arrastar','trava o eixo'],['Setas','move 1 px (Shift: 10 px)'],['Roda do mouse','zoom no cursor (Shift: anda para o lado)'],['Dois dedos','zoom e navegação no touch'],['Arrastar o fundo','navega (também botão do meio ou direito)'],['+ / −','zoom'],['0','ver o mapa inteiro'],['1','tamanho real'],['[ e ]','recolhe as barras laterais'],['G · M · R · T','grade · encaixe · régua · tela do jogo'],['L · H','trava · esconde a peça'],['Ctrl+D','duplica'],['Del','apaga'],['Ctrl+Z / Ctrl+Y','desfaz / refaz'],['Ctrl+S','salva'],['Esc','tira a seleção']];

type Selection={type:'item';index:number}|{type:'spawn';team:number;slot:number}|{type:'monster';index:number}|null;
/** Instance maps: names and sprites of the monsters the editor places (the nest is a marker, not a creature). */
const MONSTER_LABELS:Record<string,string>={...Object.fromEntries(MONSTER_KINDS.map(kind=>[kind,MONSTERS[kind].name])),nest:'Ninho (saída das formigas)'};
const monsterSprites=new Map<string,HTMLImageElement>();
const monsterSprite=(kind:string,onLoad:()=>void)=>{const def=MONSTERS[kind as keyof typeof MONSTERS];if(!def)return null;let image=monsterSprites.get(kind);if(!image){image=new Image();image.onload=onLoad;image.src=def.sprite.src;monsterSprites.set(kind,image);}return image.complete&&image.naturalWidth?image:null;};
interface Meta {name:string;subtitle:string;kind:'pvp'|'instance';enabled:boolean;}
interface Doc {layout:MapLayout;meta:Meta;}
/** A sheet of this layout (by its key in layout.sheets), with where it comes from and its piece names. */
interface Sheet {name:string;pieces:LibraryPiece[];label:string;folder:string;foreign:boolean;names:Record<string,string[]>;sheet:string;}
interface View {scale:number;x:number;y:number;}
type Drag={kind:'item';index:number;mirrored:boolean;startX:number;startY:number;origin:LayoutItem;moved:boolean}|{kind:'spawn';team:number;slot:number;startX:number;origin:number;moved:boolean}|{kind:'monster';index:number;startX:number;origin:number;moved:boolean}|{kind:'pan';startX:number;startY:number;view:View}|{kind:'cut';index:number;startX:number;startY:number;x:number;y:number};

type PieceSave=Extract<MapSave,{layout:unknown}>;
const clone=<T,>(v:T):T=>structuredClone(v);
const cutBox=(d:{startX:number;startY:number;x:number;y:number})=>({x:Math.round(Math.min(d.startX,d.x)),y:Math.round(Math.min(d.startY,d.y)),w:Math.round(Math.abs(d.x-d.startX)),h:Math.round(Math.abs(d.y-d.startY))});
function drawCutBox(c:CanvasRenderingContext2D,box:{x:number;y:number;w:number;h:number},scale:number,drawing:boolean){
 c.save();c.fillStyle=drawing?'rgba(255,90,90,.28)':'rgba(255,90,90,.16)';c.fillRect(box.x,box.y,box.w,box.h);c.setLineDash([8/scale,6/scale]);c.lineWidth=2/scale;c.strokeStyle='#ff6b5a';c.strokeRect(box.x,box.y,box.w,box.h);c.restore();
}
const round=(v:number)=>Math.round(v*10)/10;

export function MapEditor({id,onBack}:{id:string;onBack:()=>void}){
 const [summary,setSummary]=useState<AdminMapSummary|null>(null),[revisions,setRevisions]=useState<AdminRevision[]>([]);
 const [doc,setDoc]=useState<Doc|null>(null),[sheets,setSheets]=useState<Record<string,Sheet>>({}),[backdrop,setBackdrop]=useState<HTMLImageElement|null>(null);
 const [selection,setSelection]=useState<Selection>(null),[built,setBuilt]=useState<Assembly|null>(null),[building,setBuilding]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(''),[dirty,setDirty]=useState(false),[savedRevision,setSavedRevision]=useState<number|null>(null);
 const [overlay,setOverlay]=useState({collision:false,grid:false,centre:true,ghost:true}),[panel,setPanel]=useState<'pieces'|'layers'>('pieces'),[showHistory,setShowHistory]=useState(false),[confirm,setConfirm]=useState<null|{warnings:string[]}>(null);
 const [ui,setUi]=useState<Ui>(loadUi),[showKeys,setShowKeys]=useState(false);
 // Lock and hide only help while editing (by item name, per map in this browser); they are not part of the map.
 // Marking an area of the selected piece that does not collide (leaves, ornaments): drag a box on the map.
 const [cutting,setCutting]=useState(false);
 const [locked,setLocked]=useState<Set<string>>(()=>new Set()),[hidden,setHidden]=useState<Set<string>>(()=>new Set());
 useEffect(()=>{try{localStorage.setItem(UI_KEY,JSON.stringify(ui));}catch{/* private window */}},[ui]);
 const toggleUi=(key:keyof Ui)=>setUi(u=>({...u,[key]:!u[key]}));
 const toggleIn=(set:typeof setLocked,name:string)=>set(s=>{const next=new Set(s);if(next.has(name))next.delete(name);else next.add(name);return next;});
 const history=useRef<{past:Doc[];future:Doc[]}>({past:[],future:[]});
 const builtFor=useRef<string>('');

 // ── Load: draft from the server, else the shipped layout, else a copy of the base map ──
 useEffect(()=>{let live=true;(async()=>{
  try{
   const r=await api.map(id);if(!live)return;setSummary(r.map);setRevisions(r.revisions);
   const fresh=JSON.parse(sessionStorage.getItem(`brasa-new-map:${id}`)??'null') as {name:string;kind:'pvp'|'instance';base:string}|null;
   let data:RevisionData|null=r.draft,layout=(data?.layout as MapLayout|undefined)??shippedLayout(id);
   const base=fresh?.base??r.map.base;
   if(!layout&&base){const b=await api.map(base).catch(()=>null);layout=(b?.draft?.layout as MapLayout|undefined)??shippedLayout(base);}
   if(!layout)throw new Error('Não achei o layout deste mapa (scripts/map-layouts).');
   const meta:Meta={name:data?.name??fresh?.name??layout.name??r.map.name,subtitle:String(data?.subtitle??r.map.subtitle??''),kind:(data?.kind??fresh?.kind??r.map.kind)==='instance'?'instance':'pvp',enabled:data?.enabled!==false};
   layout.name=meta.name;setDoc({layout,meta});setSavedRevision(r.map.draftRevision);setDirty(!!fresh);
   // Art: the map's own backdrop, or its base map's for a map created in the panel.
   const artId=(MAP_DEFINITIONS[id as MapId]?id:base) as MapId;
   loadImage(MAP_DEFINITIONS[artId]?.art.background??'/assets/maps/snow/background.webp').then(img=>live&&setBackdrop(img)).catch(()=>setError('Fundo do mapa não carregou.'));
   const entries=Object.entries(layout.sheets??{pieces:layout.pieces??''});
   const cut=await Promise.all(entries.map(async([name,file])=>[name,await describeSheet(layout!.source,name,file)] as const));
   if(!live)return;setSheets(Object.fromEntries(cut));
  }catch(e){if(live)setError((e as Error).message);}
 })();return()=>{live=false;};},[id]);

 // ── Rebuild (collision + warnings) shortly after each change ──
 const piecesBySheet=useMemo(()=>Object.fromEntries(Object.entries(sheets).map(([k,s])=>[k,s.pieces])),[sheets]);
 useEffect(()=>{
  if(!doc||!Object.keys(sheets).length)return;
  const key=JSON.stringify(doc.layout);if(key===builtFor.current)return;
  setBuilding(true);const timer=setTimeout(()=>{try{setBuilt(assemble(doc.layout,piecesBySheet));builtFor.current=key;}catch(e){setError((e as Error).message);}setBuilding(false);},450);
  return()=>clearTimeout(timer);
 },[doc,sheets,piecesBySheet]);

 // ── Editing with undo ──
 const change=useCallback((update:(d:Doc)=>void,record=true)=>{
  setDoc(current=>{if(!current)return current;const next=clone(current);update(next);if(record){history.current.past.push(current);if(history.current.past.length>100)history.current.past.shift();history.current.future=[];}return next;});
  setDirty(true);
 },[]);
 const undo=useCallback(()=>{const h=history.current;setDoc(current=>{const prev=h.past.pop();if(!prev||!current)return current;h.future.push(current);return prev;});setDirty(true);},[]);
 const redo=useCallback(()=>{const h=history.current;setDoc(current=>{const next=h.future.pop();if(!next||!current)return current;h.past.push(current);return next;});setDirty(true);},[]);
 const updateItem=(index:number,patch:Partial<LayoutItem>,record=true)=>change(d=>{Object.assign(d.layout.items[index],patch);for(const k of Object.keys(patch) as (keyof LayoutItem)[])if(patch[k]===undefined)delete d.layout.items[index][k];},record);
 const W=doc?.layout.width??1536;

 const addPiece=(sheet:string,piece:number,borrow?:{file:string;name?:string})=>{if(!doc)return;const v=viewRef.current,canvas=canvasRef.current,centre=canvas?Math.round((canvas.clientWidth/2-v.x)/v.scale):W/2;
  const object=sheetKind(sheet)==='objeto',n=doc.layout.items.length,base=slug(borrow?.name??sheets[sheet]?.names[sheets[sheet].sheet]?.[piece]??`${sheet}-${piece}`);let itemId=base,k=2;while(doc.layout.items.some(i=>i.id===itemId))itemId=`${base}-${k++}`;
  change(d=>{if(borrow){if(!d.layout.sheets){d.layout.sheets={pieces:d.layout.pieces??''};delete d.layout.pieces;}d.layout.sheets[sheet]=borrow.file;}d.layout.items.push({id:itemId,sheet,piece,x:Math.max(0,Math.min(W,centre)),top:object?200:420,scale:object?.32:.9,material:'earth',destructible:true,...(object?{rest:true}:{}),...(Math.abs(centre-W/2)<60?{mirror:false}:{})});});
  setSelection({type:'item',index:n});};
 /** A piece from the library: this layout's own sheet, or another folder's sheet borrowed under a new key. */
 const pick=async(entry:LibraryEntry)=>{if(!doc)return;
  const existing=Object.entries(doc.layout.sheets??{pieces:doc.layout.pieces??''}).find(([,file])=>sourceUrl(doc.layout.source,file)===entry.sheet.url)?.[0];
  if(existing){addPiece(existing,entry.n);return;}
  let key=`${entry.folder.id}-${entry.sheet.sheet}`.slice(0,32),k=2;while(doc.layout.sheets?.[key]||key==='pieces')key=`${entry.folder.id}-${entry.sheet.sheet}`.slice(0,29)+`-${k++}`;
  const file=relativeFile(doc.layout.source??'',entry.folder.source,entry.sheet.file),described=await describeSheet(doc.layout.source,key,file);
  setSheets(s=>({...s,[key]:described}));addPiece(key,entry.n,{file,name:entry.name});setNotice(`Peça de “${entry.folder.name}” adicionada. A folha passa a fazer parte deste mapa.`);};
 const addMonster=(kind:MonsterPlacement['kind'])=>{if(!doc)return;const index=doc.layout.monsters?.length??0,x=Math.round(-viewRef.current.x/viewRef.current.scale+(wrapRef.current?.clientWidth??800)/2/viewRef.current.scale);change(d=>{(d.layout.monsters??=[]).push({kind,x:Math.max(40,Math.min(W-40,x))});});setSelection({type:'monster',index});};
 const removeMonster=(index:number)=>{change(d=>{d.layout.monsters!.splice(index,1);});setSelection(null);};
 const removeItem=(index:number)=>{change(d=>{d.layout.items.splice(index,1);});setSelection(null);};
 const duplicate=(index:number)=>{if(!doc)return;const source=doc.layout.items[index];let itemId=`${source.id}-copia`,k=2;while(doc.layout.items.some(i=>i.id===itemId))itemId=`${source.id}-copia${k++}`;
  change(d=>{d.layout.items.splice(index+1,0,{...clone(source),id:itemId,x:source.x+40});});setSelection({type:'item',index:index+1});};
 const move=(index:number,by:number)=>{const to=index+by;if(!doc||to<0||to>=doc.layout.items.length)return;change(d=>{const [it]=d.layout.items.splice(index,1);d.layout.items.splice(to,0,it);});setSelection({type:'item',index:to});};

 // ── Canvas: view, drawing, hit testing ──
 const canvasRef=useRef<HTMLCanvasElement>(null),wrapRef=useRef<HTMLDivElement>(null),viewRef=useRef<View>({scale:.4,x:0,y:0}),dragRef=useRef<Drag|null>(null),[,redraw]=useState(0);
 const fit=useCallback(()=>{const wrap=wrapRef.current;if(!wrap)return;const scale=Math.max(MIN_ZOOM,Math.min((wrap.clientWidth-40)/W,(wrap.clientHeight-40)/MAP_HEIGHT));viewRef.current={scale,x:(wrap.clientWidth-W*scale)/2,y:(wrap.clientHeight-MAP_HEIGHT*scale)/2};redraw(n=>n+1);},[W]);
 /** Zooms keeping the world point under (mx,my) — the cursor, the pinch centre or the middle of the stage — where it is. */
 const zoomAt=useCallback((scale:number,mx?:number,my?:number)=>{const wrap=wrapRef.current,v=viewRef.current;if(!wrap)return;const next=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,scale)),x=mx??wrap.clientWidth/2,y=my??wrap.clientHeight/2;
  viewRef.current={scale:next,x:x-(x-v.x)*next/v.scale,y:y-(y-v.y)*next/v.scale};redraw(n=>n+1);},[]);
 useEffect(()=>{fit();const wrap=wrapRef.current;if(!wrap)return;const ro=new ResizeObserver(()=>redraw(n=>n+1));ro.observe(wrap);return()=>ro.disconnect();},[fit,!!doc]);
 // The wheel listener is native and not passive so it can stop the page (or a trackpad pinch) from zooming the whole browser.
 useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;
  const wheel=(e:WheelEvent)=>{e.preventDefault();const r=canvas.getBoundingClientRect(),v=viewRef.current,unit=e.deltaMode===1?16:e.deltaMode===2?400:1,dy=e.deltaY*unit,dx=e.deltaX*unit;
   if(e.shiftKey){viewRef.current={...v,x:v.x-(dy||dx)};redraw(n=>n+1);return;}
   zoomAt(v.scale*Math.exp(-dy*(e.ctrlKey?.01:.0015)),e.clientX-r.left,e.clientY-r.top);};
  canvas.addEventListener('wheel',wheel,{passive:false});return()=>canvas.removeEventListener('wheel',wheel);},[zoomAt,!!doc]);

 /** Items as drawn: built positions for props resting on the ground, live positions while they move. */
 const placed=useMemo(()=>{
  if(!doc)return [];
  const builtTop=new Map<string,number>(),builtItems=new Map<string,string>();
  if(built)for(const p of built.placed){builtTop.set(p.id,p.top);builtItems.set(p.id,JSON.stringify(p.item));}
  return expandItems(doc.layout).map(({item,source,mirrored})=>{
   const sheet=item.sheet??Object.keys(doc.layout.sheets??{})[0],piece=sheets[sheet]?.pieces[item.piece];
   const scale=item.scale??1,w=(piece?.w??0)*scale,h=(piece?.h??0)*scale;
   const sameAsBuilt=builtItems.get(item.id)===JSON.stringify(item),top=item.rest&&sameAsBuilt?builtTop.get(item.id)??item.top:item.top;
   const name=doc.layout.items[source]?.id??item.id;
   return {item,source,mirrored,piece,sheet,w,h,left:item.x-w/2,top,locked:locked.has(name),hidden:hidden.has(name)};
  });
 },[doc,built,sheets,locked,hidden]);
 const collisionLayer=useMemo(()=>{
  if(!built)return null;const c=document.createElement('canvas');c.width=built.width/3;c.height=MAP_HEIGHT/3;const g=c.getContext('2d')!,img=g.createImageData(c.width,c.height);
  for(const r of built.regions){const raw=atob(r.shape.bits);for(let n=0;n<r.shape.cols*r.shape.rows;n++)if(raw.charCodeAt(n>>3)>>(n&7)&1){const i=((r.shape.row+Math.floor(n/r.shape.cols))*c.width+r.shape.col+n%r.shape.cols)*4;if(i<0||i>=img.data.length)continue;
   if(r.destructible){img.data[i]=80;img.data[i+1]=230;img.data[i+2]=120;}else{img.data[i]=170;img.data[i+1]=170;img.data[i+2]=190;}img.data[i+3]=150;}}
  g.putImageData(img,0,0);return c;
 },[built]);
 const warnedItems=useMemo(()=>new Set(built?.warnings.flatMap(w=>w.item===undefined?[]:[w.item])??[]),[built]);
 const surfaceAt=useCallback((x:number)=>built&&x>=0&&x<built.width?built.surface[Math.floor(x)]:MAP_HEIGHT,[built]);
 /** Build warnings per spawn ("t-slot"), shown on the capsule itself so a spawn lifted by a prop or over a hole is seen at once. */
 const spawnWarnings=useMemo(()=>{const m=new Map<string,string[]>();for(const w of built?.warnings??[])if(w.spawn){const k=`${w.spawn[0]}-${w.spawn[1]}`;m.set(k,[...(m.get(k)??[]),w.text.replace(/^spawn time \d jogador \d \(x \d+\): /,'')]);}return m;},[built]);
 const monsterWarnings=useMemo(()=>new Set(built?.warnings.flatMap(w=>w.monster===undefined?[]:[w.monster])??[]),[built]);
 const hoverRef=useRef<{x:number;y:number}|null>(null);

 useEffect(()=>{
  const canvas=canvasRef.current,wrap=wrapRef.current;if(!canvas||!wrap||!doc)return;
  const dpr=devicePixelRatio||1,cw=wrap.clientWidth,ch=wrap.clientHeight;if(canvas.width!==cw*dpr||canvas.height!==ch*dpr){canvas.width=cw*dpr;canvas.height=ch*dpr;}
  const c=canvas.getContext('2d')!,v=viewRef.current;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,cw,ch);
  c.save();c.translate(v.x,v.y);c.scale(v.scale,v.scale);
  c.save();c.beginPath();c.rect(0,0,W,MAP_HEIGHT);c.clip();
  if(backdrop){const k=Math.max(W/backdrop.width,MAP_HEIGHT/backdrop.height);c.drawImage(backdrop,(W-backdrop.width*k)/2,MAP_HEIGHT-backdrop.height*k,backdrop.width*k,backdrop.height*k);c.fillStyle='rgba(7,13,24,.14)';c.fillRect(0,0,W,MAP_HEIGHT);}
  else{c.fillStyle='#22324a';c.fillRect(0,0,W,MAP_HEIGHT);}
  if(overlay.grid){c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=1/v.scale;for(let x=0;x<=W;x+=96){c.beginPath();c.moveTo(x,0);c.lineTo(x,MAP_HEIGHT);c.stroke();}for(let y=0;y<=MAP_HEIGHT;y+=96){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}}
  for(const p of placed){if(!p.piece||p.hidden)continue;c.save();c.translate(p.item.x,p.top);if(p.item.flip)c.scale(-1,1);if(p.item.solid===false)c.globalAlpha=.75;c.drawImage(p.piece.canvas,-p.w/2,0,p.w,p.h);c.restore();}
  if(overlay.collision&&collisionLayer){c.imageSmoothingEnabled=false;c.drawImage(collisionLayer,0,0,W,MAP_HEIGHT);c.imageSmoothingEnabled=true;}
  // Areas without collision: the selected piece's (or every piece's with the collision overlay on), and the box being drawn.
  const cut=dragRef.current?.kind==='cut'?cutBox(dragRef.current):null;
  doc.layout.items.forEach((item,index)=>{if(!overlay.collision&&!(selection?.type==='item'&&selection.index===index))return;for(const box of item.passThrough??[])drawCutBox(c,box,v.scale,false);});
  if(cut)drawCutBox(c,cut,v.scale,true);
  c.restore();
  // Frame, centre and the death line.
  c.lineWidth=2/v.scale;c.strokeStyle='rgba(255,255,255,.35)';c.strokeRect(0,0,W,MAP_HEIGHT);
  if(overlay.centre){c.setLineDash([10/v.scale,8/v.scale]);c.strokeStyle='rgba(255,214,120,.55)';c.beginPath();c.moveTo(W/2,0);c.lineTo(W/2,MAP_HEIGHT);c.stroke();c.setLineDash([]);
   for(let s=1;s<W/1536;s++){c.strokeStyle='rgba(255,255,255,.18)';c.beginPath();c.moveTo(s*1536,0);c.lineTo(s*1536,MAP_HEIGHT);c.stroke();}}
  c.strokeStyle='#ff4040';c.lineWidth=3/v.scale;c.beginPath();c.moveTo(0,MAP_HEIGHT-1);c.lineTo(W,MAP_HEIGHT-1);c.stroke();
  // Warnings and selection outlines.
  for(const p of placed){
   const selected=selection?.type==='item'&&selection.index===p.source,warned=warnedItems.has(p.source)&&!p.mirrored;
   if(p.hidden||!selected&&!warned)continue;
   c.lineWidth=(selected?2.5:2)/v.scale;c.strokeStyle=selected?(p.mirrored?'rgba(255,214,120,.7)':'#ffd166'):'#ff6b5a';if(p.mirrored||!selected&&warned)c.setLineDash([8/v.scale,6/v.scale]);
   if(p.mirrored&&!overlay.ghost&&!warned){c.setLineDash([]);continue;}
   c.strokeRect(p.left,p.top,p.w,p.h);c.setLineDash([]);
   if(selected&&!p.mirrored){c.fillStyle='#ffd166';for(const [hx,hy] of [[p.left,p.top],[p.left+p.w,p.top],[p.left,p.top+p.h],[p.left+p.w,p.top+p.h]]){c.fillRect(hx-4/v.scale,hy-4/v.scale,8/v.scale,8/v.scale);}}
  }
  // Spawns: a capsule standing on the ground, numbered like spawns.png.
  const s=1/Math.max(.45,v.scale);
  // 1x1 ruler: distance between position 1 of each team (ideal 900–1200 px).
  if(ui.ruler&&doc.layout.spawns[0]?.length&&doc.layout.spawns[1]?.length){const a=doc.layout.spawns[0][0],b=doc.layout.spawns[1][0],y=Math.min(surfaceAt(a),surfaceAt(b),MAP_HEIGHT-4)-90*s,d=Math.abs(b-a),ok=d>=900&&d<=1200;
   c.strokeStyle=ok?'#7be08e':'#ff6b5a';c.fillStyle=c.strokeStyle;c.lineWidth=2*s;c.setLineDash([6*s,5*s]);c.beginPath();c.moveTo(a,y);c.lineTo(b,y);c.stroke();c.setLineDash([]);
   for(const e of [a,b]){c.beginPath();c.moveTo(e,y-8*s);c.lineTo(e,y+8*s);c.stroke();}
   const label=`1x1: ${d} px${ok?'':' (ideal 900–1200)'}`;c.font=`800 ${14*s}px Nunito, sans-serif`;c.textAlign='center';const tw=c.measureText(label).width+16*s;
   c.fillStyle='#000c';c.beginPath();c.roundRect((a+b)/2-tw/2,y-26*s,tw,20*s,6*s);c.fill();c.fillStyle=ok?'#9ff0ad':'#ffb4a8';c.fillText(label,(a+b)/2,y-11*s);}
  doc.layout.spawns.forEach((team,t)=>team.forEach((x,slot)=>{const y=surfaceAt(x),bottom=y>=MAP_HEIGHT?MAP_HEIGHT-4:y,sel=selection?.type==='spawn'&&selection.team===t&&selection.slot===slot,bad=y>=MAP_HEIGHT||spawnWarnings.has(`${t}-${slot}`);
   c.save();c.translate(x,bottom);c.scale(s,s);
   if(sel||bad){c.shadowColor=sel?'#ffd166':'#ff4a3a';c.shadowBlur=18;}
   c.fillStyle=y>=MAP_HEIGHT?'#7a2a2a':TEAM_COLORS[t];c.strokeStyle=sel?'#ffd166':bad?'#ff6b5a':'#fff';c.lineWidth=sel||bad?4:2.5;c.beginPath();c.roundRect(-11,-46,22,46,9);c.fill();c.stroke();c.shadowBlur=0;
   c.font='900 20px Nunito, sans-serif';c.textAlign='center';c.lineWidth=5;c.strokeStyle='#000';c.strokeText(String(slot+1),0,-54);c.fillStyle='#fff';c.fillText(String(slot+1),0,-54);
   if(bad){c.fillStyle='#ff4a3a';c.beginPath();c.arc(15,-44,10,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.font='900 15px Nunito, sans-serif';c.fillText('!',15,-39);}
   c.restore();}));
  // Instance monsters and the nest, standing on the ground like in the game.
  (doc.layout.monsters??[]).forEach((m,index)=>{const y=m.y??Math.min(surfaceAt(m.x),MAP_HEIGHT-4),sel=selection?.type==='monster'&&selection.index===index,bad=monsterWarnings.has(index),def=MONSTERS[m.kind as keyof typeof MONSTERS];
   c.save();c.translate(m.x,y);
   if(def){const image=monsterSprite(m.kind,()=>redraw(n=>n+1)),h=def.sprite.height;
    if(image){const fw=image.naturalWidth/4,w=h*fw/image.naturalHeight;c.save();if(def.sprite.faces===1&&m.x>W/2||def.sprite.faces===-1&&m.x<W/2)c.scale(-1,1);c.drawImage(image,0,0,fw,image.naturalHeight,-w/2,-h*def.sprite.feet,w,h);c.restore();}
    else{c.fillStyle='#c0392b';c.beginPath();c.ellipse(0,-h*.3,h*.45,h*.3,0,0,Math.PI*2);c.fill();}
    if(sel||bad){c.strokeStyle=sel?'#ffd166':'#ff6b5a';c.lineWidth=3/v.scale;c.setLineDash([6/v.scale,4/v.scale]);c.strokeRect(-h*.6,-h,h*1.2,h+4);c.setLineDash([]);}}
   else{c.scale(s,s);c.strokeStyle=sel?'#ffd166':bad?'#ff6b5a':'#e3a25a';c.lineWidth=sel?5:4;c.beginPath();c.ellipse(0,-18,26,18,0,0,Math.PI*2);c.stroke();c.font='900 14px Nunito, sans-serif';c.textAlign='center';c.lineWidth=4;c.strokeStyle='#000';c.strokeText('ninho',0,-44);c.fillStyle='#ffd9a8';c.fillText('ninho',0,-44);}
   c.restore();});
  // One game screen around the cursor: what a player sees at once.
  if(ui.screen&&hoverRef.current){const left=Math.max(0,Math.min(W-SCREEN_WIDTH,hoverRef.current.x-SCREEN_WIDTH/2));c.strokeStyle='#7fd3ff';c.lineWidth=2/v.scale;c.setLineDash([12/v.scale,8/v.scale]);c.strokeRect(left,0,Math.min(SCREEN_WIDTH,W),MAP_HEIGHT);c.setLineDash([]);
   c.fillStyle='#7fd3ff';c.font=`800 ${13/v.scale}px Nunito, sans-serif`;c.textAlign='left';c.fillText('Tela do jogo',left+8/v.scale,18/v.scale);}
  c.restore();
 });

 const toWorld=(e:{clientX:number;clientY:number})=>{const r=canvasRef.current!.getBoundingClientRect(),v=viewRef.current;return {x:(e.clientX-r.left-v.x)/v.scale,y:(e.clientY-r.top-v.y)/v.scale};};
 const hitSpawn=(x:number,y:number)=>{if(!doc)return null;const s=1/Math.max(.45,viewRef.current.scale);
  for(let t=1;t>=0;t--)for(let slot=doc.layout.spawns[t].length-1;slot>=0;slot--){const sx=doc.layout.spawns[t][slot],sy=Math.min(surfaceAt(sx),MAP_HEIGHT-4);if(Math.abs(x-sx)<=14*s&&y<=sy+6*s&&y>=sy-70*s)return {team:t,slot};}return null;};
 const hitMonster=(x:number,y:number)=>{if(!doc)return null;const list=doc.layout.monsters??[];for(let n=list.length-1;n>=0;n--){const m=list[n],h=MONSTERS[m.kind as keyof typeof MONSTERS]?.sprite.height??60,my=m.y??Math.min(surfaceAt(m.x),MAP_HEIGHT-4);if(Math.abs(x-m.x)<=h*.55&&y<=my+8&&y>=my-h)return n;}return null;};
 const hitItem=(x:number,y:number)=>{for(let n=placed.length-1;n>=0;n--){const p=placed[n];if(!p.piece||p.locked||p.hidden||x<p.left||x>p.left+p.w||y<p.top||y>p.top+p.h)continue;
  const scale=p.item.scale??1,lx=Math.floor(((x-p.item.x)*(p.item.flip?-1:1)+p.w/2)/scale),ly=Math.floor((y-p.top)/scale);
  if(lx>=0&&ly>=0&&lx<p.piece.w&&ly<p.piece.h&&p.piece.alpha[(ly*p.piece.w+lx)*4+3]>60)return p;}return null;};

 // Touch: two fingers pinch to zoom and move the view together.
 const pointers=useRef(new Map<number,{x:number;y:number}>()),pinchRef=useRef<{dist:number;mx:number;my:number;view:View}|null>(null);
 const pinchState=()=>{const [a,b]=[...pointers.current.values()],r=canvasRef.current!.getBoundingClientRect();return {dist:Math.hypot(a.x-b.x,a.y-b.y)||1,mx:(a.x+b.x)/2-r.left,my:(a.y+b.y)/2-r.top};};
 const snap=(v:number)=>ui.snap?Math.round(v/SNAP)*SNAP:Math.round(v);
 const onPointerDown=(e:React.PointerEvent)=>{
  if(!doc)return;(e.target as HTMLElement).setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.current.size===2){dragRef.current=null;pinchRef.current={...pinchState(),view:{...viewRef.current}};return;}
  const {x,y}=toWorld(e);
  if(e.button===1||e.button===2||e.altKey){dragRef.current={kind:'pan',startX:e.clientX,startY:e.clientY,view:{...viewRef.current}};return;}
  if(cutting&&selection?.type==='item'){dragRef.current={kind:'cut',index:selection.index,startX:x,startY:y,x,y};return;}
  const spawn=hitSpawn(x,y);if(spawn){setSelection({type:'spawn',...spawn});dragRef.current={kind:'spawn',...spawn,startX:x,origin:doc.layout.spawns[spawn.team][spawn.slot],moved:false};return;}
  const monster=hitMonster(x,y);if(monster!==null){setSelection({type:'monster',index:monster});dragRef.current={kind:'monster',index:monster,startX:x,origin:doc.layout.monsters![monster].x,moved:false};return;}
  const item=hitItem(x,y);
  if(item){setSelection({type:'item',index:item.source});
   // A prop resting on the ground moves from where it is drawn, not from its stored drop height, so it never jumps into the sky.
   const origin=clone(doc.layout.items[item.source]),own=placed.find(p=>p.source===item.source&&!p.mirrored);if(origin.rest&&own)origin.top=Math.round(own.top);
   dragRef.current={kind:'item',index:item.source,mirrored:item.mirrored,startX:x,startY:y,origin,moved:false};return;}
  setSelection(null);dragRef.current={kind:'pan',startX:e.clientX,startY:e.clientY,view:{...viewRef.current}};
 };
 const onPointerMove=(e:React.PointerEvent)=>{
  if(pointers.current.has(e.pointerId))pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinchRef.current&&pointers.current.size>=2){const p=pinchRef.current,now=pinchState(),scale=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,p.view.scale*now.dist/p.dist));
   viewRef.current={scale,x:now.mx-(p.mx-p.view.x)*scale/p.view.scale,y:now.my-(p.my-p.view.y)*scale/p.view.scale};redraw(n=>n+1);return;}
  if(ui.screen){hoverRef.current=toWorld(e);if(!dragRef.current)redraw(n=>n+1);}
  const drag=dragRef.current;if(!drag)return;
  if(drag.kind==='pan'){viewRef.current={...drag.view,x:drag.view.x+e.clientX-drag.startX,y:drag.view.y+e.clientY-drag.startY};redraw(n=>n+1);return;}
  const {x,y}=toWorld(e);
  if(drag.kind==='cut'){drag.x=x;drag.y=y;redraw(n=>n+1);return;}
  if(drag.kind==='spawn'){const nx=Math.max(0,Math.min(W,snap(drag.origin+x-drag.startX)));change(d=>{d.layout.spawns[drag.team][drag.slot]=nx;},!drag.moved);drag.moved=true;return;}
  if(drag.kind==='monster'){const nx=Math.max(0,Math.min(W,snap(drag.origin+x-drag.startX)));change(d=>{const m=d.layout.monsters![drag.index];m.x=nx;delete m.y;},!drag.moved);drag.moved=true;return;}
  let dx=x-drag.startX,dy=y-drag.startY;if(e.shiftKey){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0;}
  if(drag.mirrored)dx=-dx;
  change(d=>{const item=d.layout.items[drag.index];item.x=snap(drag.origin.x+dx);item.top=snap(drag.origin.top+dy);},!drag.moved);drag.moved=true;
 };
 const onPointerUp=(e:React.PointerEvent)=>{pointers.current.delete(e.pointerId);if(pointers.current.size<2)pinchRef.current=null;
  const drag=dragRef.current;dragRef.current=null;
  if(drag?.kind==='cut'){const box=cutBox(drag);if(box.w>=8&&box.h>=8)change(d=>{const item=d.layout.items[drag.index];item.passThrough=[...(item.passThrough??[]),box];});setCutting(false);redraw(n=>n+1);}
 };
 const zoom100=()=>{const wrap=wrapRef.current!,v=viewRef.current,cx=(wrap.clientWidth/2-v.x)/v.scale;viewRef.current={scale:1,x:wrap.clientWidth/2-cx,y:(wrap.clientHeight-MAP_HEIGHT)/2};redraw(n=>n+1);};

 // ── Save and publish ──
 const save=useCallback(async():Promise<number|null>=>{
  if(!doc)return null;setBusy('Salvando…');setError('');
  try{
   await new Promise(r=>setTimeout(r,20));
   const fresh=assemble(doc.layout,piecesBySheet);setBuilt(fresh);builtFor.current=JSON.stringify(doc.layout);
   const whole=montage(fresh.width,backdrop??fresh.world,fresh.world),b64=(c:HTMLCanvasElement)=>c.toDataURL('image/png').split(',')[1];
   const payload:PieceSave={kind:doc.meta.kind,name:doc.meta.name,subtitle:doc.meta.subtitle,enabled:doc.meta.enabled,layout:{...doc.layout,name:doc.meta.name,subtitle:doc.meta.subtitle,kind:doc.meta.kind} as PieceSave['layout'],
    regions:fresh.regions.map(({solid:_solid,...r})=>({...r,material:r.material as PieceSave['regions'][number]['material']})),terrain:b64(fresh.world),preview:b64(preview(fresh.width,whole)),warnings:fresh.warnings.map(w=>w.text)};
   const r=await api.save(id,payload,summary?.builtIn?undefined:summary?.base);
   sessionStorage.removeItem(`brasa-new-map:${id}`);setSavedRevision(r.revision);setDirty(false);
   const m=await api.map(id);setSummary(m.map);setRevisions(m.revisions);
   setNotice(r.blockers.length?`Rascunho salvo, mas não pode ser publicado: ${r.blockers[0]}`:'Rascunho salvo.');return r.blockers.length?null:r.revision;
  }catch(e){setError((e as Error).message);return null;}finally{setBusy('');}
 },[doc,piecesBySheet,backdrop,id,summary]);
 const publish=async(revision?:number)=>{
  setConfirm(null);const target=revision??(dirty||!savedRevision?await save():savedRevision);if(!target)return;
  setBusy('Publicando…');try{await api.publish(id,target);const m=await api.map(id);setSummary(m.map);setRevisions(m.revisions);setNotice('Publicado: o jogo já usa esta versão nas próximas partidas.');}catch(e){setError((e as Error).message);}finally{setBusy('');}
 };
 const askPublish=()=>{const warnings=built?.warnings.map(w=>w.text)??[];if(warnings.length)setConfirm({warnings});else void publish();};
 const restoreOriginal=async()=>{if(!window.confirm(summary?.builtIn?'Voltar o jogo para a versão original deste mapa? Os rascunhos continuam no histórico.':'Tirar este mapa do jogo?'))return;
  setBusy('Voltando…');try{await api.unpublish(id);const m=await api.map(id);setSummary(m.map);setRevisions(m.revisions);setNotice(summary?.builtIn?'O jogo voltou a usar o mapa original.':'Mapa fora do jogo.');}catch(e){setError((e as Error).message);}finally{setBusy('');}};
 const deleteMap=async()=>{if(!window.confirm('Apagar este mapa e todo o histórico? Não dá para desfazer.'))return;try{await api.remove(id);onBack();}catch(e){setError((e as Error).message);}};
 const openRevision=async(revision:number)=>{try{const r=await api.revision(id,revision);const data=r.revision.data;if(!data.layout)return;
  change(d=>{d.layout=data.layout as MapLayout;d.meta={name:data.name,subtitle:String(data.subtitle??''),kind:data.kind==='instance'?'instance':'pvp',enabled:data.enabled!==false};});setShowHistory(false);setNotice(`Versão ${revision} aberta no editor. Salve para usá-la.`);}catch(e){setError((e as Error).message);}};
 const exportJson=()=>{if(!doc)return;const {kind:_kind,...layout}={...doc.layout,name:doc.meta.name,subtitle:doc.meta.subtitle};
  const blob=new Blob([JSON.stringify(layout,null,1)+'\n'],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};

 // ── Keyboard ──
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName))return;
   const mod=e.ctrlKey||e.metaKey;
   if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
   if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
   if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();void save();return;}
   if(selection?.type==='item'){
    if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate(selection.index);return;}
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeItem(selection.index);return;}
    const step=e.shiftKey?10:1,d={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];
    if(d&&doc){e.preventDefault();const it=doc.layout.items[selection.index],own=placed.find(p=>p.source===selection.index&&!p.mirrored),top=it.rest&&own?Math.round(own.top):it.top;updateItem(selection.index,{x:it.x+d[0],top:top+d[1]});}
    const name=doc?.layout.items[selection.index]?.id;
    if(name&&!mod&&e.key.toLowerCase()==='l'){toggleIn(setLocked,name);return;}
    if(name&&!mod&&e.key.toLowerCase()==='h'){toggleIn(setHidden,name);return;}
   }
   if(selection?.type==='spawn'&&doc&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();const step=(e.shiftKey?10:1)*(e.key==='ArrowLeft'?-1:1);change(d=>{d.layout.spawns[selection.team][selection.slot]=Math.max(0,Math.min(W,d.layout.spawns[selection.team][selection.slot]+step));});}
   if(selection?.type==='monster'&&doc){if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeMonster(selection.index);return;}
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const step=(e.shiftKey?10:1)*(e.key==='ArrowLeft'?-1:1);change(d=>{const m=d.layout.monsters![selection.index];m.x=Math.max(0,Math.min(W,m.x+step));});}}
   if(e.key==='Escape'){setSelection(null);setShowKeys(false);}
   if(mod||e.altKey)return;
   if(e.key==='+'||e.key==='='){zoomAt(viewRef.current.scale*1.25);return;}
   if(e.key==='-'||e.key==='_'){zoomAt(viewRef.current.scale/1.25);return;}
   if(e.key==='0'){fit();return;}
   if(e.key==='1'){zoom100();return;}
   if(e.key==='['){toggleUi('left');return;}
   if(e.key===']'){toggleUi('right');return;}
   if(e.key==='?'){setShowKeys(v=>!v);return;}
   const aid={g:'grid',m:'snap',r:'ruler',t:'screen'}[e.key.toLowerCase()];
   if(aid==='grid')setOverlay(o=>({...o,grid:!o.grid}));else if(aid)toggleUi(aid as keyof Ui);
  };
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 });
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(t);},[notice]);

 if(!doc)return <div className="adm-editor loading">{error?<div className="adm-editor-error"><p className="adm-error">{error}</p><button className="adm-btn" onClick={onBack}><ArrowLeft size={16}/>Voltar</button></div>:<><Loader2 className="adm-spin" size={34}/><p>Recortando as peças do mapa…</p></>}</div>;
 const selectedItem=selection?.type==='item'?doc.layout.items[selection.index]:null,s=summary?status({...summary,draftRevision:savedRevision}):null;
 const warnings=built?.warnings??[];

 return <div className={`adm-editor ${ui.left?'':'hide-left'} ${ui.right?'':'hide-right'}`}>
  <header className="adm-editor-bar">
   <button className="adm-icon" onClick={()=>{if(!dirty||window.confirm('Sair sem salvar as mudanças?'))onBack();}} title="Voltar aos mapas"><ArrowLeft size={18}/></button>
   <div className="adm-editor-title"><input value={doc.meta.name} maxLength={40} onChange={e=>change(d=>{d.meta.name=e.target.value;d.layout.name=e.target.value;})} aria-label="Nome do mapa"/>
    <small><span className={`adm-kind ${doc.meta.kind}`}>{MAP_KIND_NAMES[doc.meta.kind]}</span>{s&&<span className={`adm-status ${dirty?'dirty':s.tone}`}>{dirty?'Alterações não salvas':s.label}</span>}<code>{id}</code></small></div>
   <div className="adm-toolgroup">
    <button className={`adm-icon ${ui.left?'on':''}`} onClick={()=>toggleUi('left')} title="Barra das peças ( [ )">{ui.left?<PanelLeftClose size={17}/>:<PanelLeftOpen size={17}/>}</button>
    <button className="adm-icon" onClick={undo} disabled={!history.current.past.length} title="Desfazer (Ctrl+Z)"><Undo2 size={17}/></button>
    <button className="adm-icon" onClick={redo} disabled={!history.current.future.length} title="Refazer (Ctrl+Y)"><Redo2 size={17}/></button>
   </div>
   <div className="adm-toolgroup">
    <button className="adm-icon" onClick={()=>zoomAt(viewRef.current.scale/1.25)} title="Afastar ( − )"><ZoomOut size={17}/></button>
    <button className="adm-icon text adm-zoom" onClick={zoom100} title="Tamanho real ( 1 )">{Math.round(viewRef.current.scale*100)}%</button>
    <button className="adm-icon" onClick={()=>zoomAt(viewRef.current.scale*1.25)} title="Aproximar ( + )"><ZoomIn size={17}/></button>
    <button className="adm-icon" onClick={fit} title="Ver o mapa inteiro ( 0 )"><Maximize size={17}/></button>
   </div>
   <div className="adm-toolgroup">
    <button className={`adm-icon ${overlay.collision?'on':''}`} onClick={()=>setOverlay(o=>({...o,collision:!o.collision}))} title="Mostrar colisão (verde quebra, cinza não quebra)"><ShieldAlert size={17}/></button>
    <button className={`adm-icon ${overlay.grid?'on':''}`} onClick={()=>setOverlay(o=>({...o,grid:!o.grid}))} title="Grade de 96 px ( G )"><Grid3x3 size={17}/></button>
    <button className={`adm-icon ${ui.snap?'on':''}`} onClick={()=>toggleUi('snap')} title={`Encaixe de ${SNAP} px ao arrastar ( M )`}><Magnet size={17}/></button>
    <button className={`adm-icon ${ui.ruler?'on':''}`} onClick={()=>toggleUi('ruler')} title="Régua do 1x1 ( R )"><Ruler size={17}/></button>
    <button className={`adm-icon ${ui.screen?'on':''}`} onClick={()=>toggleUi('screen')} title="Tamanho de uma tela do jogo em volta do cursor ( T )"><Monitor size={17}/></button>
    <button className={`adm-icon ${overlay.ghost?'on':''}`} onClick={()=>setOverlay(o=>({...o,ghost:!o.ghost}))} title="Contorno do lado espelhado"><FlipHorizontal2 size={17}/></button>
   </div>
   <span className="adm-spacer"/>
   {building&&<span className="adm-checking"><Loader2 className="adm-spin" size={14}/>Verificando</span>}
   <button className="adm-btn ghost" onClick={()=>setShowHistory(v=>!v)} aria-label="Histórico" title="Versões salvas"><History size={16}/><span className="adm-btn-label">Histórico</span></button>
   <button className="adm-btn ghost" onClick={exportJson} aria-label="JSON" title="Baixar o layout para scripts/map-layouts e npm run build:map"><Download size={16}/><span className="adm-btn-label">JSON</span></button>
   <button className="adm-btn" onClick={()=>void save()} disabled={!!busy} aria-label="Salvar" title="Salvar rascunho (Ctrl+S)"><Save size={16}/><span className="adm-btn-label">Salvar</span></button>
   <button className="adm-btn gold" onClick={askPublish} disabled={!!busy} aria-label="Publicar" title="Pôr no jogo"><Rocket size={16}/><span className="adm-btn-label">Publicar</span></button>
   <div className="adm-toolgroup">
    <button className={`adm-icon ${showKeys?'on':''}`} onClick={()=>setShowKeys(v=>!v)} title="Atalhos ( ? )"><Keyboard size={17}/></button>
    <button className={`adm-icon ${ui.right?'on':''}`} onClick={()=>toggleUi('right')} title="Barra de propriedades ( ] )">{ui.right?<PanelRightClose size={17}/>:<PanelRightOpen size={17}/>}</button>
   </div>
  </header>

  <aside className="adm-editor-left">
   <div className="adm-tabs small"><button className={panel==='pieces'?'on':''} onClick={()=>setPanel('pieces')}>Peças</button><button className={panel==='layers'?'on':''} onClick={()=>setPanel('layers')}><Layers size={14}/>Itens <small>{doc.layout.items.length}</small></button></div>
   {panel==='pieces'?<>
    <PiecePicker source={doc.layout.source??''} onPick={e=>void pick(e)}/>
   </>:<ol className="adm-layers">{doc.layout.items.map((item,n)=><li key={`${item.id}-${n}`} className={selection?.type==='item'&&selection.index===n?'on':''} onClick={()=>setSelection({type:'item',index:n})}>
     <img src={sheets[item.sheet??'']?.pieces[item.piece]?.thumb} alt="" style={hidden.has(item.id)?{opacity:.35}:undefined}/><span><b>{item.id}</b><small>{sheets[item.sheet??'']?.label??item.sheet} · {pieceLabel(sheets[item.sheet??''],item.piece)}{doc.layout.mirror&&item.mirror!==false?' · espelhado':''}</small></span>{warnedItems.has(n)&&<AlertTriangle size={14} className="warn"/>}
     <button className={`adm-layer-btn ${locked.has(item.id)?'on':''}`} onClick={e=>{e.stopPropagation();toggleIn(setLocked,item.id);}} title={locked.has(item.id)?'Destravar ( L )':'Travar: não move pelo mapa ( L )'}>{locked.has(item.id)?<Lock size={13}/>:<Unlock size={13}/>}</button>
     <button className={`adm-layer-btn ${hidden.has(item.id)?'on':''}`} onClick={e=>{e.stopPropagation();toggleIn(setHidden,item.id);}} title={hidden.has(item.id)?'Mostrar ( H )':'Esconder só no editor ( H )'}>{hidden.has(item.id)?<EyeOff size={13}/>:<Eye size={13}/>}</button></li>)}</ol>}
   <div className="adm-spawn-list"><h4><Users size={15}/>Spawns</h4>{doc.layout.spawns.map((team,t)=><div key={t} className="adm-spawn-team"><span style={{color:TEAM_COLORS[t]}}>Time {t+1}</span>{team.map((x,slot)=><button key={slot} className={selection?.type==='spawn'&&selection.team===t&&selection.slot===slot?'on':''} style={{'--team':TEAM_COLORS[t]} as React.CSSProperties} onClick={()=>setSelection({type:'spawn',team:t,slot})} title={`x ${x}`}>{slot+1}</button>)}</div>)}
    <small>Posição 1 é a do 1x1. Arraste no mapa (só na horizontal; o pé fica no chão). O spawn fica sobre o que tiver colisão embaixo, inclusive objetos: com <b>!</b> vermelho, tire o objeto de baixo dele.</small></div>
   {doc.meta.kind==='instance'&&<div className="adm-spawn-list adm-monster-list"><h4><ShieldAlert size={15}/>Monstros <small>{doc.layout.monsters?.length??0}</small></h4>
    <ol>{(doc.layout.monsters??[]).map((m,n)=><li key={n}><button className={selection?.type==='monster'&&selection.index===n?'on':''} onClick={()=>setSelection({type:'monster',index:n})}>{MONSTER_LABELS[m.kind]??m.kind}<small>x {Math.round(m.x)}</small>{monsterWarnings.has(n)&&<AlertTriangle size={13} className="warn"/>}</button></li>)}</ol>
    <label className="adm-field"><span>Adicionar</span><select value="" onChange={e=>{if(e.target.value)addMonster(e.target.value as MonsterPlacement['kind']);}}><option value="">Escolha um monstro…</option>{[...MONSTER_KINDS,...MARKER_KINDS].map(kind=><option key={kind} value={kind}>{MONSTER_LABELS[kind]}</option>)}</select></label>
    <small>Os monstros entram andando pelas bordas do mapa até estes pontos. A rainha fica parada; o ninho é de onde ela manda formigas.</small></div>}
  </aside>

  <div className="adm-stage" ref={wrapRef}>
   <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={()=>{if(ui.screen){hoverRef.current=null;redraw(n=>n+1);}}} onContextMenu={e=>e.preventDefault()}/>
   <div className="adm-stage-help">Arraste para mover · roda ou dois dedos = zoom · arraste o fundo para navegar · <b>?</b> atalhos</div>
   {showKeys&&<div className="adm-keys"><header><h4><Keyboard size={15}/>Atalhos</h4><button className="adm-icon" onClick={()=>setShowKeys(false)}><X size={15}/></button></header><dl>{SHORTCUTS.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>}
   {(notice||error||busy)&&<div className={`adm-toast ${error?'bad':''}`}>{busy?<><Loader2 className="adm-spin" size={15}/>{busy}</>:error||notice}{(error||notice)&&!busy&&<button onClick={()=>{setError('');setNotice('');}}><X size={14}/></button>}</div>}
  </div>

  <aside className="adm-editor-right">
   {selectedItem&&selection?.type==='item'?<ItemInspector item={selectedItem} index={selection.index} mirrorMap={!!doc.layout.mirror} sheets={sheets} width={W} locked={locked.has(selectedItem.id)} onLock={()=>toggleIn(setLocked,selectedItem.id)} onChange={(patch,record)=>updateItem(selection.index,patch,record)} onDuplicate={()=>duplicate(selection.index)} onRemove={()=>removeItem(selection.index)} onMove={by=>move(selection.index,by)} last={doc.layout.items.length-1} cutting={cutting} onCut={()=>setCutting(on=>!on)}/>
   :selection?.type==='spawn'?<SpawnInspector doc={doc} team={selection.team} slot={selection.slot} width={W} ground={surfaceAt(doc.layout.spawns[selection.team][selection.slot])} problems={spawnWarnings.get(`${selection.team}-${selection.slot}`)??[]} onChange={x=>change(d=>{d.layout.spawns[selection.team][selection.slot]=x;})} onMirror={()=>change(d=>{d.layout.spawns[1]=d.layout.spawns[0].map(x=>W-x);})}/>
   :selection?.type==='monster'&&doc.layout.monsters?.[selection.index]?<MonsterInspector monster={doc.layout.monsters[selection.index] as MonsterPlacement} width={W} ground={surfaceAt(doc.layout.monsters[selection.index].x)} problems={(built?.warnings??[]).filter(w=>w.monster===selection.index).map(w=>w.text)} onChange={patch=>change(d=>{Object.assign(d.layout.monsters![selection.index],patch);})} onRemove={()=>removeMonster(selection.index)}/>
   :<MapInspector doc={doc} id={id} summary={summary} onChange={change} onRestore={restoreOriginal} onDelete={deleteMap}/>}
   <section className="adm-warnings"><h4>{warnings.length?<><AlertTriangle size={15}/>{warnings.length} {warnings.length===1?'aviso':'avisos'}</>:<><Eye size={15}/>Sem avisos</>}</h4>
    {warnings.length?<ul>{warnings.map((w,n)=><li key={n}><button onClick={()=>w.item!==undefined?setSelection({type:'item',index:w.item}):w.spawn?setSelection({type:'spawn',team:w.spawn[0],slot:w.spawn[1]}):w.monster!==undefined?setSelection({type:'monster',index:w.monster}):undefined}>{w.text}</button></li>)}</ul>:<p>Nenhum objeto flutuando, peça escondida ou spawn obstruído.</p>}
    {built&&<small>{built.regions.length} regiões de colisão · {doc.layout.items.length} itens</small>}
   </section>
  </aside>

  {showHistory&&<div className="adm-drawer"><header><h3><History size={17}/>Histórico</h3><button className="adm-icon" onClick={()=>setShowHistory(false)}><X size={17}/></button></header>
   {revisions.length?<ul>{revisions.map(r=><li key={r.id} className={r.published?'live':''}><div><b>Versão {r.id}{r.published&&<span className="adm-status live">No jogo</span>}</b><small>{new Date(r.createdAt).toLocaleString('pt-BR')} · {r.createdBy}{r.warnings?` · ${r.warnings} avisos`:''}</small></div>
    <span><button className="adm-btn small ghost" onClick={()=>openRevision(r.id)}>Abrir</button>{!r.published&&<button className="adm-btn small" onClick={()=>publish(r.id)}><Rocket size={13}/>Publicar</button>}</span></li>)}</ul>:<p className="adm-empty">Ainda não há versões salvas. A primeira aparece quando você salvar.</p>}
  </div>}

  {confirm&&<div className="adm-overlay"><div className="adm-dialog"><header><h2>Publicar com avisos?</h2><button className="adm-icon" onClick={()=>setConfirm(null)}><X size={18}/></button></header>
   <p>O montador encontrou {confirm.warnings.length} {confirm.warnings.length===1?'problema':'problemas'}. O ideal é zerar antes de pôr no jogo.</p>
   <ul className="adm-warn-list">{confirm.warnings.map((w,n)=><li key={n}>{w}</li>)}</ul>
   <footer><button className="adm-btn ghost" onClick={()=>setConfirm(null)}>Voltar e corrigir</button><button className="adm-btn gold" onClick={()=>publish()}><Rocket size={16}/>Publicar mesmo assim</button></footer></div></div>}
 </div>;
}

function Num({label,value,onChange,step=1,min,max,suffix}:{label:string;value:number;onChange:(v:number,record:boolean)=>void;step?:number;min?:number;max?:number;suffix?:string}){
 return <label className="adm-field"><span>{label}</span><span className="adm-num"><input type="number" value={round(value)} step={step} min={min} max={max} onChange={e=>{const v=Number(e.target.value);if(Number.isFinite(v))onChange(v,true);}}/>{suffix&&<em>{suffix}</em>}</span></label>;
}
function Toggle({label,hint,value,onChange}:{label:string;hint?:string;value:boolean;onChange:(v:boolean)=>void}){
 return <label className="adm-toggle-row"><span><b>{label}</b>{hint&&<small>{hint}</small>}</span><button type="button" className={`adm-toggle ${value?'on':''}`} aria-pressed={value} onClick={()=>onChange(!value)}><i/></button></label>;
}

function ItemInspector({item,index,mirrorMap,sheets,width,locked,onLock,onChange,onDuplicate,onRemove,onMove,last,cutting,onCut}:{item:LayoutItem;index:number;mirrorMap:boolean;sheets:Record<string,Sheet>;width:number;locked:boolean;onLock:()=>void;onChange:(patch:Partial<LayoutItem>,record?:boolean)=>void;onDuplicate:()=>void;onRemove:()=>void;onMove:(by:number)=>void;last:number;cutting:boolean;onCut:()=>void}){
 const sheet=item.sheet??Object.keys(sheets)[0],pieces=sheets[sheet]?.pieces??[],mirrored=mirrorMap&&item.mirror!==false;
 return <section className="adm-inspector">
  <header><h3>{item.id}</h3><span><button className="adm-icon" onClick={()=>onMove(-1)} disabled={index===0} title="Desenhar antes (para trás)"><ArrowDown size={15}/></button><button className="adm-icon" onClick={()=>onMove(1)} disabled={index===last} title="Desenhar depois (para frente)"><ArrowUp size={15}/></button><button className={`adm-icon ${locked?'on':''}`} onClick={onLock} title={locked?'Destravar ( L )':'Travar: não move pelo mapa ( L )'}>{locked?<Lock size={15}/>:<Unlock size={15}/>}</button><button className="adm-icon" onClick={()=>onChange({x:width/2,mirror:mirrorMap?false:item.mirror})} title="Pôr no centro do mapa (sem cópia espelhada)"><AlignCenterVertical size={15}/></button><button className="adm-icon" onClick={onDuplicate} title="Duplicar (Ctrl+D)"><Copy size={15}/></button><button className="adm-icon danger" onClick={onRemove} title="Apagar (Del)"><Trash2 size={15}/></button></span></header>
  <div className="adm-piece-pick"><img src={pieces[item.piece]?.thumb} alt=""/><div>
   <label className="adm-field"><span>Folha</span><select value={sheet} onChange={e=>onChange({sheet:e.target.value,piece:0})}>{Object.values(sheets).map(sh=><option key={sh.name} value={sh.name}>{sh.foreign?`${sh.label} (${sh.folder})`:sh.label}</option>)}</select></label>
   <label className="adm-field"><span>Peça</span><select value={item.piece} onChange={e=>onChange({piece:Number(e.target.value)})}>{pieces.map((p,n)=><option key={n} value={n}>{pieceLabel(sheets[sheet],n)} · {p.w}×{p.h}</option>)}</select></label>
  </div></div>
  <label className="adm-field"><span>Nome</span><input value={item.id} maxLength={48} onChange={e=>onChange({id:e.target.value.replace(/[^a-z0-9_-]/gi,'-')})}/></label>
  <div className="adm-pair"><Num label="X (centro)" value={item.x} onChange={v=>onChange({x:v})}/><Num label="Topo" value={item.top} onChange={v=>onChange({top:v})}/></div>
  <label className="adm-field"><span>Escala</span><span className="adm-range"><input type="range" min={.1} max={2} step={.01} value={item.scale??1} onChange={e=>onChange({scale:Number(e.target.value)},false)} onPointerUp={e=>onChange({scale:Number((e.target as HTMLInputElement).value)})}/><input type="number" step={.01} min={.05} max={4} value={item.scale??1} onChange={e=>onChange({scale:Number(e.target.value)||1})}/></span></label>
  <Toggle label="Virar" hint="Espelha a peça no lugar" value={!!item.flip} onChange={v=>onChange({flip:v||undefined})}/>
  {mirrorMap&&<Toggle label="Repetir no outro time" hint="Cópia espelhada do outro lado do centro" value={mirrored} onChange={v=>onChange({mirror:v?undefined:false})}/>}
  {mirrored&&<label className="adm-field"><span>Peça do lado espelhado</span><select value={item.mirrorAs?.piece??-1} onChange={e=>{const v=Number(e.target.value);onChange({mirrorAs:v<0?undefined:{...item.mirrorAs,piece:v}});}}><option value={-1}>A mesma</option>{pieces.map((p,n)=><option key={n} value={n}>{pieceLabel(sheets[sheet],n)} · {p.w}×{p.h}</option>)}</select><small>Varia os dois lados para não ficarem iguais.</small></label>}
  <Toggle label="Apoiar no chão" hint="Cai até o chão abaixo do topo" value={!!item.rest} onChange={v=>onChange({rest:v||undefined})}/>
  {item.rest&&<Num label="Afundar" value={item.sink??8} suffix="px" onChange={v=>onChange({sink:v})}/>}
  <Toggle label="Quebra com tiros" value={item.destructible!==false} onChange={v=>onChange({destructible:v})}/>
  <Toggle label="Tem colisão" hint="Desligado: só enfeite, sem chão" value={item.solid!==false} onChange={v=>onChange({solid:v?undefined:false})}/>
  {item.solid!==false&&<Toggle label="Chão liso" hint="Pedrinhas e calombos em cima ficam só de enfeite: ninguém escala" value={!!item.smooth} onChange={v=>onChange({smooth:v?160:undefined})}/>}
  {item.solid!==false&&<div className="adm-cut-areas">
   <label className="adm-toggle-row"><span><b>Marcar área sem colisão</b><small>Arraste um retângulo sobre a peça: ali ninguém pisa nem bate (folhas, enfeites)</small></span><button type="button" className={`adm-toggle ${cutting?'on':''}`} aria-pressed={cutting} onClick={onCut}><i/></button></label>
   {(item.passThrough??[]).map((box,n)=><div key={n} className="adm-cut-area"><span>Área {n+1} · x {box.x} · y {box.y} · {box.w}×{box.h}</span><button type="button" className="adm-icon" title="Devolver a colisão desta área" onClick={()=>{const rest=(item.passThrough??[]).filter((_,k)=>k!==n);onChange({passThrough:rest.length?rest:undefined});}}><Trash2 size={14}/></button></div>)}
  </div>}
 </section>;
}

function SpawnInspector({doc,team,slot,width,ground,problems,onChange,onMirror}:{doc:Doc;team:number;slot:number;width:number;ground:number;problems:string[];onChange:(x:number)=>void;onMirror:()=>void}){
 const x=doc.layout.spawns[team][slot],other=doc.layout.spawns[1-team][slot],duel=Math.abs(doc.layout.spawns[1][0]-doc.layout.spawns[0][0]);
 return <section className="adm-inspector">
  <header><h3 style={{color:TEAM_COLORS[team]}}>Time {team+1} · jogador {slot+1}</h3></header>
  <Num label="X" value={x} min={0} max={width} onChange={v=>onChange(Math.round(Math.max(0,Math.min(width,v))))}/>
  <dl className="adm-facts"><dt>Chão em</dt><dd>{ground>=MAP_HEIGHT?'sem chão!':`y ${ground}`}</dd><dt>Espelho exato</dt><dd>{width-other===x?'sim':`não (seria ${width-other})`}</dd><dt>Distância no 1x1</dt><dd className={duel<900||duel>1200?'bad':''}>{duel} px <small>(ideal 900–1200)</small></dd></dl>
  {problems.length>0&&<ul className="adm-spawn-problems">{problems.map(p=><li key={p}><AlertTriangle size={13}/>{p}</li>)}</ul>}
  <button className="adm-btn wide" onClick={onMirror}><FlipHorizontal2 size={16}/>Espelhar time 1 → time 2</button>
 </section>;
}

function MonsterInspector({monster,width,ground,problems,onChange,onRemove}:{monster:MonsterPlacement;width:number;ground:number;problems:string[];onChange:(patch:Partial<MonsterPlacement>)=>void;onRemove:()=>void}){
 const def=MONSTERS[monster.kind as keyof typeof MONSTERS];
 return <section className="adm-inspector">
  <header><h3>{MONSTER_LABELS[monster.kind]??monster.kind}</h3><span><button className="adm-icon danger" onClick={onRemove} title="Apagar (Del)"><Trash2 size={15}/></button></span></header>
  <label className="adm-field"><span>Tipo</span><select value={monster.kind} onChange={e=>onChange({kind:e.target.value as MonsterPlacement['kind']})}>{[...MONSTER_KINDS,...MARKER_KINDS].map(kind=><option key={kind} value={kind}>{MONSTER_LABELS[kind]}</option>)}</select></label>
  <Num label="X" value={monster.x} min={0} max={width} onChange={v=>onChange({x:Math.round(Math.max(0,Math.min(width,v)))})}/>
  <dl className="adm-facts"><dt>Chão em</dt><dd>{ground>=MAP_HEIGHT?'sem chão!':`y ${ground}`}</dd>{def&&<><dt>Vida (1 jogador)</dt><dd>{Math.round(def.hp*.925)}</dd><dt>Ataque</dt><dd>{def.attack}</dd>{def.behavior==='melee'?<><dt>Passo por turno</dt><dd>{def.stride} px</dd></>:<><dt>Como luta</dt><dd>flechas de longe e invoca formigas</dd></>}</>}</dl>
  {problems.length>0&&<ul className="adm-spawn-problems">{problems.map(p=><li key={p}><AlertTriangle size={13}/>{p}</li>)}</ul>}
  <p className="adm-hint">Arraste no mapa (só na horizontal; o pé fica no chão). Força e recompensas ficam em shared/expeditions.ts.</p>
 </section>;
}

function MapInspector({doc,id,summary,onChange,onRestore,onDelete}:{doc:Doc;id:string;summary:AdminMapSummary|null;onChange:(u:(d:Doc)=>void)=>void;onRestore:()=>void;onDelete:()=>void}){
 const W=doc.layout.width??1536;
 return <section className="adm-inspector">
  <header><h3>Mapa</h3></header>
  <label className="adm-field"><span>Subtítulo</span><input value={doc.meta.subtitle} maxLength={80} placeholder="Aparece na tela de carregamento" onChange={e=>onChange(d=>{d.meta.subtitle=e.target.value;})}/></label>
  <div className="adm-field"><span>Tipo</span><span className={`adm-kind ${doc.meta.kind}`}>{MAP_KIND_NAMES[doc.meta.kind]}</span>
   <small>{doc.meta.kind==='instance'?'Estágio de expedição (Central de Expedições): não entra no sorteio PvP; os monstros ficam na lista da esquerda.':'Entra no sorteio das partidas PvP.'} O tipo é escolhido ao criar o mapa e não muda depois.</small></div>
  {doc.meta.kind==='pvp'&&<Toggle label="No sorteio PvP" hint="Desligue para tirar o mapa das partidas" value={doc.meta.enabled} onChange={v=>onChange(d=>{d.meta.enabled=v;})}/>}
  <label className="adm-field"><span>Largura</span><span className="adm-seg">{[1,1.5,2,2.5,3].map(k=><button key={k} type="button" className={W===1536*k?'on':''} onClick={()=>onChange(d=>{const old=d.layout.width??1536,next=1536*k,shift=(next-old)/2;d.layout.width=next;for(const it of d.layout.items)it.x+=shift;d.layout.spawns=d.layout.spawns.map(t=>t.map(x=>x+shift));})}>{k.toLocaleString('pt-BR')}</button>)}</span><small>Em telas de 1536 px; tudo se desloca para manter o centro. Altura fixa de 864.</small></label>
  <Toggle label="Espelhar para o outro time" hint="Cada item ganha uma cópia do outro lado" value={!!doc.layout.mirror} onChange={v=>onChange(d=>{d.layout.mirror=v;})}/>
  <dl className="adm-facts"><dt>Código</dt><dd>{id}</dd><dt>Arte de</dt><dd>{summary?.base??id}</dd><dt>Peças</dt><dd>{doc.layout.source}</dd></dl>
  <p className="adm-hint">Selecione uma peça ou um spawn no mapa para editar. Peças novas de arte entram pelo Codex (docs/maps-kit.md).</p>
  <div className="adm-danger-zone">
   {summary?.publishedRevision&&<button className="adm-btn ghost wide" onClick={onRestore}><RotateCcw size={15}/>{summary.builtIn?'Voltar ao original no jogo':'Tirar do jogo'}</button>}
   {summary&&!summary.builtIn&&<button className="adm-btn danger wide" onClick={onDelete}><Trash2 size={15}/>Apagar mapa</button>}
  </div>
 </section>;
}

const slug=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'peca';
const pieceLabel=(sheet:Sheet|undefined,n:number)=>sheet?pieceName(sheet.names,sheet.sheet,n):`peça ${n}`;
/** Cuts one of the layout's sheets and finds which folder it belongs to (its own or a borrowed one) for labels and names. */
async function describeSheet(source:string|undefined,name:string,file:string):Promise<Sheet>{
 const url=sourceUrl(source,file),origin=folderOf(url),pieces=await loadSheet(url),names=origin?await folderNames(origin.folder):{};
 const sheet=origin?.sheet.sheet??name,foreign=file.includes('..');
 return {name,pieces,names,sheet,foreign,folder:origin?.folder.name??'',label:SHEET_NAMES[sheet]??sheet};
}
