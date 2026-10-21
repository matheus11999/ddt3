import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,CircleAlert,LoaderCircle,X} from 'lucide-react';
import {newCharacterEquipment} from '../../shared/catalog';
import type {CharacterGender} from '../../shared/catalog';
import {characterNameError,NAME_MAX} from '../../shared/characterName';
import {client,useGame} from '../client';
import {Avatar} from './Avatar';
import './CharacterCreation.css';

type NameState={status:'idle'|'checking'|'ok'|'bad';message?:string};

/**
 * First visit to a server, in the DDTank layout (pedido do matheus, 21/10): the chosen character big in front on a
 * magic circle, the other one small and dim behind, ♂/♀ buttons that swap them with a flash, the name and Entrar no jogo.
 * The name is checked while typing (shared/characterName.ts, then free on this server); entering unlocks once it passes.
 */
export function CharacterCreation(){
 const [gender,setGender]=useState<CharacterGender>('male'),{creatingCharacter,error}=useGame();
 const [swap,setSwap]=useState(0);
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
 const choose=(next:CharacterGender)=>{if(next===gender||creatingCharacter)return;setGender(next);setSwap(n=>n+1);};
 const other:CharacterGender=gender==='male'?'female':'male';
 const ready=check.status==='ok'&&!creatingCharacter;
 const create=()=>{if(ready)void client.createCharacter(gender,name.trim());};
 return createPortal(<div className="character-creation-backdrop"><section className={`character-creation ${gender}`} aria-labelledby="creation-title">
  <div className="cc-rays" aria-hidden="true"/>
  <h1 id="creation-title" className="cc-title"><span>Escolha de</span><span>personagem</span></h1>
  <div className="cc-stage" aria-hidden="true">
   <div key={`back-${swap}`} className="cc-back"><Avatar equipment={equipment[other]} size={300} weapon={false} animated={false}/></div>
   <div key={`front-${swap}`} className="cc-front">
    <span className="cc-circle"/><span className="cc-flash"/>
    <Avatar equipment={equipment[gender]} size={470} weapon={false} animated={false}/>
   </div>
  </div>
  <div className="cc-panel">
   <div className="cc-genders" role="group" aria-label="Gênero do personagem">
    <button type="button" className="cc-gender male" aria-label="Personagem masculino" aria-pressed={gender==='male'} disabled={creatingCharacter} onClick={()=>choose('male')}><span aria-hidden="true">♂</span></button>
    <button type="button" className="cc-gender female" aria-label="Personagem feminino" aria-pressed={gender==='female'} disabled={creatingCharacter} onClick={()=>choose('female')}><span aria-hidden="true">♀</span></button>
   </div>
   <form className="cc-name" onSubmit={event=>{event.preventDefault();create();}}>
    <label htmlFor="character-name-input">Nome do personagem:</label>
    <div className={`cc-name-box ${check.status}`}>
     <input id="character-name-input" value={name} onChange={event=>setName(event.target.value.slice(0,NAME_MAX))} maxLength={NAME_MAX} autoComplete="off" spellCheck={false} placeholder="Seu nome" disabled={creatingCharacter} aria-describedby="character-name-hint"/>
     {check.status==='checking'&&<LoaderCircle size={17} className="button-spinner"/>}{check.status==='ok'&&<Check size={17}/>}{check.status==='bad'&&<CircleAlert size={17}/>}
     {name&&!creatingCharacter&&<button type="button" className="cc-clear" aria-label="Limpar nome" onClick={()=>setName('')}><X size={14}/></button>}
    </div>
   </form>
   <p id="character-name-hint" className={`cc-hint ${check.status}`} role="status">{check.message??`Use letras, números ou _, de 3 a ${NAME_MAX} caracteres. Gênero e nome não mudam depois.`}</p>
   <button type="button" className="cc-enter" disabled={!ready} onClick={create}>{creatingCharacter?<><LoaderCircle size={20} className="button-spinner"/>Entrando…</>:'Entrar no jogo'}</button>
   {error&&<p className="character-creation-error" role="alert">{error}</p>}
  </div>
 </section></div>,document.body);
}
