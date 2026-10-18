import {useCallback,useEffect,useState} from 'react';
import {AlertTriangle,Ban,Check,RefreshCw,RotateCcw,Save,Search,Trophy} from 'lucide-react';
import {api} from './api';
import type {HallAdmin} from './api';
import {HALL_ALERT_NAMES,HALL_CATEGORIES,HALL_CATEGORY_NAMES,LEGEND_BOARDS,LEGEND_NAMES,periodLabel} from '../../shared/hall';
import type {HallAdminMatch,HallAlert,HallConfig,LegendBoard,RewardTier} from '../../shared/hall';

const when=(value:string)=>new Date(value).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
type Tab='config'|'alerts'|'matches'|'closings';
const TABS:[Tab,string][]=[['config','Configuração'],['alerts','Alertas'],['matches','Batalhas'],['closings','Encerramentos']];
const KIND_NAMES:Record<string,string>={pvp:'PvP',gvg:'GvG',practice:'Treino'};

/** /admin/hall: Hall da Fama settings, review alerts, battle corrections and the closing history. Every change is audited. */
export function Hall(){
 const [tab,setTab]=useState<Tab>('config'),[data,setData]=useState<HallAdmin|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(()=>api.hall().then(r=>{setData(r);setError('');}).catch(e=>setError(e.message)),[]);
 useEffect(()=>{load();},[load]);
 const rebuild=async()=>{if(!confirm('Recontar todos os rankings PvP a partir das batalhas registradas?'))return;try{await api.hallRebuild();setNotice('Rankings recontados.');load();}catch(e){setError((e as Error).message);}};
 return <section className="adm-page">
  <header className="adm-head"><div><h1>Hall da Fama</h1><p>Rankings de Poder, PvP, Guildas, Evolução e Conquistas. Os dias e semanas fecham sozinhos; aqui você ajusta regras, revisa alertas e corrige batalhas com registro de auditoria.</p></div>
   <div className="adm-toolbar"><button className="adm-btn ghost" onClick={rebuild}><RefreshCw size={16}/>Recontar rankings</button></div></header>
  <div className="adm-tabs">{TABS.map(([key,label])=><button key={key} className={tab===key?'on':''} onClick={()=>setTab(key)}>{label}</button>)}</div>
  {error&&<p className="adm-error">{error}</p>}{notice&&<p className="adm-note">{notice}</p>}
  {!data?<div className="adm-skeleton"/>:tab==='config'?<ConfigForm config={data.config} onSaved={config=>{setData({...data,config});setNotice('Configuração salva.');}} onError={setError}/>
   :tab==='alerts'?<Alerts onError={setError}/>:tab==='matches'?<Matches onError={setError}/>:<Closings data={data}/>}
 </section>;
}

