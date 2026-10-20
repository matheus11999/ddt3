import {CouponIcon,RewardIcon} from './RewardIcon';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {Check,ChevronLeft,ChevronRight,CircleDot,Crosshair,Flame,Footprints,Clover,Gem,Glasses,GraduationCap,Hammer,Heart,LayoutGrid,Medal,MessageCircle,Palette,PersonStanding,Scissors,Search,Settings,Shield,ShieldCheck,Shirt,Smile,Sparkles,Swords,Watch,X,Zap} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {PowerCounter} from './PowerCounter';
import {ARMOR_SLOTS,canStrengthen,isArmorSlot,slotUpgrade,attributes,itemAttributes,CATALOG,ITEMS,SLOTS,SLOT_NAMES,STONES,WEAPONS,weaponStats,canEquipItem,itemGender,unequipForGender,isEmptyItem,slotAccepts,slotFamily,slotsForItem,targetSlotForItem,CLASSED_SLOTS,SLOT_FAMILY,copyBase,equippedCompositions,equippedCopy,isCopyKey} from '../../shared/catalog';
import type {CharacterGender,Equipment,Slot} from '../../shared/catalog';
import {COLOR_TICKET,equippedColors} from '../../shared/colors';
import {canCompose} from '../../shared/composition';
import {BagContextMenu,ColorStudio,DiscardConfirm,MENU_ICONS,TicketIcon,canRecolor} from './ColorStudio';
import type {BagMenuAction,ColorTarget} from './ColorStudio';
import {levelProgress} from '../../shared/progression';
import type {Compositions} from '../../shared/composition';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {Avatar} from './Avatar';
import {ItemIcon} from './ItemIcon';
import {Modal} from './Modal';
import {LevelBadge} from './LevelBadge';
import {PowerIcon} from './PowerIcon';
import {ItemGenderBadge} from './ItemGenderBadge';
import {ItemCard,ItemCardFrame,itemTier,rarityLabel,stoneRarity} from './ItemCard';
import {UpgradeTag} from './UpgradeTag';
import './Inventory.css';
import './Backpack.css';

const PAGE_SIZE=42;
const ITEM_DRAG='application/x-brasa-item',SLOT_DRAG='application/x-brasa-slot';
export const LEFT_SLOTS:Slot[]=['hair','hat','glasses','face','ring'];
export const RIGHT_SLOTS:Slot[]=['outfit','costume','wristband','bracelet','ring2'];
export const LOWER_SLOTS:Slot[]=['weapon','necklace','bubble'];
export const SLOT_ICONS:Record<Slot,LucideIcon>={hair:Scissors,hat:GraduationCap,glasses:Glasses,face:Smile,outfit:Shirt,costume:Sparkles,wristband:Watch,bracelet:Gem,weapon:Crosshair,ring:CircleDot,ring2:CircleDot,necklace:Medal,bubble:MessageCircle};
const BAG_TABS:{id:string;name:string;Icon:LucideIcon}[]=[{id:'all',name:'Tudo',Icon:LayoutGrid},{id:'style',name:'Visuais',Icon:Shirt},{id:'weapons',name:'Armas',Icon:Swords},{id:'stones',name:'Pedras',Icon:Gem}];
export type Tip={id:string;anchor:HTMLElement;mode:'hover'|'focus'|'touch'};
function searchable(text:string){return text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}

