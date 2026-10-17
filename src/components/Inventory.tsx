import {RewardIcon} from './RewardIcon';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {Check,ChevronLeft,ChevronRight,CircleDot,Crosshair,Flame,Footprints,Clover,Gem,Glasses,GraduationCap,Hammer,Heart,LayoutGrid,Medal,MessageCircle,Palette,Scissors,Search,Settings,Shield,ShieldCheck,Shirt,Smile,Sparkles,Swords,Watch,X,Zap} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {attributes,itemAttributes,CATALOG,DYES,DYE_SLOTS,ITEMS,SLOTS,SLOT_NAMES,STONES,WEAPONS,weaponStats,canEquipItem,itemGender,unequipForGender,isEmptyItem,slotAccepts,slotFamily,slotsForItem,targetSlotForItem,CLASSED_SLOTS,SLOT_FAMILY} from '../../shared/catalog';
import type {CharacterGender,DyeId,DyeSlot,Equipment,Slot} from '../../shared/catalog';
import {levelProgress} from '../../shared/progression';
import {COMPOSITION_STAT_NAMES} from '../../shared/composition';
import type {Compositions,CompositionStat} from '../../shared/composition';
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
const ITEM_DRAG='application/x-brasa-item';
const LEFT_SLOTS:Slot[]=['hair','hat','glasses','face'];
const RIGHT_SLOTS:Slot[]=['outfit','costume','wristband','bracelet'];
const LOWER_SLOTS:Slot[]=['ring','necklace','weapon','bubble','ring2'];
const SLOT_ICONS:Record<Slot,LucideIcon>={hair:Scissors,hat:GraduationCap,glasses:Glasses,face:Smile,outfit:Shirt,costume:Sparkles,wristband:Watch,bracelet:Gem,weapon:Crosshair,ring:CircleDot,ring2:CircleDot,necklace:Medal,bubble:MessageCircle};
const BAG_TABS:{id:string;name:string;Icon:LucideIcon}[]=[{id:'all',name:'Tudo',Icon:LayoutGrid},{id:'style',name:'Visuais',Icon:Shirt},{id:'weapons',name:'Armas',Icon:Swords},{id:'stones',name:'Pedras',Icon:Gem}];
export type Tip={id:string;anchor:HTMLElement;mode:'hover'|'focus'|'touch'};
function searchable(text:string){return text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}

