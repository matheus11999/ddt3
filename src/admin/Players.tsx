import {useCallback,useEffect,useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import {Coins,Gift,Mail,MailCheck,MailOpen,Minus,Package,Plus,RefreshCw,Search,Send,Trash2,Users,Wifi,X} from 'lucide-react';
import {api,ApiError} from './api';
import type {MailDraft,PlayerList,SentMail} from './api';
import {canEquipItem,CATALOG,isEmptyItem,ITEMS,MAX_UPGRADE,SLOT_NAMES,STONES,WEAPONS} from '../../shared/catalog';
import type {CharacterGender,Slot} from '../../shared/catalog';
import {COMPOSITION_STONES} from '../../shared/composition';
import {PLAYER_SORTS,PRESENCE_NAMES} from '../../shared/adminPlayers';
import type {AdminPlayerDetail,AdminPlayerRow,PlayerSort} from '../../shared/adminPlayers';
import {attachmentLabel,MAIL_AMOUNT_MAX,MAIL_ATTACHMENTS_MAX,MAIL_BODY_MAX,MAIL_COINS_MAX,MAIL_DEFAULT_SENDER,MAIL_ITEM_COPIES_MAX,MAIL_SUBJECT_MAX} from '../../shared/mail';
import type {MailAttachment} from '../../shared/mail';
import {ItemIcon} from '../components/ItemIcon';
import {RewardIcon} from '../components/RewardIcon';
import {CompositionIcon} from '../components/CompositionIcon';

const SORT_NAMES:Record<PlayerSort,string>={created:'Mais novos',name:'Nome',level:'Nível',gold:'Moedas',wins:'Vitórias',matches:'Partidas'};
const PRESENCE_TONES={offline:'base',lobby:'live',room:'draft',battle:'dirty'} as const;
const GENDER={male:'♂',female:'♀'} as const;
const date=(iso:string)=>new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
const number=(n:number)=>n.toLocaleString('pt-BR');

/** /admin/jogadores: every player in a table, with coins, items and messages sent by mail. */
export function Players(){
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[online,setOnline]=useState(false),[sort,setSort]=useState<PlayerSort>('created'),[page,setPage]=useState(0);
 const [data,setData]=useState<PlayerList|null>(null),[error,setError]=useState(''),[open,setOpen]=useState<string|null>(null);
 const [compose,setCompose]=useState<{player:AdminPlayerRow;mode:ComposeMode}|null>(null),[toast,setToast]=useState(''),[version,setVersion]=useState(0);
 useEffect(()=>{const t=setTimeout(()=>{setQuery(search);setPage(0);},300);return()=>clearTimeout(t);},[search]);
 const load=useCallback(()=>api.players({search:query,online,sort,page}).then(r=>{setData(r);setError('');}).catch(e=>setError(e.message)),[query,online,sort,page]);
 useEffect(()=>{load();const timer=setInterval(load,20000);return()=>clearInterval(timer);},[load]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(t);},[toast]);
 const pages=data?Math.max(1,Math.ceil(data.total/data.pageSize)):1;
 const sent=(player:AdminPlayerRow,draft:MailDraft)=>{setCompose(null);setToast(`Carta “${draft.subject}” enviada para ${player.name}.`);load();setVersion(v=>v+1);};
 return <section className="adm-page adm-players">
  <header className="adm-head"><div><h1>Jogadores</h1><p>Todos os aventureiros. Moedas, itens e mensagens chegam no Correio do jogador, que recebe os anexos com “Receber”.</p></div>
   <button className="adm-btn ghost" onClick={load}><RefreshCw size={16}/>Atualizar</button></header>
  <div className="adm-toolbar adm-player-tools">
   <label className="adm-search big"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome ou código do jogador" aria-label="Buscar jogador"/>{search&&<button aria-label="Limpar busca" onClick={()=>setSearch('')}><X size={15}/></button>}</label>
   <div className="adm-tabs">
    <button className={!online?'on':''} onClick={()=>{setOnline(false);setPage(0);}}><Users size={15}/>Todos<small>{data?number(data.registered):'…'}</small></button>
    <button className={online?'on':''} onClick={()=>{setOnline(true);setPage(0);}}><Wifi size={15}/>Online<small>{data?number(data.online):'…'}</small></button>
   </div>
   <label className="adm-sort">Ordenar<select value={sort} onChange={e=>{setSort(e.target.value as PlayerSort);setPage(0);}}>{PLAYER_SORTS.map(s=><option key={s} value={s}>{SORT_NAMES[s]}</option>)}</select></label>
  </div>
  {error&&<p className="adm-error">{error}</p>}
  {!data?<div className="adm-skeleton"/>:data.players.length?<div className="adm-panel adm-table-wrap"><table className="adm-table">
   <thead><tr><th>Jogador</th><th>Status</th><th className="num">Nível</th><th className="num">Moedas</th><th className="num">Vitórias</th><th className="num">Partidas</th><th className="num">Itens</th><th className="num">Tickets</th><th className="num">Pedras</th><th>Criado em</th><th className="act">Ações</th></tr></thead>
   <tbody>{data.players.map(p=><tr key={p.id} className={open===p.id?'on':''} onClick={()=>setOpen(p.id)}>
    <td><b className="adm-player-name"><span className={`adm-gender ${p.gender}`} title={p.gender==='male'?'Masculino':'Feminino'}>{GENDER[p.gender]}</span>{p.name}</b><small className="adm-player-id">{p.id.slice(0,8)}</small></td>
    <td><span className={`adm-status ${PRESENCE_TONES[p.presence]}`}>{PRESENCE_NAMES[p.presence]}</span></td>
    <td className="num"><b>{p.level}</b></td><td className="num gold">{number(p.gold)}</td><td className="num">{number(p.wins)}</td><td className="num">{number(p.matches)}</td>
    <td className="num">{p.items}</td><td className="num">{p.colorTickets}</td><td className="num">{number(p.stones)}</td><td className="when">{date(p.createdAt)}</td>
    <td className="act" onClick={e=>e.stopPropagation()}><span className="adm-row-actions">
     <button className="adm-icon" title="Adicionar moedas" aria-label={`Adicionar moedas para ${p.name}`} onClick={()=>setCompose({player:p,mode:'coins'})}><Coins size={17}/></button>
     <button className="adm-icon" title="Enviar itens" aria-label={`Enviar itens para ${p.name}`} onClick={()=>setCompose({player:p,mode:'items'})}><Gift size={17}/></button>
     <button className="adm-icon" title="Enviar mensagem" aria-label={`Enviar mensagem para ${p.name}`} onClick={()=>setCompose({player:p,mode:'message'})}><Mail size={17}/></button>
    </span></td>
   </tr>)}</tbody>
  </table>
   <footer className="adm-pages"><span>{number(data.total)} {data.total===1?'jogador':'jogadores'}{query?` para “${query}”`:''}</span>
    <button className="adm-btn small ghost" disabled={page===0} onClick={()=>setPage(page-1)}>Anterior</button><b>{page+1} / {pages}</b><button className="adm-btn small ghost" disabled={page+1>=pages} onClick={()=>setPage(page+1)}>Próxima</button></footer>
  </div>:<p className="adm-empty big">{online?'Ninguém online agora.':query?'Nenhum jogador com esse nome.':'Nenhum jogador ainda.'}</p>}
  {open&&<PlayerDrawer key={`${open}-${version}`} id={open} onClose={()=>setOpen(null)} onCompose={(player,mode)=>setCompose({player,mode})}/>}
  {compose&&<ComposeMail player={compose.player} mode={compose.mode} onClose={()=>setCompose(null)} onSent={draft=>sent(compose.player,draft)}/>}
  {toast&&<div className="adm-toast adm-toast-fixed" role="status"><MailCheck size={16}/>{toast}</div>}
 </section>;
}

