import type {Room} from '../shared/protocol';

export function arenaMatchTime(startedAt:number|undefined,now:number){
 if(startedAt===undefined||!Number.isFinite(startedAt)||!Number.isFinite(now))return '—';
 const seconds=Math.max(0,Math.floor((now-startedAt)/1000));return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
}
const searchText=(value:string)=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('pt-BR');
export function arenaRooms(rooms:Room[],query:string){const text=searchText(query.trim());return rooms.filter(room=>!room.practice&&!room.kind&&searchText(room.name).includes(text));}
/** Expedition Center rooms only (the PvP hall never lists them). */
export function expeditionRooms(rooms:Room[],query:string){const text=searchText(query.trim());return rooms.filter(room=>room.kind==='expedition'&&searchText(room.name).includes(text));}
