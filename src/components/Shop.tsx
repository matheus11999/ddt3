import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,Check,Eye,Glasses,Info,LoaderCircle,LockKeyhole,RotateCcw,Search,Shirt,ShoppingBag,ShoppingCart,Smile,Sparkles,Swords,Trash2,Users,X} from 'lucide-react';
import {attributes,CATALOG,itemAttributes,SLOT_NAMES,WEAPONS,weaponStats,canEquipItem,itemGender,normalizeVisibility} from '../../shared/catalog';
import type {CharacterGender,Equipment} from '../../shared/catalog';
import {MAX_SHOP_ITEMS,SHOP_OFFERS,SHOP_OFFER_BY_ID} from '../../shared/shop';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {Avatar} from './Avatar';
import {ItemCard,ItemCardFrame,rarityLabel} from './ItemCard';
import {ItemIcon} from './ItemIcon';
import {LevelBadge} from './LevelBadge';
import {Modal} from './Modal';
import {PowerIcon} from './PowerIcon';
import {RewardIcon} from './RewardIcon';
import {ItemGenderBadge,ITEM_GENDER_LABELS} from './ItemGenderBadge';
import './Inventory.css';
import './Shop.css';

const CATEGORIES=[{id:'all',label:'Destaques',Icon:ShoppingBag},{id:'weapon',label:'Armas',Icon:Swords},{id:'outfit',label:'Roupas',Icon:Shirt},{id:'costume',label:'Fantasias',Icon:Sparkles},{id:'face',label:'Rostos',Icon:Smile},{id:'style',label:'Complementos',Icon:Glasses}] as const;
const GENDERS=[{id:'male',label:'Masculino'},{id:'female',label:'Feminino'},{id:'unisex',label:'Unissex'}] as const;
type Category=typeof CATEGORIES[number]['id'];
type Tip={id:string;anchor:HTMLElement};
const money=(value:number)=>value.toLocaleString('pt-BR');
const searchable=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');