function PlayerDrawer({id,onClose,onCompose}:{id:string;onClose:()=>void;onCompose:(player:AdminPlayerRow,mode:ComposeMode)=>void}){
 const [data,setData]=useState<{player:AdminPlayerDetail;mail:SentMail[]}|null>(null),[error,setError]=useState('');
 useEffect(()=>{api.player(id).then(setData).catch(e=>setError(e.message));},[id]);
 if(!data)return <aside className="adm-drawer adm-player-drawer">{error?<p className="adm-error">{error}</p>:<div className="adm-skeleton"/>}</aside>;
 const p=data.player,counts=new Map<string,number>();
 for(const key of p.inventory){const base=key.split('~')[0];counts.set(base,(counts.get(base)??0)+1);}
 return <aside className="adm-drawer adm-player-drawer" aria-label={`Jogador ${p.name}`}>
  <header><h3><span className={`adm-gender ${p.gender}`}>{GENDER[p.gender]}</span>{p.name}</h3><button className="adm-icon" aria-label="Fechar" onClick={onClose}><X size={18}/></button></header>
  <span className={`adm-status ${PRESENCE_TONES[p.presence]}`}>{PRESENCE_NAMES[p.presence]}</span>
  <dl className="adm-facts">
   <dt>Código</dt><dd><code>{p.id}</code></dd><dt>Nível</dt><dd>{p.level} <small>({number(p.xp)} EXP)</small></dd><dt>Moedas</dt><dd>{number(p.gold)}</dd><dt>Cupons</dt><dd>{number(p.coupons)}</dd>
   <dt>Vitórias</dt><dd>{number(p.wins)} de {number(p.matches)} partidas</dd><dt>Tickets de Cor</dt><dd>{p.colorTickets}</dd>
   <dt>Pedras de forja</dt><dd>{STONES.map(s=>`${['I','II','III','IV','V'][s.level-1]}: ${p.stoneStacks[String(s.level)]??0}`).join(' · ')}</dd>
   <dt>Criado em</dt><dd>{date(p.createdAt)}</dd>
  </dl>
  <div className="adm-drawer-actions"><button className="adm-btn small" onClick={()=>onCompose(p,'coins')}><Coins size={15}/>Moedas</button><button className="adm-btn small" onClick={()=>onCompose(p,'items')}><Gift size={15}/>Itens</button><button className="adm-btn small" onClick={()=>onCompose(p,'message')}><Mail size={15}/>Mensagem</button></div>
  <h4>Mochila <small>{p.inventory.length} itens</small></h4>
  <div className="adm-bag">{[...counts].map(([item,n])=>CATALOG[item]&&<span key={item} className="adm-bag-item" title={`${CATALOG[item].name}${n>1?` ×${n}`:''}${p.upgrades[item]?` · +${p.upgrades[item]}`:''}`}><ItemIcon id={item} size={40} upgrade={p.upgrades[item]??0}/>{n>1&&<b>{n}</b>}</span>)}</div>
  <h4>Correio enviado <small>{data.mail.length}</small></h4>
  {data.mail.length?<ul>{data.mail.map(m=><li key={m.id}>
   <b>{m.claimed?<MailCheck size={15}/>:m.read?<MailOpen size={15}/>:<Mail size={15}/>}{m.subject}</b>
   {m.attachments.length>0&&<small>{m.attachments.map(attachmentLabel).join(', ')}</small>}
   <small>{date(m.createdAt)} · por {m.createdBy} · {m.deleted?'apagada pelo jogador':m.claimed?'anexos recebidos':m.attachments.length?'anexos pendentes':m.read?'lida':'não lida'}</small>
  </li>)}</ul>:<p className="adm-empty">Nenhuma carta enviada.</p>}
 </aside>;
}