export function Inventory({onClose,onForge}:{onClose:()=>void;onForge:(item?:string)=>void}){
 const state=useGame(),p=state.profile!;
 const equipment=state.customizationEquipment??p.equipment,pending=state.customizationPending;
 const [tab,setTab]=useState('all'),[category,setCategory]=useState<Slot|'all'>('all'),[activeSlot,setActiveSlot]=useState<Slot|null>(null),[query,setQuery]=useState(''),[page,setPage]=useState(0);
 const [selected,setSelected]=useState(()=>equippedCopy(p.equipment,'weapon')),[dragging,setDragging]=useState<string|null>(null),[tooltip,setTooltip]=useState<Tip|null>(null);
 const [feedback,setFeedback]=useState<string|null>(null);
 const [menu,setMenu]=useState<{x:number;y:number;key:string;slot?:Slot}|null>(null),[studio,setStudio]=useState<ColorTarget|null>(null),[discarding,setDiscarding]=useState<string|null>(null),[discardPending,setDiscardPending]=useState(false);
 const discardSent=useRef<unknown>(null);
 const hold=useRef<{timer:ReturnType<typeof setTimeout>|null;x:number;y:number;triggered:boolean}>({timer:null,x:0,y:0,triggered:false}),touchUntil=useRef(0);
 const [previewFlash,setPreviewFlash]=useState<{id:string;key:number}|null>(null);
 const [displayOptions,setDisplayOptions]=useState(false),optionsRef=useRef<HTMLDivElement>(null),optionsButton=useRef<HTMLButtonElement>(null);
 const locked=!!state.battle||state.status!=='online';
 const preview=useMemo(()=>({...equipment,upgrade:p.upgrades[equippedCopy(equipment,'weapon')]??0,slotUpgrades:Object.fromEntries(ARMOR_SLOTS.map(slot=>[slot,p.upgrades[equippedCopy(equipment,slot)]??0])),compositions:equippedCompositions(equipment,p.compositions),colors:equippedColors(equipment,p.itemColors),skin:p.bodyColors.skin,eyes:p.bodyColors.eyes}),[equipment,p.upgrades,p.compositions,p.itemColors,p.bodyColors]);
 const stats=attributes(preview,p.level),item=CATALOG[copyBase(selected)],unequip=unequipForGender(p.gender);
 // Every owned copy is its own card (repeat purchases), listed right after the first one.
 const entries=[...ITEMS.filter(i=>!isEmptyItem(i)&&p.inventory.includes(i.id)&&(tab==='all'||tab==='weapons'&&i.slot==='weapon'||tab==='style'&&i.slot!=='weapon')&&(category==='all'||i.slot===category)&&searchable(i.name).includes(searchable(query))).flatMap(i=>p.inventory.filter(key=>copyBase(key)===i.id)),...(tab==='all'&&category==='all'&&p.colorTickets>0&&searchable(COLOR_TICKET.name).includes(searchable(query))?[COLOR_TICKET.id]:[]),...((tab==='all'||tab==='stones')&&category==='all'?STONES.filter(s=>(p.stones[String(s.level)]??0)>0&&searchable(s.name).includes(searchable(query))).map(s=>`stone-${s.level}`):[])];
 const pages=Math.max(1,Math.ceil(entries.length/PAGE_SIZE)),currentPage=Math.min(page,pages-1),visible=entries.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);

 useEffect(()=>{if(!previewFlash)return;const timer=setTimeout(()=>setPreviewFlash(null),650);return()=>clearTimeout(timer);},[previewFlash]);
 useEffect(()=>{if(!tooltip)return;const dismiss=()=>setTooltip(null),outside=(event:Event)=>{if(!tooltip.anchor.contains(event.target as Node))dismiss();};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismiss();}};window.addEventListener('keydown',escape,true);window.addEventListener('resize',dismiss);window.addEventListener('scroll',dismiss,true);window.addEventListener('pointerdown',outside,true);return()=>{window.removeEventListener('keydown',escape,true);window.removeEventListener('resize',dismiss);window.removeEventListener('scroll',dismiss,true);window.removeEventListener('pointerdown',outside,true);};},[tooltip]);
 useEffect(()=>()=>{if(hold.current.timer)clearTimeout(hold.current.timer);},[]);
 useEffect(()=>{
  if(!displayOptions)return;
  optionsRef.current?.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});
  const outside=(event:PointerEvent)=>{if(!optionsRef.current?.contains(event.target as Node)&&!optionsButton.current?.contains(event.target as Node))setDisplayOptions(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setDisplayOptions(false);optionsButton.current?.focus();}};
  window.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape,true);return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape,true);};
 },[displayOptions]);

 function equipItem(id:string,slot?:Slot){
  if(hold.current.triggered){hold.current.triggered=false;return;}
  setSelected(id);setTooltip(current=>current?.id===id&&current.mode!=='touch'?current:null);
  const next=CATALOG[copyBase(id)];if(locked||!next||(!p.inventory.includes(id)&&!isEmptyItem(next))||!canEquipItem(next,p.gender))return;
  const target=slot&&slotAccepts(slot,next)?slot:activeSlot&&slotAccepts(activeSlot,next)?activeSlot:targetSlotForItem(equipment,next);
  if(equippedCopy(equipment,target)===id)return;
  // The same item cannot sit in both ring slots: moving it frees the other one.
  const freed=Object.fromEntries(slotsForItem(next).filter(other=>other!==target&&equipment[other]===next.id).map(other=>[other,unequip[other]??next.id]));
  client.customize({items:{...freed,[target]:next.id},copies:isCopyKey(id)?{[target]:id}:{}});setPreviewFlash({id,key:Date.now()});setFeedback(null);audio.play('click');
 }
 useEffect(()=>{
  if(!discardSent.current)return;const result=state.discardResult;
  if(result&&result!==discardSent.current){const name=CATALOG[copyBase(result.item)]?.name??'Item';discardSent.current=null;setDiscardPending(false);setDiscarding(null);setFeedback(`${name} excluído da mochila.`);if(selected===result.item)setSelected(equippedCopy(p.equipment,'weapon'));return;}
  if(state.error||state.status!=='online'){discardSent.current=null;setDiscardPending(false);setDiscarding(null);if(state.error)setFeedback(state.error);}
 },[state.discardResult,state.error,state.status,selected,p.equipment]);
 const closeStudio=useCallback(()=>setStudio(null),[]),studioDone=useCallback((message:string)=>{setStudio(null);setFeedback(message);},[]);
 /** The game's menu replaces the browser's on every item, worn or in the bag. */
 function openMenu(event:React.MouseEvent<HTMLElement>,key:string,slot?:Slot){
  event.preventDefault();if(Date.now()<touchUntil.current)return;
  const it=CATALOG[copyBase(key)];if(!it||isEmptyItem(it))return;
  endTouchTip();setTooltip(null);setSelected(key);setMenu({x:event.clientX,y:event.clientY,key,slot});audio.play('click');
 }
 function menuActions(key:string,slot?:Slot):BagMenuAction[]{
  const it=CATALOG[copyBase(key)]!,worn=slotsForItem(it).find(s=>equippedCopy(equipment,s)===key),fits=canEquipItem(it,p.gender),actions:BagMenuAction[]=[];
  const wornSlot=slot??worn,fallback=wornSlot?unequip[wornSlot]:undefined,removable=!!wornSlot&&!!fallback&&(isEmptyItem(fallback)||p.inventory.includes(fallback))&&equipment[wornSlot]!==fallback;
  if(!worn)actions.push({id:'equip',label:'Equipar',icon:MENU_ICONS.equip,disabled:locked||!fits,title:fits?undefined:'Incompatível com este personagem',onSelect:()=>equipItem(key)});
  else if(removable)actions.push({id:'unequip',label:'Remover',icon:MENU_ICONS.equip,disabled:locked,onSelect:()=>removeFromSlot(wornSlot!)});
  if(canStrengthen(it)||canCompose(it))actions.push({id:'forge',label:'Aprimorar',icon:MENU_ICONS.forge,disabled:!!state.room||pending,title:state.room?'Volte à praça para visitar o ferreiro':undefined,onSelect:()=>onForge(key)});
  if(canRecolor(key)&&fits)actions.push({id:'color',label:'Trocar cor',icon:MENU_ICONS.color,disabled:locked,onSelect:()=>setStudio({kind:'item',key})});
  const last=['weapon','outfit','face'].includes(it.slot)&&p.inventory.filter(other=>CATALOG[copyBase(other)]?.slot===it.slot&&canEquipItem(copyBase(other),p.gender)).length<=1;
  actions.push({id:'discard',label:'Excluir',icon:MENU_ICONS.discard,danger:true,disabled:locked||last,title:last?`Você precisa ficar com pelo menos um item de ${SLOT_NAMES[it.slot].toLowerCase()}`:undefined,onSelect:()=>setDiscarding(key)});
  return actions;
 }
 function confirmDiscard(){if(!discarding||locked)return;discardSent.current=state.discardResult??{};setDiscardPending(true);client.discard(discarding);audio.play('click');}
 /** Double click, drag to the bag or Remover: the slot goes back to its empty item (or the starter face/outfit). */
 function canRemove(slot:Slot){const fallback=unequip[slot];return !locked&&!!fallback&&equipment[slot]!==fallback&&(isEmptyItem(fallback)||p.inventory.includes(fallback));}
 function removeFromSlot(slot:Slot){
  if(canRemove(slot)){equipItem(unequip[slot]!,slot);return;}
  // Face and outfit always show something: the starter ones are what the character falls back to.
  if(!locked&&!isEmptyItem(equipment[slot])&&equipment[slot]===unequip[slot])setFeedback(slot==='outfit'?'Esta é a roupa inicial: o personagem sempre fica vestido.':'Este é o rosto inicial: o personagem sempre tem um rosto.');
 }
 function filterBySlot(slot:Slot){if(hold.current.triggered){hold.current.triggered=false;return;}setSelected(equippedCopy(equipment,slot));setActiveSlot(slot);setCategory(slotFamily(slot));setTab(slot==='weapon'?'weapons':'style');setPage(0);setQuery('');setTooltip(null);}
 function showTip(id:string,anchor:HTMLElement,mode:Tip['mode']){if(dragging||mode!=='touch'&&Date.now()<touchUntil.current)return;setTooltip({id,anchor,mode});}
 function startTouchTip(id:string,event:ReactPointerEvent<HTMLElement>){
  if(event.pointerType!=='touch')return;touchUntil.current=Date.now()+1200;setTooltip(null);
  if(hold.current.timer)clearTimeout(hold.current.timer);hold.current={timer:null,x:event.clientX,y:event.clientY,triggered:false};
  const anchor=event.currentTarget;hold.current.timer=setTimeout(()=>{hold.current.triggered=true;showTip(id,anchor,'touch');},430);
 }
 function endTouchTip(){if(hold.current.timer)clearTimeout(hold.current.timer);hold.current.timer=null;}
 function moveTouchTip(event:ReactPointerEvent<HTMLElement>){if(event.pointerType!=='touch')return;if(Math.hypot(event.clientX-hold.current.x,event.clientY-hold.current.y)>10){endTouchTip();hold.current.triggered=false;setTooltip(null);}}
 function tooltipEvents(id:string){return {
  onMouseEnter:(event:React.MouseEvent<HTMLElement>)=>showTip(id,event.currentTarget,'hover'),onMouseLeave:()=>setTooltip(null),
  onFocus:(event:React.FocusEvent<HTMLElement>)=>showTip(id,event.currentTarget,'focus'),onBlur:()=>setTooltip(null),
  onPointerDown:(event:ReactPointerEvent<HTMLElement>)=>startTouchTip(id,event),onPointerUp:endTouchTip,onPointerCancel:()=>{endTouchTip();setTooltip(null);},onPointerMove:moveTouchTip,
  onContextMenu:(event:React.MouseEvent<HTMLElement>)=>openMenu(event,id)
 };}

 const renderSlot=(slot:Slot)=>{
  const id=equipment[slot],copy=equippedCopy(equipment,slot),it=CATALOG[id],empty=!it||isEmptyItem(it),Placeholder=SLOT_ICONS[slot];
  return <ItemCard key={slot} rarity={it?.rarity} selected={activeSlot===slot&&category===slotFamily(slot)} empty={empty} aria-label={`${SLOT_NAMES[slot]}: ${empty?'Vazio':it.name}`} data-slot={slot} aria-describedby={!empty&&tooltip?.id===copy?'item-tooltip':undefined} className={`bag-slot equipment-slot ${dragging&&slotAccepts(slot,CATALOG[copyBase(dragging)])?'drop-ready':''}`} onClick={()=>filterBySlot(slot)} onDoubleClick={()=>removeFromSlot(slot)}
   draggable={!empty&&canRemove(slot)} onDragStart={e=>{e.dataTransfer.setData(SLOT_DRAG,slot);e.dataTransfer.effectAllowed='move';setTooltip(null);}}
   {...(empty?{onContextMenu:(event:React.MouseEvent)=>event.preventDefault()}:{...tooltipEvents(copy),onContextMenu:(event:React.MouseEvent<HTMLElement>)=>openMenu(event,copy,slot)})}
   onDragOver={e=>{if(!locked){e.preventDefault();e.dataTransfer.dropEffect=dragging&&slotAccepts(slot,CATALOG[copyBase(dragging)])?'copy':'none';}}}
   onDrop={e=>{e.preventDefault();setDragging(null);const id=e.dataTransfer.getData(ITEM_DRAG),dropped=CATALOG[copyBase(id)];if(!id)return;if(slotAccepts(slot,dropped))equipItem(id,slot);else setFeedback(`Use o slot de ${SLOT_NAMES[dropped?.slot]??'equipamento'}.`);}}>
   {previewFlash?.id===copy&&<i key={previewFlash.key} className="item-preview-pulse" aria-hidden="true"/>}{empty?<Placeholder className="bag-slot-placeholder" aria-hidden="true"/>:<ItemIcon id={id} upgrade={slot==='weapon'?preview.upgrade:0} size={60} color={p.itemColors[copy]} skin={preview.skin} eyes={preview.eyes}/>}<span className="equipment-slot-label">{SLOT_NAMES[slot]}</span>{canStrengthen(it)&&!empty&&<UpgradeTag level={slotUpgrade(preview,slot)} className="bag-upgrade-tag"/>}
  </ItemCard>;
 };
 const progress=levelProgress(p.level,p.xp);

 return <Modal title="Mochila" onClose={studio||discarding||menu?()=>{}:onClose} className="bag-window" viewport>
  <div className="inventory-body bag-layout" onContextMenu={event=>event.preventDefault()}>
   <section className="bag-profile" aria-label="Informações pessoais">
    <header className="bag-profile-head">
     <LevelBadge level={p.level} size={42}/>
     <div className="bag-identity"><small>Informações pessoais</small><h2>{p.name}</h2><span className="equipment-status" role="status" aria-live="polite">{pending?'Aplicando…':'Visual equipado'}</span></div>
     <dl className="bag-records"><div><dt>Vitórias</dt><dd>{p.wins.toLocaleString('pt-BR')}</dd></div><div><dt>Partidas</dt><dd>{p.matches.toLocaleString('pt-BR')}</dd></div></dl>
    </header>
    <div className="bag-stage">
     <div className="equipment-slots left">{LEFT_SLOTS.map(renderSlot)}</div>
     <div className="dressing-room" onDragOver={e=>{if(!locked&&e.dataTransfer.types.includes(ITEM_DRAG)){e.preventDefault();e.dataTransfer.dropEffect='copy';}}} onDrop={e=>{e.preventDefault();if(e.target===e.currentTarget||!(e.target as HTMLElement).closest('[data-slot]'))equipItem(e.dataTransfer.getData(ITEM_DRAG));setDragging(null);}}>
      {preview.upgrade<5&&<i className="bag-sigil" aria-hidden="true"/>}
      <Avatar equipment={preview} size={340} animated={false} auraAnimated showAura weapon={false}/>
      <button className="avatar-body-color" aria-label="Cor do corpo e dos olhos" title="Cor do corpo e dos olhos" disabled={locked} onClick={()=>{setStudio({kind:'body',part:'skin'});setTooltip(null);audio.play('click');}}><PersonStanding size={18}/><Palette size={11} className="avatar-body-color-badge" aria-hidden="true"/></button>
      <button ref={optionsButton} className="avatar-options-toggle" aria-label="Exibição do personagem" aria-expanded={displayOptions} aria-controls="avatar-display-options" title="Exibição do personagem" onClick={()=>{setDisplayOptions(value=>!value);setTooltip(null);}}><Settings size={18}/></button>
      {displayOptions&&<div ref={optionsRef} id="avatar-display-options" className="avatar-display-options" role="dialog" aria-label="Exibição do personagem" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setDisplayOptions(false);optionsButton.current?.focus();}}}>
       <header><strong>Exibição</strong><button aria-label="Fechar exibição" onClick={()=>{setDisplayOptions(false);optionsButton.current?.focus();}}><X size={16}/></button></header>
       {([{id:'hat',label:'Exibir chapéu'},{id:'glasses',label:'Exibir óculos'},{id:'costume',label:'Exibir fantasia'}] as const).map(option=><label key={option.id}><input type="checkbox" checked={equipment.visibility?.[option.id]!==false} disabled={locked} onChange={event=>{client.customize({visibility:{[option.id]:event.target.checked}});setFeedback(null);}}/><span>{option.label}</span><Check size={13} aria-hidden="true"/></label>)}
      </div>}
     </div>
     <div className="equipment-slots right">{RIGHT_SLOTS.map(renderSlot)}</div>
     <div className="bag-stage-foot">
      <div className="equipment-slots lower">{LOWER_SLOTS.map(renderSlot)}</div>
     </div>
    </div>
    <div className="bag-progress">
     <div className="bag-level" title={`${progress.current} / ${progress.required} XP`}><span>Nv <b>{p.level}</b></span><div className="bag-xp" role="progressbar" aria-label="Experiência" aria-valuemin={0} aria-valuemax={progress.required} aria-valuenow={progress.current}><i style={{width:`${progress.percent}%`}}/><small>{progress.capped?'Nível máximo':`${progress.current} / ${progress.required}`}</small></div></div>
     <div className="combat-power"><PowerIcon size={28}/><span>Poder</span><PowerCounter value={stats.power}/></div>
    </div>
    <div className="stat-grid" aria-label="Atributos do personagem">
     <span data-stat="attack"><Swords size={14}/>Ataque<b>{stats.attack}</b></span><span data-stat="agility"><Zap size={14}/>Agilidade<b>{stats.agility}</b></span>
     <span data-stat="defense"><Shield size={14}/>Defesa<b>{stats.defense}</b></span><span data-stat="luck"><Clover size={14}/>Sorte<b>{stats.luck}</b></span>
     <span data-stat="damage"><Flame size={14}/>Dano<b>{stats.damage}</b></span><span data-stat="armor"><ShieldCheck size={14}/>Armadura<b>{stats.armor}</b></span>
     <span data-stat="hp"><Heart size={14}/>Vida<b>{stats.hp}</b></span><span data-stat="stamina"><Footprints size={14}/>Vigor<b>{stats.stamina}</b></span>
    </div>
   </section>
   <section className="bag-pane" aria-label="Itens da mochila" onDragOver={e=>{if(!locked&&e.dataTransfer.types.includes(SLOT_DRAG)){e.preventDefault();e.dataTransfer.dropEffect='move';}}} onDrop={e=>{const slot=e.dataTransfer.getData(SLOT_DRAG) as Slot;if(slot){e.preventDefault();removeFromSlot(slot);}}}>
    <div className="bag-toolbar"><select aria-label="Categoria" value={category} disabled={tab==='stones'} onChange={e=>{setCategory(e.target.value as Slot|'all');setActiveSlot(null);setPage(0);setTooltip(null);}}><option value="all">Todas as categorias</option>{SLOTS.filter(slot=>!SLOT_FAMILY[slot]).filter(slot=>tab!=='weapons'||slot==='weapon').filter(slot=>tab!=='style'||slot!=='weapon').map(slot=><option key={slot} value={slot}>{SLOT_NAMES[slot]}</option>)}</select><label><Search size={14}/><input aria-label="Buscar item" placeholder="Buscar item" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);setTooltip(null);}}/></label><span className="capacity">{entries.length} itens</span></div>
    <div className="bag-shelf">
     <div className="bag-grid">{Array.from({length:PAGE_SIZE},(_,index)=>{
      const id=visible[index];if(!id)return <ItemCardFrame variant="slot" empty className="bag-cell empty" key={`empty-${index}`}/>;
      const it=id===COLOR_TICKET.id?undefined:CATALOG[copyBase(id)],st=STONES.find(s=>`stone-${s.level}`===id),level=p.upgrades[id]??0,equipped=!!it&&slotsForItem(it).some(slot=>equippedCopy(equipment,slot)===id),genderLocked=!!it&&!canEquipItem(it,p.gender);
      return <ItemCard key={id} rarity={it?.rarity??stoneRarity(st?.level??1)} selected={id===selected} aria-label={it?.name??st?.name??(id===COLOR_TICKET.id?COLOR_TICKET.name:undefined)} aria-pressed={equipped} aria-disabled={genderLocked||locked||undefined} data-gender-locked={genderLocked||undefined} aria-describedby={tooltip?.id===id?'item-tooltip':undefined} className={`bag-cell ${id===selected?'selected':''} ${genderLocked?'gender-locked':''}`} draggable={!!it&&!locked&&!genderLocked}
       onDragStart={e=>{if(genderLocked){e.preventDefault();return;}e.dataTransfer.setData(ITEM_DRAG,id);e.dataTransfer.effectAllowed='copy';setDragging(id);setTooltip(null);}} onDragEnd={()=>setDragging(null)}
       onClick={()=>equipItem(id)} {...tooltipEvents(id)}>
       {previewFlash?.id===id&&<i key={previewFlash.key} className="item-preview-pulse" aria-hidden="true"/>}{it?<ItemIcon id={it.id} upgrade={level} size={60} color={p.itemColors[id]} skin={preview.skin} eyes={preview.eyes}/>:id===COLOR_TICKET.id?<TicketIcon size={55}/>:<img src={`/assets/${id}.png`} className="item-art" alt={st?.name} width={55} height={55}/>}
       {equipped&&<span className="equipped-mark saved"><Check size={11}/></span>}{canStrengthen(it)&&<UpgradeTag level={level} className="bag-upgrade-tag"/>}{st&&<b className="slot-quantity">{p.stones[String(st.level)]??0}</b>}{id===COLOR_TICKET.id&&<b className="slot-quantity">{p.colorTickets}</b>}
      </ItemCard>;
     })}{!entries.length&&<span className="inventory-no-items">Nenhum item encontrado</span>}</div>
     <nav className="bag-tabs" aria-label="Tipo de item">{BAG_TABS.map(({id,name,Icon})=><button key={id} aria-pressed={tab===id} className={tab===id?'active':''} onClick={()=>{setTab(id);setCategory('all');setActiveSlot(null);setPage(0);setTooltip(null);}}><Icon size={19} aria-hidden="true"/><span>{name}</span></button>)}</nav>
    </div>
    <div className="inventory-pagination"><span role="status" aria-live="polite">{feedback??''}</span><div><button aria-label="Página anterior" disabled={currentPage===0} onClick={()=>{setPage(currentPage-1);setTooltip(null);}}><ChevronLeft size={16}/></button><span>{currentPage+1} / {pages}</span><button aria-label="Próxima página" disabled={currentPage===pages-1} onClick={()=>{setPage(currentPage+1);setTooltip(null);}}><ChevronRight size={16}/></button></div></div>
    <footer className="bag-footer">
     <div className="bag-wallet"><span title="Moedas Brasa"><RewardIcon size={18}/><b>{p.gold.toLocaleString('pt-BR')}</b></span><span title="Cupons"><CouponIcon size={22}/><b>{p.coupons.toLocaleString('pt-BR')}</b></span></div>
     <button className="bag-action forge" disabled={!!state.room||pending} onClick={()=>onForge()} title="Ferreiro" aria-label="Abrir ferreiro"><Hammer size={16}/><span>Ferreiro</span></button>
    </footer>
   </section>
  </div>
  {tooltip&&!menu&&createPortal(<InventoryTooltip tip={tooltip} gender={p.gender} equipment={preview} upgrades={p.upgrades} compositions={p.compositions} colors={p.itemColors} tickets={p.colorTickets}/>,document.body)}
  {menu&&createPortal(<BagContextMenu x={menu.x} y={menu.y} title={CATALOG[copyBase(menu.key)]?.name??''} actions={menuActions(menu.key,menu.slot)} onClose={()=>setMenu(null)}/>,document.body)}
  {studio&&<ColorStudio target={studio} equipment={preview} onClose={closeStudio} onDone={studioDone}/>}
  {discarding&&<DiscardConfirm itemKey={discarding} pending={discardPending} onCancel={()=>{if(!discardPending)setDiscarding(null);}} onConfirm={confirmDiscard}/>}
 </Modal>;
}

