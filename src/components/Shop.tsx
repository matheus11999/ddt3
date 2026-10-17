import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {ChevronLeft,ChevronRight,Glasses,LoaderCircle,RotateCcw,Search,Shirt,ShoppingBag,Smile,Sparkles,Swords,X} from 'lucide-react';
import {CATALOG,SLOT_NAMES,canEquipItem,normalizeVisibility} from '../../shared/catalog';
import type {Equipment} from '../../shared/catalog';
import {SHOP_OFFERS,SHOP_OFFER_BY_ID} from '../../shared/shop';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {Avatar} from './Avatar';
import {InventoryTooltip} from './Inventory';
import type {Tip} from './Inventory';
import {ItemCard,ItemCardFrame,itemTier,rarityLabel} from './ItemCard';
import {ItemIcon} from './ItemIcon';
import {LevelBadge} from './LevelBadge';
import {Modal} from './Modal';
import {RewardIcon} from './RewardIcon';
import './WoodTheme.css';
import './Shop.css';

/* Loja no padrão da mochila e do ferreiro: provador em madeira laranja à esquerda,
   vitrine creme com cards horizontais em duas colunas e abas verticais à direita.
   Só aparecem itens do gênero do personagem e unissex; cada item é comprado
   direto no card, com confirmação, sem carrinho. */
const CATEGORIES=[{id:'all',label:'Destaques',Icon:ShoppingBag},{id:'weapon',label:'Armas',Icon:Swords},{id:'outfit',label:'Roupas',Icon:Shirt},{id:'costume',label:'Fantasias',Icon:Sparkles},{id:'face',label:'Rostos',Icon:Smile},{id:'style',label:'Complementos',Icon:Glasses}] as const;
const PAGE_SIZE=10;
const TIER_STARS={common:1,normal:2,epic:3,legendary:4} as const;
type Category=typeof CATEGORIES[number]['id'];
const money=(value:number)=>value.toLocaleString('pt-BR');
const searchable=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');