// ── Mail composer: coins, items from the catalog and plain messages ──
type ComposeMode='coins'|'items'|'message';
const TITLES:Record<ComposeMode,string>={coins:'Adicionar moedas',items:'Enviar itens',message:'Enviar mensagem'};
const DEFAULT_SUBJECT:Record<ComposeMode,string>={coins:'Moedas da equipe Brasa',items:'Presente da equipe Brasa',message:''};
interface CatalogEntry {key:string;name:string;icon:ReactNode;attachment:()=>MailAttachment;note?:string;blocked?:string;}
const ITEM_GROUPS:{id:string;label:string;slots?:Slot[]}[]=[
 {id:'weapon',label:'Armas',slots:['weapon']},{id:'outfit',label:'Roupas',slots:['outfit']},{id:'hat',label:'Chapéus',slots:['hat']},{id:'hair',label:'Cabelos',slots:['hair']},
 {id:'face',label:'Rostos',slots:['face']},{id:'glasses',label:'Óculos',slots:['glasses']},{id:'costume',label:'Fantasias',slots:['costume']},
 {id:'accessory',label:'Acessórios',slots:['wristband','bracelet','ring','necklace','bubble']},
 {id:'stone',label:'Pedras de forja'},{id:'composition',label:'Pedras de composição'},{id:'ticket',label:'Ticket de Cor'},{id:'coins',label:'Moedas'},{id:'coupons',label:'Cupons'},
];
function catalog(gender:CharacterGender):Record<string,CatalogEntry[]>{
 const groups:Record<string,CatalogEntry[]>={};
 for(const group of ITEM_GROUPS)if(group.slots)groups[group.id]=ITEMS.filter(item=>!isEmptyItem(item)&&group.slots!.includes(item.slot)).map(item=>({key:item.id,name:item.name,icon:<ItemIcon id={item.id} size={52}/>,attachment:()=>({kind:'item',item:item.id,quantity:1,...(WEAPONS.some(w=>w.id===item.id)?{upgrade:0}:{})}),
  note:group.id==='accessory'?SLOT_NAMES[item.slot]:item.gender&&item.gender!=='unisex'?(item.gender==='male'?'Masculino':'Feminino'):undefined,
  blocked:canEquipItem(item,gender)?undefined:`Só para personagem ${item.gender==='male'?'masculino':'feminino'}`}));
 groups.stone=STONES.map(s=>({key:`stone-${s.level}`,name:s.name,icon:<RewardIcon kind="stone" level={s.level} size={50}/>,attachment:()=>({kind:'stone',level:s.level,amount:10})}));
 groups.composition=COMPOSITION_STONES.map(s=>({key:`composition-${s.id}`,name:s.name,icon:<CompositionIcon stat={s.stat} size={50}/>,note:`+${s.value}`,attachment:()=>({kind:'composition',stone:s.id,amount:5})}));
 groups.ticket=[{key:'ticket',name:'Ticket de Cor',icon:<RewardIcon kind="ticket" size={50}/>,attachment:()=>({kind:'ticket',amount:3})}];
 groups.coins=[{key:'coins',name:'Moedas Brasa',icon:<RewardIcon size={46}/>,attachment:()=>({kind:'coins',amount:1000})}];
 groups.coupons=[{key:'coupons',name:'Cupons',icon:<RewardIcon kind="coupons" size={46}/>,attachment:()=>({kind:'coupons',amount:100})}];
 return groups;
}
const sameAttachment=(a:MailAttachment,b:MailAttachment)=>a.kind===b.kind&&(a.kind!=='item'||b.kind==='item'&&a.item===b.item&&a.upgrade===b.upgrade)&&(a.kind!=='stone'||b.kind==='stone'&&a.level===b.level)&&(a.kind!=='composition'||b.kind==='composition'&&a.stone===b.stone);
const countOf=(a:MailAttachment)=>a.kind==='item'?a.quantity:a.amount;
const maxOf=(a:MailAttachment)=>a.kind==='item'?MAIL_ITEM_COPIES_MAX:a.kind==='coins'||a.kind==='coupons'?MAIL_COINS_MAX:MAIL_AMOUNT_MAX;
const withCount=(a:MailAttachment,n:number):MailAttachment=>{const value=Math.max(1,Math.min(maxOf(a),Math.floor(n)||1));return a.kind==='item'?{...a,quantity:value}:{...a,amount:value};};
const attachmentName=(a:MailAttachment)=>a.kind==='item'?CATALOG[a.item]?.name??a.item:a.kind==='coins'?'Moedas Brasa':a.kind==='coupons'?'Cupons':a.kind==='stone'?STONES[a.level-1]?.name??'Pedra':a.kind==='ticket'?'Ticket de Cor':COMPOSITION_STONES.find(s=>s.id===a.stone)?.name??a.stone;
function AttachmentIcon({a,size=36}:{a:MailAttachment;size?:number}){
 if(a.kind==='item')return <ItemIcon id={a.item} size={size} upgrade={a.upgrade??0}/>;
 if(a.kind==='composition'){const stone=COMPOSITION_STONES.find(s=>s.id===a.stone);return stone?<CompositionIcon stat={stone.stat} size={size}/>:null;}
 return <RewardIcon kind={a.kind==='coins'?'coins':a.kind} level={a.kind==='stone'?a.level:1} size={size}/>;
}

