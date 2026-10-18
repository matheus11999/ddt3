import {SpectatorHud} from './components/SpectatorHud';
import {ExpeditionHall} from './components/ExpeditionHall';
import {Shop} from './components/Shop';
import {IncomingRoomInvites} from './components/IncomingRoomInvites';
import {CharacterCreation} from './components/CharacterCreation';
import {PlayerActions} from './components/PlayerActions';
import {Mailbox} from './components/Mailbox';
import {MobileOrientationGate,useMobileOrientation} from './components/MobileOrientation';
import {createPortal} from 'react-dom';
import './components/Notifications.css';
import {useCallback,useEffect,useLayoutEffect,useState} from 'react';
import {Swords,Settings,Volume2,Check,WifiOff,Flame} from 'lucide-react';
import {client,useGame} from './client';import {Scene} from './game/Scene';import type {LobbyAction} from './game/lobbyWorld';import {audio} from './game/audio';import {Hud} from './components/Hud';import {Inventory} from './components/Inventory';import {Arena,RoomView} from './components/Arena';import {BattleHud} from './components/BattleHud';import {Modal} from './components/Modal';import {Forge} from './components/Forge';import {SMITH_POSITION} from '../shared/catalog';
type Panel='shop'|'inventory'|'arena'|'expeditions'|'forge'|'settings'|'help'|null;
export default function App(){
 const orientation=useMobileOrientation();
 const state=useGame();const [panel,setPanel]=useState<Panel>(null),[scale,setScale]=useState(1),[angle,setAngle]=useState(45),[name,setName]=useState(''),[sound,setSound]=useState(audio.enabled),[headingToForge,setHeadingToForge]=useState(false),[forgeItem,setForgeItem]=useState<string|undefined>();
 useEffect(()=>{client.start();const resize=()=>setScale(Math.min(innerWidth/1536,innerHeight/864));resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 useLayoutEffect(()=>{document.documentElement.classList.toggle('mobile-landscape',orientation.landscape);return()=>document.documentElement.classList.remove('mobile-landscape');},[orientation.landscape]);
 useLayoutEffect(()=>{
  if(!orientation.portrait)return;
  // Cancel held local inputs; the authoritative match timer continues normally.
  window.dispatchEvent(new Event('blur'));window.dispatchEvent(new CustomEvent('brasa-camera-pan',{detail:false}));
  const current=client.state,me=current.players.find(player=>player.id===current.profile?.id);
  if(current.battle?.phase==='aiming'&&current.battle.turnId===current.profile?.id)client.send({type:'aim',angle,power:5,charging:false});
  else if(me&&!current.battle&&!current.room)client.send({type:'move',x:me.x,y:me.y});
  setHeadingToForge(false);
 },[orientation.portrait]);
 // The player info and report windows hold the keyboard like any other window.
 const playerWindow=!!state.playerPanel&&state.playerPanel.kind!=='menu'||state.mailOpen;
 const close=useCallback(()=>{setPanel(null);setHeadingToForge(false);},[]);
 const openArena=useCallback(()=>{if(!client.state.room&&!client.state.battle)setPanel('arena');audio.play('click');},[]);
 const openExpeditions=useCallback(()=>{if(!client.state.room&&!client.state.battle)setPanel('expeditions');audio.play('click');},[]);
 const openInventory=useCallback(()=>{setPanel('inventory');audio.play('click');},[]);
 const openForge=useCallback((item?:string)=>{if(client.state.room){client.update({error:'Volte à rua para visitar o ferreiro.'});return;}setForgeItem(typeof item==='string'?item:undefined);setPanel(null);setHeadingToForge(true);client.send({type:'move',...SMITH_POSITION});audio.play('click');},[]);
 const openShop=useCallback(()=>{setPanel('shop');audio.play('click');},[]);
 const lobbyAction=useCallback((action:LobbyAction)=>{if(action==='arena'||action==='practice')openArena();else if(action==='shop')openShop();else if(action==='storage')openInventory();else openForge();},[openArena,openShop,openInventory,openForge]);
 useEffect(()=>{if(!headingToForge)return;const me=state.players.find(p=>p.id===state.profile?.id);if(me&&Math.hypot(me.x-SMITH_POSITION.x,me.y-SMITH_POSITION.y)<125){setHeadingToForge(false);setPanel('forge');}},[headingToForge,state.players,state.profile?.id]);
 useEffect(()=>{if(state.room)setPanel(v=>v==='arena'||v==='expeditions'?null:v);},[state.room]);
 useEffect(()=>{if(state.battle){setPanel(null);client.closeMail();}},[state.battle?.id]);
 useEffect(()=>{if(state.error){const t=setTimeout(()=>client.update({error:null}),4500);return()=>clearTimeout(t);}},[state.error]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(orientation.portrait||['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName))return;if(e.key==='Escape')setPanel(null);if(e.key.toLowerCase()==='b')setPanel(p=>p==='inventory'?null:'inventory');if(e.key.toLowerCase()==='r'&&!state.battle&&!state.room)setPanel(p=>p==='arena'?null:'arena');if(e.key==='?')setPanel('help');};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[state.battle,state.room,orientation.portrait]);
 return <main className="app-shell"><div className="game-frame" style={{transform:`translate(-50%, -50%) scale(${scale})`,'--game-scale':scale} as React.CSSProperties}><Scene angle={angle} onLobby={lobbyAction} blocked={orientation.portrait||!!panel||playerWindow}/>
  {state.profile?(state.battle?(state.battle.players.some(player=>player.id===state.profile!.id)?<BattleHud angle={angle} setAngle={setAngle} blocked={!!panel||orientation.portrait||playerWindow}/>:<SpectatorHud/>):<>{!state.room&&panel!=='arena'&&panel!=='expeditions'&&<Hud onArena={openArena} onExpeditions={openExpeditions} onInventory={openInventory} onForge={openForge} onShop={openShop} onSettings={()=>{setName(state.profile!.name);setPanel('settings');}}/>}{state.room&&<RoomView onInventory={openInventory}/>}</>):<div className="loading-screen"><div className="loading-emblem"><Flame size={62}/></div><h1>BRASA</h1><span>A aventura está chegando…</span><div className="loading-bar"/></div>}
  {state.needsCharacter&&!state.profile&&<CharacterCreation/>}
  {state.profile&&panel==='shop'&&<Shop onClose={close}/>}
  {state.profile&&state.mailOpen&&!state.battle&&<Mailbox/>}
  {state.profile&&panel==='inventory'&&<Inventory onClose={close} onForge={openForge}/>}{state.profile&&panel==='arena'&&!state.room&&<Arena onClose={close}/>}{state.profile&&panel==='expeditions'&&!state.room&&<ExpeditionHall onClose={close}/>} {state.profile&&panel==='forge'&&<Forge onClose={close} initial={forgeItem}/>}
  {headingToForge&&<div className="destination-label">A caminho do ferreiro…</div>}
  {panel==='settings'&&state.profile&&<Modal title="Ajustes" onClose={close} className="settings-window"><form onSubmit={e=>{e.preventDefault();client.send({type:'rename',name});}}><label>Nome do aventureiro<input value={name} maxLength={24} minLength={2} onChange={e=>setName(e.target.value)} required/></label><button className="button gold" disabled={!!state.room} type="submit"><Check size={16}/> Salvar nome</button></form><div className="setting-row"><span><Volume2 size={20}/> Efeitos sonoros</span><button className={`toggle ${sound?'on':''}`} aria-label="Efeitos sonoros" aria-pressed={sound} onClick={()=>{audio.setEnabled(!sound);setSound(!sound);}}><i/></button></div><div className="settings-note">Seu progresso é salvo neste navegador. Não apague os cookies para manter seu aventureiro.</div></Modal>}
  {panel==='help'&&<Modal title="Boa mira, aventureiro" onClose={close} className="help-window"><div className="help-intro"><Swords size={45}/><p>Ajuste o ângulo, sinta o vento e escolha a força.<br/>Vence a última equipe em pé.</p></div><div className="control-list"><span><kbd>←</kbd><kbd>→</kbd></span><p>Andar e virar · consome vigor</p><span><kbd>↑</kbd><kbd>↓</kbd></span><p>Ajustar o ângulo da arma</p><span><kbd>ESPAÇO</kbd></span><p>Segurar para carregar · soltar para disparar</p><span><kbd>1</kbd> — <kbd>7</kbd></span><p>Usar ferramentas com vigor</p><span><kbd>P</kbd></span><p>Passar o turno</p><span><kbd>B</kbd><kbd>R</kbd></span><p>Mochila · salas da arena</p></div><p className="help-note">Tridente espalha 3 projéteis. +1 e +2 fazem disparos consecutivos. O vento e cada arma mudam a trajetória. Cuidado com o chão!</p><button className="button gold" onClick={()=>{close();if(!state.room&&!state.battle)openArena();}}>Vamos jogar <Swords size={18}/></button></Modal>}
  {state.error&&createPortal(<div className="toast viewport-notice" role="alert">{state.error}<button aria-label="Fechar aviso" onClick={()=>client.update({error:null})}>×</button></div>,document.body)}
  {state.profile&&state.status!=='online'&&createPortal(<div className="connection-notice viewport-notice"><WifiOff size={18}/>{state.status==='replaced'?'Este aventureiro entrou em outra aba.':state.status==='connecting'?'Conectando…':'Conexão perdida. Reconectando…'}{state.status==='replaced'&&<button onClick={()=>location.reload()}>Voltar aqui</button>}</div>,document.body)}
  {!state.profile&&state.status==='offline'&&<button className="button gold retry-button" onClick={()=>client.retryNow()}>Tentar novamente</button>}
 </div><IncomingRoomInvites/><PlayerActions/><MobileOrientationGate visible={orientation.portrait}/></main>;
}
