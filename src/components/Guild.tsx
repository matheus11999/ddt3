import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpCircle,Check,ChevronDown,ChevronLeft,ChevronRight,ChevronUp,Coins,Crown,Hammer,LoaderCircle,LockKeyhole,LogOut,PackageOpen,PackagePlus,ArrowDownCircle,IdCard,Search,Settings,Shield,ShoppingBag,Trash2,UserMinus,UserPlus,Users,Warehouse,X} from 'lucide-react';
import {CATALOG,SLOT_NAMES} from '../../shared/catalog';
import {goodsName} from '../../shared/auction';
import {BUILDING_LEVEL_COSTS,BUILDING_NAMES,canRaiseBuilding,GUILD_BUILDINGS,GUILD_CREATE_COST,GUILD_LEVEL_COSTS,GUILD_MAX_LEVEL,GUILD_MISSIONS,GUILD_NAME_MAX,GUILD_PERMISSIONS,GUILD_SHOP,guildMemberCap,LEADER_RANK,PERMISSION_NAMES,RANK_NAME_MAX,RANK_NAME_MIN,rankCan,smithBonus,SMITH_BONUS_PER_LEVEL,storageCapacity} from '../../shared/guilds';
import type {GuildBuilding,GuildMember,GuildPermission,GuildRank,GuildView} from '../../shared/guilds';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {bagGoods,GoodsArt,GoodsCard} from './Auction';
import {Avatar} from './Avatar';
import {BagContextMenu} from './ColorStudio';
import {InventoryTooltip} from './Inventory';
import type {Tip} from './Inventory';
import {ItemCard,ItemCardFrame} from './ItemCard';
import {ItemIcon} from './ItemIcon';
import {Modal} from './Modal';
import {playerMenuProps} from './PlayerActions';
import {RewardIcon} from './RewardIcon';
import {UpgradeTag} from './UpgradeTag';
import './Backpack.css';
import './WoodTheme.css';
import './Shop.css';
import './Guild.css';

/* Guildas no padrão da mochila: madeira laranja e painéis creme. Sem guilda: fundar uma (ouro) ou pedir
   para entrar. Com guilda: as três construções clicáveis (Loja, Ferreiro, Depósito), membros e, para o dono,
   o gerenciamento com as melhorias pagas em Riqueza, a moeda que só existe dentro da guilda. */
const money=(value:number)=>value.toLocaleString('pt-BR');
const BUILDING_ART:Record<GuildBuilding,string>={shop:'/assets/ui/guild-shop.png',smith:'/assets/ui/guild-smith.png',storage:'/assets/ui/guild-storage.png'};
const BUILDING_FALLBACK:Record<GuildBuilding,string>={shop:'/assets/ui/shop-button.png',smith:'/assets/ui/forge-button.png',storage:'/assets/ui/backpack-button.png'};
const BUILDING_ICONS={shop:ShoppingBag,smith:Hammer,storage:Warehouse};
const SHORT_NAMES:Record<GuildBuilding,string>={shop:'Loja',smith:'Ferreiro',storage:'Depósito'};
const PERMISSION_SHORT:Record<GuildPermission,string>={recruit:'Recrutar',kick:'Expulsar',promote:'Cargos',upgrade:'Evoluir',withdraw:'Retirar'};
function buildingEffect(building:GuildBuilding,level:number){
 if(building==='smith')return level?`+${smithBonus(level)}% de sucesso no ferreiro`:'Sem bônus no ferreiro';
 if(building==='shop')return level?`${GUILD_SHOP.filter(o=>o.level<=level).length} ${GUILD_SHOP.filter(o=>o.level<=level).length===1?'item à venda':'itens à venda'}`:'Fechada';
 return level?`Guarda ${storageCapacity(level)} itens`:'Fechado';
}
function nextEffect(building:GuildBuilding,level:number){
 if(building==='smith')return `+${SMITH_BONUS_PER_LEVEL}% de sucesso (total ${smithBonus(level+1)}%)`;
 if(building==='shop'){const unlocked=GUILD_SHOP.filter(o=>o.level===level+1);return unlocked.length?`Libera ${unlocked.map(o=>CATALOG[o.id]?.name).join(', ')}`:'Novos itens nas próximas atualizações';}
 return `Guarda ${storageCapacity(level+1)} itens`;
}
function BuildingArt({building,size=96}:{building:GuildBuilding;size?:number}){
 const [src,setSrc]=useState(BUILDING_ART[building]);
 return <img className="guild-building-art" src={src} width={size} height={size} alt="" draggable={false} onError={()=>setSrc(BUILDING_FALLBACK[building])}/>;
}
function RiquezaIcon({size=18}:{size?:number}){return <Coins className="guild-riqueza-icon" size={size} aria-hidden="true"/>;}

