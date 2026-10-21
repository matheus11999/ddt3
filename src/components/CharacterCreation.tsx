import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowRight,Check,CircleAlert,LoaderCircle,LockKeyhole} from 'lucide-react';
import {newCharacterEquipment} from '../../shared/catalog';
import type {CharacterGender} from '../../shared/catalog';
import {characterNameError,NAME_MAX} from '../../shared/characterName';
import {client,useGame} from '../client';
import {Avatar} from './Avatar';
import './CharacterCreation.css';

type NameState={status:'idle'|'checking'|'ok'|'bad';message?:string};

/**
 * First visit to a server (pedido do matheus, 21/10): choose male or female and a name. The name is checked while
 * typing (rules from shared/characterName.ts, then free on this server) and creation only unlocks once it passes.
 */
export function CharacterCreation(){
 const [gender,setGender]=useState<CharacterGender>('male'),{creatingCharacter,error}=useGame();
 const [name,setName]=useState(''),[check,setCheck]=useState<NameState>({status:'idle'});
 const equipment=useMemo(()=>({male:newCharacterEquipment('male'),female:newCharacterEquipment('female')}),[]);
 useEffect(()=>{
  const trimmed=name.trim();
  if(!trimmed){setCheck({status:'idle'});return;}
  const invalid=characterNameError(trimmed);
  if(invalid){setCheck({status:'bad',message:invalid});return;}
  setCheck({status:'checking'});let alive=true;
  const timer=window.setTimeout(()=>{client.checkCharacterName(trimmed).then(r=>{if(alive)setCheck(r.ok?{status:'ok',message:'Nome disponível!'}:{status:'bad',message:r.error});},()=>{if(alive)setCheck({status:'bad',message:'Não deu para conferir o nome agora.'});});},400);
  return ()=>{alive=false;clearTimeout(timer);};
 },[name]);
 const ready=check.status==='ok'&&!creatingCharacter;
 const create=()=>{if(ready)void client.createCharacter(gender,name.trim());};
 return createPortal(<div className="character-creation-backdrop"><section className="character-creation" aria-labelledby="creation-title">
  <header><span>BOMB MASTERS</span><h1 id="creation-title">Crie seu personagem</h1></header>
  <div className="character-choice-list" role="group" aria-label="Gênero do personagem">{([{id:'male',label:'Masculino'},{id:'female',label:'Feminino'}] as const).map(option=><button type="button" key={option.id} aria-label={`Personagem ${option.label.toLocaleLowerCase()}`} aria-pressed={gender===option.id} disabled={creatingCharacter} className={`character-choice ${option.id}`} onClick={()=>setGender(option.id)}>
   <Avatar equipment={equipment[option.id]} size={260} weapon={false} animated={false}/><span className="character-choice-name">{option.label}{gender===option.id&&<Check size={19}/>}</span>
  </button>)}</div>
  <form className="character-name" onSubmit={event=>{event.preventDefault();create();}}>
   <label htmlFor="character-name-input">Nome do personagem</label>
   <div className={`character-name-box ${check.status}`}>
    <input id="character-name-input" value={name} onChange={event=>setName(event.target.value.slice(0,NAME_MAX))} maxLength={NAME_MAX} autoComplete="off" spellCheck={false} placeholder="Como vão te chamar na arena?" disabled={creatingCharacter} aria-describedby="character-name-hint"/>
    {check.status==='checking'&&<LoaderCircle size={18} className="button-spinner"/>}{check.status==='ok'&&<Check size={18}/>}{check.status==='bad'&&<CircleAlert size={18}/>}
   </div>
   <p id="character-name-hint" className={`character-name-hint ${check.status}`} role="status">{check.message??'3 a 16 letras, números ou _. O nome não pode ser trocado depois.'}</p>
  </form>
  <footer><p><LockKeyhole size={15}/>Gênero e nome são permanentes.</p><button type="button" className="button gold" disabled={!ready} onClick={create}>{creatingCharacter?<><LoaderCircle size={19} className="button-spinner"/>Criando…</>:<>Criar personagem<ArrowRight size={19}/></>}</button></footer>
  {error&&<p className="character-creation-error" role="alert">{error}</p>}
 </section></div>,document.body);
}
