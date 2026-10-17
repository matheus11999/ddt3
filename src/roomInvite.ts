const ROOM_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Share only the public room identifier, never a session or profile token. */
export function roomInviteUrl(roomId:string,base:string){
 if(!ROOM_ID.test(roomId))throw Error('Sala inválida.');
 const url=new URL(base);url.search='';url.hash='';url.searchParams.set('room',roomId);return url.toString();
}

/** Consume a deep link once; reconnection must not repeatedly rejoin a room. */
export function readRoomInvite(base:string){
 const url=new URL(base),id=url.searchParams.get('room');url.searchParams.delete('room');
 return {roomId:id&&ROOM_ID.test(id)?id:null,cleanUrl:url.toString()};
}
