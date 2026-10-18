import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronLeft,ChevronRight,Crown,Flame,LoaderCircle,Scroll,Shield,Timer,Trophy,User,X} from 'lucide-react';
import {ACHIEVEMENTS,GUILD_BOARD_NAMES,GUILD_BOARDS,HALL_PERIOD_NAMES,LEGEND_NAMES} from '../../shared/hall';
import type {GuildBoard,HallBoard,HallCategory,HallPeriod,HallRow,LegendBoard} from '../../shared/hall';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {Avatar} from './Avatar';
import {Chat} from './Hud';
import {LevelBadge} from './LevelBadge';
import {playerMenuProps} from './PlayerActions';
import {PowerIcon} from './PowerIcon';
import './HallOfFame.css';

/* Hall da Fama em tela cheia, como no DDTank (docs/hall-of-fame.md): à esquerda o palco com quem está selecionado
   no ranking (o 1º ao abrir) e o chat embaixo; à direita o ranking escuro com Jogadores, Guildas e Lendas, as
   categorias, a página e "Meu ranking". Todos os números vêm do servidor. */
type Side='players'|'guilds'|'legends';
type PlayerCategory=Exclude<HallCategory,'guild'>;
const PLAYER_TABS:{id:PlayerCategory;label:string}[]=[{id:'power',label:'Poder'},{id:'level',label:'Nível'},{id:'achievements',label:'Conquistas'},{id:'pvp',label:'PvP'}];
const GUILD_TABS:{id:GuildBoard;label:string}[]=[{id:'power',label:'Poder'},{id:'pvp',label:'PvP'},{id:'gvg',label:'GvG'},{id:'level',label:'Nível'}];
const LEGEND_TABS:{id:LegendBoard;label:string}[]=[{id:'pvp-day',label:'PvP diário'},{id:'pvp-week',label:'PvP semanal'},{id:'guild-week',label:'Guilda da semana'}];
const fmt=(value:number|undefined)=>(value??0).toLocaleString('pt-BR');
const pct=(value:number|undefined)=>`${(value??0).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
const SIGILS=['gold','blue','purple'] as const;

/** The board's columns after Rank and Nome, DDTank-style: the main number first and one or two more. */
function columns(category:HallCategory,board?:GuildBoard):{label:string;value:(r:HallRow)=>React.ReactNode;main?:boolean}[]{
 if(category==='power')return [{label:'Poder',value:r=>fmt(r.score),main:true},{label:'Nível',value:r=>fmt(r.level)}];
 if(category==='pvp')return [{label:'Vitórias',value:r=>fmt(r.wins),main:true},{label:'Derrotas',value:r=>fmt(r.losses)},{label:'Taxa',value:r=>pct(r.winRate)}];
 if(category==='level')return [{label:'Nível',value:r=>fmt(r.level),main:true},{label:'EXP',value:r=>fmt(r.xp)}];
 if(category==='achievements')return [{label:'Pontos',value:r=>fmt(r.score),main:true},{label:'Conquistas',value:r=>`${fmt(r.achievements)}/${ACHIEVEMENTS.length}`}];
 if(board==='power')return [{label:'Poder',value:r=>fmt(r.score),main:true},{label:'Nível',value:r=>fmt(r.level)}];
 if(board==='pvp')return [{label:'Pontos',value:r=>fmt(r.score),main:true},{label:'Vitórias',value:r=>fmt(r.wins)}];
 if(board==='gvg')return [{label:'Vitórias GvG',value:r=>fmt(r.score),main:true},{label:'Nível',value:r=>fmt(r.level)}];
 return [{label:'Nível',value:r=>fmt(r.score),main:true},{label:'Riqueza',value:r=>fmt(r.riqueza)}];
}
const scoreName=(category:HallCategory,board?:GuildBoard)=>category==='power'||category==='guild'&&board==='power'?'Poder':category==='pvp'?'Vitórias':category==='achievements'?'Pontos':category==='guild'&&board==='pvp'?'Pontos PvP':category==='guild'&&board==='gvg'?'Vitórias GvG':'Nível';

function countdown(ms:number){
 if(ms<=0)return 'encerrando…';
 const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),sec=s%60,two=(n:number)=>String(n).padStart(2,'0');
 return `${d?`${d}d `:''}${two(h)}:${two(m)}:${two(sec)}`;
}
const clock=(at:number)=>new Date(at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});

/** "Nº 1" plaque in gold, silver or bronze; plain number after that. */
export function RankMark({rank}:{rank:number;size?:number}){
 if(rank>=1&&rank<=3)return <b className={`hof-rank-plate place-${rank}`}>Nº{rank}</b>;
 return <b className="hof-rank-number">{rank?`${rank}º`:'—'}</b>;
}
function GuildMark({level,size=40}:{level?:number;size?:number}){return <span className="hof-guild-mark" style={{width:size,height:size}}><Shield size={size*.92} strokeWidth={1.6}/>{level!==undefined&&<b style={{fontSize:Math.max(11,size*.3)}}>{level}</b>}</span>;}

/** Gold extruded word (Lilita One), the same recipe as the Ferreiro's SUCESSO!. */
function GoldWord({id,text,width,height,size,depth=7}:{id:string;text:string;width:number;height:number;size:number;depth?:number}){
 const font={fontFamily:"'Lilita One','Nunito',sans-serif",fontSize:size,textAnchor:'middle' as const,letterSpacing:1.5,x:width/2,y:height/2+size*.36};
 return <svg className="hof-gold-word" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={text}>
  <defs>
   <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1"><stop offset=".05" stopColor="#fffbd0"/><stop offset=".5" stopColor="#ffd42e"/><stop offset="1" stopColor="#ff8a0a"/></linearGradient>
   <linearGradient id={`${id}-side`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#c4520a"/><stop offset="1" stopColor="#6e2203"/></linearGradient>
   <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1"><stop offset=".25" stopColor="#fff" stopOpacity=".8"/><stop offset=".5" stopColor="#fff" stopOpacity=".2"/><stop offset=".51" stopColor="#fff" stopOpacity="0"/></linearGradient>
  </defs>
  <text {...font} y={font.y+depth+2} fill="#2a0f05" stroke="#2a0f05" strokeWidth={size*.2} strokeLinejoin="round">{text}</text>
  {Array.from({length:depth},(_,i)=><text key={i} {...font} y={font.y+depth-i} fill={`url(#${id}-side)`} stroke={`url(#${id}-side)`} strokeWidth={size*.14} strokeLinejoin="round">{text}</text>)}
  <text {...font} fill="none" stroke="#2a0f05" strokeWidth={size*.14} strokeLinejoin="round">{text}</text>
  <text {...font} fill={`url(#${id}-face)`} stroke="#fffbd0" strokeWidth={2} paintOrder="stroke">{text}</text>
  <text {...font} fill={`url(#${id}-gloss)`}>{text}</text>
 </svg>;
}

