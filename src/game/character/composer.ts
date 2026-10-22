import contracts from './contracts.json';

/**
 * Rig v2 (docs/rig-v2.md): the character is composed like DDTank's GameCharacter, RoomCharacter and SceneCharacter.
 * Every piece is painted in every cell of its context on the same grid (transparent margins kept), so pieces are
 * only stacked cell on cell: no pins, no fitting, no shared head moved by code.
 *
 * - game:    combat, 13x3 cells; the action picks a cell per tick (STAND keeps its own sequence for the upper pieces).
 * - show:    bag, shop, rooms; the face has 4 cells (blink), every other piece one cell.
 * - virtual: plaza and Pescaria; head (3 cells: front, eyes closed, back) over a 7x2 body (front row, back row).
 */
export type RigContext='game'|'show'|'virtual';
export type RigSlot='weapon'|'face'|'hair'|'outfit'|'effect'|'hat'|'glasses';
export interface ActionDef {frames:number[][];repeat:boolean;stopAtEnd?:boolean;replaceSame?:boolean;}
export const GAME=contracts.game,SHOW=contracts.show,VIRTUAL=contracts.virtual;
const GAME_ACTIONS=GAME.actions as Record<string,ActionDef>,SHOW_ACTIONS=SHOW.actions as Record<string,ActionDef>,VIRTUAL_ACTIONS=VIRTUAL.actions as Record<string,ActionDef>;

/** One layer of a context: the painted sheet (already tinted) and the slot it belongs to. */
export interface RigLayer {slot:RigSlot|'body'|'head';sheet:CanvasImageSource&{width:number;height:number};}

/** Cell index -> rectangle, like GameCharacter.drawFrame (an invalid index falls back to 0). */
export function cellRect(index:number,columns:number,rows:number,[w,h]:readonly number[]){
 if(!Number.isInteger(index)||index<0||index>=columns*rows)index=0;
 return {x:index%columns*w,y:Math.floor(index/columns)*h,w,h};
}
/** Which cells an action shows at a tick. AS3's loop branch spends one tick resetting without drawing a new cell. */
export function gameFrame(action:string,tick:number){
 const def=GAME_ACTIONS[action]??GAME_ACTIONS.STAND,seq=def.frames[0];
 const i=def.repeat?Math.min(tick%(seq.length+1),seq.length-1):Math.min(tick,seq.length-1);
 // STAND: weapon and face follow frames[0], the pieces above (hair, outfit, effect, hat, glasses) stay on the first cell of
 // frames[1], the face on its first cell: idle stands still (matheus 22/10: no hand shake; DDTank swings cells 6-9 and
 // our face cells are the same head, so moving them only slid the head over the fists).
 // SHAKE (hit) swings the hands through the same cells 6-9: also still, the hit is the head's jolt drawn in code (rig.ts).
 if(action==='SHAKE'){const stand=GAME_ACTIONS.STAND.frames;return {lower:stand[0][0],upper:(stand[1]??stand[0])[0],done:!def.repeat&&tick>=seq.length-1};}
 return {lower:action==='STAND'?seq[0]:seq[i],upper:action==='STAND'&&def.frames[1]?def.frames[1][0]:seq[i],done:!def.repeat&&tick>=seq.length-1};
}
export function showFrame(action:string,tick:number){
 if(action==='STATIC')return 0;
 const seq=(SHOW_ACTIONS[action]??SHOW_ACTIONS.NORMAL_STANDBY).frames[0];return seq[tick%seq.length];
}
export function virtualFrame(action:string,tick:number){
 const def=VIRTUAL_ACTIONS[action]??VIRTUAL_ACTIONS.naturalStandFront,seq=def.frames[0];
 return seq[def.repeat?tick%seq.length:Math.min(tick,seq.length-1)];
}
const LOWER=new Set(['weapon','face']);

/** Draws a combat cell: each layer at its own cell (lower/upper), all at the same place. (0,0) is the character origin. */
export function drawGame(c:CanvasRenderingContext2D,layers:RigLayer[],action:string,tick:number){
 const f=gameFrame(action,tick),[w,h]=GAME.cell,[ox,oy]=GAME.origin;
 for(const layer of layers){const r=cellRect(LOWER.has(layer.slot)?f.lower:f.upper,GAME.columns,GAME.rows,GAME.cell);c.drawImage(layer.sheet,r.x,r.y,w,h,-ox,-oy,w,h);}
 return f;
}
/** Draws the SHOW cell: the face at its blink cell, the rest at cell 0. (0,0) is the cell's top-left corner. */
export function drawShow(c:CanvasRenderingContext2D,layers:RigLayer[],action:string,tick:number){
 const face=showFrame(action,tick),[w,h]=SHOW.cell;
 for(const layer of layers){const x=layer.slot==='face'?face*w:0;c.drawImage(layer.sheet,x,0,w,h,0,0,w,h);}
}
/**
 * Draws a social cell. Frames 0-6 front, 7 blink, 8-14 back. As in DDTank's NaturalFrontAction the head is painted
 * before the body when facing front (the collar covers the neck) and after it from the back (NaturalBackAction). `body` and `head` are already
 * composed (head = face, hair, effect, hat, glasses). (0,0) is the cell's top-left corner.
 */
export function drawVirtual(c:CanvasRenderingContext2D,body:RigLayer['sheet'],head:RigLayer['sheet'],action:string,tick:number){
 const frame=virtualFrame(action,tick),[w,h]=VIRTUAL.cell,back=frame>=8,blink=frame===7;
 const col=blink?0:back?frame-8:frame,row=back?1:0,headCell=back?2:blink?1:0,dy=VIRTUAL.headOffsets[col]??0;
 const paintBody=()=>c.drawImage(body,col*w,row*h,w,h,0,0,w,h),paintHead=()=>c.drawImage(head,headCell*w,0,w,h,0,dy,w,h);
 if(back){paintBody();paintHead();}else{paintHead();paintBody();}
 return frame;
}