export function Guild({onForge}:{onForge:()=>void}){
 const {guild:state,guildTab:tab,guildMessage:message,profile}=useGame(),p=profile!;
 useEffect(()=>{if(!message)return;audio.play('click');const t=setTimeout(()=>client.update({guildMessage:null}),3200);return()=>clearTimeout(t);},[message]);
 const guild=state?.guild??null,manager=!!guild&&(guild.myRank===LEADER_RANK||rankCan(guild.ranks,guild.myRank,'upgrade')||rankCan(guild.ranks,guild.myRank,'recruit'));
 const closeSub=()=>{client.update({guildTab:'home'});audio.play('click');};
 const toast=message&&<div className="guild-toast" role="status"><Check size={18}/>{message.text}</div>;
 return <>
  <Modal title={guild?'Guilda':'Guildas'} onClose={()=>client.closeGuild()} className="bag-window guild-window" viewport>
   {!state?<div className="guild-loading"><LoaderCircle className="guild-spin" size={26}/>Abrindo a guilda…</div>
    :!guild?<GuildLobby applied={state.applied}/>
    :<GuildHome guild={guild} manager={manager} onForge={onForge}/>}
   {tab==='home'&&toast}
  </Modal>
  {guild&&tab==='shop'&&<GuildShop guild={guild} onClose={closeSub} toast={toast}/>}
  {guild&&tab==='storage'&&<Modal title={BUILDING_NAMES.storage} onClose={closeSub} className="bag-window guild-window guild-sub-window" viewport><GuildStorage guild={guild}/>{toast}</Modal>}
  {guild&&manager&&tab==='manage'&&<Modal title="Gerenciar guilda" onClose={closeSub} className="bag-window guild-window guild-sub-window" viewport><GuildManage guild={guild}/>{toast}</Modal>}
 </>;
}

/** No guild yet: found one with gold, or ask to join one from the list. */
function GuildLobby({applied}:{applied:number[]}){
 const {guildList:list,guildPending:pending,profile}=useGame(),p=profile!;
 const [name,setName]=useState(''),[search,setSearch]=useState('');
 useEffect(()=>{client.send({type:'guild-list'});},[]);
 const clean=name.trim(),valid=clean.length>=3&&clean.length<=GUILD_NAME_MAX,afford=p.gold>=GUILD_CREATE_COST;
 return <div className="guild-lobby">
  <form className="guild-pane guild-create wood-cream" onSubmit={e=>{e.preventDefault();if(valid&&afford)client.guildAction({type:'guild-create',name:clean});}}>
   <span className="guild-create-emblem" aria-hidden="true"><Shield size={46}/></span>
   <h3>Fundar uma guilda</h3>
   <p>A guilda começa no nível 0. Vitórias em batalhas GvG rendem Riqueza, que o dono usa para evoluir a guilda, a Loja, o Ferreiro e o Depósito.</p>
   <label className="guild-field"><span>Nome da guilda</span><input value={name} maxLength={GUILD_NAME_MAX} placeholder="Ex.: Brasa Eterna" onChange={e=>setName(e.target.value)}/></label>
   <p className="guild-cost">Custo: <RewardIcon size={18}/><b>{money(GUILD_CREATE_COST)}</b> de ouro{!afford&&<em> · ouro insuficiente</em>}</p>
   <button className="wood-button guild-submit" disabled={!valid||!afford||pending}>{pending?<LoaderCircle size={17} className="button-spinner"/>:<Crown size={17}/>}Fundar guilda</button>
  </form>
  <section className="guild-pane guild-browse wood-cream" aria-label="Guildas">
   <form className="guild-search" onSubmit={e=>{e.preventDefault();client.send({type:'guild-list',...(search.trim()?{search:search.trim()}:{})});}}><Search size={16}/><input value={search} maxLength={GUILD_NAME_MAX} placeholder="Buscar guilda" aria-label="Buscar guilda" onChange={e=>setSearch(e.target.value)}/><button className="wood-quiet">Buscar</button></form>
   {!list?<p className="guild-empty"><LoaderCircle className="guild-spin" size={22}/>Carregando guildas…</p>
    :list.length?<ul className="guild-list">{list.map(g=>{const asked=applied.includes(g.id),full=g.members>=g.capacity;return <li key={g.id}>
     <span className="guild-list-emblem"><Shield size={22}/><b>{g.level}</b></span>
     <span className="guild-list-name"><b>{g.name}</b><small>Dono: {g.ownerName}</small></span>
     <span className="guild-list-members"><Users size={14}/>{g.members}/{g.capacity}</span>
     {asked?<button className="wood-quiet" disabled={pending} title="Cancelar pedido" onClick={()=>client.send({type:'guild-cancel-apply',id:g.id})}><X size={15}/>Pedido enviado</button>
      :<button className="wood-button" disabled={pending||full} onClick={()=>client.guildAction({type:'guild-apply',id:g.id})}><UserPlus size={15}/>{full?'Cheia':'Pedir para entrar'}</button>}
    </li>;})}</ul>
    :<p className="guild-empty"><Shield size={28}/>Nenhuma guilda ainda. Funde a primeira!</p>}
  </section>
 </div>;
}

type SortKey='contribution'|'today'|'level'|'name'|'rank';

