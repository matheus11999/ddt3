import {CouponIcon,RewardIcon} from './RewardIcon';
import {PowerCounter} from './PowerCounter';
import {useEffect,useRef,useState} from 'react';
import {Send,MapPin,Volume2,VolumeX,Settings,Expand,ChevronDown,Check,X,PawPrint,Fish,LogOut} from 'lucide-react';
import type {ReactNode} from 'react';
import type {ChatChannel} from '../../shared/protocol';
import {PowerIcon} from './PowerIcon';
import {LevelBadge} from './LevelBadge';
import {levelProgress} from '../../shared/progression';
import {attributes} from '../../shared/catalog';import {client,useGame} from '../client';import {Avatar} from './Avatar';import {audio} from '../game/audio';
import {playerMenuProps} from './PlayerActions';
import {WorldBossButton} from './WorldBoss';
import './WoodTheme.css';
import './Hud.css';
type LobbyMenu='quests'|'guild';
const PLAZA_ONLY_BUTTONS=new Set(['bag','shop','auction','pets','quests','guild']);
const LOBBY_MENU_NAMES:Record<LobbyMenu,string>={quests:'Missões',guild:'Guilda'};
export function Hud({onArena,onExpeditions,onInventory,onForge,onShop,onSettings}:{onArena:()=>void;onExpeditions:()=>void;onInventory:()=>void;onForge:()=>void;onShop:()=>void;onSettings:()=>void}){
 const {profile,channel,room,mailUnread,auctionMine,zone}=useGame();const fishingZone=zone==='fishing';const p=profile!;const stats=attributes(p.equipment,p.level),progress=levelProgress(p.level,p.xp);const [sound,setSound]=useState(audio.enabled);const [chatOpen,setChatOpen]=useState(true);useEffect(()=>{const open=()=>setChatOpen(true);window.addEventListener('brasa-chat-focus',open);return()=>window.removeEventListener('brasa-chat-focus',open);},[]);
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
 const all:{id:string;label:string;art?:string;icon?:ReactNode;count?:number;action:()=>void;disabled?:boolean;pressed?:boolean}[]=[
  // The halls (and the smith's stall) are on the plaza: from the Pescaria the player walks back first.
  ...(fishingZone?[]:[{id:'arena',label:'Arena',art:'arena-button.png',action:onArena},
  {id:'expeditions',label:'Expedições',art:'expedition-button.png',action:onExpeditions},
  // Drawn fish until the painted fishing-button.png exists (docs/fishing-art-prompts.md).
  {id:'fishing',label:'Pescaria',icon:<Fish className="lobby-dock-icon" size={30} strokeWidth={2.4}/>,action:()=>{setMenu(null);client.goTo('fishing');audio.play('click');},disabled:!!room}]),
  // Pescaria: the Sacola with what was fished takes the place of the backpack.
  ...(fishingZone?[{id:'fish-bag',label:'Sacola',art:'/assets/fishing/ui/bag-button.webp',action:()=>{setMenu(null);client.openFishBag();audio.play('click');}}]:[]),
  {id:'bag',label:'Mochila',art:'backpack-button.png',action:onInventory},
  {id:'shop',label:'Loja',art:'shop-button.png',action:onShop},
  {id:'auction',label:'Leilão',art:'auction-button.png',count:auctionMine.unseen,action:()=>{setMenu(null);client.openAuction();audio.play('click');}},
  ...(fishingZone?[]:[{id:'forge',label:'Ferreiro',art:'forge-button.png',action:onForge,disabled:!!room}]),
  // Pets: drawn paw until the painted pet-button.png exists (docs/pets.md).
  {id:'pets',label:'Pets',icon:<PawPrint className="lobby-dock-icon" size={30} strokeWidth={2.4}/>,action:()=>{setMenu(null);client.openPets();audio.play('click');}},
  {id:'quests',label:'Missões',art:'arena-quests.png',count:pendingQuests,action:()=>toggle('quests'),pressed:menu==='quests'},
  {id:'mail',label:'Correio',art:'arena-mail.png',count:mailUnread,action:()=>{setMenu(null);client.openMail();audio.play('click');}},
  {id:'guild',label:'Guilda',art:'arena-guild.png',action:()=>{setMenu(null);client.openGuild();audio.play('click');}},
  {id:'hall',label:'Hall da Fama',art:'hall-button.png',action:()=>{setMenu(null);client.openHall();audio.play('click');}},
  {id:'settings',label:'Ajustes',art:'settings-button.png',action:onSettings},
 ];
 // Pescaria (pedido do matheus): sem Mochila, Loja, Leilão, Pets, Missões e Guilda.
 const buttons=fishingZone?all.filter(b=>!PLAZA_ONLY_BUTTONS.has(b.id)):all;
 return <><div className="top-vignette"/><button className="player-hud" onClick={onInventory} title="Abrir mochila"><div className="portrait"><div className="portrait-crop"><Avatar equipment={p.equipment} size={87} portrait animated={false} weapon={false}/></div><div className="profile-level-badge"><LevelBadge level={p.level} size={40}/></div></div><div className="profile-lines"><div className="profile-name"><strong>{p.name}</strong><small>AVENTUREIRO</small></div><div className="resource-bar health"><i/><span><b>HP</b>{stats.hp} / {stats.hp}</span></div><div className="resource-bar stamina"><i/><span><b>VIGOR</b>{stats.stamina} / {stats.stamina}</span></div><div className="profile-power" title="Poder do jogador"><PowerIcon size={24}/> <PowerCounter value={stats.power}/></div></div></button>
  <WorldBossButton/>
  <div className="channel-chip"><MapPin size={13}/> {fishingZone?'Pescaria':'Praça Celeste'} <i/> Canal {String(channel).padStart(2,'0')}</div>
  <div className="top-right"><div className="currency"><span title="Ouro (Moedas Brasa)" className="currency-gold"><RewardIcon size={20}/><b>{p.gold.toLocaleString('pt-BR')}</b></span><span className="currency-divider"/><span className="currency-coupons" title="Cupons"><CouponIcon size={24}/><b>{p.coupons.toLocaleString('pt-BR')}</b></span></div><button className="round-button" aria-label={sound?'Desativar som':'Ativar som'} onClick={()=>{audio.setEnabled(!sound);setSound(!sound);}}>{sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button><button className="round-button" aria-label="Tela cheia" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen().catch(()=>{});}}><Expand size={18}/></button><button className="round-button" aria-label="Configurações" onClick={onSettings}><Settings size={19}/></button>{zone==='fishing'&&<button className="round-button fishing-quit" aria-label="Sair da Pescaria" title="Sair da Pescaria (volta à Praça Celeste)" onClick={()=>{client.goTo('plaza');audio.play('click');}}><LogOut size={18}/></button>}</div>
  <div className={`chat-shell lobby-chat wood-pane wood-chat ${chatOpen?'':'collapsed'}`}><button className="chat-collapse" aria-label={chatOpen?'Minimizar chat':'Abrir chat'} onClick={()=>setChatOpen(!chatOpen)}><ChevronDown size={15}/></button><Chat/></div>
  <nav ref={dock} className="bottom-dock lobby-dock" aria-label="Menus da praça">{buttons.map(button=><button key={button.id} className={`lobby-dock-button ${button.id} ${button.pressed?'active':''}`} aria-label={button.label} title={button.label} aria-expanded={button.pressed===undefined?undefined:button.pressed} disabled={button.disabled} onClick={button.action}><span className="lobby-dock-tile">{button.art?<img src={button.art.startsWith('/')?button.art:`/assets/ui/${button.art}`} alt="" draggable={false}/>:button.icon}{button.count?<b className="lobby-dock-count">{button.count}</b>:null}</span><span className="lobby-dock-label">{button.label}</span></button>)}
   {menu&&<section className="lobby-dock-popover" role="dialog" aria-label={LOBBY_MENU_NAMES[menu]}><header><strong>{LOBBY_MENU_NAMES[menu]}</strong><button type="button" aria-label={`Fechar ${LOBBY_MENU_NAMES[menu]}`} onClick={()=>setMenu(null)}><X size={17}/></button></header>{menu==='quests'?<div className="lobby-quest-list"><button type="button" onClick={()=>{setMenu(null);onInventory();}}><span className={p.equippedOnce?'done':''}>{p.equippedOnce?<Check size={15}/>:'1'}</span><div><strong>Vista sua aventura</strong><small>Equipe um item na mochila</small></div></button><button type="button" onClick={()=>{setMenu(null);onArena();}}><span className={p.matches?'done':''}>{p.matches?<Check size={15}/>:'2'}</span><div><strong>Entre na arena</strong><small>Conclua sua primeira batalha</small></div></button></div>:<p>Em breve</p>}</section>}
  </nav>
  <div className="xp-bottom"><div style={{width:`${progress.percent}%`}}/><span>{progress.capped?`NÍVEL ${p.level} · MÁXIMO`:`EXP ${progress.current} / ${progress.required}`}</span></div>
 </>;
}
type ChatTab=ChatChannel;
const CHAT_TABS:{id:ChatTab;label:string}[]=[{id:'world',label:'Mundo'},{id:'room',label:'Sala'},{id:'guild',label:'Guilda'},{id:'private',label:'Privado'}];
const CHAT_HINTS:Record<ChatTab,string>={world:'Bem-vindo à rua de Brasa.',room:'Conversa da sala: só quem está nela (e na batalha) lê.',guild:'Conversa da guilda: todos os membros online leem.',private:'Clique com o botão direito em um jogador e escolha Enviar mensagem.'};
/** The chat: one tab per channel. Whispers show in every tab, so none is missed; a tab with news gets a dot. */
export function Chat(){const {chat,room,chatTarget,profile,guild}=useGame();const inGuild=!!guild?.guild;const [text,setText]=useState(''),[channel,setChannel]=useState<ChatTab>(room?'room':'world');const [seen,setSeen]=useState<Partial<Record<ChatTab,string>>>(()=>Object.fromEntries(CHAT_TABS.map(t=>[t.id,chat.filter(m=>m.channel===t.id).at(-1)?.id])));const end=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{const list=end.current?.parentElement;if(list)list.scrollTop=list.scrollHeight;},[chat,channel]);useEffect(()=>{setChannel(room?'room':'world');},[room?.id]);
 // Leaving the guild (or the room) drops its tab back to Mundo.
 useEffect(()=>{if((channel==='guild'&&!inGuild)||(channel==='room'&&!room))setChannel('world');},[channel,inGuild,room]);
 const last=(tab:ChatTab)=>chat.filter(m=>m.channel===tab).at(-1);
 useEffect(()=>{const id=last(channel)?.id;if(id&&seen[channel]!==id)setSeen(s=>({...s,[channel]:id}));},[chat,channel]);
 // "Enviar mensagem" in the player menu: switch to the private tab, writing to that player.
 useEffect(()=>{const focus=()=>{setChannel('private');requestAnimationFrame(()=>input.current?.focus());};window.addEventListener('brasa-chat-focus',focus);return()=>window.removeEventListener('brasa-chat-focus',focus);},[]);
 const privateTo=channel==='private'?chatTarget:null,me=profile?.id;
 const unread=(tab:ChatTab)=>{const m=last(tab);return tab!==channel&&tab!=='private'&&!!m&&m.id!==seen[tab]&&m.playerId!==me;};
 const enabled=(tab:ChatTab)=>tab==='room'?!!room:tab==='guild'?inGuild:true;
 const reply=(target:{id?:string;name?:string})=>{if(target.id&&target.name){client.update({chatTarget:{id:target.id,name:target.name}});setChannel('private');requestAnimationFrame(()=>input.current?.focus());}};
 const lines=chat.filter(m=>m.channel===channel||m.channel==='private').slice(-30);
 return <><div className="chat-tabs">{CHAT_TABS.map(t=><button key={t.id} type="button" data-channel={t.id} disabled={!enabled(t.id)} title={t.id==='guild'&&!inGuild?'Entre em uma guilda para usar':undefined} className={channel===t.id?'active':''} data-unread={unread(t.id)||undefined} onClick={()=>setChannel(t.id)}>{t.label}</button>)}</div><div className="chat-messages" aria-live="polite"><p className="system-message">{CHAT_HINTS[channel]}</p>{lines.map(m=>{
   if(m.channel==='private'){const mine=m.playerId===me,other=mine?{id:m.toId,name:m.toName}:{id:m.playerId,name:m.name};
    return <p key={m.id} className="chat-private"><strong {...playerMenuProps(other.id?{id:other.id,name:other.name??'',context:'chat'}:null)} title="Responder" onClick={()=>reply(other)}>{mine?`Para ${m.toName}`:`De ${m.name}`}:</strong> {m.text}</p>;}
   return <p key={m.id} className={m.channel==='guild'?'chat-guild':undefined}><strong {...playerMenuProps(m.playerId?{id:m.playerId,name:m.name,context:'chat'}:null)}>{m.name}:</strong> {m.text}</p>;})}<div ref={end}/></div><form className="chat-input" onSubmit={e=>{e.preventDefault();if(!text.trim())return;if(channel==='private'){if(!chatTarget)return;client.send({type:'chat',text,channel,to:chatTarget.id});}else client.send({type:'chat',text,channel});setText('');}}>{privateTo&&<button type="button" className="chat-target" title="Parar de conversar em privado" onClick={()=>client.clearChatTarget()}>Para {privateTo.name} <X size={11}/></button>}<input ref={input} aria-label="Mensagem de chat" maxLength={180} disabled={channel==='private'&&!chatTarget} placeholder={channel==='private'&&!chatTarget?'Escolha um jogador…':'Enter para conversar…'} value={text} onChange={e=>setText(e.target.value)}/><button aria-label="Enviar mensagem"><Send size={14}/></button></form></>;
}
