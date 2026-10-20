import {petSkill,petSkillBlocked,skillLevel} from '../../shared/petSkills';
import type {Fighter} from '../../shared/protocol';
import {client} from '../client';
import './PetSkillBar.css';

/** The active pet's skills in battle: one button per active skill (its Magia is a bar in the console, above Energia). Hidden when there is no pet. */
export function PetSkillBar({fighter,canAct,mode}:{fighter:Fighter;canAct:boolean;mode:'pvp'|'pve'}){
 const pet=fighter.pet;if(!pet)return null;
 const skills=pet.skills.map(slot=>({slot,def:petSkill(slot.id)})).filter(entry=>entry.def?.kind==='active');
 if(!skills.length)return null;
 return <aside className="battle-pet-tray" aria-label="Habilidades do pet">
  {skills.map(({slot,def})=>{const level=skillLevel(def!,slot.level),wait=Math.max(0,slot.readyAt-pet.turns),reason=petSkillBlocked(fighter,slot.id,mode);
   return <button type="button" key={slot.id} className="battle-pet-skill" disabled={!canAct||!!reason} title={`${def!.name}\n${def!.description}${level.cost?`\n${level.cost} de Magia`:''}${reason?`\n${reason}`:''}`} onClick={()=>client.send({type:'pet-skill',skill:slot.id})}>
    {def!.visual?.icon?<img src={def!.visual.icon} alt=""/>:<span>{def!.name.slice(0,2)}</span>}{wait>0&&<b className="battle-pet-wait">{wait}</b>}{level.cost>0&&<small>{level.cost}</small>}
   </button>;})}
 </aside>;
}