export function HallOfFame(){
 const state=useGame(),{hallBoard:board,hallChanged:changed,hallLegends:legends,hallProfile,offset}=state;
 const [side,setSide]=useState<Side>('players'),[playerTab,setPlayerTab]=useState<PlayerCategory>('power'),[guildTab,setGuildTab]=useState<GuildBoard>('power');
 const [period,setPeriod]=useState<HallPeriod>('day'),[page,setPage]=useState(1),[selected,setSelected]=useState<string|null>(null);
 const [legendBoard,setLegendBoard]=useState<LegendBoard>('pvp-week'),[legendKey,setLegendKey]=useState<string|undefined>();
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key!=='Escape')return;e.stopPropagation();client.closeHall();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);

 const category:HallCategory|null=side==='players'?playerTab:side==='guilds'?'guild':null;
 const periodic=category==='pvp'||category==='guild'&&(guildTab==='pvp'||guildTab==='gvg');
 const effectivePeriod:HallPeriod=category==='pvp'?period:periodic?(period==='day'?'week':period):'all';
 const ask=useMemo(()=>category?{category,...(category==='pvp'||category==='guild'?{period:effectivePeriod}:{}),...(category==='guild'?{board:guildTab}:{}),page}:null,[category,effectivePeriod,guildTab,page]);
 const query=()=>{if(ask)client.hallQuery(ask);};
 useEffect(query,[ask]);
 useEffect(()=>{if(side==='legends')client.hallLegendsQuery(legendBoard,legendKey);},[side,legendBoard,legendKey]);
 // The server says when a board changed; the open one asks again, at most every couple of seconds.
 const lastChange=useRef(0);
 useEffect(()=>{
  if(!changed||!category)return;
  const relevant=changed.categories.includes(category)||category==='guild'&&changed.categories.some(c=>c==='power'||c==='pvp');
  if(!relevant)return;const wait=Math.max(0,2000-(Date.now()-lastChange.current));
  const t=setTimeout(()=>{lastChange.current=Date.now();query();},wait);return()=>clearTimeout(t);
 },[changed?.at]);// eslint-disable-line react-hooks/exhaustive-deps
 const endsIn=board?.endsAt?board.endsAt-(now+offset):null;
 useEffect(()=>{if(endsIn!==null&&endsIn<=0){const t=setTimeout(query,3000);return()=>clearTimeout(t);}},[endsIn!==null&&endsIn<=0]);// eslint-disable-line react-hooks/exhaustive-deps

 const loaded=!!board&&!!category&&board.category===category&&board.page===page&&(category!=='guild'||board.board===guildTab)&&(!periodic||board.period===effectivePeriod);
 const legendsReady=side==='legends'&&!!legends&&legends.board===legendBoard&&(!legendKey||legends.key===legendKey);
 const rows=side==='legends'?legendsReady?legends!.rows:[]:loaded&&!board!.disabled?board!.rows:[];
 const guildRows=side==='guilds'||side==='legends'&&legendBoard==='guild-week';
 const current=rows.find(r=>r.id===selected)??rows[0]??null;
 // Legends keep only names and numbers: the stage asks for the champion's profile to dress them.
 useEffect(()=>{if(side==='legends'&&current&&!guildRows)client.hallPlayer(current.id);},[side,current?.id,guildRows]);// eslint-disable-line react-hooks/exhaustive-deps

 const reset=()=>{setPage(1);setSelected(null);audio.play('click');};
 const pick=(row:HallRow)=>{setSelected(row.id);audio.play('click');};
 const stageRow=current&&side==='legends'&&!guildRows&&hallProfile?.id===current.id?{...current,equipment:hallProfile.equipment,level:hallProfile.level,guild:hallProfile.guild?.name,power:hallProfile.power}:current;
 const valueName=side==='legends'?(guildRows?'Pontos':'Vitórias'):category?scoreName(category,guildTab):'';

 const content=<section className="hof-screen" aria-label="Hall da Fama">
  <div className="hof-left">
   <Stage row={stageRow} guild={guildRows} valueName={valueName}/>
   <aside className="hof-chat" aria-label="Conversa"><Chat/></aside>
  </div>
  <div className="hof-right">
   <header className="hof-sides">
    {([['players','Jogadores',User],['guilds','Guildas',Shield],['legends','Lendas',Scroll]] as const).map(([id,label,Icon])=><button key={id} className={side===id?'active':''} aria-pressed={side===id} onClick={()=>{setSide(id);if(id==='players'&&playerTab==='pvp')setPeriod('day');reset();}}><Icon size={16}/>{label}</button>)}
    <button className="hof-close" aria-label="Fechar o Hall da Fama" onClick={()=>client.closeHall()}><X size={20}/></button>
   </header>
   <nav className="hof-tabs" aria-label="Categoria">
    <div className="hof-cats">
     {side==='players'&&PLAYER_TABS.map(t=><button key={t.id} className={playerTab===t.id?'active':''} onClick={()=>{setPlayerTab(t.id);if(t.id==='pvp')setPeriod('day');reset();}}>{t.label}</button>)}
     {side==='guilds'&&GUILD_TABS.filter(t=>GUILD_BOARDS.includes(t.id)).map(t=><button key={t.id} className={guildTab===t.id?'active':''} title={GUILD_BOARD_NAMES[t.id]} onClick={()=>{setGuildTab(t.id);reset();}}>{t.label}</button>)}
     {side==='legends'&&LEGEND_TABS.map(t=><button key={t.id} className={legendBoard===t.id?'active':''} title={LEGEND_NAMES[t.id]} onClick={()=>{setLegendBoard(t.id);setLegendKey(undefined);reset();}}>{t.label}</button>)}
    </div>
    <div className="hof-periods">
     {periodic&&(category==='pvp'?['day','week','all'] as const:['week','all'] as const).map(p=><button key={p} className={effectivePeriod===p?'active':''} onClick={()=>{setPeriod(p);reset();}}>{p==='all'?'Total':HALL_PERIOD_NAMES[p]}</button>)}
     {side==='legends'&&legendsReady&&!!legends!.periods.length&&<label className="hof-period-pick">{legendBoard==='pvp-day'?'Dia':'Semana'}<select value={legends!.key??''} onChange={e=>{setLegendKey(e.target.value);setSelected(null);}}>{legends!.periods.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select></label>}
    </div>
   </nav>
   {side==='legends'?<LegendsTable ready={legendsReady} rows={rows} guild={guildRows} board={legendBoard} current={current?.id} onPick={pick}/>
    :!loaded?<div className="hof-state"><LoaderCircle className="button-spinner" size={28}/>Carregando o ranking…</div>
    :board!.disabled?<div className="hof-state">Esta categoria está desativada no momento.</div>
    :<BoardTable board={board!} category={category!} current={current?.id} onPick={pick}/>}
   <footer className="hof-foot">
    {side==='legends'?<span className="hof-updated">{legendsReady&&legends!.leaders.length?<><Crown size={14}/>Maiores lendas: {legends!.leaders.slice(0,3).map((l,i)=><b key={l.id}>{l.name} ({[l.first&&`${l.first}× 1º`,l.second&&`${l.second}× 2º`,l.third&&`${l.third}× 3º`].filter(Boolean).join(', ')}){i<Math.min(2,legends!.leaders.length-1)?';':''}</b>)}</>:'Resultado oficial de cada período, guardado no encerramento.'}</span>
     :<span className="hof-updated">{loaded&&<span>Última atualização: {clock(board!.updatedAt-offset)}</span>}{loaded&&board!.endsAt&&<b title="Fim do período (horário de Brasília)"><Timer size={13}/>Encerra em {countdown(endsIn??0)}</b>}</span>}
    {side!=='legends'&&loaded&&<Pager page={board!.page} pages={board!.pages} onPage={n=>{setPage(n);setSelected(null);audio.play('click');}}/>}
   </footer>
   {side!=='legends'&&loaded&&!board!.disabled&&<MyPlace board={board!} valueName={valueName}/>}
  </div>
 </section>;
 return createPortal(content,document.body);
}

