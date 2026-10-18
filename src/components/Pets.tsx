import {useEffect,useMemo,useState} from 'react';
import type {DragEvent} from 'react';
import {Apple,ChevronLeft,ChevronRight,Heart,Link2,PawPrint,Sparkles,Star} from 'lucide-react';
import {PET_CONFIG,PET_STAT_NAMES} from '../../shared/petConfig';
import type {PetStatKey} from '../../shared/petConfig';
import {petLevelProgress,petSpecies,petStats,petVisual,PET_FOODS,PET_QUALITIES} from '../../shared/pets';
import type {PlayerPet} from '../../shared/pets';
import {petSkill,skillLevel} from '../../shared/petSkills';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {Modal} from './Modal';
import {ItemCard,ItemCardFrame} from './ItemCard';
import {CouponIcon,RewardIcon} from './RewardIcon';
import './WoodTheme.css';
import './Backpack.css';
import './Pets.css';

// Layout of the DDTank pet screen: on the left the pet row, its stage (gear slots, stars, food slot, level,
// vitality hearts, EXP), its attributes and the call button, then its learned skills and the four battle
// skill slots around a chain; on the right the bag with the pet food. Nothing here invents a pet: with no
// pet every box stays empty and the stage says so.
const ROW=5,BAG=42,HEARTS=5,FOOD_DRAG='application/x-brasa-pet-food';
const KIND_NAMES={active:'Ativa',passive:'Passiva',permanent:'Permanente',conditional:'Condicional'} as const;
/** Vida first, like the DDTank pet sheet. */
const STAT_ORDER:PetStatKey[]=['hp','attack','defense','agility','luck','damage','armor','stamina'];
const LOCK='/assets/ui/arena-slot-lock.png';

/** The pet's painted portrait when its species has one; otherwise a plain paw mark (never a placeholder creature). */
function Portrait({pet,size}:{pet:PlayerPet;size:number}){
 const art=petVisual(pet)?.portrait??petVisual(pet)?.icon;
 return <span className="pets-portrait" style={{width:size,height:size}}>{art?<img src={art} alt="" draggable={false}/>:<PawPrint size={size*.45}/>}</span>;
}
function SkillIcon({id}:{id:string}){
 const icon=petSkill(id)?.visual?.icon;
 return icon?<img src={icon} alt="" draggable={false}/>:<Sparkles size={22} aria-hidden="true"/>;
}

