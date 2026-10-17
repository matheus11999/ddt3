import {RewardIcon} from './RewardIcon';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {Check,ChevronLeft,ChevronRight,Flame,Footprints,Clover,Hammer,Heart,Palette,Search,Settings,Shield,ShieldCheck,Swords,X,Zap} from 'lucide-react';
import {attributes,itemAttributes,CATALOG,DYES,DYE_SLOTS,ITEMS,SLOTS,SLOT_NAMES,STONES,WEAPONS,weaponStats,canEquipItem,itemGender,unequipForGender,isEmptyItem} from '../../shared/catalog';
import type {CharacterGender,DyeId,DyeSlot,Equipment,Slot} from '../../shared/catalog';
import {COMPOSITION_STAT_NAMES} from '../../shared/composition';
import type {Compositions,CompositionStat} from '../../shared/composition';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {Avatar} from './Avatar';
import {ItemIcon} from './ItemIcon';
import {Modal} from './Modal';
import {UpgradeBadge} from './UpgradeBadge';
import {LevelBadge} from './LevelBadge';
import {PowerIcon} from './PowerIcon';
import {ItemGenderBadge} from './ItemGenderBadge';
import {ItemCard,ItemCardFrame,rarityLabel,stoneRarity} from './ItemCard';
import './Inventory.css';

const PAGE_SIZE=24;
const ITEM_DRAG='application/x-brasa-item';
const LEFT_SLOTS:Slot[]=['hair','hat','glasses','face'];
const RIGHT_SLOTS:Slot[]=['outfit','costume','wristband','bracelet'];
const LOWER_SLOTS:Slot[]=['weapon'];
type Tip={id:string;anchor:HTMLElement;mode:'hover'|'focus'|'touch'};
function searchable(text:string){return text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}

