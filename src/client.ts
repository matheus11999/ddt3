import {useSyncExternalStore} from 'react';
import type {Battle,ChatLine,Command,LobbyPlayer,Profile,Room,ServerEvent,Shot,ForgeResult} from '../shared/protocol';
export interface State {status:'connecting'|'online'|'offline'|'replaced';profile:Profile|null;players:LobbyPlayer[];rooms:Room[];room:Room|null;battle:Battle|null;chat:ChatLine[];online:number;channel:number;latency:number;offset:number;shot:Shot|null;error:string|null;forgeResult:ForgeResult|null;}
class Client {
 state:State={status:'connecting',profile:null,players:[],rooms:[],room:null,battle:null,chat:[],online:0,channel:1,latency:0,offset:0,shot:null,error:null,forgeResult:null};
 private listeners=new Set<()=>void>();private ws:WebSocket|null=null;private started=false;private retry=0;private reconnectTimer=0;private pingTimer=0;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
 snapshot=()=>this.state;
 update(patch:Partial<State>){this.state={...this.state,...patch};this.listeners.forEach(f=>f());}
 async start(){if(this.started)return;this.started=true;this.update({status:'connecting',error:null});try{const r=await fetch('/api/session',{method:'POST',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Não foi possível entrar. Tente novamente.');const {profile}=await r.json();if(!profile)throw Error('A sessão não foi criada. Tente novamente.');this.update({profile});this.connect();}catch(e){this.update({status:'offline',error:e instanceof DOMException&&e.name==='TimeoutError'?'O servidor demorou a responder. Toque em tentar novamente.':(e as Error).message});this.started=false;}}
 private connect(){
  this.update({status:'connecting'});const ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);this.ws=ws;
  const connectTimeout=window.setTimeout(()=>{if(ws.readyState!==WebSocket.OPEN)ws.close();},10000);
  ws.onopen=()=>{clearTimeout(connectTimeout);this.retry=0;this.update({status:'online',error:null});this.pingTimer=window.setInterval(()=>this.send({type:'ping',time:Date.now()}),5000);};
  ws.onmessage=e=>{let event:ServerEvent;try{event=JSON.parse(e.data);}catch{return;}this.receive(event);};
  ws.onclose=e=>{clearTimeout(connectTimeout);clearInterval(this.pingTimer);if(e.code===4001){this.update({status:'replaced'});return;}this.update({status:'offline'});this.reconnectTimer=window.setTimeout(()=>this.connect(),Math.min(10000,1000*2**this.retry++));};
  ws.onerror=()=>ws.close();
 }
 private receive(e:ServerEvent){switch(e.type){
  case 'welcome':this.update({profile:e.profile,players:e.players,rooms:e.rooms,room:e.room,battle:e.battle,channel:e.channel,offset:e.serverTime-Date.now(),shot:null});break;
  case 'profile':this.update({profile:e.profile});break;
  case 'forge-result':this.update({forgeResult:e.result});break;
  case 'lobby':this.update({players:e.players,online:e.online});break;
  case 'rooms':this.update({rooms:e.rooms});break;
  case 'room':this.update({room:e.room});break;
  case 'battle':this.update({shot:!e.battle||e.battle.id!==this.state.battle?.id?null:this.state.shot,battle:e.battle?{...e.battle,terrain:e.battle.terrain??(this.state.battle?.id===e.battle.id?this.state.battle.terrain:undefined)}:null});break;
  case 'shot':this.update({shot:e.shot});break;
  case 'chat':this.update({chat:[...this.state.chat.slice(-79),e.message]});break;
  case 'error':this.update({error:e.message});break;
  case 'pong':this.update({latency:Date.now()-e.time,offset:e.serverTime-(e.time+Date.now())/2});break;
 }}
 send(c:Command){if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(c));else this.update({error:'Reconectando ao servidor…'});}
 retryNow(){clearTimeout(this.reconnectTimer);this.started=false;this.start();}
}
export const client=new Client();
export const useGame=()=>useSyncExternalStore(client.subscribe,client.snapshot);
