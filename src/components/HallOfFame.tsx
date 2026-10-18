import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Award,ChevronLeft,ChevronRight,Crown,Flame,LoaderCircle,RefreshCw,Scroll,Shield,Swords,Timer,TrendingUp,Trophy,User} from 'lucide-react';
import {ACHIEVEMENTS,GUILD_BOARD_NAMES,GUILD_BOARDS,HALL_CATEGORY_NAMES,HALL_PERIOD_NAMES,LEGEND_BOARDS,LEGEND_NAMES,PLACE_NAMES,periodLabel} from '../../shared/hall';
import type {GuildBoard,HallBoard,HallCategory,HallPeriod,HallRow,LegendBoard} from '../../shared/hall';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {Avatar} from './Avatar';
import {LevelBadge} from './LevelBadge';
import {Modal} from './Modal';
import {playerMenuProps} from './PlayerActions';
import {PowerIcon} from './PowerIcon';
import './WoodTheme.css';
import './Backpack.css';
import './HallOfFame.css';

/* Hall da Fama (docs/hall-of-fame.md), no padrão de madeira da mochila e do leilão: abas verticais por categoria,
   filtros no topo, pódio pintado dos três primeiros, tabela paginada, a minha posição fixa embaixo e o perfil
   de quem for clicado. Todos os números vêm do servidor. */
