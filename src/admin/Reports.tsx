import {useCallback,useEffect,useState} from 'react';
import {Check,Flag,MessageSquare,RefreshCw,RotateCcw,X} from 'lucide-react';
import {api} from './api';
import {navigate} from './AdminApp';
import {REPORT_CONTEXT_NAMES,REPORT_REASON_NAMES,REPORT_STATUS_NAMES} from '../../shared/reports';
import type {ReportDetail,ReportStatus,ReportSummary} from '../../shared/reports';

const FILTERS:[ReportStatus|'all',string][]=[['open','Abertas'],['resolved','Resolvidas'],['dismissed','Descartadas'],['all','Todas']];
const TONES:Record<ReportStatus,string>={open:'draft',resolved:'live',dismissed:'base'};
const when=(value:string|number)=>new Date(value).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const clock=(value:number)=>new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});

/** /admin/denuncias: reports sent from the game, newest first; /admin/denuncias/<id> opens one with the chat. */
export function Reports({id}:{id?:number}){
 const [filter,setFilter]=useState<ReportStatus|'all'>('open'),[data,setData]=useState<{reports:ReportSummary[];counts:Record<ReportStatus,number>}|null>(null),[error,setError]=useState('');
 const load=useCallback(()=>api.reports(filter).then(r=>{setData(r);setError('');}).catch(e=>setError(e.message)),[filter]);
 useEffect(()=>{load();const timer=setInterval(load,30000);return()=>clearInterval(timer);},[load]);
 const total=data?data.counts.open+data.counts.resolved+data.counts.dismissed:0;
 return <section className="adm-page">
  <header className="adm-head"><div><h1>Denúncias</h1><p>Enviadas pelos jogadores no menu do botão direito. Cada uma traz o chat do denunciado dos 30 minutos anteriores.</p></div>
   <button className="adm-btn ghost" onClick={load}><RefreshCw size={16}/>Atualizar</button></header>
  <div className="adm-tabs">{FILTERS.map(([key,label])=><button key={key} className={filter===key?'on':''} onClick={()=>setFilter(key)}>{label}<small>{key==='all'?total:data?.counts[key]??0}</small></button>)}</div>
  {error&&<p className="adm-error">{error}</p>}
  <div className={`adm-reports ${id?'with-detail':''}`}>
   {!data?<div className="adm-skeleton"/>:data.reports.length?<ul className="adm-report-list">{data.reports.map(report=><li key={report.id}><button className={report.id===id?'on':''} onClick={()=>navigate(`/admin/denuncias/${report.id}`)}>
    <span className={`adm-status ${TONES[report.status]}`}>{REPORT_STATUS_NAMES[report.status]}</span>
    <b>{report.target.name}<small>nível {report.target.level}</small></b>
    <em>{REPORT_REASON_NAMES[report.reason]??report.reason}</em>
    <small className="adm-report-meta">por {report.reporter.name} · {when(report.createdAt)}{report.context?` · ${REPORT_CONTEXT_NAMES[report.context]??report.context}`:''}</small>
    <span className="adm-report-chat" title="Mensagens do chat anexadas"><MessageSquare size={14}/>{report.chatCount}</span>
   </button></li>)}</ul>:<p className="adm-empty big">{filter==='open'?'Nenhuma denúncia aberta.':'Nada aqui.'}</p>}
   {id&&<ReportView key={id} id={id} onChanged={load}/>}
  </div>
 </section>;
}

function ReportView({id,onChanged}:{id:number;onChanged:()=>void}){
 const [report,setReport]=useState<ReportDetail|null>(null),[note,setNote]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{api.report(id).then(r=>{setReport(r.report);setNote(r.report.note??'');}).catch(e=>setError(e.message));},[id]);
 const set=async(status:ReportStatus)=>{setBusy(true);setError('');try{const r=await api.updateReport(id,status,note.trim()||undefined);setReport(r.report);onChanged();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 if(!report)return <article className="adm-panel adm-report">{error?<p className="adm-error">{error}</p>:<div className="adm-skeleton"/>}</article>;
 const others=report.targetHistory.filter(h=>h.id!==report.id);
 return <article className="adm-panel adm-report">
  <header className="adm-report-head">
   <div><small>Denúncia nº {report.id} · {when(report.createdAt)}</small><h2><Flag size={18}/>{report.target.name}<small>nível {report.target.level}</small></h2></div>
   <span className={`adm-status ${TONES[report.status]}`}>{REPORT_STATUS_NAMES[report.status]}</span>
   <button className="adm-icon" aria-label="Fechar" onClick={()=>navigate('/admin/denuncias')}><X size={18}/></button>
  </header>
  <dl className="adm-report-facts">
   <div><dt>Motivo</dt><dd>{REPORT_REASON_NAMES[report.reason]??report.reason}</dd></div>
   <div><dt>Denunciado por</dt><dd>{report.reporter.name}</dd></div>
   <div><dt>Onde</dt><dd>{REPORT_CONTEXT_NAMES[report.context]??'—'}</dd></div>
   <div><dt>Outras contra o jogador</dt><dd>{others.length}</dd></div>
  </dl>
  {report.details&&<blockquote className="adm-report-quote">“{report.details}”</blockquote>}
  <h3 className="adm-report-sub"><MessageSquare size={16}/>Chat de {report.target.name} nos 30 min antes da denúncia <small>{report.chat.length} {report.chat.length===1?'mensagem':'mensagens'}</small></h3>
  {report.chat.length?<ol className="adm-report-log">{report.chat.map((line,index)=><li key={index}><time>{clock(line.at)}</time><span className={`adm-chat-channel ${line.channel}`}>{line.channel==='room'?`Sala ${line.room??''}`.trim():line.channel==='private'?`Privado → ${line.to??''}`:line.channel==='guild'?`Guilda ${line.guild??''}`.trim():'Mundo'}</span><p>{line.text}</p></li>)}</ol>:<p className="adm-empty">O jogador não escreveu no chat nos 30 minutos antes da denúncia.</p>}
  {others.length>0&&<><h3 className="adm-report-sub">Histórico do jogador</h3><ul className="adm-list">{others.map(h=><li key={h.id}><b><a href={`/admin/denuncias/${h.id}`} onClick={e=>{e.preventDefault();navigate(`/admin/denuncias/${h.id}`);}}>{REPORT_REASON_NAMES[h.reason]??h.reason}</a></b><small>por {h.reporter} · {when(h.createdAt)}</small><em>{REPORT_STATUS_NAMES[h.status]}</em></li>)}</ul></>}
  <label>Anotação da equipe<textarea className="adm-textarea" value={note} maxLength={500} rows={2} onChange={e=>setNote(e.target.value)} placeholder="O que foi feito (opcional)"/></label>
  {report.resolvedAt&&<p className="adm-hint">{REPORT_STATUS_NAMES[report.status]} por {report.resolvedBy} em {when(report.resolvedAt)}.</p>}
  {error&&<p className="adm-error">{error}</p>}
  <footer className="adm-report-actions">
   {report.status==='open'?<><button className="adm-btn ghost" disabled={busy} onClick={()=>set('dismissed')}><X size={15}/>Descartar</button><button className="adm-btn gold" disabled={busy} onClick={()=>set('resolved')}><Check size={15}/>Marcar como resolvida</button></>
   :<button className="adm-btn" disabled={busy} onClick={()=>set('open')}><RotateCcw size={15}/>Reabrir</button>}
  </footer>
 </article>;
}
