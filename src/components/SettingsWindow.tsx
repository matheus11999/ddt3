import {useState} from 'react';
import {Check,Gauge,Monitor,Volume2,VolumeX} from 'lucide-react';
import {Modal} from './Modal';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {FRAME_LIMITS,frameLimit,nativeResolution} from '../game/frameLimit';
import type {FrameLimit} from '../game/frameLimit';
import './SettingsWindow.css';

export type SettingsTab='general'|'sound';

/** Ajustes window shared by the plaza gear and the gear beside Sair in PvP and expedition battles (matheus, 21/10/2026).
 * Tabs Geral (name, resolution, FPS) and Som (game sound on/off and the overall volume slider, 40% by default). */
export function SettingsWindow({onClose,tab:initial='general',onSoundChange}:{onClose:()=>void;tab?:SettingsTab;onSoundChange?:(on:boolean)=>void}){
 const state=useGame();
 const [tab,setTab]=useState<SettingsTab>(initial),[name,setName]=useState(state.profile?.name??''),[sound,setSound]=useState(audio.enabled),[volume,setVolume]=useState(Math.round(audio.volume*100)),[fps,setFps]=useState<FrameLimit>(frameLimit.get()),[native,setNative]=useState(nativeResolution.get());
 const toggleSound=()=>{audio.setEnabled(!sound);setSound(!sound);onSoundChange?.(!sound);};
 const tabs:[SettingsTab,string][]=[['general','Geral'],['sound','Som']];
 return <Modal title="Ajustes" onClose={onClose} className="settings-window">
  <nav className="settings-tabs" role="tablist" aria-label="Seções dos ajustes">{tabs.map(([id,label])=><button key={id} type="button" role="tab" id={`settings-tab-${id}`} aria-selected={tab===id} aria-controls={`settings-panel-${id}`} className={tab===id?'on':''} onClick={()=>{setTab(id);audio.play('click');}}>{label}</button>)}</nav>
  {tab==='general'?<div role="tabpanel" id="settings-panel-general" aria-labelledby="settings-tab-general">
   {!state.battle&&<form onSubmit={e=>{e.preventDefault();client.send({type:'rename',name});}}><label>Nome do aventureiro<input value={name} maxLength={24} minLength={2} onChange={e=>setName(e.target.value)} required/></label><button className="button gold" disabled={!!state.room} type="submit"><Check size={16}/> Salvar nome</button></form>}
   <div className="setting-row"><span><Monitor size={20}/> Resolução nativa sempre</span><button className={`toggle ${native?'on':''}`} aria-label="Resolução nativa sempre" aria-pressed={native} onClick={()=>{nativeResolution.set(!native);setNative(!native);}}><i/></button></div>
   <div className="setting-row"><span><Gauge size={20}/> Limite de FPS</span><div className="fps-limit" role="radiogroup" aria-label="Limite de FPS">{FRAME_LIMITS.map(n=><button key={n} type="button" role="radio" aria-checked={fps===n} className={fps===n?'on':''} onClick={()=>{frameLimit.set(n);setFps(n);}}>{n}</button>)}</div></div>
   <div className="settings-note">Seu progresso é salvo neste navegador. Não apague os cookies para manter seu aventureiro.</div>
  </div>:<div role="tabpanel" id="settings-panel-sound" aria-labelledby="settings-tab-sound">
   <div className="setting-row"><span>{sound?<Volume2 size={20}/>:<VolumeX size={20}/>} Som do jogo</span><button className={`toggle ${sound?'on':''}`} aria-label="Som do jogo" aria-pressed={sound} onClick={toggleSound}><i/></button></div>
   <label className={`setting-row volume-row ${sound?'':'muted'}`}><span><Volume2 size={20}/> Volume</span><input type="range" min={0} max={100} step={1} value={volume} aria-label="Volume do jogo" style={{'--fill':`${volume}%`} as React.CSSProperties}
    onChange={e=>{const value=Number(e.target.value);setVolume(value);audio.setVolume(value/100);}}
    onPointerUp={()=>audio.play('click')} onKeyUp={()=>audio.play('click')}/><b>{volume}%</b></label>
   <div className="settings-note">O volume vale para todos os sons do jogo e fica salvo neste navegador.</div>
  </div>}
 </Modal>;
}