/** Tela inicial: cabeçalho com o brasão, o nível, o nome, os membros e a Riqueza; abaixo as construções, os membros e as missões do dia. */
function GuildHome({guild,manager,onForge}:{guild:GuildView;manager:boolean;onForge:()=>void}){
 const {room}=useGame();
 const open=(building:GuildBuilding)=>{
  if(building==='smith'){onForge();return;}
  client.update({guildTab:building});audio.play('click');
 };
 const leader=guild.ranks[LEADER_RANK]?.name??'Líder';
 return <div className="guild-page">
  <header className="guild-banner" aria-label={`Guilda ${guild.name}, nível ${guild.level}`}>
   <span className="guild-crest-badge" aria-hidden="true"><Shield className="guild-crest-shield" size={70} strokeWidth={1.4}/><b className="guild-crest-level">{guild.level}</b></span>
   <div className="guild-banner-name"><h2 className="guild-crest-name">{guild.name}</h2><span className="guild-crest-owner"><Crown size={13}/>{leader}: {guild.ownerName||'—'}</span></div>
   <div className="guild-crest-stats">
    <span title="Nível da guilda"><Shield size={15}/>Nível {guild.level}</span>
    <span title="Membros"><Users size={15}/>{guild.members.length} / {guildMemberCap(guild.level)}</span>
    <span title="Riqueza: moeda da guilda, usada para evoluir a guilda e as construções."><RiquezaIcon size={16}/>{money(guild.riqueza)}</span>
   </div>
  </header>
  <div className="guild-main">
   <aside className="guild-side">
    <div className="guild-buildings">{GUILD_BUILDINGS.map(building=>{const level=guild.buildings[building],Icon=BUILDING_ICONS[building],blocked=!level||building==='smith'&&!!room;
     return <button key={building} className={`guild-building ${level?'':'unbuilt'}`} disabled={blocked} title={!level?`${SHORT_NAMES[building]} ainda não foi construído.`:blocked?'Volte à praça para usar o ferreiro':buildingEffect(building,level)} onClick={()=>open(building)}>
      <span className="guild-building-stage"><BuildingArt building={building} size={64}/></span>
      <span className="guild-building-plate"><Icon size={14}/><b>{SHORT_NAMES[building]}</b></span>
      <em>Nv. {level}</em>
     </button>;})}</div>
    <div className="guild-side-actions">
     {manager&&<button className="wood-button guild-manage-button" onClick={()=>{client.update({guildTab:'manage'});audio.play('click');}}><Settings size={16}/>Gerenciar{!!guild.applications?.length&&<b className="guild-count">{guild.applications.length}</b>}</button>}
     <LeaveGuild guild={guild}/>
    </div>
   </aside>
   <GuildRoster guild={guild}/>
   <GuildMissions guild={guild}/>
  </div>
 </div>;
}

function LeaveGuild({guild}:{guild:GuildView}){
 const {profile,guildPending:pending}=useGame(),owner=guild.ownerId===profile!.id,alone=guild.members.length===1;
 const [leaving,setLeaving]=useState(false);
 if(!leaving)return <button className="wood-quiet guild-leave" onClick={()=>setLeaving(true)}><LogOut size={15}/>Sair</button>;
 return <div className="guild-confirm-layer" onPointerDown={e=>{if(e.target===e.currentTarget)setLeaving(false);}}><section className="guild-confirm" role="alertdialog" aria-label="Sair da guilda">
  <strong>Sair da guilda?</strong>
  <p>{owner&&alone?'Você é o último membro: a guilda será encerrada e o depósito volta para você.':owner?'A guilda passa para o membro com mais contribuição.':'Sua contribuição fica com a guilda.'}</p>
  <div><button className="wood-quiet" onClick={()=>setLeaving(false)}>Voltar</button><button className="wood-button guild-danger" disabled={pending} onClick={()=>{client.guildAction({type:'guild-leave'});setLeaving(false);}}>Sair da guilda</button></div>
 </section></div>;
}

