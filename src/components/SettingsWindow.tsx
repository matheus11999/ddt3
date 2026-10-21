import {useState} from 'react';
import {Activity,Gauge,Monitor,Swords,TreePine,Volume2,VolumeX} from 'lucide-react';
import {Modal} from './Modal';
import {audio,getEnvironmentAudioEnabled,setEnvironmentAudioEnabled} from '../game/audio';
import {FRAME_LIMITS,frameLimit,nativeResolution} from '../game/frameLimit';
import type {FrameLimit} from '../game/frameLimit';
import {netStatsVisible} from './NetStats';
import './SettingsWindow.css';

export type SettingsTab='graphics'|'sound';

function VolumeRow({icon,label,value,muted,onChange}:{icon:React.ReactNode;label:string;value:number;muted:boolean;onChange:(value:number)=>void}){
 return <label className={`setting-row volume-row ${muted?'muted':''}`}><span>{icon} {label}</span><input type="range" min={0} max={100} step={1} value={value} aria-label={label} style={{'--fill':`${value}%`} as React.CSSProperties}
  onChange={e=>onChange(Number(e.target.value))} onPointerUp={()=>audio.play('click')} onKeyUp={()=>audio.play('click')}/><b>{value}%</b></label>;
}

function Toggle({label,on,onClick}:{label:string;on:boolean;onClick:()=>void}){
 return <button type="button" className={`toggle ${on?'on':''}`} aria-label={label} aria-pressed={on} onClick={onClick}><i/></button>;
}

/** The one Ajustes window, identical from the plaza gear and the gear beside Sair in PvP and expedition battles
 * (matheus, 21/10/2026): tabs Gráfico (resolution, FPS limit, FPS readout) and Som (sound on/off, Som geral for every
 * sound including the menus, Som de batalha for shots, impacts and battle cues, map ambience). No name field. */
export function SettingsWindow({onClose}:{onClose:()=>void}){
 const [tab,setTab]=useState<SettingsTab>('graphics'),[sound,setSound]=useState(audio.enabled),[volume,setVolume]=useState(Math.round(audio.volume*100)),[battle,setBattle]=useState(Math.round(audio.battleVolume*100)),[ambience,setAmbience]=useState(getEnvironmentAudioEnabled()),[fps,setFps]=useState<FrameLimit>(frameLimit.get()),[native,setNative]=useState(nativeResolution.get()),[stats,setStats]=useState(netStatsVisible.get());
 const tabs:[SettingsTab,string][]=[['graphics','Gráfico'],['sound','Som']];
 return <Modal title="Ajustes" onClose={onClose} className="settings-window">
  <nav className="settings-tabs" role="tablist" aria-label="Seções dos ajustes">{tabs.map(([id,label])=><button key={id} type="button" role="tab" id={`settings-tab-${id}`} aria-selected={tab===id} aria-controls={`settings-panel-${id}`} className={tab===id?'on':''} onClick={()=>{setTab(id);audio.play('click');}}>{label}</button>)}</nav>
  {tab==='graphics'?<div role="tabpanel" id="settings-panel-graphics" aria-labelledby="settings-tab-graphics">
   <div className="setting-row"><span><Gauge size={20}/> Limite de FPS</span><div className="fps-limit" role="radiogroup" aria-label="Limite de FPS">{FRAME_LIMITS.map(n=><button key={n} type="button" role="radio" aria-checked={fps===n} className={fps===n?'on':''} onClick={()=>{frameLimit.set(n);setFps(n);}}>{n}</button>)}</div></div>
   <div className="setting-row"><span><Monitor size={20}/> Resolução nativa sempre</span><Toggle label="Resolução nativa sempre" on={native} onClick={()=>{nativeResolution.set(!native);setNative(!native);}}/></div>
   <div className="setting-row"><span><Activity size={20}/> Mostrar FPS e latência</span><Toggle label="Mostrar FPS e latência" on={stats} onClick={()=>{netStatsVisible.set(!stats);setStats(!stats);}}/></div>
   <div className="settings-note">Com a resolução nativa ligada o jogo nunca baixa a nitidez para ganhar FPS. Os ajustes ficam salvos neste navegador.</div>
  </div>:<div role="tabpanel" id="settings-panel-sound" aria-labelledby="settings-tab-sound">
   <div className="setting-row"><span>{sound?<Volume2 size={20}/>:<VolumeX size={20}/>} Som do jogo</span><Toggle label="Som do jogo" on={sound} onClick={()=>{audio.setEnabled(!sound);setSound(!sound);}}/></div>
   <VolumeRow icon={<Volume2 size={20}/>} label="Som geral" value={volume} muted={!sound} onChange={value=>{setVolume(value);audio.setVolume(value/100);}}/>
   <VolumeRow icon={<Swords size={20}/>} label="Som de batalha" value={battle} muted={!sound} onChange={value=>{setBattle(value);audio.setBattleVolume(value/100);}}/>
   <div className={`setting-row ${sound?'':'muted'}`}><span><TreePine size={20}/> Som ambiente dos mapas</span><Toggle label="Som ambiente dos mapas" on={ambience} onClick={()=>{setEnvironmentAudioEnabled(!ambience);setAmbience(!ambience);}}/></div>
   <div className="settings-note">O som geral vale para tudo, inclusive os menus. O som de batalha regula tiros, impactos e avisos da partida dentro do som geral.</div>
  </div>}
 </Modal>;
}