export function Shop({onClose}:{onClose:()=>void}){
 const state=useGame(),p=state.profile!;
 const [category,setCategory]=useState<Category>('all'),[query,setQuery]=useState(''),[gender,setGender]=useState<CharacterGender|'unisex'>(p.gender),[cart,setCart]=useState<string[]>([]),[cartOpen,setCartOpen]=useState(false);
 const [draft,setDraft]=useState<Equipment>(()=>({...p.equipment,dyes:{...p.equipment.dyes}})),[trying,setTrying]=useState<string|null>(null),[tip,setTip]=useState<Tip|null>(null),[feedback,setFeedback]=useState(''),[pending,setPending]=useState(false);
 const request=useRef<string[]|null>(null);
 const owned=useMemo(()=>new Set(p.inventory),[p.inventory]);
 const cartItems=cart.filter(id=>!owned.has(id)&&!!SHOP_OFFER_BY_ID[id]&&canEquipItem(id,p.gender)),total=cartItems.reduce((sum,id)=>sum+SHOP_OFFER_BY_ID[id].price,0);
 const locked=pending||state.status!=='online'||!!state.battle||!!state.room;
 const entries=SHOP_OFFERS.filter(({id})=>{const item=CATALOG[id];return item&&itemGender(item)===gender&&(category==='all'||category==='style'&&!['weapon','outfit','face','costume'].includes(item.slot)||item.slot===category)&&searchable(item.name).includes(searchable(query));});
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
 function buy(){if(locked||!cartItems.length||total>p.gold)return;request.current=[...cartItems];setPending(true);setFeedback('');client.update({error:null});client.send({type:'shop-buy',items:[...cartItems]});}
 function restore(){setDraft({...p.equipment,dyes:{...p.equipment.dyes}});setTrying(null);audio.play('click');}
 return <Modal title="Loja da Brasa" onClose={onClose} className="inventory-window shop-window" viewport>
  <div className="shop-body">
   <aside className="shop-dressing" aria-label="Provador da loja">
    <div className="shop-player"><LevelBadge level={p.level} size={42}/><strong>{p.name}</strong><ItemGenderBadge gender={p.gender} compact/></div>
    <div className="shop-avatar"><Avatar equipment={draft} size={350} animated={false}/></div>
    {trying&&<div className="shop-preview-caption"><span>{CATALOG[trying].name}</span></div>}
    <button className="shop-restore" onClick={restore} disabled={!trying} aria-label="Restaurar visual" title="Restaurar visual"><RotateCcw size={19}/></button>
    <div className="shop-preview-power"><PowerIcon size={28}/><span>Poder na prévia</span><strong>{money(previewStats.power)}</strong></div>
    <div className="shop-wallet"><RewardIcon size={37}/><div><small>SUAS MOEDAS BRASA</small><strong>{money(p.gold)}</strong></div></div>
   </aside>
   <section className="shop-catalog" aria-label={cartOpen?'Carrinho de compras':'Catálogo da loja'}>
    <div className="shop-toolbar"><label><Search size={16}/><input value={query} onChange={e=>{setQuery(e.target.value);setCartOpen(false);}} placeholder="Buscar na loja…" aria-label="Buscar na loja"/></label><button className={`shop-cart-button ${cartOpen?'active':''}`} aria-pressed={cartOpen} onClick={()=>{setCartOpen(!cartOpen);setTip(null);}}><ShoppingCart size={19}/><span>{cartOpen?'Ver loja':'Ver carrinho'}</span><b>{cartItems.length}</b></button></div>
    {cartOpen?<>
     <div className="shop-cart-heading"><button onClick={()=>setCartOpen(false)}><ArrowLeft size={17}/> Continuar comprando</button><strong>Meu carrinho</strong></div>
     <div className="shop-cart-list">{cartItems.length?cartItems.map(id=>{const item=CATALOG[id];return <article className="shop-cart-row" key={id}>
      <ItemCard rarity={item.rarity} aria-label={`Experimentar ${item.name}`} disabled={!canEquipItem(item,p.gender)} onClick={()=>experiment(id)}><ItemIcon id={id} size={52}/></ItemCard><div><strong>{item.name}</strong><small>{SLOT_NAMES[item.slot]} · {rarityLabel(item.rarity)}</small></div><span className="shop-price"><RewardIcon size={22}/>{money(SHOP_OFFER_BY_ID[id].price)}</span><button className="shop-remove" disabled={pending} aria-label={`Remover ${item.name} do carrinho`} onClick={()=>setCart(current=>current.filter(value=>value!==id))}><Trash2 size={17}/></button>
     </article>;}):<div className="shop-empty"><ShoppingCart size={42}/><strong>Seu carrinho está vazio</strong><span>Escolha algo com a sua cara.</span><button className="button gold" onClick={()=>setCartOpen(false)}>Explorar a loja</button></div>}</div>
     <div className="shop-checkout"><div className="shop-checkout-total"><span>{cartItems.length} {cartItems.length===1?'item':'itens'}</span><strong>Total <RewardIcon size={27}/> {money(total)}</strong></div>{total>p.gold&&<p className="shop-insufficient">Faltam {money(total-p.gold)} Moedas Brasa.</p>}<button className="button gold shop-buy" disabled={locked||!cartItems.length||total>p.gold} aria-busy={pending} onClick={buy}>{pending?<LoaderCircle size={18} className="button-spinner"/>:<ShoppingBag size={18}/>} {pending?'Comprando…':'Comprar tudo'}</button><span className="shop-purchase-hint">Itens permanentes · armas sem fortalecimento</span></div>
    </>:<>
     <div className="shop-gender" role="group" aria-label="Coleções da loja">{GENDERS.map(({id,label})=><button key={id} data-gender={id} aria-pressed={gender===id} onClick={()=>{setGender(id);if((category==='weapon'||category==='costume')&&id!=='unisex')setCategory('all');if((category==='outfit'||category==='face')&&id==='unisex')setCategory('all');setTip(null);}}>{id==='unisex'?<Users size={15}/>:<span className="item-gender-symbol" aria-hidden="true">{id==='male'?'♂':'♀'}</span>}<span>{label}</span></button>)}</div>
     <nav className="shop-categories" aria-label="Categorias da loja">{CATEGORIES.map(({id,label,Icon})=><button key={id} className={category===id?'active':''} aria-pressed={category===id} onClick={()=>{setCategory(id);if(id==='weapon'||id==='costume')setGender('unisex');else if((id==='outfit'||id==='face')&&gender==='unisex')setGender(p.gender);setTip(null);}}><Icon size={17}/><span>{label}</span></button>)}</nav>
     {gender!=='unisex'&&gender!==p.gender&&<div className="shop-gender-notice"><LockKeyhole size={13}/><span>Exclusivo para personagem {ITEM_GENDER_LABELS[gender].toLowerCase()}</span></div>}
     <div className="shop-grid">{entries.map(({id,price})=>{const item=CATALOG[id],inCart=cartItems.includes(id),has=owned.has(id),compatible=canEquipItem(item,p.gender);return <article key={id} className={`shop-offer ${trying===id?'trying':''} ${!compatible?'gender-locked':''}`} data-shop-item={id} data-item-gender={itemGender(item)} data-gender-locked={!compatible||undefined}>
      <div className="shop-offer-art"><ItemCard rarity={item.rarity} variant="preview" selected={trying===id} aria-label={`Ver informações de ${item.name}`} aria-describedby={tip?.id===id?'shop-item-tooltip':undefined} onMouseEnter={e=>setTip({id,anchor:e.currentTarget})} onMouseLeave={()=>setTip(null)} onFocus={e=>setTip({id,anchor:e.currentTarget})} onBlur={()=>setTip(null)} onClick={e=>setTip(tip?.id===id?null:{id,anchor:e.currentTarget})}><ItemIcon id={id} upgrade={0} size={68}/></ItemCard><button className="shop-info" aria-label={`Detalhes de ${item.name}`} onClick={e=>setTip(tip?.id===id?null:{id,anchor:e.currentTarget})}><Info size={15}/></button>{has&&<span className="shop-owned"><Check size={12}/> Na mochila</span>}</div>
      <h2>{item.name}</h2><ItemGenderBadge gender={itemGender(item)} locked={!compatible}/><div className="shop-offer-meta"><span className="shop-item-kind">{SLOT_NAMES[item.slot]}{item.slot==='weapon'?' · +0':''}</span><span className="shop-price"><RewardIcon size={19}/>{money(price)}</span></div>
      <div className="shop-offer-actions"><button className="shop-try" disabled={!compatible} aria-pressed={trying===id} aria-label={`Experimentar ${item.name}`} onClick={()=>experiment(id)}>{compatible?<Eye size={14}/>:<LockKeyhole size={14}/>} Prévia</button><button className="shop-add" disabled={!compatible||has||inCart||locked} aria-label={has?`${item.name} já está na mochila`:inCart?`${item.name} no carrinho`:`Adicionar ${item.name} ao carrinho`} onClick={()=>add(id)}>{!compatible?<LockKeyhole size={15}/>:has||inCart?<Check size={17}/>:<ShoppingCart size={17}/>}</button></div>
     </article>;})}{!entries.length&&<div className="shop-empty"><Search size={34}/><strong>Nenhum item encontrado</strong><span>Tente outro nome ou categoria.</span></div>}</div>
     <div className="shop-catalog-footer"><span>{entries.length} opções para sua aventura</span><button disabled={!cartItems.length} onClick={()=>setCartOpen(true)}>Ver carrinho <ShoppingCart size={15}/>{cartItems.length>0&&<b>{money(total)}</b>}</button></div>
    </>}
    <div className={`shop-feedback ${feedback?'visible':''}`} role="status">{feedback||' '}{feedback&&<button aria-label="Dispensar mensagem da loja" onClick={()=>setFeedback('')}><X size={13}/></button>}</div>
   </section>
  </div>
  {tip&&createPortal(<ShopTooltip tip={tip} gender={p.gender}/>,document.body)}
 </Modal>;
}

