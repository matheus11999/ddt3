import {useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowRight,Check,LoaderCircle,LockKeyhole} from 'lucide-react';
import {starterEquipment} from '../../shared/catalog';
import type {CharacterGender} from '../../shared/catalog';
import {client,useGame} from '../client';
import {Avatar} from './Avatar';
import './CharacterCreation.css';

export function CharacterCreation(){
 const [gender,setGender]=useState<CharacterGender>('male'),{creatingCharacter,error}=useGame();
 const equipment=useMemo(()=>({male:starterEquipment('male'),female:starterEquipment('female')}),[]);
 return createPortal(<div className="character-creation-backdrop"><section className="character-creation" aria-labelledby="creation-title">
  <header><span>BRASA ARENA</span><h1 id="creation-title">Escolha seu personagem</h1></header>
  <div className="character-choice-list" role="group" aria-label="Gênero do personagem">{([{id:'male',label:'Masculino'},{id:'female',label:'Feminino'}] as const).map(option=><button type="button" key={option.id} aria-label={`Personagem ${option.label.toLocaleLowerCase()}`} aria-pressed={gender===option.id} disabled={creatingCharacter} className={`character-choice ${option.id}`} onClick={()=>setGender(option.id)}>
   <Avatar equipment={equipment[option.id]} size={300} weapon={false} animated={false}/><span className="character-choice-name">{option.label}{gender===option.id&&<Check size={19}/>}</span>
  </button>)}</div>
  <footer><p><LockKeyhole size={15}/>Esta escolha é permanente.</p><button type="button" className="button gold" disabled={creatingCharacter} onClick={()=>void client.createCharacter(gender)}>{creatingCharacter?<><LoaderCircle size={19} className="button-spinner"/>Criando…</>:<>Criar personagem<ArrowRight size={19}/></>}</button></footer>
  {error&&<p className="character-creation-error" role="alert">{error}</p>}
 </section></div>,document.body);
}