function ConfigForm({config,onSaved,onError}:{config:HallConfig;onSaved:(c:HallConfig)=>void;onError:(m:string)=>void}){
 const [draft,setDraft]=useState<HallConfig>(()=>structuredClone(config)),[busy,setBusy]=useState(false);
 const set=<K extends keyof HallConfig>(key:K,value:HallConfig[K])=>setDraft(d=>({...d,[key]:value}));
 const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);onError('');try{onSaved((await api.hallConfig(draft)).config);}catch(err){onError((err as Error).message);}finally{setBusy(false);}};
 const number=(label:string,value:number,change:(n:number)=>void,hint?:string)=><label className="adm-field"><span>{label}</span><input type="number" value={value} onChange={e=>change(Number(e.target.value))}/>{hint&&<small>{hint}</small>}</label>;
 const tiers=(board:LegendBoard)=>draft.rewards[board];
 const setTier=(board:LegendBoard,index:number,patch:Partial<RewardTier>)=>set('rewards',{...draft.rewards,[board]:tiers(board).map((t,i)=>i===index?{...t,...patch}:t)});
 return <form className="adm-grid adm-hall-form" onSubmit={save}>
  <div className="adm-panel adm-hall-config">
   <h3>Categorias</h3>
   {HALL_CATEGORIES.map(c=><div key={c} className="adm-field adm-toggle-row" onClick={()=>set('categories',{...draft.categories,[c]:!draft.categories[c]})}><b>{HALL_CATEGORY_NAMES[c]}</b><button type="button" className={`adm-toggle ${draft.categories[c]?'on':''}`} aria-pressed={draft.categories[c]}><i/></button></div>)}
   <h3>Regras</h3>
   {number('Posições exibidas',draft.topSize,n=>set('topSize',n),'De 10 a 100. O encerramento guarda essa quantidade.')}
   <label className="adm-field"><span>Fuso horário dos períodos</span><input value={draft.timeZone} onChange={e=>set('timeZone',e.target.value)}/><small>Ex.: America/Sao_Paulo. Mudar no meio de uma semana cria um período novo.</small></label>
   {number('Membros no Poder da guilda',draft.guildPowerMembers,n=>set('guildPowerMembers',n),'Soma do Poder dos N membros mais fortes.')}
   {number('Contribuidores no PvP da guilda',draft.guildPvpContributors,n=>set('guildPvpContributors',n),'Soma das vitórias dos N maiores contribuidores.')}
   {number('Espera antes de fechar (segundos)',draft.closeGraceSeconds,n=>set('closeGraceSeconds',n),'Tempo para batalhas terminadas antes da meia-noite serem salvas.')}
   <div className="adm-field adm-toggle-row" onClick={()=>set('countPractice',!draft.countPractice)}><b>Contar treino e batalhas contra bots<small> (só para jogadores, nunca para guildas)</small></b><button type="button" className={`adm-toggle ${draft.countPractice?'on':''}`} aria-pressed={draft.countPractice}><i/></button></div>
   <h3>Alertas de revisão</h3>
   {number('Mesmos jogadores por dia',draft.alerts.pairPerDay,n=>set('alerts',{...draft.alerts,pairPerDay:n}))}
   {number('Batalha curta (segundos)',draft.alerts.shortBattleSeconds,n=>set('alerts',{...draft.alerts,shortBattleSeconds:n}))}
   {number('Abandonos por dia',draft.alerts.leavesPerDay,n=>set('alerts',{...draft.alerts,leavesPerDay:n}))}
   {number('Vitórias em uma hora',draft.alerts.winsPerHour,n=>set('alerts',{...draft.alerts,winsPerHour:n}))}
  </div>
  <div className="adm-panel adm-hall-config">
   <h3>Recompensas</h3>
   <p className="adm-hint">Entregues pelo Correio quando o período fecha, uma vez só. Riqueza vai para a guilda. Títulos dos 3 primeiros são sempre registrados.</p>
   {LEGEND_BOARDS.map(board=><div key={board} className="adm-hall-rewards"><b>{LEGEND_NAMES[board]}</b>
    <table className="adm-table"><thead><tr><th>De</th><th>Até</th><th>Ouro</th><th>Cupons</th>{board==='guild-week'&&<th>Riqueza</th>}<th/></tr></thead>
     <tbody>{tiers(board).map((t,i)=><tr key={i}>
      {(['from','to','gold','coupons',...(board==='guild-week'?['riqueza'] as const:[])] as const).map(k=><td key={k}><input type="number" min={0} value={t[k]??0} onChange={e=>setTier(board,i,{[k]:Number(e.target.value)})}/></td>)}
      <td><button type="button" className="adm-btn ghost small" onClick={()=>set('rewards',{...draft.rewards,[board]:tiers(board).filter((_,j)=>j!==i)})}>Remover</button></td>
     </tr>)}</tbody></table>
    <button type="button" className="adm-btn ghost small" onClick={()=>{const last=tiers(board).at(-1);const from=(last?.to??0)+1;set('rewards',{...draft.rewards,[board]:[...tiers(board),{from,to:from,gold:0,coupons:0,...(board==='guild-week'?{riqueza:0}:{})}]});}}>Adicionar faixa</button>
   </div>)}
   <button className="adm-btn gold wide" disabled={busy}><Save size={16}/>{busy?'Salvando…':'Salvar configuração'}</button>
  </div>
 </form>;
}

function Alerts({onError}:{onError:(m:string)=>void}){
 const [status,setStatus]=useState<'open'|'all'>('open'),[alerts,setAlerts]=useState<HallAlert[]|null>(null);
 const load=useCallback(()=>api.hallAlerts(status).then(r=>setAlerts(r.alerts)).catch(e=>onError(e.message)),[status,onError]);
 useEffect(()=>{load();},[load]);
 const mark=async(a:HallAlert,next:'open'|'dismissed')=>{try{await api.hallAlert(a.id,next);load();}catch(e){onError((e as Error).message);}};
 const voidIt=async(a:HallAlert)=>{const reason=prompt('Motivo para excluir a batalha dos rankings:');if(!reason||!a.matchId)return;try{await api.hallVoid(a.matchId,reason);load();}catch(e){onError((e as Error).message);}};
 return <>
  <div className="adm-tabs"><button className={status==='open'?'on':''} onClick={()=>setStatus('open')}>Abertos</button><button className={status==='all'?'on':''} onClick={()=>setStatus('all')}>Todos</button></div>
  <p className="adm-hint"><AlertTriangle size={14}/> Alertas só pedem revisão: nenhum jogador é bloqueado e nenhum resultado muda sozinho. Em servidor pequeno, jogar várias vezes contra as mesmas pessoas é normal.</p>
  {!alerts?<div className="adm-skeleton"/>:alerts.length?<div className="adm-panel adm-table-wrap"><table className="adm-table">
   <thead><tr><th>Quando</th><th>Tipo</th><th>Jogadores</th><th>Detalhe</th><th>Estado</th><th/></tr></thead>
   <tbody>{alerts.map(a=><tr key={a.id}><td>{when(a.createdAt)}</td><td>{HALL_ALERT_NAMES[a.kind]}</td><td>{a.players.map(p=>p.name).join(', ')}</td>
    <td>{Object.entries(a.detail).map(([k,v])=>`${k}: ${v}`).join(' · ')}</td><td><span className={`adm-status ${a.status==='open'?'draft':a.status==='voided'?'dirty':'base'}`}>{a.status==='open'?'Aberto':a.status==='voided'?'Excluída':'Descartado'}</span></td>
    <td className="adm-hall-actions">{a.status==='open'?<><button className="adm-btn ghost small" onClick={()=>mark(a,'dismissed')}><Check size={14}/>Legítimo</button>{a.matchId&&<button className="adm-btn ghost small" onClick={()=>voidIt(a)}><Ban size={14}/>Excluir batalha</button>}</>:<button className="adm-btn ghost small" onClick={()=>mark(a,'open')}><RotateCcw size={14}/>Reabrir</button>}</td></tr>)}</tbody>
  </table></div>:<p className="adm-empty big">Nenhum alerta {status==='open'?'aberto':''}.</p>}
 </>;
}