export function Inventory({onClose,onForge}:{onClose:()=>void;onForge:()=>void}){
 const state=useGame(),p=state.profile!;
 const equipment=state.customizationEquipment??p.equipment,pending=state.customizationPending;
 const [tab,setTab]=useState('all'),[category,setCategory]=useState<Slot|'all'>('all'),[activeSlot,setActiveSlot]=useState<Slot|null>(null),[query,setQuery]=useState(''),[page,setPage]=useState(0);
 const [selected,setSelected]=useState(p.equipment.weapon),[dragging,setDragging]=useState<string|null>(null),[tooltip,setTooltip]=useState<Tip|null>(null);
 const [feedback,setFeedback]=useState<string|null>(null);
 const hold=useRef<{timer:ReturnType<typeof setTimeout>|null;x:number;y:number;triggered:boolean}>({timer:null,x:0,y:0,triggered:false}),touchUntil=useRef(0);
 const [previewFlash,setPreviewFlash]=useState<{id:string;key:number}|null>(null);
 const [displayOptions,setDisplayOptions]=useState(false),optionsRef=useRef<HTMLDivElement>(null),optionsButton=useRef<HTMLButtonElement>(null);
 const locked=!!state.battle||state.status!=='online';
 const preview=useMemo(()=>({...equipment,upgrade:p.upgrades[equipment.weapon]??0,compositions:p.compositions}),[equipment,p.upgrades,p.compositions]);
 const stats=attributes(preview),item=CATALOG[selected],unequip=unequipForGender(p.gender);
 const compatible=!!item&&canEquipItem(item,p.gender);
 const dyeable=compatible&&DYE_SLOTS.includes(item.slot as DyeSlot)&&item.visual?.variant!=='none';
 const entries=[...ITEMS.filter(i=>!isEmptyItem(i)&&p.inventory.includes(i.id)&&(tab==='all'||tab==='weapons'&&i.slot==='weapon'||tab==='style'&&i.slot!=='weapon')&&(category==='all'||i.slot===category)&&searchable(i.name).includes(searchable(query))).map(i=>i.id),...((tab==='all'||tab==='stones')&&category==='all'?STONES.filter(s=>searchable(s.name).includes(searchable(query))).map(s=>`stone-${s.level}`):[])];
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
  const next=CATALOG[id];if(locked||!next||(!p.inventory.includes(id)&&!isEmptyItem(next))||!canEquipItem(next,p.gender))return;
  const target=slot&&slotAccepts(slot,next)?slot:activeSlot&&slotAccepts(activeSlot,next)?activeSlot:targetSlotForItem(equipment,next);
  if(equipment[target]===id)return;
  // The same owned ring cannot sit in both ring slots: moving it frees the other one.
  const freed=Object.fromEntries(slotsForItem(next).filter(other=>other!==target&&equipment[other]===id).map(other=>[other,unequip[other]??next.id]));
  client.customize({items:{...freed,[target]:id}});setPreviewFlash({id,key:Date.now()});setFeedback(null);audio.play('click');
 }
 function changeDye(color:DyeId){
  if(locked||!dyeable)return;
  client.customize({items:{[item.slot]:item.id},dyes:{[item.slot]:color}});setPreviewFlash({id:item.id,key:Date.now()});setFeedback(null);audio.play('click');
 }
 function removeFromSlot(slot:Slot){const fallback=unequip[slot];if(!locked&&fallback&&equipment[slot]!==fallback&&(isEmptyItem(fallback)||p.inventory.includes(fallback)))equipItem(fallback,slot);}
 function filterBySlot(slot:Slot){if(hold.current.triggered){hold.current.triggered=false;return;}setSelected(equipment[slot]);setActiveSlot(slot);setCategory(slotFamily(slot));setTab(slot==='weapon'?'weapons':'style');setPage(0);setQuery('');setTooltip(null);}
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
  onContextMenu:(event:React.MouseEvent<HTMLElement>)=>{if(Date.now()<touchUntil.current)event.preventDefault();}
 };}

 const renderSlot=(slot:Slot)=>{
  const id=equipment[slot],it=CATALOG[id],empty=!it||isEmptyItem(it),Placeholder=SLOT_ICONS[slot];
  return <ItemCard key={slot} rarity={it?.rarity} selected={activeSlot===slot&&category===slotFamily(slot)} empty={empty} aria-label={`${SLOT_NAMES[slot]}: ${empty?'Vazio':it.name}`} data-slot={slot} aria-describedby={!empty&&tooltip?.id===id?'item-tooltip':undefined} className={`bag-slot equipment-slot ${dragging&&slotAccepts(slot,CATALOG[dragging])?'drop-ready':''}`} onClick={()=>filterBySlot(slot)} onDoubleClick={()=>removeFromSlot(slot)}
   {...(empty?{}:tooltipEvents(id))}
   onDragOver={e=>{if(!locked){e.preventDefault();e.dataTransfer.dropEffect=dragging&&slotAccepts(slot,CATALOG[dragging])?'copy':'none';}}}
   onDrop={e=>{e.preventDefault();setDragging(null);const id=e.dataTransfer.getData(ITEM_DRAG);if(slotAccepts(slot,CATALOG[id]))equipItem(id,slot);else setFeedback(`Use o slot de ${SLOT_NAMES[CATALOG[id]?.slot]??'equipamento'}.`);}}>
   {previewFlash?.id===id&&<i key={previewFlash.key} className="item-preview-pulse" aria-hidden="true"/>}{empty?<Placeholder className="bag-slot-placeholder" aria-hidden="true"/>:<ItemIcon id={id} upgrade={slot==='weapon'?preview.upgrade:0} size={60}/>}<span className="equipment-slot-label">{SLOT_NAMES[slot]}</span>{slot==='weapon'&&!empty&&<UpgradeTag level={preview.upgrade} className="bag-upgrade-tag"/>}
  </ItemCard>;
 };
 const progress=levelProgress(p.level,p.xp),stoneTotal=Object.values(p.stones).reduce((sum,count)=>sum+count,0);

 return <Modal title="Mochila" onClose={onClose} className="bag-window" viewport>
  <div className="inventory-body bag-layout">
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
      <div className="appearance-actions" aria-label="Ajustar aparência" hidden={!dyeable}>{dyeable&&<><Palette size={15} aria-hidden="true"/><div className="dye-swatches" role="group" aria-label={`Cor de ${SLOT_NAMES[item.slot]}`}>{DYES.map(dye=><button key={dye.id} title={dye.name} aria-label={`Cor ${dye.name}`} aria-pressed={(equipment.dyes?.[item.slot as DyeSlot]??'original')===dye.id} disabled={locked} className={`dye-swatch ${dye.id==='original'?'original':''}`} style={{backgroundColor:dye.color}} onClick={()=>changeDye(dye.id)}>{(equipment.dyes?.[item.slot as DyeSlot]??'original')===dye.id&&<Check size={13}/>}</button>)}</div></>}</div>
      <Avatar equipment={preview} size={340} animated={false} auraAnimated showAura weapon={false}/>
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
     <div className="combat-power"><PowerIcon size={28}/><span>Poder</span><strong>{stats.power.toLocaleString('pt-BR')}</strong></div>
    </div>
    <div className="stat-grid" aria-label="Atributos do personagem">
     <span data-stat="attack"><Swords size={14}/>Ataque<b>{stats.attack}</b></span><span data-stat="agility"><Zap size={14}/>Agilidade<b>{stats.agility}</b></span>
     <span data-stat="defense"><Shield size={14}/>Defesa<b>{stats.defense}</b></span><span data-stat="luck"><Clover size={14}/>Sorte<b>{stats.luck}</b></span>
     <span data-stat="damage"><Flame size={14}/>Dano<b>{stats.damage}</b></span><span data-stat="armor"><ShieldCheck size={14}/>Armadura<b>{stats.armor}</b></span>
     <span data-stat="hp"><Heart size={14}/>Vida<b>{stats.hp}</b></span><span data-stat="stamina"><Footprints size={14}/>Vigor<b>{stats.stamina}</b></span>
    </div>
   </section>
   <section className="bag-pane" aria-label="Itens da mochila">
    <div className="bag-toolbar"><select aria-label="Categoria" value={category} disabled={tab==='stones'} onChange={e=>{setCategory(e.target.value as Slot|'all');setActiveSlot(null);setPage(0);setTooltip(null);}}><option value="all">Todas as categorias</option>{SLOTS.filter(slot=>!SLOT_FAMILY[slot]).filter(slot=>tab!=='weapons'||slot==='weapon').filter(slot=>tab!=='style'||slot!=='weapon').map(slot=><option key={slot} value={slot}>{SLOT_NAMES[slot]}</option>)}</select><label><Search size={14}/><input aria-label="Buscar item" placeholder="Buscar item" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);setTooltip(null);}}/></label><span className="capacity">{entries.length} itens</span></div>
    <div className="bag-shelf">
     <div className="bag-grid">{Array.from({length:PAGE_SIZE},(_,index)=>{
      const id=visible[index];if(!id)return <ItemCardFrame variant="slot" empty className="bag-cell empty" key={`empty-${index}`}/>;
      const it=CATALOG[id],st=STONES.find(s=>`stone-${s.level}`===id),level=p.upgrades[id]??0,equipped=!!it&&slotsForItem(it).some(slot=>equipment[slot]===id),genderLocked=!!it&&!canEquipItem(it,p.gender);
      return <ItemCard key={id} rarity={it?.rarity??stoneRarity(st?.level??1)} selected={id===selected} aria-label={it?.name??st?.name} aria-pressed={equipped} aria-disabled={genderLocked||locked||undefined} data-gender-locked={genderLocked||undefined} aria-describedby={tooltip?.id===id?'item-tooltip':undefined} className={`bag-cell ${id===selected?'selected':''} ${genderLocked?'gender-locked':''}`} draggable={!!it&&!locked&&!genderLocked}
       onDragStart={e=>{if(genderLocked){e.preventDefault();return;}e.dataTransfer.setData(ITEM_DRAG,id);e.dataTransfer.effectAllowed='copy';setDragging(id);setTooltip(null);}} onDragEnd={()=>setDragging(null)}
       onClick={()=>equipItem(id)} {...tooltipEvents(id)}>
       {previewFlash?.id===id&&<i key={previewFlash.key} className="item-preview-pulse" aria-hidden="true"/>}{it?<ItemIcon id={id} upgrade={level} size={60}/>:<img src={`/assets/${id}.png`} className="item-art" alt={st?.name} width={55} height={55}/>}
       {equipped&&<span className="equipped-mark saved"><Check size={11}/></span>}{it?.slot==='weapon'&&<UpgradeTag level={level} className="bag-upgrade-tag"/>}{st&&<b className="slot-quantity">{p.stones[String(st.level)]??0}</b>}
      </ItemCard>;
     })}{!entries.length&&<span className="inventory-no-items">Nenhum item encontrado</span>}</div>
     <nav className="bag-tabs" aria-label="Tipo de item">{BAG_TABS.map(({id,name,Icon})=><button key={id} aria-pressed={tab===id} className={tab===id?'active':''} onClick={()=>{setTab(id);setCategory('all');setActiveSlot(null);setPage(0);setTooltip(null);}}><Icon size={19} aria-hidden="true"/><span>{name}</span></button>)}</nav>
    </div>
    <div className="inventory-pagination"><span role="status" aria-live="polite">{feedback??''}</span><div><button aria-label="Página anterior" disabled={currentPage===0} onClick={()=>{setPage(currentPage-1);setTooltip(null);}}><ChevronLeft size={16}/></button><span>{currentPage+1} / {pages}</span><button aria-label="Próxima página" disabled={currentPage===pages-1} onClick={()=>{setPage(currentPage+1);setTooltip(null);}}><ChevronRight size={16}/></button></div></div>
    <footer className="bag-footer">
     <div className="bag-wallet"><span title="Moedas Brasa"><RewardIcon size={18}/><b>{p.gold.toLocaleString('pt-BR')}</b></span><span title="Pedras de fortalecimento"><img src="/assets/stone-1.png" alt="" width={20} height={20}/><b>{stoneTotal.toLocaleString('pt-BR')}</b></span></div>
     <button className="bag-action forge" disabled={!!state.room||pending} onClick={onForge} title="Ferreiro" aria-label="Abrir ferreiro"><Hammer size={16}/><span>Ferreiro</span></button>
    </footer>
   </section>
  </div>
  {tooltip&&createPortal(<InventoryTooltip tip={tooltip} gender={p.gender} equipment={preview} upgrades={p.upgrades} compositions={p.compositions}/>,document.body)}
 </Modal>;
}