type View=HallCategory|'legends';
const VIEWS:{id:View;label:string;icon:typeof Trophy}[]=[
 {id:'power',label:HALL_CATEGORY_NAMES.power,icon:Flame},
 {id:'pvp',label:HALL_CATEGORY_NAMES.pvp,icon:Swords},
 {id:'guild',label:HALL_CATEGORY_NAMES.guild,icon:Shield},
 {id:'level',label:HALL_CATEGORY_NAMES.level,icon:TrendingUp},
 {id:'achievements',label:HALL_CATEGORY_NAMES.achievements,icon:Award},
 {id:'legends',label:'Lendas',icon:Scroll},
];
const SIGILS=['gold','blue','purple'] as const;
const fmt=(value:number|undefined)=>(value??0).toLocaleString('pt-BR');
const pct=(value:number|undefined)=>`${(value??0).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
const PERIOD_WORD:Record<HallPeriod,string>={day:'diário',week:'semanal',all:'geral'};
const CROWN_SHORT:Record<LegendBoard,string>={'pvp-day':'do dia','pvp-week':'da semana','guild-week':'da semana'};

/** What each board shows next to the name, and its unit. */
function columns(category:HallCategory,board?:GuildBoard):{label:string;value:(r:HallRow)=>React.ReactNode;main?:boolean}[]{
 if(category==='power')return [{label:'Nível',value:r=><LevelBadge level={r.level??1} size={30}/>},{label:'Poder',value:r=><span className="hall-power"><PowerIcon size={18}/>{fmt(r.score)}</span>,main:true}];
 if(category==='pvp')return [{label:'Vitórias',value:r=>fmt(r.wins),main:true},{label:'Derrotas',value:r=>fmt(r.losses)},{label:'Taxa',value:r=>pct(r.winRate)},{label:'Sequência',value:r=>r.streak?<span className="hall-streak"><Flame size={13}/>{r.streak}</span>:'—'}];
 if(category==='level')return [{label:'Nível',value:r=><LevelBadge level={r.level??1} size={30}/>,main:true},{label:'EXP',value:r=>fmt(r.xp)},{label:'Poder',value:r=>fmt(r.power)}];
 if(category==='achievements')return [{label:'Conquistas',value:r=>`${fmt(r.achievements)}/${ACHIEVEMENTS.length}`},{label:'Pontos',value:r=>fmt(r.score),main:true}];
 const base=[{label:'Líder',value:(r:HallRow)=>r.leader},{label:'Membros',value:(r:HallRow)=>fmt(r.members)}];
 if(board==='power')return [...base,{label:'Nível',value:r=>fmt(r.level)},{label:'Poder',value:r=><span className="hall-power"><PowerIcon size={18}/>{fmt(r.score)}</span>,main:true}];
 if(board==='pvp')return [...base,{label:'Vitórias',value:r=>fmt(r.wins)},{label:'Pontos',value:r=>fmt(r.score),main:true}];
 if(board==='gvg')return [...base,{label:'Vitórias GvG',value:r=>fmt(r.score),main:true}];
 return [...base,{label:'Riqueza',value:r=>fmt(r.riqueza)},{label:'Nível',value:r=>fmt(r.score),main:true}];
}
const scoreLabel=(category:HallCategory,board?:GuildBoard)=>category==='power'?'Poder':category==='pvp'?'vitórias':category==='level'?'Nível':category==='achievements'?'pontos':board==='power'?'Poder':board==='level'?'Nível':'vitórias';

function countdown(ms:number){
 if(ms<=0)return 'encerrando…';
 const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),sec=s%60,two=(n:number)=>String(n).padStart(2,'0');
 return `${d?`${d}d `:''}${two(h)}:${two(m)}:${two(sec)}`;
}
function ago(ms:number){const s=Math.max(0,Math.round(ms/1000));return s<5?'agora':s<60?`há ${s} s`:`há ${Math.floor(s/60)} min`;}

export function RankMark({rank,size=34}:{rank:number;size?:number}){
 if(rank>=1&&rank<=3)return <img className="hall-rank-art" src={`/assets/ui/hall-rank-${rank}.png`} alt={`${rank}º`} width={size} height={size} draggable={false}/>;
 return <b className="hall-rank-number">{rank?`${rank}º`:'—'}</b>;
}
function GuildMark({level,size=40}:{level?:number;size?:number}){return <span className="hall-guild-mark" style={{width:size,height:size}}><Shield size={size*.92} strokeWidth={1.6}/>{level!==undefined&&<b>{level}</b>}</span>;}
function Crowns({row}:{row:HallRow}){
 if(!row.crowns?.length)return null;
 return <>{row.crowns.map(c=><span key={c.board} className={`hall-crown place-${c.place}`} title={`${PLACE_NAMES[c.place]} ${LEGEND_NAMES[c.board].replace(/^(Campeão|Guilda campeã) /,'').toLowerCase()} anterior`}><Crown size={11}/>{c.place===1?'Campeão':`${c.place}º`} {CROWN_SHORT[c.board]}</span>)}</>;
}

export function HallOfFame(){
 const state=useGame(),{hallBoard:board,hallChanged:changed,offset}=state;
 const [view,setView]=useState<View>('power'),[period,setPeriod]=useState<HallPeriod>('day'),[guildBoard,setGuildBoard]=useState<GuildBoard>('power'),[page,setPage]=useState(1);
 const [player,setPlayer]=useState<string|null>(null),[guild,setGuild]=useState<number|null>(null);
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
 const category:HallCategory|null=view==='legends'?null:view;
 const effectivePeriod:HallPeriod=category==='pvp'?period:category==='guild'&&(guildBoard==='pvp'||guildBoard==='gvg')?(period==='day'?'week':period):'all';
 const ask=useMemo(()=>category?{category,...(category==='pvp'||category==='guild'?{period:effectivePeriod}:{}),...(category==='guild'?{board:guildBoard}:{}),page}:null,[category,effectivePeriod,guildBoard,page]);
 const query=()=>{if(ask)client.hallQuery(ask);};
 useEffect(query,[ask]);
 // The server says when a board changed; the open one asks again, at most every couple of seconds.
 const lastChange=useRef(0);
 useEffect(()=>{
  if(!changed||!category)return;
  const relevant=changed.categories.includes(category)||category==='guild'&&changed.categories.some(c=>c==='power'||c==='pvp');
  if(!relevant)return;const wait=Math.max(0,2000-(Date.now()-lastChange.current));
  const t=setTimeout(()=>{lastChange.current=Date.now();query();},wait);return()=>clearTimeout(t);
 },[changed?.at]);// eslint-disable-line react-hooks/exhaustive-deps
 // A day or week that just ended: ask again once the new one has begun.
 const endsIn=board?.endsAt?board.endsAt-(now+offset):null;
 useEffect(()=>{if(endsIn!==null&&endsIn<=0){const t=setTimeout(query,3000);return()=>clearTimeout(t);}},[endsIn!==null&&endsIn<=0]);// eslint-disable-line react-hooks/exhaustive-deps
 const loaded=!!board&&!!category&&board.category===category&&board.page===page&&(category!=='guild'||board.board===guildBoard)&&(category!=='pvp'&&!(category==='guild'&&(guildBoard==='pvp'||guildBoard==='gvg'))||board.period===effectivePeriod);
 const go=(next:View)=>{setView(next);setPage(1);setPlayer(null);setGuild(null);if(next==='pvp')setPeriod('day');audio.play('click');};
 const openRow=(row:HallRow)=>{audio.play('click');if(category==='guild'){setGuild(Number(row.id));client.hallGuildProfile(Number(row.id));}else{setPlayer(row.id);client.hallPlayer(row.id);}};
 const showPlayer=(id:string)=>{setGuild(null);setPlayer(id);client.hallPlayer(id);audio.play('click');};
 const showGuild=(id:number)=>{setPlayer(null);setGuild(id);client.hallGuildProfile(id);audio.play('click');};
 const back=()=>{setPlayer(null);setGuild(null);client.hallPlayer(null);audio.play('click');};
 const title=category==='pvp'?`PvP ${PERIOD_WORD[effectivePeriod]}`:category==='guild'?`Guildas · ${GUILD_BOARD_NAMES[guildBoard]}${guildBoard==='pvp'||guildBoard==='gvg'?` (${PERIOD_WORD[effectivePeriod]})`:''}`:category?HALL_CATEGORY_NAMES[category]:'Lendas';

 return <Modal title="Hall da Fama" onClose={()=>client.closeHall()} className="bag-window hall-window" viewport>
  <div className="hall-layout">
   <nav className="hall-tabs" aria-label="Categorias do Hall da Fama">
    {VIEWS.map(({id,label,icon:Icon})=><button key={id} className={view===id?'active':''} aria-pressed={view===id} onClick={()=>go(id)}><Icon size={18}/><span>{label}</span></button>)}
   </nav>
   <section className="hall-main">
    {player||guild?<div className="hall-profile-wrap">
     <button className="wood-quiet hall-back" onClick={back}><ArrowLeft size={15}/>Voltar ao ranking</button>
     {player?<PlayerProfile id={player} onGuild={showGuild}/>:<GuildProfile id={guild!} onPlayer={showPlayer}/>}
    </div>:view==='legends'?<Legends onPlayer={showPlayer} onGuild={showGuild}/>:<>
     <header className="hall-filters">
      <div className="hall-filter-tabs">
       {category==='pvp'&&(['day','week','all'] as const).map(p=><button key={p} className={effectivePeriod===p?'active':''} onClick={()=>{setPeriod(p);setPage(1);audio.play('click');}}>{HALL_PERIOD_NAMES[p]}</button>)}
       {category==='guild'&&GUILD_BOARDS.map(b=><button key={b} className={guildBoard===b?'active':''} onClick={()=>{setGuildBoard(b);setPage(1);audio.play('click');}}>{GUILD_BOARD_NAMES[b]}</button>)}
       {category==='guild'&&(guildBoard==='pvp'||guildBoard==='gvg')&&<span className="hall-subtabs">{(['week','all'] as const).map(p=><button key={p} className={effectivePeriod===p?'active':''} onClick={()=>{setPeriod(p);setPage(1);audio.play('click');}}>{HALL_PERIOD_NAMES[p]}</button>)}</span>}
       {category!=='pvp'&&category!=='guild'&&<h2 className="hall-board-title">{title}</h2>}
      </div>
      <div className="hall-clock">
       {board?.endsAt&&loaded&&<span title="Fim do período (horário de Brasília)"><Timer size={15}/>Encerra em <b>{countdown(endsIn??0)}</b></span>}
       {loaded&&<span className="hall-updated"><RefreshCw size={13}/>Atualizado {ago(now-board!.updatedAt+offset)}</span>}
      </div>
     </header>
     {!loaded?<div className="hall-state wood-cream"><LoaderCircle className="button-spinner" size={28}/>Carregando o ranking…</div>
      :board!.disabled?<div className="hall-state wood-cream">Esta categoria está desativada no momento.</div>
      :<BoardView board={board!} category={category!} onOpen={openRow} onPage={n=>{setPage(n);audio.play('click');}}/>}
     {loaded&&!board!.disabled&&<MyPlace board={board!} title={title}/>}
    </>}
   </section>
  </div>
 </Modal>;
}

function BoardView({board,category,onOpen,onPage}:{board:HallBoard;category:HallCategory;onOpen:(row:HallRow)=>void;onPage:(page:number)=>void}){
 const cols=columns(category,board.board),guild=category==='guild',podium=board.page===1?board.rows.filter(r=>r.rank<=3):[],rest=board.page===1?board.rows.filter(r=>r.rank>3):board.rows;
 const mine=board.me?.id,label=scoreLabel(category,board.board);
 if(!board.rows.length)return <div className="hall-state wood-cream"><Trophy size={30}/>{category==='pvp'||guild&&board.board!=='power'&&board.board!=='level'?'Ninguém pontuou ainda neste período. A primeira vitória abre o ranking!':'Ainda não há ninguém neste ranking.'}</div>;
 return <div className="hall-board">
  {!!podium.length&&<div className="hall-podium">
   {[1,0,2].map(index=>podium[index]).map((row,i)=>row?<button key={row.id} className={`hall-podium-card place-${row.rank} ${row.id===mine?'mine':''}`} onClick={()=>onOpen(row)} {...(!guild?playerMenuProps({id:row.id,name:row.name,context:'ranking'}):{})}>
    <span className="hall-podium-figure">
     {guild?<GuildMark level={row.level} size={64}/>:<><i className={`hall-sigil ${SIGILS[row.rank-1]}`} aria-hidden="true"/>{row.equipment&&<Avatar equipment={row.equipment} size={row.rank===1?118:100} animated={false} weapon={false}/>}</>}
    </span>
    <img className="hall-podium-base" src={`/assets/ui/hall-rank-${row.rank}.png`} alt="" draggable={false}/>
    <span className="hall-podium-text"><b className="hall-podium-place">{row.rank}º</b><strong>{row.name}</strong>{!guild&&row.guild&&<small><Shield size={11}/>{row.guild}</small>}<em>{fmt(row.score)} {label}</em>{!!row.crowns?.length&&<span className="hall-podium-crowns"><Crowns row={row}/></span>}</span>
   </button>:<span key={`empty-${i}`} className="hall-podium-card empty"/>)}
  </div>}
  {!!board.rows.length&&<div className={`hall-table-wrap wood-cream ${rest.length?'':'podium-only'}`}><table className="hall-table">
   <thead><tr><th>Pos.</th><th>{guild?'Guilda':'Jogador'}</th>{cols.map(c=><th key={c.label} className={c.main?'main':''}>{c.label}</th>)}</tr></thead>
   <tbody>{board.rows.map(row=><tr key={row.id} className={`${row.id===mine?'mine':''} ${podium.includes(row)?'podium-row':''}`} tabIndex={0} onClick={()=>onOpen(row)} onKeyDown={e=>{if(e.key==='Enter')onOpen(row);}} {...(!guild?playerMenuProps({id:row.id,name:row.name,context:'ranking'}):{})}>
    <td><RankMark rank={row.rank} size={30}/></td>
    <td className="hall-who">{guild?<GuildMark level={row.level} size={30}/>:<span className="hall-head">{row.equipment&&<Avatar equipment={row.equipment} size={40} portrait animated={false} weapon={false}/>}</span>}<span><strong>{row.name}</strong>{!guild&&row.guild&&<small><Shield size={10}/>{row.guild}</small>}<Crowns row={row}/></span></td>
    {cols.map(c=><td key={c.label} className={c.main?'main':''}>{c.value(row)}</td>)}
   </tr>)}</tbody>
  </table></div>}
  {board.note&&<p className="hall-note">{board.note}</p>}
  <Pager board={board} onPage={onPage}/>
 </div>;
}

function Pager({board,onPage:ask}:{board:HallBoard;onPage:(page:number)=>void}){
 if(board.pages<=1)return null;
 return <nav className="hall-pager" aria-label="Páginas">
  <button className="wood-quiet" disabled={board.page<=1} aria-label="Página anterior" onClick={()=>ask(board.page-1)}><ChevronLeft size={16}/></button>
  {Array.from({length:board.pages},(_,i)=>i+1).map(n=><button key={n} className={`wood-quiet ${n===board.page?'active':''}`} aria-current={n===board.page?'page':undefined} onClick={()=>ask(n)}>{n}</button>)}
  <button className="wood-quiet" disabled={board.page>=board.pages} aria-label="Próxima página" onClick={()=>ask(board.page+1)}><ChevronRight size={16}/></button>
  <span>Top {board.topSize}</span>
 </nav>;
}

function MyPlace({board,title}:{board:HallBoard;title:string}){
 const me=board.me,guild=board.category==='guild';
 if(!me)return <footer className="hall-me wood-pane"><User size={18}/><span>{guild?'Você ainda não faz parte de uma guilda.':'Sua classificação aparece aqui depois da sua primeira atualização.'}</span></footer>;
 const ranked=me.rank>0;
 return <footer className="hall-me wood-pane">
  <span className="hall-me-title">{guild?'Sua guilda':'Sua classificação'} · {title}</span>
  <span className="hall-me-rank">{ranked?<>Posição <b>#{fmt(me.rank)}</b></>:<>Sem posição ainda</>}</span>
  {board.category==='pvp'?<><span>Vitórias <b>{fmt(me.wins)}</b></span><span>Derrotas <b>{fmt(me.losses)}</b></span><span>Taxa de vitória <b>{pct(me.winRate)}</b></span>{!!me.streak&&<span>Sequência <b>{me.streak}</b></span>}</>
   :<span>{scoreLabel(board.category,board.board).replace(/^./,c=>c.toUpperCase())} <b>{fmt(me.score)}</b></span>}
  {ranked&&me.rank>board.topSize&&<small>fora do Top {board.topSize}</small>}
 </footer>;
}

function PlayerProfile({id,onGuild}:{id:string;onGuild:(id:number)=>void}){
 const {hallProfile:p,profile:me}=useGame();
 if(!p||p.id!==id)return <div className="hall-state wood-cream"><LoaderCircle className="button-spinner" size={28}/>Carregando o perfil…</div>;
 const unlocked=new Map(p.achievements.map(a=>[a.id,a.unlockedAt]));
 const counts=LEGEND_BOARDS.flatMap(board=>([1,2,3] as const).filter(place=>p.titleCounts[board][place]).map(place=>`${p.titleCounts[board][place]}× ${PLACE_NAMES[place].toLowerCase()} ${board==='pvp-day'?'PvP diário':board==='pvp-week'?'PvP semanal':'de guilda semanal'}`));
 return <div className="hall-profile">
  <aside className="hall-profile-card wood-cream">
   <span className="hall-profile-figure"><i className="hall-sigil gold" aria-hidden="true"/><Avatar equipment={p.equipment} size={190} animated={false} weapon/></span>
   <h3>{p.name}</h3>
   <div className="hall-profile-tags"><LevelBadge level={p.level} size={36}/>{p.guild?<button className="hall-link" onClick={()=>onGuild(p.guild!.id)}><Shield size={13}/>{p.guild.name}</button>:<small>Sem guilda</small>}</div>
   <span className="hall-power big"><PowerIcon size={22}/>{fmt(p.power)}</span>
   {p.id!==me?.id&&<button className="wood-button" onClick={()=>client.openPlayerPanel('info',{id:p.id,name:p.name,context:'ranking'})}><User size={15}/>Ver equipamento</button>}
  </aside>
  <div className="hall-profile-body">
   <section className="wood-cream hall-profile-ranks">
    <span><Flame size={15}/>Poder <b>{p.ranks.power?`#${fmt(p.ranks.power)}`:'—'}</b></span>
    <span><TrendingUp size={15}/>Evolução <b>{p.ranks.level?`#${fmt(p.ranks.level)}`:'—'}</b></span>
    <span><Award size={15}/>Conquistas <b>{p.ranks.achievements?`#${fmt(p.ranks.achievements)}`:'—'}</b></span>
    <span>EXP <b>{fmt(p.xp)}</b></span>
   </section>
   <section className="wood-cream">
    <h4><Swords size={15}/>PvP</h4>
    <table className="hall-mini"><thead><tr><th/><th>Posição</th><th>Vitórias</th><th>Derrotas</th><th>Batalhas</th><th>Taxa</th></tr></thead>
     <tbody>{(['day','week','all'] as const).map(period=><tr key={period}><th>{HALL_PERIOD_NAMES[period]}</th><td>{p.pvp[period].rank?`#${fmt(p.pvp[period].rank!)}`:'—'}</td><td>{fmt(p.pvp[period].wins)}</td><td>{fmt(p.pvp[period].losses)}</td><td>{fmt(p.pvp[period].battles)}</td><td>{pct(p.pvp[period].winRate)}</td></tr>)}</tbody>
    </table>
    {p.streak>0&&<p className="hall-streak-line"><Flame size={14}/>Sequência atual de {p.streak} {p.streak===1?'vitória':'vitórias'}</p>}
   </section>
   <section className="wood-cream">
    <h4><Crown size={15}/>Títulos</h4>
    {counts.length?<ul className="hall-title-counts">{counts.map(line=><li key={line}>{line}</li>)}</ul>:<p className="hall-muted">Ainda sem títulos. Termine um dia ou uma semana entre os três primeiros do PvP.</p>}
    {!!p.titles.length&&<ul className="hall-title-list">{p.titles.slice(0,8).map(t=><li key={`${t.board}-${t.periodKey}`}><RankMark rank={t.place} size={22}/>{LEGEND_NAMES[t.board].replace('Campeão','').replace('Guilda campeã','Guilda').trim()} · {periodLabel(t.board==='pvp-day'?'day':'week',t.periodKey)}<b>{fmt(t.score)}</b></li>)}</ul>}
   </section>
   <section className="wood-cream">
    <h4><Award size={15}/>Conquistas · {fmt(p.points)} pontos</h4>
    <ul className="hall-achievements">{ACHIEVEMENTS.map(a=><li key={a.id} className={unlocked.has(a.id)?'done':''} title={a.description}><Award size={16}/><span><strong>{a.name}</strong><small>{a.description}</small></span><b>{a.points}</b></li>)}</ul>
   </section>
  </div>
 </div>;
}