export function Pets(){
 const {pets,petResult,petPending,profile}=useGame();
 const [selected,setSelected]=useState<string|null>(null),[start,setStart]=useState(0),[food,setFood]=useState<string|null>(null);
 const list=useMemo(()=>pets?.pets??[],[pets]);
 const pet=list.find(p=>p.id===selected)??null;
 useEffect(()=>{if(selected&&!list.some(p=>p.id===selected))setSelected(null);if(!selected&&list.length)setSelected((list.find(p=>p.equipped)??list[0]).id);},[list,selected]);
 const foods=useMemo(()=>Object.entries(pets?.food??{}).filter(([id,n])=>n>0&&PET_FOODS.has(id)),[pets]);
 useEffect(()=>{if(food&&!foods.some(([id])=>id===food))setFood(null);},[foods,food]);
 const pages=Math.max(0,list.length-ROW),first=Math.min(start,pages);
 return <Modal title="Pets" onClose={()=>client.closePets()} className="bag-window pets-window" viewport>
  <div className="pets-layout">
   <section className="pets-panel wood-pane" aria-label="Pet">
    <div className="pets-row">
     <button className="pets-arrow" aria-label="Pets anteriores" disabled={first===0} onClick={()=>setStart(first-1)}><ChevronLeft size={18}/></button>
     <ul className="pets-carousel">{Array.from({length:ROW},(_,i)=>{const p=list[first+i];
      return <li key={p?.id??`empty-${i}`}>{p?<button className={`pets-slot ${p.id===selected?'selected':''}`} title={`${p.name} · Nv. ${p.level}`} aria-pressed={p.id===selected} onClick={()=>{setSelected(p.id);audio.play('click');}}><Portrait pet={p} size={54}/>{p.equipped&&<b className="pets-stamp small">Lutar</b>}</button>
       :<span className="pets-slot empty" aria-hidden="true"><PawPrint size={22}/></span>}</li>;})}</ul>
     <button className="pets-arrow" aria-label="Próximos pets" disabled={first>=pages} onClick={()=>setStart(first+1)}><ChevronRight size={18}/></button>
    </div>
    <PetHeader pet={pet} pending={petPending}/>
    <div className="pets-middle">
     <PetStage pet={pet} pets={!!pets} food={food} onFood={setFood} pending={petPending}/>
     <PetStats pet={pet} pending={petPending}/>
    </div>
    <PetSkills pet={pet} pending={petPending}/>
   </section>
   <section className="pets-bag wood-pane" aria-label="Itens de pet">
    <header><strong>Itens</strong><small>{foods.length?`${foods.length} alimento(s)`:'Sem alimentos'}</small></header>
    <div className="bag-grid pets-bag-grid">{Array.from({length:BAG},(_,i)=>{const entry=foods[i];
     if(!entry)return <ItemCardFrame variant="slot" empty className="bag-cell empty" key={`empty-${i}`}/>;
     const [id,n]=entry,f=PET_FOODS.get(id)!;
     return <ItemCard key={id} variant="slot" empty selected={food===id} className={`bag-cell ${food===id?'selected':''}`} title={`${f.name}: +${f.vitality} de vitalidade${f.xp?`, +${f.xp} EXP`:''}`} aria-label={f.name} draggable={!!pet}
      onDragStart={e=>{e.dataTransfer.setData(FOOD_DRAG,id);e.dataTransfer.effectAllowed='copy';}} onClick={()=>{setFood(food===id?null:id);audio.play('click');}}>
      {f.icon?<img className="item-art" src={f.icon} alt="" draggable={false}/>:<Apple size={30}/>}<b className="slot-quantity">{n}</b>
     </ItemCard>;})}</div>
    <footer className="pets-wallet"><span title="Moedas Brasa"><RewardIcon size={18}/><b>{(profile?.gold??0).toLocaleString('pt-BR')}</b></span><span title="Cupons"><CouponIcon size={22}/><b>{(profile?.coupons??0).toLocaleString('pt-BR')}</b></span><span className="pets-count">{list.length}/{pets?.capacity??PET_CONFIG.maxOwned} pets</span></footer>
   </section>
  </div>
  {petResult&&<p className="pets-feedback" role="status">{petResult.result.message}</p>}
 </Modal>;
}

function PetHeader({pet,pending}:{pet:PlayerPet|null;pending:boolean}){
 const [renaming,setRenaming]=useState(false),[name,setName]=useState(''),[releasing,setReleasing]=useState<string|null>(null);
 useEffect(()=>{setRenaming(false);setReleasing(null);setName(pet?.name??'');},[pet?.id,pet?.name]);
 return <div className="pets-header">
  {renaming&&pet?<form className="pets-rename" onSubmit={e=>{e.preventDefault();const next=name.trim();if(next&&next!==pet.name)client.petAction({type:'pet-rename',pet:pet.id,name:next});setRenaming(false);}}>
   <input autoFocus aria-label="Novo nome" value={name} minLength={PET_CONFIG.nameLength.min} maxLength={PET_CONFIG.nameLength.max} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setRenaming(false);}}}/>
   <button className="pets-chip">OK</button></form>
   :<strong className="pets-name">{pet?.name??'Nenhum pet'}</strong>}
  <div className="pets-chips">
   <button className="pets-chip" disabled={!pet||pending} onClick={()=>setRenaming(true)}>Renomear</button>
   <button className="pets-chip" disabled={!pet||pending} onClick={()=>pet&&client.petAction({type:'pet-lock',pet:pet.id,locked:!pet.locked})}>{pet?.locked?'Desproteger':'Proteger'}</button>
   <button className="pets-chip green" disabled={!pet||pending||pet.locked||pet.equipped} title={pet?.locked?'Pet protegido':pet?.equipped?'Chame o pet de volta primeiro':undefined} onClick={()=>setReleasing('')}>Libertar pet</button>
  </div>
  {pet&&releasing!==null&&<form className="pets-release-confirm wood-cream" onSubmit={e=>{e.preventDefault();client.petAction({type:'pet-release',pet:pet.id,confirm:true,name:releasing});}}>
   <p>Libertar é para sempre. Digite <b>{pet.name}</b> para confirmar.</p>
   <input autoFocus aria-label="Nome do pet" value={releasing} onChange={e=>setReleasing(e.target.value)}/>
   <button className="wood-button" disabled={pending||releasing.trim()!==pet.name}>Libertar</button><button type="button" className="wood-quiet" onClick={()=>setReleasing(null)}>Cancelar</button>
  </form>}
 </div>;
}