function Matches({onError}:{onError:(m:string)=>void}){
 const [page,setPage]=useState(0),[player,setPlayer]=useState(''),[filter,setFilter]=useState(''),[matches,setMatches]=useState<HallAdminMatch[]|null>(null);
 const load=useCallback(()=>api.hallMatches(page,filter||undefined).then(r=>setMatches(r.matches)).catch(e=>onError(e.message)),[page,filter,onError]);
 useEffect(()=>{load();},[load]);
 const change=async(m:HallAdminMatch,restore:boolean)=>{const reason=prompt(restore?'Motivo para devolver a batalha aos rankings:':'Motivo para excluir a batalha dos rankings:');if(!reason)return;try{await api.hallVoid(m.id,reason,restore);load();}catch(e){onError((e as Error).message);}};
 return <>
  <form className="adm-toolbar" onSubmit={e=>{e.preventDefault();setPage(0);setFilter(player.trim());}}><label className="adm-search"><Search size={15}/><input placeholder="ID do jogador (opcional)" value={player} onChange={e=>setPlayer(e.target.value)}/></label><button className="adm-btn ghost">Filtrar</button></form>
  <p className="adm-hint">Excluir uma batalha recalcula na hora os rankings abertos e o geral de quem jogou. Dias e semanas já encerrados mantêm o resultado oficial.</p>
  {!matches?<div className="adm-skeleton"/>:matches.length?<div className="adm-panel adm-table-wrap"><table className="adm-table">
   <thead><tr><th>Fim</th><th>Tipo</th><th>Time 1</th><th>Time 2</th><th>Conta?</th><th/></tr></thead>
   <tbody>{matches.map(m=>{const team=(t:number)=>m.players.filter(p=>p.team===t).map(p=>`${p.name}${p.outcome==='win'?' ✓':''}${p.left?' (saiu)':''}`).join(', ')||'bots';
    return <tr key={m.id}><td>{when(m.finishedAt)}</td><td>{KIND_NAMES[m.kind]??m.kind} {m.mode}</td><td>{team(0)}</td><td>{team(1)}</td>
     <td>{m.voidedAt?<span className="adm-status dirty" title={`${m.voidReason} (${m.voidedBy})`}>Excluída</span>:m.counted?<span className="adm-status live">Sim</span>:<span className="adm-status base">Não</span>}</td>
     <td>{m.voidedAt?<button className="adm-btn ghost small" onClick={()=>change(m,true)}><RotateCcw size={14}/>Devolver</button>:m.counted&&<button className="adm-btn ghost small" onClick={()=>change(m,false)}><Ban size={14}/>Excluir</button>}</td></tr>;})}</tbody>
  </table></div>:<p className="adm-empty big">Nenhuma batalha registrada.</p>}
  <div className="adm-pages"><button className="adm-btn ghost small" disabled={!page} onClick={()=>setPage(page-1)}>Anterior</button><span>Página {page+1}</span><button className="adm-btn ghost small" disabled={(matches?.length??0)<30} onClick={()=>setPage(page+1)}>Próxima</button></div>
 </>;
}

function Closings({data}:{data:HallAdmin}){
 return <div className="adm-grid">
  <div className="adm-panel adm-table-wrap"><table className="adm-table">
   <thead><tr><th>Ranking</th><th>Período</th><th>Fechado em</th><th>Posições</th><th>Recompensas</th></tr></thead>
   <tbody>{data.closings.length?data.closings.map(c=><tr key={`${c.board}-${c.key}`}><td><Trophy size={13}/> {LEGEND_NAMES[c.board as LegendBoard]??c.board}</td><td>{periodLabel(c.board==='pvp-day'?'day':'week',c.key)}</td><td>{when(c.closedAt)}</td><td>{c.rows}</td><td>{c.rewards.delivered} entregues{c.rewards.pending?` · ${c.rewards.pending} pendentes`:''}</td></tr>)
    :<tr><td colSpan={5}>Nenhum período encerrado ainda.</td></tr>}</tbody>
  </table></div>
  <div className="adm-panel"><h3>Auditoria</h3><ul className="adm-list">{data.audit.map((a,i)=><li key={i}><b>{a.action}</b> · {a.admin??'servidor'} · {when(a.at)}<small>{JSON.stringify(a.detail).slice(0,140)}</small></li>)}</ul></div>
 </div>;
}