const TIP_STATS=[['attack','Ataque',Swords],['defense','Defesa',Shield],['damage','Dano',Flame],['armor','Armadura',ShieldCheck],['agility','Agilidade',Zap],['luck','Sorte',Clover]] as const;
const TIER_STARS={common:1,normal:2,epic:3,legendary:4} as const;
export function InventoryTooltip({tip,gender,equipment,upgrades,compositions,action,hideGender=false,colors={},tickets}:{tip:Tip;gender:CharacterGender;equipment:Equipment;upgrades:Record<string,number>;compositions:Compositions;action?:string;hideGender?:boolean;colors?:Record<string,string>;tickets?:number}){
 const {id,anchor}=tip,ticket=id===COLOR_TICKET.id,base=copyBase(id),level=upgrades[id]??0,item=CATALOG[base],stone=STONES.find(s=>`stone-${s.level}`===id),weapon=WEAPONS.find(w=>w.id===base),stats=weapon?weaponStats(weapon,level):null,rarity=item?.rarity??stoneRarity(stone?.level??1),tier=itemTier(rarity);
 const equipped=!!item&&slotsForItem(item).some(slot=>equippedCopy(equipment,slot)===id);
 const ref=useRef<HTMLElement>(null),[position,setPosition]=useState<{x:number;y:number}|null>(null);
 // The composition bonus is shown beside each attribute ("Ataque 100 +30"), not folded into it.
 const values=item?itemAttributes(item,level,compositions?.[id]):null,bare=item?itemAttributes(item,level):null,hasAttributes=!!values&&Object.values(values).some(value=>value!==0);
 const target=item?(anchor.dataset.slot as Slot|undefined)??targetSlotForItem(equipment,item):undefined;
 // `equipment` already carries the worn copies' compositions; the candidate swaps in this copy's own.
 const current=attributes(equipment),candidate=item&&target?attributes({...equipment,compositions:{...equipment.compositions,[base]:compositions?.[id]??{}},[target]:base,upgrade:item.slot==='weapon'?level:equipment.upgrade,...(isArmorSlot(target)?{slotUpgrades:{...equipment.slotUpgrades,[target]:level}}:{})}):current;
 useLayoutEffect(()=>{
  const element=ref.current;if(!element)return;const box=anchor.getBoundingClientRect(),bounds=element.getBoundingClientRect(),edge=10;
  let x=box.right+12,y=box.top;
  if(x+bounds.width>innerWidth-edge)x=box.left-bounds.width-12;
  if(x<edge){x=(innerWidth-bounds.width)/2;y=box.bottom+12;if(y+bounds.height>innerHeight-edge)y=box.top-bounds.height-12;}
  setPosition({x:Math.max(edge,Math.min(innerWidth-bounds.width-edge,x)),y:Math.max(edge,Math.min(innerHeight-bounds.height-edge,y))});
 },[id,anchor,equipped,level]);
 const compatible=!item||canEquipItem(item,gender),classed=!!item&&CLASSED_SLOTS.includes(item.slot);
 const delta=(value:number)=>compatible&&!equipped&&value!==0?<span className={`bag-tip-delta ${value>0?'up':'down'}`}>{value>0?'▲':'▼'}{Math.abs(value)}</span>:null;
 return <aside ref={ref} id="item-tooltip" role="tooltip" className="inventory-tooltip bag-tooltip" data-rarity={tier==='normal'?'rare':tier} data-tier={tier} style={{left:position?.x??0,top:position?.y??0,visibility:position?'visible':'hidden'}}>
  <header className="bag-tip-head">
   <ItemCardFrame rarity={rarity} variant="detail">{item?<ItemIcon id={base} size={56} upgrade={level} color={colors[id]} skin={equipment.skin} eyes={equipment.eyes}/>:ticket?<TicketIcon size={50}/>:<img width={50} src={`/assets/${id}.png`} alt=""/>}</ItemCardFrame>
   <div className="bag-tip-title">
    <strong>{item?.name??stone?.name??(ticket?COLOR_TICKET.name:'')}</strong>
    <small>{item?SLOT_NAMES[item.slot]:ticket?'Consumível':'Pedra de fortalecimento'}{stone&&` · Nível ${stone.level}`}</small>
    {item&&!hideGender&&itemGender(item)!=='unisex'&&<span className="bag-tip-gender"><ItemGenderBadge gender={itemGender(item)} locked={!compatible}/></span>}
   </div>
   {canStrengthen(item)&&<UpgradeTag level={level} size={84} className="bag-tip-upgrade"/>}
  </header>
  {classed&&<div className="bag-tip-class"><span>Classe</span><b>{rarityLabel(rarity)}</b><i aria-hidden="true">{'★'.repeat(TIER_STARS[tier])}<em>{'★'.repeat(4-TIER_STARS[tier])}</em></i></div>}
  {item?<>
   <p className="bag-tip-desc">{item.description}</p>
   {!!item.hpPercent&&<dl className="bag-tip-stats bag-tip-percent"><div><dt><Heart size={13} aria-hidden="true"/>Vida</dt><dd>+{item.hpPercent}%</dd></div></dl>}
   {hasAttributes?<dl className="bag-tip-stats">{TIP_STATS.map(([key,label,Icon])=><div key={key} data-zero={values![key]===0||undefined}><dt><Icon size={13} aria-hidden="true"/>{label}</dt><dd>{bare![key]}{values![key]!==bare![key]&&<span className="bag-tip-bonus">{values![key]>bare![key]?'+':'−'}{Math.abs(values![key]-bare![key])}</span>}{delta(candidate[key]-current[key])}</dd></div>)}</dl>:!item.hpPercent&&<div className="bag-tip-note">Visual cosmético · não altera atributos</div>}
   {stats&&<div className="bag-tip-weapon"><span>Ângulo <b>{stats.minAngle}°–{stats.maxAngle}°</b></span></div>}
   {compatible&&!equipped&&hasAttributes&&target&&<div className="bag-tip-compare">Comparado com {CATALOG[equipment[target]]&&!isEmptyItem(equipment[target])?CATALOG[equipment[target]].name:'o slot vazio'}</div>}
   {(action||!compatible)&&<footer className={`bag-tip-foot ${action?'':'blocked'}`}>{action??'Incompatível com este personagem'}</footer>}
   {colors[id]&&<div className="bag-tip-composed"><i className="bag-tip-color" style={{background:colors[id]}} aria-hidden="true"/>Cor personalizada</div>}
  </>:ticket?<>
   <p className="bag-tip-desc">{COLOR_TICKET.description}</p>
   {tickets!==undefined&&<dl className="bag-tip-stats"><div><dt>Na mochila</dt><dd>{tickets}</dd></div></dl>}
   <footer className="bag-tip-foot">{action??'Botão direito numa peça › Trocar cor'}</footer>
  </>:<>
   <p className="bag-tip-desc">Material para fortalecer armas no ferreiro.</p>
   <dl className="bag-tip-stats"><div><dt>Potência</dt><dd>{stone?.power}</dd></div><div><dt>Nível</dt><dd>{stone?.level}</dd></div></dl>
   <footer className="bag-tip-foot">{action??'Use no ferreiro'}</footer>
  </>}
 </aside>;
}
