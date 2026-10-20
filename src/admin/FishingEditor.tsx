import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AlertTriangle,ArrowDown,ArrowLeft,ArrowUp,Copy,Eye,FlipHorizontal,History,Loader2,Maximize,Plus,Redo2,Rocket,RotateCcw,Save,Search,Trash2,Undo2,X,MapPin,Waves,Footprints} from 'lucide-react';
import {api} from './api';
import {FishingWorld} from '../game/fishingWorld';
import {FISHING_AIRSHIP,FISHING_HEIGHT,FISHING_LAKES,FISHING_OBSTACLES,FISHING_SPAWN,FISHING_SPOTS,FISHING_TERRACES,FISHING_WIDTH,FISH_TABLES,POND_ARTS,applyFishingLayout,deckOf,defaultFishingLayout,fishingBlocked,isSolid,isWalkway,itemLocal,itemPoint,itemSize,lakeOf,pondPlace,stairPlace,FRONT_STAIRS} from '../../shared/fishingMap';
import type {StairArt} from '../../shared/fishingMap';
import type {FishTable,FishingItem,FishingLakeDef,FishingLayer,FishingLayout} from '../../shared/fishingMap';
import {FISHING_PROPS} from '../../shared/generated/fishingProps';
import type {FishingPropId} from '../../shared/generated/fishingProps';
import {FISHING_MAP_ID} from '../../shared/mapAdmin';
import type {AdminMapSummary,AdminRevision} from '../../shared/mapAdmin';
import {status} from './MapList';

/**
 * Pescaria: ponds, stairs and every painted piece of the fishing garden (shared/fishingMap.ts
 * FishingLayout), drawn with the game's own FishingWorld. Pieces move, turn, grow and shrink;
 * the palette adds any piece cut by `npm run build:fishing`. Publishing swaps the Pescaria for
 * everyone (server collision and spots, and the game's art) without a rebuild.
 */
type Selection={type:'item'|'lake'|'stair';id:string}|{type:'casa'|'airship'|'spawn'}|null;
type Handle='scale'|'rotate'|'width';
type Drag={what:Selection;handle?:Handle;startX:number;startY:number;origin:FishingLayout;moved:boolean}|{what:'pan';startX:number;startY:number;view:{scale:number;x:number;y:number}};
const clone=<T,>(v:T):T=>structuredClone(v);
const W=FISHING_WIDTH,H=FISHING_HEIGHT;

/** Names shown in the palette and the inspector. */
const PROP_NAMES:Record<string,string>={
 'cypress-pair':'Ciprestes','urn-pillar':'Pilar com vaso','lamp-pillar':'Pilar com lampião',balustrade:'Balaustrada',airship:'Dirigível',
 'pond-lily':'Lago de ninfeias','pond-well':'Poço de pedra','pond-crystal':'Lagoa de cristal','pond-reeds':'Lago de juncos',
 pier:'Píer',['pier-l']:'Píer em L',bridge:'Ponte','deck-umbrella':'Deque com guarda-sol',rowboat:'Barquinho',dock:'Atracadouro',
 stair:'Escada',wall:'Muro',cascade:'Cascata',arch:'Arco',['fishing-house']:'Casa de Pesca',stall:'Barraca','pagoda':'Pagode','bait-kiosk':'Quiosque de iscas',
 willow:'Salgueiro',cherry:'Cerejeira',reeds:'Juncos',hydrangea:'Hortênsias','pond-rocks':'Pedras','fish-basket':'Cesto de peixes','paper-lantern':'Lanterna de papel',
 'bait-bucket':'Balde de iscas','flower-bed':'Canteiro','lake-sign':'Placa do lago','grass-strip':'Faixa de grama','grass-patch':'Gramado claro','grass-patch-2':'Gramado redondo',
 'grass-patch-3':'Gramado pequeno','grass-corner':'Canto de grama','hedge-low':'Cerca viva','stone-trail':'Trilha de pedras','tuft-1':'Tufo 1','tuft-2':'Tufo 2','tuft-3':'Tufo 3',
 'lily-pad-1':'Folha de ninfeia 1','lily-pad-2':'Folha de ninfeia 2','lily-pad-3':'Folha de ninfeia 3','lily-pad-4':'Folha de ninfeia 4','lotus-1':'Lótus 1','lotus-2':'Lótus 2','lily-cluster':'Grupo de folhas',
};
const LAYER_NAMES:Record<FishingLayer,string>={ground:'Chão (deitada)',water:'Na água (boia)',stand:'Em pé'};
/** Pieces the editor does not offer: the ponds (added as lakes), and pieces the terraces place by themselves. */
const HIDDEN=new Set(['pond-lily','pond-well','pond-crystal','pond-reeds','pond-clear','stair','stair-grand','stair-narrow','wall','airship','fishing-house','balustrade']);
const defaultLayer=(prop:string):FishingLayer=>/^(grass|tuft|stone-trail|pond-rocks|pier|bridge|dock|cascade)/.test(prop)?'ground':/^(rowboat|lily|lotus)/.test(prop)?'water':'stand';
const nameOf=(prop:string)=>PROP_NAMES[prop]??prop;