/** The left stage: who is selected, standing on the aura and the pedestal of their place. */
function Stage({row,guild,valueName}:{row:HallRow|null;guild:boolean;valueName:string}){
 const {profile:me}=useGame();
 const place=row?.rank??0;
 return <>
  <section className="hof-stage" aria-label="Palco">
   <div className="hof-title"><img src="/assets/ui/hall-title-plate.webp" alt="" draggable={false}/><GoldWord id="hof-title" text="Hall da Fama" width={420} height={84} size={64}/></div>
   {row?<>
    <div className="hof-place">{place>=1&&place<=3?<GoldWord id={`hof-place-${place}`} text={`${place}º lugar`} width={280} height={100} size={66} depth={8}/>:<GoldWord id="hof-place-n" text={`${place}º lugar`} width={280} height={100} size={66} depth={8}/>}</div>
    <div className="hof-figure">
     <i className={`hof-sigil ${place>=1&&place<=3?SIGILS[place-1]:'gold'}`} aria-hidden="true"/>
     {guild?<GuildMark level={row.level} size={150}/>:row.equipment?<Avatar equipment={row.equipment} size={250} weapon/>:<LoaderCircle className="button-spinner" size={34}/>}
    </div>
   </>:<div className="hof-stage-empty"><Trophy size={40}/>O palco espera o primeiro campeão.</div>}
  </section>
  <div className="hof-plate">{row?<>
   <div className="hof-plate-name">{!guild&&row.level!==undefined&&<LevelBadge level={row.level} size={34}/>}<strong {...(!guild?playerMenuProps({id:row.id,name:row.name,context:'ranking'}):{})}>{row.name}</strong></div>
   <div className="hof-plate-info">
    <span><em>{valueName}</em><b>{valueName==='Poder'?<><PowerIcon size={16}/>{fmt(row.score)}</>:fmt(row.score)}</b></span>
    {guild?<span><em>Líder</em><b>{row.leader??'—'}</b></span>:<span><em>Guilda</em><b className="guild">{row.guild??'—'}</b></span>}
   </div>
   <div className="hof-plate-actions">
    {!guild&&row.id!==me?.id&&<button title="Ver equipamento" onClick={()=>{audio.play('click');client.openPlayerPanel('info',{id:row.id,name:row.name,context:'ranking'});}}><User size={14}/>Ver equipamento</button>}
   </div>
  </>:<p className="hof-muted">Ninguém neste ranking ainda.</p>}</div>
 </>;
}

