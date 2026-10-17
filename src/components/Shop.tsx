import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {ArrowLeft,Check,ChevronLeft,ChevronRight,Eye,Glasses,LoaderCircle,LockKeyhole,RotateCcw,Search,Shirt,ShoppingBag,ShoppingCart,Smile,Sparkles,Swords,Trash2,Users,X} from 'lucide-react';
import {attributes,CATALOG,SLOT_NAMES,canEquipItem,itemGender,normalizeVisibility} from '../../shared/catalog';
import type {CharacterGender,Equipment} from '../../shared/catalog';
import {MAX_SHOP_ITEMS,SHOP_OFFERS,SHOP_OFFER_BY_ID} from '../../shared/shop';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {Avatar} from './Avatar';
import {InventoryTooltip} from './Inventory';
import type {Tip} from './Inventory';
import {ItemCard,rarityLabel} from './ItemCard';
import {ItemIcon} from './ItemIcon';
import {LevelBadge} from './LevelBadge';
import {Modal} from './Modal';
import {PowerIcon} from './PowerIcon';
import {RewardIcon} from './RewardIcon';
import {ItemGenderBadge,ITEM_GENDER_LABELS} from './ItemGenderBadge';
import './WoodTheme.css';
import './Shop.css';

/* Loja no padrão da mochila e do ferreiro: provador em madeira laranja à esquerda,
   vitrine creme com cards horizontais em duas colunas, abas verticais à direita da
   vitrine e balcão escuro com carteira, carrinho e compra no rodapé. */
const CATEGORIES=[{id:'all',label:'Destaques',Icon:ShoppingBag},{id:'weapon',label:'Armas',Icon:Swords},{id:'outfit',label:'Roupas',Icon:Shirt},{id:'costume',label:'Fantasias',Icon:Sparkles},{id:'face',label:'Rostos',Icon:Smile},{id:'style',label:'Complementos',Icon:Glasses}] as const;
const GENDERS=[{id:'male',label:'Masculino'},{id:'female',label:'Feminino'},{id:'unisex',label:'Unissex'}] as const;
const PAGE_SIZE=10;
type Category=typeof CATEGORIES[number]['id'];
const money=(value:number)=>value.toLocaleString('pt-BR');
const searchable=(value:string)=>value.normalize('NFD').replace(/[̀-ͯ]/g,'').toLocaleLowerCase('pt-BR');

