import {useEffect,useMemo,useState} from 'react';
import {ArrowUpCircle,Check,Coins,Crown,Hammer,LoaderCircle,LogOut,PackageOpen,PackagePlus,Search,Shield,ShoppingBag,UserMinus,UserPlus,Users,Warehouse,X} from 'lucide-react';
import {CATALOG,SLOT_NAMES} from '../../shared/catalog';
import {goodsName} from '../../shared/auction';
import {BUILDING_LEVEL_COSTS,BUILDING_NAMES,canRaiseBuilding,GUILD_BUILDINGS,GUILD_CREATE_COST,GUILD_LEVEL_COSTS,GUILD_MAX_LEVEL,GUILD_NAME_MAX,GUILD_SHOP,GVG_CONTRIBUTION,guildMemberCap,smithBonus,SMITH_BONUS_PER_LEVEL,storageCapacity} from '../../shared/guilds';
import type {GuildBuilding,GuildView} from '../../shared/guilds';
import {client,useGame} from '../client';
import type {GuildTab} from '../client';
import {audio} from '../game/audio';
import {bagGoods,GoodsArt,GoodsCard,goodsRarity} from './Auction';
import {ItemCard,ItemCardFrame} from './ItemCard';
import {ItemIcon} from './ItemIcon';
import {Modal} from './Modal';
import {playerMenuProps} from './PlayerActions';
import {RewardIcon} from './RewardIcon';
import {UpgradeTag} from './UpgradeTag';
import './Backpack.css';
import './WoodTheme.css';
import './Guild.css';

/* Guildas no padrão da mochila: madeira laranja e painéis creme. Sem guilda: fundar uma (ouro) ou pedir
   para entrar. Com guilda: as três construções clicáveis (Loja, Ferreiro, Depósito), membros e, para o dono,
   o gerenciamento com as melhorias pagas em Riqueza, a moeda que só existe dentro da guilda. */
const money=(value:number)=>value.toLocaleString('pt-BR');
const BUILDING_ART:Record<GuildBuilding,string>={shop:'/assets/ui/guild-shop.png',smith:'/assets/ui/guild-smith.png',storage:'/assets/ui/guild-storage.png'};
const BUILDING_FALLBACK:Record<GuildBuilding,string>={shop:'/assets/ui/shop-button.png',smith:'/assets/ui/forge-button.png',storage:'/assets/ui/backpack-button.png'};
const BUILDING_ICONS={shop:ShoppingBag,smith:Hammer,storage:Warehouse};
const SHORT_NAMES:Record<GuildBuilding,string>={shop:'Loja',smith:'Ferreiro',storage:'Depósito'};
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
 const guild=state?.guild??null,owner=guild?.ownerId===p.id;
 const setTab=(next:GuildTab)=>{client.update({guildTab:next});audio.play('click');};
 const visibleTab=guild?(tab==='manage'&&!owner?'home':tab):'home';
 return <Modal title={guild?'Guilda':'Guildas'} onClose={()=>client.closeGuild()} className="bag-window guild-window" viewport>
  {!state?<div className="guild-loading"><LoaderCircle className="guild-spin" size={26}/>Abrindo a guilda…</div>
   :!guild?<GuildLobby applied={state.applied}/>
   :<>
    <GuildHeader guild={guild}/>
    <nav className="guild-tabs" aria-label="Seções da guilda">
     {([['home','Guilda'],['shop','Loja'],['storage','Depósito'],['members','Membros'],...(owner?[['manage','Gerenciar']]:[])] as [GuildTab,string][]).map(([id,label])=><button key={id} className={visibleTab===id?'active':''} aria-pressed={visibleTab===id} onClick={()=>setTab(id)}>{label}{id==='manage'&&!!guild.applications?.length&&<b className="guild-count">{guild.applications.length}</b>}</button>)}
    </nav>
    <div className="guild-body">
     {visibleTab==='home'&&<GuildHome guild={guild} onForge={onForge}/>}
     {visibleTab==='shop'&&<GuildShop guild={guild}/>}
     {visibleTab==='storage'&&<GuildStorage guild={guild}/>}
     {visibleTab==='members'&&<GuildMembers guild={guild}/>}
     {visibleTab==='manage'&&owner&&<GuildManage guild={guild}/>}
    </div>
   </>}
  {message&&<div className="guild-toast" role="status"><Check size={18}/>{message.text}</div>}
 </Modal>;
}