export function Shop({onClose}:{onClose:()=>void}){
 const state=useGame(),p=state.profile!;
 const [category,setCategory]=useState<Category>('all'),[query,setQuery]=useState(''),[page,setPage]=useState(0),[confirming,setConfirming]=useState<string|null>(null);
 const [draft,setDraft]=useState<Equipment>(()=>({...p.equipment,dyes:{...p.equipment.dyes}})),[trying,setTrying]=useState<string|null>(null),[tip,setTip]=useState<Tip|null>(null),[feedback,setFeedback]=useState(''),[pending,setPending]=useState(false);
 const request=useRef<string|null>(null),sentResult=useRef(state.shopResult),touchUntil=useRef(0),confirmButton=useRef<HTMLButtonElement>(null);
 const locked=pending||state.status!=='online'||!!state.battle||!!state.room;
 // The other gender's pieces never show up: only this character's collection and unisex items.
 const entries=SHOP_OFFERS.filter(({id})=>{const item=CATALOG[id];return item&&canEquipItem(item,p.gender)&&(category==='all'||category==='style'&&!['weapon','outfit','face','costume'].includes(item.slot)||item.slot===category)&&searchable(item.name).includes(searchable(query));}).map(({id})=>id);
 const pages=Math.max(1,Math.ceil(entries.length/PAGE_SIZE)),currentPage=Math.min(page,pages-1),visible=entries.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);
 useEffect(()=>{
  // The server's purchase receipt ends the request, so buying a piece already in the backpack also completes.
  const id=request.current,result=state.shopResult;if(!id||!result||result===sentResult.current||!result.items.includes(id))return;
  request.current=null;setPending(false);setConfirming(null);setFeedback(`${CATALOG[id].name} guardado na mochila!`);audio.play('click');
 },[state.shopResult]);
 useEffect(()=>{if(request.current&&(state.error||state.status!=='online')){request.current=null;setPending(false);setConfirming(null);setFeedback(state.error??'Reconectando. Seu saldo será atualizado ao voltar.');}},[state.error,state.status]);
 useEffect(()=>{
  if(!tip)return;const dismiss=()=>setTip(null),outside=(event:Event)=>{if(!tip.anchor.contains(event.target as Node))dismiss();},escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();setTip(null);}};
  window.addEventListener('scroll',dismiss,true);window.addEventListener('resize',dismiss);window.addEventListener('pointerdown',outside,true);window.addEventListener('keydown',escape,true);
  return()=>{window.removeEventListener('scroll',dismiss,true);window.removeEventListener('resize',dismiss);window.removeEventListener('pointerdown',outside,true);window.removeEventListener('keydown',escape,true);};
 },[tip]);
 useEffect(()=>{
  if(!confirming)return;confirmButton.current?.focus({preventScroll:true});
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!request.current){event.preventDefault();event.stopPropagation();setConfirming(null);}};
  window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);
 },[confirming]);
 function experiment(id:string){
  const item=CATALOG[id];if(!item||!canEquipItem(item,p.gender))return;
  setDraft(current=>{
   // A fitting must reveal the selected piece even when the saved appearance hides it.
   // These display changes belong only to the shop draft; Restore recovers the saved flags.
   const visibility=normalizeVisibility(current.visibility);
   if(item.slot==='costume')visibility.costume=true;
   else if(['face','outfit','hair','hat','glasses'].includes(item.slot))visibility.costume=false;
   if(item.slot==='hat'||item.slot==='glasses')visibility[item.slot]=true;
   return {...current,[item.slot]:id,visibility,upgrade:item.slot==='weapon'?0:current.upgrade,compositions:{...current.compositions,[id]:{}},dyes:{...current.dyes,...(['outfit','hat','hair','glasses'].includes(item.slot)?{[item.slot]:'original' as const}:{})}};
  });setTrying(id);setFeedback('');audio.play('click');
 }
 function ask(id:string){if(locked||!canEquipItem(id,p.gender)||SHOP_OFFER_BY_ID[id].price>p.gold)return;setTip(null);setFeedback('');setConfirming(id);audio.play('click');}
 function buy(){const id=confirming;if(!id||locked||SHOP_OFFER_BY_ID[id].price>p.gold)return;request.current=id;sentResult.current=state.shopResult;setPending(true);client.update({error:null});client.send({type:'shop-buy',items:[id]});}
 function restore(){setDraft({...p.equipment,dyes:{...p.equipment.dyes}});setTrying(null);audio.play('click');}
 function browse(next:Category){setCategory(next);setPage(0);setTip(null);}
 function tipEvents(id:string){return {
  onMouseEnter:(event:React.MouseEvent<HTMLElement>)=>{if(Date.now()>touchUntil.current)setTip({id,anchor:event.currentTarget,mode:'hover'});},onMouseLeave:()=>setTip(current=>current?.mode==='touch'?current:null),
  onFocus:(event:React.FocusEvent<HTMLElement>)=>{if(Date.now()>touchUntil.current)setTip({id,anchor:event.currentTarget,mode:'focus'});},onBlur:()=>setTip(current=>current?.mode==='touch'?current:null),
  onPointerDown:(event:ReactPointerEvent<HTMLElement>)=>{if(event.pointerType==='touch')touchUntil.current=Date.now()+900;},
  // A click dresses the fitting room; on touch it also opens the item card, since there is no hover.
  onClick:(event:React.MouseEvent<HTMLElement>)=>{const anchor=event.currentTarget,touch=Date.now()<=touchUntil.current;experiment(id);if(touch)setTip(current=>current?.id===id&&current.mode==='touch'?null:{id,anchor,mode:'touch'});}
 };}
 const tipped=(id:string)=>tip?.id===id?'item-tooltip':undefined;
 const pick=confirming?CATALOG[confirming]:null;

 return <Modal title="Loja da Brasa" onClose={onClose} className="shop-window" viewport>
  <div className="shop-layout">
   <aside className="shop-fitting" aria-label="Provador da loja">
    <header className="shop-fitting-head">
     <LevelBadge level={p.level} size={42}/>
     <div className="shop-identity"><small>Provador</small><h2>{p.name}</h2></div>
    </header>
    <div className="shop-stage">
     <i className="wood-sigil shop-sigil" aria-hidden="true"/>
     <Avatar equipment={draft} size={290} weapon={CATALOG[trying??'']?.slot==='weapon'} animated={false}/>
     <button className="shop-restore" onClick={restore} disabled={!trying} aria-label="Restaurar visual" title="Restaurar visual"><RotateCcw size={18}/></button>
     {trying&&<div className="shop-preview-caption"><span>{CATALOG[trying].name}</span></div>}
    </div>
    <footer className="shop-purse"><RewardIcon size={30}/><div><small>Moedas Brasa</small><strong>{money(p.gold)}</strong></div></footer>
   </aside>
   <section className="shop-pane" aria-label="Catálogo da loja">
    <div className="shop-toolbar">
     <label><Search size={15}/><input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);setTip(null);}} placeholder="Buscar na loja…" aria-label="Buscar na loja"/></label>
     <span className="shop-count">{entries.length} {entries.length===1?'item':'itens'}</span>
    </div>
    <div className="shop-shelf">
     <div className="shop-grid">
      {visible.map(id=>{const {price}=SHOP_OFFER_BY_ID[id],item=CATALOG[id],short=price>p.gold;return <article key={id} className={`shop-offer ${trying===id?'trying':''}`} data-shop-item={id} data-tier={itemTier(item.rarity)} onClick={event=>{if(!(event.target as HTMLElement).closest('button'))experiment(id);}}>
       <ItemCard rarity={item.rarity} selected={trying===id} aria-label={`Experimentar ${item.name}`} aria-pressed={trying===id} aria-describedby={tipped(id)} {...tipEvents(id)}><ItemIcon id={id} upgrade={0} size={64}/></ItemCard>
       <div className="shop-offer-info">
        <h2>{item.name}</h2>
        <small>{SLOT_NAMES[item.slot]}{item.slot==='weapon'?' · +0':''}<span className="shop-stars" aria-label={rarityLabel(item.rarity)}>{'★'.repeat(TIER_STARS[itemTier(item.rarity)])}<u>{'★'.repeat(4-TIER_STARS[itemTier(item.rarity)])}</u></span></small>
       </div>
       <div className="shop-offer-buy">
        <span className={`shop-price ${short?'short':''}`}><RewardIcon size={20}/>{money(price)}</span>
        <div className="shop-offer-actions">
         <button className="shop-buy" disabled={locked||short} aria-label={`Comprar ${item.name}`} title={short?'Moedas Brasa insuficientes':'Comprar'} onClick={()=>ask(id)}><ShoppingBag size={17}/></button>
        </div>
       </div>
      </article>;})}
      {!entries.length&&<div className="shop-empty"><Search size={34}/><strong>Nenhum item encontrado</strong><span>Tente outro nome ou categoria.</span></div>}
     </div>
     <nav className="shop-tabs" aria-label="Categorias da loja">{CATEGORIES.map(({id,label,Icon})=><button key={id} className={category===id?'active':''} aria-pressed={category===id} onClick={()=>browse(id)}><Icon size={19} aria-hidden="true"/><span>{label}</span></button>)}</nav>
    </div>
    <div className="shop-pagination">
     <span className="shop-feedback" role="status">{feedback&&<>{feedback}<button aria-label="Dispensar mensagem da loja" onClick={()=>setFeedback('')}><X size={12}/></button></>}</span>
     <div className="shop-pager"><button aria-label="Página anterior" disabled={currentPage===0} onClick={()=>{setPage(currentPage-1);setTip(null);}}><ChevronLeft size={16}/></button><span>{currentPage+1} / {pages}</span><button aria-label="Próxima página" disabled={currentPage===pages-1} onClick={()=>{setPage(currentPage+1);setTip(null);}}><ChevronRight size={16}/></button></div>
    </div>
   </section>
   {pick&&(()=>{const price=SHOP_OFFER_BY_ID[pick.id].price,tier=itemTier(pick.rarity);return <div className="shop-confirm-layer" onPointerDown={e=>{if(e.target===e.currentTarget&&!pending)setConfirming(null);}}>
    <section className="shop-confirm" role="alertdialog" aria-modal="true" aria-label="Confirmar compra" data-tier={tier}>
     <header><strong>Confirmar compra</strong><button className="wood-close" aria-label="Fechar confirmação" disabled={pending} onClick={()=>setConfirming(null)}><X size={18}/></button></header>
     <div className="shop-confirm-body">
      <div className="shop-confirm-showcase"><i aria-hidden="true"/><ItemCardFrame rarity={pick.rarity} variant="detail"><ItemIcon id={pick.id} upgrade={0} size={84}/></ItemCardFrame></div>
      <b className="shop-confirm-name">{pick.name}</b>
      <span className="shop-confirm-kind">{SLOT_NAMES[pick.slot]}{pick.slot==='weapon'?' · +0':''}<em>{rarityLabel(pick.rarity)}<i aria-hidden="true">{'★'.repeat(TIER_STARS[tier])}<u>{'★'.repeat(4-TIER_STARS[tier])}</u></i></em></span>
      <dl className="shop-confirm-cost">
       <div><dt>Preço</dt><dd><RewardIcon size={22}/>{money(price)}</dd></div>
       <div><dt>Seu saldo</dt><dd><RewardIcon size={22}/>{money(p.gold)}</dd></div>
       <div className="after"><dt>Depois da compra</dt><dd><RewardIcon size={22}/>{money(p.gold-price)}</dd></div>
      </dl>
     </div>
     <footer><button className="wood-quiet" disabled={pending} onClick={()=>setConfirming(null)}>Cancelar</button><button ref={confirmButton} className="wood-button" disabled={locked&&!pending} aria-busy={pending} onClick={buy}>{pending?<LoaderCircle size={18} className="button-spinner"/>:<ShoppingBag size={18}/>}{pending?'Comprando…':'Confirmar'}</button></footer>
    </section>
   </div>;})()}
  </div>
  {tip&&createPortal(<InventoryTooltip tip={tip} gender={p.gender} equipment={draft} upgrades={{}} compositions={p.compositions} hideGender action={`Permanente · ${money(SHOP_OFFER_BY_ID[tip.id]?.price??0)} Moedas Brasa${CATALOG[tip.id]?.slot==='weapon'?' · +0':''}`}/>,document.body)}
 </Modal>;
}