export function Shop({onClose}:{onClose:()=>void}){
 const state=useGame(),p=state.profile!;
 const [category,setCategory]=useState<Category>('all'),[query,setQuery]=useState(''),[gender,setGender]=useState<CharacterGender|'unisex'>(p.gender),[page,setPage]=useState(0),[cart,setCart]=useState<string[]>([]),[cartOpen,setCartOpen]=useState(false);
 const [draft,setDraft]=useState<Equipment>(()=>({...p.equipment,dyes:{...p.equipment.dyes}})),[trying,setTrying]=useState<string|null>(null),[tip,setTip]=useState<Tip|null>(null),[feedback,setFeedback]=useState(''),[pending,setPending]=useState(false);
 const request=useRef<string[]|null>(null),touchUntil=useRef(0);
 const owned=useMemo(()=>new Set(p.inventory),[p.inventory]);
 const cartItems=cart.filter(id=>!owned.has(id)&&!!SHOP_OFFER_BY_ID[id]&&canEquipItem(id,p.gender)),total=cartItems.reduce((sum,id)=>sum+SHOP_OFFER_BY_ID[id].price,0);
 const locked=pending||state.status!=='online'||!!state.battle||!!state.room,short=total>p.gold;
 const entries=SHOP_OFFERS.filter(({id})=>{const item=CATALOG[id];return item&&itemGender(item)===gender&&(category==='all'||category==='style'&&!['weapon','outfit','face','costume'].includes(item.slot)||item.slot===category)&&searchable(item.name).includes(searchable(query));}).map(({id})=>id);
 const pages=Math.max(1,Math.ceil(entries.length/PAGE_SIZE)),currentPage=Math.min(page,pages-1),visible=entries.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);
 const previewStats=attributes(draft);
 useEffect(()=>{
  const ids=request.current;if(!ids)return;
  if(ids.every(id=>owned.has(id))){request.current=null;setPending(false);setCart(current=>current.filter(id=>!ids.includes(id)));setFeedback(`${ids.length===1?'Item guardado':'Itens guardados'} na mochila!`);audio.play('click');}
 },[owned]);
 useEffect(()=>{if(request.current&&(state.error||state.status!=='online')){request.current=null;setPending(false);setFeedback(state.error??'Reconectando. Seu saldo será atualizado ao voltar.');}},[state.error,state.status]);
 useEffect(()=>{
  if(!tip)return;const dismiss=()=>setTip(null),outside=(event:Event)=>{if(!tip.anchor.contains(event.target as Node))dismiss();},escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();setTip(null);}};
  window.addEventListener('scroll',dismiss,true);window.addEventListener('resize',dismiss);window.addEventListener('pointerdown',outside,true);window.addEventListener('keydown',escape,true);
  return()=>{window.removeEventListener('scroll',dismiss,true);window.removeEventListener('resize',dismiss);window.removeEventListener('pointerdown',outside,true);window.removeEventListener('keydown',escape,true);};
 },[tip]);
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
  });setTrying(id);setTip(null);setFeedback('');audio.play('click');
 }
 function add(id:string){if(locked||!canEquipItem(id,p.gender)||owned.has(id)||cart.includes(id))return;if(cartItems.length>=MAX_SHOP_ITEMS){setFeedback(`O carrinho comporta até ${MAX_SHOP_ITEMS} itens.`);return;}setCart(current=>[...current,id]);setFeedback(`${CATALOG[id].name} no carrinho`);audio.play('click');}
 function buy(){if(locked||!cartItems.length||short)return;request.current=[...cartItems];setPending(true);setFeedback('');client.update({error:null});client.send({type:'shop-buy',items:[...cartItems]});}
 function restore(){setDraft({...p.equipment,dyes:{...p.equipment.dyes}});setTrying(null);audio.play('click');}
 function browse(next:{category?:Category;gender?:CharacterGender|'unisex'}){
  let nextCategory=next.category??category,nextGender=next.gender??gender;
  // Weapons and costumes are unisex; outfits and faces always belong to a gender.
  if(next.category){if(nextCategory==='weapon'||nextCategory==='costume')nextGender='unisex';else if((nextCategory==='outfit'||nextCategory==='face')&&nextGender==='unisex')nextGender=p.gender;}
  else if(next.gender){if((nextCategory==='weapon'||nextCategory==='costume')&&nextGender!=='unisex')nextCategory='all';if((nextCategory==='outfit'||nextCategory==='face')&&nextGender==='unisex')nextCategory='all';}
  setCategory(nextCategory);setGender(nextGender);setPage(0);setCartOpen(false);setTip(null);
 }
 function tipEvents(id:string){return {
  onMouseEnter:(event:React.MouseEvent<HTMLElement>)=>{if(Date.now()>touchUntil.current)setTip({id,anchor:event.currentTarget,mode:'hover'});},onMouseLeave:()=>setTip(current=>current?.mode==='touch'?current:null),
  onFocus:(event:React.FocusEvent<HTMLElement>)=>{if(Date.now()>touchUntil.current)setTip({id,anchor:event.currentTarget,mode:'focus'});},onBlur:()=>setTip(current=>current?.mode==='touch'?current:null),
  onPointerDown:(event:ReactPointerEvent<HTMLElement>)=>{if(event.pointerType==='touch')touchUntil.current=Date.now()+900;},
  onClick:(event:React.MouseEvent<HTMLElement>)=>{const anchor=event.currentTarget;setTip(current=>current?.id===id&&current.mode==='touch'?null:{id,anchor,mode:'touch'});}
 };}
 const tipped=(id:string)=>tip?.id===id?'item-tooltip':undefined;

 return <Modal title="Loja da Brasa" onClose={onClose} className="shop-window" viewport>
  <div className="shop-layout">
   <aside className="shop-fitting" aria-label="Provador da loja">
    <header className="shop-fitting-head">
     <LevelBadge level={p.level} size={42}/>
     <div className="shop-identity"><small>Provador</small><h2>{p.name}</h2></div>
     <ItemGenderBadge gender={p.gender} compact/>
    </header>
    <div className="shop-stage">
     <i className="wood-sigil shop-sigil" aria-hidden="true"/>
     <Avatar equipment={draft} size={340} animated={false}/>
     <button className="shop-restore" onClick={restore} disabled={!trying} aria-label="Restaurar visual" title="Restaurar visual"><RotateCcw size={18}/></button>
     {trying&&<div className="shop-preview-caption"><span>{CATALOG[trying].name}</span></div>}
    </div>
    <div className="shop-preview-power"><PowerIcon size={28}/><span>Poder na prévia</span><strong>{money(previewStats.power)}</strong></div>
    <footer className="shop-purse"><RewardIcon size={30}/><div><small>Moedas Brasa</small><strong>{money(p.gold)}</strong></div></footer>
   </aside>
   <section className="shop-pane" aria-label={cartOpen?'Carrinho de compras':'Catálogo da loja'}>
    <div className="shop-toolbar">
     <div className="shop-gender" role="group" aria-label="Coleções da loja">{GENDERS.map(({id,label})=><button key={id} data-gender={id} aria-pressed={!cartOpen&&gender===id} onClick={()=>browse({gender:id})}>{id==='unisex'?<Users size={15}/>:<span className="item-gender-symbol" aria-hidden="true">{id==='male'?'♂':'♀'}</span>}<span>{label}</span></button>)}</div>
     <label><Search size={15}/><input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);setCartOpen(false);setTip(null);}} placeholder="Buscar na loja…" aria-label="Buscar na loja"/></label>
    </div>
    <div className="shop-shelf">
     {cartOpen?<div className="shop-cart">
      <div className="shop-cart-heading"><button className="wood-quiet" onClick={()=>setCartOpen(false)}><ArrowLeft size={16}/> Continuar comprando</button><strong>Meu carrinho</strong></div>
      <div className="shop-cart-list">{cartItems.length?cartItems.map(id=>{const item=CATALOG[id];return <article className="shop-cart-row" key={id}>
       <ItemCard rarity={item.rarity} aria-label={`Experimentar ${item.name}`} onClick={()=>experiment(id)}><ItemIcon id={id} size={52}/></ItemCard>
       <div><strong>{item.name}</strong><small>{SLOT_NAMES[item.slot]} · {rarityLabel(item.rarity)}</small></div>
       <span className="shop-price"><RewardIcon size={22}/>{money(SHOP_OFFER_BY_ID[id].price)}</span>
       <button className="shop-remove" disabled={pending} aria-label={`Remover ${item.name} do carrinho`} onClick={()=>setCart(current=>current.filter(value=>value!==id))}><Trash2 size={16}/></button>
      </article>;}):<div className="shop-empty"><ShoppingCart size={40}/><strong>Seu carrinho está vazio</strong><button className="wood-button" onClick={()=>setCartOpen(false)}>Explorar a loja</button></div>}</div>
     </div>:<div className="shop-grid">
      {visible.map(id=>{const {price}=SHOP_OFFER_BY_ID[id],item=CATALOG[id],inCart=cartItems.includes(id),has=owned.has(id),compatible=canEquipItem(item,p.gender);return <article key={id} className={`shop-offer ${trying===id?'trying':''} ${!compatible?'gender-locked':''}`} data-shop-item={id} data-item-gender={itemGender(item)} data-gender-locked={!compatible||undefined}>
       <ItemCard rarity={item.rarity} selected={trying===id} aria-label={`Ver informações de ${item.name}`} aria-describedby={tipped(id)} {...tipEvents(id)}><ItemIcon id={id} upgrade={0} size={64}/></ItemCard>
       <div className="shop-offer-info">
        <h2>{item.name}</h2>
        <small>{SLOT_NAMES[item.slot]}{item.slot==='weapon'?' · +0':''}</small>
        <ItemGenderBadge gender={itemGender(item)} locked={!compatible}/>
       </div>
       <div className="shop-offer-buy">
        <span className="shop-price"><RewardIcon size={20}/>{money(price)}</span>
        <div className="shop-offer-actions">
         <button className="shop-try" disabled={!compatible} aria-pressed={trying===id} aria-label={`Experimentar ${item.name}`} title="Prévia" onClick={()=>experiment(id)}>{compatible?<Eye size={15}/>:<LockKeyhole size={14}/>}<span>Prévia</span></button>
         <button className="shop-add" disabled={!compatible||has||inCart||locked} aria-label={has?`${item.name} já está na mochila`:inCart?`${item.name} no carrinho`:`Adicionar ${item.name} ao carrinho`} title={has?'Na mochila':inCart?'No carrinho':'Adicionar ao carrinho'} onClick={()=>add(id)}>{!compatible?<LockKeyhole size={15}/>:has||inCart?<Check size={17}/>:<ShoppingCart size={17}/>}</button>
        </div>
       </div>
       {has&&<span className="shop-owned"><Check size={11}/> Na mochila</span>}
      </article>;})}
      {!entries.length&&<div className="shop-empty"><Search size={34}/><strong>Nenhum item encontrado</strong><span>Tente outro nome ou categoria.</span></div>}
     </div>}
     <nav className="shop-tabs" aria-label="Categorias da loja">{CATEGORIES.map(({id,label,Icon})=><button key={id} className={!cartOpen&&category===id?'active':''} aria-pressed={!cartOpen&&category===id} onClick={()=>browse({category:id})}><Icon size={19} aria-hidden="true"/><span>{label}</span></button>)}</nav>
    </div>
    <div className="shop-pagination">
     <div className="shop-notes">
      {gender!=='unisex'&&gender!==p.gender&&!cartOpen&&<span className="shop-gender-notice"><LockKeyhole size={12}/>Exclusivo para personagem {ITEM_GENDER_LABELS[gender].toLowerCase()}</span>}
      <span className="shop-feedback" role="status">{feedback&&<>{feedback}<button aria-label="Dispensar mensagem da loja" onClick={()=>setFeedback('')}><X size={12}/></button></>}</span>
     </div>
     {!cartOpen&&<div className="shop-pager"><button aria-label="Página anterior" disabled={currentPage===0} onClick={()=>{setPage(currentPage-1);setTip(null);}}><ChevronLeft size={16}/></button><span>{currentPage+1} / {pages}</span><button aria-label="Próxima página" disabled={currentPage===pages-1} onClick={()=>{setPage(currentPage+1);setTip(null);}}><ChevronRight size={16}/></button></div>}
    </div>
    <footer className="shop-counter">
     <button className={`shop-cart-button ${cartOpen?'active':''}`} aria-pressed={cartOpen} onClick={()=>{setCartOpen(!cartOpen);setTip(null);}}><ShoppingCart size={18}/><span>{cartOpen?'Ver loja':'Ver carrinho'}</span><b>{cartItems.length}</b></button>
     <div className={`shop-checkout-total ${short?'short':''}`}><span>Total</span><strong><RewardIcon size={22}/>{money(total)}</strong></div>
     {short&&<p className="shop-insufficient">Faltam {money(total-p.gold)}</p>}
     <button className="wood-button shop-buy" disabled={locked||!cartItems.length||short} aria-busy={pending} onClick={buy}>{pending?<LoaderCircle size={18} className="button-spinner"/>:<ShoppingBag size={18}/>} {pending?'Comprando…':'Comprar tudo'}</button>
    </footer>
   </section>
  </div>
  {tip&&createPortal(<InventoryTooltip tip={tip} gender={p.gender} equipment={draft} upgrades={{}} compositions={p.compositions} action={canEquipItem(tip.id,p.gender)?`Permanente · ${money(SHOP_OFFER_BY_ID[tip.id]?.price??0)} Moedas Brasa${CATALOG[tip.id]?.slot==='weapon'?' · +0':''}`:undefined}/>,document.body)}
 </Modal>;
}