function ShopTooltip({tip,gender}:{tip:Tip;gender:CharacterGender}){
 const item=CATALOG[tip.id],values=itemAttributes(item),weapon=WEAPONS.find(entry=>entry.id===item.id),stats=weapon?weaponStats(weapon,0):null;
 const ref=useRef<HTMLElement>(null),[position,setPosition]=useState<{x:number;y:number}|null>(null);
 useLayoutEffect(()=>{const bounds=ref.current!.getBoundingClientRect(),anchor=tip.anchor.getBoundingClientRect(),edge=10;let x=anchor.right+10,y=anchor.top;if(x+bounds.width>innerWidth-edge)x=anchor.left-bounds.width-10;if(x<edge){x=(innerWidth-bounds.width)/2;y=anchor.bottom+10;if(y+bounds.height>innerHeight-edge)y=anchor.top-bounds.height-10;}setPosition({x:Math.max(edge,Math.min(x,innerWidth-bounds.width-edge)),y:Math.max(edge,Math.min(y,innerHeight-bounds.height-edge))});},[tip]);
 return <aside id="shop-item-tooltip" ref={ref} role="tooltip" className="inventory-tooltip item-tooltip shop-tooltip" data-rarity={item.rarity} style={{left:position?.x??0,top:position?.y??0,visibility:position?'visible':'hidden'}}><header><ItemCardFrame rarity={item.rarity}><ItemIcon id={item.id} size={48}/></ItemCardFrame><div><small>{rarityLabel(item.rarity)} · {SLOT_NAMES[item.slot]}</small><div className="tooltip-name"><strong>{item.name}</strong></div></div></header><div className="tooltip-gender"><ItemGenderBadge gender={itemGender(item)} locked={!canEquipItem(item,gender)}/></div><p>{item.description}</p>{Object.values(values).some(Boolean)?<dl><dt>Ataque</dt><dd>{values.attack}</dd><dt>Defesa</dt><dd>{values.defense}</dd><dt>Dano</dt><dd>{values.damage}</dd><dt>Armadura</dt><dd>{values.armor}</dd><dt>Agilidade</dt><dd>{values.agility}</dd><dt>Sorte</dt><dd>{values.luck}</dd>{stats&&<><dt>Destruição</dt><dd>{stats.crater}</dd><dt>Ângulo</dt><dd>{stats.minAngle}°–{stats.maxAngle}°</dd></>}</dl>:<div className="cosmetic-tooltip-note">Visual cosmético · não altera atributos</div>}<footer>Permanente{item.slot==='weapon'?' · fortalecimento +0':''}</footer></aside>;
}