function BoardTable({board,category,current,onPick}:{board:HallBoard;category:HallCategory;current?:string;onPick:(row:HallRow)=>void}){
 const cols=columns(category,board.board),guild=category==='guild',mine=board.me?.id;
 if(!board.rows.length)return <div className="hof-state"><Trophy size={30}/>{category==='pvp'||guild&&board.board!=='power'&&board.board!=='level'?'Ninguém pontuou ainda neste período. A primeira vitória abre o ranking!':'Ainda não há ninguém neste ranking.'}</div>;
 return <div className="hof-table-wrap"><table className="hof-table">
  <thead><tr><th>Rank</th><th>{guild?'Guilda':'Nome'}</th>{cols.map(c=><th key={c.label} className={c.main?'main':''}>{c.label}</th>)}</tr></thead>
  <tbody>{board.rows.map(row=><tr key={row.id} className={`${row.id===current?'current':''} ${row.id===mine?'mine':''}`} tabIndex={0} onClick={()=>onPick(row)} onKeyDown={e=>{if(e.key==='Enter')onPick(row);}} {...(!guild?playerMenuProps({id:row.id,name:row.name,context:'ranking'}):{})}>
   <td><RankMark rank={row.rank}/></td>
   <td className="hof-name"><strong>{row.name}</strong>{!guild&&row.guild&&<small><Shield size={10}/>{row.guild}</small>}{guild&&row.leader&&<small><Crown size={10}/>{row.leader}</small>}</td>
   {cols.map(c=><td key={c.label} className={c.main?'main':''}>{c.value(row)}</td>)}
  </tr>)}</tbody>
 </table>{board.note&&<p className="hof-note">{board.note}</p>}</div>;
}

