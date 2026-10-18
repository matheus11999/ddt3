import {useCallback,useEffect,useState} from 'react';
import {CalendarClock,Flame,Play,Plus,RefreshCw,Save,Square,Trash2,X} from 'lucide-react';
import {api} from './api';
import {BRASILIA_TZ,WORLD_BOSS_MAX_HP} from '../../shared/worldBoss';
import type {WorldBossAdminState,WorldBossSchedule} from '../../shared/worldBoss';

/** Brasília has no daylight saving time: it is always UTC−3, whatever the browser's own zone is. */
const BRT_OFFSET=3*3600_000;
const toInput=(ms:number)=>new Date(ms-BRT_OFFSET).toISOString().slice(0,16);
const fromInput=(value:string)=>{const [date,time]=value.split('T'),[y,mo,d]=date.split('-').map(Number),[h,mi]=time.split(':').map(Number);return Date.UTC(y,mo-1,d,h,mi)+BRT_OFFSET;};
const when=(ms:number|null|undefined)=>ms==null?'—':new Date(ms).toLocaleString('pt-BR',{timeZone:BRASILIA_TZ,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const number=(n:number)=>n.toLocaleString('pt-BR');
const minutes=(ms:number)=>{const m=Math.round(ms/60000);return m>=60?`${Math.floor(m/60)} h${m%60?` ${m%60} min`:''}`:`${m} min`;};
const REPEAT:Record<WorldBossSchedule['repeat'],string>={none:'Uma vez',daily:'Todo dia',weekly:'Toda semana'};
const REASON={time:'Tempo acabou',admin:'Parado no painel',defeated:'Dragão derrotado'};
const requestId=()=>crypto.randomUUID();

/** /admin/eventos: the Chefão Mundial. Start or stop it now (for tests), schedule windows in Brasília time, adjust it and see past events. */
export function Events(){
 const [state,setState]=useState<WorldBossAdminState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[dialog,setDialog]=useState<'start'|'stop'|null>(null);
 const load=useCallback(()=>api.worldBoss().then(s=>{setState(s);setError('');}).catch(e=>setError(e.message)),[]);
 useEffect(()=>{load();const timer=setInterval(load,5000);return()=>clearInterval(timer);},[load]);
 const run=async(action:()=>Promise<WorldBossAdminState>)=>{setBusy(true);setError('');try{setState(await action());return true;}catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}};
 if(!state)return <section className="adm-page"><header className="adm-head"><div><h1>Eventos</h1></div></header>{error?<p className="adm-error">{error}</p>:<div className="adm-skeleton"/>}</section>;
 const {status}=state,active=status.phase==='active',ratio=status.maxHp?status.hp/status.maxHp:0;
 return <section className="adm-page adm-events">
  <header className="adm-head"><div><h1>Eventos</h1><p>Chefão Mundial: um dragão com vida compartilhada por todos os jogadores. Horários em Brasília.</p></div>
   <button className="adm-btn ghost" onClick={load}><RefreshCw size={16}/>Atualizar</button></header>
  {error&&<p className="adm-error" role="alert">{error}</p>}
  <article className="adm-panel adm-event-status">
   <div className="adm-event-title"><span className="adm-card-icon"><Flame size={20}/></span><div><h2>{status.name}</h2>
    <small>{active?`Ativo desde ${when(status.startsAt)} · termina ${when(status.endsAt)}`:status.phase==='results'?`Encerrado ${when(status.finishedAt)} (${REASON[status.endReason??'time']}) · ranking visível até ${when(status.resultsUntil)}`:'Nenhum evento agora'}</small></div>
    <span className={`adm-status ${active?'live':status.phase==='results'?'draft':'base'}`}>{active?'Ativo':status.phase==='results'?'Resultados':'Parado'}</span></div>
   {status.phase!=='idle'&&<div className="adm-event-hp"><div><i style={{width:`${Math.max(0,Math.min(1,ratio))*100}%`}}/></div><span>{number(status.hp)} / {number(status.maxHp)} de vida · {number(status.fighters)} jogadores com dano{status.finalBlow?` · golpe final de ${status.finalBlow}`:''}</span></div>}
   <footer>
    <button className="adm-btn gold" disabled={busy||active} onClick={()=>setDialog('start')}><Play size={16}/>Iniciar agora</button>
    <button className="adm-btn danger" disabled={busy||!active} onClick={()=>setDialog('stop')}><Square size={16}/>Parar agora</button>
   </footer>
  </article>
  <div className="adm-event-grid">
   <Schedules state={state} busy={busy} run={run}/>
   <Settings state={state} busy={busy} run={run}/>
  </div>
  <article className="adm-panel"><h2 className="adm-side-title">Histórico</h2>
   {state.history.length?<div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Início</th><th>Fim</th><th>Origem</th><th>Como acabou</th><th>Vida restante</th><th>Jogadores</th></tr></thead>
    <tbody>{state.history.map(o=><tr key={o.id}><td>{when(o.startsAt)}</td><td>{when(o.finishedAt??o.endsAt)}</td><td>{o.origin==='manual'?`Manual${o.startedBy?` (${o.startedBy})`:''}`:'Agendado'}</td>
     <td>{o.status==='active'?<span className="adm-status live">Ativo</span>:`${REASON[o.endReason??'time']}${o.finalBlow?` · ${o.finalBlow}`:''}${o.stoppedBy?` · ${o.stoppedBy}`:''}`}</td>
     <td>{number(o.hp)} / {number(o.maxHp)}</td><td>{number(o.fighters)}</td></tr>)}</tbody></table></div>:<p className="adm-empty">Nenhum evento ainda.</p>}
  </article>
  {dialog==='start'&&<StartDialog maxHp={state.settings.maxHp} busy={busy} onClose={()=>setDialog(null)} onStart={async(endsAt,maxHp)=>{if(await run(()=>api.worldBossStart({requestId:requestId(),endsAt,...(maxHp?{maxHp}:{})})))setDialog(null);}}/>}
  {dialog==='stop'&&status.occurrenceId&&<div className="adm-overlay"><div className="adm-dialog" role="dialog" aria-label="Parar o evento">
   <header><h2>Parar o Chefão Mundial agora?</h2><button className="adm-icon" aria-label="Fechar" onClick={()=>setDialog(null)}><X size={18}/></button></header>
   <p>Quem está lutando volta para a praça. O dano já causado fica no ranking, que continua visível por 20 minutos. Os agendamentos não mudam.</p>
   <footer><button className="adm-btn ghost" onClick={()=>setDialog(null)}>Cancelar</button><button className="adm-btn danger" disabled={busy} onClick={async()=>{if(await run(()=>api.worldBossStop({requestId:requestId(),occurrenceId:status.occurrenceId!})))setDialog(null);}}><Square size={16}/>Parar agora</button></footer>
  </div></div>}
 </section>;
}

function StartDialog({maxHp,busy,onClose,onStart}:{maxHp:number;busy:boolean;onClose:()=>void;onStart:(endsAt:number,maxHp?:number)=>void}){
 const [duration,setDuration]=useState(30),[hp,setHp]=useState(String(maxHp));
 const hpValue=Number(hp.replace(/\D/g,''));const valid=hpValue>=1&&hpValue<=WORLD_BOSS_MAX_HP;
 return <div className="adm-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><form className="adm-dialog" role="dialog" aria-label="Iniciar o Chefão Mundial" onSubmit={e=>{e.preventDefault();if(valid)onStart(Date.now()+duration*60000,hpValue!==maxHp?hpValue:undefined);}}>
  <header><h2>Iniciar o Chefão Mundial</h2><button type="button" className="adm-icon" aria-label="Fechar" onClick={onClose}><X size={18}/></button></header>
  <label>Duração<div className="adm-seg">{[10,30,60,120].map(m=><button type="button" key={m} className={duration===m?'on':''} onClick={()=>setDuration(m)}>{minutes(m*60000)}</button>)}</div><small>Termina às {when(Date.now()+duration*60000)} (Brasília).</small></label>
  <label>Vida do dragão<input value={hp} inputMode="numeric" onChange={e=>setHp(e.target.value)}/><small>Padrão das configurações: {number(maxHp)}. Vale só para este evento.</small></label>
  <footer><button type="button" className="adm-btn ghost" onClick={onClose}>Cancelar</button><button className="adm-btn gold" disabled={busy||!valid}><Play size={16}/>Iniciar agora</button></footer>
 </form></div>;
}

type Run=(action:()=>Promise<WorldBossAdminState>)=>Promise<boolean>;
function Schedules({state,busy,run}:{state:WorldBossAdminState;busy:boolean;run:Run}){
 const tomorrow=toInput(Math.ceil((Date.now()+3600_000)/3600_000)*3600_000);
 const [start,setStart]=useState(tomorrow),[length,setLength]=useState(60),[repeat,setRepeat]=useState<WorldBossSchedule['repeat']>('daily');
 const add=()=>{const startsAt=fromInput(start);void run(()=>api.worldBossAddSchedule({startsAt,endsAt:startsAt+length*60000,repeat,enabled:true}));};
 return <article className="adm-panel adm-event-schedules"><h2 className="adm-side-title"><CalendarClock size={16}/>Agendamentos</h2>
  {state.schedules.length?<div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Começa</th><th>Duração</th><th>Repete</th><th>Próximo</th><th>Ligado</th><th/></tr></thead>
   <tbody>{state.schedules.map(s=><tr key={s.id}><td>{when(s.startsAt)}</td><td>{minutes(s.endsAt-s.startsAt)}</td><td>{REPEAT[s.repeat]}</td><td>{s.nextStartsAt?when(s.nextStartsAt):'Já passou'}</td>
    <td><button type="button" className={`adm-toggle ${s.enabled?'on':''}`} aria-pressed={s.enabled} aria-label="Ligar ou desligar" disabled={busy} onClick={()=>void run(()=>api.worldBossEditSchedule(s.id,{startsAt:s.startsAt,endsAt:s.endsAt,repeat:s.repeat,enabled:!s.enabled}))}><i/></button></td>
    <td><button type="button" className="adm-icon" aria-label="Excluir agendamento" disabled={busy} onClick={()=>{if(confirm('Excluir este agendamento? Um evento já em andamento continua.'))void run(()=>api.worldBossRemoveSchedule(s.id));}}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
   :<p className="adm-empty">Nenhum horário agendado.</p>}
  <div className="adm-event-add">
   <label>Início (Brasília)<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label>
   <label>Duração<select value={length} onChange={e=>setLength(Number(e.target.value))}>{[15,30,45,60,90,120,180].map(m=><option key={m} value={m}>{minutes(m*60000)}</option>)}</select></label>
   <label>Repetir<select value={repeat} onChange={e=>setRepeat(e.target.value as WorldBossSchedule['repeat'])}>{Object.entries(REPEAT).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <button className="adm-btn gold" disabled={busy||!start} onClick={add}><Plus size={16}/>Agendar</button>
  </div>
  <small className="adm-fine">Se um evento já estiver ativo no horário, o agendado daquela vez não abre. Parar um evento agendado não apaga o agendamento.</small>
 </article>;
}

function Settings({state,busy,run}:{state:WorldBossAdminState;busy:boolean;run:Run}){
 const [name,setName]=useState(state.settings.name),[hp,setHp]=useState(String(state.settings.maxHp)),[enabled,setEnabled]=useState(state.settings.enabled);
 const hpValue=Number(hp.replace(/\D/g,'')),valid=name.trim().length>=2&&hpValue>=1&&hpValue<=WORLD_BOSS_MAX_HP;
 return <article className="adm-panel adm-event-settings"><h2 className="adm-side-title">Configurações</h2>
  <label>Nome do chefão<input value={name} maxLength={40} onChange={e=>setName(e.target.value)}/></label>
  <label>Vida dos próximos eventos<input value={hp} inputMode="numeric" onChange={e=>setHp(e.target.value)}/><small>Um evento já aberto mantém a vida com que começou.</small></label>
  <label className="adm-toggle-row"><span><b>Agendamentos ligados</b><small>Desligado, nenhum horário abre; Iniciar agora continua funcionando.</small></span><button type="button" className={`adm-toggle ${enabled?'on':''}`} aria-pressed={enabled} onClick={()=>setEnabled(!enabled)}><i/></button></label>
  <button className="adm-btn gold" disabled={busy||!valid} onClick={()=>void run(()=>api.worldBossSettings({name:name.trim(),maxHp:hpValue,enabled}))}><Save size={16}/>Salvar</button>
 </article>;
}