function GuildProfile({id,onPlayer}:{id:number;onPlayer:(id:string)=>void}){
 const {hallGuild:g}=useGame();
 if(!g||g.id!==id)return <div className="hall-state wood-cream"><LoaderCircle className="button-spinner" size={28}/>Carregando a guilda…</div>;
 const rank=(r:number|null)=>r?`#${fmt(r)}`:'—';
 return <div className="hall-profile">
  <aside className="hall-profile-card wood-cream">
   <span className="hall-profile-figure guild"><GuildMark level={g.level} size={110}/></span>
   <h3>{g.name}</h3>
   <p className="hall-guild-lead"><Crown size={13}/>Líder: {g.leader}</p>
   {!!g.viceLeaders.length&&<p className="hall-guild-lead">Vice: {g.viceLeaders.join(', ')}</p>}
   <span className="hall-power big"><PowerIcon size={22}/>{fmt(g.power)}</span>
   <small className="hall-muted">Poder dos {g.guildPowerMembers} mais fortes · {rank(g.powerRank)}</small>
  </aside>
  <div className="hall-profile-body">
   <section className="wood-cream hall-profile-ranks">
    <span>Membros <b>{fmt(g.members.length)}</b></span>
    <span>PvP semanal <b>{rank(g.pvp.week.rank)}</b> · {fmt(g.pvp.week.score)}</span>
    <span>PvP geral <b>{rank(g.pvp.all.rank)}</b> · {fmt(g.pvp.all.score)}</span>
    <span>Vitórias computadas <b>{fmt(g.totalWins)}</b></span>
    <span>GvG <b>{fmt(g.gvgWins)}</b></span>
    <span>Riqueza <b>{fmt(g.riqueza)}</b></span>
   </section>
   <section className="wood-cream hall-guild-columns">
    <div><h4><Trophy size={15}/>Maiores contribuidores (semana)</h4><Contributors list={g.contributors.week} onPlayer={onPlayer}/></div>
    <div><h4><Trophy size={15}/>Maiores contribuidores (geral)</h4><Contributors list={g.contributors.all} onPlayer={onPlayer}/></div>
   </section>
   <section className="wood-cream">
    <h4><Shield size={15}/>Membros</h4>
    <table className="hall-mini"><thead><tr><th>Nome</th><th>Cargo</th><th>Nível</th><th>Poder</th><th>Vitórias (semana)</th><th>Vitórias (total)</th></tr></thead>
     <tbody>{g.members.map(m=><tr key={m.id} className="clickable" onClick={()=>onPlayer(m.id)} {...playerMenuProps({id:m.id,name:m.name,context:'ranking'})}><th>{m.name}</th><td>{m.rankName}</td><td>{m.level}</td><td>{fmt(m.power)}</td><td>{fmt(m.weekWins)}</td><td>{fmt(m.totalWins)}</td></tr>)}</tbody>
    </table>
   </section>
   <section className="wood-cream">
    <h4><Crown size={15}/>Títulos da guilda</h4>
    {g.titles.length?<ul className="hall-title-list">{g.titles.map(t=><li key={t.periodKey}><RankMark rank={t.place} size={22}/>{PLACE_NAMES[t.place]} · semana {periodLabel('week',t.periodKey)} (como {t.name})<b>{fmt(t.score)}</b></li>)}</ul>:<p className="hall-muted">Nenhum título ainda.</p>}
   </section>
  </div>
 </div>;
}
function Contributors({list,onPlayer}:{list:{id:string;name:string;wins:number}[];onPlayer:(id:string)=>void}){
 return list.length?<ol className="hall-contributors">{list.map(c=><li key={c.id}><button className="hall-link" onClick={()=>onPlayer(c.id)}>{c.name}</button><b>{fmt(c.wins)}</b></li>)}</ol>:<p className="hall-muted">Nenhuma vitória ainda.</p>;
}

