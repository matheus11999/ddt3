import {useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {client,useGame} from '../client';
import {curtain} from '../screenCurtain';
import type {CurtainReason} from '../screenCurtain';
import './ScreenCurtain.css';

const WORDS:Record<CurtainReason,string>={boot:'Preparando a praça…',resume:'Voltando ao jogo…',reconnect:'Conexão perdida. Reconectando…',zone:'Voltando à Praça Celeste…'};

/** The full-screen loading cover (see `screenCurtain.ts`): the game shows nothing half-loaded behind it. */
export function ScreenCurtain(){
 const view=useSyncExternalStore(curtain.subscribe,curtain.snapshot),state=useGame();
 if(!view.reason)return null;
 const failed=view.reason==='boot'&&!state.profile&&state.status==='offline';
 const words=failed?state.error??'Não foi possível entrar.':state.profile&&state.status==='connecting'&&view.reason==='boot'?'Conectando…':view.reason==='zone'&&view.to==='fishing'?'Indo para a Pescaria…':WORDS[view.reason];
 const percent=Math.round(view.progress*100),waiting=view.reason==='reconnect'&&state.status!=='online';
 return createPortal(<div className={`screen-curtain${view.leaving?' is-leaving':''}`} role="status" aria-live="polite">
  <div className="screen-curtain-art"/>
  <div className="screen-curtain-shade"/>
  <img className="screen-curtain-logo" src="/assets/ui/loading/logo.webp" alt="Bomb Masters" width="900" height="534" draggable={false}/>
  <div className={`screen-curtain-bar${waiting?' is-waiting':''}`}>
   <div className="screen-curtain-track"><i style={{width:`${waiting?0:percent}%`}}/>{waiting&&<b/>}</div>
   {!waiting&&<img className="screen-curtain-spark" src="/assets/ui/loading/spark.png" alt="" style={{left:`calc(4px + (100% - 8px) * ${percent/100})`}} draggable={false}/>}
  </div>
  <p>{words}{!waiting&&!failed&&<span>{percent}%</span>}</p>
  {failed&&<button className="button gold" onClick={()=>client.retryNow()}>Tentar novamente</button>}
 </div>,document.body);
}