/** Membros com as contribuições, ordenados pela setinha de cada título; sem barra de rolagem: cada página tem as linhas que cabem. */
function GuildRoster({guild}:{guild:GuildView}){
 const {profile,guildPending:pending}=useGame(),me=profile!.id,mine=guild.myRank,canKick=rankCan(guild.ranks,mine,'kick'),canPromote=rankCan(guild.ranks,mine,'promote');
 const [menu,setMenu]=useState<{member:GuildMember;x:number;y:number}|null>(null),[kicking,setKicking]=useState<GuildMember|null>(null);
 const [sort,setSort]=useState<SortKey>('contribution'),[desc,setDesc]=useState(true),[page,setPage]=useState(0),[pageSize,setPageSize]=useState(10);
 const box=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const element=box.current;if(!element)return;
  const fit=()=>{const head=element.querySelector('thead')?.getBoundingClientRect().height??30,row=element.querySelector('tbody tr')?.getBoundingClientRect().height||32;setPageSize(Math.max(3,Math.floor((element.clientHeight-head)/row)));};
  fit();const observer=new ResizeObserver(fit);observer.observe(element);return()=>observer.disconnect();
 },[]);
 const rows=useMemo(()=>{
  const ranked=[...guild.members].sort((a,b)=>b.contribution-a.contribution||a.name.localeCompare(b.name)).map((m,i)=>({...m,place:i+1}));
  const value=(m:typeof ranked[number])=>sort==='name'?0:sort==='rank'?-m.rank:m[sort];
  return ranked.sort((a,b)=>{const d=sort==='name'?a.name.localeCompare(b.name,'pt-BR'):value(a)-value(b);return (desc?-d:d)||a.place-b.place;});
 },[guild.members,sort,desc]);
 const pages=Math.max(1,Math.ceil(rows.length/pageSize)),current=Math.min(page,pages-1),visible=rows.slice(current*pageSize,(current+1)*pageSize);
 const by=(key:SortKey)=>{if(key===sort)setDesc(!desc);else{setSort(key);setDesc(key!=='name');}setPage(0);audio.play('click');};
 const head=(key:SortKey,label:string,className='')=><th className={className} aria-sort={sort===key?(desc?'descending':'ascending'):'none'}><button onClick={()=>by(key)}>{label}{sort===key?(desc?<ChevronDown size={13}/>:<ChevronUp size={13}/>):<ChevronDown size={13} className="guild-sort-idle"/>}</button></th>;
 const online=guild.members.filter(m=>m.online).length;
 return <section className="guild-pane guild-roster wood-cream" aria-label="Membros">
  <header className="guild-roster-head">
   <h3>Membros <small>{online} online</small></h3>
   {pages>1&&<div className="guild-pager"><button aria-label="Página anterior" disabled={current===0} onClick={()=>setPage(current-1)}><ChevronLeft size={15}/></button><span>{current+1} / {pages}</span><button aria-label="Próxima página" disabled={current===pages-1} onClick={()=>setPage(current+1)}><ChevronRight size={15}/></button></div>}
  </header>
  <div className="guild-roster-box" ref={box}>
   <table className="guild-table with-actions">
    <colgroup><col className="c-rank"/><col/><col className="c-role"/><col className="c-level"/><col className="c-today"/><col className="c-total"/><col className="c-act"/></colgroup>
    <thead><tr><th>#</th>{head('name','Membro')}{head('rank','Cargo')}{head('level','Nível')}{head('today','Hoje')}{head('contribution','Total')}<th aria-label="Opções"/></tr></thead>
    <tbody>{visible.map(m=><tr key={m.id} className={m.id===me?'me':''}>
     <td className="guild-rank"><span data-rank={m.place<=3?m.place:undefined}>{m.place}</span></td>
     <td><span className="guild-member"><span className={`guild-dot ${m.online?'on':''}`} title={m.online?'Online':'Offline'}/><b title={m.name} {...playerMenuProps(m.id!==me?{id:m.id,name:m.name,context:'hall'}:null)}>{m.name}</b>{m.rank===LEADER_RANK&&<Crown className="guild-owner-crown" size={14} aria-label={guild.ranks[0].name}/>}</span></td>
     <td className="guild-role-cell"><span className={`guild-role ${m.rank===LEADER_RANK?'owner':''}`} data-rank={m.rank}>{guild.ranks[m.rank]?.name}</span></td>
     <td>{m.level}</td>
     <td className="guild-num">{m.today?`+${money(m.today)}`:'0'}</td>
     <td className="guild-num"><RiquezaIcon size={14}/> {money(m.contribution)}</td>
     <td>{m.id!==me&&<button className="guild-icon-button guild-gear" title="Opções" aria-label={`Opções de ${m.name}`} aria-haspopup="menu" aria-expanded={menu?.member.id===m.id} onClick={e=>{const box=e.currentTarget.getBoundingClientRect();setMenu({member:m,x:box.right-4,y:box.bottom+4});audio.play('click');}}><Settings size={15}/></button>}</td>
    </tr>)}</tbody></table>
  </div>
  {menu&&createPortal(<BagContextMenu x={menu.x} y={menu.y} title={menu.member.name} onClose={()=>setMenu(null)} actions={memberActions(menu.member)}/>,document.body)}
  {kicking&&<div className="guild-confirm-layer" onPointerDown={e=>{if(e.target===e.currentTarget)setKicking(null);}}><section className="guild-confirm" role="alertdialog" aria-label={`Expulsar ${kicking.name}`}>
   <strong>Expulsar {kicking.name}?</strong>
   <p>A contribuição de {kicking.name} fica com a guilda.</p>
   <div><button className="wood-quiet" onClick={()=>setKicking(null)}>Voltar</button><button className="wood-button guild-danger" disabled={pending} onClick={()=>{client.guildAction({type:'guild-kick',playerId:kicking.id});setKicking(null);}}>Expulsar</button></div>
  </section></div>}
 </section>;
 /** Ver informações for everyone; promote, demote and kick only on members below the viewer's rank. */
 function memberActions(m:GuildMember){
  const below=m.rank>mine,up=guild.ranks[m.rank-1],down=guild.ranks[m.rank+1],rank=(r:number)=>()=>{client.guildAction({type:'guild-rank-set',playerId:m.id,rank:r});audio.play('click');};
  return [
   {id:'info',label:'Ver informações',icon:<IdCard size={16}/>,onSelect:()=>{client.openPlayerPanel('info',{id:m.id,name:m.name,context:'hall'});audio.play('click');}},
   ...(canPromote&&below&&up&&up.id>mine?[{id:'promote',label:`Promover a ${up.name}`,icon:<ArrowUpCircle size={16}/>,disabled:pending,onSelect:rank(up.id)}]:[]),
   ...(canPromote&&below&&down?[{id:'demote',label:`Rebaixar a ${down.name}`,icon:<ArrowDownCircle size={16}/>,disabled:pending,onSelect:rank(down.id)}]:[]),
   ...(canKick&&below?[{id:'kick',label:'Expulsar',icon:<UserMinus size={16}/>,danger:true,disabled:pending,onSelect:()=>setKicking(m)}]:[]),
  ];
 }
}