export function Inventory({onClose,onForge}:{onClose:()=>void;onForge:()=>void}){
 const state=useGame(),p=state.profile!;
 const equipment=state.customizationEquipment??p.equipment,pending=state.customizationPending;
 const [tab,setTab]=useState('all'),[category,setCategory]=useState<Slot|'all'>('all'),[query,setQuery]=useState(''),[page,setPage]=useState(0);
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

 function equipItem(id:string){
  if(hold.current.triggered){hold.current.triggered=false;return;}
  setSelected(id);setTooltip(current=>current?.id===id&&current.mode!=='touch'?current:null);
  const next=CATALOG[id];if(locked||!next||(!p.inventory.includes(id)&&!isEmptyItem(next))||!canEquipItem(next,p.gender))return;
  client.customize({items:{[next.slot]:id}});setPreviewFlash({id,key:Date.now()});setFeedback(null);audio.play('click');
 }
 function changeDye(color:DyeId){
  if(locked||!dyeable)return;
  client.customize({items:{[item.slot]:item.id},dyes:{[item.slot]:color}});setPreviewFlash({id:item.id,key:Date.now()});setFeedback(null);audio.play('click');
 }
 function removeFromSlot(slot:Slot){const fallback=unequip[slot];if(!locked&&fallback&&equipment[slot]!==fallback&&(isEmptyItem(fallback)||p.inventory.includes(fallback)))equipItem(fallback);}
 function filterBySlot(slot:Slot){if(hold.current.triggered){hold.current.triggered=false;return;}setSelected(equipment[slot]);setCategory(slot);setTab(slot==='weapon'?'weapons':'style');setPage(0);setQuery('');setTooltip(null);}
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
  const id=equipment[slot],it=CATALOG[id],empty=!it||isEmptyItem(it);
  return <ItemCard key={slot} rarity={it?.rarity} selected={category===slot} empty={empty} aria-label={`${SLOT_NAMES[slot]}: ${empty?'Vazio':it.name}`} data-slot={slot} aria-describedby={!empty&&tooltip?.id===id?'item-tooltip':undefined} className={`item-slot equipment-slot ${dragging&&CATALOG[dragging]?.slot===slot?'drop-ready':''}`} onClick={()=>filterBySlot(slot)} onDoubleClick={()=>removeFromSlot(slot)}
   {...(empty?{}:tooltipEvents(id))}
   onDragOver={e=>{if(!locked){e.preventDefault();e.dataTransfer.dropEffect=dragging&&CATALOG[dragging]?.slot===slot?'copy':'none';}}}
   onDrop={e=>{e.preventDefault();setDragging(null);const id=e.dataTransfer.getData(ITEM_DRAG);if(CATALOG[id]?.slot===slot)equipItem(id);else setFeedback(`Use o slot de ${SLOT_NAMES[CATALOG[id]?.slot]??'equipamento'}.`);}}>
   {previewFlash?.id===id&&<i key={previewFlash.key} className="item-preview-pulse" aria-hidden="true"/>}{!isEmptyItem(id)&&<ItemIcon id={id} upgrade={slot==='weapon'?preview.upgrade:0} size={60}/>}<span className="equipment-slot-label">{SLOT_NAMES[slot]}</span>{slot==='weapon'&&<b className="slot-upgrade">+{preview.upgrade}</b>}
  </ItemCard>;
 };

 return <Modal title="Mochila" onClose={onClose} className="inventory-window" viewport>
  <div className="inventory-body">
   <section className="equipment-pane" aria-label="Personalização do aventureiro">
    <div className="character-display">
    <div className="character-name"><LevelBadge level={p.level} size={42}/><div><h2>{p.name}</h2><span className="equipment-status" role="status" aria-live="polite">{pending?'Aplicando…':'Visual equipado'}</span></div></div>
    <div className="dressing-room" onDragOver={e=>{if(!locked&&e.dataTransfer.types.includes(ITEM_DRAG)){e.preventDefault();e.dataTransfer.dropEffect='copy';}}} onDrop={e=>{e.preventDefault();if(e.target===e.currentTarget||!(e.target as HTMLElement).closest('[data-slot]'))equipItem(e.dataTransfer.getData(ITEM_DRAG));setDragging(null);}}>
     <div className="avatar-halo"/><Avatar equipment={preview} size={340} animated={false} auraAnimated showAura weapon={false}/>
     <div className="equipment-slots left">{LEFT_SLOTS.map(renderSlot)}</div><div className="equipment-slots right">{RIGHT_SLOTS.map(renderSlot)}</div>
     <button ref={optionsButton} className="avatar-options-toggle" aria-label="Exibição do personagem" aria-expanded={displayOptions} aria-controls="avatar-display-options" title="Exibição do personagem" onClick={()=>{setDisplayOptions(value=>!value);setTooltip(null);}}><Settings size={19}/></button>
     {displayOptions&&<div ref={optionsRef} id="avatar-display-options" className="avatar-display-options" role="dialog" aria-label="Exibição do personagem" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setDisplayOptions(false);optionsButton.current?.focus();}}}>
      <header><strong>Exibição</strong><button aria-label="Fechar exibição" onClick={()=>{setDisplayOptions(false);optionsButton.current?.focus();}}><X size={16}/></button></header>
      {([{id:'hat',label:'Exibir chapéu'},{id:'glasses',label:'Exibir óculos'},{id:'costume',label:'Exibir fantasia'}] as const).map(option=><label key={option.id}><input type="checkbox" checked={equipment.visibility?.[option.id]!==false} disabled={locked} onChange={event=>{client.customize({visibility:{[option.id]:event.target.checked}});setFeedback(null);}}/><span>{option.label}</span><Check size={13} aria-hidden="true"/></label>)}
     </div>}
    </div>
    <div className="equipment-slots lower">{LOWER_SLOTS.map(renderSlot)}</div>
    {dyeable&&<div className="appearance-actions" aria-label="Ajustar aparência"><Palette size={15} aria-hidden="true"/><div className="dye-swatches" role="group" aria-label={`Cor de ${SLOT_NAMES[item.slot]}`}>{DYES.map(dye=><button key={dye.id} title={dye.name} aria-label={`Cor ${dye.name}`} aria-pressed={(equipment.dyes?.[item.slot as DyeSlot]??'original')===dye.id} disabled={locked} className={`dye-swatch ${dye.id==='original'?'original':''}`} style={{backgroundColor:dye.color}} onClick={()=>changeDye(dye.id)}>{(equipment.dyes?.[item.slot as DyeSlot]??'original')===dye.id&&<Check size={13}/>}</button>)}</div></div>}
    <div className="combat-power"><PowerIcon size={29}/><span>Poder</span><strong>{stats.power.toLocaleString('pt-BR')}</strong></div>
    </div>
    <div className="stat-grid" aria-label="Atributos do personagem"><span><Swords size={14}/>Ataque<b>{stats.attack}</b></span><span><Shield size={14}/>Defesa<b>{stats.defense}</b></span><span><Flame size={14}/>Dano<b>{stats.damage}</b></span><span><ShieldCheck size={14}/>Armadura<b>{stats.armor}</b></span><span><Zap size={14}/>Agilidade<b>{stats.agility}</b></span><span><Heart size={14}/>Vida<b>{stats.hp}</b></span><span><Clover size={14}/>Sorte<b>{stats.luck}</b></span><span><Footprints size={14}/>Vigor<b>{stats.stamina}</b></span></div>
   </section>
   <section className="bag-pane" aria-label="Itens da mochila">
    <nav className="tabs" aria-label="Tipo de item">{[['all','Tudo'],['style','Visuais'],['weapons','Armas'],['stones','Pedras']].map(([id,name])=><button key={id} aria-pressed={tab===id} className={tab===id?'active':''} onClick={()=>{setTab(id);setCategory('all');setPage(0);setTooltip(null);}}>{name}</button>)}<span className="capacity">{entries.length} itens</span></nav>
    <div className="inventory-filters"><select aria-label="Categoria" value={category} disabled={tab==='stones'} onChange={e=>{setCategory(e.target.value as Slot|'all');setPage(0);setTooltip(null);}}><option value="all">Todas as categorias</option>{SLOTS.filter(slot=>tab!=='weapons'||slot==='weapon').filter(slot=>tab!=='style'||slot!=='weapon').map(slot=><option key={slot} value={slot}>{SLOT_NAMES[slot]}</option>)}</select><label><Search size={14}/><input aria-label="Buscar item" placeholder="Buscar item" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);setTooltip(null);}}/></label></div>
    <div className="bag-grid">{Array.from({length:PAGE_SIZE},(_,index)=>{
     const id=visible[index];if(!id)return <ItemCardFrame variant="slot" empty className="item-slot empty" key={`empty-${index}`}/>;
     const it=CATALOG[id],st=STONES.find(s=>`stone-${s.level}`===id),level=p.upgrades[id]??0,equipped=!!it&&equipment[it.slot]===id,genderLocked=!!it&&!canEquipItem(it,p.gender);
     return <ItemCard key={id} rarity={it?.rarity??stoneRarity(st?.level??1)} selected={id===selected} aria-label={it?.name??st?.name} aria-pressed={equipped} aria-disabled={genderLocked||locked||undefined} data-gender-locked={genderLocked||undefined} aria-describedby={tooltip?.id===id?'item-tooltip':undefined} className={`item-slot ${id===selected?'selected':''} ${genderLocked?'gender-locked':''}`} draggable={!!it&&!locked&&!genderLocked}
      onDragStart={e=>{if(genderLocked){e.preventDefault();return;}e.dataTransfer.setData(ITEM_DRAG,id);e.dataTransfer.effectAllowed='copy';setDragging(id);setTooltip(null);}} onDragEnd={()=>setDragging(null)}
      onClick={()=>equipItem(id)} {...tooltipEvents(id)}>
      {previewFlash?.id===id&&<i key={previewFlash.key} className="item-preview-pulse" aria-hidden="true"/>}{it?<ItemIcon id={id} upgrade={level} size={60}/>:<img src={`/assets/${id}.png`} className="item-art" alt={st?.name} width={55} height={55}/>}
      {equipped&&<span className="equipped-mark saved"><Check size={11}/></span>}{it&&itemGender(it)!=='unisex'&&<span className="inventory-item-gender"><ItemGenderBadge gender={itemGender(it)} locked={genderLocked} compact/></span>}{it?.slot==='weapon'&&<b className="slot-upgrade">+{level}</b>}{st&&<b className="slot-quantity">{p.stones[String(st.level)]??0}</b>}
     </ItemCard>;
    })}{!entries.length&&<span className="inventory-no-items">Nenhum item encontrado</span>}</div>
    <div className="inventory-pagination"><span role="status" aria-live="polite">{feedback??''}</span><div><button aria-label="Página anterior" disabled={currentPage===0} onClick={()=>{setPage(currentPage-1);setTooltip(null);}}><ChevronLeft size={16}/></button><span>{currentPage+1} / {pages}</span><button aria-label="Próxima página" disabled={currentPage===pages-1} onClick={()=>{setPage(currentPage+1);setTooltip(null);}}><ChevronRight size={16}/></button></div></div>

    <footer className="bag-footer"><span><RewardIcon size={17}/>{p.gold.toLocaleString('pt-BR')}</span><button className="button quiet forge-link" disabled={!!state.room||pending} onClick={onForge} title="Ferreiro" aria-label="Abrir ferreiro"><Hammer size={16}/></button></footer>
   </section>
  </div>
  {tooltip&&createPortal(<InventoryTooltip tip={tooltip} gender={p.gender} equipment={preview} upgrades={p.upgrades} compositions={p.compositions}/>,document.body)}
 </Modal>;
}

