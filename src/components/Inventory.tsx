import {useEffect,useMemo,useRef,useState} from 'react';
import type {FocusEvent,MouseEvent} from 'react';
import {Check,ChevronLeft,ChevronRight,Coins,Footprints,Hammer,Heart,MoveDown,RotateCcw,Save,Search,Shield,Swords,Target,Trash2,UserRound,Zap} from 'lucide-react';
import {attributes,CATALOG,DEFAULT_EQUIPMENT,DYES,DYE_SLOTS,ITEMS,SLOTS,SLOT_NAMES,STONES,UNEQUIP,WEAPONS,weaponStats} from '../../shared/catalog';
import type {DyeId,DyeSlot,Equipment,Slot} from '../../shared/catalog';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {Avatar} from './Avatar';
import {ItemIcon} from './ItemIcon';
import {Modal} from './Modal';
import {UpgradeBadge} from './UpgradeBadge';
import {ItemCard,ItemCardFrame,rarityLabel,stoneRarity} from './ItemCard';
import './Inventory.css';

const PAGE_SIZE=24;
const ITEM_DRAG='application/x-brasa-item';
const LEFT_SLOTS:Slot[]=['hair','hat','glasses','face'];
const RIGHT_SLOTS:Slot[]=['outfit','wristband','bracelet'];
const LOWER_SLOTS:Slot[]=['weapon'];
type Tip={id:string;x:number;y:number};
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
 const dirty=equipmentKey(draft)!==serverKey;
 const locked=pending||!!state.battle||state.status!=='online';
 const preview=useMemo(()=>({...draft,upgrade:p.upgrades[draft.weapon]??0}),[draft,p.upgrades]);
 const stats=attributes(preview),item=CATALOG[selected],stone=STONES.find(s=>`stone-${s.level}`===selected);
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

 function previewItem(id:string){
  setTooltip(null);setSelected(id);
  const next=CATALOG[id];if(locked||!next||!p.inventory.includes(id))return;
  setDraft(current=>({...current,[next.slot]:id}));setFeedback(null);audio.play('click');
 }
 function changeDye(color:DyeId){
  if(locked||!dyeable)return;
  setDraft(current=>({...current,[item.slot]:item.id,dyes:{...current.dyes,[item.slot]:color}}));setFeedback(null);
 }
 function restore(){if(locked)return;setDraft(copyEquipment(p.equipment));setSelected(p.equipment[item?.slot??'weapon']);setFeedback(null);setTooltip(null);audio.play('click');}
 function save(){
  if(locked||!dirty||pendingKey.current)return;
  const items=Object.fromEntries(SLOTS.map(slot=>[slot,draft[slot]])) as Record<Slot,string>;
  pendingKey.current=equipmentKey(draft);setPending(true);setFeedback(null);setTooltip(null);client.update({error:null});
  client.send({type:'customize',selection:{items,dyes:{...draft.dyes}}});audio.play('click');
 }
 function filterBySlot(slot:Slot){setSelected(draft[slot]);setCategory(slot);setTab(slot==='weapon'?'weapons':'style');setPage(0);setQuery('');setTooltip(null);}
 function showTip(id:string,e:MouseEvent<HTMLElement>|FocusEvent<HTMLElement>){
  const target=e.currentTarget.getBoundingClientRect(),panel=e.currentTarget.closest<HTMLElement>('.game-window')!,bounds=panel.getBoundingClientRect(),scale=bounds.width/panel.offsetWidth;
  let x=(target.right-bounds.left)/scale+10;if(x+288>panel.offsetWidth-12)x=(target.left-bounds.left)/scale-298;
  setTooltip({id,x:Math.max(12,x),y:Math.min(panel.offsetHeight-325,Math.max(80,(target.top-bounds.top)/scale))});
 }
 const renderSlot=(slot:Slot)=>{
  const id=draft[slot],it=CATALOG[id],changed=id!==p.equipment[slot];
  return <ItemCard key={slot} rarity={it?.rarity} selected={category===slot} empty={it?.visual?.variant==='none'} aria-label={`${SLOT_NAMES[slot]}: ${it?.name??'Vazio'}`} data-slot={slot} className={`item-slot equipment-slot ${changed?'draft-changed':''} ${dragging&&CATALOG[dragging]?.slot===slot?'drop-ready':''}`} onClick={()=>filterBySlot(slot)}
   onMouseEnter={e=>showTip(id,e)} onMouseLeave={()=>setTooltip(null)} onFocus={e=>showTip(id,e)} onBlur={()=>setTooltip(null)}
   onDragOver={e=>{if(!locked){e.preventDefault();e.dataTransfer.dropEffect=dragging&&CATALOG[dragging]?.slot===slot?'copy':'none';}}}
   onDrop={e=>{e.preventDefault();setDragging(null);const id=e.dataTransfer.getData(ITEM_DRAG);if(CATALOG[id]?.slot===slot)previewItem(id);else setFeedback(`Use o slot de ${SLOT_NAMES[CATALOG[id]?.slot]??'equipamento'}.`);}}>
   <ItemIcon id={id} upgrade={slot==='weapon'?preview.upgrade:0} size={47}/><span className="equipment-slot-label">{SLOT_NAMES[slot]}</span>{changed&&<i className="draft-mark"/>}{slot==='weapon'&&<b className="slot-upgrade">+{preview.upgrade}</b>}
  </ItemCard>;
 };

 return <Modal title="Mochila" onClose={onClose} className="inventory-window">
  <div className="inventory-body">
   <section className="equipment-pane" aria-label="Personalização do aventureiro">
    <div className="character-name"><span className="level-gem">{p.level}</span><div><h2>{p.name}</h2><span className={dirty?'draft-status dirty':'draft-status'}>{pending?'Salvando…':dirty?'Prévia não salva':'Visual equipado'}</span></div></div>
    <div className="dressing-room" onDragOver={e=>{if(!locked&&e.dataTransfer.types.includes(ITEM_DRAG)){e.preventDefault();e.dataTransfer.dropEffect='copy';}}} onDrop={e=>{e.preventDefault();if(e.target===e.currentTarget||!(e.target as HTMLElement).closest('[data-slot]'))previewItem(e.dataTransfer.getData(ITEM_DRAG));setDragging(null);}}>
     <div className="avatar-halo"/><div className="avatar-platform"/><Avatar equipment={preview} size={284} pose={pose} angle={45}/>
     <div className="equipment-slots left">{LEFT_SLOTS.map(renderSlot)}</div><div className="equipment-slots right">{RIGHT_SLOTS.map(renderSlot)}</div>
     <div className="preview-poses" role="group" aria-label="Animação da prévia">{POSES.map(({id,name,Icon})=><button key={id} aria-label={name} title={name} aria-pressed={pose===id} className={pose===id?'active':''} onClick={()=>setPose(id)}><Icon size={15}/></button>)}</div>
    </div>
    <div className="equipment-slots lower">{LOWER_SLOTS.map(renderSlot)}</div>
    <div className="combat-power"><Swords size={20}/><span>Poder</span><strong>{stats.power.toLocaleString('pt-BR')}</strong></div>
    <div className="stat-grid"><span><Swords size={14}/>Ataque<b>{stats.attack}</b></span><span><Shield size={14}/>Defesa<b>{stats.defense}</b></span><span><Zap size={14}/>Agilidade<b>{stats.agility}</b></span><span><Heart size={14}/>Vida<b>{stats.hp}</b></span></div>
   </section>
   <section className="bag-pane" aria-label="Itens da mochila">
    <nav className="tabs" aria-label="Tipo de item">{[['all','Tudo'],['style','Visuais'],['weapons','Armas'],['stones','Pedras']].map(([id,name])=><button key={id} aria-pressed={tab===id} className={tab===id?'active':''} onClick={()=>{setTab(id);setCategory('all');setPage(0);setTooltip(null);}}>{name}</button>)}<span className="capacity">{entries.length} itens</span></nav>
    <div className="inventory-filters"><select aria-label="Categoria" value={category} disabled={tab==='stones'} onChange={e=>{setCategory(e.target.value as Slot|'all');setPage(0);setTooltip(null);}}><option value="all">Todas as categorias</option>{SLOTS.filter(slot=>tab!=='weapons'||slot==='weapon').filter(slot=>tab!=='style'||slot!=='weapon').map(slot=><option key={slot} value={slot}>{SLOT_NAMES[slot]}</option>)}</select><label><Search size={14}/><input aria-label="Buscar item" placeholder="Buscar item" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);setTooltip(null);}}/></label></div>
    <div className="bag-grid">{Array.from({length:PAGE_SIZE},(_,index)=>{
     const id=visible[index];if(!id)return <ItemCardFrame variant="slot" empty className="item-slot empty" key={`empty-${index}`}/>;
     const it=CATALOG[id],st=STONES.find(s=>`stone-${s.level}`===id),level=p.upgrades[id]??0,inPreview=!!it&&draft[it.slot]===id;
     return <ItemCard key={id} rarity={it?.rarity??stoneRarity(st?.level??1)} selected={id===selected} aria-label={it?.name??st?.name} aria-pressed={inPreview} aria-describedby={tooltip?.id===id?'item-tooltip':undefined} className={`item-slot ${id===selected?'selected':''}`} draggable={!!it&&!locked}
      onDragStart={e=>{e.dataTransfer.setData(ITEM_DRAG,id);e.dataTransfer.effectAllowed='copy';setDragging(id);setTooltip(null);}} onDragEnd={()=>setDragging(null)}
      onClick={()=>previewItem(id)} onDoubleClick={()=>previewItem(id)} onMouseEnter={e=>showTip(id,e)} onMouseLeave={()=>setTooltip(null)} onFocus={e=>showTip(id,e)} onBlur={()=>setTooltip(null)}>
      {it?<ItemIcon id={id} upgrade={level} size={68}/>:<img src={`/assets/${id}.png`} className="item-art" alt={st?.name} width={62} height={62}/>}
      {inPreview&&<span className={`equipped-mark ${p.equipment[it.slot]===id?'saved':'draft'}`}><Check size={11}/></span>}{it?.slot==='weapon'&&<b className="slot-upgrade">+{level}</b>}{st&&<b className="slot-quantity">{p.stones[String(st.level)]??0}</b>}
     </ItemCard>;
    })}{!entries.length&&<span className="inventory-no-items">Nenhum item encontrado</span>}</div>
    <div className="inventory-pagination"><span>{feedback??(dirty?'Seu visual está em prévia.':'')}</span><div><button aria-label="Página anterior" disabled={currentPage===0} onClick={()=>{setPage(currentPage-1);setTooltip(null);}}><ChevronLeft size={16}/></button><span>{currentPage+1} / {pages}</span><button aria-label="Próxima página" disabled={currentPage===pages-1} onClick={()=>{setPage(currentPage+1);setTooltip(null);}}><ChevronRight size={16}/></button></div></div>
    <div className="bag-customize"><div className="customize-selected"><span>{item?.name??stone?.name??'Selecione um item'}</span>{canRemove&&<button disabled={locked} onClick={()=>previewItem(UNEQUIP[item.slot]!)} aria-label={`Remover ${SLOT_NAMES[item.slot]}`}><Trash2 size={13}/>Remover</button>}</div><div className="customize-colors">{dyeable?<><span>Cor</span><div className="dye-swatches" role="group" aria-label={`Cor de ${SLOT_NAMES[item.slot]}`}>{DYES.map(dye=><button key={dye.id} title={dye.name} aria-label={`Cor ${dye.name}`} aria-pressed={(draft.dyes?.[item.slot as DyeSlot]??'original')===dye.id} disabled={locked} className={`dye-swatch ${dye.id==='original'?'original':''}`} style={{backgroundColor:dye.color}} onClick={()=>changeDye(dye.id)}>{(draft.dyes?.[item.slot as DyeSlot]??'original')===dye.id&&<Check size={13}/>}</button>)}</div></>:<span className="preview-guidance">{stone?'Use no ferreiro.':item?'Clique para experimentar. Salve para equipar.':''}</span>}</div></div>
    <footer className="bag-footer"><span><Coins size={17}/>{p.gold.toLocaleString('pt-BR')}</span><div><button className="button quiet forge-link" disabled={!!state.room||pending} onClick={onForge} title="Ferreiro"><Hammer size={16}/></button><button className="button quiet" disabled={!dirty||locked} onClick={restore}><RotateCcw size={15}/>Restaurar</button><button className="button gold" aria-label="Salvar personalização" disabled={!dirty||locked} onClick={save}><Save size={15}/>{pending?'Salvando…':'Salvar'}</button></div></footer>
   </section>
  </div>
  {tooltip&&<InventoryTooltip id={tooltip.id} level={p.upgrades[tooltip.id]??0} x={tooltip.x} y={tooltip.y} equipped={!!CATALOG[tooltip.id]&&p.equipment[CATALOG[tooltip.id].slot]===tooltip.id} previewed={!!CATALOG[tooltip.id]&&draft[CATALOG[tooltip.id].slot]===tooltip.id}/>}
 </Modal>;
}