function Legends({onPlayer,onGuild}:{onPlayer:(id:string)=>void;onGuild:(id:number)=>void}){
 const {hallLegends:legends}=useGame();
 const [board,setBoard]=useState<LegendBoard>('pvp-week'),[key,setKey]=useState<string|undefined>();
 useEffect(()=>{client.hallLegendsQuery(board,key);},[board,key]);
 const ready=legends&&legends.board===board&&(!key||legends.key===key);
 const guild=board==='guild-week';
 const open=(id:string)=>guild?onGuild(Number(id)):onPlayer(id);
 return <div className="hall-legends">
  <header className="hall-filters"><div className="hall-filter-tabs">{LEGEND_BOARDS.map(b=><button key={b} className={board===b?'active':''} onClick={()=>{setBoard(b);setKey(undefined);audio.play('click');}}>{LEGEND_NAMES[b]}</button>)}</div>
   {ready&&!!legends.periods.length&&<label className="hall-period-pick">{board==='pvp-day'?'Dia':'Semana'}<select value={legends.key??''} onChange={e=>setKey(e.target.value)}>{legends.periods.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select></label>}
  </header>
  {!ready?<div className="hall-state wood-cream"><LoaderCircle className="button-spinner" size={28}/>Carregando as lendas…</div>
   :!legends.periods.length?<div className="hall-state wood-cream"><Scroll size={30}/>Nenhum período encerrado ainda. Os campeões aparecem aqui assim que {board==='pvp-day'?'o dia':'a semana'} terminar.</div>
   :<div className="hall-legends-body">
    <div className="hall-table-wrap wood-cream"><table className="hall-table">
     <thead><tr><th>Pos.</th><th>{guild?'Guilda':'Jogador'}</th>{guild?<><th>Vitórias</th><th className="main">Pontos</th></>:<><th className="main">Vitórias</th><th>Derrotas</th><th>Taxa</th></>}</tr></thead>
     <tbody>{legends.rows.map(row=><tr key={row.id} tabIndex={0} onClick={()=>open(row.id)} onKeyDown={e=>{if(e.key==='Enter')open(row.id);}}>
      <td><RankMark rank={row.rank} size={30}/></td><td className="hall-who"><span><strong>{row.name}</strong>{!guild&&row.guild&&<small><Shield size={10}/>{row.guild}</small>}</span></td>
      {guild?<><td>{fmt(row.wins)}</td><td className="main">{fmt(row.score)}</td></>:<><td className="main">{fmt(row.wins)}</td><td>{fmt(row.losses)}</td><td>{pct(row.winRate)}</td></>}
     </tr>)}</tbody>
    </table></div>
    <aside className="hall-leaders wood-cream">
     <h4><Crown size={15}/>Maiores lendas</h4>
     {legends.leaders.length?<ol>{legends.leaders.map(l=><li key={l.id}><button className="hall-link" onClick={()=>open(l.id)}>{l.name}</button><span>{l.first?<b className="gold">{l.first}× 1º</b>:null}{l.second?<b className="silver">{l.second}× 2º</b>:null}{l.third?<b className="bronze">{l.third}× 3º</b>:null}</span></li>)}</ol>:<p className="hall-muted">Ninguém ainda.</p>}
     <small className="hall-muted">Resultado oficial de cada período, guardado no encerramento. Nomes como estavam naquele dia.</small>
    </aside>
   </div>}
 </div>;
}