function PetStage({pet,pets,food,onFood,pending}:{pet:PlayerPet|null;pets:boolean;food:string|null;onFood:(id:string|null)=>void;pending:boolean}){
 const species=pet?petSpecies(pet.species):undefined,progress=pet?petLevelProgress(pet):null,item=food?PET_FOODS.get(food):undefined;
 const hearts=pet?Math.ceil(pet.vitality/PET_CONFIG.vitality.max*HEARTS):0;
 const feed=()=>{if(pet&&item)client.petAction({type:'pet-feed',pet:pet.id,food:item.id,quantity:1});};
 const drop=(e:DragEvent)=>{const id=e.dataTransfer.getData(FOOD_DRAG);if(id){e.preventDefault();onFood(id);}};
 return <div className="pets-stage wood-cream">
  <ul className="pets-gear" aria-label="Equipamentos do pet (em breve)">{PET_CONFIG.equipment.slots.map(slot=><li key={slot} title="Equipamentos do pet chegam em breve"><img src={LOCK} alt="" draggable={false}/></li>)}</ul>
  <div className="pets-stars" aria-label={pet?`${pet.stars} estrelas`:undefined}>{pet&&Array.from({length:species?.maxStars??0},(_,i)=><Star key={i} size={20} className={i<pet.stars?'on':''}/>)}</div>
  {pet?.equipped&&<b className="pets-stamp">Lutar</b>}
  <div className="pets-figure">{!pets?<p className="pets-empty">Chamando seus pets…</p>:pet?<><Portrait pet={pet} size={120}/><small>{species?.name??'Espécie indisponível'} · {PET_QUALITIES.get(pet.quality)?.name??pet.quality}</small></>
   :<div className="pets-empty"><PawPrint size={40}/><strong>Você ainda não possui pets.</strong><p>Seus futuros companheiros aparecerão aqui.</p></div>}</div>
  <div className={`pets-food-slot ${item?'filled':''}`} title={item?`${item.name}: clique em Alimentar`:'Arraste um alimento aqui'} onDragOver={e=>{if(pet&&e.dataTransfer.types.includes(FOOD_DRAG)){e.preventDefault();e.dataTransfer.dropEffect='copy';}}} onDrop={drop} onClick={()=>item&&onFood(null)}>
   {item?(item.icon?<img src={item.icon} alt={item.name}/>:<Apple size={26}/>):<Apple size={22} className="ghost" aria-hidden="true"/>}
  </div>
  <div className="pets-stage-foot">
   <span className="pets-level">Nv. <b>{pet?.level??'—'}</b></span>
   <span className="pets-hearts" role="meter" aria-label={pet?`Vitalidade ${pet.vitality} de ${PET_CONFIG.vitality.max}`:'Vitalidade'} aria-valuenow={pet?.vitality??0} aria-valuemin={0} aria-valuemax={PET_CONFIG.vitality.max} title={pet?`Vitalidade ${pet.vitality} / ${PET_CONFIG.vitality.max}`:undefined}>{Array.from({length:HEARTS},(_,i)=><Heart key={i} size={22} className={i<hearts?'on':''}/>)}</span>
   <button className="pets-chip orange" disabled={!pet||!item||pending} onClick={feed}>Alimentar</button>
  </div>
  <div className="pets-exp" role="meter" aria-label="EXP do pet" aria-valuenow={progress?.current??0} aria-valuemin={0} aria-valuemax={progress?.required??1}>
   <span>EXP</span><div><i style={{width:`${progress?(progress.capped?100:progress.current/Math.max(1,progress.required)*100):0}%`}}/><small>{progress?(progress.capped?'Nível máximo':`${progress.current}/${progress.required}`):'—'}</small></div>
  </div>
 </div>;
}