const TIP_STATS=[['attack','Ataque',Swords],['defense','Defesa',Shield],['damage','Dano',Flame],['armor','Armadura',ShieldCheck],['agility','Agilidade',Zap],['luck','Sorte',Clover]] as const;
const TIER_STARS={common:1,normal:2,epic:3,legendary:4} as const;
export function InventoryTooltip({tip,gender,equipment,upgrades,compositions,action}:{tip:Tip;gender:CharacterGender;equipment:Equipment;upgrades:Record<string,number>;compositions:Compositions;action?:string}){
 const {id,anchor}=tip,level=upgrades[id]??0,item=CATALOG[id],stone=STONES.find(s=>`stone-${s.level}`===id),weapon=WEAPONS.find(w=>w.id===id),stats=weapon?weaponStats(weapon,level):null,rarity=item?.rarity??stoneRarity(stone?.level??1),tier=itemTier(rarity);
 const equipped=!!item&&slotsForItem(item).some(slot=>equipment[slot]===id);
 const ref=useRef<HTMLElement>(null),[position,setPosition]=useState<{x:number;y:number}|null>(null);
 const values=item?itemAttributes(item,level,compositions?.[id]):null,hasAttributes=!!values&&Object.values(values).some(value=>value!==0);
 const target=item?(anchor.dataset.slot as Slot|undefined)??targetSlotForItem(equipment,item):undefined;
 const current=attributes({...equipment,compositions}),candidate=item&&target?attributes({...equipment,compositions,[target]:id,upgrade:item.slot==='weapon'?level:equipment.upgrade}):current;
 useLayoutEffect(()=>{
  const element=ref.current;if(!element)return;const box=anchor.getBoundingClientRect(),bounds=element.getBoundingClientRect(),edge=10;
  let x=box.right+12,y=box.top;
  if(x+bounds.width>innerWidth-edge)x=box.left-bounds.width-12;
  if(x<edge){x=(innerWidth-bounds.width)/2;y=box.bottom+12;if(y+bounds.height>innerHeight-edge)y=box.top-bounds.height-12;}
  setPosition({x:Math.max(edge,Math.min(innerWidth-bounds.width-edge,x)),y:Math.max(edge,Math.min(innerHeight-bounds.height-edge,y))});
 },[id,anchor,equipped,level]);
 const compatible=!item||canEquipItem(item,gender),classed=!!item&&CLASSED_SLOTS.includes(item.slot);
 const fallback=item&&target?unequipForGender(gender)[target]:undefined,removable=!!fallback&&fallback!==id;
 const delta=(value:number)=>compatible&&!equipped&&value!==0?<span className={`bag-tip-delta ${value>0?'up':'down'}`}>{value>0?'▲':'▼'}{Math.abs(value)}</span>:null;
 const composed=Object.entries(compositions?.[id]??{});
 return <aside ref={ref} id="item-tooltip" role="tooltip" className="inventory-tooltip bag-tooltip" data-rarity={tier==='normal'?'rare':tier} data-tier={tier} style={{left:position?.x??0,top:position?.y??0,visibility:position?'visible':'hidden'}}>
  <header className="bag-tip-head">
   <ItemCardFrame rarity={rarity} variant="detail">{item?<ItemIcon id={id} size={56} upgrade={level}/>:<img width={50} src={`/assets/${id}.png`} alt=""/>}</ItemCardFrame>
   <div className="bag-tip-title">
    <strong>{item?.name??stone?.name}</strong>
    <small>{item?SLOT_NAMES[item.slot]:'Pedra de fortalecimento'}{stone&&` · Nível ${stone.level}`}</small>
    {item&&<span className="bag-tip-gender"><ItemGenderBadge gender={itemGender(item)} locked={!compatible}/></span>}
   </div>
   {weapon&&<UpgradeTag level={level} size={58} className="bag-tip-upgrade"/>}
  </header>
  {classed&&<div className="bag-tip-class"><span>Classe</span><b>{rarityLabel(rarity)}</b><i aria-hidden="true">{'★'.repeat(TIER_STARS[tier])}<em>{'★'.repeat(4-TIER_STARS[tier])}</em></i></div>}
  {item?<>
   <p className="bag-tip-desc">{item.description}</p>
   {hasAttributes?<dl className="bag-tip-stats">{TIP_STATS.map(([key,label,Icon])=><div key={key} data-zero={values![key]===0||undefined}><dt><Icon size={13} aria-hidden="true"/>{label}</dt><dd>{values![key]}{delta(candidate[key]-current[key])}</dd></div>)}</dl>:<div className="bag-tip-note">Visual cosmético · não altera atributos</div>}
   {stats&&<div className="bag-tip-weapon"><span>Destruição <b>{stats.crater}</b></span><span>Ângulo <b>{stats.minAngle}°–{stats.maxAngle}°</b></span></div>}
   {!!composed.length&&<div className="bag-tip-composed">Composição: {composed.map(([stat,value])=>`${COMPOSITION_STAT_NAMES[stat as CompositionStat]} +${value}`).join(' · ')}</div>}
   {compatible&&!equipped&&hasAttributes&&target&&<div className="bag-tip-compare">Comparado com {CATALOG[equipment[target]]&&!isEmptyItem(equipment[target])?CATALOG[equipment[target]].name:'o slot vazio'}</div>}
   <footer className={`bag-tip-foot ${action?'':!compatible?'blocked':equipped?'equipped':''}`}>{action??(!compatible?'Incompatível com este personagem':equipped?(tip.anchor.dataset.slot&&removable?'Equipado · duplo clique para retirar':'✓ Equipado'):tip.mode==='touch'?'Toque para equipar':'Clique para equipar')}</footer>
  </>:<>
   <p className="bag-tip-desc">Material para fortalecer armas no ferreiro.</p>
   <dl className="bag-tip-stats"><div><dt>Potência</dt><dd>{stone?.power}</dd></div><div><dt>Nível</dt><dd>{stone?.level}</dd></div></dl>
   <footer className="bag-tip-foot">{action??'Use no ferreiro'}</footer>
  </>}
 </aside>;
}
