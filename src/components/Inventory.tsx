import {RewardIcon} from './RewardIcon';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {PointerEvent as ReactPointerEvent} from 'react';
import {Check,ChevronLeft,ChevronRight,Coins,Flame,Footprints,Hammer,Heart,LoaderCircle,MoveDown,Palette,RotateCcw,Save,Search,Shield,ShieldCheck,Swords,Target,Trash2,UserRound,Zap} from 'lucide-react';
import {attributes,itemAttributes,CATALOG,DEFAULT_EQUIPMENT,DYES,DYE_SLOTS,ITEMS,SLOTS,SLOT_NAMES,STONES,UNEQUIP,WEAPONS,weaponStats} from '../../shared/catalog';
import type {DyeId,DyeSlot,Equipment,Slot} from '../../shared/catalog';
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
import {ItemCard,ItemCardFrame,rarityLabel,stoneRarity} from './ItemCard';
import './Inventory.css';

const PAGE_SIZE=24;
const ITEM_DRAG='application/x-brasa-item';
const LEFT_SLOTS:Slot[]=['hair','hat','glasses','face'];
const RIGHT_SLOTS:Slot[]=['outfit','wristband','bracelet'];
const LOWER_SLOTS:Slot[]=['weapon'];
type Tip={id:string;anchor:HTMLElement;mode:'hover'|'focus'|'touch'};
type PreviewPose='idle'|'walk'|'aim'|'prone';
const POSES=[{id:'idle',name:'Parado',Icon:UserRound},{id:'walk',name:'Caminhar',Icon:Footprints},{id:'aim',name:'Mirar',Icon:Target},{id:'prone',name:'Deitar',Icon:MoveDown}] as const;
function copyEquipment(eq:Equipment):Equipment{return {...DEFAULT_EQUIPMENT,...eq,dyes:{...eq.dyes}};}
function equipmentKey(eq:Equipment){return JSON.stringify([SLOTS.map(slot=>eq[slot]),DYE_SLOTS.map(slot=>eq.dyes?.[slot]??'original')]);}
function searchable(text:string){return text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}

