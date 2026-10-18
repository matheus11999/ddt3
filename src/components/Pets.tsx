import {useEffect,useMemo,useState} from 'react';
import {Apple,Lock,LockOpen,PawPrint,Sparkles,Star,Swords,Trash2} from 'lucide-react';
import {PET_CONFIG,PET_STAT_KEYS,PET_STAT_NAMES} from '../../shared/petConfig';
import {petContribution,petLevelProgress,petSnapshot,petSpecies,petStats,petVisual,PET_FOODS,PET_QUALITIES,vitalityFactor} from '../../shared/pets';
import type {PlayerPet} from '../../shared/pets';
import {petSkill,skillLevel} from '../../shared/petSkills';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {Modal} from './Modal';
import './WoodTheme.css';
import './Backpack.css';
import './Pets.css';

type Tab='pets'|'stats'|'food'|'skills'|'evolution';
const TABS:{id:Tab;label:string}[]=[{id:'pets',label:'Meus Pets'},{id:'stats',label:'Atributos'},{id:'food',label:'Alimentação'},{id:'skills',label:'Habilidades'},{id:'evolution',label:'Evolução'}];
const KIND_NAMES={active:'Ativa',passive:'Passiva',permanent:'Permanente',conditional:'Condicional'} as const;

/** Shown wherever a section needs a pet and there is none: no invented creature or numbers. */
function Empty({owned}:{owned:boolean}){
 return <div className="pets-empty wood-cream"><PawPrint size={44}/>{owned?<p>Escolha um pet em <b>Meus Pets</b>.</p>:<><strong>Você ainda não possui pets.</strong><p>Seus futuros companheiros aparecerão aqui.</p></>}</div>;
}
function Bar({value,max,label,tone}:{value:number;max:number;label:string;tone:'xp'|'vitality'}){
 const percent=max>0?Math.max(0,Math.min(100,value/max*100)):100;
 return <div className={`pets-bar ${tone}`} role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}><i style={{width:`${percent}%`}}/><span>{label}</span></div>;
}
/** The pet's painted portrait when its species has one; otherwise a plain paw mark (never a placeholder creature). */
function Portrait({pet,size}:{pet:PlayerPet;size:number}){
 const art=petVisual(pet)?.portrait??petVisual(pet)?.icon;
 return <span className="pets-portrait" style={{width:size,height:size}}>{art?<img src={art} alt="" draggable={false}/>:<PawPrint size={size*.45}/>}</span>;
}