/** Missões diárias: cada uma concluída e recebida soma contribuição ao membro e a mesma Riqueza à guilda. */
function GuildMissions({guild}:{guild:GuildView}){
 const {guildPending:pending}=useGame(),daily=guild.daily;
 return <section className="guild-pane guild-missions wood-cream" aria-label="Missões diárias">
  <h3>Missões diárias <small>renovam à meia-noite</small></h3>
  <ul>{GUILD_MISSIONS.map(m=>{const done=Math.min(m.goal,daily.progress[m.id]??0),claimed=daily.claimed.includes(m.id),ready=done>=m.goal&&!claimed;
   return <li key={m.id} className={claimed?'claimed':ready?'ready':''} data-mission={m.id}>
    <span className="guild-mission-text"><b>{m.name}</b><span className="guild-mission-bar" role="progressbar" aria-valuemin={0} aria-valuemax={m.goal} aria-valuenow={done}><i style={{width:`${done/m.goal*100}%`}}/><em>{done}/{m.goal}</em></span></span>
    <span className="guild-mission-reward" title="Contribuição para você e Riqueza para a guilda"><RiquezaIcon size={15}/>+{m.reward}</span>
    {claimed?<span className="guild-mission-done"><Check size={15}/>Feita</span>
     :<button className="wood-button" disabled={!ready||pending} onClick={()=>client.guildAction({type:'guild-mission',mission:m.id})}>Receber</button>}
   </li>;})}</ul>
  <footer className="guild-missions-foot">Sua contribuição hoje: <RiquezaIcon size={15}/><b>{money(daily.today)}</b></footer>
 </section>;
}

/** Loja da Guilda com cara de loja: o provador com o personagem à esquerda, a vitrine com os cards e a confirmação da loja. */
function GuildShop({guild,onClose,toast}:{guild:GuildView;onClose:()=>void;toast:ReactNode}){
 const {guildPending:pending,profile,room,battle}=useGame(),p=profile!,level=guild.buildings.shop;
 const [confirm,setConfirm]=useState<string|null>(null),[tip,setTip]=useState<Tip|null>(null);
 const locked=pending||!!room||!!battle;
 useEffect(()=>{
  if(!tip)return;const dismiss=()=>setTip(null);window.addEventListener('scroll',dismiss,true);window.addEventListener('resize',dismiss);
  return()=>{window.removeEventListener('scroll',dismiss,true);window.removeEventListener('resize',dismiss);};
 },[tip]);
 const upcoming=Array.from({length:Math.max(0,4-GUILD_SHOP.length)},(_,i)=>Math.max(level,...GUILD_SHOP.map(o=>o.level))+i+1).filter(l=>l<=GUILD_MAX_LEVEL);
 const pick=confirm?CATALOG[confirm]:null,price=confirm?GUILD_SHOP.find(o=>o.id===confirm)!.price:0;
 return <Modal title={BUILDING_NAMES.shop} onClose={onClose} className="shop-window guild-shop-window" viewport>
  <div className="shop-layout">
   <aside className="shop-fitting" aria-label="Provador da loja">
    <header className="shop-fitting-head">
     <span className="guild-emblem" aria-hidden="true"><Shield size={26}/><b>{guild.level}</b></span>
     <div className="shop-identity"><small>{guild.name}</small><h2>{p.name}</h2></div>
    </header>
    <div className="shop-stage">
     <Avatar equipment={p.equipment} size={290} animated={false}/>
     <div className="shop-preview-caption"><span>Só para membros</span></div>
    </div>
    <footer className="shop-purse"><RewardIcon size={30}/><div><small>Moedas Brasa</small><strong>{money(p.gold)}</strong></div></footer>
   </aside>
   <section className="shop-pane" aria-label="Vitrine da Loja da Guilda">
    <div className="shop-toolbar guild-shop-toolbar">
     <span className="guild-shop-sign"><BuildingArt building="shop" size={34}/><b>Loja Nv. {level}</b></span>
     <span className="shop-count">{level?'Itens pagos em ouro':'A loja abre no nível 1'}</span>
    </div>
    <div className="shop-shelf">
     <div className="shop-grid">
      {GUILD_SHOP.map(offer=>{const item=CATALOG[offer.id],closed=level<offer.level,short=offer.price>p.gold;return <article key={offer.id} className={`shop-offer ${closed?'guild-offer-locked':''}`} data-shop-item={offer.id}>
       <ItemCard aria-label={item.name} aria-describedby={tip?.id===offer.id?'item-tooltip':undefined}
        onMouseEnter={e=>setTip({id:offer.id,anchor:e.currentTarget,mode:'hover'})} onMouseLeave={()=>setTip(t=>t?.mode==='touch'?t:null)}
        onClick={e=>{const anchor=e.currentTarget;setTip(t=>t?.id===offer.id&&t.mode==='touch'?null:{id:offer.id,anchor,mode:'touch'});}}><ItemIcon id={offer.id} upgrade={0} size={64}/></ItemCard>
       <div className="shop-offer-info"><h2>{item.name}</h2><small>{SLOT_NAMES[item.slot]}{item.hpPercent?` · +${item.hpPercent}% de Vida`:''}</small></div>
       <div className="shop-offer-buy">
        {closed?<span className="guild-offer-lock"><LockKeyhole size={14}/>Loja Nv. {offer.level}</span>:<>
         <span className={`shop-price ${short?'short':''}`}><RewardIcon size={20}/>{money(offer.price)}</span>
         <div className="shop-offer-actions"><button className="shop-buy" disabled={locked||short} aria-label={`Comprar ${item.name}`} title={short?'Moedas Brasa insuficientes':'Comprar'} onClick={()=>{setTip(null);setConfirm(offer.id);audio.play('click');}}><ShoppingBag size={17}/></button></div>
        </>}
       </div>
      </article>;})}
      {upcoming.map(l=><article key={`soon-${l}`} className="shop-offer guild-offer-soon" aria-label={`Novidade na Loja Nv. ${l}`}>
       <ItemCardFrame empty variant="slot"><LockKeyhole size={26}/></ItemCardFrame>
       <div className="shop-offer-info"><h2>Em breve</h2><small>Novos itens nas próximas melhorias</small></div>
       <div className="shop-offer-buy"><span className="guild-offer-lock"><LockKeyhole size={14}/>Loja Nv. {l}</span></div>
      </article>)}
     </div>
     <nav className="shop-tabs" aria-label="Categorias da loja"><button className="active" aria-pressed="true"><Shield size={19} aria-hidden="true"/><span>Guilda</span></button></nav>
    </div>
   </section>
   {pick&&<div className="shop-confirm-layer" onPointerDown={e=>{if(e.target===e.currentTarget)setConfirm(null);}}>
    <section className="shop-confirm" role="alertdialog" aria-modal="true" aria-label="Confirmar compra">
     <header><strong>Confirmar compra</strong><button className="wood-close" aria-label="Fechar confirmação" onClick={()=>setConfirm(null)}><X size={18}/></button></header>
     <div className="shop-confirm-body">
      <div className="shop-confirm-showcase"><i aria-hidden="true"/><ItemCardFrame variant="detail"><ItemIcon id={pick.id} upgrade={0} size={84}/></ItemCardFrame></div>
      <b className="shop-confirm-name">{pick.name}</b>
      <span className="shop-confirm-kind">{SLOT_NAMES[pick.slot]}</span>
      <dl className="shop-confirm-cost">
       <div><dt>Preço</dt><dd><RewardIcon size={22}/>{money(price)}</dd></div>
       <div><dt>Seu saldo</dt><dd><RewardIcon size={22}/>{money(p.gold)}</dd></div>
       <div className="after"><dt>Depois da compra</dt><dd><RewardIcon size={22}/>{money(p.gold-price)}</dd></div>
      </dl>
     </div>
     <footer><button className="wood-quiet" onClick={()=>setConfirm(null)}>Cancelar</button><button className="wood-button" disabled={locked} onClick={()=>{client.guildAction({type:'guild-buy',item:pick.id});setConfirm(null);}}><ShoppingBag size={18}/>Comprar</button></footer>
    </section>
   </div>}
  </div>
  {tip&&createPortal(<InventoryTooltip tip={tip} gender={p.gender} equipment={p.equipment} upgrades={{}} compositions={p.compositions} hideGender action={`Exclusivo da guilda · ${money(GUILD_SHOP.find(o=>o.id===tip.id)?.price??0)} Moedas Brasa`}/>,document.body)}
  {toast}
 </Modal>;
}