export function Inventory({onClose,onForge}:{onClose:()=>void;onForge:()=>void}){
 const state=useGame(),p=state.profile!;
 const [draft,setDraft]=useState(()=>copyEquipment(p.equipment));
 const [tab,setTab]=useState('all'),[category,setCategory]=useState<Slot|'all'>('all'),[query,setQuery]=useState(''),[page,setPage]=useState(0);
 const [selected,setSelected]=useState(p.equipment.weapon),[dragging,setDragging]=useState<string|null>(null),[tooltip,setTooltip]=useState<Tip|null>(null);
 const [pose,setPose]=useState<PreviewPose>('idle'),[pending,setPending]=useState(false),[feedback,setFeedback]=useState<string|null>(null);
 const pendingKey=useRef<string|null>(null),serverKey=equipmentKey(p.equipment),previousServerKey=useRef(serverKey);
 const hold=useRef<{timer:ReturnType<typeof setTimeout>|null;x:number;y:number;triggered:boolean}>({timer:null,x:0,y:0,triggered:false}),touchUntil=useRef(0);
 const [previewFlash,setPreviewFlash]=useState<{id:string;key:number}|null>(null);
 const dirty=equipmentKey(draft)!==serverKey;
 const locked=pending||!!state.battle||state.status!=='online';
 const preview=useMemo(()=>({...draft,upgrade:p.upgrades[draft.weapon]??0,compositions:p.compositions}),[draft,p.upgrades,p.compositions]);
 const stats=attributes(preview),item=CATALOG[selected];
 const dyeable=!!item&&DYE_SLOTS.includes(item.slot as DyeSlot)&&item.visual?.variant!=='none';
 const canRemove=!!item&&!!UNEQUIP[item.slot]&&draft[item.slot]!==UNEQUIP[item.slot]&&p.inventory.includes(UNEQUIP[item.slot]!);
 const entries=[...ITEMS.filter(i=>p.inventory.includes(i.id)&&(tab==='all'||tab==='weapons'&&i.slot==='weapon'||tab==='style'&&i.slot!=='weapon')&&(category==='all'||i.slot===category)&&searchable(i.name).includes(searchable(query))).map(i=>i.id),...((tab==='all'||tab==='stones')&&category==='all'?STONES.filter(s=>searchable(s.name).includes(searchable(query))).map(s=>`stone-${s.level}`):[])];
 const pages=Math.max(1,Math.ceil(entries.length/PAGE_SIZE)),currentPage=Math.min(page,pages-1),visible=entries.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);

 // A server acknowledgement publishes the draft. Unrelated profile updates cannot erase local edits.
 useEffect(()=>{
  const previous=previousServerKey.current;previousServerKey.current=serverKey;
  if(pendingKey.current===serverKey){pendingKey.current=null;setPending(false);setDraft(copyEquipment(p.equipment));setFeedback('Visual salvo');}
  else if(serverKey!==previous)setDraft(current=>equipmentKey(current)===previous?copyEquipment(p.equipment):current);
 },[serverKey,p.equipment]);
 useEffect(()=>{
  if(pendingKey.current&&(state.error||state.status!=='online')){pendingKey.current=null;setPending(false);setFeedback(state.error??'Reconectando…');}
 },[state.error,state.status]);

 useEffect(()=>{if(!previewFlash)return;const timer=setTimeout(()=>setPreviewFlash(null),650);return()=>clearTimeout(timer);},[previewFlash]);
 useEffect(()=>{if(!tooltip)return;const dismiss=()=>setTooltip(null),outside=(event:Event)=>{if(!tooltip.anchor.contains(event.target as Node))dismiss();};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismiss();}};window.addEventListener('keydown',escape,true);window.addEventListener('resize',dismiss);window.addEventListener('scroll',dismiss,true);window.addEventListener('pointerdown',outside,true);return()=>{window.removeEventListener('keydown',escape,true);window.removeEventListener('resize',dismiss);window.removeEventListener('scroll',dismiss,true);window.removeEventListener('pointerdown',outside,true);};},[tooltip]);
 useEffect(()=>()=>{if(hold.current.timer)clearTimeout(hold.current.timer);},[]);

 function previewItem(id:string){
  if(hold.current.triggered){hold.current.triggered=false;return;}
  setSelected(id);setTooltip(current=>current?.id===id&&current.mode!=='touch'?current:null);
  const next=CATALOG[id];if(locked||!next||!p.inventory.includes(id))return;
  setDraft(current=>({...current,[next.slot]:id}));setPreviewFlash({id,key:Date.now()});setFeedback(null);audio.play('click');
 }
 function changeDye(color:DyeId){
  if(locked||!dyeable)return;
  setDraft(current=>({...current,[item.slot]:item.id,dyes:{...current.dyes,[item.slot]:color}}));setPreviewFlash({id:item.id,key:Date.now()});setFeedback(null);audio.play('click');
 }
 function restore(){if(locked)return;setDraft(copyEquipment(p.equipment));setSelected(p.equipment[item?.slot??'weapon']);setFeedback(null);setTooltip(null);audio.play('click');}
 function save(){
  if(locked||!dirty||pendingKey.current)return;
  const items=Object.fromEntries(SLOTS.map(slot=>[slot,draft[slot]])) as Record<Slot,string>;
  pendingKey.current=equipmentKey(draft);setPending(true);setFeedback(null);setTooltip(null);client.update({error:null});
  client.send({type:'customize',selection:{items,dyes:{...draft.dyes}}});audio.play('click');
 }
 function filterBySlot(slot:Slot){if(hold.current.triggered){hold.current.triggered=false;return;}setSelected(draft[slot]);setCategory(slot);setTab(slot==='weapon'?'weapons':'style');setPage(0);setQuery('');setTooltip(null);}
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
  const id=draft[slot],it=CATALOG[id],changed=id!==p.equipment[slot];
  return <ItemCard key={slot} rarity={it?.rarity} selected={category===slot} empty={it?.visual?.variant==='none'} aria-label={`${SLOT_NAMES[slot]}: ${it?.name??'Vazio'}`} data-slot={slot} aria-describedby={tooltip?.id===id?'item-tooltip':undefined} className={`item-slot equipment-slot ${changed?'draft-changed':''} ${dragging&&CATALOG[dragging]?.slot===slot?'drop-ready':''}`} onClick={()=>filterBySlot(slot)}
   {...tooltipEvents(id)}
   onDragOver={e=>{if(!locked){e.preventDefault();e.dataTransfer.dropEffect=dragging&&CATALOG[dragging]?.slot===slot?'copy':'none';}}}
   onDrop={e=>{e.preventDefault();setDragging(null);const id=e.dataTransfer.getData(ITEM_DRAG);if(CATALOG[id]?.slot===slot)previewItem(id);else setFeedback(`Use o slot de ${SLOT_NAMES[CATALOG[id]?.slot]??'equipamento'}.`);}}>
   {previewFlash?.id===id&&<i key={previewFlash.key} className="item-preview-pulse" aria-hidden="true"/>}<ItemIcon id={id} upgrade={slot==='weapon'?preview.upgrade:0} size={47}/><span className="equipment-slot-label">{SLOT_NAMES[slot]}</span>{changed&&<i className="draft-mark"/>}{slot==='weapon'&&<b className="slot-upgrade">+{preview.upgrade}</b>}
  </ItemCard>;
 };

 return <Modal title="Mochila" onClose={onClose} className="inventory-window" viewport>
  <div className="inventory-body">
   <section className="equipment-pane" aria-label="Personalização do aventureiro">
    <div className="character-name"><LevelBadge level={p.level} size={42}/><div><h2>{p.name}</h2><span className={dirty?'draft-status dirty':'draft-status'}>{pending?'Salvando…':dirty?'Prévia não salva':'Visual equipado'}</span></div></div>
    <div className="dressing-room" onDragOver={e=>{if(!locked&&e.dataTransfer.types.includes(ITEM_DRAG)){e.preventDefault();e.dataTransfer.dropEffect='copy';}}} onDrop={e=>{e.preventDefault();if(e.target===e.currentTarget||!(e.target as HTMLElement).closest('[data-slot]'))previewItem(e.dataTransfer.getData(ITEM_DRAG));setDragging(null);}}>
     <div className="avatar-halo"/><Avatar equipment={preview} size={284} pose={pose} angle={45} showAura/>
     <div className="equipment-slots left">{LEFT_SLOTS.map(renderSlot)}</div><div className="equipment-slots right">{RIGHT_SLOTS.map(renderSlot)}</div>
     <div className="preview-poses" role="group" aria-label="Animação da prévia">{POSES.map(({id,name,Icon})=><button key={id} aria-label={name} title={name} aria-pressed={pose===id} className={pose===id?'active':''} onClick={()=>setPose(id)}><Icon size={15}/></button>)}</div>
    </div>
    <div className="equipment-slots lower">{LOWER_SLOTS.map(renderSlot)}</div>
    <div className="appearance-actions" aria-label="Ajustar aparência">{dyeable?<><Palette size={15} aria-hidden="true"/><div className="dye-swatches" role="group" aria-label={`Cor de ${SLOT_NAMES[item.slot]}`}>{DYES.map(dye=><button key={dye.id} title={dye.name} aria-label={`Cor ${dye.name}`} aria-pressed={(draft.dyes?.[item.slot as DyeSlot]??'original')===dye.id} disabled={locked} className={`dye-swatch ${dye.id==='original'?'original':''}`} style={{backgroundColor:dye.color}} onClick={()=>changeDye(dye.id)}>{(draft.dyes?.[item.slot as DyeSlot]??'original')===dye.id&&<Check size={13}/>}</button>)}</div></>:<span className="appearance-hint">Escolha um visual para personalizar</span>}{canRemove&&<button className="appearance-remove" disabled={locked} onClick={()=>previewItem(UNEQUIP[item.slot]!)} aria-label={`Remover ${SLOT_NAMES[item.slot]}`} title={`Remover ${SLOT_NAMES[item.slot]}`}><Trash2 size={14}/></button>}</div>
    <div className="combat-power"><PowerIcon size={29}/><span>Poder</span><strong>{stats.power.toLocaleString('pt-BR')}</strong></div>
    <div className="stat-grid" aria-label="Atributos do personagem"><span><Swords size={14}/>Ataque<b>{stats.attack}</b></span><span><Shield size={14}/>Defesa<b>{stats.defense}</b></span><span><Flame size={14}/>Dano<b>{stats.damage}</b></span><span><ShieldCheck size={14}/>Armadura<b>{stats.armor}</b></span><span><Zap size={14}/>Agilidade<b>{stats.agility}</b></span><span><Heart size={14}/>Vida<b>{stats.hp}</b></span><span className="stat-wide"><Footprints size={14}/>Vigor<b>{stats.stamina}</b></span></div>
   </section>
   <section className="bag-pane" aria-label="Itens da mochila">
    <nav className="tabs" aria-label="Tipo de item">{[['all','Tudo'],['style','Visuais'],['weapons','Armas'],['stones','Pedras']].map(([id,name])=><button key={id} aria-pressed={tab===id} className={tab===id?'active':''} onClick={()=>{setTab(id);setCategory('all');setPage(0);setTooltip(null);}}>{name}</button>)}<span className="capacity">{entries.length} itens</span></nav>
    <div className="inventory-filters"><select aria-label="Categoria" value={category} disabled={tab==='stones'} onChange={e=>{setCategory(e.target.value as Slot|'all');setPage(0);setTooltip(null);}}><option value="all">Todas as categorias</option>{SLOTS.filter(slot=>tab!=='weapons'||slot==='weapon').filter(slot=>tab!=='style'||slot!=='weapon').map(slot=><option key={slot} value={slot}>{SLOT_NAMES[slot]}</option>)}</select><label><Search size={14}/><input aria-label="Buscar item" placeholder="Buscar item" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);setTooltip(null);}}/></label></div>
    <div className="bag-grid">{Array.from({length:PAGE_SIZE},(_,index)=>{
     const id=visible[index];if(!id)return <ItemCardFrame variant="slot" empty className="item-slot empty" key={`empty-${index}`}/>;
     const it=CATALOG[id],st=STONES.find(s=>`stone-${s.level}`===id),level=p.upgrades[id]??0,inPreview=!!it&&draft[it.slot]===id;
     return <ItemCard key={id} rarity={it?.rarity??stoneRarity(st?.level??1)} selected={id===selected} aria-label={it?.name??st?.name} aria-pressed={inPreview} aria-describedby={tooltip?.id===id?'item-tooltip':undefined} className={`item-slot ${id===selected?'selected':''}`} draggable={!!it&&!locked}
      onDragStart={e=>{e.dataTransfer.setData(ITEM_DRAG,id);e.dataTransfer.effectAllowed='copy';setDragging(id);setTooltip(null);}} onDragEnd={()=>setDragging(null)}
      onClick={()=>previewItem(id)} {...tooltipEvents(id)}>
      {previewFlash?.id===id&&<i key={previewFlash.key} className="item-preview-pulse" aria-hidden="true"/>}{it?<ItemIcon id={id} upgrade={level} size={68}/>:<img src={`/assets/${id}.png`} className="item-art" alt={st?.name} width={62} height={62}/>}
      {inPreview&&<span className={`equipped-mark ${p.equipment[it.slot]===id?'saved':'draft'}`}><Check size={11}/></span>}{it?.slot==='weapon'&&<b className="slot-upgrade">+{level}</b>}{st&&<b className="slot-quantity">{p.stones[String(st.level)]??0}</b>}
     </ItemCard>;
    })}{!entries.length&&<span className="inventory-no-items">Nenhum item encontrado</span>}</div>
    <div className="inventory-pagination"><span role="status" aria-live="polite">{feedback??(dirty?'Seu visual está em prévia.':'')}</span><div><button aria-label="Página anterior" disabled={currentPage===0} onClick={()=>{setPage(currentPage-1);setTooltip(null);}}><ChevronLeft size={16}/></button><span>{currentPage+1} / {pages}</span><button aria-label="Próxima página" disabled={currentPage===pages-1} onClick={()=>{setPage(currentPage+1);setTooltip(null);}}><ChevronRight size={16}/></button></div></div>

    <footer className="bag-footer"><span><RewardIcon size={17}/>{p.gold.toLocaleString('pt-BR')}</span><div><button className="button quiet forge-link" disabled={!!state.room||pending} onClick={onForge} title="Ferreiro" aria-label="Abrir ferreiro"><Hammer size={16}/></button><button className="button quiet" disabled={!dirty||locked} onClick={restore}><RotateCcw size={15}/>Restaurar</button><button className={`button gold ${feedback==='Visual salvo'?'save-confirmed':''}`} aria-label="Salvar personalização" aria-busy={pending} disabled={!dirty||locked} onClick={save}>{pending?<LoaderCircle className="button-spinner" size={15}/>:feedback==='Visual salvo'?<Check size={15}/>:<Save size={15}/ >}{pending?'Salvando…':feedback==='Visual salvo'?'Salvo':'Salvar'}</button></div></footer>
   </section>
  </div>
  {tooltip&&createPortal(<InventoryTooltip tip={tooltip} equipment={p.equipment} upgrades={p.upgrades} compositions={p.compositions} previewed={!!CATALOG[tooltip.id]&&draft[CATALOG[tooltip.id].slot]===tooltip.id}/>,document.body)}
 </Modal>;
}