function LegendsTable({ready,rows,guild,board,current,onPick}:{ready:boolean;rows:HallRow[];guild:boolean;board:LegendBoard;current?:string;onPick:(row:HallRow)=>void}){
 const {hallLegends:legends}=useGame();
 if(!ready)return <div className="hof-state"><LoaderCircle className="button-spinner" size={28}/>Carregando as lendas…</div>;
 if(!legends!.periods.length)return <div className="hof-state"><Scroll size={30}/>Nenhum período encerrado ainda. Os campeões aparecem aqui assim que {board==='pvp-day'?'o dia':'a semana'} terminar.</div>;
 return <div className="hof-table-wrap"><table className="hof-table">
  <thead><tr><th>Rank</th><th>{guild?'Guilda':'Nome'}</th>{guild?<><th className="main">Pontos</th><th>Vitórias</th></>:<><th className="main">Vitórias</th><th>Derrotas</th><th>Taxa</th></>}</tr></thead>
  <tbody>{rows.map(row=><tr key={row.id} className={row.id===current?'current':''} tabIndex={0} onClick={()=>onPick(row)} onKeyDown={e=>{if(e.key==='Enter')onPick(row);}}>
   <td><RankMark rank={row.rank}/></td><td className="hof-name"><strong>{row.name}</strong>{!guild&&row.guild&&<small><Shield size={10}/>{row.guild}</small>}</td>
   {guild?<><td className="main">{fmt(row.score)}</td><td>{fmt(row.wins)}</td></>:<><td className="main">{fmt(row.wins)}</td><td>{fmt(row.losses)}</td><td>{pct(row.winRate)}</td></>}
  </tr>)}</tbody>
 </table></div>;
}

function Pager({page,pages,onPage}:{page:number;pages:number;onPage:(page:number)=>void}){
 return <nav className="hof-pager" aria-label="Páginas">
  <button disabled={page<=1} onClick={()=>onPage(page-1)}><ChevronLeft size={15}/>Anterior</button>
  <b>{page}/{Math.max(1,pages)}</b>
  <button disabled={page>=pages} onClick={()=>onPage(page+1)}>Próximo<ChevronRight size={15}/></button>
 </nav>;
}

function MyPlace({board,valueName}:{board:HallBoard;valueName:string}){
 const me=board.me,guild=board.category==='guild';
 return <footer className="hof-me">
  <h3>{guild?'Minha guilda':'Meu ranking'}</h3>
  {!me?<p>{guild?'Você ainda não faz parte de uma guilda.':'Sua classificação aparece aqui depois da sua primeira atualização.'}</p>:<div className="hof-me-cells">
   <span><em>Rank</em><b>{me.rank>0?fmt(me.rank):'—'}</b></span>
   <span><em>{valueName}</em><b>{fmt(me.score)}</b></span>
   {board.category==='pvp'&&<><span><em>Derrotas</em><b>{fmt(me.losses)}</b></span><span><em>Taxa</em><b>{pct(me.winRate)}</b></span>{!!me.streak&&<span><em>Sequência</em><b><Flame size={13}/>{me.streak}</b></span>}</>}
   {me.rank>board.topSize&&<small>fora do Top {board.topSize}</small>}
  </div>}
 </footer>;
}