export function Pets(){
 const {pets,petResult,petPending}=useGame();
 const [tab,setTab]=useState<Tab>('pets'),[selected,setSelected]=useState<string|null>(null);
 const list=useMemo(()=>pets?.pets??[],[pets]);
 const pet=list.find(p=>p.id===selected)??null;
 useEffect(()=>{if(selected&&!list.some(p=>p.id===selected))setSelected(null);if(!selected&&list.length)setSelected((list.find(p=>p.equipped)??list[0]).id);},[list,selected]);
 const close=()=>client.closePets();
 const owned=list.length>0;
 return <Modal title="Pets" onClose={close} className="bag-window pets-window" viewport>
  <nav className="pets-tabs" role="tablist" aria-label="Seções dos pets">{TABS.map(t=><button key={t.id} role="tab" aria-selected={tab===t.id} className={tab===t.id?'active':''} onClick={()=>{setTab(t.id);audio.play('click');}}>{t.label}</button>)}</nav>
  <div className="pets-layout">
   <PetList list={list} capacity={pets?.capacity??PET_CONFIG.maxOwned} loaded={!!pets} selected={selected} onSelect={id=>{setSelected(id);audio.play('click');}}/>
   <section className="pets-main" aria-live="polite">
    {!pets?<div className="pets-empty wood-cream"><PawPrint size={36}/><p>Chamando seus pets…</p></div>
     :!pet?<Empty owned={owned}/>
     :tab==='pets'?<PetCard pet={pet} pending={petPending}/>
     :tab==='stats'?<PetAttributes pet={pet}/>
     :tab==='food'?<PetFood pet={pet} food={pets.food} pending={petPending}/>
     :tab==='skills'?<PetSkills pet={pet} pending={petPending}/>
     :<PetEvolution pet={pet}/>}
   </section>
  </div>
  {petResult&&<p className="pets-feedback" role="status">{petResult.result.message}</p>}
 </Modal>;
}
function PetList({list,capacity,loaded,selected,onSelect}:{list:PlayerPet[];capacity:number;loaded:boolean;selected:string|null;onSelect:(id:string)=>void}){
 return <aside className="pets-list wood-pane" aria-label="Meus pets">
  <header><strong>Meus Pets</strong><small>{list.length}/{capacity}</small></header>
  <ul className="pets-grid wood-cream">{list.map(p=><li key={p.id}><button className={`pets-slot ${p.id===selected?'selected':''} ${p.equipped?'equipped':''}`} title={p.name} onClick={()=>onSelect(p.id)}><Portrait pet={p} size={46}/><small>{p.name}</small><b>Nv. {p.level}</b>{p.locked&&<Lock className="pets-slot-lock" size={12}/>}</button></li>)}
   {loaded&&!list.length&&<li className="pets-grid-empty">Nenhum pet ainda.</li>}</ul>
 </aside>;
}
function PetCard({pet,pending}:{pet:PlayerPet;pending:boolean}){
 const [name,setName]=useState(pet.name),[releasing,setReleasing]=useState(''),[confirm,setConfirm]=useState(false);
 useEffect(()=>{setName(pet.name);setConfirm(false);setReleasing('');},[pet.id,pet.name]);
 const species=petSpecies(pet.species),progress=petLevelProgress(pet);
 return <div className="pets-card wood-cream">
  <div className="pets-hero"><Portrait pet={pet} size={110}/><div><h2>{pet.name}</h2><p>{species?.name??'Espécie indisponível'} · {PET_QUALITIES.get(pet.quality)?.name??pet.quality}</p><p className="pets-stars" aria-label={`${pet.stars} estrelas`}>{Array.from({length:species?.maxStars??0},(_,i)=><Star key={i} size={15} className={i<pet.stars?'on':''}/>)}</p></div></div>
  <Bar tone="xp" value={progress.current} max={progress.required} label={progress.capped?`Nível ${pet.level} · máximo`:`Nível ${pet.level} · EXP ${progress.current} / ${progress.required}`}/>
  <Bar tone="vitality" value={pet.vitality} max={PET_CONFIG.vitality.max} label={`Vitalidade ${pet.vitality} / ${PET_CONFIG.vitality.max}`}/>
  <div className="pets-actions">
   {pet.equipped?<button className="wood-button" disabled={pending} onClick={()=>client.petAction({type:'pet-unequip',pet:pet.id})}>Desequipar</button>
    :<button className="wood-button gold" disabled={pending||!species} onClick={()=>client.petAction({type:'pet-equip',pet:pet.id})}>Equipar</button>}
   <button className="wood-quiet" disabled={pending} onClick={()=>client.petAction({type:'pet-lock',pet:pet.id,locked:!pet.locked})}>{pet.locked?<><LockOpen size={15}/>Desproteger</>:<><Lock size={15}/>Proteger</>}</button>
  </div>
  <form className="pets-rename" onSubmit={e=>{e.preventDefault();if(name.trim()&&name.trim()!==pet.name)client.petAction({type:'pet-rename',pet:pet.id,name:name.trim()});}}>
   <label>Nome<input value={name} minLength={PET_CONFIG.nameLength.min} maxLength={PET_CONFIG.nameLength.max} onChange={e=>setName(e.target.value)}/></label><button className="wood-quiet" disabled={pending||name.trim()===pet.name}>Renomear</button>
  </form>
  {!confirm?<button className="pets-release" disabled={pending||pet.locked||pet.equipped} title={pet.locked?'Pet protegido':pet.equipped?'Desequipe primeiro':'Liberar pet'} onClick={()=>setConfirm(true)}><Trash2 size={14}/>Liberar pet</button>
   :<form className="pets-release-confirm" onSubmit={e=>{e.preventDefault();client.petAction({type:'pet-release',pet:pet.id,confirm:true,name:releasing});}}>
    <p>Liberar é para sempre. Digite <b>{pet.name}</b> para confirmar.</p><input value={releasing} onChange={e=>setReleasing(e.target.value)} aria-label="Nome do pet"/>
    <button className="wood-button" disabled={pending||releasing.trim()!==pet.name}>Liberar</button><button type="button" className="wood-quiet" onClick={()=>setConfirm(false)}>Cancelar</button>
   </form>}
 </div>;
}
function PetAttributes({pet}:{pet:PlayerPet}){
 const own=petStats(pet),bonus=petContribution(petSnapshot(pet)),factor=vitalityFactor(pet.vitality),progress=petLevelProgress(pet);
 return <div className="pets-card wood-cream">
  <Bar tone="xp" value={progress.current} max={progress.required} label={progress.capped?`Nível ${pet.level} · máximo`:`Nível ${pet.level} · EXP ${progress.current} / ${progress.required}`}/>
  <Bar tone="vitality" value={pet.vitality} max={PET_CONFIG.vitality.max} label={`Vitalidade ${pet.vitality} / ${PET_CONFIG.vitality.max} · bônus ${Math.round(factor*100)}%`}/>
  <table className="pets-stats"><thead><tr><th>Atributo</th><th>Do pet</th><th>Para você</th></tr></thead>
   <tbody>{PET_STAT_KEYS.map(key=><tr key={key}><th>{PET_STAT_NAMES[key]}</th><td>{own[key].toLocaleString('pt-BR')}</td><td className={bonus[key]?'up':''}>{bonus[key]?`+${bonus[key]!.toLocaleString('pt-BR')}`:'—'}</td></tr>)}</tbody></table>
  <small className="pets-note">{pet.equipped?'Os bônus já estão no seu poder de combate.':'Equipe o pet para somar estes bônus.'}</small>
 </div>;
}
function PetFood({pet,food,pending}:{pet:PlayerPet;food:Record<string,number>;pending:boolean}){
 const options=Object.entries(food).filter(([id,n])=>n>0&&PET_FOODS.has(id)),[choice,setChoice]=useState<string|null>(null),[quantity,setQuantity]=useState(1);
 const item=choice?PET_FOODS.get(choice):undefined,max=Math.min(item?.maxPerUse??1,food[choice??'']??0);
 const gain=item?Math.min(PET_CONFIG.vitality.max-pet.vitality,item.vitality*quantity):0;
 useEffect(()=>{if(choice&&!options.some(([id])=>id===choice))setChoice(null);},[options,choice]);
 return <div className="pets-card wood-cream">
  <Bar tone="vitality" value={pet.vitality} max={PET_CONFIG.vitality.max} label={`Vitalidade ${pet.vitality} / ${PET_CONFIG.vitality.max}`}/>
  {pet.vitality<=0&&<p className="pets-warning">Sem vitalidade: {pet.name} não luta nem dá bônus até ser alimentado.</p>}
  <h3><Apple size={16}/>Alimentos</h3>
  {options.length?<ul className="pets-food">{options.map(([id,n])=>{const f=PET_FOODS.get(id)!;return <li key={id}><button className={choice===id?'selected':''} onClick={()=>{setChoice(id);setQuantity(1);}}>{f.icon?<img src={f.icon} alt=""/>:<Apple size={22}/>}<span>{f.name}</span><b>×{n}</b></button></li>;})}</ul>
   :<p className="pets-note">Você não tem alimentos para pets.</p>}
  {item&&<div className="pets-feed-row"><label>Quantidade<input type="number" min={1} max={max} value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(max,Math.floor(Number(e.target.value)||1))))}/></label>
   <span>+{gain} de vitalidade{item.xp?` · +${item.xp*quantity} EXP`:''}</span>
   <button className="wood-button gold" disabled={pending} onClick={()=>client.petAction({type:'pet-feed',pet:pet.id,food:item.id,quantity})}>Alimentar</button></div>}
 </div>;
}
function PetSkills({pet,pending}:{pet:PlayerPet;pending:boolean}){
 const [slot,setSlot]=useState(0);
 return <div className="pets-card wood-cream">
  <h3><Sparkles size={16}/>Espaços</h3>
  <ol className="pets-skill-slots">{PET_CONFIG.skillSlots.map((rule,i)=>{const id=pet.equippedSkills[i],skill=id?petSkill(id):undefined,open=pet.level>=rule.unlockLevel;
   return <li key={i}><button className={`${slot===i?'selected':''} ${open?'':'locked'}`} disabled={!open} onClick={()=>setSlot(i)} title={open?'Escolha uma habilidade aprendida':`Abre no nível ${rule.unlockLevel}`}>{open?(skill?skill.name:'Vazio'):<><Lock size={13}/>Nv. {rule.unlockLevel}</>}</button>
    {open&&id&&<button className="pets-skill-remove" aria-label="Tirar habilidade" disabled={pending} onClick={()=>client.petAction({type:'pet-skill-slot',pet:pet.id,slot:i,skill:null})}>×</button>}</li>;})}</ol>
  <h3><Swords size={16}/>Aprendidas</h3>
  {pet.knownSkills.length?<ul className="pets-skills">{pet.knownSkills.map(entry=>{const skill=petSkill(entry.id);if(!skill)return null;const level=skillLevel(skill,entry.level),equipped=pet.equippedSkills.includes(entry.id),need=skill.requirements,met=pet.level>=need.petLevel&&pet.stage>=need.stage&&pet.stars>=need.stars;
   return <li key={entry.id} className={met?'':'unmet'}><div><strong>{skill.name}</strong><small>{KIND_NAMES[skill.kind]} · Nv. {entry.level}{level.cost?` · ${level.cost} de Magia`:''}{level.cooldown?` · espera ${level.cooldown} turno(s)`:''}{level.chance<1?` · ${Math.round(level.chance*100)}%`:''}</small><p>{skill.description}</p>{!met&&<small>Requer nível {need.petLevel}{need.stage?`, estágio ${need.stage}`:''}{need.stars?`, ${need.stars} estrelas`:''}</small>}</div>
    <button className="wood-quiet" disabled={pending||!met||equipped&&pet.equippedSkills[slot]===entry.id} onClick={()=>client.petAction({type:'pet-skill-slot',pet:pet.id,slot,skill:entry.id})}>{equipped?'Mover':'Equipar'}</button></li>;})}</ul>
   :<p className="pets-note">{pet.name} ainda não aprendeu habilidades.</p>}
 </div>;
}
function PetEvolution({pet}:{pet:PlayerPet}){
 const species=petSpecies(pet.species),progress=petLevelProgress(pet),stage=species?.stages[pet.stage];
 return <div className="pets-card wood-cream">
  <Bar tone="xp" value={progress.current} max={progress.required} label={progress.capped?`Nível ${pet.level} · máximo`:`Nível ${pet.level} · EXP ${progress.current} / ${progress.required}`}/>
  <dl className="pets-evolution"><div><dt>Qualidade</dt><dd>{PET_QUALITIES.get(pet.quality)?.name??pet.quality}</dd></div><div><dt>Estrelas</dt><dd>{pet.stars} / {species?.maxStars??0}</dd></div><div><dt>Estágio</dt><dd>{stage?.name??pet.stage}</dd></div></dl>
  <div className="pets-future">{['Evoluir estágio','Subir estrela','Equipamentos do pet'].map(label=><button key={label} className="wood-quiet" disabled title="Em breve">{label}</button>)}</div>
  <small className="pets-note">Evolução e equipamentos de pet chegam em breve.</small>
 </div>;
}