function PetStats({pet,pending}:{pet:PlayerPet|null;pending:boolean}){
 const own=pet?petStats(pet):null,species=pet?petSpecies(pet.species):undefined;
 return <div className="pets-side">
  <dl className="pets-stats">{STAT_ORDER.map(key=><div key={key}><dt>{PET_STAT_NAMES[key]}</dt><dd>{own?own[key].toLocaleString('pt-BR'):'—'}</dd></div>)}</dl>
  {pet?.equipped?<button className="pets-call" disabled={pending} onClick={()=>client.petAction({type:'pet-unequip',pet:pet.id})}>Chamar de volta</button>
   :<button className="pets-call" disabled={!pet||pending||!species} onClick={()=>pet&&client.petAction({type:'pet-equip',pet:pet.id})}>Lutar</button>}
 </div>;
}

function PetSkills({pet,pending}:{pet:PlayerPet|null;pending:boolean}){
 const [chosen,setChosen]=useState<string|null>(null),[offset,setOffset]=useState(0);
 useEffect(()=>{setChosen(null);setOffset(0);},[pet?.id]);
 const known=pet?.knownSkills??[],shown=8,rows=Math.max(0,Math.ceil((known.length-shown)/4));
 const place=(slot:number)=>{if(!pet)return;if(chosen){client.petAction({type:'pet-skill-slot',pet:pet.id,slot,skill:chosen});setChosen(null);}else if(pet.equippedSkills[slot])client.petAction({type:'pet-skill-slot',pet:pet.id,slot,skill:null});};
 return <div className="pets-skills">
  <div className="pets-learned">
   <h3>Habilidades do pet</h3>
   <div className="pets-learned-body">
    <ul>{Array.from({length:shown},(_,i)=>{const entry=known[offset*4+i],skill=entry?petSkill(entry.id):undefined;
     if(!entry||!skill)return <li key={`empty-${i}`}><span className="pets-skill empty"/></li>;
     const level=skillLevel(skill,entry.level),need=skill.requirements,met=!!pet&&pet.level>=need.petLevel&&pet.stage>=need.stage&&pet.stars>=need.stars;
     return <li key={entry.id}><button className={`pets-skill ${chosen===entry.id?'selected':''} ${met?'':'unmet'}`} disabled={!met||pending} onClick={()=>setChosen(chosen===entry.id?null:entry.id)}
      title={`${skill.name} (${KIND_NAMES[skill.kind]}, Nv. ${entry.level})${level.cost?` · ${level.cost} de Magia`:''}${level.cooldown?` · espera ${level.cooldown} turno(s)`:''}${skill.description?`\n${skill.description}`:''}${met?'':`\nRequer nível ${need.petLevel}`}`}><SkillIcon id={entry.id}/></button></li>;})}</ul>
    <div className="pets-scroll"><button aria-label="Subir" disabled={offset===0} onClick={()=>setOffset(offset-1)}>▲</button><button aria-label="Descer" disabled={offset>=rows} onClick={()=>setOffset(offset+1)}>▼</button></div>
   </div>
  </div>
  <div className="pets-battle">
   <h3>Habilidades de batalha</h3>
   <div className="pets-ring">
    <i className="pets-ring-center" aria-hidden="true"><Link2 size={26}/></i>
    {PET_CONFIG.skillSlots.slice(0,4).map((rule,i)=>{const id=pet?.equippedSkills[i],open=!!pet&&pet.level>=rule.unlockLevel;
     return <button key={i} className={`pets-ring-slot n${i} ${open?'':'locked'} ${chosen&&open?'target':''}`} disabled={!open||pending} onClick={()=>place(i)} title={!pet?undefined:open?(id?`${petSkill(id)?.name??id}: clique para tirar`:chosen?'Colocar aqui':'Escolha uma habilidade do pet'):`Abre no nível ${rule.unlockLevel}`}>
      {open?(id?<SkillIcon id={id}/>:null):<img src={LOCK} alt="" draggable={false}/>}</button>;})}
   </div>
  </div>
 </div>;
}
