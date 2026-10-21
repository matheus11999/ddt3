import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,CircleAlert,LoaderCircle,X} from 'lucide-react';
import {newCharacterEquipment} from '../../shared/catalog';
import type {CharacterGender} from '../../shared/catalog';
import {characterNameError,NAME_MAX} from '../../shared/characterName';
import {client,useGame} from '../client';
import {Avatar} from './Avatar';
import './WoodTheme.css';
import './CharacterCreation.css';

type NameState={status:'idle'|'checking'|'ok'|'bad';message?:string};

/**
 * First visit to a server (pedido do matheus, 21/10), DDTank layout in the game's own look: a painted Praça Celeste scene
 * where the chosen character stands big on the summoning pedestal and the other one small behind, and a wood window with
 * ♂/♀, the name and Entrar no jogo. Switching gender swaps them with a flash.
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
 return createPortal(<div className={`character-creation-backdrop ${gender}`}><section className={`character-creation ${gender}`} aria-labelledby="creation-title">
  <div className="cc-world" aria-hidden="true">
  <div className="cc-scene"/>
  <div className="cc-sparks">{Array.from({length:18},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div>
  <div className="cc-stage">
   <div key={`back-${swap}`} className="cc-back"><Avatar equipment={equipment[other]} size={300} weapon={false} animated={false}/></div>
   <div key={`front-${swap}`} className="cc-front">
    <span className="cc-beam"/><span className="cc-flash"/>
    <Avatar equipment={equipment[gender]} size={470} weapon={false} animated={false}/>
   </div>
  </div>
  </div>
  <h1 id="creation-title" className="cc-title">Escolha de personagem</h1>
  <div className="cc-panel wood-window">
   <div className="cc-panel-bar wood-titlebar"><h2 className="wood-title">Seu aventureiro</h2></div>
   <div className="cc-panel-body wood-cream">
    <div className="cc-genders" role="group" aria-label="Gênero do personagem">
     <button type="button" className="cc-gender male" aria-label="Personagem masculino" aria-pressed={gender==='male'} disabled={creatingCharacter} onClick={()=>choose('male')}><span className="cc-symbol" aria-hidden="true">♂</span><span>Masculino</span></button>
     <button type="button" className="cc-gender female" aria-label="Personagem feminino" aria-pressed={gender==='female'} disabled={creatingCharacter} onClick={()=>choose('female')}><span className="cc-symbol" aria-hidden="true">♀</span><span>Feminino</span></button>
    </div>
    <form className="cc-name" onSubmit={event=>{event.preventDefault();create();}}>
     <label htmlFor="character-name-input">Nome do personagem</label>
     <div className={`cc-name-box ${check.status}`}>
      <input id="character-name-input" value={name} onChange={event=>setName(event.target.value.slice(0,NAME_MAX))} maxLength={NAME_MAX} autoComplete="off" spellCheck={false} placeholder="Digite seu nome" disabled={creatingCharacter} aria-describedby="character-name-hint"/>
      {check.status==='checking'&&<LoaderCircle size={18} className="button-spinner"/>}{check.status==='ok'&&<Check size={18}/>}{check.status==='bad'&&<CircleAlert size={18}/>}
      {name&&!creatingCharacter&&<button type="button" className="cc-clear" aria-label="Limpar nome" onClick={()=>setName('')}><X size={14}/></button>}
     </div>
    </form>
    <p id="character-name-hint" className={`cc-hint ${check.status}`} role="status">{check.message??`Letras, números ou _, de 3 a ${NAME_MAX} caracteres. Gênero e nome não mudam depois.`}</p>
    <button type="button" className="cc-enter wood-button" disabled={!ready} onClick={create}>{creatingCharacter?<><LoaderCircle size={22} className="button-spinner"/>Entrando…</>:'Entrar no jogo'}</button>
   </div>
   {error&&<p className="character-creation-error" role="alert">{error}</p>}
  </div>
 </section></div>,document.body);
}
