import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AlertTriangle,ArrowLeft,Eye,History,Loader2,Maximize,Redo2,Rocket,RotateCcw,Save,Undo2,X,MapPin,Footprints,Circle} from 'lucide-react';
import {api} from './api';
import {LobbyWorld,LOBBY_STATIONS,LOBBY_STATION_DEFAULTS,LOBBY_W,LOBBY_H,placeStations} from '../game/lobbyWorld';
import {LOBBY_OBSTACLES,LOBBY_SPAWN,LOBBY_WALK,LOBBY_WIDTH} from '../../shared/lobby';
import {LOBBY_MAP_ID} from '../../shared/mapAdmin';
import type {AdminMapSummary,AdminRevision,LobbyLayout} from '../../shared/mapAdmin';
import {status} from './MapList';

/**
 * Praça Celeste: stations (the painted stalls, podiums and arena gate), the floor footprints players walk around,
 * where players appear and the walkable band. Drawn with the game's own LobbyWorld.
 */
const SHIPPED:LobbyLayout=structuredClone({spawn:{...LOBBY_SPAWN},walk:{...LOBBY_WALK},obstacles:[...LOBBY_OBSTACLES],stations:[...LOBBY_STATION_DEFAULTS]});
type Selection={type:'station'|'obstacle';id:string}|{type:'spawn'}|{type:'walk'}|null;
type Drag={what:Selection;handle?:'rx'|'ry'|'minY'|'maxY'|'minX'|'maxX';startX:number;startY:number;origin:LobbyLayout;moved:boolean}|{what:'pan';startX:number;startY:number;view:{scale:number;x:number;y:number}};
const clone=<T,>(v:T):T=>structuredClone(v);
const inside=(o:{x:number;y:number;rx:number;ry:number},x:number,y:number)=>((x-o.x)/o.rx)**2+((y-o.y)/o.ry)**2<1;

export function lobbyWarnings(l:LobbyLayout){
 const out:{text:string;select:Selection}[]=[],w=l.walk;
 if(l.spawn.x<w.minX||l.spawn.x>w.maxX||l.spawn.y<w.minY||l.spawn.y>w.maxY)out.push({text:'Entrada dos jogadores fora da área de caminhada',select:{type:'spawn'}});
 for(const o of l.obstacles)if(inside(o,l.spawn.x,l.spawn.y))out.push({text:`Entrada dos jogadores dentro da pegada de ${o.id}`,select:{type:'spawn'}});
 for(const o of l.obstacles)if(o.y+o.ry<w.minY||o.y-o.ry>w.maxY)out.push({text:`Pegada ${o.id} fora da área de caminhada (não bloqueia nada)`,select:{type:'obstacle',id:o.id}});
 for(const s of l.stations){const o=l.obstacles.find(o=>o.id===s.id);if(o&&Math.hypot(o.x-s.x,o.y-s.y)>80)out.push({text:`Pegada de ${s.id} longe da estação (${Math.round(Math.hypot(o.x-s.x,o.y-s.y))} px)`,select:{type:'station',id:s.id}});}
 return out;
}

