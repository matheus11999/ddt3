export const ROOM_MODES=['1v1','2v2','3v3','4v4'] as const;
export type RoomMode=typeof ROOM_MODES[number];
export function teamSize(mode:RoomMode){return ROOM_MODES.indexOf(mode)+1;}
export function modeForSlots(count:number):RoomMode {return ROOM_MODES[Math.max(0,Math.min(3,count-1))];}
export function initialSlots(mode:RoomMode){return Array.from({length:teamSize(mode)},(_,i)=>i);}