function ComposeMail({player,mode,onClose,onSent}:{player:AdminPlayerRow;mode:ComposeMode;onClose:()=>void;onSent:(draft:MailDraft)=>void}){
 const [sender,setSender]=useState(MAIL_DEFAULT_SENDER),[subject,setSubject]=useState(DEFAULT_SUBJECT[mode]),[body,setBody]=useState('');
 const [attachments,setAttachments]=useState<MailAttachment[]>(mode==='coins'?[{kind:'coins',amount:1000}]:[]);
 const [group,setGroup]=useState(mode==='coins'?'coins':'weapon'),[find,setFind]=useState(''),[showCatalog,setShowCatalog]=useState(mode==='items');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const groups=useMemo(()=>catalog(player.gender),[player.gender]);
 const needle=find.trim().toLowerCase();
 const entries=needle?Object.values(groups).flat().filter(e=>e.name.toLowerCase().includes(needle)):groups[group]??[];
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
 const add=(entry:CatalogEntry)=>{
  if(entry.blocked)return;const next=entry.attachment();
  setAttachments(list=>{const at=list.findIndex(a=>sameAttachment(a,next));if(at>=0)return list.map((a,i)=>i===at?withCount(a,countOf(a)+(a.kind==='item'?1:countOf(next))):a);return list.length>=MAIL_ATTACHMENTS_MAX?list:[...list,next];});
  setError(attachments.length>=MAIL_ATTACHMENTS_MAX&&!attachments.some(a=>sameAttachment(a,next))?`No máximo ${MAIL_ATTACHMENTS_MAX} anexos por carta.`:'');
 };
 const coins=attachments.find(a=>a.kind==='coins');
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(!subject.trim()){setError('Escreva um assunto.');return;}
  if(mode!=='message'&&!attachments.length){setError('Adicione pelo menos um anexo.');return;}
  setBusy(true);setError('');
  const draft:MailDraft={sender:sender.trim()||MAIL_DEFAULT_SENDER,subject:subject.trim(),body:body.trim(),attachments};
  try{await api.sendMail(player.id,draft);onSent(draft);}catch(err){setError(err instanceof ApiError?err.message:'Sem conexão com o servidor.');}finally{setBusy(false);}
 };
 return <div className="adm-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <form className={`adm-dialog adm-compose ${showCatalog?'with-catalog':''}`} onSubmit={submit} role="dialog" aria-label={`${TITLES[mode]} para ${player.name}`}>
   <header><h2>{mode==='coins'?<Coins size={20}/>:mode==='items'?<Gift size={20}/>:<Mail size={20}/>}{TITLES[mode]}<small>para {player.name} · {GENDER[player.gender]} nível {player.level}</small></h2><button type="button" className="adm-icon" aria-label="Fechar" onClick={onClose}><X size={18}/></button></header>
   <div className="adm-compose-body">
    {showCatalog&&<section className="adm-catalog" aria-label="Itens do jogo">
     <label className="adm-search"><Search size={15}/><input value={find} onChange={e=>setFind(e.target.value)} placeholder="Buscar item em todas as categorias" aria-label="Buscar item"/>{find&&<button type="button" aria-label="Limpar" onClick={()=>setFind('')}><X size={14}/></button>}</label>
     {!needle&&<div className="adm-chips">{ITEM_GROUPS.map(g=><button type="button" key={g.id} className={group===g.id?'on':''} onClick={()=>setGroup(g.id)}>{g.label}<small>{groups[g.id]?.length??0}</small></button>)}</div>}
     <div className="adm-catalog-grid">{entries.map(entry=><button type="button" key={entry.key} className="adm-catalog-item" disabled={!!entry.blocked} title={entry.blocked??`Adicionar ${entry.name}`} onClick={()=>add(entry)}>
      <span className="adm-catalog-art">{entry.icon}</span><b>{entry.name}</b>{(entry.blocked||entry.note)&&<small>{entry.blocked??entry.note}</small>}<Plus className="adm-catalog-add" size={15}/>
     </button>)}{!entries.length&&<p className="adm-empty">Nenhum item com esse nome.</p>}</div>
    </section>}
    <section className="adm-compose-mail">
     <div className="adm-pair"><label>Remetente<input value={sender} maxLength={32} onChange={e=>setSender(e.target.value)}/></label><label>Assunto<input autoFocus={mode!=='items'} value={subject} maxLength={MAIL_SUBJECT_MAX} onChange={e=>setSubject(e.target.value)} placeholder="Ex.: Bem-vindo à Brasa!" required/></label></div>
     <label>Mensagem <small>{body.length}/{MAIL_BODY_MAX}</small><textarea className="adm-textarea" rows={mode==='message'?7:3} value={body} maxLength={MAIL_BODY_MAX} onChange={e=>setBody(e.target.value)} placeholder="Escreva o texto da carta (opcional)"/></label>
     {mode==='coins'&&coins&&<div className="adm-coin-pick"><RewardIcon size={34}/><label>Quantidade de moedas<input type="number" min={1} max={MAIL_COINS_MAX} value={coins.amount} onChange={e=>setAttachments(list=>list.map(a=>a.kind==='coins'?withCount(a,Number(e.target.value)):a))}/></label>
      <div className="adm-chips">{[100,500,1000,5000,10000].map(n=><button type="button" key={n} className={coins.amount===n?'on':''} onClick={()=>setAttachments(list=>list.map(a=>a.kind==='coins'?withCount(a,n):a))}>{number(n)}</button>)}</div></div>}
     <div className="adm-attachments">
      <h3><Package size={16}/>Anexos <small>{attachments.length}/{MAIL_ATTACHMENTS_MAX}</small>{!showCatalog&&<button type="button" className="adm-btn small ghost" onClick={()=>setShowCatalog(true)}><Plus size={14}/>Adicionar itens</button>}</h3>
      {attachments.length?<ul>{attachments.map((a,i)=><li key={i}>
       <span className="adm-attachment-art"><AttachmentIcon a={a}/></span><b>{attachmentName(a)}</b>
       {a.kind==='item'&&a.upgrade!==undefined&&<label className="adm-upgrade" title="Nível de forja">+<select value={a.upgrade} onChange={e=>setAttachments(list=>list.map((x,j)=>j===i&&x.kind==='item'?{...x,upgrade:Number(e.target.value)}:x))}>{Array.from({length:MAX_UPGRADE+1},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label>}
       <span className="adm-qty"><button type="button" className="adm-icon" aria-label="Menos" onClick={()=>setAttachments(list=>list.map((x,j)=>j===i?withCount(x,countOf(x)-(x.kind==='coins'?100:1)):x))}><Minus size={14}/></button>
        <input type="number" aria-label="Quantidade" min={1} max={maxOf(a)} value={countOf(a)} onChange={e=>setAttachments(list=>list.map((x,j)=>j===i?withCount(x,Number(e.target.value)):x))}/>
        <button type="button" className="adm-icon" aria-label="Mais" onClick={()=>setAttachments(list=>list.map((x,j)=>j===i?withCount(x,countOf(x)+(x.kind==='coins'?100:1)):x))}><Plus size={14}/></button></span>
       <button type="button" className="adm-icon danger" aria-label="Tirar anexo" onClick={()=>setAttachments(list=>list.filter((_,j)=>j!==i))}><Trash2 size={15}/></button>
      </li>)}</ul>:<p className="adm-empty">{mode==='message'?'Sem anexos: o jogador recebe só a mensagem.':'Clique nos itens ao lado para anexar.'}</p>}
     </div>
     {error&&<p className="adm-error">{error}</p>}
     <footer><span className="adm-hint">O jogador recebe no Correio do jogo{player.presence!=='offline'?' agora mesmo':' quando entrar'}.</span><button type="button" className="adm-btn ghost" onClick={onClose}>Cancelar</button><button className="adm-btn gold" disabled={busy}><Send size={15}/>{busy?'Enviando…':'Enviar carta'}</button></footer>
    </section>
   </div>
  </form>
 </div>;
}
