import {RewardIcon} from './RewardIcon';
import {useEffect,useRef,useState} from 'react';
import {Gem,Send,MapPin,Volume2,VolumeX,Settings,Expand,ChevronDown,Check,X} from 'lucide-react';
import {PowerIcon} from './PowerIcon';
import {LevelBadge} from './LevelBadge';
import {levelProgress} from '../../shared/progression';
import {attributes} from '../../shared/catalog';import {client,useGame} from '../client';import {Avatar} from './Avatar';import {audio} from '../game/audio';
import {playerMenuProps} from './PlayerActions';
import './WoodTheme.css';
import './Hud.css';
type LobbyMenu='quests'|'guild';
const LOBBY_MENU_NAMES:Record<LobbyMenu,string>={quests:'Missões',guild:'Guilda'};
export function Hud({onArena,onExpeditions,onInventory,onForge,onShop,onSettings}:{onArena:()=>void;onExpeditions:()=>void;onInventory:()=>void;onForge:()=>void;onShop:()=>void;onSettings:()=>void}){
 const {profile,channel,room,mailUnread}=useGame();const p=profile!;const stats=attributes(p.equipment,p.level),progress=levelProgress(p.level,p.xp);const [sound,setSound]=useState(audio.enabled);const [chatOpen,setChatOpen]=useState(true);
 const pendingQuests=Number(!p.equippedOnce)+Number(!p.matches);const [menu,setMenu]=useState<LobbyMenu|null>(null);const dock=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!menu)return;
  const dismiss=(event:PointerEvent)=>{if(event.target instanceof Node&&!dock.current?.contains(event.target))setMenu(null);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenu(null);};
  document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);};
 },[menu]);
 const toggle=(id:LobbyMenu)=>{setMenu(value=>value===id?null:id);audio.play('click');};
 // Painted icons in the PvP room menu style (prompts in docs/lobby-art-prompts.md).
 const buttons:{id:string;label:string;art:string;count?:number;action:()=>void;disabled?:boolean;pressed?:boolean}[]=[
  {id:'arena',label:'Arena',art:'arena-button.png',action:onArena},
  {id:'expeditions',label:'Expedições',art:'expedition-button.png',action:onExpeditions},
  {id:'bag',label:'Mochila',art:'backpack-button.png',action:onInventory},
  {id:'shop',label:'Loja',art:'shop-button.png',action:onShop},
  {id:'forge',label:'Ferreiro',art:'forge-button.png',action:onForge,disabled:!!room},
  {id:'quests',label:'Missões',art:'arena-quests.png',count:pendingQuests,action:()=>toggle('quests'),pressed:menu==='quests'},
  {id:'mail',label:'Correio',art:'arena-mail.png',count:mailUnread,action:()=>{setMenu(null);client.openMail();audio.play('click');}},
  {id:'guild',label:'Guilda',art:'arena-guild.png',action:()=>toggle('guild'),pressed:menu==='guild'},
  {id:'settings',label:'Ajustes',art:'settings-button.png',action:onSettings},
 ];
 return <><div className="top-vignette"/><button className="player-hud" onClick={onInventory} title="Abrir mochila"><div className="portrait"><div className="portrait-crop"><Avatar equipment={p.equipment} size={87} portrait animated={false} weapon={false}/></div><div className="profile-level-badge"><LevelBadge level={p.level} size={40}/></div></div><div className="profile-lines"><div className="profile-name"><strong>{p.name}</strong><small>AVENTUREIRO</small></div><div className="resource-bar health"><i/><span><b>HP</b>{stats.hp} / {stats.hp}</span></div><div className="resource-bar stamina"><i/><span><b>VIGOR</b>{stats.stamina} / {stats.stamina}</span></div><div className="profile-power" title="Poder do jogador"><PowerIcon size={24}/> {stats.power.toLocaleString('pt-BR')}</div></div></button>
  <div className="channel-chip"><MapPin size={13}/> Praça Celeste <i/> Canal {String(channel).padStart(2,'0')}</div>
  <div className="top-right"><div className="currency"><RewardIcon size={20}/><b>{p.gold.toLocaleString('pt-BR')}</b><span className="currency-divider"/><Gem size={18}/><b>0</b></div><button className="round-button" aria-label={sound?'Desativar som':'Ativar som'} onClick={()=>{audio.setEnabled(!sound);setSound(!sound);}}>{sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button><button className="round-button" aria-label="Tela cheia" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen().catch(()=>{});}}><Expand size={18}/></button><button className="round-button" aria-label="Configurações" onClick={onSettings}><Settings size={19}/></button></div>
  <div className={`chat-shell lobby-chat wood-pane wood-chat ${chatOpen?'':'collapsed'}`}><button className="chat-collapse" aria-label={chatOpen?'Minimizar chat':'Abrir chat'} onClick={()=>setChatOpen(!chatOpen)}><ChevronDown size={15}/></button><Chat/></div>
  <nav ref={dock} className="bottom-dock lobby-dock" aria-label="Menus da praça">{buttons.map(button=><button key={button.id} className={`lobby-dock-button ${button.id} ${button.pressed?'active':''}`} aria-label={button.label} title={button.label} aria-expanded={button.pressed===undefined?undefined:button.pressed} disabled={button.disabled} onClick={button.action}><span className="lobby-dock-tile"><img src={`/assets/ui/${button.art}`} alt="" draggable={false}/>{button.count?<b className="lobby-dock-count">{button.count}</b>:null}</span><span className="lobby-dock-label">{button.label}</span></button>)}
   {menu&&<section className="lobby-dock-popover" role="dialog" aria-label={LOBBY_MENU_NAMES[menu]}><header><strong>{LOBBY_MENU_NAMES[menu]}</strong><button type="button" aria-label={`Fechar ${LOBBY_MENU_NAMES[menu]}`} onClick={()=>setMenu(null)}><X size={17}/></button></header>{menu==='quests'?<div className="lobby-quest-list"><button type="button" onClick={()=>{setMenu(null);onInventory();}}><span className={p.equippedOnce?'done':''}>{p.equippedOnce?<Check size={15}/>:'1'}</span><div><strong>Vista sua aventura</strong><small>Equipe um item na mochila</small></div></button><button type="button" onClick={()=>{setMenu(null);onArena();}}><span className={p.matches?'done':''}>{p.matches?<Check size={15}/>:'2'}</span><div><strong>Entre na arena</strong><small>Conclua sua primeira batalha</small></div></button></div>:<p>Em breve</p>}</section>}
  </nav>
  <div className="xp-bottom"><div style={{width:`${progress.percent}%`}}/><span>{progress.capped?`NÍVEL ${p.level} · MÁXIMO`:`EXP ${progress.current} / ${progress.required}`}</span></div>
 </>;
}
export function Chat(){const {chat,room}=useGame();const [text,setText]=useState(''),[channel,setChannel]=useState<'world'|'room'>('world');const end=useRef<HTMLDivElement>(null);useEffect(()=>{const list=end.current?.parentElement;if(list)list.scrollTop=list.scrollHeight;},[chat]);useEffect(()=>{setChannel(room?'room':'world');},[room?.id]);
 return <><div className="chat-tabs"><button className={channel==='world'?'active':''} onClick={()=>setChannel('world')}>Mundo</button><button disabled={!room} className={channel==='room'?'active':''} onClick={()=>setChannel('room')}>Sala</button></div><div className="chat-messages" aria-live="polite"><p className="system-message">Bem-vindo à rua de Brasa.</p>{chat.filter(m=>m.channel===channel).slice(-30).map(m=><p key={m.id}><strong {...playerMenuProps(m.playerId?{id:m.playerId,name:m.name,context:'chat'}:null)}>{m.name}:</strong> {m.text}</p>)}<div ref={end}/></div><form className="chat-input" onSubmit={e=>{e.preventDefault();if(text.trim()){client.send({type:'chat',text,channel});setText('');}}}><input aria-label="Mensagem de chat" maxLength={180} placeholder="Enter para conversar…" value={text} onChange={e=>setText(e.target.value)}/><button aria-label="Enviar mensagem"><Send size={14}/></button></form></>;
}