function GuildHeader({guild}:{guild:GuildView}){
 return <header className="guild-head">
  <span className="guild-emblem" aria-hidden="true"><Shield size={30}/><b>{guild.level}</b></span>
  <div className="guild-head-name"><small>Guilda · Nível {guild.level}</small><h2>{guild.name}</h2></div>
  <span className="wood-pill guild-pill" title="Membros"><Users size={16}/>{guild.members.length} / {guildMemberCap(guild.level)}</span>
  <span className="wood-pill guild-pill guild-riqueza" title="Riqueza: moeda da guilda, ganha nas vitórias GvG. Só o dono usa, para evoluir a guilda e as construções."><RiquezaIcon/>{money(guild.riqueza)} <small>Riqueza</small></span>
 </header>;
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

/** The three buildings: Loja and Depósito open their tabs, Ferreiro opens the normal forge with the guild bonus. */
function GuildHome({guild,onForge}:{guild:GuildView;onForge:()=>void}){
 const {room}=useGame();
 const open=(building:GuildBuilding)=>{
  if(building==='smith'){onForge();return;}
  client.update({guildTab:building==='shop'?'shop':'storage'});audio.play('click');
 };
 return <div className="guild-home">
  <div className="guild-buildings">{GUILD_BUILDINGS.map(building=>{const level=guild.buildings[building],Icon=BUILDING_ICONS[building],blocked=building==='smith'&&!!room;
   return <button key={building} className={`guild-building ${level?'':'unbuilt'}`} disabled={blocked} title={blocked?'Volte à praça para usar o ferreiro':undefined} onClick={()=>open(building)}>
    <span className="guild-building-stage"><BuildingArt building={building}/></span>
    <span className="guild-building-plate"><Icon size={16}/><b>{SHORT_NAMES[building]}</b><em>Nv. {level}</em></span>
    <small>{buildingEffect(building,level)}</small>
   </button>;})}</div>
  <section className="guild-pane guild-about wood-cream">
   <h3>Como a guilda cresce</h3>
   <ul>
    <li>Ligue o <b>GvG</b> na sala PvP para enfrentar outras guildas. Cada membro do time vencedor rende <b>{GVG_CONTRIBUTION} de Riqueza</b>.</li>
    <li>O dono usa a Riqueza para evoluir a guilda (até o nível {GUILD_MAX_LEVEL}) e as construções, que nunca passam do nível da guilda.</li>
    <li>O Ferreiro da Guilda soma chance de sucesso ao ferreiro de todos os membros.</li>
   </ul>
  </section>
 </div>;
}

function GuildShop({guild}:{guild:GuildView}){
 const {guildPending:pending,profile}=useGame(),p=profile!,level=guild.buildings.shop;
 const [confirm,setConfirm]=useState<string|null>(null);
 return <div className="guild-shop">
  <div className="guild-section-head"><BuildingArt building="shop" size={58}/><div><h3>{BUILDING_NAMES.shop} · Nv. {level}</h3><small>Itens exclusivos para membros, pagos em ouro.</small></div><span className="wood-pill guild-pill"><RewardIcon size={18}/>{money(p.gold)}</span></div>
  <ul className="guild-offers">{GUILD_SHOP.map(offer=>{const item=CATALOG[offer.id],locked=level<offer.level;return <li key={offer.id} className={locked?'locked':''}>
   <ItemCardFrame rarity={item.rarity} variant="slot" className="guild-offer-card"><ItemIcon id={offer.id} size={60}/></ItemCardFrame>
   <span className="guild-offer-text"><b>{item.name}</b><small>{SLOT_NAMES[item.slot]}{item.hpPercent?` · +${item.hpPercent}% de Vida`:''}</small></span>
   {locked?<span className="guild-offer-lock">Loja Nv. {offer.level}</span>
    :<button className="wood-button" disabled={pending||p.gold<offer.price} onClick={()=>setConfirm(offer.id)}><RewardIcon size={16}/>{money(offer.price)}</button>}
  </li>;})}</ul>
  {level===0&&<p className="guild-hint">A loja abre no nível 1. O dono evolui as construções em Gerenciar.</p>}
  {confirm&&<div className="guild-confirm-layer" onPointerDown={e=>{if(e.target===e.currentTarget)setConfirm(null);}}><section className="guild-confirm" role="alertdialog" aria-label="Confirmar compra">
   <strong>Comprar {CATALOG[confirm].name}?</strong>
   <p>Custa <RewardIcon size={16}/><b>{money(GUILD_SHOP.find(o=>o.id===confirm)!.price)}</b> de ouro. O item vai para a sua mochila.</p>
   <div><button className="wood-quiet" onClick={()=>setConfirm(null)}>Voltar</button><button className="wood-button" disabled={pending} onClick={()=>{client.guildAction({type:'guild-buy',item:confirm});setConfirm(null);}}>Comprar</button></div>
  </section></div>}
 </div>;
}

/** Shared Depósito: any member puts unworn items in, any member takes them out. */
function GuildStorage({guild}:{guild:GuildView}){
 const {guildPending:pending,profile}=useGame(),p=profile!,capacity=storageCapacity(guild.buildings.storage);
 const [picking,setPicking]=useState(false);const goods=useMemo(()=>bagGoods(p,true),[p]);
 const full=guild.storage.length>=capacity;
 return <div className="guild-storage">
  <div className="guild-section-head"><BuildingArt building="storage" size={58}/><div><h3>{BUILDING_NAMES.storage} · Nv. {guild.buildings.storage}</h3><small>{capacity?`${guild.storage.length} de ${capacity} espaços. Qualquer membro pode guardar e retirar.`:'Fechado. O dono constrói o depósito em Gerenciar.'}</small></div>
   <button className="wood-button" disabled={!capacity||full||pending} onClick={()=>{setPicking(true);audio.play('click');}}><PackagePlus size={17}/>Guardar item</button></div>
  <div className="guild-storage-grid wood-cream">{Array.from({length:Math.max(capacity,10)},(_,i)=>{const stored=guild.storage[i];
   if(stored)return <ItemCard key={stored.id} rarity={goodsRarity(stored.goods)} className="guild-storage-cell" title={`${goodsName(stored.goods)} · guardado por ${stored.by}. Clique para retirar.`} disabled={pending} onClick={()=>client.guildAction({type:'guild-withdraw',id:stored.id})}>
    <GoodsArt goods={stored.goods} size={48}/>{stored.goods.kind==='item'&&!!stored.goods.upgrade&&<UpgradeTag level={stored.goods.upgrade} size={26} className="bag-upgrade-tag"/>}{stored.goods.kind!=='item'&&stored.goods.amount>1&&<b className="guild-cell-count">{money(stored.goods.amount)}</b>}</ItemCard>;
   return <ItemCardFrame key={`empty-${i}`} empty variant="slot" className={`guild-storage-cell ${i>=capacity?'locked':''}`}/>;})}</div>
  {picking&&<div className="guild-confirm-layer" onPointerDown={e=>{if(e.target===e.currentTarget)setPicking(false);}}><section className="guild-confirm guild-picker" role="dialog" aria-label="Guardar item">
   <header><strong>Guardar no depósito</strong><button type="button" className="wood-close" aria-label="Fechar" onClick={()=>setPicking(false)}><X size={18}/></button></header>
   {goods.length?<div className="guild-picker-grid">{goods.map(g=><ItemCard key={g.key} rarity={goodsRarity(g.goods)} className="guild-storage-cell" title={goodsName(g.goods)} onClick={()=>{client.guildAction({type:'guild-deposit',source:g.source.kind==='item'?g.source:{...g.source,amount:g.owned}});setPicking(false);}}>
    <GoodsArt goods={g.goods} size={48}/>{g.goods.kind==='item'&&!!g.goods.upgrade&&<UpgradeTag level={g.goods.upgrade} size={26} className="bag-upgrade-tag"/>}{g.owned>1&&<b className="guild-cell-count">{money(g.owned)}</b>}</ItemCard>)}</div>
    :<p className="guild-empty"><PackageOpen size={26}/>Nada para guardar. Itens equipados ficam com você.</p>}
  </section></div>}
 </div>;
}

function GuildMembers({guild}:{guild:GuildView}){
 const {profile,guildPending:pending}=useGame(),me=profile!.id,owner=guild.ownerId===me;
 const [leaving,setLeaving]=useState(false),alone=guild.members.length===1;
 return <div className="guild-members">
  <table className="guild-table wood-cream"><thead><tr><th>Membro</th><th>Nível</th><th>Cargo</th><th>Contribuição</th>{owner&&<th aria-label="Ações"/>}</tr></thead>
   <tbody>{guild.members.map(m=><tr key={m.id} className={m.id===me?'me':''}>
    <td><b {...playerMenuProps(m.id!==me?{id:m.id,name:m.name,context:'hall'}:null)}>{m.name}</b></td><td>{m.level}</td>
    <td>{m.role==='owner'?<span className="guild-role owner"><Crown size={13}/>Dono</span>:<span className="guild-role">Membro</span>}</td>
    <td><RiquezaIcon size={15}/> {money(m.contribution)}</td>
    {owner&&<td>{m.role!=='owner'&&<button className="guild-icon-button" title={`Expulsar ${m.name}`} aria-label={`Expulsar ${m.name}`} disabled={pending} onClick={()=>client.guildAction({type:'guild-kick',playerId:m.id})}><UserMinus size={15}/></button>}</td>}
   </tr>)}</tbody></table>
  <footer className="guild-members-foot">{leaving?<><span>{owner&&alone?'Você é o último membro: a guilda será encerrada e o depósito volta para você.':owner?'A guilda passa para o membro com mais contribuição.':'Sair da guilda?'}</span><button className="wood-quiet" onClick={()=>setLeaving(false)}>Voltar</button><button className="wood-button guild-danger" disabled={pending} onClick={()=>{client.guildAction({type:'guild-leave'});setLeaving(false);}}>Confirmar</button></>
   :<button className="wood-quiet" onClick={()=>setLeaving(true)}><LogOut size={15}/>Sair da guilda</button>}</footer>
 </div>;
}

/** The owner's panel: raise the guild and the buildings with Riqueza, and answer who asked to join. */
function GuildManage({guild}:{guild:GuildView}){
 const {guildPending:pending}=useGame();
 const rows:{target:'guild'|GuildBuilding;name:string;level:number;cost:number|undefined;effect:string;blocked:string}[]=[
  {target:'guild',name:'Guilda',level:guild.level,cost:GUILD_LEVEL_COSTS[guild.level],effect:`Até ${guildMemberCap(guild.level+1)} membros e construções até o nível ${guild.level+1}`,blocked:guild.level>=GUILD_MAX_LEVEL?'Nível máximo':''},
  ...GUILD_BUILDINGS.map(building=>{const level=guild.buildings[building];return {target:building,name:SHORT_NAMES[building],level,cost:BUILDING_LEVEL_COSTS[level],effect:nextEffect(building,level),
   blocked:level>=GUILD_MAX_LEVEL?'Nível máximo':canRaiseBuilding(guild.level,level)?'':`Evolua a guilda para o nível ${level+1}`};})];
 return <div className="guild-manage">
  <section className="guild-pane wood-cream guild-upgrades" aria-label="Melhorias">
   <h3>Evoluir <small>Riqueza disponível: <RiquezaIcon size={15}/> {money(guild.riqueza)}</small></h3>
   <ul>{rows.map(row=>{const afford=row.cost!==undefined&&guild.riqueza>=row.cost;return <li key={row.target} data-target={row.target}>
    <span className="guild-upgrade-art">{row.target==='guild'?<span className="guild-emblem small"><Shield size={22}/><b>{row.level}</b></span>:<BuildingArt building={row.target} size={46}/>}</span>
    <span className="guild-upgrade-text"><b>{row.name} <em>Nv. {row.level}{!row.blocked&&` → ${row.level+1}`}</em></b><small>{row.blocked||row.effect}</small></span>
    {!row.blocked&&<span className={`guild-upgrade-cost ${afford?'':'short'}`}><RiquezaIcon size={15}/>{money(row.cost??0)}</span>}
    <button className="wood-button" disabled={!!row.blocked||!afford||pending} onClick={()=>client.guildAction({type:'guild-upgrade',target:row.target})}><ArrowUpCircle size={16}/>Evoluir</button>
   </li>;})}</ul>
  </section>
  <section className="guild-pane wood-cream guild-applications" aria-label="Pedidos para entrar">
   <h3>Pedidos para entrar <small>{guild.members.length} / {guildMemberCap(guild.level)} membros</small></h3>
   {guild.applications?.length?<ul>{guild.applications.map(a=><li key={a.playerId}>
    <span><b {...playerMenuProps({id:a.playerId,name:a.name,context:'hall'})}>{a.name}</b><small>Nível {a.level}</small></span>
    <button className="wood-quiet" disabled={pending} onClick={()=>client.guildAction({type:'guild-answer',playerId:a.playerId,accept:false})}><X size={15}/>Recusar</button>
    <button className="wood-button" disabled={pending} onClick={()=>client.guildAction({type:'guild-answer',playerId:a.playerId,accept:true})}><Check size={15}/>Aceitar</button>
   </li>)}</ul>:<p className="guild-empty"><UserPlus size={24}/>Nenhum pedido por enquanto.</p>}
  </section>
 </div>;
}