/** Shared Depósito: any member puts unworn items in, any member takes them out. */
function GuildStorage({guild}:{guild:GuildView}){
 const {guildPending:pending,profile}=useGame(),p=profile!,capacity=storageCapacity(guild.buildings.storage);
 const [picking,setPicking]=useState(false);const goods=useMemo(()=>bagGoods(p,true),[p]);
 const full=guild.storage.length>=capacity,canWithdraw=rankCan(guild.ranks,guild.myRank,'withdraw');
 return <div className="guild-storage">
  <div className="guild-section-head"><BuildingArt building="storage" size={58}/><div><h3>{BUILDING_NAMES.storage} · Nv. {guild.buildings.storage}</h3><small>{capacity?`${guild.storage.length} de ${capacity} espaços. Qualquer membro pode guardar e retirar.`:'Fechado. O dono constrói o depósito em Gerenciar.'}</small></div>
   <button className="wood-button" disabled={!capacity||full||pending} onClick={()=>{setPicking(true);audio.play('click');}}><PackagePlus size={17}/>Guardar item</button></div>
  <div className="guild-storage-grid wood-cream">{Array.from({length:Math.max(capacity,10)},(_,i)=>{const stored=guild.storage[i];
   if(stored)return <ItemCard key={stored.id} className="guild-storage-cell" title={`${goodsName(stored.goods)} · guardado por ${stored.by}.${canWithdraw?' Clique para retirar.':' Seu cargo não pode retirar itens.'}`} disabled={pending||!canWithdraw} onClick={()=>client.guildAction({type:'guild-withdraw',id:stored.id})}>
    <GoodsArt goods={stored.goods} size={48}/>{stored.goods.kind==='item'&&!!stored.goods.upgrade&&<UpgradeTag level={stored.goods.upgrade} size={26} className="bag-upgrade-tag"/>}{stored.goods.kind!=='item'&&stored.goods.amount>1&&<b className="guild-cell-count">{money(stored.goods.amount)}</b>}</ItemCard>;
   return <ItemCardFrame key={`empty-${i}`} empty variant="slot" className={`guild-storage-cell ${i>=capacity?'locked':''}`}/>;})}</div>
  {picking&&<div className="guild-confirm-layer" onPointerDown={e=>{if(e.target===e.currentTarget)setPicking(false);}}><section className="guild-confirm guild-picker" role="dialog" aria-label="Guardar item">
   <header><strong>Guardar no depósito</strong><button type="button" className="wood-close" aria-label="Fechar" onClick={()=>setPicking(false)}><X size={18}/></button></header>
   {goods.length?<div className="guild-picker-grid">{goods.map(g=><ItemCard key={g.key} className="guild-storage-cell" title={goodsName(g.goods)} onClick={()=>{client.guildAction({type:'guild-deposit',source:g.source.kind==='item'?g.source:{...g.source,amount:g.owned}});setPicking(false);}}>
    <GoodsArt goods={g.goods} size={48}/>{g.goods.kind==='item'&&!!g.goods.upgrade&&<UpgradeTag level={g.goods.upgrade} size={26} className="bag-upgrade-tag"/>}{g.owned>1&&<b className="guild-cell-count">{money(g.owned)}</b>}</ItemCard>)}</div>
    :<p className="guild-empty"><PackageOpen size={26}/>Nada para guardar. Itens equipados ficam com você.</p>}
  </section></div>}
 </div>;
}