/** Problems to fix before publishing (the server refuses the first two kinds). */
export function fishingWarnings(l:FishingLayout){
 const out:{text:string;select:Selection}[]=[];
 if(fishingBlocked(FISHING_SPAWN.x,FISHING_SPAWN.y))out.push({text:'Entrada dos jogadores num lugar bloqueado',select:{type:'spawn'}});
 for(const lake of FISHING_LAKES){const n=FISHING_SPOTS.filter(s=>s.lake===lake.id).length;if(n<3)out.push({text:`${lake.name}: ${n?`só ${n} lugar${n>1?'es':''}`:'nenhum lugar'} livre na margem para pescar`,select:{type:'lake',id:lake.id}});}
 for(const i of l.items){if(i.prop==='lake-sign'&&!l.lakes.some(k=>k.id===i.lake))out.push({text:`Placa sem lago (${i.id})`,select:{type:'item',id:i.id}});
  if(i.x<-100||i.x>W+100||i.y<0||i.y>H+100)out.push({text:`${nameOf(i.prop)} fora do mapa`,select:{type:'item',id:i.id}});}
 return out;
}

export function FishingEditor({onBack}:{onBack:()=>void}){
 const [layout,setLayout]=useState<FishingLayout|null>(null),[name,setName]=useState('Pescaria'),[summary,setSummary]=useState<AdminMapSummary|null>(null),[revisions,setRevisions]=useState<AdminRevision[]>([]);
 const [selection,setSelection]=useState<Selection>(null),[linked,setLinked]=useState(true),[showRules,setShowRules]=useState(false),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[showHistory,setShowHistory]=useState(false),[query,setQuery]=useState('');
 const history=useRef<{past:FishingLayout[];future:FishingLayout[]}>({past:[],future:[]});
 const load=useCallback(async()=>{const r=await api.map(FISHING_MAP_ID);setSummary(r.map);setRevisions(r.revisions);return r;},[]);
 useEffect(()=>{load().then(r=>{setLayout(clone((r.draft?.fishing as FishingLayout|undefined)??defaultFishingLayout()));if(r.draft?.name)setName(r.draft.name);}).catch(e=>setError(e.message));},[load]);
 // The game's own map follows the draft, so the world, the collision and the spots are exactly what will be published.
 useEffect(()=>{if(layout)applyFishingLayout(layout);},[layout]);
 const world=useMemo(()=>{const w=new FishingWorld();w.load();return w;},[]);

 const change=useCallback((update:(l:FishingLayout)=>void,record=true)=>{setLayout(current=>{if(!current)return current;const next=clone(current);update(next);if(record){history.current.past.push(current);history.current.future=[];}return next;});setDirty(true);},[]);
 const undo=()=>{const h=history.current;setLayout(c=>{const p=h.past.pop();if(!p||!c)return c;h.future.push(c);return p;});setDirty(true);};
 const redo=()=>{const h=history.current;setLayout(c=>{const n=h.future.pop();if(!n||!c)return c;h.past.push(c);return n;});setDirty(true);};

 const canvasRef=useRef<HTMLCanvasElement>(null),wrapRef=useRef<HTMLDivElement>(null),view=useRef({scale:.25,x:0,y:0}),drag=useRef<Drag|null>(null);
 const fit=useCallback(()=>{const w=wrapRef.current;if(!w)return;const scale=Math.min((w.clientWidth-40)/W,(w.clientHeight-40)/(H-500));view.current={scale,x:(w.clientWidth-W*scale)/2,y:(w.clientHeight-(H-500)*scale)/2-500*scale};},[]);
 useEffect(()=>{fit();},[fit,!!layout]);

 const state=useRef({layout,selection,showRules});state.current={layout,selection,showRules};
 /** The selected piece's frame: its four corners, the scale handle (bottom right) and the turn handle (above the top). */
 const frame=(item:FishingItem)=>{const px=1/view.current.scale,{h}=itemSize(item),corners=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>itemPoint(item,u,v)),top=itemPoint(item,.5,0),mid=itemPoint(item,.5,.5),up={x:(top.x-mid.x)/(h/2),y:(top.y-mid.y)/(h/2)};
  return {corners,scale:corners[2],rotate:{x:top.x+up.x*28*px,y:top.y+up.y*28*px},top};};
 useEffect(()=>{let frameId=0;const draw=(t:number)=>{frameId=requestAnimationFrame(draw);
  const canvas=canvasRef.current,wrap=wrapRef.current,l=state.current.layout,sel=state.current.selection;if(!canvas||!wrap||!l)return;
  const dpr=devicePixelRatio||1,cw=wrap.clientWidth,ch=wrap.clientHeight;if(canvas.width!==cw*dpr||canvas.height!==ch*dpr){canvas.width=cw*dpr;canvas.height=ch*dpr;}
  const c=canvas.getContext('2d')!,v=view.current,px=1/v.scale;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,cw,ch);c.save();c.translate(v.x,v.y);c.scale(v.scale,v.scale);
  c.save();c.beginPath();c.rect(0,0,W,H);c.clip();world.drawWhole(c,t);c.restore();
  // Walking rules: solid footprints (orange), walkways (blue) and the spots players fish from (dots).
  if(state.current.showRules){
   for(const o of FISHING_OBSTACLES){c.beginPath();c.ellipse(o.x,o.y,o.rx,o.ry,0,0,Math.PI*2);c.fillStyle='rgba(255,120,60,.3)';c.fill();c.lineWidth=1.5*px;c.strokeStyle='rgba(255,150,80,.95)';c.stroke();}
   for(const i of l.items)if(isWalkway(i)){const d=deckOf(i),pts=d.shape==='rect'?[[d.u0,d.v0],[d.u1,d.v0],[d.u1,d.v1],[d.u0,d.v1]].map(([u,v])=>itemPoint(i,u,v)):Array.from({length:24},(_,k)=>{const a=k/24*Math.PI*2;return itemPoint(i,(d.u0+d.u1)/2+Math.cos(a)*(d.u1-d.u0)/2,(d.v0+d.v1)/2+Math.sin(a)*(d.v1-d.v0)/2);});
    c.beginPath();pts.forEach((p,k)=>k?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle='rgba(90,170,255,.28)';c.fill();c.lineWidth=1.5*px;c.strokeStyle='#7cc4ff';c.stroke();}
   for(const s of FISHING_SPOTS){c.fillStyle='#ffe680';c.beginPath();c.arc(s.x,s.y,5*px,0,Math.PI*2);c.fill();c.strokeStyle='rgba(255,230,128,.6)';c.lineWidth=1*px;c.beginPath();c.moveTo(s.x,s.y);c.lineTo(s.bobX,s.bobY);c.stroke();c.beginPath();c.arc(s.bobX,s.bobY,3*px,0,Math.PI*2);c.stroke();}
  }
  // Ponds: their water outlined, the selected one with its width handle.
  for(const def of l.lakes){const lake=lakeOf(def),p=pondPlace(lake),on=sel?.type==='lake'&&sel.id===def.id;
   c.setLineDash(on?[]:[10*px,8*px]);c.lineWidth=(on?3:1.5)*px;c.strokeStyle=on?'#ffd166':'rgba(140,210,255,.7)';c.beginPath();c.ellipse(lake.x,lake.y,lake.rx,lake.ry,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
   if(on){c.strokeRect(p.x,p.y,p.w,p.h);c.fillStyle='#ffd166';c.fillRect(p.x+p.w-8*px,p.y+p.h/2-8*px,16*px,16*px);}}
  // Stairs.
  if(sel?.type==='stair'){const s=l.stairs.find(x=>x.id===sel.id);if(s){const p=stairPlace(s);c.lineWidth=3*px;c.strokeStyle='#ffd166';c.strokeRect(p.x,p.y,p.w,p.h);}}
  // The selected piece: its frame, the scale square and the turn circle.
  if(sel?.type==='item'){const item=l.items.find(i=>i.id===sel.id);if(item){const f=frame(item);
   c.lineWidth=2.5*px;c.strokeStyle='#ffd166';c.beginPath();f.corners.forEach((p,k)=>k?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.stroke();
   c.beginPath();c.moveTo(f.top.x,f.top.y);c.lineTo(f.rotate.x,f.rotate.y);c.stroke();
   c.fillStyle='#ffd166';c.fillRect(f.scale.x-7*px,f.scale.y-7*px,14*px,14*px);c.beginPath();c.arc(f.rotate.x,f.rotate.y,8*px,0,Math.PI*2);c.fill();
   c.fillStyle='#1b1b1b';c.beginPath();c.arc(item.x,item.y,4*px,0,Math.PI*2);c.fill();}}
  // Casa de Pesca and airship: a frame when selected.
  for(const k of ['casa','airship'] as const)if(sel?.type===k){const b=stationBox(k,l);c.lineWidth=2.5*px;c.strokeStyle='#ffd166';c.strokeRect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0);}
  // Spawn.
  const s=l.spawn,on=sel?.type==='spawn';c.save();c.translate(s.x,s.y);const k=1/Math.max(.55,v.scale);c.scale(k,k);c.fillStyle=on?'#ffd166':'#5fe08a';c.strokeStyle='#1b1b1b';c.lineWidth=3;c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-16,-18,-16,-40,0,-40);c.bezierCurveTo(16,-40,16,-18,0,0);c.fill();c.stroke();c.fillStyle='#1b1b1b';c.beginPath();c.arc(0,-27,5,0,Math.PI*2);c.fill();c.restore();
  c.restore();
 };frameId=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frameId);},[world]);

 const stationBox=(k:'casa'|'airship',l:FishingLayout)=>{const size=FISHING_PROPS[k==='casa'?'fishing-house':'airship'],x=k==='casa'?l.casa.x:l.airship.x,y=k==='casa'?l.casa.y:FISHING_AIRSHIP.y+60;return {x0:x-size.w/2,x1:x+size.w/2,y0:y-size.h,y1:y};};
 const toWorld=(e:{clientX:number;clientY:number})=>{const r=canvasRef.current!.getBoundingClientRect(),v=view.current;return {x:(e.clientX-r.left-v.x)/v.scale,y:(e.clientY-r.top-v.y)/v.scale};};
 const onPiece=(i:FishingItem,x:number,y:number)=>{const {u,v}=itemLocal(i,x,y);return u>=0&&u<=1&&v>=0&&v<=1;};
 const onDown=(e:React.PointerEvent)=>{
  if(!layout)return;(e.target as HTMLElement).setPointerCapture(e.pointerId);const {x,y}=toWorld(e),px=1/view.current.scale,near=(p:{x:number;y:number},r=12)=>Math.abs(x-p.x)<r*px&&Math.abs(y-p.y)<r*px;
  if(e.button!==0||e.altKey){drag.current={what:'pan',startX:e.clientX,startY:e.clientY,view:{...view.current}};return;}
  const start=(what:Selection,handle?:Handle)=>{setSelection(what);drag.current={what,handle,startX:x,startY:y,origin:clone(layout),moved:false};};
  // Handles of what is selected first.
  if(selection?.type==='item'){const item=layout.items.find(i=>i.id===selection.id);if(item){const f=frame(item);if(near(f.scale))return start(selection,'scale');if(near(f.rotate))return start(selection,'rotate');}}
  if(selection?.type==='lake'){const def=layout.lakes.find(l=>l.id===selection.id);if(def){const p=pondPlace(lakeOf(def));if(near({x:p.x+p.w,y:p.y+p.h/2}))return start(selection,'width');}}
  const k=1/Math.max(.55,view.current.scale);if(Math.abs(x-layout.spawn.x)<18*k&&y<layout.spawn.y+6*k&&y>layout.spawn.y-44*k)return start({type:'spawn'});
  // Standing pieces in front first (by their base), then the stations, floating pieces, ponds, stairs and flat pieces on top.
  const stand=layout.items.filter(i=>i.layer==='stand'&&onPiece(i,x,y)).sort((a,b)=>b.y-a.y)[0];if(stand)return start({type:'item',id:stand.id});
  for(const s of ['casa','airship'] as const){const b=stationBox(s,layout);if(x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1)return start({type:s});}
  const float=[...layout.items].reverse().find(i=>i.layer==='water'&&onPiece(i,x,y));if(float)return start({type:'item',id:float.id});
  const flatOver=[...layout.items].reverse().find(i=>i.layer==='ground'&&onPiece(i,x,y)&&FISHING_LAKES.some(l=>{const p=pondPlace(l);return i.x>p.x&&i.x<p.x+p.w&&i.y>p.y&&i.y<p.y+p.h+40;}));if(flatOver)return start({type:'item',id:flatOver.id});
  const lake=layout.lakes.find(l=>{const p=pondPlace(lakeOf(l));return x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h;});if(lake)return start({type:'lake',id:lake.id});
  const stair=layout.stairs.find(s=>{const p=stairPlace(s);return x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h;});if(stair)return start({type:'stair',id:stair.id});
  const flat=[...layout.items].reverse().find(i=>i.layer==='ground'&&onPiece(i,x,y));if(flat)return start({type:'item',id:flat.id});
  setSelection(null);drag.current={what:'pan',startX:e.clientX,startY:e.clientY,view:{...view.current}};
 };
 const onMove=(e:React.PointerEvent)=>{
  const d=drag.current;if(!d)return;
  if(d.what==='pan'){view.current={...d.view,x:d.view.x+e.clientX-d.startX,y:d.view.y+e.clientY-d.startY};return;}
  const {x,y}=toWorld(e),dx=Math.round(x-d.startX),dy=Math.round(y-d.startY),what=d.what,o=d.origin;if(!what)return;
  change(l=>{
   if(what.type==='spawn')l.spawn={x:o.spawn.x+dx,y:o.spawn.y+dy};
   else if(what.type==='casa')l.casa={x:o.casa.x+dx,y:o.casa.y+dy};
   else if(what.type==='airship')l.airship={x:Math.max(200,Math.min(W-200,o.airship.x+dx))};
   else if(what.type==='stair'){const i=l.stairs.findIndex(s=>s.id===what.id);if(i<0)return;const s=o.stairs[i],p=stairPlace(s);
    // Dragging up or down moves it to the other wall.
    const upper=p.y+p.h/2+dy<(FISHING_TERRACES[0].y1+FISHING_TERRACES[1].y1)/2?'mirante':'jardim';l.stairs[i]={...s,x:s.x+dx,upper};}
   else if(what.type==='lake'){const i=l.lakes.findIndex(k=>k.id===what.id),k=o.lakes[i];if(i<0)return;
    if(d.handle==='width'){const p=pondPlace(lakeOf(k));l.lakes[i].width=Math.max(200,Math.min(2400,Math.round(p.w+dx)));return;}
    l.lakes[i].x=k.x+dx;l.lakes[i].y=k.y+dy;
    // The pond's own pieces (island, pier, pads, sign, lanterns) go along.
    if(linked){const p=pondPlace(lakeOf(k)),m=60;l.items=o.items.map(it=>it.x>p.x-m&&it.x<p.x+p.w+m&&it.y>p.y-m&&it.y<p.y+p.h+m+40?{...it,x:it.x+dx,y:it.y+dy}:it);}}
   else if(what.type==='item'){const i=l.items.findIndex(it=>it.id===what.id),it=o.items[i];if(i<0)return;
    if(d.handle==='scale'){const {h}=itemSize(it),c=itemPoint(it,.5,.5),r0=Math.hypot(d.startX-c.x,d.startY-c.y),r1=Math.hypot(x-c.x,y-c.y),k=Math.max(.1,Math.min(5,Math.round((it.scale??1)*r1/Math.max(1,r0)*100)/100)),h1=itemSize({...it,scale:k}).h;
     // Grows around its middle: the base moves so the middle stays put.
     l.items[i]={...it,scale:k,y:Math.round(it.y-h/2+h1/2)};}
    else if(d.handle==='rotate'){const c=itemPoint(it,.5,.5);let a=Math.atan2(y-c.y,x-c.x)*180/Math.PI+90;if(!e.shiftKey)a=Math.round(a/5)*5;a=((a+180)%360+360)%360-180;l.items[i]={...it,rotation:Math.round(a)};}
    else l.items[i]={...it,x:it.x+dx,y:it.y+dy};}
  },!d.moved);d.moved=true;
 };
 // Native, non-passive wheel: zooms at the cursor without the page (or a trackpad pinch) zooming the browser.
 useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;
  const wheel=(e:WheelEvent)=>{e.preventDefault();const r=canvas.getBoundingClientRect(),v=view.current,unit=e.deltaMode===1?16:e.deltaMode===2?400:1,dy=e.deltaY*unit;
   if(e.shiftKey){view.current={...v,x:v.x-(dy||e.deltaX*unit)};return;}
   const scale=Math.max(.06,Math.min(2.5,v.scale*Math.exp(-dy*(e.ctrlKey?.01:.0015)))),mx=e.clientX-r.left,my=e.clientY-r.top;view.current={scale,x:mx-(mx-v.x)*scale/v.scale,y:my-(my-v.y)*scale/v.scale};};
  canvas.addEventListener('wheel',wheel,{passive:false});return()=>canvas.removeEventListener('wheel',wheel);},[!!layout]);

 /** Where the middle of the view is in the world (new pieces go there). */
 const viewCentre=()=>{const w=wrapRef.current,v=view.current;return w?{x:Math.round((w.clientWidth/2-v.x)/v.scale),y:Math.round((w.clientHeight/2-v.y)/v.scale)}:{x:W/2,y:1600};};
 const freeId=(base:string,taken:{id:string}[])=>{let n=1;while(taken.some(t=>t.id===`${base}-${n}`))n++;return `${base}-${n}`;};
 const addItem=(prop:string)=>{const c=viewCentre(),{h}=itemSize({prop});change(l=>{const id=freeId(prop,l.items);l.items.push({id,prop,x:c.x,y:Math.round(c.y+h/2),layer:defaultLayer(prop),...(prop==='lake-sign'&&l.lakes[0]?{lake:l.lakes[0].id}:{})});setSelection({type:'item',id});});};
 const addLake=(art:string)=>{const c=viewCentre();change(l=>{const id=freeId('lago',l.lakes);l.lakes.push({id,name:'Lago Novo',fish:'ninfeias',art,x:c.x,y:c.y,width:800});setSelection({type:'lake',id});});};
 const addStair=()=>{const c=viewCentre();change(l=>{const id=freeId('escada',l.stairs);l.stairs.push({id,upper:c.y<(FISHING_TERRACES[0].y1+FISHING_TERRACES[1].y0)/2?'mirante':'jardim',x:c.x-160});setSelection({type:'stair',id});});};
 const remove=()=>{const s=selection;if(!s||!('id' in s))return;change(l=>{if(s.type==='item')l.items=l.items.filter(i=>i.id!==s.id);else if(s.type==='lake'&&l.lakes.length>1)l.lakes=l.lakes.filter(k=>k.id!==s.id);else if(s.type==='stair')l.stairs=l.stairs.filter(k=>k.id!==s.id);});setSelection(null);};
 const duplicate=()=>{const s=selection;if(s?.type!=='item')return;change(l=>{const it=l.items.find(i=>i.id===s.id);if(!it)return;const id=freeId(it.prop,l.items);l.items.splice(l.items.indexOf(it)+1,0,{...clone(it),id,x:it.x+40,y:it.y+20});setSelection({type:'item',id});});};
 const order=(dir:1|-1)=>{const s=selection;if(s?.type!=='item')return;change(l=>{const i=l.items.findIndex(x=>x.id===s.id),j=i+dir;if(i<0||j<0||j>=l.items.length)return;[l.items[i],l.items[j]]=[l.items[j],l.items[i]];});};

 const warnings=useMemo(()=>layout?fishingWarnings(layout):[],[layout]);
 const save=async():Promise<number|null>=>{if(!layout)return null;setBusy('Salvando…');setError('');
  try{const r=await api.save(FISHING_MAP_ID,{kind:'fishing',name,subtitle:'',enabled:true,fishing:layout,warnings:warnings.map(w=>w.text)});setDirty(false);await load();
   if(r.blockers?.length){setError(`Salvo, mas não dá para publicar: ${r.blockers.join('; ')}`);}else setNotice('Rascunho salvo.');return r.revision;}
  catch(e){setError((e as Error).message);return null;}finally{setBusy('');}};
 const publish=async(revision?:number)=>{if(warnings.length&&!revision&&!window.confirm(`Há ${warnings.length} aviso(s). Publicar mesmo assim?`))return;
  const target=revision??(dirty||!summary?.draftRevision?await save():summary.draftRevision);if(!target)return;
  setBusy('Publicando…');try{await api.publish(FISHING_MAP_ID,target);await load();setNotice('Publicado: quem está na Pescaria já vê o jardim novo.');}catch(e){setError((e as Error).message);}finally{setBusy('');}};
 const restore=async()=>{if(!window.confirm('Voltar a Pescaria do jogo para a versão original?'))return;try{await api.unpublish(FISHING_MAP_ID);await load();setNotice('A Pescaria voltou ao original.');}catch(e){setError((e as Error).message);}};
 const openOriginal=()=>{change(l=>Object.assign(l,defaultFishingLayout()));setNotice('Original aberto no editor. Salve para usá-lo.');};
 const openRevision=async(id:number)=>{const r=await api.revision(FISHING_MAP_ID,id);change(l=>Object.assign(l,clone(r.revision.data.fishing as FishingLayout)));setShowHistory(false);setNotice(`Versão ${id} aberta. Salve para usá-la.`);};
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(t);},[notice]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(['INPUT','SELECT','TEXTAREA'].includes((e.target as HTMLElement).tagName))return;const mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(mod&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();}else if(mod&&k==='y'){e.preventDefault();redo();}else if(mod&&k==='s'){e.preventDefault();void save();}else if(mod&&k==='d'){e.preventDefault();duplicate();}
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}else if(e.key==='Escape')setSelection(null);
  else if(e.key.startsWith('Arrow')&&selection?.type==='item'){e.preventDefault();const step=e.shiftKey?10:1,dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;change(l=>{const it=l.items.find(i=>i.id===selection.id);if(it){it.x+=dx;it.y+=dy;}});}};
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
 const thumbs=useMemo(()=>(Object.keys(FISHING_PROPS) as FishingPropId[]).filter(p=>!HIDDEN.has(p)),[]);

 if(!layout)return <div className="adm-editor loading">{error?<p className="adm-error">{error}</p>:<Loader2 className="adm-spin" size={34}/>}</div>;
 const s=summary?status(summary):null;
 const item=selection?.type==='item'?layout.items.find(i=>i.id===selection.id):undefined;
 const lake=selection?.type==='lake'?layout.lakes.find(l=>l.id===selection.id):undefined;
 const stair=selection?.type==='stair'?layout.stairs.find(l=>l.id===selection.id):undefined;
 const num=(label:string,value:number,set:(v:number)=>void,step=1)=><label className="adm-field"><span>{label}</span><input type="number" step={step} value={Math.round(value/step)*step} onChange={e=>{const v=Number(e.target.value);if(Number.isFinite(v))set(v);}}/></label>;
 const toggle=(label:string,hint:string,on:boolean,set:(v:boolean)=>void)=><label className="adm-toggle-row"><span><b>{label}</b><small>{hint}</small></span><button className={`adm-toggle ${on?'on':''}`} onClick={()=>set(!on)}><i/></button></label>;
 const setItem=(update:(i:FishingItem)=>void,record=true)=>change(l=>{const i=l.items.find(x=>x.id===item?.id);if(i)update(i);},record);
 const setLake=(update:(k:FishingLakeDef)=>void,record=true)=>change(l=>{const k=l.lakes.find(x=>x.id===lake?.id);if(k)update(k);},record);
 const shown=thumbs.filter(p=>!query||nameOf(p).toLowerCase().includes(query.toLowerCase()));
 return <div className="adm-editor">
  <header className="adm-editor-bar">
   <button className="adm-icon" onClick={()=>{if(!dirty||window.confirm('Sair sem salvar?'))onBack();}}><ArrowLeft size={18}/></button>
   <div className="adm-editor-title"><input value={name} maxLength={40} onChange={e=>{setName(e.target.value);setDirty(true);}}/><small><span className="adm-kind lobby">Pescaria</span>{s&&<span className={`adm-status ${dirty?'dirty':s.tone}`}>{dirty?'Alterações não salvas':s.label}</span>}<code>{FISHING_MAP_ID}</code></small></div>
   <div className="adm-toolgroup"><button className="adm-icon" onClick={undo} disabled={!history.current.past.length} title="Desfazer (Ctrl+Z)"><Undo2 size={17}/></button><button className="adm-icon" onClick={redo} disabled={!history.current.future.length} title="Refazer (Ctrl+Y)"><Redo2 size={17}/></button></div>
   <div className="adm-toolgroup"><button className="adm-icon" onClick={fit} title="Ver o mapa inteiro"><Maximize size={17}/></button><button className={`adm-icon ${showRules?'on':''}`} onClick={()=>setShowRules(v=>!v)} title="Mostrar onde dá para andar e os lugares de pesca"><Footprints size={17}/></button></div>
   <span className="adm-spacer"/>
   <button className="adm-btn ghost" onClick={()=>setShowHistory(v=>!v)}><History size={16}/>Histórico</button>
   <button className="adm-btn" onClick={()=>void save()} disabled={!!busy}><Save size={16}/>Salvar</button>
   <button className="adm-btn gold" onClick={()=>publish()} disabled={!!busy}><Rocket size={16}/>Publicar</button>
  </header>
  <aside className="adm-editor-left">
   <h4 className="adm-side-title">Lagos</h4>
   <ol className="adm-layers">{layout.lakes.map(k=><li key={k.id} className={selection?.type==='lake'&&selection.id===k.id?'on':''} onClick={()=>setSelection({type:'lake',id:k.id})}><Waves size={16}/><span><b>{k.name}</b><small>{FISH_TABLES[k.fish]} · {FISHING_SPOTS.filter(s=>s.lake===k.id).length} lugares</small></span></li>)}</ol>
   <div className="adm-pieces">{Object.entries(POND_ARTS).map(([art,a])=><button key={art} onClick={()=>addLake(art)} title={`Adicionar ${a.name}`}><img src={`/assets/fishing/props/${art}.webp`} alt=""/><small><Plus size={11}/> {a.name}</small></button>)}</div>
   <h4 className="adm-side-title">Lugares</h4>
   <ol className="adm-layers">
    <li className={selection?.type==='casa'?'on':''} onClick={()=>setSelection({type:'casa'})}><MapPin size={16}/><span><b>Casa de Pesca</b><small>loja e coleção</small></span></li>
    <li className={selection?.type==='airship'?'on':''} onClick={()=>setSelection({type:'airship'})}><MapPin size={16}/><span><b>Dirigível</b><small>volta para a praça</small></span></li>
    <li className={selection?.type==='spawn'?'on':''} onClick={()=>setSelection({type:'spawn'})}><MapPin size={16}/><span><b>Entrada dos jogadores</b><small>onde todos aparecem</small></span></li>
    {layout.stairs.map(st=><li key={st.id} className={selection?.type==='stair'&&selection.id===st.id?'on':''} onClick={()=>setSelection({type:'stair',id:st.id})}><Footprints size={16}/><span><b>Escada</b><small>{st.upper==='mirante'?'Mirante → Jardim':'Jardim → Cais'} · x {Math.round(st.x)}</small></span></li>)}
   </ol>
   <button className="adm-btn ghost wide" onClick={addStair}><Plus size={15}/>Adicionar escada</button>
   <h4 className="adm-side-title">Peças</h4>
   <label className="adm-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar peça (ex.: ponte, lótus)" aria-label="Buscar peça"/>{query&&<button onClick={()=>setQuery('')} title="Limpar"><X size={14}/></button>}</label>
   <p className="adm-hint">Clique numa peça para pôr no meio da tela.</p>
   <div className="adm-pieces">{shown.map(p=><button key={p} onClick={()=>addItem(p)} title={nameOf(p)}><img src={`/assets/fishing/props/${p}.webp`} alt=""/><small>{nameOf(p)}</small></button>)}</div>
  </aside>
  <div className="adm-stage" ref={wrapRef}>
   <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={()=>{drag.current=null;}} onContextMenu={e=>e.preventDefault()}/>
   <div className="adm-stage-help">Arraste lagos e peças · quadradinho = tamanho · bolinha = girar (Shift solta de 5 em 5°) · Del apaga · Ctrl+D duplica · roda = zoom</div>
   {(notice||error||busy)&&<div className={`adm-toast ${error?'bad':''}`}>{busy||error||notice}{!busy&&<button onClick={()=>{setError('');setNotice('');}}><X size={14}/></button>}</div>}
  </div>
  <aside className="adm-editor-right">
   <section className="adm-inspector">
    {item?<><header><h3>{nameOf(item.prop)}</h3><code>{item.id}</code></header>
      <div className="adm-pair">{num('X (base)',item.x,v=>setItem(i=>{i.x=v;}))}{num('Y (base)',item.y,v=>setItem(i=>{i.y=v;}))}</div>
      <label className="adm-field"><span>Tamanho</span><span className="adm-range"><input type="range" min={10} max={300} value={Math.round((item.scale??1)*100)} onChange={e=>setItem(i=>{i.scale=Number(e.target.value)/100;},false)}/><input type="number" value={Math.round((item.scale??1)*100)} onChange={e=>{const v=Number(e.target.value);if(v>=10&&v<=500)setItem(i=>{i.scale=v/100;});}}/></span></label>
      <label className="adm-field"><span>Giro (graus)</span><span className="adm-range"><input type="range" min={-180} max={180} value={item.rotation??0} onChange={e=>setItem(i=>{i.rotation=Number(e.target.value)||undefined;},false)}/><input type="number" value={item.rotation??0} onChange={e=>{const v=Number(e.target.value);if(Number.isFinite(v))setItem(i=>{i.rotation=v||undefined;});}}/></span></label>
      <label className="adm-field"><span>Camada</span><select value={item.layer} onChange={e=>setItem(i=>{i.layer=e.target.value as FishingLayer;})}>{(Object.keys(LAYER_NAMES) as FishingLayer[]).map(k=><option key={k} value={k}>{LAYER_NAMES[k]}</option>)}</select></label>
      {item.prop==='lake-sign'&&<label className="adm-field"><span>Nome do lago na placa</span><select value={item.lake??''} onChange={e=>setItem(i=>{i.lake=e.target.value||undefined;})}><option value="">Nenhum</option>{layout.lakes.map(k=><option key={k.id} value={k.id}>{k.name}</option>)}</select></label>}
      {toggle('Bloqueia passagem','Jogadores contornam a base desta peça',isSolid(item),v=>setItem(i=>{i.solid=v;if(v)i.walk=false;}))}
      {toggle('Dá para andar em cima','Píer, ponte ou ilha sobre a água',isWalkway(item),v=>setItem(i=>{i.walk=v;if(v)i.solid=false;}))}
      <div className="adm-btn-row">
       <button className="adm-btn ghost" onClick={()=>setItem(i=>{i.flip=!i.flip||undefined;})}><FlipHorizontal size={15}/>Espelhar</button>
       <button className="adm-btn ghost" onClick={duplicate}><Copy size={15}/>Duplicar</button>
      </div>
      <div className="adm-btn-row">
       <button className="adm-btn ghost" onClick={()=>order(-1)} title="Desenhar antes (atrás das peças da mesma camada)"><ArrowDown size={15}/>Para trás</button>
       <button className="adm-btn ghost" onClick={()=>order(1)} title="Desenhar depois (na frente das peças da mesma camada)"><ArrowUp size={15}/>Para frente</button>
      </div>
      <button className="adm-btn ghost wide danger" onClick={remove}><Trash2 size={15}/>Apagar peça</button></>
    :lake?<><header><h3>{lake.name}</h3><code>{lake.id}</code></header>
      <label className="adm-field"><span>Nome</span><input value={lake.name} maxLength={32} onChange={e=>setLake(k=>{k.name=e.target.value;},false)}/></label>
      <label className="adm-field"><span>Peixes</span><select value={lake.fish} onChange={e=>setLake(k=>{k.fish=e.target.value as FishTable;})}>{(Object.keys(FISH_TABLES) as FishTable[]).map(f=><option key={f} value={f}>{FISH_TABLES[f]}</option>)}</select></label>
      <label className="adm-field"><span>Pintura</span><select value={lake.art} onChange={e=>setLake(k=>{k.art=e.target.value;})}>{Object.entries(POND_ARTS).map(([id,a])=><option key={id} value={id}>{a.name}</option>)}</select></label>
      <div className="adm-pair">{num('X (meio)',lake.x,v=>setLake(k=>{k.x=v;}))}{num('Y (meio)',lake.y,v=>setLake(k=>{k.y=v;}))}</div>
      <label className="adm-field"><span>Largura</span><span className="adm-range"><input type="range" min={200} max={2400} value={lake.width} onChange={e=>setLake(k=>{k.width=Number(e.target.value);},false)}/><input type="number" value={lake.width} onChange={e=>{const v=Number(e.target.value);if(v>=200&&v<=2400)setLake(k=>{k.width=v;});}}/></span></label>
      {toggle('Levar as peças junto','Ao arrastar, ilha, píer, folhas e enfeites em volta acompanham',linked,setLinked)}
      <button className="adm-btn ghost wide" onClick={()=>setLake(k=>{k.flip=!k.flip||undefined;})}><FlipHorizontal size={15}/>Espelhar</button>
      <p className="adm-hint">{FISHING_SPOTS.filter(s=>s.lake===lake.id).length} lugares livres na margem e nos píeres. Peças que bloqueiam a margem tiram lugares.</p>
      {layout.lakes.length>1&&<button className="adm-btn ghost wide danger" onClick={remove}><Trash2 size={15}/>Apagar lago</button>}</>
    :stair?<><header><h3>Escada</h3><code>{stair.id}</code></header>
      <label className="adm-field"><span>Sobe para</span><select value={stair.upper} onChange={e=>change(l=>{const s2=l.stairs.find(x=>x.id===stair.id);if(s2)s2.upper=e.target.value as 'mirante'|'jardim';})}><option value="mirante">Mirante (do Jardim)</option><option value="jardim">Jardim (do Cais)</option></select></label>
      <label className="adm-field"><span>Desenho</span><select value={stair.art??'side'} onChange={e=>change(l=>{const s2=l.stairs.find(x=>x.id===stair.id);if(s2)s2.art=e.target.value==='side'?undefined:e.target.value as StairArt;})}><option value="side">De lado, subindo o muro</option>{Object.entries(FRONT_STAIRS).map(([id,a])=><option key={id} value={id}>{a.name} (de frente)</option>)}</select></label>
      {num('X (esquerda)',stair.x,v=>change(l=>{const s2=l.stairs.find(x=>x.id===stair.id);if(s2)s2.x=v;}))}
      <button className="adm-btn ghost wide" onClick={()=>change(l=>{const s2=l.stairs.find(x=>x.id===stair.id);if(s2)s2.flip=!s2.flip||undefined;})}><FlipHorizontal size={15}/>Espelhar (sobe para o outro lado)</button>
      <button className="adm-btn ghost wide danger" onClick={remove}><Trash2 size={15}/>Apagar escada</button></>
    :selection?.type==='casa'?<><header><h3>Casa de Pesca</h3></header><div className="adm-pair">{num('X (base)',layout.casa.x,v=>change(l=>{l.casa.x=v;}))}{num('Y (base)',layout.casa.y,v=>change(l=>{l.casa.y=v;}))}</div><p className="adm-hint">Clicar nela abre as trocas e a coleção. A base bloqueia a passagem.</p></>
    :selection?.type==='airship'?<><header><h3>Dirigível</h3></header>{num('X',layout.airship.x,v=>change(l=>{l.airship.x=v;}))}<p className="adm-hint">Fica sempre atracado na frente do cais; a balaustrada abre na passarela.</p></>
    :selection?.type==='spawn'?<><header><h3>Entrada dos jogadores</h3></header><div className="adm-pair">{num('X',layout.spawn.x,v=>change(l=>{l.spawn.x=v;}))}{num('Y',layout.spawn.y,v=>change(l=>{l.spawn.y=v;}))}</div></>
    :<><header><h3>Pescaria</h3></header><p className="adm-hint">Clique num lago, numa peça, numa escada, na Casa de Pesca ou no dirigível para editar. O ícone de pegadas mostra onde dá para andar (azul), o que bloqueia (laranja) e os lugares de pesca (pontos amarelos).</p>
      <button className="adm-btn ghost wide" onClick={openOriginal}><RotateCcw size={15}/>Abrir o original no editor</button>
      {summary?.publishedRevision&&<div className="adm-danger-zone"><button className="adm-btn ghost wide" onClick={restore}><RotateCcw size={15}/>Voltar ao original no jogo</button></div>}</>}
   </section>
   <section className="adm-warnings"><h4>{warnings.length?<><AlertTriangle size={15}/>{warnings.length} avisos</>:<><Eye size={15}/>Sem avisos</>}</h4>
    {warnings.length?<ul>{warnings.map((w,n)=><li key={n}><button onClick={()=>setSelection(w.select)}>{w.text}</button></li>)}</ul>:<p>Entrada livre e todos os lagos com lugares para pescar.</p>}</section>
  </aside>
  {showHistory&&<div className="adm-drawer"><header><h3><History size={17}/>Histórico</h3><button className="adm-icon" onClick={()=>setShowHistory(false)}><X size={17}/></button></header>
   {revisions.length?<ul>{revisions.map(r=><li key={r.id} className={r.published?'live':''}><div><b>Versão {r.id}{r.published&&<span className="adm-status live">No jogo</span>}</b><small>{new Date(r.createdAt).toLocaleString('pt-BR')} · {r.createdBy}</small></div><span><button className="adm-btn small ghost" onClick={()=>openRevision(r.id)}>Abrir</button>{!r.published&&<button className="adm-btn small" onClick={()=>publish(r.id)}><Rocket size={13}/>Publicar</button>}</span></li>)}</ul>:<p className="adm-empty">Nenhuma versão salva ainda.</p>}
  </div>}
 </div>;
}
