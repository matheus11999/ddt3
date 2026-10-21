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
 const percent=Math.round(view.progress*100);
 return createPortal(<div className={`screen-curtain${view.leaving?' is-leaving':''}`} role="status" aria-live="polite">
  <div className="screen-curtain-glow"/>
  <div className="screen-curtain-title" data-text="BRASA"><span>BRASA</span></div>
  <div className="screen-curtain-subtitle">ARENA</div>
  <div className="screen-curtain-bar"><i style={{width:`${view.reason==='reconnect'&&state.status!=='online'?0:percent}%`}}/>{view.reason==='reconnect'&&state.status!=='online'&&<b className="is-waiting"/>}</div>
  <p>{words}</p>
  {failed&&<button className="button gold" onClick={()=>client.retryNow()}>Tentar novamente</button>}
 </div>,document.body);
}