type ManageTab='upgrade'|'requests'|'ranks';
/** Gerenciar: cada parte aparece para quem o cargo permite; Cargos e Excluir guilda são só do líder. */
function GuildManage({guild}:{guild:GuildView}){
 const leader=guild.myRank===LEADER_RANK,can=(perm:GuildPermission)=>rankCan(guild.ranks,guild.myRank,perm);
 const tabs=([['upgrade','Evoluir',can('upgrade')],['requests','Pedidos',can('recruit')],['ranks','Cargos',leader]] as [ManageTab,string,boolean][]).filter(t=>t[2]);
 const [tab,setTab]=useState<ManageTab>(tabs[0]?.[0]??'upgrade'),current=tabs.some(t=>t[0]===tab)?tab:tabs[0]?.[0];
 return <div className="guild-manage">
  <nav className="guild-manage-tabs">{tabs.map(([id,label])=><button key={id} className={current===id?'active':''} aria-pressed={current===id} onClick={()=>{setTab(id);audio.play('click');}}>{label}{id==='requests'&&!!guild.applications?.length&&<b className="guild-count">{guild.applications.length}</b>}</button>)}</nav>
  {current==='upgrade'&&<GuildUpgrades guild={guild}/>}
  {current==='requests'&&<GuildRequests guild={guild}/>}
  {current==='ranks'&&<GuildRanks guild={guild}/>}
 </div>;
}

function GuildUpgrades({guild}:{guild:GuildView}){
 const {guildPending:pending}=useGame();
 const rows:{target:'guild'|GuildBuilding;name:string;level:number;cost:number|undefined;effect:string;blocked:string}[]=[
  {target:'guild',name:'Guilda',level:guild.level,cost:GUILD_LEVEL_COSTS[guild.level],effect:`Até ${guildMemberCap(guild.level+1)} membros e construções até o nível ${guild.level+1}`,blocked:guild.level>=GUILD_MAX_LEVEL?'Nível máximo':''},
  ...GUILD_BUILDINGS.map(building=>{const level=guild.buildings[building];return {target:building,name:SHORT_NAMES[building],level,cost:BUILDING_LEVEL_COSTS[level],effect:nextEffect(building,level),
   blocked:level>=GUILD_MAX_LEVEL?'Nível máximo':canRaiseBuilding(guild.level,level)?'':`Evolua a guilda para o nível ${level+1}`};})];
 return <section className="guild-pane wood-cream guild-upgrades" aria-label="Melhorias">
  <h3>Evoluir <small>Riqueza disponível: <RiquezaIcon size={15}/> {money(guild.riqueza)}</small></h3>
  <ul>{rows.map(row=>{const afford=row.cost!==undefined&&guild.riqueza>=row.cost;return <li key={row.target} data-target={row.target}>
   <span className="guild-upgrade-art">{row.target==='guild'?<span className="guild-emblem small"><Shield size={22}/><b>{row.level}</b></span>:<BuildingArt building={row.target} size={46}/>}</span>
   <span className="guild-upgrade-text"><b>{row.name} <em>Nv. {row.level}{!row.blocked&&` → ${row.level+1}`}</em></b><small>{row.blocked||row.effect}</small></span>
   {!row.blocked&&<span className={`guild-upgrade-cost ${afford?'':'short'}`}><RiquezaIcon size={15}/>{money(row.cost??0)}</span>}
   <button className="wood-button" disabled={!!row.blocked||!afford||pending} onClick={()=>client.guildAction({type:'guild-upgrade',target:row.target})}><ArrowUpCircle size={16}/>Evoluir</button>
  </li>;})}</ul>
 </section>;
}