export function LobbyEditor({onBack}:{onBack:()=>void}){
 const [layout,setLayout]=useState<LobbyLayout|null>(null),[name,setName]=useState('Praça Celeste'),[summary,setSummary]=useState<AdminMapSummary|null>(null),[revisions,setRevisions]=useState<AdminRevision[]>([]);
 const [selection,setSelection]=useState<Selection>(null),[linked,setLinked]=useState(true),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[showHistory,setShowHistory]=useState(false);
 const history=useRef<{past:LobbyLayout[];future:LobbyLayout[]}>({past:[],future:[]});
 const load=useCallback(async()=>{const r=await api.map(LOBBY_MAP_ID);setSummary(r.map);setRevisions(r.revisions);return r;},[]);
 useEffect(()=>{load().then(r=>{setLayout(clone((r.draft?.lobby as LobbyLayout|undefined)??SHIPPED));if(r.draft?.name)setName(r.draft.name);}).catch(e=>setError(e.message));},[load]);

 // The game's stations follow the edited spots, so LobbyWorld draws exactly what was placed.
 useEffect(()=>{if(layout)placeStations(layout.stations);},[layout]);
 const world=useMemo(()=>new LobbyWorld(),[]);
 const art=useMemo(()=>new Map(LOBBY_STATIONS.map(st=>{const img=new Image();img.src=`/assets/lobby/${st.dir}/${st.layers[0]?.name}.png`;return [st.id,img];})),[]);

 const change=useCallback((update:(l:LobbyLayout)=>void,record=true)=>{setLayout(current=>{if(!current)return current;const next=clone(current);update(next);if(record){history.current.past.push(current);history.current.future=[];}return next;});setDirty(true);},[]);
 const undo=()=>{const h=history.current;setLayout(c=>{const p=h.past.pop();if(!p||!c)return c;h.future.push(c);return p;});setDirty(true);};
 const redo=()=>{const h=history.current;setLayout(c=>{const n=h.future.pop();if(!n||!c)return c;h.past.push(c);return n;});setDirty(true);};

 const canvasRef=useRef<HTMLCanvasElement>(null),wrapRef=useRef<HTMLDivElement>(null),view=useRef({scale:.3,x:0,y:0}),drag=useRef<Drag|null>(null);
 const fit=useCallback(()=>{const w=wrapRef.current;if(!w)return;const scale=Math.min((w.clientWidth-40)/LOBBY_WIDTH,(w.clientHeight-40)/LOBBY_H);view.current={scale,x:(w.clientWidth-LOBBY_WIDTH*scale)/2,y:(w.clientHeight-LOBBY_H*scale)/2};},[]);
 useEffect(()=>{fit();},[fit,!!layout]);
 const stationBox=(id:string)=>{const st=layout?.stations.find(s=>s.id===id),img=art.get(id);if(!st)return null;const ratio=img?.naturalWidth?img.naturalWidth/img.naturalHeight:.85,w=st.height*ratio*.8;return {x0:st.x-w/2,y0:st.y-st.height,x1:st.x+w/2,y1:st.y+10};};

 // Animated: the plaza breathes like in the game.
 const state=useRef({layout,selection});state.current={layout,selection};
 useEffect(()=>{let frame=0;const draw=(t:number)=>{frame=requestAnimationFrame(draw);
  const canvas=canvasRef.current,wrap=wrapRef.current,l=state.current.layout,sel=state.current.selection;if(!canvas||!wrap||!l)return;
  const dpr=devicePixelRatio||1,cw=wrap.clientWidth,ch=wrap.clientHeight;if(canvas.width!==cw*dpr||canvas.height!==ch*dpr){canvas.width=cw*dpr;canvas.height=ch*dpr;}
  const c=canvas.getContext('2d')!,v=view.current;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,cw,ch);c.save();c.translate(v.x,v.y);c.scale(v.scale,v.scale);
  c.save();c.beginPath();c.rect(0,0,LOBBY_WIDTH,LOBBY_H);c.clip();
  for(let x=0;x<LOBBY_WIDTH;x+=LOBBY_W)world.drawBack(c,t,x);
  for(const sprite of world.sprites(t,null).sort((a,b)=>a.y-b.y))sprite.draw(c);
  world.drawFront(c,t,null);c.restore();
  const px=1/v.scale;
  // Walkable band.
  const w=l.walk,walkSel=sel?.type==='walk';c.fillStyle='rgba(120,200,255,.08)';c.fillRect(w.minX,w.minY,w.maxX-w.minX,w.maxY-w.minY);c.setLineDash([12*px,8*px]);c.lineWidth=(walkSel?3:2)*px;c.strokeStyle=walkSel?'#ffd166':'rgba(140,210,255,.8)';c.strokeRect(w.minX,w.minY,w.maxX-w.minX,w.maxY-w.minY);c.setLineDash([]);
  if(walkSel){c.fillStyle='#ffd166';for(const [hx,hy] of [[(w.minX+w.maxX)/2,w.minY],[(w.minX+w.maxX)/2,w.maxY],[w.minX,(w.minY+w.maxY)/2],[w.maxX,(w.minY+w.maxY)/2]])c.fillRect(hx-7*px,hy-7*px,14*px,14*px);}
  // Footprints.
  for(const o of l.obstacles){const on=sel?.type==='obstacle'&&sel.id===o.id;c.beginPath();c.ellipse(o.x,o.y,o.rx,o.ry,0,0,Math.PI*2);c.fillStyle=on?'rgba(255,170,60,.38)':'rgba(255,120,60,.22)';c.fill();c.lineWidth=(on?3:2)*px;c.strokeStyle=on?'#ffd166':'rgba(255,150,80,.9)';c.stroke();
   if(on){c.fillStyle='#ffd166';c.fillRect(o.x+o.rx-7*px,o.y-7*px,14*px,14*px);c.fillRect(o.x-7*px,o.y+o.ry-7*px,14*px,14*px);}}
  // Station boxes.
  for(const st of l.stations){const b=stationBox(st.id),on=sel?.type==='station'&&sel.id===st.id;if(!b||!on)continue;c.lineWidth=2.5*px;c.strokeStyle='#ffd166';c.strokeRect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0);c.fillStyle='#ffd166';c.beginPath();c.arc(st.x,st.y,6*px,0,Math.PI*2);c.fill();}
  // Spawn.
  const s=l.spawn,on=sel?.type==='spawn';c.save();c.translate(s.x,s.y);const k=1/Math.max(.55,v.scale);c.scale(k,k);c.fillStyle=on?'#ffd166':'#5fe08a';c.strokeStyle='#1b1b1b';c.lineWidth=3;c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-16,-18,-16,-40,0,-40);c.bezierCurveTo(16,-40,16,-18,0,0);c.fill();c.stroke();c.fillStyle='#1b1b1b';c.beginPath();c.arc(0,-27,5,0,Math.PI*2);c.fill();c.restore();
  c.restore();
 };frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);},[world]);

 const toWorld=(e:{clientX:number;clientY:number})=>{const r=canvasRef.current!.getBoundingClientRect(),v=view.current;return {x:(e.clientX-r.left-v.x)/v.scale,y:(e.clientY-r.top-v.y)/v.scale};};
 const onDown=(e:React.PointerEvent)=>{
  if(!layout)return;(e.target as HTMLElement).setPointerCapture(e.pointerId);const {x,y}=toWorld(e),px=1/view.current.scale,near=(ax:number,ay:number)=>Math.abs(x-ax)<12*px&&Math.abs(y-ay)<12*px;
  if(e.button!==0||e.altKey){drag.current={what:'pan',startX:e.clientX,startY:e.clientY,view:{...view.current}};return;}
  const start=(what:Selection,handle?:Extract<Drag,{origin:LobbyLayout}>['handle'])=>{setSelection(what);drag.current={what,handle,startX:x,startY:y,origin:clone(layout),moved:false};};
  if(selection?.type==='obstacle'){const o=layout.obstacles.find(o=>o.id===selection.id);if(o&&near(o.x+o.rx,o.y))return start(selection,'rx');if(o&&near(o.x,o.y+o.ry))return start(selection,'ry');}
  if(selection?.type==='walk'){const w=layout.walk,mx=(w.minX+w.maxX)/2,my=(w.minY+w.maxY)/2;if(near(mx,w.minY))return start(selection,'minY');if(near(mx,w.maxY))return start(selection,'maxY');if(near(w.minX,my))return start(selection,'minX');if(near(w.maxX,my))return start(selection,'maxX');}
  const k=1/Math.max(.55,view.current.scale);if(Math.abs(x-layout.spawn.x)<18*k&&y<layout.spawn.y+6*k&&y>layout.spawn.y-44*k)return start({type:'spawn'});
  const obstacle=[...layout.obstacles].reverse().find(o=>inside(o,x,y));if(obstacle)return start({type:'obstacle',id:obstacle.id});
  const station=[...layout.stations].sort((a,b)=>b.y-a.y).find(st=>{const b=stationBox(st.id);return b&&x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1;});if(station)return start({type:'station',id:station.id});
  const w=layout.walk;if(x>=w.minX&&x<=w.maxX&&(Math.abs(y-w.minY)<10*px||Math.abs(y-w.maxY)<10*px))return start({type:'walk'});
  setSelection(null);drag.current={what:'pan',startX:e.clientX,startY:e.clientY,view:{...view.current}};
 };
 const onMove=(e:React.PointerEvent)=>{
  const d=drag.current;if(!d)return;
  if(d.what==='pan'){view.current={...d.view,x:d.view.x+e.clientX-d.startX,y:d.view.y+e.clientY-d.startY};return;}
  const {x,y}=toWorld(e),dx=Math.round(x-d.startX),dy=Math.round(y-d.startY),what=d.what,o=d.origin;
  change(l=>{
   if(what?.type==='spawn'){l.spawn={x:o.spawn.x+dx,y:o.spawn.y+dy};}
   else if(what?.type==='walk'&&d.handle&&d.handle!=='rx'&&d.handle!=='ry'){const w=o.walk,h=d.handle;l.walk={...w,[h]:h.endsWith('X')?w[h]+dx:w[h]+dy};}
   else if(what?.type==='obstacle'){const i=l.obstacles.findIndex(b=>b.id===what.id),b=o.obstacles[i];if(i<0)return;
    if(d.handle==='rx')l.obstacles[i].rx=Math.max(8,b.rx+dx);else if(d.handle==='ry')l.obstacles[i].ry=Math.max(4,b.ry+dy);else{l.obstacles[i].x=b.x+dx;l.obstacles[i].y=b.y+dy;}}
   else if(what?.type==='station'){const i=l.stations.findIndex(s=>s.id===what.id),s=o.stations[i];if(i<0)return;l.stations[i].x=s.x+dx;l.stations[i].y=s.y+dy;
    const j=l.obstacles.findIndex(b=>b.id===what.id);if(linked&&j>=0){l.obstacles[j].x=o.obstacles[j].x+dx;l.obstacles[j].y=o.obstacles[j].y+dy;}}
  },!d.moved);d.moved=true;
 };
 const onWheel=(e:React.WheelEvent)=>{const r=canvasRef.current!.getBoundingClientRect(),v=view.current;if(e.shiftKey){view.current={...v,x:v.x-(e.deltaY||e.deltaX)};return;}
  const scale=Math.max(.08,Math.min(2.5,v.scale*Math.exp(-e.deltaY*.0015))),mx=e.clientX-r.left,my=e.clientY-r.top;view.current={scale,x:mx-(mx-v.x)*scale/v.scale,y:my-(my-v.y)*scale/v.scale};};

 const warnings=useMemo(()=>layout?lobbyWarnings(layout):[],[layout]);
 const save=async():Promise<number|null>=>{if(!layout)return null;setBusy('Salvando…');setError('');
  try{const r=await api.save(LOBBY_MAP_ID,{kind:'lobby',name,subtitle:'',enabled:true,lobby:layout,warnings:warnings.map(w=>w.text)});setDirty(false);await load();setNotice('Rascunho salvo.');return r.revision;}
  catch(e){setError((e as Error).message);return null;}finally{setBusy('');}};
 const publish=async(revision?:number)=>{if(warnings.length&&!revision&&!window.confirm(`Há ${warnings.length} aviso(s). Publicar mesmo assim?`))return;
  const target=revision??(dirty||!summary?.draftRevision?await save():summary.draftRevision);if(!target)return;
  setBusy('Publicando…');try{await api.publish(LOBBY_MAP_ID,target);await load();setNotice('Publicado: jogadores conectados já andam na praça nova.');}catch(e){setError((e as Error).message);}finally{setBusy('');}};
 const restore=async()=>{if(!window.confirm('Voltar a praça do jogo para a versão original?'))return;try{await api.unpublish(LOBBY_MAP_ID);await load();setNotice('A praça voltou ao original.');}catch(e){setError((e as Error).message);}};
 const openRevision=async(id:number)=>{const r=await api.revision(LOBBY_MAP_ID,id);change(l=>Object.assign(l,clone(r.revision.data.lobby as LobbyLayout)));setShowHistory(false);setNotice(`Versão ${id} aberta. Salve para usá-la.`);};
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(t);},[notice]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(['INPUT','SELECT'].includes((e.target as HTMLElement).tagName))return;const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}else if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}else if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();void save();}else if(e.key==='Escape')setSelection(null);};
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});

 if(!layout)return <div className="adm-editor loading">{error?<p className="adm-error">{error}</p>:<Loader2 className="adm-spin" size={34}/>}</div>;
 const s=summary?status(summary):null,station=selection?.type==='station'?layout.stations.find(x=>x.id===selection.id):null,obstacle=selection?.type==='obstacle'?layout.obstacles.find(x=>x.id===selection.id):null;
 const title=(id:string)=>LOBBY_STATIONS.find(st=>st.id===id)?.title??id;
 const num=(label:string,value:number,set:(v:number)=>void)=><label className="adm-field"><span>{label}</span><input type="number" value={Math.round(value)} onChange={e=>{const v=Number(e.target.value);if(Number.isFinite(v))set(v);}}/></label>;
 return <div className="adm-editor">
  <header className="adm-editor-bar">
   <button className="adm-icon" onClick={()=>{if(!dirty||window.confirm('Sair sem salvar?'))onBack();}}><ArrowLeft size={18}/></button>
   <div className="adm-editor-title"><input value={name} maxLength={40} onChange={e=>{setName(e.target.value);setDirty(true);}}/><small><span className="adm-kind lobby">Lobby</span>{s&&<span className={`adm-status ${dirty?'dirty':s.tone}`}>{dirty?'Alterações não salvas':s.label}</span>}<code>{LOBBY_MAP_ID}</code></small></div>
   <div className="adm-toolgroup"><button className="adm-icon" onClick={undo} disabled={!history.current.past.length}><Undo2 size={17}/></button><button className="adm-icon" onClick={redo} disabled={!history.current.future.length}><Redo2 size={17}/></button></div>
   <div className="adm-toolgroup"><button className="adm-icon" onClick={fit} title="Ver a praça inteira"><Maximize size={17}/></button></div>
   <span className="adm-spacer"/>
   <button className="adm-btn ghost" onClick={()=>setShowHistory(v=>!v)}><History size={16}/>Histórico</button>
   <button className="adm-btn" onClick={()=>void save()} disabled={!!busy}><Save size={16}/>Salvar</button>
   <button className="adm-btn gold" onClick={()=>publish()} disabled={!!busy}><Rocket size={16}/>Publicar</button>
  </header>
  <aside className="adm-editor-left">
   <h4 className="adm-side-title">Estações</h4>
   <ol className="adm-layers">{layout.stations.map(st=><li key={st.id} className={selection?.type==='station'&&selection.id===st.id?'on':''} onClick={()=>setSelection({type:'station',id:st.id})}><MapPin size={16}/><span><b>{title(st.id)}</b><small>x {Math.round(st.x)} · y {Math.round(st.y)}</small></span></li>)}</ol>
   <h4 className="adm-side-title">Pegadas no chão</h4>
   <ol className="adm-layers">{layout.obstacles.map(o=><li key={o.id} className={selection?.type==='obstacle'&&selection.id===o.id?'on':''} onClick={()=>setSelection({type:'obstacle',id:o.id})}><Circle size={16}/><span><b>{title(o.id)}</b><small>{Math.round(o.rx*2)}×{Math.round(o.ry*2)} px</small></span></li>)}</ol>
   <ol className="adm-layers">
    <li className={selection?.type==='spawn'?'on':''} onClick={()=>setSelection({type:'spawn'})}><MapPin size={16}/><span><b>Entrada dos jogadores</b><small>onde todos aparecem</small></span></li>
    <li className={selection?.type==='walk'?'on':''} onClick={()=>setSelection({type:'walk'})}><Footprints size={16}/><span><b>Área de caminhada</b><small>faixa onde dá para andar</small></span></li>
   </ol>
  </aside>
  <div className="adm-stage" ref={wrapRef}>
   <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={()=>{drag.current=null;}} onWheel={onWheel} onContextMenu={e=>e.preventDefault()}/>
   <div className="adm-stage-help">Arraste estações, pegadas (laranja) e a entrada · puxe os quadradinhos para mudar o tamanho · roda = zoom</div>
   {(notice||error||busy)&&<div className={`adm-toast ${error?'bad':''}`}>{busy||error||notice}{!busy&&<button onClick={()=>{setError('');setNotice('');}}><X size={14}/></button>}</div>}
  </div>
  <aside className="adm-editor-right">
   <section className="adm-inspector">
    {station?<><header><h3>{title(station.id)}</h3></header>
      <div className="adm-pair">{num('X (pé)',station.x,v=>change(l=>{l.stations.find(x=>x.id===station.id)!.x=v;}))}{num('Y (pé)',station.y,v=>change(l=>{l.stations.find(x=>x.id===station.id)!.y=v;}))}</div>
      <label className="adm-field"><span>Altura</span><span className="adm-range"><input type="range" min={120} max={520} value={station.height} onChange={e=>change(l=>{l.stations.find(x=>x.id===station.id)!.height=Number(e.target.value);},false)}/><input type="number" value={station.height} onChange={e=>change(l=>{l.stations.find(x=>x.id===station.id)!.height=Number(e.target.value)||station.height;})}/></span></label>
      <label className="adm-toggle-row"><span><b>Levar a pegada junto</b><small>Ao arrastar, a pegada no chão acompanha</small></span><button className={`adm-toggle ${linked?'on':''}`} onClick={()=>setLinked(!linked)}><i/></button></label>
      {station.id==='forge'&&<p className="adm-hint">O ponto onde o jogador usa o ferreiro anda junto com a barraca.</p>}</>
    :obstacle?<><header><h3>Pegada · {title(obstacle.id)}</h3></header>
      <div className="adm-pair">{num('X',obstacle.x,v=>change(l=>{l.obstacles.find(x=>x.id===obstacle.id)!.x=v;}))}{num('Y',obstacle.y,v=>change(l=>{l.obstacles.find(x=>x.id===obstacle.id)!.y=v;}))}</div>
      <div className="adm-pair">{num('Largura/2',obstacle.rx,v=>change(l=>{l.obstacles.find(x=>x.id===obstacle.id)!.rx=Math.max(8,v);}))}{num('Fundo/2',obstacle.ry,v=>change(l=>{l.obstacles.find(x=>x.id===obstacle.id)!.ry=Math.max(4,v);}))}</div>
      <p className="adm-hint">Jogadores contornam esta elipse em vez de atravessar a estação.</p></>
    :selection?.type==='spawn'?<><header><h3>Entrada dos jogadores</h3></header><div className="adm-pair">{num('X',layout.spawn.x,v=>change(l=>{l.spawn.x=v;}))}{num('Y',layout.spawn.y,v=>change(l=>{l.spawn.y=v;}))}</div><p className="adm-hint">Cada jogador aparece até 60 px para o lado deste ponto.</p></>
    :selection?.type==='walk'?<><header><h3>Área de caminhada</h3></header><div className="adm-pair">{num('Esquerda',layout.walk.minX,v=>change(l=>{l.walk.minX=v;}))}{num('Direita',layout.walk.maxX,v=>change(l=>{l.walk.maxX=v;}))}</div><div className="adm-pair">{num('Fundo (y mín.)',layout.walk.minY,v=>change(l=>{l.walk.minY=v;}))}{num('Frente (y máx.)',layout.walk.maxY,v=>change(l=>{l.walk.maxY=v;}))}</div></>
    :<><header><h3>Praça Celeste</h3></header><p className="adm-hint">Selecione uma estação, uma pegada, a entrada ou a área de caminhada para editar. A arte da praça vem do Codex (docs/lobby-art-prompts.md).</p>
      {summary?.publishedRevision&&<div className="adm-danger-zone"><button className="adm-btn ghost wide" onClick={restore}><RotateCcw size={15}/>Voltar ao original no jogo</button></div>}</>}
   </section>
   <section className="adm-warnings"><h4>{warnings.length?<><AlertTriangle size={15}/>{warnings.length} avisos</>:<><Eye size={15}/>Sem avisos</>}</h4>
    {warnings.length?<ul>{warnings.map((w,n)=><li key={n}><button onClick={()=>setSelection(w.select)}>{w.text}</button></li>)}</ul>:<p>Entrada livre e pegadas no lugar.</p>}</section>
  </aside>
  {showHistory&&<div className="adm-drawer"><header><h3><History size={17}/>Histórico</h3><button className="adm-icon" onClick={()=>setShowHistory(false)}><X size={17}/></button></header>
   {revisions.length?<ul>{revisions.map(r=><li key={r.id} className={r.published?'live':''}><div><b>Versão {r.id}{r.published&&<span className="adm-status live">No jogo</span>}</b><small>{new Date(r.createdAt).toLocaleString('pt-BR')} · {r.createdBy}</small></div><span><button className="adm-btn small ghost" onClick={()=>openRevision(r.id)}>Abrir</button>{!r.published&&<button className="adm-btn small" onClick={()=>publish(r.id)}><Rocket size={13}/>Publicar</button>}</span></li>)}</ul>:<p className="adm-empty">Nenhuma versão salva ainda.</p>}
  </div>}
 </div>;
}
