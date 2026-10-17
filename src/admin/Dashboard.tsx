import {useEffect,useState} from 'react';
import {Activity,Crown,RefreshCw,Swords,Trophy,UserPlus,Users,Wifi} from 'lucide-react';
import {api} from './api';
import type {Stats} from './api';

const ACTIONS:Record<string,string>={login:'Entrou no painel','login-failed':'Senha errada',logout:'Saiu do painel','map-save':'Salvou mapa','map-publish':'Publicou mapa','map-unpublish':'Voltou mapa ao original','map-create':'Criou mapa','map-delete':'Apagou mapa'};
const time=(iso:string)=>new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});

export function Dashboard(){
 const [stats,setStats]=useState<Stats|null>(null),[error,setError]=useState('');
 const load=()=>api.stats().then(s=>{setStats(s);setError('');}).catch(e=>setError(e.message));
 useEffect(()=>{load();const timer=setInterval(load,30000);return()=>clearInterval(timer);},[]);
 if(!stats)return <section className="adm-page"><Header onRefresh={load}/>{error?<p className="adm-error">{error}</p>:<div className="adm-skeleton"/>}</section>;
 const cards=[
  {icon:Wifi,label:'Online agora',value:stats.live.online,hint:`${stats.live.rooms} salas · ${stats.live.battles} partidas rolando`,tone:'live'},
  {icon:Users,label:'Jogadores',value:stats.players.total,hint:`${stats.players.newWeek} novos em 7 dias`},
  {icon:UserPlus,label:'Novos hoje',value:stats.players.newToday,hint:'contas criadas hoje'},
  {icon:Activity,label:'Ativos hoje',value:stats.today.activePlayers,hint:'jogaram ao menos uma partida'},
  {icon:Swords,label:'Partidas hoje',value:stats.today.matches,hint:`${stats.today.botMatches} contra bot`},
  {icon:Trophy,label:'Vitórias hoje',value:stats.today.wins,hint:'somando todos os vencedores'},
 ];
 return <section className="adm-page">
  <Header onRefresh={load}/>
  <div className="adm-cards">{cards.map(({icon:Icon,label,value,hint,tone})=><article key={label} className={`adm-card ${tone??''}`}><span className="adm-card-icon"><Icon size={20}/></span><small>{label}</small><b>{value.toLocaleString('pt-BR')}</b><em>{hint}</em></article>)}</div>
  <div className="adm-grid">
   <article className="adm-panel span2"><h2>Partidas por dia <small>últimos 14 dias</small></h2><DayChart days={stats.days}/></article>
   <article className="adm-panel"><h2><Crown size={18}/> Ranking de hoje</h2>
    {stats.topToday.length?<ol className="adm-rank">{stats.topToday.map((p,i)=><li key={p.id}><span className={`adm-place p${i+1}`}>{i+1}</span><b>{p.name}</b><small>nível {p.level}</small><em>{p.wins} {p.wins===1?'vitória':'vitórias'}</em></li>)}</ol>:<p className="adm-empty">Ninguém venceu hoje ainda.</p>}
   </article>
   <article className="adm-panel"><h2><UserPlus size={18}/> Últimos jogadores</h2>
    <ul className="adm-list">{stats.newestPlayers.map(p=><li key={p.id}><b>{p.name}</b><small>nível {p.level}</small><em>{time(p.createdAt)}</em></li>)}</ul>
   </article>
   <article className="adm-panel span2"><h2>Atividade do painel</h2>
    {stats.audit.length?<ul className="adm-list">{stats.audit.map((a,i)=><li key={i}><b>{ACTIONS[a.action]??a.action}{a.detail?.id?` · ${a.detail.id}`:''}</b><small>{a.username??'—'}</small><em>{time(a.at)}</em></li>)}</ul>:<p className="adm-empty">Sem atividade.</p>}
   </article>
  </div>
 </section>;
}

function Header({onRefresh}:{onRefresh:()=>void}){
 return <header className="adm-head"><div><h1>Visão geral</h1><p>Dia contado no horário de Brasília, como o ranking do lobby.</p></div><button className="adm-btn ghost" onClick={onRefresh}><RefreshCw size={16}/>Atualizar</button></header>;
}

/** One series, so no legend: bars with rounded tops, a recessive baseline and a tooltip per day. */
function DayChart({days}:{days:Stats['days']}){
 const [hover,setHover]=useState<number|null>(null);
 const W=720,H=220,pad={l:34,r:8,t:14,b:28},max=Math.max(4,...days.map(d=>d.matches)),step=(W-pad.l-pad.r)/days.length,bar=Math.min(30,step-6);
 const y=(v:number)=>pad.t+(H-pad.t-pad.b)*(1-v/max),ticks=[0,Math.round(max/2),max];
 const label=(d:string)=>{const [,m,day]=d.split('-');return `${day}/${m}`;};
 return <div className="adm-chart">
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Partidas por dia nos últimos 14 dias">
   {ticks.map(t=><g key={t}><line x1={pad.l} x2={W-pad.r} y1={y(t)} y2={y(t)} className="grid"/><text x={pad.l-8} y={y(t)+4} textAnchor="end" className="tick">{t}</text></g>)}
   {days.map((d,i)=>{const x=pad.l+i*step+(step-bar)/2,h=H-pad.b-y(d.matches);return <g key={d.day} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}>
    <rect x={pad.l+i*step} y={pad.t} width={step} height={H-pad.t-pad.b} fill="transparent"/>
    {d.matches>0&&<path className={`bar ${hover===i?'on':''}`} d={`M${x},${H-pad.b} v${-Math.max(0,h-4)} q0,-4 4,-4 h${bar-8} q4,0 4,4 v${Math.max(0,h-4)} z`}/>}
    {(i%2===(days.length-1)%2)&&<text x={x+bar/2} y={H-8} textAnchor="middle" className="tick">{label(d.day)}</text>}
   </g>;})}
  </svg>
  {hover!==null&&<div className="adm-tip" style={{left:`${(pad.l+(hover+.5)*step)/W*100}%`}}><b>{label(days[hover].day)}</b>{days[hover].matches} partidas · {days[hover].players} jogadores</div>}
 </div>;
}