function GuildRequests({guild}:{guild:GuildView}){
 const {guildPending:pending}=useGame();
 return <section className="guild-pane wood-cream guild-applications" aria-label="Pedidos para entrar">
  <h3>Pedidos para entrar <small>{guild.members.length} / {guildMemberCap(guild.level)} membros</small></h3>
  {guild.applications?.length?<ul>{guild.applications.map(a=><li key={a.playerId}>
   <span><b {...playerMenuProps({id:a.playerId,name:a.name,context:'hall'})}>{a.name}</b><small>Nível {a.level}</small></span>
   <button className="wood-quiet" disabled={pending} onClick={()=>client.guildAction({type:'guild-answer',playerId:a.playerId,accept:false})}><X size={15}/>Recusar</button>
   <button className="wood-button" disabled={pending} onClick={()=>client.guildAction({type:'guild-answer',playerId:a.playerId,accept:true})}><Check size={15}/>Aceitar</button>
  </li>)}</ul>:<p className="guild-empty"><UserPlus size={24}/>Nenhum pedido por enquanto.</p>}
 </section>;
}

/** Cargos: o líder troca os nomes e marca o que cada cargo pode fazer; o cargo de líder sempre pode tudo. */
function GuildRanks({guild}:{guild:GuildView}){
 const {guildPending:pending}=useGame();
 const [draft,setDraft]=useState<GuildRank[]>(()=>guild.ranks.map(r=>({...r,permissions:[...r.permissions]})));
 const [closing,setClosing]=useState(false);
 useEffect(()=>{setDraft(guild.ranks.map(r=>({...r,permissions:[...r.permissions]})));},[guild.ranks]);
 const changed=JSON.stringify(draft)!==JSON.stringify(guild.ranks);
 const valid=draft.every(r=>r.name.trim().length>=RANK_NAME_MIN&&r.name.trim().length<=RANK_NAME_MAX);
 const toggle=(id:number,perm:GuildPermission)=>setDraft(d=>d.map(r=>r.id!==id?r:{...r,permissions:r.permissions.includes(perm)?r.permissions.filter(x=>x!==perm):GUILD_PERMISSIONS.filter(x=>x===perm||r.permissions.includes(x))}));
 return <section className="guild-pane wood-cream guild-ranks" aria-label="Cargos">
  <h3>Cargos <small>do mais alto para o mais baixo</small></h3>
  <div className="guild-ranks-scroll">
   <table className="guild-ranks-table"><thead><tr><th>Cargo</th>{GUILD_PERMISSIONS.map(perm=><th key={perm} title={PERMISSION_NAMES[perm]}>{PERMISSION_SHORT[perm]}</th>)}</tr></thead>
    <tbody>{draft.map(r=><tr key={r.id} data-rank={r.id}>
     <td><span className="guild-rank-name">{r.id===LEADER_RANK&&<Crown size={14}/>}<input value={r.name} maxLength={RANK_NAME_MAX} aria-label={`Nome do cargo ${r.id+1}`} onChange={e=>setDraft(d=>d.map(x=>x.id===r.id?{...x,name:e.target.value}:x))}/></span></td>
     {GUILD_PERMISSIONS.map(perm=><td key={perm}><label className="guild-check"><input type="checkbox" checked={r.id===LEADER_RANK||r.permissions.includes(perm)} disabled={r.id===LEADER_RANK} aria-label={`${r.name}: ${PERMISSION_NAMES[perm]}`} onChange={()=>toggle(r.id,perm)}/><i aria-hidden="true"><Check size={13}/></i></label></td>)}
    </tr>)}</tbody></table>
  </div>
  <footer className="guild-ranks-foot">
   <small>Quem tem um cargo só age sobre cargos abaixo do seu. Só o líder edita os cargos e pode excluir a guilda.</small>
   <button className="wood-quiet" disabled={!changed||pending} onClick={()=>setDraft(guild.ranks.map(r=>({...r,permissions:[...r.permissions]})))}>Desfazer</button>
   <button className="wood-button" disabled={!changed||!valid||pending} onClick={()=>client.guildAction({type:'guild-ranks',ranks:draft.map(r=>({...r,name:r.name.trim()}))})}><Check size={16}/>Salvar cargos</button>
  </footer>
  <div className="guild-danger-zone"><span><b>Excluir guilda</b><small>Todos saem e os itens do depósito voltam para você. Não dá para desfazer.</small></span><button className="wood-button guild-danger" onClick={()=>setClosing(true)}><Trash2 size={15}/>Excluir guilda</button></div>
  {closing&&<div className="guild-confirm-layer" onPointerDown={e=>{if(e.target===e.currentTarget)setClosing(false);}}><section className="guild-confirm" role="alertdialog" aria-label="Excluir guilda">
   <strong>Excluir a guilda {guild.name}?</strong>
   <p>Todos os {guild.members.length} membros saem, a Riqueza e as construções se perdem e os itens do depósito voltam para você.</p>
   <div><button className="wood-quiet" onClick={()=>setClosing(false)}>Voltar</button><button className="wood-button guild-danger" disabled={pending} onClick={()=>{client.guildAction({type:'guild-disband'});setClosing(false);client.update({guildTab:'home'});}}>Excluir</button></div>
  </section></div>}
 </section>;
}