function InventoryTooltip({id,level,x,y,equipped,previewed}:{id:string;level:number;x:number;y:number;equipped:boolean;previewed:boolean}){
 const item=CATALOG[id],stone=STONES.find(s=>`stone-${s.level}`===id),weapon=WEAPONS.find(w=>w.id===id),stats=weapon?weaponStats(weapon,level):null,rarity=item?.rarity??stoneRarity(stone?.level??1);
 return <aside id="item-tooltip" role="tooltip" className={`item-tooltip ${rarity}`} data-rarity={rarity} style={{left:x,top:y}}><header><ItemCardFrame rarity={rarity}>{item?<ItemIcon id={id} size={47} upgrade={level}/>:<img width={46} src={`/assets/${id}.png`} alt=""/>}</ItemCardFrame><div><small>{rarityLabel(rarity)} · {item?SLOT_NAMES[item.slot]:'Pedra de upgrade'}</small><div className="tooltip-name"><strong>{item?.name??stone?.name}</strong>{weapon&&<UpgradeBadge level={level} size={85}/>}</div>{!weapon&&<b>{stone?`Nível ${stone.level}`:'Nível 1'}</b>}</div></header>
  {item?<><p>{item.description}</p>{(item.attack||item.defense||item.agility||stats)?<dl><dt>Ataque</dt><dd>+{stats?.attack??item.attack}</dd><dt>Defesa</dt><dd>+{item.defense}</dd><dt>Agilidade</dt><dd>+{item.agility}</dd>{stats&&<><dt>Dano</dt><dd>{stats.damage}</dd><dt>Destruição</dt><dd>{stats.crater}</dd><dt>Ângulo</dt><dd>{stats.minAngle}°–{stats.maxAngle}°</dd></>}</dl>:<div className="cosmetic-tooltip-note">Visual cosmético</div>}<footer>{previewed&&!equipped?'Na prévia · salve para equipar':equipped?'✓ Equipado':'Clique para experimentar'}</footer></>:<><dl><dt>Potência</dt><dd>{stone?.power}</dd></dl><footer>Use no ferreiro</footer></>}
 </aside>;
}
