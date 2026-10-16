import {chargeFromDamage,POWER_MAX,POWER_CUT_IN_MS,POWER_DAMAGE_MULTIPLIER,POWER_BLAST_MULTIPLIER,POWER_CRATER_MULTIPLIER} from '../shared/power';
import {CARD_PRIZES,REWARD_CARD_COUNT,REWARD_PICK_MS} from '../shared/rewards';
import type {CardPrize,MatchBonuses} from '../shared/rewards';
import {randomInt,randomUUID} from 'node:crypto';
import {attributes,BOOSTS,CATALOG,DEFAULT_EQUIPMENT,SMITH_POSITION,WEAPONS,weaponStats} from '../shared/catalog';
import type {BoostId,Weapon} from '../shared/catalog';
import type {Battle,Command,Fighter,LobbyPlayer,Profile,Room,Seat,ServerEvent,Shot,TerrainMark} from '../shared/protocol';
import {crater,createTerrain,ground,packTerrain,terrainMaterial,trajectory,volley,walkPosition,WORLD} from '../shared/physics';
import type {ProfileStore} from './store';
import {getMap,canonicalMap} from '../shared/maps';
import {damageAtImpact} from '../shared/combat';
import {initialSlots,modeForSlots} from '../shared/rooms';
export interface Peer {profile:Profile;send:(event:ServerEvent)=>void;connected:boolean;roomId:string|null;channel:number;x:number;y:number;targetX:number;targetY:number;lastSeen:number;lastWalk:number;lastAim?:number;}
interface Match {pendingPower?:{playerId:string;angle:number;power:number;at:number};state:Battle;terrain:Uint8Array;resolveAt:number;botAt:number;createdAt:number;rewardDeck?:CardPrize[];savingRewards?:boolean;retryRewardsAt?:number;pendingMarks?:{at:number;mark:TerrainMark}[];}
export class Game {
 peers=new Map<string,Peer>();rooms=new Map<string,Room>();matches=new Map<string,Match>();
 private lastTick=Date.now();private lobbyTick=0;private roomsDirty=false;
 constructor(private store:ProfileStore,private report:(e:unknown)=>void=console.error){}
 connect(profile:Profile,send:Peer['send']){
  let p=this.peers.get(profile.id);
  if(p){p.send=send;p.connected=true;p.lastSeen=Date.now();p.profile=profile;}
  else {let channel=1;while([...this.peers.values()].filter(x=>x.channel===channel).length>=60)channel++;p={profile,send,connected:true,roomId:null,channel,x:750+Math.random()*120,y:660,targetX:800,targetY:660,lastSeen:Date.now(),lastWalk:0};p.targetX=p.x;this.peers.set(profile.id,p);}
  const room=p.roomId?this.rooms.get(p.roomId):undefined;const match=room?this.matches.get(room.id):undefined;
  if(room){const seat=room.players.find(s=>s.id===profile.id);if(seat)seat.connected=true;this.broadcastRoom(room);}
  send({type:'welcome',profile,players:this.lobby(p.channel),rooms:[...this.rooms.values()],room:room??null,battle:match?this.snapshot(match,true):null,serverTime:Date.now(),channel:p.channel});
  this.sendLobby(p.channel);return p;
 }
 disconnect(id:string){const p=this.peers.get(id);if(!p)return;p.connected=false;p.lastSeen=Date.now();if(p.roomId){const r=this.rooms.get(p.roomId);const s=r?.players.find(x=>x.id===id);if(s)s.connected=false;if(r)this.broadcastRoom(r);}this.sendLobby(p.channel);}
 lobby(channel:number):LobbyPlayer[]{return [...this.peers.values()].filter(p=>p.connected&&!p.roomId&&p.channel===channel).map(p=>({id:p.profile.id,name:p.profile.name,level:p.profile.level,equipment:p.profile.equipment,x:p.x,y:p.y}));}
 private emit(p:Peer,e:ServerEvent){if(p.connected)p.send(e);}
 private sendLobby(channel:number){const players=this.lobby(channel);const online=[...this.peers.values()].filter(p=>p.connected).length;for(const p of this.peers.values())if(p.channel===channel&&!p.roomId)this.emit(p,{type:'lobby',players,online});}
 private broadcastRooms(){for(const p of this.peers.values())this.emit(p,{type:'rooms',rooms:[...this.rooms.values()]});this.roomsDirty=false;}
 private broadcastRoom(room:Room){for(const s of room.players){const p=this.peers.get(s.id);if(p?.roomId===room.id)this.emit(p,{type:'room',room});}this.roomsDirty=true;}
 private broadcastBattle(m:Match,withTerrain=false){const battle=this.snapshot(m,withTerrain||m.state.phase==='finished');for(const f of m.state.players){const p=this.peers.get(f.id);if(p?.roomId===m.state.roomId)this.emit(p,{type:'battle',battle});}}
 private snapshot(m:Match,withTerrain=false):Battle {return {...m.state,terrainMarks:[...(m.state.terrainMarks??[]),...(m.pendingMarks??[]).filter(entry=>entry.at<=Date.now()).map(entry=>entry.mark)].slice(-48),...(withTerrain?{terrain:Buffer.from(packTerrain(m.terrain)).toString('base64')}:{})};}
 private room(p:Peer){const room=p.roomId?this.rooms.get(p.roomId):undefined;if(!room)throw Error('Entre em uma sala primeiro.');return room;}
 private turn(p:Peer){const room=this.room(p),m=this.matches.get(room.id);if(!m||m.state.phase!=='aiming')throw Error('Aguarde o próximo turno.');if(m.state.turnId!==p.profile.id)throw Error('Aguarde a sua vez.');if(Date.now()>m.state.deadline)throw Error('O tempo do turno terminou.');const f=m.state.players.find(x=>x.id===p.profile.id)!;if(f.hp<=0)throw Error('Seu personagem está fora de combate.');return {m,f};}
 private seat(p:Peer,team:0|1,slot:number):Seat{return {id:p.profile.id,name:p.profile.name,level:p.profile.level,equipment:{...p.profile.equipment},ready:false,bot:false,team,slot,connected:true};}
 private vacantSeat(room:Room):{team:0|1;slot:number}{
  const teams: (0|1)[]=[0,1];teams.sort((a,b)=>room.players.filter(p=>p.team===a).length-room.players.filter(p=>p.team===b).length);
  for(const team of teams){const slot=room.openSlots.find(index=>!room.players.some(p=>p.team===team&&p.slot===index));if(slot!==undefined)return {team,slot};}
  throw Error('Esta sala está cheia.');
 }
 async command(id:string,c:Command){
  const p=this.peers.get(id);if(!p||!p.connected)return;
  try{
   switch(c.type){
    case 'ping':this.emit(p,{type:'pong',time:c.time,serverTime:Date.now()});return;
    case 'move':if(!p.roomId){p.targetX=c.x;p.targetY=c.y;}return;
    case 'rename':if(p.roomId)throw Error('Volte à praça para mudar seu nome.');await this.store.rename(id,c.name);p.profile.name=c.name;this.emit(p,{type:'profile',profile:p.profile});this.sendLobby(p.channel);return;
    case 'customize':
    case 'dye':
    case 'equip':{
     if(p.roomId&&this.rooms.get(p.roomId)?.status==='playing')throw Error('Troque seus equipamentos entre as batalhas.');
     const equipment=c.type==='customize'?{...p.profile.equipment,...c.selection.items,dyes:c.selection.dyes??{}}:{...p.profile.equipment};
     if(c.type==='customize'){/* All slots and ownership are checked atomically by the store. */}
     else if(c.type==='dye')equipment.dyes={...equipment.dyes,[c.slot]:c.color};
     else {const item=CATALOG[c.item];if(!item||!p.profile.inventory.includes(c.item))throw Error('Este item não está na sua mochila.');equipment[item.slot]=item.id;}
     p.profile=await this.store.saveEquipment(id,equipment);
     this.emit(p,{type:'profile',profile:p.profile});if(p.roomId){const r=this.room(p);const s=r.players.find(s=>s.id===id)!;s.equipment={...p.profile.equipment};s.ready=false;this.broadcastRoom(r);}this.sendLobby(p.channel);return;
    }
    case 'shop-buy':{
     if(p.roomId&&this.rooms.get(p.roomId)?.status==='playing')throw Error('Visite a loja entre as batalhas.');
     const outcome=await this.store.buy(id,c.items);p.profile=outcome.profile;
     this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'shop-result',result:outcome.result});break;
    }
    case 'forge':{
     if(p.roomId)throw Error('Volte ao ferreiro da praça para fortalecer sua arma.');
     if(Math.hypot(p.x-SMITH_POSITION.x,p.y-SMITH_POSITION.y)>180)throw Error('Aproxime-se do ferreiro.');
     const outcome=await this.store.forge(id,c.item,c.stones);p.profile=outcome.profile;
     this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'forge-result',result:outcome.result});this.sendLobby(p.channel);return;
    }
    case 'compose':{
     if(p.roomId)throw Error('Volte ao ferreiro da praça para compor seu equipamento.');
     if(Math.hypot(p.x-SMITH_POSITION.x,p.y-SMITH_POSITION.y)>180)throw Error('Aproxime-se do ferreiro.');
     const outcome=await this.store.compose(id,c.item,c.stone);p.profile=outcome.profile;
     this.emit(p,{type:'profile',profile:p.profile});this.emit(p,{type:'composition-result',result:outcome.result});this.sendLobby(p.channel);return;
    }
    case 'create':{
     if(p.roomId)throw Error('Saia da sala atual antes de criar outra.');if(this.rooms.size>=200)throw Error('A arena está cheia. Tente novamente em breve.');
     const room:Room={id:randomUUID(),name:c.name,hostId:id,mode:c.mode,openSlots:initialSlots(c.mode),map:canonicalMap(c.map),status:'waiting',players:[this.seat(p,0,0)]};this.rooms.set(room.id,room);p.roomId=room.id;this.broadcastRoom(room);this.sendLobby(p.channel);break;
    }
    case 'join':{
     if(p.roomId)throw Error('Você já está em uma sala.');const r=this.rooms.get(c.roomId);if(!r||r.status!=='waiting')throw Error('Esta sala não está disponível.');
     const {team,slot}=this.vacantSeat(r);r.players.push(this.seat(p,team,slot));p.roomId=r.id;this.broadcastRoom(r);this.sendLobby(p.channel);break;
    }
    case 'room-slot':{
     const r=this.room(p);if(r.hostId!==id)throw Error('Somente o líder pode alterar os espaços.');
     if(r.status!=='waiting')throw Error('Altere os espaços entre as batalhas.');
     if(c.slot<1||c.slot>3||!Number.isInteger(c.slot))throw Error('O primeiro espaço de cada equipe permanece aberto.');
     if(r.openSlots.includes(c.slot)===c.open)break;
     if(!c.open&&r.players.some(s=>s.slot===c.slot&&!s.bot))throw Error('Este espaço está ocupado por um jogador. Aguarde ele sair.');
     if(c.open)r.openSlots=[...r.openSlots,c.slot].sort((a,b)=>a-b);
     else {r.openSlots=r.openSlots.filter(slot=>slot!==c.slot);r.players=r.players.filter(s=>s.slot!==c.slot);}
     r.mode=modeForSlots(r.openSlots.length);r.players.forEach(s=>s.ready=s.bot);this.broadcastRoom(r);break;
    }
    case 'kick':{
     const r=this.room(p);if(r.hostId!==id)throw Error('Somente o líder pode remover jogadores.');
     if(r.status!=='waiting')throw Error('Remova jogadores somente entre as batalhas.');
     if(c.playerId===id)throw Error('Use Sair da sala para deixar a equipe.');
     const seat=r.players.find(s=>s.id===c.playerId);if(!seat)throw Error('Este jogador não está nesta sala.');
     r.players.forEach(s=>s.ready=s.bot);
     const target=this.peers.get(seat.id);
     if(!seat.bot&&target?.roomId===r.id){this.leave(target);this.emit(target,{type:'error',message:'Você foi removido da sala pelo líder.'});}
     else {r.players=r.players.filter(s=>s.id!==seat.id);this.broadcastRoom(r);}
     break;
    }
    case 'leave':this.leave(p);break;
    case 'ready':{const r=this.room(p);if(r.status!=='waiting')throw Error('A partida já começou.');const s=r.players.find(x=>x.id===id)!;s.ready=!s.ready;this.broadcastRoom(r);break;}
    case 'bot':{
     const r=this.room(p);if(r.hostId!==id||r.status!=='waiting')throw Error('Somente o líder pode adicionar um bot.');
     const {team,slot}=this.vacantSeat(r),n=r.players.filter(x=>x.bot).length;
     r.players.push({id:`bot-${randomUUID()}`,name:['Pipoca','Faísca','Fagulha'][n%3]+' · BOT',level:p.profile.level,equipment:{...DEFAULT_EQUIPMENT,weapon:WEAPONS[(n+1)%3].id,hat:'hat-knight',outfit:n%2?'outfit-surfer':'outfit-executive',face:'face-smile'},ready:true,bot:true,team,slot,connected:true});this.broadcastRoom(r);break;
    }
    case 'start':this.start(p);break;
    case 'power':{const {m,f}=this.turn(p);this.armPower(f);this.broadcastBattle(m);break;}
    case 'boost':{const {m,f}=this.turn(p);this.boost(f,c.boost);this.broadcastBattle(m);break;}
    case 'aim':{
     const {m,f}=this.turn(p);if(Date.now()-(p.lastAim??0)<100)return;p.lastAim=Date.now();
     const w=WEAPONS.find(w=>w.id===f.equipment.weapon)!;f.aimAngle=Math.max(w.minAngle,Math.min(w.maxAngle,c.angle));f.chargePower=c.power;f.charging=c.charging;this.broadcastBattle(m);break;
    }
    case 'walk':{
     const {m,f}=this.turn(p);if(Date.now()-p.lastWalk<65)return;p.lastWalk=Date.now();if(f.stamina<3)throw Error('Vigor insuficiente.');
     f.facing=c.direction;const destination=walkPosition(m.terrain,f,c.direction);if(!destination)return;f.x=destination.x;f.y=destination.y;f.stamina-=3;if(f.y>WORLD.height)f.hp=0;if(!this.checkWin(m))this.broadcastBattle(m);break;
    }
    case 'fire':{const {m,f}=this.turn(p);const w=WEAPONS.find(w=>w.id===f.equipment.weapon)!;if(c.angle<w.minAngle||c.angle>w.maxAngle)throw Error(`Ângulo da arma: ${w.minAngle}° a ${w.maxAngle}°.`);this.fire(m,f,c.angle,c.power);break;}
    case 'pass':{const {m}=this.turn(p);this.nextTurn(m);break;}
    case 'reward-pick':{
     const r=this.room(p),m=this.matches.get(r.id),rewards=m?.state.rewards;
     if(!m||m.state.phase!=='finished'||!rewards||rewards.phase!=='picking'||Date.now()>=rewards.deadline)throw Error('A escolha de cartas terminou.');
     if(!m.state.players.some(f=>f.id===id&&!f.bot))throw Error('Você não participou desta batalha.');
     if(rewards.cards.some(card=>card.playerId===id))throw Error('Sua carta já está reservada.');
     const card=rewards.cards[c.card];if(!card||!Number.isInteger(c.card))throw Error('Carta inválida.');
     if(card.playerId)throw Error('Esta carta já foi escolhida.');
     // Claim synchronously, before any await: competing commands cannot claim the same slot.
     card.playerId=id;this.broadcastBattle(m);break;
    }
    case 'rematch':{
     const r=this.room(p),m=this.matches.get(r.id);if(!m||m.state.phase!=='finished')throw Error('A batalha ainda está acontecendo.');if(r.hostId!==id)throw Error('Aguarde o líder da sala.');if(!m.state.rewards?.saved)throw Error('Aguarde a revelação e o recebimento das recompensas.');this.matches.delete(r.id);r.status='waiting';r.players.forEach(s=>s.ready=s.bot);for(const s of r.players){const peer=this.peers.get(s.id);if(peer)this.emit(peer,{type:'battle',battle:null});}this.broadcastRoom(r);break;
    }
    case 'chat':{
     const msg={id:randomUUID(),name:p.profile.name,text:c.text,channel:c.channel,time:Date.now()};
     if(c.channel==='room'){const r=this.room(p);for(const s of r.players){const peer=this.peers.get(s.id);if(peer)this.emit(peer,{type:'chat',message:msg});}}
     else for(const peer of this.peers.values())if(peer.channel===p.channel)this.emit(peer,{type:'chat',message:msg});break;
    }
   }
   if(this.roomsDirty)this.broadcastRooms();
  }catch(e){this.emit(p,{type:'error',message:e instanceof Error?e.message:'Não foi possível concluir a ação.'});}
 }
 private leave(p:Peer){
  if(!p.roomId)return;const r=this.rooms.get(p.roomId),m=this.matches.get(p.roomId);
  if(r){r.players=r.players.filter(s=>s.id!==p.profile.id);if(m){const f=m.state.players.find(f=>f.id===p.profile.id);if(f){f.hp=0;f.connected=false;f.powerArmed=false;}if(!this.checkWin(m)&&m.state.turnId===p.profile.id&&m.state.phase==='aiming')this.nextTurn(m);else this.broadcastBattle(m);}
   if(!r.players.some(s=>!s.bot)){this.rooms.delete(r.id);if(!m||m.state.rewards?.saved)this.matches.delete(r.id);}
   else{if(r.hostId===p.profile.id)r.hostId=r.players.find(s=>!s.bot)!.id;this.broadcastRoom(r);}
  }
  p.roomId=null;this.emit(p,{type:'room',room:null});this.emit(p,{type:'battle',battle:null});this.roomsDirty=true;this.sendLobby(p.channel);
 }
 private start(p:Peer){
  const r=this.room(p);if(r.hostId!==p.profile.id)throw Error('Somente o líder pode iniciar.');if(r.status!=='waiting')throw Error('A partida já começou.');
  const capacity=r.openSlots.length*2;if(r.players.length!==capacity)throw Error(`A sala precisa de ${capacity} jogadores. Você pode adicionar bots.`);
  if(r.openSlots.some(slot=>[0,1].some(team=>r.players.filter(s=>s.team===team&&s.slot===slot).length!==1)))throw Error('Preencha os espaços abertos das duas equipes.');
  if(r.players.some(s=>!s.connected||(!s.ready&&s.id!==r.hostId)))throw Error('Aguarde todos ficarem prontos.');
  const terrain=createTerrain(r.map);const fighters:Fighter[]=r.players.map(s=>{const stats=attributes(s.equipment);const x=getMap(r.map).spawns[s.team][s.slot];return {...s,x,y:ground(terrain,x),hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,facing:s.team===0?1:-1,boosts:[],powerCharge:0,powerArmed:false};});
  fighters.sort((a,b)=>attributes(b.equipment).agility-attributes(a.equipment).agility);
  // In practice, the human takes the first turn so controls can be learned immediately.
  const first=r.players.some(s=>s.bot)?fighters.find(f=>!f.bot)!:fighters[0];
  const m:Match={state:{id:randomUUID(),roomId:r.id,map:r.map,players:fighters,turnId:first.id,turnNumber:1,wind:this.wind(),deadline:Date.now()+30000,phase:'aiming',winner:null},terrain,resolveAt:0,botAt:Date.now()+2000,createdAt:Date.now()};r.status='playing';this.matches.set(r.id,m);this.broadcastRoom(r);this.broadcastBattle(m,true);
 }
 private wind(){return Math.round((Math.random()*2-1)*35)/10;}
 private boost(f:Fighter,id:BoostId){
  const b=BOOSTS.find(b=>b.id===id)!;
  if(f.boosts.includes(id))throw Error('Esta ferramenta já foi usada.');
  if(id.startsWith('extra')&&f.boosts.some(b=>b.startsWith('extra')))throw Error('Escolha +1 ou +2 neste turno.');
  if(f.stamina<b.cost)throw Error('Vigor insuficiente.');f.stamina-=b.cost;f.boosts.push(id);
 }
 private armPower(f:Fighter){
  if(f.powerArmed)throw Error('Power já está preparado para este tiro.');
  if((f.powerCharge??0)<POWER_MAX)throw Error('Acumule 100 de Power para ativar.');
  f.powerCharge=0;f.powerArmed=true;
 }
 private fire(m:Match,f:Fighter,angle:number,power:number){
  if(f.powerArmed){
   f.powerArmed=false;f.charging=false;
   const at=Date.now()+POWER_CUT_IN_MS;
   m.pendingPower={playerId:f.id,angle,power,at};
   m.state.powerCutIn={id:randomUUID(),playerId:f.id,endsAt:at};
   m.state.phase='resolving';m.resolveAt=Infinity;this.broadcastBattle(m);return;
  }
  this.resolveFire(m,f,angle,power,false);
 }
 private resolveFire(m:Match,f:Fighter,angle:number,power:number,powered:boolean){
  f.aimAngle=angle;f.chargePower=power;f.charging=false;
  const w=weaponStats(WEAPONS.find(w=>w.id===f.equipment.weapon)!,f.equipment.upgrade);
  if(powered){w.crater*=POWER_CRATER_MULTIPLIER;w.blast*=POWER_BLAST_MULTIPLIER;}
  let count=f.boosts.includes('extra2')?3:f.boosts.includes('extra1')?2:1;
  const spread=f.boosts.includes('trident')?[-9,0,9]:[0];
  const penalty=(count===3?.6:count===2?.9:1)*(spread.length===3?.5:1);
  const bonus=1+f.boosts.reduce((n,b)=>n+(b.startsWith('damage')?Number(b.slice(6))/100:0),0);
  const shot:Shot={powered,id:randomUUID(),shooterId:f.id,projectiles:[],hits:[],duration:0};
  let delay=0;
  for(let i=0;i<count;i++){
   if(f.hp<=0)break;
   const offset=shot.projectiles.length,impacts:Shot['projectiles'][number]['impact'][]=[];
   const results=volley(m.terrain,f,spread.map(a=>angle+a),power,m.state.wind,w,m.state.players.filter(p=>p.id!==f.id),(result,index)=>{
    impacts[index]={x:result.x,y:result.y,radius:w.crater,...terrainMaterial(m.state.map,result.x,result.y)};
    crater(m.terrain,result.x,result.y,w.crater,m.state.map);
    for(const target of m.state.players){
     if(target.hp<=0)continue;const distance=Math.hypot(target.x-result.x,target.y-25-result.y);if(distance>w.blast)continue;
     const damage=damageAtImpact(f.equipment,target.equipment,{attenuation:Math.max(.15,1-distance/w.blast),shotMultiplier:penalty,boostMultiplier:bonus*(powered?POWER_DAMAGE_MULTIPLIER:1)});
     const effective=Math.min(target.hp,damage);
     if(target.team!==f.team){f.powerCharge=chargeFromDamage(f.powerCharge??0,effective,target.maxHp);target.powerCharge=chargeFromDamage(target.powerCharge??0,effective,target.maxHp,true);}
     target.hp=Math.max(0,target.hp-damage);if(target.hp<=0)target.powerArmed=false;shot.hits.push({id:target.id,damage,x:target.x,y:target.y-85,projectileIndex:offset+index});
    }
    // Subsequent impacts and extra volleys see the same fallen positions shown by the client.
    this.settle(m);
   });
   let groupDuration=0;
   results.forEach((result,index)=>{groupDuration=Math.max(groupDuration,result.points.length*1000/60);shot.projectiles.push({points:result.points,delay,impact:impacts[index],effect:w.effect,powered});});
   delay+=groupDuration+250;
  }
  m.pendingMarks=[...(m.pendingMarks??[]),...shot.projectiles.map((projectile,index)=>({at:Date.now()+projectile.delay+projectile.points.length*1000/60,mark:{id:`${shot.id}:${index}`,x:projectile.impact.x,y:projectile.impact.y,radius:projectile.impact.radius,effect:projectile.effect,level:f.equipment.upgrade}}))];
  shot.duration=delay+550;m.state.phase='resolving';m.resolveAt=Date.now()+shot.duration;
  for(const f of m.state.players){const p=this.peers.get(f.id);if(p?.roomId===m.state.roomId)this.emit(p,{type:'shot',shot});}
  this.broadcastBattle(m);
 }
 private settle(m:Match){for(const target of m.state.players){target.y=ground(m.terrain,target.x,Math.max(0,target.y-3));if(target.y>WORLD.height)target.hp=0;}}
 private nextTurn(m:Match){
  if(this.checkWin(m))return;
  const s=m.state,withTerrain=s.phase==='resolving';const index=s.players.findIndex(p=>p.id===s.turnId);let next=index;
  for(let n=1;n<=s.players.length;n++){const candidate=(index+n)%s.players.length;if(s.players[candidate].hp>0){next=candidate;break;}}
  delete m.pendingPower;delete s.powerCutIn;s.players.forEach(f=>{f.charging=false;f.powerArmed=false;});const f=s.players[next];f.stamina=f.maxStamina;f.boosts=[];s.turnId=f.id;s.turnNumber++;s.phase='aiming';s.wind=this.wind();s.deadline=Date.now()+30000;m.botAt=Date.now()+1800;this.broadcastBattle(m,withTerrain);
 }
 private checkWin(m:Match){
  if(m.state.phase==='finished')return true;
  const teams=new Set(m.state.players.filter(p=>p.hp>0).map(p=>p.team));
  const exhausted=m.state.turnNumber>=80;
  if(teams.size>1&&!exhausted)return false;
  delete m.pendingPower;delete m.state.powerCutIn;m.state.players.forEach(f=>f.powerArmed=false);
  m.state.phase='finished';m.state.winner=teams.size===1?[...teams][0]:null;
  m.rewardDeck=Array.from({length:REWARD_CARD_COUNT},()=>({...CARD_PRIZES[randomInt(CARD_PRIZES.length)]}));
  m.state.rewards={deadline:Date.now()+REWARD_PICK_MS,phase:'picking',saved:false,cards:Array.from({length:REWARD_CARD_COUNT},(_,index)=>({index}))};
  // Bot choices occupy real slots too; prizes stay exclusively on the server until reveal.
  for(const bot of m.state.players.filter(f=>f.bot))this.autoPick(m,bot.id);
  this.broadcastBattle(m,true);
  return true;
 }
 private autoPick(m:Match,id:string){
  const cards=m.state.rewards!.cards;if(cards.some(card=>card.playerId===id))return;
  const free=cards.filter(card=>!card.playerId);if(free.length){const card=free[randomInt(free.length)];card.playerId=id;card.automatic=true;}
 }
 private revealRewards(m:Match){
  const rewards=m.state.rewards!;
  for(const player of m.state.players)this.autoPick(m,player.id);
  for(const card of rewards.cards)if(card.playerId)card.prize={...m.rewardDeck![card.index]};
  rewards.phase='revealed';this.broadcastBattle(m);this.saveRewards(m);
 }
 private saveRewards(m:Match){
  const rewards=m.state.rewards;if(!rewards||rewards.saved||m.savingRewards)return;
  m.savingRewards=true;
  const humans=m.state.players.filter(p=>!p.bot),winners=humans.filter(p=>p.team===m.state.winner).map(p=>p.id);
  const bonuses:MatchBonuses=Object.fromEntries(rewards.cards.filter(card=>card.playerId&&card.prize&&humans.some(p=>p.id===card.playerId)).map(card=>[card.playerId!,card.prize!]));
  this.store.finishMatch(m.state.id,winners,humans.map(p=>p.id),bonuses).then(async()=>{
   for(const f of humans){const p=this.peers.get(f.id);if(p){const profile=await this.store.getProfile(f.id);if(profile){p.profile=profile;this.emit(p,{type:'profile',profile});const seat=this.rooms.get(m.state.roomId)?.players.find(s=>s.id===f.id);if(seat)seat.level=profile.level;}}}
   rewards.saved=true;this.broadcastBattle(m);const room=this.rooms.get(m.state.roomId);if(room)this.broadcastRoom(room);
  }).catch(error=>{this.report(error);m.retryRewardsAt=Date.now()+2000;}).finally(()=>{m.savingRewards=false;});
 }
 private bot(m:Match,f:Fighter){
  const target=m.state.players.filter(p=>p.team!==f.team&&p.hp>0).sort((a,b)=>a.hp-b.hp)[0];if(!target){this.nextTurn(m);return;}f.facing=target.x>f.x?1:-1;
  const w=WEAPONS.find(w=>w.id===f.equipment.weapon)!;let best={score:Infinity,angle:45,power:60};
  // A bounded ballistic search, at most 396 trajectories per bot turn.
  for(let angle=Math.max(25,w.minAngle);angle<=w.maxAngle;angle+=5)for(let power=18;power<=98;power+=3){const r=trajectory(m.terrain,f,angle,power,m.state.wind,w,[target]);const score=Math.hypot(r.x-target.x,r.y-target.y);if(score<best.score)best={score,angle,power};}
  if((f.powerCharge??0)>=POWER_MAX)this.armPower(f);
  this.boost(f,'damage30');this.fire(m,f,best.angle,Math.max(5,Math.min(100,best.power+(Math.random()-.5)*3)));
 }
 tick(now=Date.now()){
  const dt=Math.min(.15,(now-this.lastTick)/1000);this.lastTick=now;
  const channels=new Set<number>();
  for(const [id,p] of this.peers){
   if(!p.connected&&now-p.lastSeen>30000){this.leave(p);this.peers.delete(id);continue;}
   if(p.connected&&!p.roomId){const dx=p.targetX-p.x,dy=p.targetY-p.y,d=Math.hypot(dx,dy);if(d>1){const step=Math.min(d,160*dt);p.x+=dx/d*step;p.y+=dy/d*step;channels.add(p.channel);}}
  }
  if(++this.lobbyTick%2===0)for(const channel of channels)this.sendLobby(channel);
  for(const m of this.matches.values()){
   if(m.pendingMarks?.length){m.state.terrainMarks=[...(m.state.terrainMarks??[]),...m.pendingMarks.filter(entry=>entry.at<=now).map(entry=>entry.mark)].slice(-48);m.pendingMarks=m.pendingMarks.filter(entry=>entry.at>now);}
   if(m.state.phase==='finished'&&m.state.rewards){const rewards=m.state.rewards;if(rewards.phase==='picking'&&now>=rewards.deadline)this.revealRewards(m);else if(rewards.phase==='revealed'&&!rewards.saved&&now>=(m.retryRewardsAt??0))this.saveRewards(m);if(rewards.saved&&!this.rooms.has(m.state.roomId))this.matches.delete(m.state.roomId);}
   if(m.pendingPower&&now>=m.pendingPower.at){const pending=m.pendingPower;delete m.pendingPower;delete m.state.powerCutIn;const shooter=m.state.players.find(f=>f.id===pending.playerId);if(shooter&&shooter.hp>0&&m.state.phase==='resolving')this.resolveFire(m,shooter,pending.angle,pending.power,true);else if(m.state.phase!=='finished')this.nextTurn(m);}
   if(m.state.phase==='resolving'&&now>=m.resolveAt)this.nextTurn(m);
   else if(m.state.phase==='aiming'){
    if(now>=m.state.deadline)this.nextTurn(m);
    else{const f=m.state.players.find(p=>p.id===m.state.turnId);if(f?.bot&&now>=m.botAt){m.botAt=Infinity;this.bot(m,f);}}
   }
  }
  if(this.roomsDirty)this.broadcastRooms();
 }
}