function InventoryTooltip({tip,equipment,upgrades,compositions,previewed}:{tip:Tip;equipment:Equipment;upgrades:Record<string,number>;compositions:Compositions;previewed:boolean}){
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
 },[id,anchor,previewed,equipped,level]);
 const delta=(value:number)=>!equipped&&value!==0?<span className={`tooltip-delta ${value>0?'positive':'negative'}`}>{value>0?'+':''}{value}</span>:null;
 return <aside ref={ref} id="item-tooltip" role="tooltip" className="item-tooltip inventory-tooltip" data-rarity={rarity} style={{left:position?.x??0,top:position?.y??0,visibility:position?'visible':'hidden'}}>
  <header><ItemCardFrame rarity={rarity} variant="detail">{item?<ItemIcon id={id} size={49} upgrade={level}/>:<img width={46} src={`/assets/${id}.png`} alt=""/>}</ItemCardFrame><div><small>{rarityLabel(rarity)} · {item?SLOT_NAMES[item.slot]:'Pedra de upgrade'}</small><div className="tooltip-name"><strong>{item?.name??stone?.name}</strong>{weapon&&<UpgradeBadge level={level} size={76}/>}</div>{stone&&<b>Nível {stone.level}</b>}</div></header>
  {item?<><p>{item.description}</p>{!!Object.keys(compositions?.[id]??{}).length&&<div className="tooltip-composed">Composição: {Object.entries(compositions[id]).map(([stat,value])=>`${COMPOSITION_STAT_NAMES[stat as CompositionStat]} +${value}`).join(' · ')}</div>}{hasAttributes?<dl><dt>Ataque</dt><dd>{values?.attack}{delta(candidate.attack-current.attack)}</dd><dt>Defesa</dt><dd>{values?.defense}{delta(candidate.defense-current.defense)}</dd><dt>Dano</dt><dd>{values?.damage}{delta(candidate.damage-current.damage)}</dd><dt>Armadura</dt><dd>{values?.armor}{delta(candidate.armor-current.armor)}</dd><dt>Agilidade</dt><dd>{values?.agility}{delta(candidate.agility-current.agility)}</dd>{stats&&<><dt>Destruição</dt><dd>{stats.crater}</dd><dt>Ângulo</dt><dd>{stats.minAngle}°–{stats.maxAngle}°</dd></>}</dl>:<div className="cosmetic-tooltip-note">Visual cosmético · não altera atributos</div>}{!equipped&&hasAttributes?<div className="tooltip-comparison">Comparação com {CATALOG[equipment[item.slot]]?.name??'seu equipamento'}</div>:null}<footer>{previewed&&!equipped?'Na prévia · salve para equipar':equipped?'✓ Equipado':tip.mode==='touch'?'Toque para experimentar':'Clique para experimentar'}</footer></>:<><p>Material para fortalecer armas no ferreiro.</p><dl><dt>Potência</dt><dd>{stone?.power}</dd><dt>Nível</dt><dd>{stone?.level}</dd></dl><footer>Use no ferreiro</footer></>}
 </aside>;
}