function InventoryTooltip({tip,gender,equipment,upgrades,compositions}:{tip:Tip;gender:CharacterGender;equipment:Equipment;upgrades:Record<string,number>;compositions:Compositions}){
 const {id,anchor}=tip,level=upgrades[id]??0,item=CATALOG[id],stone=STONES.find(s=>`stone-${s.level}`===id),weapon=WEAPONS.find(w=>w.id===id),stats=weapon?weaponStats(weapon,level):null,rarity=item?.rarity??stoneRarity(stone?.level??1),equipped=!!item&&equipment[item.slot]===id;
 const ref=useRef<HTMLElement>(null),[position,setPosition]=useState<{x:number;y:number}|null>(null);
 const values=item?itemAttributes(item,level,compositions?.[id]):null,hasAttributes=!!values&&Object.values(values).some(value=>value!==0);
 const current=attributes({...equipment,compositions}),candidate=item?attributes({...equipment,compositions,[item.slot]:id,upgrade:item.slot==='weapon'?level:equipment.upgrade}):current;
 useLayoutEffect(()=>{
  const element=ref.current;if(!element)return;const target=anchor.getBoundingClientRect(),bounds=element.getBoundingClientRect(),edge=10;
  let x=target.right+12,y=target.top;
  if(x+bounds.width>innerWidth-edge)x=target.left-bounds.width-12;
  if(x<edge){x=(innerWidth-bounds.width)/2;y=target.bottom+12;if(y+bounds.height>innerHeight-edge)y=target.top-bounds.height-12;}
  setPosition({x:Math.max(edge,Math.min(innerWidth-bounds.width-edge,x)),y:Math.max(edge,Math.min(innerHeight-bounds.height-edge,y))});
 },[id,anchor,equipped,level]);
 const compatible=!item||canEquipItem(item,gender);
 const fallback=item?unequipForGender(gender)[item.slot]:undefined,removable=!!fallback&&fallback!==id;
 const delta=(value:number)=>compatible&&!equipped&&value!==0?<span className={`tooltip-delta ${value>0?'positive':'negative'}`}>{value>0?'+':''}{value}</span>:null;
 return <aside ref={ref} id="item-tooltip" role="tooltip" className="item-tooltip inventory-tooltip" data-rarity={rarity} style={{left:position?.x??0,top:position?.y??0,visibility:position?'visible':'hidden'}}>
  <header><ItemCardFrame rarity={rarity} variant="detail">{item?<ItemIcon id={id} size={49} upgrade={level}/>:<img width={46} src={`/assets/${id}.png`} alt=""/>}</ItemCardFrame><div><small>{rarityLabel(rarity)} · {item?SLOT_NAMES[item.slot]:'Pedra de upgrade'}</small><div className="tooltip-name"><strong>{item?.name??stone?.name}</strong>{weapon&&<UpgradeBadge level={level} size={76}/>}</div>{stone&&<b>Nível {stone.level}</b>}</div></header>
  {item&&<div className="tooltip-gender"><ItemGenderBadge gender={itemGender(item)} locked={!compatible}/></div>}
  {item?<><p>{item.description}</p>{!!Object.keys(compositions?.[id]??{}).length&&<div className="tooltip-composed">Composição: {Object.entries(compositions[id]).map(([stat,value])=>`${COMPOSITION_STAT_NAMES[stat as CompositionStat]} +${value}`).join(' · ')}</div>}{hasAttributes?<dl><dt>Ataque</dt><dd>{values?.attack}{delta(candidate.attack-current.attack)}</dd><dt>Defesa</dt><dd>{values?.defense}{delta(candidate.defense-current.defense)}</dd><dt>Dano</dt><dd>{values?.damage}{delta(candidate.damage-current.damage)}</dd><dt>Armadura</dt><dd>{values?.armor}{delta(candidate.armor-current.armor)}</dd><dt>Agilidade</dt><dd>{values?.agility}{delta(candidate.agility-current.agility)}</dd><dt>Sorte</dt><dd>{values?.luck}{delta(candidate.luck-current.luck)}</dd>{stats&&<><dt>Destruição</dt><dd>{stats.crater}</dd><dt>Ângulo</dt><dd>{stats.minAngle}°–{stats.maxAngle}°</dd></>}</dl>:<div className="cosmetic-tooltip-note">Visual cosmético · não altera atributos</div>}{compatible&&!equipped&&hasAttributes?<div className="tooltip-comparison">Comparação com {CATALOG[equipment[item.slot]]?.name??'seu equipamento'}</div>:null}<footer>{!compatible?'Incompatível com este personagem':equipped?(tip.anchor.dataset.slot&&removable?'Duplo clique para retirar':'✓ Equipado'):tip.mode==='touch'?'Toque para equipar':'Clique para equipar'}</footer></>:<><p>Material para fortalecer armas no ferreiro.</p><dl><dt>Potência</dt><dd>{stone?.power}</dd><dt>Nível</dt><dd>{stone?.level}</dd></dl><footer>Use no ferreiro</footer></>}
 </aside>;
}
